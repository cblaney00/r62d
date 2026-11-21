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
- Roof hatch into every top-floor site room (he chose: attack from the roof, like Siege; `siteRoom` on the hatch in
  mapkit.js `placeHatches`, `ROOF_SITE` odds in bots.js `roofPick`). First run, before the pros have practised with it
  (~185 rounds a map, ±7%): Embassy 2F Ambassador Office 30 → 52%, School 3F Clock Room 25% (Bell Loft sits under the
  tower: no hatch), Villa 2F 25 → 30%, Lodge 2F 30/33 → 29/25%, Harbor 2F Boardroom 31%, Depot 2F 37/46%. Mixed: measure
  again after practice on this version.
- After 600 practice rounds with the roof hatches (trained pros, ~188 rounds a map, ±7%): overall ~45% attack. Harbor 57
  (2F Boardroom 47), Villa 34 (2F Master Bedroom 22, every site under 41), Depot 47 (2F Control Room 34), Embassy 47
  (2F Ambassador 49), Lodge 41 (2F Games Room 30), School 40 (2F Principal Office 30, 2F Computer Lab 35), Dust 50.
  Villa is the map that needs work (all its sites); upstairs sites mostly fine now except Lodge Games Room, School 2F,
  Depot Control Room. Balance parked here 2026-11-16 (he asked: back seat).

## 2026-11-18: the pros' takes checked, the Embassy moved (trained pros, `tests/probe.js 7 15 <map>` ×2, ~120 rounds a map, ±9%)
- The pros' takes said Dust Town (66%) and The Embassy (64%) favour attack and the Ox Belt-Fed is broken. Measured
  now: Dust Town 54% (A Spice Bazaar 58, B Water Works 51) = fine, left alone; The Embassy 40% (Reception Hall 32,
  2F Ambassador Office 30) = the other way. Their map views came from older practice and will catch up after the next.
- Ox Belt-Fed damage 36 → 33 (1.00 kills a round in practice vs 0.94 for the next attack gun, 75 rounds: a light cut).
- The Embassy, only with the two levers he chose: `siteSoft: 2` (breakable walls each site room keeps besides the one
  to its partner, mapkit.js `hardenWalls`; was 1) and `barricades: 1` (per defender a round, game.js; was unlimited;
  bots used 0.7 a round, max 2, so this one bites people more than bots). Attack 40 → 48% (sites 52 / 38 / 55 / 48).

## Penetration, and how to nerf or buff a gun (2026-11-20, he asked)
He asked: overhaul bullet penetration by gun ("quite unique, fitting their gun type and application"), use it to nerf and
buff guns, show it on the stat card; also ammo, damage and accurate aim-in time are easy levers; study how tactical
shooters, especially R6, do it.

**What R6 and CS2 do** (researched 2026-11-20):
- R6 Siege's designer's notes tune guns with: damage (Kali's CSRX 122 → 127 to hit an exact one-shot breakpoint; MK17
  49 → 40), magazine size (C7E 30 → 25 "fewer bullets, more thought"), recoil (416-C and M762 more vertical kick;
  Reaper's first rounds easier), aim-in time (Blackbeard's ADS recovery 0.5 → 0.9 s), attachments (ACOG removed from
  guns), and decide with a "balancing matrix": each operator's pick rate against its win delta. Changes go in small steps
  and are tested, then adjusted again. Calibre decides how well a gun breaks and passes walls: DMRs/LMGs open barriers
  fastest, pistols/SMGs need more shots, shotguns blow big holes; snipers pass several soft walls.
- CS2: every weapon has a penetration power; pistols, SMGs and shotguns lowest, rifles about twice that, snipers most.
  Damage is lost per wall and per material; a high-damage gun is the better wallbanger.
- So the levers, roughly from small to big: recoil / first-shot spread, aim-in time, reload time, magazine and reserve,
  damage falloff range, penetration, fire rate, damage (watch breakpoints: hits to down 100 / 110 / 125 hp), attachments.
  Change one at a time, a step of 5-15%, then measure (tests/balance.js: kills a carried round, win %).

**Penetration in R62D** (shared/operators.js `PEN_GUN`; server game.js hitscan): each gun has three numbers.
`pen` = damage left after one plain soft wall or barricade (each wall after takes the same share again); `walls` = how
many it gets through at all; `brick` = how much of that a brick wall leaves. Furniture follows `pen` (`furnPen`: a gun
with pen 0.5 takes the furniture's usual share; more pen, less off). Before: one number per class (pistols / SMGs 0.4,
MPs 0.35, ARs 0.5, LMGs 0.62, DMRs 0.68, shotguns 0.3, a few guns their own), brick 0.7 and 3 walls for every gun.
| Gun | pen | walls | brick | why |
|---|---|---|---|---|
| Whisper MP / Tusk / Gnat / Stub / Hedge / Hornet / Breaker / Wasp | 0.22-0.3 | 1 | 0.3-0.5 | subsonic, tiny or buckshot rounds |
| Sparrow, Couplet, Ferret, P10, Javelin, Marten, Needle, Hatchet | 0.3-0.42 | 1 | 0.45-0.6 | pistol calibres (Marten .45 / Hatchet heavier) |
| Sabre, Cyclone, Trident, K4, Tandem, Lark, Drummer, Verdict, Sentry | 0.45-0.55 | 2 | 0.6-0.75 | carbines, light LMGs; Lark's PDW round keeps more |
| Quill, Mule, Heron, Vex .50, Bison, Ranger, Anvil, Trestle | 0.58-0.64 | 2-3 | 0.6-0.8 | darts, slugs, magnums, full rifle rounds |
| Rook, Saker, Auger AP, Ox, Longbow | 0.66-0.72 | 3 | 0.75-0.85 | battle rifle, AP rounds, belt-fed, heavy DMR |
| Pike, Mammoth | 0.8 / 0.9 | 4 | 0.9 / 0.95 | sniper rifles |
The Armory card shows it ("Wall penetration": damage kept · walls), a line with brick and two walls, and "Hits through a
wall" in the hits table.

## 2026-11-20: balance patch after skill drills and the pros' tested suggestions (he asked)
Fresh practice first (400 rounds on this version, `R62D_DATA=~/.local/share/r62d/data node server/practice.js 400`;
**set R62D_DATA**: without it practice writes a new, empty data/ in the project). Then each candidate tested with
`tests/protry.js` (paired bot rounds without and with the change; one operator forced into every round).
| Change tried | Mode, rounds each way | Result | Kept? |
|---|---|---|---|
| Ranger 82 → 77 dmg (Kaze, Juno: GIMLET too strong) | 5v5, 500 | GIMLET 48 → 46% | no: GIMLET is average when forced in; his 68% in practice was 62 rounds of pick luck |
| Pace Beacon 2 → 3 (Moth, Pax: RALLY weak) | 5v5, 500 | RALLY 52 → 53% | no: RALLY is average when forced in |
| FERRO without the Mule | 1V1 600 / 5v5 500 | 44 → 42% / 44 → 48% | no: FERRO is average (attack 44%) |
| SHUNT medium armour | 1V1, 600 | 64 → 61% | no: too small for a character change |
| SHUNT without the Drummer | 1V1, 600 | 61 → 60% | no |
| Cyclone damage −7% | 1V1, 800 | SHUNT 61 → 69, MASON 65 → 63% | no (noise) |
| ECHO 1 spike fewer | 1V1, 600 | 56 → 55% | no |
Result: **no operator or gun number changes in this patch.** One bot fix: PERCH never used Overwatch (0.00 a round);
now about 0.5. FERRO's skill text said 2.5 s between swings, the game used 2 s; the text now says 2 s (`ability.cd`).

**FERRO** (the item that started this): "strong but 0.0 skill uses" was a counting bug (skills that never run out were
never counted). Real numbers: the hammer goes out 0.3-0.4 times a round. In skill drills it is worth nothing
(breaking in: 51% with it, 53% locked; site anchor: 41% / 47%, 70 drills each). His kills come from the Mule LMG (84%
of his practice rounds, 1.07 kills a round on him) and his 150 hp. Forced into matches he wins 44%, exactly the attack
average, so he isn't overpowered; he is a heavy with a good gun and a skill with no job. That is a design question
(VibeNote), not a number.

**What numbers can't fix** (questions for him, in VibeNote and below):
1. FERRO's hammer has no job (only boards, braces, shields, hatches; never walls).
2. In 1V1 the heavy defenders (MASON, SHUNT, DEADFALL, SOLDER) win 60-65% and attack only 37-44% while they're on;
   neither their guns nor their armour alone moves it, so it is how 1V1 plays (one defender holding a small house).
3. Plants happen in only 6% of practice rounds, so skills made for after the plant hardly matter (the pros' drill
   ideas say the same).
4. Intel skills (WRAITH, ECHO, GLINT...): bots collect information but don't act on it, so their numbers are a floor
   (docs/bot-limits.md).
5. Dust Town A (Spice Bazaar / Granary): the pros' most-backed hole (attack 74% of 33 rounds): a map change.

## 2026-11-21: his answers to the five questions (he chose in the plan phase, 2026-11-20)
| Question | He chose | What was done | Result |
|---|---|---|---|
| FERRO's hammer has no job | holes in soft walls + reinforced hatches | each swing on a soft wall knocks a round see-through hole (`sawHole`, up to ~4 a cell); a reinforced hatch breaks in 3 loud swings (`p.hammerHatch`); bots: `BREACH_TOOLS.hammer` (3 swings at a site wall), roof plans may use a reinforced hatch when FERRO is in the squad | swings 0.3 → 1.2 a round in breaking-in drills; win 45% with / 50% locked (120 drills, ±7): bots don't yet shoot through the holes they make, so it still shows nothing in bot tests |
| 1V1 heavy defenders 60-65% | smaller armour gap, every mode | `ARMOR_HP` 150/132/120 → 136/132/128 | 1V1 (1400 rounds): heavies 61 → 57% on average, attack 39 → 43%. 5v5 (300): attack 50 → 46%, inside the target. MASON and SHUNT still about 61% with the new bots (their panels/grid, not their health) |
| plants in 6% of rounds | teach bots to play for it | pro attackers: when a player up, a teammate on the site, or under a minute, the carrier goes to plant and the two nearest walk with them (`planPush`, `escorts` in bots.js) | 5v5 pros: plants 9% → 12% of rounds (about 400 rounds); 1V1 21 → 26% |
| intel skills undersold | both: teach bots, then trim only if too strong | bots (Gold up, pros) keep the nearest enemy the team knows about (`ai.intel`, from `game.spots`: cameras, scans, callouts), pre-aim the corner it will come round (moveTo, pro `watch`), defenders hold for it, attackers wait 2-4 s once when a known defender close by aims their way (`intelWait`) | 1V1 (2100): WRAITH 54 → 55%, ECHO 60 → 57%, GLINT 52 → 55%: none clearly over 60%, so no trim. 5v5: attack about 54 → 44% (four runs, ±4): information helps defenders most (their cameras) |
| Dust Town A 74% attack | extra reinforceable wall + safer rotation + fewer ways in | the Granary's south door is now a wall, the Bazaar's west window and the warehouse's west door are gone (`win: 0` on the site stops the kit adding windows back), and the Spice Passage (a covered room from the Hotel's west door into the Granary, its walls soft and reinforceable) | attack on A 73% (15 rounds) → 50% (34) and 67% (18), about 56% together; B 60% |
Test switches (tests only): `R62D_NOINTEL=1`, `R62D_NOPLANT=1`, `R62D_NOWAIT=1` turn the new bot behaviours off for comparisons;
`ARMOR_HP` can be tried with `R62D_TWEAK`; `R62D_LVL=7 node tests/bombtime.js` counts plants with the pros.
**Open:** 5v5 attack is now about 44%, just under the 45-55% target, because bots use information; watch it in the next practice.

## 2026-11-21: the damage scale (docs/damage.md)

100 health for everyone, bullets equal on every armour, armour softens blasts/gadgets only. 1V1 by armour
(1200 rounds, level 5): attackers heavy 45%, medium 46%, light 53%; defenders heavy 51%, medium 49%, light 57%.
Still high: Shunt 68% (grid lock). Overall 1V1 attack 48%. 5v5 (balance.js 6, 227 rounds): attack 50%.
