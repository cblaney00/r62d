// "Rail Depot" — a train maintenance shed with two tracks and parked carriages, an office wing,
// and catwalks running round the shed at first-floor height (you can see down across the gap).
import { T, FL, MAT } from '../constants.js';
import { makeMap } from '../mapkit.js';

export function build() {
  const { kits: [G, U], stair, finish } = makeMap({ id: 'depot', name: 'Rail Depot', floors: [
    { name: '1F', x0: 0, y0: 0, w: 80, h: 56, ground: true },
    { name: '2F', x0: 6, y0: 8, w: 70, h: 38 },
  ] });

  // ================= 1F =================
  G.ground(0, 12, 8, 32, FL.ASPHALT);       // rail yard
  G.ground(72, 36, 8, 20, FL.ASPHALT);      // car park
  G.ground(20, 0, 16, 10, FL.CONCRETE);     // north siding apron
  G.area('Engine Shed', 9, 11, 36, 32, FL.CONCRETE);
  G.area('Parts Store', 46, 11, 12, 10, FL.CONCRETE);
  G.area('Locker Room', 59, 11, 12, 10, FL.TILE);
  G.area('Dispatch', 46, 22, 12, 9, FL.WOOD);
  G.area('Canteen', 59, 22, 12, 9, FL.TILE);
  G.area('Workshop', 46, 32, 25, 11, FL.CONCRETE);
  G.box(8, 10, 71, 43, T.SOFT, MAT.BRICK);
  G.pillar([[8, 10], [71, 10], [8, 43], [71, 43], [45, 10], [45, 43], [45, 21], [45, 31], [58, 10], [71, 21], [71, 31], [20, 10], [33, 10], [20, 43], [33, 43]]);
  G.open(8, 15, 8, 19, 'door', true); G.open(8, 32, 8, 36, 'door', true);   // rolling doors where the tracks come in
  G.door(25, 10, 27, 10, true); G.door(25, 43, 27, 43, true); G.door(64, 10, 65, 10, true); G.door(60, 43, 62, 43, true); G.door(71, 25, 71, 26, true);
  G.door(45, 15, 45, 16); G.door(45, 25, 45, 26); G.door(45, 36, 45, 38); G.door(58, 15, 58, 16); G.door(51, 21, 52, 21);
  G.door(64, 21, 65, 21); G.door(58, 26, 58, 27); G.door(51, 31, 52, 31); G.door(64, 31, 65, 31);
  G.window(14, 10, 15, 10); G.window(38, 10, 39, 10); G.window(50, 10, 51, 10); G.window(14, 43, 15, 43); G.window(38, 43, 39, 43);
  G.window(53, 43, 54, 43); G.window(67, 43, 68, 43); G.window(71, 15, 71, 16); G.window(71, 37, 71, 38);
  G.prop('train', 13, 16, 15, 3, T.TALL); G.prop('train', 22, 32, 18, 3, T.TALL); G.prop('train', 0, 32, 6, 3, T.TALL);
  for (const [px, py] of [[17, 24], [28, 24], [39, 24], [17, 28], [28, 28], [39, 28]]) G.prop('pillar', px, py, 1, 1, T.TALL);
  G.prop('crates', 33, 13, 3, 2, T.TALL); G.prop('crates', 11, 38, 2, 3, T.TALL); G.prop('workbench', 21, 26, 5, 1, T.LOW);
  G.prop('crates', 41, 39, 2, 2, T.TALL); G.prop('workbench', 31, 21, 1, 3, T.LOW); G.prop('tank', 12, 22, 3, 3, T.TALL);
  G.prop('shelf', 47, 12, 10, 1, T.TALL); G.prop('shelf', 47, 16, 7, 1, T.TALL); G.prop('crates', 55, 18, 2, 2, T.TALL);
  G.prop('locker', 60, 12, 10, 1, T.TALL); G.prop('locker', 60, 18, 10, 1, T.TALL); G.prop('bench', 62, 15, 6, 1, T.LOW);
  G.prop('desk', 47, 23, 4, 2, T.LOW); G.prop('desk', 47, 27, 4, 2, T.LOW); G.prop('console', 54, 23, 3, 1, T.LOW); G.prop('cabinet', 56, 27, 1, 3, T.TALL);
  G.prop('counter', 60, 23, 10, 1, T.LOW); G.prop('meetingtable', 61, 26, 7, 3, T.LOW);
  G.prop('workbench', 52, 33, 6, 1, T.LOW); G.prop('workbench', 60, 33, 6, 1, T.LOW); G.prop('tank', 66, 38, 3, 3, T.TALL); G.prop('crates', 55, 39, 3, 2, T.TALL);
  G.prop('container', 22, 2, 8, 3, T.TALL, 1); G.prop('container', 2, 47, 8, 3, T.TALL, 1); G.prop('car', 74, 40, 3, 6, T.TALL); G.prop('van', 74, 48, 3, 7, T.TALL);
  G.prop('tree', 50, 2, 2, 2, T.TALL); G.prop('tree', 66, 3, 2, 2, T.TALL); G.prop('bush', 46, 48, 3, 2, T.LOW); G.prop('dumpster', 64, 46, 3, 2, T.TALL);
  // shapes (he asked for less blocky maps): the office wing's south-east corner is cut at an angle, and a few rooms get
  // rounded or angled corners (plastered structure, so they can't be blown open)
  G.outside([[69, 44], [72, 44], [72, 41]], FL.ASPHALT); G.walls([[71.5, 41.5], [69.5, 43.5]], 1, T.SOFT, MAT.BRICK);
  G.round(71, 31, 3, 'nw', T.HARD, MAT.DRYWALL);                                    // Canteen
  G.round(71, 32, 3, 'sw', T.HARD, MAT.DRYWALL);                                    // Workshop
  G.chamfer(46, 31, 2, 'ne', T.HARD, MAT.DRYWALL);                                  // Dispatch
  G.round(45, 11, 3, 'sw', T.HARD, MAT.CONCRETE);                                   // Engine Shed
  G.decor((x, X, Y) => { // the rails, running in through the big doors
    for (const ty of [17.5, 33.5]) {
      x.fillStyle = 'rgba(60,45,30,0.55)'; for (let px = 0; px < 45; px += 0.75) x.fillRect(X(px), Y(ty) - 9, 5, 18);
      x.fillStyle = '#8f949a'; x.fillRect(X(0), Y(ty) - 6, X(45) - X(0), 1.6); x.fillRect(X(0), Y(ty) + 5, X(45) - X(0), 1.6);
    }
    x.fillStyle = 'rgba(230,190,50,0.6)'; x.fillRect(X(9), Y(23), X(45) - X(9), 1.2); x.fillRect(X(9), Y(29), X(45) - X(9), 1.2);
  });

  // ================= 2F =================
  U.slab(72, 22, 2, 6, FL.CONCRETE);                     // fire-escape landing
  U.drop(12, 14, 33, 26);                                // open space above the shed floor
  U.room('North Catwalk', 9, 11, 36, 3, FL.SERVER);
  U.room('South Catwalk', 9, 40, 36, 3, FL.SERVER);
  U.room('West Catwalk', 9, 14, 3, 26, FL.SERVER);
  U.room('Center Gantry', 12, 26, 33, 2, FL.SERVER);
  U.area('Control Room', 46, 11, 12, 10, FL.SERVER);
  U.area('Records Office', 59, 11, 12, 10, FL.WOOD);
  U.area('2F Corridor', 46, 22, 25, 3, FL.CARPET);
  U.area('Manager Office', 46, 26, 12, 17, FL.WOOD);
  U.area('Server Closet', 59, 26, 12, 8, FL.SERVER);
  U.area('Break Room', 59, 35, 12, 8, FL.TILE);
  U.box(8, 10, 71, 43, T.SOFT, MAT.BRICK);
  U.wall(45, 11, 45, 42, T.SOFT, MAT.BRICK);
  for (const [rx, ry, rw, rh] of [[12, 14, 33, 1], [12, 39, 33, 1], [12, 15, 1, 11], [12, 28, 1, 11], [13, 25, 32, 1], [13, 28, 32, 1]]) U.prop('railing', rx, ry, rw, rh, T.LOW);
  U.door(45, 12, 45, 13); U.door(45, 40, 45, 41); U.door(45, 26, 45, 27);
  U.door(58, 15, 58, 16); U.door(51, 21, 52, 21); U.door(64, 21, 65, 21); U.door(51, 25, 52, 25); U.door(64, 25, 65, 25);
  U.door(64, 34, 65, 34); U.door(58, 38, 58, 39); U.door(71, 23, 71, 24, true);
  U.window(14, 10, 15, 10); U.window(38, 10, 39, 10); U.window(50, 10, 51, 10); U.window(64, 10, 65, 10); U.window(71, 15, 71, 16);
  U.window(71, 38, 71, 39); U.window(52, 43, 53, 43); U.window(66, 43, 67, 43); U.window(8, 12, 8, 12); U.window(8, 41, 8, 41);
  U.prop('console', 47, 12, 9, 1, T.LOW); U.prop('rack', 56, 15, 1, 5, T.TALL); U.prop('desk', 48, 16, 4, 2, T.LOW);
  U.prop('bookshelf', 60, 12, 10, 1, T.TALL); U.prop('desk', 62, 16, 4, 2, T.LOW); U.prop('cabinet', 69, 15, 1, 4, T.TALL);
  U.prop('desk', 50, 29, 5, 2, T.LOW); U.prop('couch', 47, 29, 1, 4, T.LOW, 1); U.prop('bookshelf', 56, 27, 1, 6, T.TALL); U.prop('plant', 56, 41, 1, 1, T.TALL);
  U.prop('rack', 61, 27, 1, 6, T.TALL); U.prop('rack', 64, 27, 1, 6, T.TALL); U.prop('rack', 67, 27, 1, 6, T.TALL);
  U.prop('counter', 60, 36, 9, 1, T.LOW); U.prop('fridge', 69, 36, 1, 2, T.TALL); U.prop('coffeetable', 62, 39, 4, 2, T.LOW);
  U.prop('crates', 30, 11, 2, 2, T.TALL); U.prop('crates', 20, 41, 2, 2, T.TALL);
  U.outside([[69, 44], [72, 44], [72, 41]]); U.walls([[71.5, 41.5], [69.5, 43.5]], 1, T.SOFT, MAT.BRICK); // same corner as downstairs
  U.chamfer(71, 21, 2, 'nw', T.HARD, MAT.DRYWALL);                                  // Records Office

  // ================= stairs =================
  stair(0, 1, 9, 20, 2, 6, 'n', FL.CONCRETE);            // shed -> west catwalk
  G.prop('railing', 11, 19, 1, 7, T.LOW); G.prop('railing', 9, 19, 2, 1, T.LOW);
  U.prop('railing', 9, 26, 2, 1, T.LOW);
  stair(0, 1, 47, 34, 2, 6, 'n', FL.CONCRETE);           // workshop -> manager office
  G.prop('railing', 49, 33, 1, 7, T.LOW); G.prop('railing', 47, 33, 2, 1, T.LOW);
  U.prop('railing', 49, 35, 1, 5, T.LOW); U.prop('railing', 47, 40, 2, 1, T.LOW);
  stair(0, 1, 72, 28, 2, 6, 'n', FL.CONCRETE);           // outside fire escape -> corridor
  G.prop('railing', 72, 27, 2, 1, T.LOW);
  U.prop('railing', 72, 34, 2, 1, T.LOW);

  const g = G.c, u = U.c;
  return finish({
    sites: [
      { name: 'Dispatch / Canteen', bombs: [{ id: 'A', ...g(55, 29), room: 'Dispatch' }, { id: 'B', ...g(68, 29), room: 'Canteen' }], rooms: ['Dispatch', 'Canteen'] },
      { name: 'Parts Store / Locker Room', bombs: [{ id: 'A', ...g(50, 19), room: 'Parts Store' }, { id: 'B', ...g(68, 15), room: 'Locker Room' }], rooms: ['Parts Store', 'Locker Room'] },
      { name: '2F Control Room / Records Office', bombs: [{ id: 'A', ...u(53, 18), room: 'Control Room' }, { id: 'B', ...u(66, 18), room: 'Records Office' }], rooms: ['Control Room', 'Records Office'] },
      { name: '2F Manager Office / Server Closet', bombs: [{ id: 'A', ...u(53, 38), room: 'Manager Office' }, { id: 'B', ...u(69, 31), room: 'Server Closet' }], rooms: ['Manager Office', 'Server Closet'] },
    ],
    cams: [g(27, 22), g(30, 41), g(57, 41), u(58, 23), u(10, 12), g(76, 30)],
    atkSpawns: [
      { name: 'Rail Yard', ...g(3, 26) }, { name: 'North Siding', ...g(30, 7) },
      { name: 'Car Park', ...g(77, 52) }, { name: 'South Gate', ...g(40, 52) },
    ],
  });
}
