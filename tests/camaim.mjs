// A camera put round you at 3-10 m, the reticle exactly on it as drawn (lifted to its height), aimed in, one shot: prints
// how far the bullet passed from it (he found 2026-11-26: 2-11 px off before; a camera is 6 across). Usage: node tests/camaim.mjs <port> <url> (fast server)
const [port, url, out] = process.argv.slice(2);
import { writeFileSync } from 'fs';
const ws = new WebSocket(`ws://127.0.0.1:${port}/session`);
let id = 0; const waiting = new Map();
const call = (method, params) => new Promise((res, rej) => { const i = ++id; waiting.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waiting.has(m.id)) { const w = waiting.get(m.id); waiting.delete(m.id); m.type === 'error' ? w.rej(new Error(m.error + ': ' + m.message)) : w.res(m.result); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ctx; const nav = async () => { for (let i = 0; i < 5; i++) { try { await call('browsingContext.navigate', { context: ctx, url, wait: 'complete' }); return; } catch (e) { await sleep(2000); } } };
const js = async expr => { const r = await call('script.evaluate', { expression: expr, target: { context: ctx }, awaitPromise: true }); if (r.exceptionDetails) throw new Error('js: ' + r.exceptionDetails.text); return r.result.value; };
ws.onopen = async () => { try { await run(); } catch (e) { console.log('ERROR', e.message); } process.exit(0); };
async function run() {
  await call('session.new', { capabilities: {} });
  ctx = (await call('browsingContext.create', { type: 'tab' })).context;
  await call('browsingContext.setViewport', { context: ctx, viewport: { width: 1600, height: 900 } });
  await nav(); await sleep(1000);
  await js(`localStorage.setItem('r62d-name', 'Aimer'); true`); await nav(); await sleep(2500);
  await js(`document.getElementById('splash').click(); true`); await sleep(1500);
  await js(`document.querySelector('[data-tab="free"]').click(); true`); await sleep(800);
  await js(`document.getElementById('freeGo').click(); true`);
  for (let i = 0; i < 60; i++) { await sleep(500); if (await js('!!(window.__r62d && __r62d.st.map && __r62d.st.pred && __r62d.st.me && __r62d.st.me.a)')) break; }
  await sleep(3000);
  await js(`(async () => { const L = await import('/js/look.js'); window.__L = L; const s = __r62d.st; window.__shots = []; const f = __r62d.fx, t0 = f.tracer.bind(f), t1 = f.trail.bind(f); f.tracer = (...a) => { __shots.push(a.slice(0, 4)); return t0(...a); }; f.trail = (...a) => { __shots.push(a.slice(0, 4)); return t1(...a); }; return true; })()`);
  // stand in an open spot: try the player's own spot; cameras placed around at several distances / directions
  const spots = JSON.parse(await js(`JSON.stringify([__r62d.st.pred.x, __r62d.st.pred.y, __r62d.st.me.tm])`));
  const [X, Y, tm] = spots;
  console.log('me', X.toFixed(0), Y.toFixed(0), 'team', tm);
  const Z = +(process.env.Z || 0.72);
  for (const [ang, dm] of [[0, 3], [0, 6], [-1.57, 4], [-1.57, 7], [2.4, 5], [0.8, 8], [-0.6, 10]]) {
    const cx = X + Math.cos(ang) * dm * 36, cy = Y + Math.sin(ang) * dm * 36;
    const ok = await js(`(() => { const m = __r62d.st.map; return true; })()`);
    await js(`__r62d.st.ws.send(JSON.stringify({ t: 'free', a: 'ent', ty: 'cam', x: ${cx}, y: ${cy}, team: '${tm === 'atk' ? 'def' : 'atk'}' })); true`);
    await sleep(500);
    const r = await js(`new Promise(res => { const s = __r62d.st, e = (s.last.ents || []).find(e => e.ty === 'cam' && Math.hypot(e.x - ${cx}, e.y - ${cy}) < 2); if (!e) return res('no cam'); let n = 0;
      const step = () => { const [lx, ly] = __L.liftOf(e.x, e.y, ${Z}); __r62d.aimTo(e.x + lx, e.y + ly); if (n === 0) document.getElementById('game').dispatchEvent(new MouseEvent('mousedown', { button: 2, bubbles: true })); if (++n < 90) requestAnimationFrame(step); else { __shots.length = 0; document.getElementById('game').dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true })); setTimeout(() => { window.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true })); }, 60); setTimeout(() => { const sh = __shots.find(a => Math.hypot(a[0] - s.pred.x, a[1] - s.pred.y) < 30); if (!sh) return res('no shot ' + JSON.stringify({ ph: s.last.ph, am: s.me.am, n: __shots.length })); const [x0, y0, x1, y1] = sh, dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy); const miss = Math.abs((e.x - x0) * dy - (e.y - y0) * dx) / L; const still = (s.last.ents || []).some(q => q.id === e.id); const fp = __r62d.freeAimPoint(); res(JSON.stringify({ aimOff: +Math.hypot(fp.ax - e.x - lx, fp.ay - e.y - ly).toFixed(1), short: +(Math.hypot(e.x - x0, e.y - y0) - L).toFixed(0), ph: s.last.ph, miss: +miss.toFixed(2), lift: +Math.hypot(lx, ly).toFixed(1), broke: !still })); }, 700); setTimeout(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 2, bubbles: true })), 800); } }; requestAnimationFrame(step); })`);
    console.log('cam', ang, dm + ' m', r);
    await js(`__r62d.st.ws.send(JSON.stringify({ t: 'free', a: 'tp', x: ${X}, y: ${Y} })); true`); await sleep(300);
  }
}
