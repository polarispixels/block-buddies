#!/usr/bin/env bash
# Render the game in real headless Chrome (Windows-side, via WSL interop) and
# capture a screenshot of any game state.
#
# Usage: tools/screenshot.sh <name> '<js-hook>'
#
# The js-hook runs ~0.8s after load with a `step(n, fn?)` helper that advances
# the game clock deterministically (n frames of 1/60s); call render() happens
# automatically afterwards. Output lands in shots/<name>.png.
#
# Examples:
#   tools/screenshot.sh title ''
#   tools/screenshot.sh lava 'game.startLevel(6); game.introT=99; step(60);'
#   tools/screenshot.sh fly 'game.startLevel(8); game.introT=99; step(5);
#     game.player.boardUnicorn(); step(30,()=>{keys.ArrowRight=true;});'
#
# Requires Windows Chrome at the default path (checked below). The Linux-side
# Playwright Chromium is broken on this machine (missing libnspr4).
set -euo pipefail
cd "$(dirname "$0")/.."
NAME="${1:?usage: tools/screenshot.sh <name> '<js-hook>'}"
HOOK="${2:-}"
CHROME="/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"
[ -x "$CHROME" ] || { echo "Chrome not found at $CHROME"; exit 1; }
mkdir -p shots
TMP="_shot_$NAME.html"
cat > "$TMP" <<EOF
<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#241a45;overflow:hidden}</style></head>
<body><canvas id="game" width="1280" height="720"></canvas>
<script src="js/util.js"></script><script src="js/audio.js"></script><script src="js/particles.js"></script>
<script src="js/entities.js"></script><script src="js/puzzleblocks.js"></script><script src="js/ride.js"></script><script src="js/beams.js"></script><script src="js/flowerart.js"></script><script src="js/flowerscene.js"></script><script src="js/flowerland.js"></script><script src="js/surfart.js"></script><script src="js/surf.js"></script><script src="js/levels.js"></script><script src="js/game.js"></script>
<script>setTimeout(()=>{ const step=(n,fn)=>{for(let i=0;i<n;i++){if(fn)fn(i);update(1/60);}}; $HOOK render(); },800);</script>
</body></html>
EOF
"$CHROME" --headless --disable-gpu --window-size=1280,720 --virtual-time-budget=6000 \
  --screenshot="$(wslpath -w "$PWD")\\shots\\$NAME.png" \
  "file://wsl.localhost/Ubuntu$PWD/$TMP" >/dev/null 2>&1
rm -f "$TMP"
echo "shots/$NAME.png"
