// The first map: "Harbor Office" — a one-floor office block with a garage,
// surrounded by a garden, a parking lot and a road.
import { T, FL, MAT, CELL, CELL_HP } from './constants.js';

export function buildMap() {
  const W = 84, H = 60, N = W * H;
  const tiles = new Uint8Array(N).fill(T.GROUND);
  const floor = new Uint8Array(N).fill(FL.GRASS);
  const mat = new Uint8Array(N).fill(MAT.DRYWALL);
  const hp = new Int16Array(N);
  const openId = new Int16Array(N).fill(-1);
  const idx = (x, y) => y * W + x;
  const props = [], openings = [], rooms = [];

  const fillFloor = (x, y, w, h, f, t = null) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      floor[idx(i, j)] = f; if (t !== null) tiles[idx(i, j)] = t;
    }
  };
  const wallLine = (x0, y0, x1, y1, t = T.SOFT, m = MAT.DRYWALL) => {
    for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
      const k = idx(i, j); tiles[k] = t; mat[k] = m; hp[k] = CELL_HP[t] || 0;
    }
  };
  const open = (x0, y0, x1, y1, kind, ext) => {
    const cells = [];
    for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
      const k = idx(i, j); tiles[k] = T.OPEN; hp[k] = 0; openId[k] = openings.length; cells.push(k);
    }
    openings.push({ id: openings.length, cells, kind, ext });
  };
  const prop = (kind, x, y, w, h, block, rot = 0) => {
    props.push({ kind, x, y, w, h, rot });
    if (block === null) return;
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) tiles[idx(i, j)] = block;
  };
  const room = (name, x, y, w, h, f) => { rooms.push({ name, x, y, w, h }); fillFloor(x, y, w, h, f, T.FLOOR); };

  // --- Outside ---
  fillFloor(0, 52, W, 6, FL.ASPHALT);      // road
  fillFloor(74, 8, 10, 44, FL.ASPHALT);    // east parking
  fillFloor(36, 0, 14, 10, FL.ASPHALT);    // north loading lot
  fillFloor(24, 49, 3, 3, FL.CONCRETE);    // path to main entrance
  fillFloor(52, 49, 7, 3, FL.CONCRETE);    // garage driveway

  // --- Rooms (interior extents) ---
  room('West Office', 13, 11, 15, 11, FL.WOOD);
  room('Server Room', 29, 11, 13, 11, FL.SERVER);
  room('Archive', 43, 11, 13, 11, FL.CARPET);
  room('East Office', 57, 11, 14, 11, FL.WOOD);
  room('Main Hall', 13, 23, 58, 5, FL.MARBLE);
  room('Kitchen', 13, 29, 13, 11, FL.TILE);
  room('Lounge', 27, 29, 17, 11, FL.CARPET);
  room('Bathroom', 45, 29, 7, 11, FL.TILE);
  room('Meeting Room', 53, 29, 18, 11, FL.WOOD);
  room('Lobby', 13, 41, 27, 8, FL.MARBLE);
  room('Garage', 41, 41, 30, 8, FL.CONCRETE);

  // --- Walls: exterior brick (breakable), interior drywall (breakable) ---
  wallLine(12, 10, 71, 10, T.SOFT, MAT.BRICK);
  wallLine(12, 49, 71, 49, T.SOFT, MAT.BRICK);
  wallLine(12, 10, 12, 49, T.SOFT, MAT.BRICK);
  wallLine(71, 10, 71, 49, T.SOFT, MAT.BRICK);
  wallLine(13, 22, 70, 22); wallLine(13, 28, 70, 28); wallLine(13, 40, 70, 40);
  wallLine(28, 11, 28, 21); wallLine(42, 11, 42, 21); wallLine(56, 11, 56, 21);
  wallLine(26, 29, 26, 39); wallLine(44, 29, 44, 39); wallLine(52, 29, 52, 39);
  wallLine(40, 41, 40, 48, T.HARD, MAT.CONCRETE);        // lobby / garage firewall
  wallLine(45, 40, 51, 40, T.HARD, MAT.CONCRETE);        // bathroom plumbing wall
  wallLine(29, 10, 41, 10, T.HARD, MAT.CONCRETE);        // server room outer wall
  // concrete pillars at every corner and junction
  const pillars = [[12, 10], [71, 10], [12, 49], [71, 49], [12, 22], [12, 28], [12, 40], [71, 22], [71, 28], [71, 40],
    [28, 10], [42, 10], [56, 10], [28, 22], [42, 22], [56, 22], [26, 28], [44, 28], [52, 28], [26, 40], [44, 40], [52, 40],
    [40, 40], [40, 49], [24, 10], [62, 49], [32, 49], [12, 34], [71, 34], [71, 16]];
  for (const [x, y] of pillars) wallLine(x, y, x, y, T.HARD, MAT.CONCRETE);

  // --- Doors and windows ---
  open(24, 49, 26, 49, 'door', true);    // main entrance
  open(52, 49, 58, 49, 'door', true);    // garage shutter
  open(18, 10, 19, 10, 'window', true);
  open(48, 10, 49, 10, 'window', true);
  open(63, 10, 64, 10, 'window', true);
  open(71, 13, 71, 14, 'window', true);
  open(71, 32, 71, 33, 'window', true);
  open(12, 31, 12, 32, 'door', true);    // kitchen back door
  open(12, 15, 12, 16, 'window', true);
  open(12, 24, 12, 26, 'door', true);    // west hall door
  open(71, 24, 71, 26, 'door', true);    // east hall door
  open(12, 44, 12, 45, 'window', true);
  open(20, 22, 21, 22, 'door'); open(34, 22, 35, 22, 'door');
  open(49, 22, 50, 22, 'door'); open(63, 22, 64, 22, 'door');
  open(42, 15, 42, 16, 'door'); open(28, 18, 28, 19, 'door');
  open(18, 28, 19, 28, 'door'); open(34, 28, 36, 28, 'door');
  open(47, 28, 48, 28, 'door'); open(60, 28, 61, 28, 'door');
  open(26, 32, 26, 33, 'door'); open(30, 40, 32, 40, 'door');
  open(18, 40, 19, 40, 'door'); open(62, 40, 63, 40, 'door');
  open(40, 44, 40, 45, 'door'); open(52, 36, 52, 37, 'door');

  // --- Furniture ---
  prop('desk', 15, 13, 4, 2, T.LOW); prop('desk', 21, 13, 4, 2, T.LOW);
  prop('desk', 15, 17, 4, 2, T.LOW); prop('desk', 21, 17, 4, 2, T.LOW);
  prop('bookshelf', 13, 20, 4, 1, T.TALL);
  prop('rack', 31, 12, 1, 5, T.TALL); prop('rack', 34, 12, 1, 5, T.TALL); prop('rack', 38, 12, 1, 5, T.TALL);
  prop('console', 30, 20, 3, 1, T.LOW);
  prop('shelf', 44, 12, 9, 1, T.TALL); prop('shelf', 46, 15, 6, 1, T.TALL);
  prop('cabinet', 54, 18, 1, 3, T.TALL);
  prop('desk', 59, 13, 4, 2, T.LOW); prop('desk', 65, 13, 4, 2, T.LOW); prop('desk', 59, 18, 4, 2, T.LOW);
  prop('plant', 69, 20, 1, 1, T.TALL);
  prop('pillar', 30, 25, 1, 1, T.TALL); prop('pillar', 45, 25, 1, 1, T.TALL); prop('pillar', 58, 25, 1, 1, T.TALL);
  prop('bench', 38, 23, 3, 1, T.LOW);
  prop('counter', 14, 30, 10, 1, T.LOW); prop('island', 17, 34, 5, 2, T.LOW); prop('fridge', 24, 30, 1, 2, T.TALL);
  prop('couch', 29, 31, 5, 1, T.LOW); prop('couch', 29, 36, 1, 3, T.LOW, 1);
  prop('coffeetable', 31, 34, 3, 2, T.LOW); prop('tv', 40, 30, 3, 1, T.TALL);
  prop('stall', 50, 30, 1, 3, T.TALL); prop('stall', 50, 33, 1, 2, T.TALL); prop('sink', 45, 37, 2, 1, T.LOW);
  prop('meetingtable', 56, 32, 10, 4, T.LOW);
  prop('reception', 20, 43, 6, 1, T.LOW); prop('chairs', 32, 45, 1, 2, T.LOW);
  prop('plant', 14, 42, 1, 1, T.TALL); prop('plant', 38, 47, 1, 1, T.TALL);
  prop('car', 44, 42, 3, 6, T.TALL); prop('car', 64, 43, 3, 5, T.TALL); prop('crates', 68, 42, 2, 2, T.TALL);
  prop('workbench', 49, 42, 5, 1, T.LOW);
  // outside
  prop('car', 6, 53, 6, 3, T.TALL, 1); prop('car', 60, 54, 6, 3, T.TALL, 1); prop('van', 30, 53, 8, 3, T.TALL, 1);
  prop('car', 76, 20, 3, 6, T.TALL); prop('car', 76, 34, 3, 6, T.TALL); prop('car', 80, 12, 3, 6, T.TALL);
  prop('tree', 5, 5, 2, 2, T.TALL); prop('tree', 28, 3, 2, 2, T.TALL); prop('tree', 56, 4, 2, 2, T.TALL);
  prop('tree', 4, 44, 2, 2, T.TALL); prop('tree', 3, 18, 2, 2, T.TALL);
  prop('bush', 7, 26, 2, 2, T.LOW); prop('bush', 7, 37, 2, 2, T.LOW); prop('bush', 20, 6, 3, 2, T.LOW);
  prop('bush', 64, 5, 3, 2, T.LOW);
  prop('dumpster', 2, 30, 2, 3, T.TALL); prop('container', 40, 2, 6, 3, T.TALL, 1);
  prop('barrier', 14, 51, 6, 1, T.LOW, 1);

  // Walls take the floor of the room next to them, so a hole shows the right floor.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = idx(x, y), t = tiles[k];
    if (t === T.FLOOR || t === T.GROUND) continue;
    if (t === T.LOW || t === T.TALL) continue;
    for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (tiles[idx(nx, ny)] === T.FLOOR) { floor[k] = floor[idx(nx, ny)]; break; }
    }
  }

  const c = (x, y) => ({ x: (x + 0.5) * CELL, y: (y + 0.5) * CELL });
  const sites = [
    { name: 'Server Room / Archive', bombs: [{ id: 'A', ...c(32, 19), room: 'Server Room' }, { id: 'B', ...c(48, 19), room: 'Archive' }],
      rooms: ['Server Room', 'Archive'] },
    { name: 'Kitchen / Lounge', bombs: [{ id: 'A', ...c(15, 37), room: 'Kitchen' }, { id: 'B', ...c(38, 35), room: 'Lounge' }],
      rooms: ['Kitchen', 'Lounge'] },
  ];
  const cams = [c(20, 24), c(52, 24), c(30, 47), c(60, 46), c(72, 8)];
  const atkSpawns = [
    { name: 'Loading Lot', x: c(43, 7).x, y: c(43, 7).y },
    { name: 'West Garden', x: c(4, 26).x, y: c(4, 26).y },
    { name: 'Front Road', x: c(22, 56).x, y: c(22, 56).y },
    { name: 'East Parking', x: c(79, 30).x, y: c(79, 30).y },
  ];

  return { W, H, tiles, floor, mat, hp, openId, props, openings, rooms, sites, cams, atkSpawns };
}

export function roomAt(map, wx, wy) {
  const cx = Math.floor(wx / CELL), cy = Math.floor(wy / CELL);
  for (const r of map.rooms) if (cx >= r.x && cx < r.x + r.w && cy >= r.y && cy < r.y + r.h) return r.name;
  return cx < 12 || cx > 71 || cy < 10 || cy > 49 ? 'Outside' : '';
}
