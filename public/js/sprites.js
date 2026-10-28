// Top-down drawings of operators, drones, gadgets and the objective.
import { OPERATORS, WEAPONS } from '/shared/operators.js';
import { shade } from './textures.js';

const UNIFORM = { atk: { cloth: '#6c6a4f', vest: '#4b4a36', dark: '#34331f' }, def: { cloth: '#46546a', vest: '#2f3a4b', dark: '#1f2633' } };
const SKIN = ['#c99a78', '#a8785a', '#7a5238', '#e0b393', '#8d6346'];

function cap(ctx, x1, y1, x2, y2, w, col) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }

function drawGun(ctx, wkey, recoil, scale = 1) {
  const w = WEAPONS[wkey]; if (!w) return;
  const L = w.len, x0 = 4 - recoil;
  const body = '#1c1e21', furn = w.cls === 'Shotgun' ? '#5a3b22' : '#2a2d31';
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x0 + 1, 1.6, L, 2.8);
  ctx.fillStyle = furn; ctx.fillRect(x0 - 3, 0.2, 4, 2.6);                  // stock
  ctx.fillStyle = body; ctx.fillRect(x0, -0.1, L * 0.62, 3);                // receiver
  ctx.fillStyle = '#121315'; ctx.fillRect(x0 + L * 0.62, 0.5, L * 0.38, 1.8); // barrel
  if (w.cls === 'AR' || w.cls === 'SMG' || w.cls === 'MP') { ctx.fillStyle = '#26282b'; ctx.fillRect(x0 + L * 0.35, 2.8, 2.2, w.cls === 'MP' ? 2.5 : 3.2); }
  if (w.cls === 'LMG') { ctx.fillStyle = '#3b3d2e'; ctx.fillRect(x0 + L * 0.3, 2.6, 4.5, 4); }
  if (w.cls === 'DMR') { ctx.fillStyle = '#0d0e10'; ctx.fillRect(x0 + L * 0.2, -1.4, L * 0.38, 1.6); ctx.fillStyle = '#6aa7ff'; ctx.fillRect(x0 + L * 0.2 + L * 0.38 - 0.6, -1.2, 0.6, 1.2); }
  else if (w.cls !== 'Pistol') { ctx.fillStyle = '#0d0e10'; ctx.fillRect(x0 + L * 0.3, -0.9, 3.2, 1.2); ctx.fillStyle = '#ff4040'; ctx.fillRect(x0 + L * 0.3 + 1.2, -0.7, 0.8, 0.8); }
  if (w.cls === 'Shotgun') { ctx.fillStyle = furn; ctx.fillRect(x0 + L * 0.55, 0.1, 4, 2.8); }
}

// p: {x,y,aim,team,op,walk,ads,crouch,downed,recoil,reload,brace,scan,melee,ally,me}
export function drawOperator(ctx, p, t) {
  const o = OPERATORS[p.op]; if (!o) return;
  const u = UNIFORM[o.team];
  const skin = SKIN[(p.op.charCodeAt(0) + p.op.length) % SKIN.length];
  ctx.save(); ctx.translate(p.x, p.y);
  // ground ring: blue for your team, orange for the enemy
  ctx.strokeStyle = p.ally ? 'rgba(70,170,255,0.75)' : 'rgba(255,120,40,0.8)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, 12.5, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.ellipse(1.5, 2.5, 11, 9.5, 0, 0, 7); ctx.fill();
  ctx.rotate(p.aim);

  if (p.downed) {
    ctx.rotate(Math.PI * 0.9);
    cap(ctx, -6, -3, -15, -4 + Math.sin(t * 3) * 1, 3.4, u.dark); cap(ctx, -6, 3, -15, 4, 3.4, u.dark);
    ctx.fillStyle = u.cloth; ctx.beginPath(); ctx.ellipse(-1, 0, 8, 7.5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = u.vest; ctx.beginPath(); ctx.ellipse(-0.5, 0, 6, 5.5, 0, 0, 7); ctx.fill();
    cap(ctx, 2, -6, 9, -9, 3, u.cloth); cap(ctx, 2, 6, 10, 7, 3, u.cloth);
    ctx.fillStyle = o.helmet; ctx.beginPath(); ctx.arc(8, 0, 4.8, 0, 7); ctx.fill();
    ctx.restore(); return;
  }

  const walk = p.walk || 0, stride = Math.sin(walk) * (p.crouch ? 2.5 : 5);
  // boots
  ctx.fillStyle = '#1b1b1b';
  if (p.crouch) { ctx.beginPath(); ctx.ellipse(4, 5, 3.6, 2.3, 0, 0, 7); ctx.ellipse(-4, -4, 3.6, 2.3, 0, 0, 7); ctx.fill(); }
  else { ctx.beginPath(); ctx.ellipse(stride, 4.6, 3.8, 2.4, 0, 0, 7); ctx.ellipse(-stride, -4.6, 3.8, 2.4, 0, 0, 7); ctx.fill(); }
  // backpack (attackers) / radio (defenders)
  if (o.team === 'atk') { ctx.fillStyle = u.dark; ctx.beginPath(); ctx.roundRect(-11, -5.5, 5, 11, 1.5); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(-10.5, -5, 1, 10); }
  else { ctx.fillStyle = '#222'; ctx.fillRect(-9.5, 3, 3.5, 4); cap(ctx, -8, 4, -11, 8.5, 0.8, '#111'); }
  // torso
  const sh = p.crouch ? 0.92 : 1;
  ctx.fillStyle = u.cloth; ctx.beginPath(); ctx.ellipse(-1, 0, 6.8 * sh, 9.2 * sh, 0, 0, 7); ctx.fill();
  ctx.fillStyle = u.vest; ctx.beginPath(); ctx.roundRect(-6, -6.5, 10, 13, 3); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(-5.5, -6, 1, 12);
  ctx.fillStyle = u.dark; for (let i = -1; i <= 1; i++) ctx.fillRect(2.4, i * 3.8 - 1.4, 2.4, 2.8);  // mag pouches
  ctx.fillStyle = o.color; ctx.fillRect(-4.8, -8.2, 3.5, 2); ctx.fillRect(-4.8, 6.2, 3.5, 2);           // shoulder patches
  // weapon + arms
  const shield = o.ability.id === 'brace';
  const pistol = WEAPONS[p.w] && (WEAPONS[p.w].cls === 'Pistol' || WEAPONS[p.w].cls === 'MP');
  const rec = p.recoil || 0, mel = p.melee || 0;
  const reach = p.ads ? 2 : 0;
  ctx.save();
  if (mel > 0) ctx.rotate(-Math.sin(mel * Math.PI) * 0.9);
  if (p.reload) ctx.rotate(0.35 + Math.sin(t * 9) * 0.05);
  ctx.translate(reach, p.ads ? 0 : 1.5);
  if (shield) {
    cap(ctx, 0, 7, 9 - rec, 2.6, 3.2, u.cloth); ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(9 - rec, 2.6, 1.7, 0, 7); ctx.fill();
    drawGun(ctx, p.w, rec);
    cap(ctx, 0, -7, 9, -7, 3.2, u.cloth);
  } else if (pistol) {
    cap(ctx, 0, 6.5, 7 - rec, 1.4, 3.2, u.cloth); cap(ctx, 0, -6.5, 7 - rec, 1.2, 3.2, u.cloth);
    drawGun(ctx, p.w, rec);
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(7 - rec, 1.4, 1.8, 0, 7); ctx.fill();
  } else {
    const L = WEAPONS[p.w] ? WEAPONS[p.w].len : 12;
    cap(ctx, 0, 6.8, 5 - rec, 2.6, 3.3, u.cloth);
    drawGun(ctx, p.w, rec);
    cap(ctx, 0, -6.5, 4 + L * 0.5 - rec, 0.8, 3.3, u.cloth);
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(5 - rec, 2.6, 1.8, 0, 7); ctx.arc(4 + L * 0.5 - rec, 0.8, 1.8, 0, 7); ctx.fill();
  }
  // muzzle flash
  if (p.flash && WEAPONS[p.w]) {
    const mx = 4 + WEAPONS[p.w].len - rec + 2;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(mx, 1.5, 0, mx, 1.5, 9); g.addColorStop(0, 'rgba(255,240,180,0.95)'); g.addColorStop(0.4, 'rgba(255,170,60,0.6)'); g.addColorStop(1, 'rgba(255,120,20,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx, 1.5, 9, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff6d0'; ctx.beginPath(); ctx.moveTo(mx - 1, 0); ctx.lineTo(mx + 7 + Math.random() * 3, 1.5); ctx.lineTo(mx - 1, 3); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
  if (shield) {
    const arc = p.brace ? 1.4 : 0.9;
    ctx.strokeStyle = '#17191c'; ctx.lineWidth = 4.2; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.arc(-2, 0, 14, -arc, arc); ctx.stroke();
    ctx.strokeStyle = '#4b525a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(-2, 0, 15.6, -arc, arc); ctx.stroke();
    ctx.fillStyle = '#86c3e6'; ctx.save(); ctx.rotate(-0.15); ctx.fillRect(11.5, -1.8, 1.6, 3.6); ctx.restore();
    ctx.fillStyle = '#d84a4a'; ctx.save(); ctx.rotate(0.45); ctx.fillRect(11.2, -1, 2.2, 2); ctx.restore();
  }
  // head
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0.8, 0, 4.4, 0, 7); ctx.fill();
  switch (o.look) {
    case 'cap':
      ctx.fillStyle = o.helmet; ctx.beginPath(); ctx.arc(0.2, 0, 4.6, 0, 7); ctx.fill();
      ctx.fillStyle = shade(o.helmet, 0.7); ctx.beginPath(); ctx.ellipse(4.6, 0, 2.6, 3.8, 0, -Math.PI / 2, Math.PI / 2); ctx.fill();
      ctx.fillStyle = '#111'; ctx.fillRect(-1.5, -5.2, 1.2, 10.4);
      break;
    case 'mask':
      ctx.fillStyle = '#18191b'; ctx.beginPath(); ctx.arc(0.6, 0, 4.7, 0, 7); ctx.fill();
      ctx.fillStyle = o.color; ctx.fillRect(3.2, -3, 1.6, 6);
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.arc(-0.5, -1.5, 2, 0, 7); ctx.fill();
      break;
    case 'goggles':
      ctx.fillStyle = o.helmet; ctx.beginPath(); ctx.arc(0.2, 0, 5.2, 0, 7); ctx.fill();
      ctx.fillStyle = '#111'; ctx.fillRect(3.2, -3.6, 2.2, 7.2);
      ctx.fillStyle = o.color; ctx.fillRect(4.4, -3, 1, 2.2); ctx.fillRect(4.4, 0.8, 1, 2.2);
      break;
    case 'visor':
      ctx.fillStyle = o.helmet; ctx.beginPath(); ctx.arc(0, 0, 5.6, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(120,180,220,0.85)'; ctx.beginPath(); ctx.arc(0, 0, 5.6, -0.9, 0.9); ctx.lineTo(0, 0); ctx.fill();
      break;
    case 'hood':
      ctx.fillStyle = shade(o.helmet, 1.2); ctx.beginPath(); ctx.arc(-0.4, 0, 5.6, 0, 7); ctx.fill();
      ctx.fillStyle = '#0d0e10'; ctx.beginPath(); ctx.arc(2.6, 0, 3, -1.3, 1.3); ctx.fill();
      ctx.fillStyle = o.color; ctx.fillRect(4.2, -1.4, 1, 2.8);
      break;
    default: // helmet
      ctx.fillStyle = o.helmet; ctx.beginPath(); ctx.arc(0, 0, 5.4, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.arc(-1, -1.5, 2.6, 0, 7); ctx.fill();
      ctx.fillStyle = o.color; ctx.fillRect(-4.6, -0.7, 4, 1.4);
      ctx.fillStyle = '#111'; ctx.fillRect(3.6, -2.6, 1.6, 5.2);
  }
  if (p.scan) { ctx.fillStyle = 'rgba(120,140,255,0.9)'; ctx.fillRect(5, -2.5, 1.5, 5); }
  ctx.restore();
}

export function drawCorpse(ctx, c) {
  drawOperator(ctx, { ...c, downed: true }, 0);
}

export function drawDrone(ctx, d, t, ally) {
  ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.ag || 0);
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(1, 1.5, 6.5, 5.5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#121314';
  for (const [wx, wy] of [[-3.5, -4.5], [3, -4.5], [-3.5, 4.5], [3, 4.5]]) { ctx.beginPath(); ctx.ellipse(wx, wy, 2.4, 1.6, 0, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#3b4046'; ctx.beginPath(); ctx.roundRect(-4.5, -3.2, 9, 6.4, 1.6); ctx.fill();
  ctx.fillStyle = '#5b636b'; ctx.fillRect(-3.5, -2.2, 5, 4.4);
  ctx.fillStyle = ally ? '#4ab0ff' : '#ff6a2a'; ctx.beginPath(); ctx.arc(4.2, 0, 1.4, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(4.4, -0.4, 0.5, 0, 7); ctx.fill();
  cap(ctx, -3, 0, -7, -2, 0.5, '#888');
  if (d.j) { ctx.strokeStyle = `rgba(150,200,255,${0.4 + Math.random() * 0.5})`; ctx.lineWidth = 0.6; ctx.beginPath(); for (let i = 0; i < 4; i++) { ctx.moveTo((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12); ctx.lineTo((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12); } ctx.stroke(); }
  ctx.restore();
}

export function drawCam(ctx, c, t) {
  ctx.save(); ctx.translate(c.x, c.y);
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.arc(1, 1.5, 5, 0, 7); ctx.fill();
  if (!c.hp) {
    ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, 7); ctx.fill();
    ctx.strokeStyle = '#555'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(-3, -2); ctx.lineTo(2, 3); ctx.moveTo(2, -3); ctx.lineTo(-1, 2); ctx.stroke();
  } else {
    ctx.fillStyle = '#d7d9db'; ctx.beginPath(); ctx.arc(0, 0, 4.4, 0, 7); ctx.fill();
    ctx.fillStyle = '#1b1d20'; ctx.beginPath(); ctx.arc(0, 0, 2.8, 0, 7); ctx.fill();
    ctx.fillStyle = c.off ? '#4060ff' : (Math.floor(t * 2) % 2 ? '#ff3030' : '#601010'); ctx.beginPath(); ctx.arc(2.6, -2.6, 0.9, 0, 7); ctx.fill();
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
      const col = { frag: '#3d4a2c', smoke: '#7a7f86', stun: '#2c3e5a', impact: '#6a3a2a', nitro: '#5a5f2c', emp: '#a46ad6' }[e.kd] || '#555';
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.arc(1, 1.2, 2.6, 0, 7); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, e.kd === 'nitro' ? 3.2 : 2.5, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(-0.8, -0.8, 0.8, 0, 7); ctx.fill();
      if (e.kd === 'nitro') { ctx.fillStyle = blink ? '#ff3030' : '#601010'; ctx.fillRect(-0.6, -0.6, 1.2, 1.2); }
      break;
    }
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
