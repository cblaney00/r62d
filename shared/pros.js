// The pro teams (he asked: 10 bots that play like professional R62D players in a tournament, the test subjects for
// game tests). Two esports-style teams of five, each player specialising in one job per side, with their own
// operator pool, strengths and flaws. And each team's playbook: set plans for every map, site and side, worked out
// from the map itself (its site rooms, doors and windows, breakable walls, hatches and spawns), so every map has
// plans. Used by the server (the pros run these plans) and by the PLAYBOOK menu page (to study them).
import { CELL, T, blocksMove } from './constants.js';
import { JOBS, jobOf } from './operators.js';
import { los } from './physics.js';

// react: seconds to the first shot at a surprise (a person: ~0.2-0.3 s); aim: how far off the first aim is (lower is
// better); turn: how fast they swing (rad/s, before overshoot); over: how much they overshoot a flick (0-1);
// calm: how little pressure shakes them (0-1); traits: what they are known for, flaws included.
export const PRO_TEAMS = [
  {
    id: 'nwd', tag: 'NWD', name: 'Northwind', colour: '#5ec8ff',
    style: 'Fast and aggressive. They hit before the defenders are set, trade kills tight and win on speed and surprise.',
    prefer: { atk: ['fast', 'split', 'window', 'pinch', 'default', 'vertical', 'lurk', 'fake', 'late'], def: ['roam', 'bait', 'hold', 'hunter', 'cross', 'vert', 'tworooms', 'retake', 'turtle'] },
    players: [
      { name: 'Halden', igl: true, jobs: { atk: 'support', def: 'anchor' }, pool: { atk: ['talon', 'volt', 'haze'], def: ['mason', 'shunt', 'girder'] },
        react: 0.23, aim: 0.6, turn: 10, over: 0.2, calm: 0.85, traits: ['In-game leader: calls the plan and the switches', 'Very calm in clutches', 'Slow to rotate: trusts his read too long'] },
      { name: 'Kaze', jobs: { atk: 'entry', def: 'roamer' }, pool: { atk: ['brisk', 'rush', 'blaze'], def: ['wraith', 'hush', 'hound'] },
        react: 0.19, aim: 0.7, turn: 12, over: 0.35, calm: 0.5, traits: ['Fastest reactions on the team', 'Takes first contact every round', 'Over-peeks: swings wide and gets traded'] },
      { name: 'Brick', jobs: { atk: 'breach', def: 'trapper' }, pool: { atk: ['ember', 'rivet', 'hammer'], def: ['lynx', 'bramble', 'snare'] },
        react: 0.25, aim: 0.58, turn: 9, over: 0.25, calm: 0.7, traits: ['Opens the wall right on time', 'Great with gadgets and traps', 'Tunnel vision once a fight starts'] },
      { name: 'Moth', jobs: { atk: 'intel', def: 'intel' }, pool: { atk: ['kestrel', 'glint', 'echo'], def: ['kite', 'argus', 'lens'] },
        react: 0.24, aim: 0.62, turn: 10, over: 0.25, calm: 0.75, traits: ['Best droner on the team: keeps a drone alive all round', 'Calls out everything', 'Passive: late into fights'] },
      { name: 'Juno', jobs: { atk: 'flank', def: 'support' }, pool: { atk: ['strider', 'wren', 'crow'], def: ['solace', 'tonic', 'ward'] },
        react: 0.22, aim: 0.5, turn: 11, over: 0.2, calm: 0.9, traits: ['Ice-cold clutch player', 'Cuts off rotations on the flank', 'Lurks a little too long'] },
    ],
  },
  {
    id: 'irc', tag: 'IRC', name: 'Ironclad Collective', colour: '#f2a65a',
    style: 'Slow and methodical. Full droning, utility before every push, crossfires on defence; they win the last minute.',
    prefer: { atk: ['default', 'late', 'vertical', 'pinch', 'fake', 'lurk', 'split', 'window', 'fast'], def: ['hold', 'cross', 'turtle', 'tworooms', 'retake', 'vert', 'bait', 'hunter', 'roam'] },
    players: [
      { name: 'Sable', igl: true, jobs: { atk: 'intel', def: 'intel' }, pool: { atk: ['glint', 'kestrel', 'mark'], def: ['argus', 'kite', 'audit'] },
        react: 0.24, aim: 0.56, turn: 10, over: 0.2, calm: 0.9, traits: ['In-game leader who plays from information', 'Reads rotations early', 'Slow: sometimes runs the clock too low'] },
      { name: 'Torvi', jobs: { atk: 'entry', def: 'roamer' }, pool: { atk: ['blaze', 'brisk', 'rush'], def: ['hush', 'hound', 'ruse'] },
        react: 0.2, aim: 0.66, turn: 12, over: 0.35, calm: 0.55, traits: ['Explosive entry fragger', 'Plays off his flashes', 'Over-peeks when ahead'] },
      { name: 'Pax', jobs: { atk: 'support', def: 'support' }, pool: { atk: ['haze', 'talon', 'patch'], def: ['ward', 'tonic', 'solace'] },
        react: 0.25, aim: 0.6, turn: 9, over: 0.25, calm: 0.45, traits: ['Utility for every push', 'Always there for the trade', 'Nervous: shaky aim under pressure'] },
      { name: 'Grit', jobs: { atk: 'breach', def: 'anchor' }, pool: { atk: ['rivet', 'ember', 'ferro'], def: ['solder', 'mason', 'girder'] },
        react: 0.23, aim: 0.55, turn: 10, over: 0.2, calm: 0.85, traits: ['The anchor who never leaves the site', 'Strong last-player rounds', 'Stubborn: never rotates'] },
      { name: 'Wisp', jobs: { atk: 'flank', def: 'trapper' }, pool: { atk: ['wren', 'vapor', 'strider'], def: ['latch', 'gravel', 'bramble'] },
        react: 0.21, aim: 0.52, turn: 11, over: 0.25, calm: 0.7, traits: ['Times flanks perfectly', 'Sets traps where nobody looks', 'Impatient: sometimes goes early'] },
    ],
  },
];
// each player's operators, kept to their job (the role screen only lets you pick your job's operators)
// Each player's mouse (he asked: they play with a mouse on a mousepad, and sensitivity shapes how they play):
// cm360 = centimetres of mouse travel for a full turn (low = steady but slow to turn round, high = fast flicks but
// shaky), pad = mousepad width (cm): a big turn can run out of pad and the mouse has to be lifted and put back,
// hand = how fast the hand moves (cm/s), steady = how much the hand wobbles (cm).
const MOUSE = {"Halden":[45,45,140,0.05],"Kaze":[22,40,170,0.07],"Brick":[40,45,130,0.05],"Moth":[50,45,120,0.045],"Juno":[34,45,150,0.045],"Sable":[55,50,130,0.04],"Torvi":[25,40,165,0.065],"Pax":[38,45,140,0.06],"Grit":[60,50,130,0.04],"Wisp":[30,45,150,0.05]};
for (const t of PRO_TEAMS) for (const pl of t.players) { const [cm360, pad, hand, steady] = MOUSE[pl.name]; pl.mouse = { cm360, pad, hand, steady }; pl.traits = [...pl.traits, `Sensitivity: ${cm360} cm per 360° turn${cm360 >= 50 ? ' (low: precise, slow to turn round)' : cm360 <= 26 ? ' (high: lightning flicks, shakier)' : ''}`]; }
for (const t of PRO_TEAMS) for (const pl of t.players) for (const side of ['atk', 'def']) pl.pool[side] = pl.pool[side].filter(o => jobOf(o) === pl.jobs[side]);
export const proTeam = id => PRO_TEAMS.find(t => t.id === id);

// ---------------- reading a map: what the plans are made from ----------------
const WALKABLE = t => !blocksMove(t) || t === T.BARRI; // barricades get knocked down on the way
function inRooms(m, names) {
  const rs = m.rooms.filter(r => names.includes(r.name));
  return (x, y) => rs.some(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
}
const cxy = (m, k) => ({ x: (k % m.W + 0.5) * CELL, y: (Math.floor(k / m.W) + 0.5) * CELL });
// walking distance (cells) from a set of starting cells to every cell, through stairs and dropped hatches
function flood(m, starts) {
  const d = new Int32Array(m.tiles.length).fill(-1), q = [];
  for (const k of starts) if (k >= 0) { d[k] = 0; q.push(k); }
  for (let i = 0; i < q.length; i++) {
    const k = q[i], nd = d[k] + 1;
    const nb = [k + 1, k - 1, k + m.W, k - m.W]; if (m.portal[k] >= 0) nb.push(m.portal[k]);
    for (const n of nb) if (n >= 0 && n < m.tiles.length && d[n] < 0 && WALKABLE(m.tiles[n])) { d[n] = nd; q.push(n); }
  }
  return d;
}

// Everything the plans need about one bomb site: its ways in (doors/windows and breakable walls, each with a spot to
// stack outside and a spot just inside), which way in is closest to the attackers, hatches above it, the rooms
// round it, and the spots defenders hold.
// worked out once per map build (a new one each round) and site: the plans and the bots ask for it several times a round
const INTEL = new WeakMap();
export function siteIntel(m, si) {
  let c = INTEL.get(m); if (!c) INTEL.set(m, c = {});
  return c[si] || (c[si] = siteIntel0(m, si));
}
function siteIntel0(m, si) {
  const site = m.sites[si], inSite = inRooms(m, site.rooms), W = m.W;
  const at = k => inSite(k % W, Math.floor(k / W));
  const spawns = (m.atkSpawns || []).map(s => ({ ...s, k: Math.floor(s.y / CELL) * W + Math.floor(s.x / CELL) }));
  const dist = flood(m, spawns.map(s => s.k));
  const ways = [];
  const along = (k, d) => { const a = d === 1 || d === -1 ? W : 1; return [k + a, k - a]; };
  const seen = new Set();
  for (const o of m.openings) for (const k of o.cells) for (const d of [1, -1, W, -W]) {
    if (!at(k + d) || at(k - d)) continue;
    const out = k - 2 * d; if (out < 0 || out >= m.tiles.length || !WALKABLE(m.tiles[out]) || dist[out] < 0) continue;
    if (seen.has('o' + o.id)) continue; seen.add('o' + o.id);
    ways.push({ kind: o.kind === 'window' ? 'window' : 'door', k, out, inK: k + 2 * d, d: dist[out], pos: cxy(m, k), stack: cxy(m, out), inside: cxy(m, k + 2 * d) });
  }
  for (let k = 0; k < m.tiles.length; k++) { // stairs that arrive inside the site (a tower room reached only by its stairs)
    const to = m.portal[k]; if (to < 0 || !at(to) || at(k) || dist[k] < 0 || seen.has("s" + to)) continue; seen.add("s" + to);
    ways.push({ kind: "stairs", k: to, out: k, inK: to, d: dist[k], pos: cxy(m, to), stack: cxy(m, k), inside: cxy(m, to) });
  }
  for (let k = W; k < m.tiles.length - W; k++) {
    if (m.tiles[k] !== T.SOFT || m.shape[k]) continue;
    for (const d of [1, -1, W, -W]) {
      if (!at(k + d) || at(k - d)) continue;
      const out = k - 2 * d; if (!WALKABLE(m.tiles[out]) || m.tiles[k - d] !== T.FLOOR && m.tiles[k - d] !== T.GROUND || dist[out] < 0) continue;
      if (!along(k, d).every(q => [T.SOFT, T.REINF, T.HARD].includes(m.tiles[q]))) continue;
      ways.push({ kind: 'wall', k, out, inK: k + d, d: dist[out], pos: cxy(m, k), stack: cxy(m, out), inside: cxy(m, k + 2 * d) });
    }
  }
  // Stack beside the way in, not in front of it: the nearest walkable spot outside that cannot be seen from 2 m inside
  // (pros never wait in a doorway's line). And for defenders a hold spot inside: 3-9 m from the way in, looking at it
  // from an angle, preferably against a wall.
  for (const w of ways) {
    const ins = w.inside, cand = [];
    for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
      const k = w.out + dy * W + dx; if (k < 0 || k >= m.tiles.length || at(k) || !WALKABLE(m.tiles[k]) || m.tiles[k] === T.BARRI || dist[k] < 0) continue;
      if (m.flAt[k] !== m.flAt[w.out]) continue;
      const c = cxy(m, k); if (los(m, ins.x, ins.y, c.x, c.y, null)) continue;
      const free = [1, -1, W, -W].filter(d => WALKABLE(m.tiles[k + d])).length; if (free < 3) continue;
      cand.push({ c, s: Math.abs(dx) + Math.abs(dy) });
    }
    cand.sort((a, b) => a.s - b.s); if (cand[0]) w.stack = cand[0].c;
    const holds = [];
    for (let k = 0; k < m.tiles.length; k++) {
      if (!at(k) || m.tiles[k] !== T.FLOOR) continue;
      const c = cxy(m, k), d = Math.hypot(c.x - w.pos.x, c.y - w.pos.y) / CELL; if (d < 3 || d > 9) continue;
      if (!los(m, c.x, c.y, w.pos.x, w.pos.y, null)) continue;
      const ax = w.inside.x - w.pos.x, ay = w.inside.y - w.pos.y, bx = c.x - w.pos.x, by = c.y - w.pos.y;
      const off = Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by) || 1)))); // 0 = straight in line with the door
      const wall = [1, -1, W, -W].some(dd => blocksMove(m.tiles[k + dd]) && m.tiles[k + dd] !== T.OPEN);
      holds.push({ c, s: Math.abs(off - 0.8) * 3 + Math.abs(d - 5) * 0.3 - (wall ? 0.8 : 0) });
    }
    holds.sort((a, b) => a.s - b.s); w.hold = holds[0] ? holds[0].c : w.inside;
  }
  ways.sort((a, b) => a.d - b.d);
  const doors = ways.filter(w => w.kind !== 'wall'), walls = ways.filter(w => w.kind === 'wall');
  const main = doors[0] || ways[0];
  const far = (list, from) => list.slice().sort((a, b) => Math.hypot(b.pos.x - from.pos.x, b.pos.y - from.pos.y) - Math.hypot(a.pos.x - from.pos.x, a.pos.y - from.pos.y))[0];
  const side = main ? far(doors.filter(w => w !== main && w.d < main.d + 90), main) || far(doors.filter(w => w !== main), main) : null;
  // a wall to breach: close to the attackers, away from the main door (a second angle on the defenders)
  const wall = main ? walls.slice().sort((a, b) => (a.d - Math.hypot(a.pos.x - main.pos.x, a.pos.y - main.pos.y) / CELL * 0.6) - (b.d - Math.hypot(b.pos.x - main.pos.x, b.pos.y - main.pos.y) / CELL * 0.6))[0] : walls[0];
  const hatch = (m.hatches || []).filter(h => !h.roof).find(h => inSite(Math.floor(h.bx / CELL), Math.floor(h.by / CELL))) || null; // a hatch in the ceiling of the site
  const hatchBelow = (m.hatches || []).filter(h => !h.roof).find(h => inSite(Math.floor(h.x / CELL), Math.floor(h.y / CELL))) || null; // one in the site's floor
  const nearSpawn = main ? spawns.slice().sort((a, b) => Math.hypot(a.x - main.stack.x, a.y - main.stack.y) - Math.hypot(b.x - main.stack.x, b.y - main.stack.y))[0] : spawns[0];
  // rooms next to the site (sharing a door) for crossfires and roaming
  const siteRooms = m.rooms.filter(r => site.rooms.includes(r.name));
  const roomOf = k => m.rooms.find(r => { const x = k % W, y = Math.floor(k / W); return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h; });
  const near = [];
  for (const w of doors) { const r = roomOf(w.out); if (r && !site.rooms.includes(r.name) && !near.includes(r)) near.push(r); }
  const centre = r => ({ x: (r.x + r.w / 2) * CELL, y: (r.y + r.h / 2) * CELL });
  // a room on the attackers' way to the site, about halfway: where a roamer meets them
  let roam = null;
  if (main) {
    const want = main.d * 0.55, bad = new Set(site.rooms);
    roam = m.rooms.filter(r => !bad.has(r.name) && r.w * r.h >= 16).map(r => { const k = Math.floor((r.y + r.h / 2)) * W + Math.floor(r.x + r.w / 2); return { r, d: dist[k] }; })
      .filter(o => o.d > 0).sort((a, b) => Math.abs(a.d - want) - Math.abs(b.d - want))[0]?.r || null;
  }
  return { si, site, ways, doors, walls, main, side, wall, hatch, hatchBelow, spawn: nearSpawn, near, siteRooms, roam,
    bombs: site.bombs, centre, siteCentre: siteRooms.length ? centre(siteRooms[0]) : site.bombs[0] };
}

// ---------------- the playbook ----------------
// A plan: a name, the idea in a sentence, its tempo, and for each job what to do. Positions are world points.
// atk jobs: breach, entry, intel, support, flank.  def jobs: anchor, trapper, roamer, intel, support.
// go = seconds into the action phase the push starts (fast plans 0-10, slow ones 40-80).
export function playbook(m, si, side, team) {
  const I = siteIntel(m, si), plans = [], ways = I.main ? [I.main, I.side, I.wall].filter(Boolean) : [];
  if (!I.main) return plans;
  const two = (a, b) => (doorName(a) === doorName(b) ? ['the main way in', 'the other way in'] : [doorName(a), doorName(b)]); // two ways in that would read the same
  const doorName = w => w ? (w.kind === 'wall' ? 'the breakable wall' : w.kind === 'window' ? 'the window' : w.kind === 'stairs' ? 'the stairs' : 'the door') + roomTag(m, w.out) : '';
  const bombNear = w => I.bombs.slice().sort((a, b) => Math.hypot(a.x - w.inside.x, a.y - w.inside.y) - Math.hypot(b.x - w.inside.x, b.y - w.inside.y))[0];
  if (side === 'atk') {
    const B = I.wall || I.main, b = bombNear(I.main);
    plans.push({ id: 'default', name: 'Default', tempo: 'slow', go: 42, idea: `Full drones, then the breacher opens ${doorName(B)} while the team holds ${doorName(I.main)}; everyone goes in together and plants at ${b.id}.`,
      jobs: {
        intel: { task: 'Drones the site all preparation and keeps a drone alive inside; calls the anchors for the first part of the round, then joins the push last.', drone: I.siteCentre, keepDrone: 35, stack: I.main.stack, target: I.main.inside },
        breach: { task: `Opens ${doorName(B)} a few seconds before the push, then follows the entry in.`, breach: B.kind === 'wall' ? B.k : null, stack: B.stack, target: B.inside },
        entry: { task: `Stacks on ${doorName(I.main)} and goes in first when the wall opens.`, stack: I.main.stack, target: I.main.inside, util: 'stun' },
        support: { task: 'Smokes the main angle for the breacher, then trades the entry and carries the defuser to the plant.', stack: I.main.stack, target: I.main.inside, util: 'smoke', plant: b },
        flank: { task: 'Holds the defenders\' rotation route outside the site until the push, then cuts off anyone running back.', hold: I.side ? I.side.stack : I.main.stack, until: 55, target: (I.side || I.main).inside },
      } });
    plans.push({ id: 'fast', name: 'Fast hit', tempo: 'fast', go: 4, idea: `No waiting: everyone runs straight at ${doorName(I.main)} the moment the round starts, before the site is set up, and plants at ${b.id}.`,
      jobs: {
        intel: { task: 'Drones ahead of the team in the first seconds, then follows them in.', drone: I.main.inside, keepDrone: 6, stack: I.main.stack, target: I.main.inside },
        breach: { task: 'Runs with the team and knocks the barricade down.', stack: I.main.stack, target: I.main.inside },
        entry: { task: 'First through the door, a stun thrown in ahead.', stack: I.main.stack, target: I.main.inside, util: 'stun' },
        support: { task: 'Right behind the entry for the trade, plants straight away.', stack: I.main.stack, target: I.main.inside, plant: b },
        flank: { task: 'Comes in a few seconds later from the other side to catch anyone looking at the door.', stack: (I.side || I.main).stack, target: (I.side || I.main).inside, delay: 6 },
      } });
    if (I.side) plans.push({ id: 'split', name: 'Split', tempo: 'medium', go: 35, idea: `Two pairs: one at ${two(I.main, I.side)[0]}, one at ${two(I.main, I.side)[1]}. Both go at the same moment so the defenders face two ways.`,
      jobs: {
        intel: { task: 'Drones both sides, then joins the pair on the far side.', drone: I.siteCentre, keepDrone: 25, stack: I.side.stack, target: I.side.inside },
        breach: { task: `Opens ${doorName(I.wall || I.main)} for the main pair.`, breach: I.wall ? I.wall.k : null, stack: (I.wall || I.main).stack, target: (I.wall || I.main).inside },
        entry: { task: `Leads the main pair through ${doorName(I.main)}.`, stack: I.main.stack, target: I.main.inside, util: 'stun' },
        support: { task: 'Goes with the main pair, utility in first, plants.', stack: I.main.stack, target: I.main.inside, util: 'smoke', plant: b },
        flank: { task: `Leads the second pair through ${doorName(I.side)}.`, stack: I.side.stack, target: I.side.inside },
      } });
    if (I.hatch) { const hc = { x: I.hatch.x, y: I.hatch.y }; plans.push({ id: 'vertical', name: 'Vertical', tempo: 'slow', go: 50, idea: 'Two players open the hatch in the floor above the site and play down through it while the rest push the door: defenders get shot from above.',
      jobs: {
        intel: { task: 'Drones the site, then holds the door with the entry.', drone: I.siteCentre, keepDrone: 30, stack: I.main.stack, target: I.main.inside },
        breach: { task: 'Opens the hatch above the site and shoots down through it.', hatch: hc, stack: hc, target: hc },
        entry: { task: `Pushes ${doorName(I.main)} once the hatch is open.`, stack: I.main.stack, target: I.main.inside, util: 'stun' },
        support: { task: 'Covers the breacher at the hatch, then drops in to plant.', stack: hc, target: hc, plant: b, drop: true },
        flank: { task: 'Pushes with the entry from the door.', stack: I.main.stack, target: I.main.inside, delay: 3 },
      } }); }
    if (I.side) plans.push({ id: 'fake', name: 'Fake', tempo: 'medium', go: 45, idea: `Two players make a lot of noise at ${two(I.main, I.side)[1]} (shooting barricades, utility) to pull the roamers, then the team hits ${two(I.main, I.side)[0]}.`,
      jobs: {
        intel: { task: 'Watches the fake on a drone and calls when the defenders rotate.', drone: I.siteCentre, keepDrone: 40, stack: I.main.stack, target: I.main.inside },
        breach: { task: `Fakes at ${doorName(I.side)}: breaks barricades and throws utility, then runs round to join the hit.`, fake: I.side.stack, stack: I.main.stack, target: I.main.inside },
        entry: { task: `Waits quietly at ${doorName(I.main)} and leads the real hit.`, stack: I.main.stack, target: I.main.inside, util: 'stun' },
        support: { task: 'Smokes the main door and plants.', stack: I.main.stack, target: I.main.inside, util: 'smoke', plant: b },
        flank: { task: `Fakes with the breacher at ${doorName(I.side)}, then stays there to catch the rotation back.`, fake: I.side.stack, stack: I.side.stack, target: I.side.inside, delay: 8 },
      } });
    // more plays (he asked: the pros should have more plays to learn from)
    if (I.side && I.wall) plans.push({ id: 'pinch', name: 'Three-way pinch', tempo: 'slow', go: 50, idea: `The wall opens, and at the same moment the team comes through ${doorName(I.main)} and ${doorName(I.side)}: the defenders have three ways to watch and not enough eyes.`,
      jobs: {
        intel: { task: 'Drones the site, then goes in with the entry.', drone: I.siteCentre, keepDrone: 35, stack: I.main.stack, target: I.main.inside },
        breach: { task: `Opens ${doorName(I.wall)} and plays through it.`, breach: I.wall.k, stack: I.wall.stack, target: I.wall.inside },
        entry: { task: `Goes through ${doorName(I.main)} the moment the wall blows.`, stack: I.main.stack, target: I.main.inside, util: 'stun' },
        support: { task: 'Covers the breacher at the wall, then plants from that side.', stack: I.wall.stack, target: I.wall.inside, util: 'smoke', plant: bombNear(I.wall) },
        flank: { task: `Comes through ${doorName(I.side)} at the same moment.`, stack: I.side.stack, target: I.side.inside },
      } });
    // practice showed attacks coming in three ways at once win far more often: like the pinch, but through a window or the stairs instead of a wall
    const apart = (a, b) => Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y) > 5 * CELL;
    const third = I.side && I.ways.find(w => ['window', 'stairs'].includes(w.kind) && apart(w, I.main) && apart(w, I.side));
    if (third) plans.push({ id: 'collapse', name: 'Three-way collapse', tempo: 'medium', go: 42, idea: `${(s => s[0].toUpperCase() + s.slice(1))(doorName(I.main))}, ${doorName(I.side)} and ${doorName(third)} all at once: one defender can't watch three ways.`,
      jobs: {
        intel: { task: `Drones the site, then comes through ${doorName(third)} with the support.`, drone: I.siteCentre, keepDrone: 30, stack: third.stack, target: third.inside },
        breach: { task: `Barricade and utility at ${doorName(I.main)}, then pushes it with the entry.`, stack: I.main.stack, target: I.main.inside },
        entry: { task: `First through ${doorName(I.main)}.`, stack: I.main.stack, target: I.main.inside, util: 'stun' },
        support: { task: `Comes through ${doorName(third)} and plants from there.`, stack: third.stack, target: third.inside, util: 'smoke', plant: bombNear(third), clear: third.kind === 'window' ? third.k : undefined },
        flank: { task: `Comes through ${doorName(I.side)} at the same moment.`, stack: I.side.stack, target: I.side.inside },
      } });
    plans.push({ id: 'late', name: 'Late hit', tempo: 'slow', go: 95, idea: `Hunt the roamers and drone everything first; the defenders get restless, then the team hits ${doorName(I.main)} with about 1:20 left.`,
      jobs: {
        intel: { task: 'Keeps a drone on the site for most of the round and calls every move.', drone: I.siteCentre, keepDrone: 80, stack: I.main.stack, target: I.main.inside },
        breach: { task: `Opens ${doorName(B)} right before the late hit.`, breach: B.kind === 'wall' ? B.k : null, stack: B.stack, target: B.inside },
        entry: { task: 'Clears the rooms round the site of roamers, then leads the hit.', hold: I.roam ? I.centre(I.roam) : I.main.stack, until: 85, stack: I.main.stack, target: I.main.inside, util: 'stun' },
        support: { task: 'Hunts roamers with the entry, then plants.', hold: I.roam ? I.centre(I.roam) : I.main.stack, until: 85, stack: I.main.stack, target: I.main.inside, util: 'smoke', plant: b },
        flank: { task: 'Holds the rotation route all round and catches anyone who peeks out.', hold: I.side ? I.side.stack : I.main.stack, until: 100, target: (I.side || I.main).inside },
      } });
    const win = I.ways.find(w => w.kind === 'window' && w !== I.main);
    if (win) plans.push({ id: 'window', name: 'Window hit', tempo: 'medium', go: 38, idea: `Noise at ${doorName(I.main)} while the entry and support come in through ${doorName(win)} where nobody expects it.`,
      jobs: {
        intel: { task: 'Drones the window side and calls who is watching it.', drone: win.inside, keepDrone: 30, stack: win.stack, target: win.inside },
        breach: { task: `Makes noise at ${doorName(I.main)} (barricade, utility), then pushes it.`, fake: I.main.stack, stack: I.main.stack, target: I.main.inside },
        entry: { task: `Shoots the boards off ${doorName(win)} just before the go, then is first through.`, stack: win.stack, target: win.inside, util: 'stun', clear: win.k },
        support: { task: 'Follows the entry through the window and plants.', stack: win.stack, target: win.inside, util: 'smoke', plant: bombNear(win) },
        flank: { task: `Pushes ${doorName(I.main)} with the breacher once the window is in.`, stack: I.main.stack, target: I.main.inside, delay: 4 },
      } });
    if (I.near[0]) plans.push({ id: 'lurk', name: 'Lurk and collapse', tempo: 'medium', go: 58, idea: `The flanker sneaks round to ${I.near[0].name.replace(/^\dF /, '')} beside the site and waits silently; when the team hits ${doorName(I.main)} the defenders turn and get shot in the back.`,
      jobs: {
        intel: { task: 'Drones the site and the lurk route.', drone: I.siteCentre, keepDrone: 40, stack: I.main.stack, target: I.main.inside },
        breach: { task: `Opens ${doorName(B)} for the hit.`, breach: B.kind === 'wall' ? B.k : null, stack: B.stack, target: B.inside },
        entry: { task: `Leads the hit through ${doorName(I.main)}.`, stack: I.main.stack, target: I.main.inside, util: 'stun' },
        support: { task: 'Trades the entry and plants.', stack: I.main.stack, target: I.main.inside, util: 'smoke', plant: b },
        flank: { task: 'Lurks quietly beside the site, then collapses from behind when the hit starts.', hold: I.centre(I.near[0]), until: 60, target: (I.side || I.main).inside },
      } });
  } else {
    const hold = w => w ? w.hold : I.siteCentre;
    const nearRoom = I.near[0] ? I.centre(I.near[0]) : I.siteCentre, nearRoom2 = I.near[1] ? I.centre(I.near[1]) : nearRoom;
    const roamAt = I.roam ? I.centre(I.roam) : nearRoom;
    plans.push({ id: 'hold', name: 'Hold the site', tempo: 'slow', idea: 'Three on the site covering every way in, a trapper who wires the doors and then anchors, and one roamer who slows the attack and falls back at 1:30.',
      jobs: {
        anchor: { task: `Anchors the site, watching ${doorName(I.main)}.`, hold: hold(I.main), watch: I.main.pos },
        trapper: { task: 'Traps the doors and windows, then holds the second angle on the site.', hold: hold(I.side || I.wall), watch: (I.side || I.wall || I.main).pos },
        intel: { task: 'Takes space in the room beside the site early (he asked: space matters), then holds a corner of the site with a camera feed in mind; calls rotations.', roam: nearRoom, until: 75, hold: I.siteCentre, watch: I.main.pos },
        support: { task: 'Plays next to the anchor for the trade and keeps everyone healthy.', hold: hold(I.main), watch: I.main.pos, nearAnchor: true },
        roamer: { task: 'Roams on the attackers\' route to slow them, back on site by 1:30.', roam: roamAt, until: 70, hold: I.siteCentre, watch: I.main.pos },
      } });
    plans.push({ id: 'roam', name: 'Deep roam', tempo: 'fast', idea: 'Two roamers go out early and hunt the attackers on their way in; three anchors hold the site. Time spent fighting roamers is time the attack does not have.',
      jobs: {
        anchor: { task: 'Holds the site door.', hold: hold(I.main), watch: I.main.pos },
        trapper: { task: 'Traps the ways in, then holds the other side of the site.', hold: hold(I.side || I.main), watch: (I.side || I.main).pos },
        intel: { task: 'Holds the back of the site and calls what the cameras see.', hold: I.siteCentre, watch: I.main.pos },
        support: { task: 'Roams with the roamer as a pair, back at 1:00.', roam: nearRoom2, until: 60, hold: hold(I.main), watch: I.main.pos },
        roamer: { task: 'Hunts far out on the attackers\' route, back at 1:00.', roam: roamAt, until: 60, hold: I.siteCentre, watch: I.main.pos },
      } });
    plans.push({ id: 'cross', name: 'Crossfire', tempo: 'slow', idea: 'Two on site, two in the rooms beside it: anyone who comes in through the door is shot from two sides at once.',
      jobs: {
        anchor: { task: 'Holds deep in the site.', hold: I.siteCentre, watch: I.main.pos },
        trapper: { task: 'Traps the door, then holds the room beside the site for the crossfire.', hold: nearRoom, watch: I.main.pos },
        intel: { task: 'Holds the second room beside the site.', hold: nearRoom2, watch: I.main.pos },
        support: { task: 'Holds the site with the anchor.', hold: hold(I.main), watch: I.main.pos },
        roamer: { task: 'A short roam, then the crossfire from outside.', roam: roamAt, until: 70, hold: nearRoom, watch: I.main.pos },
      } });
    plans.push({ id: 'retake', name: 'Retake', tempo: 'slow', idea: 'Light on the site, heavy around it: let them plant, then come back in from three sides together with utility.',
      jobs: {
        anchor: { task: 'Hides on site to buy time, falls back if they push in numbers.', hold: I.siteCentre, watch: I.main.pos },
        trapper: { task: 'Traps the site, waits outside it for the retake.', hold: nearRoom, watch: I.main.pos },
        intel: { task: 'Watches cameras from outside the site and calls the plant.', hold: nearRoom2, watch: I.main.pos },
        support: { task: 'Waits for the retake with the trapper.', hold: nearRoom, watch: I.main.pos },
        roamer: { task: 'Roams, then joins the retake from behind the attackers.', roam: roamAt, until: 80, hold: nearRoom2, watch: I.main.pos },
      } });
    if (I.hatch || I.hatchBelow) { const h = I.hatch || I.hatchBelow, up = I.hatch ? { x: h.x, y: h.y } : { x: h.bx, y: h.by }; plans.push({ id: 'vert', name: 'Vertical control', tempo: 'slow', idea: 'One player holds the floor above (or below) the site and its hatch, so the attackers cannot play through it, and shoots down at the plant.',
      jobs: {
        anchor: { task: 'Holds the site door.', hold: hold(I.main), watch: I.main.pos },
        trapper: { task: 'Traps the ways in and holds the site.', hold: I.siteCentre, watch: (I.side || I.main).pos },
        intel: { task: 'Holds the hatch floor and the stairs to it.', hold: up, watch: up },
        support: { task: 'Holds the site with the anchor.', hold: hold(I.side || I.main), watch: I.main.pos },
        roamer: { task: 'Roams, then plays the hatch floor too.', roam: roamAt, until: 75, hold: up, watch: up },
      } }); }
  }
  if (side === 'def') { // more plays (he asked)
    const hold = w => w ? w.hold : I.siteCentre, nearRoom = I.near[0] ? I.centre(I.near[0]) : I.siteCentre, nearRoom2 = I.near[1] ? I.centre(I.near[1]) : nearRoom;
    const roamAt = I.roam ? I.centre(I.roam) : nearRoom, [bA, bB] = [I.bombs[0], I.bombs[1] || I.bombs[0]];
    plans.push({ id: 'turtle', name: 'Turtle', tempo: 'slow', idea: 'Nobody leaves: all five on the site, every way in watched twice, every wall reinforced. Make them come to you.',
      jobs: {
        anchor: { task: `Holds ${doorName(I.main)} from deep in the site.`, hold: hold(I.main), watch: I.main.pos },
        trapper: { task: 'Traps every way in, then holds the second angle.', hold: hold(I.side || I.wall), watch: (I.side || I.wall || I.main).pos },
        intel: { task: 'Holds the middle of the site on cameras.', hold: I.siteCentre, watch: I.main.pos },
        support: { task: 'Holds next to the anchor for the trade.', hold: hold(I.main), watch: I.main.pos, nearAnchor: true },
        roamer: { task: 'Stays on site too, by the other defuser spot.', hold: { x: bB.x, y: bB.y }, watch: (I.side || I.main).pos },
      } });
    plans.push({ id: 'bait', name: 'Bait', tempo: 'medium', idea: 'The roamer shows up at the attackers\' door early, gets seen, then falls back through the room beside the site, where two teammates wait to catch whoever chases.',
      jobs: {
        anchor: { task: 'Holds the site.', hold: hold(I.main), watch: I.main.pos },
        trapper: { task: 'Traps the door, then waits in the room beside the site for the chase.', hold: nearRoom, watch: I.main.pos },
        intel: { task: 'Calls the chase on cameras from the site.', hold: I.siteCentre, watch: I.main.pos },
        support: { task: 'Waits beside the trapper for the chase.', hold: nearRoom, watch: I.main.pos },
        roamer: { task: 'Gets seen at the attackers\' door, then runs back past the trap.', roam: I.main.stack, until: 45, hold: nearRoom2, watch: I.main.pos },
      } });
    if (bA !== bB) plans.push({ id: 'tworooms', name: 'Two rooms', tempo: 'slow', idea: `A pair in each site room (${bA.room || 'A'} and ${bB.room || 'B'}), so whichever they hit, two are already there and the other two come through the shared wall.`,
      jobs: {
        anchor: { task: `Anchors ${bA.room || 'site A'}.`, hold: { x: bA.x, y: bA.y }, watch: I.main.pos },
        support: { task: `Plays beside the anchor in ${bA.room || 'site A'}.`, hold: { x: bA.x, y: bA.y }, watch: I.main.pos, nearAnchor: true },
        trapper: { task: `Traps both rooms, then holds ${bB.room || 'site B'}.`, hold: { x: bB.x, y: bB.y }, watch: (I.side || I.main).pos },
        intel: { task: `Holds ${bB.room || 'site B'} on cameras.`, hold: { x: bB.x, y: bB.y }, watch: (I.side || I.main).pos },
        roamer: { task: 'A short roam, then back to whichever room is hit.', roam: roamAt, until: 70, hold: I.siteCentre, watch: I.main.pos },
      } });
    plans.push({ id: 'hunter', name: 'Hunter', tempo: 'fast', idea: 'The roamer never comes back: hides far out all round and shoots the attackers in the back once they commit to the site.',
      jobs: {
        anchor: { task: 'Holds the site door.', hold: hold(I.main), watch: I.main.pos },
        trapper: { task: 'Traps the ways in, then holds the other side.', hold: hold(I.side || I.main), watch: (I.side || I.main).pos },
        intel: { task: 'Calls where the attackers are so the hunter knows when to strike.', hold: I.siteCentre, watch: I.main.pos },
        support: { task: 'A short roam beside the site, back by 1:30.', roam: nearRoom2, until: 50, hold: hold(I.main), watch: I.main.pos },
        roamer: { task: 'Hides far out all round, then hits the attackers from behind.', roam: roamAt, until: 170, hold: nearRoom, watch: I.main.pos },
      } });
  }
  if (side === 'def') { // he asked: four defenders stared at the stairs and nobody watched the windows. One player per way
    // in: the first job keeps the main way, everyone else who would also watch it takes the next way in (windows too)
    const list = [];
    for (const w of [...I.ways.filter(w => w.kind !== 'wall'), ...I.ways.filter(w => w.kind === 'wall')]) if (!list.some(o => Math.hypot(o.pos.x - w.pos.x, o.pos.y - w.pos.y) < 3 * CELL)) list.push(w);
    for (const pl of plans) { let n = 0;
      for (const id of DEF_JOBS) { const j = pl.jobs[id]; if (!j || j.watch !== I.main.pos) continue;
        const w = list[n++ % list.length]; if (w === I.main) continue;
        if (j.hold === I.main.hold) j.hold = w.hold; j.watch = w.pos; j.task += ` Watches ${doorName(w)}.`; }
    }
  }
  const way = w => w && { kind: w.kind, pos: w.pos, stack: w.stack, inside: w.inside, hold: w.hold };
  for (const p of plans) { p.site = si; p.ways = { main: way(I.main), side: way(I.side) }; p.spawn = I.spawn && I.spawn.name; }
  const order = team ? team.prefer[side] : null;
  return order ? plans.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)) : plans;
}
function roomTag(m, k) {
  const x = k % m.W, y = Math.floor(k / m.W), r = m.rooms.find(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
  return r ? ` from ${r.name.replace(/^\dF /, '')}` : '';
}
export const ATK_JOBS = ['breach', 'entry', 'intel', 'support', 'flank'];
export const DEF_JOBS = ['anchor', 'trapper', 'roamer', 'intel', 'support'];
export const JOB_NAME = Object.fromEntries([...JOBS.atk, ...JOBS.def].map(j => [j.id, j.name]));
