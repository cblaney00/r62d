// Operators as real 3D models, for the 3D rope view (he asked 2026-11-13: significantly better 3D operators, exactly in
// line with what you see top-down, with more detail). Built in code from simple shapes like everything else, from the
// same data as the top-down drawing: uniform colours and pattern (sprites.js uniformOf), side colour on armbands /
// gloves / vest / pack / helmet band (accentsOf, SIDE_COL), helmet colour and team colour (OPERATORS), the vest cut and
// the back item (headgear.js VEST / PACK), each operator's own headgear (HEAD below, from the HEADGEAR descriptions),
// skin and hair (the same picks as sprites.js), and the gun built from the gun pictures' own shape table (gunart.js G).
// Units are metres, feet at the origin, facing +x (right = +z). rope3d.js scales a model by PX_PER_M.
//   makeOperator(op, gun) -> THREE.Group with .pose(name, t, moving) to set the pose each frame
//   poses: 'stand' | 'crouch' | 'down' | 'hang' | 'hangInv' (hanging is from the side of a wall, facing it)
import * as THREE from './vendor/three.module.min.js';
import { OPERATORS, LOADOUTS, RIOT, BODY_W } from '/shared/operators.js';
import { uniformOf, accentsOf, SIDE_COL } from './sprites.js';
import { PACK, VEST } from './headgear.js';
import { G as GUNS } from './gunart.js';

const SKIN = ['#c99a78', '#a8785a', '#7a5238', '#e0b393', '#8d6346'];
const HAIR = ['#1b1512', '#3a2618', '#5a3a22', '#8a6a3a', '#c9a060', '#2a2a2a', '#6a2a1a', '#d8d2c4'];
const skinOf = op => SKIN[(op.charCodeAt(0) + op.length) % SKIN.length];
const hairOf = op => HAIR[(op.charCodeAt(0) * 7 + op.charCodeAt(op.length - 1) * 3 + op.length) % HAIR.length];
const shade = (hex, k) => { if (!hex || hex[0] !== '#') return hex || '#888'; const n = parseInt(hex.slice(1), 16), c = v => Math.max(0, Math.min(255, Math.round(v * k))); return '#' + [c(n >> 16), c((n >> 8) & 255), c(n & 255)].map(v => v.toString(16).padStart(2, '0')).join(''); };

// ---------------- shared geometry and materials ----------------
// a unit box with rounded edges (r = edge radius as a share of the side): pushes the corners of a finely divided cube in
function roundBox(r) {
  const g = new THREE.BoxGeometry(1, 1, 1, 6, 6, 6), p = g.attributes.position, v = new THREE.Vector3(), h = 0.5 - r;
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const c = new THREE.Vector3(Math.max(-h, Math.min(h, v.x)), Math.max(-h, Math.min(h, v.y)), Math.max(-h, Math.min(h, v.z))), d = v.clone().sub(c); if (d.lengthSq() > 0) v.copy(c).add(d.normalize().multiplyScalar(r)); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g;
}
const GEO = {
  box: roundBox(0.12),
  sph: new THREE.SphereGeometry(0.5, 32, 20),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 28),
  cylL: new THREE.CylinderGeometry(0.5, 0.5, 1, 14),
  cap: new THREE.SphereGeometry(0.5, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2), // a dome (helmets)
  tor: new THREE.TorusGeometry(0.5, 0.12, 10, 32),
  band: new THREE.TorusGeometry(0.5, 0.035, 8, 40), // a thin strap (headbands)
  cone: new THREE.ConeGeometry(0.5, 1, 20),
  ring: new THREE.CylinderGeometry(0.5, 0.5, 1, 28, 1, true), // an open band (armbands, straps)
  low: new THREE.SphereGeometry(0.5, 32, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), // the lower half of a ball (face masks)
};
const limbGeo = new Map(); // tapered limbs: radius at the top and bottom of a unit-long piece
const taper = (a, b) => { const k = a.toFixed(3) + b.toFixed(3); if (!limbGeo.has(k)) limbGeo.set(k, new THREE.CylinderGeometry(a, b, 1, 20)); return limbGeo.get(k); };
const MATS = new Map();
function mat(col, o = {}) {
  const k = col + '|' + (o.rough ?? 0.85) + '|' + (o.metal ?? 0) + '|' + (o.op ?? 1) + '|' + (o.emit || '') + '|' + (o.map ? o.map.uuid : '');
  if (!MATS.has(k)) MATS.set(k, new THREE.MeshStandardMaterial({ color: col, roughness: o.rough ?? 0.85, metalness: o.metal ?? 0, transparent: (o.op ?? 1) < 1, opacity: o.op ?? 1, emissive: o.emit || '#000000', emissiveIntensity: o.emit ? 1.2 : 0, map: o.map || null }));
  return MATS.get(k);
}
const metal = col => mat(col, { rough: 0.45, metal: 0.55 });

// the uniform's pattern as a cloth texture (the same patterns and colours as the top-down torso, tiled)
const PATS = new Map();
function clothTex(u) {
  const k = u.cloth + '|' + u.pat + '|' + u.pc; if (PATS.has(k)) return PATS.get(k);
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.scale(2, 2); x.fillStyle = u.cloth; x.fillRect(0, 0, 128, 128);
  let sd = 9; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 400; i++) { x.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)'; x.fillRect(rnd() * 128, rnd() * 128, 2, 1); } // weave
  x.fillStyle = u.pc || '#000'; x.strokeStyle = u.pc || '#000';
  switch (u.pat) {
    case 'camo': for (let i = 0; i < 16; i++) { x.beginPath(); x.ellipse(rnd() * 128, rnd() * 128, 10 + rnd() * 10, 5 + rnd() * 6, rnd() * 3, 0, 7); x.fill(); } break;
    case 'digital': for (let i = 0; i < 90; i++) x.fillRect(Math.floor(rnd() * 16) * 8, Math.floor(rnd() * 16) * 8, 8, 8); break;
    case 'tiger': x.lineWidth = 5; for (let y = 0; y < 128; y += 16) { x.beginPath(); x.moveTo(0, y); x.lineTo(40, y + 6); x.lineTo(70, y - 2); x.lineTo(128, y + 5); x.stroke(); } break;
    case 'stripe': x.fillRect(0, 54, 128, 20); break;
    case 'hazard': x.lineWidth = 10; for (let i = -128; i < 256; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 128, 128); x.stroke(); } break;
    case 'check': for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2 === 0) x.fillRect(i * 16, j * 16, 16, 16); break;
    case 'hex': x.lineWidth = 2; for (let j = 0; j < 9; j++) for (let i = 0; i < 9; i++) { const cx = i * 16 + (j % 2) * 8, cy = j * 14; x.beginPath(); for (let a = 0; a < 6; a++) x.lineTo(cx + Math.cos(a * Math.PI / 3) * 7, cy + Math.sin(a * Math.PI / 3) * 7); x.closePath(); x.stroke(); } break;
    case 'zig': x.lineWidth = 6; for (let y = 16; y < 128; y += 40) { x.beginPath(); for (let i = 0; i <= 8; i++) x.lineTo(i * 16, y + (i % 2 ? -10 : 10)); x.stroke(); } break;
    case 'circuit': x.lineWidth = 2; for (let i = 0; i < 14; i++) { const a = rnd() * 128, b = rnd() * 128; x.beginPath(); x.moveTo(a, b); x.lineTo(a + 24, b); x.lineTo(a + 24, b + 18); x.stroke(); x.fillRect(a + 22, b + 16, 5, 5); } break;
    case 'spots': for (let i = 0; i < 30; i++) { x.beginPath(); x.arc(rnd() * 128, rnd() * 128, 3 + rnd() * 4, 0, 7); x.fill(); } break;
    case 'splatter': for (let i = 0; i < 22; i++) { const a = rnd() * 128, b = rnd() * 128; x.beginPath(); x.arc(a, b, 3 + rnd() * 3, 0, 7); x.fill(); x.fillRect(a, b - 1, 10, 2); } break;
    case 'char': x.globalAlpha = 0.6; for (let i = 0; i < 18; i++) { x.beginPath(); x.ellipse(rnd() * 128, rnd() * 128, 12, 5, rnd() * 3, 0, 7); x.fill(); } x.globalAlpha = 1; break;
    case 'split': x.fillRect(0, 64, 128, 64); break;
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1.5, 1.5);
  PATS.set(k, t); return t;
}

// a mesh of shared geometry g, scaled (sx, sy, sz), at (x, y, z), into parent
function add(parent, g, m, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
  const o = new THREE.Mesh(GEO[g] || g, m); o.position.set(x, y, z); o.scale.set(sx, sy ?? sx, sz ?? sx); o.rotation.set(rx, ry, rz); parent.add(o); return o;
}

// ---------------- the gun (from the gun pictures' shape table, so it is the same gun) ----------------
const K = 0.0092; // gun picture px -> metres
function makeGun(w) {
  const g = GUNS[w] || GUNS.k4, grp = new THREE.Group(), body = metal(g.tan ? '#b29a6c' : g.body), furn = mat(g.furn, { rough: 0.7 }), X = px => (px - g.grip) * K;
  const big = g.big ? 1.2 : 1, pis = !!g.pistol;
  const r0 = X(g.rec[0]), r1 = X(g.rec[1]), mz = X(g.bar);
  add(grp, 'box', body, (r0 + r1) / 2, 0.035, 0, r1 - r0, (pis ? 0.045 : 0.07) * big, (pis ? 0.03 : 0.045) * big); // receiver / slide
  if (g.guard[1] > g.guard[0]) add(grp, 'box', furn, (X(g.guard[0]) + X(g.guard[1])) / 2, 0.03, 0, X(g.guard[1]) - X(g.guard[0]), 0.06, 0.05); // handguard
  const bl = mz - Math.max(r1, X(g.guard[1]));
  if (bl > 0.005) add(grp, 'cylL', body, Math.max(r1, X(g.guard[1])) + bl / 2, 0.04, 0, 0.018, bl, 0.018, 0, 0, Math.PI / 2); // barrel
  if (g.double) add(grp, 'cylL', body, (r1 + mz) / 2, 0.06, 0, 0.018, mz - r1, 0.018, 0, 0, Math.PI / 2);
  if (g.can) add(grp, 'cylL', metal('#1d1f22'), mz + 0.07, 0.04, 0, 0.04, 0.16, 0.04, 0, 0, Math.PI / 2); // suppressor
  if (g.brake) add(grp, 'box', body, mz + 0.02, 0.04, 0, 0.05, 0.035, 0.035);
  if (g.pump) add(grp, 'cylL', furn, X(g.guard[0]) + 0.08, 0.0, 0, 0.034, 0.16, 0.034, 0, 0, Math.PI / 2);
  add(grp, 'box', furn, 0, -0.06, 0, 0.035, 0.1, 0.03, 0, 0, -0.25); // pistol grip
  switch (g.mag) { // the magazine
    case 'curved': add(grp, 'box', body, X(g.rec[1]) - 0.06, -0.06, 0, 0.045, 0.14, 0.03, 0, 0, 0.3); break;
    case 'straight': case 'short': case 'box': add(grp, 'box', body, X(g.rec[1]) - 0.06, -0.05, 0, 0.05, g.mag === 'short' ? 0.08 : 0.12, 0.035); break;
    case 'long': add(grp, 'box', body, X(g.rec[1]) - 0.05, -0.08, 0, 0.035, 0.2, 0.03); break;
    case 'drum': add(grp, 'cyl', body, X(g.rec[1]) - 0.06, -0.07, 0, 0.13, 0.06, 0.13, Math.PI / 2); break;
    case 'belt': add(grp, 'box', mat('#4a4a32'), X(g.rec[1]) - 0.08, -0.07, 0.03, 0.11, 0.1, 0.09); break;
    case 'bullpup': add(grp, 'box', body, X(g.rec[0]) + 0.08, -0.05, 0, 0.05, 0.11, 0.035); break;
    case 'gripLong': add(grp, 'box', body, 0, -0.13, 0, 0.03, 0.08, 0.026); break;
  }
  switch (g.stock) { // the stock
    case 'adjust': case 'fold': add(grp, 'box', furn, r0 - 0.1, 0.01, 0, 0.2, 0.05, 0.035); add(grp, 'box', furn, r0 - 0.2, -0.01, 0, 0.04, 0.1, 0.04); break;
    case 'wood': case 'heavy': case 'cheek': case 'thumb': add(grp, 'box', furn, r0 - 0.13, -0.01, 0, 0.26, g.stock === 'heavy' ? 0.1 : 0.08, 0.045, 0, 0, 0.1); break;
    case 'bullpup': add(grp, 'box', furn, r0 + 0.02, -0.005, 0, 0.12, 0.09, 0.05); break;
  }
  if (g.rail && !pis) add(grp, 'box', metal('#1a1b1d'), (r0 + r1) / 2 + 0.02, 0.085, 0, 0.09, 0.035, 0.03); // a sight
  if (g.handle) add(grp, 'box', body, (r0 + r1) / 2, 0.1, 0, 0.12, 0.02, 0.02);
  if (g.bipod) for (const s of [-1, 1]) add(grp, 'cylL', body, mz - 0.14, -0.06, s * 0.03, 0.01, 0.13, 0.01, s * 0.3, 0, 0);
  if (g.revolver) add(grp, 'cyl', body, r0 + 0.04, 0.03, 0, 0.06, 0.05, 0.06, 0, 0, Math.PI / 2);
  grp.userData.fore = Math.min(mz - 0.05, X(g.guard[1] > g.guard[0] ? (g.guard[0] + g.guard[1]) / 2 : g.rec[1])); // where the other hand goes
  grp.userData.pistol = pis;
  grp.userData.butt = g.stock === 'none' ? r0 : g.stock === 'bullpup' ? r0 - 0.04 : g.stock === 'adjust' || g.stock === 'fold' ? r0 - 0.22 : r0 - 0.26; // the end of the stock (goes in the shoulder)
  return grp;
}
const gunFor = op => { const L = LOADOUTS[op]; return (L && L.primaries.find(w => !RIOT[w] && GUNS[w])) || 'k4'; };

// ---------------- headgear (one per operator, from the HEADGEAR descriptions) ----------------
// Head frame: centre of the head at the origin, face toward +x, r = head radius. Helpers below.
const R0 = 0.12;
function H(h, o, P) {
  const helm = mat(o.helmet || '#3a3d42', { rough: 0.6 }), col = mat(o.color || '#888'), dark = mat('#17181b'), skin = P.skin, hair = mat(P.hair);
  const shell = (m = helm, s = 1.12, low = 0) => add(h, 'cap', m, -0.005, -0.01 - low, 0, R0 * 2 * s, R0 * 2 * s * 0.95, R0 * 2 * s); // dome over the head
  const brim = (m, r, y = 0.005, th = 0.012) => add(h, 'cyl', m, 0, y, 0, r * 2, th, r * 2);
  const peak = (m, len = 0.07, y = 0.02, back = false) => add(h, 'box', m, (back ? -1 : 1) * (R0 + len / 2 - 0.02), y, 0, len, 0.012, 0.15);
  const visor = (c, opq = 0.75, y = 0, w = 0.2, hh = 0.09) => add(h, 'box', mat(c, { rough: 0.15, metal: 0.3, op: opq }), R0 * 0.95, y, 0, 0.03, hh, w);
  const goggles = (lens = '#6ac8dc', y = 0.045, x = R0 * 0.9) => { add(h, 'box', dark, x, y, 0, 0.035, 0.04, 0.17); for (const s of [-1, 1]) add(h, 'cyl', mat(lens, { rough: 0.1, metal: 0.4 }), x + 0.02, y, s * 0.04, 0.035, 0.012, 0.035, 0, 0, Math.PI / 2); add(h, 'tor', dark, 0, y, 0, R0 * 2.06, R0 * 2.06, R0 * 0.5, Math.PI / 2); };
  const cups = (m = dark, r = 0.05) => { for (const s of [-1, 1]) add(h, 'cyl', m, 0, -0.005, s * (R0 + 0.012), r * 2, 0.035, r * 2, Math.PI / 2); add(h, 'band', m, 0, 0.005, 0, R0 * 2.25, R0 * 2.2, R0 * 1.2, 0, Math.PI / 2, 0); };
  const hairCap = (m = hair, s = 1.03) => add(h, 'cap', m, -0.01, -0.005, 0, R0 * 2 * s, R0 * 2 * s * 0.9, R0 * 2 * s);
  const mask = (m = dark, y = -0.05) => add(h, 'box', m, R0 * 0.75, y, 0, 0.07, 0.07, 0.15);
  const filter = (m = mat('#3a3d40'), z = 0, y = -0.06) => add(h, 'cyl', m, R0 + 0.02, y, z, 0.05, 0.035, 0.05, 0, 0, Math.PI / 2);
  const antenna = (len = 0.22, z = -0.06) => { add(h, 'cylL', metal('#888'), -0.03, R0 + len / 2, z, 0.006, len, 0.006, 0.25); add(h, 'sph', col, -0.06, R0 + len, z - 0.0, 0.018); };
  const lamp = (y = 0.08) => { add(h, 'cyl', dark, R0 + 0.01, y, 0, 0.045, 0.03, 0.045, 0, 0, Math.PI / 2); add(h, 'cyl', mat('#fff6d0', { emit: '#fff0b0' }), R0 + 0.027, y, 0, 0.034, 0.006, 0.034, 0, 0, Math.PI / 2); };
  const band = c => add(h, 'cyl', mat(c), 0, 0.03, 0, R0 * 2.18, 0.022, R0 * 2.18);
  const hood = (m, s = 1.25) => { add(h, 'sph', m, -0.02, 0.005, 0, R0 * 2 * s, R0 * 2 * s * 1.02, R0 * 2 * s * 0.98); add(h, 'box', m, -0.04, -0.13, 0, 0.18, 0.1, 0.24); };
  const face = () => add(h, 'sph', mat(skin), R0 * 0.82, -0.005, 0, 0.07, 0.15, 0.16); // a face patch left open in a hood
  switch (P.op) {
    // ---- attack ----
    case 'ember': hood(mat(shade(o.helmet, 0.9))); face(); add(h, 'box', mat('#2a2620'), R0 + 0.01, 0.09, 0, 0.03, 0.06, 0.19, 0, 0, -0.9); add(h, 'box', mat('#ff8c28', { op: 0.6, rough: 0.2 }), R0 + 0.025, 0.1, 0, 0.01, 0.045, 0.16, 0, 0, -0.9); break;
    case 'kestrel': shell(helm, 1.13); for (const s of [-1, 1]) add(h, 'box', mat('#cfc6b4'), -0.01, -0.06, s * (R0 + 0.005), 0.09, 0.11, 0.025); add(h, 'cyl', mat('#d8cfbd'), -0.01, 0.0, 0, R0 * 2.3, 0.04, R0 * 2.3); goggles('#78c8dc', 0.07); break;
    case 'hammer': shell(mat('#e3b23a', { rough: 0.5 }), 1.1); brim(mat('#d8a428', { rough: 0.5 }), 0.16, -0.0); add(h, 'box', mat('#efc25a'), 0, R0 * 1.05, 0, 0.2, 0.025, 0.03); break;
    case 'talon': shell(helm, 1.08); peak(helm, 0.06); antenna(0.24); add(h, 'box', dark, R0 + 0.01, 0.01, 0.045, 0.03, 0.04, 0.04); add(h, 'box', mat(o.color, { emit: o.color }), R0 + 0.028, 0.01, 0.045, 0.005, 0.025, 0.025); break;
    case 'bulwark': shell(helm, 1.2, 0.01); visor('#7ab8e0', 0.7, -0.01, 0.24, 0.17); break;
    case 'rivet': hood(mat('#1d2328')); add(h, 'sph', mat('#2c3238'), R0 * 0.7, 0.0, 0, 0.07, 0.13, 0.17); add(h, 'sph', mat('#6eaac8', { op: 0.85, rough: 0.1 }), R0 * 0.82, 0.0, 0, 0.05, 0.1, 0.13); add(h, 'tor', mat('#0e1114'), -0.01, 0.0, 0, R0 * 2.3, R0 * 2.3, R0 * 2.3, 0, Math.PI / 2, 0); break;
    case 'haze': hairCap(); mask(mat('#4a4c48'), -0.04); for (const s of [-1, 1]) filter(undefined, s * 0.06, -0.07); goggles('#9aa4aa', 0.04); break;
    case 'glint': shell(mat(o.helmet, { rough: 0.3, metal: 0.3 }), 1.18); add(h, 'tor', dark, 0, 0.02, 0, R0 * 2.4, R0 * 2.4, R0 * 2.4, Math.PI / 2); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(h, 'sph', col, Math.cos(a) * R0 * 1.2, 0.02, Math.sin(a) * R0 * 1.2, 0.02); } break;
    case 'brisk': hairCap(); band(o.color); add(h, 'cylL', hair, -R0 - 0.06, -0.04, 0, 0.035, 0.16, 0.035, 0, 0, -0.9); break;
    case 'onyx': add(h, 'sph', helm, -0.01, 0.01, 0, R0 * 2.9, R0 * 2.8, R0 * 2.7); visor('#3a4a58', 0.85, 0.0, 0.24, 0.12); add(h, 'box', helm, R0 * 1.2, 0, 0, 0.02, 0.15, 0.27); break;
    case 'prism': hairCap(); add(h, 'box', mat('#c080ff', { emit: '#a060ff', op: 0.8 }), R0 + 0.005, 0.02, 0, 0.012, 0.03, 0.21); break;
    case 'volt': shell(helm, 1.12); brim(helm, 0.135, 0.0, 0.01); lamp(0.06); break;
    case 'tether': shell(helm, 1.08); brim(helm, 0.19, -0.005, 0.01); break;
    case 'strider': hairCap(mat(shade(P.hair, 1.1)), 1.0); add(h, 'sph', hair, -0.02, R0 + 0.02, 0, 0.06); add(h, 'cyl', dark, 0, -0.01, R0 + 0.01, 0.025, 0.015, 0.025, Math.PI / 2); break;
    case 'ferro': add(h, 'sph', mat(o.helmet), -0.005, 0.03, 0, R0 * 2.2, R0 * 1.9, R0 * 2.2); add(h, 'cyl', mat(shade(o.helmet, 0.8)), 0, -0.02, 0, R0 * 2.22, 0.04, R0 * 2.22); add(h, 'sph', mat(o.color), -0.01, R0 + 0.04, 0, 0.06); break;
    case 'salvo': hairCap(); cups(mat('#2a2e26'), 0.055); break;
    case 'torque': add(h, 'sph', helm, -0.005, 0.0, 0, R0 * 2.5, R0 * 2.5, R0 * 2.45); visor('#14161a', 0.92, 0.01, 0.2, 0.06); add(h, 'box', col, 0, R0 * 1.2, 0, 0.27, 0.01, 0.04); break;
    case 'rush': for (let i = 0; i < 4; i++) add(h, 'cap', helm, -0.01 + (i - 1.5) * 0.002, -0.0, 0, R0 * 2.2 - i * 0.01, R0 * 2.05 - i * 0.02, R0 * 2.2 - i * 0.01, 0, i * 0.8, 0); add(h, 'cylL', dark, 0.0, -0.08, 0, 0.012, 0.2, 0.012, Math.PI / 2); break;
    case 'blaze': hairCap(mat(shade(P.hair, 0.9)), 1.0); add(h, 'box', mat('#ff6a1a'), -0.02, R0 + 0.025, 0, 0.18, 0.07, 0.03); add(h, 'box', mat('#101214', { rough: 0.1, metal: 0.5 }), R0 + 0.005, 0.03, 0, 0.02, 0.03, 0.2); break;
    case 'echo': hood(mat('#c8b88a'), 1.15); face(); add(h, 'box', mat('#b8a87a'), -R0 - 0.02, -0.08, 0.04, 0.03, 0.14, 0.06, 0.2); break;
    case 'mark': hairCap(); shell(helm, 1.05); peak(helm, 0.07); add(h, 'box', mat('#ffd23a', { op: 0.75, rough: 0.1 }), R0 + 0.01, 0.025, 0, 0.012, 0.03, 0.19); break;
    case 'patch': shell(mat('#e8eaea'), 1.13); add(h, 'cyl', mat('#ffffff'), R0 * 0.75, 0.07, 0, 0.06, 0.01, 0.06, 0, 0, Math.PI / 2 - 0.6); add(h, 'box', mat('#c22'), R0 * 0.8, 0.075, 0, 0.012, 0.04, 0.012, 0, 0, -0.6); add(h, 'box', mat('#c22'), R0 * 0.8, 0.075, 0, 0.012, 0.012, 0.04, 0, 0, -0.6); break;
    case 'trench': shell(helm, 1.1); brim(helm, 0.165, -0.005, 0.01); break;
    case 'wren': hairCap(); add(h, 'sph', mat(o.helmet), -0.01, R0 * 0.75, -0.035, 0.27, 0.07, 0.25, 0.25); add(h, 'sph', mat(o.color), 0.03, R0 * 0.75 + 0.02, -0.08, 0.02); break;
    case 'vapor': hood(mat('#2a2c30'), 1.12); add(h, 'box', mat('#3a3d42'), R0 * 0.8, 0.0, 0, 0.07, 0.16, 0.18); for (const s of [-1, 1]) add(h, 'cyl', mat('#7ad', { op: 0.85, rough: 0.1 }), R0 + 0.02, 0.03, s * 0.04, 0.045, 0.01, 0.045, 0, 0, Math.PI / 2); filter(mat('#55595f'), 0, -0.07); break;
    case 'crow': hood(mat('#101012'), 1.22); add(h, 'cone', mat('#1a1a1e', { rough: 0.4 }), R0 + 0.07, -0.02, 0, 0.07, 0.17, 0.07, 0, 0, -Math.PI / 2); for (const s of [-1, 1]) add(h, 'sph', mat('#c02020', { emit: '#801010' }), R0 + 0.0, 0.03, s * 0.04, 0.025); break;
    // ---- defence ----
    case 'mason': shell(helm, 1.14); for (const s of [-1, 1]) add(h, 'box', dark, 0, 0.0, s * (R0 * 1.12), 0.12, 0.025, 0.012); add(h, 'box', dark, R0 * 0.95, 0.08, 0, 0.04, 0.035, 0.05); break;
    case 'veil': hood(mat(o.helmet), 1.1); face(); add(h, 'tor', dark, 0, 0.03, 0, R0 * 2.4, R0 * 2.4, R0 * 1.8, 0, Math.PI / 2, 0); add(h, 'cylL', dark, R0 * 0.6, -0.05, R0 + 0.01, 0.008, 0.1, 0.008, 0, 0.8, Math.PI / 2); break;
    case 'lynx': hairCap(); add(h, 'cap', mat(o.helmet), -0.005, 0.0, 0, R0 * 2.12, R0 * 1.9, R0 * 2.12); for (const s of [-1, 1]) add(h, 'box', mat(o.helmet), -R0 - 0.03, -0.01, s * 0.02, 0.07, 0.025, 0.02, 0, s * 0.4, -0.3); break;
    case 'solace': add(h, 'cap', mat('#9ad0d8'), -0.005, 0.0, 0, R0 * 2.12, R0 * 1.95, R0 * 2.12); add(h, 'box', mat('#9ad0d8'), -R0 - 0.02, 0.02, 0, 0.05, 0.02, 0.06); break;
    case 'wraith': hood(mat('#1a1a20'), 1.28); add(h, 'box', mat('#0a0a0c'), R0 + 0.0, 0.0, 0, 0.02, 0.12, 0.15); add(h, 'box', mat(o.color, { emit: o.color }), R0 + 0.012, 0.02, 0, 0.006, 0.014, 0.12); break;
    case 'bramble': hairCap(); add(h, 'tor', hair, 0, 0.06, 0, R0 * 2.0, R0 * 2.0, R0 * 2.0, Math.PI / 2); break;
    case 'kite': hairCap(); add(h, 'box', mat('#202226'), R0 + 0.035, 0.03, 0, 0.08, 0.065, 0.19); add(h, 'box', mat(o.color), R0 + 0.077, 0.03, 0, 0.006, 0.04, 0.15); add(h, 'tor', dark, 0, 0.03, 0, R0 * 2.1, R0 * 2.1, R0 * 2.1, Math.PI / 2); break;
    case 'gravel': hairCap(); add(h, 'cyl', mat(o.helmet), 0, 0.06, 0, R0 * 2.2, 0.08, R0 * 2.2); add(h, 'cyl', dark, 0, 0.025, 0, R0 * 2.22, 0.02, R0 * 2.22); peak(dark, 0.07, 0.02); add(h, 'box', mat('#d8c060', { metal: 0.6, rough: 0.3 }), R0 + 0.01, 0.07, 0, 0.01, 0.03, 0.025); break;
    case 'shunt': hairCap(); add(h, 'sph', mat(o.helmet), 0.01, 0.06, 0, R0 * 2.3, R0 * 0.9, R0 * 2.15); peak(mat(o.helmet), 0.05, 0.035); add(h, 'sph', mat(shade(o.helmet, 0.7)), 0.01, 0.105, 0, 0.02); break;
    case 'hush': add(h, 'sph', mat('#1a1b1f'), 0, 0, 0, R0 * 2.08, R0 * 2.1, R0 * 2.08); add(h, 'box', mat(skin), R0 * 0.93, 0.025, 0, 0.02, 0.03, 0.12); break;
    case 'shade': hairCap(mat(P.hair), 1.06); cups(mat('#222228'), 0.058); break;
    case 'rampart': shell(helm, 1.2, 0.01); for (let i = -2; i <= 2; i++) add(h, 'box', metal('#3a3d40'), R0 * 1.05, -0.01, i * 0.04, 0.012, 0.15, 0.008); for (const y of [-0.04, 0.03]) add(h, 'box', metal('#3a3d40'), R0 * 1.05, y, 0, 0.012, 0.008, 0.19); break;
    case 'miasma': add(h, 'sph', mat('#c8d34a', { rough: 0.5 }), 0, 0.0, 0, R0 * 2.7, R0 * 2.7, R0 * 2.6); add(h, 'box', mat('#bfe4ee', { op: 0.6, rough: 0.05 }), R0 * 1.25, 0.0, 0, 0.02, 0.13, 0.2); break;
    case 'snare': add(h, 'cap', mat('#7a6a4a'), 0, 0.0, 0, R0 * 2.18, R0 * 2.1, R0 * 2.18); peak(mat('#6a5a3a'), 0.06, 0.01); peak(mat('#6a5a3a'), 0.06, 0.01, true); add(h, 'box', mat('#5a4a30'), 0, R0 + 0.0, 0, 0.04, 0.02, 0.1); break;
    case 'argus': shell(helm, 1.12); for (const z of [-0.045, 0, 0.045]) { add(h, 'cyl', dark, R0 * 0.95, 0.075, z, 0.032, 0.03, 0.032, 0, 0, Math.PI / 2); add(h, 'cyl', mat(o.color, { emit: o.color }), R0 * 0.95 + 0.016, 0.075, z, 0.018, 0.004, 0.018, 0, 0, Math.PI / 2); } break;
    case 'solder': hairCap(); add(h, 'cap', mat(o.helmet), -0.005, 0.0, 0, R0 * 2.12, R0 * 1.95, R0 * 2.12); add(h, 'box', mat(o.helmet), -R0 - 0.025, -0.02, 0, 0.06, 0.06, 0.03); break;
    case 'latch': hairCap(); shell(mat(o.helmet), 1.04); peak(mat(o.helmet), 0.075, 0.02, true); break;
    case 'hound': hairCap(); add(h, 'cyl', mat('#3a2a1c'), 0, 0.075, 0, R0 * 1.9, 0.07, R0 * 1.9); brim(mat('#3a2a1c'), 0.21, 0.045, 0.01); add(h, 'cyl', mat(o.color), 0, 0.055, 0, R0 * 1.92, 0.015, R0 * 1.92); break;
    case 'ruse': hairCap(mat(P.hair), 1.08); for (let i = 0; i < 6; i++) add(h, 'sph', hair, -0.02 + Math.cos(i) * 0.06, 0.06, Math.sin(i * 2) * 0.08, 0.05); add(h, 'box', mat(o.color, { rough: 0.3 }), R0 + 0.008, 0.03, 0, 0.02, 0.05, 0.2); break;
    case 'rally': hairCap(); shell(mat(o.helmet), 1.04); peak(mat(o.helmet), 0.07); add(h, 'box', mat(o.helmet), -R0 - 0.005, -0.06, 0, 0.012, 0.11, 0.2); break;
    case 'lens': shell(helm, 1.13); for (let i = 0; i < 9; i++) add(h, 'sph', mat(i % 2 ? '#3a5222' : '#5a7a32'), Math.cos(i * 0.7) * R0 * 0.9, R0 * 0.8 + (i % 3) * 0.01, Math.sin(i * 1.3) * R0 * 0.9, 0.045); break;
    case 'audit': hairCap(); cups(mat('#2a3036'), 0.06); add(h, 'cylL', dark, R0 * 0.6, -0.07, R0 + 0.02, 0.008, 0.12, 0.008, 0, 0, Math.PI / 2 - 0.3); break;
    case 'tonic': hairCap(); add(h, 'sph', mat(o.color), -0.01, 0.04, 0, R0 * 2.2, R0 * 1.7, R0 * 2.2); add(h, 'sph', mat(shade(o.color, 0.85)), -0.01, R0 + 0.03, 0, 0.07); break;
    case 'ward': shell(helm, 1.14); for (let i = -1; i <= 2; i++) add(h, 'cylL', mat(shade(o.helmet, 0.85)), -0.01, R0 * 0.98, i * 0.035, 0.035, R0 * 1.7, 0.035, 0, 0, Math.PI / 2 + i * 0.05); break;
    case 'girder': add(h, 'cap', mat(skin), -0.005, 0.0, 0, R0 * 2.02, R0 * 1.95, R0 * 2.02); goggles('#5a7a50', 0.085); break;
    case 'magpie': hood(mat('#1a1c1e'), 1.22); add(h, 'box', mat('#0a0b0c'), R0 + 0.0, 0.0, 0, 0.02, 0.12, 0.15); add(h, 'box', mat('#6ef08c', { emit: '#3ad060' }), R0 + 0.012, 0.02, 0, 0.006, 0.014, 0.12); for (let i = 0; i < 5; i++) add(h, 'box', mat(i % 2 ? '#f2f2ec' : '#101010'), -R0 - 0.02 - i * 0.012, 0.08 - i * 0.05, 0, 0.02, 0.06, 0.02, 0, 0, 0.5); break;
    case 'gimlet': shell(helm, 1.12); brim(helm, 0.14, 0.0, 0.01); lamp(0.07); break;
    case 'hoist': shell(mat(o.helmet, { rough: 0.5 }), 1.1); for (let i = 0; i < 3; i++) add(h, 'box', dark, -0.02 + i * 0.04, R0 * 1.06, 0, 0.02, 0.006, 0.08); add(h, 'tor', mat('#c8b27a'), 0, 0.0, R0 + 0.03, 0.08, 0.08, 0.08, 0, 0, 0); break;
    case 'lockjaw': add(h, 'sph', mat(o.helmet), -0.005, 0.02, 0, R0 * 2.3, R0 * 2.0, R0 * 2.3); add(h, 'cyl', mat('#cfc6b4'), 0, -0.01, 0, R0 * 2.35, 0.05, R0 * 2.35); add(h, 'box', metal('#9aa0a8'), R0 + 0.02, 0.06, 0, 0.01, 0.04, 0.04); break;
    case 'deadfall': shell(mat('#e0c030', { rough: 0.5 }), 1.1); brim(mat('#d0b020', { rough: 0.5 }), 0.15, 0.0); for (let i = -1; i <= 1; i++) add(h, 'box', dark, 0.0 + i * 0.05, R0 * 1.02, 0, 0.02, 0.01, 0.2); cups(mat('#c84a2a'), 0.05); break;
    case 'perch': hairCap(); shell(helm, 1.04); peak(helm, 0.07, 0.02, true); cups(mat('#3a4030'), 0.05); break;
    case 'moss': hood(mat('#4a5a2a'), 1.32); face(); for (let i = 0; i < 14; i++) add(h, 'box', mat(i % 2 ? '#5a6a32' : '#6a6a3a'), Math.cos(i) * 0.12 - 0.03, 0.08 - (i % 4) * 0.06, Math.sin(i * 1.7) * 0.15, 0.015, 0.12, 0.015, i * 0.3, 0, i * 0.4); break;
    case 'osprey': shell(helm, 1.12); add(h, 'cylL', dark, R0 + 0.03, 0.035, 0.04, 0.035, 0.08, 0.035, 0, 0, Math.PI / 2); add(h, 'cyl', mat('#7ad', { rough: 0.1, metal: 0.4 }), R0 + 0.071, 0.035, 0.04, 0.026, 0.004, 0.026, 0, 0, Math.PI / 2); break;
    case 'nail': hairCap(); add(h, 'cap', mat(o.helmet), -0.005, 0.0, 0, R0 * 2.12, R0 * 1.95, R0 * 2.12); mask(mat('#3a3d40'), -0.05); filter(mat('#55595f'), 0, -0.06); add(h, 'cyl', metal('#a0a4aa'), 0, R0 * 0.98, 0, 0.03, 0.02, 0.03); break;
    default: shell(helm, 1.12);
  }
  if (P.acc.has('band') && !['hush', 'miasma', 'onyx', 'torque'].includes(P.op)) band(P.side); // the side colour on the headgear
}

// ---------------- vest / jacket ----------------
const TINT = { parka: '#9aa0a0', wetsuit: '#22282e', leather: '#2a2420', field: '#8a7a58', shirt: '#5a5a5a', hoodie: '#3a3a40', coat: '#3a3a44', cloak: '#141518', tweed: '#7a6a4a', poncho: '#8a5a3a', suit: '#2a2a32', scrubs: '#5a9ab8', hazmat: '#c8d34a', ghillie: '#4f6a32', overalls: '#3a4a6a', apron: '#6a4a2a' };
function torsoCol(op, o, u) {
  const kind = String(VEST[op] || 'carrier'), k = kind.replace(/\d+$/, ''), v = +(kind.match(/\d+$/) || [1])[0];
  const tint = { ...TINT, jacket: o.team === 'atk' ? '#6a6a52' : '#4e5a6e', jersey: o.color, singlet: o.color, light: u.cloth }[k];
  return tint && !u.pat ? shade(tint, 0.85 + v * 0.07) : u.cloth;
}
// t = the chest group: chest middle at the origin, front +x; W = half width, D = half depth, Hh = half height
function vest(t, P, W, D, Hh) {
  // t = the chest bone's group: chest middle at the origin, front +x. W / D = the torso's half width / depth here.
  // Everything wraps the sculpted torso: open bands (cummerbunds, hi-vis, jersey hoops) follow its oval, plates sit on it.
  const { u, o, op } = P, kind = String(VEST[op] || 'carrier'), k = kind.replace(/\d+$/, ''), v = +(kind.match(/\d+$/) || [1])[0];
  const vm = surf(u.vest, 'molle'), vl = surf(u.vestL, 'cordura'), st = surf(u.strap, 'cordura'), side = mat(P.side, { rough: 0.7 });
  const band = (m, y, h, off = 0.012, dx = 0) => { const b = add(t, 'ring', m, dx, y, 0, 2 * (D + off), h, 2 * (W + off) * 0.97); b.material.side = THREE.DoubleSide; return b; };
  const sh = 0.13; // the top of the shoulders, above the chest middle
  const straps = (m = st) => { for (const s of [-1, 1]) add(t, 'box', m, 0, sh, s * W * 0.5, D * 2 + 0.05, 0.022, 0.055); };
  const plate = (m = vm, sc = 1) => { for (const x of [1, -1]) add(t, 'box', m, x * (D + 0.016 * sc), 0.0, 0, 0.032 * sc, Hh * 1.3 * sc, W * 1.32 * sc); band(vm, -Hh * 0.55, 0.11 * sc, 0.02); straps(); };
  const pouches = (n, m = vl) => { for (let i = 0; i < n; i++) { const z = (i - (n - 1) / 2) * 0.07; add(t, 'box', m, D + 0.05, -Hh * 0.38, z, 0.04, 0.085, 0.06); add(t, 'box', st, D + 0.071, -Hh * 0.3, z, 0.004, 0.03, 0.058); } };
  const stripe = () => add(t, 'box', side, D + 0.034, Hh * 0.38, 0, 0.004, 0.022, W * 1.2);
  switch (k) {
    case 'carrier': plate(); pouches(v + 1); break;
    case 'heavy': plate(surf(shade(u.vest, 0.9), 'molle'), 1.12); for (const s of [-1, 1]) add(t, 'low', vl, 0, sh + 0.02, s * W * 0.82, 0.2, 0.14, 0.17, Math.PI); add(t, 'tor', vm, 0, sh + 0.02, 0, 0.2, 0.2, 0.5, Math.PI / 2); pouches(v === 3 ? 2 : 3); break;
    case 'bomb': band(surf('#3a3d44', 'cordura'), 0, Hh * 2.1, 0.05); for (let i = -2; i <= 2; i++) band(surf('#2c2f35', 'cordura'), i * 0.08, 0.02, 0.057); add(t, 'tor', surf('#3a3d44', 'cordura'), 0, sh + 0.04, 0, 0.26, 0.26, 0.8, Math.PI / 2); for (const s of [-1, 1]) add(t, 'low', surf('#3a3d44', 'cordura'), 0, sh + 0.03, s * W * 0.85, 0.24, 0.16, 0.2, Math.PI); break;
    case 'rig': add(t, 'box', vm, D + 0.012, -Hh * 0.25, 0, 0.025, Hh * 0.85, W * 1.2); pouches(v + 2); for (const s of [-1, 1]) add(t, 'box', st, 0, sh * 0.7, s * W * 0.45, D * 2 + 0.04, 0.02, 0.04, s * 0.45); break;
    case 'harness': for (const s of [-1, 1]) add(t, 'box', surf('#2a2a2a', 'cordura'), D + 0.01, -0.02, 0, 0.01, Hh * 2.0, 0.035, s * 0.55); band(surf('#2a2a2a', 'cordura'), -Hh * 0.8, 0.04, 0.008); add(t, 'box', mat('#d8c040', { metal: 0.5, rough: 0.4 }), D + 0.02, -Hh * 0.2, 0, 0.018, 0.055, 0.055); straps(surf('#2a2a2a', 'cordura')); break;
    case 'medic': plate(); add(t, 'box', mat('#f0f0f0'), D + 0.034, 0.02, 0, 0.004, 0.09, 0.09); for (const [a, b] of [[0.065, 0.02], [0.02, 0.065]]) add(t, 'box', mat(v === 2 ? '#2a9a5a' : '#c22'), D + 0.037, 0.02, 0, 0.003, a, b); break;
    case 'police': plate(surf('#1e2430', 'molle')); add(t, 'box', mat('#d8d8d8'), D + 0.034, Hh * 0.3, 0, 0.004, 0.035, W); break;
    case 'hivis': band(surf('#d8e030', 'fabric', { rough: 0.7 }), -0.01, Hh * 1.75, 0.01); for (const y of v === 2 ? [-0.03, 0.06] : [-0.08, 0.06]) band(mat('#e8e8e8', { rough: 0.25, metal: 0.4 }), y, 0.028, 0.014); straps(surf('#d8e030', 'fabric')); break;
    case 'overalls': case 'apron': add(t, 'box', surf(shade(TINT[k], 1.15), 'cordura'), D + 0.008, -Hh * 0.3, 0, 0.014, Hh * 1.3, W * 1.15); for (const s of [-1, 1]) add(t, 'box', surf('#222', 'cordura'), 0, sh * 0.85, s * W * 0.45, D * 2 + 0.03, 0.02, 0.03); break;
    case 'cloak': add(t, 'box', surf(v === 2 ? shade(o.helmet, 1.2) : '#121317', 'fabric'), -D - 0.025, -Hh * 0.7, 0, 0.02, Hh * 3.2, W * 2.2); add(t, 'tor', surf('#121317', 'fabric'), 0, sh, 0, 0.21, 0.21, 0.5, Math.PI / 2); break;
    case 'jersey': case 'singlet': for (const y of [Hh * 0.05, -Hh * 0.2]) band(mat('#f2f2f2', { rough: 0.9 }), y, 0.035, 0.004); break;
    case 'ghillie': for (let i = 0; i < 34; i++) { const a = i * 2.4, y = ((i * 7) % 9 - 4) * Hh * 0.22; add(t, 'sph', surf(i % 3 ? '#3a5222' : '#5a6a2a', 'fabric'), Math.cos(a) * (D + 0.01), y, Math.sin(a) * (W + 0.01), 0.07, 0.05, 0.07); } break;
    default: { // jackets, coats, hoodies: a collar and a zip, maybe a light rig
      const jc = torsoCol(op, o, u);
      add(t, 'tor', surf(shade(jc, 0.75), 'fabric'), 0, sh + 0.025, 0, 0.17, 0.17, 0.45, Math.PI / 2); add(t, 'box', mat('#151515', { rough: 0.5, metal: 0.3 }), D + 0.004, -0.02, 0, 0.004, Hh * 1.7, 0.008);
      if (k === 'hoodie') add(t, 'low', surf(shade(jc, 0.85), 'fabric'), -D * 0.7, sh + 0.05, 0, 0.16, 0.12, 0.22, Math.PI);
      if (v === 2 || k === 'field') pouches(2);
    }
  }
  if (P.acc.has('vest') && !['hivis', 'ghillie', 'cloak', 'bomb', 'jersey', 'singlet'].includes(k)) stripe();
}

// ---------------- what's on the back ----------------
function pack(t, P, D, Hh) {
  const { o, u } = P, kind = String(PACK[P.op] || 'none'), k = kind.replace(/\d+$/, ''), v = +(kind.match(/\d+$/) || [1])[0];
  const g = new THREE.Group(); g.position.set(-D - 0.03, 0, 0); t.add(g);
  const b = (col, x, y, z, sx, sy, sz, rx, ry, rz) => add(g, 'box', mat(col, { rough: 0.8 }), x, y, z, sx, sy, sz, rx, ry, rz);
  const c = (col, x, y, z, r, l, rx = 0, ry = 0, rz = 0, mtl) => add(g, 'cyl', mtl || mat(col, { rough: 0.7 }), x, y, z, r * 2, l, r * 2, rx, ry, rz);
  const col = o.color;
  switch (k) {
    case 'none': break;
    case 'tank': c(v === 4 ? '#4a5a6a' : '#7a4a2a', -0.07, 0, 0, 0.07, 0.42, 0, 0, 0, metal(v === 4 ? '#4a5a6a' : v === 3 ? '#5a6a5a' : '#7a4a2a')); add(g, 'sph', metal('#555'), -0.07, 0.23, 0, 0.06); c('#222', -0.02, 0.05, 0.12, 0.012, 0.3, 0.6, 0, 0); break;
    case 'dragbag': b('#4a4a3a', -0.06, -0.05, 0, 0.1, 0.62, 0.16, 0, 0, 0.05); b('#2a2a22', -0.115, 0, 0, 0.01, 0.05, 0.14); break;
    case 'tube': c(v === 2 ? '#5a2a20' : '#3a3424', -0.07, 0.05, 0, 0.07, 0.75, 0.5, 0, 0); b(col, -0.07, 0.05, 0, 0.15, 0.03, 0.15, 0.5); break;
    case 'laptop': b('#202228', -0.04, 0.04, 0, 0.05, 0.36, 0.28); b(col, -0.066, 0.14, 0, 0.004, 0.02, 0.2); break;
    case 'canisters': for (const z of v === 2 ? [-0.1, 0, 0.1] : [-0.07, 0.07]) c(v === 2 ? '#8aa040' : '#8a9096', -0.06, 0, z, 0.05, 0.3, 0, 0, 0, metal(v === 2 ? '#8aa040' : '#8a9096')); break;
    case 'radio': b('#2a2e2a', -0.06, 0.02, 0, 0.1, 0.3, 0.2); c('#999', -0.06, 0.35, v === 2 ? 0.07 : -0.07, 0.006, 0.4, 0, 0, v === 2 ? -0.2 : 0.2, metal('#999')); break;
    case 'sling': b(u.dark, -0.04, -0.1 + v * 0.04, 0.08, 0.08, 0.14, 0.14); break;
    case 'crate': b('#3a3d44', -0.08, 0, 0, 0.14, 0.42, 0.3); b('#e8b030', -0.152, 0, 0, 0.005, 0.04, 0.28); break;
    case 'projector': b('#3a3050', -0.06, 0.04, 0, 0.1, 0.28, 0.22); add(g, 'sph', mat(col, { emit: col }), -0.11, 0.06, 0, 0.06); break;
    case 'coil': add(g, 'tor', mat('#b08030', { metal: 0.6, rough: 0.4 }), -0.04, 0.02, 0, 0.26, 0.26, 0.5, 0, Math.PI / 2, 0); add(g, 'tor', mat('#b08030', { metal: 0.6, rough: 0.4 }), -0.04, 0.02, 0, 0.16, 0.16, 0.5, 0, Math.PI / 2, 0); break;
    case 'reel': c('#2a3a2a', -0.05, 0.02, 0, 0.13, 0.08, 0, 0, Math.PI / 2); c(col, -0.1, 0.02, 0, 0.05, 0.02, 0, 0, Math.PI / 2); break;
    case 'hammer': c('#6a4a2a', -0.05, 0.05, 0, 0.018, 0.7, 0, 0, 0.5); b('#555a60', -0.05, 0.34, -0.16, 0.12, 0.12, 0.16, 0.5); break;
    case 'discs': for (let i = 0; i < 3; i++) c('#9aa0a8', -0.04 - i * 0.025, 0.02, 0, 0.12, 0.018, 0, 0, Math.PI / 2, metal('#9aa0a8')); break;
    case 'flares': for (let i = 0; i < 4; i++) c(i % 2 ? '#d84a2a' : '#ff9f2e', -0.05, 0.05, -0.09 + i * 0.06, 0.022, 0.3); break;
    case 'spikes': for (const z of [-0.08, 0, 0.08]) c('#8a8f96', -0.05, 0.05, z, 0.015, 0.35, 0, 0, 0, metal('#8a8f96')); break;
    case 'ammo': b('#4a5030', -0.06, 0, 0, 0.12, 0.3, 0.26); for (let i = 0; i < 4; i++) b('#c8a040', -0.122, -0.1 + i * 0.065, 0, 0.004, 0.02, 0.22); break;
    case 'medbag': b(v === 2 ? '#e8e8e8' : '#c83a3a', -0.07, 0, 0, 0.13, 0.3, 0.3); b(v === 2 ? '#c22' : '#fff', -0.137, 0, 0, 0.004, 0.14, 0.04); b(v === 2 ? '#c22' : '#fff', -0.137, 0, 0, 0.004, 0.04, 0.14); break;
    case 'plates': for (const y of [-0.08, 0.1]) b('#6a6a5a', -0.05, y, 0, 0.06, 0.15, 0.26); break;
    case 'roll': c('#5a4a6a', -0.06, 0.2, 0, 0.06, 0.36, Math.PI / 2); break;
    case 'cloak': b(v === 2 ? shade(o.helmet, 1.2) : '#121317', -0.01, -0.2, 0, 0.03, 0.75, 0.42); break;
    case 'panel': b('#59626b', -0.06, 0, 0, 0.1, 0.42, 0.26); for (let i = 0; i < 3; i++) b('#d9b02a', -0.112, -0.13 + i * 0.13, 0, 0.004, 0.03, 0.24); break;
    case 'jammer': b('#2b2f36', -0.06, 0.02, 0, 0.1, 0.28, 0.2); b('#55c1e8', -0.112, 0.06, 0.05, 0.004, 0.03, 0.03); c('#999', -0.06, 0.32, -0.06, 0.006, 0.3, 0, 0, 0.3, metal('#999')); break;
    case 'pouches': for (const z of v === 2 ? [-0.1, 0, 0.1] : [-0.07, 0.07]) b(v === 2 ? '#4a5a3a' : '#33402a', -0.035, -0.1, z, 0.07, 0.11, 0.08); break;
    case 'antennas': b('#222', -0.05, 0, 0, 0.08, 0.22, 0.18); for (const z of [-0.06, 0.06]) c('#aaa', -0.05, 0.3, z, 0.005, 0.4, z * 4, 0, 0, metal('#aaa')); break;
    case 'baton': c('#111', -0.03, -0.05, 0.12, 0.018, 0.45, 0, 0, 0.1); break;
    case 'toolbox': b(v === 2 ? '#b03a2a' : '#b03a2a', -0.07, 0, 0, 0.13, 0.26, 0.32); b('#222', -0.07, 0.14, 0, 0.04, 0.02, 0.18); break;
    case 'mics': for (const z of [-0.08, 0.08]) { c('#222', -0.05, 0.25, z, 0.01, 0.3); add(g, 'sph', mat('#555'), -0.05, 0.42, z, 0.05); } break;
    case 'armorbag': b('#3a4a3a', -0.08, 0, 0, 0.16, 0.42, 0.34); b('#e0e0e0', -0.162, 0.05, 0, 0.004, 0.08, 0.07); break;
    case 'wire': c(v === 2 ? '#4a3a5a' : '#3a3a2a', -0.05, 0.02, 0, 0.1, 0.1, 0, 0, Math.PI / 2); add(g, 'tor', mat(v === 2 ? '#ff5050' : '#c8c8c8', { metal: 0.5 }), -0.1, 0.02, 0, 0.17, 0.17, 0.2, 0, Math.PI / 2, 0); break;
    case 'camcase': b('#2a2a30', -0.07, 0, 0, 0.12, 0.28, 0.26); for (const y of [-0.05, 0.05]) c('#7ad', -0.135, y, 0.05, 0.022, 0.01, 0, 0, Math.PI / 2); break;
    case 'darts': b('#4a3a2a', -0.05, 0, 0, 0.08, 0.32, 0.18); for (let i = 0; i < 5; i++) b(col, -0.05, 0.17, -0.07 + i * 0.035, 0.02, 0.05, 0.012); break;
    case 'speaker': b('#2a2228', -0.07, 0.02, 0, 0.12, 0.26, 0.24); c('#111', -0.132, 0.02, 0, 0.07, 0.01, 0, 0, Math.PI / 2); break;
    case 'bottle': c('#4aa0d8', -0.05, 0.02, 0.08, 0.05, 0.22, 0, 0, 0, mat('#4aa0d8', { rough: 0.2, op: 0.9 })); break;
    case 'tripod': for (const z of [-0.04, 0, 0.04]) c('#3a3a3a', -0.04, 0.05, z, 0.01, 0.55, 0, 0, z * 3, metal('#3a3a3a')); break;
    case 'medcase': b('#e8f0f0', -0.07, 0, 0, 0.12, 0.3, 0.28); b('#2a9a5a', -0.132, 0, 0, 0.004, 0.13, 0.035); b('#2a9a5a', -0.132, 0, 0, 0.004, 0.035, 0.13); break;
    case 'hive': add(g, 'box', mat('#3c5a46', { op: 0.85, rough: 0.3 }), -0.08, 0, 0, 0.14, 0.32, 0.26); for (let i = 0; i < 7; i++) add(g, 'sph', mat('#6ef08c', { emit: '#3ad060' }), -0.152, -0.1 + i * 0.03, -0.08 + (i * 0.05) % 0.16, 0.015); break;
    case 'radar': b('#2a3036', -0.05, 0, 0, 0.08, 0.22, 0.18); add(g, 'cap', mat(col, { metal: 0.5, rough: 0.4 }), -0.12, 0.25, 0, 0.2, 0.06, 0.2, 0, 0, Math.PI / 2); break;
    case 'girders': for (const z of [-0.09, 0.09]) b('#8a5a3a', -0.05, 0.1, z, 0.05, 0.8, 0.05, 0, 0, 0.15); break;
    default: b(u.dark, -0.06, 0, 0, 0.12, 0.32, 0.26);
  }
  if (P.acc.has('pack') && k !== 'none') add(g, 'box', mat(P.side), -0.16, 0.12, 0, 0.006, 0.06, 0.08);
  return g;
}

// ---------------- the body, posed each frame ----------------
// joints in the root's frame (metres). A limb is a tapered piece placed between two joints, with a ball at the joint.
const UP = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), q = new THREE.Quaternion();
function place(m, a, b) { tmp.subVectors(b, a); const l = tmp.length() || 1e-4; m.position.addVectors(a, b).multiplyScalar(0.5); q.setFromUnitVectors(UP, tmp.multiplyScalar(1 / l)); m.quaternion.copy(q); m.scale.set(1, l, 1); }
// two-bone reach: from a toward t with bone lengths l1, l2; the elbow/knee bends toward pole
function reach(a, t, l1, l2, pole, out) {
  const d = tmp2.subVectors(t, a), L = Math.min(d.length(), l1 + l2 - 1e-3), dir = d.clone().normalize();
  const x = (l1 * l1 - l2 * l2 + L * L) / (2 * L), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  const side = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
  out.copy(a).addScaledVector(dir, x).addScaledVector(side, h);
  return a.clone().addScaledVector(dir, L);
}

// ---------------- face: a plain, sharp head under each operator's face gear ----------------
// He asked (2026-11-13): no cartoon faces; mostly covered like a real unit (he liked the masked ones). Bare skin that still
// shows is kept simple: brow ridge, nose wedge, eyes as dark shapes in shadow, no whites or eyebrows.
const FACE = { onyx: '', torque: '', vapor: '', crow: '', wraith: '', hush: '', miasma: '', magpie: '', haze: '', rivet: 'gaiter', nail: 'G', kite: 'gaiter',
  hammer: 'resp', trench: 'resp', gimlet: 'resp', solace: 'surg', tonic: 'surg', solder: 'respG', girder: 'respG', deadfall: 'respG',
  bulwark: 'bala', ferro: 'bala', wren: 'bala', rampart: 'bala', lockjaw: 'bala', talon: 'gaiter', prism: 'gaiter', blaze: 'gaiter', mark: 'gaiter', osprey: 'gaiter', ruse: 'gaiter', kestrel: 'gaiter' };
function headBase(head, P, skin) {
  add(head, 'sph', skin, 0, 0, 0, R0 * 1.85, R0 * 2.08, R0 * 1.78); // skull
  add(head, 'sph', skin, R0 * 0.32, -0.062, 0, 0.15, 0.1, 0.145); // jaw
  add(head, 'box', skin, R0 * 0.84, 0.042, 0, 0.035, 0.024, 0.165); // brow ridge
  add(head, 'box', mat(shade(P.skin, 0.9)), R0 * 0.95, -0.006, 0, 0.04, 0.06, 0.026, 0, 0, -0.18); // nose
  for (const s of [-1, 1]) {
    add(head, 'sph', mat(shade(P.skin, 0.5)), R0 * 0.83, 0.016, s * 0.043, 0.024, 0.018, 0.045); // eye socket shadow
    add(head, 'sph', mat('#16130f', { rough: 0.3 }), R0 * 0.88, 0.016, s * 0.043, 0.012, 0.011, 0.026); // the eye: a dark shape
    add(head, 'sph', skin, -0.005, 0.0, s * R0 * 0.9, 0.032, 0.055, 0.024); // ear
  }
}
function faceGear(h, P) {
  const kind = FACE[P.op] ?? 'gaiterG', u = P.u;
  const dark = mat(shade(u.vest, 0.72), { rough: 0.95 });
  const glasses = () => { const g = mat('#14171b', { rough: 0.12, metal: 0.55 }); add(h, 'box', g, R0 * 0.93, 0.018, 0, 0.02, 0.034, 0.175); add(h, 'box', mat('#0b0c0d'), R0 * 0.93, 0.037, 0, 0.022, 0.007, 0.18); for (const s of [-1, 1]) add(h, 'box', mat('#0b0c0d'), R0 * 0.35, 0.03, s * R0 * 0.92, 0.13, 0.008, 0.008); };
  const gaiter = () => { add(h, 'low', dark, 0.008, 0.002, 0, R0 * 2.22, R0 * 2.0, R0 * 1.9); add(h, 'cyl', dark, -0.005, -0.14, 0, 0.12, 0.09, 0.12); add(h, 'tor', mat(shade(u.vest, 0.62), { rough: 0.95 }), 0.008, 0.003, 0, R0 * 2.2, R0 * 1.88, R0 * 0.22, Math.PI / 2); }; // a neck gaiter pulled up over the nose
  const resp = () => { const m = mat('#2a2d30', { rough: 0.6 }); add(h, 'box', m, R0 * 0.88, -0.05, 0, 0.075, 0.085, 0.12); for (const s of [-1, 1]) add(h, 'cyl', mat('#3c4044', { rough: 0.5 }), R0 * 0.82, -0.065, s * 0.06, 0.05, 0.03, 0.05, Math.PI / 2 - s * 0.6, 0, 0); add(h, 'box', mat('#151618'), 0, -0.03, 0, 0.02, 0.012, R0 * 2.1); };
  switch (kind) {
    case 'gaiter': gaiter(); break;
    case 'gaiterG': gaiter(); glasses(); break;
    case 'resp': resp(); break;
    case 'respG': resp(); glasses(); break;
    case 'surg': add(h, 'box', mat('#a8c8d8', { rough: 0.9 }), R0 * 0.82, -0.05, 0, 0.06, 0.08, 0.17); for (const s of [-1, 1]) add(h, 'box', mat('#e8eef0'), 0.0, -0.03, s * R0 * 0.93, 0.15, 0.006, 0.006); break;
    case 'bala': add(h, 'sph', mat('#1d1e21', { rough: 0.95 }), 0.002, -0.004, 0, R0 * 1.98, R0 * 2.2, R0 * 1.9); add(h, 'box', mat(P.skin), R0 * 0.9, 0.018, 0, 0.02, 0.034, 0.13); for (const s of [-1, 1]) add(h, 'sph', mat('#16130f'), R0 * 0.99, 0.018, s * 0.042, 0.012, 0.012, 0.026); break;
    case 'G': glasses(); break;
  }
}

// ---------------- cloth: the same patterns as top-down, drawn to read as fabric ----------------
// sleeves and trouser legs: plain cloth with the operator's pattern as a dashed line down the middle front and back
// (top-down's SLEEVE dashes); the jacket carries the pattern itself (clothTex).
const SLEEVE = { camo: [2.2, 1.4], digital: [0.8, 0.9], tiger: [0.6, 1.4], stripe: [], hazard: [1.3, 1.3], check: [1, 1], hex: [0.5, 0.8], zig: [1.6, 1], circuit: [2.5, 0.8], spots: [0.6, 1.6], splatter: [0.7, 2], char: [1.6, 1.6], split: [] };
const LIMBT = new Map();
function limbTex(u, base) {
  const k = base + '|' + u.pat + '|' + u.pc; if (LIMBT.has(k)) return LIMBT.get(k);
  const c = document.createElement('canvas'); c.width = 128; c.height = 256; const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, 128, 256);
  let sd = 3; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 700; i++) { x.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.035)'; x.fillRect(rnd() * 128, rnd() * 256, 2, 1); }
  for (const sx of [0, 64, 96]) { x.fillStyle = 'rgba(0,0,0,0.16)'; x.fillRect(sx + (sx === 0 ? 0 : -1), 0, 1.5, 256); } // seams
  const d = SLEEVE[u.pat];
  if (d && d.length && u.pc) {
    x.fillStyle = shade(u.pc, 0.92); const unit = 256 / 10; // (10 top-down px down the canvas)
    x.globalAlpha = 0.7; for (const cx of [32, 96]) for (let y = 0; y < 256; y += (d[0] + d[1]) * unit) x.fillRect(cx - 5, y, 10, d[0] * unit); x.globalAlpha = 1;
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  LIMBT.set(k, t); return t;
}
// a limb from a to b with its texture's front (u 0.25) turned toward `fwd`, so the dashed line runs down the front
const mB = new THREE.Matrix4(), bx = new THREE.Vector3(), by = new THREE.Vector3(), bz = new THREE.Vector3();
function placeB(m, a, b, fwd) {
  by.subVectors(b, a); const l = by.length() || 1e-4; by.multiplyScalar(1 / l);
  bx.copy(fwd).addScaledVector(by, -fwd.dot(by)); if (bx.lengthSq() < 1e-6) bx.set(0, 0, 1).addScaledVector(by, -by.z); bx.normalize();
  bz.crossVectors(bx, by); m.quaternion.setFromRotationMatrix(mB.makeBasis(bx, by, bz));
  m.position.addVectors(a, b).multiplyScalar(0.5); m.scale.set(1, l, 1);
}

// ---------------- body types (he asked 2026-11-13: athletic, human, each a specific build from who they are) ----------------
// h: height (m); f: woman; m: mass / bulk 0..1; u: muscle 0..1; sh: shoulder breadth. From each bio: a quarry foreman,
// a marathon runner, a rugby winger, a speed skater... Heavy armour = bigger, light = leaner, then tuned per person.
const BODY = {
  ember: { h: 1.70, f: 1, m: 0.35, u: 0.6 }, kestrel: { h: 1.84, m: 0.2, u: 0.45 }, hammer: { h: 1.84, m: 0.6, u: 0.8, sh: 1.08 }, talon: { h: 1.65, f: 1, m: 0.15, u: 0.35 },
  bulwark: { h: 1.92, m: 0.6, u: 0.75, sh: 1.12 }, rivet: { h: 1.82, m: 0.35, u: 0.7, sh: 1.08 }, haze: { h: 1.72, f: 1, m: 0.25, u: 0.6 }, glint: { h: 1.80, m: 0.12, u: 0.4 },
  brisk: { h: 1.66, f: 1, m: 0.25, u: 0.7, legs: 1.15 }, onyx: { h: 1.78, m: 0.6, u: 0.55 }, prism: { h: 1.68, f: 1, m: 0.15, u: 0.4 }, volt: { h: 1.86, m: 0.3, u: 0.7 },
  tether: { h: 1.70, f: 1, m: 0.3, u: 0.55 }, strider: { h: 1.78, m: 0.1, u: 0.7 }, ferro: { h: 1.86, m: 0.75, u: 0.95, sh: 1.15 }, salvo: { h: 1.68, f: 1, m: 0.3, u: 0.5 },
  torque: { h: 1.80, m: 0.8, u: 0.6, belly: 0.6 }, rush: { h: 1.82, m: 0.5, u: 0.9, sh: 1.1, legs: 1.1 }, blaze: { h: 1.71, f: 1, m: 0.25, u: 0.5 }, echo: { h: 1.69, f: 1, m: 0.25, u: 0.5 },
  mark: { h: 1.77, m: 0.25, u: 0.5 }, patch: { h: 1.82, m: 0.4, u: 0.6 }, trench: { h: 1.80, m: 0.7, u: 0.85, sh: 1.1 }, wren: { h: 1.63, f: 1, m: 0.1, u: 0.45 },
  vapor: { h: 1.75, m: 0.2, u: 0.45 }, crow: { h: 1.81, m: 0.05, u: 0.6 }, perch: { h: 1.80, m: 0.55, u: 0.5 }, moss: { h: 1.67, f: 1, m: 0.15, u: 0.45 },
  osprey: { h: 1.80, m: 0.35, u: 0.55 }, nail: { h: 1.72, f: 1, m: 0.35, u: 0.6 }, gimlet: { h: 1.69, f: 1, m: 0.35, u: 0.6 }, hoist: { h: 1.78, m: 0.1, u: 0.85, sh: 1.06 },
  lockjaw: { h: 1.84, m: 0.55, u: 0.6 }, deadfall: { h: 1.74, f: 1, m: 0.55, u: 0.75, sh: 1.05 }, mason: { h: 1.84, m: 0.6, u: 0.85, sh: 1.1 }, veil: { h: 1.70, f: 1, m: 0.25, u: 0.4 },
  lynx: { h: 1.79, m: 0.15, u: 0.65 }, solace: { h: 1.71, f: 1, m: 0.25, u: 0.55 }, wraith: { h: 1.86, m: 0.1, u: 0.5 }, bramble: { h: 1.68, f: 1, m: 0.3, u: 0.5 },
  kite: { h: 1.76, m: 0.25, u: 0.4 }, gravel: { h: 1.70, f: 1, m: 0.4, u: 0.6 }, shunt: { h: 1.79, m: 0.75, u: 0.55, belly: 0.5 }, hush: { h: 1.65, f: 1, m: 0.1, u: 0.5 },
  shade: { h: 1.69, f: 1, m: 0.15, u: 0.35 }, rampart: { h: 1.90, m: 0.7, u: 0.85, sh: 1.12 }, miasma: { h: 1.80, m: 0.5, u: 0.45, belly: 0.3 }, snare: { h: 1.78, m: 0.4, u: 0.6 },
  argus: { h: 1.70, f: 1, m: 0.2, u: 0.4 }, solder: { h: 1.76, m: 0.75, u: 0.75, sh: 1.08 }, latch: { h: 1.71, f: 1, m: 0.3, u: 0.5 }, hound: { h: 1.78, m: 0.2, u: 0.6 },
  ruse: { h: 1.73, m: 0.2, u: 0.4 }, rally: { h: 1.77, m: 0.05, u: 0.55, legs: 1.08 }, lens: { h: 1.70, f: 1, m: 0.25, u: 0.45 }, audit: { h: 1.80, m: 0.3, u: 0.45 },
  tonic: { h: 1.68, f: 1, m: 0.3, u: 0.5 }, ward: { h: 1.80, m: 0.4, u: 0.6 }, girder: { h: 1.88, m: 0.35, u: 0.85, sh: 1.08 }, magpie: { h: 1.70, f: 1, m: 0.2, u: 0.5 },
};
const bodyOf = op => { const b = BODY[op] || {}, o = OPERATORS[op] || {}, a = o.armor || 2; return { h: b.h ?? 1.8, f: b.f || 0, m: b.m ?? [0, 0.65, 0.4, 0.2][a], u: b.u ?? [0, 0.75, 0.6, 0.5][a], sh: b.sh ?? 1, belly: b.belly || 0, legs: b.legs || 1 }; };

// ---------------- surfaces: shared greyscale detail maps, coloured per material, each with a normal map ----------------
// (one weave for cloth, cordura with MOLLE webbing for vests and pouches, pebbled leather for boots and gloves, matte
// shell for helmets) so every piece reads as the stuff it is made of, in every operator's own colours
function normalFrom(h, W, H, k) {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), out = x.createImageData(W, H);
  const at = (i, j) => h[((j + H) % H) * W + ((i + W) % W)];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const dx = (at(i + 1, j) - at(i - 1, j)) * k, dy = (at(i, j + 1) - at(i, j - 1)) * k, l = Math.hypot(dx, dy, 1), o = (j * W + i) * 4; out.data[o] = (-dx / l * 0.5 + 0.5) * 255; out.data[o + 1] = (dy / l * 0.5 + 0.5) * 255; out.data[o + 2] = (1 / l * 0.5 + 0.5) * 255; out.data[o + 3] = 255; }
  x.putImageData(out, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
const DETAIL = {};
function detail(kind) {
  if (DETAIL[kind]) return DETAIL[kind];
  const W = 256, H = 256, h = new Float32Array(W * H), c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  let sd = kind.length * 97 + 13; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const img = x.createImageData(W, H); let rep = 4;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    let v = 0;
    if (kind === 'fabric') v = (Math.sin(i * 1.6) * 0.5 + 0.5) * (j % 4 < 2 ? 1 : 0.4) * 0.5 + (Math.sin(j * 1.6) * 0.5 + 0.5) * (i % 4 < 2 ? 0.4 : 1) * 0.5;
    else if (kind === 'cordura') v = (Math.sin(i * 2.1) * Math.sin(j * 2.1)) * 0.25 + 0.5 + (rnd() - 0.5) * 0.15;
    else if (kind === 'molle') { const r = j % 32; v = 0.5 + (Math.sin(i * 2.1) * Math.sin(j * 2.1)) * 0.15 + (r >= 6 && r < 18 ? 0.35 : 0) - (r === 6 || r === 17 ? 0.25 : 0) + ((r === 8 || r === 15) && i % 6 < 3 ? -0.15 : 0) + ((i % 64) < 2 && r >= 6 && r < 18 ? -0.3 : 0); rep = 2; }
    else if (kind === 'leather') v = 0.5 + (rnd() - 0.5) * 0.35;
    else if (kind === 'shell') v = 0.5 + (rnd() - 0.5) * 0.08;
    h[j * W + i] = v;
  }
  if (kind === 'leather' || kind === 'shell') for (let p = 0; p < 2; p++) for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) h[j * W + i] = (h[j * W + i] * 2 + h[j * W + (i + 1) % W] + h[((j + 1) % H) * W + i]) / 4; // (pebbled, not noisy)
  for (let k = 0; k < W * H; k++) { const g = Math.round(200 + (h[k] - 0.5) * (kind === 'molle' ? 110 : 60)); img.data[k * 4] = img.data[k * 4 + 1] = img.data[k * 4 + 2] = Math.max(0, Math.min(255, g)); img.data[k * 4 + 3] = 255; }
  x.putImageData(img, 0, 0);
  const map = new THREE.CanvasTexture(c); map.wrapS = map.wrapT = THREE.RepeatWrapping; map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  const nm = normalFrom(h, W, H, kind === 'molle' ? 3 : kind === 'fabric' ? 1.2 : 2);
  map.repeat.set(rep, rep); nm.repeat.set(rep, rep);
  return (DETAIL[kind] = { map, nm });
}
// colours tuned to sit in the game's world: a little less saturated and a touch darker than the flat top-down colours
const tuned = new Map();
function tune(hex, k = 1) { const key = hex + k; if (tuned.has(key)) return tuned.get(key); const c = new THREE.Color(hex), s = {}; c.getHSL(s); c.setHSL(s.h, s.s * 0.82, Math.min(0.92, s.l * 0.94 * k)); const v = '#' + c.getHexString(); tuned.set(key, v); return v; }
const SURF = new Map();
function surf(col, kind, o = {}) {
  const k = col + kind + (o.rough ?? '') + (o.metal ?? ''); if (SURF.has(k)) return SURF.get(k);
  const d = detail(kind), m = new THREE.MeshStandardMaterial({ color: tune(col), map: d.map, normalMap: d.nm, normalScale: new THREE.Vector2(0.7, 0.7), roughness: o.rough ?? (kind === 'leather' ? 0.55 : kind === 'shell' ? 0.6 : 0.92), metalness: o.metal ?? 0 });
  SURF.set(k, m); return m;
}

// ---------------- the body mesh: sculpted in rings, skinned to a skeleton ----------------
// A loft: rings (centre, half depth rx along x, half width rz along z, a superellipse power, bone weights, shade) made
// into one smooth tube; uv u runs round it (0 = front), v along it in metres, so cloth textures keep their scale.
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
function loft(rings, seg = 28, start = Math.PI) {
  const pos = [], uv = [], si = [], sw = [], col = [], idx = []; let v = 0;
  rings.forEach((r, j) => {
    if (j) v += r.c.distanceTo(rings[j - 1].c);
    for (let i = 0; i <= seg; i++) {
      const a = start + i / seg * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), p = r.p || 1;
      const cx = Math.sign(ca) * Math.pow(Math.abs(ca), p), sz = Math.sign(sa) * Math.pow(Math.abs(sa), p);
      pos.push(r.c.x + cx * r.rx * (ca > 0 ? r.fr || 1 : 1), r.c.y, r.c.z + sz * r.rz);
      uv.push(i / seg, v / 0.6);
      const w = r.w; si.push(w[0][0], (w[1] || [0])[0], 0, 0); sw.push(w[0][1], (w[1] || [0, 0])[1], 0, 0);
      const inner = r.in ? Math.max(0, sz * r.in) : 0, s = (r.ao ?? 1) * (1 - 0.22 * inner) * (1 - 0.06 * Math.max(0, -cx)); // creases and the inner side a little darker
      col.push(s, s, s);
    }
    if (j) for (let i = 0; i < seg; i++) { const a = (j - 1) * (seg + 1) + i, b = a + seg + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); g.computeTangents?.call && 0;
  return g;
}
const mixW = (a, b, t) => t <= 0 ? [[a, 1]] : t >= 1 ? [[b, 1]] : [[a, 1 - t], [b, t]];
const ss = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// ---------------- the operator ----------------
const BI = { hips: 0, spine: 1, chest: 2, neck: 3, head: 4, clavL: 5, upL: 6, foreL: 7, handL: 8, clavR: 9, upR: 10, foreR: 11, handR: 12, thighL: 13, shinL: 14, footL: 15, thighR: 16, shinR: 17, footR: 18 };
const qArmB = new THREE.Quaternion(); // a limb bone's rest frame: along it = down, front = +x
{ const m = new THREE.Matrix4().makeBasis(V3(1, 0, 0), V3(0, -1, 0), V3(0, 0, -1)); qArmB.setFromRotationMatrix(m).invert(); }
const fq = (y, xr, out = new THREE.Quaternion()) => { const Y = y.clone().normalize(), X = xr.clone().addScaledVector(Y, -xr.dot(Y)); if (X.lengthSq() < 1e-8) X.set(1, 0, 0).addScaledVector(Y, -Y.x); X.normalize(); const Z = X.clone().cross(Y); return out.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z)); };

export function makeOperator(op, gunId) {
  const o = OPERATORS[op] || { team: 'atk', color: '#888', helmet: '#444', armor: 2 };
  const u0 = uniformOf(op, o.team), u = { ...u0, cloth: tune(u0.cloth), clothD: tune(u0.clothD), vest: tune(u0.vest), vestL: tune(u0.vestL), dark: tune(u0.dark), strap: tune(u0.strap), pc: u0.pc && tune(u0.pc) };
  const P = { op, o, u, acc: accentsOf(op), side: SIDE_COL[o.team] || SIDE_COL.atk, skin: skinOf(op), hair: hairOf(op) };
  const B = bodyOf(op), k = B.h / 1.82, f = B.f, mm = B.m, mu = B.u, shW = B.sh * (f ? 0.88 : 1);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  // ---- skeleton (bind pose: standing straight, arms hanging) ----
  const Lt = 0.45 * k * B.legs ** 0.3, Ls = 0.44 * k * B.legs ** 0.3, La = 0.3 * k, Lf = 0.27 * k, ank = 0.085 * k;
  const hipH = ank + Ls + Lt + 0.05 * k, hipW = (0.09 + mm * 0.012 + f * 0.012) * k, shX = (0.175 + mu * 0.025) * shW * k;
  const spineL = 0.15 * k, chestL = 0.16 * k, neckL = 0.19 * k, headL = 0.075 * k;
  const bones = [], bone = (name, parent, x, y, z) => { const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z); (parent ? bones[BI[parent]] : body).add(b); bones[BI[name]] = b; return b; };
  bone('hips', null, 0, hipH, 0); bone('spine', 'hips', 0, spineL, 0); bone('chest', 'spine', 0, chestL, 0); bone('neck', 'chest', 0, neckL, 0); bone('head', 'neck', 0, headL, 0);
  for (const [s, c, up, fo, ha] of [[-1, 'clavL', 'upL', 'foreL', 'handL'], [1, 'clavR', 'upR', 'foreR', 'handR']]) { bone(c, 'chest', 0, 0.12 * k, s * 0.05 * k); bone(up, c, 0, 0.0, s * (shX - 0.05 * k)); bone(fo, up, 0, -La, 0); bone(ha, fo, 0, -Lf, 0); }
  for (const [s, th, sh, ft] of [[-1, 'thighL', 'shinL', 'footL'], [1, 'thighR', 'shinR', 'footR']]) { bone(th, 'hips', 0, -0.05 * k, s * hipW); bone(sh, th, 0, -Lt, 0); bone(ft, sh, 0, -Ls, 0); }
  body.updateMatrixWorld(true);
  const wp = n => bones[BI[n]].getWorldPosition(new THREE.Vector3()).sub(body.position); // (bind positions, body space)
  // ---- the body surfaces ----
  const fab = detail('fabric'), cl = (map, col) => new THREE.MeshStandardMaterial({ map, color: col || '#ffffff', normalMap: fab.nm, normalScale: new THREE.Vector2(0.55, 0.55), roughness: 0.93, vertexColors: true });
  const tc = torsoCol(op, o, u), jacketTex = clothTex(u), jacket = tc === u.cloth ? cl(jacketTex) : cl(fab.map, tune(tc));
  const sleeves = cl(limbTex(u, u.cloth)), trousers = cl(limbTex(u, u.clothD));
  const skinM = new THREE.MeshStandardMaterial({ color: P.skin, roughness: 0.62, vertexColors: true });
  const skel = [];
  const skinned = (g, m) => { const s = new THREE.SkinnedMesh(g, m); s.frustumCulled = false; body.add(s); skel.push(s); return s; };
  // torso: crotch to neck, shaped by build (hips, waist, belly, ribs, chest, lats, trapezius); women narrower at the
  // shoulders, wider at the hips, with a bust
  const hy = hipH, T = (y, rz, rx, wts, extra = {}) => ({ c: V3(extra.x || 0, hy + y * k, 0), rz: rz * k, rx: rx * k, p: y > 0.25 ? 0.95 : 0.88, w: wts, ...extra });
  const wHS = (y) => { const t = y / (spineL / k); return y < 0.05 ? [[BI.hips, 1]] : y < 0.2 ? mixW(BI.hips, BI.spine, ss(0.05, 0.2, y)) : y < 0.33 ? mixW(BI.spine, BI.chest, ss(0.2, 0.33, y)) : [[BI.chest, 1]]; };
  const tor = [
    T(-0.11, 0.02, 0.02, wHS(-0.11)),
    T(-0.09, 0.105 + f * 0.02 + mm * 0.02, 0.075 + mm * 0.015, wHS(-0.09), { ao: 0.8 }),
    T(-0.04, 0.148 + f * 0.028 + mm * 0.025, 0.1 + mm * 0.018, wHS(-0.04)),
    T(0.03, 0.155 + f * 0.022 + mm * 0.03, 0.1 + mm * 0.022 + B.belly * 0.02, wHS(0.03)),
    T(0.12, 0.142 - f * 0.015 + mm * 0.04 + B.belly * 0.02, 0.105 + mm * 0.04 + B.belly * 0.05, wHS(0.12), { x: B.belly * 0.012 }),
    T(0.21, 0.15 + mu * 0.012 + mm * 0.03, 0.11 + mm * 0.03 + f * 0.01, wHS(0.21)),
    T(0.30, (0.165 + mu * 0.03 + mm * 0.015) * shW - f * 0.012, 0.12 + mu * 0.015 + f * 0.025, wHS(0.30), { fr: 1 + f * 0.25 }),
    T(0.38, (0.172 + mu * 0.04 + mm * 0.01) * shW, 0.118 + mu * 0.02 + f * 0.012, wHS(0.38), { fr: 1 + f * 0.15 }),
    T(0.45, (0.15 + mu * 0.03) * shW, 0.098 + mu * 0.01, [[BI.chest, 1]]),
    T(0.5, (0.11 + mu * 0.03) * shW, 0.08, [[BI.chest, 0.7], [BI.neck, 0.3]]),
    T(0.53, 0.06 + mu * 0.008, 0.055, [[BI.chest, 0.3], [BI.neck, 0.7]]),
  ];
  skinned(loft(tor, 32), jacket);
  // neck
  const nk = wp('neck');
  skinned(loft([0, 0.04, 0.09, 0.13].map((y, i) => ({ c: V3(0.005, nk.y - 0.02 * k + y * k, 0), rx: (0.055 + mu * 0.006) * k, rz: (0.06 + mu * 0.01 - f * 0.006) * k, w: i < 2 ? mixW(BI.neck, BI.head, y / 0.13) : [[BI.head, 1]] })), 20), skinM);
  // arms: deltoid, biceps/triceps, elbow, forearm, wrist (radius by muscle and build)
  for (const s of [-1, 1]) {
    const sh = wp(s < 0 ? 'upL' : 'upR'), up = s < 0 ? BI.upL : BI.upR, fo = s < 0 ? BI.foreL : BI.foreR, ha = s < 0 ? BI.handL : BI.handR, ch = BI.chest;
    const R = (t, r, rx, w, ao) => ({ c: V3(sh.x, sh.y - t * k, sh.z + (t < 0.05 ? -s * 0.012 * k : 0)), rz: r * k * (f ? 0.9 : 1), rx: (rx ?? r) * k * (f ? 0.9 : 1), w, in: -s, ao });
    const a = [
      R(-0.07, 0.04, 0.05, [[ch, 1]]),
      R(-0.03, 0.075 + mu * 0.02 + mm * 0.01, 0.07 + mu * 0.02, mixW(ch, up, 0.5)),
      R(0.03, 0.078 + mu * 0.026 + mm * 0.012, 0.072 + mu * 0.025, mixW(ch, up, 0.85)),
      R(0.1, 0.06 + mu * 0.018 + mm * 0.012, 0.066 + mu * 0.024, [[up, 1]]),
      R(0.18, 0.054 + mu * 0.012 + mm * 0.01, 0.062 + mu * 0.02, [[up, 1]]),
      R(0.26, 0.047 + mm * 0.006, 0.052 + mu * 0.008, mixW(up, fo, 0.25), 0.9),
      R(0.30, 0.045 + mm * 0.005, 0.047, mixW(up, fo, 0.5), 0.85),
      R(0.35, 0.048 + mu * 0.012 + mm * 0.006, 0.05 + mu * 0.012, mixW(up, fo, 0.85)),
      R(0.42, 0.045 + mu * 0.01 + mm * 0.005, 0.043 + mu * 0.008, [[fo, 1]]),
      R(0.5, 0.036 + mm * 0.003, 0.032, [[fo, 1]]),
      R(0.56, 0.031, 0.027, mixW(fo, ha, 0.5)),
      R(0.575, 0.012, 0.012, [[ha, 1]]),
    ];
    skinned(loft(a, 24), sleeves);
  }
  // legs: glutes, quads, knee, calf, ankle
  for (const s of [-1, 1]) {
    const hp = wp(s < 0 ? 'thighL' : 'thighR'), th = s < 0 ? BI.thighL : BI.thighR, sn = s < 0 ? BI.shinL : BI.shinR, ft = s < 0 ? BI.footL : BI.footR, hip = BI.hips;
    const Lk = Lt / k, Lsk = Ls / k;
    const R = (t, r, rx, w, ao, dx = 0) => ({ c: V3(hp.x + dx * k, hp.y - t * k, hp.z - s * (t < 0.1 ? 0.01 : 0) * k), rz: r * k, rx: (rx ?? r) * k, w, in: -s, ao });
    const g = 1 + mm * 0.18 + mu * 0.1 + f * 0.05;
    const L = [
      R(-0.07, 0.06, 0.06, [[hip, 1]]),
      R(-0.02, 0.088 * g, 0.088 * g, mixW(hip, th, 0.35), 1, 0.0),
      R(0.06, 0.098 * g, 0.1 * g, mixW(hip, th, 0.8), 1, -0.004),
      R(0.16, 0.088 * g, 0.092 * g, [[th, 1]], 1, 0.004),
      R(0.3, 0.072 * g, 0.075 * g, [[th, 1]]),
      R(Lk - 0.05, 0.058 * g, 0.06 * g, mixW(th, sn, 0.2), 0.92),
      R(Lk, 0.056, 0.06, mixW(th, sn, 0.5), 0.88),
      R(Lk + 0.07, 0.056 + mu * 0.008, 0.066 + mu * 0.012, mixW(th, sn, 0.9), 1, -0.008),
      R(Lk + 0.16, 0.054 + mu * 0.01 + mm * 0.008, 0.066 + mu * 0.014 + mm * 0.008, [[sn, 1]], 1, -0.012),
      R(Lk + 0.3, 0.043, 0.047, [[sn, 1]]),
      R(Lk + Lsk - 0.02, 0.037, 0.04, mixW(sn, ft, 0.4)),
      R(Lk + Lsk + 0.02, 0.02, 0.02, [[ft, 1]]),
    ];
    skinned(loft(L, 24), trousers);
  }
  const skeleton = new THREE.Skeleton(bones);
  for (const s of skel) s.bind(skeleton);
  // ---- head, gear and kit, carried by their bones ----
  const head = new THREE.Group(); head.position.set(0.012 * k, 0.1 * k, 0); head.scale.setScalar(k ** 0.5 * (f ? 0.96 : 1)); bones[BI.head].add(head);
  headBase(head, P, new THREE.MeshStandardMaterial({ color: P.skin, roughness: 0.62 })); H(head, o, P); faceGear(head, P);
  const W = ((0.172 + mu * 0.04 + mm * 0.01) * shW + 0.01) * k, D = (0.12 + mu * 0.015 + mm * 0.02) * k, Hh = 0.21 * k;
  const chestG = new THREE.Group(); chestG.position.set(0.005 * k, 0.0, 0); bones[BI.chest].add(chestG);
  vest(chestG, P, W, D, Hh); pack(chestG, P, D, Hh);
  const hipsG = new THREE.Group(); bones[BI.hips].add(hipsG);
  { const bw = (0.16 + f * 0.025 + mm * 0.035) * k + 0.012, bd = (0.11 + mm * 0.025) * k + 0.012; const belt = add(hipsG, 'cyl', surf('#26282b', 'leather'), 0, 0.06 * k, 0, bd * 2, 0.05, bw * 2); add(hipsG, 'box', metal('#8a8d90'), bd + 0.004, 0.06 * k, 0, 0.012, 0.045, 0.06); for (const s of [-1, 1]) add(hipsG, 'box', surf(u.vest, 'cordura'), 0.0, 0.03 * k, s * (bw + 0.01), 0.1, 0.11, 0.035); void belt; } // belt, buckle, hip pouches
  for (const s of [-1, 1]) {
    // kneepads, thigh pocket, armband, elbow pad, boots, gloves
    const th = bones[s < 0 ? BI.thighL : BI.thighR], sn = bones[s < 0 ? BI.shinL : BI.shinR], ft = bones[s < 0 ? BI.footL : BI.footR], upb = bones[s < 0 ? BI.upL : BI.upR], fob = bones[s < 0 ? BI.foreL : BI.foreR], hab = bones[s < 0 ? BI.handL : BI.handR];
    const g = 1 + mm * 0.18 + mu * 0.1 + f * 0.05;
    add(th, 'box', surf(shade(u.clothD, 0.85), 'cordura'), -0.004, -0.2 * k, s * 0.085 * g * k, 0.11, 0.14, 0.035);
    const pad = surf(shade(u.vest, 0.7), 'shell'); add(sn, 'box', pad, 0.06 * k, -0.005, 0, 0.04, 0.11, 0.1); { const sm = surf('#1c1d1f', 'cordura'); add(sn, 'ring', sm, 0.0, -0.035, 0, 0.125 * k, 0.022, 0.12 * k); } // the kneepad's strap
    { const fk = f ? 0.9 : 1, rz = (0.06 + mu * 0.018 + mm * 0.012) * k * fk, rx = (0.066 + mu * 0.024) * k * fk; const bm = mat(P.side, { rough: 0.75 }); bm.side = THREE.DoubleSide; add(upb, 'ring', bm, 0, -0.1 * k, 0, 2 * rx + 0.012, 0.055, 2 * rz + 0.012); add(upb, 'box', mat(o.color, { rough: 0.8 }), 0, -0.165 * k, s * (rz * 0.93 + 0.003), 0.05, 0.04, 0.006); } // the armband, tight round the sleeve
    add(fob, 'box', pad, -0.05 * k, -0.01, 0, 0.03, 0.08, 0.075);
    const boot = surf('#1c1d1f', 'leather'), sole = mat('#0c0d0e', { rough: 0.9 });
    { const am = new THREE.Mesh(taper(0.5, 0.56), boot); am.position.set(0.005, 0.01, 0); am.scale.set(0.088 * k, 0.1, 0.086 * k); ft.add(am); } // the boot's ankle, flaring to the foot
    add(ft, 'box', boot, 0.05 * k, -0.04, 0, 0.255 * k, 0.075, 0.095 * k); add(ft, 'box', sole, 0.05 * k, -0.08, 0, 0.27 * k, 0.022, 0.1 * k); add(ft, 'sph', boot, 0.16 * k, -0.05, 0, 0.09 * k, 0.07, 0.095 * k);
    add(ft, 'box', mat('#2a2b2d', { rough: 0.6 }), 0.17 * k, -0.066, 0, 0.06 * k, 0.04, 0.09 * k); // toe cap
    const glove = surf(P.acc.has('gloves') ? P.side : '#2a2c2e', 'leather');
    const hg = new THREE.Group(); hab.add(hg);
    add(hg, 'box', glove, 0.0, -0.045, -s * 0.005, 0.085, 0.09, 0.035); add(hg, 'box', glove, 0.025, -0.1, -s * 0.005, 0.05, 0.05, 0.03, 0, 0, 0.9); add(hg, 'box', glove, 0.035, -0.04, s * -0.025, 0.025, 0.06, 0.025, -s * 0.5, 0, 0.6);
    add(hg, 'box', mat('#151617', { rough: 0.5 }), 0.012, -0.075, -s * 0.022, 0.06, 0.02, 0.008); // knuckle guard
  }
  const gun = makeGun(gunId || gunFor(op)); body.add(gun);
  for (const g of [head, chestG, hipsG, gun]) mergeStatic(g);
  root.userData.op = op; root.userData.k = k;
  root.traverse(m => { if (m.isMesh) m.userData.part = m.parent === head ? 'head' : 'body'; });
  head.traverse(m => { if (m.isMesh) m.userData.part = 'head'; });

  // ---- posing: where the hips, chest and gun go, then the arms and legs reach (two-bone IK) and the bones turn ----
  const V = V3, X1 = V(1, 0, 0), U = new THREE.Matrix4(), Ur = new THREE.Quaternion(), tq = new THREE.Quaternion(), E = new THREE.Euler();
  const at = (x, y, z) => V(x * k, y * k, z * k).applyMatrix4(U);
  const W_ = {}; // bone world (body-space) quaternions this frame
  const setW = (name, q) => { const b = bones[BI[name]], pq = b.parent === body ? new THREE.Quaternion() : W_[b.parent.name]; W_[name] = q.clone(); b.quaternion.copy(pq.clone().invert().multiply(q)); };
  const posOf = name => { const b = bones[BI[name]]; let p = b.position.clone(), n = b; while (n.parent !== body) { p.applyQuaternion(W_[n.parent.name]).add(n.parent.position.clone()); n = n.parent; /* (positions of ancestors are local too) */ } return p; };
  // world position of a bone from its ancestors' world rotations
  const wpos = name => { const chain = []; let n = bones[BI[name]]; while (n !== body) { chain.unshift(n); n = n.parent; } let p = chain[0].position.clone(); for (let i = 1; i < chain.length; i++) p.add(chain[i].position.clone().applyQuaternion(W_[chain[i - 1].name])); return p; };
  void posOf;
  const knee = V(), elbow = V();
  root.pose = (name = 'stand', t = 0, moving = 0, aim = 0, lean = 0, sprint = 0) => {
    const pis = !!gun.userData.pistol, mv = Math.min(1, moving), run = sprint && name === 'stand' && !aim && mv > 0.2;
    let hipY = hipH - 0.05 * k, hipYaw = -0.42, chestYaw = -0.3, fwd = 0.1, roll = lean * 0.32, pitch = -0.22, pocket = V(0.07, 0.43, 0.125), port = false, rope = null;
    let feet = [V(0.15, 0, -0.13), V(-0.15, 0, 0.15)].map(p => p.multiplyScalar(k)), heel = [0, 0], footYaw = [-0.25, -0.7];
    const ph = t * (run ? 10.5 : 7.5);
    body.rotation.set(0, 0, 0); body.position.set(0, 0, 0);
    if (name === 'crouch') { hipY = hipH * 0.62; fwd = 0.3; pitch = -0.2; feet = [V(0.26, 0, -0.15), V(-0.24, 0.0, 0.17)].map(p => p.multiplyScalar(k)); heel = [0, 0.5]; footYaw = [-0.15, -0.5]; }
    if (name === 'hang' || name === 'hangInv') { hipYaw = 0; chestYaw = -0.12; fwd = -0.1; hipY = hipH - 0.08 * k; feet = [V(0.46, 0.38, -0.15), V(0.48, 0.5, 0.15)].map(p => p.multiplyScalar(k)); heel = [-1.35, -1.35]; footYaw = [0, 0]; pitch = -0.55; rope = true; }
    if (name === 'prone') { hipYaw = 0; chestYaw = 0; fwd = 0; hipY = hipH; feet = [V(0.0, -0.05, -0.19), V(0.0, -0.05, 0.19)].map(p => p.multiplyScalar(k)); heel = [0.2, 0.2]; footYaw = [0, 0]; }
    if (name === 'down') { hipYaw = 0; chestYaw = 0.1; fwd = -0.15; hipY = hipH - 0.08 * k; feet = [V(0.32, 0.12, -0.16), V(0.25, 0.05, 0.18)].map(p => p.multiplyScalar(k)); pitch = -0.9; }
    if (aim) { pitch = 0; pocket = V(0.085, 0.475, 0.1); chestYaw -= 0.05; fwd += 0.04; }
    if ((name === 'stand' || name === 'crouch') && mv > 0.02) {
      const A = (run ? 0.42 : name === 'crouch' ? 0.17 : 0.27) * mv * k;
      for (let i = 0; i < 2; i++) { const p0 = ph + (i ? Math.PI : 0); feet[i].x = feet[i].x * (1 - mv * 0.6) + Math.sin(p0) * A; feet[i].y += Math.max(0, Math.cos(p0)) * (run ? 0.16 : 0.09) * mv * k; feet[i].z *= 1 - mv * 0.25; heel[i] = Math.max(heel[i], Math.max(0, -Math.cos(p0)) * 0.4 * mv); }
      hipY -= Math.abs(Math.sin(ph)) * 0.025 * mv * k; hipYaw *= 1 - mv * 0.45; footYaw = footYaw.map(a => a * (1 - mv * 0.7));
      if (run) { fwd = 0.32; chestYaw = -0.06; port = true; }
    }
    // the trunk: hips turned for the stance, chest squared to the gun, leaning in
    const hipC = V(0, hipY, 0);
    U.compose(hipC, tq.setFromEuler(E.set(roll, chestYaw, -fwd, 'YXZ')), V(1, 1, 1)); Ur.setFromEuler(E);
    const hipsQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(roll * 0.3, hipYaw, -fwd * 0.3, 'YXZ'));
    bones[BI.hips].position.copy(hipC);
    setW('hips', hipsQ); setW('spine', hipsQ.clone().slerp(Ur, 0.55)); setW('chest', Ur); setW('neck', Ur.clone().slerp(new THREE.Quaternion(), 0.25));
    const headQ = Ur.clone().multiply(tq.setFromEuler(E.set(aim ? 0.2 : 0.05 - roll * 0.6, -chestYaw * 0.9, aim ? -0.14 : fwd * 0.6 - 0.05 + (name === 'prone' ? 1.25 : 0), 'YXZ')));
    setW('head', headQ);
    // legs
    for (const [s, th, sn, ftn] of [[-1, 'thighL', 'shinL', 'footL'], [1, 'thighR', 'shinR', 'footR']]) {
      const i = s < 0 ? 0 : 1, fy = footYaw[i], hp = wpos(th), ankle = feet[i].clone().add(V(0, ank, 0));
      const kneeFwd = V(Math.cos(fy * 0.5), 0.05, -Math.sin(fy * 0.5) + s * 0.25).normalize();
      const an = reach(hp, ankle, Lt, Ls, kneeFwd, knee);
      const dT = knee.clone().sub(hp), dS = an.clone().sub(knee);
      const thW = fq(dT, kneeFwd).multiply(qArmB); setW(th, thW);
      setW(sn, new THREE.Quaternion().setFromUnitVectors(dT.clone().normalize(), dS.clone().normalize()).multiply(thW));
      setW(ftn, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, fy, -heel[i], 'YXZ'))); // (heel up = toes down)
    }
    // the gun, then the hands on it (the left one on the rope while hanging)
    let gp, gq = new THREE.Quaternion();
    if (port) { gq.setFromUnitVectors(X1, V(0.42, 0.62, -0.66).normalize()); gp = at(0.22, 0.24, 0.13); }
    else if (pis) { const d = V(Math.cos(pitch * 1.2), Math.sin(pitch * 1.2), 0); gq.setFromUnitVectors(X1, d); gp = at(0.4, aim ? 0.5 : 0.36, 0.02); gp.z = 0.02; }
    else { const d = V(Math.cos(pitch), Math.sin(pitch), 0.0); gq.setFromUnitVectors(X1, d); const butt = at(pocket.x, pocket.y, pocket.z); gp = butt.addScaledVector(d, -(gun.userData.butt ?? -0.3)); }
    if (name === 'prone') { gq.setFromUnitVectors(X1, V(0.12, 1, 0).normalize()); gp = at(0.03, 0.52, 0.1); }
    gun.position.copy(gp); gun.quaternion.copy(gq);
    const grip = gp.clone().add(V(0, -0.06, 0).applyQuaternion(gq)), fore = gp.clone().add(V(gun.userData.fore || 0.25, -0.025, 0).applyQuaternion(gq));
    const ropeHand = rope ? at(0.2, 0.62, -0.05) : null;
    for (const [s, c, up, fo, ha] of [[-1, 'clavL', 'upL', 'foreL', 'handL'], [1, 'clavR', 'upR', 'foreR', 'handR']]) {
      setW(c, Ur);
      const sh = wpos(up);
      const target = s > 0 ? grip : (rope && !aim) ? ropeHand : pis ? grip.clone().add(V(-0.005, -0.015, -0.035).applyQuaternion(gq)) : fore;
      const pole = s > 0 ? V(-0.3, -0.5, 0.9).applyQuaternion(Ur).normalize() : V(-0.1, -1, -0.35).applyQuaternion(Ur).normalize();
      if (name === 'prone') pole.set(-1, 0, 0);
      const hand = reach(sh, target.clone().add(V(0, 0.03, 0)), La, Lf, pole, elbow);
      const dU = elbow.clone().sub(sh), dF = hand.clone().sub(elbow);
      const front = dF.clone().addScaledVector(dU.clone().normalize(), -dF.dot(dU.clone().normalize())); // the elbow bends toward the forearm's side
      const upW = fq(dU, front.lengthSq() > 1e-6 ? front : V(1, 0, 0)).multiply(qArmB); setW(up, upW);
      const foW = new THREE.Quaternion().setFromUnitVectors(dU.clone().normalize(), dF.clone().normalize()).multiply(upW); setW(fo, foW);
      setW(ha, foW.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(s > 0 ? 0.25 : -0.2, 0, 0))));
    }
    // whole-body turns: prone (on the belly, facing +x), down (on the back), upside down on a rope
    if (name === 'prone') { body.rotation.set(0, 0, -Math.PI / 2); body.position.set(-0.92 * k, 0.17 * k, 0); }
    if (name === 'down') { body.rotation.set(0, 0, Math.PI / 2); body.position.set(0.92 * k, 0.14 * k, 0); }
    if (name === 'hangInv') { body.rotation.set(Math.PI, 0, 0); body.position.set(0, 1.95 * k, 0); }
  };
  root.pose('stand');
  return root;
}

// a copy of a model with its own materials (your own body fades while you aim in)
export function ownMaterials(root) {
  const mats = [];
  root.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.transparent = true; mats.push(m.material); } });
  root.userData.mats = mats;
  return root;
}
export function setOpacity(root, a) { for (const m of root.userData.mats || []) { m.opacity = a; m.depthWrite = a > 0.95; } }

// Speed: the pieces of a part that never move against each other (head and headgear, chest with vest and pack, the
// gun) are merged into one mesh per material, so a model is a few dozen draws instead of a hundred and fifty.
export function mergeStatic(grp) {
  grp.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(grp.matrixWorld).invert(), buckets = new Map(), drop = [];
  grp.traverse(m => { if (!m.isMesh || m === grp) return; const M4 = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld); if (!buckets.has(m.material)) buckets.set(m.material, []); buckets.get(m.material).push([m.geometry, M4]); drop.push(m); });
  for (const m of drop) m.parent.remove(m);
  for (const o of [...grp.children]) if (!o.isMesh && o.children.length === 0) grp.remove(o);
  const nm = new THREE.Matrix3();
  for (const [mt, list] of buckets) {
    let n = 0; const parts = list.map(([g, M4]) => { const ng = g.index ? g.toNonIndexed() : g; n += ng.attributes.position.count; return [ng, M4]; });
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let o = 0; const v = new THREE.Vector3();
    for (const [g, M4] of parts) {
      nm.getNormalMatrix(M4); const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
      for (let i = 0; i < P.count; i++, o++) { v.fromBufferAttribute(P, i).applyMatrix4(M4); pos.set([v.x, v.y, v.z], o * 3); v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor.set([v.x, v.y, v.z], o * 3); if (U) uv.set([U.getX(i), U.getY(i)], o * 2); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const mesh = new THREE.Mesh(geo, mt); grp.add(mesh);
  }
}
