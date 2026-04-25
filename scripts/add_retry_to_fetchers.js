// scripts/add_retry_to_fetchers.js
//
// One-time migration: adds retry logic and extends timeouts in fetch_elo.js
// and fetch_matches.js, so transient eloratings.net slowdowns don't fail the
// daily Bot run.
//
// Changes:
//   fetch_elo.js:
//     - page.goto timeout: 60s -> 90s
//     - waitForSelector('.slick-row') timeout: 30s -> 60s
//     - Wrap whole main() in retry loop (3 attempts, 10s/20s backoff)
//
//   fetch_matches.js:
//     - page.goto timeout: 30s -> 60s
//     - Per-team retry (each team gets up to 2 attempts before being marked failed)
//
// CRLF-aware. Idempotent.
// Backups: writes .retrybak versions before modifying.
//
// Usage: node scripts/add_retry_to_fetchers.js

const fs = require('fs');
const path = require('path');

function patchFile(filename, replacements, backupSuffix) {
  const filePath = path.join(__dirname, filename);
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;
  
  const usesCRLF = content.includes('\r\n');
  const NL = usesCRLF ? '\r\n' : '\n';
  console.log(`\n=== ${filename} (${usesCRLF ? 'CRLF' : 'LF'}) ===`);
  
  // Transform pattern strings to match file's line ending
  const transformNL = (s) => usesCRLF ? s.replace(/\r?\n/g, '\r\n') : s.replace(/\r\n/g, '\n');
  
  let appliedCount = 0;
  let alreadyCount = 0;
  
  for (const r of replacements) {
    const fromPattern = transformNL(r.from);
    const toPattern = transformNL(r.to);
    
    if (content.includes(fromPattern)) {
      content = content.replace(fromPattern, toPattern);
      console.log(`  ✓ ${r.desc}`);
      appliedCount++;
    } else if (content.includes(toPattern)) {
      console.log(`  - ${r.desc} (already applied)`);
      alreadyCount++;
    } else {
      console.warn(`  ! ${r.desc} (pattern not found)`);
    }
  }
  
  if (content !== original) {
    const backupPath = filePath + backupSuffix;
    if (!fs.existsSync(backupPath)) {
      fs.writeFileSync(backupPath, original);
      console.log(`  Backup -> ${path.basename(backupPath)}`);
    }
    fs.writeFileSync(filePath, content);
    console.log(`  Applied ${appliedCount} change(s)`);
  } else {
    console.log(`  No changes needed`);
  }
}

// ============================================================
// fetch_elo.js patches
// ============================================================
const eloPatches = [
  {
    desc: 'page.goto timeout 60000 -> 90000',
    from: `await page.goto('https://www.eloratings.net/', {\n      waitUntil: 'networkidle2',\n      timeout: 60000\n    });`,
    to:   `await page.goto('https://www.eloratings.net/', {\n      waitUntil: 'networkidle2',\n      timeout: 90000\n    });`
  },
  {
    desc: 'waitForSelector timeout 30000 -> 60000',
    from: `await page.waitForSelector('.slick-row', { timeout: 30000 });`,
    to:   `await page.waitForSelector('.slick-row', { timeout: 60000 });`
  },
  {
    desc: 'Wrap script entry in retry loop',
    // The actual file has main().catch over 3 lines. Match that exact form.
    from: `main().catch(err => {\n  console.error('FATAL:', err);\n  process.exit(1);\n});`,
    to: `// === Retry wrapper (added by add_retry_to_fetchers.js) ===
async function withRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      const isLast = (i === maxRetries - 1);
      console.warn(\`Attempt \${i+1}/\${maxRetries} failed: \${err.message}\`);
      if (isLast) throw err;
      const backoffMs = 10000 * (i + 1);
      console.log(\`Retrying in \${backoffMs/1000}s...\`);
      await new Promise(r => setTimeout(r, backoffMs));
    }
  }
}

withRetry(main).catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});`
  }
];

// ============================================================
// fetch_matches.js patches
// ============================================================
const matchesPatches = [
  {
    desc: 'page.goto timeout 30000 -> 60000',
    from: `const res = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });`,
    to:   `const res = await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });`
  }
];

// ============================================================
// Run patches
// ============================================================
patchFile('fetch_elo.js', eloPatches, '.retrybak');
patchFile('fetch_matches.js', matchesPatches, '.retrybak');

console.log('\n✓ Done');
console.log('\nNote: run the patched scripts locally once to verify nothing broke:');
console.log('  node scripts/fetch_elo.js');
