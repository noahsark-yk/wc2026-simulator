// scripts/fetch_fifa_rank.js
//
// Fetches current FIFA rankings for the 48 World Cup 2026 teams from
// football-ranking.com (pages 1+2 covers ranks 1-100, includes all WC teams).
// Outputs to scripts/fifa_data.json
//
// Usage: node scripts/fetch_fifa_rank.js

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Our 48 World Cup 2026 team codes (TLAs, mostly standard FIFA codes)
const WC_TEAM_CODES = [
  'ESP','FRA','ENG','POR','NED','GER','CRO','SUI','BEL','AUT',
  'CZE','NOR','BIH','SCO','TUR','SWE',
  'ARG','BRA','COL','URU','ECU','PAR',
  'USA','CAN','MEX','PAN','CUW','HAI',
  'JPN','KOR','IRN','KSA','AUS','UZB','JOR','IRQ','QAT',
  'MAR','SEN','TUN','EGY','ALG','CIV','GHA','CPV','RSA','COD',
  'NZL'
];

const PAGES_TO_FETCH = [
  'https://football-ranking.com/fifa-rankings',
  'https://football-ranking.com/fifa-rankings?page=2'
];

// Map source codes to our codes if they differ.
// Most use standard FIFA codes — extend this only if mismatches found.
const SOURCE_TO_OUR_CODE = {
  // (empty — populated as needed)
};

async function fetchPageData(page, url) {
  await page.goto(url, {
    waitUntil: 'networkidle2',
    timeout: 90000
  });
  // Give the page a moment to settle
  await new Promise(r => setTimeout(r, 2000));
  
  const rows = await page.evaluate(() => {
    const out = [];
    const tables = document.querySelectorAll('table');
    
    for (const table of tables) {
      // Identify the rankings table by structure:
      // It must contain at least one <a href="...team=XXX..."> link.
      // (The other table on this page is the match history, which doesn't
      // have team= links in this format.)
      const teamAnchors = table.querySelectorAll('a[href*="team="]');
      if (teamAnchors.length < 5) continue;
      
      const dataRows = table.querySelectorAll('tbody tr, tr');
      for (const tr of dataRows) {
        const cells = tr.querySelectorAll('td');
        if (cells.length < 3) continue;
        if (tr.querySelector('th')) continue;  // header row
        
        // Rank
        const rankText = (cells[0].textContent || '').trim();
        const rankMatch = rankText.match(/^\s*(\d+)/);
        if (!rankMatch) continue;
        const rank = parseInt(rankMatch[1], 10);
        
        // TLA extraction — try multiple sources
        let tla = null;
        
        // (1) Anchor href with ?team=XXX
        const anchors = tr.querySelectorAll('a[href*="team="]');
        for (const a of anchors) {
          const href = a.getAttribute('href') || '';
          const m = href.match(/[?&]team=([A-Z]+)/);
          if (m) { tla = m[1]; break; }
        }
        
        // (2) Pattern "(TLA)" in team-name cell text
        if (!tla) {
          const teamText = (cells[1].textContent || '');
          const m = teamText.match(/\(([A-Z]{3})\)/);
          if (m) tla = m[1];
        }
        
        if (!tla) continue;  // skip rows we can't identify
        
        // Points — first decimal number in cells[2]
        const ptText = (cells[2].textContent || '').trim();
        const ptMatch = ptText.match(/(\d{1,3}(?:,\d{3})*)\.(\d+)/);
        if (!ptMatch) continue;
        const points = parseFloat(ptMatch[0].replace(/,/g, ''));
        
        out.push({ rank, tla, points });
      }
      break;  // Only process the first matching table
    }
    return out;
  });
  
  return rows;
}

async function main() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const allRows = [];
    
    for (const url of PAGES_TO_FETCH) {
      console.log(`Fetching: ${url}`);
      const page = await browser.newPage();
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );
      
      const rows = await fetchPageData(page, url);
      console.log(`  Got ${rows.length} rows from this page`);
      allRows.push(...rows);
      await page.close();
    }
    
    console.log(`\nTotal rows extracted: ${allRows.length}`);
    
    // Deduplicate by TLA (page 2 might overlap)
    const seen = new Set();
    const uniqueRows = [];
    for (const r of allRows) {
      if (seen.has(r.tla)) continue;
      seen.add(r.tla);
      uniqueRows.push(r);
    }
    console.log(`Unique TLAs: ${uniqueRows.length}`);
    
    // Match WC teams
    const fifaByCode = {};
    for (const row of uniqueRows) {
      const ourCode = SOURCE_TO_OUR_CODE[row.tla] || row.tla;
      if (WC_TEAM_CODES.includes(ourCode)) {
        fifaByCode[ourCode] = {
          rank: row.rank,
          points: row.points
        };
      }
    }
    
    const matchedCount = Object.keys(fifaByCode).length;
    console.log(`\nMatched ${matchedCount}/48 World Cup teams`);
    
    // Detect missing teams
    const missing = WC_TEAM_CODES.filter(c => !fifaByCode[c]);
    if (missing.length > 0) {
      console.warn(`\nMissing teams (${missing.length}): ${missing.join(', ')}`);
      console.warn(`Available source TLAs (first 30):`,
        uniqueRows.slice(0, 30).map(r => `${r.tla}@${r.rank}`).join(' '));
    }
    
    // Write output
    const outPath = path.join(__dirname, 'fifa_data.json');
    const output = {
      lastUpdated: new Date().toISOString().slice(0, 10),
      source: 'football-ranking.com',
      sourceUrl: PAGES_TO_FETCH[0],
      teams: fifaByCode,
      metadata: {
        fetchedAt: new Date().toISOString(),
        totalRowsScraped: allRows.length,
        uniqueTlas: uniqueRows.length,
        wcTeamsMatched: matchedCount,
        wcTeamsMissing: missing
      }
    };
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
    console.log(`Wrote ${outPath}`);
    
    // Sample
    console.log(`\n=== Sample data (top 10 by FIFA rank) ===`);
    const sorted = Object.entries(fifaByCode).sort((a, b) => a[1].rank - b[1].rank);
    for (let i = 0; i < Math.min(10, sorted.length); i++) {
      const [code, data] = sorted[i];
      console.log(`  #${data.rank} ${code}: ${data.points} pts`);
    }
    
    if (missing.length > 0) {
      console.error(`\nFAILED: ${missing.length} WC teams missing!`);
      process.exit(1);
    }
  } finally {
    await browser.close();
    console.log('Browser closed');
  }
}

// Retry wrapper (same pattern as fetch_elo.js)
async function withRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      const isLast = (i === maxRetries - 1);
      console.warn(`Attempt ${i+1}/${maxRetries} failed: ${err.message}`);
      if (isLast) throw err;
      const backoffMs = 10000 * (i + 1);
      console.log(`Retrying in ${backoffMs/1000}s...`);
      await new Promise(r => setTimeout(r, backoffMs));
    }
  }
}

withRetry(main).catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
