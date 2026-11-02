# The 22-item batch (started 2026-11-02)

His answers: riot shields go to 3 operators per side as their 3rd primary, each shield with its own personality;
stairs show chevron arrows along the steps pointing up, plus a small "UP 2F" / "DOWN 1F" label at each end.

Groups: A bots (2 stairs stacking/windows, 3 revives, 7 lock-in, 8 idle spin, 9 cameras, 10 shooting into the bomb,
11 spacing/space/clock, 12 drone pings, 17 talk less, 21 idle pros, 18 practice 200 rounds + spelling);
B maps (1 windows into sites, 15 breakable wall between site rooms except Dust Town, 20 stairs arrows);
C client (16 vision jitter, 22 auto director, 6 killcam + BS rating + bug report, 14 mobile, 5 default attachments, 4 mouse);
D riot shields (19); E Lando LAN hosting (13: his homelab firewall, outside this project).

Status 2026-11-02 evening: done 1,2,3,7,8,9,10,11,12,13,14,15,16,18,20,21,23,24 (r6-todo numbering differs; see Done).
Killcam plan (not started): server ring buffer of every player's pose at 15 Hz for 6 s + shot log (wrap hitscan),
on a human's death send `{e:'killcam', to}` with killer+victim frames; BS score from: never seen in victim's 103° view
(+3), wallbang (+2), behind cover now but visible at killer's viewTime (lag, +3), dead <0.3 s after appearing (+2),
from behind (+1), teamkill (+3). Bug "!" if the kill line crosses solid tiles at both times, killer inside a wall,
a >70 px jump between frames on one floor, or killer dead; save to $R62D_DATA/bugs/. Client: WATCH KILLCAM button by
#viewlabel, overlay canvas playing killer view then victim view, then the rating.
