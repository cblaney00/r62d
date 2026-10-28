// Draws the map (floors, walls, doors, furniture) into a big off-screen picture,
// and redraws small parts of it when walls get broken or reinforced.
import { CELL, T, FL, MAT, CELL_HP } from '/shared/constants.js';
import { S, floorPatterns, hash, shade, canvas } from './textures.js';

const SOLID = new Set([T.HARD, T.SOFT, T.REINF, T.PANEL]);
const WALLISH = new Set([T.HARD, T.SOFT, T.REINF, T.PANEL, T.BARRI]);

export class MapRenderer {
  constructor(map, baseTiles) {
    this.map = map; this.base = baseTiles;
    this.Wp = map.W * CELL; this.Hp = map.H * CELL;
    this.c = canvas(this.Wp * S, this.Hp * S);
    this.ctx = this.c.getContext('2d'); this.ctx.scale(S, S);
    this.dctx = this.ctx; // blood and scorch marks are painted straight onto the floor
    this.pat = floorPatterns(this.ctx);
    // a dull grey copy used for the parts of the map your team can't currently see
    this.G = 1.5;
    this.grey = canvas(Math.ceil(this.Wp * this.G), Math.ceil(this.Hp * this.G));
    this.gctx = this.grey.getContext('2d');
    this.region(0, 0, map.W - 1, map.H - 1);
  }

  t(x, y) { const m = this.map; return x < 0 || y < 0 || x >= m.W || y >= m.H ? T.HARD : m.tiles[y * m.W + x]; }

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
    // void: open air beside upper floors, earth around basements
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const vk = cy * m.W + cx;
      if (m.tiles[vk] !== T.VOID && m.floor[vk] !== FL.VOID) continue;
      x.fillStyle = m.tiles[vk] === T.VOID ? '#07090c' : '#101318'; x.fillRect(cx * CELL, cy * CELL, CELL, CELL);
      if (hash(cx, cy, 9) < 0.25) { x.fillStyle = 'rgba(255,255,255,0.025)'; x.fillRect(cx * CELL + hash(cx, cy, 1) * 12, cy * CELL + hash(cx, cy, 2) * 12, 3, 3); }
    }
    this.drawStairs(x0, y0, x1, y1);
  }

  // Staircases: steps across the direction of travel, darker as they go down, with an arrow.
  drawStairs(x0, y0, x1, y1) {
    const m = this.map, x = this.ctx;
    for (const st of m.stairs || []) for (const [g, up] of [[st.ga, true], [st.gb, false]]) {
      const gx = g % m.W, gy = Math.floor(g / m.W);
      if (gx > x1 || gy > y1 || gx + st.w < x0 || gy + st.h < y0) continue;
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
      // arrow pointing the way you walk to change floor
      const ang = { n: -Math.PI / 2, s: Math.PI / 2, e: 0, w: Math.PI }[st.dir] + (up ? 0 : Math.PI);
      x.save(); x.translate(X + Wd / 2, Y + Hd / 2); x.rotate(ang);
      x.fillStyle = up ? 'rgba(242,193,78,0.85)' : 'rgba(120,180,255,0.85)';
      x.beginPath(); x.moveTo(9, 0); x.lineTo(1, -6); x.lineTo(1, -2.5); x.lineTo(-9, -2.5); x.lineTo(-9, 2.5); x.lineTo(1, 2.5); x.lineTo(1, 6); x.closePath(); x.fill();
      x.restore();
      x.save(); x.translate(X + Wd / 2, Y + Hd / 2 + (vert ? 0 : 10));
      if (vert) { x.translate(Wd / 2 + 1, 0); x.rotate(Math.PI / 2); }
      x.font = '700 6px Barlow Condensed, sans-serif'; x.textAlign = 'center'; x.fillStyle = 'rgba(255,255,255,0.75)';
      x.fillText(up ? 'UP · ' + m.floors[st.b].name : 'DOWN · ' + m.floors[st.a].name, 0, vert ? -2 : 0);
      x.restore();
    }
  }

  // Redraw a block of cells (inclusive), clipped so neighbours are untouched.
  region(x0, y0, x1, y1) {
    const m = this.map, ctx = this.ctx;
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(m.W - 1, x1); y1 = Math.min(m.H - 1, y1);
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
      if ((b === T.SOFT || b === T.HARD) && (t === T.FLOOR || t === T.GROUND || t === T.OPEN)) this.rubble(x, y, m.mat[k]);
    }
    // soft contact shadows on the floor beside walls
    for (let y = ey0; y <= ey1; y++) for (let x = ex0; x <= ex1; x++) {
      const t = this.t(x, y);
      if (!SOLID.has(t) && t !== T.TALL) continue;
      const X0 = x * CELL, Y0 = y * CELL;
      if (!SOLID.has(this.t(x, y + 1)) && this.t(x, y + 1) !== T.TALL) {
        ctx.fillStyle = 'rgba(0,0,0,0.30)'; ctx.fillRect(X0 + 1, Y0 + CELL, CELL, 2.5);
        ctx.fillStyle = 'rgba(0,0,0,0.13)'; ctx.fillRect(X0 + 2, Y0 + CELL + 2.5, CELL, 3);
      }
      if (!SOLID.has(this.t(x + 1, y)) && this.t(x + 1, y) !== T.TALL) {
        ctx.fillStyle = 'rgba(0,0,0,0.24)'; ctx.fillRect(X0 + CELL, Y0 + 1, 2, CELL);
        ctx.fillStyle = 'rgba(0,0,0,0.10)'; ctx.fillRect(X0 + CELL + 2, Y0 + 2, 2.5, CELL);
      }
      if (t === T.TALL) continue;
      if (!SOLID.has(this.t(x, y - 1))) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(X0, Y0 - 2, CELL, 2); }
      if (!SOLID.has(this.t(x - 1, y))) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(X0 - 2, Y0, 2, CELL); }
    }
    for (const p of m.props) {
      if (p.x > ex1 || p.y > ey1 || p.x + p.w < ex0 || p.y + p.h < ey0) continue;
      drawProp(ctx, p, m);
    }
    for (let y = ey0; y <= ey1; y++) for (let x = ex0; x <= ex1; x++) {
      if (x < 0 || y < 0 || x >= m.W || y >= m.H) continue;
      const k = y * m.W + x, t = m.tiles[k];
      if (m.openId[k] >= 0 || t === T.OPEN || t === T.BARRI || t === T.PANEL) this.opening(x, y, k);
      if (SOLID.has(t) || t === T.DSHIELD) this.wall(x, y, k, t);
    }
    ctx.restore();
    this.mark(X, Y, X + Wd, Y + Hd);
    const G = this.G, gx = this.gctx;
    gx.filter = 'grayscale(1) brightness(0.42) contrast(1.15)';
    gx.clearRect(X * G, Y * G, Wd * G, Hd * G);
    gx.drawImage(this.c, X * S, Y * S, Wd * S, Hd * S, X * G, Y * G, Wd * G, Hd * G);
    gx.filter = 'none';
  }

  // The map is shown by the browser itself as a stack of tiles that it moves and scales on the
  // graphics card, so the game never copies the whole picture each frame. Changed spots are
  // copied into the tiles once per frame (flush).
  mount(el) {
    el.textContent = '';
    const TS = 1024, W = this.c.width, H = this.c.height;
    this.tiles = [];
    for (let y = 0; y < H; y += TS) for (let x = 0; x < W; x += TS) {
      const w = Math.min(TS + 2, W - x), h = Math.min(TS + 2, H - y); // 2px overlap hides seams
      const c = canvas(w, h); c.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
      el.appendChild(c); this.tiles.push({ c, x, y, w, h, ctx: c.getContext('2d') });
    }
    this.dirty = [[0, 0, W, H]];
    this.flush();
  }
  mark(x0, y0, x1, y1) { // world pixels
    const r = [Math.floor(x0 * S), Math.floor(y0 * S), Math.ceil(x1 * S), Math.ceil(y1 * S)];
    if (!this.dirty) this.dirty = [];
    if (this.dirty.length < 24) this.dirty.push(r);
    else { const d = this.dirty[23]; this.dirty[23] = [Math.min(d[0], r[0]), Math.min(d[1], r[1]), Math.max(d[2], r[2]), Math.max(d[3], r[3])]; }
  }
  flush() {
    if (!this.dirty || !this.tiles) return;
    for (const d of this.dirty) for (const t of this.tiles) {
      const x0 = Math.max(t.x, d[0]), y0 = Math.max(t.y, d[1]), x1 = Math.min(t.x + t.w, d[2]), y1 = Math.min(t.y + t.h, d[3]);
      if (x1 <= x0 || y1 <= y0) continue;
      t.ctx.clearRect(x0 - t.x, y0 - t.y, x1 - x0, y1 - y0);
      t.ctx.drawImage(this.c, x0, y0, x1 - x0, y1 - y0, x0 - t.x, y0 - t.y, x1 - x0, y1 - y0);
    }
    this.dirty = null;
  }

  cellChanged(k) { const x = k % this.map.W, y = Math.floor(k / this.map.W); this.region(x - 1, y - 1, x + 1, y + 1); }

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
      for (let i = 0; i < 3; i++) {
        if (hpF < 0.5 && i === 1) continue;
        ctx.save();
        ctx.translate(X + CELL / 2, Y + CELL / 2);
        ctx.rotate((horiz ? 0 : Math.PI / 2) + (i - 1) * 0.35 + (hash(x, y, i) - 0.5) * 0.15);
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-9, -1.6 + (i - 1) * 3.3 + 0.8, 18, 3.2);
        ctx.fillStyle = shade('#9a6a3a', 0.85 + hash(i, x, y) * 0.3); ctx.fillRect(-9.5, -1.6 + (i - 1) * 3.3, 19, 3.2);
        ctx.fillStyle = 'rgba(60,35,15,0.6)'; ctx.fillRect(-9.5, -1.6 + (i - 1) * 3.3 + 2.6, 19, 0.6);
        ctx.fillStyle = '#c9c9c9'; ctx.fillRect(-7, -0.6 + (i - 1) * 3.3, 0.9, 0.9); ctx.fillRect(6, -0.6 + (i - 1) * 3.3, 0.9, 0.9);
        ctx.restore();
      }
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
    const ctx = this.ctx, m = this.map, X = x * CELL, Y = y * CELL, mat = m.mat[k];
    let top;
    if (t === T.HARD) top = '#7a7f85';
    else if (t === T.REINF) top = '#59626c';
    else if (t === T.PANEL) top = '#3e454d';
    else if (t === T.DSHIELD) top = '#2b3036';
    else top = mat === MAT.BRICK ? '#93503b' : '#d8d2c4';
    ctx.fillStyle = top; ctx.fillRect(X, Y, CELL, CELL);
    const s = (dx, dy) => SOLID.has(this.t(x + dx, y + dy)) || this.t(x + dx, y + dy) === T.DSHIELD;
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
    // raised-edge shading
    const dark = shade(t === T.SOFT && mat !== MAT.BRICK ? '#d8d2c4' : top.startsWith('#') ? top : '#888888', 0.55);
    if (!s(0, 1)) { ctx.fillStyle = dark; ctx.fillRect(X, Y + CELL - 3, CELL, 3); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(X, Y + CELL - 0.6, CELL, 0.6); }
    if (!s(0, -1)) { ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(X, Y, CELL, 0.9); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(X, Y, CELL, 0.4); }
    if (!s(-1, 0)) { ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(X, Y, 0.9, CELL); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(X, Y, 0.4, CELL); }
    if (!s(1, 0)) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(X + CELL - 1.4, Y, 1.4, CELL); }
  }

  // ---- decals (blood, scorch marks) ----
  blood(x, y, ang) {
    const d = this.dctx; this.mark(x - 13, y - 13, x + 13, y + 13);
    for (let i = 0; i < 7; i++) {
      const r = Math.random() * 10, a = ang + (Math.random() - 0.5) * 0.9;
      d.fillStyle = `rgba(${90 + Math.random() * 40},8,8,${0.35 + Math.random() * 0.35})`;
      d.beginPath(); d.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, 0.6 + Math.random() * 1.8, 0, 7); d.fill();
    }
  }
  pool(x, y) {
    this.mark(x - 15, y - 15, x + 15, y + 15);
    const d = this.dctx, g = d.createRadialGradient(x, y, 0, x, y, 14);
    g.addColorStop(0, 'rgba(110,8,8,0.75)'); g.addColorStop(0.7, 'rgba(90,5,5,0.55)'); g.addColorStop(1, 'rgba(80,5,5,0)');
    d.fillStyle = g; d.beginPath(); d.ellipse(x, y, 14, 11, Math.random() * 3, 0, 7); d.fill();
  }
  scorch(x, y, r) {
    this.mark(x - r, y - r, x + r, y + r);
    const d = this.dctx, g = d.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(15,12,10,0.7)'); g.addColorStop(0.6, 'rgba(20,16,12,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    d.fillStyle = g; d.fillRect(x - r, y - r, r * 2, r * 2);
  }
  hole(x, y) {
    const d = this.dctx; this.mark(x - 2, y - 2, x + 2, y + 2);
    d.fillStyle = 'rgba(20,20,20,0.7)'; d.beginPath(); d.arc(x, y, 0.8, 0, 7); d.fill();
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
  }
}
