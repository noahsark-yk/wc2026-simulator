// GS score-shape calibration probe for the rating-driven modes
// (elo / opta / fifa / power — 'power' inherits the same Elo machinery).
//
// Measures, per mode, 300 detailed tournaments (= 21,600 GS matches) on
// classic.html (no live result locks, pure engine) and compares against
// the real-World-Cup reference distribution (2018+2022 group stages,
// N=96). Matchup ('original') has its own ladder — see
// docs/2026-06-12_original-mode.md — and is NOT probed here.
//
// Denominators (keep in sync with the docs table):
//   draws, 1-0        -> ALL group matches
//   loser-0, margin-1 -> decided (non-draw) matches only
//   goals             -> mean per match
//   AET, PK           -> all KO matches
//
// Usage:
//   1. serve the repo root:  python -m http.server 8123
//   2. node scripts/calibrate_elo_family.js
//
// History: v2.9.9 hit 17/19 indicators within ±2pp, but later version
// bumps + daily data refreshes drifted the family (observed 2026-06-12:
// loser-0 ~68% vs target 56.2%). This script is the "where are we now"
// half of the recalibration loop; edit generateScoreNative / drawProb
// etc., re-run, repeat.

const puppeteer = require('puppeteer');

const MODES = ['elo', 'opta', 'fifa', 'power'];
const TOURNAMENTS = 300;
const REF = {  // real WC 2018+2022 GS (N=96) / KO
  draws: [20, 25], oneZero: 22.9, loserZero: 56.2, margin1: 45.8,
  goals: [2.2, 2.4], aet: [25, 30], pk: [16, 19]
};

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  page.setDefaultTimeout(600000);
  page.on('pageerror', e => console.error('PAGEERROR:', e.message));
  await page.goto('http://localhost:8123/classic.html', { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForFunction(() => typeof TEAMS !== 'undefined' && TEAMS.length === 48, { timeout: 30000 });

  console.log('mode  | draws  1-0(all) loser0(dec) margin1(dec) goals | AET    PK');
  console.log('ref   | 20-25  22.9     56.2        45.8         2.2-2.4 | 25-30  16-19');
  console.log('------+---------------------------------------------------+-------------');

  const results = {};
  for (const mode of MODES) {
    const t0 = Date.now();
    const r = await page.evaluate((m, T) => {
      RATING_MODE = m;
      let n = 0, oneZero = 0, loserZero = 0, margin1 = 0, draws = 0, goals = 0;
      let koN = 0, aet = 0, pk = 0;
      for (let i = 0; i < T; i++) {
        const sim = simulateDetailed();
        for (const g of GROUPS) {
          for (const mt of sim.grMatches[g]) {
            n++;
            const s1 = mt.score.s1, s2 = mt.score.s2;
            const hi = Math.max(s1, s2), lo = Math.min(s1, s2);
            goals += s1 + s2;
            if (s1 === s2) draws++;
            else {
              if (hi === 1 && lo === 0) oneZero++;
              if (lo === 0) loserZero++;
              if (hi - lo === 1) margin1++;
            }
          }
        }
        Object.keys(sim.M).forEach(k => {
          koN++;
          if (sim.M[k].score.aet) aet++;
          if (sim.M[k].score.pk) pk++;
        });
      }
      return { n, draws, oneZero, loserZero, margin1, goals, koN, aet, pk };
    }, mode, TOURNAMENTS);

    const dec = r.n - r.draws;
    const row = {
      draws: 100 * r.draws / r.n,
      oneZero: 100 * r.oneZero / r.n,
      loserZero: 100 * r.loserZero / dec,
      margin1: 100 * r.margin1 / dec,
      goals: r.goals / r.n,
      aet: 100 * r.aet / r.koN,
      pk: 100 * r.pk / r.koN
    };
    results[mode] = row;
    console.log(
      mode.padEnd(5) + ' | ' +
      row.draws.toFixed(1).padEnd(6) + ' ' + row.oneZero.toFixed(1).padEnd(8) + ' ' +
      row.loserZero.toFixed(1).padEnd(11) + ' ' + row.margin1.toFixed(1).padEnd(12) + ' ' +
      row.goals.toFixed(2).padEnd(5) + ' | ' +
      row.aet.toFixed(1).padEnd(6) + ' ' + row.pk.toFixed(1) +
      '   (' + ((Date.now() - t0) / 1000).toFixed(0) + 's, GS n=' + r.n + ')'
    );
  }
  await browser.close();

  // quick verdict vs reference
  console.log('\nverdict vs reference (out-of-range cells):');
  const inR = (v, lo, hi) => v >= lo && v <= hi;
  for (const mode of MODES) {
    const r = results[mode];
    const bad = [];
    if (!inR(r.draws, REF.draws[0], REF.draws[1])) bad.push('draws ' + r.draws.toFixed(1));
    if (Math.abs(r.oneZero - REF.oneZero) > 2) bad.push('1-0 ' + r.oneZero.toFixed(1));
    if (Math.abs(r.loserZero - REF.loserZero) > 2) bad.push('loser0 ' + r.loserZero.toFixed(1));
    if (Math.abs(r.margin1 - REF.margin1) > 2) bad.push('margin1 ' + r.margin1.toFixed(1));
    if (!inR(r.goals, REF.goals[0], REF.goals[1])) bad.push('goals ' + r.goals.toFixed(2));
    if (!inR(r.aet, REF.aet[0], REF.aet[1])) bad.push('AET ' + r.aet.toFixed(1));
    if (!inR(r.pk, REF.pk[0], REF.pk[1])) bad.push('PK ' + r.pk.toFixed(1));
    console.log('  ' + mode + ': ' + (bad.length ? bad.join(', ') : 'all good'));
  }
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
