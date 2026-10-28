// R62D browser client: connects to the server, predicts your movement,
// draws the world with line-of-sight blackout, and runs the menus and HUD.
import { CELL, PHASE, T, MAT } from '/shared/constants.js';
import { buildMap, roomAt, floorAt, localPos, MAPS, MAP_LIST } from '/shared/map.js';
import { stepMove, castSight, canSee, facingCell, angDiff, BASE_SPEED, DRONE_SPEED } from '/shared/physics.js';
import { OPERATORS, WEAPONS, GADGETS, opsForTeam, CLASS_NAME, gunMods, attFromCode } from '/shared/operators.js';
import { gunPicture } from './gunart.js';
import { MapRenderer } from './mapdraw.js';
import { S, setMapScale } from './textures.js';
import { drawOperator, drawDrone, drawCam, drawGadget, drawBomb, portrait, setShading } from './sprites.js';
import { FX, drawSmoke } from './fx.js';
import * as audio from './audio.js';
import { openOps, closeOps, updateOpsProfile } from './ops.js';
import { openProfile } from './profile.js';
import { openArmory, closeArmory } from './armory.js';
import { XH_DEFAULT, XH_STYLES, XH_COLORS, cleanXhair, drawXhair } from './crosshair.js';
import { startMusic, stopMusic, setMood, setMusicVolume } from './music.js';
import { levelFor } from '/shared/progress.js';
import { LOADOUTS, GADGET_COUNT, cleanLoadout } from '/shared/operators.js';
import { ACTIONS, actionFor, bindsFor, setBind, resetBinds, keyName, label, getBinds, applyBinds, onBindsChange, BINDS_VERSION } from './keys.js';
import { walkRay, tileAt } from '/shared/physics.js';
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
// Aim pad (default): a ring on the right of the screen works like a joystick. Where the mouse sits in
// the ring sets which way you aim (and how far ahead you look), so turning round is a short flick
// across the ring instead of dragging the cursor all the way round your character.
// "Cursor" is the old way: you aim at wherever the cursor is.
let aimMode = (() => { try { return localStorage.getItem('r62d-aim') || 'pad'; } catch { return 'pad'; } })();
const pad = () => ({ x: VW * 0.84, y: VH * 0.52, r: VH * 0.12 });
let padOn = false, padAng = 0, padReach = 0.6;
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
function connect() {
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  st.ws = ws;
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.t === 'welcome') {
      st.id = m.id;
      if (st.rend && m.mapId === st.mapId) { // the map already on screen: just bring it up to date
        resetMap(m.mapVersion);
        for (let k = 0; k < m.tiles.length; k++) if (m.tiles[k] !== st.map.tiles[k] || m.hp[k] !== st.map.hp[k]) {
          st.map.tiles[k] = st.known.tiles[k] = m.tiles[k]; st.map.hp[k] = st.known.hp[k] = m.hp[k]; st.rend.cellChanged(k);
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
    else if (m.t === 'chat') addChat(m);
    else if (m.t === 'xp') { st.profile = m.profile; playXp(m); }
    else if (m.t === 'profile') { st.profile = m.profile; updateOpsProfile($('opsPage'), m.profile); st.selBuilt = null; }
  };
  ws.onclose = () => { $('conn').classList.remove('hidden'); $('conn').textContent = 'Disconnected — reconnecting…'; setTimeout(() => location.reload(), 2500); };
}
const send = o => { if (st.ws && st.ws.readyState === 1) st.ws.send(JSON.stringify(o)); };

function loadMap(mv, tiles, hp, id, holes) {
  const t0 = performance.now();
  st.map = buildMap(id || st.mapId); st.mapId = st.map.id; st.base = st.map.tiles.slice(); st.mv = mv;
  if (tiles) { st.map.tiles.set(tiles); st.map.hp.set(hp); }
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
    st.unseen.add(k);
  }
  for (let i = 0; i < (s.holes || []).length; i += 3) { // new bullet holes in soft walls
    const k = s.holes[i];
    (m.holes[k] || (m.holes[k] = [])).push(s.holes[i + 1], s.holes[i + 2]);
    st.unseen.add(k);
  }
  if (s.ph !== PHASE.PREP && s.ph !== PHASE.ACTION && s.ph !== PHASE.ROUND_END) revealAll();
  const players = new Map(s.players.map(p => [p.id, p]));
  if (s.mine && players.has(s.you)) Object.assign(players.get(s.you), s.mine); // your own private details
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
      if (an.lastShotSnd !== s.time) { if (!e.q) fx.muzzle(e.x, e.y, a); audio.gunshot(w ? w.cls : 'AR', e.x, e.y, e.id === st.id, !!e.q); audio.casing(e.x, e.y, surfaceAt(e.x, e.y), w && w.cls === 'Shotgun'); an.lastShotSnd = s.time; }
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
  const a = actionFor(e.code);
  if (a || e.code === 'AltLeft' || e.code === 'AltRight' || e.code === 'Tab') e.preventDefault();
  if (!a || keys.has(a)) return;
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
    case 'chat': if (st.id) { e.preventDefault(); keys.delete('chat'); openChat(true); } break;
    case 'left': case 'right': if (st.me && st.me.ct === 'cam') ev.push({ k: a === 'right' ? 'camNext' : 'camPrev' }); break;
  }
});
addEventListener('keyup', e => {
  if (e.code === 'AltLeft' || e.code === 'AltRight') e.preventDefault(); // stop Firefox's menu bar popping up
  const a = actionFor(e.code); if (a) keys.delete(a);
});
addEventListener('blur', () => { keys.clear(); mouse.l = mouse.r = false; });
cv.addEventListener('mousemove', e => {
  if (document.pointerLockElement === cv) {
    const ads = mouse.r && st.me && st.me.a && st.me.ct === 'body';
    const k = ($('sens').value / 100) * (ads ? $('adsSens').value / 100 : 1) * DPR;
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
  if (st.me.ct === 'cam') st.evq.push({ k: e.deltaY > 0 ? 'camNext' : 'camPrev' });
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
    <tr><td>Mark enemy</td><td>Middle mouse</td><td></td></tr>`;
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
const saveVol = () => { try { localStorage.setItem('r62d-vol', JSON.stringify([+$('volMaster').value, +$('volSfx').value])); } catch {} };
try { const v = JSON.parse(localStorage.getItem('r62d-vol') || 'null'); if (v) { $('volMaster').value = v[0]; $('volSfx').value = v[1]; } } catch {}
const applyVol = () => audio.setVolume(st.muted ? 0 : $('volMaster').value / 100, $('volSfx').value / 100);
$('volMaster').oninput = () => { applyVol(); saveVol(); };
$('volSfx').oninput = () => { applyVol(); saveVol(); };
applyVol();

// ---------------- menus ----------------
$('name').value = (() => { try { return localStorage.getItem('r62d-name') || ''; } catch { return ''; } })();
$('joinBtn').onclick = () => {
  audio.initAudio(); audio.ui();
  const n = $('name').value.trim() || 'Operator';
  try { localStorage.setItem('r62d-name', n); } catch {}
  let token = null; try { token = localStorage.getItem('r62d-token'); } catch {}
  send({ t: 'join', name: n, token });
};
document.querySelectorAll('[data-bot]').forEach(b => b.onclick = () => { send({ t: 'lobby', a: 'addBot', squad: +b.dataset.bot }); });
document.querySelectorAll('[data-unbot]').forEach(b => b.onclick = () => { send({ t: 'lobby', a: 'removeBot', squad: +b.dataset.unbot }); });
$('switchBtn').onclick = () => { send({ t: 'lobby', a: 'switch' }); };
$('fillBtn').onclick = () => { send({ t: 'lobby', a: 'fillBots' }); };
$('startBtn').onclick = () => { send({ t: 'lobby', a: 'start' }); };
$('leaveBtn').onclick = () => { if (confirm('End the match for everyone and go back to the lobby?')) send({ t: 'lobby', a: 'end' }); };
$('fsBtn').onclick = () => toggleFullscreen();
$('muteBtn').onclick = () => { st.muted = !st.muted; applyVol(); setMusicVolume(st.muted ? 0 : $('volMusic').value / 100); $('muteBtn').textContent = st.muted ? '🔇' : '🔊'; };
function renderControls() {
  const L = id => keyName(bindsFor(id)[0]);
  const rows = [[`${L('up')}${L('left')}${L('down')}${L('right')}`, 'Move'], ['Mouse', 'Aim'], ['Left click', 'Shoot'], ['Right click', 'Aim down sights'],
    [L('walk'), 'Walk (silent)'], [L('crouch'), 'Crouch (hold, silent)'], [L('reload'), 'Reload'],
    [L('interact') + ' (hold)', 'Reinforce, barricade, plant, defuse, revive'], [L('ability'), 'Operator skill'],
    [L('gadget'), 'Secondary gadget'], [L('melee'), 'Melee'], [L('view'), 'Drone / Cameras'], [L('spot') + ' · Middle click', 'Mark enemy'],
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
  for (const sq of [0, 1]) {
    const ul = document.querySelector(`#sq${sq} ul`);
    const list = s.players.filter(p => p.sq === sq);
    const html = list.map(p => `<li class="${p.id === s.you ? 'me' : ''}"><span>${esc(p.n)}</span>${p.b ? '<span class="bot">BOT</span>' : ''}</li>`).join('') +
      Array(Math.max(0, 5 - list.length)).fill('<li style="opacity:.3"><span>— empty —</span></li>').join('');
    if (ul.innerHTML !== html) ul.innerHTML = html;
  }
}
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function showOpInfo(html) {
  const el = $('opInfo'); if (el.dataset.h === html) return;
  el.dataset.h = html; el.innerHTML = html;
  for (const g of el.querySelectorAll('.gp')) g.appendChild(gunPicture(g.dataset.w, attFromCode(g.dataset.a), 210, 74));
  const b = el.querySelector('.lo'); if (b) b.onclick = () => showOps(b.dataset.op);
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
      const speed = o.armor, armor = 4 - o.armor;
      const pips = n => [1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('');
      const lo = cleanLoadout(k, st.profile && st.profile.loadouts[k]);
      const g = GADGETS[lo.gadget];
      d.innerHTML = `<div class="who"></div>`;
      d.appendChild(c);
      const info = document.createElement('div'); info.className = 'info';
      info.innerHTML = `<div class="nm">${o.name}</div><div class="role">${o.role}</div><div class="ab">${o.ability.name}</div>`;
      d.appendChild(info);
      // the full details show in the strip under the cards, for whichever card the mouse is on (or yours)
      d.dataset.full = `<span class="gp" data-w="${lo.primary}" data-a="${[lo.att[lo.primary] || {}].map(a => [a.barrel, a.grip, a.sight].join(','))[0]}"></span><div class="nm">${o.name}<span>${o.role}</span></div>
        <div><span class="pips"><span>ARMOR ${pips(armor)}</span><span>SPEED ${pips(speed)}</span></span> ·
        ${WEAPONS[lo.primary].name} <span style="color:var(--dim)">${CLASS_NAME[WEAPONS[lo.primary].cls]}</span>${lo.secondary ? ' · ' + WEAPONS[lo.secondary].name : ''} · ${g.name} ×${GADGET_COUNT[lo.gadget]}
        <button class="lo" data-op="${k}" title="Change loadout">LOADOUT</button></div>
        <div><span class="ab">${o.ability.name}${o.ability.count ? ' ×' + o.ability.count : ''}</span> — ${o.ability.desc}</div>`;
      d.onmouseenter = () => showOpInfo(d.dataset.full);
      d.onclick = () => { send({ t: 'pick', op: k }); };
      grid.appendChild(d);
    }
    if (grid.firstChild) showOpInfo(grid.firstChild.dataset.full);
  }
  const mates = s.players.filter(p => p.sq === me.sq);
  for (const d of document.querySelectorAll('#opgrid .op')) {
    const who = mates.find(p => p.op === d.dataset.op);
    const mineNow = !!who && who.id === me.id;
    if (mineNow && !d.classList.contains('mine')) { d.classList.add('locked'); audio.ui('lock'); setTimeout(() => d.classList.remove('locked'), 700); }
    d.classList.toggle('mine', mineNow);
    if (mineNow && !d.matches(':hover') && !document.querySelector('#opgrid .op:hover')) showOpInfo(d.dataset.full);
    d.classList.toggle('taken', !!who && who.id !== me.id);
    d.querySelector('.who').textContent = who ? who.n : '';
    d.querySelector('.who').style.display = who ? '' : 'none';
  }
  $('selSide').textContent = `ROUND ${s.rd} — ${side === 'atk' ? 'ATTACK' : 'DEFENCE'}`;
  $('selSide').style.color = side === 'atk' ? '#ffb27a' : '#8fc8ff';
  const site = st.map.sites[s.site];
  const sc = $('siteChoice'), sk = side === 'def' ? s.rd + ':' + s.site : '';
  if (sc.dataset.k !== sk) {
    sc.dataset.k = sk;
    sc.innerHTML = side === 'def' ? '<span>CHOOSE THE SITE TO DEFEND</span>' + st.map.sites.map((x, i) => `<button data-n="${i}" class="${i === s.site ? 'on' : ''}">${esc(x.name)}</button>`).join('') : '';
    for (const b of sc.querySelectorAll('button')) b.onclick = () => { audio.ui(); send({ t: 'site', n: +b.dataset.n }); };
  }
  const mapName = st.map.name.toUpperCase();
  $('selInfo').textContent = side === 'def' ? `DEFEND: ${site.name.toUpperCase()}  ·  ${mapName}` : `SPAWN: ${String(s.spawn).toUpperCase()}  ·  OBJECTIVE UNKNOWN  ·  ${mapName}`;
  $('selTime').textContent = Math.ceil(s.tm);
  $('picks').innerHTML = mates.map(p => `<span><b>${esc(p.n)}</b> ${p.op ? OPERATORS[p.op].name : '…'}</span>`).join('');
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
    `<tr class="${me && p.sq === me.sq ? 'ally' : 'enemy'} ${p.id === s.you ? 'me' : ''} ${p.a ? '' : 'dead'}"><td>${esc(p.n)}</td><td>${p.op ? OPERATORS[p.op].name : '—'}</td><td>${p.k}</td><td>${p.d}</td></tr>`).join('');
  return `<table><tr><th>PLAYER</th><th>OPERATOR</th><th>KILLS</th><th>DEATHS</th></tr>${rows}</table>`;
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

  // --- view source ---
  let view = null, ctrl = me && me.a ? me.ct : null;
  const camsAlive = s ? s.ents.filter(e => e.ty === 'cam' && e.hp > 0) : [];
  if (inGame && me && me.a) {
    if (ctrl === 'drone') view = { x: st.pred.x, y: st.pred.y, ang: st.aim, fov: Math.PI * 2, range: 230, near: 0, kind: 'drone' };
    else if (ctrl === 'cam') { const c = camsAlive[me.ci % Math.max(1, camsAlive.length)]; if (c) view = { x: c.x, y: c.y, ang: st.aim, fov: 1.9, range: 650, near: 14, kind: 'cam', off: c.off, cam: c }; }
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
  padOn = aimMode === 'pad' && !!view && (view.kind === 'body' || view.kind === 'drone');
  if (padOn) { // keep the mouse inside the ring and read the aim from it
    const P = pad(), dx = mouse.x - P.x, dy = mouse.y - P.y, l = Math.hypot(dx, dy);
    if (l > P.r) { mouse.x = P.x + dx / l * P.r; mouse.y = P.y + dy / l * P.r; }
    if (l > P.r * 0.12) { padAng = Math.atan2(dy, dx); padReach = Math.min(1, l / P.r); }
  }
  if (view && (view.kind === 'body' || view.kind === 'drone')) {
    const c = cursor(), mw = screenToWorld(c.x, c.y);
    st.aim = Math.atan2(mw.y - st.pred.y, mw.x - st.pred.x);
    if (now < (st.dazeUntil || 0)) st.aim += Math.sin(now * 6.3) * 0.05 + Math.sin(now * 2.1) * 0.04; // dazed: the aim sways
  } else if (view && view.kind === 'cam') {
    if (st.lastCam !== view.cam.id) { // switching cameras: start from that camera's current direction
      st.lastCam = view.cam.id; st.aim = view.cam.ag || 0; view.ang = st.aim; audio.foley('camSwitch');
      mouse.x = VW / 2 + Math.cos(st.aim) * VH * 0.25; mouse.y = VH / 2 + Math.sin(st.aim) * VH * 0.25;
    } else if (Math.hypot(mouse.x - VW / 2, mouse.y - VH / 2) > 20 * DPR) st.aim = Math.atan2(mouse.y - VH / 2, mouse.x - VW / 2);
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
  let want = 600;
  if (view && view.kind === 'drone') want = 300;
  else if (view) {
    let sum = 0;
    for (let i = 0; i < 24; i++) sum += castSight(st.map, view.x, view.y, i / 24 * Math.PI * 2, 700, null);
    const avg = sum / 24, aimD = castSight(st.map, view.x, view.y, view.ang, 900, null);
    want = Math.max(300, Math.min(620, avg * 1.5 + 150));
    want = Math.max(want, Math.min(view.kind === 'cam' ? 720 : 680, aimD * (view.kind === 'cam' ? 0.9 : 0.75)));
  }
  st.viewH = st.viewH || want;
  st.viewH += (want - st.viewH) * (1 - Math.exp(-dt * 2.2));
  st.zoom = VH / st.viewH;
  if (view && view.kind === 'cam') { st.cam.x = view.x + Math.cos(view.ang) * st.viewH * 0.28; st.cam.y = view.y + Math.sin(view.ang) * st.viewH * 0.28; }
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
    up: keys.has('up') ? 1 : 0, down: keys.has('down') ? 1 : 0, left: keys.has('left') ? 1 : 0, right: keys.has('right') ? 1 : 0,
    walk: keys.has('walk') ? 1 : 0, crouch: keys.has('crouch') ? 1 : 0, fire: mouse.l ? 1 : 0, ads: mouse.r ? 1 : 0,
    interact: keys.has('interact') ? 1 : 0, ability: keys.has('ability') ? 1 : 0,
  };
  if (typing || menuOpen()) { for (const key in k) k[key] = 0; ev.length = 0; }
  // mark the enemy nearest the cursor that you can actually see
  const trySpot = () => {
    if (!view || !me) return;
    const c = cursor(), mw = screenToWorld(c.x, c.y);
    let best = null, bd = 45;
    for (const p of s.players) if (p.a && p.tm !== me.tm && p.x !== undefined) {
      const d = Math.hypot(p.x - mw.x, p.y - mw.y);
      if (d < bd && canSee(st.map, view, p.x, p.y, smokes(s))) { bd = d; best = p; }
    }
    if (best) { ev.push({ k: 'spot', id: best.id }); audio.foley('spot'); }
  };
  if (ctrl === 'cam' || ctrl === 'drone') {
    if (mouse.wl) trySpot();
    if (ctrl === 'cam') { k.up = k.down = k.left = k.right = 0; }
    const cams = s ? s.ents.filter(e => e.ty === 'cam' && e.hp > 0) : [], cam = cams[(me && me.ci || 0) % Math.max(1, cams.length)];
    if (!(ctrl === 'cam' && cam && cam.tu)) k.fire = 0; // a turret camera fires its laser
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
  const msg = { t: 'input', s: ++st.seq, k, a: Math.round(st.aim * 1000) / 1000, dt: Math.round(dt * 10000) / 10000 };
  const c = cursor(), mw = screenToWorld(c.x, c.y); msg.ax = Math.round(mw.x); msg.ay = Math.round(mw.y);
  const vt = viewServerTime(); if (vt !== null) msg.vt = Math.round(vt * 1000) / 1000; // what moment of the match you're seeing
  if (ev.length) msg.ev = ev;
  st.pending.push({ s: msg.s, k, dt: msg.dt });
  if (st.pending.length > 120) st.pending.shift();
  send(msg);
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
    if (fa !== fb) return Math.min(3, 1 + Math.abs(fa - fb));
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
  for (const e of ents) if (e.ty === 'cam' && (e.tm === side || seen(e.x, e.y))) drawCam(ctx, e, now);

  // players
  const drawn = [];
  for (const sp of s.players) {
    if (!sp.a) continue;
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
    // footstep direction hints around you
    if (view && view.kind === 'body') for (const p of drawn) { /* visible: no hint */ }
    if (view && view.kind === 'body') for (const sp of s.players) {
      if (!sp.a || sp.tm === side || sp.x === undefined || (sp.mv || 0) < 2) continue; // only running makes noise
      const p = interp(sp.id, 'players'); const d = Math.hypot(p.x - view.x, p.y - view.y);
      const range = 380;
      if (d > range || seen(p.x, p.y)) continue;
      const a = Math.atan2(p.y - view.y, p.x - view.x), al = (1 - d / range) * 0.8;
      ctx.strokeStyle = `rgba(255,140,60,${al})`; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(view.x, view.y, 30, a - 0.22, a + 0.22); ctx.stroke();
    }
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
  if (view && view.kind === 'cam') camOverlay(view, now);
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
  if (inGame && padOn && !menuOpen()) aimPad();
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
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.arc(P.x, P.y, P.r * 0.12, 0, 7); ctx.stroke();
  ctx.strokeStyle = 'rgba(120,180,255,0.55)'; ctx.lineWidth = 3 * DPR;
  ctx.beginPath(); ctx.arc(P.x, P.y, P.r, padAng - 0.18, padAng + 0.18); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 5 * DPR, 0, 7); ctx.fill();
  ctx.restore();
}

function crosshair(me, now) {
  const w = WEAPONS[me.w];
  const gm = gunMods(me.w, attFromCode(me.aa)), hipS = w ? w.spread * gm.hip : 0.05;
  const at = me.at || 0, base = w ? hipS + (w.ads * gm.adsSpread - hipS) * at : 0.05; // tightens as you settle into your sights
  const run = Math.min(1, Math.hypot(st.pred.vx || 0, st.pred.vy || 0) / BASE_SPEED);
  const spread = xh.dynamic ? Math.max(0, base * 160 + Math.pow(run, 1.4) * 15 + (me.cr && run < 0.15 ? -2 : 0)) : 0; // opens up while you run
  // recoil kicks the crosshair round your character: pull the mouse against it
  const px = (st.pred.x - st.cam.x) * st.zoom + VW / 2, py = (st.pred.y - st.cam.y) * st.zoom + VH / 2;
  const rc = me.rc || 0, c = Math.cos(rc), s2 = Math.sin(rc);
  const m = cursor(), x = px + (m.x - px) * c - (m.y - py) * s2, y = py + (m.x - px) * s2 + (m.y - py) * c;
  drawXhair(ctx, x, y, xh, spread, DPR);
  const hk = 1 - (now - st.hitT) / 0.18;
  if (hk > 0) {
    ctx.strokeStyle = st.hitKill ? `rgba(255,60,60,${hk})` : `rgba(255,255,255,${hk})`; ctx.lineWidth = 2 * DPR;
    ctx.beginPath();
    for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { ctx.moveTo(x + dx * 5 * DPR, y + dy * 5 * DPR); ctx.lineTo(x + dx * 11 * DPR, y + dy * 11 * DPR); }
    ctx.stroke();
  }
}

function droneOverlay(now, ents) {
  const d = ents.find(e => st.me && e.id === st.me.did);
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
  if (view.cam && view.cam.tu) { ctx.fillStyle = '#ff6060'; ctx.font = `700 ${16 * DPR}px Barlow Condensed`; ctx.fillText(view.cam.hot ? 'TURRET · OVERHEATED, COOLING DOWN' : 'TURRET · CLICK TO FIRE THE LASER', 80 * DPR, 150 * DPR); }
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
  $('time').textContent = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  $('time').classList.toggle('planted', !!s.pl);
  $('phase').textContent = s.pl ? 'DEFUSER' : s.ph === PHASE.PREP ? 'PREPARATION' : s.ph === PHASE.ACTION ? 'ACTION' : 'ROUND OVER';
  $('roundNo').textContent = `ROUND ${s.rd} · ${side === 'atk' ? 'ATTACK' : 'DEFENCE'}`;
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
  if (me.ct === 'drone') { const d = s.ents.find(e => e.id === me.did); vl = d && d.j ? 'DRONE JAMMED' : `DRONE · CLICK TO MARK ENEMIES · ${label('view')} TO EXIT`; }
  else if (me.ct === 'cam') { const cams = s.ents.filter(e => e.ty === 'cam' && e.hp > 0); const c = cams[me.ci % Math.max(1, cams.length)]; vl = c ? `CAMERA ${me.ci % cams.length + 1}/${cams.length} · ${roomAt(st.map, c.x, c.y).toUpperCase()} · MOUSE LOOK · ${label('left')} ${label('right')} SWITCH · CLICK MARK${c.off ? ' · DISRUPTED' : ''}` : ''; }
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
  a.fov = a.fov === undefined ? target : a.fov + (target - a.fov) * 0.2; // smooth zoom in/out
  return a.fov;
}

// Your own heartbeat and breathing when badly hurt or downed.
function bodySounds(me, dt) {
  if (!me || !me.a || !st.last || st.last.ph !== PHASE.ACTION) return;
  st.hbT = (st.hbT || 0) - dt; st.brT = (st.brT || 0) - dt;
  if ((me.dn || me.hp < 35) && st.hbT <= 0) { audio.foley('heartbeat'); st.hbT = me.dn ? 0.85 : 1.15; }
  if (me.hp < 35 && !me.dn && st.brT <= 0) { audio.foley('breath'); st.brT = 3.2; }
}

// Clickable list of cameras along the bottom while you're watching them.
function camBar(s, me) {
  const bar = $('cambar');
  if (me.ct !== 'cam') { if (bar.innerHTML) bar.innerHTML = ''; return; }
  const cams = s.ents.filter(e => e.ty === 'cam');
  let alive = -1;
  const html = cams.map(c => {
    if (c.hp > 0) alive++;
    const on = c.hp > 0 && alive === me.ci % Math.max(1, cams.filter(x => x.hp > 0).length);
    return `<button data-n="${c.hp > 0 ? alive : -1}" class="${on ? 'on' : ''} ${c.hp > 0 ? '' : 'dead'}">CAM ${cams.indexOf(c) + 1}<small>${esc(roomAt(st.map, c.x, c.y).toUpperCase() || 'OUTSIDE')}${c.off ? ' · DISRUPTED' : ''}</small></button>`;
  }).join('');
  if (bar.innerHTML !== html) {
    bar.innerHTML = html;
    for (const b of bar.querySelectorAll('button')) b.onclick = e => { e.stopPropagation(); if (+b.dataset.n >= 0) st.evq.push({ k: 'camSet', n: +b.dataset.n }); };
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
    if (!sp.a || sp.tm !== side || sp.x === undefined) continue;
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
  return vs;
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
$('pEnd').onclick = () => { if (confirm('End the match for everyone and go back to the lobby?')) { send({ t: 'lobby', a: 'end' }); $('pause').classList.add('hidden'); } };
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
  'Mark enemies with the middle mouse button or T so your whole team sees them.',
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
try { const v = JSON.parse(localStorage.getItem('r62d-music') || 'null'); if (v !== null) $('volMusic').value = v; } catch {}
setMusicVolume($('volMusic').value / 100);
$('volMusic').oninput = () => { setMusicVolume(st.muted ? 0 : $('volMusic').value / 100); try { localStorage.setItem('r62d-music', $('volMusic').value); } catch {} };
window.__r62d = { PF, st, showEnd, playXp }; // for automated screenshot tests

// ---------------- settings saved per profile ----------------
// Keys and volumes live in your profile on the game computer, so they follow you to any browser.
function currentSettings() {
  try { localStorage.setItem('r62d-sens', JSON.stringify([+$('sens').value, +$('adsSens').value])); } catch {}
  return { bindsVersion: BINDS_VERSION, binds: getBinds(), volMaster: +$('volMaster').value, volSfx: +$('volSfx').value, volMusic: +$('volMusic').value, sens: +$('sens').value, adsSens: +$('adsSens').value, aim: aimMode, xh };
}
let saveTimer = 0;
function saveSettings() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { if (st.token) send({ t: 'settings', s: currentSettings() }); }, 400);
}
function applySettings(s) {
  if (s.binds && s.bindsVersion === BINDS_VERSION) applyBinds(s.binds); else setTimeout(saveSettings, 500); // old layout: switch to the new defaults once
  for (const k of ['volMaster', 'volSfx', 'volMusic', 'sens', 'adsSens']) if (typeof s[k] === 'number') $(k).value = s[k];
  if (s.xh) setXhair(s.xh, false);
  if (s.aim === 'pad' || s.aim === 'cursor') setAim(s.aim, false);
  showSens();
  applyVol(); setMusicVolume(st.muted ? 0 : $('volMusic').value / 100);
  saveVol(); try { localStorage.setItem('r62d-music', $('volMusic').value); } catch {}
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
  if (m === 'pad') { const P = pad(); mouse.x = P.x + Math.cos(st.aim || 0) * P.r * 0.6; mouse.y = P.y + Math.sin(st.aim || 0) * P.r * 0.6; }
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
  d.innerHTML = `<span class="tag ${m.team ? 'team' : 'all'}">${m.team ? 'TEAM' : 'ALL'}</span>${m.dead ? '<span class="dead">(dead)</span> ' : ''}<b class="${mine ? 'a' : 'e'}">${esc(m.name)}:</b> ${esc(m.text)}`;
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
