// "Lantern Point" — the ZOMBIES map (he asked 2026-11-12: a New England harbour town like Provincetown, MA, with water,
// docks and a few buildings with several floors, about as big as the biggest map). Our own town, not any existing map.
// The players start in the Town Hall; the rest of town opens zone by zone with points (buyable doors and gates):
//   0 Town Hall (start)          — windows on the north, west and south sides, where the first zombies come in
//   1 Commercial Street (north)  — the Town Hall's front doors          750
//   2 Meeting House + West Lane  — the side door, or the churchyard gate 1000
//   3 Fish Market + Cannery      — the market's street door            1000
//   4 Bay Street + south town    — the barricade across the street     1250 (Gallery, Captain's Inn, cottages)
//   5 The docks + Lighthouse     — the harbour gate on Bay Street      1500 (power switch below, the Forge up top)
// Stone walls (hard) split the town; the sea runs down the east side and along the south, with two piers.
// Not in the normal map list (MAPS[...].zombie): only Zombies plays here.
import { T, FL, MAT, CELL } from '../constants.js';
import { makeMap } from '../mapkit.js';

const X1 = 150, Y1 = 124; // the town's own area (the sea fills the rest)

export function build() {
  const { kits: [G, U, A], stair, finish } = makeMap({ id: 'lantern', name: 'Lantern Point', floors: [
    { name: '1F', x0: 0, y0: 0, w: X1, h: Y1, ground: true },
    { name: '2F', x0: 6, y0: 29, w: 106, h: 74 },
    { name: '3F', x0: 60, y0: 58, w: 52, h: 44 },
  ] });

  // ================= ground =================
  G.ground(0, 0, X1, Y1, FL.GRASS);
  G.ground(50, 0, 12, 50, FL.ASPHALT);        // Commercial Street (north)
  G.ground(50, 51, 12, 57, FL.ASPHALT);       // Commercial Street (south)
  G.ground(0, 51, 120, 8, FL.ASPHALT);        // Bay Street
  G.ground(112, 0, 8, 108, FL.WOOD);          // the wharf boardwalk
  G.ground(92, 100, 20, 8, FL.SAND);          // the beach at the point
  G.ground(120, 34, 22, 4, FL.WOOD);          // North Pier
  G.ground(120, 72, 18, 4, FL.WOOD);          // South Pier
  G.ground(10, 23, 30, 7, FL.CONCRETE);       // churchyard path

  // ================= zone walls (stone, solid) =================
  const stone = (x0, y0, x1, y1) => G.wall(x0, y0, x1, y1, T.HARD, MAT.BRICK);
  stone(49, 0, 49, 30); stone(49, 47, 49, 50);   // Commercial Street | West Lane
  stone(62, 0, 62, 30); stone(62, 47, 62, 50);   // Commercial Street | Fish Market yard
  stone(0, 50, 119, 50);                         // the south of the north half
  stone(92, 51, 92, 107);                        // Bay Street | the docks
  G.door(49, 13, 49, 16, true);                  // Churchyard Gate (bought)
  G.door(54, 50, 57, 50, true);                  // Bay Street Barricade (bought)
  G.door(92, 53, 92, 56, true);                  // Harbour Gate (bought)

  // ================= zone 0: the Town Hall (start) =================
  G.room('Town Hall Lobby', 22, 32, 14, 14, FL.MARBLE);
  G.room('Council Chamber', 37, 32, 12, 14, FL.WOOD);
  G.box(21, 31, 49, 46, T.SOFT, MAT.BRICK);
  G.wall(36, 32, 36, 45);
  G.door(36, 37, 36, 39);
  G.door(49, 37, 49, 39, true);                  // Front Doors (bought) -> Commercial Street
  G.door(40, 31, 41, 31, true);                  // Side Door (bought) -> the churchyard
  G.window(21, 38, 21, 39); G.window(27, 31, 28, 31); G.window(26, 46, 27, 46); G.window(43, 46, 44, 46); // where they come in
  G.pillar([[21, 31], [49, 31], [21, 46], [49, 46], [36, 31], [36, 46]]);
  G.prop('reception', 28, 43, 5, 1, T.LOW); G.prop('bench', 31, 33, 4, 1, T.LOW); G.prop('plant', 34, 44, 1, 1, T.TALL);
  G.prop('meetingtable', 40, 36, 6, 4, T.LOW); G.prop('bookshelf', 47, 33, 1, 5, T.TALL); G.prop('cabinet', 38, 44, 3, 1, T.TALL);
  stair(0, 1, 23, 36, 2, 6, 'n', FL.WOOD); G.prop('railing', 25, 36, 1, 6, T.LOW); U.prop('railing', 25, 36, 1, 6, T.LOW);
  U.room('Records Office', 22, 32, 14, 14, FL.WOOD);
  U.room('Selectmen\'s Office', 37, 32, 12, 14, FL.CARPET);
  U.box(21, 31, 49, 46, T.SOFT, MAT.BRICK); U.wall(36, 32, 36, 45); U.door(36, 41, 36, 43);
  U.pillar([[21, 31], [49, 31], [21, 46], [49, 46], [36, 31], [36, 46]]);
  U.window(30, 31, 31, 31); U.window(43, 31, 44, 31); U.window(49, 36, 49, 37); U.window(30, 46, 31, 46);
  U.prop('bookshelf', 28, 33, 6, 1, T.TALL); U.prop('bookshelf', 28, 40, 6, 1, T.TALL); U.prop('desk', 41, 39, 4, 2, T.LOW); U.prop('cabinet', 47, 43, 1, 2, T.TALL);

  // ================= zone 1: Commercial Street (north) =================
  G.prop('lamp', 50, 8, 1, 1, T.TALL); G.prop('lamp', 61, 20, 1, 1, T.TALL); G.prop('lamp', 50, 32, 1, 1, T.TALL);
  G.prop('bench', 60, 10, 1, 3, T.LOW); G.prop('car', 51, 18, 3, 6, T.TALL); G.prop('planter', 58, 38, 2, 2, T.LOW); G.prop('barrels', 51, 44, 2, 2, T.TALL);

  // ================= zone 2: the Meeting House, churchyard and West Lane =================
  G.room('Meeting House Nave', 12, 6, 18, 16, FL.WOOD);
  G.room('Vestry', 31, 6, 8, 16, FL.CARPET);
  G.box(11, 5, 39, 22, T.SOFT, MAT.BRICK); G.wall(30, 6, 30, 21); G.door(30, 12, 30, 14);
  G.door(19, 22, 21, 22, true); G.door(39, 16, 39, 18, true);
  G.window(11, 10, 11, 11); G.window(24, 5, 25, 5); G.window(35, 5, 36, 5);
  G.pillar([[11, 5], [39, 5], [11, 22], [39, 22], [30, 5], [30, 22]]);
  for (let y = 8; y <= 18; y += 3) { G.prop('bench', 14, y, 5, 1, T.LOW); G.prop('bench', 22, y, 5, 1, T.LOW); }
  G.prop('counter', 33, 8, 4, 1, T.LOW); G.prop('cabinet', 37, 14, 1, 3, T.TALL);
  for (const [x, y] of [[4, 4], [6, 8], [4, 14], [7, 18], [42, 6], [45, 10], [42, 20], [46, 24]]) G.prop('grave', x, y, 1, 1, T.LOW);
  G.prop('tree', 2, 24, 2, 2, T.TALL); G.prop('tree', 44, 14, 2, 2, T.TALL); G.prop('hedge', 1, 31, 1, 6, T.TALL);
  // the cottage on West Lane
  G.room('Captain\'s Cottage', 4, 34, 12, 10, FL.WOOD);
  G.box(3, 33, 16, 44, T.SOFT, MAT.DRYWALL); G.door(16, 37, 16, 38, true); G.window(9, 33, 10, 33); G.window(9, 44, 10, 44);
  G.prop('bed', 5, 35, 3, 4, T.LOW); G.prop('coffeetable', 10, 39, 2, 2, T.LOW); G.prop('shelf', 14, 41, 1, 2, T.TALL);
  G.prop('barrels', 18, 47, 2, 2, T.TALL); G.prop('tree', 45, 48, 1, 1, T.TALL);

  // ================= zone 3: the Fish Market, the cannery and the north wharf =================
  G.room('Fish Market', 63, 32, 20, 14, FL.TILE);
  G.room('Ice Room', 84, 32, 8, 14, FL.CONCRETE);
  G.box(62, 31, 92, 46, T.SOFT, MAT.BRICK); G.wall(83, 32, 83, 45); G.door(83, 37, 83, 39);
  G.door(62, 37, 62, 39, true);                  // Fish Market Door (bought) <- Commercial Street
  G.door(92, 37, 92, 39, true);                  // out to the yard
  G.window(70, 31, 71, 31); G.window(88, 31, 89, 31); G.window(70, 46, 71, 46);
  G.pillar([[62, 31], [92, 31], [62, 46], [92, 46], [83, 31], [83, 46]]);
  G.prop('marketstall', 66, 35, 5, 1, T.LOW); G.prop('marketstall', 74, 35, 5, 1, T.LOW); G.prop('marketstall', 66, 41, 5, 1, T.LOW); G.prop('marketstall', 74, 41, 5, 1, T.LOW);
  G.prop('fridge', 86, 33, 4, 1, T.TALL); G.prop('crates', 89, 42, 2, 2, T.TALL);
  G.room('Cannery Floor', 94, 8, 14, 16, FL.CONCRETE);
  G.room('Smokehouse', 94, 25, 14, 9, FL.CONCRETE);
  G.box(93, 7, 108, 34, T.SOFT, MAT.BRICK); G.wall(94, 24, 107, 24); G.door(99, 24, 101, 24);
  G.door(108, 14, 108, 16, true); G.door(93, 28, 93, 29, true);
  G.window(100, 7, 101, 7); G.window(93, 14, 93, 15);
  G.pillar([[93, 7], [108, 7], [93, 34], [108, 34], [93, 24], [108, 24]]);
  G.prop('workbench', 96, 10, 1, 8, T.LOW); G.prop('tank', 101, 11, 3, 3, T.TALL); G.prop('rack', 106, 18, 1, 5, T.TALL); G.prop('barrels', 96, 29, 2, 2, T.TALL); G.prop('rack', 103, 27, 4, 1, T.TALL);
  G.prop('pots', 113, 8, 3, 3, T.TALL); G.prop('pots', 116, 40, 3, 2, T.TALL); G.prop('crates', 76, 22, 2, 2, T.TALL); G.prop('van', 70, 10, 3, 7, T.TALL);
  G.prop('dumpster', 86, 48, 3, 2, T.TALL); G.prop('boat', 122, 30, 3, 6, T.LOW); G.prop('lamp', 111, 33, 1, 1, T.TALL);

  // ================= zone 4: Bay Street, the Harbor Gallery, the Captain's Inn, the cottages =================
  G.room('Harbor Gallery', 8, 62, 22, 14, FL.WOOD);
  G.room('Studio', 8, 77, 22, 10, FL.CONCRETE);
  G.box(7, 61, 30, 87, T.SOFT, MAT.DRYWALL); G.wall(8, 76, 29, 76); G.door(13, 76, 15, 76);
  G.door(17, 61, 19, 61, true); G.door(30, 68, 30, 70, true);
  G.window(7, 66, 7, 67); G.window(7, 80, 7, 81); G.window(24, 87, 25, 87);
  G.pillar([[7, 61], [30, 61], [7, 87], [30, 87], [7, 76], [30, 76]]);
  G.prop('bench', 15, 67, 5, 1, T.LOW); G.prop('planter', 10, 64, 1, 1, T.LOW); G.prop('workbench', 9, 84, 6, 1, T.LOW); G.prop('rack', 19, 78, 1, 4, T.TALL);
  stair(0, 1, 26, 79, 2, 6, 'n', FL.WOOD);
  U.room('Sail Loft', 8, 62, 22, 25, FL.WOOD);
  U.box(7, 61, 30, 87, T.SOFT, MAT.DRYWALL); U.pillar([[7, 61], [30, 61], [7, 87], [30, 87]]);
  U.window(7, 70, 7, 71); U.window(18, 61, 19, 61); U.window(30, 74, 30, 75);
  U.prop('rack', 10, 64, 8, 1, T.TALL); U.prop('crates', 11, 80, 2, 2, T.LOW); U.prop('workbench', 16, 72, 6, 1, T.LOW);
  // the Captain's Inn: three floors
  G.room('Tavern', 64, 62, 16, 22, FL.WOOD);
  G.room('Inn Kitchen', 81, 62, 9, 22, FL.TILE);
  G.box(63, 61, 90, 84, T.SOFT, MAT.BRICK); G.wall(80, 62, 80, 83); G.door(80, 70, 80, 72);
  G.door(70, 61, 72, 61, true); G.door(63, 74, 63, 76, true);
  G.window(63, 66, 63, 67); G.window(75, 84, 76, 84); G.window(90, 66, 90, 67); G.window(86, 84, 87, 84);
  G.pillar([[63, 61], [90, 61], [63, 84], [90, 84], [80, 61], [80, 84]]);
  G.prop('counter', 70, 80, 8, 1, T.LOW); G.prop('coffeetable', 71, 66, 2, 2, T.LOW); G.prop('coffeetable', 75, 72, 2, 2, T.LOW); G.prop('barrels', 77, 63, 2, 2, T.TALL);
  G.prop('island', 84, 70, 3, 5, T.LOW); G.prop('fridge', 88, 63, 1, 3, T.TALL); G.prop('counter', 82, 81, 7, 1, T.LOW);
  stair(0, 1, 65, 66, 2, 6, 'n', FL.WOOD);
  U.room('Guest Rooms', 64, 62, 16, 22, FL.CARPET);
  U.room('Captain\'s Quarters', 81, 62, 9, 22, FL.WOOD);
  U.box(63, 61, 90, 84, T.SOFT, MAT.BRICK); U.wall(80, 62, 80, 83); U.door(80, 76, 80, 78);
  U.pillar([[63, 61], [90, 61], [63, 84], [90, 84], [80, 61], [80, 84]]);
  U.window(63, 79, 63, 80); U.window(70, 61, 71, 61); U.window(90, 70, 90, 71); U.window(84, 84, 85, 84);
  U.prop('bed', 70, 63, 3, 4, T.LOW); U.prop('bed', 70, 78, 3, 4, T.LOW); U.prop('bed', 84, 64, 4, 3, T.LOW); U.prop('cabinet', 88, 80, 1, 3, T.TALL);
  stair(1, 2, 77, 64, 2, 6, 'n', FL.WOOD);
  A.room('Inn Attic', 64, 62, 26, 22, FL.WOOD);
  A.box(63, 61, 90, 84, T.SOFT, MAT.BRICK); A.window(63, 70, 63, 71); A.window(90, 76, 90, 77);
  A.prop('crates', 66, 79, 2, 2, T.LOW); A.prop('shelf', 86, 63, 3, 1, T.TALL); A.prop('crates', 82, 78, 2, 2, T.LOW);
  // cottages and the net shed
  G.room('Fisherman\'s Cottage', 36, 92, 12, 10, FL.WOOD);
  G.box(35, 91, 48, 102, T.SOFT, MAT.DRYWALL); G.door(40, 91, 42, 91, true); G.window(35, 96, 35, 97); G.window(48, 96, 48, 97);
  G.prop('bed', 37, 98, 4, 3, T.LOW); G.prop('shelf', 46, 93, 1, 3, T.TALL);
  G.room('Net Shed', 66, 92, 10, 8, FL.CONCRETE);
  G.box(65, 91, 76, 100, T.SOFT, MAT.DRYWALL); G.door(69, 91, 71, 91, true); G.window(76, 95, 76, 96);
  G.prop('pots', 67, 95, 4, 3, T.TALL);
  G.prop('lamp', 49, 59, 1, 1, T.TALL); G.prop('lamp', 88, 59, 1, 1, T.TALL); G.prop('car', 33, 53, 6, 3, T.TALL); G.prop('van', 76, 52, 7, 3, T.TALL);
  G.prop('tree', 3, 96, 2, 2, T.TALL); G.prop('tree', 56, 92, 2, 2, T.TALL); G.prop('bench', 51, 70, 1, 3, T.LOW); G.prop('fountain', 37, 70, 4, 4, T.LOW);

  // ================= zone 5: the docks, the boathouse and the Lighthouse =================
  G.room('Boathouse', 96, 60, 14, 14, FL.WOOD);
  G.box(95, 59, 110, 74, T.SOFT, MAT.DRYWALL); G.door(95, 64, 95, 66, true); G.door(110, 66, 110, 68, true); G.window(101, 59, 102, 59);
  G.pillar([[95, 59], [110, 59], [95, 74], [110, 74]]);
  G.prop('boat', 99, 63, 3, 8, T.LOW); G.prop('rack', 106, 61, 1, 5, T.TALL); G.prop('workbench', 104, 72, 5, 1, T.LOW);
  G.room('Keeper\'s Room', 98, 90, 10, 10, FL.WOOD);
  G.box(97, 89, 108, 100, T.SOFT, MAT.BRICK); G.door(101, 89, 103, 89, true); G.window(108, 94, 108, 95);
  G.pillar([[97, 89], [108, 89], [97, 100], [108, 100]]);
  stair(0, 1, 99, 92, 2, 6, 'n', FL.CONCRETE);
  U.room('Lantern Stair', 98, 90, 10, 10, FL.CONCRETE);
  U.box(97, 89, 108, 100, T.SOFT, MAT.BRICK); U.window(102, 89, 103, 89); U.pillar([[97, 89], [108, 89], [97, 100], [108, 100]]);
  stair(1, 2, 105, 92, 2, 6, 'n', FL.CONCRETE);
  A.room('Lamp Room', 98, 90, 10, 10, FL.CONCRETE);
  A.box(97, 89, 108, 100, T.SOFT, MAT.BRICK); A.window(97, 94, 97, 95); A.window(108, 94, 108, 95); A.pillar([[97, 89], [108, 89], [97, 100], [108, 100]]);
  G.prop('pots', 114, 64, 3, 3, T.TALL); G.prop('boat', 122, 78, 3, 6, T.LOW); G.prop('barrels', 113, 86, 2, 2, T.TALL); G.prop('lamp', 111, 76, 1, 1, T.TALL);
  G.prop('rock', 93, 104, 3, 2, T.TALL); G.prop('rock', 110, 103, 2, 2, T.TALL);

  // ================= the sea =================
  for (const [x, y, w, h] of [[120, 0, 30, 34], [142, 34, 8, 4], [120, 38, 30, 34], [138, 72, 12, 4], [120, 76, 30, 32], [0, 108, 150, 16]]) G.prop('sea', x, y, w, h, T.LOW);

  G.decor((x, X, Y) => { // painted lines down Commercial Street and a crosswalk on Bay Street
    x.fillStyle = 'rgba(235,225,170,0.35)';
    for (let py = 2; py < 106; py += 4) if (py < 49 || py > 59) x.fillRect(X(55.85), Y(py), X(0.3) - X(0), Y(py + 2) - Y(py));
    x.fillStyle = 'rgba(240,240,235,0.32)'; for (let px = 50; px < 62; px += 2) x.fillRect(X(px), Y(51), X(1) - X(0), Y(59) - Y(51));
  });

  const g = G.c, u = U.c, a = A.c;
  const m = finish({
    sites: [{ name: 'Town Hall', bombs: [{ id: 'A', ...g(28, 40), room: 'Town Hall Lobby' }, { id: 'B', ...g(42, 40), room: 'Council Chamber' }], rooms: ['Town Hall Lobby', 'Council Chamber'] }],
    cams: [g(30, 35), g(44, 35)],
    atkSpawns: [{ name: 'North Road', ...g(-16, -16) }, { name: 'West Dunes', ...g(-16, 60) }],
    zombies: {
      // the cells are building-frame (x0, y0, x1, y1) on 1F; game.js turns them into map cells
      gates: [
        { name: 'Front Doors', at: [49, 37, 49, 39], cost: 750, opens: 1 },
        { name: 'Side Door', at: [40, 31, 41, 31], cost: 1000, opens: 2 },
        { name: 'Churchyard Gate', at: [49, 13, 49, 16], cost: 1000, opens: 2 },
        { name: 'Fish Market Door', at: [62, 37, 62, 39], cost: 1000, opens: 3 },
        { name: 'Bay Street Barricade', at: [54, 50, 57, 50], cost: 1250, opens: 4 },
        { name: 'Harbour Gate', at: [92, 53, 92, 56], cost: 1500, opens: 5 },
      ],
      start: [g(28, 36), g(32, 40), g(42, 42), g(44, 34)],
      spawns: [ // where zombies come from, and which open zone wakes each
        { ...g(8, 27), wake: [0] }, { ...g(30, 27), wake: [0] }, { ...g(10, 47), wake: [0] }, { ...g(36, 48), wake: [0] }, { ...g(17, 33), wake: [0] },
        { ...g(55, 1), wake: [1] }, { ...g(59, 1), wake: [1] }, { ...g(56, 28), wake: [1] },
        { ...g(5, 2), wake: [2] }, { ...g(46, 2), wake: [2] },
        { ...g(76, 2), wake: [3] }, { ...g(117, 2), wake: [3] }, { ...g(100, 42), wake: [3] }, { ...g(66, 48), wake: [3] },
        { ...g(2, 60), wake: [4] }, { ...g(20, 104), wake: [4] }, { ...g(56, 105), wake: [4] }, { ...g(84, 104), wake: [4] }, { ...g(45, 86), wake: [4] },
        { ...g(117, 58), wake: [5] }, { ...g(104, 105), wake: [5] }, { ...g(96, 80), wake: [5] }, { ...g(117, 96), wake: [5] }, { ...g(137, 73), wake: [5] },
      ],
      guns: [ // bought off the wall: the gun, then its ammo for half
        { w: 'ranger', cost: 500, ...g(33, 45), face: 's' }, { w: 'hornet', cost: 700, ...g(48, 44), face: 'e' },
        { w: 'wasp', cost: 1000, ...g(50, 42), face: 'w' }, { w: 'breaker', cost: 1500, ...g(12, 20), face: 'w' },
        { w: 'marten', cost: 1200, ...g(81, 45), face: 's' }, { w: 'rook', cost: 1400, ...g(107, 22), face: 'e' },
        { w: 'javelin', cost: 1100, ...g(29, 72), face: 'e' }, { w: 'k4', cost: 1500, ...g(64, 82), face: 'w' }, { w: 'tusk', cost: 1500, ...g(109, 70), face: 'e' },
      ],
      perks: [
        { id: 'revive', ...g(47, 42) }, { id: 'reload', ...g(64, 44) }, { id: 'tough', ...g(78, 63) }, { id: 'rapid', ...g(28, 63) },
        { id: 'stride', ...g(97, 72) }, { id: 'blast', ...g(106, 32) },
      ],
      crates: [g(20, 7), g(104, 20), u(20, 85), a(85, 82), g(108, 62)], // where the mystery crate can be
      power: g(106, 98),
      forge: a(103, 98),
    },
  });
  // the town is all there is: the open ground the kit adds round every map becomes more sea
  const gf = m.floors.find(f => f.x0 < 0) || m.floors[0];
  const pad = 20, W = m.W;
  for (let y = 0; y < gf.h; y++) for (let x = 0; x < gf.w; x++) {
    if (x >= pad && x < gf.w - pad && y >= pad && y < gf.h - pad) continue;
    const k = y * W + gf.gx + x; if (m.tiles[k] !== T.VOID) { m.tiles[k] = T.LOW; m.floor[k] = FL.GRASS; }
  }
  m.props = m.props.filter(p => { const lx = p.x - gf.gx, ly = p.y; return lx >= pad && ly >= pad && lx + p.w <= gf.w - pad && ly + p.h <= gf.h - pad; });
  for (const [x, y, w, h] of [[0, 0, gf.w, pad], [0, gf.h - pad, gf.w, pad], [0, pad, pad, gf.h - 2 * pad], [gf.w - pad, pad, pad, gf.h - 2 * pad]]) m.props.push({ kind: 'sea', x: gf.gx + x, y, w, h, rot: 0 });
  // building-frame cells -> map cells for the gates
  const cell = (x, y) => Math.floor(g(x, y).y / CELL) * W + Math.floor(g(x, y).x / CELL);
  for (const gt of m.zombies.gates) { gt.cells = []; const [x0, y0, x1, y1] = gt.at; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) gt.cells.push(cell(x, y)); const c = g((x0 + x1) / 2, (y0 + y1) / 2); gt.x = c.x; gt.y = c.y; }
  return m;
}
