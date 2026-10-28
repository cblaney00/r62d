// Crosshair look, chosen by each player in Settings (saved in their profile, like key bindings).
export const XH_DEFAULT = { style: 'cross', color: '#ffffff', len: 7, thick: 1.5, gap: 4, alpha: 90, outline: true, dynamic: true };
export const XH_STYLES = [['cross', 'Cross'], ['crossdot', 'Cross + dot'], ['dot', 'Dot'], ['t', 'T-shape'], ['circle', 'Circle'], ['circledot', 'Circle + dot']];
export const XH_COLORS = ['#ffffff', '#00ff66', '#00e5ff', '#ffee00', '#ff3df5', '#ff3b3b', '#000000'];

export function cleanXhair(o) {
  const x = { ...XH_DEFAULT, ...(o || {}) };
  if (!XH_STYLES.some(s => s[0] === x.style)) x.style = XH_DEFAULT.style;
  if (!/^#[0-9a-f]{6}$/i.test(x.color)) x.color = XH_DEFAULT.color;
  const num = (v, lo, hi, d) => (typeof v === 'number' && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
  x.len = num(x.len, 1, 20, 7); x.thick = num(x.thick, 0.5, 5, 1.5); x.gap = num(x.gap, 0, 20, 4); x.alpha = num(x.alpha, 20, 100, 90);
  x.outline = !!x.outline; x.dynamic = !!x.dynamic;
  return x;
}

// Draw at (x, y). 'spread' is the extra gap from weapon spread / running (screen pixels before scale).
export function drawXhair(ctx, x, y, o, spread, k) {
  const gap = (o.gap + spread) * k, len = o.len * k, th = o.thick * k;
  const lines = o.style === 'dot' ? [] : o.style === 't' ? [[1, 0], [-1, 0], [0, 1]] : o.style.startsWith('cross') ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : [];
  const circle = o.style.startsWith('circle'), dot = o.style === 'dot' || o.style.endsWith('dot');
  const paint = (col, extra) => {
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = th + extra; ctx.lineCap = 'butt';
    if (lines.length) {
      ctx.beginPath();
      for (const [dx, dy] of lines) { ctx.moveTo(x + dx * (gap - extra / 2), y + dy * (gap - extra / 2)); ctx.lineTo(x + dx * (gap + len + extra / 2), y + dy * (gap + len + extra / 2)); }
      ctx.stroke();
    }
    if (circle) { ctx.beginPath(); ctx.arc(x, y, Math.max(2 * k, gap + len / 2), 0, Math.PI * 2); ctx.stroke(); }
    if (dot) { const r = Math.max(th, 1.2 * k) + extra / 2; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
  };
  ctx.globalAlpha = o.alpha / 100;
  if (o.outline) paint('rgba(0,0,0,0.85)', 1.6 * k);
  paint(o.color, 0);
  ctx.globalAlpha = 1;
}
