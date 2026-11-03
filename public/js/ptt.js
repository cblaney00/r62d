// Push to talk (he asked: talk to the bots with your real microphone). Understands set phrases, on this computer: nothing
// leaves it. Everything is loaded the first time you press the key. Recogniser: vosk-browser, see docs/voice.md.
export const PTT_PHRASES = {
  enemies: ['where are the enemies', 'where are they', 'where are they at', 'enemy location', 'any callouts', 'who is there', 'where is the enemy', 'anyone see them', 'any information', 'any info', 'where is everyone', 'what do you see', 'who do you see'],
  go: ['where should i go', 'where do i go', 'where do you want me', 'what should i do', 'what do i do', 'where to'],
  site: ['where is the site', 'where is the objective', 'where is the bomb', 'where is the defuser', 'what site'],
  follow: ['follow me', 'come with me', 'stay with me', 'on me', 'cover me', 'watch my back'],
  hold: ['hold here', 'hold this', 'stay here', 'wait here', 'stop', 'wait', 'hold position'],
  push: ['push', 'rush', 'go now', 'lets push', 'push up', 'go go', 'go in', 'attack', 'lets go', 'move in', 'take space'],
  help: ['help', 'i am down', 'im down', 'need backup', 'backup', 'help me', 'i need help', 'come here', 'get over here', 'revive me', 'pick me up'],
  quiet: ['be quiet', 'quiet', 'shut up', 'shut up real quick', 'stop talking', 'everyone quiet', 'hold comms'],
  thanks: ['thanks', 'thank you', 'nice one', 'good job', 'well played'],
};
const INTENT = {}; for (const k in PTT_PHRASES) for (const p of PTT_PHRASES[k]) INTENT[p] = k;
const WORDS = [...new Set(Object.keys(INTENT).join(' ').split(' '))];
// He said it doesn't understand him enough: the recogniser now hears single words in any order, and the closest phrase wins,
// so "uh where are they at" or a missed word still counts.
export function matchIntent(text) {
  const said = new Set(String(text || '').replace(/\[unk\]/g, ' ').split(/\s+/).filter(Boolean)); if (!said.size) return null;
  let best = null, bs = 0;
  for (const ph in INTENT) { const w = ph.split(' '), hit = w.filter(x => said.has(x)).length, sc = hit / w.length + hit * 0.01; if (hit && sc > bs) { bs = sc; best = INTENT[ph]; } }
  return bs >= 0.6 ? best : null;
}
let rec = null, ac = null, loading = null, held = false, tail = false, last = '', onDone = null, onState = null, finalAsked = false;
const ring = []; // the moment before the key went down, so the first word isn't cut off
const script = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
async function makeRec(rate) {
  if (!window.Vosk) await script('/vendor/vosk/vosk.js');
  const model = await window.Vosk.createModel('/vendor/vosk/model.tar.gz');
  const r = new model.KaldiRecognizer(rate, JSON.stringify([...WORDS, '[unk]']));
  r.on('result', m => { const t = m.result && m.result.text; if (t) last = (last + ' ' + t).trim(); if (finalAsked && onDone) finish(); });
  return r;
}
function finish() { const t = last.replace(/\[unk\]/g, ' ').replace(/\s+/g, ' ').trim(), cb = onDone; onDone = null; last = ''; finalAsked = false; if (cb) cb(t, matchIntent(t)); }
async function setup() {
  if (!navigator.mediaDevices) throw new Error('nomic'); // only on this computer: a browser refuses the microphone on a plain http address
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  ac = new AudioContext();
  rec = await makeRec(ac.sampleRate);
  const src = ac.createMediaStreamSource(stream), node = ac.createScriptProcessor(4096, 1, 1), mute = ac.createGain(); mute.gain.value = 0;
  node.onaudioprocess = e => {
    if (held || tail) { while (ring.length) rec.acceptWaveform(ring.shift()); rec.acceptWaveform(e.inputBuffer); return; }
    const c = new AudioBuffer({ length: e.inputBuffer.length, sampleRate: e.inputBuffer.sampleRate, numberOfChannels: 1 }); c.copyToChannel(e.inputBuffer.getChannelData(0), 0); ring.push(c); if (ring.length > 5) ring.shift();
  };
  src.connect(node); node.connect(mute); mute.connect(ac.destination);
}
// state: 'loading' | 'on' | 'off' | 'nomic'
export function pttSetState(fn) { onState = fn; }
export async function pttDown() {
  if (held) return;
  held = true; last = '';
  try {
    if (!rec) { if (onState) onState('loading'); await (loading || (loading = setup())); }
    if (ac.state === 'suspended') ac.resume();
    if (held && onState) onState('on');
  } catch (e) { loading = null; held = false; if (onState) onState('nomic'); }
}
export function pttUp(cb) {
  if (!held) return;
  held = false; if (onState) onState('off');
  if (!rec) return;
  onDone = cb; tail = true; // keep listening a moment: people let go as they finish the word
  setTimeout(() => { tail = false; if (onDone) { finalAsked = true; rec.retrieveFinalResult(); } }, 350);
  setTimeout(() => { if (onDone) finish(); }, 1600);
}
// tests: feed samples straight in, no microphone
export async function pttTest(samples, rate) {
  rec = rec || await makeRec(rate);
  return new Promise(res => { last = ''; onDone = (t, i) => res({ t, i }); const b = new AudioBuffer({ length: samples.length, sampleRate: rate, numberOfChannels: 1 }); b.copyToChannel(Float32Array.from(samples), 0); rec.acceptWaveform(b); setTimeout(() => { finalAsked = true; rec.retrieveFinalResult(); }, 200); setTimeout(() => { if (onDone) finish(); }, 4000); });
}
