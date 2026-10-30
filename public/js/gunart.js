// Side-view pictures of every gun, drawn in code, with their attachments fitted.
// drawGunArt(ctx, weaponKey, attachments, x, y, w, h) fits the picture into the box.
import { WEAPONS } from '/shared/operators.js';

// Each gun in a 100 x 40 drawing space: body colour, then the parts' sizes and styles.
const G = {
  k4:      { body: '#2c3036', furn: '#3b3f45', stock: 'adjust', rec: [26, 52], bar: 92, guard: [52, 76], mag: 'curved', grip: 34, rail: true },
  v9:      { body: '#30343a', furn: '#25282c', stock: 'fold', rec: [24, 56], bar: 80, guard: [56, 70], mag: 'straight', grip: 36, rail: true },
  breaker: { body: '#2b2d31', furn: '#6b4a2e', stock: 'wood', rec: [24, 44], bar: 96, guard: [52, 70], mag: 'tube', grip: 30, rail: true, pump: true },
  mule:    { body: '#363a33', furn: '#2a2d28', stock: 'heavy', rec: [22, 56], bar: 98, guard: [56, 80], mag: 'box', grip: 34, rail: true, bipod: true, handle: true },
  longbow: { body: '#3a3c34', furn: '#4c4a3a', stock: 'cheek', rec: [26, 50], bar: 99, guard: [50, 78], mag: 'short', grip: 34, rail: true },
  hornet:  { body: '#2e3238', furn: '#25282c', stock: 'none', rec: [34, 62], bar: 76, guard: [62, 70], mag: 'grip', grip: 42, rail: true },
  vex50:   { body: '#585d63', furn: '#2a2c30', stock: 'none', rec: [38, 74], bar: 78, guard: [74, 74], mag: 'grip', grip: 44, pistol: true, big: true },
  p10:     { body: '#2f3237', furn: '#232528', stock: 'none', rec: [42, 70], bar: 73, guard: [70, 70], mag: 'grip', grip: 46, pistol: true },
  rook:    { body: '#3a3a33', furn: '#5a4a36', stock: 'heavy', rec: [24, 54], bar: 98, guard: [54, 80], mag: 'short', grip: 34, rail: true },
  sabre:   { body: '#34383e', furn: '#2a2d31', stock: 'bullpup', rec: [8, 60], bar: 86, guard: [60, 74], mag: 'bullpup', grip: 48, rail: true },
  trident: { body: '#2d3237', furn: '#454a40', stock: 'adjust', rec: [26, 54], bar: 94, guard: [54, 80], mag: 'curved', grip: 34, rail: true },
  wasp:    { body: '#2c2f35', furn: '#1f2226', stock: 'fold', rec: [26, 54], bar: 74, guard: [54, 64], mag: 'long', grip: 36, rail: true },
  marten:  { body: '#383b40', furn: '#2a2c30', stock: 'fold', rec: [24, 52], bar: 70, guard: [52, 52], mag: 'straight', grip: 34, rail: true, can: true },
  lark:    { body: '#6b6450', furn: '#3a3830', stock: 'adjust', rec: [22, 58], bar: 82, guard: [58, 72], mag: 'long', grip: 40, rail: true },
  tusk:    { body: '#2b2d31', furn: '#33363a', stock: 'heavy', rec: [24, 48], bar: 96, guard: [50, 72], mag: 'box', grip: 32, rail: true },
  anvil:   { body: '#45413b', furn: '#3d4a3a', stock: 'wood', rec: [24, 46], bar: 98, guard: [52, 72], mag: 'tube', grip: 30, rail: true, pump: true },
  stub:    { body: '#3a3a3c', furn: '#6b4a2e', stock: 'none', rec: [30, 52], bar: 78, guard: [52, 66], mag: 'none', grip: 32, double: true },
  ox:      { body: '#3a3d36', furn: '#2c2f2a', stock: 'heavy', rec: [20, 58], bar: 100, guard: [58, 84], mag: 'belt', grip: 32, rail: true, bipod: true, handle: true },
  drummer: { body: '#33373a', furn: '#2a2d30', stock: 'adjust', rec: [24, 56], bar: 94, guard: [56, 78], mag: 'drum', grip: 34, rail: true, bipod: true },
  pike:    { body: '#2e3230', furn: '#5a4630', stock: 'cheek', rec: [28, 52], bar: 102, guard: [52, 82], mag: 'short', grip: 34, rail: true, bolt: true },
  heron:   { body: '#41443c', furn: '#55533f', stock: 'cheek', rec: [26, 52], bar: 96, guard: [52, 78], mag: 'straight', grip: 34, rail: true },
  gnat:    { body: '#2a2d31', furn: '#1f2124', stock: 'none', rec: [38, 72], bar: 76, guard: [72, 72], mag: 'gripLong', grip: 44, pistol: true },
  bison:   { body: '#6a6e73', furn: '#5a3d26', stock: 'none', rec: [36, 62], bar: 84, guard: [62, 62], mag: 'none', grip: 42, pistol: true, revolver: true },
};

function shadeCol(hex, k) {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = v => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
// a filled shape with a top-lit gradient and a thin dark outline
function part(c, pts, col, lit = 1.35) {
  let y0 = Infinity, y1 = -Infinity; for (let i = 1; i < pts.length; i += 2) { y0 = Math.min(y0, pts[i]); y1 = Math.max(y1, pts[i]); }
  const g = c.createLinearGradient(0, y0, 0, y1 + 0.01); g.addColorStop(0, shadeCol(col, lit)); g.addColorStop(0.45, col); g.addColorStop(1, shadeCol(col, 0.65));
  c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath();
  c.fillStyle = g; c.fill(); c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = 0.45; c.stroke();
}
const box = (c, x, y, w, h, col, lit) => part(c, [x, y, x + w, y, x + w, y + h, x, y + h], col, lit);

export function drawGunArt(ctx, key, att = {}, X = 0, Y = 0, W = 100, H = 40) {
  const g = G[key] || G.k4, a = { barrel: 'none', grip: 'none', sight: 'iron', ...att };
  const s = Math.min(W / 108, H / 44);
  ctx.save();
  ctx.translate(X + (W - 108 * s) / 2 + 4 * s, Y + (H - 44 * s) / 2 + 2 * s); ctx.scale(s, s);
  const [r0, r1] = g.rec, top = g.pistol ? 15 : 14, bot = g.pistol ? 22 : 23, mid = (top + bot) / 2;
  let muzzle = g.bar + (a.barrel === 'extended' ? 6 : 0);
  // --- stock ---
  if (g.stock === 'adjust') { part(ctx, [r0, 16, 8, 17, 4, 15, 2, 17, 2, 27, 7, 28, 12, 22, r0, 21], g.furn); box(ctx, 6, 19, r0 - 6, 1.6, '#1d1f22'); }
  if (g.stock === 'fold') { box(ctx, 6, 16.5, r0 - 6, 1.6, '#1d1f22'); box(ctx, 6, 22, r0 - 6, 1.6, '#1d1f22'); box(ctx, 4, 15.5, 3, 9.5, g.furn); }
  if (g.stock === 'wood') part(ctx, [r0, 15, 10, 17, 2, 19, 2, 27, 9, 27, r0, 22], g.furn, 1.5);
  if (g.stock === 'heavy') part(ctx, [r0, 14, 4, 15, 2, 17, 2, 28, 6, 29, 12, 24, r0, 23], g.furn);
  if (g.stock === 'bullpup') { part(ctx, [r0, 15, 4, 15, 2, 17, 2, 25, r0, 25], g.furn); box(ctx, 2, 16, 2, 9, '#15171a'); }
  if (g.stock === 'cheek') { part(ctx, [r0, 16, 10, 17, 3, 17, 2, 28, 8, 29, 14, 24, r0, 22], g.furn); box(ctx, 9, 13.5, 12, 3, shadeCol(g.furn, 1.15)); }
  // --- barrel and handguard ---
  box(ctx, r1 - 2, mid - 1.4, muzzle - r1 + 2, 2.8, '#1e2023', 1.6);
  if (g.double) box(ctx, r1 - 2, mid - 4.4, muzzle - r1 + 2, 2.8, '#24262a', 1.6); // second barrel on top
  if (g.can) { box(ctx, r1, mid - 3.2, muzzle - r1 + 12, 6.4, '#1a1c1f', 1.7); for (let i = r1 + 3; i < muzzle + 10; i += 3) box(ctx, i, mid - 3.2, 0.6, 6.4, '#2a2d31'); muzzle += 12; } // built-in suppressor
  if (g.pump) { box(ctx, r1, bot - 1, g.guard[1] - r1 + 8, 3, '#202225'); box(ctx, g.guard[0], bot - 1.8, g.guard[1] - g.guard[0], 5, g.furn, 1.5); for (let i = 0; i < 5; i++) box(ctx, g.guard[0] + 2 + i * 3.5, bot - 1.4, 0.7, 4.2, shadeCol(g.furn, 0.6)); }
  else if (g.guard[1] > g.guard[0]) { part(ctx, [g.guard[0], top + 0.5, g.guard[1], top + 1.5, g.guard[1], bot - 0.5, g.guard[0], bot], g.furn); for (let i = g.guard[0] + 3; i < g.guard[1] - 2; i += 4) box(ctx, i, mid - 0.6, 2.2, 1.2, shadeCol(g.furn, 0.55)); }
  // --- receiver / slide ---
  if (g.pistol) { part(ctx, [r0, top, r1, top, r1, bot - (g.big ? 0 : 1), r0, bot], g.body, 1.6); for (let i = r0 + 3; i < r0 + 10; i += 1.6) box(ctx, i, top + 1, 0.6, 4, shadeCol(g.body, 0.6)); box(ctx, r0 + 2, bot, r1 - r0 - 8, 2.4, g.furn); }
  else { part(ctx, [r0, top, r1, top, r1, bot, r0 + 4, bot + 1, r0, bot], g.body); box(ctx, r0 + 6, mid - 1.5, 7, 2, shadeCol(g.body, 0.6)); box(ctx, r0 + 16, top + 2, 2.5, 1.2, '#8a8f95'); }
  if (g.revolver) { box(ctx, r0 + 5, top - 0.8, 13, bot - top + 2.6, shadeCol(g.body, 0.9), 1.5); for (let i = 0; i < 3; i++) box(ctx, r0 + 7 + i * 3.6, top + 0.8, 1.6, bot - top - 0.6, shadeCol(g.body, 0.6)); }
  if (g.bolt) { ctx.strokeStyle = '#1b1d20'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(r0 + 14, mid); ctx.lineTo(r0 + 17, bot + 4); ctx.stroke(); ctx.fillStyle = '#2c2f33'; ctx.beginPath(); ctx.arc(r0 + 17, bot + 4.5, 1.8, 0, Math.PI * 2); ctx.fill(); }
  if (g.handle) { part(ctx, [r0 + 8, top, r0 + 10, top - 6, r0 + 24, top - 6, r0 + 26, top], g.body); box(ctx, r0 + 11, top - 4.2, 13, 3, '#0e0f11'); }
  // --- pistol grip and trigger ---
  const gx = g.grip;
  part(ctx, [gx, bot - 0.5, gx + 6, bot - 0.5, gx + 4 + (g.pistol ? 2 : 0), bot + 13, gx - 2 + (g.pistol ? 1 : 0), bot + 13], g.furn, 1.2);
  ctx.strokeStyle = '#15171a'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(gx + 9, bot + 2.5, 2.6, 0, Math.PI); ctx.stroke();
  // --- magazine ---
  const mx = g.pistol ? gx - 1 : g.mag === 'bullpup' ? r0 + 14 : gx + 9;
  const ribs = (x0, y0, n, dx) => { for (let i = 0; i < n; i++) box(ctx, x0 + i * dx * 0.25, y0 + i * 2.6, 6, 0.6, 'rgba(0,0,0,0.35)'); };
  if (g.mag === 'curved') { part(ctx, [mx, bot, mx + 8, bot, mx + 15, bot + 12, mx + 14, bot + 14, mx + 7, bot + 15], '#4a5058', 1.5); ribs(mx + 2, bot + 3, 4, 4); }
  if (g.mag === 'bullpup') { part(ctx, [mx, bot, mx + 8, bot, mx + 14, bot + 11, mx + 13, bot + 13, mx + 6, bot + 14], '#4a5058', 1.5); ribs(mx + 2, bot + 3, 4, 4); }
  if (g.mag === 'long') { part(ctx, [mx, bot, mx + 6, bot, mx + 8, bot + 20, mx + 2, bot + 20], '#4a5058', 1.5); ribs(mx + 0.5, bot + 3, 7, 0.6); }
  if (g.mag === 'drum') { ctx.fillStyle = '#41464d'; ctx.beginPath(); ctx.arc(mx + 5, bot + 8, 7.5, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.6; ctx.stroke(); ctx.beginPath(); ctx.arc(mx + 5, bot + 8, 3, 0, Math.PI * 2); ctx.stroke(); }
  if (g.mag === 'belt') { box(ctx, mx - 2, bot, 16, 13, '#4a4f3a'); box(ctx, mx, bot + 2, 12, 1, 'rgba(0,0,0,0.3)'); ctx.fillStyle = '#b08a3e'; for (let i = 0; i < 4; i++) ctx.fillRect(mx - 3 - i * 2.2, bot - 1 + i * 0.6, 1.4, 3.4); }
  if (g.mag === 'gripLong') box(ctx, gx - 1, bot + 13, 6, 8, '#26292d');
  if (g.mag === 'straight') { part(ctx, [mx, bot, mx + 6, bot, mx + 7, bot + 16, mx + 1, bot + 16], '#4a5058', 1.5); ribs(mx + 0.5, bot + 3, 5, 0.6); }
  if (g.mag === 'short') { part(ctx, [mx, bot, mx + 8, bot, mx + 8.5, bot + 7, mx + 0.5, bot + 7], '#4a5058', 1.5); ribs(mx + 1, bot + 2.5, 2, 0); }
  if (g.mag === 'box') { box(ctx, mx - 1, bot, 13, 11, '#4a4f3a'); box(ctx, mx + 1, bot + 2, 9, 1, 'rgba(0,0,0,0.3)'); }
  if (g.mag === 'tube') box(ctx, r1, bot - 0.2, g.bar - r1 - 4, 2.6, '#26282b', 1.6);
  if (g.mag === 'grip' && !g.pistol) box(ctx, gx, bot + 12, 5, 6, '#26292d');
  if (g.bipod) { ctx.strokeStyle = '#1d1f22'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(g.guard[1] - 3, bot); ctx.lineTo(g.guard[1] - 8, bot + 11); ctx.moveTo(g.guard[1] - 3, bot); ctx.lineTo(g.guard[1] + 2, bot + 11); ctx.stroke(); }
  // --- top rail ---
  if (g.rail) { box(ctx, r0 + 2, top - 1.6, (g.guard[1] || r1) - r0 - 2, 1.6, '#1b1d20'); for (let i = r0 + 3; i < (g.guard[1] || r1) - 1; i += 2) box(ctx, i, top - 1.6, 0.6, 1.6, '#3a3d42'); }
  // ================= attachments =================
  // barrel
  if (a.barrel === 'suppressor') { box(ctx, muzzle - 1, mid - 3, 16, 6, '#1a1c1f', 1.7); box(ctx, muzzle + 1, mid - 3, 1, 6, '#2c2f33'); muzzle += 15; }
  else if (a.barrel === 'compensator') { box(ctx, muzzle - 1, mid - 2.4, 7, 4.8, '#24272b', 1.6); for (let i = 0; i < 3; i++) box(ctx, muzzle + 0.8 + i * 1.8, mid - 2.4, 0.8, 2, '#0c0d0e'); muzzle += 6; }
  else if (a.barrel === 'brake') { box(ctx, muzzle - 1, mid - 2.8, 6, 5.6, '#2d3035', 1.6); box(ctx, muzzle + 1, mid - 2.8, 1.2, 5.6, '#0c0d0e'); box(ctx, muzzle + 3, mid - 2.8, 1.2, 5.6, '#0c0d0e'); muzzle += 5; }
  else box(ctx, muzzle - 1, mid - 1.8, 3, 3.6, '#16181a', 1.6);
  if (!g.pistol) box(ctx, (g.guard[1] || r1) - 3, top - 4, 1.6, 4, '#1b1d20'); // front sight post
  // grip
  if (a.grip === 'vertical' && !g.pistol) part(ctx, [g.guard[0] + 8, bot, g.guard[0] + 13, bot, g.guard[0] + 12.5, bot + 11, g.guard[0] + 8.5, bot + 11], '#1f2124');
  if (a.grip === 'angled' && !g.pistol) part(ctx, [g.guard[0] + 4, bot, g.guard[0] + 15, bot, g.guard[0] + 8, bot + 6], '#1f2124');
  if (a.grip === 'laser') {
    const lx = g.pistol ? r0 + 5 : g.guard[0] + 4, ly = g.pistol ? bot + 2.4 : bot - 1;
    box(ctx, lx, ly, 8, 3.2, '#1b1d20'); ctx.fillStyle = '#ff3030'; ctx.fillRect(lx + 8, ly + 1.1, 1, 1);
    ctx.strokeStyle = 'rgba(255,40,40,0.55)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(lx + 9, ly + 1.6); ctx.lineTo(108, ly + 1.6); ctx.stroke();
  }
  // sight
  const sx = g.pistol ? r0 + 12 : r0 + 8;
  if (a.sight === 'iron') { if (!g.handle) box(ctx, g.pistol ? r0 + 1 : r0 + 3, top - (g.pistol ? 2 : 4), 3, g.pistol ? 2 : 4, '#1b1d20'); }
  if (a.sight === 'reddot') { part(ctx, [sx, top - 1.6, sx + 10, top - 1.6, sx + 9, top - 6.5, sx + 2, top - 7], '#22252a'); ctx.fillStyle = 'rgba(120,200,255,0.45)'; ctx.fillRect(sx + 2.5, top - 5.8, 6, 3); ctx.fillStyle = '#ff3030'; ctx.fillRect(sx + 5, top - 4.6, 1, 1); }
  if (a.sight === 'holo') { box(ctx, sx, top - 3, 13, 1.4, '#22252a'); part(ctx, [sx + 1, top - 3, sx + 3, top - 9, sx + 12, top - 9, sx + 12.5, top - 3], '#2a2d32'); ctx.fillStyle = 'rgba(140,220,255,0.4)'; ctx.fillRect(sx + 4, top - 8, 7, 4.2); }
  if (a.sight === 'scope') { box(ctx, sx + 4, top - 4, 3, 2.5, '#1b1d20'); box(ctx, sx + 16, top - 4, 3, 2.5, '#1b1d20'); box(ctx, sx - 1, top - 9, 26, 5.5, '#1e2024', 1.7); box(ctx, sx - 3, top - 10, 4, 7.5, '#25282c'); box(ctx, sx + 23, top - 10.5, 5, 8.5, '#25282c'); ctx.fillStyle = 'rgba(110,180,255,0.6)'; ctx.fillRect(sx + 27.5, top - 9.5, 0.8, 6.5); box(ctx, sx + 9, top - 11, 3, 2, '#2c2f33'); }
  ctx.restore();
}

// a picture as a ready canvas element (for menus), cached per gun + attachments
const cache = new Map();
export function gunPicture(key, att, w = 200, h = 80) {
  const id = `${key}|${att ? [att.barrel, att.grip, att.sight].join(',') : ''}|${w}x${h}`;
  let c = cache.get(id);
  if (!c) {
    c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2;
    const x = c.getContext('2d'); x.scale(2, 2); drawGunArt(x, key, att, 0, 0, w, h);
    cache.set(id, c);
  }
  const out = document.createElement('canvas'); out.width = c.width; out.height = c.height; out.className = 'gunpic';
  out.getContext('2d').drawImage(c, 0, 0);
  return out;
}
export const gunLabel = key => WEAPONS[key] ? WEAPONS[key].name : key;
