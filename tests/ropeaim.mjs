// Aiming from a rope through a window (he asked 2026-11-24: with the Saker LR and its 2x scope his shots seemed to go
// right of the reticle). Hangs you level with a window, aimed in with the 2x scope; puts a still enemy at spots inside the
// room (straight in, left, right, near, far); puts the crosshair on where the enemy's head (then chest) is DRAWN and
// fires. Each shot must pass through the enemy's real body (the server's 'shot' event gives where it ended) and the head
// aims must count as head aims (the sent aim point within HEAD_AIM of them). Then again leaning left and right.
// Usage: node tests/ropeaim.mjs <port> <gameUrl>   (server with R62D_FAST=1)
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
const send = m => js(`__r62d.st.ws.send(${JSON.stringify(JSON.stringify(m))}); true`);
const key = (t, code) => js(`window.dispatchEvent(new KeyboardEvent('${t}', { code: '${code}', key: 'x', bubbles: true })); true`);

async function run() {
  await call('session.new', { capabilities: {} });
  ctx = (await call('browsingContext.create', { type: 'tab' })).context;
  await call('browsingContext.setViewport', { context: ctx, viewport: { width: 1600, height: 900 } });
  await nav(); await sleep(1000);
  await js(`localStorage.setItem('r62d-name', 'Roper'); localStorage.setItem('r62d-free', JSON.stringify({ map: '${process.env.MAP || 'harbor'}', bots: 0, level: 2 })); true`); await nav(); await sleep(2500);
  await js(`document.getElementById('splash').click(); true`); await sleep(1500);
  await js(`document.querySelector('[data-tab="free"]').click(); true`); await sleep(800);
  await js(`document.getElementById('freeGo').click(); true`); for (let i = 0; i < 40; i++) { await sleep(500); try { if (await js('!!(window.__r62d && __r62d.st.map && __r62d.st.pred && __r62d.st.me && __r62d.st.me.a)')) break; } catch (e) {} } await sleep(2500);
  // every 'shot' event of yours, with where you stood
  await js(`(() => { const s = __r62d.st; s._shots = []; s.ws.addEventListener('message', ev => { try { const m = JSON.parse(ev.data); if (!m.ev) return; for (const e of m.ev) if (e.e === 'shot' && e.id === m.you) s._shots.push({ ...e, me: m.players.find(p => p.id === m.you) }); } catch {} }); return true; })()`);
  await js(`(() => { const s = __r62d.st, w = s.ws, o = w.send.bind(w); w.send = d => { try { const m = JSON.parse(d); if (m.t === 'input' && m.k && m.k.fire) s._sent = { ax: m.ax, ay: m.ay, a: m.a }; } catch {} return o(d); }; return true; })()`); // what your clicks sent
  await send({ t: 'free', a: 'god', on: 1 }); await send({ t: 'free', a: 'botsFire', on: 0 });
  await send({ t: 'free', a: 'pick', op: 'nail' }); await sleep(600);
  await send({ t: 'free', a: 'gun', w: 'saker' }); await sleep(300);
  await send({ t: 'free', a: 'att', w: 'saker', s: 'sight', v: process.env.SIGHT || 'scope' }); await sleep(600);
  // a window rope on the first floor with room inside
  const R = JSON.parse(await js(`JSON.stringify(__r62d.st.map.ropes.filter(r => r.inside && r.lvl === 1).map(r => ({ i: r.i, cells: r.cells, out: r.out, hang: r.hang, inside: r.inside, tx: r.tx, ty: r.ty })))`));
  const pick = R[+(process.env.ROPE || 0) % R.length]; console.log('rope', pick.i, 'of', R.length);
  const OPEN = await js(`import('/shared/constants.js').then(c => c.T.OPEN)`);
  if (!process.env.BOARDS) await send({ t: 'free', a: 'tile', ks: pick.cells, v: OPEN }); // the window's boards broken already (BOARDS=1 keeps them)
  if (process.env.FOOT) await send({ t: 'free', a: 'tp', x: Math.round(pick.inside.x), y: Math.round(pick.inside.y), aim: pick.out + Math.PI }); // FOOT=1: the same shots standing inside instead (targets further in)
  else await send({ t: 'free', a: 'hang', r: pick.i, h: 0.5 });
  await sleep(2500);
  let did = null;
  for (let i = 0; i < 12 && !did; i++) { // a dummy without a shield (the operator is random)
    await send({ t: 'free', a: 'clearBots' }); await send({ t: 'free', a: 'dummy' }); await sleep(900);
    did = await js(`(q => q && !q.ri ? q.id : null)(__r62d.st.last.players.find(p => p.tm !== __r62d.st.me.tm))`);
  }
  console.log('me', await js(`JSON.stringify({ op: __r62d.st.me.op, w: __r62d.st.me.w, aa: __r62d.st.me.aa, ro: __r62d.st.me.ro })`), 'dummy', did);
  await js(`__r62d.st.adsTog = true; true`); await sleep(1500);
  const inX = -Math.cos(pick.out), inY = -Math.sin(pick.out); // into the building
  const spots = [];
  for (const d of process.env.FOOT ? [90, 160, 260] : [40, 90, 160]) for (const s of [-50, 0, 50]) if (d > 40 || !s) spots.push({ d, s }); // (near and off to the side the window's edge is in the way)
  let fails = 0, worst = 0;
  const leans = (process.env.LEANS || '0,-1,1').split(',').map(Number);
  for (const lean of leans) {
    if (lean) { await key('keydown', lean < 0 ? 'KeyQ' : 'KeyE'); await sleep(600); }
    for (const sp of spots) for (const part of ['head', 'chest']) {
      for (let i = 0; i < 20 && !(await js(`!!(__r62d.st.last.players.find(p => p.id === ${JSON.stringify(did)}) || {}).a`)); i++) await sleep(300); // (a dummy that went down comes back after 3 s)
      const tx = pick.hang.x + inX * sp.d + pick.tx * sp.s, ty = pick.hang.y + inY * sp.d + pick.ty * sp.s;
      await send({ t: 'free', a: 'tp', id: did, x: Math.round(tx), y: Math.round(ty), aim: Math.atan2(-inY, -inX), hold: 1 }); await sleep(500);
      const z = part === 'head' ? 0.49 : 0.37; // (main.js: head zones at 0.49, rings at 0.37)
      // where that part of them is drawn (sprites.js: the wall rule from their base, plus their own height)
      // keep the crosshair on that spot every frame until the shot is out, as a player's hand would (a lean glides the camera)
      const aimed = JSON.parse(await js(`import('/js/look.js').then(L => { const s = __r62d.st, id = ${JSON.stringify(did)}; let out = null; s._aimOn = true; const f = () => { const q = s.last.players.find(p => p.id === id); if (q && q.a && isFinite(q.x)) { const [bx, by] = L.liftOf(q.x, q.y, 0), [ux, uy] = L.liftBody(q.x, q.y, ${z}); __r62d.aimTo(q.x + bx + ux, q.y + by + uy); out = out || { x: q.x, y: q.y }; } if (s._aimOn) requestAnimationFrame(f); }; f(); return JSON.stringify(out); })`));
      await sleep(350);
      const drawn = await js(`__r62d.st.rings.some(r => r.id === ${JSON.stringify(did)})`);
      if (!drawn) { console.log(`lean ${lean} ${part} d${sp.d} s${sp.s}: not in your sight (not drawn), skipped`); if (process.env.SHOTS) { const r = await call('browsingContext.captureScreenshot', { context: ctx }); (await import('node:fs')).writeFileSync(`${process.env.SHOTS}/hidden-${lean}-${sp.d}-${sp.s}.png`, Buffer.from(r.data, 'base64')); } continue; }
      const n0 = await js(`__r62d.st._shots.length`); let shot = null;
      for (let k = 0; k < 4 && !shot; k++) { // (a click can land while the bolt is still being worked)
        await js(`document.getElementById('game').dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true })); true`); await sleep(120);
        await js(`window.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true })); true`); await sleep(500);
        shot = JSON.parse(await js(`JSON.stringify(__r62d.st._shots[${n0}] || null)`));
        if (!shot) await sleep(600);
      }
      await js(`__r62d.st._aimOn = false; true`);
      const sent = JSON.parse(await js(`JSON.stringify(__r62d.st._sent || null)`));
      if (!shot) { console.log('no shot', sp, part); fails++; continue; }
      // the bullet line: from your (leaned) body toward where it ended; how far it passed from their real middle
      const lo = shot.me.le || 0, la = (shot.me.ag || 0) + (lo > 0 ? Math.PI / 2 : -Math.PI / 2), ex = shot.me.x + Math.cos(la) * Math.abs(lo), ey = shot.me.y + Math.sin(la) * Math.abs(lo); // the leaned upper body (physics leanPoint)
      const a = Math.atan2(shot.y2 - ey, shot.x2 - ex);
      const L = Math.hypot(aimed.x - ex, aimed.y - ey), along = (aimed.x - ex) * Math.cos(a) + (aimed.y - ey) * Math.sin(a);
      const miss = (aimed.x - ex) * Math.sin(a) - (aimed.y - ey) * Math.cos(a); // + = the shot passed to their right (as you face them)
      const headOk = part !== 'head' || !sent || Math.hypot(sent.ax - aimed.x, sent.ay - aimed.y) <= 3; // HEAD_AIM: counts as a head aim
      const ok = Math.abs(miss) < 1.5 && headOk; // (positions travel in tenths of a pixel)
      worst = Math.max(worst, Math.abs(miss));
      if (!ok) fails++;
      console.log(`lean ${lean} ${part} d${sp.d} s${sp.s}: hit=${shot.k}${part === 'head' ? (headOk ? ' head-aim' : ' NOT-head-aim') + (sent ? ' ' + Math.hypot(sent.ax - aimed.x, sent.ay - aimed.y).toFixed(2) : '') : ''} miss=${miss.toFixed(2)}px dist=${L.toFixed(0)} ${ok ? 'OK' : 'FAIL'}`);
      await sleep(Math.max(0, 900)); // the bolt
    }
    if (lean) { await key('keyup', lean < 0 ? 'KeyQ' : 'KeyE'); await sleep(600); }
  }
  console.log('worst miss', worst.toFixed(2), 'px');
  console.log(fails ? `FAIL ${fails}` : 'PASS');
}
