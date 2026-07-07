/*
 * verify_prod.js — 本番 https://noahsark-wc2026.pages.dev の健全性を PASS/FAIL 集計する
 *
 * ■ 何をするか
 *   本番サイトを 7 系統（計 17 項目）で自動検査し、項目ごとに ✅/❌ と実測値を表示、
 *   最後に "PASS x/y" を出力する。1 件でも FAIL があれば exit code 1（全 PASS なら 0）。
 *     [1a][1b] トップ HTML：journey-link が 4 回出現 ＋ <title> が "World Cup 2026 Live Simulator" で始まる
 *     [2]      /journey の <title> が "WC2026 を旅する"（index にすり替わる過去障害の再発検知）
 *     [3a-3f]  /journey?lang=ja の i18n：TJ 10 言語 / TJ.ja >= 259 キー / CN == 48 キー /
 *              LANG="en"+applyLanguageJ() で NAT("JPN")=="Japan" / LANG="ar" で dir=="rtl" / pageerror 0
 *     [4-390][4-512] トップ：#focus-toggle クリック → #focus-grid-wrapper が viewport 内
 *              （left >= -1 かつ right <= 幅+1、開いていること）＋ pageerror 0。390x844 と 512x1140 の 2 幅
 *     [5a-5d]  /journey 390 幅の試合画面：#gamePanel 強制 open ＋ gameFeed にダミー 40 行注入 →
 *              .jumbo 高さ >= 80px / .jumbo の top >= #autoCmd の bottom（非重複）/
 *              .game-ctrl の bottom が viewport 内 / pageerror 0
 *     [6]      本番 /teams.json の metadata.generatedAt が 48 時間以内（デイリー更新の生存確認）
 *     [7]      ローカル .github/workflows/daily-update.yml の「Prepare deploy directory」の cp 行に
 *              必須 9 点（index.html, teams.json, classic.html, _redirects, teams_frozen.json,
 *              journey.html, journey-engine.js, functions, data）が全部含まれるか
 *              （journey 抜け 6 日間障害の再発防止）
 *
 * ■ 前提
 *   - node v24 以上（グローバル fetch を使用、追加パッケージ不要）
 *   - puppeteer はこのリポジトリ直下の node_modules（puppeteer 24.42.0）から解決される。
 *     require の解決はスクリプトの置き場所（tools/ → 親の wc2026-simulator/node_modules）基準なので、
 *     どのカレントディレクトリから実行しても通る。
 *     実測：2026-07-07 に tools/ ディレクトリで node -e "require('puppeteer')" が成功、
 *     リポジトリ直下からの node tools/verify_prod.js も成功（動いた場所＝リポジトリ直下と tools/ の両方）
 *   - ネットワーク接続（本番 URL へ https アクセスする）
 *   - このファイルがリポジトリの tools/ にあること（[7] が ../.github/workflows/daily-update.yml を読む）
 *
 * ■ 実行コマンド
 *   cd C:/Users/11160/simulator-thread/wc2026-simulator
 *   node tools/verify_prod.js
 *
 * ■ 出力の読み方
 *   ✅ [番号] 項目名 — 実測値      … 合格
 *   ❌ [番号] 項目名 — 実測値      … 不合格（期待値と実測値が併記される）
 *   最終行 "PASS x/y" → x == y なら本番は健全（exit 0）、x < y なら異常あり（exit 1）
 *
 * ■ 失敗時の対処（if-then）
 *   - [1a][1b] が FAIL → デプロイ欠損の疑い → tools/deploy.ps1 で再デプロイして再検証する
 *   - [2] が FAIL → /journey が index にすり替わっている（過去障害の再発）→
 *     _redirects と daily-update.yml の cp 行を確認してから再デプロイする
 *   - [3*] が FAIL → 直近デプロイで journey.html の i18n が壊れた → 直近の journey.html 変更を戻して再デプロイする
 *   - [4*] が FAIL → トップの注目国グリッドがスマホ幅ではみ出している → index.html の 480px/512px 帯の CSS を確認する
 *   - [5*] が FAIL → 試合画面レイアウト崩れ → journey.html の .jumbo / .game-ctrl / #autoCmd 周りの CSS を確認する
 *   - 「puppeteer 起動失敗」と出る → リポジトリ直下で npm install を実行してから再実行する
 *   - [6] が FAIL → GitHub Actions のデイリー更新が止まっている →
 *     https://github.com/noahsark-yk/wc2026-simulator/actions を開いて失敗した run のログを確認する
 *   - [7] が FAIL → daily-update.yml の cp 行から必須ファイルが欠落 → 欠落分の cp 行を追加する（編集はメイン担当）
 *   - 「HTTP xxx」「fetch failed」が出る → 回線または Cloudflare 側の障害 → 時間を置いて再実行する
 */
'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const BASE = 'https://noahsark-wc2026.pages.dev';
// GPU 無し環境用の必須 args（本番 URL のみ開くので file:// 用の追加 args は不要）
const LAUNCH_ARGS = ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'];
const GOTO_OPTS = { waitUntil: 'networkidle2', timeout: 45000 };

const results = [];
// 結果を 1 件登録して即時表示する（pass: 真偽値、detail: 実測値の説明文）
function add(id, name, pass, detail) {
  results.push({ id, name, pass: !!pass, detail });
  console.log(`${pass ? '✅' : '❌'} [${id}] ${name} — ${detail}`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// URL をテキスト取得（HTTP エラーは throw）
async function fetchText(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

// HTML から最初の <title> を取り出す（無ければ空文字）
function extractTitle(html) {
  const m = html.match(/<title>([^<]*)<\/title>/);
  return m ? m[1].trim() : '';
}

// ---------------------------------------------------------------------------
// [1] トップ HTML：journey-link 4 回 ＋ <title> 冒頭一致
// ---------------------------------------------------------------------------
async function check1() {
  try {
    const html = await fetchText(BASE + '/');
    const count = (html.match(/journey-link/g) || []).length;
    add('1a', 'トップ: journey-link 出現回数 == 4', count === 4, `実測 ${count} 回（期待 4 回）`);
    const title = extractTitle(html);
    const expectHead = 'World Cup 2026 Live Simulator';
    add('1b', `トップ: <title> が "${expectHead}" で始まる`, title.startsWith(expectHead), `実測 "${title}"`);
  } catch (e) {
    add('1a', 'トップ: journey-link 出現回数 == 4', false, `取得エラー: ${e.message}`);
    add('1b', 'トップ: <title> 冒頭一致', false, `取得エラー: ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// [2] /journey の <title> 完全一致（index すり替わり事故の再発検知）
// ---------------------------------------------------------------------------
async function check2() {
  const expect = 'WC2026 を旅する';
  try {
    const title = extractTitle(await fetchText(BASE + '/journey'));
    add('2', `/journey: <title> == "${expect}"`, title === expect, `実測 "${title}"`);
  } catch (e) {
    add('2', `/journey: <title> == "${expect}"`, false, `取得エラー: ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// [3] /journey?lang=ja の i18n（puppeteer）
// ---------------------------------------------------------------------------
async function check3(browser) {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    const errs = [];
    page.on('pageerror', e => errs.push(String((e && e.message) || e)));
    await page.goto(BASE + '/journey?lang=ja', GOTO_OPTS);
    await sleep(2500);
    const r = await page.evaluate(() => {
      const out = {};
      out.hasTJ = typeof TJ !== 'undefined';
      out.langCount = out.hasTJ ? Object.keys(TJ).length : 0;
      out.langs = out.hasTJ ? Object.keys(TJ).join(',') : '(TJ なし)';
      out.jaKeys = (out.hasTJ && TJ.ja) ? Object.keys(TJ.ja).length : 0;
      out.cnKeys = (typeof CN !== 'undefined') ? Object.keys(CN).length : -1;
      LANG = 'en'; applyLanguageJ();
      out.natJPN_en = NAT('JPN');
      LANG = 'ar'; applyLanguageJ();
      out.dir_ar = document.documentElement.dir;
      LANG = 'ja'; applyLanguageJ(); // 後片付け（ja に戻す）
      return out;
    });
    add('3a', '/journey: window.TJ が存在し言語キー 10 個', r.hasTJ && r.langCount === 10, `実測 ${r.langCount} 言語 [${r.langs}]`);
    add('3b', '/journey: Object.keys(TJ.ja).length >= 259', r.jaKeys >= 259, `実測 ${r.jaKeys} キー（期待 >= 259）`);
    add('3c', '/journey: CN のキー数 == 48', r.cnKeys === 48, `実測 ${r.cnKeys} キー（期待 48）`);
    add('3d', '/journey: LANG="en"+applyLanguageJ() で NAT("JPN")=="Japan"', r.natJPN_en === 'Japan', `実測 "${r.natJPN_en}"`);
    add('3e', '/journey: LANG="ar" で document.documentElement.dir=="rtl"', r.dir_ar === 'rtl', `実測 "${r.dir_ar}"`);
    add('3f', '/journey: pageerror 0 件', errs.length === 0, `実測 ${errs.length} 件${errs.length ? ' 例: ' + errs.slice(0, 2).join(' / ') : ''}`);
  } catch (e) {
    add('3', '/journey: i18n 検査（TJ/CN/NAT/RTL）', false, `検査エラー: ${e.message}`);
  } finally {
    await page.close().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// [4] トップの注目国グリッド：#focus-toggle クリック → #focus-grid-wrapper が viewport 内
//     （2 幅で実施。512 = DPR2.625 実機相当、480px ブレークポイント漏れの検出実績あり）
// ---------------------------------------------------------------------------
async function check4(browser, width, height) {
  const id = `4-${width}`;
  const name = `トップ ${width}x${height}: #focus-grid-wrapper が viewport 内 ＋ pageerror 0`;
  const page = await browser.newPage();
  try {
    await page.setViewport({ width, height, isMobile: true, hasTouch: true });
    const errs = [];
    page.on('pageerror', e => errs.push(String((e && e.message) || e)));
    await page.goto(BASE + '/', GOTO_OPTS);
    await sleep(2000);
    await page.click('#focus-toggle'); // 要素が無ければ throw → catch で FAIL
    await sleep(700);
    const r = await page.evaluate(() => {
      const el = document.getElementById('focus-grid-wrapper');
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return {
        left: Math.round(rect.left * 100) / 100,
        right: Math.round(rect.right * 100) / 100,
        w: Math.round(rect.width),
        hidden: el.hidden,
      };
    });
    if (!r) {
      add(id, name, false, '#focus-grid-wrapper が見つからない');
      return;
    }
    const opened = !r.hidden && r.w > 0; // hidden のままだと rect が 0 で見かけ合格になるのを防ぐ
    const fits = r.left >= -1 && r.right <= width + 1;
    add(id, name, opened && fits && errs.length === 0,
      `left=${r.left} right=${r.right}（許容 -1〜${width + 1}）幅=${r.w}px 開閉=${opened ? '開' : '閉(hidden)'} pageerror=${errs.length}件${errs.length ? ' 例: ' + errs.slice(0, 2).join(' / ') : ''}`);
  } catch (e) {
    add(id, name, false, `検査エラー: ${e.message}`);
  } finally {
    await page.close().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// [5] /journey 390 幅の試合画面レイアウト（scratchpad/_match_prod2.js の実装を流用）
// ---------------------------------------------------------------------------
async function check5(browser) {
  const VP_H = 844;
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 390, height: VP_H, isMobile: true, hasTouch: true });
    const errs = [];
    page.on('pageerror', e => errs.push(String((e && e.message) || e)));
    await page.goto(BASE + '/journey?lang=ja', GOTO_OPTS);
    await sleep(2500);
    const r = await page.evaluate(() => {
      const $ = (id) => document.getElementById(id);
      const gp = $('gamePanel');
      if (!gp) return { error: '#gamePanel が見つからない' };
      // タイトル画面・他パネル・オンボーディングを閉じて試合画面を強制 open
      const ts = $('titleScreen');
      if (ts) { ts.classList.remove('show'); ts.style.display = 'none'; }
      ['nationPanel', 'scorerPanel', 'schedulePanel', 'bracketPanel', 'finalView', 'matchModal', 'onbRating', 'onbSkip', 'onbAuto'].forEach(id => {
        const el = $(id); if (el) { el.classList.remove('open', 'show'); }
      });
      gp.classList.add('open');
      if ($('jscore')) $('jscore').textContent = '2 - 1';
      if ($('jc1')) $('jc1').textContent = 'NED';
      if ($('jc2')) $('jc2').textContent = 'JPN';
      const lineup = $('gLineup');
      if (lineup) {
        let h = '<div style="padding:10px">NED 4-3-3</div>';
        for (let i = 0; i < 11; i++) h += '<div style="padding:7px">' + (i + 1) + ' Player</div>';
        h += '<div style="padding:10px">JPN 4-2-3-1</div>';
        for (let i = 0; i < 11; i++) h += '<div style="padding:7px">' + (i + 1) + ' Senshu</div>';
        lineup.innerHTML = h;
      }
      // gameFeed にダミー 40 行を注入（実況が溜まった状態を再現）
      const feed = $('gameFeed');
      if (feed) {
        let h = '';
        for (let i = 0; i < 40; i++) { h += '<div style="padding:8px;border-bottom:1px solid #223">' + i + "' event dummy line</div>"; }
        feed.innerHTML = h;
      }
      void document.body.offsetHeight; // 強制リフロー
      const card = document.querySelector('.game-card');
      const rect = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height) };
      };
      if (card) { card.scrollTop = 0; void document.body.offsetHeight; }
      const jumbo = rect('.jumbo');
      const autoCmd = rect('#autoCmd');
      // 実況を最下部までスクロールした状態で操作列（.game-ctrl）の位置を実測（_match_prod2.js と同じ手順）
      if (card) { card.scrollTop = card.scrollHeight; void document.body.offsetHeight; }
      const ctrl = rect('.game-ctrl');
      return { jumbo, autoCmd, ctrl };
    });
    if (r.error || !r.jumbo || !r.autoCmd || !r.ctrl) {
      const missing = r.error || ['jumbo:' + !!r.jumbo, 'autoCmd:' + !!r.autoCmd, 'ctrl:' + !!r.ctrl].join(' ');
      add('5', '/journey 390: 試合画面レイアウト', false, `要素が取得できない（${missing}）`);
      return;
    }
    add('5a', '/journey 390: .jumbo の高さ >= 80px', r.jumbo.h >= 80, `実測 ${r.jumbo.h}px（期待 >= 80px）`);
    add('5b', '/journey 390: .jumbo の top >= #autoCmd の bottom（非重複）', r.jumbo.top >= r.autoCmd.bottom, `jumbo.top=${r.jumbo.top} / autoCmd.bottom=${r.autoCmd.bottom}`);
    add('5c', `/journey 390: .game-ctrl の bottom が viewport 内（0〜${VP_H + 1}）`, r.ctrl.bottom >= 0 && r.ctrl.bottom <= VP_H + 1, `実測 bottom=${r.ctrl.bottom}（viewport 高 ${VP_H}）`);
    add('5d', '/journey 390: pageerror 0 件', errs.length === 0, `実測 ${errs.length} 件${errs.length ? ' 例: ' + errs.slice(0, 2).join(' / ') : ''}`);
  } catch (e) {
    add('5', '/journey 390: 試合画面レイアウト', false, `検査エラー: ${e.message}`);
  } finally {
    await page.close().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// [6] 本番 /teams.json の鮮度（generatedAt が 48 時間以内）
// ---------------------------------------------------------------------------
async function check6() {
  try {
    const data = JSON.parse(await fetchText(BASE + '/teams.json'));
    const gen = data && data.metadata && data.metadata.generatedAt;
    if (!gen) {
      add('6', '/teams.json: metadata.generatedAt が 48 時間以内', false, 'metadata.generatedAt が存在しない');
      return;
    }
    const ageMs = Date.now() - new Date(gen).getTime();
    const ageH = ageMs / 3600000;
    const ok = Number.isFinite(ageH) && ageH >= 0 && ageH <= 48;
    add('6', '/teams.json: metadata.generatedAt が 48 時間以内', ok, `generatedAt=${gen} 経過 ${ageH.toFixed(1)} 時間（期待 <= 48h。超過はデイリー更新停止の兆候）`);
  } catch (e) {
    add('6', '/teams.json: metadata.generatedAt が 48 時間以内', false, `取得エラー: ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// [7] ローカル daily-update.yml の cp 行照合（journey 抜け 6 日間障害の再発防止）
// ---------------------------------------------------------------------------
function check7() {
  const REQUIRED = ['index.html', 'teams.json', 'classic.html', '_redirects', 'teams_frozen.json', 'journey.html', 'journey-engine.js', 'functions', 'data'];
  const ymlPath = path.join(__dirname, '..', '.github', 'workflows', 'daily-update.yml');
  const name = 'daily-update.yml: Prepare deploy directory の cp 行に必須 9 点が全部ある';
  try {
    const lines = fs.readFileSync(ymlPath, 'utf8').split(/\r?\n/);
    const start = lines.findIndex(l => /-\s*name:\s*Prepare deploy directory/.test(l));
    if (start === -1) {
      add('7', name, false, `「Prepare deploy directory」ステップが ${ymlPath} に見つからない`);
      return;
    }
    // ステップ本体：次の「- name:」行の直前まで
    const block = [];
    for (let i = start + 1; i < lines.length; i++) {
      if (/^\s*-\s*name:/.test(lines[i])) break;
      block.push(lines[i]);
    }
    // cp 行から「コピー元」トークンを抽出（cp [-r] <src...> <dst> の dst と -フラグを除く）
    const sources = [];
    for (const line of block) {
      const t = line.trim();
      if (!/^cp\s/.test(t)) continue;
      const toks = t.split(/\s+/).slice(1).filter(x => !x.startsWith('-'));
      sources.push(...toks.slice(0, -1)); // 最後のトークンはコピー先
    }
    const missing = REQUIRED.filter(req => !sources.includes(req));
    add('7', name, missing.length === 0,
      missing.length === 0
        ? `cp 対象 [${sources.join(', ')}] に必須 ${REQUIRED.length} 点すべて含まれる`
        : `欠落: [${missing.join(', ')}]（cp 対象は [${sources.join(', ')}]）`);
  } catch (e) {
    add('7', name, false, `読み込みエラー: ${e.message}（パス: ${ymlPath}）`);
  }
}

// ---------------------------------------------------------------------------
// メイン：1 → 2 → (3 → 4x2 → 5: puppeteer) → 6 → 7 の順に実行して集計
// ---------------------------------------------------------------------------
(async () => {
  console.log('=== verify_prod.js: 本番健全性チェック ===');
  console.log(`対象: ${BASE} / 実行時刻: ${new Date().toISOString()}`);
  console.log('');

  await check1();
  await check2();

  let browser = null;
  try {
    browser = await puppeteer.launch({ headless: 'new', args: LAUNCH_ARGS });
  } catch (e) {
    add('3', '/journey: i18n 検査', false, `puppeteer 起動失敗: ${e.message} → リポジトリ直下で npm install を実行`);
    add('4', 'トップ: 注目国グリッド検査（390/512）', false, 'puppeteer 起動失敗のためスキップ');
    add('5', '/journey 390: 試合画面レイアウト検査', false, 'puppeteer 起動失敗のためスキップ');
  }
  if (browser) {
    try {
      await check3(browser);
      await check4(browser, 390, 844);
      await check4(browser, 512, 1140);
      await check5(browser);
    } finally {
      await browser.close().catch(() => {});
    }
  }

  await check6();
  check7();

  const passCount = results.filter(r => r.pass).length;
  const total = results.length;
  console.log('');
  console.log(`PASS ${passCount}/${total}`);
  if (passCount < total) {
    console.log('→ FAIL あり。上の ❌ 行の実測値と、このファイル冒頭ヘッダ「失敗時の対処（if-then）」を参照');
  }
  process.exit(passCount === total ? 0 : 1);
})().catch(e => {
  console.error(`致命的エラー: ${e && e.stack || e}`);
  console.error('→ ネットワーク断なら時間を置いて再実行。puppeteer 系ならリポジトリ直下で npm install');
  process.exit(1);
});
