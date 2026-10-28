// Key bindings: each action has a main and an alternate key, saved in the browser.
export const ACTIONS = [
  ['up', 'Move forward', 'KeyW', 'ArrowUp'],
  ['down', 'Move back', 'KeyS', 'ArrowDown'],
  ['left', 'Move left', 'KeyA', 'ArrowLeft'],
  ['right', 'Move right', 'KeyD', 'ArrowRight'],
  ['sprint', 'Sprint (hold)', 'ShiftLeft', ''],
  ['walk', 'Slow walk — silent (hold)', 'AltLeft', 'KeyX'],
  ['crouch', 'Crouch (toggle)', 'KeyC', ''],
  ['interact', 'Interact — reinforce, barricade, plant, defuse, revive (hold)', 'KeyF', 'KeyE'],
  ['reload', 'Reload', 'KeyR', ''],
  ['primary', 'Primary weapon', 'Digit1', ''],
  ['secondary', 'Secondary weapon', 'Digit2', ''],
  ['gadget', 'Secondary gadget', 'Digit3', 'KeyG'],
  ['ability', 'Operator skill', 'Digit4', 'KeyZ'],
  ['view', 'Drone / Cameras', 'Digit5', ''],
  ['melee', 'Melee', 'KeyV', ''],
  ['spot', 'Mark enemy under cursor', 'KeyT', ''],
  ['scoreboard', 'Scoreboard (hold)', 'Tab', ''],
  ['settings', 'Settings', 'KeyO', 'F1'],
];

const KEY = 'r62d-keys-v2';
let binds = {};
export function loadBinds() {
  binds = {};
  for (const [id, , a, b] of ACTIONS) binds[id] = [a, b];
  try { const saved = JSON.parse(localStorage.getItem(KEY) || '{}'); for (const id in saved) if (binds[id]) binds[id] = saved[id]; } catch {}
  return binds;
}
export function saveBinds() { try { localStorage.setItem(KEY, JSON.stringify(binds)); } catch {} }
export function resetBinds() { try { localStorage.removeItem(KEY); } catch {} loadBinds(); }
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
