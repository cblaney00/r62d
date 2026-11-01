// The PLAYBOOK (he asked: a tab to see the pro teams' game plans and try to execute them). Pick a team, a map, a site
// and attack or defence; each plan is drawn on the site's floor: where every job stacks, what it opens, where it
// drones, holds or roams, and where it ends up, with the team's players and what each one does.
import { CELL } from '/shared/constants.js';
import { MAPS, MAP_LIST, buildMap } from '/shared/map.js';
import { OPERATORS } from '/shared/operators.js';
import { PRO_TEAMS, playbook, ATK_JOBS, DEF_JOBS, JOB_NAME } from '/shared/pros.js';
import { MapRenderer } from './mapdraw.js';
import * as audio from './audio.js';

const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const JOB_COL = { breach: '#ff7a3d', entry: '#ff4f6a', intel: '#5ec8ff', support: '#8be38b', flank: '#d79bff', anchor: '#ffcf5a', trapper: '#ff7a3d', roamer: '#d79bff' };
let S = null;

export function openPlaybook(el) {
  el.classList.remove('hidden');
  if (!S) S = { team: 0, id: MAP_LIST[0], side: 'atk', site: 0, plan: 0 };
  S.resize = () => draw(el); addEventListener('resize', S.resize);
  render(el);
}
export function closePlaybook(el) {
  el.classList.add('hidden');
  if (S) { removeEventListener('resize', S.resize); S.rend = null; S.map = null; S.loaded = null; }
}

function render(el) {
  const T = PRO_TEAMS[S.team], side = S.side;
  el.querySelector('#pbTeams').innerHTML = PRO_TEAMS.map((t, i) => `<button data-i="${i}" class="${i === S.team ? 'on' : ''}" style="--tc:${t.colour}"><b>[${t.tag}] ${esc(t.name)}</b><span>${esc(t.style)}</span></button>`).join('')
    + `<h4>Players</h4>` + T.players.map(p => `<div class="pbPlayer"><b>${esc(p.name)}${p.igl ? ' <em>IGL</em>' : ''}</b><span>${esc(JOB_NAME[p.jobs[side]] || p.jobs[side])}: ${p.pool[side].map(o => esc(OPERATORS[o].name)).join(' / ')}</span><ul>${p.traits.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`).join('');
  for (const b of el.querySelectorAll('#pbTeams button')) b.onclick = () => { audio.ui(); S.team = +b.dataset.i; S.plan = 0; render(el); };
  el.querySelector('#pbMaps').innerHTML = MAP_LIST.map(k => `<button data-id="${k}" class="${k === S.id ? 'on' : ''}">${esc(MAPS[k].name)}</button>`).join('');
  for (const b of el.querySelectorAll('#pbMaps button')) b.onclick = () => { audio.ui(); S.id = b.dataset.id; S.site = 0; S.plan = 0; render(el); };
  el.querySelector('#pbSide').innerHTML = ['atk', 'def'].map(s => `<button data-s="${s}" class="${s === side ? 'on' : ''}">${s === 'atk' ? 'ATTACK' : 'DEFENCE'}</button>`).join('');
  for (const b of el.querySelectorAll('#pbSide button')) b.onclick = () => { audio.ui(); S.side = b.dataset.s; S.plan = 0; render(el); };
  if (S.loaded !== S.id) {
    const cv = el.querySelector('#pbCanvas'), c = cv.getContext('2d'); fit(cv);
    c.fillStyle = '#0b0e12'; c.fillRect(0, 0, cv.width, cv.height); c.fillStyle = 'rgba(255,255,255,0.6)'; c.font = '600 22px Barlow Condensed, sans-serif'; c.textAlign = 'center'; c.fillText('Drawing the map…', cv.width / 2, cv.height / 2);
    const want = S.id;
    setTimeout(() => { if (S.id !== want) return; S.map = buildMap(want); S.rend = new MapRenderer(S.map, S.map.tiles.slice(), 0.25); S.loaded = want; render(el); }, 30);
    return;
  }
  const m = S.map;
  el.querySelector('#pbSites').innerHTML = m.sites.map((s, i) => `<button data-i="${i}" class="${i === S.site ? 'on' : ''}">${esc(s.name)}</button>`).join('');
  for (const b of el.querySelectorAll('#pbSites button')) b.onclick = () => { audio.ui(); S.site = +b.dataset.i; S.plan = 0; render(el); };
  S.plans = playbook(m, S.site, side, T);
  S.plan = Math.min(S.plan, S.plans.length - 1);
  el.querySelector('#pbPlans').innerHTML = S.plans.map((p, i) => `<button data-i="${i}" class="${i === S.plan ? 'on' : ''}">${esc(p.name)}<span>${esc(p.tempo)}${p.go !== undefined ? ' · go at ' + clock(p.go) : ''}</span></button>`).join('');
  for (const b of el.querySelectorAll('#pbPlans button')) b.onclick = () => { audio.ui(); S.plan = +b.dataset.i; render(el); };
  const plan = S.plans[S.plan], jobs = side === 'atk' ? ATK_JOBS : DEF_JOBS;
  el.querySelector('#pbDetail').innerHTML = !plan ? '<p class="dim">No plan for this site.</p>' : `<h3>${esc(plan.name)}</h3><p>${esc(plan.idea)}</p>`
    + jobs.map(j => { const t = plan.jobs[j]; if (!t) return ''; const pl = T.players.find(p => p.jobs[side] === j);
      return `<div class="pbJob" style="--jc:${JOB_COL[j]}"><b>${esc(JOB_NAME[j] || j)}${pl ? ' · ' + esc(pl.name) : ''}</b><span>${esc(t.task)}</span></div>`; }).join('')
    + `<p class="dim small">Their leader changes the plan during the round when it goes wrong: two players down early, the clock under a minute, the way in stacked with defenders (switch to the other way in), or a plant to retake.</p>`;
  draw(el);
}
const clock = s => `${Math.floor((180 - s) / 60)}:${String(Math.round((180 - s) % 60)).padStart(2, '0')}`;
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
  c.setTransform(z, 0, 0, z, ox, oy); c.drawImage(R.c, F.gx * CELL * k, 0, F.w * CELL * k, F.h * CELL * k, F.gx * CELL, 0, W, H);
  c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(F.gx * CELL, 0, W, H);
  for (const name of site.rooms) for (const r of m.rooms) if (r.name === name) { c.fillStyle = 'rgba(242,193,78,0.18)'; c.fillRect(r.x * CELL, r.y * CELL, r.w * CELL, r.h * CELL); c.strokeStyle = '#f2c14e'; c.lineWidth = 2 * px; c.strokeRect(r.x * CELL, r.y * CELL, r.w * CELL, r.h * CELL); }
  const txt = (s, x, y, col, size = 13) => { c.font = `700 ${size * px}px Barlow Condensed, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 3 * px; c.strokeStyle = 'rgba(0,0,0,0.9)'; c.strokeText(s, x, y); c.fillStyle = col; c.fillText(s, x, y); };
  for (const b of site.bombs) { c.fillStyle = '#f2c14e'; c.beginPath(); c.arc(b.x, b.y, 10 * px, 0, 7); c.fill(); txt(b.id, b.x, b.y, '#000'); }
  if (!plan) return;
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
