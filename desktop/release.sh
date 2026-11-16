#!/usr/bin/env bash
# Releases the current game to everyone with the R62D program: builds it (desktop/build.sh) and puts a GitHub release
# b<build number> on cblaney00/r62d with the full download and the small update. Programs already out there fetch the
# update the next time they open (desktop/updates.js). Run as insideabush (gh is logged in as him), after pushing main.
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")/.."
[ -z "$(git status --porcelain)" ] || { echo "Commit everything first: the release is built from the last commit."; exit 1; }
bash desktop/build.sh
bash android/build.sh   # the Android app goes in the same release (R62D-android.apk)
n=$(git rev-list --count HEAD); ver=$(git log -1 --format=%h); date=$(git log -1 --format=%cs)
gh release create "b$n" --repo cblaney00/r62d --target "$(git rev-parse HEAD)" --latest \
  --title "R62D for Windows and Android · build $n ($date)" \
  --notes "New here? Download **R62D-windows.zip**, unzip it anywhere and double-click **R62D.exe** in the R62D folder. If Windows says it protected your PC, click More info, then Run anyway. HOST starts a game on your computer (click Allow if Windows asks about the firewall); friends click JOIN and type the address shown in your lobby. F11 switches between full screen and a window.

Already have R62D? Just open it: it updates itself to this version (game version $ver).

Android phone? Download **R62D-android.apk** on the phone and open it (allow installing from your browser if Android asks). It joins games hosted on a computer on your home Wi-Fi or Lando's VPN." \
  build/R62D-windows.zip build/R62D-update.zip build/R62D-android.apk
echo "Released build $n"
