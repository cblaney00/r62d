// "Cliffside Villa" — a luxury house on a cliff: basement (wine cellar, garage, panic room),
// ground floor and bedrooms upstairs. Pool terrace to the south, driveway to the north-east.
import { T, FL, MAT } from '../constants.js';
import { makeMap } from '../mapkit.js';

export function build() {
  const { kits: [B, G, U], stair, finish } = makeMap({ id: 'villa', name: 'Cliffside Villa', floors: [
    { name: 'B', x0: 8, y0: 6, w: 60, h: 38 },
    { name: '1F', x0: 0, y0: 0, w: 72, h: 54, ground: true },
    { name: '2F', x0: 8, y0: 6, w: 56, h: 46 },
  ] });

  // ================= 1F =================
  G.ground(40, 0, 32, 7, FL.ASPHALT);        // driveway
  G.ground(62, 7, 10, 9, FL.CONCRETE);       // garage ramp apron
  G.ground(10, 43, 52, 9, FL.MARBLE);        // pool terrace
  G.ground(33, 3, 6, 5, FL.CONCRETE);        // front path
  G.area('Foyer', 30, 9, 12, 8, FL.MARBLE);
  G.area('Living Room', 11, 9, 18, 16, FL.WOOD);
  G.area('Dining Room', 43, 9, 18, 12, FL.WOOD);
  G.area('Hallway', 30, 18, 12, 7, FL.MARBLE);
  G.area('Kitchen', 43, 22, 18, 11, FL.TILE);
  G.area('Library', 11, 26, 18, 15, FL.CARPET);
  G.area('Garden Room', 30, 26, 12, 15, FL.TILE);
  G.area('Laundry', 43, 34, 9, 7, FL.TILE);
  G.area('Pantry', 53, 34, 8, 7, FL.TILE);
  G.box(10, 8, 61, 41, T.SOFT, MAT.BRICK);
  G.pillar([[10, 8], [61, 8], [10, 41], [61, 41], [29, 8], [42, 8], [29, 41], [42, 41], [10, 25], [61, 21], [61, 33], [29, 25], [42, 25], [42, 17], [29, 17]]);
  G.door(35, 8, 36, 8, true); G.door(35, 17, 36, 17); G.door(29, 12, 29, 13); G.door(42, 12, 42, 13);
  G.door(29, 21, 29, 22); G.door(42, 22, 42, 23); G.door(35, 25, 36, 25); G.door(19, 25, 20, 25);
  G.door(29, 33, 29, 34); G.door(42, 37, 42, 38); G.door(51, 21, 52, 21); G.door(46, 33, 47, 33); G.door(56, 33, 57, 33);
  G.door(61, 26, 61, 27, true); G.door(35, 41, 36, 41, true); G.door(10, 32, 10, 33, true);
  G.window(10, 14, 10, 15); G.window(10, 20, 10, 21); G.window(48, 8, 49, 8); G.window(55, 8, 56, 8);
  G.window(16, 8, 17, 8); G.window(23, 8, 24, 8); G.window(61, 17, 61, 18); G.window(16, 41, 17, 41);
  G.window(23, 41, 24, 41); G.window(31, 41, 32, 41); G.window(39, 41, 40, 41); G.window(47, 41, 47, 41); G.window(61, 30, 61, 31);
  G.prop('couch', 13, 12, 7, 2, T.LOW); G.prop('couch', 13, 15, 2, 5, T.LOW, 1); G.prop('coffeetable', 17, 15, 4, 3, T.LOW);
  G.prop('tv', 25, 13, 1, 4, T.TALL); G.prop('plant', 27, 23, 1, 1, T.TALL); G.prop('bookshelf', 12, 22, 6, 1, T.TALL);
  G.prop('reception', 32, 13, 3, 1, T.LOW); G.prop('plant', 31, 10, 1, 1, T.TALL); G.prop('plant', 40, 10, 1, 1, T.TALL);
  G.prop('meetingtable', 47, 12, 10, 4, T.LOW); G.prop('cabinet', 59, 10, 1, 4, T.TALL);
  G.prop('counter', 44, 23, 12, 1, T.LOW); G.prop('island', 48, 27, 7, 2, T.LOW); G.prop('fridge', 59, 23, 1, 2, T.TALL);
  G.prop('bookshelf', 12, 27, 1, 6, T.TALL); G.prop('bookshelf', 20, 27, 8, 1, T.TALL); G.prop('desk', 20, 33, 4, 2, T.LOW);
  G.prop('couch', 16, 38, 6, 1, T.LOW); G.prop('plant', 31, 27, 1, 1, T.TALL); G.prop('bench', 37, 30, 3, 1, T.LOW);
  G.prop('sink', 44, 39, 2, 1, T.LOW); G.prop('shelf', 49, 35, 1, 5, T.TALL); G.prop('shelf', 54, 35, 6, 1, T.TALL);
  G.prop('pool', 14, 44, 16, 6, T.LOW); G.prop('bench', 34, 46, 4, 1, T.LOW); G.prop('bench', 50, 46, 4, 1, T.LOW);
  G.prop('plant', 57, 44, 1, 1, T.TALL); G.prop('plant', 11, 44, 1, 1, T.TALL);
  G.prop('car', 46, 1, 6, 3, T.TALL, 1); G.prop('car', 56, 1, 6, 3, T.TALL, 1);
  G.prop('tree', 3, 4, 2, 2, T.TALL); G.prop('tree', 22, 2, 2, 2, T.TALL); G.prop('tree', 4, 46, 2, 2, T.TALL);
  G.prop('tree', 66, 46, 2, 2, T.TALL); G.prop('bush', 4, 22, 2, 2, T.LOW); G.prop('bush', 66, 30, 2, 2, T.LOW); G.prop('bush', 3, 34, 2, 2, T.LOW);
  G.prop('barrier', 0, 52, 72, 1, T.LOW);    // the cliff edge railing
  G.decor((x, X, Y) => { x.fillStyle = 'rgba(235,235,230,0.6)'; for (let px = 41; px < 71; px += 3) x.fillRect(X(px), Y(3.5), 18, 1.2); });

  // ================= 2F =================
  U.slab(30, 42, 18, 3, FL.WOOD);            // south balcony over the terrace
  U.area('Master Bedroom', 11, 9, 18, 14, FL.WOOD);
  U.area('Upper Landing', 30, 9, 12, 16, FL.CARPET);
  U.area('Guest Bedroom', 43, 9, 18, 11, FL.CARPET);
  U.area('Study', 43, 21, 18, 12, FL.WOOD);
  U.area('Kids Room', 11, 24, 18, 17, FL.CARPET);
  U.area('Gallery', 30, 26, 12, 15, FL.MARBLE);
  U.area('Walk-in Closet', 43, 34, 9, 7, FL.CARPET);
  U.area('Ensuite', 53, 34, 8, 7, FL.TILE);
  U.box(10, 8, 61, 41, T.SOFT, MAT.BRICK);
  U.pillar([[10, 8], [61, 8], [10, 41], [61, 41], [29, 8], [42, 8], [29, 41], [42, 41], [10, 23], [61, 20], [61, 33]]);
  U.door(29, 15, 29, 16); U.door(42, 12, 42, 13); U.door(42, 22, 42, 23); U.door(35, 25, 36, 25);
  U.door(29, 32, 29, 33); U.door(19, 23, 20, 23); U.door(47, 33, 48, 33); U.door(56, 33, 57, 33); U.door(51, 20, 52, 20); U.door(42, 37, 42, 38);
  U.door(35, 41, 36, 41, true);              // gallery onto the balcony
  U.window(16, 8, 17, 8); U.window(23, 8, 24, 8); U.window(48, 8, 49, 8); U.window(55, 8, 56, 8); U.window(10, 14, 10, 15);
  U.window(10, 31, 10, 32); U.window(61, 13, 61, 14); U.window(61, 26, 61, 27); U.window(16, 41, 17, 41); U.window(23, 41, 24, 41);
  U.prop('bed', 14, 11, 6, 7, T.LOW); U.prop('cabinet', 26, 10, 2, 1, T.TALL); U.prop('couch', 22, 20, 5, 1, T.LOW);
  U.prop('plant', 40, 10, 1, 1, T.TALL); U.prop('bench', 36, 16, 4, 1, T.LOW);
  U.prop('bed', 50, 11, 6, 6, T.LOW); U.prop('cabinet', 44, 10, 1, 3, T.TALL);
  U.prop('desk', 47, 24, 5, 2, T.LOW); U.prop('bookshelf', 44, 31, 10, 1, T.TALL); U.prop('couch', 56, 27, 1, 4, T.LOW, 1);
  U.prop('bed', 13, 27, 4, 6, T.LOW); U.prop('bed', 22, 27, 4, 6, T.LOW); U.prop('crates', 13, 37, 2, 2, T.LOW); U.prop('desk', 21, 38, 4, 2, T.LOW);
  U.prop('pillar', 33, 30, 1, 1, T.TALL); U.prop('pillar', 38, 30, 1, 1, T.TALL); U.prop('pillar', 33, 36, 1, 1, T.TALL); U.prop('pillar', 38, 36, 1, 1, T.TALL);
  U.prop('shelf', 50, 35, 1, 5, T.TALL); U.prop('stall', 59, 35, 1, 3, T.TALL); U.prop('sink', 54, 39, 2, 1, T.LOW);

  // ================= B =================
  B.area('Wine Cellar', 11, 9, 18, 14, FL.CONCRETE, T.HARD, MAT.CONCRETE);
  B.area('Garage', 30, 9, 31, 12, FL.CONCRETE);
  B.area('Mechanical Room', 11, 24, 18, 17, FL.CONCRETE);
  B.area('Storage', 30, 22, 16, 19, FL.CONCRETE);
  B.area('Panic Room', 47, 22, 14, 11, FL.SERVER, T.HARD, MAT.CONCRETE);
  B.area('Generator Room', 47, 34, 14, 7, FL.CONCRETE);
  B.box(10, 8, 61, 41, T.HARD, MAT.CONCRETE);
  B.door(29, 14, 29, 15); B.door(19, 23, 20, 23); B.door(37, 21, 38, 21); B.door(29, 30, 29, 31);
  B.door(46, 26, 46, 27); B.door(46, 37, 46, 38); B.door(53, 33, 54, 33); B.door(53, 21, 54, 21);
  B.door(61, 11, 61, 13, true);              // garage door onto the ramp
  B.prop('rack', 13, 11, 1, 10, T.TALL); B.prop('rack', 17, 11, 1, 10, T.TALL); B.prop('rack', 21, 11, 1, 10, T.TALL); B.prop('crates', 25, 19, 2, 2, T.TALL);
  B.prop('car', 33, 11, 3, 6, T.TALL); B.prop('car', 41, 11, 3, 6, T.TALL); B.prop('workbench', 50, 10, 6, 1, T.LOW); B.prop('crates', 57, 17, 2, 2, T.TALL);
  B.prop('tank', 13, 26, 4, 4, T.TALL); B.prop('tank', 20, 26, 3, 3, T.TALL); B.prop('console', 24, 38, 4, 1, T.LOW);
  B.prop('shelf', 31, 23, 1, 7, T.TALL); B.prop('crates', 39, 25, 3, 2, T.TALL); B.prop('crates', 41, 30, 2, 2, T.TALL);
  B.prop('console', 49, 23, 5, 1, T.LOW); B.prop('rack', 59, 24, 1, 5, T.TALL); B.prop('cabinet', 49, 30, 3, 1, T.TALL);
  B.prop('tank', 49, 36, 4, 3, T.TALL); B.prop('tank', 55, 36, 4, 3, T.TALL);

  // ================= stairs =================
  stair(1, 2, 30, 19, 2, 4, 'n', FL.WOOD);             // hallway -> upper landing
  G.prop('railing', 32, 18, 1, 5, T.LOW); G.prop('railing', 30, 18, 2, 1, T.LOW);
  U.prop('railing', 32, 19, 1, 4, T.LOW); U.prop('railing', 30, 23, 2, 1, T.LOW);
  stair(0, 1, 34, 32, 2, 6, 'n', FL.CONCRETE);         // storage -> garden room
  B.prop('railing', 33, 31, 1, 7, T.LOW); B.prop('railing', 36, 31, 1, 7, T.LOW); B.prop('railing', 34, 31, 2, 1, T.LOW);
  G.prop('railing', 33, 33, 1, 6, T.LOW); G.prop('railing', 36, 33, 1, 6, T.LOW); G.prop('railing', 34, 38, 2, 1, T.LOW);
  stair(0, 1, 12, 34, 2, 6, 'n', FL.CONCRETE);         // mechanical room -> library
  B.prop('railing', 14, 33, 1, 7, T.LOW); B.prop('railing', 12, 33, 2, 1, T.LOW);
  G.prop('railing', 14, 35, 1, 6, T.LOW); G.prop('railing', 12, 40, 2, 1, T.LOW);
  stair(0, 1, 62, 11, 4, 3, 'e', FL.CONCRETE);         // garage ramp (outside, east)
  G.prop('railing', 62, 10, 4, 1, T.LOW); G.prop('railing', 62, 14, 4, 1, T.LOW);
  stair(1, 2, 44, 43, 2, 6, 'n', FL.MARBLE);           // terrace steps -> balcony
  G.prop('railing', 43, 42, 1, 6, T.LOW); G.prop('railing', 46, 42, 1, 6, T.LOW); G.prop('railing', 44, 42, 2, 1, T.LOW);

  const b = B.c, g = G.c, u = U.c;
  return finish({
    sites: [
      { name: 'B Wine Cellar / Garage', bombs: [{ id: 'A', ...b(24, 15), room: 'Wine Cellar' }, { id: 'B', ...b(52, 15), room: 'Garage' }], rooms: ['Wine Cellar', 'Garage'] },
      { name: 'Kitchen / Dining Room', bombs: [{ id: 'A', ...g(52, 30), room: 'Kitchen' }, { id: 'B', ...g(52, 18), room: 'Dining Room' }], rooms: ['Kitchen', 'Dining Room'] },
      { name: 'Library / Garden Room', bombs: [{ id: 'A', ...g(24, 30), room: 'Library' }, { id: 'B', ...g(39, 37), room: 'Garden Room' }], rooms: ['Library', 'Garden Room'] },
      { name: '2F Master Bedroom / Kids Room', bombs: [{ id: 'A', ...u(24, 13), room: 'Master Bedroom' }, { id: 'B', ...u(17, 35), room: 'Kids Room' }], rooms: ['Master Bedroom', 'Kids Room'] },
    ],
    cams: [g(38, 11), g(66, 4), g(26, 47), u(40, 12), b(44, 39), b(59, 19)],
    atkSpawns: [
      { name: 'Driveway', ...g(66, 3) }, { name: 'Cliff Path', ...g(3, 28) },
      { name: 'Pool Terrace', ...g(36, 50) }, { name: 'Service Road', ...g(67, 40) },
    ],
  });
}
