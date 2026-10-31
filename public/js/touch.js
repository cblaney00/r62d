// Phone / tablet controls (he asked: a UI that pops up by itself on mobile). The touches act like a game controller
// (main.js pollPad reads touchPad() when no real controller is plugged in), so every rule stays the same.
//   Left thumb: a fixed stick to move (a light push walks, silently).
//   Right half of the screen: a stick that appears wherever your thumb lands (he asked): drag to aim, further to
//   look further ahead. FIRE buttons on both sides, so you can shoot with either thumb.
//   Small buttons along the right edge and top: aim in, crouch, use (hold), reload, swap, skill, gadget, melee,
//   vault, ping, drone/cameras, previous/next camera, scoreboard (hold) and pause.
// Played sideways only: held upright a "turn your phone sideways" sign covers the match.
const R = 62; // stick radius in CSS px

export const isTouch = (() => {
  try {
    if (/[?&]touch=1/.test(location.search)) return true;
    if (/[?&]touch=0/.test(location.search)) return false;
    return matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches || (navigator.maxTouchPoints > 0 && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent));
  } catch { return false; }
})();

// button → the controller button number main.js already understands (PAD_ACTIONS in gamepad.js); 'lt' / 'rt' are the triggers
const BUTTONS = [
  { id: 'fireL', label: 'FIRE', b: 'rt', cls: 'fire left' }, { id: 'fireR', label: 'FIRE', b: 'rt', cls: 'fire right' },
  { id: 'ads', label: 'AIM', b: 'lt', cls: 'r r1 c1' }, { id: 'crouch', label: 'CROUCH', b: 1, cls: 'r r1 c2' },
  { id: 'reload', label: 'RELOAD', b: 2, cls: 'r r2 c1' }, { id: 'swap', label: 'SWAP', b: 3, cls: 'r r2 c2' },
  { id: 'use', label: 'USE', b: 0, cls: 'r r3 c1' }, { id: 'vault', label: 'VAULT', b: 10, cls: 'r r3 c2' },
  { id: 'skill', label: 'SKILL', b: 5, cls: 'r r4 c1' }, { id: 'gadget', label: 'GADGET', b: 4, cls: 'r r4 c2' },
  { id: 'melee', label: 'MELEE', b: 11, cls: 'r r5 c1' }, { id: 'ping', label: 'PING', b: 12, cls: 'r r5 c2' },
  { id: 'view', label: 'DRONE / CAMS', b: 13, cls: 't t1' }, { id: 'prev', label: '◀', b: 14, cls: 't t2' }, { id: 'next', label: '▶', b: 15, cls: 't t3' },
  { id: 'score', label: 'SCORES', b: 8, cls: 't t4' }, { id: 'pause', label: '❚❚', b: 9, cls: 't t5' },
];
const N = 16;
const held = new Array(N).fill(false), trig = { lt: 0, rt: 0 }, tc = { lt: 0, rt: 0 }; // tc: fingers on each trigger button
let prevHeld = new Array(N).fill(false);
const ls = { x: 0, y: 0 }, rs = { x: 0, y: 0 };
let ui = null, shown = false, recentre = () => {};
export const touchAimReset = () => recentre();

function stickOf(v) { const l = Math.min(1, Math.hypot(v.x, v.y)); return l < 0.08 ? { x: 0, y: 0, l: 0 } : { x: v.x / Math.max(l, 1e-6) * l, y: v.y / Math.max(l, 1e-6) * l, l }; }

// what pollPad reads each frame, in the same shape as gamepad.js readPad()
export function touchPad() {
  if (!isTouch || !shown) return null;
  const pressed = held.map((v, i) => v && !prevHeld[i]), released = prevHeld.map((v, i) => v && !held[i]);
  prevHeld = held.slice();
  return { name: 'Touch screen', ls: stickOf(ls), rs: stickOf(rs), lt: trig.lt, rt: trig.rt, held: held.slice(), pressed, released };
}
export const touchActive = () => isTouch && shown;

function build() {
  ui = document.createElement('div'); ui.id = 'touchUI'; ui.className = 'hidden';
  ui.innerHTML = `<div class="tzone" id="tzRight"></div>
    <div class="tstick" id="tsLeft"><i></i></div><div class="tstick dyn hidden" id="tsRight"><i></i></div>
    ${BUTTONS.map(b => `<button class="tbtn ${b.cls}" data-id="${b.id}">${b.label}</button>`).join('')}
    <div id="tTurn" class="hidden"><b>⟳</b>Turn your phone sideways to play</div>`;
  document.body.appendChild(ui);
  const base = ui.querySelector('#tsLeft'), dyn = ui.querySelector('#tsRight'), zone = ui.querySelector('#tzRight');
  const knob = (el, v) => { el.querySelector('i').style.transform = `translate(${v.x * R}px, ${v.y * R}px)`; };
  // left stick: fixed in the bottom-left corner
  let lid = null;
  const lmove = e => { const r = base.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; let x = (e.clientX - cx) / R, y = (e.clientY - cy) / R; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } ls.x = x; ls.y = y; knob(base, ls); };
  base.addEventListener('pointerdown', e => { lid = e.pointerId; try { base.setPointerCapture(lid); } catch {} lmove(e); e.preventDefault(); });
  base.addEventListener('pointermove', e => { if (e.pointerId === lid) lmove(e); });
  const lup = e => { if (e.pointerId !== lid) return; lid = null; ls.x = ls.y = 0; knob(base, ls); };
  base.addEventListener('pointerup', lup); base.addEventListener('pointercancel', lup);
  // right half: a stick that appears where the thumb lands
  let rid = null, ox = 0, oy = 0, tx = 0, ty = 0;
  // aiming in re-centres the right stick under the thumb, so dragging from there moves the crosshair out from close in
  recentre = () => { if (rid === null) return; ox = tx; oy = ty; dyn.style.left = `${ox - R}px`; dyn.style.top = `${oy - R}px`; rs.x = rs.y = 0; knob(dyn, rs); };
  zone.addEventListener('pointerdown', e => {
    if (rid !== null) return;
    rid = e.pointerId; try { zone.setPointerCapture(rid); } catch {} ox = tx = e.clientX; oy = ty = e.clientY;
    dyn.style.left = `${ox - R}px`; dyn.style.top = `${oy - R}px`; dyn.classList.remove('hidden'); rs.x = rs.y = 0; knob(dyn, rs); e.preventDefault();
  });
  zone.addEventListener('pointermove', e => {
    if (e.pointerId !== rid) return;
    tx = e.clientX; ty = e.clientY;
    let x = (e.clientX - ox) / R, y = (e.clientY - oy) / R; const l = Math.hypot(x, y);
    if (l > 1) { ox += (x / l) * (l - 1) * R; oy += (y / l) * (l - 1) * R; x /= l; y /= l; dyn.style.left = `${ox - R}px`; dyn.style.top = `${oy - R}px`; } // the stick follows a thumb that slides past its edge
    rs.x = x; rs.y = y; knob(dyn, rs);
  });
  const rup = e => { if (e.pointerId !== rid) return; rid = null; rs.x = rs.y = 0; dyn.classList.add('hidden'); };
  zone.addEventListener('pointerup', rup); zone.addEventListener('pointercancel', rup);
  // buttons: held while a finger is on them
  for (const el of ui.querySelectorAll('.tbtn')) {
    const b = BUTTONS.find(x => x.id === el.dataset.id); let pid = null;
    const set = on => { el.classList.toggle('on', on); if (b.b === 'lt' || b.b === 'rt') { tc[b.b] = Math.max(0, tc[b.b] + (on ? 1 : -1)); trig[b.b] = tc[b.b] ? 1 : 0; } else held[b.b] = on; };
    el.addEventListener('pointerdown', e => { pid = e.pointerId; try { el.setPointerCapture(pid); } catch {} set(true); e.preventDefault(); });
    const up = e => { if (e.pointerId !== pid) return; pid = null; set(false); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('contextmenu', e => e.preventDefault());
  }
  // a first touch in a match goes full screen and holds the phone sideways where the browser allows it
  ui.addEventListener('pointerdown', () => {
    try { if (!document.fullscreenElement && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {}); } catch {}
  }, { capture: true });
}

// main.js calls this every frame: show the controls only while playing (not in menus)
export function setTouchVisible(on) {
  if (!isTouch) return;
  if (!ui) build();
  const upright = innerHeight > innerWidth;
  ui.querySelector('#tTurn').classList.toggle('hidden', !(on && upright));
  if (on === shown) return;
  shown = on; ui.classList.toggle('hidden', !on); document.documentElement.classList.toggle('touchplay', on);
  if (!on) { ls.x = ls.y = rs.x = rs.y = 0; held.fill(false); trig.lt = trig.rt = tc.lt = tc.rt = 0; for (const el of ui.querySelectorAll('.tbtn.on')) el.classList.remove('on'); ui.querySelector('#tsRight').classList.add('hidden'); }
}
if (isTouch) {
  document.documentElement.classList.add('touch');
  // small screens: menus and the match's text shrink to fit (the canvas itself already fills the screen)
  const fit = () => {
    const h = Math.min(innerHeight, innerWidth > innerHeight ? innerHeight : innerWidth * 0.6);
    document.documentElement.style.setProperty('--uiz', Math.max(0.45, Math.min(1, h / 820)).toFixed(3));
    document.documentElement.style.setProperty('--hudz', Math.max(0.6, Math.min(1, h / 700)).toFixed(3));
  };
  fit(); addEventListener('resize', fit);
}
