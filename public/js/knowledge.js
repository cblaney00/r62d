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
  const o = OPERATORS[op], ab = o.ability, t = [];
  if (s.maps.length) t.push(`Strongest on <b>${esc(mapName(s.maps[0].m))}</b>: ${pct(s.maps[0].w, s.maps[0].n)} of rounds won there.`);
  if (s.maps.length > 2) { const lo = s.maps[s.maps.length - 1]; if (lo.rate < 0.45) t.push(`Weakest on <b>${esc(mapName(lo.m))}</b> (${pct(lo.w, lo.n)}): pick someone else there.`); }
  if (s.detail) {
    if (ab.count && s.ur >= 5) { const per = s.u / s.ur; t.push(per < 0.4 ? `Top players often keep the <b>${esc(ab.name)}</b> in their pocket (${per.toFixed(1)} a round): wait for the moment it decides the fight.` : `Top players use the <b>${esc(ab.name)}</b> about ${per.toFixed(1)} times a round, out of ${ab.count}.`); }
    if (s.k >= 5 && s.sk / s.k > 0.15) t.push(`${pct(s.sk, s.k)} of their kills come from the skill or gadget, not the gun.`);
    if (s.k >= 8 && s.hs / s.k > 0.35) t.push(`${pct(s.hs, s.k)} of their kills are headshots: aim at head height before the corner.`);
    if (s.fk / s.r > 0.15) t.push(`Gets the first kill in ${pct(s.fk, s.r)} of rounds: an early-fight operator, take the first duel.`);
    else if (s.de / s.r < 0.45 && s.k / s.r < 0.6) t.push(`Lives long (dies in ${pct(s.de, s.r)} of rounds): plays for the late round and the objective, not the first duel.`);
  }
  if (!t.length) t.push('Not enough top-level rounds yet: it fills in as the pros practise.');
  return t;
}
// operators, skills and plays that look broken (or useless), from enough rounds to mean something
function patchWatch() {
  const d = S.data || {}, out = [];
  for (const op of Object.keys(OPERATORS)) {
    const s = statsOf(op), o = OPERATORS[op];
    if (s.r >= 30 && s.w / s.r > 0.6) out.push({ hot: 1, sc: s.w / s.r, txt: `<b>${o.name}</b> wins ${pct(s.w, s.r)} of ${s.r} rounds: likely too strong.` });
    if (s.r >= 30 && s.w / s.r < 0.38) out.push({ hot: 0, sc: 1 - s.w / s.r, txt: `<b>${o.name}</b> wins only ${pct(s.w, s.r)} of ${s.r} rounds: too weak.` });
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
  el.querySelector('.bkGrid').innerHTML = ops.map(({ o, s }) => {
    const op = OPERATORS[o], job = (JOBS[team].find(j => j.id === jobOf(o)) || {}).name || '';
    const line = s.r ? `${pct(s.w, s.r)} won · ${s.r} rounds${s.detail ? ` · K/D ${(s.k / Math.max(1, s.de)).toFixed(2)}` : ''}` : 'no rounds yet';
    return `<div class="bkCard" style="--oc:${op.color}"><div class="bkHead"><b>${op.name}</b><span>${esc(job)} · ${esc(op.ability.name)}</span><em>${line}</em></div><ul>${tipsFor(o, s).map(t => `<li>${t}</li>`).join('')}</ul></div>`;
  }).join('');
}
