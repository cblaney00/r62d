// The 3D rope view (he asked 2026-11-13: the first step toward 3D). While an attacker hangs on a rope the screen shows
// the building's wall in 3D from close behind their shoulder (he chose: close over the shoulder, full screen, no map),
// with the rooms behind the windows in 3D, so you can see in through them and shoot in. What shows inside follows the
// same sight lines as the top-down game (teamSees), so you only see someone who could see you back (he asked: tight
// angles past the sides of a window, but no free looks). Climbing in or letting go glides the camera back to the
// top-down view within the climb, so you can shoot as soon as you are through.
// Built with three.js (public/js/vendor, MIT). World units are map pixels (36 to the metre); floor to floor 3.2 m.
// main.js: rope3d.frame(ctx) every frame while on a rope (and during the glide out), rope3d.look(dx, dy) for the
// mouse, rope3d.aim() for where the crosshair points (a map point on your floor), rope3d.wallSign() for A/D.
import * as THREE from './vendor/three.module.min.js';
import { CELL, T, FL, MAT, PX_PER_M } from '/shared/constants.js';
import { floorAt, floorOff } from '/shared/map.js';
import { opSprite, W as SW, H as SH } from './opart3d.js';
import { riseOf } from './look.js'; // (only boxy things stand up: the top-down view's rule)

const M = PX_PER_M, FH = 3.2 * M, BODY = 1.85 * M;
const FLOOR_COL = { [FL.GRASS]: '#4f7a3a', [FL.ASPHALT]: '#3b3d40', [FL.WOOD]: '#8a6a46', [FL.TILE]: '#b9b4a8', [FL.CARPET]: '#6b4b55', [FL.CONCRETE]: '#8f8f8a', [FL.MARBLE]: '#d8d4cc', [FL.SERVER]: '#2c3238', [FL.SAND]: '#c9b27a', [FL.SNOW]: '#e8eef2', [FL.ROOF]: '#55585c' };
const WALL_COL = { [MAT.BRICK]: '#8a5a44', [MAT.DRYWALL]: '#cfc6b4', [MAT.CONCRETE]: '#8d9196' };
const SKY = { def: '#9fb6c8', lodge: '#c8d2da', dust: '#d6c7a4', lantern: '#a9b8c2' }; // the sky (and the haze far off) per map
const SOLID = new Set([T.HARD, T.SOFT, T.REINF, T.PANEL]);
const PIC_W = 40; // world px across a gadget picture (main.js R3_PIC_W)

let R = null; // { renderer, scene, camera, canvas, ... } made on first use
const mats = new Map();
const mat = (col, opts = {}) => { const k = col + JSON.stringify(opts); if (!mats.has(k)) mats.set(k, new THREE.MeshLambertMaterial({ color: col, ...opts })); return mats.get(k); };
const BOX = new THREE.BoxGeometry(1, 1, 1);
const texCache = new Map();
// wall surfaces drawn in code: brick courses, plaster, poured concrete; one picture covers a cell-wide, floor-high strip
const surf = new Map();
function surface(matId, frac) {
  const key = matId + '|' + frac.toFixed(2); if (surf.has(key)) return surf.get(key);
  let base = surf.get(matId + '|img');
  if (!base) {
    const c = document.createElement('canvas'); c.width = 32; c.height = 232; const x = c.getContext('2d');
    if (matId === MAT.BRICK) {
      x.fillStyle = '#6f4636'; x.fillRect(0, 0, 32, 232);
      for (let r = 0; r < 29; r++) { const off = r % 2 ? -8 : 0; for (let b = -1; b < 3; b++) { const v = 0.85 + ((r * 7 + b * 13) % 9) / 30; x.fillStyle = `rgb(${Math.round(150 * v)},${Math.round(86 * v)},${Math.round(64 * v)})`; x.fillRect(b * 16 + off + 1, r * 8 + 1, 14, 6); } }
    } else if (matId === MAT.CONCRETE) {
      x.fillStyle = '#8d9196'; x.fillRect(0, 0, 32, 232); let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647; for (let i = 0; i < 160; i++) { x.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'; x.fillRect(rnd() * 32, rnd() * 232, 2, 2); } x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(0, 115, 32, 1);
    } else {
      x.fillStyle = '#d6cdb9'; x.fillRect(0, 0, 32, 232); let sd = 11; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647; for (let i = 0; i < 220; i++) { x.fillStyle = rnd() < 0.6 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)'; x.fillRect(rnd() * 32, rnd() * 232, 3, 2); }
    }
    base = c; surf.set(matId + '|img', base);
  }
  const t = new THREE.CanvasTexture(base); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, frac);
  const m = new THREE.MeshLambertMaterial({ map: t }); surf.set(key, m); return m;
}
function spriteMat(op, view, pose, gun, own) {
  const k = op + view + pose + gun + (own ? '|me' : ''); if (texCache.has(k)) return texCache.get(k);
  const t = new THREE.CanvasTexture(opSprite(op, view, pose, gun)); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.LinearFilter;
  const m = new THREE.SpriteMaterial({ map: t, transparent: true, alphaTest: 0.2 }); texCache.set(k, m); return m;
}

function init(host) {
  const canvas = document.createElement('canvas'); canvas.id = 'rope3d'; host.insertBefore(canvas, document.getElementById('ui')); // (under the HUD)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(1.5, devicePixelRatio || 1));
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#9fb6c8'); scene.fog = new THREE.Fog('#9fb6c8', 18 * M, 60 * M);
  const camera = new THREE.PerspectiveCamera(70, 1, 4, 120 * M);
  scene.add(new THREE.HemisphereLight('#dfe9f2', '#4a4a40', 1.6));
  const sun = new THREE.DirectionalLight('#fff3dc', 1.4); sun.position.set(0.4, 1, 0.3); scene.add(sun);
  const world = new THREE.Group(), people = new THREE.Group(), fx = new THREE.Group(), thingG = new THREE.Group(), smokeG = new THREE.Group(); scene.add(world, people, fx, thingG, smokeG);
  const boomL = new THREE.PointLight('#ffb04a', 0, 10 * M, 1.2); scene.add(boomL);
  const lamps = Array.from({ length: LAMPS }, () => { const L = new THREE.PointLight('#ffe8c8', 0, 10 * M, 1.4); scene.add(L); return L; });
  const floorG = new THREE.Group(), massG = new THREE.Group(); scene.add(floorG, massG);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat('#4f7a3a')); ground.rotation.x = -Math.PI / 2; ground.scale.set(200 * M, 200 * M, 1); scene.add(ground);
  const me = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true })); me.renderOrder = 2; scene.add(me);
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1, 6), mat('#c8b27a')); scene.add(rope);
  R = { renderer, scene, camera, canvas, world, people, fx, ground, me, rope, yaw: 0, pitch: 0, key: '', sig: '', mix: 0, on: false, out: 0, ray: new THREE.Raycaster(), sprites: new Map(), tracers: [], thingG, smokeG, things: new Map(), smoke: [], plane: new THREE.PlaneGeometry(1, 1), boomL, lamps, floorG, massG };
  addEventListener('resize', () => size());
  size();
}
function size() { if (!R) return; R.renderer.setSize(innerWidth, innerHeight, false); R.camera.aspect = innerWidth / innerHeight; R.camera.updateProjectionMatrix(); }

// ---------------- building the wall and the rooms behind it ----------------
// The wall line: the rope's floor f, outward normal n, along t. Everything is placed in floor f's map coordinates
// (x, z), other floors moved over by floorOff; height y = levels above the ground floor × FH.
function build(c, line) {
  const { m } = c, { f, n, t, cx, cy } = line, W = m.W, gi = m.groundFloor, top = m.floors.length;
  const grp = R.world; for (const o of [...grp.children]) grp.remove(o);
  groundPic(c, cx, cy, f); // the ground under the wall: the map's own picture of the ground floor round you
  const lvlY = (f - gi) * FH, upperG = new Map(); // ceilings and what is above your floor: hidden while the camera looks down (gliding in or out)
  const groups = new Map(); // material -> box list (drawn as one instanced mesh each: thousands of boxes stay quick)
  const add = (col, x, y, z, sx, sy, sz, surfMat) => { const mt = surfMat !== undefined ? surface(surfMat, sy / FH) : mat(col); const G = y - sy / 2 >= lvlY + FH - 4 ? upperG : groups; if (!G.has(mt)) G.set(mt, []); G.get(mt).push({ x, y, z, sx, sy, sz }); };
  const span = 40, roomSpan = 22, inner = 26, sig = [];
  const cellOn = (g, X, Y) => { const o = floorOff(m, f, g), gx = Math.floor((X + o.x) / CELL), gy = Math.floor((Y + o.y) / CELL); if (gx < 0 || gy < 0 || gx >= W || gy >= m.H) return -1; const k = gy * W + gx; return m.flAt[k] === g ? k : -1; };
  const done = new Set(), rooms = new Map(), lamps = []; // rooms: level -> the room cells seen through its windows and doors
  // a window or door cell takes the wall's own material round it (the frame matches the wall it sits in)
  const wallMat = (g, X, Y, k) => { for (let s = 1; s < 4; s++) for (const d of [1, -1]) { const q = cellOn(g, X + t[0] * s * d * CELL, Y + t[1] * s * d * CELL); if (q >= 0 && SOLID.has(m.tiles[q])) return m.mat[q]; } return m.mat[k]; };
  for (let g = gi; g < top; g++) {
    const y0 = (g - gi) * FH, roof = g === m.roofFloor;
    for (let i = -span; i <= span; i++) {
      // the wall cell's middle on floor f (one cell in from the ledge)
      const X = cx - n[0] * CELL + t[0] * i * CELL, Y = cy - n[1] * CELL + t[1] * i * CELL;
      const k = cellOn(g, X, Y); if (k < 0) continue;
      const tl = m.tiles[k]; sig.push(tl, m.hp[k] | 0);
      if (roof) { const out = cellOn(g, X + n[0] * CELL, Y + n[1] * CELL); if ((tl === T.FLOOR || tl === T.GROUND) && (out < 0 || m.tiles[out] === T.VOID || m.tiles[out] === T.LOW)) add('#6a6d70', X, y0 + 0.25 * M, Y, CELL, 0.5 * M, CELL); continue; } // a low parapet round the roof
      if (SOLID.has(tl)) { const col = WALL_COL[m.mat[k]] || WALL_COL[MAT.DRYWALL]; add(col, X, y0 + FH / 2, Y, CELL, FH, CELL, m.mat[k]); add(shadeCol(col), X + n[0] * CELL * 0.52, y0 + 0.12 * M, Y + n[1] * CELL * 0.52, CELL, 0.25 * M, 2); continue; }
      const win = m.win[k], oi = m.openId[k], door = oi >= 0 && m.openings[oi] && m.openings[oi].kind === 'door';
      if (win || door || tl === T.BARRI) {
        const wm = wallMat(g, X, Y, k), col = WALL_COL[wm] || WALL_COL[MAT.DRYWALL];
        const sill = win ? 0.9 * M : 0, lint = win ? 2.2 * M : 2.3 * M, thin = (a, b) => t[0] ? [a, b] : [b, a];
        if (sill) add(col, X, y0 + sill / 2, Y, CELL, sill, CELL, wm);
        add(col, X, y0 + (lint + FH) / 2, Y, CELL, FH - lint, CELL, wm);
        const [fx, fz] = thin(CELL, 3); // the frame: a pale lip at the sill and the head, like the white window frames on the map
        if (win) { add('#e8e2d4', X + n[0] * CELL * 0.45, y0 + sill - 2, Y + n[1] * CELL * 0.45, fx, 4, fz); add('#e8e2d4', X + n[0] * CELL * 0.45, y0 + lint + 2, Y + n[1] * CELL * 0.45, fx, 4, fz); }
        if (tl === T.BARRI) { const hp = m.hp[k] || 0, [bx, bz] = thin(CELL * 1.05, 3); for (let j = 0; j < 3; j++) add(hp < 40 ? '#5c4228' : j % 2 ? '#7a5a36' : '#8b6a42', X - n[0] * 2, y0 + sill + (lint - sill) * (0.2 + j * 0.3), Y - n[1] * 2, bx, 0.32 * M, bz); }
        if (Math.abs(i) > roomSpan) continue;
        if (lamps.length < LAMPS) lamps.push([X - n[0] * CELL * 4, y0 + FH * 0.8, Y - n[1] * CELL * 4]);
        // the room behind it (this floor, a little to each side and some way in)
        let L = rooms.get(g); if (!L) rooms.set(g, L = { y0, cells: [], x0: 1e9, y0m: 1e9, x1: -1e9, y1: -1e9 });
        for (let d = 1; d <= inner; d++) for (let j = -9; j <= 9; j++) {
          const RX = X - n[0] * CELL * d + t[0] * CELL * j, RY = Y - n[1] * CELL * d + t[1] * CELL * j, rk = cellOn(g, RX, RY);
          if (rk < 0 || done.has(rk)) continue; done.add(rk);
          L.cells.push([RX, RY, rk]); L.x0 = Math.min(L.x0, RX); L.x1 = Math.max(L.x1, RX); L.y0m = Math.min(L.y0m, RY); L.y1 = Math.max(L.y1, RY);
        }
      }
    }
  }
  // the rooms: the floor is the map's own picture (same floors, rugs, marks as the top-down view), walls and furniture
  // take their colours from it, ceilings over
  const pics = floorPics(c, rooms, f), rise = riseOf(m);
  for (const [g, L] of rooms) {
    const y0 = L.y0, P = pics.get(g);
    for (const [RX, RY, rk] of L.cells) {
      const rt = m.tiles[rk], col = P ? P.col(RX, RY) : null;
      if (SOLID.has(rt) || rt === T.BARRI) add(rt === T.BARRI ? '#7a5a36' : col || '#bdb5a6', RX, y0 + FH / 2, RY, CELL, FH, CELL);
      else if (rt === T.TALL && rise[rk]) add(col || '#5c5248', RX, y0 + 0.9 * M, RY, CELL * 0.98, 1.8 * M, CELL * 0.98);
      else if (rt === T.LOW && m.floor[rk] !== FL.VOID) add(col || '#6e5c48', RX, y0 + 0.45 * M, RY, CELL * 0.98, 0.9 * M, CELL * 0.98);
      if (rt !== T.VOID && !(rt === T.LOW && m.floor[rk] === FL.VOID)) {
        if (!P) add(FLOOR_COL[m.floor[rk]] || '#8f8f8a', RX, y0 + 1, RY, CELL, 2, CELL);
        add('#2a2a2c', RX, y0 + FH - 1, RY, CELL, 2, CELL); // ceiling
      }
    }
  }
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion();
  const up = new THREE.Group(); up.name = 'upper'; grp.add(up);
  for (const [G, into] of [[groups, grp], [upperG, up]]) for (const [mt, list] of G) { if (!list.length) continue; const im = new THREE.InstancedMesh(BOX, mt, list.length); list.forEach((b, i) => im.setMatrixAt(i, mtx.compose(new THREE.Vector3(b.x, b.y, b.z), q, new THREE.Vector3(b.sx, b.sy, b.sz)))); im.instanceMatrix.needsUpdate = true; into.add(im); }
  R.upper = up;
  // room lights (always the same number of lights: changing it makes the graphics card rebuild its shaders, a stutter)
  R.lamps.forEach((L, i) => { const p = lamps[i]; L.intensity = p ? 1.2 : 0; if (p) L.position.set(p[0], p[1], p[2]); });
  if (R.massKey !== R.key + '|' + R.groundKey) { R.massKey = R.key + '|' + R.groundKey; massing(c, line, span, roomSpan, inner); }
  return sig.join(',');
}
const LAMPS = 4;
// The map picture for each level's rooms (main.js c.pic draws it), cut to the room cells, on a plane at floor height.
// Remade when the view is rebuilt for a new stretch of wall, and every 2 s (blood, scorch marks, holes).
function floorPics(c, rooms, f) {
  const m = c.m, out = new Map();
  const fresh = R.picKey !== R.key || c.now - (R.picT || 0) > 2;
  if (!c.pic) return out;
  if (fresh) { for (const o of [...R.floorG.children]) { R.floorG.remove(o); o.material.map.dispose(); o.material.dispose(); } R.picData = new Map(); R.picKey = R.key; R.picT = c.now; }
  for (const [g, L] of rooms) {
    const x0 = L.x0 - CELL / 2, y0 = L.y0m - CELL / 2, w = L.x1 - L.x0 + CELL, h = L.y1 - L.y0m + CELL, o = floorOff(m, f, g);
    let D = R.picData.get(g);
    if (!D) {
      const S = PIC_K, cv = c.pic(x0 + o.x, y0 + o.y, w, h, Math.ceil(w * S), Math.ceil(h * S)); if (!cv) continue;
      const x = cv.getContext('2d'), data = x.getImageData(0, 0, cv.width, cv.height).data;
      // only the room cells (not the air outside upper floors, nor rooms we don't build)
      const mk = document.createElement('canvas'); mk.width = cv.width; mk.height = cv.height; const mx = mk.getContext('2d'); mx.fillStyle = '#fff';
      for (const [RX, RY] of L.cells) mx.fillRect(Math.floor((RX - CELL / 2 - x0) * S), Math.floor((RY - CELL / 2 - y0) * S), Math.ceil(CELL * S) + 1, Math.ceil(CELL * S) + 1);
      x.globalCompositeOperation = 'destination-in'; x.drawImage(mk, 0, 0); x.globalCompositeOperation = 'source-over';
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      const pl = new THREE.Mesh(R.plane, new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.5 }));
      pl.userData.up = g > f; pl.rotation.x = -Math.PI / 2; pl.scale.set(w, h, 1); pl.position.set(x0 + w / 2, L.y0 + 2, y0 + h / 2); R.floorG.add(pl);
      D = { data, W: cv.width, H: cv.height, x0, y0 }; R.picData.set(g, D);
    }
    // a colour from the picture at a cell's middle (a wall's or a piece of furniture's top, as the map draws it)
    out.set(g, { col: (X, Y) => { const px = Math.floor((X - D.x0) * PIC_K), py = Math.floor((Y - D.y0) * PIC_K); if (px < 0 || py < 0 || px >= D.W || py >= D.H) return null; const i = (py * D.W + px) * 4; return `rgb(${D.data[i]},${D.data[i + 1]},${D.data[i + 2]})`; } });
  }
  return out;
}
const PIC_K = 1.5; // picture px per world px
function groundPic(c, cx, cy, f) {
  const m = c.m; if (!c.pic) return;
  const gi = m.groundFloor, o = floorOff(m, f, gi), side = 70 * M, gx = Math.round(cx / (8 * M)) * 8 * M, gy = Math.round(cy / (8 * M)) * 8 * M, key = gi + '|' + gx + '|' + gy;
  if (R.groundKey === key) return; R.groundKey = key;
  const cv = c.pic(gx - side / 2 + o.x, gy - side / 2 + o.y, side, side, 1536, 1536); if (!cv) return;
  R.groundData = { data: cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, W: cv.width, H: cv.height, x0: gx - side / 2, y0: gy - side / 2, k: cv.width / side };
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  if (R.ground.material.map) R.ground.material.map.dispose();
  R.ground.material = new THREE.MeshLambertMaterial({ map: tex }); R.ground.scale.set(side, side, 1); R.ground.position.set(gx, -0.5, gy);
}
// The rest of the building and the yard cover round you: plain blocks as tall as the floors stacked at each spot (so
// the building isn't a single wall standing on a floor plan), vans, containers and crates in the yard as solid boxes in
// the map picture's colours. Remade only when the view moves to a new stretch of wall.
const OUT_FL = new Set([FL.GRASS, FL.ASPHALT, FL.SAND, FL.SNOW]);
const roomCache = new WeakMap();
function massing(c, line, span, roomSpan, inner) {
  const m = c.m, { f, n, t, cx, cy } = line, W = m.W, gi = m.groundFloor;
  for (const o of [...R.massG.children]) { R.massG.remove(o); o.dispose && o.dispose(); }
  let inRoom = roomCache.get(m);
  if (!inRoom) { inRoom = new Uint8Array(W * m.H); for (const r of m.rooms || []) for (let yy = r.y; yy < r.y + r.h; yy++) for (let xx = r.x; xx < r.x + r.w; xx++) if (xx >= 0 && yy >= 0 && xx < W && yy < m.H) inRoom[yy * W + xx] = 1; roomCache.set(m, inRoom); }
  const og = floorOff(m, f, gi), half = Math.ceil(35 * M / CELL), G0x = Math.floor((cx + og.x) / CELL), G0y = Math.floor((cy + og.y) / CELL);
  const offs = []; for (let g = gi + 1; g < m.floors.length; g++) if (g !== m.roofFloor) { const o = floorOff(m, gi, g); offs.push([g, Math.round(o.x / CELL), Math.round(o.y / CELL)]); }
  const D = R.groundData, colAt = (X, Y) => { if (!D) return '#6e6a60'; const px = Math.floor((X - D.x0) * D.k), py = Math.floor((Y - D.y0) * D.k); if (px < 0 || py < 0 || px >= D.W || py >= D.H) return '#6e6a60'; const i = (py * D.W + px) * 4; return `rgb(${D.data[i]},${D.data[i + 1]},${D.data[i + 2]})`; };
  const near = (X, Y) => { const rx = X - cx, ry = Y - cy, al = Math.abs(rx * t[0] + ry * t[1]) / CELL, dp = -(rx * n[0] + ry * n[1]) / CELL; return (al <= span + 0.5 && dp >= -1.5 && dp <= 1.5) || (al <= roomSpan + 9.5 && dp >= -1.5 && dp <= inner + 1.5); };
  const blocks = [], props = [], rise = riseOf(m);
  for (let gy = G0y - half; gy <= G0y + half; gy++) {
    if (gy < 0 || gy >= m.H) continue;
    let run = null;
    const flush = () => { if (run) blocks.push(run); run = null; };
    for (let gx = G0x - half; gx <= G0x + half; gx++) {
      if (gx < 0 || gx >= W) { flush(); continue; }
      const k = gy * W + gx, tl = m.tiles[k];
      const X = (gx + 0.5) * CELL - og.x, Y = (gy + 0.5) * CELL - og.y; // (in floor f's frame)
      if (m.flAt[k] !== gi || near(X, Y)) { flush(); continue; }
      const indoor = !(tl === T.GROUND || tl === T.VOID || (!inRoom[k] && !SOLID.has(tl) && OUT_FL.has(m.floor[k])));
      if (!indoor) {
        flush();
        if ((tl === T.TALL || (tl === T.LOW && m.floor[k] !== FL.VOID)) && rise[k]) props.push([X, Y, tl === T.TALL ? 1.8 * M : 0.9 * M, colAt(X, Y)]);
        continue;
      }
      let lv = 1; for (const [g, dx, dy] of offs) { const q = k + dy * W + dx; if (q < 0 || q >= W * m.H || m.flAt[q] !== g || m.tiles[q] === T.VOID) break; lv++; }
      const h = lv * FH;
      if (run && run.h === h && run.gx1 === gx - 1) { run.gx1 = gx; run.X1 = X; run.Y1 = Y; } else { flush(); run = { h, gx1: gx, X0: X, Y0: Y, X1: X, Y1: Y }; }
    }
    flush();
  }
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), V = (x, y, z) => new THREE.Vector3(x, y, z);
  if (blocks.length) {
    const im = new THREE.InstancedMesh(BOX, mat('#868b90'), blocks.length);
    blocks.forEach((b, i) => { const sx = Math.abs(b.X1 - b.X0) + CELL, sz = Math.abs(b.Y1 - b.Y0) + CELL; im.setMatrixAt(i, mtx.compose(V((b.X0 + b.X1) / 2, b.h / 2, (b.Y0 + b.Y1) / 2), q, V(sx, b.h, sz))); });
    im.instanceMatrix.needsUpdate = true; R.massG.add(im);
  }
  if (props.length) {
    const im = new THREE.InstancedMesh(BOX, mat('#ffffff'), props.length), col = new THREE.Color();
    props.forEach((p, i) => { im.setMatrixAt(i, mtx.compose(V(p[0], p[2] / 2, p[1]), q, V(CELL, p[2], CELL))); im.setColorAt(i, col.set(p[3])); });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; R.massG.add(im);
  }
}
function shadeCol(hex) { const v = parseInt(hex.slice(1), 16), k = 0.7, c = s => Math.round(((v >> s) & 255) * k); return `rgb(${c(16)},${c(8)},${c(0)})`; }

// ---------------- each frame ----------------
// c = { m, me, s, pred, rope (map.ropes entry the view is built round), height (px above the ground floor), inv,
//       people: [{ id, op, x, y, f, ag, pose, w, onRope }], aiming (in), now, dt, leaving (0..1: gliding out) }
export function frame(c) {
  if (!R) init(document.body);
  const { m, rope: r } = c, f = r.f, n = [Math.round(Math.cos(r.out)), Math.round(Math.sin(r.out))], t = [r.tx, r.ty];
  // the wall line, built round where you are along it (rebuilt when you move far along it, change floor or wall, or it changes)
  const along = (c.pred.x - r.hang.x) * r.tx + (c.pred.y - r.hang.y) * r.ty;
  const ax = Math.round((r.hang.x + r.tx * along) / CELL), ay = Math.round((r.hang.y + r.ty * along) / CELL);
  const key = f + '|' + r.out.toFixed(2) + '|' + (n[0] ? ax : Math.round(ax / 10)) + '|' + (n[1] ? ay : Math.round(ay / 10));
  const line = { f, n, t, cx: (Math.floor(c.pred.x / CELL) + 0.5) * CELL - (n[0] ? 0 : 0), cy: (Math.floor(c.pred.y / CELL) + 0.5) * CELL };
  if (key !== R.key || c.now - (R.sigT || 0) > 0.5) {
    if (key !== R.key) { R.key = key; R.line = line; R.sig = build(c, line); }
    else { const s = build(c, R.line); R.sig = s; } // (boards coming off, windows opening)
    R.sigT = c.now;
  }
  const sky = SKY[c.s && c.s.mp] || SKY.def; if (R.sky !== sky) { R.sky = sky; R.scene.background.set(sky); R.scene.fog.color.set(sky); }
  if (!R.on) { R.on = true; R.yaw = 0; R.pitch = 0.05; R.mix = 0; R.canvas.style.display = 'block'; }
  // where you hang: just outside the wall, at window height (upside down: higher, head at the top of the window)
  const out = 0.35 * M, me3 = new THREE.Vector3(c.pred.x + n[0] * out, c.height + (c.inv ? 1.6 * M : 0.15 * M), c.pred.y + n[1] * out);
  const right = new THREE.Vector3(n[1], 0, -n[0]); // to your right as you face the wall
  // your operator from behind, the rope up to the roof
  // (aiming in: your own back fades so you can see past it)
  R.me.material = spriteMat(c.me.op, 'back', c.inv ? 'hangInv' : 'hang', c.me.w || '', true); R.meA = (R.meA ?? 1) + ((c.ads ? 0.28 : 1) - (R.meA ?? 1)) * Math.min(1, c.dt * 10); R.me.material.opacity = R.meA; R.me.material.alphaTest = c.ads ? 0.02 : 0.2; R.me.scale.set(BODY * SW / SH, BODY, 1);
  R.me.position.set(me3.x, me3.y + BODY / 2, me3.z);
  const roofY = (m.floors.length - 1 - m.groundFloor) * FH + 0.6 * M, ropeTop = Math.max(me3.y + BODY, roofY);
  R.rope.position.set(me3.x, (me3.y + BODY * 0.75 + ropeTop) / 2, me3.z); R.rope.scale.set(1, ropeTop - me3.y - BODY * 0.75, 1);
  // the people you can see (the same sight lines as the top-down view)
  const keep = new Set();
  for (const p of c.people) {
    const o = floorOff(m, p.f, f), px = p.x + o.x, pz = p.y + o.y, py = (p.f - m.groundFloor) * FH + (p.onRope ? 0.15 * M : 0);
    const toCam = Math.atan2(R.camera.position.z - pz, R.camera.position.x - px), rel = Math.atan2(Math.sin(toCam - p.ag), Math.cos(toCam - p.ag));
    const view = p.onRope ? 'back' : Math.abs(rel) < 0.8 ? 'front' : Math.abs(rel) > 2.35 ? 'back' : rel > 0 ? 'right' : 'left';
    let sp = R.sprites.get(p.id); if (!sp) { sp = new THREE.Sprite(); R.sprites.set(p.id, sp); R.people.add(sp); }
    sp.material = spriteMat(p.op, view, p.pose, p.w || ''); sp.scale.set(BODY * SW / SH, BODY, 1); sp.position.set(px, py + BODY / 2, pz);
    sp.userData = { id: p.id, x: p.x, y: p.y, f: p.f, base: py }; keep.add(p.id);
  }
  for (const [id, sp] of R.sprites) if (!keep.has(id)) { R.people.remove(sp); R.sprites.delete(id); }
  things(c, f);
  // shots seen: a short bright streak at chest height, a spark where it hits
  for (const s of c.shots || []) {
    const o = floorOff(m, s.f, f), y = (s.f - m.groundFloor) * FH + 1.3 * M;
    if (s.hit) { spark(c.now, s.x + o.x, y, s.y + o.y, s.hit === 'blood' ? '#c0201a' : s.hit === 'spark' ? '#9fd4ff' : '#ffe6a0', s.hit === 'blood' ? 9 : 6); continue; }
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(s.x + o.x, y, s.y + o.y), new THREE.Vector3(s.x2 + o.x, y, s.y2 + o.y)]); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#fff2b0', transparent: true, opacity: 0.9 })); l.userData.t = c.now; l.userData.life = 0.08; R.fx.add(l);
    if (s.k === 'hard' || s.k === 'prop') spark(c.now, s.x2 + o.x, y, s.y2 + o.y, '#ffe6a0', 6);
  }
  for (const l of [...R.fx.children]) { const a = c.now - l.userData.t, life = l.userData.life; if (a > life) { R.fx.remove(l); if (l.isLine) l.geometry.dispose(); l.material.dispose(); } else { l.material.opacity = (l.userData.a0 || 0.9) * (1 - a / life); if (l.userData.grow) l.scale.setScalar(l.userData.s0 * (1 + a / life * l.userData.grow)); } }
  // explosions seen: a flash that swells and fades, lighting the wall and the room for a moment
  for (const b of c.booms || []) {
    const o = floorOff(m, b.f, f), y = (b.f - m.groundFloor) * FH + 1.0 * M, col = b.kind === 'stun' || b.kind === 'flare' ? '#ffffff' : b.kind === 'emp' ? '#8fd0ff' : '#ffb04a';
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    const s0 = Math.max(24, b.r * 0.9); sp.scale.setScalar(s0); sp.position.set(b.x + o.x, y, b.y + o.y); Object.assign(sp.userData, { t: c.now, life: 0.5, a0: 1, s0, grow: 1.4 }); R.fx.add(sp);
    R.boom = { t: c.now, col, x: b.x + o.x, y, z: b.y + o.y, r: b.r };
    R.kick = Math.max(R.kick || 0, Math.min(1, b.r / 120) * 6 / (1 + Math.hypot(b.x + o.x - c.pred.x, b.y + o.y - c.pred.y) / (8 * M)));
  }
  if (R.boom) { const a = (c.now - R.boom.t) / 0.4; if (a >= 1) { R.boomL.intensity = 0; R.boom = null; } else { R.boomL.color.set(R.boom.col); R.boomL.position.set(R.boom.x, R.boom.y + 0.5 * M, R.boom.z); R.boomL.distance = Math.max(8 * M, R.boom.r * 4); R.boomL.intensity = 8 * (1 - a); } }
  // the camera: over your right shoulder, a little back from the wall; aim with the mouse (limited, you face the wall)
  const face = new THREE.Vector3(-n[0], 0, -n[1]);
  const dir = face.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -R.yaw); dir.y = Math.tan(R.pitch); dir.normalize();
  const shoulder = me3.clone().addScaledVector(new THREE.Vector3(n[0], 0, n[1]), 3.1 * M).addScaledVector(right, 1.05 * M); shoulder.y = me3.y + BODY * (c.inv ? 0.4 : 1.02);
  R.camera.fov += ((c.ads ? 52 : 70) - R.camera.fov) * Math.min(1, c.dt * 12); R.camera.updateProjectionMatrix();
  // gliding in (from above, looking down) and out (back up to the top-down view) so it never jars
  R.mix = Math.min(1, R.mix + c.dt / 0.45);
  const glide = c.leaving != null ? 1 - c.leaving : R.mix, e = glide * glide * (3 - 2 * glide);
  const above = me3.clone(); above.y += 14 * M; above.addScaledVector(new THREE.Vector3(n[0], 0, n[1]), 0.5 * M);
  R.camera.position.lerpVectors(above, shoulder, e);
  const kick = Math.max(R.kick || 0, (c.shake || 0) * 0.5); R.kick = Math.max(0, (R.kick || 0) - c.dt * 18); // (a blast nearby, the same shake as the top-down view)
  if (kick > 0.05) R.camera.position.add(new THREE.Vector3((Math.random() - 0.5) * kick, (Math.random() - 0.5) * kick, (Math.random() - 0.5) * kick));
  const look = R.camera.position.clone().add(dir.clone().multiplyScalar(10 * M)), down = me3.clone();
  R.camera.lookAt(new THREE.Vector3().lerpVectors(down, look, e));
  R.canvas.style.opacity = String(Math.min(1, e * 1.4));
  R.me.visible = e > 0.3; if (R.upper) R.upper.visible = e > 0.8; for (const pl of R.floorG.children) pl.visible = !pl.userData.up || e > 0.8;
  R.renderer.render(R.scene, R.camera);
  R.dir = dir; R.line = R.line || line; R.m = m; R.f = f; R.n = n; R.meXY = { x: c.pred.x, y: c.pred.y }; R.level = c.height + 1.2 * M;
}
// a soft round glow picture (smoke puffs, flashes, sparks), made once
let glowT = null, smokeT = null;
function glowTex() {
  if (glowT) return glowT;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  glowT = new THREE.CanvasTexture(cv); return glowT;
}
// a smoke puff: lumpy, soft at the edge (several blobs, like the top-down drawSmoke)
function smokeTex() {
  if (smokeT) return smokeT;
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'); let sd = 5; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 26; i++) { const a = rnd() * 7, d = rnd() * 30, r = 18 + rnd() * 22, cx = 64 + Math.cos(a) * d, cy = 64 + Math.sin(a) * d, g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, `rgba(255,255,255,${0.3 + rnd() * 0.2})`); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }
  smokeT = new THREE.CanvasTexture(cv); smokeT.colorSpace = THREE.SRGBColorSpace; return smokeT;
}
function spark(now, x, y, z, col, size) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: col, transparent: true, blending: col === '#c0201a' ? THREE.NormalBlending : THREE.AdditiveBlending, depthWrite: false }));
  sp.scale.setScalar(size); sp.position.set(x, y, z); Object.assign(sp.userData, { t: now, life: 0.14, a0: 1, s0: size, grow: 0.6 }); R.fx.add(sp);
}
// gadgets, drones, cameras and smoke your side sees (main.js r3things decides which): each gadget is its top-down picture
// lying on the floor (cameras and perched birds on a sprite up on the wall), smoke is a stack of soft puffs
function things(c, f) {
  const m = c.m, keep = new Set();
  for (const e of c.ents || []) {
    const o = floorOff(m, e.f, f), y0 = (e.f - m.groundFloor) * FH;
    let g = R.things.get(e.id);
    if (!g || g.userData.wall !== (e.wall || e.fly)) {
      if (g) { R.thingG.remove(g); g.material.map.dispose(); g.material.dispose(); }
      const tex = new THREE.CanvasTexture(e.pic.cv); tex.colorSpace = THREE.SRGBColorSpace;
      if (e.wall || e.fly) g = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.1 }));
      else { g = new THREE.Mesh(R.plane, new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.1, depthWrite: false })); g.rotation.x = -Math.PI / 2; g.renderOrder = 1; }
      g.userData.wall = !!(e.wall || e.fly); R.things.set(e.id, g); R.thingG.add(g);
    }
    if (e.pic.dirty) { g.material.map.needsUpdate = true; e.pic.dirty = false; }
    const w = PIC_W * (g.userData.wall ? 0.7 : 1);
    g.scale.set(w, w, 1);
    g.position.set(e.x + o.x, y0 + (e.wall ? 2.5 * M : e.fly ? 1.8 * M : 3), e.y + o.y);
    keep.add(e.id);
  }
  for (const [id, g] of R.things) if (!keep.has(id)) { R.thingG.remove(g); g.material.map.dispose(); g.material.dispose(); R.things.delete(id); }
  // smoke: puffs from the pool, three heights each, fading out as the cloud ends
  let n = 0;
  for (const s of c.smoke || []) {
    const o = floorOff(m, s.f, f), y0 = (s.f - m.groundFloor) * FH, fade = s.l === undefined ? 1 : Math.min(1, s.l / 2);
    for (let j = 0; j < 3; j++) {
      let sp = R.smoke[n]; if (!sp) { sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex(), transparent: true, depthWrite: false })); R.smoke.push(sp); R.smokeG.add(sp); }
      const wob = Math.sin(c.now * 0.6 + n * 1.7) * 0.06;
      sp.visible = true; sp.material.color.set(s.col); sp.material.opacity = 0.82 * fade * (j === 2 ? 0.7 : 1); sp.material.rotation = n * 0.9 + c.now * 0.05;
      sp.scale.setScalar(s.r * (2.3 - j * 0.25) * (1 + wob)); sp.position.set(s.x + o.x, y0 + (0.6 + j * 0.85) * M, s.y + o.y); n++;
    }
  }
  for (let i = n; i < R.smoke.length; i++) R.smoke[i].visible = false;
}
// where a map point (on floor fl, hm metres up) is on the screen, in CSS px; behind = it's behind you
export function project(x, y, fl, hm = 1) {
  if (!R || !R.on || fl < 0 || !R.m) return null;
  const o = floorOff(R.m, fl, R.f), v = new THREE.Vector3(x + o.x, (fl - R.m.groundFloor) * FH + hm * M, y + o.y);
  const d = v.clone().sub(R.camera.position), behind = d.dot(R.camera.getWorldDirection(new THREE.Vector3())) < 0;
  v.project(R.camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, behind };
}
// which way the view faces, as a map angle
export const facing = () => R && R.dir ? Math.atan2(R.dir.z, R.dir.x) : 0;
export function stop() { if (!R || !R.on) return; R.on = false; R.canvas.style.display = 'none'; R.key = ''; }
export const active = () => !!(R && R.on);

// the mouse turns the view (you can't turn your back to the wall: ±75° sideways, a little up and well down)
export function look(dx, dy) { if (!R) return; R.yaw = Math.max(-1.3, Math.min(1.3, R.yaw + dx * 0.0023)); R.pitch = Math.max(-1.05, Math.min(0.9, R.pitch - dy * 0.0023)); }
// A/D: +1 = along the rope's t (the wall direction the server uses), from what is right on screen
export function wallSign(r) { const n = [Math.round(Math.cos(r.out)), Math.round(Math.sin(r.out))]; return Math.sign(n[1] * r.tx - n[0] * r.ty) || 1; }

// Where the crosshair (the screen's middle) points: the first wall, board, floor or person it meets. Back on the map:
// { ang, x, y } on your own floor (that's where shots go), plus who it is on, if anyone, and whether on the head.
export function aim() {
  if (!R || !R.on) return null;
  R.ray.setFromCamera(new THREE.Vector2(0, 0), R.camera);
  const hits = R.ray.intersectObjects([R.world, R.people], true).filter(h => h.object !== R.me);
  const me = R.meXY; let px, pz, person = null, head = false;
  const h = hits[0];
  if (h && h.object.isSprite) { const u = h.object.userData; person = u.id; px = h.point.x; pz = h.point.z; head = h.point.y > u.base + BODY * 0.8; if (u.f === R.f) { px = u.x; pz = u.y; } }
  else if (h && Math.abs(h.point.y - R.level) < FH * 0.95 && Math.hypot(h.point.x - me.x, h.point.z - me.y) > 1.6 * M) { px = h.point.x; pz = h.point.z; }
  else { px = me.x + R.dir.x * 400; pz = me.y + R.dir.z * 400; }
  const ang = Math.atan2(pz - me.y, px - me.x);
  if (person && !head) { const s = 7; px += Math.cos(ang + Math.PI / 2) * s; pz += Math.sin(ang + Math.PI / 2) * s; } // a body shot: off the head
  return { ang, x: px, y: pz, person, head };
}
// screenshot tests: the scene, to look round it (window.__r62d.r3)
export const debug = () => R;
