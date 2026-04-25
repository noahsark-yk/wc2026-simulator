// scripts/debug_cells_last.js
//
// Diagnostic: load Japan's page, scroll to bottom of slick-viewport,
// dump the LAST 8 .slick-row elements (which should be the most recent matches).

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
    
    // Try scrolling slick-viewport ALL THE WAY DOWN
    const scrollInfo = await page.evaluate(async () => {
      const viewport = document.querySelector('.slick-viewport');
      if (!viewport) return { found: false };
      const scrollHeight = viewport.scrollHeight;
      // Scroll incrementally to allow virtualization to load rows
      const stepCount = 30;
      for (let i = 1; i <= stepCount; i++) {
        viewport.scrollTop = (scrollHeight * i) / stepCount;
        await new Promise(r => setTimeout(r, 150));
      }
      // Stop at very bottom
      viewport.scrollTop = scrollHeight;
      await new Promise(r => setTimeout(r, 500));
      return {
        found: true,
        scrollHeight,
        finalScrollTop: viewport.scrollTop,
        rowCount: document.querySelectorAll('.slick-row').length
      };
    });
    console.log('Scroll info:', scrollInfo);
    
    // Now grab the rows visible in DOM (the LAST ones, since we scrolled to bottom)
    const debug = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.slick-row'));
      // Get rows with the highest "top" pixel value (those are the latest)
      const sortedByTop = rows
        .map(r => ({
          top: parseInt(r.style.top || '0'),
          cells: Array.from(r.querySelectorAll('.slick-cell')).map(c => c.textContent.trim())
        }))
        .sort((a, b) => b.top - a.top);
      
      // Return the top 8 (highest top = furthest down = most recent)
      return sortedByTop.slice(0, 8).reverse();  // reverse so chronological newest-first within slice
    });
    
    console.log(`\n=== LAST 8 ROWS (most recent matches) ===\n`);
    for (let i = 0; i < debug.length; i++) {
      const row = debug[i];
      console.log(`\n--- Row at top=${row.top}px (${row.cells.length} cells) ---`);
      for (let j = 0; j < row.cells.length; j++) {
        console.log(`  [${j}] "${row.cells[j]}"`);
      }
    }
    
    // Also: how many total rows in DOM after full scroll?
    const totalRows = await page.evaluate(() => document.querySelectorAll('.slick-row').length);
    console.log(`\nTotal rows in DOM after scroll: ${totalRows}`);
    
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
