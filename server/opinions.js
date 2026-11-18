// What each pro thinks is the worst thing in the game (he asked 2026-11-14): they know every patch (shared/patchnotes.js)
// as if they had played since the start, and after every practice session each one looks at the numbers (operators,
// guns, attachments, maps from practice; what wins fights in the drills) through their own style and role, and names
// one thing: an operator, a gun, an attachment, a map or a game rule. The view is kept in a log per pro
// (training.opinions[name], newest last), so BALL KNOWLEDGE and their PLAYBOOK page show how it moved over time.
import { training } from './training.js';
import { PATCH_NOTES } from '../shared/patchnotes.js';
import { PRO_TEAMS, PRO_PERSONA, JOB_NAME } from '../shared/pros.js';
import { OPERATORS, WEAPONS, ATTACH, SIDEARMS, gunSide } from '../shared/operators.js';
import { MAPS, MAP_LIST } from '../shared/map.js';

const pct = x => Math.round(x * 100) + '%';
const LOG_MAX = 40;
// which game rules bother which kind of player: role (their attack / defence jobs) and style (aggression, patience)
const ROLE_HATES = { entry: ['speed', 'headaim', 'hitbox', 'trails'], intel: ['drones', 'fog', 'sound', 'cams'], breach: ['softwalls', 'reinforce', 'barricades'],
  support: ['hitbox', 'status', 'defuser'], flank: ['sound', 'runout', 'trails'], anchor: ['softwalls', 'floors', 'ropes'], trapper: ['drones', 'trails', 'reinforce'],
  roamer: ['runout', 'sound', 'windows'] };
// why a rule hurts, in the player's words
const MECH_WHY = { speed: 'every entry takes so long the defence is always set', trails: 'every shot I take gives my spot away', hitbox: 'the first bullet decides too much and nobody can be pixel-perfect every time',
  sound: 'I can\'t track a slow walker through a wall any more', runout: 'you can\'t make a play outside without the whole team knowing', defuser: 'one dropped defuser and the round is over',
  softwalls: 'there is almost nothing left to open', reinforce: 'you need twice the walls to hold a site', drones: 'one stray bullet and my intel is gone',
  fog: 'my team\'s eyes don\'t help me any more', stairs: 'I can\'t cut onto a staircase from the side any more', headaim: 'heads are so small that taps don\'t land', ropeexit: 'once you are on a rope you are stuck there', drones2: '' };
const notesFor = id => PATCH_NOTES.filter(n => n.id === id);
const when = n => n ? ` (since the ${n.d.slice(5).replace('-', '/')} patch: ${n.t.charAt(0).toLowerCase() + n.t.slice(1).replace(/\.$/, '')})` : '';
// a small steady lean of each pro's own (so ten people looking at the same numbers don't all say the same thing)
const quirk = (name, k) => { let h = 2166136261; for (const c of name + '|' + k) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 1000) / 1000; };

function candidates(pl) {
  const out = [], [aggr, patience] = PRO_PERSONA[pl.name] || [0.5, 0.5], sure = n => Math.min(1, n / 60);
  // operators that win far too much (the other side's, mostly: those are the ones beating them)
  // (2026-11-15) measured against the average operator of the same side, so a side that wins more overall doesn't make
  // every one of its operators look broken (that is the 'sides' complaint below), and only once there are enough rounds
  const sideAvg = {}; for (const [op, x] of Object.entries(training.opx || {})) { if (!OPERATORS[op]) continue; const a = sideAvg[OPERATORS[op].team] || (sideAvg[OPERATORS[op].team] = [0, 0]); a[0] += x[0]; a[1] += x[1]; }
  for (const [op, x] of Object.entries(training.opx || {})) {
    if (!OPERATORS[op] || !x[0]) continue; const sa = sideAvg[OPERATORS[op].team], wr = (x[1] + 1) / (x[0] + 2) - sa[1] / Math.max(1, sa[0]) + 0.5; if (wr < 0.53) continue;
    const mine = (pl.pool.atk || []).concat(pl.pool.def || []).includes(op);
    out.push({ kind: 'op', id: op, s: Math.min(1, (wr - 0.5) * 4) * Math.min(1, x[0] / 500) * (mine ? 0.4 : 1), text: `${OPERATORS[op].name} is the worst thing in the game right now: the team with ${OPERATORS[op].name} wins ${pct((x[1] + 1) / (x[0] + 2))} of practice rounds, ${Math.round((wr - 0.5) * 100)} points over the average ${OPERATORS[op].team === 'atk' ? 'attacker' : 'defender'}.${when(notesFor(op).slice(-1)[0])}` });
  }
  // guns: kills a round across every operator that carries it
  const guns = {}; for (const [k, r] of Object.entries(training.guns || {})) { const w = k.split('|')[1], g = guns[w] || (guns[w] = [0, 0, 0, 0]); r.forEach((v, i) => { g[i] += v; }); }
  // A main gun is judged against the other main guns of its own side (2026-11-15: compared only with its own kind, the
  // Anvil slug, a long-range defence primary, always looked broken next to the close-range shotguns while it sat mid-pack
  // among the guns it really competes with for the slot), and only when it also wins more rounds than they do.
  const kpr = Object.entries(guns).filter(([w, g]) => WEAPONS[w] && !SIDEARMS.has(w) && g[0] >= 40).map(([w, g]) => ({ w, side: gunSide(w), k: g[2] / g[0], wr: (g[1] + 1) / (g[0] + 2), n: g[0] }));
  for (const g of kpr) {
    const same = kpr.filter(x => x.side === g.side && x !== g); if (same.length < 3) continue;
    const n = same.reduce((a, x) => a + x.n, 0), avg = same.reduce((a, x) => a + x.k * x.n, 0) / n, wrAvg = same.reduce((a, x) => a + x.wr * x.n, 0) / n;
    if (g.k < avg * 1.2 || g.k - avg < 0.12 || g.wr < wrAvg + 0.03 || g.k * g.n < 20) continue; // (a real gap in kills AND in wins, in guns that really get used)
    out.push({ kind: 'gun', id: g.w, s: Math.min(1, g.k / avg - 1) * 1.2 * sure(g.n) * (0.6 + aggr * 0.5), text: `The ${WEAPONS[g.w].name} is broken: ${g.k.toFixed(2)} kills a round and ${pct(g.wr)} of rounds won in practice; the other ${g.side === 'def' ? 'defence' : 'attack'} main guns get ${avg.toFixed(2)} and ${pct(wrAvg)}.${when(notesFor(g.w).slice(-1)[0])}` });
  }
  // one side winning too often overall (he asked for 45-50% attack): attack-minded players feel it most
  { let a = [0, 0]; for (const [k, r] of Object.entries(training.ops || {})) { const side = k.split('|')[1]; if (side === 'atk') { a[0] += r.n; a[1] += r.w; } }
    const ar = (a[1] + 1) / (a[0] + 2);
    if (a[0] >= 500 && Math.abs(ar - 0.5) > 0.05) { const def = ar < 0.5; out.push({ kind: 'mech', id: 'sides', s: Math.abs(ar - 0.5) * 4 * (def ? 0.7 + aggr * 0.5 : 0.7 + patience * 0.5), text: `The game leans ${def ? 'defence' : 'attack'}: attackers win ${pct(ar)} of practice rounds. ${def ? 'Defenders get too long to set up and too many places to hold from.' : 'Defenders can\'t hold anything long enough.'}` }); } }
  // attachments that win much more than the others in their slot on the same gun
  const awr = r => (r[1] + r[2] + 1) / (r[0] + r[2] + r[3] + 2), slotAvg = {}; // (2026-11-15) against the other choices for that slot on that gun, not 50%: a strong gun made all its parts look broken
  for (const [k, r] of Object.entries(training.att || {})) { const [w, slot] = k.split('|'), a = slotAvg[w + '|' + slot] || (slotAvg[w + '|' + slot] = [0, 0]); a[0] += r[0]; a[1] += awr(r) * r[0]; }
  for (const [k, r] of Object.entries(training.att || {})) {
    const [w, slot, c] = k.split('|'); if (c === 'none' || !WEAPONS[w] || !ATTACH[slot] || !ATTACH[slot][c] || r[0] < 25) continue;
    const sa = slotAvg[w + '|' + slot], others = (sa[1] - awr(r) * r[0]) / Math.max(1, sa[0] - r[0]); if (sa[0] - r[0] < 25) continue;
    const wr = awr(r) - others + 0.5; if (wr < 0.56) continue;
    out.push({ kind: 'att', id: k, s: (wr - 0.5) * 3 * sure(r[0]) * (0.5 + patience * 0.4), text: `${ATTACH[slot][c].name} on the ${WEAPONS[w].name} is too good: setups with it win ${pct(awr(r))} of their fights and rounds, the other choices ${pct(others)}. Everyone runs it.` });
  }
  // maps: one side winning far too often
  const maps = {}; for (const [k, r] of Object.entries(training.plans || {})) { const [m, , side] = k.split('|'); if (!MAPS[m] || !MAP_LIST.includes(m)) continue; const x = maps[m] || (maps[m] = { atk: [0, 0], def: [0, 0] }); x[side][0] += r.n; x[side][1] += r.w; }
  for (const [m, x] of Object.entries(maps)) {
    const n = x.atk[0] + x.def[0]; if (n < 30) continue; const a = (x.atk[1] + 1) / (x.atk[0] + 2);
    if (Math.abs(a - 0.5) <= 0.05) continue; // (he set 2026-11-15: 45-55% attack is healthy)
    const fav = a > 0.5 ? 'attack' : 'defence', hurt = a > 0.5 ? (pl.jobs.def === 'anchor' || pl.jobs.def === 'trapper') : (pl.jobs.atk === 'entry' || pl.jobs.atk === 'breach');
    out.push({ kind: 'map', id: m, s: Math.abs(a - 0.5) * 3 * sure(n) * (hurt ? 1.3 : 0.9), text: `${MAPS[m].name} is the worst map: ${fav} wins ${pct(a > 0.5 ? a : 1 - a)} of practice rounds there. It needs another way in${a > 0.5 ? ' that defenders can hold' : ' for attackers'}.` });
  }
  // game rules from the patch notes that cut against how they play
  const hates = new Set([...(ROLE_HATES[pl.jobs.atk] || []), ...(ROLE_HATES[pl.jobs.def] || [])]);
  PATCH_NOTES.forEach((n, i) => {
    if (n.k !== 'mech' || n.v >= 0) return;
    const fit = (hates.has(n.id) ? 1 : 0.25) * (n.id === 'speed' || n.id === 'trails' ? 0.6 + aggr * 0.6 : n.id === 'runout' || n.id === 'windows' ? 0.6 + patience * 0.5 : 0.8);
    const fresh = 0.6 + 0.4 * (i / PATCH_NOTES.length); // newer changes still sting more
    const why = MECH_WHY[n.id] || 'it takes away more than it adds';
    out.push({ kind: 'mech', id: n.id, s: fit * fresh * 0.45, text: `The ${n.d.slice(5).replace('-', '/')} change is the worst thing in the game: ${n.t.charAt(0).toLowerCase() + n.t.slice(1).replace(/\.$/, '')}. As ${/^[aeiou]/i.test(JOB_NAME[pl.jobs.atk] || '') ? 'an' : 'a'} ${(JOB_NAME[pl.jobs.atk] || pl.jobs.atk).toLowerCase()} ${why}.` });
  });
  // drills: the fight habit that wins the most in drills, when they are among the worst at it
  const D = training.drills; if (D && D.pro && D.pro[pl.name] && D.feats) {
    const me = D.pro[pl.name], all = Object.values(D.pro), fsh = p => p.fs ? p.fsh / p.fs : 0;
    const f = D.feats.firstHit; if (f && f[1] >= 20 && f[0] / f[1] > 0.6 && fsh(me) <= Math.min(...all.map(fsh)) + 0.03) {
      const n = notesFor('hitbox').slice(-1)[0];
      out.push({ kind: 'mech', id: 'hitbox', s: (f[0] / f[1] - 0.5) * 1.2, text: `Bodies are too thin: the first bullet decides ${pct(f[0] / f[1])} of fights in the drills, and the hitboxes punish everyone who isn't pixel-perfect.${when(n)}` });
    }
  }
  return out;
}

// every pro forms (or keeps) their view; a log line is added each session, marked when it changed
export function formOpinions(version) {
  const O = training.opinions || (training.opinions = {}), session = (training.sessions = (training.sessions || 0) + 1);
  for (const team of PRO_TEAMS) for (const pl of team.players) {
    const c = candidates(pl); if (!c.length) continue;
    for (const x of c) x.sc = x.s * (0.75 + 0.5 * quirk(pl.name, x.kind + x.id)); // their own lean
    c.sort((a, b) => b.sc - a.sc);
    const log = O[pl.name] || (O[pl.name] = []), last = log[log.length - 1], pick = last && c.find(x => x.kind === last.kind && x.id === last.id && x.sc > c[0].sc * 0.85) || c[0]; // a view is not dropped for a slightly stronger one
    log.push({ at: Date.now(), v: version, s: session, kind: pick.kind, id: pick.id, text: pick.text, changed: !last || last.kind !== pick.kind || last.id !== pick.id ? 1 : 0, runner: c.find(x => x !== pick) ? c.find(x => x !== pick).text : '' });
    if (log.length > LOG_MAX) log.splice(0, log.length - LOG_MAX);
  }
  return O;
}
