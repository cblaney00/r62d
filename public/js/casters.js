// ESPORTS TV casters (he asked: announcers whose words you can read while the pros play; Pro matches only).
// Two of our own: MAX REYES calls the action, IRIS KANE explains why it happened. Lines come from what happens in the
// match (bans, picks, plants, kills, clutches, round ends) and show one at a time in a box at the top left.
const CAST = [{ name: 'MAX REYES', role: 'PLAY-BY-PLAY', col: '#ffd166' }, { name: 'IRIS KANE', role: 'ANALYST', col: '#8fd3ff' }];
const pick = a => a[Math.floor(Math.random() * a.length)];
let el = null, queue = [], showT = 0, lastT = 0, lastKey = {};
const nm = n => (n || '').replace(/^\[\w+\] /, '');

export function castReset() { queue = []; lastKey = {}; if (el) el.innerHTML = ''; }
// who: 0 = play-by-play, 1 = analyst; key: one line per key every few seconds; prio: jumps the queue
export function say(who, text, key, prio) {
  const now = performance.now() / 1000;
  if (key && now - (lastKey[key] || -99) < 8) return;
  if (key) lastKey[key] = now;
  if (!prio && queue.length >= 3) return; // never fall behind the action
  const line = { who, text, t: now };
  if (prio) queue.unshift(line); else queue.push(line);
}
// one frame: shows the next line when the last has been up long enough to read
export function castTick(on) {
  el = el || document.getElementById('tvCast');
  if (!el) return;
  el.classList.toggle('hidden', !on);
  if (!on) return;
  const now = performance.now() / 1000;
  if (queue.length && now - showT > Math.max(2.2, Math.min(4.5, lastT))) {
    const l = queue.shift(), c = CAST[l.who];
    if (now - l.t > 10) return; // stale news
    showT = now; lastT = 1.2 + l.text.length * 0.045;
    const d = document.createElement('div'); d.className = 'cl';
    d.innerHTML = `<b style="color:${c.col}">${c.name}<small>${c.role}</small></b><span></span>`;
    d.querySelector('span').textContent = l.text;
    el.appendChild(d); while (el.children.length > 2) el.firstChild.remove();
    setTimeout(() => d.classList.add('old'), 7000);
  }
}
// match moments from the snapshot events (main.js passes them on in Esports TV)
export function castEvent(e, ctx) {
  const { players, teamName, opName, alive } = ctx;
  if (e.e === 'ban') {
    const t = teamName(e.sq), o = opName(e.op);
    say(0, pick([`${t} take ${o} off the table.`, `And ${o} is banned by ${t}.`, `${t} ban out ${o}.`]), null);
    if (Math.random() < 0.45) say(1, pick([`Smart. ${o} has been huge on this map.`, `${o} was a problem for them last time, so that makes sense.`, `That ban tells you how scared they are of ${o}.`]), 'banwhy');
  } else if (e.e === 'kill') {
    const v = players.get(e.victim), k = e.killer ? players.get(e.killer) : null; if (!v) return;
    const [a, b] = alive();
    if (!k || k.id === v.id) say(0, `${nm(v.n)} goes down on their own!`, 'k' + v.id);
    else if (k.sq === v.sq) say(0, pick([`Oh no, that's a teamkill from ${nm(k.n)}!`, `${nm(k.n)} hits a teammate! That hurts.`]), 'tk', true);
    else if (e.hs) say(0, pick([`HEADSHOT! ${nm(k.n)} taps ${nm(v.n)}!`, `${nm(k.n)} with the one-tap on ${nm(v.n)}!`, `Clean headshot, ${nm(k.n)}!`]), 'k' + k.id, true);
    else say(0, pick([`${nm(k.n)} takes down ${nm(v.n)}.`, `${nm(v.n)} is gone, ${nm(k.n)} with the pick.`, `${nm(k.n)} wins that duel.`]), 'k' + k.id);
    if ((a === 1 && b > 1) || (b === 1 && a > 1)) { const lone = [...players.values()].find(p => p.a && (a === 1 ? p.sq === 0 : p.sq === 1)); if (lone) say(1, pick([`${nm(lone.n)} is on their own now, one versus ${Math.max(a, b)}. Can they clutch it?`, `It's all on ${nm(lone.n)}. A 1v${Math.max(a, b)} for the round.`]), 'clutch', true); }
    else if (Math.random() < 0.3) say(1, `That makes it ${a} versus ${b}.`, 'count');
  } else if (e.e === 'banner' && /PLANTED/.test(e.text)) {
    say(0, pick(['The defuser is DOWN!', "It's planted! Now the defence have to come to them.", 'Defuser in! The clock is ticking.']), 'plant', true);
    say(1, pick(['Now watch the attackers spread out and play off the defuser.', 'The defenders have to retake now, and that is never easy.']), 'plant2');
  } else if (e.e === 'roundEnd') {
    const t = teamName(e.squad);
    say(0, pick([`${t} take the round!`, `And that's the round for ${t}.`, `Round to ${t}!`]), 'end', true);
    if (e.reason) say(1, `${e.reason}. ${pick(['They earned that one.', 'The plan worked exactly how they drew it up.', 'Plenty for the other side to think about.'])}`, 'end2');
  }
}
// once a phase: the start of operator select, preparation and the action
export function castPhase(ph, s, ctx) {
  const map = ctx.mapName, [t0, t1] = [ctx.teamName(0), ctx.teamName(1)];
  if (ph === 'select') {
    if (s.rd === 1) { say(0, `Welcome to the pro league! ${t0} against ${t1}, on ${map}.`, 'w', true); say(1, 'First the bans: two attackers and two defenders each. Every pick matters after that.', 'w2'); }
    else say(0, `Round ${s.rd}. ${t0} ${s.sc[0]}, ${t1} ${s.sc[1]}.`, 'rd', true);
    if (s.rd > 1 && Math.max(...s.sc) === 2) say(1, pick(['Match point. One more round and it is over.', 'This could be the last round. Huge pressure.']), 'mp');
  } else if (ph === 'prep') say(1, pick(['Preparation: drones out for the attack, walls going up on the site.', 'Watch the drones here, the attack needs to find that defuser site.', 'The defenders are setting up. Reinforcements and traps first.']), 'prep');
  else if (ph === 'action') say(0, pick(["Here we go, the attack is on!", "Action phase! Let's see the plan.", 'And they go!']), 'act', true);
}
