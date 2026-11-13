// Computer players. They are meant to feel like people: each one has a job for the round (a role, like a real
// team splits up: entry, support, flanker and intel on attack; anchors and roamers on defence) and a personality
// (how pushy and how patient), they use their operator's ability where a person would, revive and heal teammates,
// call out what they see, and react no faster than a fairly experienced player. The bot skill setting
// (game.botLevel, Easy / Normal / Hard / Expert) changes how fast they react and how well they aim, not what they know:
// they only know what they see, what they hear (running footsteps, gunfire, explosions) and what their team spots.
import { CELL, PLAYER_R, T, FL, TEAM, PHASE, PX_PER_M, DUR, blocksMove, blocksDrone, underAt, stopsBullet, PRO_LEVEL, TOP_BOT, DEFAULT_LEVEL, SWARM } from '../shared/constants.js';
import { tileAt, los, angDiff, vaultable, castSight, canSee, walkRay, shapeAt, rayShape, rayCovers, circleBlocked } from '../shared/physics.js';
import { ropeS, hatchOpen, cellAbove, cellBelow, peepOk, floorSpot, floorAt, localPos, stairGhost, stairLooks, stairEnds, roomAt, windowViews, windowSees, wallGhost, peekSeen, floorOff, OUTCAM_ROOF, hatchSight } from '../shared/map.js';
import { OPERATORS, WEAPONS, opsForTeam, JOBS, jobOf, hitR, HEAD_AIM, LOADOUTS, attachFor, cleanLoadout, RIOT, penOf } from '../shared/operators.js';
import { PRO_TEAMS, playbook, siteIntel, PRO_PEEK, PRO_PERSONA, PRO_TIMING, PRO_ROTATE } from '../shared/pros.js';
import { planWeight, opWeight, planRecord, training, opKey, gunKey, attKey, blend, recGuess, plainGuess } from './training.js';
import { compose, LINES, FUN, WAYS } from '../shared/comms.js';
import { parseCommand } from '../shared/commands.js';

// Per skill level. react: seconds before the first shot at someone who surprised them (plus up to reactX more);
// expect: the same when they were already listening for that enemy. turn: how fast they swing their aim (radians/s).
// err: how far off the first aim is; settle: how fast it closes in. tol: how close the aim must be before they fire.
// see: how far they notice people (px). body: how widely their aim point wanders over the body (px). head: how often they go for the head (shaky low ranks still rarely land it).
// shake: how unsteady the hand is once on you. The times to get on you (react + aim, 10 m, surprised) are his, checked by
// node tests/aimtime.js: Copper 1.5 s, Bronze 1.1, Silver 0.9, Gold 0.8, Platinum 0.7, Diamond 0.5, Champion 0.3.
const SKILL = [ // the ranks (he asked): Copper, Bronze, Silver, Gold, Platinum, Diamond, Champion
  { react: 0.75, reactX: 0.4, expect: 0.45, turn: 3.5, err: 1.2, settle: 2.1, shake: 1.3, tol: 0.3, see: 460, body: 15, head: 0.3, drone: 0.8 },  // Copper
  { react: 0.55, reactX: 0.3, expect: 0.35, turn: 4.5, err: 1.0, settle: 2.9, shake: 1.15, tol: 0.26, see: 520, body: 13, head: 0.44, drone: 0.7 },  // Bronze
  { react: 0.45, reactX: 0.25, expect: 0.28, turn: 7, err: 0.9, settle: 3.6, shake: 1, tol: 0.2, see: 650, body: 11, head: 0.53, drone: 0.5 },     // Silver
  { react: 0.4, reactX: 0.2, expect: 0.25, turn: 8.5, err: 0.85, settle: 3.9, shake: 0.95, tol: 0.17, see: 690, body: 9.5, head: 0.54, drone: 0.45 }, // Gold
  { react: 0.35, reactX: 0.18, expect: 0.22, turn: 10, err: 0.8, settle: 4.6, shake: 0.9, tol: 0.15, see: 720, body: 8, head: 0.6, drone: 0.4 },    // Platinum
  { react: 0.25, reactX: 0.12, expect: 0.18, turn: 12.5, err: 0.7, settle: 6, shake: 0.8, tol: 0.12, see: 780, body: 6, head: 0.65, drone: 0.3 },  // Diamond
  { react: 0.17, reactX: 0.06, expect: 0.15, turn: 14, err: 0.5, settle: 8.5, shake: 0.6, tol: 0.1, see: 820, body: 5, head: 0.65, drone: 0.25 },  // Champion // turn: he asked for faster turning
];
const lvlOf = (game, p) => game.tut ? 0 : Math.max(0, Math.min(TOP_BOT, p.level ?? game.botLevel ?? DEFAULT_LEVEL));
const skill = (game, p) => p.pro ? proSkill(p) : SKILL[lvlOf(game, p)]; // p.level: a test can give one bot its own

// A bot's personality stays with it all match: aggr = how pushy, patience = how long it waits and watches.
function persona(p) {
  return p.persona || (p.persona = { aggr: Math.random(), patience: Math.random() });
}

// The job for this round. Bots on a side split the roles between them; the order shifts every round.
const ROLES = { [TEAM.ATK]: ['entry', 'support', 'flank', 'intel', 'entry'], [TEAM.DEF]: ['anchor', 'space', 'roamer', 'anchor', 'space'] }; // space: holds a room leading to the site (he asked: take space; fewer right on the site, usually two anchors)
function roleFor(game, p, team) {
  const mates = [...game.players.values()].filter(q => q.bot && game.side(q) === team).sort((a, b) => +a.id.slice(1) - +b.id.slice(1));
  const list = ROLES[team];
  return list[(Math.max(0, mates.indexOf(p)) + (game.round || 0)) % list.length];
}

// ESPORTS TV viewer requests (he asked): a requested operator of this side is played every round by the bot with its role
// (a pro's own job; among amateurs, the first bot to pick takes it)
function requestPick(game, p) {
  const req = game.tv && game.tv.req; if (!req || !req.length || p.pro) return false; // (pros: first in their pool, proPickOp)
  const team = game.side(p), side = team === TEAM.ATK ? 'atk' : 'def';
  const taken = new Set([...game.players.values()].filter(q => q.squad === p.squad && q.op).map(q => q.op));
  const o = req.find(o => OPERATORS[o].team === side && !taken.has(o));
  if (!o) return false;
  p.job = jobOf(o); game.pickOp(p, o);
  if (p.op !== o) { p.job = null; return false; }
  return true;
}
// ESPORTS TV team talk (he asked): 15 s before each round where each team talks over the map, spawns and picks like
// people do. Someone asks a teammate to play something, for a reason from experience; whether they listen depends on
// how the asker is fragging (top fraggers get listened to more), much more so at the lower ranks.
const TALK_TIME = 15;
export function tvTalk(game) {
  const T = game.tvTalk && game.tvTalk.round === game.round ? game.tvTalk : (game.tvTalk = planTalk(game));
  const el = game.time - T.t0;
  while (T.ev.length && T.ev[0].at <= el) T.ev.shift().fn();
  if (el >= TALK_TIME) for (const p of game.players.values()) if (p.bot) { if (!p.op) botPickOp(game, p); if (p.op) p.locked = true; }
}
// ESPORTS TV bans: the team (its leader says it) bans what has been winning on this map, more so what the other team
// likes to play; never a viewer request or an operator already banned
export function tvBanPick(game, sq, sd) {
  const team = [...game.players.values()].filter(q => q.squad === sq), enemy = [...game.players.values()].filter(q => q.squad !== sq);
  const fav = new Set(enemy.flatMap(q => q.pro ? q.pro.pl.pool[sd] : []));
  const cand = opsForTeam(sd === 'atk' ? TEAM.ATK : TEAM.DEF).filter(o => !game.isBanned(o) && !(game.tv && game.tv.req && game.tv.req.includes(o)));
  if (!cand.length) return null;
  const best = cand.map(o => [o, opWeight(game.map.id, sd, o) * (fav.has(o) ? 1.8 : 1) * (0.6 + Math.random() * 0.8)]).sort((a, b) => b[1] - a[1])[0][0];
  const lead = team.find(q => q.pro && q.pro.i === 0) || team[0];
  if (lead) say(game, lead, pickOne([`Ban ${talkOp(best)}.`, `${talkOp(best)}, ban it.`, fav.has(best) ? `They love ${talkOp(best)}. Ban.` : `${talkOp(best)} has been winning here, ban it.`]));
  return best;
}
// he asked: the defending bots vote on which site to defend, by what the pros have learned in practice (how often the
// defence won there, all plays together). Pros trust those numbers; lower ranks are less sure of them (wider guesses),
// so their votes spread more. Only sites still open this match (game.siteOpen) are on the ballot; ties go to the
// stronger total. Each voter says their pick in team chat, then the result.
export function siteVote(game) {
  const voters = [...game.players.values()].filter(p => p.bot && game.side(p) === TEAM.DEF);
  const open = game.map.sites.map((_, i) => i).filter(i => game.siteOpen(i));
  if (!voters.length || !open.length) return;
  const rec = {}; for (const i of open) rec[i] = { w: 0, n: 0 };
  for (const [k, r] of Object.entries(training.plans)) { const [m, s, sd] = k.split('|'); if (m === game.map.id && sd === TEAM.DEF && rec[+s] && r) { rec[+s].w += r.w || 0; rec[+s].n += r.n || 0; } }
  const name = i => game.map.sites[i].name, votes = {}, sum = {};
  for (const p of voters) {
    const spread = p.pro ? 1 : 1 + (TOP_BOT - lvlOf(game, p)) * 0.5;
    let best = open[0], bg = -9;
    for (const i of open) { const g = plainGuess(rec[i], spread); sum[i] = (sum[i] || 0) + g; if (g > bg) { bg = g; best = i; } }
    votes[best] = (votes[best] || 0) + 1;
    if (open.length > 1) say(game, p, pickOne([`${name(best)} for me.`, `I vote ${name(best)}.`, bg > 0.55 && rec[best].n >= 20 ? `${name(best)}, we win there.` : `${name(best)}.`]));
  }
  const win = open.reduce((a, b) => ((votes[b] || 0) > (votes[a] || 0) || ((votes[b] || 0) === (votes[a] || 0) && sum[b] > sum[a]) ? b : a));
  game.site = win;
  const lead = voters.find(p => p.pro && p.pro.i === 0) || voters[0];
  say(game, lead, open.length > 1 ? `Vote: ${name(win)} (${votes[win]} of ${voters.length}).` : `Last site left: ${name(win)}.`);
}
function say(game, p, text) {
  if (!p) return;
  if (p.pro) (game.proLog || (game.proLog = [])).push({ round: game.round, squad: p.squad, team: p.pro.tag, text, who: p.pro.pl.name });
  p.chatTimes = []; game.chat(p, { text: text.slice(0, 140), team: true });
}
const pickOne = a => a[Math.floor(Math.random() * a.length)];
const talkOp = o => OPERATORS[o] ? OPERATORS[o].name : '?';
function planTalk(game) {
  const T = { round: game.round, t0: game.time, ev: [] }, at = (t, fn) => T.ev.push({ at: t, fn });
  const lvl = game.botLevel ?? PRO_LEVEL, spread = lvl >= PRO_LEVEL ? 0.3 : 0.78 - lvl * 0.06; // how much the scoreboard decides who is heard
  for (const squad of [0, 1]) {
    const team = [...game.players.values()].filter(q => q.bot && q.squad === squad); if (!team.length) continue;
    const side = game.side(team[0]), atk = side === TEAM.ATK, sd = atk ? 'atk' : 'def', m = game.map;
    const byFrags = team.slice().sort((a, b) => (b.kills || 0) - (a.kills || 0) || (a.deaths || 0) - (b.deaths || 0));
    const rank = q => byFrags.indexOf(q) / Math.max(1, team.length - 1); // 0 = top fragger, 1 = bottom
    const lead = team.find(q => q.pro && q.pro.i === 0) || byFrags[0];
    const lostLast = game.round > 1 && game.lastWinner !== undefined && game.lastWinner !== squad;
    const off = 0.4 + squad * 0.5; // the two teams don't talk in lockstep
    // the map / site call
    const site = m.sites[game.site], siteName = site ? site.rooms.join(' / ') : 'the site';
    at(off + 0.6, () => say(game, lead, atk
      ? pickOne([lostLast ? 'They read us last round. Different angle this time, drones first.' : 'Same idea as before: drones first, find it, then we commit.', `${m.name || 'This map'}: they love the upstairs sites here, check those first.`, 'Full drones. Nobody peeks before we know where it is.'])
      : pickOne([`We play ${siteName}. Reinforce the main walls first.`, lostLast ? `${siteName} again, but no one dies for free this time.` : `${siteName}. Same setup, it worked.`, `Setting up ${siteName}. One roamer, the rest hold.`])));
    // picks, one by one, and a request from someone with an opinion
    const order = team.slice().sort(() => Math.random() - 0.5), times = order.map((_, i) => off + 2 + i * 2.1 + Math.random() * 0.8);
    const want = new Map(); // target -> requested operator (if they agreed)
    if (order.length >= 2) {
      const ti = 1 + Math.floor(Math.random() * (order.length - 1)), tgt = order[ti], asker = pickOne(order.slice(0, ti).concat(order.slice(ti + 1)));
      const job = tgt.pro ? tgt.pro.pl.jobs[sd] : null;
      let cand = opsForTeam(side).filter(o => !job || jobOf(o) === job);
      if (game.tv && game.tv.req) cand = cand.filter(o => !game.tv.req.includes(o));
      cand = cand.filter(o => !game.isBanned(o));
      const best = cand.map(o => [o, opWeight(m.id, sd, o) * (0.7 + Math.random() * 0.6)]).sort((a, b) => b[1] - a[1])[0];
      if (best) {
        const o = best[0], why = pickOne([`${talkOp(o)} has been winning us this map`, `we need a ${(JOBS[side].find(j => j.ops.includes(o)) || {}).name || 'support'}`, lostLast ? `their setup beat us, ${talkOp(o)} counters it` : `trust me, ${talkOp(o)} is good here`]);
        const askT = times[ti] - 1.6, nm = tgt.name.replace(/^\[\w+\] /, '');
        const listen = Math.min(0.95, Math.max(0.05, 0.6 + spread * (0.5 - rank(asker)))), yes = Math.random() < listen;
        at(askT, () => say(game, asker, `${nm}, can you play ${talkOp(o)}? ${why}.`));
        at(askT + 1.1, () => say(game, tgt, yes ? pickOne([`Sure, ${talkOp(o)}.`, 'Yeah ok, got it.', 'Fine, I trust you.']) : rank(asker) > 0.6 && lvl < PRO_LEVEL ? pickOne([`You're bottom frag, I'll play what I want.`, 'Maybe get some kills first.', 'Nah.']) : pickOne(['Nah, I play better on my own pick.', "I'd rather not, I'm warm on mine.", 'Not this round.'])));
        if (yes) want.set(tgt, o);
      }
    }
    order.forEach((p, i) => at(times[i], () => {
      if (p.op) return;
      const o = want.get(p);
      if (o && !(game.tv && game.tv.req && game.tv.req.some(r => OPERATORS[r].team === sd && jobOf(r) === jobOf(o)))) { p.job = jobOf(o); game.pickOp(p, o); }
      if (!p.op) botPickOp(game, p); else if (p.pro) (p.pro.lastOps || (p.pro.lastOps = {}))[sd] = p.op;
      if (!p.op) return;
      const line = Math.random() < 0.5 ? `${talkOp(p.op)} for me.` : pickOne([`I'll go ${talkOp(p.op)}.`, `Locking ${talkOp(p.op)}.`, `${talkOp(p.op)}.`]);
      say(game, p, atk && Math.random() < 0.45 ? `${line} Spawning ${game.spawnOf(p).name}.` : line);
    }));
  }
  T.ev.sort((a, b) => a.at - b.at);
  return T;
}
export function botPickOp(game, p) {
  if (requestPick(game, p)) return;
  if (p.pro && proPickOp(game, p)) return;
  const team = game.side(p);
  const taken = new Set([...game.players.values()].filter(q => q.squad === p.squad && q.op).map(q => q.op));
  const free = opsForTeam(team).filter(o => !taken.has(o) && !game.isBanned(o));
  if (!free.length) return;
  // he asked: bots lean toward roles nobody on the team has yet, so a team is roughly spread out (not strictly)
  const count = {};
  for (const q of game.players.values()) if (q !== p && q.squad === p.squad && (q.job || q.op)) { const j = q.job || jobOf(q.op); count[j] = (count[j] || 0) + 1; }
  const roles = JOBS[team].filter(j => j.ops.some(o => free.includes(o))).map(j => ({ j, w: 1 / Math.pow(1 + (count[j.id] || 0), 2.5) }));
  let r = Math.random() * roles.reduce((a, x) => a + x.w, 0), job = roles[roles.length - 1].j;
  for (const x of roles) if ((r -= x.w) <= 0) { job = x.j; break; }
  const pool = free.filter(o => job.ops.includes(o));
  p.job = job.id; // the bot's role this round (a role left over from last round made the pick bounce: he saw a bot never lock in)
  game.pickOp(p, pool[Math.floor(Math.random() * pool.length)]);
  if (!p.op) { p.job = null; game.pickOp(p, free[Math.floor(Math.random() * free.length)]); } // never stuck: any free operator
}

// he asked: fewer defenders right on the site, the rooms leading to it set up too, no boarding yourselves into the site
// (rotations are a big part of the game), and a preparation that keeps everyone busy instead of waiting for drones.
// Worked out once a round for the defending team: which rooms beside the site are held, which site walls become
// rotation holes (left soft, knocked open in preparation), which openings get boarded and where the traps go.
const WALLISH = [T.SOFT, T.REINF, T.HARD];
export function defSetup(game) {
  const m = game.map;
  if (game._ds && game._ds.m === m && game._ds.si === game.site) return game._ds;
  const site = m.sites[game.site], W = m.W, I = intelOf(game);
  const roomAtK = k => { const x = k % W, y = Math.floor(k / W); return m.rooms.find(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) || null; };
  const isSite = r => !!r && site.rooms.includes(r.name);
  const flr = k => m.tiles[k] === T.FLOOR || m.tiles[k] === T.GROUND;
  // the two sides of an opening: the first floor cell each way across it
  const across = o => {
    const k = o.cells[0], set = new Set(o.cells);
    for (const d of [1, W]) {
      const out = [];
      for (const s of [-1, 1]) for (let j = 1; j <= 3; j++) { const c = k + s * d * j; if (set.has(c)) continue; if (flr(c)) { out.push(c); break; } if (!WALLISH.includes(m.tiles[c]) && m.openId[c] !== o.id) break; }
      if (out.length === 2) return out;
    }
    return null;
  };
  const held = I.near.slice(0, 2); if (!held.length && I.roam) held.push(I.roam);
  const heldN = new Set(held.map(r => r.name));
  // rotation holes: two soft cells in a plain wall between a site room and an indoor room beside it, away from the
  // attackers' main way in; a held room first
  const holes = [], reserved = new Set();
  const cand = [];
  for (let k = W; k < m.tiles.length - W; k++) {
    if (m.tiles[k] !== T.SOFT || m.shape[k] || m.dhole && m.dhole[k]) continue;
    for (const d of [1, W]) {
      const a = k - d, b = k + d; if (!flr(a) || !flr(b) || m.floor[a] !== m.floor[b]) continue;
      const ra = roomAtK(a), rb = roomAtK(b); if (isSite(ra) === isSite(rb) || !(isSite(ra) ? ra : rb)) continue;
      if (m.tiles[a] === T.GROUND || m.tiles[b] === T.GROUND) continue;
      const along = d === 1 ? W : 1, k2 = k + along;
      if (m.tiles[k2] !== T.SOFT || m.shape[k2] || !flr(k2 - d) || !flr(k2 + d) || !WALLISH.includes(m.tiles[k - along]) || !WALLISH.includes(m.tiles[k2 + along])) continue;
      const inS = isSite(ra) ? -1 : 1, other = (isSite(ra) ? rb : ra) || { name: 'corridor' + k }, c = { x: (k % W + 0.5) * CELL, y: (Math.floor(k / W) + 0.5) * CELL };
      const fromMain = I.main ? Math.hypot(c.x - I.main.pos.x, c.y - I.main.pos.y) / CELL : 20;
      if (fromMain < 6) continue;
      cand.push({ cells: [k, k2], d: d * inS, room: other.name, s: (heldN.has(other.name) ? 10 : 0) + Math.min(fromMain, 20) * 0.3 + Math.random() * 3 });
    }
  }
  cand.sort((a, b) => b.s - a.s);
  for (const c of cand) {
    if (holes.length >= 2 || holes.some(h => h.room === c.room || Math.abs(h.cells[0] % W - c.cells[0] % W) + Math.abs(Math.floor(h.cells[0] / W) - Math.floor(c.cells[0] / W)) < 8)) continue;
    holes.push(c);
  }
  for (const h of holes) for (const k of h.cells) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) reserved.add(k + dy * W + dx); // reinforcing nearby would spread into it
  // boards: the site's doors that lead to a held room (or to the other site room) stay open for rotating; the rest
  // may be boarded. The held rooms' own doors out (away from the site) are the first line.
  const siteBoards = [], outerBoards = [], traps = [];
  for (const o of m.openings) {
    const sd = across(o); if (!sd) continue;
    const [r1, r2] = sd.map(roomAtK), s1 = isSite(r1), s2 = isSite(r2);
    if (s1 !== s2) { const other = s1 ? r2 : r1; if (!(other && heldN.has(other.name))) siteBoards.push(o.id); traps.push(o.id); }
    else if (!s1 && (r1 && heldN.has(r1.name)) !== (r2 && heldN.has(r2.name))) { outerBoards.push(o.id); traps.unshift(o.id); }
  }
  return (game._ds = { m, si: game.site, held, holes, reserved, siteBoards, outerBoards, traps, holeBy: new Map(), across });
}

// where the attack is coming in: an enemy the team has spotted in or right by the site, or a teammate just killed there.
// Defenders outside the site rotate to it (he asked: rotations are a big part of the game).
function siteHot(game, team) {
  const c = game._hot || (game._hot = {});
  if (c.t === game.time && c.team === team) return c.pt;
  const m = game.map, site = m.sites[game.site], test = siteTest(m, site), W = m.W;
  const inOrBy = (x, y) => { const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL); for (let dy = -3; dy <= 3; dy += 3) for (let dx = -3; dx <= 3; dx += 3) if (test(cx + dx, cy + dy)) return true; return false; };
  let pt = null;
  for (const id of game.spots[team].keys()) { const q = game.players.get(id); if (q && q.alive && inOrBy(q.x, q.y)) { pt = { x: q.x, y: q.y }; break; } }
  const d = game.lastDeath && game.lastDeath[team];
  if (!pt && d && game.time - d.t < 6 && inOrBy(d.x, d.y)) pt = { x: d.x, y: d.y };
  Object.assign(c, { t: game.time, team, pt }); void W;
  return pt;
}

// the next thing to reinforce: hatches over the site first, then the site's breakable walls (outside-facing ones before
// the one between the two site rooms), never a wall kept soft for a rotation hole. Returns where to stand.
function reinforceTarget(game) {
  const m = game.map, site = m.sites[game.site], W = m.W, inSite = siteTest(m, site), ds = defSetup(game);
  const claimed = game._claimed && game._claimed.m === m ? game._claimed : (game._claimed = { m, s: new Set() });
  const h = (m.hatches || []).find(h => !claimed.s.has('h' + h.id) && m.tiles[h.cells[0]] === T.HATCH && h.below.some(k => inRoomOf(m, site.rooms, k % W, Math.floor(k / W))));
  if (h) { claimed.s.add('h' + h.id); return { x: h.x, y: h.y, run: () => m.tiles[h.cells[0]] === T.HATCH && game.reinforce > 0 && (game.reinforceHatch(h.id), game.reinforce--, true) }; }
  let best = null, bs = -1, stand = null;
  for (let k = 0; k < m.tiles.length; k++) {
    if (m.tiles[k] !== T.SOFT || ds.reserved.has(k) || claimed.s.has(k) || !inSite(k % W, Math.floor(k / W)) || inRoomOf(m, site.rooms, k % W, Math.floor(k / W))) continue;
    const sides = [1, -1, W, -W].map(d => k + d).filter(q => m.tiles[q] === T.FLOOR || m.tiles[q] === T.GROUND);
    const inner = sides.filter(q => inRoomOf(m, site.rooms, q % W, Math.floor(q / W)));
    const score = (sides.length - inner.length > 0 ? 2 : 1) + Math.random() * 0.5; // a wall to the outside of the site beats the partner wall
    if (sides.length && inner.length && score > bs) { bs = score; best = k; stand = inner[0]; }
  }
  if (best === null) return null;
  for (let d = -2; d <= 2; d++) { claimed.s.add(best + d); claimed.s.add(best + d * W); }
  return { x: (stand % W + 0.5) * CELL, y: (Math.floor(stand / W) + 0.5) * CELL, face: { x: (best % W + 0.5) * CELL, y: (Math.floor(best / W) + 0.5) * CELL },
    run: () => m.tiles[best] === T.SOFT && game.reinforce > 0 && (game.reinforceWall(best), game.reinforce--, true) };
}

// Preparation as real work (he asked: everyone stood waiting for drones): each job is walked to and takes as long as a
// person needs (boards 2.5 s, reinforcing 3 s, a gadget a moment), nearest job next. Unfinished work carries on into
// the first seconds of the action phase unless an enemy is heard.
function prepWork(game, p, inp, dt, heard) {
  const ai = p.ai;
  if (!ai.tasks || (!ai.tasks.length && !ai.task)) return false;
  if (game.phase === PHASE.ACTION && (elapsedAction(game) > 12 || heard)) { ai.tasks = null; ai.task = null; return false; }
  let t = ai.task;
  if (!t) {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < ai.tasks.length; i++) { const q = ai.tasks[i], d = q.x == null ? 1e6 : Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; bi = i; } }
    t = ai.tasks.splice(bi, 1)[0];
    if (t.pick) { const g = t.pick(); if (!g) return true; Object.assign(t, g); }
    t.left = t.wait; t.T = 0; ai.task = t;
  }
  t.T += dt;
  const m = game.map, W = m.W;
  if (t.melee) { // a rotation hole: swing at each cell (soft wall, then the stub it leaves) until it is open floor
    const k = t.melee.find(c => m.tiles[c] === T.SOFT || m.tiles[c] === T.RUBBLE);
    if (k === undefined || t.T > 25) { ai.task = null; if (k === undefined && !ai.holeSaid) { ai.holeSaid = true; teamSay(game, p, `Rotation hole open ${place(game, p.x, p.y) || 'by the site'}`, 'rot' + t.melee[0]); } return true; }
    const sc = k + t.d, sx = (sc % W + 0.5) * CELL, sy = (Math.floor(sc / W) + 0.5) * CELL; // from the site's side
    if (Math.hypot(sx - p.x, sy - p.y) > 7) { moveTo(game, p, inp, { x: sx, y: sy }, dt); return true; }
    aimAt(p, (k % W + 0.5) * CELL, (Math.floor(k / W) + 0.5) * CELL);
    if (p.meleeCd <= 0) game.event(p, { k: 'melee' });
    return true;
  }
  if (t.T > 20) { ai.task = null; return true; } // can't get there: skip it
  if (Math.hypot(t.x - p.x, t.y - p.y) > (t.r || 20)) { moveTo(game, p, inp, { x: t.x, y: t.y }, dt); return true; }
  if (t.face) aimAt(p, t.face.x, t.face.y);
  inp.crouch = 1;
  if ((t.left -= dt) > 0) return true;
  t.run(); ai.task = null; return true;
}

function siteTest(m, site) {
  const rs = m.rooms.filter(r => site.rooms.includes(r.name));
  return (x, y) => rs.some(r => x >= r.x - 1 && x <= r.x + r.w && y >= r.y - 1 && y <= r.y + r.h);
}
function inRoomOf(m, names, x, y) { return m.rooms.some(r => names.includes(r.name) && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h); }

// Defending bots plan their preparation the moment it begins, then walk round doing it (prepWork).
export function botPrep(game, p) {
  if (game.side(p) !== TEAM.DEF) return;
  const m = game.map, site = m.sites[game.site], W = m.W, ds = defSetup(game);
  const inSite = siteTest(m, site);
  const siteOpenings = m.openings.filter(o => o.cells.some(k => inSite(k % W, Math.floor(k / W))));
  const op = OPERATORS[p.op], ai = p.ai || (p.ai = {});
  // he asked: above Silver, defenders set the site up in earnest (every way in boarded, all their gadgets out); lower ranks are sloppy
  const lvl = p.pro ? TOP_BOT : lvlOf(game, p), earnest = lvl >= 3;
  const boardP = earnest ? 1 : lvl === 2 ? 0.6 : 0.35;
  const tasks = ai.tasks = []; ai.task = null; ai.holeSaid = false;
  const cxy = k => ({ x: (k % W + 0.5) * CELL, y: (Math.floor(k / W) + 0.5) * CELL });
  const later = (x, y, run, wait = 0.7, extra = {}) => tasks.push({ x, y, run, wait, ...extra });
  const opSpot = id => { const o = m.openings[id], sd = ds.across(o); return sd ? cxy(sd[0]) : cxy(o.cells[0]); }; // stand beside it, on one side
  // boards (he asked: not boarding yourselves in): the site's doors to the held rooms stay open; the held rooms' outer
  // doors and the other site doors are shared out, one board each, a board takes as long as a person's
  const mates = [...game.players.values()].filter(q => q.bot && game.side(q) === TEAM.DEF), mi = Math.max(0, mates.indexOf(p)), n = Math.max(1, mates.length);
  const boards = [...ds.outerBoards, ...ds.siteBoards].filter((id, i) => i % n === mi && m.tiles[m.openings[id].cells[0]] === T.OPEN && Math.random() < boardP);
  for (const id of boards) { const s = opSpot(id); later(s.x, s.y, () => { if (p.barri > 0 && game.barricade(id, T.BARRI)) p.barri--; }, DUR.barricade, { face: cxy(m.openings[id].cells[0]) }); }
  // reinforcing: two each, picked when it is their turn (walls already done or claimed are skipped)
  for (let i = 0; i < 2; i++) tasks.push({ x: site.bombs[0].x, y: site.bombs[0].y, pick: () => reinforceTarget(game), wait: DUR.reinforce });
  // a rotation hole (Gold up, and Silver half the time): the first bot free knocks it open, wall then stub
  if (lvl >= 3 || (lvl === 2 && Math.random() < 0.5)) for (const h of ds.holes) if (!ds.holeBy.has(h)) { ds.holeBy.set(h, p.id); const c = cxy(h.cells[0]); tasks.push({ x: c.x, y: c.y, melee: h.cells, d: h.d }); break; }
  const bomb = site.bombs[Math.floor(Math.random() * 2)];
  const near = (d) => game.freeSpotNear(bomb.x, bomb.y, d);
  const id = op.ability.id;
  const placeAt = (type, x, y, extra = {}) => later(x, y, () => game.ents.push({ id: game.eid(), type, x, y, ang: Math.random() * 6.28, team: TEAM.DEF, owner: p.id, hp: 1, ...extra }));
  // traps go on the held rooms' outer doors first (the first line), then the site's ways in
  const trapIds = ds.traps.length ? ds.traps : siteOpenings.map(o => o.id);
  const atOpening = i => { const k = m.openings[trapIds[(i + mi) % trapIds.length]].cells[0], c = cxy(k); return game.freeSpotNear(c.x, c.y, 18); };
  const openK = i => m.openings[trapIds[(i + mi) % trapIds.length]].cells[0];
  if (id === 'panel') for (const o of siteOpenings.slice(0, 3)) { const s = opSpot(o.id); later(s.x, s.y, () => { if (p.abilityCount > 0 && game.barricade(o.id, T.PANEL)) p.abilityCount--; }, 1.5); }
  if (id === 'jammer') for (let i = 0; i < 2; i++) { const s = near(60); placeAt('jammer', s.x, s.y); p.abilityCount--; }
  if (id === 'alarm' && trapIds.length) for (let i = 0; p.abilityCount > 0 && i < 3; i++) { const s = atOpening(i); placeAt('alarm', s.x, s.y, { arm: 0 }); p.abilityCount--; }
  if (id === 'pace') for (let i = 0; i < 2; i++) { const s = near(80 + i * 60); placeAt('pace', s.x, s.y, { life: 999, hit: {} }); p.abilityCount--; } // RALLY: beacons on the routes round the site
  if (id === 'beam') for (const id2 of ds.siteBoards.slice(-2)) { const s = opSpot(id2); later(s.x, s.y, () => { if (p.abilityCount > 0 && game.barricade(id2, T.BEAM, true)) p.abilityCount--; }, 1.5); } // GIRDER: brace ways into the site, not the rotation doors
  if (id === 'station') { const s = near(30); placeAt('station', s.x, s.y, { pool: 100 }); p.abilityCount--; }
  if (id === 'catcher') for (let i = 0; i < 2; i++) { const s = near(50); placeAt('catcher', s.x, s.y, { c: 2 }); p.abilityCount--; }
  if (id === 'radar') { const s = near(120); placeAt('radar', s.x, s.y, { life: 15, t: 0 }); p.abilityCount--; }
  if (['prox', 'concuss', 'clamp'].includes(id) && trapIds.length) for (let i = 0; p.abilityCount > 0 && i < 3; i++) { const s = atOpening(i); placeAt(id, s.x, s.y, { arm: 0 }); p.abilityCount--; }
  if (id === 'sensor') while (p.abilityCount > 0) { const s = near(150); placeAt('sensor', s.x, s.y, { t: 0, pingT: 0 }); p.abilityCount--; }
  if (id === 'plates') { const s = near(30); placeAt('plates', s.x, s.y, { c: 5 }); p.abilityCount--; }
  if (id === 'turret' || id === 'stickycam') while (p.abilityCount > 0) {
    const s = near(100); placeAt('cam', s.x, s.y, { offUntil: 0, tu: id === 'turret' ? 1 : 0, ang: Math.atan2(s.y - bomb.y, s.x - bomb.x) }); p.abilityCount--;
  }
  // LOCKJAW (2026-11-10): rig the shut hatches nearest the objective (the site floor or the one above), from whichever side is on the site's floor
  if (id === 'htrap') {
    const lb = localPos(m, bomb.x, bomb.y), hs = m.hatches.filter(h => !h.peep && !h.dyn && (m.tiles[h.cells[0]] === T.HATCH || m.tiles[h.cells[0]] === T.HATCHR))
      .map(h => { const a = localPos(m, h.bx, h.by); return { h, d: Math.hypot(a.x - lb.x, a.y - lb.y) + Math.abs(a.f - lb.f) * 6 * PX_PER_M, low: a.f === lb.f }; }).filter(q => q.d < 45 * PX_PER_M).sort((a, b) => a.d - b.d);
    for (const { h, low } of hs.slice(0, p.abilityCount)) { const st = game.freeSpotNear(low ? h.bx + 24 : h.x - 24, low ? h.by : h.y, 30); later(st.x, st.y, () => { if (p.abilityCount > 0 && !game.ents.some(e => e.type === 'htrap' && e.rig === h.id)) { game.ents.push({ id: game.eid(), type: 'htrap', x: h.x, y: h.y, rig: h.id, arm: DUR.trapArm, team: TEAM.DEF, owner: p.id, hp: 1 }); p.abilityCount--; } }, 1, { r: 40 }); }
  }
  // DEADFALL: one drop hole from the floor above down into the objective's room (a way to shoot down and to rotate), the other kept for later
  if (id === 'dropcharge' && p.abilityCount > 0) tasks.push({ x: bomb.x, y: bomb.y, wait: 0.5, pick: () => { // (picked when it is her turn, so the stand spot is tested on the map as it is then)
    const bk = Math.floor(bomb.y / CELL) * W + Math.floor(bomb.x / CELL), opts = [];
    for (let dy = -6; dy <= 6; dy += 2) for (let dx = -6; dx <= 6; dx += 2) {
      const up = Math.hypot(dx, dy) > 2.5 ? cellAbove(m, bk + dy * W + dx) : -1; if (up < 0) continue;
      const cx = (up % W + 1) * CELL, cy = (Math.floor(up / W) + 1) * CELL;
      for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { const t = { x: cx - Math.cos(a) * 28, y: cy - Math.sin(a) * 28, aim: a }, k = Math.floor(t.y / CELL) * W + Math.floor(t.x / CELL);
        if (m.tiles[k] === T.FLOOR && !circleBlocked(m, t.x, t.y, PLAYER_R, q => blocksMove(q) || q === T.HOLE) && game.floorCharge(t)) { opts.push({ x: t.x, y: t.y, face: { x: cx, y: cy } }); break; } }
    }
    if (!opts.length || p.abilityCount <= 0) return null;
    const o = opts[Math.floor(Math.random() * opts.length)];
    return { ...o, r: 6, run: () => { if (p.abilityCount > 0) { aimAt(p, o.face.x, o.face.y); game.useAbility(p); } } };
  } });
  if (id === 'grid') for (let i = 0; i < 2; i++) tasks.push({ x: bomb.x, y: bomb.y, wait: 1, pick: () => { // on reinforced site walls, once there are some
    const k = m.tiles.findIndex((t, k) => t === T.REINF && inSite(k % W, Math.floor(k / W)) && !game.ents.some(e => e.type === 'grid' && e.cell === k) && Math.random() < 0.3);
    if (k < 0 || p.abilityCount <= 0) return null; const c = cxy(k);
    return { x: c.x, y: c.y, run: () => { game.ents.push({ id: game.eid(), type: 'grid', x: c.x, y: c.y, ang: 0, team: TEAM.DEF, owner: p.id, hp: 1, cell: k }); p.abilityCount--; } };
  } });
  if (id === 'mine') for (let i = 0; i < 2; i++) { const c = cxy(openK(i)), s = game.freeSpotNear(c.x, c.y, 14); placeAt('mine', s.x, s.y, { ang: 0, arm: 0 }); p.abilityCount--; }
  // a deployable shield in the site, facing a way in (earnest only)
  if (earnest && p.gadget === 'dshield' && p.gadgetCount > 0 && siteOpenings.length) {
    const s = near(50), o = siteOpenings[Math.floor(Math.random() * siteOpenings.length)], k = o.cells[0];
    p.gadgetCount--; later(s.x, s.y, () => { if (!game.placeShield({ x: s.x, y: s.y, aim: Math.atan2((Math.floor(k / W) + 0.5) * CELL - s.y, (k % W + 0.5) * CELL - s.x) })) p.gadgetCount++; }, 1);
  }
  // their gadget too: a claymore or barbed wire just inside a way in (earnest: all of them, each at its own way in;
  // the lowest ranks often forget)
  for (let g = 0; g < (earnest ? 3 : 1); g++) if ((p.gadget === 'claymore' || p.gadget === 'wire') && p.gadgetCount > 0 && trapIds.length && (earnest || Math.random() < (lvl >= 2 ? 0.8 : 0.5))) {
    const s = atOpening(g), k = openK(g);
    const ang = Math.atan2((Math.floor(k / W) + 0.5) * CELL - s.y, (k % W + 0.5) * CELL - s.x);
    if (p.gadget === 'claymore') placeAt('claymore', s.x, s.y, { ang, arm: 0 }); else later(s.x, s.y, () => game.ents.push({ id: game.eid(), type: 'wire', x: s.x, y: s.y, ang, team: TEAM.DEF, owner: p.id }));
    p.gadgetCount--;
  }
  // stair watch (he asked): from Gold up, one roamer waits by the stairs nearest the site to shoot drones coming up or
  // down, once their own preparation is done
  if (earnest && (m.stairs || []).length && ![...game.players.values()].some(q => q !== p && q.bot && q.squad === p.squad && q.ai && q.ai.stairWatch)) {
    const fl = floorAt(m, bomb.x, bomb.y); let best = null, bd = Infinity;
    for (let i = 0; i < m.stairs.length; i++) { const e = stairEnds(m, i, 0); for (const q of [e.top, e.bottom]) { if (floorAt(m, q.x, q.y) !== fl) continue; const d = Math.hypot(q.x - bomb.x, q.y - bomb.y); if (d < bd) { bd = d; best = q; } } }
    if (best && bd < 30 * CELL) ai.stairWatch = game.freeSpotNear(best.x, best.y, 40);
  } else ai.stairWatch = null;
}

// ---- path finding (A* over cells; barricades are passable but costly) ----
// avoid: cells this bot found it can't vault over (too deep, nowhere to land)
// The search's working memory is kept between searches (a stamp per cell says which search wrote it) instead of three
// fresh grid-sized arrays and a heap of little arrays every time (he asked: Lando's server must stay quiet).
let PF = null;
function pfBuf(N) {
  if (!PF || PF.N < N) PF = { N, g: new Float32Array(N), from: new Int32Array(N), seen: new Uint32Array(N), shut: new Uint32Array(N), cc: new Float32Array(N), cs: new Uint32Array(N), stamp: 0, hf: new Float64Array(4096), hk: new Int32Array(4096) };
  if (++PF.stamp > 4e9) { PF.seen.fill(0); PF.shut.fill(0); PF.cs.fill(0); PF.stamp = 1; }
  return PF;
}
const DIR8X = [1, -1, 0, 0, 1, 1, -1, -1], DIR8Y = [0, 0, 1, -1, 1, -1, 1, -1];
// cap/near (angleOn): stop after `cap` cells and, with `near`, return the way to the cell that got closest to the goal
function findPath(map, sx, sy, gx, gy, avoid, drone = false, def = false, inside = false, cap = 30000, near = false) {
  const W = map.W, H = map.H, N = W * H;
  const start = sy * W + sx, goal = gy * W + gx;
  const B = pfBuf(N), st = B.stamp, G = B.g, FR = B.from, seen = B.seen, shut = B.shut;
  const gOf = k => seen[k] === st ? G[k] : Infinity, fromOf = k => seen[k] === st ? FR[k] : -1;
  const setG = (k, v, f) => { if (seen[k] !== st) seen[k] = st; G[k] = v; FR[k] = f; };
  setG(start, 0, -1);
  let hf = B.hf, hk = B.hk, hn = 1; hf[0] = 0; hk[0] = start;
  const droneCost = k => { // a drone: through drone holes and barricade gaps, never over furniture or through walls
    const t = map.tiles[k];
    if (blocksDrone(t) && !((t === T.SOFT || t === T.HARD) && map.dhole && map.dhole[k]) && !underAt(map, k, t)) return Infinity;
    return 1;
  };
  const cellCost = drone ? droneCost : k => {
    const t = map.tiles[k];
    if (avoid && avoid.has(k)) return Infinity; // tried and failed (a vault with nowhere to land, a wall the swing can't reach)
    if (map.shape && map.shape[k] && map.shapeFill[k] < 10 && t !== T.VOID) return 2.5; // the open side of a sloped wall: a body slides along it
    if (def && t === T.PANEL) return 3000; // a defender never smashes the team's own steel panel unless there's truly no other way
    if (def && t === T.BARRI) return 300; // ...or its own barricade
    if (t === T.BARRI) return 8;
    if (t === T.SOFT && map.hp[k] > 0) return 30; // a plain wall: attackers will knock a hole in it if there's no other way
    if (t === T.PANEL) return 150; // a steel panel: very slow to hammer through, only when there is no other way in
    if (vaultable(map, k)) return t === T.LOW ? 10 : 4; // vault over it (low furniture only when it saves a long way round)
    if (blocksMove(t)) return Infinity;
    if (inside && t === T.GROUND) return 6; // early-round defender: the way round inside, not across the open ground by the spawns
    // keep a little away from walls so the bot's body fits
    const x = k % W, y = (k / W) | 0;
    const bl = (dx, dy) => blocksMove(tileAt(map, x + dx, y + dy));
    if ((bl(1, 0) && bl(-1, 0)) || (bl(0, 1) && bl(0, -1))) return 3; // a one-cell gap: a body just squeezes through
    let near = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (blocksMove(tileAt(map, x + dx, y + dy)) && tileAt(map, x + dx, y + dy) !== T.BARRI) near++;
    let edge = 0; if (t !== T.HOLE) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (tileAt(map, x + dx, y + dy) === T.HOLE) edge = 2; // the rim of a hole: a corner cut there drops you (the audit: a third of falls were accidents)
    return 1 + near * 0.6 + edge;
  };
  // a cell is looked at from up to 8 sides: its price is worked out once per search (this was a quarter of the server's work)
  const CC = B.cc, CS = B.cs;
  const cost = k => { if (CS[k] === st) return CC[k]; CS[k] = st; return (CC[k] = cellCost(k)); };
  // the same binary heap as before (same order on ties), kept in two flat arrays
  const push = (f, k) => {
    if (hn === hf.length) { const nf = new Float64Array(hn * 2), nk = new Int32Array(hn * 2); nf.set(hf); nk.set(hk); hf = B.hf = nf; hk = B.hk = nk; }
    hf[hn] = f; hk[hn] = k; let i = hn++;
    while (i > 0) { const pi = (i - 1) >> 1; if (hf[pi] <= hf[i]) break; const tf = hf[pi], tk = hk[pi]; hf[pi] = hf[i]; hk[pi] = hk[i]; hf[i] = tf; hk[i] = tk; i = pi; }
  };
  const pop = () => {
    const top = hk[0]; hn--;
    if (hn > 0) {
      hf[0] = hf[hn]; hk[0] = hk[hn]; let i = 0;
      for (;;) { const l = 2 * i + 1, r = l + 1; let s = i; if (l < hn && hf[l] < hf[s]) s = l; if (r < hn && hf[r] < hf[s]) s = r; if (s === i) break; const tf = hf[s], tk = hk[s]; hf[s] = hf[i]; hk[s] = hk[i]; hf[i] = tf; hk[i] = tk; i = s; }
    }
    return top;
  };
  let iter = 0;
  // distance guess measured in the shared building frame, so floors stacked above each other are "close"
  const F = map.floors || [], flAt = map.flAt;
  const lx = k => { const f = F[flAt ? flAt[k] : 0]; return k % W + (f ? f.x0 - f.gx : 0); };
  const ly = k => { const f = F[flAt ? flAt[k] : 0]; return ((k / W) | 0) + (f ? f.y0 : 0); };
  const glx = lx(goal), gly = ly(goal), gfl = flAt ? flAt[goal] : 0;
  const h = k => Math.hypot(glx - lx(k), gly - ly(k)) + (flAt && flAt[k] !== gfl ? 6 : 0);
  let best = start, bestH = Infinity;
  while (hn && iter++ < cap) {
    const k = pop();
    if (k === goal) break;
    if (shut[k] === st) continue; shut[k] = st;
    if (near) { const hk2 = h(k); if (hk2 < bestH) { bestH = hk2; best = k; } }
    const x = k % W, y = (k / W) | 0;
    const pk = map.portal ? map.portal[k] : -1; // the end of a staircase leads to the other floor
    if (pk >= 0) { const ng = G[k] + 1; if (ng < gOf(pk)) { setG(pk, ng, k); push(ng + h(pk), pk); } continue; }
    for (let di = 0; di < 8; di++) {
      const dx = DIR8X[di], dy = DIR8Y[di], nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const nk = ny * W + nx;
      if (dx && dy && (drone ? droneCost(y * W + nx) === Infinity || droneCost(ny * W + x) === Infinity : blocksMove(map.tiles[y * W + nx]) || blocksMove(map.tiles[ny * W + x]))) continue;
      const c = cost(nk); if (c === Infinity) continue;
      const ng = G[k] + c * (dx && dy ? 1.414 : 1);
      if (ng < gOf(nk)) { setG(nk, ng, k); push(ng + h(nk), nk); }
    }
  }
  let end = goal;
  if (fromOf(goal) < 0 && goal !== start) { if (!near || best === start) return null; end = best; }
  const path = [];
  for (let k = end; k !== start && k >= 0; k = fromOf(k)) path.push(k);
  return path.reverse();
}

export function visibleEnemy(game, p, see) {
  const team = game.side(p);
  const smokes = game.smokeList();
  let best = null, bd = Infinity;
  for (const q of game.players.values()) {
    if (!q.alive || game.side(q) === team || q.shrouded && Math.hypot(q.x - p.x, q.y - p.y) > 60) continue;
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d > see || d > bd) continue;
    const a = Math.atan2(q.y - p.y, q.x - p.x);
    if (d > 70 && Math.abs(angDiff(a, p.aim)) > (p.pro ? 0.9 : 1.2)) continue; // pros: a human 103° view
    if (!los(game.map, p.x, p.y, q.x, q.y, smokes)) continue;
    best = q; bd = d;
  }
  // up or down a staircase: someone on its steps or landing shows on this floor's steps too
  const fl = floorAt(game.map, p.x, p.y);
  for (const q of game.players.values()) {
    if (!q.alive || q.staged || game.side(q) === team || q.shrouded) continue;
    const gh = stairGhost(game.map, q.x, q.y);
    if (!gh || gh.fl !== fl || !stairLooks(game.map, gh.s, p.x, p.y)) continue;
    const d = Math.hypot(gh.x - p.x, gh.y - p.y);
    if (d > see || d > bd || (d > 70 && Math.abs(angDiff(Math.atan2(gh.y - p.y, gh.x - p.x), p.aim)) > (p.pro ? 0.9 : 1.2))) continue;
    if (!los(game.map, p.x, p.y, gh.x, gh.y, smokes)) continue;
    const seen = Object.create(q); seen.x = gh.x; seen.y = gh.y; // the person, where they show
    best = seen; bd = d;
  }
  // upper windows (he asked): from up at a window, enemies on the ground below (or on a rope) through the view down,
  // aimed at where they show from up here (the shot carries down: game.shotOutWindow); from the ground, someone at
  // an upper window or on a rope, where they show just outside the wall
  const m = game.map, gi = m.groundFloor, wide = p.pro ? 0.9 : 1.2;
  const take = (q, x, y, win) => {
    const d = Math.hypot(x - p.x, y - p.y);
    if (d > see || d > bd || (d > 70 && Math.abs(angDiff(Math.atan2(y - p.y, x - p.x), p.aim)) > wide)) return;
    const seen = Object.create(q); seen.x = x; seen.y = y; if (win) seen.win = 1;
    best = seen; bd = d;
  };
  if (gi !== undefined && fl > gi) {
    const vs = windowViews(m, p.x, p.y);
    if (vs.length) {
      const o = floorOff(m, gi, fl);
      for (const q of game.players.values()) {
        if (!q.alive || q.staged || game.side(q) === team || q.shrouded) continue;
        const qf = floorAt(m, q.x, q.y), gh = qf > gi ? wallGhost(m, q.x, q.y) : null, at = qf === gi ? q : gh && gh.rope ? gh : null;
        if (at && vs.some(v => windowSees(m, v, at.x, at.y, smokes))) take(q, at.x + o.x, at.y + o.y, true);
      }
    }
  } else if (gi !== undefined && fl === gi) {
    for (const q of game.players.values()) {
      if (!q.alive || q.staged || game.side(q) === team || q.shrouded) continue;
      const gh = wallGhost(m, q.x, q.y);
      const pv = gh && peekSeen(m, gh, p.x, p.y, smokes); if (pv) take(q, pv === true ? gh.x : pv.x, pv === true ? gh.y : pv.y, false); // (where they show from here)
    }
  }
  // through an open hatch: whoever is in the patch the opening shows (hatchSight, at this bot's stance), aimed at where
  // they show from here (the shot goes through: game.holeAim)
  const stance = p.pr >= 1 ? 'prone' : p.input && p.input.crouch ? 'crouch' : 'stand';
  for (const h of m.hatches || []) {
    const v = hatchOpen(m, h) && hatchSight(m, h, p.x, p.y, stance); if (!v) continue;
    const vf = floorAt(m, v.x, v.y);
    for (const q of game.players.values()) {
      if (!q.alive || q.staged || game.side(q) === team || q.shrouded || floorAt(m, q.x, q.y) !== vf) continue;
      if (canSee(m, v, q.x, q.y, smokes)) take(q, q.x - v.o.x, q.y - v.o.y, 'hatch');
    }
  }
  return best;
}

function behindDrone(game, p, e, d) {
  const ux = (e.x - p.x) / (d || 1), uy = (e.y - p.y) / (d || 1);
  for (const q of game.players.values()) {
    if (q === p || !q.alive) continue;
    const ax = q.x - p.x, ay = q.y - p.y, along = ax * ux + ay * uy;
    if (along > d - 10 && along < d + 400 && Math.abs(ax * uy - ay * ux) < 30) return true;
  }
  return false;
}

// Can a bullet get from p to q? Sight is not enough: a deployable shield or cover plate lets you see through it but
// stops bullets (he saw a pro empty three magazines into one), and a teammate in the way would be shot (friendly fire).
function shotClear(game, p, q) {
  const m = game.map, d = Math.hypot(q.x - p.x, q.y - p.y); if (d < 1) return true;
  if (q.win === 'hatch') return true; // down (or up) through a hatch: the opening is the way
  const dx = (q.x - p.x) / d, dy = (q.y - p.y) / d, sx = Math.floor(p.x / CELL), sy = Math.floor(p.y / CELL);
  let ok = true;
  walkRay(p.x, p.y, dx, dy, d, (cx, cy) => {
    if (cx === sx && cy === sy) return false;
    const t = tileAt(m, cx, cy); if (q.win && t === T.VOID) return true; // out of a window: it carries on down there
    if (!stopsBullet(t) || (t === T.LOW && m.floor[cy * m.W + cx] === FL.VOID)) return false; // (a rope ledge is open air: someone hanging there can be shot)
    const sh = shapeAt(m, cx, cy); if (sh) { const h = rayShape(sh, p.x, p.y, dx, dy); if (h === null || h > d) return false; }
    ok = false; return true;
  });
  if (!ok || rayCovers(m, p.x, p.y, dx, dy, d - 4)) return false;
  // a gun that carries on through walls (the Mammoth, a marksman rifle, NAIL's piercing round) can hit a teammate far behind the target (the audit found two)
  const gw = p.guns && p.guns[p.slot] && WEAPONS[p.guns[p.slot].w], far = gw && (p.pierceShot || (gw.pen || 0) >= 0.68 || gw.cls === 'DMR') ? gw.range : d + 300;
  for (const o of game.players.values()) {
    if (o === p || !o.alive || game.side(o) !== game.side(p) || floorAt(m, o.x, o.y) !== floorAt(m, p.x, p.y)) continue;
    const ax = o.x - p.x, ay = o.y - p.y, along = ax * dx + ay * dy;
    if (along > 0 && along < far && Math.abs(ax * dy - ay * dx) < hitR(o.op) + 4 + along * 0.05) return false; // a miss flies on past the target, and spreads
  }
  return true;
}
// A teammate on the same line from a threat (in front of or behind this bot): one burst could hit both (he asked: bots
// must never line up). Returns the side to step to (-1 / 1), or 0 when the line is clear.
function linedUp(game, p, from) {
  if (!from) return 0;
  const d = Math.hypot(p.x - from.x, p.y - from.y); if (d < 30) return 0;
  const ux = (p.x - from.x) / d, uy = (p.y - from.y) / d;
  for (const o of game.players.values()) {
    if (o === p || !o.alive || o.downed || game.side(o) !== game.side(p)) continue;
    const ax = o.x - from.x, ay = o.y - from.y, along = ax * ux + ay * uy, side = ax * uy - ay * ux;
    if (along > 20 && along < d + 220 && Math.abs(along - d) > 8 && Math.abs(side) < 16) return side > 0 ? -1 : 1;
  }
  return 0;
}
// Look round like a person (he asked: no slow idle spinning): pick a spot an enemy could come from, swing to it,
// hold it for a moment, then the next.
function checkAngles(game, p, dt, rate = 0.7) {
  const ai = p.ai;
  if (!ai.lookUntil || game.time > ai.lookUntil) {
    ai.lookPt = threatPoint(game, p, p.aim + (Math.random() - 0.5) * 4) || (Math.random() < 0.5 ? watchPoint(game, p) : null);
    let la = p.aim, ld = -1; // nothing to check: the longest view of a few glances to either side, not a wall
    for (let i = 0; i < 6; i++) { const a = p.aim + (i & 1 ? -1 : 1) * (0.6 + Math.random() * 1.2), d = castSight(game.map, p.x, p.y, a, 500, null); if (d > ld) { ld = d; la = a; } }
    ai.lookA = la;
    ai.lookUntil = game.time + 1.4 + Math.random() * 2.4;
  }
  turnTo(p, ai.lookPt ? Math.atan2(ai.lookPt.y - p.y, ai.lookPt.x - p.x) : ai.lookA, skill(game, p).turn * rate, dt);
}

function enemyDrone(game, p) {
  const team = game.side(p);
  const smokes = game.smokeList();
  let best = null, bd = Infinity;
  for (const e of game.ents) {
    if ((e.type !== 'drone' && e.type !== 'bird') || e.team === team) continue; // (attackers shoot MAGPIE's birds too)
    if (e.type === 'drone') { const dk = Math.floor(e.y / CELL) * game.map.W + Math.floor(e.x / CELL); if (underAt(game.map, dk, game.map.tiles[dk])) continue; } // hidden under a vehicle or table
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d > 260 || d > bd || floorAt(game.map, e.x, e.y) !== floorAt(game.map, p.x, p.y)) continue;
    if (d > 60 && Math.abs(angDiff(Math.atan2(e.y - p.y, e.x - p.x), p.aim)) > 1.2) continue;
    if (!los(game.map, p.x, p.y, e.x, e.y, smokes)) continue;
    if (behindDrone(game, p, e, d)) continue; // a miss would hit a person standing behind it (bullets go through soft walls)
    if (e.type === 'drone' && leaveForMagpie(game, p, e)) continue;
    best = e; bd = d;
  }
  return best;
}
// MAGPIE (he asked): with a MAGPIE on the team who still has swarms, defender bots only shoot drones far from her reach,
// and leave the rest for her to take over; the team says which (a drone a swarm is already on is always left alone).
// A bot MAGPIE takes the drone herself if it is in her reach.
const magpieOf = (game, team) => [...game.players.values()].filter(q => q.op === 'magpie' && q.alive && !q.downed && game.side(q) === team && q.abilityCount > 0);
function leaveForMagpie(game, p, e) {
  if (p.op === 'magpie' && p.abilityCount > 0) return false; // she deals with it (botThink)
  if (game.ents.some(s => s.type === 'swarm' && s.target === e.id)) return true;
  const mags = magpieOf(game, game.side(p)); if (!mags.length) return false;
  const near = mags.find(q => Math.hypot(q.x - e.x, q.y - e.y) < SWARM.keep * PX_PER_M), where = place(game, e.x, e.y) || 'here';
  const lt = game.leaveT || (game.leaveT = {}); lt[e.id] ??= game.time; // (found at playtest: drones she never got to were left alone all round)
  if (near && game.time - lt[e.id] < 5) { teamSay(game, p, `Drone ${where}: not shooting it, leaving it for ${near.name.replace(/^\[\w+\] /, '')}`, 'mgL' + e.id); return true; }
  if (near) { teamSay(game, p, `${near.name.replace(/^\[\w+\] /, '')} didn't take the drone ${where}, shooting it`, 'mgS' + e.id); return false; }
  teamSay(game, p, `Drone ${where} is too far for MAGPIE, shooting it`, 'mgS' + e.id);
  return false;
}
// a line to the team: pros through proSay; other bots only when a person is on their team (and not often)
function teamSay(game, p, text, key) {
  if (p.pro) return proSay(game, p, text, key);
  if (![...game.players.values()].some(o => !o.bot && o.squad === p.squad)) return;
  const said = game.botSaid || (game.botSaid = {});
  if (game.time - (said[key] ?? -99) < 15 || game.time - (p.saidT ?? -99) < 6) return;
  said[key] = p.saidT = game.time;
  game.chat(p, { text: text.slice(0, 140), team: true });
}

// An enemy gadget in plain sight that an Arc Gun can fry (cameras, traps, jammers...).
const TRAPS = new Set(['cam', 'prox', 'concuss', 'clamp', 'mine', 'claymore', 'sensor', 'jammer', 'grid', 'plates']);
function enemyGadget(game, p, reach) {
  const team = game.side(p);
  let best = null, bd = reach;
  for (const e of game.ents) {
    if (!TRAPS.has(e.type) || e.team === team || !e.hp) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < bd && floorAt(game.map, e.x, e.y) === floorAt(game.map, p.x, p.y) && los(game.map, p.x, p.y, e.x, e.y)) { bd = d; best = e; }
  }
  return best;
}

// A teammate who is down and can be reached: worth more than the objective (a reliable teammate picks people up).
function downedMate(game, p, team) {
  let best = null, bd = 320;
  for (const q of game.players.values()) {
    if (q === p || !q.alive || !q.downed || game.side(q) !== team) continue;
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < bd && floorAt(game.map, q.x, q.y) === floorAt(game.map, p.x, p.y)) { bd = d; best = q; }
  }
  return best;
}

// Turn toward an angle at most `rate` radians per second.
function turnTo(p, a, rate, dt) {
  if (p.pro) return mouseTurn(p, a, rate, dt);
  p.aim += Math.max(-dt * rate, Math.min(dt * rate, angDiff(a, p.aim)));
}
// He asked (Esports TV): bots stared at walls while holding, then snapped round at contact. The angle worth holding
// toward pt: pt itself when it can be seen, else the corner it would come round (the furthest point of the way there
// still in sight), else the nearest way in roughly that way. Worked out at most every 1.2 s per bot.
const ANGLE_CAP = 2500;
function angleOn(game, p, pt) {
  if (!pt) return null;
  const ai = p.ai, m = game.map;
  if (los(m, p.x, p.y, pt.x, pt.y)) return pt;
  const key = Math.floor(pt.y / CELL) * m.W + Math.floor(pt.x / CELL);
  if (ai.aoKey === key && game.time < ai.aoT) return ai.ao;
  const path = findPath(m, Math.floor(p.x / CELL), Math.floor(p.y / CELL), Math.floor(pt.x / CELL), Math.floor(pt.y / CELL), ai.noVault, false, game.side(p) === TEAM.DEF, false, ANGLE_CAP, true) || []; // only the first stretch is used, so a capped search does (pro practice was 63% this)
  let best = null;
  for (let i = 0; i < path.length && i < 80; i++) {
    const x = (path[i] % m.W + 0.5) * CELL, y = (Math.floor(path[i] / m.W) + 0.5) * CELL;
    if (floorAt(m, x, y) !== floorAt(m, p.x, p.y)) break;
    if (los(m, p.x, p.y, x, y)) { if (Math.hypot(x - p.x, y - p.y) > 1.5 * CELL) best = { x, y }; } else if (best || i > 3) break;
  }
  ai.aoKey = key; ai.aoT = game.time + 1.2;
  return (ai.ao = best || threatPoint(game, p, Math.atan2(pt.y - p.y, pt.x - p.x)) || pt);
}
// Where a bot walking along its path looks: the furthest bit of the path ahead it can see (round the next corner as it
// comes), not the very next cell (often a wall beside a doorway).
function pathLook(game, p) {
  const ai = p.ai, m = game.map;
  if (game.time < (ai.plT || 0) && ai.pl) return ai.pl;
  let best = null;
  for (let i = 0; i < ai.path.length && i < 14; i++) {
    const x = (ai.path[i] % m.W + 0.5) * CELL, y = (Math.floor(ai.path[i] / m.W) + 0.5) * CELL;
    if (floorAt(m, x, y) !== floorAt(m, p.x, p.y) || !los(m, p.x, p.y, x, y)) break;
    best = { x, y };
  }
  ai.plT = game.time + 0.3; return (ai.pl = best);
}
// Aim along an angle and set the throw point (grenades land where you aim, up to 300 px away).
function aimAt(p, x, y) {
  p.aim = Math.atan2(y - p.y, x - p.x);
  const d = Math.min(300, Math.hypot(x - p.x, y - p.y));
  p.aimX = p.x + Math.cos(p.aim) * d; p.aimY = p.y + Math.sin(p.aim) * d;
}
function shootInput(inp, ai, gun) { const w = gun && WEAPONS[gun.w]; inp.fire = w && (!w.auto || w.dual) ? (ai.semi = !ai.semi) ? 1 : 0 : 1; }

// ---- breaching: attackers who carry something that opens walls pick a site wall and open it ----
// tool: which walls it can open, how it is used and how long to stand back afterwards.
const BREACH_TOOLS = {
  cutter: { types: [T.REINF, T.SOFT], use: 'ability', back: 6 },
  lance: { types: [T.REINF, T.SOFT], use: 'hold', back: 0 },
  cluster: { types: [T.SOFT], use: 'ability', back: 4 },
  scope: { types: [T.SOFT], use: 'ability', back: 0 },
  slug: { types: [T.SOFT], use: 'ability', back: 0 },
  sticky: { types: [T.SOFT], use: 'ability', back: 2.5, blow: true }, // SALVO: stick a round, step back, set it off
  saw: { types: [T.SOFT], use: 'ability', back: 0 }, // TORQUE: a see-through slit onto the site
  // (FERRO's hammer can't break walls: he swings at barricades, braces and hatches instead, in botAbility)
  breach: { types: [T.SOFT], use: 'gadget', back: 3.5 },
};
function breachTool(p) {
  const ab = OPERATORS[p.op].ability.id;
  if (BREACH_TOOLS[ab] && (p.abilityCount > 0 || !OPERATORS[p.op].ability.count || ab === 'lance' && p.battery > 2)) return ab;
  if (p.gadget === 'breach' && p.gadgetCount > 0) return 'breach';
  return null;
}
// A wall cell round the site that this tool can open, with clear floor outside it to stand on; one bot per wall.
function planBreach(game, p, tool) {
  const m = game.map, W = m.W, site = m.sites[game.site], types = BREACH_TOOLS[tool].types;
  if (game.botClaimRound !== game.round) { game.botClaimRound = game.round; game.botClaims = new Set(); }
  const inSite = siteTest(m, site), fl = floorAt(m, p.x, p.y);
  let best = null, bd = Infinity;
  for (let k = W; k < m.tiles.length - W; k++) {
    if (!types.includes(m.tiles[k]) || m.shape[k] || !inSite(k % W, Math.floor(k / W)) || inRoomOf(m, site.rooms, k % W, Math.floor(k / W))) continue;
    if (game.botClaims.has(k) || game.botClaims.has(k - 1) || game.botClaims.has(k + 1) || game.botClaims.has(k - W) || game.botClaims.has(k + W)) continue;
    for (const d of [1, -1, W, -W]) {
      const inK = k + d, out = k - d, out2 = k - 2 * d;
      if (!inRoomOf(m, site.rooms, inK % W, Math.floor(inK / W))) continue;
      if (inRoomOf(m, site.rooms, out % W, Math.floor(out / W))) continue;
      const ok = q => m.tiles[q] === T.FLOOR || m.tiles[q] === T.GROUND;
      if (!ok(out) || !ok(out2)) continue;
      // a straight bit of wall (both neighbours along it are wall too), so the hole is a doorway, not a corner
      const along = d === 1 || d === -1 ? W : 1;
      if (![k + along, k - along].every(q => [T.SOFT, T.REINF, T.HARD].includes(m.tiles[q]))) continue;
      const sx = (out % W + 0.5) * CELL, sy = (Math.floor(out / W) + 0.5) * CELL;
      const dist = Math.hypot(sx - p.x, sy - p.y) + (floorAt(m, sx, sy) !== fl ? 400 : 0) + (m.tiles[k] === T.REINF ? -150 : 0);
      if (dist < bd) { bd = dist; best = { k, d, sx, sy, wx: (k % W + 0.5) * CELL, wy: (Math.floor(k / W) + 0.5) * CELL }; }
    }
  }
  // nothing left on the site itself (defenders reinforced it all): open a breakable wall next to the site instead,
  // for a new way in or a line of sight onto it, from whichever side this bot is on
  if (!best) {
    const b = site.bombs[0];
    for (let k = W; k < m.tiles.length - W; k++) {
      if (!types.includes(m.tiles[k]) || m.shape[k] || game.botClaims.has(k)) continue;
      const wx = (k % W + 0.5) * CELL, wy = (Math.floor(k / W) + 0.5) * CELL;
      if (floorAt(m, wx, wy) !== floorAt(m, b.x, b.y) || Math.hypot(wx - b.x, wy - b.y) > 320) continue;
      for (const d of [1, -1, W, -W]) {
        const out = k - d, out2 = k - 2 * d, inK = k + d, along = d === 1 || d === -1 ? W : 1;
        const ok = q => m.tiles[q] === T.FLOOR || m.tiles[q] === T.GROUND;
        if (!ok(out) || !ok(out2) || !ok(inK) || ![k + along, k - along].every(q => [T.SOFT, T.REINF, T.HARD].includes(m.tiles[q]))) continue;
        const sx = (out % W + 0.5) * CELL, sy = (Math.floor(out / W) + 0.5) * CELL;
        if (Math.hypot((inK % W + 0.5) * CELL - b.x, (Math.floor(inK / W) + 0.5) * CELL - b.y) > Math.hypot(sx - b.x, sy - b.y)) continue; // stand on the far side from the site
        const dist = Math.hypot(sx - p.x, sy - p.y) + (floorAt(m, sx, sy) !== fl ? 400 : 0);
        if (dist < bd) { bd = dist; best = { k, d, sx, sy, wx, wy }; }
      }
    }
  }
  if (best) game.botClaims.add(best.k);
  return best;
}

// A spot in a room near (but not in) the site, for a roaming defender; and the nearest way into that room to watch.
function roamSpot(game, p) {
  const m = game.map, site = m.sites[game.site], b = site.bombs[0], bl = localPos(m, b.x, b.y);
  const list = m.rooms.filter(r => !site.rooms.includes(r.name) && r.w * r.h >= 20).filter(r => {
    const c = localPos(m, (r.x + r.w / 2) * CELL, (r.y + r.h / 2) * CELL);
    return Math.hypot(c.x - bl.x, c.y - bl.y) < 560 && Math.abs(c.f - bl.f) <= 1;
  });
  if (!list.length) return null;
  const r = list[Math.floor(Math.random() * list.length)];
  return game.freeSpotNear((r.x + r.w / 2) * CELL, (r.y + r.h / 2) * CELL, Math.min(r.w, r.h) * CELL * 0.3);
}

export function botThink(game, p, dt) {
  flushReplies(game);
  amateurComms(game, p, dt);
  const ai = p.ai;
  const inp = { up: 0, down: 0, left: 0, right: 0, walk: 0, crouch: 0, fire: 0, ads: 0, interact: 0, ability: 0 };
  p.input = inp;
  if (p.alive && p.ctrl === 'drone') {
    if (p.pro && game.phase === PHASE.ACTION) { const st = proPlan(game, p.squad, 'atk'), j = st.plan && st.plan.jobs[p.pro.pl.jobs.atk]; if (!j || !j.keepDrone || elapsedAction(game) > j.keepDrone + (TIMING[p.pro.pl.name] || 0) || game.planted) { game.toggleView(p); p.ai.droneDone = true; return; } }
    botDrone(game, p, dt); return;
  }
  if (p.pro && p.alive && p.ctrl === 'body' && game.phase === PHASE.ACTION && game.side(p) === TEAM.ATK && !p.ai.droneDone && !p.downed) { // the intel player goes back to the drone left inside
    const st = proPlan(game, p.squad, 'atk'), j = st.plan && st.plan.jobs[p.pro.pl.jobs.atk];
    if (j && j.keepDrone && elapsedAction(game) < 1.5 && game.ent(p.droneId)) { game.toggleView(p); return; }
    if (elapsedAction(game) > 1.5) p.ai.droneDone = true;
  }
  if (p.alive && p.ctrl === 'cam' && p.bot) { botCams(game, p, dt); return; }
  if (!p.alive || p.ctrl !== 'body') return;
  if (game.phase === PHASE.PREP && game.side(p) === TEAM.ATK) return;
  const team = game.side(p), map = game.map, site = map.sites[game.site], S = skill(game, p), me = persona(p);
  const gun = p.guns[p.slot];
  const action = game.phase === PHASE.ACTION;
  if (!ai.role) ai.role = roleFor(game, p, team);
  const abId = OPERATORS[p.op].ability.id;
  const useAbility = () => game.event(p, { k: 'ability' });
  if (action && team === TEAM.ATK && !p.downed && windowPlay(game, p, inp, dt)) { if (!ai.winF) { ai.winF = 1; feat(p, 'rappel'); } return; } // (he asked) R6's rappel: up to a site window, peek, in
  if (action && team === TEAM.ATK && !p.downed && roofPlay(game, p, inp, dt)) { if (!ai.roofF) { ai.roofF = 1; feat(p, 'roof'); } return; } // (he asked) up on the roof, in through a hatch

  // --- hearing: the most recent enemy noise this bot could hear ---
  for (const n of game.noises || []) {
    if (n.team === team || game.time - n.t > 1.5 || (ai.heard && ai.heard.t >= n.t)) continue;
    const ln = localPos(map, n.x, n.y), lp = localPos(map, p.x, p.y), fd = Math.abs(ln.f - lp.f);
    // loud noises (gunfire, blasts, sirens) are heard through the whole building, a floor up or down too, unless it is huge
    const r = n.r >= 900 && fd <= 1 ? Math.max(n.r, 2400 - fd * 600) : n.r * (fd === 0 ? 1 : 0.5);
    const hd = Math.hypot(ln.x - lp.x, ln.y - lp.y);
    if (hd < r * (p.pro ? 0.8 : EAR[lvlOf(game, p)])) { if (p.pro) { const e = hd * 0.22 + (floorAt(map, n.x, n.y) === floorAt(map, p.x, p.y) ? 0 : 60), a = Math.random() * 6.28, rr = Math.random() * e; ai.heard = { x: n.x + Math.cos(a) * rr, y: n.y + Math.sin(a) * rr, t: n.t }; } else ai.heard = { x: n.x, y: n.y, t: n.t }; } // pros hear like people: roughly where, not exactly
  }
  // --- team intel: an enemy a teammate (or camera) spotted close by is worth turning to face, once in a while ---
  if ((p.pro || lvlOf(game, p) >= 2) && (!ai.heard || game.time - ai.heard.t > 3)) for (const id of game.spots[team].keys()) { // (Copper and Bronze don't follow the callouts)
    const q = game.players.get(id); if (!q || !q.alive) continue;
    ai.spotT = ai.spotT || {};
    if (game.time - (ai.spotT[id] || -99) < 8 || Math.hypot(q.x - p.x, q.y - p.y) > 420 || floorAt(map, q.x, q.y) !== floorAt(map, p.x, p.y)) continue;
    ai.spotT[id] = game.time; ai.heard = { x: q.x, y: q.y, t: game.time }; break;
  }
  const heardRecently = ai.heard && game.time - ai.heard.t < 4;
  if (heardRecently && ai.heard.t !== ai.heardSaid && game.phase === PHASE.ACTION && Math.random() < 0.1) { ai.heardSaid = ai.heard.t;
    const up = floorAt(map, ai.heard.x, ai.heard.y) !== floorAt(map, p.x, p.y); if (up) talk(game, p, 'heardFloor', {}, 'hearUp'); else talk(game, p, 'heard', { place: place(game, ai.heard.x, ai.heard.y) }, 'hear' + place(game, ai.heard.x, ai.heard.y)); }
  if (heardRecently && action0(game) && p.alive && !p.downed && game.time - ai.heard.t < 2 && floorAt(map, ai.heard.x, ai.heard.y) === floorAt(map, p.x, p.y) && Math.hypot(ai.heard.x - p.x, ai.heard.y - p.y) < 7 * PX_PER_M) listenUp(game, p);
  if (p.alive && !p.downed && p.hp < p.maxHp * 0.3 && !ai.lowSaid) { ai.lowSaid = true; talk(game, p, 'low'); }
  if (p.reloadT > 0 && !ai.rlSaid) { ai.rlSaid = true; if (heardRecently && Math.random() < 0.3) talk(game, p, 'reload'); } else if (p.reloadT <= 0) ai.rlSaid = false;

  // --- held abilities: let go unless something below holds them again ---
  if (abId === 'shroud') { const want = heardRecently && p.battery > 1.5 && !p.downed; inp.ability = want !== !!p.shrouded && !(p.prevInput && p.prevInput.ability) ? 1 : 0; } // go dark while enemies are close by (a toggle: press to switch)
  if (abId === 'scan' && action && !p.downed) { // a few seconds of scanning when something is heard, or every so often
    ai.scanT = (ai.scanT ?? 8 + Math.random() * 10) - dt;
    if ((heardRecently || ai.scanT < 0) && p.battery > 1) { inp.ability = 1; if (ai.scanT < -3) ai.scanT = 15 + Math.random() * 15; }
    if (p.scanBlips && p.scanBlips.size) { const z = [...p.scanBlips.values()][0]; ai.heard = { x: z.x, y: z.y, t: game.time }; ai.heardSaid = game.time; talk(game, p, 'scanHit', { place: place(game, z.x, z.y) }, 'scan'); }
  }

  // --- fight ---
  const enemy = p.downed ? null : visibleEnemy(game, p, S.see);
  if (enemy && abId === 'adrenal' && p.abilityCount > 0 && !(game.time < (p.boostUntil || 0))) useAbility();
  if (enemy && ['tracer', 'burst', 'saw'].includes(abId) && p.abilityCount > 0 && Math.random() < dt * 0.6) useAbility(); // (the saw disc goes at the enemy too)
  if (enemy && abId === 'lunge' && p.abilityCount > 0 && !(p.lungeUntil > game.time) && Math.hypot(enemy.x - p.x, enemy.y - p.y) < 80) useAbility(); // CROW: close enough to lunge
  if (abId === 'lunge' && p.lungeUntil > game.time && enemy && Math.hypot(enemy.x - p.x, enemy.y - p.y) < 2 * PX_PER_M + 8) { aimAt(p, enemy.x, enemy.y); game.event(p, { k: 'melee' }); }
  if (abId === 'sticky') { // SALVO: once her rounds are stuck and she is clear of them, blow them
    const mine = game.ents.filter(e => e.type === 'sticky' && e.owner === p.id && e.stuck && !e.go);
    if (mine.length && mine.every(e => Math.hypot(e.x - p.x, e.y - p.y) > 60) && Math.random() < dt * 2) useAbility();
  }
  if (action && !p.downed && botAbility(game, p, ai, abId, enemy, heardRecently, team, site, useAbility, inp, dt)) return; // (welding: stand and hold)
  if (enemy) {
    const d = Math.hypot(enemy.x - p.x, enemy.y - p.y);
    if (ai.seen !== enemy.id) { // a surprise takes longer to react to than something they were listening for
      const expected = heardRecently && Math.hypot(ai.heard.x - enemy.x, ai.heard.y - enemy.y) < 200;
      ai.seen = enemy.id; ai.seenT = game.time; ai.shotAtSeen = false; ai.oh = Math.random() < S.head; ai.os = ai.oh ? (Math.random() - 0.5) * 2 : (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * Math.max(1.5, S.body / 2 - 3)); // across the body: the head (its centre, top-down) only when they go for it
      ai.react = -(expected ? S.expect : S.react) - Math.random() * S.reactX * (expected ? 0.6 : 1);
      ai.err = p.pro ? (Math.random() < 0.5 ? -1 : 1) * 0.02 * (1 + S.err) : (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.4) * S.err; // a pro's error comes from their hand (mouseTurn): pre-aimed at the angle, they are nearly on
      ai.called = false;
      if (game.tut) { ai.react -= 0.7; ai.err *= 1.8; } // tutorial bots are slow and shaky, so a beginner can win
    }
    ai.react += dt; ai.err *= Math.exp(-dt * S.settle);
    ai.err += (Math.random() - 0.5) * dt * 0.6 * (S.shake ?? 1); // hands are never perfectly steady
    const os = (ai.os || 0) / Math.max(1, d), want = Math.atan2(enemy.y + (enemy.x - p.x) * os - p.y, enemy.x - (enemy.y - p.y) * os - p.x) + ai.err; // somewhere across the body, not always the head
    turnTo(p, want, S.turn, dt);
    p.aimX = p.x + Math.cos(p.aim) * d; p.aimY = p.y + Math.sin(p.aim) * d; // their crosshair sits on what they aim at (it used to stay where the last throw went, so bots could almost never headshot)
    if (!ai.oh) { const hx = p.aimX - enemy.x, hy = p.aimY - enemy.y, hd = Math.hypot(hx, hy); if (hd < HEAD_AIM + 0.5) { const k = (HEAD_AIM + 0.5) / Math.max(0.01, hd); p.aimX = enemy.x + (hd > 0.01 ? hx * k : HEAD_AIM + 0.5); p.aimY = enemy.y + (hd > 0.01 ? hy * k : 0); } } // going for the body: a shaky hand crossing the head doesn't count as aiming at it
    inp.ads = 1;
    // call it out to the team once they've taken it in (a ping with the operator's name and the room)
    if (!ai.called && ai.react > -0.1) {
      ai.called = true; game.spot(team, enemy.id, 3);
      { const near = [...game.players.values()].filter(q => q.alive && game.side(q) !== team && Math.hypot(q.x - enemy.x, q.y - enemy.y) < 120).length;
        talk(game, p, near > 1 ? 'seeMany' : enemy.hp < enemy.maxHp * 0.4 ? 'seeLow' : 'see', { op: opName(enemy), place: place(game, enemy.x, enemy.y) }, 'see' + enemy.id); }
      if (([...game.players.values()].some(q => !q.bot && q.squad === p.squad) || (game.tv && !p.pro)) && game.markOk(p)) game.mark(p, enemy.x, enemy.y, 'ENEMY ' + OPERATORS[enemy.op].name, enemy.id); // he asked: most ranks ping rather than talk
    }
    if (gun && gun.ammo === 0) { game.startReload(p); if (d < 120 && p.guns[1] && p.slot === 0 && gun.reserve >= 0) game.event(p, { k: 'slot', n: 1 }); }
    // a shield facing us: circle round it and only shoot once its side shows (as people do)
    if (p.bracing && d < 32) { p.aim = Math.atan2(enemy.y - p.y, enemy.x - p.x); game.event(p, { k: 'melee' }); return; } // shield bash
    if (p.bracing && abId === 'brace' && Math.random() < dt * 0.8) inp.ability = 1; // now and then put the shield away to shoot (a riot shield stays up: aiming in swings it aside)
    if (!p.bracing && abId === 'brace' && d < 45 && Math.random() < dt) inp.ability = 1;
    const clear = shotClear(game, p, enemy);
    if (!clear && ai.react > 0) { // seen but not shootable (a shield or cover plate in the way, or a teammate): find an angle instead of wasting the magazine
      ai.blockT = (ai.blockT || 0) + dt;
      if (!ai.blockSide || ai.blockT > 3) { ai.blockSide = ai.blockSide ? -ai.blockSide : (Math.random() < 0.5 ? -1 : 1); ai.blockT = ai.blockT > 3 ? 0.01 : ai.blockT; }
      if (['frag', 'impact'].includes(p.gadget) && p.gadgetCount > 0 && d > 70 && d < 260 && !ai.blockNade && ai.blockT > 1) { ai.blockNade = true; aimAt(p, enemy.x, enemy.y); game.event(p, { k: 'gadget' }); }
      const sa = Math.atan2(enemy.y - p.y, enemy.x - p.x) + Math.PI / 2 * ai.blockSide; setDir(inp, Math.cos(sa), Math.sin(sa));
      return;
    }
    ai.blockT = 0;
    const esp = enemy.bracing ? game.shieldOf(enemy) : null; // a shield swung aside (firing, knocked, a jogging gap) is a chance to shoot
    const shieldUp = enemy.bracing && !enemy.downed && !esp.off && Math.abs(angDiff(Math.atan2(p.y - enemy.y, p.x - enemy.x), enemy.aim + esp.rot)) < esp.arc - 0.1;
    if (shieldUp && d < 26) { p.aim = Math.atan2(enemy.y - p.y, enemy.x - p.x); game.event(p, { k: 'melee' }); return; } // knock the shield aside
    if (shieldUp && !(game.time < (enemy.shieldDownUntil || 0))) { ai.strafe = ai.strafe || (Math.random() < 0.5 ? -1 : 1); const sa = Math.atan2(enemy.y - p.y, enemy.x - p.x) + Math.PI / 2 * ai.strafe; setDir(inp, Math.cos(sa), Math.sin(sa)); return; }
    else if (!game.tut && !(game.free && game.free.noFire) && ai.react > 0 && Math.abs(angDiff(want, p.aim)) < S.tol) shootInput(inp, ai, gun); // tutorial bots never shoot
    // the arc gun zaps a defender in reach as well as gadgets
    if (abId === 'arc' && p.abilityCount > 0 && ai.react > 0 && d < 300 && Math.abs(angDiff(want, p.aim)) < 0.1 && Math.random() < dt * 0.5) useAbility();
    ai.strafeT = (ai.strafeT || 0) - dt;
    if (ai.strafeT <= 0) { ai.strafeT = 0.6 + Math.random(); ai.strafe = Math.random() < peekSkill(game, p) ? (Math.random() < 0.5 ? -1 : 1) : 0; }
    { const lu = linedUp(game, p, enemy); if (lu) { ai.strafe = lu; ai.strafeT = 0.5; } } // a teammate on the same line from the enemy: step off it // he asked: strafe-peeking in a fight is a hard skill, used now and then by a few, not by everyone all the time
    if (ai.leanE !== enemy.id) { ai.leanE = enemy.id; ai.leanF = Math.random() < know(game, p).lean ? leanSide(game, p, want) : 0; if (ai.leanF) feat(p, 'lean'); }
    if (ai.leanF && !ai.strafe) inp.lean = ai.leanF; // leaning out from the corner to take the fight
    if (ai.strafe) { const sa = p.aim + Math.PI / 2 * ai.strafe; setDir(inp, Math.cos(sa), Math.sin(sa)); inp.walk = 1; }
    if ((p.pro || lvlOf(game, p) >= 4) && p.hp < p.maxHp * 0.4 && enemy.hp > p.hp && !game.planted) { const ba = Math.atan2(p.y - enemy.y, p.x - enemy.x); setDir(inp, Math.cos(ba), Math.sin(ba)); inp.walk = 1; } // Platinum up: losing the fight, back out of it while shooting
    return;
  }
  ai.seen = null;
  if (gun && gun.ammo < WEAPONS[gun.w].mag * (!p.pro && lvlOf(game, p) <= 1 ? 0.85 : 0.3) && gun.reserve > 0) game.startReload(p); // Copper and Bronze reload half-full magazines the moment a fight ends
  if (p.slot !== 0 && p.guns[0] && p.guns[0].ammo + p.guns[0].reserve > 0) game.event(p, { k: 'slot', n: 0 }); // back to the main gun once it's quiet

  // --- an enemy drone in sight: turn and shoot it (one hit breaks it) ---
  const drone = p.downed ? null : enemyDrone(game, p);
  if (drone) {
    if (ai.droneSeen !== drone.id) { ai.droneSeen = drone.id; ai.droneReact = -S.drone - Math.random() * 0.4; }
    ai.droneReact += dt;
    const want = Math.atan2(drone.y - p.y, drone.x - p.x);
    turnTo(p, want, S.turn, dt);
    if (drone.type === 'drone' && abId === 'swarm' && p.abilityCount > 0 && Math.hypot(drone.x - p.x, drone.y - p.y) < SWARM.reach * PX_PER_M * 0.9) { // MAGPIE: take it over
      if (ai.droneReact > 0 && Math.abs(angDiff(want, p.aim)) < 0.4) { useAbility(); teamSay(game, p, `Swarm on the drone ${place(game, drone.x, drone.y) || 'here'}, don't shoot it`, 'mgG' + drone.id); }
      return;
    }
    inp.ads = 1; inp.crouch = 1;
    if (gun && gun.ammo === 0) game.startReload(p);
    else if (ai.droneReact > 0 && Math.abs(angDiff(want, p.aim)) < 0.08) shootInput(inp, ai, gun);
    return;
  }
  ai.droneSeen = null;
  if (p.downed) return;

  // --- map knowledge (KNOW): a sniper's glint pointing this way → step out of the line (better ranks call it out too) ---
  if (action) {
    const sn = game.time < (ai.glareNext || 0) ? null : glareOn(game, p);
    if (sn) { const gr = ai.glareRoll || (ai.glareRoll = {}); if ((gr[sn.id] ??= Math.random() < know(game, p).glare)) { ai.glareUntil = game.time + 1.1; ai.glareSide = Math.random() < 0.5 ? -1 : 1; ai.glareFrom = sn; ai.glareNext = game.time + 3; feat(p, 'glare'); if (know(game, p).glare >= 0.5) { game.spot(team, sn.id, 2); teamSay(game, p, `Sniper glint ${place(game, sn.x, sn.y)}`, 'gl' + sn.id); } } }
    if (ai.glareUntil > game.time && ai.glareFrom) { const a = Math.atan2(p.y - ai.glareFrom.y, p.x - ai.glareFrom.x) + Math.PI / 2 * ai.glareSide; setDir(inp, Math.cos(a), Math.sin(a)); return; }
  }
  // --- a camera, trap or gadget of theirs in sight (or a map camera it knows hangs close by): shoot it ---
  if (action && !(heardRecently && game.time - ai.heard.t < 1.5) && gun && gun.ammo > 0 && !p.reloadT) {
    const g = gadgetShot(game, p);
    if (g) {
      if (ai.gAt !== g.e.id) { ai.gAt = g.e.id; ai.gT = game.time; }
      if (game.time - ai.gT > 3) { (ai.gGive || (ai.gGive = {}))[g.e.id] = game.time + 20; ai.gAt = null; } // can't get it: leave it
      else {
        const a = Math.atan2(g.y - p.y, g.x - p.x), d = Math.hypot(g.x - p.x, g.y - p.y); turnTo(p, a, S.turn, dt); inp.ads = 1;
        p.aimX = p.x + Math.cos(p.aim) * d; p.aimY = p.y + Math.sin(p.aim) * d;
        if (Math.abs(angDiff(a, p.aim)) < Math.max(0.015, 3 / d)) { shootInput(inp, ai, gun); if (ai.gShot !== g.e.id) { ai.gShot = g.e.id; feat(p, g.e.type === 'cam' ? 'cams' : 'gadgets'); } }
        return;
      }
    }
  }

  // --- an enemy gadget in sight and an arc gun in hand: zap it ---
  if (abId === 'arc' && p.abilityCount > 0 && action) {
    const g = enemyGadget(game, p, 340);
    if (g) { const a = Math.atan2(g.y - p.y, g.x - p.x); turnTo(p, a, S.turn, dt); if (Math.abs(angDiff(a, p.aim)) < 0.05) useAbility(); return; }
  }

  // --- a teammate is down: heal them from range with a stim, or go and pick them up ---
  let mate = action || game.phase === PHASE.PREP ? downedMate(game, p, team) : null;
  // he asked: no endless revives. Give up on one that can't be started within a few seconds (out of reach, blocked), and a
  // pro doesn't walk into a revive with an enemy just seen or heard close by, unless the mate is about to bleed out alone
  if (mate) {
    const gu = ai.reviveGiveUp || (ai.reviveGiveUp = {});
    if (gu[mate.id] > game.time) mate = null;
    else if (p.pro && heardRecently && Math.hypot(ai.heard.x - mate.x, ai.heard.y - mate.y) < 260 && mate.hp > 8) mate = null;
    else {
      if (ai.reviveId !== mate.id) { ai.reviveId = mate.id; ai.reviveT = game.time; }
      const started = p.busy && p.busy.k === 'revive';
      if (started) ai.reviveT = game.time; // progressing: fine
      else if (game.time - ai.reviveT > 7) { gu[mate.id] = game.time + 20; ai.reviveId = null; mate = null; }
    }
  }
  if (mate) {
    const d = Math.hypot(mate.x - p.x, mate.y - p.y);
    if (abId === 'stim' && p.abilityCount > 0 && d < 380 && los(map, p.x, p.y, mate.x, mate.y)) {
      const a = Math.atan2(mate.y - p.y, mate.x - p.x); turnTo(p, a, S.turn, dt);
      if (Math.abs(angDiff(a, p.aim)) < 0.04) useAbility();
      return;
    }
    if (d < 20) { p.aim = Math.atan2(mate.y - p.y, mate.x - p.x); inp.interact = 1; inp.crouch = 1; return; }
    return moveTo(game, p, inp, mate, dt);
  }
  if (abId === 'stim' && p.abilityCount > 1 && p.hp < 45 && action) { useAbility(); return; } // patch yourself up (the dart lands on you when no teammate is in line)
  if (abId === 'stim' && p.abilityCount > 1 && action) { // a hurt teammate in sight (between fights): heal them from range, keeping one dart for a revive
    const hurt = [...game.players.values()].find(q => q !== p && q.alive && !q.downed && game.side(q) === team && q.hp < q.maxHp * 0.6
      && Math.hypot(q.x - p.x, q.y - p.y) < 380 && floorAt(map, q.x, q.y) === floorAt(map, p.x, p.y) && los(map, p.x, p.y, q.x, q.y));
    if (hurt) { const a = Math.atan2(hurt.y - p.y, hurt.x - p.x); turnTo(p, a, S.turn, dt); if (Math.abs(angDiff(a, p.aim)) < 0.04) useAbility(); return; }
  }

  // --- cameras (he asked): a defender looks through the team's cameras when it is safe, or for a quick look when
  // enemies are heard coming and nobody knows where; never with an enemy close by ---
  if (team === TEAM.DEF && action && !p.busy && (p.pro || lvlOf(game, p) >= 2)) {
    if (ai.camNext === undefined) ai.camNext = game.time + 6 + Math.random() * 14;
    const feeds = game.feeds(team).filter(f => f.type === 'cam' && !(f.offUntil > game.time));
    const hd = ai.heard ? Math.hypot(ai.heard.x - p.x, ai.heard.y - p.y) : Infinity, ago = ai.heard ? game.time - ai.heard.t : Infinity;
    const settled = !ai.path || !ai.path.length, known = game.spots[team].size > 0;
    const safe = ago > 8 || hd > 900, worth = ago < 6 && hd > 300 && hd < 900 && !known; // coming, but from where?
    if (feeds.length && settled && game.time > ai.camNext && !(hd < 300 && ago < 6) && (safe || worth)) {
      ai.camUntil = game.time + (worth ? 2.5 : 3.5 + Math.random() * 3); ai.camFlip = game.time + 1.2; ai.camHp = p.hp;
      ai.camNext = game.time + (p.pro && p.pro.pl.jobs.def === 'intel' ? 10 : 18) + Math.random() * 16;
      feat(p, 'feeds'); game.watch(p, feeds[Math.floor(Math.random() * feeds.length)]); return;
    }
  }

  // --- impatience (he asked: bots stood around too much; people get impatient and take a risk for a better position
  // or the surprise) ---
  if (action && !game.planted && !p.pro) impatience(game, p, team, site, me);

  // --- a pro's part of the team plan ---
  if (ai.cmd && botCmd(game, p, inp, dt)) return; // a person on the team asked for something
  if (team === TEAM.DEF && !game.planted && prepWork(game, p, inp, dt, heardRecently)) return; // preparation: boards, walls, traps, rotation holes
  if (action && !p.downed && rankHabits(game, p, inp, dt, team, site, gun)) return; // by rank: wandering off alone, trading a teammate, shooting through walls
  if (p.pro && (action || game.phase === PHASE.PREP) && proAct(game, p, inp, dt, team)) return;

  // --- objective ---
  let goal = null, act = null;
  const atk = team === TEAM.ATK;
  if (atk) {
    const item = game.ents.find(e => e.type === 'defuser');
    if (game.planted) goal = ai.guard || (ai.guard = game.freeSpotNear(game.planted.x, game.planted.y, 70));
    else if (p.hasDefuser) {
      // plant at whichever spot is reached first (watching pro rounds: carriers stood on one spot walking to the other)
      const nb = site.bombs.reduce((a, c) => Math.hypot(c.x - p.x, c.y - p.y) < Math.hypot(a.x - p.x, a.y - p.y) ? c : a);
      if (Math.hypot(nb.x - p.x, nb.y - p.y) < 90) ai.bomb = nb;
      const b = ai.bomb || (ai.bomb = site.bombs[Math.floor(Math.random() * 2)]);
      goal = b; const bd = Math.hypot(b.x - p.x, b.y - p.y);
      if (bd < 24) act = 'plant';
      // smoke the plant: a smoke barrage or smoke grenade toward where the enemy was last heard (or into the room)
      if (bd < 70 && !ai.smoked) {
        ai.smoked = true;
        const t = heardRecently ? ai.heard : { x: b.x + (b.x - p.x) * 3, y: b.y + (b.y - p.y) * 3 };
        if (abId === 'barrage' && p.abilityCount > 0) { aimAt(p, t.x, t.y); useAbility(); }
        else if (p.gadget === 'smoke' && p.gadgetCount > 0) { aimAt(p, t.x, t.y); game.event(p, { k: 'gadget' }); }
      }
    } else if (item) goal = item;
    else goal = ai.push || (ai.push = nearBomb(game, site, 60));
  } else {
    if (game.planted) { goal = game.planted; if (Math.hypot(goal.x - p.x, goal.y - p.y) < 24) act = 'defuse'; }
    else if (game.phase === PHASE.PREP && ai.stairWatch && ai.role !== 'space') { goal = ai.stairWatch; ai.watchingStairs = true; } // waits for drones there
    else {
      // he asked: defenders wander a little: every so often, while nothing is heard, a new spot round the site
      if (!heardRecently && game.time > (ai.holdT || 0)) { // (map knowledge: an off-angle on a way in, else somewhere round the bomb)
        const kh = Math.random() < know(game, p).angles ? knownHold(game, p) : null;
        ai.hold = kh ? kh.at : nearBomb(game, site, ai.role === 'anchor' ? 60 : 100); ai.watch = kh ? kh.watch : null; ai.holdT = game.time + 10 + Math.random() * 18; if (kh) feat(p, 'offAngle'); }
      goal = ai.hold || (ai.hold = nearBomb(game, site, 70));
    }
  }
  if (act) { if (!ai.actSaid) { ai.actSaid = true; talk(game, p, act === 'plant' ? 'plant' : 'defuse', {}, act); } inp.interact = 1; inp.crouch = 1; return; }
  if (!goal) return;
  const toGoal = Math.hypot(goal.x - p.x, goal.y - p.y);

  // --- defensive gas: throw it at a noise near the site, set it off when someone walks in ---
  if (!atk && abId === 'gas' && action) {
    if (p.gasId) { const g = game.ent(p.gasId); if (g && [...game.players.values()].some(q => q.alive && game.side(q) !== team && Math.hypot(q.x - g.x, q.y - g.y) < 70)) useAbility(); }
    else if (p.abilityCount > 0 && heardRecently && Math.hypot(ai.heard.x - p.x, ai.heard.y - p.y) < 280 && los(map, p.x, p.y, ai.heard.x, ai.heard.y)) { aimAt(p, ai.heard.x, ai.heard.y); useAbility(); }
  }

  // a defender's remote charge works the same way: thrown at a noise, set off when someone is beside it
  if (!atk && p.gadget === 'nitro' && action) {
    if (p.nitroId) { const g = game.ent(p.nitroId); if (g && [...game.players.values()].some(q => q.alive && game.side(q) !== team && Math.hypot(q.x - g.x, q.y - g.y) < 45)) game.event(p, { k: 'gadget' }); }
    else if (p.gadgetCount > 0 && heardRecently && Math.hypot(ai.heard.x - p.x, ai.heard.y - p.y) < 240 && Math.hypot(ai.heard.x - p.x, ai.heard.y - p.y) > 90 && los(map, p.x, p.y, ai.heard.x, ai.heard.y)) { aimAt(p, ai.heard.x, ai.heard.y); game.event(p, { k: 'gadget' }); }
  }

  // he asked: paranoia. Alone (no teammate within 8 m) after hearing something, a bot keeps sweeping every way in
  // round it, not just the one the noise came from, until it has been quiet for a few seconds
  const alone = ![...game.players.values()].some(q => q !== p && q.alive && !q.downed && game.side(q) === team && Math.hypot(q.x - p.x, q.y - p.y) < 8 * PX_PER_M);
  const paranoid = alone && heardRecently && game.time - ai.heard.t > 0.7;
  // heard something and can't see it: stop, turn to face it and listen for a moment (pushy bots don't stop as long)
  if (heardRecently && game.time - ai.heard.t < 1.6 - me.aggr * 0.6 && !p.hasDefuser && !(team === TEAM.DEF && game.planted)) {
    const hp = angleOn(game, p, ai.heard); // the corner it would come round, not the wall in front of it
    turnTo(p, Math.atan2(hp.y - p.y, hp.x - p.x), skill(game, p).turn * 0.6, dt);
    inp.crouch = atk ? 0 : 1;
    const hd = Math.hypot(ai.heard.x - p.x, ai.heard.y - p.y);
    // a smoke barrage between us and a noise close by
    if (atk && action && abId === 'barrage' && p.abilityCount > 0 && hd > 90 && hd < 300 && Math.random() < dt * 0.5) { aimAt(p, ai.heard.x, ai.heard.y); useAbility(); }
    // a grenade at a noise close by, now and then
    if (atk && action && ['frag', 'stun'].includes(p.gadget) && p.gadgetCount > 0 && hd > 60 && hd < 260 && !ai.nadeT && Math.random() < dt * 0.6) {
      ai.nadeT = 1; aimAt(p, ai.heard.x, ai.heard.y); game.event(p, { k: 'gadget' });
    }
    return;
  }

  if (atk && !game.planted) {
    // the first seconds of the action: watching drones, longer for patient bots and intel players
    if (ai.startWait === undefined) {
      const base = { entry: [1, 3], support: [4, 4], flank: [3, 4], intel: [7, 5] }[ai.role] || [2, 6];
      ai.startWait = base[0] + Math.random() * base[1] * (0.5 + me.patience);
    }
    if (game.timer < DUR.action - 60) ai.startWait = 0; // the clock: no more waiting after a minute
    if ((ai.startWait -= dt) > 0) { checkAngles(game, p, dt); return; }
    // abilities on the way in
    if (action && p.abilityCount > 0) {
      if (abId === 'ghost' && toGoal < 450 && !(game.time < (p.ghostUntil || 0))) useAbility();
      if ((abId === 'sonar' || abId === 'emp') && toGoal < 330 && toGoal > 80 && Math.random() < dt * 0.5) { aimAt(p, goal.x, goal.y); if (castSight(map, p.x, p.y, p.aim, 200, null) > 90) useAbility(); }
      if (abId === 'dart' && toGoal < 400 && Math.random() < dt * 0.3) { aimAt(p, goal.x, goal.y); useAbility(); }
      if (abId === 'decoy' && toGoal < 260 && Math.random() < dt * 0.4) { aimAt(p, goal.x, goal.y); useAbility(); }
    }
    // a breaching tool: open a site wall first (a hard breacher a reinforced one), then go in through it
    if (action && ai.breach === undefined) { const tool = breachTool(p); ai.breach = tool && ai.role !== 'intel' ? planBreach(game, p, tool) : null; if (ai.breach) ai.breach.tool = tool; }
    if (ai.breach) { const r = doBreach(game, p, inp, ai.breach, dt); if (r !== 'done') return; ai.breach = null; }
    // a flanker goes round to the far side of the site first
    if (ai.role === 'flank' && !ai.flanked) {
      ai.flank = ai.flank || flankPoint(game, p, site);
      if (!ai.flank || Math.hypot(ai.flank.x - p.x, ai.flank.y - p.y) < 30) ai.flanked = true;
      else return moveTo(game, p, inp, ai.flank, dt);
    }
    // support stays a few steps behind the nearest teammate until they're near the site
    if (ai.role === 'support' && !ai.supportDone) {
      const lead = [...game.players.values()].filter(q => q !== p && q.alive && !q.downed && game.side(q) === team).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      if (!lead || Math.hypot(lead.x - goal.x, lead.y - goal.y) < 300 || toGoal < 300) ai.supportDone = true;
      else if (Math.hypot(lead.x - p.x, lead.y - p.y) > 70) return moveTo(game, p, inp, lead, dt);
      else { turnTo(p, lead.aim, 2, dt); return; }
    }
    // close to the objective: walk (quiet), and now and then stop to check the angles
    if (!loud(game, p) && toGoal < (ai.role === 'entry' ? 220 : 360) - me.aggr * 80 && game.timer > 45) { // close: walk quietly and check angles, unless the clock says run (Copper and Bronze often just run in)
      inp.walk = 1;
      ai.pauseT = (ai.pauseT ?? 2 + Math.random() * 3) - dt;
      if (ai.pauseT < 0 && game.timer > 75) { if (ai.pauseT < -(0.4 + me.patience)) ai.pauseT = 2 + Math.random() * 4; checkAngles(game, p, dt, 1); return; }
    }
    // an entry fragger throws a stun into the site just before going in
    if (action && ai.role === 'entry' && p.gadget === 'stun' && p.gadgetCount > 0 && toGoal < 200 && !ai.stunned && los(map, p.x, p.y, goal.x, goal.y)) { ai.stunned = true; aimAt(p, goal.x, goal.y); game.event(p, { k: 'gadget' }); }
  }

  // map knowledge: through a chosen way in (pickWay): to the spot beside it, then in, then on to the objective
  if (atk && action && !game.planted && !p.hasDefuser && !p.pro && !ai.wayDone) {
    if (ai.way === undefined) ai.way = pickWay(game, p);
    const w = ai.way, tgt = w && (ai.wayIn ? w.inside : w.stack);
    if (!w || (ai.wayT = (ai.wayT || 0) + dt) > 30) ai.wayDone = true;
    else if (Math.hypot(tgt.x - p.x, tgt.y - p.y) < 28) { if (ai.wayIn) ai.wayDone = true; else ai.wayIn = true; }
    else return moveTo(game, p, inp, tgt, dt);
  }
  // he asked: defenders take space when they can do it without leaving the site open. The 'space' defender holds a room
  // beside the site on the attackers' side (two anchors stay on it) until the clock runs down or the team is losing people.
  // he asked: fewer on the site, the rooms leading to it held, and rotations. The 'space' defenders each hold one of the
  // rooms beside the site (shared out between them) and rotate in through the open doors and holes when the attack
  // commits there (an enemy spotted on the site or a teammate killed on it), the team is losing people, or the clock runs down.
  const hot = !atk && !game.planted && (ai.role === 'space' || ai.role === 'roamer') ? siteHot(game, team) : null;
  if (hot && !ai.rotated && action) { ai.rotated = true; ai.hold = game.freeSpotNear(hot.x + (p.x - hot.x) * 0.4, hot.y + (p.y - hot.y) * 0.4, 40); ai.holdT = game.time + 15; teamSay(game, p, `Rotating to ${place(game, hot.x, hot.y)}`, 'rot' + p.squad); }
  if (!atk && ai.role === 'space' && !game.planted && !ai.rotated) {
    const mates = [...game.players.values()].filter(q => q.squad === p.squad), lost = mates.filter(q => !q.alive || q.downed).length;
    if (game.timer > 40 && lost < 3 || !action) {
      if (!ai.spaceAt) { const ds = defSetup(game), sp = mates.filter(q => q.bot && q.ai && q.ai.role === 'space'), r = ds.held[Math.max(0, sp.indexOf(p)) % Math.max(1, ds.held.length)] || intelOf(game).roam;
        ai.spaceAt = r ? game.freeSpotNear((r.x + r.w / 2) * CELL, (r.y + r.h / 2) * CELL, Math.min(r.w, r.h) * CELL * 0.3) : null; }
      if (ai.spaceAt) { const r = moveTo(game, p, inp, ai.spaceAt, dt, true); if (paranoid) checkAngles(game, p, dt, 1.5); return r; }
    }
  }
  // a roaming defender spends the first part of the round in rooms around the site, then falls back to it
  if (!atk && ai.role === 'roamer' && action && !game.planted && !ai.rotated) {
    ai.roamFor = ai.roamFor ?? 50 + me.aggr * 70;
    ai.roamFor -= dt;
    if (ai.roamFor > 0 && game.timer > 60) { // the clock: back to the site
      ai.roamT = (ai.roamT || 0) - dt;
      if (!ai.roam || ai.roamT <= 0) { ai.roam = roamSpot(game, p); ai.roamT = 14 + Math.random() * 14; ai.watch = null; }
      if (ai.roam) {
        const r = moveTo(game, p, inp, ai.roam, dt, true);
        if (paranoid) checkAngles(game, p, dt, 1.5);
        // no way there (it walked into a wall and stood there all round): another spot, and after a few, back to the site
        if (ai.path && !ai.path.length && Math.hypot(ai.roam.x - p.x, ai.roam.y - p.y) > 2 * CELL && (ai.roamFail = (ai.roamFail || 0) + dt) > 1.5) { ai.roamFail = 0; ai.roamT = 0; if ((ai.roamBad = (ai.roamBad || 0) + 1) > 4) ai.roamFor = 0; }
        return r;
      }
    }
  }

  const r = moveTo(game, p, inp, goal, dt, !atk);
  if (paranoid) checkAngles(game, p, dt, 1.5); // alone and something heard: every angle, not just the noise
  return r;
}

// On the cameras: flick through the feeds, spot what they see for the team, and get back to the body after a few
// seconds, or at once when something is heard close by or the body is hit.
// Abilities the bots never used before (watching pro matches showed ten operators whose skill never came out): each
// one at the moment a player would reach for it. Rate-limited by ai.abT so nobody empties their charges in a second.
// GIMLET: where to drill this round: from the floor above the objective down into it, or from below up into it
// (whichever floor he is on), a few metres from a defuser spot. { x, y (stand), ax, ay (aim), down } or null.
function drillSpot(game, p, bomb) {
  const m = game.map, W = m.W, bk = Math.floor(bomb.y / CELL) * W + Math.floor(bomb.x / CELL), myF = floorAt(m, p.x, p.y), bf = floorAt(m, bomb.x, bomb.y);
  const out = [];
  for (let dy = -6; dy <= 6; dy += 2) for (let dx = -6; dx <= 6; dx += 2) {
    if (Math.hypot(dx, dy) < 2.5) continue;
    const site = bk + dy * W + dx, down = myF >= bf; // above or level: drill down from upstairs; below: drill up
    const peep = down ? cellAbove(m, site) : site, stand = down ? peep : cellBelow(m, site);
    if (peep < 0 || stand < 0 || !peepOk(m, peep)) continue;
    const cx = (stand % W + 0.5) * CELL, cy = (Math.floor(stand / W) + 0.5) * CELL;
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { const x = cx - Math.cos(a) * 10, y = cy - Math.sin(a) * 10, k = Math.floor(y / CELL) * W + Math.floor(x / CELL);
      if (m.tiles[k] === T.FLOOR && !circleBlocked(m, x, y, PLAYER_R, t => blocksMove(t) || t === T.HOLE)) { out.push({ x, y, ax: cx, ay: cy, down }); break; } }
  }
  return out.length ? out[Math.floor(Math.random() * out.length)] : null;
}
function botAbility(game, p, ai, abId, enemy, heard, team, site, useAbility, inp, dt) {
  const ok = () => p.abilityCount > 0 && game.time > (ai.abT || 0), done = (wait = 4) => { ai.abT = game.time + wait; };
  const d = enemy ? Math.hypot(enemy.x - p.x, enemy.y - p.y) : Infinity, bomb = site.bombs[0];
  const toBomb = Math.min(...site.bombs.map(b => Math.hypot(b.x - p.x, b.y - p.y)));
  // the snipers (2026-11-10): PERCH sets the bipod whenever crouched or lying still, MOSS wraps up on contact,
  // OSPREY spots when there is something to look for, NAIL loads a piercing round for the next shot at someone seen or heard
  // up and down (2026-11-10): GIMLET drills over or under the objective, HOIST climbs through an open hatch toward a
  // site upstairs, LOCKJAW rigs a hatch in preparation, DEADFALL drops a charge over attackers heard right below
  const lp = localPos(game.map, p.x, p.y), lb = localPos(game.map, bomb.x, bomb.y), flat = Math.hypot(lp.x - lb.x, lp.y - lb.y);
  if (abId === 'drill') { // GIMLET (the audit: he almost never drilled): once a round, early on, to a spot over or under the objective, then drill
    if (ai.drillRound !== game.round) { ai.drillRound = game.round; ai.drillGoal = Math.random() < 0.8 ? drillSpot(game, p, bomb) : null; ai.drillT = game.time; }
    const gl = ai.drillGoal;
    if (!gl || enemy || !ok() || game.time - ai.drillT > 35 || elapsedAction(game) > 80) return;
    if (Math.hypot(gl.x - p.x, gl.y - p.y) > 8) { moveTo(game, p, inp, gl, dt); return true; }
    aimAt(p, gl.ax, gl.ay); inp.crouch = gl.down ? 1 : 0;
    if (!!(p.input && p.input.crouch) === gl.down) { useAbility(); done(6); ai.drillGoal = null; teamSay(game, p, gl.down ? 'Peephole over the objective.' : 'Peephole under the objective.', 'drill'); }
    return true;
  }
  if (abId === 'grapple') { if (!enemy && ok() && lb.f > lp.f && !p.grapple && game.grappleTarget(p) && Math.random() < dt * 2) { useAbility(); done(5); } return; }
  if (abId === 'htrap') { if (ok() && game.phase === PHASE.PREP && game.hatchToRig(p)) { useAbility(); done(3); } return; }
  if (abId === 'dropcharge') {
    if (ok() && heard && game.phase === PHASE.ACTION) { const h = localPos(game.map, ai.heard.x, ai.heard.y); if (h.f === lp.f - 1 && Math.hypot(h.x - lp.x, h.y - lp.y) < 3 * PX_PER_M && game.floorCharge(p)) { useAbility(); done(8); } }
    return;
  }
  if (abId === 'bipod') { // PERCH: holding an angle (still for a moment), crouch and set it; wanting to move again, lift it (the audit: he never set it)
    const pi = p.input || {}, moving = !!(pi.up || pi.down || pi.left || pi.right);
    ai.stillT = moving ? 0 : (ai.stillT || 0) + dt; ai.goT = moving ? (ai.goT || 0) + dt : 0;
    if (p.bipodSet) { if (ai.goT > (enemy ? 0.6 : 0.25)) { useAbility(); done(6); } else inp.crouch = 1; return; }
    if (ai.stillT > 2.5 && game.time > (ai.abT || 0)) { /* only a real hold: the audit saw it flipped up and down ~10 times a round */ inp.crouch = 1; if (pi.crouch || p.pr >= 1) { useAbility(); done(3); } }
    return; }
  if (abId === 'ghillie') { if ((enemy || heard) && ok() && !(p.ghillieUntil > game.time)) { useAbility(); done(14); } return; }
  if (abId === 'spotter') { if ((enemy || heard) && ok() && !(p.spotterUntil > game.time) && Math.random() < dt * 1.5) { useAbility(); done(10); } return; }
  if (abId === 'pierce') { if ((enemy || heard) && ok() && !p.pierceShot && Math.random() < dt) { useAbility(); done(5); } return; }
  if (abId === 'dash' || abId === 'pick') { // RUSH bursts through a board in the way, WREN takes it apart quietly
    const f = game.facingCell(p, abId === 'dash' ? 40 : 28);
    if (f && f.t === T.BARRI && !enemy && ok()) { useAbility(); done(3); }
    else if (abId === 'dash' && enemy && d < 90 && ok() && Math.random() < dt * 2) { useAbility(); done(5); } // close the gap
  } else if (abId === 'hammer') { // FERRO: one swing through a board, brace or shield in the way, or at someone in reach
    const f = game.facingCell(p, 28);
    if (f && [T.BARRI, T.BEAM, T.DSHIELD].includes(f.t) && !enemy && p.meleeCd <= 0) game.event(p, { k: 'ability' });
    else if (enemy && d < 28 && p.meleeCd <= 0) { aimAt(p, enemy.x, enemy.y); game.event(p, { k: 'ability' }); }
  } else if (abId === 'flare') { // BLAZE: into the room the defenders are heard in, before going in
    if (!enemy && heard && ok()) { const h = ai.heard, hd = Math.hypot(h.x - p.x, h.y - p.y);
      if (hd > 90 && hd < 300 && floorAt(game.map, h.x, h.y) === floorAt(game.map, p.x, p.y) && Math.random() < dt * 0.8) { aimAt(p, h.x, h.y); useAbility(); done(8); } }
  } else if (abId === 'medkit') { // PATCH: onto a hurt teammate in sight, or at their own feet
    if (!enemy && ok()) {
      const hurt = [...game.players.values()].find(q => q.alive && !q.downed && game.side(q) === team && q.hp < q.maxHp * 0.6 && Math.hypot(q.x - p.x, q.y - p.y) < 150 && los(game.map, p.x, p.y, q.x, q.y));
      if (hurt) { aimAt(p, hurt.x, hurt.y); useAbility(); done(6); }
    }
  } else if (abId === 'spike') { // ECHO: by the objective, to hear defenders moving round it
    if (!enemy && toBomb < 260 && ok() && Math.random() < dt * 0.5) { useAbility(); done(15); }
  } else if (abId === 'cover') { // TRENCH: cover between them and someone shooting from far, and for the plant
    if (enemy && d > 140 && ok() && Math.random() < dt * 0.8) { aimAt(p, enemy.x, enemy.y); useAbility(); done(8); }
    else if (!enemy && ok() && toBomb < 90 && (p.hasDefuser || game.planted || [...game.players.values()].some(q => q.busy && q.busy.k === 'plant' && game.side(q) === team))) {
      const from = (heard && ai.heard) || [...game.players.values()].filter(q => q.alive && game.side(q) !== team && game.spots[team].has(q.id))[0];
      const ang = from ? Math.atan2(from.y - p.y, from.x - p.x) : Math.atan2(p.y - bomb.y, p.x - bomb.x); // toward the threat, else away from the bomb
      p.aim = ang; useAbility(); done(12);
    }
  } else if (abId === 'tag') { // HOUND: dart the attacker in sight so the whole team sees them
    if (enemy && d < 400 && ok() && ai.react > 0) { aimAt(p, enemy.x, enemy.y); useAbility(); done(6); }
  } else if (abId === 'echobox') { // RUSE: fake footsteps out by a way into the site, early in the round
    const el = DUR.action - game.timer;
    if (!enemy && el > 8 && el < 90 && ok() && Math.random() < dt * 0.08) {
      const m = game.map, cl = m.openings.filter(q => { const c = q.cells[0], d = Math.hypot((c % m.W + 0.5) * CELL - p.x, (Math.floor(c / m.W) + 0.5) * CELL - p.y); return d > 60 && d < 260 && los(m, p.x, p.y, (c % m.W + 0.5) * CELL, (Math.floor(c / m.W) + 0.5) * CELL); });
      const o = cl[Math.floor(Math.random() * cl.length)], k = o && o.cells[0];
      if (o) { aimAt(p, (k % m.W + 0.5) * CELL, (Math.floor(k / m.W) + 0.5) * CELL); useAbility(); done(20); }
    }
  } else if (abId === 'periscope') { // LENS: a periscope into the room above or below while holding
    const el = DUR.action - game.timer, siteF = floorAt(game.map, bomb.x, bomb.y), myF = floorAt(game.map, p.x, p.y);
    if (!game.periscopeSpot(p)) {} // no floor above or below here
    else if (!enemy && ok() && el > 5 && el < 40 && Math.abs(siteF - myF) === 1 && Math.random() < dt * 0.5) { p.periDir = siteF > myF ? 'up' : 'down'; useAbility(); done(25); } // early: eyes on the site's floor
    else if (!enemy && ok() && (heard || Math.random() < dt * 0.06)) { useAbility(); done(20); }
  } else if (abId === 'weld' && !ai.cmd) { // SOLDER: weld a broken wall back when one is close and nobody is shooting (an order from a person comes first)
    if (!enemy && p.battery > 0.5 && game.baseTiles) {
      const m = game.map, cx = Math.floor(p.x / CELL), cy = Math.floor(p.y / CELL);
      for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 2; x <= cx + 2; x++) {
        const k = y * m.W + x; if (x < 0 || y < 0 || x >= m.W || y >= m.H) continue;
        const t = m.tiles[k];
        if (game.baseTiles[k] === T.SOFT && t !== T.SOFT && t !== T.REINF && !game.cellOccupied(k)) { aimAt(p, (x + 0.5) * CELL, (y + 0.5) * CELL); inp.ability = 1; return true; }
      }
    }
  }
}

function botCams(game, p, dt) {
  const ai = p.ai, team = game.side(p), c = game.feed(p), list = game.feeds(team).filter(f => f.type === 'cam' && !(f.offUntil > game.time));
  const close = (game.noises || []).some(n => n.team !== team && game.time - n.t < 0.5 && Math.hypot(n.x - p.x, n.y - p.y) < 260);
  if (!c || close || p.downed || p.hp < (ai.camHp ?? p.hp) || game.time > (ai.camUntil || 0) || game.phase !== PHASE.ACTION || game.planted) { p.ctrl = 'body'; return; }
  if (game.time > ai.camFlip && list.length > 1) { ai.camFlip = game.time + 1.2 + Math.random(); game.watch(p, list[(list.indexOf(c) + 1) % list.length]); return; }
  p.aim = c.ang || 0;
  const smokes = game.smokeList();
  for (const q of game.players.values()) {
    if (!q.alive || game.side(q) === team || q.shrouded) continue;
    if (c.oc !== undefined) { // an outside camera: the ground below (climbers show there too) and the roof just above
      const m = game.map, qf = floorAt(m, q.x, q.y), gh = qf === m.groundFloor ? q : wallGhost(m, q.x, q.y), at = gh && (qf === m.groundFloor || gh.rope) ? gh : null;
      const onRoof = qf === m.roofFloor && Math.hypot(q.x - c.x, q.y - c.y) < OUTCAM_ROOF && los(m, c.x, c.y, q.x, q.y, smokes);
      const below = at && Math.hypot(at.x - c.gx, at.y - c.gy) < 420 && Math.abs(angDiff(Math.atan2(at.y - c.gy, at.x - c.gx), c.ang || 0)) < 0.85 && los(m, c.gx, c.gy, at.x, at.y, smokes);
      if (!onRoof && !below) continue;
    } else {
      if (Math.hypot(q.x - c.x, q.y - c.y) > 420 || floorAt(game.map, q.x, q.y) !== floorAt(game.map, c.x, c.y)) continue;
      if (Math.abs(angDiff(Math.atan2(q.y - c.y, q.x - c.x), c.ang || 0)) > 0.85 || !los(game.map, c.x, c.y, q.x, q.y, smokes)) continue;
    }
    game.spot(team, q.id, 3);
    if (!(ai.camSaid || (ai.camSaid = new Set())).has(q.id + ':' + game.round)) { ai.camSaid.add(q.id + ':' + game.round);
      talk(game, p, 'cam', { op: opName(q), place: place(game, q.x, q.y) }, 'see' + q.id);
      if (!p.pro && ([...game.players.values()].some(o => !o.bot && o.squad === p.squad) || game.tv) && game.markOk(p)) game.mark(p, q.x, q.y, 'ENEMY ' + OPERATORS[q.op].name, q.id); }
  }
}
// ---- The roof (he asked: when the objective is on the floor under the roof, bots go up there: another way in, and a
// hatch to throw utility through) ----
// Once a round per attacking team: is there a roof hatch over (or close to) the site, on the floor right under it?
// Then one attacker (two from Diamond up, more often the higher the rank; pros: the flank / intel / support player,
// usually) climbs a rope to the roof, opens the hatch, throws a grenade down, lies by it watching below (shooting
// whoever shows in it) and drops in when the team pushes. A reinforced hatch or the clock: back down the rope.
const ROOF_CHANCE = [0.15, 0.25, 0.35, 0.45, 0.55, 0.6, 0.65, 0.7]; // by rank (lvlOf), the last for pros
const ROOF_JOBS = ['flank', 'intel', 'support'];
function roofPick(game, p) {
  const m = game.map, R = game._roof && game._roof.round === game.round ? game._roof : (game._roof = { round: game.round, sq: {} });
  if (R.sq[p.squad] === undefined) {
    let plan = null;
    const site = m.sites[game.site], bf = floorAt(m, site.bombs[0].x, site.bombs[0].y);
    if (m.roofFloor !== undefined && bf === m.roofFloor - 1 || (m.hatches || []).some(h => h.roof && floorAt(m, h.bx, h.by) === bf)) {
      let best = null, bd = 14 * PX_PER_M;
      for (const h of m.hatches || []) {
        if (!h.roof || floorAt(m, h.bx, h.by) !== bf || m.tiles[h.cells[0]] === T.HATCHR) continue;
        const d = Math.min(...site.bombs.map(b => Math.hypot(b.x - h.bx, b.y - h.by)));
        if (d < bd) { bd = d; best = h; }
      }
      const top = r => { while (r.up >= 0) r = m.ropes[r.up]; return r.roof ? r : null; };
      const rope = best && m.ropes.filter(r => r.down < 0 && top(r)).sort((a, b) => Math.hypot(top(a).roof.x - best.x, top(a).roof.y - best.y) - Math.hypot(top(b).roof.x - best.x, top(b).roof.y - best.y))[0];
      const team = [...game.players.values()].filter(q => q.bot && q.alive && q.squad === p.squad);
      const lvl = team.some(q => q.pro) ? 7 : lvlOf(game, p);
      const hoist = team.some(q => q.op === 'hoist' && q.abilityCount > 0); // HOIST (2026-11-10): the grapple makes the roof a real option
      if (rope && team.length >= 2 && Math.random() < (hoist ? Math.max(0.75, ROOF_CHANCE[lvl]) : ROOF_CHANCE[lvl])) {
        const pref = q => q.op === 'hoist' && q.abilityCount > 0 ? -1 : (q.pro ? ROOF_JOBS.includes(q.pro.pl.jobs.atk) : ['flank', 'intel'].includes(q.ai && q.ai.role)) ? 0 : 1;
        const ids = team.filter(q => !q.hasDefuser).sort((a, b) => pref(a) - pref(b) || Math.random() - 0.5).slice(0, lvl >= 5 && team.length >= 4 ? 2 : 1).map(q => q.id);
        plan = { h: best, rope, top: top(rope), ids, dropAt: 40 + Math.random() * 25 };
      }
    }
    R.sq[p.squad] = plan;
  }
  const plan = R.sq[p.squad];
  return plan && plan.ids.includes(p.id) ? plan : null;
}
// Rappelling to a window (he asked 2026-11-13: bots test the new rope play): once a round an attacking team may send one
// player (two from Diamond up) up a rope to a window of a site room on an upper floor. They hang beside the window, not
// in front of it, peek the tight angle now and then (sometimes upside down), shoot whoever they see through it, and when
// the team goes (or after a while) they smash in through the window. game.windowChance forces the odds (tests).
const WIN_CHANCE = [0.05, 0.08, 0.12, 0.16, 0.2, 0.24, 0.28, 0.3];
function windowPick(game, p) {
  const m = game.map, R = game._winP && game._winP.round === game.round ? game._winP : (game._winP = { round: game.round, sq: {} });
  if (R.sq[p.squad] === undefined) {
    let plan = null;
    const site = m.sites[game.site], inSite = (x, y) => { const rn = roomAt(m, x, y); return rn && site.rooms.includes(rn); };
    const cands = (m.ropes || []).filter(r => r.cells.length && r.inside && inSite(r.inside.x, r.inside.y));
    const team = [...game.players.values()].filter(q => q.bot && q.alive && q.squad === p.squad && !q.hasDefuser);
    const lvl = team.some(q => q.pro) ? 7 : lvlOf(game, p), odds = game.windowChance ?? WIN_CHANCE[lvl];
    if (cands.length && team.length >= 2 && Math.random() < odds) {
      const rope = cands[Math.floor(Math.random() * cands.length)];
      const ids = team.sort(() => Math.random() - 0.5).slice(0, lvl >= 5 && team.length >= 4 ? 2 : 1).map(q => q.id);
      plan = { rope, ids, goAt: 35 + Math.random() * 30 };
      game.winLog && game.winLog.push({ e: 'plan', rope: rope.i, ids });
    }
    R.sq[p.squad] = plan;
  }
  const plan = R.sq[p.squad];
  return plan && plan.ids.includes(p.id) ? plan : null;
}
function windowPlay(game, p, inp, dt) {
  const ai = p.ai, m = game.map, plan = windowPick(game, p); if (!plan) return false;
  const st = ai.winSt && ai.winSt.round === game.round ? ai.winSt : (ai.winSt = { round: game.round, s: 'go', t: game.time, side: Math.random() < 0.5 ? -1 : 1 });
  if (st.s === 'done') return false;
  const prev = p.prevInput || {}, press = k => { inp[k] = prev[k] ? 0 : 1; }, log = e => game.winLog && game.winLog.push({ ...e, id: p.id, t: Math.round(game.time) });
  const late = game.planted || game.timer < 25 || game.time - st.t > 75;
  if (!p.rope) {
    if (st.s !== 'go') { st.s = 'done'; log({ e: p.alive ? 'off' : 'dead', fl: floorAt(m, p.x, p.y) }); return false; } // in through the window, let go, or shot off
    if (late || p.hasDefuser || game.time - st.t > 45) { st.s = 'done'; log({ e: 'gaveUp', why: late ? 'late' : p.hasDefuser ? 'defuser' : 'far', d: Math.round(Math.hypot(plan.rope.base.x - p.x, plan.rope.base.y - p.y)) }); return false; }
    const b = plan.rope.base; if (Math.hypot(b.x - p.x, b.y - p.y) > 9) { moveTo(game, p, inp, b, dt); return true; }
    press('interact'); st.climbT = st.climbT || game.time; return true;
  }
  if (p.rope.st !== 'hang') return true; // climbing
  if (st.s === 'go') { st.s = 'hang'; st.hangT = game.time; log({ e: 'hang', r: p.rope.r }); if (Math.random() < 0.35) { inp.inv = 1; st.inv = true; } }
  const r = m.ropes[p.rope.r], s = ropeS(r, p.x, p.y), win = r.cells.length > 0;
  // fight: whoever is in sight through the window
  const S = skill(game, p), e = visibleEnemy(game, p, S.see);
  if (e) {
    // the same reaction and hands as every bot (not a perfect aim): an error that settles, somewhere across the body
    if (ai.wSeen !== e.id) { ai.wSeen = e.id; ai.wReact = -S.react - Math.random() * S.reactX; ai.wErr = (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.4) * S.err; ai.wOs = (Math.random() - 0.5) * 2 * (Math.random() < S.head ? 1 : 4); log({ e: 'see', who: e.id }); }
    ai.wReact += dt; ai.wErr *= Math.exp(-dt * S.settle); ai.wErr += (Math.random() - 0.5) * dt * 0.6 * (S.shake ?? 1);
    const dd = Math.max(1, Math.hypot(e.x - p.x, e.y - p.y)), os = ai.wOs / dd, want = Math.atan2(e.y + (e.x - p.x) * os - p.y, e.x - (e.y - p.y) * os - p.x) + ai.wErr; turnTo(p, want, S.turn, dt);
    p.aimX = p.x + Math.cos(p.aim) * dd; p.aimY = p.y + Math.sin(p.aim) * dd;
    const gun = p.guns[p.slot]; if (gun && gun.ammo === 0) game.startReload(p);
    else if (ai.wReact > 0 && Math.abs(angDiff(want, p.aim)) < S.tol) { shootInput(inp, ai, gun); if (!st.shot) { st.shot = true; log({ e: 'shoot' }); } }
    return true;
  }
  ai.wSeen = null;
  if (st.s === 'hang' && (late || elapsedAction(game) > plan.goAt)) { st.s = 'in'; log({ e: 'go' }); }
  if (st.s === 'in') { // to the window's middle, then through it (smashing the boards)
    if (!win) { press('interact'); return true; } // (a plain wall: let go)
    if (st.inv) { inp.inv = prev.inv ? 0 : 1; st.inv = false; return true; }
    if (Math.abs(s) > 3) { inp.rw = -Math.sign(s); return true; }
    if (game.time - (st.vaultT || 0) > 0.6) { st.vaultT = game.time; game.event(p, { k: 'vault', a: r.out + Math.PI }); }
    if (game.time - st.hangT > 100) press('interact'); // can't get in: let go
    return true;
  }
  // boarded: shoot a few peep holes through the boards first (R6), from beside it
  if (win && !st.holes && game.time - st.hangT > 1.5 && r.cells.some(k => m.tiles[k] === T.BARRI)) {
    const k = r.cells[(st.holeN || 0) % r.cells.length], cx = (k % m.W + 0.5) * CELL, cy = (Math.floor(k / m.W) + 0.5) * CELL;
    if (Math.abs(s - st.side * (r.half - 4)) > 2) { inp.rw = Math.sign(st.side * (r.half - 4) - s); return true; }
    const want = Math.atan2(cy - p.y, cx - p.x); turnTo(p, want, S.turn, dt); p.aimX = cx; p.aimY = cy;
    const gun = p.guns[p.slot];
    if (gun && Math.abs(angDiff(want, p.aim)) < 0.08) { const am = gun.ammo; shootInput(inp, ai, gun); if (st.lastAmmo !== undefined && am < st.lastAmmo) st.holeN = (st.holeN || 0) + 1; st.lastAmmo = am; }
    if ((st.holeN || 0) >= 4) { st.holes = true; log({ e: 'holes' }); }
    return true;
  }
  // peek: sit beside the window, now and then slide to its edge to look in at an angle
  const besideS = win ? st.side * (r.half + 10) : 0, edgeS = win ? st.side * Math.max(0, r.half - 6) : 0;
  st.peekT = (st.peekT ?? 2) - dt; if (st.peekT <= 0) { st.peeking = !st.peeking; st.peekT = st.peeking ? 1.2 + Math.random() : 2 + Math.random() * 3; if (st.peeking) log({ e: 'peek' }); }
  const goal = Math.max(r.a, Math.min(r.b, st.peeking ? edgeS : besideS));
  if (Math.abs(s - goal) > 2) inp.rw = Math.sign(goal - s);
  turnTo(p, r.out + Math.PI + (st.peeking ? -st.side * 0.5 : 0), S.turn * 0.6, dt); // looking in at an angle
  return true;
}
function roofPlay(game, p, inp, dt) {
  const ai = p.ai, m = game.map, R = roofPick(game, p); if (!R) return false;
  const st = ai.roofSt && ai.roofSt.round === game.round ? ai.roofSt : (ai.roofSt = { round: game.round, s: 'go', t: game.time });
  if (st.s === 'done') return false;
  const fl = floorAt(m, p.x, p.y), prev = p.prevInput || {}, press = k => { inp[k] = prev[k] ? 0 : 1; }, h = R.h;
  if (p.rope) { if (p.rope.st === 'hang') press(st.s === 'leave' ? 'interact' : 'sprint'); return true; } // up (or down) the rope a stop at a time
  if (st.s !== 'leave' && st.s !== 'go' && (game.planted || game.timer < 30 || game.time - st.t > 70)) st.s = 'leave';
  if (st.s === 'go') {
    if (fl === m.roofFloor) { st.s = 'open'; st.t = game.time; if (!ai.roofSaid) { ai.roofSaid = true; teamSay(game, p, 'On the roof.', 'roof'); } }
    else if (fl !== m.groundFloor || game.time - st.t > 45 || p.hasDefuser) { st.s = 'done'; return false; }
    else { const b = R.rope.base; if (p.grapple) return true; if (Math.hypot(b.x - p.x, b.y - p.y) > 9) { moveTo(game, p, inp, b, dt); return true; }
      if (p.op === 'hoist' && p.abilityCount > 0 && !st.hook) { st.hook = true; aimAt(p, b.x - Math.cos(R.rope.out) * 30, b.y - Math.sin(R.rope.out) * 30); const t = game.grappleTarget(p); if (t && t.roof) { game.event(p, { k: 'ability' }); return true; } } // HOIST: grapple straight up
      press('interact'); return true; }
  }
  if (fl !== m.roofFloor) { st.s = 'done'; return false; } // dropped in through the hatch (or came down the rope)
  if (st.s === 'leave') { const t = R.top.roof; if (Math.hypot(t.x - p.x, t.y - p.y) > 10) { moveTo(game, p, inp, t, dt); return true; } press('interact'); return true; }
  if (visibleEnemy(game, p, skill(game, p).see)) return false; // someone in sight (below through the hatch, too): fight
  const tile = m.tiles[h.cells[0]], dEdge = Math.hypot(h.x - p.x, h.y - p.y);
  const edge = st.edge || (st.edge = (() => { // a spot just off the hatch, on the side facing the site
    const site = m.sites[game.site], b = site.bombs[0], a = Math.atan2(h.y - (b.y - h.by + h.y), h.x - (b.x - h.bx + h.x)); // from the site's side, so the view goes towards it
    for (const da of [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9, Math.PI]) { const x = h.x + Math.cos(a + da) * 26, y = h.y + Math.sin(a + da) * 26; if (floorAt(m, x, y) === m.roofFloor && m.hatchAt[Math.floor(y / CELL) * m.W + Math.floor(x / CELL)] < 0 && m.tiles[Math.floor(y / CELL) * m.W + Math.floor(x / CELL)] === T.FLOOR) return { x, y }; }
    return { x: h.x + 26, y: h.y };
  })());
  if (st.s === 'open') {
    if (tile === T.HATCHR) { st.s = 'leave'; teamSay(game, p, 'Roof hatch is reinforced, coming down.', 'roofR'); return true; }
    if (tile === T.HATCH) { if (Math.hypot(edge.x - p.x, edge.y - p.y) > 8) { moveTo(game, p, inp, edge, dt); return true; } aimAt(p, h.x, h.y); inp.crouch = 1; if (p.meleeCd <= 0) game.event(p, { k: 'melee' }); return true; }
    st.s = 'util';
  }
  if (st.s === 'util') { // a grenade down the hole first
    if (p.gadgetCount > 0 && ['frag', 'stun', 'smoke', 'impact'].includes(p.gadget) && !st.thrown) {
      if (Math.hypot(edge.x - p.x, edge.y - p.y) > 8) { moveTo(game, p, inp, edge, dt); return true; }
      aimAt(p, h.x, h.y); game.event(p, { k: 'gadget' }); st.thrown = true; teamSay(game, p, 'Utility down the roof hatch.', 'roofU'); return true;
    }
    st.s = 'hold';
  }
  if (st.s === 'hold') { // lie at the edge looking down until the team goes in
    const goAt = p.pro ? (() => { const ps = proPlan(game, p.squad, 'atk'); return ps && ps.go ? ps.go : R.dropAt; })() : R.dropAt;
    if (elapsedAction(game) < goAt) {
      if (Math.hypot(edge.x - p.x, edge.y - p.y) > 8) { moveTo(game, p, inp, edge, dt); return true; }
      inp.prone = 1; turnTo(p, Math.atan2(h.y - p.y, h.x - p.x), skill(game, p).turn, dt); return true;
    }
    st.s = 'drop'; teamSay(game, p, 'Dropping in.', 'roofD');
  }
  if (st.s === 'drop') { setDir(inp, h.x - p.x, h.y - p.y); p.aim = Math.atan2(h.y - p.y, h.x - p.x); if (game.time - st.t > 80) st.s = 'leave'; return true; }
  return true;
}

// the site's ways in, rooms beside it and the attackers' route (shared/pros.js), worked out once a round
function intelOf(game) {
  const key = game.map.id + '|' + game.site;
  if (game._intelKey !== key) { game._intelKey = key; game._intel = siteIntel(game.map, game.site); }
  return game._intel;
}

// Open the planned wall: walk to the spot outside it, face it, use the tool, stand back while it goes off.
function doBreach(game, p, inp, b, dt) {
  const map = game.map, ai = p.ai, tool = BREACH_TOOLS[b.tool];
  if (b.backUntil) { // charge placed: wait a few steps back from it
    if (tool.blow && !b.blown && game.time > b.backUntil - 0.6) { b.blown = true; game.event(p, { k: 'ability' }); } // SALVO: now set it off
    if (game.time > b.backUntil) return 'done';
    const away = { x: b.sx - (b.wx - b.sx) * 3, y: b.sy - (b.wy - b.sy) * 3 };
    if (Math.hypot(away.x - p.x, away.y - p.y) > 8) moveTo(game, p, inp, away, dt);
    else p.aim = Math.atan2(b.wy - p.y, b.wx - p.x);
    return 'wait';
  }
  if (!tool.types.includes(map.tiles[b.k]) && !(b.tool === 'scope' && b.used)) return 'done'; // gone already (or someone else opened it)
  if (b.tool === 'scope' && b.used) return 'done';
  if (Math.hypot(b.sx - p.x, b.sy - p.y) > 6) { b.t = (b.t || 0) + dt; if (b.t > 25) return 'done'; return moveTo(game, p, inp, { x: b.sx, y: b.sy }, dt); }
  p.aim = Math.atan2(b.wy - p.y, b.wx - p.x);
  if (tool.use === 'hold') { inp.ability = 1; b.held = (b.held || 0) + dt; return b.held > 4.5 || p.battery <= 0 ? 'done' : 'wait'; }
  const before = tool.use === 'gadget' ? p.gadgetCount : p.abilityCount;
  game.event(p, { k: tool.use });
  const after = tool.use === 'gadget' ? p.gadgetCount : p.abilityCount;
  if (after === before) { b.fails = (b.fails || 0) + 1; return b.fails > 20 ? 'done' : 'wait'; }
  b.used = true;
  if (!tool.back) return 'done';
  b.backUntil = game.time + tool.back; return 'wait';
}

// Impatience: a bot that has stayed in one small area (3 m) with nothing going on (no enemy seen) gets restless,
// sooner the less patient it is, and makes a play. Attackers stop waiting and push to a fresh spot, and experienced
// ones (higher ranks) often go round to come in from an unexpected side. Defenders take a new angle; pushy and
// experienced ones go out into a room beside the site for the surprise. A fight or a noise resets the clock.
function impatience(game, p, team, site, me) {
  const ai = p.ai, lvl = lvlOf(game, p), atk = team === TEAM.ATK, at = ai.stillAt;
  if (!at || Math.hypot(p.x - at.x, p.y - at.y) > 3 * PX_PER_M) { ai.stillAt = { x: p.x, y: p.y, t: game.time }; return; }
  const busy = game.time - (ai.seenT ?? -99) < 5; // a fight on. (Noises don't count: in a busy round there is always one; alone, they make it paranoid instead)
  const stuck = (ai.noPathT || 0) > 2; // walking into a wall towards a spot it can't reach: a new plan at once
  if (busy && !stuck) { at.t = game.time; return; }
  // he asked: experienced bots are less affected (they know when holding is right); it is mostly there so rounds don't go stale
  const limit = (atk ? 3 : 4) + me.patience * (atk ? 4 : 6) + lvl * 0.8;
  if (game.time - at.t < limit && !stuck) return;
  ai.stillAt = null; ai.noPathT = 0;
  const bold = me.aggr * 0.6 + lvl / TOP_BOT * 0.4; // how much of a risk it takes: personality and experience
  if (atk) {
    ai.startWait = 0; ai.supportDone = true; ai.pauseT = 4 + Math.random() * 3; // done waiting and checking angles
    if (stuck && ai.breach) ai.breach = null; // a breach it cannot get to: forget it
    if (Math.random() < bold * 0.7 && !ai.flanked) { ai.flank = flankPoint(game, p, site); if (ai.flank) { ai.role = 'flank'; ai.flanked = false; return; } }
    ai.push = nearBomb(game, site, 40 + Math.random() * 60); ai.bomb = null;
  } else {
    const I = intelOf(game), rooms = I ? [...(I.near || []), I.roam].filter(Boolean) : [];
    if (rooms.length && ai.role !== 'anchor' && Math.random() < bold * 0.6) { const r = rooms[Math.floor(Math.random() * rooms.length)], c = I.centre(r); ai.hold = game.freeSpotNear(c.x, c.y, Math.min(r.w, r.h) * CELL * 0.35); }
    else ai.hold = nearBomb(game, site, 60 + Math.random() * 60);
    ai.holdT = game.time + 12 + Math.random() * 10;
    if (ai.role === 'roamer') ai.roamT = 0; // a roamer: on to another room
    if (ai.role === 'space') ai.spaceAt = null; // a space player: another spot in its room
  }
}

// A spot outside the site's way in that is furthest from where the attackers come from.
function flankPoint(game, p, site) {
  const m = game.map, W = m.W, inSite = siteTest(m, site), b = site.bombs[0];
  let best = null, bd = -1;
  for (const o of m.openings) {
    const k = o.cells[0], x = k % W, y = Math.floor(k / W);
    if (!inSite(x, y) || floorAt(m, (x + 0.5) * CELL, (y + 0.5) * CELL) !== floorAt(m, b.x, b.y)) continue;
    // stand two cells outside the opening (the side away from the site)
    for (const d of [1, -1, W, -W]) {
      const out = k - 2 * d;
      if (inRoomOf(m, site.rooms, (k + d) % W, Math.floor((k + d) / W)) && (m.tiles[out] === T.FLOOR || m.tiles[out] === T.GROUND)) {
        const sx = (out % W + 0.5) * CELL, sy = (Math.floor(out / W) + 0.5) * CELL, dd = Math.hypot(sx - p.x, sy - p.y);
        if (dd > bd) { bd = dd; best = { x: sx, y: sy }; }
      }
    }
  }
  return best;
}

// Walk along a path to a goal; once there, a defender (or anyone told to hold) watches the nearest way in.
// he asked (attackers died as the round began): defenders stay inside during preparation and the first 15 s of the
// action phase. A goal out on open ground (and not by their own site, as on Dust Town) becomes the nearest spot
// inside the building, so no bot runs out at the spawns.
function keepInside(game, goal) {
  const map = game.map, W = map.W, k0 = Math.floor(goal.y / CELL) * W + Math.floor(goal.x / CELL);
  if (map.tiles[k0] !== T.GROUND) return goal;
  const site = map.sites[game.site]; if (site && site.bombs.some(b => Math.hypot(b.x - goal.x, b.y - goal.y) < 10 * PX_PER_M)) return goal;
  const c = game.insideCache || (game.insideCache = new Map()); if (c.has(k0)) return c.get(k0) || goal;
  const seen = new Set([k0]), q = [k0]; let hit = null;
  for (let h = 0; h < q.length && h < 40000 && hit === null; h++) for (const d of [1, -1, W, -W]) {
    const n = q[h] + d; if (seen.has(n) || map.flAt[n] !== map.flAt[k0]) continue; seen.add(n);
    if (map.tiles[n] === T.FLOOR && roomAt(map, (n % W + 0.5) * CELL, (Math.floor(n / W) + 0.5) * CELL)) { hit = n; break; }
    q.push(n);
  }
  const r = hit === null ? null : { x: (hit % W + 0.5) * CELL, y: (Math.floor(hit / W) + 0.5) * CELL };
  c.set(k0, r); return r || goal;
}
const PATHS_A_TICK = 3;
function moveTo(game, p, inp, goal, dt, hold = false) {
  const ai = p.ai, map = game.map, team = game.side(p);
  const early = team === TEAM.DEF && (game.phase === PHASE.PREP || (game.phase === PHASE.ACTION && game.timer > DUR.action - 15)) && !game.free && !game.planted;
  if (early) goal = keepInside(game, goal);
  const gx = Math.floor(goal.x / CELL), gy = Math.floor(goal.y / CELL);
  const sx = Math.floor(p.x / CELL), sy = Math.floor(p.y / CELL);
  ai.pathT = (ai.pathT || 0) - dt;
  // A search can take many ms on these big maps, so (he said it got laggy): a goal that only shifted a little keeps its path until
  // the next look, and at most PATHS_A_TICK bots search in one tick; the others keep walking and search on the next.
  const gk = gy * map.W + gx, shifted = ai.goalK !== gk, far = shifted && (!ai.path || !ai.path.length || ai.goalK === undefined || Math.hypot(ai.goalK % map.W - gx, Math.floor(ai.goalK / map.W) - gy) > 3);
  if (!ai.path || ai.pathT <= 0 || far) {
    if (game.pathTick !== game.time) { game.pathTick = game.time; game.pathsNow = 0; }
    if (game.pathsNow < PATHS_A_TICK || !ai.path) {
      game.pathsNow++;
      ai.path = findPath(map, sx, sy, gx, gy, ai.noVault, false, team === TEAM.DEF, early) || []; ai.pathT = 2 + Math.random(); ai.goalK = gk;
    }
  }
  { const i = ai.path.indexOf(sy * map.W + sx); if (i >= 0 && i < 6) ai.path.splice(0, i + 1); } // also skips the stair end after being carried to the other floor
  ai.noPathT = !ai.path.length && Math.hypot(goal.x - p.x, goal.y - p.y) > 2 * CELL ? (ai.noPathT || 0) + dt : 0; // no way there: see impatience
  if (!ai.path.length) {
    if (Math.hypot(goal.x - p.x, goal.y - p.y) > 6) setDir(inp, goal.x - p.x, goal.y - p.y);
    else if (hold) { // hold an angle on the nearest way in
      if (!ai.watch) ai.watch = watchPoint(game, p) || { x: p.x + Math.cos(p.aim) * 50, y: p.y + Math.sin(p.aim) * 50 };
      if ((ai.chkT = (ai.chkT ?? 4 + Math.random() * 4) - dt) <= 0) { ai.chkT = 4 + Math.random() * 5; ai.chk = threatPoint(game, p, p.aim + (Math.random() - 0.5) * 3); ai.chkUntil = game.time + 1 + Math.random(); }
      const at = ai.chk && game.time < ai.chkUntil ? ai.chk : ai.watch; // the angle held still, now and then a glance at another
      turnTo(p, Math.atan2(at.y - p.y, at.x - p.x), skill(game, p).turn * 0.6, dt);
      if (linedUp(game, p, ai.watch) && game.time > (ai.lineT || 0)) { ai.lineT = game.time + 3; if (ai.hold === goal) ai.hold = null; if (ai.spread) ai.spread = null; } // in a teammate's line: another spot
      inp.crouch = team === TEAM.DEF || persona(p).patience > 0.5 ? 1 : 0;
      // map knowledge: holding the angle leaning out from the cover beside it, or (a defender) lying down at it
      if (ai.poseFor !== ai.watch) { const K = know(game, p); ai.poseFor = ai.watch; ai.leanS = Math.random() < K.lean ? leanSide(game, p, Math.atan2(ai.watch.y - p.y, ai.watch.x - p.x)) : 0; ai.proneH = team === TEAM.DEF && !ai.leanS && Math.random() < K.prone; if (ai.leanS) feat(p, 'lean'); if (ai.proneH) feat(p, 'prone'); }
      if (at === ai.watch && ai.leanS) inp.lean = ai.leanS;
      if (ai.proneH) { inp.prone = 1; inp.crouch = 0; }
    }
    return;
  }
  let next = ai.path[0];
  // he asked: bots walked on top of each other along the same path. Like a team pushing in a tactical shooter, they
  // keep 1.5-2.5 m apart in a line (close enough to trade, not so close one burst gets both), and go through a doorway
  // as a swing: the first one in, the next a beat later through the other half of the doorway.
  const mate = spacingMate(game, p, next);
  if (mate && game.time < (ai.yieldUntil ?? (ai.yieldUntil = game.time + 2.5))) {
    const d = Math.hypot(mate.x - p.x, mate.y - p.y);
    if (d < 20) { const a = Math.atan2(p.y - mate.y, p.x - mate.x) + (p.id < mate.id ? 0.6 : -0.6); setDir(inp, Math.cos(a), Math.sin(a)); inp.walk = 1; } // right on top: step off
    if (preAims(game, p)) { if ((ai.threatT = (ai.threatT || 0) - dt) <= 0) { ai.threatT = 0.7; ai.threat = threatPoint(game, p, Math.atan2(mate.y - p.y, mate.x - p.x)); } if (ai.threat) turnTo(p, Math.atan2(ai.threat.y - p.y, ai.threat.x - p.x), skill(game, p).turn * 0.8, dt); }
    return; // let them get ahead
  }
  if (!mate) ai.yieldUntil = undefined;
  else if (game.time > ai.yieldUntil + 1.5) ai.yieldUntil = undefined; // waited long enough: go anyway, then wait again later
  const oi = map.openId ? map.openId[next] : -1;
  if (oi >= 0 && map.openId[sy * map.W + sx] !== oi && map.openings[oi] && map.openings[oi].cells.length > 1) { // a doorway, not yet in it: take the half a teammate isn't using (once in it, walk on, or a mate nearby holds you there for good)
    const o = map.openings[oi], used = [...game.players.values()].filter(q => q !== p && q.alive && q.squad === p.squad && Math.hypot(q.x - p.x, q.y - p.y) < 120);
    if (used.length) { const far = o.cells.slice().sort((a, b) => Math.min(...used.map(q => Math.hypot((b % map.W + 0.5) * CELL - q.x, (Math.floor(b / map.W) + 0.5) * CELL - q.y))) - Math.min(...used.map(q => Math.hypot((a % map.W + 0.5) * CELL - q.x, (Math.floor(a / map.W) + 0.5) * CELL - q.y))))[0]; next = far; }
  }
  const nx = (next % map.W + 0.5) * CELL, ny = (Math.floor(next / map.W) + 0.5) * CELL;
  const dirA = Math.atan2(ny - p.y, nx - p.x);
  const ahead = pathLook(game, p);
  let lookA = ahead ? Math.atan2(ahead.y - p.y, ahead.x - p.x) : dirA; // where they walk, or (better bots) where an enemy would come from
  if (preAims(game, p)) {
    if ((ai.threatT = (ai.threatT || 0) - dt) <= 0) { ai.threatT = 0.7; ai.threat = threatPoint(game, p, dirA); }
    if (ai.threat) lookA = Math.atan2(ai.threat.y - p.y, ai.threat.x - p.x);
  }
  turnTo(p, lookA, skill(game, p).turn * 0.8, dt);
  if (vaultable(map, next) && Math.hypot(nx - p.x, ny - p.y) < 24) { // climb over it, or note it can't be done and go round
    if (game.startVault(p, dirA)) feat(p, 'vault'); else { (ai.noVault || (ai.noVault = new Set())).add(next); ai.path = null; }
    return;
  }
  if (map.tiles[next] === T.BARRI || map.tiles[next] === T.SOFT || map.tiles[next] === T.PANEL) {
    if (Math.hypot(nx - p.x, ny - p.y) < 26) {
      p.aim = dirA; const f = game.facingCell(p, 20);
      const inWay = [...game.players.values()].some(q => q !== p && q.alive && q.ctrl === 'body' && Math.hypot(q.x - p.x, q.y - p.y) < 30); // a swing would land on them, not the wall (and hurt a teammate)
      if (f && f.k === next && !inWay) { ai.hitT = 0; game.event(p, { k: 'melee' }); return; }
      ai.hitT = (ai.hitT || 0) + dt; // the swing wouldn't reach it from here: step in, and after a while go another way
      if (ai.hitT > 2.5) { ai.hitT = 0; (ai.noVault || (ai.noVault = new Set())).add(next); ai.path = null; return; }
    }
  }
  setDir(inp, nx - p.x, ny - p.y);
  if (teamHushed(game, p)) inp.walk = 1; // someone asked for quiet: don't stomp about either
  else if (!game.tut && game.time - (ai.seenT ?? -99) > 6 && Math.hypot(goal.x - p.x, goal.y - p.y) > 430) {
    inp.sprint = 1; inp.sa = p.aim;
    if (p.spr && oi >= 0 && map.openId[sy * map.W + sx] !== oi && ai.slideO !== oi) { ai.slideO = oi; if (Math.random() < know(game, p).slide) { inp.slide = 1; feat(p, 'slide'); } } // a power slide across a doorway (map knowledge: the flashy ones)
  } // a long way to go and no fight on: sprint (loud). Physics only allows it when they look where they go
  // stuck? nudge
  if (Math.hypot(p.x - (ai.lx || 0), p.y - (ai.ly || 0)) < 0.5) { ai.stuck = (ai.stuck || 0) + dt; if (ai.stuck > 1) { ai.path = null; ai.stuck = 0; } }
  else ai.stuck = 0;
  ai.lx = p.x; ai.ly = p.y;
  // walking on the spot (wobbling against something the path can't see): after 4 s, another way
  if (Math.hypot(p.x - (ai.anX ?? -1e9), p.y - (ai.anY ?? -1e9)) > 12 || !(game.time - ai.anT < 8)) { ai.anX = p.x; ai.anY = p.y; ai.anT = game.time; }
  else if (game.time - ai.anT > 4) { ai.anT = game.time; const nv = ai.noVault && ai.noVault.size > 12 ? (ai.noVault.clear(), ai.noVault) : ai.noVault || (ai.noVault = new Set()); nv.add(next); ai.path = null; }
}

// A teammate just ahead on the way this bot is going (closer than the spacing we keep), or, entering a doorway, one
// who is going through it right now. Only the one behind waits; side by side, the lower id goes first.
function spacingMate(game, p, next) {
  if (p.downed || game.phase !== PHASE.ACTION) return null;
  const map = game.map, nx = (next % map.W + 0.5) * CELL, ny = (Math.floor(next / map.W) + 0.5) * CELL;
  const dl = Math.hypot(nx - p.x, ny - p.y) || 1, ux = (nx - p.x) / dl, uy = (ny - p.y) / dl, fl = floorAt(map, p.x, p.y);
  const door = map.openId && (map.openId[next] >= 0 || (p.ai.path || []).slice(0, 3).some(k => map.openId[k] >= 0));
  let best = null, bd = Infinity;
  for (const q of game.players.values()) {
    if (q === p || !q.alive || q.downed || q.squad !== p.squad || q.ctrl !== 'body' || floorAt(map, q.x, q.y) !== fl) continue;
    const ax = q.x - p.x, ay = q.y - p.y, d = Math.hypot(ax, ay), along = ax * ux + ay * uy;
    if (d < 1 && p.id < q.id) continue;
    const keep = door ? 72 : 52; // ~2 m at a doorway (the swing), ~1.5 m in a corridor
    if (d > keep || along < (Math.abs(along) < 6 ? (p.id < q.id ? 1 : -1) : 0) || Math.abs(ax * uy - ay * ux) > 30) continue;
    if (d < bd) { bd = d; best = q; }
  }
  return best;
}

// Every attacker bot drones in preparation (he asked: some never did; in fact none drove theirs). The drone heads for
// a site room (sometimes another site first, like scouting), spots and calls out defenders it sees, then parks and
// looks round. Stuck or slow: a new goal.
function botDrone(game, p, dt) {
  const ai = p.ai, inp = p.input, d = game.ent(p.droneId), map = game.map, team = game.side(p);
  if (!d) return;
  if (p.pro && (!ai.droneGoal || (ai.droneGoalT -= dt) <= 0 || (game.siteRevealed && !ai.droneFound))) { ai.droneFound = game.siteRevealed; ai.droneGoal = proDroneGoal(game, p); ai.droneVisits = (ai.droneVisits || 0) + 1; ai.dPath = null; ai.droneGoalT = 14; ai.dStuck = 0; }
  if (!ai.droneGoal || (ai.droneGoalT -= dt) <= 0) {
    const sites = map.sites, s = !ai.droneVisits && Math.random() < 0.4 ? sites[Math.floor(Math.random() * sites.length)] : sites[game.site];
    const name = s.rooms[Math.floor(Math.random() * s.rooms.length)], r = map.rooms.find(r => r.name === name);
    ai.droneGoal = r ? game.freeSpotNear((r.x + r.w / 2) * CELL, (r.y + r.h / 2) * CELL, Math.min(r.w, r.h) * CELL * 0.3) : { x: d.x, y: d.y };
    ai.droneVisits = (ai.droneVisits || 0) + 1; ai.dPath = null; ai.droneGoalT = 30; ai.dStuck = 0;
  }
  // defenders in the drone's sight: spotted for the team, and called out once if a person is on the team
  const smokes = game.smokeList();
  for (const q of game.players.values()) {
    if (!q.alive || game.side(q) === team || q.shrouded || Math.hypot(q.x - d.x, q.y - d.y) > 320 || !los(map, d.x, d.y, q.x, q.y, smokes)) continue;
    game.spot(team, q.id, 3);
    if (q.op === 'magpie') game.magpieSeen = { x: q.x, y: q.y, t: game.time, id: q.id };
    if (!(ai.dSaid || (ai.dSaid = new Set())).has(q.id)) { ai.dSaid.add(q.id); talk(game, p, 'drone', { op: opName(q), place: place(game, q.x, q.y) }, 'see' + q.id); }
    if (!(ai.dCalled || (ai.dCalled = new Set())).has(q.id) && [...game.players.values()].some(o => !o.bot && o.squad === p.squad) && game.markOk(p)) {
      ai.dCalled.add(q.id); game.mark(p, q.x, q.y, 'ENEMY ' + OPERATORS[q.op].name, q.id);
    }
  }
  // MAGPIE (he asked): a swarm after this drone. The higher the rank, the sooner the bot notices and the better it runs:
  // Copper half the time never notices, Copper/Bronze only drive away, from Silver up they sprint, and every bot steers for
  // the clearest way away from the swarm, through a drone hole if there is one (that breaks its sight).
  const sw = game.ents.find(s => s.type === 'swarm' && s.target === d.id);
  if (sw && !sw.grab) {
    const lvl = p.pro ? 7 : lvlOf(game, p);
    if (ai.swarmId !== sw.id) { ai.swarmId = sw.id; ai.swarmT = game.time + [1.9, 1.4, 1.0, 0.75, 0.55, 0.42, 0.32, 0.25][lvl] * (0.8 + Math.random() * 0.4); ai.swarmRun = lvl > 0 || Math.random() < 0.5; ai.fleeT = 0; }
    if (ai.swarmRun && game.time >= ai.swarmT) {
      if ((ai.fleeT -= dt) <= 0) {
        ai.fleeT = 0.4;
        const away = Math.atan2(d.y - sw.y, d.x - sw.x);
        let bs = -Infinity;
        for (let i = 0; i < 16; i++) {
          const a = i / 16 * Math.PI * 2; let clear = 0, hole = 0;
          for (let s = 4; s <= 200; s += 4) {
            const cx = Math.floor((d.x + Math.cos(a) * s) / CELL), cy = Math.floor((d.y + Math.sin(a) * s) / CELL), k = cy * map.W + cx, t = tileAt(map, cx, cy);
            if (blocksDrone(t) && !(map.dhole && map.dhole[k] && (t === T.SOFT || t === T.HARD))) break;
            if (map.dhole && map.dhole[k]) hole = 1;
            clear = s;
          }
          const sc = clear * (1 + Math.cos(a - away)) + (lvl >= 3 ? hole * 160 : 0);
          if (sc > bs) { bs = sc; ai.fleeA = a; }
        }
      }
      p.aim = ai.fleeA; setDir(inp, Math.cos(ai.fleeA), Math.sin(ai.fleeA));
      if (lvl >= 2) inp.walk = 1; // sprint
      talk(game, p, 'swarm', {}, 'sw' + sw.id);
      ai.dPath = null;
      return;
    }
  }
  // the attackers know there is a MAGPIE (seen, or a swarm came out): from Platinum up (and pros) drones keep out of her reach
  const mg = game.magpieSeen;
  if ((p.pro || lvlOf(game, p) >= 4) && mg && game.time - mg.t < 45 && Math.hypot(mg.x - d.x, mg.y - d.y) < (SWARM.reach + 2) * PX_PER_M && !(ai.mgBackT > game.time) && ai.dTrail && ai.dTrail.length) {
    ai.mgBackT = game.time + 6; ai.droneGoal = ai.dTrail[0]; ai.droneGoalT = 6; ai.dPath = null;
    const said = game.mgWarned || (game.mgWarned = {}); // once a round per team
    if (said[p.squad] !== game.round) { said[p.squad] = game.round; teamSay(game, p, 'MAGPIE on defence: keep the drones away from her, sprint from the swarm', 'mgW'); }
  }
  // he asked: higher ranks keep their drone alive. From Gold up (not the risk-takers), once a defender is close to the
  // drone or preparation is nearly over, it backs off to where it was a few seconds ago, out of the way, and stays parked.
  const keep = (p.pro ? !(p.persona && p.persona.aggr > 0.75) : lvlOf(game, p) >= 3);
  ai.dTrailT = (ai.dTrailT || 0) - dt; if (ai.dTrailT <= 0) { ai.dTrailT = 1; (ai.dTrail || (ai.dTrail = [])).push({ x: d.x, y: d.y }); if (ai.dTrail.length > 8) ai.dTrail.shift(); }
  if (keep && !ai.dHide && game.phase === PHASE.PREP && ai.dTrail && ai.dTrail.length > 3) {
    const close = [...game.players.values()].some(q => q.alive && game.side(q) !== team && Math.hypot(q.x - d.x, q.y - d.y) < 200 && los(map, d.x, d.y, q.x, q.y));
    if (close || game.timer < 8) { ai.dHide = true; ai.droneGoal = ai.dTrail[0]; ai.droneGoalT = 999; ai.dPath = null; }
  }
  const g = ai.droneGoal, W = map.W, sk = Math.floor(d.y / CELL) * W + Math.floor(d.x / CELL);
  if (Math.hypot(g.x - d.x, g.y - d.y) < 18) { if (!ai.dLookT || game.time > ai.dLookT) { ai.dLookT = game.time + 1.5 + Math.random() * 2; ai.dLookA = p.aim + (Math.random() < 0.5 ? -1 : 1) * (0.8 + Math.random()); } p.aim += Math.max(-dt * 4, Math.min(dt * 4, angDiff(ai.dLookA, p.aim))); return; } // parked: looks one way, then another (no slow spin)
  ai.dPathT = (ai.dPathT || 0) - dt;
  if (!ai.dPath || ai.dPathT <= 0) { ai.dPath = findPath(map, Math.floor(d.x / CELL), Math.floor(d.y / CELL), Math.floor(g.x / CELL), Math.floor(g.y / CELL), null, true) || []; ai.dPathT = 2; }
  { const i = ai.dPath.indexOf(sk); if (i >= 0 && i < 6) ai.dPath.splice(0, i + 1); }
  const next = ai.dPath[0];
  const tx = next === undefined ? g.x : (next % W + 0.5) * CELL, ty = next === undefined ? g.y : (Math.floor(next / W) + 0.5) * CELL;
  if (next === undefined && !ai.dPath.length && ai.dPathT < 1.9 && Math.hypot(g.x - d.x, g.y - d.y) > 60) ai.droneGoalT = 0; // no way there: pick another
  p.aim = Math.atan2(ty - d.y, tx - d.x);
  setDir(inp, tx - d.x, ty - d.y);
  if (Math.hypot(d.x - (ai.dlx ?? 0), d.y - (ai.dly ?? 0)) < 0.3) { if ((ai.dStuck = (ai.dStuck || 0) + dt) > 1.2) { ai.dPath = null; ai.dStuck = 0; ai.dStuckN = (ai.dStuckN || 0) + 1; if (ai.dStuckN > 3) { ai.droneGoalT = 0; ai.dStuckN = 0; } } }
  else ai.dStuck = 0;
  ai.dlx = d.x; ai.dly = d.y;
}

// the doorway or window nearest to this bot that it can see (to hold an angle on): the site's own when defending it
// ---- game sense by rank (he asked: Copper and Bronze still do dumb things, Silver/Gold an average player, a Champion
// team should leave him no chance). How much of what they hear they notice:
const EAR = [0.6, 0.8, 1, 1, 1, 1, 1];
// Copper always, Bronze half the rounds, Silver now and then: runs up to the site instead of walking in quietly
function loud(game, p) {
  if (p.pro) return false;
  const lvl = lvlOf(game, p), ai = p.ai;
  if (ai.loud === undefined) ai.loud = Math.random() < [1, 0.5, 0.2, 0, 0, 0, 0][lvl];
  return ai.loud;
}
const WANDER = [0.35, 0.2, 0.05, 0, 0, 0, 0]; // chance a round of going off alone to a room nobody needs
const TRADE = [0.4, 0.4, 0.25, 0.55, 0.8, 0.9, 1]; // chance of going for the trade when a teammate dies close by
const WALLBANG = [0, 0, 0, 0.1, 0.25, 0.5, 0.85]; // chance of shooting through a thin wall at a spotted enemy (pros 0.9)
// Map knowledge by rank (he asked: aim is good now, so map sense should climb with rank; he chose a smooth climb:
// Copper and Bronze mostly use the front doors and walk into cameras, now and then stumbling on something clever;
// Champion and the pros know every camera spot, off-angle, flank, hatch and rope). One row per rank, the last for pros.
// cams: chance of shooting a camera / trap / gadget seen; memo: knows where the map's cameras hang (same spots every
// round) and turns to one close by before noticing it; angles: checks the usual defender off-angles (attack) and holds
// them (defence) instead of plain doorways; safe: weighs how exposed a way in is and spreads from teammates; clever:
// chance of a way in other than the obvious one; lean, prone: holding an angle leaning out from cover / lying down;
// glare: steps out of a sniper scope's glint; slide: slides across a doorway while sprinting.
const KNOW = [
  { cams: 0.1, memo: 0, angles: 0, safe: 0, clever: 0.08, lean: 0, prone: 0, glare: 0, slide: 0 },               // Copper
  { cams: 0.25, memo: 0, angles: 0.1, safe: 0.1, clever: 0.12, lean: 0.04, prone: 0, glare: 0.05, slide: 0 },    // Bronze
  { cams: 0.45, memo: 0.15, angles: 0.25, safe: 0.25, clever: 0.18, lean: 0.1, prone: 0.03, glare: 0.15, slide: 0 }, // Silver
  { cams: 0.6, memo: 0.35, angles: 0.4, safe: 0.4, clever: 0.24, lean: 0.18, prone: 0.06, glare: 0.3, slide: 0 },   // Gold
  { cams: 0.75, memo: 0.55, angles: 0.6, safe: 0.6, clever: 0.3, lean: 0.26, prone: 0.09, glare: 0.5, slide: 0.03 }, // Platinum
  { cams: 0.9, memo: 0.8, angles: 0.8, safe: 0.8, clever: 0.36, lean: 0.34, prone: 0.12, glare: 0.75, slide: 0.08 }, // Diamond
  { cams: 1, memo: 0.95, angles: 1, safe: 1, clever: 0.4, lean: 0.42, prone: 0.15, glare: 0.9, slide: 0.15 },     // Champion
  { cams: 1, memo: 1, angles: 1, safe: 1, clever: 0.4, lean: 0.5, prone: 0.18, glare: 1, slide: 0.3 },            // Pros
];
const know = (game, p) => KNOW[p.pro ? 7 : lvlOf(game, p)];
// what each bot did with the game's features, counted for practice (the PLAYBOOK's tendencies) and tests/features.js
export const feat = (p, k, n = 1) => { const f = p.feat || (p.feat = {}); f[k] = (f[k] || 0) + n; };
// a camera, trap or gadget of the other team this bot sees (or, knowing the map, knows is there) and would shoot.
// Each thing is weighed once (KNOW.cams), so a Copper walks past most of them.
const NO_SHOOT = new Set(['drone', 'bird', 'decoy', 'cover', 'dshield']);
// hidden traps show to attackers only within TRAP_SEEN (main.js); bots used to see them from 16 m and shot LOCKJAW's hatch traps (and every other trap) before anyone could walk into them
const HIDDEN_TRAPS = new Set(['clamp', 'prox', 'concuss', 'alarm', 'mine', 'htrap']), TRAP_SEEN = 2 * PX_PER_M;
function gadgetShot(game, p) {
  const ai = p.ai, m = game.map, K = know(game, p), team = game.side(p), fl = floorAt(m, p.x, p.y), roll = ai.gRoll || (ai.gRoll = {});
  let best = null, bd = Infinity;
  for (const e of game.ents) {
    if (!(e.hp > 0) || e.team === team || !e.team || NO_SHOOT.has(e.type) || e.tu) continue; // (a turret only breaks through its lens)
    const out = e.oc !== undefined, x = out ? e.gx : e.x, y = out ? e.gy : e.y; // an outside camera: shot at its spot on the wall from the ground
    if (out ? fl !== m.groundFloor : floorAt(m, x, y) !== fl) continue;
    const d = Math.hypot(x - p.x, y - p.y); if (d > 16 * PX_PER_M || d >= bd || (HIDDEN_TRAPS.has(e.type) && d > TRAP_SEEN)) continue;
    const mapCam = e.type === 'cam' && !e.owner, facing = Math.abs(angDiff(Math.atan2(y - p.y, x - p.x), p.aim)) < 0.9;
    if (!facing && !(mapCam && d < 12 * PX_PER_M && (roll['m' + e.id] ??= Math.random() < K.memo))) continue; // behind them: only a camera they know hangs there
    if ((roll[e.id] ??= Math.random() < K.cams) === false || (ai.gGive && ai.gGive[e.id] > game.time)) continue;
    if (!los(m, p.x, p.y, x, y) || !shotClear(game, p, { x, y })) continue;
    bd = d; best = { e, x, y };
  }
  return best;
}
// an enemy aimed in through a sniper scope, pointing at this bot from far off: the glint gives it away (main.js scopeGlare)
function glareOn(game, p) {
  const m = game.map, fl = floorAt(m, p.x, p.y);
  for (const q of game.players.values()) {
    if (!q.alive || q.downed || game.side(q) === game.side(p)) continue;
    const g = q.guns && q.guns[q.slot]; if (!g || !g.att || g.att.sight !== 'sniper' || !((q.adsT || 0) >= 0.6)) continue;
    const d = Math.hypot(p.x - q.x, p.y - q.y); if (d < 3 * PX_PER_M || d > 64 * PX_PER_M || floorAt(m, q.x, q.y) !== fl) continue;
    if (Math.abs(angDiff(q.aim, Math.atan2(p.y - q.y, p.x - q.x))) < 0.14 && los(m, q.x, q.y, p.x, p.y)) return q;
  }
  return null;
}
// leaning out from cover toward a point: the side with a wall right beside the line (lean past it), else none
function leanSide(game, p, a) {
  const r = castSight(game.map, p.x, p.y, a + 0.7, 40, null), l = castSight(game.map, p.x, p.y, a - 0.7, 40, null);
  return Math.min(r, l) > 30 ? 0 : r < l ? 1 : -1;
}
// a way into the site for an attacker (not the pros, who have their plan): the obvious one from where it is, or
// (KNOW.clever) another; better ranks weigh how exposed each is to the upper windows and spread out from teammates
function pickWay(game, p) {
  const m = game.map, K = know(game, p), ways = siteIntel(m, game.site).ways.filter(w => w.kind !== 'wall');
  if (!ways.length) return null;
  const exp = w => { if (m.flAt[w.out] !== m.groundFloor || !m.yard || !m.yard.ways) return 0; const near = m.yard.ways.filter(y => Math.hypot(y.k % m.W - w.out % m.W, Math.floor(y.k / m.W) - Math.floor(w.out / m.W)) < 5); return near.length ? Math.min(...near.map(y => y.exp || 0)) : 0; };
  const mates = w => [...game.players.values()].filter(q => q !== p && q.alive && q.squad === p.squad && q.ai && q.ai.way === w).length;
  const score = w => Math.hypot(w.stack.x - p.x, w.stack.y - p.y) / CELL + K.safe * (exp(w) * 40 + mates(w) * 18) + Math.random() * 6;
  const order = ways.slice().sort((a, b) => score(a) - score(b));
  const w = order.length > 1 && Math.random() < K.clever ? order[1 + Math.floor(Math.random() * (order.length - 1))] : order[0];
  if (w !== order[0]) feat(p, 'clever');
  return w;
}
// a defender's spot: one of the off-angles on a way in (siteIntel holds), not one a teammate already has
function knownHold(game, p) {
  const ways = siteIntel(game.map, game.site).ways.filter(w => w.hold);
  const taken = [...game.players.values()].filter(q => q !== p && q.alive && q.squad === p.squad && q.ai && q.ai.hold).map(q => q.ai.hold);
  const free = ways.filter(w => !taken.some(h => Math.hypot(h.x - w.hold.x, h.y - w.hold.y) < 50));
  const w = (free.length ? free : ways)[Math.floor(Math.random() * (free.length || ways.length))];
  return w ? { at: game.freeSpotNear(w.hold.x, w.hold.y, 20), watch: w.pos } : null;
}
function rankHabits(game, p, inp, dt, team, site, gun) {
  const ai = p.ai, lvl = p.pro ? PRO_LEVEL : lvlOf(game, p), m = game.map;
  // wandering off alone (Copper, Bronze): a random room away from the site for a while, as if it forgot the plan
  if (!p.pro && ai.wander === undefined) {
    ai.wander = null;
    if (Math.random() < WANDER[lvl] && !p.hasDefuser) {
      const rooms = m.rooms.filter(r => !site.rooms.includes(r.name));
      const r = rooms[Math.floor(Math.random() * rooms.length)];
      if (r) ai.wander = { at: game.freeSpotNear((r.x + r.w / 2) * CELL, (r.y + r.h / 2) * CELL, Math.min(r.w, r.h) * CELL * 0.3), until: game.time + 20 + Math.random() * 25 };
    }
  }
  if (ai.wander && !game.planted) {
    if (game.time > ai.wander.until || Math.hypot(ai.wander.at.x - p.x, ai.wander.at.y - p.y) < 30 && Math.random() < dt * 0.15) ai.wander = null;
    else { moveTo(game, p, inp, ai.wander.at, dt); return true; }
  }
  // the trade: a teammate just died close by → swing onto where the shot came from. From Gold up they walk in with the
  // crosshair already on that spot; Copper and Bronze charge in running (and loud)
  const tr = game.proTrade && game.proTrade[p.squad];
  if (!p.pro && tr && game.time - tr.t < 4 && Math.hypot(tr.x - p.x, tr.y - p.y) < 320 && !(team === TEAM.ATK && p.hasDefuser)) {
    if (ai.tradeT !== tr.t) { ai.tradeT = tr.t; ai.trading = Math.random() < TRADE[lvl]; }
    if (ai.trading && tr.from && Math.hypot(tr.from.x - p.x, tr.from.y - p.y) > 24) {
      moveTo(game, p, inp, tr.from, dt);
      if (lvl >= 2) { const pt = angleOn(game, p, tr.from) || tr.from; turnTo(p, Math.atan2(pt.y - p.y, pt.x - p.x), skill(game, p).turn, dt); inp.walk = Math.hypot(tr.x - p.x, tr.y - p.y) < 120 ? 1 : 0; }
      return true;
    }
  }
  // through the wall: an enemy the team has spotted, close, behind one or two soft walls (no concrete) → a burst through
  const W = gun && WEAPONS[gun.w], wb = p.pro ? 0.9 : WALLBANG[lvl];
  if (wb && W && gun.ammo > 0 && penOf(W) >= 0.4 && !p.reloadT) {
    if (ai.wbUntil > game.time && ai.wbAt) {
      const q = game.players.get(ai.wbAt);
      if (q && q.alive) {
        const a = Math.atan2(q.y - p.y, q.x - p.x) + (ai.wbErr || 0); ai.wbErr = (ai.wbErr || 0) * Math.exp(-dt * 6);
        turnTo(p, a, skill(game, p).turn, dt); inp.ads = 1;
        const d = Math.hypot(q.x - p.x, q.y - p.y); p.aimX = p.x + Math.cos(p.aim) * d; p.aimY = p.y + Math.sin(p.aim) * d;
        if (Math.abs(angDiff(a, p.aim)) < 0.05) shootInput(inp, ai, gun);
        return true;
      }
      ai.wbUntil = 0;
    }
    ai.wbT = ai.wbT || {};
    for (const [id, until] of game.spots[team]) {
      if (until < game.time || game.time < (ai.wbT[id] || 0)) continue;
      const q = game.players.get(id);
      if (!q || !q.alive || q.staged) continue;
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < 40 || d > 12 * PX_PER_M || floorAt(m, q.x, q.y) !== floorAt(m, p.x, p.y) || los(m, p.x, p.y, q.x, q.y)) continue;
      ai.wbT[id] = game.time + 5;
      if (Math.random() > wb || !thinWalls(game, p, q)) continue;
      ai.wbAt = id; feat(p, 'wallbang'); ai.wbUntil = game.time + 0.7 + Math.random() * 0.6; ai.wbErr = (Math.random() - 0.5) * 0.15;
      return true;
    }
  }
  return false;
}
// the line from p to q only crosses soft walls or boards (at most two of them) and no teammate stands near it
function thinWalls(game, p, q) {
  const m = game.map, d = Math.hypot(q.x - p.x, q.y - p.y), dx = (q.x - p.x) / d, dy = (q.y - p.y) / d;
  let walls = 0, inWall = false, ok = true;
  walkRay(p.x, p.y, dx, dy, d, (cx, cy) => {
    const t = tileAt(m, cx, cy), solid = stopsBullet(t) || t === T.SOFT || t === T.BARRI;
    if (solid && t !== T.SOFT && t !== T.BARRI) { ok = false; return true; }
    if (solid && !inWall) walls++;
    inWall = solid; return walls > 2 && (ok = false, true);
  });
  if (!ok || !walls) return false;
  for (const o of game.players.values()) {
    if (o === p || !o.alive || game.side(o) !== game.side(p)) continue;
    const t = (o.x - p.x) * dx + (o.y - p.y) * dy;
    if (t > 0 && t < d + 30 && Math.abs((o.y - p.y) * dx - (o.x - p.x) * dy) < 20) return false;
  }
  return true;
}

// He asked: bots should look roughly where an enemy would come from — Hard and Expert always, Normal some of the time,
// Easy never (they look where they walk). A threat point: the nearest doorway, window, staircase end or open hatch
// they can see, roughly ahead of them (dir), 2–11 m away.
function preAims(game, p) {
  if (p.pro) return true; // pros always check where an enemy could come from
  const lvl = lvlOf(game, p);
  if (lvl >= 4) return true; // Platinum and up: always
  if (lvl <= 1) return false; // Copper, Bronze: never
  const ai = p.ai; if ((ai.preRollT = (ai.preRollT || 0) - 1) <= 0) { ai.preRollT = 180; ai.preRoll = Math.random() < (lvl === 2 ? 0.4 : 0.7); } // Normal: now and then (re-decided every few seconds)
  return ai.preRoll;
}
function threatPoint(game, p, dir) {
  const m = game.map, W = m.W, pts = [];
  for (const o of m.openings) { const k = o.cells[o.cells.length >> 1]; pts.push({ x: (k % W + 0.5) * CELL, y: (Math.floor(k / W) + 0.5) * CELL }); }
  for (let i = 0; i < (m.stairs || []).length; i++) { const e = stairEnds(m, i, 0); pts.push(e.top, e.bottom); }
  for (const h of m.hatches || []) if (hatchOpen(m, h)) pts.push({ x: h.x, y: h.y }, { x: h.bx, y: h.by });
  // map knowledge (KNOW.angles): an attacker who knows the map also checks where defenders like to sit (the off-angles
  // inside the site), not only the doorways
  if (game.side(p) === TEAM.ATK && (p.ai.angK ??= Math.random() < know(game, p).angles)) for (const w of siteIntel(m, game.site).ways) if (w.hold) pts.push(w.hold);
  let best = null, bs = Infinity;
  for (const q of pts) {
    const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < 70 || d > 400) continue;
    const off = Math.abs(angDiff(Math.atan2(q.y - p.y, q.x - p.x), dir)); if (off > 1.5) continue;
    const sc = d + off * 160; if (sc >= bs || !los(m, p.x, p.y, q.x, q.y)) continue;
    bs = sc; best = q;
  }
  return best;
}
function watchPoint(game, p) {
  const m = game.map, site = m.sites[game.site], W = m.W;
  const inSite = siteTest(m, site), atSite = inRoomOf(m, site.rooms, Math.floor(p.x / CELL), Math.floor(p.y / CELL));
  let best = null, bd = Infinity;
  for (const o of m.openings) {
    const k = o.cells[0], x = (k % W + 0.5) * CELL, y = (Math.floor(k / W) + 0.5) * CELL;
    if (atSite && !inSite(k % W, Math.floor(k / W))) continue;
    const watched = [...game.players.values()].filter(q => q !== p && q.alive && q.squad === p.squad && q.ai && q.ai.watch && Math.hypot(q.ai.watch.x - x, q.ai.watch.y - y) < 20).length;
    const d = Math.hypot(x - p.x, y - p.y) + watched * 260; // he asked: not four people on one way in while the windows go unwatched
    if (d < bd && d > 40 && d < 400 + watched * 260 && los(m, p.x, p.y, x, y)) { bd = d; best = { x, y }; }
  }
  return best;
}

function nearBomb(game, site, d) {
  const b = site.bombs[Math.floor(Math.random() * site.bombs.length)];
  return game.freeSpotNear(b.x, b.y, d);
}

function setDir(inp, dx, dy) {
  const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
  inp.right = dx > 0.38 ? 1 : 0; inp.left = dx < -0.38 ? 1 : 0;
  inp.down = dy > 0.38 ? 1 : 0; inp.up = dy < -0.38 ? 1 : 0;
}
export const __findPath = (...a) => findPath(...a); // for tests

// ======================================================================================================================
// PRO TEAMS (he asked: 10 bots that play like professional R62D players in a tournament; the test subjects for game
// tests). Bot skill "Pro": squad 0's bots are Northwind, squad 1's Ironclad Collective (shared/pros.js). Each team's
// in-game leader picks a plan from the team's playbook for the map, site and side; every player has a job in it
// (where to drone, where to stack, what to open, when to go, what to hold) and the leader changes the plan on the fly
// (too many down, time running out, the main door stacked, a plant to retake) and calls it in team chat. They are
// held to human limits: human reaction times (each player their own), aim that overshoots and settles, a human field
// of view, hearing as vague as a person's, and their own strengths and flaws (shakier under pressure, over-peeking,
// lurking too long, never rotating ...).
// ======================================================================================================================
// how often someone strafe-peeks in a fight (he asked: a hard skill, not something everyone does all the time)
const PEEK = PRO_PEEK, PEEK_LVL = [0.02, 0.03, 0.06, 0.09, 0.12, 0.18, 0.22];
function peekSkill(game, p) { return p.pro ? (PEEK[p.pro.pl.name] ?? 0.06) : PEEK_LVL[lvlOf(game, p)]; }
const PERSONA = PRO_PERSONA, TIMING = PRO_TIMING, ROTATE_DELAY = PRO_ROTATE; // (in shared/pros.js: the PLAYBOOK shows them)
// The pros talk (he asked: you can see what they say, an insight into their thoughts; not everything is said, but a
// change of plan always is, and specific information has to be spoken because pings are limited). A line goes to their
// team (team chat, and Esports TV viewers). Each player leaves a few seconds between lines, the same news isn't
// repeated by a teammate, and they only say what they actually saw, heard or know.
const place = (game, x, y) => { const r = roomAt(game.map, x, y); return r ? r.replace(/^\dF /, '') : 'outside'; };
const opName = q => (OPERATORS[q.op] ? OPERATORS[q.op].name[0] + OPERATORS[q.op].name.slice(1).toLowerCase() : 'someone');
// AMATEUR HOUR (he asked): the everyday bots on a broadcast talk too, scaled to their rank. Copper and Bronze are
// comically bad on comms: each has a "bit" for the match (singing, arguing with family, an open mic, lost); Silver and
// Gold make basic and sometimes wrong calls; Platinum and up sound like a team. All lines are our own.
const BITS = {
  singer: ['♪ my drone goes vroom, vroom in the room ♪', '♪ oh the stairs, the stairs, nobody cares ♪', '♪ reinforce my heart, baby, breach charge me apart ♪', '♪ la la la, defuser, la ♪', '♪ (humming loudly) ♪', '♪ I got a barricade and a dream ♪'],
  rapper: ['yo, I\'m on the floor, kicking down the door, don\'t know the score, still want some more', 'mic check, one two, drone check, where are you', 'they call me the breacher, softest walls teacher', 'bars on bars, also there\'s someone in the bathroom maybe'],
  mom: ['MUM I\'M IN A ROUND', 'no I can\'t take the bins out, it\'s round three', 'five more minutes! FIVE!', 'she says dinner\'s ready, cover me', 'I DID tidy it. I did. guys she\'s in the room', 'MUM that\'s my headset cable'],
  mic: ['*heavy breathing*', '*crunching crisps*', '*keyboard noises*', 'can you guys hear me? hello? hellooo?', '*a dog barking*', 'wait was my mic on this whole time'],
  lost: ['which button is crouch again', 'where is the bomb, is it the red thing', 'I think they\'re… somewhere?', 'why is everything grey', 'is the drone supposed to be upside down', 'I just shot my own camera, is that bad'],
};
const BIT_KEYS = Object.keys(BITS);
const MID = ['one on the stairs I think', 'where\'s the bomb again?', 'nice shot!', 'sorry, my bad', 'I heard something', 'pushing!', 'someone help me', 'is anyone watching cams?', 'they\'re coming from… left? my left'];
const HIGH = ['two in {room}', 'droning {room}, looks clear', 'I\'ll hold this angle', 'going in, follow me', 'heard steps above', 'one down, keep pushing', 'watch the window'];
export function amateurComms(game, p, dt) {
  if (p.pro || game.phase === PHASE.SELECT || game.phase === PHASE.LOBBY) return;
  const lv = lvlOf(game, p), ai = p.ai || (p.ai = {});
  if (!game.tv && lv > 1) return; // (in a match with people, only Copper and Bronze chat for the fun of it)
  if (lv <= 1 && p.alive && (p.idleT = (p.idleT ?? (12 + Math.random() * 25)) - dt) <= 0) { p.idleT = 30 + Math.random() * 40; talk(game, p, 'idleFun'); }
  if (!game.tv) return;
  p.chatT = (p.chatT ?? (6 + Math.random() * 12)) - dt; if (p.chatT > 0) return; // he asked: the bots talked too much
  let text;
  if (lv <= 1) { const bit = p.bit || (p.bit = BIT_KEYS[(+p.id.slice(1) * 7 + game.round) % BIT_KEYS.length]); const L = BITS[bit]; text = L[Math.floor(Math.random() * L.length)]; p.chatT = 20 + Math.random() * 20; }
  else if (lv <= 4) { text = MID[Math.floor(Math.random() * MID.length)]; p.chatT = 35 + Math.random() * 30; } // most ranks mostly ping instead
  else { text = HIGH[Math.floor(Math.random() * HIGH.length)].replace('{room}', place(game, p.x, p.y) || 'there'); p.chatT = 22 + Math.random() * 18; } // Diamond and up: the ones who talk about the objective
  game.chat(p, { text: text.slice(0, 140), team: true });
}
// ---- bots talking in chat (he asked: varied, not constantly; quiet when someone is clutching or listening;
// someone can ask for quiet and the rest respect it; politer with rank, Copper and Bronze still funny) ----
const action0 = game => game.phase === PHASE.ACTION;
const talkTeam = (game, sq) => (game.proSaid || (game.proSaid = {}))[sq] || (game.proSaid[sq] = { keys: {}, last: 0 });
const writer = p => (p.pro ? p.pro.pl.name : p.id); // whose favourite lines (shared/comms.js)
const CONTACT = new Set(['see', 'seeMany', 'seeLow', 'got', 'gotLast', 'dead', 'low']);
export const teamHushed = (game, p) => talkTeam(game, p.squad).hushUntil > game.time;
// may this bot say this right now?
export function talkAllowed(game, p, cat) {
  if (game.tut) return false;
  const t = game.time, ts = talkTeam(game, p.squad);
  if (action0(game)) {
    const mates = [...game.players.values()].filter(q => q.squad === p.squad);
    if (cat !== 'dead' && mates.length > 1 && mates.filter(q => q.alive && !q.downed).length === 1) return false; // someone is clutching: nobody says a word
    if (!p.alive && cat !== 'dead') return false; // the dead give their last call, then let people play
    if (ts.hushUntil > t && !CONTACT.has(cat)) return false; // someone asked for quiet: only what can't wait
    if (ts.listen > t && !LINES[cat].prio) return false; // someone is close to hearing an enemy
  }
  return true;
}
export function talk(game, p, cat, slots = {}, key = null) {
  if (!p || !p.bot || !LINES[cat]) return false;
  if (!p.pro && !game.tv && ![...game.players.values()].some(o => !o.bot && o.squad === p.squad)) return false; // nobody to hear it
  const name = !p.pro && lvlOf(game, p) <= 1 && FUN[cat] ? FUN[cat] : cat, t = game.time, ts = talkTeam(game, p.squad), prio = LINES[name].prio;
  if (key && t - (ts.keys[key] ?? -99) < 12) return false; // a teammate just said it
  if (!talkAllowed(game, p, cat)) return false;
  if (prio ? t - ts.last < 1.2 : (t - (p.saidT ?? -99) < 12 || t - ts.last < 5)) return false; // he asked: not all the time
  const c = compose(writer(p), name, slots, p.saidRecent || (p.saidRecent = [])); if (!c) return false;
  if (key) ts.keys[key] = t; p.saidT = t; ts.last = t;
  if (slots.op && slots.place && !['dead', 'got', 'gotLast'].includes(cat)) ts.lastSeen = { op: slots.op, place: slots.place, t };
  if (CONTACT.has(cat) && cat !== 'low') ts.hushUntil = 0; // a fight has started: it makes sense to talk again
  if (p.pro) (game.proLog || (game.proLog = [])).push({ round: game.round, squad: p.squad, team: p.pro.tag, text: c.text, who: p.pro.pl.name });
  game.chat(p, { text: c.text, team: true });
  return true;
}
// close to hearing an enemy: the team keeps it down, and now and then this bot says so out loud, which holds them for longer
function listenUp(game, p) {
  const ts = talkTeam(game, p.squad), t = game.time;
  ts.listen = Math.max(ts.listen || 0, t + 2.5);
  if (ts.hushUntil > t || t - (ts.hushSaid ?? -99) < 45 || t - ts.last > 4 || Math.random() > 0.25) return; // only worth saying when people are talking
  if (talk(game, p, 'hush')) { ts.hushSaid = t; ts.hushUntil = t + 5 + Math.random() * 3; }
}
// A person told the team something in team chat: the right bots answer and really do it.
const OP_NAMES = Object.values(OPERATORS).map(o => o.name);
const clean = n => String(n || '').replace(/^\[\w+\] /, '');
const NUM_WORD = n => String(n);
function roomPoint(game, r) { // a spot inside a room that a body can stand on
  const m = game.map, cx = r.x + (r.w >> 1), cy = r.y + (r.h >> 1);
  for (let d = 0; d < 8; d++) for (let y = cy - d; y <= cy + d; y++) for (let x = cx - d; x <= cx + d; x++) {
    if (x < r.x || y < r.y || x >= r.x + r.w || y >= r.y + r.h) continue;
    if (!blocksMove(m.tiles[y * m.W + x])) return { x: (x + 0.5) * CELL, y: (y + 0.5) * CELL };
  }
  return { x: (cx + 0.5) * CELL, y: (cy + 0.5) * CELL };
}
// the named room nearest the speaker (the same name can be on several floors)
function roomNamed(game, p, name) {
  name = name.replace(/^\dF /, ''); // ("1F Kitchen" and "2F Kitchen" are both the kitchen: the nearest one)
  const fl = floorAt(game.map, p.x, p.y); let best = null, bd = Infinity;
  for (const r of game.map.rooms) {
    if (r.name.replace(/^\dF /, '') !== name) continue;
    const d = Math.hypot((r.x + r.w / 2) * CELL - p.x, (r.y + r.h / 2) * CELL - p.y) + (r.fl === fl ? 0 : 2000);
    if (d < bd) { bd = d; best = r; }
  }
  return best;
}
function roomFloor(game, p, dir) { // "upstairs": the biggest room a floor up or down
  const fl = floorAt(game.map, p.x, p.y) + dir; let best = null;
  for (const r of game.map.rooms) if (r.fl === fl && (!best || r.w * r.h > best.w * best.h)) best = r;
  return best;
}
export function flushReplies(game) {
  const q = game.replyQ; if (!q || !q.length) return;
  for (let i = q.length - 1; i >= 0; i--) if (game.time >= q[i].t) { const r = q.splice(i, 1)[0], w = game.players.get(r.id); if (w) sayTo(game, w, r.cat, r.slots); }
}
function sayTo(game, who, cat, slots = {}) {
  const c = compose(writer(who), cat, slots, who.saidRecent || (who.saidRecent = [])); if (!c) return;
  who.saidT = game.time; talkTeam(game, who.squad).last = game.time;
  if (who.pro) (game.proLog || (game.proLog = [])).push({ round: game.round, squad: who.squad, team: who.pro.tag, text: c.text, who: who.pro.pl.name });
  game.chat(who, { text: c.text, team: true });
}
// The ping wheel: go and help send the two nearest bots to the spot, hold sends the nearest and it stays; danger calls off orders to go near it.
export function botPing(game, p, pk, x, y) {
  if (game.tut || p.bot || game.tv) return;
  const t = game.time, bots = [...game.players.values()].filter(q => q !== p && q.squad === p.squad && q.bot && q.alive && !q.downed).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
  if (!bots.length) return;
  const later = game.phase === PHASE.PREP ? game.timer : 0, reply = (q, cat) => (game.replyQ || (game.replyQ = [])).push({ t: t + 0.35 + Math.random() * 0.7, id: q.id, cat, slots: { place: place(game, x, y) } });
  const send = (q, secs, extra) => { q.ai = q.ai || {}; q.ai.cmd = { k: 'goto', id: p.id, until: t + secs + later, x, y, ...extra }; };
  if (pk === 'go' || pk === 'help' || pk === 'open') { const n = bots.slice(0, 2); n.forEach(q => send(q, 120, { stay: pk === 'open' ? 10 : 25 })); reply(n[0], 'ansGoto'); }
  else if (pk === 'hold') { send(bots[0], 120, { stay: 45 }); reply(bots[0], 'ansWatch'); }
  else if (pk === 'danger') { let n = null; for (const q of bots) if (q.ai && q.ai.cmd && q.ai.cmd.k === 'goto' && Math.hypot(q.ai.cmd.x - x, q.ai.cmd.y - y) < 6 * PX_PER_M) { q.ai.cmd = null; n = n || q; } if (n) reply(n, 'ansDrop'); }
}
export function botHear(game, p, text) {
  if (game.tut || p.bot || game.tv) return null;
  const t = game.time, ts = talkTeam(game, p.squad), team = game.side(p), players = [...game.players.values()];
  const others = players.filter(q => q !== p && q.squad === p.squad && q.bot);
  const bots = others.filter(q => q.alive && !q.downed).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
  const names = q => (q.op && OPERATORS[q.op] ? OPERATORS[q.op].name : '');
  const c = parseCommand(text, { rooms: (game.map.rooms || []).map(r => r.name), ops: OP_NAMES, enemyOps: players.filter(q => q.squad !== p.squad && q.op).map(names), mates: others.map(q => ({ id: q.id, name: clean(q.name), op: names(q) })) });
  game.lastHeard = c;
  if (!bots.length) return c;
  const asked = bots.filter(q => c.who.includes(q.id));
  const say = (who, cat, slots = {}, slow = 0) => { (game.replyQ || (game.replyQ = [])).push({ t: t + 0.35 + slow + Math.random() * 0.7, id: who.id, cat, slots }); };
  const first = asked[0] || bots[0];
  if (!c.intent) { if (asked.length || c.question) say(first, 'huh'); return c; }
  // who it is for: names first, then "everyone", then the team-wide orders, otherwise whoever is nearest
  const wide = c.all || ['push', 'regroup', 'fallback', 'quiet', 'talk', 'cancel'].includes(c.intent);
  const targets = asked.length ? asked : wide ? bots : [bots[0]];
  const inPrep = game.phase === PHASE.PREP, later = inPrep ? game.timer : 0;
  const order = (q, k, secs, extra = {}) => { q.ai = q.ai || {}; q.ai.cmd = { k, id: p.id, until: t + secs + later, ...extra }; };
  const waiting = q => inPrep && (q.staged || team === TEAM.ATK);
  const ackAll = (cat, slots = {}) => { targets.slice(0, 2).forEach((q, i) => { if (i === 0 || Math.random() < 0.4) say(q, waiting(q) && !cat.startsWith('ansThanks') ? 'ansPrep' : cat, slots, i * 0.8); }); };
  const site = game.map.sites[game.site], b0 = site.bombs[0], siteKnown = team === TEAM.DEF || game.siteRevealed;
  // where a sentence points: a room, a floor up or down, or the site
  let room = c.room ? roomNamed(game, p, c.room) : c.updown ? roomFloor(game, p, c.updown) : null;
  const spot = room ? roomPoint(game, room) : c.site && siteKnown ? { x: b0.x, y: b0.y } : null;
  const where = room ? room.name.replace(/^\dF /, '') : c.site ? place(game, b0.x, b0.y) : null;
  switch (c.intent) {
    // ---- questions ----
    case 'enemies': case 'whereop': {
      if (c.intent === 'whereop') { const m = others.find(q => names(q) === c.op); if (m && m.alive) { say(first, 'ansMate', { name: names(m), place: place(game, m.x, m.y) }); return c; } }
      for (const id of game.spots[team].keys()) { const q = game.players.get(id); if (q && q.alive && (c.intent === 'enemies' || names(q) === c.op)) { say(first, 'ansEnemy', { op: opName(q), place: place(game, q.x, q.y) }); return c; } }
      if (ts.lastSeen && t - ts.lastSeen.t < 25) say(first, 'ansEnemy', { op: ts.lastSeen.op, place: ts.lastSeen.place }); else say(first, 'ansNone');
      return c; }
    case 'count': say(first, 'ansCount', { n: NUM_WORD(players.filter(q => q.squad !== p.squad && q.alive).length), n2: NUM_WORD(players.filter(q => q.squad === p.squad && q.alive).length) }); return c;
    case 'time': say(first, 'ansTime', { n: NUM_WORD(Math.ceil(game.planted ? game.planted.t : game.timer)) }); return c;
    case 'status': say(first, 'ansStatus', { n: NUM_WORD(Math.ceil(first.hp)) }); return c;
    case 'whereyou': say(first, 'ansWhere', { place: place(game, first.x, first.y) }); return c;
    case 'plan': { const pl = first.pro && proState(game, first.squad).plan; if (pl) say(first, 'ansPlan', { plan: pl.name }); else say(first, 'ansNoPlan'); return c; }
    case 'carrier': {
      if (team === TEAM.DEF) { say(first, 'ansThey'); return c; }
      const has = players.find(q => q.squad === p.squad && q.hasDefuser && q.alive);
      if (has === p) say(first, 'ansYouHave'); else if (has === first) say(first, 'ansCarrierMe'); else if (has) say(first, 'ansCarrier', { name: clean(has.name) }); else say(first, 'ansNoCarrier');
      return c; }
    case 'site': if (siteKnown) say(first, 'ansSite', { place: place(game, b0.x, b0.y) }); else say(first, 'ansSiteNo'); return c;
    case 'go': if (siteKnown) say(first, 'ansGo', { place: place(game, b0.x, b0.y) }); else say(first, 'ansGo', { place: place(game, bots[bots.length - 1].x, bots[bots.length - 1].y) }); return c;
    // ---- a place ----
    case 'goto': case 'watch': {
      if (!spot) { say(first, c.site ? 'ansSiteNo' : 'huh'); return c; }
      for (const q of targets) order(q, 'goto', 120, { x: spot.x, y: spot.y, stay: c.intent === 'watch' ? 40 : 25 }); // (a big map takes a while to cross)
      ackAll(c.intent === 'watch' ? 'ansWatch' : 'ansGoto', { place: where });
      return c; }
    case 'report': {
      const at = room ? roomPoint(game, room) : null; if (!at) { say(first, 'huh'); return c; }
      ts.lastSeen = { op: c.op || 'One', place: where, t };
      for (const q of bots) if (q.ai) q.ai.heard = { x: at.x, y: at.y, t };
      const help = asked[0] || bots[0]; if (!waiting(help)) order(help, 'goto', 60, { x: at.x, y: at.y, stay: 15 });
      say(help, 'ansThanksInfo');
      return c; }
    // ---- orders ----
    case 'follow': case 'regroup': for (const q of targets) order(q, 'follow', 40); ackAll(c.intent === 'regroup' ? 'ansRegroup' : 'ansFollow'); return c;
    case 'help': case 'revive': { const two = asked.length ? asked : c.all ? bots : bots.slice(0, 2); for (const q of two) order(q, 'follow', 20); say(two[0], 'ansHelp'); return c; }
    case 'hold': for (const q of targets) order(q, 'hold', 40); ackAll('ansHold'); return c;
    case 'cancel': for (const q of targets) if (q.ai) q.ai.cmd = null; say(targets[0], 'ansDrop'); return c;
    case 'push': {
      const foe = [...game.spots[team].keys()].map(id => game.players.get(id)).find(q => q && q.alive);
      const pt = foe ? { x: foe.x, y: foe.y } : team === TEAM.ATK && siteKnown ? { x: b0.x, y: b0.y } : null;
      if (first.pro && team === TEAM.ATK) proState(game, first.squad).gone = true;
      for (const q of targets) { if (!q.ai) continue; q.ai.cmd = null; q.ai.startWait = 0; q.ai.pauseT = 99; if (pt) order(q, 'goto', 90, { x: pt.x, y: pt.y }); }
      ackAll('ansPush'); return c; }
    case 'flank': for (const q of targets) { const f = flankPoint(game, q, site); if (f) order(q, 'goto', 90, { x: f.x, y: f.y }); } ackAll('ansFlank'); return c;
    case 'fallback': {
      if (team === TEAM.DEF) for (const q of targets) order(q, 'goto', 90, { x: b0.x, y: b0.y, stay: 25 }); else for (const q of targets) order(q, 'follow', 25);
      ackAll('ansBack'); return c; }
    case 'plant': {
      if (team === TEAM.DEF) { say(first, 'ansWrongSide'); return c; }
      if (game.planted) { say(first, 'ansDrop'); return c; }
      if (p.hasDefuser) { say(first, 'ansYouHave'); return c; }
      const has = bots.find(q => q.hasDefuser); if (!has) { say(first, 'ansNoCarrier'); return c; }
      order(has, 'goto', 90, { x: b0.x, y: b0.y, drop: 40 }); say(has, waiting(has) ? 'ansPrep' : 'ansPlant'); return c; }
    case 'defuse': {
      if (team === TEAM.ATK) { say(first, 'ansWrongSide'); return c; }
      if (!game.planted) { say(first, 'ansNotPlanted'); return c; }
      const pos = game.planted.x !== undefined ? game.planted : b0;
      order(first, 'goto', 90, { x: pos.x, y: pos.y, drop: 40 }); say(first, 'ansDefuse'); return c; }
    case 'smoke': case 'stun': case 'frag': {
      const thrower = [...asked, ...bots].find(q => q.gadget === c.intent && q.gadgetCount > 0);
      if (!thrower || inPrep) { say(first, thrower ? 'ansPrep' : 'ansNoUtil'); return c; }
      const aim = spot || (p.aimX !== undefined ? { x: p.aimX, y: p.aimY } : { x: p.x, y: p.y });
      aimAt(thrower, aim.x, aim.y); game.event(thrower, { k: 'gadget' });
      say(thrower, 'ansUtil', { util: c.intent === 'stun' ? 'flash' : c.intent }); return c; }
    case 'reinforce': {
      if (team === TEAM.ATK) { say(first, 'ansWrongSide'); return c; }
      if (!inPrep) { say(first, 'ansLate'); return c; }
      first.ai = first.ai || {}; const ts = first.ai.tasks || (first.ai.tasks = []); for (let i = 0; i < 2; i++) ts.push({ x: first.x, y: first.y, pick: () => reinforceTarget(game), wait: DUR.reinforce }); say(first, 'ansReinforce'); return c; }
    case 'drone': {
      if (team === TEAM.DEF) { say(first, 'ansWrongSide'); return c; }
      const pilot = [...asked, ...bots].find(q => q.ctrl === 'drone'); if (!pilot) { say(first, 'ansNoDrone'); return c; }
      if (spot && pilot.ai) { pilot.ai.droneGoal = spot; pilot.ai.droneGoalT = 25; pilot.ai.dPath = null; pilot.ai.dHide = false; say(pilot, 'ansDrone', { place: where }); } else say(pilot, 'ack');
      return c; }
    // ---- talk ----
    case 'quiet': ts.hushUntil = t + 12; say(first, 'ansQuiet'); return c;
    case 'talk': ts.hushUntil = 0; say(first, 'ansTalk'); return c;
    case 'thanks': if (Math.random() < 0.6) say(first, 'ansThanks'); return c;
    case 'hello': say(first, 'ansHello'); return c;
    case 'sorry': say(first, 'ansSorry'); return c;
    case 'insult': say(first, 'ansInsult'); return c;
    default: say(first, 'ack'); return c;
  }
}
// the end of a round: someone says something about it
export function roundChat(game, winner) {
  if (game.tut) return;
  for (const sq of [0, 1]) { const m = [...game.players.values()].filter(q => q.bot && q.squad === sq); if (m.length && Math.random() < 0.6) talk(game, m[Math.floor(Math.random() * m.length)], sq === winner ? 'roundWon' : 'roundLost'); }
}
function botCmd(game, p, inp, dt) {
  const c = p.ai.cmd, o = game.players.get(c.id);
  if (game.phase === PHASE.PREP && (p.staged || p.ctrl === 'drone')) return false; // told during prep: done once the round starts
  if (game.time > c.until || (game.phase !== PHASE.ACTION && game.phase !== PHASE.PREP) || p.downed || !o || (c.k !== 'goto' && !o.alive)) { p.ai.cmd = null; return false; }
  if (c.k === 'hold') { checkAngles(game, p, dt); inp.crouch = 1; return true; }
  if (c.k === 'goto') {
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < (c.drop || 1.5 * PX_PER_M)) { if (!c.stay) { p.ai.cmd = null; return false; } if (!c.there) { c.there = true; c.until = game.time + c.stay; } checkAngles(game, p, dt); return true; }
    moveTo(game, p, inp, c, dt); return true;
  }
  if (Math.hypot(o.x - p.x, o.y - p.y) > 2.5 * PX_PER_M) moveTo(game, p, inp, o, dt); else checkAngles(game, p, dt);
  return true;
}
// a kill or a death: the high ranks are good to each other, the lowest are funny about it
export function kindWords(game, q, src) {
  const near = o => o.bot && o.alive && !o.downed && Math.hypot(o.x - q.x, o.y - q.y) < 20 * PX_PER_M;
  const say = (team, cat) => { const m = [...game.players.values()].filter(o => o !== src && o !== q && o.squad === team && near(o)); if (m.length && Math.random() < 0.3) talk(game, m[Math.floor(Math.random() * m.length)], cat); };
  const rankOf = o => (o.pro ? 7 : lvlOf(game, o));
  if (q.bot && (rankOf(q) >= 4 || rankOf(q) <= 1)) say(q.squad, 'nt');
  if (src && src.bot && rankOf(src) >= 4) say(src.squad, 'nice');
}
export function proSay(game, p, text, key, prio = false) {
  if (!p || !p.pro) return;
  if (!talkAllowed(game, p, 'heard')) return;
  const t = game.time, team = (game.proSaid || (game.proSaid = {}))[p.squad] || (game.proSaid[p.squad] = { keys: {}, last: 0 });
  if (key && t - (team.keys[key] ?? -99) < 8) return; // a teammate just said it
  if (!prio && (t - (p.saidT ?? -99) < 12 || t - team.last < 5)) return; // not constant chatter (he asked: less)
  if (key) team.keys[key] = t; p.saidT = t; team.last = t;
  (game.proLog || (game.proLog = [])).push({ round: game.round, squad: p.squad, team: p.pro.tag, text, who: p.pro.pl.name });
  game.chat(p, { text: text.slice(0, 140), team: true });
}
export function assignPros(game) {
  const on = game.botLevel === PRO_LEVEL && !game.tut;
  for (const squad of [0, 1]) {
    const bots = [...game.players.values()].filter(q => q.bot && q.squad === squad).sort((a, b) => +a.id.slice(1) - +b.id.slice(1));
    const team = PRO_TEAMS[squad];
    bots.forEach((b, i) => {
      if (!b.baseName) b.baseName = b.name;
      if (on && i < team.players.length) { const pl = team.players[i]; b.pro = { team: team.id, tag: team.tag, i, pl }; b.name = `[${team.tag}] ${pl.name}`; const pp = PERSONA[pl.name]; b.persona = { aggr: pp[0], patience: pp[1] }; }
      else if (b.pro) { b.pro = null; b.name = b.baseName; b.persona = null; }
    });
  }
}
// A pro aims with a mouse on a mousepad (he asked). The hand moves at most at its own speed; how far the aim turns for
// a centimetre of hand depends on the player's sensitivity; the hand can't go past the pad's edge, so a long turn (a 180
// on a low sensitivity) means lifting the mouse and putting it back (~0.15 s with no turning); a long flick overshoots
// (more on a high sensitivity) and has to come back; and the hand never holds perfectly still (worse on a high one).
function mouseTurn(p, a, rate, dt) {
  const ai = p.ai, M = p.pro.pl.mouse, k = 2 * Math.PI / M.cm360; // radians per cm of hand
  if (ai.hand === undefined) { ai.hand = 0; ai.lift = 0; ai.over = 0; }
  // the hand is never perfectly still: a slow, smooth drift (not a new random twitch every tick, which made their view shake)
  if ((ai.wobN = (ai.wobN ?? 0) - dt) <= 0) { ai.wobN = 0.25 + Math.random() * 0.35; ai.wobTgt = (Math.random() - 0.5) * M.steady * k * 2.5; }
  const wobTo = (ai.wobO || 0) + ((ai.wobTgt || 0) - (ai.wobO || 0)) * Math.min(1, dt * 5), wob = wobTo - (ai.wobO || 0); ai.wobO = wobTo;
  if (ai.lift > 0) { ai.lift -= dt; if (ai.lift <= 0) ai.hand = -Math.sign(ai.liftDir) * M.pad * 0.35; p.aim += wob; return; }
  let diff = angDiff(a, p.aim);
  const cm = diff / k; // how far the hand must go
  if (Math.abs(cm) > 6 && !ai.flick) { ai.flick = true; ai.over = Math.sign(cm) * Math.min(Math.abs(cm) * 0.06, 2.5) * (30 / M.cm360) * (0.5 + Math.random()); } // a long flick lands a bit past the target
  if (Math.abs(cm) < 1.5) ai.flick = false;
  const want = cm + ai.over; ai.over *= Math.exp(-dt * 6); // ...then comes back
  const speed = M.hand * Math.max(0.2, Math.min(1, rate / 10)); // slow looking round uses a slow hand
  let move = Math.max(-speed * dt, Math.min(speed * dt, want * Math.min(1, dt * 14)));
  if (Math.abs(ai.hand + move) > M.pad / 2) { // out of mousepad: lift it and put it back
    move = Math.sign(move) * Math.max(0, M.pad / 2 - Math.abs(ai.hand));
    ai.lift = 0.12 + Math.random() * 0.06; ai.liftDir = Math.sign(want);
  }
  ai.hand += move; p.aim += move * k + wob;
}
function proSkill(p) { // human limits, per player; under pressure (hurt) a nervous player gets slower and shakier
  const pl = p.pro.pl, press = p.hp < p.maxHp * 0.45 ? 1 - pl.calm : 0;
  return { react: Math.max(0.17, pl.react - 0.03) + press * 0.08, reactX: 0.05, expect: Math.max(0.17, pl.react * 0.85), turn: pl.turn, err: pl.aim * (1 + press * 0.7), settle: 10, shake: 0.5, tol: 0.1, see: 850, body: 5, head: (0.8 - pl.aim * 0.2) * (1 - press * 0.4), drone: 0.22 };
}
const proSide = (game, p) => (game.side(p) === TEAM.ATK ? 'atk' : 'def');
function proState(game, squad) {
  const all = game.proState || (game.proState = {});
  let st = all[squad];
  if (!st || st.round !== game.round || st.map !== game.map.id) st = all[squad] = { round: game.round, map: game.map.id, plan: null, go: 0, calls: [] };
  return st;
}
function proPlan(game, squad, side) {
  const st = proState(game, squad);
  if (!st.plan || st.side !== side || st.site !== game.site) {
    const team = PRO_TEAMS[squad], list = playbook(game.map, game.site, side, team);
    if (!list.length) return st;
    const last = (game.proLast || {})[squad]; // don't run the same plan twice in a row after losing with it
    const w = game.proExplore ? (g => list.map((_, i) => (i === g ? 1 : 0)))(best(list.map(pl => plainGuess(planRecord(game.map.id, game.site, side, pl.id))))) // practice: new plays get tried, strong-looking ones chased
      : list.map((pl, i) => (pl.id === last ? 0.25 : 1) * (pl.id === 'turtle' ? 0.3 : 1) / (1 + i * 0.3) * planWeight(game.map.id, game.site, side, pl.id) ** 2); // the team's style, and what has won in practice
    let r = Math.random() * w.reduce((a, b) => a + b, 0), pick = list[0];
    for (let i = 0; i < list.length; i++) if ((r -= w[i]) <= 0) { pick = list[i]; break; }
    Object.assign(st, { plan: pick, side, site: game.site, go: Math.round((pick.go || 0) * DUR.action / 180), gone: false, swapped: false, rotate: null, retake: false, called: false });
    (game.proLast || (game.proLast = {}))[squad] = pick.id;
  }
  return st;
}
function proCall(game, squad, text, cat = null, slots = {}) { // the leader (or whoever is left) says it in team chat
  const mates = [...game.players.values()].filter(q => q.pro && q.squad === squad);
  const who = mates.find(q => q.pro.pl.igl && q.alive) || mates.find(q => q.alive) || mates[0];
  const st = proState(game, squad); st.calls.push({ t: game.time, text });
  (game.proLog || (game.proLog = [])).push({ round: game.round, squad, team: PRO_TEAMS[squad].tag, text });
  if (!who) return;
  if (cat && !talkAllowed(game, who, cat)) return; // nobody calls plays at someone clutching
  who.saidT = game.time;
  const c = cat && compose(writer(who), cat, slots, who.saidRecent || (who.saidRecent = []));
  game.chat(who, { text: (c ? c.text : text).slice(0, 140), team: true });
}
const HARD_BREACH = ['ember', 'rivet'];
export function proPickOp(game, p) {
  const side = proSide(game, p), pl = p.pro.pl, st = proPlan(game, p.squad, side), job = pl.jobs[side], j = st.plan && st.plan.jobs[job];
  // he asked: a wider variety of operators. Every operator of their job is in reach: their own favourites count double, what
  // won in practice counts more, and last round's pick less, so the same player plays several operators over a match.
  const all = opsForTeam(side === 'atk' ? TEAM.ATK : TEAM.DEF).filter(o => jobOf(o) === job), lastOp = (p.pro.lastOps || (p.pro.lastOps = {}))[side];
  const weigh = o => (pl.pool[side].includes(o) ? 2 : 1) * opWeight(game.map.id, side, o) ** 2 * (o === lastOp ? 0.35 : 1);
  const draw = list => { const out = [], left = list.map(o => [o, weigh(o)]); while (left.length) { let r = Math.random() * left.reduce((a, b) => a + b[1], 0), i = 0; while (i < left.length - 1 && (r -= left[i][1]) > 0) i++; out.push(left.splice(i, 1)[0][0]); } return out; };
  const mine = (training.pro[pl.name] || {}).ops || {};
  let pool = game.proExplore ? all.map(o => [o, plainGuess(training.ops[opKey(game.map.id, side, o)]) + (recGuess(mine[o]) - 0.5) * 0.5]).sort((a, b) => b[1] - a[1]).map(a => a[0]) // practice: try the unknown, chase what looks strong
    : game.proAnyOp ? all.sort(() => Math.random() - 0.5) : draw(all); // balance tests: any operator of their job
  if (side === 'atk' && job === 'breach' && j && j.breach != null && !(game.proExplore && Math.random() < 0.5)) pool = draw(pool.filter(o => HARD_BREACH.includes(o))).concat(pool.filter(o => !HARD_BREACH.includes(o))); // the plan opens a wall: a hard breacher, in case it is reinforced
  else if (side === 'atk' && job === 'breach' && j && j.hatch && !game.proExplore) pool.sort((a, b) => HARD_BREACH.includes(a) - HARD_BREACH.includes(b)); // a hatch: a soft one
  const rq = game.tv && game.tv.req && game.tv.req.find(o => all.includes(o)); if (rq) pool = [rq, ...pool.filter(o => o !== rq)]; // ESPORTS TV viewer request: this player plays it
  for (const op of pool) { game.pickOp(p, op); if (p.op === op) break; }
  if (!p.op) return false;
  p.pro.lastOps[side] = p.op;
  if (side === 'atk' && j && game.map.atkSpawns) { // spawn closest to where this player sets up
    const at = j.fake || j.hold || j.stack;
    if (at) p.spawn = game.map.atkSpawns.slice().sort((a, b) => Math.hypot(a.x - at.x, a.y - at.y) - Math.hypot(b.x - at.x, b.y - at.y))[0].name;
  }
  return true;
}
const best = xs => xs.reduce((bi, x, i) => (x > xs[bi] ? i : bi), 0);
// A pro's guns and attachments (he asked: they should find what is strong this patch). Every gun the operator has and
// every attachment that fits gets a guess from practice (all pros' results with it, that player's own counted double);
// the best guess wins. In practice the guesses are true to the numbers (so little-tried things get their turn); in real
// matches they are wider, so a pro still varies a bit.
export function proLoadout(game, p, op) {
  const L = LOADOUTS[op], me = training.pro[p.pro.pl.name] || {}, spread = game.proExplore ? 1 : 1.6;
  const pickGun = list => list.length ? list[best(list.map(w => recGuess(blend(training.guns[gunKey(op, w)], (me.guns || {})[w]), spread)))] : null;
  const l = { primary: pickGun(L.primaries), secondary: pickGun(L.secondaries), gadget: L.gadgets[Math.floor(Math.random() * L.gadgets.length)], att: {} };
  for (const w of [l.primary, l.secondary]) if (w && WEAPONS[w] && !RIOT[w]) {
    const ok = attachFor(w), a = l.att[w] = {};
    for (const slot of ['barrel', 'grip', 'sight', 'ammo']) a[slot] = ok[slot][best(ok[slot].map(c => recGuess(blend(training.att[attKey(w, slot, c)], (me.att || {})[attKey(w, slot, c)]), spread)))];
  }
  return cleanLoadout(op, l);
}
function proDroneGoal(game, p) { // preparation: find the objective first (nearest sites first), then this player's spot
  const m = game.map, side = proSide(game, p), st = proPlan(game, p.squad, side), j = st.plan && st.plan.jobs[p.pro.pl.jobs.atk];
  if (!game.siteRevealed) {
    const order = m.sites.map((s, i) => ({ i, b: s.bombs[0] })).sort((a, b) => Math.hypot(a.b.x - p.x, a.b.y - p.y) - Math.hypot(b.b.x - p.x, b.b.y - p.y));
    const s = m.sites[order[(p.pro.i + (p.ai.droneVisits || 0)) % order.length].i];
    const r = m.rooms.find(r => r.name === s.rooms[0]);
    if (r) return game.freeSpotNear((r.x + r.w / 2) * CELL, (r.y + r.h / 2) * CELL, Math.min(r.w, r.h) * CELL * 0.3);
  }
  const at = (j && (j.drone || j.target)) || m.sites[game.site].bombs[0];
  return game.freeSpotNear(at.x, at.y, 40);
}
const elapsedAction = game => DUR.action - game.timer;
const near = (a, b, d) => a && b && Math.hypot(a.x - b.x, a.y - b.y) < d;
function spottedNear(game, team, pt, r) { let n = 0; for (const id of game.spots[team].keys()) { const q = game.players.get(id); if (q && q.alive && near(q, pt, r)) n++; } return n; }
// the leader's read of the round, once a second
function proDirector(game, squad, st, team, el) {
  if (game.time - (st.dT || 0) < 1) return; st.dT = game.time;
  const plan = st.plan, mates = [...game.players.values()].filter(q => q.squad === squad), alive = mates.filter(q => q.alive && !q.downed).length, down = mates.length - alive;
  if (team === TEAM.ATK) {
    if (!st.called) { st.called = true; proCall(game, squad, `${plan.name}: ${plan.idea}`, 'plan', { plan: plan.name }); }
    if (st.gone || game.planted) return;
    if (el >= st.go) { st.gone = true; proCall(game, squad, 'Go!', 'go'); }
    else if (down >= 2) { st.go = el; st.gone = true; proCall(game, squad, 'Two down: we go now, together. Trade each other.', 'goDown'); }
    else if (game.timer < 55) { st.go = el; st.gone = true; proCall(game, squad, 'Running out of time: go now.', 'goClock'); }
    else if (!st.swapped && plan.ways.side && el > 8 && spottedNear(game, team, plan.ways.main.pos, 150) >= 2) {
      st.swapped = true; st.go = Math.min(st.go, el + 6); proCall(game, squad, 'They are stacked on our door: switch, everyone through the other way in 6.', 'swap');
    }
  } else {
    if (!st.called) { st.called = true; proCall(game, squad, `${plan.name}: ${plan.idea}`, 'plan', { plan: plan.name }); }
    if (game.planted) {
      if (!st.retake) { const near3 = mates.filter(q => q.alive && !q.downed && near(q, game.planted, 300)).length; if (near3 >= Math.min(3, alive) || game.planted.t < 30 || game.time - (st.plantSeen ?? (st.plantSeen = game.time)) > 8) { st.retake = true; proCall(game, squad, 'Retake now, all together, utility first.', 'retake'); } }
      return;
    }
    const hot = siteHot(game, team), ws = [plan.ways.main, plan.ways.side].filter(Boolean); // he asked: pros know rotations matter: one on the site or a teammate killed there is enough
    const hw = hot && ws.slice().sort((a, b) => Math.hypot(a.pos.x - hot.x, a.pos.y - hot.y) - Math.hypot(b.pos.x - hot.x, b.pos.y - hot.y))[0];
    for (const w of ws) if ((spottedNear(game, team, w.pos, 170) >= 2 || w === hw) && (!st.rotate || st.rotate.w !== w)) {
      st.rotate = { w, t: game.time, at: game.freeSpotNear(w.hold.x, w.hold.y, 20) }; proCall(game, squad, `Rotate: they are hitting ${w.kind === 'stairs' ? 'the stairs' : 'the ' + w.kind}.`, 'rotate', { way: WAYS.includes(w.kind) ? w.kind : 'door' }); break;
    }
  }
}
const eff = (st, j, key) => { // after a switch, whoever was going through the main way goes through the side one
  const w = st.plan.ways; if (!st.swapped || !w.side || !j[key]) return j[key];
  if (key === 'stack' && near(j.stack, w.main.stack, 4)) return w.side.stack;
  if (key === 'target' && near(j.target, w.main.inside, 4)) return w.side.inside;
  return j[key];
};
function breachAt(game, p, k) { // the plan's wall, set up like planBreach would (stand outside it, face it)
  const m = game.map, W = m.W, tool = breachTool(p); if (!tool || !BREACH_TOOLS[tool].types.includes(m.tiles[k])) return null;
  const site = m.sites[game.site], inSite = siteTest(m, site);
  for (const d of [1, -1, W, -W]) { const inK = k + d, out = k - d; if (!inSite(inK % W, Math.floor(inK / W)) || inSite(out % W, Math.floor(out / W))) continue;
    return { k, d, sx: (out % W + 0.5) * CELL, sy: (Math.floor(out / W) + 0.5) * CELL, wx: (k % W + 0.5) * CELL, wy: (Math.floor(k / W) + 0.5) * CELL, tool }; }
  return null;
}
// After the plant the attackers' job is the defuser (he asked: everything serves the objective): each takes a spot
// 4-10 m from it with a clear view of it, off the line of the ways in, away from teammates' spots, and holds it.
function postPlant(game, p, inp, dt, watch) {
  const ai = p.ai, m = game.map, pl = game.planted, W = m.W;
  if (!ai.pp || ai.ppFor !== pl) {
    const taken = [...game.players.values()].filter(q => q !== p && q.squad === p.squad && q.ai && q.ai.pp).map(q => q.ai.pp);
    const cx = Math.floor(pl.x / CELL), cy = Math.floor(pl.y / CELL); let best = null, bs = Infinity;
    for (let dy = -10; dy <= 10; dy++) for (let dx = -10; dx <= 10; dx++) {
      const k = (cy + dy) * W + cx + dx; if (k < 0 || k >= m.tiles.length || m.tiles[k] !== T.FLOOR && m.tiles[k] !== T.GROUND) continue;
      const x = (cx + dx + 0.5) * CELL, y = (cy + dy + 0.5) * CELL, d = Math.hypot(x - pl.x, y - pl.y) / CELL;
      if (d < 4 || d > 10 || !los(m, x, y, pl.x, pl.y) || floorAt(m, x, y) !== floorAt(m, pl.x, pl.y)) continue;
      const cover = [1, -1, W, -W].some(o => blocksMove(m.tiles[k + o])) ? -2 : 0, crowd = taken.some(t => Math.hypot(t.x - x, t.y - y) < 90) ? 6 : 0;
      const sc = Math.abs(d - 6.5) + cover + crowd + Math.hypot(x - p.x, y - p.y) / CELL * 0.15 + Math.random();
      if (sc < bs) { bs = sc; best = { x, y }; }
    }
    ai.pp = best || game.freeSpotNear(pl.x, pl.y, 80); ai.ppFor = pl;
  }
  if (!near(p, ai.pp, 12)) { moveTo(game, p, inp, ai.pp, dt); inp.walk = near(p, ai.pp, 150) ? 1 : 0; return true; }
  watch(pl, true); return true;
}
// Spread out (he asked: one grenade, gas cloud or charge can take out a whole stack): around the plan's spot each player
// takes their own, at least gap px from teammates' spots, still in sight of the plan's spot (same side of the walls).
// A fast rush packs tighter (speed matters more), a slow setup spreads wider.
function spreadSpot(game, p, base, gap, look = null) {
  const ai = p.ai, key = Math.round(base.x) + ',' + Math.round(base.y), off = ai.spreadOff || { x: 0, y: 0 };
  if (ai.spreadKey === key && ai.spread) return ai.spread;
  const m = game.map, taken = [...game.players.values()].filter(q => q !== p && q.squad === p.squad && q.alive && q.ai && q.ai.spread).map(q => q.ai.spread);
  let best = null, bs = Infinity;
  for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
    const x = base.x + dx * CELL, y = base.y + dy * CELL, k = Math.floor(y / CELL) * m.W + Math.floor(x / CELL);
    if (k < 0 || k >= m.tiles.length || blocksMove(m.tiles[k]) || m.tiles[k] === T.BARRI || floorAt(m, x, y) !== floorAt(m, base.x, base.y)) continue;
    if ((dx || dy) && !los(m, base.x, base.y, x, y)) continue;
    let crowd = taken.reduce((n, t) => n + (Math.hypot(t.x - x, t.y - y) < gap ? 1 : 0), 0);
    if (look) for (const t of taken) { // on one line from the watched spot: one burst hits both (he asked)
      const d = Math.hypot(x - look.x, y - look.y) || 1, ux = (x - look.x) / d, uy = (y - look.y) / d, ax = t.x - look.x, ay = t.y - look.y;
      if (ax * ux + ay * uy > 20 && Math.abs(ax * uy - ay * ux) < 18) crowd++;
    }
    const sc = crowd * 100 + Math.hypot(dx - off.x, dy - off.y) + Math.random() * 0.5 + (ai.spreadFrom && Math.hypot(x - ai.spreadFrom.x, y - ai.spreadFrom.y) < 48 ? 40 : 0); // a re-pick really moves
    if (sc < bs) { bs = sc; best = { x, y }; }
  }
  ai.spreadKey = key; ai.spread = best || base; return ai.spread;
}
// One pro's part of the plan this tick. true: handled (movement set); false: the ordinary bot behaviour carries on.
const site0 = game => game.map.sites[game.site];
function proAct(game, p, inp, dt, team) {
  const side = team === TEAM.ATK ? 'atk' : 'def', st = proPlan(game, p.squad, side), plan = st.plan; if (!plan) return false;
  const ai = p.ai, j = plan.jobs[p.pro.pl.jobs[side]] || plan.jobs[jobOf(p.op)]; if (!j) return false;
  const action = game.phase === PHASE.ACTION, el = action ? elapsedAction(game) : -1, S = skill(game, p), name = p.pro.pl.name;
  if (action) proDirector(game, p.squad, st, team, el);
  else if (!st.called && game.phase === PHASE.PREP && side === 'def') { st.called = true; proCall(game, p.squad, `${plan.name}: ${plan.idea}`, 'plan', { plan: plan.name }); }
  const watch = (pt, crouch) => { // hold an angle like a person: a noise first, now and then the other ways in, else the job's angle
    if (ai.heard && game.time - ai.heard.t < 2.5) pt = ai.heard;
    else { if ((ai.chkT = (ai.chkT ?? 3 + Math.random() * 3) - dt) <= 0) { ai.chkT = 3 + Math.random() * 4; ai.chk = Math.random() < 0.4 ? threatPoint(game, p, p.aim + (Math.random() - 0.5) * 3) : null; ai.chkUntil = game.time + 1.2; }
      if (ai.chk && game.time < ai.chkUntil) pt = ai.chk; }
    pt = angleOn(game, p, pt); if (pt) turnTo(p, Math.atan2(pt.y - p.y, pt.x - p.x), S.turn * 0.6, dt); inp.crouch = crouch ? 1 : 0; // he asked: crosshair placement matters most — held still on the spot, no drifting
    // map knowledge: each new spot held leaning out from the cover beside it, or (defence) lying down at a deep angle
    const K = know(game, p), at = Math.round(p.x / 24) + ',' + Math.round(p.y / 24);
    if (ai.poseAt !== at) { ai.poseAt = at; ai.leanS = Math.random() < K.lean ? leanSide(game, p, p.aim) : 0; ai.proneH = side === 'def' && crouch && !ai.leanS && Math.random() < K.prone * 1.5; if (ai.leanS) feat(p, 'lean'); if (ai.proneH) feat(p, 'prone'); }
    if (ai.leanS) inp.lean = ai.leanS;
    if (ai.proneH) { inp.prone = 1; inp.crouch = 0; }
  };
  const trade = game.proTrade && game.proTrade[p.squad]; // a teammate just died close by: swing onto where it came from
  const objectiveFirst = (team === TEAM.ATK && game.planted) || (team === TEAM.DEF && !game.planted && p.pro.pl.jobs.def === 'anchor'); // he asked: everything in service of the objective
  if (trade && !objectiveFirst && game.time - trade.t < 4 && near(p, trade, 320) && !near(p, trade, 20)) { moveTo(game, p, inp, trade.from || trade, dt); inp.walk = near(p, trade, 120) ? 1 : 0; return true; }
  if (side === 'atk') {
    if (action && game.planted) return postPlant(game, p, inp, dt, watch); // the objective now: protect the defuser
    if (!action || ai.inSite) return false;
    if (p.hasDefuser && site0(game).bombs.some(b => near(p, b, 130)) && !visibleEnemy(game, p, skill(game, p).see)) { ai.inSite = true; return false; } // the carrier at the site with nobody in sight: plant now (he asked: play for the plant)
    if (game.timer < 35) return false; // the clock: forget the plan, everyone to the bomb
    const dropped = game.ents.find(e => e.type === 'defuser');
    if (dropped) { const mates = [...game.players.values()].filter(q => q.alive && !q.downed && q.squad === p.squad); const nearest = mates.sort((a, b) => Math.hypot(a.x - dropped.x, a.y - dropped.y) - Math.hypot(b.x - dropped.x, b.y - dropped.y))[0]; if (nearest === p) return false; } // the closest one fetches a dropped defuser
    const go = st.go + (j.delay || 0) + (TIMING[name] || 0);
    if (j.breach != null && !ai.breachDone && el >= st.go - 7) { // open the wall just before the push
      if (ai.breachB === undefined) { ai.breachB = breachAt(game, p, j.breach); const tool = breachTool(p); if (!ai.breachB && tool && !BREACH_TOOLS[tool].types.includes(T.REINF)) { ai.breachB = planBreach(game, p, tool); if (ai.breachB) ai.breachB.tool = tool; } }
      if (ai.breachB) { const r = doBreach(game, p, inp, ai.breachB, dt); if (r !== 'done') return true; }
      ai.breachDone = true;
    }
    if (j.hatch && !ai.hatchDone && el >= st.go - 8) { // open the hatch above the site: swing at it from on top
      const h = game.map.hatches.find(h => near(h, j.hatch, 4));
      if (!h || game.map.tiles[h.cells[0]] === T.HOLE) ai.hatchDone = true;
      else { if (!near(p, h, 10)) { moveTo(game, p, inp, h, dt); return true; } inp.crouch = 1; if (p.meleeCd <= 0) game.event(p, { k: OPERATORS[p.op].ability.id === 'hammer' ? 'ability' : 'melee' }); return true; }
    }
    if (j.fake && el < go) { // make noise at the other way in: break things, throw utility, then go round
      if (!near(p, j.fake, 16)) { moveTo(game, p, inp, j.fake, dt); return true; }
      const w = plan.ways.side; watch(w && w.pos, false);
      if (el > st.go - 20 && w) { aimAt(p, w.pos.x, w.pos.y); if (Math.random() < dt * 3) inp.fire = 1; if (!ai.fakeNade && p.gadgetCount > 0 && ['stun', 'smoke', 'frag'].includes(p.gadget)) { ai.fakeNade = true; game.event(p, { k: 'gadget' }); } }
      return true;
    }
    const holdUntil = (j.until || 0) + (TIMING[name] || 0);
    if (el < go || (j.hold && el < holdUntil)) { // set up: quiet at the end, then hold an angle on the way in
      const spot = spreadSpot(game, p, j.hold && el < holdUntil ? j.hold : eff(st, j, 'stack'), st.plan.tempo === 'fast' ? 40 : 64, eff(st, j, 'target'));
      if (!near(p, spot, 14)) { moveTo(game, p, inp, spot, dt); if (near(p, spot, 260)) inp.walk = 1; return true; }
      // he asked: two pros stood in one spot for over a minute, saying and doing nothing. While waiting they work the
      // area: every so often another spot round the stack (a new angle, clearing the corners), and a word to the team.
      if ((ai.waitT = (ai.waitT ?? 6 + Math.random() * 5) - dt) <= 0) {
        ai.waitT = 7 + Math.random() * 5; ai.spreadOff = { x: Math.round((Math.random() - 0.5) * 10), y: Math.round((Math.random() - 0.5) * 10) }; ai.spread = null; ai.spreadFrom = { x: p.x, y: p.y }; // (Kaze and Brick looked stuck waiting: now a real new spot every 7-12 s)
        if (!game.spots[team].size && Math.random() < 0.2) talk(game, p, 'quiet', { place: place(game, p.x, p.y) }, 'wait' + place(game, p.x, p.y));
      }
      if (j.clear != null && el > go - 9 && game.map.tiles[j.clear] === T.BARRI) { // a boarded window: shoot the boards off from the stack (as R6 teams do) instead of hitting them three times in the open
        const W = game.map.W, cx = (j.clear % W + 0.5) * CELL, cy = (Math.floor(j.clear / W) + 0.5) * CELL; aimAt(p, cx, cy); inp.ads = 1;
        const gun = p.guns[p.slot]; if (gun && gun.ammo === 0) game.startReload(p); else shootInput(inp, ai, gun); return true;
      }
      watch(eff(st, j, 'target'), true); return true;
    }
    if (!ai.utilDone) { // utility in first
      ai.utilDone = true; const tg = eff(st, j, 'target'), abId = OPERATORS[p.op].ability.id;
      if (abId === 'sonar' && p.abilityCount > 0) { aimAt(p, tg.x, tg.y); game.event(p, { k: 'ability' }); } // GLINT: a pulse into the room before the push (the pros never threw it: 37% of rounds won)
      if (j.util === 'stun' && p.gadget === 'stun' && p.gadgetCount > 0) { aimAt(p, tg.x, tg.y); game.event(p, { k: 'gadget' }); talk(game, p, 'stun', {}, 'util'); }
      if (j.util === 'smoke') { aimAt(p, tg.x, tg.y); talk(game, p, 'smoke', {}, 'util'); if (abId === 'barrage' && p.abilityCount > 0) game.event(p, { k: 'ability' }); else if (p.gadget === 'smoke' && p.gadgetCount > 0) game.event(p, { k: 'gadget' }); }
    }
    const tg = eff(st, j, 'target');
    if (!near(p, tg, 18) && !(ai.tgT = (ai.tgT || 0) + dt, ai.tgT > 25)) { moveTo(game, p, inp, tg, dt); return true; }
    ai.inSite = true; if (j.plant) ai.bomb = j.plant; if (!['default', 'fast'].includes(plan.id)) feat(p, 'clever'); // (another way in than the obvious one: map knowledge) in: the ordinary push to the bomb, plant, hold
    return false;
  }
  // defence
  if (game.planted) {
    if (st.retake) return false; // all in: the ordinary defuse
    const stage = ai.stage || (ai.stage = game.freeSpotNear(game.planted.x + (p.x - game.planted.x) * 0.5, game.planted.y + (p.y - game.planted.y) * 0.5, 40));
    if (!near(p, stage, 14) && !near(p, game.planted, 200)) { moveTo(game, p, inp, stage, dt, true); return true; }
    watch(game.planted, true); return true;
  }
  const rot = st.rotate && game.time > st.rotate.t + (ROTATE_DELAY[name] ?? 0) && p.pro.pl.jobs.def !== 'anchor' ? st.rotate : null;
  const roaming = action && j.roam && el < (j.until || 0) + (TIMING[name] || 0) && !rot;
  if (!roaming && (ai.reposT = (ai.reposT ?? 16 + Math.random() * 14) - dt) <= 0) { ai.reposT = 18 + Math.random() * 16; ai.spreadOff = { x: Math.round((Math.random() - 0.5) * 4), y: Math.round((Math.random() - 0.5) * 4) }; ai.spread = null; } // a new angle now and then
  const spot = roaming ? (ai.roamAt || (ai.roamAt = game.freeSpotNear(j.roam.x, j.roam.y, 50))) : spreadSpot(game, p, rot ? rot.at : j.hold, 72, rot ? rot.w.pos : j.watch); // defenders don't bunch either
  if (!near(p, spot, 14)) { moveTo(game, p, inp, spot, dt, true); if (roaming && near(p, spot, 200)) inp.walk = 1; return true; }
  if (!roaming && !rot && !ai.offF) { ai.offF = 1; feat(p, 'offAngle'); } // the plan's holds are the off-angles on the ways in (siteIntel)
  watch(rot ? rot.w.pos : j.watch, !roaming); return true;
}

// FUN MODES (server/arena.js): bots hunt. They fight whoever they see (same reaction and aim as their rank), knife when
// that's all they have (or the target is close in One in the Chamber), otherwise head for the nearest enemy they
// heard or, now and then, any enemy on the map (people in these modes come to the fight), and wander when alone.
export function arenaThink(game, p, dt) {
  const ai = p.ai, inp = { up: 0, down: 0, left: 0, right: 0, walk: 0, crouch: 0, fire: 0, ads: 0, interact: 0, ability: 0 };
  p.input = inp;
  if (!p.alive || p.ctrl !== 'body') return;
  const S = skill(game, p), A = game.arena || {}, gun = p.guns[p.slot]; // (also the bots helping in Zombies)
  const knifeOnly = !gun || (gun.ammo === 0 && gun.reserve === 0 && !(p.reloadT > 0)) || (p.ar && (p.ar.infected || p.ar.knife));
  // hearing: shots and footsteps of anyone not on our side
  const team = game.side(p);
  for (const n of game.noises || []) {
    if (n.team === team || game.time - n.t > 1.5 || (ai.heard && ai.heard.t >= n.t)) continue;
    if (Math.hypot(n.x - p.x, n.y - p.y) < n.r * EAR[lvlOf(game, p)] && floorAt(game.map, n.x, n.y) === floorAt(game.map, p.x, p.y)) ai.heard = { x: n.x, y: n.y, t: game.time };
  }
  const enemy = visibleEnemy(game, p, S.see);
  if (enemy) {
    const d = Math.hypot(enemy.x - p.x, enemy.y - p.y);
    if (ai.seen !== enemy.id) { ai.seen = enemy.id; ai.seenT = game.time; ai.react = -S.react - Math.random() * S.reactX; ai.err = (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.4) * S.err; }
    ai.react += dt; ai.err *= Math.exp(-dt * S.settle); ai.err += (Math.random() - 0.5) * dt * 0.6 * (S.shake ?? 1);
    const want = Math.atan2(enemy.y - p.y, enemy.x - p.x) + ai.err;
    turnTo(p, want, S.turn, dt);
    p.aimX = p.x + Math.cos(p.aim) * d; p.aimY = p.y + Math.sin(p.aim) * d;
    ai.hunt = { x: enemy.x, y: enemy.y };
    const close = d < 26;
    if (knifeOnly || (A.mode === 'oitc' && d < 60)) { // run them down and swing
      if (close) { p.aim = Math.atan2(enemy.y - p.y, enemy.x - p.x); game.event(p, { k: 'melee' }); }
      else moveTo(game, p, inp, enemy, dt);
      if (!knifeOnly && d > 40) inp.walk = 0;
      return;
    }
    if (gun.ammo === 0) { game.startReload(p); return; }
    if (A.mode === 'oitc' && d > 10 * PX_PER_M) { moveTo(game, p, inp, enemy, dt); inp.walk = 1; return; } // one bullet: close in for the sure shot
    inp.ads = d > 90 ? 1 : 0;
    if (ai.react > 0 && Math.abs(angDiff(want, p.aim)) < S.tol) shootInput(inp, ai, gun);
    ai.strafeT = (ai.strafeT || 0) - dt;
    if (ai.strafeT <= 0) { ai.strafeT = 0.5 + Math.random(); ai.strafe = Math.random() < 0.5 ? (Math.random() < 0.5 ? -1 : 1) : 0; }
    if (ai.strafe) { const sa = p.aim + Math.PI / 2 * ai.strafe; setDir(inp, Math.cos(sa), Math.sin(sa)); inp.walk = 1; }
    else if (d > 200) { setDir(inp, Math.cos(p.aim), Math.sin(p.aim)); inp.walk = 1; }
    return;
  }
  ai.seen = null;
  if (gun && gun.ammo < WEAPONS[gun.w].mag && gun.reserve > 0 && !(p.reloadT > 0)) game.startReload(p);
  // Zombies: a teammate down nearby gets picked up (hold E beside them)
  if (game.zb) {
    const mate = [...game.players.values()].filter(q => q !== p && !q.zombie && q.alive && q.downed && q.squad === p.squad).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    if (mate && Math.hypot(mate.x - p.x, mate.y - p.y) < 20 * PX_PER_M) {
      if (Math.hypot(mate.x - p.x, mate.y - p.y) < 20) { p.aim = Math.atan2(mate.y - p.y, mate.x - p.x); inp.interact = 1; } else moveTo(game, p, inp, mate, dt);
      return;
    }
    // otherwise stay with the people: not too far from the nearest person who isn't a bot
    const lead = [...game.players.values()].find(q => !q.bot && q.alive);
    if (lead && Math.hypot(lead.x - p.x, lead.y - p.y) > 6 * PX_PER_M) { moveTo(game, p, inp, lead, dt); return; }
  }
  // where to go: something heard, else every ~8 s a fresh enemy to hunt (the nearest, sometimes another), else a wander
  if (ai.heard && game.time - ai.heard.t < 6) ai.hunt = { x: ai.heard.x, y: ai.heard.y };
  // Infected survivors (not bots alone in zombies): find a room and hold it, facing the way in, like people do
  if (A.mode === 'infected' && p.ar && !p.ar.infected) {
    if (!ai.hold || ai.holdLife !== p.respawnAt) { const rs = game.map.rooms; ai.hold = roomPoint(game, rs[Math.floor(Math.random() * rs.length)]); ai.holdLife = p.respawnAt; }
    if (ai.hold && Math.hypot(ai.hold.x - p.x, ai.hold.y - p.y) > 20) moveTo(game, p, inp, ai.hold, dt);
    else { inp.crouch = 1; checkAngles(game, p, dt); }
    return;
  }
  // where to go: something heard, else a room to look through (people don't know where everyone is); the infected,
  // and now and then anyone, head for the area round an enemy (the infected hunt by instinct)
  if (!ai.hunt || game.time > (ai.huntT || 0) || Math.hypot(ai.hunt.x - p.x, ai.hunt.y - p.y) < 30) {
    ai.huntT = game.time + 8 + Math.random() * 8;
    const foes = [...game.players.values()].filter(q => q.alive && q !== p && game.side(q) !== team).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
    const sense = (p.ar && p.ar.infected) || game.zb ? 1 : 0.25;
    const q = foes.length && Math.random() < sense ? foes[Math.random() < 0.7 ? 0 : Math.floor(Math.random() * foes.length)] : null;
    ai.hunt = q ? { x: q.x + (Math.random() - 0.5) * 320, y: q.y + (Math.random() - 0.5) * 320 } : roomPoint(game, game.map.rooms[Math.floor(Math.random() * game.map.rooms.length)]);
  }
  if (ai.hunt) moveTo(game, p, inp, ai.hunt, dt);
}
