// scripts/add_atkdef_source.js
//
// One-time migration: adds an atk/def data source line to the footer
// "DATA SOURCES" section. Now that atk/def values are auto-computed from
// eloratings.net match histories, the footer should disclose this.
//
// What this script does:
//   1. Adds a new <div class="source-item"> in footer HTML, after the Elo line
//   2. Adds two new translation keys (src_atkdef_label / src_atkdef_desc)
//      to all 10 language packs in the FIRST i18n object (the UI labels one)
//
// What this script does NOT do:
//   - It does NOT modify the i18n applier logic. After running this, you may
//     need to manually wire up the new keys to the DOM (e.g., by adding a
//     line like `$('ui-src-atkdef-label').textContent = T.src_atkdef_label`
//     near the other src_* applier calls). Inspect the result and we can
//     tackle that separately if needed.
//
// Idempotent: safe to re-run.
// CRLF-aware: works on Windows (CRLF) and Unix (LF).
// Backup: writes index.html.atkdefbak on first run.
//
// Usage: node scripts/add_atkdef_source.js

const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'index.html');
const backupPath = path.join(__dirname, '..', 'index.html.atkdefbak');

let html = fs.readFileSync(indexPath, 'utf-8');
const original = html;

const usesCRLF = html.includes('\r\n');
const NL = usesCRLF ? '\r\n' : '\n';
console.log(`Detected line ending: ${usesCRLF ? 'CRLF (Windows)' : 'LF (Unix)'}`);

// === Step 1: Add HTML <div class="source-item"> right after the Elo line ===
const htmlAnchor = `<div class="source-item"><strong id="ui-src-elo-label">Elo Rating</strong>: <a href="https://www.eloratings.net/" target="_blank" rel="noopener" class="footer-link">eloratings.net</a> <span class="source-date">(<span id="ui-src-elo-date">2026-04-25</span>, <span id="ui-src-elo-freq">daily updated</span>)</span></div>`;
const htmlNewLine = `<div class="source-item"><strong id="ui-src-atkdef-label">Atk/Def values</strong>: <span id="ui-src-atkdef-desc">Computed from <a href="https://www.eloratings.net/" target="_blank" rel="noopener" class="footer-link">eloratings.net</a> match histories since 2022</span></div>`;

if (html.includes('id="ui-src-atkdef-label"')) {
  console.log('- HTML: atk/def line already present');
} else if (html.includes(htmlAnchor)) {
  // Match indentation by reading 10 spaces (existing source-item indent)
  const indent = '          ';
  html = html.replace(htmlAnchor, htmlAnchor + NL + indent + htmlNewLine);
  console.log('✓ HTML: added atk/def source line');
} else {
  console.warn('! HTML: anchor (Elo line) not found, atk/def line not added');
}

// === Step 2: Add translation keys to each language pack ===
const translations = {
  ja: { label: 'Atk/Def 値', desc: 'eloratings.net の試合履歴 (2022年以降) から算出' },
  en: { label: 'Atk/Def values', desc: 'Computed from eloratings.net match histories since 2022' },
  es: { label: 'Valores Atk/Def', desc: 'Calculados desde los historiales de partidos de eloratings.net desde 2022' },
  pt: { label: 'Valores Atk/Def', desc: 'Calculados a partir dos históricos de partidas de eloratings.net desde 2022' },
  fr: { label: 'Valeurs Atk/Def', desc: "Calculées à partir des historiques de matchs d'eloratings.net depuis 2022" },
  de: { label: 'Atk/Def-Werte', desc: 'Berechnet aus eloratings.net Spielverläufen seit 2022' },
  it: { label: 'Valori Atk/Def', desc: 'Calcolati dagli storici delle partite di eloratings.net dal 2022' },
  ko: { label: 'Atk/Def 값', desc: 'eloratings.net 경기 기록(2022년 이후)으로부터 산출' },
  zh: { label: 'Atk/Def 数值', desc: '基于 eloratings.net 比赛记录(2022年起)计算得出' },
  ar: { label: 'قيم Atk/Def', desc: 'محسوبة من سجلات مباريات eloratings.net منذ 2022' }
};

let addedToLangs = 0;
let alreadyHadLangs = 0;

for (const lang of Object.keys(translations)) {
  const t = translations[lang];
  const escapedLabel = t.label.replace(/'/g, "\\'");
  const escapedDesc = t.desc.replace(/'/g, "\\'");
  
  // Idempotency check: this lang's exact label already in file?
  const idempotencyMarker = `src_atkdef_label: '${escapedLabel}'`;
  if (html.includes(idempotencyMarker)) {
    alreadyHadLangs++;
    continue;
  }
  
  // Find this language's pack opener
  const langStartPattern = new RegExp(`(\\b${lang}:\\s*\\{)`);
  const langStartMatch = html.match(langStartPattern);
  if (!langStartMatch) {
    console.warn(`! Lang ${lang}: opener not found`);
    continue;
  }
  
  // Within this lang block, find the next src_bracket_label: line
  // (every UI lang pack has it, and it's the natural place to insert before)
  const startIdx = langStartMatch.index;
  const afterStart = html.slice(startIdx);
  const bracketLabelPos = afterStart.indexOf('src_bracket_label:');
  if (bracketLabelPos === -1) {
    // This lang block doesn't have UI keys — skip (probably the share-result block)
    console.log(`  Lang ${lang}: skipping non-UI block`);
    continue;
  }
  
  const absoluteBracketPos = startIdx + bracketLabelPos;
  const lineStart = html.lastIndexOf(NL, absoluteBracketPos) + NL.length;
  const indentSegment = html.slice(lineStart, absoluteBracketPos);
  const useIndent = /^\s*$/.test(indentSegment) ? indentSegment : '    ';
  
  const newLines =
    `${useIndent}src_atkdef_label: '${escapedLabel}',${NL}` +
    `${useIndent}src_atkdef_desc: '${escapedDesc}',${NL}`;
  
  html = html.slice(0, lineStart) + newLines + html.slice(lineStart);
  console.log(`✓ Lang ${lang}: added atk/def keys`);
  addedToLangs++;
}

console.log(`${NL}Languages updated: ${addedToLangs}, already had keys: ${alreadyHadLangs}`);

// === Save ===
if (html !== original) {
  if (!fs.existsSync(backupPath)) {
    fs.writeFileSync(backupPath, original);
    console.log(`${NL}✓ Backup saved to index.html.atkdefbak`);
  } else {
    console.log(`${NL}- Backup already exists, not overwriting`);
  }
  fs.writeFileSync(indexPath, html);
  console.log(`✓ index.html updated`);
  console.log(`${NL}NEXT STEP: Test with 'npx serve' and check the footer.`);
  console.log('If the new line shows but doesn\'t translate when changing language,');
  console.log('we need to wire up the i18n applier — share the i18n code and we\'ll fix it.');
} else {
  console.log(`${NL}No changes made (already migrated or patterns not found)`);
}
