// Frame cost in a real browser (the weak-device check, 2026-11-19). Free play on a map with bots, at a graphics level:
// stand, then walk + spin the aim (his stress test, softer), and report script ms per frame (PF sections), frame gaps,
// JS heap if the browser tells, and the sizes of the client's lists (to catch leaks).
// Usage like tests/shoot.mjs: node tests/perfclient.mjs <port> <gameUrl> [level] [map] [w] [h] [seconds]
const [port, url, level = 'high', map = 'embassy', W = 1600, H = 900, secs = 8] = process.argv.slice(2);
const ws = new WebSocket(`ws://127.0.0.1:${port}/session`);
let id = 0; const waiting = new Map();
const call = (method, params) => new Promise((res, rej) => { const i = ++id; waiting.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waiting.has(m.id)) { const w = waiting.get(m.id); waiting.delete(m.id); m.type === 'error' ? w.rej(new Error(m.error + ': ' + m.message)) : w.res(m.result); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ctx;
const js0 = async expr => { const r = await call('script.evaluate', { expression: expr, target: { context: ctx }, awaitPromise: true }); if (r.exceptionDetails) throw new Error('js: ' + r.exceptionDetails.text); return r.result && r.result.value; };
const js = async expr => { for (let i = 0; ; i++) { try { return await js0(expr); } catch (e) { if (i > 4 || !/InvalidState|no such frame|discarded/.test(e.message)) throw e; await sleep(1500); } } };
ws.onopen = async () => { try { await run(); } catch (e) { console.log('ERROR', e.message); } process.exit(0); };
const nav = async () => { for (let i = 0; i < 5; i++) { try { await call('browsingContext.navigate', { context: ctx, url, wait: 'complete' }); return; } catch (e) { await sleep(2000); } } throw new Error('page did not load'); };
// measure for ms: per-frame PF sections and gaps; walk + spin when moving
const measure = (ms, moving) => js(`new Promise(res => { const R = __r62d, s = R.st, PF = R.PF, p0 = { ...PF }, t0 = performance.now(), gaps = []; let last = t0;
  const c = { x: s.pred.x, y: s.pred.y };
  const step = now => { gaps.push(now - last); last = now; const t = now - t0;
    if (${moving}) { const a = t / 2000 * Math.PI * 2, r = 120 + 500 * (0.5 - 0.5 * Math.cos(t / 3000 * Math.PI * 2)); R.aimTo(s.pred.x + Math.cos(a) * r, s.pred.y + Math.sin(a) * r);
      if ((t | 0) % 400 < 20) s.ws.send(JSON.stringify({ t: 'free', a: 'tp', x: c.x + Math.cos(t / 4000 * Math.PI * 2) * 80, y: c.y + Math.sin(t / 4000 * Math.PI * 2) * 80 })); }
    if (t < ${ms}) requestAnimationFrame(step); else {
      const n = PF.frames - p0.frames, sec = {}; let tot = 0; for (const k in PF) if (k !== 'frames') { const v = (PF[k] - (p0[k] || 0)) / n; if (v > 0.05) sec[k] = +v.toFixed(2); }
      gaps.shift(); gaps.sort((a, b) => a - b); const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      res(JSON.stringify({ fps: +(1000 / avg).toFixed(1), low1: +(1000 / gaps[Math.floor(gaps.length * 0.99)]).toFixed(1), worst: +gaps[gaps.length - 1].toFixed(1), frames: n, sec,
        heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1e6).toFixed(1) : null, anim: s.anim.size, corpses: s.corpses.length })); } };
  requestAnimationFrame(step); })`).then(JSON.parse);
async function run() {
  await call('session.new', { capabilities: {} });
  ctx = (await call('browsingContext.create', { type: 'tab' })).context;
  await call('browsingContext.setViewport', { context: ctx, viewport: { width: +W, height: +H } });
  await nav(); await sleep(1000);
  await js(`localStorage.setItem('r62d-name', 'Perf'); localStorage.setItem('r62d-gfx', '${level}'); localStorage.setItem('r62d-free', JSON.stringify({ map: '${map}', bots: 6, level: 2 })); true`);
  await nav(); await sleep(3000);
  await js(`document.getElementById('splash').click(); true`); await sleep(1500);
  await js(`document.querySelector('[data-tab="free"]').click(); true`); await sleep(800);
  await js(`document.getElementById('freeGo').click(); true`);
  for (let i = 0; i < 60; i++) { await sleep(500); try { if (await js('!!(window.__r62d && __r62d.st.map && __r62d.st.pred && __r62d.st.me && __r62d.st.me.a)')) break; } catch (e) {} }
  await sleep(4000);
  const errs0 = await js(`(window.__errs || []).length`);
  const stand = await measure(secs * 1000 / 2, false);
  const move = await measure(secs * 1000, true);
  console.log(`${level} ${map} ${W}x${H}`);
  console.log('  standing', JSON.stringify(stand));
  console.log('  moving  ', JSON.stringify(move));
  if (errs0) console.log('  page errors', errs0);
}
