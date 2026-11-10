// Every operator's own headgear, seen from above, facing +x (he asked: no two share a helmet type, and nobody is a
// reskin of somebody else). Each also gets a back item (PACK) and a vest cut (VEST); with the headgear that makes every
// operator's silhouette different. h = drawing helpers from sprites.js: { ell, box, cap, shade, OUT, o (the operator), t, hair }.
const ear = (h, ctx, col = '#151618') => { h.ell(ctx, 0, -4.7, 1.8, 1.3, col); h.ell(ctx, 0, 4.7, 1.8, 1.3, col); };
const hairCap = (h, ctx, col = h.hair, r = 4.5) => h.ell(ctx, -0.3, 0, r, r * 0.97, col);
const strap = (h, ctx, col = '#111') => h.cap(ctx, -0.5, -4.6, -0.5, 4.6, 0.7, col);
const lens = (ctx, x, y, w, hgt, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, hgt); };

export const HEADGEAR = {
  // ---------------- attack ----------------
  ember(ctx, h) { // glassblower's flip-up heat shield: dark hood, tinted plate tipped up over the brow
    h.ell(ctx, -0.6, 0, 5.4, 5.3, h.shade(h.o.helmet, 0.9));
    h.box(ctx, 1.4, -3.6, 2.6, 7.2, 0.8, '#2a2620'); lens(ctx, 1.9, -2.8, 1.6, 5.6, 'rgba(255,140,40,0.55)');
    h.cap(ctx, 0.4, -4.4, 1.4, -3.4, 0.6, '#555'); h.cap(ctx, 0.4, 4.4, 1.4, 3.4, 0.6, '#555');
  },
  kestrel(ctx, h) { // arctic fur hat with ear flaps and goggles on the brow
    h.ell(ctx, -0.2, -4.6, 2.4, 1.8, '#cfc6b4'); h.ell(ctx, -0.2, 4.6, 2.4, 1.8, '#cfc6b4');
    h.ell(ctx, -0.4, 0, 5, 5, h.o.helmet); h.ell(ctx, -3.6, 0, 1.8, 4, '#d8cfbd', false);
    h.box(ctx, 2.4, -3.4, 1.6, 6.8, 0.8, '#1b1d20'); lens(ctx, 3.3, -2.8, 0.7, 2.2, 'rgba(120,200,220,0.8)'); lens(ctx, 3.3, 0.6, 0.7, 2.2, 'rgba(120,200,220,0.8)');
  },
  hammer(ctx, h) { // quarry hard hat: full round brim and a centre ridge
    h.ell(ctx, 0, 0, 6.6, 6.4, h.shade('#d8a428', 0.85)); h.ell(ctx, 0, 0, 4.8, 4.7, '#e3b23a');
    h.cap(ctx, -4.2, 0, 4.2, 0, 1.1, h.shade('#e3b23a', 1.2)); h.box(ctx, -1.2, -1, 2.4, 2, 0.4, h.o.color, false);
  },
  talon(ctx, h) { // hacker's bump cap with a whip antenna and a single flip-down eyepiece
    ear(h, ctx); h.ell(ctx, 0, 0, 4.9, 4.9, h.o.helmet);
    h.cap(ctx, -2.5, -3, -8.5, -6, 0.5, '#888'); h.ell(ctx, -8.6, -6, 0.6, 0.6, h.o.color, false);
    h.box(ctx, 3.4, 0.8, 2, 2.4, 0.5, '#151515'); lens(ctx, 4.8, 1.2, 0.7, 1.6, h.o.color);
  },
  bulwark(ctx, h) { // riot helmet with a full face visor
    h.ell(ctx, 0, 0, 5.7, 5.7, h.o.helmet);
    ctx.beginPath(); ctx.arc(0, 0, 5.7, -0.95, 0.95); ctx.lineTo(0, 0); ctx.closePath();
    const vg = ctx.createLinearGradient(0, -5, 5, 5); vg.addColorStop(0, 'rgba(160,210,240,0.95)'); vg.addColorStop(1, 'rgba(60,110,150,0.95)');
    ctx.fillStyle = vg; ctx.fill(); ctx.strokeStyle = h.OUT; ctx.lineWidth = 0.5; ctx.stroke();
  },
  rivet(ctx, h) { // diver's oval mask with a thick strap and hood
    h.ell(ctx, -0.5, 0, 5.1, 5, '#1d2328'); h.cap(ctx, -3, -4.4, -3, 4.4, 1.2, '#0e1114');
    h.ell(ctx, 3.3, 0, 2, 3.6, '#2c3238'); h.ell(ctx, 3.6, 0, 1.3, 2.8, 'rgba(110,170,200,0.85)', false);
  },
  haze(ctx, h) { // smoke-jumper respirator: two round filters at the jaw
    hairCap(h, ctx); h.box(ctx, 2.2, -2.6, 2.6, 5.2, 1.2, '#2a2d30');
    h.ell(ctx, 4.4, -2.9, 1.5, 1.5, '#7b858e'); h.ell(ctx, 4.4, 2.9, 1.5, 1.5, '#7b858e'); strap(h, ctx);
  },
  glint(ctx, h) { // sonar dome: a smooth round shell with a ring of sensors
    h.ell(ctx, 0, 0, 5.4, 5.4, h.o.helmet); ctx.strokeStyle = h.o.color; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(0, 0, 3.6, 0, 7); ctx.stroke();
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; h.ell(ctx, Math.cos(a) * 3.6, Math.sin(a) * 3.6, 0.5, 0.5, '#dfe', false); }
  },
  brisk(ctx, h) { // sweatband and a swinging ponytail
    hairCap(h, ctx); const sw = Math.sin(h.t * 6) * 0.8;
    h.cap(ctx, -4.2, sw * 0.3, -8, sw, 1.8, h.hair); h.cap(ctx, -1.2, -4.2, -1.2, 4.2, 1.3, h.o.color);
  },
  onyx(ctx, h) { // bulky bomb-suit helmet with a big flat visor
    h.ell(ctx, -0.6, 0, 6.6, 6.2, '#2b2e33'); h.box(ctx, 2, -4.4, 3.6, 8.8, 1.4, '#1a1c20');
    lens(ctx, 3.2, -3.6, 2, 7.2, 'rgba(90,130,150,0.75)'); h.box(ctx, -5.4, -1.6, 2, 3.2, 0.4, '#444');
  },
  prism(ctx, h) { // bare head, a thin holo band across the eyes that shimmers
    hairCap(h, ctx); const k = 0.5 + 0.5 * Math.sin(h.t * 3);
    ctx.strokeStyle = `hsla(${(h.t * 80) % 360},90%,70%,${0.6 + 0.3 * k})`; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(0, 0, 4.3, -1.1, 1.1); ctx.stroke();
  },
  volt(ctx, h) { // lineman's helmet with a headlamp
    ear(h, ctx, '#3a3a20'); h.ell(ctx, 0, 0, 5.3, 5.3, h.o.helmet); h.cap(ctx, -4, 0, 4, 0, 0.8, h.shade(h.o.helmet, 1.3));
    h.box(ctx, 3.8, -1.3, 1.8, 2.6, 0.6, '#222'); lens(ctx, 5.4, -0.9, 0.5, 1.8, '#fff6b0');
  },
  tether(ctx, h) { // soft boonie hat with a floppy brim
    h.ell(ctx, 0, 0, 6.8, 6.5, h.shade(h.o.helmet, 0.9)); h.ell(ctx, 0, 0, 4.4, 4.4, h.o.helmet);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.arc(0, 0, 4.4, 0, 7); ctx.stroke();
  },
  strider(ctx, h) { // shaved sides, a topknot, a clip-on earpiece
    hairCap(h, ctx, h.shade(h.hair, 0.8), 4.3); h.ell(ctx, -1.2, 0, 2.2, 2.2, h.hair); h.ell(ctx, -1.6, 0, 1.2, 1.2, h.shade(h.hair, 1.3));
    h.ell(ctx, 0.5, 4.5, 0.9, 0.7, h.o.color);
  },
  ferro(ctx, h) { // ribbed knit beanie with a bobble
    h.ell(ctx, -0.2, 0, 4.9, 4.9, h.o.helmet);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.45; for (let a = -1; a <= 1; a += 0.5) { ctx.beginPath(); ctx.moveTo(-4.5, a * 4); ctx.lineTo(3.6, a * 3.4); ctx.stroke(); }
    h.ell(ctx, -1, 0, 1.6, 1.6, h.o.color);
  },
  salvo(ctx, h) { // big ear defenders over bare hair, headband across the top
    hairCap(h, ctx); h.cap(ctx, -0.6, -4.6, -0.6, 4.6, 1.2, '#c44'); h.ell(ctx, -0.4, -5, 2.2, 1.7, '#d23c2c'); h.ell(ctx, -0.4, 5, 2.2, 1.7, '#d23c2c');
  },
  torque(ctx, h) { // full-face motorbike helmet with a racing stripe and a dark visor slit
    h.ell(ctx, -0.3, 0, 6, 5.8, h.o.helmet); h.cap(ctx, -5.6, 0, 5, 0, 1.4, h.o.color);
    ctx.beginPath(); ctx.arc(0, 0, 5.7, -0.7, 0.7); ctx.lineWidth = 1.8; ctx.strokeStyle = '#111'; ctx.stroke();
  },
  rush(ctx, h) { // padded rugby scrum cap in segments
    h.ell(ctx, 0, 0, 5.3, 5.3, h.o.helmet); ctx.strokeStyle = h.shade(h.o.helmet, 0.6); ctx.lineWidth = 0.6;
    for (const a of [0, 1.05, 2.1]) { ctx.beginPath(); ctx.moveTo(Math.cos(a) * 5, Math.sin(a) * 5); ctx.lineTo(-Math.cos(a) * 5, -Math.sin(a) * 5); ctx.stroke(); }
    h.ell(ctx, 0, -5, 1.6, 1.2, h.shade(h.o.helmet, 0.8)); h.ell(ctx, 0, 5, 1.6, 1.2, h.shade(h.o.helmet, 0.8));
  },
  blaze(ctx, h) { // orange mohawk and wraparound shades
    hairCap(h, ctx, h.shade(h.hair, 0.7), 4.3); h.cap(ctx, -4.6, 0, 3.4, 0, 2.2, h.o.color);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(0.6, 0, 3.9, -1.2, 1.2); ctx.stroke();
  },
  echo(ctx, h) { // shemagh wrapped round the head, tail hanging behind
    h.ell(ctx, -0.2, 0, 5.1, 5.1, '#c9b48d'); ctx.strokeStyle = '#8a5a3a'; ctx.lineWidth = 0.4;
    for (let i = -3; i <= 3; i += 1.5) { ctx.beginPath(); ctx.moveTo(-4, i); ctx.lineTo(3.5, i); ctx.stroke(); }
    h.cap(ctx, -4.5, 1.5, -8, 3.2 + Math.sin(h.t * 2) * 0.6, 2, '#c9b48d');
  },
  mark(ctx, h) { // shooting cap with yellow ballistic glasses
    ear(h, ctx); h.ell(ctx, 0, 0, 4.6, 4.6, h.o.helmet);
    ctx.beginPath(); ctx.ellipse(4.4, 0, 2.8, 3.9, 0, -Math.PI / 2, Math.PI / 2); ctx.fillStyle = h.shade(h.o.helmet, 0.7); ctx.fill(); ctx.strokeStyle = h.OUT; ctx.lineWidth = 0.5; ctx.stroke();
    lens(ctx, 3, -3.4, 1, 6.8, 'rgba(250,210,60,0.85)');
  },
  patch(ctx, h) { // medic's helmet with a white roundel and red cross
    ear(h, ctx); h.ell(ctx, 0, 0, 5.4, 5.4, h.o.helmet); h.ell(ctx, -1, 0, 2.2, 2.2, '#f2f2f2', false);
    lens(ctx, -1.5, -1.6, 1, 3.2, '#c22'); lens(ctx, -2.6, -0.5, 3.2, 1, '#c22');
  },
  trench(ctx, h) { // old flat-brimmed steel helmet
    h.ell(ctx, 0, 0, 7, 6.8, h.shade(h.o.helmet, 0.8)); h.ell(ctx, 0, 0, 4.6, 4.5, h.o.helmet); h.ell(ctx, 0, 0, 1, 1, '#333', false);
  },
  wren(ctx, h) { // beret pulled to one side
    hairCap(h, ctx); h.ell(ctx, -0.8, 1.2, 4.6, 4.2, h.o.helmet); h.ell(ctx, -1.2, 2, 0.8, 0.8, h.o.color, false);
  },
  vapor(ctx, h) { // full gas mask with one front canister
    h.ell(ctx, 0.6, 0, 4.7, 4.7, h.shade(h.o.helmet, 0.75));
    h.box(ctx, 2.6, -3.2, 2.4, 6.4, 1, '#0a0a0b'); lens(ctx, 4, -2.6, 0.9, 2, h.o.color); lens(ctx, 4, 0.6, 0.9, 2, h.o.color);
    h.ell(ctx, 5.6, 0, 1.5, 1.5, '#5b6168');
  },
  crow(ctx, h) { // black hood with a long beak-like mask
    h.ell(ctx, -1.2, 0, 6, 5.9, '#16171b');
    ctx.beginPath(); ctx.moveTo(2, -2.6); ctx.lineTo(9, 0); ctx.lineTo(2, 2.6); ctx.closePath(); ctx.fillStyle = '#26282e'; ctx.fill(); ctx.strokeStyle = h.OUT; ctx.lineWidth = 0.5; ctx.stroke();
    lens(ctx, 2.2, -2.2, 0.9, 1.2, '#b23'); lens(ctx, 2.2, 1, 0.9, 1.2, '#b23');
  },
  // ---------------- defence ----------------
  mason(ctx, h) { // ballistic helmet with side rails and an NVG mount
    ear(h, ctx); h.ell(ctx, 0, 0, 5.4, 5.4, h.o.helmet);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-1.5, -5.4, 1.2, 10.8); h.box(ctx, 3.4, -1.4, 1.8, 2.8, 0.4, '#141516');
    lens(ctx, -4.5, -0.6, 3.2, 1.2, h.o.color);
  },
  veil(ctx, h) { // headscarf with a slim radio headset over it
    h.ell(ctx, -0.6, 0, 5.3, 5.1, h.o.helmet); h.cap(ctx, -4.6, 0, -7, 1, 2.4, h.o.helmet);
    h.cap(ctx, -0.4, -4.8, -0.4, 4.8, 0.6, '#222'); h.cap(ctx, 0, 4.8, 3.6, 3.2, 0.5, '#222'); h.ell(ctx, 3.8, 3, 0.6, 0.6, h.o.color, false);
  },
  lynx(ctx, h) { // tied bandana, knot tails behind
    hairCap(h, ctx); h.ell(ctx, -0.3, 0, 4.7, 4.6, h.o.helmet);
    const s = Math.sin(h.t * 3) * 0.5; h.cap(ctx, -4.4, 0, -7, -1.4 + s, 1, h.o.helmet); h.cap(ctx, -4.4, 0, -7, 1.4 + s, 1, h.o.helmet);
  },
  solace(ctx, h) { // surgical scrub cap with a tie at the back
    h.ell(ctx, -0.3, 0, 4.8, 4.8, '#7fb8d8'); ctx.fillStyle = 'rgba(255,255,255,0.25)'; for (let i = -2; i <= 2; i += 2) ctx.fillRect(-3 + i, -0.4 + i, 0.8, 0.8);
    h.cap(ctx, -4.6, 0, -6.4, -1, 0.6, '#7fb8d8'); h.cap(ctx, -4.6, 0, -6.4, 1, 0.6, '#7fb8d8');
  },
  wraith(ctx, h) { // deep cowl, one glowing visor slit
    h.ell(ctx, -1.4, 0, 6.4, 6, h.shade(h.o.helmet, 1.1)); h.ell(ctx, 1, 0, 4.2, 4, '#07080a');
    const k = 0.6 + 0.4 * Math.sin(h.t * 4); lens(ctx, 3.6, -2.4, 0.8, 4.8, `rgba(120,220,255,${k})`);
  },
  bramble(ctx, h) { // braided crown of hair, no hat
    hairCap(h, ctx); ctx.strokeStyle = h.shade(h.hair, 1.35); ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.arc(-0.3, 0, 3.6, 0, 7); ctx.stroke();
    for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; h.ell(ctx, -0.3 + Math.cos(a) * 3.6, Math.sin(a) * 3.6, 0.5, 0.5, h.shade(h.hair, 0.8), false); }
  },
  kite(ctx, h) { // FPV racing goggles: a big box on the face, strap round the hair
    hairCap(h, ctx); strap(h, ctx, '#333'); h.box(ctx, 2.4, -3.6, 3, 7.2, 1, '#22252a');
    lens(ctx, 5, -3, 0.6, 6, h.o.color); h.cap(ctx, 3, -3.6, 1, -5.6, 0.4, '#999');
  },
  gravel(ctx, h) { // peaked police cap with a badge
    h.ell(ctx, -0.2, 0, 5.1, 5.1, h.o.helmet);
    ctx.beginPath(); ctx.ellipse(4.2, 0, 2.4, 4.2, 0, -Math.PI / 2, Math.PI / 2); ctx.fillStyle = '#111'; ctx.fill();
    h.ell(ctx, 2.6, 0, 1, 1, '#d8c050', false); h.cap(ctx, 2.6, -4.4, 2.6, 4.4, 0.5, '#d8c050');
  },
  shunt(ctx, h) { // newsboy flat cap with a short peak and a button on top
    h.ell(ctx, 0.4, 0, 5.2, 5, h.o.helmet); h.ell(ctx, 4, 0, 1.8, 3.6, h.shade(h.o.helmet, 0.75));
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.4; for (let a = 0; a < 6.28; a += 1.05) { ctx.beginPath(); ctx.moveTo(-0.6, 0); ctx.lineTo(-0.6 + Math.cos(a) * 4.6, Math.sin(a) * 4.6); ctx.stroke(); }
    h.ell(ctx, -0.6, 0, 0.7, 0.7, h.o.color, false);
  },
  hush(ctx, h) { // close-fitting balaclava, eyes only
    h.ell(ctx, 0, 0, 4.9, 4.9, '#17181c'); lens(ctx, 3.4, -2.4, 1, 4.8, h.shade('#c99a78', 0.9)); lens(ctx, 3.8, -2, 0.5, 1, '#111'); lens(ctx, 3.8, 1, 0.5, 1, '#111');
  },
  shade(ctx, h) { // studio headphones over loose hair
    hairCap(h, ctx); h.cap(ctx, -0.3, -4.8, -0.3, 4.8, 1, '#ddd'); h.ell(ctx, -0.3, -5, 2, 1.8, '#2b2b2b'); h.ell(ctx, -0.3, 5, 2, 1.8, '#2b2b2b');
    h.ell(ctx, -0.3, -5, 0.8, 0.8, h.o.color, false); h.ell(ctx, -0.3, 5, 0.8, 0.8, h.o.color, false);
  },
  rampart(ctx, h) { // heavy helmet with a barred face cage
    ear(h, ctx); h.ell(ctx, -0.4, 0, 5.8, 5.6, h.o.helmet);
    ctx.strokeStyle = '#c8c8c8'; ctx.lineWidth = 0.6; for (const y of [-2.5, 0, 2.5]) { ctx.beginPath(); ctx.moveTo(3, y); ctx.lineTo(6.4, y * 0.8); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(6.4, -2.4); ctx.lineTo(6.4, 2.4); ctx.stroke();
  },
  miasma(ctx, h) { // hazmat hood: a loose bag with a big window
    h.ell(ctx, -0.8, 0, 6.2, 6, '#c8d34a'); ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.arc(-1, 0, 4, 2, 4.3); ctx.stroke();
    h.box(ctx, 2.2, -3.8, 2.8, 7.6, 1.4, 'rgba(160,200,210,0.9)');
  },
  snare(ctx, h) { // tweed deerstalker: a peak at the front AND the back, flaps tied on top
    h.ell(ctx, 0, 0, 4.9, 4.9, h.o.helmet); h.ell(ctx, 4, 0, 1.7, 3.2, h.shade(h.o.helmet, 0.8)); h.ell(ctx, -4, 0, 1.7, 3.2, h.shade(h.o.helmet, 0.8));
    h.cap(ctx, -0.4, -2, -0.4, 2, 0.6, '#6b4a2a');
  },
  argus(ctx, h) { // camera helmet: three small lenses in a row on the brow
    ear(h, ctx); h.ell(ctx, 0, 0, 5.2, 5.2, h.o.helmet);
    for (const y of [-2.6, 0, 2.6]) { h.ell(ctx, 4.2, y, 1, 1, '#111'); h.ell(ctx, 4.4, y, 0.45, 0.45, '#7ad', false); }
  },
  solder(ctx, h) { // patterned welder's skull cap (doo-rag) knotted behind
    h.ell(ctx, -0.2, 0, 4.8, 4.7, h.o.helmet); ctx.fillStyle = h.shade(h.o.helmet, 1.5);
    for (let i = 0; i < 7; i++) { const a = i * 2.4; ctx.fillRect(-0.5 + Math.cos(a) * 2.6, Math.sin(a) * 2.6, 0.8, 0.8); }
    h.ell(ctx, -4.8, 0, 1.2, 1, h.o.helmet);
  },
  latch(ctx, h) { // baseball cap worn backwards
    h.ell(ctx, 0, 0, 4.6, 4.6, h.o.helmet);
    ctx.beginPath(); ctx.ellipse(-4.2, 0, 2.6, 3.7, 0, Math.PI / 2, Math.PI * 1.5); ctx.fillStyle = h.shade(h.o.helmet, 0.7); ctx.fill(); ctx.strokeStyle = h.OUT; ctx.lineWidth = 0.5; ctx.stroke();
    h.ell(ctx, -1.6, 0, 1.2, 0.8, '#ddd', false);
  },
  hound(ctx, h) { // flat gaucho hat: wide flat brim, low round crown and a band
    h.ell(ctx, 0, 0, 7.2, 7, h.shade(h.o.helmet, 0.85)); h.ell(ctx, 0, 0, 4, 4, h.o.helmet);
    ctx.strokeStyle = h.o.color; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(0, 0, 4, 0, 7); ctx.stroke();
  },
  ruse(ctx, h) { // carnival half-mask over dark curls
    hairCap(h, ctx); ctx.fillStyle = h.shade(h.hair, 1.3); for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(-2 + Math.cos(i) * 2, Math.sin(i * 1.7) * 3, 0.7, 0, 7); ctx.fill(); }
    ctx.beginPath(); ctx.moveTo(2.4, -4); ctx.quadraticCurveTo(6, 0, 2.4, 4); ctx.lineTo(3.4, 0); ctx.closePath(); ctx.fillStyle = '#e8e2d0'; ctx.fill(); ctx.strokeStyle = '#b8902a'; ctx.lineWidth = 0.5; ctx.stroke();
  },
  rally(ctx, h) { // runner's legionnaire cap: peak in front, a cloth flap over the neck
    h.ell(ctx, 0, 0, 4.7, 4.7, h.o.helmet); h.ell(ctx, 4.2, 0, 2, 3.6, h.shade(h.o.helmet, 0.75));
    h.box(ctx, -7, -3.8, 3.4, 7.6, 1, h.shade(h.o.helmet, 1.2));
  },
  lens(ctx, h) { // helmet under camouflage netting with bits of foliage
    ear(h, ctx); h.ell(ctx, 0, 0, 5.5, 5.5, h.o.helmet); ctx.strokeStyle = 'rgba(30,40,20,0.6)'; ctx.lineWidth = 0.35;
    for (let i = -4; i <= 4; i += 1.6) { ctx.beginPath(); ctx.moveTo(i, -5); ctx.lineTo(i + 2, 5); ctx.moveTo(-5, i); ctx.lineTo(5, i + 2); ctx.stroke(); }
    for (let i = 0; i < 5; i++) h.ell(ctx, Math.cos(i * 1.3) * 3.4, Math.sin(i * 2.1) * 3.4, 0.9, 0.5, '#4f6a32', false);
  },
  audit(ctx, h) { // aviation headset: big padded cups, headband over the top, boom mic
    hairCap(h, ctx); h.cap(ctx, 0, -5, 0, 5, 1.3, '#2b2b30'); h.ell(ctx, 0, -5.4, 2.4, 1.9, '#3a3a40'); h.ell(ctx, 0, 5.4, 2.4, 1.9, '#3a3a40');
    h.cap(ctx, 0.6, 5.2, 4.6, 2.6, 0.5, '#222'); h.ell(ctx, 4.8, 2.4, 0.7, 0.7, h.o.color, false);
  },
  tonic(ctx, h) { // bright patterned head-wrap tied in a knot on top
    h.ell(ctx, -0.4, 0, 5.2, 5, h.o.helmet); ctx.strokeStyle = h.shade(h.o.helmet, 1.6); ctx.lineWidth = 0.6;
    for (const a of [-0.6, 0.6]) { ctx.beginPath(); ctx.arc(-0.4, 0, 3.4, a, a + 2.2); ctx.stroke(); }
    h.ell(ctx, -0.6, 0, 1.8, 1.4, h.shade(h.o.helmet, 1.2));
  },
  ward(ctx, h) { // padded tanker's helmet with ribbed rolls
    h.ell(ctx, -0.2, 0, 5.4, 5.3, h.o.helmet); ctx.strokeStyle = h.shade(h.o.helmet, 0.6); ctx.lineWidth = 0.9;
    for (const y of [-2.6, 0, 2.6]) { ctx.beginPath(); ctx.moveTo(-4.4, y); ctx.lineTo(3.6, y); ctx.stroke(); }
    ear(h, ctx, h.shade(h.o.helmet, 0.7));
  },
  perch(ctx, h) { // PERCH: a flat shooting cap turned backwards, ear defenders over it
    h.ell(ctx, -0.2, 0, 4.8, 4.7, h.o.helmet); h.cap(ctx, -5.6, -1.6, -5.6, 1.6, 1.6, h.shade(h.o.helmet, 0.7));
    h.ell(ctx, 0, -4.4, 1.6, 1.3, '#2a2c2e'); h.ell(ctx, 0, 4.4, 1.6, 1.3, '#2a2c2e'); h.cap(ctx, 0, -4.2, 0, 4.2, 0.6, '#1a1c1e');
  },
  moss(ctx, h) { // MOSS: a shaggy ghillie hood, strands of burlap all round
    h.ell(ctx, -0.3, 0, 5.4, 5.3, h.o.helmet);
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, r = 4.6 + (i % 3) * 0.5; h.cap(ctx, Math.cos(a) * 3.6 - 0.3, Math.sin(a) * 3.6, Math.cos(a) * r - 0.3, Math.sin(a) * r, 0.55, i % 2 ? '#5a6a32' : '#7a7a4a'); }
    h.box(ctx, 2.8, -1.4, 1, 2.8, 0.4, '#141612');
  },
  osprey(ctx, h) { // OSPREY: a helmet with a spotting monocular flipped down over one eye
    h.ell(ctx, -0.2, 0, 5.0, 4.9, h.o.helmet); ctx.strokeStyle = h.shade(h.o.helmet, 0.6); ctx.lineWidth = 0.7; ctx.beginPath(); ctx.arc(-0.2, 0, 4.1, -1.2, 1.2); ctx.stroke();
    h.cap(ctx, 2.2, -1.6, 5.4, -1.6, 1.1, '#202326'); lens(ctx, 5.2, -2.2, 0.6, 1.2, `rgba(240,200,110,${0.6 + 0.2 * Math.sin(h.t * 2)})`);
  },
  nail(ctx, h) { // NAIL: a shipyard welding cap and a respirator, a rivet stud on top
    h.ell(ctx, 0, 0, 4.7, 4.6, h.o.helmet); h.ell(ctx, -1.2, 0, 0.9, 0.9, '#8a8f95');
    h.box(ctx, 2.6, -2.2, 1.8, 4.4, 0.8, '#26282b'); h.ell(ctx, 3.6, -2.2, 0.9, 0.9, '#3a3d42'); h.ell(ctx, 3.6, 2.2, 0.9, 0.9, '#3a3d42');
  },
  girder(ctx, h) { // bald head, welding goggles pushed up on the forehead
    h.ell(ctx, 0.2, 0, 4.4, 4.4, h.shade('#c99a78', 1.05)); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(-1, -1.4, 1.2, 0, 7); ctx.fill();
    strap(h, ctx, '#3a2a1a'); h.ell(ctx, 1.4, -1.6, 1.2, 1.2, '#24282c'); h.ell(ctx, 1.4, 1.6, 1.2, 1.2, '#24282c');
    h.ell(ctx, 1.5, -1.6, 0.6, 0.6, '#5a8a6a', false); h.ell(ctx, 1.5, 1.6, 0.6, 0.6, '#5a8a6a', false);
  },
  magpie(ctx, h) { // MAGPIE: dark hood with a black-and-white feather crest down the back and a green-lit visor slit
    h.ell(ctx, -0.5, 0, 5.3, 5.2, h.o.helmet); h.cap(ctx, -5.6, 0, -1, 0, 1.3, '#101214'); h.cap(ctx, -5, -1.1, -1.6, -0.8, 0.5, '#e6e6e0'); h.cap(ctx, -5, 1.1, -1.6, 0.8, 0.5, '#e6e6e0');
    h.box(ctx, 2.6, -3, 1.2, 6, 0.6, '#0d0f10'); lens(ctx, 3.3, -2.4, 0.5, 4.8, `rgba(110,240,140,${0.55 + 0.25 * Math.sin(h.t * 3)})`);
  },
};

// What each operator carries on their back. Several kinds, spread so that operators who do similar jobs carry
// different things; ability-specific kit drawn in sprites.js (cutter, panel, jammer) still comes first.
export const PACK = {
  ember: 'tank', kestrel: 'dragbag', hammer: 'tube', talon: 'laptop', bulwark: 'none', rivet: 'tank2', haze: 'canisters', glint: 'radio',
  brisk: 'sling', onyx: 'crate', prism: 'projector', volt: 'coil', tether: 'reel', strider: 'sling2', ferro: 'hammer', salvo: 'tube2',
  torque: 'discs', rush: 'none', blaze: 'flares', echo: 'spikes', mark: 'ammo', patch: 'medbag', trench: 'plates', wren: 'roll', vapor: 'tank3', crow: 'cloak',
  mason: 'panel', veil: 'jammer', lynx: 'pouches', solace: 'medbag2', wraith: 'cloak2', bramble: 'pouches2', kite: 'antennas', gravel: 'baton',
  shunt: 'toolbox', hush: 'none', shade: 'mics', rampart: 'armorbag', miasma: 'canisters2', snare: 'wire', argus: 'camcase', solder: 'tank4',
  latch: 'wire2', hound: 'darts', ruse: 'speaker', rally: 'bottle', lens: 'tripod', audit: 'radio2', tonic: 'medcase', ward: 'radar', girder: 'girders', magpie: 'hive',
  perch: 'dragbag', moss: 'cloak', osprey: 'radio', nail: 'ammo',
};
// The cut of the vest/jacket over the torso
export const VEST = {
  ember: 'apron', kestrel: 'parka', hammer: 'carrier', talon: 'hoodie', bulwark: 'heavy', rivet: 'wetsuit', haze: 'jacket', glint: 'rig',
  brisk: 'light', onyx: 'bomb', prism: 'coat', volt: 'harness', tether: 'rig2', strider: 'light2', ferro: 'overalls', salvo: 'carrier2',
  torque: 'leather', rush: 'jersey', blaze: 'jacket2', echo: 'field', mark: 'shirt', patch: 'medic', trench: 'heavy2', wren: 'coat2', vapor: 'hoodie2', crow: 'cloak',
  mason: 'heavy3', veil: 'rig3', lynx: 'rig4', solace: 'medic2', wraith: 'cloak2', bramble: 'field2', kite: 'jacket3', gravel: 'police',
  shunt: 'overalls2', hush: 'light3', shade: 'shirt2', rampart: 'heavy4', miasma: 'hazmat', snare: 'tweed', argus: 'suit', solder: 'apron2',
  latch: 'hivis', hound: 'poncho', ruse: 'coat3', rally: 'singlet', lens: 'ghillie', audit: 'jacket4', tonic: 'scrubs', ward: 'carrier3', girder: 'hivis2', magpie: 'field',
  perch: 'heavy2', moss: 'ghillie', osprey: 'parka', nail: 'carrier',
};
