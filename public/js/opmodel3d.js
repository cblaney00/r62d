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
  cone: new THREE.ConeGeometry(0.5, 1, 20),
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
  const cups = (m = dark, r = 0.05) => { for (const s of [-1, 1]) add(h, 'cyl', m, 0, -0.005, s * (R0 + 0.012), r * 2, 0.035, r * 2, Math.PI / 2); add(h, 'tor', m, 0, 0.0, 0, R0 * 2.3, R0 * 2.3, R0 * 1.8, 0, Math.PI / 2, 0); };
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
  const { u, o, op } = P, kind = String(VEST[op] || 'carrier'), k = kind.replace(/\d+$/, ''), v = +(kind.match(/\d+$/) || [1])[0];
  const vm = mat(u.vest, { rough: 0.9 }), vl = mat(u.vestL, { rough: 0.9 }), st = mat(u.strap), side = mat(P.side);
  const plate = (m = vm, sc = 1) => { add(t, 'box', m, D + 0.02, 0.02, 0, 0.05 * sc, Hh * 1.45 * sc, W * 1.55 * sc); add(t, 'box', m, -D - 0.02, 0.02, 0, 0.05 * sc, Hh * 1.45 * sc, W * 1.55 * sc); for (const s of [-1, 1]) add(t, 'box', st, 0, Hh * 0.92, s * W * 0.55, D * 2 + 0.06, 0.03, 0.06); add(t, 'box', m, 0, -Hh * 0.45, W + 0.01, D * 1.8, Hh * 0.6, 0.04); add(t, 'box', m, 0, -Hh * 0.45, -W - 0.01, D * 1.8, Hh * 0.6, 0.04); };
  const pouches = (n, m = vl) => { for (let i = 0; i < n; i++) { const z = (i - (n - 1) / 2) * 0.075; add(t, 'box', m, D + 0.065, -Hh * 0.35, z, 0.045, 0.09, 0.065); add(t, 'box', st, D + 0.09, -Hh * 0.3, z, 0.006, 0.02, 0.06); } };
  const stripe = () => add(t, 'box', side, D + 0.048, Hh * 0.35, 0, 0.006, 0.025, W * 1.4);
  const patches = () => { for (const s of [-1, 1]) add(t, 'box', mat(o.color), 0, Hh * 0.55, s * (W + 0.07), 0.07, 0.05, 0.006); };
  switch (k) {
    case 'carrier': plate(); pouches(v + 1); break;
    case 'heavy': plate(mat(shade(u.vest, 0.9)), 1.12); for (const s of [-1, 1]) add(t, 'sph', vl, 0, Hh * 0.85, s * (W + 0.05), 0.16, 0.1, 0.14); add(t, 'cyl', vm, 0, Hh * 1.05, 0, D * 2.4, 0.06, W * 1.7); pouches(v === 3 ? 2 : 3); break;
    case 'bomb': add(t, 'box', mat('#3a3d44'), 0, 0, 0, D * 2.6, Hh * 2.2, W * 2.5); for (let i = -2; i <= 2; i++) add(t, 'box', mat('#2c2f35'), D * 1.31, i * 0.08, 0, 0.01, 0.02, W * 2.4); add(t, 'cyl', mat('#3a3d44'), 0, Hh * 1.15, 0, D * 2.8, 0.1, W * 2); break;
    case 'rig': add(t, 'box', vm, D + 0.015, -Hh * 0.2, 0, 0.03, Hh * 0.9, W * 1.3); pouches(v + 2); for (const s of [-1, 1]) add(t, 'box', st, 0, Hh * 0.6, s * W * 0.5, D * 2 + 0.05, 0.025, 0.04, s * 0.5); break;
    case 'harness': for (const s of [-1, 1]) add(t, 'box', mat('#2a2a2a'), D + 0.012, 0, 0, 0.012, Hh * 2.2, 0.04, s * 0.55); add(t, 'box', mat('#d8c040', { metal: 0.5, rough: 0.4 }), D + 0.025, -Hh * 0.2, 0, 0.02, 0.06, 0.06); break;
    case 'medic': plate(); add(t, 'box', mat('#f0f0f0'), D + 0.047, 0.02, 0, 0.006, 0.1, 0.1); add(t, 'box', mat(v === 2 ? '#2a9a5a' : '#c22'), D + 0.051, 0.02, 0, 0.004, 0.07, 0.022); add(t, 'box', mat(v === 2 ? '#2a9a5a' : '#c22'), D + 0.051, 0.02, 0, 0.004, 0.022, 0.07); break;
    case 'police': plate(mat('#1e2430')); add(t, 'box', mat('#d8d8d8'), D + 0.047, Hh * 0.3, 0, 0.006, 0.04, W * 1.1); break;
    case 'hivis': add(t, 'box', mat('#d8e030', { rough: 0.6 }), 0, 0, 0, D * 2 + 0.03, Hh * 1.9, W * 2.04); for (const y of v === 2 ? [-0.02, 0.06] : [-0.07, 0.07]) add(t, 'box', mat('#e8e8e8', { rough: 0.3, metal: 0.3 }), 0, y, 0, D * 2 + 0.04, 0.03, W * 2.06); break;
    case 'overalls': case 'apron': add(t, 'box', mat(shade(TINT[k], 1.15)), D + 0.012, -Hh * 0.2, 0, 0.02, Hh * 1.4, W * 1.3); for (const s of [-1, 1]) add(t, 'box', mat('#222'), 0, Hh * 0.7, s * W * 0.5, D * 2 + 0.03, 0.025, 0.035); break;
    case 'cloak': add(t, 'box', mat(v === 2 ? shade(o.helmet, 1.2) : '#121317'), -D - 0.03, -Hh * 0.6, 0, 0.03, Hh * 3.4, W * 2.4); add(t, 'cyl', mat('#121317'), 0, Hh * 0.95, 0, D * 2.4, 0.05, W * 2.1); break;
    case 'jersey': case 'singlet': add(t, 'box', mat('#ffffff', { op: 0.85 }), D + 0.004, 0, 0, 0.006, 0.035, W * 1.9); add(t, 'box', mat('#ffffff', { op: 0.85 }), -D - 0.004, 0, 0, 0.006, 0.035, W * 1.9); break;
    case 'ghillie': for (let i = 0; i < 26; i++) add(t, 'sph', mat(i % 3 ? '#3a5222' : '#5a6a2a'), Math.cos(i * 2.4) * D * 1.05, (i % 5 - 2) * Hh * 0.4, Math.sin(i * 2.4) * W * 1.05, 0.07, 0.05, 0.07); break;
    default: // jackets, coats, hoodies: a collar and a zip, maybe a light rig
      add(t, 'cyl', mat(shade(torsoCol(op, o, u), 0.7)), 0, Hh * 0.95, 0, D * 2.3, 0.05, W * 1.6); add(t, 'box', mat('#111', { op: 0.6 }), D + 0.004, 0, 0, 0.004, Hh * 1.9, 0.008);
      if (k === 'hoodie') add(t, 'sph', mat(shade(torsoCol(op, o, u), 0.85)), -D * 0.8, Hh * 1.05, 0, 0.14, 0.09, 0.2);
      if (v === 2 || k === 'field') pouches(2);
  }
  if (P.acc.has('vest') && !['hivis', 'ghillie', 'cloak', 'bomb'].includes(k)) stripe();
  patches();
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

// ---------------- the operator ----------------
export function makeOperator(op, gunId) {
  const o = OPERATORS[op] || { team: 'atk', color: '#888', helmet: '#444', armor: 2 };
  const u = uniformOf(op, o.team), P = { op, o, u, acc: accentsOf(op), side: SIDE_COL[o.team] || SIDE_COL.atk, skin: skinOf(op), hair: hairOf(op) };
  const wk = (BODY_W[o.armor] || 0.71) / 0.71; // heavies broad, lights slim (the top-down builds)
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const sleeve = mat('#ffffff', { map: limbTex(u, u.cloth) }), trousers = mat('#ffffff', { map: limbTex(u, u.clothD) });
  const boots = mat('#1c1d1f', { rough: 0.55 }), skin = mat(P.skin, { rough: 0.75 });
  const gloves = mat(P.acc.has('gloves') ? P.side : '#232527', { rough: 0.7 }), pad = mat(shade(u.vest, 0.75), { rough: 0.6 });
  const W = 0.17 * wk, D = 0.11 * Math.sqrt(wk), Hh = 0.21; // chest half sizes
  // chest: the jacket (with the pattern), the vest and the back item on it
  const chest = new THREE.Group(); body.add(chest);
  const tc = torsoCol(op, o, u), torsoMat = tc === u.cloth ? mat('#ffffff', { map: clothTex(u) }) : mat(tc, { rough: 0.9 });
  add(chest, 'sph', torsoMat, 0, 0, 0, D * 2.2, Hh * 2.25, W * 2.2);
  add(chest, 'cyl', torsoMat, 0, -Hh * 0.2, 0, D * 2.05, Hh * 1.3, W * 2.0);
  vest(chest, P, W, D, Hh); pack(chest, P, D, Hh);
  const pelvis = add(body, 'box', mat(u.clothD, { rough: 0.95 }), 0, 0, 0, D * 1.85, 0.17, W * 1.9);
  const belly = new THREE.Mesh(taper(0.5, 0.5), torsoMat); body.add(belly);
  const belt = add(body, 'cyl', mat('#26282b', { rough: 0.6 }), 0, 0, 0, D * 2.25, 0.05, W * 2.1); add(belt, 'box', metal('#8a8d90'), 0.5, 0, 0, 0.06, 0.9, 0.18);
  const neck = add(body, 'cyl', skin, 0, 0, 0, 0.1, 0.09, 0.1);
  const head = new THREE.Group(); body.add(head);
  headBase(head, P, skin); H(head, o, P); faceGear(head, P);
  const L = { thigh: 0.45, shin: 0.44, up: 0.3, fore: 0.28 };
  const mk = (a, b, m) => { const x = new THREE.Mesh(taper(a, b), m); body.add(x); return x; };
  const legs = [-1, 1].map(s => ({ s, thigh: mk(0.1 * wk, 0.075, trousers), shin: mk(0.072, 0.058, trousers), knee: add(body, 'box', pad, 0, 0, 0, 0.05, 0.1, 0.1), pocket: add(body, 'box', mat(shade(u.clothD, 0.9)), 0, 0, 0, 0.1, 0.13, 0.04), boot: add(body, 'box', boots, 0, 0, 0, 0.29, 0.12, 0.13), sole: add(body, 'box', mat('#0d0e0f'), 0, 0, 0, 0.3, 0.03, 0.135) }));
  const arms = [-1, 1].map(s => ({ s, up: mk(0.066 * wk, 0.056, sleeve), fore: mk(0.056, 0.046, sleeve), elbow: add(body, 'sph', sleeve, 0, 0, 0, 0.105, 0.105, 0.105), epad: add(body, 'box', pad, 0, 0, 0, 0.07, 0.09, 0.08), hand: add(body, 'box', gloves, 0, 0, 0, 0.055, 0.1, 0.085), bandM: add(body, 'cyl', mat(P.side), 0, 0, 0, 0.142 * wk, 0.055, 0.142 * wk), shoulder: add(body, 'sph', torsoMat, 0, 0, 0, 0.14 * wk, 0.13, 0.14 * wk) }));
  const gun = makeGun(gunId || gunFor(op)); body.add(gun);
  for (const g of [head, chest, gun]) mergeStatic(g);
  root.userData.op = op;
  root.traverse(m => { if (m.isMesh) m.userData.part = m.parent === head ? 'head' : 'body'; });

  // ---- posing ----
  const V = (x, y, z) => new THREE.Vector3(x, y, z), X1 = V(1, 0, 0), U = new THREE.Matrix4(), Ur = new THREE.Quaternion(), tq = new THREE.Quaternion(), E = new THREE.Euler();
  const at = (x, y, z) => V(x, y, z).applyMatrix4(U);
  const knee = V(), elbow = V();
  // name: stand | crouch | prone | down | hang | hangInv; t: walk clock; moving 0..1; aim: aimed in; lean -1..1; sprint
  root.pose = (name = 'stand', t = 0, moving = 0, aim = 0, lean = 0, sprint = 0) => {
    const pis = !!gun.userData.pistol, mv = Math.min(1, moving), run = sprint && name === 'stand' && !aim && mv > 0.2;
    let hipY = 0.97, hipYaw = -0.42, chestYaw = -0.3, fwd = 0.1, roll = lean * 0.32, pitch = -0.22, pocket = V(0.07, 0.43, 0.125), port = false, rope = null;
    let feet = [V(0.15, 0, -0.13), V(-0.15, 0, 0.15)], heel = [0, 0], footYaw = [-0.25, -0.7];
    const ph = t * (run ? 10.5 : 7.5);
    body.rotation.set(0, 0, 0); body.position.set(0, 0, 0);
    if (name === 'crouch') { hipY = 0.6; fwd = 0.3; pitch = -0.2; feet = [V(0.26, 0, -0.15), V(-0.24, 0.0, 0.17)]; heel = [0, 0.5]; footYaw = [-0.15, -0.5]; }
    if (name === 'hang' || name === 'hangInv') { hipYaw = 0; chestYaw = -0.12; fwd = -0.1; hipY = 0.92; feet = [V(0.46, 0.38, -0.15), V(0.48, 0.5, 0.15)]; heel = [-1.35, -1.35]; footYaw = [0, 0]; pitch = -0.55; rope = true; }
    if (name === 'prone') { hipYaw = 0; chestYaw = 0; fwd = 0; hipY = 0.95; feet = [V(0.0, -0.08, -0.19), V(0.0, -0.08, 0.19)]; heel = [-0.2, -0.2]; footYaw = [0, 0]; }
    if (name === 'down') { hipYaw = 0; chestYaw = 0.1; fwd = -0.15; hipY = 0.92; feet = [V(0.32, 0.12, -0.16), V(0.25, 0.05, 0.18)]; pitch = -0.9; }
    if (aim) { pitch = 0; pocket = V(0.085, 0.475, 0.1); chestYaw -= 0.05; fwd += 0.04; }
    // walking / running: the legs stride, the stance squares up a little, the gun stays in the shoulder
    if ((name === 'stand' || name === 'crouch') && mv > 0.02) {
      const A = (run ? 0.42 : name === 'crouch' ? 0.17 : 0.27) * mv;
      for (let i = 0; i < 2; i++) { const p0 = ph + (i ? Math.PI : 0); feet[i].x = feet[i].x * (1 - mv * 0.6) + Math.sin(p0) * A; feet[i].y += Math.max(0, Math.cos(p0)) * (run ? 0.16 : 0.09) * mv; feet[i].z *= 1 - mv * 0.25; heel[i] = Math.max(heel[i], Math.max(0, -Math.cos(p0)) * 0.4 * mv); }
      hipY -= Math.abs(Math.sin(ph)) * 0.025 * mv; hipYaw *= 1 - mv * 0.45; footYaw = footYaw.map(a => a * (1 - mv * 0.7));
      if (run) { fwd = 0.32; chestYaw = -0.06; port = true; }
    }
    const hipC = V(0, hipY, 0);
    U.compose(hipC, tq.setFromEuler(E.set(roll, chestYaw, -fwd, 'YXZ')), V(1, 1, 1)); Ur.setFromEuler(E);
    // trunk
    const chestP = at(0, 0.3, 0), neckP = at(0, 0.53, 0), headP = at(0.015, 0.67, 0);
    chest.position.copy(chestP); chest.quaternion.copy(Ur);
    pelvis.position.set(0, hipY - 0.02, 0); pelvis.rotation.set(0, hipYaw, 0);
    belt.position.set(Math.sin(fwd) * 0.05, hipY + 0.08, 0); belt.rotation.set(0, (hipYaw + chestYaw) / 2, -fwd * 0.6);
    place(belly, V(0, hipY + 0.02, 0), chestP); belly.scale.set(D * 2.0, belly.scale.y, W * 1.85); belly.rotateY((hipYaw + chestYaw) / 2);
    neck.position.copy(neckP).lerp(headP, 0.3); neck.quaternion.copy(Ur);
    // head: looks where the gun looks; aiming in, the cheek goes down onto the stock
    head.position.copy(headP);
    head.quaternion.copy(Ur).multiply(tq.setFromEuler(E.set(aim ? 0.2 : 0.05 - roll * 0.6, -chestYaw * 0.9, aim ? -0.14 : fwd * 0.6 - 0.05 + (name === 'prone' ? 1.25 : 0), 'YXZ')));
    if (aim) head.position.add(V(0.02, -0.035, 0.02));
    // legs
    for (const g of legs) {
      const i = g.s < 0 ? 0 : 1, hp = V(0, hipY - 0.05, g.s * 0.1).applyAxisAngle(V(0, 1, 0), hipYaw).setY(hipY - 0.05);
      const ankle = feet[i].clone().add(V(0, 0.09, 0)), fy = footYaw[i];
      const an = reach(hp, ankle, L.thigh, L.shin, V(Math.cos(fy * 0.5), 0.05, -Math.sin(fy * 0.5) + g.s * 0.25).normalize(), knee);
      const kf = V(Math.cos(hipYaw), 0, -Math.sin(hipYaw));
      placeB(g.thigh, hp, knee, kf); placeB(g.shin, knee, an, kf);
      g.knee.position.copy(knee).addScaledVector(kf, 0.055).add(V(0, -0.025, 0)); g.knee.quaternion.copy(g.shin.quaternion);
      g.pocket.position.lerpVectors(hp, knee, 0.5).add(V(0, 0, g.s * 0.085 * wk)); g.pocket.quaternion.copy(g.thigh.quaternion);
      g.boot.position.set(an.x + Math.cos(fy) * 0.05, an.y - 0.035, an.z - Math.sin(fy) * 0.05); g.boot.rotation.set(0, fy, heel[i]);
      g.sole.position.copy(g.boot.position).add(V(0, -0.055, 0).applyEuler(g.boot.rotation)); g.sole.rotation.copy(g.boot.rotation);
    }
    // the gun: stock in the shoulder pocket, muzzle low at rest, level aimed in; sprinting it is carried across the chest
    let gp, gq = new THREE.Quaternion();
    if (port) { gq.setFromUnitVectors(X1, V(0.42, 0.62, -0.66).normalize()); gp = at(0.22, 0.24, 0.13); }
    else if (pis) { const d = V(Math.cos(pitch * 1.2), Math.sin(pitch * 1.2), 0); gq.setFromUnitVectors(X1, d); gp = at(0.4, aim ? 0.5 : 0.36, 0.02); gp.z = 0.02; }
    else { const d = V(Math.cos(pitch), Math.sin(pitch), 0.0); gq.setFromUnitVectors(X1, d); const butt = at(pocket.x, pocket.y, pocket.z); gp = butt.addScaledVector(d, -(gun.userData.butt ?? -0.3)); }
    if (name === 'prone') { gq.setFromUnitVectors(X1, V(0.12, 1, 0).normalize()); gp = at(0.03, 0.52, 0.1); }
    gun.position.copy(gp); gun.quaternion.copy(gq);
    const grip = gp.clone().add(V(0, -0.06, 0).applyQuaternion(gq)), fore = gp.clone().add(V(gun.userData.fore || 0.25, -0.025, 0).applyQuaternion(gq));
    const ropeHand = rope ? at(0.2, 0.62, -0.05) : null;
    for (const g of arms) {
      const sh = at(-0.01, 0.46, g.s * (W + 0.035));
      const target = g.s > 0 ? grip : (rope && !aim) ? ropeHand : pis ? grip.clone().add(V(-0.005, -0.015, -0.035).applyQuaternion(gq)) : fore;
      const pole = g.s > 0 ? at(-0.3, -0.5, 0.9).sub(hipC).normalize() : at(-0.1, -1, -0.35).sub(hipC).normalize();
      if (name === 'prone') pole.set(-1, 0, 0);
      const hand = reach(sh, target, L.up, L.fore, pole, elbow);
      const fw = V(0, 1, 0);
      placeB(g.up, sh, elbow, fw); placeB(g.fore, elbow, hand, fw);
      g.elbow.position.copy(elbow); g.epad.position.copy(elbow).addScaledVector(V().subVectors(elbow, sh).normalize(), 0.03).addScaledVector(V().subVectors(hand, elbow).normalize(), 0.04); g.epad.quaternion.copy(g.fore.quaternion);
      g.hand.position.copy(hand); g.hand.quaternion.copy(g.fore.quaternion);
      g.shoulder.position.copy(sh); g.shoulder.quaternion.copy(Ur);
      g.bandM.position.lerpVectors(sh, elbow, 0.45); g.bandM.quaternion.copy(g.up.quaternion);
    }
    // whole-body turns: prone (on the belly, facing +x), down (on the back), upside down on a rope
    if (name === 'prone') { body.rotation.set(0, 0, -Math.PI / 2); body.position.set(-0.92, 0.17, 0); }
    if (name === 'down') { body.rotation.set(0, 0, Math.PI / 2); body.position.set(0.92, 0.14, 0); }
    if (name === 'hangInv') { body.rotation.set(Math.PI, 0, 0); body.position.set(0, 1.95, 0); }
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
