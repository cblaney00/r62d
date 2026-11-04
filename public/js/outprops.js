// Pictures of the outdoor things round each map (shared/outdoors.js): vehicles, huts, rocks, trees, playground...
// Drawn in code like all the other furniture; every one is told its box in map pixels and works either way round.
import { shade } from './textures.js';

const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
const shadow = (c, X, Y, W, H, r = 2) => { c.fillStyle = 'rgba(0,0,0,0.38)'; rr(c, X + 3, Y + 4, W, H, r); c.fill(); };
// draws with the long side running up and down: fn(L, B), centre at 0,0, front at -L/2
function long(c, X, Y, W, H, h, fn) { c.save(); c.translate(X + W / 2, Y + H / 2); if (W > H) c.rotate(Math.PI / 2 * (h(2) < 0.5 ? 1 : -1)); else if (h(2) < 0.5) c.rotate(Math.PI); fn(Math.max(W, H), Math.min(W, H)); c.restore(); }
function vehicle(c, X, Y, W, H, h, col, roof, draw) {
  shadow(c, X, Y, W, H, 4);
  long(c, X, Y, W, H, h, (L, B) => {
    c.fillStyle = '#111'; for (const s of [-1, 1]) for (const t of [-0.3, 0.3]) c.fillRect(s * B / 2 - 2, t * L - 5, 4, 10);
    const b = B - 4, l = L - 2, g = c.createLinearGradient(-b / 2, 0, b / 2, 0); g.addColorStop(0, shade(col, 0.72)); g.addColorStop(0.5, col); g.addColorStop(1, shade(col, 0.68));
    c.fillStyle = g; rr(c, -b / 2, -l / 2, b, l, 5); c.fill();
    c.fillStyle = roof; rr(c, -b / 2 + 2.5, -l / 2 + 13, b - 5, l - 17, 3); c.fill();
    c.fillStyle = 'rgba(25,35,45,0.92)'; rr(c, -b / 2 + 2, -l / 2 + 4, b - 4, 7, 2); c.fill();
    if (draw) draw(b, l);
  });
}
function hut(c, X, Y, W, H, wall, roof) {
  shadow(c, X, Y, W, H);
  c.fillStyle = wall; c.fillRect(X, Y, W, H);
  c.fillStyle = roof; c.fillRect(X + 1.5, Y + 1.5, W - 3, H - 3);
  c.fillStyle = 'rgba(255,255,255,0.12)';
  if (W >= H) c.fillRect(X + 1.5, Y + H / 2 - 0.7, W - 3, 1.4); else c.fillRect(X + W / 2 - 0.7, Y + 1.5, 1.4, H - 3);
  c.fillStyle = 'rgba(0,0,0,0.18)'; if (W >= H) c.fillRect(X + 1.5, Y + H / 2 + 0.7, W - 3, H / 2 - 2.2); else c.fillRect(X + W / 2 + 0.7, Y + 1.5, W / 2 - 2.2, H - 3);
}
function blobs(c, X, Y, W, H, h, cols, n = 14, rad = 0.28) {
  const m = Math.min(W, H);
  for (let i = 0; i < n; i++) {
    const r = m * rad * (0.7 + h(i + 3) * 0.6), x = X + r * 0.6 + h(i + 11) * (W - r * 1.2), y = Y + r * 0.6 + h(i + 21) * (H - r * 1.2);
    c.fillStyle = cols[i % cols.length]; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  }
}
function star(c, cx, cy, r, n, col, inner = 0.55, rot = 0) {
  c.fillStyle = col; c.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, q = i % 2 ? r * inner : r; c.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); }
  c.closePath(); c.fill();
}

export function drawOutProp(c, p, X, Y, W, H, h) {
  const cx = X + W / 2, cy = Y + H / 2, R = Math.min(W, H) / 2;
  switch (p.kind) {
    case 'aircon': shadow(c, X, Y, W, H, 3); c.fillStyle = '#8a9096'; c.fillRect(X, Y, W, H); c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 1; c.strokeRect(X + 0.5, Y + 0.5, W - 1, H - 1); c.fillStyle = '#4b5056'; c.beginPath(); c.arc(cx, cy, R * 0.72, 0, 7); c.fill(); c.strokeStyle = '#b5bbc1'; for (let i = 0; i < 3; i++) { const a = i * 2.09; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * R * 0.66, cy + Math.sin(a) * R * 0.66); c.stroke(); } break;
    case 'truck': shadow(c, X, Y, W, H, 3); long(c, X, Y, W, H, h, (L, B) => {
      c.fillStyle = '#111'; for (const s of [-1, 1]) for (const t of [-0.36, 0.18, 0.36]) c.fillRect(s * B / 2 - 2, t * L - 4, 4, 8);
      c.fillStyle = '#d4d6d8'; c.fillRect(-B / 2 + 1, -L / 2 + L * 0.27, B - 2, L * 0.72); c.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 6; i++) c.fillRect(-B / 2 + 1, -L / 2 + L * 0.3 + i * L * 0.11, B - 2, 1);
      c.fillStyle = '#b5482e'; rr(c, -B / 2 + 2, -L / 2, B - 4, L * 0.24, 3); c.fill(); c.fillStyle = 'rgba(25,35,45,0.92)'; c.fillRect(-B / 2 + 4, -L / 2 + 2, B - 8, 4);
    }); break;
    case 'bus': vehicle(c, X, Y, W, H, h, '#3f6f9e', '#c9d2d9', (b, l) => { c.fillStyle = 'rgba(0,0,0,0.25)'; for (const t of [-0.1, 0.2]) c.fillRect(-b / 4, t * l, b / 2, 4); }); break;
    case 'schoolbus': vehicle(c, X, Y, W, H, h, '#e2ad1f', '#eac24e', (b, l) => { c.fillStyle = 'rgba(20,20,20,0.75)'; for (const s of [-1, 1]) c.fillRect(s * b / 2 - (s > 0 ? 2 : 0), -l / 2 + 12, 2, l - 16); c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(-b / 4, 0, b / 2, 4); }); break;
    case 'snowcat': shadow(c, X, Y, W, H, 3); long(c, X, Y, W, H, h, (L, B) => {
      c.fillStyle = '#17181a'; for (const s of [-1, 1]) { c.fillRect(s * B / 2 - (s > 0 ? 7 : 0) * (s > 0 ? 1 : 0) - (s < 0 ? 0 : 0), -L / 2 + 2, 7, L - 4); c.fillStyle = '#34363a'; for (let i = 0; i < L - 6; i += 4) c.fillRect(s > 0 ? B / 2 - 7 : -B / 2, -L / 2 + 3 + i, 7, 1.3); c.fillStyle = '#17181a'; }
      c.fillStyle = '#c23a2a'; rr(c, -B / 2 + 7, -L / 2 + 4, B - 14, L - 10, 3); c.fill(); c.fillStyle = 'rgba(25,35,45,0.92)'; c.fillRect(-B / 2 + 8, -L / 2 + 6, B - 16, 6);
      c.fillStyle = '#d7d9db'; c.fillRect(-B / 2 + 1, -L / 2 - 1, B - 2, 3);
    }); break;
    case 'forklift': shadow(c, X, Y, W, H, 3); long(c, X, Y, W, H, h, (L, B) => {
      c.fillStyle = '#d8a324'; rr(c, -B / 2 + 2, -L / 4, B - 4, L * 0.7, 3); c.fill(); c.fillStyle = '#2b2b2b'; c.strokeStyle = '#2b2b2b'; c.lineWidth = 1.4; c.strokeRect(-B / 2 + 4, -L / 8, B - 8, L * 0.32);
      c.fillStyle = '#6a6d70'; for (const s of [-1, 1]) c.fillRect(s * B / 4 - 1.2, -L / 2, 2.4, L / 4 + 2);
    }); break;
    case 'tankcar': shadow(c, X, Y, W, H, 3); long(c, X, Y, W, H, h, (L, B) => {
      c.fillStyle = '#2b2d30'; c.fillRect(-B / 2 + 2, -L / 2, B - 4, L);
      const g = c.createLinearGradient(-B / 2, 0, B / 2, 0); g.addColorStop(0, '#3b4a55'); g.addColorStop(0.45, '#90a4ae'); g.addColorStop(1, '#303c45');
      c.fillStyle = g; rr(c, -B / 2 + 1, -L / 2 + 3, B - 2, L - 6, R * 0.9); c.fill(); c.fillStyle = '#d0d4d6'; c.beginPath(); c.arc(0, 0, 3, 0, 7); c.fill();
    }); break;
    case 'bufferstop': shadow(c, X, Y, W, H); c.fillStyle = '#7d2a22'; c.fillRect(X, Y, W, H); c.fillStyle = '#e4c23a'; for (let i = 0; i < Math.max(W, H); i += 6) { if (W > H) c.fillRect(X + i, Y, 3, H); else c.fillRect(X, Y + i, W, 3); } break;
    case 'lifthut': hut(c, X, Y, W, H, '#5a3f2a', '#7c5a3c'); c.fillStyle = 'rgba(240,245,250,0.55)'; c.fillRect(X + 2, Y + 2, W - 4, Math.min(5, H / 3)); break;
    case 'cabana': hut(c, X, Y, W, H, '#c9bda6', '#a8693e'); break;
    case 'booth': hut(c, X, Y, W, H, '#b7bcc0', '#7d868d'); c.fillStyle = 'rgba(120,180,220,0.5)'; c.fillRect(X + 1, Y + 1, W - 2, 2); break;
    case 'gatehouse': hut(c, X, Y, W, H, '#9b9488', '#5a5e63'); break;
    case 'signalbox': hut(c, X, Y, W, H, '#7a3a2a', '#47494d'); break;
    case 'canopy': hut(c, X, Y, W, H, '#3c4750', '#6f7c86'); c.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 8; i < Math.max(W, H); i += 12) { if (W > H) c.fillRect(X + i, Y + 2, 1, H - 4); else c.fillRect(X + 2, Y + i, W - 4, 1); } break;
    case 'shelter': shadow(c, X, Y, W, H); c.fillStyle = 'rgba(150,190,215,0.7)'; c.fillRect(X, Y, W, H); c.strokeStyle = '#3d4449'; c.lineWidth = 1.5; c.strokeRect(X + 0.7, Y + 0.7, W - 1.4, H - 1.4); c.fillStyle = 'rgba(255,255,255,0.22)'; c.fillRect(X + 2, Y + 2, W - 4, 2); break;
    case 'tent': { shadow(c, X, Y, W, H); const a = ['#a23b2c', '#dfd2b2']; const v = W > H; for (let i = 0, n = 6; i < n; i++) { c.fillStyle = a[i % 2]; if (v) c.fillRect(X + i * W / n, Y, W / n + 0.5, H); else c.fillRect(X, Y + i * H / n, W, H / n + 0.5); } c.fillStyle = 'rgba(0,0,0,0.16)'; if (v) c.fillRect(X, cy, W, H / 2); else c.fillRect(cx, Y, W / 2, H); break; }
    case 'hedge': shadow(c, X, Y, W, H, 3); c.fillStyle = '#29431f'; rr(c, X, Y, W, H, 3); c.fill(); blobs(c, X, Y, W, H, h, ['#2f4f25', '#3e6631', '#507c3d'], Math.ceil(Math.max(W, H) / 3), 0.34); break;
    case 'cypress': c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.arc(cx + 4, cy + 5, R, 0, 7); c.fill(); c.fillStyle = '#1e3a24'; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fill(); c.fillStyle = '#2f5535'; c.beginPath(); c.arc(cx - 1, cy - 1, R * 0.62, 0, 7); c.fill(); break;
    case 'pine': case 'snowpine': { c.fillStyle = 'rgba(0,0,0,0.28)'; c.beginPath(); c.arc(cx + 5, cy + 6, R * 1.25, 0, 7); c.fill(); star(c, cx, cy, R * 1.4, 9, '#1c3626', 0.62, h(1) * 6); star(c, cx, cy, R * 1.0, 8, '#2a4c35', 0.6, h(2) * 6); if (p.kind === 'snowpine') { star(c, cx, cy, R * 0.72, 7, '#dfe8ec', 0.55, h(3) * 6); c.fillStyle = '#f4f8fa'; c.beginPath(); c.arc(cx, cy, R * 0.25, 0, 7); c.fill(); } break; }
    case 'palm': c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.arc(cx + 5, cy + 6, R, 0, 7); c.fill(); for (let i = 0; i < 8; i++) { const a = h(i) * 0.4 + i * Math.PI / 4; c.save(); c.translate(cx, cy); c.rotate(a); c.fillStyle = i % 2 ? '#4d7a33' : '#3a6128'; c.beginPath(); c.ellipse(R * 0.85, 0, R * 0.95, R * 0.24, 0, 0, 7); c.fill(); c.restore(); } c.fillStyle = '#6f5335'; c.beginPath(); c.arc(cx, cy, 2.4, 0, 7); c.fill(); break;
    case 'rock': { const n = 9; c.fillStyle = 'rgba(0,0,0,0.35)'; const pts = []; for (let i = 0; i < n; i++) { const a = i / n * 6.283, q = 0.78 + h(i + 5) * 0.22; pts.push([cx + Math.cos(a) * W / 2 * q, cy + Math.sin(a) * H / 2 * q]); }
      const poly = (dx, dy, s) => { c.beginPath(); pts.forEach(([x, y], i) => { const px = cx + (x - cx) * s + dx, py = cy + (y - cy) * s + dy; if (i) c.lineTo(px, py); else c.moveTo(px, py); }); c.closePath(); c.fill(); };
      poly(3, 4, 1); c.fillStyle = '#6a665f'; poly(0, 0, 1); c.fillStyle = '#85817a'; poly(-1, -1, 0.68); c.fillStyle = '#9b9790'; poly(-2, -2, 0.34); break; }
    case 'snowbank': shadow(c, X, Y, W, H, 4); c.fillStyle = '#c6d2d9'; rr(c, X, Y, W, H, R * 0.8); c.fill(); blobs(c, X, Y, W, H, h, ['#dfe7ec', '#f1f5f7'], Math.ceil(Math.max(W, H) / 4), 0.36); break;
    case 'logs': { shadow(c, X, Y, W, H); const v = W > H, n = Math.max(2, Math.round(Math.min(W, H) / 7)); for (let i = 0; i < n; i++) { const t = (v ? H : W) / n; c.fillStyle = i % 2 ? '#6b4a2e' : '#7c5736'; if (v) { rr(c, X, Y + i * t, W, t, t / 2); } else { rr(c, X + i * t, Y, t, H, t / 2); } c.fill(); c.fillStyle = '#c29a6a'; c.beginPath(); if (v) c.arc(X + W - 2.5, Y + (i + 0.5) * t, t * 0.35, 0, 7); else c.arc(X + (i + 0.5) * t, Y + H - 2.5, t * 0.35, 0, 7); c.fill(); } break; }
    case 'pylon': c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(X + 3, Y + 4, W, H); c.fillStyle = '#50565c'; c.fillRect(X + 2, Y + 2, W - 4, H - 4); c.fillStyle = '#878d93'; c.fillRect(X - 7, cy - 1.2, W + 14, 2.4); c.fillStyle = '#2b2e31'; for (const s of [-1, 1]) { c.beginPath(); c.arc(cx + s * (W / 2 + 6), cy, 2.2, 0, 7); c.fill(); } break;
    case 'fountain': c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.arc(cx + 3, cy + 4, R, 0, 7); c.fill(); c.fillStyle = '#a7a59e'; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fill(); c.fillStyle = '#4c8fa8'; c.beginPath(); c.arc(cx, cy, R * 0.8, 0, 7); c.fill(); c.strokeStyle = 'rgba(220,240,250,0.5)'; c.lineWidth = 0.8; for (const q of [0.3, 0.55]) { c.beginPath(); c.arc(cx, cy, R * q, 0, 7); c.stroke(); } c.fillStyle = '#c3c1b9'; c.beginPath(); c.arc(cx, cy, R * 0.18, 0, 7); c.fill(); break;
    case 'pier': shadow(c, X, Y, W, H); c.fillStyle = '#8e887c'; c.fillRect(X, Y, W, H); c.fillStyle = '#b5afa2'; c.fillRect(X + 2, Y + 2, W - 4, H - 4); break;
    case 'planter': shadow(c, X, Y, W, H); c.fillStyle = '#8a7f70'; c.fillRect(X, Y, W, H); c.fillStyle = '#3a2d20'; c.fillRect(X + 2, Y + 2, W - 4, H - 4); blobs(c, X + 2, Y + 2, W - 4, H - 4, h, ['#3e6631', '#5a8a42'], 7, 0.3); break;
    case 'parasol': { c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.arc(cx + 4, cy + 5, R * 1.3, 0, 7); c.fill(); for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#e8e2d2' : '#2e7f96'; c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, R * 1.3, i * Math.PI / 4, (i + 1) * Math.PI / 4); c.closePath(); c.fill(); } break; }
    case 'lounger': c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(X + 1.5, Y + 2, W, H); c.fillStyle = '#d9d2c0'; c.fillRect(X, Y, W, H); c.fillStyle = '#2e7f96'; c.fillRect(X + 1, Y + 1, W - 2, H - 2); break;
    case 'skirack': case 'bikerack': { shadow(c, X, Y, W, H, 1); c.fillStyle = '#4b5057'; c.fillRect(X, Y + H / 3, W, H / 3); const cols = p.kind === 'skirack' ? ['#d33d3d', '#2e8fd0', '#e8c23a', '#eee'] : ['#222', '#3a5a7a', '#7a2f25']; const n = Math.floor(Math.max(W, H) / 4); for (let i = 0; i < n; i++) { c.fillStyle = cols[i % cols.length]; c.fillRect(X + 2 + i * 4, Y - 2, 1.6, H + 4); } break; }
    case 'firepit': c.fillStyle = '#6b655d'; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fill(); c.fillStyle = '#231a14'; c.beginPath(); c.arc(cx, cy, R * 0.68, 0, 7); c.fill(); c.fillStyle = '#d9692a'; c.beginPath(); c.arc(cx, cy, R * 0.3, 0, 7); c.fill(); c.fillStyle = '#f2c14e'; c.beginPath(); c.arc(cx, cy, R * 0.14, 0, 7); c.fill(); break;
    case 'climbframe': { shadow(c, X, Y, W, H); c.fillStyle = '#b5482e'; c.fillRect(X + 3, Y + 3, W - 6, H - 6); c.fillStyle = '#e4c23a'; c.fillRect(X + W / 3, Y + 3, W / 3, H - 6); c.strokeStyle = '#2e6da3'; c.lineWidth = 2; c.strokeRect(X + 1, Y + 1, W - 2, H - 2); c.fillStyle = '#23272b'; for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) c.fillRect(X + a * (W - 3), Y + b * (H - 3), 3, 3); break; }
    case 'slide': shadow(c, X, Y, W, H, 3); long(c, X, Y, W, H, h, (L, B) => { c.fillStyle = '#2e6da3'; c.fillRect(-B / 2, -L / 2, B, L * 0.28); const g = c.createLinearGradient(0, -L / 4, 0, L / 2); g.addColorStop(0, '#e4c23a'); g.addColorStop(1, '#d98f2a'); c.fillStyle = g; rr(c, -B / 2 + 2, -L / 2 + L * 0.28, B - 4, L * 0.72, 3); c.fill(); c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(-1, -L / 4, 2, L * 0.7); }); break;
    case 'swings': { shadow(c, X, Y, W, H, 1); const v = W > H; c.fillStyle = '#2e6da3'; if (v) c.fillRect(X, cy - 1.4, W, 2.8); else c.fillRect(cx - 1.4, Y, 2.8, H); c.fillStyle = '#23272b'; for (let i = 1; i < 4; i++) { const f = i / 4; if (v) c.fillRect(X + W * f - 3, cy - 3, 6, 6); else c.fillRect(cx - 3, Y + H * f - 3, 6, 6); } break; }
    case 'bleachers': { shadow(c, X, Y, W, H, 1); const v = W > H, n = 5; for (let i = 0; i < n; i++) { c.fillStyle = i % 2 ? '#8b9096' : '#6e7379'; if (v) c.fillRect(X, Y + i * H / n, W, H / n + 0.4); else c.fillRect(X + i * W / n, Y, W / n + 0.4, H); } break; }
    case 'goal': { const v = W > H; c.fillStyle = 'rgba(255,255,255,0.14)'; c.fillRect(X, Y, W, H); c.strokeStyle = 'rgba(235,235,235,0.35)'; c.lineWidth = 0.5; for (let i = 3; i < W; i += 3) { c.beginPath(); c.moveTo(X + i, Y); c.lineTo(X + i, Y + H); c.stroke(); } for (let i = 3; i < H; i += 3) { c.beginPath(); c.moveTo(X, Y + i); c.lineTo(X + W, Y + i); c.stroke(); } c.fillStyle = '#eee'; if (v) { c.fillRect(X, Y, W, 2); c.fillRect(X, Y, 2, H); c.fillRect(X + W - 2, Y, 2, H); } else { c.fillRect(X, Y, 2, H); c.fillRect(X, Y, W, 2); c.fillRect(X, Y + H - 2, W, 2); } break; }
    case 'fence': { const v = W >= H; c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(X + 2, Y + 3, W, H); c.fillStyle = '#6c7278'; if (v) c.fillRect(X, cy - 1, W, 2); else c.fillRect(cx - 1, Y, 2, H); c.fillStyle = '#3e4347'; for (let i = 0, L = v ? W : H; i <= L; i += 16) { if (v) c.fillRect(X + i - 1.2, cy - 2.2, 2.4, 4.4); else c.fillRect(cx - 2.2, Y + i - 1.2, 4.4, 2.4); } break; }
    case 'wall': case 'ruin': { shadow(c, X, Y, W, H, 1); const base = p.kind === 'ruin' ? '#a58a5e' : '#7f766a'; c.fillStyle = base; c.fillRect(X, Y, W, H); c.fillStyle = shade(base, 1.18); c.fillRect(X + 1, Y + 1, W - 2, Math.max(1.5, H * 0.35)); c.fillStyle = 'rgba(0,0,0,0.14)'; for (let i = 0, L = Math.max(W, H); i < L; i += 7) { if (W > H) c.fillRect(X + i, Y, 0.8, H); else c.fillRect(X, Y + i, W, 0.8); } if (p.kind === 'ruin') { c.fillStyle = 'rgba(70,50,30,0.55)'; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(X + h(i + 1) * W, Y + h(i + 7) * H, 1.2 + h(i + 3) * 2, 0, 7); c.fill(); } } break; }
    case 'wreck': shadow(c, X, Y, W, H, 4); long(c, X, Y, W, H, h, (L, B) => { c.fillStyle = '#4a3226'; rr(c, -B / 2 + 2, -L / 2, B - 4, L, 5); c.fill(); c.fillStyle = '#26211d'; rr(c, -B / 2 + 4, -L / 5, B - 8, L * 0.45, 3); c.fill(); c.fillStyle = '#7b4a2c'; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc((h(i + 4) - 0.5) * B * 0.7, (h(i + 9) - 0.5) * L * 0.85, 1.4 + h(i) * 2, 0, 7); c.fill(); } }); break;
    case 'sandbags': { shadow(c, X, Y, W, H, 2); const v = W > H, L = v ? W : H; for (let i = 0; i < L; i += 7) { c.fillStyle = i % 14 ? '#a6946a' : '#b7a57b'; if (v) rr(c, X + i, Y, 7.5, H, 3); else rr(c, X, Y + i, W, 7.5, 3); c.fill(); } break; }
    case 'barrels': for (const [a, b] of [[0.3, 0.3], [0.72, 0.38], [0.45, 0.74]]) { const x = X + a * W, y = Y + b * H, r = R * 0.42; c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.arc(x + 2, y + 2.5, r, 0, 7); c.fill(); c.fillStyle = h(a * 10) < 0.5 ? '#3f5f7a' : '#7a3c2a'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 0.8; c.beginPath(); c.arc(x, y, r * 0.65, 0, 7); c.stroke(); } break;
    case 'cart': shadow(c, X, Y, W, H, 2); c.fillStyle = '#6d4c2f'; c.fillRect(X + 1, Y + 1, W - 2, H - 2); c.fillStyle = '#8c6a44'; for (let i = 2; i < Math.max(W, H) - 2; i += 4) { if (W > H) c.fillRect(X + i, Y + 2, 2.2, H - 4); else c.fillRect(X + 2, Y + i, W - 4, 2.2); } break;
    case 'lamp': c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.arc(cx + 2, cy + 3, 3, 0, 7); c.fill(); c.fillStyle = '#3d4247'; c.beginPath(); c.arc(cx, cy, 2.6, 0, 7); c.fill(); c.fillStyle = 'rgba(245,225,160,0.85)'; c.beginPath(); c.arc(cx, cy, 1.2, 0, 7); c.fill(); break;
    case 'tunnel': { shadow(c, X, Y, W, H, 3); c.fillStyle = '#6a665f'; rr(c, X, Y, W, H, 4); c.fill(); c.fillStyle = '#85817a'; c.fillRect(X + 2, Y + 2, W - 4, H * 0.3); c.fillStyle = '#0d0d0e'; if (W >= H) c.fillRect(X + W * 0.2, Y + H * 0.45, W * 0.6, H * 0.55); else c.fillRect(X + W * 0.45, Y + H * 0.2, W * 0.55, H * 0.6); break; }
  }
}
