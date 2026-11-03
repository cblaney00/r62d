// "Alpine Lodge" — a timber mountain lodge: great hall, bar and dining downstairs, guest suites,
// games room and library upstairs, with a balcony and outside steps on the south side.
// The Spa Chalet (he asked for bigger maps that are not rectangles) stands to the west with its corners cut off, joined
// to the lodge by a glass walkway downstairs and a skybridge upstairs: spa pool, wine bar and gear shop, a loft above.
import { T, FL, MAT } from '../constants.js';
import { makeMap } from '../mapkit.js';

export function build() {
  const { kits: [G, U], stair, finish } = makeMap({ id: 'lodge', name: 'Alpine Lodge', floors: [
    { name: '1F', x0: -40, y0: 0, w: 114, h: 54, ground: true },
    { name: '2F', x0: -34, y0: 7, w: 98, h: 42 },
  ] });

  // ================= 1F =================
  G.ground(64, 0, 10, 54, FL.ASPHALT);      // mountain road
  G.ground(46, 46, 18, 8, FL.ASPHALT);      // parking
  G.ground(32, 2, 8, 7, FL.WOOD);           // front deck
  G.area('Great Hall', 26, 10, 20, 16, FL.WOOD);
  G.area('Ski Room', 11, 10, 14, 10, FL.CONCRETE);
  G.area('Bar', 47, 10, 14, 10, FL.WOOD);
  G.area('Sauna', 11, 21, 14, 10, FL.TILE);
  G.area('Kitchen', 47, 21, 14, 10, FL.TILE);
  G.area('Dining Hall', 26, 27, 20, 15, FL.WOOD);
  G.area('Boot Room', 11, 32, 14, 10, FL.CONCRETE);
  G.area('Storeroom', 47, 32, 14, 10, FL.CONCRETE);
  G.box(10, 9, 61, 42, T.SOFT, MAT.BRICK);
  G.pillar([[10, 9], [61, 9], [10, 42], [61, 42], [25, 9], [46, 9], [25, 42], [46, 42], [10, 20], [10, 31], [61, 20], [61, 31], [25, 26], [46, 26]]);
  G.door(34, 9, 37, 9, true); G.door(61, 14, 61, 15, true); G.door(34, 42, 35, 42, true);
  G.door(55, 42, 56, 42, true); G.door(17, 42, 18, 42, true);
  G.door(25, 15, 25, 16); G.door(46, 15, 46, 16); G.door(34, 26, 37, 26); G.door(17, 20, 18, 20); G.door(17, 31, 18, 31);
  G.door(53, 20, 54, 20); G.door(53, 31, 54, 31); G.door(46, 28, 46, 29); G.door(25, 36, 25, 37); G.door(46, 36, 46, 37); G.door(25, 22, 25, 23);
  G.window(14, 9, 15, 9); G.window(20, 9, 21, 9); G.window(50, 9, 51, 9); G.window(56, 9, 57, 9); G.window(10, 25, 10, 26);
  G.window(10, 36, 10, 37); G.window(61, 25, 61, 26); G.window(61, 36, 61, 37); G.window(29, 42, 30, 42); G.window(40, 42, 41, 42); G.window(50, 42, 51, 42);
  G.prop('couch', 34, 18, 7, 1, T.LOW); G.prop('coffeetable', 35, 20, 5, 2, T.LOW); G.prop('couch', 42, 19, 1, 4, T.LOW, 1);
  G.prop('counter', 36, 24, 6, 1, T.TALL); G.prop('pillar', 32, 12, 1, 1, T.TALL); G.prop('pillar', 40, 12, 1, 1, T.TALL); G.prop('plant', 44, 11, 1, 1, T.TALL);
  G.prop('locker', 12, 11, 12, 1, T.TALL); G.prop('bench', 13, 15, 8, 1, T.LOW); G.prop('rack', 23, 13, 1, 5, T.TALL);
  G.prop('counter', 48, 13, 8, 1, T.LOW); G.prop('shelf', 48, 11, 8, 1, T.TALL); G.prop('chairs', 52, 16, 4, 1, T.LOW);
  G.prop('bench', 12, 24, 1, 5, T.LOW); G.prop('bench', 22, 24, 1, 5, T.LOW); G.prop('tank', 16, 25, 2, 2, T.TALL);
  G.prop('counter', 48, 22, 10, 1, T.LOW); G.prop('island', 51, 26, 6, 2, T.LOW); G.prop('fridge', 59, 22, 1, 2, T.TALL);
  G.prop('meetingtable', 29, 30, 6, 3, T.LOW); G.prop('meetingtable', 37, 30, 6, 3, T.LOW); G.prop('meetingtable', 29, 36, 6, 3, T.LOW); G.prop('meetingtable', 37, 36, 6, 3, T.LOW);
  G.prop('shelf', 12, 33, 1, 7, T.TALL); G.prop('locker', 16, 40, 7, 1, T.TALL); G.prop('crates', 21, 34, 2, 2, T.TALL);
  G.prop('crates', 49, 34, 2, 2, T.TALL); G.prop('shelf', 48, 39, 7, 1, T.TALL); G.prop('crates', 52, 35, 2, 2, T.TALL);
  for (const [tx, ty] of [[3, 7], [5, 22], [-38, 8], [-37, 28], [-20, 46], [-36, 45], [-8, 5], [2, 33], [6, 44], [20, 2], [48, 3], [56, 3], [14, 48], [28, 50], [40, 48], [68, 2]]) G.prop('tree', tx, ty, 2, 2, T.TALL);
  G.prop('car', 48, 47, 3, 6, T.TALL); G.prop('car', 58, 47, 3, 6, T.TALL); G.prop('bush', 30, 44, 3, 2, T.LOW);
  // shapes (he asked for less blocky maps): all four corners of the lodge are cut at an angle, and a few rooms get
  // rounded or angled corners (log and plaster structure, so they can't be blown open)
  G.outside([[10, 9], [12.8, 9], [10, 11.8]], FL.GRASS); G.walls([[10.5, 11.5], [12.5, 9.5]], 1, T.SOFT, MAT.BRICK);
  G.outside([[59.2, 9], [62, 9], [62, 11.8]], FL.GRASS); G.walls([[59.5, 9.5], [61.5, 11.5]], 1, T.SOFT, MAT.BRICK);
  G.outside([[10, 40.2], [10, 43], [12.8, 43]], FL.GRASS); G.walls([[10.5, 40.5], [12.5, 42.5]], 1, T.SOFT, MAT.BRICK);
  G.outside([[62, 40.2], [62, 43], [59.2, 43]], FL.GRASS); G.walls([[61.5, 40.5], [59.5, 42.5]], 1, T.SOFT, MAT.BRICK);
  G.chamfer(26, 10, 2, 'se', T.HARD, MAT.DRYWALL);                                  // Great Hall
  G.round(26, 42, 3, 'ne', T.HARD, MAT.DRYWALL); G.round(46, 42, 3, 'nw', T.HARD, MAT.DRYWALL); // Dining Hall
  G.decor((x, X, Y) => { x.fillStyle = 'rgba(235,235,230,0.6)'; for (let py = 0; py < 54; py += 2.5) x.fillRect(X(68.9), Y(py), 2, 20); for (let px = 47; px < 64; px += 3.4) x.fillRect(X(px), Y(46.2), 1.2, Y(53.8) - Y(46.2)); });

  // ---- Spa Chalet (1F) and the glass walkway to the lodge
  G.ground(-26, 41, 4, 6, FL.WOOD);          // chalet steps
  G.room('Spa Pool', -31, 13, 13, 13, FL.TILE);
  G.room('Chalet Lobby', -17, 13, 13, 9, FL.WOOD);
  G.room('Massage Room', -17, 23, 13, 7, FL.CARPET);
  G.room('Wine Bar', -31, 27, 13, 13, FL.WOOD);
  G.room('Gear Shop', -17, 31, 13, 9, FL.CONCRETE);
  G.room('Glass Walkway', -3, 14, 13, 3, FL.WOOD);
  G.box(-32, 12, -4, 40, T.SOFT, MAT.BRICK); G.wall(-4, 13, 10, 13, T.SOFT, MAT.BRICK); G.wall(-4, 17, 10, 17, T.SOFT, MAT.BRICK);
  G.wall(-18, 13, -18, 39); G.wall(-31, 26, -19, 26); G.wall(-17, 22, -5, 22); G.wall(-17, 30, -5, 30);
  G.pillar([[-18, 12], [-18, 40], [-32, 26], [-18, 26], [-18, 22], [-4, 22], [-18, 30], [-4, 30], [-4, 13], [-4, 17], [10, 13], [10, 17]]);
  G.door(-4, 14, -4, 16); G.door(10, 14, 10, 15);            // walkway: chalet lobby <-> ski room
  G.door(-11, 12, -10, 12, true); G.door(-32, 19, -32, 20, true); G.door(-25, 40, -24, 40, true); G.door(-4, 33, -4, 34, true);
  G.door(-18, 16, -18, 17); G.door(-12, 22, -11, 22); G.door(-18, 27, -18, 28); G.door(-11, 30, -10, 30); G.door(-25, 26, -24, 26); G.door(-18, 35, -18, 36);
  G.window(-27, 12, -26, 12); G.window(-8, 12, -7, 12); G.window(-32, 31, -32, 32); G.window(-12, 40, -11, 40); G.window(-4, 25, -4, 26);
  for (const wx of [-1, 3, 7]) { G.window(wx, 13, wx + 1, 13); G.window(wx, 17, wx + 1, 17); } // the walkway is glass
  G.prop('pool', -29, 15, 8, 7, T.LOW); G.prop('bench', -20, 15, 1, 6, T.LOW); G.prop('plant', -30, 24, 1, 1, T.TALL);
  G.prop('reception', -14, 18, 6, 1, T.LOW); G.prop('plant', -6, 14, 1, 1, T.TALL); G.prop('couch', -16, 14, 4, 1, T.LOW);
  G.prop('bed', -15, 25, 3, 3, T.LOW); G.prop('bed', -9, 25, 3, 3, T.LOW);
  G.prop('counter', -30, 29, 1, 7, T.LOW); G.prop('rack', -22, 28, 3, 1, T.TALL); G.prop('coffeetable', -26, 33, 2, 2, T.LOW); G.prop('coffeetable', -23, 37, 2, 2, T.LOW);
  G.prop('rack', -12, 32, 1, 6, T.TALL); G.prop('rack', -9, 32, 1, 6, T.TALL); G.prop('counter', -7, 38, 2, 1, T.LOW);
  G.outside([[-32, 12], [-28.2, 12], [-32, 15.8]], FL.GRASS); G.walls([[-31.5, 15.5], [-28.5, 12.5]], 1, T.SOFT, MAT.BRICK);
  G.outside([[-32, 36.2], [-32, 41], [-27.2, 41]], FL.GRASS); G.walls([[-31.5, 36.5], [-27.5, 40.5]], 1, T.SOFT, MAT.BRICK);
  G.outside([[-3, 36.2], [-3, 41], [-7.8, 41]], FL.GRASS); G.walls([[-3.5, 36.5], [-7.5, 40.5]], 1, T.SOFT, MAT.BRICK);

  // ================= 2F =================
  U.slab(26, 43, 24, 3, FL.WOOD);                       // south balcony
  U.area('Gallery Landing', 26, 10, 20, 8, FL.WOOD);
  U.area('Suite A', 11, 10, 14, 10, FL.CARPET);
  U.area('Suite B', 47, 10, 14, 10, FL.CARPET);
  U.area('Lounge', 26, 19, 20, 12, FL.CARPET);
  U.area('Games Room', 11, 21, 14, 21, FL.CARPET);
  U.area('Office', 47, 21, 14, 10, FL.WOOD);
  U.area('Library', 26, 32, 20, 10, FL.CARPET);
  U.area('Attic Storage', 47, 32, 14, 10, FL.WOOD);
  U.box(10, 9, 61, 42, T.SOFT, MAT.BRICK);
  U.pillar([[10, 9], [61, 9], [10, 42], [61, 42], [25, 9], [46, 9], [25, 42], [46, 42], [10, 20], [61, 20], [61, 31]]);
  U.door(25, 13, 25, 14); U.door(46, 13, 46, 14); U.door(34, 18, 37, 18); U.door(25, 24, 25, 25); U.door(46, 24, 46, 25);
  U.door(34, 31, 35, 31); U.door(25, 36, 25, 37); U.door(53, 31, 54, 31); U.door(46, 36, 46, 37); U.door(17, 20, 18, 20); U.door(53, 20, 54, 20);
  U.door(34, 42, 35, 42, true);
  U.window(14, 9, 15, 9); U.window(34, 9, 37, 9); U.window(56, 9, 57, 9); U.window(10, 30, 10, 31);
  U.window(61, 14, 61, 15); U.window(61, 27, 61, 28); U.window(17, 42, 18, 42); U.window(40, 42, 41, 42); U.window(56, 42, 57, 42); /* moved off the tall shelves so it can be used */
  U.prop('bench', 38, 11, 6, 1, T.LOW); U.prop('plant', 44, 16, 1, 1, T.TALL);
  U.prop('bed', 13, 12, 5, 6, T.LOW); U.prop('cabinet', 22, 11, 2, 1, T.TALL);
  U.prop('bed', 54, 12, 5, 6, T.LOW); U.prop('cabinet', 48, 11, 2, 1, T.TALL);
  U.prop('couch', 29, 22, 6, 1, T.LOW); U.prop('couch', 37, 22, 6, 1, T.LOW); U.prop('coffeetable', 33, 25, 5, 2, T.LOW); U.prop('tv', 35, 29, 4, 1, T.TALL);
  U.prop('meetingtable', 14, 25, 6, 4, T.LOW); U.prop('meetingtable', 14, 33, 6, 4, T.LOW); U.prop('couch', 22, 22, 1, 5, T.LOW, 1);
  U.prop('desk', 50, 23, 5, 2, T.LOW); U.prop('bookshelf', 59, 22, 1, 7, T.TALL); U.prop('console', 48, 29, 4, 1, T.LOW);
  U.prop('bookshelf', 27, 33, 1, 8, T.TALL); U.prop('bookshelf', 31, 36, 10, 1, T.TALL); U.prop('desk', 42, 33, 3, 2, T.LOW);
  U.prop('crates', 48, 38, 3, 2, T.TALL); U.prop('crates', 52, 34, 2, 2, T.TALL); U.prop('shelf', 49, 41, 7, 1, T.TALL);
  U.outside([[10, 9], [12.8, 9], [10, 11.8]]); U.walls([[10.5, 11.5], [12.5, 9.5]], 1, T.SOFT, MAT.BRICK);
  U.outside([[59.2, 9], [62, 9], [62, 11.8]]); U.walls([[59.5, 9.5], [61.5, 11.5]], 1, T.SOFT, MAT.BRICK);
  U.outside([[10, 40.2], [10, 43], [12.8, 43]]); U.walls([[10.5, 40.5], [12.5, 42.5]], 1, T.SOFT, MAT.BRICK);
  U.outside([[62, 40.2], [62, 43], [59.2, 43]]); U.walls([[61.5, 40.5], [59.5, 42.5]], 1, T.SOFT, MAT.BRICK);
  U.round(46, 42, 2, 'nw', T.HARD, MAT.DRYWALL);                                    // Library

  // ---- Spa Chalet (2F) and the skybridge
  U.room('Chalet Loft', -31, 13, 13, 13, FL.WOOD);
  U.room('Observatory', -17, 13, 13, 9, FL.CARPET);
  U.room('Chalet Suite', -31, 27, 13, 13, FL.CARPET);
  U.room('Chalet Gallery', -17, 23, 13, 17, FL.WOOD);
  U.room('Skybridge', -3, 14, 13, 3, FL.WOOD);
  U.box(-32, 12, -4, 40, T.SOFT, MAT.BRICK); U.wall(-4, 13, 10, 13, T.SOFT, MAT.BRICK); U.wall(-4, 17, 10, 17, T.SOFT, MAT.BRICK);
  U.wall(-18, 13, -18, 39); U.wall(-31, 26, -19, 26); U.wall(-17, 22, -5, 22);
  U.pillar([[-18, 12], [-18, 40], [-32, 26], [-18, 26], [-18, 22], [-4, 22], [-4, 13], [-4, 17], [10, 13], [10, 17]]);
  U.door(-4, 14, -4, 16); U.door(10, 14, 10, 15);            // skybridge: observatory <-> suite A
  U.door(-18, 17, -18, 18); U.door(-11, 22, -10, 22); U.door(-18, 31, -18, 32); U.door(-26, 26, -25, 26);
  U.window(-25, 12, -24, 12); U.window(-10, 12, -9, 12); U.window(-32, 20, -32, 21); U.window(-32, 31, -32, 32); U.window(-15, 40, -14, 40); U.window(-4, 27, -4, 28);
  for (const wx of [0, 5]) { U.window(wx, 13, wx + 1, 13); U.window(wx, 17, wx + 1, 17); }
  U.prop('bed', -29, 15, 5, 5, T.LOW); U.prop('cabinet', -21, 14, 2, 1, T.TALL); U.prop('couch', -29, 23, 6, 1, T.LOW);
  U.prop('console', -14, 14, 6, 1, T.LOW); U.prop('chairs', -8, 17, 1, 3, T.LOW);
  U.prop('bed', -28, 30, 4, 5, T.LOW); U.prop('cabinet', -21, 37, 2, 1, T.TALL);
  U.prop('bookshelf', -8, 24, 1, 6, T.TALL); U.prop('couch', -12, 26, 1, 4, T.LOW, 1);
  U.outside([[-32, 12], [-28.2, 12], [-32, 15.8]]); U.walls([[-31.5, 15.5], [-28.5, 12.5]], 1, T.SOFT, MAT.BRICK);
  U.outside([[-32, 36.2], [-32, 41], [-27.2, 41]]); U.walls([[-31.5, 36.5], [-27.5, 40.5]], 1, T.SOFT, MAT.BRICK);
  U.outside([[-3, 36.2], [-3, 41], [-7.8, 41]]); U.walls([[-3.5, 36.5], [-7.5, 40.5]], 1, T.SOFT, MAT.BRICK);

  // ================= stairs =================
  stair(0, 1, -16, 32, 2, 5, 'n', FL.WOOD);              // gear shop -> chalet gallery
  G.prop('railing', -14, 31, 1, 6, T.LOW); G.prop('railing', -16, 31, 2, 1, T.LOW);
  U.prop('railing', -14, 32, 1, 5, T.LOW); U.prop('railing', -16, 37, 2, 1, T.LOW);
  stair(0, 1, 27, 13, 2, 4, 'n', FL.WOOD);               // great hall -> gallery landing
  G.prop('railing', 29, 12, 1, 5, T.LOW); G.prop('railing', 27, 12, 2, 1, T.LOW);
  U.prop('railing', 29, 13, 1, 4, T.LOW); U.prop('railing', 27, 17, 2, 1, T.LOW);
  stair(0, 1, 58, 34, 2, 4, 'n', FL.CONCRETE);           // storeroom -> attic
  G.prop('railing', 57, 33, 1, 5, T.LOW); G.prop('railing', 58, 33, 2, 1, T.LOW);
  U.prop('railing', 57, 34, 1, 4, T.LOW); U.prop('railing', 58, 38, 2, 1, T.LOW);
  stair(0, 1, 47, 44, 2, 6, 'n', FL.WOOD);               // outside steps -> balcony
  G.prop('railing', 47, 43, 2, 1, T.LOW); G.prop('railing', 46, 43, 1, 6, T.LOW); G.prop('railing', 49, 43, 1, 6, T.LOW);

  const g = G.c, u = U.c;
  return finish({
    sites: [
      { name: 'Bar / Kitchen', bombs: [{ id: 'A', ...g(57, 17), room: 'Bar' }, { id: 'B', ...g(56, 29), room: 'Kitchen' }], rooms: ['Bar', 'Kitchen'] },
      { name: 'Dining Hall / Storeroom', bombs: [{ id: 'A', ...g(35, 40), room: 'Dining Hall' }, { id: 'B', ...g(55, 37), room: 'Storeroom' }], rooms: ['Dining Hall', 'Storeroom'] },
      { name: '2F Office / Suite B', bombs: [{ id: 'A', ...u(56, 26), room: 'Office' }, { id: 'B', ...u(50, 17), room: 'Suite B' }], rooms: ['Office', 'Suite B'] },
      { name: '2F Games Room / Library', bombs: [{ id: 'A', ...u(18, 39), room: 'Games Room' }, { id: 'B', ...u(38, 39), room: 'Library' }], rooms: ['Games Room', 'Library'] },
    ],
    cams: [g(35, 11), g(4, 4), u(35, 20), g(35, 41), g(12, 19), g(70, 30), g(-10, 15), u(-25, 20), g(2, 15), g(-36, 38)],
    atkSpawns: [
      { name: 'Ski Lift', ...g(3, 4) }, { name: 'Mountain Road', ...g(69, 26) },
      { name: 'Parking', ...g(54, 51) }, { name: 'Pine Woods', ...g(3, 48) }, { name: 'Chalet Trail', ...g(-37, 22) },
    ],
  });
}
