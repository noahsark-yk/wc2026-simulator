// scripts/fetch_matches.js
//
// Scrapes match history for all 48 World Cup 2026 teams from eloratings.net.
// This is the unified version with all URL fallbacks and display-name fixes
// integrated, so it works for all 48 teams in a single run.
//
// Discoveries baked in:
//   - eloratings.net uses UNDERSCORE-separated URL slugs (e.g. /South_Korea)
//   - Each .slick-row has 8 .slick-cell with values separated by <br>
//   - Rows are sorted oldest-first (top=0); newest matches have largest top
//   - All 835 rows present in DOM at load (no virtualization)
//   - Some teams have a different display-name on their match rows than their
//     URL slug (e.g. "Cote d'Ivoire" URL but "Ivory Coast" in row text;
//     "Curacao" URL but "Curaçao" in row text)
//
// Usage:
//   node scripts/fetch_matches.js
//   node scripts/fetch_matches.js --test  (Japan only, fast sanity check)

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Map team code -> { url: URL slug, display: display-name in match rows }
// "url" is what eloratings.net uses in /CountryName paths.
// "display" is the EXACT text that appears in the slick-cell when this country is one
// of the two teams in a match row. This must match exactly for parsing to work.
const TEAM_INFO = {
  // UEFA
  'ESP': { url: 'Spain',                   display: 'Spain' },
  'FRA': { url: 'France',                  display: 'France' },
  'ENG': { url: 'England',                 display: 'England' },
  'POR': { url: 'Portugal',                display: 'Portugal' },
  'NED': { url: 'Netherlands',             display: 'Netherlands' },
  'GER': { url: 'Germany',                 display: 'Germany' },
  'CRO': { url: 'Croatia',                 display: 'Croatia' },
  'SUI': { url: 'Switzerland',             display: 'Switzerland' },
  'BEL': { url: 'Belgium',                 display: 'Belgium' },
  'AUT': { url: 'Austria',                 display: 'Austria' },
  'CZE': { url: 'Czechia',                 display: 'Czechia' },
  'NOR': { url: 'Norway',                  display: 'Norway' },
  'BIH': { url: 'Bosnia_and_Herzegovina',  display: 'Bosnia and Herzegovina' },
  'SCO': { url: 'Scotland',                display: 'Scotland' },
  'TUR': { url: 'Turkey',                  display: 'Turkey' },
  'SWE': { url: 'Sweden',                  display: 'Sweden' },
  // CONMEBOL
  'ARG': { url: 'Argentina',               display: 'Argentina' },
  'BRA': { url: 'Brazil',                  display: 'Brazil' },
  'COL': { url: 'Colombia',                display: 'Colombia' },
  'URU': { url: 'Uruguay',                 display: 'Uruguay' },
  'ECU': { url: 'Ecuador',                 display: 'Ecuador' },
  'PAR': { url: 'Paraguay',                display: 'Paraguay' },
  // CONCACAF
  'USA': { url: 'United_States',           display: 'United States' },
  'CAN': { url: 'Canada',                  display: 'Canada' },
  'MEX': { url: 'Mexico',                  display: 'Mexico' },
  'PAN': { url: 'Panama',                  display: 'Panama' },
  'CUW': { url: 'Curacao',                 display: 'Curaçao' },     // Note cedilla
  'HAI': { url: 'Haiti',                   display: 'Haiti' },
  // AFC
  'JPN': { url: 'Japan',                   display: 'Japan' },
  'KOR': { url: 'South_Korea',             display: 'South Korea' },
  'IRN': { url: 'Iran',                    display: 'Iran' },
  'KSA': { url: 'Saudi_Arabia',            display: 'Saudi Arabia' },
  'AUS': { url: 'Australia',               display: 'Australia' },
  'UZB': { url: 'Uzbekistan',              display: 'Uzbekistan' },
  'JOR': { url: 'Jordan',                  display: 'Jordan' },
  'IRQ': { url: 'Iraq',                    display: 'Iraq' },
  'QAT': { url: 'Qatar',                   display: 'Qatar' },
  // CAF
  'MAR': { url: 'Morocco',                 display: 'Morocco' },
  'SEN': { url: 'Senegal',                 display: 'Senegal' },
  'TUN': { url: 'Tunisia',                 display: 'Tunisia' },
  'EGY': { url: 'Egypt',                   display: 'Egypt' },
  'ALG': { url: 'Algeria',                 display: 'Algeria' },
  'CIV': { url: 'Ivory_Coast',             display: 'Ivory Coast' },  // Note: not Cote d'Ivoire
  'GHA': { url: 'Ghana',                   display: 'Ghana' },
  'CPV': { url: 'Cape_Verde',              display: 'Cape Verde' },
  'RSA': { url: 'South_Africa',            display: 'South Africa' },
  'COD': { url: 'DR_Congo',                display: 'DR Congo' },
  // OFC
  'NZL': { url: 'New_Zealand',             display: 'New Zealand' }
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

async function navigate(page, slug) {
  const url = 'https://www.eloratings.net/' + slug;
  try {
    const res = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    if (res.status() !== 200) return { ok: false };
    await new Promise(r => setTimeout(r, PER_PAGE_WAIT));
    const ok = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      return h1 && h1.textContent.includes(':');
    });
    return ok ? { ok: true, url } : { ok: false };
  } catch (err) {
    return { ok: false, error: err.message };
  }
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
  
  const dateParts = cellsHtml[0].split(/<br\s*\/?>/i).map(stripHtml);
  if (dateParts.length < 2) return null;
  const dateMatch = dateParts[0].match(/^([A-Za-z]{3})\s+(\d{1,2})$/);
  if (!dateMatch) return null;
  const monthIdx = MONTH_TO_NUM[dateMatch[1].toLowerCase()];
  const day = parseInt(dateMatch[2]);
  const year = parseInt(dateParts[1]);
  if (!monthIdx || !day || !year || year < 1900 || year > 2100) return null;
  
  const teamParts = cellsHtml[1].split(/<br\s*\/?>/i).map(stripHtml);
  if (teamParts.length < 2) return null;
  const teamA = teamParts[0];
  const teamB = teamParts[1];
  if (!teamA || !teamB) return null;
  
  const scoreParts = cellsHtml[2].split(/<br\s*\/?>/i).map(stripHtml);
  if (scoreParts.length < 2) return null;
  const scoreA = parseInt(scoreParts[0]);
  const scoreB = parseInt(scoreParts[1]);
  if (Number.isNaN(scoreA) || Number.isNaN(scoreB)) return null;
  
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
  
  return { date, isHome, opponentName, ourScore, oppScore, tournament };
}

async function scrapeOneCountry(page, code) {
  const info = TEAM_INFO[code];
  if (!info) {
    console.warn(`  ! No TEAM_INFO entry for ${code}`);
    return { code, ok: false, error: 'no team info' };
  }
  
  console.log(`\n--- ${code} (${info.display}) ---`);
  const navResult = await navigate(page, info.url);
  if (!navResult.ok) {
    console.warn(`  ! Could not load /${info.url}`);
    return { code, ok: false, error: 'navigation failed' };
  }
  console.log(`  loaded: ${navResult.url}`);
  
  const rawRows = await extractRows(page);
  console.log(`  ${rawRows.length} raw rows`);
  rawRows.sort((a, b) => b.top - a.top);  // newest first
  
  const matches = [];
  let parseFailures = 0;
  for (const row of rawRows) {
    const m = parseRow(row, info.display);
    if (!m) { parseFailures++; continue; }
    if (parseInt(m.date.slice(0, 4)) < MIN_YEAR) continue;
    matches.push(m);
  }
  
  console.log(`  ${matches.length} matches since ${MIN_YEAR} (parse fails: ${parseFailures})`);
  if (matches.length > 0) {
    const m = matches[0];
    console.log(`  most recent: ${m.date} ${m.isHome ? info.display + ' vs ' + m.opponentName : m.opponentName + ' vs ' + info.display} (${m.ourScore}-${m.oppScore})`);
  }
  
  return { code, ok: true, matches, sourceUrl: navResult.url };
}

async function main() {
  const isTest = process.argv.includes('--test');
  
  console.log('Verifying elo_data.json exists...');
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
  
  const codes = isTest ? ['JPN'] : Object.keys(TEAM_INFO);
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
      
      // Save intermediate every 5 teams
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
    } else {
      console.log(`  ${code}: FAILED (${r.error || 'unknown'})`);
    }
  }
  console.log(`Total matches: ${totalMatches}`);
  
  // Exit with non-zero if any failed (for CI)
  if (failed > 0) {
    console.error('\n⚠️  Some teams failed. Check the log above.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
