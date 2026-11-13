// ZOMBIES (he asked 2026-11-12, in the style of the classic round-based co-op zombie modes; everything here is our own:
// names, map, perks). Played on Lantern Point (shared/maps/lantern.js), which carries the stations in map.zombies.
//   Rounds: each round a number of zombies comes (more, tougher and quicker every round); kill them all for the next.
//   Points: 500 to start, +10 a hit, +60 a kill (+100 head, +130 knife), +10 a board put back on a window.
//   Spend them (E): gates open the town zone by zone, guns off the walls (ammo for half), the mystery crate (950, a
//   random gun; it flies off to another spot now and then), four perk machines and the Forge once the power is on.
//   Windows: zombies tear the boards off one by one and climb in; hold E by a window to put boards back.
//   Down: a teammate can pick you up; alone, SECOND WIND gets you up by yourself. Everyone down = game over.
//   The dead come back at the start of the next round.
// Zombies are players in game.players with p.zombie (so bullets, sight, drawing and the kill feed just work), on
// squad 1; the people (and any bots helping them) are squad 0. game.js calls in here wherever `this.zb` appears.
import { CELL, PHASE, T, TEAM, PX_PER_M } from '../shared/constants.js';
import { OPERATORS, WEAPONS, ARMOR_HP, gunMods, cleanAtt } from '../shared/operators.js';
import { buildMap, floorAt, localPos } from '../shared/map.js';
import { los, angDiff } from '../shared/physics.js';

export const ZB = {
  start: 500, hit: 10, kill: 60, head: 100, knife: 130, board: 10, boardsMax: 6, boardEvery: 0.9,
  regen: 3, regenRate: 60, swipe: 50, swipeCd: 1.2, reach: 22, maxAlive: 24, between: 9,
  crate: 950, forge: 5000, forgeMul: 2, ammoShare: 0.5,
};
export const PERKS = {
  tough: { name: 'IRON HIDE', cost: 2500, desc: 'Take far more hits before going down', col: '#d94a3a' },
  reload: { name: 'QUICK HANDS', cost: 3000, desc: 'Reload twice as fast', col: '#5fd08a' },
  revive: { name: 'SECOND WIND', cost: 1500, desc: 'Pick teammates up twice as fast; alone, get yourself back up', col: '#4fb3ff' },
  rapid: { name: 'DOUBLE BARREL', cost: 2000, desc: 'Shoot a third faster and a quarter harder', col: '#f2c14e' },
};
const START_GUN = 'p10';
const CRATE_GUNS = ['mule', 'ox', 'drummer', 'cyclone', 'trestle', 'pike', 'saker', 'heron', 'longbow', 'sabre', 'trident', 'verdict', 'tandem', 'ferret', 'auger', 'quill', 'hedge', 'anvil', 'mammoth', 'needle', 'vex50', 'bison', 'whisper', 'hatchet', 'gnat', 'lark', 'stub'];
const ZOMBIE_OPS = Object.keys(OPERATORS).filter(o => OPERATORS[o].armor === 2);

const r1 = v => Math.round(v * 10) / 10;
const people = game => [...game.players.values()].filter(p => !p.zombie);
const zombies = game => [...game.players.values()].filter(p => p.zombie);
const note = (game, p, text) => { if (p && p.sock) game.events.push({ e: 'pts', to: p.id, n: 0, w: text }); };
const pay = (game, p, n, why) => { p.zb.pts += n; p.zb.earned += Math.max(0, n); if (p.sock) game.events.push({ e: 'pts', to: p.id, n, w: why }); };
const gunOf = (p, w, up = false) => { const att = cleanAtt(w, null, p.op); const W = WEAPONS[w]; return { w, ammo: Math.round(W.mag * (up ? 1.5 : 1)), reserve: Math.round(W.mag * (up ? 10 : 5)), att, m: gunMods(w, att), up: up ? 1 : undefined }; };

// how many zombies a round brings, their health and speed
export function roundSize(r, n) { return Math.round((6 + 3 * (r - 1) + 0.35 * r * r) * (0.6 + 0.4 * Math.min(4, n))); }
export function zombieHp(r) { return r <= 9 ? 150 + 100 * (r - 1) : Math.round(950 * Math.pow(1.1, r - 9)); }
function zombieSpeed(r) { const x = Math.random(); if (r < 3) return 'walk'; if (r < 6) return x < 0.15 * (r - 2) ? 'run' : 'walk'; if (r < 10) return x < 0.5 ? 'run' : 'walk'; return x < 0.25 ? 'sprint' : 'run'; }

export function zbStart(game) {
  const prevMap = game.mapId;
  game.map = buildMap('lantern'); game.mapId = 'lantern'; game.mapVersion++; game.changed.clear(); game.newHoles = [];
  game.baseTiles = game.map.tiles.slice();
  game.ents = []; game.planted = null; game.winner = null; game.reason = ''; game.noises = []; game.bans = []; game.banRun = null;
  game.spots = { atk: new Map(), def: new Map() };
  game.score = [0, 0]; game.round = 1; game.matchStart = Date.now(); game.departed = []; game.roundLog = [];
  const Z = game.map.zombies, m = game.map;
  game.zb = { round: 0, open: new Set([0]), gates: Z.gates.map(g => ({ ...g, open: false })), power: false, crate: { at: Math.floor(Math.random() * 2) === 0 ? 0 : 1, uses: 0, busy: null, moving: 0 },
    prevMap, left: 0, spawnT: 0, betweenT: 3, field: null, fieldT: 0, boards: {}, over: false, kills: 0 };
  for (const g of game.zb.gates) for (const k of g.cells) { m.tiles[k] = T.BEAM; m.hp[k] = 99999; game.changed.add(k); }
  // every window starts with all its boards
  for (const o of m.openings) if (o.cells.some(k => m.win[k]) && m.flAt[o.cells[0]] === m.groundFloor) { game.zb.boards[o.id] = ZB.boardsMax; for (const k of o.cells) { m.tiles[k] = T.BARRI; m.hp[k] = 100; game.changed.add(k); } }
  const ps = people(game);
  ps.forEach((p, i) => {
    p.lobbySq = p.squad; p.squad = 0; p.kills = 0; p.deaths = 0; p.ms = game.blankMatchStats(); p.locked = true;
    p.zb = { pts: ZB.start, earned: 0, kills: 0, heads: 0, downs: 0, revives: 0, perks: [], selfUps: 0 };
    zbSpawnPerson(game, p, i);
  });
  game.phase = PHASE.ACTION; game.timer = 0;
  game.events.push({ e: 'newmap', v: game.mapVersion });
  game.events.push({ e: 'banner', text: 'LANTERN POINT', sub: 'Hold out. Board the windows, earn points, open the town' });
}

function zbSpawnPerson(game, p, i = 0) {
  const S = game.map.zombies.start, s = S[i % S.length];
  if (!p.zb.op) { const all = Object.keys(OPERATORS); p.zb.op = all[Math.floor(Math.random() * all.length)]; }
  p.op = p.zb.op; p.job = null;
  game.equip(p);
  p.abilityCount = 0; p.gadgetCount = 0; p.gadget = null; p.drones = 0; p.barri = 0; p.battery = 0; p.riot = null; p.hasDefuser = false;
  p.guns = [gunOf(p, START_GUN)]; p.slot = 0; p.reloadT = 0; p.fireCd = 0.3;
  p.maxHp = p.zb.perks.includes('tough') ? 250 : 100; p.hp = p.maxHp; p.lastHurt = 0;
  const pos = game.freeSpotNear(s.x, s.y, 16); p.x = pos.x; p.y = pos.y; p.vx = p.vy = 0; p.aim = -Math.PI / 2;
}

// ---------------- the flow field: every zombie walks downhill toward the nearest standing person ----------------
const WALK_Z = new Set([T.FLOOR, T.GROUND, T.STAIR, T.OPEN, T.BARRI, T.HATCH, T.HATCHR, T.RUBBLE]);
function field(game) {
  const Zs = game.zb, m = game.map, N = m.W * m.H, W = m.W;
  if (!Zs.rev) { Zs.rev = new Map(); for (let k = 0; k < N; k++) { const b = m.portal[k]; if (b >= 0) { if (!Zs.rev.has(b)) Zs.rev.set(b, []); Zs.rev.get(b).push(k); } } }
  const d = Zs.dist && Zs.dist.length === N ? Zs.dist.fill(1e9) : (Zs.dist = new Float32Array(N).fill(1e9));
  const q = Zs.q || (Zs.q = new Int32Array(N * 2)); let h = 0, t = 0;
  for (const p of people(game)) if (p.alive && !p.downed) { const k = Math.floor(p.y / CELL) * W + Math.floor(p.x / CELL); if (k >= 0 && k < N) { d[k] = 0; q[t++] = k; } }
  const cost = k => m.tiles[k] === T.BARRI ? 6 : m.win[k] ? 3 : 1;
  // a bucketed breadth-first search (costs 1, 3 or 6): re-queue cells that improve; good enough and quick
  while (h < t && t < q.length - 16) {
    const k = q[h++], dk = d[k], x = k % W;
    const nb = [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, k - W, k + W];
    for (const n of nb) { if (n < 0 || n >= N || !WALK_Z.has(m.tiles[n])) continue; const nd = dk + cost(n); if (nd < d[n]) { d[n] = nd; q[t++] = n; } }
    const back = Zs.rev.get(k); if (back) for (const n of back) { const nd = dk + 1; if (nd < d[n]) { d[n] = nd; q[t++] = n; } }
  }
  Zs.fieldT = game.time;
}

// ---------------- every tick ----------------
export function zbTick(game, dt) {
  const Zs = game.zb; if (!Zs || game.phase !== PHASE.ACTION || Zs.over) return;
  if (game.time - Zs.fieldT > 0.4) field(game);
  const ps = people(game), zs = zombies(game);
  // health comes back after a few quiet seconds
  for (const p of ps) if (p.alive && !p.downed && p.hp < p.maxHp && game.time - (p.lastHurt || 0) > ZB.regen) p.hp = Math.min(p.maxHp, p.hp + ZB.regenRate * dt);
  // SECOND WIND alone: back up by yourself
  for (const p of ps) if (p.alive && p.downed && p.zb.perks.includes('revive') && !ps.some(q => q !== p && q.alive && !q.downed) && game.time - (p.downT || 0) > 4) {
    p.downed = false; p.hp = p.maxHp * 0.6; p.zb.perks = p.zb.perks.filter(k => k !== 'revive'); p.zb.selfUps++; game.events.push({ e: 'banner', text: 'SECOND WIND', sub: `${p.name} is back up`, to: p.id });
  }
  // the mystery crate's roll
  const C = Zs.crate;
  if (C.busy && game.time >= C.busy.t) { const p = game.players.get(C.busy.by); C.busy = null; if (p && p.alive) giveGun(game, p, C.gun); }
  if (C.moving && game.time >= C.moving) { C.moving = 0; const n = game.map.zombies.crates.length; let i = C.at; while (n > 1 && i === C.at) i = Math.floor(Math.random() * n); C.at = i; game.msg('The mystery crate has turned up somewhere else in town'); }
  // everyone down: it's over
  if (ps.length && !ps.some(p => p.alive && !p.downed)) return zbOver(game);
  // between rounds
  if (Zs.betweenT > 0) {
    Zs.betweenT -= dt;
    if (Zs.betweenT <= 0) nextRound(game);
    return;
  }
  // spawning
  Zs.spawnT -= dt;
  if (Zs.left > 0 && Zs.spawnT <= 0 && zs.length < ZB.maxAlive) { if (spawnZombie(game)) Zs.left--; Zs.spawnT = Math.max(0.6, 2.2 - Zs.round * 0.12); }
  if (Zs.left <= 0 && zs.every(z => !z.alive)) { for (const z of zs) game.players.delete(z.id); Zs.betweenT = ZB.between; game.events.push({ e: 'banner', text: `ROUND ${Zs.round} SURVIVED`, sub: 'The next wave is coming' }); game.events.push({ e: 'snd', s: 'zbRoundEnd', x: 0, y: 0 }); }
  // the dead zombies' bodies go after a moment
  for (const z of zs) if (!z.alive && game.time - (z.deadT || 0) > 1.5) game.players.delete(z.id);
}

function nextRound(game) {
  const Zs = game.zb; Zs.round++; game.round = Zs.round;
  const ps = people(game);
  Zs.left = roundSize(Zs.round, ps.length); Zs.spawnT = 1.5;
  for (const [i, p] of ps.entries()) if (!p.alive) { zbSpawnPerson(game, p, i); game.msg(`${p.name} is back`); }
  for (const p of ps) if (p.alive && p.downed) { p.downed = false; p.hp = p.maxHp * 0.5; }
  game.events.push({ e: 'zbRound', r: Zs.round });
}

function spawnZombie(game) {
  const Zs = game.zb, m = game.map, ps = people(game).filter(p => p.alive);
  const list = m.zombies.spawns.filter(s => s.wake.some(z => Zs.open.has(z)));
  if (!list.length || !ps.length) return false;
  // close-ish to someone, but not in their sight
  let best = null, bs = -Infinity;
  for (const s of list) {
    let near = Infinity, seen = false;
    for (const p of ps) { const a = localPos(m, s.x, s.y), b = localPos(m, p.x, p.y); const dd = Math.hypot(a.x - b.x, a.y - b.y) + Math.abs(a.f - b.f) * 300; near = Math.min(near, dd); if (floorAt(m, s.x, s.y) === floorAt(m, p.x, p.y) && dd < 500 && los(m, s.x, s.y, p.x, p.y)) seen = true; }
    const sc = -Math.abs(near - 18 * PX_PER_M) - (seen ? 2000 : 0) + Math.random() * 300;
    if (sc > bs) { bs = sc; best = s; }
  }
  const z = game.blankPlayer('Zombie', true, 1);
  z.zombie = true; z.op = ZOMBIE_OPS[Math.floor(Math.random() * ZOMBIE_OPS.length)];
  game.players.set(z.id, z);
  game.equip(z);
  z.guns = [{ w: START_GUN, ammo: 0, reserve: 0, att: cleanAtt(START_GUN, null, z.op), m: gunMods(START_GUN, cleanAtt(START_GUN, null, z.op)) }];
  z.abilityCount = 0; z.gadgetCount = 0; z.gadget = null; z.drones = 0; z.barri = 0;
  z.maxHp = z.hp = zombieHp(Zs.round); z.zspeed = zombieSpeed(Zs.round); z.zlook = Math.floor(Math.random() * 6);
  const pos = game.freeSpotNear(best.x, best.y, 30); z.x = pos.x; z.y = pos.y; z.vx = z.vy = 0; z.aim = Math.random() * 6.28;
  z.ai = { swipeT: 0 };
  return true;
}

// ---------------- a zombie's brain ----------------
export function zombieThink(game, z, dt) {
  const inp = { up: 0, down: 0, left: 0, right: 0, walk: z.zspeed === 'walk' ? 1 : 0, crouch: 0, fire: 0, ads: 0, interact: 0, ability: 0, sprint: 0 };
  z.input = inp;
  if (!z.alive || z.vault) return;
  const m = game.map, W = m.W, Zs = game.zb, ai = z.ai, k = Math.floor(z.y / CELL) * W + Math.floor(z.x / CELL), d = Zs.dist;
  ai.swipeT -= dt;
  // someone right there: swipe
  let tgt = null, td = Infinity;
  for (const p of game.players.values()) if (!p.zombie && p.alive && !p.downed) { const dd = Math.hypot(p.x - z.x, p.y - z.y); if (dd < td && floorAt(m, p.x, p.y) === floorAt(m, z.x, z.y)) { td = dd; tgt = p; } }
  if (tgt && td < 3 * CELL && los(m, z.x, z.y, tgt.x, tgt.y)) {
    z.aim = Math.atan2(tgt.y - z.y, tgt.x - z.x);
    if (td < ZB.reach) {
      if (ai.swipeT <= 0) { ai.swipeT = ZB.swipeCd; game.events.push({ e: 'melee', id: z.id }); game.damage(tgt, ZB.swipe, z, 'Zombie', z.aim); }
      return;
    }
    go(inp, z.aim, z); return;
  }
  if (!d || d[k] >= 1e9) { ai.wT = (ai.wT || 0) - dt; if (ai.wT <= 0) { ai.wT = 2; ai.wa = Math.random() * 6.28; } go(inp, ai.wa, z); inp.walk = 1; return; }
  // the window in front: tear a board off, or climb through
  let best = -1, bd = d[k];
  const x = k % W;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const n = k + dy * W + dx; if (x + dx < 0 || x + dx >= W || n < 0 || n >= d.length) continue;
    if (dx && dy && (!WALK_Z.has(m.tiles[k + dx]) || !WALK_Z.has(m.tiles[k + dy * W]))) continue;
    if (d[n] < bd) { bd = d[n]; best = n; }
  }
  if (best < 0) return;
  const oi = m.openId[best];
  const bx = (best % W + 0.5) * CELL, by = (Math.floor(best / W) + 0.5) * CELL, a = Math.atan2(by - z.y, bx - z.x);
  if (m.win[best] && oi >= 0) {
    z.aim = a;
    if ((Zs.boards[oi] || 0) > 0) { // tearing
      ai.tearT = (ai.tearT ?? 1.1) - dt;
      if (ai.tearT <= 0) { ai.tearT = Math.max(0.5, 1.3 - Zs.round * 0.04); setBoards(game, oi, Zs.boards[oi] - 1); game.events.push({ e: 'hit', k: 'wood', x: r1(bx), y: r1(by) }); game.events.push({ e: 'snd', s: 'board', x: r1(bx), y: r1(by) }); }
      return;
    }
    if (Math.hypot(bx - z.x, by - z.y) < 1.4 * CELL) { game.startVault(z, a); return; }
  }
  go(inp, a, z);
}
function go(inp, a, z) {
  z.aim = z.aim + angDiff(a, z.aim) * 0.35;
  const c = Math.cos(a), s = Math.sin(a);
  if (c > 0.38) inp.right = 1; else if (c < -0.38) inp.left = 1;
  if (s > 0.38) inp.down = 1; else if (s < -0.38) inp.up = 1;
  if (z.zspeed === 'sprint') { inp.sprint = 1; inp.sa = z.aim; }
}
export function zbSpeed(game, p) { return p.zombie ? (p.zspeed === 'sprint' ? 1.0 : p.zspeed === 'run' ? 0.95 : 0.85) : 1; }

// boards on a window: the tiles follow (no boards = an open window you climb through)
function setBoards(game, oi, n) {
  const m = game.map, o = m.openings[oi]; n = Math.max(0, Math.min(ZB.boardsMax, n));
  game.zb.boards[oi] = n;
  for (const k of o.cells) { m.tiles[k] = n > 0 ? T.BARRI : T.OPEN; m.hp[k] = n > 0 ? Math.round(100 * n / ZB.boardsMax) : 0; if (m.holes[k]) delete m.holes[k]; game.changed.add(k); }
}

// ---------------- E: buy, repair ----------------
// returns true when the key did something here (so the normal hold-E jobs, like picking someone up, don't also run)
export function zbUse(game, p, dt, inp) {
  const Zs = game.zb; if (!Zs || p.zombie || !p.alive || p.downed) return false;
  const pressed = inp.interact && !(p.prevInput && p.prevInput.interact);
  const st = zbStation(game, p);
  if (!st) { p.zbRep = 0; return false; }
  if (st.k === 'window') {
    if (!inp.interact) { p.zbRep = 0; return true; }
    p.zbRep = (p.zbRep || 0) + dt;
    if (p.zbRep >= ZB.boardEvery) { p.zbRep = 0; setBoards(game, st.oi, Zs.boards[st.oi] + 1); pay(game, p, ZB.board, 'BOARD'); game.events.push({ e: 'snd', s: 'barricade', x: r1(p.x), y: r1(p.y) }); }
    return true;
  }
  if (!pressed) return true;
  const broke = () => { note(game, p, 'NOT ENOUGH POINTS'); game.events.push({ e: 'snd', s: 'deny', x: r1(p.x), y: r1(p.y), id: p.id }); };
  if (st.k === 'gate') {
    if (p.zb.pts < st.g.cost) return broke(), true;
    pay(game, p, -st.g.cost, st.g.name.toUpperCase());
    st.g.open = true; Zs.open.add(st.g.opens);
    for (const k of st.g.cells) { game.map.tiles[k] = T.OPEN; game.map.hp[k] = 0; game.changed.add(k); }
    game.events.push({ e: 'snd', s: 'gate', x: r1(st.g.x), y: r1(st.g.y) });
    game.msg(`${p.name} opened the ${st.g.name}`);
    return true;
  }
  if (st.k === 'gun') {
    const W = st.s.w, has = p.guns.findIndex(g => g.w === W);
    if (has >= 0) { const cost = Math.round(st.s.cost * ZB.ammoShare); if (p.zb.pts < cost) return broke(), true; pay(game, p, -cost, 'AMMO'); const g = p.guns[has], f = gunOf(p, W, g.up); g.ammo = f.ammo; g.reserve = f.reserve; return true; }
    if (p.zb.pts < st.s.cost) return broke(), true;
    pay(game, p, -st.s.cost, WEAPONS[W].name.toUpperCase()); giveGun(game, p, W); return true;
  }
  if (st.k === 'crate') {
    if (Zs.crate.busy || Zs.crate.moving) return true;
    if (p.zb.pts < ZB.crate) return broke(), true;
    pay(game, p, -ZB.crate, 'MYSTERY CRATE');
    Zs.crate.uses++;
    const own = new Set(p.guns.map(g => g.w)), pool = CRATE_GUNS.filter(w => WEAPONS[w] && !own.has(w));
    if (Zs.crate.uses > 3 && Math.random() < 0.18) { // it flies off: points back, somewhere else in a little while
      pay(game, p, ZB.crate, 'THE CRATE FLEW OFF'); Zs.crate.uses = 0; Zs.crate.moving = game.time + 12;
      game.events.push({ e: 'snd', s: 'crateGone', x: r1(st.s.x), y: r1(st.s.y) }); game.events.push({ e: 'banner', text: 'THE CRATE FLEW OFF', sub: 'It will turn up somewhere else' });
      return true;
    }
    Zs.crate.gun = pool[Math.floor(Math.random() * pool.length)];
    Zs.crate.busy = { by: p.id, t: game.time + 2.6 };
    game.events.push({ e: 'zbCrate', x: r1(st.s.x), y: r1(st.s.y), w: Zs.crate.gun, t: 2.6 });
    return true;
  }
  if (st.k === 'perk') {
    const P = PERKS[st.s.id];
    if (!Zs.power) { note(game, p, 'NEEDS THE POWER ON'); return true; }
    if (p.zb.perks.includes(st.s.id)) { note(game, p, 'YOU HAVE IT'); return true; }
    if (p.zb.perks.length >= 4) return true;
    if (p.zb.pts < P.cost) return broke(), true;
    pay(game, p, -P.cost, P.name); p.zb.perks.push(st.s.id);
    if (st.s.id === 'tough') { p.maxHp = 250; p.hp = 250; }
    game.events.push({ e: 'snd', s: 'perk', x: r1(p.x), y: r1(p.y), id: p.id });
    return true;
  }
  if (st.k === 'power') {
    if (Zs.power) return true;
    Zs.power = true; game.events.push({ e: 'banner', text: 'POWER ON', sub: 'The perk machines and the Forge work now' }); game.events.push({ e: 'snd', s: 'powerOn', x: r1(p.x), y: r1(p.y) });
    game.msg(`${p.name} turned the power on`);
    return true;
  }
  if (st.k === 'forge') {
    if (!Zs.power) { note(game, p, 'NEEDS THE POWER ON'); return true; }
    const g = p.guns[p.slot]; if (!g || g.up) { note(game, p, g ? 'ALREADY FORGED' : ''); return true; }
    if (p.zb.pts < ZB.forge) return broke(), true;
    pay(game, p, -ZB.forge, 'FORGED'); const f = gunOf(p, g.w, true); Object.assign(g, { up: 1, ammo: f.ammo, reserve: f.reserve });
    game.events.push({ e: 'snd', s: 'forge', x: r1(p.x), y: r1(p.y), id: p.id });
    return true;
  }
  return false;
}
function giveGun(game, p, w) {
  const g = gunOf(p, w);
  if (p.guns.length < 2) { p.guns.push(g); p.slot = p.guns.length - 1; }
  else p.guns[p.slot] = g;
  p.reloadT = 0; p.fireCd = 0.4;
  note(game, p, WEAPONS[w].name.toUpperCase());
  game.events.push({ e: 'snd', s: 'swap', x: r1(p.x), y: r1(p.y), id: p.id });
}

// what is within reach for E (the client works out the same thing for the prompt: zbNear in main.js)
export function zbStation(game, p) {
  const Zs = game.zb, Z = game.map.zombies, m = game.map, near = (s, r) => s && Math.hypot(s.x - p.x, s.y - p.y) < r && floorAt(m, s.x, s.y) === floorAt(m, p.x, p.y);
  for (const g of Zs.gates) if (!g.open && near(g, 40)) return { k: 'gate', g };
  for (const s of Z.guns) if (near(s, 26)) return { k: 'gun', s };
  for (const s of Z.perks) if (near(s, 26)) return { k: 'perk', s };
  const cr = Z.crates[Zs.crate.at]; if (!Zs.crate.moving && near(cr, 28)) return { k: 'crate', s: cr };
  if (near(Z.power, 26)) return { k: 'power', s: Z.power };
  if (near(Z.forge, 26)) return { k: 'forge', s: Z.forge };
  // a window with boards missing
  const W = m.W, cx = Math.floor(p.x / CELL), cy = Math.floor(p.y / CELL);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const k = (cy + dy) * W + cx + dx, oi = m.openId[k];
    if (oi >= 0 && m.win[k] && Zs.boards[oi] !== undefined && Zs.boards[oi] < ZB.boardsMax) return { k: 'window', oi };
  }
  return null;
}

// ---------------- hits and kills ----------------
export function zbDamage(game, q, amount, src, wname) {
  if (q.zombie && src && src.zombie) return 0;
  if (!q.zombie && src && !src.zombie && src !== q) return 0; // people never hurt each other here
  if (!q.zombie) { q.lastHurt = game.time; return amount; }
  // a person hitting a zombie
  if (src && src.zb) {
    const g = src.guns[src.slot];
    if (wname === 'Melee') amount = Math.max(amount, 150);
    else { if (g && g.up) amount *= ZB.forgeMul; if (src.zb.perks.includes('rapid')) amount *= 1.25; }
    pay(game, src, ZB.hit, '');
  }
  return amount;
}
export function zbKill(game, q, src, wname) {
  if (q.zombie) {
    q.deadT = game.time; game.zb.kills++;
    if (src && src.zb) { src.zb.kills++; const head = game.headshot, knife = wname === 'Melee'; if (head) src.zb.heads++; pay(game, src, knife ? ZB.knife : head ? ZB.head : ZB.kill, knife ? 'KNIFE KILL' : head ? 'HEADSHOT' : 'KILL'); }
    return;
  }
  if (q.zb) q.zb.downs++;
}
// people going down: always (the death screen only when nobody can help), solo with SECOND WIND too
export function zbCanGoDown(game, q) { return !q.zombie && (people(game).some(p => p !== q && p.alive && !p.downed) || q.zb.perks.includes('revive')); }
export function zbReloadMul(game, p) { return p.zb && p.zb.perks.includes('reload') ? 0.5 : 1; }
export function zbFireMul(game, p) { return p.zb && p.zb.perks.includes('rapid') ? 0.75 : 1; }
export function zbBlocksVault(game, p, to) {
  if (p.zombie) return false;
  const m = game.map, n = Math.ceil(Math.hypot(to.x - p.x, to.y - p.y) / 4);
  for (let i = 0; i <= n; i++) { const x = p.x + (to.x - p.x) * i / n, y = p.y + (to.y - p.y) * i / n, k = Math.floor(y / CELL) * m.W + Math.floor(x / CELL); if (m.win[k]) return true; }
  return false;
}

function zbOver(game) {
  const Zs = game.zb; Zs.over = true;
  game.phase = PHASE.MATCH_END; game.timer = 14;
  const best = people(game).sort((a, b) => b.zb.kills - a.zb.kills)[0];
  game.events.push({ e: 'banner', text: 'GAME OVER', sub: `You survived ${Math.max(0, Zs.round - (Zs.betweenT > 0 ? 0 : 1))} round${Zs.round === 2 ? '' : 's'}` });
  game.events.push({ e: 'matchEnd', squad: -1, zb: { r: Zs.round, kills: Zs.kills }, mvp: best ? { id: best.id, name: best.name, op: best.op, ...(best.ms || {}), kills: best.zb.kills, ops: undefined } : null });
}
export function zbEnd(game) {
  for (const z of zombies(game)) game.players.delete(z.id);
  for (const p of game.players.values()) { if (p.lobbySq !== undefined) p.squad = p.lobbySq; p.lobbySq = undefined; p.zb = null; }
  if (game.zb.prevMap && game.zb.prevMap !== 'lantern') { game.mapId = game.zb.prevMap; game.map = buildMap(game.mapId); game.mapVersion++; game.events.push({ e: 'newmap', v: game.mapVersion }); } // the lobby's map again
  game.zb = null;
}

// what the snapshot carries
export function zbPlayer(game, p) { return p.zombie ? [1, p.zspeed === 'sprint' ? 2 : p.zspeed === 'run' ? 1 : 0, p.zlook || 0] : p.zb ? [0, Math.round(p.zb.pts), p.zb.kills, p.zb.perks.join(','), p.zb.heads, p.zb.revives, p.guns.map(g => g.w + (g.up ? '*' : '')).join(',')] : undefined; }
export function zbInfo(game) {
  const Zs = game.zb; if (!Zs) return undefined;
  return { r: Zs.round, left: Zs.left + zombies(game).filter(z => z.alive).length, pw: Zs.power ? 1 : 0, g: Zs.gates.map(g => g.open ? 1 : 0), c: Zs.crate.moving ? -1 : Zs.crate.at, cb: Zs.crate.busy ? 1 : 0, b: Zs.betweenT > 0 ? r1(Zs.betweenT) : 0, wb: Zs.boards };
}
