// Phone / tablet controls (he asked: a UI that pops up by itself on mobile). The touches act like a game controller
// (main.js pollPad reads touchPad() when no real controller is plugged in), so every rule stays the same.
//   Left thumb: a fixed stick to move (a light push walks, silently).
//   Right half of the screen: a stick that appears wherever your thumb lands (he asked): drag to aim, further to
//   look further ahead. FIRE buttons on both sides, so you can shoot with either thumb.
//   Small buttons along the right edge and top: aim in, crouch, use (hold), reload, swap, skill, gadget, melee,
//   vault, ping, drone/cameras, previous/next camera, scoreboard (hold) and pause.
// Played sideways only: held upright a "turn your phone sideways" sign covers the match.
const R = 62; // stick radius in CSS px
const SPRINT_PUSH = 1.45; // the move thumb this far out (stick radii) sprints

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
export const isTouch = (chosen || (sniffed === 'touch' ? 'touch' : 'desk')) === 'touch';
// Laptop trackpad (he asked, for a friend who may only have a trackpad or a phone): keyboard and mouse rules, plus a
// shoot key, aiming in as a toggle and aim help (main.js `assistOn`)
export const isTrackpad = !isTouch && chosen === 'trackpad';
export const needsInputChoice = !chosen && sniffed === 'ask'; // touch screen AND a mouse: ask on the title screen
export function setInputChoice(c) { store('r62d-input', c); location.reload(); }
// Settings that phones especially need (he asked: adjustable): how big the menus and match text are (1 = fit the
// screen), and how much of the map you see (bigger = further zoomed out). Kept on this device.
export const uiScale = () => Math.max(0.7, Math.min(1.6, +(store('r62d-uiscale') || 1)));
export const viewMul = () => Math.max(0.8, Math.min(2, +(store('r62d-view') || 1))); // (phones the same as a computer: he asked 2026-11-16; they used to start at 1.35, further out)
export function setUiScale(v) { store('r62d-uiscale', String(v)); fitUi(); }
export function setViewMul(v) { store('r62d-view', String(v)); }

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
// has to aim (phone shooters offer the same). On by default on phones; Settings turns it off.
export const autoFire = () => store('r62d-autofire') !== '0';
export const setAutoFire = on => store('r62d-autofire', on ? '1' : '0');
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
  { id: 'use', label: 'USE', b: 0, cls: 'ctx c-use hidden' }, { id: 'vault', label: 'VAULT', b: 10, cls: 'ctx c-vault hidden' },
  // AIM (he asked 2026-11-17): a small button on the bottom right of each FIRE, a tap on / tap off switch (both light up
  // together); the old AIM by the left thumb is gone. Sizes and places follow how often each is pressed (style.css,
  // "phone layout by priority"): FIRE and AIM biggest, then crouch / reload / swap round the right FIRE, then skill,
  // gadget, melee, ping, then the top row
  { id: 'ads', label: 'AIM', b: 'lt', cls: 'aim aimR' }, { id: 'adsL', label: 'AIM', b: 'lt', cls: 'aim aimL' }, { id: 'crouch', label: 'CROUCH', b: 1, cls: 'r rc' },
  { id: 'reload', label: 'RELOAD', b: 2, cls: 'r r1 c1' }, { id: 'swap', label: 'SWAP', b: 3, cls: 'r r1 c2' },
  { id: 'skill', label: 'SKILL', b: 5, cls: 'r r2 c1' }, { id: 'gadget', label: 'GADGET', b: 4, cls: 'r r2 c2' },
  { id: 'melee', label: 'MELEE', b: 11, cls: 'r r3 c1' }, { id: 'ping', label: 'PING', b: 12, cls: 'r r3 c2' },
  { id: 'view', label: 'DRONE / CAMS', b: 13, cls: 't t1' }, { id: 'prev', label: '◀', b: 14, cls: 't t2 hidden' }, { id: 'next', label: '▶', b: 15, cls: 't t3 hidden' },
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
  ping: svg('<path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>'),
  use: svg('<path d="M9 12V5a1.5 1.5 0 0 1 3 0v6M12 10V4a1.5 1.5 0 0 1 3 0v7M15 10a1.5 1.5 0 0 1 3 0v4c0 4-3 7-6 7h-1c-3 0-4.5-2-5.5-4.5L4 13a1.5 1.5 0 0 1 2.6-1.4L9 15"/>'),
  vault: svg('<path d="M3 21h18M9 21v-5h6v5"/><path d="M4 14c2-8 14-8 16 0"/><path d="M17 11l3 3 2-4"/>'),
  map: svg('<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>'),
  view: svg('<rect x="3" y="7" width="12" height="10" rx="2"/><path d="M15 11l6-3v8l-6-3z"/>'),
  score: svg('<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/>'),
  pause: svg('<path d="M8 5v14M16 5v14" stroke-width="3"/>'),
  prev: svg('<path d="M15 5l-7 7 7 7" stroke-width="2.6"/>'), next: svg('<path d="M9 5l7 7-7 7" stroke-width="2.6"/>'),
  tiltc: svg('<path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4v5h5"/>'),
  help: '<b>?</b>',
};
const HELP = [
  ['fire', 'FIRE', 'Shoot. Drag the right one to aim while you shoot.'], ['ads', 'AIM', 'The small button on each FIRE: tap to aim in, tap again to aim out.'],
  ['crouch', 'CROUCH', 'Tap to crouch. Hold to lie down. While sprinting: a slide.'], ['leanL', 'LEAN', 'Lean left or right round a corner: tap on, tap off.'],
  ['reload', 'RELOAD', 'Reload your gun.'], ['swap', 'SWAP', 'Switch between your guns.'],
  ['skill', 'SKILL', 'Your operator\'s ability. The number is how many are left.'], ['gadget', 'GADGET', 'Throw or place your gadget.'],
  ['melee', 'MELEE', 'Knife hit. Breaks wooden boards.'], ['ping', 'PING', 'Mark what you aim at for your team.'],
  ['use', 'USE', 'Open, plant, defuse, reinforce, revive. One tap keeps it going.'], ['vault', 'VAULT', 'Climb over, through windows, onto or off ropes.'],
  ['view', 'DRONE / CAMS', 'Your drones (attack) or cameras (defence).'], ['sprint', 'SPRINT', 'On a drone the crouch button sprints.'],
  ['map', 'MAP', 'The map: tap it to ping a spot.'], ['score', 'SCORES', 'Who is up and who is down.'],
  ['prev', 'PREVIOUS / NEXT', 'Flip through cameras and drones.'], ['pause', 'PAUSE', 'The pause menu.'],
  ['tiltc', 'LEVEL', 'Tilt to move: how you hold the phone now is level.'],
];
const N = 23;
const held = new Array(N).fill(false), trig = { lt: 0, rt: 0 }, tc = { lt: 0, rt: 0 }; // tc: fingers on each trigger button
let prevHeld = new Array(N).fill(false);
const ls = { x: 0, y: 0 }, rs = { x: 0, y: 0 };
let releaseAll = () => {}, fireAim = false, sprintLock = false, adsLatch = false, adsEl = null;
// USE (same day: planting meant holding USE with the aiming thumb for 7 s, unable to look round): a tap starts it and it
// keeps going (plant, defuse, reinforce, revive...) until it is done, you tap again or you move with the stick
let useLatch = false, useEl = null, useLostT = 0;
const setUse = on => { useLatch = on; held[0] = on; if (useEl) useEl.classList.toggle('on', on); };
const setAds = on => { adsLatch = on; trig.lt = on ? 1 : 0; if (ui) for (const el of ui.querySelectorAll('.tbtn.aim')) el.classList.toggle('on', on); }; // AIM: tap on, tap off // sprintLock: the move stick pushed past its ring (sprint until you ease off or let go) // the right stick's value comes from dragging FIRE: it turns you but keeps how far ahead you look
let ui = null, shown = false, recentre = () => {};
export const touchAimReset = () => recentre();

function stickOf(v) { const l = Math.min(1, Math.hypot(v.x, v.y)); return l < 0.08 ? { x: 0, y: 0, l: 0 } : { x: v.x / Math.max(l, 1e-6) * l, y: v.y / Math.max(l, 1e-6) * l, l }; }

// what pollPad reads each frame, in the same shape as gamepad.js readPad()
export function touchPad() {
  if (!isTouch || !shown) return null;
  const pressed = held.map((v, i) => v && !prevHeld[i]), released = prevHeld.map((v, i) => v && !held[i]);
  prevHeld = held.slice();
  const L = (ls.x || ls.y || !tiltOn()) ? ls : tiltV; // a thumb on the stick wins over tilting
  const gyro = gyroAcc; gyroAcc = 0;
  const r0 = stickOf(rs), rc = r0.l ? Math.pow(r0.l, 1.35) / r0.l : 0; // finer control near the middle of the aim stick
  return { name: 'Touch screen', ls: stickOf(L), rs: { x: r0.x * rc, y: r0.y * rc, l: r0.l * rc }, rsDir: fireAim, rsHeld: rs.x !== 0 || rs.y !== 0, sprint: sprintLock && L === ls, lt: trig.lt, rt: trig.rt, held: held.slice(), pressed, released, gyro };
}
export const touchActive = () => isTouch && shown;

function build() {
  ui = document.createElement('div'); ui.id = 'touchUI'; ui.className = 'hidden';
  ui.innerHTML = `<div class="tzone" id="tzRight"></div><div class="tzone" id="tzLeft"></div>
    <div class="tstick" id="tsLeft"><i></i></div><div class="tstick dyn hidden" id="tsRight"><i></i></div>
    ${BUTTONS.map(b => `<button class="tbtn ico ${b.cls}" data-id="${b.id}" data-label="${b.label}" aria-label="${b.label}">${ICONS[b.id] || (b.id.startsWith('fire') ? ICONS.fire : b.id === 'adsL' ? ICONS.ads : b.label)}</button>`).join('')}
    <div id="tHelp" class="hidden"><h3>WHAT THE BUTTONS DO</h3><div class="thGrid">${HELP.map(([i, n, d]) => `<div><span class="thI">${ICONS[i]}</span><b>${n}</b><small>${d}</small></div>`).join('')}</div><p>Left side: the move stick (push past its ring to sprint). Right side: drag anywhere to aim. Tap to close.</p></div>
    <div id="tTurn" class="hidden"><b>⟳</b>Turn your phone sideways to play</div>`;
  document.body.appendChild(ui);
  const base = ui.querySelector('#tsLeft'), dyn = ui.querySelector('#tsRight');
  const knob = (el, v) => { el.querySelector('i').style.transform = `translate(${v.x * R}px, ${v.y * R}px)`; };
  const tz = () => +getComputedStyle(document.documentElement).getPropertyValue('--tz') || 1;
  // Every finger is followed on its own (he found two thumbs at once didn't work: when both land together the browser
  // only reports one of them as a pointer). Touch events list each finger, and we look up what is under it ourselves.
  const fingers = new Map(); // finger → { move(x, y), end() }
  let leftF = null, aimF = null, ox = 0, oy = 0, tx = 0, ty = 0;
  // aiming in re-centres the right stick under the thumb, so dragging from there moves the crosshair out from close in
  recentre = () => { if (aimF === null) return; ox = tx; oy = ty; dyn.style.left = `${ox - R}px`; dyn.style.top = `${oy - R}px`; rs.x = rs.y = 0; knob(dyn, rs); };
  const grab = (id, x, y) => {
    if (fingers.has(id)) return; // the same finger can be announced twice
    const under = document.elementFromPoint(x, y), btn = under && under.closest && under.closest('#touchUI .tbtn');
    if (under && under.closest && under.closest('#tHelp')) { ui.querySelector('#tHelp').classList.add('hidden'); return; } // a tap closes the guide
    if (btn && !btn.classList.contains('hidden')) return pressButton(id, btn, x, y);
    // a page button under the touch zones (free play's OPERATORS · GUNS · BOTS, the drone / camera bar): the zones take
    // every touch, so the button never heard the tap (he couldn't switch operator in free play on a phone)
    const pb = !btn && document.elementsFromPoint(x, y).map(e => e.closest && e.closest('#freeHint button, #cambar button, #kcBtn')).find(Boolean);
    if (pb) { pb.click(); return; }
    if (x >= innerWidth / 2) { // right half: the aim stick appears under the thumb
      if (aimF !== null) return;
      aimF = id; ox = tx = x; oy = ty = y;
      dyn.style.left = `${ox - R}px`; dyn.style.top = `${oy - R}px`; dyn.classList.remove('hidden'); rs.x = rs.y = 0; knob(dyn, rs);
      fingers.set(id, {
        move(x, y) {
          const Ra = R / stickSens(); // (lower sensitivity: a longer reach for the thumb)
          tx = x; ty = y; let u = (x - ox) / Ra, v = (y - oy) / Ra; const l = Math.hypot(u, v);
          if (l > 1) { ox += (u / l) * (l - 1) * Ra; oy += (v / l) * (l - 1) * Ra; u /= l; v /= l; dyn.style.left = `${ox - R}px`; dyn.style.top = `${oy - R}px`; } // the stick follows a thumb that slides past its edge
          rs.x = u; rs.y = v; knob(dyn, rs);
        },
        end() { aimF = null; rs.x = rs.y = 0; dyn.classList.add('hidden'); },
      });
    } else if (y > innerHeight * 0.3) { // lower left: the move stick jumps to wherever the thumb lands
      if (leftF !== null) return;
      leftF = id; const z = tz(), r = R * z, cx = x, cy = y;
      base.style.left = `${cx / z - 62}px`; base.style.top = `${cy / z - 62}px`; base.style.bottom = 'auto'; base.classList.add('held');
      const move = (x, y) => { let u = (x - cx) / r, v = (y - cy) / r; const l = Math.hypot(u, v); if (l > 0.4 && useLatch) setUse(false); if (l >= SPRINT_PUSH) { if (!sprintLock) setAds(false); sprintLock = true; } else if (l < 0.6) sprintLock = false; base.classList.toggle('spr', sprintLock); if (l > 1) { u /= l; v /= l; } ls.x = u; ls.y = v; knob(base, ls); }; // push past the ring to sprint (like phone shooters)
      move(x, y);
      fingers.set(id, { move, end() { leftF = null; sprintLock = false; base.classList.remove('spr'); ls.x = ls.y = 0; knob(base, ls); base.style.left = base.style.top = base.style.bottom = ''; base.classList.remove('held'); } });
    }
  };
  // buttons: held while the finger that pressed them is down (wherever it slides)
  const pressButton = (id, el, x0, y0) => {
    const b = BUTTONS.find(q => q.id === el.dataset.id);
    if (b.id === 'ads' || b.id === 'adsL') { setAds(!adsLatch); return; } // a tap switches aiming in on or off (either AIM)
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
        if (!dragAim && l * R < 10) return; // a small wobble while tapping doesn't turn you
        dragAim = fireAim = true; if (l > 1) { fx += (u / l) * (l - 1) * R; fy += (v / l) * (l - 1) * R; u /= l; v /= l; }
        rs.x = u; rs.y = v;
      },
      end() { set(false); if (dragAim && aimF === null) rs.x = rs.y = 0; if (dragAim) fireAim = false; },
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
const ctxSeen = { use: 0, vault: 0, prev: 0, next: 0 };
export function touchContext(c) {
  if (!ui || !shown) return;
  const now = performance.now();
  if (useLatch && !c.use && !c.busy) { if (!useLostT) useLostT = now; else if (now - useLostT > 600) setUse(false); } else useLostT = 0; // nothing left to use: let go
  for (const id in ctxSeen) {
    if (id === 'prev' || id === 'next' ? c.cams : c[id]) ctxSeen[id] = now;
    const el = ui.querySelector(`[data-id="${id}"]`), want = now - ctxSeen[id] < 400 || el.classList.contains('on');
    if (el.classList.contains('hidden') === want) el.classList.toggle('hidden', !want);
  }
  for (const [id, d] of [['leanL', -1], ['leanR', 1]]) { const el = ui.querySelector(`[data-id="${id}"]`); el.classList.toggle('hidden', !c.body); el.classList.toggle('act', c.lean === d); } // lean: only on your own body; lit while leaning that way
  const cr = ui.querySelector('[data-id="crouch"]'), cl = c.drone ? 'sprint' : 'crouch'; // on a drone the crouch button sprints
  if (cr.dataset.ic !== cl) { cr.dataset.ic = cl; cr.innerHTML = ICONS[cl]; cr.setAttribute('aria-label', cl.toUpperCase()); }
  for (const [id, n] of [['skill', c.badge.skill], ['gadget', c.badge.gadget], ['view', c.badge.view]]) { // how many are left, on the button itself
    const el = ui.querySelector(`[data-id="${id}"]`), h = (ICONS[id] || el.dataset.label) + (n ? `<em>${n}</em>` : '');
    if (el.innerHTML !== h) { el.innerHTML = h; el.classList.toggle('out', n === '0' || n === '0%'); }
  }
}

// main.js calls this every frame: show the controls only while playing (not in menus)
export function setTouchVisible(on) {
  if (!isTouch) return;
  if (!ui) build();
  const upright = innerHeight > innerWidth;
  ui.querySelector('#tTurn').classList.toggle('hidden', !(on && upright));
  if (on === shown) return;
  if (on) { tiltLevel = null; ui.querySelector('[data-id="tiltc"]').classList.toggle('hidden', !tiltOn()); } // a match starts level
  shown = on; ui.classList.toggle('hidden', !on); document.documentElement.classList.toggle('touchplay', on); keepAwake(on);
  if (!on) { releaseAll(); setAds(false); setUse(false); sprintLock = false; ls.x = ls.y = rs.x = rs.y = 0; held.fill(false); trig.lt = trig.rt = tc.lt = tc.rt = 0; for (const el of ui.querySelectorAll('.tbtn.on')) el.classList.remove('on'); ui.querySelector('#tsRight').classList.add('hidden'); }
}
// Menus and match text shrink to fit small screens (the game picture itself always fills the screen), times the
// player's own size setting. Menus are laid out for ~900 px tall, the match text for ~760 (and both for the width).
function fitUi() {
  const h = Math.min(innerHeight, innerWidth > innerHeight ? innerHeight : innerWidth * 0.6), w = innerWidth, s = uiScale();
  // phones lay menus out for ~640 tall (they scroll) and match text for ~520, so text stays readable (he found it too small)
  const fit = isTouch ? Math.min(1, h / 640, w / 1150) : Math.min(1, h / 900, w / 1500);
  const hud = isTouch ? Math.min(1, h / 520, w / 1000) : Math.min(1, h / 760, w / 1300);
  const room = isTouch ? Math.min(h / 640, w / 1150) : Math.min(h / 900, w / 1500); // bigger than this and menus spill off the screen
  document.documentElement.style.setProperty('--uiz', Math.max(0.3, Math.min(fit * s, Math.max(fit, room))).toFixed(3));
  document.documentElement.style.setProperty('--hudz', Math.max(0.4, Math.min(1.4, hud * s)).toFixed(3));
  document.documentElement.style.setProperty('--tz', Math.max(0.7, Math.min(1.15, h / 430)).toFixed(3)); // touch buttons: smaller on short screens
  document.documentElement.classList.toggle('fitui', isTouch || fit < 1 || s !== 1);
}
if (isTouch) document.documentElement.classList.add('touch');
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
