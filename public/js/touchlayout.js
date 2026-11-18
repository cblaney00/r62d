// Phone button layout with fire rings (he asked 2026-11-17: "lets play with some different polygons that fit in with
// eachother and have different sizes and shapes. the buttons with the most total area or closest accessibility to the
// joysticks should be considered"). Every button is a polygon worked out here, in design units (CSS px before --tz):
//  - round the aim stick, outside its red fire ring, two faceted bands of ring pieces: the inner band (crouch, reload,
//    swap, skill, gadget: pressed most) touches the ring; the outer band (jump, melee) is smaller; ACTION is a big
//    corner piece filling the bottom-right corner; the camera arrows take the outer band's upper end (cameras only)
//  - lean (and ⟲ TILT) are ring pieces round the move stick's resting place
//  - the top row is a strip of interlocking hexagons
// Buttons are not clipped (count badges may stick out); polyHit() decides which shape a finger is in.
const D = Math.PI / 180;
export const STICK = { VR: 60, RING: 88, KNOB: 70 }; // stick radius, fire ring's outer radius, how far the knob travels while held
const RC = { x: -232, y: -128 }; // (he asked 2026-11-18: buttons smaller, sticks the same, the middle of the screen more open: thinner bands, the aim stick 18 px nearer the corner) the aim stick's centre, from the bottom-right corner (style.css #touchUI.rings #tsRight)
const LC = { x: 100, y: -100 }; // the move stick's resting centre, from the bottom-left corner (#tsLeft)
const B1 = [94, 136], B2 = [140, 172], GAP = 4; // (were 94-150 and 156-196)
const SPEC = [
  { id: 'crouch', at: 'br', c: RC, r: B1, a: [15, 55], is: 21 },
  { id: 'reload', at: 'br', c: RC, r: B1, a: [-25, 15], is: 21 },
  { id: 'swap', at: 'br', c: RC, r: B1, a: [-62, -25], is: 20 },
  { id: 'skill', at: 'br', c: RC, r: B1, a: [-98, -62], is: 18 },
  { id: 'gadget', at: 'br', c: RC, r: B1, a: [-134, -98], is: 18 },
  { id: 'use', at: 'br', c: RC, r: [140, 236], a: [8, 62], is: 26, clip: 6 }, // ACTION: the corner piece
  { id: 'jump', at: 'br', c: RC, r: B2, a: [-30, 8], is: 17 },
  { id: 'melee', at: 'br', c: RC, r: B2, a: [-66, -30], is: 17 },
  { id: 'next', at: 'br', c: RC, r: B2, a: [-100, -66], is: 18 }, { id: 'prev', at: 'br', c: RC, r: B2, a: [-134, -100], is: 18 },
  { id: 'leanR', at: 'bl', c: LC, r: [94, 128], a: [-25, 10], is: 18 }, { id: 'leanL', at: 'bl', c: LC, r: [94, 128], a: [-60, -25], is: 18 }, // (right of the stick, clear of the team list above it)
  { id: 'tiltc', at: 'bl', c: LC, r: [94, 128], a: [10, 38], is: 16 },
];
const TOP = ['pause', 'help', 'score', 'view', 'map']; // right to left: flat-topped hexagons, every other one half a step down
const HEX = 17; // (was 21)

function sector(c, [r0, r1], [lo, hi]) { // a faceted ring piece, GAP apart from its neighbours
  const ri = r0 + GAP / 2, ro = r1 - GAP / 2, n = Math.max(1, Math.ceil((hi - lo) / 18)), pts = [];
  const tO = GAP / 2 / ro / D, tI = GAP / 2 / ri / D;
  for (let i = 0; i <= n; i++) { const a = (lo + tO + (hi - lo - 2 * tO) * i / n) * D; pts.push([c.x + ro * Math.cos(a), c.y + ro * Math.sin(a)]); }
  for (let i = n; i >= 0; i--) { const a = (lo + tI + (hi - lo - 2 * tI) * i / n) * D; pts.push([c.x + ri * Math.cos(a), c.y + ri * Math.sin(a)]); }
  return pts;
}
function clipTo(p, axis, max) { // keep the part with p[axis] <= max (Sutherland-Hodgman, one edge)
  const out = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length], ia = a[axis] <= max, ib = b[axis] <= max;
    if (ia) out.push(a);
    if (ia !== ib) { const t = (max - a[axis]) / (b[axis] - a[axis]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}
const area = p => p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0) / 2;
function centroid(p) {
  const A = area(p); let x = 0, y = 0;
  for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length], k = a[0] * b[1] - b[0] * a[1]; x += (a[0] + b[0]) * k; y += (a[1] + b[1]) * k; }
  return [x / (6 * A), y / (6 * A)];
}
function inset(p, d) { // the same shape d px smaller all round (each edge moved in, neighbours intersected)
  const s = area(p) > 0 ? 1 : -1, n = p.length, L = [];
  for (let i = 0; i < n; i++) { const a = p[i], b = p[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -s * dy / l, ny = s * dx / l; L.push([a[0] + nx * d, a[1] + ny * d, dx, dy]); }
  return L.map((q, i) => { const o = L[(i - 1 + n) % n], den = o[2] * q[3] - o[3] * q[2]; if (Math.abs(den) < 1e-9) return [q[0], q[1]]; const t = ((q[0] - o[0]) * q[3] - (q[1] - o[1]) * q[2]) / den; return [o[0] + o[2] * t, o[1] + o[3] * t]; });
}
function hex(cx, cy, r) { const p = []; for (let i = 0; i < 6; i++) p.push([cx + r * Math.cos(i * 60 * D), cy + r * Math.sin(i * 60 * D)]); return p; }

function place(el, pts, at, is) {
  const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const loc = pts.map(q => [q[0] - x0, q[1] - y0]), [cx, cy] = centroid(loc), w = x1 - x0, h = y1 - y0;
  const s = el.style; s.width = `${w}px`; s.height = `${h}px`; s.left = s.right = s.top = s.bottom = 'auto';
  if (at === 'br') { s.right = `${-x1}px`; s.bottom = `${-y1}px`; } else if (at === 'bl') { s.left = `${x0}px`; s.bottom = `${-y1}px`; } else { s.right = `${-x1}px`; s.top = `${y0}px`; }
  const poly = q => `polygon(${q.map(v => `${v[0].toFixed(1)}px ${v[1].toFixed(1)}px`).join(', ')})`;
  s.setProperty('--cp', poly(loc)); s.setProperty('--ci', poly(inset(loc, 2)));
  s.setProperty('--cx', `${cx.toFixed(1)}px`); s.setProperty('--cy', `${cy.toFixed(1)}px`); s.setProperty('--is', `${is}px`);
  const b = loc.reduce((m, v) => (v[0] - v[1] > m[0] - m[1] ? v : m)), bx = cx + (b[0] - cx) * 0.72, by = cy + (b[1] - cy) * 0.72; // the count badge near the top-right corner
  s.setProperty('--bx', `${bx.toFixed(1)}px`); s.setProperty('--by', `${by.toFixed(1)}px`);
  el.classList.add('poly'); el._poly = { pts: loc, w };
}

export function layoutTouch(ui) {
  for (const sp of SPEC) {
    const el = ui.querySelector(`[data-id="${sp.id}"]`); if (!el) continue;
    let p = sector(sp.c, sp.r, sp.a);
    if (sp.clip) { p = clipTo(p, 0, -sp.clip); p = clipTo(p, 1, -sp.clip); }
    place(el, p, sp.at, sp.is);
  }
  TOP.forEach((id, i) => { const el = ui.querySelector(`[data-id="${id}"]`); if (!el) return; const h = HEX * Math.sqrt(3) / 2;
    place(el, hex(-(8 + HEX) - i * HEX * 1.5 - i * 2, 6 + h + (i % 2) * (h + 1), HEX - 1.5), 'tr', 16); });
}

// which polygon button (shown) a screen point is in, or null
export function polyHit(ui, x, y) {
  for (const el of ui.querySelectorAll('.tbtn.poly:not(.hidden)')) {
    const r = el.getBoundingClientRect(); if (!r.width || x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
    const k = r.width / el._poly.w, px = (x - r.left) / k, py = (y - r.top) / k, p = el._poly.pts; let inside = false;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > py) !== (p[j][1] > py) && px < (p[j][0] - p[i][0]) * (py - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) inside = !inside;
    if (inside) return el;
  }
  return null;
}
