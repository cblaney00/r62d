// "Dust Town" — a desert town laid out like a classic counter-strike map, so friends pick it up quickly (he asked):
// the attackers come from the south edge; two bomb-site compounds sit at opposite ends of the north (A in the west,
// B in the east) with the Hotel between them, near the middle, where defenders hold. Three ways north:
//   Long Road  — a long, open run up the west edge to A (a gate halfway, little cover: a sniper's lane)
//   Mid Street — the middle lane up to the Town Square, which links both sites (Short Gate to A, B Alley to B)
//   the Tunnels — a tight, dark, winding concrete tunnel up the east side that comes out in the B yard
// The market (west) and the garage (east) sit between the lanes; their rooms link Long-Mid and Mid-garage.
// Almost everything is on the ground: only the Hotel has an upstairs (rooms with windows over the square).
import { T, FL, MAT } from '../constants.js';
import { makeMap } from '../mapkit.js';

export function build() {
  const { kits: [G, U], stair, finish } = makeMap({ id: 'dust', name: 'Dust Town', floors: [
    { name: '1F', x0: 0, y0: 0, w: 104, h: 80, ground: true },
    { name: '2F', x0: 38, y0: 1, w: 27, h: 22 },
  ] });

  // ================= the ground =================
  G.ground(0, 0, 104, 80, FL.SAND);
  G.ground(46, 34, 12, 46, FL.CONCRETE);    // Mid Street
  G.ground(38, 21, 24, 11, FL.CONCRETE);    // Town Square

  // ---- A site: the Spice Bazaar and the Granary (north-west) ----
  G.room('Spice Bazaar', 7, 5, 14, 12, FL.TILE);
  G.room('Granary', 22, 5, 13, 12, FL.WOOD);
  G.box(6, 4, 35, 17, T.SOFT, MAT.BRICK);
  G.wall(21, 5, 21, 16);
  G.door(21, 9, 21, 10);                     // bazaar <-> granary
  G.door(12, 17, 14, 17, true); G.door(27, 17, 29, 17, true); // out to the A yard
  G.door(35, 10, 35, 11, true);              // granary east door, from the connector by the hotel
  G.window(6, 10, 6, 11); G.window(12, 4, 13, 4); G.window(28, 4, 29, 4);
  G.pillar([[6, 4], [35, 4], [6, 17], [35, 17], [21, 4], [21, 17]]);
  // A yard: open ground in front of the site, walled to the south; Long Road comes in from the west, Short Gate from the square
  G.wall(15, 32, 37, 32, T.HARD, MAT.CONCRETE);
  G.wall(37, 18, 37, 22, T.HARD, MAT.CONCRETE); G.wall(37, 27, 37, 32, T.HARD, MAT.CONCRETE); // Short Gate: the gap at y 23-26

  // ---- the Hotel, near the middle (defenders' ground) ----
  G.room('Hotel Lobby', 41, 4, 11, 16, FL.MARBLE);
  G.room('Hotel Bar', 53, 4, 9, 16, FL.WOOD);
  G.box(40, 3, 62, 20, T.SOFT, MAT.BRICK);
  G.wall(52, 4, 52, 19);
  G.door(52, 11, 52, 12);
  G.door(45, 20, 47, 20, true); G.door(56, 20, 58, 20, true); // onto the square
  G.door(40, 7, 40, 8, true);                // west, to the connector and A
  G.door(62, 7, 62, 8, true);                // east, to B Alley
  G.pillar([[40, 3], [62, 3], [40, 20], [62, 20], [52, 3], [52, 20]]);

  // ---- B site: the Water Works and the Pump House (north-east) ----
  G.room('Water Works', 67, 4, 15, 13, FL.CONCRETE);
  G.room('Pump House', 83, 4, 16, 13, FL.TILE);
  G.box(66, 3, 99, 17, T.SOFT, MAT.BRICK);
  G.wall(82, 4, 82, 16);
  G.door(82, 9, 82, 10);
  G.door(72, 17, 74, 17, true); G.door(89, 17, 91, 17, true); // out to the B yard
  G.door(66, 8, 66, 9, true);                // west, from B Alley
  G.window(75, 3, 76, 3); G.window(92, 3, 93, 3); G.window(99, 9, 99, 10);
  G.pillar([[66, 3], [99, 3], [66, 17], [99, 17], [82, 3], [82, 17]]);
  // B yard: walled from the square (B Alley gap) and from the south (the tunnel comes up through it)
  G.wall(62, 21, 62, 23, T.HARD, MAT.CONCRETE); G.wall(62, 28, 62, 32, T.HARD, MAT.CONCRETE); // B Alley: the gap at y 24-27
  G.wall(63, 32, 83, 32, T.HARD, MAT.CONCRETE);

  // ---- the Market, between Long Road and Mid Street ----
  G.room('Market Hall', 16, 34, 28, 13, FL.TILE);
  G.room('Back Market', 16, 48, 14, 14, FL.WOOD);
  G.room('Rug Shop', 31, 48, 13, 14, FL.CARPET);
  G.box(15, 33, 44, 62, T.SOFT, MAT.BRICK);
  G.wall(16, 47, 43, 47); G.wall(30, 48, 30, 61);
  G.door(15, 39, 15, 41, true);              // to Long Road
  G.door(44, 39, 44, 41, true);              // to Mid Street
  G.door(20, 47, 22, 47); G.door(36, 47, 38, 47); G.door(30, 54, 30, 55);
  G.door(20, 62, 22, 62, true);              // from the south
  G.door(44, 55, 44, 56, true);              // rug shop to mid
  G.window(15, 52, 15, 53); G.window(28, 33, 29, 33);
  G.pillar([[15, 33], [44, 33], [15, 62], [44, 62], [15, 47], [44, 47], [30, 47], [30, 62]]);

  // ---- the Garage, between Mid Street and the Tunnels ----
  G.room('Garage', 60, 34, 23, 13, FL.CONCRETE);
  G.room('Workshop', 60, 48, 11, 14, FL.CONCRETE);
  G.room('Tire Store', 72, 48, 11, 14, FL.WOOD);
  G.box(59, 33, 83, 62, T.SOFT, MAT.BRICK);
  G.wall(60, 47, 82, 47); G.wall(71, 48, 71, 61);
  G.door(59, 37, 59, 39, true);              // to Mid Street
  G.door(64, 47, 66, 47); G.door(76, 47, 78, 47); G.door(71, 54, 71, 55);
  G.door(64, 62, 66, 62, true); G.door(76, 62, 78, 62, true); // from the south
  G.window(59, 52, 59, 53);
  G.pillar([[59, 33], [83, 33], [59, 62], [83, 62], [59, 47], [83, 47], [71, 47], [71, 62]]);

  // ---- the Tunnels: solid rock and concrete with one tight winding passage (south-east -> B yard) ----
  G.wall(84, 32, 103, 62, T.HARD, MAT.CONCRETE);
  G.room('Lower Tunnel', 87, 45, 3, 17, FL.CONCRETE);
  G.room('Tunnel Bend', 87, 41, 13, 4, FL.CONCRETE);
  G.room('Upper Tunnel', 97, 33, 3, 8, FL.CONCRETE);
  G.door(87, 62, 89, 62, true);              // the tunnel mouth (south)
  G.door(97, 32, 99, 32, true);              // up into the B yard

  // ---- Long Road: the gate halfway up, and very little cover ----
  G.wall(0, 46, 4, 46, T.HARD, MAT.CONCRETE); G.wall(10, 46, 14, 46, T.HARD, MAT.CONCRETE); // Long Gate: the gap at x 5-9
  // ---- Mid Doors: the middle lane narrows halfway ----
  G.wall(45, 42, 48, 42, T.HARD, MAT.CONCRETE); G.wall(55, 42, 58, 42, T.HARD, MAT.CONCRETE);

  // ---- props: cover, market stalls, cars and palms ----
  G.prop('crates', 11, 38, 2, 2, T.TALL); G.prop('crates', 2, 58, 2, 2, T.TALL); G.prop('barrier', 7, 66, 4, 1, T.LOW, 1);
  G.prop('crates', 16, 22, 2, 2, T.TALL); G.prop('crates', 28, 26, 3, 2, T.TALL); G.prop('barrier', 9, 24, 1, 4, T.LOW);
  G.prop('car', 47, 27, 6, 3, T.TALL, 1); G.prop('crates', 58, 24, 2, 2, T.TALL); G.prop('barrier', 40, 28, 4, 1, T.LOW, 1);
  G.prop('crates', 70, 22, 2, 2, T.TALL); G.prop('container', 84, 24, 6, 3, T.TALL, 1); G.prop('crates', 96, 21, 2, 2, T.TALL);
  G.prop('van', 49, 52, 3, 7, T.TALL); G.prop('barrier', 54, 38, 3, 1, T.LOW, 1); G.prop('crates', 56, 66, 2, 2, T.TALL);
  G.prop('tree', 2, 2, 2, 2, T.TALL); G.prop('tree', 38, 1, 2, 2, T.TALL); G.prop('tree', 100, 0, 2, 2, T.TALL);
  G.prop('tree', 30, 70, 2, 2, T.TALL); G.prop('tree', 72, 72, 2, 2, T.TALL); G.prop('car', 14, 70, 6, 3, T.TALL, 1);
  G.prop('van', 80, 67, 8, 3, T.TALL, 1); G.prop('crates', 40, 66, 2, 2, T.TALL); G.prop('dumpster', 100, 66, 2, 3, T.TALL);
  // A site
  G.prop('stall', 9, 7, 4, 1, T.LOW); G.prop('stall', 9, 12, 4, 1, T.LOW); G.prop('crates', 17, 6, 2, 2, T.TALL); G.prop('counter', 14, 15, 5, 1, T.LOW);
  G.prop('crates', 24, 6, 3, 2, T.TALL); G.prop('crates', 31, 13, 2, 2, T.TALL); G.prop('shelf', 34, 6, 1, 3, T.TALL);
  // hotel
  G.prop('reception', 45, 15, 5, 1, T.LOW); G.prop('plant', 50, 5, 1, 1, T.TALL); G.prop('couch', 47, 6, 3, 1, T.LOW);
  G.prop('counter', 54, 5, 7, 1, T.LOW); G.prop('coffeetable', 55, 10, 2, 2, T.LOW); G.prop('coffeetable', 58, 15, 2, 2, T.LOW);
  // B site
  G.prop('rack', 69, 6, 1, 6, T.TALL); G.prop('workbench', 74, 14, 5, 1, T.LOW); G.prop('crates', 78, 6, 2, 2, T.TALL);
  G.prop('rack', 86, 6, 6, 1, T.TALL); G.prop('console', 93, 14, 3, 1, T.LOW); G.prop('crates', 96, 6, 2, 2, T.TALL);
  // market and garage
  G.prop('stall', 19, 37, 4, 1, T.LOW); G.prop('stall', 26, 37, 4, 1, T.LOW); G.prop('stall', 33, 37, 4, 1, T.LOW);
  G.prop('stall', 19, 43, 4, 1, T.LOW); G.prop('stall', 33, 43, 4, 1, T.LOW); G.prop('crates', 17, 56, 2, 2, T.TALL);
  G.prop('shelf', 32, 50, 1, 5, T.TALL); G.prop('counter', 37, 59, 5, 1, T.LOW);
  G.prop('car', 64, 36, 3, 6, T.TALL); G.prop('car', 74, 36, 3, 6, T.TALL); G.prop('workbench', 62, 58, 6, 1, T.LOW); G.prop('crates', 79, 51, 2, 2, T.TALL);

  G.decor((x, X, Y) => {
    // tyre tracks up Mid Street and a faded crosswalk at the square
    x.fillStyle = 'rgba(80,60,35,0.18)';
    for (let py = 34; py < 80; py += 1) { x.fillRect(X(49), Y(py), 3, X(1) - X(0)); x.fillRect(X(54), Y(py), 3, X(1) - X(0)); }
    x.fillStyle = 'rgba(240,235,220,0.35)';
    for (let px = 41; px < 60; px += 2) x.fillRect(X(px), Y(31), X(1) - X(0), Y(32) - Y(31));
  });

  // ================= 2F: the Hotel's upstairs rooms, windows over the square =================
  U.room('Hotel Rooms', 41, 4, 11, 16, FL.CARPET);
  U.room('Hotel Suite', 53, 4, 9, 16, FL.WOOD);
  U.box(40, 3, 62, 20, T.SOFT, MAT.BRICK);
  U.wall(52, 4, 52, 19);
  U.door(52, 14, 52, 15);
  U.window(45, 20, 46, 20); U.window(57, 20, 58, 20); U.window(40, 14, 40, 15); U.window(62, 14, 62, 15);
  U.pillar([[40, 3], [62, 3], [40, 20], [62, 20], [52, 3], [52, 20]]);
  U.prop('bed', 47, 5, 4, 3, T.LOW); U.prop('bed', 56, 5, 4, 3, T.LOW); U.prop('cabinet', 61, 10, 1, 3, T.TALL);

  // ================= stairs =================
  stair(0, 1, 42, 10, 3, 6, 'n', FL.MARBLE);         // hotel lobby -> upstairs
  G.prop('railing', 45, 10, 1, 6, T.LOW);
  U.prop('railing', 45, 12, 1, 6, T.LOW);

  const g = G.c;
  return finish({
    sites: [
      { name: 'A: Spice Bazaar / Granary', bombs: [{ id: 'A', ...g(14, 10), room: 'Spice Bazaar' }, { id: 'B', ...g(28, 11), room: 'Granary' }], rooms: ['Spice Bazaar', 'Granary'] },
      { name: 'B: Water Works / Pump House', bombs: [{ id: 'A', ...g(74, 10), room: 'Water Works' }, { id: 'B', ...g(90, 11), room: 'Pump House' }], rooms: ['Water Works', 'Pump House'] },
      { name: 'Hotel Lobby / Hotel Bar', bombs: [{ id: 'A', ...g(47, 10), room: 'Hotel Lobby' }, { id: 'B', ...g(57, 12), room: 'Hotel Bar' }], rooms: ['Hotel Lobby', 'Hotel Bar'] },
    ],
    cams: [g(20, 25), g(50, 23), g(80, 25), g(7, 50), g(52, 48), g(88, 50), g(46, 6)],
    atkSpawns: [
      { name: 'Long Road', ...g(6, 74) }, { name: 'Market Street', ...g(28, 74) },
      { name: 'Mid Street', ...g(52, 74) }, { name: 'Tunnel Mouth', ...g(88, 72) },
    ],
  });
}
