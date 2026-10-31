// The Operators page: who each operator is, their gear choices (saved per player), and your stats with them.
import { OPERATORS, WEAPONS, GADGETS, LOADOUTS, GADGET_COUNT, BIOS, OP_LIST, JOBS, jobOf, cleanLoadout, CLASS_NAME, CLASS_TIP, ATTACH, ATTACH_SLOTS, attachFor, cleanAtt } from '/shared/operators.js';
import { gunPicture } from './gunart.js';
import { drawOperator } from './sprites.js';
import { shade } from './textures.js';

const GADGET_DESC = {
  smoke: 'Blocks sight in an area for 12 seconds.', frag: 'Explodes after a short fuse. Deadly up close and breaks soft walls.',
  claymore: 'A tripwire explosive that fires forward at the first defender to walk into it.', breach: 'Stick it on a soft wall or barricade to blow a hole through it.',
  stun: 'Blinds everyone who can see it go off.', dshield: 'A waist-high bulletproof cover you can drop anywhere.',
  nitro: 'Throw it, then press the gadget key again to set it off.', wire: 'A coil of barbed wire that slows attackers and makes noise.',
  impact: 'Explodes on contact — opens soft walls and hatches in an instant.',
};
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let state = { sel: 'ember', profile: null, send: null, raf: 0 };

export function openOps(el, { profile, send, op }) {
  state.profile = profile; state.send = send; if (op) state.sel = op;
  state.side = OPERATORS[state.sel].team;
  el.classList.remove('hidden');
  render(el);
}
export function updateOpsProfile(el, profile) { state.profile = profile; if (!el.classList.contains('hidden')) renderDetail(el); }
export function closeOps(el) { el.classList.add('hidden'); cancelAnimationFrame(state.raf); }

// The same gear choices, drawn big inside the operator-select screen (no bio or stats, just what you take in).
const panel = { raf: 0 };
export function showLoadout(d, { profile, send, op }) {
  state.profile = profile; state.send = send;
  fillDetail(d, op, panel, true);
}

function loadoutOf(op) { return cleanLoadout(op, state.profile && state.profile.loadouts && state.profile.loadouts[op]); }

function render(el) {
  // laid out the way you meet them in a match (he asked): attack or defence, then each role with its operators
  const list = el.querySelector('#opsList'), side = state.side || OPERATORS[state.sel].team;
  list.innerHTML = `<div class="opsSides seg">${['atk', 'def'].map(t => `<button data-side="${t}" class="${t === side ? 'on' : ''}">${t === 'atk' ? 'ATTACK' : 'DEFENCE'}</button>`).join('')}</div>` +
    JOBS[side].map(j => `<div class="opsRole"><h4>${esc(j.name)}<small>${esc(j.desc)}</small></h4>` +
      j.ops.map(k => `<button class="opbtn ${k === state.sel ? 'on' : ''}" data-op="${k}" style="--c:${OPERATORS[k].color}">
      <canvas width="64" height="64"></canvas><span>${OPERATORS[k].name}<small>${OPERATORS[k].role}</small></span></button>`).join('') + '</div>').join('');
  for (const b of list.querySelectorAll('.opsSides button')) b.onclick = () => {
    state.side = b.dataset.side; if (OPERATORS[state.sel].team !== state.side) state.sel = JOBS[state.side][0].ops[0];
    render(el); list.scrollTop = 0;
  };
  for (const b of list.querySelectorAll('.opbtn')) {
    const c = b.querySelector('canvas'), k = b.dataset.op, x = c.getContext('2d');
    x.fillStyle = shade(OPERATORS[k].color, 0.35); x.fillRect(0, 0, 64, 64);
    x.save(); x.scale(64 / 34, 64 / 34); drawOperator(x, { x: 17, y: 17, aim: -0.6, op: k, w: loadoutOf(k).primary, ally: true }, 0); x.restore();
    b.onclick = () => { state.sel = k; render(el); };
  }
  renderDetail(el, true);
}

function bars(w) {
  const W = WEAPONS[w];
  const stat = (label, v) => `<div class="bar"><span>${label}</span><i><b style="width:${Math.max(4, Math.min(100, v))}%"></b></i></div>`;
  return stat('Damage', W.dmg * W.pellets / 1.2) + stat('Fire rate', W.rpm / 10) + stat('Magazine', W.mag / 0.8) +
    stat('Accuracy', 100 - W.ads * 1500) + stat('Range', W.range / 13);
}

function renderDetail(el, force) { fillDetail(el.querySelector('#opsDetail'), state.sel, state, false, force); }

// Clicking a gun, attachment or gadget (or the saved profile coming back) only updates what changed in place:
// rebuilding the whole panel replayed its slide-in and made it jump (he noticed the jitter).
function fillDetail(d, k, anim, compact, force) {
  if (!force && d.dataset.op === k && d._refresh) { d._refresh(); return; }
  const o = OPERATORS[k], bio = BIOS[k], L = LOADOUTS[k];
  let cur = loadoutOf(k);
  const s = state.profile && state.profile.stats && state.profile.stats.ops[k];
  const pips = n => [1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('');
  const weaponCard = (w, slot) => `<button class="wcard ${cur[slot] === w ? 'on' : ''}" data-slot="${slot}" data-v="${w}">
      <div class="wpic" data-w="${w}"></div>
      <div class="wn">${WEAPONS[w].name}<small>${CLASS_NAME[WEAPONS[w].cls]}</small></div><div class="wtip">${WEAPONS[w].trait || CLASS_TIP[WEAPONS[w].cls]}</div>${bars(w)}</button>`;
  // attachments for the gun chosen in that slot: three rows of choices, each with what it does
  const attRows = slot => {
    const w = cur[slot]; if (!w) return '';
    const a = cleanAtt(w, cur.att[w]), opts = attachFor(w);
    return `<div class="atts" data-slot="${slot}"><div class="atthead">${WEAPONS[w].name} attachments</div>` + ATTACH_SLOTS.map(([s, label]) => `<div class="attrow"><span>${label}</span>` +
      opts[s].map(v => `<button class="att ${a[s] === v ? 'on' : ''}" data-w="${w}" data-s="${s}" data-v="${v}" title="${ATTACH[s][v].desc}">${ATTACH[s][v].short}</button>`).join('') +
      `<em>${ATTACH[s][a[s]].desc}</em></div>`).join('') + '</div>';
  };
  const gadgetCard = g => `<button class="wcard g ${cur.gadget === g ? 'on' : ''}" data-slot="gadget" data-v="${g}">
      <div class="wn">${GADGETS[g].name}<small>×${GADGET_COUNT[g]}</small></div><p>${GADGET_DESC[g]}</p></button>`;
  const keepScroll = d.dataset.op === k ? d.scrollTop : 0; d.dataset.op = k;
  d.style.setProperty('--c', o.color);
  d.innerHTML = `
    <div class="ophero"><canvas class="opBig" width="420" height="420"></canvas>
      <div class="opinfo">
        <div class="side ${o.team}">${o.team === 'atk' ? 'ATTACKER' : 'DEFENDER'}</div>
        <h1>${o.name}</h1><div class="role">${o.role}</div>
        ${compact ? '' : `<div class="real">${esc(bio.real)} · ${esc(bio.from)}</div>
        <p class="bio">${esc(bio.text)}</p>`}
        <div class="pips"><span>ARMOR ${pips(4 - o.armor)}</span><span>SPEED ${pips(o.armor)}</span></div>
        <div class="ability"><b>${o.ability.name}${o.ability.count ? ' ×' + o.ability.count : ''}</b><p>${o.ability.desc}</p></div>
        ${compact ? '' : `<div class="mystats">${s ? `<div><b>${s.rounds}</b>ROUNDS</div><div><b>${s.rounds ? Math.round(s.roundsWon / s.rounds * 100) : 0}%</b>ROUNDS WON</div><div><b>${s.kills}</b>KILLS</div><div><b>${s.deaths}</b>DEATHS</div><div><b>${(s.kills / Math.max(1, s.deaths)).toFixed(2)}</b>K/D</div>` : '<div class="none">You haven\'t played this operator yet.</div>'}</div>`}
      </div></div>
    <h3>PRIMARY WEAPON</h3><div class="cards">${L.primaries.map(w => weaponCard(w, 'primary')).join('')}</div>${attRows('primary')}
    ${L.secondaries.length ? `<h3>SECONDARY WEAPON</h3><div class="cards">${L.secondaries.map(w => weaponCard(w, 'secondary')).join('')}</div>${attRows('secondary')}` : ''}
    <h3>GADGET</h3><div class="cards">${L.gadgets.map(gadgetCard).join('')}</div>
    <p class="hint">Your choices are saved to your profile and used every time you pick ${o.name}.</p>`;
  d.scrollTop = keepScroll;
  const save = l => {
    if (state.profile) { state.profile.loadouts = { ...state.profile.loadouts, [k]: l }; }
    if (state.send) state.send({ t: 'loadout', op: k, l });
    refresh();
  };
  const bindAtts = root => { for (const b of root.querySelectorAll('.att')) b.onclick = () => {
    const l = loadoutOf(k), w = b.dataset.w;
    l.att = { ...l.att, [w]: { ...cleanAtt(w, l.att[w]), [b.dataset.s]: b.dataset.v } };
    save(l);
  }; };
  const pics = {}; // gun picture per card, redrawn only when that gun's attachments change
  const drawPics = () => { for (const p of d.querySelectorAll('.wpic')) {
    const w = p.dataset.w, a = cleanAtt(w, cur.att[w]), key = JSON.stringify(a);
    if (pics[w + p.closest('.wcard').dataset.slot] === key) continue;
    pics[w + p.closest('.wcard').dataset.slot] = key; p.replaceChildren(gunPicture(w, a, 270, 84));
  } };
  const refresh = () => {
    cur = loadoutOf(k);
    for (const b of d.querySelectorAll('.wcard')) b.classList.toggle('on', cur[b.dataset.slot] === b.dataset.v);
    for (const box of d.querySelectorAll('.atts')) {
      const html = attRows(box.dataset.slot);
      if (box.dataset.html === html) continue;
      const t = document.createElement('div'); t.innerHTML = html;
      const nb = t.firstElementChild; nb.dataset.slot = box.dataset.slot; nb.dataset.html = html; nb.style.animation = 'none';
      box.replaceWith(nb); bindAtts(nb);
    }
    drawPics();
  };
  for (const box of d.querySelectorAll('.atts')) box.dataset.html = attRows(box.dataset.slot);
  d._refresh = refresh;
  drawPics(); bindAtts(d);
  for (const b of d.querySelectorAll('.wcard')) b.onclick = () => save({ ...loadoutOf(k), [b.dataset.slot]: b.dataset.v });
  // slowly animated big portrait
  cancelAnimationFrame(anim.raf);
  const cv = d.querySelector('.opBig'), x = cv.getContext('2d');
  const loop = t => {
    if (!cv.isConnected || d.offsetParent === null) return;
    const g = x.createRadialGradient(210, 210, 20, 210, 210, 300);
    g.addColorStop(0, shade(o.color, 0.5)); g.addColorStop(1, '#07090c');
    x.fillStyle = g; x.fillRect(0, 0, 420, 420);
    x.strokeStyle = 'rgba(255,255,255,0.05)'; x.lineWidth = 1;
    for (let i = 0; i < 420; i += 30) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 420); x.moveTo(0, i); x.lineTo(420, i); x.stroke(); }
    x.save(); x.scale(420 / 40, 420 / 40);
    const s = t / 1000;
    drawOperator(x, { x: 20, y: 20, aim: -0.5 + Math.sin(s * 0.6) * 0.5, op: k, w: cur.primary, ally: true, walk: s * 3, ads: Math.sin(s * 0.4) > 0.6 }, s);
    x.restore();
    anim.raf = requestAnimationFrame(loop);
  };
  anim.raf = requestAnimationFrame(loop);
}
