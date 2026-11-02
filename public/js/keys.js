import { isTouch } from './touch.js';
// Key bindings: each action has a main and an alternate key, saved in the browser.
export const ACTIONS = [
  ['up', 'Move forward', 'KeyW', 'ArrowUp'],
  ['down', 'Move back', 'KeyS', 'ArrowDown'],
  ['left', 'Move left', 'KeyA', 'ArrowLeft'],
  ['right', 'Move right', 'KeyD', 'ArrowRight'],
  ['walk', 'Walk — silent (hold)', 'ShiftLeft', ''],
  ['crouch', 'Crouch — silent, most accurate (hold)', 'ControlLeft', 'KeyC'],
  ['interact', 'Use — reinforce, barricade, plant, defuse, revive (hold)', 'KeyF', ''],
  ['leanL', 'Lean left (hold)', 'KeyQ', ''],
  ['leanR', 'Lean right (hold)', 'KeyE', ''],
  ['reload', 'Reload', 'KeyR', ''],
  ['primary', 'Primary weapon', 'Digit1', ''],
  ['secondary', 'Secondary weapon', 'Digit2', ''],
  ['gadget', 'Gadget / grenade', 'KeyG', ''],
  ['ability', 'Operator skill', 'Digit4', 'KeyZ'],
  ['view', 'Drone / Cameras', 'Digit5', ''],
  ['melee', 'Melee (knife)', 'Digit3', 'KeyV'],
  ['vault', 'Jump (onto furniture) — vaults windows and wall stubs', 'Space', ''],
  ['spot', 'Ping what is under your aim (enemy, gadget, wall, door, place)', 'KeyT', ''],
  ['chat', 'Chat (opens team chat; / switches team ⇄ all)', 'KeyY', 'Enter'],
  ['scoreboard', 'Scoreboard (hold)', 'Tab', ''],
  ['opNext', 'Free play: next operator', 'KeyN', ''],
  ['opPrev', 'Free play: previous operator', 'KeyB', ''],
  ['opGrid', 'Free play: choose any operator', 'KeyO', ''],
  ['settings', 'Settings', 'F1', ''],
  ['pause', 'Pause menu', 'Escape', 'KeyP'],
];

const KEY = 'r62d-keys-v4'; // v4 = lean on Q/E, use on F, skill on 4, gadget on G, Space jumps (he asked)
export const BINDS_VERSION = 4;
let binds = {};
export function loadBinds() {
  binds = {};
  for (const [id, , a, b] of ACTIONS) binds[id] = [a, b];
  try { const saved = JSON.parse(localStorage.getItem(KEY) || '{}'); for (const id in saved) if (binds[id]) binds[id] = saved[id]; } catch {}
  return binds;
}
let onChange = null;
export function onBindsChange(fn) { onChange = fn; }
export function saveBinds() { try { localStorage.setItem(KEY, JSON.stringify(binds)); } catch {} if (onChange) onChange(binds); }
export const getBinds = () => JSON.parse(JSON.stringify(binds));
// load a profile's saved keys (unknown actions ignored, missing ones keep defaults)
export function applyBinds(saved) {
  loadBinds();
  if (saved && typeof saved === 'object') for (const id in saved) if (binds[id] && Array.isArray(saved[id])) binds[id] = saved[id].slice(0, 2).map(c => (typeof c === 'string' ? c.slice(0, 24) : ''));
  try { localStorage.setItem(KEY, JSON.stringify(binds)); } catch {}
}
export function resetBinds() { try { localStorage.removeItem(KEY); } catch {} loadBinds(); if (onChange) onChange(binds); }
export function setBind(id, slot, code) {
  for (const k in binds) binds[k] = binds[k].map(c => (c === code ? '' : c)); // one key, one action
  binds[id][slot] = code; saveBinds();
}
export const bindsFor = id => binds[id] || [];
export function actionFor(code) { for (const k in binds) if (binds[k].includes(code)) return k; return null; }
export function keyName(code) {
  if (!code) return '—';
  if (code.startsWith('Arrow')) return { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' }[code];
  return code.replace(/^Key/, '').replace(/^Digit/, '').replace('Left', ' L').replace('Right', ' R')
    .replace('Arrow', '').replace('Control', 'Ctrl').replace('Bracket', ' Bracket');
}
// on a phone the prompts name the touch button instead of a key (touch.js buttons)
const TOUCH_NAMES = { interact: 'USE', vault: 'VAULT', melee: 'MELEE', ability: 'SKILL', gadget: 'GADGET', reload: 'RELOAD', spot: 'PING', crouch: 'CROUCH', ads: 'AIM', walk: 'a light push', view: 'DRONE / CAMS', scoreboard: 'SCORES' };
export const label = id => (isTouch && TOUCH_NAMES[id]) || keyName((binds[id] || [])[0]);
loadBinds();
// Capture the mouse for aiming, asking for raw movement where the browser allows it (no system mouse acceleration,
// which swallowed slow, careful moves: he noticed the crosshair didn't move at all when moving the mouse slowly).
export function lockMouse(el) {
  try { const r = el.requestPointerLock?.({ unadjustedMovement: true }); if (r && r.catch) r.catch(() => el.requestPointerLock?.()); }
  catch { el.requestPointerLock?.(); }
}
