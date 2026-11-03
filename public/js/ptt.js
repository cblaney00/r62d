// Push to talk (he asked: talk to the bots with your real microphone). Understands set phrases, on this computer: nothing
// leaves it. Everything is loaded the first time you press the key. Recogniser: vosk-browser, see docs/voice.md.
export const PTT_PHRASES = {
  enemies: ['where are the enemies', 'where are they', 'where is the enemy', 'anyone see them', 'any information', 'any info', 'where is everyone', 'what do you see', 'who do you see'],
  go: ['where should i go', 'where do i go', 'where do you want me', 'what should i do', 'what do i do', 'where to'],
  site: ['where is the site', 'where is the objective', 'where is the bomb', 'where is the defuser', 'what site'],
  follow: ['follow me', 'come with me', 'stay with me', 'on me', 'cover me', 'watch my back'],
  hold: ['hold here', 'hold this', 'stay here', 'wait here', 'stop', 'wait', 'hold position'],
  push: ['push', 'push up', 'go go', 'go in', 'attack', 'lets go', 'move in', 'take space'],
  help: ['help', 'help me', 'i need help', 'come here', 'get over here', 'revive me', 'pick me up'],
  quiet: ['be quiet', 'quiet', 'shut up', 'shut up real quick', 'stop talking', 'everyone quiet', 'hold comms'],
  thanks: ['thanks', 'thank you', 'nice one', 'good job', 'well played'],
};
const INTENT = {}; for (const k in PTT_PHRASES) for (const p of PTT_PHRASES[k]) INTENT[p] = k;
let rec = null, ac = null, loading = null, held = false, last = '', onDone = null, onState = null;
const script = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
async function makeRec(rate) {
  if (!window.Vosk) await script('/vendor/vosk/vosk.js');
  const model = await window.Vosk.createModel('/vendor/vosk/model.tar.gz');
  const r = new model.KaldiRecognizer(rate, JSON.stringify([...Object.keys(INTENT), '[unk]']));
  r.on('result', m => { const t = m.result && m.result.text; if (t) { last = t; if (!held && onDone) finish(); } });
  return r;
}
function finish() { const t = last, cb = onDone; onDone = null; last = ''; if (cb) cb(t, INTENT[t] || null); }
async function setup() {
  if (!navigator.mediaDevices) throw new Error('nomic'); // only on this computer: a browser refuses the microphone on a plain http address
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  ac = new AudioContext();
  rec = await makeRec(ac.sampleRate);
  const src = ac.createMediaStreamSource(stream), node = ac.createScriptProcessor(4096, 1, 1), mute = ac.createGain(); mute.gain.value = 0;
  node.onaudioprocess = e => { if (held) rec.acceptWaveform(e.inputBuffer); };
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
  onDone = cb;
  setTimeout(() => { if (onDone) rec.retrieveFinalResult(); }, 250);
  setTimeout(() => { if (onDone) finish(); }, 1400);
}
// tests: feed samples straight in, no microphone
export async function pttTest(samples, rate) {
  rec = rec || await makeRec(rate);
  return new Promise(res => { last = ''; onDone = (t, i) => res({ t, i }); const b = new AudioBuffer({ length: samples.length, sampleRate: rate, numberOfChannels: 1 }); b.copyToChannel(Float32Array.from(samples), 0); rec.acceptWaveform(b); setTimeout(() => rec.retrieveFinalResult(), 200); setTimeout(() => { if (onDone) finish(); }, 4000); });
}
