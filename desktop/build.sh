#!/usr/bin/env bash
# Builds the Windows program: build/R62D/R62D.exe (+ the files it needs), build/R62D-windows.zip (the full download)
# and build/R62D-update.zip (only the game files, fetched by programs already out there: desktop/updates.js).
# Needs internet the first time (Electron for Windows from GitHub, kept in build/cache), 7z, node and magick.
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")/.."
EV=v45.2.2                 # Electron version
C=build/cache; OUT=build/R62D; mkdir -p "$C"

get() { [ -s "$C/$2" ] || curl -fsSL -o "$C/$2" "$1"; }
get "https://github.com/electron/electron/releases/download/$EV/electron-$EV-win32-x64.zip" "electron-$EV-win32-x64.zip"
get "https://github.com/electron/electron/releases/download/$EV/SHASUMS256.txt" "SHASUMS256-$EV.txt"
want=$(grep " \*electron-$EV-win32-x64.zip$" "$C/SHASUMS256-$EV.txt" | cut -d' ' -f1)
have=$(sha256sum "$C/electron-$EV-win32-x64.zip" | cut -d' ' -f1)
[ "$want" = "$have" ] || { echo "Electron download is damaged (checksum differs)"; exit 1; }

rm -rf "$OUT" build/R62D-windows.zip build/R62D-update.zip; mkdir -p "$OUT"
7z x -y -bso0 -bsp0 -o"$OUT" "$C/electron-$EV-win32-x64.zip"
mv "$OUT/electron.exe" "$OUT/R62D.exe"
node desktop/seticon.mjs "$OUT/R62D.exe" desktop/icon.png > /dev/null   # our icon on the .exe
rm -f "$OUT/resources/default_app.asar"

APP="$OUT/resources/app"; mkdir -p "$APP"
cp -r server shared public desktop "$APP/"
rm -f "$APP/desktop/build.sh" "$APP/desktop/release.sh" "$APP/desktop/seticon.mjs"
cat > "$APP/package.json" <<'EOF'
{ "name": "r62d", "productName": "R62D", "type": "module", "main": "desktop/main.js" }
EOF
ver=$(git log -1 --format=%h); date=$(git log -1 --format=%cs); n=$(git rev-list --count HEAD)   # n: build number, only ever grows
echo "{ \"version\": \"$ver\", \"date\": \"$date\", \"n\": $n, \"electron\": \"${EV#v}\" }" > "$APP/desktop/build.json"


(cd build && 7z a -tzip -mx=7 -bso0 -bsp0 R62D-windows.zip R62D)
(cd "$APP" && 7z a -tzip -mm=Deflate -mx=9 -bso0 -bsp0 "$PWD/../../../R62D-update.zip" .)
echo "Built build/R62D-windows.zip ($(du -h build/R62D-windows.zip | cut -f1)) and build/R62D-update.zip ($(du -h build/R62D-update.zip | cut -f1)), version $ver, build $n"
