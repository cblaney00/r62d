// Sprint turns (he asked 2026-11-22, Chris S's first remark: too sharp): sprint up the screen, then sprint down it; the
// facing must turn steadily (a full about-turn in about 0.8 s (he chose 2026-11-26; was 0.4), never faster), and letting go of sprint swings back to the
// crosshair the same way; clicking mid-turn puts you on the crosshair at once. Usage: node tests/sprintturn.mjs <port> <gameUrl>
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
const nav = async () => { for (let i = 0; i < 5; i++) { try { await call('browsingContext.navigate', { context: ctx, url, wait: 'complete' }); return; } catch (e) { await sleep(2000); } } throw new Error('page did not load'); };
const key = (t, code) => js(`window.dispatchEvent(new KeyboardEvent('${t}', { code: '${code}', key: 'x', bubbles: true })); true`);
// press keys, then record st.aim every frame for ms: { turn: degrees from start to end, biggestStep: most degrees in one frame, took: s until within 2° of the end }
const rec = (ms, press = []) => js(`new Promise(res => { const s = __r62d.st, out = [], start = s.aim; for (const [t, c] of ${JSON.stringify(press)}) window.dispatchEvent(new KeyboardEvent(t, { code: c, key: "x", bubbles: true })); const t0 = performance.now(); out.push([0, start]);
  const step = () => { const t = performance.now() - t0; out.push([t, s.aim]); if (t < ${ms}) requestAnimationFrame(step); else {
    const D = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
    let fast = 0, took = 0; const end = out[out.length - 1][1];
    for (let i = 1; i < out.length; i++) { const dt = (out[i][0] - out[i - 1][0]) / 1000; if (dt > 0.004) fast = Math.max(fast, Math.abs(D(out[i][1], out[i - 1][1])) * 180 / Math.PI); /* biggest step in one frame: the game caps a frame at 0.05 s, so at 450°/s never more than ~23° */ }
    for (const [t, a] of out) if (Math.abs(D(a, end)) > 0.035) took = t / 1000;
    res(JSON.stringify({ turn: Math.round(Math.abs(D(end, out[0][1])) * 180 / Math.PI), biggestStep: Math.round(fast), took: +took.toFixed(2) })); } };
  requestAnimationFrame(step); })`).then(JSON.parse);
async function run() {
  await call('session.new', { capabilities: {} });
  ctx = (await call('browsingContext.create', { type: 'tab' })).context;
  await call('browsingContext.setViewport', { context: ctx, viewport: { width: 1280, height: 720 } });
  await nav(); await sleep(1000);
  await js(`localStorage.setItem('r62d-name', 'Runner'); true`); await nav(); await sleep(2500);
  await js(`document.getElementById('splash').click(); true`); await sleep(1500);
  await js(`document.querySelector('[data-tab="free"]').click(); true`); await sleep(800);
  await js(`document.getElementById('freeGo').click(); true`); for (let i = 0; i < 40; i++) { await sleep(500); try { if (await js('!!(window.__r62d && __r62d.st.map && __r62d.st.pred && __r62d.st.me && __r62d.st.me.a)')) break; } catch (e) {} } await sleep(2500);
  const sk = await js(`(() => { try { return JSON.parse(localStorage.getItem('r62d-binds') || 'null')?.sprint?.[0] || 'AltLeft'; } catch { return 'AltLeft'; } })()`);
  let fails = 0; const check = (name, ok, r) => { if (!ok) fails++; console.log(name, JSON.stringify(r), ok ? 'OK' : 'FAIL'); };
  await js(`__r62d.face(0); true`); await sleep(300); // aim to the right
  let r = await rec(2500, [['keydown', sk], ['keydown', 'KeyW']]); // sprint up: a quarter turn
  check('sprint up (90°)', r.turn >= 85 && r.biggestStep <= 24 && r.took >= 0.3, r); // (only "never faster": slow test browsers stretch it)
  r = await rec(3000, [['keyup', 'KeyW'], ['keydown', 'KeyS']]); // sprint down: an about-turn
  check('sprint down (180°)', r.turn >= 170 && r.biggestStep <= 24 && r.took >= 0.65, r);
  r = await rec(2500, [['keyup', 'KeyS'], ['keyup', sk]]); // let go: back to the crosshair (right)
  check('let go (back 90°)', r.turn >= 85 && r.biggestStep <= 24 && r.took >= 0.3, r);
  await key('keydown', sk); await key('keydown', 'KeyS'); await sleep(120); await key('keyup', 'KeyS'); await key('keyup', sk);
  await js(`document.getElementById('game').dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true })); true`); r = await rec(150);
  await js(`window.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true })); true`);
  const a = await js(`__r62d.st.aim`); check('shoot mid-turn: on the crosshair at once', Math.abs(a) < 0.05, { aim: +a.toFixed(3) });
  console.log(fails ? `FAIL ${fails}` : 'PASS');
}
