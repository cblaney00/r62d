#!/usr/bin/env bash
# Starts the R62D game server (if it isn't running yet) and opens the game full screen,
# in its own Firefox window with no browser bars (kiosk mode, separate profile).
cd "$(dirname "$(readlink -f "$0")")"
up() { (exec 3<>/dev/tcp/127.0.0.1/6262) 2>/dev/null; }
if ! up; then
  mkdir -p "$HOME/.local/share/r62d"
  # profiles and match history: the same place the installed app keeps them, so both share one set
  export R62D_DATA="${XDG_DATA_HOME:-$HOME/.local/share}/r62d/data"; mkdir -p "$R62D_DATA"
  nohup nix develop /home/insideabush/nixos-config#vibe-web --command node server/server.js > "$HOME/.local/share/r62d/server.log" 2>&1 &
  for i in $(seq 1 90); do up && break; sleep 1; done
fi
PROFILE="$HOME/.local/share/r62d/firefox-kiosk"
# already open? don't start a second copy
pgrep -f "r62d/firefox-kiosk" > /dev/null && exit 0
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
  firefox --kiosk --no-remote --profile "$PROFILE" "http://localhost:6262/?app=1"
  "$HC" keyword input:accel_profile "$old" > /dev/null
  exit 0
fi
exec firefox --kiosk --no-remote --profile "$PROFILE" "http://localhost:6262/?app=1"
