// Free play on a phone (he asked 2026-11-16): the operators / guns / bots panel opens by thumb, switching operator works,
// and nothing in it or the pause menu is cut off or squeezed. Same checks and usage as tests/phonescreens.mjs.
// node tests/phonefree.mjs <port> <outdir> <gameUrl> [width height]
import fs from 'node:fs';
const [port, outDir, url, W = 914, H = 412] = process.argv.slice(2);
const ws = new WebSocket(`ws://127.0.0.1:${port}/session`);
let id = 0; const waiting = new Map();
const call = (method, params) => new Promise((res, rej) => { const i = ++id; waiting.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waiting.has(m.id)) { const w = waiting.get(m.id); waiting.delete(m.id); m.type === 'error' ? w.rej(new Error(m.error + ': ' + m.message)) : w.res(m.result); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ctx;
const js = async expr => { const r = await call('script.evaluate', { expression: expr, target: { context: ctx }, awaitPromise: true }); if (r.exceptionDetails) throw new Error('js: ' + r.exceptionDetails.text); return r.result && r.result.value; };
const SIZES = [[+W, +H], [760, 360]]; let tag = `${W}x${H}`;
const shot = async name => { const r = await call('browsingContext.captureScreenshot', { context: ctx }); fs.writeFileSync(`${outDir}/${tag}-${name}.png`, Buffer.from(r.data, 'base64')); };
const finger = (pts) => ({ type: 'pointer', id: 't', parameters: { pointerType: 'touch' }, actions: [{ type: 'pointerMove', x: pts[0][0], y: pts[0][1], origin: 'viewport' }, { type: 'pointerDown', button: 0 }, { type: 'pointerMove', x: pts[1][0], y: pts[1][1], duration: 60, origin: 'viewport' }, { type: 'pointerUp', button: 0 }] });
const touch = async f => { await call('input.performActions', { context: ctx, actions: [f] }); await call('input.releaseActions', { context: ctx }); };
const tapVis = async sel => { const c = JSON.parse(await js(`(() => { for (const e of document.querySelectorAll(${JSON.stringify(sel)})) { const r = e.getBoundingClientRect(); if (r.width && r.height && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth) return JSON.stringify([Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)]); } return 'null'; })()`)); if (!c) { console.log('  nothing to tap on screen:', sel); return false; } await touch(finger([c, c])); return true; };
const uicheck = fs.readFileSync(new URL('./uicheck.js', import.meta.url), 'utf8').split('\n').filter(l => !l.startsWith('//')).join(' ');
// HUD pieces and touch buttons that overlap each other, or stick out of the screen
const overlap = `(() => { const out = [], W = innerWidth, H = innerHeight;
  const vis = e => { for (let x = e; x && x !== document.body; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false; } return true; };
  const name = e => e.id ? '#' + e.id : (e.dataset.id ? 'btn:' + e.dataset.id : e.className);
  const els = [...document.querySelectorAll('#hud > *, #touchUI > :not(.tzone), #chat, #compass .cmpTxt')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && vis(e) && (e.textContent.trim() || e.querySelector('canvas,svg,i') || e.closest('#touchUI')); });
  for (const e of els) { const r = e.getBoundingClientRect(); if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) out.push('OFF SCREEN ' + name(e) + ' ' + [r.left, r.top, r.right, r.bottom].map(Math.round)); }
  for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) { const a = els[i].getBoundingClientRect(), b = els[j].getBoundingClientRect();
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (w > 4 && h > 4 && !els[i].contains(els[j]) && !els[j].contains(els[i]) && !/leftCount.*topbar|topbar.*leftCount/.test(name(els[i]) + name(els[j]))) out.push('OVERLAP ' + name(els[i]) + ' & ' + name(els[j]) + ' ' + Math.round(w) + 'x' + Math.round(h)); }
  return out.join('\\n') || 'none'; })()`;
// squished: operator cards and loadout pieces smaller than a thumb can tap / text too small to read
const squish = `(() => { const out = [];
  const cards = [...document.querySelectorAll('#opgrid .op')].filter(e => e.getClientRects().length);
  if (cards.length) { const r = cards.map(e => e.getBoundingClientRect()); out.push('op cards: ' + cards.length + ', size ' + Math.round(Math.min(...r.map(x => x.width))) + '-' + Math.round(Math.max(...r.map(x => x.width))) + ' x ' + Math.round(Math.min(...r.map(x => x.height))) + '-' + Math.round(Math.max(...r.map(x => x.height))) + ', on screen ' + r.filter(x => x.bottom <= innerHeight && x.top >= 0).length); }
  for (const s of ['#select .selhead', '#roleBar', '#opgrid', '#selLo', '#selLoBody', '#picks', '#lockBtn']) { const e = document.querySelector(s); if (e && e.getClientRects().length) { const r = e.getBoundingClientRect(); out.push(s + ' ' + [r.left, r.top, r.width, r.height].map(Math.round).join(',') + (e.scrollHeight > e.clientHeight + 2 ? ' (scrolls ' + e.scrollHeight + '/' + e.clientHeight + ')' : '')); } }
  const tiny = new Set(); for (const e of document.querySelectorAll('#select *')) { if (!e.getClientRects().length || ![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue; const f = parseFloat(getComputedStyle(e).fontSize); if (f < 9) tiny.add(f + 'px "' + e.textContent.trim().slice(0, 20) + '"'); }
  if (tiny.size) out.push('tiny text: ' + [...tiny].slice(0, 8).join(' | '));
  const sq = [...document.querySelectorAll('#select button, #select .op')].filter(e => { const r = e.getBoundingClientRect(); return e.getClientRects().length && r.width && (r.height < 22 || r.width < 22); }).map(e => (e.textContent.trim().slice(0, 12) || e.className) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height));
  if (sq.length) out.push('small buttons: ' + sq.slice(0, 10).join(' | '));
  return out.join('\\n'); })()`;
// icons (button pictures, operator portraits, gun pictures) cut by the screen edge or by the box that holds them
const icons = `(() => { const out = [], W = innerWidth, H = innerHeight;
  const vis = e => { for (let x = e; x && x !== document.body; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false; } return true; };
  for (const e of document.querySelectorAll('svg, canvas, img')) { if (e.closest('#game, #fog, #over, #mapLayer') || e.id === 'game') continue; const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4 || !vis(e)) continue; let sc = null; for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) { const cs = getComputedStyle(x); if (/auto|scroll/.test(cs.overflowY + cs.overflowX) && (x.scrollHeight > x.clientHeight + 2 || x.scrollWidth > x.clientWidth + 2)) { sc = x.getBoundingClientRect(); break; } } if (sc && (r.bottom <= sc.top || r.top >= sc.bottom || r.right <= sc.left || r.left >= sc.right || r.top < sc.top - 1 || r.bottom > sc.bottom + 1)) continue; /* (in a list you scroll: reachable) */
    const nm = (e.closest('[data-id]') || {}).dataset?.id || (e.closest('[data-op]') || {}).dataset?.op || e.parentElement.className || e.parentElement.id;
    if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) { out.push('ICON OFF SCREEN ' + nm + ' ' + [r.left, r.top, r.right, r.bottom].map(Math.round)); continue; }
    for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.overflow === 'visible' && x.tagName !== 'BUTTON') continue; if (x.scrollHeight > x.clientHeight + 2 && /auto|scroll/.test(cs.overflowY)) break; const b = x.getBoundingClientRect();
      if (r.left < b.left - 1 || r.top < b.top - 1 || r.right > b.right + 1 || r.bottom > b.bottom + 1) out.push('ICON CUT ' + nm + ' by ' + (x.id || x.className || x.tagName)); break; } }
  return [...new Set(out)].join('\\n') || 'none'; })()`;
const phase = () => js(`(__r62d.st.last || {}).ph || ''`);
const check = async (name, sq) => { for (const [w, h] of SIZES) { tag = `${w}x${h}`; await call('browsingContext.setViewport', { context: ctx, viewport: { width: w, height: h } }); await sleep(600); await check1(name, sq); } };
const check1 = async (name, sq) => { await shot(name); console.log(`== ${tag} ${name}\n cut-off: ${(await js(uicheck)) || 'none'}\n overlaps: ${await js(overlap)}\n icons: ${await js(icons)}`); if (sq) console.log(' ' + (await js(squish)).replace(/\n/g, '\n ')); };

ws.onopen = async () => { try { await run(); } catch (e) { console.log('ERROR', e.message); } process.exit(0); };
async function run() {
  await call('session.new', { capabilities: {} });
  ctx = (await call('browsingContext.create', { type: 'tab' })).context;
  await call('browsingContext.setViewport', { context: ctx, viewport: { width: +W, height: +H } });
  await call('browsingContext.navigate', { context: ctx, url, wait: 'complete' }); await sleep(1500);
  await js(`localStorage.setItem('r62d-name', 'Thumbs'); localStorage.removeItem('r62d-penv'); location.reload(); true`); await sleep(3000);
  for (let i = 0; i < 20 && !(await js("!!document.getElementById('splash')")); i++) await sleep(500);
  for (let i = 0; i < 6 && await js("!document.getElementById('splash').classList.contains('hidden')"); i++) { await touch(finger([[W / 2, H / 2], [W / 2, H / 2]])); await sleep(1500); }
  await js(`document.exitFullscreen && document.exitFullscreen().catch(() => {}); Element.prototype.requestFullscreen = () => Promise.reject(); true`); await sleep(500);
  await call('browsingContext.setViewport', { context: ctx, viewport: { width: +W, height: +H } });
  await check('m1-home');
  await tapVis('[data-tab="free"]'); await sleep(900); await check('m2-free-tab');
  await tapVis('#freeGo'); await sleep(9000); await check('f1-in-free-play');
  const pane = `(() => { const e = document.querySelector('#freeOps'); if (!e || !e.getClientRects().length) return 'closed'; const b = e.querySelectorAll('.foOps button'), r = [...b].map(x => x.getBoundingClientRect()); return 'open, ' + b.length + ' operator buttons ' + Math.round(Math.min(...r.map(x => x.width))) + 'x' + Math.round(Math.min(...r.map(x => x.height))) + ', body scrolls ' + e.querySelector('.foBody').scrollHeight + '/' + e.querySelector('.foBody').clientHeight; })()`;
  for (const k of [0, 1]) {
    const before = await js('(__r62d.st.me || {}).op');
    await tapVis('#freeOpsBtn'); await sleep(900); console.log('panel:', await js(pane)); await check('f2-panel-' + k);
    const ok = await tapVis(`#freeOps .foOps button:not(.on)${k ? ':nth-child(2)' : ''}`); await sleep(1500);
    console.log('switched operator:', before, '->', await js('(__r62d.st.me || {}).op'), ok, 'panel after:', await js(pane));
  }
  await check('f3-after-switch');
  await tapVis('[data-id="pause"]'); await sleep(800); await check('f4-pause'); await tapVis('#pResume'); await sleep(500);
  // steer after a sprint (he asked 2026-11-16): sprint right, let go, walk down: the crosshair turns down with you; aim in, walk left: it stays
  const aimDeg = async () => Math.round(await js('__r62d.st.aim') * 180 / Math.PI);
  const stick = (pts, hold) => touch({ type: 'pointer', id: 'L', parameters: { pointerType: 'touch' }, actions: [{ type: 'pointerMove', x: pts[0][0], y: pts[0][1], origin: 'viewport' }, { type: 'pointerDown', button: 0 }, ...pts.slice(1).map(q => ({ type: 'pointerMove', x: q[0], y: q[1], duration: 150, origin: 'viewport' })), { type: 'pause', duration: hold }, { type: 'pointerUp', button: 0 }] });
  const L0 = [110, Math.round(+H * 0.72)];
  await stick([L0, [L0[0] + 100, L0[1]]], 1200); const a1 = await aimDeg();
  await stick([L0, [L0[0], L0[1] + 45]], 1200); const a2 = await aimDeg();
  console.log('steer: after sprinting right aim', a1, '°; then walking down (no sprint) aim', a2, '°', Math.abs(a2 - 90) < 30 ? 'OK (turned with the stick)' : 'FAIL');
  await tapVis('[data-id="ads"]'); await sleep(400);
  await stick([L0, [L0[0] - 45, L0[1]]], 1200); const a3 = await aimDeg();
  console.log('steer: aimed in, walking left: aim', a3, '°', Math.abs(a3 - a2) < 25 ? 'OK (stayed put)' : 'FAIL');
  await tapVis('[data-id="ads"]'); await sleep(400);
  // aim reach (he asked 2026-11-16: couldn't aim far enough on a phone): push the aim stick all the way out
  const [vw, vh] = JSON.parse(await js("JSON.stringify([innerWidth, innerHeight])")), R0 = [Math.round(vw * 0.72), Math.round(vh * 0.5)];
  await stick([R0, [Math.min(vw - 4, R0[0] + 120), R0[1]]], 900); await sleep(1200);
  const far = JSON.parse(await js('JSON.stringify((() => { const s = __r62d.st, q = __r62d.padFar(); return { m: Math.round(Math.hypot(q.ax - s.pred.x, q.ay - s.pred.y) / 36 * 10) / 10, zoom: Math.round(s.zoom * 100) / 100 }; })())'));
  console.log('aim stick pushed all the way: crosshair', far.m, 'm out (hip reach 18 m), zoom', far.zoom); await shot('f5-far-aim');
}
