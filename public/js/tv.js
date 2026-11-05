// ESPORTS TV (he asked: a mode to just watch the pro teams play). Loaded by main.js only when Esports TV is opened, so
// none of this sits in a normal match. main.js hands over what it shares with it in initTv.
import { PHASE, PRO_LEVEL } from '/shared/constants.js';
import { floorAt, MAPS } from '/shared/map.js';
import { OPERATORS, JOBS } from '/shared/operators.js';
import { PRO_TEAMS } from '/shared/pros.js';
import { RANKS } from '/shared/progress.js';
import * as audio from './audio.js';
import { drawWebcam } from './webcam.js';
import { castEvent, castPhase, castTick, castReset } from './casters.js';
export { offerReplay, tickReplay, stopReplay } from './tvreplay.js';

let st, send, $, setHTML, esc, w2s, mapThumb, portraitCached, getCtx, getDpr;
export function initTv(a) { ({ st, send, $, setHTML, esc, w2s, mapThumb, portraitCached } = a); getCtx = a.ctx; getDpr = a.dpr; }

export function tvBubbles(now) {
  const ctx = getCtx(), DPR = getDpr();
  const t = performance.now() / 1000;
  for (const [id, said] of st.tvSay || []) {
    const age = t - said.t, q = st.tvPos && st.tvPos.get(id); if (age > 4.5 || !q || q.x === undefined) continue;
    const P = w2s(q.x, q.y), a = Math.min(1, (4.5 - age) / 0.6), txt = said.text.length > 60 ? said.text.slice(0, 58) + '…' : said.text;
    ctx.save(); ctx.globalAlpha = a; ctx.font = `700 ${15 * DPR}px Barlow Condensed, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(txt).width + 16 * DPR, h = 24 * DPR, x = P.x, y = P.y - 38 * DPR - Math.min(1, age * 6) * 4 * DPR;
    ctx.fillStyle = 'rgba(8,10,14,0.92)'; ctx.strokeStyle = sayCol(q.p); ctx.lineWidth = 2 * DPR;
    ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, 6 * DPR); ctx.moveTo(x - 5 * DPR, y + h / 2); ctx.lineTo(x, y + h / 2 + 7 * DPR); ctx.lineTo(x + 5 * DPR, y + h / 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = sayCol(q.p); ctx.fillText(txt, x, y + DPR); ctx.restore();
  }
}

// The director cuts to where it matters: a plant or defuse, someone shooting or about to meet an enemy, the defuser
// carrier, the last one alive; it stays on someone at least ~3 s unless they die. 1-5 / 6-0 (or a player card) follow
// someone yourself, A goes back to the director, M shows the floor where the action is; the director
// also goes wide on its own now and then (both teams' sight shows there).
export function tvDirector(s, players, now) {
  const T = st.tv; for (const e of s.ev) if (e.e === 'shot') T.shot[e.id] = now;
  // he asked: in preparation, show the defenders setting up (gadgets placed, walls reinforced, doors boarded)
  const prep = s.ph === PHASE.PREP; T.util = T.util || {}; if (!prep) T.prepSeen = null; else T.prepSeen = T.prepSeen || new Set();
  for (const e of s.ev) if (e.e === 'snd' && ['place', 'reinforce', 'panel', 'clamp', 'beep'].includes(e.s)) { let b = null, bd = 90; for (const p of s.players) if (p.a && p.x !== undefined) { const d = Math.hypot(p.x - e.x, p.y - e.y); if (d < bd) { bd = d; b = p; } } if (b) T.util[b.id] = now; }
  // The director, rebuilt the way broadcast observers work (he asked): they read the map for fights that are ABOUT to
  // happen and cut to a player a few seconds before contact (not at the shot, which gives the result away), hold each
  // shot steadily, never leave a fight until it is over, cut to the killer when the player they follow dies, stay with
  // a clutch or a player on a streak, open the action with a map shot, and move on from someone with nothing going on.
  for (const e of s.ev) if (e.e === 'kill' && e.killer) (T.kills || (T.kills = {}))[e.killer] = [...((T.kills || {})[e.killer] || []).filter(t => now - t < 10), now];
  // instant replays: did this camera catch the kill? (the killer or victim followed, or on screen)
  const onScreen = p => { if (!p || p.x === undefined || T.overview) return !!(p && T.overview); const q = w2s(p.x, p.y); return q.x > 0 && q.y > 0 && q.x < innerWidth && q.y < innerHeight; };
  for (const e of s.ev) if (e.e === 'kill' && e.killer) { const k = s.players.find(p => p.id === e.killer), v = st.snaps.length > 1 ? st.snaps[st.snaps.length - 2].players.get(e.victim) : null;
    (T.seen || (T.seen = {}))[e.victim] = e.killer === T.follow || e.victim === T.follow || onScreen(k) || onScreen(v); }
  if (s.ph === PHASE.ACTION && T.lastPh !== PHASE.ACTION) { T.lastPh = s.ph; if (T.auto) { T.overview = true; T.ovUntil = now + 3.5; T.opening = true; T.nextWide = now + 15; } } // the opening map shot
  if (s.ph !== PHASE.ACTION) T.lastPh = s.ph;
  if (T.ovUntil && now > T.ovUntil) { T.ovUntil = 0; T.opening = false; if (T.auto) T.overview = false; }
  const cur = players.get(T.follow), curOk = cur && cur.a && !cur.dn;
  // he asked: show both teams about evenly. Screen time per team is counted (older time fades out over ~2 minutes) and
  // the team that has had less gets a lift that grows with the gap; the more exciting shot still wins when it really is.
  const sdt = Math.min(0.5, now - (T.sqNow || now)); T.sqNow = now; T.sqTime = T.sqTime || [0, 0];
  for (const i of [0, 1]) T.sqTime[i] *= Math.exp(-sdt / 120);
  if (cur && cur.sq !== undefined && !T.overview) T.sqTime[cur.sq] += sdt;
  const share = sq => { const a = T.sqTime[sq], b = T.sqTime[1 - sq]; return (b - a) / Math.max(20, a + b); }; // > 0: this team is owed screen time
  const alive = s.players.filter(p => p.a && !p.dn && p.x !== undefined);
  const fl = p => floorAt(st.map, p.x, p.y), recentShot = (p, w) => now - (T.shot[p.id] || -9) < w;
  const fighting = p => recentShot(p, 1.8) || alive.some(q => q.sq !== p.sq && fl(q) === fl(p) && Math.hypot(q.x - p.x, q.y - p.y) < 260 && recentShot(q, 1.8));
  T.calm = !T.ovUntil && !(curOk && fighting(cur)) && !(T.overview && alive.some(fighting)); // (an instant replay waits for this)
  // he asked: wide shots on the floor where the action is (not always the bomb's floor). Each floor is weighed by who is
  // on it (fights count triple, a plant/defuse more); the wide shot frames the players there (T.ovPts), and the floor
  // only changes when another one clearly leads for over a second, so it doesn't flick between floors.
  const wt = st.map.floors.map(() => 0);
  for (const p of alive) { const f = fl(p); if (f >= 0) wt[f] += 1 + (fighting(p) ? 2 : 0) + (p.bu ? 4 : 0); }
  const top = wt.indexOf(Math.max(...wt));
  if (T.ovFloor === undefined) T.ovFloor = alive.length ? top : undefined;
  else if (alive.length && top !== T.ovFloor && wt[top] > wt[T.ovFloor] + 0.5) { T.ovLead = T.ovLead || now; if (now - T.ovLead > 1.2) { T.ovFloor = top; T.ovLead = 0; } }
  else T.ovLead = 0;
  const onF = alive.filter(p => fl(p) === T.ovFloor), hot = onF.filter(p => fighting(p) || onF.some(q => q.sq !== p.sq && Math.hypot(q.x - p.x, q.y - p.y) < 16 * 36));
  T.ovPts = (hot.length ? hot : onF).map(p => [p.x, p.y]);
  if (!T.auto && curOk) return;
  if (T.ovUntil) return;
  // the followed player died or went down: one beat on it, then the killer (the trade is the story)
  if (cur && (!cur.a || cur.dn)) {
    if (!T.diedT) T.diedT = now;
    if (now - T.diedT < 1.2) return;
    T.diedT = 0;
    const killer = Object.entries(T.kills || {}).filter(([, ts]) => now - ts[ts.length - 1] < 2.5).map(([id]) => players.get(id)).find(q => q && q.a && !q.dn);
    if (killer) { T.follow = killer.id; T.cutT = now; send({ t: 'tv', a: 'follow', id: killer.id }); return; }
  } else T.diedT = 0;
  const score = p => {
    let sc = 0, contact = 0;
    if (p.bu) sc += 120; // planting / defusing / reviving: the objective
    if (fighting(p)) sc += 70;
    for (const q of alive) { // anticipation: an enemy close on the same floor, and closing in
      if (q.sq === p.sq || fl(q) !== fl(p)) continue;
      const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1, close = -(((q.vx || 0) - (p.vx || 0)) * dx + ((q.vy || 0) - (p.vy || 0)) * dy) / d;
      const tta = close > 5 ? d / close : 99; // seconds until they meet
      contact = Math.max(contact, Math.max(0, 1 - d / 420) * 40 + (tta < 7 ? (7 - tta) * 6 : 0));
    }
    sc += contact;
    const mates = alive.filter(q => q.sq === p.sq).length, foes = alive.filter(q => q.sq !== p.sq).length;
    if (mates === 1 && foes >= 1) sc += 35 + foes * 8; // a clutch
    sc += Math.min(3, ((T.kills || {})[p.id] || []).length) * 12; // a hot streak
    if (p.df) sc += 12;
    sc += Math.max(0, share(p.sq)) * 60; // the team that has been on screen less
    if (s.pl && p.tm === 'def') sc += Math.max(0, 30 - Math.hypot(s.pl.x - p.x, s.pl.y - p.y) / 12); // the retake
    if (prep && p.tm === 'def') { if (now - (T.util[p.id] || -9) < 4) sc += 30; if (!T.prepSeen.has(p.id)) sc += 12; if (s.ents.some(e => e.tm === 'def' && Math.hypot(e.x - p.x, e.y - p.y) < 80)) sc += 6; }
    return sc;
  };
  const held = now - (T.cutT || -99);
  const curSc = curOk ? score(cur) : -1;
  if (curOk && fighting(cur)) return; // never cut away from a fight in progress
  const quiet = curOk && curSc < 15;
  const minHold = prep ? 9 : 7; // he asked: it cut too often
  if (curOk && held < minHold) return;
  // he asked: show both teams' viewpoints more from the wide angle. The director goes wide for 5 s (both teams' sight
  // drawn in their colours) when players of both sides are closing in on one floor before anyone fires, or when nothing
  // much is going on; at most every ~20 s, never in preparation and never out of a fight.
  if (!prep && now > (T.nextWide || 0)) {
    const standoff = new Set(hot.map(p => p.sq)).size === 2 && hot.length >= 3 && !alive.some(fighting);
    if (standoff || (quiet && held > 10)) { T.overview = true; T.ovUntil = now + 5; T.nextWide = now + 18 + Math.random() * 8; return; }
  }
  let best = null, bs = -1;
  for (const p of alive) { const sc = score(p) + Math.random() * 2 + (p.id === T.follow ? 18 - (quiet ? Math.max(0, held - 12) * 3 : 0) : 0); if (sc > bs) { bs = sc; best = p; } }
  if (!best || best.id === T.follow) return;
  if (curOk && bs < curSc * 1.7 + 30 && !(quiet && held > 16)) return; // only a much better shot is worth a cut
  T.follow = best.id; T.cutT = now; if (T.prepSeen) T.prepSeen.add(best.id); send({ t: 'tv', a: 'follow', id: best.id });
}
function tvFollow(id) { const T = st.tv; T.auto = !id; T.overview = false; if (id) { T.follow = id; T.cutT = performance.now() / 1000; send({ t: 'tv', a: 'follow', id }); } }
export function tvKey(e) {
  const s = st.last; if (!s) return false;
  const d = '1234567890'.indexOf(e.key);
  if (d >= 0) { const sq = d < 5 ? 0 : 1, list = s.players.filter(p => p.sq === sq), p = list[d % 5]; if (p) { audio.ui(); tvFollow(p.id); } return true; }
  if (e.code === 'KeyA') { audio.ui(); st.tv.auto = !st.tv.auto; st.tv.overview = false; return true; } // he asked: switch the director off to stay on whoever you're watching
  if (e.code === 'KeyM') { audio.ui(); st.tv.overview = !st.tv.overview; return true; }
  return false;
}
// the colour a player "speaks" in (he asked: thematic per character): their operator's own hue, kept bright enough to read
const OP_HUE = op => { let h = 0; for (const c of String(op)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const sayCol = p => `hsl(${OP_HUE(p.op)}, 85%, 68%)`;
// the casters' view of the match (casters.js), Pro matches in Esports TV only
function castCtx(s, players) {
  const pro = (s.tvl ?? PRO_LEVEL) === PRO_LEVEL;
  return { players, mapName: (MAPS[s.mp] || {}).name || 'this map', opName: o => (OPERATORS[o] || {}).name || '?',
    teamName: sq => pro && PRO_TEAMS[sq] ? PRO_TEAMS[sq].name : sq ? 'Orange' : 'Blue',
    alive: () => [0, 1].map(sq => s.players.filter(p => p.sq === sq && p.a).length) };
}
export function tvCasters(s, players) {
  const on = !!st.tv && (s.tvl ?? PRO_LEVEL) === PRO_LEVEL;
  castTick(on);
  if (!on) return;
  const ctx = castCtx(s, players), ph = s.ph === PHASE.SELECT ? 'select' : s.ph === PHASE.PREP ? 'prep' : s.ph === PHASE.ACTION ? 'action' : null, key = s.rd + ph;
  if (ph && st.castPh !== key) { if (s.rd === 1 && ph === 'select') castReset(); st.castPh = key; castPhase(ph, s, ctx); }
  for (const e of s.ev || []) castEvent(e, ctx);
}
export function tvHud(s) {
  const pro = (s.tvl ?? PRO_LEVEL) === PRO_LEVEL, now = performance.now() / 1000;
  for (const sq of [0, 1]) { const T = PRO_TEAMS[sq], el = $(sq ? 'tvR' : 'tvL');
    const name = pro ? `[${T.tag}] ${esc(T.name)}` : `${sq ? 'ORANGE' : 'BLUE'} · ${esc(RANKS[s.tvl] || '').toUpperCase()} LOBBY`, colour = pro ? T.colour : sq ? '#ff8a3d' : '#46a8ff';
    const head = `<div class="tvTeam" style="--tc:${colour}">${name}<small>${s.sc[sq]} · ${s.round || s.rd ? (s.players.find(p => p.sq === sq)?.tm === 'atk' ? 'ATTACK' : 'DEFENCE') : ''}</small></div>`;
    const list = s.players.filter(p => p.sq === sq), key = list.map(p => p.id).join(',') + pro;
    if (el.dataset.k !== key) { // build the cards once per line-up; after that only their contents change (the webcams keep running)
      el.dataset.k = key;
      el.innerHTML = '<div class="tvHead"></div>' + list.map(p => `<button class="tvCard" data-id="${p.id}"><canvas class="tvCam" width="120" height="90"></canvas><div><b></b><span></span></div><i></i></button>`).join('');
      for (const b of el.querySelectorAll('.tvCard')) b.onclick = () => { audio.ui(); tvFollow(b.dataset.id); };
    }
    setHTML(el.querySelector('.tvHead'), head);
    for (const p of list) { const b = el.querySelector(`[data-id="${p.id}"]`); if (!b) continue; const o = OPERATORS[p.op], hp = p.a ? Math.max(0, p.hp || 0) / (p.mhp || 100) : 0;
      b.className = `tvCard ${p.a ? '' : 'dead'} ${p.dn ? 'down' : ''} ${p.id === st.tv.follow ? 'on' : ''}`;
      setHTML(b.querySelector('b'), `${esc(p.n.replace(/^\[\w+\] /, ''))}${p.df ? ' <em>◆</em>' : ''}`); setHTML(b.querySelector('span'), o ? esc(o.name) : '—'); b.querySelector('i').style.width = Math.round(hp * 100) + '%';
      b.querySelector('b').style.color = sayCol(p);
      const said = st.tvSay && st.tvSay.get(p.id), cv = b.querySelector('canvas');
      if (now - (cv._t || 0) > 0.07) { cv._t = now; drawWebcam(cv, { name: p.n, pro, colour, talking: !!said && now - said.t < 2.5, dead: !p.a, down: p.dn }, now); }
    } }
  setHTML('tvHelp', `${st.tv.req && st.tv.req.length ? 'REQUESTED: ' + st.tv.req.map(o => OPERATORS[o]?.name).join(', ') + ' · ' : ''}${st.tv.overview ? 'MAP OVERVIEW' : st.tv.auto ? 'AUTO DIRECTOR' : 'FOLLOWING'} · 1-5 / 6-0 follow a player · A director ${st.tv.auto ? 'off' : 'on'} · M map · Esc menu`);
}
// ESPORTS TV picking screen (he asked: two-sided like esports, with R6 bans): blue team down the left, orange down the
// right, the bans in the middle one at a time with a BANNED stamp, then each player's operator flips in on their card.
// Built once per round; after that only what changed is touched. Team talk shows in the comms boxes under each side.
export function tvDraft(s) {
  const el = $('tvDraft'), pro = (s.tvl ?? PRO_LEVEL) === PRO_LEVEL;
  const team = sq => { const T = PRO_TEAMS[sq]; return pro && T ? { name: T.name, tag: T.tag, col: T.colour } : { name: sq ? 'ORANGE' : 'BLUE', tag: sq ? 'ORG' : 'BLU', col: sq ? '#ff8a3d' : '#46a8ff' }; };
  const sideOf = sq => (s.players.find(p => p.sq === sq) || {}).tm;
  const key = s.rd + '|' + s.players.map(p => p.id).join(',') + pro;
  if (el.dataset.k !== key) {
    el.dataset.k = key;
    const col = sq => { const t = team(sq), sd = sideOf(sq);
      return `<div class="tdTeam" style="--tc:${t.col}"><div class="tdName">${pro ? `<em>${t.tag}</em>` : ''}${esc(t.name.toUpperCase())}<small>${s.sc[sq]} · ${sd === 'atk' ? 'ATTACK' : 'DEFENCE'}</small></div>` +
        s.players.filter(p => p.sq === sq).map(p => `<div class="tdCard" data-id="${p.id}"><canvas width="120" height="120"></canvas><div><b>${esc(p.n.replace(/^\[\w+\] /, ''))}</b><span class="tdRole"></span><span class="tdOp"></span></div></div>`).join('') + '</div>'; };
    const M = MAPS[s.mp] || {};
    el.innerHTML = `<div class="tdBg"></div><div class="tdTop"><small>ROUND ${s.rd} · ${esc((M.name || '').toUpperCase())}</small><b class="tdPhase"></b><span class="tdSub"></span></div>` +
      `<div class="tdGrid">${col(0)}<div class="tdBans"><h4>ATTACKERS BANNED</h4><div class="tdRow" data-s="atk"></div><h4>DEFENDERS BANNED</h4><div class="tdRow" data-s="def"></div></div>${col(1)}</div>`;
    const bg = el.querySelector('.tdBg'); if (MAPS[s.mp]) { const c = mapThumb(s.mp).cloneNode(); c.getContext('2d').drawImage(mapThumb(s.mp), 0, 0); bg.appendChild(c); }
  }
  const bans = s.bn || [], q = s.bq;
  for (const sd of ['atk', 'def']) {
    const row = el.querySelector(`.tdRow[data-s="${sd}"]`), list = bans.filter(b => OPERATORS[b[0]] && OPERATORS[b[0]].team === sd);
    const want = list.map(b => b[0]).join(',') + (q && q[1] === sd ? '|q' + q[0] : '');
    if (row.dataset.k === want) continue;
    const had = new Set((row.dataset.k || '').split('|')[0].split(','));
    row.dataset.k = want;
    row.innerHTML = list.map(([op, sq, rd]) => `<div class="tdBan${had.has(op) ? '' : ' new'}" style="--tc:${team(sq).col}"><canvas width="90" height="90" data-op="${op}"></canvas><b>${esc(OPERATORS[op].name)}</b><span>${esc(team(sq).tag)} · R${rd}</span><i>BANNED</i></div>`).join('') +
      (q && q[1] === sd ? `<div class="tdBan wait" style="--tc:${team(q[0]).col}"><div class="tdQ">?</div><b>${esc(team(q[0]).tag)}</b><span>BANNING…</span></div>` : '');
    for (const c of row.querySelectorAll('canvas')) portraitCached(c, c.dataset.op);
  }
  setHTML(el.querySelector('.tdPhase'), q ? 'BAN PHASE' : 'OPERATOR SELECT');
  setHTML(el.querySelector('.tdSub'), q ? `<span style="color:${team(q[0]).col}">${esc(team(q[0]).name.toUpperCase())}</span> ban ${q[1] === 'atk' ? 'an attacker' : 'a defender'} · ${q[3] + 1} / ${q[4]} · ${Math.ceil(q[2])}`
    : s.players.every(p => p.lk) ? 'ALL LOCKED IN' : 'TEAM TALK · PICKING');
  for (const p of s.players) {
    const c = el.querySelector(`.tdCard[data-id="${p.id}"]`); if (!c) continue;
    const job = p.jb && (JOBS[p.tm] || []).find(j => j.id === p.jb), cv = c.querySelector('canvas');
    setHTML(c.querySelector('.tdRole'), job ? esc(job.name.toUpperCase()) : '');
    setHTML(c.querySelector('.tdOp'), p.op && OPERATORS[p.op] ? esc(OPERATORS[p.op].name) : q ? '' : 'CHOOSING…');
    c.classList.toggle('lk', !!p.lk);
    if ((cv.dataset.op || '') !== (p.op || '')) {
      cv.dataset.op = p.op || '';
      if (p.op) { portraitCached(cv, p.op); c.classList.remove('flip'); void c.offsetWidth; c.classList.add('flip'); }
      else cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
    }
  }
}
