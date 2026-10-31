// Map knowledge (he asked): a menu page to study each map. Pick a map and a floor; the floor plan is drawn with the
// game's own map picture and, on top, every pair of bomb sites (click one to pick it out), attacker spawns, map
// cameras, floor hatches, stairs, breakable walls, rappel ropes and room names. Each layer can be switched off.
import { CELL, T } from '/shared/constants.js';
import { MAPS, MAP_LIST, buildMap, wallMount } from '/shared/map.js';
import { MapRenderer } from './mapdraw.js';
import * as audio from './audio.js';

const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SITE_COL = ['#f2c14e', '#5ec8ff', '#ff7a7a', '#8be38b', '#d79bff', '#ffb36b'];
const LAYERS = [
  ['sites', 'Bomb sites', '#f2c14e'], ['spawns', 'Attacker spawns', '#ff8a3d'], ['cams', 'Cameras', '#9fb3c8'],
  ['hatches', 'Floor hatches', '#c8a06a'], ['stairs', 'Stairs', '#ffffff'], ['soft', 'Breakable walls', '#e0763a'],
  ['ropes', 'Rappel spots', '#cda564'], ['rooms', 'Room names', '#c9d1d9'],
];
let S = null;

export function openMapInfo(el) {
  el.classList.remove('hidden');
  if (!S) S = { id: MAP_LIST[0], fl: -1, site: -1, on: Object.fromEntries(LAYERS.map(l => [l[0], true])) };
  const cv = el.querySelector('#mkCanvas');
  S.resize = () => draw(el);
  addEventListener('resize', S.resize);
  cv.onmousemove = e => hover(el, e);
  cv.onmouseleave = () => { S.hover = null; draw(el); };
  pickMap(el, S.id);
}
export function closeMapInfo(el) {
  el.classList.add('hidden');
  if (S) { removeEventListener('resize', S.resize); S.rend = null; S.map = null; S.loadedId = null; } // the big map picture is not kept
}

function pickMap(el, id) {
  S.id = id;
  const list = el.querySelector('#mkList');
  list.innerHTML = MAP_LIST.map(k => `<button data-id="${k}" class="${k === id ? 'on' : ''}"><b>${esc(MAPS[k].name)}</b><span>${esc(MAPS[k].floors)}</span></button>`).join('');
  for (const b of list.querySelectorAll('button')) b.onclick = () => { audio.ui(); pickMap(el, b.dataset.id); };
  if (S.loadedId !== id) {
    const cv = el.querySelector('#mkCanvas'), c = cv.getContext('2d');
    fit(cv); c.fillStyle = '#0b0e12'; c.fillRect(0, 0, cv.width, cv.height);
    c.fillStyle = 'rgba(255,255,255,0.6)'; c.font = '600 22px Barlow Condensed, sans-serif'; c.textAlign = 'center'; c.fillText('Drawing the map…', cv.width / 2, cv.height / 2);
    setTimeout(() => { // let the "drawing" note show first: building the picture takes a moment
      if (S.id !== id) return;
      S.map = buildMap(id); S.rend = new MapRenderer(S.map, S.map.tiles.slice(), 0.25); S.loadedId = id;
      S.cams = (S.map.cams || []).map(c => wallMount(S.map, c.x, c.y));
      S.fl = S.map.groundFloor ?? 0; S.site = -1;
      side(el); floors(el); draw(el);
    }, 30);
  } else { side(el); floors(el); draw(el); }
}

function floors(el) {
  const m = S.map, bar = el.querySelector('#mkFloors');
  bar.innerHTML = m.floors.map(F => `<button data-i="${F.i}" class="${F.i === S.fl ? 'on' : ''}">${esc(F.name)}</button>`).join('');
  for (const b of bar.querySelectorAll('button')) b.onclick = () => { audio.ui(); S.fl = +b.dataset.i; floors(el); draw(el); };
}

// the right-hand panel: what the map is, its bomb site pairs (click to pick one out) and the layer switches
function side(el) {
  const m = S.map, box = el.querySelector('#mkSide'), flName = i => m.floors[i] ? m.floors[i].name : '';
  const siteFl = s => m.flAt[Math.floor(s.bombs[0].y / CELL) * m.W + Math.floor(s.bombs[0].x / CELL)];
  box.innerHTML = `<h3>${esc(MAPS[S.id].name)}</h3><p class="dim">${esc(MAPS[S.id].desc)} Floors: ${esc(MAPS[S.id].floors)}.</p>
    <h4>Bomb sites <small>defenders pick one pair each round</small></h4>
    <div class="mkSites">${m.sites.map((s, i) => `<button data-i="${i}" class="${i === S.site ? 'on' : ''}"><i style="background:${SITE_COL[i % SITE_COL.length]}"></i><b>${esc(s.name)}</b><span>${esc(flName(siteFl(s)))}</span></button>`).join('')}</div>
    <h4>Show</h4>
    <div class="mkLayers">${LAYERS.map(([k, label, col]) => `<button data-k="${k}" class="${S.on[k] ? 'on' : ''}"><i style="background:${col}"></i>${label}</button>`).join('')}</div>
    <p class="dim small">Bombs A and B of a pair are in the two rooms named. Cameras are the defenders' fixed cameras. Ropes: attackers can rappel up from the coil to the window above.</p>`;
  for (const b of box.querySelectorAll('.mkSites button')) b.onclick = () => {
    audio.ui(); const i = +b.dataset.i; S.site = S.site === i ? -1 : i;
    if (S.site >= 0) { S.fl = siteFl(m.sites[i]); floors(el); }
    side(el); draw(el);
  };
  for (const b of box.querySelectorAll('.mkLayers button')) b.onclick = () => { audio.ui(); S.on[b.dataset.k] = !S.on[b.dataset.k]; b.classList.toggle('on', S.on[b.dataset.k]); draw(el); };
}

function fit(cv) {
  const r = cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(r.width * d) || cv.height !== Math.round(r.height * d)) { cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); }
  return d;
}

function view(cv) {
  const F = S.map.floors[S.fl], W = F.w * CELL, H = F.h * CELL, z = Math.min(cv.width / W, cv.height / H) * 0.97;
  return { F, z, ox: (cv.width - W * z) / 2 - F.gx * CELL * z, oy: (cv.height - H * z) / 2 };
}
const onFloor = (x, y) => S.map.flAt[Math.floor(y / CELL) * S.map.W + Math.floor(x / CELL)] === S.fl;

function draw(el) {
  if (!S || !S.map || !S.rend) return;
  const cv = el.querySelector('#mkCanvas'), d = fit(cv), c = cv.getContext('2d'), m = S.map, { F, z, ox, oy } = view(cv);
  const R = S.rend, k = R.c.width / R.Wp;
  c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#0b0e12'; c.fillRect(0, 0, cv.width, cv.height);
  c.setTransform(z, 0, 0, z, ox, oy);
  c.imageSmoothingQuality = 'high';
  c.drawImage(R.c, F.gx * CELL * k, 0, F.w * CELL * k, F.h * CELL * k, F.gx * CELL, 0, F.w * CELL, F.h * CELL);
  const px = 1 / z * d; // one screen pixel (scaled for the screen) in world units
  const txt = (s, x, y, size, col, bold = 700) => {
    c.font = `${bold} ${size * px}px Barlow Condensed, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 3 * px; c.strokeStyle = 'rgba(0,0,0,0.85)'; c.strokeText(s, x, y); c.fillStyle = col; c.fillText(s, x, y);
  };
  // breakable walls: everything else is concrete
  if (S.on.soft) {
    c.fillStyle = 'rgba(224,118,58,0.55)';
    for (let y = 0; y < F.h; y++) for (let x = F.gx; x < F.gx + F.w; x++) { const t = m.tiles[y * m.W + x]; if (t === T.SOFT) c.fillRect(x * CELL, y * CELL, CELL, CELL); }
  }
  // bomb sites: the rooms of each pair, and the two bomb spots
  if (S.on.sites) m.sites.forEach((s, i) => {
    const col = SITE_COL[i % SITE_COL.length], picked = S.site < 0 || S.site === i;
    c.globalAlpha = picked ? 1 : 0.25;
    for (const name of s.rooms || []) for (const r of m.rooms) if (r.name === name && r.fl === S.fl) {
      c.fillStyle = col + (S.site === i ? '40' : '22'); c.fillRect(r.x * CELL, r.y * CELL, r.w * CELL, r.h * CELL);
      c.strokeStyle = col; c.lineWidth = (S.site === i ? 3 : 1.5) * px; c.strokeRect(r.x * CELL, r.y * CELL, r.w * CELL, r.h * CELL);
    }
    for (const b of s.bombs) if (onFloor(b.x, b.y)) {
      c.fillStyle = col; c.beginPath(); c.arc(b.x, b.y, 11 * px, 0, 7); c.fill(); c.lineWidth = 2 * px; c.strokeStyle = '#000'; c.stroke();
      c.font = `800 ${13 * px}px Barlow Condensed, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#000'; c.fillText(b.id, b.x, b.y + 0.5 * px);
      txt(`${i + 1}`, b.x + 15 * px, b.y - 13 * px, 15, col);
    }
    c.globalAlpha = 1;
  });
  if (S.on.hatches) for (const h of m.hatches || []) for (const [hx, hy, below] of [[h.x, h.y, false], [h.bx, h.by, true]]) {
    if (!onFloor(hx, hy)) continue;
    c.strokeStyle = '#c8a06a'; c.lineWidth = 2 * px; c.setLineDash([4 * px, 3 * px]); c.strokeRect(hx - CELL, hy - CELL, CELL * 2, CELL * 2); c.setLineDash([]);
    txt(below ? 'HATCH ABOVE' : 'HATCH', hx, hy + CELL + 8 * px, 10, '#e6c08a');
  }
  if (S.on.stairs) for (const s of m.stairs || []) for (const [g, f, up] of [[s.ga, s.a, true], [s.gb, s.b, false]]) {
    if (f !== S.fl) continue;
    const x = (g % m.W + s.w / 2) * CELL, y = (Math.floor(g / m.W) + s.h / 2) * CELL, other = m.floors[up ? s.b : s.a];
    txt(`${up ? '▲' : '▼'} ${other ? other.name : ''}`, x, y, 13, '#fff');
  }
  if (S.on.ropes) for (const r of m.ropes || []) {
    if (r.f === S.fl) { // the window you climb to, and the stretch of wall you can slide along
      c.strokeStyle = '#cda564'; c.lineWidth = 3 * px; c.beginPath();
      c.moveTo(r.hang.x + r.tx * r.a, r.hang.y + r.ty * r.a); c.lineTo(r.hang.x + r.tx * r.b, r.hang.y + r.ty * r.b); c.stroke();
    }
    if (onFloor(r.base.x, r.base.y)) {
      c.strokeStyle = '#cda564'; c.lineWidth = 2 * px;
      for (const rr of [7, 4]) { c.beginPath(); c.arc(r.base.x, r.base.y, rr * px, 0, 7); c.stroke(); }
    }
  }
  if (S.on.cams) for (const q of S.cams) if (onFloor(q.x, q.y)) {
    c.fillStyle = '#9fb3c8'; c.strokeStyle = '#000'; c.lineWidth = 1.5 * px;
    c.beginPath(); c.arc(q.x, q.y, 5 * px, 0, 7); c.fill(); c.stroke();
    if (q.n !== null) { c.fillStyle = 'rgba(159,179,200,0.18)'; c.beginPath(); c.moveTo(q.x, q.y); c.arc(q.x, q.y, 40 * px, q.n - 0.6, q.n + 0.6); c.closePath(); c.fill(); }
  }
  if (S.on.spawns) for (const sp of m.atkSpawns || []) if (onFloor(sp.x, sp.y)) {
    c.fillStyle = '#ff8a3d'; c.strokeStyle = '#000'; c.lineWidth = 2 * px;
    c.beginPath(); c.moveTo(sp.x, sp.y - 10 * px); c.lineTo(sp.x + 9 * px, sp.y + 7 * px); c.lineTo(sp.x - 9 * px, sp.y + 7 * px); c.closePath(); c.fill(); c.stroke();
    txt(sp.name.toUpperCase(), sp.x, sp.y + 18 * px, 13, '#ffb07a');
  }
  if (S.on.rooms) for (const r of m.rooms) if (r.fl === S.fl) {
    const big = S.on.sites && m.sites.some(s => (s.rooms || []).includes(r.name));
    txt(r.name.replace(/^\dF /, ''), (r.x + r.w / 2) * CELL, (r.y + r.h / 2) * CELL - (big ? 22 * px : 0), big ? 16 : 13, big ? '#fff' : 'rgba(225,230,235,0.85)', big ? 700 : 600);
  }
  // hovering a room: its name, big, at the top
  c.setTransform(1, 0, 0, 1, 0, 0);
  if (S.hover) { c.font = `700 ${18 * d}px Barlow Condensed, sans-serif`; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillStyle = '#fff'; c.fillText(S.hover, 12 * d, 10 * d); }
  c.textBaseline = 'alphabetic';
}

function hover(el, e) {
  if (!S.map) return;
  const cv = el.querySelector('#mkCanvas'), r = cv.getBoundingClientRect(), d = cv.width / r.width, { z, ox, oy } = view(cv);
  const x = ((e.clientX - r.left) * d - ox) / z, y = ((e.clientY - r.top) * d - oy) / z, cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
  const room = S.map.rooms.find(q => q.fl === S.fl && cx >= q.x && cx < q.x + q.w && cy >= q.y && cy < q.y + q.h);
  const site = room && S.map.sites.findIndex(s => (s.rooms || []).includes(room.name));
  const label = room ? room.name + (site >= 0 ? `  ·  bomb site pair ${site + 1}` : '') : null;
  if (label !== S.hover) { S.hover = label; draw(el); }
}
