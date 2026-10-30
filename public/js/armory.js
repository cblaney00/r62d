// The Armory: a private shooting range in the menus. Pick any gun, shoot dummies at different
// distances and read its numbers. Runs only in your browser (nobody else sees it), using the same
// damage, drop-off, spread, aim-in time, recoil and headshot rules as the server.
import { WEAPONS, OPERATORS, OP_LIST, ADS_TIME, RECOIL, FALLOFF, HEAD_R, HIT_R, ARMOR_HP, CLASS_NAME, CLASS_TIP, ATTACH, ATTACH_SLOTS, attachFor, cleanAtt, gunMods, settleTime, aimHeat, spreadCone, shotOffset, recoilStep, recoilMax, adsTime, recoilOf, falloffOf, sprayWords, SPRAY, gunSide } from '/shared/operators.js';
import { gunPicture } from './gunart.js';
import { drawOperator } from './sprites.js';
import * as audio from './audio.js';

const M = 20; // world pixels per metre (same scale as the in-game distance markers)
const DISTS = [5, 10, 20, 30, 45];
const CLASS_ORDER = ['AR', 'SMG', 'MP', 'LMG', 'DMR', 'Shotgun', 'Pistol'];
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const fallAt = (w, d, rm = 1) => { const F = falloffOf(w), fo = { from: F.from * rm, to: F.to * rm, min: F.min }; return d <= fo.from ? 1 : d >= fo.to ? fo.min : 1 - (1 - fo.min) * (d - fo.from) / (fo.to - fo.from); };
const attOf = w => cleanAtt(w, S.att[w]);
const modsOf = w => gunMods(w, attOf(w));

let S = null; // range state while open

export function openArmory(el) {
  el.classList.remove('hidden');
  if (!S) S = { att: {}, w: 'k4', dist: 10, dummies: [], holes: [], pops: [], tracers: [], ammo: 0, reloadT: 0, fireCd: 0, adsT: 0, bloom: 0, rc: 0, shots: 0, rcDir: 1, lastShot: -9, mouse: { x: 0, y: 0, l: false, r: false, edge: false }, t: 0, hits: 0, fired: 0, first: null, kills: 0 };
  renderList(el); pick(el, S.w);
  const cv = el.querySelector('#armCanvas');
  cv.onmousemove = e => { const r = cv.getBoundingClientRect(); S.mouse.x = (e.clientX - r.left) * cv.width / r.width; S.mouse.y = (e.clientY - r.top) * cv.height / r.height; };
  cv.onmousedown = e => { audio.initAudio(); if (e.button === 0) { S.mouse.l = true; S.mouse.edge = true; S.clickT = S.t; } if (e.button === 2) S.mouse.r = true; };
  cv.oncontextmenu = e => e.preventDefault();
  S.up = e => { if (e.button === 0) S.mouse.l = false; if (e.button === 2) S.mouse.r = false; };
  S.key = e => { if (e.code === 'KeyR') reload(); };
  addEventListener('mouseup', S.up); addEventListener('keydown', S.key);
  for (const b of el.querySelectorAll('#armDist button')) b.onclick = () => { audio.ui(); S.dist = +b.dataset.d; resetRange(el); };
  el.querySelector('#armReset').onclick = () => { audio.ui(); resetRange(el); };
  let last = performance.now();
  const loop = now => { S.raf = requestAnimationFrame(loop); const dt = Math.min(0.05, (now - last) / 1000); last = now; tick(el, dt); draw(cv); };
  S.raf = requestAnimationFrame(loop);
}
export function closeArmory(el) {
  el.classList.add('hidden');
  if (!S) return;
  cancelAnimationFrame(S.raf); removeEventListener('mouseup', S.up); removeEventListener('keydown', S.key);
  S.mouse.l = S.mouse.r = false;
}

function renderList(el) {
  const sideN = k => gunSide(k) === 'def' ? 1 : 0; // attack guns first, then defence (no gun is on both sides)
  const keys = Object.keys(WEAPONS).sort((a, b) => sideN(a) - sideN(b) || CLASS_ORDER.indexOf(WEAPONS[a].cls) - CLASS_ORDER.indexOf(WEAPONS[b].cls));
  el.querySelector('#armList').innerHTML = keys.map(k => `<button data-w="${k}" class="${k === S.w ? 'on' : ''}"><i class="pic"></i><b>${esc(WEAPONS[k].name)}</b><span>${CLASS_NAME[WEAPONS[k].cls]} · <em class="${gunSide(k) === 'def' ? 'def' : 'atk'}">${gunSide(k) === 'def' ? 'DEFENCE' : 'ATTACK'}</em></span></button>`).join('');
  for (const b of el.querySelectorAll('#armList button')) b.querySelector('.pic').appendChild(gunPicture(b.dataset.w, attOf(b.dataset.w), 160, 50));
  for (const b of el.querySelectorAll('#armList button')) b.onclick = () => { audio.ui(); pick(el, b.dataset.w); };
}

function pick(el, w) {
  S.w = w; S.ammo = WEAPONS[w].mag; S.reloadT = 0; S.rc = 0; S.bloom = 0; S.adsT = 0;
  for (const b of el.querySelectorAll('#armList button')) b.classList.toggle('on', b.dataset.w === w);
  resetRange(el);
}

function resetRange(el) {
  const d = S.dist * M;
  S.dummies = [-46, 0, 46].map((ox, i) => ({ x: ox, y: -d, a: [3, 2, 1][i], hp: ARMOR_HP[[3, 2, 1][i]], max: ARMOR_HP[[3, 2, 1][i]], label: ['Light', 'Medium', 'Heavy'][i], deadT: 0, flash: 0 }));
  S.holes = []; S.pops = []; S.tracers = []; S.hits = 0; S.fired = 0; S.first = null; S.kills = 0;
  for (const b of el.querySelectorAll('#armDist button')) b.classList.toggle('on', +b.dataset.d === S.dist);
  stats(el);
}

function reload() {
  const w = WEAPONS[S.w];
  if (S.reloadT > 0 || S.ammo >= w.mag) return;
  S.reloadT = w.reload; audio.foley(w.cls === 'Shotgun' ? 'shell' : 'magOut', undefined, undefined, true);
}

function tick(el, dt) {
  const w = WEAPONS[S.w], cv = el.querySelector('#armCanvas');
  S.t += dt; S.fireCd -= dt; S.bloom = Math.max(0, S.bloom - dt * 0.15);
  S.adsT = Math.max(0, Math.min(1, S.adsT + (S.mouse.r ? 1 : -2) * dt / (adsTime(w) * modsOf(S.w).ads)));
  if (S.t - S.lastShot > 0.1) S.rc *= Math.exp(-dt * 12);
  if (S.shots && !aimHeat(w, S.shots, S.t - S.lastShot)) { S.rc = 0; S.shots = 0; } // settled: the next shot is exact
  if (S.reloadT > 0) { S.reloadT -= dt; if (S.reloadT <= 0) { S.ammo = w.mag; audio.foley(w.cls === 'Shotgun' ? 'shell' : 'magIn', undefined, undefined, true); } }
  if (S.burst && (S.reloadT > 0 || S.ammo <= 0)) S.burst = 0;
  if (S.burst) { if (S.fireCd <= 0) { fire(w, cv); if (!--S.burst) S.fireCd = Math.max(S.fireCd, w.burstGap || 0.3); } } // the rest of a burst fires by itself
  else if (S.reloadT <= 0 && S.fireCd <= 0 && ((S.mouse.l && w.auto) || S.mouse.edge || S.t - (S.clickT ?? -9) < 0.15)) { // a click a hair early still fires
    S.clickT = -9;
    if (S.ammo > 0) { fire(w, cv); if (w.burst > 1 && S.ammo > 0) S.burst = w.burst - 1; else if (w.burst > 1) S.fireCd = Math.max(S.fireCd, w.burstGap || 0.3); } else reload();
  }
  S.mouse.edge = false;
  for (const d of S.dummies) { d.flash = Math.max(0, d.flash - dt * 4); if (d.hp <= 0 && (d.deadT -= dt) <= 0) { d.hp = d.max; } }
  S.pops = S.pops.filter(p => (p.life -= dt) > 0);
  S.tracers = S.tracers.filter(t => (t.life -= dt) > 0);
  if ((S.statT = (S.statT || 0) - dt) <= 0) { S.statT = 0.2; liveStats(el); }
}

// world: shooter at (0, 0), dummies straight ahead (up the screen)
function view(cv) {
  const z = Math.min(cv.height * 0.8 / (S.dist * M + 60), cv.width / 220, 4);
  return { z, ox: cv.width / 2, oy: cv.height * 0.88 };
}
function aimAngle(cv) { const v = view(cv); return Math.atan2((S.mouse.y - v.oy) / v.z, (S.mouse.x - v.ox) / v.z); }

function fire(w, cv) {
  S.ammo--; S.fireCd = Math.max(S.fireCd, -0.02) + 60 / w.rpm; S.fired++;
  const m = modsOf(S.w), cone = spreadCone(w, m, { at: S.adsT, shots: aimHeat(w, S.shots, S.t - S.lastShot) }), rc0 = S.rc;
  S.lastShot = S.t; // same rules as a match
  S.shots++; S.rc = Math.max(-recoilMax(w), Math.min(recoilMax(w), S.rc + recoilStep(w, m, S.shots)));
  audio.gunshot(S.w, undefined, undefined, true, !!m.quiet);
  const base = aimAngle(cv);
  let hitAny = false;
  for (let i = 0; i < w.pellets; i++) {
    const a = base + rc0 + shotOffset(w, cone, i), dx = Math.cos(a), dy = Math.sin(a);
    let best = null, bt = w.range;
    for (const d of S.dummies) {
      if (d.hp <= 0) continue;
      const b = -(d.x * dx + d.y * dy), c = d.x * d.x + d.y * d.y - HIT_R[d.a] * HIT_R[d.a], disc = b * b - c;
      if (disc < 0) continue;
      const t = -b - Math.sqrt(disc);
      if (t > 0 && t < bt) { bt = t; best = d; }
    }
    const ex = dx * bt, ey = dy * bt;
    if (i < 3) S.tracers.push({ x2: ex, y2: ey, life: 0.07 });
    if (best) {
      hitAny = true; S.hits++;
      const miss = Math.abs(best.x * dy - best.y * dx), head = miss < HEAD_R && w.pellets === 1; // a pellet to the head only hurts more
      const dmg = head ? best.hp : Math.round(w.dmg * m.dmg * fallAt(w, bt, m.range) * (miss < HEAD_R ? 1.8 : 1));
      best.hp -= dmg; best.flash = 1;
      S.pops.push({ x: best.x + (Math.random() - 0.5) * 14, y: best.y - 14, txt: head ? 'HEADSHOT' : String(dmg), head, life: 0.9 });
      if (best.hp <= 0) { best.deadT = 1.6; S.kills++; if (S.first === null) S.first = S.fired; audio.impact('flesh'); }
    } else if (bt < w.range) S.holes.push({ x: ex, y: ey });
    else { const t = S.dist * M + 30; S.holes.push({ x: dx / Math.max(0.01, -dy) * t, y: -t }); }
  }
  if (hitAny) audio.impact('flesh');
  if (S.holes.length > 200) S.holes.splice(0, S.holes.length - 200);
}

function draw(cv) {
  const r = cv.getBoundingClientRect();
  if (cv.width !== Math.round(r.width) || cv.height !== Math.round(r.height)) { cv.width = Math.round(r.width); cv.height = Math.round(r.height); }
  const c = cv.getContext('2d'), { z, ox, oy } = view(cv), w = WEAPONS[S.w];
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = '#2a2d31'; c.fillRect(0, 0, cv.width, cv.height);
  c.setTransform(z, 0, 0, z, ox, oy);
  const far = S.dist * M + 30;
  // lane floor, distance lines and the backstop
  c.fillStyle = '#3a3e43'; c.fillRect(-100, -far - 10, 200, far + 40);
  c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 1 / z;
  c.font = `${11 / z}px Barlow Condensed, sans-serif`; c.fillStyle = 'rgba(255,255,255,0.35)'; c.textAlign = 'left';
  for (let m = 5; m * M < far; m += 5) { c.beginPath(); c.moveTo(-100, -m * M); c.lineTo(100, -m * M); c.stroke(); c.fillText(m + ' m', -98, -m * M - 2 / z); }
  c.fillStyle = '#5b4a36'; c.fillRect(-100, -far - 14, 200, 8);
  c.fillStyle = 'rgba(15,15,15,0.8)'; for (const h of S.holes) { c.beginPath(); c.arc(h.x, h.y, 0.9, 0, 7); c.fill(); }
  // dummies
  for (const d of S.dummies) {
    const alive = d.hp > 0;
    c.save(); c.translate(d.x, d.y);
    c.globalAlpha = alive ? 1 : 0.35;
    c.fillStyle = d.flash > 0 ? `rgb(255,${200 - d.flash * 120},${150 - d.flash * 120})` : '#c9a77a';
    c.beginPath(); c.arc(0, 0, HIT_R[d.a], 0, 7); c.fill();
    c.strokeStyle = '#5a4128'; c.lineWidth = 0.8; c.stroke();
    c.strokeStyle = 'rgba(160,30,30,0.8)'; c.beginPath(); c.arc(0, 0, 4.2, 0, 7); c.stroke();
    c.fillStyle = '#a01e1e'; c.beginPath(); c.arc(0, 0, HEAD_R, 0, 7); c.fill();
    c.globalAlpha = 1;
    c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(-11, 13, 22, 3);
    c.fillStyle = alive ? '#7fe07f' : '#e05050'; c.fillRect(-11, 13, 22 * Math.max(0, d.hp) / d.max, 3);
    c.fillStyle = 'rgba(255,255,255,0.7)'; c.font = '6px Barlow Condensed, sans-serif'; c.textAlign = 'center';
    c.fillText(`${d.label} · ${d.max} HP`, 0, 23);
    c.restore();
  }
  for (const t of S.tracers) { c.strokeStyle = `rgba(255,220,150,${t.life / 0.07 * 0.6})`; c.lineWidth = 0.9; c.beginPath(); c.moveTo(0, 0); c.lineTo(t.x2, t.y2); c.stroke(); }
  // shooter
  const op = OP_LIST.find(k => OPERATORS[k].primary === S.w || OPERATORS[k].secondary === S.w) || 'ember';
  drawOperator(c, { x: 0, y: 0, aim: aimAngle(cv), op, w: S.w, ally: true, walk: 0, legs: 0, ads: S.adsT > 0.5, recoil: S.t - S.lastShot < 0.06 ? 1 : 0, reload: S.reloadT > 0 }, S.t);
  for (const p of S.pops) {
    c.globalAlpha = Math.min(1, p.life * 2); c.fillStyle = p.head ? '#ff4040' : '#fff';
    c.font = `700 ${(p.head ? 9 : 8)}px Barlow Condensed, sans-serif`; c.textAlign = 'center';
    c.fillText(p.txt, p.x, p.y - (0.9 - p.life) * 18); c.globalAlpha = 1;
  }
  // crosshair, kicked by recoil like in a match
  c.setTransform(1, 0, 0, 1, 0, 0);
  const cone = spreadCone(w, modsOf(S.w), { at: S.adsT, shots: aimHeat(w, S.shots, S.t - S.lastShot) });
  const px = ox, py = oy, rc = S.rc, cs = Math.cos(rc), sn = Math.sin(rc);
  const mx = px + (S.mouse.x - px) * cs - (S.mouse.y - py) * sn, my = py + (S.mouse.x - px) * sn + (S.mouse.y - py) * cs;
  const gap = 3 + Math.tan(cone) * Math.hypot(S.mouse.x - px, S.mouse.y - py); // shut when the next shot is exact
  c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 1.5; c.beginPath();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { c.moveTo(mx + dx * gap, my + dy * gap); c.lineTo(mx + dx * (gap + 7), my + dy * (gap + 7)); }
  c.stroke(); c.fillStyle = '#fff'; c.fillRect(mx - 1, my - 1, 2, 2);
  // ammo
  c.textAlign = 'right'; c.font = '700 30px Barlow Condensed, sans-serif'; c.fillStyle = '#fff';
  c.fillText(S.reloadT > 0 ? 'RELOADING' : `${S.ammo} / ${w.mag}`, cv.width - 16, cv.height - 16);
  c.textAlign = 'left'; c.font = '600 14px Barlow Condensed, sans-serif'; c.fillStyle = 'rgba(255,255,255,0.6)';
  c.fillText('Left mouse: shoot   ·   Right mouse: aim down sights   ·   R: reload', 14, cv.height - 18);
}

// the gun's spray as a little picture: each dot is where the next shot goes (first at the bottom), drift left/right
function sprayPic(w, m) {
  let r = 0; const pts = [], n = Math.min(w.mag, 24), mx = recoilMax(w);
  for (let i = 1; i <= n; i++) { pts.push(r); r = Math.max(-mx, Math.min(mx, r + recoilStep(w, m, i))); }
  const X = v => 60 + v / 0.18 * 55, Y = i => 96 - i * (88 / Math.max(1, n - 1));
  return `<svg viewBox="0 0 120 100" width="120" height="100"><line x1="60" y1="2" x2="60" y2="98" stroke="rgba(255,255,255,0.15)"/>` +
    `<polyline fill="none" stroke="rgba(242,193,78,0.5)" stroke-width="1" points="${pts.map((v, i) => X(v).toFixed(1) + ',' + Y(i).toFixed(1)).join(' ')}"/>` +
    pts.map((v, i) => `<circle cx="${X(v).toFixed(1)}" cy="${Y(i).toFixed(1)}" r="${i ? 1.6 : 2.4}" fill="${i ? '#f2c14e' : '#fff'}"/>`).join('') + '</svg>';
}

function stats(el) {
  const w = WEAPONS[S.w], m = modsOf(S.w), a = attOf(S.w), opts = attachFor(S.w), d = S.dist * M, f = fallAt(w, d, m.range) * m.dmg;
  const stk = hp => Math.ceil(hp / (w.dmg * f * (w.pellets > 1 ? w.pellets * 0.7 : 1)));
  const ttk = hp => ((stk(hp) - 1) * 60 / w.rpm).toFixed(2);
  const fo = falloffOf(w), rk = recoilOf(w).kick * ((SPRAY[w.id] || {}).k || 1);
  const bar = (v, max) => `<i style="width:${Math.min(100, v / max * 100)}%"></i>`;
  el.querySelector('#armStats').innerHTML = `
    <div class="bigpic"></div>
    <h3>${esc(w.name)}</h3><p class="cls">${CLASS_NAME[w.cls]}${w.mode ? ` · ${w.mode}` : w.burst ? ` · ${w.burst}-round burst` : w.auto ? ' · full-auto' : ' · semi-auto'}${w.pellets > 1 ? ` · ${w.pellets} pellets` : ''} — ${esc(w.trait || CLASS_TIP[w.cls])}</p>
    <div class="atts">${ATTACH_SLOTS.map(([s, label]) => `<div class="attrow"><span>${label}</span>${opts[s].map(v => `<button class="att ${a[s] === v ? 'on' : ''}" data-s="${s}" data-v="${v}" title="${ATTACH[s][v].desc}">${ATTACH[s][v].short}</button>`).join('')}<em>${ATTACH[s][a[s]].desc}</em></div>`).join('')}</div>
    <div class="sbar"><span>Damage</span><b>${w.dmg}${w.pellets > 1 ? '×' + w.pellets : ''}</b><em>${bar(w.dmg * w.pellets, 110)}</em></div>
    <div class="sbar"><span>Fire rate</span><b>${w.rpm} rpm</b><em>${bar(w.rpm, 1000)}</em></div>
    <div class="sbar"><span>Magazine</span><b>${w.mag} + ${w.reserve}</b><em>${bar(w.mag, 80)}</em></div>
    <div class="sbar"><span>Reload</span><b>${w.reload}s</b><em>${bar(5 - w.reload, 4)}</em></div>
    <div class="sbar"><span>Hip accuracy</span><b>${(1 / (w.spread * m.hip)).toFixed(0)}</b><em>${bar(0.2 - w.spread * m.hip, 0.18)}</em></div>
    <div class="sbar"><span>Aimed accuracy</span><b>${(1 / (w.ads * m.adsSpread)).toFixed(0)}</b><em>${bar(0.12 - w.ads * m.adsSpread, 0.12)}</em></div>
    <div class="sbar"><span>Aim-in time</span><b>${(adsTime(w) * m.ads).toFixed(2)}s</b><em>${bar(0.6 - adsTime(w) * m.ads, 0.5)}</em></div>
    <div class="sbar"><span>Recoil</span><b>${(rk * m.kick * 1000).toFixed(0)}</b><em>${bar(rk * m.kick, 0.06)}</em></div>
    <div class="spray">${sprayPic(w, m)}<p>${sprayWords(w)}. Pull your mouse the other way to keep on target.</p></div>
    ${m.quiet ? `<p class="note">${w.quiet ? 'Built-in suppressor' : 'Suppressed'}: much quieter, no muzzle flash.</p>` : ''}
    <p class="note">Full damage up to ${fo.from >= 9999 ? 'any range' : Math.round(fo.from * m.range / M) + ' m'}${fo.from >= 9999 ? '' : `, down to ${Math.round(fo.min * 100)}% by ${Math.round(fo.to * m.range / M)} m`}. A shot through the centre of the body is a headshot: instant kill.</p>
    <h4>At ${S.dist} m</h4>
    <table class="ttk"><tr><th></th><th>Light 100</th><th>Medium 110</th><th>Heavy 125</th></tr>
      <tr><td>Hits to down</td><td>${stk(100)}</td><td>${stk(110)}</td><td>${stk(125)}</td></tr>
      <tr><td>Time to kill</td><td>${ttk(100)}s</td><td>${ttk(110)}s</td><td>${ttk(125)}s</td></tr></table>
    <h4>Your shooting</h4><div id="armLive"></div>`;
  el.querySelector('#armStats .bigpic').appendChild(gunPicture(S.w, a, 300, 100));
  for (const b of el.querySelectorAll('#armStats .att')) b.onclick = () => { audio.ui(); S.att[S.w] = { ...a, [b.dataset.s]: b.dataset.v }; renderList(el); stats(el); };
  liveStats(el);
}
function liveStats(el) {
  const l = el.querySelector('#armLive'); if (!l) return;
  const acc = S.fired ? Math.round(S.hits / (S.fired * WEAPONS[S.w].pellets) * 100) : 0;
  l.innerHTML = `<p>Shots ${S.fired} · Hits ${S.hits} · Accuracy ${acc}% · Dummies dropped ${S.kills}</p>`;
}
