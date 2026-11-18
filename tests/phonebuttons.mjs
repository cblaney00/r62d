// Phone buttons check: shows every touch button at once on several phone and tablet sizes and states (on a body with
// lean lit, ACTION showing a word, tilt; on cameras) and prints any that overlap, sit under 2.5 px apart or leave the
// screen, measured on their real shapes (polygon pieces, sticks with their fire rings).
// Usage like tests/thumbs.mjs: node tests/phonebuttons.mjs <port> <gameUrl>
const [port, url] = process.argv.slice(2);
const SIZES = [[914,412],[844,390],[800,360],[740,360],[667,375],[1024,600],[1180,820]];
const ws = new WebSocket(`ws://127.0.0.1:${port}/session`);
let id = 0; const waiting = new Map();
const call = (method, params) => new Promise((res, rej) => { const i = ++id; waiting.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waiting.has(m.id)) { const w = waiting.get(m.id); waiting.delete(m.id); m.type === 'error' ? w.rej(new Error(m.message)) : w.res(m.result); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ctx;
const js = async expr => { const r = await call('script.evaluate', { expression: expr, target: { context: ctx }, awaitPromise: true }); if (r.exceptionDetails) throw new Error('js: ' + r.exceptionDetails.text); return r.result && r.result.value; };
const probe = `(async () => {
  const T = await import('/js/touch.js'); T.setTouchVisible(false); T.setTouchVisible(true);
  const ui = document.getElementById('touchUI'); ui.classList.remove('hidden'); document.documentElement.classList.add('touchplay');
  const mode = window.__mode;
  T.touchContext({ use: mode !== 'idle', busy: false, vault: false, word: 'REINFORCE', cams: mode === 'cams', drone: false, body: mode !== 'cams', lean: mode === 'leanL' ? -1 : mode === 'leanR' ? 1 : 0, badge: { skill: '2', gadget: '3', view: '2' } });
  for (const b of ui.querySelectorAll('.tbtn')) { const id = b.dataset.id; if (id === 'tiltc' && mode !== 'tilt') continue; if (/^(ads|adsL|leanL|leanR)$/.test(id) && mode === 'cams') continue; if (/^(prev|next)$/.test(id) && mode !== 'cams') continue; b.classList.remove('hidden'); }

  const els = [...ui.querySelectorAll('.tbtn:not(.hidden), #tsLeft, #tsRight')].filter(e => e.getBoundingClientRect().width > 0); if (els.length < 5) return 'NOT SHOWN (' + els.length + ') touch=' + T.isTouch + ' ' + getComputedStyle(ui).display;
  // every piece as its real shape: a stick (with its fire ring) or a round button as a circle, a polygon button as its polygon, anything else as its box
  const shape = e => { const r = e.getBoundingClientRect(), n = e.dataset.id || e.id;
    if (/^ts/.test(e.id)) return { n, c: [(r.left + r.right) / 2, (r.top + r.bottom) / 2], rad: r.width / 2 * (ui.classList.contains('rings') ? 88 / 60 : 1) };
    if (e._poly) { const k = r.width / e._poly.w; return { n, p: e._poly.pts.map(q => [r.left + q[0] * k, r.top + q[1] * k]) }; }
    if (getComputedStyle(e).borderRadius.includes('50%')) return { n, c: [(r.left + r.right) / 2, (r.top + r.bottom) / 2], rad: r.width / 2 };
    return { n, p: [[r.left, r.top], [r.right, r.top], [r.right, r.bottom], [r.left, r.bottom]] }; };
  const rs = els.map(shape), out = [];
  for (const a of rs) { const pts = a.p || [[a.c[0] - a.rad, a.c[1] - a.rad], [a.c[0] + a.rad, a.c[1] + a.rad]], xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
    if (Math.min(...xs) < -0.5 || Math.min(...ys) < -0.5 || Math.max(...xs) > innerWidth + 0.5 || Math.max(...ys) > innerHeight + 0.5) out.push('OFF ' + a.n); }
  const inside = (p, q) => { let r = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > q[1]) !== (p[j][1] > q[1]) && q[0] < (p[j][0] - p[i][0]) * (q[1] - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) r = !r; return r; };
  const segPt = (a, b, q) => { const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(a[0] + dx * t - q[0], a[1] + dy * t - q[1]); };
  const cross = (a, b, c, d) => { const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };
  const edges = p => p.map((q, i) => [q, p[(i + 1) % p.length]]);
  const gap = (a, b) => {
    if (a.c && b.c) return Math.hypot(a.c[0] - b.c[0], a.c[1] - b.c[1]) - a.rad - b.rad;
    if (a.c || b.c) { const c = a.c ? a : b, p = (a.c ? b : a).p; if (inside(p, c.c)) return -1; return Math.min(...edges(p).map(([u, v]) => segPt(u, v, c.c))) - c.rad; }
    for (const [u, v] of edges(a.p)) for (const [s, t] of edges(b.p)) if (cross(u, v, s, t)) return -1;
    if (inside(a.p, b.p[0]) || inside(b.p, a.p[0])) return -1;
    let m = 1e9; for (const [u, v] of edges(a.p)) for (const q of b.p) m = Math.min(m, segPt(u, v, q)); for (const [u, v] of edges(b.p)) for (const q of a.p) m = Math.min(m, segPt(u, v, q)); return m; };
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const g = gap(rs[i], rs[j]); if (g < 2.5) out.push((g < 0 ? 'OVERLAP ' : 'CLOSE ') + rs[i].n + ' & ' + rs[j].n + ' gap ' + Math.round(g * 10) / 10); }
  return out.join('\\n') || 'ok';
})()`;
ws.onopen = async () => {
  try {
    await call('session.new', { capabilities: {} });
    ctx = (await call('browsingContext.create', { type: 'tab' })).context;
    for (const [W, H] of SIZES) {
      await call('browsingContext.setViewport', { context: ctx, viewport: { width: W, height: H } });
      try { await call('browsingContext.navigate', { context: ctx, url, wait: 'complete' }); } catch (e) { console.log('nav', e.message); } await sleep(3500);
      for (const mode of ['use', 'leanL', 'leanR', 'tilt', 'cams']) { await js(`window.__mode = '${mode}'`); console.log(`== ${W}x${H} ${mode}\n` + await js(probe)); }
      if (W === 914) { const r = await call('browsingContext.captureScreenshot', { context: ctx }); (await import('node:fs')).writeFileSync((process.env.OUT || '.') + '/phonebuttons.png', Buffer.from(r.data, 'base64')); }
    }
  } catch (e) { console.log('ERROR', e.message); }
  process.exit(0);
};
