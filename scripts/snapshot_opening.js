// Opening-day prediction snapshot.
//
// Runs the live.html worker 4 times (elo / opta / fifa / original), 100k
// Monte Carlo each, with NO real results locked — i.e. the pure
// pre-tournament prediction implied by teams_frozen.json (opening-day
// inputs x current builder). Saves per-team stage-reach COUNTS to
// data/predictions_opening.json; divide by N for probabilities.
//
// This file is the immutable "what we predicted before a ball was kicked"
// record: the baseline for the opening-vs-now delta view (improvement #5)
// and for the post-tournament scoring article.
//
// Usage:
//   1. serve the repo root:  python -m http.server 8123
//   2. node scripts/snapshot_opening.js

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const URL = 'http://localhost:8123/live.html';
const OUT = path.join(__dirname, '..', 'data', 'predictions_opening.json');
const RUNS = 100000;
const MODES = ['elo', 'opta', 'fifa', 'original'];

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  page.setDefaultTimeout(600000);
  page.on('pageerror', e => console.error('PAGEERROR:', e.message));
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForFunction(() => typeof TEAMS !== 'undefined' && TEAMS.length === 48, { timeout: 30000 });

  const frozenInfo = await page.evaluate(() =>
    ({ lastUpdated: (typeof LAST_UPDATED !== 'undefined' && LAST_UPDATED) || null,
       nTeams: TEAMS.length }));
  console.log(`page ready: ${frozenInfo.nTeams} teams, frozen lastUpdated=${frozenInfo.lastUpdated}`);

  const modes = {};
  for (const mode of MODES) {
    process.stdout.write(`${mode}: ${RUNS} sims... `);
    const t0 = Date.now();
    const res = await page.evaluate((ratingMode, n) => new Promise((resolve, reject) => {
      const w = new Worker(getWorkerUrl());
      const kill = setTimeout(() => { w.terminate(); reject(new Error('worker timeout')); }, 480000);
      w.onmessage = (e) => {
        if (e.data.type === 'done') {
          clearTimeout(kill); w.terminate();
          resolve({ champs: e.data.champs, teamStages: e.data.teamStages, N: e.data.N });
        }
      };
      w.onerror = (err) => { clearTimeout(kill); w.terminate(); reject(new Error(err.message || 'worker error')); };
      w.postMessage({ type: 'run', teams: TEAMS, fifaThirdLookup: FIFA_THIRD_LOOKUP,
        ratingMode, homeAdvOn: true, focus: 'JPN',
        realResults: {},           // pure pre-tournament: nothing locked
        n, batch: 5000, liveEvery: 1e9 });
    }), mode, RUNS);

    // --- sanity checks ---
    const ts = res.teamStages;
    const sum = (key) => Object.values(ts).reduce((s, t) => s + t[key], 0);
    const champTotal = Object.values(res.champs).reduce((a, b) => a + b, 0);
    const checks = [
      ['N', res.N === RUNS],
      ['sum(champs)=N', champTotal === RUNS],
      ['sum(w)=N', sum('w') === RUNS],
      ['sum(f)=2N', sum('f') === 2 * RUNS],
      ['sum(sf)=4N', sum('sf') === 4 * RUNS],
      ['sum(qf)=8N', sum('qf') === 8 * RUNS],
      ['sum(r16)=16N', sum('r16') === 16 * RUNS],
      ['sum(r32)=32N', sum('r32') === 32 * RUNS],
      ['sum(third)=N', sum('third') === RUNS],
      ['w==champs per team', Object.keys(res.champs).every(c => ts[c] && ts[c].w === res.champs[c])],
    ];
    const bad = checks.filter(([, ok]) => !ok).map(([name]) => name);
    if (bad.length) { console.error(`FAILED checks: ${bad.join(', ')}`); process.exit(1); }

    modes[mode] = ts;
    const top5 = Object.entries(ts).sort((a, b) => b[1].w - a[1].w).slice(0, 5)
      .map(([c, t]) => `${c} ${(t.w / RUNS * 100).toFixed(1)}%`).join(', ');
    console.log(`ok in ${((Date.now() - t0) / 1000).toFixed(0)}s | top5: ${top5}`);
  }
  await browser.close();

  const out = {
    type: 'opening-predictions-snapshot',
    description: 'Pre-tournament predictions frozen at opening day. Values are counts out of N runs; divide by N for probabilities. r32/r16/qf/sf/f = reached that round, w = champion, third = won the 3rd-place match. P(group-stage exit) = 1 - r32/N.',
    generatedAt: new Date().toISOString(),
    input: `teams_frozen.json (opening-day inputs, lastUpdated ${frozenInfo.lastUpdated})`,
    N: RUNS,
    homeAdvantage: true,
    realResultsLocked: 0,
    modes
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(`saved: ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
