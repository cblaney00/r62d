// Procedural, tileable floor textures (drawn once at load).
import { FL } from '/shared/constants.js';

export const S = 2; // texture pixels per world pixel

// Small deterministic random generator
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
export const hash = (x, y, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function noise(ctx, P, r, amt, dark = true) {
  const n = P * S;
  const img = ctx.getImageData(0, 0, n, n), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = (r() - 0.5) * amt;
    d[i] += v; d[i + 1] += v; d[i + 2] += v;
  }
  ctx.putImageData(img, 0, 0);
}

// draw something with wrap-around so the texture tiles seamlessly
function wrap(P, fn) { for (const ox of [-P, 0, P]) for (const oy of [-P, 0, P]) fn(ox, oy); }

const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16);
  const c = v => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
};

function wood(P) {
  const c = canvas(P * S, P * S), x = c.getContext('2d'), r = rng(11);
  x.scale(S, S);
  const rowH = 6;
  for (let y = 0; y < P; y += rowH) {
    let px = -r() * 60;
    while (px < P) {
      const len = 34 + r() * 50, f = 0.82 + r() * 0.3;
      const base = r() < 0.5 ? '#8a5c37' : '#7c5230';
      wrap(P, ox => {
        x.fillStyle = shade(base, f); x.fillRect(px + ox, y, len, rowH);
        // grain
        x.globalAlpha = 0.18;
        for (let g = 0; g < 4; g++) {
          x.strokeStyle = r() < 0.5 ? '#3d2614' : '#b98552'; x.lineWidth = 0.4;
          x.beginPath(); const gy = y + 0.8 + r() * (rowH - 1.6);
          x.moveTo(px + ox, gy); x.bezierCurveTo(px + ox + len * 0.3, gy + (r() - 0.5) * 1.5, px + ox + len * 0.7, gy + (r() - 0.5) * 1.5, px + ox + len, gy);
          x.stroke();
        }
        if (r() < 0.25) { x.fillStyle = '#4a2e18'; x.beginPath(); x.ellipse(px + ox + len * r(), y + rowH / 2, 1.6, 0.8, 0, 0, 7); x.fill(); }
        x.globalAlpha = 1;
        x.fillStyle = 'rgba(30,18,8,0.55)'; x.fillRect(px + ox + len - 0.5, y, 0.5, rowH);
      });
      px += len;
    }
    x.fillStyle = 'rgba(30,18,8,0.6)'; x.fillRect(0, y + rowH - 0.5, P, 0.5);
    x.fillStyle = 'rgba(255,220,170,0.08)'; x.fillRect(0, y, P, 0.5);
  }
  noise(x, P, r, 14);
  return c;
}

function tile(P, base, size, grout) {
  const c = canvas(P * S, P * S), x = c.getContext('2d'), r = rng(23);
  x.scale(S, S);
  x.fillStyle = grout; x.fillRect(0, 0, P, P);
  for (let ty = 0; ty < P; ty += size) for (let tx = 0; tx < P; tx += size) {
    x.fillStyle = shade(base, 0.94 + r() * 0.1); x.fillRect(tx + 0.5, ty + 0.5, size - 1, size - 1);
    const g = x.createLinearGradient(tx, ty, tx + size, ty + size);
    g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0.06)');
    x.fillStyle = g; x.fillRect(tx + 0.5, ty + 0.5, size - 1, size - 1);
  }
  noise(x, P, r, 10);
  return c;
}

function serverFloor(P) {
  const c = canvas(P * S, P * S), x = c.getContext('2d'), r = rng(31);
  x.scale(S, S);
  x.fillStyle = '#1f2327'; x.fillRect(0, 0, P, P);
  for (let ty = 0; ty < P; ty += 32) for (let tx = 0; tx < P; tx += 32) {
    x.fillStyle = shade('#3c434b', 0.92 + r() * 0.12); x.fillRect(tx + 0.75, ty + 0.75, 30.5, 30.5);
    x.fillStyle = 'rgba(255,255,255,0.07)'; x.fillRect(tx + 0.75, ty + 0.75, 30.5, 0.6); x.fillRect(tx + 0.75, ty + 0.75, 0.6, 30.5);
    if (r() < 0.5) { // perforated panel
      x.fillStyle = 'rgba(0,0,0,0.45)';
      for (let i = 4; i < 30; i += 3) for (let j = 4; j < 30; j += 3) { x.beginPath(); x.arc(tx + i, ty + j, 0.5, 0, 7); x.fill(); }
    }
  }
  noise(x, P, r, 8);
  return c;
}

function marble(P) {
  const c = canvas(P * S, P * S), x = c.getContext('2d'), r = rng(41);
  x.scale(S, S);
  for (let ty = 0; ty < P; ty += 32) for (let tx = 0; tx < P; tx += 32) {
    x.fillStyle = ((tx + ty) / 32) % 2 ? '#dcd6cb' : '#cfc8bb'; x.fillRect(tx, ty, 32, 32);
  }
  x.lineCap = 'round';
  for (let v = 0; v < 14; v++) {
    const sx = r() * P, sy = r() * P, a = r() * Math.PI, l = 30 + r() * 70, w = 0.3 + r() * 0.7;
    const cx1 = sx + Math.cos(a) * l * 0.3 + (r() - 0.5) * 20, cy1 = sy + Math.sin(a) * l * 0.3 + (r() - 0.5) * 20;
    const ex = sx + Math.cos(a) * l, ey = sy + Math.sin(a) * l;
    wrap(P, (ox, oy) => {
      x.strokeStyle = `rgba(110,100,92,${0.15 + r() * 0.2})`; x.lineWidth = w;
      x.beginPath(); x.moveTo(sx + ox, sy + oy); x.quadraticCurveTo(cx1 + ox, cy1 + oy, ex + ox, ey + oy); x.stroke();
    });
  }
  x.fillStyle = 'rgba(80,72,64,0.35)';
  for (let i = 0; i < P; i += 32) { x.fillRect(i, 0, 0.4, P); x.fillRect(0, i, P, 0.4); }
  noise(x, P, r, 8);
  return c;
}

function carpet(P) {
  const c = canvas(P * S, P * S), x = c.getContext('2d'), r = rng(53);
  x.scale(S, S);
  x.fillStyle = '#4a556a'; x.fillRect(0, 0, P, P);
  x.strokeStyle = 'rgba(160,170,200,0.08)'; x.lineWidth = 0.6;
  for (let i = -P; i < P * 2; i += 8) {
    x.beginPath(); x.moveTo(i, 0); x.lineTo(i + P, P); x.stroke();
    x.beginPath(); x.moveTo(i, P); x.lineTo(i + P, 0); x.stroke();
  }
  noise(x, P, r, 26);
  return c;
}

function concrete(P) {
  const c = canvas(P * S, P * S), x = c.getContext('2d'), r = rng(67);
  x.scale(S, S);
  x.fillStyle = '#8a8c88'; x.fillRect(0, 0, P, P);
  for (let i = 0; i < 18; i++) {
    const bx = r() * P, by = r() * P, br = 8 + r() * 26, dark = r() < 0.5;
    wrap(P, (ox, oy) => {
      const g = x.createRadialGradient(bx + ox, by + oy, 0, bx + ox, by + oy, br);
      g.addColorStop(0, dark ? 'rgba(40,40,36,0.12)' : 'rgba(255,255,250,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(bx + ox - br, by + oy - br, br * 2, br * 2);
    });
  }
  x.fillStyle = 'rgba(40,40,40,0.35)'; x.fillRect(0, 0, P, 0.5); x.fillRect(0, 0, 0.5, P);
  for (let i = 0; i < 6; i++) { // hairline cracks
    x.strokeStyle = 'rgba(40,40,40,0.25)'; x.lineWidth = 0.35; x.beginPath();
    let cx = r() * P, cy = r() * P; x.moveTo(cx, cy);
    for (let s = 0; s < 6; s++) { cx += (r() - 0.5) * 10; cy += (r() - 0.5) * 10; x.lineTo(cx, cy); }
    x.stroke();
  }
  noise(x, P, r, 22);
  return c;
}

function grass(P) {
  const c = canvas(P * S, P * S), x = c.getContext('2d'), r = rng(71);
  x.scale(S, S);
  x.fillStyle = '#4c6833'; x.fillRect(0, 0, P, P);
  for (let i = 0; i < 12; i++) {
    const bx = r() * P, by = r() * P, br = 10 + r() * 30, dark = r() < 0.6;
    wrap(P, (ox, oy) => {
      const g = x.createRadialGradient(bx + ox, by + oy, 0, bx + ox, by + oy, br);
      g.addColorStop(0, dark ? 'rgba(20,40,10,0.25)' : 'rgba(150,170,80,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(bx + ox - br, by + oy - br, br * 2, br * 2);
    });
  }
  x.lineCap = 'round';
  const greens = ['#5f7f3d', '#3d5727', '#6f8f45', '#2f4520', '#7c9a4f'];
  for (let i = 0; i < 2600; i++) {
    const bx = r() * P, by = r() * P, a = -Math.PI / 2 + (r() - 0.5) * 1.2, l = 1 + r() * 2.2;
    x.strokeStyle = greens[(r() * greens.length) | 0]; x.lineWidth = 0.45;
    wrap(P, (ox, oy) => {
      if (bx + ox < -4 || bx + ox > P + 4 || by + oy < -4 || by + oy > P + 4) return;
      x.beginPath(); x.moveTo(bx + ox, by + oy); x.lineTo(bx + ox + Math.cos(a) * l, by + oy + Math.sin(a) * l); x.stroke();
    });
  }
  noise(x, P, r, 18);
  return c;
}

function asphalt(P) {
  const c = canvas(P * S, P * S), x = c.getContext('2d'), r = rng(83);
  x.scale(S, S);
  x.fillStyle = '#3a3c3f'; x.fillRect(0, 0, P, P);
  for (let i = 0; i < 900; i++) {
    x.fillStyle = r() < 0.5 ? 'rgba(150,150,150,0.35)' : 'rgba(15,15,15,0.4)';
    x.fillRect(r() * P, r() * P, 0.5 + r() * 0.8, 0.5 + r() * 0.8);
  }
  for (let i = 0; i < 6; i++) {
    const bx = r() * P, by = r() * P, br = 10 + r() * 24;
    wrap(P, (ox, oy) => {
      const g = x.createRadialGradient(bx + ox, by + oy, 0, bx + ox, by + oy, br);
      g.addColorStop(0, 'rgba(0,0,0,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(bx + ox - br, by + oy - br, br * 2, br * 2);
    });
  }
  noise(x, P, r, 18);
  return c;
}

let cache = null;
export function floorPatterns(ctx) {
  if (!cache) cache = {
    [FL.WOOD]: wood(128), [FL.TILE]: tile(64, '#c4cbcf', 16, '#7d8589'), [FL.SERVER]: serverFloor(64),
    [FL.MARBLE]: marble(128), [FL.CARPET]: carpet(64), [FL.CONCRETE]: concrete(128),
    [FL.GRASS]: grass(128), [FL.ASPHALT]: asphalt(128),
  };
  const out = {};
  for (const [k, c] of Object.entries(cache)) {
    const p = ctx.createPattern(c, 'repeat');
    p.setTransform(new DOMMatrix().scale(1 / S));
    out[k] = p;
  }
  return out;
}

export { shade, canvas };
