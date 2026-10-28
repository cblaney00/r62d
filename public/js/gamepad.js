// Xbox controller (or any controller the browser lists as "standard"), read every frame.
//   Left stick   move (a light push walks silently)      Right stick  aim (direction + how far ahead)
//   RT shoot · LT aim down sights · A use (hold) · B crouch (on/off) · X reload · Y swap weapon
//   LB gadget · RB operator skill · R3 melee · D-pad up ping · D-pad down drone/cameras
//   D-pad left/right flip cameras · View scoreboard (hold) · Menu pause
const DZ = 0.1; // only enough to ignore a worn stick resting off-centre; past it the push is rescaled from 0, so nothing jumps
export const PAD_HELP = [
  ['Move (light push = walk, silent)', 'Left stick'], ['Aim (push further = look further ahead)', 'Right stick'],
  ['Shoot', 'RT'], ['Aim down sights', 'LT'], ['Use (hold)', 'A'], ['Crouch on / off', 'B'], ['Reload', 'X'], ['Swap weapon', 'Y'],
  ['Gadget', 'LB'], ['Operator skill', 'RB'], ['Melee', 'Click right stick'], ['Ping', 'D-pad up'], ['Drone / Cameras', 'D-pad down'],
  ['Previous / next camera', 'D-pad left / right'], ['Scoreboard (hold)', 'View'], ['Pause', 'Menu'],
];
// standard-layout button number → what it does (main.js turns these into game actions)
export const PAD_ACTIONS = { 0: 'interact', 1: 'crouch', 2: 'reload', 3: 'swap', 4: 'gadget', 5: 'ability', 8: 'scoreboard', 9: 'pause', 11: 'melee', 12: 'spot', 13: 'view', 14: 'camPrev', 15: 'camNext' };

function stick(x, y) {
  const l = Math.hypot(x, y);
  if (l < DZ) return { x: 0, y: 0, l: 0 };
  const m = Math.min(1, (l - DZ) / (1 - DZ));
  return { x: x / l * m, y: y / l * m, l: m };
}
let prev = [];
export function readPad() {
  let gp = null;
  try { for (const g of navigator.getGamepads ? navigator.getGamepads() : []) if (g && g.connected) { gp = g; break; } } catch {}
  if (!gp) { prev = []; return null; }
  const held = gp.buttons.map(b => !!b && (b.pressed || b.value > 0.5));
  const pressed = held.map((v, i) => v && !prev[i]), released = prev.map((v, i) => v && !held[i]);
  prev = held;
  const ax = i => gp.axes[i] || 0, tr = i => (gp.buttons[i] ? gp.buttons[i].value : 0);
  return { name: gp.id, ls: stick(ax(0), ax(1)), rs: stick(ax(2), ax(3)), lt: tr(6), rt: tr(7), held, pressed, released };
}
