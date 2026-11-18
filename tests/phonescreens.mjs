// Phone screen check: plays into a bot match by thumb at a phone's size and, on the operator select / loadout screen
// and the in-match HUD, takes screenshots and lists anything cut off by the screen edge, text clipped by its box,
// HUD pieces covering each other or covered by the touch buttons, and squished cards (too small to read or tap).
// Usage like tests/thumbs.mjs: node tests/phonescreens.mjs <port> <outdir> <gameUrl> [width height]
import fs from 'node:fs';
const [port, outDir, url, W = 914, H = 412] = process.argv.slice(2);
const ws = new WebSocket(`ws://127.0.0.1:${port}/session`);
let id = 0; const waiting = new Map();
const call = (method, params) => new Promise((res, rej) => { const i = ++id; waiting.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waiting.has(m.id)) { const w = waiting.get(m.id); waiting.delete(m.id); m.type === 'error' ? w.rej(new Error(m.error + ': ' + m.message)) : w.res(m.result); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ctx;
const js = async expr => { const r = await call('script.evaluate', { expression: expr, target: { context: ctx }, awaitPromise: true }); if (r.exceptionDetails) throw new Error('js: ' + r.exceptionDetails.text); return r.result && r.result.value; };
const SIZES = [[+W, +H], [760, 360]]; let tag = `${W}x${H}`; // (a common phone, and a small one)
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
// CUTOUT="l,t,r,b,R" (he asked 2026-11-18: rounded corners, the camera hole): pretends the phone app measured a camera
// hole strip of l/t/r/b px and corners of radius R, paints them black on the screenshots (the hole as a dot in the
// middle of the widest strip), and lists HUD pieces and buttons inside a strip or a corner's cut-off part
const CUT = process.env.CUTOUT ? process.env.CUTOUT.split(',').map(Number) : null;
const cutSet = () => CUT ? js(`(() => { const [l, t, r, b, R] = ${JSON.stringify(CUT)}, k = 0.3 * R, d = document;
  window.r62dApp = Object.assign(window.r62dApp || {}, { insets: () => JSON.stringify({ l: Math.max(l, k), t: Math.max(t, k), r: Math.max(r, k), b: Math.max(b, k) }) }); window.onInsets && onInsets();
  let m = d.getElementById('cutMask'); if (!m) { m = d.createElement('div'); m.id = 'cutMask'; d.body.appendChild(m); }
  m.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99999;border-radius:' + R + 'px;box-shadow:0 0 0 200px #000';
  const w = Math.max(l, t, r, b), side = [l, t, r, b].indexOf(w), hole = d.getElementById('cutHole') || d.body.appendChild(Object.assign(d.createElement('div'), { id: 'cutHole' }));
  const pos = [['left:' + (w / 2 - 6) + 'px;top:calc(50% - 6px)'], ['top:' + (w / 2 - 6) + 'px;left:calc(50% - 6px)'], ['right:' + (w / 2 - 6) + 'px;top:calc(50% - 6px)'], ['bottom:' + (w / 2 - 6) + 'px;left:calc(50% - 6px)']][side];
  hole.style.cssText = 'position:fixed;width:12px;height:12px;border-radius:50%;background:#000;box-shadow:0 0 0 2px #222;pointer-events:none;z-index:99999;' + pos;
  return true; })()`) : null;
const clear = () => js(`(() => { const [l, t, r, b, R] = ${JSON.stringify(CUT)}, W = innerWidth, H = innerHeight, out = [];
  const vis = e => { for (let x = e; x && x !== document.body; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false; } return true; };
  const name = e => e.id ? '#' + e.id : (e.dataset.id ? 'btn:' + e.dataset.id : String(e.className).slice(0, 30));
  const inCorner = (x, y) => { const cx = x < R ? R : x > W - R ? W - R : null, cy = y < R ? R : y > H - R ? H - R : null; return cx !== null && cy !== null && Math.hypot(x - cx, y - cy) > R; };
  const els = [...document.querySelectorAll('#hud *, #touchUI .tbtn, #touchUI #tsLeft, #touchUI #tsRight, #chat, #select button, #select .op, #lobby button, .overlay:not(.hidden) button, #settings button')].filter(e => { const q = e.getBoundingClientRect(); return q.width > 2 && q.height > 2 && vis(e) && (e.children.length === 0 || e.matches('button, .tbtn, #tsLeft, #tsRight')); });
  for (const e of els) { const q = e.getBoundingClientRect(); const bad = [];
    if (l && q.left < l - 1 && q.right > 0) bad.push('hole strip L'); if (r && q.right > W - r + 1 && q.left < W) bad.push('hole strip R');
    if (t && q.top < t - 1) bad.push('hole strip T'); if (b && q.bottom > H - b + 1) bad.push('hole strip B');
    const p = e.closest('.poly') ? 4 : 0; // (polygon buttons: only their box corners can be tested; allow a little)
    for (const [x, y] of [[q.left + p, q.top + p], [q.right - p, q.top + p], [q.left + p, q.bottom - p], [q.right - p, q.bottom - p]]) if (inCorner(x, y)) { bad.push('rounded corner'); break; }
    if (bad.length) out.push(name(e) + ' ' + bad.join('+') + ' ' + [q.left, q.top, q.right, q.bottom].map(Math.round)); }
  return [...new Set(out)].slice(0, 30).join('\\n ') || 'none'; })()`);
const phase = () => js(`(__r62d.st.last || {}).ph || ''`);
const check = async (name, sq) => { for (const [w, h] of SIZES) { tag = `${w}x${h}`; await call('browsingContext.setViewport', { context: ctx, viewport: { width: w, height: h } }); await sleep(600); await check1(name, sq); } };
const check1 = async (name, sq) => { await cutSet(); await sleep(300); await shot(name); if (CUT) console.log(`== ${tag} ${name} in the way of the hole/corners:\n ${await js('0') === 0 ? await clear() : ''}`); console.log(`== ${tag} ${name}\n cut-off: ${(await js(uicheck)) || 'none'}\n overlaps: ${await js(overlap)}\n icons: ${await js(icons)}`); if (sq) console.log(' ' + (await js(squish)).replace(/\n/g, '\n ')); };

ws.onopen = async () => { try { await run(); } catch (e) { console.log('ERROR', e.message); } process.exit(0); };
async function run() {
  await call('session.new', { capabilities: {} });
  ctx = (await call('browsingContext.create', { type: 'tab' })).context;
  await call('browsingContext.setViewport', { context: ctx, viewport: { width: +W, height: +H } });
  await call('browsingContext.navigate', { context: ctx, url, wait: 'complete' }); await sleep(1500);
  await js(`localStorage.setItem('r62d-name', 'Thumbs'); localStorage.removeItem('r62d-penv'); location.reload(); true`); await sleep(3000);
  for (let i = 0; i < 20 && !(await js("!!document.getElementById('splash')")); i++) await sleep(500);
  for (let i = 0; i < 6 && await js("!document.getElementById('splash').classList.contains('hidden')"); i++) { await touch(finger([[W / 2, H / 2], [W / 2, H / 2]])); await sleep(1500); }
  console.log('splash gone:', await js(`JSON.stringify({ gone: document.getElementById('splash').classList.contains('hidden'), started: window.__r62d && __r62d.st.started, at: document.elementsFromPoint(innerWidth / 2, innerHeight / 2).map(e => e.tagName + '#' + e.id + '.' + e.className).join(' > '), vp: innerWidth + 'x' + innerHeight })`));
  await js(`document.exitFullscreen && document.exitFullscreen().catch(() => {}); Element.prototype.requestFullscreen = () => Promise.reject(); true`); await sleep(500);
  await call('browsingContext.setViewport', { context: ctx, viewport: { width: +W, height: +H } });
  await tapVis('[data-tab="play"]'); await sleep(1500);
  await tapVis('#botLevel [data-lv="1"]'); await sleep(300); await tapVis('#fillBtn'); await sleep(800);
  await tapVis('#startBtn');
  for (let i = 0; i < 60 && await phase() !== 'select'; i++) await sleep(500);
  await sleep(1500); if (process.env.DEF) await js("__r62d.st.ws.send(JSON.stringify({ t: 'defreq', on: 1 })); true"); // DEF=1: ask for the defuser (to see the carrier's screen)
  await check('s1-select', true); // step 1: the spawn list and the map
  await tapVis('#roleBar button:nth-child(3)'); await sleep(500); await tapVis('#lockBtn'); await sleep(900); await check('s1b-spawn-locked', true);
  await tapVis('#roleBar button:nth-child(2)'); await sleep(600);
  await tapVis('#opgrid .op:not(.taken):not(.banned)'); await sleep(900); await check('s2-op-picked', true);
  await tapVis('#lockBtn'); await sleep(1200); await check('s3-locked', true);
  for (let i = 0; i < 120 && await phase() !== 'prep'; i++) await sleep(500);
  await sleep(4000); await check('h1-prep');
  // switching operator in preparation (attackers): pause, CHANGE OPERATOR, another role and operator, back to the match
  const op0 = await js('(__r62d.st.me || {}).op');
  await tapVis('[data-id="pause"]'); await sleep(700); await tapVis('#pSwap'); await sleep(1200); await check('h1b-switch', true);
  await tapVis('#roleBar button:nth-child(3)'); await sleep(600); await tapVis('#opgrid .op:not(.taken):not(.banned):not(.hidden)'); await sleep(1200);
  await check('h1c-switched', true); console.log('operator before / after switching:', op0, await js('(__r62d.st.me || {}).op'));
  await tapVis('#lockBtn'); await sleep(800); console.log('picker closed:', await js("document.getElementById('select').classList.contains('hidden')"));
  for (let i = 0; i < 120 && await phase() !== 'action'; i++) await sleep(500);
  await sleep(4000); await check('h2-action');
}
