// A shot through a soft wall, aimed in: screenshots before and right after (your own bullet streak over the dark, through
// the wall). Usage: node tests/wallshot.mjs <port> <url> <outdir> (fast server)
const [port, url, out] = process.argv.slice(2);
import { writeFileSync } from 'fs';
const ws = new WebSocket(`ws://127.0.0.1:${port}/session`);
let id = 0; const waiting = new Map();
const call = (method, params) => new Promise((res, rej) => { const i = ++id; waiting.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waiting.has(m.id)) { const w = waiting.get(m.id); waiting.delete(m.id); m.type === 'error' ? w.rej(new Error(m.error + ': ' + m.message)) : w.res(m.result); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ctx; const nav = async () => { for (let i = 0; i < 5; i++) { try { await call('browsingContext.navigate', { context: ctx, url, wait: 'complete' }); return; } catch (e) { await sleep(2000); } } };
const js = async expr => { const r = await call('script.evaluate', { expression: expr, target: { context: ctx }, awaitPromise: true }); if (r.exceptionDetails) throw new Error('js: ' + r.exceptionDetails.text); return r.result.value; };
const shot = async n => { const r = await call('browsingContext.captureScreenshot', { context: ctx }); writeFileSync(`${out}/${n}.png`, Buffer.from(r.data, 'base64')); };
ws.onopen = async () => { try { await run(); } catch (e) { console.log('ERROR', e.message); } process.exit(0); };
async function run() {
  await call('session.new', { capabilities: {} });
  ctx = (await call('browsingContext.create', { type: 'tab' })).context;
  await call('browsingContext.setViewport', { context: ctx, viewport: { width: 1280, height: 720 } });
  await nav(); await sleep(1000);
  await js(`localStorage.setItem('r62d-name', 'Aimer'); true`); await nav(); await sleep(2500);
  await js(`document.getElementById('splash').click(); true`); await sleep(1500);
  await js(`document.querySelector('[data-tab="free"]').click(); true`); await sleep(800);
  await js(`document.getElementById('freeGo').click(); true`);
  for (let i = 0; i < 60; i++) { await sleep(500); if (await js('!!(window.__r62d && __r62d.st.map && __r62d.st.pred && __r62d.st.me && __r62d.st.me.a)')) break; }
  await sleep(3000);
  const spot = await js(`(async () => { const C = await import('/shared/constants.js'), T = C.T, m = __r62d.st.map, W = m.W, H = m.H, t = (x, y) => m.tiles[y * W + x], fl = (x, y) => t(x, y) === T.FLOOR;
    const me = __r62d.st.pred, mx = Math.floor(me.x / C.CELL), my = Math.floor(me.y / C.CELL); let best = null;
    for (let y = 5; y < H - 6; y++) for (let x = 3; x < W - 3; x++) { if (!(t(x - 1, y) === T.SOFT && t(x, y) === T.SOFT && t(x + 1, y) === T.SOFT)) continue; let ok = true; for (let d = 1; d <= 5; d++) for (const dx of [-1, 0, 1]) if (!fl(x + dx, y - d) || !fl(x + dx, y + d)) ok = false; if (!ok) continue; const dd = Math.hypot(x - mx, y - my); if (!best || dd < best.d) best = { x, y, d: dd }; }
    return best ? JSON.stringify({ x: (best.x + 0.5) * C.CELL, y0: (best.y - 3.5) * C.CELL, y1: (best.y + 4.5) * C.CELL, cell: C.CELL }) : 'none'; })()`);
  console.log('spot', spot); if (spot === 'none') return;
  const S = JSON.parse(spot);
  await js(`__r62d.st.ws.send(JSON.stringify({ t: 'free', a: 'tp', x: ${S.x}, y: ${S.y0}, aim: 1.5708 })); true`); await sleep(1500);
  await js(`(() => { let n = 0; const step = () => { __r62d.aimTo(${S.x + 6}, ${S.y1}); if (n === 0) document.getElementById('game').dispatchEvent(new MouseEvent('mousedown', { button: 2, bubbles: true })); if (++n < 400) requestAnimationFrame(step); }; requestAnimationFrame(step); return true; })()`);
  await sleep(1500); await shot('w_before');
  await js(`document.getElementById('game').dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true })); setTimeout(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true })), 50); true`);
  await sleep(120); await shot('w_shot');
  console.log('shots', await js(`JSON.stringify(__r62d.st.myShots || [])`));
}
