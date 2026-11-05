// Draws the map (floors, walls, doors, furniture) into a big off-screen picture,
// and redraws small parts of it when walls get broken or reinforced.
import { CELL, T, FL, MAT, CELL_HP } from '/shared/constants.js';
import { S, floorPatterns, hash, shade, canvas } from './textures.js';
import { polyIn } from '/shared/physics.js';
import { drawOutProp } from './outprops.js';

const SOLID = new Set([T.HARD, T.SOFT, T.REINF, T.PANEL]);
const WALLISH = new Set([T.HARD, T.SOFT, T.REINF, T.PANEL, T.BARRI]);

// A big picture kept as 1024-pixel pieces. With one huge canvas, the first change after the browser had shown or
// copied it made Firefox duplicate the whole thing first (~85 MB on the bigger maps: a 60-120 ms freeze every time a
// wall broke or a door was boarded, he noticed it as lag). Now only the pieces that change are touched.
// The pieces overlap by 2 pixels so scaled copies never show a seam.
export class Tiled {
  constructor(w, h, ts = 1024) {
    this.width = w; this.height = h; this.ts = ts; this.tiles = [];
    for (let y = 0; y < h; y += ts) for (let x = 0; x < w; x += ts) {
      const tw = Math.min(ts + 2, w - x), th = Math.min(ts + 2, h - y), c = canvas(tw, th);
      this.tiles.push({ c, ctx: c.getContext('2d'), x, y, w: tw, h: th });
    }
  }
  // the pieces touching a rectangle (picture pixels)
  touching(x0, y0, x1, y1) { return this.tiles.filter(t => x1 > t.x && x0 < t.x + t.w && y1 > t.y && y0 < t.y + t.h); }
  // like ctx.drawImage(picture, sx, sy, sw, sh, dx, dy, dw, dh)
  drawTo(ctx, sx, sy, sw, sh, dx, dy, dw, dh) {
    const kx = dw / sw, ky = dh / sh, ts = this.ts;
    for (const t of this.touching(sx, sy, sx + sw, sy + sh)) {
      const a = Math.max(sx, t.x), c = Math.max(sy, t.y), b = Math.min(sx + sw, t.x + t.w), d = Math.min(sy + sh, t.y + t.h);
      const b2 = Math.min(b, t.x + ts + 1), d2 = Math.min(d, t.y + ts + 1); // own part plus a pixel of the overlap
      if (b2 <= a || d2 <= c) continue;
      ctx.drawImage(t.c, a - t.x, c - t.y, b2 - a, d2 - c, dx + (a - sx) * kx, dy + (c - sy) * ky, (b2 - a) * kx, (d2 - c) * ky);
    }
  }
}

export class MapRenderer {
  constructor(map, baseTiles, scale) { // scale: picture pixels per world pixel (default: the graphics setting's)
    this.map = map; this.base = baseTiles; this.S = scale || S;
    this.Wp = map.W * CELL; this.Hp = map.H * CELL;
    this.c = new Tiled(Math.ceil(this.Wp * this.S), Math.ceil(this.Hp * this.S)); // the map picture (shown by mount)
    this.ctx = this.dctx = this.c.tiles[0].ctx; // set to each piece in turn while drawing (onTiles)
    this.pat = floorPatterns(this.ctx);
    // (there is no grey copy any more: the fog layer draws this picture and the browser greys it, CSS filter on #fog.
    // Keeping a grey copy up to date with ctx.filter is what made his real Firefox slower the longer he played.)
    // the ground floor first, so the open air beside the upper floors and the roof can show it far below (makeBelow)
    const gi = map.groundFloor ?? 0, G = map.floors && map.floors[gi];
    if (G && map.floors.length > gi + 1) {
      this.region(G.gx, 0, G.gx + G.w - 1, map.H - 1); this.makeBelow(gi);
      if (G.gx > 0) this.region(0, 0, G.gx - 1, map.H - 1);
      this.region(G.gx + G.w, 0, map.W - 1, map.H - 1);
    } else this.region(0, 0, map.W - 1, map.H - 1);
  }
  // Far below (he asked: the open air beside an upper floor or the roof was plain black): the ground floor's outdoors,
  // made once when the map is drawn: small, so it comes out blurred when stretched, dulled and darkened, buildings below
  // shown as plain roofs. It never changes during the round, so it reads as the view far below, not live sight
  // (looking out of a window still shows the real ground there: drawWindowView in main.js).
  makeBelow(gi) {
    const m = this.map, G = m.floors[gi], K = 0.2, w = Math.ceil(G.w * CELL * K), h = Math.ceil(G.h * CELL * K);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingQuality = 'high';
    this.c.drawTo(x, G.gx * CELL * this.S, 0, G.w * CELL * this.S, G.h * CELL * this.S, 0, 0, w, h);
    const inRoom = new Uint8Array(m.W * m.H);
    for (const r of m.rooms || []) for (let yy = r.y; yy < r.y + r.h; yy++) for (let xx = r.x; xx < r.x + r.w; xx++) if (xx >= 0 && yy >= 0 && xx < m.W && yy < m.H) inRoom[yy * m.W + xx] = 1;
    const OUT_FL = new Set([FL.GRASS, FL.ASPHALT, FL.SAND, FL.SNOW]);
    for (let cy = 0; cy < G.h; cy++) for (let cx = G.gx; cx < G.gx + G.w; cx++) { // a building below: its roof, not its rooms
      const k = cy * m.W + cx, t = m.tiles[k];
      if (t === T.GROUND || t === T.VOID || (!inRoom[k] && !SOLID.has(t) && OUT_FL.has(m.floor[k]))) continue;
      const v = 92 + hash(cx >> 1, cy >> 1, 5) * 14 | 0; x.fillStyle = `rgb(${v},${v + 2},${v + 6})`;
      x.fillRect((cx - G.gx) * CELL * K, cy * CELL * K, CELL * K + 0.5, CELL * K + 0.5);
    }
    const d = x.getImageData(0, 0, w, h), px = d.data, f = new Float32Array(w * h * 3);
    for (let i = 0, j = 0; i < px.length; i += 4, j += 3) { // dull: most of the colour gone, dark, a little cool
      const l = px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11;
      f[j] = (l + (px[i] - l) * 0.35) * 0.8; f[j + 1] = (l + (px[i + 1] - l) * 0.35) * 0.8; f[j + 2] = (l + (px[i + 2] - l) * 0.35) * 0.8 + 6;
    }
    const blur = (n, step, lines, stride) => { // box blur (radius 1) along one direction of every line
      const tmp = new Float32Array(n * 3);
      for (let L = 0; L < lines; L++) {
        const b = L * stride;
        for (let i = 0; i < n; i++) for (let ch = 0; ch < 3; ch++) {
          let sum = 0, q = 0; for (let o = -1; o <= 1; o++) { const ii = i + o; if (ii >= 0 && ii < n) { sum += f[(b + ii * step) * 3 + ch]; q++; } }
          tmp[i * 3 + ch] = sum / q;
        }
        for (let i = 0; i < n; i++) for (let ch = 0; ch < 3; ch++) f[(b + i * step) * 3 + ch] = tmp[i * 3 + ch];
      }
    };
    for (let r = 0; r < 2; r++) { blur(w, 1, h, w); blur(h, w, w, 1); }
    for (let i = 0, j = 0; i < px.length; i += 4, j += 3) { px[i] = f[j]; px[i + 1] = f[j + 1]; px[i + 2] = f[j + 2]; px[i + 3] = 255; }
    x.putImageData(d, 0, 0);
    // which floor each column belongs to, and what to add to a point there to get the ground under it (-floorOff)
    const col = new Int16Array(m.W).fill(-1), off = [];
    m.floors.forEach((F, i) => { if (i <= gi) return; off[i] = { x: ((F.x0 - F.gx) - (G.x0 - G.gx)) * CELL, y: (F.y0 - G.y0) * CELL }; for (let cx = F.gx; cx < F.gx + F.w && cx < m.W; cx++) col[cx] = i; });
    this.below = { c, K, G, col, off };
  }
  // draw the view far below into world rect (x, y, w, h) of floor fi; the caller clips to where it shows
  drawBelow(ctx, fi, x, y, w, h) {
    const b = this.below, o = b && b.off[fi]; if (!o) return;
    ctx.drawImage(b.c, (x + o.x - b.G.gx * CELL) * b.K, (y + o.y) * b.K, w * b.K, h * b.K, x, y, w, h);
  }
  // run fn once for every piece of the map picture that a world rectangle touches, with this.ctx drawing in world units there
  onTiles(x0, y0, x1, y1, fn) {
    const S = this.S;
    for (const t of this.c.touching(x0 * S, y0 * S, x1 * S, y1 * S)) {
      this.ctx = this.dctx = t.ctx; t.ctx.setTransform(S, 0, 0, S, -t.x, -t.y); fn(t);
    }
  }

  t(x, y) { const m = this.map; return x < 0 || y < 0 || x >= m.W || y >= m.H ? T.HARD : m.tiles[y * m.W + x]; }
  // the solid parts of an angled/curved wall cell, if it is one (and still standing)
  sh(x, y) { const m = this.map; if (!m.shape || x < 0 || y < 0 || x >= m.W || y >= m.H || !SOLID.has(m.tiles[y * m.W + x])) return null; return m.shape[y * m.W + x] || null; }
  // is the cell at (x, y) solid wall all along its side facing (fx, fy)? (sloped cells only where their wall reaches that side)
  solidToward(x, y, fx, fy) {
    const t = this.t(x, y); if (!SOLID.has(t) && t !== T.DSHIELD) return false;
    if (!this.sh(x, y)) return true;
    const side = fy < 0 ? 0 : fx > 0 ? 1 : fy > 0 ? 2 : 3;
    return !!(this.map.shapeSide[y * this.map.W + x] & (1 << side));
  }

  // Floors for a block of cells (the caller has clipped to that block).
  drawFloors(x0, y0, x1, y1) {
    const m = this.map, x = this.ctx;
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      x.fillStyle = this.pat[m.floor[cy * m.W + cx]];
      x.fillRect(cx * CELL, cy * CELL, CELL, CELL);
    }
    // curbs where grass meets paving
    x.fillStyle = 'rgba(190,190,180,0.55)';
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const f = m.floor[cy * m.W + cx];
      if (f === FL.GRASS) continue;
      const g = (dx, dy) => { const nx = cx + dx, ny = cy + dy; return nx >= 0 && ny >= 0 && nx < m.W && ny < m.H && m.floor[ny * m.W + nx] === FL.GRASS && m.tiles[ny * m.W + nx] === T.GROUND; };
      if (m.tiles[cy * m.W + cx] !== T.GROUND) continue;
      if (g(0, -1)) x.fillRect(cx * CELL, cy * CELL, CELL, 1.2);
      if (g(0, 1)) x.fillRect(cx * CELL, cy * CELL + CELL - 1.2, CELL, 1.2);
      if (g(-1, 0)) x.fillRect(cx * CELL, cy * CELL, 1.2, CELL);
      if (g(1, 0)) x.fillRect(cx * CELL + CELL - 1.2, cy * CELL, 1.2, CELL);
    }
    // the map's own painted details (road lines, mats, stains)
    for (const fn of m.decor || []) fn(x);
    // void: open air beside upper floors (the ground far below shows through it: makeBelow), earth around basements
    const B = this.below, airs = new Map();
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const vk = cy * m.W + cx;
      if (m.tiles[vk] !== T.VOID && m.floor[vk] !== FL.VOID) continue;
      x.fillStyle = m.tiles[vk] === T.VOID ? '#07090c' : '#101318'; x.fillRect(cx * CELL, cy * CELL, CELL, CELL);
      const fi = B ? B.col[cx] : -1;
      if (fi > 0 && B.off[fi]) { if (!airs.has(fi)) airs.set(fi, new Path2D()); airs.get(fi).rect(cx * CELL, cy * CELL, CELL, CELL); continue; }
      if (hash(cx, cy, 9) < 0.25) { x.fillStyle = 'rgba(255,255,255,0.025)'; x.fillRect(cx * CELL + hash(cx, cy, 1) * 12, cy * CELL + hash(cx, cy, 2) * 12, 3, 3); }
    }
    for (const [fi, path] of airs) { x.save(); x.clip(path); this.drawBelow(x, fi, x0 * CELL, y0 * CELL, (x1 - x0 + 1) * CELL, (y1 - y0 + 1) * CELL); x.restore(); }
    // sloped wall cells are open on one or both sides: each small patch shows the floor of the nearest plain neighbour
    if (m.shape) for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      if (!m.shape[cy * m.W + cx]) continue;
      const nb = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx, ny = cy + dy; if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= m.W || ny >= m.H) continue;
        const nk = ny * m.W + nx, t = m.tiles[nk];
        if (m.shape[nk] || SOLID.has(t)) continue;
        nb.push([nx, ny, t === T.VOID || m.floor[nk] === FL.VOID ? (t === T.VOID ? '#07090c' : '#101318') : this.pat[m.floor[nk]]]);
      }
      if (!nb.length) continue;
      const n = 8, s = CELL / n;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const px = cx * CELL + (i + 0.5) * s, py = cy * CELL + (j + 0.5) * s;
        let best = null, bd = Infinity;
        for (const b of nb) {
          const qx = Math.max(b[0] * CELL, Math.min(px, b[0] * CELL + CELL)), qy = Math.max(b[1] * CELL, Math.min(py, b[1] * CELL + CELL));
          const d = (px - qx) ** 2 + (py - qy) ** 2; if (d < bd) { bd = d; best = b; }
        }
        x.fillStyle = best[2]; x.fillRect(cx * CELL + i * s, cy * CELL + j * s, s + 0.05, s + 0.05);
      }
    }
    this.drawStairs(x0, y0, x1, y1);
  }

  // Staircases: steps across the direction of travel, darker as they go down, with an arrow.
  drawStairs(x0, y0, x1, y1) {
    const m = this.map, x = this.ctx;
    for (const st of m.stairs || []) for (const [g, up] of [[st.ga, true], [st.gb, false]]) {
      const gx = g % m.W, gy = Math.floor(g / m.W);
      if (gx - 2 > x1 || gy - 2 > y1 || gx + st.w + 2 < x0 || gy + st.h + 2 < y0) continue; // (the label sits just outside the steps)
      const X = gx * CELL, Y = gy * CELL, Wd = st.w * CELL, Hd = st.h * CELL;
      const vert = st.dir === 'n' || st.dir === 's', n = (vert ? st.h : st.w) * 2;
      // step k = 0 at the bottom end
      for (let k = 0; k < n; k++) {
        const f = k / (n - 1), lit = up ? 0.55 + 0.45 * f : 1 - 0.6 * f; // climbing gets lighter; going down gets darker
        const along = (st.dir === 'n' || st.dir === 'w') ? n - 1 - k : k;
        x.fillStyle = `rgba(${Math.round(150 * lit)},${Math.round(148 * lit)},${Math.round(140 * lit)},0.9)`;
        if (vert) x.fillRect(X, Y + along * CELL / 2, Wd, CELL / 2 - 0.8); else x.fillRect(X + along * CELL / 2, Y, CELL / 2 - 0.8, Hd);
        x.fillStyle = 'rgba(0,0,0,0.35)';
        if (vert) x.fillRect(X, Y + along * CELL / 2 + CELL / 2 - 0.8, Wd, 0.8); else x.fillRect(X + along * CELL / 2 + CELL / 2 - 0.8, Y, 0.8, Hd);
      }
      x.strokeStyle = 'rgba(30,30,30,0.9)'; x.lineWidth = 1; x.strokeRect(X + 0.5, Y + 0.5, Wd - 1, Hd - 1);
      // he asked: make it obvious which way stairs go. Chevrons all along the steps point the way you walk to change
      // floor (gold going up, blue going down), a coloured strip marks the end you step on from, and a label at each
      // end says where it takes you ("▲ UP TO 2F" / "▼ DOWN TO 1F").
      const ang = { n: -Math.PI / 2, s: Math.PI / 2, e: 0, w: Math.PI }[st.dir] + (up ? 0 : Math.PI);
      const col = up ? '242,193,78' : '110,175,255', len = vert ? Hd : Wd, wid = vert ? Wd : Hd;
      x.save(); x.translate(X + Wd / 2, Y + Hd / 2); x.rotate(ang);
      const g2 = x.createLinearGradient(-len / 2, 0, -len / 2 + CELL * 0.9, 0); g2.addColorStop(0, `rgba(${col},0.55)`); g2.addColorStop(1, `rgba(${col},0)`);
      x.fillStyle = g2; x.fillRect(-len / 2, -wid / 2, CELL * 0.9, wid); // the way on
      const cw = Math.min(5.5, wid * 0.28);
      for (let a = -len / 2 + CELL * 0.75; a <= len / 2 - CELL * 0.4; a += CELL * 0.85) {
        x.strokeStyle = 'rgba(0,0,0,0.55)'; x.lineWidth = 3.2; x.lineJoin = 'round'; x.lineCap = 'round';
        x.beginPath(); x.moveTo(a - cw * 0.75, -cw); x.lineTo(a, 0); x.lineTo(a - cw * 0.75, cw); x.stroke();
        x.strokeStyle = `rgba(${col},0.95)`; x.lineWidth = 1.7;
        x.beginPath(); x.moveTo(a - cw * 0.75, -cw); x.lineTo(a, 0); x.lineTo(a - cw * 0.75, cw); x.stroke();
      }
      x.restore();
      const label = up ? '▲ UP TO ' + m.floors[st.b].name : '▼ DOWN TO ' + m.floors[st.a].name;
      const [ux, uy] = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[st.dir].map(v => v * (up ? 1 : -1));
      const lx = X + Wd / 2 - ux * (len / 2 + 6), ly = Y + Hd / 2 - uy * (len / 2 + 6); // just before the way on
      x.save(); x.font = '800 8px Barlow Condensed, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      const tw = x.measureText(label).width + 6;
      x.fillStyle = 'rgba(10,12,16,0.72)'; x.fillRect(lx - tw / 2, ly - 5.5, tw, 11);
      x.fillStyle = `rgba(${col},1)`; x.fillText(label, lx, ly + 0.5);
      x.restore();
    }
  }

  // Redraw a block of cells (inclusive), clipped so neighbours are untouched.
  region(x0, y0, x1, y1) {
    const m = this.map;
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(m.W - 1, x1); y1 = Math.min(m.H - 1, y1);
    const X = x0 * CELL, Y = y0 * CELL, Wd = (x1 - x0 + 1) * CELL, Hd = (y1 - y0 + 1) * CELL, P = this.S * CELL;
    this.onTiles(X, Y, X + Wd, Y + Hd, t => this.regionPart( // only the cells over this piece
      Math.max(x0, Math.floor(t.x / P)), Math.max(y0, Math.floor(t.y / P)), Math.min(x1, Math.floor((t.x + t.w - 1) / P)), Math.min(y1, Math.floor((t.y + t.h - 1) / P))));
  }
  regionPart(x0, y0, x1, y1) {
    const m = this.map, ctx = this.ctx;
    const X = x0 * CELL, Y = y0 * CELL, Wd = (x1 - x0 + 1) * CELL, Hd = (y1 - y0 + 1) * CELL;
    ctx.save();
    ctx.beginPath(); ctx.rect(X, Y, Wd, Hd); ctx.clip();
    this.drawFloors(x0, y0, x1, y1);
    const ex0 = x0 - 2, ey0 = y0 - 2, ex1 = x1 + 2, ey1 = y1 + 2;
    // splinters where a barricade was smashed (cell went from barricade back to open)
    for (let y = ey0; y <= ey1; y++) for (let x = ex0; x <= ex1; x++) {
      if (x < 0 || y < 0 || x >= m.W || y >= m.H) continue;
      const k = y * m.W + x;
      if (this.splinters && this.splinters.has(k)) for (let i = 0; i < 7; i++) {
        ctx.save(); ctx.translate(x * CELL + hash(x, y, i + 70) * CELL, y * CELL + hash(y, x, i + 70) * CELL); ctx.rotate(hash(i, x, y + 3) * 6);
        ctx.fillStyle = shade('#9a6a3a', 0.7 + hash(x, y, i) * 0.4); ctx.fillRect(-2.5, -0.4, 5, 0.9); ctx.restore();
      }
    }
    // rubble where walls used to be
    for (let y = ey0; y <= ey1; y++) for (let x = ex0; x <= ex1; x++) {
      if (x < 0 || y < 0 || x >= m.W || y >= m.H) continue;
      const k = y * m.W + x, b = this.base[k], t = m.tiles[k];
      if ((b === T.SOFT || b === T.HARD) && (t === T.FLOOR || t === T.GROUND || t === T.OPEN || t === T.RUBBLE)) this.rubble(x, y, m.mat[k]);
    }
    // soft contact shadows on the floor beside walls
    for (let y = ey0; y <= ey1; y++) for (let x = ex0; x <= ex1; x++) {
      const t = this.t(x, y);
      if (!SOLID.has(t) && t !== T.TALL) continue;
      const X0 = x * CELL, Y0 = y * CELL, sh = this.sh(x, y);
      if (sh) { // a sloped or curved wall casts its own shape
        for (const [ox, oy, a] of [[1, 2, 0.26], [2.5, 4.5, 0.12]]) {
          ctx.fillStyle = `rgba(0,0,0,${a})`;
          for (const P of sh) { ctx.beginPath(); for (let i = 0; i < P.length; i += 2) ctx.lineTo(P[i] + ox, P[i + 1] + oy); ctx.fill(); }
        }
        continue;
      }
      if (!this.solidToward(x, y + 1, 0, -1) && this.t(x, y + 1) !== T.TALL) {
        ctx.fillStyle = 'rgba(0,0,0,0.30)'; ctx.fillRect(X0 + 1, Y0 + CELL, CELL, 2.5);
        ctx.fillStyle = 'rgba(0,0,0,0.13)'; ctx.fillRect(X0 + 2, Y0 + CELL + 2.5, CELL, 3);
      }
      if (!this.solidToward(x + 1, y, -1, 0) && this.t(x + 1, y) !== T.TALL) {
        ctx.fillStyle = 'rgba(0,0,0,0.24)'; ctx.fillRect(X0 + CELL, Y0 + 1, 2, CELL);
        ctx.fillStyle = 'rgba(0,0,0,0.10)'; ctx.fillRect(X0 + CELL + 2, Y0 + 2, 2.5, CELL);
      }
      if (t === T.TALL) continue;
      if (!this.solidToward(x, y - 1, 0, 1)) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(X0, Y0 - 2, CELL, 2); }
      if (!this.solidToward(x - 1, y, 1, 0)) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(X0 - 2, Y0, 2, CELL); }
    }
    for (const p of m.props) {
      if (p.x > ex1 || p.y > ey1 || p.x + p.w < ex0 || p.y + p.h < ey0) continue;
      drawProp(ctx, p, m);
    }
    for (let y = ey0; y <= ey1; y++) for (let x = ex0; x <= ex1; x++) {
      if (x < 0 || y < 0 || x >= m.W || y >= m.H) continue;
      const k = y * m.W + x, t = m.tiles[k];
      if (m.openId[k] >= 0 || t === T.OPEN || t === T.BARRI || t === T.PANEL || t === T.BEAM) this.opening(x, y, k);
      if (SOLID.has(t) || t === T.DSHIELD) this.wall(x, y, k, t);
      if (t === T.RUBBLE) this.stub(x, y, k);
      if (m.hatchAt && (m.hatchAt[k] >= 0 || m.hatchBelow[k] >= 0) && x >= x0 && x <= x1 && y >= y0 && y <= y1) this.hatchCell(x, y, k);
    }
    ctx.restore();
  }
  // Changed cells are redrawn a little at a time, nearest to the camera first, so seeing a whole
  // fortified room at once (or arriving on another floor) never stalls a frame.
  process(budgetMs, wx, wy) {
    const P = this.pending, t0 = performance.now(), W = this.map.W, cx = wx / CELL, cy = wy / CELL;
    while (P && P.size && performance.now() - t0 < budgetMs) {
      let best = -1, bd = Infinity;
      for (const k of P) { const d = Math.abs(k % W - cx) + Math.abs(Math.floor(k / W) - cy); if (d < bd) { bd = d; best = k; } }
      const bx = best % W, by = Math.floor(best / W);
      let x0 = bx, y0 = by, x1 = bx, y1 = by;
      for (const k of [...P]) { // everything pending in the block around it goes in the same redraw
        const x = k % W, y = Math.floor(k / W);
        if (Math.abs(x - bx) > 5 || Math.abs(y - by) > 5) continue;
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); P.delete(k);
      }
      this.region(x0 - 1, y0 - 1, x1 + 1, y1 + 1);
    }
  }

  // The map is shown by the browser itself as a stack of tiles that it moves and scales on the
  // graphics card, so the game never copies the whole picture each frame. Changed spots are
  // copied into the tiles once per frame (flush).
  mount(el) {
    el.textContent = '';
    for (const t of this.c.tiles) { t.c.style.cssText = `position:absolute;left:${t.x}px;top:${t.y}px;width:${t.w}px;height:${t.h}px`; el.appendChild(t.c); }
  }
  mark() {} // (the pieces shown are the ones drawn into)
  flush() {}

  cellChanged(k) { (this.pending || (this.pending = new Set())).add(k); } // drawn by process()

  // the waist-high stub of a soft wall knocked through (T.RUBBLE): a broken edge with the studs showing, rubble round it
  stub(x, y, k) {
    const ctx = this.ctx, X = x * CELL, Y = y * CELL, m = this.map, mat = m.mat[k];
    const col = mat === MAT.BRICK ? '#9a5a42' : '#d6d0c2';
    const horiz = SOLID.has(this.t(x - 1, y)) || SOLID.has(this.t(x + 1, y)) || this.t(x - 1, y) === T.RUBBLE || this.t(x + 1, y) === T.RUBBLE;
    ctx.save(); ctx.translate(X + CELL / 2, Y + CELL / 2); if (!horiz) ctx.rotate(Math.PI / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-CELL / 2, -3, CELL, 7.5);
    ctx.fillStyle = shade(col, 0.82); ctx.beginPath(); ctx.moveTo(-CELL / 2, -3.5);
    for (let i = 0; i <= 6; i++) ctx.lineTo(-CELL / 2 + i * CELL / 6, -3.5 + (hash(x, y, i) - 0.5) * 2.4);
    ctx.lineTo(CELL / 2, 3.5); ctx.lineTo(-CELL / 2, 3.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-CELL / 2, -1, CELL, 1);
    if (mat !== MAT.BRICK) { ctx.fillStyle = '#8f949a'; ctx.fillRect(-1, -3, 1.4, 6.5); ctx.fillRect(-CELL / 2 + 1, -3, 1.2, 6.5); }
    ctx.restore();
  }
  rubble(x, y, mat) {
    const ctx = this.ctx, X = x * CELL, Y = y * CELL;
    const col = mat === MAT.BRICK ? '#8a4a36' : mat === MAT.CONCRETE ? '#7b8086' : '#cfc9bb';
    ctx.fillStyle = 'rgba(200,195,180,0.18)'; ctx.fillRect(X - 3, Y - 3, CELL + 6, CELL + 6);
    for (let i = 0; i < 14; i++) {
      const rx = X + hash(x, y, i) * CELL, ry = Y + hash(y, x, i + 7) * CELL, s = 0.8 + hash(x + i, y, 3) * 2.6;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(rx + 0.6, ry + 0.8, s, s * 0.8);
      ctx.fillStyle = shade(col.length === 7 ? col : '#cfc9bb', 0.75 + hash(i, x, y) * 0.4); ctx.fillRect(rx, ry, s, s * 0.8);
    }
    if (mat !== MAT.CONCRETE) { // a bent stud or two
      ctx.strokeStyle = '#8f949a'; ctx.lineWidth = 0.8; ctx.beginPath();
      ctx.moveTo(X + 3, Y + hash(x, y, 9) * CELL); ctx.lineTo(X + CELL - 4, Y + hash(x, y, 10) * CELL); ctx.stroke();
    }
  }

  opening(x, y, k) {
    const ctx = this.ctx, m = this.map, X = x * CELL, Y = y * CELL, t = m.tiles[k];
    const o = m.openings[m.openId[k]];
    const horiz = WALLISH.has(this.t(x - 1, y)) || WALLISH.has(this.t(x + 1, y)) || this.t(x - 1, y) === T.OPEN || this.t(x + 1, y) === T.OPEN;
    // threshold
    ctx.fillStyle = o && o.kind === 'window' ? '#5a5248' : 'rgba(70,60,50,0.55)';
    if (horiz) ctx.fillRect(X, Y + 5, CELL, 6); else ctx.fillRect(X + 5, Y, 6, CELL);
    if (o && o.kind === 'window') { // broken glass scattered in and around the window
      for (let i = 0; i < 26; i++) {
        const sx = X + (hash(x, y, i) - 0.5) * (horiz ? 18 : 44) + 8, sy = Y + (hash(y, x, i) - 0.5) * (horiz ? 44 : 18) + 8;
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(hash(i, x, y) * 6);
        ctx.fillStyle = `rgba(${190 + hash(x, i, y) * 50 | 0},225,240,${0.35 + hash(y, i, x) * 0.4})`;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1.4 + hash(i, y, x) * 1.6, 0.4); ctx.lineTo(0.5, 1.2); ctx.fill();
        ctx.restore();
      }
    }
    // frame posts next to solid wall
    ctx.fillStyle = '#3b3530';
    if (horiz) { if (SOLID.has(this.t(x - 1, y))) ctx.fillRect(X, Y + 3, 1.6, 10); if (SOLID.has(this.t(x + 1, y))) ctx.fillRect(X + CELL - 1.6, Y + 3, 1.6, 10); }
    else { if (SOLID.has(this.t(x, y - 1))) ctx.fillRect(X + 3, Y, 10, 1.6); if (SOLID.has(this.t(x, y + 1))) ctx.fillRect(X + 3, Y + CELL - 1.6, 10, 1.6); }
    if (t === T.BARRI) {
      const hpF = m.hp[k] / CELL_HP[T.BARRI];
      // he asked: each melee hit cracks the boards more, the third breaks them. 0 = whole, 1 = cracked, 2 = splitting
      const stage = hpF > 0.95 ? 0 : hpF > 0.5 ? 1 : 2;
      for (let i = 0; i < 3; i++) {
        if (stage === 2 && i === 1) { // the middle plank snapped in two, the halves sagging apart
          ctx.save(); ctx.translate(X + CELL / 2, Y + CELL / 2); ctx.rotate(horiz ? 0 : Math.PI / 2);
          for (const sd of [-1, 1]) { ctx.save(); ctx.translate(sd * 5.5, 0); ctx.rotate(sd * 0.16);
            ctx.fillStyle = shade('#9a6a3a', 0.8); ctx.fillRect(-4, -1.6, 8, 3.2);
            ctx.fillStyle = '#e0bc86'; for (let j = 0; j < 3; j++) ctx.fillRect(sd < 0 ? 3.6 : -4.4, -1.6 + j * 1.1 + hash(x, y, j) * 0.3, 0.8 + hash(j, x, y) * 0.8, 0.7); // raw splintered ends
            ctx.restore(); }
          ctx.restore(); continue;
        }
        ctx.save();
        ctx.translate(X + CELL / 2, Y + CELL / 2);
        ctx.rotate((horiz ? 0 : Math.PI / 2) + (i - 1) * 0.35 + (hash(x, y, i) - 0.5) * 0.15);
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-9, -1.6 + (i - 1) * 3.3 + 0.8, 18, 3.2);
        ctx.fillStyle = shade('#9a6a3a', 0.85 + hash(i, x, y) * 0.3); ctx.fillRect(-9.5, -1.6 + (i - 1) * 3.3, 19, 3.2);
        ctx.fillStyle = 'rgba(60,35,15,0.6)'; ctx.fillRect(-9.5, -1.6 + (i - 1) * 3.3 + 2.6, 19, 0.6);
        ctx.fillStyle = '#c9c9c9'; ctx.fillRect(-7, -0.6 + (i - 1) * 3.3, 0.9, 0.9); ctx.fillRect(6, -0.6 + (i - 1) * 3.3, 0.9, 0.9);
        ctx.restore();
      }
      if (stage) { // cracks running out from where the hits landed: short after one hit, long and branching after two
        const cx = X + CELL / 2 + (hash(x, y, 91) - 0.5) * 4, cy = Y + CELL / 2 + (hash(y, x, 92) - 0.5) * 4;
        const n = stage === 1 ? 3 : 6, len = stage === 1 ? 5 : 10;
        const crack = (sx, sy, a, L, seed, depth) => {
          const pts = [[sx, sy]]; let px = sx, py = sy;
          for (let j = 1; j <= 4; j++) { const aa = a + (hash(seed, j, x + y) - 0.5) * 0.9; px += Math.cos(aa) * L / 4; py += Math.sin(aa) * L / 4; pts.push([px, py]); }
          for (const [col, w, o] of [['rgba(232,196,140,0.55)', 0.9, 0.5], ['rgba(28,15,6,0.9)', 0.55, 0]]) { // a pale splinter edge under a dark split
            ctx.strokeStyle = col; ctx.lineWidth = w * (depth ? 0.8 : 1); ctx.beginPath(); ctx.moveTo(pts[0][0] + o, pts[0][1] + o); for (const [qx, qy] of pts.slice(1)) ctx.lineTo(qx + o, qy + o); ctx.stroke(); }
          if (stage === 2 && !depth) crack(pts[2][0], pts[2][1], a + (hash(seed, 7, y) > 0.5 ? 0.7 : -0.7), L * 0.5, seed + 13, 1); // branches
        };
        { const r = horiz ? 0 : Math.PI / 2; ctx.save(); ctx.translate(X + CELL / 2, Y + CELL / 2); ctx.rotate(r); ctx.beginPath(); ctx.rect(-CELL / 2, -5.6, CELL, 11.2); ctx.clip(); ctx.rotate(-r); ctx.translate(-X - CELL / 2, -Y - CELL / 2); } // only on the boards
        for (let i = 0; i < n; i++) crack(cx, cy, i / n * Math.PI * 2 + hash(x, i, y) * 0.8, len * (0.7 + hash(i, x, y) * 0.6), i * 31 + x, 0);
        if (stage === 2) { ctx.fillStyle = '#140b05'; ctx.beginPath(); ctx.ellipse(cx, cy, 1.9, 1.3, hash(x, y, 5) * 3, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,230,180,0.35)'; ctx.beginPath(); ctx.arc(cx, cy, 0.6, 0, 7); ctx.fill(); } // a punched-in dent
        ctx.restore();
      }
      const holes = m.holes && m.holes[k]; // bullet holes: pins of light you can look and shoot through
      // the board's three stages (he asked): server barriStage leaves a cross of points round the middle, drawn here as one ragged hole
      const mx = X + CELL / 2, my = Y + CELL / 2; let smash = 0;
      if (holes) for (let i = 0; i < holes.length; i += 2) { const dx = holes[i] - mx, dy = holes[i + 1] - my; if (Math.abs(dx) < 0.11 && Math.abs(dy) >= 3.5 && Math.abs(dy) <= 6.5 || Math.abs(dy) < 0.11 && Math.abs(dx) >= 3.5 && Math.abs(dx) <= 6.5) smash = 2; else if (!smash && Math.abs(dx) < 0.11 && Math.abs(dy) < 0.11) smash = 1; }
      if (smash) {
        ctx.save(); ctx.translate(mx, my); if (!horiz) ctx.rotate(Math.PI / 2);
        const rx = smash === 2 ? 7.6 : 3.8, ry = smash === 2 ? 6.2 : 5.2, N = 12;
        const ragged = g => { ctx.beginPath(); for (let i = 0; i < N; i++) { const a = i / N * 6.283, r = 0.78 + hash(x + i, y, 40 + smash) * 0.4; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rx * r * g, Math.sin(a) * ry * r * g); } ctx.closePath(); };
        ctx.fillStyle = '#e0bc86'; ragged(1.12); ctx.fill(); // pale torn wood round the edge
        ctx.fillStyle = '#0d0805'; ragged(1); ctx.fill();
        ctx.fillStyle = 'rgba(255,230,180,0.14)'; ragged(0.55); ctx.fill(); // a little light through it
        ctx.restore();
      }
      if (holes) for (let i = 0; i < holes.length; i += 2) {
        if (smash && (Math.abs(holes[i] - mx) < 0.11 || Math.abs(holes[i + 1] - my) < 0.11)) continue;
        ctx.fillStyle = 'rgba(255,230,180,0.25)'; ctx.beginPath(); ctx.arc(holes[i], holes[i + 1], 1.8, 0, 7); ctx.fill();
        ctx.fillStyle = '#120c06'; ctx.beginPath(); ctx.arc(holes[i], holes[i + 1], 1.2, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,236,190,0.6)'; ctx.beginPath(); ctx.arc(holes[i], holes[i + 1], 0.45, 0, 7); ctx.fill();
      }
    }
    if (t === T.BEAM) { // GIRDER's steel brace: an open lattice of steel beams, see-through
      ctx.save(); ctx.translate(X + CELL / 2, Y + CELL / 2); if (!horiz) ctx.rotate(Math.PI / 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(-8, -5); ctx.lineTo(8, 5); ctx.moveTo(-8, 5); ctx.lineTo(8, -5); ctx.stroke();
      ctx.strokeStyle = '#7a828c'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(-8, -5); ctx.lineTo(8, 5); ctx.moveTo(-8, 5); ctx.lineTo(8, -5); ctx.stroke();
      ctx.fillStyle = '#5a626b'; ctx.fillRect(-8, -5.6, 16, 1.6); ctx.fillRect(-8, 4, 16, 1.6);
      ctx.fillStyle = '#d9b02a'; ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
    }
    if (t === T.PANEL) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; if (horiz) ctx.fillRect(X, Y + 5.5, CELL, 7); else ctx.fillRect(X + 5.5, Y, 7, CELL);
      ctx.fillStyle = '#4a525b'; if (horiz) ctx.fillRect(X, Y + 4, CELL, 7); else ctx.fillRect(X + 4, Y, 7, CELL);
      ctx.fillStyle = '#d9b02a';
      for (let i = 0; i < 4; i++) { if (horiz) ctx.fillRect(X + i * 4 + 0.5, Y + 4, 2, 1.2); else ctx.fillRect(X + 4, Y + i * 4 + 0.5, 1.2, 2); }
      ctx.fillStyle = '#9aa3ac'; if (horiz) { ctx.fillRect(X + 2, Y + 8.5, 1, 1); ctx.fillRect(X + 13, Y + 8.5, 1, 1); } else { ctx.fillRect(X + 8.5, Y + 2, 1, 1); ctx.fillRect(X + 8.5, Y + 13, 1, 1); }
    }
  }

  wall(x, y, k, t) {
    const sh = this.sh(x, y);
    if (sh) { // angled or curved: draw the plain wall clipped to its solid part, then light its sloped faces
      const ctx = this.ctx; ctx.save(); ctx.beginPath();
      for (const P of sh) { ctx.moveTo(P[0], P[1]); for (let i = 2; i < P.length; i += 2) ctx.lineTo(P[i], P[i + 1]); ctx.closePath(); }
      ctx.clip(); this.wallFill(x, y, k, t, true); ctx.restore();
      this.slopeEdges(x, y, sh, t, k);
      return;
    }
    this.wallFill(x, y, k, t);
  }
  solidAt(px, py) {
    const cx = Math.floor(px / CELL), cy = Math.floor(py / CELL), t = this.t(cx, cy);
    if (!SOLID.has(t)) return false;
    const sh = this.sh(cx, cy);
    return !sh || sh.some(P => polyIn(P, px, py));
  }
  slopeEdges(x, y, sh, t, k) {
    const ctx = this.ctx, X = x * CELL, Y = y * CELL, on = v => Math.abs(v) < 0.05 || Math.abs(v - CELL) < 0.05;
    const top = t === T.HARD ? (this.map.mat[k] === MAT.DRYWALL ? '#c4bdaf' : '#7a7f85') : t === T.REINF ? '#59626c' : this.map.mat[k] === MAT.BRICK ? '#93503b' : '#d8d2c4';
    ctx.lineCap = 'round';
    for (const P of sh) for (let i = 0; i < P.length; i += 2) {
      const ax = P[i], ay = P[i + 1], bx = P[(i + 2) % P.length], by = P[(i + 3) % P.length];
      if ((on(ax - X) && on(bx - X) && Math.abs(ax - bx) < 0.05) || (on(ay - Y) && on(by - Y) && Math.abs(ay - by) < 0.05)) continue; // lies on the cell's own side
      const ex = bx - ax, ey = by - ay, l = Math.hypot(ex, ey); if (l < 0.2) continue;
      const nx = ey / l, ny = -ex / l;
      if (this.solidAt((ax + bx) / 2 + nx * 0.4, (ay + by) / 2 + ny * 0.4)) continue; // an inside seam between two pieces, not a face
      const lit = -(nx * 0.55 + ny * 0.83); // light comes from the top-left
      if (lit > 0) { ctx.strokeStyle = `rgba(255,255,255,${0.12 + lit * 0.2})`; ctx.lineWidth = 0.9; }
      else { ctx.strokeStyle = shade(top, 0.55); ctx.lineWidth = 1 + -lit * 2.2; }
      const ix = -nx * ctx.lineWidth / 2, iy = -ny * ctx.lineWidth / 2; // keep the band inside the wall
      ctx.beginPath(); ctx.moveTo(ax + ix, ay + iy); ctx.lineTo(bx + ix, by + iy); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }
  }
  wallFill(x, y, k, t, sloped = false) {
    const ctx = this.ctx, m = this.map, X = x * CELL, Y = y * CELL, mat = m.mat[k];
    let top;
    if (t === T.HARD) top = mat === MAT.DRYWALL ? '#c4bdaf' : '#7a7f85'; // plastered structure (rounded corners) or bare concrete
    else if (t === T.REINF) top = '#59626c';
    else if (t === T.PANEL) top = '#3e454d';
    else if (t === T.DSHIELD) top = '#2b3036';
    else top = mat === MAT.BRICK ? '#93503b' : '#d8d2c4';
    ctx.fillStyle = top; ctx.fillRect(X, Y, CELL, CELL);
    const s = (dx, dy) => this.solidToward(x + dx, y + dy, -dx, -dy);
    if (t === T.SOFT && mat === MAT.BRICK) {
      ctx.fillStyle = 'rgba(210,190,160,0.45)';
      for (let r = 0; r < 4; r++) {
        ctx.fillRect(X, Y + r * 4, CELL, 0.5);
        const off = (r + y) % 2 ? 0 : 3;
        for (let c = off; c < CELL; c += 6) ctx.fillRect(X + c, Y + r * 4, 0.5, 4);
      }
      for (let i = 0; i < 6; i++) { ctx.fillStyle = `rgba(${hash(x, y, i) < 0.5 ? '40,10,5' : '255,200,170'},0.12)`; ctx.fillRect(X + hash(x, i, y) * 14, Y + hash(i, y, x) * 14, 2.5, 1.5); }
    } else if (t === T.SOFT) {
      const horiz = s(-1, 0) || s(1, 0);
      ctx.fillStyle = 'rgba(120,110,95,0.35)';
      if (horiz && !(s(0, -1) && s(0, 1))) ctx.fillRect(X, Y + 7.5, CELL, 1); else ctx.fillRect(X + 7.5, Y, 1, CELL);
    } else if (t === T.HARD) {
      for (let i = 0; i < 10; i++) { ctx.fillStyle = hash(x, y, i) < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.10)'; ctx.fillRect(X + hash(x, i, y) * 15, Y + hash(i, y, x) * 15, 1.2, 1.2); }
    } else if (t === T.REINF) {
      ctx.strokeStyle = '#7d8894'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X + CELL, Y + CELL); ctx.moveTo(X + CELL, Y); ctx.lineTo(X, Y + CELL); ctx.stroke();
      ctx.fillStyle = '#a7b0b9';
      for (const [rx, ry] of [[2, 2], [13, 2], [2, 13], [13, 13]]) ctx.fillRect(X + rx, Y + ry, 1.2, 1.2);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(X, Y + 7, CELL, 2);
    } else if (t === T.PANEL) {
      ctx.fillStyle = '#d9b02a'; for (let i = 0; i < 4; i++) ctx.fillRect(X + i * 4, Y, 2, 1.5);
    } else if (t === T.DSHIELD) {
      ctx.fillStyle = '#59626b'; ctx.fillRect(X, Y, CELL, 2); ctx.fillRect(X, Y + CELL - 2, CELL, 2);
      ctx.fillStyle = '#7fb6d6'; ctx.fillRect(X + 4, Y + 6.5, 8, 2.5);
    }
    // a drone hole: a small dark gap through the foot of the wall, with a lit rim
    if ((t === T.SOFT || t === T.HARD) && m.dhole && m.dhole[k]) {
      const horiz = s(-1, 0) || s(1, 0); // wall runs left-right, so the hole goes up-down through it
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      if (horiz) ctx.fillRect(X + 3.5, Y, 9, CELL); else ctx.fillRect(X, Y + 3.5, CELL, 9);
      ctx.fillStyle = '#17140f';
      if (horiz) ctx.fillRect(X + 4.5, Y, 7, CELL); else ctx.fillRect(X, Y + 4.5, CELL, 7);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      if (horiz) ctx.fillRect(X + 4.5, Y, 1.5, CELL); else ctx.fillRect(X, Y + 4.5, CELL, 1.5);
    }
    // bullet holes from rifles, SMGs and pistols: tiny dark pits with a pin of light through them
    const holes = (t === T.SOFT || t === T.HARD || t === T.REINF || t === T.PANEL) && m.holes && m.holes[k]; // RIVET's lance burns through any wall
    if (holes) for (let i = 0; i < holes.length; i += 2) {
      const hx = holes[i], hy = holes[i + 1];
      ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.arc(hx, hy, 1.9, 0, 7); ctx.fill();
      ctx.fillStyle = '#15120f'; ctx.beginPath(); ctx.arc(hx, hy, 1.25, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,236,190,0.55)'; ctx.beginPath(); ctx.arc(hx, hy, 0.45, 0, 7); ctx.fill();
    }
    // damage: bullet holes and cracks
    if ((t === T.SOFT || t === T.DSHIELD) && m.hp[k] < CELL_HP[t]) {
      const lost = 1 - m.hp[k] / CELL_HP[t], n = 1 + Math.floor(lost * 8);
      for (let i = 0; i < n; i++) {
        const hx = X + 2 + hash(x, y, i + 20) * 12, hy = Y + 2 + hash(y, x, i + 30) * 12, r = 0.8 + hash(i, x, y) * 1.2;
        ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(hx, hy, r + 0.8, 0, 7); ctx.fill();
        ctx.fillStyle = '#1a1714'; ctx.beginPath(); ctx.arc(hx, hy, r, 0, 7); ctx.fill();
      }
      if (lost > 0.5) {
        ctx.strokeStyle = 'rgba(40,30,25,0.6)'; ctx.lineWidth = 0.5; ctx.beginPath();
        for (let i = 0; i < 3; i++) { const sx = X + hash(x, y, i + 50) * 16, sy = Y + hash(y, x, i + 60) * 16; ctx.moveTo(sx, sy); ctx.lineTo(sx + (hash(i, y, x) - 0.5) * 12, sy + (hash(x, i, y) - 0.5) * 12); }
        ctx.stroke();
      }
    }
    if (sloped) return; // sloped cells get their edges from slopeEdges
    // raised-edge shading
    const dark = shade(t === T.SOFT && mat !== MAT.BRICK ? '#d8d2c4' : top.startsWith('#') ? top : '#888888', 0.55);
    if (!s(0, 1)) { ctx.fillStyle = dark; ctx.fillRect(X, Y + CELL - 3, CELL, 3); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(X, Y + CELL - 0.6, CELL, 0.6); }
    if (!s(0, -1)) { ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(X, Y, CELL, 0.9); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(X, Y, CELL, 0.4); }
    if (!s(-1, 0)) { ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(X, Y, 0.9, CELL); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(X, Y, 0.4, CELL); }
    if (!s(1, 0)) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(X + CELL - 1.4, Y, 1.4, CELL); }
  }

  // ---- decals (blood, scorch marks) ----
  // cells under blood and scorch marks, so the next round on this map can wipe just those
  decalAt(x0, y0, x1, y1) {
    const W = this.map.W, D = this.decalCells || (this.decalCells = new Set());
    for (let y = Math.floor(y0 / CELL); y <= Math.floor(y1 / CELL); y++) for (let x = Math.floor(x0 / CELL); x <= Math.floor(x1 / CELL); x++) D.add(y * W + x);
  }
  blood(x, y, ang) {
    this.decalAt(x - 13, y - 13, x + 13, y + 13);
    const dots = []; for (let i = 0; i < 7; i++) { const r = Math.random() * 10, a = ang + (Math.random() - 0.5) * 0.9; dots.push([`rgba(${90 + Math.random() * 40},8,8,${0.35 + Math.random() * 0.35})`, x + Math.cos(a) * r, y + Math.sin(a) * r, 0.6 + Math.random() * 1.8]); }
    this.onTiles(x - 13, y - 13, x + 13, y + 13, () => { const d = this.dctx; for (const [c, px, py, rr] of dots) { d.fillStyle = c; d.beginPath(); d.arc(px, py, rr, 0, 7); d.fill(); } });
  }
  pool(x, y) {
    this.decalAt(x - 15, y - 15, x + 15, y + 15);
    const rot = Math.random() * 3;
    this.onTiles(x - 15, y - 15, x + 15, y + 15, () => {
      const d = this.dctx, g = d.createRadialGradient(x, y, 0, x, y, 14);
      g.addColorStop(0, 'rgba(110,8,8,0.75)'); g.addColorStop(0.7, 'rgba(90,5,5,0.55)'); g.addColorStop(1, 'rgba(80,5,5,0)');
      d.fillStyle = g; d.beginPath(); d.ellipse(x, y, 14, 11, rot, 0, 7); d.fill();
    });
  }
  // A floor hatch (2x2 cells; each cell draws its quarter, clipped). Shut: a framed wooden trapdoor; reinforced: a riveted
  // steel plate over it; open: a splintered black hole. Under an open hatch, light and debris on the floor below.
  hatchCell(x, y, k) {
    const m = this.map, ctx = this.ctx, up = m.hatchAt[k] >= 0, h = m.hatches[up ? m.hatchAt[k] : m.hatchBelow[k]];
    const t = m.tiles[h.cells[0]], X = (up ? h.x : h.bx) - CELL, Y = (up ? h.y : h.by) - CELL, D = CELL * 2, r = (i) => hash(h.id, i, 91);
    if (!up && t !== T.HOLE) return;
    ctx.save(); ctx.beginPath(); ctx.rect(x * CELL, y * CELL, CELL, CELL); ctx.clip();
    if (!up) { // light falling through, and bits of the broken hatch
      const g = ctx.createRadialGradient(X + D / 2, Y + D / 2, 2, X + D / 2, Y + D / 2, D * 0.75);
      g.addColorStop(0, 'rgba(255,240,205,0.16)'); g.addColorStop(1, 'rgba(255,240,205,0)');
      ctx.fillStyle = g; ctx.fillRect(X - 8, Y - 8, D + 16, D + 16);
      for (let i = 0; i < 14; i++) {
        ctx.save(); ctx.translate(X + r(i) * D, Y + r(i + 30) * D); ctx.rotate(r(i + 60) * 6);
        ctx.fillStyle = shade(i % 3 ? '#6b5236' : '#3d3f44', 0.75 + r(i + 90) * 0.4); ctx.fillRect(-2, -0.5, 3 + r(i + 5) * 3, 1.1); ctx.restore();
      }
      ctx.restore(); return;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(X + 1, Y + 1.5, D, D); // the frame's shadow
    ctx.fillStyle = '#2b2d31'; ctx.fillRect(X, Y, D, D);                       // steel frame
    if (t === T.HOLE) {
      const g = ctx.createRadialGradient(X + D / 2, Y + D / 2, 2, X + D / 2, Y + D / 2, D * 0.7);
      g.addColorStop(0, '#0a0b0d'); g.addColorStop(1, '#16181b');
      ctx.fillStyle = g; ctx.fillRect(X + 2, Y + 2, D - 4, D - 4);
      ctx.fillStyle = '#6b5236'; // splintered plank stubs round the edge
      for (let i = 0; i < 10; i++) {
        const s = i % 4, u = 3 + r(i) * (D - 6), l = 2 + r(i + 20) * 5;
        if (s === 0) ctx.fillRect(X + u, Y + 2, 1.6, l); else if (s === 1) ctx.fillRect(X + D - 2 - l, Y + u, l, 1.6);
        else if (s === 2) ctx.fillRect(X + u, Y + D - 2 - l, 1.6, l); else ctx.fillRect(X + 2, Y + u, l, 1.6);
      }
    } else {
      for (let i = 0; i < 4; i++) { ctx.fillStyle = shade('#7a5c3c', 0.85 + r(i) * 0.25); ctx.fillRect(X + 2, Y + 2 + i * (D - 4) / 4, D - 4, (D - 4) / 4 - 0.6); }
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; for (let i = 1; i < 4; i++) ctx.fillRect(X + 2, Y + 2 + i * (D - 4) / 4 - 0.6, D - 4, 0.6);
      ctx.fillStyle = '#1b1c1f'; ctx.fillRect(X + 5, Y + 2, 3, 2); ctx.fillRect(X + D - 8, Y + 2, 3, 2); // hinges
      ctx.fillStyle = '#9aa0a6'; ctx.fillRect(X + D / 2 - 3, Y + D - 5, 6, 1.4);                        // pull handle
      if (t === T.HATCHR) {
        ctx.fillStyle = '#5d646c'; ctx.fillRect(X + 3, Y + 3, D - 6, D - 6);
        ctx.strokeStyle = '#3c4148'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(X + 4, Y + 4); ctx.lineTo(X + D - 4, Y + D - 4); ctx.moveTo(X + D - 4, Y + 4); ctx.lineTo(X + 4, Y + D - 4); ctx.stroke();
        ctx.fillStyle = '#a7aeb5'; for (const [a, b] of [[5, 5], [D - 5, 5], [5, D - 5], [D - 5, D - 5]]) { ctx.beginPath(); ctx.arc(X + a, Y + b, 0.9, 0, 7); ctx.fill(); }
      }
    }
    ctx.restore();
  }
  scorch(x, y, r) {
    this.decalAt(x - r, y - r, x + r, y + r);
    this.onTiles(x - r, y - r, x + r, y + r, () => {
      const d = this.dctx, g = d.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(15,12,10,0.7)'); g.addColorStop(0.6, 'rgba(20,16,12,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = g; d.fillRect(x - r, y - r, r * 2, r * 2);
    });
  }
  hole(x, y) {
    this.decalAt(x - 2, y - 2, x + 2, y + 2);
    this.onTiles(x - 2, y - 2, x + 2, y + 2, () => { const d = this.dctx; d.fillStyle = 'rgba(20,20,20,0.7)'; d.beginPath(); d.arc(x, y, 0.8, 0, 7); d.fill(); });
  }
}

// ---------------- furniture ----------------
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function shadowRect(ctx, x, y, w, h, r = 2) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; rr(ctx, x + 2, y + 3, w, h, r); ctx.fill(); }

const CAR_COLORS = ['#8c1d1d', '#1d3f73', '#d8d8d4', '#2c2c2e', '#5e6a72', '#3d5b3a', '#b48a2c'];

export function drawProp(ctx, p, m) {
  const X = p.x * CELL, Y = p.y * CELL, W = p.w * CELL, H = p.h * CELL;
  const h = (i) => hash(p.x, p.y, i);
  switch (p.kind) {
    case 'bed': {
      shadowRect(ctx, X + 1, Y + 1, W - 2, H - 2);
      ctx.fillStyle = '#4a3322'; rr(ctx, X + 1, Y + 1, W - 2, H - 2, 2); ctx.fill();
      ctx.fillStyle = '#e9e6de'; rr(ctx, X + 2.5, Y + 2.5, W - 5, H - 5, 2); ctx.fill();
      ctx.fillStyle = shade(['#6b7fa6', '#9a5a4a', '#5b7f62', '#8a7aa8'][Math.floor(h(1) * 4)], 1); rr(ctx, X + 2.5, Y + 2.5 + (H - 5) * 0.32, W - 5, (H - 5) * 0.68, 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; for (let i = 1; i < 4; i++) ctx.fillRect(X + 3, Y + 2.5 + (H - 5) * (0.32 + i * 0.17), W - 6, 0.6);
      ctx.fillStyle = '#f6f4ee'; const pw = (W - 8) / 2; rr(ctx, X + 3.5, Y + 4, pw, 5, 2); ctx.fill(); rr(ctx, X + 4.5 + pw, Y + 4, pw, 5, 2); ctx.fill();
      break;
    }
    case 'pool': {
      ctx.fillStyle = '#d9d6cc'; ctx.fillRect(X, Y, W, H);
      const g = ctx.createLinearGradient(X, Y, X + W, Y + H); g.addColorStop(0, '#2f8fb8'); g.addColorStop(1, '#1d5f86');
      ctx.fillStyle = g; ctx.fillRect(X + 3, Y + 3, W - 6, H - 6);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 0.7;
      for (let i = 0; i < 9; i++) { const yy = Y + 6 + h(i) * (H - 12), xx = X + 6 + h(i + 9) * (W - 30); ctx.beginPath(); ctx.moveTo(xx, yy); ctx.quadraticCurveTo(xx + 8, yy - 2, xx + 16, yy); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(X + 3, Y + 3, W - 6, 1);
      break;
    }
    case 'locker': {
      shadowRect(ctx, X, Y, W, H, 0.5);
      const n = Math.max(1, Math.round((W >= H ? W : H) / 7));
      for (let i = 0; i < n; i++) {
        const hor = W >= H, lx = hor ? X + i * W / n : X, ly = hor ? Y : Y + i * H / n, lw = hor ? W / n : W, lh = hor ? H : H / n;
        ctx.fillStyle = shade('#566a7a', 0.9 + h(i) * 0.2); ctx.fillRect(lx + 0.3, ly + 0.3, lw - 0.6, lh - 0.6);
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; for (let j = 0; j < 3; j++) ctx.fillRect(lx + 1.5, ly + 1.5 + j * 1.6, lw - 3, 0.6);
      }
      break;
    }
    case 'train': {
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(X + 3, Y + 4, W, H);
      const hor = W >= H;
      ctx.fillStyle = h(1) < 0.5 ? '#7a2f25' : '#2f4a63'; rr(ctx, X, Y, W, H, 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; if (hor) ctx.fillRect(X, Y + 1, W, 2); else ctx.fillRect(X + 1, Y, 2, H);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      for (let i = 1; i < (hor ? p.w : p.h); i += 2) { if (hor) ctx.fillRect(X + i * CELL, Y + 2, 0.8, H - 4); else ctx.fillRect(X + 2, Y + i * CELL, W - 4, 0.8); }
      ctx.fillStyle = '#c9b037'; if (hor) { ctx.fillRect(X + 1, Y + H / 2 - 0.5, 3, 1); ctx.fillRect(X + W - 4, Y + H / 2 - 0.5, 3, 1); } else { ctx.fillRect(X + W / 2 - 0.5, Y + 1, 1, 3); ctx.fillRect(X + W / 2 - 0.5, Y + H - 4, 1, 3); }
      break;
    }
    case 'tank': { // boiler / generator / water tank
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(X + W / 2 + 2, Y + H / 2 + 3, W / 2, H / 2, 0, 0, 7); ctx.fill();
      const g = ctx.createRadialGradient(X + W * 0.35, Y + H * 0.35, 1, X + W / 2, Y + H / 2, Math.max(W, H) / 1.6);
      g.addColorStop(0, '#b9c0c4'); g.addColorStop(1, '#4f575d');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(X + W / 2, Y + H / 2, W / 2 - 0.5, H / 2 - 0.5, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.fillStyle = '#d23a2a'; ctx.beginPath(); ctx.arc(X + W / 2, Y + H / 2, 1.5, 0, 7); ctx.fill();
      break;
    }
    case 'railing': { // waist-high metal rail round a stairwell
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(X + 2, Y + 2, W - 2, H - 2);
      const hor = W >= H, cx = X + W / 2, cy = Y + H / 2;
      ctx.fillStyle = '#7d848b';
      if (hor) ctx.fillRect(X, cy - 1.5, W, 3); else ctx.fillRect(cx - 1.5, Y, 3, H);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      if (hor) ctx.fillRect(X, cy - 1.5, W, 0.8); else ctx.fillRect(cx - 1.5, Y, 0.8, H);
      ctx.fillStyle = '#4a5056';
      for (let i = 0; i <= (hor ? p.w : p.h); i++) { const px = hor ? X + i * CELL : cx, py = hor ? cy : Y + i * CELL; ctx.fillRect(px - 1.2, py - 1.2, 2.4, 2.4); }
      break;
    }
    case 'desk': {
      shadowRect(ctx, X + 1, Y + 1, W - 2, H - 2);
      ctx.fillStyle = '#6e4c2f'; rr(ctx, X + 1, Y + 1, W - 2, H - 2, 1.5); ctx.fill();
      ctx.fillStyle = 'rgba(255,230,190,0.12)'; ctx.fillRect(X + 1.5, Y + 1.5, W - 3, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(X + W / 2 - 0.3, Y + 1, 0.6, H - 2);
      for (const side of [0, 1]) {
        const ox = X + 6 + side * W / 2;
        ctx.fillStyle = '#121417'; ctx.fillRect(ox, Y + 3, 13, 3);
        ctx.fillStyle = '#2f5d86'; ctx.fillRect(ox + 0.8, Y + 5.2, 11.4, 0.7);
        ctx.fillStyle = '#26282b'; ctx.fillRect(ox + 5.5, Y + 6, 2, 1.5);
        ctx.fillStyle = '#c9c9c4'; ctx.fillRect(ox + 1.5, Y + 9, 10, 3);
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 4; i++) ctx.fillRect(ox + 2 + i * 2.4, Y + 9.6, 1.6, 1.8);
        ctx.save(); ctx.translate(ox + 16 - side * 18, Y + 18 + h(side) * 6); ctx.rotate((h(side + 3) - 0.5) * 0.8);
        ctx.fillStyle = '#efeee8'; ctx.fillRect(-3, -4, 6, 8); ctx.fillStyle = 'rgba(0,0,0,0.2)'; for (let i = 0; i < 4; i++) ctx.fillRect(-2, -3 + i * 1.8, 4, 0.4);
        ctx.restore();
        if (h(side + 5) < 0.6) { ctx.fillStyle = '#d6d0c4'; ctx.beginPath(); ctx.arc(ox + 14, Y + 10, 1.8, 0, 7); ctx.fill(); ctx.fillStyle = '#3b2412'; ctx.beginPath(); ctx.arc(ox + 14, Y + 10, 1.2, 0, 7); ctx.fill(); }
        // office chair
        const cx = ox + 6.5, cy = Y + H + 5;
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(cx + 1, cy + 1.5, 6, 0, 7); ctx.fill();
        ctx.fillStyle = '#25272b'; ctx.beginPath(); ctx.arc(cx, cy, 5.5, 0, 7); ctx.fill();
        ctx.fillStyle = '#34373c'; rr(ctx, cx - 5, cy + 2.5, 10, 3.5, 1.5); ctx.fill();
      }
      break;
    }
    case 'console': {
      shadowRect(ctx, X, Y, W, H);
      ctx.fillStyle = '#2a2e33'; rr(ctx, X, Y + 2, W, H - 2, 1.5); ctx.fill();
      for (let i = 0; i < 3; i++) { ctx.fillStyle = '#0f1113'; ctx.fillRect(X + 2 + i * 15, Y + 3, 12, 3); ctx.fillStyle = ['#2fae6a', '#2f86ae', '#ae8a2f'][i]; ctx.fillRect(X + 3 + i * 15, Y + 5.3, 10, 0.6); }
      break;
    }
    case 'rack': {
      shadowRect(ctx, X, Y, W, H, 1);
      ctx.fillStyle = '#17191c'; ctx.fillRect(X, Y, W, H);
      ctx.fillStyle = '#33383e'; ctx.fillRect(X, Y, W, 1); ctx.fillRect(X, Y, 1, H); ctx.fillRect(X + W - 1, Y, 1, H); ctx.fillRect(X, Y + H - 1, W, 1);
      for (let i = 0; i < p.h * 5; i++) {
        ctx.fillStyle = '#24282d'; ctx.fillRect(X + 2, Y + 2 + i * 3.1, W - 4, 2.4);
        const c = ['#3dff8a', '#3dc4ff', '#ffb43d', '#3dff8a'][Math.floor(h(i) * 4)];
        ctx.fillStyle = c; ctx.fillRect(X + 3, Y + 2.7 + i * 3.1, 1, 1); if (h(i + 40) < 0.5) ctx.fillRect(X + 5, Y + 2.7 + i * 3.1, 1, 1);
      }
      break;
    }
    case 'bookshelf': case 'shelf': {
      shadowRect(ctx, X, Y, W, H, 1);
      ctx.fillStyle = p.kind === 'shelf' ? '#50555b' : '#4a3422'; ctx.fillRect(X, Y, W, H);
      const vert = p.h > p.w, n = vert ? p.h * 3 : p.w * 3;
      for (let i = 0; i < n; i++) {
        const c = ['#a9814f', '#8e6a3f', '#2f4f7a', '#7a2f2f', '#c2b28a', '#3e5e3e'][Math.floor(h(i) * 6)];
        ctx.fillStyle = c;
        const size = 4 + h(i + 9) * 1.5;
        if (vert) ctx.fillRect(X + 2, Y + 1 + i * 5.3, W - 4, size); else ctx.fillRect(X + 1 + i * 5.3, Y + 2, size, H - 4);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        if (vert) ctx.fillRect(X + 2, Y + 1 + i * 5.3, W - 4, 0.6); else ctx.fillRect(X + 1 + i * 5.3, Y + 2, 0.6, H - 4);
      }
      break;
    }
    case 'cabinet': {
      shadowRect(ctx, X, Y, W, H, 1);
      ctx.fillStyle = '#8d939a'; ctx.fillRect(X + 1, Y, W - 2, H);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; for (let i = 1; i < 4; i++) ctx.fillRect(X + 1, Y + i * H / 4, W - 2, 0.6);
      ctx.fillStyle = '#c9ced3'; for (let i = 0; i < 4; i++) ctx.fillRect(X + W - 4, Y + 4 + i * H / 4, 1.5, 4);
      break;
    }
    case 'plant': {
      const cx = X + W / 2, cy = Y + H / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(cx + 2, cy + 3, 8, 0, 7); ctx.fill();
      ctx.fillStyle = '#5c3d2e'; ctx.beginPath(); ctx.arc(cx, cy, 6.5, 0, 7); ctx.fill();
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * Math.PI * 2 + h(i) * 0.4;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
        ctx.fillStyle = i % 2 ? '#3f7a34' : '#2f5f28'; ctx.beginPath(); ctx.ellipse(5, 0, 6, 2.2, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(180,220,140,0.4)'; ctx.lineWidth = 0.3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(10, 0); ctx.stroke();
        ctx.restore();
      }
      break;
    }
    case 'pillar': {
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(X + 2, Y + 3, W, H);
      ctx.fillStyle = '#9a9890'; ctx.fillRect(X, Y, W, H);
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(X, Y, W, 1); ctx.fillRect(X, Y, 1, H);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(X, Y + H - 2, W, 2);
      break;
    }
    case 'bench': {
      shadowRect(ctx, X, Y + 3, W, H - 6);
      ctx.fillStyle = '#3a3d42'; ctx.fillRect(X + 2, Y + 3, 2, H - 6); ctx.fillRect(X + W - 4, Y + 3, 2, H - 6);
      for (let i = 0; i < 3; i++) { ctx.fillStyle = shade('#8a6038', 0.9 + h(i) * 0.2); ctx.fillRect(X, Y + 3.5 + i * 3.2, W, 2.6); }
      break;
    }
    case 'counter': case 'island': {
      shadowRect(ctx, X, Y, W, H);
      ctx.fillStyle = '#e6e2da'; ctx.fillRect(X, Y, W, H);
      ctx.fillStyle = '#4f5256'; rr(ctx, X + 0.5, Y + 0.5, W - 1, H - 1, 1); ctx.fill();
      for (let i = 0; i < 40; i++) { ctx.fillStyle = h(i) < 0.5 ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.25)'; ctx.fillRect(X + h(i + 1) * W, Y + h(i + 2) * H, 0.6, 0.6); }
      if (p.kind === 'counter') {
        ctx.fillStyle = '#b9bec3'; rr(ctx, X + 10, Y + 3, 14, 10, 2); ctx.fill(); ctx.fillStyle = '#8a9096'; rr(ctx, X + 11.5, Y + 4.5, 11, 7, 1.5); ctx.fill();
        ctx.fillStyle = '#1c1d1f'; ctx.fillRect(X + 100, Y + 1.5, 26, 13);
        for (const [bx, by] of [[105, 5], [118, 5], [105, 11], [118, 11]]) { ctx.strokeStyle = '#555'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(X + bx, Y + by, 2.6, 0, 7); ctx.stroke(); }
        ctx.fillStyle = '#d8d4c8'; ctx.fillRect(X + 50, Y + 4, 8, 6); ctx.fillStyle = '#2a2a2a'; ctx.fillRect(X + 66, Y + 4, 10, 7);
      } else {
        ctx.fillStyle = '#c84'; ctx.beginPath(); ctx.arc(X + 20, Y + 10, 3, 0, 7); ctx.fill();
        ctx.fillStyle = '#d33'; ctx.beginPath(); ctx.arc(X + 26, Y + 14, 2, 0, 7); ctx.fill();
        for (let i = 0; i < 3; i++) { ctx.fillStyle = '#2b2b2b'; ctx.beginPath(); ctx.arc(X + 14 + i * 26, Y + H + 4, 3.5, 0, 7); ctx.fill(); ctx.fillStyle = '#555'; ctx.beginPath(); ctx.arc(X + 14 + i * 26, Y + H + 4, 2.2, 0, 7); ctx.fill(); }
      }
      break;
    }
    case 'fridge': {
      shadowRect(ctx, X, Y, W, H, 1);
      const g = ctx.createLinearGradient(X, Y, X + W, Y); g.addColorStop(0, '#d7dadd'); g.addColorStop(1, '#9fa4a9');
      ctx.fillStyle = g; ctx.fillRect(X, Y, W, H);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(X, Y + H * 0.38, W, 0.6); ctx.fillRect(X + 2, Y + 4, 0.8, 8); ctx.fillRect(X + 2, Y + 16, 0.8, 10);
      break;
    }
    case 'couch': {
      const vert = p.rot === 1;
      shadowRect(ctx, X, Y, W, H, 3);
      ctx.fillStyle = '#5e3532'; rr(ctx, X, Y, W, H, 3); ctx.fill();
      ctx.fillStyle = '#4a2826';
      if (vert) ctx.fillRect(X, Y, 5, H); else ctx.fillRect(X, Y, W, 5);
      ctx.fillStyle = '#734340';
      const n = Math.round((vert ? H : W) / 26);
      for (let i = 0; i < n; i++) {
        if (vert) { rr(ctx, X + 5.5, Y + 2 + i * (H - 4) / n, W - 7.5, (H - 4) / n - 1.5, 2); }
        else { rr(ctx, X + 2 + i * (W - 4) / n, Y + 5.5, (W - 4) / n - 1.5, H - 7.5, 2); }
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; if (vert) ctx.fillRect(X + 6, Y + 2, 1, H - 4); else ctx.fillRect(X + 2, Y + 6, W - 4, 1);
      break;
    }
    case 'coffeetable': {
      shadowRect(ctx, X + 2, Y + 2, W - 4, H - 4);
      ctx.fillStyle = 'rgba(160,200,215,0.45)'; rr(ctx, X + 2, Y + 2, W - 4, H - 4, 2); ctx.fill();
      ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 1; ctx.stroke();
      ctx.save(); ctx.translate(X + 14, Y + 14); ctx.rotate(0.3); ctx.fillStyle = '#c7413a'; ctx.fillRect(-5, -3.5, 10, 7); ctx.fillStyle = '#f0f0f0'; ctx.fillRect(-4, -2.5, 4, 2); ctx.restore();
      ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.arc(X + 34, Y + 18, 2.3, 0, 7); ctx.fill();
      break;
    }
    case 'tv': {
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(X + 2, Y + 6, W, 5);
      ctx.fillStyle = '#3a3026'; ctx.fillRect(X - 4, Y + 6, W + 8, 9);
      ctx.fillStyle = '#0b0c0e'; ctx.fillRect(X, Y + 3, W, 4);
      ctx.fillStyle = 'rgba(80,140,200,0.35)'; ctx.fillRect(X + 1, Y + 6.2, W - 2, 0.6);
      break;
    }
    case 'marketstall': { // a market trader's table (Dust Town): a wooden top under a striped awning, goods laid out
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(ctx, X + 2, Y + 3, W, H, 2); ctx.fill();
      ctx.fillStyle = '#8a5a32'; rr(ctx, X, Y, W, H, 2); ctx.fill();
      ctx.fillStyle = '#6e4626'; ctx.fillRect(X, Y + H - 3, W, 3);
      const cols = ['#c0392b', '#e8d8b0'], bands = Math.max(3, Math.round(W / 8));
      for (let i = 0; i < bands; i++) { ctx.fillStyle = cols[i % 2]; ctx.fillRect(X + i * W / bands, Y - 4, W / bands + 0.5, 5); } // the awning's edge
      const goods = ['#e2a33a', '#7aa84a', '#d0573a', '#c9b48a', '#9a6ad0'];
      for (let i = 0; i < Math.round(W / 7); i++) { ctx.fillStyle = goods[(i * 3 + (X | 0)) % goods.length]; ctx.beginPath(); ctx.arc(X + 4 + i * 7, Y + H / 2 + (i % 2 ? 1.5 : -1.5), 2.3, 0, 7); ctx.fill(); }
      break;
    }
    case 'stall': {
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(X + 7, Y + 2, 3, H);
      ctx.fillStyle = '#9fb3b8'; ctx.fillRect(X + 6, Y, 3, H);
      ctx.fillStyle = '#f4f4f2'; ctx.beginPath(); ctx.ellipse(X - 5, Y + H / 2, 4.2, 5.5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#dcdcd8'; ctx.fillRect(X - 10, Y + H / 2 - 4, 3, 8);
      break;
    }
    case 'sink': {
      shadowRect(ctx, X, Y + 2, W, H - 2);
      ctx.fillStyle = '#e8e6e0'; ctx.fillRect(X, Y + 2, W, H - 2);
      for (const sx of [8, 24]) { ctx.fillStyle = '#c8ccd0'; ctx.beginPath(); ctx.ellipse(X + sx, Y + 9, 5, 4, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#888'; ctx.fillRect(X + sx - 0.5, Y + 3, 1, 3); }
      break;
    }
    case 'meetingtable': {
      shadowRect(ctx, X + 6, Y + 6, W - 12, H - 12, 12);
      for (let i = 0; i < 6; i++) for (const side of [0, 1]) {
        const cx = X + 20 + i * (W - 40) / 5, cy = side ? Y + H - 3 : Y + 3;
        ctx.fillStyle = '#1f2125'; ctx.beginPath(); ctx.arc(cx, cy, 4.5, 0, 7); ctx.fill();
        ctx.fillStyle = '#2f3237'; ctx.fillRect(cx - 4, side ? cy + 1.5 : cy - 4, 8, 2.5);
      }
      const g = ctx.createLinearGradient(X, Y, X, Y + H); g.addColorStop(0, '#6a4428'); g.addColorStop(1, '#4e311c');
      ctx.fillStyle = g; rr(ctx, X + 6, Y + 6, W - 12, H - 12, 12); ctx.fill();
      ctx.fillStyle = 'rgba(255,230,190,0.15)'; rr(ctx, X + 10, Y + 8, W - 20, 3, 2); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(X + W / 2, Y + H / 2, 4, 0, 7); ctx.fill();
      for (let i = 0; i < 4; i++) { ctx.fillStyle = '#efefe9'; ctx.fillRect(X + 26 + i * 30, Y + 14 + (i % 2) * 22, 7, 9); }
      break;
    }
    case 'reception': {
      shadowRect(ctx, X, Y, W, H + 4, 4);
      ctx.fillStyle = '#d8d4cc'; rr(ctx, X, Y, W, H + 4, 4); ctx.fill();
      ctx.fillStyle = '#5a3d27'; rr(ctx, X + 2, Y + 2, W - 4, H, 3); ctx.fill();
      ctx.fillStyle = '#121417'; ctx.fillRect(X + 40, Y + 4, 12, 2.5);
      ctx.fillStyle = '#7a1f1f'; ctx.fillRect(X + 12, Y + 6, 10, 4);
      break;
    }
    case 'chairs': {
      for (let i = 0; i < p.h * 2; i++) { const cy = Y + 4 + i * 8; ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(X + 3, cy + 1, 12, 7); ctx.fillStyle = '#2e4058'; rr(ctx, X + 2, cy, 12, 7, 2); ctx.fill(); ctx.fillStyle = '#22303f'; ctx.fillRect(X + 2, cy, 3, 7); }
      break;
    }
    case 'car': case 'van': {
      const horiz = p.w > p.h;
      const col = p.kind === 'van' ? '#e2e2dc' : CAR_COLORS[Math.floor(h(1) * CAR_COLORS.length)];
      ctx.save(); ctx.translate(X + W / 2, Y + H / 2); if (horiz) ctx.rotate(Math.PI / 2 * (h(2) < 0.5 ? 1 : -1));
      const L = horiz ? W : H, Wd = horiz ? H : W;
      const bw = Wd - 6, bl = L - 4;
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; rr(ctx, -bw / 2 + 2, -bl / 2 + 3, bw, bl, 7); ctx.fill();
      ctx.fillStyle = '#111'; for (const [wx, wy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ctx.fillRect(wx * bw / 2 - 2 + (wx > 0 ? -1 : 1), wy * bl * 0.3 - 4, 4, 8);
      const g = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0); g.addColorStop(0, shade(col, 0.7)); g.addColorStop(0.5, col); g.addColorStop(1, shade(col, 0.65));
      ctx.fillStyle = g; rr(ctx, -bw / 2, -bl / 2, bw, bl, 7); ctx.fill();
      ctx.fillStyle = 'rgba(25,35,45,0.92)';
      if (p.kind === 'van') { rr(ctx, -bw / 2 + 2, -bl / 2 + 5, bw - 4, 9, 3); ctx.fill(); ctx.fillStyle = shade(col, 0.92); ctx.fillRect(-bw / 2 + 2, -bl / 2 + 17, bw - 4, bl - 22); ctx.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 6; i++) ctx.fillRect(-bw / 2 + 3, -bl / 2 + 22 + i * 14, bw - 6, 0.8); }
      else {
        ctx.beginPath(); ctx.moveTo(-bw / 2 + 2, -bl * 0.18); ctx.lineTo(bw / 2 - 2, -bl * 0.18); ctx.lineTo(bw / 2 - 4, -bl * 0.32); ctx.lineTo(-bw / 2 + 4, -bl * 0.32); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-bw / 2 + 2, bl * 0.22); ctx.lineTo(bw / 2 - 2, bl * 0.22); ctx.lineTo(bw / 2 - 4, bl * 0.33); ctx.lineTo(-bw / 2 + 4, bl * 0.33); ctx.fill();
        ctx.fillStyle = shade(col, 1.12); rr(ctx, -bw / 2 + 3, -bl * 0.18, bw - 6, bl * 0.4, 3); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-bw / 2 + 4, -bl * 0.16, 1.2, bl * 0.36);
      }
      ctx.fillStyle = '#fff6c8'; ctx.fillRect(-bw / 2 + 2, -bl / 2 + 0.5, 4, 1.5); ctx.fillRect(bw / 2 - 6, -bl / 2 + 0.5, 4, 1.5);
      ctx.fillStyle = '#c0261f'; ctx.fillRect(-bw / 2 + 2, bl / 2 - 2, 4, 1.5); ctx.fillRect(bw / 2 - 6, bl / 2 - 2, 4, 1.5);
      ctx.fillStyle = shade(col, 0.6); ctx.fillRect(-bw / 2 - 2, -bl * 0.2, 2.5, 3); ctx.fillRect(bw / 2 - 0.5, -bl * 0.2, 2.5, 3);
      ctx.restore();
      break;
    }
    case 'crates': {
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        const cx = X + i * 16, cy = Y + j * 16;
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(cx + 2, cy + 3, 15, 15);
        ctx.fillStyle = shade('#9a7448', 0.85 + h(i * 2 + j) * 0.3); ctx.fillRect(cx + 0.5, cy + 0.5, 15, 15);
        ctx.strokeStyle = '#5e4326'; ctx.lineWidth = 1.2; ctx.strokeRect(cx + 1.2, cy + 1.2, 13.6, 13.6);
        ctx.beginPath(); ctx.moveTo(cx + 1.5, cy + 1.5); ctx.lineTo(cx + 14.5, cy + 14.5); ctx.stroke();
      }
      break;
    }
    case 'workbench': {
      shadowRect(ctx, X, Y, W, H);
      ctx.fillStyle = '#7a5838'; ctx.fillRect(X, Y, W, H);
      ctx.fillStyle = '#c33'; ctx.fillRect(X + 10, Y + 4, 12, 6); ctx.fillStyle = '#999'; ctx.fillRect(X + 30, Y + 6, 14, 1.5); ctx.fillRect(X + 50, Y + 3, 2, 9);
      ctx.fillStyle = '#e8b321'; ctx.fillRect(X + 60, Y + 5, 8, 5);
      break;
    }
    case 'tree': {
      const cx = X + W / 2, cy = Y + H / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(cx + 6, cy + 8, 26, 0, 7); ctx.fill();
      const blobs = 16;
      for (let layer = 0; layer < 3; layer++) for (let i = 0; i < blobs; i++) {
        const a = h(i + layer * 30) * Math.PI * 2, d = h(i + 7 + layer * 30) * (20 - layer * 6), r = 9 - layer * 2 + h(i + 3) * 4;
        ctx.fillStyle = ['#2c4a22', '#3b6230', '#527d3f'][layer];
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d - layer * 2, cy + Math.sin(a) * d - layer * 2, r, 0, 7); ctx.fill();
      }
      break;
    }
    case 'bush': {
      for (let i = 0; i < 9; i++) {
        const a = h(i) * Math.PI * 2, d = h(i + 9) * Math.min(W, H) * 0.3, r = 5 + h(i + 2) * 4;
        ctx.fillStyle = i < 4 ? '#2e4a25' : '#436b34';
        ctx.beginPath(); ctx.arc(X + W / 2 + Math.cos(a) * d, Y + H / 2 + Math.sin(a) * d, r, 0, 7); ctx.fill();
      }
      break;
    }
    case 'dumpster': case 'container': {
      const col = p.kind === 'dumpster' ? '#2f5a3a' : '#2f5f8a';
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(X + 3, Y + 4, W, H);
      ctx.fillStyle = col; ctx.fillRect(X, Y, W, H);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      const vert = H > W;
      for (let i = 2; i < (vert ? H : W); i += 4) if (vert) ctx.fillRect(X, Y + i, W, 1); else ctx.fillRect(X + i, Y, 1, H);
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(X, Y, W, 1);
      break;
    }
    case 'barrier': {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(X + 2, Y + 6, W, 8);
      ctx.fillStyle = '#b8b4aa'; ctx.fillRect(X, Y + 4, W, 8);
      ctx.fillStyle = '#d0ccc2'; ctx.fillRect(X, Y + 6, W, 3);
      ctx.fillStyle = '#c33'; for (let i = 0; i < W; i += 16) ctx.fillRect(X + i, Y + 4, 6, 2);
      break;
    }
    default: drawOutProp(ctx, p, X, Y, W, H, h);
  }
}
