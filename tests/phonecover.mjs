// 1V1 in a hidden Firefox (he asked 2026-11-20: playtest it hard, how it looks and plays): the FUN MODES card, the
// lobby, the ban step, operator select, preparation and the action on a small map, with screenshots and page errors.
// Usage like tests/shoot.mjs: node tests/duelshots.mjs <port> <outdir> <gameUrl> [map]
import { writeFileSync, mkdirSync } from 'node:fs';
const [port, out, url] = process.argv.slice(2);
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
// Phones (he asked 2026-11-20): an enemy you can see must not stay hidden under the thumb buttons. Free play at 914x412:
// a held bot is put where each stick and the right-hand button group sit on screen; after a moment it must be clear.
// Usage like tests/thumbs.mjs (phone Firefox profile): node tests/phonecover.mjs <port> <outdir> <gameUrl>
const tapAt = async (x, y) => { await call('input.performActions', { context: ctx, actions: [{ type: 'pointer', id: 't', parameters: { pointerType: 'touch' }, actions: [{ type: 'pointerMove', x, y, origin: 'viewport' }, { type: 'pointerDown', button: 0 }, { type: 'pointerUp', button: 0 }] }] }); await call('input.releaseActions', { context: ctx }); };
const tapSel = async sel => { const c = JSON.parse(await js(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return JSON.stringify([Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)]); })()`)); await tapAt(c[0], c[1]); };
async function run() {
  await call('session.new', { capabilities: {} });
  await call('session.subscribe', { events: ['log.entryAdded'] });
  ctx = (await call('browsingContext.create', { type: 'tab' })).context;
  await call('browsingContext.setViewport', { context: ctx, viewport: { width: 914, height: 412 } });
  await nav(); await sleep(1500);
  await js(`localStorage.setItem('r62d-name', 'Cover'); true`); await nav(); await sleep(3000);
  await js("document.getElementById('splash').click(); true"); await until(`document.getElementById('loading').classList.contains('hidden')`, 60000); await sleep(1500);
  await js("document.querySelector('[data-tab=\"free\"]').click(); true"); await sleep(800); await js("document.getElementById('freeGo').click(); true");
  await until(`__r62d.st.me && __r62d.st.me.a && __r62d.st.map`, 60000); await sleep(3000);
  await js(`__r62d.st.ws.send(JSON.stringify({ t: 'free', a: 'dummy' })); true`); await sleep(1500);
  const foe = await js(`(() => { const s = __r62d.st, me = s.last.players.find(p => p.id === s.last.you); const f = s.last.players.find(p => p.sq !== me.sq && p.a); return f ? f.id : null; })()`);
  console.log('enemy bot', foe);
  const room = JSON.parse(await js(`JSON.stringify(__r62d.st.map.rooms.filter(r => r.fl === 0).sort((a, b) => b.w * b.h - a.w * a.h).map(r => ({ x: (r.x + r.w / 2) * 16, y: (r.y + r.h / 2) * 16, n: r.name, w: r.w, h: r.h }))[0])`));
  console.log('room', JSON.stringify(room)); await js(`__r62d.st.ws.send(JSON.stringify({ t: 'free', a: 'tp', x: ${room.x}, y: ${room.y}, aim: Math.PI / 2 })); true`); await sleep(2500);
  let bad = 0;
  await js(`__r62d.st.ws.send(JSON.stringify({ t: 'free', a: 'tp', x: ${room.x}, y: ${room.y} })); true`); await sleep(2000);
  for (const [name, sel] of [['left stick', '#tsLeft'], ['right stick', '#tsRight'], ['RELOAD', '#touchUI [data-id="reload"]'], ['ACTION', '#touchUI [data-id="use"]'], ['CROUCH', '#touchUI [data-id="crouch"]'], ['top row', '#touchUI [data-id="map"]']]) {
    // an enemy you can see (st.testFoe: counted as one by the camera) put where that button sits on screen
    await js(`(() => { const R = __r62d, s = R.st, b = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(), w = R.pick(b.left + b.width / 2, b.top + b.height / 2); s.testFoe = { x: w.x, y: w.y }; return true; })()`);
    await sleep(1500);
    const v = JSON.parse(await js(`(() => { const R = __r62d, s = R.st, q = R.toScr(s.testFoe.x, s.testFoe.y), sh = R.covers(), m = R.toScr(s.pred.x, s.pred.y);
      const under = pt => sh.some(c => c.c ? Math.hypot(pt.x - c.c[0], pt.y - c.c[1]) < c.c[2] : pt.x > c.r[0] && pt.x < c.r[2] && pt.y > c.r[1] && pt.y < c.r[3]);
      return JSON.stringify({ me: [Math.round(m.x), Math.round(m.y)], meUnder: under(m), foe: [Math.round(q.x), Math.round(q.y)], under: under(q), off: s.coverOff && [Math.round(s.coverOff.x), Math.round(s.coverOff.y)] }); })()`));
    const ok = !v.under && !v.meUnder; if (!ok) bad++;
    console.log(name.padEnd(12), JSON.stringify(v), ok ? 'OK' : 'STILL UNDER');
    await shot('cover-' + name.replace(/ /g, ''));
    await js('__r62d.st.testFoe = null; true'); await sleep(2500); // (the camera goes back)
    const back = await js('JSON.stringify(__r62d.st.coverOff && [Math.round(__r62d.st.coverOff.x), Math.round(__r62d.st.coverOff.y)])'); console.log('   once it has gone, the slide is back to', back);
  }
  console.log(bad ? `FAIL ${bad}` : 'PASS');
}
