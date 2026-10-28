#!/usr/bin/env bash
# Starts the R62D game server (if it isn't running yet) and opens the game full screen,
# in its own Firefox window with no browser bars (kiosk mode, separate profile).
cd "$(dirname "$(readlink -f "$0")")"
up() { (exec 3<>/dev/tcp/127.0.0.1/6262) 2>/dev/null; }
if ! up; then
  nohup nix develop /home/insideabush/nixos-config#vibe-web --command node server/server.js > /tmp/r62d-server.log 2>&1 &
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
user_pref("permissions.default.shortcuts", 2);
PREFS
exec firefox --kiosk --no-remote --profile "$PROFILE" "http://localhost:6262/?app=1"
