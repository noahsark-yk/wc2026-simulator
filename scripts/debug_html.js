// scripts/debug_html.js
//
// Diagnostic: load Japan's page, scroll to bottom, dump the raw innerHTML
// of the LAST row to see if cells contain inner spans that we can use
// for clean splitting.

const puppeteer = require('puppeteer');

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
    
    console.log('Loading https://www.eloratings.net/Japan...');
    await page.goto('https://www.eloratings.net/Japan', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await new Promise(r => setTimeout(r, 4000));
    
    // Get the most recent row's innerHTML for each cell
    const debug = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.slick-row'));
      // Find row with highest top
      let topMost = null;
      let topMostTop = -Infinity;
      for (const r of rows) {
        const top = parseInt(r.style.top || '0');
        if (top > topMostTop) {
          topMostTop = top;
          topMost = r;
        }
      }
      if (!topMost) return null;
      
      const cells = topMost.querySelectorAll('.slick-cell');
      return Array.from(cells).map((c, idx) => ({
        idx,
        textContent: c.textContent,
        innerHTML: c.innerHTML,
        // Try common child element selectors to see what they hold
        allDivs: Array.from(c.querySelectorAll('div')).map(d => d.textContent),
        allSpans: Array.from(c.querySelectorAll('span')).map(s => s.textContent),
        directChildren: Array.from(c.children).map(ch => ({
          tag: ch.tagName,
          text: ch.textContent
        }))
      }));
    });
    
    console.log('\n=== MOST RECENT ROW ===\n');
    if (!debug) {
      console.log('No rows found');
    } else {
      for (const cell of debug) {
        console.log(`\n--- Cell ${cell.idx} ---`);
        console.log(`  textContent: "${cell.textContent}"`);
        console.log(`  innerHTML: ${cell.innerHTML}`);
        console.log(`  allDivs: ${JSON.stringify(cell.allDivs)}`);
        console.log(`  allSpans: ${JSON.stringify(cell.allSpans)}`);
        console.log(`  directChildren:`);
        for (const ch of cell.directChildren) {
          console.log(`    <${ch.tag}> "${ch.text}"`);
        }
      }
    }
    
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
