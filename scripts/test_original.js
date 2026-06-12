// Custom-modes validation (v2.18: Power & Matchup).
//
// Matchup (mode id 'original'): score-driven engine. Calibration targets from
// real WC 2018+2022 GS (N=96): 1-0 = 22.9% of matches, loser-0 = 56.2% of
// decisive, margin-1 = 45.8%, draws 20-25%, avg goals ~2.2-2.4.
// KO: AET ~25-30%, PK ~16-19%.
//
// Power: rating-driven engine on the Elo machinery (t.powerElo projection).
// Its GS distribution must match the Elo-mode calibration family — if it
// drifts, the Elo-scale projection is broken.
//
// Run: python -m http.server 8123 (repo root), then node scripts/test_original.js
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.goto('http://localhost:8123/index.html', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2500));

  await page.click('#rating-toggle button[data-mode="original"]');
  await new Promise(r => setTimeout(r, 400));

  const basic = await page.evaluate(() => ({
    mode: RATING_MODE,
    matchupTop6: [...TEAMS].sort((a, b) => b.matchup - a.matchup).slice(0, 6).map(t => t.c + ':' + t.matchup),
    powerTop6: [...TEAMS].sort((a, b) => b.power - a.power).slice(0, 6).map(t => t.c + ':' + t.power),
    powerEloRange: (() => { const pe = TEAMS.map(t => t.powerElo); return Math.min(...pe) + '..' + Math.max(...pe); })(),
    jpn: (t => ({ matchup: t.matchup, power: t.power, powerElo: t.powerElo }))(TEAMS.find(t => t.c === 'JPN'))
  }));
  console.log('BASIC: ' + JSON.stringify(basic));

  // 300 detailed tournaments = 21,600 GS + ~9,600 KO matches
  const distFn = () => {
    let n = 0, oneZero = 0, loserZero = 0, margin1 = 0, draws = 0, goals = 0;
    let koN = 0, aet = 0, pk = 0;
    for (let i = 0; i < 300; i++) {
      const sim = simulateDetailed();
      for (const g of GROUPS) {
        for (const m of sim.grMatches[g]) {
          n++;
          const s1 = m.score.s1, s2 = m.score.s2;
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
        const m = sim.M[k];
        koN++;
        if (m.score.aet) aet++;
        if (m.score.pk) pk++;
      });
    }
    const dec = n - draws;
    return {
      mode: RATING_MODE,
      gsMatches: n,
      avgGoals: +(goals / n).toFixed(2),
      drawPct: +(draws / n * 100).toFixed(1),
      oneZero_ofAll: +(oneZero / n * 100).toFixed(1),
      oneZero_ofDecisive: +(oneZero / dec * 100).toFixed(1),
      loserZero_ofDecisive: +(loserZero / dec * 100).toFixed(1),
      margin1_ofDecisive: +(margin1 / dec * 100).toFixed(1),
      koMatches: koN,
      aetPct: +(aet / koN * 100).toFixed(1),
      pkPct: +(pk / koN * 100).toFixed(1)
    };
  };
  console.log('MATCHUP DIST: ' + JSON.stringify(await page.evaluate(distFn)));

  await page.click('#rating-toggle button[data-mode="power"]');
  await new Promise(r => setTimeout(r, 400));
  console.log('POWER DIST (expect Elo-family calibration): ' + JSON.stringify(await page.evaluate(distFn)));

  // Worker 20k per mode: champion distribution across all five lenses
  const champs = await page.evaluate(() => new Promise(resolve => {
    const modes = ['elo', 'opta', 'fifa', 'power', 'original'];
    const out = {};
    function run(mode) {
      return new Promise(res => {
        const w = new Worker(getWorkerUrl());
        const timer = setTimeout(() => { w.terminate(); res({ error: 'timeout' }); }, 90000);
        w.onmessage = e => { if (e.data.type === 'done') { clearTimeout(timer); w.terminate(); res(e.data); } };
        w.onerror = err => { clearTimeout(timer); w.terminate(); res({ error: err.message }); };
        w.postMessage({ type: 'run', teams: TEAMS, fifaThirdLookup: FIFA_THIRD_LOOKUP,
          ratingMode: mode, homeAdvOn: true, focus: 'JPN', n: 20000, batch: 2000 });
      });
    }
    (async () => {
      for (const m of modes) {
        const d = await run(m);
        if (d.error) { out[m] = 'ERR ' + d.error; continue; }
        out[m] = {
          top8: Object.entries(d.champs).sort((a, b) => b[1] - a[1]).slice(0, 8)
            .map(([c, k]) => c + ' ' + (k / d.N * 100).toFixed(1)),
          jpn: +((d.champs.JPN || 0) / d.N * 100).toFixed(2)
        };
      }
      resolve(out);
    })();
  }));
  console.log('CHAMPS 20k/mode: ' + JSON.stringify(champs, null, 1));

  console.log('PAGE ERRORS: ' + (errors.length ? JSON.stringify(errors) : 'none'));
  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
