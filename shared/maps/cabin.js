// "Lakeside Cabin" (he asked 2026-11-20: small two-floor maps for 1v1s; he chose a lake cabin) — a timber cabin by a
// lake: a great room open to the loft above, kitchen, den, bunk room downstairs, a master suite, guest room and attic
// upstairs, outside timber steps up to a west deck, and a boathouse on the shore joined by a breezeway. Small on purpose
// (`small: true` in shared/map.js): the 1V1 mode only plays the small maps; it is in the 5v5 rotation too (he chose).
import { T, FL, MAT } from '../constants.js';
import { makeMap } from '../mapkit.js';

export function build() {
  const { kits: [G, U], stair, finish } = makeMap({ id: 'cabin', name: 'Lakeside Cabin', floors: [
    { name: '1F', x0: 0, y0: 0, w: 72, h: 54, ground: true },
    { name: '2F', x0: 8, y0: 8, w: 42, h: 28 },
  ] });

  // ================= 1F =================
  G.ground(0, 0, 72, 5, FL.ASPHALT);          // the lake road
  G.ground(26, 5, 5, 5, FL.CONCRETE);         // path to the front door
  G.ground(50, 38, 5, 8, FL.WOOD);            // dock
  G.area('Great Room', 15, 11, 16, 14, FL.WOOD);
  G.area('Kitchen', 32, 11, 13, 8, FL.TILE);
  G.area('Pantry', 32, 20, 6, 5, FL.CONCRETE);
  G.area('Mudroom', 39, 20, 6, 5, FL.CONCRETE);
  G.area('Bunk Room', 15, 26, 9, 7, FL.WOOD);
  G.area('Bathroom', 25, 26, 5, 7, FL.TILE);
  G.area('Den', 31, 26, 14, 7, FL.CARPET);
  G.area('Breezeway', 46, 28, 3, 3, FL.WOOD);
  G.area('Boathouse', 50, 25, 13, 12, FL.CONCRETE);
  G.box(14, 10, 45, 33, T.SOFT, MAT.BRICK); G.box(49, 24, 63, 37, T.SOFT, MAT.BRICK);
  G.pillar([[14, 10], [45, 10], [14, 33], [45, 33], [31, 10], [14, 25], [45, 25], [49, 24], [63, 24], [49, 37], [63, 37]]);
  G.door(27, 10, 28, 10, true);                                 // front door
  G.door(14, 18, 14, 19, true);                                 // side door (great room -> west deck steps)
  G.door(45, 14, 45, 15, true);                                 // kitchen door to the east yard
  G.door(55, 37, 57, 37, true);                                 // boathouse doors onto the dock
  G.door(63, 29, 63, 30, true);                                 // boathouse side door
  G.door(31, 14, 31, 15); G.door(31, 22, 31, 23); G.door(34, 19, 35, 19); G.door(41, 19, 42, 19); G.door(38, 22, 38, 23);
  G.door(19, 25, 20, 25); G.door(27, 25, 28, 25); G.door(41, 25, 42, 25); G.door(30, 29, 30, 30);
  G.door(45, 29, 45, 30); G.door(49, 29, 49, 30);
  G.window(20, 10, 21, 10); G.window(37, 10, 38, 10); G.window(14, 13, 14, 14); G.window(14, 28, 14, 29);
  G.window(18, 33, 19, 33); G.window(34, 33, 35, 33); G.window(40, 33, 41, 33); G.window(45, 22, 45, 23);
  G.window(53, 24, 54, 24); G.window(59, 24, 60, 24); G.window(63, 33, 63, 34);
  G.prop('couch', 22, 21, 6, 1, T.LOW); G.prop('coffeetable', 23, 18, 4, 2, T.LOW); G.prop('tank', 29, 12, 2, 2, T.TALL); // (the stove by the chimney)
  G.prop('bookshelf', 15, 23, 1, 2, T.TALL);
  G.prop('counter', 32, 11, 5, 1, T.LOW); G.prop('fridge', 44, 11, 1, 2, T.TALL); G.prop('island', 36, 15, 5, 2, T.LOW);
  G.prop('shelf', 32, 24, 4, 1, T.TALL); G.prop('crates', 36, 20, 2, 2, T.TALL);
  G.prop('locker', 43, 20, 1, 2, T.TALL); G.prop('bench', 40, 24, 3, 1, T.LOW);
  G.prop('bed', 16, 27, 3, 4, T.LOW); G.prop('bed', 21, 27, 2, 4, T.LOW);
  G.prop('sink', 26, 32, 2, 1, T.LOW);
  G.prop('couch', 33, 27, 1, 5, T.LOW); G.prop('tv', 44, 31, 1, 2, T.TALL); // (against the east wall: it stood loose a cell off it, by the door) G.prop('coffeetable', 37, 28, 3, 3, T.LOW);
  G.prop('boat', 52, 27, 3, 8, T.LOW); G.prop('workbench', 58, 25, 4, 1, T.LOW); G.prop('rack', 62, 31, 1, 2, T.TALL); G.prop('barrels', 59, 34, 2, 2, T.TALL);
  // the lake along the south edge, a pebble shore before it
  G.prop('sea', 0, 46, 50, 8, T.LOW); G.prop('sea', 55, 46, 17, 8, T.LOW); G.prop('sea', 50, 50, 5, 4, T.LOW);
  for (const [tx, ty] of [[4, 8], [9, 16], [3, 30], [8, 40], [66, 10], [60, 16], [68, 22], [52, 9], [22, 40], [36, 40], [6, 24]]) G.prop('tree', tx, ty, 2, 2, T.TALL);
  G.prop('rock', 42, 40, 3, 3, T.TALL); G.prop('bush', 30, 40, 2, 2, T.LOW); G.prop('car', 36, 6, 6, 3, T.TALL, 1);
  // shapes: the cabin's outside corners are cut at an angle, and the great room's north-west corner is rounded
  G.outside([[14, 30.2], [14, 34], [17.8, 34]], FL.GRASS); G.walls([[14.5, 30.5], [17.5, 33.5]], 1, T.SOFT, MAT.BRICK);
  G.round(15, 11, 3, 'se', T.HARD, MAT.DRYWALL);

  // ================= 2F =================
  U.slab(11, 15, 3, 10, FL.WOOD);                       // west deck, outside steps up to it
  U.area('Loft', 15, 11, 16, 14, FL.WOOD);
  U.drop(21, 14, 9, 10);                                // open over the great room
  U.area('Master Suite', 32, 11, 13, 14, FL.CARPET);
  U.area('Guest Room', 15, 26, 15, 7, FL.CARPET);
  U.area('Attic', 31, 26, 14, 7, FL.WOOD);
  U.box(14, 10, 45, 33, T.SOFT, MAT.BRICK);
  U.pillar([[14, 10], [45, 10], [14, 33], [45, 33], [31, 10], [14, 25], [45, 25]]);
  U.door(14, 17, 14, 18, true);                         // deck door into the loft
  U.door(31, 13, 31, 14); U.door(19, 25, 20, 25); U.door(37, 25, 38, 25); U.door(30, 29, 30, 30);
  U.window(20, 10, 21, 10); U.window(36, 10, 37, 10); U.window(41, 10, 42, 10); U.window(45, 16, 45, 17); U.window(45, 22, 45, 23);
  U.window(14, 28, 14, 29); U.window(21, 33, 22, 33); U.window(36, 33, 37, 33); U.window(45, 28, 45, 29);
  U.prop('railing', 20, 14, 1, 10, T.LOW); U.prop('railing', 21, 24, 9, 1, T.LOW); // round the opening
  U.prop('bed', 38, 12, 5, 5, T.LOW); U.prop('cabinet', 33, 11, 2, 1, T.TALL); U.prop('couch', 33, 22, 5, 1, T.LOW);
  U.prop('bed', 16, 27, 4, 4, T.LOW); U.prop('cabinet', 27, 27, 2, 1, T.TALL);
  U.prop('crates', 33, 30, 2, 2, T.TALL); U.prop('crates', 42, 27, 2, 2, T.TALL); U.prop('shelf', 38, 32, 4, 1, T.TALL);
  U.outside([[14, 30.2], [14, 34], [17.8, 34]]); U.walls([[14.5, 30.5], [17.5, 33.5]], 1, T.SOFT, MAT.BRICK);
  U.outside([[46, 30.2], [46, 34], [42.2, 34]]); U.walls([[45.5, 30.5], [42.5, 33.5]], 1, T.SOFT, MAT.BRICK);

  // ================= stairs =================
  stair(0, 1, 17, 14, 2, 5, 'n', FL.WOOD);              // great room -> loft
  G.prop('railing', 19, 13, 1, 6, T.LOW); G.prop('railing', 17, 13, 2, 1, T.LOW);
  U.prop('railing', 19, 14, 1, 5, T.LOW); U.prop('railing', 17, 19, 2, 1, T.LOW);
  stair(0, 1, 11, 25, 2, 6, 'n', FL.WOOD, 'timber');    // outside steps -> west deck

  const g = G.c, u = U.c;
  return finish({
    sites: [
      { name: 'Great Room / Kitchen', bombs: [{ id: 'A', ...g(26, 15), room: 'Great Room' }, { id: 'B', ...g(42, 17), room: 'Kitchen' }], rooms: ['Great Room', 'Kitchen'] },
      { name: 'Den / Mudroom', bombs: [{ id: 'A', ...g(40, 31), room: 'Den' }, { id: 'B', ...g(41, 22), room: 'Mudroom' }], rooms: ['Den', 'Mudroom'] },
      { name: '2F Loft / Master Suite', bombs: [{ id: 'A', ...u(17, 23), room: 'Loft' }, { id: 'B', ...u(36, 19), room: 'Master Suite' }], rooms: ['Loft', 'Master Suite'] },
      { name: '2F Guest Room / Attic', bombs: [{ id: 'A', ...u(24, 30), room: 'Guest Room' }, { id: 'B', ...u(38, 29), room: 'Attic' }], rooms: ['Guest Room', 'Attic'] },
    ],
    cams: [g(23, 23), g(28, 7), u(25, 12), g(56, 40), g(5, 20), g(66, 30)],
    atkSpawns: [
      { name: 'Lake Road', ...g(28, 2) }, { name: 'Pine Grove', ...g(4, 22) },
      { name: 'East Clearing', ...g(68, 18) }, { name: 'Boat Dock', ...g(52, 44) },
    ],
  });
}
