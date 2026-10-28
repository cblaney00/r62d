// Simple computer players: they path to the objective, fight what they see,
// plant / defuse, and set up the site during preparation.
import { CELL, T, TEAM, PHASE, blocksMove } from '../shared/constants.js';
import { tileAt, los, angDiff } from '../shared/physics.js';
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
    if (t === T.BARRI) return 8;
    if (blocksMove(t)) return Infinity;
    // keep a little away from walls so the bot's body fits
    const x = k % W, y = (k / W) | 0;
    let near = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (blocksMove(tileAt(map, x + dx, y + dy)) && tileAt(map, x + dx, y + dy) !== T.BARRI) near++;
    return 1 + near * 0.6;
  };
  const push = (f, k) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const pi = (i - 1) >> 1; if (heap[pi][0] <= heap[i][0]) break; [heap[pi], heap[i]] = [heap[i], heap[pi]]; i = pi; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let s = i; if (l < heap.length && heap[l][0] < heap[s][0]) s = l; if (r < heap.length && heap[r][0] < heap[s][0]) s = r; if (s === i) break; [heap[s], heap[i]] = [heap[i], heap[s]]; i = s; } } return top; };
  let iter = 0;
  while (heap.length && iter++ < 6000) {
    const [, k] = pop();
    if (k === goal) break;
    if (closed[k]) continue; closed[k] = 1;
    const x = k % W, y = (k / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const nk = ny * W + nx;
      if (dx && dy && (blocksMove(map.tiles[y * W + nx]) || blocksMove(map.tiles[ny * W + x]))) continue;
      const c = cost(nk); if (c === Infinity) continue;
      const ng = g[k] + c * (dx && dy ? 1.414 : 1);
      if (ng < g[nk]) { g[nk] = ng; from[nk] = k; push(ng + Math.hypot(gx - nx, gy - ny), nk); }
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

export function botThink(game, p, dt) {
  const ai = p.ai;
  const inp = { up: 0, down: 0, left: 0, right: 0, sprint: 0, crouch: 0, fire: 0, ads: 0, interact: 0, ability: 0 };
  p.input = inp;
  if (!p.alive || p.ctrl !== 'body') return;
  if (game.phase === PHASE.PREP && game.side(p) === TEAM.ATK) return;
  const team = game.side(p), map = game.map, site = map.sites[game.site];
  const gun = p.guns[p.slot];

  // --- fight ---
  const enemy = p.downed ? null : visibleEnemy(game, p);
  if (enemy) {
    if (ai.seen !== enemy.id) { ai.seen = enemy.id; ai.react = -Math.random() * 0.35; ai.err = (Math.random() < 0.5 ? -1 : 1) * (0.25 + Math.random() * 0.35); }
    ai.react += dt; ai.err *= Math.exp(-dt * 1.3);
    ai.err += (Math.random() - 0.5) * dt * 0.6; // hands are never perfectly steady
    const want = Math.atan2(enemy.y - p.y, enemy.x - p.x) + ai.err;
    p.aim += Math.max(-dt * 7, Math.min(dt * 7, angDiff(want, p.aim)));
    inp.ads = 1;
    if (gun && gun.ammo === 0) game.startReload(p);
    else if (ai.react > 0.55 && Math.abs(angDiff(want, p.aim)) < 0.2) {
      const w = gun && WEAPONS[gun.w];
      inp.fire = w && !w.auto ? (ai.semi = !ai.semi) ? 1 : 0 : 1;
    }
    ai.strafeT = (ai.strafeT || 0) - dt;
    if (ai.strafeT <= 0) { ai.strafeT = 0.5 + Math.random(); ai.strafe = Math.random() < 0.5 ? -1 : 1; }
    const sa = p.aim + Math.PI / 2 * ai.strafe;
    setDir(inp, Math.cos(sa), Math.sin(sa));
    if (Math.random() < dt * 0.6) game.spot(team, enemy.id, 3);
    return;
  }
  ai.seen = null;
  if (gun && gun.ammo < WEAPONS[gun.w].mag * 0.3 && gun.reserve > 0) game.startReload(p);

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

  const gx = Math.floor(goal.x / CELL), gy = Math.floor(goal.y / CELL);
  const sx = Math.floor(p.x / CELL), sy = Math.floor(p.y / CELL);
  ai.pathT = (ai.pathT || 0) - dt;
  if (!ai.path || ai.pathT <= 0 || ai.goalK !== gy * map.W + gx) {
    ai.path = findPath(map, sx, sy, gx, gy) || []; ai.pathT = 1.2; ai.goalK = gy * map.W + gx;
  }
  while (ai.path.length && ai.path[0] === sy * map.W + sx) ai.path.shift();
  if (!ai.path.length) {
    if (Math.hypot(goal.x - p.x, goal.y - p.y) > 6) setDir(inp, goal.x - p.x, goal.y - p.y);
    else if (team === TEAM.DEF) { p.aim += dt * 0.6 * (ai.look || (ai.look = Math.random() < 0.5 ? -1 : 1)); inp.crouch = 1; }
    return;
  }
  const next = ai.path[0];
  const nx = (next % map.W + 0.5) * CELL, ny = (Math.floor(next / map.W) + 0.5) * CELL;
  const dirA = Math.atan2(ny - p.y, nx - p.x);
  p.aim += Math.max(-dt * 6, Math.min(dt * 6, angDiff(dirA, p.aim)));
  if (map.tiles[next] === T.BARRI) {
    if (Math.hypot(nx - p.x, ny - p.y) < 26) { p.aim = dirA; game.event(p, { k: 'melee' }); return; }
  }
  setDir(inp, nx - p.x, ny - p.y);
  // stuck? nudge
  if (Math.hypot(p.x - (ai.lx || 0), p.y - (ai.ly || 0)) < 0.5) { ai.stuck = (ai.stuck || 0) + dt; if (ai.stuck > 1) { ai.path = null; ai.stuck = 0; } }
  else ai.stuck = 0;
  ai.lx = p.x; ai.ly = p.y;
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
