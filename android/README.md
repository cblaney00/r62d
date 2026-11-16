# R62D for Android

`build/R62D-android.apk` (~1.1 MB): the whole game, playable on the phone alone, plus joining games hosted on a computer.

- `MainActivity.java`: a full-screen landscape web view that starts on `assets/start.html`:
  - PLAY ON THIS PHONE: the game served from `https://local.r62d/` with its server running in the page (how: public/phone/README.md).
  - JOIN WITH A CODE / GAMES NEARBY: asks `/api/addr` on the last game joined, Lando's homelab (192.168.1.76:6262) and
    every address in the /24 round each of the phone's own addresses (home Wi-Fi, homelab VPN); one entry per computer.
    `?nets=127.0.0.2/24` in a desktop browser for tests.
- Game packs (he asked: phones get the rest of the game when the app opens): the app carries the game it was built with
  (`assets/game`). Each time it opens it asks the GitHub releases (cblaney00/r62d, tags `b<n>`) for `R62D-update.zip`
  (the same file the Windows program updates from); a newer one is checked (sha256 digest), unzipped into the app's
  storage and used from the next PLAY (straight away if you are on the start page). Offline: plays what it has.
- Bridge `window.r62dApp`: quit (to start page), exit, play, pack (build + update status), gameVersion, nets, version.
  Phone Back = Esc. Screen stays on. Links to GitHub open in the phone's browser.
- The first app (build 476) had no game inside and can't update itself; when it joins a computer's game, main.js asks
  once whether to download the new app (`r62d-newapp`).
- Build: `sudo -u insideabush -H env PATH="$PATH" bash android/build.sh` (tools from `sdk.nix` via Nix, a JDK from
  nixpkgs). Signing key `~insideabush/.local/share/r62d/android-release.jks`, password `r62d-android`: keep it, or
  updates won't install over the old app. `desktop/release.sh` builds and attaches it to each release.
- Not run on a real phone or emulator yet (this PC has no KVM). Tested on a computer: the start page against a server,
  and playing alone through `tests/phonehost.mjs` (free play, Quick Match with bots, the built-in game copy).
- Over plain http (joining a computer) there is no game controller (Gamepad API wants https); playing on the phone is https.
