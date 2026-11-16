# R62D for Android

A small app (`build/R62D-android.apk`, ~70 KB) that joins R62D games hosted on a computer. Phones can't host.

- `MainActivity.java`: a full-screen landscape web view. It shows itself to the page as `window.r62dApp` (like the
  Windows program), so main.js treats it as an app: QUIT returns to the start page, download links are hidden.
  Phone Back = Esc. Screen stays on. Links to GitHub open in the phone's browser.
- `assets/start.html`: JOIN WITH A CODE (shared/joincode.js is pasted in at build time) and GAMES NEARBY: asks
  `/api/addr` on the last game joined, Lando's homelab (192.168.1.76:6262), and every address in the /24 round each of
  the phone's own addresses (home Wi-Fi, the homelab VPN). One entry per computer. In a desktop browser it takes
  `?nets=127.0.0.2/24` instead of the app's list (for tests).
- The game itself always comes from the host, so the app only needs a new version when this folder changes.
- Build: `sudo -u insideabush -H env PATH="$PATH" bash android/build.sh` (tools from `sdk.nix` via Nix, a JDK from
  nixpkgs). The signing key is `~insideabush/.local/share/r62d/android-release.jks`, password `r62d-android`:
  keep it, or updates won't install over the old app. `desktop/release.sh` builds and attaches it to each release.
- Not tested on a real phone or emulator yet (this PC has no KVM): tested the start page in Firefox against a server.
- Over plain http the browser has no game controller access (Gamepad API needs https); touch controls work.
