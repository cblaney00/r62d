// Top-down drawings of operators, drones, gadgets and the objective.
import { OPERATORS, WEAPONS, bodyW } from '/shared/operators.js';
import { shade } from './textures.js';

const UNIFORM = {
  atk: { cloth: '#8a8360', clothD: '#625d43', vest: '#5d5b42', vestL: '#787556', dark: '#38372a', strap: '#47452f' },
  def: { cloth: '#62728b', clothD: '#46536a', vest: '#3e4a5e', vestL: '#56667f', dark: '#262e3b', strap: '#323b4a' },
};
const SKIN = ['#c99a78', '#a8785a', '#7a5238', '#e0b393', '#8d6346'];
const OUT = 'rgba(6,7,9,0.6)';
let LX = -0.6, LY = -0.8; // light direction in the character's rotated frame (world light comes from the top-left)

function cap(ctx, x1, y1, x2, y2, w, col) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
function limb(ctx, pts, w, col) { // outlined, two-segment limb
  for (const [lw, c] of [[w + 1.1, OUT], [w, col]]) {
    ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = w * 0.35;
  ctx.beginPath(); ctx.moveTo(pts[0] + LX * w * 0.25, pts[1] + LY * w * 0.25); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i] + LX * w * 0.25, pts[i + 1] + LY * w * 0.25); ctx.stroke();
}
let SHADE = true; // off on Low graphics: flat colours instead of per-part lighting
export function setShading(on) { SHADE = on; }
function shaded(ctx, x, y, r, col) { // radial shading lit from the top-left
  if (!SHADE) return col;
  const g = ctx.createRadialGradient(x + LX * r * 0.45, y + LY * r * 0.45, r * 0.1, x, y, r * 1.15);
  g.addColorStop(0, shade(col, 1.5)); g.addColorStop(0.55, col); g.addColorStop(1, shade(col, 0.68));
  return g;
}
function ell(ctx, x, y, rx, ry, col, outline = true) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7);
  ctx.fillStyle = shaded(ctx, x, y, Math.max(rx, ry), col); ctx.fill();
  if (outline) { ctx.strokeStyle = OUT; ctx.lineWidth = 0.55; ctx.stroke(); }
}
function box(ctx, x, y, w, h, r, col, outline = true) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = shaded(ctx, x + w / 2, y + h / 2, Math.max(w, h) / 2, col); ctx.fill();
  if (outline) { ctx.strokeStyle = OUT; ctx.lineWidth = 0.5; ctx.stroke(); }
}

function drawGun(ctx, wkey, recoil) {
  const w = WEAPONS[wkey]; if (!w) return;
  const L = w.len, x0 = 4 - recoil;
  const metal = '#1d1f23', poly = w.cls === 'Shotgun' ? '#5b3c22' : '#2b2e33';
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x0 + 1.2, 1.9, L, 2.6);
  // stock
  if (w.cls !== 'Pistol' && w.cls !== 'MP') { box(ctx, x0 - 4, 0.1, 5, 2.8, 0.8, poly); ctx.fillStyle = '#111'; ctx.fillRect(x0 - 4, 0.3, 0.8, 2.4); }
  // receiver + handguard
  box(ctx, x0, -0.3, L * 0.6, 3.3, 0.6, metal);
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; for (let i = 0; i < L * 0.5; i += 1.3) ctx.fillRect(x0 + L * 0.08 + i, -0.3, 0.55, 0.6); // top rail
  // barrel + muzzle
  ctx.fillStyle = '#121316'; ctx.fillRect(x0 + L * 0.6, 0.55, L * 0.4, 1.6);
  ctx.fillStyle = '#0a0a0c'; ctx.fillRect(x0 + L - 1.6, 0.25, 1.9, 2.2);
  if (w.cls === 'AR' || w.cls === 'SMG' || w.cls === 'MP') { box(ctx, x0 + L * 0.32, 2.7, 2.3, w.cls === 'MP' ? 2.8 : 3.6, 0.5, '#24272b'); }
  if (w.cls === 'LMG') { box(ctx, x0 + L * 0.26, 2.5, 5, 4.4, 0.8, '#3d4030'); cap(ctx, x0 + L * 0.7, 2.2, x0 + L * 0.45, 3.6, 0.6, '#222'); }
  if (w.cls === 'Shotgun') { box(ctx, x0 + L * 0.5, -0.1, 5, 3.1, 0.8, '#6a4628'); ctx.fillStyle = 'rgba(0,0,0,0.4)'; for (let i = 0; i < 4; i++) ctx.fillRect(x0 + L * 0.5 + 0.6 + i * 1.1, 0.1, 0.4, 2.7); }
  if (w.cls === 'DMR') {
    box(ctx, x0 + L * 0.16, -1.9, L * 0.42, 2, 0.8, '#0f1012');
    ctx.fillStyle = '#7fc3ff'; ctx.beginPath(); ctx.arc(x0 + L * 0.58, -0.9, 0.7, 0, 7); ctx.fill();
  } else if (w.cls !== 'Pistol') {
    box(ctx, x0 + L * 0.26, -1.3, 3.6, 1.6, 0.5, '#101113');
    ctx.fillStyle = '#ff4646'; ctx.beginPath(); ctx.arc(x0 + L * 0.26 + 2.6, -0.5, 0.45, 0, 7); ctx.fill();
  }
}

// p: {x,y,aim,team,op,walk,ads,crouch,downed,recoil,reload,brace,scan,melee,ally,flash,w}
export function drawOperator(ctx, p, t) {
  const o = OPERATORS[p.op]; if (!o) return;
  const u = UNIFORM[o.team];
  const skin = SKIN[(p.op.charCodeAt(0) + p.op.length) % SKIN.length];
  const ca = Math.cos(-p.aim), sa = Math.sin(-p.aim);
  LX = -0.6 * ca + 0.8 * sa; LY = -0.6 * sa - 0.8 * ca;
  ctx.save(); ctx.translate(p.x, p.y);
  ctx.strokeStyle = p.ally ? 'rgba(70,170,255,0.7)' : 'rgba(255,120,40,0.75)'; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.stroke();
  const sg = ctx.createRadialGradient(2, 3, 2, 2, 3, 14); sg.addColorStop(0, 'rgba(0,0,0,0.45)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(2, 3, 14, 0, 7); ctx.fill();
  ctx.rotate(p.aim);

  if (p.downed) {
    ctx.rotate(Math.PI * 0.85);
    limb(ctx, [-5, -3, -10, -4, -15, -3 + Math.sin(t * 2) * 0.8], 3.4, u.clothD);
    limb(ctx, [-5, 3, -10, 4.5, -15, 4], 3.4, u.clothD);
    ell(ctx, -15.5, -3, 2.4, 1.8, '#1a1a1a'); ell(ctx, -15.5, 4, 2.4, 1.8, '#1a1a1a');
    ell(ctx, -1, 0, 7.5, 8, u.cloth); box(ctx, -5.5, -5.5, 9.5, 11, 2.5, u.vest);
    limb(ctx, [1, -6.5, 5, -10, 10, -9.5], 3, u.cloth); limb(ctx, [1, 6.5, 6, 9, 11, 7 + Math.sin(t * 3) * 0.6], 3, u.cloth);
    ell(ctx, 7.5, 0, 4.8, 4.8, o.helmet);
    ctx.restore(); return;
  }

  // ---- legs (they step when walking AND when turning on the spot) ----
  const bw = bodyW(p.op); // skinnier build: legs, back gear and torso squeezed sideways (not the head)
  ctx.save(); ctx.scale(1, bw);
  const walk = p.walk || 0, st = Math.sin(walk), cr = !!p.crouch;
  const stride = st * (cr ? 2.2 : 4.6) * (p.legs ?? 1); // feet come back together when standing still
  const feet = cr ? [[5.5 + stride * 0.3, 4.2], [4 - stride * 0.3, -4.6]] : [[stride, 4.8], [-stride, -4.8]];
  for (const [fx, fy] of feet) {
    const hip = [-1, fy > 0 ? 3.2 : -3.2];
    const knee = cr ? [fx + 2.5, fy * 1.15] : [(hip[0] + fx) / 2 + 0.8, (hip[1] + fy) / 2 + (fy > 0 ? 0.3 : -0.3)];
    limb(ctx, [hip[0], hip[1], knee[0], knee[1], fx, fy], 3.6, u.clothD);
    if (cr) ell(ctx, knee[0], knee[1], 1.5, 1.6, '#1d1f22');
    ell(ctx, fx + 1, fy, 3.4, 2.3, '#1c1b1a');
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(fx + 2.6, fy - 1.4, 1.2, 2.8);
  }

  // ---- back gear ----
  const id = o.ability.id;
  if (id === 'cutter') { box(ctx, -12.5, -4.5, 5.5, 9, 2.6, '#c8601f'); ctx.fillStyle = '#222'; ctx.fillRect(-12, -1, 4.5, 2); cap(ctx, -9, 3.5, -3, 8, 0.8, '#222'); }
  else if (id === 'panel') { box(ctx, -12.5, -6, 4.5, 12, 1, '#59626b'); ctx.fillStyle = '#d9b02a'; for (let i = 0; i < 3; i++) ctx.fillRect(-12.3, -5 + i * 4, 4, 1); }
  else if (id === 'jammer') { box(ctx, -11.5, -4, 4.5, 8, 1.2, '#2b2f36'); ctx.fillStyle = '#55c1e8'; ctx.fillRect(-10.5, -2.5, 1.2, 1.2); cap(ctx, -9, -3, -14, -9, 0.6, '#999'); }
  else if (o.team === 'atk') { box(ctx, -11.5, -5.5, 5, 11, 1.6, u.dark); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(-11, -3, 4, 0.6); ctx.fillRect(-11, 2, 4, 0.6); }
  else { box(ctx, -9.8, 2.6, 3.6, 4.4, 0.8, '#222'); cap(ctx, -8.4, 3, -11.5, 8.5, 0.7, '#111'); }

  // ---- torso & plate carrier ----
  const sh = cr ? 0.93 : 1;
  ell(ctx, -1, 0, 6.8 * sh, 9.4 * sh, u.cloth);
  box(ctx, -6, -6.6, 10.2, 13.2, 3, u.vest);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.35;              // MOLLE webbing
  for (let i = -5; i <= 5; i += 1.6) { ctx.beginPath(); ctx.moveTo(-3.5, i); ctx.lineTo(1.8, i); ctx.stroke(); }
  cap(ctx, -5, -6, -0.5, -7.5, 1.1, u.strap); cap(ctx, -5, 6, -0.5, 7.5, 1.1, u.strap);   // shoulder straps
  for (let i = -1; i <= 1; i++) { box(ctx, 2.2, i * 3.9 - 1.5, 2.6, 3, 0.6, u.vestL); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(2.2, i * 3.9 - 0.4, 2.6, 0.35); }
  box(ctx, -3.6, -8.6, 3.6, 2.2, 0.6, o.color, false); box(ctx, -3.6, 6.4, 3.6, 2.2, 0.6, o.color, false); // shoulder patches
  if (o.team === 'def') { box(ctx, -1.8, -6.2, 1.8, 2.4, 0.4, '#141518'); cap(ctx, -1, -6, -1.5, -10, 0.5, '#111'); } // radio
  if (id === 'slug') { cap(ctx, -4.5, -6.5, 3.5, 6.5, 1.6, '#3a2a1a'); ctx.fillStyle = '#b02a2a'; for (let i = 0; i < 6; i++) ctx.fillRect(-4 + i * 1.3, -5.2 + i * 2.05, 0.9, 1.1); }
  if (id === 'emp') { for (const yy of [-3, 1.5]) { ell(ctx, -2.5, yy, 1.4, 1.4, '#7d4fb0'); ctx.fillStyle = `rgba(200,150,255,${0.5 + 0.5 * Math.sin(t * 4 + yy)})`; ctx.beginPath(); ctx.arc(-2.5, yy, 0.5, 0, 7); ctx.fill(); } }
  if (id === 'mine') { for (const yy of [-7.4, 7.4]) { box(ctx, -4, yy - 1, 2.6, 2, 0.5, '#33402a'); ctx.fillStyle = '#8fd14f'; ctx.fillRect(-3, yy - 0.3, 0.6, 0.6); } }
  if (id === 'stim') { ctx.fillStyle = '#fff'; ctx.fillRect(-3, 6.6, 2.4, 1.6); ctx.fillStyle = '#c22'; ctx.fillRect(-2.2, 6.7, 0.8, 1.4); ctx.fillRect(-2.8, 7.1, 2, 0.6); }
  if (id === 'panel') { for (const yy of [-1, 1]) { ctx.save(); ctx.scale(1, yy); box(ctx, -4.5, 6.5, 6, 3.4, 1.5, '#5d666f'); ctx.restore(); } }

  ctx.restore();

  // ---- weapon & arms ----
  const shield = id === 'brace' && p.brace, shieldBack = id === 'brace' && !p.brace;
  const pistol = WEAPONS[p.w] && (WEAPONS[p.w].cls === 'Pistol' || WEAPONS[p.w].cls === 'MP');
  const rec = p.recoil || 0, mel = p.melee || 0, L = WEAPONS[p.w] ? WEAPONS[p.w].len : 12;
  ctx.save();
  if (mel > 0) ctx.rotate(-Math.sin(mel * Math.PI) * 0.9);
  if (p.reload) ctx.rotate(0.38 + Math.sin(t * 9) * 0.05);
  ctx.translate(p.ads ? 2 : 0, p.ads ? 0 : 1.4);
  const glove = (x, y) => { ell(ctx, x, y, 1.7, 1.6, '#1f1f20'); };
  if (shield) {
    limb(ctx, [-0.5, 7 * bw, 3, 6.5, 8.5 - rec, 2.6], 3.1, u.cloth); drawGun(ctx, p.w, rec); glove(8.5 - rec, 2.6);
    limb(ctx, [-0.5, -7 * bw, 4, -8 * bw, 9, -7.5 * bw], 3.1, u.cloth); glove(9, -7.5 * bw);
  } else if (pistol) {
    limb(ctx, [-0.5, 7 * bw, 3, 5.5, 7 - rec, 1.4], 3.1, u.cloth); limb(ctx, [-0.5, -7 * bw, 3, -5.5, 7 - rec, 1.2], 3.1, u.cloth);
    drawGun(ctx, p.w, rec); glove(7 - rec, 1.4); glove(7.3 - rec, 0.4);
  } else {
    limb(ctx, [-0.5, 7.2 * bw, 2.2, 7.8, 5.5 - rec, 2.6], 3.2, u.cloth);
    drawGun(ctx, p.w, rec);
    limb(ctx, [-0.5, -7 * bw, 4, -6.5, 4 + L * 0.52 - rec, 0.9], 3.2, u.cloth);
    glove(5.5 - rec, 2.6); glove(4 + L * 0.52 - rec, 0.9);
  }
  if (id === 'dart') { box(ctx, 5 + L * 0.2, -4.8, 3.5, 1.8, 0.5, '#2b3a38'); ctx.fillStyle = '#4fb3a9'; ctx.fillRect(7.6 + L * 0.2, -4.4, 0.8, 0.8); }
  if (id === 'scan') { box(ctx, 4 + L * 0.2, -5.4, 3.6, 2.2, 0.5, '#1d2030'); ctx.fillStyle = p.scan ? '#a0b0ff' : '#4656c0'; ctx.fillRect(4.6 + L * 0.2, -4.9, 2.4, 1.2); }
  if (p.flash && WEAPONS[p.w]) {
    const mx = 4 + L - rec + 2.2;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(mx, 1.5, 0, mx, 1.5, 10); g.addColorStop(0, 'rgba(255,240,190,0.95)'); g.addColorStop(0.35, 'rgba(255,170,60,0.6)'); g.addColorStop(1, 'rgba(255,120,20,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx, 1.5, 10, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff6d0';
    ctx.beginPath(); ctx.moveTo(mx - 1, 0.2); ctx.lineTo(mx + 7 + Math.random() * 3, 1.5); ctx.lineTo(mx - 1, 2.8); ctx.fill();
    ctx.beginPath(); ctx.moveTo(mx, 1.5); ctx.lineTo(mx + 3, -1.8 - Math.random()); ctx.lineTo(mx + 1, 1.5); ctx.lineTo(mx + 3, 4.8 + Math.random()); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
  if (shieldBack) { // slung on the back while the pistol is out
    ctx.strokeStyle = '#22252a'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.arc(2, 0, 11, Math.PI - 0.8, Math.PI + 0.8); ctx.stroke();
  }
  if (shield) { // pose from shieldPose (shared/operators.js): exactly where the server's shield stops bullets
    const sp = p.shieldPose || { rot: 0, arc: 0.95 }, arc = sp.arc;
    ctx.save(); ctx.rotate(sp.rot); if (sp.off) ctx.globalAlpha *= 0.75;
    ctx.lineCap = 'butt';
    ctx.strokeStyle = OUT; ctx.lineWidth = 5.4; ctx.beginPath(); ctx.arc(-2, 0, 14, -arc, arc); ctx.stroke();
    ctx.strokeStyle = '#22252a'; ctx.lineWidth = 4.4; ctx.beginPath(); ctx.arc(-2, 0, 14, -arc, arc); ctx.stroke();
    ctx.strokeStyle = '#5a626b'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(-2, 0, 15.8, -arc, arc); ctx.stroke();
    ctx.save(); ctx.rotate(-0.12); ctx.fillStyle = '#8fd0f2'; ctx.fillRect(11.3, -2, 1.6, 4); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(11.4, -1.8, 0.5, 1.5); ctx.restore();
    ctx.save(); ctx.rotate(0.5); ctx.fillStyle = '#d84a4a'; ctx.fillRect(11.2, -1, 2.2, 2); ctx.restore();
    ctx.restore();
  }

  // ---- head & headgear ----
  ell(ctx, 0.8, 0, 4.3, 4.3, skin);
  const earCups = () => { ell(ctx, 0, -4.7, 1.8, 1.3, '#151618'); ell(ctx, 0, 4.7, 1.8, 1.3, '#151618'); };
  switch (o.look) {
    case 'cap':
      earCups(); ell(ctx, 0, 0, 4.6, 4.6, o.helmet);
      ctx.beginPath(); ctx.ellipse(4.4, 0, 2.8, 3.9, 0, -Math.PI / 2, Math.PI / 2); ctx.fillStyle = shade(o.helmet, 0.7); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 0.5; ctx.stroke();
      cap(ctx, -0.5, -4.6, -0.5, 4.6, 0.7, '#111');
      ctx.fillStyle = o.color; ctx.beginPath(); ctx.arc(-1.8, 0, 1, 0, 7); ctx.fill();
      break;
    case 'mask':
      ell(ctx, 0.6, 0, 4.7, 4.7, shade(o.helmet, 0.75));
      box(ctx, 2.6, -3.2, 2.4, 6.4, 1, '#0a0a0b'); ctx.fillStyle = o.color; ctx.fillRect(4, -2.6, 0.9, 2); ctx.fillRect(4, 0.6, 0.9, 2);
      earCups();
      break;
    case 'goggles':
      earCups(); ell(ctx, 0, 0, 5.2, 5.2, o.helmet);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-3.5, -0.4, 4, 0.8);
      box(ctx, 2.8, -3.8, 2.6, 7.6, 1.2, '#101010'); ctx.fillStyle = o.color; ctx.fillRect(4.6, -3.1, 0.9, 2.4); ctx.fillRect(4.6, 0.7, 0.9, 2.4);
      break;
    case 'visor':
      ell(ctx, 0, 0, 5.7, 5.7, o.helmet);
      ctx.beginPath(); ctx.arc(0, 0, 5.7, -0.95, 0.95); ctx.lineTo(0, 0); ctx.closePath();
      const vg = ctx.createLinearGradient(0, -5, 5, 5); vg.addColorStop(0, 'rgba(160,210,240,0.95)'); vg.addColorStop(1, 'rgba(60,110,150,0.95)');
      ctx.fillStyle = vg; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 0.5; ctx.stroke();
      break;
    case 'hood':
      ell(ctx, -1.2, 0, 6, 5.9, shade(o.helmet, 1.25));
      ell(ctx, 1.2, 0, 4.3, 4.1, '#0d0e10'); ctx.fillStyle = o.color; ctx.fillRect(4, -1.5, 0.9, 3);
      break;
    default: // ballistic helmet
      earCups(); ell(ctx, 0, 0, 5.4, 5.4, o.helmet);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-1.5, -5.4, 1.2, 10.8);         // side rails
      box(ctx, 3.4, -1.4, 1.8, 2.8, 0.4, '#141516');                                   // NVG mount
      ctx.fillStyle = o.color; ctx.fillRect(-4.5, -0.6, 3.2, 1.2);
      if (id === 'stim') { ctx.fillStyle = '#fff'; ctx.fillRect(-3.2, -1.7, 3.4, 3.4); ctx.fillStyle = '#c22'; ctx.fillRect(-2.1, -1.4, 1.2, 2.8); ctx.fillRect(-2.9, -0.6, 2.8, 1.2); }
  }
  if (p.scan) { ctx.strokeStyle = `rgba(140,160,255,${0.4 + 0.3 * Math.sin(t * 10)})`; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(0, 0, 9 + (t * 20) % 8, 0, 7); ctx.stroke(); }
  ctx.restore();
}

export function drawCorpse(ctx, c) {
  drawOperator(ctx, { ...c, downed: true }, 0);
}

export function drawDrone(ctx, d, t, ally) {
  const spd = d.spd || 0, wheel = d.wheel || 0, lean = Math.min(1, spd / 115); // 115 = drone top speed (DRONE_SPEED)
  const rel = (d.mvAng ?? d.ag) - (d.ag || 0);
  ctx.save(); ctx.translate(d.x, d.y);
  ctx.rotate(d.ag || 0); ctx.scale(0.7, 0.7); // 30% smaller (he asked)
  // about a foot long (10 px, 1 m = 36 px) and half as wide: a low rectangle on four little wheels
  if (ally) { ctx.strokeStyle = 'rgba(70,170,255,0.45)'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.roundRect(-5.8, -3.5, 11.6, 7, 2); ctx.stroke(); }
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0.5, 0.8, 5.2, 2.9, 0, 0, 7); ctx.fill();
  for (const [wx, wy] of [[-3.1, -2.1], [3.1, -2.1], [-3.1, 2.1], [3.1, 2.1]]) {
    ctx.fillStyle = '#121314'; ctx.beginPath(); ctx.roundRect(wx - 1.3, wy - 0.55, 2.6, 1.1, 0.5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; const off = (wheel * 1.1) % 0.9;
    for (let i = -1.3 + off; i < 1.3; i += 0.9) ctx.fillRect(wx + i, wy - 0.55, 0.2, 1.1);
  }
  ctx.save(); ctx.translate(-Math.cos(rel) * lean * 0.35, -Math.sin(rel) * lean * 0.35 + (spd > 20 ? Math.sin(wheel) * 0.15 : 0));
  const g = ctx.createLinearGradient(-4.6, -1.7, 4.6, 1.7); g.addColorStop(0, '#4a4f55'); g.addColorStop(1, '#2a2d31');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-4.6, -1.7, 9.2, 3.4, 0.8); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 0.3; ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-3, -1.1, 0.3, 2.2); ctx.fillRect(-2.3, -1.1, 0.3, 2.2);
  ctx.fillStyle = '#16181b'; ctx.beginPath(); ctx.arc(4.1, 0, 1, 0, 7); ctx.fill();           // camera
  ctx.fillStyle = 'rgba(140,200,240,0.5)'; ctx.beginPath(); ctx.arc(4.35, -0.3, 0.3, 0, 7); ctx.fill();
  // the giveaway: one small red dot in the middle of the top
  ctx.fillStyle = `rgba(255,40,40,${0.75 + 0.25 * Math.sin(t * 4)})`; ctx.beginPath(); ctx.arc(0, 0, 0.6, 0, 7); ctx.fill();
  ctx.strokeStyle = '#6d7278'; ctx.lineWidth = 0.25; ctx.beginPath(); ctx.moveTo(-4.2, -0.8);
  ctx.lineTo(-5.8 - (d.sway || 0) * 0.6, -0.8 - (d.sway || 0) * 1.5); ctx.stroke();
  ctx.restore();
  if (d.j) {
    ctx.strokeStyle = `rgba(150,200,255,${0.4 + Math.random() * 0.5})`; ctx.lineWidth = 0.5; ctx.beginPath();
    for (let i = 0; i < 4; i++) { ctx.moveTo((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12); ctx.lineTo((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12); }
    ctx.stroke();
  }
  ctx.restore();
}

export function drawCam(ctx, c, t, ally) {
  if (c.wn !== undefined) return drawWallCam(ctx, c, t, ally);
  ctx.save(); ctx.translate(c.x, c.y);
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.arc(1, 1.5, 5, 0, 7); ctx.fill();
  if (!c.hp) {
    ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, 7); ctx.fill();
    ctx.strokeStyle = '#555'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(-3, -2); ctx.lineTo(2, 3); ctx.moveTo(2, -3); ctx.lineTo(-1, 2); ctx.stroke();
  } else {
    if (c.ag !== undefined) { ctx.save(); ctx.rotate(c.ag); const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 22); g.addColorStop(0, 'rgba(255,60,60,0.35)'); g.addColorStop(1, 'rgba(255,60,60,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 22, -0.95, 0.95); ctx.fill(); ctx.fillStyle = '#2a2c30'; ctx.fillRect(2, -1.6, 4, 3.2); ctx.restore(); }
    if (c.tu) { // turret camera: armoured octagon with a laser barrel
      ctx.save(); ctx.rotate(c.ag || 0); ctx.fillStyle = '#3a1e1e'; ctx.fillRect(3, -1, 6, 2); ctx.fillStyle = '#ff4040'; ctx.fillRect(8, -0.5, 1.5, 1); ctx.restore();
      ctx.fillStyle = '#5c6268'; ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8; ctx.lineTo(Math.cos(a) * 5.4, Math.sin(a) * 5.4); } ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#2a2d31'; ctx.lineWidth = 0.6; ctx.stroke();
    } else { ctx.fillStyle = '#d7d9db'; ctx.beginPath(); ctx.arc(0, 0, 4.4, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#1b1d20'; ctx.beginPath(); ctx.arc(0, 0, 2.8, 0, 7); ctx.fill();
    ctx.fillStyle = c.off ? '#4060ff' : (Math.floor(t * 2) % 2 ? '#ff3030' : '#601010'); ctx.beginPath(); ctx.arc(2.6, -2.6, 0.9, 0, 7); ctx.fill();
  }
  ctx.restore();
}

// a map camera hung on a wall (or up in a corner): small and dark like a fitting of the building, its
// view cone shown only to defenders, a faint red light the only giveaway
function drawWallCam(ctx, c, t, ally) {
  ctx.save(); ctx.translate(c.x, c.y);
  const ag = c.ag ?? c.wn;
  if (ally && c.hp && !c.off) { ctx.save(); ctx.rotate(ag); const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 20); g.addColorStop(0, 'rgba(255,60,60,0.3)'); g.addColorStop(1, 'rgba(255,60,60,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 20, -0.95, 0.95); ctx.fill(); ctx.restore(); }
  ctx.save(); ctx.rotate(c.wn); // mounting plate against the wall face, short arm out to the camera
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-2.6, -2.4, 3.4, 5.4);
  ctx.fillStyle = '#3a3d41'; ctx.fillRect(-3, -2.6, 1.4, 5.2); ctx.fillRect(-2, -0.5, 2, 1);
  ctx.restore();
  if (!c.hp) { // shot down: cracked housing hanging off its plate
    ctx.fillStyle = '#222428'; ctx.beginPath(); ctx.arc(0.6, 0.8, 2.2, 0, 7); ctx.fill();
    ctx.strokeStyle = '#4a4d52'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(-0.8, -0.6); ctx.lineTo(1.8, 2); ctx.moveTo(1.6, -0.4); ctx.lineTo(0, 1.6); ctx.stroke();
  } else {
    ctx.save(); ctx.rotate(ag); ctx.fillStyle = '#26282c'; ctx.fillRect(0.4, -1.2, 2.6, 2.4); ctx.fillStyle = '#0d0e10'; ctx.fillRect(2.6, -0.8, 0.8, 1.6); ctx.restore();
    ctx.fillStyle = '#34373c'; ctx.beginPath(); ctx.arc(0, 0, 2.3, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.arc(-0.6, -0.7, 1, 0, 7); ctx.fill();
    ctx.fillStyle = c.off ? 'rgba(80,110,255,0.8)' : (Math.floor(t * 1.2) % 2 ? 'rgba(255,50,40,0.75)' : 'rgba(110,20,20,0.6)'); ctx.beginPath(); ctx.arc(0, 0, 0.55, 0, 7); ctx.fill();
  }
  ctx.restore();
}

export function drawGadget(ctx, e, t, ally) {
  ctx.save(); ctx.translate(e.x, e.y);
  const blink = Math.floor(t * 4) % 2 === 0;
  switch (e.ty) {
    case 'jammer':
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(-3, -2, 8, 6);
      ctx.fillStyle = '#2b2f36'; ctx.fillRect(-4, -3, 8, 6); ctx.fillStyle = '#55c1e8'; ctx.fillRect(-3, -2, 2, 1.2);
      cap(ctx, 2, -2, 5, -6, 0.6, '#999');
      if (ally) { ctx.strokeStyle = `rgba(85,193,232,${0.12 + Math.sin(t * 3) * 0.06})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 90, 0, 7); ctx.stroke(); }
      break;
    case 'mine':
      ctx.fillStyle = '#2b3325'; ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, 7); ctx.fill();
      ctx.fillStyle = blink ? '#ff3b3b' : '#5a1010'; ctx.beginPath(); ctx.arc(0, 0, 1, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,40,40,0.35)'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.arc(0, 0, 22, 0, 7); ctx.stroke();
      break;
    case 'claymore':
      ctx.rotate(e.ag || 0);
      ctx.fillStyle = '#4a5233'; ctx.beginPath(); ctx.moveTo(-2, -4); ctx.quadraticCurveTo(3, 0, -2, 4); ctx.lineTo(-3.5, 4); ctx.quadraticCurveTo(1, 0, -3.5, -4); ctx.fill();
      ctx.strokeStyle = 'rgba(255,40,40,0.5)'; ctx.lineWidth = 0.4;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(-0.7) * 44, Math.sin(-0.7) * 44); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(0.7) * 44, Math.sin(0.7) * 44); ctx.stroke();
      break;
    case 'wire': {
      ctx.rotate(e.ag || 0);
      ctx.strokeStyle = '#8b8f93'; ctx.lineWidth = 0.55;
      for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse(-16 + i * 4, 0, 4, 9, 0.3, 0, 7); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(200,205,210,0.5)'; ctx.lineWidth = 0.3;
      for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse(-16 + i * 4 + 1, 0, 3.5, 8, -0.3, 0, 7); ctx.stroke(); }
      break;
    }
    case 'cutter': case 'breach': {
      const cutter = e.ty === 'cutter';
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(-4, -3, 9, 7);
      ctx.fillStyle = cutter ? '#c9611f' : '#4c5a3a'; ctx.fillRect(-5, -4, 10, 8);
      ctx.fillStyle = '#222'; ctx.fillRect(-3.5, -2.5, 7, 5);
      ctx.fillStyle = e.j ? '#55c1e8' : (blink ? '#ff3030' : '#601010'); ctx.fillRect(-1, -1, 2, 2);
      if (cutter && !e.j && e.t < 5) {
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 14); g.addColorStop(0, 'rgba(255,190,90,0.6)'); g.addColorStop(1, 'rgba(255,120,30,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 14, 0, 7); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      break;
    }
    case 'dart':
      ctx.fillStyle = '#4fb3a9'; ctx.beginPath(); ctx.arc(0, 0, 2, 0, 7); ctx.fill();
      ctx.strokeStyle = `rgba(79,179,169,${0.25 + 0.2 * Math.sin(t * 6)})`; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(0, 0, 170, 0, 7); ctx.stroke();
      break;
    case 'nade': {
      const col = { frag: '#3d4a2c', smoke: '#7a7f86', stun: '#2c3e5a', impact: '#6a3a2a', nitro: '#5a5f2c', emp: '#a46ad6', sonar: '#5fd3e8', gas: '#7f9c2c', cam: '#d7d9db' }[e.kd] || '#555';
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.arc(1, 1.2, 2.6, 0, 7); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, e.kd === 'nitro' ? 3.2 : 2.5, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(-0.8, -0.8, 0.8, 0, 7); ctx.fill();
      if (e.kd === 'gas') { ctx.fillStyle = blink ? '#c8ff60' : '#3a4a10'; ctx.fillRect(-0.6, -0.6, 1.2, 1.2); }
      if (e.kd === 'nitro') { ctx.fillStyle = blink ? '#ff3030' : '#601010'; ctx.fillRect(-0.6, -0.6, 1.2, 1.2); }
      break;
    }
    case 'prox': // Proximity Charge: a flat green disc with a sensor eye
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.arc(0.8, 1, 4.4, 0, 7); ctx.fill();
      ctx.fillStyle = '#3d4a22'; ctx.beginPath(); ctx.arc(0, 0, 4.2, 0, 7); ctx.fill();
      ctx.fillStyle = '#26301a'; ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, 7); ctx.fill();
      ctx.fillStyle = blink ? '#ffd040' : '#5a4a10'; ctx.beginPath(); ctx.arc(0, 0, 0.9, 0, 7); ctx.fill();
      if (ally) { ctx.strokeStyle = 'rgba(255,200,60,0.25)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.arc(0, 0, 42, 0, 7); ctx.stroke(); }
      break;
    case 'concuss': // Daze Mine: a squat sticky puck with yellow bands
      ctx.fillStyle = '#4a3c22'; ctx.beginPath(); ctx.arc(0, 0, 3.2, 0, 7); ctx.fill();
      ctx.strokeStyle = '#d8b04a'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, 7); ctx.stroke();
      ctx.fillStyle = blink ? '#ffe070' : '#5a4a10'; ctx.beginPath(); ctx.arc(0, 0, 0.7, 0, 7); ctx.fill();
      break;
    case 'clamp': { // Clamp Trap: open steel jaws
      ctx.strokeStyle = '#7a7f84'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(0, 0, 5, 0, 7); ctx.stroke();
      ctx.fillStyle = '#9aa0a6'; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 5, Math.sin(a) * 5); ctx.lineTo(Math.cos(a + 0.2) * 3, Math.sin(a + 0.2) * 3); ctx.lineTo(Math.cos(a + 0.4) * 5, Math.sin(a + 0.4) * 5); ctx.fill(); }
      ctx.fillStyle = '#3a3d40'; ctx.fillRect(-1.2, -1.2, 2.4, 2.4);
      break;
    }
    case 'sensor': // Sound Sensor: a small microphone with sound rings for the defenders
      ctx.fillStyle = '#2b2f36'; ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, 7); ctx.fill();
      ctx.fillStyle = '#9b6be0'; ctx.beginPath(); ctx.arc(0, 0, 1.3, 0, 7); ctx.fill();
      if (ally) { const k = (t * 0.7) % 1; ctx.strokeStyle = `rgba(155,107,224,${0.35 * (1 - k)})`; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(0, 0, 190 * k, 0, 7); ctx.stroke(); }
      break;
    case 'grid': // Static Grid: a blue clamp with crackling arcs
      ctx.fillStyle = '#26324e'; ctx.fillRect(-3.5, -3.5, 7, 7);
      ctx.strokeStyle = '#4f86ff'; ctx.lineWidth = 0.6; ctx.strokeRect(-3.5, -3.5, 7, 7);
      ctx.strokeStyle = `rgba(140,190,255,${0.4 + 0.4 * Math.random()})`; ctx.beginPath(); ctx.moveTo(-3, 0); for (let i = 1; i <= 4; i++) ctx.lineTo(-3 + i * 1.5, (Math.random() - 0.5) * 4); ctx.stroke();
      break;
    case 'plates': // Armor Bag: a canvas bag with plates showing
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(-4, -2, 10, 7);
      ctx.fillStyle = '#4a4f38'; ctx.fillRect(-5, -3.5, 10, 7);
      for (let i = 0; i < (e.c || 0); i++) { ctx.fillStyle = '#8f9aa6'; ctx.fillRect(-4 + i * 1.8, -2.5, 1.4, 5); }
      break;
    case 'cluster': // Cluster Charge: a black box of four tubes
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(-4, -3, 9, 7);
      ctx.fillStyle = '#26282c'; ctx.fillRect(-5, -4, 10, 8);
      for (const [cx, cy] of [[-2.2, -1.8], [2.2, -1.8], [-2.2, 1.8], [2.2, 1.8]]) { ctx.fillStyle = '#55595f'; ctx.beginPath(); ctx.arc(cx, cy, 1.4, 0, 7); ctx.fill(); }
      ctx.fillStyle = blink ? '#ff3030' : '#601010'; ctx.fillRect(-0.6, -0.6, 1.2, 1.2);
      break;
    case 'scope': // Wall Scope: a lens poking out of the wall
      ctx.rotate(e.ag || 0);
      ctx.fillStyle = '#2b2f36'; ctx.fillRect(-4, -1.5, 5, 3);
      ctx.fillStyle = '#6fbf73'; ctx.beginPath(); ctx.arc(1.5, 0, 1.5, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(1.9, -0.5, 0.5, 0, 7); ctx.fill();
      break;
    case 'slug':
      ctx.fillStyle = '#ffcf6a'; ctx.beginPath(); ctx.arc(0, 0, 2, 0, 7); ctx.fill();
      break;
    case 'defuser':
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(-4, -2, 9, 6);
      ctx.fillStyle = '#c9a227'; ctx.fillRect(-5, -3, 10, 6); ctx.fillStyle = '#222'; ctx.fillRect(-3, -1.5, 6, 3);
      ctx.fillStyle = blink ? '#ffef6a' : '#7a6a20'; ctx.fillRect(-0.7, -0.7, 1.4, 1.4);
      break;
  }
  ctx.restore();
}

export function drawBomb(ctx, b, t, label) {
  ctx.save(); ctx.translate(b.x, b.y);
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.roundRect(-6, -4, 14, 11, 2); ctx.fill();
  ctx.fillStyle = '#5a4a1a'; ctx.beginPath(); ctx.roundRect(-7, -5, 14, 10, 2); ctx.fill();
  ctx.fillStyle = '#e6c440'; ctx.fillRect(-7, -5, 14, 2);
  for (const cx of [-4, 0, 4]) { ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.arc(cx, 1, 1.8, 0, 7); ctx.fill(); }
  ctx.fillStyle = Math.floor(t * 1.5) % 2 ? '#ff4040' : '#702020'; ctx.fillRect(5, -3, 1.2, 1.2);
  ctx.restore();
}

// A larger portrait for the operator-select screen.
export function portrait(canvas, opKey) {
  const ctx = canvas.getContext('2d'), o = OPERATORS[opKey];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const g = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 4, canvas.width / 2, canvas.height / 2, canvas.width * 0.7);
  g.addColorStop(0, shade(o.color, 0.55)); g.addColorStop(1, '#0d0f12');
  ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const s = canvas.width / 46;
  ctx.save(); ctx.scale(s, s);
  drawOperator(ctx, { x: 21, y: 24, aim: -0.55, op: opKey, w: o.primary, ally: true, walk: 0.6 }, 0);
  ctx.restore();
}
