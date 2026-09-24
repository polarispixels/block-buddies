#!/usr/bin/env bash
# Contact sheet of character-gallery entries: color (left) + coloring-page line art (right).
# Usage: tools/gallery-sheet.sh <name> ['<query>']
#   query e.g. 'extra=../docs/characters/_batch-a.js&ids=spider,monkey&cols=2'
# Red captions flag entries that throw, draw nothing, or clip the 1000x1000 scratch space.
set -euo pipefail
cd "$(dirname "$0")/.."
NAME="${1:?usage: tools/gallery-sheet.sh <name> [query]}"; QUERY="${2:-}"
CHROME="/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"
mkdir -p shots
COLS=$(sed -n 's/.*cols=\([0-9]*\).*/\1/p' <<<"$QUERY"); COLS=${COLS:-3}
"$CHROME" --headless --disable-gpu --window-size=$((COLS*640)),2400 --virtual-time-budget=20000 \
  --screenshot="$(wslpath -w "$PWD")\\shots\\$NAME.png" \
  "file://wsl.localhost/Ubuntu$PWD/tools/gallery-sheet.html?$QUERY" >/dev/null 2>&1
echo "shots/$NAME.png"
