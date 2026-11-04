import { isTouch } from './touch.js';
// Key bindings: each action has a main and an alternate key, saved in the browser.
export const ACTIONS = [
  ['up', 'Move forward', 'KeyW', 'ArrowUp'],
  ['down', 'Move back', 'KeyS', 'ArrowDown'],
  ['left', 'Move left', 'KeyA', 'ArrowLeft'],
  ['right', 'Move right', 'KeyD', 'ArrowRight'],
  ['sprint', 'Sprint — with Move forward: runs where you aim. Very loud, gun down (hold)', 'AltLeft', ''],
  ['walk', 'Walk — silent (hold)', 'ShiftLeft', ''],
  ['crouch', 'Crouch — silent, most accurate (hold). While sprinting: power slide', 'ControlLeft', ''],
  ['crouchTap', 'Crouch on / off (one tap). While sprinting: power slide', '', ''],
  ['prone', 'Lie down / get up — sees under tables and cars', 'KeyC', ''],
  ['interact', 'Use — reinforce, barricade, plant, defuse, revive (hold)', 'KeyF', ''],
  ['leanL', 'Lean left (hold) — on drones / cameras: previous feed', 'KeyQ', ''],
  ['leanR', 'Lean right (hold) — on drones / cameras: next feed', 'KeyE', ''],
  ['reload', 'Reload', 'KeyR', ''],
  ['primary', 'Primary weapon', 'Digit1', ''],
  ['secondary', 'Secondary weapon', 'Digit2', ''],
  ['gadget', 'Gadget / grenade', 'KeyG', ''],
  ['ability', 'Operator skill', 'Digit4', 'KeyZ'],
  ['view', 'Team drones & cameras (look only at teammates\' drones)', 'Digit5', ''],
  ['drone', 'Put out your drone / drive it (attack)', 'Digit6', ''],
  ['melee', 'Melee (knife)', 'Digit3', 'KeyV'],
  ['vault', 'Jump (onto furniture) — vaults windows and wall stubs', 'Space', ''],
  ['spot', 'Ping what is under your aim (enemy, gadget, wall, door, place)', 'KeyT', ''],
  ['chat', 'Chat (opens team chat; / switches team ⇄ all)', 'KeyY', 'Enter'],
  ['ptt', 'Push to talk to the bots (hold)', 'KeyX', ''],
  ['scoreboard', 'Scoreboard (hold)', 'Tab', ''],
  ['opNext', 'Free play: next operator', 'KeyN', ''],
  ['opPrev', 'Free play: previous operator', 'KeyB', ''],
  ['opGrid', 'Free play: choose any operator', 'KeyO', ''],
  ['settings', 'Settings', 'F1', ''],
  ['pause', 'Pause menu', 'Escape', 'KeyP'],
];

const KEY = 'r62d-keys-v5'; // v4 = lean on Q/E, use on F, skill on 4, gadget on G, Space jumps; v5 = push to talk on X (he asked)
export const BINDS_VERSION = 5;
let binds = {};
// C used to be a second crouch key; it is now lie down (he asked), so older saved keys give it up
function freeC() { if (binds.crouch[1] === 'KeyC' && binds.prone[0] === 'KeyC') binds.crouch[1] = ''; }
// Sprint is new: saved keys that already use Alt (walk, on most layouts) get it on Shift if that is free, else no key until one is chosen
function sprintFree() { const used = c => Object.keys(binds).some(k => k !== 'sprint' && binds[k].includes(c)); if (binds.sprint[0] === 'AltLeft' && used('AltLeft')) binds.sprint[0] = used('ShiftLeft') ? '' : 'ShiftLeft'; }
export function loadBinds() {
  binds = {};
  for (const [id, , a, b] of ACTIONS) binds[id] = [a, b];
  try { const saved = JSON.parse(localStorage.getItem(KEY) || '{}'); for (const id in saved) if (binds[id]) binds[id] = saved[id]; } catch {}
  freeC(); sprintFree();
  return binds;
}
let onChange = null;
export function onBindsChange(fn) { onChange = fn; }
export function saveBinds() { try { localStorage.setItem(KEY, JSON.stringify(binds)); } catch {} if (onChange) onChange(binds); }
export const getBinds = () => JSON.parse(JSON.stringify(binds));
// load a profile's saved keys (unknown actions ignored, missing ones keep defaults)
// Saved keys from v4 keep everything except push to talk, which moves from H to X. If something else has X, or a layout took it, talk stays on H.
function pttFree() { if (binds.ptt[0] === 'KeyX' && Object.keys(binds).some(k => k !== 'ptt' && binds[k].includes('KeyX'))) binds.ptt[0] = Object.keys(binds).some(k => binds[k].includes('KeyH')) ? '' : 'KeyH'; }
export function applyBinds(saved, from = BINDS_VERSION) {
  if (from < 5 && saved && Array.isArray(saved.ptt) && saved.ptt[0] === 'KeyH') saved = { ...saved, ptt: ['KeyX', saved.ptt[1] || ''] };
  loadBinds();
  if (saved && typeof saved === 'object') for (const id in saved) if (binds[id] && Array.isArray(saved[id])) binds[id] = saved[id].slice(0, 2).map(c => (typeof c === 'string' ? c.slice(0, 24) : ''));
  freeC(); pttFree(); sprintFree();
  try { localStorage.setItem(KEY, JSON.stringify(binds)); } catch {}
}
export function resetBinds() { try { localStorage.removeItem(KEY); } catch {} loadBinds(); if (onChange) onChange(binds); }
// Layouts from other games (he asked, and chose the games): only what differs from ours. Actions a game lacks (leaning, walking) go on free keys.
export const PRESETS = [
  ['cs2', 'Counter-Strike 2', { interact: ['KeyE', ''], ability: ['KeyQ', 'KeyZ'], gadget: ['Digit4', 'KeyG'], leanL: ['KeyX', ''], leanR: ['KeyC', ''], prone: ['KeyB', ''], opPrev: ['', ''], spot: ['KeyT', ''], melee: ['Digit3', ''] }],
  ['r6', 'Rainbow Six Siege', { crouch: ['', ''], crouchTap: ['KeyC', ''], prone: ['ControlLeft', ''], sprint: ['ShiftLeft', ''], walk: ['AltLeft', ''], interact: ['KeyF', ''], gadget: ['Digit3', 'KeyG'], ability: ['Digit4', ''], view: ['Digit5', ''], drone: ['Digit6', ''], melee: ['KeyV', ''] }],
  ['cod', 'Call of Duty (modern)', { sprint: ['ShiftLeft', ''], crouch: ['KeyC', ''], prone: ['ControlLeft', ''], walk: ['AltLeft', ''], interact: ['KeyF', ''], gadget: ['KeyG', ''], ability: ['KeyX', 'Digit4'], leanL: ['KeyQ', ''], leanR: ['KeyE', ''], melee: ['KeyV', ''] }],
  ['mw2', 'Modern Warfare 2 (2009)', { sprint: ['ShiftLeft', ''], crouch: ['KeyC', ''], prone: ['ControlLeft', ''], walk: ['AltLeft', ''], interact: ['KeyF', ''], gadget: ['KeyG', ''], ability: ['KeyQ', 'Digit4'], leanL: ['KeyZ', ''], leanR: ['KeyE', ''], melee: ['KeyV', ''] }],
  ['halo', 'Halo', { sprint: ['ShiftLeft', ''], crouch: ['ControlLeft', ''], prone: ['KeyC', ''], walk: ['AltLeft', ''], interact: ['KeyE', ''], melee: ['KeyQ', 'KeyV'], gadget: ['KeyG', ''], ability: ['KeyF', ''], leanL: ['KeyZ', ''], leanR: ['KeyX', ''] }],
  ['swbf2', 'Star Wars Battlefront II (2017)', { sprint: ['ShiftLeft', ''], crouch: ['ControlLeft', ''], prone: ['KeyC', ''], walk: ['AltLeft', ''], interact: ['KeyF', ''], ability: ['KeyQ', ''], gadget: ['KeyE', 'KeyG'], leanL: ['KeyZ', ''], leanR: ['KeyX', ''], melee: ['KeyV', ''] }],
];
export function applyPreset(name) {
  const pr = PRESETS.find(p => p[0] === name); if (!pr) return;
  loadBinds(); for (const id in binds) binds[id] = ACTIONS.find(a => a[0] === id).slice(2, 4); // start from ours
  const over = pr[2], taken = new Set(Object.values(over).flat().filter(Boolean));
  for (const id in binds) if (!over[id]) binds[id] = binds[id].map(c => (taken.has(c) ? '' : c)); // a key the layout uses elsewhere
  for (const id in over) if (binds[id]) binds[id] = over[id].slice();
  if (!binds.ptt[0]) binds.ptt[0] = 'KeyX'; pttFree();
  saveBinds();
}
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
const TOUCH_NAMES = { interact: 'USE', vault: 'VAULT', melee: 'MELEE', ability: 'SKILL', gadget: 'GADGET', reload: 'RELOAD', spot: 'PING', crouch: 'CROUCH', ads: 'AIM', walk: 'a light push', view: 'DRONE / CAMS', drone: 'DRONE / CAMS', scoreboard: 'SCORES' };
export const label = id => (isTouch && TOUCH_NAMES[id]) || keyName((binds[id] || [])[0]);
loadBinds();
// Capture the mouse for aiming, asking for raw movement where the browser allows it (no system mouse acceleration,
// which swallowed slow, careful moves: he noticed the crosshair didn't move at all when moving the mouse slowly).
export function lockMouse(el) {
  try { const r = el.requestPointerLock?.({ unadjustedMovement: true }); if (r && r.catch) r.catch(() => el.requestPointerLock?.()); }
  catch { el.requestPointerLock?.(); }
}
