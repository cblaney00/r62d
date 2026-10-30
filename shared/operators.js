// Weapons and the 30 operators (15 attack, 15 defence).

export const WEAPONS = {
  k4:      { name: 'K4 Carbine',   cls: 'AR',      dmg: 31, rpm: 720, mag: 30, reserve: 150, reload: 2.4, spread: 0.06, ads: 0.014, bloom: 0.012, auto: true,  pellets: 1, range: 1100, len: 15 },
  v9:      { name: 'V9 SMG',       cls: 'SMG',     dmg: 24, rpm: 880, mag: 32, reserve: 192, reload: 2.0, spread: 0.07, ads: 0.022, bloom: 0.010, auto: true,  pellets: 1, range: 900,  len: 11 },
  breaker: { name: 'Breaker-12',   cls: 'Shotgun', dmg: 15, rpm: 78,  mag: 7,  reserve: 42,  reload: 3.1, spread: 0.16, ads: 0.11,  bloom: 0,     auto: false, pellets: 8, range: 420,  len: 14 },
  mule:    { name: 'Mule LMG',     cls: 'LMG',     dmg: 29, rpm: 640, mag: 80, reserve: 160, reload: 4.4, spread: 0.09, ads: 0.024, bloom: 0.008, auto: true,  pellets: 1, range: 1100, len: 17 },
  longbow: { name: 'Longbow DMR',  cls: 'DMR',     dmg: 58, rpm: 360, mag: 12, reserve: 60,  reload: 2.7, spread: 0.06, ads: 0.004, bloom: 0.02,  auto: false, pellets: 1, range: 1300, len: 18 },
  hornet:  { name: 'Hornet MP',    cls: 'MP',      dmg: 20, rpm: 920, mag: 25, reserve: 150, reload: 1.9, spread: 0.08, ads: 0.03,  bloom: 0.010, auto: true,  pellets: 1, range: 800,  len: 8 },
  vex50:   { name: 'Vex .50',      cls: 'Pistol',  dmg: 50, rpm: 210, mag: 7,  reserve: 35,  reload: 2.0, spread: 0.06, ads: 0.012, bloom: 0.04,  auto: false, pellets: 1, range: 900,  len: 8 },
  p10:     { name: 'P10 Sidearm',  cls: 'Pistol',  dmg: 34, rpm: 420, mag: 15, reserve: 60,  reload: 1.6, spread: 0.05, ads: 0.016, bloom: 0.02,  auto: false, pellets: 1, range: 900,  len: 7 },
};

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
};

export const OP_LIST = Object.keys(OPERATORS);
export const opsForTeam = team => OP_LIST.filter(k => OPERATORS[k].team === team);

// ---- loadouts: each operator's weapon and gadget choices ----
export const GADGET_COUNT = { smoke: 2, frag: 2, claymore: 1, breach: 2, stun: 2, dshield: 1, nitro: 1, wire: 2, impact: 2 };
export const LOADOUTS = {
  ember:   { primaries: ['k4', 'breaker'],     secondaries: ['p10', 'vex50'], gadgets: ['smoke', 'breach'] },
  kestrel: { primaries: ['longbow', 'k4'],     secondaries: ['p10', 'vex50'], gadgets: ['frag', 'claymore'] },
  hammer:  { primaries: ['breaker', 'v9'],     secondaries: ['p10', 'vex50'], gadgets: ['claymore', 'frag'] },
  talon:   { primaries: ['v9', 'k4'],          secondaries: ['p10', 'vex50'], gadgets: ['breach', 'stun'] },
  bulwark: { primaries: ['p10', 'vex50'],      secondaries: [],               gadgets: ['stun', 'smoke'] }, // one hand on the shield: pistols only
  mason:   { primaries: ['mule', 'breaker'],   secondaries: ['p10', 'vex50'], gadgets: ['dshield', 'wire'] },
  veil:    { primaries: ['v9', 'breaker'],     secondaries: ['p10', 'vex50'], gadgets: ['nitro', 'impact'] },
  lynx:    { primaries: ['v9', 'hornet'],      secondaries: ['p10', 'vex50'], gadgets: ['wire', 'impact'] },
  solace:  { primaries: ['breaker', 'v9'],     secondaries: ['p10', 'vex50'], gadgets: ['wire', 'dshield'] },
  wraith:  { primaries: ['longbow', 'v9'],     secondaries: ['p10', 'vex50'], gadgets: ['impact', 'nitro'] },
  rivet:   { primaries: ['k4','v9'], secondaries: ['p10','vex50'], gadgets: ['stun','smoke'] },
  haze:    { primaries: ['k4','hornet'], secondaries: ['p10','vex50'], gadgets: ['breach','frag'] },
  glint:   { primaries: ['v9','longbow'], secondaries: ['p10','vex50'], gadgets: ['frag','claymore'] },
  brisk:   { primaries: ['hornet','breaker'], secondaries: ['vex50','p10'], gadgets: ['stun','smoke'] },
  onyx:    { primaries: ['mule','k4'], secondaries: ['p10','vex50'], gadgets: ['smoke','breach'] },
  prism:   { primaries: ['v9','k4'], secondaries: ['p10','vex50'], gadgets: ['smoke','stun'] },
  volt:    { primaries: ['k4','v9'], secondaries: ['p10','vex50'], gadgets: ['breach','claymore'] },
  tether:  { primaries: ['longbow','k4'], secondaries: ['p10','vex50'], gadgets: ['claymore','smoke'] },
  strider: { primaries: ['v9','breaker'], secondaries: ['vex50','p10'], gadgets: ['frag','stun'] },
  ferro:   { primaries: ['breaker','mule'], secondaries: ['p10','vex50'], gadgets: ['stun','claymore'] },
  bramble: { primaries: ['v9','breaker'], secondaries: ['p10','vex50'], gadgets: ['wire','impact'] },
  kite:    { primaries: ['hornet','v9'], secondaries: ['p10','vex50'], gadgets: ['dshield','nitro'] },
  gravel:  { primaries: ['v9','hornet'], secondaries: ['vex50','p10'], gadgets: ['impact','wire'] },
  shunt:   { primaries: ['mule','breaker'], secondaries: ['p10','vex50'], gadgets: ['wire','dshield'] },
  hush:    { primaries: ['v9','longbow'], secondaries: ['p10','vex50'], gadgets: ['impact','nitro'] },
  shade:   { primaries: ['breaker','v9'], secondaries: ['p10','vex50'], gadgets: ['nitro','wire'] },
  rampart: { primaries: ['breaker','mule'], secondaries: ['p10','vex50'], gadgets: ['dshield','wire'] },
  miasma:  { primaries: ['v9','breaker'], secondaries: ['p10','vex50'], gadgets: ['wire','impact'] },
  snare:   { primaries: ['breaker','v9'], secondaries: ['vex50','p10'], gadgets: ['impact','nitro'] },
  argus:   { primaries: ['hornet','v9'], secondaries: ['p10','vex50'], gadgets: ['nitro','impact'] },
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
  const cls = WEAPONS[w] ? WEAPONS[w].cls : 'AR';
  return {
    barrel: cls === 'Shotgun' ? ['none', 'suppressor', 'extended'] : ['none', 'suppressor', 'compensator', 'brake', 'extended'],
    grip: cls === 'Pistol' ? ['none', 'laser'] : ['none', 'vertical', 'angled', 'laser'],
    sight: cls === 'Pistol' ? ['iron', 'reddot'] : ['iron', 'reddot', 'holo', 'scope'],
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

// ---- the aiming model: one set of rules for the server, the crosshair and the Armory ----
// The first shot after the gun has settled (no shot for settleTime) goes exactly where the crosshair is: no spread, no
// recoil, standing, running, aimed or from the hip. Follow-up shots of a burst land somewhere inside a fixed cone that
// they never leave (narrow when aimed, wider from the hip and while running, a little wider with every shot of the
// burst), and the crosshair is pushed along each gun's own fixed recoil pattern, which you learn and pull against.
// Shotgun pellets fly in a fixed fan round the aim point.
// He asked for a reset time, so one-taps can't be spammed: accuracy comes back gradually after each shot and is only
// perfect again after the gun's settle time (counted from when the next shot could first be fired).
const SETTLE = { Pistol: 0.45, DMR: 0.55, AR: 0.4, SMG: 0.32, MP: 0.32, LMG: 0.45, Shotgun: 0.45 };
export const settleTime = w => SETTLE[w.cls] || 0.4;
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
  if (w.pellets > 1) return w.pellets === 1 ? 0 : cone * ((i / (w.pellets - 1)) * 2 - 1) * (i % 2 ? 0.75 : 1) + (rnd() - 0.5) * cone * 0.1;
  return cone ? (rnd() + rnd() - 1) * cone : 0;
}
// the recoil added after shot number n of a burst (1 = the first): each gun has its own fixed pattern
export function recoilStep(w, m, n) {
  const rc = RECOIL[w.cls] || RECOIL.AR;
  let seed = 0; for (const c of w.name) seed = (seed * 31 + c.charCodeAt(0)) % 997;
  const dir = (Math.floor((n - 1) / 6) % 2 ? -1 : 1) * (seed % 2 ? 1 : -1);
  return dir * rc.kick * m.kick * (n <= 3 ? m.first : 1) + Math.sin(n * 1.7 + seed) * rc.sway * m.sway * 0.5;
}
export const recoilMax = w => (RECOIL[w.cls] || RECOIL.AR).max;
