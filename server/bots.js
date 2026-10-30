// Computer players. They are meant to feel like people: each one has a job for the round (a role, like a real
// team splits up: entry, support, flanker and intel on attack; anchors and roamers on defence) and a personality
// (how pushy and how patient), they use their operator's ability where a person would, revive and heal teammates,
// call out what they see, and react no faster than a fairly experienced player. The bot skill setting
// (game.botLevel, Easy / Normal / Hard / Expert) changes how fast they react and how well they aim, not what they know:
// they only know what they see, what they hear (running footsteps, gunfire, explosions) and what their team spots.
import { CELL, T, TEAM, PHASE, blocksMove } from '../shared/constants.js';
import { tileAt, los, angDiff, vaultable, castSight } from '../shared/physics.js';
import { floorAt, localPos, stairGhost, stairLooks } from '../shared/map.js';
import { OPERATORS, WEAPONS, opsForTeam, JOBS, jobOf } from '../shared/operators.js';

// Per skill level. react: seconds before the first shot at someone who surprised them (plus up to reactX more);
// expect: the same when they were already listening for that enemy. turn: how fast they swing their aim (radians/s).
// err: how far off the first aim is; settle: how fast it closes in. tol: how close the aim must be before they fire.
// see: how far they notice people (px). body: how widely their aim point wanders over the body (px).
const SKILL = [
  { react: 0.75, reactX: 0.5, expect: 0.45, turn: 3.2, err: 1.4, settle: 1.0, tol: 0.26, see: 520, body: 13, drone: 0.7 },  // Easy
  { react: 0.5, reactX: 0.35, expect: 0.3, turn: 4.5, err: 1.0, settle: 1.4, tol: 0.2, see: 650, body: 11, drone: 0.5 },     // Normal
  { react: 0.36, reactX: 0.24, expect: 0.22, turn: 6, err: 0.75, settle: 1.9, tol: 0.15, see: 720, body: 8, drone: 0.4 },    // Hard
  { react: 0.28, reactX: 0.14, expect: 0.18, turn: 7.5, err: 0.55, settle: 2.5, tol: 0.12, see: 780, body: 6, drone: 0.3 },  // Expert
];
const skill = (game, p) => SKILL[game.tut ? 0 : Math.max(0, Math.min(3, p.level ?? game.botLevel ?? 1))]; // p.level: a test can give one bot its own

// A bot's personality stays with it all match: aggr = how pushy, patience = how long it waits and watches.
function persona(p) {
  return p.persona || (p.persona = { aggr: Math.random(), patience: Math.random() });
}

// The job for this round. Bots on a side split the roles between them; the order shifts every round.
const ROLES = { [TEAM.ATK]: ['entry', 'support', 'flank', 'intel', 'entry'], [TEAM.DEF]: ['anchor', 'roamer', 'anchor', 'anchor', 'roamer'] };
function roleFor(game, p, team) {
  const mates = [...game.players.values()].filter(q => q.bot && game.side(q) === team).sort((a, b) => +a.id.slice(1) - +b.id.slice(1));
  const list = ROLES[team];
  return list[(Math.max(0, mates.indexOf(p)) + (game.round || 0)) % list.length];
}

export function botPickOp(game, p) {
  const team = game.side(p);
  const taken = new Set([...game.players.values()].filter(q => q.squad === p.squad && q.op).map(q => q.op));
  const free = opsForTeam(team).filter(o => !taken.has(o));
  if (!free.length) return;
  // he asked: bots lean toward roles nobody on the team has yet, so a team is roughly spread out (not strictly)
  const count = {};
  for (const q of game.players.values()) if (q !== p && q.squad === p.squad && (q.job || q.op)) { const j = q.job || jobOf(q.op); count[j] = (count[j] || 0) + 1; }
  const roles = JOBS[team].filter(j => j.ops.some(o => free.includes(o))).map(j => ({ j, w: 1 / Math.pow(1 + (count[j.id] || 0), 2.5) }));
  let r = Math.random() * roles.reduce((a, x) => a + x.w, 0), job = roles[roles.length - 1].j;
  for (const x of roles) if ((r -= x.w) <= 0) { job = x.j; break; }
  const pool = free.filter(o => job.ops.includes(o));
  game.pickOp(p, pool[Math.floor(Math.random() * pool.length)]);
}

// is cell k inside (or in the wall round) one of the site's rooms?
function siteTest(m, site) {
  const rs = m.rooms.filter(r => site.rooms.includes(r.name));
  return (x, y) => rs.some(r => x >= r.x - 1 && x <= r.x + r.w && y >= r.y - 1 && y <= r.y + r.h);
}
function inRoomOf(m, names, x, y) { return m.rooms.some(r => names.includes(r.name) && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h); }

// Defending bots fortify the site the moment preparation begins.
export function botPrep(game, p) {
  if (game.side(p) !== TEAM.DEF) return;
  const m = game.map, site = m.sites[game.site], W = m.W;
  const inSite = siteTest(m, site);
  const siteOpenings = m.openings.filter(o => o.cells.some(k => inSite(k % W, Math.floor(k / W))));
  const op = OPERATORS[p.op];
  for (const o of siteOpenings) if (p.barri > 0 && m.tiles[o.cells[0]] === T.OPEN && Math.random() < 0.6 && game.barricade(o.id, T.BARRI)) p.barri--; // 3 each, like a person
  // reinforce: hatches over the site first, then the site's breakable walls (outside-facing ones before the one
  // between the two site rooms), two each, like a team sharing out its reinforcements
  for (let n = 0; n < 2 && game.reinforce > 0; n++) {
    const h = (m.hatches || []).find(h => m.tiles[h.cells[0]] === T.HATCH && h.below.some(k => inRoomOf(m, site.rooms, k % W, Math.floor(k / W))));
    if (h) { game.reinforceHatch(h.id); game.reinforce--; continue; }
    let best = null, bs = -1;
    for (let k = 0; k < m.tiles.length; k++) {
      if (m.tiles[k] !== T.SOFT || !inSite(k % W, Math.floor(k / W)) || inRoomOf(m, site.rooms, k % W, Math.floor(k / W))) continue;
      const sides = [1, -1, W, -W].map(d => k + d).filter(q => m.tiles[q] === T.FLOOR || m.tiles[q] === T.GROUND);
      const inner = sides.filter(q => inRoomOf(m, site.rooms, q % W, Math.floor(q / W))).length;
      const score = (sides.length - inner > 0 ? 2 : 1) + Math.random() * 0.5; // a wall to the outside of the site beats the partner wall
      if (sides.length && inner && score > bs) { bs = score; best = k; }
    }
    if (best === null) break;
    game.reinforceWall(best); game.reinforce--;
  }
  const bomb = site.bombs[Math.floor(Math.random() * 2)];
  const near = (d) => game.freeSpotNear(bomb.x, bomb.y, d);
  const id = op.ability.id;
  if (id === 'panel') for (const o of siteOpenings.slice(0, 3)) { if (p.abilityCount > 0 && game.barricade(o.id, T.PANEL)) p.abilityCount--; }
  if (id === 'jammer') for (let i = 0; i < 2; i++) { const s = near(60); game.ents.push({ id: game.eid(), type: 'jammer', x: s.x, y: s.y, team: TEAM.DEF, owner: p.id, hp: 1 }); p.abilityCount--; }
  // traps by the site's doors and windows, eyes and ears around it
  const placeAt = (type, x, y, extra = {}) => { game.ents.push({ id: game.eid(), type, x, y, ang: Math.random() * 6.28, team: TEAM.DEF, owner: p.id, hp: 1, ...extra }); };
  const atOpening = i => { const o = siteOpenings[i % siteOpenings.length], k = o.cells[0]; return game.freeSpotNear((k % W + 0.5) * CELL, (Math.floor(k / W) + 0.5) * CELL, 18); };
  if (['prox', 'concuss', 'clamp'].includes(id) && siteOpenings.length) for (let i = 0; p.abilityCount > 0 && i < 3; i++) { const s = atOpening(i); placeAt(id, s.x, s.y, { arm: 0 }); p.abilityCount--; }
  if (id === 'sensor') while (p.abilityCount > 0) { const s = near(150); placeAt('sensor', s.x, s.y, { t: 0, pingT: 0 }); p.abilityCount--; }
  if (id === 'plates') { const s = near(30); placeAt('plates', s.x, s.y, { c: 5 }); p.abilityCount--; }
  if (id === 'turret' || id === 'stickycam') while (p.abilityCount > 0) {
    const s = near(100); placeAt('cam', s.x, s.y, { offUntil: 0, tu: id === 'turret' ? 1 : 0, ang: Math.atan2(s.y - bomb.y, s.x - bomb.x) }); p.abilityCount--;
  }
  if (id === 'grid') for (let k = 0; k < m.tiles.length && p.abilityCount > 0; k++) {
    if (m.tiles[k] !== T.REINF || !inSite(k % W, Math.floor(k / W)) || Math.random() < 0.6) continue;
    placeAt('grid', (k % W + 0.5) * CELL, (Math.floor(k / W) + 0.5) * CELL, { cell: k }); p.abilityCount--;
  }
  if (id === 'mine') for (const o of siteOpenings.slice(0, 2)) {
    const k = o.cells[0], s = game.freeSpotNear((k % W + 0.5) * CELL, (Math.floor(k / W) + 0.5) * CELL, 14);
    placeAt('mine', s.x, s.y, { ang: 0, arm: 0 }); p.abilityCount--;
  }
  // their gadget too: a claymore or barbed wire just inside a way into the site
  if ((p.gadget === 'claymore' || p.gadget === 'wire') && siteOpenings.length) {
    const i = Math.floor(Math.random() * siteOpenings.length), s = atOpening(i), k = siteOpenings[i].cells[0];
    const ang = Math.atan2((Math.floor(k / W) + 0.5) * CELL - s.y, (k % W + 0.5) * CELL - s.x);
    if (p.gadget === 'claymore') placeAt('claymore', s.x, s.y, { ang, arm: 0 }); else { delete s.hp; game.ents.push({ id: game.eid(), type: 'wire', x: s.x, y: s.y, ang, team: TEAM.DEF, owner: p.id }); }
    p.gadgetCount--;
  }
}

// ---- path finding (A* over cells; barricades are passable but costly) ----
// avoid: cells this bot found it can't vault over (too deep, nowhere to land)
function findPath(map, sx, sy, gx, gy, avoid) {
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
    if (avoid && avoid.has(k)) return Infinity;
    if (vaultable(map, k)) return t === T.LOW ? 10 : 4; // vault over it (low furniture only when it saves a long way round)
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

function visibleEnemy(game, p, see) {
  const team = game.side(p);
  const smokes = game.smokeList();
  let best = null, bd = Infinity;
  for (const q of game.players.values()) {
    if (!q.alive || game.side(q) === team || q.shrouded && Math.hypot(q.x - p.x, q.y - p.y) > 60) continue;
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d > see || d > bd) continue;
    const a = Math.atan2(q.y - p.y, q.x - p.x);
    if (d > 70 && Math.abs(angDiff(a, p.aim)) > 1.2) continue;
    if (!los(game.map, p.x, p.y, q.x, q.y, smokes)) continue;
    best = q; bd = d;
  }
  // up or down a staircase: someone on its steps or landing shows on this floor's steps too
  const fl = floorAt(game.map, p.x, p.y);
  for (const q of game.players.values()) {
    if (!q.alive || q.staged || game.side(q) === team || q.shrouded) continue;
    const gh = stairGhost(game.map, q.x, q.y);
    if (!gh || gh.fl !== fl || !stairLooks(game.map, gh.s, p.x, p.y)) continue;
    const d = Math.hypot(gh.x - p.x, gh.y - p.y);
    if (d > see || d > bd || (d > 70 && Math.abs(angDiff(Math.atan2(gh.y - p.y, gh.x - p.x), p.aim)) > 1.2)) continue;
    if (!los(game.map, p.x, p.y, gh.x, gh.y, smokes)) continue;
    const seen = Object.create(q); seen.x = gh.x; seen.y = gh.y; // the person, where they show
    best = seen; bd = d;
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
  const smokes = game.smokeList();
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

// An enemy gadget in plain sight that an Arc Gun can fry (cameras, traps, jammers...).
const TRAPS = new Set(['cam', 'prox', 'concuss', 'clamp', 'mine', 'claymore', 'sensor', 'jammer', 'grid', 'plates']);
function enemyGadget(game, p, reach) {
  const team = game.side(p);
  let best = null, bd = reach;
  for (const e of game.ents) {
    if (!TRAPS.has(e.type) || e.team === team || !e.hp) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < bd && floorAt(game.map, e.x, e.y) === floorAt(game.map, p.x, p.y) && los(game.map, p.x, p.y, e.x, e.y)) { bd = d; best = e; }
  }
  return best;
}

// A teammate who is down and can be reached: worth more than the objective (a reliable teammate picks people up).
function downedMate(game, p, team) {
  let best = null, bd = 320;
  for (const q of game.players.values()) {
    if (q === p || !q.alive || !q.downed || game.side(q) !== team) continue;
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < bd && floorAt(game.map, q.x, q.y) === floorAt(game.map, p.x, p.y)) { bd = d; best = q; }
  }
  return best;
}

// Turn toward an angle at most `rate` radians per second.
function turnTo(p, a, rate, dt) { p.aim += Math.max(-dt * rate, Math.min(dt * rate, angDiff(a, p.aim))); }
// Aim along an angle and set the throw point (grenades land where you aim, up to 300 px away).
function aimAt(p, x, y) {
  p.aim = Math.atan2(y - p.y, x - p.x);
  const d = Math.min(300, Math.hypot(x - p.x, y - p.y));
  p.aimX = p.x + Math.cos(p.aim) * d; p.aimY = p.y + Math.sin(p.aim) * d;
}
function shootInput(inp, ai, gun) { const w = gun && WEAPONS[gun.w]; inp.fire = w && !w.auto ? (ai.semi = !ai.semi) ? 1 : 0 : 1; }

// ---- breaching: attackers who carry something that opens walls pick a site wall and open it ----
// tool: which walls it can open, how it is used and how long to stand back afterwards.
const BREACH_TOOLS = {
  cutter: { types: [T.REINF, T.SOFT], use: 'ability', back: 6 },
  lance: { types: [T.REINF, T.SOFT], use: 'hold', back: 0 },
  cluster: { types: [T.SOFT], use: 'ability', back: 4 },
  hammer: { types: [T.SOFT], use: 'swing', back: 0 },
  scope: { types: [T.SOFT], use: 'ability', back: 0 },
  slug: { types: [T.SOFT], use: 'ability', back: 0 },
  breach: { types: [T.SOFT], use: 'gadget', back: 3.5 },
};
function breachTool(p) {
  const ab = OPERATORS[p.op].ability.id;
  if (BREACH_TOOLS[ab] && (p.abilityCount > 0 || ab === 'lance' && p.battery > 2)) return ab;
  if (p.gadget === 'breach' && p.gadgetCount > 0) return 'breach';
  return null;
}
// A wall cell round the site that this tool can open, with clear floor outside it to stand on; one bot per wall.
function planBreach(game, p, tool) {
  const m = game.map, W = m.W, site = m.sites[game.site], types = BREACH_TOOLS[tool].types;
  if (game.botClaimRound !== game.round) { game.botClaimRound = game.round; game.botClaims = new Set(); }
  const inSite = siteTest(m, site), fl = floorAt(m, p.x, p.y);
  let best = null, bd = Infinity;
  for (let k = W; k < m.tiles.length - W; k++) {
    if (!types.includes(m.tiles[k]) || m.shape[k] || !inSite(k % W, Math.floor(k / W)) || inRoomOf(m, site.rooms, k % W, Math.floor(k / W))) continue;
    if (game.botClaims.has(k) || game.botClaims.has(k - 1) || game.botClaims.has(k + 1) || game.botClaims.has(k - W) || game.botClaims.has(k + W)) continue;
    for (const d of [1, -1, W, -W]) {
      const inK = k + d, out = k - d, out2 = k - 2 * d;
      if (!inRoomOf(m, site.rooms, inK % W, Math.floor(inK / W))) continue;
      if (inRoomOf(m, site.rooms, out % W, Math.floor(out / W))) continue;
      const ok = q => m.tiles[q] === T.FLOOR || m.tiles[q] === T.GROUND;
      if (!ok(out) || !ok(out2)) continue;
      // a straight bit of wall (both neighbours along it are wall too), so the hole is a doorway, not a corner
      const along = d === 1 || d === -1 ? W : 1;
      if (![k + along, k - along].every(q => [T.SOFT, T.REINF, T.HARD].includes(m.tiles[q]))) continue;
      const sx = (out % W + 0.5) * CELL, sy = (Math.floor(out / W) + 0.5) * CELL;
      const dist = Math.hypot(sx - p.x, sy - p.y) + (floorAt(m, sx, sy) !== fl ? 400 : 0) + (m.tiles[k] === T.REINF ? -150 : 0);
      if (dist < bd) { bd = dist; best = { k, d, sx, sy, wx: (k % W + 0.5) * CELL, wy: (Math.floor(k / W) + 0.5) * CELL }; }
    }
  }
  // nothing left on the site itself (defenders reinforced it all): open a breakable wall next to the site instead,
  // for a new way in or a line of sight onto it, from whichever side this bot is on
  if (!best) {
    const b = site.bombs[0];
    for (let k = W; k < m.tiles.length - W; k++) {
      if (!types.includes(m.tiles[k]) || m.shape[k] || game.botClaims.has(k)) continue;
      const wx = (k % W + 0.5) * CELL, wy = (Math.floor(k / W) + 0.5) * CELL;
      if (floorAt(m, wx, wy) !== floorAt(m, b.x, b.y) || Math.hypot(wx - b.x, wy - b.y) > 320) continue;
      for (const d of [1, -1, W, -W]) {
        const out = k - d, out2 = k - 2 * d, inK = k + d, along = d === 1 || d === -1 ? W : 1;
        const ok = q => m.tiles[q] === T.FLOOR || m.tiles[q] === T.GROUND;
        if (!ok(out) || !ok(out2) || !ok(inK) || ![k + along, k - along].every(q => [T.SOFT, T.REINF, T.HARD].includes(m.tiles[q]))) continue;
        const sx = (out % W + 0.5) * CELL, sy = (Math.floor(out / W) + 0.5) * CELL;
        if (Math.hypot((inK % W + 0.5) * CELL - b.x, (Math.floor(inK / W) + 0.5) * CELL - b.y) > Math.hypot(sx - b.x, sy - b.y)) continue; // stand on the far side from the site
        const dist = Math.hypot(sx - p.x, sy - p.y) + (floorAt(m, sx, sy) !== fl ? 400 : 0);
        if (dist < bd) { bd = dist; best = { k, d, sx, sy, wx, wy }; }
      }
    }
  }
  if (best) game.botClaims.add(best.k);
  return best;
}

// A spot in a room near (but not in) the site, for a roaming defender; and the nearest way into that room to watch.
function roamSpot(game, p) {
  const m = game.map, site = m.sites[game.site], b = site.bombs[0], bl = localPos(m, b.x, b.y);
  const list = m.rooms.filter(r => !site.rooms.includes(r.name) && r.w * r.h >= 20).filter(r => {
    const c = localPos(m, (r.x + r.w / 2) * CELL, (r.y + r.h / 2) * CELL);
    return Math.hypot(c.x - bl.x, c.y - bl.y) < 560 && Math.abs(c.f - bl.f) <= 1;
  });
  if (!list.length) return null;
  const r = list[Math.floor(Math.random() * list.length)];
  return game.freeSpotNear((r.x + r.w / 2) * CELL, (r.y + r.h / 2) * CELL, Math.min(r.w, r.h) * CELL * 0.3);
}

export function botThink(game, p, dt) {
  const ai = p.ai;
  const inp = { up: 0, down: 0, left: 0, right: 0, walk: 0, crouch: 0, fire: 0, ads: 0, interact: 0, ability: 0 };
  p.input = inp;
  if (!p.alive || p.ctrl !== 'body') return;
  if (game.phase === PHASE.PREP && game.side(p) === TEAM.ATK) return;
  const team = game.side(p), map = game.map, site = map.sites[game.site], S = skill(game, p), me = persona(p);
  const gun = p.guns[p.slot];
  const action = game.phase === PHASE.ACTION;
  if (!ai.role) ai.role = roleFor(game, p, team);
  const abId = OPERATORS[p.op].ability.id;
  const useAbility = () => game.event(p, { k: 'ability' });

  // --- hearing: the most recent enemy noise this bot could hear ---
  for (const n of game.noises || []) {
    if (n.team === team || game.time - n.t > 1.5 || (ai.heard && ai.heard.t >= n.t)) continue;
    const r = n.r * (floorAt(map, n.x, n.y) === floorAt(map, p.x, p.y) ? 1 : 0.5);
    if (Math.hypot(n.x - p.x, n.y - p.y) < r) ai.heard = { x: n.x, y: n.y, t: n.t };
  }
  // --- team intel: an enemy a teammate (or camera) spotted close by is worth turning to face, once in a while ---
  if (!ai.heard || game.time - ai.heard.t > 3) for (const id of game.spots[team].keys()) {
    const q = game.players.get(id); if (!q || !q.alive) continue;
    ai.spotT = ai.spotT || {};
    if (game.time - (ai.spotT[id] || -99) < 8 || Math.hypot(q.x - p.x, q.y - p.y) > 420 || floorAt(map, q.x, q.y) !== floorAt(map, p.x, p.y)) continue;
    ai.spotT[id] = game.time; ai.heard = { x: q.x, y: q.y, t: game.time }; break;
  }
  const heardRecently = ai.heard && game.time - ai.heard.t < 4;

  // --- held abilities: let go unless something below holds them again ---
  if (abId === 'shroud') inp.ability = heardRecently && p.battery > 1.5 && !p.downed ? 1 : 0; // go dark while enemies are close by
  if (abId === 'scan' && action && !p.downed) { // a few seconds of scanning when something is heard, or every so often
    ai.scanT = (ai.scanT ?? 8 + Math.random() * 10) - dt;
    if ((heardRecently || ai.scanT < 0) && p.battery > 1) { inp.ability = 1; if (ai.scanT < -3) ai.scanT = 15 + Math.random() * 15; }
  }

  // --- fight ---
  const enemy = p.downed ? null : visibleEnemy(game, p, S.see);
  if (enemy && abId === 'adrenal' && p.abilityCount > 0 && !(game.time < (p.boostUntil || 0))) useAbility();
  if (enemy) {
    const d = Math.hypot(enemy.x - p.x, enemy.y - p.y);
    if (ai.seen !== enemy.id) { // a surprise takes longer to react to than something they were listening for
      const expected = heardRecently && Math.hypot(ai.heard.x - enemy.x, ai.heard.y - enemy.y) < 200;
      ai.seen = enemy.id; ai.ox = (Math.random() - 0.5) * S.body; ai.oy = (Math.random() - 0.5) * S.body;
      ai.react = -(expected ? S.expect : S.react) - Math.random() * S.reactX * (expected ? 0.6 : 1);
      ai.err = (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.4) * S.err;
      ai.called = false;
      if (game.tut) { ai.react -= 0.7; ai.err *= 1.8; } // tutorial bots are slow and shaky, so a beginner can win
    }
    ai.react += dt; ai.err *= Math.exp(-dt * S.settle);
    ai.err += (Math.random() - 0.5) * dt * 0.6; // hands are never perfectly steady
    const want = Math.atan2(enemy.y + (ai.oy || 0) - p.y, enemy.x + (ai.ox || 0) - p.x) + ai.err; // somewhere on the body, not always the head
    turnTo(p, want, S.turn, dt);
    inp.ads = 1;
    // call it out to the team once they've taken it in (a ping with the operator's name and the room)
    if (!ai.called && ai.react > -0.1) {
      ai.called = true; game.spot(team, enemy.id, 3);
      if ([...game.players.values()].some(q => !q.bot && q.squad === p.squad) && game.markOk(p)) game.mark(p, enemy.x, enemy.y, 'ENEMY ' + OPERATORS[enemy.op].name, enemy.id);
    }
    if (gun && gun.ammo === 0) { game.startReload(p); if (d < 120 && p.guns[1] && p.slot === 0 && gun.reserve >= 0) game.event(p, { k: 'slot', n: 1 }); }
    // a shield facing us: circle round it and only shoot once its side shows (as people do)
    if (p.bracing && d < 32) { p.aim = Math.atan2(enemy.y - p.y, enemy.x - p.x); game.event(p, { k: 'melee' }); return; } // shield bash
    if (p.bracing && Math.random() < dt * 0.8) inp.ability = 1; // now and then put the shield away to shoot
    if (!p.bracing && abId === 'brace' && d < 45 && Math.random() < dt) inp.ability = 1;
    const shieldUp = enemy.bracing && !enemy.downed && Math.abs(angDiff(Math.atan2(p.y - enemy.y, p.x - enemy.x), enemy.aim)) < 0.8;
    if (shieldUp && d < 26) { p.aim = Math.atan2(enemy.y - p.y, enemy.x - p.x); game.event(p, { k: 'melee' }); return; } // knock the shield aside
    if (shieldUp && !(game.time < (enemy.shieldDownUntil || 0))) { ai.strafe = ai.strafe || (Math.random() < 0.5 ? -1 : 1); const sa = Math.atan2(enemy.y - p.y, enemy.x - p.x) + Math.PI / 2 * ai.strafe; setDir(inp, Math.cos(sa), Math.sin(sa)); return; }
    else if (ai.react > 0 && Math.abs(angDiff(want, p.aim)) < S.tol) shootInput(inp, ai, gun);
    // the arc gun zaps a defender in reach as well as gadgets
    if (abId === 'arc' && p.abilityCount > 0 && ai.react > 0 && d < 300 && Math.abs(angDiff(want, p.aim)) < 0.1 && Math.random() < dt * 0.5) useAbility();
    ai.strafeT = (ai.strafeT || 0) - dt;
    if (ai.strafeT <= 0) { ai.strafeT = 0.6 + Math.random(); ai.strafe = Math.random() < 0.55 - me.aggr * 0.2 ? 0 : Math.random() < 0.5 ? -1 : 1; } // often just stand and shoot
    if (ai.strafe) { const sa = p.aim + Math.PI / 2 * ai.strafe; setDir(inp, Math.cos(sa), Math.sin(sa)); inp.walk = 1; }
    return;
  }
  ai.seen = null;
  if (gun && gun.ammo < WEAPONS[gun.w].mag * 0.3 && gun.reserve > 0) game.startReload(p);
  if (p.slot !== 0 && p.guns[0] && p.guns[0].ammo + p.guns[0].reserve > 0) game.event(p, { k: 'slot', n: 0 }); // back to the main gun once it's quiet

  // --- an enemy drone in sight: turn and shoot it (one hit breaks it) ---
  const drone = p.downed ? null : enemyDrone(game, p);
  if (drone) {
    if (ai.droneSeen !== drone.id) { ai.droneSeen = drone.id; ai.droneReact = -S.drone - Math.random() * 0.4; }
    ai.droneReact += dt;
    const want = Math.atan2(drone.y - p.y, drone.x - p.x);
    turnTo(p, want, S.turn, dt);
    inp.ads = 1; inp.crouch = 1;
    if (gun && gun.ammo === 0) game.startReload(p);
    else if (ai.droneReact > 0 && Math.abs(angDiff(want, p.aim)) < 0.08) shootInput(inp, ai, gun);
    return;
  }
  ai.droneSeen = null;
  if (p.downed) return;

  // --- an enemy gadget in sight and an arc gun in hand: zap it ---
  if (abId === 'arc' && p.abilityCount > 0 && action) {
    const g = enemyGadget(game, p, 340);
    if (g) { const a = Math.atan2(g.y - p.y, g.x - p.x); turnTo(p, a, S.turn, dt); if (Math.abs(angDiff(a, p.aim)) < 0.05) useAbility(); return; }
  }

  // --- a teammate is down: heal them from range with a stim, or go and pick them up ---
  const mate = action || game.phase === PHASE.PREP ? downedMate(game, p, team) : null;
  if (mate) {
    const d = Math.hypot(mate.x - p.x, mate.y - p.y);
    if (abId === 'stim' && p.abilityCount > 0 && d < 380 && los(map, p.x, p.y, mate.x, mate.y)) {
      const a = Math.atan2(mate.y - p.y, mate.x - p.x); turnTo(p, a, S.turn, dt);
      if (Math.abs(angDiff(a, p.aim)) < 0.04) useAbility();
      return;
    }
    if (d < 20) { p.aim = Math.atan2(mate.y - p.y, mate.x - p.x); inp.interact = 1; inp.crouch = 1; return; }
    return moveTo(game, p, inp, mate, dt);
  }
  if (abId === 'stim' && p.abilityCount > 1 && p.hp < 45 && action) { useAbility(); return; } // patch yourself up (the dart lands on you when no teammate is in line)

  // --- objective ---
  let goal = null, act = null;
  const atk = team === TEAM.ATK;
  if (atk) {
    const item = game.ents.find(e => e.type === 'defuser');
    if (game.planted) goal = ai.guard || (ai.guard = game.freeSpotNear(game.planted.x, game.planted.y, 70));
    else if (p.hasDefuser) {
      const b = ai.bomb || (ai.bomb = site.bombs[Math.floor(Math.random() * 2)]);
      goal = b; const bd = Math.hypot(b.x - p.x, b.y - p.y);
      if (bd < 24) act = 'plant';
      // smoke the plant: a smoke barrage or smoke grenade toward where the enemy was last heard (or into the room)
      if (bd < 70 && !ai.smoked) {
        ai.smoked = true;
        const t = heardRecently ? ai.heard : { x: b.x + (b.x - p.x) * 3, y: b.y + (b.y - p.y) * 3 };
        if (abId === 'barrage' && p.abilityCount > 0) { aimAt(p, t.x, t.y); useAbility(); }
        else if (p.gadget === 'smoke' && p.gadgetCount > 0) { aimAt(p, t.x, t.y); game.event(p, { k: 'gadget' }); }
      }
    } else if (item) goal = item;
    else goal = ai.push || (ai.push = nearBomb(game, site, 60));
  } else {
    if (game.planted) { goal = game.planted; if (Math.hypot(goal.x - p.x, goal.y - p.y) < 24) act = 'defuse'; }
    else goal = ai.hold || (ai.hold = nearBomb(game, site, 70));
  }
  if (act) { inp.interact = 1; inp.crouch = 1; return; }
  if (!goal) return;
  const toGoal = Math.hypot(goal.x - p.x, goal.y - p.y);

  // --- defensive gas: throw it at a noise near the site, set it off when someone walks in ---
  if (!atk && abId === 'gas' && action) {
    if (p.gasId) { const g = game.ent(p.gasId); if (g && [...game.players.values()].some(q => q.alive && game.side(q) !== team && Math.hypot(q.x - g.x, q.y - g.y) < 70)) useAbility(); }
    else if (p.abilityCount > 0 && heardRecently && Math.hypot(ai.heard.x - p.x, ai.heard.y - p.y) < 280 && los(map, p.x, p.y, ai.heard.x, ai.heard.y)) { aimAt(p, ai.heard.x, ai.heard.y); useAbility(); }
  }

  // a defender's remote charge works the same way: thrown at a noise, set off when someone is beside it
  if (!atk && p.gadget === 'nitro' && action) {
    if (p.nitroId) { const g = game.ent(p.nitroId); if (g && [...game.players.values()].some(q => q.alive && game.side(q) !== team && Math.hypot(q.x - g.x, q.y - g.y) < 45)) game.event(p, { k: 'gadget' }); }
    else if (p.gadgetCount > 0 && heardRecently && Math.hypot(ai.heard.x - p.x, ai.heard.y - p.y) < 240 && Math.hypot(ai.heard.x - p.x, ai.heard.y - p.y) > 90 && los(map, p.x, p.y, ai.heard.x, ai.heard.y)) { aimAt(p, ai.heard.x, ai.heard.y); game.event(p, { k: 'gadget' }); }
  }

  // heard something and can't see it: stop, turn to face it and listen for a moment (pushy bots don't stop as long)
  if (heardRecently && game.time - ai.heard.t < 1.6 - me.aggr * 0.6 && !p.hasDefuser && !(team === TEAM.DEF && game.planted)) {
    turnTo(p, Math.atan2(ai.heard.y - p.y, ai.heard.x - p.x), 3, dt);
    inp.crouch = atk ? 0 : 1;
    const hd = Math.hypot(ai.heard.x - p.x, ai.heard.y - p.y);
    // a smoke barrage between us and a noise close by
    if (atk && action && abId === 'barrage' && p.abilityCount > 0 && hd > 90 && hd < 300 && Math.random() < dt * 0.5) { aimAt(p, ai.heard.x, ai.heard.y); useAbility(); }
    // a grenade at a noise close by, now and then
    if (atk && action && ['frag', 'stun'].includes(p.gadget) && p.gadgetCount > 0 && hd > 60 && hd < 260 && !ai.nadeT && Math.random() < dt * 0.6) {
      ai.nadeT = 1; aimAt(p, ai.heard.x, ai.heard.y); game.event(p, { k: 'gadget' });
    }
    return;
  }

  if (atk && !game.planted) {
    // the first seconds of the action: watching drones, longer for patient bots and intel players
    if (ai.startWait === undefined) {
      const base = { entry: [1, 3], support: [4, 4], flank: [3, 4], intel: [7, 5] }[ai.role] || [2, 6];
      ai.startWait = base[0] + Math.random() * base[1] * (0.5 + me.patience);
    }
    if ((ai.startWait -= dt) > 0) { p.aim += dt * 0.5 * (ai.look || (ai.look = Math.random() < 0.5 ? -1 : 1)); return; }
    // abilities on the way in
    if (action && p.abilityCount > 0) {
      if (abId === 'ghost' && toGoal < 450 && !(game.time < (p.ghostUntil || 0))) useAbility();
      if ((abId === 'sonar' || abId === 'emp') && toGoal < 330 && toGoal > 80 && Math.random() < dt * 0.5) { aimAt(p, goal.x, goal.y); if (castSight(map, p.x, p.y, p.aim, 200, null) > 90) useAbility(); }
      if (abId === 'dart' && toGoal < 400 && Math.random() < dt * 0.3) { aimAt(p, goal.x, goal.y); useAbility(); }
      if (abId === 'decoy' && toGoal < 260 && Math.random() < dt * 0.4) { aimAt(p, goal.x, goal.y); useAbility(); }
    }
    // a breaching tool: open a site wall first (a hard breacher a reinforced one), then go in through it
    if (action && ai.breach === undefined) { const tool = breachTool(p); ai.breach = tool && ai.role !== 'intel' ? planBreach(game, p, tool) : null; if (ai.breach) ai.breach.tool = tool; }
    if (ai.breach) { const r = doBreach(game, p, inp, ai.breach, dt); if (r !== 'done') return; ai.breach = null; }
    // a flanker goes round to the far side of the site first
    if (ai.role === 'flank' && !ai.flanked) {
      ai.flank = ai.flank || flankPoint(game, p, site);
      if (!ai.flank || Math.hypot(ai.flank.x - p.x, ai.flank.y - p.y) < 30) ai.flanked = true;
      else return moveTo(game, p, inp, ai.flank, dt);
    }
    // support stays a few steps behind the nearest teammate until they're near the site
    if (ai.role === 'support' && !ai.supportDone) {
      const lead = [...game.players.values()].filter(q => q !== p && q.alive && !q.downed && game.side(q) === team).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      if (!lead || Math.hypot(lead.x - goal.x, lead.y - goal.y) < 300 || toGoal < 300) ai.supportDone = true;
      else if (Math.hypot(lead.x - p.x, lead.y - p.y) > 70) return moveTo(game, p, inp, lead, dt);
      else { turnTo(p, lead.aim, 2, dt); return; }
    }
    // close to the objective: walk (quiet), and now and then stop to check the angles
    if (toGoal < (ai.role === 'entry' ? 220 : 360) - me.aggr * 80) {
      inp.walk = 1;
      ai.pauseT = (ai.pauseT ?? 2 + Math.random() * 3) - dt;
      if (ai.pauseT < 0) { if (ai.pauseT < -(0.4 + me.patience)) ai.pauseT = 2 + Math.random() * 4; p.aim += dt * 1.2 * (ai.look || 1); return; }
    }
    // an entry fragger throws a stun into the site just before going in
    if (action && ai.role === 'entry' && p.gadget === 'stun' && p.gadgetCount > 0 && toGoal < 200 && !ai.stunned && los(map, p.x, p.y, goal.x, goal.y)) { ai.stunned = true; aimAt(p, goal.x, goal.y); game.event(p, { k: 'gadget' }); }
  }

  // a roaming defender spends the first part of the round in rooms around the site, then falls back to it
  if (!atk && ai.role === 'roamer' && action && !game.planted) {
    ai.roamFor = ai.roamFor ?? 50 + me.aggr * 70;
    ai.roamFor -= dt;
    if (ai.roamFor > 0) {
      ai.roamT = (ai.roamT || 0) - dt;
      if (!ai.roam || ai.roamT <= 0) { ai.roam = roamSpot(game, p); ai.roamT = 14 + Math.random() * 14; ai.watch = null; }
      if (ai.roam) return moveTo(game, p, inp, ai.roam, dt, true);
    }
  }

  return moveTo(game, p, inp, goal, dt, !atk);
}

// Open the planned wall: walk to the spot outside it, face it, use the tool, stand back while it goes off.
function doBreach(game, p, inp, b, dt) {
  const map = game.map, ai = p.ai, tool = BREACH_TOOLS[b.tool];
  if (b.backUntil) { // charge placed: wait a few steps back from it
    if (game.time > b.backUntil) return 'done';
    const away = { x: b.sx - (b.wx - b.sx) * 3, y: b.sy - (b.wy - b.sy) * 3 };
    if (Math.hypot(away.x - p.x, away.y - p.y) > 8) moveTo(game, p, inp, away, dt);
    else p.aim = Math.atan2(b.wy - p.y, b.wx - p.x);
    return 'wait';
  }
  if (!tool.types.includes(map.tiles[b.k]) && !(b.tool === 'scope' && b.used)) return 'done'; // gone already (or someone else opened it)
  if (b.tool === 'scope' && b.used) return 'done';
  if (Math.hypot(b.sx - p.x, b.sy - p.y) > 6) { b.t = (b.t || 0) + dt; if (b.t > 25) return 'done'; return moveTo(game, p, inp, { x: b.sx, y: b.sy }, dt); }
  p.aim = Math.atan2(b.wy - p.y, b.wx - p.x);
  if (tool.use === 'hold') { inp.ability = 1; b.held = (b.held || 0) + dt; return b.held > 4.5 || p.battery <= 0 ? 'done' : 'wait'; }
  if (tool.use === 'swing') { if (p.meleeCd <= 0 && p.abilityCount > 0) game.event(p, { k: 'ability' }); return p.abilityCount > 0 ? 'wait' : 'done'; }
  const before = tool.use === 'gadget' ? p.gadgetCount : p.abilityCount;
  game.event(p, { k: tool.use });
  const after = tool.use === 'gadget' ? p.gadgetCount : p.abilityCount;
  if (after === before) { b.fails = (b.fails || 0) + 1; return b.fails > 20 ? 'done' : 'wait'; }
  b.used = true;
  if (!tool.back) return 'done';
  b.backUntil = game.time + tool.back; return 'wait';
}

// A spot outside the site's way in that is furthest from where the attackers come from.
function flankPoint(game, p, site) {
  const m = game.map, W = m.W, inSite = siteTest(m, site), b = site.bombs[0];
  let best = null, bd = -1;
  for (const o of m.openings) {
    const k = o.cells[0], x = k % W, y = Math.floor(k / W);
    if (!inSite(x, y) || floorAt(m, (x + 0.5) * CELL, (y + 0.5) * CELL) !== floorAt(m, b.x, b.y)) continue;
    // stand two cells outside the opening (the side away from the site)
    for (const d of [1, -1, W, -W]) {
      const out = k - 2 * d;
      if (inRoomOf(m, site.rooms, (k + d) % W, Math.floor((k + d) / W)) && (m.tiles[out] === T.FLOOR || m.tiles[out] === T.GROUND)) {
        const sx = (out % W + 0.5) * CELL, sy = (Math.floor(out / W) + 0.5) * CELL, dd = Math.hypot(sx - p.x, sy - p.y);
        if (dd > bd) { bd = dd; best = { x: sx, y: sy }; }
      }
    }
  }
  return best;
}

// Walk along a path to a goal; once there, a defender (or anyone told to hold) watches the nearest way in.
function moveTo(game, p, inp, goal, dt, hold = false) {
  const ai = p.ai, map = game.map, team = game.side(p);
  const gx = Math.floor(goal.x / CELL), gy = Math.floor(goal.y / CELL);
  const sx = Math.floor(p.x / CELL), sy = Math.floor(p.y / CELL);
  ai.pathT = (ai.pathT || 0) - dt;
  if (!ai.path || ai.pathT <= 0 || ai.goalK !== gy * map.W + gx) {
    ai.path = findPath(map, sx, sy, gx, gy, ai.noVault) || []; ai.pathT = 1.2; ai.goalK = gy * map.W + gx;
  }
  { const i = ai.path.indexOf(sy * map.W + sx); if (i >= 0 && i < 6) ai.path.splice(0, i + 1); } // also skips the stair end after being carried to the other floor
  if (!ai.path.length) {
    if (Math.hypot(goal.x - p.x, goal.y - p.y) > 6) setDir(inp, goal.x - p.x, goal.y - p.y);
    else if (hold) { // hold an angle on the nearest way in
      if (!ai.watch) ai.watch = watchPoint(game, p) || { x: p.x + Math.cos(p.aim) * 50, y: p.y + Math.sin(p.aim) * 50 };
      const a = Math.atan2(ai.watch.y - p.y, ai.watch.x - p.x);
      turnTo(p, a + Math.sin(game.time * 0.5 + p.x) * 0.25, 2, dt);
      inp.crouch = team === TEAM.DEF || persona(p).patience > 0.5 ? 1 : 0;
    }
    return;
  }
  const next = ai.path[0];
  const nx = (next % map.W + 0.5) * CELL, ny = (Math.floor(next / map.W) + 0.5) * CELL;
  const dirA = Math.atan2(ny - p.y, nx - p.x);
  turnTo(p, dirA, 6, dt);
  if (vaultable(map, next) && Math.hypot(nx - p.x, ny - p.y) < 24) { // climb over it, or note it can't be done and go round
    if (!game.startVault(p, dirA)) { (ai.noVault || (ai.noVault = new Set())).add(next); ai.path = null; }
    return;
  }
  if (map.tiles[next] === T.BARRI || map.tiles[next] === T.SOFT || map.tiles[next] === T.PANEL) {
    if (Math.hypot(nx - p.x, ny - p.y) < 26) { p.aim = dirA; game.event(p, { k: 'melee' }); return; }
  }
  setDir(inp, nx - p.x, ny - p.y);
  // stuck? nudge
  if (Math.hypot(p.x - (ai.lx || 0), p.y - (ai.ly || 0)) < 0.5) { ai.stuck = (ai.stuck || 0) + dt; if (ai.stuck > 1) { ai.path = null; ai.stuck = 0; } }
  else ai.stuck = 0;
  ai.lx = p.x; ai.ly = p.y;
}

// the doorway or window nearest to this bot that it can see (to hold an angle on): the site's own when defending it
function watchPoint(game, p) {
  const m = game.map, site = m.sites[game.site], W = m.W;
  const inSite = siteTest(m, site), atSite = inRoomOf(m, site.rooms, Math.floor(p.x / CELL), Math.floor(p.y / CELL));
  let best = null, bd = Infinity;
  for (const o of m.openings) {
    const k = o.cells[0], x = (k % W + 0.5) * CELL, y = (Math.floor(k / W) + 0.5) * CELL;
    if (atSite && !inSite(k % W, Math.floor(k / W))) continue;
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < bd && d > 40 && d < 400 && los(m, p.x, p.y, x, y)) { bd = d; best = { x, y }; }
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
