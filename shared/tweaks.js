// Trying a change without editing the game (he asked 2026-11-20: the pros' suggestions are tested during balance patches).
// R62D_TWEAK = a JSON list of { path, to } (or { path, mul }), applied once when the server starts, e.g.
//   [{"path":"WEAPONS.mule.dmg","to":27},{"path":"OPERATORS.ferro.ability.cd","to":2.5},{"path":"DUR.bomb","mul":0.9}]
// Roots: OPERATORS, WEAPONS, PEN_GUN, DUR, LOADOUTS, ARMOR_HP (e.g. {"path":"LOADOUTS.ferro.primaries","to":["tusk","k4"]}). Worker threads and child processes share the environment, so practice and the
// tests' workers get it too. tests/protry.js uses it; nothing sets it in normal play.
import { OPERATORS, WEAPONS, PEN_GUN, LOADOUTS, ARMOR_HP } from './operators.js';
import { DUR } from './constants.js';

export const ROOTS = { OPERATORS, WEAPONS, PEN_GUN, DUR, LOADOUTS, ARMOR_HP };
export function applyTweak(list) {
  const done = [];
  for (const t of list || []) {
    const parts = String(t.path).split('.'), root = ROOTS[parts[0]]; if (!root) throw new Error('tweak: unknown root ' + parts[0]);
    let o = root; for (const k of parts.slice(1, -1)) { o = o[k]; if (o === undefined) throw new Error('tweak: no ' + t.path); }
    const k = parts[parts.length - 1], was = o[k];
    if (typeof was !== 'number' && t.mul !== undefined) throw new Error('tweak: ' + t.path + ' is not a number');
    o[k] = t.mul !== undefined ? +(was * t.mul).toFixed(4) : t.to;
    done.push(`${t.path} ${was} → ${o[k]}`);
  }
  return done;
}
const env = typeof process !== 'undefined' && process.env && process.env.R62D_TWEAK;
export const TWEAKED = env ? applyTweak(JSON.parse(env)) : [];
