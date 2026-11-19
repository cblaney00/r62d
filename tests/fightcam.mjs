// The camera in a fight (he asked 2026-11-18: the view zoomed, slid and jolted while he shot someone just after climbing
// in through a window). Free play, standing still: sweep the aim round past doorways for 3 s, once without shooting and
// once holding fire, and measure how much the view changes size and how fast the camera moves. In a fight the view must
// keep its size and move gently. Also: just after a window climb-in (st.swoopTail), shooting ends the glide quickly.
// Usage like tests/shoot.mjs: node tests/fightcam.mjs <port> <gameUrl>
const [port, url] = process.argv.slice(2);
const ws = new WebSocket(`ws://127.0.0.1:${port}/session`);
let id = 0; const waiting = new Map();
const call = (method, params) => new Promise((res, rej) => { const i = ++id; waiting.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waiting.has(m.id)) { const w = waiting.get(m.id); waiting.delete(m.id); m.type === 'error' ? w.rej(new Error(m.error + ': ' + m.message)) : w.res(m.result); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ctx;
const js0 = async expr => { const r = await call('script.evaluate', { expression: expr, target: { context: ctx }, awaitPromise: true }); if (r.exceptionDetails) throw new Error('js: ' + r.exceptionDetails.text); return r.result && r.result.value; };
const js = async expr => { for (let i = 0; ; i++) { try { return await js0(expr); } catch (e) { if (i > 4 || !/InvalidState|no such frame|discarded/.test(e.message)) throw e; await sleep(1500); } } };
ws.onopen = async () => { try { await run(); } catch (e) { console.log('ERROR', e.message); } process.exit(0); };
// sweep the aim round the player for ms, firing or not; returns { size: biggest/smallest view height, speed: average camera travel px/s, shots }
const sweep = (fire, ms) => js(`new Promise(res => { const R = __r62d, s = R.st, p = { x: s.pred.x, y: s.pred.y }, t0 = performance.now(); let lo = 1e9, hi = 0, sp = 0, last = null, base = null; const sps = [], smp = [];
  s.lockAsked = true; const g = document.getElementById('game'); if (${fire}) g.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
  const step = () => { const t = performance.now() - t0, a = t / ${ms} * Math.PI * 2; R.aimTo(p.x + Math.cos(a) * 140, p.y + Math.sin(a) * 140);
    if (${fire} && s.me && s.me.am === 0) { /* keep the trigger on: free play refills */ }
    if (t > 400) { lo = Math.min(lo, s.viewH); hi = Math.max(hi, s.viewH); if (last) { const d = Math.hypot(s.cam.x - last.x, s.cam.y - last.y) / Math.max(0.001, (t - last.t) / 1000); sp = Math.max(sp, d); sps.push(d); } }
    last = { x: s.cam.x, y: s.cam.y, t }; if (t > 400) smp.push(last);
    if (t < ${ms}) requestAnimationFrame(step); else { if (${fire}) { g.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true })); window.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true })); } sps.sort((a, b) => a - b); sp = 0; for (let i = 1; i < smp.length; i++) sp += Math.hypot(smp[i].x - smp[i - 1].x, smp[i].y - smp[i - 1].y); sp /= Math.max(0.1, (smp[smp.length - 1].t - smp[0].t) / 1000); res(JSON.stringify({ size: +(hi / lo).toFixed(3), speed: Math.round(sp), p50: Math.round(sps[sps.length >> 1]), p90: Math.round(sps[Math.floor(sps.length * 0.9)]), fk: +(s.fightK || 0).toFixed(2) })); } };
  requestAnimationFrame(step); })`).then(JSON.parse);
const nav = async () => { for (let i = 0; i < 5; i++) { try { await call('browsingContext.navigate', { context: ctx, url, wait: 'complete' }); return; } catch (e) { await sleep(2000); } } throw new Error('page did not load'); };
async function run() {
  await call('session.new', { capabilities: {} });
  ctx = (await call('browsingContext.create', { type: 'tab' })).context;
  await call('browsingContext.setViewport', { context: ctx, viewport: { width: 1280, height: 720 } });
  await nav(); await sleep(1000);
  await js(`localStorage.setItem('r62d-name', 'Cam'); true`);
  await nav(); await sleep(3000);
  await js(`document.getElementById('splash').click(); true`); await sleep(1500);
  await js(`document.querySelector('[data-tab="free"]').click(); true`); await sleep(800);
  await js(`document.getElementById('freeGo').click(); true`); for (let i = 0; i < 40; i++) { await sleep(500); try { if (await js('!!(window.__r62d && __r62d.st.map && __r62d.st.pred && __r62d.st.me && __r62d.st.me.a)')) break; } catch (e) {} } await sleep(1500);
  let fails = 0;
  // spots: the middle of rooms with doorways round them, on each map's first floor
  const spots = JSON.parse(await js(`JSON.stringify(__r62d.st.map.rooms.filter(r => r.fl === 0 && r.w >= 6 && r.h >= 6).slice(0, 4).map(r => ({ x: (r.x + r.w / 2) * 16, y: (r.y + r.h / 2) * 16, n: r.name })))`));
  for (const sp of spots) {
    await js(`__r62d.st.ws.send(JSON.stringify({ t: 'free', a: 'tp', x: ${sp.x}, y: ${sp.y} })); true`); await sleep(1500);
    await js(`__r62d.st.fightUntil = 0; __r62d.st.fightK = 0; true`); await sleep(1500); // calm first
    const calm = await sweep(false, 3000);
    const fight = await sweep(true, 3000);
    const ok = fight.size <= 1.04 && fight.speed <= Math.max(300, calm.speed * 0.8);
    if (!ok) fails++;
    console.log(sp.n, "calm", JSON.stringify(calm), "fight", JSON.stringify(fight), ok ? "OK" : "FAIL");
  }
  // just after a window climb-in: shooting cuts the glide short
  const tail = await js(`new Promise(res => { const s = __r62d.st, n = performance.now() / 1000; s.swoopTail = n + 0.6; s.fightUntil = n + 2.5; requestAnimationFrame(() => requestAnimationFrame(() => res(+(s.swoopTail - performance.now() / 1000).toFixed(2)))); })`);
  const okT = tail <= 0.26; if (!okT) fails++;
  console.log(`after a climb-in, shooting leaves ${tail}s of glide`, okT ? 'OK' : 'FAIL');
  console.log(fails ? `FAIL ${fails}` : 'PASS');
}
