#!/bin/bash
# Checks that play/js/core.js generates the same boards as the game: every stage of every challenge in the three
# languages, and some custom games, against the game's tools/PrintPuzzle. macOS (jsc), with the game's repository
# at ../mega-word-search-game or the path given, and .NET.
#   tools/check-generator.sh [path to the game's repository]
set -u
cd "$(dirname "$0")/.."
GAME="${1:-../mega-word-search-game}"
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc
export PATH="$HOME/.dotnet:$PATH"
dotnet build "$GAME/tools/PrintPuzzle" -v q -nologo > /dev/null || exit 1
PRINT=$(ls "$GAME"/tools/PrintPuzzle/bin/Debug/*/PrintPuzzle.dll | head -1)

failed=0
total=0
# The board, the words placed and the Worditto, from PrintPuzzle's output.
expected() {
  dotnet "$PRINT" "$@" | awk '
    /^[0-9]+x[0-9]+, / { split($2, n, ","); print n[1] " words"; state = 1; next }
    state == 1 { state = 2; next }
    state == 2 { if ($0 == "") state = 3; else print }
    /^Worditto:/ { cells = $0; sub(/^[^(]*/, "", cells); print "Worditto: " cells }'
}
check() {
  local name="$1" js="$2"; shift 2
  total=$((total + 1))
  if ! diff <(expected "$@") <($JSC -m tools/print-puzzle.mjs -- $js) > /dev/null; then
    echo "DIFFERENT: $name"
    failed=$((failed + 1))
  fi
}

for language in es en de; do
  worlds=$(python3 -c "import json; print(' '.join(str(len(w['stages'])) for w in json.load(open('play/content/worlds.json'))['worlds']))")
  w=0
  for count in $worlds; do
    w=$((w + 1))
    for s in $(seq 1 "$count"); do
      check "$language $w-$s" "$language world $w $s" --language "$language" --world "$w" --stage "$s"
    done
  done
done
check "custom all" "es custom 40 40 30 All 123456" --width 40 --height 40 --words 30 --shapes All --seed 123456
check "custom de" "de custom 60 60 50 Straight,Diagonals,Reversed 987654 frutas,colores" --language de --width 60 --height 60 --words 50 --categories frutas,colores --shapes Straight,Diagonals,Reversed --seed 987654
check "custom symbols" "es custom 20 20 12 Horizontal,Vertical,SnakeOrthogonal 555555 - symbols:#1" --width 20 --height 20 --words 12 --shapes Horizontal,Vertical,SnakeOrthogonal --board symbols:●■▲◆★ --seed 555555
check "custom en snakes" "en custom 80 80 98 Snake,Horizontal -42" --language en --width 80 --height 80 --words 98 --shapes Snake,Horizontal --seed -42
echo "$((total - failed))/$total boards are the same"
[ "$failed" -eq 0 ]
