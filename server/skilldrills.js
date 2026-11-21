// SKILL DRILLS (he asked 2026-11-20): "set up drills so the operators can train using the characters utility in a variety of
// situations where it would be beneficial. the pros should also have the ability to send suggestions to improve the drills if
// they're not getting better or they disagree with the situational viability of the training environment".
// The gun drills (drills.js) leave skills out on purpose. These are the other half: a short real 1V1 round on a small map
// (house or cabin, the real rules, the real skill and gadget), set up as one SITUATION where that operator's skill should pay
// off: a ground-floor site to break into, an upstairs site, a retake after the plant, a defender holding the site, a defender
// roaming, the last 45 seconds. Every drill is played twice in turn, with the skill and with it locked, so the gap between the two
// says how much the skill is really worth in that situation.
// Training: each pro has a number per operator, how readily they reach for the skill (training.skill[name][op].eager, read by
// bots.js skillEager in every match). In drills it is tried a little higher and a little lower; whichever wins more is where it
// moves. Their progress per situation is kept per session (prog), which is what "not getting better" is judged on.
// The pros' drill ideas (formDrillIdeas, run after every practice): not getting better, the skill doesn't help in a situation,
// or a situation that hardly happens in real matches; each comes with an exact change. A change two or more pros back is adopted
// (training.skillDrills.tweaks) and the next practice uses it (he chose 2026-11-20).
// Run by train-worker.js with every practice session; `node tests/skilldrills.js` checks it; tests/skillgap.js uses runSkillDrill.
import { Game } from './game.js';
import { setPro } from './bots.js';
import { PHASE, DUR, CELL, TEAM, PRO_LEVEL } from '../shared/constants.js';
import { MAPS, MAP_LIST, buildMap, localPos } from '../shared/map.js';
import { OPERATORS, OP_LIST, jobOf } from '../shared/operators.js';
import { PRO_TEAMS } from '../shared/pros.js';

export const SMALL = MAP_LIST.filter(k => MAPS[k].small);
export const SITUATIONS = {
  entry: { name: 'Breaking in', text: 'a ground-floor site with the defender on it' },
  upstairs: { name: 'Upstairs site', text: 'the site is upstairs: going up, or holding over the stairs' },
  retake: { name: 'After the plant', text: 'the defuser is already down: one side holds it, the other has to get it back' },
  hold: { name: 'Site anchor', text: 'the defender stays on the site the whole round' },
  roam: { name: 'Roamer', text: 'the defender is out hunting in the rooms round the site' },
  late: { name: 'Last 45 seconds', text: 'the round starts with 45 seconds left: no time to wait' },
};
// where each skill should pay off (2-3 situations each; anything not listed uses its side's default)
export const SKILL_SIT = {
  cutter: ['entry', 'upstairs'], lance: ['entry', 'upstairs'], slug: ['entry', 'hold'], sticky: ['entry', 'hold'], saw: ['entry', 'hold'],
  hammer: ['entry', 'hold'], dash: ['entry', 'late'], pick: ['entry', 'roam'], emp: ['entry', 'hold'], arc: ['hold', 'entry'],
  dart: ['hold', 'roam'], sonar: ['roam', 'hold'], scope: ['hold', 'entry'], spike: ['hold', 'retake'], tracer: ['roam', 'late'],
  brace: ['entry', 'retake'], adrenal: ['entry', 'late'], cluster: ['hold', 'retake'], decoy: ['roam', 'entry'], ghost: ['roam', 'entry'],
  barrage: ['entry', 'retake'], flare: ['entry', 'hold'], medkit: ['retake', 'late'], cover: ['retake', 'entry'], burst: ['entry', 'retake'],
  lunge: ['roam', 'entry'], overwatch: ['hold', 'retake'], ghillie: ['retake', 'roam'], spotter: ['roam', 'hold'], pierce: ['hold', 'retake'],
  drill: ['upstairs', 'hold'], grapple: ['upstairs', 'entry'],
  htrap: ['upstairs', 'hold'], dropcharge: ['upstairs', 'retake'], panel: ['hold', 'entry'], jammer: ['hold', 'entry'], mine: ['hold', 'entry'],
  stim: ['retake', 'late'], scan: ['roam', 'retake'], prox: ['hold', 'entry'], turret: ['hold', 'entry'], concuss: ['hold', 'retake'],
  grid: ['entry', 'upstairs'], shroud: ['roam', 'retake'], sensor: ['hold', 'roam'], plates: ['hold', 'retake'], gas: ['hold', 'retake'],
  clamp: ['hold', 'entry'], stickycam: ['hold', 'roam'], weld: ['hold', 'entry'], alarm: ['hold', 'roam'], tag: ['roam', 'retake'],
  echobox: ['roam', 'hold'], pace: ['retake', 'hold'], periscope: ['upstairs', 'hold'], radar: ['hold', 'entry'], station: ['hold', 'retake'],
  catcher: ['hold', 'retake'], beam: ['hold', 'entry'], swarm: ['hold', 'entry'],
};
const SIDE_SIT = { atk: ['entry', 'late'], def: ['hold', 'retake'] };
export const EAGER_STEP = 1.12; // how far a session's verdict moves a pro's eagerness
const PROS = PRO_TEAMS.flatMap((t, ti) => t.players.map((pl, i) => ({ name: pl.name, t: ti, i, pl })));

// the situations a skill is drilled in, after the pros' adopted changes
export function sitsFor(ab, side, tweaks = {}) { return (tweaks.sitFor && tweaks.sitFor[ab]) || SKILL_SIT[ab] || SIDE_SIT[side]; }
const siteFloor = (m, i) => localPos(m, m.sites[i].bombs[0].x, m.sites[i].bombs[0].y).f;

// One skill drill: a 1V1 round. o = { op, sit, trainee (pro name), opp (pro name), oppOp, skill (false = locked), eager, map, tweaks }
// returns { win (the trainee's side won), uses, time, reason, sit, map }
export function runSkillDrill(o) {
  const tweaks = o.tweaks || {}, mapId = o.map || (tweaks.map && tweaks.map[o.sit]) || SMALL[Math.floor(Math.random() * SMALL.length)];
  const side = OPERATORS[o.op].team, oppOp = o.oppOp || (() => { const c = OP_LIST.filter(k => OPERATORS[k].team !== side); return c[Math.floor(Math.random() * c.length)]; })();
  const selT = DUR.select; DUR.select = 1;
  const g = new Game(); g.mode = 'duel'; g.mapId = mapId; g.map = buildMap(mapId); g.botLevel = PRO_LEVEL;
  const bans = g.rules.bans; g.rules.bans = false; // (put back below: the 1V1 rules object is shared)
  g.addBot(0); g.addBot(1);
  const [b0, b1] = [...g.players.values()];
  let me = null, them = null, t = 0, last = null, setUp = false, result = null, forced = false;
  try {
    g.startMatch();
    while (t < 240 && !result) {
      if (g.phase === PHASE.SELECT && !forced) {
        const atk = g.atkSquad(); me = side === TEAM.ATK ? (b0.squad === atk ? b0 : b1) : (b0.squad === atk ? b1 : b0); them = me === b0 ? b1 : b0;
        for (const [p, name, op] of [[me, o.trainee, o.op], [them, o.opp, oppOp]]) {
          const P = PROS.find(x => x.name === name); if (P) setPro(p, P.t, P.i);
          p.op = op; p._forced = op; p.job = jobOf(op);
        }
        me.skillEager = o.eager || null;
        // the site for the situation: lowest floor for breaking in, highest for upstairs
        const m = g.map, idx = m.sites.map((_, i) => i);
        if (o.sit === 'entry') g.site = idx.sort((a, b) => siteFloor(m, a) - siteFloor(m, b))[0];
        if (o.sit === 'upstairs') g.site = idx.sort((a, b) => siteFloor(m, b) - siteFloor(m, a))[0];
        forced = true;
      }
      if (g.phase === PHASE.PREP && me && me.op === o.op && o.skill === false && !me._locked) { me._locked = true; me.abLock = true; } // locked: the skill does nothing (game.js useAbility and the held skills)
      g.tick(1 / 30); t += 1 / 30; g.events.length = 0;
      if (g.phase === PHASE.ACTION && !(g.introT > 0) && !setUp) { setUp = true; situation(g, o.sit, me, them, tweaks); me.abAt = me.abUsed || 0; }
      if (g.phase !== last) { if (g.phase === PHASE.ROUND_END && last === PHASE.ACTION) result = { win: g.winner === me.squad ? 1 : 0, reason: g.reason || '' }; last = g.phase; }
      if (g.phase === PHASE.LOBBY && t > 5) break;
    }
  } finally { DUR.select = selT; g.rules.bans = bans; }
  const used = me ? Math.max(0, (me.abUsed || 0) - (me.abAt || 0)) : 0;
  return { win: result ? result.win : 0, done: !!result, uses: used, time: Math.round(t), reason: result ? result.reason : 'unfinished', sit: o.sit, map: mapId, op: o.op, oppOp };
}

// the situation, set once the action starts
function situation(g, sit, me, them, tweaks) {
  const def = g.side(me) === TEAM.DEF ? me : them, atk = def === me ? them : me, site = g.map.sites[g.site], bomb = site.bombs[0];
  if (def.ai) def.ai.role = sit === 'roam' ? 'roamer' : sit === 'hold' || sit === 'entry' ? 'anchor' : def.ai.role;
  if (sit === 'late') g.timer = Math.min(g.timer, 45 + ((tweaks.time && tweaks.time.late) || 0));
  if (sit === 'retake') { // the defuser is down: the attacker beside it, the defender a few rooms away
    const pos = g.freeSpotNear(bomb.x, bomb.y, 40); atk.x = pos.x; atk.y = pos.y; atk.vx = atk.vy = 0; atk.hasDefuser = false;
    const away = g.freeCellsInRooms(g.map.rooms.map(r => r.name).filter(r => r && !site.rooms.includes(r))).filter(k => { const x = (k % g.map.W + 0.5) * CELL, y = (Math.floor(k / g.map.W) + 0.5) * CELL; return Math.hypot(x - bomb.x, y - bomb.y) > 10 * CELL && Math.hypot(x - bomb.x, y - bomb.y) < 22 * CELL; });
    if (away.length) { const k = away[Math.floor(Math.random() * away.length)]; def.x = (k % g.map.W + 0.5) * CELL; def.y = (Math.floor(k / g.map.W) + 0.5) * CELL; def.vx = def.vy = 0; }
    g.planted = { x: bomb.x, y: bomb.y, bomb: bomb.id, t: DUR.bomb + ((tweaks.time && tweaks.time.retake) || 0) };
  }
}

// A session of skill drills: n pairs (with the skill, then locked), operators taken in turn so each gets drilled.
// skill = training.skill (eagerness per pro), SD = training.skillDrills (for the adopted tweaks). Returns a total for addSkillDrills.
export function skillSession(n, skill = {}, SD = {}) {
  const out = { n: 0, sit: {}, pro: {}, eag: {} }, tweaks = SD.tweaks || {};
  let k = Math.floor(Math.random() * OP_LIST.length);
  for (let i = 0; i < n; i++) {
    const op = OP_LIST[k++ % OP_LIST.length], side = OPERATORS[op].team, ab = OPERATORS[op].ability.id;
    const sits = sitsFor(ab, side, tweaks), sit = sits[Math.floor(Math.random() * sits.length)];
    const own = PROS.filter(P => (P.pl.pool[side] || []).includes(op)), P = own.length && Math.random() < 0.7 ? own[Math.floor(Math.random() * own.length)] : PROS[Math.floor(Math.random() * PROS.length)];
    const opp = PROS.filter(x => x.t !== P.t)[Math.floor(Math.random() * 5)] || PROS[0];
    const base = (skill[P.name] && skill[P.name][op] && skill[P.name][op].eager) || 1, hi = Math.random() < 0.5, eager = base * (hi ? EAGER_STEP : 1 / EAGER_STEP);
    const map = (tweaks.map && tweaks.map[sit]) || SMALL[i % SMALL.length], oppOp = (() => { const c = OP_LIST.filter(x => OPERATORS[x].team !== side); return c[Math.floor(Math.random() * c.length)]; })();
    let on, off;
    try {
      on = runSkillDrill({ op, sit, trainee: P.name, opp: opp.name, oppOp, skill: true, eager, map, tweaks });
      off = runSkillDrill({ op, sit, trainee: P.name, opp: opp.name, oppOp, skill: false, map, tweaks });
    } catch (e) { out.crash = e.stack || String(e); continue; }
    if (!on.done || !off.done) continue;
    out.n++;
    const s = out.sit[op + '|' + sit] || (out.sit[op + '|' + sit] = [0, 0, 0, 0, 0]); s[0]++; s[1] += on.win; s[2]++; s[3] += off.win; s[4] += on.uses;
    const pr = (out.pro[P.name] || (out.pro[P.name] = {}))[sit] || (out.pro[P.name][sit] = [0, 0]); pr[0]++; pr[1] += on.win;
    const e = (out.eag[P.name] || (out.eag[P.name] = {}))[op] || (out.eag[P.name][op] = { hi: [0, 0], lo: [0, 0] }); const h = hi ? e.hi : e.lo; h[0] += on.win; h[1]++;
  }
  return out;
}
