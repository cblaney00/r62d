// "The Embassy" — a consulate around an open courtyard: basement vault, server farm and cells;
// reception and offices on the ground floor; the ambassador's floor above.
import { T, FL, MAT } from '../constants.js';
import { makeMap } from '../mapkit.js';

export function build() {
  const { kits: [B, G, U], stair, finish } = makeMap({ id: 'embassy', name: 'The Embassy', floors: [
    { name: 'B', x0: 6, y0: 8, w: 62, h: 40 },
    { name: '1F', x0: 0, y0: 0, w: 76, h: 58, ground: true },
    { name: '2F', x0: 10, y0: 8, w: 58, h: 40 },
  ] });

  // ================= 1F =================
  G.ground(30, 0, 16, 10, FL.MARBLE);       // front plaza
  G.ground(0, 50, 76, 8, FL.ASPHALT);       // south street
  G.ground(66, 10, 10, 40, FL.ASPHALT);     // east lot
  G.ground(2, 10, 8, 10, FL.CONCRETE);      // garage ramp apron
  G.area('Waiting Room', 13, 11, 16, 12, FL.CARPET);
  G.area('Reception Hall', 30, 11, 16, 12, FL.MARBLE);
  G.area('Security Office', 47, 11, 16, 12, FL.TILE);
  G.area('Grand Corridor', 13, 24, 50, 4, FL.MARBLE);
  G.area('Visa Office', 13, 29, 16, 16, FL.WOOD);
  G.area('Courtyard', 30, 29, 16, 16, FL.GRASS);
  G.area('Archives', 47, 29, 16, 8, FL.CARPET);
  G.area('Mail Room', 47, 38, 16, 7, FL.CONCRETE);
  G.box(12, 10, 63, 45, T.SOFT, MAT.BRICK);
  G.pillar([[12, 10], [63, 10], [12, 45], [63, 45], [29, 10], [46, 10], [29, 45], [46, 45], [12, 23], [12, 28], [63, 23], [63, 28], [29, 23], [46, 23], [29, 28], [46, 28]]);
  G.door(36, 10, 38, 10, true); G.door(12, 25, 12, 26, true); G.door(63, 25, 63, 26, true); G.door(37, 45, 38, 45, true); G.door(58, 45, 60, 45, true);
  G.door(36, 23, 38, 23); G.door(29, 16, 29, 17); G.door(46, 16, 46, 17); G.door(20, 23, 21, 23); G.door(54, 23, 55, 23);
  G.door(20, 28, 21, 28); G.door(37, 28, 38, 28); G.door(54, 28, 55, 28); G.door(29, 36, 29, 37); G.door(46, 32, 46, 33);
  G.door(46, 40, 46, 41); G.door(54, 37, 55, 37);
  G.window(17, 10, 18, 10); G.window(24, 10, 25, 10); G.window(51, 10, 52, 10); G.window(58, 10, 59, 10); G.window(12, 18, 12, 19);
  G.window(12, 34, 12, 35); G.window(12, 40, 12, 41); G.window(63, 15, 63, 16); G.window(63, 32, 63, 33); G.window(18, 45, 19, 45); G.window(25, 45, 26, 45); G.window(50, 45, 51, 45);
  G.prop('chairs', 18, 15, 1, 4, T.LOW); G.prop('chairs', 22, 15, 1, 4, T.LOW); G.prop('plant', 27, 12, 1, 1, T.TALL);
  G.prop('reception', 33, 16, 10, 1, T.LOW); G.prop('pillar', 31, 13, 1, 1, T.TALL); G.prop('pillar', 44, 13, 1, 1, T.TALL);
  G.prop('console', 48, 12, 8, 1, T.LOW); G.prop('desk', 49, 16, 4, 2, T.LOW); G.prop('locker', 61, 13, 1, 8, T.TALL);
  G.prop('bench', 25, 25, 4, 1, T.LOW); G.prop('bench', 47, 25, 4, 1, T.LOW); G.prop('plant', 35, 24, 1, 1, T.TALL); G.prop('plant', 41, 24, 1, 1, T.TALL);
  G.prop('desk', 18, 30, 4, 2, T.LOW); G.prop('desk', 23, 30, 4, 2, T.LOW); G.prop('desk', 18, 34, 4, 2, T.LOW); G.prop('cabinet', 27, 34, 1, 4, T.TALL);
  G.prop('tree', 33, 32, 2, 2, T.TALL); G.prop('tree', 41, 39, 2, 2, T.TALL); G.prop('bench', 36, 36, 4, 1, T.LOW); G.prop('bush', 42, 31, 2, 2, T.LOW); G.prop('bush', 31, 41, 2, 2, T.LOW);
  G.prop('shelf', 48, 30, 1, 6, T.TALL); G.prop('shelf', 51, 30, 1, 6, T.TALL); G.prop('shelf', 54, 30, 1, 6, T.TALL);
  G.prop('workbench', 48, 39, 6, 1, T.LOW); G.prop('crates', 52, 42, 2, 2, T.TALL);
  G.prop('pillar', 32, 3, 1, 1, T.TALL); G.prop('pillar', 43, 3, 1, 1, T.TALL); G.prop('barrier', 33, 1, 10, 1, T.LOW);
  G.prop('car', 68, 14, 3, 6, T.TALL); G.prop('car', 68, 30, 3, 6, T.TALL); G.prop('van', 10, 52, 8, 3, T.TALL, 1); G.prop('car', 48, 52, 6, 3, T.TALL, 1);
  G.prop('tree', 4, 34, 2, 2, T.TALL); G.prop('tree', 20, 3, 2, 2, T.TALL); G.prop('tree', 54, 3, 2, 2, T.TALL); G.prop('bush', 4, 44, 3, 2, T.LOW);
  G.decor((x, X, Y) => {
    x.fillStyle = 'rgba(235,235,230,0.7)'; for (let px = 0; px < 76; px += 2.5) x.fillRect(X(px), Y(54) - 1, 20, 2);
    x.fillStyle = 'rgba(160,30,40,0.5)'; x.fillRect(X(35.5), Y(1.5), X(40.5) - X(35.5), Y(9.8) - Y(1.5)); // the red carpet
  });

  // ================= 2F =================
  U.slab(64, 21, 2, 10, FL.CONCRETE);                    // east balcony
  U.area('Conference Room', 13, 11, 16, 12, FL.CARPET);
  U.area('Ambassador Office', 30, 11, 16, 12, FL.WOOD);
  U.area('Comms Room', 47, 11, 16, 12, FL.SERVER);
  U.area('Upper Corridor', 13, 24, 50, 4, FL.CARPET);
  U.area('Residence', 13, 29, 16, 16, FL.WOOD);
  U.area('Library', 47, 29, 16, 8, FL.CARPET);
  U.area('Guest Suite', 47, 38, 16, 7, FL.CARPET);
  U.drop(30, 29, 16, 16);                                 // open to the sky above the courtyard
  U.box(12, 10, 63, 45, T.SOFT, MAT.BRICK);
  U.wall(29, 28, 29, 45); U.wall(46, 28, 46, 45); U.wall(29, 28, 46, 28); U.wall(29, 45, 46, 45, T.SOFT, MAT.BRICK);
  U.door(29, 16, 29, 17); U.door(36, 23, 38, 23); U.door(20, 23, 21, 23); U.door(54, 23, 55, 23);
  U.door(20, 28, 21, 28); U.door(54, 28, 55, 28); U.door(54, 37, 55, 37); U.door(63, 25, 63, 26, true);
  U.window(29, 33, 29, 34); U.window(46, 33, 46, 34); U.window(37, 28, 38, 28); U.window(29, 40, 29, 41); U.window(46, 41, 46, 42);
  U.window(17, 10, 18, 10); U.window(36, 10, 39, 10); U.window(58, 10, 59, 10); U.window(12, 15, 12, 16); U.window(12, 36, 12, 37);
  U.window(63, 15, 63, 16); U.window(63, 34, 63, 35); U.window(20, 45, 21, 45); U.window(54, 45, 55, 45);
  U.prop('meetingtable', 18, 14, 9, 4, T.LOW); U.prop('tv', 27, 12, 1, 4, T.TALL);
  U.prop('desk', 35, 15, 6, 2, T.LOW); U.prop('bookshelf', 31, 12, 1, 6, T.TALL); U.prop('couch', 32, 20, 6, 1, T.LOW); U.prop('plant', 44, 12, 1, 1, T.TALL);
  U.prop('rack', 49, 12, 1, 7, T.TALL); U.prop('rack', 52, 12, 1, 7, T.TALL); U.prop('console', 56, 13, 6, 1, T.LOW); U.prop('console', 56, 19, 6, 1, T.LOW);
  U.prop('bench', 25, 25, 4, 1, T.LOW); U.prop('plant', 46, 24, 1, 1, T.TALL);
  U.prop('bed', 21, 31, 6, 7, T.LOW); U.prop('couch', 14, 40, 6, 1, T.LOW); U.prop('coffeetable', 15, 36, 3, 2, T.LOW); U.prop('cabinet', 27, 41, 1, 3, T.TALL);
  U.prop('bookshelf', 48, 30, 10, 1, T.TALL); U.prop('bookshelf', 48, 34, 7, 1, T.TALL);
  U.prop('bed', 49, 39, 5, 5, T.LOW); U.prop('cabinet', 56, 39, 2, 1, T.TALL);

  // ================= B =================
  B.area('Garage', 13, 11, 16, 12, FL.CONCRETE);
  B.area('Vault', 30, 11, 16, 12, FL.SERVER, T.HARD, MAT.CONCRETE);
  B.area('Server Farm', 47, 11, 16, 12, FL.SERVER);
  B.area('Tunnel', 13, 24, 50, 4, FL.CONCRETE);
  B.area('Boiler Room', 13, 29, 16, 16, FL.CONCRETE);
  B.area('Evidence Storage', 30, 29, 16, 16, FL.CONCRETE);
  B.area('Cell Block', 47, 29, 16, 16, FL.TILE);
  B.box(12, 10, 63, 45, T.HARD, MAT.CONCRETE);
  B.door(12, 13, 12, 15, true);                          // garage door onto the ramp
  B.door(20, 23, 21, 23); B.door(37, 23, 38, 23); B.door(54, 23, 55, 23); B.door(29, 16, 29, 17); B.door(46, 16, 46, 17);
  B.door(20, 28, 21, 28); B.door(37, 28, 38, 28); B.door(54, 28, 55, 28); B.door(29, 36, 29, 37); B.door(46, 36, 46, 37);
  B.prop('car', 15, 12, 3, 6, T.TALL); B.prop('car', 21, 13, 3, 6, T.TALL); B.prop('crates', 26, 20, 2, 2, T.TALL);
  B.prop('cabinet', 31, 12, 14, 1, T.TALL); B.prop('cabinet', 31, 21, 5, 1, T.TALL); B.prop('cabinet', 40, 21, 5, 1, T.TALL); B.prop('tank', 36, 15, 4, 4, T.TALL);
  for (const rx of [49, 52, 55, 58]) B.prop('rack', rx, 12, 1, 8, T.TALL);
  B.prop('tank', 15, 31, 4, 4, T.TALL); B.prop('tank', 21, 31, 4, 3, T.TALL); B.prop('console', 22, 42, 5, 1, T.LOW);
  B.prop('shelf', 31, 30, 1, 7, T.TALL); B.prop('shelf', 34, 30, 1, 7, T.TALL); B.prop('crates', 40, 31, 3, 2, T.TALL); B.prop('crates', 33, 40, 2, 2, T.TALL);
  for (const cx of [48, 52]) { B.wall(cx + 3, 39, cx + 3, 44, T.SOFT); B.prop('bench', cx, 43, 2, 1, T.LOW); }
  B.wall(48, 38, 55, 38, T.SOFT); B.door(49, 38, 49, 38); B.door(53, 38, 53, 38);

  // ================= stairs =================
  stair(1, 2, 14, 14, 2, 6, 'n', FL.CARPET);             // waiting room -> conference room
  G.prop('railing', 16, 13, 1, 7, T.LOW); G.prop('railing', 14, 13, 2, 1, T.LOW);
  U.prop('railing', 16, 15, 1, 6, T.LOW); U.prop('railing', 14, 20, 2, 1, T.LOW);
  stair(1, 2, 60, 31, 2, 4, 'n', FL.WOOD);               // archives -> library
  G.prop('railing', 59, 30, 1, 5, T.LOW); G.prop('railing', 60, 30, 2, 1, T.LOW);
  U.prop('railing', 59, 32, 1, 3, T.LOW); U.prop('railing', 60, 35, 2, 1, T.LOW);
  stair(0, 1, 14, 37, 2, 6, 'n', FL.CONCRETE);           // boiler room -> visa office
  B.prop('railing', 16, 36, 1, 7, T.LOW); B.prop('railing', 14, 36, 2, 1, T.LOW);
  G.prop('railing', 16, 38, 1, 6, T.LOW); G.prop('railing', 14, 43, 2, 1, T.LOW);
  stair(0, 1, 60, 40, 2, 3, 'n', FL.CONCRETE);           // cell block -> mail room
  B.prop('railing', 59, 39, 1, 4, T.LOW); B.prop('railing', 60, 39, 2, 1, T.LOW);
  G.prop('railing', 59, 41, 1, 2, T.LOW); G.prop('railing', 60, 43, 2, 1, T.LOW);
  stair(0, 1, 8, 13, 4, 3, 'w', FL.CONCRETE);            // garage ramp (outside, west)
  G.prop('railing', 8, 12, 4, 1, T.LOW); G.prop('railing', 8, 16, 4, 1, T.LOW);
  stair(1, 2, 64, 31, 2, 6, 'n', FL.CONCRETE);           // outside steps -> east balcony
  G.prop('railing', 64, 30, 2, 1, T.LOW);
  U.prop('railing', 64, 37, 2, 1, T.LOW);

  const b = B.c, g = G.c, u = U.c;
  return finish({
    sites: [
      { name: 'B Vault / Server Farm', bombs: [{ id: 'A', ...b(42, 16), room: 'Vault' }, { id: 'B', ...b(60, 18), room: 'Server Farm' }], rooms: ['Vault', 'Server Farm'] },
      { name: 'Reception Hall / Security Office', bombs: [{ id: 'A', ...g(38, 20), room: 'Reception Hall' }, { id: 'B', ...g(56, 19), room: 'Security Office' }], rooms: ['Reception Hall', 'Security Office'] },
      { name: 'Archives / Mail Room', bombs: [{ id: 'A', ...g(57, 33), room: 'Archives' }, { id: 'B', ...g(55, 42), room: 'Mail Room' }], rooms: ['Archives', 'Mail Room'] },
      { name: '2F Ambassador Office / Comms Room', bombs: [{ id: 'A', ...u(42, 18), room: 'Ambassador Office' }, { id: 'B', ...u(59, 16), room: 'Comms Room' }], rooms: ['Ambassador Office', 'Comms Room'] },
    ],
    cams: [g(38, 6), g(30, 25), g(38, 37), u(40, 25), b(38, 25), g(70, 25)],
    atkSpawns: [
      { name: 'Main Gate', ...g(38, 3) }, { name: 'West Street', ...g(3, 30) },
      { name: 'East Lot', ...g(71, 45) }, { name: 'South Street', ...g(30, 55) },
    ],
  });
}
