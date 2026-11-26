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

// The sniper lens magnifies (he asked): LENS_ZOOM times at full aim, easing in as you aim in. lensMag(at) = the zoom now.
export const LENS_ZOOM = 3;
export const lensMag = at => 1 + (LENS_ZOOM - 1) * Math.max(0, Math.min(1, (at - 0.3) / 0.5));
// draws src's circle round (x, y) of radius r / M blown up to radius r on ctx (identity transform, canvas px). src may be
// ctx's own canvas (copied first); k = src px per ctx px (a smaller canvas, like the fog)
const lensTmp = typeof document !== 'undefined' ? document.createElement('canvas') : null;
export function magnify(ctx, src, x, y, r, M, k = 1) {
  const sr = r / M, n = Math.max(1, Math.ceil(sr * 2 * k));
  if (lensTmp.width !== n) { lensTmp.width = n; lensTmp.height = n; }
  const t = lensTmp.getContext('2d'); t.clearRect(0, 0, n, n);
  t.drawImage(src, (x - sr) * k, (y - sr) * k, sr * 2 * k, sr * 2 * k, 0, 0, n, n);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.clip();
  ctx.clearRect(x - r, y - r, r * 2, r * 2); ctx.drawImage(lensTmp, 0, 0, n, n, x - r, y - r, r * 2, r * 2);
  ctx.restore();
}
// a point seen in the lens: where it shows (null = hidden under the lens rim)
export function lensPt(px, py, x, y, r, M) {
  if (M <= 1.01) return { x: px, y: py, k: 1 };
  const dx = px - x, dy = py - y, d = Math.hypot(dx, dy);
  if (d * M <= r) return { x: x + dx * M, y: y + dy * M, k: M };
  return d <= r ? null : { x: px, y: py, k: 1 };
}

// The reticle (he asked 2026-11-17): not chosen in Settings any more. It looks like the sight on the gun you have out —
// iron sights, red dot, holo, 1.5x prism, 2x scope or sniper scope — easy to see but not in the way: a little see-through,
// a thin dark edge so it shows on light floors and dark rooms, mid-sized. 'spread' (screen px before scale) opens it up
// as the gun gets less accurate (moving, spraying, hip fire); k = device pixel ratio.
export const SIGHT_NAMES = { iron: 'Iron sights', reddot: 'Red dot', holo: 'Holo', prism: '1.5× prism', scope: '2× scope', sniper: 'Sniper scope' };
// sz = how big the shapes are (main.js: smaller when zoomed out and further from you, he asked 2026-11-18); the gap g
// is not scaled by it, so it still shows exactly where the next bullet can land (his pick).
// The far aim ring (he asked 2026-11-18): round you at the "Far aim speed from" distance; past it the mouse moves the
// crosshair at the "Far aim speed" setting. Faint and dashed; a little brighter while the crosshair is out past it.
export function drawFastRing(ctx, x, y, R, out, k) {
  if (!(R > 4)) return;
  ctx.save(); ctx.setLineDash([5 * k, 7 * k]);
  ctx.globalAlpha = out ? 0.5 : 0.28; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 2.6 * k; ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.stroke();
  ctx.globalAlpha = out ? 0.75 : 0.42; ctx.strokeStyle = '#a9c4a2'; ctx.lineWidth = 1.2 * k; ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.stroke();
  ctx.restore();
}
// Easier to find (he asked 2026-11-26: it got lost on the fly; he chose all four): Settings → Mouse & Aim → Reticle
// highlight, a strength (0-100%) and Glow / Bold / Line. reticleHelp() is called once a frame before drawReticle (main.js
// and the Armory, each with its own state object): it tracks how fast the reticle moves on the screen, draws the faint
// line from you to it and the glow while it moves fast (fading a moment after it stops), and returns the options for
// drawReticle. Plain strokes and one small gradient only (GPU lesson: no filters, shadows or odd composite ops).
export const XHI_DEFAULT = { hi: 100, glow: true, bold: true, line: true };
export function reticleHelp(S, ctx, x, y, px, py, now, o, k, line = true, from = null) { // from = where the line starts (the gun), else your middle
  const f = Math.max(0, Math.min(1, (o.hi ?? 100) / 100)), dt = Math.min(0.1, Math.max(0, now - (S.t || now)));
  const rx = x - px, ry = y - py; // measured from you, so the camera gliding or you walking doesn't count: only your aim moving
  const v = dt > 0 && S.x !== undefined ? Math.hypot(rx - S.x, ry - S.y) / k / dt : 0; S.x = rx; S.y = ry; S.t = now;
  S.v = (S.v || 0) + (v - (S.v || 0)) * (1 - Math.exp(-dt / 0.05)); // speed in CSS px a second, smoothed
  const want = o.glow ? Math.max(0, Math.min(1, (S.v - 350) / 900)) : 0;
  S.g = want > (S.g || 0) ? (S.g || 0) + (want - (S.g || 0)) * (1 - Math.exp(-dt / 0.04)) : (S.g || 0) * Math.exp(-dt / 0.3);
  const glow = S.g * f, bold = o.bold ? f : 0;
  if (o.line && line && f > 0) { // a faint thin line from just outside your body to just short of the reticle
    const sx = from ? from.x : px, sy = from ? from.y : py, dx = x - sx, dy = y - sy, d = Math.hypot(dx, dy), a0 = (from ? 3 : 12) * k, a1 = d - 16 * k;
    if (a1 > a0 + 6 * k) {
      const ux = dx / d, uy = dy / d; ctx.save(); ctx.lineCap = 'round';
      ctx.globalAlpha *= f * (0.22 + 0.28 * S.g);
      for (const [c, w] of [['rgba(0,0,0,0.8)', 2.6], ['#e8f2e4', 1.1]]) { ctx.strokeStyle = c; ctx.lineWidth = w * k; ctx.beginPath(); ctx.moveTo(sx + ux * a0, sy + uy * a0); ctx.lineTo(sx + ux * a1, sy + uy * a1); ctx.stroke(); }
      ctx.restore();
    }
  }
  return { glow, bold };
}

export function drawReticle(ctx, sight, x, y, spread, k, sz = 1, opt = null) {
  x = Math.round(x) + 0.5; y = Math.round(y) + 0.5;
  const bold = opt ? opt.bold || 0 : 0, glow = opt ? opt.glow || 0 : 0;
  if (glow > 0.01) { // the glow while it moves: a soft light halo and a thin bright ring round it
    const R = 26 * k * Math.max(0.7, sz), gr = ctx.createRadialGradient(x, y, 2 * k, x, y, R);
    gr.addColorStop(0, `rgba(235,255,230,${0.42 * glow})`); gr.addColorStop(0.55, `rgba(169,196,162,${0.22 * glow})`); gr.addColorStop(1, 'rgba(169,196,162,0)');
    ctx.save(); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fill();
    ctx.globalAlpha *= glow * 0.8; ctx.lineWidth = 3 * k; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.arc(x, y, R * 0.62, 0, 7); ctx.stroke();
    ctx.lineWidth = 1.4 * k; ctx.strokeStyle = '#f2fff0'; ctx.stroke(); ctx.restore();
  }
  const g = Math.max(0, spread) * k, A = 0.82 + 0.18 * bold, ek = k * Math.max(0.6, 0.8 * sz) * (1 + 0.5 * bold); k *= 1.35 * 0.8 * sz * (1 + 0.12 * bold); // (a third bigger than a plain pixel, then 20% smaller: he asked 2026-11-18; Bold: solid, a thicker edge, 12% bigger) // g = how far it opens up, ek = the dark edge
  const edge = `rgba(0,0,0,${0.55 + 0.3 * bold})`;
  // every shape is drawn twice: a wider dark stroke under, then the colour
  const both = (col, w, path, fill) => { ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = edge; ctx.lineWidth = w * k + 2 * ek; ctx.beginPath(); path(); ctx.stroke(); if (fill) { ctx.fillStyle = edge; ctx.fill(); }
    ctx.strokeStyle = col; ctx.lineWidth = w * k; ctx.beginPath(); path(); ctx.stroke(); if (fill) { ctx.fillStyle = col; ctx.fill(); } };
  const dot = (col, r) => both(col, 0.01, () => ctx.arc(x, y, r * k, 0, 7), true);
  ctx.save(); ctx.globalAlpha = A;
  if (sight === 'reddot') { // a red dot, and a thin red ring that opens with the spread
    const r = 7 * k + g;
    ctx.globalAlpha = A * 0.55; both('rgba(255,70,60,1)', 1.3, () => ctx.arc(x, y, r, 0, 7));
    ctx.globalAlpha = A; dot('#ff3b30', 2.3);
  } else if (sight === 'holo') { // the holographic ring, broken at four points, round a small dot
    const r = 10 * k + g;
    both('#7fe6ff', 1.5, () => { for (let i = 0; i < 4; i++) { const a0 = i * Math.PI / 2 + 0.28, a1 = (i + 1) * Math.PI / 2 - 0.28; ctx.moveTo(x + Math.cos(a0) * r, y + Math.sin(a0) * r); ctx.arc(x, y, r, a0, a1); } });
    dot('#7fe6ff', 1.6);
  } else if (sight === 'prism') { // an amber chevron whose tip is the aim point, side bars that open with the spread
    const s = 6 * k, o = 5 * k + g, l = 6 * k;
    both('#ffb040', 1.6, () => { ctx.moveTo(x - s, y + s); ctx.lineTo(x, y); ctx.lineTo(x + s, y + s); ctx.moveTo(x - o, y); ctx.lineTo(x - o - l, y); ctx.moveTo(x + o, y); ctx.lineTo(x + o + l, y); });
  } else if (sight === 'scope' || sight === 'sniper') { // a fine cross with a gap, range ticks; the sniper's adds thick posts
    const o = 3 * k + g, l = 11 * k;
    both('#e6f4ff', 1.3, () => { for (const [u, v] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.moveTo(x + u * o, y + v * o); ctx.lineTo(x + u * (o + l), y + v * (o + l)); } });
    both('#e6f4ff', 1, () => { for (let i = 1; i <= 2; i++) { const t = o + l * i / 3; ctx.moveTo(x - 2 * k, y + t); ctx.lineTo(x + 2 * k, y + t); } });
    if (sight === 'sniper') both('#e6f4ff', 2.4, () => { for (const [u, v] of [[1, 0], [-1, 0], [0, 1]]) { ctx.moveTo(x + u * (o + l), y + v * (o + l)); ctx.lineTo(x + u * (o + l + 6 * k), y + v * (o + l + 6 * k)); } });
    dot('#ff5a40', 1.1);
  } else { // iron sights: a front post whose tip is the aim point, inside the rear notch (it opens with the spread)
    const w = 4 * k + g, h = 7 * k;
    both('#f2f5f0', 1.6, () => { ctx.moveTo(x, y + 1 * k); ctx.lineTo(x, y + h); ctx.moveTo(x - w - 7 * k, y); ctx.lineTo(x - w, y); ctx.lineTo(x - w, y + h); ctx.moveTo(x + w + 7 * k, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h); });
    dot('#f2f5f0', 1.1);
  }
  ctx.restore();
}

// each sight has its own faint look while aiming in (he asked: interesting but never in the way); nothing covers the middle
export function drawSightLook(ctx, sight, x, y, k, d, lensR) { // d = device pixel ratio, lensR = sniper lens radius in px
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.save();
  if (sight === 'reddot') { // a soft red bloom round the crosshair, like the glass of the dot catching light
    const g = ctx.createRadialGradient(x, y, 4 * d, x, y, 34 * d); g.addColorStop(0, `rgba(255,60,60,${0.10 * k})`); g.addColorStop(1, 'rgba(255,60,60,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 34 * d, 0, 7); ctx.fill();
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
  }
  ctx.restore();
}
