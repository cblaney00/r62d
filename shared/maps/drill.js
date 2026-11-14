// "Drill Hall" — the pros' practice room for drills (he asked, 2026-11-14: games built on ecological dynamics, a
// gunfight in a closed area with the two sides kept apart, no abilities, two bulletproof blocks in the middle that
// nobody can get past). A closed concrete hall, 38 x 24 cells; down the middle a line of steel braces (T.BEAM: blocks
// walking, not sight or bullets) so each side keeps to its half; two concrete blocks across the line, one in each
// half of the hall's length, are the cover the fight turns on; a few waist-high crates by each side's start.
// Drills only (server/drills.js): not in the map list, never in a real match.
import { T, FL, MAT } from '../constants.js';
import { makeMap } from '../mapkit.js';

export const DRILL_W = 38, DRILL_H = 24, DRILL_MID = 19; // inside size; the middle line is column DRILL_MID
export function build() {
  const { kits: [G], finish } = makeMap({ id: 'drill', name: 'Drill Hall', floors: [{ name: '1F', x0: 0, y0: 0, w: DRILL_W + 2, h: DRILL_H + 2, ground: true }] });
  G.ground(0, 0, DRILL_W + 2, DRILL_H + 2, FL.CONCRETE);
  G.room('Drill Hall', 1, 1, DRILL_W, DRILL_H, FL.CONCRETE);
  G.box(0, 0, DRILL_W + 1, DRILL_H + 1, T.HARD, MAT.CONCRETE);
  G.wall(DRILL_MID, 1, DRILL_MID, DRILL_H, T.BEAM, MAT.CONCRETE); // the line nobody crosses
  for (const y of [6, 16]) G.wall(DRILL_MID - 2, y, DRILL_MID + 2, y + 2, T.HARD, MAT.CONCRETE); // the two blocks (3 x 5, straddling the line)
  G.wall(5, 9, 5, 16, T.HARD, MAT.CONCRETE); G.wall(DRILL_W - 4, 9, DRILL_W - 4, 16, T.HARD, MAT.CONCRETE); // each side starts behind its own wall
  for (const [x, y] of [[5, 4], [6, 19], [10, 11], [31, 5], [30, 18], [26, 12]]) G.prop('crates', x, y, 2, 2, T.LOW);
  const g = G.c;
  return finish({
    sites: [{ name: 'Drill', bombs: [{ id: 'A', ...g(4, 12), room: 'Drill Hall' }, { id: 'B', ...g(34, 12), room: 'Drill Hall' }], rooms: ['Drill Hall'] }],
    cams: [],
    atkSpawns: [{ name: 'West', ...g(3, 12) }],
  });
}
