// scripts/migrate_flags.js  (v2 - fixed helper insertion)
//
// One-time migration: update index.html to use flag-icons CDN.
//
// IMPORTANT: This script is IDEMPOTENT (safe to re-run).
// If a previous run left index.html in a half-migrated state, this v2 will
// detect what's missing and finish the job.
//
// What this does:
//   1. Adds flag-icons CSS link in <head>
//   2. Adds .fi CSS rule for sizing
//   3. Adds flagHtml() and flagHtmlByCode() helper functions (FIXED in v2)
//   4. Replaces direct team.f usages with flagHtml(team) calls
//
// Backup: writes index.html.flagbak before modifying (only on first run)
// Usage: node scripts/migrate_flags.js

const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'index.html');
const backupPath = path.join(__dirname, '..', 'index.html.flagbak');

let html = fs.readFileSync(indexPath, 'utf-8');
const original = html;

// === Step 1: Add flag-icons CSS link in <head> ===
const cssLink = '<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/css/flag-icons.min.css">';
if (!html.includes('flag-icons.min.css')) {
  html = html.replace('</head>', `  ${cssLink}\n</head>`);
  console.log('✓ Added flag-icons CSS link');
} else {
  console.log('- flag-icons CSS link already present');
}

// === Step 2: Add CSS rules for flag sizing ===
const fiCss = `
/* flag-icons sizing (added by migrate_flags.js) */
.fi {
  display: inline-block;
  width: 1.3em;
  height: 1em;
  vertical-align: -0.15em;
  margin-right: 5px;
  background-size: cover;
  background-position: 50%;
  background-repeat: no-repeat;
  border-radius: 1px;
}
[dir="rtl"] .fi { margin-right: 0; margin-left: 5px; }
.hbr-match .fi { width: 1.1em; margin-right: 3px; }
.mhbr-half-grid .fi { width: 1em; margin-right: 2px; }
@media (max-width: 600px) {
  .mhbr-half-grid .fi { width: 0.9em; margin-right: 1px; }
}
`;
if (!html.includes('/* flag-icons sizing')) {
  const headSection = html.indexOf('</head>');
  const styleEnd = html.lastIndexOf('</style>', headSection);
  if (styleEnd === -1) {
    console.error('Could not find </style> in <head>');
    process.exit(1);
  }
  html = html.slice(0, styleEnd) + fiCss + '\n' + html.slice(styleEnd);
  console.log('✓ Added .fi CSS rules');
} else {
  console.log('- .fi CSS rules already present');
}

// === Step 3: Add flagHtml() helper function (v2 - simple anchor approach) ===
// We anchor on a known constant string in the JS section. The "const getTeam"
// declaration is a stable single-occurrence anchor in index.html.
const flagHtmlHelper = `
// === Flag rendering helpers (added by migrate_flags.js) ===
// Convert team.f (ISO2 code like "jp", "br", "gb-eng") into a flag-icons HTML span.
// Falls back to empty string. Legacy emoji values (if any) are passed through.
function flagHtml(team) {
  if (!team || !team.f) return '';
  if (/^[a-z]{2}(-[a-z]+)?$/.test(team.f)) {
    return '<span class="fi fi-' + team.f + '"></span>';
  }
  return team.f;
}
function flagHtmlByCode(code) {
  const t = (typeof TEAMS !== 'undefined') ? TEAMS.find(x => x.c === code) : null;
  return flagHtml(t);
}
// ===========================================================
`;

if (!html.includes('function flagHtml(team)')) {
  // Find the line "const getTeam = (code) =>" — single occurrence in JS section.
  // Insert helper just BEFORE that line.
  const anchor = 'const getTeam = (code) => TEAMS.find(x => x.c === code);';
  const idx = html.indexOf(anchor);
  if (idx === -1) {
    console.error('! Could not find anchor "const getTeam ="');
    console.error('  Aborting helper insertion. You may need to add it manually.');
    process.exit(1);
  }
  html = html.slice(0, idx) + flagHtmlHelper + '\n' + html.slice(idx);
  console.log('✓ Added flagHtml() / flagHtmlByCode() helpers');
} else {
  console.log('- flagHtml() helpers already present');
}

// === Step 4: Replace direct team.f usages ===
// Each replacement is matched against the CURRENT html state. Idempotent —
// already-migrated lines are detected and skipped.
const replacements = [
  {
    desc: 'getTeamFlag function body',
    from: '  const team = TEAMS.find(x => x.c === code);\n  return team && team.f ? team.f : \'\';',
    to:   '  const team = TEAMS.find(x => x.c === code);\n  return flagHtml(team);'
  },
  {
    desc: 'championFlag (champion banner)',
    from: 'const championFlag = championTeam.f;',
    to:   'const championFlag = flagHtml(championTeam);'
  },
  {
    desc: 'focusFlag (focus team display)',
    from: 'const focusFlag = focusTeam.f;',
    to:   'const focusFlag = flagHtml(focusTeam);'
  },
  {
    desc: 'opp.t1.f / opp.t2.f message payload',
    from: 't1: { c: picked.t1.c, f: picked.t1.f || \'\' },\n            t2: { c: picked.t2.c, f: picked.t2.f || \'\' },',
    to:   't1: { c: picked.t1.c, f: flagHtml(picked.t1) },\n            t2: { c: picked.t2.c, f: flagHtml(picked.t2) },'
  },
  {
    desc: 'r-flag span (rating ranking)',
    from: 'html += `<span class="r-flag">${team.f || \'\'}</span>`;',
    to:   'html += `<span class="r-flag">${flagHtml(team)}</span>`;'
  },
  {
    desc: 'team selector dropdown text (no flag in dropdown)',
    from: 'opt.textContent = `${team.f} ${nm(team.c)} (${fmtRating(rating(team))})`;',
    to:   'opt.textContent = `${nm(team.c)} (${fmtRating(rating(team))})`;'
  },
  {
    desc: 'allRanking flag lookup',
    from: 'const flag = getTeam(code) ? (getTeam(code).f || \'\') : \'\';',
    to:   'const flag = flagHtmlByCode(code);'
  },
  {
    desc: 'team rank flag (group-stage)',
    from: 'const flag = team ? (team.f || \'\') : \'\';',
    to:   'const flag = flagHtml(team);'
  }
];

let replaceCount = 0;
let alreadyCount = 0;
for (const r of replacements) {
  if (html.includes(r.from)) {
    html = html.replace(r.from, r.to);
    console.log(`✓ Replaced: ${r.desc}`);
    replaceCount++;
  } else if (html.includes(r.to)) {
    console.log(`- Already migrated: ${r.desc}`);
    alreadyCount++;
  } else {
    console.warn(`! Pattern not found: ${r.desc}`);
  }
}

// === Save ===
if (html !== original) {
  // Only create backup if not already present
  if (!fs.existsSync(backupPath)) {
    fs.writeFileSync(backupPath, original);
    console.log(`\n✓ Backup saved to index.html.flagbak`);
  } else {
    console.log(`\n- Backup already exists, not overwriting`);
  }
  fs.writeFileSync(indexPath, html);
  console.log(`✓ index.html updated`);
  console.log(`  ${replaceCount} new replacements made`);
  console.log(`  ${alreadyCount} already migrated (skipped)`);
} else {
  console.log('\nNo changes made (already fully migrated)');
}
