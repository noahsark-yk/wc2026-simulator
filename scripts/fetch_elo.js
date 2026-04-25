// scripts/fetch_elo.js
//
// Fetches current Elo ratings for the 48 World Cup 2026 teams from eloratings.net
// using Puppeteer. Outputs results to scripts/elo_data.json
//
// Usage: node scripts/fetch_elo.js
//
// Note: eloratings.net is a single-page app. We load it, wait for the data to
// render, then extract the rankings table.

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Mapping from our team codes to the country names used on eloratings.net
// (some are Three-letter codes mapped to display names)
const TEAM_CODE_TO_NAME = {
  // UEFA
  'ESP': 'Spain', 'FRA': 'France', 'ENG': 'England', 'POR': 'Portugal',
  'NED': 'Netherlands', 'GER': 'Germany', 'CRO': 'Croatia', 'SUI': 'Switzerland',
  'BEL': 'Belgium', 'AUT': 'Austria', 'CZE': 'Czech Republic', 'NOR': 'Norway',
  'BIH': 'Bosnia and Herzegovina', 'SCO': 'Scotland', 'TUR': 'Turkey', 'SWE': 'Sweden',
  // CONMEBOL
  'ARG': 'Argentina', 'BRA': 'Brazil', 'COL': 'Colombia', 'URU': 'Uruguay',
  'ECU': 'Ecuador', 'PAR': 'Paraguay',
  // CONCACAF
  'USA': 'United States', 'CAN': 'Canada', 'MEX': 'Mexico', 'PAN': 'Panama',
  'CUW': 'Curacao', 'HAI': 'Haiti',
  // AFC
  'JPN': 'Japan', 'KOR': 'South Korea', 'IRN': 'Iran', 'KSA': 'Saudi Arabia',
  'AUS': 'Australia', 'UZB': 'Uzbekistan', 'JOR': 'Jordan', 'IRQ': 'Iraq',
  'QAT': 'Qatar',
  // CAF
  'MAR': 'Morocco', 'SEN': 'Senegal', 'TUN': 'Tunisia', 'EGY': 'Egypt',
  'ALG': 'Algeria', 'CIV': "Cote d'Ivoire", 'GHA': 'Ghana', 'CPV': 'Cape Verde',
  'RSA': 'South Africa', 'COD': 'DR Congo',
  // OFC
  'NZL': 'New Zealand'
};

// Reverse: from name to code (for lookups after we extract data)
const NAME_TO_CODE = {};
for (const [code, name] of Object.entries(TEAM_CODE_TO_NAME)) {
  NAME_TO_CODE[name.toLowerCase()] = code;
}

// Some countries may appear with variant names on eloratings.net
const NAME_ALIASES = {
  'czechia': 'CZE',
  'czech rep.': 'CZE',
  'usa': 'USA',
  'us': 'USA',
  'united states of america': 'USA',
  'south korea': 'KOR',
  'korea republic': 'KOR',
  'cote divoire': 'CIV',
  "cote d'ivoire": 'CIV',
  "côte d'ivoire": 'CIV',
  'ivory coast': 'CIV',
  'congo dr': 'COD',
  'dr congo': 'COD',
  'democratic republic of the congo': 'COD',
  'türkiye': 'TUR',
  'turkiye': 'TUR',
  'curaçao': 'CUW',
  'cape verde islands': 'CPV',
  'bosnia & herzegovina': 'BIH',
  'bosnia': 'BIH',
  'bosnia-herzegovina': 'BIH',
  'bosnia herzegovina': 'BIH',
  'bosnia and hercegovina': 'BIH',
  'bosnia-hercegovina': 'BIH'
};

// Partial-match fallback for stubborn cases (substring match)
const PARTIAL_MATCHES = [
  { needle: 'bosnia', code: 'BIH' },
  { needle: 'herzegovina', code: 'BIH' },
  { needle: 'cape verde', code: 'CPV' },
  { needle: 'south korea', code: 'KOR' },
  { needle: 'ivory coast', code: 'CIV' },
  { needle: "côte", code: 'CIV' },
  { needle: 'curaçao', code: 'CUW' },
  { needle: 'curacao', code: 'CUW' }
];

function normalizeNameToCode(name) {
  if (!name) return null;
  const norm = name.toLowerCase().trim();
  // Direct match
  if (NAME_TO_CODE[norm]) return NAME_TO_CODE[norm];
  // Alias match
  if (NAME_ALIASES[norm]) return NAME_ALIASES[norm];
  // Partial match (substring) — for stubborn cases
  for (const pm of PARTIAL_MATCHES) {
    if (norm.includes(pm.needle)) return pm.code;
  }
  return null;
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

    console.log('Loading eloratings.net...');
    await page.goto('https://www.eloratings.net/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // The site uses SlickGrid. Wait for the data rows to render.
    console.log('Waiting for rankings table to render...');
    await page.waitForSelector('.slick-row', { timeout: 30000 });
    // Give it a moment to fully populate
    await new Promise(r => setTimeout(r, 2000));

    console.log('Extracting Elo data from page...');
    // Extract rows: each row has a country name and Elo rating
    const rows = await page.evaluate(() => {
      const out = [];
      // Try multiple selector strategies since SlickGrid markup can vary
      const slickRows = document.querySelectorAll('.slick-row');
      slickRows.forEach((row) => {
        const cells = row.querySelectorAll('.slick-cell');
        if (cells.length >= 3) {
          // Typical eloratings.net columns: rank, country, rating, ...
          const texts = Array.from(cells).map(c => c.textContent.trim());
          out.push(texts);
        }
      });
      return out;
    });

    console.log(`Extracted ${rows.length} rows from rankings table`);
    if (rows.length === 0) {
      throw new Error('No rows extracted - selector may have changed');
    }

    // Try to parse rows: first numeric column ≥ 1000 and ≤ 2500 is the Elo rating
    // Country name is the first non-numeric, non-empty cell
    const teamElos = {};
    const unmatchedNames = [];  // For debug
    let parsed = 0;
    for (const cells of rows) {
      let countryName = null;
      let elo = null;
      for (const cell of cells) {
        const trimmed = cell.replace(/[\u200b\s]/g, ' ').trim();
        if (!trimmed) continue;
        // Try parsing as Elo
        const num = parseFloat(trimmed.replace(/,/g, ''));
        if (!Number.isNaN(num) && num >= 1000 && num <= 2500 && elo === null) {
          elo = Math.round(num);
        } else if (!countryName && /[a-zA-Z]/.test(trimmed) && trimmed.length > 1) {
          countryName = trimmed;
        }
      }
      if (countryName && elo !== null) {
        const code = normalizeNameToCode(countryName);
        if (code && !teamElos[code]) {
          teamElos[code] = { name: countryName, elo };
          parsed++;
        } else if (!code) {
          // Save unmatched for debug — only those that look like full country names
          if (countryName.length >= 3 && countryName.length <= 40) {
            unmatchedNames.push(`${countryName} (${elo})`);
          }
        }
      }
    }

    console.log(`Successfully matched ${parsed} of 48 World Cup teams`);

    // Report missing teams
    const missing = Object.keys(TEAM_CODE_TO_NAME).filter(c => !teamElos[c]);
    if (missing.length > 0) {
      console.warn('Missing teams:', missing.join(', '));
      console.warn('You may need to add aliases or check eloratings.net for these names');
      // Show a sample of unmatched country-like names from the page (top 20)
      if (unmatchedNames.length > 0) {
        console.warn('\nUnmatched country-like names found on page (showing first 20):');
        unmatchedNames.slice(0, 20).forEach(n => console.warn('  - ' + n));
      }
    }

    // Save to JSON
    const outPath = path.join(__dirname, 'elo_data.json');
    const output = {
      fetchedAt: new Date().toISOString(),
      source: 'eloratings.net',
      matched: parsed,
      total: 48,
      missing,
      teams: teamElos
    };
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
    console.log(`Wrote ${outPath}`);

    // Print summary
    console.log('\n=== Sample data (first 10) ===');
    let i = 0;
    for (const [code, data] of Object.entries(teamElos)) {
      console.log(`  ${code} (${data.name}): ${data.elo}`);
      if (++i >= 10) break;
    }
  } finally {
    await browser.close();
    console.log('Browser closed');
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
