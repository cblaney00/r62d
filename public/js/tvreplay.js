// Esports TV instant replays (he asked: short replays of the big moments the camera missed, full screen, about 6 s,
// with a fade-in and fade-out time so it looks like a real broadcast: smooth and calculated, never a hard cut).
// The server sends every kill as a clip (tvclip: everyone's poses round it, shots, why it was big); main.js keeps the
// ones its camera missed and calls offerReplay; one plays when the action allows, at most one every REST seconds.
import { OPERATORS } from '/shared/operators.js';
import { poses, drawClip } from './killcam.js';

const FADE_IN = 0.55, FADE_OUT = 0.7, REST = 18, STALE = 14, VIEW_H = 430;
let el = null, cv = null, raf = 0, clip = null, t0 = 0, lastEnd = -99, waiting = null, ctx = null;
const smooth = x => x * x * (3 - 2 * x);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export const replaying = () => !!clip;
// a missed big moment: keep the newest (a better one replaces a weaker one)
export function offerReplay(c) {
  c.got = performance.now() / 1000;
  if (!waiting || c.big.length >= waiting.big.length || c.got - waiting.got > 6) waiting = c;
}
// called every frame by main.js with whether it is a good moment (nobody mid-fight on screen) and the map renderer
export function tickReplay(calm, rend, map) {
  const now = performance.now() / 1000;
  if (waiting && now - waiting.got > STALE) waiting = null;
  if (clip || !waiting || !calm || now - lastEnd < REST) return;
  start(waiting, rend, map); waiting = null;
}
export function stopReplay() { if (clip) finish(true); waiting = null; }

// the clip's own clock: up to the kill at normal speed, the kill itself in slow motion, then on for a moment
const A = -3.4, B = 1.0, SLOW0 = -0.6, SLOW1 = 0.35, SLOW = 0.4;
const length = () => (SLOW0 - A) + (SLOW1 - SLOW0) / SLOW + (B - SLOW1);
function clipTime(s) { // seconds since the replay began -> seconds from the kill, with eased slow motion
  const a = SLOW0 - A, b = a + (SLOW1 - SLOW0) / SLOW;
  if (s < a) return A + s;
  if (s < b) return SLOW0 + (s - a) * SLOW;
  return SLOW1 + (s - b);
}

function start(c, rend, map) {
  clip = c; ctx = { rend, map, cam: null };
  if (!el) {
    el = document.createElement('div'); el.id = 'tvReplay';
    el.innerHTML = `<canvas></canvas><div class="rpWipe"></div><div class="rpTag"><b>INSTANT REPLAY</b><span></span></div><div class="rpBar"><i></i></div>`;
    document.body.appendChild(el); cv = el.querySelector('canvas');
  }
  const nm = id => (c.names[id] || ['?'])[0], kOp = c.fr.length && c.fr[c.fr.length - 1].ps.find(e => e[0] === c.killer);
  const op = kOp && OPERATORS[kOp[6]] ? OPERATORS[kOp[6]].name + ' · ' : '';
  el.querySelector(".rpTag span").textContent = `${c.big.length ? c.big.join(" · ") + " — " : ""}${op}${nm(c.killer)} ▸ ${nm(c.victim)} · ${c.w}${c.hs ? ' · HEADSHOT' : ''}`;
  el.classList.remove('out'); el.classList.add('on');
  t0 = performance.now() / 1000; cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
}
function finish(now) {
  cancelAnimationFrame(raf); clip = null; lastEnd = performance.now() / 1000;
  if (!el) return;
  el.classList.add('out'); el.classList.remove('on');
  setTimeout(() => { if (!clip && el) el.classList.remove('out'); }, now ? 0 : FADE_OUT * 1000);
}
function frame() {
  raf = requestAnimationFrame(frame);
  const s = performance.now() / 1000 - t0, L = length();
  if (s >= L + FADE_IN) { finish(); return; }
  const t = clipTime(clamp(s - FADE_IN * 0.5, 0, L)); // the first half of the fade shows the first frame, held
  const dpr = Math.min(devicePixelRatio || 1, 1.5), W = Math.round(innerWidth * dpr), H = Math.round(innerHeight * dpr);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const P = poses(Math.min(t, 0), clip), k = P.get(clip.killer), v = P.get(clip.victim);
  // the camera: between killer and victim, eased, zoomed to keep both in (calculated, no jumps)
  const ax = k ? k.x : clip.kx, ay = k ? k.y : clip.ky, bx = v ? v.x : clip.vx, by = v ? v.y : clip.vy;
  const gx = ax * 0.6 + bx * 0.4, gy = ay * 0.6 + by * 0.4, span = Math.max(Math.abs(ax - bx) * H / W, Math.abs(ay - by)) + 160;
  const want = { x: gx, y: gy, h: clamp(span * 1.25, VIEW_H * 0.8, 820) };
  const cam = ctx.cam || (ctx.cam = { ...want }), dt = 1 / 60;
  const e = 1 - Math.exp(-dt * 3.2); cam.x += (want.x - cam.x) * e; cam.y += (want.y - cam.y) * e; cam.h += (want.h - cam.h) * (1 - Math.exp(-dt * 1.6));
  const slow = t > SLOW0 && t < SLOW1, push = slow ? 0.92 : 1; // a gentle push in on the kill
  const c = cv.getContext('2d');
  drawClip(c, W, H, clip, ctx.rend, ctx.map, t, P, k || v || [...P.values()][0], cam.x, cam.y, H / (cam.h * push));
  c.setTransform(1, 0, 0, 1, 0, 0);
  if (slow) { c.fillStyle = 'rgba(255,214,120,0.05)'; c.fillRect(0, 0, W, H); }
  el.querySelector('.rpBar i').style.transform = `scaleX(${clamp(s / (L + FADE_IN), 0, 1)})`;
  // the fade out: start it so the picture is gone right as the clip ends
  if (s > L + FADE_IN - FADE_OUT && !el.classList.contains('out')) { el.classList.add('out'); el.classList.remove('on'); }
}
