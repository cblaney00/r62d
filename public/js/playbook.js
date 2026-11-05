// The PLAYBOOK (he asked: a tab to see the pro teams' game plans and try to execute them). Pick a team, a map, a site
// and attack or defence; each plan is drawn on the site's floor: where every job stacks, what it opens, where it
// drones, holds or roams, and where it ends up, with the team's players and what each one does.
import { CELL, DUR } from '/shared/constants.js';
import { MAPS, MAP_LIST, buildMap } from '/shared/map.js';
import { OPERATORS, WEAPONS, RIOT, ATTACH, LOADOUTS, JOBS, SIDEARMS } from '/shared/operators.js';
import { PRO_TEAMS, playbook, ATK_JOBS, DEF_JOBS, JOB_NAME } from '/shared/pros.js';
import { MapRenderer } from './mapdraw.js';
import { drawWebcam } from './webcam.js';
import * as audio from './audio.js';

const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const JOB_COL = { breach: '#ff7a3d', entry: '#ff4f6a', intel: '#5ec8ff', support: '#8be38b', flank: '#d79bff', anchor: '#ffcf5a', trapper: '#ff7a3d', roamer: '#d79bff' };
let S = null;

export function openPlaybook(el) {
  el.classList.remove('hidden');
  fetch('/api/training').then(r => r.json()).then(t => { if (S) { S.train = t; render(el); } }).catch(() => {});
  if (!S) S = { team: 0, id: MAP_LIST[0], side: 'atk', site: 0, plan: 0 };
  S.resize = () => draw(el); addEventListener('resize', S.resize);
  render(el);
}
export function closePlaybook(el) {
  el.classList.add('hidden');
  if (S && S.anim) { cancelAnimationFrame(S.anim.raf); S.anim = null; }
  if (S) { removeEventListener('resize', S.resize); S.rend = null; S.map = null; S.loaded = null; }
}

function render(el) {
  const T = PRO_TEAMS[S.team], side = S.side;
  el.querySelector('#pbTeams').innerHTML = PRO_TEAMS.map((t, i) => `<button data-i="${i}" class="${i === S.team ? 'on' : ''}" style="--tc:${t.colour}"><b>[${t.tag}] ${esc(t.name)}</b><span>${esc(t.style)}</span></button>`).join('')
    + `<h4>Players</h4><p class="dim small">Click a player for what they play this patch, and why.</p>` + T.players.map(p => `<div class="pbPlayer${S.openPro === p.name ? ' open' : ''}" data-pro="${esc(p.name)}"><canvas class="pbCam" width="96" height="72" data-n="[${T.tag}] ${esc(p.name)}"></canvas><b>${esc(p.name)}${p.igl ? ' <em>IGL</em>' : ''}</b><span>${esc(JOB_NAME[p.jobs[side]] || p.jobs[side])}: ${p.pool[side].map(o => esc(OPERATORS[o].name)).join(' / ')} <i>· favourites, plays every ${esc((JOB_NAME[p.jobs[side]] || '').toLowerCase())} operator</i></span><ul>${p.traits.map(t => `<li>${esc(t)}</li>`).join('')}</ul>${S.openPro === p.name ? patchCard(p, side) : ''}</div>`).join('');
  for (const c of el.querySelectorAll('.pbCam')) drawWebcam(c, { name: c.dataset.n, pro: true, colour: T.colour }, 1); // the same face as on the broadcast
  for (const d of el.querySelectorAll('.pbPlayer')) d.onclick = () => { audio.ui(); S.openPro = S.openPro === d.dataset.pro ? null : d.dataset.pro; render(el); };
  for (const b of el.querySelectorAll('#pbTeams button')) b.onclick = () => { audio.ui(); S.team = +b.dataset.i; S.plan = 0; render(el); };
  el.querySelector('#pbMaps').innerHTML = MAP_LIST.map(k => `<button data-id="${k}" class="${k === S.id ? 'on' : ''}">${esc(MAPS[k].name)}</button>`).join('');
  for (const b of el.querySelectorAll('#pbMaps button')) b.onclick = () => { audio.ui(); S.id = b.dataset.id; S.site = 0; S.plan = 0; render(el); };
  el.querySelector('#pbSide').innerHTML = ['atk', 'def'].map(s => `<button data-s="${s}" class="${s === side ? 'on' : ''}">${s === 'atk' ? 'ATTACK' : 'DEFENCE'}</button>`).join('');
  for (const b of el.querySelectorAll('#pbSide button')) b.onclick = () => { audio.ui(); S.side = b.dataset.s; S.plan = 0; render(el); };
  if (S.loaded !== S.id) {
    const cv = el.querySelector('#pbCanvas'), c = cv.getContext('2d'); fit(cv);
    c.fillStyle = '#0b0e12'; c.fillRect(0, 0, cv.width, cv.height); c.fillStyle = 'rgba(255,255,255,0.6)'; c.font = '600 22px Barlow Condensed, sans-serif'; c.textAlign = 'center'; c.fillText('Drawing the map…', cv.width / 2, cv.height / 2);
    const want = S.id;
    setTimeout(() => { if (S.id !== want) return; S.map = buildMap(want); S.rend = new MapRenderer(S.map, S.map.tiles.slice(), 0.6); S.loaded = want; render(el); }, 30);
    return;
  }
  const m = S.map;
  el.querySelector('#pbSites').innerHTML = m.sites.map((s, i) => `<button data-i="${i}" class="${i === S.site ? 'on' : ''}">${esc(s.name)}</button>`).join('');
  for (const b of el.querySelectorAll('#pbSites button')) b.onclick = () => { audio.ui(); S.site = +b.dataset.i; S.plan = 0; render(el); };
  S.plans = playbook(m, S.site, side, T);
  S.plan = Math.min(S.plan, S.plans.length - 1);
  const won = p => { const r = S.train && S.train.plans[`${S.id}|${S.site}|${side}|${p.id}`]; return r && r.n >= 3 ? ` · won ${Math.round(r.w / r.n * 100)}% in practice (${r.n})` : ''; }; // what practice says
  el.querySelector('#pbPlans').innerHTML = S.plans.map((p, i) => `<button data-i="${i}" class="${i === S.plan ? 'on' : ''}">${esc(p.name)}<span>${esc(p.tempo)}${p.go !== undefined ? ' · go at ' + clock(p.go) : ''}${won(p)}</span></button>`).join('');
  for (const b of el.querySelectorAll('#pbPlans button')) b.onclick = () => { audio.ui(); if (S.anim) { cancelAnimationFrame(S.anim.raf); S.anim = null; } S.plan = +b.dataset.i; render(el); };
  const plan = S.plans[S.plan], jobs = side === 'atk' ? ATK_JOBS : DEF_JOBS;
  el.querySelector('#pbDetail').innerHTML = !plan ? '<p class="dim">No plan for this site.</p>' : `<h3>${esc(plan.name)}</h3><p>${esc(plan.idea)}</p>`
    + jobs.map(j => { const t = plan.jobs[j]; if (!t) return ''; const pl = T.players.find(p => p.jobs[side] === j);
      return `<div class="pbJob" style="--jc:${JOB_COL[j]}"><b>${esc(JOB_NAME[j] || j)}${pl ? ' · ' + esc(pl.name) : ''}</b><span>${esc(t.task)}</span></div>`; }).join('')
    + (plan ? `<button id="pbWatch" class="primary">${S.anim ? '■ STOP' : '▶ WATCH THIS PLAY'}</button>` : '')
    + `<p class="dim small">Their leader changes the plan during the round when it goes wrong: two players down early, the clock under a minute, the way in stacked with defenders (switch to the other way in), or a plant to retake.</p>`;
  const wb = el.querySelector('#pbWatch'); if (wb) wb.onclick = () => { audio.ui(); if (S.anim) stopAnim(el); else startAnim(el); };
  draw(el);
}
// ---------------- a pro's patch (he asked: what they like to play this patch and why: operators, guns, attachments, tactics) ----------------
// From practice on this version (server/training.js: pro[name] = { ops, guns, att } as [rounds, wins, kills, deaths],
// plans per map|site|side|plan). The pros pick by these numbers, so the reasons are the real ones.
const gunName = w => (WEAPONS[w] && WEAPONS[w].name) || (RIOT[w] && RIOT[w].name) || w;
const kd = r => r[3] ? r[2] / r[3] : r[2];
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const f1 = x => (Math.round(x * 10) / 10).toFixed(1);
function patchCard(pl, side) {
  const P = S.train && S.train.pro && S.train.pro[pl.name];
  if (!S.train) return '<div class="pbPatch"><p class="dim">Loading practice results…</p></div>';
  if (!P) return '<div class="pbPatch"><p class="dim">No practice on this patch yet: press TRAIN THE PROS.</p></div>';
  const job = pl.jobs[side], jobOps = (JOBS[side].find(j => j.id === job) || { ops: [] }).ops;
  const ops = jobOps.map(o => [o, P.ops[o]]).filter(([, r]) => r && r[0]).sort((a, b) => b[1][0] - a[1][0]);
  const rounds = ops.reduce((a, [, r]) => a + r[0], 0), out = [];
  out.push(`<h5>THIS PATCH · ${side === 'atk' ? 'ATTACK' : 'DEFENCE'}</h5><p class="dim small">${rounds} practice rounds as ${esc(JOB_NAME[job] || job)} on this version.</p>`);
  if (!ops.length) return `<div class="pbPatch">${out.join('')}<p class="dim">Not enough practice on this side yet.</p></div>`;
  // operators: most played first, and why
  const bestKd = Math.max(...ops.map(([, r]) => kd(r))), bestWin = Math.max(...ops.map(([, r]) => r[1] / r[0]));
  out.push('<b>Operators</b><ul>' + ops.slice(0, 4).map(([o, r], i) => {
    const w = pct(r[1], r[0]), k = kd(r), why = r[0] < 4 ? 'still trying it out'
      : i === 0 && k >= bestKd - 0.01 && r[1] / r[0] >= bestWin - 0.01 ? 'the strongest of the role so far: best fights and rounds won'
      : i === 0 && k >= bestKd - 0.01 ? 'wins the most fights of the role'
      : i === 0 && r[1] / r[0] >= bestWin - 0.01 ? 'the team wins most often with it'
      : i === 0 ? 'the steadiest results over the most rounds'
      : k >= bestKd - 0.01 ? 'great in fights, so it keeps coming back'
      : w < 40 ? 'losing more than winning, being dropped' : 'a solid second choice';
    return `<li><b>${esc(OPERATORS[o].name)}</b> ${pct(r[0], rounds)}% of rounds · won ${w}% · ${f1(k)} K/D · <i>${why}</i></li>`; }).join('') + '</ul>');
  // guns: the ones those operators carry
  const can = new Set(jobOps.flatMap(o => LOADOUTS[o] ? [...LOADOUTS[o].primaries, ...LOADOUTS[o].secondaries] : []));
  const guns = Object.entries(P.guns || {}).filter(([w, r]) => can.has(w) && r[0]).sort((a, b) => b[1][0] - a[1][0]);
  const mains = guns.filter(([w]) => !SIDEARMS.has(w)), top = mains[0] || guns[0];
  if (top) {
    out.push('<b>Guns</b><ul>' + mains.slice(0, 3).map(([w, r], i) => {
      const k = r[2] / r[0], others = mains.filter(([x]) => x !== w), avg = others.length ? others.reduce((a, [, q]) => a + q[2], 0) / Math.max(1, others.reduce((a, [, q]) => a + q[0], 0)) : k;
      const why = r[0] < 4 ? 'only a few rounds with it' : k > avg * 1.1 ? `more kills a round than ${pl.name}'s other guns (${f1(k)} vs ${f1(avg)})` : k < avg * 0.9 ? 'fewer kills than the others' : 'about even with the others';
      return `<li><b>${esc(gunName(w))}</b> ${pct(r[0], mains.reduce((a, [, q]) => a + q[0], 0))}% of rounds · ${f1(k)} kills a round · <i>${why}</i></li>`; }).join('') + '</ul>');
    // attachments on the main gun: the choice used most in each slot, against that slot's other choices
    const w = top[0], att = P.att || {}, rows = [];
    for (const [slot, label] of [['barrel', 'Barrel'], ['grip', 'Grip'], ['sight', 'Sight']]) {
      const cs = Object.entries(att).filter(([k]) => k.startsWith(`${w}|${slot}|`)).map(([k, r]) => [k.split('|')[2], r]).sort((a, b) => b[1][0] - a[1][0]);
      if (!cs.length) continue;
      const [c, r] = cs[0], A = ATTACH[slot][c], k = r[2] / r[0], rest = cs.slice(1), rk = rest.length ? rest.reduce((a, [, q]) => a + q[2], 0) / Math.max(1, rest.reduce((a, [, q]) => a + q[0], 0)) : null;
      const plus = A && A.desc && A.desc.startsWith('+') ? A.desc.split('−')[0].replace('+', '').trim().replace(/\.$/, '').toLowerCase() : '';
      const why = r[0] < 4 ? 'still testing' : rk === null ? 'the only one tried so far' : k > rk * 1.08 ? `${f1(k)} kills a round with it, ${f1(rk)} with the others` : k < rk * 0.92 ? 'kept for the feel, though the others are scoring a bit more' : 'about as good as the rest';
      rows.push(`<li>${label}: <b>${esc(A ? A.short : c)}</b>${plus ? ' (' + esc(plus) + ')' : ''} · ${pct(r[0], cs.reduce((a, [, q]) => a + q[0], 0))}% · <i>${why}</i></li>`);
    }
    if (rows.length) out.push(`<b>On the ${esc(gunName(w))}</b><ul>${rows.join('')}</ul>`);
  }
  // tactics: the team's plays on this side, all maps, with this player's part on the map shown
  const byPlan = {};
  for (const [k, r] of Object.entries(S.train.plans || {})) { const [, , sd, id] = k.split('|'); if (sd !== side) continue; const b = byPlan[id] || (byPlan[id] = { n: 0, w: 0 }); b.n += r.n; b.w += r.w; }
  const names = {}; for (const p of S.plans || []) names[p.id] = p;
  const plays = Object.entries(byPlan).filter(([, b]) => b.n >= 4).sort((a, b) => (b[1].w + 1) / (b[1].n + 2) - (a[1].w + 1) / (a[1].n + 2));
  if (plays.length) {
    out.push('<b>Tactics</b><ul>' + plays.slice(0, 3).map(([id, b]) => { const pn = names[id], task = pn && pn.jobs[job] && pn.jobs[job].task;
      return `<li><b>${esc(pn ? pn.name : id)}</b> won ${pct(b.w, b.n)}% of ${b.n} practice rounds${task ? ` · ${esc(pl.name)}'s part here: ${esc(task)}` : ''}</li>`; }).join('') + '</ul>');
    const worst = plays[plays.length - 1]; if (plays.length > 3 && worst[1].w / worst[1].n < 0.4) out.push(`<p class="dim small">Going off: ${esc((names[worst[0]] || {}).name || worst[0])} (won ${pct(worst[1].w, worst[1].n)}%), so it is called less.</p>`);
  }
  return `<div class="pbPatch">${out.join('')}</div>`;
}

// ---------------- watch a play (he asked: an example of each play playing out, the way a coach would explain it) ----------------
// Straight lines on a whiteboard, not a real match: each player a dot that moves along the plan in time (6× speed),
// captions for each beat, and the other team faded in their usual spots for context.
const SPEED = 6, V = 90; // playback speed; walking speed in world px per game second
function track(pts) { // [[t, x, y], ...] → position at time t
  return t => { if (t <= pts[0][0]) return { x: pts[0][1], y: pts[0][2] }; for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const a = pts[i - 1], b = pts[i], f = (t - a[0]) / Math.max(0.001, b[0] - a[0]); return { x: a[1] + (b[1] - a[1]) * f, y: a[2] + (b[2] - a[2]) * f }; } const z = pts[pts.length - 1]; return { x: z[1], y: z[2] }; };
}
const go2 = (pts, t, to) => { if (!to) return t; const l = pts[pts.length - 1], d = Math.hypot(to.x - l[1], to.y - l[2]), at = Math.max(t, l[0]); pts.push([at, l[1], l[2]], [at + d / V, to.x, to.y]); return at + d / V; };
function script(m, site, plan, side, team) {
  const dots = [], notes = [], name = j => (team.players.find(p => p.jobs[side] === j) || {}).name || j;
  const bombs = site.bombs, plantB = (plan.jobs.support && plan.jobs.support.plant) || bombs[0];
  let end = 0;
  if (side === 'atk') {
    const spawnAt = at => (m.atkSpawns || []).slice().sort((a, b) => Math.hypot(a.x - at.x, a.y - at.y) - Math.hypot(b.x - at.x, b.y - at.y))[0] || at;
    notes.push([-40, `Preparation: drones out. ${plan.name}: ${plan.idea}`]);
    const go = plan.go || 0; let plantT = go + 30;
    Object.entries(plan.jobs).forEach(([j, t], i) => {
      const off = (q, k = 1) => q && { x: q.x + Math.cos(i * 2.2) * (plan.tempo === 'fast' ? 26 : 44) * k, y: q.y + Math.sin(i * 2.2) * (plan.tempo === 'fast' ? 26 : 44) * k }; // spread out at the stack (one grenade can't get them all)
      const first = off(t.fake || t.hold || t.stack || t.target), sp = spawnAt(first), pts = [[-40, sp.x, sp.y], [0, sp.x, sp.y]];
      if (t.drone) { const dp = [[-40, sp.x, sp.y]]; go2(dp, -40, t.drone); dp.push([t.keepDrone ? Math.min(go, t.keepDrone) : 0, t.drone.x, t.drone.y]); dots.push({ j, label: 'drone', p: track(dp), drone: true, until: t.keepDrone ? Math.min(go, t.keepDrone) : 0 }); notes.push([-30, `${name(j)} drones toward the site${t.keepDrone ? ' and keeps the drone there for the push' : ''}.`]); }
      let tt = go2(pts, 0, first);
      if (t.fake) { notes.push([Math.max(tt, go - 20), `${name(j)} fakes: noise and utility at the other way in.`]); pts.push([go, first.x, first.y]); tt = go2(pts, go, off(t.stack)); }
      if (t.hold && t.until) { pts.push([Math.max(tt, t.until), first.x, first.y]); notes.push([0, `${name(j)} holds the rotation route until ${clock(t.until)}.`]); tt = go2(pts, t.until, t.target); }
      if (t.breach != null || t.hatch) notes.push([go - 7, `${name(j)} opens ${t.hatch ? 'the hatch above the site' : 'the wall'}.`]);
      const startGo = Math.max(tt, go + (t.delay || 0)); tt = go2(pts, startGo, t.target);
      if (t.plant) { tt = go2(pts, tt, plantB); plantT = Math.max(plantT, tt); notes.push([tt, `${name(j)} plants the defuser at ${plantB.id}.`]); pts.push([tt + 7, plantB.x, plantB.y]); }
      else { const a = i * 1.26 + 0.4, post = { x: plantB.x + Math.cos(a) * 120, y: plantB.y + Math.sin(a) * 120 }; tt = go2(pts, tt + 2, post); }
      dots.push({ j, label: name(j), p: track(pts) }); end = Math.max(end, tt);
    });
    notes.push([-1, plan.tempo === 'fast' ? 'They run straight in together: no time for the defenders to set up.' : 'Waiting spots are spread a couple of metres apart, so one grenade or gas cloud can\'t catch everyone.']);
    notes.push([go, 'GO: everyone pushes together.']); notes.push([plantT + 8, 'Planted: everyone spreads out round the defuser and holds it from different angles.']);
    end = Math.max(end, plantT + 15);
  } else {
    const c = bombs[0]; notes.push([-40, `Preparation: reinforce, trap the ways in, set up. ${plan.name}: ${plan.idea}`]);
    Object.entries(plan.jobs).forEach(([j, t]) => {
      const pts = [[-40, c.x, c.y]], hold = t.hold && { x: t.hold.x + (j === 'support' ? 40 : 0), y: t.hold.y + (j === 'support' ? 30 : 0) }; let tt = go2(pts, -38, hold);
      if (t.roam) { notes.push([0, `${name(j)} goes out to roam.`]); tt = go2(pts, 0, t.roam); pts.push([t.until, t.roam.x, t.roam.y]); notes.push([t.until, `${name(j)} falls back to the site.`]); tt = go2(pts, t.until, hold); }
      dots.push({ j, label: name(j), p: track(pts) }); end = Math.max(end, tt);
    });
    if (plan.id === 'retake') notes.push([end + 5, 'They plant: everyone comes back in together from three sides.']);
    end += 12;
  }
  notes.sort((a, b) => a[0] - b[0]);
  return { dots, notes, end };
}
function startAnim(el) {
  const m = S.map, site = m.sites[S.site], plan = S.plans[S.plan], T = PRO_TEAMS[S.team];
  const mine = script(m, site, plan, S.side, T), otherSide = S.side === 'atk' ? 'def' : 'atk', O = PRO_TEAMS[1 - S.team];
  const op = playbook(m, S.site, otherSide, O).find(p => p.id === (otherSide === 'def' ? 'hold' : 'default')) || playbook(m, S.site, otherSide, O)[0];
  const them = op ? script(m, site, op, otherSide, O) : { dots: [] };
  S.anim = { t0: performance.now(), mine, them, end: mine.end };
  const loop = () => { if (!S || !S.anim) return; draw(el); const t = -40 + (performance.now() - S.anim.t0) / 1000 * SPEED; if (t > S.anim.end + 4) return stopAnim(el); S.anim.raf = requestAnimationFrame(loop); };
  render(el); S.anim.raf = requestAnimationFrame(loop);
}
function stopAnim(el) { if (S.anim) cancelAnimationFrame(S.anim.raf); S.anim = null; render(el); }
const clock = s => `${Math.floor((DUR.action - s) / 60)}:${String(Math.round((DUR.action - s) % 60)).padStart(2, '0')}`;
function fit(cv) {
  const r = cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(r.width * d) || cv.height !== Math.round(r.height * d)) { cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); }
  return d;
}
function draw(el) {
  if (!S || !S.map || !S.rend || !S.plans) return;
  const cv = el.querySelector('#pbCanvas'), d = fit(cv), c = cv.getContext('2d'), m = S.map, site = m.sites[S.site], plan = S.plans[S.plan];
  const fl = m.flAt[Math.floor(site.bombs[0].y / CELL) * m.W + Math.floor(site.bombs[0].x / CELL)], F = m.floors[fl] || m.floors[0];
  const W = F.w * CELL, H = F.h * CELL, z = Math.min(cv.width / W, cv.height / H) * 0.97, ox = (cv.width - W * z) / 2 - F.gx * CELL * z, oy = (cv.height - H * z) / 2;
  const R = S.rend, k = R.c.width / R.Wp, px = d / z;
  c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#0b0e12'; c.fillRect(0, 0, cv.width, cv.height);
  c.setTransform(z, 0, 0, z, ox, oy); R.c.drawTo(c, F.gx * CELL * k, 0, F.w * CELL * k, F.h * CELL * k, F.gx * CELL, 0, W, H);
  c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(F.gx * CELL, 0, W, H);
  for (const name of site.rooms) for (const r of m.rooms) if (r.name === name) { c.fillStyle = 'rgba(242,193,78,0.18)'; c.fillRect(r.x * CELL, r.y * CELL, r.w * CELL, r.h * CELL); c.strokeStyle = '#f2c14e'; c.lineWidth = 2 * px; c.strokeRect(r.x * CELL, r.y * CELL, r.w * CELL, r.h * CELL); }
  const txt = (s, x, y, col, size = 13) => { c.font = `700 ${size * px}px Barlow Condensed, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 3 * px; c.strokeStyle = 'rgba(0,0,0,0.9)'; c.strokeText(s, x, y); c.fillStyle = col; c.fillText(s, x, y); };
  for (const b of site.bombs) { c.fillStyle = '#f2c14e'; c.beginPath(); c.arc(b.x, b.y, 10 * px, 0, 7); c.fill(); txt(b.id, b.x, b.y, '#000'); }
  if (!plan) return;
  if (S.anim) return drawAnim(c, m, fl, px, txt, cv);
  const on = p => p && (m.flAt[Math.floor(p.y / CELL) * m.W + Math.floor(p.x / CELL)] === fl);
  const arrow = (a, b, col, dash) => {
    if (!on(a) || !on(b)) return; c.strokeStyle = col; c.lineWidth = 2.5 * px; c.setLineDash(dash ? [6 * px, 4 * px] : []);
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); c.setLineDash([]);
    const an = Math.atan2(b.y - a.y, b.x - a.x); c.fillStyle = col; c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x - Math.cos(an - 0.45) * 10 * px, b.y - Math.sin(an - 0.45) * 10 * px); c.lineTo(b.x - Math.cos(an + 0.45) * 10 * px, b.y - Math.sin(an + 0.45) * 10 * px); c.fill();
  };
  const T = PRO_TEAMS[S.team], spots = new Map(); // players sharing a spot are listed together
  for (const [j, t] of Object.entries(plan.jobs)) {
    const col = JOB_COL[j] || '#fff', pl = T.players.find(p => p.jobs[S.side] === j), label = pl ? pl.name : JOB_NAME[j];
    const start = t.fake || t.hold || t.roam || t.stack;
    if (t.drone && on(t.drone)) { c.strokeStyle = col; c.lineWidth = 1.5 * px; c.setLineDash([2 * px, 3 * px]); c.beginPath(); c.arc(t.drone.x, t.drone.y, 18 * px, 0, 7); c.stroke(); c.setLineDash([]); txt('drone', t.drone.x, t.drone.y + 26 * px, col, 11); }
    if (t.roam && on(t.roam)) { c.strokeStyle = col; c.lineWidth = 2 * px; c.setLineDash([5 * px, 4 * px]); c.beginPath(); c.arc(t.roam.x, t.roam.y, 28 * px, 0, 7); c.stroke(); c.setLineDash([]); txt('roam', t.roam.x, t.roam.y + 36 * px, col, 11); }
    if (t.fake && t.stack) arrow(t.fake, t.stack, col, true);
    if (t.stack && t.target) arrow(t.stack, t.target, col, false);
    if (t.hold && t.target && S.side === 'atk') arrow(t.hold, t.target, col, true);
    if (t.hold && t.watch && S.side === 'def' && on(t.hold)) { c.strokeStyle = col + '88'; c.lineWidth = 1.5 * px; c.beginPath(); c.moveTo(t.hold.x, t.hold.y); c.lineTo(t.watch.x, t.watch.y); c.stroke(); }
    if (t.breach !== undefined && t.breach !== null) { const x = (t.breach % m.W + 0.5) * CELL, y = (Math.floor(t.breach / m.W) + 0.5) * CELL; if (on({ x, y })) { c.strokeStyle = '#ff7a3d'; c.lineWidth = 3 * px; c.beginPath(); c.moveTo(x - 8 * px, y - 8 * px); c.lineTo(x + 8 * px, y + 8 * px); c.moveTo(x + 8 * px, y - 8 * px); c.lineTo(x - 8 * px, y + 8 * px); c.stroke(); } }
    const spot = on(start) ? start : on(t.hold) ? t.hold : null;
    if (spot) { const key = Math.round(spot.x / 24) + ',' + Math.round(spot.y / 24), n = spots.get(key) || 0; spots.set(key, n + 1);
      c.fillStyle = col; c.strokeStyle = '#000'; c.lineWidth = 2 * px; c.beginPath(); c.arc(spot.x + n * 7 * px, spot.y, 8 * px, 0, 7); c.fill(); c.stroke(); txt(label, spot.x, spot.y - (16 + n * 14) * px, col, 13); }
    else if (start) txt(`${label} ${S.side === 'atk' ? '(other floor)' : '(other floor)'}`, (t.target || site.bombs[0]).x, (t.target || site.bombs[0]).y + 18 * px, col, 11);
  }
  c.setTransform(1, 0, 0, 1, 0, 0); c.textBaseline = 'alphabetic';
}
function drawAnim(c, m, fl, px, txt, cv) {
  const A = S.anim, t = -40 + (performance.now() - A.t0) / 1000 * SPEED, on = p => m.flAt[Math.floor(p.y / CELL) * m.W + Math.floor(p.x / CELL)] === fl;
  const dot = (d, col, faded) => { if (d.drone && t > d.until) return; const q = d.p(t); if (!on(q)) return;
    c.globalAlpha = faded ? 0.4 : 1; c.fillStyle = col; c.strokeStyle = '#000'; c.lineWidth = 2 * px;
    c.beginPath(); if (d.drone) c.rect(q.x - 5 * px, q.y - 5 * px, 10 * px, 10 * px); else c.arc(q.x, q.y, 9 * px, 0, 7); c.fill(); c.stroke();
    if (!faded) txt(d.label, q.x, q.y - 17 * px, col, 13); c.globalAlpha = 1; };
  for (const d of A.them.dots) dot(d, PRO_TEAMS[1 - S.team].colour, true);
  for (const d of A.mine.dots) dot(d, JOB_COL[d.j] || '#fff', false);
  c.setTransform(1, 0, 0, 1, 0, 0); // the clock and the coach's caption
  const note = A.mine.notes.filter(n => n[0] <= t).pop(), d = Math.min(2, window.devicePixelRatio || 1);
  c.fillStyle = 'rgba(0,0,0,0.7)'; c.fillRect(0, 0, cv.width, 54 * d);
  c.font = `800 ${22 * d}px Barlow Condensed, sans-serif`; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = '#f2c14e';
  c.fillText(t < 0 ? `PREP 0:${String(Math.ceil(-t)).padStart(2, '0')}` : clock(t), 14 * d, 27 * d);
  c.font = `600 ${15 * d}px Barlow, sans-serif`; c.fillStyle = '#fff';
  if (note) { const words = note[1].split(' '); let line = '', y = 18 * d; for (const w of words) { if (c.measureText(line + w).width > cv.width - 140 * d) { c.fillText(line, 110 * d, y); line = ''; y += 18 * d; } line += w + ' '; } c.fillText(line, 110 * d, y); }
  c.textBaseline = 'alphabetic';
}
