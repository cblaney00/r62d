// Computer players. They are meant to feel like people: each one has a job for the round (a role, like a real
// team splits up: entry, support, flanker and intel on attack; anchors and roamers on defence) and a personality
// (how pushy and how patient), they use their operator's ability where a person would, revive and heal teammates,
// call out what they see, and react no faster than a fairly experienced player. The bot skill setting
// (game.botLevel, Easy / Normal / Hard / Expert) changes how fast they react and how well they aim, not what they know:
// they only know what they see, what they hear (running footsteps, gunfire, explosions) and what their team spots.
import { CELL, T, TEAM, PHASE, PX_PER_M, DUR, blocksMove, blocksDrone, underAt, stopsBullet, PRO_LEVEL, TOP_BOT, DEFAULT_LEVEL, SWARM } from '../shared/constants.js';
import { tileAt, los, angDiff, vaultable, castSight, walkRay, shapeAt, rayShape, rayCovers } from '../shared/physics.js';
import { floorAt, localPos, stairGhost, stairLooks, stairEnds, roomAt } from '../shared/map.js';
import { OPERATORS, WEAPONS, opsForTeam, JOBS, jobOf, hitR, HEAD_AIM } from '../shared/operators.js';
import { PRO_TEAMS, playbook, siteIntel } from '../shared/pros.js';
import { planWeight, opWeight } from './training.js';

// Per skill level. react: seconds before the first shot at someone who surprised them (plus up to reactX more);
// expect: the same when they were already listening for that enemy. turn: how fast they swing their aim (radians/s).
// err: how far off the first aim is; settle: how fast it closes in. tol: how close the aim must be before they fire.
// see: how far they notice people (px). body: how widely their aim point wanders over the body (px). head: how often they go for the head (shaky low ranks still rarely land it).
const SKILL = [ // the ranks (he asked): Copper, Bronze, Silver, Gold, Platinum, Diamond, Champion
  { react: 0.95, reactX: 0.6, expect: 0.6, turn: 3.5, err: 1.7, settle: 0.8, tol: 0.3, see: 460, body: 15, head: 0.3, drone: 0.8 },  // Copper
  { react: 0.75, reactX: 0.5, expect: 0.45, turn: 4.5, err: 1.4, settle: 1.0, tol: 0.26, see: 520, body: 13, head: 0.44, drone: 0.7 },  // Bronze (was Easy)
  { react: 0.5, reactX: 0.35, expect: 0.3, turn: 7, err: 1.0, settle: 1.4, tol: 0.2, see: 650, body: 11, head: 0.53, drone: 0.5 },     // Silver (was Normal)
  { react: 0.42, reactX: 0.3, expect: 0.26, turn: 8.5, err: 0.88, settle: 1.6, tol: 0.17, see: 690, body: 9.5, head: 0.54, drone: 0.45 }, // Gold
  { react: 0.36, reactX: 0.24, expect: 0.22, turn: 10, err: 0.75, settle: 1.9, tol: 0.15, see: 720, body: 8, head: 0.6, drone: 0.4 },    // Platinum (was Hard)
  { react: 0.28, reactX: 0.14, expect: 0.18, turn: 12.5, err: 0.55, settle: 2.5, tol: 0.12, see: 780, body: 6, head: 0.65, drone: 0.3 },  // Diamond (was Expert)
  { react: 0.23, reactX: 0.1, expect: 0.16, turn: 14, err: 0.42, settle: 3, tol: 0.1, see: 820, body: 5, head: 0.6, drone: 0.25 },  // Champion // turn: he asked for faster turning
];
const lvlOf = (game, p) => game.tut ? 0 : Math.max(0, Math.min(TOP_BOT, p.level ?? game.botLevel ?? DEFAULT_LEVEL));
const skill = (game, p) => p.pro ? proSkill(p) : SKILL[lvlOf(game, p)]; // p.level: a test can give one bot its own

// A bot's personality stays with it all match: aggr = how pushy, patience = how long it waits and watches.
function persona(p) {
  return p.persona || (p.persona = { aggr: Math.random(), patience: Math.random() });
}

// The job for this round. Bots on a side split the roles between them; the order shifts every round.
const ROLES = { [TEAM.ATK]: ['entry', 'support', 'flank', 'intel', 'entry'], [TEAM.DEF]: ['anchor', 'roamer', 'space', 'anchor', 'roamer'] }; // space: holds a room beside the site (he asked: take space, the clock is the attackers' enemy)
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

// is cell k inside (or in the wall round) one of the site's rooms?
// the next thing a defender bot reinforces: hatches over the site first, then the site's breakable walls
// (outside-facing ones before the one between the two site rooms)
function reinforceNext(game) {
  const m = game.map, site = m.sites[game.site], W = m.W, inSite = siteTest(m, site);
  const h = (m.hatches || []).find(h => m.tiles[h.cells[0]] === T.HATCH && h.below.some(k => inRoomOf(m, site.rooms, k % W, Math.floor(k / W))));
  if (h) { game.reinforceHatch(h.id); return true; }
  let best = null, bs = -1;
  for (let k = 0; k < m.tiles.length; k++) {
    if (m.tiles[k] !== T.SOFT || !inSite(k % W, Math.floor(k / W)) || inRoomOf(m, site.rooms, k % W, Math.floor(k / W))) continue;
    const sides = [1, -1, W, -W].map(d => k + d).filter(q => m.tiles[q] === T.FLOOR || m.tiles[q] === T.GROUND);
    const inner = sides.filter(q => inRoomOf(m, site.rooms, q % W, Math.floor(q / W))).length;
    const score = (sides.length - inner > 0 ? 2 : 1) + Math.random() * 0.5; // a wall to the outside of the site beats the partner wall
    if (sides.length && inner && score > bs) { bs = score; best = k; }
  }
  if (best === null) return false;
  game.reinforceWall(best); return true;
}

function siteTest(m, site) {
  const rs = m.rooms.filter(r => site.rooms.includes(r.name));
  return (x, y) => rs.some(r => x >= r.x - 1 && x <= r.x + r.w && y >= r.y - 1 && y <= r.y + r.h);
}
function inRoomOf(m, names, x, y) { return m.rooms.some(r => names.includes(r.name) && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h); }

// Defending bots fortify the site the moment preparation begins.
export function botPrep(game, p) {
  if (game.side(p) !== TEAM.DEF) return;
  const m = game.map, site = m.sites[game.site], W = m.W;
  const inSite = siteTest(m, site);
  const siteOpenings = m.openings.filter(o => o.cells.some(k => inSite(k % W, Math.floor(k / W))));
  const op = OPERATORS[p.op];
  // he asked: above Silver, defenders set the site up in earnest (every way in boarded, all their gadgets out); lower ranks are sloppy
  const lvl = p.pro ? TOP_BOT : lvlOf(game, p), earnest = lvl >= 3;
  const boardP = earnest ? 1 : lvl === 2 ? 0.6 : 0.35;
  // he asked: doors must not start the match planked. Boarding takes a person ~2.5 s each (holding E) plus the walk to
  // the next one, so the bots' boards go up one at a time through preparation instead of all at once.
  p.ai.boardQ = siteOpenings.filter(o => m.tiles[o.cells[0]] === T.OPEN && Math.random() < boardP).map(o => o.id);
  p.ai.boardT = 2 + Math.random() * 4;
  // reinforce: two each, one at a time through preparation (he asked: walls went solid the instant prep began,
  // as if walking by did it; a person holds E for DUR.reinforce), run by the queue at the top of botThink
  p.ai.reinfN = 2; p.ai.reinfT = 1 + Math.random() * 5;
  const bomb = site.bombs[Math.floor(Math.random() * 2)];
  const near = (d) => game.freeSpotNear(bomb.x, bomb.y, d);
  const id = op.ability.id;
  if (id === 'panel') for (const o of siteOpenings.slice(0, 3)) { if (p.abilityCount > 0 && game.barricade(o.id, T.PANEL)) p.abilityCount--; }
  if (id === 'jammer') for (let i = 0; i < 2; i++) { const s = near(60); game.ents.push({ id: game.eid(), type: 'jammer', x: s.x, y: s.y, team: TEAM.DEF, owner: p.id, hp: 1 }); p.abilityCount--; }
  // traps by the site's doors and windows, eyes and ears around it
  const placeAt = (type, x, y, extra = {}) => { game.ents.push({ id: game.eid(), type, x, y, ang: Math.random() * 6.28, team: TEAM.DEF, owner: p.id, hp: 1, ...extra }); };
  const atOpening = i => { const o = siteOpenings[i % siteOpenings.length], k = o.cells[0]; return game.freeSpotNear((k % W + 0.5) * CELL, (Math.floor(k / W) + 0.5) * CELL, 18); };
  if (id === 'alarm' && siteOpenings.length) for (let i = 0; p.abilityCount > 0 && i < 3; i++) { const s = atOpening(i); placeAt('alarm', s.x, s.y, { arm: 0 }); p.abilityCount--; }
  if (id === 'pace') for (let i = 0; i < 2; i++) { const s = near(80 + i * 60); placeAt('pace', s.x, s.y, { life: 999, hit: {} }); p.abilityCount--; } // RALLY: beacons on the routes round the site
  if (id === 'beam') for (const o of siteOpenings.slice(-2)) { if (p.abilityCount > 0 && game.barricade(o.id, T.BEAM, true)) p.abilityCount--; } // GIRDER: brace two ways into the site
  if (id === 'station') { const s = near(30); placeAt('station', s.x, s.y, { pool: 100 }); p.abilityCount--; }
  if (id === 'catcher') for (let i = 0; i < 2; i++) { const s = near(50); placeAt('catcher', s.x, s.y, { c: 2 }); p.abilityCount--; }
  if (id === 'radar') { const s = near(120); placeAt('radar', s.x, s.y, { life: 15, t: 0 }); p.abilityCount--; }
  if (['prox', 'concuss', 'clamp'].includes(id) && siteOpenings.length) for (let i = 0; p.abilityCount > 0 && i < 3; i++) { const s = atOpening(i); placeAt(id, s.x, s.y, { arm: 0 }); p.abilityCount--; }
  if (id === 'sensor') while (p.abilityCount > 0) { const s = near(150); placeAt('sensor', s.x, s.y, { t: 0, pingT: 0 }); p.abilityCount--; }
  if (id === 'plates') { const s = near(30); placeAt('plates', s.x, s.y, { c: 5 }); p.abilityCount--; }
  if (id === 'turret' || id === 'stickycam') while (p.abilityCount > 0) {
    const s = near(100); placeAt('cam', s.x, s.y, { offUntil: 0, tu: id === 'turret' ? 1 : 0, ang: Math.atan2(s.y - bomb.y, s.x - bomb.x) }); p.abilityCount--;
  }
  if (id === 'grid') for (let k = 0; k < m.tiles.length && p.abilityCount > 0; k++) {
    if (m.tiles[k] !== T.REINF || !inSite(k % W, Math.floor(k / W)) || Math.random() < 0.6) continue;
    placeAt('grid', (k % W + 0.5) * CELL, (Math.floor(k / W) + 0.5) * CELL, { cell: k }); p.abilityCount--;
  }
  if (id === 'mine') for (const o of siteOpenings.slice(0, 2)) {
    const k = o.cells[0], s = game.freeSpotNear((k % W + 0.5) * CELL, (Math.floor(k / W) + 0.5) * CELL, 14);
    placeAt('mine', s.x, s.y, { ang: 0, arm: 0 }); p.abilityCount--;
  }
  // a deployable shield in the site, facing the nearest way in (earnest only)
  if (earnest && p.gadget === 'dshield' && p.gadgetCount > 0 && siteOpenings.length) {
    const s = near(50), o = siteOpenings[Math.floor(Math.random() * siteOpenings.length)], k = o.cells[0];
    if (game.placeShield({ x: s.x, y: s.y, aim: Math.atan2((Math.floor(k / W) + 0.5) * CELL - s.y, (k % W + 0.5) * CELL - s.x) })) p.gadgetCount--;
  }
  // their gadget too: a claymore or barbed wire just inside a way into the site (earnest: all of them, each at its own way in;
  // the lowest ranks often forget)
  for (let g = 0; g < (earnest ? 3 : 1); g++) if ((p.gadget === 'claymore' || p.gadget === 'wire') && p.gadgetCount > 0 && siteOpenings.length && (earnest || Math.random() < (lvl >= 2 ? 0.8 : 0.5))) {
    const i = Math.floor(Math.random() * siteOpenings.length), s = atOpening(i), k = siteOpenings[i].cells[0];
    const ang = Math.atan2((Math.floor(k / W) + 0.5) * CELL - s.y, (k % W + 0.5) * CELL - s.x);
    if (p.gadget === 'claymore') placeAt('claymore', s.x, s.y, { ang, arm: 0 }); else { delete s.hp; game.ents.push({ id: game.eid(), type: 'wire', x: s.x, y: s.y, ang, team: TEAM.DEF, owner: p.id }); }
    p.gadgetCount--;
  }
  // stair watch (he asked): from Gold up, one roamer waits by the stairs nearest the site to shoot drones coming up or down
  if (earnest && (m.stairs || []).length && ![...game.players.values()].some(q => q !== p && q.bot && q.squad === p.squad && q.ai && q.ai.stairWatch)) {
    const fl = floorAt(m, bomb.x, bomb.y); let best = null, bd = Infinity;
    for (let i = 0; i < m.stairs.length; i++) { const e = stairEnds(m, i, 0); for (const q of [e.top, e.bottom]) { if (floorAt(m, q.x, q.y) !== fl) continue; const d = Math.hypot(q.x - bomb.x, q.y - bomb.y); if (d < bd) { bd = d; best = q; } } }
    if (best && bd < 30 * CELL) (p.ai || (p.ai = {})).stairWatch = game.freeSpotNear(best.x, best.y, 40);
  }
}

// ---- path finding (A* over cells; barricades are passable but costly) ----
// avoid: cells this bot found it can't vault over (too deep, nowhere to land)
function findPath(map, sx, sy, gx, gy, avoid, drone = false, def = false, inside = false) {
  const W = map.W, H = map.H, N = W * H;
  const start = sy * W + sx, goal = gy * W + gx;
  const g = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const heap = [[0, start]]; g[start] = 0;
  const droneCost = k => { // a drone: through drone holes and barricade gaps, never over furniture or through walls
    const t = map.tiles[k];
    if (blocksDrone(t) && !((t === T.SOFT || t === T.HARD) && map.dhole && map.dhole[k]) && !underAt(map, k, t)) return Infinity;
    return 1;
  };
  const cost = drone ? droneCost : k => {
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
    return 1 + near * 0.6;
  };
  const push = (f, k) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const pi = (i - 1) >> 1; if (heap[pi][0] <= heap[i][0]) break; [heap[pi], heap[i]] = [heap[i], heap[pi]]; i = pi; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let s = i; if (l < heap.length && heap[l][0] < heap[s][0]) s = l; if (r < heap.length && heap[r][0] < heap[s][0]) s = r; if (s === i) break; [heap[s], heap[i]] = [heap[i], heap[s]]; i = s; } } return top; };
  let iter = 0;
  // distance guess measured in the shared building frame, so floors stacked above each other are "close"
  const F = map.floors || [], flAt = map.flAt;
  const lx = k => { const f = F[flAt ? flAt[k] : 0]; return k % W + (f ? f.x0 - f.gx : 0); };
  const ly = k => { const f = F[flAt ? flAt[k] : 0]; return ((k / W) | 0) + (f ? f.y0 : 0); };
  const glx = lx(goal), gly = ly(goal), gfl = flAt ? flAt[goal] : 0;
  const h = k => Math.hypot(glx - lx(k), gly - ly(k)) + (flAt && flAt[k] !== gfl ? 6 : 0);
  while (heap.length && iter++ < 30000) {
    const [, k] = pop();
    if (k === goal) break;
    if (closed[k]) continue; closed[k] = 1;
    const x = k % W, y = (k / W) | 0;
    const pk = map.portal ? map.portal[k] : -1; // the end of a staircase leads to the other floor
    if (pk >= 0) { const ng = g[k] + 1; if (ng < g[pk]) { g[pk] = ng; from[pk] = k; push(ng + h(pk), pk); } continue; }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const nk = ny * W + nx;
      if (dx && dy && (drone ? droneCost(y * W + nx) === Infinity || droneCost(ny * W + x) === Infinity : blocksMove(map.tiles[y * W + nx]) || blocksMove(map.tiles[ny * W + x]))) continue;
      const c = cost(nk); if (c === Infinity) continue;
      const ng = g[k] + c * (dx && dy ? 1.414 : 1);
      if (ng < g[nk]) { g[nk] = ng; from[nk] = k; push(ng + h(nk), nk); }
    }
  }
  if (from[goal] < 0 && goal !== start) return null;
  const path = [];
  for (let k = goal; k !== start && k >= 0; k = from[k]) path.push(k);
  return path.reverse();
}

function visibleEnemy(game, p, see) {
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
  const dx = (q.x - p.x) / d, dy = (q.y - p.y) / d, sx = Math.floor(p.x / CELL), sy = Math.floor(p.y / CELL);
  let ok = true;
  walkRay(p.x, p.y, dx, dy, d, (cx, cy) => {
    if (cx === sx && cy === sy) return false;
    const t = tileAt(m, cx, cy); if (!stopsBullet(t)) return false;
    const sh = shapeAt(m, cx, cy); if (sh) { const h = rayShape(sh, p.x, p.y, dx, dy); if (h === null || h > d) return false; }
    ok = false; return true;
  });
  if (!ok || rayCovers(m, p.x, p.y, dx, dy, d - 4)) return false;
  for (const o of game.players.values()) {
    if (o === p || !o.alive || game.side(o) !== game.side(p)) continue;
    const ax = o.x - p.x, ay = o.y - p.y, along = ax * dx + ay * dy;
    if (along > 0 && along < d + 300 && Math.abs(ax * dy - ay * dx) < hitR(o.op) + 4 + along * 0.05) return false; // a miss flies on past the target, and spreads
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
    ai.lookA = p.aim + (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 1.2);
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
// Aim along an angle and set the throw point (grenades land where you aim, up to 300 px away).
function aimAt(p, x, y) {
  p.aim = Math.atan2(y - p.y, x - p.x);
  const d = Math.min(300, Math.hypot(x - p.x, y - p.y));
  p.aimX = p.x + Math.cos(p.aim) * d; p.aimY = p.y + Math.sin(p.aim) * d;
}
function shootInput(inp, ai, gun) { const w = gun && WEAPONS[gun.w]; inp.fire = w && !w.auto ? (ai.semi = !ai.semi) ? 1 : 0 : 1; }

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
  amateurComms(game, p, dt);
  const ai = p.ai;
  if (game.phase === PHASE.PREP && ai.boardQ && ai.boardQ.length && p.alive && !p.downed && (ai.boardT -= dt) <= 0) { // the next board of the queue set in botPrep
    const id = ai.boardQ.shift(), o = game.map.openings[id];
    if (p.barri > 0 && game.barricade(id, T.BARRI)) p.barri--;
    else if (o && o.cells.every(c => game.map.tiles[c] === T.OPEN) && (ai.boardTry = (ai.boardTry || 0) + 1) < 12) ai.boardQ.push(id); // someone stood in it: try again later
    ai.boardT = DUR.barricade + 1 + Math.random() * 2;
  }
  if (game.phase === PHASE.PREP && ai.reinfN > 0 && p.alive && !p.downed && (ai.reinfT -= dt) <= 0) {
    if (game.reinforce > 0 && reinforceNext(game)) { game.reinforce--; ai.reinfN--; } else ai.reinfN = 0;
    ai.reinfT = DUR.reinforce + 1.5 + Math.random() * 3;
  }
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

  // --- hearing: the most recent enemy noise this bot could hear ---
  for (const n of game.noises || []) {
    if (n.team === team || game.time - n.t > 1.5 || (ai.heard && ai.heard.t >= n.t)) continue;
    const ln = localPos(map, n.x, n.y), lp = localPos(map, p.x, p.y), fd = Math.abs(ln.f - lp.f);
    // loud noises (gunfire, blasts, sirens) are heard through the whole building, a floor up or down too, unless it is huge
    const r = n.r >= 900 && fd <= 1 ? Math.max(n.r, 2400 - fd * 600) : n.r * (fd === 0 ? 1 : 0.5);
    const hd = Math.hypot(ln.x - lp.x, ln.y - lp.y);
    if (hd < r * (p.pro ? 0.8 : 1)) { if (p.pro) { const e = hd * 0.22 + (floorAt(map, n.x, n.y) === floorAt(map, p.x, p.y) ? 0 : 60), a = Math.random() * 6.28, rr = Math.random() * e; ai.heard = { x: n.x + Math.cos(a) * rr, y: n.y + Math.sin(a) * rr, t: n.t }; } else ai.heard = { x: n.x, y: n.y, t: n.t }; } // pros hear like people: roughly where, not exactly
  }
  // --- team intel: an enemy a teammate (or camera) spotted close by is worth turning to face, once in a while ---
  if (!ai.heard || game.time - ai.heard.t > 3) for (const id of game.spots[team].keys()) {
    const q = game.players.get(id); if (!q || !q.alive) continue;
    ai.spotT = ai.spotT || {};
    if (game.time - (ai.spotT[id] || -99) < 8 || Math.hypot(q.x - p.x, q.y - p.y) > 420 || floorAt(map, q.x, q.y) !== floorAt(map, p.x, p.y)) continue;
    ai.spotT[id] = game.time; ai.heard = { x: q.x, y: q.y, t: game.time }; break;
  }
  const heardRecently = ai.heard && game.time - ai.heard.t < 4;
  if (p.pro && heardRecently && ai.heard.t !== ai.heardSaid && game.phase === PHASE.ACTION && Math.random() < 0.1) { ai.heardSaid = ai.heard.t;
    const up = floorAt(map, ai.heard.x, ai.heard.y) !== floorAt(map, p.x, p.y); proSay(game, p, up ? 'Hearing them on another floor' : `Footsteps, ${place(game, ai.heard.x, ai.heard.y)}`, 'hear' + place(game, ai.heard.x, ai.heard.y)); }
  if (p.pro && p.alive && !p.downed && p.hp < p.maxHp * 0.3 && !ai.lowSaid) { ai.lowSaid = true; proSay(game, p, "I'm one shot", null, true); }

  // --- held abilities: let go unless something below holds them again ---
  if (abId === 'shroud') { const want = heardRecently && p.battery > 1.5 && !p.downed; inp.ability = want !== !!p.shrouded && !(p.prevInput && p.prevInput.ability) ? 1 : 0; } // go dark while enemies are close by (a toggle: press to switch)
  if (abId === 'scan' && action && !p.downed) { // a few seconds of scanning when something is heard, or every so often
    ai.scanT = (ai.scanT ?? 8 + Math.random() * 10) - dt;
    if ((heardRecently || ai.scanT < 0) && p.battery > 1) { inp.ability = 1; if (ai.scanT < -3) ai.scanT = 15 + Math.random() * 15; }
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
    ai.err += (Math.random() - 0.5) * dt * 0.6; // hands are never perfectly steady
    const os = (ai.os || 0) / Math.max(1, d), want = Math.atan2(enemy.y + (enemy.x - p.x) * os - p.y, enemy.x - (enemy.y - p.y) * os - p.x) + ai.err; // somewhere across the body, not always the head
    turnTo(p, want, S.turn, dt);
    p.aimX = p.x + Math.cos(p.aim) * d; p.aimY = p.y + Math.sin(p.aim) * d; // their crosshair sits on what they aim at (it used to stay where the last throw went, so bots could almost never headshot)
    if (!ai.oh) { const hx = p.aimX - enemy.x, hy = p.aimY - enemy.y, hd = Math.hypot(hx, hy); if (hd < HEAD_AIM + 0.5) { const k = (HEAD_AIM + 0.5) / Math.max(0.01, hd); p.aimX = enemy.x + (hd > 0.01 ? hx * k : HEAD_AIM + 0.5); p.aimY = enemy.y + (hd > 0.01 ? hy * k : 0); } } // going for the body: a shaky hand crossing the head doesn't count as aiming at it
    inp.ads = 1;
    // call it out to the team once they've taken it in (a ping with the operator's name and the room)
    if (!ai.called && ai.react > -0.1) {
      ai.called = true; game.spot(team, enemy.id, 3);
      if (p.pro) { const near = [...game.players.values()].filter(q => q.alive && game.side(q) !== team && Math.hypot(q.x - enemy.x, q.y - enemy.y) < 120).length;
        proSay(game, p, `${opName(enemy)}, ${place(game, enemy.x, enemy.y)}${near > 1 ? `, ${near} of them` : ''}${enemy.hp < enemy.maxHp * 0.4 ? ', he is hurt' : ''}`, 'see' + enemy.id); }
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
    if (ai.strafe) { const sa = p.aim + Math.PI / 2 * ai.strafe; setDir(inp, Math.cos(sa), Math.sin(sa)); inp.walk = 1; }
    return;
  }
  ai.seen = null;
  if (gun && gun.ammo < WEAPONS[gun.w].mag * 0.3 && gun.reserve > 0) game.startReload(p);
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
      game.watch(p, feeds[Math.floor(Math.random() * feeds.length)]); return;
    }
  }

  // --- impatience (he asked: bots stood around too much; people get impatient and take a risk for a better position
  // or the surprise) ---
  if (action && !game.planted && !p.pro) impatience(game, p, team, site, me);

  // --- a pro's part of the team plan ---
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
    else if (game.phase === PHASE.PREP && ai.stairWatch) { goal = ai.stairWatch; ai.watchingStairs = true; } // waits for drones there
    else {
      // he asked: defenders wander a little: every so often, while nothing is heard, a new spot round the site
      if (!heardRecently && game.time > (ai.holdT || 0)) { ai.hold = nearBomb(game, site, ai.role === 'anchor' ? 60 : 100); ai.holdT = game.time + 10 + Math.random() * 18; }
      goal = ai.hold || (ai.hold = nearBomb(game, site, 70));
    }
  }
  if (act) { if (p.pro && !ai.actSaid) { ai.actSaid = true; proSay(game, p, act === 'plant' ? `Planting ${(ai.bomb || {}).id || ''}, cover me` : 'Defusing, cover me!', act, true); } inp.interact = 1; inp.crouch = 1; return; }
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
    turnTo(p, Math.atan2(ai.heard.y - p.y, ai.heard.x - p.x), skill(game, p).turn * 0.6, dt);
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
    if (game.timer < 120) ai.startWait = 0; // the clock: no more waiting
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
    if (toGoal < (ai.role === 'entry' ? 220 : 360) - me.aggr * 80 && game.timer > 45) { // close: walk quietly and check angles, unless the clock says run
      inp.walk = 1;
      ai.pauseT = (ai.pauseT ?? 2 + Math.random() * 3) - dt;
      if (ai.pauseT < 0 && game.timer > 75) { if (ai.pauseT < -(0.4 + me.patience)) ai.pauseT = 2 + Math.random() * 4; checkAngles(game, p, dt, 1); return; }
    }
    // an entry fragger throws a stun into the site just before going in
    if (action && ai.role === 'entry' && p.gadget === 'stun' && p.gadgetCount > 0 && toGoal < 200 && !ai.stunned && los(map, p.x, p.y, goal.x, goal.y)) { ai.stunned = true; aimAt(p, goal.x, goal.y); game.event(p, { k: 'gadget' }); }
  }

  // he asked: defenders take space when they can do it without leaving the site open. The 'space' defender holds a room
  // beside the site on the attackers' side (two anchors stay on it) until the clock runs down or the team is losing people.
  if (!atk && ai.role === 'space' && action && !game.planted) {
    const mates = [...game.players.values()].filter(q => q.squad === p.squad), lost = mates.filter(q => !q.alive || q.downed).length;
    if (game.timer > 70 && lost < 2) {
      if (!ai.spaceAt) { const I = intelOf(game), r = I && (I.near[0] || I.roam); ai.spaceAt = r ? game.freeSpotNear(...Object.values(I.centre(r)), Math.min(r.w, r.h) * CELL * 0.3) : null; }
      if (ai.spaceAt) return moveTo(game, p, inp, ai.spaceAt, dt, true);
    }
  }
  // a roaming defender spends the first part of the round in rooms around the site, then falls back to it
  if (!atk && ai.role === 'roamer' && action && !game.planted) {
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
function botAbility(game, p, ai, abId, enemy, heard, team, site, useAbility, inp, dt) {
  const ok = () => p.abilityCount > 0 && game.time > (ai.abT || 0), done = (wait = 4) => { ai.abT = game.time + wait; };
  const d = enemy ? Math.hypot(enemy.x - p.x, enemy.y - p.y) : Infinity, bomb = site.bombs[0];
  const toBomb = Math.min(...site.bombs.map(b => Math.hypot(b.x - p.x, b.y - p.y)));
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
  } else if (abId === 'weld') { // SOLDER: weld a broken wall back when one is close and nobody is shooting
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
    if (!q.alive || game.side(q) === team || q.shrouded || Math.hypot(q.x - c.x, q.y - c.y) > 420 || floorAt(game.map, q.x, q.y) !== floorAt(game.map, c.x, c.y)) continue;
    if (Math.abs(angDiff(Math.atan2(q.y - c.y, q.x - c.x), c.ang || 0)) > 0.85 || !los(game.map, c.x, c.y, q.x, q.y, smokes)) continue;
    game.spot(team, q.id, 3);
    if (!(ai.camSaid || (ai.camSaid = new Set())).has(q.id + ':' + game.round)) { ai.camSaid.add(q.id + ':' + game.round);
      if (p.pro) proSay(game, p, `Cam: ${opName(q)} in ${place(game, q.x, q.y)}`, 'see' + q.id);
      else if (([...game.players.values()].some(o => !o.bot && o.squad === p.squad) || game.tv) && game.markOk(p)) game.mark(p, q.x, q.y, 'ENEMY ' + OPERATORS[q.op].name, q.id); }
  }
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
    if (rooms.length && Math.random() < bold * 0.6) { const r = rooms[Math.floor(Math.random() * rooms.length)], c = I.centre(r); ai.hold = game.freeSpotNear(c.x, c.y, Math.min(r.w, r.h) * CELL * 0.35); }
    else ai.hold = nearBomb(game, site, 60 + Math.random() * 60);
    ai.holdT = game.time + 12 + Math.random() * 10;
    if (ai.role === 'roamer') ai.roamT = 0; // a roamer: on to another room
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
function moveTo(game, p, inp, goal, dt, hold = false) {
  const ai = p.ai, map = game.map, team = game.side(p);
  const early = team === TEAM.DEF && (game.phase === PHASE.PREP || (game.phase === PHASE.ACTION && game.timer > DUR.action - 15)) && !game.free && !game.planted;
  if (early) goal = keepInside(game, goal);
  const gx = Math.floor(goal.x / CELL), gy = Math.floor(goal.y / CELL);
  const sx = Math.floor(p.x / CELL), sy = Math.floor(p.y / CELL);
  ai.pathT = (ai.pathT || 0) - dt;
  if (!ai.path || ai.pathT <= 0 || ai.goalK !== gy * map.W + gx) {
    ai.path = findPath(map, sx, sy, gx, gy, ai.noVault, false, team === TEAM.DEF, early) || []; ai.pathT = 1.2; ai.goalK = gy * map.W + gx;
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
  if (oi >= 0 && map.openings[oi] && map.openings[oi].cells.length > 1) { // a doorway: take the half a teammate isn't using
    const o = map.openings[oi], used = [...game.players.values()].filter(q => q !== p && q.alive && q.squad === p.squad && Math.hypot(q.x - p.x, q.y - p.y) < 120);
    if (used.length) { const far = o.cells.slice().sort((a, b) => Math.min(...used.map(q => Math.hypot((b % map.W + 0.5) * CELL - q.x, (Math.floor(b / map.W) + 0.5) * CELL - q.y))) - Math.min(...used.map(q => Math.hypot((a % map.W + 0.5) * CELL - q.x, (Math.floor(a / map.W) + 0.5) * CELL - q.y))))[0]; next = far; }
  }
  const nx = (next % map.W + 0.5) * CELL, ny = (Math.floor(next / map.W) + 0.5) * CELL;
  const dirA = Math.atan2(ny - p.y, nx - p.x);
  let lookA = dirA; // where they walk, or (better bots) where an enemy would come from
  if (preAims(game, p)) {
    if ((ai.threatT = (ai.threatT || 0) - dt) <= 0) { ai.threatT = 0.7; ai.threat = threatPoint(game, p, dirA); }
    if (ai.threat) lookA = Math.atan2(ai.threat.y - p.y, ai.threat.x - p.x);
  }
  turnTo(p, lookA, skill(game, p).turn * 0.8, dt);
  if (vaultable(map, next) && Math.hypot(nx - p.x, ny - p.y) < 24) { // climb over it, or note it can't be done and go round
    if (!game.startVault(p, dirA)) { (ai.noVault || (ai.noVault = new Set())).add(next); ai.path = null; }
    return;
  }
  if (map.tiles[next] === T.BARRI || map.tiles[next] === T.SOFT || map.tiles[next] === T.PANEL) {
    if (Math.hypot(nx - p.x, ny - p.y) < 26) {
      p.aim = dirA; const f = game.facingCell(p, 20);
      if (f && f.k === next) { ai.hitT = 0; game.event(p, { k: 'melee' }); return; }
      ai.hitT = (ai.hitT || 0) + dt; // the swing wouldn't reach it from here: step in, and after a while go another way
      if (ai.hitT > 2.5) { ai.hitT = 0; (ai.noVault || (ai.noVault = new Set())).add(next); ai.path = null; return; }
    }
  }
  setDir(inp, nx - p.x, ny - p.y);
  // stuck? nudge
  if (Math.hypot(p.x - (ai.lx || 0), p.y - (ai.ly || 0)) < 0.5) { ai.stuck = (ai.stuck || 0) + dt; if (ai.stuck > 1) { ai.path = null; ai.stuck = 0; } }
  else ai.stuck = 0;
  ai.lx = p.x; ai.ly = p.y;
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
    if (p.pro && !(ai.dSaid || (ai.dSaid = new Set())).has(q.id)) { ai.dSaid.add(q.id); proSay(game, p, `Drone: ${opName(q)} in ${place(game, q.x, q.y)}`, 'see' + q.id); }
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
      teamSay(game, p, 'Swarm on my drone, MAGPIE is close', 'sw' + sw.id);
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
  for (const h of m.hatches || []) if (m.tiles[h.cells[0]] === T.HOLE) pts.push({ x: h.x, y: h.y }, { x: h.bx, y: h.by });
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
const PEEK = { Kaze: 0.35, Torvi: 0.3, Wisp: 0.15, Juno: 0.12 }, PEEK_LVL = [0.02, 0.03, 0.06, 0.09, 0.12, 0.18, 0.22];
function peekSkill(game, p) { return p.pro ? (PEEK[p.pro.pl.name] ?? 0.06) : PEEK_LVL[lvlOf(game, p)]; }
const PERSONA = { Halden: [0.45, 0.8], Kaze: [0.95, 0.2], Brick: [0.6, 0.6], Moth: [0.2, 0.85], Juno: [0.5, 0.9], Sable: [0.35, 0.9], Torvi: [0.9, 0.3], Pax: [0.5, 0.6], Grit: [0.3, 0.95], Wisp: [0.7, 0.35] };
const TIMING = { Wisp: -6, Moth: 5, Juno: 8 }; // seconds early (-) or late (+) to their part of the plan: their flaws
const ROTATE_DELAY = { Halden: 4, Grit: Infinity }; // slow to rotate; never rotates
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
  if (!game.tv || p.pro || game.phase === PHASE.SELECT || game.phase === PHASE.LOBBY) return;
  const lv = lvlOf(game, p), ai = p.ai || (p.ai = {});
  p.chatT = (p.chatT ?? (6 + Math.random() * 12)) - dt; if (p.chatT > 0) return; // he asked: the bots talked too much
  let text;
  if (lv <= 1) { const bit = p.bit || (p.bit = BIT_KEYS[(+p.id.slice(1) * 7 + game.round) % BIT_KEYS.length]); const L = BITS[bit]; text = L[Math.floor(Math.random() * L.length)]; p.chatT = 20 + Math.random() * 20; }
  else if (lv <= 4) { text = MID[Math.floor(Math.random() * MID.length)]; p.chatT = 35 + Math.random() * 30; } // most ranks mostly ping instead
  else { text = HIGH[Math.floor(Math.random() * HIGH.length)].replace('{room}', place(game, p.x, p.y) || 'there'); p.chatT = 22 + Math.random() * 18; } // Diamond and up: the ones who talk about the objective
  game.chat(p, { text: text.slice(0, 140), team: true });
}
export function proSay(game, p, text, key, prio = false) {
  if (!p || !p.pro) return;
  const t = game.time, team = (game.proSaid || (game.proSaid = {}))[p.squad] || (game.proSaid[p.squad] = { keys: {}, last: 0 });
  if (key && t - (team.keys[key] ?? -99) < 8) return; // a teammate just said it
  if (!prio && (t - (p.saidT ?? -99) < 6 || t - team.last < 2.5)) return; // not constant chatter (he asked: less)
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
  return { react: pl.react + press * 0.08, reactX: 0.08, expect: Math.max(0.17, pl.react * 0.85), turn: pl.turn, err: pl.aim * (1 + press * 0.7), settle: 2.6, tol: 0.1, see: 700, body: 6, head: (0.62 - pl.aim * 0.4) * (1 - press * 0.4), drone: 0.32 };
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
    const w = game.proExplore ? list.map(() => 1) // practice: try everything
      : list.map((pl, i) => (pl.id === last ? 0.25 : 1) / (1 + i * 0.3) * planWeight(game.map.id, game.site, side, pl.id) ** 2); // the team's style, and what has won in practice
    let r = Math.random() * w.reduce((a, b) => a + b, 0), pick = list[0];
    for (let i = 0; i < list.length; i++) if ((r -= w[i]) <= 0) { pick = list[i]; break; }
    Object.assign(st, { plan: pick, side, site: game.site, go: pick.go || 0, gone: false, swapped: false, rotate: null, retake: false, called: false });
    (game.proLast || (game.proLast = {}))[squad] = pick.id;
  }
  return st;
}
function proCall(game, squad, text) { // the leader (or whoever is left) says it in team chat
  const mates = [...game.players.values()].filter(q => q.pro && q.squad === squad);
  const who = mates.find(q => q.pro.pl.igl && q.alive) || mates.find(q => q.alive) || mates[0];
  const st = proState(game, squad); st.calls.push({ t: game.time, text });
  (game.proLog || (game.proLog = [])).push({ round: game.round, squad, team: PRO_TEAMS[squad].tag, text });
  if (who) { who.saidT = game.time; game.chat(who, { text: text.slice(0, 140), team: true }); }
}
const HARD_BREACH = ['ember', 'rivet'];
export function proPickOp(game, p) {
  const side = proSide(game, p), pl = p.pro.pl, st = proPlan(game, p.squad, side), job = pl.jobs[side], j = st.plan && st.plan.jobs[job];
  // he asked: a wider variety of operators. Every operator of their job is in reach: their own favourites count double, what
  // won in practice counts more, and last round's pick less, so the same player plays several operators over a match.
  const all = opsForTeam(side === 'atk' ? TEAM.ATK : TEAM.DEF).filter(o => jobOf(o) === job), lastOp = (p.pro.lastOps || (p.pro.lastOps = {}))[side];
  const weigh = o => (pl.pool[side].includes(o) ? 2 : 1) * opWeight(game.map.id, side, o) ** 2 * (o === lastOp ? 0.35 : 1);
  const draw = list => { const out = [], left = list.map(o => [o, weigh(o)]); while (left.length) { let r = Math.random() * left.reduce((a, b) => a + b[1], 0), i = 0; while (i < left.length - 1 && (r -= left[i][1]) > 0) i++; out.push(left.splice(i, 1)[0][0]); } return out; };
  let pool = game.proExplore || game.proAnyOp ? all.sort(() => Math.random() - 0.5) : draw(all); // practice / balance tests: any operator of their job
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
    if (!st.called) { st.called = true; proCall(game, squad, `${plan.name}: ${plan.idea}`); }
    if (st.gone || game.planted) return;
    if (el >= st.go) { st.gone = true; proCall(game, squad, 'Go go go!'); }
    else if (down >= 2) { st.go = el; st.gone = true; proCall(game, squad, 'Two down: we go now, together. Trade each other.'); }
    else if (game.timer < 55) { st.go = el; st.gone = true; proCall(game, squad, 'Running out of time: go now.'); }
    else if (!st.swapped && plan.ways.side && el > 8 && spottedNear(game, team, plan.ways.main.pos, 150) >= 2) {
      st.swapped = true; st.go = Math.min(st.go, el + 6); proCall(game, squad, 'They are stacked on our door: switch, everyone through the other way in 6.');
    }
  } else {
    if (!st.called) { st.called = true; proCall(game, squad, `${plan.name}: ${plan.idea}`); }
    if (game.planted) {
      if (!st.retake) { const near3 = mates.filter(q => q.alive && !q.downed && near(q, game.planted, 300)).length; if (near3 >= Math.min(3, alive) || game.planted.t < 30 || game.time - (st.plantSeen ?? (st.plantSeen = game.time)) > 8) { st.retake = true; proCall(game, squad, 'Retake now, all together, utility first.'); } }
      return;
    }
    for (const w of [plan.ways.main, plan.ways.side]) if (w && spottedNear(game, team, w.pos, 170) >= 2 && (!st.rotate || st.rotate.w !== w)) {
      st.rotate = { w, t: game.time, at: game.freeSpotNear(w.hold.x, w.hold.y, 20) }; proCall(game, squad, `Rotate: they are hitting ${w.kind === 'stairs' ? 'the stairs' : 'the ' + w.kind}.`); break;
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
    const sc = crowd * 100 + Math.hypot(dx - off.x, dy - off.y) + Math.random() * 0.5;
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
  else if (!st.called && game.phase === PHASE.PREP && side === 'def') { st.called = true; proCall(game, p.squad, `${plan.name}: ${plan.idea}`); }
  const watch = (pt, crouch) => { // hold an angle like a person: a noise first, now and then the other ways in, else the job's angle
    if (ai.heard && game.time - ai.heard.t < 2.5) pt = ai.heard;
    else { if ((ai.chkT = (ai.chkT ?? 3 + Math.random() * 3) - dt) <= 0) { ai.chkT = 3 + Math.random() * 4; ai.chk = Math.random() < 0.4 ? threatPoint(game, p, p.aim + (Math.random() - 0.5) * 3) : null; ai.chkUntil = game.time + 1.2; }
      if (ai.chk && game.time < ai.chkUntil) pt = ai.chk; }
    if (pt) turnTo(p, Math.atan2(pt.y - p.y, pt.x - p.x), S.turn * 0.6, dt); inp.crouch = crouch ? 1 : 0; // he asked: crosshair placement matters most — held still on the spot, no drifting
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
      if ((ai.waitT = (ai.waitT ?? 9 + Math.random() * 6) - dt) <= 0) {
        ai.waitT = 10 + Math.random() * 8; ai.spreadOff = { x: Math.round((Math.random() - 0.5) * 6), y: Math.round((Math.random() - 0.5) * 6) }; ai.spread = null;
        if (!game.spots[team].size && Math.random() < 0.35) proSay(game, p, `${place(game, p.x, p.y)} is quiet, holding for the go (${Math.max(0, Math.round(go - el))} s)`, 'wait' + place(game, p.x, p.y));
      }
      if (j.clear != null && el > go - 9 && game.map.tiles[j.clear] === T.BARRI) { // a boarded window: shoot the boards off from the stack (as R6 teams do) instead of hitting them three times in the open
        const W = game.map.W, cx = (j.clear % W + 0.5) * CELL, cy = (Math.floor(j.clear / W) + 0.5) * CELL; aimAt(p, cx, cy); inp.ads = 1;
        const gun = p.guns[p.slot]; if (gun && gun.ammo === 0) game.startReload(p); else shootInput(inp, ai, gun); return true;
      }
      watch(eff(st, j, 'target'), true); return true;
    }
    if (!ai.utilDone) { // utility in first
      ai.utilDone = true; const tg = eff(st, j, 'target'), abId = OPERATORS[p.op].ability.id;
      if (j.util === 'stun' && p.gadget === 'stun' && p.gadgetCount > 0) { aimAt(p, tg.x, tg.y); game.event(p, { k: 'gadget' }); proSay(game, p, 'Stun out!', 'util'); }
      if (j.util === 'smoke') { aimAt(p, tg.x, tg.y); proSay(game, p, 'Smoking the door', 'util'); if (abId === 'barrage' && p.abilityCount > 0) game.event(p, { k: 'ability' }); else if (p.gadget === 'smoke' && p.gadgetCount > 0) game.event(p, { k: 'gadget' }); }
    }
    const tg = eff(st, j, 'target');
    if (!near(p, tg, 18) && !(ai.tgT = (ai.tgT || 0) + dt, ai.tgT > 25)) { moveTo(game, p, inp, tg, dt); return true; }
    ai.inSite = true; if (j.plant) ai.bomb = j.plant; // in: the ordinary push to the bomb, plant, hold
    return false;
  }
  // defence
  if (game.planted) {
    if (st.retake) return false; // all in: the ordinary defuse
    const stage = ai.stage || (ai.stage = game.freeSpotNear(game.planted.x + (p.x - game.planted.x) * 0.5, game.planted.y + (p.y - game.planted.y) * 0.5, 40));
    if (!near(p, stage, 14) && !near(p, game.planted, 200)) { moveTo(game, p, inp, stage, dt, true); return true; }
    watch(game.planted, true); return true;
  }
  const rot = st.rotate && game.time > st.rotate.t + (ROTATE_DELAY[name] ?? 0) && ['support', 'intel', 'roamer'].includes(p.pro.pl.jobs.def) ? st.rotate : null;
  const roaming = action && j.roam && el < (j.until || 0) + (TIMING[name] || 0) && !rot;
  if (!roaming && (ai.reposT = (ai.reposT ?? 16 + Math.random() * 14) - dt) <= 0) { ai.reposT = 18 + Math.random() * 16; ai.spreadOff = { x: Math.round((Math.random() - 0.5) * 4), y: Math.round((Math.random() - 0.5) * 4) }; ai.spread = null; } // a new angle now and then
  const spot = roaming ? (ai.roamAt || (ai.roamAt = game.freeSpotNear(j.roam.x, j.roam.y, 50))) : spreadSpot(game, p, rot ? rot.at : j.hold, 72, rot ? rot.w.pos : j.watch); // defenders don't bunch either
  if (!near(p, spot, 14)) { moveTo(game, p, inp, spot, dt, true); if (roaming && near(p, spot, 200)) inp.walk = 1; return true; }
  watch(rot ? rot.w.pos : j.watch, !roaming); return true;
}
