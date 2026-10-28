// "Clocktower School" — an old school: classrooms, gym and cafeteria downstairs, labs and offices
// upstairs (with a gallery looking down into the gym), and the clock room at the top of the tower.
import { T, FL, MAT } from '../constants.js';
import { makeMap } from '../mapkit.js';

export function build() {
  const { kits: [G, U, C], stair, finish } = makeMap({ id: 'school', name: 'Clocktower School', floors: [
    { name: '1F', x0: 0, y0: 0, w: 78, h: 56, ground: true },
    { name: '2F', x0: 8, y0: 8, w: 62, h: 38 },
    { name: '3F', x0: 28, y0: 8, w: 20, h: 16 },
  ] });

  // ================= 1F =================
  G.ground(0, 0, 78, 7, FL.ASPHALT);        // street
  G.ground(12, 45, 30, 10, FL.ASPHALT);     // playground
  G.ground(66, 40, 12, 16, FL.ASPHALT);     // teacher parking
  G.ground(34, 7, 8, 3, FL.CONCRETE);       // front steps
  G.area('Entrance Hall', 30, 11, 16, 10, FL.MARBLE);
  G.area('Classroom 1', 11, 11, 18, 10, FL.WOOD);
  G.area('Classroom 2', 47, 11, 18, 10, FL.WOOD);
  G.area('Main Corridor', 11, 22, 54, 4, FL.TILE);
  G.area('Gymnasium', 11, 27, 26, 16, FL.WOOD);
  G.area('Cafeteria', 38, 27, 16, 16, FL.TILE);
  G.area('Nurse', 55, 27, 10, 7, FL.TILE);
  G.area('Janitor', 55, 35, 10, 8, FL.CONCRETE);
  G.box(10, 10, 65, 43, T.SOFT, MAT.BRICK);
  G.pillar([[10, 10], [65, 10], [10, 43], [65, 43], [29, 10], [46, 10], [37, 43], [54, 43], [10, 21], [10, 26], [65, 21], [65, 26], [29, 21], [46, 21], [37, 26], [54, 26]]);
  G.door(36, 10, 39, 10, true); G.door(10, 23, 10, 24, true); G.door(65, 23, 65, 24, true); G.door(22, 43, 24, 43, true);
  G.door(44, 43, 45, 43, true); G.door(65, 38, 65, 39, true);
  G.door(36, 21, 39, 21); G.door(19, 21, 20, 21); G.door(55, 21, 56, 21); G.door(29, 15, 29, 16); G.door(46, 15, 46, 16);
  G.door(17, 26, 18, 26); G.door(30, 26, 31, 26); G.door(44, 26, 45, 26); G.door(59, 26, 60, 26); G.door(37, 33, 37, 34);
  G.door(54, 38, 54, 39); G.door(59, 34, 60, 34);
  G.window(15, 10, 16, 10); G.window(23, 10, 24, 10); G.window(51, 10, 52, 10); G.window(59, 10, 60, 10); G.window(10, 14, 10, 15);
  G.window(10, 31, 10, 32); G.window(10, 38, 10, 39); G.window(65, 14, 65, 15); G.window(65, 29, 65, 30); G.window(14, 43, 15, 43);
  G.window(31, 43, 32, 43); G.window(49, 43, 50, 43);
  for (const r of [0, 1]) for (const c of [0, 1, 2]) { G.prop('desk', 13 + c * 5, 13 + r * 4, 3, 2, T.LOW); G.prop('desk', 49 + c * 5, 13 + r * 4, 3, 2, T.LOW); }
  G.prop('cabinet', 27, 12, 1, 4, T.TALL); G.prop('cabinet', 63, 12, 1, 4, T.TALL);
  G.prop('reception', 38, 17, 6, 1, T.LOW); G.prop('plant', 44, 12, 1, 1, T.TALL); G.prop('bench', 35, 12, 4, 1, T.LOW);
  G.prop('locker', 12, 22, 6, 1, T.TALL); G.prop('locker', 48, 22, 6, 1, T.TALL); G.prop('locker', 22, 25, 6, 1, T.TALL);
  G.prop('bench', 13, 29, 1, 6, T.LOW); G.prop('crates', 33, 40, 2, 2, T.TALL); G.prop('bench', 20, 40, 8, 1, T.LOW);
  G.prop('meetingtable', 40, 30, 5, 3, T.LOW); G.prop('meetingtable', 47, 30, 5, 3, T.LOW); G.prop('meetingtable', 40, 36, 5, 3, T.LOW);
  G.prop('counter', 47, 37, 6, 1, T.LOW); G.prop('fridge', 52, 39, 1, 2, T.TALL);
  G.prop('bed', 57, 28, 3, 4, T.LOW); G.prop('cabinet', 63, 28, 1, 4, T.TALL);
  G.prop('shelf', 56, 41, 4, 1, T.TALL); G.prop('tank', 56, 36, 2, 2, T.TALL);
  for (const [tx, ty] of [[3, 10], [4, 20], [2, 42], [70, 22], [72, 30], [52, 50], [60, 52]]) G.prop('tree', tx, ty, 2, 2, T.TALL);
  G.prop('bench', 16, 49, 6, 1, T.LOW); G.prop('bench', 30, 51, 6, 1, T.LOW);
  G.prop('van', 2, 2, 10, 3, T.TALL, 1); G.prop('car', 68, 42, 3, 6, T.TALL); G.prop('car', 72, 47, 3, 6, T.TALL);
  G.decor((x, X, Y) => {
    x.fillStyle = 'rgba(235,235,230,0.7)'; for (let px = 0; px < 78; px += 2.5) x.fillRect(X(px), Y(3.5) - 1, 20, 2);
    x.strokeStyle = 'rgba(240,240,240,0.55)'; x.lineWidth = 1.4; x.strokeRect(X(14), Y(46.5), X(40) - X(14), Y(53.5) - Y(46.5)); // playground court
    x.beginPath(); x.arc(X(27), Y(50), 26, 0, 7); x.stroke();
    x.strokeStyle = 'rgba(230,190,50,0.5)'; x.strokeRect(X(13), Y(29), X(35) - X(13), Y(41) - Y(29)); x.beginPath(); x.arc(X(24), Y(35), 28, 0, 7); x.stroke(); // gym court
  });

  // ================= 2F =================
  U.slab(66, 22, 2, 6, FL.CONCRETE);                     // fire-escape landing
  U.area('Library', 30, 11, 16, 10, FL.CARPET);
  U.area('Science Lab', 11, 11, 18, 10, FL.TILE);
  U.area('Computer Lab', 47, 11, 18, 10, FL.SERVER);
  U.area('Upper Corridor', 11, 22, 54, 4, FL.TILE);
  U.area('Gym Gallery', 11, 27, 26, 2, FL.WOOD);
  U.drop(11, 29, 26, 14);                                // open above the gym floor
  U.area('Art Room', 38, 27, 16, 16, FL.WOOD);
  U.area('Principal Office', 55, 27, 10, 7, FL.WOOD);
  U.area('Staff Room', 55, 35, 10, 8, FL.CARPET);
  U.box(10, 10, 65, 43, T.SOFT, MAT.BRICK);
  U.wall(37, 27, 37, 43); U.wall(10, 29, 10, 43, T.SOFT, MAT.BRICK);
  U.prop('railing', 11, 29, 26, 1, T.LOW);
  U.pillar([[10, 10], [65, 10], [10, 43], [65, 43], [29, 10], [46, 10], [10, 21], [10, 26], [65, 21], [65, 26], [29, 21], [46, 21]]);
  U.door(36, 21, 39, 21); U.door(19, 21, 20, 21); U.door(55, 21, 56, 21); U.door(29, 15, 29, 16); U.door(46, 15, 46, 16);
  U.door(17, 26, 18, 26); U.door(30, 26, 31, 26); U.door(44, 26, 45, 26); U.door(59, 26, 60, 26); U.door(37, 27, 37, 28);
  U.door(54, 38, 54, 39); U.door(59, 34, 60, 34); U.door(65, 23, 65, 24, true);
  U.window(15, 10, 16, 10); U.window(23, 10, 24, 10); U.window(51, 10, 52, 10); U.window(59, 10, 60, 10); U.window(10, 14, 10, 15);
  U.window(65, 14, 65, 15); U.window(65, 30, 65, 31); U.window(43, 43, 44, 43); U.window(60, 43, 61, 43); U.window(37, 34, 37, 35);
  U.prop('counter', 13, 13, 8, 1, T.LOW); U.prop('counter', 13, 17, 8, 1, T.LOW); U.prop('shelf', 27, 12, 1, 7, T.TALL); U.prop('sink', 23, 12, 2, 1, T.LOW);
  U.prop('bookshelf', 36, 12, 1, 7, T.TALL); U.prop('bookshelf', 39, 12, 1, 7, T.TALL); U.prop('desk', 36, 19, 4, 1, T.LOW);
  U.prop('desk', 49, 13, 4, 2, T.LOW); U.prop('desk', 55, 13, 4, 2, T.LOW); U.prop('desk', 49, 17, 4, 2, T.LOW); U.prop('desk', 55, 17, 4, 2, T.LOW); U.prop('rack', 63, 12, 1, 7, T.TALL);
  U.prop('locker', 30, 22, 6, 1, T.TALL); U.prop('bench', 44, 25, 6, 1, T.LOW);
  U.prop('workbench', 40, 29, 6, 1, T.LOW); U.prop('workbench', 40, 34, 6, 1, T.LOW); U.prop('crates', 50, 40, 2, 2, T.TALL); U.prop('shelf', 52, 29, 1, 6, T.TALL);
  U.prop('desk', 58, 29, 4, 2, T.LOW); U.prop('bookshelf', 63, 28, 1, 5, T.TALL);
  U.prop('couch', 56, 41, 4, 1, T.LOW); U.prop('coffeetable', 57, 38, 2, 2, T.LOW);

  // ================= 3F (the tower) =================
  C.area('Clock Room', 31, 11, 7, 10, FL.WOOD);
  C.area('Bell Loft', 39, 11, 6, 10, FL.WOOD);
  C.box(30, 10, 45, 21, T.SOFT, MAT.BRICK);
  C.door(38, 12, 38, 13); C.door(38, 18, 38, 19);
  C.window(33, 10, 35, 10); C.window(30, 14, 30, 16); C.window(45, 13, 45, 14); C.window(34, 21, 35, 21);
  C.prop('tank', 32, 14, 4, 4, T.TALL); C.prop('crates', 36, 19, 1, 1, T.TALL);

  // ================= stairs =================
  stair(0, 1, 31, 13, 2, 4, 'n', FL.MARBLE);             // entrance hall -> library
  G.prop('railing', 33, 12, 1, 5, T.LOW); G.prop('railing', 31, 12, 2, 1, T.LOW);
  U.prop('railing', 33, 13, 1, 4, T.LOW); U.prop('railing', 31, 17, 2, 1, T.LOW);
  stair(0, 1, 62, 37, 2, 4, 'n', FL.CONCRETE);           // janitor -> staff room
  G.prop('railing', 61, 36, 1, 5, T.LOW); G.prop('railing', 62, 36, 2, 1, T.LOW);
  U.prop('railing', 61, 37, 1, 4, T.LOW); U.prop('railing', 62, 41, 2, 1, T.LOW);
  stair(1, 2, 42, 15, 2, 4, 'n', FL.WOOD);               // library -> bell loft
  U.prop('railing', 41, 14, 1, 5, T.LOW); U.prop('railing', 42, 14, 2, 1, T.LOW);
  C.prop('railing', 41, 15, 1, 4, T.LOW); C.prop('railing', 42, 19, 2, 1, T.LOW);
  stair(0, 1, 66, 28, 2, 6, 'n', FL.CONCRETE);           // outside fire escape -> upper corridor
  G.prop('railing', 66, 27, 2, 1, T.LOW);
  U.prop('railing', 66, 34, 2, 1, T.LOW);

  const g = G.c, u = U.c, c = C.c;
  return finish({
    sites: [
      { name: 'Cafeteria / Gymnasium', bombs: [{ id: 'A', ...g(50, 34), room: 'Cafeteria' }, { id: 'B', ...g(30, 35), room: 'Gymnasium' }], rooms: ['Cafeteria', 'Gymnasium'] },
      { name: '2F Computer Lab / Library', bombs: [{ id: 'A', ...u(61, 19), room: 'Computer Lab' }, { id: 'B', ...u(43, 12), room: 'Library' }], rooms: ['Computer Lab', 'Library'] },
      { name: '2F Principal Office / Staff Room', bombs: [{ id: 'A', ...u(58, 32), room: 'Principal Office' }, { id: 'B', ...u(56, 36), room: 'Staff Room' }], rooms: ['Principal Office', 'Staff Room'] },
      { name: '3F Clock Room / Bell Loft', bombs: [{ id: 'A', ...c(33, 19), room: 'Clock Room' }, { id: 'B', ...c(40, 12), room: 'Bell Loft' }], rooms: ['Clock Room', 'Bell Loft'] },
    ],
    cams: [g(43, 12), g(25, 23), u(45, 23), g(24, 41), c(32, 12), g(5, 5)],
    atkSpawns: [
      { name: 'Playground', ...g(20, 52) }, { name: 'Bus Stop', ...g(72, 8) },
      { name: 'Sports Field', ...g(3, 30) }, { name: 'Teacher Parking', ...g(73, 44) },
    ],
  });
}
