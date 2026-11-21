// Seeing and shooting by height (he asked 2026-11-18, shared/furniture.js): on a stretch of open floor a counter, a bed
// and a concrete barrier are put across the line between two people. Standing sees over the counter, crouched doesn't;
// lying down sees under the bed; a crouched target behind the counter is hidden and a shot at them is weakened (the
// counter lets a little through), the barrier stops it all; a standing target behind a desk-high thing takes the full hit.
// Run: node tests/furniture.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { buildMap } from '../shared/map.js';
import { castSight } from '../shared/physics.js';
import { furnLine, FURN_H, EYE_STANCE, HEAD_STANCE } from '../shared/furniture.js';
import { CELL, T, PHASE, PX_PER_M } from '../shared/constants.js';

let fails = 0;
const fail = (...a) => { fails++; console.log('FAIL', ...a); };
const ok = (c, ...a) => { if (!c) fail(...a); else console.log('ok  ', ...a); };
const g = new Game(); g.mapId = 'harbor'; g.map = buildMap('harbor');
for (let i = 0; i < 2; i++) g.addBot();
g.startMatch(); while ((g.phase !== PHASE.ACTION || g.introT > 0)) g.tick(1 / 30);
const m = g.map, W = m.W;
// an open stretch: 12 cells wide, 3 tall, all plain floor on one floor
let spot = null;
for (let y = 2; y < m.H - 4 && !spot; y++) for (let x = 2; x < W - 14 && !spot; x++) {
  let good = true; for (let j = 0; j < 3 && good; j++) for (let i = 0; i < 12 && good; i++) { const k = (y + j) * W + x + i; if (m.tiles[k] !== T.FLOOR || m.portal[k] >= 0 || (m.shape && m.shape[k]) || m.flAt[k] !== m.flAt[y * W + x]) good = false; }
  if (good) spot = { x, y };
}
if (!spot) { console.log('FAIL no open floor'); process.exit(1); }
let at = 6; const put = kind => { const h = FURN_H[kind], k = (spot.y + 1) * W + spot.x + at; m.tiles[k] = T.LOW; m.fTop[k] = Math.round(h[0] * PX_PER_M); m.fGap[k] = Math.round(h[1] * PX_PER_M); m.fPen[k] = Math.round(h[2] * 100); };
const A = { x: (spot.x + 2.5) * CELL, y: (spot.y + 1.5) * CELL }, B = { x: (spot.x + 9.5) * CELL, y: (spot.y + 1.5) * CELL }, d = B.x - A.x;
const sees = (eye, head) => furnLine(m, A.x, A.y, eye, B.x, B.y, head).see;
put('counter');
ok(castSight(m, A.x, A.y, 0, d, null, false, EYE_STANCE[0]) >= d - 2, 'standing: the view goes on over a counter');
ok(castSight(m, A.x, A.y, 0, d, null, false, EYE_STANCE[1]) < d - 2, 'crouched: a counter blocks the view');
ok(sees(EYE_STANCE[0], HEAD_STANCE[0]), 'standing sees a standing person behind a counter');
at = 8; put('counter'); ok(!sees(EYE_STANCE[1], HEAD_STANCE[1]), 'a crouched person right behind a counter is hidden from someone crouched'); ok(sees(EYE_STANCE[0], HEAD_STANCE[0]), '...and someone standing there shows'); m.tiles[(spot.y + 1) * W + spot.x + 8] = T.FLOOR; at = 6;
put('bed');
ok(castSight(m, A.x, A.y, 0, d, null, false, EYE_STANCE[2]) >= d - 2, 'lying down: the view goes under a bed');
ok(castSight(m, A.x, A.y, 0, d, null, false, EYE_STANCE[1]) >= d - 2, 'crouched: sees over a bed');
// shots: a body at B with the furniture right in front of it, shot from A by someone crouched
at = 8;
const [s, q] = [...g.players.values()];
const shoot = (kind, crouch) => {
  put(kind); s.x = A.x; s.y = A.y; s.input = { crouch: 1 }; s.pr = 0; q.x = B.x; q.y = B.y; q.alive = true; q.downed = false; q.hp = 500; q.maxHp = 500; q.input = { crouch: crouch ? 1 : 0 }; q.pr = 0; s.viewTime = null;
  const hp0 = q.hp; const r = g.hitscan(s, A.x, A.y, 0, 400, 40, 'K4 Carbine', 'AR'); return hp0 - q.hp;
};
const full = shoot('desk', false), cnt = shoot('counter', true), bar = shoot('barrier', true);
ok(full > 30, `a standing target behind a desk takes the full shot (${full})`);
ok(cnt > 0 && cnt < full * 0.5, `a crouched target behind a counter takes only what gets through it (${cnt} of ${full})`);
ok(bar === 0, `a concrete barrier stops the shot (${bar})`);
console.log(fails ? `FAIL (${fails})` : 'PASS');
process.exit(fails ? 1 : 0);
