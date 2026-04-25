// scripts/fetch_fifa_rank_v2.js
//
// Fetches FIFA "live" rankings — i.e., the points displayed on FIFA's
// official world-ranking page that include match-window adjustments
// since the last official Ranking Day.
//
// Pipeline:
//   1. Open inside.fifa.com once with Puppeteer to harvest the current
//      ranking schedule ID (e.g. "FRS_Male_Football_20260119").
//   2. Hit api.fifa.com/.../rankingsbyschedule to get the 211-team
//      confirmed table (lastUpdateDate + TotalPoints per country).
//   3. Hit inside.fifa.com/api/live-world-ranking/get-match-window-matches
//      to get every team's MatchesList, including TeamA/TeamBPointsBefore
//      and TeamA/TeamBPoints (post-match values).
//   4. For each country, take the most recent match's post-match points;
//      that's the live points value the FIFA site shows. Fallback to
//      confirmed TotalPoints if the country played no match in the window.
//   5. Re-sort by live points -> live rank.
//   6. Filter to the 48 World Cup teams and write fifa_data.json in the
//      format build_teams.js v5 expects (TLA -> { rank, points }).
//
// Backwards-compatible: same output schema as the old football-ranking.com
// scraper. Source field changes to identify the new origin.
//
// Usage: node scripts/fetch_fifa_rank.js (replaces the old script)

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// ---- helpers ----
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function withRetry(fn, label, attempts = 3, baseDelayMs = 2000) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try { return await fn(); }
    catch (err) {
      lastErr = err;
      console.warn(`  ! ${label}: attempt ${i}/${attempts} failed: ${err.message}`);
      if (i < attempts) await sleep(baseDelayMs * i);
    }
  }
  throw new Error(`${label}: all ${attempts} attempts failed: ${lastErr?.message}`);
}

// 48 WC2026 teams (TLA = FIFA's IdCountry code)
const WC2026_TEAMS = [
  'MEX','CAN','USA','BRA','ARG','URU','COL','ECU','PAR',
  'JPN','KOR','IRN','KSA','AUS','UZB','JOR','IRQ','QAT',
  'ESP','FRA','ENG','POR','NED','GER','CRO','SUI','BEL','AUT',
  'CZE','NOR','BIH','SCO','TUR','SWE',
  'MAR','SEN','TUN','EGY','ALG','CIV','GHA','CPV','RSA','COD',
  'NZL','HAI','PAN','CUW'
];

(async () => {
  const startTime = Date.now();
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: true });

  let scheduleId, confirmed, matchWindow;
  try {
    // === Step 1: harvest schedule ID from inside.fifa.com ===
    console.log('\n[1/3] Fetching current ranking schedule ID...');
    scheduleId = await withRetry(async () => {
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36');
      await page.goto('https://inside.fifa.com/fifa-world-ranking/men', {
        waitUntil: 'networkidle2', timeout: 90000
      });
      const id = await page.evaluate(() => {
        const next = document.getElementById('__NEXT_DATA__');
        if (!next) return null;
        try {
          const j = JSON.parse(next.textContent);
          // pageData.ranking.dates[0].dates[0].id is the most recent schedule ID
          const dates = j.props?.pageProps?.pageData?.ranking?.dates;
          if (!dates) return null;
          for (const yearBlock of dates) {
            if (yearBlock.dates && yearBlock.dates.length) return yearBlock.dates[0].id;
          }
          return null;
        } catch { return null; }
      });
      await page.close();
      if (!id) throw new Error('Could not extract schedule ID from __NEXT_DATA__');
      return id;
    }, 'harvest schedule ID');
    console.log(`  ✓ Schedule ID: ${scheduleId}`);

    // === Step 2: fetch confirmed 211-team ranking from api.fifa.com ===
    console.log('\n[2/3] Fetching confirmed ranking (api.fifa.com)...');
    confirmed = await withRetry(async () => {
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36');
      const url = `https://api.fifa.com/api/v3/fifarankings/rankings/rankingsbyschedule?rankingScheduleId=${scheduleId}&language=en`;
      const resp = await page.goto(url, { waitUntil: 'networkidle0', timeout: 90000 });
      const text = await resp.text();
      await page.close();
      const json = JSON.parse(text);
      if (!Array.isArray(json.Results)) throw new Error('Results is not an array');
      return json.Results;
    }, 'fetch confirmed ranking');
    console.log(`  ✓ Got ${confirmed.length} teams (confirmed)`);

    // === Step 3: fetch match-window matches with live deltas ===
    console.log('\n[3/3] Fetching live match-window data (inside.fifa.com)...');
    matchWindow = await withRetry(async () => {
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36');
      const url = 'https://inside.fifa.com/api/live-world-ranking/get-match-window-matches?locale=en&gender=1&rankingType=0';
      const resp = await page.goto(url, { waitUntil: 'networkidle0', timeout: 90000 });
      const text = await resp.text();
      await page.close();
      const json = JSON.parse(text);
      if (!json.matches || typeof json.matches !== 'object') throw new Error('matches missing');
      return json;
    }, 'fetch live match window');
    const teamIdsWithMatches = Object.keys(matchWindow.matches).length;
    console.log(`  ✓ Got match data for ${teamIdsWithMatches} teams (live)`);
  } finally {
    await browser.close();
  }

  // === Compute live points per country ===
  console.log('\nComputing live points...');
  // Build TLA -> confirmed entry, and IdTeam -> TLA
  const tla2confirmed = new Map();
  const teamId2tla = new Map();
  for (const r of confirmed) {
    if (r.IdCountry) {
      tla2confirmed.set(r.IdCountry, r);
      if (r.IdTeam) teamId2tla.set(String(r.IdTeam), r.IdCountry);
    }
  }

  function livePointsFor(tla) {
    const conf = tla2confirmed.get(tla);
    if (!conf) return null;
    const teamId = String(conf.IdTeam);
    const data = matchWindow.matches[teamId];
    if (!data || !Array.isArray(data.MatchesList) || data.MatchesList.length === 0) {
      return { points: conf.TotalPoints, source: 'confirmed-no-window-match' };
    }
    // Find most recent COMPLETED match. ResultType 1 typically means final score.
    const completed = data.MatchesList.filter(m => Number(m.HomeTeamScore) >= 0 && (m.MatchStatus === 0 || m.MatchStatus === 3 || m.Period === 10));
    const pool = completed.length ? completed : data.MatchesList;
    const sorted = [...pool].sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime());
    const latest = sorted[0];
    const isTeamA = String(latest.TeamAId) === teamId;
    const livePts = isTeamA ? latest.TeamAPoints : latest.TeamBPoints;
    if (typeof livePts !== 'number' || isNaN(livePts)) {
      return { points: conf.TotalPoints, source: 'fallback-non-numeric' };
    }
    return { points: livePts, source: 'live-from-latest-match' };
  }

  const liveByTla = new Map();
  for (const r of confirmed) {
    if (!r.IdCountry) continue;
    const liveInfo = livePointsFor(r.IdCountry);
    if (liveInfo) liveByTla.set(r.IdCountry, liveInfo);
  }

  // Re-rank by live points (descending)
  const ranked = [...liveByTla.entries()]
    .map(([tla, info]) => ({ tla, points: info.points, source: info.source }))
    .sort((a, b) => b.points - a.points);
  ranked.forEach((row, i) => row.liveRank = i + 1);

  // Filter to WC2026 teams
  const wcRows = ranked.filter(r => WC2026_TEAMS.includes(r.tla));
  const matched = new Set(wcRows.map(r => r.tla));
  const missing = WC2026_TEAMS.filter(t => !matched.has(t));

  console.log(`\nMatched ${wcRows.length}/48 World Cup teams`);
  if (missing.length) {
    console.warn(`Missing: ${missing.join(', ')}`);
  }

  // === Compose output ===
  const teams = {};
  for (const r of wcRows) {
    teams[r.tla] = { rank: r.liveRank, points: Math.round(r.points * 100) / 100 };
  }

  const today = new Date().toISOString().slice(0, 10);
  const out = {
    lastUpdated: today,
    source: 'inside.fifa.com (live)',
    sourceScheduleId: scheduleId,
    sourceConfirmedDate: confirmed[0]?.RankingDate || null,
    teamCount: wcRows.length,
    teams
  };

  const outPath = path.join(__dirname, 'fifa_data.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\nWrote ${outPath}`);

  // === Summary ===
  console.log('\n=== Sample (top 10 WC teams by live rank) ===');
  for (const r of wcRows.slice(0, 10)) {
    const conf = tla2confirmed.get(r.tla);
    const delta = (r.points - conf.TotalPoints).toFixed(2);
    console.log(`  #${r.liveRank} ${r.tla}: ${r.points.toFixed(2)} pts  (confirmed ${conf.TotalPoints.toFixed(2)}, delta ${delta >= 0 ? '+' : ''}${delta})  [${r.source}]`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nDone in ${elapsed}s`);
})();
