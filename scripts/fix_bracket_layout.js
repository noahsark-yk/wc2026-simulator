// scripts/fix_bracket_layout.js  (v2 - CRLF aware)
//
// One-time fix: prevents the knockout bracket from cropping team names when
// long names appear in either half (e.g., "アルゼンチン", "ボスニア・ヘルツェゴビナ").
//
// Root cause:
//   .hbr-wrap uses `grid-template-columns: 1fr auto 1fr` which causes the
//   left and right halves to fight for space based on their content size.
//   When one side has longer names, the other side gets squished.
//
// Fix (3 changes):
//   1. .hbr-wrap: replace `1fr auto 1fr` with `minmax(0, 1fr) auto minmax(0, 1fr)`
//   2. .hbr-side: add `min-width: 0`
//   3. .hbr-center: add `max-width: 220px`
//
// IMPORTANT: This file is saved as binary read/write so we preserve the
// original CRLF line endings of index.html on Windows. We work with raw
// strings and let line-end characters survive untouched.
//
// Idempotent: safe to re-run.
// Usage: node scripts/fix_bracket_layout.js

const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'index.html');
const backupPath = path.join(__dirname, '..', 'index.html.bracketbak');

// Read raw file as string. Line endings will be CRLF on Windows.
let html = fs.readFileSync(indexPath, 'utf-8');
const original = html;

// Detect line ending so our patches match
const usesCRLF = html.includes('\r\n');
const NL = usesCRLF ? '\r\n' : '\n';
console.log(`Detected line ending: ${usesCRLF ? 'CRLF (Windows)' : 'LF (Unix)'}`);

// Helper: build a multi-line string with the right line ending
function ml(...lines) { return lines.join(NL); }

// === Fix 1: .hbr-wrap grid-template-columns ===
const fix1From = ml(
  'grid-template-columns: 1fr auto 1fr;',
  '  gap: 12px;',
  '  align-items: center;',
  '  background: var(--bg-secondary);'
);
const fix1To = ml(
  'grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);',
  '  gap: 12px;',
  '  align-items: center;',
  '  background: var(--bg-secondary);'
);

if (html.includes(fix1From)) {
  html = html.replace(fix1From, fix1To);
  console.log('✓ Fix 1: .hbr-wrap grid-template-columns updated');
} else if (html.includes('grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);')) {
  console.log('- Fix 1: already applied');
} else {
  console.warn('! Fix 1: pattern not found');
}

// === Fix 2: .hbr-side add min-width: 0 ===
const fix2From = ml(
  '.hbr-side {',
  '  display: flex;',
  '  align-items: stretch;',
  '}'
);
const fix2To = ml(
  '.hbr-side {',
  '  display: flex;',
  '  align-items: stretch;',
  '  min-width: 0;',
  '}'
);

if (html.includes(fix2From)) {
  html = html.replace(fix2From, fix2To);
  console.log('✓ Fix 2: .hbr-side now has min-width: 0');
} else if (html.includes('.hbr-side {' + NL + '  display: flex;' + NL + '  align-items: stretch;' + NL + '  min-width: 0;')) {
  console.log('- Fix 2: already applied');
} else {
  console.warn('! Fix 2: pattern not found');
}

// === Fix 3: .hbr-center add max-width: 220px ===
const fix3From = ml(
  '.hbr-center {',
  '  display: flex;',
  '  flex-direction: column;',
  '  align-items: center;',
  '  gap: 10px;',
  '  min-width: 180px;',
  '  padding: 0 4px;',
  '}'
);
const fix3To = ml(
  '.hbr-center {',
  '  display: flex;',
  '  flex-direction: column;',
  '  align-items: center;',
  '  gap: 10px;',
  '  min-width: 180px;',
  '  max-width: 220px;',
  '  padding: 0 4px;',
  '}'
);

if (html.includes(fix3From)) {
  html = html.replace(fix3From, fix3To);
  console.log('✓ Fix 3: .hbr-center now has max-width: 220px');
} else if (html.includes('max-width: 220px;' + NL + '  padding: 0 4px;' + NL + '}')) {
  console.log('- Fix 3: already applied');
} else {
  console.warn('! Fix 3: pattern not found');
}

// === Save ===
if (html !== original) {
  if (!fs.existsSync(backupPath)) {
    fs.writeFileSync(backupPath, original);
    console.log(`${NL}✓ Backup saved to index.html.bracketbak`);
  } else {
    console.log(`${NL}- Backup already exists, not overwriting`);
  }
  fs.writeFileSync(indexPath, html);
  console.log(`✓ index.html updated`);
} else {
  console.log(`${NL}No changes made`);
}
