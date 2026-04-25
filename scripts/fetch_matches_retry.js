// scripts/fetch_matches_retry.js
//
// Retry script: re-runs only the 9 countries that failed in the main fetch
// because eloratings.net uses UNDERSCORE separators in URLs, not hyphens.
//
// Reads existing scripts/match_data.json, replaces the 9 failed entries with
// freshly-fetched data, and writes back.
//
// Usage: node scripts/fetch_matches_retry.js

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Failed countries with their CORRECT (underscore-separated) URL slugs
const RETRY_TARGETS = {
  'BIH': ['Bosnia_and_Herzegovina'],
  'USA': ['United_States'],
  'KOR': ['South_Korea'],
  'KSA': ['Saudi_Arabia'],
  'CIV': ["Cote_d'Ivoire", 'Cote_dIvoire', 'Ivory_Coast'],
  'CPV': ['Cape_Verde'],
  'RSA': ['South_Africa'],
  'COD': ['DR_Congo', 'Congo_DR'],
  'NZL': ['New_Zealand']
};

const TEAM_CODE_TO_DISPLAY_NAME = {
  'BIH': 'Bosnia and Herzegovina',
  'USA': 'United States',
  'KOR': 'South Korea',
  'KSA': 'Saudi Arabia',
  'CIV': "Cote d'Ivoire",
  'CPV': 'Cape Verde',
  'RSA': 'South Africa',
  'COD': 'DR Congo',
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
  const candidates = RETRY_TARGETS[code];
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
  rawRows.sort((a, b) => b.top - a.top);
  
  const matches = [];
  let parseFailures = 0;
  for (const row of rawRows) {
    const m = parseRow(row, ourCountryName);
    if (!m) { parseFailures++; continue; }
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
  const dataPath = path.join(__dirname, 'match_data.json');
  if (!fs.existsSync(dataPath)) {
    console.error('match_data.json not found! Run fetch_matches.js first.');
    process.exit(1);
  }
  const existing = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  console.log(`Loaded existing data with ${Object.keys(existing.results).length} entries`);
  
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const codes = Object.keys(RETRY_TARGETS);
  console.log(`Retrying ${codes.length} failed countries...`);
  
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
        existing.results[code] = result;
        if (result.ok) success++; else failed++;
      } catch (err) {
        console.error(`  ERROR for ${code}: ${err.message}`);
        existing.results[code] = { code, ok: false, error: err.message };
        failed++;
      }
      
      // Save after every retry
      existing.fetchedAt = new Date().toISOString();
      fs.writeFileSync(dataPath, JSON.stringify(existing, null, 2));
      
      if (i < codes.length - 1) {
        await new Promise(r => setTimeout(r, BETWEEN_TEAMS_DELAY));
      }
    }
  } finally {
    await browser.close();
    console.log('\nBrowser closed');
  }
  
  console.log(`\n========== RETRY DONE ==========`);
  console.log(`Recovered: ${success}/${codes.length}`);
  console.log(`Still failing: ${failed}/${codes.length}`);
  
  // Final summary across all 48
  let totalOk = 0, totalMatches = 0;
  for (const [code, r] of Object.entries(existing.results)) {
    if (r.ok) {
      totalOk++;
      totalMatches += (r.matches || []).length;
    }
  }
  console.log(`\nTotal: ${totalOk}/48 countries OK, ${totalMatches} total matches`);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
