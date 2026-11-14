// BALL KNOWLEDGE (he asked): tips and tricks with each operator, from what the top players do — the pro teams'
// practice matches (above Diamond), recorded per operator by server/train-worker.js (training.opx: rounds, wins,
// kills, deaths, skill kills, skill uses, headshots, opening kills) and per map and side (training.ops). It doubles
// as a patch list: "PATCH WATCH" flags operators, skills and plays that win far more (or less) than they should.
import { OPERATORS, jobOf, JOBS, WEAPONS, ATTACH } from '/shared/operators.js';
import { PRO_TEAMS } from '/shared/pros.js';
import { PATCH_NOTES } from '/shared/patchnotes.js';
import { MAPS, MAP_LIST } from '/shared/map.js';

let S = null;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const pct = (a, b) => (b ? Math.round(a / b * 100) : 0) + '%';
const mapName = id => (MAPS[id] && MAPS[id].name) || id;
const nice = s => s.charAt(0).toUpperCase() + s.slice(1).replace(/([a-z])([A-Z])/g, '$1 $2');

export function openKnowledge(el) {
  el.classList.remove('hidden');
  if (!S) S = { side: 'atk', data: null, tab: 'ops' };
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
const BROKEN = 0.6, REALLY_BAD = 0.4, SURE = 500; // SURE: rounds before a verdict (he chose: with fewer, luck moves a win rate about 3%)
function patchWatch() {
  const d = S.data || {}, out = [];
  for (const op of Object.keys(OPERATORS)) {
    const s = statsOf(op), o = OPERATORS[op];
    // he set the band (2026-11-10): 40-60% is fine (a meta and strong picks are OK, bans exist); above 60% is broken, below 40% really bad
    if (s.r >= SURE && s.w / s.r > BROKEN) out.push({ hot: 1, sc: s.w / s.r, txt: `<b>${o.name}</b> wins ${pct(s.w, s.r)} of ${s.r} rounds: <b>broken</b> (over ${Math.round(BROKEN * 100)}%).` });
    if (s.r >= SURE && s.w / s.r < REALLY_BAD) out.push({ hot: 0, sc: 1 - s.w / s.r, txt: `<b>${o.name}</b> wins only ${pct(s.w, s.r)} of ${s.r} rounds: <b>really bad</b> (under ${Math.round(REALLY_BAD * 100)}%).` });
    if (s.detail && s.k >= 15 && s.sk / s.k > 0.5) out.push({ hot: 1, sc: s.sk / s.k, txt: `<b>${o.name}</b>'s ${esc(o.ability.name)} (or gadget) gets ${pct(s.sk, s.k)} of their kills: check it.` });
  }
  for (const [k, r] of Object.entries(d.plans || {})) {
    const [m, site, side, plan] = k.split('|');
    if (r.n >= 12 && r.w / r.n > 0.7) out.push({ hot: 1, sc: r.w / r.n, txt: `The <b>${esc(nice(plan))}</b> play on ${esc(mapName(m))} site ${+site + 1} (${side === 'atk' ? 'attack' : 'defence'}) wins ${pct(r.w, r.n)} of ${r.n} rounds: a broken strategy?` });
  }
  return out.sort((a, b) => b.sc - a.sc);
}
// the sections (he asked 2026-11-14: Ball Knowledge also about guns, attachments, maps and anything worth watching;
// the pro drills and each pro's take on the worst thing in the game)
const TABS = [['ops', 'OPERATORS'], ['guns', 'GUNS'], ['att', 'ATTACHMENTS'], ['maps', 'MAPS'], ['drills', 'DRILLS'], ['takes', 'PRO TAKES']];
function render(el) {
  el.querySelector('.bkTabs').innerHTML = TABS.map(([k, n]) => `<button data-t="${k}" class="${S.tab === k ? 'on' : ''}">${n}</button>`).join('');
  for (const b of el.querySelectorAll('.bkTabs button')) b.onclick = () => { S.tab = b.dataset.t; S.open = null; render(el); };
  el.querySelector('.bkSide').style.display = S.tab === 'ops' ? '' : 'none';
  el.classList.toggle('bkWide', S.tab !== 'ops');
  if (S.tab !== 'ops') return renderMore(el);
  renderOps(el);
}
function renderOps(el) {
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
  const op = OPERATORS[o], side = op.team, all = MAP_LIST.map(m => s.maps.find(x => x.m === m) || { m, n: 0, w: 0, rate: 0 });
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

// ---- the other sections: plain cards built from the practice numbers ----
const card = (title, sub, line, body, col = '#93a0ad') => `<div class="bkCard bkInfoCard" style="--oc:${col}"><div class="bkHead"><b>${title}</b><span>${sub}</span><em>${line}</em></div>${body}</div>`;
const list = items => `<ul>${items.map(t => `<li>${t}</li>`).join('')}</ul>`;
const add = (a, b) => { b.forEach((v, i) => { a[i] = (a[i] || 0) + v; }); return a; };
const rec = r => r ? (r[1] + r[2] + 1) / (r[0] + r[2] + r[3] + 2) : 0.5; // rounds and fights won together
function gunsData() {
  const d = S.data || {}, G = {};
  for (const [k, r] of Object.entries(d.guns || {})) { const [op, w] = k.split('|'); if (!WEAPONS[w]) continue; const g = G[w] || (G[w] = { w, r: [0, 0, 0, 0], ops: [] }); add(g.r, r); if (r[0] >= 5) g.ops.push({ op, r }); }
  return Object.values(G);
}
function renderGuns() {
  const gs = gunsData().filter(g => g.r[0]);
  const avgOf = g => { const same = gs.filter(x => WEAPONS[x.w].cls === WEAPONS[g.w].cls && x.r[0] >= 10); return same.reduce((a, x) => a + x.r[2] / x.r[0], 0) / Math.max(1, same.length) || 0.01; }; // (each gun against its own kind)
  gs.sort((a, b) => b.r[2] / b.r[0] - a.r[2] / a.r[0]);
  const att = (S.data || {}).att || {};
  return gs.map(g => { const W = WEAPONS[g.w], [n, w, k, de] = g.r, kpr = k / n, avg = avgOf(g);
    const best = g.ops.sort((a, b) => rec(b.r) - rec(a.r))[0];
    const slots = ['barrel', 'grip', 'sight', 'ammo'].map(sl => { const c = Object.entries(att).filter(([key, r]) => key.startsWith(g.w + '|' + sl + '|') && r[0] >= 8).sort((a, b) => rec(b[1]) - rec(a[1]))[0]; return c && ATTACH[sl][c[0].split('|')[2]] ? ATTACH[sl][c[0].split('|')[2]].short || ATTACH[sl][c[0].split('|')[2]].name : null; }).filter(Boolean);
    const tips = [`${kpr.toFixed(2)} kills a round (${kpr > avg * 1.15 ? '<b>well above</b>' : kpr < avg * 0.85 ? 'below' : 'about'} the other ${esc(W.cls)} guns' ${avg.toFixed(2)}), K/D ${(k / Math.max(1, de)).toFixed(2)}.`];
    if (best) tips.push(`Best in the hands of <b>${esc(OPERATORS[best.op] ? OPERATORS[best.op].name : best.op)}</b> (${pct(best.r[1], best.r[0])} of ${best.r[0]} rounds won).`);
    if (slots.length) tips.push(`The pros' setup: ${slots.map(esc).join(' · ')}.`);
    if (W.trait) tips.push(esc(W.trait));
    return card(esc(W.name), esc(W.cls || W.type || ''), `${pct(w, n)} won · ${n} rounds`, list(tips), kpr > avg * 1.15 ? '#ff7a5a' : kpr < avg * 0.85 ? '#5ec8ff' : '#93a0ad'); }).join('') || '<p class="hint">No gun numbers yet: they fill in as the pros practise.</p>';
}
function renderAtt() {
  const d = S.data || {}, A = {};
  for (const [k, r] of Object.entries(d.att || {})) { const [w, sl, c] = k.split('|'); if (!ATTACH[sl] || !ATTACH[sl][c]) continue; const x = A[sl + '|' + c] || (A[sl + '|' + c] = { sl, c, r: [0, 0, 0, 0], guns: [] }); add(x.r, r); if (r[0] >= 8 && WEAPONS[w]) x.guns.push({ w, r }); }
  const xs = Object.values(A).filter(x => x.r[0] >= 10).sort((a, b) => a.sl < b.sl ? -1 : a.sl > b.sl ? 1 : rec(b.r) - rec(a.r));
  return xs.map(x => { const a = ATTACH[x.sl][x.c], best = x.guns.sort((p, q) => rec(q.r) - rec(p.r))[0], worst = x.guns[x.guns.length - 1], rt = rec(x.r);
    const tips = [esc(a.desc || '')]; if (best) tips.push(`Best on the <b>${esc(WEAPONS[best.w].name)}</b> (${Math.round(rec(best.r) * 100)}%).`); if (worst && worst !== best && x.guns.length > 2) tips.push(`Worst on the ${esc(WEAPONS[worst.w].name)} (${Math.round(rec(worst.r) * 100)}%).`);
    return card(esc(a.name), x.sl.toUpperCase(), `${Math.round(rt * 100)}% of rounds and fights won · ${x.r[0]} rounds`, list(tips), rt > 0.56 ? '#ff7a5a' : rt < 0.44 ? '#5ec8ff' : '#93a0ad'); }).join('') || '<p class="hint">No attachment numbers yet.</p>';
}
function renderMaps() {
  const d = S.data || {}, M = {};
  for (const [k, r] of Object.entries(d.plans || {})) { const [m, site, side, plan] = k.split('|'); if (!MAP_LIST.includes(m)) continue; const x = M[m] || (M[m] = { atk: [0, 0], def: [0, 0], plans: [] }); x[side][0] += r.n; x[side][1] += r.w; if (r.n >= 4) x.plans.push({ side, plan, site, r }); }
  const opsOn = (m, side) => Object.entries(d.ops || {}).filter(([k, r]) => k.startsWith(m + '|' + side + '|') && r.n >= 5).map(([k, r]) => ({ op: k.split('|')[2], r })).sort((a, b) => b.r.w / b.r.n - a.r.w / a.r.n);
  return MAP_LIST.map(m => { const x = M[m]; if (!x) return card(esc(mapName(m)), '', 'no rounds yet', '');
    const a = x.atk[0] ? x.atk[1] / x.atk[0] : 0.5, tips = [];
    const top = side => x.plans.filter(p => p.side === side).sort((p, q) => q.r.w / q.r.n - p.r.w / p.r.n)[0];
    for (const side of ['atk', 'def']) { const p = top(side), o = opsOn(m, side)[0]; if (p) tips.push(`${side === 'atk' ? 'Attack' : 'Defence'}: the <b>${esc(nice(p.plan))}</b> play on site ${+p.site + 1} wins ${pct(p.r.w, p.r.n)}${o && OPERATORS[o.op] ? `; best pick ${esc(OPERATORS[o.op].name)} (${pct(o.r.w, o.r.n)})` : ''}.`); }
    return card(esc(mapName(m)), MAPS[m].floors || '', `attack wins ${Math.round(a * 100)}% · ${x.atk[0]} rounds`, `<div class="bkBar"><span>ATTACK</span><div><i style="width:${Math.round(a * 100)}%"></i><em style="left:50%"></em></div><b>${Math.round(a * 100)}%</b></div>` + list(tips), Math.abs(a - 0.5) > 0.08 ? '#ff7a5a' : '#93a0ad'); }).join('');
}
const FEAT_NAME = { firstShot: 'Shooting first', firstHit: 'Landing the first bullet', lean: 'Leaning past cover', crouch: 'Crouching in the fight', strafe: 'Jiggling side to side', held: 'Holding still on an angle', heard: 'Having heard them coming' };
const pearson = (xs, ys) => { const n = xs.length; if (n < 4) return 0; const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n; let sxy = 0, sx = 0, sy = 0; for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sx += (xs[i] - mx) ** 2; sy += (ys[i] - my) ** 2; } return sx && sy ? sxy / Math.sqrt(sx * sy) : 0; };
const DSKILL = [['Reactions', p => p.rn ? -p.rt / p.rn : null, p => p.rn ? (p.rt / p.rn).toFixed(2) + ' s' : '—'], ['First bullet lands', p => p.fs ? p.fsh / p.fs : null, p => p.fs ? pct(p.fsh, p.fs) : '—'],
  ['Headshots', p => p.k ? p.hs / p.k : null, p => p.k ? pct(p.hs, p.k) : '—'], ['Drill K/D', p => p.k / Math.max(1, p.d), p => (p.k / Math.max(1, p.d)).toFixed(2)],
  ['Trades', p => p.trN ? p.tr / p.trN : null, p => p.trN ? pct(p.tr, p.trN) : '—'], ['Clutches', p => p.cn ? p.cw / p.cn : null, p => p.cn ? pct(p.cw, p.cn) : '—'],
  ['Holding', p => p.hn ? p.hw / p.hn : null, p => p.hn ? pct(p.hw, p.hn) : '—'], ['Swinging on the clock', p => p.sn ? p.sw / p.sn : null, p => p.sn ? pct(p.sw, p.sn) : '—'],
  ['Dry peeks (no shot off)', p => p.d ? -p.dry / p.d : null, p => p.d ? pct(p.dry, p.d) : '—']];
export function drillSkills(D, name) { const p = D && D.pro && D.pro[name]; return p ? DSKILL.map(([n, v, f]) => ({ n, v: v(p), f: f(p) })) : []; }
function renderDrills() {
  const d = S.data || {}, D = d.drills; if (!D || !D.n) return '<p class="hint">No drills yet: the pros play them every time they practise (TRAIN THE PROS on the PLAYBOOK page).</p>';
  const feats = Object.entries(D.feats || {}).filter(([, x]) => x[1] >= 10).sort((a, b) => b[1][0] / b[1][1] - a[1][0] / a[1][1]);
  const what = card('WHAT WINS FIGHTS', `from ${D.n} one-minute drills`, 'when only one of the two had it', list(feats.map(([h, [w, n]]) => `<b>${esc(FEAT_NAME[h] || h)}</b>: won ${pct(w, n)} of ${n} fights`)), '#f2c14e');
  // which drill skills go with winning real practice rounds (ten pros, so read it as a hint, not a law)
  const names = Object.keys(D.pro), real = n => { const T = (d.pro && d.pro[n] && d.pro[n].tend) || {}, a = T.atk || {}, b = T.def || {}, r = (a.r || 0) + (b.r || 0); return r ? { wr: ((a.w || 0) + (b.w || 0)) / r, kd: ((a.k || 0) + (b.k || 0)) / Math.max(1, (a.d || 0) + (b.d || 0)) } : null; };
  const rows = DSKILL.map(([sk, v]) => { const pairs = names.map(n => [v(D.pro[n]), real(n)]).filter(([x, y]) => x !== null && y); return { sk, r: pearson(pairs.map(p => p[0]), pairs.map(p => p[1].wr)), k: pearson(pairs.map(p => p[0]), pairs.map(p => p[1].kd)), n: pairs.length }; }).filter(x => x.n >= 4).sort((a, b) => Math.abs(b.r) + Math.abs(b.k) - Math.abs(a.r) - Math.abs(a.k));
  const word = r => Math.abs(r) > 0.6 ? 'strongly' : Math.abs(r) > 0.3 ? 'somewhat' : 'hardly';
  const matters = card('WHICH SKILLS MATTER', 'drill skills next to real practice results', 'ten pros: a hint, not a law', rows.length ? list(rows.map(x => `<b>${esc(x.sk)}</b> goes ${word(x.r)} with winning rounds${x.r < -0.3 ? ' (the other way!)' : ''} and ${word(x.k)} with K/D`)) : '<p class="hint">Needs practice rounds and drills for every pro.</p>', '#f2c14e');
  const kinds = card('THE DRILLS', 'the Drill Hall: two blocks, a line nobody crosses, no skills, one minute', 'a draw is a loss for everyone', list(Object.entries(D.kinds || {}).map(([k, x]) => `<b>${esc(({ duel: 'Block duel', trade: 'Two on two', hold: 'Hold or swing', clutch: 'Clutch' })[k] || k)}</b>: ${x.n} played, ${pct(x.draws, x.n)} ran out of time, ${(x.time / Math.max(1, x.n)).toFixed(0)} s on average`)), '#f2c14e');
  const pros = PRO_TEAMS.flatMap(t => t.players.map(pl => ({ pl, t }))).filter(x => D.pro[x.pl.name]).map(({ pl, t }) => { const p = D.pro[pl.name], sty = (D.style || {})[pl.name];
    return card(`[${esc(t.tag)}] ${esc(pl.name)}`, `${p.n} drills · ${Math.round(p.pts / Math.max(1, p.n))} points a drill`, `won ${pct(p.w, p.n)}`, list(drillSkills(D, pl.name).map(s => `${esc(s.n)}: <b>${s.f}</b>`).concat(sty ? [`Style learned: leans ${pct(sty.lean, 1)}, crouches ${pct(sty.crouch, 1)}, jiggles ${pct(sty.strafe, 1)}, holds ${sty.patience.toFixed(1)} s before swinging`] : [])), t.colour); });
  return what + matters + kinds + pros.join('');
}
function renderTakes() {
  const O = (S.data || {}).opinions || {};
  const cards = PRO_TEAMS.flatMap(t => t.players.map(pl => ({ pl, t }))).map(({ pl, t }) => { const log = O[pl.name] || [], cur = log[log.length - 1];
    if (!cur) return card(`[${esc(t.tag)}] ${esc(pl.name)}`, '', 'no view yet', '<p class="hint">Forms after their next practice session.</p>', t.colour);
    const hist = log.filter(x => x.changed).slice(-5).reverse().map(x => `<li><small>session ${x.s} · ${new Date(x.at).toLocaleDateString()}</small> ${esc(x.text)}</li>`).join('');
    return card(`[${esc(t.tag)}] ${esc(pl.name)}`, `after ${log.length} practice session${log.length === 1 ? '' : 's'}`, 'THE WORST THING IN THE GAME', `<p class="bkTake">“${esc(cur.text)}”</p>${cur.runner ? `<p class="hint">Close second: ${esc(cur.runner)}</p>` : ''}${hist ? `<h5>HOW THE VIEW MOVED</h5><ul class="bkLog">${hist}</ul>` : ''}`, t.colour); });
  return cards.join('');
}
function renderMore(el) {
  const d = S.data;
  el.querySelector('.bkInfo').textContent = !d ? 'Loading…' : S.tab === 'drills' ? 'One-minute practice gunfights the pros play to sharpen single skills.' : S.tab === 'takes' ? 'Every pro knows every patch; this is their view after each practice.' : `From ${d.rounds || 0} rounds of pro practice.`;
  const grid = el.querySelector('.bkGrid');
  grid.innerHTML = !d ? '' : ({ guns: renderGuns, att: renderAtt, maps: renderMaps, drills: renderDrills, takes: renderTakes })[S.tab]();
  // the side panel: what the pros know (every patch, newest first) on PRO TAKES, else the usual patch watch
  el.querySelector('.bkPatch').innerHTML = S.tab === 'takes' ? '<h4>PATCH NOTES</h4>' + PATCH_NOTES.slice().reverse().map(n => `<div class="${n.v > 0 ? 'cold' : n.v < 0 ? 'hot' : ''}"><small>${n.d}</small> ${esc(n.t)}</div>`).join('')
    : '<h4>PATCH WATCH</h4>' + (((d && patchWatch()) || []).slice(0, 14).map(p => `<div class="${p.hot ? 'hot' : 'cold'}">${p.txt}</div>`).join('') || '<p class="hint">Nothing looks broken right now.</p>');
}
