#!/usr/bin/env bash
# Builds the Windows program: build/R62D/R62D.exe (+ the files it needs) and build/R62D-windows.zip.
# Needs internet the first time (Electron for Windows from GitHub, kept in build/cache) and 7z.
# The window and taskbar use desktop/icon.png; the .exe file itself still shows Electron's icon in Explorer.
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

rm -rf "$OUT" build/R62D-windows.zip; mkdir -p "$OUT"
7z x -y -bso0 -bsp0 -o"$OUT" "$C/electron-$EV-win32-x64.zip"
mv "$OUT/electron.exe" "$OUT/R62D.exe"
rm -f "$OUT/resources/default_app.asar"

APP="$OUT/resources/app"; mkdir -p "$APP"
cp -r server shared public desktop "$APP/"
rm -f "$APP/desktop/build.sh"
cat > "$APP/package.json" <<'EOF'
{ "name": "r62d", "productName": "R62D", "type": "module", "main": "desktop/main.js" }
EOF
ver=$(git log -1 --format=%h); date=$(git log -1 --format=%cs)
echo "{ \"version\": \"$ver\", \"date\": \"$date\" }" > "$APP/desktop/build.json"


(cd build && 7z a -tzip -mx=7 -bso0 -bsp0 R62D-windows.zip R62D)
echo "Built build/R62D-windows.zip ($(du -h build/R62D-windows.zip | cut -f1)), version $ver"
