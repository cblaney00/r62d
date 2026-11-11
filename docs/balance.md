# Balance

How R62D is kept fair, and what has been changed so far.

## How to check
`node tests/balance.js 12` plays 12 bot-only matches on every map (~300 rounds, ~100 per operator)
and prints, per operator: round win %, kills and deaths per round, damage per round; per gun: kills
and damage per player carrying it, and headshot %; plus damage from gadgets. Fewer matches are too
noisy (±18% win rate at 30 rounds per operator). Bots can't use every ability well (smoke, intel), so
treat low numbers on ability-heavy operators as a bot limit, and look for things that are clearly too
STRONG. A healthy spread is roughly 40–60% win rate, attackers 45–50% of rounds.

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
