// Computer players. They play patiently: attackers take their time and walk once they're close,
// defenders hold an angle on a doorway, and both react to what they HEAR (running footsteps,
// gunfire, explosions) by turning to face it and checking it out — not by knowing where you are.
// They fight what they see, after a human-like moment to react.
import { CELL, T, TEAM, PHASE, blocksMove } from '../shared/constants.js';
import { tileAt, los, angDiff } from '../shared/physics.js';
import { floorAt } from '../shared/map.js';
import { OPERATORS, WEAPONS, opsForTeam } from '../shared/operators.js';

export function botPickOp(game, p) {
  const team = game.side(p);
  const taken = new Set([...game.players.values()].filter(q => q.squad === p.squad && q.op).map(q => q.op));
  const free = opsForTeam(team).filter(o => !taken.has(o));
  if (free.length) game.pickOp(p, free[Math.floor(Math.random() * free.length)]);
}

// Defending bots fortify the site the moment preparation begins.
export function botPrep(game, p) {
  if (game.side(p) !== TEAM.DEF) return;
  const m = game.map, site = m.sites[game.site];
  const inSite = (x, y) => m.rooms.some(r => site.rooms.includes(r.name) && x >= r.x - 1 && x <= r.x + r.w && y >= r.y - 1 && y <= r.y + r.h);
  const siteOpenings = m.openings.filter(o => o.cells.some(k => inSite(k % m.W, Math.floor(k / m.W))));
  const op = OPERATORS[p.op];
  for (const o of siteOpenings) if (m.tiles[o.cells[0]] === T.OPEN && Math.random() < 0.5) game.barricade(o.id, T.BARRI);
  // reinforce two walls of the site
  for (let n = 0; n < 2 && game.reinforce > 0; n++) {
    for (let tries = 0; tries < 60; tries++) {
      const name = site.rooms[Math.floor(Math.random() * site.rooms.length)];
      const r = m.rooms.find(rm => rm.name === name);
      const side = Math.floor(Math.random() * 4);
      const x = side === 0 ? r.x - 1 : side === 1 ? r.x + r.w : r.x + Math.floor(Math.random() * r.w);
      const y = side === 2 ? r.y - 1 : side === 3 ? r.y + r.h : r.y + Math.floor(Math.random() * r.h);
      const k = y * m.W + x;
      if (m.tiles[k] === T.SOFT) { game.reinforceWall(k); game.reinforce--; break; }
    }
  }
  const bomb = site.bombs[Math.floor(Math.random() * 2)];
  const near = (d) => game.freeSpotNear(bomb.x, bomb.y, d);
  const id = op.ability.id;
  if (id === 'panel') for (const o of siteOpenings.slice(0, 3)) { if (p.abilityCount > 0 && game.barricade(o.id, T.PANEL)) p.abilityCount--; }
  if (id === 'jammer') for (let i = 0; i < 2; i++) { const s = near(60); game.ents.push({ id: game.eid(), type: 'jammer', x: s.x, y: s.y, team: TEAM.DEF, owner: p.id, hp: 1 }); p.abilityCount--; }
  // the newer defenders: traps by the site's doors and windows, eyes and ears around it
  const placeAt = (type, x, y, extra = {}) => { game.ents.push({ id: game.eid(), type, x, y, ang: Math.random() * 6.28, team: TEAM.DEF, owner: p.id, hp: 1, ...extra }); p.abilityCount--; };
  const atOpening = i => { const o = siteOpenings[i % siteOpenings.length], k = o.cells[0]; return game.freeSpotNear((k % m.W + 0.5) * CELL, (Math.floor(k / m.W) + 0.5) * CELL, 18); };
  if (['prox', 'concuss', 'clamp'].includes(id) && siteOpenings.length) for (let i = 0; p.abilityCount > 0 && i < 3; i++) { const s = atOpening(i); placeAt(id, s.x, s.y, { arm: 0 }); }
  if (id === 'sensor') while (p.abilityCount > 0) { const s = near(150); placeAt('sensor', s.x, s.y, { t: 0, pingT: 0 }); }
  if (id === 'plates') { const s = near(30); placeAt('plates', s.x, s.y, { c: 5 }); }
  if (id === 'turret' || id === 'stickycam') while (p.abilityCount > 0) {
    const s = near(100); placeAt('cam', s.x, s.y, { offUntil: 0, tu: id === 'turret' ? 1 : 0, ang: Math.atan2(s.y - bomb.y, s.x - bomb.x) });
  }
  if (id === 'grid') for (let k = 0; k < m.tiles.length && p.abilityCount > 0; k++) {
    if (m.tiles[k] !== T.REINF || !inSite(k % m.W, Math.floor(k / m.W)) || Math.random() < 0.6) continue;
    placeAt('grid', (k % m.W + 0.5) * CELL, (Math.floor(k / m.W) + 0.5) * CELL, { cell: k });
  }
  if (id === 'mine') for (const o of siteOpenings.slice(0, 2)) {
    const k = o.cells[0], x = (k % m.W + 0.5) * CELL, y = (Math.floor(k / m.W) + 0.5) * CELL;
    const s = game.freeSpotNear(x, y, 14);
    game.ents.push({ id: game.eid(), type: 'mine', x: s.x, y: s.y, ang: 0, team: TEAM.DEF, owner: p.id, arm: 0, hp: 1 }); p.abilityCount--;
  }
}

// ---- path finding (A* over cells; barricades are passable but costly) ----
function findPath(map, sx, sy, gx, gy) {
  const W = map.W, H = map.H, N = W * H;
  const start = sy * W + sx, goal = gy * W + gx;
  const g = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const heap = [[0, start]]; g[start] = 0;
  const cost = k => {
    const t = map.tiles[k];
    if (map.shape && map.shape[k] && map.shapeFill[k] < 10 && t !== T.VOID) return 2.5; // the open side of a sloped wall: a body slides along it
    if (t === T.BARRI) return 8;
    if (t === T.SOFT && map.hp[k] > 0) return 30; // a plain wall: attackers will knock a hole in it if there's no other way
    if (t === T.PANEL) return 70; // a steel panel: very slow to hammer through, only when there is no other way in
    if (blocksMove(t)) return Infinity;
    // keep a little away from walls so the bot's body fits
    const x = k % W, y = (k / W) | 0;
    const bl = (dx, dy) => blocksMove(tileAt(map, x + dx, y + dy));
    if ((bl(1, 0) && bl(-1, 0)) || (bl(0, 1) && bl(0, -1))) return 3; // a one-cell gap: a body just squeezes through
    let near = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (blocksMove(tileAt(map, x + dx, y + dy)) && tileAt(map, x + dx, y + dy) !== T.BARRI) near++;
    return 1 + near * 0.6;
  };
  const push = (f, k) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const pi = (i - 1) >> 1; if (heap[pi][0] <= heap[i][0]) break; [heap[pi], heap[i]] = [heap[i], heap[pi]]; i = pi; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let s = i; if (l < heap.length && heap[l][0] < heap[s][0]) s = l; if (r < heap.length && heap[r][0] < heap[s][0]) s = r; if (s === i) break; [heap[s], heap[i]] = [heap[i], heap[s]]; i = s; } } return top; };
  let iter = 0;
  // distance guess measured in the shared building frame, so floors stacked above each other are "close"
  const F = map.floors || [], flAt = map.flAt;
  const lx = k => { const f = F[flAt ? flAt[k] : 0]; return k % W + (f ? f.x0 - f.gx : 0); };
  const ly = k => { const f = F[flAt ? flAt[k] : 0]; return ((k / W) | 0) + (f ? f.y0 : 0); };
  const glx = lx(goal), gly = ly(goal), gfl = flAt ? flAt[goal] : 0;
  const h = k => Math.hypot(glx - lx(k), gly - ly(k)) + (flAt && flAt[k] !== gfl ? 6 : 0);
  while (heap.length && iter++ < 30000) {
    const [, k] = pop();
    if (k === goal) break;
    if (closed[k]) continue; closed[k] = 1;
    const x = k % W, y = (k / W) | 0;
    const pk = map.portal ? map.portal[k] : -1; // the end of a staircase leads to the other floor
    if (pk >= 0) { const ng = g[k] + 1; if (ng < g[pk]) { g[pk] = ng; from[pk] = k; push(ng + h(pk), pk); } continue; }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const nk = ny * W + nx;
      if (dx && dy && (blocksMove(map.tiles[y * W + nx]) || blocksMove(map.tiles[ny * W + x]))) continue;
      const c = cost(nk); if (c === Infinity) continue;
      const ng = g[k] + c * (dx && dy ? 1.414 : 1);
      if (ng < g[nk]) { g[nk] = ng; from[nk] = k; push(ng + h(nk), nk); }
    }
  }
  if (from[goal] < 0 && goal !== start) return null;
  const path = [];
  for (let k = goal; k !== start && k >= 0; k = from[k]) path.push(k);
  return path.reverse();
}

function visibleEnemy(game, p) {
  const team = game.side(p);
  const smokes = game.ents.filter(e => e.type === 'smoke');
  let best = null, bd = Infinity;
  for (const q of game.players.values()) {
    if (!q.alive || game.side(q) === team) continue;
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d > 650 || d > bd) continue;
    const a = Math.atan2(q.y - p.y, q.x - p.x);
    if (d > 70 && Math.abs(angDiff(a, p.aim)) > 1.2) continue;
    if (!los(game.map, p.x, p.y, q.x, q.y, smokes)) continue;
    best = q; bd = d;
  }
  return best;
}

function behindDrone(game, p, e, d) {
  const ux = (e.x - p.x) / (d || 1), uy = (e.y - p.y) / (d || 1);
  for (const q of game.players.values()) {
    if (q === p || !q.alive) continue;
    const ax = q.x - p.x, ay = q.y - p.y, along = ax * ux + ay * uy;
    if (along > d - 10 && along < d + 400 && Math.abs(ax * uy - ay * ux) < 30) return true;
  }
  return false;
}

function enemyDrone(game, p) {
  const team = game.side(p);
  const smokes = game.ents.filter(e => e.type === 'smoke');
  let best = null, bd = Infinity;
  for (const e of game.ents) {
    if (e.type !== 'drone' || e.team === team) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d > 260 || d > bd || floorAt(game.map, e.x, e.y) !== floorAt(game.map, p.x, p.y)) continue;
    if (d > 60 && Math.abs(angDiff(Math.atan2(e.y - p.y, e.x - p.x), p.aim)) > 1.2) continue;
    if (!los(game.map, p.x, p.y, e.x, e.y, smokes)) continue;
    if (behindDrone(game, p, e, d)) continue; // a miss would hit a person standing behind it (bullets go through soft walls)
    best = e; bd = d;
  }
  return best;
}

export function botThink(game, p, dt) {
  const ai = p.ai;
  const inp = { up: 0, down: 0, left: 0, right: 0, walk: 0, crouch: 0, fire: 0, ads: 0, interact: 0, ability: 0 };
  p.input = inp;
  if (!p.alive || p.ctrl !== 'body') return;
  if (game.phase === PHASE.PREP && game.side(p) === TEAM.ATK) return;
  const team = game.side(p), map = game.map, site = map.sites[game.site];
  const gun = p.guns[p.slot];

  // --- abilities ---
  const abId = OPERATORS[p.op].ability.id;
  if (game.phase === PHASE.ACTION && p.abilityCount > 0 && !p.downed && team === TEAM.ATK && ['ghost', 'sonar', 'decoy', 'barrage'].includes(abId)) {
    ai.abT = (ai.abT ?? 4 + Math.random() * 10) - dt;
    if (ai.abT <= 0) { ai.abT = 10 + Math.random() * 12; game.event(p, { k: 'ability' }); }
  }

  // --- hearing: the most recent enemy noise this bot could hear ---
  for (const n of game.noises || []) {
    if (n.team === team || game.time - n.t > 1.5 || (ai.heard && ai.heard.t >= n.t)) continue;
    const r = n.r * (floorAt(map, n.x, n.y) === floorAt(map, p.x, p.y) ? 1 : 0.5);
    if (Math.hypot(n.x - p.x, n.y - p.y) < r) ai.heard = { x: n.x, y: n.y, t: n.t };
  }
  const heardRecently = ai.heard && game.time - ai.heard.t < 4;

  // --- fight ---
  const enemy = p.downed ? null : visibleEnemy(game, p);
  if (enemy && abId === 'adrenal' && p.abilityCount > 0 && !(game.time < (p.boostUntil || 0))) game.event(p, { k: 'ability' });
  if (enemy) {
    if (ai.seen !== enemy.id) { // a surprise takes longer to react to than something they were listening for
      const expected = heardRecently && Math.hypot(ai.heard.x - enemy.x, ai.heard.y - enemy.y) < 200;
      ai.seen = enemy.id; ai.ox = (Math.random() - 0.5) * 12; ai.oy = (Math.random() - 0.5) * 12;
      ai.react = -(expected ? 0.15 : 0.45) - Math.random() * 0.45; ai.err = (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.4);
      if (game.tut) { ai.react -= 0.7; ai.err *= 1.8; } // tutorial bots are slow and shaky, so a beginner can win
    }
    ai.react += dt; ai.err *= Math.exp(-dt * 1.3);
    ai.err += (Math.random() - 0.5) * dt * 0.6; // hands are never perfectly steady
    const want = Math.atan2(enemy.y + (ai.oy || 0) - p.y, enemy.x + (ai.ox || 0) - p.x) + ai.err; // bots aim somewhere on the body, not always the head
    p.aim += Math.max(-dt * 4.5, Math.min(dt * 4.5, angDiff(want, p.aim)));
    inp.ads = 1;
    if (gun && gun.ammo === 0) game.startReload(p);
    // a shield facing us: circle round it and only shoot once its side shows (as people do)
    if (p.bracing && Math.hypot(enemy.x - p.x, enemy.y - p.y) < 32) { p.aim = Math.atan2(enemy.y - p.y, enemy.x - p.x); game.event(p, { k: 'melee' }); return; } // shield bash
    if (p.bracing && Math.random() < dt * 0.8) inp.ability = 1; // now and then put the shield away to shoot
    if (!p.bracing && OPERATORS[p.op].ability.id === 'brace' && Math.hypot(enemy.x - p.x, enemy.y - p.y) < 45 && Math.random() < dt) inp.ability = 1;
    const shieldUp = enemy.bracing && !enemy.downed && Math.abs(angDiff(Math.atan2(p.y - enemy.y, p.x - enemy.x), enemy.aim)) < 0.8;
    if (shieldUp && Math.hypot(enemy.x - p.x, enemy.y - p.y) < 26) { p.aim = Math.atan2(enemy.y - p.y, enemy.x - p.x); game.event(p, { k: 'melee' }); return; } // knock the shield aside
    if (shieldUp && !(game.time < (enemy.shieldDownUntil || 0))) { ai.strafe = ai.strafe || (Math.random() < 0.5 ? -1 : 1); const sa = Math.atan2(enemy.y - p.y, enemy.x - p.x) + Math.PI / 2 * ai.strafe; setDir(inp, Math.cos(sa), Math.sin(sa)); return; }
    else if (ai.react > 0.55 && Math.abs(angDiff(want, p.aim)) < 0.2) {
      const w = gun && WEAPONS[gun.w];
      inp.fire = w && !w.auto ? (ai.semi = !ai.semi) ? 1 : 0 : 1;
    }
    ai.strafeT = (ai.strafeT || 0) - dt;
    if (ai.strafeT <= 0) { ai.strafeT = 0.6 + Math.random(); ai.strafe = Math.random() < 0.45 ? 0 : Math.random() < 0.5 ? -1 : 1; } // often just stand and shoot
    if (ai.strafe) { const sa = p.aim + Math.PI / 2 * ai.strafe; setDir(inp, Math.cos(sa), Math.sin(sa)); inp.walk = 1; }
    if (Math.random() < dt * 0.6) game.spot(team, enemy.id, 3);
    return;
  }
  ai.seen = null;
  if (gun && gun.ammo < WEAPONS[gun.w].mag * 0.3 && gun.reserve > 0) game.startReload(p);

  // --- an enemy drone in sight: turn and shoot it (one hit breaks it) ---
  const drone = p.downed ? null : enemyDrone(game, p);
  if (drone) {
    if (ai.droneSeen !== drone.id) { ai.droneSeen = drone.id; ai.droneReact = -0.4 - Math.random() * 0.5; }
    ai.droneReact += dt;
    const want = Math.atan2(drone.y - p.y, drone.x - p.x);
    p.aim += Math.max(-dt * 4.5, Math.min(dt * 4.5, angDiff(want, p.aim)));
    inp.ads = 1; inp.crouch = 1;
    if (gun && gun.ammo === 0) game.startReload(p);
    else if (ai.droneReact > 0 && Math.abs(angDiff(want, p.aim)) < 0.08) { const w = gun && WEAPONS[gun.w]; inp.fire = w && !w.auto ? (ai.semi = !ai.semi) ? 1 : 0 : 1; }
    return;
  }
  ai.droneSeen = null;

  // --- objective ---
  let goal = null, act = null;
  if (team === TEAM.ATK) {
    const item = game.ents.find(e => e.type === 'defuser');
    if (game.planted) goal = ai.guard || (ai.guard = game.freeSpotNear(game.planted.x, game.planted.y, 70));
    else if (p.hasDefuser) {
      const b = ai.bomb || (ai.bomb = site.bombs[Math.floor(Math.random() * 2)]);
      goal = b; if (Math.hypot(b.x - p.x, b.y - p.y) < 24) act = 'plant';
    } else if (item) goal = item;
    else goal = ai.push || (ai.push = nearBomb(game, site, 60));
  } else {
    if (game.planted) { goal = game.planted; if (Math.hypot(goal.x - p.x, goal.y - p.y) < 24) act = 'defuse'; }
    else goal = ai.hold || (ai.hold = nearBomb(game, site, 70));
  }
  if (act) { inp.interact = 1; inp.crouch = 1; return; }
  if (!goal) return;

  // heard something and can't see it: stop, turn to face it and listen for a moment
  if (heardRecently && game.time - ai.heard.t < 1.6 && !p.hasDefuser && !(team === TEAM.DEF && game.planted)) {
    const a = Math.atan2(ai.heard.y - p.y, ai.heard.x - p.x);
    p.aim += Math.max(-dt * 3, Math.min(dt * 3, angDiff(a, p.aim)));
    inp.crouch = team === TEAM.DEF ? 1 : 0;
    return;
  }
  if (team === TEAM.ATK && !game.planted) {
    if (ai.startWait === undefined) ai.startWait = 2 + Math.random() * 7; // as if droning first
    if ((ai.startWait -= dt) > 0) { p.aim += dt * 0.5 * (ai.look || (ai.look = Math.random() < 0.5 ? -1 : 1)); return; }
    // close to the objective: walk (quiet), and now and then stop to check the angles
    if (Math.hypot(goal.x - p.x, goal.y - p.y) < 360) {
      inp.walk = 1;
      ai.pauseT = (ai.pauseT ?? 2 + Math.random() * 3) - dt;
      if (ai.pauseT < 0) { if (ai.pauseT < -(0.6 + Math.random())) ai.pauseT = 2 + Math.random() * 4; p.aim += dt * 1.2 * (ai.look || 1); return; }
    }
  }

  const gx = Math.floor(goal.x / CELL), gy = Math.floor(goal.y / CELL);
  const sx = Math.floor(p.x / CELL), sy = Math.floor(p.y / CELL);
  ai.pathT = (ai.pathT || 0) - dt;
  if (!ai.path || ai.pathT <= 0 || ai.goalK !== gy * map.W + gx) {
    ai.path = findPath(map, sx, sy, gx, gy) || []; ai.pathT = 1.2; ai.goalK = gy * map.W + gx;
  }
  { const i = ai.path.indexOf(sy * map.W + sx); if (i >= 0 && i < 6) ai.path.splice(0, i + 1); } // also skips the stair end after being carried to the other floor
  if (!ai.path.length) {
    if (Math.hypot(goal.x - p.x, goal.y - p.y) > 6) setDir(inp, goal.x - p.x, goal.y - p.y);
    else if (team === TEAM.DEF) { // hold an angle on the nearest way into the site
      if (!ai.watch) ai.watch = watchPoint(game, p);
      const a = ai.watch ? Math.atan2(ai.watch.y - p.y, ai.watch.x - p.x) : p.aim + dt;
      p.aim += Math.max(-dt * 2, Math.min(dt * 2, angDiff(a + Math.sin(game.time * 0.5 + p.x) * 0.25, p.aim)));
      inp.crouch = 1;
    }
    return;
  }
  const next = ai.path[0];
  const nx = (next % map.W + 0.5) * CELL, ny = (Math.floor(next / map.W) + 0.5) * CELL;
  const dirA = Math.atan2(ny - p.y, nx - p.x);
  p.aim += Math.max(-dt * 6, Math.min(dt * 6, angDiff(dirA, p.aim)));
  if (map.tiles[next] === T.BARRI || map.tiles[next] === T.SOFT || map.tiles[next] === T.PANEL) {
    if (Math.hypot(nx - p.x, ny - p.y) < 26) { p.aim = dirA; game.event(p, { k: 'melee' }); return; }
  }
  setDir(inp, nx - p.x, ny - p.y);
  // stuck? nudge
  if (Math.hypot(p.x - (ai.lx || 0), p.y - (ai.ly || 0)) < 0.5) { ai.stuck = (ai.stuck || 0) + dt; if (ai.stuck > 1) { ai.path = null; ai.stuck = 0; } }
  else ai.stuck = 0;
  ai.lx = p.x; ai.ly = p.y;
}

// a doorway or window of the defended site, the one nearest to this defender (to hold an angle on)
function watchPoint(game, p) {
  const m = game.map, site = m.sites[game.site];
  let best = null, bd = Infinity;
  for (const o of m.openings) {
    const k = o.cells[0], x = (k % m.W + 0.5) * CELL, y = (Math.floor(k / m.W) + 0.5) * CELL;
    const inSite = m.rooms.some(r => site.rooms.includes(r.name) && k % m.W >= r.x - 1 && k % m.W <= r.x + r.w && Math.floor(k / m.W) >= r.y - 1 && Math.floor(k / m.W) <= r.y + r.h);
    const d = Math.hypot(x - p.x, y - p.y);
    if (inSite && d < bd && d > 40 && los(m, p.x, p.y, x, y)) { bd = d; best = { x, y }; }
  }
  return best;
}

function nearBomb(game, site, d) {
  const b = site.bombs[Math.floor(Math.random() * site.bombs.length)];
  return game.freeSpotNear(b.x, b.y, d);
}

function setDir(inp, dx, dy) {
  const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
  inp.right = dx > 0.38 ? 1 : 0; inp.left = dx < -0.38 ? 1 : 0;
  inp.down = dy > 0.38 ? 1 : 0; inp.up = dy < -0.38 ? 1 : 0;
}
export const __findPath = (...a) => findPath(...a); // for tests
