// Crosshair look, chosen by each player in Settings (saved in their profile, like key bindings).
// v2: bright green cross + dot with a crisp black border, so it reads on light floors and dark rooms alike.
// Saved crosshairs from before v2 (thin white, hard to see) are switched to the new default once.
export const XH_VERSION = 2;
export const XH_DEFAULT = { v: XH_VERSION, style: 'crossdot', color: '#00ff66', len: 7, thick: 2, gap: 4, alpha: 100, outline: true, dynamic: true };
export const XH_STYLES = [['crossdot', 'Cross + dot'], ['cross', 'Cross'], ['dot', 'Dot'], ['t', 'T-shape'], ['circle', 'Circle'], ['circledot', 'Circle + dot']];
export const XH_COLORS = ['#00ff66', '#ffffff', '#00e5ff', '#ffee00', '#ff3df5', '#ff3b3b', '#000000'];

export function cleanXhair(o) {
  const x = { ...XH_DEFAULT, ...(o && o.v === XH_VERSION ? o : {}) };
  if (!XH_STYLES.some(s => s[0] === x.style)) x.style = XH_DEFAULT.style;
  if (!/^#[0-9a-f]{6}$/i.test(x.color)) x.color = XH_DEFAULT.color;
  const num = (v, lo, hi, d) => (typeof v === 'number' && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
  x.len = num(x.len, 1, 20, 7); x.thick = num(x.thick, 0.5, 5, 2); x.gap = num(x.gap, 0, 20, 4); x.alpha = num(x.alpha, 20, 100, 100);
  x.outline = !!x.outline; x.dynamic = !!x.dynamic; x.v = XH_VERSION;
  return x;
}

// Draw at (x, y). 'spread' is the extra gap from weapon spread / running (screen pixels before scale).
// Arms and dot are filled rectangles snapped to whole pixels, so they stay sharp instead of blurring.
export function drawXhair(ctx, x, y, o, spread, k) {
  x = Math.round(x); y = Math.round(y);
  const gap = Math.round((o.gap + spread) * k), len = Math.max(1, Math.round(o.len * k)), th = Math.max(1, Math.round(o.thick * k));
  const arms = o.style === 't' ? [[1, 0], [-1, 0], [0, 1]] : o.style.startsWith('cross') ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : [];
  const circle = o.style.startsWith('circle'), dot = o.style === 'dot' || o.style.endsWith('dot');
  const h = th / 2, b = o.outline ? Math.max(1, Math.round(k)) : 0; // b = border width
  const rects = [];
  for (const [dx, dy] of arms) {
    const a = gap, z = gap + len;
    if (dx) rects.push(dx > 0 ? [x + a, y - h, len, th] : [x - z, y - h, len, th]);
    else rects.push(dy > 0 ? [x - h, y + a, th, len] : [x - h, y - z, th, len]);
  }
  if (dot) { const d = Math.max(th, Math.round(2 * k)); rects.push([x - d / 2, y - d / 2, d, d]); }
  const r = Math.max(2 * k, gap + len / 2);
  ctx.save(); ctx.globalAlpha = o.alpha / 100;
  if (b) {
    ctx.fillStyle = ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    for (const [rx, ry, w, hh] of rects) ctx.fillRect(rx - b, ry - b, w + 2 * b, hh + 2 * b);
    if (circle) { ctx.lineWidth = th + 2 * b; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); }
  }
  ctx.fillStyle = ctx.strokeStyle = o.color;
  for (const [rx, ry, w, hh] of rects) ctx.fillRect(rx, ry, w, hh);
  if (circle) { ctx.lineWidth = th; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
}
