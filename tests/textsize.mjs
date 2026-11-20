// Text size check (he asked 2026-11-17: no text too small to read in the menus, the settings and free play's
// operators / guns / god mode panel, on every version). Opens each menu page at a few screen sizes and lists every
// piece of text whose size ON SCREEN (font size times the menus' fit-to-screen zoom) is under MIN px, plus screenshots.
// Usage (Firefox headless with --remote-debugging-port, like tests/shoot.mjs; for phones use the phone profile from
// docs/testing.md "Playing as a phone"): node tests/textsize.mjs <port> <outdir> <gameUrl> pc|phone
import fs from 'node:fs';
const [port, outDir, url, mode = 'pc'] = process.argv.slice(2);
const MIN = +(process.env.MIN || 12);
const SIZES = mode === 'phone' ? [[914, 412], [760, 360]] : [[1280, 720], [1920, 1080]];
const ws = new WebSocket(`ws://127.0.0.1:${port}/session`);
let id = 0; const waiting = new Map();
const call = (method, params) => new Promise((res, rej) => { const i = ++id; waiting.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waiting.has(m.id)) { const w = waiting.get(m.id); waiting.delete(m.id); m.type === 'error' ? w.rej(new Error(m.error + ': ' + m.message)) : w.res(m.result); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ctx, tag = '', bad = 0;
const js = async expr => { const r = await call('script.evaluate', { expression: expr, target: { context: ctx }, awaitPromise: true }); if (r.exceptionDetails) throw new Error('js: ' + r.exceptionDetails.text); return r.result && r.result.value; };
const shot = async name => { const r = await call('browsingContext.captureScreenshot', { context: ctx }); fs.writeFileSync(`${outDir}/${tag}-${name}.png`, Buffer.from(r.data, 'base64')); };
const click = sel => js(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(sel)})].find(e => e.getClientRects().length); if (e) e.click(); return !!e; })()`);
// every visible piece of text, its size on screen; grouped by (what, size)
const small = `(() => { const MIN = ${MIN}, seen = new Map(); window.RULES = ${!!process.env.RULES};
  const vis = e => { for (let x = e; x && x !== document.documentElement; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false; } return true; };
  const zoomOf = e => { let z = 1; for (let x = e; x; x = x.parentElement) z *= parseFloat(getComputedStyle(x).zoom) || 1; return z; };
  const name = e => (e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\\s+/)[0] : '')) + ' in ' + (e.closest('[id]') || {}).id;
  for (const e of document.body.querySelectorAll('*')) {
    if (/^(CANVAS|SCRIPT|STYLE|OPTION)$/.test(e.tagName) || ((e.closest('#touchUI, #hud, #chat, #game, #over, #fog') && !e.closest('#freeOps, #pause')) || e.closest('#corner'))) continue;
    if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const r = e.getBoundingClientRect(); if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth || !vis(e)) continue;
    const cx = Math.min(innerWidth - 1, Math.max(0, r.left + Math.min(r.width / 2, 8))), cy = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2)), top = document.elementFromPoint(cx, cy);
    if (!top || !(top === e || e.contains(top) || top.contains(e))) continue; /* (covered by another page: not seen) */
    const px = parseFloat(getComputedStyle(e).fontSize) * zoomOf(e); if (px >= MIN) continue;
    let rule = ''; if (window.RULES) for (let x = e; x && !rule; x = x.parentElement) for (const sh of document.styleSheets) { let rs; try { rs = sh.cssRules; } catch { continue; } for (const ru of rs) if (ru.style && ru.style.fontSize && ru.selectorText) { try { if (x.matches(ru.selectorText)) rule = ru.selectorText + ' {' + ru.style.fontSize + '}'; } catch {} } }
    const k = name(e) + ' ' + px.toFixed(1); if (!seen.has(k)) seen.set(k, e.textContent.trim().replace(/\\s+/g, ' ').slice(0, 30) + (rule ? '" RULE ' + rule : '"'));
  }
  return [...seen].map(([k, t]) => k + 'px "' + t).join('\\n'); })()`;
const home = async () => { for (let i = 0; i < 4; i++) { if (await js("(() => { const h = document.getElementById('home'); if (!h || !h.getClientRects().length) return false; const r = h.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + 40); return !!t && h.contains(t); })()")) return; await click('#backBtn'); await sleep(400); } };
const uicheck = fs.readFileSync(new URL('./uicheck.js', import.meta.url), 'utf8').split('\n').filter(l => !l.startsWith('//')).join(' ');
const check = async name => { await sleep(500); await shot(name); const cut = await js(uicheck); if (cut) console.log(`== ${tag} ${name} CUT OFF:\n  ` + cut.replace(/\n/g, '\n  ')); const s = await js(small); const z = await js("getComputedStyle(document.documentElement).getPropertyValue('--uiz')"); if (s) bad += s.split('\n').length; console.log(`== ${tag} ${name} (menu zoom ${z || 1})${s ? '\n  ' + s.replace(/\n/g, '\n  ') : ' ok'}`); };

ws.onopen = async () => { try { await run(); } catch (e) { console.log('ERROR', e.message); } console.log(`TOTAL small-text kinds: ${bad}`); process.exit(0); };
async function run() {
  await call('session.new', { capabilities: {} });
  ctx = (await call('browsingContext.create', { type: 'tab' })).context;
  for (const [w, h] of SIZES) {
    tag = `${mode}-${w}x${h}`;
    await call('browsingContext.setViewport', { context: ctx, viewport: { width: w, height: h } });
    try { await call('browsingContext.navigate', { context: ctx, url, wait: 'complete' }); } catch { await sleep(1500); } await sleep(1500);
    await js(`localStorage.setItem('r62d-name', 'Reader'); localStorage.removeItem('r62d-penv'); Element.prototype.requestFullscreen = () => Promise.reject(); true`);
    try { await call('browsingContext.navigate', { context: ctx, url, wait: 'complete' }); } catch { await sleep(1500); } await sleep(2500);
    await js(`Element.prototype.requestFullscreen = () => Promise.reject(); true`);
    await check('0-title');
    for (let i = 0; i < 6 && await js("!document.getElementById('splash').classList.contains('hidden')"); i++) { await js("document.getElementById('splash').click(); document.getElementById('splash').dispatchEvent(new MouseEvent('pointerdown', {bubbles: true})); true"); await sleep(1200); }
    await check('1-home');
    for (const t of ['play', 'unranked', 'fun', 'join', 'free', 'tutorial', 'tv', 'replays', 'intel']) { await home(); await click(`[data-tab="${t}"]`); await check('2-tab-' + t); }
    await click('[data-tab="controls"]'); await check('2-controls');
    await home(); await click('[data-tab="settings"]'); await sleep(300);
    for (const p of ['sound', 'aim', 'keys', 'screen', 'cols', 'xhair']) { await click(`#settings .setSide [data-p="${p}"]`); await check('3-set-' + p); }
    await click('#setClose'); await sleep(300); await home();
    await click('[data-tab="profile"]'); await check('4-profile'); await click('#profilePage .close'); await sleep(400);
    await home(); await click('[data-tab="intel"]'); await sleep(300); await click('[data-tab="ops"]'); await check('4-operators'); await click('#opsPage .close'); await sleep(400);
    // (he asked 2026-11-20: no cut-off text anywhere) the other pages too: ranked, every INTEL page and its tabs
    await home(); await click('[data-tab="ranked"]'); await check('2-tab-ranked');
    for (const [t, pg] of [['armory', 'armoryPage'], ['maps', 'mapsPage'], ['playbook', 'playbookPage'], ['knowledge', 'bkPage']]) {
      await home(); await click('[data-tab="intel"]'); await sleep(300); await click(`[data-tab="${t}"]`); await sleep(1500); await check('4-' + t);
      const tabs = await js(`[...document.querySelectorAll('#${pg} .pagehead button:not(.close), #${pg} .bkTabs button, #${pg} .pbTabs button')].filter(e => e.getClientRects().length).length`);
      for (let i = 1; i < Math.min(tabs, 12); i++) { await js(`[...document.querySelectorAll('#${pg} .pagehead button:not(.close), #${pg} .bkTabs button, #${pg} .pbTabs button')].filter(e => e.getClientRects().length)[${i}]?.click(); true`); await sleep(500); await check('4-' + t + '-' + i); }
      await click(`#${pg} .close`); await sleep(400);
    }
    // free play: the operators / guns / god mode panel and the pause menu
    await home(); await click('[data-tab="free"]'); await sleep(300); await click('#freeGo');
    for (let i = 0; i < 30 && !(await js("!!document.getElementById('freeOpsBtn')")); i++) await sleep(500);
    await sleep(1500); await check('5-in-free-play');
    await click('#freeOpsBtn'); await sleep(800); await check('5-free-panel');
    await js("document.querySelector('#freeOps').scrollTop = 99999; true"); await check('5-free-panel-bottom');
    await click('#freeOps .close'); await sleep(400);
    await js("window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' })); true"); await check('6-pause');
    await click('#pResume');
    // in the match: the scoreboard, the map, the end screen
    await js("window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Tab', key: 'Tab' })); true"); await check('7-scoreboard'); await js("window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Tab', key: 'Tab' })); true");
    await js("window.dispatchEvent(new KeyboardEvent('keydown', { code: 'CapsLock', key: 'CapsLock' })); true"); await check('7-map'); await js("window.dispatchEvent(new KeyboardEvent('keydown', { code: 'CapsLock', key: 'CapsLock' })); true"); await sleep(300);
    await js("__r62d.st.forceEnd = true; true"); await sleep(2500); await check('8-end'); await js("__r62d.st.forceEnd = false; true");
  }
}
