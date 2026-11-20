// 1V1 in a hidden Firefox (he asked 2026-11-20: playtest it hard, how it looks and plays): the FUN MODES card, the
// lobby, the ban step, operator select, preparation and the action on a small map, with screenshots and page errors.
// Usage like tests/shoot.mjs: node tests/duelshots.mjs <port> <outdir> <gameUrl> [map]
import { writeFileSync, mkdirSync } from 'node:fs';
const [port, out, url, mapId] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const ws = new WebSocket(`ws://127.0.0.1:${port}/session`);
let id = 0; const waiting = new Map(), logs = [];
const call = (method, params) => new Promise((res, rej) => { const i = ++id; waiting.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.method === 'log.entryAdded' && (m.params.level === 'error' || m.params.type === 'javascript')) logs.push(m.params.text); if (m.id && waiting.has(m.id)) { const w = waiting.get(m.id); waiting.delete(m.id); m.type === 'error' ? w.rej(new Error(m.error + ': ' + m.message)) : w.res(m.result); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ctx;
const js0 = async expr => { const r = await call('script.evaluate', { expression: expr, target: { context: ctx }, awaitPromise: true }); if (r.exceptionDetails) throw new Error('js: ' + r.exceptionDetails.text); return r.result && r.result.value; };
const js = async expr => { for (let i = 0; ; i++) { try { return await js0(expr); } catch (e) { if (i > 4 || !/InvalidState|no such frame|discarded/.test(e.message)) throw e; await sleep(1500); } } };
const shot = async name => { const r = await call('browsingContext.captureScreenshot', { context: ctx }); writeFileSync(`${out}/${name}.png`, Buffer.from(r.data, 'base64')); console.log('shot', name); };
const until = async (expr, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await js(expr)) return true; } catch (e) {} await sleep(300); } console.log('TIMEOUT', expr); return false; };
const send = o => js(`__r62d.st.ws.send(${JSON.stringify(JSON.stringify(o))}); true`);
const nav = async () => { for (let i = 0; i < 5; i++) { try { await call('browsingContext.navigate', { context: ctx, url, wait: 'complete' }); return; } catch (e) { await sleep(2000); } } throw new Error('page did not load'); };
ws.onopen = async () => { try { await run(); } catch (e) { console.log('ERROR', e.message); } console.log('page errors:', logs.length ? '\n  ' + [...new Set(logs)].join('\n  ') : 'none'); process.exit(0); };
async function run() {
  await call('session.new', { capabilities: {} });
  await call('session.subscribe', { events: ['log.entryAdded'] });
  ctx = (await call('browsingContext.create', { type: 'tab' })).context;
  await call('browsingContext.setViewport', { context: ctx, viewport: { width: 1280, height: 720 } });
  await nav(); await sleep(1000);
  await js(`localStorage.setItem('r62d-name', 'Duelist'); true`);
  await nav(); await sleep(3000);
  await js(`document.getElementById('splash').click(); true`); await sleep(1500);
  await js(`document.querySelector('[data-tab="fun"]').click(); true`); await sleep(1200);
  await shot('01-fun');
  await js(`document.querySelector('#funGrid [data-mode="duel"]').click(); true`);
  await until(`__r62d.st.last && __r62d.st.last.md === 'duel'`);
  await sleep(1500); await shot('02-lobby');
  if (mapId) { await send({ t: 'lobby', a: 'map', id: mapId }); await sleep(1500); }
  console.log('lobby players', await js(`JSON.stringify(__r62d.st.last.players.map(p => [p.n, p.sq, p.b]))`), 'map', await js(`__r62d.st.last.mp`));
  await send({ t: 'lobby', a: 'start' });
  await until(`__r62d.st.last && __r62d.st.last.bq`, 15000); await sleep(800);
  await shot('03-ban');
  const mine = await js(`(() => { const s = __r62d.st.last; return JSON.stringify({ bq: s.bq, me: s.you, sq: (s.players.find(p => p.id === s.you) || {}).sq }); })()`); console.log('ban turn', mine);
  // ban by clicking the first card in the ban picker, if it is our turn
  await js(`(() => { const b = document.querySelector('#banPick button:not([disabled]), #banPick [data-op]'); if (b) b.click(); return !!b; })()`).then(v => console.log('clicked a ban card', v));
  await until(`!__r62d.st.last.bq`, 40000); await sleep(1200);
  await shot('04-select');
  console.log('bans', await js(`JSON.stringify(__r62d.st.last.bn)`));
  const all = JSON.parse(await js(`import('/shared/operators.js').then(m => JSON.stringify(Object.keys(m.OPERATORS).filter((o, i) => i % 7 === 3)))`));
  await send({ t: 'place' }); for (const op of all) await send({ t: 'pick', op }); await sleep(400); await send({ t: 'lock' });
  console.log('picked', await js(`__r62d.st.me && __r62d.st.me.op`));
  await until(`__r62d.st.me && __r62d.st.me.a`, 30000); await sleep(2500);
  await shot('05-prep');
  console.log('phase', await js(`__r62d.st.last.ph`), 'players', await js(`JSON.stringify(__r62d.st.last.players.map(p => [p.n, p.sq, p.op]))`));
  await sleep(9000); await shot('06-later');
  await js(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Tab', key: 'Tab', bubbles: true })); true`); await sleep(600);
  await shot('07-scoreboard');
  await js(`window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Tab', key: 'Tab', bubbles: true })); true`);
  await js(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM', key: 'm', bubbles: true })); true`); await sleep(800);
  await shot('08-map');
  await js(`window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyM', key: 'm', bubbles: true })); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM', key: 'm', bubbles: true })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyM', key: 'm', bubbles: true })); true`);
  await until(`__r62d.st.last.ph === 'action'`, 40000); await sleep(4000);
  await shot('09-action');
  await until(`__r62d.st.last.ph === 'roundEnd' || !__r62d.st.me.a`, 170000); await sleep(1500);
  await shot('10-roundend');
  await until(`__r62d.st.last.rd === 2 && __r62d.st.last.ph === 'select'`, 40000); await sleep(1000);
  await shot('11-round2');
  console.log('snap keys', await js(`Object.keys(__r62d.st.last).join(',')`));
}
