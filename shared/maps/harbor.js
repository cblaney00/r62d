// "Harbor Office" — a two-storey office block with a garage, surrounded by a garden, a parking lot
// and a road. Stairs: one in the lobby, one in the meeting room, and an outside fire escape (east).
// The North Wing (he asked for bigger maps that are not rectangles) runs north from the east half and turns west,
// so the building hooks round a loading yard; it has its own stairs in the security office.
import { T, FL, MAT } from '../constants.js';
import { makeMap } from '../mapkit.js';

export function build() {
  const { kits: [G, U], stair, finish } = makeMap({ id: 'harbor', name: 'Harbor Office', floors: [
    { name: '1F', x0: 0, y0: -40, w: 84, h: 100, ground: true },
    { name: '2F', x0: 9, y0: -33, w: 66, h: 86 },
  ] });

  // ================= 1F =================
  G.ground(0, 52, 84, 6, FL.ASPHALT);      // road
  G.ground(74, 8, 10, 44, FL.ASPHALT);     // east parking
  G.ground(15, -13, 29, 22, FL.ASPHALT);   // loading yard between the wings
  G.ground(0, -40, 84, 6, FL.ASPHALT);     // service road along the north
  G.ground(24, 49, 3, 3, FL.CONCRETE);     // path to main entrance
  G.ground(52, 49, 7, 3, FL.CONCRETE);     // garage driveway

  G.room('West Office', 13, 11, 15, 11, FL.WOOD);
  G.room('Server Room', 29, 11, 13, 11, FL.SERVER);
  G.room('Archive', 43, 11, 13, 11, FL.CARPET);
  G.room('East Office', 57, 11, 14, 11, FL.WOOD);
  G.room('Main Hall', 13, 23, 58, 5, FL.MARBLE);
  G.room('Kitchen', 13, 29, 13, 11, FL.TILE);
  G.room('Lounge', 27, 29, 17, 11, FL.CARPET);
  G.room('Bathroom', 45, 29, 7, 11, FL.TILE);
  G.room('Meeting Room', 53, 29, 18, 11, FL.WOOD);
  G.room('Lobby', 13, 41, 27, 8, FL.MARBLE);
  G.room('Garage', 41, 41, 30, 8, FL.CONCRETE);

  G.box(12, 10, 71, 49, T.SOFT, MAT.BRICK);
  G.wall(13, 22, 70, 22); G.wall(13, 28, 70, 28); G.wall(13, 40, 70, 40);
  G.wall(28, 11, 28, 21); G.wall(42, 11, 42, 21); G.wall(56, 11, 56, 21);
  G.wall(26, 29, 26, 39); G.wall(44, 29, 44, 39); G.wall(52, 29, 52, 39);
  G.wall(40, 41, 40, 48, T.HARD, MAT.CONCRETE);        // lobby / garage firewall
  G.wall(45, 40, 51, 40, T.HARD, MAT.CONCRETE);        // bathroom plumbing wall
  G.wall(29, 10, 41, 10, T.HARD, MAT.CONCRETE);        // server room outer wall
  G.pillar([[12, 10], [71, 10], [12, 49], [71, 49], [12, 22], [12, 28], [12, 40], [71, 22], [71, 28], [71, 40],
    [28, 10], [42, 10], [56, 10], [28, 22], [42, 22], [56, 22], [26, 28], [44, 28], [52, 28], [26, 40], [44, 40], [52, 40],
    [40, 40], [40, 49], [24, 10], [62, 49], [32, 49], [12, 34], [71, 34], [71, 16]]);

  G.door(24, 49, 26, 49, true);    // main entrance
  G.door(52, 49, 58, 49, true);    // garage shutter
  G.window(18, 10, 19, 10);
  G.window(71, 32, 71, 33); G.window(12, 15, 12, 16);
  G.door(12, 31, 12, 32, true);    // kitchen back door
  G.door(12, 24, 12, 26, true);    // west hall door
  G.door(71, 24, 71, 26, true);    // east hall door
  G.door(20, 22, 21, 22); G.door(34, 22, 35, 22); G.door(49, 22, 50, 22); G.door(63, 22, 64, 22);
  G.door(42, 15, 42, 16); G.door(28, 18, 28, 19);
  G.door(18, 28, 19, 28); G.door(34, 28, 36, 28); G.door(47, 28, 48, 28); G.door(60, 28, 61, 28);
  G.door(26, 32, 26, 33); G.door(30, 40, 32, 40); G.door(18, 40, 19, 40); G.door(62, 40, 63, 40);
  G.door(40, 44, 40, 45); G.door(52, 36, 52, 37);

  G.prop('desk', 15, 13, 4, 2, T.LOW); G.prop('desk', 21, 13, 4, 2, T.LOW);
  G.prop('desk', 15, 17, 4, 2, T.LOW); G.prop('desk', 21, 17, 4, 2, T.LOW);
  G.prop('bookshelf', 13, 20, 4, 1, T.TALL);
  G.prop('rack', 31, 12, 1, 5, T.TALL); G.prop('rack', 34, 12, 1, 5, T.TALL); G.prop('rack', 38, 12, 1, 5, T.TALL);
  G.prop('console', 30, 20, 3, 1, T.LOW);
  G.prop('shelf', 44, 12, 9, 1, T.TALL); G.prop('shelf', 46, 15, 6, 1, T.TALL);
  G.prop('cabinet', 54, 18, 1, 3, T.TALL);
  G.prop('desk', 59, 13, 4, 2, T.LOW); G.prop('desk', 63, 16, 4, 2, T.LOW); G.prop('desk', 59, 18, 4, 2, T.LOW);
  G.prop('plant', 69, 20, 1, 1, T.TALL);
  G.prop('pillar', 30, 25, 1, 1, T.TALL); G.prop('pillar', 45, 25, 1, 1, T.TALL); G.prop('pillar', 58, 25, 1, 1, T.TALL);
  G.prop('bench', 38, 23, 3, 1, T.LOW);
  G.prop('counter', 14, 30, 10, 1, T.LOW); G.prop('island', 17, 34, 5, 2, T.LOW); G.prop('fridge', 24, 30, 1, 2, T.TALL);
  G.prop('couch', 29, 31, 5, 1, T.LOW); G.prop('couch', 29, 36, 1, 3, T.LOW, 1);
  G.prop('coffeetable', 31, 34, 3, 2, T.LOW); G.prop('tv', 40, 30, 3, 1, T.TALL);
  G.prop('stall', 50, 30, 1, 3, T.TALL); G.prop('stall', 50, 33, 1, 2, T.TALL); G.prop('sink', 45, 37, 2, 1, T.LOW);
  G.prop('meetingtable', 55, 32, 9, 4, T.LOW);
  G.prop('reception', 20, 43, 6, 1, T.LOW); G.prop('chairs', 31, 45, 1, 2, T.LOW);
  G.prop('plant', 14, 42, 1, 1, T.TALL);
  G.prop('car', 44, 42, 3, 6, T.TALL); G.prop('car', 64, 43, 3, 5, T.TALL); G.prop('crates', 68, 42, 2, 2, T.TALL);
  G.prop('workbench', 49, 42, 5, 1, T.LOW);
  G.prop('car', 6, 53, 6, 3, T.TALL, 1); G.prop('car', 60, 54, 6, 3, T.TALL, 1); G.prop('van', 30, 53, 8, 3, T.TALL, 1);
  G.prop('car', 76, 20, 3, 6, T.TALL); G.prop('car', 76, 34, 3, 6, T.TALL); G.prop('car', 80, 12, 3, 6, T.TALL);
  G.prop('tree', 5, 5, 2, 2, T.TALL); G.prop('tree', 28, 3, 2, 2, T.TALL); G.prop('tree', 70, -8, 2, 2, T.TALL);
  G.prop('tree', 4, 44, 2, 2, T.TALL); G.prop('tree', 3, 18, 2, 2, T.TALL);
  G.prop('bush', 7, 26, 2, 2, T.LOW); G.prop('bush', 7, 37, 2, 2, T.LOW); G.prop('bush', 20, 6, 3, 2, T.LOW);
  G.prop('bush', 68, 3, 3, 2, T.LOW); G.prop('tree', 6, -20, 2, 2, T.TALL); G.prop('bush', 76, -24, 3, 2, T.LOW);
  G.prop('dumpster', 2, 30, 2, 3, T.TALL); G.prop('container', 30, -6, 6, 3, T.TALL, 1); G.prop('van', 22, -2, 8, 3, T.TALL, 1);
  G.prop('barrier', 14, 51, 6, 1, T.LOW, 1);

  // shapes: the building's north-east and south-west corners are cut off at an angle, and a few rooms get
  // rounded or angled corners (plastered structure, so they can't be blown open)
  G.outside([[65.2, 10], [72, 10], [72, 16.8]]); G.walls([[65.5, 10.5], [71.5, 16.5]], 1, T.SOFT, MAT.BRICK);
  G.outside([[12, 43.2], [12, 50], [18.8, 50]]); G.walls([[12.5, 43.5], [18.5, 49.5]], 1, T.SOFT, MAT.BRICK);
  G.round(13, 11, 3, 'se', T.HARD, MAT.DRYWALL);                                  // West Office
  G.round(13, 40, 3, 'ne', T.HARD, MAT.DRYWALL);                                  // Kitchen
  G.round(27, 40, 3, 'ne', T.HARD, MAT.DRYWALL); G.round(44, 40, 3, 'nw', T.HARD, MAT.DRYWALL); // Lounge
  G.chamfer(53, 29, 3, 'se', T.HARD, MAT.DRYWALL); G.chamfer(53, 40, 2, 'ne', T.HARD, MAT.DRYWALL); // Meeting Room
  G.chamfer(71, 49, 4, 'nw');                                                       // Garage

  G.decor((x, X, Y) => {
    x.fillStyle = 'rgba(230,190,60,0.8)';
    for (let px = 0; px < 84; px += 2.5) x.fillRect(X(px), Y(55) - 1, 22, 2);
    x.fillStyle = 'rgba(235,235,230,0.7)';
    x.fillRect(X(0), Y(52) + 3, X(84) - X(0), 1.2); x.fillRect(X(0), Y(58) - 4, X(84) - X(0), 1.2);
    for (let py = 9; py < 51; py += 3) x.fillRect(X(75), Y(py), X(83) - X(75), 1.2);
    for (let px = 17; px < 42; px += 2.5) x.fillRect(X(px), Y(-12), 1.2, Y(-6) - Y(-12));
    for (let px = 0; px < 84; px += 2.5) x.fillRect(X(px), Y(-37) - 1, 22, 2);
    for (const [sx, sy] of [[48, 45], [58, 44], [66, 46]]) {
      const g = x.createRadialGradient(X(sx), Y(sy), 0, X(sx), Y(sy), 22);
      g.addColorStop(0, 'rgba(20,20,25,0.45)'); g.addColorStop(1, 'rgba(20,20,25,0)');
      x.fillStyle = g; x.fillRect(X(sx) - 22, Y(sy) - 22, 44, 44);
    }
    x.fillStyle = '#2b2b2e'; x.fillRect(X(23.5), Y(47), X(27.5) - X(23.5), Y(48.6) - Y(47));
    x.fillStyle = 'rgba(230,190,50,0.55)';
    for (const bx of [43, 63]) { x.fillRect(X(bx) - 4, Y(41.5), 1.5, Y(48.5) - Y(41.5)); x.fillRect(X(bx + 4) + 2, Y(41.5), 1.5, Y(48.5) - Y(41.5)); }
  });

  // ---- North Wing (1F): a north arm (x 45-63) and a west arm along the top (y -29..-15)
  G.room('Loading Bay', 45, -6, 19, 16, FL.CONCRETE);
  G.room('Mail Room', 45, -18, 9, 11, FL.TILE);
  G.room('Security Office', 55, -18, 9, 11, FL.WOOD);
  G.room('Canteen', 45, -29, 19, 10, FL.TILE);
  G.room('Gym', 15, -29, 14, 15, FL.WOOD);
  G.room('Showers', 30, -29, 6, 15, FL.TILE);
  G.room('Print Shop', 37, -29, 7, 15, FL.CONCRETE);
  G.box(44, -30, 64, 10, T.SOFT, MAT.BRICK); G.box(14, -30, 44, -14, T.SOFT, MAT.BRICK);
  G.wall(45, -7, 63, -7); G.wall(45, -19, 63, -19); G.wall(54, -18, 54, -8);
  G.wall(29, -29, 29, -15); G.wall(36, -29, 36, -15, T.HARD, MAT.CONCRETE);
  G.pillar([[44, -30], [64, -30], [14, -30], [14, -14], [44, -14], [44, 10], [64, 10], [44, -7], [64, -7], [44, -19], [64, -19], [54, -7], [54, -19], [29, -30], [29, -14], [36, -30], [36, -14]]);
  G.door(44, 0, 44, 5, true);          // loading bay shutter onto the yard
  G.door(62, 10, 63, 10);              // loading bay -> East Office
  G.door(64, -3, 64, -2, true);        // loading bay side door (east)
  G.door(49, -7, 50, -7); G.door(59, -7, 60, -7); G.door(54, -14, 54, -13);
  G.door(49, -19, 50, -19); G.door(58, -19, 59, -19);
  G.door(44, -25, 44, -24); G.door(32, -19, 33, -19, false);
  G.door(29, -24, 29, -23); G.door(39, -14, 40, -14, true); G.door(20, -14, 21, -14, true);
  G.door(52, -30, 54, -30, true);      // canteen north doors onto the service road
  G.window(14, -24, 14, -23); G.window(24, -30, 25, -30); G.window(64, -24, 64, -23); G.window(64, -14, 64, -13); G.window(58, -30, 59, -30);
  G.prop('crates', 47, -4, 2, 2, T.TALL); G.prop('crates', 47, 4, 3, 2, T.TALL); G.prop('shelf', 61, -5, 1, 7, T.TALL);
  G.prop('workbench', 52, 7, 5, 1, T.LOW); G.prop('crates', 56, -1, 2, 2, T.TALL);
  G.prop('shelf', 46, -17, 1, 6, T.TALL); G.prop('counter', 48, -10, 5, 1, T.LOW);
  G.prop('desk', 56, -17, 3, 2, T.LOW); G.prop('console', 62, -12, 1, 3, T.LOW);
  G.prop('counter', 46, -28, 9, 1, T.LOW); G.prop('island', 48, -24, 5, 2, T.LOW); G.prop('chairs', 57, -26, 1, 3, T.LOW); G.prop('chairs', 60, -26, 1, 3, T.LOW);
  G.prop('bench', 17, -27, 4, 1, T.LOW); G.prop('bench', 17, -18, 4, 1, T.LOW); G.prop('rack', 26, -28, 2, 1, T.TALL);
  G.prop('locker', 31, -28, 4, 1, T.TALL); G.prop('stall', 34, -22, 1, 3, T.TALL);
  G.prop('workbench', 38, -28, 5, 1, T.LOW); G.prop('shelf', 42, -24, 1, 6, T.TALL);
  G.chamfer(15, -29, 3, 'se', T.HARD, MAT.DRYWALL); G.round(63, -29, 3, 'sw', T.HARD, MAT.DRYWALL);
  G.outside([[14, -18.6], [14, -13], [19.6, -13]]); G.walls([[14.5, -18.5], [19.5, -13.5]], 1, T.SOFT, MAT.BRICK); // angled corner on the yard

  // ================= 2F =================
  U.slab(72, 33, 2, 14, FL.CONCRETE);                 // fire-escape landing outside the east wall
  U.room('2F Corridor', 13, 23, 58, 5, FL.CARPET);
  U.room('2F Executive Office', 13, 11, 15, 11, FL.WOOD);
  U.room('2F Boardroom', 29, 11, 20, 11, FL.CARPET);
  U.room('2F IT Room', 50, 11, 21, 11, FL.SERVER);
  U.room('2F Open Office', 13, 29, 30, 20, FL.CARPET);
  U.room('2F Break Room', 44, 29, 12, 9, FL.TILE);
  U.room('2F Records', 57, 29, 14, 9, FL.WOOD);
  U.room('2F Storage Loft', 44, 39, 27, 10, FL.CONCRETE);

  U.box(12, 10, 71, 49, T.SOFT, MAT.BRICK);
  U.wall(13, 22, 70, 22); U.wall(13, 28, 70, 28);
  U.wall(28, 11, 28, 21); U.wall(49, 11, 49, 21); // drywall: the two site rooms always share a breakable wall (he asked)
  U.wall(43, 29, 43, 48); U.wall(56, 29, 56, 37); U.wall(44, 38, 70, 38);
  U.pillar([[12, 10], [71, 10], [12, 49], [71, 49], [12, 22], [12, 28], [71, 22], [71, 28], [28, 22], [49, 22], [43, 28], [56, 28], [43, 38], [56, 38], [43, 49], [28, 10], [49, 10]]);
  U.door(20, 22, 21, 22); U.door(38, 22, 39, 22); U.door(60, 22, 61, 22); U.door(28, 15, 28, 16);
  U.door(27, 28, 29, 28); U.door(49, 28, 50, 28); U.door(63, 28, 64, 28);
  U.door(56, 33, 56, 34); U.door(43, 33, 43, 34); U.door(43, 44, 43, 45);
  U.door(50, 38, 51, 38); U.door(65, 38, 66, 38);
  U.door(71, 35, 71, 36, true);                        // fire-escape door into Records
  U.window(18, 10, 19, 10); U.window(34, 10, 35, 10); /* moved off the bookcases so it can be used */
  U.window(12, 15, 12, 16); U.window(12, 36, 12, 37); U.window(71, 31, 71, 32);
  U.window(25, 49, 26, 49); U.window(58, 49, 59, 49);

  U.prop('desk', 15, 13, 5, 2, T.LOW); U.prop('bookshelf', 13, 20, 5, 1, T.TALL); U.prop('cabinet', 26, 12, 1, 3, T.TALL);
  U.prop('meetingtable', 33, 14, 11, 4, T.LOW); U.prop('tv', 37, 11, 4, 1, T.TALL);
  U.prop('rack', 53, 12, 1, 6, T.TALL); U.prop('rack', 57, 12, 1, 6, T.TALL); U.prop('rack', 61, 12, 1, 6, T.TALL);
  U.prop('console', 66, 19, 3, 1, T.LOW);
  U.prop('pillar', 34, 25, 1, 1, T.TALL); U.prop('pillar', 54, 25, 1, 1, T.TALL);
  for (const [dx, dy] of [[15, 31], [21, 31], [27, 31], [15, 37], [21, 37], [27, 37]]) U.prop('desk', dx, dy, 4, 2, T.LOW);
  U.prop('plant', 14, 42, 1, 1, T.TALL); U.prop('bookshelf', 41, 30, 1, 3, T.TALL);
  U.prop('counter', 45, 30, 8, 1, T.LOW); U.prop('fridge', 54, 30, 1, 2, T.TALL); U.prop('coffeetable', 47, 34, 3, 2, T.LOW);
  U.prop('shelf', 58, 30, 1, 6, T.TALL); U.prop('shelf', 61, 30, 1, 5, T.TALL);
  U.prop('crates', 46, 41, 2, 2, T.TALL); U.prop('crates', 53, 45, 3, 2, T.TALL); U.prop('shelf', 58, 40, 8, 1, T.TALL); U.prop('crates', 66, 45, 2, 2, T.TALL);

  U.outside([[65.2, 10], [72, 10], [72, 16.8]]); U.walls([[65.5, 10.5], [71.5, 16.5]], 1, T.SOFT, MAT.BRICK);
  U.outside([[12, 43.2], [12, 50], [18.8, 50]]); U.walls([[12.5, 43.5], [18.5, 49.5]], 1, T.SOFT, MAT.BRICK);
  U.arc(24, 46.5, 5, 180, 360, 0.7, T.SOFT);                                        // curved glass-walled booth in the open office
  U.chamfer(29, 11, 2, 'se', T.HARD, MAT.DRYWALL); U.chamfer(49, 11, 2, 'sw', T.HARD, MAT.DRYWALL); // Boardroom

  // ---- North Wing (2F)
  U.room('2F Drafting Hall', 45, -6, 19, 16, FL.WOOD);
  U.room('2F Lab', 45, -18, 9, 11, FL.TILE);
  U.room('2F Landing', 55, -18, 9, 11, FL.CARPET);
  U.room('2F Roof Lounge', 45, -29, 19, 10, FL.CARPET);
  U.room('2F Studio', 15, -29, 14, 15, FL.WOOD);
  U.room('2F Copy Room', 30, -29, 14, 15, FL.CARPET);
  U.box(44, -30, 64, 10, T.SOFT, MAT.BRICK); U.box(14, -30, 44, -14, T.SOFT, MAT.BRICK);
  U.wall(45, -7, 63, -7); U.wall(45, -19, 63, -19); U.wall(54, -18, 54, -8); U.wall(29, -29, 29, -15);
  U.pillar([[44, -30], [64, -30], [14, -30], [14, -14], [44, -14], [44, 10], [64, 10], [44, -7], [64, -7], [44, -19], [64, -19], [54, -7], [54, -19], [29, -30], [29, -14]]);
  U.door(59, 10, 60, 10); // the North Wing's door into the IT room
  U.door(49, -7, 50, -7); U.door(60, -7, 61, -7); U.door(54, -12, 54, -11);
  U.door(48, -19, 49, -19); U.door(58, -19, 59, -19); U.door(44, -24, 44, -23); U.door(29, -22, 29, -21);
  U.window(44, 2, 44, 3); U.window(64, -2, 64, -1); U.window(64, -25, 64, -24); U.window(20, -14, 21, -14); U.window(36, -14, 37, -14);
  U.window(14, -23, 14, -22); U.window(50, -30, 51, -30); U.window(22, -30, 23, -30);
  for (const [dx, dy] of [[47, -4], [53, -4], [47, 2], [53, 2]]) U.prop('desk', dx, dy, 4, 2, T.LOW);
  U.prop('shelf', 62, -5, 1, 6, T.TALL); U.prop('console', 46, -17, 1, 4, T.LOW); U.prop('shelf', 50, -9, 3, 1, T.TALL);
  U.prop('couch', 47, -27, 5, 1, T.LOW); U.prop('coffeetable', 48, -25, 3, 2, T.LOW); U.prop('plant', 59, -28, 1, 1, T.TALL);
  U.prop('desk', 17, -27, 4, 2, T.LOW); U.prop('desk', 22, -22, 4, 2, T.LOW); U.prop('cabinet', 27, -28, 1, 3, T.TALL);
  U.prop('console', 32, -27, 4, 1, T.LOW); U.prop('shelf', 39, -20, 4, 1, T.TALL);
  U.chamfer(15, -29, 3, 'se', T.HARD, MAT.DRYWALL); U.round(63, -29, 3, 'sw', T.HARD, MAT.DRYWALL);
  U.outside([[14, -18.6], [14, -13], [19.6, -13]]); U.walls([[14.5, -18.5], [19.5, -13.5]], 1, T.SOFT, MAT.BRICK);

  // ================= stairs =================
  stair(0, 1, 58, -16, 3, 6, 'n', FL.WOOD);          // North Wing: security office -> 2F landing
  G.prop('railing', 57, -17, 1, 6, T.LOW); G.prop('railing', 61, -17, 1, 6, T.LOW); G.prop('railing', 58, -17, 3, 1, T.LOW);
  U.prop('railing', 57, -15, 1, 6, T.LOW); U.prop('railing', 61, -15, 1, 6, T.LOW); U.prop('railing', 58, -10, 3, 1, T.LOW);
  stair(0, 1, 36, 42, 3, 6, 'n', FL.MARBLE);          // lobby -> open office
  G.prop('railing', 35, 41, 1, 6, T.LOW); G.prop('railing', 39, 41, 1, 6, T.LOW); G.prop('railing', 36, 41, 3, 1, T.LOW);
  U.prop('railing', 35, 43, 1, 6, T.LOW); U.prop('railing', 39, 43, 1, 6, T.LOW); U.prop('railing', 36, 48, 3, 1, T.LOW);
  stair(0, 1, 67, 30, 3, 6, 'n', FL.WOOD);            // meeting room -> records
  G.prop('railing', 66, 29, 1, 6, T.LOW); G.prop('railing', 67, 29, 3, 1, T.LOW);
  U.prop('railing', 66, 31, 1, 6, T.LOW); U.prop('railing', 67, 36, 3, 1, T.LOW);
  stair(0, 1, 72, 39, 2, 6, 'n', FL.CONCRETE);        // outside fire escape -> 2F landing
  G.prop('railing', 72, 38, 2, 1, T.LOW);
  U.prop('railing', 72, 45, 2, 1, T.LOW);

  const g = G.c, u = U.c;
  return finish({
    sites: [
      { name: 'Server Room / Archive', bombs: [{ id: 'A', ...g(32, 19), room: 'Server Room' }, { id: 'B', ...g(48, 19), room: 'Archive' }], rooms: ['Server Room', 'Archive'] },
      { name: 'Kitchen / Lounge', bombs: [{ id: 'A', ...g(15, 37), room: 'Kitchen' }, { id: 'B', ...g(38, 35), room: 'Lounge' }], rooms: ['Kitchen', 'Lounge'] },
      { name: '2F Boardroom / IT Room', bombs: [{ id: 'A', ...u(31, 19), room: '2F Boardroom' }, { id: 'B', ...u(66, 15), room: '2F IT Room' }], rooms: ['2F Boardroom', '2F IT Room'] },
    ],
    cams: [g(20, 24), g(52, 24), g(30, 47), g(60, 46), g(72, 8), u(40, 24), u(16, 47), g(52, 2), g(20, -20), u(56, -26)],
    atkSpawns: [
      { name: 'Loading Yard', ...g(26, -9) }, { name: 'West Garden', ...g(4, 26) }, { name: 'Service Road', ...g(54, -37) },
      { name: 'Front Road', ...g(22, 56) }, { name: 'East Parking', ...g(79, 30) },
    ],
  });
}
