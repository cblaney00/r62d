// Plays what bots and casters say (he asked: real voices over a game chat). The recordings are short clips joined
// together (public/voice, see docs/voice.md). One person talks at a time on the team channel and one caster at a time;
// old news is dropped rather than played late; team comms dip while a caster speaks. Each channel has its own volume.
import { getAudio, sliderGain } from './audio.js';
const clips = new Map(); // url → Promise<AudioBuffer|null>
const gains = {}; // channel → gain (from the sliders)
let bus = null, ac = null, duck = null;
const q = { team: [], caster: [] }, busy = { team: 0, caster: 0 };
const STALE = { team: 2.5, caster: 6 };
const nowS = () => performance.now() / 1000;
function ready() {
  const A = getAudio(); if (!A) return false;
  if (ac !== A.ac) { ac = A.ac; bus = ac.createGain(); bus.connect(A.master); duck = ac.createGain(); duck.connect(bus); clips.clear(); }
  return true;
}
function load(v, id) {
  const url = `/voice/${v}/${id}.ogg`;
  if (!clips.has(url)) {
    if (clips.size > 400) clips.delete(clips.keys().next().value);
    clips.set(url, fetch(url).then(r => (r.ok ? r.arrayBuffer() : null)).then(b => (b ? ac.decodeAudioData(b) : null)).catch(() => null));
  }
  return clips.get(url);
}
export function setVoiceGain(ch, g) { gains[ch] = g; }
export const speaking = group => nowS() < busy[group];
// parts: clip ids of one line; onStart runs when it is really heard
export function sayVoice(group, ch, v, parts, onStart, first = false) {
  if (!ready() || !parts || !parts.length) { if (onStart) onStart(0); return; }
  const line = { ch, v, parts, onStart, t: nowS() };
  if (first) q[group].unshift(line); else q[group].push(line);
  while (q[group].length > 4) q[group].shift();
  next(group);
}
export function clearVoice(group) { q[group].length = 0; }
async function next(group) {
  if (speaking(group) || !q[group].length || !ready()) return;
  const line = q[group].shift();
  if (nowS() - line.t > STALE[group]) return next(group);
  busy[group] = nowS() + 0.5; // while it loads
  const bufs = await Promise.all(line.parts.map(id => load(line.v, id)));
  if (bufs.some(b => !b)) { busy[group] = 0; if (line.onStart) line.onStart(0); return next(group); } // a missing clip: only the writing shows
  const g = ac.createGain(); g.gain.value = gains[line.ch] ?? 1; g.connect(group === 'team' ? duck : bus);
  let at = ac.currentTime + 0.06, total = 0;
  for (let i = 0; i < bufs.length; i++) {
    const s = ac.createBufferSource(); s.buffer = bufs[i]; s.connect(g); s.start(at);
    at += bufs[i].duration + 0.035; total += bufs[i].duration + 0.035;
  }
  busy[group] = nowS() + total + 0.3;
  if (group === 'caster') { duck.gain.setTargetAtTime(0.5, ac.currentTime, 0.08); setTimeout(() => { if (!speaking('caster')) duck.gain.setTargetAtTime(1, ac.currentTime, 0.2); }, (total + 0.35) * 1000); }
  if (line.onStart) line.onStart(total);
  setTimeout(() => next(group), (total + 0.32) * 1000);
}
export { sliderGain };
