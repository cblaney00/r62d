// The Armory: a private shooting range in the menus. Pick any gun, shoot dummies at different
// distances and read its numbers. Runs only in your browser (nobody else sees it), using the same
// damage, drop-off, spread, aim-in time, recoil and headshot rules as the server, and aiming works exactly as in a
// match (he asked): the mouse is captured on the first click, the crosshair moves with your sensitivity and aiming mode,
// it is your own crosshair, distances are real metres, the view widens when you aim in and follows the crosshair out.
import { PX_PER_M } from '/shared/constants.js';
import { drawXhair } from './crosshair.js';
import { WEAPONS, OPERATORS, OP_LIST, HEAD_R, HEAD_AIM, onHead, HIT_R, ARMOR_HP, CLASS_NAME, CLASS_TIP, ATTACH, ATTACH_SLOTS, attachFor, cleanAtt, gunMods, aimHeat, spreadCone, tracerPellet, shotOffset, recoilStep, recoilMax, adsTime, recoilOf, falloffOf, sprayWords, SPRAY, gunSide } from '/shared/operators.js';
import { gunPicture } from './gunart.js';
import { drawOperator } from './sprites.js';
import * as audio from './audio.js';

const M = PX_PER_M; // world pixels per metre, the same as a match
const CLASS_ORDER = ['AR', 'SMG', 'MP', 'LMG', 'DMR', 'Shotgun', 'Pistol'];
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const fallAt = (w, d, rm = 1) => { const F = falloffOf(w), fo = { from: F.from * rm, to: F.to * rm, min: F.min }; return d <= fo.from ? 1 : d >= fo.to ? fo.min : 1 - (1 - fo.min) * (d - fo.from) / (fo.to - fo.from); };
const attOf = w => cleanAtt(w, S.att[w]);
const modsOf = w => gunMods(w, attOf(w));

let S = null; // range state while open
window.__armory = () => S; // for screenshot tests
let O = { sens: () => 1, xh: () => null, mode: () => 'free', dpr: () => 1 }; // the match's settings, from main.js

// Esc while the mouse is captured only lets go of it (as in a match); it doesn't close the Armory
export function armoryHoldsEsc() {
  if (!S || !S.cv) return false;
  if (document.pointerLockElement === S.cv) { document.exitPointerLock(); return true; }
  return performance.now() - (S.unlockT || -1e9) < 400;
}

export function openArmory(el, opts) {
  el.classList.remove('hidden');
  if (opts) O = opts;
  if (!S) S = { att: {}, w: 'k4', dist: 10, dummies: [], holes: [], pops: [], tracers: [], ammo: 0, reloadT: 0, fireCd: 0, adsT: 0, bloom: 0, rc: 0, shots: 0, rcDir: 1, lastShot: -9, mouse: { x: 0, y: 0, l: false, r: false, edge: false }, t: 0, hits: 0, fired: 0, first: null, kills: 0 };
  S.aim = { x: 0, y: -150 }; S.cam = null; S.envH = 0; S.adsZ = 1; S.fitH = 0; S.leadV = null; S.lockAsked = false;
  renderList(el); pick(el, S.w);
  const cv = el.querySelector('#armCanvas'); S.cv = cv;
  cv.onmousemove = e => {
    const dpr = O.dpr();
    if (document.pointerLockElement === cv) {
      const k = O.sens(S.mouse.r) * dpr;
      if (O.mode() === 'cursor') { S.mouse.x = Math.max(0, Math.min(cv.width, S.mouse.x + e.movementX * k)); S.mouse.y = Math.max(0, Math.min(cv.height, S.mouse.y + e.movementY * k)); }
      else freeMove(e.movementX * k, e.movementY * k);
    } else { const r = cv.getBoundingClientRect(); S.mouse.x = (e.clientX - r.left) * dpr; S.mouse.y = (e.clientY - r.top) * dpr; }
  };
  cv.onmousedown = e => {
    audio.initAudio();
    if (document.pointerLockElement !== cv && !S.lockAsked) { S.lockAsked = true; cv.requestPointerLock?.(); return; } // the first click just takes control
    if (e.button === 0) { S.mouse.l = true; S.mouse.edge = true; S.clickT = S.t; }
    if (e.button === 2) { S.mouse.r = true; const l = Math.hypot(S.aim.x, S.aim.y) || 1; S.aim = { x: S.aim.x / l * 2.5 * M, y: S.aim.y / l * 2.5 * M }; } // aiming in: 2.5 m out, as in a match
  };
  cv.oncontextmenu = e => e.preventDefault();
  S.up = e => { if (e.button === 0) S.mouse.l = false; if (e.button === 2) S.mouse.r = false; };
  S.key = e => { if (e.code === 'KeyR') reload(); };
  S.lock = () => { S.lockAsked = false; if (document.pointerLockElement !== cv) { S.unlockT = performance.now(); S.mouse.l = S.mouse.r = false; } };
  addEventListener('mouseup', S.up); addEventListener('keydown', S.key); document.addEventListener('pointerlockchange', S.lock);
  for (const b of el.querySelectorAll('#armDist button')) b.onclick = () => { audio.ui(); S.dist = +b.dataset.d; resetRange(el); };
  el.querySelector('#armReset').onclick = () => { audio.ui(); resetRange(el); };
  let last = performance.now();
  const loop = now => { S.raf = requestAnimationFrame(loop); const dt = Math.min(0.05, (now - last) / 1000); last = now; tick(el, dt); draw(cv, dt); };
  S.raf = requestAnimationFrame(loop);
}
export function closeArmory(el) {
  el.classList.add('hidden');
  if (!S) return;
  cancelAnimationFrame(S.raf); removeEventListener('mouseup', S.up); removeEventListener('keydown', S.key); document.removeEventListener('pointerlockchange', S.lock);
  if (document.pointerLockElement === S.cv) document.exitPointerLock();
  S.mouse.l = S.mouse.r = false;
}

// The guns sorted into a folder per type (he asked); click a folder to open or close it. The folder holding the gun
// you are trying starts open. Inside a folder: attack guns first, then defence (no gun is on both sides).
function renderList(el) {
  const sideN = k => gunSide(k) === 'def' ? 1 : 0;
  if (!S.open) S.open = new Set([WEAPONS[S.w].cls]);
  const gunBtn = k => `<button data-w="${k}" class="gun ${k === S.w ? 'on' : ''}"><i class="pic"></i><b>${esc(WEAPONS[k].name)}</b><span>${CLASS_NAME[WEAPONS[k].cls]} · <em class="${gunSide(k) === 'def' ? 'def' : 'atk'}">${gunSide(k) === 'def' ? 'DEFENCE' : 'ATTACK'}</em></span></button>`;
  el.querySelector('#armList').innerHTML = CLASS_ORDER.map(cls => {
    const keys = Object.keys(WEAPONS).filter(k => WEAPONS[k].cls === cls).sort((a, b) => sideN(a) - sideN(b));
    if (!keys.length) return '';
    return `<div class="armFolder ${S.open.has(cls) ? 'open' : ''}" data-cls="${cls}"><button class="armFolderHead"><i></i>${esc(CLASS_NAME[cls])}s<small>${keys.length}</small></button><div class="armFolderBody">${keys.map(gunBtn).join('')}</div></div>`;
  }).join('');
  for (const b of el.querySelectorAll('#armList button.gun')) b.querySelector('.pic').appendChild(gunPicture(b.dataset.w, attOf(b.dataset.w), 160, 50));
  for (const b of el.querySelectorAll('#armList button.gun')) b.onclick = () => { audio.ui(); pick(el, b.dataset.w); };
  for (const f of el.querySelectorAll('.armFolder')) f.querySelector('.armFolderHead').onclick = () => {
    audio.ui(); const cls = f.dataset.cls;
    if (S.open.has(cls)) S.open.delete(cls); else S.open.add(cls);
    f.classList.toggle('open', S.open.has(cls));
  };
}

function pick(el, w) {
  S.w = w; S.ammo = WEAPONS[w].mag; S.reloadT = 0; S.rc = 0; S.bloom = 0; S.adsT = 0;
  for (const b of el.querySelectorAll('#armList button.gun')) b.classList.toggle('on', b.dataset.w === w);
  resetRange(el);
}

function resetRange(el) {
  const d = S.dist * M;
  S.dummies = [-80, 0, 80].map((ox, i) => ({ x: ox, y: -d, a: [3, 2, 1][i], hp: ARMOR_HP[[3, 2, 1][i]], max: ARMOR_HP[[3, 2, 1][i]], label: ['Light', 'Medium', 'Heavy'][i], deadT: 0, flash: 0 }));
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

// world: shooter at (0, 0), dummies straight ahead (up the screen), in the same pixels as a match.
// The camera works like a match's: the room-size view, sliding ahead down the lane, widening when you aim in (2x scope
// most) and growing / sliding to keep you and the crosshair on screen (main.js camera, FIT_H, keep).
const ROOM_W = 330; // the range is this wide either side of you
const farEnd = () => S.dist * M + 60; // the backstop
const scoped = () => String(attOf(S.w).sight || '').includes('scope');
const fitCap = () => S.mouse.r ? (scoped() ? 1000 : 820) : 700;
const aimMin = () => 46 * O.dpr() / (S.z || 1), aimMax = () => S.reachW || 400;
function freeMove(dx, dy) { // the match's Crosshair mode (main.js freeMove): sideways turns as if never past TURN_R
  const z = S.z || 1; dx /= z; dy /= z;
  const o = S.aim, l0 = Math.hypot(o.x, o.y) || 1, ux = o.x / l0, uy = o.y / l0, lo = aimMin(), hi = aimMax();
  let l = l0 + dx * ux + dy * uy, a = Math.atan2(uy, ux) + (-dx * uy + dy * ux) / Math.min(l0, 160);
  if (l < 0) { l = -l; a += Math.PI; }
  if (l > hi) l = Math.max(hi, Math.min(l, l0)); else if (l < lo) l = lo;
  S.aim = { x: Math.cos(a) * l, y: Math.sin(a) * l };
}
function screenToWorld(cv, x, y) { return { x: (x - cv.width / 2) / S.z + S.cam.x, y: (y - cv.height / 2) / S.z + S.cam.y }; }
function w2s(cv, x, y) { return { x: (x - S.cam.x) * S.z + cv.width / 2, y: (y - S.cam.y) * S.z + cv.height / 2 }; }
// the point you aim at, held at the range's walls like a wall holds it in a match
function aimPoint(cv) {
  let x, y;
  if (O.mode() === 'cursor') { const p = screenToWorld(cv, S.mouse.x, S.mouse.y); x = p.x; y = p.y; }
  else { x = S.aim.x; y = S.aim.y; }
  let l = Math.hypot(x, y) || 1; const c = x / l, s = y / l;
  if (s < -1e-6) l = Math.min(l, farEnd() / -s); if (s > 1e-6) l = Math.min(l, 60 / s);
  if (Math.abs(c) > 1e-6) l = Math.min(l, ROOM_W / Math.abs(c));
  return { x: c * l, y: s * l, d: l };
}
function aimAngle(cv) { const p = aimPoint(cv); return Math.atan2(p.y, p.x); }
function camera(cv, dt) {
  const H = cv.height, e = Math.min(cv.width / H / 2, 0.5), mg = 86 * O.dpr() / (S.z || 1), q = aimPoint(cv);
  // looking up a long lane, like down a sightline in a match: the view grows up to 680 and slides ahead
  const far = farEnd(), want = Math.max(470, Math.min(680, (far + 110) / (2 * 0.5)));
  if (!S.envH || Math.abs(want - S.envH) > S.envH * 0.15) S.envH = S.envH || want, S.envWant = want;
  S.envH += ((S.envWant || want) - S.envH) * (1 - Math.exp(-dt * 6));
  S.adsZ += ((S.mouse.r ? (scoped() ? 1.3 : 1.12) : 1) - S.adsZ) * (1 - Math.exp(-dt * 18));
  let vh = S.envH * S.adsZ;
  if (O.mode() !== 'cursor') {
    const cap = fitCap(), need = Math.min(cap, (q.d + mg) / (2 * e));
    S.reachW = Math.max(160, cap * 2 * e - mg);
    S.fitH = S.fitH ? S.fitH + (need - S.fitH) * (1 - Math.exp(-dt * 8)) : need;
    vh = Math.max(vh, S.fitH);
  }
  S.z = H / vh;
  const reach = vh * 0.5, lead = Math.max(0, Math.min(reach - 70, far - (reach - 40)));
  const lx = q.x * 0.22, ly = q.y * 0.22, ll = Math.hypot(lx, ly), mx = vh * (S.mouse.r ? (scoped() ? 0.46 : 0.32) : 0.2);
  let ax = ll > mx ? lx / ll * mx : lx, ay = ll > mx ? ly / ll * mx : ly;
  if (lead > Math.hypot(ax, ay)) { ax = 0; ay = -lead; }
  S.leadV = S.leadV || { x: ax, y: ay }; const kl = 1 - Math.exp(-dt * 4);
  S.leadV.x += (ax - S.leadV.x) * kl; S.leadV.y += (ay - S.leadV.y) * kl;
  if (!S.cam) S.cam = { x: S.leadV.x, y: S.leadV.y };
  const k = 1 - Math.exp(-dt * 14);
  S.cam.x += (S.leadV.x - S.cam.x) * k; S.cam.y += (S.leadV.y - S.cam.y) * k;
  if (O.mode() !== 'cursor') {
    const hw = cv.width / 2 / S.z, hh = H / 2 / S.z;
    const keep = (x, y, m) => { S.cam.x = Math.min(x + hw - m, Math.max(x - hw + m, S.cam.x)); S.cam.y = Math.min(y + hh - m, Math.max(y - hh + m, S.cam.y)); };
    keep(0, 0, 50 * O.dpr() / S.z); keep(q.x, q.y, 36 * O.dpr() / S.z);
  }
}

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
    if (tracerPellet(w, i)) S.tracers.push({ x2: ex, y2: ey, life: 0.04 });
    if (best) {
      hitAny = true; S.hits++;
      const q = aimPoint(cv), onH = onHead(q.x, q.y, best.x, best.y); // same rule as a match: crosshair on the head
      const miss = Math.abs(best.x * dy - best.y * dx), head = miss < HEAD_R && onH && w.pellets === 1; // a pellet to the head only hurts more
      const dmg = head ? best.hp : Math.round(w.dmg * m.dmg * fallAt(w, bt, m.range) * (miss < HEAD_R && onH ? 1.8 : 1));
      best.hp -= dmg; best.flash = 1;
      S.pops.push({ x: best.x + (Math.random() - 0.5) * 14, y: best.y - 14, txt: head ? 'HEADSHOT' : String(dmg), head, life: 0.9 });
      if (best.hp <= 0) { best.deadT = 1.6; S.kills++; if (S.first === null) S.first = S.fired; audio.impact('flesh'); }
    } else if (bt < w.range) S.holes.push({ x: ex, y: ey });
    else { const t = S.dist * M + 30; S.holes.push({ x: dx / Math.max(0.01, -dy) * t, y: -t }); }
  }
  if (hitAny) audio.impact('flesh');
  if (S.holes.length > 200) S.holes.splice(0, S.holes.length - 200);
}

function draw(cv, dt) {
  const r = cv.getBoundingClientRect(), dpr = O.dpr();
  if (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
  camera(cv, dt);
  const c = cv.getContext('2d'), z = S.z, w = WEAPONS[S.w], O0 = w2s(cv, 0, 0);
  const label = (txt, x, y, px, col, align = 'center') => { // text drawn at screen size, so it reads at any zoom
    const P = w2s(cv, x, y); c.font = `700 ${px * dpr}px Barlow Condensed, sans-serif`; c.textAlign = align;
    c.lineWidth = 3 * dpr; c.strokeStyle = 'rgba(0,0,0,0.6)'; c.strokeText(txt, P.x, P.y); c.fillStyle = col; c.fillText(txt, P.x, P.y);
  };
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = '#1d2024'; c.fillRect(0, 0, cv.width, cv.height);
  c.setTransform(z, 0, 0, z, O0.x, O0.y);
  const far = farEnd();
  // the range: concrete floor, the lane in front of you, metre lines and the backstop
  c.fillStyle = '#34383d'; c.fillRect(-ROOM_W, -far, ROOM_W * 2, far + 60);
  c.fillStyle = '#3c4147'; c.fillRect(-90, -far, 180, far + 60);
  c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 1 / z;
  for (let m = 5; m * M < far; m += 5) { c.beginPath(); c.moveTo(-ROOM_W, -m * M); c.lineTo(ROOM_W, -m * M); c.stroke(); }
  c.fillStyle = '#5b4a36'; c.fillRect(-ROOM_W, -far - 10, ROOM_W * 2, 10);
  c.fillStyle = '#4a4f55'; c.fillRect(-ROOM_W - 10, -far - 10, 10, far + 80); c.fillRect(ROOM_W, -far - 10, 10, far + 80); c.fillRect(-ROOM_W - 10, 60, ROOM_W * 2 + 20, 10);
  c.fillStyle = 'rgba(15,15,15,0.8)'; for (const h of S.holes) { c.beginPath(); c.arc(h.x, h.y, 0.55, 0, 7); c.fill(); }
  // dummies
  for (const d of S.dummies) {
    const alive = d.hp > 0;
    c.save(); c.translate(d.x, d.y);
    c.globalAlpha = alive ? 1 : 0.35;
    c.fillStyle = d.flash > 0 ? `rgb(255,${200 - d.flash * 120},${150 - d.flash * 120})` : '#c9a77a';
    c.beginPath(); c.arc(0, 0, HIT_R[d.a], 0, 7); c.fill();
    c.strokeStyle = '#5a4128'; c.lineWidth = 0.8; c.stroke();
    c.fillStyle = '#a01e1e'; c.beginPath(); c.arc(0, 0, HEAD_R, 0, 7); c.fill();
    c.globalAlpha = 1;
    c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(-11, 11, 22, 2.5);
    c.fillStyle = alive ? '#7fe07f' : '#e05050'; c.fillRect(-11, 11, 22 * Math.max(0, d.hp) / d.max, 2.5);
    c.restore();
  }
  for (const t of S.tracers) { c.strokeStyle = `rgba(255,220,150,${t.life / 0.04 * 0.6})`; c.lineWidth = 0.45; c.beginPath(); c.moveTo(0, 0); c.lineTo(t.x2, t.y2); c.stroke(); }
  // shooter
  const op = OP_LIST.find(k => OPERATORS[k].primary === S.w || OPERATORS[k].secondary === S.w) || 'ember';
  drawOperator(c, { x: 0, y: 0, aim: aimAngle(cv), op, w: S.w, ally: true, walk: 0, legs: 0, ads: S.adsT > 0.5, recoil: S.t - S.lastShot < 0.06 ? 1 : 0, reload: S.reloadT > 0 }, S.t);
  // reload ring round you, like a match
  if (S.reloadT > 0) { c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 1.6; c.beginPath(); c.arc(0, 0, 15, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - S.reloadT / w.reload)); c.stroke(); }
  c.setTransform(1, 0, 0, 1, 0, 0);
  for (let m = 5; m * M < far; m += 5) label(m + ' m', -ROOM_W + 4, -m * M - 3 / z, 12, 'rgba(255,255,255,0.4)', 'left');
  for (const d of S.dummies) label(`${d.label} ${d.max}`, d.x, d.y + 24 / z, 11, 'rgba(255,255,255,0.75)');
  for (const p of S.pops) { c.globalAlpha = Math.min(1, p.life * 2); label(p.txt, p.x, p.y - (0.9 - p.life) * 30 / z, p.head ? 15 : 13, p.head ? '#ff4040' : '#fff'); c.globalAlpha = 1; }
  // crosshair: your own one, kicked round you by recoil and with the true spread gap, exactly as in a match
  const q = aimPoint(cv), Q = w2s(cv, q.x, q.y), rc = S.rc, cs = Math.cos(rc), sn = Math.sin(rc);
  const x = O0.x + (Q.x - O0.x) * cs - (Q.y - O0.y) * sn, y = O0.y + (Q.x - O0.x) * sn + (Q.y - O0.y) * cs;
  if (S.mouse.r) for (const d of S.dummies) { // aiming in: each target's head zone, red when the crosshair is on it
    if (d.hp <= 0) continue;
    const H = w2s(cv, d.x, d.y), hr = Math.max(2.5 * dpr, HEAD_AIM * z), on = Math.hypot(x - H.x, y - H.y) <= hr;
    c.lineWidth = (on ? 2 : 1.2) * dpr;
    c.strokeStyle = 'rgba(0,0,0,0.6)'; c.beginPath(); c.arc(H.x, H.y, hr + 1.2 * dpr, 0, 7); c.stroke();
    c.strokeStyle = on ? '#ff3b3b' : 'rgba(255,255,255,0.55)'; c.beginPath(); c.arc(H.x, H.y, hr, 0, 7); c.stroke();
    if (on) { c.fillStyle = 'rgba(255,59,59,0.22)'; c.fill(); }
  }
  const cone = spreadCone(w, modsOf(S.w), { at: S.adsT, shots: aimHeat(w, S.shots, S.t - S.lastShot) }), xh = O.xh();
  if (xh) drawXhair(c, x, y, xh, xh.dynamic ? Math.tan(cone) * Math.hypot(Q.x - O0.x, Q.y - O0.y) / dpr : 0, dpr);
  const dm = q.d / M;
  if (dm >= 8) {
    c.font = `700 ${12 * dpr}px Barlow Condensed, sans-serif`; c.textAlign = 'left'; c.textBaseline = 'top';
    c.lineWidth = 3 * dpr; c.strokeStyle = 'rgba(0,0,0,0.7)'; c.strokeText(`${Math.round(dm)} m`, x + 12 * dpr, y + 10 * dpr);
    c.fillStyle = 'rgba(255,255,255,0.85)'; c.fillText(`${Math.round(dm)} m`, x + 12 * dpr, y + 10 * dpr); c.textBaseline = 'alphabetic';
  }
  // ammo and help
  c.textAlign = 'right'; c.font = `700 ${30 * dpr}px Barlow Condensed, sans-serif`; c.fillStyle = '#fff';
  c.fillText(S.reloadT > 0 ? 'RELOADING' : `${S.ammo} / ${w.mag}`, cv.width - 16 * dpr, cv.height - 16 * dpr);
  c.textAlign = 'left'; c.font = `600 ${14 * dpr}px Barlow Condensed, sans-serif`; c.fillStyle = 'rgba(255,255,255,0.6)';
  c.fillText('Left mouse: shoot   ·   Right mouse: aim in   ·   R: reload   ·   Esc: let go of the mouse', 14 * dpr, cv.height - 18 * dpr);
  if (document.pointerLockElement !== cv) { // not captured yet: the first click only takes control, as in a match
    const a = 0.65 + 0.35 * Math.sin(performance.now() / 260);
    c.textAlign = 'center'; c.font = `700 ${26 * dpr}px Barlow Condensed, sans-serif`; c.fillStyle = `rgba(255,255,255,${a})`;
    c.lineWidth = 4 * dpr; c.strokeStyle = 'rgba(0,0,0,0.6)'; c.strokeText('CLICK TO TAKE CONTROL', cv.width / 2, cv.height * 0.42); c.fillText('CLICK TO TAKE CONTROL', cv.width / 2, cv.height * 0.42);
  }
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
    <p class="note">Full damage up to ${fo.from >= 9999 ? 'any range' : Math.round(fo.from * m.range / M) + ' m'}${fo.from >= 9999 ? '' : `, down to ${Math.round(fo.min * 100)}% by ${Math.round(fo.to * m.range / M)} m`}. A shot through the centre of the body with your crosshair on the head is a headshot: instant kill.</p>
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
