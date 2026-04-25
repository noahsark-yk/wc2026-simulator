// scripts/fetch_matches.js
//
// Scrapes match history for all 48 World Cup 2026 teams from eloratings.net.
//
// KEY FINDINGS from debug:
//   - Each .slick-row has 8 .slick-cell elements
//   - Inside each cell, two values are separated by <br>:
//       cell[0]: "Mon DD<br>YYYY"      -> date
//       cell[1]: "<a>TeamA</a><br>TeamB"  -> match teams
//       cell[2]: "scoreA<br>scoreB"    -> scores
//       cell[3]: "Tournament<br><a>in Location</a>"
//       cells[4..7]: rating delta, rating after, rank delta, rank after (ignored)
//   - Rows are SORTED OLDEST-FIRST. The most recent matches have the
//     LARGEST `style.top` value. We sort by top descending to get newest-first.
//   - All 835 rows are present in the DOM at load time (no virtualization).
//
// Usage: node scripts/fetch_matches.js
//        node scripts/fetch_matches.js --test  (Japan only, fast sanity check)

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Map our team codes to the URL slug eloratings.net uses
const TEAM_CODE_TO_URL = {
  // UEFA
  'ESP': 'Spain', 'FRA': 'France', 'ENG': 'England', 'POR': 'Portugal',
  'NED': 'Netherlands', 'GER': 'Germany', 'CRO': 'Croatia', 'SUI': 'Switzerland',
  'BEL': 'Belgium', 'AUT': 'Austria', 'CZE': 'Czech-Republic', 'NOR': 'Norway',
  'BIH': 'Bosnia-and-Herzegovina', 'SCO': 'Scotland', 'TUR': 'Turkey', 'SWE': 'Sweden',
  // CONMEBOL
  'ARG': 'Argentina', 'BRA': 'Brazil', 'COL': 'Colombia', 'URU': 'Uruguay',
  'ECU': 'Ecuador', 'PAR': 'Paraguay',
  // CONCACAF
  'USA': 'United-States', 'CAN': 'Canada', 'MEX': 'Mexico', 'PAN': 'Panama',
  'CUW': 'Curacao', 'HAI': 'Haiti',
  // AFC
  'JPN': 'Japan', 'KOR': 'South-Korea', 'IRN': 'Iran', 'KSA': 'Saudi-Arabia',
  'AUS': 'Australia', 'UZB': 'Uzbekistan', 'JOR': 'Jordan', 'IRQ': 'Iraq',
  'QAT': 'Qatar',
  // CAF
  'MAR': 'Morocco', 'SEN': 'Senegal', 'TUN': 'Tunisia', 'EGY': 'Egypt',
  'ALG': 'Algeria', 'CIV': 'Cote-dIvoire', 'GHA': 'Ghana', 'CPV': 'Cape-Verde',
  'RSA': 'South-Africa', 'COD': 'DR-Congo',
  // OFC
  'NZL': 'New-Zealand'
};

// Fallback URL slugs for countries with naming variations
const URL_FALLBACKS = {
  'CZE': ['Czech-Republic', 'Czechia'],
  'BIH': ['Bosnia-and-Herzegovina', 'Bosnia'],
  'USA': ['United-States', 'USA'],
  'KOR': ['South-Korea', 'Korea-Republic'],
  'KSA': ['Saudi-Arabia'],
  'CIV': ['Cote-dIvoire', 'Ivory-Coast'],
  'CPV': ['Cape-Verde'],
  'RSA': ['South-Africa'],
  'COD': ['DR-Congo', 'Congo-DR'],
  'NZL': ['New-Zealand'],
  'CUW': ['Curacao'],
  'TUR': ['Turkey']
};

// Display name as it appears in eloratings.net match rows
const TEAM_CODE_TO_DISPLAY_NAME = {
  'ESP': 'Spain', 'FRA': 'France', 'ENG': 'England', 'POR': 'Portugal',
  'NED': 'Netherlands', 'GER': 'Germany', 'CRO': 'Croatia', 'SUI': 'Switzerland',
  'BEL': 'Belgium', 'AUT': 'Austria', 'CZE': 'Czechia', 'NOR': 'Norway',
  'BIH': 'Bosnia and Herzegovina', 'SCO': 'Scotland', 'TUR': 'Turkey', 'SWE': 'Sweden',
  'ARG': 'Argentina', 'BRA': 'Brazil', 'COL': 'Colombia', 'URU': 'Uruguay',
  'ECU': 'Ecuador', 'PAR': 'Paraguay',
  'USA': 'United States', 'CAN': 'Canada', 'MEX': 'Mexico', 'PAN': 'Panama',
  'CUW': 'Curacao', 'HAI': 'Haiti',
  'JPN': 'Japan', 'KOR': 'South Korea', 'IRN': 'Iran', 'KSA': 'Saudi Arabia',
  'AUS': 'Australia', 'UZB': 'Uzbekistan', 'JOR': 'Jordan', 'IRQ': 'Iraq',
  'QAT': 'Qatar',
  'MAR': 'Morocco', 'SEN': 'Senegal', 'TUN': 'Tunisia', 'EGY': 'Egypt',
  'ALG': 'Algeria', 'CIV': "Cote d'Ivoire", 'GHA': 'Ghana', 'CPV': 'Cape Verde',
  'RSA': 'South Africa', 'COD': 'DR Congo',
  'NZL': 'New Zealand'
};

const MIN_YEAR = 2020;
const PER_PAGE_WAIT = 4000;
const BETWEEN_TEAMS_DELAY = 2000;

const MONTH_TO_NUM = {
  jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12
};

function stripHtml(s) {
  return String(s).replace(/<[^>]+>/g, '').trim();
}

async function tryNavigate(page, code) {
  const candidates = URL_FALLBACKS[code] || [TEAM_CODE_TO_URL[code]];
  for (const slug of candidates) {
    const url = 'https://www.eloratings.net/' + slug;
    try {
      const res = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      if (res.status() === 200) {
        await new Promise(r => setTimeout(r, PER_PAGE_WAIT));
        const ok = await page.evaluate(() => {
          const h1 = document.querySelector('h1');
          return h1 && h1.textContent.includes(':');
        });
        if (ok) return { ok: true, url, slug };
      }
    } catch (err) {
      // try next
    }
  }
  return { ok: false };
}

async function extractRows(page) {
  return await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.slick-row'));
    return rows.map(row => {
      const top = parseInt(row.style.top || '0');
      const cells = row.querySelectorAll('.slick-cell');
      const cellsHtml = Array.from(cells).map(c => c.innerHTML);
      return { top, cellsHtml };
    });
  });
}

function parseRow(row, ourCountryName) {
  const cellsHtml = row.cellsHtml;
  if (!cellsHtml || cellsHtml.length < 3) return null;
  
  // Cell 0: "Mon DD<br>YYYY"
  const dateParts = cellsHtml[0].split(/<br\s*\/?>/i).map(stripHtml);
  if (dateParts.length < 2) return null;
  const dateMatch = dateParts[0].match(/^([A-Za-z]{3})\s+(\d{1,2})$/);
  if (!dateMatch) return null;
  const monthIdx = MONTH_TO_NUM[dateMatch[1].toLowerCase()];
  const day = parseInt(dateMatch[2]);
  const year = parseInt(dateParts[1]);
  if (!monthIdx || !day || !year || year < 1900 || year > 2100) return null;
  
  // Cell 1: teams
  const teamParts = cellsHtml[1].split(/<br\s*\/?>/i).map(stripHtml);
  if (teamParts.length < 2) return null;
  const teamA = teamParts[0];
  const teamB = teamParts[1];
  if (!teamA || !teamB) return null;
  
  // Cell 2: scores
  const scoreParts = cellsHtml[2].split(/<br\s*\/?>/i).map(stripHtml);
  if (scoreParts.length < 2) return null;
  const scoreA = parseInt(scoreParts[0]);
  const scoreB = parseInt(scoreParts[1]);
  if (Number.isNaN(scoreA) || Number.isNaN(scoreB)) return null;
  
  // One of teams must match our country
  const cn = ourCountryName.toLowerCase();
  const aMatch = teamA.toLowerCase() === cn;
  const bMatch = teamB.toLowerCase() === cn;
  if (!aMatch && !bMatch) return null;
  
  const isHome = aMatch;
  const opponentName = isHome ? teamB : teamA;
  const ourScore = isHome ? scoreA : scoreB;
  const oppScore = isHome ? scoreB : scoreA;
  
  let tournament = '';
  if (cellsHtml.length > 3) {
    const tParts = cellsHtml[3].split(/<br\s*\/?>/i).map(stripHtml);
    tournament = tParts[0] || '';
  }
  
  const mm = String(monthIdx).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const date = `${year}-${mm}-${dd}`;
  
  return {
    date,
    isHome,
    opponentName,
    ourScore,
    oppScore,
    tournament
  };
}

async function scrapeOneCountry(page, code) {
  const ourCountryName = TEAM_CODE_TO_DISPLAY_NAME[code];
  console.log(`\n--- ${code} (${ourCountryName}) ---`);
  
  const navResult = await tryNavigate(page, code);
  if (!navResult.ok) {
    console.warn(`  ! Could not load page for ${code}`);
    return { code, ok: false, error: 'navigation failed' };
  }
  console.log(`  loaded: ${navResult.url}`);
  
  const rawRows = await extractRows(page);
  console.log(`  ${rawRows.length} raw rows`);
  
  // Sort by top DESC (largest top = newest)
  rawRows.sort((a, b) => b.top - a.top);
  
  const matches = [];
  let parseFailures = 0;
  for (const row of rawRows) {
    const m = parseRow(row, ourCountryName);
    if (!m) {
      parseFailures++;
      continue;
    }
    if (parseInt(m.date.slice(0, 4)) < MIN_YEAR) continue;
    matches.push(m);
  }
  
  console.log(`  ${matches.length} matches since ${MIN_YEAR} (parse fails: ${parseFailures})`);
  if (matches.length > 0) {
    const m = matches[0];
    console.log(`  most recent: ${m.date} ${m.isHome ? ourCountryName + ' vs ' + m.opponentName : m.opponentName + ' vs ' + ourCountryName} (${m.ourScore}-${m.oppScore})`);
  }
  
  return { code, ok: true, matches, sourceUrl: navResult.url };
}

async function main() {
  const isTest = process.argv.includes('--test');
  
  console.log('Loading current Elo data from elo_data.json...');
  const eloPath = path.join(__dirname, 'elo_data.json');
  if (!fs.existsSync(eloPath)) {
    console.error('elo_data.json not found! Run fetch_elo.js first.');
    process.exit(1);
  }
  
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const codes = isTest ? ['JPN'] : Object.keys(TEAM_CODE_TO_URL);
  console.log(`Will scrape ${codes.length} teams${isTest ? ' (TEST MODE)' : ''}`);
  
  const results = {};
  let success = 0, failed = 0;
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    
    for (let i = 0; i < codes.length; i++) {
      const code = codes[i];
      console.log(`\n[${i+1}/${codes.length}]`);
      
      try {
        const result = await scrapeOneCountry(page, code);
        results[code] = result;
        if (result.ok) success++; else failed++;
      } catch (err) {
        console.error(`  ERROR for ${code}: ${err.message}`);
        results[code] = { code, ok: false, error: err.message };
        failed++;
      }
      
      if ((i + 1) % 5 === 0 || i === codes.length - 1) {
        const outPath = path.join(__dirname, 'match_data.json');
        fs.writeFileSync(outPath, JSON.stringify({
          fetchedAt: new Date().toISOString(),
          source: 'eloratings.net',
          completedSoFar: i + 1,
          totalCountries: codes.length,
          results
        }, null, 2));
        console.log(`  [intermediate save: ${i+1}/${codes.length}]`);
      }
      
      if (i < codes.length - 1) {
        await new Promise(r => setTimeout(r, BETWEEN_TEAMS_DELAY));
      }
    }
  } finally {
    await browser.close();
    console.log('\nBrowser closed');
  }
  
  console.log(`\n========== DONE ==========`);
  console.log(`Success: ${success}/${codes.length}`);
  console.log(`Failed: ${failed}/${codes.length}`);
  
  let totalMatches = 0;
  for (const [code, r] of Object.entries(results)) {
    if (r.ok && r.matches) {
      totalMatches += r.matches.length;
      console.log(`  ${code}: ${r.matches.length} matches`);
    } else {
      console.log(`  ${code}: FAILED (${r.error || 'unknown'})`);
    }
  }
  console.log(`Total matches collected: ${totalMatches}`);
  console.log(`\nOutput: scripts/match_data.json`);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
