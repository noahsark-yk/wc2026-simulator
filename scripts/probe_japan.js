// scripts/probe_japan.js
//
// Reconnaissance: try to fetch Japan's match history from eloratings.net.
// We try several URL patterns and DOM extraction strategies to see what works.
// Output: raw debug info to stdout, no JSON file written.
//
// Usage: node scripts/probe_japan.js

const puppeteer = require('puppeteer');

async function tryUrl(page, url, label) {
  console.log(`\n========== ${label} ==========`);
  console.log(`URL: ${url}`);
  try {
    const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    console.log(`HTTP status: ${response.status()}`);
    
    // Wait a bit for SPA rendering
    await new Promise(r => setTimeout(r, 3000));
    
    // Get the page title and any team-name indicators
    const info = await page.evaluate(() => {
      const out = {
        title: document.title,
        bodyTextLength: document.body.innerText.length,
        h1Texts: Array.from(document.querySelectorAll('h1')).map(h => h.textContent.trim()).slice(0, 3),
        h2Texts: Array.from(document.querySelectorAll('h2')).map(h => h.textContent.trim()).slice(0, 5),
        // Tables
        tableCount: document.querySelectorAll('table').length,
        slickRowCount: document.querySelectorAll('.slick-row').length,
        // Look for "Japan" anywhere in visible text
        hasJapanText: document.body.innerText.includes('Japan'),
        // Get first 500 chars of body text
        bodyTextSample: document.body.innerText.slice(0, 800)
      };
      return out;
    });
    
    console.log('Title:', info.title);
    console.log('Body text length:', info.bodyTextLength);
    console.log('H1 texts:', info.h1Texts);
    console.log('H2 texts:', info.h2Texts);
    console.log('Table count:', info.tableCount);
    console.log('SlickGrid row count:', info.slickRowCount);
    console.log('Has "Japan" text:', info.hasJapanText);
    console.log('Body sample:', info.bodyTextSample.slice(0, 500));
    
    return info;
  } catch (err) {
    console.error(`ERROR: ${err.message}`);
    return null;
  }
}

async function main() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Try several URL patterns to find Japan's team page
    const candidates = [
      ['https://www.eloratings.net/Japan', 'Pattern 1: /Japan'],
      ['https://www.eloratings.net/JPN', 'Pattern 2: /JPN'],
      ['https://www.eloratings.net/team/Japan', 'Pattern 3: /team/Japan'],
      ['https://www.eloratings.net/?team=Japan', 'Pattern 4: query param ?team='],
      ['https://www.eloratings.net/#Japan', 'Pattern 5: hash #Japan'],
    ];

    for (const [url, label] of candidates) {
      await tryUrl(page, url, label);
    }

    // Also: try the latest matches page
    console.log('\n\n=== Bonus: trying /latest page ===');
    await tryUrl(page, 'https://www.eloratings.net/latest', '/latest page (recent matches across all teams)');
    
    console.log('\n\n=== DONE. Review the output above to find which pattern works. ===');
  } finally {
    await browser.close();
    console.log('Browser closed');
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
