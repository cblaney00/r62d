// What each pro thinks is the worst thing in the game (he asked 2026-11-14): they know every patch (shared/patchnotes.js)
// as if they had played since the start, and after every practice session each one looks at the numbers (operators,
// guns, attachments, maps from practice; what wins fights in the drills) through their own style and role, and names
// one thing: an operator, a gun, an attachment, a map or a game rule. The view is kept in a log per pro
// (training.opinions[name], newest last), so BALL KNOWLEDGE and their PLAYBOOK page show how it moved over time.
import { training } from './training.js';
import { PATCH_NOTES } from '../shared/patchnotes.js';
import { PRO_TEAMS, PRO_PERSONA, JOB_NAME } from '../shared/pros.js';
import { OPERATORS, WEAPONS, ATTACH, SIDEARMS, gunSide } from '../shared/operators.js';
import { MAPS, MAP_LIST, buildMap } from '../shared/map.js';
import { SITUATIONS, sitsFor, SMALL as SMALL_MAPS } from './skilldrills.js';

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
  fog: 'my team\'s eyes don\'t help me any more', stairs: 'I can\'t cut onto a staircase from the side any more',
  stairsight: 'I can\'t watch the whole staircase from the back of the room any more', headaim: 'heads are so small that taps don\'t land', ropeexit: 'once you are on a rope you are stuck there', drones2: '' };
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
  try { formSuggestions(version); } catch (e) { console.log('pro suggestions failed:', e.message); }
  try { formDrillIdeas(version); } catch (e) { console.log('pro drill ideas failed:', e.message); }
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

// ---------------- suggestions (he asked 2026-11-18) ----------------
// Besides the worst thing in the game, every pro now puts forward one change after each practice: a HOLE (something the
// numbers say is missing or lopsided: a bomb site one side nearly always wins, an operator with nothing to offer, rounds
// that keep running out the clock) or something to TAKE OUT (a mechanic that hardly ever happens, so it is one more
// thing to learn for nothing). They talk like people who grew up with the game and want it around for years.
// Logged in training.suggestions[name] (last 20), shown in BALL KNOWLEDGE → PRO IDEAS.
const CARE = [ // how each one opens (picked by a steady quirk of their name)
  'I\'ve played this since I was a kid, so I\'ll say it straight:', 'I grew up on this game and I want my kids to play it:', 'This game raised me, and that\'s why this one bugs me:',
  'I\'ve been here since the first patch and I still love it, so hear me out:', 'I want this game around for another twenty years, so:', 'Honestly, as someone who learned to aim in this game:',
  'My first ranked game was on this, and I still care too much, so:', 'Ten thousand hours in, here\'s what I\'d fix first:', 'Every player I coach asks me about this, and they\'re right:', 'Love this game. That\'s why I\'ll say it:',
];
// the habits practice counts (bots.js feat, train-worker.js), by what they are in the game
const MECH = { rappel: 'rappelling to the site windows', roof: 'going in from the roof', rat: 'the rat spots', slide: 'the power slide', prone: 'lying down', vault: 'vaulting',
  wallbang: 'shooting through walls', glare: 'scope glare', feeds: 'watching team camera feeds', droneCheck: 'droning a room before going in', hatchBlast: 'HOIST\'s hatch charge', stairKill: 'fights up and down the stairs' };
const MECH_OP = { hatchBlast: 'hoist' };
const MECH_CORE = new Set(['stairKill', 'feeds']); // part of how the game is built: can't come out, only be made worth doing // mechanics only one operator has: judged by that operator's rounds
const ROLE_CARES = { entry: ['clock', 'site', 'slide'], intel: ['droneCheck', 'feeds', 'glare'], breach: ['site', 'wallbang', 'hatchBlast'], support: ['op', 'clock'], flank: ['rappel', 'roof', 'rat'],
  anchor: ['site', 'stairKill', 'rat'], trapper: ['site', 'feeds'], roamer: ['stairKill', 'rat', 'clock'] };
function ideas(pl) {
  const out = [], cares = new Set([...(ROLE_CARES[pl.jobs.atk] || []), ...(ROLE_CARES[pl.jobs.def] || [])]), [aggr, patience] = PRO_PERSONA[pl.name] || [0.5, 0.5];
  const w = id => cares.has(id) ? 1.4 : 1;
  // holes: a bomb site one side nearly always wins
  const sites = {};
  for (const [k, r] of Object.entries(training.plans || {})) { const [m, si, side] = k.split('|'); if (!MAPS[m] || !MAP_LIST.includes(m)) continue; const x = sites[m + '|' + si] || (sites[m + '|' + si] = { m, si: +si, n: 0, aw: 0 }); if (side === 'atk') { x.n += r.n; x.aw += r.w; } }
  for (const x of Object.values(sites)) {
    if (x.n < 25) continue; const a = (x.aw + 1) / (x.n + 2), off = Math.abs(a - 0.5); if (off < 0.14) continue;
    const site = buildSiteName(x.m, x.si); if (!site) continue;
    out.push({ kind: 'hole', id: 'site:' + x.m + ':' + x.si, s: off * 3 * Math.min(1, x.n / 60) * w('site'), why: `attack wins ${pct(a)} of ${x.n} practice rounds there`,
      text: `${site} on ${MAPS[x.m].name} is a hole: ${a > 0.5 ? 'the defence can\'t hold it. It needs one more wall the defenders can reinforce, or a rotation in that the attackers can\'t watch from outside' : 'attackers almost never get in. It needs a second way in that isn\'t a long hallway, or a breakable wall they can open'}.` });
  }
  // holes: an operator the team does worse with than without, and who gets little done
  const all = Object.entries(training.opx || {}).filter(([op, x]) => OPERATORS[op] && x[0] >= 40), side = {};
  for (const [op, x] of all) { const t = OPERATORS[op].team, a = side[t] || (side[t] = [0, 0]); a[0] += x[0]; a[1] += x[1]; }
  for (const [op, x] of all) {
    const sa = side[OPERATORS[op].team], avg = sa[1] / Math.max(1, sa[0]), wr = (x[1] + 1) / (x[0] + 2), kpr = x[2] / x[0]; if (wr > avg - 0.07) continue;
    out.push({ kind: 'hole', id: 'op:' + op, s: (avg - wr) * 4 * Math.min(1, x[0] / 120) * w('op'), why: `the team with ${OPERATORS[op].name} wins ${pct(wr)} of rounds, ${Math.round((avg - wr) * 100)} points under the average, ${kpr.toFixed(2)} kills a round`,
      text: `${OPERATORS[op].name} has a hole in the kit: picking them makes your team worse right now. Give them one thing only they can do, or people will stop playing them and they\'ll be gone in all but name.` });
  }
  // holes: rounds that run out the clock (nobody can get the defuser in)
  for (const [m, e] of Object.entries(training.ends || {})) {
    if (!MAPS[m] || !MAP_LIST.includes(m)) continue; const n = Object.values(e).reduce((a, b) => a + b, 0), t = (e['Time ran out'] || 0) / Math.max(1, n); if (n < 25 || t < 0.2) continue;
    out.push({ kind: 'hole', id: 'clock:' + m, s: (t - 0.15) * 3 * (0.7 + aggr * 0.6) * w('clock'), why: `${pct(t)} of ${n} practice rounds there end on the clock`,
      text: `On ${MAPS[m].name} too many rounds just run out the clock. When nobody can get the defuser down, both sides wait and it stops being fun to watch or play. One more way onto the sites, or a shorter round there.` });
  }
  // take out: a mechanic hardly anyone ever uses
  // (judged on this version's practice only, once there are 300 player-rounds: a new feature starts at nothing)
  const V = training.featV || {}, use = {}, rounds = { n: V.r || 0 }; for (const f of Object.keys(MECH)) use[f] = V[f] || 0;
  if (rounds.n >= 300) for (const [f, name] of Object.entries(MECH)) {
    const opR = MECH_OP[f] ? V['op_' + MECH_OP[f]] || 0 : rounds.n; if (MECH_OP[f] && opR < 40) continue; // (not enough rounds on that operator yet)
    const per = use[f] / opR * 100; if (per >= 1.5) continue; // (a player does it at least once every ~70 rounds: it is part of the game)
    out.push({ kind: 'remove', id: 'mech:' + f, s: (1.5 - per) * 0.5 * (0.6 + patience * 0.5) * w(f), why: MECH_OP[f] ? `${OPERATORS[MECH_OP[f]].name} uses it ${per.toFixed(1)} times every hundred rounds they play` : `it happens ${per.toFixed(1)} times every hundred rounds a player`,
      text: MECH_CORE.has(f) ? `${name.charAt(0).toUpperCase() + name.slice(1)} hardly ever happen. That should be one of the best parts of this game. Give people a reason to take that fight, or it might as well not be there.`
        : `Take out ${name}, or make it worth doing: it hardly ever happens. Every mechanic is one more thing a new player has to learn, and this one gives almost nothing back. A cleaner game is a better game.` });
  }
  return out;
}
const SITE_NAMES = {}; // bomb site names per map (a built map is a quick copy: shared/map.js)
const buildSiteName = (m, si) => { const S = SITE_NAMES[m] || (SITE_NAMES[m] = buildMap(m).sites.map(x => x.name)); return S[si]; };
export function formSuggestions(version) {
  const O = training.suggestions || (training.suggestions = {}), session = training.sessions || 0, said = {};
  for (const team of PRO_TEAMS) for (const pl of team.players) {
    const c = ideas(pl); if (!c.length) continue;
    for (const x of c) x.sc = x.s * (0.75 + 0.5 * quirk(pl.name, 'idea' + x.id)) / (1 + 0.6 * (said[x.id] || 0)); // (a few agree; the rest bring their own: ten people don't all say one thing)
    c.sort((a, b) => b.sc - a.sc);
    const log = O[pl.name] || (O[pl.name] = []), last = log[log.length - 1], pick = last && c.find(x => x.id === last.id && x.sc > c[0].sc * 0.85) || c[0];
    said[pick.id] = (said[pick.id] || 0) + 1;
    const intro = CARE[Math.floor(quirk(pl.name, 'care') * CARE.length)];
    log.push({ at: Date.now(), v: version, s: session, kind: pick.kind, id: pick.id, text: `${intro} ${pick.text}`, why: pick.why, changed: !last || last.id !== pick.id ? 1 : 0 });
    if (log.length > 20) log.splice(0, log.length - 20);
  }
  return O;
}

// ---------------- the pros' drill ideas (he asked 2026-11-20) ----------------
// After each practice every pro may speak up about a SKILL DRILL (server/skilldrills.js), with one exact change:
//   STUCK: their win rate in a situation hasn't gone up over their last three sessions → a longer clock (last 45 s, after the
//     plant) or the other small map;
//   NO HELP: in a situation drilled for a skill they play, rounds with the skill win no more than rounds with it locked
//     (8+ of each) → drill that skill in the situation where it measured best instead;
//   NOT REAL: a skill drilled after the plant while real matches almost never get a plant (under 12% of practice rounds).
// Kept in training.skillDrills.ideas (last 60). Two or more pros backing the same change within three sessions adopts it
// (he chose): it goes into skillDrills.tweaks, which the next practice's drills read.
const SIT_WORDS = { entry: 'breaking into a ground-floor site', upstairs: 'the upstairs site', retake: 'the after-the-plant drill', hold: 'playing against a site anchor', roam: 'playing against a roamer', late: 'the last-45-seconds drill' };
const DRILL_OPEN = ['Coach, about the drills:', 'Honest drill feedback:', 'I\'ve put the hours into these drills, so:', 'One thing about the training room:', 'Quick one on the drills:'];
export function formDrillIdeas(version) {
  const T = training.skillDrills; if (!T) return [];
  const sessions = T.sessions || 0, tweaks = T.tweaks || (T.tweaks = {}), ideas = T.ideas || (T.ideas = []);
  const ends = Object.values(training.ends || {}).reduce((a, e) => { for (const [k, v] of Object.entries(e)) { a.n += v; if (k.startsWith('Defuser')) a.p += v; } return a; }, { n: 0, p: 0 });
  const plantShare = ends.n >= 50 ? ends.p / ends.n : null;
  const worth = (ab, sit) => { let on = 0, won = 0, off = 0, woff = 0; for (const [k, a] of Object.entries(T.sit)) { const [op, s] = k.split('|'); if (s !== sit || !OPERATORS[op] || OPERATORS[op].ability.id !== ab) continue; on += a[0]; won += a[1]; off += a[2]; woff += a[3]; } return { on, off, d: on && off ? won / on - woff / off : null, won, woff }; };
  const said = [];
  for (const team of PRO_TEAMS) for (const pl of team.players) {
    const c = [], myOps = [...(pl.pool.atk || []), ...(pl.pool.def || [])].filter(o => OPERATORS[o]);
    // stuck: no better over their last three sessions in a situation
    for (const [sit, line] of Object.entries((T.prog || {})[pl.name] || {})) {
      if (line.length < 3) continue; const l3 = line.slice(-3); if (l3[2][0] > l3[0][0] || l3.reduce((a, x) => a + x[1], 0) < 6) continue;
      const longer = sit === 'late' || sit === 'retake', cur = tweaks.map && tweaks.map[sit], to = cur ? SMALL_MAPS.find(m => m !== cur) : SMALL_MAPS[sessions % SMALL_MAPS.length]; // (the same for everyone this session, so pros who agree back one change)
      const change = longer ? { type: 'time', sit, add: 15 } : { type: 'map', sit, to };
      c.push({ id: longer ? `time:${sit}:+15` : `map:${sit}:${to}`, s: 1 + (l3[0][0] - l3[2][0]) / 20, change, kind: 'stuck', why: `${SITUATIONS_NAME(sit)}: ${l3.map(x => x[0] + '%').join(' → ')} over their last three sessions`,
        text: `I'm not getting better at ${SIT_WORDS[sit]}: ${l3.map(x => x[0] + '%').join(', then ')}. ${longer ? 'Fifteen more seconds on that clock, so there is time to actually use the skill instead of just rushing it.' : `Put it on ${MAPS[to].name} for a while: I've learned that room by heart, not the skill.`}` });
    }
    // no help: the skill does nothing for this situation
    for (const op of myOps) {
      const ab = OPERATORS[op].ability.id, sits = sitsFor(ab, OPERATORS[op].team, tweaks);
      for (const sit of sits) {
        const w = worth(ab, sit); if (w.on < 8 || w.off < 8 || w.d > 0) continue;
        const alt = Object.keys(SIT_WORDS).filter(s => !sits.includes(s)).map(s => ({ s, d: worth(ab, s).d })).sort((a, b) => (b.d ?? 0.02) - (a.d ?? 0.02))[0]; if (!alt) continue;
        c.push({ id: `sit:${ab}:${sit}>${alt.s}`, s: 1.2 - w.d * 2, change: { type: 'sit', ab, from: sit, to: alt.s }, kind: 'nohelp', why: `${OPERATORS[op].ability.name} in ${SITUATIONS_NAME(sit)}: wins ${pct(w.won / w.on)} with it, ${pct(w.woff / w.off)} without (${w.on} + ${w.off} drills)`,
          text: `The ${OPERATORS[op].ability.name} drill in ${SIT_WORDS[sit]} teaches nothing: with the skill I win ${pct(w.won / w.on)}, with it locked ${pct(w.woff / w.off)}. In a real match that's not where you use it. Drill it in ${SIT_WORDS[alt.s]} instead.` });
      }
      // not real: a plant drill when real rounds hardly ever see a plant
      if (plantShare !== null && plantShare < 0.12 && sits.includes('retake')) {
        const alt = Object.keys(SIT_WORDS).find(s => !sits.includes(s));
        c.push({ id: `sit:${ab}:retake>${alt}`, s: 0.8, change: { type: 'sit', ab, from: 'retake', to: alt }, kind: 'unreal', why: `only ${pct(plantShare)} of practice rounds get a plant`,
          text: `We drill ${OPERATORS[op].ability.name} after the plant, but only ${pct(plantShare)} of real rounds ever get one. Train it where the rounds are actually decided: ${SIT_WORDS[alt]}.` });
      }
    }
    if (!c.length) continue;
    for (const x of c) x.sc = x.s * (0.75 + 0.5 * quirk(pl.name, 'drill' + x.id));
    c.sort((a, b) => b.sc - a.sc);
    const pick = c[0], intro = DRILL_OPEN[Math.floor(quirk(pl.name, 'dopen') * DRILL_OPEN.length)];
    const rec = { at: Date.now(), v: version, s: sessions, name: pl.name, id: pick.id, kind: pick.kind, change: pick.change, why: pick.why, text: `${intro} ${pick.text}` };
    ideas.push(rec); said.push(rec);
  }
  // two or more pros behind the same change in the last three sessions: adopted
  const recent = ideas.filter(x => x.s >= sessions - 2);
  for (const id of new Set(said.map(x => x.id))) {
    const backers = [...new Set(recent.filter(x => x.id === id).map(x => x.name))];
    for (const x of recent.filter(x => x.id === id)) x.backers = backers.length;
    if (backers.length < 2 || (T.adopted || []).some(a => a.id === id)) continue;
    const ch = said.find(x => x.id === id).change;
    if (ch.type === 'sit') { const S = tweaks.sitFor || (tweaks.sitFor = {}), op = Object.keys(OPERATORS).find(o => OPERATORS[o].ability.id === ch.ab); const cur = sitsFor(ch.ab, OPERATORS[op].team, tweaks); S[ch.ab] = [...new Set(cur.map(s => s === ch.from ? ch.to : s))]; }
    if (ch.type === 'time') { const t = tweaks.time || (tweaks.time = {}); t[ch.sit] = Math.min(45, (t[ch.sit] || 0) + ch.add); }
    if (ch.type === 'map') { (tweaks.map || (tweaks.map = {}))[ch.sit] = ch.to; }
    (T.adopted || (T.adopted = [])).push({ id, s: sessions, at: Date.now(), change: ch, backers });
    for (const x of recent.filter(x => x.id === id)) x.adopted = 1;
  }
  if (ideas.length > 60) ideas.splice(0, ideas.length - 60);
  return said;
}
const SITUATIONS_NAME = s => (SITUATIONS[s] || { name: s }).name;
