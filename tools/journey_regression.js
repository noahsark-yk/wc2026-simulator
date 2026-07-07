// ============================================================================
// journey_regression.js — journey.html（W杯を旅する）回帰テスト（P3）
//
// 【何をするか】
//   puppeteer で journey.html を開き、以下 4 ケースを自動検査する：
//     A. queue 整合   … focusNation="JPN" で seed を 1 から走査し、focusResult が
//                       final_r32 / final_r16 / final_qf / final_1st になる seed を各1つ発見。
//                       各 seed で buildJourneyQueue() 後に
//                       (a) match カード（c1,c2 ソート結合）に重複が無い
//                       (b) queue 末尾が match
//                       (c) stage==='gs' の match が 3 つ以下
//                       を assert する
//     B. レイアウト   … 390x844 と 512x1140 の 2 幅で #gamePanel を強制 open
//                       （ダミー lineup/stats/feed を注入）し、
//                       .jumbo 高さ >= 80 / .jumbo top >= #autoCmd bottom /
//                       .game-ctrl bottom <= viewport高さ（scroll 0 と最下部の両方）を assert
//     C. i18n 動作    … LANG="en" → applyLanguageJ() で .ts-title が
//                       "Journey Through the World Cup"、LANG="ar" で dir="rtl"。
//                       全ページ累計の pageerror が 0 であること
//     D. 実結果反映   … FIXTURES の kickoff が KO_THRESHOLD_MS（2026-06-28 10:00 UTC =
//                       journey.html と同値）以降かつ state==="post" の試合（=現実の決勝T
//                       確定結果）があれば、実勝者を focus にして JE.config + setSeed +
//                       simulateDetailed し、該当ステージの focusMatches の勝者が実勝者と
//                       一致するか検査（seed 1〜5 の全 seed で）。
//                       ※担当指示の「day>="2026-06-29"」は日付文字列比較で、(1) 6/28 の R32
//                         初戦を取りこぼす (2) 米国夜= UTC 翌日 01:30 開始の R32 最終戦を R16 と
//                         誤分類する（COL-GHA 7/4 01:30Z で実際に誤検出）。journey.html
//                         3857-3859 行が明記する罠のため、本体と同じ ts 境界に置き換えた
//                       不一致は現状 ⚠ WARN 扱い（exit code に影響しない）。
//                       post の KO 試合が無ければ「スキップ（対象なし）」と明示出力
//
// 【前提】
//   - node v24 / puppeteer はリポジトリ直下の node_modules で解決される。
//     動作確認済みの実行ディレクトリ: C:/Users/11160/simulator-thread/wc2026-simulator/tools
//     （node の require はここから親の wc2026-simulator/node_modules を見つける。v24.42.0 で確認済）
//   - デフォルトはローカル file:///C:/Users/11160/simulator-thread/wc2026-simulator/journey.html
//     が対象（デプロイ不要で回せる）。FIXTURES は ESPN API から取得するためネット接続は必要
//
// 【実行コマンド】
//   cd C:/Users/11160/simulator-thread/wc2026-simulator/tools
//   node journey_regression.js            # ローカル journey.html を検査
//   node journey_regression.js --prod     # 本番 https://noahsark-wc2026.pages.dev/journey を検査
//
// 【出力の読み方】
//   - ケースごとに ✅（合格）/ ❌（不合格）/ ⚠（警告）と実測値を1行ずつ出す
//   - 最終行が「=== 結果: PASS x/y (WARN n) ===」。x=合格ケース数、y=4、n=警告数
//   - exit code: A〜C のどれかが ❌ なら 1、それ以外は 0
//     （D は現状 WARN 止まり。下の D_IS_HARD_FAIL を true にすると D の不一致も exit 1 に昇格）
//
// 【失敗時の対処（if-then）】
//   - 「FIXTURES 0件」が出た → ESPN API に届いていない。ネット接続を確認して再実行。
//     再実行でも 0 件なら ESPN API 側の障害（時間を置いて再実行）
//   - A で「seed 3000 まで走査して見つからず」 → journey-engine.js の focusResult /
//     simulateDetailed の変更（勝敗ロジック・stage 名）を確認する
//   - A で「重複カード」 → 出力の stage の組合せを見る。gs+r32 なら buildJourneyQueue() の
//     day<koStart フィルタの退行（バグ確定）。gs+qf / gs+sf / gs+f なら同組再戦（正規の
//     組合せ）の可能性があるので、seed とカードを journey.html 上で目視確認してから判断する
//   - B で ❌ → journey.html の @media(max-width:780px) 内 .game-card（padding-top:56px）/
//     .game-ctrl（position:sticky; bottom:0）/ #autoCmd（top:9px, button 高 34px）を確認する
//   - C で .ts-title 不一致 → journey.html の TJ.en.ts_title を確認。dir 不一致 →
//     applyLanguageJ() の document.documentElement.dir 設定を確認。pageerror>0 →
//     出力されるエラーメッセージ全文を読み、該当行を直す
//   - D で ⚠ 不一致 → 実 KO 結果が sim に固定されていない。原因の見分け方：
//     (1) 「sim では <stage> に不到達」や sim 勝者不一致が多発 → REAL_RESULTS の KO| キー
//         対応（buildRealResults が KO 試合に KO| キーを作る修正）が退行した。2026-07-07 の
//         実測ではローカル（journey.html 4498-4502 行）・本番とも修正済みで D は 22/22 全一致。
//         下の D_IS_HARD_FAIL を true に変えるだけで ❌（exit 1）に昇格できる（判断はメイン）
//     (2) 特定の 1 試合だけ不一致 → その試合の kickoff（UTC）を見る。ステージ境界日の
//         10:00Z 前後なら stageOf の境界誤り、そうでなければ ESPN フィードの欠落
//         （FIXTURES に該当試合が無い＝ロック不能）を疑う
//   - タイムアウトで落ちた → 再実行。連続するなら、--prod は回線とデプロイ状態、
//     ローカルは journey.html を単体でブラウザに開いて構文エラーが無いか確認する
// ============================================================================

'use strict';

// ★ 実 KO 結果ロック修正（REAL_RESULTS の KO| キー対応）は 2026-07-07 に本番デプロイ済み、
//   ローカル・本番とも 22/22 全一致を実測 → FAIL 昇格済み（true）。
//   実結果の不一致 = ロック機構の回帰なので exit 1 で止める。
const D_IS_HARD_FAIL = true;

const puppeteer = require('puppeteer');

// ---- 対象 URL（--prod で本番へ切替） ----
const IS_PROD = process.argv.includes('--prod');
const LOCAL_URL = 'file:///C:/Users/11160/simulator-thread/wc2026-simulator/journey.html?lang=ja';
const PROD_URL = 'https://noahsark-wc2026.pages.dev/journey?lang=ja';
const TARGET_URL = IS_PROD ? PROD_URL : LOCAL_URL;

// ---- puppeteer 起動引数（GPU 無し環境用は必須。ローカル file:// は CORS 回避を追加） ----
const BASE_ARGS = ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'];
const FILE_ARGS = ['--allow-file-access-from-files', '--disable-web-security'];
const LAUNCH_ARGS = IS_PROD ? BASE_ARGS : BASE_ARGS.concat(FILE_ARGS);

// ---- 定数 ----
const SEED_SCAN_MAX = 3000;                       // A: seed 走査の上限（1 <= seed < 3000）
const TARGET_RANKS = ['final_r32', 'final_r16', 'final_qf', 'final_1st'];  // A: 探す到達結果
const VIEWPORTS = [{ w: 390, h: 844 }, { w: 512, h: 1140 }];               // B: 検証 2 幅
// D: GS/KO の境界タイムスタンプ（journey.html の KO_THRESHOLD_MS と同値 = 2026-06-28 10:00 UTC）。
//    「day >= '2026-06-29'」の日付文字列比較だと (1) 6/28 19:00Z の R32 初戦（RSA-CAN）を取り
//    こぼし、(2) 米国夜キックオフ（= UTC 翌日 01:30 等）の R32 最終戦（例: 7/4 01:30Z の
//    COL-GHA）を R16 と誤分類する ── journey.html 3857-3859 行が明記する罠。必ずこの ts で判定する
const KO_THRESHOLD_MS = Date.UTC(2026, 5, 28, 10, 0, 0);
const D_SEEDS = [1, 2, 3, 4, 5];                  // D: 検査する seed（全 seed 一致で初めて合格）
const EXPECT_TS_TITLE_EN = 'Journey Through the World Cup';                // C: 期待値

// 全ページ累計の pageerror（C の合否に使う）
const pageErrors = [];
// console error は参考情報（合否には使わない）
const consoleErrors = [];

// 数値を小数1桁に丸める（レイアウト実測値の表示用）
function r1(x) { return Math.round(x * 10) / 10; }

// ページを開いて読み込み完了（JE / TEAMS / FIXTURES）まで待つ。
// 戻り値: { page, ready: {je, teams, fixtures} }
async function openJourney(browser, viewport, needFixtures) {
  const page = await browser.newPage();
  if (viewport) await page.setViewport({ width: viewport.w, height: viewport.h, isMobile: true, hasTouch: true });
  page.on('pageerror', (e) => pageErrors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push('CONSOLE: ' + m.text()); });
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  // JE と TEAMS（teams.json）は必須。25 秒待って来なければそのまま進めて後段が ❌ を出す
  try {
    await page.waitForFunction('window.JE && typeof TEAMS !== "undefined" && TEAMS.length > 0', { timeout: 25000 });
  } catch (e) { /* 後段の precondition 検査で拾う */ }
  if (needFixtures) {
    // FIXTURES は ESPN fetch 由来（非同期）。20 秒待って来なければ 0 件のまま進める
    try {
      await page.waitForFunction('typeof FIXTURES !== "undefined" && FIXTURES.length > 0', { timeout: 20000 });
    } catch (e) { /* A / D の precondition 検査で拾う */ }
  }
  const ready = await page.evaluate(() => ({
    je: !!window.JE,
    teams: (typeof TEAMS !== 'undefined' && TEAMS.length) || 0,
    fixtures: (typeof FIXTURES !== 'undefined' && FIXTURES.length) || 0,
  }));
  return { page, ready };
}

// ============================================================================
// ケース A: queue 整合（ページ内で JE を直接叩く）
// ============================================================================
async function runCaseA(page) {
  return page.evaluate((TARGET_RANKS, SEED_SCAN_MAX) => {
    const out = { pre: {}, ranks: {} };
    out.pre.je = !!window.JE;
    out.pre.teams = (typeof TEAMS !== 'undefined' && TEAMS.length) || 0;
    out.pre.fixtures = (typeof FIXTURES !== 'undefined' && FIXTURES.length) || 0;
    out.pre.hasJPN = !!(typeof TEAMS !== 'undefined' && TEAMS.find((t) => t.c === 'JPN'));
    if (!out.pre.je || !out.pre.teams || !out.pre.hasJPN) return out;   // precondition NG → 呼び元で ❌

    // 旅の状態をテスト用に固定（buildJourneyQueue が参照するグローバル）
    focusNation = 'JPN';
    skipConfirmed = false;
    const mode = (typeof RATING_MODE_UI !== 'undefined') ? RATING_MODE_UI : 'elo';

    // seed 走査を 1 パス実行する。realResults を引数で切替できるようにする
    // （実 KO 結果ロックが入ると JPN の実際の敗退ステージ以降の到達結果が seed 非依存で
    //   固定され、一部 rank が見つからなくなる。その場合は realResults 無効で再走査する）
    function scan(realResults, want) {
      JE.config({ ratingMode: mode, realResults: realResults, focus: 'JPN' });
      for (let s = 1; s < SEED_SCAN_MAX && Object.values(want).some((v) => v === null); s++) {
        JE.setSeed(s);
        const sim = JE.simulateDetailed();
        const rk = JE.focusResult(sim);
        if (Object.prototype.hasOwnProperty.call(want, rk) && want[rk] === null) want[rk] = { seed: s, sim: sim };
      }
      return want;
    }

    // 1 パス目: アプリ実挙動と同じ realResults 付き
    const rr = (typeof REAL_RESULTS !== 'undefined') ? REAL_RESULTS : {};
    const want = {};
    TARGET_RANKS.forEach((r) => { want[r] = null; });
    scan(rr, want);
    // 2 パス目: 見つからなかった rank だけ realResults 無効（純予測モード）で再走査
    const missing = TARGET_RANKS.filter((r) => want[r] === null);
    const rescanned = {};
    if (missing.length) {
      const want2 = {};
      missing.forEach((r) => { want2[r] = null; });
      scan({}, want2);
      missing.forEach((r) => { if (want2[r]) { want[r] = want2[r]; rescanned[r] = true; } });
      // engine の realResults を元に戻す（後続ケースへの影響を断つ）
      JE.config({ realResults: rr });
    }

    // 各 rank について queue を組み、(a)(b)(c) を実測する
    for (const rank of TARGET_RANKS) {
      const data = want[rank];
      if (!data) { out.ranks[rank] = { found: false }; continue; }
      journeySeed = data.seed;
      journeySim = data.sim;
      buildJourneyQueue();
      const items = journeyQueue.map((it) => ({
        type: it.type,
        stage: it.stage || '',
        card: it.fx ? [it.fx.c1, it.fx.c2].slice().sort().join('v') : '',
      }));
      const matchItems = items.filter((it) => it.type === 'match');
      const cards = matchItems.map((it) => it.card);
      // 重複カード: 同一カードの 2 回目以降を検出し、stage の組合せ付きで返す
      const dup = [];
      cards.forEach((c, i) => {
        if (cards.indexOf(c) !== i && !dup.some((d) => d.card === c)) {
          dup.push({ card: c, stages: matchItems.filter((m) => m.card === c).map((m) => m.stage) });
        }
      });
      out.ranks[rank] = {
        found: true,
        seed: data.seed,
        rescanned: !!rescanned[rank],
        queueLen: journeyQueue.length,
        matchTotal: journeyMatchTotal,
        gsCount: matchItems.filter((it) => it.stage === 'gs').length,
        tailType: items.length ? items[items.length - 1].type : '(空)',
        dup: dup,
        queueStr: items.map((it, i) => i + ':' + it.type + (it.stage ? '/' + it.stage : '') + (it.card ? ' ' + it.card : '')).join(' | '),
      };
    }
    return out;
  }, TARGET_RANKS, SEED_SCAN_MAX);
}

// ============================================================================
// ケース B: レイアウト（#gamePanel 強制 open + ダミー注入 → 実測）
// ============================================================================
async function runCaseB(page, vw) {
  // ダミー注入と実測はページ内で一括実行する
  return page.evaluate((VW_H) => {
    const out = {};
    const gp = document.getElementById('gamePanel');
    const ts = document.getElementById('titleScreen');
    if (!gp) { out.err = '#gamePanel が無い'; return out; }
    // タイトル画面・他パネルを全部閉じる（body:has(...) で #autoCmd が消えるのを防ぐ）
    if (ts) { ts.classList.remove('show'); ts.style.display = 'none'; }
    ['nationPanel', 'scorerPanel', 'schedulePanel', 'bracketPanel', 'finalView', 'matchModal', 'onbRating', 'onbSkip', 'onbAuto'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('open', 'show');
    });
    gp.classList.add('open');
    // スコアボードと本文にダミーを注入（実際の試合画面相当の内容量にする）
    document.getElementById('jscore').textContent = '2 - 1';
    document.getElementById('jc1').textContent = 'NED';
    document.getElementById('jc2').textContent = 'JPN';
    const lineup = document.getElementById('gLineup');
    if (lineup) {
      let h = '<div style="padding:10px">NED 4-3-3</div>';
      for (let i = 0; i < 11; i++) h += '<div style="padding:7px">' + (i + 1) + ' Player</div>';
      h += '<div style="padding:10px">JPN 4-2-3-1</div>';
      for (let i = 0; i < 11; i++) h += '<div style="padding:7px">' + (i + 1) + ' Senshu</div>';
      lineup.innerHTML = h;
    }
    const stats = document.getElementById('gameStats');
    if (stats) stats.innerHTML = '<div style="padding:10px">POS 60/40</div><div style="padding:10px">Shots 10/10</div><div style="padding:10px">OT 6/3</div><div style="padding:10px">CK 5/4</div>';
    const feed = document.getElementById('gameFeed');
    if (feed) {
      let h = '';
      for (let i = 0; i < 40; i++) h += '<div style="padding:8px;border-bottom:1px solid #223">' + i + "' event dummy line</div>";
      feed.innerHTML = h;
    }
    void document.body.offsetHeight;   // 強制 reflow

    const card = document.querySelector('.game-card');
    const rect = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, h: r.height };
    };
    // scroll 0 で実測
    card.scrollTop = 0;
    void document.body.offsetHeight;
    const autoCmd = document.getElementById('autoCmd');
    out.autoCmdDisplay = autoCmd ? getComputedStyle(autoCmd).display : '(無し)';
    out.jumbo0 = rect('.jumbo');
    out.autoCmd0 = rect('#autoCmd');
    out.ctrl0 = rect('.game-ctrl');
    // 最下部までスクロールして .game-ctrl の位置を再実測（sticky が効いているか）
    card.scrollTop = card.scrollHeight;
    void document.body.offsetHeight;
    out.ctrlMax = rect('.game-ctrl');
    out.scrollHeight = card.scrollHeight;
    out.vh = VW_H;
    return out;
  }, vw.h);
}

// ============================================================================
// ケース C: i18n（LANG 切替 → applyLanguageJ() → DOM 実測）
// ============================================================================
async function runCaseC(page) {
  return page.evaluate(() => {
    const out = {};
    if (typeof applyLanguageJ !== 'function' || !document.querySelector('.ts-title')) {
      out.err = 'applyLanguageJ か .ts-title が無い';
      return out;
    }
    LANG = 'en';
    applyLanguageJ();
    out.tsTitleEn = document.querySelector('.ts-title').textContent;
    out.dirEn = document.documentElement.dir;
    LANG = 'ar';
    applyLanguageJ();
    out.dirAr = document.documentElement.dir;
    out.tsTitleAr = document.querySelector('.ts-title').textContent;
    LANG = 'ja';
    applyLanguageJ();   // 元に戻す
    return out;
  });
}

// ============================================================================
// ケース D: 実結果反映（post の KO 試合が sim に反映されているか）
// ============================================================================
async function runCaseD(page) {
  return page.evaluate((KO_THRESHOLD_MS, D_SEEDS) => {
    const out = { fixtures: (typeof FIXTURES !== 'undefined' && FIXTURES.length) || 0, checks: [] };
    if (!window.JE || out.fixtures === 0) { out.skipped = true; out.skipReason = out.fixtures === 0 ? 'FIXTURES 0件' : 'JE 無し'; return out; }

    // kickoff タイムスタンプ → ステージ判定。境界は「各ラウンド初日の 10:00 UTC」
    // （journey.html の KO_THRESHOLD_MS = 6/28 10:00Z と同じ流儀。米国夜キックオフが UTC 翌日
    //   00:00〜02:00 に落ちるため、日付文字列比較だと前ラウンド最終戦を翌ラウンドと誤分類する。
    //   10:00Z 境界なら「前日の米国夜の試合」= 境界日の 10:00Z より前 → 前ラウンド、で正しく割れる）
    const stageOf = (ts) =>
      ts >= Date.UTC(2026, 6, 19, 10, 0, 0) ? 'f'      // 決勝: 7/19〜
      : ts >= Date.UTC(2026, 6, 18, 10, 0, 0) ? '3rd'  // 3位決定戦: 7/18〜
      : ts >= Date.UTC(2026, 6, 14, 10, 0, 0) ? 'sf'   // 準決勝: 7/14〜
      : ts >= Date.UTC(2026, 6, 9, 10, 0, 0) ? 'qf'    // 準々決勝: 7/9〜
      : ts >= Date.UTC(2026, 6, 4, 10, 0, 0) ? 'r16'   // R16: 7/4〜
      : 'r32';                                          // R32: KO_THRESHOLD_MS〜

    const posts = FIXTURES.filter((m) => Date.parse(m.date) >= KO_THRESHOLD_MS && m.state === 'post');
    if (!posts.length) { out.skipped = true; out.skipReason = 'post の KO 試合が 0 件'; return out; }

    const rr = (typeof REAL_RESULTS !== 'undefined') ? REAL_RESULTS : {};
    const mode = (typeof RATING_MODE_UI !== 'undefined') ? RATING_MODE_UI : 'elo';

    for (const fx of posts) {
      const stage = stageOf(Date.parse(fx.date));
      // 実勝者の判定: ESPN イベントの winner フラグ（PK 決着も拾える）→ 無ければスコア比較 → PK スコア比較
      let realWinner = null;
      const ev = (typeof EVENTS !== 'undefined') ? EVENTS.find((e) => String(e.id) === String(fx.id)) : null;
      const comp = ev && (ev.competitions || [])[0];
      const wco = comp && (comp.competitors || []).find((c) => c.winner === true);
      if (wco && wco.team) realWinner = wco.team.abbreviation;
      if (!realWinner) {
        if (fx.s1 > fx.s2) realWinner = fx.c1;
        else if (fx.s2 > fx.s1) realWinner = fx.c2;
        else if (fx.pk1 != null && fx.pk2 != null && fx.pk1 !== fx.pk2) realWinner = fx.pk1 > fx.pk2 ? fx.c1 : fx.c2;   // 90分同点 → PK（buildRealResults と同じ判定）
      }
      if (!realWinner) {
        out.checks.push({ card: fx.c1 + ' vs ' + fx.c2, stage: stage, day: fx.day, verdict: 'skip', note: '勝者判定不能（winner フラグ無し・同点=PK?）' });
        continue;
      }
      const realLoser = realWinner === fx.c1 ? fx.c2 : fx.c1;

      // 実勝者を focus にして seed 1〜5 全部で sim → 該当ステージの勝者を照合
      JE.config({ ratingMode: mode, realResults: rr, focus: realWinner });
      const mismatches = [];
      for (const s of D_SEEDS) {
        JE.setSeed(s);
        const sim = JE.simulateDetailed();
        let fm = null;
        if (stage === '3rd') {
          const m3 = sim.M['3rd'];
          fm = (m3 && (m3.t1.c === realWinner || m3.t2.c === realWinner)) ? m3 : null;
        } else {
          fm = sim.focusMatches[stage];
        }
        if (!fm) { mismatches.push('seed' + s + ': sim では ' + stage + ' に不到達'); continue; }
        const simWinner = fm.winner.c;
        const simOpp = fm.t1.c === realWinner ? fm.t2.c : fm.t1.c;
        if (simWinner !== realWinner) mismatches.push('seed' + s + ': sim対戦=' + realWinner + ' vs ' + simOpp + '・sim勝者=' + simWinner);
        else if (simOpp !== realLoser) mismatches.push('seed' + s + ': 勝者一致だが sim の対戦相手=' + simOpp + '（実際は ' + realLoser + '）');
      }
      out.checks.push({
        card: fx.c1 + ' ' + (fx.s1 == null ? '?' : fx.s1) + '-' + (fx.s2 == null ? '?' : fx.s2) + ' ' + fx.c2,
        stage: stage, day: fx.day, realWinner: realWinner,
        verdict: mismatches.length ? 'ng' : 'ok',
        mismatches: mismatches,
      });
    }
    // engine 設定を元に戻す
    JE.config({ ratingMode: mode, realResults: rr, focus: (typeof focusNation !== 'undefined' && focusNation) || 'JPN' });
    return out;
  }, KO_THRESHOLD_MS, D_SEEDS);
}

// ============================================================================
// メイン
// ============================================================================
(async () => {
  console.log('=== journey 回帰テスト（対象: ' + (IS_PROD ? '本番 ' + PROD_URL : 'ローカル ' + LOCAL_URL) + '） ===');
  const browser = await puppeteer.launch({ headless: 'new', args: LAUNCH_ARGS, protocolTimeout: 300000 });
  // ケース合否の集計（A/B/C/D の 4 ケース）
  const result = { A: null, B: null, C: null, D: null };   // true=合格 / false=不合格 / 'warn' / 'skip'
  const lines = [];
  const say = (s) => { lines.push(s); console.log(s); };

  try {
    // ---------- ページ1: A / D / C（機能検査。viewport はデフォルトで良い） ----------
    const p1 = await openJourney(browser, null, true);
    say('[準備] JE=' + p1.ready.je + ' / TEAMS=' + p1.ready.teams + '件 / FIXTURES=' + p1.ready.fixtures + '件');

    // ---------- A ----------
    say('--- A: queue 整合（focus=JPN, seed 1〜' + (SEED_SCAN_MAX - 1) + ' 走査） ---');
    const A = await runCaseA(p1.page);
    let aOk = true;
    if (!A.pre.je || !A.pre.teams || !A.pre.hasJPN || !A.pre.fixtures) {
      aOk = false;
      say('  ❌ precondition NG: JE=' + A.pre.je + ' TEAMS=' + A.pre.teams + ' JPN登録=' + A.pre.hasJPN + ' FIXTURES=' + A.pre.fixtures + '件'
        + (A.pre.fixtures ? '' : '（ESPN fetch 失敗? ネット接続を確認して再実行）'));
    } else {
      for (const rank of TARGET_RANKS) {
        const r = A.ranks[rank];
        if (!r || !r.found) {
          aOk = false;
          say('  ❌ ' + rank + ': seed ' + SEED_SCAN_MAX + ' 未満で見つからず（realResults 無効の再走査でも無し）');
          continue;
        }
        const okDup = r.dup.length === 0;
        const okTail = r.tailType === 'match';
        const okGs = r.gsCount <= 3;
        const ok = okDup && okTail && okGs;
        if (!ok) aOk = false;
        say('  ' + (ok ? '✅' : '❌') + ' ' + rank + ': seed=' + r.seed + (r.rescanned ? '（realResults 無効で探索）' : '')
          + ' queue長=' + r.queueLen + ' match総数=' + r.matchTotal
          + ' | (a)重複カード=' + (okDup ? '0' : JSON.stringify(r.dup))
          + ' (b)末尾=' + r.tailType + (okTail ? '' : '←match でない')
          + ' (c)GS試合=' + r.gsCount + (okGs ? '' : '←3 超過'));
        if (!ok) say('      queue: ' + r.queueStr);
      }
    }
    result.A = aOk;
    say('  → A: ' + (aOk ? '✅ 合格' : '❌ 不合格'));

    // ---------- D（p1 のまま実行。C の言語切替より前に済ませる） ----------
    say('--- D: 実結果反映（post の KO 試合 × seed ' + D_SEEDS.join(',') + '、現状 ' + (D_IS_HARD_FAIL ? 'FAIL' : 'WARN') + ' 扱い） ---');
    const D = await runCaseD(p1.page);
    if (D.skipped) {
      result.D = 'skip';
      say('  ⚠ スキップ（対象なし: ' + D.skipReason + '）');
    } else {
      const ngs = D.checks.filter((c) => c.verdict === 'ng');
      const oks = D.checks.filter((c) => c.verdict === 'ok');
      const skips = D.checks.filter((c) => c.verdict === 'skip');
      for (const c of D.checks) {
        if (c.verdict === 'ok') say('  ✅ ' + c.card + ' (' + c.stage + ' ' + c.day + ', 実勝者 ' + c.realWinner + '): 全 seed で sim 勝者一致');
        else if (c.verdict === 'skip') say('  ⚠ ' + c.card + ' (' + c.stage + ' ' + c.day + '): ' + c.note);
        else say('  ' + (D_IS_HARD_FAIL ? '❌' : '⚠') + ' ' + c.card + ' (' + c.stage + ' ' + c.day + ', 実勝者 ' + c.realWinner + '): ' + c.mismatches.join(' / '));
      }
      if (ngs.length === 0) {
        result.D = true;
        say('  → D: ✅ 合格（' + oks.length + '件全て sim に反映' + (skips.length ? '、判定不能 ' + skips.length + '件' : '') + '）');
      } else if (D_IS_HARD_FAIL) {
        result.D = false;
        say('  → D: ❌ 不合格（' + D.checks.length + '件中 ' + ngs.length + '件不一致）');
      } else {
        result.D = 'warn';
        say('  → D: ⚠ 警告（' + D.checks.length + '件中 ' + ngs.length + '件不一致 ── 実 KO 結果が sim に固定されていない。KO| キー対応が本番に入ったら D_IS_HARD_FAIL=true に昇格）');
      }
    }

    // ---------- C（p1 の言語を切り替えて検査。pageerror は B 実行後に累計判定） ----------
    const C = await runCaseC(p1.page);
    await p1.page.close();

    // ---------- B: 2 幅レイアウト（幅ごとに新規ページで素の状態から） ----------
    let bOk = true;
    for (const vw of VIEWPORTS) {
      say('--- B: レイアウト ' + vw.w + 'x' + vw.h + '（#gamePanel 強制 open + ダミー注入） ---');
      const pb = await openJourney(browser, vw, false);
      const B = await runCaseB(pb.page, vw);
      await pb.page.close();
      if (B.err || !B.jumbo0 || !B.autoCmd0 || !B.ctrl0 || !B.ctrlMax) {
        bOk = false;
        say('  ❌ 実測不能: ' + (B.err || ('要素欠落 jumbo=' + !!B.jumbo0 + ' autoCmd=' + !!B.autoCmd0 + ' ctrl=' + !!B.ctrl0)));
        continue;
      }
      const okVisible = B.autoCmdDisplay !== 'none';
      const okJumboH = B.jumbo0.h >= 80;
      const okNoOverlap = B.jumbo0.top >= B.autoCmd0.bottom;
      const okCtrl0 = B.ctrl0.bottom <= vw.h + 0.5;
      const okCtrlMax = B.ctrlMax.bottom <= vw.h + 0.5;
      const all = okVisible && okJumboH && okNoOverlap && okCtrl0 && okCtrlMax;
      if (!all) bOk = false;
      say('  ' + (okVisible ? '✅' : '❌') + ' #autoCmd 表示 display=' + B.autoCmdDisplay + (okVisible ? '' : '←非表示（検査の前提が崩れている）'));
      say('  ' + (okJumboH ? '✅' : '❌') + ' .jumbo 高さ ' + r1(B.jumbo0.h) + 'px >= 80px');
      say('  ' + (okNoOverlap ? '✅' : '❌') + ' .jumbo top ' + r1(B.jumbo0.top) + 'px >= #autoCmd bottom ' + r1(B.autoCmd0.bottom) + 'px（被り無し）');
      say('  ' + (okCtrl0 ? '✅' : '❌') + ' .game-ctrl bottom ' + r1(B.ctrl0.bottom) + 'px <= viewport ' + vw.h + 'px（scroll=0）');
      say('  ' + (okCtrlMax ? '✅' : '❌') + ' .game-ctrl bottom ' + r1(B.ctrlMax.bottom) + 'px <= viewport ' + vw.h + 'px（scroll=最下部, scrollHeight=' + Math.round(B.scrollHeight) + '）');
      say('  → B(' + vw.w + 'x' + vw.h + '): ' + (all ? '✅ 合格' : '❌ 不合格'));
    }
    result.B = bOk;

    // ---------- C の判定出力（pageerror 累計は全ページ分が出揃ったここで） ----------
    say('--- C: i18n 動作 ---');
    let cOk = true;
    if (C.err) {
      cOk = false;
      say('  ❌ ' + C.err);
    } else {
      const okTitle = C.tsTitleEn === EXPECT_TS_TITLE_EN;
      const okRtl = C.dirAr === 'rtl';
      if (!okTitle) cOk = false;
      if (!okRtl) cOk = false;
      say('  ' + (okTitle ? '✅' : '❌') + ' en .ts-title = "' + C.tsTitleEn + '"（期待: "' + EXPECT_TS_TITLE_EN + '"）');
      say('  ' + (okRtl ? '✅' : '❌') + ' ar dir = "' + C.dirAr + '"（期待: "rtl"、参考: en dir="' + C.dirEn + '"）');
    }
    const okNoErr = pageErrors.length === 0;
    if (!okNoErr) cOk = false;
    say('  ' + (okNoErr ? '✅' : '❌') + ' pageerror 累計 ' + pageErrors.length + ' 件（全ページ合算、期待: 0）');
    if (!okNoErr) pageErrors.slice(0, 8).forEach((e) => say('      ' + e));
    if (consoleErrors.length) say('  （参考: console error ' + consoleErrors.length + ' 件、合否対象外: ' + consoleErrors.slice(0, 3).join(' / ') + '）');
    result.C = cOk;
    say('  → C: ' + (cOk ? '✅ 合格' : '❌ 不合格'));
  } finally {
    await browser.close();
  }

  // ---------- 集計 ----------
  const order = ['A', 'B', 'C', 'D'];
  const passed = order.filter((k) => result[k] === true || result[k] === 'skip').length;
  const warns = order.filter((k) => result[k] === 'warn').length;
  const failed = order.filter((k) => result[k] === false);
  const skipNote = result.D === 'skip' ? '、D=スキップ（対象なし）' : '';
  console.log('=== 結果: PASS ' + passed + '/' + order.length + ' (WARN ' + warns + skipNote + ') ===');
  if (failed.length) {
    console.log('不合格ケース: ' + failed.join(', ') + ' → exit 1（対処はファイル冒頭の【失敗時の対処】参照）');
    process.exitCode = 1;
  }
})().catch((e) => {
  console.error('実行エラー（テスト自体が走れなかった）:', e && e.message ? e.message : e);
  console.error('→ 対処: ファイル冒頭【失敗時の対処】の「タイムアウトで落ちた」を参照');
  process.exitCode = 1;
});
