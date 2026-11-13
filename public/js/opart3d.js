// Operators drawn standing up, for the 3D rope view (he asked 2026-11-13: seen from the front and back now, so they need
// art for that: rappelling, and being seen through a window). Drawn in code like everything else: each operator's own
// uniform, vest, pattern, side colour and helmet colour (taken from their top-down picture), skin and gun.
// opSprite(op, view, pose, gun) -> a canvas (W x H), cached. view: 'front' | 'back' | 'left' | 'right';
// pose: 'stand' | 'crouch' | 'down' | 'hang' | 'hangInv'. Feet at the bottom middle; the 3D view scales it to 1.85 m.
import { OPERATORS, LOADOUTS, RIOT } from '/shared/operators.js';
import { drawOperator, uniformOf, accentsOf, SIDE_COL } from './sprites.js';
import { drawGunArt } from './gunart.js';

export const W = 96, H = 160;
const SKIN = ['#c99a78', '#a8785a', '#7a5238', '#e0b393', '#8d6346']; // (the same list and pick as sprites.js)
const cache = new Map(), helmCache = new Map();
const skinOf = op => SKIN[(op.charCodeAt(0) + op.length) % SKIN.length];
function shade(hex, k) { const n = parseInt(hex.slice(1), 16), c = v => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`; }
// the helmet's colour: the middle of the head in the operator's own top-down picture
function helmOf(op) {
  if (helmCache.has(op)) return helmCache.get(op);
  let col = '#3a3d42';
  try {
    const c = document.createElement('canvas'); c.width = c.height = 48; const x = c.getContext('2d', { willReadFrequently: true });
    x.translate(24, 24); x.scale(1.5, 1.5); drawOperator(x, { x: 0, y: 0, aim: 0, op, ring: false }, 0);
    const d = x.getImageData(24 + 11, 23, 3, 3).data; let r = 0, g = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
    col = `rgb(${Math.round(r / 9)},${Math.round(g / 9)},${Math.round(b / 9)})`;
  } catch (e) { /* (no canvas: keep the default) */ }
  helmCache.set(op, col); return col;
}
const gunFor = op => { const L = LOADOUTS[op]; const g = L && L.primaries.find(w => !RIOT[w]); return g || 'k4'; };

export function opSprite(op, view = 'front', pose = 'stand', gun = null) {
  const key = op + '|' + view + '|' + pose + '|' + (gun || '');
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const o = OPERATORS[op] || { team: 'atk' }, u = uniformOf(op, o.team), acc = accentsOf(op), side = SIDE_COL[o.team] || SIDE_COL.atk;
  const P = { u, acc, side, skin: skinOf(op), helm: helmOf(op), gun: gun || gunFor(op) };
  if (pose === 'down') { x.translate(W / 2, H - 14); x.rotate(-Math.PI / 2); x.scale(0.62, 0.62); x.translate(-W / 2, -H + 10); figure(x, P, view === 'back' ? 'back' : 'front', 'stand'); }
  else if (pose === 'hangInv') { x.translate(W / 2, H / 2); x.rotate(Math.PI); x.translate(-W / 2, -H / 2); figure(x, P, view, 'hang'); }
  else figure(x, P, view, pose);
  cache.set(key, c); return c;
}

const rr = (x, X, Y, w, h, r) => { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); };
const fillR = (x, col, X, Y, w, h, r = 3) => { x.fillStyle = col; rr(x, X, Y, w, h, r); x.fill(); x.strokeStyle = 'rgba(0,0,0,0.45)'; x.lineWidth = 1.2; x.stroke(); };
const limb = (x, col, w, pts) => { x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = w + 2.4; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); x.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]); x.stroke(); x.strokeStyle = col; x.lineWidth = w; x.stroke(); };

function figure(x, P, view, pose) {
  const { u, acc, side, skin, helm } = P;
  const sideView = view === 'left' || view === 'right';
  if (view === 'left') { x.translate(W, 0); x.scale(-1, 1); } // (the left view is the right one mirrored)
  const crouch = pose === 'crouch', hang = pose === 'hang';
  const drop = crouch ? 26 : hang ? 6 : 0; // how much lower the body sits
  const cx = W / 2, top = 14 + drop;
  // ---- legs ----
  const boots = '#1d1e20';
  if (hang) { // from behind, knees bent toward the wall, feet apart
    limb(x, u.clothD, 11, [cx - 8, 98, cx - 14, 124, cx - 12, 146]); limb(x, u.clothD, 11, [cx + 8, 98, cx + 14, 124, cx + 12, 146]);
    fillR(x, boots, cx - 19, 142, 13, 9, 3); fillR(x, boots, cx + 6, 142, 13, 9, 3);
  } else if (crouch) {
    if (sideView) { limb(x, u.clothD, 12, [cx - 2, 112, cx + 16, 124, cx + 4, 148]); limb(x, u.clothD, 12, [cx - 6, 112, cx - 16, 136, cx - 22, 150]); fillR(x, boots, cx - 4, 145, 18, 9, 3); fillR(x, boots, cx - 30, 146, 14, 8, 3); }
    else { limb(x, u.clothD, 12, [cx - 9, 110, cx - 16, 128, cx - 10, 148]); limb(x, u.clothD, 12, [cx + 9, 110, cx + 16, 128, cx + 10, 148]); fillR(x, boots, cx - 18, 145, 14, 9, 3); fillR(x, boots, cx + 4, 145, 14, 9, 3); }
  } else if (sideView) {
    limb(x, u.clothD, 12, [cx - 2, 92, cx + 2, 122, cx, 148]); limb(x, shade(u.cloth, 0.6), 12, [cx - 4, 92, cx - 8, 122, cx - 6, 148]);
    fillR(x, boots, cx - 6, 146, 18, 10, 3); fillR(x, boots, cx - 14, 146, 14, 10, 3);
  } else {
    limb(x, u.clothD, 12, [cx - 8, 92, cx - 9, 122, cx - 9, 148]); limb(x, u.clothD, 12, [cx + 8, 92, cx + 9, 122, cx + 9, 148]);
    fillR(x, boots, cx - 17, 146, 15, 10, 3); fillR(x, boots, cx + 2, 146, 15, 10, 3);
  }
  // ---- torso ----
  const tw = sideView ? 24 : 38, ty = top + 26;
  fillR(x, u.cloth, cx - tw / 2, ty, tw, 62, 8);
  // vest (front and back), the operator's pattern dots, the side colour as a stripe if it is one of their accents
  fillR(x, view === 'back' ? u.dark : u.vest, cx - tw / 2 + 3, ty + 4, tw - 6, 48, 5);
  if (u.pc) { x.fillStyle = u.pc; for (let i = 0; i < 7; i++) { const px = cx - tw / 2 + 6 + ((i * 37) % (tw - 12)), py = ty + 8 + ((i * 23) % 38); x.globalAlpha = 0.55; x.fillRect(px, py, 4, 3); } x.globalAlpha = 1; }
  if (acc.has('vest')) { x.fillStyle = side; x.fillRect(cx - tw / 2 + 3, ty + 30, tw - 6, 4); }
  if (view === 'back') { fillR(x, shade(u.vest, 0.5), cx - 13, ty + 8, 26, 34, 5); if (acc.has('pack')) { x.fillStyle = side; x.fillRect(cx - 9, ty + 14, 18, 5); } } // the pack
  fillR(x, '#2a2420', cx - tw / 2 + 2, ty + 54, tw - 4, 6, 2); // belt / harness
  if (hang) { x.strokeStyle = '#c8b27a'; x.lineWidth = 2.2; x.beginPath(); x.moveTo(cx, 0); x.lineTo(cx, ty + 57); x.stroke(); } // the rope to the harness
  // ---- arms ----
  const sleeve = u.cloth, glove = acc.has('gloves') ? side : '#222326', band = side;
  if (hang) { // both hands up on the rope
    limb(x, sleeve, 9, [cx - 15, ty + 6, cx - 14, ty - 14, cx - 4, ty - 30]); limb(x, sleeve, 9, [cx + 15, ty + 6, cx + 14, ty - 14, cx + 4, ty - 36]);
    x.fillStyle = glove; x.beginPath(); x.arc(cx - 3, ty - 31, 4.5, 0, 7); x.arc(cx + 3, ty - 37, 4.5, 0, 7); x.fill();
    x.fillStyle = band; x.fillRect(cx - 19, ty + 2, 8, 4); x.fillRect(cx + 11, ty + 2, 8, 4);
  } else if (sideView) { // gun forward
    drawGunArt(x, P.gun, {}, cx - 4, ty + 10, 52, 22);
    limb(x, sleeve, 9, [cx - 2, ty + 6, cx + 6, ty + 26, cx + 18, ty + 24]); x.fillStyle = glove; x.beginPath(); x.arc(cx + 19, ty + 24, 4.2, 0, 7); x.fill();
    x.fillStyle = band; x.fillRect(cx - 6, ty + 8, 8, 4);
  } else { // gun across the body (front) or held ahead (back: elbows out)
    if (view === 'front') { x.save(); x.translate(cx, ty + 30); x.rotate(-0.35); x.fillStyle = '#1f2124'; rr(x, -30, -5, 60, 10, 3); x.fill(); x.fillStyle = '#2d3035'; x.fillRect(-6, 4, 8, 12); x.restore(); }
    limb(x, sleeve, 9, [cx - tw / 2 - 1, ty + 6, cx - tw / 2 - 4, ty + 28, cx - 8, ty + 38]);
    limb(x, sleeve, 9, [cx + tw / 2 + 1, ty + 6, cx + tw / 2 + 4, ty + 24, cx + 10, ty + 26]);
    x.fillStyle = glove; x.beginPath(); x.arc(cx - 8, ty + 38, 4.5, 0, 7); x.arc(cx + 10, ty + 26, 4.5, 0, 7); x.fill();
    x.fillStyle = band; x.fillRect(cx - tw / 2 - 6, ty + 8, 8, 4); x.fillRect(cx + tw / 2 - 2, ty + 8, 8, 4);
  }
  // ---- head ----
  const hy = top + 12;
  x.fillStyle = skin; x.beginPath(); x.ellipse(cx + (sideView ? 3 : 0), hy, sideView ? 10 : 11, 12, 0, 0, 7); x.fill(); x.strokeStyle = 'rgba(0,0,0,0.45)'; x.lineWidth = 1.2; x.stroke();
  if (view === 'front') { x.fillStyle = '#1a1512'; x.fillRect(cx - 6, hy + 1, 3, 3); x.fillRect(cx + 3, hy + 1, 3, 3); x.fillStyle = shade(skin.startsWith('#') ? skin : '#c99a78', 0.8); x.fillRect(cx - 4, hy + 7, 8, 2); }
  else if (sideView) { x.fillStyle = '#1a1512'; x.fillRect(cx + 8, hy + 1, 3, 3); }
  // helmet / headgear in its own colour, the side band if they have one
  x.fillStyle = helm; x.beginPath();
  if (view === 'back') x.ellipse(cx, hy - 2, 12.5, 12, 0, 0, 7); else x.ellipse(cx + (sideView ? 1 : 0), hy - 4, 12.5, 9.5, 0, Math.PI, 0);
  x.fill(); x.strokeStyle = 'rgba(0,0,0,0.5)'; x.stroke();
  if (view !== 'back') { x.fillStyle = shade('#3a3d42', 0.8); x.fillRect(cx - 12 + (sideView ? 6 : 0), hy - 5, sideView ? 18 : 24, 2.5); }
  if (acc.has('band')) { x.fillStyle = side; x.fillRect(cx - 11, hy - 9, 22, 3); }
  // a soft light from above
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(255,255,255,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0.12)');
  x.globalCompositeOperation = 'source-atop'; x.fillStyle = g; x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'source-over';
}
