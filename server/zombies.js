// ZOMBIES (he asked 2026-11-12: play exactly like the first Black Ops' round-based zombies; the map, names, art and
// sounds are all our own). Played on Lantern Point (shared/maps/lantern.js), which carries its stations in map.zombies.
// The numbers follow that game's rules (he asked for identical difficulty scaling):
//   Zombies a round: 24 + 6 a person over the first (half of 6 alone), times round/5 (at least 1, and from round 10
//     times another round × 0.15); rounds 1-5 bring 25 / 30 / 50 / 70 / 90 % of that. At most 24 alive at once.
//   Health: 150 in round 1, +100 a round up to round 9, then +10 % a round.
//   Speed: each zombie draws a number from round × 8 to round × 8 + 35: up to 35 walks, up to 70 runs, above sprints.
//   Spawning: 2 s between zombies in round 1, 5 % quicker every round after.
//   Between rounds 10 s. A swipe does 50; people have 100 health (250 with IRON HIDE) and heal after 3 quiet seconds.
//   Points: 500 to start; 10 for a hit that doesn't kill; a kill 60 (torso), 70 (neck), 100 (head), 130 (knife);
//   10 a board put back (up to 500 a round each). Double points doubles everything.
//   Power-ups drop from kills (2 % each, and each time the team's points pass a mark that grows 14 % each time; at most 4
//   a round): MAX AMMO, INSTA-KILL (30 s), DOUBLE POINTS (30 s), NUKE (+400 each), CARPENTER (+200 each), FIRE SALE
//   (30 s: crate at every spot for 10 points). They last 26.5 s on the ground, blinking at the end.
//   Down: last stand with a pistol, 30 s to be picked up; going down loses every perk. Alone, SECOND WIND (500 alone,
//   three times) gets you up; without it it's over. The dead come back next round with the pistol and their points.
//   Spend (E): gates open the town zone by zone, wall guns (ammo for half, 4500 for a forged gun), the mystery crate
//   (950: spins, then the gun waits for you; it flies off to another spot now and then), six perk machines (power on;
//   SECOND WIND works without power alone) and the Forge (5000: the gun goes in, comes out stronger, you take it).
//   Grenades: 2 to start, +2 every round, at most 4.
// Zombies are players in game.players with p.zombie (bullets, sight, drawing and so on just work), on squad 1; the
// people (and bots helping them) are squad 0. game.js calls in here wherever `this.zb` appears.
import { CELL, PHASE, T, TEAM, PX_PER_M } from '../shared/constants.js';
import { OPERATORS, WEAPONS, gunMods, cleanAtt, SIDEARMS } from '../shared/operators.js';
import { buildMap, floorAt, localPos } from '../shared/map.js';
import { los, angDiff } from '../shared/physics.js';

export const ZB = {
  start: 500, hit: 10, kill: 60, neck: 70, head: 100, knife: 130, knifeDmg: 150, board: 10, boardCap: 500, boardsMax: 6, boardEvery: 0.9,
  hp: 100, toughHp: 250, regen: 3, regenRate: 70, swipe: 50, swipeCd: 1.0, reach: 22, maxAlive: 24, between: 10, bleed: 30,
  spawnDelay: 2, spawnShrink: 0.95, spawnMin: 0.08, headMul: 2,
  crate: 950, fireCrate: 10, spin: 4, takeWait: 12, forge: 5000, forgeTime: 3.5, forgeMul: 2, forgeAmmo: 4500, ammoShare: 0.5,
  dropChance: 0.02, dropMark: 2000, dropGrow: 1.14, dropsARound: 4, dropLife: 26.5, powerTime: 30, nuke: 400, carpenter: 200,
  nadesStart: 2, nadesMax: 4,
};
export const PERKS = { // the six machines (our own names); prices and effects as in that game
  tough: { name: 'IRON HIDE', cost: 2500, desc: 'Take five hits instead of two', col: '#d94a3a' },
  reload: { name: 'QUICK HANDS', cost: 3000, desc: 'Reload twice as fast', col: '#5fd08a' },
  revive: { name: 'SECOND WIND', cost: 1500, desc: 'Pick teammates up twice as fast. Alone (500, three times): get yourself back up', col: '#4fb3ff' },
  rapid: { name: 'DOUBLE BARREL', cost: 2000, desc: 'Every gun fires a third faster', col: '#f2c14e' },
  stride: { name: 'LONG STRIDE', cost: 2000, desc: 'Run faster and sprint for longer', col: '#e8e070' },
  blast: { name: 'BLAST PROOF', cost: 2000, desc: 'Your own explosions don\'t hurt you, and a slide ends in a blast', col: '#c58bff' },
};
export const POWERUPS = ['ammo', 'insta', 'double', 'nuke', 'carpenter', 'firesale'];
const START_GUN = 'p10';
const CRATE_GUNS = ['mule', 'ox', 'drummer', 'cyclone', 'trestle', 'pike', 'saker', 'heron', 'longbow', 'sabre', 'trident', 'verdict', 'tandem', 'ferret', 'auger', 'quill', 'hedge', 'anvil', 'mammoth', 'needle', 'vex50', 'bison', 'whisper', 'hatchet', 'gnat', 'lark', 'stub', 'k4', 'rook', 'wasp', 'marten', 'tusk', 'breaker', 'javelin', 'sentry'];
const ZOMBIE_OPS = Object.keys(OPERATORS).filter(o => OPERATORS[o].armor === 2);

const r1 = v => Math.round(v * 10) / 10;
const people = game => [...game.players.values()].filter(p => !p.zombie);
const zombies = game => [...game.players.values()].filter(p => p.zombie);
const note = (game, p, text) => { if (p && p.sock) game.events.push({ e: 'pts', to: p.id, n: 0, w: text }); };
// points in (double points doubles them) or out
function pay(game, p, n, why) {
  if (n > 0 && game.zb.double > game.time) n *= 2;
  p.zb.pts += n; if (n > 0) { p.zb.earned += n; game.zb.teamPts += n; }
  if (p.sock && n) game.events.push({ e: 'pts', to: p.id, n, w: why });
}
const gunOf = (p, w, up = false) => { const att = cleanAtt(w, null, p.op); const W = WEAPONS[w]; return { w, ammo: Math.round(W.mag * (up ? 1.5 : 1)), reserve: maxReserve(w, up), att, m: gunMods(w, att), up: up ? 1 : undefined }; };
const maxReserve = (w, up) => Math.round(WEAPONS[w].mag * (up ? 10 : 6));

// ---------------- the numbers ----------------
export function roundSize(r, n) {
  let mul = Math.max(1, r / 5);
  if (r >= 10) mul *= r * 0.15;
  let max = 24 + (n <= 1 ? Math.floor(0.5 * 6 * mul) : Math.floor((n - 1) * 6 * mul));
  const early = [0.25, 0.3, 0.5, 0.7, 0.9][r - 1];
  if (early) max = Math.floor(max * early);
  return max;
}
export function zombieHp(r) { let h = 150; for (let i = 2; i <= r; i++) h = i < 10 ? h + 100 : Math.floor(h * 1.1); return h; }
export function zombieSpeed(r) { const v = r * 8 + Math.floor(Math.random() * 36); return v <= 35 ? 'walk' : v <= 70 ? 'run' : 'sprint'; }
export function spawnDelay(r) { let d = ZB.spawnDelay; for (let i = 2; i <= r; i++) if (d > ZB.spawnMin) d *= ZB.spawnShrink; return Math.max(ZB.spawnMin, d); }

export function zbStart(game) {
  const prevMap = game.mapId;
  game.map = buildMap('lantern'); game.mapId = 'lantern'; game.mapVersion++; game.changed.clear(); game.newHoles = [];
  game.baseTiles = game.map.tiles.slice();
  game.ents = []; game.planted = null; game.winner = null; game.reason = ''; game.noises = []; game.bans = []; game.banRun = null;
  game.spots = { atk: new Map(), def: new Map() };
  game.score = [0, 0]; game.round = 1; game.matchStart = Date.now(); game.departed = []; game.roundLog = [];
  const Z = game.map.zombies, m = game.map;
  game.zb = { round: 0, open: new Set([0]), gates: Z.gates.map(g => ({ ...g, open: false })), power: false,
    crate: { at: Math.floor(Math.random() * 2), uses: 0, roll: null, moving: 0, moved: false },
    forge: null, prevMap, left: 0, spawnT: 0, betweenT: 3, fieldT: 0, boards: {}, over: false, kills: 0,
    teamPts: 0, dropAt: ZB.dropMark, dropInc: ZB.dropMark, drops: 0, bag: [], pows: [], insta: 0, double: 0, firesale: 0, nid: 1, qrUses: 0 };
  for (const g of game.zb.gates) for (const k of g.cells) { m.tiles[k] = T.BEAM; m.hp[k] = 99999; game.changed.add(k); }
  // every ground-floor window starts with all its boards
  for (const o of m.openings) if (o.cells.some(k => m.win[k]) && m.flAt[o.cells[0]] === m.groundFloor) { game.zb.boards[o.id] = ZB.boardsMax; for (const k of o.cells) { m.tiles[k] = T.BARRI; m.hp[k] = 100; game.changed.add(k); } }
  const ps = people(game);
  ps.forEach((p, i) => {
    p.lobbySq = p.squad; p.squad = 0; p.kills = 0; p.deaths = 0; p.ms = game.blankMatchStats(); p.locked = true;
    p.zb = { pts: ZB.start, earned: 0, kills: 0, heads: 0, downs: 0, revives: 0, perks: [], boardPts: 0 };
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
  p.abilityCount = 0; p.drones = 0; p.barri = 0; p.battery = 0; p.riot = null; p.hasDefuser = false;
  p.gadget = 'frag'; p.gadgetCount = ZB.nadesStart;
  p.guns = [gunOf(p, START_GUN)]; p.slot = 0; p.reloadT = 0; p.fireCd = 0.3; p.lastStand = null;
  p.zb.perks = [];
  p.maxHp = ZB.hp; p.hp = p.maxHp; p.lastHurt = 0;
  const pos = game.freeSpotNear(s.x, s.y, 16); p.x = pos.x; p.y = pos.y; p.vx = p.vy = 0; p.aim = -Math.PI / 2;
}

// ---------------- the flow field: every zombie walks downhill toward the nearest standing person ----------------
const WALK_Z = new Set([T.FLOOR, T.GROUND, T.STAIR, T.OPEN, T.BARRI, T.HATCH, T.HATCHR, T.RUBBLE]);
function field(game) {
  const Zs = game.zb, m = game.map, N = m.W * m.H, W = m.W;
  if (!Zs.rev) { Zs.rev = new Map(); for (let k = 0; k < N; k++) { const b = m.portal[k]; if (b >= 0) { if (!Zs.rev.has(b)) Zs.rev.set(b, []); Zs.rev.get(b).push(k); } } }
  const d = Zs.dist && Zs.dist.length === N ? Zs.dist.fill(1e9) : (Zs.dist = new Float32Array(N).fill(1e9));
  const q = Zs.q || (Zs.q = new Int32Array(N * 3)); let h = 0, t = 0;
  for (const p of people(game)) if (p.alive && !p.downed) { const k = Math.floor(p.y / CELL) * W + Math.floor(p.x / CELL); if (k >= 0 && k < N) { d[k] = 0; q[t++] = k; } }
  const cost = k => m.tiles[k] === T.BARRI ? 6 : m.win[k] ? 3 : 1;
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
  // SECOND WIND alone: back up by yourself after a moment
  for (const p of ps) if (p.alive && p.downed && p.zb.selfUp && game.time - (p.downT || 0) > 3.5) { p.zb.selfUp = false; zbUp(game, p); game.events.push({ e: 'snd', s: 'revive', x: r1(p.x), y: r1(p.y) }); }
  // the crate's spin and the Forge
  const C = Zs.crate;
  if (C.roll && !C.roll.ready && game.time >= C.roll.t) { C.roll.ready = true; C.roll.until = game.time + ZB.takeWait; }
  if (C.roll && C.roll.ready && game.time >= C.roll.until) C.roll = null; // not taken: gone
  if (C.moving && game.time >= C.moving) { C.moving = 0; C.moved = true; const n = game.map.zombies.crates.length; let i = C.at; while (n > 1 && i === C.at) i = Math.floor(Math.random() * n); C.at = i; game.msg('The mystery crate has turned up somewhere else in town'); }
  const F = Zs.forge;
  if (F && !F.ready && game.time >= F.t) { F.ready = true; F.until = game.time + ZB.takeWait; game.events.push({ e: 'snd', s: 'forge', x: r1(game.map.zombies.forge.x), y: r1(game.map.zombies.forge.y) }); }
  if (F && F.ready && game.time >= F.until) Zs.forge = null; // left in the Forge: gone (as in that game)
  // power-ups on the ground: picked up by walking over them, gone after a while
  for (const u of Zs.pows) {
    if (game.time > u.until) { u.gone = true; continue; }
    const p = ps.find(q => q.alive && !q.downed && Math.hypot(q.x - u.x, q.y - u.y) < 18 && floorAt(game.map, q.x, q.y) === floorAt(game.map, u.x, u.y));
    if (p) { u.gone = true; powerUp(game, u.k, p); }
  }
  Zs.pows = Zs.pows.filter(u => !u.gone);
  if (Zs.nukeAt && game.time >= Zs.nukeAt) { Zs.nukeAt = 0; for (const z of zombies(game)) if (z.alive) { game.damage(z, 1e9, null, 'Nuke'); } }
  // everyone down or dead: it's over
  if (ps.length && !ps.some(p => p.alive && !p.downed)) return zbOver(game);
  // between rounds
  if (Zs.betweenT > 0) { Zs.betweenT -= dt; if (Zs.betweenT <= 0) nextRound(game); return; }
  // spawning
  Zs.spawnT -= dt;
  if (Zs.left > 0 && Zs.spawnT <= 0 && zs.filter(z => z.alive).length < ZB.maxAlive) { if (spawnZombie(game)) Zs.left--; Zs.spawnT = spawnDelay(Zs.round); }
  if (Zs.left <= 0 && zs.every(z => !z.alive)) { for (const z of zs) game.players.delete(z.id); Zs.betweenT = ZB.between; game.events.push({ e: 'banner', text: `ROUND ${Zs.round} SURVIVED`, sub: 'The next wave is coming' }); game.events.push({ e: 'snd', s: 'zbRoundEnd', x: 0, y: 0 }); }
  for (const z of zs) if (!z.alive && game.time - (z.deadT || 0) > 1.5) game.players.delete(z.id);
}

function nextRound(game) {
  const Zs = game.zb; Zs.round++; game.round = Zs.round;
  const ps = people(game);
  Zs.left = roundSize(Zs.round, ps.length); Zs.spawnT = 2; Zs.drops = 0;
  for (const p of ps) p.zb.boardPts = 0;
  for (const [i, p] of ps.entries()) if (!p.alive) { zbSpawnPerson(game, p, i); game.msg(`${p.name} is back`); }
  for (const p of ps) if (p.alive && p.downed) zbUp(game, p);
  if (Zs.round > 1) for (const p of ps) if (p.alive) p.gadgetCount = Math.min(ZB.nadesMax, (p.gadgetCount || 0) + 2);
  game.events.push({ e: 'zbRound', r: Zs.round });
}

function spawnZombie(game) {
  const Zs = game.zb, m = game.map, ps = people(game).filter(p => p.alive);
  const list = m.zombies.spawns.filter(s => s.wake.some(z => Zs.open.has(z)));
  if (!list.length || !ps.length) return false;
  let best = null, bs = -Infinity;
  for (const s of list) { // close-ish to someone, out of their sight
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
  let tgt = null, td = Infinity;
  for (const p of game.players.values()) if (!p.zombie && p.alive && !p.downed) { const dd = Math.hypot(p.x - z.x, p.y - z.y); if (dd < td && floorAt(m, p.x, p.y) === floorAt(m, z.x, z.y)) { td = dd; tgt = p; } }
  if (tgt && td < 3 * CELL && los(m, z.x, z.y, tgt.x, tgt.y)) { // someone right there: swipe
    z.aim = Math.atan2(tgt.y - z.y, tgt.x - z.x);
    if (td < ZB.reach) {
      if (ai.swipeT <= 0) { ai.swipeT = ZB.swipeCd; game.events.push({ e: 'melee', id: z.id }); game.damage(tgt, ZB.swipe, z, 'Zombie', z.aim); }
      return;
    }
    go(inp, z.aim, z); return;
  }
  if (!d || d[k] >= 1e9) { ai.wT = (ai.wT || 0) - dt; if (ai.wT <= 0) { ai.wT = 2; ai.wa = Math.random() * 6.28; } go(inp, ai.wa, z); inp.walk = 1; return; }
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
  if (m.win[best] && oi >= 0) { // the window in front: tear a board off, or climb through
    z.aim = a;
    if ((Zs.boards[oi] || 0) > 0) {
      ai.tearT = (ai.tearT ?? 1.0) - dt;
      if (ai.tearT <= 0) { ai.tearT = 1.0; setBoards(game, oi, Zs.boards[oi] - 1); game.events.push({ e: 'hit', k: 'wood', x: r1(bx), y: r1(by) }); game.events.push({ e: 'snd', s: 'board', x: r1(bx), y: r1(by) }); }
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
// walkers shamble (1.2 m/s), runners jog (2.4), sprinters run nearly flat out (3.9); LONG STRIDE: +7 %
export function zbSpeed(game, p) { return p.zombie ? (p.zspeed === 'sprint' ? 0.93 : p.zspeed === 'run' ? 0.92 : 0.85) : p.zb && p.zb.perks.includes('stride') ? 1.07 : 1; }

function setBoards(game, oi, n) {
  const m = game.map, o = m.openings[oi]; n = Math.max(0, Math.min(ZB.boardsMax, n));
  game.zb.boards[oi] = n;
  for (const k of o.cells) { m.tiles[k] = n > 0 ? T.BARRI : T.OPEN; m.hp[k] = n > 0 ? Math.round(100 * n / ZB.boardsMax) : 0; if (m.holes[k]) delete m.holes[k]; game.changed.add(k); }
}

// ---------------- power-ups ----------------
function maybeDrop(game, z) {
  const Zs = game.zb;
  if (Zs.drops >= ZB.dropsARound || Zs.left + zombies(game).filter(q => q.alive).length <= 0) return;
  const byPoints = Zs.teamPts >= Zs.dropAt;
  if (!byPoints && Math.random() >= ZB.dropChance) return;
  if (byPoints) { Zs.dropInc *= ZB.dropGrow; Zs.dropAt += Zs.dropInc; }
  if (!Zs.bag.length) Zs.bag = POWERUPS.filter(k => k !== 'firesale' || Zs.crate.moved).sort(() => Math.random() - 0.5); // each once before any repeats
  const k = Zs.bag.pop();
  Zs.drops++;
  Zs.pows.push({ id: Zs.nid++, k, x: z.x, y: z.y, until: game.time + ZB.dropLife });
  game.events.push({ e: 'snd', s: 'powDrop', x: r1(z.x), y: r1(z.y) });
}
function powerUp(game, k, p) {
  const Zs = game.zb, ps = people(game), name = { ammo: 'MAX AMMO', insta: 'INSTA-KILL', double: 'DOUBLE POINTS', nuke: 'NUKE', carpenter: 'CARPENTER', firesale: 'FIRE SALE' }[k];
  game.events.push({ e: 'banner', text: name, sub: `${p.name} picked it up` }); game.events.push({ e: 'snd', s: 'pow_' + k, x: r1(p.x), y: r1(p.y) });
  if (k === 'ammo') for (const q of ps) if (q.alive) { for (const g of q.guns) g.reserve = maxReserve(g.w, g.up); if (q.lastStand) for (const g of q.lastStand.guns) g.reserve = maxReserve(g.w, g.up); q.gadgetCount = ZB.nadesMax; }
  if (k === 'insta') Zs.insta = game.time + ZB.powerTime;
  if (k === 'double') Zs.double = game.time + ZB.powerTime;
  if (k === 'firesale') Zs.firesale = game.time + ZB.powerTime;
  if (k === 'nuke') { Zs.nukeAt = game.time + 1.2; for (const q of ps) if (q.alive) pay(game, q, ZB.nuke, 'NUKE'); }
  if (k === 'carpenter') { for (const oi of Object.keys(Zs.boards)) setBoards(game, +oi, ZB.boardsMax); for (const q of ps) if (q.alive) pay(game, q, ZB.carpenter, 'CARPENTER'); }
}

// ---------------- E: buy, repair, take ----------------
// returns true when the key did something here (so the normal hold-E jobs, like picking someone up, don't also run)
export function zbUse(game, p, dt, inp) {
  const Zs = game.zb; if (!Zs || p.zombie || !p.alive || p.downed) return false;
  const pressed = inp.interact && !(p.prevInput && p.prevInput.interact);
  const st = zbStation(game, p);
  if (!st) { p.zbRep = 0; return false; }
  if (st.k === 'window') {
    if (!inp.interact) { p.zbRep = 0; return true; }
    p.zbRep = (p.zbRep || 0) + dt;
    if (p.zbRep >= ZB.boardEvery) {
      p.zbRep = 0; setBoards(game, st.oi, Zs.boards[st.oi] + 1); game.events.push({ e: 'snd', s: 'barricade', x: r1(p.x), y: r1(p.y) });
      if (p.zb.boardPts < ZB.boardCap) { p.zb.boardPts += ZB.board; pay(game, p, ZB.board, 'BOARD'); }
    }
    return true;
  }
  if (!pressed) return true;
  const broke = () => { note(game, p, 'NOT ENOUGH POINTS'); game.events.push({ e: 'snd', s: 'deny', x: r1(p.x), y: r1(p.y), id: p.id }); return true; };
  if (st.k === 'gate') {
    if (p.zb.pts < st.g.cost) return broke();
    pay(game, p, -st.g.cost, st.g.name.toUpperCase());
    st.g.open = true; Zs.open.add(st.g.opens);
    for (const k of st.g.cells) { game.map.tiles[k] = T.OPEN; game.map.hp[k] = 0; game.changed.add(k); }
    game.events.push({ e: 'snd', s: 'gate', x: r1(st.g.x), y: r1(st.g.y) });
    game.msg(`${p.name} opened the ${st.g.name}`);
    return true;
  }
  if (st.k === 'gun') {
    const W = st.s.w, has = p.guns.findIndex(g => g.w === W);
    if (has >= 0) {
      const g = p.guns[has], cost = g.up ? ZB.forgeAmmo : Math.round(st.s.cost * ZB.ammoShare);
      if (g.reserve >= maxReserve(W, g.up) && g.ammo >= Math.round(WEAPONS[W].mag * (g.up ? 1.5 : 1))) { note(game, p, 'FULL'); return true; }
      if (p.zb.pts < cost) return broke();
      pay(game, p, -cost, 'AMMO'); g.reserve = maxReserve(W, g.up); return true;
    }
    if (p.zb.pts < st.s.cost) return broke();
    pay(game, p, -st.s.cost, WEAPONS[W].name.toUpperCase()); giveGun(game, p, gunOf(p, W)); return true;
  }
  if (st.k === 'crate') {
    const C = Zs.crate;
    if (C.roll && C.roll.ready && C.roll.by === p.id) { giveGun(game, p, gunOf(p, C.roll.w)); C.roll = null; return true; } // take it
    if (C.roll || C.moving) return true;
    const cost = Zs.firesale > game.time ? ZB.fireCrate : ZB.crate;
    if (p.zb.pts < cost) return broke();
    pay(game, p, -cost, 'MYSTERY CRATE');
    C.uses++;
    if (Zs.firesale <= game.time && C.uses > 4 && Math.random() < 0.08 * (C.uses - 4)) { // it flies off: points back, somewhere else soon
      pay(game, p, cost, 'THE CRATE FLEW OFF'); C.uses = 0; C.moving = game.time + 12;
      game.events.push({ e: 'snd', s: 'crateGone', x: r1(st.s.x), y: r1(st.s.y) }); game.events.push({ e: 'banner', text: 'THE CRATE FLEW OFF', sub: 'It will turn up somewhere else' });
      return true;
    }
    const own = new Set(p.guns.map(g => g.w)), pool = CRATE_GUNS.filter(w => WEAPONS[w] && !own.has(w));
    C.roll = { by: p.id, w: pool[Math.floor(Math.random() * pool.length)], t: game.time + ZB.spin, ready: false, x: st.s.x, y: st.s.y };
    game.events.push({ e: 'zbCrate', x: r1(st.s.x), y: r1(st.s.y), w: C.roll.w, t: ZB.spin });
    return true;
  }
  if (st.k === 'perk') {
    const P = PERKS[st.s.id], solo = people(game).length === 1, soloQr = st.s.id === 'revive' && solo;
    if (!Zs.power && !soloQr) { note(game, p, 'NEEDS THE POWER ON'); return true; }
    if (soloQr && Zs.qrUses >= 3) { note(game, p, 'USED UP'); return true; }
    if (p.zb.perks.includes(st.s.id)) { note(game, p, 'YOU HAVE IT'); return true; }
    const cost = soloQr ? 500 : P.cost;
    if (p.zb.pts < cost) return broke();
    pay(game, p, -cost, P.name); p.zb.perks.push(st.s.id);
    if (st.s.id === 'tough') { p.maxHp = ZB.toughHp; p.hp = ZB.toughHp; }
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
    const F = Zs.forge;
    if (F && F.ready && F.by === p.id) { const g = gunOf(p, F.w, true); giveGun(game, p, g); Zs.forge = null; return true; } // take it back
    if (F) return true;
    if (!Zs.power) { note(game, p, 'NEEDS THE POWER ON'); return true; }
    const g = p.guns[p.slot]; if (!g || g.up) { note(game, p, g ? 'ALREADY FORGED' : ''); return true; }
    if (p.zb.pts < ZB.forge) return broke();
    pay(game, p, -ZB.forge, 'THE FORGE');
    p.guns.splice(p.slot, 1); if (!p.guns.length) p.guns.push({ ...gunOf(p, START_GUN), ammo: 0, reserve: 0 }); p.slot = 0; // the gun goes in
    Zs.forge = { by: p.id, w: g.w, t: game.time + ZB.forgeTime, ready: false };
    game.events.push({ e: 'snd', s: 'forgeIn', x: r1(p.x), y: r1(p.y) });
    return true;
  }
  return false;
}
function giveGun(game, p, g) {
  const empty = p.guns.findIndex(x => x.ammo === 0 && x.reserve === 0 && x.w === START_GUN);
  if (empty >= 0) { p.guns[empty] = g; p.slot = empty; }
  else if (p.guns.length < 2) { p.guns.push(g); p.slot = p.guns.length - 1; }
  else p.guns[p.slot] = g;
  p.reloadT = 0; p.fireCd = 0.4;
  note(game, p, (g.up ? 'FORGED ' : '') + WEAPONS[g.w].name.toUpperCase());
  game.events.push({ e: 'snd', s: 'swap', x: r1(p.x), y: r1(p.y), id: p.id });
}

// what is within reach for E (the client works out the same thing for its prompt: zbStationAt in main.js)
export function zbStation(game, p) {
  const Zs = game.zb, Z = game.map.zombies, m = game.map, near = (s, r) => s && Math.hypot(s.x - p.x, s.y - p.y) < r && floorAt(m, s.x, s.y) === floorAt(m, p.x, p.y);
  for (const g of Zs.gates) if (!g.open && near(g, 40)) return { k: 'gate', g };
  for (const s of Z.guns) if (near(s, 26)) return { k: 'gun', s };
  for (const s of Z.perks) if (near(s, 26)) return { k: 'perk', s };
  const C = Zs.crate;
  if (C.roll && near({ x: C.roll.x, y: C.roll.y }, 28)) return { k: 'crate', s: { x: C.roll.x, y: C.roll.y } };
  const spots = Zs.firesale > game.time ? Z.crates : C.moving ? [] : [Z.crates[C.at]];
  for (const s of spots) if (near(s, 28)) return { k: 'crate', s };
  if (near(Z.power, 26)) return { k: 'power', s: Z.power };
  if (near(Z.forge, 26)) return { k: 'forge', s: Z.forge };
  const W = m.W, cx = Math.floor(p.x / CELL), cy = Math.floor(p.y / CELL);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const k = (cy + dy) * W + cx + dx, oi = m.openId[k];
    if (oi >= 0 && m.win[k] && Zs.boards[oi] !== undefined && Zs.boards[oi] < ZB.boardsMax) return { k: 'window', oi };
  }
  return null;
}

// ---------------- hits, going down, kills ----------------
// game.js: hitscan calls with how the bullet landed (head / neck), damage() with the amount
export function zbDamage(game, q, amount, src, wname) {
  const Zs = game.zb;
  if (q.zombie && src && src.zombie) return 0;
  if (!q.zombie) {
    if (src && !src.zombie && src !== q) return 0; // people never hurt each other
    if (src === q && q.zb && q.zb.perks.includes('blast')) return 0; // BLAST PROOF
    q.lastHurt = game.time; return amount;
  }
  if (!src || !src.zb) return amount; // the nuke
  if (Zs.insta > game.time) amount = q.hp + 1;
  else if (wname === 'Melee') amount = ZB.knifeDmg;
  else { const g = src.guns[src.slot]; if (g && g.up && WEAPONS[g.w] && wname === WEAPONS[g.w].name) amount *= ZB.forgeMul; } // a forged gun's bullets
  if (amount < q.hp && wname !== 'Melee') pay(game, src, ZB.hit, ''); // a hit that doesn't kill: 10
  return amount;
}
export function zbKill(game, q, src, wname) {
  if (q.zombie) {
    q.deadT = game.time; game.zb.kills++;
    if (src && src.zb) {
      src.zb.kills++; const knife = wname === 'Melee', head = game.headshot, neck = game.zbNeck;
      if (head) src.zb.heads++;
      pay(game, src, knife ? ZB.knife : head ? ZB.head : neck ? ZB.neck : ZB.kill, knife ? 'KNIFE KILL' : head ? 'HEADSHOT' : 'KILL');
    }
    maybeDrop(game, q);
    return;
  }
  if (q.zb) { q.zb.perks = []; q.lastStand = null; }
}
// going down: always when anyone else is standing, alone only with SECOND WIND
export function zbCanGoDown(game, q) {
  if (q.zombie) return false;
  const others = people(game).some(p => p !== q && p.alive && !p.downed);
  const solo = people(game).length === 1, qr = q.zb.perks.includes('revive');
  return others || (qr && solo);
}
// last stand: perks are lost, a pistol comes out (yours if you carry one, else the starting one with two magazines)
export function zbDown(game, q) {
  q.hp = ZB.bleed; q.zb.downs++;
  const solo = people(game).length === 1;
  if (solo && q.zb.perks.includes('revive')) { q.zb.selfUp = true; game.zb.qrUses++; }
  q.zb.perks = []; q.maxHp = ZB.hp;
  const pistol = q.guns.find(g => SIDEARMS.has(g.w) && (g.ammo + g.reserve) > 0);
  q.lastStand = { guns: q.guns, slot: q.slot };
  q.guns = [pistol || { ...gunOf(q, START_GUN), reserve: WEAPONS[START_GUN].mag * 2 }]; q.slot = 0; q.reloadT = 0;
}
export function zbUp(game, p) {
  p.downed = false; p.hp = ZB.hp * 0.5; p.maxHp = ZB.hp;
  if (p.lastStand) { const ls = p.lastStand; p.guns = ls.guns; p.slot = Math.min(ls.slot, p.guns.length - 1); p.lastStand = null; } // the guns from before (a pistol used in last stand is one of them)
}
export function zbReviveTime(game, p) { return p.zb && p.zb.perks.includes('revive') ? 0.5 : 1; }
export function zbReloadMul(game, p) { return p.zb && p.zb.perks.includes('reload') ? 0.5 : 1; }
export function zbBlocksVault(game, p, to) {
  if (p.zombie) return false;
  const m = game.map, n = Math.ceil(Math.hypot(to.x - p.x, to.y - p.y) / 4);
  for (let i = 0; i <= n; i++) { const x = p.x + (to.x - p.x) * i / n, y = p.y + (to.y - p.y) * i / n, k = Math.floor(y / CELL) * m.W + Math.floor(x / CELL); if (m.win[k]) return true; }
  return false;
}
// BLAST PROOF: a slide ends in a blast that hurts zombies only
export function zbSlideEnd(game, p) {
  if (!p.zb || !p.zb.perks.includes('blast')) return;
  const dmg = 1000 + 150 * game.zb.round;
  for (const z of zombies(game)) if (z.alive && Math.hypot(z.x - p.x, z.y - p.y) < 3 * PX_PER_M && los(game.map, p.x, p.y, z.x, z.y)) game.damage(z, dmg, p, 'Explosion');
  game.events.push({ e: 'boom', x: r1(p.x), y: r1(p.y), r: 3 * PX_PER_M, kind: 'frag' }); game.events.push({ e: 'snd', s: 'blastSlide', x: r1(p.x), y: r1(p.y) });
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
  for (const p of game.players.values()) { if (p.lobbySq !== undefined) p.squad = p.lobbySq; p.lobbySq = undefined; p.zb = null; p.lastStand = null; }
  if (game.zb.prevMap && game.zb.prevMap !== 'lantern') { game.mapId = game.zb.prevMap; game.map = buildMap(game.mapId); game.mapVersion++; game.events.push({ e: 'newmap', v: game.mapVersion }); } // the lobby's map again
  game.zb = null;
}

// what the snapshot carries
export function zbPlayer(game, p) { return p.zombie ? [1, p.zspeed === 'sprint' ? 2 : p.zspeed === 'run' ? 1 : 0, p.zlook || 0] : p.zb ? [0, Math.round(p.zb.pts), p.zb.kills, p.zb.perks.join(','), p.zb.heads, p.zb.downs, p.guns.map(g => g.w + (g.up ? '*' : '')).join(',')] : undefined; }
export function zbInfo(game) {
  const Zs = game.zb; if (!Zs) return undefined;
  const t = game.time, C = Zs.crate, F = Zs.forge, left = v => v > t ? r1(v - t) : 0;
  return { r: Zs.round, left: Zs.left + zombies(game).filter(z => z.alive).length, pw: Zs.power ? 1 : 0, g: Zs.gates.map(g => g.open ? 1 : 0),
    c: C.moving ? -1 : C.at, cr: C.roll ? [C.roll.ready ? 1 : 0, C.roll.w, C.roll.by, r1((C.roll.ready ? C.roll.until : C.roll.t) - t)] : undefined,
    fo: F ? [F.ready ? 1 : 0, F.w, F.by, r1((F.ready ? F.until : F.t) - t)] : undefined,
    b: Zs.betweenT > 0 ? r1(Zs.betweenT) : 0, wb: Zs.boards, pu: Zs.pows.map(u => [u.id, u.k, r1(u.x), r1(u.y), r1(u.until - t)]),
    ik: left(Zs.insta), dp: left(Zs.double), fs: left(Zs.firesale), qr: Zs.qrUses };
}
