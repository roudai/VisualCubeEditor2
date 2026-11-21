#!/usr/bin/env bash
# USB でつないだ Android の Chrome で、ローカルのサイトを開く（実機で確かめるため）。
#   tools/android.sh [--demo] [ページ]
#     --demo  テストデータで動かす（tools/serve.js --demo。ポート 8001）。付けなければ普段のデータ（ポート 8000）
#     ページ  開くページ（例：practice?set=full、stats）。既定は practice
#   例：tools/android.sh --demo 'practice?set=full'
#       （zsh では ? が特別な意味になるので、? を含むページは '' で囲む）
#
# することは 3 つ：
#   1. tools/serve.js を起動する（そのポートでもう動いていれば、それを使う）
#   2. adb reverse で、Android の localhost:<ポート> を Mac のサーバーにつなぐ（USB 経由。Wi-Fi は使わない）
#   3. Android の Chrome でページを開く
# Ctrl+C で、このスクリプトが起動したサーバーを止め、adb reverse も外す。
# 端末を 2 つ以上つないでいるときは ANDROID_SERIAL=<adb devices の番号> を付けて実行する。
# USB を抜き差ししたら、もう一度実行する（adb reverse が消えるため）。
set -euo pipefail

cd "$(dirname "$0")/.."

DEMO=''
PAGE='practice'
for arg in "$@"; do
  case "$arg" in
    --demo) DEMO='--demo' ;;
    -h | --help)
      sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) PAGE="${arg#/}" ;;
  esac
done
PORT=$([ -n "$DEMO" ] && echo 8001 || echo 8000)
URL="http://localhost:$PORT/$PAGE"

# adb：パスに無ければ Android Studio の SDK の場所を探す
ADB=$(command -v adb || true)
if [ -z "$ADB" ]; then
  for dir in "${ANDROID_HOME:-}" "${ANDROID_SDK_ROOT:-}" "$HOME/Library/Android/sdk"; do
    if [ -n "$dir" ] && [ -x "$dir/platform-tools/adb" ]; then
      ADB="$dir/platform-tools/adb"
      break
    fi
  done
fi
if [ -z "$ADB" ]; then
  echo 'adb が見つかりません。Android Studio の SDK Platform-Tools を入れてください。' >&2
  exit 1
fi

# 端末がつながっているか（「device」の行。unauthorized は端末側で USB デバッグを許可していない）
DEVICES=$("$ADB" devices | awk 'NR > 1 && $2 == "device" { print $1 }')
if [ -z "${ANDROID_SERIAL:-}" ]; then
  COUNT=$(printf '%s' "$DEVICES" | grep -c . || true)
  if [ "$COUNT" -eq 0 ]; then
    echo 'Android がつながっていません。USB でつなぎ、端末で「USB デバッグを許可」を選んでください。' >&2
    "$ADB" devices >&2
    exit 1
  fi
  if [ "$COUNT" -gt 1 ]; then
    echo "端末が ${COUNT} 台つながっています。ANDROID_SERIAL=<番号> を付けて実行してください：" >&2
    printf '%s\n' "$DEVICES" >&2
    exit 1
  fi
fi

# 1. サーバー（そのポートでもう動いていれば使う）
# 日本語の文字のすぐ前の変数は ${PORT} のように {} で囲む（囲まないと bash が文字のバイトまで変数名として読むことがある）
SERVER_PID=''
REVERSED=''
cleanup() {
  # このスクリプトがつないだ・起動したものだけを外す（前から動いていたものは残す）
  if [ -n "$REVERSED" ]; then
    "$ADB" reverse --remove "tcp:$PORT" >/dev/null 2>&1 || true
  fi
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT
trap 'exit 130' INT TERM

up() { curl -s -o /dev/null --max-time 1 "http://localhost:$PORT/"; }
if up; then
  echo "サーバーはもう動いています（ポート ${PORT}）。それを使います。"
else
  node tools/serve.js $DEMO "$PORT" &
  SERVER_PID=$!
  for _ in $(seq 1 50); do
    up && break
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
      echo 'サーバーを起動できませんでした。' >&2
      exit 1
    fi
    sleep 0.1
  done
  up || { echo 'サーバーが応答しません。' >&2; exit 1; }
fi

# 2. Android の localhost を Mac のサーバーにつなぐ
"$ADB" reverse "tcp:$PORT" "tcp:$PORT" >/dev/null
[ -n "$SERVER_PID" ] && REVERSED=1

# 3. Chrome で開く
"$ADB" shell am start -a android.intent.action.VIEW -d "$URL" com.android.chrome >/dev/null
echo "Android の Chrome で開きました：${URL}"

if [ -n "$SERVER_PID" ]; then
  echo '止めるときは Ctrl+C'
  wait "$SERVER_PID"
else
  # サーバーは別に動いているので、つなぐだけで終わる（adb reverse は残す）
  trap - EXIT
fi
