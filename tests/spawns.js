// Spawns and lock-in: operator select waits until everyone has locked in (no clock), each attacker starts at the
// spawn they chose, and during preparation the attackers' bodies are nowhere on the map (only their drones are).
// Run: node tests/spawns.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { MAP_LIST, buildMap } from '../shared/map.js';
import { PHASE, CELL } from '../shared/constants.js';
import { opsForTeam } from '../shared/operators.js';

let fails = 0;
const fail = (...a) => { fails++; console.log('FAIL', ...a); };
const sent = [];
const sock = { open: true, send: m => sent.push(m) };

for (const id of MAP_LIST) {
  const g = new Game();
  const h = g.addPlayer('Human', false); h.sock = sock; h.token = 'x';
  for (let i = 0; i < 5; i++) g.addBot();
  g.mapId = id; g.map = buildMap(id); g.startMatch();
  const side = g.side(h), spawns = g.map.atkSpawns;
  if (spawns.length < 3) fail(id, 'only', spawns.length, 'attacker spawns');
  // a long wait: still choosing, because the human hasn't locked in
  for (let i = 0; i < 30 * 60; i++) g.tick(1 / 30);
  if (g.phase !== PHASE.SELECT) { fail(id, 'operator select ended without the human locking in'); continue; }
  g.handle(h, { t: 'lock' }); g.tick(1 / 30);
  if (g.phase !== PHASE.SELECT || h.locked) fail(id, 'locked in without an operator');
  const op = opsForTeam(side).find(o => ![...g.players.values()].some(q => q !== h && q.squad === h.squad && q.op === o));
  g.handle(h, { t: 'pick', op });
  // an attacker (human or, if the human defends, a bot) chooses the last spawn
  const atk = side === 'atk' ? h : [...g.players.values()].find(q => q.bot && g.side(q) === 'atk');
  const want = spawns.length - 1;
  if (atk === h) g.handle(h, { t: 'spawn', n: want }); else atk.spawn = spawns[want].name;
  g.handle(h, { t: 'lock' }); g.tick(1 / 30);
  if (!h.locked) fail(id, 'lock-in ignored');
  g.handle(h, { t: 'pick', op: opsForTeam(side).find(o => o !== op) });
  if (h.op !== op) fail(id, 'changed operator after locking in');
  for (let i = 0; i < 30 * 5 && g.phase === PHASE.SELECT; i++) g.tick(1 / 30);
  if (g.phase !== PHASE.PREP) { fail(id, 'preparation did not start once everyone locked in'); continue; }
  // preparation: attacker bodies are off the map, hidden from everyone, can't be shot; their drones left from their spawn
  sent.length = 0; g.broadcast(); const last = JSON.parse(sent[sent.length - 1]);
  for (const q of g.players.values()) {
    if (g.side(q) !== 'atk') continue;
    if (!q.staged) fail(id, q.name, 'is on the map during preparation');
    const sp = last.players && last.players.find(o => o.id === q.id);
    if (sp && sp.x !== undefined && q !== h) fail(id, q.name, 'position was sent during preparation');
    const d = g.ents.find(e => e.id === q.droneId), s = g.spawnOf(q);
    if (!d) fail(id, q.name, 'has no drone'); else if (Math.hypot(d.x - s.x, d.y - s.y) > 120) fail(id, q.name, 'drone did not leave from their spawn');
  }
  while (g.phase === PHASE.PREP) g.tick(1 / 30);
  const s = spawns[want];
  if (atk.staged || Math.hypot(atk.x - s.x, atk.y - s.y) > 120) fail(id, 'attacker did not start at the chosen spawn', s.name, Math.round(atk.x), Math.round(atk.y));
  for (const q of g.players.values()) if (g.side(q) === 'atk' && (q.x < 0 || q.y < 0 || q.x > g.map.W * CELL)) fail(id, q.name, 'still off the map in the action phase');
  console.log(`${id}: ${spawns.length} spawns, ${atk.name} started at ${s.name}`);
}
console.log(fails ? `${fails} failure(s)` : 'PASS spawns');
process.exit(fails ? 1 : 0);
