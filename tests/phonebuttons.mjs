// Phone buttons check: shows every touch button at once on several phone and tablet sizes and states (on a body with
// lean lit, ACTION showing a word, tilt; on cameras) and prints any that overlap, sit under 6 px apart or leave the screen.
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
  const R = e => { const r = e.getBoundingClientRect(); return { n: e.dataset.id || e.id, l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, round: getComputedStyle(e).borderRadius.includes('50%') }; };
  const rs = els.map(R), out = [];
  for (const a of rs) if (a.l < 0 || a.t < 0 || a.r > innerWidth || a.b > innerHeight) out.push('OFF ' + a.n + ' ' + [a.l,a.t,a.r,a.b].map(Math.round));
  // gap between shapes: circles treated as circles
  const gap = (a, b) => { if (a.round && b.round) { const d = Math.hypot((a.l+a.r)/2-(b.l+b.r)/2, (a.t+a.b)/2-(b.t+b.b)/2); return d - a.w/2 - b.w/2; }
    const dx = Math.max(a.l - b.r, b.l - a.r, 0), dy = Math.max(a.t - b.b, b.t - a.b, 0); return dx || dy ? Math.hypot(dx, dy) : -Math.min(a.r - b.l, b.r - a.l, a.b - b.t, b.b - a.t); };
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const g = gap(rs[i], rs[j]); const sticks = /^ts/.test(rs[i].n) || /^ts/.test(rs[j].n); if (g < (sticks ? 0 : 6)) out.push((g < 0 ? 'OVERLAP ' : 'CLOSE ') + rs[i].n + ' & ' + rs[j].n + ' gap ' + Math.round(g)); }
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
