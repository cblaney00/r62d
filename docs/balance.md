# Balance

How R62D is kept fair, and what has been changed so far.

## How to check
`node tests/balance.js 12` plays 12 bot-only matches on every map (~300 rounds, ~100 per operator)
and prints, per operator: round win %, kills and deaths per round, damage per round; per gun: kills
and damage per player carrying it, and headshot %; plus damage from gadgets. Fewer matches are too
noisy (±18% win rate at 30 rounds per operator). Bots can't use every ability well (smoke, intel), so
treat low numbers on ability-heavy operators as a bot limit, and look for things that are clearly too
STRONG. A healthy spread is roughly 40–60% win rate per operator; attackers should win 45–55% of rounds on every map (he set this 2026-11-15).

## Changes (2026-10-28)
Before: Bulwark 68% wins / 2.0 kills a round / almost never died; Breaker-12 82% of kills were
one-shot "headshots" (any of its 8 pellets could insta-kill); traps did the most gadget damage.

- **Bulwark:** pistols only (one hand holds the shield), hip-fire only with looser spread, the shield
  covers less while he is firing, and a melee hit to the front knocks the shield aside for 1.2 s.
  Bots circle a shield and melee it up close. 68% → 59%.
- **Breaker-12:** pellets can't one-tap headshot any more (a pellet to the head does 1.8× instead);
  pellet damage 13 → 15 to make up for it.
- **Mule LMG:** damage 33 → 29, a little less accurate. **Hornet MP:** damage 21 → 20, 980 → 920 rpm.
- **Pistols:** Vex .50 58 → 50, P10 36 → 34.
- **Lynx** trip mine 55 → 40 damage. **Snare** clamp 35 → 20 damage, held 3 → 2 s. **Onyx** bomblets
  45 → 35. **Glint** sonar reveals for 2.5 s (was 4). **Gravel** daze 4 s (was 5), aim wobble ×1.7 (was
  ×2.2). **Kite** turret overheats after 12 shots (4 s to cool). **Rampart** plates +15 health (was 20).
  **Rivet's** torch makes noise bots can hear.

After: every operator 39–59%, attackers 47%.

## 2026-10-28 — smaller hitboxes, skinnier builds
Bullet hit radius per armor: heavy 7.5, medium 6.8, light 6.2 px (was 10 for everyone; head stays 2.3). Medium/light bodies drawn 84%/76% as wide. Expect fewer hits per shot fired, longer fights.

## 2026-10-30 — guns fire at their real rate
Before, every automatic fired ~600 rpm (the cooldown was rounded up to whole server ticks); now K4 720,
V9 880, Hornet 920, Mule 640. A 12-match report before and after shows no real change in gun ranking.
**Open problem:** attackers win only ~29% of bot rounds in both reports (since the smarter bots and
fewer breakable walls). Bots defend much better than they attack; worth a look.

## 2026-10-30 — 15 new guns
First 12-match report with the new guns (bots pick a random gun from their operator's list), kills per
gun carried: Drummer 0.84, Ox 0.83, Rook 0.79, Marten 0.73 were strongest (V9 0.61, K4 0.46 for scale);
Trident 0.22, Anvil 0.25, Pike 0.26 weakest. Small samples (60–120 each), so only clear outliers were touched:
Rook 42→40 dmg and more kick, Ox 34→31 dmg and slower to aim, Drummer 26→24, Marten 30→28; Trident 36→38 dmg
and 0.32→0.2 s between bursts, Anvil 72→76 dmg and 70→85 rpm. The Pike is left alone: bots fire it from the hip,
where it is meant to be hopeless.

## 2026-10-30 — after wall penetration, roles, spawns and barricades
12-match report: **attackers 37%** (up from 29%: spraying defenders through walls is much weaker now). Guns
are closer together (kills per gun carried 0.41–0.80, shotguns and sidearms aside). Wasp SMG led at 0.80:
damage 19→18. A separate 12-match look at how rounds end: 19 defenders eliminated, 15 attackers eliminated,
13 defuser disabled, 5 time out; the defuser never ran out its 45 s — bot attackers don't guard a plant.

## 2026-10-30 — side-specific weapons
With no gun on both sides (and four new ones), attackers won 34% of 294 bot rounds. Defence SMGs led:
Marten 1.00 kills per carry (small sample), Lark 0.79 → Marten 28→26 damage, Lark 22→21. The Rook (0.33)
kicked too hard for bots: its spray kick 1.4→1.2.

## Shield pass (he asked)
- Bulwark can shoot with the shield up, but each shot swings it aside for 0.5 s; jogging swings it with each step (~20% of front shots get through); standing/walking/crouching covers the whole front. Shield-up speed ×0.82 (was ×0.45). 6-match run: Bulwark 48% (56 rounds).

## Riot shields (2026-11-02, `node tests/riotbalance.js 6`, pros)
Before: Bastion K/r 0.79 D/r 0.55 (gun 0.41/0.77) — too strong: plant 1.45→1.3, arc 1.0→0.95. Aegis win 42% vs gun 54%:
speed 0.74→0.78, aside 0.5→0.42. Thorn win 45% vs 56%: arc 0.86→0.92, recharge 2.2→1.6 s, speed 0.88→0.9, aside 0.25→0.22.
Visor few kills (0.28 vs 0.77) but wins 61%: arc 0.78→0.82, bash 18→22. Glass fair. Ram: too few rounds to judge (Hammer rarely picked).

## Ball Knowledge pass (2026-11-10/11, he set the band: 40-60% is fine, >60% broken, <40% really bad, verdict after 500 rounds)
- NAIL 39%: 4 piercing rounds (was 3) at 55% (was 40%). CROW 40%: lunge ready after 1 s (was 1.5), reaches 5 m (was 4).
  HOIST 39%: climbs 1.2 s hatch / 2.2 s roof (was 1.6 / 3). Pros now throw GLINT's sonar before the push (they never did).
- Reinforcements 10 → 7 a round (he chose, to help attack). Measured side by side (`tests/probe.js 7 7 <map> --json` on all maps,
  `R62D_REINF=10|7`, ~200 rounds each, ±3.5% luck): untrained pros 51% vs 48% attack, trained pros 41% vs 42%. So it makes
  little difference.
- The side gap comes from practice: untrained pros ~50% attack; trained 41%; trained without learned plans/site choice 47%;
  without learned operator/gun picks 45%. What the pros learn helps defence more than attack, both ways.
  Test with trained pros: `R62D_TEST_TRAINING=<copy of pro-training.json>` (tests/_tmpdata.js copies it in).
- Reinforcements back to 10 (he chose). Attackers' skills stronger as a whole (he chose): +1 use on every limited attacker
  skill (`ATK_SKILL_BONUS`), RIVET battery 18, FERRO swing 2 s, BULWARK bash stagger 1 s. Measured with trained pros: 41.7%
  attack (408 rounds), the same as before. Skills decide few pro rounds (skill kills are rare in practice); it should matter
  more for people, who use their skills more.
- BULWARK: K4 Carbine as his only main gun (he asked; was pistols). Trained pros: attack 39.1% (402 rounds; same as before
  within luck). BULWARK himself 43% won, K/D 1.06 over 47 rounds (was 41%, K/D 0.69 in practice).

## 2026-11-15: the pros' complaints, 2,000 practice rounds
- The pros' top complaint was the Anvil Slug (8 of 10). Practice showed that came from how they judged guns: only against
  the other shotguns (all close-range and weak), while the Anvil is a long-range defence primary and sits mid-pack among
  the defence main guns (0.57 kills a round, 55% wins vs Sentry 0.96, SMGs 0.6-0.8). Trimmed anyway (76 → 66 damage,
  falls off sooner; heavies take 3 body hits): after it 0.51 / 54%.
- server/opinions.js now judges fairly: a main gun against its own side's main guns (kills AND wins), an operator against
  its side's average (with 500 rounds needed, his Patch Watch rule), an attachment against the other choices for that
  slot on that gun, plus a side-balance view ('sides').
- With that, the Drummer LMG stood out (0.98 kills a round, 61%, the top defence gun): 22 → 21 damage, 860 → 800 rpm.
  After: 0.89 / 57% (the defence average).
- After both (1,000 rounds on the new version): no operator, gun or attachment stands clearly out. Pros now name taste
  rules he chose (bullet trails, blurred sound, run-outs, defuser drop announced), thin hitboxes, and Dust Town.
- The real imbalance is the sides: attack wins ~44% (Villa 38%, Lodge 40%, School 40%, Depot 44%, Embassy 45%, Harbor 49%,
  Dust Town 56%). Target 45-50%. Not changed: the round rules (prep 30 s, 10 reinforcements, 2:40) are his choices.
- Watch: Ox Belt-Fed (0.85-0.96 kills a round on attack, few rounds yet), Hatchet MP's suppressor (small sample).
- Later the same day, with trained pros (tests/probe.js and strats.js with `R62D_TEST_TRAINING` = a copy of the real
  practice): overall attack 44%. Villa is the one map clearly below 45% in every run (31%, 31%, 38% in practice); the
  rest swing 39-52% with the noise (±8% at ~130 rounds). Levers measured on five maps, ~125 rounds each:
  current 40% avg · 7 reinforcements 42% · 20 s preparation 39% (all within noise). One more breakable wall per site
  room on Villa/Lodge/School made no difference either (reverted). So Villa needs a change to the map itself.
  Test knobs: `R62D_REINF`, `R62D_PREP` (server/game.js). Across maps: 4+ defenders on site at 30 s → attack wins ~9%.
- Villa new ways in (balcony + Kids Room doors, north terrace + stone steps): attack 31% → 43-48%.
- After rat spots, +3 cameras a map, hallway baffles, 5 m plant areas, PERCH Overwatch and defuser requests (trained pros,
  ~125 rounds a map, ±9%): Harbor 55, Villa 44, Depot 42, Embassy 49, Lodge 34, School 38, Dust 48; overall ~44%.
  Weak sites are all upstairs: Lodge 2F Office 20%, School 2F Principal Office 30% / 3F Clock Room 29%, Depot 2F Manager
  Office 29%. Next: give those the Villa treatment (an outside way up). `tests/probe.js 7 N <map>` prints per-site results.
- Lagging attackers buffed (1,500 practice rounds before / after; old results halve, so "after" still mixes in some):
  OSPREY 35 → 42% (12 s scope, 6 s marks, wider), HAMMER 41 → 44% (+1 round), RUSH 41 → 42% (+1 dash), VAPOR 36 → 35%
  (+1 burst, 11 s), KESTREL 39 → 39% (dart sees 6.4 m), TRENCH 39 → 39% (+1 cover). Smoke, a dart and cover are the
  kind of skill bots barely use well (see "How to check"), so those three may not show in bot numbers at all.
  Rappelling 2 → 1.3 s a storey, slide down 0.45 → 0.3 s. Attack overall ~43% in practice.
- New ways up (trained pros, ~200-300 rounds a map): Depot 42 → 46% (Manager Office 29 → 37%), School 33 → 38%
  (Principal Office 20 → 34%, Clock Room 29 → 34%), Lodge 33 → 34% (Office 20 → 35%). Forced onto one site, School's
  Principal Office was 54% for attack, so part of the low figures is the defenders' site vote. Lodge's attackers die
  mostly outside, shot from upstairs rooms on the approach: Lodge's problem is map-wide, not one site.

## 2026-11-16: upstairs sites are the side gap (trained pros, ~175-190 rounds a map, ±7%)
- Villa 37% (B Wine Cellar 40, Kitchen 42, Library 44, **2F Master Bedroom 25**), Embassy 41% (B Vault 59, Reception 32,
  Archives 51, **2F Ambassador Office 30**), Lodge 41% (Bar 52, Dining 47, **2F Office 30, 2F Games Room 33**), Dust 58%
  (A 62, B 54). Earlier 80-round runs: Depot 38-51%, Harbor 48%, School 42%. Overall ~43%.
- Ground-floor and basement sites are about fair; upstairs sites are 25-33% and the defenders' site vote picks them most
  (56-61 of ~180 rounds), so they drag each map down. Extra outside ways up (Villa balcony/terrace) were not enough.
- ~70% of attacker deaths come in the first 30 s of the action phase; only ~15-25% outside (Dust 65%: its fights are
  outdoors). `node tests/deaths.js <matches> <map>` prints it.
