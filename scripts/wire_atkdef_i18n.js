// scripts/wire_atkdef_i18n.js
//
// Wires up the new src_atkdef_label / src_atkdef_desc translation keys to
// the DOM, so they actually update when the user changes language.
//
// Adds two lines next to the existing src_elo_freq applier:
//   $('ui-src-atkdef-label').textContent = t('src_atkdef_label');
//   $('ui-src-atkdef-desc').innerHTML = t('src_atkdef_desc')
//     .replace('eloratings.net', '<a ...>eloratings.net</a>');
//
// Idempotent + CRLF-aware.
// Usage: node scripts/wire_atkdef_i18n.js

const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(indexPath, 'utf-8');

const usesCRLF = html.includes('\r\n');
const NL = usesCRLF ? '\r\n' : '\n';
console.log(`Detected line ending: ${usesCRLF ? 'CRLF' : 'LF'}`);

// Anchor: insert AFTER this line
const anchor = `$('ui-src-elo-freq').textContent = t('src_elo_freq');`;

// New lines to insert (with same indentation as anchor, which is 2 spaces)
// Note: we use innerHTML for desc so we can wrap eloratings.net in an <a> tag
const indent = '  ';  // matches existing applier indentation
const newLines =
  `${indent}$('ui-src-atkdef-label').textContent = t('src_atkdef_label');${NL}` +
  `${indent}$('ui-src-atkdef-desc').innerHTML = t('src_atkdef_desc').replace('eloratings.net', '<a href="https://www.eloratings.net/" target="_blank" rel="noopener" class="footer-link">eloratings.net</a>');${NL}`;

if (html.includes("$('ui-src-atkdef-label').textContent")) {
  console.log('- atk/def i18n applier already wired up');
} else if (html.includes(anchor)) {
  // Insert after anchor line. Find end of that line.
  const anchorIdx = html.indexOf(anchor);
  const lineEnd = html.indexOf(NL, anchorIdx);
  if (lineEnd === -1) {
    console.error('! Could not find end of anchor line');
    process.exit(1);
  }
  // Insert just AFTER the line ending of anchor
  html = html.slice(0, lineEnd + NL.length) + newLines + html.slice(lineEnd + NL.length);
  console.log('✓ Wired up i18n applier for atk/def');
} else {
  console.error('! Anchor not found');
  process.exit(1);
}

fs.writeFileSync(indexPath, html);
console.log('✓ index.html updated');
