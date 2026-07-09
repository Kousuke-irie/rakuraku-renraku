#!/usr/bin/env bash
set -u

errors=0
warnings=0

ok() {
  printf 'OK: %s\n' "$1"
}

warn() {
  printf 'WARN: %s\n' "$1"
  warnings=$((warnings + 1))
}

fail() {
  printf 'NG: %s\n' "$1"
  errors=$((errors + 1))
}

if command -v node >/dev/null 2>&1; then
  node_version="$(node -v)"
  case "$node_version" in
    v22.*) ok "Node.js $node_version" ;;
    *) fail "Node.js は v22.x を使ってください（現在: $node_version）" ;;
  esac
else
  fail "node コマンドが見つかりません。Node.js 22 LTS をインストールしてください"
fi

if command -v npm >/dev/null 2>&1; then
  ok "npm $(npm -v)"
else
  fail "npm コマンドが見つかりません"
fi

if command -v git >/dev/null 2>&1; then
  ok "$(git --version)"
else
  fail "git コマンドが見つかりません"
fi

current_dir="$(pwd)"
path_warnings=0
case "$current_dir" in
  /mnt/[a-zA-Z]/*)
    warn "WSLのWindows側ファイルシステム配下です。ホーム直下（~/<リポジトリ名>）へ移動してください: $current_dir"
    path_warnings=$((path_warnings + 1))
    ;;
  /[a-zA-Z]/Users/*)
    warn "Git BashのWindows側パス配下です。標準はWSLのホーム直下（~/<リポジトリ名>）です: $current_dir"
    path_warnings=$((path_warnings + 1))
    ;;
esac

case "$current_dir" in
  *OneDrive*|*'iCloud Drive'*|*'Mobile Documents'*|*com~apple~CloudDocs*)
    warn "同期フォルダ配下です。ホーム直下（~/<リポジトリ名>）など同期対象外に配置してください: $current_dir"
    path_warnings=$((path_warnings + 1))
    ;;
esac

if [ "$path_warnings" -eq 0 ]; then
    ok "配置場所: $current_dir"
fi

if command -v node >/dev/null 2>&1; then
  if node -e "const net=require('net'); const s=net.createServer(); s.once('error',()=>process.exit(1)); s.once('listening',()=>s.close(()=>process.exit(0))); s.listen(3000,'127.0.0.1');" >/dev/null 2>&1; then
    ok "port 3000 is available"
  else
    warn "port 3000 は使用中です。既にアプリが起動していないか確認してください"
  fi
fi

printf '\nResult: %d error(s), %d warning(s)\n' "$errors" "$warnings"

if [ "$errors" -gt 0 ]; then
  exit 1
fi
