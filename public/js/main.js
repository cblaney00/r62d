// R62D browser client: connects to the server, predicts your movement,
// draws the world with line-of-sight blackout, and runs the menus and HUD.
import { CELL, PHASE, T, MAT } from '/shared/constants.js';
import { buildMap, roomAt, floorAt, localPos, MAPS, MAP_LIST, holePortal, hatchNear, stairGhost, stairLooks } from '/shared/map.js';
import { stepMove, castSight, canSee, facingCell, angDiff, BASE_SPEED, DRONE_SPEED } from '/shared/physics.js';
import { OPERATORS, WEAPONS, GADGETS, opsForTeam, CLASS_NAME, gunMods, attFromCode, spreadCone, aimHeat } from '/shared/operators.js';
import { gunPicture } from './gunart.js';
import { MapRenderer } from './mapdraw.js';
import { S, setMapScale } from './textures.js';
import { drawOperator, drawDrone, drawCam, drawGadget, drawBomb, portrait, setShading } from './sprites.js';
import { FX, drawSmoke } from './fx.js';
import * as audio from './audio.js';
import { openOps, closeOps, updateOpsProfile, showLoadout } from './ops.js';
import { openProfile } from './profile.js';
import { openArmory, closeArmory } from './armory.js';
import { XH_DEFAULT, XH_STYLES, XH_COLORS, cleanXhair, drawXhair } from './crosshair.js';
import { readPad, PAD_ACTIONS, PAD_HELP } from './gamepad.js';
import { startMusic, stopMusic, setMood, setMusicVolume } from './music.js';
import { levelFor } from '/shared/progress.js';
import { LOADOUTS, GADGET_COUNT, cleanLoadout } from '/shared/operators.js';
import { ACTIONS, actionFor, bindsFor, setBind, resetBinds, keyName, label, getBinds, applyBinds, onBindsChange, BINDS_VERSION } from './keys.js';
import { walkRay, tileAt, findVault } from '/shared/physics.js';
import { createCoach } from './tutorial.js';
import { blocksSight, FL } from '/shared/constants.js';

const $ = id => document.getElementById(id);
// Stacked layers: the map (moved and scaled by the browser, see MapRenderer.mount), the people and effects, the line-of-sight blackout (drawn small and stretched by
// the browser for free) and markers/crosshair on top. 'ctx' points at whichever is being drawn.
const cv = $('game'), ctx0 = cv.getContext('2d'), mapLayer = $('mapLayer');
let ctx = ctx0;
const fog = $('fog'), fctx = fog.getContext('2d');
const over = $('over'), octx = over.getContext('2d');
let DPR = 1, VW = 0, VH = 0;

// Graphics quality (saved per computer): how many pixels get drawn and how many extras are added.
const GFX = {
  low:    { scale: 0.6,  fog: 0.3,  parts: 0.35, smoke: 7,  shade: false, rays: 0.5, map: 1.25, grey: 0.75 },
  medium: { scale: 0.8,  fog: 0.4,  parts: 0.6,  smoke: 11, shade: true, rays: 0.7, map: 2, grey: 1 },
  high:   { scale: 1,    fog: 0.5,  parts: 1,    smoke: 16, shade: true, rays: 1, map: 2.5, grey: 1.5 },
  ultra:  { scale: 1.25, fog: 0.75, parts: 1,    smoke: 22, shade: true, rays: 1.2, map: 3, grey: 1.5 },
};
const LEVELS = ['low', 'medium', 'high', 'ultra'];
// "auto" (the default) starts from a guess about this computer and steps down by itself if the game can't keep up
let gfxName = (() => { try { return localStorage.getItem('r62d-gfx') || 'auto'; } catch { return 'auto'; } })();
if (!GFX[gfxName] && gfxName !== 'auto') gfxName = 'auto';
let autoLevel = (() => {
  try { const s = localStorage.getItem('r62d-gfx-auto'); if (GFX[s]) return s; } catch {}
  const weak = (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory && navigator.deviceMemory <= 4);
  return weak ? 'medium' : 'high';
})();
const gfxLevel = () => (gfxName === 'auto' ? autoLevel : gfxName);
let gq = GFX[gfxLevel()];
setMapScale(gq.map);
function resize() {
  const oldW = VW || 1, oldH = VH || 1;
  DPR = Math.min(2, Math.min(window.devicePixelRatio || 1, 1.5) * gq.scale);
  VW = cv.width = over.width = Math.round(innerWidth * DPR); VH = cv.height = over.height = Math.round(innerHeight * DPR);
  fog.width = Math.ceil(VW * gq.fog); fog.height = Math.ceil(VH * gq.fog);
  mouse.x *= VW / oldW; mouse.y *= VH / oldH;
}
function setGfx(name) {
  if (!GFX[name] && name !== 'auto') return;
  gfxName = name;
  try { localStorage.setItem('r62d-gfx', name); } catch {}
  applyGfx();
}
function applyGfx() {
  const old = gq; gq = GFX[gfxLevel()];
  fx.quality = gq.parts; setShading(gq.shade);
  resize(); renderGfx();
  if (S !== gq.map || old.grey !== gq.grey) { // redraw the map picture at the new detail
    setMapScale(gq.map);
    if (st.rend) { st.rend = new MapRenderer(st.known, st.base, gq.grey); st.rend.splinters = st.splinters; st.rend.mount(mapLayer); st.warm = 4; }
  }
  perfWatch.skip = 2;
}
// Auto graphics: every 3 seconds of play, if frames are coming too slowly, drop one level (and remember it)
const perfWatch = { t: 0, n: 0, gap: 0, work: 0, skip: 2 };
function watchPerf(gapMs, workMs) {
  if (gfxName !== 'auto' || document.hidden || !playing()) return;
  perfWatch.n++; perfWatch.gap += gapMs; perfWatch.work += workMs; perfWatch.t += gapMs;
  if (perfWatch.t < 3000) return;
  const gap = perfWatch.gap / perfWatch.n, work = perfWatch.work / perfWatch.n;
  Object.assign(perfWatch, { t: 0, n: 0, gap: 0, work: 0 });
  if (perfWatch.skip > 0) { perfWatch.skip--; return; } // just after loading or a change: give it time to settle
  const i = LEVELS.indexOf(autoLevel);
  if ((gap > 24 || work > 12) && i > 0) {
    autoLevel = LEVELS[i - 1];
    try { localStorage.setItem('r62d-gfx-auto', autoLevel); } catch {}
    applyGfx();
    addFeed(`Graphics set to ${autoLevel[0].toUpperCase() + autoLevel.slice(1)} so the game runs smoothly`);
  }
}

// ---------------- state ----------------
const st = {
  ws: null, id: null, map: null, base: null, rend: null, mv: -1,
  snaps: [], last: null, me: null, pending: [], seq: 0, pred: { x: 0, y: 0 }, predCtrl: null, predDid: null,
  anim: new Map(), corpses: [], spect: 0, cam: { x: 600, y: 450 }, aim: 0, crouch: false,
  hitT: -9, hitKill: false, hurtT: -9, hurtFrom: 0, flashUntil: 0, bannerT: 0, evq: [], selBuilt: null,
  lastHud: 0, sideKnown: null, muted: false, endT: 0,
};
const fx = new FX();
const keys = new Set();
const mouse = { x: 0, y: 0, l: false, r: false, wl: 0, wr: 0 };
// Aim pad (default): a ring on the right of the screen works like a joystick. Where the knob sits in
// the ring sets which way you aim (and how far ahead you look), so turning round is a short flick
// across the ring instead of dragging the cursor all the way round your character.
// There is no dead middle: moving sideways always turns you (near the middle at the same rate as a
// little way out), and moving straight through the middle comes out the other side, aiming that way.
// "Turn" is FPS-style: mouse left/right turns you, up/down pushes the crosshair further/nearer.
// "Cursor" is the old way: you aim at wherever the cursor is.
// A controller's right stick always aims like the pad (see gamepad.js).
const AIM_MODES = ['pad', 'turn', 'cursor'];
let aimMode = (() => { try { const m = localStorage.getItem('r62d-aim'); return AIM_MODES.includes(m) ? m : 'pad'; } catch { return 'pad'; } })();
const pad = () => ({ x: VW * 0.84, y: VH * 0.52, r: VH * 0.12 });
let padOn = false, padAng = 0, padReach = 0.6;
const wrapAng = a => Math.atan2(Math.sin(a), Math.cos(a));
function padMove(dx, dy) { // a captured-mouse move, in screen pixels, applied to the knob
  const R = pad().r, c = Math.cos(padAng), sn = Math.sin(padAng);
  const along = dx * c + dy * sn, across = -dx * sn + dy * c;
  let r = padReach * R;
  padAng += across / Math.max(r, R * 0.25); // turning speed is capped near the middle so it never spins wildly
  r += along;
  if (r < 0) { r = -r; padAng += Math.PI; } // straight through the middle: out the other side
  padAng = wrapAng(padAng); padReach = Math.min(1, r / R);
}
function turnMove(dx, dy) {
  padAng = wrapAng(padAng + dx * 0.004);
  padReach = Math.max(0, Math.min(1, padReach - dy / (VH * 0.45)));
}
// controller state (merged with the keyboard and mouse in sendInput)
const gpk = { up: 0, down: 0, left: 0, right: 0, walk: 0, crouch: 0, fire: 0, ads: 0 };
let gpT = -1e9, mouseT = 0, gpLastL = 0, gpName = '';
const gpRecent = () => gpT > mouseT && performance.now() - gpT < 4000;
// the point you aim at, in screen pixels (with the aim pad this sits ahead of your character)
function cursor() {
  if (!padOn) return mouse;
  const z = st.zoom || 1, px = (st.pred.x - st.cam.x) * z + VW / 2, py = (st.pred.y - st.cam.y) * z + VH / 2;
  const cx = Math.cos(padAng), cy = Math.sin(padAng), m = 30 * DPR;
  let d = VH * 0.07 + padReach * VH * 0.36; // shortened if it would leave the screen (near the edge of a map)
  if (cx > 0.01) d = Math.min(d, (VW - m - px) / cx); else if (cx < -0.01) d = Math.min(d, (m - px) / cx);
  if (cy > 0.01) d = Math.min(d, (VH - m - py) / cy); else if (cy < -0.01) d = Math.min(d, (m - py) / cy);
  d = Math.max(d, 24 * DPR);
  return { x: px + cx * d, y: py + cy * d };
}
addEventListener('resize', resize); resize();
fx.quality = gq.parts; setShading(gq.shade);

// ---------------- network ----------------
function connect(mode = '') { // '' = the shared match, 'tut' / 'free' = a private one
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws${mode ? `?${mode}=1` : ''}`);
  st.ws = ws;
  ws.onopen = () => { if (st.rejoin) { st.rejoin = false; $('joinBtn').click(); } };
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.t === 'pong') { const r = performance.now() - m.c; st.rtt = st.rtt == null ? r : st.rtt * 0.7 + r * 0.3; return; }
    if (m.t === 'welcome') {
      if (st.tutorial) send({ t: 'tut', a: 'start', lesson: st.tutorial });
      if (st.free) send({ t: 'free', a: 'start', map: st.free.map, bots: st.free.bots, level: st.free.level });
      st.id = m.id;
      if (st.rend && m.mapId === st.mapId) { // the map already on screen: just bring it up to date
        resetMap(m.mapVersion);
        for (let k = 0; k < m.tiles.length; k++) if (m.tiles[k] !== st.map.tiles[k] || m.hp[k] !== st.map.hp[k]) {
          st.map.tiles[k] = st.known.tiles[k] = m.tiles[k]; st.map.hp[k] = st.known.hp[k] = m.hp[k]; holePortal(st.map, k); st.rend.cellChanged(k);
        }
        for (const k in m.holes || {}) { st.map.holes[k] = m.holes[k]; st.known.holes[k] = m.holes[k].slice(); st.rend.cellChanged(+k); }
      } else {
        st.mapLoading = true;
        runLoading('LOADING MAP', [['Building the map', () => loadMap(m.mapVersion, m.tiles, m.hp, m.mapId, m.holes)], ['Getting every floor ready', () => frames(6)]]).then(() => { st.mapLoading = false; });
      }
      st.token = m.token; st.profile = m.profile; updateCard();
      if (m.profile.settings) applySettings(m.profile.settings); else saveSettings(); // first time: keep what this browser had
      try { localStorage.setItem('r62d-token', m.token); } catch {}
      $('join').classList.add('hidden'); $('room').classList.remove('hidden');
    } else if (m.t === 'snap') onSnap(m);
    else if (m.t === 'full') alert('The game is full (10 players).');
    else if (m.t === 'taken') alert(`Someone is already playing as ${m.name}. Type a different name.`);
    else if (m.t === 'chat') addChat(m);
    else if (m.t === 'xp') { st.profile = m.profile; playXp(m); }
    else if (m.t === 'profile') { st.profile = m.profile; updateOpsProfile($('opsPage'), m.profile); st.loDirty = true; }
  };
  ws.onclose = () => { if (ws !== st.ws) return; $('conn').classList.remove('hidden'); $('conn').textContent = 'Disconnected — reconnecting…'; setTimeout(() => location.reload(), 2500); };
}
const send = o => { if (st.ws && st.ws.readyState === 1) st.ws.send(JSON.stringify(o)); };
// latency: a ping every 2 s; your own figure is shown on the HUD and sent on so the scoreboard shows everyone's
setInterval(() => send({ t: 'ping', c: performance.now(), rtt: st.rtt == null ? null : Math.round(st.rtt) }), 2000);

// ---------------- tutorial ----------------
// A lesson runs in its own private match on the server: leave the lobby, join a tutorial, come back after.
const coach = createCoach({ el: $('coach'), send, getMap: () => st.map, onExit: () => switchMatch(null) });
// free = { map, bots } for a free-play match (see the FREE PLAY page below)
function switchMatch(lesson, free = null) {
  if (!st.token) { setTab('play'); $('name').focus(); return; }
  st.tutorial = lesson; st.free = free; st.rejoin = true; st.marks = [];
  if (lesson) coach.start(lesson); else coach.stop();
  const leave = lesson ? 'Leave tutorial' : free ? 'Leave free play' : '';
  $('pEnd').textContent = leave || 'End match for everyone'; $('leaveBtn').textContent = leave || 'End match';
  const old = st.ws; connect(lesson ? 'tut' : free ? 'free' : ''); try { old.close(); } catch {}
  $('pause').classList.add('hidden');
}
for (const b of document.querySelectorAll('[data-lesson]')) b.onclick = () => switchMatch(b.dataset.lesson);

// ---------------- free play page ----------------
// Pick a map and how many enemy bots, then play alone with no clock, switching operator with N / B.
const freePick = { map: 'harbor', bots: 0, level: 1 };
try { Object.assign(freePick, JSON.parse(localStorage.getItem('r62d-free') || '{}')); } catch {}
if (!MAPS[freePick.map]) freePick.map = 'harbor';
function renderFree() {
  const el = $('freeMaps');
  if (!el.children.length) for (const id of MAP_LIST) {
    const M = MAPS[id], b = document.createElement('button');
    b.dataset.id = id; b.title = M.desc;
    b.appendChild(mapThumb(id).cloneNode()); b.querySelector('canvas').getContext('2d').drawImage(mapThumb(id), 0, 0);
    b.insertAdjacentHTML('beforeend', `<b>${esc(M.name)}</b><span>${esc(M.floors)}</span>`);
    b.onclick = () => { audio.ui(); freePick.map = id; renderFree(); };
    el.appendChild(b);
  }
  for (const b of el.children) b.classList.toggle('on', b.dataset.id === freePick.map);
  for (const b of $('freeBots').children) b.classList.toggle('on', +b.dataset.n === freePick.bots);
  for (const b of $('freeLevel').children) b.classList.toggle('on', +b.dataset.lv === freePick.level);
}
for (const b of $('freeBots').children) b.onclick = () => { audio.ui(); freePick.bots = +b.dataset.n; renderFree(); };
for (const b of $('freeLevel').children) b.onclick = () => { audio.ui(); freePick.level = +b.dataset.lv; renderFree(); };
$('freeGo').onclick = () => {
  try { localStorage.setItem('r62d-free', JSON.stringify(freePick)); } catch {}
  switchMatch(null, { ...freePick });
};

function loadMap(mv, tiles, hp, id, holes) {
  const t0 = performance.now();
  st.map = buildMap(id || st.mapId); st.mapId = st.map.id; st.base = st.map.tiles.slice(); st.mv = mv;
  if (tiles) { st.map.tiles.set(tiles); st.map.hp.set(hp); for (const h of st.map.hatches) holePortal(st.map, h.cells[0]); }
  if (holes) Object.assign(st.map.holes, holes);
  // What your team remembers of the map. It only catches up with the real map when
  // someone on your team actually sees the changed spot.
  st.known = { ...st.map, tiles: st.map.tiles.slice(), hp: st.map.hp.slice(), holes: {} };
  for (const k in st.map.holes) st.known.holes[k] = st.map.holes[k].slice();
  st.unseen = new Set();
  // broken glass lies in and just around every window; splinters appear where barricades get smashed
  st.glass = new Set(); st.splinters = new Set();
  for (const o of st.map.openings) if (o.kind === 'window') for (const k of o.cells) for (const d of [0, 1, -1, st.map.W, -st.map.W]) st.glass.add(k + d);
  st.rend = new MapRenderer(st.known, st.base, gq.grey); st.rend.mount(mapLayer); perfWatch.skip = 2; st.warm = 4;
  st.rend.splinters = st.splinters;
  st.corpses = []; fx.clear(); st.pending = [];
  st.loadMs = Math.round(performance.now() - t0); // map build + picture (shown in __r62d for speed checks)
}

// A new round on the same map: instead of redrawing the whole map picture (a visible stall), only
// the spots that changed last round (broken walls, barricades, blood, splinters) are redrawn, a few per frame.
function resetMap(mv) {
  const fresh = buildMap(st.mapId), K = st.known, R = st.rend;
  const dirty = new Set(R.decalCells || []); R.decalCells = new Set();
  for (const k of st.splinters) dirty.add(k);
  for (let k = 0; k < fresh.tiles.length; k++) if (K.tiles[k] !== fresh.tiles[k] || K.hp[k] !== fresh.hp[k]) dirty.add(k);
  for (const k in K.holes) dirty.add(+k);
  st.map = fresh; st.base = fresh.tiles.slice(); st.mv = mv;
  st.known = { ...fresh, tiles: fresh.tiles.slice(), hp: fresh.hp.slice(), holes: {} };
  st.unseen = new Set(); st.splinters = new Set();
  R.map = st.known; R.base = st.base; R.splinters = st.splinters;
  for (const k of dirty) R.cellChanged(k);
  st.corpses = []; fx.clear(); st.pending = [];
}

// ---------------- loading screen ----------------
const frames = n => new Promise(r => { const f = () => (--n <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
let loadingChain = Promise.resolve();
function runLoading(title, steps) { // one loading screen at a time; each step gets a painted frame first
  loadingChain = loadingChain.then(async () => {
    const el = $('loading'); el.classList.remove('hidden'); $('loadTitle').textContent = title;
    for (let i = 0; i < steps.length; i++) {
      $('loadStep').textContent = steps[i][0]; $('loadBar').style.width = Math.round(i / steps.length * 100) + '%';
      await frames(2);
      await steps[i][1]();
    }
    $('loadBar').style.width = '100%'; $('loadStep').textContent = 'Ready';
    await frames(4);
    el.classList.add('hidden');
  });
  return loadingChain;
}
// the same thing split into many small jobs, a slice per frame, so the bar keeps moving
const jobsStep = (jobs, perFrame) => async () => { for (let i = 0; i < jobs.length; i += perFrame) { jobs.slice(i, i + perFrame).forEach(j => j()); await frames(1); } };
const portraitCache = new Map();
function portraitCached(c, k) { // operator portraits are drawn once and copied after that
  let p = portraitCache.get(k);
  if (!p) { p = document.createElement('canvas'); p.width = 240; p.height = 240; portrait(p, k); portraitCache.set(k, p); }
  const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); x.drawImage(p, 0, 0, c.width, c.height);
}

function onSnap(s) {
  if (st.mapLoading) return; // a new map is being got ready behind the loading screen
  if (s.mp && s.mp !== st.mapId) { // a different map: build it behind a loading screen
    st.mapLoading = true;
    const name = MAPS[s.mp] ? MAPS[s.mp].name.toUpperCase() : 'MAP';
    runLoading(`LOADING ${name}`, [['Building the map', () => loadMap(s.mv, null, null, s.mp)], ['Getting every floor ready', () => frames(6)]]).then(() => { st.mapLoading = false; });
    return;
  }
  if (s.mv !== st.mv) { if (st.rend) resetMap(s.mv); else loadMap(s.mv, null, null, s.mp); } // same map, new round
  const m = st.map, now = performance.now() / 1000;
  const changed = [];
  for (let i = 0; i < s.cells.length; i += 3) {
    const k = s.cells[i];
    m.tiles[k] = s.cells[i + 1]; m.hp[k] = s.cells[i + 2];
    holePortal(m, k); // an opened hatch drops you through
    st.unseen.add(k);
  }
  for (let i = 0; i < (s.holes || []).length; i += 3) { // new bullet holes in soft walls
    const k = s.holes[i];
    (m.holes[k] || (m.holes[k] = [])).push(s.holes[i + 1], s.holes[i + 2]);
    st.unseen.add(k);
  }
  if (s.ph !== PHASE.PREP && s.ph !== PHASE.ACTION && s.ph !== PHASE.ROUND_END) revealAll();
  const players = new Map(s.players.map(p => [p.id, p]));
  if (s.mine && players.has(s.you)) { Object.assign(players.get(s.you), s.mine); st.mineAt = now; } // your own private details
  const ents = new Map(s.ents.map(e => [e.id, e]));
  st.snaps.push({ t: now, st: s.time, players, ents }); if (st.snaps.length > 12) st.snaps.shift();
  const prevMe = st.me;
  st.last = s; st.me = players.get(s.you) || null;
  for (const e of s.ev) onEvent(e, s, players);
  reconcile(prevMe);
}

function myCtrlPos(me, s) {
  if (!me || !me.a) return null;
  if (me.ct === 'drone') { const d = s.ents.find(e => e.id === me.did); return d ? { x: d.x, y: d.y, vx: d.vx, vy: d.vy, gait: 0 } : null; }
  return { x: me.x, y: me.y, vx: me.vx, vy: me.vy, gait: me.gt };
}

function reconcile() {
  const me = st.me, s = st.last;
  const pos = myCtrlPos(me, s);
  if (!pos) { st.pending = []; return; }
  if (st.predCtrl !== me.ct || st.predDid !== me.did) { st.predCtrl = me.ct; st.predDid = me.did; st.pending = []; }
  st.pending = st.pending.filter(i => i.s > me.ls);
  st.pred.x = pos.x; st.pred.y = pos.y; st.pred.vx = pos.vx || 0; st.pred.vy = pos.vy || 0; st.pred.gait = pos.gait || 0;
  const mods = me.m || {};
  for (const i of st.pending) stepMove(st.map, st.pred, i.k, i.dt, mods);
}

// ---------------- events from the server ----------------
function mySide() { return st.me ? st.me.tm : null; }
function nameOf(players, id) { const p = players.get(id); return p ? p.n : '?'; }

function onEvent(e, s, players) {
  const now = performance.now() / 1000;
  switch (e.e) {
    case 'shot': {
      const w = WEAPONS[e.w]; const a = Math.atan2(e.y2 - e.y, e.x2 - e.x);
      fx.tracer(e.x, e.y, e.x2, e.y2);
      const an = anim(e.id);
      if (an.lastShotSnd !== s.time && st.listen && st.map && !e.q && e.id !== st.id) { // gunfire on the floor above or below: an arrow towards it
        const lv = localPos(st.map, st.listen.x, st.listen.y), ls = localPos(st.map, e.x, e.y), fd = ls.f - lv.f;
        if (fd && Math.abs(fd) <= 1 && Math.hypot(ls.x - lv.x, ls.y - lv.y) < 700) {
          const ang = Math.atan2(ls.y - lv.y, ls.x - lv.x);
          st.shotHints = (st.shotHints || []).filter(h => !(h.fd === fd && Math.abs(angDiff(h.a, ang)) < 0.3));
          st.shotHints.push({ a: ang, fd, t: now });
        }
      }
      if (an.lastShotSnd !== s.time) { if (!e.q) fx.muzzle(e.x, e.y, a); audio.gunshot(w ? e.w : 'AR', e.x, e.y, e.id === st.id, !!e.q); audio.casing(e.x, e.y, surfaceAt(e.x, e.y), w && w.cls === 'Shotgun'); an.lastShotSnd = s.time; }
      an.recoil = 1.6; if (!e.q) an.flashT = now; // a suppressor hides the flash
      if (e.k === 'hard') { fx.impact(e.x2, e.y2, 'hard', a); audio.impact(hardMat(e.x2, e.y2, a), e.x2, e.y2); }
      else if (e.k === 'prop') { fx.impact(e.x2, e.y2, 'prop', a); audio.impact(Math.random() < 0.5 ? 'wood' : 'metal', e.x2, e.y2); }
      // a bullet passing close to you cracks past your ear
      if (e.id !== st.id && st.listen) {
        const L = st.listen, dx = e.x2 - e.x, dy = e.y2 - e.y, len2 = dx * dx + dy * dy || 1;
        const tt = Math.max(0, Math.min(1, ((L.x - e.x) * dx + (L.y - e.y) * dy) / len2));
        const px = e.x + dx * tt, py = e.y + dy * tt;
        if (tt > 0.05 && tt < 0.98 && Math.hypot(px - L.x, py - L.y) < 34) audio.whiz(px, py);
      }
      break;
    }
    case 'hit':
      fx.impact(e.x, e.y, e.k, e.a || 0);
      if (e.k === 'blood') { st.rend.blood(e.x, e.y, e.a || 0); audio.impact('flesh', e.x, e.y); }
      else if (e.k === 'spark') audio.impact('electronic', e.x, e.y);
      else if (e.k === 'wall') audio.impact(wallMat(e.x, e.y, e.a), e.x, e.y);
      else if (e.k === 'wood') audio.impact('wood', e.x, e.y);
      else if (e.k === 'shield') audio.impact('metal', e.x, e.y);
      break;
    case 'boom':
      fx.explosion(e.x, e.y, e.r, e.kind);
      if (e.kind !== 'stun' && e.kind !== 'emp') st.rend.scorch(e.x, e.y, Math.min(40, e.r * 0.6));
      audio.explosion(e.x, e.y, e.kind);
      break;
    case 'kill': {
      const v = players.get(e.victim), k = e.killer ? players.get(e.killer) : null;
      const prev = st.snaps.length > 1 ? st.snaps[st.snaps.length - 2].players.get(e.victim) : null;
      const pos = prev && prev.x !== undefined ? prev : null;
      if (pos && v && (v.tm === mySide() || teamSees(pos.x, pos.y))) { st.corpses.push({ x: pos.x, y: pos.y, aim: pos.ag, op: v.op, w: pos.w, ally: v.tm === mySide() }); st.rend.pool(pos.x, pos.y); }
      addKill(k, v, e.w, e.hs);
      if (e.hs && k && k.id === st.id) audio.ui('headshot');
      break;
    }
    case 'down': { const v = players.get(e.id); if (v) addFeed(`${v.n} is down`); break; }
    case 'msg': if (!e.team || e.team === mySide()) addFeed(e.text); break;
    case 'banner': if (!e.team || e.team === mySide()) banner(e.text, e.sub); audio.ui('round'); break;
    case 'roundEnd': {
      const won = st.me && e.squad === st.me.sq;
      banner(won ? 'ROUND WON' : 'ROUND LOST', e.reason, won ? 'var(--ally)' : 'var(--enemy)');
      break;
    }
    case 'matchEnd': st.endT = now; st.mvp = e.mvp; showEnd(e.squad); break;
    case 'stun': if (st.me && e.id === st.me.id) { st.flashUntil = now + e.dur; audio.tinnitus(e.dur); } break;
    case 'hurt': if (st.me && e.id === st.me.id) { st.hurtT = now; st.hurtFrom = e.from; } break;
    case 'hitmark': if (e.to === st.id) { st.hitT = now; st.hitKill = e.kill; audio.ui(e.kill ? 'kill' : 'hit'); } break;
    case 'arc': fx.tracer(e.x, e.y, e.x2, e.y2, '130,200,255'); fx.tracer(e.x, e.y, e.x2 + 2, e.y2 - 2, '200,230,255'); fx.impact(e.x2, e.y2, 'spark'); audio.impact('electronic', e.x2, e.y2); break;
    case 'laser': fx.tracer(e.x, e.y, e.x2, e.y2, '255,50,50'); fx.impact(e.x2, e.y2, 'spark'); audio.foley('tick', e.x, e.y); break;
    case 'daze': if (st.me && e.id === st.me.id) { st.dazeUntil = now + e.dur; audio.tinnitus(1); } break;
    case 'mark': if (e.team === mySide()) {
      st.marks = (st.marks || []).filter(k => !(k.from === e.from && (k.id === e.id && e.id != null || st.marks.filter(q => q.from === e.from).length >= 3)));
      st.marks.push({ ...e, t: now }); fx.ping(e.x, e.y, e.w.startsWith('ENEMY') ? '255,70,70' : '255,210,74');
      if (e.from !== st.id) audio.foley('spot');
    } break;
    case 'ping': if (e.team === mySide()) { fx.ping(e.x, e.y, e.any ? '255,90,60' : '79,179,169'); audio.foley('beep', e.x, e.y); } break;
    case 'stim': fx.tracer(e.x, e.y, e.x2, e.y2, '120,255,160'); fx.ping(e.x2, e.y2, '120,255,160'); audio.foley('revive', e.x, e.y); break;
    case 'melee': anim(e.id).melee = 1; { const p = players.get(e.id); if (p && p.x !== undefined) audio.foley('melee', p.x, p.y, e.id === st.id); } break;
    case 'snd': audio.play(e.s, e.x, e.y); break;
  }
}

function anim(id) { let a = st.anim.get(id); if (!a) st.anim.set(id, a = { walk: 0, recoil: 0, melee: 0, flashT: -9, lx: 0, ly: 0, stepAcc: 0 }); return a; }

// ---------------- input ----------------
// `keys` holds the names of actions currently held down (see keys.js for the bindings).
let rebinding = null;
addEventListener('keydown', e => {
  if (rebinding) { e.preventDefault(); if (e.code !== 'Escape') setBind(rebinding.id, rebinding.slot, e.code); rebinding = null; renderSettings(); return; }
  if (e.code === 'Escape' && document.activeElement && document.activeElement.tagName === 'INPUT') document.activeElement.blur();
  if (document.activeElement === $('chatIn')) { chatKey(e); return; }
  if (document.activeElement && document.activeElement.tagName === 'INPUT') { if (e.key === 'Enter') $('joinBtn').click(); return; }
  if (e.code === 'Space' && coach.active && !e.repeat && coach.space(st.last)) { e.preventDefault(); return; }
  const a = actionFor(e.code);
  if (a || e.code === 'AltLeft' || e.code === 'AltRight' || e.code === 'Tab') e.preventDefault();
  if (!a || keys.has(a)) return;
  pressAction(a, e);
});
function pressAction(a, e) {
  keys.add(a);
  audio.initAudio();
  const ev = st.evq;
  switch (a) {
    case 'reload': ev.push({ k: 'reload' }); break;
    case 'primary': ev.push({ k: 'slot', n: 0 }); break;
    case 'secondary': ev.push({ k: 'slot', n: 1 }); break;
    case 'melee': ev.push({ k: 'melee' }); break;
    case 'gadget': ev.push({ k: 'gadget' }); audio.foley('gadget'); break;
    case 'ability': ev.push({ k: 'ability' }); audio.foley('gadget'); break;
    case 'view': ev.push({ k: 'view' }); break;
    case 'settings': toggleSettings(); break;
    case 'pause': escape(); break;
    case 'spot': st.spotReq = true; break;
    case 'chat': if (st.id) { e && e.preventDefault(); keys.delete('chat'); openChat(true); } break;
    case 'left': case 'right': if (st.me && st.me.ct === 'cam') ev.push({ k: a === 'right' ? 'camNext' : 'camPrev' }); break;
    case 'swap': if (st.me) ev.push({ k: 'slot', n: st.me.sl === 0 ? 1 : 0 }); break;
    case 'vault': ev.push({ k: 'vault', a: Math.round(vaultDir() * 1000) / 1000 }); break;
    case 'opNext': case 'opPrev': if (st.last && st.last.fp) send({ t: 'free', a: 'op', dir: a === 'opNext' ? 1 : -1 }); break;
    case 'camPrev': case 'camNext': if (st.me && (st.me.ct === 'cam' || st.me.ct === 'drone')) ev.push({ k: a }); break;
  }
}
// Vaulting goes the way you're moving, or where you look when standing still.
function vaultDir() {
  const mx = (keys.has('right') || gpk.right ? 1 : 0) - (keys.has('left') || gpk.left ? 1 : 0), my = (keys.has('down') || gpk.down ? 1 : 0) - (keys.has('up') || gpk.up ? 1 : 0);
  return mx || my ? Math.atan2(my, mx) : st.aim;
}
// Read the controller once a frame and turn it into the same actions as the keyboard and mouse.
function pollPad(dt, view) {
  const gp = readPad();
  if (!gp) { if (gpName) { for (const k in gpk) gpk[k] = 0; gpName = ''; renderSettings(); } return; }
  if (!gpName) { gpName = gp.name; renderSettings(); }
  const { ls, rs } = gp;
  if (ls.l || rs.l || gp.lt > 0.2 || gp.rt > 0.2 || gp.held.some(Boolean)) gpT = performance.now();
  if (menuOpen()) { // only Menu works in menus (to close the pause menu)
    if (gp.pressed[9]) escape();
    gpk.fire = gpk.ads = 0; return;
  }
  for (let i = 0; i < gp.pressed.length; i++) {
    const a = PAD_ACTIONS[i]; if (!a) continue;
    if (gp.pressed[i]) {
      if (a === 'crouch') gpk.crouch = gpk.crouch ? 0 : 1;
      else if (a === 'pause') escape();
      else pressAction(a);
    }
    if (gp.released[i] && a !== 'crouch') keys.delete(a);
  }
  // left stick: 8 directions like WASD; a light push walks (silent)
  const nx = ls.l ? ls.x / ls.l : 0, ny = ls.l ? ls.y / ls.l : 0;
  gpk.right = ls.l && nx > 0.38 ? 1 : 0; gpk.left = ls.l && nx < -0.38 ? 1 : 0;
  gpk.down = ls.l && ny > 0.38 ? 1 : 0; gpk.up = ls.l && ny < -0.38 ? 1 : 0;
  gpk.walk = ls.l && ls.l < 0.55 ? 1 : 0;
  if (gp.rt > 0.35 && !gpk.fire) mouse.wl++; // a trigger pull also counts as a click (next teammate, ping in a camera)
  gpk.fire = gp.rt > 0.35 ? 1 : 0; gpk.ads = gp.lt > 0.35 ? 1 : 0;
  // right stick: aim. A stick snapping back to the middle when let go is ignored, so the aim stays put.
  const falling = (gpLastL - rs.l) / Math.max(dt, 1e-3) > 4;
  if (rs.l > 0.05 && !falling) {
    if (view && view.kind === 'cam') { mouse.x = VW / 2 + rs.x / rs.l * VH * 0.25; mouse.y = VH / 2 + rs.y / rs.l * VH * 0.25; }
    else { padAng = Math.atan2(rs.y, rs.x); padReach = rs.l; }
  }
  gpLastL = rs.l;
}
addEventListener('keyup', e => {
  if (e.code === 'AltLeft' || e.code === 'AltRight') e.preventDefault(); // stop Firefox's menu bar popping up
  const a = actionFor(e.code); if (a) keys.delete(a);
});
addEventListener('blur', () => { keys.clear(); mouse.l = mouse.r = false; });
cv.addEventListener('mousemove', e => {
  mouseT = performance.now();
  if (document.pointerLockElement === cv) {
    const ads = mouse.r && st.me && st.me.a && st.me.ct === 'body';
    const k = ($('sens').value / 100) * (ads ? $('adsSens').value / 100 : 1) * DPR;
    if (padOn && aimMode === 'pad') { padMove(e.movementX * k, e.movementY * k); return; }
    if (padOn && aimMode === 'turn') { turnMove(e.movementX * k, e.movementY * k); return; }
    mouse.x = Math.max(0, Math.min(VW, mouse.x + e.movementX * k));
    mouse.y = Math.max(0, Math.min(VH, mouse.y + e.movementY * k));
  } else { mouse.x = e.clientX * DPR; mouse.y = e.clientY * DPR; }
});
cv.addEventListener('mousedown', e => {
  audio.initAudio();
  if (playing() && !menuOpen() && document.pointerLockElement !== cv) cv.requestPointerLock?.();
  if (e.button === 0) { mouse.l = true; mouse.wl++; }
  if (e.button === 2) { mouse.r = true; mouse.wr++; }
});
addEventListener('mouseup', e => { if (e.button === 0) mouse.l = false; if (e.button === 2) mouse.r = false; });
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('wheel', e => {
  if (!st.me || !st.me.a) return;
  if (st.me.ct === 'cam' || st.me.ct === 'drone') st.evq.push({ k: e.deltaY > 0 ? 'camNext' : 'camPrev' }); // flip through the team's cameras / drones
  else st.evq.push({ k: 'slot', n: st.me.sl === 0 ? 1 : 0 });
}, { passive: true });
cv.addEventListener('mousedown', e => { if (e.button === 1) { e.preventDefault(); st.spotReq = true; } });

// ---------------- settings ----------------
function toggleSettings() { $('settings').classList.toggle('hidden'); renderSettings(); }
function renderSettings() {
  const el = $('settings'); if (el.classList.contains('hidden')) return;
  const rows = ACTIONS.map(([id, name]) => {
    const b = bindsFor(id);
    const btn = slot => `<button data-id="${id}" data-slot="${slot}" class="${rebinding && rebinding.id === id && rebinding.slot === slot ? 'wait' : ''}">${rebinding && rebinding.id === id && rebinding.slot === slot ? 'PRESS A KEY…' : keyName(b[slot])}</button>`;
    return `<tr><td>${name}</td><td>${btn(0)}</td><td>${btn(1)}</td></tr>`;
  }).join('');
  $('bindTable').innerHTML = `<tr><th>ACTION</th><th>KEY</th><th>ALTERNATE</th></tr>${rows}
    <tr><td>Shoot / Aim down sights</td><td>Left mouse</td><td>Right mouse</td></tr>
    <tr><td>Ping</td><td>Middle mouse</td><td></td></tr>
    <tr><th>XBOX CONTROLLER</th><th colspan="2">${gpName ? 'CONNECTED' : 'NOT CONNECTED (plug it in and press a button)'}</th></tr>
    ${PAD_HELP.map(([n, b]) => `<tr><td>${n}</td><td colspan="2">${b}</td></tr>`).join('')}`;
  for (const b of $('bindTable').querySelectorAll('button')) b.onclick = () => { rebinding = { id: b.dataset.id, slot: +b.dataset.slot }; renderSettings(); };
}
$('setReset').onclick = () => { resetBinds(); renderSettings(); };
// crosshair: chosen in Settings, saved in your profile
let xh = (() => { try { return cleanXhair(JSON.parse(localStorage.getItem('r62d-xh') || 'null')); } catch { return cleanXhair(); } })();
function setXhair(o, save = true) {
  xh = cleanXhair(o);
  try { localStorage.setItem('r62d-xh', JSON.stringify(xh)); } catch {}
  renderXhair(); if (save) saveSettings();
}
function renderXhair() {
  $('xhStyle').innerHTML = XH_STYLES.map(([k, n]) => `<button data-v="${k}" class="${xh.style === k ? 'on' : ''}">${n}</button>`).join('');
  $('xhColor').innerHTML = XH_COLORS.map(c => `<button data-v="${c}" class="sw${xh.color === c ? ' on' : ''}" style="background:${c}"></button>`).join('');
  for (const k of ['len', 'thick', 'gap', 'alpha']) { $('xh_' + k).value = xh[k]; $('xh_' + k + 'V').textContent = xh[k]; }
  for (const k of ['outline', 'dynamic']) { const b = $('xh_' + k); b.textContent = xh[k] ? 'ON' : 'OFF'; b.classList.toggle('on', xh[k]); }
  const c = $('xhPreview'), x = c.getContext('2d'), k = 2;
  x.fillStyle = '#5b6168'; x.fillRect(0, 0, c.width, c.height / 2); x.fillStyle = '#1b1e22'; x.fillRect(0, c.height / 2, c.width, c.height / 2);
  drawXhair(x, c.width / 2, c.height / 2, xh, 0, k);
}
$('xhStyle').onclick = e => { const v = e.target.dataset.v; if (v) { audio.ui(); setXhair({ ...xh, style: v }); } };
$('xhColor').onclick = e => { const v = e.target.dataset.v; if (v) { audio.ui(); setXhair({ ...xh, color: v }); } };
for (const k of ['len', 'thick', 'gap', 'alpha']) $('xh_' + k).oninput = e => setXhair({ ...xh, [k]: +e.target.value });
for (const k of ['outline', 'dynamic']) $('xh_' + k).onclick = () => { audio.ui(); setXhair({ ...xh, [k]: !xh[k] }); };
$('xhReset').onclick = () => { audio.ui(); setXhair(XH_DEFAULT); };
renderXhair();
// graphics: fullscreen switch + quality presets
const GFX_HINT = { auto: 'Auto — picks the quality for this computer and lowers it by itself if the game can\'t keep up.', low: 'Low — for weak computers: fewer pixels, fewer particles, flat lighting.', medium: 'Medium — a little softer picture, runs well on most computers.', high: 'High — full sharpness. Recommended.', ultra: 'Ultra — extra-sharp, smoothest edges and most effects. Needs a strong computer.' };
function renderGfx() {
  for (const b of $('gfxSeg').querySelectorAll('button')) b.classList.toggle('on', b.dataset.q === gfxName);
  const app = new URLSearchParams(location.search).has('app'), on = app || !!document.fullscreenElement;
  const t = $('fsToggle'); t.textContent = on ? 'ON' : 'OFF'; t.classList.toggle('on', on); t.disabled = app;
  t.title = app ? 'The desktop app always runs full screen' : '';
  $('gfxHint').textContent = GFX_HINT[gfxName] + (gfxName === 'auto' ? ` Now: ${autoLevel[0].toUpperCase() + autoLevel.slice(1)}.` : '') + (app ? '  (The desktop app is always full screen.)' : '');
}
for (const b of $('gfxSeg').querySelectorAll('button')) b.onclick = () => { audio.ui(); setGfx(b.dataset.q); };
$('fsToggle').onclick = () => toggleFullscreen();
document.addEventListener('fullscreenchange', renderGfx);
renderGfx();
$('setClose').onclick = () => toggleSettings();
$('setBtn').onclick = () => toggleSettings();
$('lobbySetBtn').onclick = () => toggleSettings();
// Volume sliders follow loudness, not raw gain: each step is 0.5 dB, so the whole slider spans 50 dB (audio.sliderGain).
// He asked for a quieter start: the default master (70) is about a third as loud as full.
const VOL_DEF = { volMaster: 70, volSfx: 100, volMusic: 88 };
// a slider saved before the curve was straight gain: convert it, and never come back louder than the new default
const fromOld = (k, v) => Math.min(VOL_DEF[k], v <= 0 ? 0 : Math.max(0, Math.round(100 + 40 * Math.log10(v / 100))));
const saveVol = () => { try { localStorage.setItem('r62d-vol2', JSON.stringify([+$('volMaster').value, +$('volSfx').value])); } catch {} };
try {
  const v = JSON.parse(localStorage.getItem('r62d-vol2') || 'null'), o = JSON.parse(localStorage.getItem('r62d-vol') || 'null');
  if (v) { $('volMaster').value = v[0]; $('volSfx').value = v[1]; } else if (o) { $('volMaster').value = fromOld('volMaster', o[0]); $('volSfx').value = fromOld('volSfx', o[1]); }
} catch {}
const applyVol = () => audio.setVolume(st.muted ? 0 : audio.sliderGain(+$('volMaster').value), audio.sliderGain(+$('volSfx').value));
const musicVol = () => st.muted ? 0 : audio.sliderGain(+$('volMusic').value);
$('volMaster').oninput = () => { applyVol(); saveVol(); };
$('volSfx').oninput = () => { applyVol(); saveVol(); };
applyVol();

// ---------------- menus ----------------
$('name').value = (() => { try { return localStorage.getItem('r62d-name') || ''; } catch { return ''; } })();
$('joinBtn').onclick = () => {
  audio.initAudio(); audio.ui();
  const n = $('name').value.trim() || 'Operator';
  try { localStorage.setItem('r62d-name', n); } catch {}
  send({ t: 'join', name: n }); // your name is your profile (no password)
};
document.querySelectorAll('[data-bot]').forEach(b => b.onclick = () => { send({ t: 'lobby', a: 'addBot', squad: +b.dataset.bot }); });
document.querySelectorAll('[data-unbot]').forEach(b => b.onclick = () => { send({ t: 'lobby', a: 'removeBot', squad: +b.dataset.unbot }); });
$('switchBtn').onclick = () => { send({ t: 'lobby', a: 'switch' }); };
$('fillBtn').onclick = () => { send({ t: 'lobby', a: 'fillBots' }); };
for (const b of $('botLevel').children) b.onclick = () => { audio.ui(); send({ t: 'lobby', a: 'botLevel', lv: +b.dataset.lv }); };
$('startBtn').onclick = () => { send({ t: 'lobby', a: 'start' }); };
$('leaveBtn').onclick = () => { if (st.tutorial || st.free) return switchMatch(null); if (confirm('End the match for everyone and go back to the lobby?')) send({ t: 'lobby', a: 'end' }); };
$('fsBtn').onclick = () => toggleFullscreen();
$('muteBtn').onclick = () => { st.muted = !st.muted; applyVol(); setMusicVolume(musicVol()); $('muteBtn').textContent = st.muted ? '🔇' : '🔊'; };
function renderControls() {
  const L = id => keyName(bindsFor(id)[0]);
  const rows = [[`${L('up')}${L('left')}${L('down')}${L('right')}`, 'Move'], ['Mouse', 'Aim'], ['Left click', 'Shoot'], ['Right click', 'Aim down sights'],
    [L('walk'), 'Walk (silent)'], [L('crouch'), 'Crouch (hold, silent)'], [L('reload'), 'Reload'],
    [L('interact') + ' (hold)', 'Reinforce, barricade, plant, defuse, revive'], [L('ability'), 'Operator skill'],
    [L('gadget'), 'Secondary gadget'], [L('melee'), 'Melee'], [L('view'), 'Drone / Cameras'], [L('spot') + ' · Middle click', 'Ping (enemies, gadgets, walls, doors, places)'],
    [`${L('primary')} / ${L('secondary')} · Wheel`, 'Switch weapon'], [L('scoreboard'), 'Scoreboard']];
  const html = rows.map(([k, d]) => `<span>${k}</span>${d}`).join('');
  if ($('ctlGrid').innerHTML !== html) $('ctlGrid').innerHTML = html;
}


// Little top-down pictures of each map's ground floor for the lobby's map picker.
const mapThumbs = new Map();
function mapThumb(id) {
  if (mapThumbs.has(id)) return mapThumbs.get(id);
  const m = buildMap(id), F = m.floors.find(f => f.name === '1F') || m.floors[0];
  const c = document.createElement('canvas'); c.width = F.w * 3; c.height = F.h * 3; const x = c.getContext('2d');
  const FC = { [FL.GRASS]: '#33502c', [FL.ASPHALT]: '#2c2e31', [FL.WOOD]: '#7a5534', [FL.TILE]: '#9aa2a6', [FL.CARPET]: '#4a5a78', [FL.CONCRETE]: '#6d6d68', [FL.MARBLE]: '#c7c2b8', [FL.SERVER]: '#3d4650' };
  for (let y = 0; y < F.h; y++) for (let gx = F.gx; gx < F.gx + F.w; gx++) {
    const k = y * m.W + gx, t = m.tiles[k];
    x.fillStyle = t === T.HARD || t === T.SOFT ? '#d8d2c4' : t === T.TALL ? '#22262a' : t === T.OPEN ? '#e0b54a' : t === T.STAIR ? '#f2c14e' : FC[m.floor[k]] || '#111';
    x.fillRect((gx - F.gx) * 3, y * 3, 3, 3);
  }
  mapThumbs.set(id, c); return c;
}
function renderMapPick(s) {
  const el = $('mapPick'), key = s.mp + ':' + (s.ph === PHASE.LOBBY);
  if (el.dataset.k === key) return;
  el.dataset.k = key; el.innerHTML = '';
  for (const id of MAP_LIST) {
    const M = MAPS[id], b = document.createElement('button');
    b.className = id === s.mp ? 'on' : ''; b.title = M.desc;
    b.appendChild(mapThumb(id).cloneNode()); b.querySelector('canvas').getContext('2d').drawImage(mapThumb(id), 0, 0);
    b.insertAdjacentHTML('beforeend', `<b>${esc(M.name)}</b><span>${esc(M.floors)}</span>`);
    b.onclick = () => { audio.ui(); send({ t: 'lobby', a: 'map', id }); };
    el.appendChild(b);
  }
  $('lobbyHint').textContent = `${MAPS[s.mp] ? MAPS[s.mp].name + ' · ' + MAPS[s.mp].desc + ' · ' : ''}First to 3 rounds · Sides swap every round`;
}
function renderLobby(s) {
  renderControls(); renderMapPick(s);
  for (const b of $('botLevel').children) b.classList.toggle('on', +b.dataset.lv === (s.bl ?? 1));
  // the address friends type to join (the first network card is the wired one)
  if (st.addr === undefined || (st.addrT && performance.now() - st.addrT > 15000)) { st.addr = st.addr || null; st.addrT = performance.now(); fetch('/api/addr').then(r => r.json()).then(a => { st.addr = a; }).catch(() => { setTimeout(() => { st.addr = undefined; }, 3000); }); }
  const u = st.addr && st.addr.urls[0], jt = !u ? '' : u.vpn ? `Friends on the homelab VPN join at ${u.url}` : `Friends join at ${u.url} · turn on homelab-vpn to play over the VPN`;
  if ($('joinAddr').textContent !== jt) $('joinAddr').textContent = jt;
  for (const sq of [0, 1]) {
    const ul = document.querySelector(`#sq${sq} ul`);
    const list = s.players.filter(p => p.sq === sq);
    const html = list.map(p => `<li class="${p.id === s.you ? 'me' : ''}"><span>${esc(p.n)}</span>${p.b ? '<span class="bot">BOT</span>' : ''}</li>`).join('') +
      Array(Math.max(0, 5 - list.length)).fill('<li style="opacity:.3"><span>— empty —</span></li>').join('');
    if (ul.innerHTML !== html) ul.innerHTML = html;
  }
}
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// the big loadout panel beside the operator cards: your pick once you have one, before that whichever card the mouse is on
function showSelLoadout(op, mine) {
  $('loNote').textContent = mine ? '' : 'PREVIEW · CLICK THE CARD TO PICK';
  if (st.loShown === op && !st.loDirty) return;
  st.loShown = op; st.loDirty = false;
  showLoadout($('selLoBody'), { profile: st.profile, send, op });
}
function buildSelect(s) {
  const me = st.me; if (!me) return;
  const side = me.tm, key = s.rd + side;
  if (st.selBuilt !== key) {
    st.selBuilt = key;
    const grid = $('opgrid'); grid.innerHTML = '';
    for (const k of opsForTeam(side)) {
      const o = OPERATORS[k];
      const d = document.createElement('div'); d.className = 'op'; d.dataset.op = k;
      const c = document.createElement('canvas'); c.width = 240; c.height = 240; portraitCached(c, k);
      d.innerHTML = `<div class="who"></div>`;
      d.appendChild(c);
      const info = document.createElement('div'); info.className = 'info';
      info.innerHTML = `<div class="nm">${o.name}</div><div class="role">${o.role}</div><div class="ab">${o.ability.name}</div>`;
      d.appendChild(info);
      d.onmouseenter = () => { if (!document.querySelector('#opgrid .op.mine')) showSelLoadout(k, false); };
      d.onclick = () => { send({ t: 'pick', op: k }); };
      grid.appendChild(d);
    }
    st.loShown = null;
    if (grid.firstChild) showSelLoadout(grid.firstChild.dataset.op, false);
  }
  const mates = s.players.filter(p => p.sq === me.sq);
  for (const d of document.querySelectorAll('#opgrid .op')) {
    const who = mates.find(p => p.op === d.dataset.op);
    const mineNow = !!who && who.id === me.id;
    if (mineNow && !d.classList.contains('mine')) { d.classList.add('locked'); audio.ui('lock'); setTimeout(() => d.classList.remove('locked'), 700); }
    d.classList.toggle('mine', mineNow);
    if (mineNow) showSelLoadout(d.dataset.op, true);
    d.classList.toggle('taken', !!who && who.id !== me.id);
    d.querySelector('.who').textContent = who ? who.n : '';
    d.querySelector('.who').style.display = who ? '' : 'none';
  }
  if (st.loDirty && st.loShown && !document.querySelector('#opgrid .op.mine')) showSelLoadout(st.loShown, false);
  $('selSide').textContent = `ROUND ${s.rd} — ${side === 'atk' ? 'ATTACK' : 'DEFENCE'}`;
  $('selSide').style.color = side === 'atk' ? '#ffb27a' : '#8fc8ff';
  const site = st.map.sites[s.site];
  const spawns = st.map.atkSpawns, mySpawn = spawns[me.spn] || spawns[0];
  const sc = $('siteChoice'), sk = side === 'def' ? s.rd + ':' + s.site : 'atk:' + s.rd + ':' + me.spn;
  if (sc.dataset.k !== sk) {
    sc.dataset.k = sk;
    // defenders pick the site; each attacker picks where they start (he asked)
    sc.innerHTML = side === 'def' ? '<span>CHOOSE THE SITE TO DEFEND</span>' + st.map.sites.map((x, i) => `<button data-n="${i}" class="${i === s.site ? 'on' : ''}">${esc(x.name)}</button>`).join('')
      : '<span>CHOOSE YOUR SPAWN</span>' + spawns.map((x, i) => `<button data-n="${i}" class="${i === me.spn ? 'on atk' : 'atk'}">${esc(x.name)}</button>`).join('');
    for (const b of sc.querySelectorAll('button')) b.onclick = () => { audio.ui(); send(side === 'def' ? { t: 'site', n: +b.dataset.n } : { t: 'spawn', n: +b.dataset.n }); };
  }
  drawSpawnMap(side === 'atk' ? mates : null, me);
  const mapName = st.map.name.toUpperCase();
  $('selInfo').textContent = side === 'def' ? `DEFEND: ${site.name.toUpperCase()}  ·  ${mapName}` : `SPAWN: ${mySpawn.name.toUpperCase()}  ·  OBJECTIVE UNKNOWN  ·  ${mapName}`;
  // no clock (he asked): the round starts once everyone has locked in. The tutorial still counts down for its coach.
  const humans = s.players.filter(p => !p.b), ready = s.players.filter(p => p.lk).length;
  if (s.tu) $('selTime').textContent = Math.ceil(s.tm);
  else $('selTime').innerHTML = `<small>READY</small>${ready}<small>/${s.players.length}</small>`;
  const lb = $('lockBtn');
  lb.classList.toggle('hidden', !!s.tu);
  lb.disabled = !me.op || !!me.lk;
  lb.textContent = me.lk ? 'LOCKED IN' : me.op ? 'LOCK IN' : 'PICK AN OPERATOR';
  lb.classList.toggle('done', !!me.lk);
  $('opgrid').classList.toggle('lockedIn', !!me.lk);
  $('picks').innerHTML = mates.map(p => `<span class="${p.lk ? 'lk' : ''}"><b>${esc(p.n)}</b> ${p.op ? OPERATORS[p.op].name : '…'}${p.lk ? ' ✓' : ''}</span>`).join('')
    + (humans.some(p => !p.lk) ? `<span class="wait">Waiting for ${humans.filter(p => !p.lk).map(p => esc(p.n)).join(', ')}</span>` : '');
}
$('lockBtn').onclick = () => { if (st.me && st.me.op && !st.me.lk) { audio.ui('lock'); send({ t: 'lock' }); } };

// A small map of the ground floor with the attacker spawns: yours ringed in gold, a number for teammates starting there.
// Click a spawn to start there.
function drawSpawnMap(mates, me) {
  const c = $('spawnMap'); c.classList.toggle('hidden', !mates);
  if (!mates || !st.map) return;
  const m = st.map, spawns = m.atkSpawns, f = Math.max(0, floorAt(m, spawns[0].x, spawns[0].y));
  if (!st.spawnBase || st.spawnBase.v !== st.mv) { // the floor picture, drawn once per map
    let x0 = m.W, y0 = m.H, x1 = 0, y1 = 0;
    for (let k = 0; k < m.tiles.length; k++) if (m.flAt[k] === f) { const x = k % m.W, y = (k / m.W) | 0; if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
    const w = x1 - x0 + 1, h = y1 - y0 + 1, img = document.createElement('canvas'); img.width = w; img.height = h;
    const g = img.getContext('2d'), id = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = (y + y0) * m.W + x + x0, t = m.tiles[k], i = (y * w + x) * 4;
      const col = m.flAt[k] !== f ? [11, 14, 18] : t === T.GROUND ? [34, 46, 38] : t === T.HARD || t === T.SOFT || t === T.REINF || t === T.PANEL ? [150, 158, 168]
        : t === T.STAIR ? [90, 96, 104] : t === T.OPEN || t === T.BARRI ? [120, 90, 60] : [58, 64, 72];
      id.data[i] = col[0]; id.data[i + 1] = col[1]; id.data[i + 2] = col[2]; id.data[i + 3] = 255;
    }
    g.putImageData(id, 0, 0);
    st.spawnBase = { v: st.mv, img, x0, y0, w, h };
  }
  const B = st.spawnBase, g = c.getContext('2d'), sc = Math.min(c.width / B.w, c.height / B.h), ox = (c.width - B.w * sc) / 2, oy = (c.height - B.h * sc) / 2;
  const at = sp => ({ x: ox + (sp.x / CELL - B.x0) * sc, y: oy + (sp.y / CELL - B.y0) * sc });
  g.fillStyle = '#0b0e12'; g.fillRect(0, 0, c.width, c.height);
  g.imageSmoothingEnabled = false; g.drawImage(B.img, ox, oy, B.w * sc, B.h * sc);
  g.textAlign = 'center'; g.font = '600 20px Barlow Condensed, sans-serif';
  spawns.forEach((sp, i) => {
    const p = at(sp), here = mates.filter(q => q.spn === i).length, mine = me.spn === i;
    g.fillStyle = mine ? '#f2c14e' : '#ff8a3d'; g.beginPath(); g.arc(p.x, p.y, mine ? 13 : 10, 0, 7); g.fill();
    g.lineWidth = 3; g.strokeStyle = '#000'; g.stroke();
    if (here) { g.fillStyle = '#000'; g.fillText(String(here), p.x, p.y + 7); }
    g.fillStyle = mine ? '#f2c14e' : '#e8e8e8'; g.fillText(sp.name.toUpperCase(), Math.max(60, Math.min(c.width - 60, p.x)), p.y > c.height - 40 ? p.y - 20 : p.y + 34);
  });
  c.onclick = e => {
    const r = c.getBoundingClientRect(), mx = (e.clientX - r.left) / r.width * c.width, my = (e.clientY - r.top) / r.height * c.height;
    let best = -1, bd = 60; spawns.forEach((sp, i) => { const p = at(sp), d = Math.hypot(p.x - mx, p.y - my); if (d < bd) { bd = d; best = i; } });
    if (best >= 0) { audio.ui(); send({ t: 'spawn', n: best }); }
  };
}

function banner(text, sub, color) {
  const b = $('banner'); b.querySelector('.t').textContent = text; b.querySelector('.s').textContent = sub || '';
  b.querySelector('.t').style.color = color || ''; b.classList.add('show'); st.bannerT = performance.now() / 1000 + 3;
}
function addFeed(text) { const d = document.createElement('div'); d.textContent = text; $('feed').appendChild(d); setTimeout(() => d.remove(), 7000); }
function addKill(k, v, w, hs) {
  if (!v) return;
  const side = mySide(), cls = p => p && p.tm === side ? 'a' : 'e';
  const d = document.createElement('div');
  d.innerHTML = k && k !== v ? `<span class="${cls(k)}">${esc(k.n)}</span><span class="w">${esc(w || '').toUpperCase()}${hs ? ' <b class="hs">✛ HEADSHOT</b>' : ''}</span><span class="${cls(v)}">${esc(v.n)}</span>` : `<span class="${cls(v)}">${esc(v.n)}</span><span class="w">${esc(w || 'DIED').toUpperCase()}</span>`;
  $('killfeed').appendChild(d); setTimeout(() => d.remove(), 6000);
  while ($('killfeed').children.length > 6) $('killfeed').firstChild.remove();
}
function showEnd(squad) {
  const me = st.me, won = me && me.sq === squad;
  const e = $('endscreen'); e.classList.remove('hidden');
  e.querySelector('.t').textContent = won ? 'VICTORY' : 'DEFEAT'; e.querySelector('.t').className = 't ' + (won ? 'win' : 'lose');
  const sc = st.last.sc; e.querySelector('.s').textContent = me ? `${sc[me.sq]} — ${sc[1 - me.sq]}` : '';
  e.querySelector('.board').innerHTML = scoreTable(st.last);
  audio.ui(won ? 'victory' : 'defeat');
  const mv = st.mvp;
  $('mvp').innerHTML = mv ? `<div class="badge">MVP</div><canvas width="400" height="400"></canvas><div class="nm">${esc(mv.name)}</div>
    <div class="st">${mv.kills || 0} KILLS · ${mv.deaths || 0} DEATHS · ${Math.round(mv.damage || 0)} DMG</div>` : '';
  if (mv && mv.op) portrait($('mvp').querySelector('canvas'), mv.op);
  $('xpLines').innerHTML = ''; $('eTiles').innerHTML = '';
  const lv = levelFor(st.profile ? st.profile.xp : 0);
  $('eLevel').textContent = lv.level; $('eXp').style.width = (lv.into / lv.need * 100) + '%'; $('eXpText').textContent = `${lv.into} / ${lv.need} XP`;
}
// count stats and XP up on the end screen
async function playXp(m) {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const st0 = m.stats || {};
  const tiles = [['KILLS', st0.kills || 0], ['DEATHS', st0.deaths || 0], ['DAMAGE', Math.round(st0.damage || 0)], ['ACCURACY', st0.shots ? Math.round(st0.hits / st0.shots * 100) : 0, '%']];
  $('eTiles').innerHTML = tiles.map(([l]) => `<div><b>0</b>${l}</div>`).join('');
  const els = [...$('eTiles').querySelectorAll('b')];
  await sleep(900);
  for (let k = 0; k <= 20; k++) { tiles.forEach(([, v, suf], i) => els[i].textContent = Math.round(v * k / 20) + (suf || '')); if (k % 4 === 0) audio.ui('xp'); await sleep(30); }
  let xp = m.before;
  for (const [label, amt] of m.lines) {
    await sleep(350);
    const d = document.createElement('div'); d.innerHTML = `<span>${esc(label)}</span><b>+${amt} XP</b>`; $('xpLines').appendChild(d);
    const from = xp; xp += amt;
    for (let k = 1; k <= 10; k++) {
      const cur = from + amt * k / 10, L = levelFor(cur), prevL = levelFor(from + amt * (k - 1) / 10);
      $('eLevel').textContent = L.level; $('eXp').style.width = (L.into / L.need * 100) + '%'; $('eXpText').textContent = `${Math.round(L.into)} / ${L.need} XP`;
      if (L.level > prevL.level) { audio.ui('level'); $('eLevel').classList.remove('up'); void $('eLevel').offsetWidth; $('eLevel').classList.add('up'); }
      else if (k % 3 === 0) audio.ui('xp');
      await sleep(28);
    }
  }
  updateCard();
}
function scoreTable(s) {
  const me = st.me;
  const rows = [...s.players].sort((a, b) => (a.sq - b.sq) || (b.k - a.k)).map(p =>
    `<tr class="${me && p.sq === me.sq ? 'ally' : 'enemy'} ${p.id === s.you ? 'me' : ''} ${p.a ? '' : 'dead'}"><td>${esc(p.n)}</td><td>${p.op ? OPERATORS[p.op].name : '—'}</td><td>${p.k}</td><td>${p.d}</td><td>${p.b ? 'BOT' : p.ms != null ? p.ms + ' ms' : '…'}</td></tr>`).join('');
  return `<table><tr><th>PLAYER</th><th>OPERATOR</th><th>KILLS</th><th>DEATHS</th><th>PING</th></tr>${rows}</table>`;
}

// ---------------- interpolation ----------------
const DELAY = 0.1;
function interp(id, kind) {
  const snaps = st.snaps; if (!snaps.length) return null;
  const rt = performance.now() / 1000 - DELAY;
  let a = null, b = null;
  for (let i = snaps.length - 1; i >= 0; i--) if (snaps[i].t <= rt) { a = snaps[i]; b = snaps[i + 1] || null; break; }
  if (!a) a = snaps[0];
  const pa = a[kind].get(id), pb = b ? b[kind].get(id) : null;
  if (!pa) return pb || snaps[snaps.length - 1][kind].get(id) || null;
  if (!pb || pa.x === undefined || pb.x === undefined) return pa;
  const f = Math.max(0, Math.min(1, (rt - a.t) / (b.t - a.t || 1)));
  if (Math.abs(pb.x - pa.x) + Math.abs(pb.y - pa.y) > 120) return f < 0.5 ? pa : pb; // took the stairs
  const o = { ...pb, x: pa.x + (pb.x - pa.x) * f, y: pa.y + (pb.y - pa.y) * f };
  if (pa.ag !== undefined && pb.ag !== undefined) o.ag = pa.ag + angDiff(pb.ag, pa.ag) * f;
  if (pa.gt !== undefined && pb.gt !== undefined && pb.gt >= pa.gt) o.gt = pa.gt + (pb.gt - pa.gt) * f;
  return o;
}

// ---------------- main loop ----------------
let lastT = performance.now();
function frame(nowMs) {
  requestAnimationFrame(frame);
  const rawGap = nowMs - lastT, dt = Math.min(0.05, rawGap / 1000); lastT = nowMs;
  const now = nowMs / 1000;
  const s = st.last;
  const T0 = performance.now(); PF.frames++;
  if (overDirty) { octx.setTransform(1, 0, 0, 1, 0, 0); octx.clearRect(0, 0, VW, VH); overDirty = false; }
  fx.update(dt);
  if (!st.map) { ctx.fillStyle = '#050607'; ctx.fillRect(0, 0, VW, VH); return; }
  const phase = s ? s.ph : PHASE.LOBBY;
  const inGame = phase === PHASE.PREP || phase === PHASE.ACTION || phase === PHASE.ROUND_END;
  screens(s, phase, now);
  const me = st.me;
  if (coach.active) coach.update(s, me);

  // --- view source ---
  let view = null, ctrl = me && me.a ? me.ct : null;
  if (inGame && me && me.a) {
    if (ctrl === 'drone') view = { x: st.pred.x, y: st.pred.y, ang: st.aim, fov: Math.PI * 2, range: 230, near: 0, kind: 'drone' };
    else if (ctrl === 'cam') { const c = s.ents.find(e => e.id === me.fi); if (c) view = feedView(c, me); }
    else view = { x: st.pred.x, y: st.pred.y, ang: st.aim, fov: fovFor(me), range: 1100, near: 26, kind: 'body' };
  } else if (inGame && me) {
    const mates = s.players.filter(p => p.a && p.sq === me.sq && p.id !== me.id);
    if (mouse.wl > 0) { st.spect++; mouse.wl = 0; }
    if (mates.length) {
      const m = interp(mates[st.spect % mates.length].id, 'players');
      if (m) view = { x: m.x, y: m.y, ang: m.ag, fov: fovFor(m), range: 1100, near: 26, kind: 'spect', name: m.n };
    }
  }

  // --- input & prediction ---
  pollPad(dt, view);
  padOn = (aimMode !== 'cursor' || gpRecent()) && !!view && (view.kind === 'body' || view.kind === 'drone');
  if (padOn && aimMode === 'pad' && document.pointerLockElement !== cv && !gpRecent()) { // mouse not captured yet: read the ring from the cursor
    const P = pad(), dx = mouse.x - P.x, dy = mouse.y - P.y, l = Math.hypot(dx, dy);
    if (l > 1) { padAng = Math.atan2(dy, dx); padReach = Math.min(1, l / P.r); }
  }
  if (view && (view.kind === 'body' || view.kind === 'drone')) {
    const c = cursor(), mw = screenToWorld(c.x, c.y);
    st.aim = Math.atan2(mw.y - st.pred.y, mw.x - st.pred.x);
    if (now < (st.dazeUntil || 0)) st.aim += Math.sin(now * 6.3) * 0.05 + Math.sin(now * 2.1) * 0.04; // dazed: the aim sways
  } else if (view && view.kind === 'cam') {
    if (st.lastCam !== view.cam.id) { // switching cameras: start from that camera's current direction
      st.lastCam = view.cam.id; st.aim = view.cam.ag || 0; view.ang = st.aim; audio.foley('camSwitch');
      mouse.x = VW / 2 + Math.cos(st.aim) * VH * 0.25; mouse.y = VH / 2 + Math.sin(st.aim) * VH * 0.25;
    } else if (!view.ro && Math.hypot(mouse.x - VW / 2, mouse.y - VH / 2) > 20 * DPR) st.aim = Math.atan2(mouse.y - VH / 2, mouse.x - VW / 2);
    if (view.ro) st.aim = view.ang; // a teammate's drone or gadget: you only watch, it looks where its owner points it
    else { const c = view.cam; if (c.wn !== undefined) st.aim = c.wn + Math.max(-c.ws, Math.min(c.ws, angDiff(st.aim, c.wn))); } // a wall camera can't look into its wall
    view.ang = st.aim;
  }
  if (!view || view.kind !== 'cam') st.lastCam = null;
  sendInput(dt, me, ctrl, view, s, now);

  // --- camera ---
  let cx, cy;
  if (view) {
    cx = view.x; cy = view.y;
    if (view.kind === 'body') {
      const c = cursor(), mw = screenToWorld(c.x, c.y);
      const vh = st.viewH || 400;
      const lx = (mw.x - st.pred.x) * 0.22, ly = (mw.y - st.pred.y) * 0.22, l = Math.hypot(lx, ly), mx = vh * (me && me.ad ? (String(me.aa).includes('scope') ? 0.46 : 0.32) : 0.2); // a scope looks further ahead
      cx += l > mx ? lx / l * mx : lx; cy += l > mx ? ly / l * mx : ly;
    }
  } else { // menus: slow drift over the map
    cx = st.map.W * CELL / 2 + Math.cos(now * 0.05) * 300; cy = st.map.H * CELL / 2 + Math.sin(now * 0.07) * 160;
  }
  const k = 1 - Math.exp(-dt * 14);
  st.cam.x += (cx - st.cam.x) * k; st.cam.y += (cy - st.cam.y) * k;
  if (view && view.kind !== 'body') { st.cam.x = cx; st.cam.y = cy; }
  // zoom: close in tight rooms, wider outside or when looking down a long sightline
  let want = 600; // world px shown top to bottom; he asked twice for a closer view
  if (view && (view.kind === 'drone' || view.dr)) want = 240;
  else if (view) {
    let sum = 0;
    for (let i = 0; i < 24; i++) sum += castSight(st.map, view.x, view.y, i / 24 * Math.PI * 2, 700, null);
    const avg = sum / 24, aimD = castSight(st.map, view.x, view.y, view.ang, 900, null);
    want = Math.max(240, Math.min(470, avg * 1.15 + 110));
    want = Math.max(want, Math.min(view.kind === 'cam' ? 580 : 520, aimD * (view.kind === 'cam' ? 0.75 : 0.6)));
  }
  // the room-size zoom only moves for a real change (a new room, a long corridor), not every small turn of
  // your aim, and then settles quickly, so the view isn't always slowly drifting in and out (he asked for less slow panning)
  if (!st.envWant || Math.abs(want - st.envWant) > st.envWant * 0.15 || (view && view.kind !== 'body')) st.envWant = want;
  st.envH = st.envH || st.envWant;
  st.envH += (st.envWant - st.envH) * (1 - Math.exp(-dt * 6));
  // aiming down sights zooms in, fast (a scope zooms less but looks further ahead)
  const adsZ = view && view.kind === 'body' && me && me.ad ? (String(me.aa).includes('scope') ? 0.9 : 0.82) : 1;
  st.adsZ = st.adsZ || 1;
  st.adsZ += (adsZ - st.adsZ) * (1 - Math.exp(-dt * 18));
  st.viewH = st.envH * st.adsZ;
  st.zoom = VH / st.viewH;
  if (view && view.kind === 'cam' && !view.dr) { st.cam.x = view.x + Math.cos(view.ang) * st.viewH * 0.28; st.cam.y = view.y + Math.sin(view.ang) * st.viewH * 0.28; }
  { // never look past the edge of the floor you are on (other floors sit beside it in the map grid)
    const fi = view ? Math.max(0, floorAt(st.map, view.x, view.y)) : 0, F = st.map.floors[fi];
    if (st.camFloor !== fi) { // changed floor: jump straight there
      st.camFloor = fi; if (view) { st.cam.x = cx; st.cam.y = cy; }
    }
    const hw = VW / 2 / st.zoom, hh = VH / 2 / st.zoom, x0 = F.gx * CELL, mw = F.w * CELL, mh = F.h * CELL;
    st.cam.x = mw > hw * 2 ? Math.max(x0 + hw, Math.min(x0 + mw - hw, st.cam.x)) : x0 + mw / 2;
    st.cam.y = mh > hh * 2 ? Math.max(hh, Math.min(mh - hh, st.cam.y)) : mh / 2;
    st.floorRect = [x0, 0, x0 + mw, mh];
  }
  if (view) { audio.setListener(view.x, view.y); st.listen = { x: view.x, y: view.y }; }

  let t1 = pfa('logic', T0);
  st.viewers = teamViewers(s, view, me, inGame);
  revealSeen(); t1 = pfa('viewers', t1);
  bodySounds(me, dt);
  draw(s, view, now, dt); ctx = ctx0; pfa('total', T0);
  watchPerf(rawGap, performance.now() - T0);
}
let overDirty = false, fogShown = false;
function showFog(on) { if (on !== fogShown) { fogShown = on; fog.style.visibility = on ? 'visible' : 'hidden'; } }
const PF = { frames: 0 }; function pfa(k, t) { const n = performance.now(); PF[k] = (PF[k] || 0) + n - t; return n; }

function screenToWorld(sx, sy) { const z = st.zoom || 1; return { x: (sx - VW / 2) / z + st.cam.x, y: (sy - VH / 2) / z + st.cam.y }; }

function sendInput(dt, me, ctrl, view, s, now) {
  const ev = st.evq; st.evq = [];
  const typing = document.activeElement && document.activeElement.tagName === 'INPUT';
  const k = {
    up: keys.has('up') || gpk.up ? 1 : 0, down: keys.has('down') || gpk.down ? 1 : 0, left: keys.has('left') || gpk.left ? 1 : 0, right: keys.has('right') || gpk.right ? 1 : 0,
    walk: keys.has('walk') || gpk.walk ? 1 : 0, crouch: keys.has('crouch') || gpk.crouch ? 1 : 0, fire: mouse.l || gpk.fire ? 1 : 0, ads: mouse.r || gpk.ads ? 1 : 0,
    interact: keys.has('interact') ? 1 : 0, ability: keys.has('ability') ? 1 : 0,
  };
  if (typing || menuOpen()) { for (const key in k) k[key] = 0; ev.length = 0; }
  // ping whatever is under your aim: an enemy you can see, else a gadget, camera or the objective, else the wall, door or floor you point at
  const trySpot = () => {
    if (!view || !me) return;
    const c = cursor(), mw = screenToWorld(c.x, c.y), t = pingTarget(view, me, s, mw);
    if (!t) return;
    ev.push(t.spot ? { k: 'spot', id: t.spot } : { k: 'mark', x: Math.round(t.x), y: Math.round(t.y), w: t.w, id: t.id });
    audio.foley('spot');
  };
  if (ctrl === 'cam' || ctrl === 'drone') {
    if (mouse.wl) trySpot();
    if (ctrl === 'cam') { k.up = k.down = k.left = k.right = 0; }
    const cam = ctrl === 'cam' && view && view.kind === 'cam' ? view.cam : null;
    if (!(cam && cam.tu && !view.ro)) k.fire = 0; // a turret camera fires its laser (only for whoever placed it)
    k.ads = 0;
  }
  if (st.spotReq) { trySpot(); st.spotReq = false; }
  mouse.wl = 0; mouse.wr = 0;
  if (!me || !s) return;
  const ph = s.ph;
  if (me.a && (ph === PHASE.PREP || ph === PHASE.ACTION) && (ctrl === 'body' || ctrl === 'drone')) {
    const mods = me.m || {};
    stepMove(st.map, st.pred, k, dt, mods);
  }
  if (me.vt && ctrl === 'body') {
    const [x0, y0, x1, y1, t, dur] = me.vt, nowS = performance.now() / 1000;
    if (!st.vault || st.vault.x0 !== x0 || st.vault.y0 !== y0) st.vault = { x0, y0, t0: nowS - t };
    const f = Math.min(1, (nowS - st.vault.t0) / dur), e = f * f * (3 - 2 * f);
    st.pred.x = x0 + (x1 - x0) * e; st.pred.y = y0 + (y1 - y0) * e;
  } else st.vault = null;
  { // a fresh click: open the crosshair gap now instead of when the server's answer comes back
    const w = WEAPONS[me.w];
    if (k.fire && !st.fireK && w && me.a && ctrl === 'body' && ph === PHASE.ACTION && me.am > 0 && !(st.shotPred && now - st.shotPred.t < 60 / w.rpm))
      st.shotPred = { w: me.w, t: now, sh: gunHeat(me, w, now) + 1 };
    st.fireK = k.fire;
  }
  const msg = { t: 'input', s: ++st.seq, k, a: Math.round(st.aim * 100000) / 100000, dt: Math.round(dt * 10000) / 10000 };
  const c = cursor(), mw = screenToWorld(c.x, c.y); msg.ax = Math.round(mw.x); msg.ay = Math.round(mw.y);
  const vt = viewServerTime(); if (vt !== null) msg.vt = Math.round(vt * 1000) / 1000; // what moment of the match you're seeing
  if (ev.length) msg.ev = ev;
  st.pending.push({ s: msg.s, k, dt: msg.dt });
  if (st.pending.length > 120) st.pending.shift();
  send(msg);
}

// What a ping names. Gadgets and skills are called by their names in operators.js.
const ENT_NAME = (() => {
  const n = { cam: 'CAMERA', drone: 'DRONE', defuser: 'DEFUSER', decoy: 'DECOY', smoke: 'SMOKE', gascloud: 'GAS' };
  for (const [k, g] of Object.entries(GADGETS)) if (!n[k]) n[k] = g.name.toUpperCase();
  for (const o of Object.values(OPERATORS)) if (o.ability && !n[o.ability.id]) n[o.ability.id] = o.ability.name.toUpperCase();
  return n;
})();
function entName(e) {
  if (e.ty === 'cam') return e.tu ? 'TURRET CAMERA' : 'CAMERA';
  if (e.ty === 'nade') return e.kd && GADGETS[e.kd] ? GADGETS[e.kd].name.toUpperCase() : 'GRENADE';
  return ENT_NAME[e.ty] || e.ty.toUpperCase();
}
function cellName(k, t) {
  const m = st.map, o = m.openId[k] >= 0 ? m.openings[m.openId[k]] : null, ok = o && o.kind === 'window' ? 'WINDOW' : 'DOOR';
  if (t === T.BARRI) return o ? 'BARRICADED ' + ok : 'BARRICADE';
  if (t === T.OPEN) return o ? ok : null;
  if (t === T.REINF) return 'REINFORCED WALL';
  if (t === T.SOFT) return m.dhole[k] ? 'DRONE HOLE' : 'SOFT WALL';
  if (t === T.HARD) return m.dhole[k] ? 'DRONE HOLE' : 'HARD WALL';
  if (t === T.PANEL) return 'ARMOR PANEL';
  if (t === T.DSHIELD) return 'DEPLOYABLE SHIELD';
  if (t === T.TALL) return 'COVER';
  if (t === T.LOW) return 'LOW COVER';
  if (t === T.STAIR) return 'STAIRS';
  return null;
}
function pingTarget(view, me, s, mw) {
  const sm = smokes(s), m = st.map, seeIt = (x, y) => canSee(m, view, x, y, sm);
  let best = null, bd = 45;
  for (const p of s.players) if (p.a && p.tm !== me.tm && p.x !== undefined) {
    const d = Math.hypot(p.x - mw.x, p.y - mw.y);
    if (d < bd && seeIt(p.x, p.y)) { bd = d; best = p; }
  }
  if (best) return { spot: best.id };
  let be = null; bd = 20;
  for (const e of s.ents) {
    if (e.id === me.did || e.id === me.fi || e.ty === 'smoke' || e.ty === 'gascloud') continue;
    const d = Math.hypot(e.x - mw.x, e.y - mw.y);
    if (d < bd && (e.tm === me.tm || seeIt(e.x, e.y))) { bd = d; be = e; }
  }
  if (be) return { x: be.x, y: be.y, w: entName(be), id: be.id };
  const site = m.sites[s.site];
  if (site && (me.tm === 'def' || s.rev)) for (const b of site.bombs) if (Math.hypot(b.x - mw.x, b.y - mw.y) < 22) return { x: b.x, y: b.y, w: 'OBJECTIVE ' + b.id };
  // follow the aim line out from where you look: the first thing that stops your sight, or the floor where you point
  const dx = mw.x - view.x, dy = mw.y - view.y, L = Math.hypot(dx, dy) || 1;
  if (L > view.range || (L > view.near && Math.abs(angDiff(Math.atan2(dy, dx), view.ang)) > view.fov / 2 + 0.1)) return null;
  for (let d = 3; ; d += 2) {
    const end = d >= L, x = view.x + dx / L * Math.min(d, L), y = view.y + dy / L * Math.min(d, L);
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), k = cy * m.W + cx, t = tileAt(m, cx, cy);
    if (t === T.VOID) return null;
    if (blocksSight(t) || end) {
      if (!blocksSight(t) && !seeIt(x, y)) return null;
      const name = cellName(k, t);
      if (name) return { x: blocksSight(t) ? (cx + 0.5) * CELL : x, y: blocksSight(t) ? (cy + 0.5) * CELL : y, w: name };
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k2 = (cy + oy) * m.W + cx + ox; if (m.dhole[k2]) return { x, y, w: 'DRONE HOLE' }; }
      return { x, y, w: view.kind === 'body' ? 'GO HERE' : 'LOOK HERE' };
    }
  }
}
// Pings on screen: a diamond with what it is, who pinged it and how far; kept at the screen edge when off screen.
function drawMarks(view, now) {
  if (!st.marks || !st.marks.length) return;
  st.marks = st.marks.filter(k => now - k.t < 6);
  const z = st.zoom, pad = 40 * DPR;
  for (const k of st.marks) {
    const age = now - k.t, al = age > 5 ? 6 - age : 1, pop = Math.min(1, age / 0.15), col = k.w.startsWith('ENEMY') ? '255,70,70' : '255,210,74';
    const sx = (k.x - st.cam.x) * z + VW / 2, sy = (k.y - st.cam.y) * z + VH / 2;
    const cx = Math.max(pad, Math.min(VW - pad, sx)), cy = Math.max(pad + 60 * DPR, Math.min(VH - pad - 60 * DPR, sy));
    const wx = (cx - VW / 2) / z + st.cam.x, wy = (cy - VH / 2) / z + st.cam.y, r = 5 * (2 - pop);
    ctx.save(); ctx.translate(wx, wy); ctx.globalAlpha = al;
    ctx.fillStyle = `rgba(${col},0.25)`; ctx.strokeStyle = `rgb(${col})`; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = `rgb(${col})`; ctx.beginPath(); ctx.arc(0, 0, 1.2, 0, 7); ctx.fill();
    ctx.textAlign = 'center'; ctx.font = '700 6.5px Barlow Condensed, sans-serif';
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.strokeText(k.w, 0, -r - 3); ctx.fillText(k.w, 0, -r - 3);
    const d = view ? ` · ${Math.round(Math.hypot(k.x - view.x, k.y - view.y) / CELL * 0.8)}m` : '';
    ctx.font = '600 5px Barlow Condensed, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.strokeText(k.by + d, 0, r + 7); ctx.fillText(k.by + d, 0, r + 7);
    ctx.restore();
  }
}

// smoke clouds of a snapshot, worked out once per snapshot (it was being rebuilt many times a frame)
const smokeMemo = new WeakMap();
const smokes = s => { if (!s) return []; let v = smokeMemo.get(s); if (!v) smokeMemo.set(s, v = s.ents.filter(e => e.ty === 'smoke').map(e => ({ x: e.x, y: e.y, r: e.r }))); return v; };

// ---------------- what things are made of (for sound) ----------------
const FLOOR_SURF = { [FL.WOOD]: 'wood', [FL.TILE]: 'tile', [FL.SERVER]: 'metal', [FL.MARBLE]: 'marble', [FL.CARPET]: 'carpet', [FL.CONCRETE]: 'concrete', [FL.GRASS]: 'grass', [FL.ASPHALT]: 'asphalt' };
function cellAt(x, y) { const m = st.map, cx = Math.floor(x / CELL), cy = Math.floor(y / CELL); return cx < 0 || cy < 0 || cx >= m.W || cy >= m.H ? -1 : cy * m.W + cx; }
function surfaceAt(x, y) {
  const k = cellAt(x, y); if (k < 0) return 'concrete';
  if (st.glass && st.glass.has(k)) return 'glass';
  if (st.splinters && st.splinters.has(k)) return 'splinters';
  const b = st.base[k], t = st.map.tiles[k];
  if ((b === T.SOFT || b === T.HARD) && (t === T.FLOOR || t === T.GROUND || t === T.OPEN)) return 'rubble';
  return FLOOR_SURF[st.map.floor[k]] || 'concrete';
}
function wallMat(x, y, a) {
  const k = cellAt(x + Math.cos(a || 0) * 3, y + Math.sin(a || 0) * 3); if (k < 0) return 'drywall';
  const t = st.map.tiles[k];
  if (t === T.BARRI) return 'wood';
  return st.map.mat[k] === MAT.BRICK ? 'brick' : 'drywall';
}
function hardMat(x, y, a) {
  const k = cellAt(x + Math.cos(a) * 3, y + Math.sin(a) * 3); if (k < 0) return 'concrete';
  const t = st.map.tiles[k];
  return t === T.REINF || t === T.PANEL || t === T.DSHIELD ? 'metal' : t === T.TALL ? (Math.random() < 0.5 ? 'wood' : 'metal') : 'concrete';
}
audio.setWorld(
  (x, y) => { // how many walls between you and the sound (0-3); another floor counts as 2
    const L = st.listen; if (!L || !st.map) return 0;
    const fa = floorAt(st.map, L.x, L.y), fb = floorAt(st.map, x, y);
    if (fa !== fb) { // an open hatch near both of you lets the sound through
      const lo = Math.min(fa, fb), up = fa > fb ? L : { x, y }, dn = fa > fb ? { x, y } : L;
      for (const h of st.map.hatches) if (h.fl === lo + 1 && st.map.tiles[h.cells[0]] === T.HOLE && Math.hypot(up.x - h.x, up.y - h.y) < 160 && Math.hypot(dn.x - h.bx, dn.y - h.by) < 220) return 1;
      for (let i = 0; i < (st.map.stairs || []).length; i++) if (stairLooks(st.map, i, L.x, L.y) && stairLooks(st.map, i, x, y)) return 0; // straight up or down an open staircase
      return Math.min(3, 1 + Math.abs(fa - fb));
    }
    const d = Math.hypot(x - L.x, y - L.y); if (d < 1) return 0;
    let n = 0; const sk = cellAt(L.x, L.y), ek = cellAt(x, y);
    walkRay(L.x, L.y, (x - L.x) / d, (y - L.y) / d, d, (cx, cy) => {
      const k = cy * st.map.W + cx;
      if (k !== sk && k !== ek && blocksSight(tileAt(st.map, cx, cy))) n++;
      return n >= 3;
    });
    return Math.min(3, Math.ceil(n / 1.5));
  },
  (x, y) => { const k = cellAt(x, y); return k >= 0 && st.map && st.map.floor[k] !== FL.GRASS && st.map.floor[k] !== FL.ASPHALT; },
  (x, y) => (st.map ? localPos(st.map, x, y) : { x, y }),
);

// Little sounds from each player's state: footsteps per surface, turning on the spot,
// aiming, crouching, weapon swaps, reload stages, hammering, planting...
function playerFoley(p, a, moved, own, dt) {
  const w = WEAPONS[p.w], shotgun = w && w.cls === 'Shotgun';
  const pace = p.dn ? 1 : p.wk ? 0 : p.cr ? 1 : p.mv >= 3 ? 3 : 2;
  // legs follow the real step cycle; a foot plants each time the gait passes a multiple of PI
  const gt = p.gt || 0, plant = Math.floor(gt / Math.PI);
  if (a.plant !== undefined && plant > a.plant && moved > 0.05 && (own || !p.si)) audio.step(p.x, p.y, surfaceAt(p.x, p.y), pace, own);
  if (a.plant === undefined || plant < a.plant - 1 || plant > a.plant) a.plant = plant;
  // turning on the spot: feet shuffle round, each shuffle a little step
  const dAng = Math.abs(angDiff(p.ag, a.lag ?? p.ag)); a.lag = p.ag;
  a.turn = a.turn || 0;
  if (moved < 0.3 && !p.dn) {
    const before = Math.floor(a.turn / Math.PI);
    a.turn += dAng * 2.4; a.turnAmp = Math.min(1, (a.turnAmp || 0) + dAng * 3);
    if (Math.floor(a.turn / Math.PI) > before && (own || !p.si)) audio.shuffle(p.x, p.y, surfaceAt(p.x, p.y), own);
  }
  a.walk = gt + Math.PI / 2 + a.turn;
  if (a.pAd !== undefined) {
    if (p.ad !== a.pAd && !p.dn) audio.foley(p.ad ? 'adsIn' : 'adsOut', p.x, p.y, own);
    if (p.cr !== a.pCr && !p.dn) audio.foley(p.cr ? 'crouch' : 'stand', p.x, p.y, own);
    if (p.w !== a.pW && p.w) audio.foley('draw', p.x, p.y, own);
    if (p.mv && !a.pMv) audio.foley('cloth', p.x, p.y, own);
    if (p.dn && !a.pDn) audio.foley('hurt', p.x, p.y, own);
  }
  if (p.rl > 0) {
    if (!a.r1 && p.rl > 0.1) { a.r1 = 1; audio.foley(shotgun ? 'shell' : 'magOut', p.x, p.y, own); if (!shotgun) setTimeout(() => audio.foley('magDrop', p.x, p.y, own), 350); }
    if (!a.r2 && p.rl > (shotgun ? 0.35 : 0.58)) { a.r2 = 1; audio.foley(shotgun ? 'shell' : 'magIn', p.x, p.y, own); }
    if (!a.r3 && p.rl > (shotgun ? 0.6 : 0.84)) { a.r3 = 1; audio.foley(shotgun ? 'shell' : 'bolt', p.x, p.y, own); }
  } else a.r1 = a.r2 = a.r3 = 0;
  if (p.bu) {
    a.buT = (a.buT || 0) - dt;
    if (a.buT <= 0) {
      const k = p.bu.k;
      if (k === 'reinforce') { audio.foley('hammer', p.x, p.y, own); a.buT = 0.36 + Math.random() * 0.1; }
      else if (k === 'barricade') { audio.foley('nail', p.x, p.y, own); a.buT = 0.28; }
      else if (k === 'plant') { audio.foley('beep', p.x, p.y, own); a.buT = 0.7 - p.bu.p * 0.5; }
      else if (k === 'defuse') { audio.foley('tick', p.x, p.y, own); a.buT = 0.22; }
      else { audio.foley('cloth', p.x, p.y, own); a.buT = 0.5; }
    }
  } else a.buT = 0;
  a.pAd = p.ad; a.pCr = p.cr; a.pW = p.w; a.pMv = p.mv; a.pDn = p.dn;
}

// ---------------- drawing ----------------
function visionPolygon(v, sm, rays = 0) {
  const pts = [];
  const full = v.fov >= Math.PI * 2 - 0.01;
  const n = rays || Math.round((full ? 360 : 300) * gq.rays);
  if (!full) pts.push(v.x, v.y);
  for (let i = 0; i <= n; i++) {
    const a = v.ang - v.fov / 2 + v.fov * i / n;
    const d = Math.min(v.range, castSight(st.map, v.x, v.y, a, v.range, sm) + 7);
    pts.push(v.x + Math.cos(a) * d, v.y + Math.sin(a) * d);
  }
  return pts;
}
function nearPolygon(v, sm) {
  const pts = [];
  for (let i = 0; i <= 64; i++) {
    const a = i / 64 * Math.PI * 2;
    const d = Math.min(v.near, castSight(st.map, v.x, v.y, a, v.near, sm) + 5);
    pts.push(v.x + Math.cos(a) * d, v.y + Math.sin(a) * d);
  }
  return pts;
}
function fillPoly(c, pts) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); c.fill(); }

function draw(s, view, now, dt) {
  const z = st.zoom, m = st.map; let tq = performance.now();
  const shake = fx.shake;
  const ox = VW / 2 - st.cam.x * z + (Math.random() - 0.5) * shake * DPR, oy = VH / 2 - st.cam.y * z + (Math.random() - 0.5) * shake * DPR;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, VW, VH);
  ctx.setTransform(z, 0, 0, z, ox, oy);
  ctx.imageSmoothingEnabled = true;
  // the map layer: copy over any changed spots, then let the browser place and scale it
  st.rend.process(gfxLevel() === 'low' ? 2.5 : 4, st.cam.x, st.cam.y);
  st.rend.flush();
  if (st.warm > 0) { // just after loading a map: show every floor at once (invisibly) so the graphics card has them all ready
    st.warm--;
    const k = Math.min(innerWidth / (m.W * CELL * S), innerHeight / (m.H * CELL * S));
    mapLayer.style.opacity = st.warm > 0 ? '0.02' : '';
    mapLayer.style.transform = st.warm > 0 ? `scale(${k})` : '';
  } else mapLayer.style.transform = `translate(${ox / DPR}px, ${oy / DPR}px) scale(${z / (S * DPR)})`;
  // visible window of the map (for the grey remembered copy)
  const wx0 = Math.max(0, st.cam.x - VW / 2 / z - 20), wy0 = Math.max(0, st.cam.y - VH / 2 / z - 20);
  const wx1 = Math.min(m.W * CELL, st.cam.x + VW / 2 / z + 20), wy1 = Math.min(m.H * CELL, st.cam.y + VH / 2 / z + 20);
  tq = pfa('mapblit', tq);
  if (!s) { showFog(false); return; }
  const me = st.me, side = me ? me.tm : null;
  const inGame = s.ph === PHASE.PREP || s.ph === PHASE.ACTION || s.ph === PHASE.ROUND_END;
  const sm = smokes(s);
  const seen = (x, y) => !view || teamSees(x, y);
  const spotted = new Set(side && s.spots[side] ? s.spots[side] : []);

  // objective
  if (inGame) {
    const site = m.sites[s.site];
    if (side === 'def' || s.rev || !me) for (const b of site.bombs) if (!s.pl || s.pl.b !== b.id) drawBomb(ctx, b, now);
    if (s.pl) {
      ctx.save(); ctx.translate(s.pl.x, s.pl.y);
      const pulse = (now * 2) % 1;
      ctx.strokeStyle = `rgba(255,60,60,${1 - pulse})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 8 + pulse * 30, 0, 7); ctx.stroke();
      ctx.fillStyle = '#2a2a2a'; ctx.fillRect(-6, -4, 12, 8); ctx.fillStyle = '#ff3030'; ctx.fillRect(-4, -2, 8, 4);
      ctx.restore();
    }
  }
  // corpses
  for (const c of st.corpses) drawOperator(ctx, { ...c, downed: true }, now);

  // gadgets / entities
  const ents = s.ents.map(e => interp(e.id, 'ents') || e);
  for (const e of ents) {
    const ally = e.tm === side;
    if (e.ty === 'drone' || e.ty === 'cam' || e.ty === 'smoke' || e.ty === 'decoy' || e.ty === 'gascloud') continue;
    if ((e.ty === 'clamp' || e.ty === 'prox' || e.ty === 'concuss') && !ally && !(view && Math.hypot(e.x - view.x, e.y - view.y) < 110)) continue; // hidden traps
    if (!ally && !seen(e.x, e.y)) continue;
    if (e.ty === 'mine' && !ally && !(view && Math.hypot(e.x - view.x, e.y - view.y) < 140)) continue;
    drawGadget(ctx, e, now, ally);
  }
  for (const e of ents) if (e.ty === 'cam' && (e.tm === side || seen(e.x, e.y))) drawCam(ctx, e, now, e.tm === side);

  // players
  const drawn = [];
  for (const sp of s.players) {
    if (!sp.a || sp.sg) continue; // an attacker waiting off the map during preparation
    const isMe = me && sp.id === me.id;
    let p = isMe ? { ...sp } : interp(sp.id, 'players');
    if (!p || p.x === undefined) continue;
    if (isMe && me.ct === 'body') { p.x = st.pred.x; p.y = st.pred.y; p.ag = st.aim; p.gt = st.pred.gait; }
    const ally = p.tm === side;
    const a = anim(p.id);
    const moved = Math.hypot(p.x - a.lx, p.y - a.ly);
    a.lx = p.x; a.ly = p.y;
    playerFoley(p, a, moved, isMe, dt);
    a.mvS = (a.mvS || 0) + (Math.min(1.4, moved / Math.max(dt, 0.001) / 95) - (a.mvS || 0)) * Math.min(1, dt * 10);
    a.turnAmp = Math.max(0, (a.turnAmp || 0) - dt * 2.5);
    a.recoil = Math.max(0, a.recoil - dt * 12); a.melee = Math.max(0, a.melee - dt * 4);
    // up or down a staircase: they also show on the other floor's steps, to people near that staircase who can see the spot
    const gh = !isMe && stairGhost(st.map, p.x, p.y);
    if (gh && (ally || (!p.sh && ghostSeen(gh)))) {
      ctx.globalAlpha = 0.9;
      drawOperator(ctx, { x: gh.x, y: gh.y, aim: p.ag, op: p.op, w: p.w, ally, walk: a.walk, legs: Math.min(1.2, a.mvS), ads: p.ad, crouch: p.cr, downed: p.dn, recoil: a.recoil, brace: p.br }, now);
      ctx.globalAlpha = 1;
      ctx.font = '700 7px Barlow Condensed, sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = ally ? '#8fc8ff' : '#ff8a3d'; ctx.fillText(gh.below ? '▼ BELOW' : '▲ ABOVE', gh.x, gh.y - 15);
    }
    // Silent Shroud: drones and cameras can't see her, only eyes can
    const vis = ally || isMe || (p.sh ? !view || teamSeesBody(p.x, p.y) : seen(p.x, p.y));
    if (!vis) continue;
    drawOperator(ctx, {
      x: p.x, y: p.y, aim: p.ag, op: p.op, w: p.w, ally, walk: a.walk, legs: Math.min(1.2, Math.max(a.mvS, a.turnAmp * 0.6)), ads: p.ad, crouch: p.cr, downed: p.dn,
      recoil: a.recoil, flash: now - a.flashT < 0.045, reload: p.rl > 0, brace: p.br, scan: p.sc, melee: a.melee,
    }, now);
    drawn.push(p);
    if (String(sp.aa).includes('laser') && !p.dn) { // a laser sight shows a beam everyone can see
      const L = Math.min(260, castSight(st.map, p.x, p.y, p.ag, 260, sm));
      ctx.strokeStyle = 'rgba(255,40,40,0.35)'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(p.x + Math.cos(p.ag) * 14, p.y + Math.sin(p.ag) * 14); ctx.lineTo(p.x + Math.cos(p.ag) * L, p.y + Math.sin(p.ag) * L); ctx.stroke();
      ctx.fillStyle = 'rgba(255,60,60,0.8)'; ctx.fillRect(p.x + Math.cos(p.ag) * L - 0.8, p.y + Math.sin(p.ag) * L - 0.8, 1.6, 1.6);
    }
    if (p.ln && Math.random() < dt * 40) { // Thermal Lance: sparks where it bites the wall
      const hx = p.x + Math.cos(p.ag) * 17, hy = p.y + Math.sin(p.ag) * 17, a2 = p.ag + Math.PI + (Math.random() - 0.5) * 2;
      fx.add({ type: 'spark', x: hx, y: hy, vx: Math.cos(a2) * 120, vy: Math.sin(a2) * 120, life: 0.25, max: 0.25, size: 1, col: '255,200,120', drag: 4 });
      if ((a.lanceSnd = (a.lanceSnd || 0) - dt) <= 0) { a.lanceSnd = 0.18; audio.impact('metal', hx, hy); fx.lights.push({ x: hx, y: hy, r: 40, life: 0.12, max: 0.12, col: '255,170,80', a: 0.5 }); }
    }
  }
  for (const e of ents) if (e.ty === 'drone') { // motion, wheel spin, dust and motor sound for every drone
    const own = me && e.id === me.did && me.ct === 'drone';
    const x = own ? st.pred.x : e.x, y = own ? st.pred.y : e.y;
    const a = anim(e.id), mx = x - (a.dx ?? x), my = y - (a.dy ?? y), dist = Math.hypot(mx, my); a.dx = x; a.dy = y;
    const sp = dist / Math.max(dt, 0.001);
    a.spd = (a.spd || 0) + (Math.min(DRONE_SPEED * 1.2, sp) - (a.spd || 0)) * Math.min(1, dt * 10);
    a.wheel = (a.wheel || 0) + dist; if (dist > 0.05) a.mvAng = Math.atan2(my, mx);
    // the body turns to face the way it is driving (smoothly, like a little car); parked, it keeps its last heading
    if (a.heading === undefined) a.heading = own ? st.aim : (e.ag || 0);
    if (a.spd > 12 && a.mvAng !== undefined) a.heading += angDiff(a.mvAng, a.heading) * Math.min(1, dt * 10);
    a.sway = (a.sway || 0) + ((a.spd / DRONE_SPEED) * 0.6 - (a.sway || 0)) * Math.min(1, dt * 4);
    if (a.spd > DRONE_SPEED * 0.55 && Math.random() < dt * 12 && surfaceAt(x, y) !== 'carpet')
      fx.add({ type: 'smoke', x: x - Math.cos(a.mvAng) * 5, y: y - Math.sin(a.mvAng) * 5, vx: -Math.cos(a.mvAng) * 15, vy: -Math.sin(a.mvAng) * 15, life: 0.5, max: 0.5, size: 1.2, grow: 5, col: '170,160,140', a: 0.25 });
    audio.droneLoop(e.id, x, y, a.spd, own);
    if (e.tm === side || seen(x, y)) drawDrone(ctx, { ...e, x, y, ag: a.heading, wheel: a.wheel, spd: a.spd, mvAng: a.mvAng ?? a.heading, sway: a.sway }, now, e.tm === side);
  }
  audio.pruneLoops(); tq = pfa('actors', tq);
  fx.draw(ctx);
  for (const e of ents) if (e.ty === 'decoy') { // Holo Decoy: looks, moves and sounds like the real operator
    const a = anim(e.id), mv = Math.hypot(e.x - (a.dx ?? e.x), e.y - (a.dy ?? e.y)); a.dx = e.x; a.dy = e.y;
    a.walk = (a.walk || 0) + mv / 28 * Math.PI; a.stepAcc = (a.stepAcc || 0) + mv;
    if (a.stepAcc > 31) { a.stepAcc = 0; audio.step(e.x, e.y, surfaceAt(e.x, e.y), 2, false); }
    const ally = e.tm === side; if (!ally && !seen(e.x, e.y)) continue;
    if (ally) ctx.globalAlpha = 0.45;
    drawOperator(ctx, { x: e.x, y: e.y, aim: e.ag, op: e.op, w: e.w, ally, walk: a.walk, legs: 1 }, now);
    ctx.globalAlpha = 1;
  }
  for (const e of ents) if (e.ty === 'smoke') drawSmoke(ctx, e, now, gq.smoke);
  for (const e of ents) if (e.ty === 'gascloud' && (e.tm === side || seen(e.x, e.y))) drawSmoke(ctx, { ...e, l: Math.min(e.l * 1.5, 12) }, now, Math.ceil(gq.smoke * 0.6), '150,200,70');
  fx.drawLights(ctx); tq = pfa('fx', tq);

  // --- line-of-sight blackout ---
  showFog(!!(view && inGame));
  if (view && inGame) {
    const fk = fog.width / VW;
    fctx.setTransform(1, 0, 0, 1, 0, 0);
    fctx.globalCompositeOperation = 'source-over';
    fctx.fillStyle = '#000'; fctx.fillRect(0, 0, fog.width, fog.height);
    fctx.setTransform(z * fk, 0, 0, z * fk, ox * fk, oy * fk);
    // the dull grey remembered map
    const G = st.rend.G;
    if (wx1 > wx0 && wy1 > wy0) fctx.drawImage(st.rend.grey, wx0 * G, wy0 * G, (wx1 - wx0) * G, (wy1 - wy0) * G, wx0, wy0, wx1 - wx0, wy1 - wy0);
    // cut out everything your team can see right now
    fctx.globalCompositeOperation = 'destination-out';
    for (const v of st.viewers) {
      if (v.off) continue;
      if (v.near) { fctx.fillStyle = v === view ? 'rgba(0,0,0,0.5)' : '#000'; fillPoly(fctx, nearPolygon(v, sm)); }
      fctx.fillStyle = '#000'; fillPoly(fctx, visionPolygon(v, sm, v === view ? 0 : 140));
    }
    fctx.globalCompositeOperation = 'source-over';
  }
  // everything from here on goes on the top layer, above the blackout
  ctx = octx; overDirty = true;
  ctx.setTransform(z, 0, 0, z, ox, oy);
  if (st.floorRect) { // hide the neighbouring floors that sit beside this one in the map grid
    const [a, b, c, d] = st.floorRect;
    ctx.fillStyle = '#050607';
    const L = st.cam.x - VW / 2 / z - 50, R = st.cam.x + VW / 2 / z + 50, Tp = st.cam.y - VH / 2 / z - 50, B = st.cam.y + VH / 2 / z + 50;
    if (L < a) ctx.fillRect(L, Tp, a - L, B - Tp);
    if (R > c) ctx.fillRect(c, Tp, R - c, B - Tp);
    if (B > d) ctx.fillRect(a, d, c - a, B - d);
  }

  tq = pfa('fog', tq);
  // --- markers drawn above the blackout ---
  if (inGame && me) {
    ctx.font = '600 6px Barlow Condensed, sans-serif'; ctx.textAlign = 'center';
    for (const sp of s.players) {
      if (!sp.a || sp.id === me.id) continue;
      const p = interp(sp.id, 'players'); if (!p || p.x === undefined) continue;
      if (p.tm === side) {
        ctx.fillStyle = p.dn ? '#ff5050' : '#3aa0ff'; ctx.beginPath(); ctx.arc(p.x, p.y - 17, 2, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillText(p.n + (p.dn ? ' ▼' : ''), p.x, p.y - 21);
      } else if (spotted.has(p.id)) {
        ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(p.x, p.y - 22); ctx.lineTo(p.x - 4, p.y - 29); ctx.lineTo(p.x + 4, p.y - 29); ctx.closePath(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,60,60,0.25)'; ctx.beginPath(); ctx.arc(p.x, p.y, 11, 0, 7); ctx.fill();
      }
    }
    // objective markers
    const site = m.sites[s.site];
    if (side === 'def' || s.rev) for (const b of site.bombs) marker(b.x, b.y, b.id, '#f2c14e', view);
    if (s.pl) marker(s.pl.x, s.pl.y, '!', '#ff4040', view);
    if (side === 'atk') for (const e of ents) if (e.ty === 'defuser') marker(e.x, e.y, 'D', '#f2c14e', view);
    drawMarks(view, now);
    // footstep direction hints around you
    if (view && view.kind === 'body') for (const p of drawn) { /* visible: no hint */ }
    // measured in the shared building frame, so steps on the floor above or below show too, marked ▲ / ▼ (he asked)
    const lv = view && localPos(m, view.x, view.y);
    if (view && view.kind === 'body') for (const sp of s.players) {
      if (!sp.a || sp.sg || sp.tm === side || sp.x === undefined || (sp.mv || 0) < 2) continue; // only running makes noise
      const p = interp(sp.id, 'players'); if (!p) continue;
      const lp = localPos(m, p.x, p.y), fd = lp.f - lv.f, d = Math.hypot(lp.x - lv.x, lp.y - lv.y);
      const range = fd ? 300 : 380;
      if (d > range || Math.abs(fd) > 1 || (!fd && seen(p.x, p.y))) continue;
      floorHint(view, Math.atan2(lp.y - lv.y, lp.x - lv.x), (1 - d / range) * 0.8, fd);
    }
    st.shotHints = (st.shotHints || []).filter(h => now - h.t < 1.2);
    if (view) for (const h of st.shotHints) floorHint(view, h.a, (1 - (now - h.t) / 1.2) * 0.9, h.fd, true);
    // interaction progress ring
    if (me.a && me.bu && me.ct === 'body') {
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(st.pred.x, st.pred.y, 18, 0, 7); ctx.stroke();
      ctx.strokeStyle = '#f2c14e'; ctx.beginPath(); ctx.arc(st.pred.x, st.pred.y, 18, -Math.PI / 2, -Math.PI / 2 + me.bu.p * Math.PI * 2); ctx.stroke();
    }
    // aim line for grenades so you can judge throws
    if (me.a && me.ct === 'body' && keys.has('gadget')) {
      const c = cursor(), mw = screenToWorld(c.x, c.y);
      ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(st.pred.x, st.pred.y); ctx.lineTo(mw.x, mw.y); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  tq = pfa('markers', tq);
  // --- screen-space effects ---
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (view && view.kind === 'drone') droneOverlay(now, ents);
  if (view && view.kind === 'cam') { if (view.dr) droneOverlay(now, ents, view.cam); else camOverlay(view, now); }
  if (me && me.a && me.sc) { ctx.fillStyle = 'rgba(70,90,255,0.12)'; ctx.fillRect(0, 0, VW, VH); }
  const hurtK = Math.max(0, 1 - (now - st.hurtT) / 0.8);
  if (hurtK > 0) {
    const g = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.3, VW / 2, VH / 2, VH * 0.8);
    g.addColorStop(0, 'rgba(160,0,0,0)'); g.addColorStop(1, `rgba(160,0,0,${0.45 * hurtK})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    ctx.save(); ctx.translate(VW / 2, VH / 2); ctx.rotate(st.hurtFrom);
    ctx.fillStyle = `rgba(255,40,40,${0.8 * hurtK})`; ctx.beginPath(); ctx.moveTo(VH * 0.2, -22 * DPR); ctx.lineTo(VH * 0.24, 0); ctx.lineTo(VH * 0.2, 22 * DPR); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  if (now < (st.dazeUntil || 0)) { const k = Math.min(1, st.dazeUntil - now); ctx.fillStyle = `rgba(210,190,140,${0.12 * k})`; ctx.fillRect(0, 0, VW, VH); fx.shake = Math.max(fx.shake, 1.2 * k); }
  if (me && me.a && me.dn) { ctx.fillStyle = 'rgba(90,0,0,0.25)'; ctx.fillRect(0, 0, VW, VH); }
  const fl = st.flashUntil - now;
  if (fl > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(1, fl / 1.2)})`; ctx.fillRect(0, 0, VW, VH); }
  if (inGame && me && me.a && me.ct === 'body' && !me.br) crosshair(me, now);
  else if (inGame) { const c = cursor(); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(c.x, c.y, 2 * DPR, 0, 7); ctx.fill(); }
  if (inGame && padOn && aimMode === 'pad' && !gpRecent() && !menuOpen()) aimPad();
}

function marker(x, y, label, col, view) {
  const z = st.zoom;
  // clamp to screen edges so you can always find it
  const sx = (x - st.cam.x) * z + VW / 2, sy = (y - st.cam.y) * z + VH / 2, pad = 40 * DPR;
  const cx = Math.max(pad, Math.min(VW - pad, sx)), cy = Math.max(pad + 60 * DPR, Math.min(VH - pad - 60 * DPR, sy));
  const wx = (cx - VW / 2) / z + st.cam.x, wy = (cy - VH / 2) / z + st.cam.y;
  ctx.save(); ctx.translate(wx, wy - (cx === sx && cy === sy ? 14 : 0));
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, 7); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = col; ctx.font = '700 7px Barlow Condensed, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 0, 0.5);
  if (view) { const d = Math.round(Math.hypot(x - view.x, y - view.y) / CELL * 0.8); ctx.font = '600 5px Barlow Condensed, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillText(d + 'm', 0, 9); }
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

// the aim pad: a faint ring with a knob where the mouse is and a tick showing which way you face
function aimPad() {
  const P = pad(), z = st.zoom || 1;
  // fade right down when your own character is underneath it
  const near = Math.hypot((st.pred.x - st.cam.x) * z + VW / 2 - P.x, (st.pred.y - st.cam.y) * z + VH / 2 - P.y) < P.r * 1.3;
  ctx.save(); ctx.globalAlpha = near ? 0.35 : 1;
  ctx.lineWidth = 1.5 * DPR; ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.fillStyle = 'rgba(10,16,24,0.18)';
  ctx.beginPath(); ctx.arc(P.x, P.y, P.r, 0, 7); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(120,180,255,0.55)'; ctx.lineWidth = 3 * DPR;
  ctx.beginPath(); ctx.arc(P.x, P.y, P.r, padAng - 0.18, padAng + 0.18); ctx.stroke();
  const kx = P.x + Math.cos(padAng) * padReach * P.r, ky = P.y + Math.sin(padAng) * padReach * P.r;
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(kx, ky, 5 * DPR, 0, 7); ctx.fill();
  ctx.restore();
}

// how hot your gun is right now, worked out every frame (not only when a snapshot arrives) so the crosshair gap closes
// the moment the next shot is exact; a click you just made opens it at once, before the server has even heard of it
function gunHeat(me, w, now) {
  const srv = aimHeat(w, me.sh || 0, (me.fs ?? 99) + (now - (st.mineAt || now)));
  const p = st.shotPred, own = p && p.w === me.w ? aimHeat(w, p.sh, now - p.t) : 0;
  return Math.max(srv, own);
}

function crosshair(me, now) {
  const w = WEAPONS[me.w];
  const gm = gunMods(me.w, attFromCode(me.aa));
  // recoil kicks the crosshair round your character: pull the mouse against it
  const px = (st.pred.x - st.cam.x) * st.zoom + VW / 2, py = (st.pred.y - st.cam.y) * st.zoom + VH / 2;
  // glides to the server's recoil (it arrives 20 times a second) instead of jumping; 25 ms behind at most
  const dtx = Math.min(0.1, now - (st.rcT || now)); st.rcT = now;
  st.rcShow = Math.abs((me.rc || 0) - (st.rcShow || 0)) > 0.3 ? me.rc || 0 : (st.rcShow || 0) + ((me.rc || 0) - (st.rcShow || 0)) * (1 - Math.exp(-dtx / 0.025));
  const rc = st.rcShow, c = Math.cos(rc), s2 = Math.sin(rc);
  const m = cursor(), x = px + (m.x - px) * c - (m.y - py) * s2, y = py + (m.x - px) * s2 + (m.y - py) * c;
  // the gap is the true cone the next shot can land in, measured at the crosshair: shut when the next shot is exact
  const run = Math.min(1, Math.hypot(st.pred.vx || 0, st.pred.vy || 0) / BASE_SPEED);
  const cone = w ? spreadCone(w, gm, { at: me.at || 0, run, crouch: !!me.cr, shots: gunHeat(me, w, now) }) : 0;
  const spread = xh.dynamic ? Math.tan(cone) * Math.hypot(m.x - px, m.y - py) / DPR : 0;
  drawXhair(ctx, x, y, xh, spread, DPR);
  const hk = 1 - (now - st.hitT) / 0.18;
  if (hk > 0) {
    ctx.strokeStyle = st.hitKill ? `rgba(255,60,60,${hk})` : `rgba(255,255,255,${hk})`; ctx.lineWidth = 2 * DPR;
    ctx.beginPath();
    for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { ctx.moveTo(x + dx * 5 * DPR, y + dy * 5 * DPR); ctx.lineTo(x + dx * 11 * DPR, y + dy * 11 * DPR); }
    ctx.stroke();
  }
}

function droneOverlay(now, ents, d = ents.find(e => st.me && e.id === st.me.did)) {
  ctx.strokeStyle = 'rgba(160,255,200,0.6)'; ctx.lineWidth = 2 * DPR;
  const p = 60 * DPR, L = 40 * DPR;
  for (const [x, y, sx, sy] of [[p, p, 1, 1], [VW - p, p, -1, 1], [p, VH - p, 1, -1], [VW - p, VH - p, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(x, y + sy * L); ctx.lineTo(x, y); ctx.lineTo(x + sx * L, y); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(140,255,190,0.04)'; for (let y = 0; y < VH; y += 4 * DPR) ctx.fillRect(0, y, VW, DPR);
  if (d && d.j) { // jammed: static
    for (let i = 0; i < 400; i++) { ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.25})`; ctx.fillRect(Math.random() * VW, Math.random() * VH, 30 * DPR * Math.random(), 2 * DPR); }
  }
}
function camOverlay(view, now) {
  ctx.fillStyle = 'rgba(30,60,90,0.18)'; ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = 'rgba(255,255,255,0.035)'; for (let y = (now * 40 * DPR) % (4 * DPR); y < VH; y += 4 * DPR) ctx.fillRect(0, y, VW, DPR);
  ctx.fillStyle = Math.floor(now * 2) % 2 ? '#ff3030' : 'rgba(255,48,48,0.3)'; ctx.beginPath(); ctx.arc(80 * DPR, 120 * DPR, 7 * DPR, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `700 ${18 * DPR}px Barlow Condensed`; ctx.textAlign = 'left'; ctx.fillText('REC', 94 * DPR, 126 * DPR);
  if (view.cam && view.cam.tu) { ctx.fillStyle = '#ff6060'; ctx.font = `700 ${16 * DPR}px Barlow Condensed`; ctx.fillText(view.cam.hot ? 'TURRET · OVERHEATED, COOLING DOWN' : view.ro ? 'TURRET · ONLY ITS OWNER CAN FIRE IT' : 'TURRET · CLICK TO FIRE THE LASER', 80 * DPR, 150 * DPR); }
  if (view.off) { for (let i = 0; i < 900; i++) { ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.4})`; ctx.fillRect(Math.random() * VW, Math.random() * VH, 4 * DPR, 2 * DPR); } }
}

// ---------------- screens & HUD ----------------
function screens(s, phase, now) {
  const show = (id, on) => $(id).classList.toggle('hidden', !on);
  const joined = !!st.id;
  show('splash', !st.started);
  show('lobby', st.started && (phase === PHASE.LOBBY || !joined));
  // music in the menus, silence in the field
  if (st.started) {
    const want = !joined || phase === PHASE.LOBBY || phase === PHASE.SELECT || phase === PHASE.MATCH_END;
    if (want !== st.music) { st.music = want; want ? startMusic(phase === PHASE.SELECT ? 'select' : 'menu') : stopMusic(); }
    if (want) setMood(phase === PHASE.SELECT ? 'select' : 'menu');
  }
  countdown(s, phase);
  show('select', joined && phase === PHASE.SELECT);
  show('hud', joined && (phase === PHASE.PREP || phase === PHASE.ACTION || phase === PHASE.ROUND_END));
  show('endscreen', joined && (phase === PHASE.MATCH_END || st.forceEnd));
  show('leaveBtn', joined && phase !== PHASE.LOBBY);
  if (st.bannerT && now > st.bannerT) { $('banner').classList.remove('show'); st.bannerT = 0; }
  if (!s || now - st.lastHud < 0.08) return;
  st.lastHud = now;
  if (phase === PHASE.LOBBY) renderLobby(s);
  else if (phase === PHASE.SELECT) buildSelect(s);
  else if (phase !== PHASE.MATCH_END) hud(s);
  $('scoreboard').classList.toggle('hidden', !keys.has('scoreboard'));
  if (keys.has('scoreboard')) $('scoreboard').innerHTML = scoreTable(s);
}

function hud(s) {
  const me = st.me; if (!me) return;
  const side = me.tm, site = st.map.sites[s.site];
  // top bar
  const icons = (list, ally) => list.map(p => {
    const known = ally || !p.a;
    const cls = [ally ? 'ally' : 'enemy', p.a ? '' : 'dead', p.dn ? 'down' : '', known ? '' : 'unknown'].join(' ');
    return `<div class="${cls}" title="${esc(p.n)}">${known && p.op ? OPERATORS[p.op].name.slice(0, 3) : '?'}</div>`;
  }).join('');
  const mine = s.players.filter(p => p.sq === me.sq), theirs = s.players.filter(p => p.sq !== me.sq);
  setHTML('tiL', icons(mine, true)); setHTML('tiR', icons(theirs, false));
  $('scL').textContent = s.sc[me.sq]; $('scR').textContent = s.sc[1 - me.sq];
  const t = s.pl ? s.pl.t : s.tm;
  $('time').textContent = s.fp && !s.pl ? '∞' : `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  $('time').classList.toggle('planted', !!s.pl);
  $('phase').textContent = s.pl ? 'DEFUSER' : s.fp ? 'FREE PLAY' : s.ph === PHASE.PREP ? 'PREPARATION' : s.ph === PHASE.ACTION ? 'ACTION' : 'ROUND OVER';
  $('roundNo').textContent = s.fp ? (side === 'atk' ? 'ATTACK' : 'DEFENCE') : `ROUND ${s.rd} · ${side === 'atk' ? 'ATTACK' : 'DEFENCE'}`;
  // free play: which keys switch operator, and who you'd get
  $('freeHint').classList.toggle('hidden', !s.fp);
  if (s.fp && me.op) {
    const all = [...opsForTeam('atk'), ...opsForTeam('def')], i = all.indexOf(me.op), n = all.length;
    const nm = k => `${OPERATORS[k].name}${OPERATORS[k].team !== side ? (OPERATORS[k].team === 'atk' ? ' (attack)' : ' (defence)') : ''}`;
    setHTML('freeHint', `Switch operator: <kbd>${esc(label('opPrev'))}</kbd> ${esc(nm(all[(i - 1 + n) % n]))} · <b>${esc(OPERATORS[me.op].name)}</b> · ${esc(nm(all[(i + 1) % n]))} <kbd>${esc(label('opNext'))}</kbd>`);
  }
  // objective
  let obj, sub = '';
  const where = me.a && me.x !== undefined ? roomAt(st.map, st.pred.x, st.pred.y) : '';
  if (side === 'def') {
    obj = s.pl ? 'DISABLE THE DEFUSER!' : s.ph === PHASE.PREP ? `FORTIFY: ${site.name}` : `DEFEND: ${site.name}`;
    sub = s.ph === PHASE.PREP ? `Reinforcements left: ${s.rf} · hold E on walls to reinforce, E on doors/windows to barricade, melee soft walls for rotation holes` : `Reinforcements left: ${s.rf}`;
  } else {
    obj = s.pl ? 'PROTECT THE DEFUSER' : s.ph === PHASE.PREP ? 'LOCATE THE OBJECTIVE WITH YOUR DRONE' : s.rev ? `PLANT THE DEFUSER: ${site.name}` : 'FIND THE OBJECTIVE';
    if (me.df) sub = 'You are carrying the defuser';
    else { const c = s.players.find(p => p.df); sub = c ? `${c.n} has the defuser` : 'The defuser is on the ground'; }
  }
  const fi = me.a && me.x !== undefined ? floorAt(st.map, st.pred.x, st.pred.y) : -1;
  const flName = fi >= 0 && st.map.floors.length > 1 ? st.map.floors[fi].name : '';
  setHTML('objective', `${esc(obj)}<small>${flName ? '<b class="flr">' + esc(flName) + '</b> ' : ''}${esc(sub)}${where ? ' · ' + esc(where) : ''}</small>`);
  if (!me.a) {
    $('opname').innerHTML = me.op ? `${OPERATORS[me.op].name}` : '';
    $('hpnum').textContent = '—'; $('hpbar').firstElementChild.style.width = '0%';
    $('status').textContent = 'ELIMINATED'; $('br').style.visibility = 'hidden';
    $('prompt').innerHTML = ''; $('progress').style.display = 'none';
    const mates = s.players.filter(p => p.a && p.sq === me.sq);
    $('viewlabel').textContent = mates.length ? `SPECTATING ${mates[st.spect % mates.length].n.toUpperCase()} · CLICK TO SWITCH` : '';
    return;
  }
  $('br').style.visibility = '';
  const o = OPERATORS[me.op];
  $('opname').innerHTML = `${o.name}<small>${o.role.toUpperCase()}</small>`;
  $('hpnum').textContent = me.hp;
  const bar = $('hpbar').firstElementChild;
  bar.style.width = Math.min(100, me.hp / me.mhp * 100) + '%';
  bar.className = me.hp > me.mhp ? 'over' : me.hp < 35 || me.dn ? 'low' : '';
  $('status').textContent = me.dn ? `DOWNED — BLEEDING OUT · ${Math.ceil(me.hp)}s` : me.df ? 'DEFUSER CARRIER' : '';
  const w = WEAPONS[me.w];
  $('wname').textContent = w ? `${w.name.toUpperCase()} · ${CLASS_NAME[w.cls].toUpperCase()}` : '';
  const pk = me.w + '|' + me.aa;
  if ($('wpic').dataset.k !== pk) { $('wpic').dataset.k = pk; $('wpic').innerHTML = ''; if (me.w) $('wpic').appendChild(gunPicture(me.w, attFromCode(me.aa), 150, 49)); }
  $('mag').textContent = me.rl > 0 ? '··' : me.am; $('mag').className = w && me.am <= w.mag * 0.25 ? 'low' : '';
  $('res').textContent = '/ ' + me.rs;
  const ab = o.ability, g = GADGETS[me.gd || o.gadget];
  const abCount = ab.battery ? `${Math.round(me.bat / ab.battery * 100)}%` : ab.count ? me.ac : '';
  const viewName = side === 'atk' ? `Drone${s.ph === PHASE.ACTION ? ' ×' + me.dr : ''}` : 'Cameras';
  setHTML('gadgets',
    `<div class="${ab.count && me.ac <= 0 ? 'out' : ''}"><b>${label('ability')}</b>${me.gi ? 'Release the gas' : ab.name}<em>${me.gi ? '!' : abCount}</em></div>` +
    `<div class="${me.gc <= 0 && !me.ni ? 'out' : ''}"><b>${label('gadget')}</b>${me.ni ? 'Detonate Nitro' : g.name}<em>${me.ni ? '!' : me.gc}</em></div>` +
    `<div><b>${label('view')}</b>${viewName}</div>`);
  // view label
  let vl = '';
  if (me.ct === 'drone') { const d = s.ents.find(e => e.id === me.did); vl = d && d.j ? 'DRONE JAMMED' : `YOUR DRONE · CLICK OR ${label('spot')} TO PING · WHEEL: TEAM DRONES · ${label('view')} TO EXIT`; }
  else if (me.ct === 'cam') {
    const list = feedList(s, me), c = list.find(e => e.id === me.fi);
    if (c) {
      const ro = c.ow && c.ow !== me.id, who = ro ? `${ownerName(s, c.ow).toUpperCase()}'S ` : c.ow ? 'YOUR ' : '';
      vl = `${who}${feedKind(c)} ${list.indexOf(c) + 1}/${list.length} · ${(roomAt(st.map, c.x, c.y) || 'outside').toUpperCase()} · ${ro || c.ty !== 'cam' ? 'WATCH ONLY' : 'MOUSE LOOK'} · ${label('left')} ${label('right')} SWITCH · CLICK PING${c.off || c.j ? ' · DISRUPTED' : ''}`;
    }
  }
  $('viewlabel').textContent = vl;
  camBar(s, me);
  // interaction
  if (me.bu) {
    $('progress').style.display = 'block';
    $('progress').querySelector('.label').textContent = { plant: 'PLANTING DEFUSER', defuse: 'DISABLING DEFUSER', revive: 'REVIVING', reinforce: 'REINFORCING', barricade: 'BARRICADING' }[me.bu.k] || '';
    $('progress').querySelector('i').style.width = me.bu.p * 100 + '%';
    $('prompt').innerHTML = '';
  } else {
    $('progress').style.display = 'none';
    $('prompt').innerHTML = me.ct === 'body' && !me.dn ? promptText(s, me) : '';
  }
}
function setHTML(id, h) { const el = $(id); if (el.innerHTML !== h) el.innerHTML = h; }

function promptText(s, me) {
  const side = me.tm, x = st.pred.x, y = st.pred.y, m = st.map;
  if (side === 'atk' && me.df && s.ph === PHASE.ACTION && !s.pl) {
    const b = m.sites[s.site].bombs.find(b => Math.hypot(b.x - x, b.y - y) < 30);
    if (b) return `<b>${label('interact')}</b>HOLD TO PLANT DEFUSER (BOMB ${b.id})`;
  }
  if (side === 'def' && s.pl && Math.hypot(s.pl.x - x, s.pl.y - y) < 30) return '<b>' + label('interact') + '</b>HOLD TO DISABLE DEFUSER';
  const down = s.players.find(p => p.a && p.dn && p.tm === side && p.id !== me.id && Math.hypot(p.x - x, p.y - y) < 26);
  if (down) return `<b>${label('interact')}</b>HOLD TO REVIVE ${esc(down.n.toUpperCase())}`;
  const f = facingCell(m, x, y, st.aim, 28);
  if (side === 'def' && f) {
    if (f.t === T.SOFT && s.rf > 0) return `<b>${label('interact')}</b>HOLD TO REINFORCE WALL (${s.rf} LEFT)`;
    if (f.t === T.OPEN && m.openId[f.k] >= 0) return `<b>${label('interact')}</b>BARRICADE${me.op === 'mason' && me.ac > 0 ? '  ·  <b>' + label('ability') + '</b>ARMOR PANEL' : ''}`;
    if (f.t === T.BARRI && me.op === 'mason' && me.ac > 0) return '<b>' + label('ability') + '</b>ARMOR PANEL';
  }
  if (f && f.t === T.BARRI) return '<b>' + label('melee') + '</b>MELEE TO BREAK BARRICADE';
  if (!me.vt && findVault(m, x, y, vaultDir())) return '<b>' + label('vault') + '</b>VAULT';
  const h = hatchNear(m, x, y, st.aim, 14), ht = h && m.tiles[h.cells[0]];
  if (h && !(f && Math.hypot((f.cx + 0.5) * CELL - x, (f.cy + 0.5) * CELL - y) < Math.hypot(h.x - x, h.y - y))) {
    if (ht === T.HATCH && side === 'def' && s.rf > 0) return `<b>${label('interact')}</b>HOLD TO REINFORCE HATCH (${s.rf} LEFT)`;
    if (ht === T.HATCH) return `<b>${label('melee')}</b>MELEE TO BREAK HATCH${side === 'atk' && me.op === 'talon' && me.gc > 0 ? '  ·  <b>' + label('gadget') + '</b>BREACH CHARGE' : ''}`;
    if (ht === T.HATCHR && side === 'atk' && me.op === 'ember' && me.ac > 0) return '<b>' + label('ability') + '</b>PLACE PLASMA CUTTER ON HATCH';
  }
  if (side === 'atk' && f && me.op === 'ember' && me.ac > 0 && [T.SOFT, T.REINF, T.BARRI, T.PANEL].includes(f.t)) return '<b>' + label('ability') + '</b>PLACE PLASMA CUTTER';
  if (side === 'atk' && f && me.op === 'talon' && me.gc > 0 && [T.SOFT, T.BARRI].includes(f.t)) return '<b>' + label('gadget') + '</b>PLACE BREACH CHARGE';
  return '';
}

$('conn').classList.add('hidden');
// Everything the game draws is prepared up front, behind a loading screen, so nothing has to be made mid-match.
runLoading('LOADING', [
  ['Loading fonts', () => document.fonts.ready],
  ['Building the map', () => loadMap(-1)], // the map drifts behind the title screen and menus
  ['Drawing the guns', jobsStep(Object.keys(WEAPONS).flatMap(w => [[270, 84], [210, 74], [150, 49], [160, 50], [300, 100]].map(([a, b]) => () => gunPicture(w, {}, a, b))), 8)],
  ['Drawing the operators', jobsStep(Object.keys(OPERATORS).map(k => () => portraitCached(document.createElement('canvas'), k)), 6)],
  ['Getting the graphics card ready', () => frames(6)],
]);
connect();
requestAnimationFrame(frame);

// Field of view like a modern shooter: ~103° normally, narrower when aiming down sights.
const FOV_HIP = 103 * Math.PI / 180, FOV_ADS = 70 * Math.PI / 180, FOV_SCOPE = 55 * Math.PI / 180;
function fovFor(p) {
  const target = !p || !p.ad ? FOV_HIP : (WEAPONS[p.w] && WEAPONS[p.w].cls === 'DMR' ? FOV_SCOPE : FOV_ADS);
  const a = anim(p ? p.id : 'none');
  a.fov = a.fov === undefined ? target : a.fov + (target - a.fov) * 0.35; // quick zoom in/out
  return a.fov;
}

// Your own heartbeat and breathing when badly hurt or downed.
function bodySounds(me, dt) {
  if (!me || !me.a || !st.last || st.last.ph !== PHASE.ACTION) return;
  st.hbT = (st.hbT || 0) - dt; st.brT = (st.brT || 0) - dt;
  if ((me.dn || me.hp < 35) && st.hbT <= 0) { audio.foley('heartbeat'); st.hbT = me.dn ? 0.85 : 1.15; }
  if (me.hp < 35 && !me.dn && st.brT <= 0) { audio.foley('breath'); st.brT = 3.2; }
}

// Everything your team can look through (the server's feeds()): defence every working camera, map,
// turret or sticky; attack every drone and wall scope. Only your own drone/gadget is yours to steer.
function feedList(s, me) {
  return s.ents.filter(e => e.tm === me.tm && (me.tm === 'def' ? e.ty === 'cam' && e.hp > 0 : e.ty === 'drone' || e.ty === 'scope'));
}
function feedKind(c) { return c.ty === 'drone' ? 'DRONE' : c.ty === 'scope' ? 'WALL SCOPE' : c.tu ? 'TURRET' : c.ow ? 'STICKY CAM' : 'CAMERA'; }
function ownerName(s, id) { const p = s.players.find(p => p.id === id); return p ? p.n.replace(/^\[BOT\] /, '') : 'TEAMMATE'; }
function feedView(c, me) {
  const ro = c.ow && c.ow !== me.id ? 1 : 0;
  if (c.ty === 'drone') { const ic = interp(c.id, 'ents') || c; return { x: ic.x, y: ic.y, ang: ic.ag || c.ag || 0, fov: Math.PI * 2, range: 230, near: 0, kind: 'cam', cam: c, dr: 1, ro: 1 }; }
  if (c.ty === 'scope') return { x: c.x, y: c.y, ang: c.ag || 0, fov: 1.3, range: 420, near: 6, kind: 'cam', cam: c, ro: 1 };
  return { x: c.x, y: c.y, ang: ro ? c.ag || 0 : st.aim, fov: 1.9, range: 650, near: 14, kind: 'cam', off: c.off, cam: c, ro };
}

// Clickable list of the team's cameras / drones along the bottom while you're looking through them.
function camBar(s, me) {
  const bar = $('cambar');
  if (me.ct !== 'cam' && me.ct !== 'drone') { if (bar.innerHTML) bar.innerHTML = ''; return; }
  const def = me.tm === 'def', list = def ? s.ents.filter(e => e.ty === 'cam' && e.tm === 'def') : feedList(s, me); // broken cameras stay listed, greyed
  const cur = me.ct === 'drone' ? me.did : me.fi;
  let n = 0;
  const html = list.map(c => {
    const live = !def || c.hp > 0, mine = c.ow === me.id;
    const name = c.ow ? (mine ? 'MY ' : `${ownerName(s, c.ow).toUpperCase()}'S `) + (c.ty === 'cam' ? (c.tu ? 'TURRET' : 'STICKY') : c.ty === 'scope' ? 'SCOPE' : 'DRONE') : `CAM ${++n}`;
    return `<button data-id="${live ? c.id : ''}" class="${c.id === cur ? 'on' : ''} ${live ? '' : 'dead'}">${esc(name)}<small>${esc((roomAt(st.map, c.x, c.y) || 'outside').toUpperCase())}${c.off || c.j ? ' · DISRUPTED' : ''}</small></button>`;
  }).join('');
  if (bar.innerHTML !== html) {
    bar.innerHTML = html;
    for (const b of bar.querySelectorAll('button')) b.onclick = e => { e.stopPropagation(); if (b.dataset.id) st.evq.push({ k: 'camSet', id: b.dataset.id }); };
  }
}

// ---------------- shared team vision ----------------
// Everything that can see for your team: you, teammates, their drones, and (defence) working cameras.
function teamViewers(s, view, me, inGame) {
  const vs = [];
  if (view) vs.push(view);
  if (!s || !me || !inGame) return vs;
  const side = me.tm;
  for (const sp of s.players) {
    if (!sp.a || sp.sg || sp.tm !== side || sp.x === undefined) continue;
    if (sp.id === me.id && view && view.kind === 'body') continue;
    const p = sp.id === me.id ? { ...sp, x: st.pred.x, y: st.pred.y } : interp(sp.id, 'players');
    if (!p || p.x === undefined) continue;
    if (view && view.kind === 'spect' && Math.hypot(view.x - p.x, view.y - p.y) < 1) continue;
    if (sp.id === me.id && me.ct === 'drone') { vs.push({ x: me.x, y: me.y, ang: me.ag, fov: fovFor(me), range: 1100, near: 26, kind: 'mate' }); continue; }
    vs.push({ x: p.x, y: p.y, ang: p.ag, fov: fovFor(p), range: 1100, near: 26, kind: 'mate' });
  }
  for (const e of s.ents) {
    if (e.tm !== side) continue;
    const ie = interp(e.id, 'ents') || e;
    if (e.ty === 'drone') {
      if (view && view.kind === 'drone' && me.did === e.id) continue;
      vs.push({ x: ie.x, y: ie.y, ang: 0, fov: Math.PI * 2, range: 230, near: 0, kind: 'drone' });
    } else if (e.ty === 'scope' && side === 'atk') { // Wall Scope: a view through the wall
      vs.push({ x: ie.x, y: ie.y, ang: e.ag || 0, fov: 1.3, range: 420, near: 6, kind: 'cam' });
    } else if (e.ty === 'cam' && e.hp > 0 && !e.off && side === 'def') {
      if (view && view.kind === 'cam' && view.cam.id === e.id) continue;
      vs.push({ x: e.x, y: e.y, ang: e.ag || 0, fov: 1.9, range: 650, near: 14, kind: 'cam' });
    }
  }
  // an open hatch someone can see into shows a little of the room on the other side of it
  const m = st.map, sm = smokes(s), n = vs.length;
  for (const h of m.hatches || []) {
    if (m.tiles[h.cells[0]] !== T.HOLE) continue;
    let up = false, down = false;
    for (let i = 0; i < n; i++) { const v = vs[i]; if (!up && canSee(m, v, h.x, h.y, sm)) up = true; if (!down && canSee(m, v, h.bx, h.by, sm)) down = true; }
    if (up) vs.push({ x: h.bx, y: h.by, ang: 0, fov: Math.PI * 2, range: 72, near: 72, kind: 'hatch' });
    if (down) vs.push({ x: h.x, y: h.y, ang: 0, fov: Math.PI * 2, range: 40, near: 40, kind: 'hatch' });
  }
  return vs;
}
// a copy of someone on a staircase (stairGhost): seen by a teammate's eyes, drone or camera near that staircase
// a direction hint round your character: an arc, and ▲ / ▼ when it comes from the floor above or below
function floorHint(view, a, al, fd, shot = false) {
  ctx.strokeStyle = shot ? `rgba(255,80,60,${al})` : `rgba(255,140,60,${al})`; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.arc(view.x, view.y, 30, a - 0.22, a + 0.22); ctx.stroke();
  if (fd) {
    ctx.font = '700 9px Barlow Condensed, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = shot ? `rgba(255,90,70,${al})` : `rgba(255,150,70,${al})`;
    ctx.fillText((fd > 0 ? '▲' : '▼') + (shot ? (fd > 0 ? ' SHOTS ABOVE' : ' SHOTS BELOW') : ''), view.x + Math.cos(a) * 40, view.y + Math.sin(a) * 40);
    ctx.textBaseline = 'alphabetic';
  }
}
function ghostSeen(gh) {
  const sm = smokes(st.last);
  for (const v of st.viewers || []) if (!v.off && v.kind !== 'hatch' && floorAt(st.map, v.x, v.y) === gh.fl && stairLooks(st.map, gh.s, v.x, v.y) && canSee(st.map, v, gh.x, gh.y, sm)) return true;
  return false;
}
function teamSeesBody(x, y) { // seen by someone's own eyes (not a drone, camera or scope)
  const sm = smokes(st.last);
  for (const v of st.viewers || []) if (!v.off && v.kind !== 'drone' && v.kind !== 'cam' && canSee(st.map, v, x, y, sm)) return true;
  return false;
}
function teamSees(x, y) {
  const sm = smokes(st.last);
  for (const v of st.viewers || []) if (!v.off && canSee(st.map, v, x, y, sm)) return true;
  return false;
}
// Is this map cell (often a wall, which blocks the line itself) visible to the team?
function cellSeen(k) {
  const m = st.map, x = (k % m.W + 0.5) * CELL, y = (Math.floor(k / m.W) + 0.5) * CELL;
  for (const v of st.viewers || []) {
    if (v.off) continue;
    const d = Math.hypot(x - v.x, y - v.y);
    if (d > v.range) continue;
    const a = Math.atan2(y - v.y, x - v.x);
    if (d > v.near + 12 && Math.abs(angDiff(a, v.ang)) > v.fov / 2 + 0.12) continue;
    if (d < 14 || castSight(m, v.x, v.y, a, d, null) >= d - 13) return true;
  }
  return false;
}
function applyKnown(k) {
  const m = st.map, K = st.known, prev = K.tiles[k], nh = m.holes[k] ? m.holes[k].length : 0;
  if (prev === m.tiles[k] && K.hp[k] === m.hp[k] && nh === (K.holes[k] ? K.holes[k].length : 0)) return;
  K.tiles[k] = m.tiles[k]; K.hp[k] = m.hp[k];
  if (nh && m.tiles[k] === T.SOFT) K.holes[k] = m.holes[k].slice(); else delete K.holes[k];
  st.rend.cellChanged(k);
  if (m.hatchAt[k] >= 0) for (const b of m.hatches[m.hatchAt[k]].below) st.rend.cellChanged(b); // the hole shows in the ceiling below too
  const wall = t => t === T.SOFT || t === T.BARRI || t === T.REINF || t === T.PANEL || t === T.DSHIELD;
  if (prev === T.BARRI && !wall(m.tiles[k])) for (const d of [0, 1, -1, m.W, -m.W]) st.splinters.add(k + d);
  if (wall(prev) && !wall(m.tiles[k])) fx.wallBreak((k % m.W + 0.5) * CELL, (Math.floor(k / m.W) + 0.5) * CELL, prev === T.BARRI ? '150,100,55' : m.mat[k] === MAT.BRICK ? '150,80,60' : '210,205,190');
}
function revealSeen() {
  if (!st.unseen || !st.unseen.size) return;
  const t = performance.now(); if (t - (st.revealT || 0) < 100) return; // ten times a second is plenty
  st.revealT = t;
  for (const k of st.unseen) if (cellSeen(k)) { applyKnown(k); st.unseen.delete(k); }
}
function revealAll() { if (!st.unseen) return; for (const k of st.unseen) applyKnown(k); st.unseen.clear(); }

// ---------------- pause menu & pages ----------------
const OVERLAYS = ['settings', 'opsPage', 'profilePage', 'armoryPage', 'pause', 'quitDlg'];
function menuOpen() { return OVERLAYS.some(id => !$(id).classList.contains('hidden')); }
function inMatch() { const p = st.last && st.last.ph; return p === PHASE.PREP || p === PHASE.ACTION || p === PHASE.ROUND_END || p === PHASE.SELECT; }
function showOps(op) { audio.ui('open'); openOps($('opsPage'), { profile: st.profile, send, op }); }
function showProfile() { audio.ui('open'); if (st.token) openProfile($('profilePage'), { token: st.token }); }
// Esc closes whatever is open, otherwise opens/closes the pause menu during a match.
function escape() {
  for (const id of ['settings', 'opsPage', 'profilePage', 'armoryPage']) if (!$(id).classList.contains('hidden')) {
    if (id === 'opsPage') closeOps($(id)); else if (id === 'armoryPage') closeArmory($(id)); else $(id).classList.add('hidden');
    return;
  }
  if (!$('quitDlg').classList.contains('hidden')) { $('quitDlg').classList.add('hidden'); audio.ui('back'); return; }
  if (inMatch() || !$('pause').classList.contains('hidden')) $('pause').classList.toggle('hidden');
  else { $('quitDlg').classList.remove('hidden'); audio.ui('open'); } // title screen / menus: offer to quit
}
const APP = new URLSearchParams(location.search).has('app');
addEventListener('beforeunload', e => { if (st.id && !st.quitting && inMatch()) { e.preventDefault(); e.returnValue = ''; } }); // opened from the desktop icon (full-screen window)
async function quitGame() {
  stopMusic(); st.quitting = true;
  if (APP) { try { await fetch('/api/quit', { method: 'POST' }); } catch {} }
  window.close();
  setTimeout(() => { document.body.innerHTML = '<div style="display:grid;place-items:center;height:100vh;font:700 28px Barlow Condensed,sans-serif;letter-spacing:.2em;color:#93a0ad">YOU CAN CLOSE THIS TAB NOW</div>'; }, 600);
}
$('qYes').onclick = () => quitGame();
$('qNo').onclick = () => $('quitDlg').classList.add('hidden');
$('pQuit').onclick = () => { $('pause').classList.add('hidden'); $('quitDlg').classList.remove('hidden'); };
// In fullscreen the browser uses Esc to leave fullscreen, so open the pause menu when that happens.
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && inMatch() && !menuOpen()) $('pause').classList.remove('hidden'); });
$('pResume').onclick = () => $('pause').classList.add('hidden');
$('pOps').onclick = () => showOps(st.me && st.me.op);
$('pProf').onclick = () => showProfile();
$('pSet').onclick = () => toggleSettings();
$('pFs').onclick = () => { toggleFullscreen(); $('pause').classList.add('hidden'); };
$('pEnd').onclick = () => { if (st.tutorial || st.free) return switchMatch(null); if (confirm('End the match for everyone and go back to the lobby?')) { send({ t: 'lobby', a: 'end' }); $('pause').classList.add('hidden'); } };
$('lobbyOpsBtn').onclick = () => showOps();
$('lobbyProfBtn').onclick = () => showProfile();
$('armoryPage').querySelector('.close').onclick = () => closeArmory($('armoryPage'));
for (const id of ['opsPage', 'profilePage']) $(id).querySelector('.close').onclick = () => { if (id === 'opsPage') closeOps($(id)); else $(id).classList.add('hidden'); };

// ---------------- title screen, main menu, little touches ----------------
st.started = false;
$('splash').addEventListener('click', () => {
  if (st.started) return;
  audio.initAudio(); audio.ui('open');
  runLoading('PREPARING SOUNDS', [['Recording gunshots and footsteps', jobsStep(audio.soundJobs(), 6)]]); // built now, not the first time you hear them
  if (!document.fullscreenElement && !inApp()) document.documentElement.requestFullscreen().catch(() => {});
  st.started = true; updateNav();
  let saved = ''; try { saved = localStorage.getItem('r62d-name') || ''; } catch {}
  if (saved) { $('name').value = saved; setTimeout(() => $('joinBtn').click(), 250); } // returning player: straight in
  else setTimeout(() => $('name').focus(), 300);
});
function setTab(tab) {
  if ((tab === 'ops' || tab === 'profile') && !st.token) { audio.ui('back'); $('name').focus(); tab = 'play'; }
  if (tab === 'ops') { showOps(); return; }
  if (tab === 'profile') { showProfile(); return; }
  if (tab === 'armory') { audio.ui('open'); openArmory($('armoryPage')); return; }
  if (tab === 'settings') { toggleSettings(); return; }
  if (tab === 'quit') { $('quitDlg').classList.remove('hidden'); audio.ui('open'); return; }
  for (const b of $('mnav').querySelectorAll('button')) b.classList.toggle('on', b.dataset.tab === tab);
  for (const t of document.querySelectorAll('.tab')) t.classList.toggle('on', t.id === 'tab-' + tab);
  if (tab === 'controls') renderControls();
  if (tab === 'free') renderFree();
  updateNav();
}
function updateNav() {
  const on = $('mnav').querySelector('button.on'), ind = $('navInd');
  if (on) { ind.style.top = on.offsetTop + 8 + 'px'; ind.style.height = (on.offsetHeight - 16) + 'px'; }
}
for (const b of $('mnav').querySelectorAll('button')) b.onclick = () => setTab(b.dataset.tab);
addEventListener('resize', updateNav);
function updateCard() {
  const p = st.profile; if (!p) return;
  const L = levelFor(p.xp || 0);
  $('pcard').classList.remove('hidden');
  $('pcName').textContent = p.name; $('pcLevel').textContent = L.level;
  $('pcXp').style.width = (L.into / L.need * 100) + '%'; $('pcXpText').textContent = `LEVEL ${L.level} · ${L.into} / ${L.need} XP`;
}
const TIPS = [
  'Walk (Shift) or crouch (Ctrl) to move without footsteps — just like CS2.',
  'Stop before you shoot: running ruins your accuracy. Crouching still is the most accurate.',
  'Broken glass under windows crunches loudly — listen for it.',
  'Defenders: reinforce the walls of the objective room before the action phase starts.',
  'Attackers: use your drone in preparation to find the objective before you go in.',
  'Bullets go through soft walls. If you can hear them, you can shoot them.',
  'A downed teammate can be revived — hold interact next to them.',
  'Press T (or middle click) to ping anything for your team: enemies, cameras, traps, doors, walls, or a place to go.',
  'New to R62D? The TUTORIAL tab teaches the phases, the roles and pinging in two short playable lessons.',
  'Cameras see a cone: aim them with the mouse and switch with A and D.',
  'Change your loadout for every operator on the Operators page.',
  'Smashed barricades leave splinters that crack underfoot.',
];
let tipI = Math.floor(Math.random() * TIPS.length);
const nextTip = () => { const el = $('tip'); el.textContent = TIPS[tipI++ % TIPS.length]; el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; };
nextTip(); setInterval(nextTip, 8000);
// every button: soft hover tick, click sound and a ripple from where you clicked
let lastHover = 0;
document.addEventListener('pointerover', e => {
  const b = e.target.closest && e.target.closest('button'); if (!b || b.contains(e.relatedTarget)) return;
  const t = performance.now(); if (t - lastHover > 45) { lastHover = t; audio.ui('hover'); }
});
document.addEventListener('pointerdown', e => {
  const b = e.target.closest && e.target.closest('button'); if (!b) return;
  audio.initAudio();
  const r = b.getBoundingClientRect(), sp = document.createElement('span');
  sp.className = 'ripple'; sp.style.left = (e.clientX - r.left) + 'px'; sp.style.top = (e.clientY - r.top) + 'px';
  b.appendChild(sp); setTimeout(() => sp.remove(), 520);
  audio.ui(b.classList.contains('close') || b.id === 'setClose' || b.id === 'pResume' ? 'back' : 'click');
});
// 3-2-1 before the action phase, then GO
function countdown(s, phase) {
  const el = $('countdown'); if (!s) return;
  if (phase === PHASE.PREP && s.tm <= 3.05 && s.tm > 0) {
    const n = Math.ceil(s.tm);
    if (n !== st.cd) { st.cd = n; el.textContent = n; el.className = ''; void el.offsetWidth; el.className = 'go'; audio.ui('count'); }
  } else if (phase === PHASE.ACTION && st.cd && st.cd !== 'GO') {
    st.cd = 'GO'; el.textContent = 'GO'; el.className = ''; void el.offsetWidth; el.className = 'go'; audio.ui('go');
  } else if (phase !== PHASE.PREP && phase !== PHASE.ACTION) st.cd = null;
}
// music volume
try {
  const v = JSON.parse(localStorage.getItem('r62d-music2') || 'null'), o = JSON.parse(localStorage.getItem('r62d-music') || 'null');
  if (v !== null) $('volMusic').value = v; else if (o !== null) $('volMusic').value = fromOld('volMusic', o);
} catch {}
setMusicVolume(musicVol());
$('volMusic').oninput = () => { setMusicVolume(musicVol()); try { localStorage.setItem('r62d-music2', $('volMusic').value); } catch {} };
window.__r62d = { PF, st, showEnd, playXp }; // for automated screenshot tests

// ---------------- settings saved per profile ----------------
// Keys and volumes live in your profile on the game computer, so they follow you to any browser.
function currentSettings() {
  try { localStorage.setItem('r62d-sens', JSON.stringify([+$('sens').value, +$('adsSens').value])); } catch {}
  return { bindsVersion: BINDS_VERSION, binds: getBinds(), volMaster: +$('volMaster').value, volSfx: +$('volSfx').value, volMusic: +$('volMusic').value, vc: 2, sens: +$('sens').value, adsSens: +$('adsSens').value, aim: aimMode, xh };
}
let saveTimer = 0;
function saveSettings() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { if (st.token) send({ t: 'settings', s: currentSettings() }); }, 400);
}
function applySettings(s) {
  if (s.binds && s.bindsVersion === BINDS_VERSION) applyBinds(s.binds); else setTimeout(saveSettings, 500); // old layout: switch to the new defaults once
  for (const k of ['volMaster', 'volSfx', 'volMusic', 'sens', 'adsSens']) if (typeof s[k] === 'number') $(k).value = VOL_DEF[k] !== undefined && s.vc !== 2 ? fromOld(k, s[k]) : s[k];
  if (s.vc !== 2 && typeof s.volMaster === 'number') setTimeout(saveSettings, 500); // saved before the loudness curve: store the converted values
  if (s.xh) setXhair(s.xh, false);
  if (AIM_MODES.includes(s.aim)) setAim(s.aim, false);
  showSens();
  applyVol(); setMusicVolume(musicVol());
  saveVol(); try { localStorage.setItem('r62d-music2', $('volMusic').value); } catch {}
  renderSettings(); renderControls();
}
onBindsChange(() => saveSettings());
for (const id of ['volMaster', 'volSfx', 'volMusic']) $(id).addEventListener('change', saveSettings);

// ---------------- captured mouse & sensitivity ----------------
function playing() { const p = st.last && st.last.ph; return !!st.id && (p === PHASE.PREP || p === PHASE.ACTION || p === PHASE.ROUND_END); }
// Esc releases the mouse: treat that like pausing, as in CS2
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && playing() && !menuOpen() && !st.quitting) $('pause').classList.remove('hidden');
});
// let go of the mouse whenever a menu is open or the match is over
setInterval(() => { if (document.pointerLockElement && (menuOpen() || !playing())) document.exitPointerLock(); }, 150);
$('pResume').addEventListener('click', () => { if (playing()) cv.requestPointerLock?.(); });
const showSens = () => { $('sensVal').textContent = ($('sens').value / 100).toFixed(2); $('adsSensVal').textContent = ($('adsSens').value / 100).toFixed(2) + '×'; };
for (const id of ['sens', 'adsSens']) { $(id).addEventListener('input', showSens); $(id).addEventListener('change', saveSettings); }
try { const v = JSON.parse(localStorage.getItem('r62d-sens') || 'null'); if (v) { $('sens').value = v[0]; $('adsSens').value = v[1]; } } catch {}
showSens();
function setAim(m, save = true) {
  aimMode = m; try { localStorage.setItem('r62d-aim', m); } catch {}
  for (const b of $('aimSeg').querySelectorAll('button')) b.classList.toggle('on', b.dataset.a === m);
  if (m !== 'cursor') { padAng = st.aim || 0; padReach = 0.6; }
  $('aimHint').textContent = { pad: 'Aim pad: the ring on the right is a joystick for the mouse. Circle it to turn, push out to look further, go through the middle to turn round.',
    turn: 'Turn: like an FPS. Mouse left / right turns you, mouse up / down moves the crosshair further / nearer.',
    cursor: 'Cursor: you aim at wherever the mouse pointer is.' }[m];
  if (save) saveSettings();
}
for (const b of $('aimSeg').querySelectorAll('button')) b.onclick = () => { audio.ui(); setAim(b.dataset.a); };
setAim(aimMode, false);

// The server time of the world you're currently looking at (others are drawn slightly in the past).
// Sent with every input so the server can judge your shots against what you saw — this is what
// creates peeker's advantage, the same way R6's netcode does.
function viewServerTime() {
  const snaps = st.snaps; if (snaps.length < 2) return null;
  const rt = performance.now() / 1000 - DELAY;
  for (let i = snaps.length - 1; i >= 0; i--) if (snaps[i].t <= rt) {
    const a = snaps[i], b = snaps[i + 1]; if (!b) return a.st;
    const f = Math.max(0, Math.min(1, (rt - a.t) / ((b.t - a.t) || 1)));
    return a.st + (b.st - a.st) * f;
  }
  return snaps[0].st;
}

// ---------------- chat ----------------
// Y opens team chat; while typing, / flips between team and all chat. Enter sends, Esc closes.
st.chatTeam = true;
function openChat(team) {
  st.chatTeam = team; $('chatMode').textContent = team ? 'TEAM' : 'ALL'; $('chatMode').className = team ? 'team' : 'all';
  $('chatBar').classList.remove('hidden'); $('chat').classList.add('open');
  for (const k of [...keys]) keys.delete(k); // stop walking while you type
  setTimeout(() => $('chatIn').focus(), 0);
}
function closeChat() { $('chatIn').value = ''; $('chatIn').blur(); $('chatBar').classList.add('hidden'); $('chat').classList.remove('open'); }
function chatKey(e) {
  if (e.key === '/') { e.preventDefault(); openChat(!st.chatTeam); audio.ui('hover'); return; }
  if (e.key === 'Escape') { e.preventDefault(); closeChat(); return; }
  if (e.key === 'Enter') {
    e.preventDefault();
    const text = $('chatIn').value.trim();
    if (text) send({ t: 'chat', text, team: st.chatTeam });
    closeChat();
  }
}
function addChat(m) {
  const me = st.me, mine = me && m.squad === me.sq;
  const d = document.createElement('div');
  d.innerHTML = m.ping ? `<span class="tag ping">PING</span><b class="${mine ? 'a' : 'e'}">${esc(m.name)}:</b> <span class="pingTxt">${esc(m.text)}</span>`
    : `<span class="tag ${m.team ? 'team' : 'all'}">${m.team ? 'TEAM' : 'ALL'}</span>${m.dead ? '<span class="dead">(dead)</span> ' : ''}<b class="${mine ? 'a' : 'e'}">${esc(m.name)}:</b> ${esc(m.text)}`;
  $('chatLog').appendChild(d);
  while ($('chatLog').children.length > 30) $('chatLog').firstChild.remove();
  d.dataset.t = performance.now();
  audio.ui('chat');
}
// older lines fade out unless the chat is open
setInterval(() => { const now = performance.now(); for (const d of $('chatLog').children) d.classList.toggle('old', now - d.dataset.t > 12000); }, 500);

// The desktop app's window is already full screen (Firefox kiosk). Asking the browser for full
// screen again there shrinks the picture into a corner, so the switch only acts in a normal browser.
function inApp() { return new URLSearchParams(location.search).has('app'); }
function toggleFullscreen() {
  if (inApp()) return;
  if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {});
}
if (inApp()) for (const id of ['fsBtn', 'pFs']) $(id).style.display = 'none'; // nothing to switch in the desktop app
