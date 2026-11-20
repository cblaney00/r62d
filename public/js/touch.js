// Phone / tablet controls (he asked: a UI that pops up by itself on mobile). The touches act like a game controller
import { TUNE } from './aimstick.js';
import { layoutTouch, polyHit, STICK } from './touchlayout.js';
// (main.js pollPad reads touchPad() when no real controller is plugged in), so every rule stays the same.
//   Left thumb: a fixed stick to move (a light push walks, silently).
//   Right: the aim stick (with fire rings only a thumb on the stick itself aims; on or just outside the ring shoots): drag to aim, further to
//   look further ahead. A red fire ring round each stick (put a thumb down on it), so you can shoot with either thumb.
//   Small buttons along the right edge and top: aim in, crouch, use (hold), reload, swap, skill, gadget, melee,
//   vault, ping, drone/cameras, previous/next camera, scoreboard (hold) and pause.
// Played sideways only: held upright a "turn your phone sideways" sign covers the match.
const R = 62; // stick radius in CSS px
const SPRINT_PUSH = 1.45; // (FIRE buttons setting) the move thumb this far out (stick radii) sprints
// Fire rings (he asked 2026-11-17: "in a ring around the joysticks there should be the fire button built behind the
// joysticks so the players can naturally flick either finger right next to the joystick to shoot"; then: a pulled
// stick must never shoot, and it covers its ring while held): a finger put down on a ring shoots (build(): ringFire). His choices: a quick tap on the aim stick aims in / out; sprint is a
// double-tap and hold on the move stick (its edge shoots now). The old FIRE buttons stay as a Settings choice.
const MOVE_SETTLE = 150, MOVE_SLIP = 12, MOVE_DEAD = 0.14; // the move thumb's settling time (ms) and slide (px), and the dead zone (share of a full push)
const NEAR_RING = 26; // (fire rings) how far past the red ring a thumb still shoots (design px)
const MOVE_R = 81; // (fire rings) how far the move thumb pushes for a full run (was R, 62: he asked for a bigger stick)
const TAP_MS = 250, TAP_PX = 12, DOUBLE_MS = 300; // a quick tap; two of them for sprint
export const fireRings = () => store('r62d-fire') !== 'buttons';
export function setFireRings(on) { store('r62d-fire', on ? 'rings' : 'buttons'); if (ui) { releaseAll(); ui.remove(); ui = null; shown = false; } } // rebuilt with the other buttons when the match shows them

// Full screen on a phone (he found Firefox's bars stayed): browsers only allow it from a tap that has ENDED (touchend /
// click; a finger landing doesn't count), so every tap anywhere asks again until it's granted, then holds it sideways.
function goFull() {
  if (!isTouch || document.fullscreenElement) return;
  const el = document.documentElement, req = el.requestFullscreen || el.mozRequestFullScreen || el.webkitRequestFullscreen;
  if (!req) return;
  try { Promise.resolve(req.call(el, { navigationUI: 'hide' })).then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch {} }).catch(() => {}); } catch {}
}

// Phone or computer? (he asked: sense it, and if that can't be told, ask when the game loads.) A clear phone (a phone
// browser, or only a finger to point with) gets touch controls; a device with both a touch screen and a mouse or
// trackpad asks once. The choice is remembered on that device and can be changed in Settings.
const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { return null; } };
const sniff = () => {
  try {
    const phone = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches);
    return phone ? 'touch' : navigator.maxTouchPoints > 0 ? 'ask' : 'desk';
  } catch { return 'desk'; }
};
const forced = /[?&]touch=1/.test(location.search) ? 'touch' : /[?&]touch=0/.test(location.search) ? 'desk' : null;
const chosen = forced || store('r62d-input'), sniffed = sniff();
export const isTouch = ['touch', 'pad'].includes(chosen || (sniffed === 'touch' ? 'touch' : 'desk'));
// Phone + controller (he asked 2026-11-18: a phone in a controller attachment should switch to the controller, or have
// it as a mode): chosen 'pad' = always the controller, no buttons on the screen. Otherwise a phone switches by itself:
// any controller input hides the touch buttons, a touch on the screen brings them back.
const padChoice = chosen === 'pad';
let phonePad = isTouch && padChoice;
export const padPlay = () => phonePad;
export function usePadNow() { if (!isTouch || phonePad) return false; phonePad = true; return true; }
try { addEventListener('touchstart', () => { if (phonePad && !padChoice) phonePad = false; }, { capture: true, passive: true }); } catch {}
// Laptop trackpad (he asked, for a friend who may only have a trackpad or a phone): keyboard and mouse rules, plus a
// shoot key, aiming in as a toggle and aim help (main.js `assistOn`)
export const isTrackpad = !isTouch && chosen === 'trackpad';
export const needsInputChoice = !chosen && sniffed === 'ask'; // touch screen AND a mouse: ask on the title screen
export function setInputChoice(c) { store('r62d-input', c); location.reload(); }
// Settings that phones especially need (he asked: adjustable): how big the menus and match text are (1 = fit the
// screen), and how much of the map you see (bigger = further zoomed out). Kept on this device.
export const uiScale = () => Math.max(0.7, Math.min(1.6, +(store('r62d-uiscale') || 1)));
// (phones the same as a computer: he asked 2026-11-16; they used to start at 1.35, further out)
// Phones (he asked 2026-11-18): start at 70% and go from 40% to 120%, kept under their own name so the new start
// takes effect on phones that already had a value saved. Computers stay 80-200%, starting at 100%.
export const VIEW_RANGE = isTouch ? [40, 120, 70] : [80, 200, 100];
const VIEW_KEY = isTouch ? 'r62d-view-phone' : 'r62d-view';
export const viewMul = () => Math.max(VIEW_RANGE[0] / 100, Math.min(VIEW_RANGE[1] / 100, +(store(VIEW_KEY) || VIEW_RANGE[2] / 100)));
export function setUiScale(v) { store('r62d-uiscale', String(v)); fitUi(); }
export function setViewMul(v) { store(VIEW_KEY, String(v)); }

// Tilt to move (he asked; phones only): tip the phone the way you want to walk. A small tilt past the dead zone walks
// (silently), a bigger one runs; the stick still works too (a thumb on it wins). "Level" is however you hold the phone
// when a match starts, or when you press ⟲ TILT. The dead zone (degrees) is adjustable in Settings.
export const tiltOn = () => store('r62d-tilt') === '1';
export const tiltDead = () => Math.max(2, Math.min(25, +(store('r62d-tiltdz') || 7)));
export function setTilt(on) {
  store('r62d-tilt', on ? '1' : '0');
  try { if (on && typeof DeviceMotionEvent !== 'undefined' && DeviceMotionEvent.requestPermission) DeviceMotionEvent.requestPermission().catch(() => {}); } catch {} // iPhones ask first
  tiltLevel = null;
}
export function setTiltDead(v) { store('r62d-tiltdz', String(v)); }
// Gyro aim (2026-11-16: he asked for the phone controls to suit two thumbs "and maybe a gyroscope"): turning the phone
// left or right, round the up-down line however you hold it, turns your aim. Your thumbs can then press AIM, CROUCH or
// RELOAD and the aim still follows you. Off / only while aimed in (the default) / always; speed; the other way round.
export const gyroMode = () => { const m = store('r62d-gyro'); return m === 'off' || m === 'always' ? m : 'ads'; };
export const gyroSens = () => Math.max(0.2, Math.min(3, +(store('r62d-gyrosens') || 1)));
export const gyroInv = () => store('r62d-gyroinv') === '1';
export function setGyro(m) { store('r62d-gyro', m); try { if (m !== 'off' && typeof DeviceMotionEvent !== 'undefined' && DeviceMotionEvent.requestPermission) DeviceMotionEvent.requestPermission().catch(() => {}); } catch {} }
// aim stick sensitivity (he asked 2026-11-17: the default was too high): lower = the thumb travels further for the same
// turn, and main.js eases the aim towards the stick (stickEase) instead of jumping
export const stickSens = () => Math.max(0.3, Math.min(1.6, +(store('r62d-sticksens') || 0.7)));
export const setStickSens = v => store('r62d-sticksens', String(v));
export const setGyroSens = v => store('r62d-gyrosens', String(v)), setGyroInv = on => store('r62d-gyroinv', on ? '1' : '0');
// Auto fire (same day): the gun shoots by itself while your crosshair is on an enemy you can see, so the right thumb only
// has to aim (phone shooters offer the same). He asked 2026-11-19: off for everyone (a new name, so phones that had it on
// start off too); Settings can still turn it on.
export const autoFire = () => store('r62d-autofire2') === '1';
export const setAutoFire = on => store('r62d-autofire2', on ? '1' : '0');
let gyroAcc = 0; // radians turned since the game last asked
const TILT_FULL = 16; // degrees past the dead zone for a full run
let grav = null, tiltLevel = null; // smoothed gravity on the screen (x right, y up; 1 = straight down), and "level"
const tiltV = { x: 0, y: 0 };
addEventListener('devicemotion', e => {
  const g = e.accelerationIncludingGravity; if (!g || g.x == null) return;
  const a = ((screen.orientation && screen.orientation.angle) || window.orientation || 0) * Math.PI / 180;
  const sx = (g.x * Math.cos(a) - g.y * Math.sin(a)) / 9.81, sy = (g.x * Math.sin(a) + g.y * Math.cos(a)) / 9.81; // turned to the screen
  grav = grav ? { x: grav.x + (sx - grav.x) * 0.3, y: grav.y + (sy - grav.y) * 0.3 } : { x: sx, y: sy };
  if (!tiltLevel) tiltLevel = { ...grav };
  // tipping an edge down: that way. sin(angle) past the dead zone, scaled so dead zone + TILT_FULL° is a full push
  let x = -(grav.x - tiltLevel.x), y = grav.y - tiltLevel.y; const l = Math.hypot(x, y);
  const d0 = Math.sin(tiltDead() * Math.PI / 180), d1 = Math.sin((tiltDead() + TILT_FULL) * Math.PI / 180);
  const k = l <= d0 ? 0 : Math.min(1, (l - d0) / (d1 - d0)) / l;
  tiltV.x = x * k; tiltV.y = y * k;
  // gyro: the turn rate round "up" (gravity, as the phone measures it: it points up), whatever way the phone is held
  const r = e.rotationRate;
  if (r && r.alpha != null && g.z != null) {
    const n = Math.hypot(g.x, g.y, g.z) || 1, yaw = ((r.alpha || 0) * g.z + (r.beta || 0) * g.x + (r.gamma || 0) * g.y) / n; // degrees a second, turning left = +
    const iv = e.interval > 1 ? e.interval / 1000 : (e.interval || 0.016); // (some browsers give ms, some seconds)
    if (Math.abs(yaw) > 1.5) gyroAcc = Math.max(-1, Math.min(1, gyroAcc - yaw * Math.PI / 180 * Math.min(0.1, iv))); // (a still phone's tiny drift is ignored)
  }
});
export const tiltLevelNow = () => { tiltLevel = grav ? { ...grav } : null; };

// button → the controller button number main.js already understands (PAD_ACTIONS in gamepad.js); 'lt' / 'rt' are the triggers
// USE, VAULT and the camera arrows only show when they do something (he found the screen too cluttered)
const BUTTONS = [
  { id: 'fireL', label: 'FIRE', b: 'rt', cls: 'fire left' }, { id: 'fireR', label: 'FIRE', b: 'rt', cls: 'fire right' },
  // ACTION (he asked 2026-11-17: one button for whatever the game prompts, to cut clutter): replaces USE and VAULT. It
  // shows what it will do (PLANT, REVIVE, VAULT...) and does it: a hold action (plant, defuse, revive, reinforce, open)
  // starts with a tap and carries on; a vault or climb happens on the tap
  // always on screen and live (he asked): with nothing prompted it PINGs what you aim at (his choice); JUMP took PING's slot
  { id: 'use', label: 'ACTION', b: 0, cls: 'ctx c-use act' },
  // AIM (he asked 2026-11-17): a small button on the bottom right of each FIRE, a tap on / tap off switch (both light up
  // together); the old AIM by the left thumb is gone. Sizes and places follow how often each is pressed (style.css,
  // "phone layout by priority"): FIRE and AIM biggest, then crouch / reload / swap round the right FIRE, then skill,
  // gadget, melee, ping, then the top row
  { id: 'ads', label: 'AIM', b: 'lt', cls: 'aim aimR' }, { id: 'adsL', label: 'AIM', b: 'lt', cls: 'aim aimL' }, { id: 'crouch', label: 'CROUCH', b: 1, cls: 'r rc' },
  { id: 'reload', label: 'RELOAD', b: 2, cls: 'r r1 c1' }, { id: 'swap', label: 'SWAP', b: 3, cls: 'r r1 c2' },
  { id: 'skill', label: 'SKILL', b: 5, cls: 'r r2 c1' }, { id: 'gadget', label: 'GADGET', b: 4, cls: 'r r2 c2' },
  { id: 'melee', label: 'MELEE', b: 11, cls: 'r r3 c1' }, { id: 'jump', label: 'JUMP', b: 10, cls: 'r r3 c2' },
  { id: 'view', label: 'CAMS', b: 24, cls: 't t1' }, { id: 'drone', label: 'DRONE', b: 23, cls: 't t8' }, { id: 'prev', label: '◀', b: 14, cls: 't t2 hidden' }, { id: 'next', label: '▶', b: 15, cls: 't t3 hidden' },
  { id: 'tiltc', label: '⟲ TILT', b: null, cls: 't t6 hidden' }, { id: 'map', label: 'MAP', b: 22, cls: 't t7' },
  { id: 'leanL', label: '◀ LEAN', b: 20, cls: 'lean l1' }, { id: 'leanR', label: 'LEAN ▶', b: 21, cls: 'lean l2' }, { id: 'score', label: 'SCORES', b: 8, cls: 't t4' }, { id: 'pause', label: '❚❚', b: 9, cls: 't t5' },
  { id: 'help', label: '?', b: null, cls: 't t9' }, // the guide to the pictures
];
// Pictures instead of words on the buttons (he asked 2026-11-16: the word buttons were big and in the way); the ? button
// opens a guide (HELP below) that names each one
const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const ICONS = {
  fire: svg('<path d="M9 21h6M10 21V9l2-6 2 6v12" fill="currentColor" fill-opacity=".25"/>'),
  ads: svg('<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>'),
  crouch: svg('<circle cx="13" cy="4.5" r="2"/><path d="M12 8l-2 5 4 2-1 6M10 13l-4 2M14 15l4 1"/>'),
  sprint: svg('<path d="M5 6l6 6-6 6M12 6l6 6-6 6"/>'),
  leanL: svg('<circle cx="8" cy="5" r="2"/><path d="M9 8l4 13M10.5 13l-5 1M19 12h-6M15 9l-3 3 3 3"/>'),
  leanR: svg('<circle cx="16" cy="5" r="2"/><path d="M15 8l-4 13M13.5 13l5 1M5 12h6M9 9l3 3-3 3"/>'),
  reload: svg('<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>'),
  swap: svg('<path d="M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4"/>'),
  skill: svg('<path d="M13 2L5 13h6l-1 9 8-11h-6z" fill="currentColor" fill-opacity=".25"/>'),
  gadget: svg('<circle cx="11" cy="14" r="6"/><path d="M11 8V5h4M15 5l3 2M13 3h-4"/>'),
  melee: svg('<path d="M14 3l7 7-9 9-3-1-1-3z"/><path d="M8 15l-5 5M6 13l5 5"/>'),
  jump: svg('<path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 20h14" stroke-width="2.6"/>'),
  ping: svg('<path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>'),
  use: svg('<path d="M9 12V5a1.5 1.5 0 0 1 3 0v6M12 10V4a1.5 1.5 0 0 1 3 0v7M15 10a1.5 1.5 0 0 1 3 0v4c0 4-3 7-6 7h-1c-3 0-4.5-2-5.5-4.5L4 13a1.5 1.5 0 0 1 2.6-1.4L9 15"/>'),
  vault: svg('<path d="M3 21h18M9 21v-5h6v5"/><path d="M4 14c2-8 14-8 16 0"/><path d="M17 11l3 3 2-4"/>'),
  map: svg('<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>'),
  view: svg('<rect x="3" y="7" width="12" height="10" rx="2"/><path d="M15 11l6-3v8l-6-3z"/>'),
  drone: svg('<rect x="8" y="9" width="8" height="6" rx="1.5"/><circle cx="5" cy="7" r="2.2"/><circle cx="19" cy="7" r="2.2"/><circle cx="5" cy="17" r="2.2"/><circle cx="19" cy="17" r="2.2"/><path d="M7 8.5l1.5 1.5M17 8.5l-1.5 1.5M7 15.5l1.5-1.5M17 15.5l-1.5-1.5"/>'),
  score: svg('<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/>'),
  pause: svg('<path d="M8 5v14M16 5v14" stroke-width="3"/>'),
  prev: svg('<path d="M15 5l-7 7 7 7" stroke-width="2.6"/>'), next: svg('<path d="M9 5l7 7-7 7" stroke-width="2.6"/>'),
  tiltc: svg('<path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4v5h5"/>'),
  help: '<b>?</b>',
};
const HELP = () => [ // (a function: it follows the fire rings setting)
  ...(fireRings() ? [['fire', 'SHOOT', 'Thumb on a red ring: shoots while it stays down. Drag the right one to aim.'], ['ads', 'AIM IN', 'Quick tap on the aim stick: aim in (it goes blue). Again: out.']]
    : [['fire', 'FIRE', 'Shoot. Drag the right one to aim while you shoot.'], ['ads', 'AIM', 'The small button on each FIRE: tap to aim in, tap again to aim out.']]),
  ['crouch', 'CROUCH', 'Tap: crouch. Hold: lie down. Sprinting: slide.'], ['leanL', 'LEAN', 'Lean round a corner: tap on, tap off.'],
  ['reload', 'RELOAD', 'Reload your gun.'], ['swap', 'SWAP', 'Switch between your guns.'],
  ['skill', 'SKILL', 'Your operator\'s ability (the number: how many left).'], ['gadget', 'GADGET', 'Throw or place your gadget.'],
  ['melee', 'MELEE', 'Knife hit; breaks wooden boards.'], ['jump', 'JUMP', 'Hop onto furniture, over low cover or through windows.'],
  ['use', 'ACTION', 'One tap: plant, defuse, revive, climb… what the game prompts; else a PING.'],
  ['view', 'CAMS', 'Your team\'s cameras and drones. Again: back to your body.'], ['drone', 'DRONE', 'Put out and drive your drone (the number: how many you carry).'], ['sprint', 'SPRINT', fireRings() ? 'Double-tap and hold the move stick. On a drone: CROUCH.' : 'Push the move stick past its edge. On a drone the crouch button sprints.'],
  ['map', 'MAP', 'The map: tap it to ping a spot.'], ['score', 'SCORES', 'Who is up and who is down.'],
  ['prev', 'PREVIOUS / NEXT', 'Flip through cameras and drones.'], ['pause', 'PAUSE', 'The pause menu.'],
  ['tiltc', 'LEVEL', 'Tilt to move: the way you hold it now is level.'],
];
const N = 25; // (23 DRONE, 24 CAMS: he asked 2026-11-18)
const held = new Array(N).fill(false), trig = { lt: 0, rt: 0 }, tc = { lt: 0, rt: 0 }; // tc: fingers on each trigger button
let prevHeld = new Array(N).fill(false);
const ls = { x: 0, y: 0 }, rs = { x: 0, y: 0 };
let releaseAll = () => {}, fireAim = false, sprintLock = false, adsLatch = false, adsEl = null;
// USE (same day: planting meant holding USE with the aiming thumb for 7 s, unable to look round): a tap starts it and it
// keeps going (plant, defuse, reinforce, revive...) until it is done, you tap again or you move with the stick
let useLatch = false, useEl = null, useLostT = 0;
const setUse = on => { useLatch = on; held[0] = on; if (useEl) useEl.classList.toggle('on', on); };
const setAds = on => { adsLatch = on; trig.lt = on ? 1 : 0; if (ui) { for (const el of ui.querySelectorAll('.tbtn.aim')) el.classList.toggle('on', on); ui.querySelector('#tsRight').classList.toggle('aimed', on); } };
// fire rings: each thumb on a ring counts as one finger on the trigger, like a FIRE button did
const trigger = on => { tc.rt = Math.max(0, tc.rt + (on ? 1 : -1)); trig.rt = tc.rt ? 1 : 0; };
let lastLeftTap = 0; // when a quick tap on the move stick last ended (a second one straight after sprints) // AIM: tap on, tap off // sprintLock: the move stick pushed past its ring (sprint until you ease off or let go) // the right stick's value comes from dragging FIRE: it turns you but keeps how far ahead you look
let aimStart = () => null; export function onAimStart(f) { aimStart = f; } // main.js: where you aim now, as a stick vector (length 0..1)
let ui = null, shown = false, recentre = () => {}, aimOn = false, aimPx = null, aimPxN = 0; // aimPx: the aiming finger (aim stick or dragged FIRE) in screen px; aimPxN changes with each new finger
export const touchAimReset = () => recentre();

function stickOf(v) { const l = Math.min(1, Math.hypot(v.x, v.y)); return l < 0.08 ? { x: 0, y: 0, l: 0 } : { x: v.x / Math.max(l, 1e-6) * l, y: v.y / Math.max(l, 1e-6) * l, l }; }

// what pollPad reads each frame, in the same shape as gamepad.js readPad()
export function touchPad() {
  if (!isTouch || !shown) return null;
  const pressed = held.map((v, i) => v && !prevHeld[i]), released = prevHeld.map((v, i) => v && !held[i]);
  prevHeld = held.slice();
  const L = (ls.x || ls.y || !tiltOn()) ? ls : tiltV; // a thumb on the stick wins over tilting
  const gyro = gyroAcc; gyroAcc = 0;
  return { name: 'Touch screen', ls: stickOf(L), rs: stickOf(rs), rsRaw: { x: rs.x, y: rs.y }, rsOn: aimOn, rsDir: fireAim, rsHeld: rs.x !== 0 || rs.y !== 0, rsPx: aimPx && { x: aimPx.x, y: aimPx.y, n: aimPxN }, sprint: sprintLock && L === ls, lt: trig.lt, rt: trig.rt, held: held.slice(), pressed, released, gyro }; // rsOn: a thumb is on the aim stick (main.js / aimstick.js turn it into aim)
}
export const touchActive = () => isTouch && shown;

function build() {
  ui = document.createElement('div'); ui.id = 'touchUI'; const rings = fireRings(); ui.className = 'hidden' + (rings ? ' rings' : '');
  document.documentElement.classList.toggle('firerings', rings);
  const buttons = rings ? BUTTONS.filter(b => !/^(fireL|fireR|ads|adsL)$/.test(b.id)) : BUTTONS;
  ui.innerHTML = `<div class="tzone" id="tzRight"></div><div class="tzone" id="tzLeft"></div>
    <div class="tstick" id="tsLeft"><i></i></div><div class="tstick dyn" id="tsRight"><i></i></div>
    ${buttons.map(b => `<button class="tbtn ico ${b.cls}" data-id="${b.id}" data-label="${b.label}" aria-label="${b.label}">${ICONS[b.id] || (b.id.startsWith('fire') ? ICONS.fire : b.id === 'adsL' ? ICONS.ads : b.label)}</button>`).join('')}
    <div id="tHelp" class="hidden"><h3>WHAT THE BUTTONS DO</h3><div class="thGrid">${HELP().map(([i, n, d]) => `<div><span class="thI">${ICONS[i]}</span><b>${n}</b><small>${d}</small></div>`).join('')}</div><p>${rings ? "Left side: the move stick (double-tap and hold to sprint). Right side: drag anywhere to aim, a quick tap on the aim stick to aim in. Tap a red ring to shoot." : "Left side: the move stick (push past its ring to sprint). Right side: drag anywhere to aim."} Tap to close.</p></div>
    <div id="tTurn" class="hidden"><b>⟳</b>Turn your phone sideways to play</div>`;
  document.body.appendChild(ui);
  const base = ui.querySelector('#tsLeft'), dyn = ui.querySelector('#tsRight');
  if (rings) layoutTouch(ui); // the polygon buttons (touchlayout.js)
  const knob = (el, v, k = R) => { el.querySelector('i').style.transform = `translate(${v.x * k}px, ${v.y * k}px)`; };
  const tz = () => +getComputedStyle(document.documentElement).getPropertyValue('--tz') || 1;
  // Every finger is followed on its own (he found two thumbs at once didn't work: when both land together the browser
  // only reports one of them as a pointer). Touch events list each finger, and we look up what is under it ourselves.
  const fingers = new Map(); // finger → { move(x, y), end() }
  let leftF = null, aimF = null, ox = 0, oy = 0, tx = 0, ty = 0;
  // aiming in re-centres the right stick under the thumb, so dragging from there moves the crosshair out from close in
  // the aim stick is drawn in one fixed place (he asked 2026-11-17: a consistent location), left of the right thumb's
  // buttons; a thumb landing on it drives it from where it landed, so nothing jumps (FIRE buttons setting: anywhere on the right half)
  // (placed by style.css: #tsRight, so it follows the screen turning or resizing)
  // he asked (2026-11-18): a thumb put on a stick shows as touching its middle, the knob moving from there, never jumping
  // to where the touch landed. The aim stick's value still starts from where you aim now (the smooth pickup below); only
  // its knob is drawn from that start (k0).
  let k0 = { x: 0, y: 0 };
  const aimKnob = K => { let u = rs.x - k0.x, v = rs.y - k0.y; const l = Math.hypot(u, v); if (l > 1) { u /= l; v /= l; } knob(dyn, { x: u, y: v }, K); };
  recentre = () => { if (aimF === null) return; ox = tx; oy = ty; rs.x = rs.y = 0; k0 = { x: 0, y: 0 }; aimKnob(rings ? STICK.KNOB : R); };
  // Fire rings (he asked again 2026-11-17: pulling a stick all the way shot by itself): a thumb steering a stick never
  // shoots, however far it goes, and while held the stick covers its ring. The ring is a fire button of its own: a
  // finger put down ON the ring of a stick nobody is holding shoots (the right one can be dragged to aim as it shoots,
  // like the old right FIRE).
  // where a finger landed round a stick nobody is holding (he asked 2026-11-18: only the sticks themselves aim and move;
  // a thumb just outside the red ring shoots instead of starting a stick there, anywhere else does nothing):
  // 'stick' inside it, 'ring' on its red ring, 'near' just outside the ring (NEAR_RING design px), else null
  const zoneOf = (el, x, y) => { if (el.classList.contains('held')) return null; const b = el.getBoundingClientRect(), rv = b.width / 2, u = rv / STICK.VR, d = Math.hypot(x - b.left - rv, y - b.top - rv), ro = STICK.RING * u;
    return d <= rv * 1.1 ? 'stick' : d < ro + 6 * u ? 'ring' : d < ro + NEAR_RING * u ? 'near' : null; }; // (clearly outside the stick: a thumb landing near its edge steers, it doesn't shoot)
  const ringFire = (id, el, x0, y0, drag) => {
    trigger(true); el.classList.add('firing'); let fx = x0, fy = y0, dragAim = false;
    fingers.set(id, {
      move(x, y) {
        if (!drag || aimF !== null) return; // the aim stick has priority if a thumb is on it too
        let u = (x - fx) / R, v = (y - fy) / R; const l = Math.hypot(u, v);
        if (!dragAim) aimPxN++; aimPx = { x, y }; // (the rope's drag aim follows this thumb too)
        if (!dragAim && l * R < 10) return; // a small wobble while tapping doesn't turn you
        dragAim = fireAim = true; if (l > 1) { fx += (u / l) * (l - 1) * R; fy += (v / l) * (l - 1) * R; u /= l; v /= l; }
        rs.x = u; rs.y = v;
      },
      end() { trigger(false); el.classList.remove('firing'); if (drag && aimF === null) aimPx = null; if (dragAim && aimF === null) rs.x = rs.y = 0; if (dragAim) fireAim = false; },
    });
  };
  const grab = (id, x, y) => {
    if (fingers.has(id)) return; // the same finger can be announced twice
    const under = document.elementFromPoint(x, y);
    const btn = (rings && polyHit(ui, x, y)) || (under && under.closest && under.closest('#touchUI .tbtn:not(.poly)')); // (polygon buttons: only inside their shape)
    if (under && under.closest && under.closest('#tHelp')) { ui.querySelector('#tHelp').classList.add('hidden'); return; } // a tap closes the guide
    if (btn && !btn.classList.contains('hidden')) return pressButton(id, btn, x, y);
    // a page button under the touch zones (free play's OPERATORS · GUNS · BOTS, the drone / camera bar): the zones take
    // every touch, so the button never heard the tap (he couldn't switch operator in free play on a phone)
    const pb = !btn && document.elementsFromPoint(x, y).map(e => e.closest && e.closest('#freeHint button, #cambar button, #kcBtn')).find(Boolean);
    if (pb) { pb.click(); return; }
    const zr = rings ? zoneOf(dyn, x, y) : null, zl = rings && leftF === null ? zoneOf(base, x, y) : null;
    if (zr === 'ring') return ringFire(id, dyn, x, y, true); // (on the aim stick's ring: drag to aim as you shoot)
    if (zl === 'ring' || zl === 'near') return ringFire(id, base, x, y, false);
    if (zr === 'near') return ringFire(id, dyn, x, y, false); // (outside the ring: shoots, never aims)
    const side = rings ? (zr === 'stick' ? 'R' : zl === 'stick' ? 'L' : null) : x >= innerWidth / 2 ? 'R' : y > innerHeight * 0.3 ? 'L' : null;
    if (side === 'R') { // right half: the aim stick appears under the thumb
      if (aimF !== null) return;
      aimF = id; aimOn = true; ox = tx = x; oy = ty = y; aimPx = { x, y }; aimPxN++;
      const K = rings ? STICK.KNOB : R; // (with the rings the held stick covers its ring, so the knob travels further)
      dyn.classList.add('held'); rs.x = rs.y = 0;
      // a smooth pickup (he asked 2026-11-18: the reticle jumped when the thumb landed): the stick's centre is put so that
      // the landing spot already means where you aim now; from there it is the same stick as always, whole range and all
      { const o = aimStart(); if (o && Math.hypot(o.x, o.y) > 0.02) { const Ra = R / stickSens() * TUNE.TRAVEL; ox = x - o.x * Ra; oy = y - o.y * Ra; rs.x = o.x; rs.y = o.y; } }
      k0 = { x: rs.x, y: rs.y }; aimKnob(K); // (the knob in the middle)
      const t0 = performance.now(), lx = x, ly = y; let mv = 0, settled = false; // (lx, ly: where the thumb landed; a quick tap is measured from there)
      fingers.set(id, {
        move(x, y) {
          const Ra = R / stickSens() * TUNE.TRAVEL; // (lower sensitivity: a longer reach for the thumb; TRAVEL: extra room for fine aim, he asked)
          // a thumb settling as it lands (he asked 2026-11-18: the aim stick moved the aim before he meant to): for its first
          // MOVE_SETTLE ms, while it stays within MOVE_SLIP px, the stick's centre moves with it, so the aim stays put
          if (!settled) { if (performance.now() - t0 < MOVE_SETTLE && Math.hypot(x - lx, y - ly) < MOVE_SLIP * tz()) { ox += x - tx; oy += y - ty; } else settled = true; }
          tx = x; ty = y; aimPx = { x, y }; mv = Math.max(mv, Math.hypot(x - lx, y - ly)); let u = (x - ox) / Ra, v = (y - oy) / Ra; const l = Math.hypot(u, v);
          if (l > 1) { ox += (u / l) * (l - 1) * Ra; oy += (v / l) * (l - 1) * Ra; u /= l; v /= l; } // the centre follows a thumb that slides past the edge
          rs.x = u; rs.y = v; aimKnob(K);
        },
        end() {
          if (rings && performance.now() - t0 < TAP_MS && mv < TAP_PX) setAds(!adsLatch); // a quick tap aims in / out (his choice)
          aimF = null; aimOn = false; aimPx = null; rs.x = rs.y = 0; k0 = { x: 0, y: 0 }; knob(dyn, rs, K); dyn.classList.remove('held');
        },
      });
    } else if (side === 'L') { // the move stick (FIRE buttons setting: it jumps to wherever the thumb lands on the lower left)
      if (leftF !== null) return;
      // (with the rings the stick is a bit bigger, he asked: a longer push for a full run, and it covers its ring while held)
      leftF = id; const z = tz(), r = (rings ? MOVE_R : R) * z, half = rings ? STICK.VR : 62, K = rings ? STICK.KNOB : R, t0 = performance.now(); let cx = x, cy = y, mv = 0, settled = false;
      if (!rings) { base.style.left = `${cx / z - half}px`; base.style.top = `${cy / z - half}px`; base.style.bottom = 'auto'; } base.classList.add('held'); // (fire rings: the stick stays put, the knob starts in its middle)
      if (rings && t0 - lastLeftTap < DOUBLE_MS) { setAds(false); sprintLock = true; } // double-tap and hold: sprint until you let go (his choice)
      lastLeftTap = 0;
      // A thumb put down is not a push (he asked 2026-11-18: landing on the stick often walked already): while it settles
      // (its first MOVE_SETTLE ms, or until it travels MOVE_SLIP px) the stick's centre slides along under it, and after
      // that a small dead zone in the middle walks nowhere, the push growing smoothly from its edge.
      const move = (x, y) => {
        if (!settled) { const now = performance.now(), d = Math.hypot(x - cx, y - cy); if (now - t0 < MOVE_SETTLE && d < MOVE_SLIP * z) { cx = x; cy = y; if (!rings) { base.style.left = `${cx / z - half}px`; base.style.top = `${cy / z - half}px`; } } else settled = true; }
        let u = (x - cx) / r, v = (y - cy) / r; const l0 = Math.hypot(u, v), dz = l0 < MOVE_DEAD ? 0 : (l0 - MOVE_DEAD) / (1 - MOVE_DEAD) / l0; u *= dz; v *= dz; const l = Math.hypot(u, v); mv = Math.max(mv, l * r); if (l > 0.4 && useLatch) setUse(false);
        if (!rings) { if (l >= SPRINT_PUSH) { if (!sprintLock) setAds(false); sprintLock = true; } else if (l < 0.6) sprintLock = false; } // (FIRE buttons: push past the ring to sprint, like phone shooters)
        base.classList.toggle('spr', sprintLock); if (l > 1) { u /= l; v /= l; } ls.x = u; ls.y = v; knob(base, ls, K);
      };
      move(x, y);
      fingers.set(id, { move, end() {
        if (rings && !sprintLock && performance.now() - t0 < TAP_MS && mv < TAP_PX) lastLeftTap = performance.now(); // a quick tap: the first half of a double-tap
        leftF = null; sprintLock = false; base.classList.remove('spr'); ls.x = ls.y = 0; knob(base, ls, K); base.style.left = base.style.top = base.style.bottom = ''; base.classList.remove('held'); } });
    }
  };
  // buttons: held while the finger that pressed them is down (wherever it slides)
  const pressButton = (id, el, x0, y0) => {
    const b = BUTTONS.find(q => q.id === el.dataset.id);
    if (b.id === 'ads' || b.id === 'adsL') { setAds(!adsLatch); return; } // a tap switches aiming in on or off (either AIM)
    if (b.id === 'use' && el.dataset.act === 'ping') { held[12] = true; el.classList.add('on'); fingers.set(id, { move() {}, end() { held[12] = false; el.classList.remove('on'); } }); return; } // ACTION as PING
    if (b.id === 'use' && el.dataset.act === 'vault') { held[10] = true; el.classList.add('on'); fingers.set(id, { move() {}, end() { held[10] = false; el.classList.remove('on'); } }); return; } // ACTION as a vault: pressed while the finger is down
    if (b.id === 'use') { useEl = el; useLostT = 0; setUse(!useLatch); return; } // a tap starts using, and it carries on
    if (b.id === 'help') { const h = ui.querySelector('#tHelp'); h.classList.toggle('hidden'); return; } // the guide (tap it to close)
    if (b.b === null) { tiltLevelNow(); el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 200); return; } // ⟲ TILT: how you hold it now is level
    const set = on => { el.classList.toggle('on', on); if (b.b === 'lt' || b.b === 'rt') { tc[b.b] = Math.max(0, tc[b.b] + (on ? 1 : -1)); trig[b.b] = tc[b.b] ? 1 : 0; } else held[b.b] = on; };
    set(true);
    let fx = x0, fy = y0, dragAim = false; // the right FIRE can be dragged to aim while shooting (like phone shooters)
    fingers.set(id, {
      move(x, y) {
        if (b.id !== 'fireR' || aimF !== null) return; // the aim stick has priority if a thumb is on it too
        let u = (x - fx) / R, v = (y - fy) / R; const l = Math.hypot(u, v);
        if (aimF === null) { if (!dragAim) aimPxN++; aimPx = { x, y }; } // (the rope's drag aim follows the FIRE thumb too)
        if (!dragAim && l * R < 10) return; // a small wobble while tapping doesn't turn you
        dragAim = fireAim = true; if (l > 1) { fx += (u / l) * (l - 1) * R; fy += (v / l) * (l - 1) * R; u /= l; v /= l; }
        rs.x = u; rs.y = v;
      },
      end() { set(false); if (aimF === null) aimPx = null; if (dragAim && aimF === null) rs.x = rs.y = 0; if (dragAim) fireAim = false; },
    });
  };
  const release = id => { const f = fingers.get(id); if (f) { fingers.delete(id); f.end(); } };
  ui.addEventListener('touchstart', e => { for (const t of e.changedTouches) grab('t' + t.identifier, t.clientX, t.clientY); if (e.cancelable) e.preventDefault(); }, { passive: false });
  addEventListener('touchmove', e => { for (const t of e.changedTouches) { const f = fingers.get('t' + t.identifier); if (f) f.move(t.clientX, t.clientY); } }, { passive: true });
  const tend = e => { for (const t of e.changedTouches) release('t' + t.identifier); };
  addEventListener('touchend', tend, true); addEventListener('touchcancel', tend, true);
  // a mouse or pen (a laptop set to touch controls) works the same way; touches are handled above
  ui.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') return; grab('p' + e.pointerId, e.clientX, e.clientY); e.preventDefault(); });
  addEventListener('pointermove', e => { if (e.pointerType === 'touch') return; const f = fingers.get('p' + e.pointerId); if (f) f.move(e.clientX, e.clientY); });
  addEventListener('pointerup', e => { if (e.pointerType !== 'touch') release('p' + e.pointerId); }); addEventListener('pointercancel', e => { if (e.pointerType !== 'touch') release('p' + e.pointerId); });
  ui.addEventListener('contextmenu', e => e.preventDefault());
  releaseAll = () => { for (const id of [...fingers.keys()]) release(id); };
}

// main.js says each frame what the context buttons can do ({ use, vault, cams }); one under a finger stays until let go
const ctxSeen = { prev: 0, next: 0 }; // (ACTION is always shown)
export function touchContext(c) {
  if (!ui || !shown) return;
  const now = performance.now();
  if (useLatch && !c.use && !c.busy) { if (!useLostT) useLostT = now; else if (now - useLostT > 600) setUse(false); } else useLostT = 0; // nothing left to use: let go
  { // ACTION: what the prompt asks for, with its word under the picture (kept while a finger holds it)
    const el = ui.querySelector('[data-id="use"]'), act = c.vault ? 'vault' : c.use ? 'use' : 'ping', w = act === 'ping' ? 'PING' : c.word || '';
    if (!el.classList.contains('on') && (el.dataset.act !== act || el.dataset.w !== w)) { el.dataset.act = act; el.dataset.w = w; el.innerHTML = ICONS[act] + (w ? `<span class="aw">${w}</span>` : ''); el.classList.toggle('idle', act === 'ping'); }
  }
  for (const id in ctxSeen) {
    if (id === 'prev' || id === 'next' ? c.cams : c[id]) ctxSeen[id] = now;
    const el = ui.querySelector(`[data-id="${id}"]`), want = now - ctxSeen[id] < 400 || el.classList.contains('on');
    if (el.classList.contains('hidden') === want) el.classList.toggle('hidden', !want);
  }
  for (const [id, d] of [['leanL', -1], ['leanR', 1]]) { const el = ui.querySelector(`[data-id="${id}"]`); el.classList.toggle('hidden', !c.body); el.classList.toggle('leaning', c.lean === d); } // lean: only on your own body; lit while leaning that way
  if (!c.body && adsLatch) setAds(false); for (const el of ui.querySelectorAll('.tbtn.aim')) if (el.classList.contains('hidden') === !!c.body) el.classList.toggle('hidden', !c.body); // AIM: only on your own body too (it does nothing on a drone or camera, and the camera arrows need its place on small phones)
  // (the lit lean is 'leaning', not 'act': 'act' is ACTION's class, and it moved the lean button onto ACTION beside FIRE)
  const cr = ui.querySelector('[data-id="crouch"]'), cl = c.drone ? 'sprint' : 'crouch'; // on a drone the crouch button sprints
  if (cr.dataset.ic !== cl) { cr.dataset.ic = cl; cr.innerHTML = ICONS[cl]; cr.setAttribute('aria-label', cl.toUpperCase()); }
  { const dr = ui.querySelector('[data-id="drone"]'); if (dr && dr.classList.contains('hidden') === !!c.atk) dr.classList.toggle('hidden', !c.atk); } // DRONE: attackers only
  for (const [id, n] of [['skill', c.badge.skill], ['gadget', c.badge.gadget], ['drone', c.badge.drone]]) { // how many are left, on the button itself
    const el = ui.querySelector(`[data-id="${id}"]`), h = (ICONS[id] || el.dataset.label) + (n ? `<em>${n}</em>` : '');
    if (el.innerHTML !== h) { el.innerHTML = h; el.classList.toggle('out', n === '0' || n === '0%'); }
  }
}

// main.js calls this every frame: show the controls only while playing (not in menus)
export function setTouchVisible(on) {
  if (!isTouch) return;
  // playing a phone with a controller: no buttons on the screen, but the same compact match layout (he found the HUD and
  // kill feed huge until Lando touched the screen), laid out like a computer (html.padplay, style.css)
  const inMatch = !!on; on = on && !phonePad;
  document.documentElement.classList.toggle('padplay', inMatch && phonePad);
  document.documentElement.classList.toggle('touchplay', inMatch);
  if (!ui) build();
  const upright = innerHeight > innerWidth;
  ui.querySelector('#tTurn').classList.toggle('hidden', !(on && upright));
  if (on === shown) return;
  if (on) { tiltLevel = null; ui.querySelector('[data-id="tiltc"]').classList.toggle('hidden', !tiltOn()); } // a match starts level
  shown = on; ui.classList.toggle('hidden', !on); keepAwake(inMatch);
  if (!on) { releaseAll(); setAds(false); setUse(false); sprintLock = false; ls.x = ls.y = rs.x = rs.y = 0; held.fill(false); trig.lt = trig.rt = tc.lt = tc.rt = 0; for (const el of ui.querySelectorAll('.tbtn.on')) el.classList.remove('on'); }
}
// Menus and match text shrink to fit small screens (the game picture itself always fills the screen), times the
// player's own size setting. Menus are laid out for ~900 px tall, the match text for ~760 (and both for the width).
const PHONE_UI = 0.75;
function fitUi() {
  const h = Math.min(innerHeight, innerWidth > innerHeight ? innerHeight : innerWidth * 0.6), w = innerWidth, s = uiScale();
  // phones lay menus out for ~640 tall (they scroll) and match text for ~520, so text stays readable (he found it too small)
  const fit = isTouch ? Math.min(1, h / 640, w / 1150) : Math.min(1, h / 900, w / 1500);
  const hud = isTouch ? Math.min(1, h / 520, w / 1000) : Math.min(1, h / 760, w / 1300);
  const room = isTouch ? Math.min(h / 640, w / 1150) : Math.min(h / 900, w / 1500); // bigger than this and menus spill off the screen
  // phones (he asked 2026-11-19): the match HUD and touch buttons a quarter smaller; menus too, but never under 0.5, where
  // their text would drop below the minimum size (style.css --minz) and spill out of its boxes
  const P = isTouch ? PHONE_UI : 1;
  document.documentElement.style.setProperty('--uiz', Math.max(isTouch ? 0.5 : 0.3, Math.min(fit * s, Math.max(fit, room)) * P).toFixed(3));
  document.documentElement.style.setProperty('--hudz', Math.max(0.3, Math.min(1.4, hud * s) * P).toFixed(3));
  document.documentElement.style.setProperty('--tz', (Math.max(0.7, Math.min(1.15, h / 430)) * P).toFixed(3)); // touch buttons: smaller on short screens
  document.documentElement.classList.toggle('fitui', isTouch || fit < 1 || s !== 1);
}
if (isTouch) document.documentElement.classList.add('touch');
// the phone app's measured camera hole and rounded corners (style.css --sl..): page px to keep clear from each edge
// The camera hole (he asked 2026-11-18, on his Flip 7: moving everything away from the hole made the screen lopsided; he
// chose: use the whole screen and move only what would sit on the hole). The edges keep clear of the rounded corners
// only (--as*, the same on both sides); the hole is a box: the phone app measures it (insets().holes), a browser only
// tells how deep its strip is (env(safe-area-inset-left/right)), so there it is taken as a box in the middle of that
// edge, where a phone's front camera sits when held sideways. dodgeHole slides any piece that would overlap it sideways,
// just clear of it, and nothing else.
let holes = [];
const envProbe = (() => { if (!isTouch) return null; const d = document.createElement('div'); d.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding-left:env(safe-area-inset-left,0px);padding-right:env(safe-area-inset-right,0px)'; document.documentElement.appendChild(d); return d; })();
function applyInsets() {
  let o = {}; try { if (window.r62dApp && window.r62dApp.insets) o = JSON.parse(window.r62dApp.insets()) || {}; } catch {}
  for (const k of ['l', 't', 'r', 'b']) document.documentElement.style.setProperty('--as' + k, Math.round(+o[k] || 0) + 'px');
  const W = innerWidth, H = innerHeight;
  if (Array.isArray(o.holes)) holes = o.holes.filter(h => h && h.w > 0 && h.h > 0 && h.w < W * 0.6 && h.h < H * 0.6);
  else if (envProbe) { // a browser: the strip's depth only
    const cs = getComputedStyle(envProbe), L = parseFloat(cs.paddingLeft) || 0, R = parseFloat(cs.paddingRight) || 0, box = (x, w) => { const h = w >= 40 ? H * 0.55 : w * 3; return { x, y: (H - h) / 2, w, h }; };
    holes = []; if (L > 4) holes.push(box(0, L)); if (R > 4) holes.push(box(W - R, R));
  }
  if (window.__holeTest) holes = window.__holeTest; // (tests: a pretend hole)
  dodgeHole();
}
const DODGE = '#hud > *, #touchUI > *, #touchUI .tbtn, #corner, #chat, #lobby > *, #select > *, #settings > *, #pause > *';
function dodgeHole() {
  if (!holes.length) { if (dodgeHole.on) { for (const el of document.querySelectorAll('[data-dodge]')) { el.style.translate = ''; if (el.dataset.pad0 !== undefined) { el.style.padding = el.dataset.pad0; delete el.dataset.pad0; } el.removeAttribute('data-dodge'); } dodgeHole.on = false; } return; }
  dodgeHole.on = true;
  const W = innerWidth;
  const list = [...document.querySelectorAll(DODGE)];
  for (let i = 0; i < list.length; i++) {
    const el = list[i], dx0 = +(el.dataset.dodge || 0), r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    if (r.width > W * 0.6) { if ((el.__dd = (el.parentElement && el.parentElement.__dd || 0) + 1) <= 3 && holes.some(h => r.left <= h.x + h.w && r.right >= h.x && r.top <= h.y + h.h && r.bottom >= h.y)) list.push(...el.children); continue; } // a wide panel over the hole: its pieces move instead
    const inFlow = ['static', 'relative'].includes(getComputedStyle(el).position), L = inFlow ? r.left : r.left - dx0, R = inFlow ? r.right : r.right - dx0; let dx = 0; // (a card in a menu grid stays in line: only what is in it moves clear, by padding)
    for (const h of holes) {
      const pad = 6; if (R <= h.x - pad || L >= h.x + h.w + pad || r.bottom <= h.y - pad || r.top >= h.y + h.h + pad) continue;
      dx = h.x + h.w / 2 < W / 2 ? Math.max(dx, h.x + h.w + pad - L) : Math.min(dx, h.x - pad - R); // slide away from the edge the hole is on, just clear
    }
    if (dx === dx0) continue;
    if (inFlow) { if (el.dataset.pad0 === undefined) el.dataset.pad0 = el.style.padding || ''; el.style.padding = el.dataset.pad0; if (dx) { const cs = getComputedStyle(el); if (dx > 0) el.style.paddingLeft = (parseFloat(cs.paddingLeft) + dx) + 'px'; else el.style.paddingRight = (parseFloat(cs.paddingRight) - dx) + 'px'; } }
    else el.style.translate = dx ? `${Math.round(dx)}px 0` : '';
    if (dx) el.dataset.dodge = dx; else { el.removeAttribute('data-dodge'); if (inFlow) { el.style.padding = el.dataset.pad0; delete el.dataset.pad0; } }
  }
}
if (isTouch) setInterval(() => { if (!document.hidden) dodgeHole(); }, 500);
window.onInsets = applyInsets; applyInsets(); addEventListener('resize', () => setTimeout(applyInsets, 150));
fitUi(); addEventListener('resize', fitUi);
addEventListener('touchend', goFull, true); addEventListener('click', goFull, true);

// keep a phone's screen awake during a match (it would dim and lock mid-round otherwise)
let wake = null;
function keepAwake(on) {
  try {
    if (on && !wake && navigator.wakeLock) navigator.wakeLock.request('screen').then(w => { wake = w; w.addEventListener('release', () => { wake = null; }); }).catch(() => {});
    else if (!on && wake) { wake.release().catch(() => {}); wake = null; }
  } catch {}
}
