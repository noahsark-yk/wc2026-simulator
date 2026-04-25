// scripts/fix_ogp_url.js
//
// Replaces "noahsark-wc2026.netlify.app" with "noahsark-wc2026.pages.dev"
// throughout index.html (5 occurrences expected: og:url, og:image,
// twitter:image, canonical, og:image again).
//
// Idempotent. Works regardless of CRLF/LF.
// Usage: node scripts/fix_ogp_url.js

const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(indexPath, 'utf-8');
const original = html;

const OLD_HOST = 'noahsark-wc2026.netlify.app';
const NEW_HOST = 'noahsark-wc2026.pages.dev';

const before = (html.match(new RegExp(OLD_HOST.replace(/\./g, '\\.'), 'g')) || []).length;
const alreadyMigrated = (html.match(new RegExp(NEW_HOST.replace(/\./g, '\\.'), 'g')) || []).length;

console.log(`Before: ${before} occurrence(s) of ${OLD_HOST}`);
console.log(`Already: ${alreadyMigrated} occurrence(s) of ${NEW_HOST}`);

if (before === 0 && alreadyMigrated > 0) {
  console.log('Already migrated, no changes made.');
  process.exit(0);
}

// Replace all
html = html.split(OLD_HOST).join(NEW_HOST);

const after = (html.match(new RegExp(NEW_HOST.replace(/\./g, '\\.'), 'g')) || []).length;
const remaining = (html.match(new RegExp(OLD_HOST.replace(/\./g, '\\.'), 'g')) || []).length;

console.log(`After:  ${after} occurrence(s) of ${NEW_HOST}`);
console.log(`Remaining ${OLD_HOST}: ${remaining}`);

if (html !== original) {
  fs.writeFileSync(indexPath, html);
  console.log('Wrote index.html');
} else {
  console.log('No changes (something unexpected happened).');
}
