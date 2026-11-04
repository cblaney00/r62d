// What bots are told, they really do: watched on every map, nobody else in the way. Run: node tests/botorders.js [map]
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { botHear } from '../server/bots.js';
import { MAP_LIST, buildMap } from '../shared/map.js';
import { PHASE, TEAM, PX_PER_M, CELL } from '../shared/constants.js';
let bad = 0; const check = (ok, what) => { if (!ok) { console.log('FAIL', what); bad++; } return ok; };
const only = process.argv[2];
function make(id, side) { // you + two bots on one side, an empty enemy team, round in progress
  const g = new Game({}); g.mapId = id; g.map = buildMap(id); g.botLevel = 3;
  for (let i = 0; i < 6; i++) g.addBot(i % 2);
  g.startMatch(); let n = 0; while (g.phase !== PHASE.ACTION && n++ < 8000) g.tick(1 / 30);
  check(g.mapId === id, `wanted ${id}, match is on ${g.mapId}`); g.free = true; g.ranked = false;
  const mine = [...g.players.values()].filter(q => g.side(q) === side);
  for (const q of [...g.players.values()]) if (g.side(q) !== side) g.players.delete(q.id);
  const me = mine[0], [a, b] = [mine[1], mine[2]]; me.bot = false; me.ai = null; me.hold = {};
  return { g, me, a, b };
}
const run = (g, secs, stop = () => false) => { for (let i = 0; i < secs * 30; i++) { g.timer = 150; g.tick(1 / 30); if (stop()) return i / 30; } return null; };
const state = a => `${a.op} at ${Math.round(a.x)},${Math.round(a.y)} alive ${a.alive} downed ${a.downed} ctrl ${a.ctrl} carrying ${a.hasDefuser} busy ${a.busy && a.busy.k} rope ${!!a.rope} order ${JSON.stringify(a.ai.cmd)}`;
const near = (p, x, y, m) => Math.hypot(p.x - x, p.y - y) < m * PX_PER_M;
const say = (g, me, a, t) => botHear(g, me, `${a.name.replace(/^\[\w+\] /, '')} ${t}`);
for (const id of MAP_LIST) {
  if (only && id !== only) continue;
  const res = [];
  { // go to rooms, near and far, on any floor
    const { g, me, a } = make(id, TEAM.DEF); const rooms = g.map.rooms.filter(r => r.w * r.h >= 12), seen = new Set(); let got = 0, tried = 0, slow = 0;
    for (let i = 0; i < rooms.length && tried < 6; i += Math.ceil(rooms.length / 6)) {
      const r = rooms[i], name = r.name.replace(/^\dF /, ''); if (seen.has(name)) continue; seen.add(name); tried++;
      me.x = a.x; me.y = a.y; const c = say(g, me, a, `go to ${name}`);
      if (!check(c.intent === 'goto' && c.who[0] === a.id, `${id}: "go to ${name}" read as ${c.intent}`)) continue;
      const cmd = a.ai.cmd; if (!check(!!cmd, `${id}: "go to ${name}" gave no order`)) continue;
      const t = run(g, 110, () => a.ai.cmd && a.ai.cmd.there);
      if (check(t !== null, `${id}: never reached ${name} (${Math.round(Math.hypot(cmd.x - a.x, cmd.y - a.y) / PX_PER_M)} m short; ${state(a)})`)) { got++; slow = Math.max(slow, t); }
      botHear(g, me, 'forget it');
    }
    res.push(`rooms ${got}/${tried} (slowest ${Math.round(slow)} s)`);
  }
  { // follow, hold
    const { g, me, a } = make(id, TEAM.DEF); me.x = a.x + 12 * PX_PER_M * 0; me.y = a.y;
    const start = g.map.rooms.find(r => r.w * r.h > 20); me.x = (start.x + start.w / 2) * CELL; me.y = (start.y + start.h / 2) * CELL;
    say(g, me, a, 'follow me'); const t = run(g, 35, () => near(a, me.x, me.y, 4)); res.push(check(t !== null, `${id}: follow never caught up (you at ${Math.round(me.x)},${Math.round(me.y)}; ${state(a)})`) ? `follow ok` : 'follow NO');
    say(g, me, a, 'hold here'); const x = a.x, y = a.y; run(g, 8); check(near(a, x, y, 1.5), `${id}: hold wandered ${Math.round(Math.hypot(a.x - x, a.y - y) / PX_PER_M)} m`);
    botHear(g, me, 'never mind'); check(!a.ai.cmd, `${id}: forget it did not clear orders`);
  }
  { // plant: the bot with the defuser takes it to the site and plants; the site is known to attackers
    const { g, me, a, b } = make(id, TEAM.ATK); g.siteRevealed = true;
    for (const q of [me, a, b]) q.hasDefuser = false; a.hasDefuser = true;
    const c = botHear(g, me, 'plant it'); const t = run(g, 140, () => !!g.planted);
    res.push(check(c.intent === 'plant' && t !== null, `${id}: plant never happened (${c.intent}; ${state(a)})`) ? `plant ${Math.round(t)} s` : 'plant NO');
  }
  { // flank and push move them
    const { g, me, a, b } = make(id, TEAM.ATK); g.siteRevealed = true; const x = a.x, y = a.y;
    const c = say(g, me, a, 'flank them'); run(g, 12); check(c.intent === 'flank' && !near(a, x, y, 3), `${id}: flank did not move (${c.intent}; ${state(a)})`);
    const x2 = b.x, y2 = b.y; botHear(g, me, 'everyone push'); const pushed = b.ai.cmd; run(g, 12); check(!near(b, x2, y2, 3) || !pushed || Math.hypot(pushed.x - x2, pushed.y - y2) < 8 * PX_PER_M, `${id}: push did not move (${state(b)})`);
  }
  console.log(id.padEnd(8), res.join(' · '));
}
console.log(bad ? `${bad} FAILED` : 'PASS'); process.exit(bad ? 1 : 0);
