// Live-page (index.html, site root) smoke test (local only, not part of the site).
// Verifies: page loads clean, real results are fetched and locked into
// every sim path (main + worker), frozen ratings are used, UI marks real
// matches. Run: node scripts/test_live.js  (needs `python -m http.server
// 8123` or any static server in the repo root, see runner below).
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 950 });
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push('PAGEERROR: ' + err.message));

  await page.goto('http://localhost:8123/index.html', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 4000));

  // 1) Status: teams loaded from frozen snapshot, ESPN results ingested.
  const status = await page.evaluate(() => ({
    played: (document.getElementById('live-played') || {}).textContent || '',
    realCount: typeof REAL_COUNT !== 'undefined' ? REAL_COUNT : 'n/a',
    realKeys: typeof REAL_RESULTS !== 'undefined' ? Object.keys(REAL_RESULTS) : [],
    liveNow: typeof LIVE_MATCHES !== 'undefined' ? LIVE_MATCHES : [],
    unmapped: typeof UNMAPPED_TEAMS !== 'undefined' ? UNMAPPED_TEAMS : [],
    teamsLen: typeof TEAMS !== 'undefined' ? TEAMS.length : 0,
    eloDate: typeof LAST_UPDATED !== 'undefined' ? LAST_UPDATED : ''
  }));
  console.log('STATUS: ' + JSON.stringify(status));

  // 2) Hook: MEX vs RSA finished 2-0 — simMatch must return MEX 1000/1000,
  //    simMatchDetailed must return the literal 2-0 flagged real:true.
  const hook = await page.evaluate(() => {
    const mex = TEAMS.find(t => t.c === 'MEX'), rsa = TEAMS.find(t => t.c === 'RSA');
    let mexWins = 0, draws = 0, other = 0;
    for (let i = 0; i < 1000; i++) {
      const w = simMatch(mex, rsa, true, 'gs');
      if (w === null) draws++; else if (w.c === 'MEX') mexWins++; else other++;
    }
    const det = simMatchDetailed(mex, rsa, 'gs');
    const detFlip = simMatchDetailed(rsa, mex, 'gs'); // reversed order must flip the score
    return {
      mexWins, draws, other,
      det: det.score.s1 + '-' + det.score.s2 + ' real=' + !!det.real,
      detFlip: detFlip.score.s1 + '-' + detFlip.score.s2 + ' winner=' + (detFlip.winner && detFlip.winner.c)
    };
  });
  console.log('HOOK (expect 1000/0/0, 2-0 real=true, flip 0-2 winner=MEX): ' + JSON.stringify(hook));

  // 3) Rendered UI: real rows exist, marked, and stable across re-simulations.
  const snaps = [];
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => renderOnce());
    await new Promise(r => setTimeout(r, 250));
    snaps.push(await page.evaluate(() =>
      Array.from(document.querySelectorAll('.gs-match-row.is-real'))
        .map(r => r.textContent.replace(/\s+/g, ' ').trim()).sort()
    ));
  }
  console.log('REAL ROWS: ' + JSON.stringify(snaps[0]));
  console.log('REAL ROWS STABLE ACROSS RESIMS: ' +
    (JSON.stringify(snaps[0]) === JSON.stringify(snaps[1]) &&
     JSON.stringify(snaps[1]) === JSON.stringify(snaps[2])));

  // 4) Fast path: over 200 simulate() calls group A standings must respect
  //    the locked results (MEX got 3 real points, RSA 0 from that game).
  const grA = await page.evaluate(() => {
    const winners = {}, rsaTop = { yes: 0 };
    for (let i = 0; i < 200; i++) {
      const sim = simulate();
      const top = sim.gr.A[0].c;
      winners[top] = (winners[top] || 0) + 1;
    }
    return winners;
  });
  console.log('GROUP A TOP over 200 fast sims: ' + JSON.stringify(grA));

  // 5) Worker: same hook must run inside the worker (REAL_RESULTS handed over).
  const workerRes = await page.evaluate(() => new Promise(resolve => {
    try {
      const w = new Worker(getWorkerUrl());
      const timer = setTimeout(() => { w.terminate(); resolve('TIMEOUT'); }, 30000);
      w.onmessage = (e) => {
        if (e.data.type === 'done') {
          clearTimeout(timer); w.terminate();
          resolve('DONE n=' + e.data.N + ' champKeys=' + Object.keys(e.data.champs).length);
        }
      };
      w.onerror = (err) => { clearTimeout(timer); w.terminate(); resolve('ERROR: ' + err.message); };
      w.postMessage({ type: 'run', teams: TEAMS, fifaThirdLookup: FIFA_THIRD_LOOKUP,
        ratingMode: 'elo', homeAdvOn: true, focus: 'JPN', realResults: REAL_RESULTS,
        n: 2000, batch: 500 });
    } catch (e) { resolve('THROW: ' + e.message); }
  }));
  console.log('WORKER 2000 sims: ' + workerRes);

  await page.screenshot({ path: 'live_test.png' });
  console.log('CONSOLE ERRORS: ' + (errors.length ? JSON.stringify(errors) : 'none'));
  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
