#!/usr/bin/env bash
# Starts the R62D game server (if it isn't running yet) and opens the game full screen,
# in its own Firefox window with no browser bars (kiosk mode, separate profile).
cd "$(dirname "$(readlink -f "$0")")"
# Works from any copy of this repo on any Linux computer: needs a browser, and Node 22+ or Nix (he asked, so Lando can play).
PORT="${PORT:-6262}"; export PORT
URL="http://localhost:$PORT/?app=1"
up() { (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null; }
SHARE="${XDG_DATA_HOME:-$HOME/.local/share}/r62d"
# one way of getting Node, tried in order until the server answers
node_ok() { [ "$(node -p 'parseInt(process.versions.node)' 2>/dev/null || echo 0)" -ge 22 ]; }
try_server() {
  nohup "$@" node server/server.js >> "$SHARE/server.log" 2>&1 &
  SERVER=$!
  for i in $(seq 1 180); do
    up && return 0
    kill -0 "$SERVER" 2>/dev/null || { SERVER=; return 1; }
    sleep 1
  done
  kill "$SERVER" 2>/dev/null; SERVER=; return 1
}
SERVER=
if ! up; then
  # profiles and match history: the same place the installed app keeps them, so both share one set
  export R62D_DATA="$SHARE/data"; mkdir -p "$R62D_DATA"; : > "$SHARE/server.log"
  NIXF=(--extra-experimental-features "nix-command flakes")
  { node_ok && try_server env; } ||
    { [ -e "$HOME/nixos-config/flake.nix" ] && try_server nix "${NIXF[@]}" develop "$HOME/nixos-config#vibe-web" --command; } ||
    { command -v nix > /dev/null && try_server nix "${NIXF[@]}" shell nixpkgs#nodejs_22 --command; } ||
    { echo "R62D could not start its server: it needs Node 22 or newer, or Nix. Details: $SHARE/server.log" >&2; exit 1; }
fi
PROFILE="$SHARE/firefox-kiosk"
# He asked: the server is only up while someone has the game open. Once the window has closed, wait until nobody
# (a friend on another computer included) has been connected for 20 s in a row, then stop it.
# Only a server this script started: someone else's keeps running.
stop_server() {
  [ -n "$SERVER" ] || return 0
  local quiet=0
  while [ "$quiet" -lt 20 ]; do
    if [ -n "$(ss -Htn state established "( sport = :$PORT )")" ]; then quiet=0; else quiet=$((quiet + 2)); fi
    sleep 2
  done
  kill "$SERVER" 2>/dev/null
}
# no Firefox: any browser will do, and the server stays up until this script is stopped
if ! command -v firefox > /dev/null; then
  echo "R62D is at $URL (no Firefox here, so opening your usual browser). Press Ctrl+C here to stop it."
  xdg-open "$URL" > /dev/null 2>&1
  if [ -n "$SERVER" ]; then trap 'kill "$SERVER" 2>/dev/null' EXIT; wait "$SERVER"; fi
  exit 0
fi
# already open? don't start a second copy
pgrep -f -- "--profile $PROFILE" > /dev/null && exit 0
mkdir -p "$PROFILE"
cat > "$PROFILE/user.js" <<'PREFS'
user_pref("browser.shell.checkDefaultBrowser", false);
user_pref("browser.aboutwelcome.enabled", false);
user_pref("browser.startup.homepage_override.mstone", "ignore");
user_pref("datareporting.policy.dataSubmissionPolicyBypassNotification", true);
user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);
user_pref("browser.sessionstore.resume_from_crash", false);
user_pref("media.autoplay.default", 0);
user_pref("full-screen-api.warning.timeout", 0);
user_pref("browser.tabs.warnOnClose", false);
user_pref("dom.disable_beforeunload", true);
user_pref("permissions.default.shortcuts", 1); // the game may keep Ctrl+W / Ctrl+Q etc. (he lost a match mashing Ctrl to crouch)
user_pref("browser.quitShortcut.disabled", true);
user_pref("dom.user_activation.transient.timeout", 86400.0); // a click in the menus still counts when the match starts, so the game can take the mouse by itself (he asked)
user_pref("permissions.default.microphone", 1); // push to talk to the bots: only used while the key is held; this window only opens the game
user_pref("dom.event.pointer.fractional_coordinates.enabled", true); // keep tiny mouse movements instead of rounding them away (he noticed slow aiming didn't move)
PREFS
# Slow mouse moves (he noticed the crosshair not moving at all): with the desktop's mouse acceleration on, a slow move
# becomes steps of less than a pixel and Firefox on Wayland throws those away before the game sees them. While the game
# window is open the mouse is set to flat (every step 1:1, nothing lost); the old setting comes back when it closes.
HC=$(command -v hyprctl)
if [ -n "$HC" ] && [ -n "$HYPRLAND_INSTANCE_SIGNATURE" ]; then
  old=$("$HC" getoption input:accel_profile | sed -n "s/^str: //p")
  case "$old" in ""|"[[EMPTY]]") old=adaptive ;; esac
  "$HC" keyword input:accel_profile flat > /dev/null
  firefox --kiosk --no-remote --profile "$PROFILE" "$URL"
  "$HC" keyword input:accel_profile "$old" > /dev/null
  stop_server
  exit 0
fi
firefox --kiosk --no-remote --profile "$PROFILE" "$URL"
stop_server
