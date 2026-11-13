// FUN MODES (he asked 2026-11-12): One in the Chamber, Gun Game, Infected. One match of respawning action on a normal
// map instead of attack/defend rounds: no operator select, preparation, drones, gadgets, skills or defuser.
//   One in the Chamber: everyone for themselves, a pistol with one bullet, any hit or knife kills, a kill gives a
//     bullet back, 3 lives; the last one standing wins (or the most lives, then kills, when the clock runs out).
//   Gun Game: everyone for themselves, every kill moves you to the next gun on the ladder, the last step is the knife;
//     a knife kill sends the victim back one gun. First to win with the knife wins (or the furthest along at time).
//   Infected: one player starts infected (knife only, faster, tougher); anyone they kill joins them. The survivors win
//     if anyone is still clean when the clock runs out; when one survivor is left everyone sees where they are.
// game.js calls these through small hooks (look for `this.arena`). Everyone-for-themselves works by giving each player
// their own squad for the match (so every teammate check sees nobody), put back when the match ends.
import { CELL, PHASE, T, TEAM, PX_PER_M, blocksMove } from '../shared/constants.js';
import { OPERATORS, WEAPONS, ARMOR_HP, gunMods, cleanAtt } from '../shared/operators.js';
import { buildMap, floorAt } from '../shared/map.js';
import { los } from '../shared/physics.js';

export const ARENA = {
  oitc: { ffa: true, time: 6 * 60, lives: 3 },
  gungame: { ffa: true, time: 10 * 60 },
  infected: { ffa: false, time: 4 * 60 },
};
export const OITC_GUN = 'sparrow';
// the Gun Game ladder: every kind of gun, the big ones first, ending on pistols (then the knife)
export const LADDER = ['k4', 'wasp', 'breaker', 'mule', 'longbow', 'rook', 'hornet', 'tusk', 'marten', 'ox', 'pike', 'sabre', 'javelin', 'anvil', 'vex50', 'p10'];
const SURVIVOR_GUNS = ['k4', 'rook', 'sentry', 'wasp', 'marten', 'javelin', 'tusk'];
const RESPAWN = 2.5;
const INFECTED_HP = 160, INFECTED_SPEED = 1.15;

const note = (game, p, text) => { if (p.sock) game.events.push({ e: 'pts', to: p.id, n: 0, w: text }); }; // a popup under the crosshair
const rnd = (a, b) => a + Math.random() * (b - a);
const alive = game => [...game.players.values()].filter(p => p.alive);

export function arenaStart(game) {
  const mode = game.mode, R = ARENA[mode];
  game.mapId = game.mapId; game.map = buildMap(game.mapId); game.mapVersion++; game.changed.clear(); game.newHoles = [];
  game.baseTiles = game.map.tiles.slice();
  game.ents = []; game.planted = null; game.winner = null; game.reason = ''; game.noises = []; game.bans = []; game.banRun = null;
  game.spots = { atk: new Map(), def: new Map() };
  game.score = [0, 0]; game.round = 1; game.matchStart = Date.now(); game.departed = []; game.roundLog = [];
  const ps = [...game.players.values()];
  game.arena = { mode, ffa: R.ffa, end: R.time, spots: spawnCells(game.map), lastOne: null };
  ps.forEach((p, i) => {
    p.lobbySq = p.squad; p.kills = 0; p.deaths = 0; p.ms = game.blankMatchStats(); p.locked = true;
    p.ar = { kills: 0, lives: R.lives || 0, lv: 0, out: false, op: null };
    if (R.ffa) p.squad = 2 + i; // their own team
  });
  if (mode === 'infected') {
    for (const p of ps) p.squad = 0;
    const first = ps[Math.floor(Math.random() * ps.length)];
    if (first) infect(game, first, true);
  }
  game.phase = PHASE.ACTION; game.timer = R.time;
  for (const p of ps) arenaSpawn(game, p);
  game.events.push({ e: 'newmap', v: game.mapVersion });
  game.events.push({ e: 'banner', text: ({ oitc: 'ONE IN THE CHAMBER', gungame: 'GUN GAME', infected: 'INFECTED' })[mode], sub: ({
    oitc: 'One bullet. Three lives. Every kill gives you another bullet',
    gungame: 'Every kill moves you to the next gun. Win with the knife',
    infected: 'Don\'t get caught. Anyone the infected kill joins them' })[mode] });
}

function infect(game, p, first) {
  p.squad = 1; p.ar.infected = true;
  if (!first) game.events.push({ e: 'banner', text: `${p.name} IS INFECTED`, sub: '' });
  else game.msg(`${p.name} starts infected!`);
}

// floor cells a body fits on: inside rooms on any floor, and the ground near the building (not the far yard)
function spawnCells(m) {
  const W = m.W, out = [], inRoom = new Uint8Array(m.tiles.length);
  for (const r of m.rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) inRoom[y * W + x] = 1;
  const free = k => (m.tiles[k] === T.FLOOR || m.tiles[k] === T.GROUND) && !(m.shape && m.shape[k]) && !(m.portal && m.portal[k] >= 0);
  const near = (k, r) => { const x = k % W, y = Math.floor(k / W); for (let dy = -r; dy <= r; dy += 2) for (let dx = -r; dx <= r; dx += 2) if (inRoom[(y + dy) * W + x + dx]) return true; return false; };
  for (let k = W; k < m.tiles.length - W; k++) {
    if (!free(k) || !free(k - 1) || !free(k + 1) || !free(k - W) || !free(k + W)) continue;
    if (inRoom[k] || (m.tiles[k] === T.GROUND && near(k, 8))) out.push(k);
  }
  return out;
}

// a spot away from enemies (and out of their sight if it can be)
function spawnSpot(game, p) {
  const m = game.map, W = m.W, A = game.arena, foes = alive(game).filter(q => q !== p && game.side(q) !== game.side(p));
  let best = null, bs = -Infinity;
  for (let i = 0; i < 40 && A.spots.length; i++) {
    const k = A.spots[Math.floor(Math.random() * A.spots.length)], x = (k % W + 0.5) * CELL, y = (Math.floor(k / W) + 0.5) * CELL;
    let near = 60 * PX_PER_M, seen = 0;
    for (const q of foes) {
      const d = Math.hypot(q.x - x, q.y - y) + (floorAt(m, q.x, q.y) === floorAt(m, x, y) ? 0 : 10 * PX_PER_M);
      near = Math.min(near, d);
      if (d < 30 * PX_PER_M && floorAt(m, q.x, q.y) === floorAt(m, x, y) && los(m, x, y, q.x, q.y)) seen++;
    }
    const s = Math.min(near, 25 * PX_PER_M) - seen * 20 * PX_PER_M + Math.random() * 3 * PX_PER_M;
    if (s > bs) { bs = s; best = { x, y }; }
  }
  return best ? game.freeSpotNear(best.x, best.y, 6) : { x: m.atkSpawns[0].x, y: m.atkSpawns[0].y };
}

const gunOf = (p, w, ammo, reserve) => { const att = cleanAtt(w, null, p.op); return { w, ammo: ammo ?? WEAPONS[w].mag, reserve: reserve ?? WEAPONS[w].reserve, att, m: gunMods(w, att) }; };

export function arenaSpawn(game, p) {
  const A = game.arena; if (!A) return;
  p.respawnAt = 0;
  if (!p.ar.op) { const all = Object.keys(OPERATORS); p.ar.op = all[Math.floor(Math.random() * all.length)]; } // a look for the match
  p.op = p.ar.op; p.job = null;
  game.equip(p);
  // nothing but the gun: no skill, gadget, drone or boards
  p.abilityCount = 0; p.gadgetCount = 0; p.gadget = null; p.drones = 0; p.barri = 0; p.battery = 0; p.riot = null; p.hasDefuser = false;
  setGuns(game, p);
  const s = spawnSpot(game, p); p.x = s.x; p.y = s.y; p.vx = p.vy = 0;
  p.aim = Math.atan2(game.map.H * CELL / 2 - p.y, game.map.W * CELL / 2 - p.x);
  p.spawnSafe = game.time + 1.5; // a moment where nothing hurts them (spawn kills)
}

function setGuns(game, p) {
  const A = game.arena, o = OPERATORS[p.op];
  if (A.mode === 'oitc') p.guns = [gunOf(p, OITC_GUN, p.ar.bullets ?? 1, 0)];
  else if (A.mode === 'gungame') { const w = LADDER[p.ar.lv]; p.guns = [w ? gunOf(p, w) : gunOf(p, 'p10', 0, 0)]; p.ar.knife = !w; }
  else if (p.ar.infected) { p.guns = [gunOf(p, 'sparrow', 0, 0)]; p.maxHp = INFECTED_HP; p.hp = INFECTED_HP; }
  else { p.ar.gun = p.ar.gun || SURVIVOR_GUNS[Math.floor(Math.random() * SURVIVOR_GUNS.length)]; p.guns = [gunOf(p, p.ar.gun), gunOf(p, 'p10')]; }
  if (!p.ar.infected) { p.maxHp = ARMOR_HP[o.armor]; p.hp = p.maxHp; }
  p.slot = 0; p.reloadT = 0; p.fireCd = 0.3; p.adsT = 0; p.rc = 0; p.shots = 0;
}

export function arenaSpeed(game, p) { return game.arena && p.ar && p.ar.infected ? INFECTED_SPEED : 1; }

// how much a hit does (One in the Chamber: anything kills; knives kill in every mode; spawn protection)
export function arenaDamage(game, q, amount, src, wname) {
  if (q.spawnSafe > game.time && src && src !== q) return 0;
  if (src && src.ar && src.ar.infected && q.ar && q.ar.infected) return 0; // the infected don't hurt each other
  if (game.arena.mode === 'oitc' && src && src !== q && wname !== 'Explosion') return 999;
  if (wname === 'Melee' && src && src !== q) return game.arena.mode === 'infected' && !(src.ar && src.ar.infected) ? Math.max(amount, 60) : 999;
  return amount;
}

export function arenaKill(game, q, src, wname) {
  const A = game.arena; if (!A) return;
  const by = src && src !== q ? src : null;
  if (by) { by.ar.kills++; }
  if (A.mode === 'oitc') {
    q.ar.lives--; q.ar.bullets = 1;
    if (by) { const g = by.guns[0]; if (g) { if (g.ammo < 1) g.ammo++; else g.reserve++; } by.ar.bullets = (g ? g.ammo + g.reserve : 1); note(game, by, '+1 BULLET'); }
    if (q.ar.lives <= 0) { q.ar.out = true; game.msg(`${q.name} is out of lives`); }
  } else if (A.mode === 'gungame') {
    if (wname === 'Melee' && by) { q.ar.lv = Math.max(0, q.ar.lv - 1); game.msg(`${by.name} knifed ${q.name}: back one gun`); }
    if (by) {
      if (by.ar.knife && wname === 'Melee') return arenaEnd(game, by, `${by.name} won with the knife`);
      if (wname !== 'Melee' || by.ar.knife) {
        by.ar.lv = Math.min(LADDER.length, by.ar.lv + 1);
        if (by.alive) setGunsKeepPlace(game, by);
        note(game, by, by.ar.lv >= LADDER.length ? 'KNIFE ONLY NOW' : 'NEXT GUN: ' + WEAPONS[LADDER[by.ar.lv]].name.toUpperCase());
      }
    }
  } else if (A.mode === 'infected') {
    if (!q.ar.infected && by && by.ar.infected) { infect(game, q, false); by.ar.kills += 2; }
  }
}
function setGunsKeepPlace(game, p) { setGuns(game, p); p.fireCd = 0.4; game.events.push({ e: 'snd', s: 'swap', x: Math.round(p.x), y: Math.round(p.y), id: p.id }); }

function arenaEnd(game, winner, why) {
  const A = game.arena;
  game.phase = PHASE.MATCH_END; game.timer = 12;
  A.winner = winner ? winner.id : null; A.why = why;
  const squad = winner && winner.squad !== undefined ? winner.squad : A.mode === 'infected' ? (why.startsWith('The survivors') ? 0 : 1) : -1;
  if (A.mode === 'infected') game.score = [squad === 0 ? 1 : 0, squad === 1 ? 1 : 0];
  const best = winner || placings(game)[0];
  game.events.push({ e: 'banner', text: why.toUpperCase(), sub: '' });
  game.events.push({ e: 'matchEnd', squad, ffa: A.ffa ? 1 : undefined, mvp: best ? { id: best.id, name: best.name, op: best.op, ...(best.ms || {}), ops: undefined } : null });
}

export function placings(game) {
  const A = game.arena, ps = [...game.players.values()].filter(p => p.ar);
  const key = p => A.mode === 'oitc' ? [p.ar.out ? 0 : 1, p.ar.lives, p.ar.kills] : A.mode === 'gungame' ? [p.ar.lv, p.ar.kills, -p.deaths] : [p.ar.infected ? 0 : 1, p.ar.kills, 0];
  return ps.sort((a, b) => { const x = key(a), y = key(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return y[i] - x[i]; return 0; });
}

export function arenaTick(game, dt) {
  const A = game.arena; if (!A || game.phase !== PHASE.ACTION) return;
  for (const p of game.players.values()) {
    if (p.alive || !p.ar || p.ar.out) continue;
    if (!p.respawnAt) p.respawnAt = game.time + RESPAWN;
    else if (game.time >= p.respawnAt) arenaSpawn(game, p);
  }
  const ps = [...game.players.values()].filter(p => p.ar);
  if (A.mode === 'oitc') {
    const left = ps.filter(p => !p.ar.out);
    if (left.length <= 1 && ps.length > 1) return arenaEnd(game, left[0] || null, left[0] ? `${left[0].name} is the last one standing` : 'Nobody is left');
  }
  if (A.mode === 'infected') {
    const clean = ps.filter(p => !p.ar.infected);
    if (!clean.length) return arenaEnd(game, null, 'The infected took everyone');
    if (!ps.some(p => p.ar.infected)) { const p = ps[Math.floor(Math.random() * ps.length)]; if (p) infect(game, p, true); } // the infected one left: someone else
    if (clean.length === 1 && ps.length > 2) {
      const last = clean[0];
      if (A.lastOne !== last.id) { A.lastOne = last.id; game.events.push({ e: 'banner', text: 'LAST SURVIVOR', sub: `Everyone can see ${last.name}` }); }
      if (last.alive) game.spots.def.set(last.id, game.time + 1); // the infected (defence side) see them
    }
  }
  if (game.timer <= 0) {
    if (A.mode === 'infected') return arenaEnd(game, null, 'The survivors held out');
    const top = placings(game)[0];
    return arenaEnd(game, top, top ? `Time: ${top.name} wins` : 'Time');
  }
}

export function arenaEndMatch(game) { // back to the lobby: everyone on their own team again
  for (const p of game.players.values()) { if (p.lobbySq !== undefined) p.squad = p.lobbySq; p.lobbySq = undefined; p.ar = null; }
  game.arena = null;
}

// what the snapshot says about each player / the match
export function arenaPlayer(game, p) { return p.ar ? [p.ar.kills, p.ar.lives, p.ar.lv, p.ar.infected ? 1 : 0, p.ar.out ? 1 : 0] : undefined; }
export function arenaInfo(game) { const A = game.arena; return A ? { m: A.mode, w: A.winner, why: A.why, n: LADDER.length } : undefined; }
