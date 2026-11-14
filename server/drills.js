// PRO DRILLS (he asked 2026-11-14): practice games built on ecological dynamics. Instead of only full matches, the
// pros also play small, constrained games that keep the real thing's key parts (a gunfight across cover, a clock,
// teammates to trade) and leave the rest out, scored so good play pays and bad play costs:
//   the Drill Hall (shared/maps/drill.js): a closed concrete hall, a steel line down the middle nobody crosses, two
//   bulletproof blocks across the line; no skills, gadgets, drones or going down; a simulated minute on the clock.
//   A draw is a loss for everyone (urgency), except in Hold or swing, where the holder only has to survive.
// Each drill tells us who is good at what (reactions, first-shot accuracy, headshots, duels, trades, clutches, holding,
// swinging) and which habits win fights (leaning past cover, crouching, jiggling, holding still, having heard them
// first). The pros learn their own drill style from it (bots.js drillThink, p.drillStyle), and their match play leans
// on it a little (leaning and peeking). Results are kept in training.drills (training.js), shown in BALL KNOWLEDGE and
// on each pro's PLAYBOOK page. Run by train-worker.js with each practice session; `node tests/drills.js` checks it.
import { Game } from './game.js';
import { setPro } from './bots.js';
import { DRILL_STYLE } from './training.js';
import { buildMap } from '../shared/map.js';
import { DRILL_MID, DRILL_W, DRILL_H } from '../shared/maps/drill.js';
import { PRO_TEAMS } from '../shared/pros.js';
import { OPERATORS, ARMOR_HP } from '../shared/operators.js';
import { PHASE, CELL, PRO_LEVEL } from '../shared/constants.js';

export const DRILL_TIME = 60; // he asked: each drill is a simulated minute
export const DRILLS = {
  duel: { name: 'Block duel', a: 1, b: 1, skill: 'Aim, reactions and peeking, one on one' },
  trade: { name: 'Two on two', a: 2, b: 2, skill: 'Trading a teammate and spacing' },
  hold: { name: 'Hold or swing', a: 1, b: 1, hold: true, skill: 'Holding an angle against someone who must make a play before time' },
  clutch: { name: 'Clutch', a: 1, b: 2, skill: 'Winning one against two' },
};
// the incentives: what good play earns and bad play costs (also what the pros learn their style from)
export const DRILL_PTS = { kill: 100, trade: 50, head: 20, first: 15, death: -100, open: -30, dry: -20, timeout: -80, held: 60, win: 120 };
// fight habits counted for "what wins fights" (p.drillFight in bots.js drillThink)
export const FEATS = ['lean', 'crouch', 'strafe', 'held', 'heard', 'firstShot', 'firstHit'];
export const PROS = PRO_TEAMS.flatMap((t, ti) => t.players.map((pl, i) => ({ name: pl.name, t: ti, i })));

const cellPt = (x, y) => ({ x: (x + 0.5) * CELL, y: (y + 0.5) * CELL });
// the hall's frame inside the built map: buildMap pads the ground, so find the hall by its room
function hall(m) { const r = m.rooms.find(r => r.name === 'Drill Hall'); return { x0: r.x - 1, y0: r.y - 1 }; } // (cell of the hall's own 0,0)
// edges of cover to hold or swing to, per side (0 = west), and the enemy side's edges to watch
function layout(m) {
  const { x0, y0 } = hall(m), P = (x, y) => cellPt(x0 + x, y0 + y), M = DRILL_MID;
  const side = s => { const near = s ? M + 4 : M - 4, back = s ? M + 9 : M - 9, crate = s ? [[30, 7], [29, 20], [28, 12]] : [[7, 4], [7, 19], [12, 11]];
    const wall = s ? DRILL_W - 4 : 5;
    return [P(near, 5), P(near, 9), P(near, 15), P(near, 19), P(near, 2), P(near, 23), P(near, 12), P(back, 12), P(wall, 7), P(wall, 18), ...crate.map(([x, y]) => P(x, y))]; };
  const ang = s => { const far = s ? M - 3 : M + 3; return [P(far, 5), P(far, 9), P(far, 15), P(far, 19), P(far, 12), P(far, 2), P(far, 23)]; };
  const start = s => [10, 15, 12, 11, 14].map(y => P(s ? DRILL_W - 1 : 2, y)); // behind their own wall
  return { spots: [side(0), side(1)], angles: [ang(0), ang(1)], start: [start(0), start(1)] };
}
const blankStat = () => ({ n: 0, w: 0, pts: 0, k: 0, d: 0, hs: 0, sh: 0, hit: 0, fs: 0, fsh: 0, rt: 0, rn: 0, tr: 0, trN: 0, cw: 0, cn: 0, hw: 0, hn: 0, sw: 0, sn: 0, dry: 0, open: 0, to: 0 });

// one drill: kind, side A and side B (pro names), each pro's style; returns what happened
export function runDrill(kind, A, B, styles = {}) {
  const K = DRILLS[kind], g = new Game(), m = buildMap('drill'), L = layout(m), dt = 1 / 30;
  g.mapId = 'drill'; g.map = m; g.botLevel = PRO_LEVEL; g.baseTiles = m.tiles.slice();
  const lineup = [A, B];
  for (const sq of [0, 1]) for (const name of lineup[sq]) { g.addBot(sq); }
  const bots = [...g.players.values()];
  const st = {}, fights = [];
  let bi = 0;
  for (const sq of [0, 1]) lineup[sq].forEach((name, j) => {
    const b = bots[bi++], P = PROS.find(x => x.name === name); b.squad = sq; setPro(b, P.t, P.i);
    const pl = PRO_TEAMS[P.t].players[P.i], pool = [...(pl.pool.atk || []), ...(pl.pool.def || [])]; // one of their own operators (only the look and guns count here)
    b.op = pool[Math.floor(Math.random() * pool.length)]; if (!OPERATORS[b.op]) b.op = Object.keys(OPERATORS)[0];
    b.drillStyle = { ...DRILL_STYLE, ...(styles[name] || {}) };
    b.ar = { kills: 0, lives: 0, lv: 0, out: false, op: b.op }; b.kills = 0; b.deaths = 0; b.ms = g.blankMatchStats(); b.locked = true;
    g.equip(b);
    b.abilityCount = 0; b.gadgetCount = 0; b.gadget = null; b.drones = 0; b.barri = 0; b.battery = 0; b.riot = null; b.hasDefuser = false;
    b.maxHp = ARMOR_HP[OPERATORS[b.op].armor]; b.hp = b.maxHp; b.slot = 0;
    const s = L.start[sq][j]; b.x = s.x; b.y = s.y; b.vx = b.vy = 0; b.alive = true; b.downed = false; b.ctrl = 'body';
    b.aim = sq ? Math.PI : 0;
    st[b.id] = { name, sq, s: blankStat(), seen: null, fired: false, firstOpen: false, lastShot: -9 };
  });
  g.arena = { mode: 'drill', ffa: false, end: DRILL_TIME, spots: [], lastOne: null };
  g.drill = { kind, time: DRILL_TIME, spots: L.spots, angles: L.angles, lastDeath: [null, null],
    onSee: (p) => { const r = st[p.id]; if (r) { r.seen = g.time; r.fired = false; r.firstOpen = true; } } };
  g.ents = []; g.planted = null; g.winner = null; g.noises = []; g.bans = []; g.spots = { atk: new Map(), def: new Map() };
  g.score = [0, 0]; g.round = 1; g.matchStart = Date.now(); g.departed = []; g.roundLog = [];
  g.phase = PHASE.ACTION; g.timer = DRILL_TIME;
  // what each shot, hit and kill means
  const fire0 = g.fire.bind(g);
  g.fire = (p, ...a) => { const r = st[p.id]; if (r) { r.s.sh++; if (r.firstOpen) { r.firstOpen = false; r.s.fs++; r.lastFirst = g.time; if (r.seen !== null) { r.s.rt += g.time - r.seen; r.s.rn++; } if (p.drillFight) p.drillFight.firstShot = !Object.values(st).some(o => o !== r && o.sq !== r.sq && o.lastFirst > (r.seen ?? 0) && o.lastFirst <= g.time); } r.fired = true; r.lastShot = g.time; } return fire0(p, ...a); };
  const dmg0 = g.damage.bind(g);
  g.damage = (q, amount, src, ...a) => { const r = src && st[src.id]; if (r && q !== src && st[q.id] && st[q.id].sq !== r.sq) { r.s.hit++; if (r.lastFirst === g.time) { r.s.fsh++; if (src.drillFight) src.drillFight.firstHit = true; } } return dmg0(q, amount, src, ...a); };
  const kill0 = g.kill.bind(g);
  g.kill = (q, src, w) => {
    const v = st[q.id], k = src && src !== q ? st[src.id] : null;
    if (v) {
      v.s.d++; v.s.pts += DRILL_PTS.death;
      if (q.moving >= 2 && !(q.drillFight && (q.drillFight.lean || q.drillFight.crouch))) { v.s.pts += DRILL_PTS.open; v.s.open++; } // caught running in the open
      if (!v.fired) { v.s.pts += DRILL_PTS.dry; v.s.dry++; } // swung without getting a shot off (a dry peek)
    }
    if (k && v && k.sq !== v.sq) {
      k.s.k++; k.s.pts += DRILL_PTS.kill;
      if (g.headshot) { k.s.hs++; k.s.pts += DRILL_PTS.head; }
      if (!fights.length) k.s.pts += DRILL_PTS.first;
      const ld = g.drill.lastDeath[k.sq];
      if (ld && g.time - ld.t < 3 && ld.byId === q.id) { k.s.tr++; k.s.pts += DRILL_PTS.trade; }
      fights.push({ k: { ...(src.drillFight || {}) }, v: { ...(q.drillFight || {}) }, hs: !!g.headshot, kn: k.name, vn: v.name });
    }
    if (v) { g.drill.lastDeath[v.sq] = { t: g.time, by: src || null, byId: src ? src.id : null }; for (const o of Object.values(st)) if (o.sq === v.sq && o !== v) o.s.trN++; }
    const r = kill0(q, src, w);
    q.ar && (q.ar.out = true);
    return r;
  };
  const aliveOf = sq => [...g.players.values()].filter(p => p.alive && st[p.id] && st[p.id].sq === sq).length;
  let win = -1, t = 0;
  while (g.phase === PHASE.ACTION && t < DRILL_TIME + 1) {
    g.tick(dt); g.events = []; t += dt;
    const a = aliveOf(0), b = aliveOf(1);
    if (!a || !b) { win = a ? 0 : b ? 1 : -1; break; }
    if (g.timer <= 0) { win = K.hold ? 1 : -1; break; }
  }
  // the clock ran out: a draw costs everyone still standing (except the holder, who did their job)
  for (const [id, r] of Object.entries(st)) {
    const p = g.players.get(id); r.s.n = 1;
    if (win === -1 && p && p.alive) { r.s.pts += DRILL_PTS.timeout; r.s.to++; }
    if (K.hold && win === 1 && r.sq === 1 && p && p.alive) r.s.pts += DRILL_PTS.held;
    if (win === r.sq) { r.s.w = 1; r.s.pts += DRILL_PTS.win; }
    if (kind === 'clutch' && r.sq === 0) { r.s.cn = 1; r.s.cw = win === 0 ? 1 : 0; }
    if (kind === 'hold') { if (r.sq === 1) { r.s.hn = 1; r.s.hw = win === 1 ? 1 : 0; } else { r.s.sn = 1; r.s.sw = win === 0 ? 1 : 0; } }
  }
  return { kind, a: A, b: B, win, time: Math.round(Math.min(t, DRILL_TIME)), stats: Object.fromEntries(Object.values(st).map(r => [r.name, r.s])), fights };
}

// a batch of drills (each pro in about the same number): their results added up for training.drills
export function drillSession(n, styles = {}) {
  const out = { n: 0, kinds: {}, pro: {}, feats: {}, styleRec: {} }, kinds = Object.keys(DRILLS);
  for (let i = 0; i < n; i++) {
    const kind = kinds[i % kinds.length], K = DRILLS[kind], names = PROS.map(p => p.name).sort(() => Math.random() - 0.5);
    const A = names.slice(0, K.a), B = names.slice(K.a, K.a + K.b);
    let r; try { r = runDrill(kind, A, B, styles); } catch (e) { out.crash = e.stack || String(e); continue; }
    addDrill(out, r);
  }
  return out;
}
// one drill's result into a running total (the same shape training.drills keeps)
export function addDrill(out, r) {
  out.n = (out.n || 0) + 1;
  const kk = out.kinds[r.kind] || (out.kinds[r.kind] = { n: 0, draws: 0, time: 0 }); kk.n++; kk.time += r.time; if (r.win === -1) kk.draws++;
  for (const [name, s] of Object.entries(r.stats)) { const P = out.pro[name] || (out.pro[name] = blankStat()); for (const k in s) P[k] = (P[k] || 0) + s[k]; }
  // habits in fights won and lost: [won, fights] when the killer or the victim had it and the other didn't
  for (const f of r.fights) for (const h of FEATS) {
    const a = !!f.k[h], b = !!f.v[h]; if (a === b) continue;
    const x = out.feats[h] || (out.feats[h] = [0, 0]); x[1]++; if (a) x[0]++;
  }
  // style learning: points with and without each habit, per pro ([points, fights] on / off)
  for (const f of r.fights) for (const [who, F, sign] of [[f.kn, f.k, 1], [f.vn, f.v, -1]]) {
    const R = out.styleRec[who] || (out.styleRec[who] = {});
    for (const h of ['lean', 'crouch', 'strafe', 'held']) { const x = R[h] || (R[h] = { on: [0, 0], off: [0, 0] }), y = F[h] ? x.on : x.off; y[0] += sign; y[1]++; }
  }
}
export { learnStyles } from './training.js'; // (after a session: each pro's style nudged toward the habits that won them fights)
