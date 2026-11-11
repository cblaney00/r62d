// BALL KNOWLEDGE (he asked): tips and tricks with each operator, from what the top players do — the pro teams'
// practice matches (above Diamond), recorded per operator by server/train-worker.js (training.opx: rounds, wins,
// kills, deaths, skill kills, skill uses, headshots, opening kills) and per map and side (training.ops). It doubles
// as a patch list: "PATCH WATCH" flags operators, skills and plays that win far more (or less) than they should.
import { OPERATORS, jobOf, JOBS } from '/shared/operators.js';
import { MAPS } from '/shared/map.js';

let S = null;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const pct = (a, b) => (b ? Math.round(a / b * 100) : 0) + '%';
const mapName = id => (MAPS[id] && MAPS[id].name) || id;
const nice = s => s.charAt(0).toUpperCase() + s.slice(1).replace(/([a-z])([A-Z])/g, '$1 $2');

export function openKnowledge(el) {
  el.classList.remove('hidden');
  if (!S) S = { side: 'atk', data: null };
  render(el);
  fetch('/api/training').then(r => r.json()).then(t => { S.data = t; render(el); }).catch(() => {});
}
export function closeKnowledge(el) { el.classList.add('hidden'); }

// per operator: the numbers, and the per-map results for this side
function statsOf(op) {
  const d = S.data || {}, x = (d.opx || {})[op] || [0, 0, 0, 0, 0, 0, 0, 0], side = OPERATORS[op].team, maps = [];
  let an = 0, aw = 0; // all maps, for before the detailed numbers exist
  for (const [k, r] of Object.entries(d.ops || {})) { const [m, s, o] = k.split('|'); if (o !== op || s !== side) continue; an += r.n; aw += r.w; if (r.n >= 4) maps.push({ m, n: r.n, w: r.w, rate: r.w / r.n }); }
  maps.sort((a, b) => b.rate - a.rate);
  const [r, w, k, de, sk, u, hs, fk, ur] = x;
  return { r: r || an, w: r ? w : aw, k, de, sk, u, hs, fk, ur: ur || 0, maps, detail: r >= 5 };
}
function tipsFor(op, s) {
  const o = OPERATORS[op], ab = o.ability, t = [], n = o.name;
  // each tip is [what it says, an example of what it means in a round] (he asked: click a card to see an example)
  const add = (txt, ex) => t.push([txt, ex]);
  if (s.maps.length) add(`Strongest on <b>${esc(mapName(s.maps[0].m))}</b>: ${pct(s.maps[0].w, s.maps[0].n)} of rounds won there.`, `Of every 10 rounds a pro team played on ${esc(mapName(s.maps[0].m))} with ${n}, they won about ${Math.round(s.maps[0].rate * 10)}. If that map comes up, ${n} is a safe pick.`);
  if (s.maps.length > 2) { const lo = s.maps[s.maps.length - 1]; if (lo.rate < 0.45) add(`Weakest on <b>${esc(mapName(lo.m))}</b> (${pct(lo.w, lo.n)}): pick someone else there.`, `On ${esc(mapName(lo.m))} the team with ${n} won only about ${Math.round(lo.rate * 10)} rounds in 10: the map's layout doesn't suit what ${n} does. Another operator of the same role does the job better there.`); }
  if (s.detail) {
    if (ab.count && s.ur >= 5) { const per = s.u / s.ur; add(per < 0.4 ? `Top players often keep the <b>${esc(ab.name)}</b> in their pocket (${per.toFixed(1)} a round): wait for the moment it decides the fight.` : `Top players use the <b>${esc(ab.name)}</b> about ${per.toFixed(1)} times a round, out of ${ab.count}.`, per < 0.4 ? `In most rounds a pro ${n} ends with the ${esc(ab.name)} still unused. They save it for the last fight on the objective instead of spending it in the first minute.` : `Out of ${ab.count} a round, a pro ${n} uses about ${Math.round(per)}: they spend it, early and often, to win fights and information.`); }
    if (s.k >= 5 && s.sk / s.k > 0.15) add(`${pct(s.sk, s.k)} of their kills come from the skill or gadget, not the gun.`, `Of every 10 enemies ${n} took down, about ${Math.round(s.sk / s.k * 10)} were caught by the ${esc(ab.name)} or a gadget (a trap, a blast) rather than shot.`);
    if (s.k >= 8 && s.hs / s.k > 0.35) add(`${pct(s.hs, s.k)} of their kills are headshots: aim at head height before the corner.`, `About ${Math.round(s.hs / s.k * 10)} of every 10 kills were one shot to the head: the pros hold the crosshair where a head will appear round the door, so they never have to move it.`);
    if (s.fk / s.r > 0.15) add(`Gets the first kill in ${pct(s.fk, s.r)} of rounds: an early-fight operator, take the first duel.`, `In about ${Math.round(s.fk / s.r * 10)} of every 10 rounds the very first kill of the round was made by ${n}: they go looking for the opening fight and win it, putting the team 5 against 4.`);
    else if (s.de / s.r < 0.45 && s.k / s.r < 0.6) add(`Lives long (dies in ${pct(s.de, s.r)} of rounds): plays for the late round and the objective, not the first duel.`, `${n} is still alive at the end of more than half the rounds: they stay back, keep their ${esc(ab.name)} for later and are the one left to win a 1 v 1 at the end.`);
  }
  if (!t.length) add('Not enough top-level rounds yet: it fills in as the pros practise.', 'The pros practise by themselves every day (or press TRAIN THE PROS). After a few dozen rounds with this operator, tips about maps, the skill, headshots and the first duel appear here.');
  return t;
}
// operators, skills and plays that look broken (or useless), from enough rounds to mean something
const BROKEN = 0.6, REALLY_BAD = 0.4;
function patchWatch() {
  const d = S.data || {}, out = [];
  for (const op of Object.keys(OPERATORS)) {
    const s = statsOf(op), o = OPERATORS[op];
    // he set the band (2026-11-10): 40-60% is fine (a meta and strong picks are OK, bans exist); above 60% is broken, below 40% really bad
    if (s.r >= 30 && s.w / s.r > BROKEN) out.push({ hot: 1, sc: s.w / s.r, txt: `<b>${o.name}</b> wins ${pct(s.w, s.r)} of ${s.r} rounds: <b>broken</b> (over ${Math.round(BROKEN * 100)}%).` });
    if (s.r >= 30 && s.w / s.r < REALLY_BAD) out.push({ hot: 0, sc: 1 - s.w / s.r, txt: `<b>${o.name}</b> wins only ${pct(s.w, s.r)} of ${s.r} rounds: <b>really bad</b> (under ${Math.round(REALLY_BAD * 100)}%).` });
    if (s.detail && s.k >= 15 && s.sk / s.k > 0.5) out.push({ hot: 1, sc: s.sk / s.k, txt: `<b>${o.name}</b>'s ${esc(o.ability.name)} (or gadget) gets ${pct(s.sk, s.k)} of their kills: check it.` });
  }
  for (const [k, r] of Object.entries(d.plans || {})) {
    const [m, site, side, plan] = k.split('|');
    if (r.n >= 12 && r.w / r.n > 0.7) out.push({ hot: 1, sc: r.w / r.n, txt: `The <b>${esc(nice(plan))}</b> play on ${esc(mapName(m))} site ${+site + 1} (${side === 'atk' ? 'attack' : 'defence'}) wins ${pct(r.w, r.n)} of ${r.n} rounds: a broken strategy?` });
  }
  return out.sort((a, b) => b.sc - a.sc);
}
function render(el) {
  const d = S.data, team = S.side, total = d ? d.rounds || 0 : 0;
  const ops = Object.keys(OPERATORS).filter(o => OPERATORS[o].team === team).map(o => ({ o, s: statsOf(o) }))
    .sort((a, b) => (b.s.r ? b.s.w / b.s.r : 0) - (a.s.r ? a.s.w / a.s.r : 0));
  const pw = d ? patchWatch() : [];
  el.querySelector('.bkSide').innerHTML = ['atk', 'def'].map(s => `<button data-s="${s}" class="${s === team ? 'on' : ''}">${s === 'atk' ? 'ATTACK' : 'DEFENCE'}</button>`).join('');
  for (const b of el.querySelectorAll('.bkSide button')) b.onclick = () => { S.side = b.dataset.s; render(el); };
  el.querySelector('.bkInfo').textContent = d ? `From ${total} rounds of pro practice (above Diamond). It grows every time the pros train.` : 'Loading…';
  el.querySelector('.bkPatch').innerHTML = `<h4>PATCH WATCH</h4>` + (pw.length ? pw.slice(0, 14).map(p => `<div class="${p.hot ? 'hot' : 'cold'}">${p.txt}</div>`).join('') : '<p class="hint">Nothing looks broken right now.</p>');
  const grid = el.querySelector('.bkGrid');
  grid.innerHTML = ops.map(({ o, s }) => {
    const op = OPERATORS[o], job = (JOBS[team].find(j => j.id === jobOf(o)) || {}).name || '';
    const line = s.r ? `${pct(s.w, s.r)} won · ${s.r} rounds${s.detail ? ` · K/D ${(s.k / Math.max(1, s.de)).toFixed(2)}` : ''}` : 'no rounds yet';
    const open = S.open === o, tips = tipsFor(o, s);
    return `<div class="bkCard${open ? ' open' : ''}" data-op="${o}" style="--oc:${op.color}"><div class="bkHead"><b>${op.name}</b><span>${esc(job)} · ${esc(op.ability.name)}</span><em>${line}</em><i>${open ? '✕ CLOSE' : 'CLICK FOR EXAMPLES'}</i></div>`
      + (open ? detail(o, s, tips) : `<ul>${tips.slice(0, 2).map(t => `<li>${t[0]}</li>`).join('')}</ul>` + (tips.length > 2 ? `<span class="more">+${tips.length - 2} MORE</span>` : '')) + '</div>';
  }).join('');
  // he asked: a clicked card opens in place, as big as 6 cards (3 wide, 2 high), with the others still round it
  const cols = Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length), w = Math.min(3, cols);
  for (const c of grid.querySelectorAll('.bkCard')) c.onclick = () => { S.open = S.open === c.dataset.op ? null : c.dataset.op; render(el); };
  const oc = grid.querySelector('.bkCard.open');
  if (oc) { oc.style.gridColumn = `span ${w}`; oc.style.gridRow = `span ${Math.ceil(6 / w)}`; oc.scrollIntoView({ block: 'nearest' }); }
}
// the opened card: what the skill does, each tip with an example, the numbers explained, every map's result
function detail(o, s, tips) {
  const op = OPERATORS[o], side = op.team, all = Object.keys(MAPS).map(m => s.maps.find(x => x.m === m) || { m, n: 0, w: 0, rate: 0 });
  const num = (v, label, ex) => `<div class="bkNum"><b>${v}</b><span>${label}</span><small>${ex}</small></div>`;
  const nums = s.r ? [
    num(pct(s.w, s.r), 'rounds won', `${s.w} of ${s.r} rounds the pros played with ${op.name} ended in a win for that team.`),
    s.detail ? num((s.k / Math.max(1, s.de)).toFixed(2), 'K/D', `Kills for each death: ${s.k} kills, ${s.de} deaths. Above 1.00 means they take down more than they lose.`) : '',
    s.detail && s.ur ? num((s.u / s.ur).toFixed(1), 'skill uses a round', `How many times a round the ${esc(op.ability.name)} goes out.`) : '',
    s.detail && s.k ? num(pct(s.hs, s.k), 'headshot kills', `${s.hs} of ${s.k} kills were to the head.`) : '',
    s.detail ? num(pct(s.fk, s.r), 'first kill of the round', `In ${s.fk} rounds the round's very first kill was theirs.`) : '',
  ].join('') : '';
  const bars = all.map(x => `<div class="bkBar"><span>${esc(mapName(x.m))}</span><div><i style="width:${x.n ? Math.round(x.rate * 100) : 0}%"></i><em style="left:50%"></em></div><b>${x.n ? pct(x.w, x.n) + ' · ' + x.n : 'too few rounds'}</b></div>`).join('');
  return `<div class="bkOpen"><p class="bkAb"><b>${esc(op.ability.name)}</b> — ${esc(op.ability.desc)}</p>`
    + `<div class="bkTips">${tips.map(t => `<div class="bkTip"><p>${t[0]}</p><p class="ex"><b>Example:</b> ${t[1]}</p></div>`).join('')}</div>`
    + (nums ? `<div class="bkNums">${nums}</div>` : '')
    + `<h5>EVERY MAP (${side === 'atk' ? 'ATTACK' : 'DEFENCE'}) · the line is half the rounds won</h5><div class="bkBars">${bars}</div></div>`;
}
