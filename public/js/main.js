// R62D browser client: connects to the server, predicts your movement,
// draws the world with line-of-sight blackout, and runs the menus and HUD.
import { CELL, PHASE, T, MAT, PX_PER_M, PRO_LEVEL } from '/shared/constants.js';
import { PINGS, pingOf, wheelPick, drawWheel, drawPing, drawBadge } from './pingwheel.js';
import { parseCommand } from '/shared/commands.js';
import { roofRopeAt, hatchAtPoint, buildMap, roomAt, floorAt, localPos, MAPS, MAP_LIST, holePortal, syncDyn, syncPeeps, hatchOpen, hatchNear, stairGhost, stairLooks, stairEnds, ropeAt, ropeAtWindow, ropeWindowOpen, ropeWindowBoarded, windowViews, windowFoot, windowState, wallGhost, peekSeen, floorOff, viewSrc, OUTCAM_ROOF, OUTCAM_RANGE, hatchSight, aimUpHatch } from '/shared/map.js';
import { SLIDE, stepMove, castSight, canSee, facingCell, angDiff, BASE_SPEED, DRONE_SPEED, coverOf } from '/shared/physics.js';
import { OPERATORS, WEAPONS, GADGETS, riotArc, opsForTeam, CLASS_NAME, SIDEARMS, gunMods, attFromCode, ATTACH, ATTACH_SLOTS, attachFor, adsStart, aimReach, spreadCone, aimHeat, JOBS, jobOf, HEAD_AIM, shieldPose, causeOf } from '/shared/operators.js';
import { gunPicture } from './gunart.js';
import { MapRenderer } from './mapdraw.js';
import { tilt, raisedFrame, drawRaised, sightClip, looks } from './look.js';
import { S, setMapScale } from './textures.js';
import { drawZombie, drawOperator, drawDrone, drawCam, drawGadget, drawBomb, portrait, setShading, drawBird, drawSwarm } from './sprites.js';
import { openKillcam, killcamOpen } from './killcam.js';
import { FX, drawSmoke } from './fx.js';
import * as audio from './audio.js';
import { openOps, closeOps, updateOpsProfile, showLoadout } from './ops.js';
import { openProfile } from './profile.js';
import { openArmory, closeArmory, armoryHoldsEsc } from './armory.js';
import { openMapInfo, closeMapInfo } from './mapinfo.js';
import { openPlaybook, closePlaybook } from './playbook.js';
import { openKnowledge, closeKnowledge } from './knowledge.js';
import { PRO_TEAMS } from '/shared/pros.js';
import { XH_DEFAULT, XH_STYLES, XH_COLORS, cleanXhair, drawXhair, drawSightLook, magnify, lensPt, lensMag } from './crosshair.js';
import { readPad, PAD_ACTIONS, PAD_HELP } from './gamepad.js';
import { startMusic, stopMusic, setMood, setMusicVolume } from './music.js';
import { levelFor, RANKS, RANK_COL } from '/shared/progress.js';
const rankTag = i => i == null ? '' : `<span class="rankTag" style="color:${RANK_COL[i]};border-color:${RANK_COL[i]}">${RANKS[i].toUpperCase()}</span>`;
import { ACTIONS, PRESETS, applyPreset, actionFor, bindsFor, setBind, resetBinds, keyName, label, getBinds, applyBinds, onBindsChange, BINDS_VERSION, lockMouse } from './keys.js';
import { walkRay, tileAt, findVault, standable, leanPoint, LEAN_PX } from '/shared/physics.js';
import { createCoach } from './tutorial.js';
import { drawQr } from './qr.js';
import { readCode, showCode } from '/shared/joincode.js';
import { MODES, MODE_LIST, ruleLine } from '/shared/modes.js';
import * as rope3d from './rope3d.js';
import { compassRoute as sharedRoute } from '/shared/compass.js';
import { touchPad, touchContext, touchActive, isTrackpad, setTouchVisible, touchAimReset, isTouch, needsInputChoice, setInputChoice, uiScale, viewMul, setUiScale, setViewMul, tiltOn, tiltDead, setTilt, setTiltDead } from './touch.js';
import { blocksSight, FL, underAt } from '/shared/constants.js';

const $ = id => document.getElementById(id);
// Stacked layers: the map (moved and scaled by the browser, see MapRenderer.mount), the people and effects, the line-of-sight blackout (drawn small and stretched by
// the browser for free) and markers/crosshair on top. 'ctx' points at whichever is being drawn.
const cv = $('game'), ctx0 = cv.getContext('2d'), mapLayer = $('mapLayer');
let ctx = ctx0;
const fog = $('fog'), fctx = fog.getContext('2d');
const over = $('over'), octx = over.getContext('2d');
// He asked for labels to stay upright with Rotate aiming: any text is turned back by however much the drawing is
// turned at that moment, round its own spot. (UP() is "up the screen" in the world, for labels that sit above things.)
for (const c of [ctx0, octx]) for (const fn of ['fillText', 'strokeText']) {
  const orig = c[fn].bind(c);
  c[fn] = (t, x, y, w) => {
    const m = c.getTransform(), a = Math.atan2(m.b, m.a);
    if (Math.abs(a) < 1e-4) return w === undefined ? orig(t, x, y) : orig(t, x, y, w);
    c.save(); c.translate(x, y); c.rotate(-a); if (w === undefined) orig(t, 0, 0); else orig(t, 0, 0, w); c.restore();
  };
}
const UP = () => ({ x: -Math.sin(st.rot || 0), y: -Math.cos(st.rot || 0) });
let DPR = 1, VW = 0, VH = 0;

// Graphics quality (saved per computer): how many pixels get drawn and how many extras are added.
const GFX = {
  low:    { scale: 0.6,  fog: 0.3,  parts: 0.35, smoke: 7,  shade: false, rays: 0.5, map: 1.25, grey: 0.75, raised: false },
  medium: { scale: 0.8,  fog: 0.4,  parts: 0.6,  smoke: 11, shade: true, rays: 0.7, map: 2, grey: 1 },
  high:   { scale: 1,    fog: 0.5,  parts: 1,    smoke: 16, shade: true, rays: 1, map: 2.5, grey: 1.5 }, // (no soft blurred edges: with the tilt they cost a third of the frame on his GPU)
  ultra:  { scale: 1.25, fog: 0.75, parts: 1,    smoke: 22, shade: true, rays: 1.2, map: 3, grey: 1.5, blur: true },
};
const LEVELS = ['low', 'medium', 'high', 'ultra'];
// "auto" (the default) starts from a guess about this computer and steps down by itself if the game can't keep up
let gfxName = (() => { try { return localStorage.getItem('r62d-gfx') || 'auto'; } catch { return 'auto'; } })();
if (!GFX[gfxName] && gfxName !== 'auto') gfxName = 'auto';
let autoLevel = (() => {
  try { const s = localStorage.getItem('r62d-gfx-auto'); if (GFX[s]) return s; } catch {}
  const weak = (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory && navigator.deviceMemory <= 4);
  return weak || isTouch ? 'medium' : 'high'; // phones start at Medium (map pictures at High take a lot of a phone browser's memory)
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
    if (st.rend) { st.rend.free(); st.rend = new MapRenderer(st.known, st.base); st.rend.splinters = st.splinters; st.rend.mount(mapLayer); st.warm = 4; }
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
// "Crosshair" (the default since he found the pad horrible): the crosshair itself moves the way the mouse moves,
// 1:1 like a pointer, but it is fixed to your character, so walking never changes your aim and the camera can slide
// around freely. It can't sit right on top of you: pulling it through the middle comes out the other side.
// A controller's right stick always aims like the pad (see gamepad.js).
// "Rotate" (spin): like an FPS — the view turns with you so you always face up the screen; mouse left/right turns,
// up/down sets how far ahead the crosshair sits, and W always walks up the screen (k.rot turns the keys).
const AIM_MODES = ['free', 'classic', 'face', 'spin', 'pad', 'turn', 'cursor'];
// Crosshair Classic (he asked: aiming styles grouped, earlier generations kept for people who like them): the Crosshair
// mode as it first was: aiming in leaves it where it is, and no slower mouse far out. Both move 1:1 every way now (he
// asked for crispy aim). Everything else is the Crosshair mode (freeAimOn).
const freeAimOn = () => aimMode === 'free' || aimMode === 'classic';
const FACE_ADS = 15 * Math.PI / 180; // Face aiming (he asked): aiming in keeps you within 15° either side of where you faced
let aimMode = (() => { try { const m = localStorage.getItem('r62d-aim'); return localStorage.getItem('r62d-aim2') && AIM_MODES.includes(m) ? m : 'free'; } catch { return 'free'; } })();
// Crosshair mode: where the crosshair sits from your character, in WORLD pixels. It can go anywhere you can see
// (he asked: a marksman must be able to headshot down a long sightline, not only inside the room): pushing it past
// the screen edge slides the camera after it (and zooms out if it has to), out to st.reachW. Nearer walls only hold
// the crosshair on the wall while they are in the way; it comes back out when you aim past them.
let aimOff = { x: 150, y: 0 };
const AHEAD = () => Math.max(36 * DPR, VH * 0.13); // screen room always left beyond the crosshair
const AIM_MIN = () => 46 * DPR / (st.zoom || 1), AIM_MAX = () => st.reachW || 400;
// how far a view can grow to fit you and your crosshair: further when aiming in, furthest with a 2x scope
const scopeOn = me => !!me && /scope|sniper/.test(String(me.aa || '')), sniperOn = me => !!me && String(me.aa || '').includes('sniper');
// the crosshair's reach: a circle round you (AIM_REACH), its size set by your sight while aiming in
const reachOf = (me, ads) => aimReach(me && me.aa ? attFromCode(me.aa).sight : 'iron', ads ?? !!(me && me.ad)) * PX_PER_M;
// Long sightlines (he asked): looking down a line more than 1.5x the normal range, the view opens right out the way you
// face, up to LONG_H world px tall, and you see out to LONG_R. The sniper scope always gets that view while aimed in.
const LONG_H = 1500, LONG_R = 2400, ENV_HOLD = 0.45;
// Crispy aim (he asked 2026-11-09): the crosshair follows the mouse 1:1 in every direction, like a pointer (the old
// sideways flick help and the 1.3x faster outward pull are gone). Past the edge of your normal view (st.trackHH, the
// room-size view before it grows to fit the crosshair) the mouse moves it by Settings → Far aim sensitivity (0.5),
// the same both ways, blended in over 1 m. Aiming in never puts it nearer than ADS_SNAP_MIN (he asked: 2 m).
const ADS_SNAP_MIN = 2 * PX_PER_M;
// Held wall (he asked 2026-11-09): keep the orange marker (bullets stop at a wall before the crosshair) on the same wall
// or anything joined to it for WALL_HOLD s and it turns blue; while it stays blue, aiming in snaps the crosshair
// onto the bracket (the wall), however far away it is (he asked). Looking off it (or the marker going away) starts over.
const RING_R = 13; // the team-coloured circle round each person (drawOperator)
const WALL_HOLD = 1.5, WALL_TILES = new Set([T.HARD, T.SOFT, T.REINF, T.PANEL, T.TALL, T.DSHIELD]);
function wallHeld(q, now) {
  const H = st.wallHold, dt = H ? Math.min(0.1, now - H.at) : 0; // (now: seconds)
  if (!q || !q.stopped || !st.map || !st.pred) { st.wallHold = null; return; }
  const m = st.map, a = Math.atan2(aimOff.y, aimOff.x), c = Math.cos(a), sn = Math.sin(a);
  let k = q.person ? 'p' + q.person.id : -1; // on a person: held on that same person
  if (q.person) { if (H && H.set.has(k)) { const was = H.t >= WALL_HOLD; H.t += dt; H.at = now; if (!was && H.t >= WALL_HOLD) H.pop = now; } else st.wallHold = { set: new Set([k]), t: 0, at: now, pop: 0 }; return; } for (let d = q.shot - 3; d <= q.shot + 12 && k < 0; d += 1.5) { const kk = Math.floor((st.pred.y + sn * d) / CELL) * m.W + Math.floor((st.pred.x + c * d) / CELL); if (WALL_TILES.has(m.tiles[kk])) k = kk; } // the first wall cell where the bullets stop
  if (k < 0) { st.wallHold = null; return; }
  if (H && H.set.has(k)) { const was = H.t >= WALL_HOLD; H.t += dt; H.at = now; if (!was && H.t >= WALL_HOLD) H.pop = now; return; }
  const set = new Set(); // the wall and everything solid joined to it
  { const q2 = [k]; set.add(k); for (let i = 0; i < q2.length && set.size < 3000; i++) { const c = q2[i]; for (const n of [c - 1, c + 1, c - m.W, c + m.W]) if (n >= 0 && n < m.tiles.length && !set.has(n) && WALL_TILES.has(m.tiles[n])) { set.add(n); q2.push(n); } } }
  st.wallHold = { set, t: 0, at: now, pop: 0 };
}
const wallBlue = () => !!(st.wallHold && st.wallHold.t >= WALL_HOLD);
const RAISE_FULL = 760, RAISE_NONE = 1150; // raised walls sink flat between these view heights (world px), see draw()
const farSens = () => { const v = +($('farSens') || {}).value; return v > 0 ? v / 100 : 0.5; };
function trackR(ux, uy) {
  const hh = st.trackHH; if (!hh) return Infinity;
  const hw = hh * VW / VH, c = Math.abs(ux), s = Math.abs(uy);
  return Math.min(c > 0.01 ? hw / c : Infinity, s > 0.01 ? hh / s : Infinity) - hh * 0.26;
}
// Locked camera (his idea, 2026-11-09; like League of Legends / Age of Mythology): the camLock key (L) switches between
// the normal following camera and one that stays where it is, at the size it had. Pushing the crosshair (or the cursor)
// into the edge band of the screen scrolls it that way, faster the deeper in, and the crosshair travels with it; your
// character reaching the edge or going to another floor brings it along. st.camLock = { x, y, h } (h: view height).
// He asked next: camCentre (H) glides it back onto you (L.home); holding the wheel button and moving the mouse drags
// the view like grabbing the map (st.mDrag, mousemove), after which it may go anywhere (L.free) until you centre it.
const LOCK_EDGE = 30; // CSS px: the crosshair stops this far inside the screen
const camLocked = view => !!(st.camLock && view && view.kind === 'body' && !st.tv);
function toggleCamLock() {
  if (st.tv || !playing()) return;
  st.camLock = st.camLock ? null : { x: st.cam.x, y: st.cam.y, h: Math.max(240, (st.viewH || 400) / viewMul() / (st.adsZ || 1)) };
  audio.ui('hover'); flashCamTag();
}
function flashCamTag() { const el = $('camTag'); if (!el) return; el.innerHTML = st.camLock ? `CAMERA LOCKED · <b>${label('camLock')}</b> to follow · <b>${label('camCentre')}</b> centre · hold wheel button to drag` : `CAMERA FOLLOWS · <b>${label('camLock')}</b> to lock`; el.classList.remove('hidden'); el.classList.toggle('on', !!st.camLock); clearTimeout(flashCamTag.t); flashCamTag.t = st.camLock ? 0 : setTimeout(() => { flashCamTag.t = 0; el.classList.add('hidden'); }, 1800); }
function lockedTarget(dt, view) {
  const L = st.camLock, hh = L.h * (st.adsZ || 1) * viewMul() / 2, hw = hh * VW / VH;
  if (floorAt(st.map, L.x, L.y) !== floorAt(st.map, view.x, view.y)) { L.x = view.x; L.y = view.y; L.free = false; } // another floor: go with you
  if (L.home) { const k = 1 - Math.exp(-dt * 12); L.x += (view.x - L.x) * k; L.y += (view.y - L.y) * k; if (Math.hypot(view.x - L.x, view.y - L.y) < 2) L.home = false; } // centre key: glide back onto you
  const fa = padOn && freeAimOn() && !gpRecent() ? freeAimPoint() : null;
  const sp = fa ? w2s(fa.ax, fa.ay) : cursor(), p = tilt.project(sp.x / DPR, sp.y / DPR), W = VW / DPR, H = VH / DPR;
  const band = LOCK_EDGE + Math.min(W, H) * 0.07, dep = v => Math.max(0, Math.min(1, v / (band - LOCK_EDGE)));
  const ex = dep(band - p.x) > 0 ? -dep(band - p.x) : dep(p.x - (W - band)), ey = dep(band - p.y) > 0 ? -dep(band - p.y) : dep(p.y - (H - band));
  if (ex || ey) {
    const v = hh * 3.2 * dt, mx = ex * v, my = ey * v; L.x += mx; L.y += my;
    if (fa) aimOff = { x: aimOff.x + mx, y: aimOff.y + my }; // the crosshair rides along (its reach still holds it)
  }
  const m = 0.82; // you never leave the middle 82% of the view: at its edge the view comes with you
  if (!L.free) { L.x = Math.max(view.x - hw * m, Math.min(view.x + hw * m, L.x)); L.y = Math.max(view.y - hh * m, Math.min(view.y + hh * m, L.y)); } // (after a drag the view may go anywhere on the floor until you centre it)
  return { x: L.x, y: L.y };
}
// On a drone the ping reticle reaches DRONE_PING_R from it (he asked: a bit past what the drone sees). The view zooms out
// to hold you and the crosshair (he asked: zoom, never let it leave the screen), up to FIT_MAX world px tall; only past
// that does it slide along.
const DRONE_PING_R = 10 * PX_PER_M, FIT_MAX = 2000;
// A sightline for the camera's lead that stops where the floor you stand on ends (he asked: on a roof the open air past
// the edge counted as a long view, so turning swung the camera out over nothing and back)
function edgeSight(x, y, a, L) {
  const m = st.map, d = castSight(m, x, y, a, L, null), f = floorAt(m, x, y);
  if (f === m.groundFloor) return d;
  const c = Math.cos(a), s = Math.sin(a);
  for (let t = 8; t < d; t += 8) { const k = Math.floor((y + s * t) / CELL) * m.W + Math.floor((x + c * t) / CELL); if (m.flAt[k] !== f || m.tiles[k] === T.VOID || (m.tiles[k] === T.LOW && m.floor[k] === FL.VOID)) return t; }
  return d;
}
// how far the crosshair can sit along angle a before the edge of your floor (the camera can't follow it there)
function floorLim(a, l) {
  const c = Math.cos(a), s = Math.sin(a), F = st.map.floors[Math.max(0, floorAt(st.map, st.pred.x, st.pred.y))], m = 10, x0 = F.gx * CELL + m, x1 = (F.gx + F.w) * CELL - m, y1 = F.h * CELL - m;
  if (c > 1e-6) l = Math.min(l, (x1 - st.pred.x) / c); else if (c < -1e-6) l = Math.min(l, (x0 - st.pred.x) / c);
  if (s > 1e-6) l = Math.min(l, (y1 - st.pred.y) / s); else if (s < -1e-6) l = Math.min(l, (m - st.pred.y) / s);
  return Math.max(1, l);
}
// a screen point (device px) pulled in so it shows at least m CSS px inside the real screen, the tilt's cropping included
function onScreen(x, y, m) {
  const p = tilt.project(x / DPR, y / DPR), px = Math.max(m, Math.min(VW / DPR - m, p.x)), py = Math.max(m, Math.min(VH / DPR - m, p.y));
  if (px === p.x && py === p.y) return { x, y };
  const u = tilt.untilt(px, py); return { x: u.x * DPR, y: u.y * DPR };
}
function freeMove(dx, dy) {
  const z = st.zoom || 1; dx /= z; dy /= z;
  const o = aimOff, l0 = Math.hypot(o.x, o.y) || 1, ux = o.x / l0, uy = o.y / l0, lo = AIM_MIN(), hi = AIM_MAX();
  if (aimMode === 'free') { const tr = trackR(ux, uy); if (l0 > tr) { const m = 1 + (farSens() - 1) * Math.min(1, (l0 - tr) / PX_PER_M); dx *= m; dy *= m; } } // far out: slower, the same every way
  const r = dx * ux + dy * uy; // 1:1 out, back and sideways
  let l = l0 + r, a = Math.atan2(uy, ux) + (-dx * uy + dy * ux) / l0;
  if (l < 0) { l = -l; a += Math.PI; } // pulled through the middle: out the other side
  if (l > hi) l = Math.max(hi, Math.min(l, l0)); // no pushing past the reach (a reach that just shrank keeps your spot)
  else if (l < lo) l = lo;
  if (st.map && !(st.winViewsOn && winAimed(a))) l = Math.min(l, Math.max(lo, floorLim(a, l))); // nor past the floor's edge, where it would stop while the mouse kept going
  aimOff = { x: Math.cos(a) * l, y: Math.sin(a) * l };
}
// aiming in: the crosshair goes to the orange tick if a wall stops bullets on the way (he asked; never nearer than 2 m), else to its sight's distance
function adsReset() {
  const l = Math.hypot(aimOff.x, aimOff.y) || 1, ux = aimOff.x / l, uy = aimOff.y / l; let d = adsStart(st.me && st.me.aa ? attFromCode(st.me.aa).sight : 'iron', st.me && st.me.w) * PX_PER_M; // gun first, then sight (he asked)
  // a set distance per sight, whatever distance you were at (he asked); a nearer wall stops it, but not the edge of a
  // doorway: if 2 of 5 lines spread over ±2.5° get through, it goes the full distance (no jumping onto door frames)
  // The sniper scope goes as far as you can see that way (he asked): the second-longest of those 5 sight lines, so a
  // sliver past a door frame doesn't count, within its reach
  const a = Math.atan2(uy, ux), sn = st.me && st.me.aa && attFromCode(st.me.aa).sight === 'sniper';
  if (wallBlue()) { // the held wall's bracket is blue (he asked): aiming in snaps right onto it, however far it is
    const q0 = freeAimPoint(), to = Math.min(reachOf(st.me, true), Math.max(AIM_MIN(), ADS_SNAP_MIN, q0.person ? q0.person.d + RING_R : q0.see)); // a person: onto them
    aimOff = { x: ux * to, y: uy * to }; return;
  }
  if (sn) { const ds = []; for (let i = -2; i <= 2; i++) ds.push(castSight(st.map, st.pred.x, st.pred.y, a + i * 0.022, reachOf(st.me, true), null)); ds.sort((p, q) => q - p); d = Math.max(AIM_MIN(), ds[1] - 4); }
  const keep = st.reachW; st.reachW = Math.max(keep || 0, d);
  aimOff = { x: ux * d, y: uy * d };
  const q = freeAimPoint();
  let pass = 0; for (let i = -2; i <= 2; i++) if (castSight(st.map, st.pred.x, st.pred.y, a + i * 0.022, d, null, true) + 2 >= d - 4) pass++;
  st.reachW = keep;
  const to = q.person ? Math.min(d, Math.max(AIM_MIN(), ADS_SNAP_MIN, q.person.d + RING_R)) : !sn && q.stopped && pass < 2 ? Math.min(d, Math.max(AIM_MIN(), ADS_SNAP_MIN, q.see)) : Math.min(d, q.d); // a wall right in front: still 2 m out (he asked)
  aimOff = { x: ux * to, y: uy * to };
}
// Sniper scope sway (he asked): scoped in, the reticle drifts in a slow figure of eight; holding Shift (walk or sprint
// key) steadies it within about a tenth of a second, for as long as you hold it (like the AWP), and slows the mouse by
// Settings → Steady aim sensitivity. The sway turns your real aim, so a shot goes where the reticle is.
const adsHeld = () => mouse.r || !!st.adsTog; // right button held, or aimed in by the toggle (trackpad: aim-in key or a two-finger tap)
const steadying = () => !!(st.me && st.me.ct === 'body' && st.me.a && sniperOn(st.me) && (adsHeld() || gpk.ads) && (keys.has('walk') || keys.has('sprint') || gpk.walk));
function scopeSway(dt, me, now) {
  const on = me && me.ct === 'body' && me.a && !me.dn && sniperOn(me) && !st.tv ? Math.min(1, me.at || 0) : 0;
  const run = Math.min(1, Math.hypot(st.pred.vx || 0, st.pred.vy || 0) / BASE_SPEED);
  const want = on * (me && me.bp ? 0 : steadying() ? 0.0008 : 0.011 * (1 + run * 1.5)); // PERCH's bipod: no sway at all
  st.swayA = (st.swayA || 0) + (want - (st.swayA || 0)) * (1 - Math.exp(-dt * (want < (st.swayA || 0) ? 22 : 4)));
  const v = st.swayA * (Math.sin(now * 1.3) + 0.5 * Math.sin(now * 2.9 + 1)), d = v - (st.swayV || 0);
  st.swayV = v; if (!d) return;
  if (padOn && freeAimOn() && !gpRecent()) { const c = Math.cos(d), s = Math.sin(d); aimOff = { x: aimOff.x * c - aimOff.y * s, y: aimOff.x * s + aimOff.y * c }; }
  else padAng = wrapAng(padAng + d);
}
const pad = () => ({ x: VW * 0.84, y: VH * 0.52, r: VH * 0.12 });
let padOn = false, padAng = 0, padReach = 0.6;
const wrapAng = a => Math.atan2(Math.sin(a), Math.cos(a));
// someone else's aim, watched (spectating, Esports TV): eased so their view cone doesn't shake with every tiny hand
// movement (he asked: the seeable areas jittered a lot watching bots); real turns still come through at once
const smoothAng = (prev, a, dt) => !Number.isFinite(prev) ? a : prev + wrapAng(a - prev) * Math.min(1, dt * (Math.abs(wrapAng(a - prev)) > 0.35 ? 30 : 12));
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
function faceMove(dx, dy, ads) { // Face aiming: the mouse turns your character; aiming in locks you to a narrow area until you let go
  if (!ads) { st.faceC = null; turnMove(dx, dy); return; }
  if (st.faceC === null || st.faceC === undefined) st.faceC = padAng;
  turnMove(Math.max(-300, Math.min(300, dx)), dy); // one move can't wrap past the far side of the lock
  const off = wrapAng(padAng - st.faceC);
  if (Math.abs(off) > FACE_ADS) padAng = wrapAng(st.faceC + Math.sign(off) * FACE_ADS);
}
// controller state (merged with the keyboard and mouse in sendInput)
const gpk = { up: 0, down: 0, left: 0, right: 0, walk: 0, crouch: 0, fire: 0, ads: 0 };
let gpT = -1e9, mouseT = 0, gpLastL = 0, gpName = '';
const gpRecent = () => touchActive() || (gpT > mouseT && performance.now() - gpT < 4000);
// world <-> screen pixels, allowing for a turned view (st.rot, Rotate aiming)
function w2s(x, y) {
  const z = st.zoom || 1, c = Math.cos(st.rot || 0), s = Math.sin(st.rot || 0), dx = (x - st.cam.x) * z, dy = (y - st.cam.y) * z;
  return { x: dx * c - dy * s + VW / 2, y: dx * s + dy * c + VH / 2 };
}
function screenToWorld(sx, sy) {
  const z = st.zoom || 1, c = Math.cos(st.rot || 0), s = Math.sin(st.rot || 0), dx = (sx - VW / 2) / z, dy = (sy - VH / 2) / z;
  return { x: dx * c + dy * s + st.cam.x, y: -dx * s + dy * c + st.cam.y };
}
// the point you aim at, in screen pixels (with the aim pad this sits ahead of your character)
function toggleAds() {
  if (!(st.me && st.me.a && st.me.ct === 'body')) return;
  st.adsTog = !st.adsTog;
  if (st.adsTog && aimMode === 'free' && padOn) adsReset();
  if (!st.adsTog) st.faceC = null;
}
// Aim help for trackpad and phone players only, never a mouse (he chose: slow-down + a slight pull). While the
// crosshair is close to an enemy you can see, the aim moves slower (mousemove above) and, while you are aiming,
// firing or aimed in, it drifts gently onto them. Nothing changes on the server: the aim you send is just where it points.
const ASSIST = { near: 0.9 * PX_PER_M, ang: 0.07, slow: 0.55, pull: 0.45, adsPull: 0.7, max: 0.2 };
let assistTgt = null;
const assistOn = () => isTrackpad || touchActive();
function aimAssist(dt, view) {
  assistTgt = null;
  const me = st.me, s = st.last, stick = touchActive() && gpLastL > 0.05;
  if (!assistOn() || !view || view.kind !== 'body' || !me || !me.a || me.dn || !s || s.ph !== PHASE.ACTION || !st.foesSeen) { if (st.asOff && !stick) { padAng = wrapAng(padAng + st.asOff); st.asOff = 0; } return; }
  const c = cursor(), q = screenToWorld(c.x, c.y), a0 = Math.atan2(q.y - st.pred.y, q.x - st.pred.x);
  let best = null, bs = 1;
  for (const f of st.foesSeen) {
    const d = Math.hypot(f.x - st.pred.x, f.y - st.pred.y); if (d < 12) continue;
    const da = angDiff(Math.atan2(f.y - st.pred.y, f.x - st.pred.x), a0), lim = Math.min(0.35, Math.max(ASSIST.ang, ASSIST.near / d)), sc = Math.abs(da) / lim;
    if (sc < bs) { bs = sc; best = { da, d }; }
  }
  if (!best) { if (st.asOff && !stick) { padAng = wrapAng(padAng + st.asOff); st.asOff = 0; } return; }
  assistTgt = best;
  const ads = adsHeld() || gpk.ads, aiming = performance.now() - (st.aimMoveT || -1e9) < 300 || stick || mouse.l || gpk.fire || keys.has('fire') || ads;
  if (!aiming) return;
  const step = Math.sign(best.da) * Math.min(Math.abs(best.da), (ads ? ASSIST.adsPull : ASSIST.pull) * dt);
  if (freeAimOn() && !gpRecent()) { const l = Math.hypot(aimOff.x, aimOff.y), a = Math.atan2(aimOff.y, aimOff.x) + step; aimOff = { x: Math.cos(a) * l, y: Math.sin(a) * l }; }
  else if (stick) st.asOff = Math.max(-ASSIST.max, Math.min(ASSIST.max, (st.asOff || 0) + step)); // the thumb holds the stick's angle: the pull rides on top of it
  else padAng = wrapAng(padAng + step);
}
function cursor() {
  if (!padOn) { // Cursor aiming: the pointer itself, kept within the drone's ping reach while you drive one
    if (!(st.me && st.me.a && st.me.ct === 'drone')) return mouse;
    const P = w2s(st.pred.x, st.pred.y), dx = mouse.x - P.x, dy = mouse.y - P.y, l = Math.hypot(dx, dy), R = DRONE_PING_R * (st.zoom || 1);
    return l <= R ? mouse : { x: P.x + dx / l * R, y: P.y + dy / l * R };
  }
  const z = st.zoom || 1, P0 = w2s(st.pred.x, st.pred.y), px = P0.x, py = P0.y;
  if (freeAimOn() && !gpRecent()) { const q = freeAimPoint(); return w2s(q.x, q.y); }
  const cx = Math.cos(padAng + (st.asOff || 0) + (st.rot || 0)), cy = Math.sin(padAng + (st.asOff || 0) + (st.rot || 0)), m = 30 * DPR; // (asOff: the aim help's pull)
  const scoped = scopeOn(st.me);
  let d = VH * 0.07 + padReach * (VH * 0.36 + (scoped ? 0 : 4 * PX_PER_M * z)); // +4 m without a scope (he asked); shortened if it would leave the screen
  if (cx > 0.01) d = Math.min(d, (VW - m - px) / cx); else if (cx < -0.01) d = Math.min(d, (m - px) / cx);
  if (cy > 0.01) d = Math.min(d, (VH - m - py) / cy); else if (cy < -0.01) d = Math.min(d, (m - py) / cy);
  d = Math.max(d, 24 * DPR);
  if (st.me && st.me.ct === 'drone') d = Math.min(d, DRONE_PING_R * z);
  return onScreen(px + cx * d, py + cy * d, 24); // (the tilt crops the screen's edges)
}
// Crosshair mode: the crosshair stays at the distance you put it (he asked: it used to jump onto every door frame
// in the way, so flicks got caught). x, y = ax, ay = that point (sent to the server for headshots). see = how far you
// can see along your aim, shot = how far a bullet gets (through soft walls and barricades); when something is in the
// way a tick marks it and the crosshair fades if bullets can't reach it.
// how tall (world px) the view must be to hold you and a point (dx, dy) from you, with the room kept round both
// (80 px round you, AHEAD × 1.3 past the crosshair) and a little spare for the tilt cropping the screen edges
function fitBoth(dx, dy) {
  const r = st.rot || 0, c = Math.cos(r), s = Math.sin(r), sx = Math.abs(dx * c - dy * s), sy = Math.abs(dx * s + dy * c);
  const f = 1 / 1.1, mp = (80 * DPR + AHEAD() * 1.3) / VH;
  return Math.max(sy / Math.max(0.2, f - mp), sx / Math.max(0.2, f * VW / VH - mp));
}
function freeAimPoint() {
  let l = Math.min(Math.hypot(aimOff.x, aimOff.y) || 1, AIM_MAX());
  const a = Math.atan2(aimOff.y, aimOff.x), c = Math.cos(a), s = Math.sin(a);
  const outWin = st.map && st.winViewsOn && winAimed(a); // aiming out of an upper window, down at the ground below
  if (st.map && !outWin) l = floorLim(a, l); // never off the edge of the floor you are on
  let see = st.map ? castSight(st.map, st.pred.x, st.pred.y, a, l, null) + 2 : l;
  let shot = st.map ? castSight(st.map, st.pred.x, st.pred.y, a, l, null, true) + 2 : l;
  if (outWin) { // out past the window the air ends at the floor's edge: the crosshair is on the ground below, not on a wall
    const vx = st.pred.x + c * (see + 3), vy = st.pred.y + s * (see + 3), k = Math.floor(vy / CELL) * st.map.W + Math.floor(vx / CELL);
    if (st.map.tiles[k] === T.VOID) { see = l; if (shot >= see - 40 || st.map.tiles[Math.floor((st.pred.y + s * (shot + 3)) / CELL) * st.map.W + Math.floor((st.pred.x + c * (shot + 3)) / CELL)] === T.VOID) shot = l; }
  }
  const x = st.pred.x + c * l, y = st.pred.y + s * l;
  // someone in the way (he asked): the marker stops on their team-coloured circle, unless the crosshair is on them
  let person = null;
  if (st.rings && st.map) for (const r of st.rings) {
    const ox = r.x - st.pred.x, oy = r.y - st.pred.y, along = ox * c + oy * s, perp = Math.abs(oy * c - ox * s);
    if (along <= 0 || perp > RING_R || Math.hypot(x - r.x, y - r.y) <= RING_R) continue;
    const edge = along - Math.sqrt(RING_R * RING_R - perp * perp);
    if (edge > 4 && edge < see - 2 && edge < shot - 2 && edge < l - 4 && (!person || edge < person.d)) person = { id: r.id, x: r.x, y: r.y, d: edge };
  }
  if (person) see = shot = person.d;
  return { x, y, d: l, ax: x, ay: y, ad: l, see, shot, person, wx: st.pred.x + c * see, wy: st.pred.y + s * see, blocked: see < l - 4, stopped: shot < l - 4 };
}
// is this aim (from where you stand) out through one of the windows you are looking down from?
function winAimed(a) {
  const was = st.winAimedT && performance.now() - st.winAimedT < 400; // (a dead zone: no flicking on and off at the cone's edge)
  for (const v of st.viewers || []) if (v.kind === 'window' && !v.oc) {
    const r = viewSrc(st.map, v), ft = r && windowFoot(st.map, r); if (!ft) continue;
    const wa = Math.atan2(ft.cy - st.pred.y, ft.cx - st.pred.x), half = Math.atan2(r.half + (was ? 14 : 6), Math.max(8, Math.hypot(ft.cx - st.pred.x, ft.cy - st.pred.y)));
    if (Math.abs(angDiff(a, wa)) < half) { st.winAimedT = performance.now(); return true; }
  }
  return false;
}
addEventListener('resize', resize); resize();
fx.quality = gq.parts; setShading(gq.shade);

// ---------------- network ----------------
function connect(mode = '', tvKey = null) { // '' = the shared match, 'tut' / 'free' = a private one
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws${mode ? `?${mode}=1` : ''}${tvKey ? `&key=${tvKey}` : ''}`);
  st.ws = ws;
  ws.onopen = () => { if (st.rejoin) { st.rejoin = false; $('joinBtn').click(); } };
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.t === 'pong') { const r = performance.now() - m.c; st.rtt = st.rtt == null ? r : st.rtt * 0.7 + r * 0.3; return; }
    if (m.t === 'welcome') {
      if (st.tutorial) send({ t: 'tut', a: 'start', lesson: st.tutorial });
      if (st.free) send({ t: 'free', a: 'start', map: st.free.map, bots: st.free.bots, level: st.free.level });
      if (st.tv) send({ t: 'tv', a: 'start', map: st.tv.map, level: st.tv.level, req: st.tv.req });
      st.id = m.id;
      if (st.rend && m.mapId === st.mapId) { // the map already on screen: just bring it up to date
        resetMap(m.mapVersion);
        for (let k = 0; k < m.tiles.length; k++) if (m.tiles[k] !== st.map.tiles[k] || m.hp[k] !== st.map.hp[k]) {
          st.map.tiles[k] = st.known.tiles[k] = m.tiles[k]; st.map.hp[k] = st.known.hp[k] = m.hp[k]; holePortal(st.map, k); st.rend.cellChanged(k);
        }
        for (const k in m.holes || {}) { st.map.holes[k] = m.holes[k]; st.known.holes[k] = m.holes[k].slice(); st.rend.cellChanged(+k); }
      } else {
        st.mapLoading = true;
        runLoading('LOADING MAP', [['Building the map', () => loadMap(m.mapVersion, m.tiles, m.hp, m.mapId, m.holes)], ['Getting every floor ready', () => frames(6)]], m.mapId).then(() => { st.mapLoading = false; });
      }
      st.token = m.token; st.profile = m.profile; updateCard();
      if (m.profile.settings) { applySettings(m.profile.settings); if (trackpadKeys()) saveSettings(); } else { trackpadKeys(); saveSettings(); } // first time: keep what this browser had
      try { localStorage.setItem('r62d-token', m.token); } catch {}
      $('join').classList.add('hidden'); $('room').classList.remove('hidden');
      if (st.wantTab) { const t = st.wantTab; st.wantTab = null; setTab(t); } // they picked a page before giving a name
    } else if (m.t === 'snap') onSnap(m);
    else if (m.t === 'tvclip') { if (st.tv && ((m.big.length && !(st.tv.seen && st.tv.seen[m.victim])) || st.tvAllReplays)) TV.offerReplay(m); } // (tvAllReplays: screenshot tests) // a big moment the camera missed
    else if (m.t === 'killcam') { st.killcam = m; m.got = performance.now(); } // watched from the death screen (F or the button)
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
$('coach').addEventListener('click', e => { if ((coach.blocking && !e.target.closest('button')) || e.target.closest('[data-skip]')) coach.space(st.last); }); // clicking the card itself (mouse not captured)
// free = { map, bots } for a free-play match (see the FREE PLAY page below)
function switchMatch(lesson, free = null, tv = null) {
  if (!st.token) { askName(); return; }
  if (tv && !TV) { loadTv().then(() => switchMatch(lesson, free, tv)); return; } // the Esports TV code only loads when it is opened (he asked)
  if (TV) TV.stopReplay();
  // leaving Esports TV: the server keeps that broadcast paused for 20 s; opening the same one again in that time resumes it
  if (st.tv) st.tvHold = { key: st.tv.key, pick: st.tv.pick, until: performance.now() + 19000 };
  const pick = tv && JSON.stringify([tv.map, tv.level, tv.req || []]), hold = st.tvHold;
  const key = !tv ? null : hold && hold.pick === pick && performance.now() < hold.until ? hold.key : Math.random().toString(36).slice(2, 12).padEnd(8, '0');
  if (tv) st.tvHold = null; else { st.tvSay = st.tvPos = null; }
  st.tutorial = lesson; st.free = free; st.tv = tv ? { map: tv.map, level: tv.level, req: tv.req || [], key, pick, auto: true, follow: null, overview: false, cutT: 0, shot: {} } : null; st.rejoin = true; st.marks = [];
  document.documentElement.classList.toggle('tv', !!tv);
  if (lesson) coach.start(lesson); else coach.stop();
  const leave = lesson ? 'Leave tutorial' : free ? 'Leave free play' : tv ? 'Leave Esports TV' : '';
  $('pEnd').textContent = leave || 'End match for everyone'; $('leaveBtn').textContent = leave || 'End match';
  const old = st.ws; connect(lesson ? 'tut' : free ? 'free' : tv ? 'tv' : '', key); try { old.close(); } catch {}
  $('pause').classList.add('hidden');
}
for (const b of document.querySelectorAll('[data-lesson]')) b.onclick = () => switchMatch(b.dataset.lesson);

// Esports TV's own code (public/js/tv.js: director, cards, picking screen, casters, replays) loads the first time it is opened
let TV = null;
const loadTv = () => import('./tv.js').then(m => {
  if (!TV) m.initTv({ st, send, $, setHTML, esc, w2s, mapThumb, portraitCached, ctx: () => ctx, dpr: () => DPR });
  return (TV = m);
});
// ---------------- ESPORTS TV page: pick a map (or random), then watch ----------------
const tvPick = { map: 'random', level: 7, req: [] };
function renderTv() {
  // viewer requests (he asked): up to 3 operators the pros must play; one per role on each side
  const rq = $('tvReq'), jobKey = o => OPERATORS[o].team + jobOf(o);
  if (!rq.children.length) for (const team of ['atk', 'def']) {
    const row = document.createElement('div'); row.className = 'rq'; row.innerHTML = `<b>${team === 'atk' ? 'ATTACK' : 'DEFENCE'}</b>`;
    for (const o of Object.keys(OPERATORS).filter(o => OPERATORS[o].team === team)) {
      const b = document.createElement('button'); b.dataset.op = o; b.textContent = OPERATORS[o].name; b.style.setProperty('--oc', OPERATORS[o].color); b.title = OPERATORS[o].role;
      b.onclick = () => { audio.ui(); const i = tvPick.req.indexOf(o); if (i >= 0) tvPick.req.splice(i, 1); else if (tvPick.req.length < 3 && !tvPick.req.some(q => jobKey(q) === jobKey(o))) tvPick.req.push(o); renderTv(); };
      row.appendChild(b);
    }
    rq.appendChild(row);
  }
  for (const b of rq.querySelectorAll('button')) { const o = b.dataset.op, on = tvPick.req.includes(o); b.classList.toggle('on', on); b.classList.toggle('off', !on && (tvPick.req.length >= 3 || tvPick.req.some(q => jobKey(q) === jobKey(o)))); }
  $('tvReqN').textContent = tvPick.req.length ? tvPick.req.map(o => OPERATORS[o].name).join(' · ') : '(none)';
  for (const b of $('tvLeague').querySelectorAll('button')) { b.classList.toggle('on', +b.dataset.l === tvPick.level); b.onclick = () => { audio.ui(); tvPick.level = +b.dataset.l; renderTv(); }; }
  const el = $('tvMaps');
  if (!el.children.length) for (const id of ['random', ...MAP_LIST]) {
    const b = document.createElement('button'); b.dataset.id = id;
    if (id === 'random') b.innerHTML = '<div class="tvRandom">?</div><b>RANDOM</b><span>a new map every match</span>';
    else { b.appendChild(mapThumb(id).cloneNode()); b.querySelector('canvas').getContext('2d').drawImage(mapThumb(id), 0, 0); b.insertAdjacentHTML('beforeend', `<b>${esc(MAPS[id].name)}</b><span>${esc(MAPS[id].floors)}</span>`); }
    b.onclick = () => { audio.ui(); tvPick.map = id; renderTv(); };
    el.appendChild(b);
  }
  for (const b of el.children) b.classList.toggle('on', b.dataset.id === tvPick.map);
}
// TRAIN THE PROS (he asked: a button too; 200 rounds per version): starts a practice session now, and shows when they last trained
const ago = t => { const h = (Date.now() - t) / 3600000; return !t ? 'never' : h < 1 ? 'less than an hour ago' : h < 48 ? Math.round(h) + ' hours ago' : Math.round(h / 24) + ' days ago'; };
function trainInfo() {
  fetch('/api/training').then(r => r.json()).then(t => {
    const txt = t.running ? `Practicing now… ${t.session} of ${t.perVersion || 200} rounds` : `Last practice: ${ago(t.at)}${t.version ? ` (version ${t.version}${t.version !== t.current ? ', older than this one' : ''})` : ''}, ${t.verRounds || 0} of ${t.perVersion || 200} rounds on this version`;
    for (const el of document.querySelectorAll('.trainInfo')) el.textContent = txt;
    for (const b of document.querySelectorAll('.trainBtn')) { b.disabled = t.running; b.textContent = t.running ? 'TRAINING…' : 'TRAIN THE PROS'; }
    st.training = t;
  }).catch(() => {});
}
for (const b of document.querySelectorAll('.trainBtn')) b.onclick = () => { audio.ui(); fetch('/api/train', { method: 'POST' }).then(r => r.json()).then(r => { if (!r.running && r.why) for (const el of document.querySelectorAll('.trainInfo')) el.textContent = 'Can\'t train right now: ' + r.why + '.'; else trainInfo(); }); };
setInterval(() => { if (!$('tab-tv').classList.contains('on') && $('playbookPage').classList.contains('hidden')) return; trainInfo(); }, 4000);
$('tvGo').onclick = () => switchMatch(null, null, { map: tvPick.map === 'random' ? null : tvPick.map, level: tvPick.level, req: tvPick.req.slice() });
// ---------------- free play page ----------------
// Pick a map and how many enemy bots, then play alone with no clock, switching operator with N / B.
const RANDOM_CARD = '<div class="tvRandom">?</div><b>RANDOM</b><span>a surprise</span>';
const freePick = { map: 'harbor', bots: 0, level: 2 };
try { Object.assign(freePick, JSON.parse(localStorage.getItem('r62d-free') || '{}')); } catch {}
if (!MAPS[freePick.map] && freePick.map !== 'random') freePick.map = 'harbor';
function renderFree() {
  const el = $('freeMaps');
  if (!el.children.length) for (const id of ['random', ...MAP_LIST]) {
    const M = MAPS[id], b = document.createElement('button');
    b.dataset.id = id;
    b.onclick = () => { audio.ui(); freePick.map = id; renderFree(); };
    if (id === 'random') { b.innerHTML = RANDOM_CARD; el.appendChild(b); continue; }
    b.title = M.desc;
    b.appendChild(mapThumb(id).cloneNode()); b.querySelector('canvas').getContext('2d').drawImage(mapThumb(id), 0, 0);
    b.insertAdjacentHTML('beforeend', `<b>${esc(M.name)}</b><span>${esc(M.floors)}</span>`);
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
  switchMatch(null, { ...freePick, map: freePick.map === 'random' ? MAP_LIST[Math.floor(Math.random() * MAP_LIST.length)] : freePick.map });
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
  if (st.rend) st.rend.free();
  st.rend = new MapRenderer(st.known, st.base); st.rend.mount(mapLayer); st.rend.lowCopy(); perfWatch.skip = 2; st.warm = 4;
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
// The loading screen (he asked for it to feel crisp and premium): the map being loaded drifts slowly behind its
// name, floors and description; the bar glides (a CSS transform, so it keeps moving smoothly even while the map is
// being built) with a sheen running along it, a percentage and a tip. Loading jobs queued back to back share one
// screen, so it never flickers off and on between them. mapId = the map being loaded (none at start-up).
let loadQueued = 0, loadSpan = [0, 1];
function setLoad(f) { // overall progress 0..1
  const v = Math.max(0, Math.min(1, f));
  $('loadBar').style.transform = `scaleX(${v})`; $('loadPct').textContent = Math.round(v * 100) + '%';
}
const loadPart = f => setLoad(loadSpan[0] + (loadSpan[1] - loadSpan[0]) * f); // progress inside the current step
function runLoading(title, steps, mapId = null) {
  loadQueued++;
  loadingChain = loadingChain.then(async () => {
    const el = $('loading'), M = mapId && MAPS[mapId];
    const fresh = el.classList.contains('hidden');
    if (fresh) setLoad(0);
    el.classList.toggle('withMap', !!M);
    $('loadTitle').textContent = M ? M.name.toUpperCase() : title;
    $('loadSub').textContent = M ? `${M.floors}  ·  ${M.desc}` : title === 'LOADING' ? 'TACTICAL BREACH  ·  5 VS 5' : '';
    $('loadKicker').textContent = M ? 'DEPLOYING TO' : '';
    if (M) { const bg = $('loadBg'); bg.innerHTML = ''; const c = mapThumb(mapId), cc = document.createElement('canvas'); cc.width = c.width; cc.height = c.height; cc.getContext('2d').drawImage(c, 0, 0); bg.appendChild(cc); }
    if (fresh || !$('loadTip').textContent) $('loadTip').textContent = 'TIP  ' + tipText(TIPS[Math.floor(Math.random() * TIPS.length)]);
    el.classList.remove('hidden');
    for (let i = 0; i < steps.length; i++) {
      loadSpan = [i / steps.length, (i + 1) / steps.length];
      $('loadStep').textContent = steps[i][0]; loadPart(0);
      await frames(2);
      await steps[i][1]();
      loadPart(1);
    }
    $('loadStep').textContent = 'Ready';
    await frames(6);
    if (--loadQueued <= 0) { loadQueued = 0; el.classList.add('hidden'); } // more loading right behind this? keep the screen up
  });
  return loadingChain;
}
// the same thing split into many small jobs, a slice per frame, so the bar keeps moving
const jobsStep = (jobs, perFrame) => async () => { for (let i = 0; i < jobs.length; i += perFrame) { jobs.slice(i, i + perFrame).forEach(j => j()); loadPart(Math.min(1, (i + perFrame) / jobs.length)); await frames(1); } };
const portraitCache = new Map();
function portraitCached(c, k) { // operator portraits are drawn once and copied after that
  let p = portraitCache.get(k);
  if (!p) { p = document.createElement('canvas'); p.width = 240; p.height = 240; portrait(p, k); portraitCache.set(k, p); }
  const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); x.drawImage(p, 0, 0, c.width, c.height);
}

function onSnap(s) {
  { const t = performance.now(); if (perfRep.lastSnap) perfRep.snaps.push(t - perfRep.lastSnap); perfRep.lastSnap = t; }
  if (st.mapLoading) return; // a new map is being got ready behind the loading screen
  if (s.mp && s.mp !== st.mapId) { // a different map: build it behind a loading screen
    st.mapLoading = true;
    const name = MAPS[s.mp] ? MAPS[s.mp].name.toUpperCase() : 'MAP';
    runLoading(`LOADING ${name}`, [['Building the map', () => loadMap(s.mv, null, null, s.mp)], ['Getting every floor ready', () => frames(6)]], s.mp).then(() => { st.mapLoading = false; });
    return;
  }
  if (s.mv !== st.mv) { if (st.rend) resetMap(s.mv); else loadMap(s.mv, null, null, s.mp); } // same map, new round
  const m = st.map, now = performance.now() / 1000;
  if (s.dh) syncDyn(m, s.dh); // holes blown in floors since the round began (shared/map.js)
  if (s.pp) syncPeeps(m, s.pp); // GIMLET's peepholes
  const changed = [], mine0 = s.players.find(p => p.id === s.you), ours = mine0 ? (mine0.tm === 'atk' ? 1 : 2) : -1, now0 = [];
  // your own side's changes (a teammate's barricade, reinforcement, breach...) reach your map at once, even out of sight (he asked)
  for (let i = 0; i < s.cells.length; i += 3) {
    const k = s.cells[i];
    if (s.cells[i + 1] === T.BARRI && m.tiles[k] !== T.BARRI) delete m.holes[k]; // freshly boarded up: no old bullet holes
    m.tiles[k] = s.cells[i + 1]; m.hp[k] = s.cells[i + 2];
    holePortal(m, k); // an opened hatch drops you through
    if (s.cb && s.cb[i / 3] === ours) now0.push(k); else st.unseen.add(k);
  }
  for (let i = 0; i < (s.holes || []).length; i += 3) { // new bullet holes in soft walls
    const k = s.holes[i];
    (m.holes[k] || (m.holes[k] = [])).push(s.holes[i + 1], s.holes[i + 2]);
    if (s.hb && s.hb[i / 3] === ours) now0.push(k); else st.unseen.add(k);
  }
  if (st.rend) for (const k of now0) { applyKnown(k); st.unseen.delete(k); }
  if (s.ph !== PHASE.PREP && s.ph !== PHASE.ACTION && s.ph !== PHASE.ROUND_END) revealAll();
  const players = new Map(s.players.map(p => [p.id, p]));
  if (s.mine && players.has(s.you)) { Object.assign(players.get(s.you), s.mine); st.mineAt = now; } // your own private details
  if (s.fp && s.mine && s.mine.ga) queueMicrotask(freeAttDraw);
  const ents = new Map(s.ents.map(e => [e.id, e]));
  st.snaps.push({ t: now, st: s.time, players, ents }); if (st.snaps.length > 12) st.snaps.shift();
  const prevMe = st.me;
  if (st.tv) TV.tvCasters(s, players);
  if (st.tv) { TV.tvDirector(s, players, now); st.id = st.tv.follow; if (st.rend) TV.tickReplay(!!st.tv.calm && s.ph === PHASE.ACTION, st.rend, st.map); } // ESPORTS TV: ride along with whoever the director (or you) picked
  st.last = s; st.me = players.get(st.tv ? st.tv.follow : s.you) || null;
  if (st.map) st.map.covers = s.ents.filter(e => e.ty === 'cover').map(coverOf); // TRENCH's plates block you here too (prediction, sight)
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
  if (me.jp && me.ct !== 'drone') { st.pred.air = me.jp[0]; st.pred.up = !!me.jp[1]; st.pred.jcd = me.jp[2]; st.pred.lo = me.jp[3]; st.pred.pr = me.jp[4] || 0; st.pred.slT = me.jp[5] || 0; st.pred.slR = me.jp[6] || 0; st.pred.slA = me.jp[7] || 0; st.pred.scd = me.jp[8] || 0; }
  const mods = me.m || {};
  for (const i of st.pending) stepMove(st.map, st.pred, i.k, i.dt, mods);
}

// ---------------- events from the server ----------------
function mySide() { return st.me ? st.me.tm : null; }

function onEvent(e, s, players) {
  const now = performance.now() / 1000;
  switch (e.e) {
    case 'shot': {
      if (st.r3shots && st.map && r3sees(players.get(e.id), e.x, e.y, e.x2, e.y2)) st.r3shots.push({ f: floorAt(st.map, e.x, e.y), x: e.x, y: e.y, x2: e.x2, y2: e.y2, k: e.k }); // (the 3D rope view: only shots your side could see, like the top-down streaks under the blackout)
      const w = WEAPONS[e.w]; const a = Math.atan2(e.y2 - e.y, e.x2 - e.x);
      if (e.nt) fx.tracer(e.x, e.y, e.x2, e.y2); else fx.trail(e.x, e.y, e.x2, e.y2); // subsonic ammo: only the old brief streak
      const an = anim(e.id);
      if (an.lastShotSnd !== s.time && st.listen && st.map && !e.q && e.id !== st.id) { // gunfire on the floor above or below: an arrow towards it
        const lv = localPos(st.map, st.listen.x, st.listen.y), ls = localPos(st.map, e.x, e.y), fd = ls.f - lv.f;
        if (fd && Math.abs(fd) <= 1 && Math.hypot(ls.x - lv.x, ls.y - lv.y) < 700) st.vertHint = { ...(st.vertHint || {}), [fd > 0 ? 'shotUp' : 'shotDown']: now }; // which floor, never which way (he asked)
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
      if (st.r3shots && st.map && r3sees(null, e.x, e.y)) st.r3shots.push({ f: floorAt(st.map, e.x, e.y), x: e.x, y: e.y, hit: e.k });
      if (e.k === 'blood') { st.rend.blood(e.x, e.y, e.a || 0); audio.impact('flesh', e.x, e.y); }
      else if (e.k === 'spark') audio.impact('electronic', e.x, e.y);
      else if (e.k === 'wall') audio.impact(wallMat(e.x, e.y, e.a), e.x, e.y);
      else if (e.k === 'wood') audio.impact('wood', e.x, e.y);
      else if (e.k === 'shield') audio.impact('metal', e.x, e.y);
      break;
    case 'boom':
      fx.explosion(e.x, e.y, e.r, e.kind);
      if (st.r3booms && st.map && r3sees(null, e.x, e.y)) st.r3booms.push({ f: floorAt(st.map, e.x, e.y), x: e.x, y: e.y, r: e.r, kind: e.kind, t: now });
      if (st.tv && e.kind === 'stun') { fx.ping(e.x, e.y, '255,255,255'); fx.ping(e.x, e.y, '255,250,210'); } // TV: how far the flash reached (no white-out for viewers, he asked)
      if (e.kind !== 'stun' && e.kind !== 'emp' && e.kind !== 'surge') st.rend.scorch(e.x, e.y, Math.min(40, e.r * 0.6));
      audio.explosion(e.x, e.y, e.kind);
      break;
    case 'zbCrate': audio.play('crate', e.x, e.y); break;
    case 'zbRound': audio.play('zbRound', 0, 0); break;
    case 'kill': {
      const v = players.get(e.victim), k = e.killer ? players.get(e.killer) : null;
      const prev = st.snaps.length > 1 ? st.snaps[st.snaps.length - 2].players.get(e.victim) : null;
      const pos = prev && prev.x !== undefined ? prev : null;
      if (pos && v && (v.tm === mySide() || teamSees(pos.x, pos.y))) { st.corpses.push({ x: pos.x, y: pos.y, aim: pos.ag, op: v.op, w: pos.w, ally: v.tm === mySide(), ring: tvRing(v), n: v.n, t: performance.now() / 1000, zbc: !!(v.zb && v.zb[0] === 1), look: v.zb && v.zb[2] }); st.rend.pool(pos.x, pos.y); }
      if (!(v && v.zb && v.zb[0] === 1)) addKill(k, v, e.w, e.hs, e.df); // (zombies: no kill feed for every one of them)
      if (e.hs && k && k.id === st.id) audio.ui('headshot');
      break;
    }
    case 'down': { const v = players.get(e.id); if (v) addFeed(`${v.n} is down${e.df ? ' · DEFUSER DROPPED' : ''}`); break; }
    case 'defdrop': st.defDrop = { x: e.x, y: e.y, t: now }; audio.ui('defdrop'); fx.lights.push({ x: e.x, y: e.y, r: 60, life: 0.6, max: 0.6, col: '255,220,90', a: 0.6 }); break; // he asked: you must notice it fall
    case 'msg': if (!e.team || e.team === mySide()) addFeed(e.text); break;
    case 'ban': if (st.tv) audio.ui('lock'); break; // (the casters read it below)
    case 'banner': if (!e.team || e.team === mySide()) banner(e.text, e.sub); audio.ui('round'); break;
    case 'found': if (e.team === mySide() && fxOn('site')) siteFound(s); break;
    case 'roundEnd': {
      if (st.tv) { const T = PRO_TEAMS[e.squad]; banner(T ? `${T.name.toUpperCase()} WIN THE ROUND` : 'ROUND OVER', e.reason, T ? T.colour : '#fff'); break; }
      const won = st.me && e.squad === st.me.sq;
      banner(won ? 'ROUND WON' : 'ROUND LOST', e.reason, won ? 'var(--ally)' : 'var(--enemy)');
      break;
    }
    case 'matchEnd': st.endT = now; st.mvp = e.mvp; showEnd(e.squad); break;
    case 'stun': if (st.me && e.id === st.me.id && !st.tv) { st.flashUntil = now + e.dur; audio.tinnitus(e.dur); } break;
    case 'hurt': if (st.me && e.id === st.me.id) { st.hurtT = now; st.hurtFrom = e.from; } break;
    case 'pts': if (e.to === st.id) { (st.ptsPops || (st.ptsPops = [])).push({ n: e.n, w: e.w, t: now }); if (st.ptsPops.length > 5) st.ptsPops.shift(); } break;
    case 'pingwait': if (e.to === st.id && performance.now() - (st.pingWaitT || 0) > 600) { st.pingWaitT = performance.now(); addFeed(`Ping ready in ${Math.ceil(e.t)} s`); audio.ui('back'); } break;
    case 'hitmark': if (e.to === st.id) { st.hitT = now; st.hitKill = e.kill; audio.ui(e.kill ? 'kill' : 'hit'); } break;
    case 'arc': fx.tracer(e.x, e.y, e.x2, e.y2, '130,200,255'); fx.tracer(e.x, e.y, e.x2 + 2, e.y2 - 2, '200,230,255'); fx.impact(e.x2, e.y2, 'spark'); if (e.v) audio.quietZap(e.x2, e.y2); else audio.impact('electronic', e.x2, e.y2); break;
    case 'laser': fx.tracer(e.x, e.y, e.x2, e.y2, '255,50,50'); fx.impact(e.x2, e.y2, 'spark'); audio.foley('tick', e.x, e.y); break;
    case 'daze': if (st.me && e.id === st.me.id) { st.dazeUntil = now + e.dur; audio.tinnitus(1); } break;
    case 'mark': if (e.team === mySide()) {
      st.marks = (st.marks || []).filter(k => !(k.from === e.from && (k.id === e.id && e.id != null || st.marks.filter(q => q.from === e.from).length >= 3)));
      const pk = e.pk || (e.w.startsWith('ENEMY') ? 'enemy' : 'auto');
      st.marks.push({ ...e, pk, t: now }); fx.ping(e.x, e.y, pingOf(pk).col);
      audio.pingSound(pk);
    } break;
    case 'lungeWarn': if (e.id === st.id) { addFeed('CROW drew a blade on you: a lunge is coming in 1.5 s'); audio.play('unsheathe', st.pred.x, st.pred.y); st.lungeWarnT = now; } break;
    case 'deny': if (e.id === st.id) addFeed(e.why); break;
    case 'emped': if (e.id === st.id) { addFeed('EMP! Your skill and gadget are fried for 8 seconds'); audio.foley('beep', st.pred.x, st.pred.y); st.empUntil = now + e.dur; } break; // TALON
    case 'scanned': if (e.id === st.id) { addFeed('A scanner just picked up your heartbeat'); audio.foley('beep', st.pred.x, st.pred.y); } break; // WRAITH
    case 'paint': if (e.id === st.id) addFeed('You walked into a paint trap — the defenders can see you for 12 s'); fx.ping(e.x, e.y, '120,255,90'); break; // LYNX
    case 'ping': if (e.team === mySide()) { fx.ping(e.x, e.y, e.any ? '255,90,60' : '79,179,169'); audio.foley('beep', e.x, e.y); } break;
    case 'stim': fx.tracer(e.x, e.y, e.x2, e.y2, '120,255,160'); fx.ping(e.x2, e.y2, '120,255,160'); audio.foley('revive', e.x, e.y); break;
    case 'melee': anim(e.id).melee = 1; { const p = players.get(e.id); if (p && p.x !== undefined) audio.foley('melee', p.x, p.y, e.id === st.id); } break;
    case 'snd': audio.play(e.s, e.x, e.y); break;
  }
}

function anim(id) { let a = st.anim.get(id); if (!a) st.anim.set(id, a = { walk: 0, recoil: 0, melee: 0, flashT: -9, lx: 0, ly: 0, stepAcc: 0 }); return a; }

// ---------------- input ----------------
// `keys` holds the names of actions currently held down (see keys.js for the bindings).
// In the desktop app no browser shortcut may close or reload the game, whatever screen you are on or what has the focus
// (he said it "crashed" while crouching (Ctrl) and lying down: the window closed cleanly, so most likely Ctrl+W / Ctrl+Q
// etc. got through on a screen where the old rule (only while playing) did not apply). Typing boxes keep copy/paste.
const COPY_KEYS = new Set(['KeyA', 'KeyC', 'KeyV', 'KeyX', 'KeyZ', 'KeyY']);
addEventListener('keydown', e => {
  if (!new URLSearchParams(location.search).has('app') || !(e.ctrlKey || e.metaKey)) return;
  const typing = document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');
  if (!(typing && COPY_KEYS.has(e.code))) e.preventDefault();
}, { capture: true });
let rebinding = null;
addEventListener('keydown', e => {
  if (rebinding) { e.preventDefault(); if (e.code !== 'Escape') setBind(rebinding.id, rebinding.slot, e.code); rebinding = null; renderSettings(); return; }
  if (e.code === 'Escape' && document.activeElement && document.activeElement.tagName === 'INPUT') document.activeElement.blur();
  if (document.activeElement === $('chatIn')) { chatKey(e); return; }
  if (document.activeElement && document.activeElement.tagName === 'INPUT') { if (e.key === 'Enter') $('joinBtn').click(); return; }
  if (e.code === 'Space' && coach.active && !e.repeat && coach.space(st.last)) { e.preventDefault(); return; }
  if ((e.code === 'Enter' || e.code === 'NumpadEnter') && coach.blocking && !e.repeat) { coach.space(st.last); e.preventDefault(); return; } // Enter dismisses a tutorial card too
  if (st.tv && !menuOpen() && TV.tvKey(e)) { e.preventDefault(); return; }
  const a = actionFor(e.code);
  if (a || e.code === 'AltLeft' || e.code === 'AltRight' || e.code === 'Tab' || ((e.ctrlKey || e.metaKey) && playing())) e.preventDefault(); // Ctrl is crouch: Ctrl+W etc. must not close the game
  if (!a || keys.has(a)) return;
  pressAction(a, e);
});
function watchKillcam() { if (!st.killcam || !st.rend || killcamOpen()) return; if (document.pointerLockElement) document.exitPointerLock(); openKillcam(st.killcam, st.rend, st.map); }
function pressAction(a, e) {
  if (a === 'pause' && (st.wheel || st.mapV)) { closeWheel(true); st.mapV = null; return; }
  if (a === 'interact' && st.killcam && st.me && !st.me.a && playing()) { watchKillcam(); return; } // dead: F replays how you died
  keys.add(a);
  audio.initAudio();
  const ev = st.evq;
  switch (a) {
    case 'reload': ev.push({ k: 'reload' }); break;
    case 'prone': st.prone = !st.prone; st.crouchT = false; break; // C lies down / gets up (he asked); Ctrl crouch or Space also gets up
    case 'crouch': if (trySlide()) break; st.prone = false; break;
    case 'crouchTap': if (trySlide()) break; st.crouchT = st.prone || !st.crouchT; st.prone = false; break; // one tap crouches, the next stands (he asked)
    case 'sprint': if (st.me && st.me.ct === 'body') { st.prone = false; st.crouchT = false; st.leanT = 0; } break; // sprinting gets you up, like R6
    case 'primary': ev.push({ k: 'slot', n: 0 }); break;
    case 'secondary': ev.push({ k: 'slot', n: 1 }); break;
    case 'melee': ev.push({ k: 'melee' }); break;
    case 'gadget': ev.push({ k: 'gadget' }); audio.foley('gadget'); break;
    case 'ability': ev.push({ k: 'ability' }); audio.foley('gadget'); break;
    case 'view': ev.push({ k: 'feeds' }); break; // 5: your team's drones and cameras (he asked)
    case 'drone': ev.push({ k: 'drone' }); break; // 6: put out your own drone / drive it (he asked)
    case 'droneOrCams': ev.push({ k: 'view' }); break; // controller / touch: one button for both, as before
    case 'leanL': case 'leanR': {
      const d = a === 'leanR' ? 1 : -1;
      if (st.me && (st.me.ct === 'cam' || st.me.ct === 'drone')) { ev.push({ k: d > 0 ? 'camNext' : 'camPrev' }); break; } // Q / E flip through the team's feeds
      st.leanT = st.leanT === d ? 0 : d; break; }
    case 'settings': toggleSettings(); break;
    case 'pause': escape(); break;
    case 'fire': mouse.wl++; break; // like a click (next teammate when dead, ping in a camera)
    case 'aimIn': toggleAds(); break;
    case 'spot': st.spotReq = true; break;
    case 'wheel': openWheel(); break;
    case 'map': toggleMapV(); break;
    case 'camLock': toggleCamLock(); break;
    case 'camCentre': if (st.camLock) { st.camLock.home = true; st.camLock.free = false; } break;
    case 'chat': if (st.id) { e && e.preventDefault(); keys.delete('chat'); openChat(true); } break;
    case 'left': case 'right': if (st.me && st.me.ct === 'cam') ev.push({ k: a === 'right' ? 'camNext' : 'camPrev' }); break;
    case 'swap': if (st.me) ev.push({ k: 'slot', n: st.me.sl === 0 ? 1 : 0 }); break;
    case 'vault': { // Space: vault a window or wall stub in front of you, otherwise jump (he asked)
      const p = st.pred, m = st.map, me = st.me;
      if (me && me.ro) { if (me.ro[0]) ev.push({ k: 'vault', a: st.aim }); break; } // on a rope: climb in at the window (the server checks it is open)
      const v = p && m && me && !(me.jp && me.jp[1]) ? findVault(m, p.x, p.y, vaultDir()) : null;
      if (v && !standable(m, v.k)) ev.push({ k: 'vault', a: Math.round(vaultDir() * 1000) / 1000 });
      else if (st.prone) st.prone = false; else st.jumpReq = performance.now();
      break; }
    case 'opNext': case 'opPrev': if (st.last && st.last.fp) send({ t: 'free', a: 'op', dir: a === 'opNext' ? 1 : -1 }); break;
    case 'opGrid': if (st.last && st.last.fp) toggleFreeOps(); break;
    case 'camPrev': case 'camNext': if (st.me && (st.me.ct === 'cam' || st.me.ct === 'drone')) ev.push({ k: a }); break;
  }
}
// Power slide: crouching while sprinting; until you are back up you can only aim within SLIDE.lock of the way you slide
const sliding = () => st.pred && (st.pred.slT > 0 || st.pred.slR > 0) && st.me && st.me.ct === 'body' && !st.tv;
const slideAim = a => st.pred.slA + Math.max(-SLIDE.lock, Math.min(SLIDE.lock, angDiff(a, st.pred.slA)));
function trySlide() { if (!st.pred || !st.pred.spr || st.pred.scd > 0 || !st.me || st.me.ct !== 'body') return false; st.slideReq = performance.now(); return true; }
// he asked: sprint + S sprints too (he kept pressing it): on your body it is sent as sprint + W, where you aim
const sprintBack = () => !!(st.me && st.me.ct === 'body' && !gpRecent() && keys.has('sprint') && keys.has('down') && !keys.has('up') && !steadying());
// How much the movement keys are turned: Rotate view, Face aiming (W goes the way you face), sprint + W (he asked: where you aim).
function moveTurn() {
  const body = st.me && st.me.ct === 'body';
  if (body && !gpRecent() && (aimMode === 'face' || (keys.has('sprint') && (keys.has('up') || sprintBack()) && !steadying()))) return st.aim + Math.PI / 2;
  return -(st.rot || 0);
}
// Vaulting goes the way you're moving, or where you look when standing still.
function vaultDir() {
  const mx = (keys.has('right') || gpk.right ? 1 : 0) - (keys.has('left') || gpk.left ? 1 : 0), my = sprintBack() ? -1 : (keys.has('down') || gpk.down ? 1 : 0) - (keys.has('up') || gpk.up ? 1 : 0);
  return mx || my ? Math.atan2(my, mx) + moveTurn() : st.aim;
}
// Read the controller once a frame and turn it into the same actions as the keyboard and mouse.
function pollPad(dt, view) {
  const gp = readPad() || touchPad(); // a real controller first, else the phone's touch controls (touch.js)
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
      if (a === 'crouch') { // on a drone B is sprint; sprinting: a power slide; held: lie down / get up (below)
        if (st.me && st.me.ct === 'drone') {} else if (trySlide()) {} else if (st.prone) { st.prone = false; gpk.crouch = 1; } else { gpk.crouch = gpk.crouch ? 0 : 1; st.crouchHoldT = performance.now(); }
      }
      else if (a === 'pause') escape();
      else pressAction(a);
    }
    if (gp.released[i] && a !== 'crouch') keys.delete(a);
  }
  // hold crouch (B / the CROUCH button) half a second: lie down instead (he can't press C on a phone)
  if (!gp.held[1]) st.crouchHoldT = 0;
  else if (st.crouchHoldT && performance.now() - st.crouchHoldT > 450 && st.me && st.me.ct === 'body') { st.crouchHoldT = 0; gpk.crouch = 0; st.prone = true; }
  // phone: the move thumb pushed past its ring sprints; with no thumb aiming you turn to run that way (sprinting needs you facing roughly where you go)
  const spr = !!gp.sprint && !!st.me && st.me.ct === 'body';
  if (spr && !gpk.sprint) { st.prone = false; gpk.crouch = 0; st.leanT = 0; }
  gpk.sprint = spr ? 1 : 0;
  if (spr && ls.l && rs.l < 0.05 && !(gp.rt > 0.35)) padAng = wrapAng(padAng + angDiff(Math.atan2(ls.y, ls.x) - (st.rot || 0), padAng) * Math.min(1, dt * 12));
  // left stick: 8 directions like WASD; a light push walks (silent)
  const nx = ls.l ? ls.x / ls.l : 0, ny = ls.l ? ls.y / ls.l : 0;
  gpk.right = ls.l && nx > 0.38 ? 1 : 0; gpk.left = ls.l && nx < -0.38 ? 1 : 0;
  gpk.down = ls.l && ny > 0.38 ? 1 : 0; gpk.up = ls.l && ny < -0.38 ? 1 : 0;
  // on a drone, walk = sprint: held on B (a light push used to start one by accident)
  gpk.walk = st.me && st.me.ct === 'drone' ? (gp.held[1] ? 1 : 0) : ls.l && ls.l < 0.55 ? 1 : 0;
  if (gp.rt > 0.35 && !gpk.fire) mouse.wl++; // a trigger pull also counts as a click (next teammate, ping in a camera)
  const aimReset = gp.lt > 0.35 && !gpk.ads && touchActive();
  if (aimReset) { padReach = 0.22; touchAimReset(); } // phone (he asked): aiming in pulls the crosshair in to ~2.5 m, like the mouse's aim-in reset
  gpk.fire = gp.rt > 0.35 ? 1 : 0; gpk.ads = gp.lt > 0.35 ? 1 : 0;
  // right stick: aim. A stick snapping back to the middle when let go is ignored, so the aim stays put.
  const falling = (gpLastL - rs.l) / Math.max(dt, 1e-3) > 4;
  if (rs.l > 0.05 && !falling && !aimReset) { // (the frame you aim in on a phone keeps the pulled-in crosshair)
    if (view && view.kind === 'cam') { mouse.x = VW / 2 + rs.x / rs.l * VH * 0.25; mouse.y = VH / 2 + rs.y / rs.l * VH * 0.25; }
    else { padAng = Math.atan2(rs.y, rs.x); if (!gp.rsDir) padReach = rs.l; }
  }
  gpLastL = rs.l;
}
addEventListener('keyup', e => {
  if (e.code === 'AltLeft' || e.code === 'AltRight') e.preventDefault(); // stop Firefox's menu bar popping up
  const a = actionFor(e.code); if (a) keys.delete(a);
  if (a === 'wheel' && !st.wheelMouse) closeWheel();
});
cv.addEventListener('mousemove', e => {
  mouseT = performance.now();
  if (st.wheel) { const W = st.wheel, c = 1.15 * DPR, R = WHEEL_CLAMP * DPR; W.dx += e.movementX * c; W.dy += e.movementY * c; const L = Math.hypot(W.dx, W.dy); if (L > R) { W.dx *= R / L; W.dy *= R / L; } return; } // the wheel holds your aim still
  if (st.mapV) { const V = st.mapV, c = 1.15 * DPR; V.cx = Math.max(0, Math.min(VW, V.cx + e.movementX * c)); V.cy = Math.max(0, Math.min(VH, V.cy + e.movementY * c)); return; }
  if (document.pointerLockElement === cv) {
    if (st.mDrag && st.camLock) { const z = st.zoom || 1; st.camLock.x -= e.movementX * DPR / z; st.camLock.y -= e.movementY * DPR / z; st.camLock.free = true; st.mDrag.d += Math.abs(e.movementX) + Math.abs(e.movementY); return; } // grab the map: your aim stays put
    const ads = adsHeld() && st.me && st.me.a && st.me.ct === 'body';
    st.aimMoveT = performance.now();
    const k = ($('sens').value / 100) * (ads ? $('adsSens').value / 100 : 1) * (steadying() ? $('steadySens').value / 100 : 1) * DPR * (assistTgt ? ASSIST.slow : 1); // aim help: slower over an enemy
    if (r3on()) { rope3d.look(e.movementX * k / DPR, e.movementY * k / DPR); return; } // the 3D rope view turns instead
    if (padOn && freeAimOn()) { freeMove(e.movementX * k, e.movementY * k); return; }
    if (padOn && aimMode === 'pad') { padMove(e.movementX * k, e.movementY * k); return; }
    if (padOn && aimMode === 'face') { faceMove(e.movementX * k, e.movementY * k, ads); return; }
    if (padOn && (aimMode === 'turn' || aimMode === 'spin')) { turnMove(e.movementX * k, e.movementY * k); return; }
    mouse.x = Math.max(0, Math.min(VW, mouse.x + e.movementX * k));
    mouse.y = Math.max(0, Math.min(VH, mouse.y + e.movementY * k));
    const p = onScreen(mouse.x, mouse.y, 12); mouse.x = p.x; mouse.y = p.y; // never under the tilt's cropped edges
  } else { const u = tilt.untilt(e.clientX, e.clientY); mouse.x = u.x * DPR; mouse.y = u.y * DPR; } // (the tilted world layers: look.js)
});
cv.addEventListener('mousedown', e => {
  audio.initAudio();
  if (st.tv) return; // watching: the mouse does nothing to the match
  if (touchActive()) return; // on a phone, firing and aiming come from the touch controls (touch.js), not taps on the map
  if (coach.blocking && e.button === 0) { // a tutorial card to read: the click dismisses it (and takes control), it doesn't shoot
    coach.space(st.last);
    if (playing() && !menuOpen() && document.pointerLockElement !== cv) { st.lockAsked = true; lockMouse(cv); }
    return;
  }
  if (playing() && !menuOpen() && document.pointerLockElement !== cv && !st.lockAsked) { // the first click just takes control, it doesn't shoot
    st.lockAsked = true; lockMouse(cv); return;
  }
  if (st.wheel) { if (e.button === 2) closeWheel(true); return; }
  if (st.mapV) { if (e.button === 2) st.mapV = null; else if (e.button === 0) mapClick(); return; }
  if (e.button === 0) { mouse.l = true; mouse.wl++; }
  if (e.button === 2 && isTrackpad) { toggleAds(); mouse.wr++; return; } // a trackpad can't hold a right click while it aims: a two-finger tap aims in, the next one out
  if (e.button === 2) { mouse.r = true; mouse.wr++; if (aimMode === 'free' && padOn && st.me && st.me.ct === 'body') adsReset(); } // (Classic: aiming in leaves the crosshair where it is)
});
addEventListener('mouseup', e => { if (e.button === 1 && st.mDrag) { if (st.mDrag.d < 6) st.spotReq = true; st.mDrag = null; } if (e.button === 0 && st.wheelMouse) closeWheel(); if (e.button === 0) mouse.l = false; if (e.button === 2) { mouse.r = false; st.faceC = null; } });
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('wheel', e => {
  if (st.mapV) { mapFloorStep(e.deltaY > 0 ? 1 : -1); return; }
  if (st.wheel) return;
  if (!st.me || !st.me.a) return;
  if (st.me.ct === 'cam' || st.me.ct === 'drone') st.evq.push({ k: e.deltaY > 0 ? 'camNext' : 'camPrev' }); // flip through the team's cameras / drones
  else st.evq.push({ k: 'slot', n: st.me.sl === 0 ? 1 : 0 });
}, { passive: true });
cv.addEventListener('mousedown', e => { if (e.button === 1) { e.preventDefault(); if (st.camLock && playing() && !st.tv) st.mDrag = { d: 0 }; else st.spotReq = true; } }); // locked camera: hold the wheel button and move to drag the view (a still click still pings)

// ---------------- settings ----------------
function toggleSettings() { $('settings').classList.toggle('hidden'); renderSettings(); }
// Settings is a list of sections down the left; only the chosen one shows (he asked: less cluttered, more intuitive)
let setPage = (() => { try { return localStorage.getItem('r62d-setpage') || 'sound'; } catch { return 'sound'; } })();
function showSetPage(n) {
  setPage = n; try { localStorage.setItem('r62d-setpage', n); } catch {}
  for (const b of $('settings').querySelectorAll('.setSide > button[data-p]')) b.classList.toggle('on', b.dataset.p === n);
  for (const c of $('settings').querySelectorAll('.setPage')) c.classList.toggle('on', c.dataset.p === n);
}
for (const b of $('settings').querySelectorAll('.setSide > button[data-p]')) b.onclick = () => { audio.ui(); showSetPage(b.dataset.p); };
showSetPage(setPage);
// Leaning: toggle by default (he asked); Hold keeps it only while the key is down
let leanMode = (() => { try { return localStorage.getItem('r62d-lean') === 'hold' ? 'hold' : 'toggle'; } catch { return 'toggle'; } })();
function setLean(m, save = true) {
  leanMode = m === 'hold' ? 'hold' : 'toggle'; st.leanT = 0;
  try { localStorage.setItem('r62d-lean', leanMode); } catch {}
  for (const b of $('leanSeg').children) b.classList.toggle('on', b.dataset.l === leanMode);
  $('leanHint').textContent = leanMode === 'toggle' ? 'Press lean once to lean, again (or the other side) to stand straight' : 'Lean only while you hold the key';
  if (save) saveSettings();
}
for (const b of $('leanSeg').children) b.onclick = () => { audio.ui(); setLean(b.dataset.l); };
setLean(leanMode, false);
const leanNow = () => leanMode === 'toggle' ? st.leanT || 0 : (keys.has('leanR') ? 1 : 0) - (keys.has('leanL') ? 1 : 0);
// screen effects anyone can switch off (he asked), remembered on this computer
const FX_OPTS = [['shake', 'Screen shake'], ['hurt', 'Red edges when hurt'], ['hit', 'Hit markers'], ['pts', 'Points pop-ups'], ['sight', 'Sight glow when aiming in'],
  ['compass', 'Bomb-site compass'], ['pip', 'Stairs preview window'], ['site', 'Bomb-site found card'], ['vignette', 'Dark screen corners'],
  ['tilt', 'Camera tilt'], ['lean', 'Camera lean and kick'], ['walls3d', 'Raised walls'], ['lights', 'Room lighting'], ['blur', 'Soft screen edges']];
let fxOff = new Set(); try { fxOff = new Set(JSON.parse(localStorage.getItem('r62d-fxoff') || '[]')); } catch {}
const fxOn = k => !fxOff.has(k);
function renderFxList() {
  const el = $('fxList'); if (!el) return;
  el.innerHTML = FX_OPTS.map(([k, n]) => `<button class="tog${fxOn(k) ? ' on' : ''}" data-fx="${k}">${n}: ${fxOn(k) ? 'ON' : 'OFF'}</button>`).join('');
  for (const b of el.querySelectorAll('button')) b.onclick = () => { audio.ui(); const k = b.dataset.fx; fxOff.has(k) ? fxOff.delete(k) : fxOff.add(k);
    try { localStorage.setItem('r62d-fxoff', JSON.stringify([...fxOff])); } catch {} renderFxList(); applyFx(); };
}
function applyFx() {
  const v = $('vignette'); if (v) v.style.display = fxOn('vignette') ? '' : 'none';
  tilt.on = fxOn('tilt'); tilt.lean = fxOn('lean');
  if (looks.light !== fxOn('lights')) { looks.light = fxOn('lights'); if (st.rend) { st.rend.free(); st.rend = new MapRenderer(st.known, st.base); st.rend.splinters = st.splinters; st.rend.mount(mapLayer); st.warm = 4; } }
}
applyFx();
function renderSettings() {
  renderFxList();
  const el = $('settings'); if (el.classList.contains('hidden')) return;
  const named = new Map(ACTIONS.map(a => [a[0], a[1]])), grouped = new Set(KEY_GROUPS.flatMap(g => g[1]));
  const groups = [...KEY_GROUPS, ['OTHER', ACTIONS.map(a => a[0]).filter(id => !grouped.has(id))]];
  const rows = groups.filter(g => g[1].length).map(([gName, ids]) => `<tr class="keyGroup"><th colspan="3">${gName}</th></tr>` + ids.filter(id => named.has(id)).map(id => {
    let name = named.get(id); const b = bindsFor(id);
    if (id === 'leanL' || id === 'leanR') name = name.replace('(hold)', leanMode === 'toggle' ? '(press)' : '(hold)');
    const btn = slot => `<button data-id="${id}" data-slot="${slot}" class="${rebinding && rebinding.id === id && rebinding.slot === slot ? 'wait' : ''}">${rebinding && rebinding.id === id && rebinding.slot === slot ? 'PRESS A KEY…' : keyName(b[slot])}</button>`;
    return `<tr><td>${name}</td><td>${btn(0)}</td><td>${btn(1)}</td></tr>`;
  }).join('')).join('');
  $('bindTable').innerHTML = `<tr><th></th><th>KEY</th><th>SECOND KEY</th></tr>${rows}
    <tr class="keyGroup"><th colspan="3">MOUSE</th></tr><tr><td>Shoot / Aim in</td><td>Left button</td><td>Right button</td></tr>
    <tr><td>Ping</td><td>Middle button</td><td></td></tr>
    <tr class="keyGroup"><th>XBOX CONTROLLER</th><th colspan="2">${gpName ? 'CONNECTED' : 'NOT CONNECTED (plug it in and press a button)'}</th></tr>
    ${PAD_HELP.map(([n, b]) => `<tr><td>${n}</td><td colspan="2">${b}</td></tr>`).join('')}`;
  for (const b of $('bindTable').querySelectorAll('button')) b.onclick = () => { rebinding = { id: b.dataset.id, slot: +b.dataset.slot }; renderSettings(); };
}
$('setReset').onclick = () => { resetBinds(); renderSettings(); };
for (const [id, name] of PRESETS) { const b = document.createElement('button'); b.textContent = name; b.onclick = () => { audio.ui(); applyPreset(id); renderSettings(); }; $('keyPresets').appendChild(b); }
const KEY_GROUPS = [['MOVING', ['up', 'down', 'left', 'right', 'sprint', 'walk', 'crouch', 'crouchTap', 'prone', 'vault', 'leanL', 'leanR']],
  ['FIGHTING', ['fire', 'aimIn', 'primary', 'secondary', 'melee', 'reload', 'ability', 'gadget', 'interact']],
  ['DRONES, CAMERAS & TEAM', ['drone', 'view', 'spot', 'wheel', 'map', 'camLock', 'camCentre', 'chat', 'scoreboard']],
  ['MENUS & FREE PLAY', ['settings', 'pause', 'opNext', 'opPrev', 'opGrid']]];
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
let appWin = false; // play.sh's window on this desktop answers /api/window
const winSwitch = () => appWin || !!(window.r62dApp && window.r62dApp.toggleFull);
const appFull = () => innerWidth >= screen.width - 1 && innerHeight >= screen.height - 1;
function renderGfx() {
  for (const b of $('gfxSeg').querySelectorAll('button')) b.classList.toggle('on', b.dataset.q === gfxName);
  const app = inApp() && !winSwitch(), on = app || (inApp() ? appFull() : !!document.fullscreenElement);
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
// The TV's wide shot of a floor. The director's opening shot: the objective and whoever is near it. Your own map key
// (M): the whole building. Both leave out the open ground round it.
function tvBuildingBox(fi) {
  const M = st.map, c = M._tvBox || (M._tvBox = {});
  if (c[fi]) return c[fi];
  const F = M.floors[fi]; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let y = 0; y < F.h; y++) for (let x = F.gx; x < F.gx + F.w; x++) {
    const t = M.tiles[y * M.W + x]; if (t === T.GROUND || t === T.VOID) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return (c[fi] = x0 === Infinity ? { x0: F.gx * CELL, y0: 0, x1: (F.gx + F.w) * CELL, y1: F.h * CELL } : { x0: x0 * CELL, y0: y0 * CELL, x1: (x1 + 1) * CELL, y1: (y1 + 1) * CELL });
}
function tvShotBox(fi, s, site) {
  const build = tvBuildingBox(fi);
  if (!st.tv.ovUntil) return build;
  const now = performance.now() / 1000, had = st.tv.shotBox;
  if (had && had.f === fi && now < had.t) return had.b; // steady: looked at again twice a second
  const bx = site.bombs[0].x, by = site.bombs[0].y, bombF = floorAt(st.map, bx, by);
  // the opening shot frames the objective and the people near it; the director's later wide shots frame the players
  // where the action is (st.tv.ovPts, from tvDirector)
  let pts = !st.tv.opening && st.tv.ovPts && st.tv.ovPts.length ? st.tv.ovPts.slice() : null;
  if (!pts) {
    pts = bombF === fi ? site.bombs.map(b => [b.x, b.y]) : [];
    for (const p of s.players) if (p.a && p.x !== undefined && floorAt(st.map, p.x, p.y) === fi && (bombF !== fi || Math.hypot(p.x - bx, p.y - by) < 26 * CELL)) pts.push([p.x, p.y]);
    if (!pts.length) return build;
  }
  const pad = 4 * CELL, minH = 620, minW = minH * 16 / 9;
  let x0 = Math.min(...pts.map(q => q[0])) - pad, x1 = Math.max(...pts.map(q => q[0])) + pad, y0 = Math.min(...pts.map(q => q[1])) - pad, y1 = Math.max(...pts.map(q => q[1])) + pad;
  if (x1 - x0 < minW) { const c = (x0 + x1) / 2; x0 = c - minW / 2; x1 = c + minW / 2; }
  if (y1 - y0 < minH) { const c = (y0 + y1) / 2; y0 = c - minH / 2; y1 = c + minH / 2; }
  const b = { x0, y0, x1, y1 }; st.tv.shotBox = { f: fi, t: now + 0.5, b };
  return b;
}
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
    [L('sprint'), 'Sprint (loud)'], [L('walk'), 'Walk (silent)'], [bindsFor('crouch')[0] ? L('crouch') : L('crouchTap'), bindsFor('crouch')[0] ? 'Crouch (hold, silent)' : 'Crouch (tap, silent)'], [L('reload'), 'Reload'],
    [L('interact') + ' (hold)', 'Reinforce, barricade, plant, defuse, revive'], [L('ability'), 'Operator skill'],
    [L('gadget'), 'Secondary gadget'], [L('melee'), 'Melee'], [L('drone'), 'Put out / drive your drone'], [L('view'), 'Team drones & cameras (' + L('leanL') + ' / ' + L('leanR') + ' switch)'], [L('spot') + ' · Middle click', 'Ping (enemies, gadgets, walls, doors, places)'],
    [L('wheel') + ' (hold, drag)', 'Ping wheel'], [L('map'), 'Map: click it to ping'], [`${L('primary')} / ${L('secondary')} · Wheel`, 'Switch weapon'], [L('scoreboard'), 'Scoreboard']];
  const html = rows.map(([k, d]) => `<span>${k}</span>${d}`).join('');
  if ($('ctlGrid').innerHTML !== html) $('ctlGrid').innerHTML = html;
}


// Little top-down pictures of each map's ground floor for the lobby's map picker.
// The map cards in every menu (he chose): the real map picture, close up on the ground floor of the building.
const mapThumbs = new Map(), THUMB_W = 360, THUMB_H = 214, THUMB_INSIDE = new Set([FL.WOOD, FL.TILE, FL.CARPET, FL.MARBLE, FL.SERVER]);
function mapThumb(id) {
  if (mapThumbs.has(id)) return mapThumbs.get(id);
  const m = buildMap(id), fi = Math.max(0, m.floors.findIndex(f => f.name === '1F')), F = m.floors[fi];
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1, fx0 = Infinity, fy0 = Infinity, fx1 = -1, fy1 = -1;
  for (let k = 0; k < m.tiles.length; k++) if (m.flAt[k] === fi) {
    const cx = k % m.W, cy = Math.floor(k / m.W);
    fx0 = Math.min(fx0, cx); fx1 = Math.max(fx1, cx); fy0 = Math.min(fy0, cy); fy1 = Math.max(fy1, cy);
    if (THUMB_INSIDE.has(m.floor[k])) { x0 = Math.min(x0, cx); x1 = Math.max(x1, cx); y0 = Math.min(y0, cy); y1 = Math.max(y1, cy); }
  }
  if (x1 < 0) { x0 = fx0; x1 = fx1; y0 = fy0; y1 = fy1; }
  let w = x1 - x0 + 7, h = y1 - y0 + 7; // (a little ground round the building)
  if (w / h < THUMB_W / THUMB_H) w = h * THUMB_W / THUMB_H; else h = w * THUMB_H / THUMB_W;
  const mid = (a, b, n, lo, hi) => n > hi + 1 - lo ? (a + b + 1 - n) / 2 : Math.max(lo, Math.min(hi + 1 - n, (a + b + 1 - n) / 2));
  const sx = mid(x0, x1, w, fx0, fx1), sy = mid(y0, y1, h, fy0, fy1);
  const R = new MapRenderer(m, m.tiles.slice(), Math.min(0.5, THUMB_W * 1.5 / (w * CELL)));
  const c = document.createElement('canvas'); c.width = THUMB_W; c.height = THUMB_H;
  const x = c.getContext('2d'), P = CELL * R.S, k = THUMB_W / w;
  R.c.drawTo(x, fx0 * P, Math.floor((fy0 + fy1) / 2) * P, P, P, 0, 0, THUMB_W, THUMB_H); // a card wider than the floor: its ground carries on, not the next floor beside it
  x.beginPath(); x.rect((fx0 - sx) * k, (fy0 - sy) * k, (fx1 + 1 - fx0) * k, (fy1 + 1 - fy0) * k); x.clip();
  R.c.drawTo(x, sx * P, sy * P, w * P, h * P, 0, 0, THUMB_W, THUMB_H);
mapThumbs.set(id, c); return c;
}
function renderMapPick(s) {
  const el = $('mapPick'), key = s.mp + ':' + (s.ph === PHASE.LOBBY) + ':' + s.rm + ':' + s.md;
  if (el.dataset.k === key) return;
  el.dataset.k = key; el.innerHTML = '';
  const rnd = document.createElement('button');
  rnd.className = s.rm ? 'on' : ''; rnd.innerHTML = RANDOM_CARD;
  rnd.onclick = () => { audio.ui(); send({ t: 'lobby', a: 'map', id: 'random' }); };
  el.appendChild(rnd);
  for (const id of MAP_LIST) {
    const M = MAPS[id], b = document.createElement('button');
    b.className = id === s.mp && !s.rm ? 'on' : ''; b.title = M.desc;
    b.appendChild(mapThumb(id).cloneNode()); b.querySelector('canvas').getContext('2d').drawImage(mapThumb(id), 0, 0);
    b.insertAdjacentHTML('beforeend', `<b>${esc(M.name)}</b><span>${esc(M.floors)}</span>`);
    b.onclick = () => { audio.ui(); send({ t: 'lobby', a: 'map', id }); };
    el.appendChild(b);
  }
  $('lobbyHint').textContent = `${s.md === 'zombies' ? 'Lantern Point · a harbour town on the point, overrun · ' : s.rm ? 'Random map: a surprise until the match starts · ' : MAPS[s.mp] ? MAPS[s.mp].name + ' · ' + MAPS[s.mp].desc + ' · ' : ''}${ruleLine(MODES[s.md] || MODES.quick)}`;
}
function renderLobby(s) {
  renderControls(); renderMapPick(s);
  for (const b of $('botLevel').children) b.classList.toggle('on', +b.dataset.lv === (s.bl ?? 2));
  $('botLevel').classList.toggle('locked', !!s.rk); // ranked: the lobby's rank decides
  st.rk = !!s.rk;
  // the game mode (he asked: Quick Match, Unranked, Ranked on the menu): a friend can change it, so the page title follows the lobby
  if (s.md && MODE_TAB[curPage]) { if (st.wantMode && s.md !== st.wantMode && s.ph === PHASE.LOBBY && !st.modeSent) { st.modeSent = 1; send({ t: 'lobby', a: 'mode', id: st.wantMode }); } else if (s.md === st.wantMode) st.wantMode = null; /* done: after this a friend may change it */ setText('pageTitle', (MODES[s.md] || MODES.quick).name); st.lastMode = s.md; }
  // the address friends type to join (the first network card is the wired one)
  if (st.addr === undefined || (st.addrT && performance.now() - st.addrT > 3000)) { st.addr = st.addr || null; st.addrT = performance.now(); fetch('/api/addr').then(r => r.json()).then(a => { st.addr = a; }).catch(() => { setTimeout(() => { st.addr = undefined; }, 3000); }); }
  const u = st.addr && !st.addr.local && st.addr.urls[0], jt = !u ? '' : `Hosting · code ${showCode(u.code)} · friends click JOIN A GAME and type it${u.homelab ? '' : ' · homelab VPN off: home network only'}`;
  setText('hostCode', u ? 'CODE ' + showCode(u.code) : 'Let friends join');
  if ($('joinAddr').textContent !== jt) $('joinAddr').textContent = jt;
  for (const b of ['lanBtn', 'pLan']) $(b).classList.toggle('hidden', !!(st.addr && st.addr.local)); // the program's PLAY: this computer only, nobody to invite
  { const ffa = MODES[s.md] && MODES[s.md].kind !== 'siege'; $('mapPick').classList.toggle('hidden', s.md === 'zombies'); document.querySelector('#room .vs').classList.toggle('hidden', s.md === 'zombies'); // fun modes pick their own sides: the two lists are just players
    setText(document.querySelector('#sq0 h3'), ffa ? 'PLAYERS' : 'TEAM ALPHA'); setText(document.querySelector('#sq1 h3'), ffa ? 'PLAYERS' : 'TEAM BRAVO'); }
  for (const sq of [0, 1]) {
    const ul = document.querySelector(`#sq${sq} ul`);
    const list = s.players.filter(p => p.sq === sq);
    const html = list.map(p => `<li class="${p.id === s.you ? 'me' : ''}"><span>${esc(p.n)}</span>${p.b ? '<span class="bot">BOT</span>' : rankTag(p.rn)}</li>`).join('') +
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
// Unranked / Ranked bans (he asked, like R6): before round 1 the teams take turns banning an attacker or a defender.
// On your team's turn you see every operator of that side and click one to ban it (the first click on the team counts);
// otherwise you see who is banning. Banned operators are shown in two rows the whole time.
function banPick(s) {
  const el = $('banPick'), me = st.me, q = s.bq, bans = s.bn || [];
  el.classList.toggle('hidden', !q || !me);
  if (!q || !me) return;
  const [sq, sd, left, i, n] = q, ours = sq === me.sq, team = x => x === me.sq ? 'YOUR TEAM' : 'THE ENEMY', banned = new Set(bans.map(b => b[0]));
  const key = [i, ours, bans.map(b => b[0]).join()].join('|');
  if (el.dataset.k !== key) {
    el.dataset.k = key;
    const row = side => bans.filter(b => OPERATORS[b[0]] && OPERATORS[b[0]].team === side).map(b => `<div class="bpBan"><canvas width="90" height="90" data-op="${b[0]}"></canvas><b>${esc(OPERATORS[b[0]].name)}</b><span>${b[1] === me.sq ? 'YOURS' : 'THEIRS'}</span></div>`).join('') || '<span class="hint">none yet</span>';
    el.innerHTML = `<div class="bpTop"><small>BAN PHASE · ${i + 1} / ${n}</small><b class="${ours ? 'ours' : ''}">${ours ? 'YOUR TEAM: BAN' : 'THE ENEMY IS BANNING'} ${sd === 'atk' ? 'AN ATTACKER' : 'A DEFENDER'}</b><span class="bpTime"></span></div>` +
      (ours ? `<p class="hint">Click the operator you don't want anyone to play this match. If nobody on your team picks before the clock runs out, there is no ban.</p><div class="bpGrid">${opsForTeam(sd).filter(o => !banned.has(o)).map(o => `<button data-op="${o}"><canvas width="120" height="120" data-op="${o}"></canvas><b>${esc(OPERATORS[o].name)}</b><span>${esc(OPERATORS[o].role)}</span></button>`).join('')}</div>`
        : `<p class="hint bpWait">Waiting for the enemy team to choose…</p>`) +
      `<div class="bpRows"><div><h4>ATTACKERS BANNED</h4><div class="bpRow">${row('atk')}</div></div><div><h4>DEFENDERS BANNED</h4><div class="bpRow">${row('def')}</div></div></div>`;
    for (const c of el.querySelectorAll('canvas')) portraitCached(c, c.dataset.op);
    for (const b of el.querySelectorAll('.bpGrid button')) b.onclick = () => { audio.ui('lock'); send({ t: 'ban', op: b.dataset.op }); };
    if (i > 0) audio.ui('lock');
  }
  setText(el.querySelector('.bpTime'), String(Math.ceil(left)));
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
      info.innerHTML = `<div class="nm">${o.name}</div><div class="role">${o.role}</div><div class="ab">${o.ability.name}</div><div class="more">${esc(o.ability.desc)}</div>`;
      d.appendChild(info);
      d.onmouseenter = () => { if (!document.querySelector('#opgrid .op.mine')) showSelLoadout(k, false); };
      d.onclick = () => { send({ t: 'pick', op: k }); };
      grid.appendChild(d);
    }
    st.loShown = null;
    if (grid.firstChild) showSelLoadout(grid.firstChild.dataset.op, false);
  }
  const mates = s.players.filter(p => p.sq === me.sq);
  // roles (he asked; a small icon left of each name, he asked too): choose one first, then only its operators are shown. Counts show how many teammates took each.
  const jobs = JOBS[side], myJob = me.jb, rb = $('roleBar');
  const rk = [s.rd, side, myJob, me.lk, ...mates.map(p => p.jb), (s.bn || []).length].join(':'), isBan = o => !!(s.bn && s.bn.some(b => b[0] === o));
  if (rb.dataset.k !== rk) {
    rb.dataset.k = rk; rb.classList.toggle('choose', !myJob);
    rb.innerHTML = (myJob ? '' : '<div class="rbHead">CHOOSE YOUR ROLE</div>') + jobs.map(j => {
      const n = mates.filter(p => p.jb === j.id).length;
      return `<button data-r="${j.id}" class="${myJob === j.id ? 'on' : ''}" title="${esc(j.desc)}"><b>${roleIcon(j.id)}${j.name.toUpperCase()}</b>${n ? `<i>${n}</i>` : ''}`
        + (myJob ? '' : `<span>${esc(j.desc)}</span><small>${j.ops.map(o => isBan(o) ? `<s>${OPERATORS[o].name.toUpperCase()}</s>` : OPERATORS[o].name.toUpperCase()).join(' · ')}</small>`) + '</button>';
    }).join('');
    for (const b of rb.querySelectorAll('button')) b.onclick = () => { if (st.me && st.me.lk) return; audio.ui(); send({ t: 'role', r: b.dataset.r }); };
  }
  $('opgrid').classList.toggle('hidden', !myJob);
  for (const d of document.querySelectorAll('#opgrid .op')) d.classList.toggle('hidden', !!myJob && jobOf(d.dataset.op) !== myJob);
  for (const d of document.querySelectorAll('#opgrid .op')) {
    const who = mates.find(p => p.op === d.dataset.op);
    const mineNow = !!who && who.id === me.id;
    if (mineNow && !d.classList.contains('mine')) { d.classList.add('locked'); audio.ui('lock'); setTimeout(() => d.classList.remove('locked'), 700); }
    d.classList.toggle('mine', mineNow);
    if (mineNow) showSelLoadout(d.dataset.op, true);
    d.classList.toggle('taken', !!who && who.id !== me.id);
    d.classList.toggle('banned', !!(s.bn && s.bn.some(b => b[0] === d.dataset.op)));
    d.querySelector('.who').textContent = who ? who.n : '';
    d.querySelector('.who').style.display = who ? '' : 'none';
  }
  if (st.loDirty && st.loShown && !document.querySelector('#opgrid .op.mine')) showSelLoadout(st.loShown, false);
  $('selSide').textContent = `ROUND ${s.rd} — ${side === 'atk' ? 'ATTACK' : 'DEFENCE'}`;
  $('selSide').style.color = side === 'atk' ? '#ffb27a' : '#8fc8ff';
  const site = st.map.sites[s.site];
  const spawns = st.map.atkSpawns, mySpawn = spawns[me.spn] || spawns[0];
  const sc = $('siteChoice'), used = s.su || [], sk = side === 'def' ? s.rd + ':' + s.site + ':' + used.join() : 'atk:' + s.rd + ':' + me.spn + ':' + (me.sr ? 1 : 0);
  if (sc.dataset.k !== sk) {
    sc.dataset.k = sk;
    // defenders pick the site; each attacker picks where they start (he asked)
    sc.innerHTML = side === 'def' ? '<span>CHOOSE THE SITE TO DEFEND</span>' + st.map.sites.map((x, i) => used.includes(i) && i !== s.site ? `<button data-n="${i}" class="used" disabled title="Already played this match">${esc(x.name)}</button>` : `<button data-n="${i}" class="${i === s.site ? 'on' : ''}">${esc(x.name)}</button>`).join('')
      : '<span>CHOOSE YOUR SPAWN</span>' + `<button data-n="-1" class="${me.sr ? 'on atk' : 'atk'}" title="The team spreads out: usually two groups and one player on their own">RANDOM</button>` // the default (he asked)
        + spawns.map((x, i) => `<button data-n="${i}" class="${!me.sr && i === me.spn ? 'on atk' : 'atk'}">${esc(x.name)}${me.sr && i === me.spn ? ' ✓' : ''}</button>`).join('');
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
  lb.textContent = me.lk ? 'LOCKED IN' : me.op ? 'LOCK IN' : me.jb ? 'PICK AN OPERATOR' : 'CHOOSE A ROLE';
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

// The attackers found the objective (he asked: make it obvious, it's a massive deal): a big alert with the two bomb
// rooms, their floor, and a picture of that floor with the rooms lit up and where you are, for about 6 seconds.
function siteFound(s) {
  const m = st.map, site = m && m.sites[s.site]; if (!site) return;
  const box = $('siteFound'), c = box.querySelector('canvas'), g = c.getContext('2d');
  const fl = Math.max(0, floorAt(m, site.bombs[0].x, site.bombs[0].y)), F = m.floors[fl];
  const flNames = [...new Set(site.bombs.map(b => m.floors[Math.max(0, floorAt(m, b.x, b.y))].name))];
  box.querySelector('.sfS').textContent = site.bombs.map(b => `${b.id}: ${b.room}`).join('   ·   ');
  box.querySelector('.sfF').textContent = `BOMB ON ${flNames.join(' & ')}`; // the floor first and biggest (he asked)
  { const myF = st.me && st.me.a ? m.floors[Math.max(0, floorAt(m, st.pred.x, st.pred.y))] : null, bf = m.floors[fl];
    box.querySelector('.sfY').textContent = !myF ? '' : myF === bf ? 'YOU ARE ON THIS FLOOR' : `YOU ARE ON ${myF.name} · ${m.floors.indexOf(bf) > m.floors.indexOf(myF) ? 'GO UP ▲' : 'GO DOWN ▼'}`; }
  // the floor plan: walls light, floors dark, the bomb rooms gold
  let x0 = m.W, y0 = m.H, x1 = 0, y1 = 0;
  for (let k = 0; k < m.tiles.length; k++) if (m.flAt[k] === fl && m.tiles[k] !== T.VOID && m.tiles[k] !== T.GROUND) { const x = k % m.W, y = (k / m.W) | 0; if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  x0 -= 2; y0 -= 2; x1 += 2; y1 += 2;
  const sc = Math.min(c.width / (x1 - x0 + 1), c.height / (y1 - y0 + 1)), ox = (c.width - (x1 - x0 + 1) * sc) / 2, oy = (c.height - (y1 - y0 + 1) * sc) / 2;
  g.fillStyle = '#0b0e12'; g.fillRect(0, 0, c.width, c.height);
  const inSite = (x, y) => m.rooms.some(r => site.rooms.includes(r.name) && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (x < 0 || y < 0 || x >= m.W || y >= m.H) continue;
    const k = y * m.W + x, t = m.tiles[k]; if (m.flAt[k] !== fl) continue;
    g.fillStyle = t === T.HARD || t === T.SOFT || t === T.REINF || t === T.PANEL ? '#9aa3ad' : t === T.GROUND ? '#1d2a22' : t === T.VOID || (t === T.LOW && m.floor[k] === FL.VOID) ? '#0b0e12'
      : t === T.STAIR ? '#5a616b' : t === T.OPEN || t === T.BARRI ? '#8a6a44' : inSite(x, y) ? '#7a6224' : '#2c333b';
    g.fillRect(ox + (x - x0) * sc, oy + (y - y0) * sc, Math.ceil(sc), Math.ceil(sc));
  }
  const P = (wx, wy) => ({ x: ox + (wx / CELL - x0) * sc, y: oy + (wy / CELL - y0) * sc });
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const b of site.bombs) {
    if (floorAt(m, b.x, b.y) !== fl) continue;
    const q = P(b.x, b.y);
    g.fillStyle = '#f2c14e'; g.beginPath(); g.arc(q.x, q.y, 9, 0, 7); g.fill(); g.lineWidth = 2; g.strokeStyle = '#000'; g.stroke();
    g.fillStyle = '#000'; g.font = '800 12px Barlow Condensed, sans-serif'; g.fillText(b.id, q.x, q.y + 1);
  }
  const me = st.me;
  if (me && me.a && floorAt(m, st.pred.x, st.pred.y) === fl) { const q = P(st.pred.x, st.pred.y); g.fillStyle = '#3aa0ff'; g.beginPath(); g.arc(q.x, q.y, 6, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); g.font = '700 13px Barlow Condensed, sans-serif'; g.fillStyle = '#fff'; g.fillText('YOU', q.x, q.y - 14); }
  g.textBaseline = 'alphabetic';
  box.classList.remove('hidden', 'out'); void box.offsetWidth; box.classList.add('show');
  audio.ui('level');
  clearTimeout(st.foundT); st.foundT = setTimeout(() => { box.classList.add('out'); setTimeout(() => box.classList.add('hidden'), 600); }, 3500); // shorter (he asked)
}

// Compass to the bomb site (he asked): once the objective is found (defenders always know it), a dial under the score
// bar points along the walking route to the site rooms — not straight through walls — and when that route goes
// up or down it points to the stairs (or hatch) instead and says which way. The route is a breadth-first search over
// what your team knows of the map (st.known), recomputed a few times a second.
const WALKISH = new Set([T.FLOOR, T.GROUND, T.STAIR, T.OPEN, T.HATCH, T.HATCHR, T.HOLE, T.BARRI, T.RUBBLE]);
// screen effects over the whole view: being scanned, hurt (with the direction it came from, `from` = angle on screen),
// dazed, down, flashed. Drawn on #over, or on the 3D rope view's own layer (#r3fx) while that view is up.
function screenFx(c, me, now, from) {
  const W = c.canvas.width, H = c.canvas.height;
  if (me && me.a && me.sc) { c.fillStyle = 'rgba(70,90,255,0.12)'; c.fillRect(0, 0, W, H); }
  const hurtK = Math.max(0, 1 - (now - st.hurtT) / 0.8);
  if (hurtK > 0 && fxOn('hurt')) {
    const g = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8);
    g.addColorStop(0, 'rgba(160,0,0,0)'); g.addColorStop(1, `rgba(160,0,0,${0.45 * hurtK})`);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.save(); c.translate(W / 2, H / 2); c.rotate(from);
    c.fillStyle = `rgba(255,40,40,${0.8 * hurtK})`; c.beginPath(); c.moveTo(H * 0.2, -22 * DPR); c.lineTo(H * 0.24, 0); c.lineTo(H * 0.2, 22 * DPR); c.closePath(); c.fill();
    c.restore();
  }
  if (now < (st.dazeUntil || 0)) { const k = Math.min(1, st.dazeUntil - now); c.fillStyle = `rgba(210,190,140,${0.12 * k})`; c.fillRect(0, 0, W, H); fx.shake = Math.max(fx.shake, 1.2 * k); }
  if (me && me.a && me.dn) { c.fillStyle = 'rgba(90,0,0,0.25)'; c.fillRect(0, 0, W, H); }
  const fl = st.flashUntil - now;
  if (fl > 0) { c.fillStyle = `rgba(255,255,255,${Math.min(1, fl / 1.2)})`; c.fillRect(0, 0, W, H); }
}
// the hit marker (an X round the crosshair, red for a kill) and the points popups under it, at (x, y) on canvas c
function hitMark(c, x, y, now) {
  const hk = 1 - (now - st.hitT) / 0.18;
  if (!(hk > 0 && fxOn('hit'))) return;
  c.strokeStyle = st.hitKill ? `rgba(255,60,60,${hk})` : `rgba(255,255,255,${hk})`; c.lineWidth = 2 * DPR;
  c.beginPath();
  for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { c.moveTo(x + dx * 5 * DPR, y + dy * 5 * DPR); c.lineTo(x + dx * 11 * DPR, y + dy * 11 * DPR); }
  c.stroke();
}
function ptsPopups(c, x, y, now) {
  if (!(st.ptsPops && st.ptsPops.length && fxOn('pts'))) return;
  st.ptsPops = st.ptsPops.filter(q => now - q.t < 2.4);
  c.textAlign = 'center'; c.textBaseline = 'top';
  st.ptsPops.slice().reverse().forEach((q, i) => {
    const age = now - q.t, a = Math.min(1, age * 6) * Math.min(1, (2.4 - age) / 0.5), yy = y + (34 + i * 17) * DPR - Math.max(0, 0.15 - age) * 60 * DPR;
    c.globalAlpha = a; c.font = `700 ${(i ? 13 : 15) * DPR}px Barlow Condensed, sans-serif`;
    const t = q.n ? `${q.n > 0 ? '+' : ''}${q.n}  ${q.w}` : q.w; // n 0: a note (fun modes: NEXT GUN, +1 BULLET)
    c.lineWidth = 3 * DPR; c.strokeStyle = 'rgba(0,0,0,0.75)'; c.strokeText(t, x, yy);
    c.fillStyle = q.n >= 0 ? '#f2c14e' : '#ff5a5a'; c.fillText(t, x, yy);
  });
  c.globalAlpha = 1; c.textBaseline = 'alphabetic';
}

// ---- the 3D rope view (rope3d.js) ----
// On for an attacker hanging on (or climbing) a rope; leaving it glides the camera back up to the top-down view over
// R3_OUT s (inside the climb-in), so you can shoot as soon as you're through.
const R3_OUT = 0.45, FH3 = 3.2 * PX_PER_M;
// which way the wall is for someone hanging at (p.x, p.y): the rope stretch they are on, facing it
function hangWall(p) { for (const q of st.map.ropes || []) { const sx = Math.max(q.a, Math.min(q.b, (p.x - q.hang.x) * q.tx + (p.y - q.hang.y) * q.ty)); if (Math.hypot(q.hang.x + q.tx * sx - p.x, q.hang.y + q.ty * sx - p.y) < 4 && floorAt(st.map, p.x, p.y) === q.f) return q.out + Math.PI; } return undefined; }
function r3on() { const me = st.me; return !!(me && me.ro && me.a && !me.dn && me.tm === 'atk' && me.ct === 'body' && !st.tv && st.map && st.map.ropes); }
// Does your side see this (the 3D rope view shows only what the top-down view would show you)? Own side's shots always.
function r3sees(shooter, x, y, x2, y2) {
  if (!st.r3last && !r3on()) return false;
  if (shooter && st.me && shooter.tm === st.me.tm) return true;
  return teamSees(x, y) || (x2 !== undefined && teamSees(x2, y2));
}
// What the 3D rope view needs of the gadgets, drones, cameras, smoke and decoys: the same ones the top-down view would
// draw for you (your side's always, the other side's only where your side sees them, hidden traps only within 2 m).
// Each gadget comes with a little top-down picture of it (drawn by the same code as the map), redrawn ten times a second.
const R3_PIC = 64, R3_PIC_W = 40; // canvas px, world px across
function r3things(s, me, now, near) {
  const m = st.map, side = me.tm, out = [], smoke = [], decoys = [], pics = st.r3pics || (st.r3pics = new Map()), keep = new Set();
  for (const e0 of s.ents) {
    const e = interp(e0.id, 'ents') || e0, ally = e.tm === side, f = floorAt(m, e.x, e.y); if (f < 0) continue;
    if (!near(e.x, e.y, f)) continue;
    if (e.ty === 'smoke' || e.ty === 'gascloud') {
      if (e.ty === 'gascloud' && !ally && !teamSees(e.x, e.y)) continue;
      const col = e.ty === 'gascloud' ? '#96c846' : '#cdcdc8';
      if (e.pf) for (let i = 0; i < e.pf.length; i += 2) smoke.push({ x: e.pf[i], y: e.pf[i + 1], r: e.r, f, col, id: e.id + ':' + i, l: e.l });
      else smoke.push({ x: e.x, y: e.y, r: e.r, f, col, id: e.id, l: e.l });
      continue;
    }
    if (e.ty === 'swarm' || (e.ty === 'drone' && e.id === me.did)) continue;
    if (e.ty === 'decoy') { if (ally || teamSees(e.x, e.y)) decoys.push({ id: 'd' + e.id, op: e.op, x: e.x, y: e.y, f, ag: e.ag || 0, w: e.w, pose: 'stand' }); continue; }
    if (TRAPS.has(e.ty) && !ally && Math.hypot(e.x - st.pred.x, e.y - st.pred.y) >= TRAP_SEEN) continue;
    if (!ally && !teamSees(e.x, e.y)) continue;
    let P = pics.get(e.id);
    if (!P) { const cv = document.createElement('canvas'); cv.width = cv.height = R3_PIC; P = { cv, t: -9 }; pics.set(e.id, P); }
    if (now - P.t > 0.1) { // (the picture: blinking lights, turning drones)
      const c = P.cv.getContext('2d'), k = R3_PIC / R3_PIC_W; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, R3_PIC, R3_PIC);
      c.setTransform(k, 0, 0, k, R3_PIC / 2 - e.x * k, R3_PIC / 2 - e.y * k);
      if (e.ty === 'drone') drawDrone(c, { ...e, ag: e.ag || 0, wheel: 0, spd: 0, mvAng: e.ag || 0, sway: 0 }, now, ally);
      else if (e.ty === 'bird') drawBird(c, { ...e, ag: e.ag || 0, fl: 0 }, now, ally);
      else if (e.ty === 'cam') drawCam(c, e, now, ally);
      else drawGadget(c, e, now, ally);
      P.t = now; P.dirty = true;
    }
    keep.add(e.id);
    out.push({ id: e.id, ty: e.ty, x: e.x, y: e.y, f, ally, pic: P, wall: e.ty === 'cam' || e.ty === 'scope' || (e.ty === 'bird' && !!e.pe), fly: e.ty === 'bird' && !e.pe });
  }
  for (const id of pics.keys()) if (!keep.has(id)) pics.delete(id);
  return { ents: out, smoke, decoys };
}
// a piece of the map picture (world px x, y, w, h) on a new W × H canvas: the 3D rope view's floors and ground are the
// same picture as the top-down map
function r3pic(x, y, w, h, W, H) {
  const R = st.rend; if (!R || !R.c) return null;
  const k = R.c.width / R.Wp, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d', { willReadFrequently: true }); c.fillStyle = '#4f6a3e'; c.fillRect(0, 0, W, H); // (off the map's edge: grass)
  R.c.drawTo(c, x * k, y * k, w * k, h * k, 0, 0, W, H);
  return cv;
}
// the 3D rope view's own layer over the 3D picture: pings, hit marker, points, screen effects (hurt, flash, daze)
function r3overlay(me, now, show) {
  let cv = $('r3fx');
  if (!cv) { if (!show) return; cv = document.createElement('canvas'); cv.id = 'r3fx'; document.body.insertBefore(cv, $('ui')); }
  cv.style.display = show ? 'block' : 'none'; if (!show) return;
  const W = Math.round(innerWidth * DPR), H = Math.round(innerHeight * DPR);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const c = cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H);
  // pings: where they are in the 3D view, kept inside the screen edge
  const m = st.map, pad = 46 * DPR;
  if (st.marks) for (const k of st.marks) {
    if (now - k.t >= 6) continue;
    const P = rope3d.project(k.x, k.y, floorAt(m, k.x, k.y), 1.0); if (!P) continue;
    let x = P.x * DPR, y = P.y * DPR; if (P.behind) { x = W - x; y = H - pad; }
    x = Math.max(pad, Math.min(W - pad, x)); y = Math.max(pad + 60 * DPR, Math.min(H - pad - 60 * DPR, y));
    drawPing(c, k, x, y, now - k.t, DPR, k.by + ' · ' + Math.round(Math.hypot(k.x - st.pred.x, k.y - st.pred.y) / PX_PER_M) + ' m');
  }
  hitMark(c, W / 2, H / 2, now); ptsPopups(c, W / 2, H / 2, now);
  screenFx(c, me, now, st.hurtFrom - rope3d.facing() - Math.PI / 2); // (the arrow: which way it came from, as you face)
}
function rope3dFrame(s, me, now, dt) {
  const m = st.map, on = r3on();
  if (!st.r3shots) { st.r3shots = []; st.r3booms = []; }
  if (!on && !st.r3last) { $('r3x').classList.add('hidden'); st.r3shots.length = 0; st.r3booms.length = 0; if (st.r3full) { st.r3full = false; r3overlay(me, now, false); } return; }
  let c;
  if (on) {
    const ro = me.ro, R = m.ropes, ease = q => q * q * (3 - 2 * q);
    const ri = ro[0] ? ro[1] : ro[2] >= 0 ? ro[2] : ro[6] >= 0 ? ro[6] : st.r3rope; if (ri === undefined || !R[ri]) return;
    const r = R[ri]; st.r3rope = ri;
    const lvl = i => i >= 0 && R[i] ? R[i].lvl * FH3 : null, roofH = (m.floors.length - 1 - m.groundFloor) * FH3;
    let h;
    if (ro[0]) h = r.lvl * FH3;
    else { const from = ro[6] === -1 ? 0 : lvl(ro[6]) ?? st.r3h ?? 0, to = ro[2] >= 0 ? lvl(ro[2]) : ro[4] ? roofH : 0; h = from + (to - from) * ease(Math.min(1, ro[3])); }
    st.r3h = h;
    const pf = floorAt(m, st.pred.x, st.pred.y), o = pf >= 0 && pf !== r.f ? floorOff(m, pf, r.f) : { x: 0, y: 0 };
    const pred = { x: st.pred.x + o.x, y: st.pred.y + o.y };
    const people = [];
    for (const sp of s.players) {
      if (sp.id === me.id || !sp.a || sp.sg) continue;
      const p = interp(sp.id, 'players'); if (!p || p.x === undefined) continue;
      const f = floorAt(m, p.x, p.y); if (f < 0) continue;
      const q = f !== r.f ? floorOff(m, f, r.f) : { x: 0, y: 0 }; if (Math.hypot(p.x + q.x - pred.x, p.y + q.y - pred.y) > 30 * PX_PER_M) continue;
      if (sp.sq !== me.sq && (sp.sh ? !teamSeesBody(p.x, p.y) : !teamSees(p.x, p.y))) continue; // only who your side can see: the same lines both ways (HUSH's shroud: eyes only)
      people.push({ id: sp.id, op: sp.op, x: p.x, y: p.y, f, ag: p.ag || 0, w: sp.w, onRope: !!sp.rp, pose: sp.dn || sp.pn ? 'down' : sp.rp === 3 ? 'hangInv' : sp.rp ? 'hang' : sp.cr ? 'crouch' : 'stand' });
    }
    const near = (x, y, f) => { const q = f !== r.f ? floorOff(m, f, r.f) : { x: 0, y: 0 }; return Math.hypot(x + q.x - pred.x, y + q.y - pred.y) < 30 * PX_PER_M; };
    const th = r3things(s, me, now, near); people.push(...th.decoys);
    c = { m, me, s, pred, rope: r, height: h, inv: !!ro[5], people, ents: th.ents, smoke: th.smoke, pic: r3pic, shots: st.r3shots, booms: st.r3booms, now, dt, ads: !!me.ad, shake: fx.shake || 0, leaving: null };
    st.r3last = c; st.r3leaveT = null;
  } else { // gliding back out
    if (st.r3leaveT == null) { st.r3leaveT = now; const d = 3.5 * PX_PER_M; aimOff = { x: Math.cos(st.aim) * d, y: Math.sin(st.aim) * d }; st.r3aim = null; } // the top-down crosshair: a few metres ahead the way you faced
    const q = (now - st.r3leaveT) / R3_OUT;
    if (q >= 1) { rope3d.stop(); st.r3last = null; st.r3leaveT = null; st.r3full = false; r3overlay(me, now, false); $('world').style.visibility = ''; $('r3x').classList.add('hidden'); return; }
    c = { ...st.r3last, now, dt, shots: st.r3shots, booms: st.r3booms, shake: fx.shake || 0, leaving: q };
  }
  rope3d.frame(c); st.r3shots.length = 0; st.r3booms.length = 0;
  const full = on && rope3d.active();
  st.r3full = full && now - (st.r3start ?? now) > 0.2; r3overlay(me, now, st.r3full);
  if (!on) st.r3start = null; else if (st.r3start == null) st.r3start = now;
  $('world').style.visibility = full && now - st.r3start > 0.45 ? 'hidden' : ''; // (fully in the 3D view: the top-down picture needn't show)
  $('r3x').classList.toggle('hidden', !full);
}
function compassRoute(s, from) { return sharedRoute(st.map, st.known, s.site, from, st); }
// where your teammates are, in words (he asked): name, room and floor, updated a few times a second
function drawAllies(s, me, now) {
  const box = $('allies'), show = s && me && st.id && !st.tv && (s.ph === PHASE.PREP || s.ph === PHASE.ACTION) && st.map;
  box.classList.toggle('hidden', !show); if (!show || now - (st.alT || 0) < 0.4) return; st.alT = now;
  const mates = s.players.filter(p => p.sq === me.sq && p.id !== st.id);
  const h = mates.map(p => { const o = OPERATORS[p.op]; let where = 'waiting at spawn';
    if (!p.a) where = 'dead'; else if (p.x !== undefined) { const fl = floorAt(st.map, p.x, p.y), F = st.map.floors[Math.max(0, fl)]; where = (roomAt(st.map, p.x, p.y) || 'outside') + (st.map.floors.length > 1 ? ' · ' + F.name : ''); }
    if (p.ct === 'drone') where += ' (on drone)'; else if (p.ct === 'cam') where += ' (on cams)';
    return `<div class="${p.a ? (p.dn ? 'dn' : '') : 'dead'}"><b>${esc(p.n.replace(/^\[\w+\] /, ''))}</b> <i>${o ? esc(o.name) : ''}</i> <span>${esc(where)}</span></div>`; }).join('');
  if (box.innerHTML !== h) box.innerHTML = h;
}
// Attackers (he asked): a warning at the top of the screen while any defender is outside, with who and where
// (the nearest named outside area: the attack spawns are named after them).
function drawOutWarn(s, me) {
  const el = $('outWarn'), ids = s && me && me.tm === 'atk' && (s.ph === PHASE.PREP || s.ph === PHASE.ACTION) ? s.ou || [] : [];
  if (!ids.length) { if (!el.classList.contains('hidden')) el.classList.add('hidden'); st.outN = 0; return; }
  const ps = ids.map(id => s.players.find(p => p.id === id)).filter(p => p && p.x !== undefined);
  const near = p => { let b = null, bd = 1e9; for (const a of st.map.atkSpawns || []) { const d = Math.hypot(a.x - p.x, a.y - p.y); if (d < bd) { bd = d; b = a.name; } } return b; };
  const who = ps.length === 1 ? `${(OPERATORS[ps[0].op] || {}).name || 'DEFENDER'} · NEAR ${(near(ps[0]) || 'THE BUILDING').toUpperCase()}` : ps.map(p => (OPERATORS[p.op] || {}).name || '?').join(', ');
  const html = `⚠ ${ids.length > 1 ? ids.length + ' DEFENDERS' : 'DEFENDER'} OUTSIDE<small>${esc(who)}</small>`;
  if (el.innerHTML !== html) el.innerHTML = html;
  setCls(el, 'hidden', false);
  if (ids.length > (st.outN || 0)) audio.ui('alert');
  st.outN = ids.length;
}
function drawCompass(s, me, now) {
  const box = $('compass');
  const show = fxOn('compass') && s && !s.ar && me && me.a && s.ph === PHASE.ACTION && (me.tm === 'def' || s.rev) && !st.tutorialHideCompass && st.map && st.map.sites[s.site];
  box.classList.toggle('hidden', !show);
  st.cmpDir = null;
  if (!show) return;
  const from = { x: st.pred.x, y: st.pred.y };
  if (!st.cmp || now - st.cmp.t > 0.35 || Math.hypot(from.x - st.cmp.x, from.y - st.cmp.y) > CELL * 2) st.cmp = { t: now, x: from.x, y: from.y, r: compassRoute(s, from) };
  const r = st.cmp.r, c = box.querySelector('canvas'), g = c.getContext('2d'), label = box.querySelector('b');
  g.clearRect(0, 0, 96, 96);
  g.fillStyle = 'rgba(8,11,15,0.78)'; g.beginPath(); g.arc(48, 48, 44, 0, 7); g.fill();
  g.strokeStyle = 'rgba(242,193,78,0.55)'; g.lineWidth = 2; g.stroke();
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(48 + Math.cos(a) * 36, 48 + Math.sin(a) * 36); g.lineTo(48 + Math.cos(a) * 41, 48 + Math.sin(a) * 41); g.stroke(); }
  let text = '';
  if (!r) { text = 'NO ROUTE KNOWN'; st.cmpNoRoute = true; }
  else if (r.here) { text = 'ON SITE'; g.fillStyle = '#f2c14e'; g.beginPath(); g.arc(48, 48, 9, 0, 7); g.fill(); }
  else {
    const k = r.aim, tx = (k % st.map.W + 0.5) * CELL, ty = (Math.floor(k / st.map.W) + 0.5) * CELL;
    const want = Math.atan2(ty - from.y, tx - from.x); // glide the needle so it doesn't jump when the route is worked out again
    st.cmpA = st.cmpA == null || st.cmpNoRoute ? want : st.cmpA + angDiff(want, st.cmpA) * Math.min(1, (now - (st.cmpT || now)) * 10); st.cmpT = now; st.cmpNoRoute = false;
    const a = st.cmpA + (st.rot || 0); st.cmpDir = st.cmpA; // also a small arrow by your character (he asked)
    g.save(); g.translate(48, 48); g.rotate(a);
    g.fillStyle = '#f2c14e'; g.strokeStyle = '#000'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(34, 0); g.lineTo(-10, -15); g.lineTo(-3, 0); g.lineTo(-10, 15); g.closePath(); g.stroke(); g.fill();
    g.restore();
    const m = Math.round(r.cells * CELL / PX_PER_M), ms = Math.round((r.toStairs || 0) * CELL / PX_PER_M);
    text = r.stairs ? `${r.stairs} STAIRS TO ${r.to} · ${ms} m · SITE ${m} m` : `${r.site} · ${m} m`;
  }
  if (label.textContent !== text) label.textContent = text;
}

// Free play's attachments (he asked): a row per gun in your hands, every attachment that fits it; redrawn when the
// snapshot's `ga` (gun:barrel,grip,sight for each held gun) changes
function freeAttDraw() {
  const el = $('freeOps'), A = el && el.querySelector('.foAtt'), ga = (st.me && st.me.ga) || [], k = ga.join('|');
  if (!A || el.classList.contains('hidden') || st.foAttK === k) return; st.foAttK = k;
  A.innerHTML = '<h3>ATTACHMENTS</h3>' + ga.map(x => { const [w, c] = x.split(':'), a = attFromCode(c), ok = attachFor(w);
    return `<div class="foAttGun" data-w="${w}"><div class="foAttPic"><b>${esc(WEAPONS[w].name)}</b></div>` + ATTACH_SLOTS.map(([sl, label]) => `<div class="foSlot"><h4>${label.toUpperCase()}</h4><div>` +
      ok[sl].map(v => `<button data-s="${sl}" data-v="${v}" class="${a[sl] === v ? 'on' : ''}" title="${esc(ATTACH[sl][v].desc)}">${esc(ATTACH[sl][v].short)}</button>`).join('') + `</div><em>${esc(ATTACH[sl][a[sl]].desc)}</em></div>`).join('') + '</div>'; }).join('');
  for (const row of A.querySelectorAll('.foAttGun')) {
    const w = row.dataset.w, a = attFromCode((ga.find(x => x.startsWith(w + ':')) || '').split(':')[1]);
    row.querySelector('.foAttPic').prepend(gunPicture(w, a, 120, 42));
    for (const b of row.querySelectorAll('button')) b.onclick = () => { audio.ui(); send({ t: 'free', a: 'att', w, s: b.dataset.s, v: b.dataset.v }); };
  }
}

// Free play's operator grid (he asked): every operator, attack and defence, by role; click one to switch to it on the spot
function toggleFreeOps(force) {
  const el = $('freeOps'), open = force ?? el.classList.contains('hidden');
  if (!open) { el.classList.add('hidden'); return; }
  if (document.pointerLockElement) document.exitPointerLock();
  const cur = st.me && st.me.op, body = el.querySelector('.foBody');
  body.innerHTML = ['atk', 'def'].map(t => `<div class="foSide"><h3>${t === 'atk' ? 'ATTACK' : 'DEFENCE'}</h3>` + JOBS[t].map(j => `<div class="foRole"><h4>${esc(j.name)}</h4><div class="foOps">` +
    j.ops.map(k => `<button data-op="${k}" class="${k === cur ? 'on' : ''}"><canvas width="72" height="72"></canvas><b>${esc(OPERATORS[k].name)}</b><span>${esc(OPERATORS[k].ability.name)}</span></button>`).join('') + '</div></div>').join('') + '</div>').join('');
  for (const b of body.querySelectorAll('button[data-op]')) {
    portrait(b.querySelector('canvas'), b.dataset.op);
    b.onclick = () => { audio.ui(); send({ t: 'free', a: 'pick', op: b.dataset.op }); el.classList.add('hidden'); };
  }
  { // he asked: change guns freely in free play. Every gun in the game, by type; a pistol goes in the sidearm slot
    const G = el.querySelector('.foGuns'), held = new Set(((st.me && st.me.ga) || []).map(x => x.split(':')[0]).concat(st.me && st.me.w ? [st.me.w] : []));
    const by = {}; for (const [k, w] of Object.entries(WEAPONS)) if (!w.zb) (by[SIDEARMS.has(k) ? 'Sidearm' : CLASS_NAME[w.cls] || w.cls] ||= []).push(k);
    G.innerHTML = '<h3>GUNS</h3>' + Object.entries(by).map(([c, ks]) => `<div class="foCls"><h4>${esc(c.toUpperCase())}</h4><div>` +
      ks.map(k => `<button data-gun="${k}" class="${held.has(k) ? 'on' : ''}"><b>${esc(WEAPONS[k].name)}</b></button>`).join('') + '</div></div>').join('');
    for (const b of G.querySelectorAll('button[data-gun]')) {
      b.prepend(gunPicture(b.dataset.gun, {}, 80, 28));
      b.onclick = () => { audio.ui(); send({ t: 'free', a: 'gun', w: b.dataset.gun }); for (const o of G.querySelectorAll('button.on')) if (SIDEARMS.has(o.dataset.gun) === SIDEARMS.has(b.dataset.gun)) o.classList.remove('on'); b.classList.add('on'); };
    }
    st.foAttK = null; freeAttDraw(); // the menu stays open so attachments can follow (he asked)
  }
  el.querySelector('.close').onclick = () => { audio.ui('back'); el.classList.add('hidden'); };
  for (const b of el.querySelectorAll('[data-fb]')) b.onclick = () => { // he asked: bots and dummies while in free play
    const k = b.dataset.fb; audio.ui();
    send({ t: 'free', a: k === 'clear' ? 'clearBots' : k === 'dummy' ? 'dummy' : 'bot', side: k === 'team' ? 'team' : 'enemy' });
    if (k === 'dummy') el.classList.add('hidden'); // back to the game to see it
  };
  for (const b of el.querySelectorAll('[data-fs]')) { const k = b.dataset.fs, on = () => (st.freeSw || (st.freeSw = { god: true, fire: true }))[k];
    const show = () => { b.textContent = `${k === 'god' ? 'GOD MODE' : 'BOTS SHOOT'}: ${on() ? 'ON' : 'OFF'}`; b.classList.toggle('primary', on()); }; show();
    b.onclick = () => { audio.ui(); st.freeSw[k] = !on(); send({ t: 'free', a: k === 'god' ? 'god' : 'botsFire', on: on() }); show(); }; }
  { const n = (st.last ? st.last.players : []).filter(p => p.b).length; el.querySelector('.foCount').textContent = `${n} bot${n === 1 ? '' : 's'} in the match · up to 9`; }
  el.classList.remove('hidden'); audio.ui('open');
}

function banner(text, sub, color) {
  const b = $('banner'); b.querySelector('.t').textContent = text; b.querySelector('.s').textContent = sub || '';
  b.querySelector('.t').style.color = color || ''; b.classList.add('show'); st.bannerT = performance.now() / 1000 + 3;
}
function addFeed(text) { const d = document.createElement('div'); d.textContent = text; $('feed').appendChild(d); setTimeout(() => d.remove(), 7000); }
// what killed you (he asked: fewer alert marks, more explanation, above all for an ability): shown while you are dead
function deathCard(kc) {
  const c = causeOf(kc.w, kc.kop), K = OPERATORS[kc.kop], who = kc.self ? 'YOURSELF' : esc((kc.kn || 'Unknown').replace(/^\[\w+\] /, '')) + (K ? ` <span>· ${K.name}</span>` : '');
  const tag = c.kind === 'ability' ? `${OPERATORS[c.op].name}'S ABILITY` : c.kind === 'gadget' ? 'GADGET' : c.kind === 'gun' ? '' : '';
  const x = [kc.hs ? '<b>HEADSHOT</b>' : '', kc.wall ? 'THROUGH A WALL' : '', kc.km >= 1 && c.kind === 'gun' ? `${Math.round(kc.km)} M AWAY` : '', kc.team ? '<b>TEAMKILL</b>' : '', kc.dnBy ? `DOWNED BY ${esc(kc.dnBy.replace(/^\[\w+\] /, '').toUpperCase())}` : ''].filter(Boolean);
  return `<div class="dk">KILLED BY ${who}</div><div class="dw">${esc(c.title.toUpperCase())}${tag ? `<i>${tag}</i>` : ''}</div>` +
    (c.text ? `<div class="dt">${esc(c.text)}</div>` : '') + (x.length ? `<div class="dx">${x.join(' · ')}</div>` : '');
}
function addKill(k, v, w, hs, df) {
  if (!v) return;
  const side = mySide(), cls = p => p && p.tm === side ? 'a' : 'e';
  const d = document.createElement('div');
  d.innerHTML = k && k !== v ? `<span class="${cls(k)}">${esc(k.n)}</span><span class="w">${esc(w || '').toUpperCase()}${hs ? ' <b class="hs">✛ HEADSHOT</b>' : ''}</span><span class="${cls(v)}">${esc(v.n)}</span>` : `<span class="${cls(v)}">${esc(v.n)}</span><span class="w">${esc(w || 'DIED').toUpperCase()}</span>`;
  if (df) d.innerHTML += '<span class="w df">◆ DEFUSER</span>'; // the carrier: the defuser is on the floor now
  $('killfeed').appendChild(d); setTimeout(() => d.remove(), 6000);
  while ($('killfeed').children.length > 6) $('killfeed').firstChild.remove();
}
function showEnd(squad) {
  const me = st.me, won = me && me.sq === squad, zbEnd = st.last && st.last.zb;
  const e = $('endscreen'); e.classList.remove('hidden');
  e.querySelector('.t').textContent = zbEnd ? 'GAME OVER' : won ? 'VICTORY' : 'DEFEAT'; e.querySelector('.t').className = 't ' + (won ? 'win' : 'lose');
  const sc = st.last.sc; e.querySelector('.s').textContent = zbEnd ? `YOU REACHED ROUND ${zbEnd.r}` : st.last.ar && st.last.ar.m !== 'infected' ? arenaPlace(st.last, me) : me ? `${sc[me.sq]} — ${sc[1 - me.sq]}` : '';
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
  if (m.mmr) { const d = m.mmr.after - m.mmr.before, el = document.createElement('div'); el.innerHTML = `<span>Ranked ${rankTag(m.mmr.rank)}${m.mmr.rank !== m.mmr.was ? (m.mmr.rank > m.mmr.was ? ' RANK UP' : ' rank down') : ''}</span><b>${d >= 0 ? '+' : ''}${d} MMR (${m.mmr.after})</b>`; $('xpLines').appendChild(el); }
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
// ZOMBIES on screen (server/zombies.js; players carry zb = [0, points, kills, perks, heads, revives], zombies [1, run, look];
// the match carries zb = { r round, left, pw power, g gates open, c crate spot (-1 moving), cb rolling, b between, wb boards })
const ZB_PERKS = { tough: ['IRON HIDE', '#d94a3a', 2500], reload: ['QUICK HANDS', '#5fd08a', 3000], revive: ['SECOND WIND', '#4fb3ff', 1500], rapid: ['DOUBLE BARREL', '#f2c14e', 2000], stride: ['LONG STRIDE', '#e8e070', 2000], blast: ['BLAST PROOF', '#c58bff', 2000] };
const ZB_POW = { ammo: ['MAX AMMO', '#f2c14e', '▤'], insta: ['INSTA-KILL', '#ff5a4a', '☠'], double: ['DOUBLE POINTS', '#5fd08a', '×2'], nuke: ['NUKE', '#ff9d3d', '✹'], carpenter: ['CARPENTER', '#c8a070', '⚒'], firesale: ['FIRE SALE', '#ff6ad5', '$'] };
const zbSolo = s => s.players.filter(p => p.zb && p.zb[0] === 0).length === 1;
function zbStationAt(s, me, x, y) { // the same rules as zbStation in server/zombies.js
  const Z = st.map.zombies, Zs = s.zb, m = st.map, fl = floorAt(m, x, y), near = (p, r) => p && Math.hypot(p.x - x, p.y - y) < r && floorAt(m, p.x, p.y) === fl;
  for (let i = 0; i < Z.gates.length; i++) if (!Zs.g[i] && near(Z.gates[i], 40)) return { k: 'gate', g: Z.gates[i] };
  for (const g of Z.guns) if (near(g, 26)) return { k: 'gun', s: g };
  for (const g of Z.perks) if (near(g, 26)) return { k: 'perk', s: g };
  for (const cs of Zs.fs ? Z.crates : Zs.c >= 0 ? [Z.crates[Zs.c]] : []) if (near(cs, 28)) return { k: 'crate', s: cs };
  if (near(Z.power, 26)) return { k: 'power' };
  if (near(Z.forge, 26)) return { k: 'forge' };
  const W = m.W, cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const k = (cy + dy) * W + cx + dx, oi = m.openId[k]; if (oi >= 0 && m.win[k] && Zs.wb[oi] !== undefined && Zs.wb[oi] < 6) return { k: 'window', oi }; }
  return null;
}
function zbPrompt(s, me, x, y) {
  const t = zbStationAt(s, me, x, y); if (!t) return null;
  const E = `<b>${label('interact')}</b>`, pts = me.zb ? me.zb[1] : 0, $c = n => `<i class="${pts >= n ? '' : 'poor'}">${n}</i>`;
  if (t.k === 'gate') return `${E}OPEN THE ${t.g.name.toUpperCase()} · ${$c(t.g.cost)}`;
  if (t.k === 'gun') { const own = String(me.zb && me.zb[6] || '').split(',').find(g => g.replace('*', '') === t.s.w), has = !!own; return has ? `${E}AMMO FOR THE ${WEAPONS[t.s.w].name.toUpperCase()} · ${$c(own.endsWith('*') ? 4500 : t.s.cost / 2)}` : `${E}BUY THE ${WEAPONS[t.s.w].name.toUpperCase()} · ${$c(t.s.cost)}`; }
  if (t.k === 'perk') { const P = ZB_PERKS[t.s.id], soloQr = t.s.id === 'revive' && zbSolo(s); if (soloQr && s.zb.qr >= 3) return `${P[0]} · USED UP`; if (soloQr && !(me.zb && String(me.zb[3]).split(',').includes('revive'))) return `${E}${P[0]} · ${$c(500)}`; return !s.zb.pw ? `${P[0]} · NEEDS THE POWER ON` : (me.zb && String(me.zb[3]).split(',').includes(t.s.id)) ? `${P[0]} · YOU HAVE IT` : `${E}${P[0]} · ${$c(P[2])}`; }
  if (t.k === 'crate') { const R = s.zb.cr; if (R) return R[0] && R[2] === me.id ? `${E}TAKE THE ${WEAPONS[R[1]].name.toUpperCase()}` : R[0] ? 'SOMEONE ELSE\'S GUN' : 'THE CRATE IS PICKING…'; return `${E}MYSTERY CRATE · A RANDOM GUN · ${$c(s.zb.fs ? 10 : 950)}`; }
  if (t.k === 'power') return s.zb.pw ? 'THE POWER IS ON' : `${E}TURN THE POWER ON`;
  if (t.k === 'forge') { const F = s.zb.fo; if (F) return F[0] && F[2] === me.id ? `${E}TAKE THE FORGED ${WEAPONS[F[1]].name.toUpperCase()}` : 'THE FORGE IS WORKING…'; return !s.zb.pw ? 'THE FORGE · NEEDS THE POWER ON' : `${E}FORGE THIS GUN: DOUBLE DAMAGE, MORE AMMO · ${$c(5000)}`; }
  if (t.k === 'window') return `HOLD ${E}PUT BOARDS BACK · +10 EACH`;
  return null;
}
function zbObjective(s, me) {
  const Z = s.zb;
  if (Z.b) return [`ROUND ${Z.r + 1} IN ${Math.ceil(Z.b)}`, 'Board up the windows, buy what you need'];
  return [`ROUND ${Z.r}`, `${Z.left} zombie${Z.left === 1 ? '' : 's'} left · ${Z.pw ? 'the power is on' : 'the power switch is at the lighthouse'}`];
}
function zbHud(s, me) {
  const el = $('zbHud'); if (!el) return;
  { const tn = performance.now() / 1000, G = st.zg || (st.zg = new Map()); // the dead groan now and then, heard through walls like anything else
    for (const z of s.players) if (z.zb && z.zb[0] === 1 && z.a && z.x !== undefined) { const t0 = G.get(z.id); if (t0 === undefined) G.set(z.id, tn + 1 + Math.random() * 6); else if (tn > t0) { G.set(z.id, tn + 4 + Math.random() * 8); audio.play('groan', z.x, z.y); } } }
  const ps = s.players.filter(p => !(p.zb && p.zb[0] === 1) && p.zb);
  const perks = me && me.zb && me.zb[3] ? String(me.zb[3]).split(',').filter(Boolean) : [];
  setHTML(el, `<div class="zbRound">${s.zb.r}</div><div class="zbPts">${ps.map(p => `<div class="${p.id === s.you ? 'me' : ''}"><span>${esc(p.n.replace(/^\[\w+\] /, ''))}</span><b>${p.zb[1]}</b></div>`).join('')}</div>` +
    `<div class="zbPows">${[['ik', 'insta'], ['dp', 'double'], ['fs', 'firesale']].filter(([f]) => s.zb[f] > 0).map(([f, k]) => `<i style="--pc:${ZB_POW[k][1]}" class="${s.zb[f] < 6 ? 'blink' : ''}">${ZB_POW[k][0]} ${Math.ceil(s.zb[f])}</i>`).join('')}</div>` +
    `<div class="zbPerks">${perks.map(k => `<i style="--pc:${ZB_PERKS[k][1]}" title="${ZB_PERKS[k][0]}">${ZB_PERKS[k][0][0]}</i>`).join('')}</div>`);
}
function zbTable(s) {
  const me = st.me, rows = s.players.filter(p => p.zb && p.zb[0] === 0).sort((a, b) => b.zb[2] - a.zb[2]).map(p => `<tr class="ally ${me && p.id === me.id ? 'me' : ''} ${p.a ? '' : 'dead'}"><td>${esc(p.n)}</td><td>${p.zb[1]}</td><td>${p.zb[2]}</td><td>${p.zb[4]}</td><td>${p.d}</td><td>${p.b ? 'BOT' : p.ms != null ? p.ms + ' ms' : '…'}</td></tr>`).join('');
  return `<table><tr><th>PLAYER</th><th>POINTS</th><th>KILLS</th><th>HEADSHOTS</th><th>DOWNS</th><th>PING</th></tr>${rows}</table>`;
}
// the town's stations, drawn on the map: gate signs, guns on the walls, perk machines, the crate, the power and the Forge
function drawZbWorld(ctx, s, now) {
  const Z = st.map.zombies, Zs = s.zb; if (!Z) return;
  const plate = (x, y, w, h, fill, line) => { ctx.fillStyle = fill; ctx.fillRect(x - w / 2, y - h / 2, w, h); if (line) { ctx.strokeStyle = line; ctx.lineWidth = 0.8; ctx.strokeRect(x - w / 2, y - h / 2, w, h); } };
  const text = (t, x, y, col, size = 5) => { ctx.font = `700 ${size}px Barlow Condensed, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(t, x, y); ctx.fillStyle = col; ctx.fillText(t, x, y); };
  Z.gates.forEach((g, i) => { if (Zs.g[i]) return; plate(g.x, g.y, 30, 10, 'rgba(25,20,15,0.85)', '#c79a3e'); text(`${g.cost}`, g.x, g.y, '#f2c14e', 6); });
  for (const g of Z.guns) { // a chalk outline of the gun on the wall, its price under it
    ctx.save(); ctx.translate(g.x, g.y); ctx.strokeStyle = 'rgba(235,235,225,0.85)'; ctx.lineWidth = 0.7; ctx.setLineDash([1.2, 0.8]);
    ctx.beginPath(); ctx.moveTo(-9, -1); ctx.lineTo(6, -1); ctx.lineTo(9, 0); ctx.lineTo(6, 1); ctx.lineTo(-2, 1); ctx.lineTo(-3, 4); ctx.lineTo(-5, 4); ctx.lineTo(-5, 1); ctx.lineTo(-9, 1.5); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    text(`${WEAPONS[g.w].name} ${g.cost}`, g.x, g.y + 7, 'rgba(240,240,230,0.9)', 4);
  }
  for (const pk of Z.perks) { const P = ZB_PERKS[pk.id], on = Zs.pw;
    if (on) { const gl = ctx.createRadialGradient(pk.x, pk.y, 2, pk.x, pk.y, 20); gl.addColorStop(0, P[1] + '66'); gl.addColorStop(1, P[1] + '00'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(pk.x, pk.y, 20, 0, 7); ctx.fill(); }
    plate(pk.x, pk.y, 13, 9, on ? P[1] : '#4a4a4a', 'rgba(0,0,0,0.7)'); plate(pk.x, pk.y - 1, 9, 3, on ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.12)');
    text(P[0], pk.x, pk.y + 8, on ? P[1] : '#9a9a9a', 4); }
  for (const u of Zs.pu || []) { const P = ZB_POW[u[1]]; if (!P || (u[4] < 6 && Math.floor(now * 4) % 2)) continue; // blinking at the end
    const gl = ctx.createRadialGradient(u[2], u[3], 1, u[2], u[3], 16); gl.addColorStop(0, P[1] + 'aa'); gl.addColorStop(1, P[1] + '00'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(u[2], u[3], 16, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(10,10,10,0.8)'; ctx.beginPath(); ctx.arc(u[2], u[3], 6.5, 0, 7); ctx.fill(); ctx.strokeStyle = P[1]; ctx.lineWidth = 1; ctx.stroke(); text(P[2], u[2], u[3] + 0.4, P[1], 6); }
  for (const [ci, c] of Z.crates.entries()) { if (!(ci === Zs.c || Zs.fs)) continue; const fl = 0.5 + 0.5 * Math.sin(now * 3);
    const gl = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, 34); gl.addColorStop(0, `rgba(120,200,255,${0.25 + fl * 0.15})`); gl.addColorStop(1, 'rgba(120,200,255,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(c.x, c.y, 34, 0, 7); ctx.fill();
    plate(c.x, c.y, 18, 10, '#6b4a2e', '#2b1d10'); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(c.x - 9, c.y - 0.5, 18, 1); text('?', c.x, c.y, '#bfe6ff', 8);
    const R = Zs.cr; if (R && ci === Zs.c) text(R[0] ? WEAPONS[R[1]].name : WEAPONS[CRATE_SHOW[Math.floor(now * 12) % CRATE_SHOW.length]].name, c.x, c.y - 12, R[0] ? '#ffe9a8' : '#ffffff', 6); }
  { const p = Z.power; plate(p.x, p.y, 10, 12, '#3a3f44', '#111'); ctx.fillStyle = Zs.pw ? '#5fd08a' : '#d94a3a'; ctx.fillRect(p.x - 1.5, p.y + (Zs.pw ? -5 : 1), 3, 4); text(Zs.pw ? 'POWER ON' : 'POWER', p.x, p.y + 10, Zs.pw ? '#5fd08a' : '#ddd', 4); }
  { const f = Z.forge, gl = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y, 18); gl.addColorStop(0, Zs.pw ? 'rgba(255,140,40,0.5)' : 'rgba(120,120,120,0.2)'); gl.addColorStop(1, 'rgba(255,140,40,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(f.x, f.y, 18, 0, 7); ctx.fill();
    plate(f.x, f.y, 14, 8, '#2e2e30', '#000'); plate(f.x, f.y, 8, 3, Zs.pw ? '#ff8a3d' : '#555'); text('THE FORGE', f.x, f.y + 8, Zs.pw ? '#ffb27a' : '#aaa', 4);
    if (Zs.fo) text(Zs.fo[0] ? '★ ' + WEAPONS[Zs.fo[1]].name : 'FORGING…', f.x, f.y - 11, '#ffb27a', 6); }
}
const CRATE_SHOW = ['mule', 'ox', 'pike', 'saker', 'sabre', 'trident', 'ferret', 'quill', 'anvil', 'vex50', 'hatchet', 'cyclone'];
// FUN MODES on screen (server/arena.js; players carry ar = [kills, lives, gun step, infected, out of lives])
const AR_GUNS = ['k4', 'wasp', 'breaker', 'mule', 'longbow', 'rook', 'hornet', 'tusk', 'marten', 'ox', 'pike', 'sabre', 'javelin', 'anvil', 'vex50', 'p10']; // (the ladder in server/arena.js)
function arenaRank(s) {
  const m = s.ar.m, k = p => p.ar || [0, 0, 0, 0, 0];
  const key = p => m === 'oitc' ? [k(p)[4] ? 0 : 1, k(p)[1], k(p)[0]] : m === 'gungame' ? [k(p)[2], k(p)[0], -p.d] : [k(p)[3] ? 0 : 1, k(p)[0], 0];
  return [...s.players].sort((a, b) => { const x = key(a), y = key(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return y[i] - x[i]; return 0; });
}
function arenaPlace(s, me) { const r = arenaRank(s), i = me ? r.findIndex(p => p.id === me.id) : -1, n = ['1ST', '2ND', '3RD']; return i < 0 ? '' : `${n[i] || (i + 1) + 'TH'} OF ${r.length}`; }
function arenaGun(lv) { const w = AR_GUNS[lv]; return w ? WEAPONS[w].name : 'KNIFE'; }
function arenaObjective(s, me) {
  const a = me.ar || [0, 0, 0, 0, 0], r = arenaRank(s), lead = r[0], m = s.ar.m;
  if (m === 'oitc') return ['ONE IN THE CHAMBER', `Lives ${a[1]} · Kills ${a[0]} · ${s.players.filter(p => !(p.ar && p.ar[4])).length} still in · a hit or a knife kills, a kill gives a bullet`];
  if (m === 'gungame') return [`GUN ${a[2] + 1} OF ${AR_GUNS.length + 1}: ${arenaGun(a[2]).toUpperCase()}`, `Kills ${a[0]} · Leader ${lead ? lead.n.replace(/^\[\w+\] /, '') + ' on gun ' + ((lead.ar || [0, 0, 0])[2] + 1) : '—'} · a knife kill sends them back a gun`];
  const clean = s.players.filter(p => !(p.ar && p.ar[3])).length;
  return a[3] ? ['INFECTED: CATCH THE SURVIVORS', `${clean} survivor${clean === 1 ? '' : 's'} left · knife them and they join you`] : ['SURVIVE', `${clean} survivor${clean === 1 ? '' : 's'} left · don't let the infected reach you`];
}
function arenaScores(s, me) {
  const m = s.ar.m, a = me.ar || [0, 0, 0, 0, 0];
  if (m === 'infected') { const inf = s.players.filter(p => p.ar && p.ar[3]).length; return [s.players.length - inf, inf]; }
  const v = p => m === 'gungame' ? (p.ar || [0, 0, 0])[2] + 1 : (p.ar || [0])[0];
  return [v(me), Math.max(0, ...s.players.filter(p => p.id !== me.id).map(v))];
}
function arenaTable(s) {
  const me = st.me, m = s.ar.m, col = m === 'oitc' ? 'LIVES' : m === 'gungame' ? 'GUN' : 'STATUS';
  const rows = arenaRank(s).map((p, i) => { const a = p.ar || [0, 0, 0, 0, 0], v = m === 'oitc' ? (a[4] ? 'OUT' : a[1]) : m === 'gungame' ? `${a[2] + 1} · ${esc(arenaGun(a[2]))}` : a[3] ? 'INFECTED' : 'SURVIVOR';
    return `<tr class="${me && p.id === me.id ? 'ally me' : 'enemy'} ${p.a ? '' : 'dead'}"><td>${i + 1}. ${esc(p.n)}</td><td>${v}</td><td>${a[0]}</td><td>${p.d}</td><td>${p.b ? 'BOT' : p.ms != null ? p.ms + ' ms' : '…'}</td></tr>`; }).join('');
  return `<table><tr><th>PLAYER</th><th>${col}</th><th>KILLS</th><th>DEATHS</th><th>PING</th></tr>${rows}</table>`;
}
function scoreTable(s) {
  const me = st.me;
  if (s.zb) return zbTable(s);
  if (s.ar) return arenaTable(s);
  const rows = [...s.players].sort((a, b) => (a.sq - b.sq) || ((b.sc || 0) - (a.sc || 0)) || (b.k - a.k)).map(p =>
    `<tr class="${me && p.sq === me.sq ? 'ally' : 'enemy'} ${p.id === s.you ? 'me' : ''} ${p.a ? '' : 'dead'}"><td>${esc(p.n)}</td><td>${p.op ? OPERATORS[p.op].name : '—'}</td><td>${p.sc || 0}</td><td>${p.k}</td><td>${p.d}</td><td>${p.b ? 'BOT' : p.ms != null ? p.ms + ' ms' : '…'}</td></tr>`).join('');
  return `<table><tr><th>PLAYER</th><th>OPERATOR</th><th>SCORE</th><th>KILLS</th><th>DEATHS</th><th>PING</th></tr>${rows}</table>`;
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
// He asked: no work the screen doesn't need. In the menus the map only drifts slowly behind them, so it is drawn
// 30 times a second, not at the monitor's full rate (60-165); behind a page that covers the screen (Operators,
// Armory, Map Knowledge, Ball Knowledge, Playbook, Profile) it isn't drawn at all, only the menu logic runs 4 times
// a second (so a match starting still shows). Matches, Esports TV and the tutorial are untouched.
const COVER_PAGES = ['opsPage', 'armoryPage', 'mapsPage', 'bkPage', 'playbookPage', 'profilePage'];
let restT = 0;
function menuRest(nowMs) {
  const s = st.last, ph = s ? s.ph : PHASE.LOBBY;
  if (st.tv || !st.map || ph === PHASE.PREP || ph === PHASE.ACTION || ph === PHASE.ROUND_END) return false;
  const covered = COVER_PAGES.some(id => !$(id).classList.contains('hidden'));
  if (nowMs - restT < (covered ? 250 : 32)) return true;
  restT = nowMs;
  if (!covered) return false;
  lastT = nowMs; screens(s, ph, nowMs / 1000); return true;
}
function frame(nowMs) {
  requestAnimationFrame(frame);
  if (menuRest(nowMs)) return;
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
  if (st.tv && me && me.a) { // ride along: their position and aim, smoothed like everyone else's
    const pv = me.ct === 'drone' ? interp(me.did, 'ents') : interp(me.id, 'players');
    if (pv && Number.isFinite(pv.x) && Number.isFinite(pv.y)) { st.pred.x = pv.x; st.pred.y = pv.y; st.pred.vx = pv.vx || 0; st.pred.vy = pv.vy || 0; st.pred.gait = Number.isFinite(pv.gt) ? pv.gt : 0; } // no position for a moment (waiting off the map, just died): keep the last one
    const pa = interp(me.id, 'players'); if (pa && Number.isFinite(pa.ag)) st.aim = st.tvAimS = smoothAng(st.tvAimS, pa.ag, dt);
  }
  let view = null, ctrl = me && me.a ? me.ct : null;
  if (inGame && me && me.a) {
    if (ctrl === 'drone') {
      const b = s.ents.find(e => e.id === me.did && e.ty === 'bird'); // MAGPIE's bird: up in the air (no seeing under tables); landed, it looks out like a camera
      view = b && b.pe ? { x: st.pred.x, y: st.pred.y, ang: st.aim, fov: 1.9, range: 520, near: 6, kind: 'drone', bird: 1 } : { x: st.pred.x, y: st.pred.y, ang: st.aim, fov: Math.PI * 2, range: b ? 260 : 230, near: 0, kind: 'drone', low: !b, bird: b ? 1 : 0 };
    }
    else if (ctrl === 'cam') { const c = s.ents.find(e => e.id === me.fi); if (c) view = feedView(c, me); }
    else { const e = leanPoint(st.map, st.pred.x, st.pred.y, st.aim, st.pred.lo || 0); view = { x: e.x, y: e.y, ang: st.aim, fov: fovFor(me), range: st.longV ? LONG_R : 1100, near: 26, kind: 'body', low: (st.pred.pr || 0) >= 1 }; } // you see from your (leaning) head
  } else if (inGame && me) {
    const mates = s.players.filter(p => p.a && p.sq === me.sq && p.id !== me.id);
    if (mouse.wl > 0) { st.spect++; mouse.wl = 0; }
    if (mates.length) {
      const m = interp(mates[st.spect % mates.length].id, 'players');
      if (m) view = { x: m.x, y: m.y, ang: st.spAimS = smoothAng(st.spAimS, m.ag, dt), fov: fovFor(m), range: 1100, near: 26, kind: 'spect', name: m.n };
    }
  }

  if (st.tv && st.tv.overview) view = null; // the whole-map overview
  // --- input & prediction ---
  pollPad(dt, view);
  aimAssist(dt, view);
  setTouchVisible(playing() && !st.tv && !menuOpen() && !!st.me && $('pause').classList.contains('hidden')); // phone controls only while playing
  if (sliding()) { padAng = wrapAng(slideAim(padAng)); const l = Math.hypot(aimOff.x, aimOff.y), a = slideAim(Math.atan2(aimOff.y, aimOff.x)); aimOff = { x: Math.cos(a) * l, y: Math.sin(a) * l }; }
  padOn = (aimMode !== 'cursor' || gpRecent()) && !!view && (view.kind === 'body' || view.kind === 'drone');
  st.rot = aimMode === 'spin' && padOn && !gpRecent() ? -Math.PI / 2 - padAng : 0; // Rotate: you always face up the screen
  audio.setListenerRot(st.r3full && rope3d.active() ? -Math.PI / 2 - rope3d.facing() : st.rot); // (the 3D rope view: sounds pan the way the 3D camera faces)
  // he asked: no click needed to take the mouse when a match starts. Browsers only allow it soon after a click (any menu
  // click counts; the desktop app's Firefox remembers it for the day, play.sh) or in full screen; else CLICK TO TAKE CONTROL shows
  if (playing() && !st.tv && !isTouch && !menuOpen() && $('pause').classList.contains('hidden') && document.pointerLockElement !== cv && !gpRecent() &&
      document.hasFocus() && (st.autoLockN || 0) < 3 && now - (st.autoLockT || -1e9) > 1.5) { st.autoLockT = now; st.autoLockN = (st.autoLockN || 0) + 1; lockMouse(cv); }
  if (!playing()) st.autoLockN = 0; // a few tries per match; the browser said no: the click-in sign stays
  $('clickIn').classList.toggle('hidden', !(playing() && !st.tv && !menuOpen() && document.pointerLockElement !== cv && !gpRecent() && $('pause').classList.contains('hidden')));
  // Until you click into the game (or after tabbing out) the mouse isn't captured: your aim simply stays where it was.
  // (It used to follow the loose pointer, and the camera sliding after it made everything bounce — he noticed.)
  if (!st.tv && view && (view.kind === 'body' || view.kind === 'drone')) {
    const c = cursor(), mw = screenToWorld(c.x, c.y);
    st.aim = Math.atan2(mw.y - st.pred.y, mw.x - st.pred.x);
    if (sliding()) st.aim = slideAim(st.aim);
    if (r3on() && rope3d.active()) { const a = rope3d.aim(); if (a) { st.aim = a.ang; aimOff = { x: a.x - st.pred.x, y: a.y - st.pred.y }; st.r3aim = a; } } else st.r3aim = null; // the 3D rope view: where its crosshair is
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
  if (!st.tv) { scopeSway(dt, me, now); sendInput(dt, me, ctrl, view, s, now); }

  // --- camera ---
  let cx, cy;
  if (view) {
    cx = view.x; cy = view.y;
    if (view.kind === 'body') {
      // he said the view was "super bouncy" when looking round: the lead used the crosshair's place on SCREEN, which itself
      // moves with the camera (a feedback loop). Crosshair mode now leads from the aim point in the world.
      const fa = !st.tv && padOn && freeAimOn() && !gpRecent() ? freeAimPoint() : null;
      const c = cursor(), mw = st.tv ? { x: st.pred.x + Math.cos(st.aim) * 160, y: st.pred.y + Math.sin(st.aim) * 160 } : fa ? { x: fa.ax, y: fa.ay } : screenToWorld(c.x, c.y); // TV: lead the way they look
      const vh = st.viewH || 400;
      const lx = (mw.x - st.pred.x) * 0.22, ly = (mw.y - st.pred.y) * 0.22, l = Math.hypot(lx, ly), mx = vh * (me && me.ad ? (sniperOn(me) ? 0.5 : scopeOn(me) ? 0.46 : 0.32) : 0.2); // a scope looks further ahead
      let ax = l > mx ? lx / l * mx : lx, ay = l > mx ? ly / l * mx : ly;
      // he asked to always see about as far as someone could shoot you from: down a long sightline the view slides
      // ahead far enough that its far end is on screen (st.sightLead, worked out with the zoom below)
      const sl = st.sightLead || 0, al = Math.hypot(ax, ay);
      if (sl > al) { ax = Math.cos(view.ang) * sl; ay = Math.sin(view.ang) * sl; }
      st.leadV = st.leadV || { x: ax, y: ay }; const kl = 1 - Math.exp(-dt * 2.4); // the lead swings round smoothly (and slowly) when you turn
      st.leadV.x += (ax - st.leadV.x) * kl; st.leadV.y += (ay - st.leadV.y) * kl;
      let lvx = st.leadV.x, lvy = st.leadV.y;
      if (isTouch) { const hw = vh * VW / VH * 0.16, hh = vh * 0.12; lvx = Math.max(-hw, Math.min(hw, lvx)); lvy = Math.max(-hh, Math.min(hh, lvy)); } // phone: you stay near the middle, clear of thumbs and panels
      cx += lvx; cy += lvy;
    }
  } else if (st.tv && inGame) { // TV overview (he asked: it was mostly empty ground): framed on the building, not the whole floor
    const site = st.map.sites[s.site], fi = st.tv.ovFloor >= 0 ? st.tv.ovFloor : Math.max(0, floorAt(st.map, site.bombs[0].x, site.bombs[0].y)), B = tvShotBox(fi, s, site); // the floor where the action is (tvDirector)
    st.tvOv = { f: fi, h: Math.max(B.y1 - B.y0, (B.x1 - B.x0) * VH / VW) * 1.08 };
    cx = (B.x0 + B.x1) / 2; cy = (B.y0 + B.y1) / 2;
  } else { // menus: slow drift over the map
    cx = st.map.W * CELL / 2 + Math.cos(now * 0.05) * 300; cy = st.map.H * CELL / 2 + Math.sin(now * 0.07) * 160;
  }
  { // up or down the stairs (or through a hatch): the camera is carried across to the same spot in the building with
    // you, so it keeps gliding instead of jumping (he asked for smoother floor changes). Floors sit side by side in x.
    const fi = view ? floorAt(st.map, view.x, view.y) : -1, lp = st.lastViewPos;
    if (view && view.kind === 'body' && lp && fi >= 0 && st.camFloor >= 0 && fi !== st.camFloor) {
      const jx = view.x - lp.x, jy = view.y - lp.y, fx = (st.map.floors[fi].gx - st.map.floors[st.camFloor].gx) * CELL;
      if (Math.abs(jx - fx) < CELL * 4 && Math.abs(jy) < CELL * 4) { st.cam.x += jx; st.cam.y += jy; st.camFloor = fi; }
    }
    st.lastViewPos = view ? { x: view.x, y: view.y } : null;
  }
  if (!st.tv && view && (view.kind === 'body' || view.kind === 'drone') && padOn && freeAimOn() && !gpRecent() && st.zoom) { // Crosshair mode: the target keeps
    // you and the crosshair on screen with room past it (he asked), so the view glides there instead of jumping
    const q = freeAimPoint(), hw = VW / 2 / st.zoom, hh = VH / 2 / st.zoom;
    const keepT = (x, y, m) => { cx = Math.min(x + hw - m, Math.max(x - hw + m, cx)); cy = Math.min(y + hh - m, Math.max(y - hh + m, cy)); };
    keepT(st.pred.x, st.pred.y, 80 * DPR / st.zoom); keepT(q.ax, q.ay, AHEAD() * 1.3 / st.zoom); // (80: clear of the corner panels)
  }
  const locked = camLocked(view);
  if (locked) { const t = lockedTarget(dt, view); cx = t.x; cy = t.y; }
  const k = 1 - Math.exp(-dt * 14);
  if (locked) { st.cam.x = cx; st.cam.y = cy; } else
  if (Math.hypot(cx - st.cam.x, cy - st.cam.y) > 420) { st.cam.x = cx; st.cam.y = cy; if (view) st.leadV = null; } // spawned, new round: be there at once
  st.cam.x += (cx - st.cam.x) * k; st.cam.y += (cy - st.cam.y) * k;
  if (view && view.kind !== 'body') { st.cam.x = cx; st.cam.y = cy; }
  // zoom: close in tight rooms, wider outside or when looking down a long sightline
  let want = !view && st.tv && st.tvOv ? st.tvOv.h : 600; // world px shown top to bottom; he asked twice for a closer view
  if (view && (view.kind === 'drone' || view.dr)) want = 240;
  else if (view) {
    let sum = 0;
    for (let i = 0; i < 24; i++) sum += view.kind === 'body' ? edgeSight(view.x, view.y, i / 24 * Math.PI * 2, 700) : castSight(st.map, view.x, view.y, i / 24 * Math.PI * 2, 700, null);
    const avg = sum / 24, aimD = castSight(st.map, view.x, view.y, view.ang, 900, null);
    want = Math.max(240, Math.min(470, avg * 1.15 + 110));
    if (view.kind !== 'body') want = Math.max(want, Math.min(view.kind === 'cam' ? 580 : 520, aimD * (view.kind === 'cam' ? 0.75 : 0.6))); // (a body: farS below, steadier)
    if (view.kind === 'body') {
      // how far you can be seen (and so shot) from in the way you face: the 80th-percentile sightline across your
      // view cone, so one sliver through a doorway doesn't count. It grows quickly and shrinks slowly (no jumpy camera).
      const n = 15, fov = Math.min(view.fov || 1.8, 1.9), ds = [];
      for (let i = 0; i < n; i++) ds.push(edgeSight(view.x, view.y, view.ang - fov / 2 + fov * i / (n - 1), LONG_R));
      ds.sort((a, b) => a - b);
      const far = ds[Math.floor(n * 0.8)];
      st.farS = st.farS === undefined ? far : st.farS + (far - st.farS) * (1 - Math.exp(-dt * (far > st.farS ? 1.2 : 0.6))); // calm outdoors, where sightlines change a lot as you turn
      // the screen must hold you and that far point: its reach along your aim is viewH * e (e from the screen's shape)
      const cA = Math.abs(Math.cos(view.ang)), sA = Math.abs(Math.sin(view.ang));
      const e = Math.min(cA > 0.01 ? VW / VH / 2 / cA : 99, sA > 0.01 ? 0.5 / sA : 99), m1 = 70, m2 = 40;
      // long view (he asked): further than 1.5x what the normal view reaches that way (the biggest room view, 470 tall)
      // opens the view right out; it closes again below 1.3x so it doesn't flicker at the edge
      const norm = Math.max(560, 470 * 2 * e - m1 - m2), sniper = me && me.ad && sniperOn(me);
      st.longV = !st.tv && view.kind === 'body' && (sniper || st.farS > norm * (st.longV ? 1.3 : 1.5));
      want = Math.max(want, Math.min(st.tv ? 520 : st.longV ? LONG_H : 680, (st.farS + m1 + m2) / (2 * e))); // (TV: staring out over a yard shouldn't make a wide, empty shot)
      const reach = (st.viewH || want) * e; // how far the screen reaches from its middle along your aim, right now
      st.sightLead = Math.max(0, Math.min(reach - m1, st.farS - (reach - m2)));
    } else st.sightLead = 0;
  }
  // the room-size zoom only moves for a real change (a new room, a long corridor), not every small turn of
  // your aim, and then settles quickly, so the view isn't always slowly drifting in and out (he asked for less slow panning)
  // A body's view only takes a new size once it has held for ENV_HOLD s (he asked: sweeping your aim past a doorway made the
  // view jump out and back), so a sightline you only pass over doesn't count
  const big = !st.envWant || Math.abs(want - st.envWant) > st.envWant * 0.15;
  st.envBigT = big ? (st.envBigT || 0) + dt : 0;
  if (!st.envWant || (view && view.kind !== 'body') || st.envBigT >= ENV_HOLD) { st.envWant = want; st.envBigT = 0; }
  st.envH = st.envH || st.envWant;
  st.envH += (st.envWant - st.envH) * (1 - Math.exp(-dt * (view && view.kind === 'body' ? 3 : 6))); // a gentle glide, not a pump
  // aiming down sights widens the view, fast (he asked: it used to zoom in, the opposite of what you want); a 2x scope widest
  const adsZ = view && view.kind === 'body' && me && me.ad ? (sniperOn(me) ? 1.5 : scopeOn(me) ? 1.3 : 1.12) : 1;
  st.adsZ = st.adsZ || 1;
  st.adsZ += (adsZ - st.adsZ) * (1 - Math.exp(-dt * 18));
  st.viewH = (locked ? st.camLock.h : st.envH) * st.adsZ;
  st.trackHH = st.viewH * viewMul() / 2; // the normal view's half height: past it the mouse moves the crosshair slower (freeMove)
  // Crosshair mode: the crosshair can go anywhere you can see; if you and it don't fit on screen, the view grows
  // to hold it, and st.reachW (a circle round you, reachOf; on a drone DRONE_PING_R) is how far it can go
  const freeAim = !st.tv && view && (view.kind === 'body' || view.kind === 'drone') && padOn && freeAimOn() && !gpRecent();
  if (freeAim) {
    const q = freeAimPoint(), dr = view.kind === 'drone';
    st.reachW = dr ? DRONE_PING_R : reachOf(me);
    { const l = Math.hypot(aimOff.x, aimOff.y); if (l > st.reachW) { const k = (st.reachW + (dr ? 0 : (l - st.reachW) * Math.exp(-dt * 10))) / l; aimOff = { x: aimOff.x * k, y: aimOff.y * k }; } } // stopped aiming in: it glides back inside (onto a drone: at once)
    const need = Math.min(FIT_MAX, fitBoth(q.ax - st.pred.x, q.ay - st.pred.y));
    // out quickly; back in only once the smaller size has held for 0.5 s, and gently (he asked: on roofs the view pumped
    // in and out as the crosshair passed the edge, which threw the crosshair about on screen)
    st.fitDown = need < (st.fitH || need) * 0.97 ? (st.fitDown || 0) + dt : 0;
    st.fitH = !st.fitH ? need : need > st.fitH ? st.fitH + (need - st.fitH) * (1 - Math.exp(-dt * 8)) : st.fitDown > 0.5 ? st.fitH + (need - st.fitH) * (1 - Math.exp(-dt * 1.5)) : st.fitH;
    if (!locked) st.viewH = Math.max(st.viewH, st.fitH);
  } else st.fitH = 0;
  st.viewH *= viewMul(); // Settings: how much of the map you see (phones start further out)
  st.zoom = VH / st.viewH;
  if (freeAim && !locked) { // keep you and the crosshair on screen: pushing it at the edge slides the view along
    const q = freeAimPoint(), hw = VW / 2 / st.zoom, hh = VH / 2 / st.zoom;
    const keep = (x, y, m) => { st.cam.x = Math.min(x + hw - m, Math.max(x - hw + m, st.cam.x)); st.cam.y = Math.min(y + hh - m, Math.max(y - hh + m, st.cam.y)); };
    // (the camera's target already keeps the room, gliding, above: this only stops it slipping off at the very edge)
    keep(st.pred.x, st.pred.y, 30 * DPR / st.zoom); keep(q.ax, q.ay, AHEAD() * 0.8 / st.zoom); // (the tilt crops the screen edges a little)
  }
  if (view && view.kind === 'cam' && !view.dr) { st.cam.x = view.x + Math.cos(view.ang) * st.viewH * 0.28; st.cam.y = view.y + Math.sin(view.ang) * st.viewH * 0.28; }
  const camPre = { x: st.cam.x, y: st.cam.y };
  { // never look past the edge of the floor you are on (other floors sit beside it in the map grid)
    const fi = view ? Math.max(0, floorAt(st.map, view.x, view.y)) : st.tv && st.tvOv ? st.tvOv.f : 0, F = st.map.floors[fi];
    if (st.camFloor !== fi) { // changed floor: jump straight there
      st.camFloor = fi; if (view) { st.cam.x = cx; st.cam.y = cy; }
    }
    const hw = VW / 2 / st.zoom, hh = VH / 2 / st.zoom, x0 = F.gx * CELL, mw = F.w * CELL, mh = F.h * CELL;
    if (st.rot) { /* a turned view isn't kept inside the floor's edges; the blackout hides what's beyond */ } else
    if (isTouch) { // phone: the view may go a little past the edge so you are never under a thumb at the map's edge
      const ex = hw * 0.55, ey = hh * 0.45;
      const lim = (v, lo, hi) => lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v));
      st.cam.x = lim(st.cam.x, x0 + hw - ex, x0 + mw - hw + ex); st.cam.y = lim(st.cam.y, hh - ey, mh - hh + ey);
    } else {
    st.cam.x = mw > hw * 2 ? Math.max(x0 + hw, Math.min(x0 + mw - hw, st.cam.x)) : x0 + mw / 2;
    if (!st.rot) st.cam.y = mh > hh * 2 ? Math.max(hh, Math.min(mh - hh, st.cam.y)) : mh / 2;
    }
    st.floorRect = [x0, 0, x0 + mw, mh];
    if (st.winViewsOn && st.winBox) { st.winBoxKeep = st.winBox; st.winBoxT = now; } // kept a moment after it ends
    const wb0 = st.winBoxKeep && now - (st.winBoxT || 0) < 0.6 ? st.winBoxKeep : null; // looking down out of a window: the view may go out over the ground below
    const tgt = wb0 ? [Math.min(x0, wb0[0]), Math.min(0, wb0[1]), Math.max(x0 + mw, wb0[2]), Math.max(mh, wb0[3])] : [x0, 0, x0 + mw, mh];
    if (!st.camBox || st.camBoxF !== x0) { st.camBox = tgt.slice(); st.camBoxF = x0; }
    for (let i = 0; i < 4; i++) st.camBox[i] += (tgt[i] - st.camBox[i]) * (1 - Math.exp(-dt * 5)); // glides, never jumps
    const wb = st.camBox[0] < x0 - 1 || st.camBox[1] < -1 || st.camBox[2] > x0 + mw + 1 || st.camBox[3] > mh + 1 ? [st.camBox[0], st.camBox[1], st.camBox[2], st.camBox[3]] : null;
    if (wb && !st.rot) {
      const lo = Math.min(x0, wb[0]) + hw, hi = Math.max(x0 + mw, wb[2]) - hw, tp = Math.min(0, wb[1]) + hh, bt = Math.max(mh, wb[3]) - hh;
      st.cam.x = lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, camPre.x));
      st.cam.y = tp > bt ? (tp + bt) / 2 : Math.max(tp, Math.min(bt, camPre.y));
    }
  }
  if (locked) { st.camLock.x = st.cam.x; st.camLock.y = st.cam.y; } // (after the floor's edge stops it)
  if (freeAim) { // the crosshair always stays on the real screen (he saw it go off): at the floor's edge the camera stops
    // but the crosshair didn't, and the tilt crops the edges, so here the view may pass the edge just enough to show it
    const q = freeAimPoint(), s0 = w2s(q.ax, q.ay), u = onScreen(s0.x, s0.y, locked ? LOCK_EDGE : AHEAD() * 0.7 / DPR);
    if (u.x !== s0.x || u.y !== s0.y) { const w = screenToWorld(u.x, u.y);
      if (locked) aimOff = { x: aimOff.x + w.x - q.ax, y: aimOff.y + w.y - q.ay }; // locked camera: the crosshair stops at the screen edge (and pans the view, lockedTarget)
      else { st.cam.x += q.ax - w.x; st.cam.y += q.ay - w.y; } }
  }
  if (view) { audio.setListener(view.x, view.y); st.listen = { x: view.x, y: view.y }; }

  let t1 = pfa('logic', T0);
  st.viewers = teamViewers(s, view, me, inGame);
  st.pip = stairPeek(view, me, inGame); if (st.pip) st.viewers.push(st.pip);
  revealSeen(); t1 = pfa('viewers', t1);
  bodySounds(me, dt);
  draw(s, view, now, dt); ctx = ctx0;
  rope3dFrame(s, me, now, dt);
  drawOutWarn(st.last, st.me); drawCompass(st.last, st.me, now); drawAllies(st.last, st.me, now);
  pfa('total', T0);
  watchPerf(rawGap, performance.now() - T0);
  perfRep.gaps.push(rawGap); perfRep.work.push(performance.now() - T0);
}
// How smoothly this browser runs, sent to the server every 3 s during a match (read at /api/perf) so slowness on
// a real screen can be looked at; headless test browsers don't use the graphics card, so they can't show it.
const perfRep = { gaps: [], work: [], snaps: [], lastSnap: 0, pf: {} };
setInterval(() => {
  const P = perfRep; if (!P.gaps.length || !playing() && !st.tv) { P.gaps = []; P.work = []; P.snaps = []; return; }
  const q = (a, f) => { const b = a.slice().sort((x, y) => x - y); return +(b[Math.min(b.length - 1, Math.floor(b.length * f))] || 0).toFixed(1); };
  const sec = {}; for (const k in PF) if (k !== 'frames') sec[k] = +(((PF[k] - (P.pf[k] || 0)) / Math.max(1, PF.frames - (P.pf.frames || 0)))).toFixed(2);
  const rep = { t: Date.now(), name: st.profile && st.profile.name, tv: !!st.tv, gfx: gfxLevel(), VW, VH, DPR, fps: +(P.gaps.length / 3).toFixed(1), gapMed: q(P.gaps, 0.5), gap95: q(P.gaps, 0.95), gapMax: q(P.gaps, 1), workMed: q(P.work, 0.5), work95: q(P.work, 0.95), snapMed: q(P.snaps, 0.5), snap95: q(P.snaps, 0.95), snapMax: q(P.snaps, 1), sec, viewers: (st.viewers || []).length, hidden: document.hidden };
  P.pf = { ...PF }; P.gaps = []; P.work = []; P.snaps = [];
  fetch('/api/perf', { method: 'POST', body: JSON.stringify(rep) }).catch(() => {});
}, 3000);
let overDirty = false, fogShown = false;
function showFog(on) { if (on !== fogShown) { fogShown = on; fog.style.visibility = on ? 'visible' : 'hidden'; } }
const PF = { frames: 0 }; function pfa(k, t) { const n = performance.now(); PF[k] = (PF[k] || 0) + n - t; return n; }



function sendInput(dt, me, ctrl, view, s, now) {
  const ev = st.evq; st.evq = [];
  const typing = document.activeElement && document.activeElement.tagName === 'INPUT';
  const k = {
    up: keys.has('up') || gpk.up || sprintBack() ? 1 : 0, down: (keys.has('down') || gpk.down) && !sprintBack() ? 1 : 0, left: keys.has('left') || gpk.left ? 1 : 0, right: keys.has('right') || gpk.right ? 1 : 0,
    walk: keys.has('walk') || gpk.walk ? 1 : 0, sprint: (keys.has('sprint') || gpk.sprint) && performance.now() >= (st.sprintHold || 0) ? 1 : 0, slide: performance.now() - (st.slideReq ?? -1e9) < 120 ? 1 : 0, crouch: keys.has('crouch') || gpk.crouch || st.crouchT ? 1 : 0, prone: st.prone && me && me.a && !me.dn ? 1 : 0, fire: mouse.l || gpk.fire || keys.has('fire') ? 1 : 0, ads: adsHeld() || gpk.ads ? 1 : 0,
    interact: keys.has('interact') ? 1 : 0, ability: keys.has('ability') ? 1 : 0,
    lean: me && me.ct === 'body' ? leanNow() : 0, jump: performance.now() - (st.jumpReq || -1e9) < 120 ? 1 : 0,
  };
  if (me && (!me.a || me.dn || me.ct !== 'body')) st.adsTog = false; // the aim-in toggle ends with death, going down or taking a drone or camera
  if (me && (!me.a || me.dn)) st.leanT = 0; // dead or downed: stand straight again
  if (!me || !me.a || me.dn || !s || (s.ph !== PHASE.PREP && s.ph !== PHASE.ACTION)) st.crouchT = false;
  if (mouse.l || gpk.fire || keys.has('fire')) st.sprintHold = performance.now() + 500; // shooting stops a sprint for a moment, so the shot gets out
  if (steadying()) k.sprint = 0; // scoped in, the sprint key only steadies the scope
  if (k.sprint) k.sa = Math.round(st.aim * 1000) / 1000; // what the server will go by for which way you sprint
  if (k.lean) k.la = Math.round(st.aim * 1000) / 1000;
  if (typing || menuOpen()) { for (const key in k) k[key] = 0; ev.length = 0; }
  { const r = moveTurn(); if (r) k.rot = Math.round(r * 1000) / 1000; } // Rotate view, Face aiming, sprint + W: the keys turn with you
  if (r3on() && me && me.ro) { // the 3D rope view (he asked, R6's keys): W/S up and down a floor, A/D along the wall as you face it, crouch upside down
    const r = st.map.ropes[me.ro[1]];
    k.rw = r ? ((k.right ? 1 : 0) - (k.left ? 1 : 0)) * rope3d.wallSign(r) : 0; k.rv = k.up ? 1 : k.down ? -1 : 0;
    const cr = keys.has('crouch') || keys.has('crouchTap'), tn = performance.now() / 1000; if (cr && !st.r3cr) st.r3invT = tn; st.r3cr = cr; k.inv = tn - (st.r3invT ?? -9) < 0.1 ? 1 : 0; // (held a tenth of a second: a single frame could fall between two server ticks)
    k.up = k.down = k.left = k.right = 0; k.crouch = 0; k.sprint = 0; delete k.rot;
  }
  // ping whatever is under your aim: an enemy you can see, else a gadget, camera or the objective, else the wall, door or floor you point at
  const trySpot = () => {
    if (!view || !me) return;
    const c = cursor(), mw = screenToWorld(c.x, c.y), t = pingTarget(view, me, s, mw);
    if (!t) return;
    ev.push(t.spot ? { k: 'spot', id: t.spot } : { k: 'mark', x: Math.round(t.x), y: Math.round(t.y), w: t.w, id: t.id });
    audio.foley('spot');
  };
  if (st.pingOut) { firePing(st.pingOut, view, me, s, ev); st.pingOut = null; }
  if (st.wheel || st.mapV) { k.fire = 0; k.ads = 0; mouse.wl = 0; mouse.wr = 0; }
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
      st.shotPred = { w: me.w, t: now, sh: gunHeat(me, w, now) + 1 }; tilt.kick(0.5);
    st.fireK = k.fire;
  }
  const msg = { t: 'input', s: ++st.seq, k, a: Math.round(st.aim * 100000) / 100000, dt: Math.round(dt * 10000) / 10000 };
  const c = cursor(), mw = freeAimOn() && padOn && !gpRecent() && ctrl === 'body' ? (q => ({ x: q.ax, y: q.ay }))(freeAimPoint()) : screenToWorld(c.x, c.y);
  if (st.r3aim) { mw.x = st.r3aim.x; mw.y = st.r3aim.y; } // (the 3D rope view's crosshair)
  msg.ax = Math.round(mw.x * 10) / 10; msg.ay = Math.round(mw.y * 10) / 10; // tenths: headshots need the crosshair on the head
  st.aimUp = ctrl === 'body' && me && me.a && !me.dn && !!aimUpHatch(st.map, st.pred.x, st.pred.y, mw.x, mw.y); // your own aim-up pose, without waiting for the server
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
  // otherwise right where the crosshair is (he asked: not on the wall the aim line hits first), named after what is there
  const cx = Math.floor(mw.x / CELL), cy = Math.floor(mw.y / CELL), k = cy * m.W + cx, t = tileAt(m, cx, cy);
  const name = cellName(k, t); if (name) return { x: mw.x, y: mw.y, w: name };
  for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (m.dhole[(cy + oy) * m.W + cx + ox]) return { x: mw.x, y: mw.y, w: 'DRONE HOLE' };
  return { x: mw.x, y: mw.y, w: view.kind === 'body' ? 'GO HERE' : 'LOOK HERE' };
}
// Pings on screen: a badge with what it is, who pinged it and how far; kept at the screen edge when off screen.
// A ping on another floor shows over the same spot of your floor, tagged with its floor.
function drawMarks(view, now) {
  if (!st.marks || !st.marks.length) return;
  st.marks = st.marks.filter(k => now - k.t < 6);
  const pad = 46 * DPR, m = st.map, vf = view ? floorAt(m, view.x, view.y) : -1;
  for (const k of st.marks) {
    const f = floorAt(m, k.x, k.y); let x = k.x, y = k.y, tag = '';
    if (vf >= 0 && f >= 0 && f !== vf) { const o = floorOff(m, f, vf); x += o.x; y += o.y; tag = (f > vf ? '▲ ' : '▼ ') + m.floors[f].name + ' · '; }
    const P = w2s(x, y), sx = Math.max(pad, Math.min(VW - pad, P.x)), sy = Math.max(pad + 60 * DPR, Math.min(VH - pad - 60 * DPR, P.y));
    const d = view && !tag ? ` · ${Math.round(Math.hypot(k.x - view.x, k.y - view.y) / PX_PER_M)} m` : '';
    drawPing(ctx, k, sx, sy, now - k.t, DPR, tag + k.by + d);
  }
}

// ---------------- ping wheel and map (he asked, instead of talking to the bots) ----------------
// Hold the wheel key at a spot, drag toward a ping, let go. The map key opens a map of the floors; click it to ping, or hold
// the click (or the wheel key) and drag for the wheel. You keep moving meanwhile; only your aim and gun wait.
const WHEEL_CLAMP = 110;
function openWheel(mouseHeld = false) {
  if (!st.id || st.tv || !playing() || menuOpen() || st.wheel) return;
  if (st.mapV) { const p = mapPoint(); if (!p) return; st.wheel = { sx: st.mapV.cx, sy: st.mapV.cy, x: p.x, y: p.y, map: true, dx: 0, dy: 0, t0: performance.now() }; }
  else { if (!st.pred) return; const c = cursor(), w = screenToWorld(c.x, c.y); st.wheel = { sx: c.x, sy: c.y, x: w.x, y: w.y, dx: 0, dy: 0, t0: performance.now() }; }
  st.wheelMouse = mouseHeld; audio.ui('hover');
}
function closeWheel(cancel) {
  const W = st.wheel; st.wheel = null; st.wheelMouse = false; if (!W || cancel) return;
  const P = wheelPick(W.dx, W.dy, DPR);
  st.pingOut = { x: W.x, y: W.y, pk: P ? P.id : null, map: W.map };
}
// what actually goes to the server: a thing under the spot lends its name ("DANGER - CAMERA"), an enemy you can see gets spotted
function firePing(o, view, me, s, ev) {
  if (!me) return;
  const t = view && !o.map ? pingTarget(view, me, s, { x: o.x, y: o.y }) : null, thing = t && t.w && !/HERE$/.test(t.w);
  if (t && t.spot && (!o.pk || o.pk === 'enemy')) ev.push({ k: 'spot', id: t.spot });
  else if (!o.pk) { if (t) ev.push({ k: 'mark', x: Math.round(t.x), y: Math.round(t.y), w: t.w, id: t.id }); else if (o.map) ev.push({ k: 'mark', x: Math.round(o.x), y: Math.round(o.y), w: 'GO HERE', pk: 'go' }); else return; }
  else ev.push({ k: 'mark', x: Math.round(thing ? t.x : o.x), y: Math.round(thing ? t.y : o.y), w: pingOf(o.pk).w + (thing ? ' - ' + t.w : ''), pk: o.pk, id: thing ? t.id : undefined });
  audio.foley('spot');
}
function toggleMapV() {
  if (st.mapV) { st.mapV = null; return; }
  if (!st.id || st.tv || !playing() || menuOpen() || !st.map || !st.rend) return;
  const v = st.lastViewPos || st.pred, f = v ? Math.max(0, floorAt(st.map, v.x, v.y)) : 0;
  st.mapV = { f, cx: VW * 0.72, cy: VH * 0.5, t: 0, pic: null }; audio.ui('open');
}
function mapFloorStep(d) { const V = st.mapV, n = st.map.floors.length; V.f = Math.max(0, Math.min(n - 1, V.f + d)); V.t = 0; V.pic = null; }
// where this floor sits on the screen: close on its rooms, a little ground round them
function mapBox(V) {
  const m = st.map, F = m.floors[V.f]; if (V.box && V.box.f === V.f && V.box.VW === VW && V.box.VH === VH) return V.box;
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (const r of m.rooms || []) if (r.fl === V.f) { x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h); }
  if (x1 < 0) { x0 = F.gx; y0 = 0; x1 = F.gx + F.w; y1 = F.h; }
  x0 = Math.max(F.gx, x0 - 6); y0 = Math.max(0, y0 - 6); x1 = Math.min(F.gx + F.w, x1 + 6); y1 = Math.min(F.h, y1 + 6);
  const w = x1 - x0, h = y1 - y0, k = Math.min(VW * 0.42 / w, VH * 0.66 / h), pw = Math.round(w * k), ph = Math.round(h * k);
  return V.box = { f: V.f, VW, VH, x0, y0, w, h, k, pw, ph, px: Math.round(VW - pw - 125 * DPR), py: Math.round((VH - ph) / 2 - 8 * DPR) }; // (clear of the buttons and gadget list at the edges)
}
function mapPoint() { const V = st.mapV, B = mapBox(V); if (V.cx < B.px || V.cy < B.py || V.cx > B.px + B.pw || V.cy > B.py + B.ph) return null; return { x: (B.x0 + (V.cx - B.px) / B.k) * CELL, y: (B.y0 + (V.cy - B.py) / B.k) * CELL }; }
function mapTabAt(V, B) { const n = st.map.floors.length, w = 54 * DPR, h = 26 * DPR; if (V.cy < B.py - h - 4 * DPR || V.cy > B.py - 4 * DPR) return -1; const i = Math.floor((V.cx - B.px) / w); return i >= 0 && i < n ? i : -1; }
function mapClick() { const V = st.mapV, i = mapTabAt(V, mapBox(V)); if (i >= 0) { V.f = i; V.t = 0; V.pic = null; audio.ui(); return; } openWheel(true); }
function drawMapV(s, me, now) {
  const V = st.mapV, m = st.map, B = mapBox(V), D = DPR, R = st.rend;
  if (!V.pic || now > V.t) { // the picture is what you know of the floor, refreshed now and then; people are drawn on top each frame
    const c = V.pic || (V.pic = document.createElement('canvas')); c.width = B.pw; c.height = B.ph; const x = c.getContext('2d'), P = CELL * R.S;
    R.c.drawTo(x, B.x0 * P, B.y0 * P, B.w * P, B.h * P, 0, 0, B.pw, B.ph);
    x.fillStyle = 'rgba(5,8,12,0.28)'; x.fillRect(0, 0, B.pw, B.ph);
    const site = m.sites[s.site], side = me && me.tm, known = side === 'def' || s.rev;
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 3 * D; x.strokeStyle = 'rgba(0,0,0,0.85)';
    for (const r of m.rooms || []) if (r.fl === V.f) {
      const rx = (r.x - B.x0) * B.k, ry = (r.y - B.y0) * B.k, rw = r.w * B.k, rh = r.h * B.k;
      if (known && site && (site.rooms || []).includes(r.name)) { x.fillStyle = 'rgba(242,193,78,0.22)'; x.fillRect(rx, ry, rw, rh); x.save(); x.lineWidth = 2 * D; x.strokeStyle = '#f2c14e'; x.strokeRect(rx, ry, rw, rh); x.restore(); }
      const name = r.name.replace(/^\dF /, '').toUpperCase(); x.font = `700 ${10.5 * D}px Barlow Condensed, sans-serif`;
      if (x.measureText(name).width < rw - 4 * D && rh > 14 * D) { x.fillStyle = 'rgba(255,255,255,0.82)'; x.strokeText(name, rx + rw / 2, ry + rh / 2); x.fillText(name, rx + rw / 2, ry + rh / 2); }
    }
    V.t = now + 1;
  }
  const c = ctx, P = (x, y) => ({ x: B.px + (x / CELL - B.x0) * B.k, y: B.py + (y / CELL - B.y0) * B.k }), on = (x, y) => floorAt(m, x, y) === V.f;
  c.save();
  c.fillStyle = 'rgba(6,9,14,0.86)'; c.fillRect(B.px - 3 * D, B.py - 3 * D, B.pw + 6 * D, B.ph + 6 * D);
  c.drawImage(V.pic, B.px, B.py);
  c.strokeStyle = 'rgba(255,255,255,0.28)'; c.lineWidth = D; c.strokeRect(B.px - 0.5, B.py - 0.5, B.pw + 1, B.ph + 1);
  m.floors.forEach((F, i) => { const w = 54 * D, h = 26 * D, x = B.px + i * w, y = B.py - h - 4 * D, cur = i === V.f; c.fillStyle = cur ? '#f2c14e' : 'rgba(6,9,14,0.86)'; c.fillRect(x, y, w - 3 * D, h); c.fillStyle = cur ? '#10131a' : '#d8dde4'; c.font = `800 ${14 * D}px Barlow Condensed, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(F.name, x + (w - 3 * D) / 2, y + h / 2 + D); });
  c.save(); c.beginPath(); c.rect(B.px, B.py, B.pw, B.ph); c.clip();
  const site = m.sites[s.site]; if (site && me && (me.tm === 'def' || s.rev)) for (const b of site.bombs) if (on(b.x, b.y)) { const q = P(b.x, b.y); c.fillStyle = '#f2c14e'; c.beginPath(); c.arc(q.x, q.y, 8 * D, 0, 7); c.fill(); c.fillStyle = '#000'; c.font = `800 ${11 * D}px Barlow Condensed, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(b.id, q.x, q.y + D * 0.5); }
  for (const p of s.players) if (me && p.tm === me.tm && p.a && p.id !== st.id && p.x !== undefined && !p.sg && on(p.x, p.y)) { const q = P(p.x, p.y); c.fillStyle = '#4fb3ff'; c.strokeStyle = '#000'; c.lineWidth = 1.5 * D; c.beginPath(); c.arc(q.x, q.y, 5 * D, 0, 7); c.fill(); c.stroke(); }
  for (const p of st.foesSeen || []) if (on(p.x, p.y)) { const q = P(p.x, p.y); c.fillStyle = '#ff4646'; c.strokeStyle = '#000'; c.lineWidth = 1.5 * D; c.beginPath(); c.arc(q.x, q.y, 5.5 * D, 0, 7); c.fill(); c.stroke(); }
  if (me && me.a && st.pred && on(st.pred.x, st.pred.y)) { const q = P(st.pred.x, st.pred.y); c.save(); c.translate(q.x, q.y); c.rotate(st.aim + Math.PI / 2); c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 1.5 * D; c.beginPath(); c.moveTo(0, -9 * D); c.lineTo(6 * D, 7 * D); c.lineTo(0, 3.5 * D); c.lineTo(-6 * D, 7 * D); c.closePath(); c.fill(); c.stroke(); c.restore(); }
  for (const k of st.marks || []) if (on(k.x, k.y)) { const q = P(k.x, k.y), age = now - k.t, al = age > 5 ? 6 - age : 1, rp = (age % 1.4) / 1.4, col = pingOf(k.pk).col; c.strokeStyle = `rgba(${col},${0.8 * (1 - rp) * al})`; c.lineWidth = 2 * D; c.beginPath(); c.arc(q.x, q.y, (10 + rp * 18) * D, 0, 7); c.stroke(); drawBadge(c, k.pk, q.x, q.y, 10 * D, al); }
  c.restore();
  c.font = `600 ${12.5 * D}px Barlow Condensed, sans-serif`; c.textAlign = 'right'; c.textBaseline = 'middle'; c.fillStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 3 * D; c.strokeStyle = 'rgba(0,0,0,0.8)';
  const tip = 'CLICK TO PING · HOLD AND DRAG FOR THE WHEEL'; c.strokeText(tip, B.px + B.pw, B.py - 17 * D); c.fillText(tip, B.px + B.pw, B.py - 17 * D);
  if (!st.wheel) { c.translate(V.cx, V.cy); c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 1.5 * D; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 16 * D); c.lineTo(4.5 * D, 12 * D); c.lineTo(11 * D, 11 * D); c.closePath(); c.fill(); c.stroke(); }
  c.restore();
}

// smoke clouds of a snapshot, worked out once per snapshot (it was being rebuilt many times a frame)
const smokeMemo = new WeakMap();
const smokes = s => { if (!s) return []; let v = smokeMemo.get(s); if (!v) smokeMemo.set(s, v = s.ents.filter(e => e.ty === 'smoke').flatMap(e => e.pf ? Array.from({ length: e.pf.length / 2 }, (_, i) => ({ x: e.pf[i * 2], y: e.pf[i * 2 + 1], r: e.r })) : [{ x: e.x, y: e.y, r: e.r }])); return v; };

// ---------------- what things are made of (for sound) ----------------
const FLOOR_SURF = { [FL.ROOF]: 'concrete', [FL.SNOW]: 'grass', [FL.WOOD]: 'wood', [FL.TILE]: 'tile', [FL.SERVER]: 'metal', [FL.MARBLE]: 'marble', [FL.CARPET]: 'carpet', [FL.CONCRETE]: 'concrete', [FL.GRASS]: 'grass', [FL.ASPHALT]: 'asphalt', [FL.SAND]: 'grass' };
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
      for (const h of st.map.hatches) if (h.fl === lo + 1 && hatchOpen(st.map, h) && Math.hypot(up.x - h.x, up.y - h.y) < 160 && Math.hypot(dn.x - h.bx, dn.y - h.by) < 220) return 1;
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
  (x, y) => { const k = cellAt(x, y); return k >= 0 && st.map && st.map.floor[k] !== FL.GRASS && st.map.floor[k] !== FL.ASPHALT && st.map.floor[k] !== FL.SAND && st.map.floor[k] !== FL.SNOW; },
  (x, y) => (st.map ? localPos(st.map, x, y) : { x, y }),
);

// Little sounds from each player's state: footsteps per surface, turning on the spot,
// aiming, crouching, weapon swaps, reload stages, hammering, planting...
const FOLEY_NEAR = 4 * PX_PER_M;
function playerFoley(p, a, moved, own, dt) {
  const w = WEAPONS[p.w], shotgun = w && w.cls === 'Shotgun';
  const pace = p.dn ? 1 : p.wk ? 0 : p.cr ? 1 : p.mv >= 3 ? 3 : 2;
  // legs follow the real step cycle; a foot plants each time the gait passes a multiple of PI
  const gt = p.gt || 0, plant = Math.floor(gt / Math.PI);
  // someone walking or crouching (or standing still) makes their small sounds (aiming in, crouching, turning, a gun swap)
  // only for people close by (he asked: hearing them felt like wallhacks)
  const small = own || (!p.si && (pace >= 2 || audio.nearListener(p.x, p.y, FOLEY_NEAR)));
  if (a.plant !== undefined && plant > a.plant && moved > 0.05 && (own || !p.si) && (own || !(st.me && st.me.df))) audio.step(p.x, p.y, surfaceAt(p.x, p.y), pace, own);
  if (a.plant === undefined || plant < a.plant - 1 || plant > a.plant) a.plant = plant;
  // turning on the spot: feet shuffle round, each shuffle a little step
  const dAng = Math.abs(angDiff(p.ag, a.lag ?? p.ag)); a.lag = p.ag;
  a.turn = a.turn || 0;
  if (moved < 0.3 && !p.dn) {
    const before = Math.floor(a.turn / Math.PI);
    a.turn += dAng * 2.4; a.turnAmp = Math.min(1, (a.turnAmp || 0) + dAng * 3);
    if (Math.floor(a.turn / Math.PI) > before && small) audio.shuffle(p.x, p.y, surfaceAt(p.x, p.y), own);
  }
  a.walk = gt + Math.PI / 2 + a.turn;
  if (a.pAd !== undefined && (own || !p.si)) { // a silent player (HUSH's shroud, Ghost Step) makes none of these for others
    if (small && p.ad !== a.pAd && !p.dn) audio.foley(p.ad ? 'adsIn' : 'adsOut', p.x, p.y, own);
    if (small && p.cr !== a.pCr && !p.dn) audio.foley(p.cr ? 'crouch' : 'stand', p.x, p.y, own);
    if (small && p.w !== a.pW && p.w) audio.foley('draw', p.x, p.y, own);
    if (small && p.mv && !a.pMv) audio.foley('cloth', p.x, p.y, own);
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
    const d = Math.min(v.range, castSight(st.map, v.x, v.y, a, v.range, sm, false, !!v.low) + 7);
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

function droneHidden(x, y) { const m = st.map; if (!m) return false; const k = Math.floor(y / CELL) * m.W + Math.floor(x / CELL); return underAt(m, k, m.tiles[k]); }
function drawScanBlips(now) { // WRAITH: heartbeats, fuzzy
  const me = st.me; if (!me || !me.bl || !me.sc) return;
  for (const [x, y, age] of me.bl) {
    const k = Math.min(1, age / 0.8), r = 7 + 11 * k, g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(150,170,255,${0.55 * (1 - k)})`); g.addColorStop(1, 'rgba(150,170,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
}
function draw(s, view, now, dt) {
  const z = st.zoom, m = st.map; let tq = performance.now();
  const shake = fxOn('shake') ? fx.shake : 0;
  const cr = Math.cos(st.rot || 0), sr = Math.sin(st.rot || 0), TA = z * cr, TB = z * sr, TC = -z * sr, TD = z * cr; // world -> screen (turned with Rotate aiming)
  const ox = VW / 2 - (TA * st.cam.x + TC * st.cam.y) + (Math.random() - 0.5) * shake * DPR, oy = VH / 2 - (TB * st.cam.x + TD * st.cam.y) + (Math.random() - 0.5) * shake * DPR;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, VW, VH);
  ctx.setTransform(TA, TB, TC, TD, ox, oy);
  ctx.imageSmoothingEnabled = true;
  // the map layer: copy over any changed spots, then let the browser place and scale it
  st.rend.process(gfxLevel() === 'low' ? 2.5 : 4, st.cam.x, st.cam.y);
  st.rend.flush();
  if (st.warm > 0) { // just after loading a map: show every floor at once (invisibly) so the graphics card has them all ready
    st.warm--;
    const k = Math.min(innerWidth / (m.W * CELL * S), innerHeight / (m.H * CELL * S));
    mapLayer.style.opacity = st.warm > 0 ? '0.02' : '';
    mapLayer.style.transform = st.warm > 0 ? `scale(${k})` : ''; if (st.warm > 0) { st.rend.showFor(null); st.rend.c.prime(); for (const K in st.rend.copies) st.rend.copies[K].t.prime(); } // (the smaller copies and the bitmaps ready on the graphics card too)
  } else { st.rend.showFor(z); const q = S * DPR; mapLayer.style.transform = st.rot ? `matrix(${TA / q}, ${TB / q}, ${TC / q}, ${TD / q}, ${ox / DPR}, ${oy / DPR})` : `translate(${ox / DPR}px, ${oy / DPR}px) scale(${z / q})`; }
  // visible window of the map (for the grey remembered copy)
  const ex = st.rot ? Math.hypot(VW, VH) / 2 / z : VW / 2 / z, ey = st.rot ? ex : VH / 2 / z, fr = st.rot && st.floorRect; // a turned view reaches further across the map
  const wx0 = Math.max(fr ? fr[0] : 0, st.cam.x - ex - 20), wy0 = Math.max(fr ? fr[1] : 0, st.cam.y - ey - 20);
  const wx1 = Math.min(fr ? fr[2] : m.W * CELL, st.cam.x + ex + 20), wy1 = Math.min(fr ? fr[3] : m.H * CELL, st.cam.y + ey + 20);
  tq = pfa('mapblit', tq);
  if (!s) { showFog(false); tilt.flat(); return; }
  const me = st.me, side = me ? me.tm : null;
  const inGame = s.ph === PHASE.PREP || s.ph === PHASE.ACTION || s.ph === PHASE.ROUND_END;
  const sm = smokes(s);
  const seen = (x, y) => !view || teamSees(x, y);
  const spotted = new Set(side && s.spots[side] ? s.spots[side] : []);

  // objective
  if (inGame) {
    const site = m.sites[s.site];
    if (s.zb) drawZbWorld(ctx, s, now);
    if (!s.ar && !s.zb && (side === 'def' || s.rev || !me)) for (const b of site.bombs) if (!s.pl || s.pl.b !== b.id) drawBomb(ctx, b, now);
    if (s.pl) {
      ctx.save(); ctx.translate(s.pl.x, s.pl.y);
      const pulse = (now * 2) % 1;
      ctx.strokeStyle = `rgba(255,60,60,${1 - pulse})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 8 + pulse * 30, 0, 7); ctx.stroke();
      ctx.fillStyle = '#2a2a2a'; ctx.fillRect(-6, -4, 12, 8); ctx.fillStyle = '#ff3030'; ctx.fillRect(-4, -2, 8, 4);
      ctx.restore();
    }
  }
  // corpses
  if (st.corpses.length && st.corpses.some(c => c.zbc)) { const tn = performance.now() / 1000; st.corpses = st.corpses.filter(c => !c.zbc || tn - c.t < 10); } // zombie bodies go after a while
  for (const c of st.corpses) if (c.zbc) drawZombie(ctx, { ...c, dead: true }, now); else drawOperator(ctx, { ...c, downed: true }, now);
  // rappel ropes: a coil on the ground under each stretch of wall you can climb (attackers), and the rope on anyone using one
  if (side === 'atk' && view) for (const r of st.map.ropes || []) {
    const bx = r.base.x, by = r.base.y; if (Math.abs(bx - view.x) > 700 || Math.abs(by - view.y) > 700) continue;
    ctx.strokeStyle = 'rgba(205,165,100,0.95)'; ctx.lineWidth = 1.4;
    for (const rr of [4.6, 3, 1.4]) { ctx.beginPath(); ctx.arc(bx, by, rr, 0, 7); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(170,135,85,0.35)'; ctx.setLineDash([2, 2]); ctx.beginPath();
    ctx.moveTo(r.base.x + r.tx * r.a, r.base.y + r.ty * r.a); ctx.lineTo(r.base.x + r.tx * r.b, r.base.y + r.ty * r.b); ctx.stroke(); ctx.setLineDash([]);
  }
  for (const sp of s.players) if (sp.rp && sp.a) {
    const p = me && sp.id === me.id ? { x: st.pred.x, y: st.pred.y } : interp(sp.id, 'players'); if (!p || p.x === undefined) continue;
    let r = null; for (const q of st.map.ropes || []) { const sx = Math.max(q.a, Math.min(q.b, (p.x - q.hang.x) * q.tx + (p.y - q.hang.y) * q.ty)); if (Math.hypot(q.hang.x + q.tx * sx - p.x, q.hang.y + q.ty * sx - p.y) < 3 || Math.hypot(q.base.x + q.tx * sx - p.x, q.base.y + q.ty * sx - p.y) < 6) { r = q; break; } }
    if (!r) continue;
    const up = Math.hypot(r.hang.x - p.x, r.hang.y - p.y) < Math.hypot(r.base.x - p.x, r.base.y - p.y) + 200 && floorAt(st.map, p.x, p.y) === r.f;
    const a = up ? r.out : r.out + Math.PI; // hanging: the rope runs up the wall above you; at the bottom: to the wall
    ctx.strokeStyle = '#b08a55'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(a) * 14, p.y + Math.sin(a) * 14); ctx.stroke();
    ctx.fillStyle = '#6b5434'; ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * 14, p.y + Math.sin(a) * 14, 1.3, 0, 7); ctx.fill();
  }

  // gadgets / entities
  const ents = s.ents.map(e => interp(e.id, 'ents') || e);
  for (const e of ents) {
    const ally = e.tm === side;
    if (e.ty === 'drone' || e.ty === 'cam' || e.ty === 'smoke' || e.ty === 'decoy' || e.ty === 'gascloud' || e.ty === 'bird' || e.ty === 'swarm') continue;
    if (TRAPS.has(e.ty) && !ally && !(view && Math.hypot(e.x - view.x, e.y - view.y) < TRAP_SEEN)) continue; // hidden traps: one rule for all (he asked), seen only within 2 m
    if (!ally && !seen(e.x, e.y)) continue;
    drawGadget(ctx, e, now, ally);
  }
  for (const e of ents) if (e.ty === 'cam' && (e.tm === side || seen(e.x, e.y))) drawCam(ctx, e, now, e.tm === side);
  for (const e of ents) { // an outside camera also shows on the wall above the ground under it (he asked: it can be shot from down there)
    const oc = e.ty === 'cam' && e.oc !== undefined && st.map.outCams && st.map.outCams[e.oc];
    if (!oc || !(e.tm === side || seen(oc.gx, oc.gy))) continue;
    drawCam(ctx, { ...e, x: oc.gx, y: oc.gy }, now, e.tm === side);
    ctx.font = '700 6px Barlow Condensed, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = e.tm === side ? '#8fc8ff' : '#ff8a3d';
    ctx.fillText('▲ CAMERA', oc.gx + Math.cos(oc.n) * 10, oc.gy + Math.sin(oc.n) * 10 + 2); // (out in the yard, not on the wall)
  }

  // players
  const drawn = []; st.heads = []; st.rings = []; // st.rings: everyone drawn but you, for the orange/blue marker (it stops on their circle) // enemies you can see: their head zones show while you aim in
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
      drawOperator(ctx, { x: gh.x, y: gh.y, aim: p.ag, op: p.op, w: p.w, ally, ring: tvRing(p), walk: a.walk, legs: Math.min(1.2, a.mvS), ads: p.ad, crouch: p.cr, prone: p.pn, downed: p.dn, recoil: a.recoil, brace: p.br, riot: p.ri, shieldPose: p.br ? shieldPose(p.gt, p.mv >= 2, false, p.so === 2, p.sa || 0, riotArc(p.ri, p.cr, !p.mv)) : null }, now);
      ctx.globalAlpha = 1;
      ctx.font = '700 7px Barlow Condensed, sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = ally ? '#8fc8ff' : '#ff8a3d'; const u = UP(); ctx.fillText(gh.below ? '▼ BELOW' : '▲ ABOVE', gh.x + u.x * 15, gh.y + u.y * 15);
      if (!ally && !p.dn) st.heads.push({ x: gh.x, y: gh.y });
    }
    // at an upper window or on a rope (he asked): they also show on the ground just outside the wall, to anyone below
    // they could see from there (what they can see can see them; through a bullet hole only from close by)
    let wg = !isMe && !gh && wallGhost(st.map, p.x, p.y);
    const wgAt = wg && (ally ? wg : !p.sh && wallGhostSeen(wg));
    if (wgAt) {
      wg = { ...wg, x: wgAt.x, y: wgAt.y };
      ctx.globalAlpha = 0.9;
      drawOperator(ctx, { x: wg.x, y: wg.y, aim: p.ag, op: p.op, w: p.w, ally, ring: tvRing(p), walk: a.walk, legs: wg.rope ? 0 : Math.min(1.2, a.mvS), ads: p.ad, crouch: p.cr, prone: p.pn, downed: p.dn, recoil: a.recoil }, now);
      ctx.globalAlpha = 1;
      ctx.font = '700 7px Barlow Condensed, sans-serif'; ctx.textAlign = 'center';
      const F = st.map.floors[Math.max(0, floorAt(st.map, p.x, p.y))];
      ctx.fillStyle = ally ? '#8fc8ff' : '#ff8a3d'; const u = UP(); ctx.fillText(wg.rope ? '▲ ON THE WALL' : wg.views[0].e !== undefined ? '▲ ON THE ROOF' : `▲ ${F.name} WINDOW`, wg.x + u.x * 15, wg.y + u.y * 15);
      if (!ally && !p.dn) st.heads.push({ x: wg.x, y: wg.y });
    }
    // Silent Shroud: drones and cameras can't see her, only eyes can
    const vis = ally || isMe || (p.sh ? !view || teamSeesBody(p.x, p.y) : seen(p.x, p.y));
    if (st.tv) (st.tvPos || (st.tvPos = new Map())).set(p.id, { x: p.x, y: p.y, p });
    if (!vis) { // ESPORTS TV (he asked): everyone's outline shows through walls; only the followed player's sight is live
      if (st.tv && !p.dn && p.x !== undefined) bodyOutline(p, p.sq ? '255,138,61' : '70,168,255', 0.9);
      continue;
    }
    if (p.zb && p.zb[0] === 1) { // ZOMBIES: one of the dead
      a.zhit = Math.max(0, (a.zhit || 0) - dt * 4); if (a.zhp !== undefined && p.hp < a.zhp) a.zhit = 0.6; a.zhp = p.hp;
      drawZombie(ctx, { x: p.x, y: p.y, aim: p.ag, walk: a.walk, legs: Math.min(1.2, a.mvS || 0.6), look: p.zb[2], run: p.zb[1], hit: a.zhit }, now);
      drawn.push(p); st.rings.push({ id: p.id, x: p.x, y: p.y }); st.heads.push({ x: p.x, y: p.y });
      continue;
    }
    // up on furniture or mid-jump (he asked: an obvious but tidy marker): a shadow below, a dashed ring, drawn a little bigger
    const elv = isMe ? (st.pred.air > 0 ? 2 : st.pred.up ? 1 : 0) : p.el || 0;
    if (elv) { ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(p.x + 3, p.y + 5, 11, 9, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1; ctx.setLineDash([3, 2]); ctx.beginPath(); ctx.arc(p.x, p.y, 15.5, 0, 7); ctx.stroke(); ctx.restore();
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1.12, 1.12); ctx.translate(-p.x, -p.y); }
    const hangW = p.rp === 1 || p.rp === 3 ? hangWall(p) : undefined; // on a rope: drawn hanging against the wall
    drawOperator(ctx, {
      hang: hangW !== undefined ? (p.rp === 3 ? 'inv' : 'up') : null, wallA: hangW,
      x: p.x, y: p.y, aim: p.ag, op: p.op, w: p.w, ally, ring: tvRing(p), walk: a.walk, legs: Math.min(1.2, Math.max(a.mvS, a.turnAmp * 0.6)), ads: p.ad, crouch: p.cr, prone: p.pn, slide: p.sd, downed: p.dn,
      sprint: (a.sprS = (a.sprS || 0) + ((p.mv === 3 ? 1 : 0) - (a.sprS || 0)) * 0.18), up: (a.upS = (a.upS || 0) + (((isMe ? st.aimUp : p.au) ? 1 : 0) - (a.upS || 0)) * 0.2), lean: (isMe ? st.pred.lo || 0 : p.le || 0) / LEAN_PX, recoil: a.recoil, flash: now - a.flashT < 0.045, reload: p.rl > 0, brace: p.br, riot: p.ri, shieldPose: p.br ? shieldPose(p.gt, p.mv >= 2, false, p.so === 2, p.sa || 0, riotArc(p.ri, p.cr, !p.mv)) : null, scan: p.sc, melee: a.melee,
    }, now);
    if (elv) ctx.restore();
    drawn.push(p); if (!isMe) st.rings.push({ id: p.id, x: p.x, y: p.y });
    if (!ally && !isMe && !p.dn) st.heads.push({ x: p.x, y: p.y });
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
    // he asked: under a vehicle or table it is covered. Its pilot sees a faint shape, nobody else sees it until it comes out
    const hid = droneHidden(x, y), mineD = own || (view && view.cam && view.cam.id === e.id);
    if (hid && !mineD) continue;
    if (hid) ctx.globalAlpha = 0.35;
    if (e.tm === side || seen(x, y)) drawDrone(ctx, { ...e, x, y, ag: a.heading, wheel: a.wheel, spd: a.spd, mvAng: a.mvAng ?? a.heading, sway: a.sway }, now, e.tm === side);
    ctx.globalAlpha = 1;
  }
  for (const e of ents) if (e.ty === 'swarm' && (e.tm === side || seen(e.x, e.y))) { // MAGPIE's swarm
    const a = anim(e.id); a.vx = e.x - (a.sx ?? e.x); a.vy = e.y - (a.sy ?? e.y); a.sx = e.x; a.sy = e.y;
    drawSwarm(ctx, { ...e, vx: a.vx / Math.max(dt, 0.001), vy: a.vy / Math.max(dt, 0.001) }, now);
  }
  for (const e of ents) if (e.ty === 'bird') { // MAGPIE's birds: the wings beat faster the faster it flies
    const own = me && e.id === me.did && me.ct === 'drone';
    const x = own ? st.pred.x : e.x, y = own ? st.pred.y : e.y, a = anim(e.id);
    const sp = Math.hypot(x - (a.bx ?? x), y - (a.by ?? y)) / Math.max(dt, 0.001); a.bx = x; a.by = y;
    a.fl = (a.fl ?? 0.4) + (Math.min(1, 0.3 + sp / 150) - (a.fl ?? 0.4)) * Math.min(1, dt * 6);
    if (e.tm === side || seen(x, y)) drawBird(ctx, { ...e, x, y, ag: own ? st.aim : e.ag, fl: a.fl }, now, e.tm === side);
  }
  audio.pruneLoops(); audio.defuserAlarm(!!(s.pl && s.ph === PHASE.ACTION), s.pl && s.pl.x, s.pl && s.pl.y); tq = pfa('actors', tq);
  fx.draw(ctx);
  for (const e of ents) if (e.ty === 'decoy') { // Holo Decoy: looks, moves and sounds like the real operator
    const a = anim(e.id), mv = Math.hypot(e.x - (a.dx ?? e.x), e.y - (a.dy ?? e.y)); a.dx = e.x; a.dy = e.y;
    a.walk = (a.walk || 0) + mv / 28 * Math.PI; a.stepAcc = (a.stepAcc || 0) + mv;
    if (a.stepAcc > 31) { a.stepAcc = 0; audio.step(e.x, e.y, surfaceAt(e.x, e.y), 2, false); }
    const ally = e.tm === side; if (!ally && !seen(e.x, e.y)) continue;
    if (ally) ctx.globalAlpha = 0.45;
    drawOperator(ctx, { x: e.x, y: e.y, aim: e.ag, op: e.op, w: e.w, ally, ring: tvRing(e), walk: a.walk, legs: 1 }, now);
    ctx.globalAlpha = 1;
  }
  for (const e of ents) if (e.ty === 'smoke') drawSmoke(ctx, e, now, gq.smoke);
  for (const e of ents) if (e.ty === 'gascloud' && (e.tm === side || seen(e.x, e.y))) drawSmoke(ctx, { ...e, l: Math.min(e.l * 1.5, 12) }, now, Math.ceil(gq.smoke * 0.6), '150,200,70');
  fx.drawLights(ctx); tq = pfa('fx', tq);

  // --- line-of-sight blackout ---
  const vpolys = [], vviews = []; // (the sight shapes and their eyes, for the raised walls below)
  // raised walls (look.js): how tall, as a share of the distance from the middle of the view. Zoomed far out they sink
  // flat (full up to RAISE_FULL world px tall, none past RAISE_NONE): there they are a few pixels, and on his graphics
  // card any raised-wall drawing over a whole far view halved the frame rate (he asked 2026-11-09: no lag at any zoom)
  const RH = 0.045 * Math.max(0, Math.min(1, (RAISE_NONE - (st.viewH || 0)) / (RAISE_NONE - RAISE_FULL)));
  let rf = null; // this frame's raised walls, worked out once for both passes (look.js keeps the pieces between frames)
  const raise = inGame && RH > 0.002 && gq.raised !== false && fxOn('walls3d') ? (c, pass) => { // pass 'fog' (all, greyed by #fog) or 'lit'
    const t0 = performance.now(), rm = st.rend.map;
    if (!rf) {
      const fr = st.floorRect;
      const X0 = Math.max(fr ? fr[0] : 0, wx0 - 40), Y0 = Math.max(fr ? fr[1] : 0, wy0 - 40), X1 = Math.min(fr ? fr[2] : m.W * CELL, wx1 + 40), Y1 = Math.min(fr ? fr[3] : m.H * CELL, wy1 + 40);
      rf = raisedFrame(st.rend, rm, st.cam, RH, Math.floor(X0 / CELL), Math.floor(Y0 / CELL), Math.floor(X1 / CELL) - 1, Math.floor(Y1 / CELL) - 1);
    }
    // wall tops from the small copy of the map when the screen shows less than it holds (far out)
    const pk = pass === 'fog' ? fog.width / VW * z : z, pic = st.rend.picFor(pk);
    if (pass === 'fog' || !view) { drawRaised(c, st.rend, rf, [0, 1], pic); pfa('raise', t0); return; }
    // walls in colour exactly where your team's sight reaches (raised with them), like the floor: no cell-by-cell snapping
    c.save(); c.clip(sightClip(vpolys, vviews, st.cam, RH)); drawRaised(c, st.rend, rf, [0], pic); c.restore();
    c.save(); c.clip(sightClip(vpolys, vviews, st.cam, RH, rm)); drawRaised(c, st.rend, rf, [1], pic); c.restore(); // cars, crates, shelves: only the part in sight
    pfa('raise', t0);
  } : null;
  showFog(!!(view && inGame));
  if (view && inGame) {
    const fk = fog.width / VW;
    fctx.setTransform(1, 0, 0, 1, 0, 0);
    fctx.globalCompositeOperation = 'source-over';
    fctx.fillStyle = '#000'; fctx.fillRect(0, 0, fog.width, fog.height);
    fctx.setTransform(TA * fk, TB * fk, TC * fk, TD * fk, ox * fk, oy * fk);
    // the remembered map: the colour picture, greyed by the browser (CSS filter on #fog), not a grey copy of our own
    // (far out, from its small copy: the fog layer has fewer pixels than that holds, and shrinking the whole picture each frame lagged)
    const tb = performance.now(), pic = st.rend.picFor(fk * z), G = pic.width / st.rend.Wp;
    if (wx1 > wx0 && wy1 > wy0) pic.drawTo(fctx, wx0 * G, wy0 * G, (wx1 - wx0) * G, (wy1 - wy0) * G, wx0, wy0, wx1 - wx0, wy1 - wy0);
    pfa('fogblit', tb);
    // cut out everything your team can see right now
    fctx.globalCompositeOperation = 'destination-out';
    for (const v of st.viewers) {
      if (v.off) continue;
      if (v.near) { fctx.fillStyle = v === view ? 'rgba(0,0,0,0.5)' : '#000'; fillPoly(fctx, nearPolygon(v, sm)); }
      const vp = visionPolygon(v, sm, v === view ? 0 : 140); vpolys.push(vp); vviews.push(v); fctx.fillStyle = '#000'; fillPoly(fctx, vp);
    }
    fctx.globalCompositeOperation = 'source-over';
    // past an upper floor's (or the roof's) edge: the ground far below, as in its open air (mapdraw makeBelow), never live
    const fb = st.floorRect, below = st.rend.below && st.rend.below.off[st.camFloor];
    st.belowOut = !!(fb && below);
    if (st.belowOut) {
      const L = st.cam.x - ex - 50, Tp = st.cam.y - ey - 50, W2 = ex * 2 + 100, H2 = ey * 2 + 100;
      fctx.save(); fctx.beginPath(); fctx.rect(L, Tp, W2, H2); fctx.rect(fb[0], fb[1], fb[2] - fb[0], fb[3] - fb[1]); fctx.clip('evenodd'); fctx.fillStyle = '#000'; fctx.fillRect(L, Tp, W2, H2);
      st.rend.drawBelow(fctx, st.camFloor, L, Tp, W2, H2); fctx.restore();
    }
    if (raise) raise(fctx, 'fog'); // all raised walls into the blackout (the browser greys them like the rest); the seen ones go over them below
  } else st.belowOut = false;
  // everything from here on goes on the top layer, above the blackout
  ctx = octx; overDirty = true;
  ctx.setTransform(TA, TB, TC, TD, ox, oy);
  if (st.floorRect && !st.belowOut) { // hide the neighbouring floors that sit beside this one in the map grid (the fog step covers them with the ground below)
    const [a, b, c, d] = st.floorRect;
    ctx.fillStyle = '#050607';
    const L = st.cam.x - ex - 50, R = st.cam.x + ex + 50, Tp = st.cam.y - ey - 50, B = st.cam.y + ey + 50;
    if (L < a) ctx.fillRect(L, Tp, a - L, B - Tp);
    if (R > c) ctx.fillRect(c, Tp, R - c, B - Tp);
    if (B > d) ctx.fillRect(a, d, c - a, B - d);
  }
  if (raise) raise(ctx, 'lit'); // raised walls in sight (look.js), above the blackout
  { // the camera tilt follows your movement across the screen
    const p = st.pred, lp = st.tiltLast || p, k = dt > 0 ? 1 / dt : 0, vx = p && lp ? (p.x - lp.x) * k : 0, vy = p && lp ? (p.y - lp.y) * k : 0;
    st.tiltLast = p ? { x: p.x, y: p.y } : null;
    const jump = Math.hypot(vx, vy) > 600; // a floor change or respawn: no lean
    tilt.update(dt, jump ? 0 : (vx * cr - vy * sr) * z, jump ? 0 : (vx * sr + vy * cr) * z, shake, innerWidth, innerHeight);
    const de = document.documentElement; de.classList.toggle('tilt3d', tilt.on === true); de.classList.toggle('edgeblur', fxOn('blur') && gq.blur === true);
  }
  if (inGame && view) drawPeeps(); // GIMLET's peepholes, where you can see them
  if (inGame && view) { drawStairView(s, st.me, now); drawHatchView(s, st.me, now); drawWindowView(s, st.me, now, view); drawWindowMarks(s, view, now); ctx.setTransform(TA, TB, TC, TD, ox, oy); }
  if (st.tv && inGame) { // each team's sight, faintly in its own colour (pro team colours, else blue / orange)
    const pro = (s.tvl ?? PRO_LEVEL) === PRO_LEVEL;
    for (const sq of [0, 1]) {
      const col = pro && PRO_TEAMS[sq] ? PRO_TEAMS[sq].colour : sq ? '#ff8a3d' : '#46a8ff';
      ctx.fillStyle = col; ctx.globalAlpha = 0.13; ctx.beginPath();
      for (const v of st.viewers) if (v.tvSq === sq && !v.off) { const pts = visionPolygon(v, sm, 140); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); }
      ctx.fill('nonzero'); ctx.globalAlpha = 1;
    }
    // every working camera's view as a faint cone; brighter outline in the team colour while someone looks through it
    const watched = new Map(); for (const sp of s.players) if (sp.a && sp.cf) watched.set(sp.cf, sp.sq);
    ctx.lineWidth = 1.4 / (st.zoom || 1);
    for (const c of s.ents) {
      if (c.ty !== 'cam' || !(c.hp > 0) || c.off || floorAt(st.map, c.x, c.y) !== floorAt(st.map, st.cam.x, st.cam.y)) continue;
      const k = c.id + ':' + Math.round((c.ag || 0) * 50), pts = tvCamCone.get(k) || visionPolygon({ ...feedView(c, { id: null }), ang: c.ag || 0 }, [], 0);
      tvCamCone.set(k, pts); if (tvCamCone.size > 200) tvCamCone.clear();
      ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath();
      const sq = watched.get(c.id), on = sq !== undefined, col = on ? (pro && PRO_TEAMS[sq] ? PRO_TEAMS[sq].colour : sq ? '#ff8a3d' : '#46a8ff') : '#ffffff';
      ctx.globalAlpha = on ? 0.16 : 0.045; ctx.fillStyle = col; ctx.fill();
      ctx.globalAlpha = on ? 0.75 : 0.16; ctx.strokeStyle = col; ctx.stroke(); ctx.globalAlpha = 1;
    }
  }

  tq = pfa('fog', tq);
  // --- markers drawn above the blackout ---
  if (inGame && me) {
    ctx.font = '600 6px Barlow Condensed, sans-serif'; ctx.textAlign = 'center';
    for (const sp of s.players) {
      if (!sp.a || sp.id === me.id) continue;
      const p = interp(sp.id, 'players'); if (!p || p.x === undefined) continue;
      if (p.tm === side) {
        if (!sp.sg && !seen(p.x, p.y)) bodyOutline(p, p.dn ? '255,80,80' : '70,168,255', 0.75); // a teammate out of your sight (he asked): an outline, not their view
        const u = UP();
        ctx.fillStyle = p.dn ? '#ff5050' : '#3aa0ff'; ctx.beginPath(); ctx.arc(p.x + u.x * 17, p.y + u.y * 17, 2, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillText(p.n + (p.dn ? ' ▼' : ''), p.x + u.x * 21, p.y + u.y * 21);
      }
      if (sp.ef && (p.tm === side || seen(p.x, p.y))) {
        if (st.tv && sp.ef.some(e => e[0] === 'blind')) { const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 16); g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, 7); ctx.fill(); } // TV: who the flash got
        drawStatus(p, sp.ef, side, now, p.tm === side ? 28 : 27);
        ctx.font = '600 6px Barlow Condensed, sans-serif'; ctx.textAlign = 'center';
      }
      if (p.tm !== side && spotted.has(p.id)) {
        const u = UP(), tx = p.x + u.x * 19, ty = p.y + u.y * 19, px = -u.y, py = u.x; // spotted: a small faint triangle above them (he asked: fewer, quieter marks)
        ctx.fillStyle = 'rgba(255,70,60,0.5)';
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + u.x * 4 + px * 2.2, ty + u.y * 4 + py * 2.2); ctx.lineTo(tx + u.x * 4 - px * 2.2, ty + u.y * 4 - py * 2.2); ctx.closePath(); ctx.fill();
      }
    }
    // objective markers
    const site = m.sites[s.site];
    if (side === 'def' || s.rev) for (const b of site.bombs) marker(b.x, b.y, b.id, '#f2c14e', view);
    if (s.pl) marker(s.pl.x, s.pl.y, '!', '#ff4040', view);
    for (const e of ents) if (e.ty === 'defuser') { // a dropped defuser: both sides know where it lies (he asked), bigger for its first seconds
      const age = st.defDrop && Math.hypot(st.defDrop.x - e.x, st.defDrop.y - e.y) < 30 ? now - st.defDrop.t : 9;
      marker(e.x, e.y, 'D', '#f2c14e', view, 'DEFUSER', age < 4 ? 1.8 + 0.35 * Math.abs(Math.sin(age * 5)) : 1.2);
    }
    drawScanBlips(now);
    if (!st.tv && !(st.last && st.last.ar)) deathMarks(view, now); // TV: the cards and kill feed already say who is down; no big marks over the action
    if (!st.tv) scopeGlare(s, side, now);
    st.foesSeen = drawn.filter(p => p.tm !== side); // (the red ! at the screen edge for off-screen enemies is gone: he asked for fewer alert marks)
    // Sounds you can't see (he asked: hearing someone must not tell you exactly where to shoot blindly): no arrows
    // towards footsteps or gunfire any more. Only which floor: footsteps running on the floor just above or below
    // and gunfire there show as a faint "▲ FOOTSTEPS ABOVE" / "▼ GUNFIRE BELOW" by you, with no direction.
    const lv = view && localPos(m, view.x, view.y), vh = st.vertHint || (st.vertHint = {});
    if (view && view.kind === 'body') for (const sp of s.players) {
      if (!sp.a || sp.sg || sp.tm === side || sp.x === undefined || (sp.mv || 0) < 2) continue; // only running makes noise
      const p = interp(sp.id, 'players'); if (!p) continue;
      const lp = localPos(m, p.x, p.y), fd = lp.f - lv.f;
      if (fd && Math.abs(fd) === 1 && Math.hypot(lp.x - lv.x, lp.y - lv.y) < 300) vh[fd > 0 ? 'stepUp' : 'stepDown'] = now;
    }
    if (view && view.kind === 'body') floorHints(view, now, vh);
    // interaction progress ring
    if (me.a && me.bu && me.ct === 'body') {
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(st.pred.x, st.pred.y, 18, 0, 7); ctx.stroke();
      ctx.strokeStyle = '#f2c14e'; ctx.beginPath(); ctx.arc(st.pred.x, st.pred.y, 18, -Math.PI / 2, -Math.PI / 2 + me.bu.p * Math.PI * 2); ctx.stroke();
    }
    // reload ring round you (he asked): fills clockwise from screen-up; glides between snapshots using the gun's reload time
    const rw = WEAPONS[me.w];
    if (me.a && me.rl > 0 && rw && me.ct === 'body') {
      const rlen = me.rq || rw.reload; // the Tandem's quick flip is shorter
      const start = now - me.rl * rlen;
      if (!st.rlStart || st.rlW !== me.w || Math.abs(st.rlStart - start) > 0.25) { st.rlStart = start; st.rlW = me.w; }
      st.rlStart += (start - st.rlStart) * 0.1;
      const f = Math.min(1, Math.max(me.rl, (now - st.rlStart) / rlen)), u = UP(), a0 = Math.atan2(u.y, u.x);
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.arc(st.pred.x, st.pred.y, 14.5, 0, 7); ctx.stroke();
      ctx.strokeStyle = 'rgba(235,245,255,0.92)'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(st.pred.x, st.pred.y, 14.5, a0, a0 + f * Math.PI * 2); ctx.stroke();
      ctx.lineCap = 'butt';
    } else st.rlStart = 0;
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
  if (!st.r3full) screenFx(ctx, me, now, st.hurtFrom); // (in the 3D rope view they go on its own layer, #r3fx)
  if (st.tv && inGame) TV.tvBubbles(now);
  if (inGame) drawMarks(view, now);
  if (inGame && me && !menuOpen() && !st.tv) { if (st.mapV) drawMapV(s, me, now); } else if (st.mapV || st.wheel) { st.mapV = null; closeWheel(true); }
  if (st.wheel && (!playing() || menuOpen())) closeWheel(true);
  if (inGame && me && me.a && me.ct === 'body' && !st.mapV && !st.wheel && (!me.br || me.ri)) crosshair(me, now); // a riot shield's holder aims round it
  else if (inGame && !st.mapV && !st.wheel) { // drone / camera / spectating: a clear reticle (he asked: the old dot was too hard to see)
    const c = cursor(), r = 10 * DPR, t = 6 * DPR;
    for (const [col, w] of [['rgba(0,0,0,0.85)', 3.4 * DPR], ['#7dffb0', 1.6 * DPR]]) {
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, 7);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.moveTo(c.x + dx * (r + 2 * DPR), c.y + dy * (r + 2 * DPR)); ctx.lineTo(c.x + dx * (r + t), c.y + dy * (r + t)); }
      ctx.stroke();
    }
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(c.x, c.y, 2.6 * DPR, 0, 7); ctx.fill(); ctx.fillStyle = '#7dffb0'; ctx.beginPath(); ctx.arc(c.x, c.y, 1.6 * DPR, 0, 7); ctx.fill();
  }
  if (inGame && padOn && aimMode === 'pad' && !gpRecent() && !menuOpen()) aimPad();
  drawWheelNow();
}

// ESPORTS TV: what a player says floats above them for a few seconds, on a solid dark card in their own colour (he asked)
// where a teammate died: a red cross with their name, shown through walls and kept at the screen edge (he asked for
// these to be obvious now that you no longer see through teammates' eyes); pulses for the first few seconds.
// Someone who died on another floor shows at the same spot of the building on yours, with ▲ / ▼.
// Scope glare (he asked: snipers one-shot, so you must be able to spot one): an enemy aimed in with a sniper scope that
// points roughly at you (within ~8°) glints at their spot when nothing solid or smoke is between you, even beyond what you
// can otherwise see. Off screen, the glint sits small at the screen edge in their direction.
const GLARE_ANG = 0.14, GLARE_MAX = aimReach('sniper', true) * PX_PER_M;
function scopeGlare(s, side, now) {
  const me = st.me, v = st.pred; if (!me || !me.a || (me.dn && !(st.last && st.last.zb)) || me.ct !== 'body' || !st.map || !v) return; // (ZOMBIES: last stand still aims)
  const m = st.map, fl = floorAt(m, v.x, v.y), t = performance.now() / 1000;
  for (const p of st.fakeGlare ? s.players.concat(st.fakeGlare) : s.players) { // (st.fakeGlare: screenshot tests)
    if (!p.a || p.tm === side || !p.ad || p.dn || p.ct !== 'body' || p.x == null || !String(p.aa || '').includes('sniper') || p.gh) continue; // MOSS's ghillie: no glint
    const dx = v.x - p.x, dy = v.y - p.y, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    if (d < 3 * PX_PER_M || d > GLARE_MAX || floorAt(m, p.x, p.y) !== fl || Math.abs(angDiff(p.ag, a)) > GLARE_ANG) continue;
    if (castSight(m, p.x, p.y, a, d, null) < d - 6) continue; // a wall, a prop or boards in between
    if (smokes(s).some(q => { const u = Math.max(0, Math.min(1, ((q.x - p.x) * dx + (q.y - p.y) * dy) / (d * d))); return Math.hypot(p.x + dx * u - q.x, p.y + dy * u - q.y) < q.r; })) continue;
    const S0 = w2s(p.x, p.y), pad = 30 * DPR, on = S0.x > pad && S0.x < VW - pad && S0.y > pad && S0.y < VH - pad;
    const cx = Math.max(pad, Math.min(VW - pad, S0.x)), cy = Math.max(pad, Math.min(VH - pad, S0.y)), W0 = on ? { x: p.x + Math.cos(p.ag) * 7, y: p.y + Math.sin(p.ag) * 7 } : screenToWorld(cx, cy);
    const k = (on ? 2.5 : 1.5) * (0.85 + 0.25 * Math.sin(t * 9 + p.x)) * DPR / Math.max(0.4, st.zoom); // about 40 px across on screen, whatever the zoom
    ctx.save(); ctx.globalAlpha = 1; ctx.translate(W0.x, W0.y); ctx.scale(k, k);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 12); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,244,200,0.9)'); g.addColorStop(0.6, 'rgba(255,225,150,0.35)'); g.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 12, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,240,0.95)'; ctx.rotate(t * 0.6);
    for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(i % 2 ? 14 : 22, 0); ctx.lineTo(0, 1); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
}
// Status icons over a head (he asked: blind / slow / snare etc. shown to the side that caused it; TV sees all).
// ef from the snapshot: [[kind, seconds left, side that caused it], ...]; the ring round each badge runs down.
const EF_COL = { blind: '255,255,255', stun: '255,226,90', slow: '120,200,255', snare: '255,120,80', daze: '230,190,120', deaf: '200,140,255' };
const efMax = new Map(); // 'id:kind' -> { mx: time left when it started, last } (for the ring)
function drawStatus(p, ef, side, now, lift) {
  const list = ef.filter(e => st.tv || e[2] === side); if (!list.length) return;
  const u = UP(), th = Math.atan2(u.x, -u.y), R = 3.6, gap = 8.4;
  ctx.save(); ctx.translate(p.x + u.x * lift, p.y + u.y * lift); ctx.rotate(th);
  list.forEach(([k, left], i) => {
    const key = p.id + ':' + k, o = efMax.get(key); if (!o || left > o.last + 0.25) efMax.set(key, { mx: left, last: left }); else o.last = left; const mx = efMax.get(key).mx; if (efMax.size > 300) efMax.clear();
    const x = (i - (list.length - 1) / 2) * gap, col = EF_COL[k] || '255,255,255';
    ctx.fillStyle = 'rgba(10,14,20,0.8)'; ctx.beginPath(); ctx.arc(x, 0, R + 0.6, 0, 7); ctx.fill();
    ctx.strokeStyle = `rgba(${col},0.95)`; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(x, 0, R + 0.2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, left / mx)); ctx.stroke();
    ctx.strokeStyle = ctx.fillStyle = `rgb(${col})`; ctx.lineWidth = 0.7; ctx.lineCap = 'round'; ctx.beginPath();
    if (k === 'blind') { ctx.ellipse(x, 0, 2.4, 1.3, 0, 0, 7); ctx.moveTo(x - 2.2, 1.9); ctx.lineTo(x + 2.2, -1.9); } // an eye, struck through
    else if (k === 'stun') { ctx.moveTo(x + 0.8, -2.4); ctx.lineTo(x - 1, 0.2); ctx.lineTo(x + 1, 0.2); ctx.lineTo(x - 0.8, 2.4); } // a jolt
    else if (k === 'slow') { for (const d of [-1, 1]) { ctx.moveTo(x + d * 1.4 - 1, -1.6); ctx.lineTo(x + d * 1.4 + 0.6, 0); ctx.lineTo(x + d * 1.4 - 1, 1.6); } ctx.moveTo(x - 2.4, 2.4); ctx.lineTo(x + 2.4, 2.4); } // chevrons over a line
    else if (k === 'snare') { ctx.arc(x, 1.4, 2.2, Math.PI, 0); ctx.moveTo(x - 2.2, -1.4); ctx.lineTo(x + 2.2, -1.4); for (const d of [-1.2, 0, 1.2]) { ctx.moveTo(x + d, -1.4); ctx.lineTo(x + d, -0.2); } } // jaws
    else if (k === 'daze') { for (let a = 0; a < 9; a += 0.4) { const r = 0.3 + a * 0.24; ctx.lineTo(x + Math.cos(a) * r, Math.sin(a) * r); } } // a spiral
    else if (k === 'deaf') { ctx.arc(x - 0.4, -0.3, 1.6, Math.PI * 0.9, Math.PI * 2.3); ctx.lineTo(x - 0.6, 2); ctx.moveTo(x - 2.4, 2.2); ctx.lineTo(x + 2.4, -2.2); } // an ear, struck through
    ctx.stroke();
  });
  ctx.restore();
}
function bodyOutline(p, col, a) { // a body's shape and the way it aims, through walls
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ag || 0); ctx.strokeStyle = `rgba(${col},${a})`; ctx.lineWidth = 1.2; ctx.fillStyle = `rgba(${col},${a * 0.16})`;
  ctx.beginPath(); ctx.ellipse(0, 0, 7.5, 10, 0, 0, 7); ctx.fill(); ctx.stroke(); if (!p.dn) { ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(17, 0); ctx.stroke(); } ctx.restore();
}
function deathMarks(view, now) {
  if (!view || !st.map) return;
  const fl = floorAt(st.map, view.x, view.y), t = performance.now() / 1000;
  for (const c of st.corpses) {
    if (!c.ally) continue;
    let x = c.x, y = c.y, up = '';
    const cf = floorAt(st.map, c.x, c.y);
    if (cf >= 0 && fl >= 0 && cf !== fl) { // the same spot of the building, on your floor
      const L = localPos(st.map, c.x, c.y), F = st.map.floors[fl];
      x = L.x - (F.x0 - F.gx) * CELL; y = L.y - F.y0 * CELL; up = cf > fl ? '▲ ' : '▼ ';
    }
    const age = t - (c.t || 0), pulse = 1.8 * (age < 4 ? 1 + 0.3 * Math.abs(Math.sin(age * 5)) : 1);
    marker(x, y, '✖', '#ff4040', view, up + (c.n || 'Teammate'), pulse);
  }
}
function marker(x, y, label, col, view, sub, big = 1) {
  const z = st.zoom;
  // clamp to screen edges so you can always find it
  const S0 = w2s(x, y), sx = S0.x, sy = S0.y, pad = (st.tv ? 210 : 40) * DPR; // TV: stay clear of the team cards and comms
  const cx = Math.max(pad, Math.min(VW - pad, sx)), cy = Math.max(pad + 60 * DPR, Math.min(VH - pad - 60 * DPR, sy));
  const W0 = screenToWorld(cx, cy), wx = W0.x, wy = W0.y;
  const lift = cx === sx && cy === sy ? 14 : 0, u = UP();
  ctx.save(); ctx.translate(wx + u.x * lift, wy + u.y * lift); ctx.rotate(-(st.rot || 0)); if (big !== 1) ctx.scale(big, big);
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, 7); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = col; ctx.font = '700 7px Barlow Condensed, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 0, 0.5);
  if (view) { const d = Math.round(Math.hypot(x - view.x, y - view.y) / CELL * 0.8); ctx.font = '600 5px Barlow Condensed, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillText(d + 'm', 0, 9); }
  if (sub) { ctx.font = '700 5.5px Barlow Condensed, sans-serif'; ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(sub, 0, -9); ctx.fillStyle = col; ctx.fillText(sub, 0, -9); }
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

// the aim pad: a faint ring with a knob where the mouse is and a tick showing which way you face
function aimPad() {
  const P = pad(), z = st.zoom || 1;
  // fade right down when your own character is underneath it
  const P0 = w2s(st.pred.x, st.pred.y), near = Math.hypot(P0.x - P.x, P0.y - P.y) < P.r * 1.3;
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
  const gm = gunMods(me.w, attFromCode(me.aa));
  const srv = aimHeat(w, me.sh || 0, (me.fs ?? 99) + (now - (st.mineAt || now)), gm);
  const p = st.shotPred, own = p && p.w === me.w ? aimHeat(w, p.sh, now - p.t, gm) : 0;
  return Math.max(srv, own);
}

const sightLook = (sight, x, y, k) => drawSightLook(ctx, sight, x, y, k, DPR, scopeLensR()); // in crosshair.js, shared with the Armory
// the sniper's clear lens, in canvas px, and the blurred, dimmed view round it (#scopeVeil; its CSS only changes when it
// moves a pixel, so the browser isn't asked to redo the blur's mask every frame for nothing)
const scopeLensR = () => Math.min(VW, VH) * 0.1; // he asked for a third of the first size (it was 0.3)
function scopeVeil(p) {
  const el = $('scopeVeil');
  if (!p || st.tv) { setCls(el, 'hidden', true); st.veilK = ''; return; }
  setCls(el, 'hidden', false); setCls(el, 'flat', gfxLevel() === 'low');
  const k = Math.round(p.x / DPR) + ',' + Math.round(p.y / DPR) + ',' + Math.round(scopeLensR() / DPR);
  if (st.veilK === k) return; st.veilK = k;
  el.style.setProperty('--sx', Math.round(p.x / DPR) + 'px'); el.style.setProperty('--sy', Math.round(p.y / DPR) + 'px'); el.style.setProperty('--sr', Math.round(scopeLensR() / DPR) + 'px');
}
// the sniper lens magnifies (he asked): the map and people (#game) go into #lensA, the blackout into #lensF (greyed by
// CSS like #fog), both in #scopeLens, a round box over the lens above the veil; #over is magnified in place
function scopeLens(p, r, M) {
  const el = $('scopeLens');
  if (!p || st.tv) { setCls(el, 'hidden', true); st.lensK = ''; return; }
  setCls(el, 'hidden', false);
  const A = $('lensA'), F = $('lensF'), n = Math.ceil(r * 2), k = Math.round(p.x / DPR) + ',' + Math.round(p.y / DPR) + ',' + Math.round(r / DPR);
  if (A.width !== n) { A.width = A.height = F.width = F.height = n; }
  if (st.lensK !== k) { st.lensK = k; const s = r / DPR; el.style.width = el.style.height = (s * 2) + 'px'; el.style.transform = `translate(${p.x / DPR - s}px, ${p.y / DPR - s}px)`; }
  const a = A.getContext('2d'), sr = r / M;
  a.setTransform(1, 0, 0, 1, 0, 0); a.fillStyle = '#050607'; a.fillRect(0, 0, n, n);
  // the map: world -> lens px is (w2s(world) - p) * M + r
  const O = w2s(0, 0), ex = w2s(1, 0), ey = w2s(0, 1);
  a.setTransform((ex.x - O.x) * M, (ex.y - O.y) * M, (ey.x - O.x) * M, (ey.y - O.y) * M, (O.x - p.x) * M + r, (O.y - p.y) * M + r);
  const cs = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([u, v]) => screenToWorld(p.x + u * sr, p.y + v * sr)), m = st.rend.map;
  const wx0 = Math.max(0, Math.min(...cs.map(q => q.x)) - 4), wy0 = Math.max(0, Math.min(...cs.map(q => q.y)) - 4);
  const wx1 = Math.min(m.W * CELL, Math.max(...cs.map(q => q.x)) + 4), wy1 = Math.min(m.H * CELL, Math.max(...cs.map(q => q.y)) + 4), G = st.rend.c.width / st.rend.Wp;
  if (wx1 > wx0 && wy1 > wy0) st.rend.c.drawTo(a, wx0 * G, wy0 * G, (wx1 - wx0) * G, (wy1 - wy0) * G, wx0, wy0, wx1 - wx0, wy1 - wy0);
  a.setTransform(1, 0, 0, 1, 0, 0);
  a.drawImage(cv, p.x - sr, p.y - sr, sr * 2, sr * 2, 0, 0, n, n);
  const f = F.getContext('2d'); f.clearRect(0, 0, n, n);
  if (fogShown) { const fk = fog.width / VW; f.drawImage(fog, (p.x - sr) * fk, (p.y - sr) * fk, sr * 2 * fk, sr * 2 * fk, 0, 0, n, n); }
  magnify(ctx, ctx.canvas, p.x, p.y, r, M);
}
function drawWheelNow() { if (st.wheel) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); drawWheel(ctx, st.wheel, DPR); ctx.restore(); } }
function crosshair(me, now) {
  if (st.tv) return; // watching: no crosshair of your own on the broadcast
  const w = WEAPONS[me.w];
  const gm = gunMods(me.w, attFromCode(me.aa));
  // recoil kicks the crosshair round your character: pull the mouse against it
  const P0 = w2s(st.pred.x, st.pred.y), px = P0.x, py = P0.y;
  // glides to the server's recoil (it arrives 20 times a second) instead of jumping; 25 ms behind at most
  const dtx = Math.min(0.1, now - (st.rcT || now)); st.rcT = now;
  st.rcShow = Math.abs((me.rc || 0) - (st.rcShow || 0)) > 0.3 ? me.rc || 0 : (st.rcShow || 0) + ((me.rc || 0) - (st.rcShow || 0)) * (1 - Math.exp(-dtx / 0.025));
  const rc = st.rcShow, c = Math.cos(rc), s2 = Math.sin(rc);
  const m = cursor(), x = px + (m.x - px) * c - (m.y - py) * s2, y = py + (m.x - px) * s2 + (m.y - py) * c;
  // the gap is the true cone the next shot can land in, measured at the crosshair: shut when the next shot is exact
  const run = Math.min(1, Math.hypot(st.pred.vx || 0, st.pred.vy || 0) / BASE_SPEED);
  const cone = w ? spreadCone(w, gm, { at: me.at || 0, run, crouch: !!me.cr, shots: gunHeat(me, w, now) }) : 0;
  const spread = xh.dynamic ? Math.tan(cone) * Math.hypot(m.x - px, m.y - py) / DPR : 0;
  // aiming in: each enemy you can see shows the zone your crosshair must be on for a headshot; it lights red when it is
  if (me.pp) { // winding up a throw / setting something down (he asked): a ring filling round you, and what it is
    const [kd, left, dur] = me.pp, f = Math.max(0, Math.min(1, 1 - (left - (now - (st.mineAt || now))) / dur));
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 5 * DPR; ctx.beginPath(); ctx.arc(P0.x, P0.y, 22 * DPR, -Math.PI / 2, Math.PI * 1.5); ctx.stroke();
    ctx.strokeStyle = kd === 1 ? '#f2c14e' : '#7dffb0'; ctx.lineWidth = 3 * DPR; ctx.beginPath(); ctx.arc(P0.x, P0.y, 22 * DPR, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke();
    ctx.font = `700 ${11 * DPR}px Barlow Condensed, sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(kd === 1 ? 'THROWING' : 'SETTING UP', P0.x, P0.y + 36 * DPR);
  }
  if (st.cmpDir != null) { // a discreet gold chevron at your feet pointing the way to the stairs / bomb site
    const a = st.cmpDir + (st.rot || 0), r = 30 * DPR, cx0 = P0.x + Math.cos(a) * r, cy0 = P0.y + Math.sin(a) * r;
    ctx.save(); ctx.translate(cx0, cy0); ctx.rotate(a); ctx.globalAlpha = 0.75; ctx.fillStyle = '#f2c14e'; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 1.5 * DPR;
    ctx.beginPath(); ctx.moveTo(6 * DPR, 0); ctx.lineTo(-3 * DPR, -5 * DPR); ctx.lineTo(-1 * DPR, 0); ctx.lineTo(-3 * DPR, 5 * DPR); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore();
  }
  const LM = me.at > 0.3 && me.ct === 'body' && sniperOn(me) ? lensMag(me.at) : 1, LR = scopeLensR();
  scopeLens(LM > 1.01 ? { x, y } : null, LR, LM);
  if (me.at > 0.05 && me.ct === 'body' && fxOn('sight')) sightLook(attFromCode(me.aa).sight, x, y, Math.min(1, me.at));
  scopeVeil(me.at > 0.3 && me.ct === 'body' && sniperOn(me) ? { x, y } : null);
  if (me.ad && st.heads) for (const h of st.heads) {
    const H0 = w2s(h.x, h.y), H = lensPt(H0.x, H0.y, x, y, LR, LM); if (!H) continue;
    const r = Math.max(2.5 * DPR, HEAD_AIM * (st.zoom || 1)) * H.k, on = Math.hypot(x - H.x, y - H.y) <= r;
    ctx.lineWidth = (on ? 2 : 1.2) * DPR;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.arc(H.x, H.y, r + 1.2 * DPR, 0, 7); ctx.stroke();
    ctx.strokeStyle = on ? '#ff3b3b' : 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(H.x, H.y, r, 0, 7); ctx.stroke();
    if (on) { ctx.fillStyle = 'rgba(255,59,59,0.22)'; ctx.fill(); }
  }
  const fq = freeAimOn() && padOn && !gpRecent() ? freeAimPoint() : null;
  wallHeld(fq, now);
  if (sliding() || (aimMode === 'face' && padOn && !gpRecent() && adsHeld() && me.ct === 'body')) { // aimed in (Face) or sliding: the narrow area you are locked to
    const ca = sliding() ? st.pred.slA : st.faceC ?? padAng, R = Math.hypot(m.x - px, m.y - py);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1 * DPR;
    ctx.beginPath(); ctx.arc(px, py, R, ca - FACE_ADS, ca + FACE_ADS); ctx.stroke();
    for (const e of [ca - FACE_ADS, ca + FACE_ADS]) { const q = 7 * DPR; ctx.beginPath(); ctx.moveTo(px + Math.cos(e) * (R - q), py + Math.sin(e) * (R - q)); ctx.lineTo(px + Math.cos(e) * (R + q), py + Math.sin(e) * (R + q)); ctx.stroke(); }
  }
  if (fq && st.reachW) { // near the edge of your reach (he chose): a faint ring round you fades in
    const R = st.reachW * (st.zoom || 1), f = Math.max(0, Math.min(1, (Math.hypot(aimOff.x, aimOff.y) / st.reachW - 0.82) / 0.16));
    if (f > 0) { ctx.save(); ctx.globalAlpha = f * 0.35; ctx.strokeStyle = '#fff'; ctx.lineWidth = DPR; ctx.setLineDash([6 * DPR, 6 * DPR]); ctx.beginPath(); ctx.arc(px, py, R, 0, 7); ctx.stroke(); ctx.restore(); }
  }
  if (me.mv === 3) ctx.globalAlpha = 0.3; // sprinting: gun down
  else { st.xhFade = (st.xhFade ?? 1) + ((fq && fq.stopped ? 0.45 : 1) - (st.xhFade ?? 1)) * Math.min(1, (now - (st.xhFadeT || now)) * 14); ctx.globalAlpha = st.xhFade; } // bullets stop at a wall before it: faded, gliding (no flicker past door frames)
  st.xhFadeT = now;
  if (!(sniperOn(me) && me.at > 0.6 && me.ct === 'body')) drawXhair(ctx, x, y, xh, spread, DPR); // (the sniper reticle takes over)
  ctx.globalAlpha = 1;
  // points popups under the crosshair (he asked, R6-style): newest at the top, each fades after a couple of seconds
  ptsPopups(ctx, x, y, now);
  // far out: how far away the crosshair is (it can go anywhere you can see)
  if (fq) {
    const q = fq, dm = q.ad / PX_PER_M;
    if (q.blocked) { // something in the way: a tick on it and a dotted line on to the crosshair
      const G = w2s(q.wx, q.wy), gx = px + (G.x - px) * c - (G.y - py) * s2, gy = py + (G.x - px) * s2 + (G.y - py) * c;
      ctx.setLineDash([2 * DPR, 3 * DPR]); ctx.lineWidth = 1.2 * DPR; ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]);
      const na = Math.atan2(y - gy, x - gx) + Math.PI / 2, tl = 5 * DPR;
      ctx.lineCap = 'round';
      if (q.stopped) { // bullets stop here: a bracket hugging the wall, orange; held on the same wall 1.5 s it turns blue (aiming in then ignores it)
        const blue = wallBlue(), H = st.wallHold, pk = blue && H.pop ? Math.max(0, 1 - (now - H.pop) / 0.25) : 0, k = (1 + 0.35 * pk) * DPR;
        const ux = Math.cos(na), uy = Math.sin(na), bx = (x - gx), by = (y - gy), bl = Math.hypot(bx, by) || 1, tx = bx / bl, ty = by / bl; // along the wall / back toward the crosshair
        const W = 8.5 * k, A = -6 * k, cx = gx - tx * 2 * DPR, cy = gy - ty * 2 * DPR; // (A < 0: the arms point back toward you)
        const path = () => { ctx.beginPath(); ctx.moveTo(cx - ux * W + tx * A, cy - uy * W + ty * A); ctx.lineTo(cx - ux * W, cy - uy * W); ctx.lineTo(cx + ux * W, cy + uy * W); ctx.lineTo(cx + ux * W + tx * A, cy + uy * W + ty * A); };
        const col = blue ? '79,179,255' : '255,138,61';
        ctx.lineJoin = 'round'; path();
        ctx.strokeStyle = `rgba(${col},0.22)`; ctx.lineWidth = 8 * DPR; ctx.stroke(); // soft halo
        ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.lineWidth = 4.6 * DPR; ctx.stroke();
        ctx.strokeStyle = `rgb(${col})`; ctx.lineWidth = 2.4 * DPR; ctx.stroke(); ctx.lineJoin = 'miter';
      } else {
        ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 4 * DPR; ctx.beginPath(); ctx.moveTo(gx - Math.cos(na) * tl, gy - Math.sin(na) * tl); ctx.lineTo(gx + Math.cos(na) * tl, gy + Math.sin(na) * tl); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2 * DPR; ctx.beginPath(); ctx.moveTo(gx - Math.cos(na) * tl, gy - Math.sin(na) * tl); ctx.lineTo(gx + Math.cos(na) * tl, gy + Math.sin(na) * tl); ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }
    if (dm >= 8) {
      ctx.font = `700 ${12 * DPR}px Barlow Condensed, sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.lineWidth = 3 * DPR; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.strokeText(`${Math.round(dm)} m`, x + 12 * DPR, y + 10 * DPR);
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillText(`${Math.round(dm)} m`, x + 12 * DPR, y + 10 * DPR);
      ctx.textBaseline = 'alphabetic';
    }
  }
  hitMark(ctx, x, y, now);
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
  const joined = !!st.id || !!(st.tv && s); // ESPORTS TV: a viewer is in the match even before following anyone
  show('splash', !st.started);
  show('lobby', st.started && (phase === PHASE.LOBBY || !joined));
  // music in the menus, silence in the field
  if (st.started) {
    const want = !joined || phase === PHASE.LOBBY || phase === PHASE.SELECT || phase === PHASE.MATCH_END;
    if (want !== st.music) { st.music = want; want ? startMusic(phase === PHASE.SELECT ? 'select' : 'menu') : stopMusic(); }
    if (want) setMood(phase === PHASE.SELECT ? 'select' : 'menu');
  }
  countdown(s, phase);
  show('select', joined && phase === PHASE.SELECT && !st.tv);
  show('tvDraft', !!st.tv && joined && phase === PHASE.SELECT); document.documentElement.classList.toggle('tvsel', !!st.tv && phase === PHASE.SELECT);
  document.documentElement.classList.toggle('arena', !!(s && s.ar));
  document.documentElement.classList.toggle('zombies', !!(s && s.zb)); if (s && s.zb) zbHud(s, st.me); // fun modes: no gadget slots, drone bar or team panel
  show('hud', joined && (phase === PHASE.PREP || phase === PHASE.ACTION || phase === PHASE.ROUND_END));
  show('endscreen', joined && (phase === PHASE.MATCH_END || st.forceEnd));
  show('leaveBtn', joined && phase !== PHASE.LOBBY);
  if (st.bannerT && now > st.bannerT) { $('banner').classList.remove('show'); st.bannerT = 0; }
  if (!s || now - st.lastHud < 0.08) return;
  st.lastHud = now;
  if (phase === PHASE.LOBBY) renderLobby(s);
  else if (phase === PHASE.SELECT) { if (st.tv) TV.tvDraft(s); else { buildSelect(s); banPick(s); } }
  else if (phase !== PHASE.MATCH_END) hud(s);
  $('scoreboard').classList.toggle('hidden', !keys.has('scoreboard'));
  if (keys.has('scoreboard')) $('scoreboard').innerHTML = scoreTable(s);
}

// Quick Match's beginner help (he asked): big TEAMMATES LEFT / ENEMIES LEFT numbers and one line saying what to do now.
// Only in Quick Match (s.md 'quick'); Unranked and Ranked show less.
function beginnerHelp(s, me, mine, theirs) {
  const on = s.md === 'quick' && !st.tv && (s.ph === PHASE.PREP || s.ph === PHASE.ACTION);
  setCls($('leftCount'), 'hidden', !on); setCls($('tipNow'), 'hidden', !on);
  if (!on) return;
  const up = l => l.filter(p => p.a).length;
  setText($('leftCount').querySelector('.lcA b'), String(up(mine))); setText($('leftCount').querySelector('.lcE b'), String(up(theirs)));
  setHTML('tipNow', esc(tipNow(s, me, mine)).replace(/\[([^\]]+)\]/g, '<kbd>$1</kbd>'));
}
function tipNow(s, me, mine) {
  const K = id => '[' + label(id) + ']', side = me.tm, site = st.map.sites[s.site], prep = s.ph === PHASE.PREP;
  if (!me.a) return 'You are out this round. Watch your team, and mark enemies on the cameras to help them';
  if (me.dn) return 'You are down: crawl into cover. A teammate can pick you up';
  const p = st.pred || me, downMate = mine.find(q => q.id !== st.id && q.a && q.dn && q.x !== undefined && Math.hypot(q.x - p.x, q.y - p.y) < 400);
  if (downMate) return `${downMate.n.replace(/^\[\w+\] /, '')} is down nearby: go to them and hold ${K('interact')} to pick them up`;
  const inSite = site && site.rooms.includes(roomAt(st.map, p.x, p.y));
  if (side === 'atk') {
    if (prep) return me.ct === 'drone' ? `Drive your drone into the building and look at the gold site. Press ${K('spot')} on defenders you see to mark them for your team` : `Press ${K('drone')} to drive your drone and scout the site before the round starts`;
    if (me.ct === 'drone') return `Press ${K('drone')} to go back to your body`;
    if (s.pl) return 'The defuser is planted: stay out of sight and shoot anyone who comes to disable it';
    if (me.df) return inSite ? `You are in the site: hold ${K('interact')} to plant the defuser` : 'You carry the defuser: follow the compass to the site, then plant it there';
    return `Follow the compass to ${site ? site.name : 'the site'}. Shoot through soft walls, or open them with explosives (${K('gadget')})`;
  }
  if (prep) return s.rf > 0 ? `Hold ${K('interact')} on the site's walls to make them bulletproof (${s.rf} left). Doors and windows get boards the same way` : 'Find a spot near the site that covers a door, and wait there';
  if (s.pl) return `The defuser is planted! Find it (red on your screen) and hold ${K('interact')} on it to disable it`;
  if (me.ct === 'cam') return `Press ${K('spot')} to mark attackers you see. ${K('view')} goes back to your body`;
  return `Stay close to ${site ? site.name : 'the site'} and listen. Press ${K('view')} to watch the cameras`;
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
  const hs = st.tv ? 0 : me.sq, mine = s.players.filter(p => p.sq === hs), theirs = s.players.filter(p => p.sq !== hs && !(p.zb && p.zb[0] === 1));
  setHTML('tiL', icons(mine, true)); setHTML('tiR', icons(theirs, !!st.tv));
  if (s.zb) { setText('scL', s.zb.r); setText('scR', s.zb.left); } else if (s.ar) { const [l, r] = arenaScores(s, me); setText('scL', l); setText('scR', r); } else { setText('scL', s.sc[hs]); setText('scR', s.sc[1 - hs]); }
  if (st.tv) TV.tvHud(s);
  const t = s.pl ? s.pl.t : s.tm;
  setText('time', s.fp && !s.pl ? '∞' : `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`);
  setCls($('time'), 'planted', !!s.pl);
  setText('phase', s.zb ? 'ZOMBIES' : s.ar ? 'FUN MODE' : s.pl ? 'DEFUSER' : s.fp ? 'FREE PLAY' : s.ph === PHASE.PREP ? 'PREPARATION' : s.ph === PHASE.ACTION ? 'ACTION' : 'ROUND OVER');
  setText('roundNo', s.zb ? `ROUND ${s.zb.r} · ZOMBIES LEFT ${s.zb.left}` : s.ar ? (MODES[s.ar.m] || {}).name : s.fp ? (side === 'atk' ? 'ATTACK' : 'DEFENCE') : `${s.ot ? 'OVERTIME · ' : ''}ROUND ${s.rd} · ${side === 'atk' ? 'ATTACK' : 'DEFENCE'}`);
  beginnerHelp(s, me, mine, theirs);
  // free play: which keys switch operator, and who you'd get
  $('freeHint').classList.toggle('hidden', !s.fp);
  if (!playing() || (!st.camLock && !flashCamTag.t)) setCls($('camTag'), 'hidden', true); else if (st.camLock) setCls($('camTag'), 'hidden', false);
  if (s.fp && me.op) {
    const all = [...opsForTeam('atk'), ...opsForTeam('def')], i = all.indexOf(me.op), n = all.length;
    const nm = k => `${OPERATORS[k].name}${OPERATORS[k].team !== side ? (OPERATORS[k].team === 'atk' ? ' (attack)' : ' (defence)') : ''}`;
    if (isTouch) setHTML('freeHint', `<b>GOD MODE</b> · <button id="freeOpsBtn">OPERATORS · GUNS · BOTS</button> · <b>${esc(OPERATORS[me.op].name)}</b>`); else
    setHTML('freeHint', `<b>GOD MODE</b> · <button id="freeOpsBtn"><kbd>${esc(label('opGrid'))}</kbd> OPERATORS · GUNS · BOTS</button> · <kbd>${esc(label('opPrev'))}</kbd> ${esc(nm(all[(i - 1 + n) % n]))} · <b>${esc(OPERATORS[me.op].name)}</b> · ${esc(nm(all[(i + 1) % n]))} <kbd>${esc(label('opNext'))}</kbd>`);
    const fb = $('freeOpsBtn'); if (fb && !fb.onclick) fb.onclick = () => toggleFreeOps();
  }
  // objective
  let obj, sub = '';
  const where = me.a && me.x !== undefined ? roomAt(st.map, st.pred.x, st.pred.y) : '';
  if (side === 'def') {
    obj = s.pl ? 'DISABLE THE DEFUSER!' : s.ph === PHASE.PREP ? `FORTIFY: ${site.name}` : `DEFEND: ${site.name}`;
    sub = s.ph === PHASE.PREP ? `Reinforcements left: ${s.rf} · hold ${label('interact')} on walls to reinforce, ${label('interact')} on doors/windows to barricade (as many as you like), melee soft walls for rotation holes` : `Reinforcements left: ${s.rf}`;
    if (s.ph === PHASE.ACTION && !s.pl && s.ents.some(e => e.ty === 'defuser')) sub = 'The defuser is on the ground · keep them off it · ' + sub;
  } else {
    obj = s.pl ? 'PROTECT THE DEFUSER' : s.ph === PHASE.PREP ? 'LOCATE THE OBJECTIVE WITH YOUR DRONE' : s.rev ? `PLANT THE DEFUSER: ${site.name}` : 'FIND THE OBJECTIVE';
    if (me.df) sub = 'You are carrying the defuser';
    else { const c = s.players.find(p => p.df); sub = c ? `${c.n} has the defuser` : 'The defuser is on the ground'; }
  }
  if (s.ar) [obj, sub] = arenaObjective(s, me);
  if (s.zb) [obj, sub] = zbObjective(s, me);
  const fi = me.a && me.x !== undefined ? floorAt(st.map, st.pred.x, st.pred.y) : -1;
  const flName = fi >= 0 && st.map.floors.length > 1 ? st.map.floors[fi].name : '';
  setHTML('objective', `${esc(obj)}<small>${flName ? '<b class="flr">' + esc(flName) + '</b> ' : ''}${esc(sub)}${where ? ' · ' + esc(where) : ''}</small>`);
  if (!me.a) {
    setHTML('opname', me.op ? `${OPERATORS[me.op].name}` : '');
    setText('hpnum', '—'); $('hpbar').firstElementChild.style.width = '0%';
    setText('status', 'ELIMINATED'); $('br').style.visibility = 'hidden';
    setHTML('prompt', ''); $('progress').style.display = 'none';
    const mates = s.players.filter(p => p.a && p.sq === me.sq);
    if (s.zb) setText('viewlabel', 'YOU ARE OUT · BACK NEXT ROUND IF ANYONE SURVIVES'); else
    if (s.ar) setText('viewlabel', me.ar && me.ar[4] ? 'OUT OF LIVES · WATCHING' : 'BACK IN A MOMENT'); else
    setText('viewlabel', mates.length ? `SPECTATING ${mates[st.spect % mates.length].n.toUpperCase()} · CLICK TO SWITCH` : '');
    setCls($('kcBtn'), 'hidden', !st.killcam || !!st.tv); setHTML('kcBtn', `<b>${label('interact')}</b> WATCH KILLCAM`);
    const kc = st.killcam && !st.tv ? st.killcam : null;
    setCls($('deathCard'), 'hidden', !kc); if (kc) { setHTML('deathCard', kc.card || (kc.card = deathCard(kc))); setCls($('deathCard'), 'team', !!(kc.team || kc.self)); }
    return;
  }
  $('br').style.visibility = ''; setCls($('kcBtn'), 'hidden', true); setCls($('deathCard'), 'hidden', true); if (st.killcam && performance.now() - st.killcam.got > 3000) st.killcam = null; // alive again: the old killcam is gone
  const o = OPERATORS[me.op];
  setHTML('opname', `${o.name}<small>${o.role.toUpperCase()}</small>`);
  setText('hpnum', me.hp);
  const bar = $('hpbar').firstElementChild;
  const barW = Math.min(100, me.hp / me.mhp * 100) + '%', barC = me.hp > me.mhp ? 'over' : me.hp < 35 || me.dn ? 'low' : '';
  if (bar.style.width !== barW) bar.style.width = barW;
  if (bar.className !== barC) bar.className = barC;
  setText('status', me.dn ? `${s.zb ? 'LAST STAND' : 'DOWNED'} — BLEEDING OUT · ${Math.ceil(me.hp)}s` : me.df ? 'DEFUSER CARRIER' : '');
  const w = WEAPONS[me.w];
  setText('wname', w ? `${w.name.toUpperCase()} · ${CLASS_NAME[w.cls].toUpperCase()}` : '');
  const pk = me.w + '|' + me.aa;
  if ($('wpic').dataset.k !== pk) { $('wpic').dataset.k = pk; $('wpic').innerHTML = ''; if (me.w) $('wpic').appendChild(gunPicture(me.w, attFromCode(me.aa), 150, 49)); }
  setText('mag', me.rl > 0 ? '··' : me.am); { const mc = w && me.am <= w.mag * 0.25 ? 'low' : ''; if ($('mag').className !== mc) $('mag').className = mc; }
  setText('res', '/ ' + me.rs);
  const ab = o.ability, g = GADGETS[me.gd || o.gadget];
  const abCount = ab.battery ? `${Math.round(me.bat / ab.battery * 100)}%` : ab.count ? me.ac : '';
  const viewName = side === 'atk' ? `Drone${s.ph === PHASE.ACTION ? ' ×' + me.dr : ''}` : 'Cameras';
  const salvoWait = ab.id === 'sticky' ? s.ents.filter(e => e.ty === 'sticky' && e.ow === me.id && e.st).length : 0; // SALVO: rounds waiting for her
  st.tBadge = { skill: me.gi || salvoWait || me.lu ? '!' : String(abCount), gadget: me.ni ? '!' : String(me.gc ?? ''), view: side === 'atk' && s.ph === PHASE.ACTION ? String(me.dr ?? '') : '' };
  if (s.zb) setHTML('gadgets', `<div class="${me.gc <= 0 ? 'out' : ''}"><b>${label('gadget')}</b>${g.name}<em>${me.gc}</em></div>`); else // ZOMBIES: grenades only
  setHTML('gadgets',
    `<div class="${ab.count && me.ac <= 0 ? 'out' : ''}"><b>${label('ability')}</b>${me.gi ? 'Release the gas' : me.scd ? `${ab.name} ready in ${Math.ceil(me.scd)}s` : salvoWait ? `Detonate ${salvoWait} round${salvoWait > 1 ? 's' : ''}` : me.lu ? `Lunge ready ${Math.ceil(me.lu)}s · ${label('melee')}` : me.ap ? 'Piercing round loaded' : me.bp ? 'Bipod down · press to lift' : me.su2 ? `Spotting ${Math.ceil(me.su2)}s · aim in` : me.gw2 ? `Ghillie ${Math.ceil(me.gw2)}s` : ab.name}<em>${me.gi || salvoWait ? '!' : abCount}</em></div>` +
    `<div class="${me.gc <= 0 && !me.ni ? 'out' : ''}"><b>${label('gadget')}</b>${me.ni ? 'Detonate Nitro' : g.name}<em>${me.ni ? '!' : me.gc}</em></div>` +
    `<div><b>${label('view')}</b>${viewName}</div>`);
  // view label
  let vl = '';
  const myBird = me.ct === 'drone' ? s.ents.find(e => e.id === me.did && e.ty === 'bird') : null;
  if (myBird) vl = myBird.pe ? `YOUR BIRD · LANDED · <b>${label('reload')}</b> AUTO PING: ${myBird.au ? 'ON (pings the first attacker it sees, then flashes and is gone)' : 'OFF (only watches)'} · <b>${label('interact')}</b> TAKE OFF · <b>${label('ability')}</b> SWARM`
    : `YOUR BIRD · FLIES OVER FURNITURE · <b>${label('interact')}</b> LAND ON A WALL · <b>${label('ability')}</b> SWARM · ${label('view')} TO EXIT`;
  else if (me.ct === 'drone') { const d = s.ents.find(e => e.id === me.did); const sp = me.dsl > 0 ? `SPRINTING ${me.dsl.toFixed(1)}s` : !me.ds ? 'NO SPRINTS LEFT' : me.dsc > 0 ? `SPRINT IN ${Math.ceil(me.dsc)}s (${me.ds} LEFT)` : `${gpRecent() ? (isTouch ? 'SPRINT' : 'B') : label('walk')}: SPRINT (${me.ds} LEFT)`.replace('SPRINT: SPRINT', 'HOLD SPRINT');
    vl = d && d.j ? 'DRONE JAMMED' : isTouch ? `YOUR DRONE · ${sp} · PING TO MARK · ◀ ▶ TEAM DRONES` : `YOUR DRONE · ${sp} · CLICK OR ${label('spot')} TO PING · ${label('leanL')} ${label('leanR')}: TEAM FEEDS · ${label('drone')} TO EXIT`; }
  else if (me.ct === 'cam') {
    const list = feedList(s, me), c = list.find(e => e.id === me.fi);
    if (c) {
      const ro = c.ow && c.ow !== me.id, who = ro ? `${ownerName(s, c.ow).toUpperCase()}'S ` : c.ow ? 'YOUR ' : '';
      vl = `${FEED_GROUPS[feedGroup(c)]} · ${who}${feedKind(c)} ${list.indexOf(c) + 1}/${list.length} · ${(roomAt(st.map, c.x, c.y) || 'outside').toUpperCase()} · ${ro || c.ty !== 'cam' ? 'WATCH ONLY' : 'MOUSE LOOK'} · ${label('leanL')} ${label('leanR')} SWITCH · CLICK PING${c.off || c.j ? ' · DISRUPTED' : ''}`;
    }
  }
  setText('viewlabel', vl);
  camBar(s, me);
  // interaction
  if (me.bu) {
    $('progress').style.display = 'block';
    $('progress').querySelector('.label').textContent = { plant: 'PLANTING DEFUSER', defuse: 'DISABLING DEFUSER', revive: 'REVIVING', reinforce: 'REINFORCING', barricade: 'BARRICADING' }[me.bu.k] || '';
    $('progress').querySelector('i').style.width = me.bu.p * 100 + '%';
    setHTML('prompt', '');
  } else {
    $('progress').style.display = 'none';
    const pt = me.ct === 'body' && !me.dn ? promptText(s, me) : '';
    if (me.dn && me.su !== undefined) { setHTML('prompt', `GETTING BACK UP… ${Math.round(me.su * 100)}%`); } else // the health operators get up by themselves
    setHTML('prompt', isTouch ? pt.replace(/<b>([A-Z ]+)<\/b>\1(?![A-Z])/g, '<b>$1</b>') : pt); // phone: no "VAULT VAULT"
  }
  if (isTouch) { const ph = $('prompt').innerHTML; touchContext({ use: ph.includes('<b>' + label('interact') + '</b>'), vault: ph.includes('<b>' + label('vault') + '</b>'), cams: me.ct !== 'body', drone: me.ct === 'drone', body: me.ct === 'body' && !me.dn, lean: st.leanT || 0, badge: st.tBadge || {} }); }
}
function setHTML(id, h) { const el = typeof id === 'string' ? $(id) : id; if (!el) return; if (el.innerHTML !== h) el.innerHTML = h; }
// (he said it got laggy: the HUD rewrote about a dozen elements ten times a second even when nothing had changed)
function setText(id, v) { const el = typeof id === 'string' ? $(id) : id, t = String(v); if (el && el.textContent !== t) el.textContent = t; }
function setCls(el, c, on) { if (el.classList.contains(c) !== on) el.classList.toggle(c, on); }

// Esports TV (he asked): rings by side, defenders blue and attackers orange, whoever the camera rides with
const tvRing = p => st.tv && p && p.tm ? p.tm === 'def' : undefined;
// role icons (he asked): simple line drawings in the button's colour
const RI = {
  breach: '<path d="M12 2l2 6 6-3-3 6 6 2-6 2 3 6-6-3-2 6-2-6-6 3 3-6-6-2 6-2-3-6 6 3z"/>',
  entry: '<path d="M14 3h6v18h-6"/><path d="M3 12h11M10 8l4 4-4 4"/>',
  intel: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  support: '<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/><path d="M12 8v8M8 12h8"/>',
  flank: '<path d="M4 20V10a6 6 0 0 1 6-6h8"/><path d="M14 0.5l4 3.5-4 3.5"/>',
  anchor: '<circle cx="12" cy="5" r="2"/><path d="M12 7v14M8 10h8"/><path d="M4 13a8 8 0 0 0 16 0"/>',
  trapper: '<path d="M3 14a9 9 0 0 0 18 0z"/><path d="M6 14l2-3 2 3 2-3 2 3 2-3 2 3"/>',
  roamer: '<path d="M8 3c2 0 2.5 3 2 5s-1 3-3 3-2.5-2-2.5-4S6 3 8 3z"/><path d="M16 10c2 0 2.5 3 2 5s-1 3-3 3-2.5-2-2.5-4 1.5-4 3.5-4z"/><path d="M6 13.5h3M14 20.5h3"/>',
};
const roleIcon = id => RI[id] ? `<svg class="rIcon" viewBox="0 0 24 24" aria-hidden="true">${RI[id]}</svg>` : '';
function promptText(s, me) {
  const side = me.tm, x = st.pred.x, y = st.pred.y, m = st.map;
  if (s.zb && me.a && !me.dn) { const z = zbPrompt(s, me, x, y); if (z !== null) return z; }
  if (me.ro && r3on() && me.ro[0]) { const r = m.ropes[me.ro[1]], atW = r && ropeAtWindow(r, x, y); // the 3D rope view's keys (R6's)
    const inW = atW ? (ropeWindowOpen(m, r) ? `<b>${label('vault')}</b>CLIMB IN  ·  ` : ropeWindowBoarded(m, r) ? `<b>${label('vault')}</b>SMASH IN  ·  ` : '') : '';
    return `${inW}<b>${label('up')}</b>/<b>${label('down')}</b>UP · DOWN  ·  <b>${label('left')}</b>/<b>${label('right')}</b>ALONG  ·  <b>${label('crouch')}</b>${me.ro[5] ? 'RIGHT WAY UP' : 'UPSIDE DOWN'}  ·  <b>${label('interact')}</b>LET GO`; }
  if (me.ro) { // on a rope
    if (!me.ro[0]) return me.ro[2] < 0 && !me.ro[4] ? 'LETTING GO…' : `CLIMBING ${Math.round(me.ro[3] * 100)}%`;
    const r = m.ropes[me.ro[1]], atW = r && ropeAtWindow(r, x, y), hop = (i, n) => n >= 0 ? m.floors[m.ropes[n].f].name : i;
    const what = !atW ? 'MOVE TO SLIDE ALONG THE WALL' : ropeWindowOpen(m, r) ? `<b>${label('vault')}</b>CLIMB IN` : ropeWindowBoarded(m, r) ? `<b>${label('vault')}</b>SWING IN THROUGH THE BOARDS` : 'WINDOW BLOCKED';
    const up = r.up >= 0 ? hop('', r.up) : r.roof ? 'ROOF' : '', upKey = label('sprint');
    return `${what}${up ? `  ·  <b>${upKey}</b>UP TO ${up}` : ''}  ·  <b>${label('interact')}</b>${r.down >= 0 ? 'DOWN TO ' + hop('', r.down) : 'LET GO'}`;
  }
  const down = s.players.find(p => p.a && p.dn && p.tm === side && p.id !== me.id && Math.hypot(p.x - x, p.y - y) < 26);
  if (down && !me.dn && me.ct === 'body') return `<b>${label('interact')}</b>HOLD TO REVIVE ${esc(down.n.toUpperCase())}`; // before ropes (the server puts reviving first too)
  if (side === 'atk' && s.ph === PHASE.ACTION && me.ct === 'body' && !me.dn && floorAt(m, x, y) === m.groundFloor) {
    const h = ropeAt(m, x, y);
    if (h) return `<b>${label('interact')}</b>RAPPEL UP TO ${m.floors[h[0].f].name}`;
  }
  if (side === 'atk' && s.ph === PHASE.ACTION && me.ct === 'body' && !me.dn && roofRopeAt(m, x, y)) return `<b>${label('interact')}</b>RAPPEL DOWN`;
  if (side === 'def' && s.rf > 0) { const at = hatchAtPoint(m, x, y); if (at && !at.up && at.h.roof && m.tiles[at.h.cells[0]] === T.HATCH) return `<b>${label('interact')}</b>HOLD TO REINFORCE ROOF HATCH (${s.rf} LEFT)`; }
  if (side === 'atk' && me.df && s.ph === PHASE.ACTION && !s.pl) {
    const b = m.sites[s.site].bombs.find(b => Math.hypot(b.x - x, b.y - y) < 30);
    if (b) return `<b>${label('interact')}</b>HOLD TO PLANT DEFUSER (BOMB ${b.id})`;
  }
  if (side === 'def' && s.pl && Math.hypot(s.pl.x - x, s.pl.y - y) < 30) return '<b>' + label('interact') + '</b>HOLD TO DISABLE DEFUSER';
  const f = facingCell(m, x, y, st.aim, 28);
  if (side === 'def' && f) {
    if (f.t === T.SOFT && s.rf > 0) return `<b>${label('interact')}</b>HOLD TO REINFORCE WALL (${s.rf} LEFT)`;
    if (f.t === T.OPEN && m.openId[f.k] >= 0) return `<b>${label('interact')}</b>HOLD TO BARRICADE` + `${me.op === 'mason' && me.ac > 0 ? '  ·  <b>' + label('ability') + '</b>ARMOR PANEL' : ''}`;
    if (f.t === T.BARRI && me.op === 'mason' && me.ac > 0) return '<b>' + label('ability') + '</b>ARMOR PANEL';
    if (f.t === T.OPEN && m.openId[f.k] >= 0 && me.op === 'girder' && me.ac > 0 && s.ph === PHASE.ACTION) return `<b>${label('interact')}</b>HOLD TO BARRICADE  ·  <b>${label('ability')}</b>STEEL BRACE`;
  }
  if (f && f.t === T.BARRI) return '<b>' + label('melee') + '</b>MELEE TO BREAK BARRICADE';
  if (!me.vt && !(me.jp && me.jp[1])) { const v = findVault(m, x, y, vaultDir()); if (v) return '<b>' + label('vault') + '</b>' + (standable(m, v.k) ? 'JUMP UP' : 'VAULT'); }
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
  ['Drawing the maps', jobsStep(MAP_LIST.map(id => () => mapThumb(id)), 1)],
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
  return s.ents.filter(e => e.tm === me.tm && (me.tm === 'def' ? (e.ty === 'cam' && e.hp > 0) || e.ty === 'bird' || e.ty === 'scope' : e.ty === 'drone' || e.ty === 'scope'))
    .map((c, i) => [feedGroup(c), i, c]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]); // same groups and order as the server's feeds()
}
const TRAPS = new Set(['clamp', 'prox', 'concuss', 'alarm', 'mine', 'htrap']), TRAP_SEEN = 2 * PX_PER_M;
function feedKind(c) { return c.ty === 'drone' ? 'DRONE' : c.ty === 'bird' ? (c.pe ? 'BIRD · LANDED' : 'BIRD') : c.ty === 'scope' && c.fl ? (c.fl === 'up' ? 'PERISCOPE ▲' : 'PERISCOPE ▼') : c.ty === 'scope' ? 'WALL SCOPE' : c.tu ? 'TURRET' : c.ow ? 'STICKY CAM' : 'CAMERA'; }
function ownerName(s, id) { const p = s.players.find(p => p.id === id); return p ? p.n.replace(/^\[BOT\] /, '') : 'TEAMMATE'; }
function feedView(c, me) {
  const ro = c.ow && c.ow !== me.id ? 1 : 0;
  if (c.ty === 'drone') { const ic = interp(c.id, 'ents') || c; return { x: ic.x, y: ic.y, ang: ic.ag || c.ag || 0, fov: Math.PI * 2, range: 230, near: 0, kind: 'cam', cam: c, dr: 1, ro: 1, low: true }; }
  if (c.ty === 'bird') { const ic = interp(c.id, 'ents') || c; return c.pe ? { x: ic.x, y: ic.y, ang: ic.ag || c.ag || 0, fov: 1.9, range: 520, near: 6, kind: 'cam', cam: c, ro: 1 } : { x: ic.x, y: ic.y, ang: ic.ag || c.ag || 0, fov: Math.PI * 2, range: 260, near: 0, kind: 'cam', cam: c, dr: 1, ro: 1 }; }
  if (c.ty === 'scope' && c.fl) return { x: c.x, y: c.y, ang: c.ag || 0, fov: 6.28, range: 230, near: 6, kind: 'cam', cam: c, ro: 1 }; // LENS: looking all round the room above / below
  if (c.ty === 'scope') return { x: c.x, y: c.y, ang: c.ag || 0, fov: 1.3, range: 420, near: 6, kind: 'cam', cam: c, ro: 1 };
  if (c.oc !== undefined) return { x: c.x, y: c.y, ang: c.ag || 0, fov: 6.28, range: OUTCAM_ROOF, near: 0, kind: 'cam', off: c.off, cam: c, ro, oc: 1 }; // outside camera: the roof just above it here, the ground below in teamViewers
  return { x: c.x, y: c.y, ang: ro ? c.ag || 0 : st.aim, fov: 1.9, range: 650, near: 14, kind: 'cam', off: c.off, cam: c, ro };
}

// Clickable list of the team's cameras / drones along the bottom while you're looking through them, in labelled groups (he asked)
const FEED_GROUPS = ['INDOOR', 'OUTDOOR', 'DRONES', 'UTILITY'];
const feedGroup = c => c.ty === 'cam' && !c.ow ? (c.oc !== undefined ? 1 : 0) : c.ty === 'drone' ? 2 : 3;
function camBar(s, me) {
  const bar = $('cambar');
  if (me.ct !== 'cam' && me.ct !== 'drone') { if (bar.innerHTML) bar.innerHTML = ''; return; }
  const def = me.tm === 'def', list0 = def ? s.ents.filter(e => (e.ty === 'cam' || e.ty === 'bird' || e.ty === 'scope') && e.tm === 'def') : feedList(s, me); // broken cameras stay listed, greyed
  const list = list0.map((c, i) => [feedGroup(c), i, c]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]); // grouped like the server's feeds() (he asked)
  const cur = me.ct === 'drone' ? me.did : me.fi;
  let n = 0, on = 0, lastG = -1;
  const html = list.map(c => {
    const g = feedGroup(c), head = g !== lastG ? `${lastG >= 0 ? '</div>' : ''}<div class="cgrp"><em>${FEED_GROUPS[g]}</em>` : ''; lastG = g;
    if (g === 1 && !on) { on = 1; n = 0; } // outdoor cameras count from 1 again
    const live = !def || c.hp > 0 || c.ty === 'bird', mine = c.ow === me.id;
    const name = c.ow ? (mine ? 'MY ' : `${ownerName(s, c.ow).toUpperCase()}'S `) + (c.ty === 'cam' ? (c.tu ? 'TURRET' : 'STICKY') : c.ty === 'scope' ? 'SCOPE' : c.ty === 'bird' ? 'BIRD' : 'DRONE') : `CAM ${++n}`;
    return head + `<button data-id="${live ? c.id : ''}" class="${c.id === cur ? 'on' : ''} ${live ? '' : 'dead'}">${esc(name)}<small>${esc(c.oc !== undefined ? 'OUTSIDE · ' + ['EAST', 'SOUTH', 'WEST', 'NORTH'][((Math.round((c.wn || 0) / (Math.PI / 2)) % 4) + 4) % 4] + ' WALL' : (roomAt(st.map, c.x, c.y) || 'outside').toUpperCase())}${c.off || c.j ? ' · DISRUPTED' : ''}</small></button>`;
  }).join('') + (lastG >= 0 ? '</div>' : '');
  if (bar.innerHTML !== html) {
    bar.innerHTML = html;
    for (const b of bar.querySelectorAll('button')) b.onclick = e => { e.stopPropagation(); if (b.dataset.id) st.evq.push({ k: 'camSet', id: b.dataset.id }); };
  }
}

// ---------------- vision ----------------
// Only what you look through (he asked): your own eyes, or the drone / camera feed you are watching (yours or a
// teammate's), or the teammate you spectate once dead. Teammates' eyes, drones and cameras no longer light up your map;
// their pings and spotted marks still show, and where a teammate died is marked clearly (deathMarks).
const tvCamCone = new Map(); // ESPORTS TV: each camera's sight polygon by camera and angle (cameras hardly move)
function teamViewers(s, view, me, inGame) {
  const vs = [];
  if (view) vs.push(view);
  const oc = view && view.oc && !view.off && st.map && st.map.outCams && st.map.outCams[view.cam.oc]; // an outside camera's view down onto the ground (drawn like a window's)
  if (oc) vs.push({ x: oc.gx, y: oc.gy, ang: view.ang, fov: 1.9, range: OUTCAM_RANGE, near: 0, kind: 'window', r: -1, oc: 1 });
  // looking out of an upper window (he asked): the ground below, as far as the boards let you (windowViews)
  if (view && view.kind === 'body' && me && inGame && me.a && !me.dn && st.map) {
    for (const w of windowViews(st.map, view.x, view.y)) if (Math.abs(angDiff(w.ang, view.ang)) < view.fov / 2 + w.fov / 2) vs.push(w);
  }
  if (st.tv && s && inGame) { // ESPORTS TV (he asked): viewers see what BOTH teams see, each team's sight tinted its colour
    if (view && me) view.tvSq = me.sq;
    for (const sp of s.players) {
      if (!sp.a || sp.dn || sp.id === (me && me.id)) continue;
      const p = interp(sp.id, 'players'); if (!p || p.x === undefined) continue;
      vs.push({ x: p.x, y: p.y, ang: p.ag || 0, fov: fovFor(p), range: 1100, near: 26, kind: 'body', tvSq: sp.sq });
    }
    // he asked: a camera someone is actually looking through shows its view live, in the watcher's team colour
    for (const sp of s.players) if (sp.a && sp.cf) { const c = s.ents.find(e => e.id === sp.cf && e.ty === 'cam' && e.hp > 0 && !e.off); if (c) vs.push({ ...feedView(c, { id: null }), ang: c.ag || 0, ro: 1, tvSq: sp.sq, tvCam: 1 }); }
  }
  if (!s || !me || !inGame) return vs;
  // an open hatch someone can see into shows a little of the room on the other side of it
  const m = st.map, sm = smokes(s), n = vs.length;
  const body = view && view.kind === 'body' && me.a && !me.dn, sp = body && s.players.find(q => q.id === me.id);
  const stance = sp && sp.pn ? 'prone' : sp && sp.cr ? 'crouch' : 'stand';
  for (const h of m.hatches || []) {
    if (!hatchOpen(m, h)) continue;
    if (body) { const hv = hatchSight(m, h, view.x, view.y, stance); if (hv) vs.push(hv); } // your own eyes: only what the opening shows from where you are (drawHatchView)
    let up = false, down = false;
    for (let i = body ? 1 : 0; i < n; i++) { const v = vs[i]; if (!up && canSee(m, v, h.x, h.y, sm)) up = true; if (!down && canSee(m, v, h.bx, h.by, sm)) down = true; }
    if (up) vs.push({ x: h.bx, y: h.by, ang: 0, fov: Math.PI * 2, range: 72, near: 72, kind: 'hatch' });
    if (down) vs.push({ x: h.x, y: h.y, ang: 0, fov: Math.PI * 2, range: 40, near: 40, kind: 'hatch' });
  }
  return vs;
}
// a copy of someone on a staircase (stairGhost): seen by a teammate's eyes, drone or camera near that staircase
// a direction hint round your character: an arc, and ▲ / ▼ when it comes from the floor above or below
function floorHints(view, now, vh) { // which floor a sound came from, never which way: above your head or below your feet
  const u = UP(), fade = t => Math.max(0, 1 - (now - (t || -9)) / 1.4) * 0.85;
  ctx.font = '700 9px Barlow Condensed, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const [up, k] of [[1, 'Up'], [-1, 'Down']]) {
    const shot = fade(vh['shot' + k]), step = fade(vh['step' + k]), al = Math.max(shot, step); if (al <= 0.01) continue;
    ctx.fillStyle = shot >= step ? `rgba(255,90,70,${al})` : `rgba(255,150,70,${al})`;
    ctx.fillText(`${up > 0 ? '▲' : '▼'} ${shot >= step ? 'GUNFIRE' : 'FOOTSTEPS'} ${up > 0 ? 'ABOVE' : 'BELOW'}`, view.x + u.x * 34 * up, view.y + u.y * 34 * up);
  }
  ctx.textBaseline = 'alphabetic';
}
// ---------------- stairs preview (he asked: stairs were a choke point) ----------------
// Close to a staircase (on its steps, or within a few metres of its open end) a live corner window shows the other
// end: what you would see standing at the top (or bottom) landing looking out. It is your own eyes for this, so
// anything it shows is also seen on your side of the screen (marks, the remembered map).
const PIP_R = 90; // world px from the middle of the stairs view to where it has faded out
function stairPeek(view, me, inGame) {
  if (!view || view.kind !== 'body' || !me || !me.a || me.dn || !st.map || !(st.map.stairs || []).length) return null;
  const fl = floorAt(st.map, view.x, view.y);
  let best = null;
  for (let i = 0; i < st.map.stairs.length; i++) {
    const s = st.map.stairs[i];
    if (!stairLooks(st.map, i, view.x, view.y)) continue;
    const e = stairEnds(st.map, i, 0), up = fl === s.a; // downstairs: show the top; upstairs: show the bottom
    if (!up && fl !== s.b) continue;
    // a landing: just off the end of the steps, but never inside a wall (some stairs end right against one)
    const land = (p, a) => { const free = castSight(st.map, p.x, p.y, a, CELL * 1.2 + 8, null) - 8; const l = Math.max(2, Math.min(CELL * 1.2, free)); return { x: p.x + Math.cos(a) * l, y: p.y + Math.sin(a) * l }; };
    e.top = land(e.top, e.up); e.bottom = land(e.bottom, e.up + Math.PI);
    const near = up ? e.bottom : e.top, d = Math.hypot(view.x - near.x, view.y - near.y);
    if (d > 12 && castSight(st.map, view.x, view.y, Math.atan2(near.y - view.y, near.x - view.x), d, null) < d - 6) continue; // only with a clear view of this end of the stairs
    if (!best || d < best.d) best = { d, i, up, at: up ? e.top : e.bottom, ang: up ? e.up : e.up + Math.PI };
  }
  if (!best) return null;
  // all round the landing (some stairs come out sideways into a corridor), centred on the open space it looks into
  const v = { x: best.at.x, y: best.at.y, ang: best.ang, fov: Math.PI * 2, range: 330, near: 30, kind: 'stairs', up: best.up, s: best.i };
  let sx = 0, sy = 0; const n = 24;
  for (let j = 0; j < n; j++) { const a = j / n * Math.PI * 2, d = Math.min(220, castSight(st.map, v.x, v.y, a, 220, null)); sx += Math.cos(a) * d; sy += Math.sin(a) * d; }
  const l = Math.hypot(sx / n, sy / n), cap = Math.min(80, l);
  v.cx = v.x + (l > 0.01 ? sx / n / l * cap : 0); v.cy = v.y + (l > 0.01 ? sy / n / l * cap : 0);
  v.fwd = Math.atan2(v.cy - v.y, v.cx - v.x); if (l < 0.01) v.fwd = best.ang;
  return v;
}
// Seeing up and down stairs (he asked: live and part of the map, not a window in the corner): near a staircase you
// can see, the other floor's landing is drawn right where the steps lead, in the map, fading out at its edges.
// Floors sit side by side in the map grid, so it is that floor's picture moved by the staircase's offset.
const stairCv = document.createElement('canvas');
function drawStairView(s, me, now) {
  const pv = fxOn('pip') ? st.pip : null;
  if (!pv || !me) return;
  const S = st.map.stairs[pv.s], W = st.map.W, sdx = (S.gb % W - S.ga % W) * CELL, sdy = (Math.floor(S.gb / W) - Math.floor(S.ga / W)) * CELL;
  const offX = pv.up ? -sdx : sdx, offY = pv.up ? -sdy : sdy; // the other floor -> this floor
  const z = st.zoom || 1, px = Math.ceil(PIP_R * 2 * z);
  if (px < 8 || px > 4096) return;
  if (stairCv.width !== px) { stairCv.width = px; stairCv.height = px; }
  const c = stairCv.getContext('2d'), R = st.rend, k = R.c.width / R.Wp, sm = smokes(s);
  // drawn at the same zoom and turn as your own view, centred a little past the landing
  const cx = pv.x + Math.cos(pv.ang) * PIP_R * 0.55, cy = pv.y + Math.sin(pv.ang) * PIP_R * 0.55, rot = st.rot || 0; // just past the end of the steps, so it never covers you on them
  const F = st.map.floors[Math.max(0, floorAt(st.map, pv.x, pv.y))], fx0 = F.gx * CELL, fx1 = (F.gx + F.w) * CELL, fy1 = F.h * CELL;
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, px, px);
  const cs = Math.cos(rot), sn = Math.sin(rot);
  c.setTransform(z * cs, z * sn, -z * sn, z * cs, px / 2 - z * (cs * cx - sn * cy), px / 2 - z * (sn * cx + cs * cy));
  const D = PIP_R * 1.5, x0 = Math.max(fx0, cx - D), x1 = Math.min(fx1, cx + D), y0 = Math.max(0, cy - D), y1 = Math.min(fy1, cy + D);
  if (x1 <= x0 || y1 <= y0) return;
  c.save(); c.beginPath(); c.rect(x0, y0, x1 - x0, y1 - y0); c.clip(); // only this floor
  R.c.drawTo(c, x0 * k, y0 * k, (x1 - x0) * k, (y1 - y0) * k, x0, y0, x1 - x0, y1 - y0); // remembered: dulled with a plain dark wash (no filter)
  c.fillStyle = 'rgba(28,30,32,0.68)'; c.fillRect(x0, y0, x1 - x0, y1 - y0);
  c.save(); c.beginPath(); // what the landing can see right now, in colour
  const poly = visionPolygon(pv, sm, 160), near = nearPolygon(pv, sm);
  for (const pts of [poly, near]) { c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); }
  c.clip('nonzero');
  R.c.drawTo(c, x0 * k, y0 * k, (x1 - x0) * k, (y1 - y0) * k, x0, y0, x1 - x0, y1 - y0);
  c.restore();
  // people and gadgets there: your team always, the other side only where your team can see them
  const side = me.tm, inBox = (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1;
  for (const e0 of s.ents) {
    const e = interp(e0.id, 'ents') || e0, ally = e.tm === side;
    if (!inBox(e.x, e.y) || e.ty === 'smoke' || e.ty === 'decoy' || e.ty === 'gascloud') continue;
    if (!ally && !teamSees(e.x, e.y)) continue;
    if ((e.ty === 'clamp' || e.ty === 'prox' || e.ty === 'concuss' || e.ty === 'mine') && !ally) continue; // hidden traps stay hidden
    if (e.ty === 'drone') drawDrone(c, { ...e, ag: e.ag || 0, wheel: 0, spd: 0, mvAng: e.ag || 0, sway: 0 }, now, ally);
    else if (e.ty === 'cam') drawCam(c, e, now, ally);
    else drawGadget(c, e, now, ally);
  }
  for (const sp of s.players) {
    if (!sp.a || sp.sg || sp.id === me.id) continue;
    const p = interp(sp.id, 'players'); if (!p || p.x === undefined || !inBox(p.x, p.y)) continue;
    const ally = p.tm === side;
    if (!ally && (p.sh ? !teamSeesBody(p.x, p.y) : !teamSees(p.x, p.y))) continue;
    const a = anim(p.id);
    drawOperator(c, { x: p.x, y: p.y, aim: p.ag, op: p.op, w: p.w, ally, ring: tvRing(p), walk: a.walk, legs: Math.min(1.2, a.mvS || 0), ads: p.ad, crouch: p.cr, prone: p.pn, downed: p.dn, recoil: a.recoil, reload: p.rl > 0, brace: p.br, riot: p.ri, shieldPose: p.br ? shieldPose(p.gt, p.mv >= 2, false, p.so === 2, p.sa || 0, riotArc(p.ri, p.cr, !p.mv)) : null }, now);
  }
  c.restore();
  // soft round edge, so it melts into this floor's map
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'destination-in';
  const gr = c.createRadialGradient(px / 2, px / 2, px * 0.3, px / 2, px / 2, px / 2);
  gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = gr; c.fillRect(0, 0, px, px); c.globalCompositeOperation = 'source-over';
  // onto the top layer, where the steps lead on this floor
  const P = w2s(cx + offX, cy + offY);
  octx.save(); octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.drawImage(stairCv, P.x - px / 2, P.y - px / 2);
  octx.font = `700 ${Math.round(12 * DPR)}px Barlow, sans-serif`; octx.textAlign = 'center';
  octx.fillStyle = 'rgba(255,255,255,0.7)'; octx.strokeStyle = 'rgba(0,0,0,0.8)'; octx.lineWidth = 3 * DPR;
  const L = pv.up ? '▲ UPSTAIRS' : '▼ DOWNSTAIRS', ly = P.y - px * 0.36;
  octx.strokeText(L, P.x, ly); octx.fillText(L, P.x, ly);
  octx.restore();
}
function wallGhostSeen(gh) { // a window peeker / climber's copy on the ground: seen by something of ours down there? Where it shows, or null
  const sm = smokes(st.last);
  for (const v of st.viewers || []) {
    if (v.off || v.kind === 'hatch' || v.kind === 'window' || floorAt(st.map, v.x, v.y) !== gh.fl) continue;
    const pv = peekSeen(st.map, gh, v.x, v.y, sm), at = pv === true ? gh : pv; // (at the foot of the view it is seen through)
    if (at && canSee(st.map, v, at.x, at.y, sm)) return at;
  }
  return null;
}
// The view down out of an upper window (he asked): the ground floor drawn into the dark outside the window, moved by
// the floor offset so it lines up under the building, live colour only inside what the window lets you see (a slit
// through a bullet hole, the whole opening once the boards are gone), a little darker (it is a floor or two down)
// and fading out with distance. People and gadgets there: your team, and the other side where your team sees them.
function drawWindowView(s, me, now, view) {
  const ws = (st.viewers || []).filter(v => v.kind === 'window');
  st.winBox = null; st.winViewsOn = ws.length > 0;
  if (!ws.length || !me) return;
  const m = st.map, gi = m.groundFloor, f = floorAt(m, view.x, view.y), o = floorOff(m, gi, f), sm = smokes(s);
  const polys = ws.map(v => visionPolygon(v, sm, 120));
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const P of polys) for (let i = 0; i < P.length; i += 2) { x0 = Math.min(x0, P[i]); x1 = Math.max(x1, P[i]); y0 = Math.min(y0, P[i + 1]); y1 = Math.max(y1, P[i + 1]); }
  const G = m.floors[gi]; x0 = Math.max(x0, G.gx * CELL); x1 = Math.min(x1, (G.gx + G.w) * CELL); y0 = Math.max(0, y0); y1 = Math.min(y1, G.h * CELL);
  if (x1 <= x0 || y1 <= y0) return;
  st.winBox = [x0 + o.x, y0 + o.y, x1 + o.x, y1 + o.y]; // the camera may show this past the floor's edge
  const R = st.rend, k = R.c.width / R.Wp, c = octx;
  c.save(); c.translate(o.x, o.y); // the top layer is in world units here (as for the stairs view)
  c.beginPath(); for (const P of polys) { c.moveTo(P[0], P[1]); for (let i = 2; i < P.length; i += 2) c.lineTo(P[i], P[i + 1]); c.closePath(); }
  c.clip('nonzero');
  R.c.drawTo(c, x0 * k, y0 * k, (x1 - x0) * k, (y1 - y0) * k, x0, y0, x1 - x0, y1 - y0);
  const side = me.tm, inBox = (x, y) => x >= x0 - 20 && x < x1 + 20 && y >= y0 - 20 && y < y1 + 20;
  for (const e0 of s.ents) {
    const e = interp(e0.id, 'ents') || e0, ally = e.tm === side;
    if (!inBox(e.x, e.y) || e.ty === 'smoke' || e.ty === 'decoy' || e.ty === 'gascloud' || floorAt(m, e.x, e.y) !== gi) continue;
    if (!ally && !teamSees(e.x, e.y)) continue;
    if ((e.ty === 'clamp' || e.ty === 'prox' || e.ty === 'concuss' || e.ty === 'mine') && !ally) continue;
    if (e.ty === 'drone') drawDrone(c, { ...e, ag: e.ag || 0, wheel: 0, spd: 0, mvAng: e.ag || 0, sway: 0 }, now, ally);
    else if (e.ty === 'cam') drawCam(c, e, now, ally);
    else drawGadget(c, e, now, ally);
  }
  for (const sp of s.players) {
    if (!sp.a || sp.sg || sp.id === me.id) continue;
    const p = interp(sp.id, 'players'); if (!p || p.x === undefined) continue;
    const pf = floorAt(m, p.x, p.y), wg = pf > gi ? wallGhost(m, p.x, p.y) : null, at = pf === gi ? p : wg && wg.rope ? wg : null; // climbers show on the wall below too
    if (!at || !inBox(at.x, at.y)) continue;
    const ally = p.tm === side;
    if (!ally && (p.sh ? !teamSeesBody(at.x, at.y) : !teamSees(at.x, at.y))) continue;
    const a = anim(p.id);
    drawOperator(c, { x: at.x, y: at.y, aim: p.ag, op: p.op, w: p.w, ally, ring: tvRing(p), walk: a.walk, legs: Math.min(1.2, a.mvS || 0), ads: p.ad, crouch: p.cr, prone: p.pn, downed: p.dn, recoil: a.recoil, reload: p.rl > 0, brace: p.br, riot: p.ri, shieldPose: p.br ? shieldPose(p.gt, p.mv >= 2, false, p.so === 2, p.sa || 0, riotArc(p.ri, p.cr, !p.mv)) : null }, now);
    if (!ally && !p.dn) st.heads.push({ x: at.x + o.x, y: at.y + o.y });
  }
  // darker with distance from the wall: a floor or more down, and it fades out at the end of what you can see
  for (const v of ws) {
    const gr = c.createRadialGradient(v.x, v.y, 0, v.x, v.y, v.range);
    gr.addColorStop(0, 'rgba(8,10,14,0.22)'); gr.addColorStop(0.75, 'rgba(8,10,14,0.4)'); gr.addColorStop(1, 'rgba(5,6,7,0.95)');
    c.fillStyle = gr; c.fillRect(x0, y0, x1 - x0, y1 - y0); break;
  }
  c.restore();
  const v0 = ws[0], P = w2s(v0.x + o.x + Math.cos(v0.ang) * 26, v0.y + o.y + Math.sin(v0.ang) * 26);
  octx.save(); octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.font = `700 ${Math.round(11 * DPR)}px Barlow, sans-serif`; octx.textAlign = 'center';
  octx.fillStyle = 'rgba(255,255,255,0.7)'; octx.strokeStyle = 'rgba(0,0,0,0.8)'; octx.lineWidth = 3 * DPR;
  const L = ws.every(v => v.hole) ? '▼ GROUND · THROUGH A BULLET HOLE' : '▼ GROUND BELOW';
  octx.strokeText(L, P.x, P.y); octx.fillText(L, P.x, P.y);
  octx.restore();
}
// Through an open hatch (he asked: like the stairs, limited, and lying down shows more sideways): the other floor's
// patch the opening lets you see (hatchSight), drawn where it really is under (or over) this floor, darker, with the
// people and gadgets there your team sees. Your crosshair on it shoots through the hatch (server holeAim).
function drawHatchView(s, me, now) {
  const hs = (st.viewers || []).filter(v => v.mask);
  if (!hs.length || !me) return;
  const m = st.map, sm = smokes(s), R = st.rend, k = R.c.width / R.Wp, c = octx, side = me.tm;
  for (const v of hs) {
    const K = v.mask, o = v.o, fb = floorAt(m, v.x, v.y), P = visionPolygon(v, sm, 120);
    const Q = [[K.x0, K.y0], [K.x1, K.y0], [K.x1, K.y1], [K.x0, K.y1]].map(([x, y]) => [K.ex + (x - K.ex) / K.f, K.ey + (y - K.ey) / K.f]);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of Q) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    if (K.lim) { x0 = Math.max(x0, K.lim.x0); y0 = Math.max(y0, K.lim.y0); x1 = Math.min(x1, K.lim.x1); y1 = Math.min(y1, K.lim.y1); } // from below: only a small ring round the hole
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(m.W * CELL, x1); y1 = Math.min(m.H * CELL, y1);
    if (x1 <= x0 || y1 <= y0) continue;
    c.save(); c.translate(-o.x, -o.y);
    c.beginPath(); c.moveTo(P[0], P[1]); for (let i = 2; i < P.length; i += 2) c.lineTo(P[i], P[i + 1]); c.closePath(); c.clip();
    c.beginPath(); c.moveTo(Q[0][0], Q[0][1]); for (const [x, y] of Q.slice(1)) c.lineTo(x, y); c.closePath(); c.clip();
    if (K.lim) { c.beginPath(); c.rect(x0, y0, x1 - x0, y1 - y0); c.clip(); }
    R.c.drawTo(c, x0 * k, y0 * k, (x1 - x0) * k, (y1 - y0) * k, x0, y0, x1 - x0, y1 - y0);
    const inBox = (x, y) => x >= x0 - 20 && x < x1 + 20 && y >= y0 - 20 && y < y1 + 20;
    for (const e0 of s.ents) {
      const e = interp(e0.id, 'ents') || e0, ally = e.tm === side;
      if (!inBox(e.x, e.y) || e.ty === 'smoke' || e.ty === 'decoy' || e.ty === 'gascloud' || floorAt(m, e.x, e.y) !== fb) continue;
      if (!ally && (!teamSees(e.x, e.y) || TRAPS.has(e.ty))) continue;
      if (e.ty === 'drone') drawDrone(c, { ...e, ag: e.ag || 0, wheel: 0, spd: 0, mvAng: e.ag || 0, sway: 0 }, now, ally);
      else if (e.ty === 'cam') drawCam(c, e, now, ally);
      else drawGadget(c, e, now, ally);
    }
    for (const sp of s.players) {
      if (!sp.a || sp.sg || sp.id === me.id) continue;
      const p = interp(sp.id, 'players'); if (!p || p.x === undefined || !inBox(p.x, p.y) || floorAt(m, p.x, p.y) !== fb) continue;
      const ally = p.tm === side;
      if (!ally && (p.sh ? !teamSeesBody(p.x, p.y) : !teamSees(p.x, p.y))) continue;
      const a = anim(p.id);
      drawOperator(c, { x: p.x, y: p.y, aim: p.ag, op: p.op, w: p.w, ally, ring: tvRing(p), walk: a.walk, legs: Math.min(1.2, a.mvS || 0), ads: p.ad, crouch: p.cr, prone: p.pn, downed: p.dn, recoil: a.recoil, reload: p.rl > 0, brace: p.br, riot: p.ri, shieldPose: p.br ? shieldPose(p.gt, p.mv >= 2, false, p.so === 2, p.sa || 0, riotArc(p.ri, p.cr, !p.mv)) : null }, now);
      if (!ally && !p.dn) st.heads.push({ x: p.x - o.x, y: p.y - o.y });
    }
    c.fillStyle = 'rgba(8,10,14,0.32)'; c.fillRect(x0, y0, x1 - x0, y1 - y0); // a floor away: a little darker
    c.restore();
    const L = v.up ? '▼ BELOW' : '▲ ABOVE', T0 = w2s(v.up ? v.h.x : v.h.bx, v.up ? v.h.y : v.h.by);
    octx.save(); octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.font = `700 ${Math.round(11 * DPR)}px Barlow, sans-serif`; octx.textAlign = 'center';
    octx.fillStyle = 'rgba(255,255,255,0.7)'; octx.strokeStyle = 'rgba(0,0,0,0.8)'; octx.lineWidth = 3 * DPR;
    const lx = T0.x, ly = T0.y - 22 * DPR; octx.strokeText(L, lx, ly); octx.fillText(L, lx, ly);
    octx.restore();
  }
}
// From the ground (he asked: attackers must be able to tell which upper windows may be watched): a small plate on the
// ground under every upper outside window showing its state as your team last saw it from down there — boards intact,
// boards with holes (someone may be looking through), broken open, or reinforced. All windows start boarded.
const WIN_LOOK = { boarded: ['#8a5a2e', 'BOARDED'], holed: ['#d9a13a', 'HOLES'], open: ['#ff5a3c', 'OPEN'], shut: ['#8f969c', 'BLOCKED'] };
function drawWindowMarks(s, view, now) {
  const m = st.map, gi = m.groundFloor;
  if (gi === undefined || floorAt(m, view.x, view.y) !== gi || !fxOn('winmarks')) return;
  const K = st.winKnown || (st.winKnown = {}), sm = smokes(s), c = octx, u = UP();
  const vx0 = st.cam.x - 1400, vx1 = st.cam.x + 1400, vy0 = st.cam.y - 1400, vy1 = st.cam.y + 1400;
  const byFoot = new Map();
  for (const r of m.ropes || []) {
    const ft = windowFoot(m, r); if (!ft || ft.x < vx0 || ft.x > vx1 || ft.y < vy0 || ft.y > vy1) continue;
    if (!K[r.i] || now - (K[r.i].t || 0) > 0.25) { // looked at again a few times a second while in sight
      for (const v of st.viewers || []) if (!v.off && v.kind !== 'window' && v.kind !== 'hatch' && floorAt(m, v.x, v.y) === gi && canSee(m, v, ft.x, ft.y, sm)) { K[r.i] = { s: windowState(m, r), t: now }; break; }
    }
    const key = Math.round(ft.x / 8) + ',' + Math.round(ft.y / 8), n = byFoot.get(key) || 0; byFoot.set(key, n + 1);
    const st0 = K[r.i] ? K[r.i].s : 'boarded', [col, word] = WIN_LOOK[st0];
    const ox = Math.cos(r.out), oy = Math.sin(r.out), x = ft.x + ox * (6 + n * 13), y = ft.y + oy * (6 + n * 13), live = K[r.i] && now - K[r.i].t < 0.6;
    c.save(); c.translate(x, y); c.rotate(r.out + Math.PI / 2);
    c.globalAlpha = live ? 0.95 : 0.6;
    c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(-9, -4, 18, 8);
    c.fillStyle = st0 === 'open' ? '#111' : col; c.fillRect(-8, -3, 16, 6);
    if (st0 === 'boarded' || st0 === 'holed') { c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(-8, -0.5, 16, 1); }
    if (st0 === 'holed') { c.fillStyle = '#000'; for (const hx of [-5, 1, 5]) c.fillRect(hx, -2, 1.4, 1.4); }
    c.strokeStyle = col; c.lineWidth = 1; c.strokeRect(-8.5, -3.5, 17, 7);
    c.restore();
    c.save(); c.globalAlpha = live ? 0.9 : 0.55; c.font = '700 6px Barlow Condensed, sans-serif'; c.textAlign = 'center'; c.fillStyle = col;
    c.fillText(`▲${m.floors[r.f].name} ${word}`, x + ox * 9 + u.x * 2, y + oy * 9 + u.y * 2); c.restore();
  }
}
function ghostSeen(gh) {
  const sm = smokes(st.last);
  for (const v of st.viewers || []) if (!v.off && v.kind !== 'hatch' && floorAt(st.map, v.x, v.y) === gh.fl && stairLooks(st.map, gh.s, v.x, v.y) && canSee(st.map, v, gh.x, gh.y, sm)) return true;
  return false;
}
// GIMLET's peepholes (he asked): a small ragged hole in the floor from above, a pin of light in the ceiling from below
function drawPeeps() {
  const m = st.map; if (!m || !m.peeps || !m.peeps.length) return;
  for (const h of m.hatches) {
    if (!h.peep) continue;
    for (const [x, y, top] of [[h.x, h.y, true], [h.bx, h.by, false]]) {
      if (!teamSees(x, y)) continue;
      ctx.save(); ctx.translate(x, y);
      if (top) { ctx.fillStyle = '#0a0a0b'; ctx.beginPath(); for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, r = 3.6 + (i % 2) * 0.9; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } ctx.fill(); ctx.strokeStyle = 'rgba(200,190,170,0.5)'; ctx.lineWidth = 0.6; ctx.stroke(); }
      else { ctx.fillStyle = 'rgba(255,240,200,0.18)'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,250,230,0.55)'; ctx.beginPath(); ctx.arc(0, 0, 2, 0, 7); ctx.fill(); }
      ctx.restore();
    }
  }
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
const OVERLAYS = ['lanDlg', 'bkPage', 'playbookPage', 'settings', 'opsPage', 'profilePage', 'armoryPage', 'mapsPage', 'freeOps', 'pause', 'quitDlg'];
function menuOpen() { return OVERLAYS.some(id => !$(id).classList.contains('hidden')); }
function inMatch() { const p = st.last && st.last.ph; return p === PHASE.PREP || p === PHASE.ACTION || p === PHASE.ROUND_END || p === PHASE.SELECT; }
function showOps(op) { audio.ui('open'); openOps($('opsPage'), { profile: st.profile, send, op }); }
function showProfile() { audio.ui('open'); if (st.token) openProfile($('profilePage'), { token: st.token }); }
// Esc closes whatever is open, otherwise opens/closes the pause menu during a match.
function escape() {
  if (!$('armoryPage').classList.contains('hidden') && armoryHoldsEsc()) return; // Esc first lets go of the captured mouse, as in a match
  for (const id of ['settings', 'opsPage', 'profilePage', 'armoryPage', 'mapsPage', 'freeOps', 'lanDlg', 'playbookPage', 'bkPage']) if (!$(id).classList.contains('hidden')) {
    if (id === 'opsPage') closeOps($(id)); else if (id === 'armoryPage') closeArmory($(id)); else if (id === 'mapsPage') closeMapInfo($(id)); else if (id === 'playbookPage') closePlaybook($(id)); else if (id === 'bkPage') closeKnowledge($(id)); else $(id).classList.add('hidden');
    return;
  }
  if (!$('quitDlg').classList.contains('hidden')) { $('quitDlg').classList.add('hidden'); audio.ui('back'); return; }
  if (curPage && !inMatch() && !$('lobby').classList.contains('hidden')) { pageBack(); return; } // a menu page: back, like its BACK button
  if (inMatch() || !$('pause').classList.contains('hidden')) $('pause').classList.toggle('hidden');
  else { $('quitDlg').classList.remove('hidden'); audio.ui('open'); } // title screen / menus: offer to quit
}
const APP = new URLSearchParams(location.search).has('app');
addEventListener('beforeunload', e => { if (st.id && !st.quitting && inMatch()) { e.preventDefault(); e.returnValue = ''; } }); // opened from the desktop icon (full-screen window)
async function quitGame() {
  stopMusic(); st.quitting = true;
  if (window.r62dApp) return window.r62dApp.quit(); // the R62D program (desktop/main.js) closes itself
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
$('pEnd').onclick = () => { if (st.tutorial || st.free || st.tv) return switchMatch(null); if (confirm('End the match for everyone and go back to the lobby?')) { send({ t: 'lobby', a: 'end' }); $('pause').classList.add('hidden'); } };
$('lobbyOpsBtn').onclick = () => showOps();
$('lobbyProfBtn').onclick = () => showProfile();
$('armoryPage').querySelector('.close').onclick = () => closeArmory($('armoryPage'));
$('mapsPage').querySelector('.close').onclick = () => closeMapInfo($('mapsPage'));
$('bkPage').querySelector('.close').onclick = () => { audio.ui('back'); closeKnowledge($('bkPage')); };
$('playbookPage').querySelector('.close').onclick = () => { audio.ui('back'); closePlaybook($('playbookPage')); };
for (const id of ['opsPage', 'profilePage']) $(id).querySelector('.close').onclick = () => { if (id === 'opsPage') closeOps($(id)); else $(id).classList.add('hidden'); };

// ---------------- title screen, main menu, little touches ----------------
st.started = false;
// trackpad chosen: its key layout whenever no key shoots (also after a profile's saved keys load) (Space shoots, E aims in); the keys can still be changed in Settings
const trackpadKeys = () => { if (isTrackpad && !bindsFor('fire')[0]) { applyPreset('trackpad'); return true; } return false; };
trackpadKeys();
document.documentElement.classList.toggle('trackpad', isTrackpad);
// phone or computer? asked on the title screen only when it can't be told (touch.js); changeable in Settings
if (needsInputChoice) {
  $('inputChoice').classList.remove('hidden');
  for (const b of $('inputChoice').querySelectorAll('button')) b.addEventListener('click', e => { e.stopPropagation(); setInputChoice(b.dataset.c); });
}
for (const b of $('inputSeg').querySelectorAll('button')) {
  const cur = isTouch ? 'touch' : isTrackpad ? 'trackpad' : 'desk';
  b.classList.toggle('on', b.dataset.c === cur);
  b.onclick = () => { if (b.dataset.c !== cur) setInputChoice(b.dataset.c); };
}
{ const u = $('uiScale'), v = $('viewMul'), show = () => { $('uiScaleVal').textContent = u.value + '%'; $('viewMulVal').textContent = v.value + '%'; };
  u.value = Math.round(uiScale() * 100); v.value = Math.round(viewMul() * 100); show();
  u.addEventListener('input', show); u.addEventListener('change', () => { show(); setUiScale(u.value / 100); }); // on letting go: resizing while dragging moved the slider under the mouse
  v.addEventListener('input', () => { show(); setViewMul(v.value / 100); }); }
{ // phone: tilt to move (on/off + dead zone), kept on this device
  const seg = $('tiltSeg'), dz = $('tiltDz'), show = () => { for (const b of seg.children) b.classList.toggle('on', (b.dataset.t === '1') === tiltOn()); $('tiltDzVal').textContent = dz.value + '°'; };
  dz.value = tiltDead(); show();
  for (const b of seg.children) b.onclick = () => { audio.ui(); setTilt(b.dataset.t === '1'); show(); };
  dz.addEventListener('input', () => { setTiltDead(+dz.value); show(); }); }
// ---- HOST (was OPEN TO LAN; he asked, like Minecraft, then for HOST / JOIN with a code): the address and a QR code for phones, and which computer + version this is ----
const lanText = a => a ? `${a.host} · version ${a.version.id}${a.version.date ? ' (' + a.version.date + ')' : ''}` : '';
// OPEN TO LAN (he asked: always current with the right VPN): the homelab VPN address is the main one (and the code)
// whenever the VPN is on; the dialog asks again every 2 s while it is open, so turning the VPN on or off shows at once.
function lanFill() {
  fetch('/api/addr').then(r => r.json()).then(a => {
    st.addr = a; const main = a.urls[0], key = a.urls.map(u => u.url).join(' ');
    if (key === st.lanKey) return; st.lanKey = key;
    if (!main) { $('lanCode').textContent = '—'; $('lanUrl').textContent = 'No network found: is this computer connected?'; $('lanOther').innerHTML = ''; return; }
    drawQr($('lanQr'), main.url, 7); $('lanCode').textContent = showCode(main.code); $('lanCode').classList.toggle('long', main.code.length > 5);
    const vpnOff = !a.urls.some(u => u.homelab);
    $('lanUrl').innerHTML = `<b>${esc(main.url)}</b><span>over ${esc(main.net)}${main.homelab ? ': friends on the VPN join here' : ''}</span>`;
    $('lanOther').innerHTML = (vpnOff ? '<div class="warn">The homelab VPN is off: only people on your home network can join. Turn it on and this updates by itself.</div>' : '')
      + a.urls.filter(u => u !== main).map(u => `<div><b>${esc(showCode(u.code))}</b> · ${esc(u.url)} <span>(${esc(u.net)}${u.vpn ? '' : ', people on your home network'})</span></div>`).join('');
    $('lanServer').textContent = 'Running on ' + lanText(a);
  }).catch(() => { st.lanKey = null; $('lanUrl').textContent = 'Could not reach the game server.'; });
}
function openLan() {
  audio.ui('open'); $('lanDlg').classList.remove('hidden'); st.lanKey = null; lanFill();
  clearInterval(st.lanT); st.lanT = setInterval(() => { if ($('lanDlg').classList.contains('hidden')) clearInterval(st.lanT); else lanFill(); }, 2000);
}
$('lanBtn').onclick = openLan; $('pLan').onclick = () => { $('pause').classList.add('hidden'); openLan(); };
$('lanClose').onclick = () => { audio.ui('back'); $('lanDlg').classList.add('hidden'); };
// the title screen says which computer and version you are connected to (a phone might be on someone else's server)
fetch('/api/addr').then(r => r.json()).then(a => { st.addr = a; $('serverTag').textContent = 'Connected to ' + lanText(a); $('homeVer').textContent = lanText(a); }).catch(() => {});
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
// The main menu (he asked for an overhaul, Risk of Rain 2 style): a home screen of big choices; each opens a full
// page (#lobby.paged) with BACK (Esc) in its top bar. Operators, Armory, Map Knowledge, Playbook, Ball Knowledge,
// Profile and Settings are their own full-screen pages already and open over whichever menu page you are on.
const PAGES = { play: ['PLAY', 'QUICK MATCH'], unranked: ['PLAY', 'UNRANKED'], ranked: ['PLAY', 'RANKED'], fun: ['PLAY', 'FUN MODES'], join: ['PLAY', 'JOIN A GAME'], free: ['PLAY', 'FREE PLAY'], tutorial: ['LEARN', 'TUTORIAL'],
  tv: ['WATCH', 'ESPORTS TV'], intel: ['LEARN', 'INTEL'], controls: ['INTEL', 'CONTROLS'] };
const PAGE_UP = { controls: 'intel' }; // BACK from these goes to that page, not home
const NEEDS_NAME = new Set(['play', 'unranked', 'ranked', 'ops', 'profile']);
const MODE_TAB = { play: 'quick', unranked: 'unranked', ranked: 'ranked' }; // these pages are the one lobby, set to that mode
// FUN MODES page (he asked): one card per fun mode; the ones not built yet say so
const FUN_LOOK = { oitc: ['#ff7a2a', '1'], gungame: ['#f2c14e', '▲'], infected: ['#5fd08a', '☣'], zombies: ['#c0503a', '☠'] };
function renderFun() {
  const el = $('funGrid'); if (el.dataset.k) return; el.dataset.k = 1;
  el.innerHTML = MODE_LIST.filter(id => MODES[id].fun).map(id => { const M = MODES[id], [c, i] = FUN_LOOK[id] || ['#93a0ad', '?'];
    return `<button class="icard${M.ready ? '' : ' soon'}" data-mode="${id}" style="--ic:${c}"><i>${i}</i><b>${esc(M.name)}</b><small>${esc(M.blurb)}</small>${M.ready ? '' : '<em>COMING NEXT</em>'}</button>`; }).join('');
  for (const b of el.querySelectorAll('button')) b.onclick = () => { const M = MODES[b.dataset.mode]; if (!M.ready) { audio.ui('back'); return; } st.wantMode = b.dataset.mode; setTab('play'); };
}
let curPage = null;
function askName(tab) { // no name yet: back home with the name box lit up; once entered, go on to that page
  if (tab) st.wantTab = tab;
  goHome(); audio.ui('back'); $('name').focus();
  const j = $('join'); j.classList.remove('nudge'); void j.offsetWidth; j.classList.add('nudge');
}
function goHome() {
  curPage = null;
  $('lobby').classList.add('home'); $('lobby').classList.remove('paged');
  for (const t of document.querySelectorAll('.tab')) t.classList.remove('on');
}
function pageBack() { audio.ui('back'); const up = curPage === 'play' && MODES[st.lastMode]?.fun ? 'fun' : PAGE_UP[curPage]; if (up) setTab(up); else goHome(); }
function setTab(tab) {
  if (NEEDS_NAME.has(tab) && !st.token) { askName(tab); return; }
  if (tab === 'ops') { showOps(); return; }
  if (tab === 'profile') { showProfile(); return; }
  if (tab === 'armory') { audio.ui('open'); openArmory($('armoryPage'), { sens: ads => ($('sens').value / 100) * (ads ? $('adsSens').value / 100 : 1), xh: () => xh, mode: () => aimMode, dpr: () => DPR, steady: () => $('steadySens').value / 100, far: () => farSens(), low: () => gfxLevel() === 'low' }); return; }
  if (tab === 'maps') { audio.ui('open'); openMapInfo($('mapsPage')); return; }
  if (tab === 'knowledge') { audio.ui('open'); openKnowledge($('bkPage')); return; }
  if (tab === 'playbook') { audio.ui('open'); trainInfo(); openPlaybook($('playbookPage')); return; }
  if (tab === 'settings') { toggleSettings(); return; }
  if (tab === 'quit') { $('quitDlg').classList.remove('hidden'); audio.ui('open'); return; }
  if (!PAGES[tab]) return;
  if (curPage !== tab) audio.ui('open');
  curPage = tab;
  const section = MODE_TAB[tab] ? 'play' : tab;
  if (MODE_TAB[tab]) { if (tab !== 'play' || !MODES[st.wantMode]?.fun) st.wantMode = MODE_TAB[tab]; st.modeSent = 0; send({ t: 'lobby', a: 'mode', id: st.wantMode }); }
  $('lobby').classList.remove('home'); $('lobby').classList.add('paged');
  $('pageKick').textContent = PAGES[tab][0]; $('pageTitle').textContent = PAGES[tab][1];
  for (const t of document.querySelectorAll('.tab')) t.classList.toggle('on', t.id === 'tab-' + section);
  if (tab === 'controls') renderControls();
  if (tab === 'fun') renderFun();
  if (tab === 'free') renderFree();
  if (tab === 'tv') { renderTv(); trainInfo(); }
  if (tab === 'join') { $('codeMsg').textContent = ''; setTimeout(() => $('codeIn').focus(), 50); }
}
function updateNav() {}
for (const b of $('lobby').querySelectorAll('[data-tab]')) b.onclick = () => setTab(b.dataset.tab);
$('backBtn').onclick = pageBack;
// JOIN A GAME: the code (or an address) → check a game answers there → go to it, keeping the app / touch flags
async function joinByCode() {
  const r = readCode($('codeIn').value), msg = t => { $('codeMsg').textContent = t; };
  if (!r) { audio.ui('back'); msg($('codeIn').value.trim() ? "That code isn't right. Check each letter with your friend." : 'Type the code first.'); return; }
  const base = `http://${r.ip}:${r.port}`;
  msg('Looking for the game…'); audio.ui();
  try {
    const a = await (await fetch(base + '/api/addr', { signal: AbortSignal.timeout(5000) })).json();
    if (!a || !a.urls) throw new Error();
    msg('Found ' + (a.host || 'it') + '. Joining…');
    const q = new URLSearchParams(location.search), keep = new URLSearchParams();
    for (const k of ['app', 'touch']) if (q.has(k)) keep.set(k, q.get(k));
    setTimeout(() => { location.href = base + '/' + (keep.toString() ? '?' + keep : ''); }, 400);
  } catch { audio.ui('back'); msg('No game answered. Is your friend hosting, and are you both on the homelab VPN (or the same home network)?'); }
}
$('codeGo').onclick = joinByCode;
$('codeIn').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); joinByCode(); } });
function updateCard() {
  const p = st.profile; if (!p) return;
  const L = levelFor(p.xp || 0);
  $('pcard').classList.remove('hidden');
  $('pcName').textContent = p.name; $('pcLevel').textContent = L.level;
  $('pcXp').style.width = (L.into / L.need * 100) + '%'; $('pcXpText').innerHTML = `LEVEL ${L.level} · ${L.into} / ${L.need} XP ${rankTag(p.rank)} <span style="opacity:.6">${p.mmr ?? ''} MMR</span>`;
}
const TIPS = [
  'Push your crosshair past the edge of the screen to look further: it reaches anywhere you can see. Aim in (right click) for a wider view and to see head zones.',
  'Walk ({walk}) or crouch ({crouch}) to move without footsteps — just like CS2.',
  'Crouch while sprinting to power slide. You can only shoot forward from the hip until you are back up.',
  'Hold sprint and forward to run where you aim, whichever way the screen faces. It is very loud, and your gun takes a moment to come up.',
  'Stop before you shoot: running ruins your accuracy. Crouching still is the most accurate.',
  'Broken glass under windows crunches loudly — listen for it.',
  'Defenders: reinforce the walls of the objective room before the action phase starts.',
  'Attackers: use your drone in preparation to find the objective before you go in.',
  'Bullets go through soft walls. If you can hear them, you can shoot them.',
  'A downed teammate can be revived — hold interact next to them.',
  'Press {spot} (or middle click) to ping anything for your team: enemies, cameras, traps, doors, walls, or a place to go.',
  'New to R62D? The TUTORIAL tab teaches the phases, the roles and pinging in two short playable lessons.',
  'Cameras see a cone: aim them with the mouse and switch with {leanL} and {leanR}.',
  'Change your loadout for every operator on the Operators page.',
  'Smashed barricades leave splinters that crack underfoot.',
];
const tipText = t => t.replace(/\{(\w+)\}/g, (_, id) => label(id)); // tips name your own keys
let tipI = Math.floor(Math.random() * TIPS.length);
const nextTip = () => { const el = $('tip'); el.textContent = tipText(TIPS[tipI++ % TIPS.length]); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; };
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
window.__r62d = { r3: rope3d.debug, PF, st, assist: () => ({ tgt: assistTgt, on: assistOn(), seen: (st.foesSeen || []).length }), fxOff: () => fxOff, applyFx: () => applyFx(), switchMatch, showEnd, playXp, siteFound, pad: () => ({ padAng, padReach, padOn }), freeMove, turnMove, faceMove, setAim, aimOff: () => aimOff, aimTo: (x, y) => { aimOff = { x: x - st.pred.x, y: y - st.pred.y }; }, aimMode: () => aimMode, freeAimPoint }; // for automated screenshot tests

// ---------------- settings saved per profile ----------------
// Keys and volumes live in your profile on the game computer, so they follow you to any browser.
function currentSettings() {
  try { localStorage.setItem('r62d-sens', JSON.stringify([+$('sens').value, +$('adsSens').value, +$('steadySens').value, +$('farSens').value])); } catch {}
  return { bindsVersion: BINDS_VERSION, binds: getBinds(), volMaster: +$('volMaster').value, volSfx: +$('volSfx').value, volMusic: +$('volMusic').value, vc: 2, sens: +$('sens').value, adsSens: +$('adsSens').value, steadySens: +$('steadySens').value, farSens: +$('farSens').value, aim: aimMode, aimV: 2, xh, lean: leanMode };
}
let saveTimer = 0;
function saveSettings() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { if (st.token) send({ t: 'settings', s: currentSettings() }); }, 400);
}
function applySettings(s) {
  if (s.binds && s.bindsVersion === BINDS_VERSION) applyBinds(s.binds); else if (s.binds && s.bindsVersion === 4) { applyBinds(s.binds, 4); setTimeout(saveSettings, 500); } else setTimeout(saveSettings, 500); // old layout: switch to the new defaults once
  for (const k of ['volMaster', 'volSfx', 'volMusic', 'sens', 'adsSens', 'steadySens', 'farSens']) if (typeof s[k] === 'number') $(k).value = VOL_DEF[k] !== undefined && s.vc !== 2 ? fromOld(k, s[k]) : s[k];
  if (s.vc !== 2 && typeof s.volMaster === 'number') setTimeout(saveSettings, 500); // saved before the loudness curve: store the converted values
  if (s.xh) setXhair(s.xh, false);
  if (s.lean) setLean(s.lean, false);
  if (AIM_MODES.includes(s.aim)) setAim(s.aimV === 2 ? s.aim : s.aim === 'pad' ? 'free' : s.aim, s.aimV !== 2); // the old default pad becomes the new Crosshair once
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
  st.lockAsked = false; // captured: clicks shoot; let go: the next click takes control again
  if (document.pointerLockElement) st.autoLockN = 0;
  if (isTouch || st.tv) return; // TV never takes the mouse
  if (!document.pointerLockElement && playing() && !menuOpen() && !st.quitting) $('pause').classList.remove('hidden');
});
// let go of the mouse whenever a menu is open or the match is over
setInterval(() => { if (document.pointerLockElement && document.pointerLockElement !== $('armCanvas') && (menuOpen() || !playing())) document.exitPointerLock(); }, 150);
$('pResume').addEventListener('click', () => { if (playing() && !isTouch && !st.tv) lockMouse(cv); }); // TV: nothing to aim, keep the mouse free // a phone has no mouse to capture (asking anyway re-opened this menu)
const showSens = () => { $('sensVal').textContent = ($('sens').value / 100).toFixed(2); $('adsSensVal').textContent = ($('adsSens').value / 100).toFixed(2) + '×'; $('steadySensVal').textContent = ($('steadySens').value / 100).toFixed(2) + '×'; $('farSensVal').textContent = ($('farSens').value / 100).toFixed(2) + '×'; };
for (const id of ['sens', 'adsSens', 'steadySens', 'farSens']) { $(id).addEventListener('input', showSens); $(id).addEventListener('change', saveSettings); }
try { const v = JSON.parse(localStorage.getItem('r62d-sens') || 'null'); if (v) { $('sens').value = v[0]; $('adsSens').value = v[1]; if (v[2]) $('steadySens').value = v[2]; if (v[3]) $('farSens').value = v[3]; } } catch {}
showSens();
// Every slider in Settings also has a box to type the number into (he asked). It shows the number the way the
// slider's label did (sensitivity as 1.00, not 100) and keeps up when settings are loaded from the profile.
{ const DIV = { sens: 100, adsSens: 100, steadySens: 100, farSens: 100 }, rows = [];
  for (const r of $('settings').querySelectorAll('input[type=range]')) {
    const div = DIV[r.id] || 1, lab = $(r.id + 'Val') || $(r.id + 'V'), n = document.createElement('input'), unit = document.createElement('span');
    n.type = 'number'; n.className = 'num'; n.min = r.min / div; n.max = r.max / div; n.step = (+r.step || 1) / div;
    unit.className = 'numUnit'; if (lab) lab.classList.add('hidden');
    const sync = () => {
      if (document.activeElement !== n) n.value = div > 1 ? (r.value / div).toFixed(2) : String(Math.round(r.value * 100) / 100);
      unit.textContent = lab ? lab.textContent.replace(/^[\d.,\s-]+/, '') : '';
    };
    n.addEventListener('change', () => {
      if (n.value === '' || !Number.isFinite(+n.value)) { sync(); return; }
      const st0 = +r.step || 1, v = Math.max(+r.min, Math.min(+r.max, Math.round(+n.value * div / st0) * st0));
      r.value = v; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change')); n.blur(); sync();
    });
    n.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') n.blur(); });
    r.addEventListener('input', () => setTimeout(sync));
    r.after(n, unit); rows.push(sync); sync();
  }
  setInterval(() => { if (!$('settings').classList.contains('hidden')) for (const f of rows) f(); }, 250); }
function setAim(m, save = true) {
  aimMode = m; try { localStorage.setItem('r62d-aim', m); localStorage.setItem('r62d-aim2', '1'); } catch {}
  for (const b of $('aimSeg').querySelectorAll('button')) b.classList.toggle('on', b.dataset.a === m);
  if (m !== 'cursor') { padAng = st.aim || 0; padReach = 0.6; }
  if (m === 'free') aimOff = { x: Math.cos(st.aim || 0) * 150, y: Math.sin(st.aim || 0) * 150 };
  $('aimHint').textContent = { spin: 'Rotate: like an FPS. The view turns with you so you always face up the screen. Mouse left / right turns, up / down moves the crosshair further / nearer, W always walks forward.', face: 'Face: the map stays still and the mouse turns your character. W walks the way you face, A and D step sideways, S steps back. Aiming in locks you to a narrow 30° area until you let go. Mouse up / down moves the crosshair further / nearer.', classic: 'Crosshair Classic: the first Crosshair mode. The crosshair moves the way your mouse moves and stays with you; the further out it is, the more mouse it takes to turn (like a pointer round a circle). Aiming in leaves it where it is.', free: 'Crosshair: the crosshair moves the way your mouse moves and stays with you as you walk. Hold sprint and W to sprint toward the crosshair. Push it past the edge of the screen to look further: it goes anywhere you can see. Pull it through your character to turn round.', pad: 'Aim pad: the ring on the right is a joystick for the mouse. Circle it to turn, push out to look further, go through the middle to turn round.',
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
  if (st.tv && m.from) (st.tvSay || (st.tvSay = new Map())).set(m.from, { text: m.text, t: performance.now() / 1000 }); // spoken from the character (he asked)
  if (st.tv && m.squad !== undefined) { // ESPORTS TV: the team's comms, live, under that team's player cards
    const el = $(m.squad ? 'tvCommsR' : 'tvCommsL'); if (!el) return;
    const d = document.createElement('div'); d.innerHTML = `<b>${esc(m.name.replace(/^\[\w+\] /, ''))}</b> ${esc(m.text)}`; el.appendChild(d);
    while (el.children.length > 5) el.firstChild.remove();
    setTimeout(() => d.classList.add('old'), 12000); return;
  }
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
function inApp() { return !!window.r62dApp || new URLSearchParams(location.search).has('app'); }
function toggleFullscreen() {
  if (window.r62dApp && window.r62dApp.toggleFull) return window.r62dApp.toggleFull();
  if (appWin) { fetch('/api/window', { method: 'POST' }).catch(() => {}); return; }
  if (inApp()) return;
  if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {});
}
// The desktop window can go full screen or windowed (he asked), when it knows how; the choice is kept for next time.
function showFsBtns() { for (const id of ['fsBtn', 'pFs']) $(id).style.display = inApp() && !winSwitch() ? 'none' : ''; renderGfx(); }
showFsBtns();
if (inApp() && !window.r62dApp) fetch('/api/window').then(r => r.json()).then(a => { appWin = !!a.can; showFsBtns(); }).catch(() => {});
{ let t = 0, was = null; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => {
  renderGfx(); const full = appFull(); if (appWin && full !== was) { was = full; fetch('/api/window?save=' + (full ? 'full' : 'windowed'), { method: 'POST' }).catch(() => {}); }
}, 400); }); }
$('kcBtn').onclick = () => { audio.ui(); watchKillcam(); };


