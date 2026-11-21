# The damage scale

He asked (2026-11-21): "tune the guns, tune the health, and tune the damage mechanics of the utility in the game so
there is a reference point for that things in the game do 'a little' damage or 'a lot' of damage because these are
relative terms that need context". He chose the scale below and chose to keep the words behind the scenes (not
shown in game descriptions).

## Health

Everyone has **100 health** (`HP` / `ARMOR_HP` in shared/operators.js). Every damage number is a share of one person.

## The five words

| Word | Damage | Examples |
|---|---|---|
| Scratch | under 10 | turret camera 5 a hit, toxin canister 5 a tick, static grid 6, breaching dash 8 |
| A little | 10–25 | one rifle bullet (K4 23, Sabre 21, Ox 25), one SMG bullet (14–19), arc gun 11, clamp trap 15, fake-out pop 11 |
| A lot | 25–50 | pistols (P10 26, Vex 38, Bison 48), Rook 30, Heron 34, Longbow / Anvil 50, melee 42, shield bash 17–30, impact grenade 30, cutter 30, mine 30, floor charge 34 |
| Most of you | 50–99 | Ferro's hammer 57, slug launcher 57, breach charge 45 (+armour), saw disc 45, claymore 72, proximity mine 68, Ranger 62, Pike 85, Saker 91 |
| Deadly | 100+ | frag 100 and nitro 106 at the centre, Mammoth 102, the scoped snipers' clean body shot, any clean headshot |

Explosions fade with distance: `dmg × (1 − 0.75 × distance / radius)`, so a frag is deadly at its centre and
"a little" (25) at its edge.

## Armour

- **Bullets and melee:** armour makes no difference. Every gun takes the same number of body shots on anyone.
- **Explosions and gadgets** (`blastArmor` in server/game.js, `BLAST_ARMOR` in shared/operators.js): heavy takes
  75%, medium 90%, light 100%. Covers every `explode`, static grid, turret camera, arc gun, clamp trap, toxin and
  the saw disc. Not melee, hammer, lunge or breaching dash (those are hits, not gadgets).
- Armour also still sets speed (`ARMOR_SPEED`) and body size (`HIT_R`, `BODY_W`).

## How the old numbers were converted

The old scale was 132 health for a medium (136/132/128 by armour, 150/132/120 before that). Every gun's damage
was multiplied by 100/132 and then nudged so it needs exactly as many body shots on 100 as it needed on a 132
medium (scratchpad script logic: `n = ceil(132/old)`, new value kept in `[ceil(100/n), 100/(n-1))`). Shotgun
pellets were simply multiplied. Gadgets, healing (stim 30, rally 30, heal kit 8/s, heal station 5/s up to 76,
plates +11), revive health (19 / 30 / self-up 15), the down limit (−27) and the low-health warning (27) were
multiplied by 100/132 too. Zombies keep their old toughness: `ZB_OLD_SCALE` in server/zombies.js turns the
player's damage back up against zombies. The infected in the fun modes have 121 (was 160).

## Adding something new

Pick the word first, then a number inside its band. A new gun: decide how many body shots it should take
(`n`), then pick damage between `100/n` and just under `100/(n-1)`.
