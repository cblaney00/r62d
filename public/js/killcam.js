// Killcam (he asked): after you die, watch the last seconds again — first through the eyes of whoever got you, then
// through your own — and get a BS rating on how fair the kill was (the server works it out: were they ever on your
// screen, a wall in between, lag, from behind...). A "!" means the server caught something that should be impossible
// and saved it as a bug report.
import { OPERATORS } from '/shared/operators.js';
import { visionPoly } from '/shared/physics.js';
import { drawOperator } from './sprites.js';

const FOV = 103 * Math.PI / 180, VIEW_H = 520, PASSES = [['killer', 'THEIR VIEW'], ['victim', 'YOUR VIEW']];
let el = null, raf = 0, kc = null, rend = null, map = null, t0 = 0, onClose = null;

const verdict = r => r <= 2 ? ['FAIR', '#7ddc7a'] : r <= 5 ? ['A BIT ROUGH', '#f2c14e'] : ['TOTAL BS', '#ff5a4a'];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export const killcamOpen = () => !!el;
export function openKillcam(data, renderer, theMap, close) {
  if (!data || !data.fr || !data.fr.length) return;
  kc = data; rend = renderer; map = theMap; onClose = close;
  if (!el) {
    el = document.createElement('div'); el.id = 'killcam';
    el.innerHTML = `<div class="kcBox"><div class="kcTop"><b class="kcTitle"></b><span class="kcSub"></span></div>
      <canvas width="960" height="540"></canvas><div class="kcBar"><i></i></div>
      <div class="kcResult hidden"></div>
      <div class="kcBtns"><button class="kcReplay">REPLAY</button><button class="kcClose">CLOSE (ESC)</button></div></div>`;
    document.body.appendChild(el);
    el.querySelector('.kcReplay').onclick = () => start();
    el.querySelector('.kcClose').onclick = () => closeKillcam();
    addEventListener('keydown', e => { if (el && e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); closeKillcam(); } }, true);
  }
  start();
}
export function closeKillcam() {
  cancelAnimationFrame(raf); if (el) el.remove(); el = null; if (onClose) onClose();
}
function start() {
  t0 = performance.now() / 1000; el.querySelector('.kcResult').classList.add('hidden');
  cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
}
// where everyone was at time t (seconds before the death, negative), smoothly between frames
function poses(t) {
  const F = kc.fr; let i = F.findIndex(f => f.t >= t); if (i < 0) i = F.length - 1;
  const b = F[i], a = F[Math.max(0, i - 1)], u = b.t === a.t ? 1 : Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t)));
  const out = new Map();
  for (const e of b.ps) {
    const pa = a.ps.find(x => x[0] === e[0]) || e, lerpA = pa[3] + Math.atan2(Math.sin(e[3] - pa[3]), Math.cos(e[3] - pa[3])) * u;
    out.set(e[0], { id: e[0], x: pa[1] + (e[1] - pa[1]) * u, y: pa[2] + (e[2] - pa[2]) * u, aim: lerpA, fl: e[4], hp: e[5], op: e[6], w: e[7] });
  }
  if (t > 0) out.delete(kc.victim); // gone once dead
  return out;
}
function frame() {
  raf = requestAnimationFrame(frame);
  const cv = el.querySelector('canvas'), c = cv.getContext('2d'), W = cv.width, H = cv.height;
  const first = Math.max(kc.fr[0].t, -4.8), len = 0.9 - first, el2 = performance.now() / 1000 - t0;
  const pass = Math.floor(el2 / len);
  if (!kc.killer && pass === 0) { t0 -= len; return; } // nobody to ride along with: your view only
  if (pass >= PASSES.length) { showResult(); cancelAnimationFrame(raf); return; }
  const t = first + (el2 % len), [who, title] = PASSES[pass], P = poses(Math.min(t, 0)), focusId = kc[who];
  const nm = id => (kc.names[id] || ['?'])[0];
  el.querySelector('.kcTitle').textContent = title;
  el.querySelector('.kcSub').textContent = who === 'killer' ? `${nm(kc.killer)} · ${kc.w}${kc.hs ? ' · HEADSHOT' : ''}` : 'what you could see';
  el.querySelector('.kcBar i').style.width = Math.round((el2 % len) / len * 100) + '%';
  const focus = P.get(focusId) || P.get(kc.victim) || [...P.values()][0];
  if (!focus) return;
  const z = H / VIEW_H, cx = focus.x, cy = focus.y;
  c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#07090c'; c.fillRect(0, 0, W, H);
  c.setTransform(z, 0, 0, z, W / 2 - cx * z, H / 2 - cy * z);
  const k = rend.c.width / rend.Wp, vx0 = cx - W / 2 / z, vy0 = cy - H / 2 / z, vw = W / z, vh = H / z;
  rend.c.drawTo(c, Math.max(0, vx0 * k), Math.max(0, vy0 * k), vw * k, vh * k, Math.max(0, vx0), Math.max(0, vy0), vw, vh);
  // what this person could see: everything else dimmed
  const pts = visionPoly(map, focus.x, focus.y, focus.aim, FOV, 900, [], 220);
  c.save(); c.beginPath(); c.rect(vx0, vy0, vw, vh);
  if (pts.length > 4) { c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); }
  c.fillStyle = 'rgba(4,6,10,0.62)'; c.fill('evenodd'); c.restore();
  // shots: a short bright streak when fired
  for (const s of kc.shots) if (t >= s.t && t - s.t < 0.12) {
    c.strokeStyle = s.id === kc.killer ? 'rgba(255,120,80,0.95)' : 'rgba(120,190,255,0.95)'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(s.x0, s.y0); c.lineTo(s.x, s.y); c.stroke();
  }
  const now = performance.now() / 1000;
  for (const p of P.values()) {
    const ally = (kc.names[p.id] || [0, 0])[1] === 1;
    drawOperator(c, { x: p.x, y: p.y, aim: p.aim, op: p.op, w: p.w, ally, ads: p.fl & 2, crouch: p.fl & 4, downed: p.fl & 1, brace: p.fl & 8 }, now);
    c.save(); c.font = '700 9px Barlow Condensed, sans-serif'; c.textAlign = 'center'; c.fillStyle = p.id === kc.killer ? '#ff8a6a' : p.id === kc.victim ? '#9fd0ff' : 'rgba(255,255,255,0.7)';
    c.fillText(`${nm(p.id)}${OPERATORS[p.op] ? ' · ' + OPERATORS[p.op].name : ''}`, p.x, p.y - 16); c.restore();
  }
  if (t > 0) { const v = kc.fr[kc.fr.length - 1].ps.find(e => e[0] === kc.victim); if (v) { c.strokeStyle = '#ff4a3a'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(v[1] - 6, v[2] - 6); c.lineTo(v[1] + 6, v[2] + 6); c.moveTo(v[1] + 6, v[2] - 6); c.lineTo(v[1] - 6, v[2] + 6); c.stroke(); } }
}
function showResult() {
  const [word, col] = verdict(kc.rating), r = el.querySelector('.kcResult');
  r.innerHTML = `<div class="kcRate" style="--c:${col}"><small>BS RATING</small><b>${kc.rating}<em>/10</em></b><span>${word}</span></div>
    <ul>${kc.why.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` +
    (kc.bug ? `<div class="kcBug"><b>!</b><div>Something impossible happened: ${esc(kc.bug.join('; '))}.<small>Saved as bug report ${esc(kc.bugId || '')} so it can be fixed.</small></div></div>` : '');
  r.classList.remove('hidden');
}
