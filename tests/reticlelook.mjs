// Reticle highlight look (he asked 2026-11-26): free play, screenshots of the reticle still, mid-flick (glow + line), after, and with the highlight at 0%.
// Usage: node tests/reticlelook.mjs <port> <gameUrl> <outdir> (fast server, headless Firefox as insideabush; see docs/testing.md)
const [port, url, out] = process.argv.slice(2);
import { writeFileSync } from 'fs';
const ws = new WebSocket(`ws://127.0.0.1:${port}/session`);
let id = 0; const waiting = new Map();
const call = (method, params) => new Promise((res, rej) => { const i = ++id; waiting.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waiting.has(m.id)) { const w = waiting.get(m.id); waiting.delete(m.id); m.type === 'error' ? w.rej(new Error(m.error + ': ' + m.message)) : w.res(m.result); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ctx; const nav = async () => { for (let i = 0; i < 5; i++) { try { await call('browsingContext.navigate', { context: ctx, url, wait: 'complete' }); return; } catch (e) { await sleep(2000); } } };
const js = async expr => { const r = await call('script.evaluate', { expression: expr, target: { context: ctx }, awaitPromise: true }); if (r.exceptionDetails) throw new Error('js: ' + r.exceptionDetails.text); return r.result.value; };
const shot = async n => { const b = await js('JSON.stringify(__r62d.toScr(__r62d.st.pred.x, __r62d.st.pred.y))'); console.log('POS', n, b); const r = await call('browsingContext.captureScreenshot', { context: ctx }); writeFileSync(`${out}/${n}.png`, Buffer.from(r.data, 'base64')); };
ws.onopen = async () => { try { await run(); } catch (e) { console.log('ERROR', e.message); } process.exit(0); };
async function run() {
  await call('session.new', { capabilities: {} });
  ctx = (await call('browsingContext.create', { type: 'tab' })).context;
  await call('browsingContext.setViewport', { context: ctx, viewport: { width: 1280, height: 720 } });
  await nav(); await sleep(1000);
  await js(`localStorage.setItem('r62d-name', 'Looker'); true`); await nav(); await sleep(2500);
  await js(`document.getElementById('splash').click(); true`); await sleep(1500);
  await js(`document.querySelector('[data-tab="free"]').click(); true`); await sleep(800);
  await js(`document.getElementById('freeGo').click(); true`);
  for (let i = 0; i < 60; i++) { await sleep(500); if (await js('!!(window.__r62d && __r62d.st.map && __r62d.st.pred && __r62d.st.me && __r62d.st.me.a)')) break; }
  await sleep(4000);
  console.log('errors?', await js(`String(window.__errs || '')`));
  await js(`__r62d.face(0.4); true`); await sleep(1500); console.log('stillhelp', await js('JSON.stringify(__r62d.xhHelp)')); await shot('still');
  // spin the crosshair fast round you and shoot mid-spin
  await js(`(() => { let a = 0.4, t0 = performance.now(); const f = () => { a += 0.45; __r62d.face(a); if (performance.now() - t0 < 900) requestAnimationFrame(f); }; requestAnimationFrame(f); return true; })()`);
  await sleep(450); await shot('moving'); console.log('help', await js('JSON.stringify([__r62d.xhHelp, __r62d.xhOpt(), __r62d.scr(), __r62d.st.xhRan])'));
  await sleep(1200); await shot('after');
  await js(`document.getElementById('xhHi').value = 0; true`); await js(`__r62d.face(0.4); true`); await sleep(500); await shot('off');
  console.log('done');
}
