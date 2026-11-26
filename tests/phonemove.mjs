// The phone move stick (2026-11-26, a player found it slow): a thumb pushed at an angle walks that exact way (not
// rounded to 8), a push past the first third runs, and moving starts quickly. Setup as tests/thumbs.mjs (docs/testing.md):
// node tests/phonemove.mjs <port> <outdir> <gameUrl>
const [port, , url] = process.argv.slice(2);
const ws = new WebSocket(`ws://127.0.0.1:${port}/session`);
let id = 0; const waiting = new Map();
const call = (method, params) => new Promise((res, rej) => { const i = ++id; waiting.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waiting.has(m.id)) { const w = waiting.get(m.id); waiting.delete(m.id); m.type === 'error' ? w.rej(new Error(m.error + ': ' + m.message)) : w.res(m.result); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ctx; const W = 914, H = 412;
const js = async expr => { const r = await call('script.evaluate', { expression: expr, target: { context: ctx }, awaitPromise: true }); if (r.exceptionDetails) throw new Error('js: ' + r.exceptionDetails.text); return r.result && r.result.value; };
const drag = (pid, pts, dur, hold) => ({ type: 'pointer', id: pid, parameters: { pointerType: 'touch' }, actions: [{ type: 'pointerMove', x: pts[0][0], y: pts[0][1], origin: 'viewport' }, { type: 'pointerDown', button: 0 }, ...pts.slice(1).map(q => ({ type: 'pointerMove', x: q[0], y: q[1], duration: dur, origin: 'viewport' })), { type: 'pause', duration: hold }, { type: 'pointerUp', button: 0 }] });
const act = async (...a) => { await call('input.performActions', { context: ctx, actions: a }); await call('input.releaseActions', { context: ctx }); };
const pos = () => js(`JSON.stringify((() => { const p = __r62d.st.pred || __r62d.st.me; return { x: p.x, y: p.y }; })())`).then(JSON.parse);
ws.onopen = async () => { try { await run(); } catch (e) { console.log('ERROR', e.message); } process.exit(0); };
async function run() {
  await call('session.new', { capabilities: {} });
  ctx = (await call('browsingContext.create', { type: 'tab' })).context;
  await call('browsingContext.setViewport', { context: ctx, viewport: { width: W, height: H } });
  await call('browsingContext.navigate', { context: ctx, url, wait: 'complete' }); await sleep(1200);
  await js(`localStorage.setItem('r62d-name', 'Thumbs'); localStorage.setItem('r62d-ctrlreset-1', '1'); localStorage.setItem('r62d-fire', 'rings'); localStorage.removeItem('r62d-penv'); Element.prototype.requestFullscreen = () => Promise.reject(); true`);
  await call('browsingContext.navigate', { context: ctx, url, wait: 'complete' }); await sleep(3000);
  await js(`Element.prototype.requestFullscreen = () => Promise.reject(); true`);
  for (let i = 0; i < 6 && await js("!document.getElementById('splash').classList.contains('hidden')"); i++) { await act(drag('t', [[W / 2, H / 2], [W / 2, H / 2]], 30, 0)); await sleep(1200); }
  await js(`document.querySelector('[data-tab="free"]').click(); true`); await sleep(800);
  await js(`document.getElementById('freeGo').click(); true`); await sleep(9000);
  const L0 = JSON.parse(await js(`(() => { const r = document.getElementById('tsLeft').getBoundingClientRect(); return JSON.stringify([Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)]); })()`));
  let fails = 0; const H0 = await pos();
  const home = async () => { await js(`__r62d.st.ws.send(JSON.stringify({ t: 'free', a: 'tp', x: ${H0.x}, y: ${H0.y} })); true`); await sleep(500); };
  // [angle (deg, screen), push px, what we expect]
  for (const [ang, push, want] of [[30, 20, 'walk'], [30, 50, 'run'], [-60, 50, 'run'], [160, 60, 'run']]) {
    await home(); // the same spot each time
    const a = ang * Math.PI / 180; // sample the body's speed and way mid-push (at full pace by then)
    const go = act(drag('L', [L0, [L0[0] + Math.cos(a) * push, L0[1] + Math.sin(a) * push]], 60, 1000));
    await sleep(600); const v = JSON.parse(await js(`JSON.stringify({ vx: __r62d.st.pred.vx, vy: __r62d.st.pred.vy, rot: __r62d.st.rot || 0 })`)); await go;
    const spd = Math.hypot(v.vx, v.vy), got = Math.atan2(v.vy, v.vx) * 180 / Math.PI, wantA = ang + v.rot * 180 / Math.PI, err = Math.abs(((got - wantA) % 360 + 540) % 360 - 180);
    const kind = spd < 70 ? 'walk' : 'run'; // (px/s: walking is a good deal slower than running)
    const ok = spd > 5 && err < 6 && kind === want; if (!ok) fails++;
    console.log(`push ${push}px at ${ang}° (want ${want}): ${spd.toFixed(0)} px/s (${kind}) at ${got.toFixed(1)}°`, ok ? 'OK' : 'FAIL');
    await sleep(400);
  }
  await home();
  // starts quickly: 120 ms after the thumb lands and pushes, the body is already moving
  const p0 = await pos(); await act(drag('L', [L0, [L0[0] + 45, L0[1]]], 40, 80)); const p1 = await pos();
  console.log(`after ~120 ms of pushing: moved ${Math.hypot(p1.x - p0.x, p1.y - p0.y).toFixed(1)} px`);
  console.log(fails ? `FAIL ${fails}` : 'PASS');
}
