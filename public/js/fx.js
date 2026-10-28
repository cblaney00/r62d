// Particles, tracers, explosions and smoke clouds.
const MAX = 1400;

export class FX {
  constructor() { this.parts = []; this.tracers = []; this.lights = []; this.rings = []; this.shake = 0; this.quality = 1; }
  clear() { this.parts = []; this.tracers = []; this.lights = []; this.rings = []; }

  // lower graphics quality keeps only a share of the particles
  add(p) { if (this.parts.length < MAX * this.quality && (this.quality >= 1 || Math.random() < this.quality)) this.parts.push(p); }

  tracer(x, y, x2, y2, col = '255,220,150') { this.tracers.push({ x, y, x2, y2, life: 0.07, max: 0.07, col }); }

  muzzle(x, y, a) {
    this.lights.push({ x, y, r: 70, life: 0.05, max: 0.05, col: '255,190,110', a: 0.35 });
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
      ctx.strokeStyle = `rgba(${t.col},${0.55 * k})`; ctx.lineWidth = 0.9;
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

// Billowing smoke grenade cloud
export function drawSmoke(ctx, s, t, puffs = 22) {
  const fade = Math.min(1, s.l / 2) * Math.min(1, (12 - s.l) * 2 + 0.2);
  for (let i = 0; i < puffs; i++) {
    const a = i * 2.4 + t * 0.15 * (i % 2 ? 1 : -1), d = (i % 5) / 5 * s.r * 0.75;
    const x = s.x + Math.cos(a) * d, y = s.y + Math.sin(a) * d, r = s.r * (0.38 + (i % 3) * 0.08);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(205,205,200,${0.5 * fade})`); g.addColorStop(1, 'rgba(190,190,185,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
}
