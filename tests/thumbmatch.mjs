// Plays a whole Quick Match "as a phone" with two simulated thumbs (he asked 2026-11-16: test the phone controls as if
// that is what you play with; find where two thumbs aren't enough). Each moment it decides like a player: no enemy
// seen → left thumb follows the compass, right thumb looks ahead; enemy seen → right thumb holds FIRE and drags toward
// them (FIRE aims while held) while the left thumb strafes; prompts → VAULT / hold USE. Every moment a player would want
// a third thumb (crouch, lean, reload, aim in, a gadget while fighting) is counted, with which thumb was busy.
// Usage: node tests/thumbmatch.mjs <port> <outdir> <gameUrl> [width height] [minutes]
import fs from 'node:fs';
const [port, outDir, url, W = 914, H = 412, MIN = 14] = process.argv.slice(2);
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
const touch = async (...fingers) => { try { await call("input.performActions", { context: ctx, actions: fingers }); } catch (e) { console.log("  touch failed:", JSON.stringify(fingers.map(f => f.actions.filter(a => a.x !== undefined).map(a => [a.x, a.y])))); try { await call("input.releaseActions", { context: ctx }); } catch {} return; } await call("input.releaseActions", { context: ctx }); };
const tap = async sel => { const c = await centre(sel); if (!c || c[1] > H || c[0] > W) { console.log('  cannot tap (not visible):', sel); return false; } await touch(finger('t', [c, [c[0], c[1], 60]])); return true; };
// what the "player" sees: phase, themselves, the enemies on screen, the compass, the prompt
const look = async () => JSON.parse(await js(`(() => { const s = __r62d.st, l = s.last || {}, m = s.me || {}, P = s.pred || {};
  const foes = (s.foesSeen || []).filter(f => f.a !== 0).map(f => ({ x: Math.round(f.x), y: Math.round(f.y), d: Math.round(Math.hypot(f.x - P.x, f.y - P.y)) })).sort((a, b) => a.d - b.d);
  const me0 = (l.players || []).find(p => p.id === l.you) || {};
  return JSON.stringify({ ph: l.ph, rd: l.rd, sc: l.sc, side: me0.tm, alive: me0.a, dn: me0.dn, hp: me0.hp, k: me0.k, d: me0.d, x: Math.round(P.x || 0), y: Math.round(P.y || 0),
    ct: m.ct, am: m.am, ad: m.ad, cmp: s.cmpDir, foes, prompt: (document.getElementById('prompt') || {}).textContent || '',
    shown: [...document.querySelectorAll('#touchUI .tbtn:not(.hidden)')].map(b => b.dataset.id),
    sel: !document.getElementById('select') || !document.getElementById('select').classList.contains('hidden'), end: !!document.querySelector('#endscreen:not(.hidden)') }); })()`));
const C = {}; const want = (k, why) => { C[k] = (C[k] || 0) + 1; if (C[k] <= 3) console.log('  third thumb wanted:', k, '-', why); };
// the first of these that is showing on the screen (a player only taps what they can see)
const tapVis = async sel => { const c = JSON.parse(await js(`(() => { for (const e of document.querySelectorAll(${JSON.stringify(sel)})) { const r = e.getBoundingClientRect(); if (r.width && r.height && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth) return JSON.stringify([Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)]); } return 'null'; })()`)); if (!c) { console.log('  nothing to tap on screen:', sel); return false; } await touch(finger('t', [c, [c[0], c[1], 60]])); return true; };
const pt = (c, a, r) => [Math.max(2, Math.min(W - 3, Math.round(c[0] + Math.cos(a) * r))), Math.max(2, Math.min(H - 3, Math.round(c[1] + Math.sin(a) * r)))]; // (a thumb stays on the screen)
let lastAmmo = null, fights = 0, shotsT = 0;

async function run() {
  await call('session.new', { capabilities: {} });
  await call('session.subscribe', { events: ['log.entryAdded'] });
  ctx = (await call('browsingContext.create', { type: 'tab' })).context;
  await call('browsingContext.setViewport', { context: ctx, viewport: { width: +W, height: +H } });
  await call('browsingContext.navigate', { context: ctx, url, wait: 'complete' });
  await sleep(1500);
  await js(`localStorage.setItem('r62d-name', 'Thumbs'); localStorage.setItem('r62d-penv', '{"R62D_FAST":"1"}'); location.reload(); true`); await sleep(3000);
  for (let i = 0; i < 20 && !(await js("!!document.getElementById('splash')")); i++) await sleep(500);
  for (let i = 0; i < 6 && await js("!document.getElementById('splash').classList.contains('hidden')"); i++) { await touch(finger('t', [[W / 2, H / 2], [W / 2, H / 2, 60]])); await sleep(1500); } // the title screen: tap until it opens
  await js(`document.exitFullscreen && document.exitFullscreen().catch(() => {}); Element.prototype.requestFullscreen = () => Promise.reject(); true`); await sleep(500);
  await call('browsingContext.setViewport', { context: ctx, viewport: { width: +W, height: +H } });
  await tap('[data-tab="play"]'); await sleep(1500);
  await tap('#botLevel [data-lv="1"]'); await sleep(300); // Bronze bots
  await tap('#fillBtn'); await sleep(800);
  await shot('m0-lobby');
  await tap('#startBtn'); await sleep(4000);
  const L = () => centre('#tsLeft'), R0 = [Math.round(W * 0.6), Math.round(H * 0.5)];
  const t0 = Date.now(); let lastPh = '', shots = 0, n = 0;
  while (Date.now() - t0 < MIN * 60000) {
    const s = await look(); n++;
    if (s.ph !== lastPh) { console.log(`[${Math.round((Date.now() - t0) / 1000)} s] phase ${s.ph} round ${s.rd} score ${JSON.stringify(s.sc)} side ${s.side} k${s.k} d${s.d}`); lastPh = s.ph; if (s.ph === 'action') await shot('m-action-' + s.rd); }
    if (s.end || s.ph === 'match_end' || s.ph === 'matchEnd') { await shot('m9-end'); console.log('match over', JSON.stringify(s.sc)); break; }
    if (s.ph === 'select') { // choose a role, an operator, lock in: all by thumb
      await tapVis('#roleBar button'); await sleep(500);
      await tapVis('#opgrid .op:not(.taken):not(.banned)'); await sleep(500);
      await tapVis('#lockBtn'); await sleep(1500); continue;
    }
    if (s.ph !== 'action' || !s.alive || s.dn) { if (s.ct === 'drone') { await tap('[data-id="view"]'); } await sleep(1200); continue; }
    if (s.ct && s.ct !== 'body') { await tap('[data-id="view"]'); await sleep(800); continue; }
    const Lc = await L(); if (!Lc) { await sleep(500); continue; }
    const F = await centre('[data-id="fireR"]');
    if (s.foes.length) { // a fight. Right thumb: aims at them (auto fire shoots; FIRE dragged if auto fire is off). Left thumb:
      // strafes, or taps AIM (far) / CROUCH (close) on its own side while the right thumb keeps aiming
      fights++;
      const f = s.foes[0], a = Math.atan2(f.y - s.y, f.x - s.x) + (Math.random() - 0.5) * 0.1, auto = await js("localStorage.getItem('r62d-autofire') !== '0'");
      const right = auto ? finger('R', [R0, pt(R0, a, 55)], 700, 40) : finger('F', [F, pt(F, a, 50)], 650, 50);
      if (s.am !== undefined && s.am <= 3 && s.am > 0) want('reload', 'magazine nearly empty in a fight (RELOAD is on the right; an empty one reloads by itself)');
      const lb = !s.ad && f.d > 220 ? 'ads' : f.d < 200 && Math.random() < 0.3 ? 'crouch' : null;
      const LB = lb && await centre(`[data-id="${lb}"]`);
      if (LB) { await touch(finger('B', [LB, [LB[0], LB[1], 60]]), right); C['left thumb ' + lb] = (C['left thumb ' + lb] || 0) + 1; }
      else { const side = a + Math.PI / 2 * (n % 2 ? 1 : -1); if (Math.random() < 0.15) want('lean', 'lean out while strafing (LEAN is off the stick)'); await touch(finger('L', [Lc, pt(Lc, side, 45)], 700), right); }
      if (s.am !== undefined && lastAmmo !== null && s.am < lastAmmo) shots++; lastAmmo = s.am;
      shotsT++;
      continue;
    }
    if (s.shown.includes('vault')) { await tap('[data-id="vault"]'); await sleep(900); continue; }
    if (s.shown.includes('use') && /PLANT|DEFUS|REVIVE/i.test(s.prompt)) { // plant / defuse / revive: hold USE (right thumb), nothing to aim with meanwhile
      const U = await centre('[data-id="use"]'); console.log('  holding USE:', s.prompt.slice(0, 40)); want('watch while planting', 'holding USE: the right thumb can\'t look around');
      await touch(finger('U', [U, [U[0], U[1], 50]], 7500)); continue;
    }
    // no enemy: follow the compass (attack) or wander the site (defence), looking where you go
    const a = s.cmp != null ? s.cmp + (Math.random() - 0.5) * 0.4 : Math.random() * Math.PI * 2;
    await touch(finger('L', [Lc, pt(Lc, a, s.side === 'def' && s.cmp == null ? 40 : 70)], 1100), finger('R', [R0, pt(R0, a, 55)], 1000, 60));
  }
  console.log('\n--- thumb report ---');
  console.log(`fight moments ${fights}, moments the gun had fired since the last look ${shots}`);
  for (const [k, v] of Object.entries(C)) console.log(`wanted a third thumb for "${k}": ${v} times`);
  const s = await look(); console.log('final', JSON.stringify({ sc: s.sc, k: s.k, d: s.d }));
}
ws.onopen = async () => {
  try { await run(); } catch (e) { console.log('ERROR', e.message); }
  console.log('--- browser log ---\n' + logs.filter(l => !/download|Layout was forced|darkreader|NetworkError|PointerLock/.test(l)).slice(0, 30).join('\n'));
  process.exit(0);
};
