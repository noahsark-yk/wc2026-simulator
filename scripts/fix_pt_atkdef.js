// scripts/fix_pt_atkdef.js
//
// Patches the pt: language pack which was skipped by add_atkdef_source.js
// because its label string 'Valores Atk/Def' is identical to es:.
//
// Idempotent: detects if pt already has the keys.
// Usage: node scripts/fix_pt_atkdef.js

const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(indexPath, 'utf-8');

const usesCRLF = html.includes('\r\n');
const NL = usesCRLF ? '\r\n' : '\n';
console.log(`Detected line ending: ${usesCRLF ? 'CRLF' : 'LF'}`);

// Find pt: { ... } block
const ptStartMatch = html.match(/(\bpt:\s*\{)/);
if (!ptStartMatch) {
  console.error('! pt: block not found');
  process.exit(1);
}
const ptStartIdx = ptStartMatch.index;

// Within pt block, find src_bracket_label:
const afterPt = html.slice(ptStartIdx);
const bracketLabelPos = afterPt.indexOf('src_bracket_label:');
if (bracketLabelPos === -1) {
  console.error('! src_bracket_label not found in pt block');
  process.exit(1);
}

const absBracketPos = ptStartIdx + bracketLabelPos;
const lineStart = html.lastIndexOf(NL, absBracketPos) + NL.length;
const indent = html.slice(lineStart, absBracketPos);
const useIndent = /^\s*$/.test(indent) ? indent : '    ';

// Check if pt already has src_atkdef_label between ptStartIdx and absBracketPos
const ptBlockSlice = html.slice(ptStartIdx, absBracketPos);
if (ptBlockSlice.includes('src_atkdef_label:')) {
  console.log('- pt already has src_atkdef_label, no changes');
  process.exit(0);
}

const newLines =
  `${useIndent}src_atkdef_label: 'Valores Atk/Def',${NL}` +
  `${useIndent}src_atkdef_desc: 'Calculados a partir dos históricos de partidas de eloratings.net desde 2022',${NL}`;

html = html.slice(0, lineStart) + newLines + html.slice(lineStart);
fs.writeFileSync(indexPath, html);
console.log('✓ Added atk/def keys to pt language pack');
