# Testing R62D

## Headless rules test
`nix develop /home/insideabush/nixos-config#vibe-web --command node tests/sim.js`
Plays 10 bots through a full match (25 sim-minutes max). Prints each round's winner and PASS.
`--map` prints the map as ASCII (`=` soft wall, `#` hard, `O` door/window, `T` tall prop, `l` low prop).

## Screenshots in a real browser
1. Start the server in quick mode: `R62D_FAST=1 node server/server.js` (in the dev shell, background).
2. Firefox must run **as insideabush**, never root, with a profile dir he can read
   (e.g. `runuser -u insideabush -- mktemp -d /tmp/r62d-ff.XXXX`):
   `runuser -u insideabush -- firefox --headless --no-remote --profile <dir> --remote-debugging-port 9333 &`
3. `node tests/shoot.mjs 9333 <outdir> <steps.json>` — steps are
   `{"url":..}`, `{"js": "...", "wait": ms, "shot": "name"}`. Keys/mouse are simulated by
   dispatching `KeyboardEvent` on `window` and `MouseEvent` on `#game`. A Firefox instance only
   allows one BiDi session, so restart Firefox for each run.
- `play.sh` on another computer: clone it with a throwaway `HOME` and `PORT`, `MOZ_HEADLESS=1`, run as insideabush with `env -i` and a chosen `PATH`.
- Shortcut for this app lives in ~/.local/share/applications/r62d.desktop and ~/Desktop/R62D.desktop, both running play.sh (starts server if needed, opens Firefox).
- Placing people for a screenshot: with the server in quick mode (`R62D_FAST=1`), in Free Play send
  `__r62d.st.ws.send(JSON.stringify({t:'free', a:'tp', x, y, id?, aim?, hold?}))` — moves you (or a bot by `id`;
  `hold: 1` freezes that bot). Set `localStorage['r62d-aim']='cursor'` before joining and dispatch `mousemove` on
  the window to aim. `import('/shared/map.js')` gives helpers such as `stairEnds(map, i)` for spots.

## Playing as a phone (simulated thumbs)
`tests/thumbs.mjs` drives Firefox with real touch events (WebDriver BiDi `input.performActions`, pointerType touch,
several fingers at once) at 914×412 and prints position / aim / shots after each move:
1. Fast server on a spare port with throwaway data: `R62D_FAST=1 PORT=6263 R62D_DATA=<tmp> node server/server.js`.
2. A Firefox profile (made as insideabush) whose `user.js` has
   `user_pref("general.useragent.override", "Mozilla/5.0 (Android 14; Mobile; rv:133.0) Gecko/133.0 Firefox/133.0");` and
   `user_pref("dom.w3c_touch_events.enabled", 1);`, started headless with `--remote-debugging-port 9333`.
3. `node tests/thumbs.mjs 9333 <outdir> http://localhost:6263/` — free play by thumb; `SCENARIO=tut` taps through the
   tutorial, `SCENARIO=menus` opens every menu page (and shoots in the Armory).
Don't `pkill -f` a pattern that also appears in the same shell command line (it kills that shell); put it in a script.

## The pro teams are the test subjects
`tests/sim.js` and `tests/balance.js` play with the pro teams (bot skill Pro) by default; add `--plain` for Expert bots.
`node tests/pros.js [--only <map>] [--rounds N]` checks the pros themselves: a plan from the playbook every round,
the leader's calls and switches, human reaction times (first sight to first shot never under ~0.17 s), and a pro team
beating Expert bots over N maps.
