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

const M = PX_PER_M, FH = 3.2 * M, BODY = 1.85 * M;
const FLOOR_COL = { [FL.GRASS]: '#4f7a3a', [FL.ASPHALT]: '#3b3d40', [FL.WOOD]: '#8a6a46', [FL.TILE]: '#b9b4a8', [FL.CARPET]: '#6b4b55', [FL.CONCRETE]: '#8f8f8a', [FL.MARBLE]: '#d8d4cc', [FL.SERVER]: '#2c3238', [FL.SAND]: '#c9b27a', [FL.SNOW]: '#e8eef2', [FL.ROOF]: '#55585c' };
const WALL_COL = { [MAT.BRICK]: '#8a5a44', [MAT.DRYWALL]: '#cfc6b4', [MAT.CONCRETE]: '#8d9196' };
const SOLID = new Set([T.HARD, T.SOFT, T.REINF, T.PANEL]);

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
function spriteMat(op, view, pose, gun) {
  const k = op + view + pose + gun; if (texCache.has(k)) return texCache.get(k);
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
  const world = new THREE.Group(), people = new THREE.Group(), fx = new THREE.Group(); scene.add(world, people, fx);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat('#4f7a3a')); ground.rotation.x = -Math.PI / 2; ground.scale.set(200 * M, 200 * M, 1); scene.add(ground);
  const me = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true })); me.renderOrder = 2; scene.add(me);
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1, 6), mat('#c8b27a')); scene.add(rope);
  R = { renderer, scene, camera, canvas, world, people, fx, ground, me, rope, yaw: 0, pitch: 0, key: '', sig: '', mix: 0, on: false, out: 0, ray: new THREE.Raycaster(), sprites: new Map(), tracers: [] };
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
  const lvlY = (f - gi) * FH, upperG = new Map(); // ceilings and what is above your floor: hidden while the camera looks down (gliding in or out)
  const groups = new Map(); // material -> box list (drawn as one instanced mesh each: thousands of boxes stay quick)
  const add = (col, x, y, z, sx, sy, sz, name, surfMat) => { const mt = surfMat !== undefined ? surface(surfMat, sy / FH) : mat(col); const G = y - sy / 2 >= lvlY + FH - 4 ? upperG : groups; if (!G.has(mt)) G.set(mt, []); const b = { x, y, z, sx, sy, sz, set material(v) { G.get(mt).splice(G.get(mt).indexOf(b), 1); if (!G.has(v)) G.set(v, []); G.get(v).push(b); }, rotation: {} }; G.get(mt).push(b); return b; };
  const span = 22, inner = 26, sig = [];
  const cellOn = (g, X, Y) => { const o = floorOff(m, f, g), gx = Math.floor((X + o.x) / CELL), gy = Math.floor((Y + o.y) / CELL); if (gx < 0 || gy < 0 || gx >= W || gy >= m.H) return -1; const k = gy * W + gx; return m.flAt[k] === g ? k : -1; };
  const done = new Set(); let lights = 0;
  for (let g = gi; g < top; g++) {
    const y0 = (g - gi) * FH, roof = g === m.roofFloor;
    for (let i = -span; i <= span; i++) {
      // the wall cell's middle on floor f (one cell in from the ledge)
      const X = cx - n[0] * CELL + t[0] * i * CELL, Y = cy - n[1] * CELL + t[1] * i * CELL;
      const k = cellOn(g, X, Y); if (k < 0) continue;
      const tl = m.tiles[k]; sig.push(tl);
      const col = WALL_COL[m.mat[k]] || WALL_COL[MAT.DRYWALL];
      const sx = t[0] ? CELL : CELL, sz = CELL;
      if (roof) { const out = cellOn(g, X + n[0] * CELL, Y + n[1] * CELL); if ((tl === T.FLOOR || tl === T.GROUND) && (out < 0 || m.tiles[out] === T.VOID || m.tiles[out] === T.LOW)) add('#6a6d70', X, y0 + 0.25 * M, Y, sx, 0.5 * M, sz); continue; } // a low parapet round the roof
      if (SOLID.has(tl)) { add(col, X, y0 + FH / 2, Y, sx, FH, sz, 'w', m.mat[k]); add(shadeCol(col), X + n[0] * CELL * 0.52, y0 + 0.12 * M, Y + n[1] * CELL * 0.52, sx, 0.25 * M, 2); continue; }
      const win = m.win[k], oi = m.openId[k], door = oi >= 0 && m.openings[oi] && m.openings[oi].kind === 'door';
      if (win || door || tl === T.BARRI) {
        const sill = win ? 0.9 * M : 0, lint = win ? 2.2 * M : 2.3 * M;
        if (sill) add(col, X, y0 + sill / 2, Y, sx, sill, sz, 'w', m.mat[k]);
        add(col, X, y0 + (lint + FH) / 2, Y, sx, FH - lint, sz, 'w', m.mat[k]);
        if (win) add('#e8e2d4', X + n[0] * CELL * 0.45, y0 + sill - 2, Y + n[1] * CELL * 0.45, t[0] ? CELL : CELL * 0.3, 4, t[1] ? CELL : CELL * 0.3); // the sill's lip
        if (tl === T.BARRI) { const hp = m.hp[k] || 0; for (let j = 0; j < 3; j++) { const b = add(j % 2 ? '#7a5a36' : '#8b6a42', X - n[0] * 2, y0 + sill + (lint - sill) * (0.2 + j * 0.3), Y - n[1] * 2, t[0] ? CELL * 1.05 : 3, 0.32 * M, t[1] ? CELL * 1.05 : 3, 'b'); b.rotation.y = 0; b.material = mat(hp < 40 ? '#5c4228' : j % 2 ? '#7a5a36' : '#8b6a42'); } }
        if (lights < 4) { const L = new THREE.PointLight('#ffe8c8', 1.2, 10 * M, 1.4); L.position.set(X - n[0] * CELL * 4, y0 + FH * 0.8, Y - n[1] * CELL * 4); grp.add(L); lights++; }
        // the room behind it (this floor, a little to each side and some way in)
        for (let d = 1; d <= inner; d++) for (let j = -9; j <= 9; j++) {
          const RX = X - n[0] * CELL * d + t[0] * CELL * j, RY = Y - n[1] * CELL * d + t[1] * CELL * j, rk = cellOn(g, RX, RY);
          if (rk < 0 || done.has(rk)) continue; done.add(rk);
          const rt = m.tiles[rk];
          if (SOLID.has(rt) || rt === T.BARRI) add(rt === T.BARRI ? '#7a5a36' : '#bdb5a6', RX, y0 + FH / 2, RY, CELL, FH, CELL, 'w');
          else if (rt === T.TALL) add('#5c5248', RX, y0 + 0.9 * M, RY, CELL * 0.98, 1.8 * M, CELL * 0.98, 'p');
          else if (rt === T.LOW && m.floor[rk] !== FL.VOID) add('#6e5c48', RX, y0 + 0.45 * M, RY, CELL * 0.98, 0.9 * M, CELL * 0.98, 'p');
          if (rt !== T.VOID && !(rt === T.LOW && m.floor[rk] === FL.VOID)) {
            add(FLOOR_COL[m.floor[rk]] || '#8f8f8a', RX, y0 + 1, RY, CELL, 2, CELL, 'f');
            add('#2a2a2c', RX, y0 + FH - 1, RY, CELL, 2, CELL); // ceiling
          }
        }
        continue;
      }
    }
    // the floor slab line between levels
  }
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion();
  const up = new THREE.Group(); up.name = 'upper'; grp.add(up);
  for (const [G, into] of [[groups, grp], [upperG, up]]) for (const [mt, list] of G) { if (!list.length) continue; const im = new THREE.InstancedMesh(BOX, mt, list.length); list.forEach((b, i) => im.setMatrixAt(i, mtx.compose(new THREE.Vector3(b.x, b.y, b.z), q, new THREE.Vector3(b.sx, b.sy, b.sz)))); im.instanceMatrix.needsUpdate = true; into.add(im); }
  R.upper = up;
  // ground under the wall
  const gk = cellOn(gi, cx + n[0] * CELL * 2, cy + n[1] * CELL * 2);
  R.ground.material = mat(gk >= 0 ? FLOOR_COL[m.floor[gk]] || '#4f7a3a' : '#4f7a3a'); R.ground.position.set(cx, -0.5, cy);
  return sig.join(',');
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
    if (key !== R.key) { R.sig = build(c, line); R.key = key; R.line = line; }
    else { const s = build(c, R.line); R.sig = s; } // (boards coming off, windows opening)
    R.sigT = c.now;
  }
  if (!R.on) { R.on = true; R.yaw = 0; R.pitch = 0.05; R.mix = 0; R.canvas.style.display = 'block'; }
  // where you hang: just outside the wall, at window height (upside down: higher, head at the top of the window)
  const out = 0.35 * M, me3 = new THREE.Vector3(c.pred.x + n[0] * out, c.height + (c.inv ? 1.6 * M : 0.15 * M), c.pred.y + n[1] * out);
  const right = new THREE.Vector3(n[1], 0, -n[0]); // to your right as you face the wall
  // your operator from behind, the rope up to the roof
  R.me.material = spriteMat(c.me.op, 'back', c.inv ? 'hangInv' : 'hang', c.me.w || ''); R.me.scale.set(BODY * SW / SH, BODY, 1);
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
  // shots seen: a short bright streak at chest height
  for (const s of c.shots || []) { const o = floorOff(m, s.f, f), y = (s.f - m.groundFloor) * FH + 1.3 * M; const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(s.x + o.x, y, s.y + o.y), new THREE.Vector3(s.x2 + o.x, y, s.y2 + o.y)]); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#fff2b0', transparent: true, opacity: 0.9 })); l.userData.t = c.now; R.fx.add(l); }
  for (const l of [...R.fx.children]) { const a = c.now - l.userData.t; if (a > 0.08) { R.fx.remove(l); l.geometry.dispose(); } else l.material.opacity = 0.9 * (1 - a / 0.08); }
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
  const look = R.camera.position.clone().add(dir.clone().multiplyScalar(10 * M)), down = me3.clone();
  R.camera.lookAt(new THREE.Vector3().lerpVectors(down, look, e));
  R.canvas.style.opacity = String(Math.min(1, e * 1.4));
  R.me.visible = e > 0.3; if (R.upper) R.upper.visible = e > 0.8;
  R.renderer.render(R.scene, R.camera);
  R.dir = dir; R.line = R.line || line; R.f = f; R.n = n; R.meXY = { x: c.pred.x, y: c.pred.y }; R.level = c.height + 1.2 * M;
}
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
