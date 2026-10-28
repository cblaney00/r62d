// Movement, collision, line of sight and ray casting on the tile grid.
import { CELL, T, HOLE_R, blocksMove, blocksDrone, blocksSight } from './constants.js';

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
    if (!blockFn(tileAt(map, cx, cy))) continue;
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
  const fn = drone ? blocksDrone : blocksMove;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (r * 0.5)));
  for (let s = 0; s < steps; s++) {
    o.x += dx / steps; resolve(map, o, r, fn);
    o.y += dy / steps; resolve(map, o, r, fn);
  }
}

// Movement speed in world px/s
export const BASE_SPEED = 118; // running is the default, like CS2 (no sprint); slowed from 140 to feel more deliberate
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
  if (mods.drone) spd = 200;
  else {
    spd = BASE_SPEED * (ARMOR_SPEED[mods.armor] || 1) * (mods.mul || 1);
    if (mods.downed) spd = 28;
    else if (input.crouch) spd *= 0.36;   // crouch: slowest, silent, most accurate
    else if (input.walk) spd *= 0.52;     // walk (Shift): silent
    else if (input.ads) spd *= 0.58;      // aiming down sights: slow and steady
  }
  // Weight: velocity eases toward where you want to go instead of jumping there.
  o.vx = o.vx || 0; o.vy = o.vy || 0;
  if (mods.frozen) { o.vx = 0; o.vy = 0; return false; }
  const accel = mods.drone ? 1400 : len > 0 ? 620 : 950;
  let dvx = mx * spd - o.vx, dvy = my * spd - o.vy;
  const dl = Math.hypot(dvx, dvy), maxd = accel * dt;
  if (dl > maxd) { dvx *= maxd / dl; dvy *= maxd / dl; }
  o.vx += dvx; o.vy += dvy;
  // Steps: o.gait counts half-strides (a foot plants every time it passes a multiple of PI). It only drives
  // the legs and the footstep sounds; the body itself glides at a steady speed, like a real person's hips.
  if (!mods.drone) {
    const v = Math.hypot(o.vx, o.vy);
    const stride = mods.downed ? 13 : v > BASE_SPEED * 0.78 ? 28 : v > BASE_SPEED * 0.42 ? 21 : 16;
    o.gait = (o.gait || 0) + v * dt / stride * Math.PI;
  }
  const bx = o.x, by = o.y;
  moveCircle(map, o, o.vx * dt, o.vy * dt, mods.drone ? 5 : 10, !!mods.drone);
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
  let d = walkRay(x0, y0, dx, dy, maxD, (cx, cy) => {
    if (cx === startCx && cy === startCy) return false;
    const t = tileAt(map, cx, cy);
    return blocksSight(t) && !(t === T.SOFT && throughHole(map, cy * map.W + cx, x0, y0, dx, dy));
  });
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
      if (t === T.FLOOR || t === T.GROUND || t === T.LOW) continue;
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
