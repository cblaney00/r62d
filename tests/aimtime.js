// How fast each bot rank gets its crosshair onto you (he asked for these times, Copper → Champion, in seconds:
// 1.5, 1.1, 0.9, 0.8, 0.7, 0.5, 0.3; the Pros at least as quick as Champion). Free play on Harbor: you stand still
// 10 m from a bot, appearing somewhere in its view it wasn't aiming at, and we time from the moment you are in sight
// to the moment its aim would hit your body. Run: node tests/aimtime.js [trials per rank]
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { assignPros } from '../server/bots.js';
import { store } from '../server/store.js';
import { BOT_LEVELS, PX_PER_M, PRO_LEVEL, CELL, T } from '../shared/constants.js';
import { los, angDiff } from '../shared/physics.js';
import { hitR } from '../shared/operators.js';
import { floorAt } from '../shared/map.js';

const N = +process.argv[2] || 40, D = 10 * PX_PER_M;
const WANT = [1.5, 1.1, 0.9, 0.8, 0.7, 0.5, 0.3];
const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
let fails = 0;

function measure(level) {
  const g = new Game({ free: true });
  const me = g.addPlayer('Target', false); me.token = store.login('Target').token; me.pid = 'x';
  g.handle(me, { t: 'free', a: 'start', map: 'harbor', bots: 0 });
  g.handle(me, { t: 'free', a: 'bot', side: 'enemy' });
  g.free.noFire = true; // time the aim only: nobody dies
  const b = [...g.players.values()].find(q => q.bot);
  if (level === PRO_LEVEL) { g.botLevel = PRO_LEVEL; assignPros(g); } else b.level = level;
  const FLOORS = []; g.map.tiles.forEach((t, k) => { if (t === T.FLOOR || t === T.GROUND) FLOORS.push(k); });
  const times = [];
  for (let n = 0, tries = 0; n < N && tries < N * 40; tries++) {
    for (let i = 0; i < 10; i++) { me.x = -4000; me.y = -4000; g.tick(1 / 30); } // out of the way for a moment
    const k = FLOORS[Math.floor(Math.random() * FLOORS.length)], s = { x: (k % g.map.W + 0.5) * CELL, y: (Math.floor(k / g.map.W) + 0.5) * CELL }; // the bot somewhere on the map, you in its view
    if (!s || !b.alive) continue;
    const dir = Math.random() * Math.PI * 2, x0 = s.x + Math.cos(dir) * D, y0 = s.y + Math.sin(dir) * D, q = g.freeSpotNear(x0, y0, 6);
    if (Math.hypot(q.x - x0, q.y - y0) > 6 || [q.x, q.y].some(Number.isNaN)) continue;
    const { x, y } = q;
    if (floorAt(g.map, x, y) !== floorAt(g.map, s.x, s.y) || !los(g.map, s.x, s.y, x, y, [])) continue;
    const off = (Math.random() < 0.5 ? -1 : 1) * (0.15 + Math.random() * ((b.pro ? 0.85 : 1.1) - 0.15));
    b.x = s.x; b.y = s.y; b.aim = Math.atan2(y - s.y, x - s.x) + off; if (b.ai) { b.ai.heard = null; b.ai.seen = null; }
    me.x = x; me.y = y; me.alive = true; me.downed = false; me.hp = me.maxHp;
    const tol = hitR(me.op) / D;
    let t = 0;
    for (; t < 4; t += 1 / 30) {
      g.tick(1 / 30); me.x = x; me.y = y;
      if (b.ai.react > 0 && Math.abs(angDiff(b.aim, Math.atan2(y - b.y, x - b.x))) < tol) break; // reacted and on you: its next shot hits
    }
    times.push(t); n++;
  }
  return times;
}

for (let L = 0; L <= PRO_LEVEL; L++) {
  const t = measure(L), m = med(t), want = WANT[L];
  const ok = want ? Math.abs(m - want) <= Math.max(0.1, want * 0.15) : m <= WANT[6] + 0.05;
  if (!ok) fails++;
  console.log(`${BOT_LEVELS[L].padEnd(9)} median ${m.toFixed(2)} s  (want ${want ? want.toFixed(2) : '≤' + (WANT[6] + 0.05).toFixed(2)})  ${t.length} tries  ${ok ? '' : 'OFF'}`);
}
console.log(fails ? `FAIL aimtime (${fails})` : 'PASS aimtime');
