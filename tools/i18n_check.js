#!/usr/bin/env node
/*
 * ============================================================================
 * i18n_check.js ── journey.html 多言語整合チェッカー（静的解析、puppeteer 不要）
 * ============================================================================
 *
 * ■ 何をするか
 *   journey.html の翻訳辞書 TJ（10言語: ja/en/es/pt/fr/de/it/ko/zh/ar）と
 *   国名辞書 CN（48カ国 × 10言語）を静的に抽出・評価し、次の5項目を検査する。
 *     [1/5] キーパリティ   : 各言語のキー集合が ja と完全一致か（欠落・余剰を列挙）
 *     [2/5] プレースホルダ : {v0} {att} 等の集合が ja と各言語で一致か（欠落・過剰を列挙）。
 *                            同一値内の同じプレースホルダの重複は WARN
 *                            （TT() の replace は最初の1個しか置換しないため）
 *     [3/5] 空文字値       : "" になっている訳が無いか（文字列以外の型も検出）
 *     [4/5] CN 完全性      : NATION_NAMES の48コード × 10言語が CN に全部あるか
 *     [5/5] 生日本語スキャン: 辞書外に取り残された日本語行（未TT化候補）を WARN 列挙
 *
 * ■ 前提
 *   - Node.js（v24 で動作確認）。npm 依存なし（node:fs / node:path / node:vm のみ）
 *   - このファイルはリポジトリの tools/ に置く（../journey.html を相対で読む）
 *   - journey.html に「const TJ = {」「const CN = {」「const NATION_NAMES = {」が
 *     この綴りで存在すること（波括弧の対応で切り出すので中身の書式は自由）
 *
 * ■ 実行コマンド（リポジトリ root から）
 *     node tools/i18n_check.js
 *   （テスト用の任意引数: node tools/i18n_check.js <別のhtmlパス> で対象を差し替え可能。
 *     壊したコピーに対して FAIL 検出が働くかの自己テストに使う。通常運用では引数なし）
 *
 * ■ 出力の読み方
 *   - 各項目の先頭に [1/5]〜[5/5]、結果は PASS / FAIL / WARN
 *   - FAIL には「言語: キー名」形式で欠落・余剰を列挙する
 *   - [5/5] の WARN は「L<行番号>: <行の内容>」形式。未TT化の"候補"であり、
 *     地名・固有名詞など意図的な日本語も混ざりうる（人間が目視で判断する）
 *   - 最終行に「総合判定: GREEN / RED」と exit code を表示
 *
 * ■ 終了コード
 *   - 0 : [1/5]〜[4/5] が全て PASS（[5/5] の WARN があっても 0）
 *   - 1 : [1/5]〜[4/5] のどれかが FAIL、または辞書の抽出・評価に失敗
 *
 * ■ 失敗時の対処（if-then）
 *   - if「journey.html が見つからない」→ then リポジトリ root で実行しているか確認。
 *     tools/ の中から実行しても動く（__dirname 基準）が、ファイル移動していたら
 *     下の HTML_PATH を実際の場所に直す
 *   - if「const TJ = { が見つからない」→ then journey.html 側で辞書の宣言の綴りが
 *     変わっている。grep "const TJ" journey.html で現状を確認し、下の
 *     extractDict() 呼び出しの変数名を合わせる
 *   - if [1/5] FAIL（キー欠落）→ then journey.html の TJ の該当言語ブロックに
 *     そのキーを追加する。訳文は ja の値と他言語の既存訳のトーンに合わせる。
 *     追加したら本スクリプトを再実行して PASS を確認する
 *   - if [1/5] FAIL（キー余剰）→ then その言語だけにあるキーは typo か消し忘れ。
 *     ja に無いキーは TT() から参照されない（ja がフォールバック元）ので削除する
 *   - if [2/5] FAIL → then 該当言語の該当キーの訳文に、ja と同じプレースホルダ
 *     （{v0} 等、綴りも大小文字も同一）を入れる。過剰側は余分な {xx} を消す
 *   - if [3/5] FAIL → then 空文字 "" の訳を実際の訳文で埋める
 *   - if [4/5] FAIL → then CN に欠けている国コード or 言語の訳を追加する
 *     （書式は既存行に合わせる: CODE: {ja:'…',en:'…',…}）
 *   - if [5/5] WARN → then 列挙された行を目視確認。UI に出る文言なら TJ にキーを
 *     作って TT() / data-i18n に置き換える。地名・コメント等の意図的な日本語なら放置可
 * ============================================================================
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// ---------------------------------------------------------------------------
// 設定（固定値）
// ---------------------------------------------------------------------------
// 検査対象: 引数なし → ../journey.html（通常運用）、引数あり → そのパス（自己テスト用）
const HTML_PATH = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(__dirname, '..', 'journey.html');
const LANGS = ['ja', 'en', 'es', 'pt', 'fr', 'de', 'it', 'ko', 'zh', 'ar']; // 10言語（ja が基準）
const EXPECTED_NATION_COUNT = 48; // W杯2026 出場国数
const PLACEHOLDER_RE = /\{[A-Za-z_][A-Za-z0-9_]*\}/g; // {v0} {att} {score} 等
const JP_CHAR_RE = /[ぁ-んァ-ヶ]/; // ひらがな・カタカナ（漢字は中国語と衝突するので対象外）

// ---------------------------------------------------------------------------
// 抽出部: 「const 名前 = {」から波括弧の深さを数えて対応する閉じまで切り出す。
// 値の文字列に { } を含む（例: "{v0} 試合"）ため正規表現では切れない。
// 文字列リテラル（' " `）・エスケープ・コメント（// と /* */）の中の波括弧は
// 数えないトークナイザ方式で走査する。
// ---------------------------------------------------------------------------

/**
 * openIdx（'{' の位置）から対応する '}' までを切り出す。
 * @returns {{ text: string, endIdx: number }} text は '{'〜'}' を含む部分文字列
 */
function sliceBalanced(src, openIdx) {
  let depth = 0;
  let inStr = null;   // 文字列内なら引用符文字（' " `）、外なら null
  let esc = false;    // 直前がバックスラッシュか
  let inLC = false;   // 行コメント // の中か
  let inBC = false;   // ブロックコメント /* */ の中か
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];
    if (inLC) { if (ch === '\n') inLC = false; continue; }
    if (inBC) { if (ch === '*' && next === '/') { inBC = false; i++; } continue; }
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
    if (ch === '/' && next === '/') { inLC = true; i++; continue; }
    if (ch === '/' && next === '*') { inBC = true; i++; continue; }
    if (ch === '{') { depth++; continue; }
    if (ch === '}') {
      depth--;
      if (depth === 0) return { text: src.slice(openIdx, i + 1), endIdx: i };
    }
  }
  throw new Error('対応する閉じ波括弧が見つからない（openIdx=' + openIdx + '）');
}

/** 文字位置 → 1始まりの行番号 */
function lineOf(src, idx) {
  let n = 1;
  for (let i = 0; i < idx; i++) if (src[i] === '\n') n++;
  return n;
}

/**
 * 「const <name> = {」を探してオブジェクトを評価して返す。
 * @returns {{ obj: object, startLine: number, endLine: number }}
 */
function extractDict(src, name) {
  const m = new RegExp('const\\s+' + name + '\\s*=\\s*\\{').exec(src);
  if (!m) throw new Error('「const ' + name + ' = {」が journey.html に見つからない');
  const openIdx = m.index + m[0].length - 1; // '{' の位置
  const { text, endIdx } = sliceBalanced(src, openIdx);
  let obj;
  try {
    // 素のオブジェクトリテラルとして評価（グローバル無しのサンドボックス）
    obj = vm.runInNewContext('(' + text + ')', Object.create(null), { timeout: 5000 });
  } catch (e) {
    throw new Error(name + ' の評価に失敗: ' + e.message);
  }
  return { obj, startLine: lineOf(src, m.index), endLine: lineOf(src, endIdx) };
}

// ---------------------------------------------------------------------------
// 検査部
// ---------------------------------------------------------------------------

/** 値からプレースホルダ集合を作る */
function placeholdersOf(value) {
  const set = new Set();
  if (typeof value !== 'string') return set;
  const found = value.match(PLACEHOLDER_RE);
  if (found) found.forEach(p => set.add(p));
  return set;
}

/** Set の差（a - b）を配列で返す */
function diff(a, b) {
  return [...a].filter(x => !b.has(x));
}

function main() {
  let errorCount = 0; // [1/5]〜[4/5] の FAIL 件数
  let warnCount = 0;  // [5/5] の WARN 件数
  const log = (s) => console.log(s);

  // --- 読み込みと抽出 ---
  if (!fs.existsSync(HTML_PATH)) {
    console.error('ERROR: journey.html が見つからない: ' + HTML_PATH);
    process.exit(1);
  }
  const src = fs.readFileSync(HTML_PATH, 'utf8');
  let TJ, CN, NN;
  try {
    TJ = extractDict(src, 'TJ');
    CN = extractDict(src, 'CN');
    NN = extractDict(src, 'NATION_NAMES');
  } catch (e) {
    console.error('ERROR: 辞書の抽出に失敗 ── ' + e.message);
    process.exit(1);
  }
  log('対象: ' + HTML_PATH);
  log('抽出: TJ L' + TJ.startLine + '-L' + TJ.endLine +
      ' / NATION_NAMES L' + NN.startLine + '-L' + NN.endLine +
      ' / CN L' + CN.startLine + '-L' + CN.endLine);

  const tj = TJ.obj;
  const cn = CN.obj;
  const nationCodes = Object.keys(NN.obj);

  // --- [1/5] キーパリティ ---
  log('');
  log('[1/5] キーパリティ（各言語のキー集合 = ja と完全一致か）');
  const tjLangs = Object.keys(tj);
  const missingLangs = LANGS.filter(l => !tjLangs.includes(l));
  const extraLangs = tjLangs.filter(l => !LANGS.includes(l));
  if (missingLangs.length) { errorCount++; log('  FAIL: TJ に言語ブロックごと欠落: ' + missingLangs.join(', ')); }
  if (extraLangs.length) { errorCount++; log('  FAIL: TJ に想定外の言語ブロック: ' + extraLangs.join(', ')); }
  if (!tj.ja) {
    errorCount++;
    log('  FAIL: 基準言語 ja が無いため以降のキー比較は不能');
  } else {
    const jaKeys = new Set(Object.keys(tj.ja));
    log('  ja のキー数: ' + jaKeys.size);
    let parityOk = true;
    for (const lang of LANGS) {
      if (lang === 'ja' || !tj[lang]) continue;
      const keys = new Set(Object.keys(tj[lang]));
      const missing = diff(jaKeys, keys); // ja にあってこの言語に無い
      const extra = diff(keys, jaKeys);   // この言語だけにある
      if (missing.length) {
        errorCount++; parityOk = false;
        log('  FAIL: ' + lang + ' に欠落キー ' + missing.length + ' 件: ' + missing.join(', '));
      }
      if (extra.length) {
        errorCount++; parityOk = false;
        log('  FAIL: ' + lang + ' に余剰キー ' + extra.length + ' 件: ' + extra.join(', '));
      }
    }
    if (parityOk && !missingLangs.length && !extraLangs.length) {
      log('  PASS: 10言語すべて ja と同じキー集合（' + jaKeys.size + ' キー × ' + tjLangs.length + ' 言語）');
    }

    // --- [2/5] プレースホルダ ---
    log('');
    log('[2/5] プレースホルダ（{v0} {att} 等の集合が ja と一致か）');
    let phOk = true;
    let phKeyCount = 0;
    // 重複検出: TT() の replace は「最初の1個」しか置換しないため、
    // 同じプレースホルダが1つの値に2回以上あると2個目以降が画面に残る（WARN）
    const dupWarn = (lang, key, value) => {
      if (typeof value !== 'string') return;
      const all = value.match(PLACEHOLDER_RE) || [];
      const seen = new Set();
      for (const p of all) {
        if (seen.has(p)) {
          warnCount++;
          log('  WARN: ' + lang + ': ' + key + ' に ' + p + ' が複数回（TT は最初の1個しか置換しない）');
          return;
        }
        seen.add(p);
      }
    };
    for (const key of jaKeys) {
      const jaSet = placeholdersOf(tj.ja[key]);
      if (jaSet.size > 0) phKeyCount++;
      dupWarn('ja', key, tj.ja[key]);
      for (const lang of LANGS) {
        if (lang === 'ja' || !tj[lang]) continue;
        if (!(key in tj[lang])) continue; // 欠落キーは [1/5] で報告済み
        const langSet = placeholdersOf(tj[lang][key]);
        dupWarn(lang, key, tj[lang][key]);
        const missing = diff(jaSet, langSet);
        const extra = diff(langSet, jaSet);
        if (missing.length) {
          errorCount++; phOk = false;
          log('  FAIL: ' + lang + ': ' + key + ' に欠落プレースホルダ: ' + missing.join(' '));
        }
        if (extra.length) {
          errorCount++; phOk = false;
          log('  FAIL: ' + lang + ': ' + key + ' に過剰プレースホルダ: ' + extra.join(' '));
        }
      }
    }
    if (phOk) log('  PASS: プレースホルダ付き ' + phKeyCount + ' キーすべて全言語で集合一致');

    // --- [3/5] 空文字値 ---
    log('');
    log('[3/5] 空文字値（"" の訳・文字列以外の型が無いか）');
    let emptyOk = true;
    for (const lang of tjLangs) {
      for (const [key, val] of Object.entries(tj[lang])) {
        if (typeof val !== 'string') {
          errorCount++; emptyOk = false;
          log('  FAIL: ' + lang + ': ' + key + ' の値が文字列でない（' + typeof val + '）');
        } else if (val === '') {
          errorCount++; emptyOk = false;
          log('  FAIL: ' + lang + ': ' + key + ' が空文字');
        }
      }
    }
    if (emptyOk) log('  PASS: 空文字・型不正なし');
  }

  // --- [4/5] CN 完全性 ---
  log('');
  log('[4/5] CN 完全性（' + EXPECTED_NATION_COUNT + 'コード × 10言語）');
  let cnOk = true;
  if (nationCodes.length !== EXPECTED_NATION_COUNT) {
    errorCount++; cnOk = false;
    log('  FAIL: NATION_NAMES のコード数が ' + nationCodes.length + '（期待 ' + EXPECTED_NATION_COUNT + '）');
  }
  for (const code of nationCodes) {
    if (!cn[code]) {
      errorCount++; cnOk = false;
      log('  FAIL: CN に国コードごと欠落: ' + code);
      continue;
    }
    const missing = LANGS.filter(l => typeof cn[code][l] !== 'string' || cn[code][l] === '');
    if (missing.length) {
      errorCount++; cnOk = false;
      log('  FAIL: CN.' + code + ' に言語欠落: ' + missing.join(', '));
    }
  }
  const cnExtra = Object.keys(cn).filter(c => !nationCodes.includes(c));
  if (cnExtra.length) {
    warnCount++;
    log('  WARN: CN に NATION_NAMES 外のコード（未使用の可能性）: ' + cnExtra.join(', '));
  }
  if (cnOk) log('  PASS: ' + nationCodes.length + 'コード × ' + LANGS.length + '言語 完全');

  // --- [5/5] 生日本語スキャン ---
  log('');
  log('[5/5] 生日本語スキャン（辞書外の未TT化候補、WARN のみ・exit code に影響しない）');
  // 除外ブロック: TJ / CN / NATION_NAMES の行範囲
  const blocks = [
    [TJ.startLine, TJ.endLine],
    [CN.startLine, CN.endLine],
    [NN.startLine, NN.endLine],
  ];
  const inBlock = (n) => blocks.some(([s, e]) => n >= s && n <= e);
  const lines = src.split('\n');
  const rawJpWarns = [];
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const line = lines[i];
    const jpMatch = JP_CHAR_RE.exec(line);
    if (!jpMatch) continue;                       // 日本語なし
    if (inBlock(lineNo)) continue;                // (a) 辞書ブロック内
    if (line.includes('console.')) continue;      // (c) console 出力（デバッグ用）
    if (line.includes('data-i18n=')) continue;    // (d) applyLanguageJ が差し替える fallback
    if (line.includes('TT(')) continue;           // (e) TT() でキー参照している行
    // (b) コメント行の判定（2通り）:
    //   b-1: トリム後の行頭が // か /* か * か <!--
    //   b-2: 行内の // または <!-- より後ろで初めて日本語が出る（行末コメント）
    const trimmed = line.trim();
    if (/^(\/\/|\/\*|\*|<!--)/.test(trimmed)) continue;
    const jpIdx = jpMatch.index;
    const lcIdx = line.indexOf('//');
    const hcIdx = line.indexOf('<!--');
    if (lcIdx !== -1 && jpIdx > lcIdx) continue;
    if (hcIdx !== -1 && jpIdx > hcIdx) continue;
    rawJpWarns.push({ lineNo, text: trimmed.length > 100 ? trimmed.slice(0, 100) + '…' : trimmed });
  }
  if (rawJpWarns.length) {
    warnCount += rawJpWarns.length;
    log('  WARN: ' + rawJpWarns.length + ' 行に辞書外の日本語（目視確認の対象）:');
    rawJpWarns.forEach(w => log('    L' + w.lineNo + ': ' + w.text));
  } else {
    log('  PASS: 辞書外の生日本語なし');
  }

  // --- 総合判定 ---
  log('');
  if (errorCount > 0) {
    log('総合判定: RED ── FAIL ' + errorCount + ' 件（WARN ' + warnCount + ' 件） → exit 1');
    process.exit(1);
  }
  log('総合判定: GREEN ── FAIL 0 件 / WARN ' + warnCount + ' 件 → exit 0');
  process.exit(0);
}

main();
