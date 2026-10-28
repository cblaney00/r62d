// Key bindings: each action has a main and an alternate key, saved in the browser.
export const ACTIONS = [
  ['up', 'Move forward', 'KeyW', 'ArrowUp'],
  ['down', 'Move back', 'KeyS', 'ArrowDown'],
  ['left', 'Move left', 'KeyA', 'ArrowLeft'],
  ['right', 'Move right', 'KeyD', 'ArrowRight'],
  ['walk', 'Walk — silent (hold)', 'ShiftLeft', ''],
  ['crouch', 'Crouch — silent, most accurate (hold)', 'ControlLeft', 'KeyC'],
  ['interact', 'Use — reinforce, barricade, plant, defuse, revive (hold)', 'KeyE', 'KeyF'],
  ['reload', 'Reload', 'KeyR', ''],
  ['primary', 'Primary weapon', 'Digit1', ''],
  ['secondary', 'Secondary weapon', 'Digit2', ''],
  ['gadget', 'Gadget / grenade', 'Digit4', 'KeyG'],
  ['ability', 'Operator skill', 'KeyQ', 'KeyZ'],
  ['view', 'Drone / Cameras', 'Digit5', ''],
  ['melee', 'Melee (knife)', 'Digit3', 'KeyV'],
  ['spot', 'Ping what is under your aim (enemy, gadget, wall, door, place)', 'KeyT', ''],
  ['chat', 'Chat (opens team chat; / switches team ⇄ all)', 'KeyY', 'Enter'],
  ['scoreboard', 'Scoreboard (hold)', 'Tab', ''],
  ['settings', 'Settings', 'KeyO', 'F1'],
  ['pause', 'Pause menu', 'Escape', 'KeyP'],
];

const KEY = 'r62d-keys-v3'; // v3 = CS2-style defaults
export const BINDS_VERSION = 3;
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
export const label = id => keyName((binds[id] || [])[0]);
loadBinds();
