// Xbox controller (or any controller the browser lists as "standard"), read every frame.
//   R6-style Xbox layout (XBOX_ACTIONS, PAD_HELP): RT shoot · LT aim · L3 sprint · R3 melee · LT + L3 / R3 lean ·
//   A jump / vault · B crouch (hold: lie down) · X reload (hold: use) · Y swap · LB gadget · RB skill ·
//   D-pad up ping · down cameras · left map · right put out a drone (on cameras: previous / next) · View scoreboard · Menu pause
const DZ = 0.1; // only enough to ignore a worn stick resting off-centre; past it the push is rescaled from 0, so nothing jumps
export const PAD_HELP = [ // a real controller (he asked 2026-11-18: everything doable, laid out like Rainbow Six's Xbox controls)
  ['Move (light push = walk, silent)', 'Left stick'], ['Aim (push further = look further ahead)', 'Right stick'],
  ['Shoot', 'RT'], ['Aim down sights', 'LT'], ['Sprint (on until you stop)', 'Click left stick'], ['Melee', 'Click right stick'],
  ['Lean left / right', 'While aiming in (LT): click left / right stick'], ['Jump, vault, climb in', 'A'], ['Crouch on / off · hold: lie down', 'B'],
  ['Reload · hold: use (reinforce, plant, defuse, revive)', 'X'], ['Swap weapon', 'Y'], ['Gadget', 'LB'], ['Operator skill', 'RB'],
  ['Ping', 'D-pad up'], ['Team cameras & drones', 'D-pad down'], ['Map · on cameras: previous', 'D-pad left'], ['Put out a drone · on cameras: next', 'D-pad right'],
  ['Scoreboard (hold)', 'View'], ['Pause', 'Menu'],
];
// a real Xbox-style controller (the phone's buttons keep PAD_ACTIONS): R6's layout. 2 (X) is reload on a tap and use
// when held; 10 / 11 (stick clicks) are sprint / melee, or lean left / right while aiming in; 14 / 15 depend on the view
export const XBOX_ACTIONS = { 0: 'vault', 1: 'crouch', 2: 'reloadUse', 3: 'swap', 4: 'gadget', 5: 'ability', 8: 'scoreboard', 9: 'pause', 10: 'l3', 11: 'r3', 12: 'spot', 13: 'droneOrCams', 14: 'dleft', 15: 'dright' };
// standard-layout button number → what it does (main.js turns these into game actions)
export const PAD_ACTIONS = { 0: 'interact', 10: 'vault', 1: 'crouch', 2: 'reload', 3: 'swap', 4: 'gadget', 5: 'ability', 8: 'scoreboard', 9: 'pause', 11: 'melee', 12: 'spot', 13: 'droneOrCams', 14: 'camPrev', 15: 'camNext', 20: 'leanL', 21: 'leanR', 22: 'map', 23: 'drone', 24: 'view' }; // 20-24: phone-only buttons (touch.js; he asked 2026-11-18: DRONE puts out yours, CAMS looks through the team's, apart; a controller keeps 13 for both)

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
