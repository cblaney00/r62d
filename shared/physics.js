// Movement, collision, line of sight and ray casting on the tile grid.
import { CELL, PX_PER_M, T, FL, HOLE_R, PLAYER_R, DRONE_R, blocksMove, blocksDrone, blocksSight } from './constants.js';

// What stops a body: everything blocksMove says, plus window openings (you vault through those, see findVault).
export const bodyBlocks = map => (t, k) => blocksMove(t) || (t === T.OPEN && !!map.win && map.win[k] === 1);
// Can a body vault over this cell? Low furniture (not the open drop beside a balcony), a window, a knocked-through wall stub.
export function vaultable(map, k) {
  const t = map.tiles[k];
  return (t === T.LOW && map.floor[k] !== FL.VOID) || t === T.RUBBLE || (t === T.OPEN && !!map.win && map.win[k] === 1);
}
export const VAULT_REACH = 12;   // how close (px beyond your body's edge) the obstacle must be
export const VAULT_DEPTH = 2.2;  // the thickest thing you can vault over, in cells
// Where a body at (x, y) vaulting toward ang would land, or null if there is nothing to vault there
// (or no room on the far side). Everything crossed must be vaultable; walls or the void stop it.
export function findVault(map, x, y, ang) {
  const dx = Math.cos(ang), dy = Math.sin(ang), blk = bodyBlocks(map);
  const cellK = d => { const cx = Math.floor((x + dx * d) / CELL), cy = Math.floor((y + dy * d) / CELL); return cx < 0 || cy < 0 || cx >= map.W || cy >= map.H ? -1 : cy * map.W + cx; };
  let start = -1;
  for (let d = 2; d <= PLAYER_R + VAULT_REACH; d += 1.5) {
    const k = cellK(d); if (k < 0) return null;
    if (vaultable(map, k)) { start = d; break; }
    if (blk(map.tiles[k], k)) return null;
  }
  if (start < 0) return null;
  for (let d = start + 2; d <= start + VAULT_DEPTH * CELL + PLAYER_R + 2; d += 1.5) {
    const k = cellK(d); if (k < 0) return null;
    if (blk(map.tiles[k], k) && !vaultable(map, k)) return null;
    const px = x + dx * d, py = y + dy * d;
    if (d > start + 4 && !circleBlocked(map, px, py, PLAYER_R, blk)) return { x: px, y: py };
  }
  return null;
}

export function tileAt(map, cx, cy) {
  if (cx < 0 || cy < 0 || cx >= map.W || cy >= map.H) return T.VOID;
  return map.tiles[cy * map.W + cx];
}

// Push a circle out of any blocking cells. Returns true if it touched something.
function resolve(map, o, r, blockFn) {
  let hit = false;
  const x0 = Math.floor((o.x - r) / CELL), x1 = Math.floor((o.x + r) / CELL);
  const y0 = Math.floor((o.y - r) / CELL), y1 = Math.floor((o.y + r) / CELL);
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    if (!blockFn(tileAt(map, cx, cy), cy * map.W + cx)) continue;
    const sh = shapeAt(map, cx, cy);
    if (sh) { for (const P of sh) if (pushPoly(o, r, P)) hit = true; continue; }
    const rx = cx * CELL, ry = cy * CELL;
    const nx = Math.max(rx, Math.min(o.x, rx + CELL)), ny = Math.max(ry, Math.min(o.y, ry + CELL));
    let dx = o.x - nx, dy = o.y - ny; const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 > 1e-6) { const d = Math.sqrt(d2); o.x += dx / d * (r - d); o.y += dy / d * (r - d); }
    else { // centre inside the cell: push out along the shallowest side
      const l = o.x - rx, ri = rx + CELL - o.x, t = o.y - ry, b = ry + CELL - o.y;
      const m = Math.min(l, ri, t, b);
      if (m === l) o.x = rx - r; else if (m === ri) o.x = rx + CELL + r; else if (m === t) o.y = ry - r; else o.y = ry + CELL + r;
    }
  }
  return hit;
}

export function moveCircle(map, o, dx, dy, r, drone = false) {
  // drones also slip through the drone holes at the foot of plain walls (gone once the wall is reinforced)
  const fn = drone ? (t, k) => blocksDrone(t) && !((t === T.SOFT || t === T.HARD) && map.dhole && map.dhole[k]) : bodyBlocks(map);
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (r * 0.5)));
  for (let s = 0; s < steps; s++) {
    o.x += dx / steps; resolve(map, o, r, fn);
    o.y += dy / steps; resolve(map, o, r, fn);
  }
}

// Movement speeds, in real metres per second (x PX_PER_M gives world px/s). Based on how fast people
// and small recon robots actually move indoors:
//   running (the default, like CS2 — no sprint) is a tactical jog with a gun up, 2.6 m/s for a 2-speed
//   operator (2.3 heavy, 3.0 light); walking (Shift) 1.4 m/s, a normal walk; aiming down sights 1.5 m/s;
//   crouch-walking 0.9 m/s; crawling while downed 0.5 m/s; a drone 3.2 m/s, a little quicker than a jog.
export const M_S = { run: 2.6, walk: 1.4, ads: 1.5, crouch: 0.9, downed: 0.5, drone: 3.2 };
export const BASE_SPEED = M_S.run * PX_PER_M;   // ~94 px/s (was 118)
export const DRONE_SPEED = M_S.drone * PX_PER_M; // ~115 px/s (was 200)
export const ARMOR_SPEED = { 1: 0.88, 2: 1.0, 3: 1.14 };

// Apply one input step to whatever the player controls. Shared so the client
// can predict its own movement exactly like the server does.
export function stepMove(map, o, input, dt, mods) {
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (mods.frozen) { mx = 0; my = 0; }
  const len = Math.hypot(mx, my);
  if (len > 0) { mx /= len; my /= len; }
  let spd;
  if (mods.drone) spd = DRONE_SPEED;
  else {
    spd = BASE_SPEED * (ARMOR_SPEED[mods.armor] || 1) * (mods.mul || 1);
    if (mods.downed) spd = M_S.downed * PX_PER_M;
    else if (input.crouch) spd *= M_S.crouch / M_S.run; // crouch: slowest, silent, most accurate
    else if (input.walk) spd *= M_S.walk / M_S.run;     // walk (Shift): silent
    else if (input.ads) spd *= M_S.ads / M_S.run;       // aiming down sights: slow and steady
  }
  // Weight: velocity eases toward where you want to go instead of jumping there.
  o.vx = o.vx || 0; o.vy = o.vy || 0;
  if (mods.frozen) { o.vx = 0; o.vy = 0; return false; }
  const accel = mods.drone ? 800 : len > 0 ? 500 : 760; // eased down with the slower speeds: same sense of weight
  let dvx = mx * spd - o.vx, dvy = my * spd - o.vy;
  const dl = Math.hypot(dvx, dvy), maxd = accel * dt;
  if (dl > maxd) { dvx *= maxd / dl; dvy *= maxd / dl; }
  o.vx += dvx; o.vy += dvy;
  // Steps: o.gait counts half-strides (a foot plants every time it passes a multiple of PI). It only drives
  // the legs and the footstep sounds; the body itself glides at a steady speed, like a real person's hips.
  if (!mods.drone) {
    const v = Math.hypot(o.vx, o.vy);
    // real step lengths: ~0.95 m jogging, ~0.7 m walking, ~0.45 m crouched, ~0.35 m crawling
    const stride = mods.downed ? 13 : v > BASE_SPEED * 0.78 ? 34 : v > BASE_SPEED * 0.42 ? 25 : 16;
    o.gait = (o.gait || 0) + v * dt / stride * Math.PI;
  }
  const bx = o.x, by = o.y;
  moveCircle(map, o, o.vx * dt, o.vy * dt, mods.drone ? DRONE_R : PLAYER_R, !!mods.drone);
  takeStairs(map, o);
  // walking into a wall soaks up the velocity in that direction
  if (dt > 0) {
    const ax = (o.x - bx) / dt, ay = (o.y - by) / dt;
    if (Math.abs(ax) < Math.abs(o.vx) - 1) o.vx = ax;
    if (Math.abs(ay) < Math.abs(o.vy) - 1) o.vy = ay;
  }
  return len > 0;
}

// Walking off the end of a staircase puts you on the same spot of the other floor.
export function takeStairs(map, o) {
  if (!map.portal) return false;
  const cx = Math.floor(o.x / CELL), cy = Math.floor(o.y / CELL);
  if (cx < 0 || cy < 0 || cx >= map.W || cy >= map.H) return false;
  const to = map.portal[cy * map.W + cx]; if (to < 0) return false;
  o.x += (to % map.W - cx) * CELL; o.y += (Math.floor(to / map.W) - cy) * CELL;
  return true;
}

// Walk cells along a ray (Amanatides–Woo). cb(cx, cy, tEnter) returns true to stop.
export function walkRay(x0, y0, dx, dy, maxT, cb) {
  let cx = Math.floor(x0 / CELL), cy = Math.floor(y0 / CELL);
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
  const tdx = dx !== 0 ? Math.abs(CELL / dx) : Infinity, tdy = dy !== 0 ? Math.abs(CELL / dy) : Infinity;
  let tmx = dx !== 0 ? ((dx > 0 ? (cx + 1) * CELL - x0 : x0 - cx * CELL) / Math.abs(dx)) : Infinity;
  let tmy = dy !== 0 ? ((dy > 0 ? (cy + 1) * CELL - y0 : y0 - cy * CELL) / Math.abs(dy)) : Infinity;
  let t = 0;
  for (let i = 0; i < 400 && t <= maxT; i++) {
    if (cb(cx, cy, t)) return t;
    if (tmx < tmy) { t = tmx; tmx += tdx; cx += sx; } else { t = tmy; tmy += tdy; cy += sy; }
  }
  return Math.min(t, maxT);
}

// Distance a ray travels before something opaque (or a smoke cloud) stops it.
export function castSight(map, x0, y0, ang, maxD, smokes) {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  const startCx = Math.floor(x0 / CELL), startCy = Math.floor(y0 / CELL);
  let exact = -1;
  let d = walkRay(x0, y0, dx, dy, maxD, (cx, cy) => {
    const t = tileAt(map, cx, cy);
    if (!blocksSight(t)) return false;
    const sh = shapeAt(map, cx, cy);
    if (sh) { // an angled or curved bit of wall: only its solid part stops sight
      const h = rayShape(sh, x0, y0, dx, dy);
      if (h === null || (t === T.SOFT && throughHole(map, cy * map.W + cx, x0, y0, dx, dy))) return false;
      exact = h; return true;
    }
    if (cx === startCx && cy === startCy) return false;
    return !(t === T.SOFT && throughHole(map, cy * map.W + cx, x0, y0, dx, dy));
  });
  if (exact >= 0) d = exact;
  if (smokes) for (const s of smokes) {
    const t = raySmoke(x0, y0, dx, dy, s);
    if (t !== null && t < d) d = t;
  }
  return Math.min(d, maxD);
}

// Does a sight line pass through one of the bullet holes in this soft wall cell?
function throughHole(map, k, x0, y0, dx, dy) {
  const h = map.holes && map.holes[k];
  if (!h) return false;
  for (let i = 0; i < h.length; i += 2) {
    const fx = h[i] - x0, fy = h[i + 1] - y0;
    if (fx * dx + fy * dy > 0 && Math.abs(fx * dy - fy * dx) < HOLE_R) return true;
  }
  return false;
}

// A smoke cloud is see-through near its edge only; the core stops sight.
function raySmoke(x0, y0, dx, dy, s) {
  const r = s.r * 0.8;
  const fx = x0 - s.x, fy = y0 - s.y;
  if (fx * fx + fy * fy < r * r) return 18; // standing inside: see very little
  const b = fx * dx + fy * dy, c = fx * fx + fy * fy - r * r;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t > 0 ? t + 10 : null;
}

export function los(map, x0, y0, x1, y1, smokes) {
  const d = Math.hypot(x1 - x0, y1 - y0);
  if (d < 1) return true;
  return castSight(map, x0, y0, Math.atan2(y1 - y0, x1 - x0), d, smokes) >= d - 2;
}

// Visibility polygon: list of points around (x, y). Cone of width fov facing ang,
// plus a short all-round "awareness" circle.
export function visionPoly(map, x, y, ang, fov, range, smokes, rays) {
  const pts = [];
  const n = rays || Math.ceil(fov / 0.006);
  const a0 = ang - fov / 2;
  if (fov < Math.PI * 2 - 0.01) pts.push(x, y);
  for (let i = 0; i <= n; i++) {
    const a = a0 + fov * i / n;
    const d = castSight(map, x, y, a, range, smokes);
    pts.push(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  return pts;
}

export function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Can a viewer at (x, y) facing ang with this cone see point (px, py)?
export function canSee(map, v, px, py, smokes) {
  const d = Math.hypot(px - v.x, py - v.y);
  if (d > v.range) return false;
  if (d > v.near && Math.abs(angDiff(Math.atan2(py - v.y, px - v.x), v.ang)) > v.fov / 2 + 0.05) return false;
  return los(map, v.x, v.y, px, py, smokes);
}

// The first non-floor cell a player is facing (used for reinforcing, barricading, placing charges).
export function facingCell(map, px, py, aim, reach) {
  for (let d = 4; d <= reach; d += 3) {
    for (const off of [0, -0.35, 0.35]) {
      const x = px + Math.cos(aim + off) * d, y = py + Math.sin(aim + off) * d;
      const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
      const t = tileAt(map, cx, cy);
      if (t === T.FLOOR || t === T.GROUND || t === T.LOW || t === T.HATCH || t === T.HATCHR || t === T.HOLE) continue; // hatches are floor here (see hatchNear)
      if (off !== 0 && t === T.HARD) continue;
      return { k: cy * map.W + cx, t, cx, cy };
    }
  }
  return null;
}

export function rayCircle(x0, y0, dx, dy, cx, cy, r) {
  const fx = x0 - cx, fy = y0 - cy;
  const b = fx * dx + fy * dy, c = fx * fx + fy * fy - r * r;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  if (t >= 0) return t;
  return c < 0 ? 0 : null;
}

// ---- shaped wall cells (angled and curved walls) ----
// map.shape[k] lists the solid parts of a wall cell as convex polygons (flat x, y lists in world px, wound so
// that (ey, -ex) of each edge points outwards). A wall cell without one is solid all over. The pieces are cut
// from whole wall shapes cell by cell (mapkit.js), so neighbouring pieces meet exactly with no gaps.
export function shapeAt(map, cx, cy) {
  if (!map.shape || cx < 0 || cy < 0 || cx >= map.W || cy >= map.H) return undefined;
  return map.shape[cy * map.W + cx];
}
// Is a point inside a convex piece (pad > 0 grows it a little)?
export function polyIn(P, x, y, pad = 0) {
  const n = P.length;
  for (let i = 0; i < n; i += 2) {
    const ax = P[i], ay = P[i + 1], ex = P[(i + 2) % n] - ax, ey = P[(i + 3) % n] - ay;
    if (((x - ax) * ey - (y - ay) * ex) / Math.hypot(ex, ey) > pad) return false;
  }
  return true;
}
// Where a ray first enters a convex piece (distance along the unit direction), or null.
export function rayPoly(P, x0, y0, dx, dy) {
  let t0 = -Infinity, t1 = Infinity;
  const n = P.length;
  for (let i = 0; i < n; i += 2) {
    const ax = P[i], ay = P[i + 1], ex = P[(i + 2) % n] - ax, ey = P[(i + 3) % n] - ay;
    const den = ey * dx - ex * dy, num = ey * (ax - x0) - ex * (ay - y0);
    if (Math.abs(den) < 1e-12) { if (num < 0) return null; continue; }
    const t = num / den;
    if (den < 0) { if (t > t0) t0 = t; } else if (t < t1) t1 = t;
    if (t0 > t1) return null;
  }
  return t1 < 0 ? null : Math.max(t0, 0);
}
export function rayShape(sh, x0, y0, dx, dy) {
  let best = null;
  for (const P of sh) { const t = rayPoly(P, x0, y0, dx, dy); if (t !== null && (best === null || t < best)) best = t; }
  return best;
}
// Is a world point inside solid wall (shaped cells count only their solid parts)?
export function pointSolid(map, x, y, blockFn) {
  const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), t = tileAt(map, cx, cy);
  if (!blockFn(t, cy * map.W + cx)) return false;
  const sh = shapeAt(map, cx, cy);
  return !sh || sh.some(P => polyIn(P, x, y));
}
// Push a circle out of one convex piece. Returns true if they touched.
function pushPoly(o, r, P) {
  const n = P.length;
  let inside = true, best = Infinity, bx = 0, by = 0, pen = Infinity, pnx = 0, pny = 0;
  for (let i = 0; i < n; i += 2) {
    const ax = P[i], ay = P[i + 1], ex = P[(i + 2) % n] - ax, ey = P[(i + 3) % n] - ay, l2 = ex * ex + ey * ey, l = Math.sqrt(l2);
    if (l < 1e-9) continue;
    const d = ((o.x - ax) * ey - (o.y - ay) * ex) / l;
    if (d > 0) inside = false;
    if (-d < pen) { pen = -d; pnx = ey / l; pny = -ex / l; }
    const u = Math.max(0, Math.min(1, ((o.x - ax) * ex + (o.y - ay) * ey) / l2));
    const qx = ax + ex * u, qy = ay + ey * u, dd = (o.x - qx) ** 2 + (o.y - qy) ** 2;
    if (dd < best) { best = dd; bx = qx; by = qy; }
  }
  if (inside) { o.x += pnx * (pen + r); o.y += pny * (pen + r); return true; }
  if (best >= r * r) return false;
  const d = Math.sqrt(best); if (d < 1e-6) return false;
  o.x += (o.x - bx) / d * (r - d); o.y += (o.y - by) / d * (r - d);
  return true;
}
// Does a circle overlap blocking cells (shaped cells by their solid parts)? Used by tests and placement.
export function circleBlocked(map, px, py, r, blockFn) {
  for (let cy = Math.floor((py - r) / CELL); cy <= Math.floor((py + r) / CELL); cy++)
    for (let cx = Math.floor((px - r) / CELL); cx <= Math.floor((px + r) / CELL); cx++) {
      if (cx < 0 || cy < 0 || cx >= map.W || cy >= map.H) return true;
      const k = cy * map.W + cx; if (!blockFn(map.tiles[k], k)) continue;
      const sh = map.shape && map.shape[k];
      if (sh) { for (const P of sh) { const o = { x: px, y: py }; if (pushPoly(o, r - 0.01, P)) return true; } continue; }
      const nx = Math.max(cx * CELL, Math.min(px, cx * CELL + CELL)), ny = Math.max(cy * CELL, Math.min(py, cy * CELL + CELL));
      if ((px - nx) ** 2 + (py - ny) ** 2 < r * r - 0.01) return true;
    }
  return false;
}
