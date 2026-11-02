// Little webcam boxes for ESPORTS TV and AMATEUR HOUR (he asked): a drawn head-and-shoulders "stream" of each player.
// Pros look sharp (neat hair, headset, team jersey, steady); everyday bots look like they're playing in their bedroom
// (messy hair, crooked glasses, snacks, a lamp). Each look is fixed by the player's name, so a pro always looks the same.
const SKIN = ['#f2d0b1', '#e3b48d', '#c98f63', '#a86c45', '#7b4a2c', '#5a3622'];
const HAIR = ['#1b1512', '#3a2618', '#6a4a2a', '#b88a4a', '#d8c08a', '#2a2a2a', '#7a2a1a', '#cfcac2'];
const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const pick = (a, h, n) => a[(h >>> n) % a.length];

// draw one frame. c: a canvas; who: { name, pro (bool), team colour, talking (bool), dead, down }; t: seconds
export function drawWebcam(c, who, t) {
  const g = c.getContext('2d'), W = c.width, H = c.height, h = hash(who.name), pro = !!who.pro;
  const skin = pick(SKIN, h, 1), hair = pick(HAIR, h, 5), style = (h >>> 9) % 4, glasses = !pro && (h >>> 12) % 3 === 0, beard = (h >>> 14) % 4 === 0;
  // background: pros a dark studio with team-coloured light, others a bedroom wall with a lamp and a poster
  if (pro) { const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#0e1118'); bg.addColorStop(1, who.colour || '#223'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 5; i++) g.fillRect(W * 0.1 + i * W * 0.18, 0, 2, H); }
  else { g.fillStyle = ['#c9b79a', '#9fb3c2', '#b9a3c4', '#a7c29a'][(h >>> 3) % 4]; g.fillRect(0, 0, W, H);
    g.fillStyle = ['#d8504a', '#3a7bd5', '#e8b43a'][(h >>> 6) % 3]; g.fillRect(W * 0.68, H * 0.1, W * 0.22, H * 0.3); // a poster
    g.fillStyle = 'rgba(255,240,180,0.5)'; g.beginPath(); g.arc(W * 0.12, H * 0.2, W * 0.08, 0, 7); g.fill(); } // a lamp
  const bob = pro ? Math.sin(t * 1.3 + h) * 0.6 : Math.sin(t * 2.4 + h) * 1.6 + (who.talking ? Math.sin(t * 9) * 0.8 : 0);
  const cx = W / 2 + (pro ? 0 : Math.sin(t * 0.7 + h) * 2), cy = H * 0.52 + bob, r = H * 0.22;
  // shoulders / shirt
  g.fillStyle = pro ? (who.colour || '#335') : ['#5a6b4a', '#7a3b3b', '#3b4f7a', '#6b6b6b'][(h >>> 2) % 4];
  g.beginPath(); g.ellipse(cx, H + H * 0.05, W * 0.38, H * 0.36, 0, Math.PI, 0); g.fill();
  if (pro) { g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(cx - W * 0.05, H * 0.86, W * 0.1, 2); } // jersey stripe
  // neck and head
  g.fillStyle = skin; g.fillRect(cx - r * 0.35, cy + r * 0.6, r * 0.7, r * 0.7);
  g.beginPath(); g.ellipse(cx, cy, r * (pro ? 0.86 : 0.92), r, 0, 0, 7); g.fill();
  if (pro) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.beginPath(); g.ellipse(cx, cy + r * 0.55, r * 0.7, r * 0.35, 0, 0, Math.PI); g.fill(); } // a strong jaw shadow
  // hair
  g.fillStyle = hair; g.beginPath();
  if (pro) { g.ellipse(cx, cy - r * 0.62, r * 0.9, r * 0.45, 0, Math.PI, 0); if (style % 2) g.rect(cx - r * 0.9, cy - r * 0.65, r * 0.25, r * 0.5); }
  else { for (let i = 0; i < 7; i++) { const a = Math.PI + i / 6 * Math.PI; g.moveTo(cx, cy - r * 0.3); g.lineTo(cx + Math.cos(a) * r * (1.05 + ((h >>> i) % 3) * 0.12), cy - r * 0.35 + Math.sin(a) * r * 0.95); } g.ellipse(cx, cy - r * 0.6, r * 0.95, r * 0.5, 0, Math.PI, 0); }
  g.fill(); if (!pro) { g.strokeStyle = hair; g.lineWidth = 2; g.stroke(); }
  if (beard) { g.fillStyle = hair; g.globalAlpha = 0.7; g.beginPath(); g.ellipse(cx, cy + r * 0.55, r * 0.6, r * 0.4, 0, 0, Math.PI); g.fill(); g.globalAlpha = 1; }
  // eyes (blink now and then), brows
  const blink = ((t * 0.3 + (h % 97) / 97) % 1) < 0.03, ey = cy - r * 0.08;
  g.fillStyle = '#111';
  for (const s of [-1, 1]) { if (blink) g.fillRect(cx + s * r * 0.32 - r * 0.1, ey, r * 0.2, 1.2); else { g.beginPath(); g.arc(cx + s * r * 0.32, ey, r * 0.07, 0, 7); g.fill(); }
    g.fillRect(cx + s * r * 0.32 - r * 0.12, ey - r * (pro ? 0.2 : 0.24) + (pro ? s * 0 : s * 1.2), r * 0.24, pro ? 2 : 1.4); }
  if (glasses) { g.strokeStyle = '#222'; g.lineWidth = 1.2; g.save(); g.translate(cx, ey); g.rotate(0.08); for (const s of [-1, 1]) g.strokeRect(s * r * 0.32 - r * 0.16, -r * 0.12, r * 0.32, r * 0.24); g.restore(); }
  if (pro && style === 2) { g.fillStyle = '#111'; g.fillRect(cx - r * 0.55, ey - r * 0.1, r * 1.1, r * 0.2); } // shades on
  // mouth: talking opens and closes; a pro half-smiles, the others gape
  const open = who.talking ? Math.abs(Math.sin(t * 13)) * r * 0.16 : 0;
  g.fillStyle = '#4a1c1c'; g.beginPath(); g.ellipse(cx, cy + r * 0.42, r * (pro ? 0.2 : 0.16), Math.max(1, open + (pro ? 1 : r * 0.04)), 0, 0, 7); g.fill();
  // headset
  g.strokeStyle = pro ? '#111' : '#555'; g.lineWidth = pro ? 3 : 2; g.beginPath(); g.arc(cx, cy - r * 0.1, r * 1.02, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
  g.fillStyle = pro ? (who.colour || '#222') : '#666'; for (const s of [-1, 1]) { g.fillRect(cx + s * r * 0.95 - 3, cy - r * 0.2, 6, r * 0.45); }
  if (pro) { g.strokeStyle = '#111'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx - r * 0.95, cy + r * 0.2); g.quadraticCurveTo(cx - r * 0.6, cy + r * 0.6, cx - r * 0.2, cy + r * 0.45); g.stroke(); }
  if (!pro && (h >>> 8) % 3 === 0) { g.fillStyle = '#e8a33a'; g.fillRect(W * 0.78, H * 0.78, W * 0.14, H * 0.2); g.fillStyle = '#c33'; g.fillRect(W * 0.78, H * 0.78, W * 0.14, 3); } // a bag of crisps
  // dead / downed: the stream dims
  if (who.dead) { g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, 0, W, H); }
  else if (who.down) { g.fillStyle = 'rgba(160,0,0,0.25)'; g.fillRect(0, 0, W, H); }
  if (who.talking) { g.strokeStyle = '#6fdc7a'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, W - 3, H - 3); } // speaking light
  g.fillStyle = 'rgba(255,40,40,0.9)'; g.beginPath(); g.arc(8, 8, 3, 0, 7); g.fill(); // REC dot
}
