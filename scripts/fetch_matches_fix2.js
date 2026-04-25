// scripts/fetch_matches_fix2.js
//
// Fix script for the 2 countries that loaded their pages but failed to parse
// any matches because of display-name mismatches:
//   - CIV: page shows "Ivory Coast" but our code expected "Cote d'Ivoire"
//   - CUW: page shows "Curaçao" (with cedilla) but our code expected "Curacao"
//
// Usage: node scripts/fetch_matches_fix2.js

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const FIX_TARGETS = {
  'CIV': { url: 'Ivory_Coast', display: 'Ivory Coast' },
  'CUW': { url: 'Curacao', display: 'Curaçao' }
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

async function main() {
  const dataPath = path.join(__dirname, 'match_data.json');
  const existing = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  
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
    
    for (const [code, target] of Object.entries(FIX_TARGETS)) {
      console.log(`\n--- ${code} (${target.display}) ---`);
      const url = 'https://www.eloratings.net/' + target.url;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, PER_PAGE_WAIT));
      console.log(`  loaded: ${url}`);
      
      const rawRows = await extractRows(page);
      console.log(`  ${rawRows.length} raw rows`);
      rawRows.sort((a, b) => b.top - a.top);
      
      const matches = [];
      let parseFailures = 0;
      for (const row of rawRows) {
        const m = parseRow(row, target.display);
        if (!m) { parseFailures++; continue; }
        if (parseInt(m.date.slice(0, 4)) < MIN_YEAR) continue;
        matches.push(m);
      }
      
      console.log(`  ${matches.length} matches since ${MIN_YEAR} (parse fails: ${parseFailures})`);
      if (matches.length > 0) {
        const m = matches[0];
        console.log(`  most recent: ${m.date} ${m.isHome ? target.display + ' vs ' + m.opponentName : m.opponentName + ' vs ' + target.display} (${m.ourScore}-${m.oppScore})`);
      }
      
      existing.results[code] = { code, ok: true, matches, sourceUrl: url };
      
      await new Promise(r => setTimeout(r, BETWEEN_TEAMS_DELAY));
    }
    
    existing.fetchedAt = new Date().toISOString();
    fs.writeFileSync(dataPath, JSON.stringify(existing, null, 2));
    console.log('\nSaved updated match_data.json');
  } finally {
    await browser.close();
    console.log('Browser closed');
  }
  
  // Final summary
  let totalOk = 0, totalMatches = 0;
  for (const [code, r] of Object.entries(existing.results)) {
    if (r.ok && r.matches && r.matches.length > 0) {
      totalOk++;
      totalMatches += r.matches.length;
    }
  }
  console.log(`\nTotal: ${totalOk}/48 countries with matches, ${totalMatches} total matches`);
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
