// Frame rate on Harbor's lobby stairs (he found 2026-11-26: laggy shooting up them): you on the steps on 1F, the view
// up the stairs showing, idle / firing / with that view switched off. Run it on the graphics card in headless gamescope
// (docs/performance.md). Usage: node tests/stairlag.mjs <port> <url> <outdir> (fast server); ME= / EN= cells.
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
const pf = () => js(`JSON.stringify((() => { const P = __r62d.PF, o = {}; for (const k in P) o[k] = P[k]; return o; })())`).then(JSON.parse);
const diff = (a, b, ms) => { const n = b.frames - a.frames, o = { fps: Math.round(n / (ms / 1000)) }; for (const k in b) if (k !== 'frames') { const v = (b[k] - (a[k] || 0)) / Math.max(1, n); if (v > 0.05) o[k] = +v.toFixed(2); } return o; };
async function run() {
  await call('session.new', { capabilities: {} });
  ctx = (await call('browsingContext.create', { type: 'tab' })).context;
  await call('browsingContext.setViewport', { context: ctx, viewport: { width: 1600, height: 900 } });
  await nav(); await sleep(1000);
  await js(`localStorage.setItem('r62d-name', 'Stairs'); true`); await nav(); await sleep(2500);
  await js(`document.getElementById('splash').click(); true`); await sleep(1500);
  await js(`document.querySelector('[data-tab="free"]').click(); true`); await sleep(800);
  await js(`document.querySelector('#freeMaps [data-id="harbor"]').click(); true`); await sleep(300);
  await js(`document.getElementById('freeGo').click(); true`);
  for (let i = 0; i < 80; i++) { await sleep(500); if (await js('!!(window.__r62d && __r62d.st.map && __r62d.st.pred && __r62d.st.me && __r62d.st.me.a && __r62d.st.map.id === "harbor")')) break; }
  await sleep(3000);
  const C = 16, [MX, MY] = (process.env.ME || '57.5,104').split(',').map(Number), [EX, EY] = (process.env.EN || '160.5,72').split(',').map(Number);
  const foe = await js(`(() => { const s = __r62d.st, me = s.me; const f = s.last.players.find(p => p.tm !== me.tm && p.a); return f ? f.id : 0; })()`);
  console.log('foe', foe);
  await js(`__r62d.st.ws.send(JSON.stringify({ t: 'free', a: 'tp', x: ${MX * C}, y: ${MY * C}, aim: -1.5708 })); true`);
  await js(`(() => { for (let id = 1; id < 30; id++) if (id !== __r62d.st.id) __r62d.st.ws.send(JSON.stringify({ t: 'free', a: 'tp', id, x: ${EX * C} + (id % 3) * 10, y: ${EY * C}, hold: 1 })); return true; })()`);
  await sleep(2000);
  await js(`(() => { const step = () => { __r62d.aimTo(${MX * C}, ${(MY - 9) * C}); requestAnimationFrame(step); }; requestAnimationFrame(step); return true; })()`);
  await sleep(1500); await shot('stair_idle');
  let a = await pf(); await sleep(4000); let b = await pf(); console.log('idle', JSON.stringify(diff(a, b, 4000)));
  console.log('pip', await js(`JSON.stringify(__r62d.st.pip ? { s: __r62d.st.pip.s, up: __r62d.st.pip.up } : null)`), 'floor', await js(`String(__r62d.st.me.fl ?? '')`));
  await js(`document.getElementById('game').dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true })); true`);
  a = await pf(); await sleep(1500); await shot('stair_fire'); await sleep(2500); b = await pf();
  await js(`window.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true })); true`);
  console.log('firing', JSON.stringify(diff(a, b, 4000)));
  for (const mx of [0]) { await sleep(500); a = await pf(); await sleep(3000); b = await pf(); console.log('cap', mx, 'px', await js('__r62d.st.stairPx'), JSON.stringify(diff(a, b, 3000))); }
  await js(`__r62d.fxOff().add('pip'); true`); a = await pf(); await sleep(4000); b = await pf(); console.log('idle, stair view off', JSON.stringify(diff(a, b, 4000)));
  await js(`__r62d.fxOff().delete('pip'); true`); a = await pf(); await sleep(4000); b = await pf(); console.log('idle again, on', JSON.stringify(diff(a, b, 4000)));
}
