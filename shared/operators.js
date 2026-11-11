// Weapons and the 30 operators (15 attack, 15 defence).

export const WEAPONS = {
  k4:      { name: 'K4 Carbine',   cls: 'AR',      dmg: 31, rpm: 720, mag: 30, reserve: 150, reload: 2.4, spread: 0.06, ads: 0.014, bloom: 0.012, auto: true,  pellets: 1, range: 1100, len: 15,
             trait: 'The all-rounder: nothing it does badly, nothing it does best.' },
  breaker: { name: 'Breaker-12',   cls: 'Shotgun', mode: 'pump-action', dmg: 15, rpm: 78,  mag: 7,  reserve: 42,  reload: 3.1, spread: 0.16, ads: 0.11,  bloom: 0,     auto: false, pellets: 8, range: 420,  len: 14 },
  mule:    { name: 'Mule LMG',     cls: 'LMG',     dmg: 29, rpm: 640, mag: 80, reserve: 160, reload: 4.4, spread: 0.09, ads: 0.024, bloom: 0.008, auto: true,  pellets: 1, range: 1100, len: 17,
             adsMul: 1.1, kickMul: 0.85, swayMul: 0.8, trait: 'The steady LMG: 80 rounds that stay where you put them, a little slow to aim.' },
  longbow: { name: 'Longbow DMR',  cls: 'DMR',     dmg: 66, rpm: 260, mag: 10, reserve: 50,  reload: 2.7, spread: 0.06, ads: 0.004, bloom: 0.02,  auto: false, pellets: 1, range: 1300, len: 18,
             kickMul: 1.4, settle: 0.6, trait: 'A heavy marksman rifle: two body shots drop anyone, but it jumps hard and needs a moment between shots.' },
  hornet:  { name: 'Hornet MP',    cls: 'MP',      dmg: 24, rpm: 760, mag: 30, reserve: 150, reload: 1.6, spread: 0.08, ads: 0.03,  bloom: 0.010, auto: true,  pellets: 1, range: 800,  len: 8,
             kickMul: 0.7, swayMul: 0.7, fall: { from: 200, to: 480, min: 0.55 }, trait: 'A machine pistol tamed for control: easy to keep on target and quick to reload, but it loses its punch past one room.' },
  vex50:   { name: 'Vex .50',      cls: 'Pistol',  dmg: 50, rpm: 210, mag: 7,  reserve: 35,  reload: 2.0, spread: 0.06, ads: 0.012, bloom: 0.04,  auto: false, pellets: 1, range: 900,  len: 8 },
  p10:     { name: 'P10 Sidearm',  cls: 'Pistol',  dmg: 34, rpm: 420, mag: 15, reserve: 60,  reload: 1.6, spread: 0.05, ads: 0.016, bloom: 0.02,  auto: false, pellets: 1, range: 900,  len: 7 },
  // More guns (he asked: "every gun should have its own properties, none of them too similar"). Besides the numbers
  // above, a gun can change its class's handling: adsMul (time to aim), kickMul / swayMul (recoil), settle (s until
  // the next shot is exact again), fall (damage drop-off), burst (shots per click), quiet (built-in suppressor).
  rook:    { name: 'Rook Battle Rifle', cls: 'AR', dmg: 40, rpm: 540, mag: 20, reserve: 120, reload: 2.7, spread: 0.065, ads: 0.012, bloom: 0.016, auto: true, pellets: 1, range: 1300, len: 17,
             pen: 0.62, adsMul: 1.15, kickMul: 1.8, swayMul: 0.7, fall: { from: 520, to: 900, min: 0.8 }, trait: 'Hits hard and keeps its damage far away, but kicks hard and holds only 20 rounds.' },
  sabre:   { name: 'Sabre Bullpup', cls: 'AR', dmg: 28, rpm: 820, mag: 30, reserve: 180, reload: 2.9, spread: 0.055, ads: 0.016, bloom: 0.011, auto: true, pellets: 1, range: 1000, len: 12,
             adsMul: 0.8, kickMul: 0.85, swayMul: 1.3, trait: 'Short, quick to aim and fast-firing; slow to reload, and its spray wanders sideways.' },
  trident: { name: 'Trident Burst', cls: 'AR', dmg: 34, rpm: 900, mag: 30, reserve: 150, reload: 2.3, spread: 0.05, ads: 0.010, bloom: 0.010, auto: false, pellets: 1, range: 1150, len: 15,
             burst: 3, burstGap: 0.28, kickMul: 0.8, trait: 'Three-round burst with every click: deadly accurate in bursts, but it can\'t spray.' },
  wasp:    { name: 'Wasp SMG', cls: 'SMG', dmg: 18, rpm: 1100, mag: 30, reserve: 180, reload: 2.3, spread: 0.08, ads: 0.026, bloom: 0.011, auto: true, pellets: 1, range: 800, len: 11,
             kickMul: 1.1, swayMul: 2.1, adsMul: 1.15, fall: { from: 160, to: 420, min: 0.5 }, trait: 'The fastest-firing gun there is and deadly within a few metres, but 30 rounds go in under two seconds, it kicks hard sideways and its damage falls away fast.' },
  marten:  { name: 'Marten .45', cls: 'SMG', dmg: 26, rpm: 640, mag: 25, reserve: 150, reload: 2.1, spread: 0.065, ads: 0.020, bloom: 0.010, auto: true, pellets: 1, range: 850, len: 13,
             quiet: true, kickMul: 0.75, swayMul: 0.6, settle: 0.26, fall: { from: 240, to: 520, min: 0.6 }, trait: 'Built-in suppressor with no damage lost: quiet, steady and slow-firing.' },
  lark:    { name: 'Lark PDW', cls: 'SMG', dmg: 21, rpm: 860, mag: 50, reserve: 200, reload: 2.6, spread: 0.07, ads: 0.018, bloom: 0.010, auto: true, pellets: 1, range: 1000, len: 12,
             kickMul: 0.95, fall: { from: 380, to: 700, min: 0.75 }, trait: 'A 50-round magazine that keeps its damage at rifle range, but each bullet is weak.' },
  tusk:    { name: 'Tusk Auto-12', cls: 'Shotgun', dmg: 11, rpm: 260, mag: 8, reserve: 48, reload: 3.4, spread: 0.17, ads: 0.13, bloom: 0, auto: false, pellets: 8, range: 380, len: 15,
             kickMul: 0.7, settle: 0.3, trait: 'Semi-automatic: fires as fast as you click, but each blast is weaker and wider.' },
  anvil:   { name: 'Anvil Slug', cls: 'Shotgun', mode: 'pump-action', dmg: 76, rpm: 85, mag: 6, reserve: 36, reload: 3.2, spread: 0.07, ads: 0.008, bloom: 0.03, auto: false, pellets: 1, range: 900, len: 15,
             pen: 0.6, kickMul: 1.3, fall: { from: 200, to: 600, min: 0.5 }, trait: 'One heavy slug: accurate, huge damage and smashes walls, but very slow to fire.' },
  stub:    { name: 'Stub Sawn-off', cls: 'Shotgun', mode: 'double-barrel', dmg: 13, rpm: 300, mag: 2, reserve: 20, reload: 2.4, spread: 0.22, ads: 0.18, bloom: 0, auto: false, pellets: 9, range: 260, len: 9,
             fall: { from: 50, to: 200, min: 0.2 }, trait: 'A sidearm with two barrels: blow holes in walls and hatches, or end a fight at arm\'s length.' },
  ox:      { name: 'Ox Belt-Fed', cls: 'LMG', dmg: 36, rpm: 480, mag: 100, reserve: 100, reload: 6.0, spread: 0.10, ads: 0.022, bloom: 0.009, auto: true, pellets: 1, range: 1200, len: 18,
             adsMul: 1.35, kickMul: 1.3, swayMul: 0.5, trait: '100 rounds that hit like a battle rifle and climb straight up, but it fires slowly, is very slow to aim and takes an age to reload.' },
  drummer: { name: 'Drummer LMG', cls: 'LMG', dmg: 22, rpm: 860, mag: 60, reserve: 180, reload: 3.6, spread: 0.085, ads: 0.026, bloom: 0.009, auto: true, pellets: 1, range: 1050, len: 16,
             adsMul: 0.8, kickMul: 0.8, swayMul: 1.5, trait: 'A light, fast-firing LMG that hoses a doorway: quick to aim and reload for its kind, but its soft bullets wander side to side.' },
  pike:    { name: 'Pike Bolt-Action', cls: 'DMR', mode: 'bolt-action', dmg: 112, rpm: 50, mag: 5, reserve: 30, reload: 3.2, spread: 0.09, ads: 0.002, bloom: 0.05, auto: false, pellets: 1, range: 1600, len: 20,
             pen: 0.8, adsMul: 1.3, kickMul: 1.5, settle: 0.9, oneShot: true, trait: 'Aimed in through the sniper scope, one clean body shot drops anyone. A slow bolt between shots, slow to aim, hopeless from the hip; its scope glints at whoever it points at.' },
  // he asked: a sniper that feels more modern, tan, like a British L115 (our own design and name): a straight-pull bolt
  // that cycles fast, quicker to aim, a big muzzle brake that tames the kick but is loud. Still one shot to the body.
  saker:   { name: 'Saker LR', cls: 'DMR', mode: 'straight-pull', dmg: 120, rpm: 72, mag: 5, reserve: 30, reload: 2.9, spread: 0.09, ads: 0.0018, bloom: 0.05, auto: false, pellets: 1, range: 1700, len: 21,
             pen: 0.7, adsMul: 1.15, kickMul: 1.15, settle: 0.75, oneShot: true, trait: 'Modern long-range rifle: aimed in through the sniper scope, one clean body shot drops anyone, and the straight-pull bolt is back on target faster than the Pike. Thinner walls stop more of it; loud, and its scope glints.' },
  heron:   { name: 'Heron Marksman', cls: 'DMR', dmg: 44, rpm: 480, mag: 20, reserve: 100, reload: 2.4, spread: 0.055, ads: 0.007, bloom: 0.014, auto: false, pellets: 1, range: 1200, len: 16,
             adsMul: 0.85, kickMul: 0.7, settle: 0.4, trait: 'A quick-firing marksman rifle with light recoil: three fast hits drop anyone.' },
  gnat:    { name: 'Gnat Machine Pistol', cls: 'MP', dmg: 17, rpm: 1050, mag: 20, reserve: 100, reload: 1.7, spread: 0.09, ads: 0.035, bloom: 0.011, auto: true, pellets: 1, range: 700, len: 7,
             kickMul: 1.2, swayMul: 1.4, fall: { from: 200, to: 450, min: 0.55 }, trait: 'A full-auto sidearm: 20 rounds gone in about a second, fierce recoil.' },
  bison:   { name: 'Bison Revolver', cls: 'Pistol', dmg: 64, rpm: 130, mag: 6, reserve: 30, reload: 3.0, spread: 0.05, ads: 0.006, bloom: 0.05, auto: false, pellets: 1, range: 1000, len: 9,
             pen: 0.55, kickMul: 1.8, settle: 0.6, fall: { from: 400, to: 700, min: 0.8 }, trait: 'Two body shots drop anyone. Six rounds, slow to fire and reload, very accurate.' },
  // he asked for side-specific weapons (no gun on both sides), so attack and defence each got the guns they were missing
  javelin: { name: 'Javelin SMG', cls: 'SMG', dmg: 25, rpm: 800, mag: 30, reserve: 180, reload: 2.2, spread: 0.065, ads: 0.019, bloom: 0.010, auto: true, pellets: 1, range: 950, len: 12,
             adsMul: 0.85, fall: { from: 320, to: 620, min: 0.65 }, trait: 'The attackers\' SMG: quick to aim, steady, good on the move.' },
  sentry:  { name: 'Sentry Carbine', cls: 'AR', dmg: 33, rpm: 600, mag: 25, reserve: 125, reload: 2.3, spread: 0.058, ads: 0.016, bloom: 0.012, auto: true, pellets: 1, range: 900, len: 13,
             adsMul: 0.85, kickMul: 0.6, fall: { from: 260, to: 520, min: 0.65 }, trait: 'A slow, hard-hitting defender\'s carbine: very easy to control and quick to the shoulder, but only 25 rounds and it weakens down long halls.' },
  sparrow: { name: 'Sparrow Compact', cls: 'Pistol', dmg: 28, rpm: 520, mag: 17, reserve: 68, reload: 1.4, spread: 0.05, ads: 0.017, bloom: 0.018, auto: false, pellets: 1, range: 850, len: 6,
             trait: 'A light, quick pistol: fast to fire and reload, but hits softer.' },
  // He asked (2026-11-10): two more of every type, each one unique ("I would rather a gun not be in the game than be
  // effectively a remake of another"). Every gun below does one thing no other gun does: its own rule (spin, bipod,
  // dual, tandem, raise, stagger, wallShot) or a niche nobody else fills.
  // assault rifles
  verdict: { name: 'Verdict DMR-Carbine', cls: 'AR', dmg: 26, rpm: 700, mag: 24, reserve: 120, reload: 2.5, spread: 0.065, ads: 0.010, bloom: 0.013, auto: true, pellets: 1, range: 1250, len: 16,
             dual: { dmg: 47, rpm: 330 }, kickMul: 1.1, trait: 'Two guns in one: full-auto from the hip, but aimed in it fires single heavy rounds (47 damage, three body hits drop anyone). Weak spraying aimed in, weak shots from the hip.' },
  tandem:  { name: 'Tandem Carbine', cls: 'AR', dmg: 30, rpm: 680, mag: 28, reserve: 140, reload: 2.9, spread: 0.06, ads: 0.015, bloom: 0.012, auto: true, pellets: 1, range: 1000, len: 14,
             tandem: 1.0, kickMul: 0.9, trait: 'Two magazines taped together: every other reload is a 1-second flip, the next one a slow full change (2.9 s). Count your reloads.' },
  // submachine guns
  ferret:  { name: 'Ferret SMG', cls: 'SMG', dmg: 23, rpm: 820, mag: 32, reserve: 160, reload: 2.1, spread: 0.06, ads: 0.024, bloom: 0.011, auto: true, pellets: 1, range: 850, len: 11,
             hipMul: 0.55, raise: 0.08, adsMul: 1.25, fall: { from: 260, to: 520, min: 0.6 }, trait: 'Built for hip fire on the move: by far the tightest hip spray and up the instant a sprint ends, but slow to aim in and its aimed shots are no better than any SMG.' },
  auger:   { name: 'Auger AP SMG', cls: 'SMG', dmg: 24, rpm: 620, mag: 35, reserve: 140, reload: 2.4, spread: 0.07, ads: 0.019, bloom: 0.010, auto: true, pellets: 1, range: 950, len: 13,
             pen: 0.68, kickMul: 1.05, swayMul: 0.8, fall: { from: 300, to: 620, min: 0.7 }, trait: 'Armour-piercing rounds: loses barely anything through soft walls and barricades (as much as a marksman rifle), but fires slowly for an SMG.' },
  // shotguns
  quill:   { name: 'Quill Flechette', cls: 'Shotgun', dmg: 24, rpm: 150, mag: 6, reserve: 36, reload: 3.0, spread: 0.07, ads: 0.035, bloom: 0, auto: false, pellets: 4, range: 700, len: 15,
             pen: 0.55, kickMul: 0.9, fall: { from: 160, to: 520, min: 0.45 }, trait: 'Four steel darts instead of buckshot: a tight pattern that reaches two rooms and pierces walls, but each blast holds few darts, so a miss is a miss.' },
  hedge:   { name: 'Hedge Lever-12', cls: 'Shotgun', mode: 'lever-action', dmg: 14, rpm: 120, mag: 5, reserve: 35, reload: 2.8, spread: 0.15, ads: 0.10, bloom: 0, auto: false, pellets: 8, range: 400, len: 13,
             stagger: 0.7, adsMul: 0.75, kickMul: 1.1, trait: 'Quick to the shoulder, and anyone its pellets hit is knocked off balance: slowed for a moment. Five shells, and the lever takes time.' },
  // light machine guns
  cyclone: { name: 'Cyclone Rotary', cls: 'LMG', dmg: 21, rpm: 1150, mag: 150, reserve: 150, reload: 6.5, spread: 0.10, ads: 0.03, bloom: 0.008, auto: true, pellets: 1, range: 950, len: 18,
             spin: { from: 0.35, t: 1.4 }, adsMul: 1.2, kickMul: 0.7, swayMul: 1.1, trait: 'A spinning barrel: starts slow (400 rpm) and winds up over 1.4 s to the fastest fire in the game. 150 rounds and an endless reload. Let go and it winds down.' },
  trestle: { name: 'Trestle LMG', cls: 'LMG', dmg: 32, rpm: 560, mag: 75, reserve: 150, reload: 4.8, spread: 0.11, ads: 0.022, bloom: 0.010, auto: true, pellets: 1, range: 1150, len: 17,
             bipod: 0.4, kickMul: 1.35, swayMul: 1.2, adsMul: 1.15, trait: 'Wild on its feet, but crouched or lying still the bipod comes down and the recoil drops by 60%: a fixed gun for holding a long angle.' },
  // marksman rifles
  ranger:  { name: 'Ranger Lever Rifle', cls: 'DMR', mode: 'lever-action', dmg: 82, rpm: 115, mag: 7, reserve: 42, reload: 3.0, spread: 0.05, ads: 0.004, bloom: 0.03, auto: false, pellets: 1, range: 1250, len: 15,
             adsMul: 0.7, kickMul: 1.25, settle: 0.45, trait: 'A short lever-action that aims in as fast as an SMG: two body hits from point blank to across the map, but slow between shots.' },
  mammoth: { name: 'Mammoth .50', cls: 'DMR', mode: 'bolt-action', dmg: 135, rpm: 40, mag: 3, reserve: 18, reload: 3.8, spread: 0.11, ads: 0.0016, bloom: 0.06, auto: false, pellets: 1, range: 1900, len: 23,
             pen: 0.9, adsMul: 1.5, kickMul: 1.8, settle: 1.1, oneShot: true, wallShot: 1, trait: 'Anti-materiel rifle: aimed in through the sniper scope, one body hit drops anyone even through one soft wall. Three rounds, the slowest bolt and aim of all, deafening, and its scope glints.' },
  // pistols
  needle:  { name: 'Needle Target Pistol', cls: 'Pistol', dmg: 31, rpm: 300, mag: 10, reserve: 50, reload: 1.9, spread: 0.035, ads: 0.004, bloom: 0.01, auto: false, pellets: 1, range: 1200, len: 9,
             settle: 0.12, kickMul: 0.5, fall: { from: 700, to: 1100, min: 0.85 }, trait: 'A long-slide match pistol: almost no kick, exact again at once and full damage to rifle range, but it fires slowly for a pistol.' },
  couplet: { name: 'Couplet Pistol', cls: 'Pistol', dmg: 24, rpm: 1100, mag: 18, reserve: 72, reload: 1.7, spread: 0.055, ads: 0.016, bloom: 0.02, auto: false, pellets: 1, range: 800, len: 7,
             burst: 2, burstGap: 0.24, kickMul: 1.1, trait: 'Fires two rounds with every pull, the second landing almost on the first: two quick pulls drop anyone up close. Nine pulls a magazine.' },
  // machine pistols
  whisper: { name: 'Whisper MP', cls: 'MP', dmg: 20, rpm: 880, mag: 30, reserve: 120, reload: 1.9, spread: 0.08, ads: 0.03, bloom: 0.011, auto: true, pellets: 1, range: 700, len: 9,
             quiet: true, fall: { from: 180, to: 420, min: 0.5 }, trait: 'Built-in suppressor: the only quiet attacker gun. Weak past a room.' },
  hatchet: { name: 'Hatchet MP', cls: 'MP', dmg: 33, rpm: 600, mag: 15, reserve: 75, reload: 1.8, spread: 0.085, ads: 0.028, bloom: 0.014, auto: true, pellets: 1, range: 650, len: 8,
             kickMul: 1.6, swayMul: 0.8, fall: { from: 160, to: 380, min: 0.5 }, trait: 'A heavy-calibre machine pistol: four hits drop anyone, but only 15 rounds and it climbs hard.' },
};
// guns only carried as a sidearm (second slot)
export const SIDEARMS = new Set(['p10', 'vex50', 'bison', 'gnat', 'stub', 'sparrow', 'needle', 'couplet', 'whisper', 'hatchet']);

// armor: 1 = heavy/slow, 2 = medium, 3 = light/fast. HP follows armor.
export const ARMOR_HP = { 1: 150, 2: 132, 3: 120 }; // he asked: everyone a bit tougher (+20%); the Pike still kills with one body shot
// build follows armor too: heavies stay broad, mediums and lights are skinnier (drawn narrower AND harder to hit).
// HIT_R is how close (px) a bullet must pass to a body's centre to hit it; walls still use PLAYER_R for bumping.
export const BODY_W = { 1: 0.8, 2: 0.71, 3: 0.64 }; // he asked: everyone skinnier (was 0.95 / 0.84 / 0.76)
export const HIT_R = { 1: 6.6, 2: 6.0, 3: 5.5 }; // shrunk with the drawings (was 7.5 / 6.8 / 6.2)
export const hitR = (op) => HIT_R[OPERATORS[op]?.armor] ?? 6.8;
export const bodyW = (op) => BODY_W[OPERATORS[op]?.armor] ?? 0.84;

export const GADGETS = {
  smoke:   { name: 'Smoke Grenade',    kind: 'throw' },
  frag:    { name: 'Frag Grenade',     kind: 'throw' },
  claymore:{ name: 'Claymore',         kind: 'place' },
  breach:  { name: 'Breach Charge',    kind: 'wall'  },
  stun:    { name: 'Stun Grenade',     kind: 'throw' },
  dshield: { name: 'Deployable Shield',kind: 'place' },
  nitro:   { name: 'Nitro Pack',       kind: 'throw' },
  wire:    { name: 'Barbed Wire',      kind: 'place' },
  impact:  { name: 'Impact Grenade',   kind: 'throw' },
};

export const OPERATORS = {
  // ---------- Attack ----------
  ember:   { team: 'atk', name: 'EMBER',   role: 'Hard Breacher', armor: 2, primary: 'k4',      secondary: 'p10',
             ability: { id: 'cutter', name: 'Plasma Cutter', count: 2, desc: 'Stick it on any wall. After 5 seconds it burns a large hole — even through reinforced walls. Jammers stop it.' },
             gadget: 'smoke', gadgetCount: 2, color: '#e8742a', helmet: '#565c4c', look: 'mask' },
  kestrel: { team: 'atk', name: 'KESTREL', role: 'Recon',         armor: 3, primary: 'longbow', secondary: 'p10',
             ability: { id: 'dart', name: 'Seeker Dart', count: 3, desc: 'Throw a seeker dart (a little off where you aim, up to 8 m); it sticks in the first wall it hits. For 10 seconds it pings every enemy it can see near it for your whole team. It cannot see through walls.' },
             gadget: 'frag', gadgetCount: 2, color: '#4fb3a9', helmet: '#5a5f4a', look: 'cap' },
  hammer:  { team: 'atk', name: 'HAMMER',  role: 'Soft Breacher', armor: 2, primary: 'tusk', secondary: 'p10',
             ability: { id: 'slug', name: 'Breaching Rounds', count: 4, desc: 'Launch an explosive round that blows open soft walls, barricades and anyone standing behind them.' },
             gadget: 'claymore', gadgetCount: 1, color: '#c9b037', helmet: '#4a4032', look: 'helmet' },
  talon:   { team: 'atk', name: 'TALON',   role: 'Disruptor',     armor: 3, primary: 'sabre',      secondary: 'p10',
             ability: { id: 'emp', name: 'EMP Grenade', count: 3, desc: 'Throw an EMP that sticks where it hits. In a circle about a metre wide — right through the wall it is on — it destroys every enemy gadget, blinds cameras for 20 seconds, and fries the skill and gadget of any defender caught in it for 8 seconds.' },
             gadget: 'breach', gadgetCount: 2, color: '#a46ad6', helmet: '#4a5164', look: 'goggles' },
  bulwark: { team: 'atk', name: 'BULWARK', role: 'Shield',        armor: 1, primary: 'p10',     secondary: null,
             ability: { id: 'brace', name: 'Ballistic Shield', count: 0, desc: 'Shield up: bullets cannot get through the front, but you cannot shoot; melee is a shield bash that staggers (a miss leaves you open). Press to put the shield on your back and draw your pistol (takes a moment); it then guards your back.' },
             gadget: 'stun', gadgetCount: 2, color: '#d84a4a', helmet: '#46484c', look: 'visor' },
  rivet   : { team: 'atk', name: 'RIVET', role: 'Hard Breacher', armor: 2, primary: 'k4', secondary: 'p10',
             ability: {id: "lance",name: "Thermal Lance",count: 0,battery: 14,desc: "Hold facing any wall — even concrete, reinforced walls and steel panels — to burn a small hole you can see and shoot through; keep carving to widen it until the block falls out. Quiet, but the glow gives you away."},
             gadget: 'stun', gadgetCount: 2, color: '#ff8a3d', helmet: '#4d4436', look: 'goggles' },
  haze    : { team: 'atk', name: 'HAZE', role: 'Smoke Support', armor: 2, primary: 'k4', secondary: 'p10',
             ability: {id: "barrage",name: "Smoke Barrage",count: 2,desc: "Fire a canister that lays a thin wall of smoke across your aim, about 6 metres wide, cutting a sightline for 12 seconds."},
             gadget: 'breach', gadgetCount: 2, color: '#9aa3ad', helmet: '#3f4448', look: 'mask' },
  glint   : { team: 'atk', name: 'GLINT', role: 'Intel', armor: 3, primary: 'javelin', secondary: 'p10',
             ability: {id: "sonar",name: "Sonar Pulse",count: 3,desc: "Throw a pulse emitter. When it lands it reveals every defender nearby, through walls, to your whole team for a few seconds."},
             gadget: 'frag', gadgetCount: 2, color: '#5fd3e8', helmet: '#2f4a52', look: 'visor' },
  brisk   : { team: 'atk', name: 'BRISK', role: 'Entry Fragger', armor: 3, primary: 'javelin', secondary: 'p10',
             ability: {id: "adrenal",name: "Adrenal Shot",count: 2,desc: "Inject yourself: for 6 seconds you move a quarter faster and aim down sights twice as quickly."},
             gadget: 'stun', gadgetCount: 2, color: '#e84a7a', helmet: '#4a2a36', look: 'cap' },
  onyx    : { team: 'atk', name: 'ONYX', role: 'Area Denial', armor: 1, primary: 'mule', secondary: 'p10',
             ability: {id: "cluster",name: "Cluster Charge",count: 3,desc: "Stick it on a soft wall. It beeps loudly a second before going off, then fires three waves of bomblets into the room on the other side, the last a little bigger."},
             gadget: 'smoke', gadgetCount: 2, color: '#3a3d44', helmet: '#1f2125', look: 'helmet' },
  prism   : { team: 'atk', name: 'PRISM', role: 'Deception', armor: 3, primary: 'javelin', secondary: 'p10',
             ability: {id: "decoy",name: "Holo Decoy",count: 3,desc: "Send a hologram of yourself running ahead. Defenders see and hear a real attacker until they shoot it."},
             gadget: 'smoke', gadgetCount: 2, color: '#c58cff', helmet: '#43365a', look: 'hood' },
  volt    : { team: 'atk', name: 'VOLT', role: 'Gadget Denial', armor: 2, primary: 'k4', secondary: 'p10',
             ability: {id: "arc",name: "Arc Gun",count: 5,desc: "Fire an electric bolt: it destroys the first enemy gadget it touches (cameras, traps, sensors) or shocks a defender."},
             gadget: 'breach', gadgetCount: 2, color: '#f2e14e', helmet: '#4a4530', look: 'goggles' },
  tether  : { team: 'atk', name: 'TETHER', role: 'Recon', armor: 2, primary: 'longbow', secondary: 'p10',
             ability: {id: "scope",name: "Wall Scope",count: 2,desc: "Push a fibre-optic scope through a soft wall. Your team sees the room behind it. An energy shield protects it for its first 3 seconds; after that one bullet breaks it."},
             gadget: 'claymore', gadgetCount: 2, color: '#6fbf73', helmet: '#34452f', look: 'cap' },
  strider : { team: 'atk', name: 'STRIDER', role: 'Silent Flank', armor: 3, primary: 'javelin', secondary: 'p10',
             ability: {id: "ghost",name: "Ghost Step",count: 2,desc: "For 6 seconds your footsteps are silent and you set off no traps, sensors, scanners or darts — but you move 15% slower while you concentrate."},
             gadget: 'frag', gadgetCount: 2, color: '#8ab4d8', helmet: '#2b3a48', look: 'hood' },
  ferro   : { team: 'atk', name: 'FERRO', role: 'Soft Breacher', armor: 1, primary: 'tusk', secondary: 'p10',
             ability: {id: "hammer",name: "Breaching Hammer",count: 0,desc: "A sledgehammer that never runs out: smashes a door or window barricade, a steel brace, a deployable shield or an unreinforced floor hatch open in one swing, or flattens anyone in reach — each swing needs 2.5 seconds to recover. It can't break walls."},
             gadget: 'stun', gadgetCount: 2, color: '#b0703c', helmet: '#4a3828', look: 'helmet' },
  // ---- added to fill every role to 5 (he asked) ----
  salvo: { team: 'atk', name: 'SALVO', role: 'Launcher Breacher', armor: 2, primary: 'rook', secondary: 'p10',
             ability: { id: 'sticky', name: 'Remote Launcher', count: 5, desc: 'Fire rounds that stick to whatever they hit — a wall, a barricade or a person — and wait. Press again (with rounds stuck) to blow them all at once, blasting through soft walls into the room behind.' },
             gadget: 'stun', gadgetCount: 2, color: '#e05a3a', helmet: '#4b4a3e', look: 'helmet' },
  torque: { team: 'atk', name: 'TORQUE', role: 'Saw Breacher', armor: 1, primary: 'ox', secondary: 'p10',
             ability: { id: 'saw', name: 'Saw Disc Launcher', count: 4, desc: 'Fire a spinning saw disc that slices a thin see-through slit through every soft wall and barricade in its path, until it hits something solid. It cuts anyone it hits.' },
             gadget: 'smoke', gadgetCount: 2, color: '#d0a040', helmet: '#4a4438', look: 'mask' },
  rush: { team: 'atk', name: 'RUSH', role: 'Breaching Dash', armor: 3, primary: 'tusk', secondary: 'p10',
             ability: { id: 'dash', name: 'Breaching Dash', count: 3, desc: 'Burst 3 metres forward. A barricade in the way splinters, and anyone you hit staggers.' },
             gadget: 'stun', gadgetCount: 2, color: '#e8463c', helmet: '#3e4048', look: 'goggles' },
  blaze: { team: 'atk', name: 'BLAZE', role: 'Flare Entry', armor: 2, primary: 'trident', secondary: 'p10',
             ability: { id: 'flare', name: 'Flare', count: 3, desc: 'Throw a flare that bursts after a second. Defenders facing it are blinded for about 2 seconds.' },
             gadget: 'smoke', gadgetCount: 2, color: '#ff9f2e', helmet: '#4a4038', look: 'visor' },
  echo: { team: 'atk', name: 'ECHO', role: 'Seismic Intel', armor: 2, primary: 'sabre', secondary: 'p10',
             ability: { id: 'spike', name: 'Seismic Spike', count: 2, desc: 'Hammer a seismic spike into the floor. For 15 seconds any defender who runs within 10 metres of it shows up for your team.' },
             gadget: 'claymore', gadgetCount: 1, color: '#5ec4b6', helmet: '#3f4a48', look: 'cap' },
  mark: { team: 'atk', name: 'MARK', role: 'Tracer Intel', armor: 3, primary: 'heron', secondary: 'p10',
             ability: { id: 'tracer', name: 'Tracer Rounds', count: 3, desc: 'Load tracer rounds for 8 seconds: they punch through up to a metre of any wall — even reinforced — and every defender you hit glows for your team for 4 seconds.' },
             gadget: 'frag', gadgetCount: 2, color: '#9ad04a', helmet: '#434a3a', look: 'cap' },
  patch: { team: 'atk', name: 'PATCH', role: 'Field Medic', armor: 2, primary: 'k4', secondary: 'p10',
             ability: { id: 'medkit', name: 'Field Kit', count: 2, desc: 'Throw a field kit. It bursts open and heals every teammate standing in it for 5 seconds.' },
             gadget: 'smoke', gadgetCount: 2, color: '#59c27a', helmet: '#3f4a40', look: 'helmet' },
  trench: { team: 'atk', name: 'TRENCH', role: 'Cover Support', armor: 1, primary: 'mule', secondary: 'p10',
             ability: { id: 'cover', name: 'Drop Cover', count: 2, desc: 'Plant a bulletproof barrier two blocks wide across your aim, to hide behind or hold an angle from.' },
             gadget: 'breach', gadgetCount: 2, color: '#8a7a5a', helmet: '#4a463a', look: 'helmet' },
  wren: { team: 'atk', name: 'WREN', role: 'Silent Flanker', armor: 3, primary: 'javelin', secondary: 'p10',
             ability: { id: 'pick', name: 'Lockpick', count: 3, desc: 'Pick a barricade apart in 1.5 seconds without a sound — no splinters, nothing for the defenders to hear.' },
             gadget: 'smoke', gadgetCount: 2, color: '#b07ad6', helmet: '#3e3a48', look: 'hood' },
  vapor: { team: 'atk', name: 'VAPOR', role: 'Smoke Flanker', armor: 3, primary: 'javelin', secondary: 'p10',
             ability: { id: 'burst', name: 'Smoke Burst', count: 2, desc: 'Blast a cone of thick smoke out in front of you. It spreads almost instantly and fills the shape of the room for 8 seconds.' },
             gadget: 'frag', gadgetCount: 2, color: '#9aa8b8', helmet: '#40444c', look: 'mask' },
  crow: { team: 'atk', name: 'CROW', role: 'Lunge Flanker', armor: 3, primary: 'sabre', secondary: 'p10',
             ability: { id: 'lunge', name: 'Lunge', count: 2, desc: 'Aim at an enemy within 5 metres and draw your blade: they hear it and are warned. After 1 second, for 5 seconds, your melee is a 5-metre lunge straight at them that downs them, from any side.' },
             gadget: 'stun', gadgetCount: 2, color: '#3a3d46', helmet: '#2a2c32', look: 'hood' },
  // ---- snipers (he asked 2026-11-10: more attackers with sniper rifles; he chose all four ideas) ----
  perch: { team: 'atk', name: 'PERCH', role: 'Bipod Sniper', armor: 1, primary: 'mammoth', secondary: 'needle',
             ability: { id: 'bipod', name: 'Sniper Bipod', count: 0, desc: 'Crouch or lie down and press to set the bipod: no scope sway, a marksman rifle cycles 40% faster and kicks half as much. You can barely move until you press again, stand up or move off the spot.' },
             gadget: 'claymore', gadgetCount: 2, color: '#a08a5a', helmet: '#4a4434', look: 'cap' },
  moss: { team: 'atk', name: 'MOSS', role: 'Ghillie Sniper', armor: 3, primary: 'saker', secondary: 'whisper',
             ability: { id: 'ghillie', name: 'Ghillie Wrap', count: 3, desc: 'Wrap your scope in a ghillie for 12 seconds: it gives no glint, so defenders can\'t see the flash that gives a sniper away.' },
             gadget: 'smoke', gadgetCount: 2, color: '#6a8a3a', helmet: '#3a4a26', look: 'hood' },
  osprey: { team: 'atk', name: 'OSPREY', role: 'Spotter Sniper', armor: 2, primary: 'pike', secondary: 'needle',
             ability: { id: 'spotter', name: 'Spotting Scope', count: 2, desc: 'For 8 seconds, every enemy you see while aimed in is marked for your whole team for 4 seconds.' },
             gadget: 'frag', gadgetCount: 2, color: '#d8b060', helmet: '#4a4030', look: 'visor' },
  nail: { team: 'atk', name: 'NAIL', role: 'Piercing Sniper', armor: 2, primary: 'saker', secondary: 'p10',
             ability: { id: 'pierce', name: 'Piercing Round', count: 4, desc: 'Load one armour-piercing round: your next shot goes through any wall, even reinforced or concrete, up to a metre and a half of it, but hits with only 55% of its damage.' }, // Ball Knowledge 2026-11-10: was 3 rounds at 40% (39% of rounds won)
             gadget: 'breach', gadgetCount: 1, color: '#b85a4a', helmet: '#40302c', look: 'mask' },
  // ---- up and down (he asked 2026-11-10: characters for hatches and verticality; he chose all four ideas) ----
  gimlet: { team: 'atk', name: 'GIMLET', role: 'Floor Drill', armor: 2, primary: 'k4', secondary: 'p10',
             ability: { id: 'drill', name: 'Floor Drill', count: 3, desc: 'Drill a small peephole through the floor (crouched) or the ceiling (standing). It takes 3 seconds; then your team can look and shoot through it to the floor below or above. Nobody fits through it.' },
             gadget: 'breach', gadgetCount: 2, color: '#c8a050', helmet: '#4a4232', look: 'helmet' },
  hoist: { team: 'atk', name: 'HOIST', role: 'Grapple Entry', armor: 3, primary: 'ferret', secondary: 'p10',
             ability: { id: 'grapple', name: 'Grapple Hook', count: 3, desc: 'Fire a grapple and climb: up through an open hatch above you (1.6 s), or from outside onto the roof right above the wall you face (3 s). You can\'t shoot while climbing.' },
             gadget: 'stun', gadgetCount: 2, color: '#5aa0d8', helmet: '#2e3e4e', look: 'goggles' },
  // ---------- Defence ----------
  lockjaw: { team: 'def', name: 'LOCKJAW', role: 'Hatch Trapper', armor: 2, primary: 'hedge', secondary: 'couplet',
             ability: { id: 'htrap', name: 'Hatch Trap', count: 2, desc: 'Rig a shut hatch, from on top of it or from underneath. The first attackers to open it or come near it once it is open are stunned for 3 seconds and spotted for your team for 6.' },
             gadget: 'wire', gadgetCount: 2, color: '#a04a3a', helmet: '#3a2a26', look: 'mask' },
  deadfall: { team: 'def', name: 'DEADFALL', role: 'Drop Charge', armor: 1, primary: 'cyclone', secondary: 'vex50',
             ability: { id: 'dropcharge', name: 'Drop Charge', count: 2, desc: 'Set a charge on the floor in front of you. Two seconds later it blows a hatch-sized hole into the room below, hurting whoever is right next to it, so you can shoot down or drop through.' },
             gadget: 'dshield', gadgetCount: 1, color: '#7a6a8a', helmet: '#3a3442', look: 'helmet' },
  mason:   { team: 'def', name: 'MASON',   role: 'Fortifier',     armor: 1, primary: 'drummer',    secondary: 'vex50',
             ability: { id: 'panel', name: 'Armor Panel', count: 3, desc: 'Seal a door or window with a bulletproof steel panel. Only explosives and cutters get through.' },
             gadget: 'dshield', gadgetCount: 1, color: '#7b8fa6', helmet: '#5a6475', look: 'helmet' },
  veil:    { team: 'def', name: 'VEIL',    role: 'Anti-Gadget',   armor: 2, primary: 'marten',      secondary: 'vex50',
             ability: { id: 'jammer', name: 'Signal Jammer', count: 3, desc: 'Drop a jammer. Drones, cutters, breach charges and seeker darts stop working near it.' },
             gadget: 'nitro', gadgetCount: 1, color: '#55c1e8', helmet: '#36505e', look: 'hood' },
  lynx:    { team: 'def', name: 'LYNX',    role: 'Trapper',       armor: 3, primary: 'lark',      secondary: 'vex50',
             ability: { id: 'mine', name: 'Paint Trap', count: 3, desc: 'Hide a paint trap. An attacker who walks into it is sprayed with glowing paint and shows up for your whole team, through walls, for 12 seconds. No bang, no damage.' },
             gadget: 'wire', gadgetCount: 2, color: '#8fd14f', helmet: '#33402a', look: 'cap' },
  solace:  { team: 'def', name: 'SOLACE',  role: 'Medic',         armor: 2, primary: 'breaker', secondary: 'vex50',
             ability: { id: 'stim', name: 'Stim Pistol', count: 3, desc: 'Shoot a teammate to heal them (or revive them if they are down). With nobody in your sights, it heals you. Passive: if downed, gets back up by himself after 12 seconds.' },
             gadget: 'wire', gadgetCount: 2, color: '#f2f2f2', helmet: '#7a2b2b', look: 'helmet' },
  wraith:  { team: 'def', name: 'WRAITH',  role: 'Intel Roamer',  armor: 3, primary: 'lark', secondary: 'vex50',
             ability: { id: 'scan', name: 'Pulse Scanner', count: 0, battery: 8, desc: 'Press to start scanning and again to stop (up to 4 seconds at a time). While scanning, only you see a fuzzy heartbeat blip near each attacker in range, through walls: no name, no facing, up to 1.5 m off. You cannot shoot meanwhile, and they hear a warning ping.' },
             gadget: 'impact', gadgetCount: 2, color: '#6c7cf0', helmet: '#3c4260', look: 'mask' },
  bramble : { team: 'def', name: 'BRAMBLE', role: 'Trapper', armor: 2, primary: 'wasp', secondary: 'sparrow',
             ability: {id: "prox",name: "Proximity Charge",count: 2,desc: "Hide a charge by a door or window. When an attacker comes close it beeps once, then explodes."},
             gadget: 'wire', gadgetCount: 2, color: '#7a9a3a', helmet: '#3a4a22', look: 'cap' },
  kite    : { team: 'def', name: 'KITE', role: 'Intel', armor: 2, primary: 'hornet', secondary: 'vex50',
             ability: {id: "turret",name: "Turret Camera",count: 2,desc: "Place a bulletproof camera that fires a stinging laser (it overheats after 12 shots). Only explosives and gadget-killers destroy it, but a bullet into its lens from the front knocks it out for 8 seconds."},
             gadget: 'dshield', gadgetCount: 2, color: '#e05252', helmet: '#4a2a2a', look: 'visor' },
  gravel  : { team: 'def', name: 'GRAVEL', role: 'Area Denial', armor: 3, primary: 'lark', secondary: 'vex50',
             ability: {id: "concuss",name: "Daze Mines",count: 3,desc: "Sticky mines that daze any attacker who comes near: shaky aim and slow legs for 4 seconds."},
             gadget: 'impact', gadgetCount: 2, color: '#c4a05a', helmet: '#4a3c22', look: 'goggles' },
  shunt   : { team: 'def', name: 'SHUNT', role: 'Anti-Breach', armor: 1, primary: 'sentry', secondary: 'vex50',
             ability: {id: "grid",name: "Static Grid",count: 3,desc: "Clamp it on a wall. It fries cutters, charges and scopes placed on that wall and shocks anyone torching it."},
             gadget: 'wire', gadgetCount: 2, color: '#4f86ff', helmet: '#2a3654', look: 'helmet' },
  hush    : { team: 'def', name: 'HUSH', role: 'Stealth Roamer', armor: 3, primary: 'marten', secondary: 'sparrow',
             ability: {id: "shroud",name: "Silent Shroud",count: 0,battery: 6,desc: "Press to go dark, press again to come back: totally silent and invisible to drones and cameras while it lasts (6 s). Then it needs 15 seconds before it is ready again."},
             gadget: 'impact', gadgetCount: 2, color: '#5a5f6e', helmet: '#25272d', look: 'hood' },
  shade   : { team: 'def', name: 'SHADE', role: 'Intel', armor: 2, primary: 'wasp', secondary: 'vex50',
             ability: {id: "sensor",name: "Sound Sensor",count: 3,desc: "Place a microphone. Any attacker who runs near it is revealed to your whole team."},
             gadget: 'nitro', gadgetCount: 2, color: '#9b6be0', helmet: '#3a2f52', look: 'mask' },
  rampart : { team: 'def', name: 'RAMPART', role: 'Support', armor: 1, primary: 'breaker', secondary: 'vex50',
             ability: {id: "plates",name: "Armor Bag",count: 1,desc: "Drop a bag of armor plates. Every teammate who walks over it gets 15 extra health for the round."},
             gadget: 'dshield', gadgetCount: 2, color: '#8f9aa6', helmet: '#3c4249', look: 'helmet' },
  miasma  : { team: 'def', name: 'MIASMA', role: 'Area Denial', armor: 2, primary: 'marten', secondary: 'vex50',
             ability: {id: "gas",name: "Toxin Canister",count: 3,desc: "Throw a canister, then press again to release a toxic cloud that hurts attackers inside for 8 seconds."},
             gadget: 'wire', gadgetCount: 2, color: '#9bc43a', helmet: '#3d4a1e', look: 'mask' },
  snare   : { team: 'def', name: 'SNARE', role: 'Trapper', armor: 2, primary: 'breaker', secondary: 'vex50',
             ability: {id: "clamp",name: "Clamp Trap",count: 3,desc: "A spring trap hidden on the floor. An attacker who steps in is held in place for 2 seconds and hurt."},
             gadget: 'impact', gadgetCount: 2, color: '#a35f3a', helmet: '#3e2a1e', look: 'cap' },
  argus   : { team: 'def', name: 'ARGUS', role: 'Intel', armor: 3, primary: 'hornet', secondary: 'sparrow',
             ability: {id: "stickycam",name: "Sticky Cams",count: 3,desc: "Throw cameras that stick where they land and join your team’s camera network."},
             gadget: 'nitro', gadgetCount: 2, color: '#3ac4b0', helmet: '#1f4740', look: 'visor' },
  // ---- added to fill every role to 5 (he asked) ----
  solder: { team: 'def', name: 'SOLDER', role: 'Wall Welder', armor: 1, primary: 'drummer', secondary: 'vex50',
             ability: { id: 'weld', name: 'Wall Welder', count: 0, battery: 12, desc: 'Hold facing a broken soft wall to weld it shut again, one block at a time.' },
             gadget: 'dshield', gadgetCount: 1, color: '#d08a3a', helmet: '#4a4036', look: 'mask' },
  latch: { team: 'def', name: 'LATCH', role: 'Alarm Trapper', armor: 2, primary: 'lark', secondary: 'vex50',
             ability: { id: 'alarm', name: 'Siren Wire', count: 3, desc: 'Hide a siren wire on the floor (best across a doorway). An attacker who crosses it sets off a deafening siren: for 8 seconds they cannot hear anyone\'s footsteps.' },
             gadget: 'wire', gadgetCount: 2, color: '#b0b84a', helmet: '#44473a', look: 'cap' },
  hound: { team: 'def', name: 'HOUND', role: 'Tracker', armor: 3, primary: 'marten', secondary: 'sparrow',
             ability: { id: 'tag', name: 'Spotter Dart', count: 3, desc: 'Fire a spotter dart: the first attacker it hits is revealed to your team for 10 seconds.' },
             gadget: 'impact', gadgetCount: 2, color: '#c26a3a', helmet: '#463c34', look: 'cap' },
  ruse: { team: 'def', name: 'RUSE', role: 'Decoy Roamer', armor: 3, primary: 'wasp', secondary: 'sparrow',
             ability: { id: 'echobox', name: 'Echo Box', count: 2, desc: 'Throw an echo box. For 8 seconds it plays footsteps and gunfire, so attackers think someone is there.' },
             gadget: 'nitro', gadgetCount: 1, color: '#8a6ad6', helmet: '#3c3848', look: 'hood' },
  rally: { team: 'def', name: 'RALLY', role: 'Pacer', armor: 2, primary: 'hornet', secondary: 'vex50',
             ability: { id: 'pace', name: 'Pace Beacon', count: 2, desc: 'Drop a pace beacon. Any teammate who runs past it gets a burst of speed for 5 seconds (each one once every 10 s). Passive: if downed, gets back up by himself after 12 seconds.' },
             gadget: 'impact', gadgetCount: 2, color: '#e05a7a', helmet: '#46384a', look: 'goggles' },
  lens: { team: 'def', name: 'LENS', role: 'Periscope', armor: 2, primary: 'lark', secondary: 'vex50',
             ability: { id: 'periscope', name: 'Periscope', count: 2, desc: 'Push a periscope through the ceiling or the floor where you stand (up first, then down) to watch the room above or below in the camera feeds, until an attacker shoots it.' },
             gadget: 'dshield', gadgetCount: 1, color: '#4ab0e0', helmet: '#3a4450', look: 'visor' },
  audit: { team: 'def', name: 'AUDIT', role: 'Drone Hunter', armor: 3, primary: 'wasp', secondary: 'sparrow',
             ability: { id: 'radar', name: 'Drone Radar', count: 2, desc: 'Drop a drone radar: every attacker drone within 15 metres is pinged for your team, again and again for 15 seconds.' },
             gadget: 'impact', gadgetCount: 2, color: '#5ad0c0', helmet: '#3a4846', look: 'goggles' },
  tonic: { team: 'def', name: 'TONIC', role: 'Heal Station', armor: 2, primary: 'breaker', secondary: 'vex50',
             ability: { id: 'station', name: 'Heal Station', count: 1, desc: 'Place a heal station. Teammates standing next to it heal 6 health a second, up to 100 in total. Passive: if downed, gets back up by himself after 12 seconds.' },
             gadget: 'wire', gadgetCount: 2, color: '#6ad08a', helmet: '#3e4a42', look: 'helmet' },
  ward: { team: 'def', name: 'WARD', role: 'Grenade Catcher', armor: 2, primary: 'marten', secondary: 'vex50',
             ability: { id: 'catcher', name: 'Grenade Catcher', count: 2, desc: 'Place a grenade catcher. It zaps the first two attacker grenades, launcher rounds or flares that come near it.' },
             gadget: 'dshield', gadgetCount: 1, color: '#7aa0e8', helmet: '#3a4252', look: 'visor' },
  girder: { team: 'def', name: 'GIRDER', role: 'Steel Crew', armor: 1, primary: 'drummer', secondary: 'vex50',
             ability: { id: 'beam', name: 'Steel Brace', count: 2, desc: 'Brace an open doorway with a steel frame: nobody can walk through it, but everyone can still see and shoot through. Explosives, hammers and cutters break it. Passive: you reinforce walls and hatches twice as fast.' },
             gadget: 'wire', gadgetCount: 2, color: '#a0a0a0', helmet: '#4a4a4a', look: 'helmet' },
  magpie: { team: 'def', name: 'MAGPIE', role: 'Drone Thief', armor: 2, primary: 'marten', secondary: 'sparrow',
             ability: { id: 'swarm', name: 'Parasite Swarm', count: 3, desc: 'Release a parasite swarm at an attacker drone in sight (up to 12 m), from yourself or from your bird. It chases the drone; a drone that gets far enough away fast enough escapes, one it catches reshapes into a bird you fly over furniture and land on walls. A landed bird on AUTO pings the first attacker it sees, then flashes and destroys itself.' },
             gadget: 'nitro', gadgetCount: 1, color: '#3f9a6a', helmet: '#24322c', look: 'hood' },
};

export const OP_LIST = Object.keys(OPERATORS);
export const opsForTeam = team => OP_LIST.filter(k => OPERATORS[k].team === team);

// ---- loadouts: each operator's weapon and gadget choices ----
export const GADGET_COUNT = { smoke: 2, frag: 2, claymore: 1, breach: 2, stun: 2, dshield: 1, nitro: 1, wire: 2, impact: 2 };
// He asked for side-specific weapons: no gun is carried by both attackers and defenders, and defence has no marksman
// or sniper rifles (the Anvil slug does that job). tests/weapons.js checks it.
export const LOADOUTS = {
  ember:   { primaries: ['k4', 'tusk', 'rook', 'ranger'], secondaries: ['p10', 'stub', 'hatchet'], gadgets: ['smoke', 'breach'] },
  kestrel: { primaries: ['longbow', 'k4', 'pike', 'saker'], secondaries: ['p10', 'bison', 'needle'], gadgets: ['frag', 'claymore'] },
  hammer:  { primaries: ['tusk', 'javelin', 'ferret', 'ram'], secondaries: ['p10', 'stub', 'hatchet'], gadgets: ['claymore', 'frag'] },
  talon:   { primaries: ['sabre', 'verdict', 'trident', 'heron'], secondaries: ['p10', 'stub', 'needle'], gadgets: ['breach', 'stun'] },
  bulwark: { primaries: ['p10', 'bison', 'needle'], secondaries: [], gadgets: ['stun', 'smoke'] }, // one hand on the shield: pistols only
  rivet:   { primaries: ['k4', 'sabre', 'quill', 'longbow'], secondaries: ['p10', 'bison', 'needle'], gadgets: ['stun', 'smoke'] },
  haze:    { primaries: ['verdict', 'javelin', 'trident', 'heron'], secondaries: ['p10', 'bison', 'needle'], gadgets: ['breach', 'frag'] },
  glint:   { primaries: ['javelin', 'longbow', 'heron'], secondaries: ['p10', 'bison', 'whisper'], gadgets: ['frag', 'claymore'] },
  brisk:   { primaries: ['ferret', 'tusk', 'ranger', 'visor'], secondaries: ['p10', 'bison', 'hatchet'], gadgets: ['stun', 'smoke'] },
  onyx:    { primaries: ['mule', 'ox', 'trestle', 'aegis'], secondaries: ['p10', 'stub', 'hatchet'], gadgets: ['smoke', 'breach'] },
  prism:   { primaries: ['javelin', 'k4', 'heron'], secondaries: ['p10', 'stub', 'whisper'], gadgets: ['smoke', 'stun'] },
  volt:    { primaries: ['k4', 'javelin', 'verdict', 'heron'], secondaries: ['p10', 'bison', 'needle'], gadgets: ['breach', 'claymore'] },
  tether:  { primaries: ['longbow', 'k4', 'pike', 'mammoth'], secondaries: ['p10', 'bison', 'needle'], gadgets: ['claymore', 'smoke'] },
  strider: { primaries: ['ferret', 'sabre', 'trident', 'ranger'], secondaries: ['p10', 'bison', 'whisper'], gadgets: ['frag', 'stun'] },
  ferro:   { primaries: ['tusk', 'mule', 'quill', 'k4'], secondaries: ['p10', 'stub', 'hatchet'], gadgets: ['stun', 'claymore'] },
  mason:   { primaries: ['drummer', 'breaker', 'sentry', 'cyclone'], secondaries: ['vex50', 'sparrow', 'couplet'], gadgets: ['dshield', 'wire'] },
  veil:    { primaries: ['marten', 'wasp', 'anvil', 'auger'], secondaries: ['vex50', 'gnat'], gadgets: ['nitro', 'impact'] },
  lynx:    { primaries: ['lark', 'hornet', 'wasp', 'auger'], secondaries: ['vex50', 'gnat'], gadgets: ['wire', 'impact'] },
  solace:  { primaries: ['breaker', 'lark', 'tandem', 'glass'], secondaries: ['vex50', 'sparrow', 'couplet'], gadgets: ['wire', 'dshield'] },
  wraith:  { primaries: ['lark', 'marten', 'auger', 'thorn'], secondaries: ['vex50', 'gnat'], gadgets: ['impact', 'nitro'] },
  bramble: { primaries: ['wasp', 'breaker', 'anvil', 'hedge'], secondaries: ['sparrow', 'vex50', 'couplet'], gadgets: ['wire', 'impact'] },
  kite:    { primaries: ['hornet', 'lark', 'sentry', 'tandem'], secondaries: ['vex50', 'gnat', 'couplet'], gadgets: ['dshield', 'nitro'] },
  gravel:  { primaries: ['lark', 'hornet', 'marten', 'auger'], secondaries: ['vex50', 'gnat'], gadgets: ['impact', 'wire'] },
  shunt:   { primaries: ['sentry', 'breaker', 'drummer', 'cyclone'], secondaries: ['vex50', 'gnat', 'couplet'], gadgets: ['wire', 'dshield'] },
  hush:    { primaries: ['marten', 'wasp', 'anvil', 'hedge'], secondaries: ['sparrow', 'gnat'], gadgets: ['impact', 'nitro'] },
  shade:   { primaries: ['wasp', 'breaker', 'lark', 'tandem'], secondaries: ['vex50', 'sparrow'], gadgets: ['nitro', 'wire'] },
  rampart: { primaries: ['breaker', 'drummer', 'cyclone', 'bastion'], secondaries: ['vex50', 'sparrow', 'couplet'], gadgets: ['dshield', 'wire'] },
  miasma:  { primaries: ['marten', 'breaker', 'sentry', 'tandem'], secondaries: ['vex50', 'gnat', 'couplet'], gadgets: ['wire', 'impact'] },
  snare:   { primaries: ['breaker', 'lark', 'anvil', 'hedge'], secondaries: ['vex50', 'sparrow', 'couplet'], gadgets: ['impact', 'nitro'] },
  argus:   { primaries: ['hornet', 'lark', 'marten', 'auger'], secondaries: ['sparrow', 'gnat'], gadgets: ['nitro', 'impact'] },
  salvo: { primaries: ['rook', 'k4', 'javelin', 'longbow'], secondaries: ['p10', 'stub', 'needle'], gadgets: ['stun', 'claymore'] },
  torque: { primaries: ['ox', 'tusk', 'trestle', 'longbow'], secondaries: ['p10', 'bison', 'needle'], gadgets: ['smoke', 'stun'] },
  rush: { primaries: ['tusk', 'javelin', 'sabre', 'quill'], secondaries: ['p10', 'stub', 'hatchet'], gadgets: ['stun', 'frag'] },
  blaze: { primaries: ['trident', 'k4', 'javelin', 'heron'], secondaries: ['p10', 'bison', 'needle'], gadgets: ['smoke', 'breach'] },
  echo: { primaries: ['sabre', 'longbow', 'heron'], secondaries: ['p10', 'bison', 'whisper'], gadgets: ['claymore', 'smoke'] },
  mark: { primaries: ['heron', 'javelin', 'longbow'], secondaries: ['p10', 'bison', 'whisper'], gadgets: ['frag', 'smoke'] },
  patch: { primaries: ['k4', 'verdict', 'javelin', 'longbow'], secondaries: ['p10', 'bison', 'needle'], gadgets: ['smoke', 'breach'] },
  trench: { primaries: ['mule', 'rook', 'trestle', 'longbow'], secondaries: ['p10', 'stub', 'needle'], gadgets: ['breach', 'frag'] },
  wren: { primaries: ['javelin', 'ferret', 'trident'], secondaries: ['p10', 'stub', 'whisper'], gadgets: ['smoke', 'stun'] },
  vapor: { primaries: ['javelin', 'heron', 'tusk'], secondaries: ['p10', 'bison', 'needle'], gadgets: ['frag', 'stun'] },
  crow: { primaries: ['sabre', 'ferret', 'quill'], secondaries: ['p10', 'stub', 'whisper'], gadgets: ['stun', 'smoke'] },
  gimlet: { primaries: ['k4', 'quill', 'ranger'], secondaries: ['p10', 'hatchet'], gadgets: ['breach', 'claymore'] },
  hoist: { primaries: ['ferret', 'verdict', 'heron'], secondaries: ['p10', 'whisper'], gadgets: ['stun', 'smoke'] },
  lockjaw: { primaries: ['hedge', 'auger', 'lark'], secondaries: ['couplet', 'gnat'], gadgets: ['wire', 'impact'] },
  deadfall: { primaries: ['cyclone', 'tandem', 'breaker'], secondaries: ['vex50', 'couplet'], gadgets: ['dshield', 'nitro'] },
  perch: { primaries: ['mammoth', 'pike', 'trestle'], secondaries: ['needle', 'p10'], gadgets: ['claymore', 'smoke'] },
  moss: { primaries: ['saker', 'ranger', 'ferret'], secondaries: ['whisper', 'p10'], gadgets: ['smoke', 'frag'] },
  osprey: { primaries: ['pike', 'saker', 'heron'], secondaries: ['needle', 'bison'], gadgets: ['frag', 'claymore'] },
  nail: { primaries: ['saker', 'mammoth', 'longbow'], secondaries: ['p10', 'hatchet'], gadgets: ['breach', 'stun'] },
  solder: { primaries: ['drummer', 'sentry', 'breaker', 'cyclone'], secondaries: ['vex50', 'sparrow', 'couplet'], gadgets: ['dshield', 'wire'] },
  latch: { primaries: ['lark', 'wasp', 'anvil', 'hedge'], secondaries: ['vex50', 'gnat'], gadgets: ['wire', 'impact'] },
  hound: { primaries: ['marten', 'lark', 'anvil', 'auger'], secondaries: ['sparrow', 'gnat'], gadgets: ['impact', 'nitro'] },
  ruse: { primaries: ['wasp', 'lark', 'hornet', 'tandem'], secondaries: ['sparrow', 'gnat'], gadgets: ['nitro', 'impact'] },
  rally: { primaries: ['hornet', 'marten', 'anvil', 'hedge'], secondaries: ['vex50', 'gnat'], gadgets: ['impact', 'nitro'] },
  lens: { primaries: ['lark', 'hornet', 'sentry', 'tandem'], secondaries: ['vex50', 'sparrow', 'couplet'], gadgets: ['dshield', 'nitro'] },
  magpie: { primaries: ['marten', 'wasp', 'lark', 'auger'], secondaries: ['sparrow', 'vex50'], gadgets: ['nitro', 'impact'] },
  audit: { primaries: ['wasp', 'marten', 'lark', 'auger'], secondaries: ['sparrow', 'gnat'], gadgets: ['impact', 'wire'] },
  tonic: { primaries: ['breaker', 'lark', 'sentry', 'hedge'], secondaries: ['vex50', 'sparrow', 'couplet'], gadgets: ['wire', 'dshield'] },
  ward: { primaries: ['marten', 'sentry', 'anvil', 'tandem'], secondaries: ['vex50', 'gnat', 'couplet'], gadgets: ['dshield', 'impact'] },
  girder: { primaries: ['drummer', 'breaker', 'anvil', 'cyclone'], secondaries: ['vex50', 'sparrow', 'couplet'], gadgets: ['wire', 'dshield'] },
};
// Riot shields (he asked: a few operators get one as their third primary, each with its own personality). Picked as the
// primary, the shield is held up in front all the time and the pistol is drawn behind it (like BULWARK): aim in to swing
// it aside and shoot. arc: how far it covers either side; speed: movement with it up; aside: seconds to swing it out of
// the way; bash: melee damage and stagger (miss: seconds it is left down after a missed bash); hp: it cracks and is
// gone for the round after that much damage (0 = never); hip: the pistol can fire round it without swinging it aside;
// plant: crouched and still it covers this much instead; breaks: a bash smashes barricades; stun: a bash stuns.
export const RIOT = {
  aegis: { name: 'AEGIS WALL', side: 'atk', arc: 1.15, speed: 0.78, aside: 0.42, bash: 40, stagger: 1.0, miss: 1.4, hp: 0, col: '#2a2f36', rim: '#c9a23c',
    trait: 'Huge and heavy: covers nearly your whole front and its bash hits hard, but you crawl and it takes an age to swing aside.' },
  visor: { name: 'VISOR', side: 'atk', arc: 0.82, speed: 0.95, aside: 0.15, bash: 22, stagger: 0.5, miss: 0.9, hp: 0, hip: true, col: '#30363f', rim: '#7fd0ff',
    trait: 'Light and quick: you can fire the pistol round it without lowering it, but it only covers a narrow strip.' },
  ram: { name: 'BATTERING RAM', side: 'atk', arc: 0.95, speed: 0.82, aside: 0.35, bash: 30, stagger: 0.8, miss: 2.2, hp: 0, breaks: true, col: '#3a3330', rim: '#d86a3a',
    trait: 'A breaching shield: one bash smashes a whole barricade, but a missed bash leaves you wide open for a long time.' },
  bastion: { name: 'BASTION', side: 'def', arc: 0.95, plant: 1.3, speed: 0.72, aside: 0.4, bash: 30, stagger: 0.7, miss: 1.2, hp: 0, col: '#283038', rim: '#9aa6b2',
    trait: 'Plant it: crouched and still it covers your front and sides, but it is the slowest shield to move with.' },
  glass: { name: 'GLASS GUARD', side: 'def', arc: 1.0, speed: 0.9, aside: 0.12, bash: 22, stagger: 0.6, miss: 1.0, hp: 360, col: 'rgba(170,215,240,0.55)', rim: '#cfe8f6',
    trait: 'Clear and light, the fastest to swing aside, but it cracks and is gone after it soaks up about three magazines.' },
  thorn: { name: 'THORN', side: 'def', arc: 0.92, speed: 0.9, aside: 0.22, bash: 25, stagger: 0.6, stun: 1.3, cd: 1.6, miss: 1.2, hp: 0, col: '#2c2a33', rim: '#b05ad8',
    trait: 'Shock studs: a bash stuns whoever it hits, but it recharges slowly and the shield is a little small.' },
};
export const isRiot = w => !!RIOT[w];
// how far a riot shield (or BULWARK's) covers right now
export const riotArc = (id, crouch, still) => { const R = RIOT[id]; return !R ? SHIELD_ARC : R.plant && crouch && still ? R.plant : R.arc; };
export function defaultLoadout(op) {
  const L = LOADOUTS[op];
  return { primary: L.primaries[0], secondary: L.secondaries[0] || null, gadget: L.gadgets[0] };
}
// Keep only choices that operator actually has.
export function cleanLoadout(op, l) {
  const L = LOADOUTS[op], d = defaultLoadout(op);
  if (!L || !l || typeof l !== 'object') return { ...d, att: {}, own: {} };
  const att = {}, own = {};
  for (const w of [...L.primaries, ...L.secondaries]) if (WEAPONS[w]) {
    if (l.att && l.att[w]) att[w] = cleanAtt(w, l.att[w]);
    if (l.own && l.own[w]) own[w] = true;
  }
  const primary = L.primaries.includes(l.primary) ? l.primary : d.primary;
  let secondary = L.secondaries.includes(l.secondary) ? l.secondary : d.secondary;
  if (RIOT[primary] && !(WEAPONS[secondary] && WEAPONS[secondary].cls === 'Pistol')) secondary = L.secondaries.find(w => WEAPONS[w].cls === 'Pistol') || secondary; // behind a shield: a pistol
  return {
    primary,
    secondary,
    gadget: L.gadgets.includes(l.gadget) ? l.gadget : d.gadget,
    att, own,
  };
}
// Gun setups are shared (he asked): the attachments you pick for a gun go on that gun for every operator, kept in the
// profile's `guns`, unless that operator's "only for this operator" tick (`own`) keeps their own set in `att`.
// Older profiles without a shared set for a gun keep using each operator's own.
export function resolveLoadout(op, l, guns) {
  const c = cleanLoadout(op, l);
  for (const w of [c.primary, c.secondary]) if (WEAPONS[w] && !c.own[w] && guns && guns[w]) c.att[w] = cleanAtt(w, guns[w]);
  return c;
}

// ---- roles (he asked: pick a role before each round; it limits you to that role's operators, so new players
// know their job). Every operator has exactly one.
export const JOBS = {
  atk: [
    { id: 'breach', name: 'Breacher', desc: 'Open walls and hatches into the objective.', ops: ['ember', 'rivet', 'hammer', 'ferro', 'salvo', 'torque', 'gimlet'] },
    { id: 'entry', name: 'Entry', desc: 'Go in first and win the opening fight.', ops: ['brisk', 'bulwark', 'onyx', 'rush', 'blaze', 'hoist'] },
    { id: 'intel', name: 'Intel', desc: 'Find the defenders and tell the team.', ops: ['kestrel', 'glint', 'tether', 'echo', 'mark', 'osprey'] },
    { id: 'support', name: 'Support', desc: 'Smoke, clear traps and kill gadgets so others can push.', ops: ['haze', 'talon', 'volt', 'patch', 'trench', 'perch', 'nail'] },
    { id: 'flank', name: 'Flank', desc: 'Sneak round and catch roamers from behind.', ops: ['strider', 'prism', 'wren', 'vapor', 'crow', 'moss'] },
  ],
  def: [
    { id: 'anchor', name: 'Anchor', desc: 'Hold the objective: fortify it and deny the area.', ops: ['mason', 'shunt', 'rampart', 'miasma', 'solder', 'deadfall'] },
    { id: 'trapper', name: 'Trapper', desc: 'Hide traps where attackers will walk.', ops: ['lynx', 'bramble', 'snare', 'gravel', 'latch', 'lockjaw'] },
    { id: 'roamer', name: 'Roamer', desc: 'Leave the objective, slow the attack and flank.', ops: ['wraith', 'hush', 'hound', 'ruse', 'rally'] },
    { id: 'intel', name: 'Intel', desc: 'Watch cameras and sensors and call out the attack.', ops: ['kite', 'shade', 'argus', 'lens', 'audit', 'magpie'] },
    { id: 'support', name: 'Support', desc: 'Heal the team and stop breaching gadgets.', ops: ['solace', 'veil', 'tonic', 'ward', 'girder'] },
  ],
};
export const SELF_UP = new Set(['solace', 'tonic', 'rally']); // the three health operators get up by themselves (he asked)
export const SELF_UP_TIME = 12;
export const jobOf = op => { for (const t of ['atk', 'def']) for (const j of JOBS[t]) if (j.ops.includes(op)) return j.id; return null; };

// ---- weapons in plain words, and attachments ----
export const CLASS_NAME = { AR: 'Assault rifle', SMG: 'Submachine gun', MP: 'Machine pistol', LMG: 'Light machine gun', DMR: 'Marksman rifle', Shotgun: 'Shotgun', Pistol: 'Pistol' };
export const CLASS_TIP = {
  AR: 'All-rounder: good at most ranges.', SMG: 'Fast-firing, best up close.', MP: 'Tiny and very fast, best up close.',
  LMG: 'Huge magazine, slow to aim.', DMR: 'Hard-hitting single shots at range.', Shotgun: 'Devastating up close, weak far away.', Pistol: 'Backup gun.',
};
// Each attachment nudges the gun a little. Multipliers: dmg, range (full-damage distance), ads (time to aim),
// hip (hip-fire spread; a shotgun's pellet fan), adsSpread (aimed spread), kick (recoil drift), sway (side-to-side
// shake), first (first shots' kick). Every one is a trade-off (he asked): something better, something worse.
export const ATTACH = {
  barrel: {
    none: { name: 'Standard barrel', short: 'Standard', desc: 'No changes.' },
    suppressor: { name: 'Suppressor', short: 'Suppressor', desc: '+ Much quieter, no muzzle flash. − 10% less damage, full damage over a shorter distance.', dmg: 0.9, range: 0.85, quiet: 1 },
    compensator: { name: 'Compensator', short: 'Compensator', desc: '+ Much less side-to-side shake when spraying. − The spray drifts a little more.', sway: 0.55, kick: 1.12 },
    brake: { name: 'Muzzle Brake', short: 'Muzzle brake', desc: '+ The first few shots kick much less. − More shake in a long spray.', first: 0.55, sway: 1.15 },
    extended: { name: 'Extended Barrel', short: 'Extended', desc: '+ Full damage from 30% further away. − Slower to aim in.', range: 1.3, ads: 1.1 },
    heavy: { name: 'Heavy Barrel', short: 'Heavy barrel', desc: '+ Steadier sprays: less drift and shake. − Slow to aim in, looser hip fire.', kick: 0.82, sway: 0.85, ads: 1.15, hip: 1.1 },
    short: { name: 'Short Barrel', short: 'Short barrel', desc: '+ Quick to aim in, tighter hip fire. − Damage drops off sooner.', ads: 0.85, hip: 0.88, range: 0.8 },
    match: { name: 'Match Barrel', short: 'Match barrel', desc: '+ Tighter aimed shots and full damage from further away. − Slower to aim in.', adsSpread: 0.85, range: 1.15, ads: 1.1 },
    choke: { name: 'Choke', short: 'Choke', desc: '+ Pellets stay together, so it reaches further. − Easier to miss up close, slower to aim in.', hip: 0.72, adsSpread: 0.72, ads: 1.1 },
  },
  grip: {
    none: { name: 'No grip', short: 'None', desc: 'No changes.' },
    vertical: { name: 'Vertical Grip', short: 'Vertical grip', desc: '+ Less recoil drift when spraying. − A little slower to aim in.', kick: 0.78, ads: 1.06 },
    angled: { name: 'Angled Grip', short: 'Angled grip', desc: '+ Aim in 20% faster. − A little more recoil drift.', ads: 0.8, kick: 1.12 },
    handstop: { name: 'Handstop', short: 'Handstop', desc: '+ Much less side-to-side shake. − Slower to aim in.', sway: 0.72, ads: 1.08 },
    stubby: { name: 'Stubby Grip', short: 'Stubby grip', desc: '+ Tighter hip fire and a bit quicker to aim. − More shake when spraying.', hip: 0.85, ads: 0.95, sway: 1.12 },
    trigger: { name: 'Trigger Kit', short: 'Trigger kit', desc: '+ Exact again sooner after each shot (25% quicker reset). − Looser hip fire.', settle: 0.75, hip: 1.1 },
    pad: { name: 'Recoil Pad', short: 'Recoil pad', desc: '+ Each shot kicks your aim 30% less. − A little slower to aim in.', first: 0.7, ads: 1.08 },
    laser: { name: 'Laser', short: 'Laser', desc: '+ Much tighter hip fire. − Enemies can see your beam.', hip: 0.72, laser: 1 },
  },
  sight: {
    iron: { name: 'Iron Sights', short: 'Iron sights', desc: '+ Nothing in the way: the quickest to aim in. − Aimed shots a little looser.', ads: 0.92, adsSpread: 1.05 }, // he asked: iron sights must be a real choice
    reddot: { name: 'Red Dot', short: 'Red dot', desc: 'Tighter aimed shots, normal aim-in speed.', adsSpread: 0.88 },
    holo: { name: 'Holo Sight', short: 'Holo', desc: '+ A little quicker to aim than a red dot. − Aimed shots a little looser than a red dot.', adsSpread: 0.94, ads: 0.96 },
    prism: { name: '1.5× Prism', short: '1.5× prism', desc: '+ Accurate aimed shots for mid range. − Slower to aim in.', adsSpread: 0.8, ads: 1.1 },
    scope: { name: '2.0× Scope', short: '2× scope', desc: '+ Very accurate aimed shots, and you see further ahead. − Slowest to aim in, looser hip fire.', adsSpread: 0.7, ads: 1.2, hip: 1.08, zoom: 1 },
    // he asked: a sniper scope for the slow marksman rifles. Aiming in snaps the reticle out to the mark at the end of
    // your sightline, everything round the lens blurs, and holding Shift steadies it (main.js scopeSway)
    sniper: { name: 'Sniper Scope', short: 'Sniper', desc: '+ Pin-point aimed shots, the view opens right out and the reticle jumps to the end of your sightline; hold Shift to steady it. − Slowest to aim in, wild hip fire, everything round the lens is a blur.', adsSpread: 0.45, ads: 1.3, hip: 1.35, zoom: 1 },
  },
};
export const ATTACH_SLOTS = [['barrel', 'Barrel'], ['grip', 'Grip'], ['sight', 'Sight']];
// What fits which gun (he asked: attachments that make sense for the type of gun)
const FITS = {
  AR:      { barrel: ['none', 'suppressor', 'compensator', 'brake', 'extended', 'heavy'], grip: ['none', 'vertical', 'angled', 'handstop', 'laser'], sight: ['iron', 'reddot', 'holo', 'prism', 'scope'] },
  LMG:     { barrel: ['none', 'suppressor', 'compensator', 'brake', 'extended', 'heavy'], grip: ['none', 'vertical', 'angled', 'handstop'], sight: ['iron', 'reddot', 'holo', 'prism', 'scope'] },
  DMR:     { barrel: ['none', 'suppressor', 'brake', 'extended', 'heavy'], grip: ['none', 'vertical', 'angled', 'handstop'], sight: ['iron', 'reddot', 'holo', 'prism', 'scope'] },
  SMG:     { barrel: ['none', 'suppressor', 'compensator', 'brake', 'extended', 'short'], grip: ['none', 'vertical', 'angled', 'stubby', 'laser'], sight: ['iron', 'reddot', 'holo', 'prism'] },
  MP:      { barrel: ['none', 'suppressor', 'compensator', 'short'], grip: ['none', 'angled', 'stubby', 'laser'], sight: ['iron', 'reddot', 'holo'] },
  Shotgun: { barrel: ['none', 'suppressor', 'choke', 'short', 'extended'], grip: ['none', 'vertical', 'angled', 'stubby', 'laser'], sight: ['iron', 'reddot', 'holo'] },
  Pistol:  { barrel: ['none', 'suppressor', 'compensator', 'extended'], grip: ['none', 'angled', 'laser'], sight: ['iron', 'reddot', 'holo'] },
};
export function attachFor(w) {
  const W = WEAPONS[w], f = FITS[W ? W.cls : 'AR'] || FITS.AR;
  const slug = W && W.pellets === 1; // a one-pellet shotgun (the Anvil slug) has no pellets to keep together
  let barrel = f.barrel.filter(b => !(W && W.quiet && b === 'suppressor') && !(slug && b === 'choke')); // a built-in suppressor already
  let grip = f.grip;
  if (W && !W.auto && !W.burst && W.pellets === 1) { // semi-autos (he asked): spray tools do nothing for them, so they get their own
    barrel = barrel.filter(b => b !== 'compensator' && b !== 'heavy').concat('match');
    grip = grip.filter(g => g !== 'vertical' && g !== 'handstop').concat('trigger', 'pad');
  }
  if (W && SIDEARMS.has(w) && W.cls !== 'MP' && W.cls !== 'Pistol') { grip = grip.filter(g => g !== 'vertical' && g !== 'handstop'); } // sidearms: nothing bulky underneath
  const sight = W && W.cls === 'DMR' && W.rpm <= 300 ? f.sight.concat('sniper') : f.sight; // the sniper scope: slow-firing marksman rifles only
  return { barrel, grip, sight }; // at least 3 in every slot (he asked)
}
// Starter attachments (he asked: for players who don't care, a sensible set per operator; the moment they change one,
// their choice is saved and replaces it). The gun type sets the base, the operator's role tweaks it: quiet jobs
// (flank, intel, roamer, trapper) get a suppressor, anchors a longer barrel, entry players quick handling.
const START_ATT = {
  AR: { barrel: 'compensator', grip: 'vertical', sight: 'reddot' }, LMG: { barrel: 'heavy', grip: 'handstop', sight: 'holo' },
  DMR: { barrel: 'match', grip: 'pad', sight: 'prism' }, Shotgun: { barrel: 'choke', grip: 'angled', sight: 'holo' },
  SMG: { barrel: 'compensator', grip: 'angled', sight: 'reddot' }, MP: { barrel: 'compensator', grip: 'stubby', sight: 'reddot' },
  Pistol: { barrel: 'none', grip: 'laser', sight: 'reddot' },
};
export function defaultAtt(w, op) {
  const W = WEAPONS[w], ok = attachFor(w), base = { ...(START_ATT[W ? W.cls : 'AR'] || START_ATT.AR) }, job = op ? jobOf(op) : null;
  if (W && W.pellets === 1 && W.cls === 'Shotgun') { base.barrel = 'extended'; base.sight = 'reddot'; } // a slug reaches
  if (['flank', 'intel', 'roamer', 'trapper'].includes(job) && !SIDEARMS.has(w)) base.barrel = 'suppressor';
  else if (job === 'anchor' && ['AR', 'LMG', 'SMG'].includes(W && W.cls)) base.barrel = 'extended';
  else if (job === 'entry' && ['SMG', 'Shotgun'].includes(W && W.cls) && !(W.pellets === 1)) base.barrel = 'short';
  const out = { barrel: 'none', grip: 'none', sight: 'iron' };
  for (const s of Object.keys(out)) if (ok[s].includes(base[s])) out[s] = base[s];
  return out;
}
export function cleanAtt(w, a, op = null) {
  const ok = attachFor(w), out = a && typeof a === 'object' ? { barrel: 'none', grip: 'none', sight: 'iron' } : defaultAtt(w, op); // never chosen: the starter set
  if (a && typeof a === 'object') for (const s of Object.keys(out)) if (ok[s].includes(a[s])) out[s] = a[s];
  return out;
}
// All the attachments' effects on a gun, combined.
export function gunMods(w, a) {
  const m = { dmg: 1, range: 1, ads: 1, hip: 1, adsSpread: 1, kick: 1, sway: 1, first: 1, settle: 1, quiet: 0, laser: 0, zoom: 0 };
  const c = cleanAtt(w, a);
  if (WEAPONS[w] && WEAPONS[w].quiet) m.quiet = 1; // built in, no damage lost
  for (const [slot] of ATTACH_SLOTS) {
    const e = ATTACH[slot][c[slot]];
    for (const k of Object.keys(m)) if (e[k] !== undefined) m[k] = k === 'quiet' || k === 'laser' || k === 'zoom' ? 1 : m[k] * e[k];
  }
  return m;
}
// three short letters for the snapshot: barrel / grip / sight
// how far out (metres) aiming in puts the crosshair, per sight (he asked: a red dot should feel different from a 2x)
// where aiming in puts the crosshair, metres: the range each sight is usually used at (he asked: iron and red dot the
// shortest, the 1.5x prism further than it was); the sniper scope goes as far as you can see, up to its reach (main.js adsReset)
// (he asked 2026-11-09: all 25% further than iron 4, holo 5.5, prism 9, scope 13)
// (he asked 2026-11-09, later): the distance now depends on the gun AND the sight, the gun much more: the gun gives
// the distance with iron sights (ADS_GUN per class, ADS_OWN for a few guns that differ from their class), the sight
// stretches it (ADS_SIGHT, at most 1.8x; the gun spans 2-11 m, 5.5x)
export const ADS_GUN = { Shotgun: 2.5, MP: 3, Pistol: 3.5, SMG: 4.5, AR: 6, LMG: 7, DMR: 9 };
export const ADS_OWN = { stub: 2, anvil: 5, bison: 4.5, heron: 8, pike: 11, saker: 11, verdict: 7, quill: 4.5, ranger: 6, mammoth: 12, needle: 5, ferret: 4 };
export const ADS_SIGHT = { iron: 1, reddot: 1.1, holo: 1.25, prism: 1.5, scope: 1.8 };
export const ADS_START = { sniper: 64 }; // the sniper scope: as far as you can see (main.js adsReset), up to its reach
export const adsStart = (sight, w) => { const g = WEAPONS[w]; return (ADS_OWN[w] ?? (g && ADS_GUN[g.cls]) ?? ADS_GUN.AR) * (ADS_SIGHT[sight] || 1); };
// how far the crosshair can be pulled out from you, in metres, the same all the way round (he asked: a circle, bigger
// with a stronger sight). Hip fire has the shortest reach; aiming in uses the sight's.
export const AIM_REACH = { hip: 18, iron: 20, holo: 21, reddot: 23, prism: 36, scope: 44, sniper: 64 }; // he asked: the 1.5x, 2x and sniper further (were 28, 34, 48)
export const aimReach = (sight, ads) => (ads && AIM_REACH[sight]) || AIM_REACH.hip;
export const attCode = a => [a.barrel, a.grip, a.sight].join(',');
export const attFromCode = s => { const [barrel, grip, sight] = String(s || '').split(','); return { barrel, grip, sight }; };

export const BIOS = {
  // every background different (he asked: too many were shipyard welders)
  ember:   { real: 'Ines Duarte', from: 'Porto', text: 'A glassblower who spent fifteen years at a furnace hotter than any wall. She reads heat the way others read faces, and her plasma cutter goes through steel like it is still molten.' },
  kestrel: { real: 'Tomas Halvorsen', from: 'Tromsø', text: 'An avalanche forecaster who learned to see danger before it moves. His seeker darts watch a doorway or a corner and call out whoever steps into view.' },
  hammer:  { real: 'Dele Okafor', from: 'Lagos', text: 'A quarry foreman who has blasted more rock than most people have walked on. He loads breaching rounds by feel and never waits for the dust to settle.' },
  talon:   { real: 'Mei Lin Zhao', from: 'Singapore', text: 'A hardware hacker who once shut down a casino floor with a pocket device. Her EMP grenades kill electronics in a tight circle, wall or no wall.' },
  bulwark: { real: 'Viktor Brandt', from: 'Hamburg', text: 'A former goalkeeper for a second-division side, he still plants his feet and dares people to get past. Behind his shield he moves like a slow, stubborn tide.' },
  mason:   { real: 'Graham Cole', from: 'Glasgow', text: 'A stonemason who restored cathedral walls before he ever held a rifle. He seals doorways with steel panels and checks every joint twice.' },
  veil:    { real: 'Amira Haddad', from: 'Beirut', text: 'A radio DJ who ran a pirate station through a war. Nobody jams a signal like someone who spent years keeping hers alive.' },
  lynx:    { real: 'Rafael Cruz', from: 'Bogotá', text: 'A cave-diving instructor who knows that the narrowest passage is the deadliest. He hides trip mines where the light runs out.' },
  solace:  { real: 'Dr. Hana Sato', from: 'Osaka', text: 'A mountain-rescue doctor used to treating patients hanging off a rope. Her stim pistol reaches teammates she cannot get to.' },
  wraith:  { real: 'Elias Grey', from: 'Unknown', text: 'A former prison-escape consultant, paid to find the gaps in a building. His pulse scanner finds the gaps in an attack.' },
  rivet:   { real: 'Tomás Vega', from: 'Valparaíso', text: 'A bridge-maintenance diver who cut rusted bolts underwater in total darkness. His thermal lance is quiet, patient and impossible to stop once lit.' },
  haze:    { real: 'Ingrid Solberg', from: 'Kiruna', text: 'A smoke-jumper who fought forest fires from inside them. She lays a thin, precise wall of smoke exactly where a sightline needs cutting.' },
  glint:   { real: 'Kwame Asante', from: 'Accra', text: 'A bat researcher who spent years mapping caves by echo. One sonar pulse and he knows the shape of every defender in the room.' },
  brisk:   { real: 'Lena Petrova', from: 'Kazan', text: 'A short-track speed skater who lives for the first corner. Her adrenal shot buys her the same few seconds of pure speed.' },
  onyx:    { real: 'Marcus Adeyemi', from: 'Abuja', text: 'A fireworks choreographer who times blasts to the hundredth of a second. His cluster charges paint a room on the other side of the wall.' },
  prism:   { real: 'Yuki Tanabe', from: 'Sapporo', text: 'A stage-illusion engineer for touring magicians. Her holograms draw fire and waste traps while the real Prism walks in behind them.' },
  volt:    { real: 'Ravi Menon', from: 'Kochi', text: 'A high-voltage lineman who climbed pylons in monsoon storms. His arc gun treats cameras and traps like a short circuit waiting to happen.' },
  tether:  { real: 'Sofia Lindqvist', from: 'Gothenburg', text: 'An earthquake search-and-rescue specialist who threads cameras through rubble. Her wall scopes carry a short-lived energy shield she designed after losing too many probes.' },
  strider: { real: 'Jonah Reyes', from: 'Cebu', text: 'A parkour stunt double who learned to land without a sound. When he slows down and focuses, traps and sensors simply miss him.' },
  ferro:   { real: 'Bogdan Ilić', from: 'Novi Sad', text: 'A demolition-crew veteran who knocked down a whole factory by hand on a bet. His sledgehammer never runs out; neither does he.' },
  bramble: { real: 'Aoife Brennan', from: 'Galway', text: 'A hedge-maze designer for country estates. She knows exactly which corner people will cut, and leaves a proximity charge there.' },
  kite:    { real: 'Daniel Kowalski', from: 'Gdańsk', text: 'A drone-racing champion who built a camera that bites back. His turrets watch and sting from behind armour.' },
  gravel:  { real: 'Pilar Ortega', from: 'Seville', text: 'A crowd-safety officer at football stadiums who prefers to win without killing. Her daze mines leave attackers swaying and half-blind.' },
  shunt:   { real: 'Henrik Aalto', from: 'Tampere', text: 'An elevator engineer who hates uninvited guests in his shafts. His static grid makes every breaching gadget on a wall useless.' },
  hush:    { real: 'Noor Khalil', from: 'Amman', text: 'A museum night guard who learned to cross a gallery without the motion sensors ever blinking. Drones and cameras never catch her.' },
  shade:   { real: 'Elif Demir', from: 'Izmir', text: 'A piano tuner with perfect pitch. Her microphones hear every running footstep and tell the team where it is.' },
  rampart: { real: 'George Mbeki', from: 'Durban', text: 'A shark-net diver used to heavy kit and cold water. His armor bag means the whole team starts the fight tougher.' },
  miasma:  { real: 'Dr. Viktor Sedlák', from: 'Brno', text: 'A brewery chemist who knows exactly how fast a gas fills a room. His canisters turn a hallway into somewhere nobody wants to stand.' },
  snare:   { real: 'Callum Fraser', from: 'Inverness', text: 'A gamekeeper who sets traps like an artist. Step in one and you are not going anywhere for a while.' },
  argus:   { real: 'Mei Watanabe', from: 'Kobe', text: 'A casino surveillance chief who watched a thousand screens a night. She throws cameras the way other people throw glances.' },
  salvo:   { real: 'Ana Folau', from: 'Auckland', text: 'A film-set pyrotechnician who never sets anything off until the director calls it. Her rounds stick and wait; she decides when the wall comes down.' },
  torque:  { real: 'Bruno Salas', from: 'Valencia', text: 'A motorbike mechanic who builds his own engines. His saw disc launcher spins a blade fast enough to slice a thin line through walls and barricades.' },
  rush:    { real: 'Kofi Mensah', from: 'Kumasi', text: 'A rugby winger who has never slowed down for a door. He goes through the first barricade before the defenders know the round has started.' },
  blaze:   { real: 'Rosa Lindgren', from: 'Malmö', text: 'A pyrotechnics designer for stage shows. Her flares give the defenders a show they never actually see.' },
  echo:    { real: 'Iris Moreau', from: 'Lyon', text: 'A volcanologist who listens to the ground. A building full of running defenders is the loudest thing she has ever heard.' },
  mark:    { real: 'Dev Malhotra', from: 'Pune', text: 'A ballistics engineer who designs ammunition for a living. His tracer rounds punch through a little wall and light up whoever they hit.' },
  patch:   { real: 'Liam Doyle', from: 'Cork', text: 'A lifeboat paramedic who throws first aid the way others throw a rope. Nobody on his team stays hurt for long.' },
  trench:  { real: 'Sven Aas', from: 'Bergen', text: 'An offshore oil-rig rigger who builds cover where there is none. Give him two seconds and an open room becomes a fortress.' },
  wren:    { real: 'Clara Weiss', from: 'Vienna', text: 'A locksmith who never learned to knock. Barricades come down quietly and she is inside before anyone turns round.' },
  vapor:   { real: 'Jae Park', from: 'Busan', text: 'A special-effects artist for concerts who can fill a stage with fog in a heartbeat. His burst rolls out in front of him and fills every gap in the room.' },
  gimlet:  { real: 'Petra Novak', from: 'Brno', text: 'A mining engineer who drilled survey holes through rock for a living. A floor is nothing to her: three seconds and she is looking into the room below.' },
  hoist:   { real: 'Kai Mahoe', from: 'Honolulu', text: 'A sea-cliff climber and rescue swimmer. He has never met a wall he could not get on top of, and he gets there before anyone has thought to look up.' },
  lockjaw: { real: 'Dmitri Volkov', from: 'Murmansk', text: 'A former customs officer who rigged smugglers\' hatches on cargo ships. Whoever opens the one he has been to wakes up on the floor.' },
  deadfall: { real: 'Ruth Achterberg', from: 'Rotterdam', text: 'A demolition engineer who brought tower blocks down floor by floor. She makes her own ways down, and puts them exactly where the attackers stand.' },
  perch:   { real: 'Viktor Halloran', from: 'Cork', text: 'A competition long-range shooter who never shoots standing up. Once the legs of his rifle touch the floor he does not move again until something on the other side does.' },
  moss:    { real: 'Aiyana Redcloud', from: 'Montana', text: 'A wildlife photographer who spent years lying unseen in the grass a few metres from wolves. Nobody has ever caught the light off her lens.' },
  osprey:  { real: 'Malik Osei', from: 'Accra', text: 'A coastguard spotter who could pick out a swimmer in a storm from two kilometres. Whatever crosses his scope, his whole team knows about.' },
  nail:    { real: 'Greta Wolff', from: 'Kiel', text: 'A shipyard engineer who tested armour plate for a living. She knows exactly how thick a wall is from the sound it makes, and how much rifle it takes.' },
  crow:    { real: 'Unknown', from: 'Unknown', text: 'Nobody on the team knows his real name. When he decides to move, he covers two metres before the defender can turn round.' },
  solder:  { real: 'Olu Adebayo', from: 'Ibadan', text: 'A pipeline welder who sealed leaks under pressure for a living. Whatever the attackers open, he closes again.' },
  latch:   { real: 'Nina Varga', from: 'Debrecen', text: 'A burglar-alarm installer who now protects the other side of the door. Her wires never hurt anyone; they just tell everyone where you are.' },
  hound:   { real: 'Mateo Ruiz', from: 'Mendoza', text: 'A border-collie trainer who herds anything that moves. He tags a target and lets the team do the rest.' },
  ruse:    { real: 'Elena Rossi', from: 'Turin', text: 'A sound designer for horror films. Attackers spend whole rounds chasing footsteps that were never there.' },
  rally:   { real: 'Tariq Aziz', from: 'Casablanca', text: 'A marathon runner who refuses to stay down. Hurt him and he comes back faster.' },
  lens:    { real: 'Freya Holm', from: 'Aarhus', text: 'A wildlife photographer who waited days in hides for one shot. She watches the attackers line up outside before they have even touched the wall.' },
  audit:   { real: 'Sam Okoro', from: 'Enugu', text: 'An air-traffic controller who can pick a drone motor out of two floors of noise. Attackers learn very little while he is on the site.' },
  tonic:   { real: 'Grace Mwangi', from: 'Nairobi', text: 'A field-hospital nurse who sets up shop on the objective. Defenders who hold near her station hold for longer.' },
  ward:    { real: 'Pavel Novak', from: 'Plzeň', text: 'An air-defence engineer who thinks small. Every grenade thrown into his room is one that never goes off.' },
  magpie:  { real: 'Ines Duarte', from: 'Lisbon', text: 'A parasitologist who bred a swarm that eats machines from the inside. Every drone it catches grows wings and works for her.' },
  girder:  { real: 'Hank Brody', from: 'Pittsburgh', text: 'A skyscraper ironworker who walked beams forty floors up. The site is twice as hard to get into once he has walked round it.' },
};

// ---- R6-style gun handling, by weapon class ----
export const ADS_TIME = { Pistol: 0.1, MP: 0.11, SMG: 0.13, Shotgun: 0.15, AR: 0.17, DMR: 0.22, LMG: 0.28 }; // seconds to fully aim (he asked for much faster)
// recoil per shot (radians): kick drifts one way with some sway; you pull against it with the mouse
export const RECOIL = {
  AR: { kick: 0.010, sway: 0.006, max: 0.11 }, SMG: { kick: 0.009, sway: 0.009, max: 0.13 }, MP: { kick: 0.011, sway: 0.012, max: 0.15 },
  LMG: { kick: 0.007, sway: 0.007, max: 0.10 }, DMR: { kick: 0.03, sway: 0.008, max: 0.10 }, Shotgun: { kick: 0.04, sway: 0.01, max: 0.1 },
  Pistol: { kick: 0.022, sway: 0.008, max: 0.09 },
};
// damage drop-off: full damage up to `from` px, sliding down to `min`× by `to` px
export const FALLOFF = {
  AR: { from: 400, to: 720, min: 0.75 }, SMG: { from: 300, to: 600, min: 0.65 }, MP: { from: 240, to: 520, min: 0.6 },
  LMG: { from: 450, to: 760, min: 0.8 }, DMR: { from: 9999, to: 9999, min: 1 }, Pistol: { from: 300, to: 560, min: 0.7 },
  Shotgun: { from: 70, to: 260, min: 0.25 },
};
export const HEAD_R = 2.3; // a bullet passing this close to the centre of a body is a headshot: instant kill
// ...and only if your crosshair was on their head when you fired (he asked: no headshots from a crosshair in front of
// or behind someone that just happens to line up). The head as drawn is 4.5 px; he asked for harder headshots, so only
// its middle two-thirds counts (the ring shown while aiming in is this zone).
export const HEAD_AIM = 3;
// The ballistic shield's pose, shared by the server (what stops bullets) and the drawing (what you see), so they always
// match (he asked). rot: how far the shield is turned from where its holder aims; arc: how far it reaches either side.
// Standing, walking (Shift) or crouching: square in front, the full arc: truly safe from the front. Jogging: it swings
// with every step and covers less, so its edges open up. Just fired: swung out of the way to shoot, the front is open.
// Knocked aside by a melee hit (or a missed bash): no cover at all (off).
export const SHIELD_ARC = 0.95;
// aside: 0 = shield held in front, 1 = swung out of the way to aim (BULWARK holds aim-in: it glides there, he asked)
export function shieldPose(gait, jogging, firing, knocked, aside = 0, arc0 = SHIELD_ARC) {
  if (knocked) return { rot: 1.7, arc: 0.5, off: true };
  const s = firing ? 1 : Math.max(0, Math.min(1, aside));
  if (s > 0) { const e = s * s * (3 - 2 * s); return { rot: -1.3 * e, arc: arc0 + (0.55 - arc0) * e }; } // no jostling while it moves aside
  if (jogging) { // jostled like something heavy (he asked: not a metronome): each footfall lurches it to one side fast, then it settles slowly
    const g = gait || 0, step = Math.floor(g / Math.PI), u = g / Math.PI - step, side = step % 2 ? -1 : 1;
    const lurch = u < 0.22 ? Math.sin(u / 0.22 * Math.PI / 2) : Math.exp(-(u - 0.22) * 4.2) * (1 - 0.18 * Math.sin((u - 0.22) * 14));
    return { rot: side * lurch * 0.8 + Math.sin(g * 0.37) * 0.08, arc: 0.72 * arc0 / SHIELD_ARC }; // about a third of each stride the front is open
  }
  return { rot: 0, arc: arc0 };
}
export const onHead = (ax, ay, x, y) => ax === undefined || ax === null || Math.hypot(ax - x, ay - y) <= HEAD_AIM;

// ---- the aiming model: one set of rules for the server, the crosshair and the Armory ----
// The first shot after the gun has settled (no shot for settleTime) goes exactly where the crosshair is: no spread, no
// recoil, standing, running, aimed or from the hip. Follow-up shots of a burst land somewhere inside a fixed cone that
// they never leave (narrow when aimed, wider from the hip and while running, a little wider with every shot of the
// burst), and the crosshair is pushed along each gun's own fixed recoil pattern, which you learn and pull against.
// Shotgun pellets fly in a fixed fan round the aim point.
// He asked for a reset time, so one-taps can't be spammed: accuracy comes back gradually after each shot and is only
// perfect again after the gun's settle time (counted from when the next shot could first be fired).
const SETTLE = { Pistol: 0.45, DMR: 0.55, AR: 0.4, SMG: 0.32, MP: 0.32, LMG: 0.45, Shotgun: 0.45 };
export const settleTime = w => w.settle || SETTLE[w.cls] || 0.4;
// a gun's own handling: its class's numbers, changed by the gun's adsMul / kickMul / swayMul / fall
export const adsTime = w => (ADS_TIME[w.cls] || 0.3) * (w.adsMul || 1);
export const recoilOf = w => { const r = RECOIL[w.cls] || RECOIL.AR; return { kick: r.kick * (w.kickMul || 1), sway: r.sway * (w.swayMul || 1), max: r.max }; };
export const falloffOf = w => w.fall || FALLOFF[w.cls] || FALLOFF.AR;
// how much of a bullet's damage is left after one soft wall (brick takes 30% more off, a wooden barricade a little less)
export const PEN = { AR: 0.5, LMG: 0.62, DMR: 0.68, SMG: 0.4, MP: 0.35, Pistol: 0.4, Shotgun: 0.3 };
// how a gun changes your walking (Shift) and aiming-in speed (he asked): light guns move quicker, heavy ones slower
export const GUN_MOVE = { Pistol: [1.08, 1.12], MP: [1.05, 1.08], SMG: [1.0, 1.0], Shotgun: [0.97, 0.95], AR: [0.95, 0.92], DMR: [0.92, 0.85], LMG: [0.88, 0.8] };
export const moveOf = w => (w && (w.move || GUN_MOVE[w.cls])) || [1, 1];
export const penOf = w => w.pen || PEN[w.cls] || 0.5;
// how "hot" the gun still is: the shots of this burst, cooling to 0 over the settle time (fractions make a smaller cone)
export const aimHeat = (w, shots, idle, m) => shots * Math.max(0, 1 - Math.max(0, idle - 60 / w.rpm * 1.05) / (settleTime(w) * (m && m.settle || 1)));
// half-width of the cone (radians) for the next shot; shots = shots already fired in this burst
export const HIP_FIRST = 0.022;
export function spreadCone(w, m, { at = 0, run = 0, crouch = false, shots = 0 } = {}) {
  // a settled first shot: dead on when aimed in, but from the hip a small cone (he asked: hip headshots were too easy).
  // HIP_FIRST rad at most: still on the body at 5 m, a headshot past a few metres mostly luck; it closes as you aim in
  if (shots <= 0 && w.pellets === 1) return (HIP_FIRST + run * 0.05) * m.hip * (w.hipMul || 1) * (1 - at);
  const f = w.pellets > 1 ? 1 : Math.min(1, shots); // partly cooled: a partly opened cone
  const hip = (w.spread * (crouch && run < 0.15 ? 0.9 : 1) + run * 0.05) * m.hip * (w.hipMul || 1); // the Ferret: a tight hip spray
  const ads = w.ads * m.adsSpread * (1 + run * 0.5);
  const burst = w.pellets > 1 ? 0 : Math.min(0.05, Math.max(0, shots - 1) * w.bloom * 0.5);
  return (hip + (ads - hip) * at) * f + burst * (1 - 0.7 * at);
}
// where one bullet goes inside the cone: never outside it, most often near the middle; pellets in a fixed fan
export function shotOffset(w, cone, i, rnd = Math.random) {
  // every other pellet (counted in from either edge, so the fan is the same both sides) sits a bit tighter
  if (w.pellets > 1) return cone * ((i / (w.pellets - 1)) * 2 - 1) * (Math.min(i, w.pellets - 1 - i) % 2 ? 0.75 : 1) + (rnd() - 0.5) * cone * 0.1;
  return cone ? (rnd() + rnd() - 1) * cone : 0;
}
// which pellets of a blast get a tracer: the two outside ones and the middle one, so the streaks show the whole spread
// (the first three were all on the left, so every shotgun looked like it shot left; he noticed on the Tusk)
export const tracerPellet = (w, i) => w.pellets <= 3 || i === 0 || i === w.pellets - 1 || i === w.pellets >> 1;
// Each gun's own spray (he asked: some pull left, some right, some much harder). Recoil turns your aim; + is to the
// right (clockwise), - to the left. pull: steady drift per shot (×kick); zig: side-to-side shake (×sway) repeating every
// per shots; flip: the steady drift changes side every flip shots (0 = never); k: how hard it kicks overall; mx: how
// far it can drag your aim before topping out (×class).
export const SPRAY = {
  k4:      { pull: 0.8,  zig: 0.4, per: 5, flip: 10, k: 1,   mx: 1 },    // right, then back left
  breaker: { pull: 0.6,  zig: 0.3, per: 2, flip: 0,  k: 1,   mx: 1 },
  mule:    { pull: 0.5,  zig: 0.2, per: 8, flip: 0,  k: 0.9, mx: 1.1 },  // a long steady climb, slightly right
  longbow: { pull: -0.4, zig: 0.4, per: 2, flip: 0,  k: 1.4, mx: 1.2 },  // big jump each shot
  hornet:  { pull: 0.3,  zig: 0.8, per: 4, flip: 0,  k: 0.8, mx: 0.9 },  // gentle, easy to hold
  vex50:   { pull: 1,    zig: 0.5, per: 2, flip: 0,  k: 1.6, mx: 1.4 },  // big kick right
  p10:     { pull: -0.4, zig: 0.6, per: 3, flip: 0,  k: 1,   mx: 1 },
  rook:    { pull: -1,   zig: 0.5, per: 4, flip: 0,  k: 1.2, mx: 1.5 },  // hard and to the left
  sabre:   { pull: 0.2,  zig: 1.3, per: 3, flip: 0,  k: 1,   mx: 1 },    // wanders side to side
  trident: { pull: 0.7,  zig: 0.4, per: 3, flip: 0,  k: 1,   mx: 1 },
  wasp:    { pull: -0.4, zig: 2.4, per: 2, flip: 0,  k: 1.2, mx: 1.6 },  // violent side to side shake
  marten:  { pull: 0.5,  zig: 0.3, per: 6, flip: 0,  k: 1,   mx: 0.8 },  // gentle
  lark:    { pull: -0.7, zig: 0.5, per: 5, flip: 15, k: 1,   mx: 1 },    // left, then right late in the mag
  tusk:    { pull: 0.4,  zig: 0.9, per: 2, flip: 0,  k: 1,   mx: 1.2 },  // bucks left-right each blast
  anvil:   { pull: -1,   zig: 0.2, per: 2, flip: 0,  k: 1.3, mx: 1.4 },
  stub:    { pull: 1,    zig: 0,   per: 2, flip: 0,  k: 1.5, mx: 1.5 },
  ox:      { pull: 0.15, zig: 0.15, per: 6, flip: 0, k: 1.4, mx: 1.8 },  // heavy, straight up: pull down
  drummer: { pull: -0.6, zig: 1.3, per: 4, flip: 12, k: 0.9, mx: 1.3 },  // wanders left then right
  pike:    { pull: 1,    zig: 0,   per: 2, flip: 0,  k: 1.3, mx: 1.5 },
  saker:   { pull: 0.4,  zig: 0,   per: 2, flip: 0,  k: 1.0, mx: 1.1 },  // the brake keeps it straighter than the Pike
  heron:   { pull: -0.6, zig: 0.5, per: 3, flip: 0,  k: 1,   mx: 1 },
  gnat:    { pull: 0.6,  zig: 1.8, per: 2, flip: 0,  k: 1.5, mx: 1.8 },  // very hard to control
  bison:   { pull: -1,   zig: 0.3, per: 2, flip: 0,  k: 2,   mx: 1.6 },  // a big kick left every shot
  javelin: { pull: 0.5,  zig: 0.6, per: 4, flip: 0,  k: 0.9, mx: 1 },
  sentry:  { pull: 0.2,  zig: 0.3, per: 6, flip: 0,  k: 0.8, mx: 0.8 },  // almost straight up, very calm
  sparrow: { pull: 0.5,  zig: 0.7, per: 3, flip: 0,  k: 0.9, mx: 1 },
  verdict: { pull: -0.5, zig: 0.7, per: 3, flip: 8,  k: 1.1, mx: 1.2 },  // left, then right: it was never meant to spray
  tandem:  { pull: 0.6,  zig: 0.5, per: 7, flip: 14, k: 1,   mx: 1 },    // a slow right drift that comes back the other way
  ferret:  { pull: -0.3, zig: 1.0, per: 5, flip: 0,  k: 1,   mx: 1 },    // a lazy wobble, slightly left
  auger:   { pull: 0.9,  zig: 0.2, per: 6, flip: 0,  k: 1.05, mx: 1.2 }, // a firm steady pull right
  quill:   { pull: -0.5, zig: 0.4, per: 2, flip: 0,  k: 0.9, mx: 1 },
  hedge:   { pull: 0.7,  zig: 0.5, per: 2, flip: 0,  k: 1.1, mx: 1.2 },
  cyclone: { pull: 0.1,  zig: 1.5, per: 3, flip: 0,  k: 0.7, mx: 1.3 },  // buzzes side to side, hardly climbs sideways
  trestle: { pull: -0.9, zig: 0.9, per: 4, flip: 0,  k: 1.35, mx: 1.6 }, // hard left, unless the bipod is down
  ranger:  { pull: 0.6,  zig: 0.3, per: 2, flip: 0,  k: 1.25, mx: 1.3 },
  mammoth: { pull: -0.6, zig: 0,   per: 2, flip: 0,  k: 1.8, mx: 1.8 },  // a huge shove, slightly left
  needle:  { pull: 0.1,  zig: 0.2, per: 3, flip: 0,  k: 0.5, mx: 0.6 },  // barely moves
  couplet: { pull: 0.8,  zig: 0.2, per: 2, flip: 0,  k: 1.1, mx: 1.1 },
  whisper: { pull: -0.6, zig: 1.0, per: 3, flip: 0,  k: 1,   mx: 1.2 },
  hatchet: { pull: 0.4,  zig: 0.6, per: 4, flip: 0,  k: 1.6, mx: 1.7 },  // climbs hard
};
for (const [k, w] of Object.entries(WEAPONS)) w.id = k;
const sprayOf = w => SPRAY[w.id] || { pull: 0.6, zig: 0.6, per: 6, flip: 6, k: 1, mx: 1 };
// the recoil added after shot number n of a burst (1 = the first): the gun's own fixed pattern
export function recoilStep(w, m, n) {
  const rc = recoilOf(w), S = sprayOf(w);
  const dir = S.flip && Math.floor((n - 1) / S.flip) % 2 ? -1 : 1;
  return dir * S.pull * rc.kick * S.k * m.kick * (n <= 3 ? m.first : 1) + Math.sin((n - 1) * 2 * Math.PI / (S.per || 4) + 0.6) * S.zig * rc.sway * S.k * m.sway;
}
export const recoilMax = w => (RECOIL[w.cls] || RECOIL.AR).max * (sprayOf(w).mx || 1);
// the shape of a gun's spray in plain words (for the menus)
export function sprayWords(w) {
  const S = sprayOf(w), side = d => d > 0 ? 'right' : 'left';
  const how = S.pull === 0 ? 'Shakes side to side' : S.flip ? `Pulls ${side(S.pull)}, then ${side(-S.pull)} after ${S.flip} shots` : Math.abs(S.zig) > Math.abs(S.pull) * 1.5 ? `Shakes side to side, drifting ${side(S.pull)}` : `Pulls ${side(S.pull)}`;
  return how + (S.k >= 1.4 ? ', kicks very hard' : S.k >= 1.2 ? ', kicks hard' : '');
}

// which side carries a gun ('atk' / 'def'), from the loadouts
export const gunSide = w => { for (const [op, L] of Object.entries(LOADOUTS)) if (L.primaries.includes(w) || L.secondaries.includes(w)) return OPERATORS[op].team; return null; };

// ---- what killed you (he asked: fewer alerts, but say plainly what you died to, above all an ability) ----
// Things that aren't a gun or an operator's ability; abilities explain themselves from their own description.
const CAUSE_TEXT = {
  'Melee': 'A melee hit up close. It finishes a downed player at once.',
  'Shield Bash': 'A shield slammed into you: it hurts and staggers. Back off or shoot past the shield’s edge.',
  'Bled out': 'You were downed and nobody revived you in time.',
  'Frag Grenade': 'A thrown grenade that bursts after its fuse. When you hear one land, get out of the room.',
  'Claymore': 'A trip mine with a red laser across its front. It blows when you walk into the laser.',
  'Breach Charge': 'A charge set on a wall to blow it open. It hurts anyone right beside that wall, on both sides.',
  'Nitro Pack': 'A bomb thrown by hand and set off by remote when someone comes close.',
  'Impact Grenade': 'A small grenade that bursts the moment it hits something.',
  'Stun Grenade': 'A flash grenade: it blinds and deafens for a moment.',
};
const firstWords = t => { const m = String(t || '').match(/^.*?[.!?](\s+.*?[.!?])?(?=\s|$)/); const f = m ? m[0] : String(t || ''); return f.length > 190 ? f.slice(0, f.search(/[.!?]/) + 1) || f.slice(0, 190) : f; };
// cause name (as sent with the kill) → { kind: 'gun' | 'ability' | 'gadget' | 'other', title, text, op (whose ability) }
export function causeOf(w, killerOp) {
  w = w || '';
  const gun = Object.values(WEAPONS).find(g => g.name === w);
  if (gun) return { kind: 'gun', title: w, text: (CLASS_NAME[gun.cls] || gun.cls) + (gun.trait ? ' · ' + gun.trait : '') };
  const same = (a, b) => a && b && (a === b || a.startsWith(b) || b.startsWith(a));
  const K = OPERATORS[killerOp], mine = K && same(K.ability.name, w) ? killerOp : null;
  const op = mine || Object.keys(OPERATORS).find(k => same(OPERATORS[k].ability.name, w));
  if (op) return { kind: 'ability', title: OPERATORS[op].ability.name, text: firstWords(OPERATORS[op].ability.desc), op };
  const gk = Object.values(GADGETS).find(g => g.name === w);
  return { kind: gk ? 'gadget' : 'other', title: w || 'Unknown', text: CAUSE_TEXT[w] || '' };
}


// The new guns' own rules (he asked 2026-11-10: every gun unique), shared by the server and the Armory.
// at = how far aimed in (0-1), spinT = seconds the trigger has been held, speed = px/s.
export const dualOn = (w, at) => !!(w.dual && at >= 0.6); // the Verdict, aimed in: single heavy rounds
export const fireAuto = (w, at) => dualOn(w, at) ? false : !!w.auto;
export const fireDmg = (w, at) => dualOn(w, at) ? w.dual.dmg : w.dmg;
export const fireRpm = (w, at, spinT = 9) => dualOn(w, at) ? w.dual.rpm
  : w.spin ? w.rpm * (w.spin.from + (1 - w.spin.from) * Math.min(1, Math.max(0, spinT) / w.spin.t)) : w.rpm; // the Cyclone winds up
export const bipodOn = (w, low, speed) => !!(w.bipod && low && speed < 12); // the Trestle: crouched or lying, standing still
export const reloadLen = (w, gun) => w.tandem && gun && gun.tap ? w.tandem : w.reload; // the Tandem: every other reload is quick
