// scripts/debug_cells.js
//
// Diagnostic: load Japan's page, dump the first 5 .slick-row elements'
// cell-by-cell content so we can see the actual structure.

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
    
    // Try scrolling slick-viewport to ensure rows are loaded
    await page.evaluate(async () => {
      const viewport = document.querySelector('.slick-viewport');
      if (viewport) {
        viewport.scrollTop = 0;
        await new Promise(r => setTimeout(r, 200));
      }
    });
    
    // Extract first 8 rows in detail
    const debug = await page.evaluate(() => {
      const rows = document.querySelectorAll('.slick-row');
      const out = [];
      // Show the row structure for the FIRST 8 rows
      // (if rows are sorted newest-first, these are the most recent matches)
      const limit = Math.min(8, rows.length);
      for (let i = 0; i < limit; i++) {
        const row = rows[i];
        const cells = row.querySelectorAll('.slick-cell');
        const cellsData = Array.from(cells).map((c, idx) => ({
          idx,
          text: c.textContent.trim(),
          html: c.innerHTML.slice(0, 200)
        }));
        out.push({ rowIdx: i, cellCount: cells.length, cells: cellsData });
      }
      return out;
    });
    
    console.log(`\n=== FIRST ${debug.length} ROWS ===\n`);
    for (const row of debug) {
      console.log(`\n--- Row ${row.rowIdx} (${row.cellCount} cells) ---`);
      for (const cell of row.cells) {
        console.log(`  [${cell.idx}] "${cell.text}"`);
      }
    }
    
    // Also print where rows are in the DOM (some may be virtualized off-screen)
    const rowPositions = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.slick-row')).slice(0, 5);
      return rows.map(r => ({
        top: r.style.top,
        index: r.getAttribute('row') || 'no-row-attr',
        firstCell: r.querySelector('.slick-cell')?.textContent.trim().slice(0, 30)
      }));
    });
    console.log('\n=== Row positions (first 5) ===');
    console.log(rowPositions);
    
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
