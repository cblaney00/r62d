# r6-todo — ideas for R62D

insideabush's list of next ideas. Claude works through it top to bottom: when one item is
finished it gets ticked and moved to **Done**, then work continues on the next one.
Only ideas he asks for go in **To do** (added to the bottom). Claude never adds its own suggestions here.

## To do


## Done

- [x] Trappers one job each: Bramble keeps the bomb; Lynx's mine becomes a paint trap (no bang, the attacker glows for defenders through walls for 12 s); Latch's wire becomes a siren that deafens the attacker (no footsteps heard) for 8 s; Shade's microphone stays
- [x] Placed traps follow one rule for arming and hiding (like throwing)
- [x] Wraith: a scan lasts 4 s at most, and attackers it sees hear a ping
- [x] Hush: 6 s, then 15 s before it's ready again
- [x] Kite: one bullet into the turret's lens disables it for 8 s
- [x] The three health operators (Solace, Tonic, Rally) slowly get up by themselves when downed
- [x] Rally: new ability, a pace beacon (teammates who run past it get a 5 s speed boost)
- [x] Girder: active steel brace that blocks a doorway to walking but not to shooting or seeing (keeps fast reinforcing)
- [x] Lens: the periscope goes through the floor or ceiling to watch the room above or below
- [x] OPEN TO LAN (in the lobby next to START MATCH, and in the pause menu): shows your game's home-network address big, with a QR code a phone can scan with its camera, plus any other addresses (cable, Wi-Fi, homelab VPN). The game stays open to your home network as before (you chose that). The lobby now gives the home address first instead of the VPN one, and the title screen says which computer and version you are connected to ("Connected to blaney-pc · version …"), so a phone can tell your own PC's game from Lando's mini-server. Updating Lando's copy is the separate step in the config session, once phone play is good.
- [x] VAPOR's Smoke Burst: a cone of thick smoke blasts out in front of him, spreads almost at once and fills the shape of the room (it follows doorways, never goes through walls), for 8 seconds.
- [x] CROW reworked: Lunge (2 a round). For 5 seconds his melee becomes a silent 2-metre lunge that downs anyone it reaches, from any side (a shield from the front just gets knocked aside).
- [x] STRIDER balanced: Ghost Step lasts 6 seconds instead of 10, and he moves 15% slower while it's on.
- [x] Throwing is consistent: everything thrown flies to where you aim and comes to rest there; it goes off a moment after it lands (a frag still counts down from the throw, an impact grenade goes off on contact, nitro/gas wait for their owner). Before, quick ones like smoke popped in mid-air short of where you aimed.
- [x] TALON's EMP sticks to the first wall it hits and works in a circle about a door wide, right through that wall (so it hits cameras and traps on the far side).
- [x] HAZE vs VAPOR: Haze lays a thin wall of smoke (about half a metre thick, 6 m wide) across her aim; Vapor's is a big cone that fills a room.
- [x] MARK's tracer rounds punch through up to about a metre of any wall, even reinforced, as well as lighting up whoever they hit.
- [x] TETHER's wall scopes have a shimmering energy shield for their first 3 seconds; after that one bullet breaks them.
- [x] Every operator looks different: each has their own headgear (51 kinds, from a quarry hard hat and a motorbike helmet to a deerstalker, a carnival half-mask and Crow's beaked hood), their own thing on their back and their own cut of vest or jacket.
- [x] New bios: every operator has a different background and home town (no more pile of shipyard welders).
- [x] TORQUE has a new ability: Saw Disc Launcher (3 a round). The spinning disc slices a thin see-through slit through every soft wall and barricade in its path until it hits something solid, and cuts anyone it hits.
- [x] FERRO's hammer never runs out.
- [x] HAMMER and SALVO are different now: Salvo's rounds stick and wait, and pressing the skill again (while rounds are stuck) blows them all at once. Hammer's rounds still burst on impact.
- [x] BULWARK: the hand on the shield now moves with it, and when he jogs the shield lurches with each step and settles slowly, like something heavy, instead of swinging like a metronome.
- [x] Smoke looks like smoke: soft churning clouds whose edges curl, swell and drift outward, for grenades, Haze's wall and Vapor's cone.
- [x] Attachments rebalanced as trade-offs (each one says what it improves and what it costs, e.g. the angled grip aims in 20% faster but drifts a little more; the suppressor now also loses some range), and 6 new ones that only fit the guns they make sense on: Heavy Barrel (rifles, LMGs, marksman rifles: steadier sprays, slow to aim), Short Barrel (SMGs, machine pistols, shotguns: quick and tight up close, drops off sooner), Choke (shotguns: pellets stay together further, easier to miss up close), Handstop (rifles, LMGs, marksman rifles: much less shake, slower to aim), Stubby Grip (SMGs, machine pistols, shotguns: tighter hip fire, more shake) and the 1.5× Prism sight (rifles, LMGs, marksman rifles, SMGs: accurate at mid range, slower to aim). 2× scopes are only on rifles, LMGs and marksman rifles now; every gun still has at least 3 choices in each slot.
- [x] Tilt to move (phones only): Settings → "Tilt the phone to move" On/Off and a "Tilt dead zone" slider (2–25°, starts at 7°). Tip the phone the way you want to go: a small tilt walks quietly, a bigger one runs, inside the dead zone you stand still. The left stick still works alongside it (a thumb on the stick wins). "Level" is however you hold the phone when the match starts; the ⟲ TILT button above the stick resets it to how you hold it now. Works for drones too.
- [x] Played it with (pretend) thumbs on a phone-sized screen and fixed what felt bad: two thumbs at once now always work (moving while aiming or shooting), you can slide your thumb on FIRE to aim while shooting, the move stick comes to wherever your left thumb lands, RESUME in the pause menu works (it used to pop the pause menu straight back), the match screen is slimmer (skill/gadget/drone counts sit on their buttons), the camera keeps you near the middle instead of under your thumbs at the map's edge, the tutorial speaks in buttons instead of keys and its banner no longer gets in the way, menu pages fill the screen, the Armory works by touch, the screen stays awake during a match, and phones start on Medium graphics so they run smoothly.
- [x] Phones on Firefox, second go: the game now really goes full screen (Firefox only allows it when a tap ends, not when a finger lands, so every tap asks until it works). Bigger text in menus and matches, bigger touch buttons, and fewer of them: USE and VAULT only pop up beside FIRE when there's something to use or climb, and the camera arrows only while watching a drone or camera. Prompts say the button name ("USE") instead of a key. Menus scroll with a finger. On a drone the CROUCH button becomes SPRINT (a light push used to sprint by accident). The game can also be added to the phone's home screen to open full screen.
- [x] Phones: the game tells a phone apart by itself (touch controls); if a device has both a touch screen and a mouse it asks on the title screen ("Phone / tablet" or "Keyboard & mouse"). The choice is remembered and can be changed in Settings → Controls.
- [x] Phones fit the screen: menus, lobby, operator select and the match text shrink to fit (checked at the Pixel 6 and Z Flip 7 screen sizes), long panels like Settings scroll, the touch buttons shrink on short screens, and phones start further zoomed out. Two new Settings sliders, for phones and computers: "Menu & screen text size" and "How much of the map you see".

- [x] Free play is god mode: you can't be hurt, and ammo, reloads, skills, gadgets, drones and drone sprints never run out (bots still take damage). Press O (or click ALL OPERATORS at the bottom) for a grid of every operator, attack and defence, by role; click one to switch on the spot. N / B still step through them.
- [x] Dust Town's market tables were invisible: they used the toilet-cubicle piece by mistake. They're now proper market stalls (wooden tables with a striped awning and goods laid out).

- [x] Phone and tablet support: opening the game on a phone shows touch controls by itself during a match. A stick for your left thumb to move (a light push walks quietly); the whole right half of the screen is a stick that appears wherever your thumb lands, to aim (drag further to look further). FIRE buttons on both sides, and buttons for aim in, crouch, use (hold), reload, swap, skill, gadget, melee, vault, ping, drone/cameras (with previous/next), scores and pause. Pressing AIM pulls the crosshair in close, like aiming in with the mouse, and re-centres the right stick under your thumb. Menus and the match's text shrink to fit a phone screen; it plays sideways only (held upright it asks you to turn the phone). The first touch in a match goes full screen.

- [x] Cleaned up the game files: removed unused leftovers in the code, moved an old copy of the saved profiles out of the game folder (kept as a backup next to your real saves; nothing in it was missing from them), and brought the project notes up to date. New test for the first 30 operators: each skill does what its description says (31 checks, all pass); with the existing test for the 21 newer ones, every operator's skill is now checked. The whole test suite (29 tests) passes; one camera test that could fail by luck (a bot in the line of fire) was fixed.

- [x] Compass to the bomb site: once the objective is found (defenders always know it), a small dial under the score bar points along the walking route to the bomb rooms, not straight through walls. When the route goes up or down a floor it points to the stairs instead ("STAIRS ▲ 2F · 12 m"), and it says ON SITE when you're there.

- [x] Dust Town couldn't be picked in the lobby: the row of map cards only had room for six, so the seventh was hidden off the edge. The cards now shrink to fit every map in one row.

- [x] Dust Town, a desert town map in the classic layout: attackers come from the south edge (4 spawns); bomb sites at opposite ends of the north (A: Spice Bazaar / Granary in the west, B: Water Works / Pump House in the east) with the Hotel (a third site) between them near the middle. Long Road runs up the open west edge to A (a gate halfway), Mid Street goes up the middle to the Town Square (Short Gate to A, B Alley to B), and a tight winding concrete tunnel comes up the east side into the B yard. The market and garage between the lanes link them. Mostly one floor; only the Hotel has an upstairs with windows over the square. New sand ground.

- [x] Points, R6-style: a "+20 ENEMY SPOTTED" style popup under your crosshair and a SCORE column on the scoreboard (Tab); the MVP is the top score. Kill 100 (headshot 120), down 50, revive 75, plant or disable the defuser 150, objective found 50, enemy spotted 20, pinging a gadget/camera/drone/the objective 10 (once per thing a round), gadget/camera destroyed 25, drone 20, wall or hatch reinforced 15, barricade 5, round won 50, teamkill −50.
- [x] Objective found is a big moment now: "OBJECTIVE FOUND" in large letters with the two bomb rooms, the floor they're on, and a picture of that floor with both rooms lit up, the A and B spots and where you are. It shows for about 6 seconds, then fades.

- [x] HUSH's Silent Shroud is now a toggle (Q on, Q off; it lasts up to 10 s and recharges while off) and is truly silent: no footstep noise for bots, sound sensors or ECHO's spike, and no movement sounds (aiming in, crouching, drawing a gun) for anyone else.
- [x] Bots turn much faster (Easy 4.5, Normal 7, Hard 10, Expert 12.5 radians a second). Hard and Expert bots always look towards where an enemy could come from (the nearest doorway, window, stairs or open hatch ahead of them); Normal bots do it some of the time; Easy bots just look where they walk.
- [x] Wooden barricades on doors and windows are unlimited; reinforcing soft walls (the metal) stays limited.
- [x] No ping spam: each ping makes the next one wait longer (1, 2, 4, 8, 16 s, never more than 20 s), and the wait shrinks back as you go without pinging. Trying too soon tells you how long is left.
- [x] Every window and every door to the outside starts boarded on every map. Every window can be vaulted through once its boards are gone (upstairs windows from the rope). Two upstairs windows that had a bookcase right against them (Harbor Office, Alpine Lodge) were moved to a clear stretch of the same wall.

- [x] Operators page in sections like a match: ATTACK / DEFENCE at the top, then each role (with what it does) and its operators.
- [x] Aiming in puts the crosshair 2.5 m out instead of 5 m (in matches and the Armory).
- [x] No friendly fire during preparation: shots pass through teammates and nobody (you included) gets hurt by their own side while setting up. It's back on in the action phase.
- [x] At least 3 choices in every attachment slot: pistols and other sidearms now also get the Holo sight and the Angled grip. Iron sights are a real choice now: the quickest to aim in (red dot: tighter aimed shots; holo: a bit of both).

- [x] Tutorial text is bigger and the focus: things to read come up as a large card in the middle of the screen (Space, Enter or a click dismisses it). Things to do show as a large banner near the top that moves on by itself as soon as you've done them.
- [x] No more stopping to press anything to move on: the tutorial starts the action phase by itself when you've finished preparing, both when attacking and when defending.

- [x] Checked: the latest version (with the 21 new operators, 51 in all) is on GitHub's main, and both the game server running on this computer and the installed R62D app have all 51.

- [x] A new attacker with a launcher: **SALVO** (Breacher), Delay Launcher with 4 rounds. A round sticks to whatever it hits (a wall, a barricade or a person) and blows 1.5 s later, opening soft walls and barricades and sending a second blast into the room behind.
- [x] At least 5 operators in every role: 21 new ones (51 in all). Attack: SALVO and TORQUE (Breacher), RUSH and BLAZE (Entry), ECHO and MARK (Intel), PATCH and TRENCH (Support), WREN, VAPOR and CROW (Flank). Defence: SOLDER (Anchor), LATCH (Trapper), HOUND, RUSE and RALLY (Roamer), LENS and AUDIT (Intel), TONIC, WARD and GIRDER (Support). Each has its own skill, guns, look and a short bio, and bots use the defence gadgets and several of the fight skills.

- [x] Aiming: with the crosshair far out, moving the mouse sideways now turns you as fast as when it is close, so flicks work. The crosshair stays at the distance you put it instead of jumping onto every door frame in the way: a tick marks the wall in the way, and the crosshair fades if bullets can't reach it. Aiming in puts the crosshair 5 m out the way you face. The Armory works the same.
- [x] Tutorial: one quick run of about 4 minutes from the TUTORIAL tab. You attack one round (pick, drone and ping, moving and shooting, breaking in, vaulting and rappelling, planting, with the plant finishing at once), then the sides swap and you defend one (reinforce, barricade, cameras, hold and take the two attackers down). Each step says exactly what to do and moves on when you've done it. The bots never shoot or hurt you.
- [x] Shields (Bulwark), keeping your R6 rules (Q swaps to the pistol with the shield on your back, shield bash, melee knocks the shield aside): what you see is now exactly what stops bullets. Standing, walking (Shift) or crouching it covers the whole front: truly safe. Jogging, it swings with every step and leaves gaps (about a fifth of shots from the front get through). You can now shoot with the shield up, but each shot swings it aside for half a second and leaves you open. Shield-up jogging is 1.8 m/s instead of a 1 m/s crawl. Bots shoot into the gaps. Bulwark still wins about half his rounds (48%).

- [x] Round ends when every enemy is dead or downed with nobody left to revive them: checked, it already works (a full bot match ended every round correctly). He agreed to leave it for now; if it happens again, note where (Free Play, tutorial or a match) and whether a teammate was still standing.

- [x] Map knowledge tab (under the Armory): pick a map and a floor to see its plan with every bomb site pair (click one to pick it out and jump to its floor), attacker spawns, defender cameras and where they look, floor hatches, stairs (which floor they lead to), breakable walls in orange, rappel spots and room names. Each can be switched on or off; pointing at a room names it.

- [x] Rappelling (attackers): a rope coil on the ground marks every stretch of outside wall below an upstairs window (7–12 per map). Stand there and press E to climb (2 s a floor; you can be shot on the way). Hanging outside you can move left and right along the wall a few metres either side of the window, peek and shoot in at an angle, and break the boards with melee or shots. Space climbs in once the window is open, and E lets go back to the ground. If you're downed or killed on the rope you fall to the ground below.

- [x] Only your own vision: your map lights up only from your own eyes, or the drone or camera you are looking through (yours or a teammate's, through the team feeds), or the teammate you watch once dead. Teammates' pings and spotted marks still show. Where a teammate died shows as a big red ✖ with their name, through walls and at the screen edge, pulsing at first (▲ / ▼ when it was on another floor).
- [x] Drones are 30% smaller (and a little harder to hit) and can sprint: hold Shift on a drone for 1.6× speed for up to 3 s, 3 sprints a round, 6 s before the next one. A sprinting drone whines louder and further. The drone's top line shows how many are left.

- [x] Stairs preview: when you can see a staircase and are within a few metres of it (or on it), a live window in the top-left corner shows the other end ("▲ TOP OF THE STAIRS" / "▼ BOTTOM OF THE STAIRS"): everything visible all round the landing, with anyone standing there and their gadgets (hidden traps stay hidden), and a dashed ring where you come out. It fades away when you step back. Enemies on another floor no longer get a misleading red ! at the screen edge.

- [x] Aiming in the Armory works exactly as in a match: the first click captures the mouse (Esc lets go), your sensitivity, aiming mode and your own crosshair are used, distances are real metres (5–25 m), the view widens when you aim in and follows the crosshair out, head zones show while aiming in, and the distance shows beside the crosshair. (Before, the range was drawn at about half scale, so its "20 m" was really 11 m.)

- [x] Bullets look tiny: their streaks are thinner and flash for only 2-3 frames, and bullet marks in the Armory are smaller. (A shot was already a line with no width, so hitting someone still takes an exact aim.)
- [x] Armory: guns sorted into a folder per type (Assault rifles, Submachine guns, ...), click a folder to open or close it.
- [x] Every attacker bot drones in preparation. (None drove their drone before.) They head for the bomb sites, call out defenders they see, then park and watch.

- [x] Long-range aiming: the crosshair goes anywhere your character can see. Push it past the edge of the screen and the view slides after it (and zooms out if needed), so a marksman can headshot down a long sightline. Aiming in now widens the view instead of zooming in (2× scope widest). Walls you can't see through hold the crosshair, but through a soft wall or barricade your aim carries on (dotted line and faint ring), so headshots through soft walls still work. The distance shows beside the crosshair, and while aiming in each enemy's head zone shows as a ring that turns red when your crosshair is on it.
- [x] Headshots only count when your crosshair is on the head when you fire.

- [x] Windows all start boarded up (doorways still start open). They do not use up anyone's 3 barricades.
- [x] More hard walls, less wallbanging: about a quarter fewer breakable walls on every map. Away from the bomb sites only about one inside wall in five and one outside wall in ten can still be shot through; the bomb-site rooms keep their few breakable walls.
- [x] Shorter chat box: the last 6 lines in a match; during operator select only the last 3, in the empty strip under the role cards instead of on top of them.
- [x] A reloading circle round your character fills up as the reload goes on.
- [x] The Tusk Auto-12 shot left: its pellet spread was lopsided (a full width to the left, three quarters to the right). The Breaker-12 and Halberd had the same fault; all fixed. Every other gun checked: each one drifts the way its spray pattern says, and a test now checks this.
- [x] The loadout panel no longer jumps when you click: only the parts that changed are updated.

- [x] Barricading was bugged and too quick: the hold-E prompt showed from a little further away than the game accepted, a doorway could end up half-boarded and then never be boarded again, and standing in the doorway wasted the whole hold. Fixed all three. A barricade now takes 2.5 s like R6, each defender has 3 a round (shown in the prompt and the objective line), and doorways and windows start open.
- [x] Bots don't pick operators before you: on your team they wait until you (and every other person) have locked in, then pick, leaning toward roles nobody has taken yet (roughly even, not strictly).

- [x] Maps are too blocky and boring: more interesting shapes (angled walls, curves, alcoves, varied room sizes) instead of plain boxes.
      Done for all six maps (Harbor first, he approved it; the other five after).

- [x] Revamp the loading screen: when a map loads, a softened picture of it drifts slowly behind its name in big letters ("DEPLOYING TO CLIFFSIDE VILLA"), its floors and description; the bar glides smoothly (even while the map is being built) with a sheen running along it, a percentage, what it's doing and a tip; loading steps that follow each other share one screen instead of flickering.

- [x] Side-specific weapons: no gun is carried by both sides now. Attack: the assault rifles, marksman rifles, bolt-action, Mule and Ox, Tusk shotgun, plus a new Javelin SMG and Halberd breaching shotgun (sidearms P10, Bison, Stub). Defence: the SMGs, Hornet, Drummer, Breaker, the Anvil slug for long shots (no marksman rifles), plus a new Sentry carbine and Sparrow pistol (sidearms Vex, Gnat, Sparrow). The Armory shows ATTACK or DEFENCE on each gun.

- [x] Camera/crosshair bouncing before you click in: until you click into the game (or after tabbing out) your aim now stays still instead of following the loose pointer (that, with the camera sliding after it, was the bounce). A "CLICK TO TAKE CONTROL" sign shows; that first click only takes control, it doesn't fire. When you spawn or a round starts the camera is there at once instead of swooping, and the look-ahead outdoors settles more calmly.

- [x] Barricades like R6: every doorway and window starts boarded up. Three melee hits break one (it splinters as you hit it). Rifles, SMGs, LMGs and pistols only chew small holes in it, which you can look and shoot through on purpose; a shotgun needs two blasts; explosives clear it. Defenders can board a broken one up again (fresh boards, no holes).

- [x] See as far as you can be shot from: the camera works out how far you can see in the way you face (ignoring thin slivers through doorways), zooms out only as much as needed and slides ahead so the far end of that sightline is on screen; in rooms it stays close. It widens quickly and narrows slowly so it doesn't jostle. An enemy your team can see but who is off your screen shows as a red ! at the screen edge.

- [x] Shooting through walls takes damage off the bullet: each wall now leaves about half the damage for a rifle (less for SMGs, pistols and shotguns, more for LMGs and marksman rifles; brick takes more off), a bullet that went through a wall can drift off target, and a headshot through a wall is extra damage instead of an instant kill.

- [x] Pick a role before each round: the operator screen first shows five roles per side as big cards (what the job is and who plays it); after choosing, only that role's operators are shown, with tabs to switch until you lock in, and a count of teammates in each role. Attack: Breacher, Entry, Intel, Support, Flank. Defence: Anchor, Trapper, Roamer, Intel, Support.

- [x] Rework the stairs: anyone on a staircase or on the landing at either end also shows on the other floor's steps (marked ▲ ABOVE / ▼ BELOW), so people at the top and bottom can see and shoot each other, both ways. Sound straight up or down the stairs is clear; sounds from another floor get a thud-through-the-ceiling or rumble-from-below colour, and footsteps and gunfire from the floor above or below show ▲ / ▼ arrows round you.

- [x] Spawns and lock-in: every map has 4 attacker spawns and each attacker picks theirs on the operator screen (buttons and a small map showing where teammates start). Attackers are not on the map during preparation (only their drones, which leave from their spawn) and appear at their spawn when the action phase starts. Operator select has no clock: a LOCK IN button, a READY count, and the round starts once everyone is locked in.

- [x] More guns: 15 new ones (23 in all), each with its own handling and a one-line description: Rook battle rifle, Sabre bullpup, Trident 3-round burst, Wasp / Marten .45 (built-in suppressor) / Lark PDW SMGs, Tusk semi-auto shotgun, Anvil slug, Stub sawn-off sidearm, Ox belt-fed and Drummer LMGs, Pike bolt-action, Heron marksman, Gnat machine pistol, Bison revolver. Every operator got one new gun and some a new sidearm; each has its own sound and picture.

- [x] Sound is too loud: quieter by default (opening the game must never blast people's ears), a wider range on the volume slider, and gunshots less aggressive — loud sounds should mask other noises a little, not drown them out so the game feels uncomfortable. *Done 2026-10-30:* volume sliders follow loudness and start ~10 dB quieter, the game fades in, gunshots ~4 dB softer and less harsh, explosions ~5 dB softer, other sounds dip a little under a bang instead of being drowned (docs/sound.md).

- [x] Aiming rework: the first shot goes exactly where the crosshair is (any gun, standing or running, aimed or hip) once the gun has settled; accuracy comes back gradually after each shot (a reset time per gun type, so one-taps can't be spammed); follow-ups stay inside a fixed cone shown truthfully by the crosshair gap (shut = next shot exact); each gun has its own fixed, learnable recoil pattern; shotgun pellets fan round the aim point; quick clicks are never lost and fire with the aim they were made with. The Armory uses the same rules.

- [x] Smarter bots: a Bot skill setting (Easy / Normal / Hard / Expert) in the lobby and Free Play; each bot gets a job each round (entry, support, flanker, intel; anchor, roamer) and its own personality; they breach site walls with their gadgets, use every operator ability, revive and heal teammates, smoke plants, throw grenades at noises, and call out enemies they see.

- [x] Fewer breakable walls: on every map each bomb-site room keeps only the wall to its partner room plus one more; elsewhere about a third of walls stay breakable. The rest are solid grey concrete. Drone holes can be in solid walls too.

- [x] Vaulting like R6: Space climbs over low furniture, windows and the low stub left when a wall is shot or knifed through. No shooting while you climb, and a moment before you can aim again. Bots vault too.

- [x] Floors, part 2: hatches. Wooden trapdoors in upper floors (up to 3 a floor) above rooms below. Defenders reinforce them; melee, shotguns, the hammer, the torch and breach charges open them. You drop through an open one, see a little of the room on the other side, can shoot through it, and hear through it.

- [x] Free play for testing: pick a map (and enemy bots if you want), start straight in the action with no clock, switch to any operator any time with N / B (hint at the bottom of the screen), come back 3 s after dying.

- [x] Defender cameras hang on walls and up in corners (same spots every round), small and dark so they blend in, and break from one bullet, a hit, a blast or their wall coming down.
- [x] Faster aiming: aiming down sights takes about half the time and zooms the view in quickly; the view no longer slowly drifts in and out as you turn.

- [x] Balance pass from ~300-round bot simulations (tests/balance.js, docs/balance.md): Bulwark reworked (pistols, hip-fire, melee knocks the
      shield aside), shotgun pellets can't one-tap headshot, Mule/Hornet/pistols toned down, traps and a few gadgets softened. All operators 39–59%.
- [x] Slower movement, calmer bots that react to sound, loading screens so nothing loads mid-match.
- [x] Lighter on other computers: game updates compressed and trimmed (about 6× less internet traffic per player), "Auto" graphics
      that picks the quality for each computer and lowers it by itself if the game can't keep up, lighter Low setting, no start-up freeze from sounds.
- [x] Gun pictures everywhere guns are chosen or shown (Operators page, pick screen, Armory, in-game ammo corner), with plain type names
      ("Breaker-12 · Shotgun") and a one-line tip. Attachments per gun, saved per operator: barrel (suppressor, compensator, muzzle brake,
      extended), grip (vertical, angled, laser), sight (red dot, holo, 2× scope) — each changes aim speed, recoil, spread, damage or noise a little.
- [x] 15 attackers and 15 defenders (he changed 30 to 15 each). New attack: Rivet (thermal lance), Haze (smoke barrage), Glint (sonar),
      Brisk (adrenal shot), Onyx (cluster charge), Prism (holo decoy), Volt (arc gun), Tether (wall scope), Strider (ghost step), Ferro (hammer).
      New defence: Bramble (proximity charge), Kite (turret camera), Gravel (daze mines), Shunt (static grid), Hush (silent shroud),
      Shade (sound sensors), Rampart (armor bag), Miasma (toxin gas), Snare (clamp traps), Argus (sticky cams). Pick screen: 8 per row + details strip.
- [x] Crosshair settings: style (cross, dot, T, circle…), colour, length, thickness, gap, opacity, outline, opens up when moving; live preview; saved per profile.
- [x] Armory (main menu): private shooting range with every gun, dummies at 5–45 m, real damage/drop-off/spread/recoil/headshots, stats and time-to-kill.
- [x] Site setup like R6: defenders choose which site to defend during operator select; setup tips during prep.
- [x] Floors: every map has 2–3 floors joined by stairs (inside staircases, outside fire escapes, garage ramps); bots use them.
- [x] 5 more maps, chosen in the lobby: Cliffside Villa (B·1F·2F), Rail Depot (1F·2F), The Embassy (B·1F·2F), Alpine Lodge (1F·2F), Clocktower School (1F·2F·3F); Harbor Office got a 2F.
- [x] Realistic footsteps: heel + toe strikes ringing each floor material, sole scuff, crunch grains on gravel/grass/glass.
- [x] Speed: map drawn by the browser as moving tiles, blackout and markers on their own layers — frame time 20 ms → 7 ms.
- [x] Graphics settings: Fullscreen on/off and one quality choice (Low / Medium / High / Ultra).
- [x] R6 aiming: headshots one-tap, ADS accurate even moving (with aim-in time per weapon), recoil you pull against,
      damage drop-off. Peeker's advantage like R6: server judges shots by what the shooter saw (~125 ms + ping).
- [x] Chat: Y opens team chat, / switches team ⇄ all, Enter sends, Esc closes.
- [x] CS2-style controls for players coming from Counter-Strike: run by default (no sprint), Shift = silent walk,
      Ctrl (hold) = silent crouch, E = use, 3 = melee, 4 = gadget, Q = operator skill, 5 = drone/cams, middle mouse = mark.
      Accuracy drops while running (stop or crouch to shoot straight). Ctrl can't close the full-screen window.
- [x] Aiming down sights: narrower field of view, slower movement, lower mouse sensitivity. The mouse is captured in matches
      (Esc releases it and pauses); Mouse sensitivity + ADS sensitivity settings, saved per profile.
- [x] Opens straight into fullscreen: the desktop icon starts its own Firefox window in kiosk mode (no browser bars,
      separate profile). In a normal browser it goes fullscreen on the first click.
- [x] Quit to desktop: Esc on the title screen / menus, QUIT in the side menu, and in the pause menu.
- [x] Softer sounds: all menu sounds reworked to low, warm clicks and whooshes (measured and balanced); in-game chirps
      lowered (hit marker, plant beeps, marking, camera switch, empty click, casings). Flashbangs now ring your ears.
- [x] Settings and key bindings are saved per profile (follow you to any browser/computer).
- [x] Premium feel: title screen with logo reveal, original menu music (dark, layered, not corny; own volume slider),
      main menu with side navigation and sliding highlight, player card with level/XP, rotating tips, hover/click sounds and
      ripples on every button, animated pages, operator cards that deal in and lock in, 3-2-1-GO countdown, sliding kill
      feed and banners, end-of-match screen with MVP, stats counting up and an XP bar with level-ups.
- [x] Pause screen (Esc or P). In fullscreen, Esc leaves fullscreen and opens the pause menu.
- [x] Drone: about a foot long, half as wide (a low rectangle), one small red dot in the middle of the top; wheels spin, it leans and sways; can't drive under furniture
      (still fits through barricade gaps); soft electric motor sound instead of the whine.
- [x] Drones break: 1 hp, so one bullet, melee hit, blast or zap destroys one (shots count where you saw it moving); the pilot drops back to their body and their team is told; defender bots shoot drones they see.
- [x] Realistic gunshots: pre-built recordings per weapon (crack, blast, boom, echo off walls, action click).
- [x] Operators page: bio, armor/speed, skill, loadout choices (primary, secondary, gadget), your stats with them.
- [x] Saved profiles for everyone who plays: loadouts and lifetime stats (Profile page).
- [x] Match history: every finished match with each player's stats and round-by-round results.
- [x] Sound mix balanced by measurement (see docs/sound.md).
- [x] Weighty movement with real steps: you speed up/slow down, speed pulses with each stride, and each footstep sound
      plays exactly when a foot plants.
- [x] Footstep sounds for every surface: wood, tile, marble, carpet, concrete, asphalt, grass, metal floor, rubble,
      broken glass under windows, splinters where barricades were smashed.
- [x] Grey "remembered" map instead of black: out-of-sight areas show as a dull grey map.
      Shared vision (you, teammates, their drones, working defender cameras) shows live in colour.
      Enemies/enemy gadgets only show inside shared vision. Enemy-made map changes out of
      your team's sight stay hidden until someone on your team sees them.
- [x] Security cameras you aim with the mouse and switch between (A/D, arrows, wheel, camera bar).
- [x] More keys like Siege: slow walk (Alt), 4 = operator skill, 3 = gadget, F = interact,
      T / middle click = mark enemy, plus a settings screen (O) to change any key and the volume.
- [x] Much better sound: footsteps per floor surface, small sounds for nearly everything
      (turning on the spot, aiming, crouching, reload stages, swaps, hammering…), muffled
      through walls, room echo, bullets whizzing past, drone motors, heartbeat when hurt.
- [x] Legs move when a character turns on the spot.
- [x] More detailed characters.
- [x] Zoom in closer; only zoom out outside or down long hallways. Camera stops at the map edge.
- [x] Even closer zoom (about a quarter closer everywhere, drones too).
- [x] Field of view like a modern shooter (≈103°, narrower when aiming down sights).
- [x] First playable version (5v5 Quick Match, 10 operators, Harbor Office, bots).
- [x] Desktop / app-menu shortcut.
