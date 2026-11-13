// Particles, tracers, explosions and smoke clouds.
const MAX = 1400;

export const TRAIL_LIFE = 0.45;
export function drawTrail(ctx, x, y, x2, y2, k) { // k: 1 fresh → 0 gone
  const g = ctx.createLinearGradient(x, y, x2, y2), a = k * k;
  g.addColorStop(0, `rgba(255,214,140,${0.05 * a})`); g.addColorStop(0.5, `rgba(255,224,160,${0.22 * a})`); g.addColorStop(1, `rgba(255,240,200,${0.42 * a})`); // he asked: fainter, noticeable but not gigantic
  ctx.lineCap = 'round'; ctx.strokeStyle = `rgba(255,200,120,${0.05 * a})`; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.strokeStyle = g; ctx.lineWidth = 0.4 + 0.2 * k; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke(); ctx.lineCap = 'butt';
}
export class FX {
  constructor() { this.parts = []; this.tracers = []; this.lights = []; this.rings = []; this.shake = 0; this.quality = 1; }
  clear() { this.parts = []; this.tracers = []; this.lights = []; this.rings = []; }

  // lower graphics quality keeps only a share of the particles
  add(p) { if (this.parts.length < MAX * this.quality && (this.quality >= 1 || Math.random() < this.quality)) this.parts.push(p); }

  // thin and brief (he asked: bullets are tiny, so their streaks should be too): about 2-3 frames
  tracer(x, y, x2, y2, col = '255,220,150') { this.tracers.push({ x, y, x2, y2, life: 0.04, max: 0.04, col }); }
  // a bullet trail (he asked: to see where shots come from; subsonic ammo leaves none): lingers TRAIL_LIFE s, drawn on
  // #game under the blackout, so you only see the part that crosses what you can see
  trail(x, y, x2, y2) { this.tracers.push({ x, y, x2, y2, life: TRAIL_LIFE, max: TRAIL_LIFE, trail: 1 }); }

  muzzle(x, y, a) {
    this.lights.push({ x, y, r: 115, life: 0.06, max: 0.06, col: '255,186,105', a: 0.42 }); // a shot lights up the room round it for a moment
    // shell casing flies out to the right
    const ca = a + Math.PI / 2 + (Math.random() - 0.5) * 0.6, sp = 60 + Math.random() * 50;
    this.add({ type: 'casing', x, y, vx: Math.cos(ca) * sp, vy: Math.sin(ca) * sp, life: 0.9, max: 0.9, rot: Math.random() * 6, vr: 20, size: 1 });
    for (let i = 0; i < 2; i++) this.add({ type: 'smoke', x, y, vx: Math.cos(a) * 20 + (Math.random() - 0.5) * 10, vy: Math.sin(a) * 20 + (Math.random() - 0.5) * 10, life: 0.5, max: 0.5, size: 2 + Math.random() * 2, grow: 10, col: '180,180,180', a: 0.18 });
  }

  impact(x, y, kind, ang = 0) {
    const n = kind === 'blood' ? 8 : 6;
    for (let i = 0; i < n; i++) {
      const a = ang + Math.PI + (Math.random() - 0.5) * 2.2, sp = 30 + Math.random() * 90;
      if (kind === 'blood') this.add({ type: 'dot', x, y, vx: Math.cos(ang + (Math.random() - 0.5) * 1.2) * sp, vy: Math.sin(ang + (Math.random() - 0.5) * 1.2) * sp, life: 0.35, max: 0.35, size: 1 + Math.random(), col: '140,10,10', drag: 6 });
      else if (kind === 'spark' || kind === 'hard' || kind === 'shield') this.add({ type: 'spark', x, y, vx: Math.cos(a) * sp * 1.6, vy: Math.sin(a) * sp * 1.6, life: 0.18 + Math.random() * 0.12, max: 0.3, size: 1, col: '255,210,120', drag: 4 });
      else this.add({ type: 'chunk', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5 + Math.random() * 0.3, max: 0.8, size: 0.8 + Math.random() * 1.4, col: kind === 'wood' ? '150,100,55' : kind === 'prop' ? '90,80,70' : '210,205,190', drag: 5, rot: Math.random() * 6, vr: 10 });
    }
    this.add({ type: 'smoke', x, y, vx: 0, vy: 0, life: 0.6, max: 0.6, size: 2, grow: 14, col: kind === 'blood' ? '120,20,20' : '200,195,185', a: 0.25 });
  }

  explosion(x, y, r, kind) {
    const big = kind === 'frag' || kind === 'nitro' || kind === 'cutter';
    this.shake = Math.max(this.shake, big ? 7 : 4);
    if (kind === 'stun') {
      this.lights.push({ x, y, r: 200, life: 0.25, max: 0.25, col: '255,255,255', a: 0.9 });
      this.rings.push({ x, y, r: 0, max: 120, life: 0.35, maxL: 0.35, col: '255,255,255' });
      return;
    }
    if (kind === 'surge') { // the Surge Caster's green burst (zombies)
      this.rings.push({ x, y, r: 0, max: r, life: 0.35, maxL: 0.35, col: '120,255,170' });
      this.lights.push({ x, y, r: r * 2, life: 0.25, max: 0.25, col: '110,255,160', a: 0.7 });
      for (let i = 0; i < 18; i++) { const a = Math.random() * 6.28; this.add({ type: 'spark', x, y, vx: Math.cos(a) * 180, vy: Math.sin(a) * 180, life: 0.3, max: 0.3, size: 1.2, col: '150,255,190', drag: 4 }); }
      return;
    }
    if (kind === 'emp') {
      this.rings.push({ x, y, r: 0, max: r, life: 0.5, maxL: 0.5, col: '180,120,255' });
      this.lights.push({ x, y, r: r, life: 0.3, max: 0.3, col: '170,110,255', a: 0.4 });
      for (let i = 0; i < 20; i++) { const a = Math.random() * 6.28; this.add({ type: 'spark', x, y, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200, life: 0.3, max: 0.3, size: 1, col: '200,160,255', drag: 3 }); }
      return;
    }
    this.lights.push({ x, y, r: r * 2.6, life: 0.22, max: 0.22, col: kind === 'cutter' ? '255,160,60' : '255,200,120', a: 0.85 });
    this.rings.push({ x, y, r: 0, max: r * 1.2, life: 0.25, maxL: 0.25, col: '255,240,200' });
    for (let i = 0; i < (big ? 26 : 14); i++) {
      const a = Math.random() * 6.28, sp = 40 + Math.random() * 120;
      this.add({ type: 'fire', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.25 + Math.random() * 0.25, max: 0.5, size: 3 + Math.random() * 5, drag: 5 });
    }
    for (let i = 0; i < (big ? 30 : 16); i++) {
      const a = Math.random() * 6.28, sp = 20 + Math.random() * 80;
      this.add({ type: 'smoke', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1.4 + Math.random(), max: 2.4, size: 4 + Math.random() * 6, grow: 12, col: '70,66,62', a: 0.45, drag: 2.5 });
    }
    for (let i = 0; i < (big ? 30 : 18); i++) {
      const a = Math.random() * 6.28, sp = 80 + Math.random() * 220;
      this.add({ type: 'chunk', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.6 + Math.random() * 0.5, max: 1.1, size: 1 + Math.random() * 2, col: '120,110,100', drag: 4, rot: Math.random() * 6, vr: 14 });
    }
  }

  wallBreak(x, y, col) {
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * 6.28, sp = 30 + Math.random() * 70;
      this.add({ type: 'chunk', x: x + (Math.random() - 0.5) * 12, y: y + (Math.random() - 0.5) * 12, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.6, max: 0.6, size: 1 + Math.random() * 2, col, drag: 5, rot: 0, vr: 8 });
    }
    this.add({ type: 'smoke', x, y, vx: 0, vy: 0, life: 1.2, max: 1.2, size: 6, grow: 14, col: '200,195,185', a: 0.3 });
  }

  ping(x, y, col) { this.rings.push({ x, y, r: 0, max: 170, life: 0.9, maxL: 0.9, col }); }

  update(dt) {
    this.shake *= Math.exp(-dt * 10);
    for (const p of this.parts) {
      p.life -= dt;
      const dr = Math.exp(-(p.drag || 3) * dt);
      p.vx *= dr; p.vy *= dr; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.rot !== undefined) p.rot += (p.vr || 0) * dt * (Math.hypot(p.vx, p.vy) / 100);
      if (p.grow) p.size += p.grow * dt;
    }
    this.parts = this.parts.filter(p => p.life > 0);
    for (const l of [this.tracers, this.lights]) for (const p of l) p.life -= dt;
    this.tracers = this.tracers.filter(p => p.life > 0);
    this.lights = this.lights.filter(p => p.life > 0);
    for (const r of this.rings) { r.life -= dt; r.r = r.max * (1 - r.life / r.maxL); }
    this.rings = this.rings.filter(r => r.life > 0);
  }

  draw(ctx) {
    for (const p of this.parts) {
      const k = p.life / p.max;
      if (p.type === 'smoke') { ctx.fillStyle = `rgba(${p.col},${p.a * k})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 7); ctx.fill(); }
      else if (p.type === 'fire') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255,${120 + 100 * k | 0},40,${0.7 * k})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + k), 0, 7); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      } else if (p.type === 'spark') { ctx.strokeStyle = `rgba(${p.col},${k})`; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02); ctx.stroke(); }
      else if (p.type === 'casing') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = `rgba(214,170,70,${Math.min(1, k * 3)})`; ctx.fillRect(-1, -0.4, 2, 0.8); ctx.restore(); }
      else if (p.type === 'chunk') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0); ctx.fillStyle = `rgba(${p.col},${Math.min(1, k * 2)})`; ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7); ctx.restore(); }
      else { ctx.fillStyle = `rgba(${p.col},${k})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 7); ctx.fill(); }
    }
    for (const t of this.tracers) {
      const k = t.life / t.max;
      if (t.trail) { drawTrail(ctx, t.x, t.y, t.x2, t.y2, k); continue; }
      ctx.strokeStyle = `rgba(${t.col},${0.6 * k})`; ctx.lineWidth = 0.45;
      ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(t.x2, t.y2); ctx.stroke();
    }
    for (const r of this.rings) { ctx.strokeStyle = `rgba(${r.col},${0.6 * r.life / r.maxL})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, 7); ctx.stroke(); }
  }

  drawLights(ctx) {
    ctx.globalCompositeOperation = 'lighter';
    for (const l of this.lights) {
      const k = l.life / l.max;
      const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
      g.addColorStop(0, `rgba(${l.col},${l.a * k})`); g.addColorStop(1, `rgba(${l.col},0)`);
      ctx.fillStyle = g; ctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}

// Smoke (he asked: a proper smoke effect, the outline smoky and moving): a dense body of soft blobs that churn slowly,
// and round the edge wisps that curl, swell and drift outward and fade, so the border never sits still as a hard circle.
// A cloud is either one big circle (grenades: x, y, r) or a list of small puffs (pf: HAZE's thin wall, VAPOR's cone),
// which is drawn the same way puff by puff, with the edge wisps only on puffs at the edge of the shape.
const blobCache = new Map();
function blob(col) { // one soft round puff, drawn once and stamped (fast)
  let c = blobCache.get(col); if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(${col},1)`); gr.addColorStop(0.45, `rgba(${col},0.75)`); gr.addColorStop(1, `rgba(${col},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); blobCache.set(col, c); return c;
}
const stamp = (ctx, img, x, y, r, a) => { if (a <= 0.005 || r <= 0.3) return; ctx.globalAlpha = a; ctx.drawImage(img, x - r, y - r, r * 2, r * 2); };
const hash = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
const edgeMemo = new Map(); // cloud id -> which puffs are on the edge, and which way is out
function edgesOf(s) {
  const key = s.id + ':' + s.pf.length; let m = edgeMemo.get(s.id);
  if (m && m.key === key) return m.v;
  const pf = s.pf, n = pf.length / 2, sp = s.r * 1.5, v = [];
  for (let i = 0; i < n; i++) {
    let cx = 0, cy = 0, k = 0;
    for (let j = 0; j < n; j++) if (j !== i && Math.abs(pf[j * 2] - pf[i * 2]) < sp && Math.abs(pf[j * 2 + 1] - pf[i * 2 + 1]) < sp) { cx += pf[j * 2]; cy += pf[j * 2 + 1]; k++; }
    if (k < 4) { const ox = k ? pf[i * 2] - cx / k : 1, oy = k ? pf[i * 2 + 1] - cy / k : 0, l = Math.hypot(ox, oy) || 1; v.push([i, ox / l, oy / l]); }
  }
  if (edgeMemo.size > 60) edgeMemo.clear();
  edgeMemo.set(s.id, { key, v }); return v;
}
export function drawSmoke(ctx, s, t, puffs = 22, col = '205,205,200') {
  const img = blob(col), q = Math.max(0.35, Math.min(1.4, puffs / 16)); // graphics quality: how many blobs and wisps
  const life = s.l ?? 12, fadeOut = Math.min(1, life / 1.6), A = ctx.globalAlpha;
  if (s.pf && s.pf.length) {
    const pf = s.pf, n = pf.length / 2, total = s.sk === 'cone' ? 8 : 12, age = total - life, r = s.r;
    const grow = (x, y) => { // VAPOR's cone rolls out from him almost at once; HAZE's wall unrolls from its middle
      const d = s.sk === 'cone' ? Math.hypot(x - s.x, y - s.y) / 900 : Math.hypot(x - pf[0], y - pf[1]) / 1600;
      return Math.max(0, Math.min(1, (age - d) / 0.14));
    };
    for (let i = 0; i < n; i++) { // the body: two churning blobs per puff
      const x = pf[i * 2], y = pf[i * 2 + 1], g = grow(x, y); if (!g) continue;
      for (let b = 0; b < 2; b++) {
        const ph = hash(i * 3 + b) * 6.28, a = t * (0.35 + hash(i + b * 7) * 0.3) + ph;
        stamp(ctx, img, x + Math.cos(a) * r * 0.3, y + Math.sin(a * 1.3) * r * 0.3, r * (1.5 + 0.2 * Math.sin(t * 0.9 + ph)) * g, 0.26 * fadeOut * A);
      }
    }
    for (const [i, ox, oy] of edgesOf(s)) { // the edge: wisps that curl outward and fade, over and over
      const x = pf[i * 2], y = pf[i * 2 + 1], g = grow(x, y); if (!g) continue;
      const w = Math.max(2, Math.round(3 * q));
      for (let b = 0; b < w; b++) {
        const ph = hash(i * 11 + b * 5), cyc = (t * (0.28 + ph * 0.2) + ph) % 1, sway = Math.sin(t * 1.7 + ph * 9) * 0.6;
        const d = r * (0.6 + cyc * 0.75), wx = x + (ox - oy * sway) * d, wy = y + (oy + ox * sway) * d;
        stamp(ctx, img, wx, wy, r * (0.5 + cyc * 0.5) * g, 0.24 * (1 - cyc) * Math.min(1, cyc * 6) * fadeOut * A);
      }
    }
  } else {
    const fadeIn = Math.min(1, (12 - life) * 2 + 0.2), f = fadeOut * fadeIn * A, R = s.r, nb = Math.round(puffs);
    for (let i = 0; i < nb; i++) { // the body
      const a = i * 2.4 + t * 0.15 * (i % 2 ? 1 : -1), d = (i % 5) / 5 * R * 0.7;
      stamp(ctx, img, s.x + Math.cos(a) * d, s.y + Math.sin(a) * d, R * (0.42 + (i % 3) * 0.09 + 0.04 * Math.sin(t + i)), 0.36 * f);
    }
    const nw = Math.round(26 * q); // the edge: wisps round the rim curling outward
    for (let i = 0; i < nw; i++) {
      const ph = hash(i * 13 + (s.x | 0)), cyc = (t * (0.22 + ph * 0.18) + ph) % 1;
      const a = i / nw * 6.283 + Math.sin(t * 0.4 + ph * 6) * 0.35 + cyc * 0.5 * (i % 2 ? 1 : -1), d = R * (0.58 + cyc * 0.34);
      stamp(ctx, img, s.x + Math.cos(a) * d, s.y + Math.sin(a) * d, R * (0.22 + cyc * 0.2 + 0.04 * Math.sin(t * 2 + i)), 0.3 * (1 - cyc) * Math.min(1, cyc * 5) * f);
    }
  }
  ctx.globalAlpha = A;
}
