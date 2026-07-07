<#
 deploy.ps1 — Cloudflare Pages への本番デプロイ＋本番検証をワンコマンドで実行する

 ■ 何をするか
   (1) C:/Users/11160/cloudflare_token.txt を読んで $env:CLOUDFLARE_API_TOKEN に設定（前後空白は除去）
   (2) wrangler pages deploy <リポジトリ直下> --project-name=noahsark-wc2026 --branch=main --commit-dirty=true
   (3) CDN 反映待ちで 60 秒待機
   (4) node tools/verify_prod.js で本番の健全性を検証（17 項目、詳細は verify_prod.js のヘッダ参照）
   (5) スクリプト全体の exit code は検証結果に連動（全 PASS = 0 / FAIL あり = 1）
   -VerifyOnly を付けると (1)〜(3) を飛ばして検証だけ実行する（デプロイの実弾は撃たない）

 ■ 前提
   - PowerShell 7（pwsh）
   - node v24 以上（verify_prod.js の実行に使う）
   - デプロイ時のみ：wrangler（無ければ npm i -g wrangler）と
     C:/Users/11160/cloudflare_token.txt（Cloudflare API トークンを 1 行で保存したファイル）
   - このファイルがリポジトリの tools/ にあること（親ディレクトリをデプロイ対象とみなす）

 ■ 実行コマンド
   本番デプロイ＋検証:  pwsh -File C:/Users/11160/simulator-thread/wc2026-simulator/tools/deploy.ps1
   検証のみ（安全）:    pwsh -File C:/Users/11160/simulator-thread/wc2026-simulator/tools/deploy.ps1 -VerifyOnly

 ■ 出力の読み方
   [手順] 行 … いま何をしているか
   verify_prod.js の ✅/❌ 一覧 → 最終行 "PASS x/y"（x==y なら健全）
   最後の「デプロイ＆検証 完了」または「検証 FAIL」→ exit 0 / 1

 ■ 失敗時の対処（if-then）
   - 「トークンファイルが無い」→ Cloudflare ダッシュボード（My Profile > API Tokens）で
     Pages 編集権限付きトークンを発行し、C:/Users/11160/cloudflare_token.txt に 1 行で保存する
   - 「wrangler が見つからない」→ npm i -g wrangler を実行する
   - 「node が見つからない」→ https://nodejs.org から Node.js v24 をインストールする
   - 「デプロイ失敗」→ 直前の wrangler 出力を読む。Authentication error なら
     cloudflare_token.txt を新しいトークンで作り直す
   - 検証 FAIL（PASS x/y で x<y）→ verify_prod.js ヘッダの「失敗時の対処」の該当番号に従う
#>
[CmdletBinding()]
param(
    # デプロイを飛ばして本番検証だけ走らせる（実弾を撃たない安全モード）
    [switch]$VerifyOnly
)

$ErrorActionPreference = 'Stop'

# パスはこのスクリプトの置き場所（tools/）基準で解決 → どこから呼んでも動く
$RepoRoot  = Split-Path -Parent $PSScriptRoot
$TokenFile = 'C:/Users/11160/cloudflare_token.txt'
$VerifyJs  = Join-Path $PSScriptRoot 'verify_prod.js'

# --- 0. 共通の前提チェック ---
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host '❌ node が見つからない → https://nodejs.org から Node.js v24 をインストールする'
    exit 1
}
if (-not (Test-Path $VerifyJs)) {
    Write-Host "❌ 検証スクリプトが無い: $VerifyJs → tools/verify_prod.js をリポジトリに復元する"
    exit 1
}

if ($VerifyOnly) {
    Write-Host '[手順] -VerifyOnly 指定: デプロイを飛ばして本番検証のみ実行する'
}
else {
    # --- 1. API トークンを環境変数に設定 ---
    if (-not (Test-Path $TokenFile)) {
        Write-Host "❌ トークンファイルが無い: $TokenFile"
        Write-Host '   → Cloudflare ダッシュボード（My Profile > API Tokens）で Pages 編集権限付きトークンを発行し、上記パスに 1 行で保存する'
        exit 1
    }
    $token = (Get-Content -Raw $TokenFile).Trim()
    if ([string]::IsNullOrWhiteSpace($token)) {
        Write-Host "❌ トークンファイルが空: $TokenFile → 中身に API トークン文字列を 1 行で書く"
        exit 1
    }
    $env:CLOUDFLARE_API_TOKEN = $token
    Write-Host "[手順] トークン設定完了（$($token.Length) 文字）"

    # --- 2. wrangler の存在確認 → デプロイ実行 ---
    if (-not (Get-Command wrangler -ErrorAction SilentlyContinue)) {
        Write-Host '❌ wrangler が見つからない → npm i -g wrangler を実行する'
        exit 1
    }
    Write-Host "[手順] デプロイ開始: $RepoRoot → project=noahsark-wc2026 branch=main"
    & wrangler pages deploy $RepoRoot --project-name=noahsark-wc2026 --branch=main --commit-dirty=true
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ デプロイ失敗（wrangler exit code $LASTEXITCODE）"
        Write-Host '   → 上の wrangler 出力を読む。Authentication error なら cloudflare_token.txt を新しいトークンで更新する'
        exit 1
    }
    Write-Host '[手順] デプロイ完了'

    # --- 3. CDN 反映待ち ---
    Write-Host '[手順] CDN 反映待ち 60 秒...'
    Start-Sleep -Seconds 60
}

# --- 4. 本番検証（exit code はこの結果に連動）---
Write-Host "[手順] 本番検証開始: node $VerifyJs"
& node $VerifyJs
$verifyExit = $LASTEXITCODE

if ($verifyExit -eq 0) {
    Write-Host ''
    Write-Host ($VerifyOnly ? '✅ 検証 全 PASS（デプロイは未実行）' : '✅ デプロイ＆検証 完了（全 PASS）')
}
else {
    Write-Host ''
    Write-Host "❌ 検証 FAIL（exit $verifyExit）→ 上の ❌ 行と verify_prod.js ヘッダの「失敗時の対処（if-then）」を参照する"
}
exit $verifyExit
