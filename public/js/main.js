// R62D browser client: connects to the server, predicts your movement,
// draws the world with line-of-sight blackout, and runs the menus and HUD.
import { CELL, PHASE, T, MAT } from '/shared/constants.js';
import { buildMap, roomAt } from '/shared/map.js';
import { stepMove, castSight, canSee, facingCell, angDiff } from '/shared/physics.js';
import { OPERATORS, WEAPONS, GADGETS, opsForTeam } from '/shared/operators.js';
import { MapRenderer } from './mapdraw.js';
import { S } from './textures.js';
import { drawOperator, drawDrone, drawCam, drawGadget, drawBomb, portrait } from './sprites.js';
import { FX, drawSmoke } from './fx.js';
import * as audio from './audio.js';
import { openOps, closeOps, updateOpsProfile } from './ops.js';
import { openProfile } from './profile.js';
import { LOADOUTS, GADGET_COUNT, cleanLoadout } from '/shared/operators.js';
import { ACTIONS, actionFor, bindsFor, setBind, resetBinds, keyName, label } from './keys.js';
import { walkRay, tileAt } from '/shared/physics.js';
import { blocksSight, FL } from '/shared/constants.js';

const $ = id => document.getElementById(id);
const cv = $('game'), ctx = cv.getContext('2d');
const fog = document.createElement('canvas'), fctx = fog.getContext('2d');
let DPR = 1, VW = 0, VH = 0;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  VW = cv.width = Math.round(innerWidth * DPR); VH = cv.height = Math.round(innerHeight * DPR);
  fog.width = Math.ceil(VW / 2); fog.height = Math.ceil(VH / 2);
}
addEventListener('resize', resize); resize();

// ---------------- state ----------------
const st = {
  ws: null, id: null, map: null, base: null, rend: null, mv: -1,
  snaps: [], last: null, me: null, pending: [], seq: 0, pred: { x: 0, y: 0 }, predCtrl: null, predDid: null,
  anim: new Map(), corpses: [], spect: 0, cam: { x: 600, y: 450 }, aim: 0, crouch: false,
  hitT: -9, hitKill: false, hurtT: -9, hurtFrom: 0, flashUntil: 0, bannerT: 0, evq: [], selBuilt: null,
  lastHud: 0, sideKnown: null, muted: false, endT: 0,
};
const fx = new FX();
const keys = new Set();
const mouse = { x: 0, y: 0, l: false, r: false, wl: 0, wr: 0 };

// ---------------- network ----------------
function connect() {
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  st.ws = ws;
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.t === 'welcome') {
      st.id = m.id; loadMap(m.mapVersion, m.tiles, m.hp);
      st.token = m.token; st.profile = m.profile;
      try { localStorage.setItem('r62d-token', m.token); } catch {}
      $('join').classList.add('hidden'); $('room').classList.remove('hidden');
    } else if (m.t === 'snap') onSnap(m);
    else if (m.t === 'full') alert('The game is full (10 players).');
    else if (m.t === 'profile') { st.profile = m.profile; updateOpsProfile($('opsPage'), m.profile); st.selBuilt = null; }
  };
  ws.onclose = () => { $('conn').classList.remove('hidden'); $('conn').textContent = 'Disconnected — reconnecting…'; setTimeout(() => location.reload(), 2500); };
}
const send = o => { if (st.ws && st.ws.readyState === 1) st.ws.send(JSON.stringify(o)); };

function loadMap(mv, tiles, hp) {
  st.map = buildMap(); st.base = st.map.tiles.slice(); st.mv = mv;
  if (tiles) { st.map.tiles.set(tiles); st.map.hp.set(hp); }
  // What your team remembers of the map. It only catches up with the real map when
  // someone on your team actually sees the changed spot.
  st.known = { ...st.map, tiles: st.map.tiles.slice(), hp: st.map.hp.slice() };
  st.unseen = new Set();
  st.rend = new MapRenderer(st.known, st.base);
  st.corpses = []; fx.clear(); st.pending = [];
}

function onSnap(s) {
  if (s.mv !== st.mv) loadMap(s.mv);
  const m = st.map, now = performance.now() / 1000;
  const changed = [];
  for (let i = 0; i < s.cells.length; i += 3) {
    const k = s.cells[i];
    m.tiles[k] = s.cells[i + 1]; m.hp[k] = s.cells[i + 2];
    st.unseen.add(k);
  }
  if (s.ph !== PHASE.PREP && s.ph !== PHASE.ACTION && s.ph !== PHASE.ROUND_END) revealAll();
  const players = new Map(s.players.map(p => [p.id, p]));
  const ents = new Map(s.ents.map(e => [e.id, e]));
  st.snaps.push({ t: now, players, ents }); if (st.snaps.length > 12) st.snaps.shift();
  const prevMe = st.me;
  st.last = s; st.me = players.get(s.you) || null;
  for (const e of s.ev) onEvent(e, s, players);
  reconcile(prevMe);
}

function myCtrlPos(me, s) {
  if (!me || !me.a) return null;
  if (me.ct === 'drone') { const d = s.ents.find(e => e.id === me.did); return d ? { x: d.x, y: d.y } : null; }
  return { x: me.x, y: me.y };
}

function reconcile() {
  const me = st.me, s = st.last;
  const pos = myCtrlPos(me, s);
  if (!pos) { st.pending = []; return; }
  if (st.predCtrl !== me.ct || st.predDid !== me.did) { st.predCtrl = me.ct; st.predDid = me.did; st.pending = []; }
  st.pending = st.pending.filter(i => i.s > me.ls);
  st.pred.x = pos.x; st.pred.y = pos.y;
  const mods = me.m || {};
  for (const i of st.pending) stepMove(st.map, st.pred, i.k, i.dt, mods);
}

// ---------------- events from the server ----------------
function mySide() { return st.me ? st.me.tm : null; }
function nameOf(players, id) { const p = players.get(id); return p ? p.n : '?'; }

function onEvent(e, s, players) {
  const now = performance.now() / 1000;
  switch (e.e) {
    case 'shot': {
      const w = WEAPONS[e.w]; const a = Math.atan2(e.y2 - e.y, e.x2 - e.x);
      fx.tracer(e.x, e.y, e.x2, e.y2);
      const an = anim(e.id);
      if (an.lastShotSnd !== s.time) { fx.muzzle(e.x, e.y, a); audio.gunshot(w ? w.cls : 'AR', e.x, e.y, e.id === st.id); audio.casing(e.x, e.y, surfaceAt(e.x, e.y), w && w.cls === 'Shotgun'); an.lastShotSnd = s.time; }
      an.recoil = 1.6; an.flashT = now;
      if (e.k === 'hard') { fx.impact(e.x2, e.y2, 'hard', a); audio.impact(hardMat(e.x2, e.y2, a), e.x2, e.y2); }
      else if (e.k === 'prop') { fx.impact(e.x2, e.y2, 'prop', a); audio.impact(Math.random() < 0.5 ? 'wood' : 'metal', e.x2, e.y2); }
      // a bullet passing close to you cracks past your ear
      if (e.id !== st.id && st.listen) {
        const L = st.listen, dx = e.x2 - e.x, dy = e.y2 - e.y, len2 = dx * dx + dy * dy || 1;
        const tt = Math.max(0, Math.min(1, ((L.x - e.x) * dx + (L.y - e.y) * dy) / len2));
        const px = e.x + dx * tt, py = e.y + dy * tt;
        if (tt > 0.05 && tt < 0.98 && Math.hypot(px - L.x, py - L.y) < 34) audio.whiz(px, py);
      }
      break;
    }
    case 'hit':
      fx.impact(e.x, e.y, e.k, e.a || 0);
      if (e.k === 'blood') { st.rend.blood(e.x, e.y, e.a || 0); audio.impact('flesh', e.x, e.y); }
      else if (e.k === 'spark') audio.impact('electronic', e.x, e.y);
      else if (e.k === 'wall') audio.impact(wallMat(e.x, e.y, e.a), e.x, e.y);
      else if (e.k === 'wood') audio.impact('wood', e.x, e.y);
      else if (e.k === 'shield') audio.impact('metal', e.x, e.y);
      break;
    case 'boom':
      fx.explosion(e.x, e.y, e.r, e.kind);
      if (e.kind !== 'stun' && e.kind !== 'emp') st.rend.scorch(e.x, e.y, Math.min(40, e.r * 0.6));
      audio.explosion(e.x, e.y, e.kind);
      break;
    case 'kill': {
      const v = players.get(e.victim), k = e.killer ? players.get(e.killer) : null;
      const prev = st.snaps.length > 1 ? st.snaps[st.snaps.length - 2].players.get(e.victim) : null;
      const pos = prev && prev.x !== undefined ? prev : null;
      if (pos && v && (v.tm === mySide() || teamSees(pos.x, pos.y))) { st.corpses.push({ x: pos.x, y: pos.y, aim: pos.ag, op: v.op, w: pos.w, ally: v.tm === mySide() }); st.rend.pool(pos.x, pos.y); }
      addKill(k, v, e.w);
      break;
    }
    case 'down': { const v = players.get(e.id); if (v) addFeed(`${v.n} is down`); break; }
    case 'msg': if (!e.team || e.team === mySide()) addFeed(e.text); break;
    case 'banner': if (!e.team || e.team === mySide()) banner(e.text, e.sub); audio.ui('round'); break;
    case 'roundEnd': {
      const won = st.me && e.squad === st.me.sq;
      banner(won ? 'ROUND WON' : 'ROUND LOST', e.reason, won ? 'var(--ally)' : 'var(--enemy)');
      break;
    }
    case 'matchEnd': st.endT = now; showEnd(e.squad); break;
    case 'stun': if (st.me && e.id === st.me.id) st.flashUntil = now + e.dur; break;
    case 'hurt': if (st.me && e.id === st.me.id) { st.hurtT = now; st.hurtFrom = e.from; } break;
    case 'hitmark': if (e.to === st.id) { st.hitT = now; st.hitKill = e.kill; audio.ui(e.kill ? 'kill' : 'hit'); } break;
    case 'ping': if (e.team === mySide()) { fx.ping(e.x, e.y, e.any ? '255,90,60' : '79,179,169'); audio.foley('beep', e.x, e.y); } break;
    case 'stim': fx.tracer(e.x, e.y, e.x2, e.y2, '120,255,160'); fx.ping(e.x2, e.y2, '120,255,160'); audio.foley('revive', e.x, e.y); break;
    case 'melee': anim(e.id).melee = 1; { const p = players.get(e.id); if (p && p.x !== undefined) audio.foley('melee', p.x, p.y, e.id === st.id); } break;
    case 'snd': audio.play(e.s, e.x, e.y); break;
  }
}

function anim(id) { let a = st.anim.get(id); if (!a) st.anim.set(id, a = { walk: 0, recoil: 0, melee: 0, flashT: -9, lx: 0, ly: 0, stepAcc: 0 }); return a; }

// ---------------- input ----------------
// `keys` holds the names of actions currently held down (see keys.js for the bindings).
let rebinding = null;
addEventListener('keydown', e => {
  if (rebinding) { e.preventDefault(); if (e.code !== 'Escape') setBind(rebinding.id, rebinding.slot, e.code); rebinding = null; renderSettings(); return; }
  if (e.code === 'Escape' && document.activeElement && document.activeElement.tagName === 'INPUT') document.activeElement.blur();
  if (document.activeElement && document.activeElement.tagName === 'INPUT') { if (e.key === 'Enter') $('joinBtn').click(); return; }
  const a = actionFor(e.code);
  if (a || e.code === 'AltLeft' || e.code === 'AltRight' || e.code === 'Tab') e.preventDefault();
  if (!a || keys.has(a)) return;
  keys.add(a);
  audio.initAudio();
  const ev = st.evq;
  switch (a) {
    case 'reload': ev.push({ k: 'reload' }); break;
    case 'primary': ev.push({ k: 'slot', n: 0 }); break;
    case 'secondary': ev.push({ k: 'slot', n: 1 }); break;
    case 'melee': ev.push({ k: 'melee' }); break;
    case 'gadget': ev.push({ k: 'gadget' }); audio.foley('gadget'); break;
    case 'ability': ev.push({ k: 'ability' }); audio.foley('gadget'); break;
    case 'view': ev.push({ k: 'view' }); break;
    case 'crouch': st.crouch = !st.crouch; break;
    case 'settings': toggleSettings(); break;
    case 'pause': escape(); break;
    case 'spot': st.spotReq = true; break;
    case 'left': case 'right': if (st.me && st.me.ct === 'cam') ev.push({ k: a === 'right' ? 'camNext' : 'camPrev' }); break;
  }
});
addEventListener('keyup', e => {
  if (e.code === 'AltLeft' || e.code === 'AltRight') e.preventDefault(); // stop Firefox's menu bar popping up
  const a = actionFor(e.code); if (a) keys.delete(a);
});
addEventListener('blur', () => { keys.clear(); mouse.l = mouse.r = false; });
cv.addEventListener('mousemove', e => { mouse.x = e.clientX * DPR; mouse.y = e.clientY * DPR; });
cv.addEventListener('mousedown', e => {
  audio.initAudio();
  if (e.button === 0) { mouse.l = true; mouse.wl++; }
  if (e.button === 2) { mouse.r = true; mouse.wr++; }
});
addEventListener('mouseup', e => { if (e.button === 0) mouse.l = false; if (e.button === 2) mouse.r = false; });
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('wheel', e => {
  if (!st.me || !st.me.a) return;
  if (st.me.ct === 'cam') st.evq.push({ k: e.deltaY > 0 ? 'camNext' : 'camPrev' });
  else st.evq.push({ k: 'slot', n: st.me.sl === 0 ? 1 : 0 });
}, { passive: true });
cv.addEventListener('mousedown', e => { if (e.button === 1) { e.preventDefault(); st.spotReq = true; } });

// ---------------- settings ----------------
function toggleSettings() { $('settings').classList.toggle('hidden'); renderSettings(); }
function renderSettings() {
  const el = $('settings'); if (el.classList.contains('hidden')) return;
  const rows = ACTIONS.map(([id, name]) => {
    const b = bindsFor(id);
    const btn = slot => `<button data-id="${id}" data-slot="${slot}" class="${rebinding && rebinding.id === id && rebinding.slot === slot ? 'wait' : ''}">${rebinding && rebinding.id === id && rebinding.slot === slot ? 'PRESS A KEY…' : keyName(b[slot])}</button>`;
    return `<tr><td>${name}</td><td>${btn(0)}</td><td>${btn(1)}</td></tr>`;
  }).join('');
  $('bindTable').innerHTML = `<tr><th>ACTION</th><th>KEY</th><th>ALTERNATE</th></tr>${rows}
    <tr><td>Shoot / Aim down sights</td><td>Left mouse</td><td>Right mouse</td></tr>
    <tr><td>Mark enemy</td><td>Middle mouse</td><td></td></tr>`;
  for (const b of $('bindTable').querySelectorAll('button')) b.onclick = () => { rebinding = { id: b.dataset.id, slot: +b.dataset.slot }; renderSettings(); };
}
$('setReset').onclick = () => { resetBinds(); renderSettings(); };
$('setClose').onclick = () => toggleSettings();
$('setBtn').onclick = () => toggleSettings();
$('lobbySetBtn').onclick = () => toggleSettings();
const saveVol = () => { try { localStorage.setItem('r62d-vol', JSON.stringify([+$('volMaster').value, +$('volSfx').value])); } catch {} };
try { const v = JSON.parse(localStorage.getItem('r62d-vol') || 'null'); if (v) { $('volMaster').value = v[0]; $('volSfx').value = v[1]; } } catch {}
const applyVol = () => audio.setVolume(st.muted ? 0 : $('volMaster').value / 100, $('volSfx').value / 100);
$('volMaster').oninput = () => { applyVol(); saveVol(); };
$('volSfx').oninput = () => { applyVol(); saveVol(); };
applyVol();

// ---------------- menus ----------------
$('name').value = (() => { try { return localStorage.getItem('r62d-name') || ''; } catch { return ''; } })();
$('joinBtn').onclick = () => {
  audio.initAudio(); audio.ui();
  const n = $('name').value.trim() || 'Operator';
  try { localStorage.setItem('r62d-name', n); } catch {}
  let token = null; try { token = localStorage.getItem('r62d-token'); } catch {}
  send({ t: 'join', name: n, token });
};
document.querySelectorAll('[data-bot]').forEach(b => b.onclick = () => { audio.ui(); send({ t: 'lobby', a: 'addBot', squad: +b.dataset.bot }); });
document.querySelectorAll('[data-unbot]').forEach(b => b.onclick = () => { audio.ui(); send({ t: 'lobby', a: 'removeBot', squad: +b.dataset.unbot }); });
$('switchBtn').onclick = () => { audio.ui(); send({ t: 'lobby', a: 'switch' }); };
$('fillBtn').onclick = () => { audio.ui(); send({ t: 'lobby', a: 'fillBots' }); };
$('startBtn').onclick = () => { audio.ui(); send({ t: 'lobby', a: 'start' }); };
$('leaveBtn').onclick = () => { if (confirm('End the match for everyone and go back to the lobby?')) send({ t: 'lobby', a: 'end' }); };
$('fsBtn').onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); };
$('muteBtn').onclick = () => { st.muted = !st.muted; applyVol(); $('muteBtn').textContent = st.muted ? '🔇' : '🔊'; };
function renderControls() {
  const L = id => keyName(bindsFor(id)[0]);
  const rows = [[`${L('up')}${L('left')}${L('down')}${L('right')}`, 'Move'], ['Mouse', 'Aim'], ['Left click', 'Shoot'], ['Right click', 'Aim down sights'],
    [L('sprint'), 'Sprint'], [L('walk'), 'Slow walk (silent)'], [L('crouch'), 'Crouch'], [L('reload'), 'Reload'],
    [L('interact') + ' (hold)', 'Reinforce, barricade, plant, defuse, revive'], [L('ability'), 'Operator skill'],
    [L('gadget'), 'Secondary gadget'], [L('melee'), 'Melee'], [L('view'), 'Drone / Cameras'], [L('spot') + ' · Middle click', 'Mark enemy'],
    [`${L('primary')} / ${L('secondary')} · Wheel`, 'Switch weapon'], [L('scoreboard'), 'Scoreboard']];
  const html = rows.map(([k, d]) => `<span>${k}</span>${d}`).join('');
  if ($('ctlGrid').innerHTML !== html) $('ctlGrid').innerHTML = html;
}


function renderLobby(s) {
  renderControls();
  for (const sq of [0, 1]) {
    const ul = document.querySelector(`#sq${sq} ul`);
    const list = s.players.filter(p => p.sq === sq);
    const html = list.map(p => `<li class="${p.id === s.you ? 'me' : ''}"><span>${esc(p.n)}</span>${p.b ? '<span class="bot">BOT</span>' : ''}</li>`).join('') +
      Array(Math.max(0, 5 - list.length)).fill('<li style="opacity:.3"><span>— empty —</span></li>').join('');
    if (ul.innerHTML !== html) ul.innerHTML = html;
  }
}
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function buildSelect(s) {
  const me = st.me; if (!me) return;
  const side = me.tm, key = s.rd + side;
  if (st.selBuilt !== key) {
    st.selBuilt = key;
    const grid = $('opgrid'); grid.innerHTML = '';
    for (const k of opsForTeam(side)) {
      const o = OPERATORS[k];
      const d = document.createElement('div'); d.className = 'op'; d.dataset.op = k;
      const c = document.createElement('canvas'); c.width = 240; c.height = 240; portrait(c, k);
      const speed = o.armor, armor = 4 - o.armor;
      const pips = n => [1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('');
      const lo = cleanLoadout(k, st.profile && st.profile.loadouts[k]);
      const g = GADGETS[lo.gadget];
      d.innerHTML = `<div class="who"></div>`;
      d.appendChild(c);
      const info = document.createElement('div'); info.className = 'info';
      info.innerHTML = `<div class="nm">${o.name}</div><div class="role">${o.role}</div>
        <div class="pips"><span>ARMOR ${pips(armor)}</span><span>SPEED ${pips(speed)}</span></div>
        <div>${WEAPONS[lo.primary].name} <span style="color:var(--dim)">${WEAPONS[lo.primary].cls}</span>${lo.secondary ? ' · ' + WEAPONS[lo.secondary].name : ''}</div>
        <div>${g.name} ×${GADGET_COUNT[lo.gadget]} <button class="lo" title="Change loadout">LOADOUT</button></div>
        <div class="ab">${o.ability.name}${o.ability.count ? ' ×' + o.ability.count : ''}</div><div>${o.ability.desc}</div>`;
      d.appendChild(info);
      info.querySelector('.lo').onclick = e => { e.stopPropagation(); showOps(k); };
      d.onclick = () => { audio.ui(); send({ t: 'pick', op: k }); };
      grid.appendChild(d);
    }
  }
  const mates = s.players.filter(p => p.sq === me.sq);
  for (const d of document.querySelectorAll('#opgrid .op')) {
    const who = mates.find(p => p.op === d.dataset.op);
    d.classList.toggle('mine', !!who && who.id === me.id);
    d.classList.toggle('taken', !!who && who.id !== me.id);
    d.querySelector('.who').textContent = who ? who.n : '';
    d.querySelector('.who').style.display = who ? '' : 'none';
  }
  $('selSide').textContent = `ROUND ${s.rd} — ${side === 'atk' ? 'ATTACK' : 'DEFENCE'}`;
  $('selSide').style.color = side === 'atk' ? '#ffb27a' : '#8fc8ff';
  const site = st.map.sites[s.site];
  $('selInfo').textContent = side === 'def' ? `DEFEND: ${site.name.toUpperCase()}  ·  HARBOR OFFICE` : `SPAWN: ${String(s.spawn).toUpperCase()}  ·  OBJECTIVE UNKNOWN  ·  HARBOR OFFICE`;
  $('selTime').textContent = Math.ceil(s.tm);
  $('picks').innerHTML = mates.map(p => `<span><b>${esc(p.n)}</b> ${p.op ? OPERATORS[p.op].name : '…'}</span>`).join('');
}

function banner(text, sub, color) {
  const b = $('banner'); b.querySelector('.t').textContent = text; b.querySelector('.s').textContent = sub || '';
  b.querySelector('.t').style.color = color || ''; b.classList.add('show'); st.bannerT = performance.now() / 1000 + 3;
}
function addFeed(text) { const d = document.createElement('div'); d.textContent = text; $('feed').appendChild(d); setTimeout(() => d.remove(), 7000); }
function addKill(k, v, w) {
  if (!v) return;
  const side = mySide(), cls = p => p && p.tm === side ? 'a' : 'e';
  const d = document.createElement('div');
  d.innerHTML = k && k !== v ? `<span class="${cls(k)}">${esc(k.n)}</span><span class="w">${esc(w || '').toUpperCase()}</span><span class="${cls(v)}">${esc(v.n)}</span>` : `<span class="${cls(v)}">${esc(v.n)}</span><span class="w">${esc(w || 'DIED').toUpperCase()}</span>`;
  $('killfeed').appendChild(d); setTimeout(() => d.remove(), 6000);
  while ($('killfeed').children.length > 6) $('killfeed').firstChild.remove();
}
function showEnd(squad) {
  const me = st.me, won = me && me.sq === squad;
  const e = $('endscreen'); e.classList.remove('hidden');
  e.querySelector('.t').textContent = won ? 'VICTORY' : 'DEFEAT'; e.querySelector('.t').className = 't ' + (won ? 'win' : 'lose');
  const sc = st.last.sc; e.querySelector('.s').textContent = me ? `${sc[me.sq]} — ${sc[1 - me.sq]}` : '';
  e.querySelector('.board').innerHTML = scoreTable(st.last);
}
function scoreTable(s) {
  const me = st.me;
  const rows = [...s.players].sort((a, b) => (a.sq - b.sq) || (b.k - a.k)).map(p =>
    `<tr class="${me && p.sq === me.sq ? 'ally' : 'enemy'} ${p.id === s.you ? 'me' : ''} ${p.a ? '' : 'dead'}"><td>${esc(p.n)}</td><td>${p.op ? OPERATORS[p.op].name : '—'}</td><td>${p.k}</td><td>${p.d}</td></tr>`).join('');
  return `<table><tr><th>PLAYER</th><th>OPERATOR</th><th>KILLS</th><th>DEATHS</th></tr>${rows}</table>`;
}

// ---------------- interpolation ----------------
const DELAY = 0.1;
function interp(id, kind) {
  const snaps = st.snaps; if (!snaps.length) return null;
  const rt = performance.now() / 1000 - DELAY;
  let a = null, b = null;
  for (let i = snaps.length - 1; i >= 0; i--) if (snaps[i].t <= rt) { a = snaps[i]; b = snaps[i + 1] || null; break; }
  if (!a) a = snaps[0];
  const pa = a[kind].get(id), pb = b ? b[kind].get(id) : null;
  if (!pa) return pb || snaps[snaps.length - 1][kind].get(id) || null;
  if (!pb || pa.x === undefined || pb.x === undefined) return pa;
  const f = Math.max(0, Math.min(1, (rt - a.t) / (b.t - a.t || 1)));
  const o = { ...pb, x: pa.x + (pb.x - pa.x) * f, y: pa.y + (pb.y - pa.y) * f };
  if (pa.ag !== undefined && pb.ag !== undefined) o.ag = pa.ag + angDiff(pb.ag, pa.ag) * f;
  return o;
}

// ---------------- main loop ----------------
let lastT = performance.now();
function frame(nowMs) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (nowMs - lastT) / 1000); lastT = nowMs;
  const now = nowMs / 1000;
  const s = st.last;
  fx.update(dt);
  if (!st.map) { ctx.fillStyle = '#050607'; ctx.fillRect(0, 0, VW, VH); return; }
  const phase = s ? s.ph : PHASE.LOBBY;
  const inGame = phase === PHASE.PREP || phase === PHASE.ACTION || phase === PHASE.ROUND_END;
  screens(s, phase, now);
  const me = st.me;

  // --- view source ---
  let view = null, ctrl = me && me.a ? me.ct : null;
  const camsAlive = s ? s.ents.filter(e => e.ty === 'cam' && e.hp > 0) : [];
  if (inGame && me && me.a) {
    if (ctrl === 'drone') view = { x: st.pred.x, y: st.pred.y, ang: st.aim, fov: Math.PI * 2, range: 230, near: 0, kind: 'drone' };
    else if (ctrl === 'cam') { const c = camsAlive[me.ci % Math.max(1, camsAlive.length)]; if (c) view = { x: c.x, y: c.y, ang: st.aim, fov: 1.9, range: 650, near: 14, kind: 'cam', off: c.off, cam: c }; }
    else view = { x: st.pred.x, y: st.pred.y, ang: st.aim, fov: fovFor(me), range: 1100, near: 26, kind: 'body' };
  } else if (inGame && me) {
    const mates = s.players.filter(p => p.a && p.sq === me.sq && p.id !== me.id);
    if (mouse.wl > 0) { st.spect++; mouse.wl = 0; }
    if (mates.length) {
      const m = interp(mates[st.spect % mates.length].id, 'players');
      if (m) view = { x: m.x, y: m.y, ang: m.ag, fov: fovFor(m), range: 1100, near: 26, kind: 'spect', name: m.n };
    }
  }

  // --- input & prediction ---
  if (view && (view.kind === 'body' || view.kind === 'drone')) {
    const mw = screenToWorld(mouse.x, mouse.y);
    st.aim = Math.atan2(mw.y - st.pred.y, mw.x - st.pred.x);
  } else if (view && view.kind === 'cam') {
    if (st.lastCam !== view.cam.id) { // switching cameras: start from that camera's current direction
      st.lastCam = view.cam.id; st.aim = view.cam.ag || 0; view.ang = st.aim; audio.foley('camSwitch');
      mouse.x = VW / 2 + Math.cos(st.aim) * VH * 0.25; mouse.y = VH / 2 + Math.sin(st.aim) * VH * 0.25;
    } else if (Math.hypot(mouse.x - VW / 2, mouse.y - VH / 2) > 20 * DPR) st.aim = Math.atan2(mouse.y - VH / 2, mouse.x - VW / 2);
    view.ang = st.aim;
  }
  if (!view || view.kind !== 'cam') st.lastCam = null;
  sendInput(dt, me, ctrl, view, s, now);

  // --- camera ---
  let cx, cy;
  if (view) {
    cx = view.x; cy = view.y;
    if (view.kind === 'body') {
      const mw = screenToWorld(mouse.x, mouse.y);
      const vh = st.viewH || 400;
      const lx = (mw.x - st.pred.x) * 0.22, ly = (mw.y - st.pred.y) * 0.22, l = Math.hypot(lx, ly), mx = vh * (me && me.ad ? 0.32 : 0.2);
      cx += l > mx ? lx / l * mx : lx; cy += l > mx ? ly / l * mx : ly;
    }
  } else { // menus: slow drift over the map
    cx = st.map.W * CELL / 2 + Math.cos(now * 0.05) * 300; cy = st.map.H * CELL / 2 + Math.sin(now * 0.07) * 160;
  }
  const k = 1 - Math.exp(-dt * 14);
  st.cam.x += (cx - st.cam.x) * k; st.cam.y += (cy - st.cam.y) * k;
  if (view && view.kind !== 'body') { st.cam.x = cx; st.cam.y = cy; }
  // zoom: close in tight rooms, wider outside or when looking down a long sightline
  let want = 600;
  if (view && view.kind === 'drone') want = 300;
  else if (view) {
    let sum = 0;
    for (let i = 0; i < 24; i++) sum += castSight(st.map, view.x, view.y, i / 24 * Math.PI * 2, 700, null);
    const avg = sum / 24, aimD = castSight(st.map, view.x, view.y, view.ang, 900, null);
    want = Math.max(300, Math.min(620, avg * 1.5 + 150));
    want = Math.max(want, Math.min(view.kind === 'cam' ? 720 : 680, aimD * (view.kind === 'cam' ? 0.9 : 0.75)));
  }
  st.viewH = st.viewH || want;
  st.viewH += (want - st.viewH) * (1 - Math.exp(-dt * 2.2));
  st.zoom = VH / st.viewH;
  if (view && view.kind === 'cam') { st.cam.x = view.x + Math.cos(view.ang) * st.viewH * 0.28; st.cam.y = view.y + Math.sin(view.ang) * st.viewH * 0.28; }
  { // never look past the edge of the map
    const hw = VW / 2 / st.zoom, hh = VH / 2 / st.zoom, mw = st.map.W * CELL, mh = st.map.H * CELL;
    st.cam.x = mw > hw * 2 ? Math.max(hw, Math.min(mw - hw, st.cam.x)) : mw / 2;
    st.cam.y = mh > hh * 2 ? Math.max(hh, Math.min(mh - hh, st.cam.y)) : mh / 2;
  }
  if (view) { audio.setListener(view.x, view.y); st.listen = { x: view.x, y: view.y }; }

  st.viewers = teamViewers(s, view, me, inGame);
  revealSeen();
  bodySounds(me, dt);
  draw(s, view, now, dt);
}

function screenToWorld(sx, sy) { const z = st.zoom || 1; return { x: (sx - VW / 2) / z + st.cam.x, y: (sy - VH / 2) / z + st.cam.y }; }

function sendInput(dt, me, ctrl, view, s, now) {
  const ev = st.evq; st.evq = [];
  const typing = document.activeElement && document.activeElement.tagName === 'INPUT';
  const k = {
    up: keys.has('up') ? 1 : 0, down: keys.has('down') ? 1 : 0, left: keys.has('left') ? 1 : 0, right: keys.has('right') ? 1 : 0,
    sprint: keys.has('sprint') ? 1 : 0, walk: keys.has('walk') ? 1 : 0, crouch: st.crouch ? 1 : 0, fire: mouse.l ? 1 : 0, ads: mouse.r ? 1 : 0,
    interact: keys.has('interact') ? 1 : 0, ability: keys.has('ability') ? 1 : 0,
  };
  if (typing || menuOpen()) { for (const key in k) k[key] = 0; ev.length = 0; }
  // mark the enemy nearest the cursor that you can actually see
  const trySpot = () => {
    if (!view || !me) return;
    const mw = screenToWorld(mouse.x, mouse.y);
    let best = null, bd = 45;
    for (const p of s.players) if (p.a && p.tm !== me.tm && p.x !== undefined) {
      const d = Math.hypot(p.x - mw.x, p.y - mw.y);
      if (d < bd && canSee(st.map, view, p.x, p.y, smokes(s))) { bd = d; best = p; }
    }
    if (best) { ev.push({ k: 'spot', id: best.id }); audio.foley('spot'); }
  };
  if (ctrl === 'cam' || ctrl === 'drone') {
    if (mouse.wl) trySpot();
    if (ctrl === 'cam') { k.up = k.down = k.left = k.right = 0; }
    k.fire = 0; k.ads = 0;
  }
  if (st.spotReq) { trySpot(); st.spotReq = false; }
  mouse.wl = 0; mouse.wr = 0;
  if (!me || !s) return;
  const ph = s.ph;
  if (me.a && (ph === PHASE.PREP || ph === PHASE.ACTION) && (ctrl === 'body' || ctrl === 'drone')) {
    const mods = me.m || {};
    stepMove(st.map, st.pred, k, dt, mods);
  }
  const msg = { t: 'input', s: ++st.seq, k, a: Math.round(st.aim * 1000) / 1000, dt: Math.round(dt * 10000) / 10000 };
  const mw = screenToWorld(mouse.x, mouse.y); msg.ax = Math.round(mw.x); msg.ay = Math.round(mw.y);
  if (ev.length) msg.ev = ev;
  st.pending.push({ s: msg.s, k, dt: msg.dt });
  if (st.pending.length > 120) st.pending.shift();
  send(msg);
}

const smokes = s => s ? s.ents.filter(e => e.ty === 'smoke').map(e => ({ x: e.x, y: e.y, r: e.r })) : [];

// ---------------- what things are made of (for sound) ----------------
const FLOOR_SURF = { [FL.WOOD]: 'wood', [FL.TILE]: 'tile', [FL.SERVER]: 'metal', [FL.MARBLE]: 'marble', [FL.CARPET]: 'carpet', [FL.CONCRETE]: 'concrete', [FL.GRASS]: 'grass', [FL.ASPHALT]: 'asphalt' };
function cellAt(x, y) { const m = st.map, cx = Math.floor(x / CELL), cy = Math.floor(y / CELL); return cx < 0 || cy < 0 || cx >= m.W || cy >= m.H ? -1 : cy * m.W + cx; }
function surfaceAt(x, y) {
  const k = cellAt(x, y); if (k < 0) return 'concrete';
  const b = st.base[k], t = st.map.tiles[k];
  if ((b === T.SOFT || b === T.HARD) && (t === T.FLOOR || t === T.GROUND || t === T.OPEN)) return 'rubble';
  return FLOOR_SURF[st.map.floor[k]] || 'concrete';
}
function wallMat(x, y, a) {
  const k = cellAt(x + Math.cos(a || 0) * 3, y + Math.sin(a || 0) * 3); if (k < 0) return 'drywall';
  const t = st.map.tiles[k];
  if (t === T.BARRI) return 'wood';
  return st.map.mat[k] === MAT.BRICK ? 'brick' : 'drywall';
}
function hardMat(x, y, a) {
  const k = cellAt(x + Math.cos(a) * 3, y + Math.sin(a) * 3); if (k < 0) return 'concrete';
  const t = st.map.tiles[k];
  return t === T.REINF || t === T.PANEL || t === T.DSHIELD ? 'metal' : t === T.TALL ? (Math.random() < 0.5 ? 'wood' : 'metal') : 'concrete';
}
audio.setWorld(
  (x, y) => { // how many walls between you and the sound (0-3)
    const L = st.listen; if (!L || !st.map) return 0;
    const d = Math.hypot(x - L.x, y - L.y); if (d < 1) return 0;
    let n = 0; const sk = cellAt(L.x, L.y), ek = cellAt(x, y);
    walkRay(L.x, L.y, (x - L.x) / d, (y - L.y) / d, d, (cx, cy) => {
      const k = cy * st.map.W + cx;
      if (k !== sk && k !== ek && blocksSight(tileAt(st.map, cx, cy))) n++;
      return n >= 3;
    });
    return Math.min(3, Math.ceil(n / 1.5));
  },
  (x, y) => { const k = cellAt(x, y); return k >= 0 && st.map && st.map.floor[k] !== FL.GRASS && st.map.floor[k] !== FL.ASPHALT; },
);

// Little sounds from each player's state: footsteps per surface, turning on the spot,
// aiming, crouching, weapon swaps, reload stages, hammering, planting...
function playerFoley(p, a, moved, own, dt) {
  const w = WEAPONS[p.w], shotgun = w && w.cls === 'Shotgun';
  const pace = p.dn ? 1 : p.wk ? 0 : p.cr ? 1 : p.mv >= 3 ? 3 : 2;
  const stride = [19, 22, 27, 34][pace];
  a.stepAcc += moved;
  if (a.stepAcc > stride) { a.stepAcc = 0; audio.step(p.x, p.y, surfaceAt(p.x, p.y), pace, own); }
  // turning on the spot: legs shuffle
  const dAng = Math.abs(angDiff(p.ag, a.lag ?? p.ag)); a.lag = p.ag;
  if (moved < 0.3 && !p.dn) {
    a.walk += dAng * 2.4; a.turnAcc = (a.turnAcc || 0) + dAng;
    if (a.turnAcc > 0.8) { a.turnAcc = 0; audio.shuffle(p.x, p.y, surfaceAt(p.x, p.y), own); }
  } else a.turnAcc = 0;
  if (a.pAd !== undefined) {
    if (p.ad !== a.pAd && !p.dn) audio.foley(p.ad ? 'adsIn' : 'adsOut', p.x, p.y, own);
    if (p.cr !== a.pCr && !p.dn) audio.foley(p.cr ? 'crouch' : 'stand', p.x, p.y, own);
    if (p.w !== a.pW && p.w) audio.foley('draw', p.x, p.y, own);
    if (p.mv && !a.pMv) audio.foley('cloth', p.x, p.y, own);
    if (p.dn && !a.pDn) audio.foley('hurt', p.x, p.y, own);
  }
  if (p.rl > 0) {
    if (!a.r1 && p.rl > 0.1) { a.r1 = 1; audio.foley(shotgun ? 'shell' : 'magOut', p.x, p.y, own); if (!shotgun) setTimeout(() => audio.foley('magDrop', p.x, p.y, own), 350); }
    if (!a.r2 && p.rl > (shotgun ? 0.35 : 0.58)) { a.r2 = 1; audio.foley(shotgun ? 'shell' : 'magIn', p.x, p.y, own); }
    if (!a.r3 && p.rl > (shotgun ? 0.6 : 0.84)) { a.r3 = 1; audio.foley(shotgun ? 'shell' : 'bolt', p.x, p.y, own); }
  } else a.r1 = a.r2 = a.r3 = 0;
  if (p.bu) {
    a.buT = (a.buT || 0) - dt;
    if (a.buT <= 0) {
      const k = p.bu.k;
      if (k === 'reinforce') { audio.foley('hammer', p.x, p.y, own); a.buT = 0.36 + Math.random() * 0.1; }
      else if (k === 'barricade') { audio.foley('nail', p.x, p.y, own); a.buT = 0.28; }
      else if (k === 'plant') { audio.foley('beep', p.x, p.y, own); a.buT = 0.7 - p.bu.p * 0.5; }
      else if (k === 'defuse') { audio.foley('tick', p.x, p.y, own); a.buT = 0.22; }
      else { audio.foley('cloth', p.x, p.y, own); a.buT = 0.5; }
    }
  } else a.buT = 0;
  a.pAd = p.ad; a.pCr = p.cr; a.pW = p.w; a.pMv = p.mv; a.pDn = p.dn;
}

// ---------------- drawing ----------------
function visionPolygon(v, sm, rays = 0) {
  const pts = [];
  const full = v.fov >= Math.PI * 2 - 0.01;
  const n = rays || (full ? 360 : 300);
  if (!full) pts.push(v.x, v.y);
  for (let i = 0; i <= n; i++) {
    const a = v.ang - v.fov / 2 + v.fov * i / n;
    const d = Math.min(v.range, castSight(st.map, v.x, v.y, a, v.range, sm) + 7);
    pts.push(v.x + Math.cos(a) * d, v.y + Math.sin(a) * d);
  }
  return pts;
}
function nearPolygon(v, sm) {
  const pts = [];
  for (let i = 0; i <= 64; i++) {
    const a = i / 64 * Math.PI * 2;
    const d = Math.min(v.near, castSight(st.map, v.x, v.y, a, v.near, sm) + 5);
    pts.push(v.x + Math.cos(a) * d, v.y + Math.sin(a) * d);
  }
  return pts;
}
function fillPoly(c, pts) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); c.fill(); }

function draw(s, view, now, dt) {
  const z = st.zoom, m = st.map;
  const shake = fx.shake;
  const ox = VW / 2 - st.cam.x * z + (Math.random() - 0.5) * shake * DPR, oy = VH / 2 - st.cam.y * z + (Math.random() - 0.5) * shake * DPR;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VW, VH);
  ctx.setTransform(z, 0, 0, z, ox, oy);
  ctx.imageSmoothingEnabled = true;
  // visible window of the map picture
  const wx0 = Math.max(0, st.cam.x - VW / 2 / z - 20), wy0 = Math.max(0, st.cam.y - VH / 2 / z - 20);
  const wx1 = Math.min(m.W * CELL, st.cam.x + VW / 2 / z + 20), wy1 = Math.min(m.H * CELL, st.cam.y + VH / 2 / z + 20);
  if (wx1 > wx0 && wy1 > wy0) {
    ctx.drawImage(st.rend.c, wx0 * S, wy0 * S, (wx1 - wx0) * S, (wy1 - wy0) * S, wx0, wy0, wx1 - wx0, wy1 - wy0);
    ctx.drawImage(st.rend.decal, wx0, wy0, wx1 - wx0, wy1 - wy0, wx0, wy0, wx1 - wx0, wy1 - wy0);
  }
  if (!s) return;
  const me = st.me, side = me ? me.tm : null;
  const inGame = s.ph === PHASE.PREP || s.ph === PHASE.ACTION || s.ph === PHASE.ROUND_END;
  const sm = smokes(s);
  const seen = (x, y) => !view || teamSees(x, y);
  const spotted = new Set(side && s.spots[side] ? s.spots[side] : []);

  // objective
  if (inGame) {
    const site = m.sites[s.site];
    if (side === 'def' || s.rev || !me) for (const b of site.bombs) if (!s.pl || s.pl.b !== b.id) drawBomb(ctx, b, now);
    if (s.pl) {
      ctx.save(); ctx.translate(s.pl.x, s.pl.y);
      const pulse = (now * 2) % 1;
      ctx.strokeStyle = `rgba(255,60,60,${1 - pulse})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 8 + pulse * 30, 0, 7); ctx.stroke();
      ctx.fillStyle = '#2a2a2a'; ctx.fillRect(-6, -4, 12, 8); ctx.fillStyle = '#ff3030'; ctx.fillRect(-4, -2, 8, 4);
      ctx.restore();
    }
  }
  // corpses
  for (const c of st.corpses) drawOperator(ctx, { ...c, downed: true }, now);

  // gadgets / entities
  const ents = s.ents.map(e => interp(e.id, 'ents') || e);
  for (const e of ents) {
    const ally = e.tm === side;
    if (e.ty === 'drone' || e.ty === 'cam' || e.ty === 'smoke') continue;
    if (!ally && !seen(e.x, e.y)) continue;
    if (e.ty === 'mine' && !ally && !(view && Math.hypot(e.x - view.x, e.y - view.y) < 140)) continue;
    drawGadget(ctx, e, now, ally);
  }
  for (const e of ents) if (e.ty === 'cam' && (e.tm === side || seen(e.x, e.y))) drawCam(ctx, e, now);

  // players
  const drawn = [];
  for (const sp of s.players) {
    if (!sp.a) continue;
    const isMe = me && sp.id === me.id;
    let p = isMe ? { ...sp } : interp(sp.id, 'players');
    if (!p || p.x === undefined) continue;
    if (isMe && me.ct === 'body') { p.x = st.pred.x; p.y = st.pred.y; p.ag = st.aim; }
    const ally = p.tm === side;
    const a = anim(p.id);
    const moved = Math.hypot(p.x - a.lx, p.y - a.ly);
    a.walk += moved * 0.32; a.lx = p.x; a.ly = p.y;
    playerFoley(p, a, moved, isMe, dt);
    a.recoil = Math.max(0, a.recoil - dt * 12); a.melee = Math.max(0, a.melee - dt * 4);
    const vis = ally || isMe || seen(p.x, p.y);
    if (!vis) continue;
    drawOperator(ctx, {
      x: p.x, y: p.y, aim: p.ag, op: p.op, w: p.w, ally, walk: a.walk, ads: p.ad, crouch: p.cr, downed: p.dn,
      recoil: a.recoil, flash: now - a.flashT < 0.045, reload: p.rl > 0, brace: p.br, scan: p.sc, melee: a.melee,
    }, now);
    drawn.push(p);
  }
  for (const e of ents) if (e.ty === 'drone') { // motor whine for every moving drone you can hear
    const a = anim(e.id), sp = Math.hypot(e.x - (a.dx ?? e.x), e.y - (a.dy ?? e.y)) / Math.max(dt, 0.001); a.dx = e.x; a.dy = e.y;
    const own = me && e.id === me.did && me.ct === 'drone';
    audio.droneLoop(e.id, own ? st.pred.x : e.x, own ? st.pred.y : e.y, Math.min(240, own ? (keys.has('up') || keys.has('down') || keys.has('left') || keys.has('right') ? 200 : 0) : sp));
  }
  audio.pruneLoops();
  for (const e of ents) if (e.ty === 'drone' && (e.tm === side || seen(e.x, e.y))) {
    const d = me && e.id === me.did && me.ct === 'drone' ? { ...e, x: st.pred.x, y: st.pred.y, ag: st.aim } : e;
    drawDrone(ctx, d, now, e.tm === side);
  }
  fx.draw(ctx);
  for (const e of ents) if (e.ty === 'smoke') drawSmoke(ctx, e, now);
  fx.drawLights(ctx);

  // --- line-of-sight blackout ---
  if (view && inGame) {
    fctx.setTransform(1, 0, 0, 1, 0, 0);
    fctx.globalCompositeOperation = 'source-over';
    fctx.fillStyle = '#000'; fctx.fillRect(0, 0, fog.width, fog.height);
    fctx.setTransform(z / 2, 0, 0, z / 2, ox / 2, oy / 2);
    // the dull grey remembered map
    const G = st.rend.G;
    if (wx1 > wx0 && wy1 > wy0) fctx.drawImage(st.rend.grey, wx0 * G, wy0 * G, (wx1 - wx0) * G, (wy1 - wy0) * G, wx0, wy0, wx1 - wx0, wy1 - wy0);
    // cut out everything your team can see right now
    fctx.globalCompositeOperation = 'destination-out';
    for (const v of st.viewers) {
      if (v.off) continue;
      if (v.near) { fctx.fillStyle = v === view ? 'rgba(0,0,0,0.5)' : '#000'; fillPoly(fctx, nearPolygon(v, sm)); }
      fctx.fillStyle = '#000'; fillPoly(fctx, visionPolygon(v, sm, v === view ? 0 : 140));
    }
    fctx.globalCompositeOperation = 'source-over';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(fog, 0, 0, VW, VH);
    ctx.setTransform(z, 0, 0, z, ox, oy);
  }

  // --- markers drawn above the blackout ---
  if (inGame && me) {
    ctx.font = '600 6px Barlow Condensed, sans-serif'; ctx.textAlign = 'center';
    for (const sp of s.players) {
      if (!sp.a || sp.id === me.id) continue;
      const p = interp(sp.id, 'players'); if (!p || p.x === undefined) continue;
      if (p.tm === side) {
        ctx.fillStyle = p.dn ? '#ff5050' : '#3aa0ff'; ctx.beginPath(); ctx.arc(p.x, p.y - 17, 2, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillText(p.n + (p.dn ? ' ▼' : ''), p.x, p.y - 21);
      } else if (spotted.has(p.id)) {
        ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(p.x, p.y - 22); ctx.lineTo(p.x - 4, p.y - 29); ctx.lineTo(p.x + 4, p.y - 29); ctx.closePath(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,60,60,0.25)'; ctx.beginPath(); ctx.arc(p.x, p.y, 11, 0, 7); ctx.fill();
      }
    }
    // objective markers
    const site = m.sites[s.site];
    if (side === 'def' || s.rev) for (const b of site.bombs) marker(b.x, b.y, b.id, '#f2c14e', view);
    if (s.pl) marker(s.pl.x, s.pl.y, '!', '#ff4040', view);
    if (side === 'atk') for (const e of ents) if (e.ty === 'defuser') marker(e.x, e.y, 'D', '#f2c14e', view);
    // footstep direction hints around you
    if (view && view.kind === 'body') for (const p of drawn) { /* visible: no hint */ }
    if (view && view.kind === 'body') for (const sp of s.players) {
      if (!sp.a || sp.tm === side || sp.x === undefined || !sp.mv || sp.cr) continue;
      const p = interp(sp.id, 'players'); const d = Math.hypot(p.x - view.x, p.y - view.y);
      const range = sp.mv >= 3 ? 420 : 260;
      if (d > range || seen(p.x, p.y)) continue;
      const a = Math.atan2(p.y - view.y, p.x - view.x), al = (1 - d / range) * 0.8;
      ctx.strokeStyle = `rgba(255,140,60,${al})`; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(view.x, view.y, 30, a - 0.22, a + 0.22); ctx.stroke();
    }
    // interaction progress ring
    if (me.a && me.bu && me.ct === 'body') {
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(st.pred.x, st.pred.y, 18, 0, 7); ctx.stroke();
      ctx.strokeStyle = '#f2c14e'; ctx.beginPath(); ctx.arc(st.pred.x, st.pred.y, 18, -Math.PI / 2, -Math.PI / 2 + me.bu.p * Math.PI * 2); ctx.stroke();
    }
    // aim line for grenades so you can judge throws
    if (me.a && me.ct === 'body' && keys.has('gadget')) {
      const mw = screenToWorld(mouse.x, mouse.y);
      ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(st.pred.x, st.pred.y); ctx.lineTo(mw.x, mw.y); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  // --- screen-space effects ---
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const vg = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.45, VW / 2, VH / 2, VH * 0.95);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
  if (view && view.kind === 'drone') droneOverlay(now, ents);
  if (view && view.kind === 'cam') camOverlay(view, now);
  if (me && me.a && me.sc) { ctx.fillStyle = 'rgba(70,90,255,0.12)'; ctx.fillRect(0, 0, VW, VH); }
  const hurtK = Math.max(0, 1 - (now - st.hurtT) / 0.8);
  if (hurtK > 0) {
    const g = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.3, VW / 2, VH / 2, VH * 0.8);
    g.addColorStop(0, 'rgba(160,0,0,0)'); g.addColorStop(1, `rgba(160,0,0,${0.45 * hurtK})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    ctx.save(); ctx.translate(VW / 2, VH / 2); ctx.rotate(st.hurtFrom);
    ctx.fillStyle = `rgba(255,40,40,${0.8 * hurtK})`; ctx.beginPath(); ctx.moveTo(VH * 0.2, -22 * DPR); ctx.lineTo(VH * 0.24, 0); ctx.lineTo(VH * 0.2, 22 * DPR); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  if (me && me.a && me.dn) { ctx.fillStyle = 'rgba(90,0,0,0.25)'; ctx.fillRect(0, 0, VW, VH); }
  const fl = st.flashUntil - now;
  if (fl > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(1, fl / 1.2)})`; ctx.fillRect(0, 0, VW, VH); }
  if (inGame && me && me.a && (me.ct === 'body')) crosshair(me, now);
  else if (inGame) { ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 2 * DPR, 0, 7); ctx.fill(); }
}

function marker(x, y, label, col, view) {
  const z = st.zoom;
  // clamp to screen edges so you can always find it
  const sx = (x - st.cam.x) * z + VW / 2, sy = (y - st.cam.y) * z + VH / 2, pad = 40 * DPR;
  const cx = Math.max(pad, Math.min(VW - pad, sx)), cy = Math.max(pad + 60 * DPR, Math.min(VH - pad - 60 * DPR, sy));
  const wx = (cx - VW / 2) / z + st.cam.x, wy = (cy - VH / 2) / z + st.cam.y;
  ctx.save(); ctx.translate(wx, wy - (cx === sx && cy === sy ? 14 : 0));
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, 7); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = col; ctx.font = '700 7px Barlow Condensed, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 0, 0.5);
  if (view) { const d = Math.round(Math.hypot(x - view.x, y - view.y) / CELL * 0.8); ctx.font = '600 5px Barlow Condensed, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillText(d + 'm', 0, 9); }
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

function crosshair(me, now) {
  const w = WEAPONS[me.w];
  const base = w ? (me.ad ? w.ads : w.spread) : 0.05;
  const gap = (4 + base * 160 + (me.mv >= 2 ? 6 : 0)) * DPR;
  const x = mouse.x, y = mouse.y;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.5 * DPR;
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 2;
  ctx.beginPath();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.moveTo(x + dx * gap, y + dy * gap); ctx.lineTo(x + dx * (gap + 7 * DPR), y + dy * (gap + 7 * DPR)); }
  ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.fillRect(x - DPR, y - DPR, 2 * DPR, 2 * DPR);
  const hk = 1 - (now - st.hitT) / 0.18;
  if (hk > 0) {
    ctx.strokeStyle = st.hitKill ? `rgba(255,60,60,${hk})` : `rgba(255,255,255,${hk})`; ctx.lineWidth = 2 * DPR;
    ctx.beginPath();
    for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { ctx.moveTo(x + dx * 5 * DPR, y + dy * 5 * DPR); ctx.lineTo(x + dx * 11 * DPR, y + dy * 11 * DPR); }
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
}

function droneOverlay(now, ents) {
  const d = ents.find(e => st.me && e.id === st.me.did);
  ctx.strokeStyle = 'rgba(160,255,200,0.6)'; ctx.lineWidth = 2 * DPR;
  const p = 60 * DPR, L = 40 * DPR;
  for (const [x, y, sx, sy] of [[p, p, 1, 1], [VW - p, p, -1, 1], [p, VH - p, 1, -1], [VW - p, VH - p, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(x, y + sy * L); ctx.lineTo(x, y); ctx.lineTo(x + sx * L, y); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(140,255,190,0.04)'; for (let y = 0; y < VH; y += 4 * DPR) ctx.fillRect(0, y, VW, DPR);
  if (d && d.j) { // jammed: static
    for (let i = 0; i < 400; i++) { ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.25})`; ctx.fillRect(Math.random() * VW, Math.random() * VH, 30 * DPR * Math.random(), 2 * DPR); }
  }
}
function camOverlay(view, now) {
  ctx.fillStyle = 'rgba(30,60,90,0.18)'; ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = 'rgba(255,255,255,0.035)'; for (let y = (now * 40 * DPR) % (4 * DPR); y < VH; y += 4 * DPR) ctx.fillRect(0, y, VW, DPR);
  ctx.fillStyle = Math.floor(now * 2) % 2 ? '#ff3030' : 'rgba(255,48,48,0.3)'; ctx.beginPath(); ctx.arc(80 * DPR, 120 * DPR, 7 * DPR, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `700 ${18 * DPR}px Barlow Condensed`; ctx.textAlign = 'left'; ctx.fillText('REC', 94 * DPR, 126 * DPR);
  if (view.off) { for (let i = 0; i < 900; i++) { ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.4})`; ctx.fillRect(Math.random() * VW, Math.random() * VH, 4 * DPR, 2 * DPR); } }
}

// ---------------- screens & HUD ----------------
function screens(s, phase, now) {
  const show = (id, on) => $(id).classList.toggle('hidden', !on);
  const joined = !!st.id;
  show('lobby', phase === PHASE.LOBBY || !joined);
  show('select', joined && phase === PHASE.SELECT);
  show('hud', joined && (phase === PHASE.PREP || phase === PHASE.ACTION || phase === PHASE.ROUND_END));
  show('endscreen', joined && phase === PHASE.MATCH_END);
  show('leaveBtn', joined && phase !== PHASE.LOBBY);
  if (st.bannerT && now > st.bannerT) { $('banner').classList.remove('show'); st.bannerT = 0; }
  if (!s || now - st.lastHud < 0.08) return;
  st.lastHud = now;
  if (phase === PHASE.LOBBY) renderLobby(s);
  else if (phase === PHASE.SELECT) buildSelect(s);
  else if (phase !== PHASE.MATCH_END) hud(s);
  $('scoreboard').classList.toggle('hidden', !keys.has('scoreboard'));
  if (keys.has('scoreboard')) $('scoreboard').innerHTML = scoreTable(s);
}

function hud(s) {
  const me = st.me; if (!me) return;
  const side = me.tm, site = st.map.sites[s.site];
  // top bar
  const icons = (list, ally) => list.map(p => {
    const known = ally || !p.a;
    const cls = [ally ? 'ally' : 'enemy', p.a ? '' : 'dead', p.dn ? 'down' : '', known ? '' : 'unknown'].join(' ');
    return `<div class="${cls}" title="${esc(p.n)}">${known && p.op ? OPERATORS[p.op].name.slice(0, 3) : '?'}</div>`;
  }).join('');
  const mine = s.players.filter(p => p.sq === me.sq), theirs = s.players.filter(p => p.sq !== me.sq);
  setHTML('tiL', icons(mine, true)); setHTML('tiR', icons(theirs, false));
  $('scL').textContent = s.sc[me.sq]; $('scR').textContent = s.sc[1 - me.sq];
  const t = s.pl ? s.pl.t : s.tm;
  $('time').textContent = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  $('time').classList.toggle('planted', !!s.pl);
  $('phase').textContent = s.pl ? 'DEFUSER' : s.ph === PHASE.PREP ? 'PREPARATION' : s.ph === PHASE.ACTION ? 'ACTION' : 'ROUND OVER';
  $('roundNo').textContent = `ROUND ${s.rd} · ${side === 'atk' ? 'ATTACK' : 'DEFENCE'}`;
  // objective
  let obj, sub = '';
  const where = me.a && me.x !== undefined ? roomAt(st.map, st.pred.x, st.pred.y) : '';
  if (side === 'def') {
    obj = s.pl ? 'DISABLE THE DEFUSER!' : s.ph === PHASE.PREP ? `FORTIFY: ${site.name}` : `DEFEND: ${site.name}`;
    sub = `Reinforcements left: ${s.rf}`;
  } else {
    obj = s.pl ? 'PROTECT THE DEFUSER' : s.ph === PHASE.PREP ? 'LOCATE THE OBJECTIVE WITH YOUR DRONE' : s.rev ? `PLANT THE DEFUSER: ${site.name}` : 'FIND THE OBJECTIVE';
    if (me.df) sub = 'You are carrying the defuser';
    else { const c = s.players.find(p => p.df); sub = c ? `${c.n} has the defuser` : 'The defuser is on the ground'; }
  }
  setHTML('objective', `${esc(obj)}<small>${esc(sub)}${where ? ' · ' + esc(where) : ''}</small>`);
  if (!me.a) {
    $('opname').innerHTML = me.op ? `${OPERATORS[me.op].name}` : '';
    $('hpnum').textContent = '—'; $('hpbar').firstElementChild.style.width = '0%';
    $('status').textContent = 'ELIMINATED'; $('br').style.visibility = 'hidden';
    $('prompt').innerHTML = ''; $('progress').style.display = 'none';
    const mates = s.players.filter(p => p.a && p.sq === me.sq);
    $('viewlabel').textContent = mates.length ? `SPECTATING ${mates[st.spect % mates.length].n.toUpperCase()} · CLICK TO SWITCH` : '';
    return;
  }
  $('br').style.visibility = '';
  const o = OPERATORS[me.op];
  $('opname').innerHTML = `${o.name}<small>${o.role.toUpperCase()}</small>`;
  $('hpnum').textContent = me.hp;
  const bar = $('hpbar').firstElementChild;
  bar.style.width = Math.min(100, me.hp / me.mhp * 100) + '%';
  bar.className = me.hp > me.mhp ? 'over' : me.hp < 35 || me.dn ? 'low' : '';
  $('status').textContent = me.dn ? `DOWNED — BLEEDING OUT · ${Math.ceil(me.hp)}s` : me.df ? 'DEFUSER CARRIER' : '';
  const w = WEAPONS[me.w];
  $('wname').textContent = w ? `${w.name.toUpperCase()} · ${w.cls.toUpperCase()}` : '';
  $('mag').textContent = me.rl > 0 ? '··' : me.am; $('mag').className = w && me.am <= w.mag * 0.25 ? 'low' : '';
  $('res').textContent = '/ ' + me.rs;
  const ab = o.ability, g = GADGETS[me.gd || o.gadget];
  const abCount = ab.id === 'scan' ? `${Math.round(me.bat / ab.battery * 100)}%` : ab.count ? me.ac : '';
  const viewName = side === 'atk' ? `Drone${s.ph === PHASE.ACTION ? ' ×' + me.dr : ''}` : 'Cameras';
  setHTML('gadgets',
    `<div class="${ab.count && me.ac <= 0 ? 'out' : ''}"><b>${label('ability')}</b>${ab.name}<em>${abCount}</em></div>` +
    `<div class="${me.gc <= 0 && !me.ni ? 'out' : ''}"><b>${label('gadget')}</b>${me.ni ? 'Detonate Nitro' : g.name}<em>${me.ni ? '!' : me.gc}</em></div>` +
    `<div><b>${label('view')}</b>${viewName}</div>`);
  // view label
  let vl = '';
  if (me.ct === 'drone') { const d = s.ents.find(e => e.id === me.did); vl = d && d.j ? 'DRONE JAMMED' : `DRONE · CLICK TO MARK ENEMIES · ${label('view')} TO EXIT`; }
  else if (me.ct === 'cam') { const cams = s.ents.filter(e => e.ty === 'cam' && e.hp > 0); const c = cams[me.ci % Math.max(1, cams.length)]; vl = c ? `CAMERA ${me.ci % cams.length + 1}/${cams.length} · ${roomAt(st.map, c.x, c.y).toUpperCase()} · MOUSE LOOK · ${label('left')} ${label('right')} SWITCH · CLICK MARK${c.off ? ' · DISRUPTED' : ''}` : ''; }
  $('viewlabel').textContent = vl;
  camBar(s, me);
  // interaction
  if (me.bu) {
    $('progress').style.display = 'block';
    $('progress').querySelector('.label').textContent = { plant: 'PLANTING DEFUSER', defuse: 'DISABLING DEFUSER', revive: 'REVIVING', reinforce: 'REINFORCING', barricade: 'BARRICADING' }[me.bu.k] || '';
    $('progress').querySelector('i').style.width = me.bu.p * 100 + '%';
    $('prompt').innerHTML = '';
  } else {
    $('progress').style.display = 'none';
    $('prompt').innerHTML = me.ct === 'body' && !me.dn ? promptText(s, me) : '';
  }
}
function setHTML(id, h) { const el = $(id); if (el.innerHTML !== h) el.innerHTML = h; }

function promptText(s, me) {
  const side = me.tm, x = st.pred.x, y = st.pred.y, m = st.map;
  if (side === 'atk' && me.df && s.ph === PHASE.ACTION && !s.pl) {
    const b = m.sites[s.site].bombs.find(b => Math.hypot(b.x - x, b.y - y) < 30);
    if (b) return `<b>${label('interact')}</b>HOLD TO PLANT DEFUSER (BOMB ${b.id})`;
  }
  if (side === 'def' && s.pl && Math.hypot(s.pl.x - x, s.pl.y - y) < 30) return '<b>' + label('interact') + '</b>HOLD TO DISABLE DEFUSER';
  const down = s.players.find(p => p.a && p.dn && p.tm === side && p.id !== me.id && Math.hypot(p.x - x, p.y - y) < 26);
  if (down) return `<b>${label('interact')}</b>HOLD TO REVIVE ${esc(down.n.toUpperCase())}`;
  const f = facingCell(m, x, y, st.aim, 28);
  if (side === 'def' && f) {
    if (f.t === T.SOFT && s.rf > 0) return `<b>${label('interact')}</b>HOLD TO REINFORCE WALL (${s.rf} LEFT)`;
    if (f.t === T.OPEN && m.openId[f.k] >= 0) return `<b>${label('interact')}</b>BARRICADE${me.op === 'mason' && me.ac > 0 ? '  ·  <b>' + label('ability') + '</b>ARMOR PANEL' : ''}`;
    if (f.t === T.BARRI && me.op === 'mason' && me.ac > 0) return '<b>' + label('ability') + '</b>ARMOR PANEL';
  }
  if (f && f.t === T.BARRI) return '<b>' + label('melee') + '</b>MELEE TO BREAK BARRICADE';
  if (side === 'atk' && f && me.op === 'ember' && me.ac > 0 && [T.SOFT, T.REINF, T.BARRI, T.PANEL].includes(f.t)) return '<b>' + label('ability') + '</b>PLACE PLASMA CUTTER';
  if (side === 'atk' && f && me.op === 'talon' && me.gc > 0 && [T.SOFT, T.BARRI].includes(f.t)) return '<b>' + label('gadget') + '</b>PLACE BREACH CHARGE';
  return '';
}

$('conn').classList.add('hidden');
connect();
requestAnimationFrame(frame);

// Field of view like a modern shooter: ~103° normally, narrower when aiming down sights.
const FOV_HIP = 103 * Math.PI / 180, FOV_ADS = 70 * Math.PI / 180, FOV_SCOPE = 55 * Math.PI / 180;
function fovFor(p) {
  const target = !p || !p.ad ? FOV_HIP : (WEAPONS[p.w] && WEAPONS[p.w].cls === 'DMR' ? FOV_SCOPE : FOV_ADS);
  const a = anim(p ? p.id : 'none');
  a.fov = a.fov === undefined ? target : a.fov + (target - a.fov) * 0.2; // smooth zoom in/out
  return a.fov;
}

// Your own heartbeat and breathing when badly hurt or downed.
function bodySounds(me, dt) {
  if (!me || !me.a || !st.last || st.last.ph !== PHASE.ACTION) return;
  st.hbT = (st.hbT || 0) - dt; st.brT = (st.brT || 0) - dt;
  if ((me.dn || me.hp < 35) && st.hbT <= 0) { audio.foley('heartbeat'); st.hbT = me.dn ? 0.85 : 1.15; }
  if (me.hp < 35 && !me.dn && st.brT <= 0) { audio.foley('breath'); st.brT = 3.2; }
}

// Clickable list of cameras along the bottom while you're watching them.
function camBar(s, me) {
  const bar = $('cambar');
  if (me.ct !== 'cam') { if (bar.innerHTML) bar.innerHTML = ''; return; }
  const cams = s.ents.filter(e => e.ty === 'cam');
  let alive = -1;
  const html = cams.map(c => {
    if (c.hp > 0) alive++;
    const on = c.hp > 0 && alive === me.ci % Math.max(1, cams.filter(x => x.hp > 0).length);
    return `<button data-n="${c.hp > 0 ? alive : -1}" class="${on ? 'on' : ''} ${c.hp > 0 ? '' : 'dead'}">CAM ${cams.indexOf(c) + 1}<small>${esc(roomAt(st.map, c.x, c.y).toUpperCase() || 'OUTSIDE')}${c.off ? ' · DISRUPTED' : ''}</small></button>`;
  }).join('');
  if (bar.innerHTML !== html) {
    bar.innerHTML = html;
    for (const b of bar.querySelectorAll('button')) b.onclick = e => { e.stopPropagation(); if (+b.dataset.n >= 0) st.evq.push({ k: 'camSet', n: +b.dataset.n }); };
  }
}

// ---------------- shared team vision ----------------
// Everything that can see for your team: you, teammates, their drones, and (defence) working cameras.
function teamViewers(s, view, me, inGame) {
  const vs = [];
  if (view) vs.push(view);
  if (!s || !me || !inGame) return vs;
  const side = me.tm;
  for (const sp of s.players) {
    if (!sp.a || sp.tm !== side || sp.x === undefined) continue;
    if (sp.id === me.id && view && view.kind === 'body') continue;
    const p = sp.id === me.id ? { ...sp, x: st.pred.x, y: st.pred.y } : interp(sp.id, 'players');
    if (!p || p.x === undefined) continue;
    if (view && view.kind === 'spect' && Math.hypot(view.x - p.x, view.y - p.y) < 1) continue;
    if (sp.id === me.id && me.ct === 'drone') { vs.push({ x: me.x, y: me.y, ang: me.ag, fov: fovFor(me), range: 1100, near: 26, kind: 'mate' }); continue; }
    vs.push({ x: p.x, y: p.y, ang: p.ag, fov: fovFor(p), range: 1100, near: 26, kind: 'mate' });
  }
  for (const e of s.ents) {
    if (e.tm !== side) continue;
    const ie = interp(e.id, 'ents') || e;
    if (e.ty === 'drone') {
      if (view && view.kind === 'drone' && me.did === e.id) continue;
      vs.push({ x: ie.x, y: ie.y, ang: 0, fov: Math.PI * 2, range: 230, near: 0, kind: 'drone' });
    } else if (e.ty === 'cam' && e.hp > 0 && !e.off && side === 'def') {
      if (view && view.kind === 'cam' && view.cam.id === e.id) continue;
      vs.push({ x: e.x, y: e.y, ang: e.ag || 0, fov: 1.9, range: 650, near: 14, kind: 'cam' });
    }
  }
  return vs;
}
function teamSees(x, y) {
  const sm = smokes(st.last);
  for (const v of st.viewers || []) if (!v.off && canSee(st.map, v, x, y, sm)) return true;
  return false;
}
// Is this map cell (often a wall, which blocks the line itself) visible to the team?
function cellSeen(k) {
  const m = st.map, x = (k % m.W + 0.5) * CELL, y = (Math.floor(k / m.W) + 0.5) * CELL;
  for (const v of st.viewers || []) {
    if (v.off) continue;
    const d = Math.hypot(x - v.x, y - v.y);
    if (d > v.range) continue;
    const a = Math.atan2(y - v.y, x - v.x);
    if (d > v.near + 12 && Math.abs(angDiff(a, v.ang)) > v.fov / 2 + 0.12) continue;
    if (d < 14 || castSight(m, v.x, v.y, a, d, null) >= d - 13) return true;
  }
  return false;
}
function applyKnown(k) {
  const m = st.map, K = st.known, prev = K.tiles[k];
  if (prev === m.tiles[k] && K.hp[k] === m.hp[k]) return;
  K.tiles[k] = m.tiles[k]; K.hp[k] = m.hp[k];
  st.rend.cellChanged(k);
  const wall = t => t === T.SOFT || t === T.BARRI || t === T.REINF || t === T.PANEL || t === T.DSHIELD;
  if (wall(prev) && !wall(m.tiles[k])) fx.wallBreak((k % m.W + 0.5) * CELL, (Math.floor(k / m.W) + 0.5) * CELL, prev === T.BARRI ? '150,100,55' : m.mat[k] === MAT.BRICK ? '150,80,60' : '210,205,190');
}
function revealSeen() {
  if (!st.unseen || !st.unseen.size) return;
  for (const k of st.unseen) if (cellSeen(k)) { applyKnown(k); st.unseen.delete(k); }
}
function revealAll() { if (!st.unseen) return; for (const k of st.unseen) applyKnown(k); st.unseen.clear(); }

// ---------------- pause menu & pages ----------------
const OVERLAYS = ['settings', 'opsPage', 'profilePage', 'pause'];
function menuOpen() { return OVERLAYS.some(id => !$(id).classList.contains('hidden')); }
function inMatch() { const p = st.last && st.last.ph; return p === PHASE.PREP || p === PHASE.ACTION || p === PHASE.ROUND_END || p === PHASE.SELECT; }
function showOps(op) { openOps($('opsPage'), { profile: st.profile, send, op }); }
function showProfile() { if (st.token) openProfile($('profilePage'), { token: st.token }); }
// Esc closes whatever is open, otherwise opens/closes the pause menu during a match.
function escape() {
  for (const id of ['settings', 'opsPage', 'profilePage']) if (!$(id).classList.contains('hidden')) {
    if (id === 'opsPage') closeOps($(id)); else $(id).classList.add('hidden');
    return;
  }
  if (inMatch() || !$('pause').classList.contains('hidden')) $('pause').classList.toggle('hidden');
}
// In fullscreen the browser uses Esc to leave fullscreen, so open the pause menu when that happens.
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && inMatch() && !menuOpen()) $('pause').classList.remove('hidden'); });
$('pResume').onclick = () => $('pause').classList.add('hidden');
$('pOps').onclick = () => showOps(st.me && st.me.op);
$('pProf').onclick = () => showProfile();
$('pSet').onclick = () => toggleSettings();
$('pFs').onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); $('pause').classList.add('hidden'); };
$('pEnd').onclick = () => { if (confirm('End the match for everyone and go back to the lobby?')) { send({ t: 'lobby', a: 'end' }); $('pause').classList.add('hidden'); } };
$('lobbyOpsBtn').onclick = () => showOps();
$('lobbyProfBtn').onclick = () => showProfile();
for (const id of ['opsPage', 'profilePage']) $(id).querySelector('.close').onclick = () => { if (id === 'opsPage') closeOps($(id)); else $(id).classList.add('hidden'); };
