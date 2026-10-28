// The Profile page: lifetime stats, stats per operator, past matches and match details.
import { OPERATORS } from '/shared/operators.js';

const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (a, b) => (b ? Math.round(a / b * 100) : 0) + '%';
const kd = (k, d) => (k / Math.max(1, d)).toFixed(2);
const when = t => new Date(t).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const dur = s => `${Math.floor(s / 60)}m ${s % 60}s`;
const hours = s => s >= 3600 ? `${(s / 3600).toFixed(1)} h` : `${Math.round(s / 60)} min`;

export async function openProfile(el, { token, id }) {
  el.classList.remove('hidden');
  const body = el.querySelector('#profBody');
  body.innerHTML = '<p class="hint">Loading…</p>';
  try {
    const r = await fetch(id ? `/api/profile?id=${encodeURIComponent(id)}` : `/api/profile?token=${encodeURIComponent(token)}`);
    if (!r.ok) throw new Error();
    const data = await r.json();
    const players = await (await fetch('/api/players')).json();
    renderProfile(body, data, players, token);
  } catch { body.innerHTML = '<p class="hint">No profile yet — play a match first.</p>'; }
}

function renderProfile(body, { profile: p, matches }, players, token) {
  const s = p.stats;
  const ops = Object.entries(s.ops).sort((a, b) => b[1].rounds - a[1].rounds);
  const fav = ops[0] ? OPERATORS[ops[0][0]].name : '—';
  const tile = (v, l) => `<div class="tile"><b>${v}</b><span>${l}</span></div>`;
  body.innerHTML = `
    <div class="profhead"><div><h1>${esc(p.name)}</h1><div class="hint">Playing since ${new Date(p.created).toLocaleDateString()} · Favourite operator: <b>${fav}</b></div></div></div>
    <div class="tiles">
      ${tile(s.matches, 'MATCHES')}${tile(pct(s.wins, s.matches), 'WIN RATE')}${tile(`${s.wins}–${s.losses}`, 'WINS – LOSSES')}
      ${tile(kd(s.kills, s.deaths), 'K/D')}${tile(s.kills, 'KILLS')}${tile(s.deaths, 'DEATHS')}
      ${tile(pct(s.hits, s.shots), 'ACCURACY')}${tile(s.damage, 'DAMAGE')}${tile(s.downs, 'DOWNS')}
      ${tile(s.revives, 'REVIVES')}${tile(s.plants, 'PLANTS')}${tile(s.defuses, 'DISABLES')}
      ${tile(pct(s.roundsWon, s.rounds), 'ROUNDS WON')}${tile(hours(s.playSeconds), 'TIME PLAYED')}
    </div>
    <div class="cols">
      <div><h3>OPERATORS</h3><table><tr><th>OPERATOR</th><th>ROUNDS</th><th>WIN%</th><th>KILLS</th><th>K/D</th></tr>
        ${ops.map(([k, o]) => `<tr><td style="color:${OPERATORS[k].color}">${OPERATORS[k].name}</td><td>${o.rounds}</td><td>${pct(o.roundsWon, o.rounds)}</td><td>${o.kills}</td><td>${kd(o.kills, o.deaths)}</td></tr>`).join('') || '<tr><td colspan="5" class="hint">No rounds yet.</td></tr>'}</table>
        <h3>EVERYONE WHO HAS PLAYED</h3><table><tr><th>PLAYER</th><th>MATCHES</th><th>WINS</th><th>K/D</th></tr>
        ${players.sort((a, b) => b.matches - a.matches).map(q => `<tr class="link ${q.id === p.id ? 'me' : ''}" data-pid="${q.id}"><td>${esc(q.name)}</td><td>${q.matches}</td><td>${q.wins}</td><td>${kd(q.kills, q.deaths)}</td></tr>`).join('')}</table>
      </div>
      <div><h3>MATCH HISTORY</h3><div id="matchList">
        ${matches.map(m => {
          const me = m.players.find(x => x.pid === p.id) || {};
          const won = !me.left && me.squad === m.winner;
          return `<button class="match ${me.left ? 'left' : won ? 'win' : 'loss'}" data-mid="${m.id}">
            <b>${me.left ? 'LEFT' : won ? 'VICTORY' : 'DEFEAT'}</b><span>${m.score[me.squad] ?? '?'} – ${m.score[1 - me.squad] ?? '?'}</span>
            <span>${me.kills || 0} / ${me.deaths || 0}</span><small>${when(m.date)} · ${esc(m.map)} · ${dur(m.duration)}</small></button>`;
        }).join('') || '<p class="hint">No matches yet. Finish a match and it will appear here.</p>'}
      </div><div id="matchDetail"></div></div>
    </div>`;
  for (const b of body.querySelectorAll('.match')) b.onclick = () => showMatch(body, b.dataset.mid, p.id);
  for (const r of body.querySelectorAll('tr.link')) r.onclick = () => openProfile(body.closest('.overlay'), { id: r.dataset.pid, token });
}

async function showMatch(body, id, myId) {
  const box = body.querySelector('#matchDetail');
  box.innerHTML = '<p class="hint">Loading…</p>';
  const m = await (await fetch(`/api/match?id=${encodeURIComponent(id)}`)).json();
  const me = m.players.find(x => x.pid === myId);
  const mySq = me ? me.squad : 0;
  const team = sq => m.players.filter(x => x.squad === sq).sort((a, b) => b.kills - a.kills).map(x =>
    `<tr class="${x.pid === myId ? 'me' : ''}"><td>${esc(x.name)}${x.left ? ' <small>(left)</small>' : ''}</td><td>${Object.keys(x.ops || {}).map(o => OPERATORS[o] ? OPERATORS[o].name.slice(0, 3) : '').join(' ')}</td><td>${x.kills}</td><td>${x.deaths}</td><td>${x.damage}</td><td>${pct(x.hits, x.shots)}</td><td>${x.plants + x.defuses}</td></tr>`).join('');
  const head = '<tr><th>PLAYER</th><th>OPERATORS</th><th>K</th><th>D</th><th>DMG</th><th>ACC</th><th>OBJ</th></tr>';
  box.innerHTML = `<h3>MATCH — ${when(m.date)}</h3>
    <div class="rounds">${m.rounds.map(r => `<div class="${r.winner === mySq ? 'w' : 'l'}" title="${esc(r.reason)} · ${esc(r.site)}">R${r.n}<small>${r.attackers === mySq ? 'ATK' : 'DEF'}</small></div>`).join('')}</div>
    <h4 class="ally">YOUR TEAM — ${m.score[mySq]}</h4><table>${head}${team(mySq)}</table>
    <h4 class="enemy">ENEMY TEAM — ${m.score[1 - mySq]}</h4><table>${head}${team(1 - mySq)}</table>`;
}
