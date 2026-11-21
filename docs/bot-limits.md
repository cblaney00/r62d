# What the bot tests can't see (2026-11-20, he asked)

He asked: "find limits in the tests ability when it comes to what the bots dont like to do but could be beneficial,
consider your recent notes on wraith in 1v1 and why they are balanced".

Every balance number in R62D comes from bots (`tests/balance.js`, `tests/duelmeta.js`, `tests/probe.js`, the pros'
practice). So an operator looks only as strong as bots can make them. This page lists where that falls short.

## How it was measured
- **Skill uses are now counted for every operator.** Before, six skills that never run out (FERRO's hammer, WRAITH's
  scan, HUSH's shroud, RIVET's lance, BULWARK's brace, SOLDER's weld) always showed "0.0 uses a round", and a gadget
  picked back up hid a use. `game.js` keeps `p.abUsed`; BALL KNOWLEDGE and `tests/balance.js` read it.
- **`tests/skillgap.js [rounds] [--5v5] [--eager 2.5] [--ops a,b]`** plays every operator twice: once with bots as they
  are, once with bots that reach for the skill 2.5× as readily (`R62D_EAGER`, `bots.js skillEager`). The difference in
  uses and in win rate shows how much a more willing player could get out of the skill.
- **Skill drills** (`server/skilldrills.js`) play each skill in situations where it should pay off, with the skill and
  with it locked. The gap is what the skill is worth to a bot there.

## What it showed (1V1, 100 rounds per operator each way, ±8% each)
1. **For most operators, "use it more" changes almost nothing.** Uses went up for only about a dozen skills (ECHO
   0.46 → 0.86, RUSE 0.65 → 1.38, TRENCH, MARK, VAPOR, TORQUE, LENS, NAIL). For the other ~45 the bot only uses its
   skill when a fixed trigger fires (a barricade right in front of it, an enemy in reach, the preparation phase). A
   person decides when; a bot doesn't. So **bot tests measure a skill's floor, not its ceiling.**
2. **Where a more willing bot did clearly better:** ECHO +17 points (73% in 1V1 when it spikes every round),
   and maybe STRIDER and GLINT. ECHO was already flagged too strong in the 1V1 meta test, so a person using the spike
   well will be stronger still.
3. **Some got worse when used more:** VAPOR (smoke every fight) 41 → 23%, TRENCH, NAIL, GIMLET. Spending a skill
   at the wrong moment hurts. Eagerness is not skill.
4. **The noise is as big as most gaps.** 100 rounds each way gives ±11 points on the gap. HAMMER (+13) and ARGUS (+11)
   moved without their uses changing, so that was luck. **Only gaps over ~12 points, with uses that really changed,
   mean anything.** Judging one operator needs 400+ rounds each way.
5. **A bug was found: PERCH never used Overwatch** (0.00 a round in all practice). The bot only tried it while already
   aimed in, and bots never aim in while holding an angle. Fixed: PERCH now stops, aims in and locks it (0.5 a round).

## WRAITH: why the tests call him average
- His scan needs a full charge and refills in 50 s, so in a ~45 s 1V1 round he gets **one scan at most**. Bots already
  scan 1.0-1.3 times a round. Making them more eager can't add scans (1.03 → 1.09), so WRAITH stays about average
  (43 → 51%, inside the noise).
- What bots do with a scan is the weak part. A blip only becomes a "heard" spot (`ai.heard`). They don't pre-aim the
  door the attacker will come through, wait for the attacker to commit, or flank round. A person does all three.
  **So WRAITH's bot win rate is his floor. In people's hands he is likely the strongest 1V1 defender**, which is what
  he expected. The tests can't show it until bots learn to *use* information, not just collect it.
- The same goes for every intel skill (GLINT, ECHO, SHADE, HOUND, ARGUS, KITE, LENS, OSPREY, MARK, KESTREL).
  Their numbers undersell them for people.

## Things bots never or almost never do (still open)
From the 1V1 playtest (docs/1v1.md) and the new counts:
- **Plan around information**: pre-aim from a scan or a ping, rotate before contact, bait. (Intel operators undersold.)
- **Ropes, windows and roof entries** in a 1V1 (1 rope in 73 rounds); **hatch play from above**.
- **Playing the plant**: attackers plant in only 6% of practice rounds. Nearly every round ends in the first fight.
  Skills built for after the plant (TRENCH cover, gas, PATCH, ECHO) get little chance to matter. The pros'
  drill ideas noticed this and moved those drills to other situations.
- **Opening new angles through soft walls** in a 1V1 (a lone attacker walks the door).
- **Team skills alone**: SOLACE, TONIC, RAMPART, RALLY have nobody to help in a 1V1, so their 1V1 numbers mean little.
- **Timing a skill**: bots use smoke, shields and stuns the moment the trigger fires, not when it would win the fight.

## What this means for balance
- Trust bot numbers most for **gun-heavy** operators (FERRO, MASON, SHUNT, BULWARK). Their skill is a small part of how
  they win, and a person can't squeeze much more out of it.
- For **intel and timing** operators (WRAITH, ECHO, GLINT, HUSH, VAPOR), bot numbers are a floor. Watch them in real
  games with people before buffing them, and be quicker to trim them if people say they feel strong.
- Before any perma-ban, rerun `tests/duelmeta.js` and `tests/skillgap.js --ops <them> 400`.
