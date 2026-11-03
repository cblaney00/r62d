// Push to talk (he asked: talk to the bots with your real microphone). Words stay on this computer: only the text goes to the
// team chat, where the bots read it like anything typed (shared/commands.js). Loaded the first time you press the key.
// Recogniser: vosk-browser. He found it only caught him close to the mic, so the sound is levelled before it hears it (levelUp).
import { COMMAND_WORDS, micPhrases } from '/shared/commands.js';
let rec = null, model = null, ac = null, loading = null, held = false, tail = false, last = '', onDone = null, onState = null, onHear = null, finalAsked = false, recRate = 0;
let vocab = {}, vocabKey = '', recKey = null, stale = false;
let pending = 0; // sound sent to the recogniser that it has not answered yet
const ring = []; // the moment before the key went down, so the first word isn't cut off
const script = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
const grammar = mode => JSON.stringify(mode === 'words' ? [...new Set([...COMMAND_WORDS, ...vocab.flatMap(v => v.split(' '))])].concat('[unk]') : micPhrases(vocab.rooms || [], vocab.names || [], vocab.ops || []).concat('[unk]'));
async function makeRec(rate, mode = 'phrases') {
  if (!window.Vosk) await script('/vendor/vosk/vosk.js');
  if (!model) { model = await window.Vosk.createModel('/vendor/vosk/model.tar.gz'); try { model.setLogLevel(-1); } catch {} }
  const r = mode !== 'free' ? new model.KaldiRecognizer(rate, grammar(mode)) : new model.KaldiRecognizer(rate);
  r.on('result', m => { const t = m.result && m.result.text; pending = Math.max(0, pending - 1); if (t) { last = (last + ' ' + t).trim(); if (onHear) onHear(last, 0); } if (finalAsked && onDone) finish(); });
  r.on('partialresult', m => { pending = Math.max(0, pending - 1); const t = m.result && m.result.partial; if (t && onHear) onHear((last + ' ' + t).trim(), 0); });
  recRate = rate; recKey = vocabKey; stale = false;
  return r;
}
// the rooms and names of this match, so the recogniser knows those words too
export function pttVocab(rooms, names, ops) {
  const k = JSON.stringify([rooms, names, ops]); if (k === vocabKey) return;
  vocab = { rooms, names, ops }; vocabKey = k; if (rec && recKey !== k) stale = true;
}
function finish() { const t = last.replace(/\[unk\]/g, ' ').replace(/\s+/g, ' ').trim(), cb = onDone; onDone = null; last = ''; finalAsked = false; if (cb) cb(t); }
// Levelling: quiet speech is lifted to one steady level, far from the mic or close to it. The gain follows the loudest part
// heard lately, moves smoothly and clips nothing. boost: Settings → Sound → Microphone boost.
const TARGET = 0.09, MAX_GAIN = 40, FLOOR = 0.0006;
let env = 0, gain = 1, loudest = 0;
// A new press starts from the level of the last one (full: forget it), so even the first word is already lifted.
export const levelReset = (full = false) => { env *= 0.3; loudest = 0; if (full) { env = 0; gain = 1; } };
export function levelUp(src, boost = 1, rate = 48000) {
  const N = src.length, out = new Float32Array(N); let sum = 0;
  for (let i = 0; i < N; i++) sum += src[i] * src[i];
  const rms = Math.sqrt(sum / N); loudest = Math.max(loudest, rms);
  env = Math.max(rms, env * Math.exp(-(N / rate) / 1.5));
  const want = env > FLOOR ? Math.min(MAX_GAIN, TARGET / env) : Math.min(gain, 8);
  const dt = N / rate, g0 = gain, g1 = gain + (want - gain) * (1 - Math.exp(-dt / (want < gain ? 0.03 : 0.08))); gain = g1;
  for (let i = 0; i < N; i++) { const v = src[i] * (g0 + (g1 - g0) * i / N) * boost; out[i] = v > 0.98 ? 0.98 : v < -0.98 ? -0.98 : v; }
  return out;
}
const micBoost = () => { try { return (+localStorage.getItem('r62d-micboost') || 100) / 100; } catch { return 1; } };
function feed(samples, rate) {
  const b = new AudioBuffer({ length: samples.length, sampleRate: rate, numberOfChannels: 1 }); b.copyToChannel(samples, 0); pending++; rec.acceptWaveform(b);
}
// the last answer only counts once it has worked through everything it was sent, or words land in your next sentence
function askFinal(wait = 0) { if (!onDone) return; if (pending > 0 && wait < 1500) { setTimeout(() => askFinal(wait + 30), 30); return; } pending = 0; finalAsked = true; rec.retrieveFinalResult(); }
async function setup() {
  if (!navigator.mediaDevices) throw new Error('nomic'); // only on this computer: a browser refuses the microphone on a plain http address
  // the browser's own noise filter treats a voice far from the mic as noise, so it stays off; echo cancelling keeps the game's sound out
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: true } });
  ac = new AudioContext();
  rec = await makeRec(ac.sampleRate);
  const src = ac.createMediaStreamSource(stream), hp = ac.createBiquadFilter(), node = ac.createScriptProcessor(4096, 1, 1), mute = ac.createGain();
  hp.type = 'highpass'; hp.frequency.value = 90; mute.gain.value = 0; // (rumble and desk thumps only confuse it)
  node.onaudioprocess = e => {
    const d = e.inputBuffer.getChannelData(0);
    if (held || tail) {
      const boost = micBoost();
      while (ring.length) feed(levelUp(ring.shift(), boost, ac.sampleRate), ac.sampleRate);
      feed(levelUp(d, boost, ac.sampleRate), ac.sampleRate);
      if (onHear) onHear(null, Math.min(1, Math.sqrt(loudest) * 4));
    } else { ring.push(Float32Array.from(d)); if (ring.length > 6) ring.shift(); }
  };
  src.connect(hp); hp.connect(node); node.connect(mute); mute.connect(ac.destination);
}
// state: 'loading' | 'on' | 'off' | 'nomic'. hear(text, level): what it has understood so far, how loud the mic is
export function pttSetState(fn, hear) { onState = fn; onHear = hear || null; }
export async function pttDown() {
  if (held) return;
  held = true; last = ''; levelReset();
  try {
    if (!rec) { if (onState) onState('loading'); await (loading || (loading = setup())); }
    else if (stale) rec = await makeRec(ac.sampleRate); // (the old one stays: removing one seemed to leave the next deaf in testing)
    if (ac.state === 'suspended') ac.resume();
    if (held && onState) onState('on');
  } catch (e) { loading = null; held = false; if (onState) onState('nomic'); }
}
export function pttUp(cb) {
  if (!held) return;
  held = false; if (onState) onState('off');
  if (!rec) return;
  onDone = t => cb(t, loudest);
  tail = true; // keep listening a moment: people let go as they finish the word
  setTimeout(() => { tail = false; askFinal(); }, 350);
  setTimeout(() => { if (onDone) finish(); }, 3000);
}
// tests: feed samples straight in, no microphone
export async function pttTest(samples, rate, opts = {}) {
  if (opts.fresh) rec = null;
  if (opts.vocab) pttVocab(...opts.vocab);
  if (!rec || recRate !== rate) rec = await makeRec(rate, opts.mode || 'phrases');
  levelReset(true); pending = 0;
  return new Promise(res => {
    last = ''; finalAsked = false; onDone = t => res(t);
    const f = Float32Array.from(samples);
    const size = Math.round(rate * 0.085); // like the real microphone's pieces
    for (let i = 0; i + size <= f.length; i += size) { const c = f.subarray(i, i + size); feed(opts.raw ? Float32Array.from(c) : levelUp(c, 1, rate), rate); }
    askFinal();
    setTimeout(() => { if (onDone) finish(); }, 8000);
  });
}
