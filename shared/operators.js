// Weapons and the 30 operators (15 attack, 15 defence).

export const WEAPONS = {
  k4:      { name: 'K4 Carbine',   cls: 'AR',      dmg: 31, rpm: 720, mag: 30, reserve: 150, reload: 2.4, spread: 0.06, ads: 0.014, bloom: 0.012, auto: true,  pellets: 1, range: 1100, len: 15 },
  v9:      { name: 'V9 SMG',       cls: 'SMG',     dmg: 24, rpm: 880, mag: 32, reserve: 192, reload: 2.0, spread: 0.07, ads: 0.022, bloom: 0.010, auto: true,  pellets: 1, range: 900,  len: 11 },
  breaker: { name: 'Breaker-12',   cls: 'Shotgun', mode: 'pump-action', dmg: 15, rpm: 78,  mag: 7,  reserve: 42,  reload: 3.1, spread: 0.16, ads: 0.11,  bloom: 0,     auto: false, pellets: 8, range: 420,  len: 14 },
  mule:    { name: 'Mule LMG',     cls: 'LMG',     dmg: 29, rpm: 640, mag: 80, reserve: 160, reload: 4.4, spread: 0.09, ads: 0.024, bloom: 0.008, auto: true,  pellets: 1, range: 1100, len: 17 },
  longbow: { name: 'Longbow DMR',  cls: 'DMR',     dmg: 58, rpm: 360, mag: 12, reserve: 60,  reload: 2.7, spread: 0.06, ads: 0.004, bloom: 0.02,  auto: false, pellets: 1, range: 1300, len: 18 },
  hornet:  { name: 'Hornet MP',    cls: 'MP',      dmg: 20, rpm: 920, mag: 25, reserve: 150, reload: 1.9, spread: 0.08, ads: 0.03,  bloom: 0.010, auto: true,  pellets: 1, range: 800,  len: 8 },
  vex50:   { name: 'Vex .50',      cls: 'Pistol',  dmg: 50, rpm: 210, mag: 7,  reserve: 35,  reload: 2.0, spread: 0.06, ads: 0.012, bloom: 0.04,  auto: false, pellets: 1, range: 900,  len: 8 },
  p10:     { name: 'P10 Sidearm',  cls: 'Pistol',  dmg: 34, rpm: 420, mag: 15, reserve: 60,  reload: 1.6, spread: 0.05, ads: 0.016, bloom: 0.02,  auto: false, pellets: 1, range: 900,  len: 7 },
  // More guns (he asked: "every gun should have its own properties, none of them too similar"). Besides the numbers
  // above, a gun can change its class's handling: adsMul (time to aim), kickMul / swayMul (recoil), settle (s until
  // the next shot is exact again), fall (damage drop-off), burst (shots per click), quiet (built-in suppressor).
  rook:    { name: 'Rook Battle Rifle', cls: 'AR', dmg: 40, rpm: 540, mag: 20, reserve: 120, reload: 2.7, spread: 0.065, ads: 0.012, bloom: 0.016, auto: true, pellets: 1, range: 1300, len: 17,
             pen: 0.62, adsMul: 1.15, kickMul: 1.8, swayMul: 0.7, fall: { from: 520, to: 900, min: 0.8 }, trait: 'Hits hard and keeps its damage far away, but kicks hard and holds only 20 rounds.' },
  sabre:   { name: 'Sabre Bullpup', cls: 'AR', dmg: 28, rpm: 820, mag: 30, reserve: 180, reload: 2.9, spread: 0.055, ads: 0.016, bloom: 0.011, auto: true, pellets: 1, range: 1000, len: 12,
             adsMul: 0.8, kickMul: 0.85, swayMul: 1.3, trait: 'Short, quick to aim and fast-firing; slow to reload, and its spray wanders sideways.' },
  trident: { name: 'Trident Burst', cls: 'AR', dmg: 38, rpm: 900, mag: 30, reserve: 150, reload: 2.3, spread: 0.05, ads: 0.010, bloom: 0.010, auto: false, pellets: 1, range: 1150, len: 15,
             burst: 3, burstGap: 0.2, kickMul: 0.8, trait: 'Three-round burst with every click: deadly accurate in bursts, but it can\'t spray.' },
  wasp:    { name: 'Wasp SMG', cls: 'SMG', dmg: 18, rpm: 1100, mag: 40, reserve: 200, reload: 2.3, spread: 0.08, ads: 0.026, bloom: 0.009, auto: true, pellets: 1, range: 800, len: 11,
             kickMul: 0.8, swayMul: 1.5, fall: { from: 220, to: 500, min: 0.55 }, trait: 'A frantic fire rate shreds up close; wild sideways recoil and weak at range.' },
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
  ox:      { name: 'Ox Belt-Fed', cls: 'LMG', dmg: 31, rpm: 540, mag: 100, reserve: 100, reload: 6.0, spread: 0.10, ads: 0.022, bloom: 0.009, auto: true, pellets: 1, range: 1200, len: 18,
             adsMul: 1.35, kickMul: 1.1, swayMul: 0.6, trait: '100 heavy rounds that stay on target, but very slow to aim and an age to reload.' },
  drummer: { name: 'Drummer LMG', cls: 'LMG', dmg: 24, rpm: 780, mag: 60, reserve: 180, reload: 3.6, spread: 0.085, ads: 0.026, bloom: 0.009, auto: true, pellets: 1, range: 1050, len: 16,
             adsMul: 0.8, swayMul: 1.2, trait: 'A light, fast LMG: quick to aim and reload for its kind, but its bullets hit softer.' },
  pike:    { name: 'Pike Bolt-Action', cls: 'DMR', mode: 'bolt-action', dmg: 112, rpm: 50, mag: 5, reserve: 30, reload: 3.2, spread: 0.09, ads: 0.002, bloom: 0.05, auto: false, pellets: 1, range: 1600, len: 20,
             pen: 0.8, adsMul: 1.3, kickMul: 1.5, settle: 0.9, trait: 'One body shot drops any light or medium operator. A slow bolt between shots, slow to aim, hopeless from the hip.' },
  heron:   { name: 'Heron Marksman', cls: 'DMR', dmg: 44, rpm: 480, mag: 20, reserve: 100, reload: 2.4, spread: 0.055, ads: 0.007, bloom: 0.014, auto: false, pellets: 1, range: 1200, len: 16,
             adsMul: 0.85, kickMul: 0.7, settle: 0.4, trait: 'A quick-firing marksman rifle with light recoil: three fast hits drop anyone.' },
  gnat:    { name: 'Gnat Machine Pistol', cls: 'MP', dmg: 17, rpm: 1050, mag: 20, reserve: 100, reload: 1.7, spread: 0.09, ads: 0.035, bloom: 0.011, auto: true, pellets: 1, range: 700, len: 7,
             kickMul: 1.2, swayMul: 1.4, fall: { from: 200, to: 450, min: 0.55 }, trait: 'A full-auto sidearm: 20 rounds gone in about a second, fierce recoil.' },
  bison:   { name: 'Bison Revolver', cls: 'Pistol', dmg: 64, rpm: 130, mag: 6, reserve: 30, reload: 3.0, spread: 0.05, ads: 0.006, bloom: 0.05, auto: false, pellets: 1, range: 1000, len: 9,
             pen: 0.55, kickMul: 1.8, settle: 0.6, fall: { from: 400, to: 700, min: 0.8 }, trait: 'Two body shots drop anyone. Six rounds, slow to fire and reload, very accurate.' },
  // he asked for side-specific weapons (no gun on both sides), so attack and defence each got the guns they were missing
  javelin: { name: 'Javelin SMG', cls: 'SMG', dmg: 25, rpm: 800, mag: 30, reserve: 180, reload: 2.2, spread: 0.065, ads: 0.019, bloom: 0.010, auto: true, pellets: 1, range: 950, len: 12,
             adsMul: 0.85, fall: { from: 320, to: 620, min: 0.65 }, trait: 'The attackers\' SMG: quick to aim, steady, good on the move.' },
  halberd: { name: 'Halberd Breaching Shotgun', cls: 'Shotgun', mode: 'pump-action', dmg: 16, rpm: 72, mag: 8, reserve: 48, reload: 3.3, spread: 0.14, ads: 0.10, bloom: 0, auto: false, pellets: 8, range: 440, len: 15,
             kickMul: 1.1, trait: 'A heavy pump built for breaching: a tight blast that tears soft walls and hatches open.' },
  sentry:  { name: 'Sentry Carbine', cls: 'AR', dmg: 30, rpm: 690, mag: 30, reserve: 150, reload: 2.3, spread: 0.058, ads: 0.016, bloom: 0.012, auto: true, pellets: 1, range: 900, len: 13,
             adsMul: 0.9, fall: { from: 300, to: 600, min: 0.7 }, trait: 'A short defender\'s carbine for holding a room: quick to the shoulder, but its damage drops off sooner.' },
  sparrow: { name: 'Sparrow Compact', cls: 'Pistol', dmg: 28, rpm: 520, mag: 17, reserve: 68, reload: 1.4, spread: 0.05, ads: 0.017, bloom: 0.018, auto: false, pellets: 1, range: 850, len: 6,
             trait: 'A light, quick pistol: fast to fire and reload, but hits softer.' },
};
// guns only carried as a sidearm (second slot)
export const SIDEARMS = new Set(['p10', 'vex50', 'bison', 'gnat', 'stub', 'sparrow']);

// armor: 1 = heavy/slow, 2 = medium, 3 = light/fast. HP follows armor.
export const ARMOR_HP = { 1: 125, 2: 110, 3: 100 };
// build follows armor too: heavies stay broad, mediums and lights are skinnier (drawn narrower AND harder to hit).
// HIT_R is how close (px) a bullet must pass to a body's centre to hit it; walls still use PLAYER_R for bumping.
export const BODY_W = { 1: 0.95, 2: 0.84, 3: 0.76 };
export const HIT_R = { 1: 7.5, 2: 6.8, 3: 6.2 };
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
             ability: { id: 'dart', name: 'Seeker Dart', count: 3, desc: 'Fire a dart into a wall. For 10 seconds it pings every enemy near it, through walls, for your whole team.' },
             gadget: 'frag', gadgetCount: 2, color: '#4fb3a9', helmet: '#5a5f4a', look: 'cap' },
  hammer:  { team: 'atk', name: 'HAMMER',  role: 'Soft Breacher', armor: 2, primary: 'breaker', secondary: 'p10',
             ability: { id: 'slug', name: 'Breaching Rounds', count: 5, desc: 'Launch an explosive round that blows open soft walls, barricades and anyone standing behind them.' },
             gadget: 'claymore', gadgetCount: 1, color: '#c9b037', helmet: '#4a4032', look: 'helmet' },
  talon:   { team: 'atk', name: 'TALON',   role: 'Disruptor',     armor: 3, primary: 'v9',      secondary: 'p10',
             ability: { id: 'emp', name: 'EMP Grenade', count: 2, desc: 'Destroys jammers, traps and enemy gadgets nearby, and blinds cameras for 12 seconds.' },
             gadget: 'breach', gadgetCount: 2, color: '#a46ad6', helmet: '#4a5164', look: 'goggles' },
  bulwark: { team: 'atk', name: 'BULWARK', role: 'Shield',        armor: 1, primary: 'p10',     secondary: null,
             ability: { id: 'brace', name: 'Ballistic Shield', count: 0, desc: 'Shield up: bullets cannot get through the front, but you cannot shoot; melee is a shield bash that staggers (a miss leaves you open). Press to put the shield on your back and draw your pistol (takes a moment); it then guards your back.' },
             gadget: 'stun', gadgetCount: 2, color: '#d84a4a', helmet: '#46484c', look: 'visor' },
  rivet   : { team: 'atk', name: 'RIVET', role: 'Hard Breacher', armor: 2, primary: 'k4', secondary: 'p10',
             ability: {id: "lance",name: "Thermal Lance",count: 0,battery: 14,desc: "Hold facing a wall to burn through it one block at a time — even reinforced walls and steel panels. Quiet, but the glow gives you away."},
             gadget: 'stun', gadgetCount: 2, color: '#ff8a3d', helmet: '#4d4436', look: 'goggles' },
  haze    : { team: 'atk', name: 'HAZE', role: 'Smoke Support', armor: 2, primary: 'k4', secondary: 'p10',
             ability: {id: "barrage",name: "Smoke Barrage",count: 2,desc: "Fire three smoke canisters in a line to wall off a whole sightline for 12 seconds."},
             gadget: 'breach', gadgetCount: 2, color: '#9aa3ad', helmet: '#3f4448', look: 'mask' },
  glint   : { team: 'atk', name: 'GLINT', role: 'Intel', armor: 3, primary: 'v9', secondary: 'p10',
             ability: {id: "sonar",name: "Sonar Pulse",count: 3,desc: "Throw a pulse emitter. When it lands it reveals every defender nearby, through walls, to your whole team for a few seconds."},
             gadget: 'frag', gadgetCount: 2, color: '#5fd3e8', helmet: '#2f4a52', look: 'visor' },
  brisk   : { team: 'atk', name: 'BRISK', role: 'Entry Fragger', armor: 3, primary: 'hornet', secondary: 'vex50',
             ability: {id: "adrenal",name: "Adrenal Shot",count: 2,desc: "Inject yourself: for 6 seconds you move a quarter faster and aim down sights twice as quickly."},
             gadget: 'stun', gadgetCount: 2, color: '#e84a7a', helmet: '#4a2a36', look: 'cap' },
  onyx    : { team: 'atk', name: 'ONYX', role: 'Area Denial', armor: 1, primary: 'mule', secondary: 'p10',
             ability: {id: "cluster",name: "Cluster Charge",count: 3,desc: "Stick it on a soft wall. After 3 seconds it fires four bomblets into the room on the other side."},
             gadget: 'smoke', gadgetCount: 2, color: '#3a3d44', helmet: '#1f2125', look: 'helmet' },
  prism   : { team: 'atk', name: 'PRISM', role: 'Deception', armor: 3, primary: 'v9', secondary: 'p10',
             ability: {id: "decoy",name: "Holo Decoy",count: 3,desc: "Send a hologram of yourself running ahead. Defenders see and hear a real attacker until they shoot it."},
             gadget: 'smoke', gadgetCount: 2, color: '#c58cff', helmet: '#43365a', look: 'hood' },
  volt    : { team: 'atk', name: 'VOLT', role: 'Gadget Denial', armor: 2, primary: 'k4', secondary: 'p10',
             ability: {id: "arc",name: "Arc Gun",count: 5,desc: "Fire an electric bolt: it destroys the first enemy gadget it touches (cameras, traps, sensors) or shocks a defender."},
             gadget: 'breach', gadgetCount: 2, color: '#f2e14e', helmet: '#4a4530', look: 'goggles' },
  tether  : { team: 'atk', name: 'TETHER', role: 'Recon', armor: 2, primary: 'longbow', secondary: 'p10',
             ability: {id: "scope",name: "Wall Scope",count: 2,desc: "Push a fibre-optic scope through a soft wall. Your team sees the room behind it until a defender shoots it."},
             gadget: 'claymore', gadgetCount: 2, color: '#6fbf73', helmet: '#34452f', look: 'cap' },
  strider : { team: 'atk', name: 'STRIDER', role: 'Silent Flank', armor: 3, primary: 'v9', secondary: 'vex50',
             ability: {id: "ghost",name: "Ghost Step",count: 2,desc: "For 10 seconds your footsteps are silent and you set off no traps, sensors, scanners or darts."},
             gadget: 'frag', gadgetCount: 2, color: '#8ab4d8', helmet: '#2b3a48', look: 'hood' },
  ferro   : { team: 'atk', name: 'FERRO', role: 'Soft Breacher', armor: 1, primary: 'breaker', secondary: 'p10',
             ability: {id: "hammer",name: "Breaching Hammer",count: 20,desc: "A sledgehammer that smashes soft walls and barricades open in one swing — and flattens anyone in reach."},
             gadget: 'stun', gadgetCount: 2, color: '#b0703c', helmet: '#4a3828', look: 'helmet' },
  // ---- added to fill every role to 5 (he asked) ----
  salvo: { team: 'atk', name: 'SALVO', role: 'Launcher Breacher', armor: 2, primary: 'rook', secondary: 'p10',
             ability: { id: 'sticky', name: 'Delay Launcher', count: 4, desc: 'Fire a round that sticks to whatever it hits — a wall, a barricade or a person — and blows 1.5 seconds later, blasting through soft walls into the room behind.' },
             gadget: 'stun', gadgetCount: 2, color: '#e05a3a', helmet: '#4b4a3e', look: 'helmet' },
  torque: { team: 'atk', name: 'TORQUE', role: 'Hydraulic Breacher', armor: 1, primary: 'ox', secondary: 'p10',
             ability: { id: 'spreader', name: 'Hydraulic Spreader', count: 2, desc: 'Clamp a hydraulic spreader on a wall. After 4 seconds it prises a body-sized gap open — even in a reinforced wall. Jammers and static grids stop it.' },
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
             ability: { id: 'tracer', name: 'Tracer Rounds', count: 3, desc: 'Load tracer rounds for 8 seconds: every defender you hit glows for your team for 4 seconds.' },
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
             ability: { id: 'cloak', name: 'Smoke Cloak', count: 2, desc: 'A thin cloud of smoke follows you for 6 seconds, hiding you from anyone further than a few metres away.' },
             gadget: 'frag', gadgetCount: 2, color: '#9aa8b8', helmet: '#40444c', look: 'mask' },
  crow: { team: 'atk', name: 'CROW', role: 'Silent Takedown', armor: 3, primary: 'sabre', secondary: 'p10',
             ability: { id: 'takedown', name: 'Silent Takedown', count: 0, desc: 'Passive: a melee hit from behind is an instant, silent kill.' },
             gadget: 'stun', gadgetCount: 2, color: '#3a3d46', helmet: '#2a2c32', look: 'hood' },
  // ---------- Defence ----------
  mason:   { team: 'def', name: 'MASON',   role: 'Fortifier',     armor: 1, primary: 'mule',    secondary: 'p10',
             ability: { id: 'panel', name: 'Armor Panel', count: 3, desc: 'Seal a door or window with a bulletproof steel panel. Only explosives and cutters get through.' },
             gadget: 'dshield', gadgetCount: 1, color: '#7b8fa6', helmet: '#5a6475', look: 'helmet' },
  veil:    { team: 'def', name: 'VEIL',    role: 'Anti-Gadget',   armor: 2, primary: 'v9',      secondary: 'p10',
             ability: { id: 'jammer', name: 'Signal Jammer', count: 3, desc: 'Drop a jammer. Drones, cutters, breach charges and seeker darts stop working near it.' },
             gadget: 'nitro', gadgetCount: 1, color: '#55c1e8', helmet: '#36505e', look: 'hood' },
  lynx:    { team: 'def', name: 'LYNX',    role: 'Trapper',       armor: 3, primary: 'v9',      secondary: 'p10',
             ability: { id: 'mine', name: 'Trip Mine', count: 3, desc: 'Hidden laser mine. When an attacker walks into it, it explodes, slows them and reveals where they are.' },
             gadget: 'wire', gadgetCount: 2, color: '#8fd14f', helmet: '#33402a', look: 'cap' },
  solace:  { team: 'def', name: 'SOLACE',  role: 'Medic',         armor: 2, primary: 'breaker', secondary: 'p10',
             ability: { id: 'stim', name: 'Stim Pistol', count: 3, desc: 'Shoot a teammate to heal them (or revive them if they are down). With nobody in your sights, it heals you.' },
             gadget: 'wire', gadgetCount: 2, color: '#f2f2f2', helmet: '#7a2b2b', look: 'helmet' },
  wraith:  { team: 'def', name: 'WRAITH',  role: 'Intel Roamer',  armor: 3, primary: 'longbow', secondary: 'p10',
             ability: { id: 'scan', name: 'Pulse Scanner', count: 0, battery: 8, desc: 'Hold to scan. While scanning you see every attacker within range through walls, but you cannot shoot.' },
             gadget: 'impact', gadgetCount: 2, color: '#6c7cf0', helmet: '#3c4260', look: 'mask' },
  bramble : { team: 'def', name: 'BRAMBLE', role: 'Trapper', armor: 2, primary: 'v9', secondary: 'p10',
             ability: {id: "prox",name: "Proximity Charge",count: 2,desc: "Hide a charge by a door or window. When an attacker comes close it beeps once, then explodes."},
             gadget: 'wire', gadgetCount: 2, color: '#7a9a3a', helmet: '#3a4a22', look: 'cap' },
  kite    : { team: 'def', name: 'KITE', role: 'Intel', armor: 2, primary: 'hornet', secondary: 'p10',
             ability: {id: "turret",name: "Turret Camera",count: 2,desc: "Place a bulletproof camera that fires a stinging laser (it overheats after 12 shots). Only explosives and gadget-killers destroy it."},
             gadget: 'dshield', gadgetCount: 2, color: '#e05252', helmet: '#4a2a2a', look: 'visor' },
  gravel  : { team: 'def', name: 'GRAVEL', role: 'Area Denial', armor: 3, primary: 'v9', secondary: 'vex50',
             ability: {id: "concuss",name: "Daze Mines",count: 3,desc: "Sticky mines that daze any attacker who comes near: shaky aim and slow legs for 4 seconds."},
             gadget: 'impact', gadgetCount: 2, color: '#c4a05a', helmet: '#4a3c22', look: 'goggles' },
  shunt   : { team: 'def', name: 'SHUNT', role: 'Anti-Breach', armor: 1, primary: 'mule', secondary: 'p10',
             ability: {id: "grid",name: "Static Grid",count: 3,desc: "Clamp it on a wall. It fries cutters, charges and scopes placed on that wall and shocks anyone torching it."},
             gadget: 'wire', gadgetCount: 2, color: '#4f86ff', helmet: '#2a3654', look: 'helmet' },
  hush    : { team: 'def', name: 'HUSH', role: 'Stealth Roamer', armor: 3, primary: 'v9', secondary: 'p10',
             ability: {id: "shroud",name: "Silent Shroud",count: 0,battery: 10,desc: "Hold to go dark: silent footsteps and invisible to drones and cameras. Recharges while off."},
             gadget: 'impact', gadgetCount: 2, color: '#5a5f6e', helmet: '#25272d', look: 'hood' },
  shade   : { team: 'def', name: 'SHADE', role: 'Intel', armor: 2, primary: 'breaker', secondary: 'p10',
             ability: {id: "sensor",name: "Sound Sensor",count: 3,desc: "Place a microphone. Any attacker who runs near it is revealed to your whole team."},
             gadget: 'nitro', gadgetCount: 2, color: '#9b6be0', helmet: '#3a2f52', look: 'mask' },
  rampart : { team: 'def', name: 'RAMPART', role: 'Support', armor: 1, primary: 'breaker', secondary: 'p10',
             ability: {id: "plates",name: "Armor Bag",count: 1,desc: "Drop a bag of armor plates. Every teammate who walks over it gets 15 extra health for the round."},
             gadget: 'dshield', gadgetCount: 2, color: '#8f9aa6', helmet: '#3c4249', look: 'helmet' },
  miasma  : { team: 'def', name: 'MIASMA', role: 'Area Denial', armor: 2, primary: 'v9', secondary: 'p10',
             ability: {id: "gas",name: "Toxin Canister",count: 3,desc: "Throw a canister, then press again to release a toxic cloud that hurts attackers inside for 8 seconds."},
             gadget: 'wire', gadgetCount: 2, color: '#9bc43a', helmet: '#3d4a1e', look: 'mask' },
  snare   : { team: 'def', name: 'SNARE', role: 'Trapper', armor: 2, primary: 'breaker', secondary: 'vex50',
             ability: {id: "clamp",name: "Clamp Trap",count: 3,desc: "A spring trap hidden on the floor. An attacker who steps in is held in place for 2 seconds and hurt."},
             gadget: 'impact', gadgetCount: 2, color: '#a35f3a', helmet: '#3e2a1e', look: 'cap' },
  argus   : { team: 'def', name: 'ARGUS', role: 'Intel', armor: 3, primary: 'hornet', secondary: 'p10',
             ability: {id: "stickycam",name: "Sticky Cams",count: 3,desc: "Throw cameras that stick where they land and join your team’s camera network."},
             gadget: 'nitro', gadgetCount: 2, color: '#3ac4b0', helmet: '#1f4740', look: 'visor' },
  // ---- added to fill every role to 5 (he asked) ----
  solder: { team: 'def', name: 'SOLDER', role: 'Wall Welder', armor: 1, primary: 'drummer', secondary: 'vex50',
             ability: { id: 'weld', name: 'Wall Welder', count: 0, battery: 12, desc: 'Hold facing a broken soft wall to weld it shut again, one block at a time.' },
             gadget: 'dshield', gadgetCount: 1, color: '#d08a3a', helmet: '#4a4036', look: 'mask' },
  latch: { team: 'def', name: 'LATCH', role: 'Alarm Trapper', armor: 2, primary: 'v9', secondary: 'vex50',
             ability: { id: 'alarm', name: 'Alarm Wire', count: 3, desc: 'Hide an alarm wire on the floor (best across a doorway). An attacker who crosses it is revealed to your team for 6 seconds.' },
             gadget: 'wire', gadgetCount: 2, color: '#b0b84a', helmet: '#44473a', look: 'cap' },
  hound: { team: 'def', name: 'HOUND', role: 'Tracker', armor: 3, primary: 'marten', secondary: 'sparrow',
             ability: { id: 'tag', name: 'Spotter Dart', count: 3, desc: 'Fire a spotter dart: the first attacker it hits is revealed to your team for 10 seconds.' },
             gadget: 'impact', gadgetCount: 2, color: '#c26a3a', helmet: '#463c34', look: 'cap' },
  ruse: { team: 'def', name: 'RUSE', role: 'Decoy Roamer', armor: 3, primary: 'wasp', secondary: 'sparrow',
             ability: { id: 'echobox', name: 'Echo Box', count: 2, desc: 'Throw an echo box. For 8 seconds it plays footsteps and gunfire, so attackers think someone is there.' },
             gadget: 'nitro', gadgetCount: 1, color: '#8a6ad6', helmet: '#3c3848', look: 'hood' },
  rally: { team: 'def', name: 'RALLY', role: 'Second Wind', armor: 2, primary: 'hornet', secondary: 'vex50',
             ability: { id: 'rally', name: 'Second Wind', count: 2, desc: 'Heal 40 and move a quarter faster for 4 seconds.' },
             gadget: 'impact', gadgetCount: 2, color: '#e05a7a', helmet: '#46384a', look: 'goggles' },
  lens: { team: 'def', name: 'LENS', role: 'Periscope', armor: 2, primary: 'lark', secondary: 'vex50',
             ability: { id: 'periscope', name: 'Periscope', count: 2, desc: 'Push a periscope through a soft wall from the inside. Your team can watch the other side in the camera feeds until an attacker shoots it.' },
             gadget: 'dshield', gadgetCount: 1, color: '#4ab0e0', helmet: '#3a4450', look: 'visor' },
  audit: { team: 'def', name: 'AUDIT', role: 'Drone Hunter', armor: 3, primary: 'wasp', secondary: 'sparrow',
             ability: { id: 'radar', name: 'Drone Radar', count: 2, desc: 'Drop a drone radar: every attacker drone within 15 metres is pinged for your team, again and again for 15 seconds.' },
             gadget: 'impact', gadgetCount: 2, color: '#5ad0c0', helmet: '#3a4846', look: 'goggles' },
  tonic: { team: 'def', name: 'TONIC', role: 'Heal Station', armor: 2, primary: 'breaker', secondary: 'vex50',
             ability: { id: 'station', name: 'Heal Station', count: 1, desc: 'Place a heal station. Teammates standing next to it heal 6 health a second, up to 100 in total.' },
             gadget: 'wire', gadgetCount: 2, color: '#6ad08a', helmet: '#3e4a42', look: 'helmet' },
  ward: { team: 'def', name: 'WARD', role: 'Grenade Catcher', armor: 2, primary: 'v9', secondary: 'vex50',
             ability: { id: 'catcher', name: 'Grenade Catcher', count: 2, desc: 'Place a grenade catcher. It zaps the first two attacker grenades, launcher rounds or flares that come near it.' },
             gadget: 'dshield', gadgetCount: 1, color: '#7aa0e8', helmet: '#3a4252', look: 'visor' },
  girder: { team: 'def', name: 'GIRDER', role: 'Steel Crew', armor: 1, primary: 'drummer', secondary: 'vex50',
             ability: { id: 'crew', name: 'Steel Crew', count: 0, desc: 'Passive: your team gets 2 extra reinforcements, and you reinforce walls and hatches twice as fast.' },
             gadget: 'wire', gadgetCount: 2, color: '#a0a0a0', helmet: '#4a4a4a', look: 'helmet' },
};

export const OP_LIST = Object.keys(OPERATORS);
export const opsForTeam = team => OP_LIST.filter(k => OPERATORS[k].team === team);

// ---- loadouts: each operator's weapon and gadget choices ----
export const GADGET_COUNT = { smoke: 2, frag: 2, claymore: 1, breach: 2, stun: 2, dshield: 1, nitro: 1, wire: 2, impact: 2 };
// He asked for side-specific weapons: no gun is carried by both attackers and defenders, and defence has no marksman
// or sniper rifles (the Anvil slug does that job). tests/weapons.js checks it.
export const LOADOUTS = {
  ember:   { primaries: ['k4', 'tusk', 'rook'], secondaries: ['p10', 'stub'], gadgets: ['smoke', 'breach'] },
  kestrel: { primaries: ['longbow', 'k4', 'pike'], secondaries: ['p10', 'bison'], gadgets: ['frag', 'claymore'] },
  hammer:  { primaries: ['halberd', 'javelin', 'tusk'], secondaries: ['p10', 'stub'], gadgets: ['claymore', 'frag'] },
  talon:   { primaries: ['sabre', 'k4', 'trident'], secondaries: ['p10', 'stub'], gadgets: ['breach', 'stun'] },
  bulwark: { primaries: ['p10', 'bison'], secondaries: [], gadgets: ['stun', 'smoke'] }, // one hand on the shield: pistols only
  rivet:   { primaries: ['k4', 'sabre', 'halberd'], secondaries: ['p10', 'bison'], gadgets: ['stun', 'smoke'] },
  haze:    { primaries: ['k4', 'javelin', 'trident'], secondaries: ['p10', 'bison'], gadgets: ['breach', 'frag'] },
  glint:   { primaries: ['javelin', 'longbow', 'heron'], secondaries: ['p10', 'bison'], gadgets: ['frag', 'claymore'] },
  brisk:   { primaries: ['javelin', 'tusk', 'sabre'], secondaries: ['p10', 'bison'], gadgets: ['stun', 'smoke'] },
  onyx:    { primaries: ['mule', 'ox', 'rook'], secondaries: ['p10', 'stub'], gadgets: ['smoke', 'breach'] },
  prism:   { primaries: ['javelin', 'k4', 'heron'], secondaries: ['p10', 'stub'], gadgets: ['smoke', 'stun'] },
  volt:    { primaries: ['k4', 'javelin', 'trident'], secondaries: ['p10', 'bison'], gadgets: ['breach', 'claymore'] },
  tether:  { primaries: ['longbow', 'k4', 'pike'], secondaries: ['p10', 'bison'], gadgets: ['claymore', 'smoke'] },
  strider: { primaries: ['javelin', 'sabre', 'halberd'], secondaries: ['p10', 'bison'], gadgets: ['frag', 'stun'] },
  ferro:   { primaries: ['halberd', 'mule', 'tusk'], secondaries: ['p10', 'stub'], gadgets: ['stun', 'claymore'] },
  mason:   { primaries: ['drummer', 'breaker', 'sentry'], secondaries: ['vex50', 'sparrow'], gadgets: ['dshield', 'wire'] },
  veil:    { primaries: ['v9', 'wasp', 'anvil'], secondaries: ['vex50', 'gnat'], gadgets: ['nitro', 'impact'] },
  lynx:    { primaries: ['v9', 'hornet', 'wasp'], secondaries: ['vex50', 'gnat'], gadgets: ['wire', 'impact'] },
  solace:  { primaries: ['breaker', 'lark', 'sentry'], secondaries: ['vex50', 'sparrow'], gadgets: ['wire', 'dshield'] },
  wraith:  { primaries: ['lark', 'v9', 'anvil'], secondaries: ['vex50', 'gnat'], gadgets: ['impact', 'nitro'] },
  bramble: { primaries: ['v9', 'breaker', 'anvil'], secondaries: ['sparrow', 'vex50'], gadgets: ['wire', 'impact'] },
  kite:    { primaries: ['hornet', 'lark', 'sentry'], secondaries: ['vex50', 'gnat'], gadgets: ['dshield', 'nitro'] },
  gravel:  { primaries: ['v9', 'hornet', 'marten'], secondaries: ['vex50', 'gnat'], gadgets: ['impact', 'wire'] },
  shunt:   { primaries: ['sentry', 'breaker', 'drummer'], secondaries: ['vex50', 'gnat'], gadgets: ['wire', 'dshield'] },
  hush:    { primaries: ['marten', 'v9', 'anvil'], secondaries: ['sparrow', 'gnat'], gadgets: ['impact', 'nitro'] },
  shade:   { primaries: ['wasp', 'breaker', 'lark'], secondaries: ['vex50', 'sparrow'], gadgets: ['nitro', 'wire'] },
  rampart: { primaries: ['breaker', 'drummer', 'anvil'], secondaries: ['vex50', 'sparrow'], gadgets: ['dshield', 'wire'] },
  miasma:  { primaries: ['v9', 'breaker', 'sentry'], secondaries: ['vex50', 'gnat'], gadgets: ['wire', 'impact'] },
  snare:   { primaries: ['breaker', 'v9', 'anvil'], secondaries: ['vex50', 'sparrow'], gadgets: ['impact', 'nitro'] },
  argus:   { primaries: ['hornet', 'lark', 'v9'], secondaries: ['sparrow', 'gnat'], gadgets: ['nitro', 'impact'] },
  salvo: { primaries: ['rook', 'k4', 'javelin'], secondaries: ['p10', 'stub'], gadgets: ['stun', 'claymore'] },
  torque: { primaries: ['ox', 'halberd', 'k4'], secondaries: ['p10', 'bison'], gadgets: ['smoke', 'stun'] },
  rush: { primaries: ['tusk', 'javelin', 'sabre'], secondaries: ['p10', 'stub'], gadgets: ['stun', 'frag'] },
  blaze: { primaries: ['trident', 'k4', 'javelin'], secondaries: ['p10', 'bison'], gadgets: ['smoke', 'breach'] },
  echo: { primaries: ['sabre', 'longbow', 'heron'], secondaries: ['p10', 'bison'], gadgets: ['claymore', 'smoke'] },
  mark: { primaries: ['heron', 'javelin', 'longbow'], secondaries: ['p10', 'bison'], gadgets: ['frag', 'smoke'] },
  patch: { primaries: ['k4', 'javelin', 'trident'], secondaries: ['p10', 'bison'], gadgets: ['smoke', 'breach'] },
  trench: { primaries: ['mule', 'rook', 'halberd'], secondaries: ['p10', 'stub'], gadgets: ['breach', 'frag'] },
  wren: { primaries: ['javelin', 'sabre', 'trident'], secondaries: ['p10', 'stub'], gadgets: ['smoke', 'stun'] },
  vapor: { primaries: ['javelin', 'heron', 'tusk'], secondaries: ['p10', 'bison'], gadgets: ['frag', 'stun'] },
  crow: { primaries: ['sabre', 'javelin', 'tusk'], secondaries: ['p10', 'stub'], gadgets: ['stun', 'smoke'] },
  solder: { primaries: ['drummer', 'sentry', 'breaker'], secondaries: ['vex50', 'sparrow'], gadgets: ['dshield', 'wire'] },
  latch: { primaries: ['v9', 'wasp', 'anvil'], secondaries: ['vex50', 'gnat'], gadgets: ['wire', 'impact'] },
  hound: { primaries: ['marten', 'v9', 'anvil'], secondaries: ['sparrow', 'gnat'], gadgets: ['impact', 'nitro'] },
  ruse: { primaries: ['wasp', 'lark', 'v9'], secondaries: ['sparrow', 'gnat'], gadgets: ['nitro', 'impact'] },
  rally: { primaries: ['hornet', 'v9', 'anvil'], secondaries: ['vex50', 'gnat'], gadgets: ['impact', 'nitro'] },
  lens: { primaries: ['lark', 'hornet', 'sentry'], secondaries: ['vex50', 'sparrow'], gadgets: ['dshield', 'nitro'] },
  audit: { primaries: ['wasp', 'v9', 'lark'], secondaries: ['sparrow', 'gnat'], gadgets: ['impact', 'wire'] },
  tonic: { primaries: ['breaker', 'lark', 'sentry'], secondaries: ['vex50', 'sparrow'], gadgets: ['wire', 'dshield'] },
  ward: { primaries: ['v9', 'sentry', 'anvil'], secondaries: ['vex50', 'gnat'], gadgets: ['dshield', 'impact'] },
  girder: { primaries: ['drummer', 'breaker', 'anvil'], secondaries: ['vex50', 'sparrow'], gadgets: ['wire', 'dshield'] },
};
export function defaultLoadout(op) {
  const L = LOADOUTS[op];
  return { primary: L.primaries[0], secondary: L.secondaries[0] || null, gadget: L.gadgets[0] };
}
// Keep only choices that operator actually has.
export function cleanLoadout(op, l) {
  const L = LOADOUTS[op], d = defaultLoadout(op);
  if (!L || !l || typeof l !== 'object') return { ...d, att: {} };
  const att = {};
  for (const w of [...L.primaries, ...L.secondaries]) if (l.att && l.att[w]) att[w] = cleanAtt(w, l.att[w]);
  return {
    primary: L.primaries.includes(l.primary) ? l.primary : d.primary,
    secondary: L.secondaries.includes(l.secondary) ? l.secondary : d.secondary,
    gadget: L.gadgets.includes(l.gadget) ? l.gadget : d.gadget,
    att,
  };
}

// ---- roles (he asked: pick a role before each round; it limits you to that role's operators, so new players
// know their job). Every operator has exactly one.
export const JOBS = {
  atk: [
    { id: 'breach', name: 'Breacher', desc: 'Open walls and hatches into the objective.', ops: ['ember', 'rivet', 'hammer', 'ferro', 'salvo', 'torque'] },
    { id: 'entry', name: 'Entry', desc: 'Go in first and win the opening fight.', ops: ['brisk', 'bulwark', 'onyx', 'rush', 'blaze'] },
    { id: 'intel', name: 'Intel', desc: 'Find the defenders and tell the team.', ops: ['kestrel', 'glint', 'tether', 'echo', 'mark'] },
    { id: 'support', name: 'Support', desc: 'Smoke, clear traps and kill gadgets so others can push.', ops: ['haze', 'talon', 'volt', 'patch', 'trench'] },
    { id: 'flank', name: 'Flank', desc: 'Sneak round and catch roamers from behind.', ops: ['strider', 'prism', 'wren', 'vapor', 'crow'] },
  ],
  def: [
    { id: 'anchor', name: 'Anchor', desc: 'Hold the objective: fortify it and deny the area.', ops: ['mason', 'shunt', 'rampart', 'miasma', 'solder'] },
    { id: 'trapper', name: 'Trapper', desc: 'Hide traps where attackers will walk.', ops: ['lynx', 'bramble', 'snare', 'gravel', 'latch'] },
    { id: 'roamer', name: 'Roamer', desc: 'Leave the objective, slow the attack and flank.', ops: ['wraith', 'hush', 'hound', 'ruse', 'rally'] },
    { id: 'intel', name: 'Intel', desc: 'Watch cameras and sensors and call out the attack.', ops: ['kite', 'shade', 'argus', 'lens', 'audit'] },
    { id: 'support', name: 'Support', desc: 'Heal the team and stop breaching gadgets.', ops: ['solace', 'veil', 'tonic', 'ward', 'girder'] },
  ],
};
export const jobOf = op => { for (const t of ['atk', 'def']) for (const j of JOBS[t]) if (j.ops.includes(op)) return j.id; return null; };

// ---- weapons in plain words, and attachments ----
export const CLASS_NAME = { AR: 'Assault rifle', SMG: 'Submachine gun', MP: 'Machine pistol', LMG: 'Light machine gun', DMR: 'Marksman rifle', Shotgun: 'Shotgun', Pistol: 'Pistol' };
export const CLASS_TIP = {
  AR: 'All-rounder: good at most ranges.', SMG: 'Fast-firing, best up close.', MP: 'Tiny and very fast, best up close.',
  LMG: 'Huge magazine, slow to aim.', DMR: 'Hard-hitting single shots at range.', Shotgun: 'Devastating up close, weak far away.', Pistol: 'Backup gun.',
};
// Each attachment nudges the gun a little. Multipliers: dmg, range (full-damage distance), ads (time to aim),
// hip (hip-fire spread), adsSpread (aimed spread), kick (upward recoil), sway (sideways recoil), first (first shots' kick).
export const ATTACH = {
  barrel: {
    none: { name: 'Standard barrel', short: 'Standard', desc: 'No changes.' },
    suppressor: { name: 'Suppressor', short: 'Suppressor', desc: 'Much quieter shots and no muzzle flash. 10% less damage.', dmg: 0.9, quiet: 1 },
    compensator: { name: 'Compensator', short: 'Compensator', desc: 'Less sideways recoil when spraying.', sway: 0.55 },
    brake: { name: 'Muzzle Brake', short: 'Muzzle brake', desc: 'Your first few shots kick much less.', first: 0.55 },
    extended: { name: 'Extended Barrel', short: 'Extended', desc: 'Full damage from further away. Slightly slower to aim.', range: 1.3, ads: 1.08 },
  },
  grip: {
    none: { name: 'No grip', short: 'None', desc: 'No changes.' },
    vertical: { name: 'Vertical Grip', short: 'Vertical grip', desc: 'Less upward kick when spraying.', kick: 0.78 },
    angled: { name: 'Angled Grip', short: 'Angled grip', desc: 'Aim down sights 20% faster.', ads: 0.8 },
    laser: { name: 'Laser', short: 'Laser', desc: 'Tighter hip-fire, but enemies can see your beam.', hip: 0.72, laser: 1 },
  },
  sight: {
    iron: { name: 'Iron Sights', short: 'Iron sights', desc: 'No changes.' },
    reddot: { name: 'Red Dot', short: 'Red dot', desc: 'Slightly tighter aimed shots.', adsSpread: 0.88 },
    holo: { name: 'Holo Sight', short: 'Holo', desc: 'A little faster to aim.', ads: 0.9 },
    scope: { name: '2.0× Scope', short: '2× scope', desc: 'Very accurate aimed shots and you see further ahead, but slower to aim.', adsSpread: 0.7, ads: 1.2, zoom: 1 },
  },
};
export const ATTACH_SLOTS = [['barrel', 'Barrel'], ['grip', 'Grip'], ['sight', 'Sight']];
export function attachFor(w) {
  const W = WEAPONS[w], cls = W ? W.cls : 'AR', side = SIDEARMS.has(w);
  const barrel = cls === 'Shotgun' ? ['none', 'suppressor', 'extended'] : ['none', 'suppressor', 'compensator', 'brake', 'extended'];
  return {
    barrel: W && W.quiet ? barrel.filter(b => b !== 'suppressor') : barrel, // a built-in suppressor already
    grip: side ? ['none', 'laser'] : ['none', 'vertical', 'angled', 'laser'],
    sight: side ? ['iron', 'reddot'] : ['iron', 'reddot', 'holo', 'scope'],
  };
}
export function cleanAtt(w, a) {
  const ok = attachFor(w), out = { barrel: 'none', grip: 'none', sight: 'iron' };
  if (a && typeof a === 'object') for (const s of Object.keys(out)) if (ok[s].includes(a[s])) out[s] = a[s];
  return out;
}
// All the attachments' effects on a gun, combined.
export function gunMods(w, a) {
  const m = { dmg: 1, range: 1, ads: 1, hip: 1, adsSpread: 1, kick: 1, sway: 1, first: 1, quiet: 0, laser: 0, zoom: 0 };
  const c = cleanAtt(w, a);
  if (WEAPONS[w] && WEAPONS[w].quiet) m.quiet = 1; // built in, no damage lost
  for (const [slot] of ATTACH_SLOTS) {
    const e = ATTACH[slot][c[slot]];
    for (const k of Object.keys(m)) if (e[k] !== undefined) m[k] = k === 'quiet' || k === 'laser' || k === 'zoom' ? 1 : m[k] * e[k];
  }
  return m;
}
// three short letters for the snapshot: barrel / grip / sight
export const attCode = a => [a.barrel, a.grip, a.sight].join(',');
export const attFromCode = s => { const [barrel, grip, sight] = String(s || '').split(','); return { barrel, grip, sight }; };

export const BIOS = {
  ember:   { real: 'Ines Duarte', from: 'Porto', text: 'A former shipyard welder who learned to cut through anything with a plasma torch. Calm under pressure, she treats every reinforced wall as a puzzle with one answer.' },
  kestrel: { real: 'Tomas Halvorsen', from: 'Tromsø', text: 'An arctic-warfare marksman who prefers to see a fight before it starts. His seeker darts turn walls into windows for the whole team.' },
  hammer:  { real: 'Dele Okafor', from: 'Lagos', text: 'A demolitions specialist with a launcher full of breaching rounds. Where Hammer goes, the floor plan changes.' },
  talon:   { real: 'Mei Lin Zhao', from: 'Singapore', text: 'An electronics prodigy who builds her own EMPs. She clears traps and blinds cameras so her squad can move without being watched.' },
  bulwark: { real: 'Viktor Brandt', from: 'Hamburg', text: 'A riot-control veteran who leads every push behind a ballistic shield. Slow, steady and almost impossible to stop from the front.' },
  mason:   { real: 'Graham Cole', from: 'Glasgow', text: 'A structural engineer turned operator. He seals doorways with steel panels and has never met a chokepoint he could not make worse for the enemy.' },
  veil:    { real: 'Amira Haddad', from: 'Beirut', text: 'A signals-intelligence officer who lives on the radio spectrum. Her jammers kill drones and stop breaching gadgets dead.' },
  lynx:    { real: 'Rafael Cruz', from: 'Bogotá', text: 'A jungle tracker who thinks like his prey. He hides laser trip mines where attackers least expect them and hunts whoever trips them.' },
  solace:  { real: 'Dr. Hana Sato', from: 'Osaka', text: 'A combat surgeon who refuses to lose a teammate. Her stim pistol heals at range and brings the downed back into the fight.' },
  wraith:  { real: 'Elias Grey', from: 'Unknown', text: 'A roamer who hunts alone. His pulse scanner lets him see attackers through walls, so he is always where you are not looking.' },
  rivet:   { real: "Tomás Vega", from: "Valparaíso", text: "A shipyard welder who learned to cut through anything. His thermal lance opens a peephole in a reinforced wall before the defenders hear a thing." },
  haze:    { real: "Ingrid Solberg", from: "Tromsø", text: "A wildfire smoke-jumper turned operator. She lays down walls of smoke so her team can cross open ground unseen." },
  glint:   { real: "Kwame Asante", from: "Accra", text: "A submarine sonar operator who listens to buildings. One pulse and he knows where every defender is standing." },
  brisk:   { real: "Lena Petrova", from: "Kazan", text: "A former sprint champion who goes through the door first. Her adrenal shot makes her a blur for a few vital seconds." },
  onyx:    { real: "Marcus Okafor", from: "Lagos", text: "A demolitions expert who never needs to see his target. His cluster charges clear a room through the wall." },
  prism:   { real: "Yuki Tanabe", from: "Sapporo", text: "A stage-illusion engineer. Her holograms draw fire, waste traps and make defenders doubt their own eyes." },
  volt:    { real: "Ravi Menon", from: "Kochi", text: "A power-grid lineman with a home-made arc gun. Cameras, traps and sensors don’t last long once he walks in." },
  tether:  { real: "Sofia Lindqvist", from: "Gothenburg", text: "A search-and-rescue specialist who threads cameras through rubble. Now she threads them through walls." },
  strider: { real: "Jonah Reyes", from: "Cebu", text: "A free-runner who moves without a sound. Traps and sensors simply don’t notice him." },
  ferro:   { real: "Bogdan Ilić", from: "Novi Sad", text: "A mine-rescue foreman who carries a sledgehammer everywhere. Soft walls are just doors he hasn’t made yet." },
  bramble: { real: "Aoife Brennan", from: "Galway", text: "A hunter and tracker who knows exactly where people will walk. Her proximity charges wait right there." },
  kite:    { real: "Daniel Kowalski", from: "Gdańsk", text: "A drone-racing engineer who built a camera that bites back. His turrets watch and sting from behind armour." },
  gravel:  { real: "Pilar Ortega", from: "Seville", text: "A riot-police veteran who prefers to win without killing. Her daze mines leave attackers swaying and half-blind." },
  shunt:   { real: "Henrik Aalto", from: "Tampere", text: "An electrical engineer who hates uninvited guests. His static grid makes every breaching gadget on a wall useless." },
  hush:    { real: "Noor Khalil", from: "Amman", text: "A former intelligence courier who disappears in plain sight. Drones and cameras never catch her." },
  shade:   { real: "Elif Demir", from: "Izmir", text: "An audio engineer with perfect pitch. Her microphones hear every running footstep and tell the team where it is." },
  rampart: { real: "George Mbeki", from: "Durban", text: "A rugby captain turned bodyguard. His armor bag means the whole team starts the fight tougher." },
  miasma:  { real: "Dr. Viktor Sedlák", from: "Brno", text: "A chemist who works in shades of green. His canisters turn a hallway into somewhere nobody wants to stand." },
  snare:   { real: "Callum Fraser", from: "Inverness", text: "A gamekeeper who sets traps like an artist. Step in one and you are not going anywhere for a while." },
  argus:   { real: "Mei Watanabe", from: "Kobe", text: "A security consultant who sees everything. She throws cameras the way other people throw glances." },
  salvo: { real: 'Ana Folau', from: 'Auckland', text: 'A mining blaster who swapped dynamite for a launcher. Her rounds stick, tick and then open the wall — and whoever was hiding behind it.' },
  torque: { real: 'Bruno Salas', from: 'Valencia', text: 'A firefighter who spent years cutting people out of wrecked cars. Reinforced walls are just bigger car doors.' },
  rush: { real: 'Kofi Mensah', from: 'Kumasi', text: 'A former rugby winger who has never slowed down for a door. He goes through the first barricade before the defenders know the round has started.' },
  blaze: { real: 'Rosa Lindgren', from: 'Malmö', text: 'A pyrotechnics designer for stage shows. Her flares give the defenders a show they never actually see.' },
  echo: { real: 'Iris Moreau', from: 'Lyon', text: 'A volcanologist who listens to the ground. A building full of running defenders is the loudest thing she has ever heard.' },
  mark: { real: 'Dev Malhotra', from: 'Pune', text: 'A range instructor who believes a hit you can see is worth two you cannot. His tracers paint targets for the whole team.' },
  patch: { real: 'Liam Doyle', from: 'Cork', text: 'A paramedic who throws first aid the way others throw grenades. Nobody on his team stays hurt for long.' },
  trench: { real: 'Sven Aas', from: 'Bergen', text: 'A combat engineer who builds cover where there is none. Give him two seconds and an open room becomes a fortress.' },
  wren: { real: 'Clara Weiss', from: 'Vienna', text: 'A locksmith who never learned to knock. Barricades come down quietly and she is inside before anyone turns round.' },
  vapor: { real: 'Jae Park', from: 'Busan', text: 'A special-effects artist who learned to move inside his own fog. You see the smoke; you never see him.' },
  crow: { real: 'Unknown', from: 'Unknown', text: 'Nobody on the team knows his real name. Defenders who wander off alone simply stop answering the radio.' },
  solder: { real: 'Olu Adebayo', from: 'Ibadan', text: 'A shipyard welder who hates holes. Whatever the attackers open, he closes again.' },
  latch: { real: 'Nina Varga', from: 'Debrecen', text: 'A burglar-alarm installer who now protects the other side of the door. Her wires never hurt anyone; they just tell everyone where you are.' },
  hound: { real: 'Mateo Ruiz', from: 'Mendoza', text: 'A wildlife tracker who tags his targets and lets the team do the rest.' },
  ruse: { real: 'Elena Rossi', from: 'Turin', text: 'A sound designer for horror films. Attackers spend whole rounds chasing footsteps that were never there.' },
  rally: { real: 'Tariq Aziz', from: 'Casablanca', text: 'A marathon runner who refuses to stay down. Hurt him and he comes back faster.' },
  lens: { real: 'Freya Holm', from: 'Aarhus', text: 'A submarine periscope technician. She watches the attackers line up outside before they have even touched the wall.' },
  audit: { real: 'Sam Okoro', from: 'Enugu', text: 'A radio engineer who can hear a drone motor through two floors. Attackers learn very little while he is on the site.' },
  tonic: { real: 'Grace Mwangi', from: 'Nairobi', text: 'A field-hospital nurse who sets up shop on the objective. Defenders who hold near her station hold for longer.' },
  ward: { real: 'Pavel Novak', from: 'Plzeň', text: 'An air-defence engineer who thinks small. Every grenade thrown into his room is one that never goes off.' },
  girder: { real: 'Hank Brody', from: 'Pittsburgh', text: 'A steelworker with arms like girders. The site is twice as hard to get into once he has walked round it.' },
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
// or behind someone that just happens to line up). 4.5 px is the head as drawn.
export const HEAD_AIM = 4.5;
// The ballistic shield's pose, shared by the server (what stops bullets) and the drawing (what you see), so they always
// match (he asked). rot: how far the shield is turned from where its holder aims; arc: how far it reaches either side.
// Standing, walking (Shift) or crouching: square in front, the full arc: truly safe from the front. Jogging: it swings
// with every step and covers less, so its edges open up. Just fired: swung out of the way to shoot, the front is open.
// Knocked aside by a melee hit (or a missed bash): no cover at all (off).
export const SHIELD_ARC = 0.95;
export function shieldPose(gait, jogging, firing, knocked) {
  if (knocked) return { rot: 1.7, arc: 0.5, off: true };
  if (firing) return { rot: -1.3, arc: 0.55 };
  if (jogging) return { rot: Math.sin(gait || 0) * 0.85, arc: 0.72 }; // about a third of each stride the front is open
  return { rot: 0, arc: SHIELD_ARC };
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
export const penOf = w => w.pen || PEN[w.cls] || 0.5;
// how "hot" the gun still is: the shots of this burst, cooling to 0 over the settle time (fractions make a smaller cone)
export const aimHeat = (w, shots, idle) => shots * Math.max(0, 1 - Math.max(0, idle - 60 / w.rpm * 1.05) / settleTime(w));
// half-width of the cone (radians) for the next shot; shots = shots already fired in this burst
export function spreadCone(w, m, { at = 0, run = 0, crouch = false, shots = 0 } = {}) {
  if (shots <= 0 && w.pellets === 1) return 0;
  const f = w.pellets > 1 ? 1 : Math.min(1, shots); // partly cooled: a partly opened cone
  const hip = (w.spread * (crouch && run < 0.15 ? 0.9 : 1) + run * 0.05) * m.hip;
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
  v9:      { pull: -0.6, zig: 0.8, per: 4, flip: 0,  k: 1,   mx: 1 },    // drifts left, a little shaky
  breaker: { pull: 0.6,  zig: 0.3, per: 2, flip: 0,  k: 1,   mx: 1 },
  mule:    { pull: 1,    zig: 0.3, per: 8, flip: 0,  k: 1.1, mx: 1.3 },  // a long steady climb to the right
  longbow: { pull: -0.7, zig: 0.6, per: 2, flip: 0,  k: 1,   mx: 1 },
  hornet:  { pull: 0.3,  zig: 1.4, per: 3, flip: 0,  k: 1,   mx: 1 },    // shakes both ways
  vex50:   { pull: 1,    zig: 0.5, per: 2, flip: 0,  k: 1.6, mx: 1.4 },  // big kick right
  p10:     { pull: -0.4, zig: 0.6, per: 3, flip: 0,  k: 1,   mx: 1 },
  rook:    { pull: -1,   zig: 0.5, per: 4, flip: 0,  k: 1.2, mx: 1.5 },  // hard and to the left
  sabre:   { pull: 0.2,  zig: 1.3, per: 3, flip: 0,  k: 1,   mx: 1 },    // wanders side to side
  trident: { pull: 0.7,  zig: 0.4, per: 3, flip: 0,  k: 1,   mx: 1 },
  wasp:    { pull: -0.3, zig: 1.6, per: 3, flip: 0,  k: 1.1, mx: 1.3 },  // wild shake
  marten:  { pull: 0.5,  zig: 0.3, per: 6, flip: 0,  k: 1,   mx: 0.8 },  // gentle
  lark:    { pull: -0.7, zig: 0.5, per: 5, flip: 15, k: 1,   mx: 1 },    // left, then right late in the mag
  tusk:    { pull: 0.4,  zig: 0.9, per: 2, flip: 0,  k: 1,   mx: 1.2 },  // bucks left-right each blast
  anvil:   { pull: -1,   zig: 0.2, per: 2, flip: 0,  k: 1.3, mx: 1.4 },
  stub:    { pull: 1,    zig: 0,   per: 2, flip: 0,  k: 1.5, mx: 1.5 },
  ox:      { pull: 1,    zig: 0.2, per: 6, flip: 0,  k: 1.3, mx: 1.7 },  // heavy, steady right: hold it left
  drummer: { pull: -0.8, zig: 0.9, per: 5, flip: 12, k: 1,   mx: 1.2 },  // left, then right
  pike:    { pull: 1,    zig: 0,   per: 2, flip: 0,  k: 1.3, mx: 1.5 },
  heron:   { pull: -0.6, zig: 0.5, per: 3, flip: 0,  k: 1,   mx: 1 },
  gnat:    { pull: 0.6,  zig: 1.8, per: 2, flip: 0,  k: 1.5, mx: 1.8 },  // very hard to control
  bison:   { pull: -1,   zig: 0.3, per: 2, flip: 0,  k: 2,   mx: 1.6 },  // a big kick left every shot
  javelin: { pull: 0.5,  zig: 0.6, per: 4, flip: 0,  k: 0.9, mx: 1 },
  halberd: { pull: -0.6, zig: 0.3, per: 2, flip: 0,  k: 1.2, mx: 1.3 },
  sentry:  { pull: -0.7, zig: 0.5, per: 5, flip: 12, k: 1,   mx: 1 },    // left, then right
  sparrow: { pull: 0.5,  zig: 0.7, per: 3, flip: 0,  k: 0.9, mx: 1 },
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
