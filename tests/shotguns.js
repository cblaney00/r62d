// Shotguns (he asked 2026-11-17: "very lethal close range, severe disadvantage from more than a room away, one whole room
// away might be a 2 shot kill but it should depend on the shotgun"; he chose: the pump one-shots within about 4 m).
// Fires every shotgun's real blast (pellet pattern, falloff, the server's hitscan) at a body at each distance and prints
// the average damage of a well-aimed blast and how many blasts drop a medium-armour operator (132 hp).
// Run: node tests/shotguns.js [blasts per distance]
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { T, CELL, PX_PER_M } from '../shared/constants.js';
import { WEAPONS, gunMods, ARMOR_HP } from '../shared/operators.js';

const N = Number(process.argv[2] || 300);
let fails = 0;
const fail = (...a) => { fails++; console.log('FAIL', ...a); };
const g = new Game({ free: true });
const a = g.addPlayer('Shooter', false), b = g.addPlayer('Target', false);
g.handle(a, { t: 'free', a: 'start', map: 'harbor', bots: 0 });
const m = g.map, W = m.W, need = Math.ceil(17 * PX_PER_M / CELL) + 2;
let row = -1, col = -1; // a long open strip outdoors: 17 m of plain ground, three cells wide
for (let y = 3; y < m.H - 3 && row < 0; y++) for (let x = 2; x + need < W - 2; x++) {
  let ok = true; for (let d = 0; d < need && ok; d++) for (const dy of [-2, -1, 0, 1, 2]) if (m.tiles[(y + dy) * W + x + d] !== T.FLOOR || m.shape[(y + dy) * W + x + d]) { ok = false; break; }
  if (ok) { row = y; col = x; break; }
}
if (row < 0) { console.log('no open strip found'); process.exit(1); }
const y0 = (row + 0.5) * CELL, x0 = (col + 0.5) * CELL;
export function blast(id, dist, ads = 1) { // average damage of one settled blast aimed at the middle of a body dist m away
  const w = WEAPONS[id]; let sum = 0;
  for (let i = 0; i < N; i++) {
    for (const q of [a, b]) { q.alive = true; q.downed = false; q.ctrl = 'body'; q.viewTime = null; q.staged = false; q.vx = q.vy = 0; q.air = 0; }
    a.x = x0; a.y = y0; b.x = x0 + dist * PX_PER_M; b.y = y0; b.hp = b.maxHp = 9999; b.op = 'veil'; // medium armour
    a.aim = 0; a.rc = 0; a.adsT = ads; a.shots = 0; a.lastShot = -99; a.time = 0; a.input = {}; a.pr = 0; a.lo = 0; a.aimX = b.x; a.aimY = b.y + 4; // the chest, not the head
    const gun = { w: id, ammo: 99, reserve: 0, m: gunMods(id) }; a.fireCd = 0;
    g.fire(a, gun, w);
    sum += 9999 - Math.max(0, b.hp);
  }
  return sum / N;
}
const D = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15];
const HP = ARMOR_HP[2];
const res = {};
console.log('damage of one aimed blast (medium armour, ' + HP + ' hp) at ' + D.map(d => d + 'm').join(' '));
for (const id of Object.keys(WEAPONS).filter(k => WEAPONS[k].cls === 'Shotgun')) {
  const r = res[id] = D.map(d => blast(id, d));
  console.log(WEAPONS[id].name.padEnd(18), r.map(v => String(Math.round(v)).padStart(4)).join(' '), '| blasts to drop:', r.map(v => v > 0 ? Math.min(9, Math.ceil(HP / v)) : '-').join(' '));
}
console.log('from the hip (not aimed):');
const hip = {};
for (const id of Object.keys(res)) { const r = hip[id] = D.map(d => blast(id, d, 0)); console.log(WEAPONS[id].name.padEnd(18), r.map(v => String(Math.round(v)).padStart(4)).join(' ')); }
if (hip.breaker[D.indexOf(2)] < HP) fail('the Breaker does not one-shot from the hip at 2 m', Math.round(hip.breaker[D.indexOf(2)]));
const at = (id, d) => res[id][D.indexOf(d)];
// the rules he asked for
if (at('breaker', 4) < HP) fail('the Breaker pump does not one-shot at 4 m', Math.round(at('breaker', 4)));
if (at('breaker', 7) < HP / 2) fail('the Breaker is not a 2-shot kill one room away (7 m)', Math.round(at('breaker', 7)));
if (at('breaker', 15) > HP / 3) fail('the Breaker is still strong past a room (15 m)', Math.round(at('breaker', 15)));
for (const id of ['tusk', 'hedge', 'stub', 'quill']) if (at(id, 2) < HP * 0.7) fail(WEAPONS[id].name, 'is not lethal up close (2 m)', Math.round(at(id, 2)));
for (const id of ['breaker', 'tusk', 'hedge', 'stub']) if (at(id, 12) > HP * 0.4) fail(WEAPONS[id].name, 'is too strong at 12 m', Math.round(at(id, 12)));
console.log(fails ? `${fails} failure(s)` : 'PASS shotguns');
process.exit(fails ? 1 : 0);
