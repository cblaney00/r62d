// Paste into a tests/shoot.mjs "js" step (newlines removed) in a free play match: how far the sight shape's edges move
// between frames while only the view turns (body: a 1.9 rad cone; drone: a full circle), old way vs now. Now must print 0.00.
(async () => {
  const { castSight } = await import('/shared/physics.js');
  const st = __r62d.st, m = st.map, me = { x: st.pred.x, y: st.pred.y };
  const oldPoly = (v) => { const pts = [], full = v.fov >= 6.27, n = full ? 360 : 300; if (!full) pts.push(v.x, v.y);
    for (let i = 0; i <= n; i++) { const a = v.ang - v.fov / 2 + v.fov * i / n; const d = Math.min(v.range, castSight(m, v.x, v.y, a, v.range, [], false, !!v.low) + 7); pts.push(v.x + Math.cos(a) * d, v.y + Math.sin(a) * d); } return pts; };
  const radius = (pts, v, th, full) => { 
    const dx = Math.cos(th), dy = Math.sin(th); let best = 1e9; const s = full ? 0 : 2, n = pts.length;
    for (let i = s; i < n; i += 2) { const j = i + 2 < n ? i + 2 : (full ? 0 : -1); if (j < 0) break;
      const ax = pts[i] - v.x, ay = pts[i + 1] - v.y, bx = pts[j] - v.x, by = pts[j + 1] - v.y, ex = bx - ax, ey = by - ay, den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-9) continue; const t = (ax * ey - ay * ex) / den, u = (ax * dy - ay * dx) / den; if (t > 0 && u >= -1e-6 && u <= 1 + 1e-6) best = Math.min(best, t); }
    return best; };
  const run = (mk, full) => { let worst = 0, sum = 0, cnt = 0, prev = null;
    for (let s = 0; s <= 150; s++) { const v = { x: me.x, y: me.y, ang: 0.3 + s * 0.0021, fov: full ? Math.PI * 2 : 1.9, range: full ? 230 : 1100, low: full };
      const P = mk(v), r = []; for (let q = 0; q < 240; q++) { const th = full ? q / 240 * 6.283 + 0.0137 : 0.3 + 0.0021 * 150 - 0.95 + 0.4 + q / 240 * (1.9 - 0.8 - 0.32); r.push(radius(P, v, th, full)); }
      if (prev) for (let q = 0; q < r.length; q++) { const d = Math.abs(r[q] - prev[q]); if (d < 1e8) { worst = Math.max(worst, d); sum += d; cnt++; } }
      prev = r; }
    return [worst.toFixed(2), (sum / cnt).toFixed(3)]; };
  const nw = v => __r62dVis(v, [], 0);
  const t0 = performance.now(); for (let i = 0; i < 50; i++) nw({ x: me.x, y: me.y, ang: i * 0.1, fov: 1.9, range: 1100 }); const tn = (performance.now() - t0) / 50;
  const t1 = performance.now(); for (let i = 0; i < 50; i++) oldPoly({ x: me.x, y: me.y, ang: i * 0.1, fov: 1.9, range: 1100 }); const to = (performance.now() - t1) / 50;
  return JSON.stringify({ body_old: run(oldPoly, 0), body_new: run(nw, 0), drone_old: run(oldPoly, 1), drone_new: run(nw, 1), ms_new: tn.toFixed(2), ms_old: to.toFixed(2) });
})()
