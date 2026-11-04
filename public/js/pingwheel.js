// The ping wheel and its markers (he asked; our own art, in the spirit of League of Legends' pings: big clear round badges that
// pop in with a ripple). Everything is drawn in code at screen scale; r is the badge's radius in device pixels.
export const WHEEL_R = 96, WHEEL_DEAD = 20; // (css px) how big the wheel is, how far you must drag before a slice is chosen
// Clockwise from the top. w: the marker's words.
export const PINGS = [
  { id: 'go', w: 'GO HERE', col: '79,179,255' },
  { id: 'omw', w: 'ON MY WAY', col: '111,227,160' },
  { id: 'watch', w: 'WATCH HERE', col: '255,210,74' },
  { id: 'hold', w: 'HOLD HERE', col: '183,156,255' },
  { id: 'danger', w: 'DANGER', col: '255,156,42' },
  { id: 'help', w: 'NEED HELP', col: '95,240,208' },
  { id: 'enemy', w: 'ENEMY HERE', col: '255,70,70' },
  { id: 'open', w: 'OPEN THIS', col: '255,122,61' },
];
export const pingOf = id => PINGS.find(p => p.id === id) || { id: 'auto', w: 'PING', col: '255,210,74' };
// which slice a drag of (dx, dy) chooses, or null while still in the middle
export function wheelPick(dx, dy, scale) {
  if (Math.hypot(dx, dy) < WHEEL_DEAD * scale) return null;
  return PINGS[(Math.round((Math.atan2(dy, dx) + Math.PI / 2) / (Math.PI / 4)) + 8) % 8];
}
// the picture inside a badge, drawn in a -1..1 box
const ICONS = {
  go(c) { for (const y of [0.05, -0.45]) { c.beginPath(); c.moveTo(-0.55, y + 0.4); c.lineTo(0, y - 0.15); c.lineTo(0.55, y + 0.4); c.stroke(); } },
  omw(c) { c.beginPath(); c.moveTo(-0.65, 0); c.lineTo(0.5, 0); c.moveTo(0.1, -0.45); c.lineTo(0.6, 0); c.lineTo(0.1, 0.45); c.stroke(); c.beginPath(); c.moveTo(-0.65, -0.4); c.lineTo(-0.25, -0.4); c.moveTo(-0.65, 0.4); c.lineTo(-0.25, 0.4); c.stroke(); },
  watch(c) { c.beginPath(); c.moveTo(-0.72, 0); c.quadraticCurveTo(0, -0.72, 0.72, 0); c.quadraticCurveTo(0, 0.72, -0.72, 0); c.stroke(); c.beginPath(); c.arc(0, 0, 0.22, 0, 7); c.fill(); },
  hold(c) { c.beginPath(); c.moveTo(0, -0.7); c.lineTo(0.55, -0.45); c.lineTo(0.55, 0.05); c.quadraticCurveTo(0.5, 0.5, 0, 0.72); c.quadraticCurveTo(-0.5, 0.5, -0.55, 0.05); c.lineTo(-0.55, -0.45); c.closePath(); c.stroke(); },
  danger(c) { c.beginPath(); c.moveTo(0, -0.7); c.lineTo(0.68, 0.55); c.lineTo(-0.68, 0.55); c.closePath(); c.stroke(); c.beginPath(); c.moveTo(0, -0.22); c.lineTo(0, 0.14); c.stroke(); c.beginPath(); c.arc(0, 0.34, 0.06, 0, 7); c.fill(); },
  help(c) { c.beginPath(); c.moveTo(0, -0.58); c.lineTo(0, 0.58); c.moveTo(-0.58, 0); c.lineTo(0.58, 0); c.stroke(); },
  enemy(c) { c.beginPath(); c.arc(0, 0, 0.46, 0, 7); c.stroke(); c.beginPath(); for (const [x, y] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) { c.moveTo(x * 0.25, y * 0.25); c.lineTo(x * 0.76, y * 0.76); } c.stroke(); },
  open(c) { c.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + 0.39, r0 = i % 2 ? 0.3 : 0.22, r1 = i % 2 ? 0.74 : 0.56; c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); c.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); } c.stroke(); },
  auto(c) { c.beginPath(); c.moveTo(0, -0.62); c.lineTo(0.62, 0); c.lineTo(0, 0.62); c.lineTo(-0.62, 0); c.closePath(); c.stroke(); c.beginPath(); c.arc(0, 0, 0.13, 0, 7); c.fill(); },
};
export function drawBadge(c, id, x, y, r, alpha = 1, lit = true) {
  const P = pingOf(id), col = P.col;
  c.save(); c.translate(x, y); c.globalAlpha *= alpha;
  c.fillStyle = 'rgba(6,9,14,0.86)'; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill();
  c.strokeStyle = `rgb(${col})`; c.lineWidth = Math.max(1.5, r * 0.13); c.beginPath(); c.arc(0, 0, r, 0, 7); c.stroke();
  if (lit) { c.fillStyle = `rgba(${col},0.24)`; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill(); }
  c.scale(r * 0.72, r * 0.72); c.strokeStyle = c.fillStyle = lit ? '#fff' : `rgb(${col})`; c.lineWidth = 0.17; c.lineCap = 'round'; c.lineJoin = 'round';
  ICONS[P.id](c);
  c.restore();
}
// The wheel while the key is held: thin and see-through, so the fight behind it stays visible. (sx, sy): where the ping will land.
export function drawWheel(c, W, D) {
  const R = WHEEL_R * D, pick = wheelPick(W.dx, W.dy, D), age = Math.min(1, (performance.now() - W.t0) / 90), k = 0.82 + 0.18 * age;
  c.save(); c.translate(W.sx, W.sy); c.scale(k, k); c.globalAlpha = age;
  c.strokeStyle = 'rgba(255,255,255,0.2)'; c.lineWidth = 34 * D; c.beginPath(); c.arc(0, 0, R * 0.68, 0, 7); c.strokeStyle = 'rgba(6,9,14,0.42)'; c.stroke();
  PINGS.forEach((P, i) => {
    const a = -Math.PI / 2 + i * Math.PI / 4, on = pick === P;
    if (on) { c.fillStyle = `rgba(${P.col},0.3)`; c.beginPath(); c.arc(0, 0, R * 1.02, a - Math.PI / 8, a + Math.PI / 8); c.arc(0, 0, R * 0.34, a + Math.PI / 8, a - Math.PI / 8, true); c.closePath(); c.fill(); }
    drawBadge(c, P.id, Math.cos(a) * R * 0.68, Math.sin(a) * R * 0.68, (on ? 19 : 13.5) * D, on ? 1 : 0.78, on);
  });
  const m = Math.min(1, R / (Math.hypot(W.dx, W.dy) || 1)), col = pick ? pick.col : '255,255,255';
  c.strokeStyle = `rgba(${col},0.75)`; c.lineWidth = 2 * D; c.beginPath(); c.moveTo(0, 0); c.lineTo(W.dx * m, W.dy * m); c.stroke();
  c.fillStyle = `rgb(${col})`; c.beginPath(); c.arc(0, 0, 3.5 * D, 0, 7); c.fill();
  const text = pick ? pick.w : 'DRAG TO CHOOSE';
  c.font = `800 ${(pick ? 18 : 13) * D}px Barlow Condensed, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 4 * D; c.strokeStyle = 'rgba(0,0,0,0.85)';
  const ty = -R * 1.18; c.strokeText(text, 0, ty); c.fillStyle = pick ? `rgb(${col})` : 'rgba(255,255,255,0.8)'; c.fillText(text, 0, ty);
  c.restore();
}
// A ping in the world at screen (x, y): drops in with a bounce, ripples, then fades. age in s.
export function drawPing(c, k, x, y, age, D, under) {
  const P = pingOf(k.pk), r = 15 * D, al = age > 5 ? 6 - age : 1, t = Math.min(1, age / 0.32), drop = (1 - t) * (1 - t) * -30 * D, sq = t < 1 ? 1 + 0.35 * Math.sin(t * Math.PI) : 1;
  c.save(); c.globalAlpha = al;
  for (const d of [0, 0.3]) { const q = (age - d) / 1.1; if (q > 0 && q < 1) { c.strokeStyle = `rgba(${P.col},${0.8 * (1 - q)})`; c.lineWidth = 2.4 * D * (1 - q) + 0.5; c.beginPath(); c.arc(x, y, r + q * 34 * D, 0, 7); c.stroke(); } }
  drawBadge(c, k.pk, x, y + drop, r * sq);
  c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.lineWidth = 3.5 * D; c.strokeStyle = 'rgba(0,0,0,0.8)';
  c.font = `800 ${14 * D}px Barlow Condensed, sans-serif`; c.fillStyle = `rgb(${P.col})`; c.strokeText(k.w, x, y - r - 7 * D); c.fillText(k.w, x, y - r - 7 * D);
  c.font = `600 ${11 * D}px Barlow Condensed, sans-serif`; c.fillStyle = 'rgba(255,255,255,0.88)'; c.strokeText(under, x, y + r + 14 * D); c.fillText(under, x, y + r + 14 * D);
  c.restore();
}
