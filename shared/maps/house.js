// "Maple Street House" (he asked 2026-11-20: small two-floor maps for 1v1s; he chose a suburban house) — a two-storey
// family home: garage, living room, kitchen and dining downstairs, bedrooms, study and guest room upstairs, a back stair
// in the kitchen and a little balcony off the master bedroom. Small on purpose (`small: true` in shared/map.js): the
// 1V1 mode only plays the small maps, and it is in the normal 5v5 rotation too (he chose).
import { T, FL, MAT } from '../constants.js';
import { makeMap } from '../mapkit.js';

export function build() {
  const { kits: [G, U], stair, finish } = makeMap({ id: 'house', name: 'Maple Street House', floors: [
    { name: '1F', x0: 0, y0: 0, w: 64, h: 52, ground: true },
    { name: '2F', x0: 10, y0: 8, w: 44, h: 36 },
  ] });

  // ================= 1F =================
  G.ground(0, 46, 64, 6, FL.ASPHALT);        // Maple Street
  G.ground(16, 0, 8, 10, FL.ASPHALT);        // driveway to the garage door
  G.ground(29, 40, 4, 6, FL.CONCRETE);       // front path
  G.ground(52, 18, 6, 10, FL.WOOD);          // back deck
  G.area('Garage', 13, 11, 14, 12, FL.CONCRETE);
  G.area('Living Room', 13, 24, 14, 15, FL.CARPET);
  G.area('Stair Hall', 28, 11, 6, 12, FL.WOOD);
  G.area('Front Hall', 28, 24, 6, 15, FL.WOOD);
  G.area('Kitchen', 35, 11, 16, 12, FL.TILE);
  G.area('Dining Room', 35, 24, 8, 15, FL.WOOD);
  G.area('Den', 44, 24, 7, 7, FL.CARPET);
  G.area('Bathroom', 44, 32, 7, 7, FL.TILE);
  G.box(12, 10, 51, 39, T.SOFT, MAT.BRICK);
  G.pillar([[12, 10], [51, 10], [12, 39], [51, 39], [27, 10], [34, 10], [27, 39], [34, 39], [12, 23], [51, 23]]);
  G.door(17, 10, 22, 10, true);                                 // garage door
  G.door(30, 39, 31, 39, true);                                 // front door
  G.door(51, 20, 51, 21, true);                                 // back door (kitchen -> deck)
  G.door(27, 16, 27, 17); G.door(27, 30, 27, 31); G.door(19, 23, 20, 23); G.door(29, 23, 32, 23);
  G.door(34, 19, 34, 20); G.door(34, 30, 34, 31); G.door(37, 23, 39, 23); G.door(47, 23, 48, 23);
  G.door(43, 27, 43, 28); G.door(47, 31, 48, 31);
  G.window(43, 10, 44, 10); G.window(12, 16, 12, 17); G.window(12, 26, 12, 27); G.window(12, 33, 12, 34);
  G.window(17, 39, 18, 39); G.window(24, 39, 25, 39); G.window(37, 39, 38, 39); G.window(51, 15, 51, 16);
  G.window(51, 27, 51, 28); G.window(51, 34, 51, 35);
  G.prop('car', 15, 13, 3, 6, T.TALL); G.prop('workbench', 21, 11, 4, 1, T.LOW); G.prop('shelf', 13, 20, 1, 3, T.TALL); G.prop('crates', 23, 19, 2, 2, T.TALL);
  G.prop('couch', 16, 26, 6, 1, T.LOW); G.prop('coffeetable', 17, 28, 4, 2, T.LOW); G.prop('tv', 19, 38, 4, 1, T.TALL); G.prop('bookshelf', 13, 29, 1, 3, T.TALL);
  G.prop('plant', 28, 38, 1, 1, T.TALL);
  G.prop('counter', 35, 11, 6, 1, T.LOW); G.prop('fridge', 42, 11, 1, 2, T.TALL); G.prop('island', 38, 15, 5, 2, T.LOW);
  G.prop('meetingtable', 37, 29, 4, 5, T.LOW); G.prop('cabinet', 35, 37, 2, 1, T.TALL);
  G.prop('desk', 45, 26, 3, 2, T.LOW); G.prop('cabinet', 44, 24, 2, 1, T.TALL);
  G.prop('sink', 44, 34, 1, 2, T.LOW); G.prop('cabinet', 45, 38, 2, 1, T.TALL);
  for (const [tx, ty] of [[4, 6], [6, 40], [58, 6], [56, 38], [40, 3], [2, 24], [61, 30]]) G.prop('tree', tx, ty, 2, 2, T.TALL);
  G.prop('hedge', 14, 42, 6, 2, T.LOW); G.prop('hedge', 40, 42, 6, 2, T.LOW); G.prop('bush', 54, 31, 2, 2, T.LOW);
  G.prop('car', 6, 44, 6, 3, T.TALL, 1);
  // shapes: the house's four outside corners are cut at an angle (brick, so they stay breakable)
  G.outside([[12, 10], [14.8, 10], [12, 12.8]], FL.GRASS); G.walls([[12.5, 12.5], [14.5, 10.5]], 1, T.SOFT, MAT.BRICK);
  G.outside([[49.2, 10], [52, 10], [52, 12.8]], FL.GRASS); G.walls([[49.5, 10.5], [51.5, 12.5]], 1, T.SOFT, MAT.BRICK);
  G.outside([[12, 37.2], [12, 40], [14.8, 40]], FL.GRASS); G.walls([[12.5, 37.5], [14.5, 39.5]], 1, T.SOFT, MAT.BRICK);
  G.outside([[52, 37.2], [52, 40], [49.2, 40]], FL.GRASS); G.walls([[51.5, 37.5], [49.5, 39.5]], 1, T.SOFT, MAT.BRICK);

  // ================= 2F =================
  U.slab(18, 40, 8, 2, FL.WOOD);                       // master bedroom balcony over the front lawn
  U.area('Kids Room', 13, 11, 14, 12, FL.CARPET);
  U.area('Master Bedroom', 13, 24, 14, 15, FL.CARPET);
  U.area('Upstairs Hall', 28, 11, 6, 28, FL.WOOD);
  U.area('Study', 35, 11, 16, 12, FL.WOOD);
  U.area('Upstairs Bath', 35, 24, 8, 7, FL.TILE);
  U.area('Laundry', 35, 32, 8, 7, FL.TILE);
  U.area('Guest Room', 44, 24, 7, 15, FL.CARPET);
  U.box(12, 10, 51, 39, T.SOFT, MAT.BRICK);
  U.pillar([[12, 10], [51, 10], [12, 39], [51, 39], [27, 10], [34, 10], [27, 39], [34, 39], [12, 23], [51, 23]]);
  U.door(21, 39, 22, 39, true);                         // balcony door
  U.door(27, 21, 27, 22); U.door(27, 30, 27, 31); U.door(19, 23, 20, 23);
  U.door(34, 20, 34, 21); U.door(34, 26, 34, 27); U.door(34, 35, 34, 36);
  U.door(45, 23, 46, 23); U.door(43, 27, 43, 28); U.door(43, 35, 43, 36); U.door(38, 31, 39, 31);
  U.window(17, 10, 18, 10); U.window(12, 17, 12, 18); U.window(12, 30, 12, 31); U.window(16, 39, 17, 39);
  U.window(30, 39, 31, 39); U.window(38, 10, 39, 10); U.window(51, 15, 51, 16); U.window(51, 28, 51, 29); U.window(45, 39, 46, 39);
  U.prop('bed', 14, 12, 3, 4, T.LOW); U.prop('cabinet', 24, 11, 2, 1, T.TALL); U.prop('crates', 23, 19, 2, 2, T.TALL);
  U.prop('bed', 15, 30, 5, 5, T.LOW); U.prop('cabinet', 24, 37, 2, 1, T.TALL); U.prop('cabinet', 24, 25, 2, 1, T.TALL);
  U.prop('plant', 28, 38, 1, 1, T.TALL);
  U.prop('desk', 37, 13, 4, 2, T.LOW); U.prop('bookshelf', 41, 11, 4, 1, T.TALL);
  U.prop('sink', 40, 24, 2, 1, T.LOW); U.prop('tank', 40, 33, 2, 2, T.TALL); U.prop('shelf', 36, 38, 5, 1, T.TALL);
  U.prop('bed', 46, 32, 3, 4, T.LOW); U.prop('cabinet', 49, 24, 2, 1, T.TALL);
  U.outside([[12, 10], [14.8, 10], [12, 12.8]]); U.walls([[12.5, 12.5], [14.5, 10.5]], 1, T.SOFT, MAT.BRICK);
  U.outside([[49.2, 10], [52, 10], [52, 12.8]]); U.walls([[49.5, 10.5], [51.5, 12.5]], 1, T.SOFT, MAT.BRICK);
  U.outside([[12, 37.2], [12, 40], [14.8, 40]]); U.walls([[12.5, 37.5], [14.5, 39.5]], 1, T.SOFT, MAT.BRICK);
  U.outside([[52, 37.2], [52, 40], [49.2, 40]]); U.walls([[51.5, 37.5], [49.5, 39.5]], 1, T.SOFT, MAT.BRICK);

  // ================= stairs =================
  stair(0, 1, 29, 14, 2, 5, 'n', FL.WOOD);              // stair hall -> upstairs hall
  G.prop('railing', 31, 13, 1, 6, T.LOW); G.prop('railing', 29, 13, 2, 1, T.LOW);
  U.prop('railing', 31, 14, 1, 5, T.LOW); U.prop('railing', 29, 19, 2, 1, T.LOW);
  stair(0, 1, 48, 14, 2, 5, 'n', FL.WOOD);              // back stair: kitchen -> study
  G.prop('railing', 47, 13, 1, 6, T.LOW); G.prop('railing', 48, 13, 2, 1, T.LOW);
  U.prop('railing', 47, 14, 1, 5, T.LOW); U.prop('railing', 48, 19, 2, 1, T.LOW);

  const g = G.c, u = U.c;
  return finish({
    sites: [
      { name: 'Kitchen / Dining Room', bombs: [{ id: 'A', ...g(44, 19), room: 'Kitchen' }, { id: 'B', ...g(39, 36), room: 'Dining Room' }], rooms: ['Kitchen', 'Dining Room'] },
      { name: 'Garage / Living Room', bombs: [{ id: 'A', ...g(20, 20), room: 'Garage' }, { id: 'B', ...g(22, 33), room: 'Living Room' }], rooms: ['Garage', 'Living Room'] },
      { name: '2F Master / Kids Room', bombs: [{ id: 'A', ...u(22, 34), room: 'Master Bedroom' }, { id: 'B', ...u(20, 17), room: 'Kids Room' }], rooms: ['Master Bedroom', 'Kids Room'] },
      { name: '2F Study / Guest Room', bombs: [{ id: 'A', ...u(42, 18), room: 'Study' }, { id: 'B', ...u(47, 29), room: 'Guest Room' }], rooms: ['Study', 'Guest Room'] },
    ],
    cams: [g(31, 26), g(31, 44), u(31, 24), g(57, 24), g(5, 25), g(20, 5)],
    atkSpawns: [
      { name: 'Maple Street', ...g(31, 48) }, { name: 'Driveway', ...g(20, 3) },
      { name: 'Back Yard', ...g(59, 24) }, { name: 'Side Path', ...g(4, 25) },
    ],
  });
}
