# r6-todo — ideas for R62D

insideabush's list of next ideas. Claude works through it top to bottom: when one item is
finished it gets ticked and moved to **Done**, then work continues on the next one.
Only ideas he asks for go in **To do** (added to the bottom). Claude never adds its own suggestions here.

## To do

- [ ] get hosting when connecting to lando's vpn working so that lando can join from his LAN. Lando thinks this could be a firewall problem in his homelab. (checked: the game already listens on every network; what is left is on Lando's side — his homelab firewall has to let port 6262 through from his LAN to the VPN)
- [ ] give the maps a big rework to make them larger (not more floors but more floorspace) and make the buildings not rectangles, L shaped buildings could be good for 1 or 2 of them but lets get creative
- [ ] lets see if we can get faster than 6.7ms a frame on high, if there are any optimization possible we can look at that help this run light as possible without sacrificing gameplay or UI (tried 2026-11-02: faster in the test browser but laggy in his real Firefox, undone)

## Done

- [x] Settings: every slider has a box you can type the number into (Enter or click away to set it). Text size now changes when you let go of the slider (it used to resize the panel under the mouse while dragging), goes from 70% to 160%, and menus stop growing once they fill your screen instead of spilling off it.
- [x] The pros play many more operators: each can now pick any operator of their role (their favourites still come up most, what won in practice more, and last round's pick less). They also have more plays: attack adds Three-way pinch, Late hit, Window hit and Lurk and collapse; defence adds Turtle, Bait, Two rooms and Hunter (7–9 plays per site each side, was 3–5). Practice tries them all, and the later plays in a team's style still get called. Tested: 4–8 different plays per map, still beating Expert bots 6–1.
- [x] Leaning is a toggle by default: Q or E once to lean, again (or the other side) to stand straight; dying or going down straightens you. Settings → Mouse & Aim → Leaning switches back to Hold.
- [x] 6 puts out your drone and drives it (6 again: back to your body; if it's already out, 6 takes it back). 5 only opens your team's drones and cameras, never puts a drone out. On a drone or camera, Q / E flip to the previous / next feed; teammates' drones are watch-only. A controller or phone keeps its one DRONE / CAMS button.
- [x] Settings rebuilt: sections down the left (Sound, Mouse & Aim, Keys, Screen, Crosshair) and only the chosen one shows, each setting on its own row with a plain line saying what it does. Keys are grouped (Moving, Fighting, Drones/Cameras & Team, Menus & Free Play). It remembers the last section you looked at.
- [x] When a defender steps outside, every attacker gets a pulsing red DEFENDER OUTSIDE banner at the top of the screen with who it is and where ("ARGUS · NEAR WEST GARDEN"), and a short two-tone alert. Two or more show as "2 DEFENDERS OUTSIDE".
- [x] Lie down with C (Ctrl is crouch only now): a quick drop (0.3 s), crawl as fast as a crouch, silent, aim like a crouch; Ctrl, Space or C again gets you up. Lying down you see (and shoot) under desks, tables, benches, market stalls, chairs, cars, vans and trains, but your body never fits under, so nobody can hide there. Drones (yours, teammates' and the bots') drive and see under the same things.
- [x] Bots stand around less. A bot that stays in one small area with no enemy in sight gets impatient and makes a play: attackers stop waiting and push to a fresh spot, often going round to come in from an unexpected side; defenders take a new angle, and bolder ones step out into a room beside the site. The more experienced (higher rank) a bot is, the longer it waits first. Paranoia: a bot that is alone and hears something keeps sweeping every way in, not just the one the sound came from. Also fixed bots (roamers especially) that walked into a wall and stood there all round when they had no route to their spot. Measured: idle time without a fight went from about half the round to 40%, and the longest attacker standstill from 96 to 17 seconds.
- [x] Esports TV: the auto director keeps count of how long each team has been on screen and leans toward the team that has had less, while a really exciting moment still wins. Viewers now see what both teams see, each team's sight faintly tinted in its own colour.
- [x] Preparation is 10 seconds shorter (30 s instead of 40).
- [x] Doors no longer start the match planked: the defending bots used to board every site door the instant preparation began; now they put the boards up one at a time through preparation, taking as long as a person would. Windows still start boarded.
- [x] Bullets break wooden planks: any gun's bullets wear a planked door or window down, and 320 damage of bullets in all brings the whole board down (about 11 rifle rounds). Holes and the shotgun/melee rules work as before.
- [x] Seeing up and down stairs is now live and part of the map: near a staircase you can see, the floor at the other end shows right where the steps lead (the lobby at the bottom, the landing at the top), in live colour, with the people there, fading softly into the map, instead of the small window in the corner. Going up or down, the camera now carries straight on to the same spot on the new floor instead of jumping.
- [x] Operators window spread out: it fills almost the whole screen now, the picture is a little smaller so the words get the width, and the bio and skill text are bigger with more room between lines and sections. (The "Who are you?" name box was squashed into narrow columns by an old leftover style; fixed too.)
- [x] Slow mouse moves now always reach the game: Firefox on this desktop throws away mouse steps smaller than a pixel, and mouse acceleration turns slow moves into exactly those. Opening the game now switches the mouse to flat (every step counts 1:1) and puts your old setting back when you close it, so nothing needs changing on your computer.
- [x] Lighter server: the 12 GB came from connections that died without closing (a dropped VPN, a sleeping laptop): the server kept saving every update for them forever, and an Esports TV or Free Play game left behind that way kept running for nobody (which also slows the computer). Now every browser is checked every 5 s and dropped after 30 s of silence, a connection that stops taking updates is cut at 1 MB, and the pro practice thread can never use more than half a gigabyte. The game itself was checked over 56 back-to-back bot matches and doesn't grow. Lando gets it when you release it to him.
- [x] Phones keep everything (he chose) but the menus are re-proportioned: the tabs are a strip across the top that scrolls sideways, every page gets the full width, and Settings is split into pages (Sound, Aiming, Controls, Screen, Crosshair, Keys).
- [x] Killcam: when you die, F (or WATCH KILLCAM) replays the last seconds through their eyes, then yours, then a BS rating out of 10 with the reasons (never on your screen, through a wall, lag, from behind, too fast, teammate). A "!" shows when something impossible happened, and it is saved as a bug report in the game's data/bugs folder.
- [x] Riot shields as the 3rd primary for six operators, each with its own personality: Onyx AEGIS WALL (huge, slow, hard bash), Brisk VISOR (light, fire round it, narrow), Hammer BATTERING RAM (bash smashes barricades, long miss), Rampart BASTION (plant it crouched for more cover), Solace GLASS GUARD (fastest to swing aside, cracks), Wraith THORN (stun bash, recharges). Balanced over 200+ pro rounds (docs/balance.md).
- [x] Esports TV director rebuilt the way broadcast observers work: it reads the map for fights about to happen and cuts there a few seconds early, holds each shot, never leaves a fight in progress, cuts to the killer when the followed player dies, stays with clutches and players on a streak, opens the action with a map shot and moves on from quiet players.
- [x] Defender bots look through the cameras when it is quiet, or for a quick look when enemies are heard coming and nobody knows where; never with an enemy close. They spot what the cameras see.
- [x] Bots never shoot when a teammate is in the line of fire and step off a teammate's line; one defender takes space in a room beside the site while two hold it; everyone watches the clock (attackers stop waiting and run late in the round, roamers come back).
- [x] Audit's radar pings each drone once, then only again when it has moved on.
- [x] No more slow spinning: bots (and parked drones) look at one doorway or angle, hold it, then snap to the next.
- [x] Every site has a breakable wall between its two rooms (Harbor Office's 2F Boardroom / IT Room was solid).
- [x] Reviving works: the downed person can no longer crawl out of reach mid-revive, and F next to a downed teammate revives instead of grabbing a rope.
- [x] Bots no longer shoot at someone they can see but not hit (behind a deployable shield or cover): they move for an angle or throw a grenade.
- [x] Found why: every pro defence plan had nearly everyone watch the same way in (often the stairs). Now each defender watches a different way in, windows included, and ordinary bots spread out too.
- [x] Site rooms above ground get windows until they have two where one fits (a few sites have no outside wall to put one in).
- [x] Every operator has a starter set of attachments (by gun type and role); changing one saves your choice instead.
- [x] Bots always lock in (a role left over could make a bot's pick fail forever).
- [x] Watched views (spectating, Esports TV) no longer jitter: bots' hands drift smoothly and the watched view cone is eased.
- [x] Bots talk much less: below Diamond they mostly ping; Diamond and up talk about the objective; pros leave longer gaps.
- [x] Pros practice 200 rounds per new version, not daily; "Practising" is now "Practicing".
- [x] Stairs show chevrons along the steps (gold up, blue down) and a label at each end: "▲ UP TO 2F" / "▼ DOWN TO 1F".
- [x] Pros waiting for the go move between spots round the stack and say how it looks; defenders shift angle every 20–30 s.
- [x] Bots no longer swing at a boarded window forever: the swing could land on Rampart's deployable shield beside it and hit nothing. Fixed, and bots go another way if a swing can't reach.
- [x] Yes, Rampart's deployable shield was it (see the item above). Defender bots also stop smashing their own panels and barricades.
- [x] Defenders can walk outside any time: outside doors start open (windows stay boarded). A defender standing outside is shown to the attackers and told so.
- [x] Glint's pulse reaches the floor above and below (a little less far than on its own floor).
- [x] Talon's EMP: 3 a round, about 1 m wide, destroys every enemy gadget, blinds cameras 20 s, and fries the skill and gadget of defenders caught in it for 8 s (they're told).
- [x] Onyx's charge beeps loudly for a second before it goes, then fires three waves of bomblets 0.6 s apart, the last a little bigger.
- [x] Volt's arc gun only makes a faint crackle, heard up close and silent past about half a room.
- [x] Ferro's hammer only breaks door and window barricades (no walls), with 4 s between swings. Hammer's breaching rounds went from 5 to 3, so only Ember, Hammer, Salvo and Rivet open walls without a charge or grenade.
- [x] Torque's disc goes straight through a wooden barricade leaving one round disc-sized hole, nothing else broken.
- [x] Rivet's lance works on any wall (even concrete): first a bullet-sized hole you can see and shoot through, widening as you keep carving until the block falls out (~9 s).
- [x] Bulwark's shield only sways when jogging, never when walking or aiming.
- [x] Bulwark: holding aim-in glides the shield aside over ~0.45 s and he can only shoot once it's fully aside; letting go brings it back.
- [x] Bulwark's head is a smaller target (60%), and the shield still covers it from the front.
- [x] Crow aims at one enemy within 4 m to mark them; they hear the blade and get a warning; after 1.5 s her melee is a 4 m lunge straight at them.
- [x] Wraith's scanner is a toggle: press to start, press again to stop (4 s at most).
- [x] Lens's periscope says why it can't go somewhere, and where it went (and to open the camera feeds) when it does.
- [x] Trench's cover is a thin steel plate at any angle (square to your aim), can stand right next to another, stops bullets, sight and bodies, and can be vaulted.
- [x] Placed gadgets and skills take 1.2 s to set up (you stand still); thrown ones have a 0.5 s wind-up (slowed, can't shoot). A ring round you fills with THROWING / SETTING UP.
- [x] While the defuser runs, a pulsing two-tone alarm plays through the building: louder close by, muffled far away, never overpowering.
- [x] Teammates in words: a small list on the left shows each teammate, their operator and the room and floor they are in (or dead, downed, on a drone, on cams).
- [x] The OBJECTIVE FOUND card is small, see-through, near the top and gone in 3.5 s; BOMB ON <floor> is the biggest line, with YOU ARE ON … GO UP/DOWN under it. A small gold arrow by your feet always points the way to the stairs / bomb site.
- [x] Camera lights: your team's cameras blink green, the enemy's red (blue when knocked out).
- [x] Every gadget is drawn a little bigger and wears a small symbol badge in its team's colour (claymore triangle, paint drop, barbed zigzag, radar, bell, gear, eye…), so you can tell what it is without pinging it.
- [x] Esports TV: what a player says floats above them on a solid dark card in their own colour, and the side comms are bigger and solid.
- [x] Esports TV: everyone's outline (team-coloured, with the way they face) shows through walls; only the followed player's sight is live.
- [x] Every player card on the broadcast has a live drawn webcam: pros look sharp (headset, team jersey, studio light), everyday bots look like they're at home (messy hair, crooked glasses, crisps, a lamp). Each keeps the same face, and the Playbook's pro profiles show it too.
- [x] AMATEUR HOUR: on the Esports TV tab pick a league: PRO LEAGUE or AMATEUR HOUR at any rank from Copper to Champion. The bots play at that rank and talk like it: Copper and Bronze each have a bit (singing, rapping, arguing with their mum, open mic, lost), Silver and Gold make basic calls, Platinum and up call like a team.
- [x] Everyday bots have their own names (Dusty, Pickles, Gerald, Noodle, Biscuit…), never a pro's or a gun's.
- [x] Each gun sets its own walking (Shift) and aiming-in speed: pistols and machine pistols quickest, then SMGs, shotguns, rifles, marksman rifles, LMGs slowest. Aiming in while holding Shift moves at the aiming speed (no extra benefit). How loud your steps are follows how fast you actually move: walking and crouching silent, moving while aiming in faint, jogging loud.
- [x] Free play: O opens the free play menu (operators, add bots/dummies, and switches for GOD MODE and BOTS SHOOT). Settings moved to F1 so O isn't shared.
- [x] New keys: Q / E lean left / right (hold: only the upper body tips to the side and you see and shoot from there; your feet never move), F use, 1/2/3 primary/secondary/melee (or the wheel), 4 skill, G gadget. Space jumps: you can jump up onto low furniture (walk off to get down); windows and wall stubs are still vaulted. Someone up on furniture or mid-jump has a shadow and a dashed ring and is drawn a little bigger; shots fired mid-jump spray wide; landing makes a thump. Everyone's keys switch to the new layout once.
- [x] Driving a drone or watching a camera, the cursor is a big green ring with a black edge and a centre dot.
- [x] The crosshair always keeps about an eighth of the screen of room past it; pushing further slides the view along.
- [x] Ctrl is crouch, so Ctrl+W (crouch while moving forward) was closing the game window. The game now blocks Ctrl shortcuts during a match, and the desktop game window lets it.
- [x] Settings has SCREEN EFFECTS switches: screen shake, red edges when hurt, hit markers, points pop-ups, sight glow, bomb-site compass, stairs preview window, bomb-site found card, dark screen corners (remembered on each computer).
- [x] Free play: the operators screen (O, or the button at the bottom) has + ENEMY BOT, + TEAM BOT, + DUMMY and REMOVE ALL (up to 9). A dummy stands still 3 m in front of you, facing you, and comes back to the same spot 3 s after it goes down.
- [x] Fixed: an attacker whose drone broke in preparation got their body back while still waiting off the map and could fire; now nothing (shooting, melee, gadgets, skills, vaulting) works until you're on the map.
- [x] Boards crack with each melee hit: small cracks after the first, long branching cracks with a snapped middle plank and a dent after the second, broken on the third.
- [x] Esports TV: A switches the auto director on and off; off, it stays on whoever you're watching.
- [x] Esports TV: in preparation the director cuts round the defenders as they place gadgets, reinforce and board up; shooting, plants and close fights still come first.
- [x] From Gold up, attacker bots pull their drone back to safety when a defender gets close or preparation is ending (Diamond keeps about 70% alive, Silver about 10%); the risk-takers among the pros still push. From Gold up one defender waits by the stairs nearest the site to shoot drones.
- [x] Batch done with the most game-changing items first.
- [x] Defenders move to a new spot round the site every 10-28 s while nothing is heard. Gunshots, blasts and breaking glass carry through the whole building (faint and muffled, also a floor up or down), for you and for the bots, unless the building is huge.
- [x] From Gold up, defender bots board every way into the site, put out all their wire/claymores at different doors and a deployable shield facing a way in; Silver and below are sloppier.
- [x] Map Knowledge: scroll to zoom smoothly toward the pointer (up to 7x), drag to move, double-click for the whole floor.
- [x] The revolver is drawn as a real revolver (frame, fluted cylinder, ribbed barrel, hammer, curved wooden grip), and in matches each gun shows its own shape: cylinder, double barrels, pump grip only on pump guns, built-in suppressor, drum, ammo belt, bolt handle, bullpup magazine. The new semi-auto attachments have pictures.
- [x] Each sight has its own faint look while aiming in: red dot = soft red glow, holo = broken cyan ring, prism = amber chevron, 2x scope = slightly darkened screen edges and range ticks. Nothing covers the middle.
- [x] Bot difficulty is now the ranks: Copper, Bronze, Silver, Gold, Platinum, Diamond, Champion, and Pro (the pro teams). Silver is the default.
- [x] RANKED button in the lobby: everyone starts Silver (1400 MMR), empty slots on both teams fill with bots at the lobby's average rank, a win raises and a loss lowers your MMR (more for beating stronger teams). Rank badges in the lobby and on your profile card; the end screen shows the MMR change and rank ups.
- [x] The crosshair moves away from you 1.3x faster (coming back stays the same), and aiming in starts it at a distance that suits the sight: iron 2.5 m, holo 3, red dot 3.5, 1.5x prism 5, 2x scope 6.5 (match and Armory).
- [x] Semi-autos (pistols, revolver, marksman rifles, slug) lose the spray-only attachments and get their own: Match Barrel (tighter aimed shots, longer reach, slower to aim), Trigger Kit (exact again 25% sooner after a shot, looser hip fire) and Recoil Pad (each shot kicks 30% less, a little slower to aim).
- [x] Wasp toned down: 30 rounds, violent sideways shake, slower to aim, damage falls off fast. Halberd and V9 removed (their operators got other guns). Guns pulled apart: Hornet = easy-control machine pistol, Sentry = slow hard-hitting carbine, Longbow = heavy two-tap DMR (Heron stays the quick three-tap), Trident bursts are slower, Ox = heavy slow belt-fed, Mule = steady LMG, Drummer = fast wandering hose, K4 = the all-rounder.
- [x] No more endless revives: a bot gives up on a revive it can't get started within ~7 s (out of reach or blocked) and tries again later, and a pro doesn't walk into a revive with an enemy just seen or heard right there unless the teammate is about to bleed out.
- [x] Esports TV's Esc menu works: its pages (operators, settings, profile) open on top instead of under the TV overlay, and Resume no longer grabs the mouse.
- [x] The pros talk: changes of plan always (go, switch, rotate, retake, two down, out of time), and the specific information pings can't carry: who they see, where and how many ("Ward, IT Room, 2 of them"), what their drone finds, footsteps they hear, kills and trades, who got them and from where when they die, "planting B, cover me", "I'm one shot", their utility. Not constant chatter: a few seconds between lines each, and nobody repeats what a teammate just said; only what they actually saw, heard or know. In Esports TV each team's comms run live under its player cards; on your team they appear in team chat. Objective markers in TV stay clear of the cards.
- [x] The pros train every day: your computer plays practice matches between them in the background (no AI service, so no tokens): once a day, and again when the game's version changes, only while no match is being played (it stops the moment one starts). They try every plan and operator, and in real matches they lean towards what has won on that map, site and side. TRAIN THE PROS button on the Esports TV and Playbook pages starts a session now and shows when they last practised; the Playbook shows each plan's practice win rate.
- [x] Esports TV (menu tab): pick a map or Random and watch Northwind play Ironclad Collective, match after match on a new map. A broadcast view: the camera cuts by itself to where it matters (a plant or defuse, a fight, the defuser carrier, the last one alive), 1-5 / 6-0 or clicking a player card follows someone, A goes back to the director, M shows the whole map. Team names, score and player cards (operator, health, alive) at the sides, the kill feed, and each team's plan calls in the corner. Checked for clutter (he asked: the view is sacred): no player HUD, prompts, compass, crosshair, big death marks or corner buttons over the action; calls are one short line each.
- [x] Playbook: ▶ WATCH THIS PLAY shows each plan playing out like a coach's whiteboard: the players as dots moving through it (drones in preparation, stacking, the breach, the go, the plant and the spread), the clock, a caption for each beat, and the other team faded in its usual spots.
- [x] The pros spread out instead of bunching on one spot (he asked: one grenade or gas cloud could take a whole stack): about 2 m apart when waiting, a little tighter for a fast rush; defenders too.
- [x] Pro teams: a new bot skill "Pro" brings in two named esports teams, Northwind [NWD] (fast, aggressive) and Ironclad Collective [IRC] (slow, methodical), five players each with their own job on each side, operators, strengths and flaws, and an in-game leader. Every round the leader picks a plan from the team's playbook (built for every map, site and side: Default, Fast hit, Split, Vertical, Fake; Hold the site, Deep roam, Crossfire, Retake, Vertical control), calls it in team chat, and changes it on the fly (two down early, clock under a minute, the way in stacked, rotate, retake). They drone to find the objective and keep a drone for the push, stack out of sight beside the way in, hold off-angles, trade each other, and everything serves the objective (plant, then hold the defuser from spread-out angles; on defence hold the bomb, then retake against the clock). Human limits: human reaction times (never under ~0.17 s), a human field of view, hearing as vague as yours, and they aim with a mouse on a mousepad (each their own sensitivity: low = steady but slow to turn round with mouse lifts, high = fast flicks but shakier), so crosshair placement is what wins them fights. Strafe-peeking is now a rare skill for all bots (mostly the two entry fraggers among the pros). PLAYBOOK tab to study every plan on the map. The bot match test and the balance report now use the pros as their players. In tests the pros beat Expert bots about 3 rounds to 1.
- [x] Sound no longer tells you exactly where to shoot blindly: the orange arcs pointing at running enemies and the red arcs pointing at gunfire on another floor are gone. What stays: footsteps or gunfire on the floor just above or below show as a faint "▲ FOOTSTEPS ABOVE" / "▼ GUNFIRE BELOW" with no direction, and the game's own sound through walls or floors is blurrier about which side it comes from (still muffled and quieter as before). Pings, spotted marks, hit markers and seen-enemy edge marks are unchanged.
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
