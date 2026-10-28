// Weapons and the 10 operators (5 attack, 5 defence).

export const WEAPONS = {
  k4:      { name: 'K4 Carbine',   cls: 'AR',      dmg: 31, rpm: 720, mag: 30, reserve: 150, reload: 2.4, spread: 0.06, ads: 0.014, bloom: 0.012, auto: true,  pellets: 1, range: 1100, len: 15 },
  v9:      { name: 'V9 SMG',       cls: 'SMG',     dmg: 24, rpm: 880, mag: 32, reserve: 192, reload: 2.0, spread: 0.07, ads: 0.022, bloom: 0.010, auto: true,  pellets: 1, range: 900,  len: 11 },
  breaker: { name: 'Breaker-12',   cls: 'Shotgun', dmg: 13, rpm: 78,  mag: 7,  reserve: 42,  reload: 3.1, spread: 0.16, ads: 0.11,  bloom: 0,     auto: false, pellets: 8, range: 420,  len: 14 },
  mule:    { name: 'Mule LMG',     cls: 'LMG',     dmg: 33, rpm: 640, mag: 80, reserve: 160, reload: 4.4, spread: 0.08, ads: 0.022, bloom: 0.008, auto: true,  pellets: 1, range: 1100, len: 17 },
  longbow: { name: 'Longbow DMR',  cls: 'DMR',     dmg: 58, rpm: 360, mag: 12, reserve: 60,  reload: 2.7, spread: 0.06, ads: 0.004, bloom: 0.02,  auto: false, pellets: 1, range: 1300, len: 18 },
  hornet:  { name: 'Hornet MP',    cls: 'MP',      dmg: 21, rpm: 980, mag: 25, reserve: 150, reload: 1.9, spread: 0.08, ads: 0.03,  bloom: 0.010, auto: true,  pellets: 1, range: 800,  len: 8 },
  p10:     { name: 'P10 Sidearm',  cls: 'Pistol',  dmg: 36, rpm: 420, mag: 15, reserve: 60,  reload: 1.6, spread: 0.05, ads: 0.016, bloom: 0.02,  auto: false, pellets: 1, range: 900,  len: 7 },
};

// armor: 1 = heavy/slow, 2 = medium, 3 = light/fast. HP follows armor.
export const ARMOR_HP = { 1: 125, 2: 110, 3: 100 };

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
  bulwark: { team: 'atk', name: 'BULWARK', role: 'Shield',        armor: 1, primary: 'hornet',  secondary: null,
             ability: { id: 'brace', name: 'Ballistic Shield', count: 0, desc: 'Your shield always stops bullets from the front. Hold the ability to brace it wide, moving slowly.' },
             gadget: 'stun', gadgetCount: 2, color: '#d84a4a', helmet: '#46484c', look: 'visor' },
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
};

export const OP_LIST = Object.keys(OPERATORS);
export const opsForTeam = team => OP_LIST.filter(k => OPERATORS[k].team === team);
