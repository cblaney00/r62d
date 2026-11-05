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

// each sight has its own faint look while aiming in (he asked: interesting but never in the way); nothing covers the middle
export function drawSightLook(ctx, sight, x, y, k, d, lensR) { // d = device pixel ratio, lensR = sniper lens radius in px
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.save();
  if (sight === 'reddot') { // a soft red bloom round the crosshair, like the glass of the dot catching light
    const g = ctx.createRadialGradient(x, y, 4 * d, x, y, 34 * d); g.addColorStop(0, `rgba(255,60,60,${0.10 * k})`); g.addColorStop(1, 'rgba(255,60,60,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 34 * d, 0, 7); ctx.fill();
  } else if (sight === 'holo') { // the holographic ring, broken at the four points
    ctx.strokeStyle = `rgba(120,230,255,${0.38 * k})`; ctx.lineWidth = 1.3 * d;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x, y, 26 * d, i * Math.PI / 2 + 0.25, (i + 1) * Math.PI / 2 - 0.25); ctx.stroke(); }
  } else if (sight === 'prism') { // an amber chevron under the crosshair and a faint etched ring
    ctx.strokeStyle = `rgba(255,170,60,${0.6 * k})`; ctx.lineWidth = 1.6 * d;
    ctx.beginPath(); ctx.moveTo(x - 7 * d, y + 20 * d); ctx.lineTo(x, y + 13 * d); ctx.lineTo(x + 7 * d, y + 20 * d); ctx.stroke();
    ctx.strokeStyle = `rgba(255,170,60,${0.16 * k})`; ctx.lineWidth = d; ctx.beginPath(); ctx.arc(x, y, 44 * d, 0, 7); ctx.stroke();
  } else if (sight === 'sniper') { // a proper sniper reticle: fine cross with mil-dots, thick posts, the lens ring
    const R = lensR, a = k;
    ctx.lineCap = 'butt';
    ctx.strokeStyle = `rgba(0,0,0,${0.85 * a})`; ctx.lineWidth = 2.2 * d; ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.stroke(); // lens edge
    ctx.strokeStyle = `rgba(160,190,210,${0.25 * a})`; ctx.lineWidth = d; ctx.beginPath(); ctx.arc(x, y, R - 3 * d, 0, 7); ctx.stroke();
    const gap = R * 0.45, fine = R * 0.06;
    ctx.strokeStyle = `rgba(0,0,0,${0.9 * a})`; ctx.lineWidth = 3 * d; // posts from the edge in
    for (const [ux, uy] of [[1, 0], [-1, 0], [0, 1]]) { ctx.beginPath(); ctx.moveTo(x + ux * (R - 2 * d), y + uy * (R - 2 * d)); ctx.lineTo(x + ux * gap, y + uy * gap); ctx.stroke(); }
    ctx.lineWidth = 1.1 * d; ctx.beginPath(); // the fine cross
    ctx.moveTo(x - gap, y); ctx.lineTo(x - fine, y); ctx.moveTo(x + fine, y); ctx.lineTo(x + gap, y);
    ctx.moveTo(x, y - R + 2 * d); ctx.lineTo(x, y - fine); ctx.moveTo(x, y + fine); ctx.lineTo(x, y + gap); ctx.stroke();
    ctx.fillStyle = `rgba(0,0,0,${0.9 * a})`; // mil-dots
    for (let i = 1; i <= 4; i++) { const o = fine + (gap - fine) * i / 4.5; for (const [px, py] of [[o, 0], [-o, 0], [0, o], [0, -o]]) { ctx.beginPath(); ctx.arc(x + px, y + py, 1.2 * d, 0, 7); ctx.fill(); } }
    ctx.fillStyle = `rgba(255,70,50,${0.95 * a})`; ctx.beginPath(); ctx.arc(x, y, 1.4 * d, 0, 7); ctx.fill(); // the lit centre
  } else if (sight === 'scope') { // a lens: the screen edges darken a little, range ticks beside the crosshair
    const r = Math.hypot(W, H) / 2, g = ctx.createRadialGradient(W / 2, H / 2, r * 0.55, W / 2, H / 2, r);
    g.addColorStop(0, 'rgba(0,8,14,0)'); g.addColorStop(1, `rgba(0,8,14,${0.42 * k})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = `rgba(0,0,0,${0.5 * k})`; ctx.lineWidth = d;
    for (const sgn of [-1, 1]) for (let i = 1; i <= 3; i++) { const o = (26 + i * 9) * d; ctx.beginPath(); ctx.moveTo(x + sgn * o, y - 3 * d); ctx.lineTo(x + sgn * o, y + 3 * d); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - 3 * d, y + o); ctx.lineTo(x + 3 * d, y + o); ctx.stroke(); }
  }
  ctx.restore();
}
