# Playing on a phone with no computer (the Android app)

He asked (2026-11-16): the Android app should be the whole game, playable without a computer hosting. The game's own
server code runs inside the app's web view, in the same page as the game:

- The app (android/src/.../MainActivity.java) serves the game's files from `https://local.r62d/` (intercepted, never on
  the network): `/server/*` and `/shared/*` from the pack's root, everything else from `public/`. While serving it
  rewrites `/server/*.js`: `from 'node:x'` → `from '/phone/node/x.js'`, `process.env` → `__PENV`, `.unref()` removed;
  and puts `<script src="/phone/shim.js">` first in index.html. `tests/phonehost.mjs` does exactly the same on a computer.
- `shim.js` replaces the page's WebSocket and `/api/` fetches with calls into `server.js` (loaded the first time), which
  runs the usual `Game` loop (lobby, free play, tutorials, Esports TV) and answers the menus' `/api/` calls.
- `node/*.js` stand in for Node: `fs` keeps files in localStorage (`r62dfs:<path>`; profiles, match history, practice
  numbers), `path`, `url`, `crypto` (random ids, a fingerprint), `zlib` (replays are off on a phone: too big).
- Not on a phone: hosting friends, replays, pro practice, the TRAIN button. The pros play with what they knew at the release: android/build.sh packs a copy of his pros' knowledge as `server/pro-seed.json` (also in the Windows update pack), loaded by `seedTraining` when it has more practice than the phone.
- If a server file starts using another Node module, add a stand-in here, or the phone fails to start a match.
- The app runs a pack whose `desktop/build.json` has `android` ≤ its APP_LEVEL (`ANDROID` in desktop/build.sh). Raise
  both together when the app must change for a new pack; older apps then show "get the new app".
