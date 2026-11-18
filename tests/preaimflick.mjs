// Phone pre-aim vs quick flicks (he found 2026-11-18): aim with the right stick, let go, then flick the move stick
// quickly to change direction. The crosshair must stay locked on the spot you left it (st.hold), not switch to turning
// with your movement until the aim stick is touched again. Both fire settings (rings, and the old FIRE buttons, where
// pushing the stick far out sprints). Usage like tests/thumbs.mjs: node tests/preaimflick.mjs <port> <outdir> <gameUrl>
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
const state = () => js(`JSON.stringify((() => { const s = __r62d.st; return { hold: !!s.hold, steer: !!s.steer }; })())`);
ws.onopen = async () => { try { await run(); } catch (e) { console.log('ERROR', e.message); } process.exit(0); };
async function run() {
  await call('session.new', { capabilities: {} });
  ctx = (await call('browsingContext.create', { type: 'tab' })).context;
  await call('browsingContext.setViewport', { context: ctx, viewport: { width: W, height: H } });
  let fails = 0;
  for (const mode of ['rings', 'buttons']) {
    await call('browsingContext.navigate', { context: ctx, url, wait: 'complete' }); await sleep(1200);
    await js(`localStorage.setItem('r62d-name', 'Thumbs'); localStorage.setItem('r62d-fire', '${mode}'); localStorage.removeItem('r62d-penv'); Element.prototype.requestFullscreen = () => Promise.reject(); true`);
    await call('browsingContext.navigate', { context: ctx, url, wait: 'complete' }); await sleep(3000);
    await js(`Element.prototype.requestFullscreen = () => Promise.reject(); true`);
    for (let i = 0; i < 6 && await js("!document.getElementById('splash').classList.contains('hidden')"); i++) { await act(drag('t', [[W / 2, H / 2], [W / 2, H / 2]], 30, 0)); await sleep(1200); }
    await js(`document.querySelector('[data-tab="free"]').click(); true`); await sleep(800);
    await js(`document.getElementById('freeGo').click(); true`); await sleep(9000);
    const L0 = [110, Math.round(H * 0.72)], R0 = [Math.round(W * 0.72), Math.round(H * 0.5)];
    // aim: right thumb drags a little to the right and lets go
    await act(drag('R', [R0, [R0[0] + 40, R0[1] - 10]], 200, 150)); await sleep(500);
    console.log(`${mode}: after aiming`, await state());
    // walk a bit, then quick flicks of the move stick in new directions (fast, far, thumb lifted between)
    await act(drag('L', [L0, [L0[0] + 45, L0[1]]], 120, 500)); console.log(`${mode}: walking`, await state());
    for (const [dx, dy] of [[0, -90], [-90, 0], [90, 60], [0, 90]]) { await act(drag('L', [L0, [L0[0] + dx, L0[1] + dy]], 35, 260)); await sleep(60); }
    await sleep(300); const s = JSON.parse(await state());
    const ok = s.hold && !s.steer; if (!ok) fails++;
    console.log(`${mode}: after 4 quick flicks`, JSON.stringify(s), ok ? 'OK (still locked on)' : 'FAIL (lock dropped)');
  }
  console.log(fails ? `FAIL ${fails}` : 'PASS');
}
