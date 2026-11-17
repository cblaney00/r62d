// Plays the game "as a phone": real touch events (WebDriver BiDi touch pointers, two thumbs at once) at a phone's
// screen size, in free play against bots. Prints what happened after each move and saves screenshots.
// Usage (Firefox as insideabush with --remote-debugging-port, phone user agent, touch events on; see docs/testing.md):
//   node tests/thumbs.mjs <port> <outdir> <gameUrl> [width height]
import fs from 'node:fs';
const [port, outDir, url, W = 914, H = 412] = process.argv.slice(2);
const ws = new WebSocket(`ws://127.0.0.1:${port}/session`);
let id = 0; const waiting = new Map(), logs = [];
const call = (method, params) => new Promise((res, rej) => { const i = ++id; waiting.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = ev => {
  const m = JSON.parse(ev.data);
  if (m.id && waiting.has(m.id)) { const w = waiting.get(m.id); waiting.delete(m.id); m.type === 'error' ? w.rej(new Error(m.error + ': ' + m.message)) : w.res(m.result); }
  else if (m.method === 'log.entryAdded' && m.params.level !== 'debug') logs.push(`[${m.params.level}] ${m.params.text}`);
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ctx;
const js = async expr => { const r = await call('script.evaluate', { expression: expr, target: { context: ctx }, awaitPromise: true }); if (r.exceptionDetails) throw new Error('js: ' + r.exceptionDetails.text); return r.result && r.result.value; };
const shot = async name => { const r = await call('browsingContext.captureScreenshot', { context: ctx }); fs.writeFileSync(`${outDir}/${name}.png`, Buffer.from(r.data, 'base64')); console.log('  [shot ' + name + ']'); };
const centre = async sel => JSON.parse(await js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return 'null'; const r = e.getBoundingClientRect(); return JSON.stringify(r.width ? [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)] : null); })()`));
// one finger: a list of [x, y, ms-to-get-there] points, pressed from the first to the last
const finger = (name, pts, holdMs = 0, delayMs = 0) => { // delayMs: this thumb lands that much later (real thumbs never land together)
  const a = [...(delayMs ? [{ type: 'pause', duration: delayMs }] : []), { type: 'pointerMove', x: pts[0][0], y: pts[0][1], origin: 'viewport' }, { type: 'pointerDown', button: 0 }];
  for (const p of pts.slice(1)) a.push({ type: 'pointerMove', x: Math.round(p[0]), y: Math.round(p[1]), duration: p[2] || 100, origin: 'viewport' });
  if (holdMs) a.push({ type: 'pause', duration: holdMs });
  a.push({ type: 'pointerUp', button: 0 });
  return { type: 'pointer', id: name, parameters: { pointerType: 'touch' }, actions: a };
};
const touch = async (...fingers) => { await call('input.performActions', { context: ctx, actions: fingers }); await call('input.releaseActions', { context: ctx }); };
const tap = async sel => { const c = await centre(sel); if (!c || c[1] > H || c[0] > W) { console.log('  cannot tap (not visible):', sel); return false; } await touch(finger('t', [c, [c[0], c[1], 60]])); return true; };
const state = async () => JSON.parse(await js(`(() => { const s = window.__r62d.st, m = s.me || {}; return JSON.stringify({ x: Math.round(s.pred.x), y: Math.round(s.pred.y), aimDeg: Math.round(s.aim * 180 / Math.PI), ammo: m.am, ctrl: m.ct, crouch: m.cr, sprint: !!s.pred.spr, slideCd: Math.round((s.pred.scd || 0) * 10) / 10, prone: !!s.prone, lean: s.leanT || 0, map: !!s.mapV, ads: m.ad, full: !!document.fullscreenElement, prompt: document.getElementById('prompt').textContent, shown: [...document.querySelectorAll('#touchUI .tbtn:not(.hidden)')].map(b => b.textContent).join(' ') }); })()`));
const report = async what => { const s = await state(); s.fireInputs = await js('window.__fires'); s.ev = await js('JSON.stringify(window.__ev)'); await js('window.__ev = {}; window.__fires = 0'); console.log(what.padEnd(46), JSON.stringify(s)); return s; };

ws.onopen = async () => {
  try { await run(); } catch (e) { console.log('ERROR', e.message); }
  console.log('--- browser log ---\n' + logs.filter(l => !/download|Layout was forced/.test(l)).slice(0, 40).join('\n'));
  process.exit(0);
};
async function run() {
  {
    await call('session.new', { capabilities: {} });
    await call('session.subscribe', { events: ['log.entryAdded'] });
    ctx = (await call('browsingContext.create', { type: 'tab' })).context;
    await call('browsingContext.setViewport', { context: ctx, viewport: { width: +W, height: +H } });
    await call('browsingContext.navigate', { context: ctx, url, wait: 'complete' });
    await sleep(2000);
    await js("localStorage.setItem('r62d-name', 'Thumbs'); " + (process.env.SCENARIO === 'fix' ? "localStorage.setItem('r62d-penv', '{\"R62D_FAST\":\"1\"}'); " : "localStorage.removeItem('r62d-penv'); ") + "location.reload(); true"); await sleep(2500); // a returning player: the name is remembered, so menus open straight away
    console.log('touch device?', await js(`('ontouchstart' in window) + ' ' + matchMedia('(pointer: coarse)').matches + ' ' + document.documentElement.className`));
    // menus, all by thumb
    for (let i = 0; i < 20 && !(await js("!!document.getElementById('splash')")); i++) await sleep(500);
    for (let i = 0; i < 6 && await js("!document.getElementById('splash').classList.contains('hidden')"); i++) { await touch(finger('t', [[W / 2, H / 2], [W / 2, H / 2, 60]])); await sleep(1500); } // tap the title screen until it opens
    console.log('after first tap: fullscreen =', await js('!!document.fullscreenElement'));
    // headless full screen would grow the window past the phone size: leave it and stop asking (the check above is what counts)
    await js(`document.exitFullscreen && document.exitFullscreen().catch(() => {}); Element.prototype.requestFullscreen = () => Promise.reject(); true`); await sleep(800);
    await call('browsingContext.setViewport', { context: ctx, viewport: { width: +W, height: +H } });
    await shot('t1-menu');
    if (process.env.SCENARIO === 'menus') { // every menu page by thumb
      for (const t of ['ops', 'armory', 'maps', 'profile', 'settings', 'controls']) { if (['profile', 'settings'].includes(t)) await tap('#backBtn'); else await tap('[data-tab="intel"]'); await sleep(600);
        const ok = await tap(`[data-tab="${t}"]`); await sleep(2500); await shot('v-' + t);
        if (t === 'armory') { const c = [W * 0.4, H * 0.5]; await touch(finger('a', [c, [c[0] + 25, c[1] - 10, 300]], 200)); const fb = await centre('.armTouch .fire'); if (fb) await touch(finger('f', [fb, [fb[0], fb[1], 50]], 900)); await sleep(300); await shot('v-armory-touched'); }
        console.log(t, ok, 'open overlays:', await js("[...document.querySelectorAll('.overlay:not(.hidden), #settings:not(.hidden)')].map(e => e.id).join(',')"));
        for (let i = 0; i < 2 && await js("!!document.querySelector('.overlay:not(.hidden), #settings:not(.hidden)')"); i++) { await js("window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }))"); await sleep(600); } // (the Armory's first Esc lets go of its aim)
        for (let i = 0; i < 2 && await js("!!document.querySelector('.overlay:not(.hidden) .close')"); i++) { await tap('.overlay:not(.hidden) .close'); await sleep(600); } // a phone has no Esc key: the page's CLOSE button
        if (await js("!document.getElementById('settings').classList.contains('hidden')")) { await tap('#setClose'); await sleep(600); }
      }
      return;
    }
    if (process.env.SCENARIO === 'tut') { // the tutorial, by thumb: tap through its cards and pick by tapping
      await tap('[data-tab="free"]'); await sleep(800); await shot('u0-free-tab');
      await tap('#backBtn'); await sleep(400); await tap('[data-tab="tutorial"]'); await sleep(800); await shot('u1-tut-tab');
      await tap('[data-lesson="all"]'); await sleep(6000); await shot('u2-tut-card');
      await tap('#coach'); await sleep(1500); await shot('u3-after-tap');
      console.log('coach now:', await js("document.getElementById('coach').textContent.slice(0, 160)"));
      await tap('#roleBar button'); await sleep(800); await shot('u4-role');
      await tap('#opgrid .op'); await sleep(800); await tap('#lockBtn, #selLock, .lockIn'); await sleep(5000); await shot('u5-picked');
      console.log('coach now:', await js("document.getElementById('coach').textContent.slice(0, 200)"));
      await tap('#coach'); await sleep(4000); await shot('u6-prep');
      console.log('coach now:', await js("document.getElementById('coach').textContent.slice(0, 300)"));
      return;
    }
    await tap('[data-tab="free"]'); await sleep(800);
    await tap('#freeBots [data-n="1"]'); await tap('#freeLevel [data-lv="0"]'); await sleep(300);
    await shot('t2-freeplay-tab');
    await tap('#freeGo'); await sleep(9000);
    await shot('t3-in-match');
    await js(`window.__ev = {}; addEventListener('touchstart', e => { const k = 'touchstart(' + e.changedTouches.length + ' new, ' + e.touches.length + ' down)'; __ev[k] = (__ev[k] || 0) + 1; }, true);
      for (const t of ['pointerdown','pointerup','pointercancel']) addEventListener(t, e => { const k = t + ':' + (e.target.id || e.target.dataset.id || e.target.tagName) + ':' + e.pointerType; __ev[k] = (__ev[k] || 0) + 1; }, true);
      window.__fires = 0; const ws = __r62d.st.ws, send = ws.send.bind(ws); ws.send = d => { try { const m = JSON.parse(d); if (m.k && m.k.fire) __fires++; } catch {} return send(d); }; true`);
    const L = await centre('#tsLeft'); console.log('left stick at', L);
    const R0 = [Math.round(W * 0.78), Math.round(H * 0.45)];
    if (process.env.SCENARIO === 'preaim') { // he asked 2026-11-17: pre-aim while moving. Aim at a spot, let go, strafe: the crosshair should stay on the spot
      const P = () => js('JSON.stringify((p => ({ x: Math.round(p.ax), y: Math.round(p.ay), me: [Math.round(__r62d.st.pred.x), Math.round(__r62d.st.pred.y)] }))(__r62d.padFar()))').then(JSON.parse);
      await touch(finger('R', [R0, [R0[0] + 45, R0[1] - 10, 250]], 300)); await sleep(400); const a = await P(); console.log('aimed and let go', JSON.stringify(a));
      await touch(finger('L', [L, [L[0], L[1] - 60, 150]], 1500)); await sleep(300); const b = await P(); console.log('after strafing up 1.5 s', JSON.stringify(b));
      await touch(finger('L', [L, [L[0] + 60, L[1], 150]], 1000)); await sleep(300); const c = await P(); console.log('after walking right 1 s', JSON.stringify(c));
      const off = (u, v) => Math.round(Math.hypot(u.x - v.x, u.y - v.y)); console.log('PRE-AIM spot moved', off(a, b), 'px while strafing,', off(a, c), 'px after walking right (player moved', off({ x: a.me[0], y: a.me[1] }, { x: c.me[0], y: c.me[1] }), 'px)');
      return;
    }
    let s0 = await report('start');
    if (process.env.SCENARIO === 'fix') { // the 2026-11-16 thumb fixes: AIM switch and CROUCH by the left thumb, auto fire, gyro aim
      await js("__r62d.st.ws.send(JSON.stringify({ t: 'free', a: 'clearBots' })); __r62d.st.ws.send(JSON.stringify({ t: 'free', a: 'botsFire', on: false })); true"); await sleep(600);
      // stand in the middle of the biggest ground-floor room, facing east, so the dummy lands in plain sight
      await js(`(() => { const s = __r62d.st, m = s.map, C = 16, r = m.rooms.filter(q => q.fl === m.groundFloor).sort((p, q) => q.w * q.h - p.w * p.h)[0]; const x = (r.x + r.w / 2 - 3) * C, y = (r.y + r.h / 2) * C; s.ws.send(JSON.stringify({ t: 'free', a: 'tp', x, y, aim: 0 })); return true; })()`); await sleep(1200);
      await touch(finger('R', [R0, [R0[0] + 55, R0[1], 200]], 300)); await sleep(400);
      await js("__r62d.st.ws.send(JSON.stringify({ t: 'free', a: 'dummy' })); true"); await sleep(1500);
      const dummy = async () => JSON.parse(await js("(() => { const s = __r62d.st, d = (s.last.players || []).find(p => /^DUMMY/.test(p.n)); return JSON.stringify(d ? { hp: d.hp, a: d.a, dn: d.dn, ang: Math.round(Math.atan2(d.y - s.pred.y, d.x - s.pred.x) * 180 / Math.PI), m: Math.round(Math.hypot(d.x - s.pred.x, d.y - s.pred.y) / 36 * 10) / 10, seen: (s.foesSeen || []).length } : null); })()"));
      const d0 = await dummy(); console.log('dummy', JSON.stringify(d0));
      const at = d => (d.ang + d) ; const toward = (deg, off) => { const a = (deg + off) * Math.PI / 180; return [R0, [Math.round(R0[0] + Math.cos(a) * 55), Math.round(R0[1] + Math.sin(a) * 55), 200]]; };
      await js('window.__fires = 0'); await touch(finger('R', toward(d0.ang, 40), 900)); await sleep(200);
      console.log('aim 40° off the dummy:', await js('window.__fires'), 'fire inputs (want 0)', JSON.stringify(await dummy()));
      await js('window.__fires = 0'); await touch(finger('R', toward(d0.ang, 3), 1200)); await sleep(300);
      console.log('aim 3° off the dummy:', await js('window.__fires'), 'fire inputs (want many), dummy', JSON.stringify(await dummy()));
      const A = await centre('[data-id="ads"]'), Cr = await centre('[data-id="crouch"]'); console.log('AIM at', A, 'CROUCH at', Cr, '(both on the left half:', A[0] < W / 2 && Cr[0] < W / 2, ')');
      await touch(finger('A', [A, [A[0], A[1], 60]])); await sleep(500); s0 = await report('AIM tapped once (ads should be 1)');
      const g0 = s0.aimDeg;
      const gyro = (alpha, ms) => js(`new Promise(r => { const t0 = performance.now(); const go = () => { dispatchEvent(new DeviceMotionEvent('devicemotion', { accelerationIncludingGravity: { x: 0, y: 0, z: 9.8 }, rotationRate: { alpha: ${alpha}, beta: 0, gamma: 0 }, interval: 16 })); if (performance.now() - t0 < ${ms}) setTimeout(go, 16); else r(true); }; go(); })`);
      await gyro(60, 500); await sleep(200); s0 = await report('gyro: phone turned left 30° (aim should turn ~-30)'); console.log('  aim moved', s0.aimDeg - g0, 'degrees');
      await touch(finger('A', [A, [A[0], A[1], 60]])); await sleep(500); await report('AIM tapped again (ads should be 0)');
      const g1 = (await report('aimed out')).aimDeg; await gyro(60, 500); await sleep(200); console.log('  gyro while not aimed in moved the aim', (await report('gyro, not aimed in')).aimDeg - g1, 'degrees (default "while aimed in": want 0)');
      await touch(finger('C', [Cr, [Cr[0], Cr[1], 60]])); await sleep(500); await report('left CROUCH tapped (crouch should be 1)');
      await shot('f1-buttons');
      const Hq = await centre('[data-id="help"]'); if (Hq) { await touch(finger('H', [Hq, [Hq[0], Hq[1], 60]])); await sleep(500); await shot('f2-help'); await touch(finger('H', [[W / 2, H / 2], [W / 2, H / 2, 60]])); await sleep(400); console.log('guide closed by a tap:', await js("document.getElementById('tHelp').classList.contains('hidden')")); }
      return;
    }
    if (process.env.SCENARIO === 'more') { // the controls added for phones on 2026-11-10: sprint, slide, lie down, lean, map
      const L1 = await centre('#tsLeft');
      await touch(finger('L', [L1, [L1[0], L1[1] - 120, 250], [L1[0], L1[1] - 120, 1500]], 300)); await report('stick pushed past its ring (sprint)');
      { // sprint right, then tap CROUCH 0.4 s in (WebDriver runs both thumbs' steps side by side, so the tap is lined up with the stick's 100 ms steps)
        const C0 = await centre('[data-id="crouch"]'), steps = [[L1[0] + 120, L1[1], 250]]; for (let i = 0; i < 10; i++) steps.push([L1[0] + 120, L1[1], 100]);
        const tap = { type: 'pointer', id: 'C', parameters: { pointerType: 'touch' }, actions: [...Array(6).fill({ type: 'pause', duration: 0 }), { type: 'pointerMove', x: C0[0], y: C0[1], origin: 'viewport' }, { type: 'pointerDown', button: 0 }, { type: 'pause', duration: 0 }, { type: 'pointerUp', button: 0 }] };
        await touch(finger('L', [L1, ...steps]), tap); await report('sprinting right, CROUCH tapped (slide)');
      }
      await sleep(800); const C = await centre('[data-id="crouch"]');
      await touch(finger('C', [C, [C[0], C[1], 800]])); await sleep(300); await report('CROUCH held 0.8 s (lie down)');
      await touch(finger('C', [C, [C[0], C[1], 60]])); await sleep(300); await report('CROUCH tapped (up from lying)');
      const LL = await centre('[data-id="leanL"]'); await touch(finger('Q', [LL, [LL[0], LL[1], 60]])); await sleep(300); await report('LEAN left tapped');
      await shot('m1-lean');
      const M = await centre('[data-id="map"]'); await touch(finger('M', [M, [M[0], M[1], 60]])); await sleep(600); await report('MAP tapped'); await shot('m2-map');
      return;
    }
    // 1. walk "up" with the left thumb for 2 s (full push)
    await touch(finger('L', [L, [L[0], L[1] - 70, 150]], 2000)); s0 = await report('left thumb pushed up 2 s');
    console.log('  under (330, ' + (H - 200) + '):', await js(`(e => e ? (e.id || e.className || e.tagName) + ' / z ' + getComputedStyle(e).zIndex : 'nothing')(document.elementFromPoint(330, ${H - 200}))`));
    // 1b. the move stick comes to a thumb that lands elsewhere in the lower left
    await touch(finger('L', [[330, H - 200], [400, H - 200, 150]], 1500)); await report('thumb landed off the stick, pushed right');
    // 2. light push (walk quietly) right for 2 s
    await touch(finger('L', [L, [L[0] + 30, L[1], 150]], 2000)); await report('left thumb light push right 2 s');
    // 3. aim: right thumb lands and drags left, then down
    await touch(finger('R', [R0, [R0[0] - 60, R0[1], 200]], 300)); await report('right thumb dragged left');
    await touch(finger('R', [R0, [R0[0], R0[1] + 60, 200]], 300)); await report('right thumb dragged down');
    await shot('t4-aimed-down');
    // 4. both at once: move up-left while aiming right
    await touch(finger('L', [L, [L[0] - 50, L[1] - 50, 150]], 1500), finger('R', [R0, [R0[0] + 60, R0[1], 200]], 1350)); await report('both thumbs: move up-left, aim right');
    await shot('t5-both-thumbs');
    // 4b. the same with the right thumb landing 300 ms after the left, and the other way round
    await touch(finger('L', [L, [L[0] - 50, L[1] - 50, 150]], 1500), finger('R', [R0, [R0[0] + 60, R0[1], 200]], 1000, 300)); await report('left first, right lands 300 ms later');
    await touch(finger('R', [R0, [R0[0], R0[1] - 60, 200]], 1500), finger('L', [L, [L[0] + 60, L[1], 150]], 1000, 300)); await report('right first, left lands 300 ms later');
    // 5. fire with the right FIRE button (3 taps), then hold
    const F = await centre('[data-id="fireR"]');
    for (let i = 0; i < 3; i++) { await touch(finger('F', [F, [F[0], F[1], 50]])); await sleep(250); }
    await report('tapped right FIRE 3x');
    // drag FIRE to aim while shooting: hold it and slide the thumb left, then up
    await touch(finger('F', [F, [F[0] - 50, F[1], 250], [F[0] - 50, F[1], 300]], 300)); await report('FIRE dragged left (aim should be ~180)');
    await touch(finger('F', [F, [F[0], F[1] - 50, 250]], 300)); await report('FIRE dragged up (aim should be ~-90)');
    // move with the left thumb while firing + aiming with the right thumb on FIRE
    await touch(finger('L', [L, [L[0] + 60, L[1], 150]], 1200), finger('F', [F, [F[0] + 1, F[1] + 50, 250]], 900, 250)); await report('move right + FIRE dragged down (aim ~90)');
    await touch(finger('F', [F, [F[0], F[1], 50]], 1000)); await report('held right FIRE 1 s');
    // 6. move with left thumb AND fire with right thumb (can't aim at the same time)
    await touch(finger('L', [L, [L[0], L[1] + 70, 150]], 1200), finger('F', [F, [F[0] + 2, F[1], 100]], 1000)); await report('moving down + firing');
    // 7. aim in, then drag right thumb to aim further; fire with the LEFT fire button while the right thumb aims
    await tap('[data-id="ads"]'); await sleep(300); await report('tapped AIM');
    const FL = await centre('[data-id="fireL"]');
    await touch(finger('R', [R0, [R0[0] + 50, R0[1] - 30, 200]], 900), finger('FL', [FL, [FL[0], FL[1], 300]], 500)); await report('right thumb aims + left thumb fires');
    await shot('t6-aim-and-fire');
    await tap('[data-id="ads"]'); await sleep(200);
    // 8. crouch on/off, reload, swap
    await tap('[data-id="crouch"]'); await sleep(400); await report('tapped CROUCH');
    await tap('[data-id="crouch"]'); await sleep(200);
    await tap('[data-id="reload"]'); await sleep(2500); await report('tapped RELOAD');
    await tap('[data-id="swap"]'); await sleep(1200); await report('tapped SWAP');
    await tap('[data-id="swap"]'); await sleep(1200);
    // 9. drone: out, drive, sprint, back
    await tap('[data-id="view"]'); await sleep(1500); await report('tapped DRONE / CAMS');
    await shot('t7-drone');
    await touch(finger('L', [L, [L[0], L[1] - 70, 150]], 1500)); await report('drove drone up 1.5 s');
    await tap('[data-id="view"]'); await sleep(1500); await report('tapped DRONE / CAMS again');
    // 10. pause and resume by thumb
    await tap('[data-id="pause"]'); await sleep(800); await shot('t8-pause');
    await tap('#pause .menu button'); await sleep(800); await report('resumed from pause');
    // 11. scoreboard (hold)
    const SC = await centre('[data-id="score"]'); await touch(finger('S', [SC, [SC[0], SC[1], 50]], 800));
    // 11b. tilt to move: switch it on, hold level, press ⟲ TILT, then tip the right edge down / the top edge down
    const tiltFor = (x, y, ms) => js(`new Promise(r => { const t0 = performance.now(); const go = () => { dispatchEvent(new DeviceMotionEvent('devicemotion', { accelerationIncludingGravity: { x: ${x}, y: ${y}, z: 9 } })); if (performance.now() - t0 < ${ms}) setTimeout(go, 16); else r(true); }; go(); })`);
    await js("localStorage.setItem('r62d-tilt', '1'); localStorage.setItem('r62d-tiltdz', '7'); true");
    await tap('[data-id="pause"]'); await sleep(500); await tap('#pResume'); await sleep(500); // re-shows the controls with ⟲ TILT
    await tiltFor(0, 3, 400); await tap('[data-id="tiltc"]'); await tiltFor(0, 3, 300); await report('tilt on, held level');
    await shot('t8b-tilt');
    await tiltFor(2.0, 3, 1500); await report('left edge tipped ~12° (should walk left)');
    await tiltFor(5.0, 3, 1500); await report('left edge tipped ~30° (should run left, faster)');
    await tiltFor(-0.6, 3, 1000); await report('tipped ~3.5° (inside dead zone: no move)');
    await tiltFor(0, 5.5, 1500); await report('top edge tipped back (should go down)');
    await tiltFor(0, 3, 300); await js("localStorage.setItem('r62d-tilt', '0'); true");
    // 12. hunt the bot: walk around for a while with a thumb on each stick, firing in bursts
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      await touch(finger('L', [L, [L[0] + Math.cos(a) * 70, L[1] + Math.sin(a) * 70, 150]], 1800), finger('R', [R0, [R0[0] + Math.cos(a) * 60, R0[1] + Math.sin(a) * 60, 200]], 1600));
      await touch(finger('F', [F, [F[0], F[1], 50]], 400));
      await report('square side ' + i + ' (aim should be ' + Math.round(a * 180 / Math.PI) + ')');
    }
    await report('after walking a square');
    await shot('t9-end');
  }
}
