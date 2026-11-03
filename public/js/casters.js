// ESPORTS TV casters (he asked: announcers you read while the pros play; Pro matches only). Two of our own:
// MAX REYES calls the action, IRIS KANE explains why it happened. Lines (shared/comms.js, CAST) come from what happens in
// the match. They leave gaps, and once someone is clutching they stop chatting and let you listen (he asked).
import { CAST, compose } from '/shared/comms.js';
const WHO = [{ name: 'MAX REYES', role: 'PLAY-BY-PLAY', col: '#ffd166' }, { name: 'IRIS KANE', role: 'ANALYST', col: '#8fd3ff' }];
let el = null, queue = [], lastKey = {}, recent = [[], []], clutch = false, gapT = 0;
const nm = n => (n || '').replace(/^\[\w+\] /, '');
const BIG = new Set(['hs', 'kill', 'plant', 'end', 'act', 'clutch']); // still called while someone is clutching

export function castReset() { queue = []; lastKey = {}; clutch = false; if (el) el.innerHTML = ''; }
function say(cat, slots = {}, key = null) {
  const def = CAST[cat]; if (!def) return;
  if (clutch && !BIG.has(cat)) return;
  const now = performance.now() / 1000;
  if (key && now - (lastKey[key] || -99) < 8) return;
  if (key) lastKey[key] = now;
  if (!def.prio && queue.length >= 2) return; // never fall behind the action
  const line = { who: def.tone === 'desk' ? 1 : 0, cat, slots, t: now };
  if (def.prio) queue.unshift(line); else queue.push(line);
}
function show(who, text) {
  const c = WHO[who], d = document.createElement('div'); d.className = 'cl';
  d.innerHTML = `<b style="color:${c.col}">${c.name}<small>${c.role}</small></b><span></span>`;
  d.querySelector('span').textContent = text;
  el.appendChild(d); while (el.children.length > 2) el.firstChild.remove();
  setTimeout(() => d.classList.add('old'), 7000);
}
// one frame: the next line once the last one has finished and a short gap has passed
export function castTick(on) {
  el = el || document.getElementById('tvCast');
  if (!el) return;
  el.classList.toggle('hidden', !on);
  if (!on) return;
  const now = performance.now() / 1000;
  if (!queue.length || now < gapT) return;
  const l = queue.shift();
  if (now - l.t > 8) return; // stale news
  const c = compose(WHO[l.who].name, l.cat, l.slots, recent[l.who]); if (!c) return;
  gapT = now + 1.2 + c.text.length * 0.04 + Math.random() * 1.6; // time to read it
  show(l.who, c.text);
}
// match moments from the snapshot events (main.js passes them on in Esports TV)
export function castEvent(e, ctx) {
  const { players, teamName, opName, alive } = ctx;
  if (e.e === 'ban') {
    say('ban', { team: teamName(e.sq), op: opName(e.op) });
    if (Math.random() < 0.3) say('banWhy', { op: opName(e.op) }, 'banwhy');
  } else if (e.e === 'kill') {
    const v = players.get(e.victim), k = e.killer ? players.get(e.killer) : null; if (!v) return;
    const [a, b] = alive();
    if (!k || k.id === v.id) say('self', { name: nm(v.n) }, 'k' + v.id);
    else if (k.sq === v.sq) say('tk', { name: nm(k.n) }, 'tk');
    else if (e.hs) say('hs', { name: nm(k.n), name2: nm(v.n) }, 'k' + k.id);
    else say('kill', { name: nm(k.n), name2: nm(v.n) }, 'k' + k.id);
    if ((a === 1 && b > 1) || (b === 1 && a > 1)) { const lone = [...players.values()].find(p => p.a && (a === 1 ? p.sq === 0 : p.sq === 1)); if (lone && !clutch) { say('clutch', { name: nm(lone.n) }, 'clutch'); clutch = true; queue = queue.filter(l => BIG.has(l.cat)); } }
    else if (Math.random() < 0.2) say('count', { n: String(Math.max(a, b)), n2: String(Math.min(a, b)) }, 'count');
  } else if (e.e === 'banner' && /PLANTED/.test(e.text)) {
    say('plant', {}, 'plant');
    if (Math.random() < 0.6) say('plantWhy', {}, 'plant2');
  } else if (e.e === 'roundEnd') {
    clutch = false;
    say('end', { team: teamName(e.squad) }, 'end');
    if (Math.random() < 0.5) say('endWhy', {}, 'end2');
  }
}
// once a phase: the start of operator select, preparation and the action
export function castPhase(ph, s, ctx) {
  const map = ctx.mapName, [t0, t1] = [ctx.teamName(0), ctx.teamName(1)];
  if (ph === 'select') {
    clutch = false;
    if (s.rd === 1) { say('welcome', { team: t0, team2: t1, map }, 'w'); say('bans', {}, 'w2'); }
    else say('round', { n: String(s.rd), team: t0, n2: String(s.sc[0]), team2: t1, n3: String(s.sc[1]) }, 'rd');
    if (s.rd > 1 && Math.max(...s.sc) === 2) say('mp', {}, 'mp');
  } else if (ph === 'prep') { if (Math.random() < 0.6) say('prep', {}, 'prep'); }
  else if (ph === 'action') say('act', {}, 'act');
}
