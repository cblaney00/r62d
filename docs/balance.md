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
