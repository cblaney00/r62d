// Push to talk (he asked: talk to the bots with your real microphone). Words stay on this computer: only the text goes to the
// team chat, where the bots read it like anything typed (shared/commands.js). Loaded the first time you press the key.
// Recogniser: vosk-browser. He found it only caught him close to the mic, so the sound is levelled before it hears it (levelUp).
import { COMMAND_WORDS, micPhrases, micFix } from '/shared/commands.js';
let rec = null, model = null, ac = null, loading = null, held = false, tail = false, last = '', onDone = null, onState = null, onHear = null, finalAsked = false, gotFinal = false, retried = false, recRate = 0;
let vocab = {}, vocabKey = '', recKey = null, stale = false;
let pending = 0, lastEv = 0; // sound sent to the recogniser that it has not answered yet, when it last said anything
const ring = []; // the moment before the key went down, so the first word isn't cut off
const script = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
const grammar = mode => JSON.stringify(mode === 'words' ? [...new Set([...COMMAND_WORDS, ...Object.values(vocab).flat().flatMap(v => v.split(' '))])].concat('[unk]') : micPhrases(vocab.rooms || [], vocab.names || [], vocab.ops || []).concat('[unk]'));
async function makeRec(rate, mode = 'phrases') {
  if (!window.Vosk) await script('/vendor/vosk/vosk.js');
  if (!model) { model = await window.Vosk.createModel('/vendor/vosk/model.tar.gz'); try { model.setLogLevel(-1); } catch {} }
  const r = mode !== 'free' ? new model.KaldiRecognizer(rate, grammar(mode)) : new model.KaldiRecognizer(rate);
  r.on('result', m => { lastEv = performance.now(); const t = m.result && m.result.text; pending = Math.max(0, pending - 1); if (t) { last = (last + ' ' + t).trim(); if (onHear) onHear(last, 0); } if (finalAsked) gotFinal = true; });
  r.on('partialresult', m => { lastEv = performance.now(); pending = Math.max(0, pending - 1); const t = m.result && m.result.partial; if (t && onHear) onHear((last + ' ' + t).trim(), 0); });
  recRate = rate; recKey = vocabKey; stale = false;
  return r;
}
// the rooms and names of this match, so the recogniser knows those words too
export function pttVocab(rooms, names, ops) {
  const k = JSON.stringify([rooms, names, ops]); if (k === vocabKey) return;
  vocab = { rooms, names, ops }; vocabKey = k; if (rec && recKey !== k) stale = true;
}
function finish() { const t = micFix(last.replace(/\[unk\]/g, ' ').replace(/\s+/g, ' ').trim()), cb = onDone; onDone = null; last = ''; finalAsked = false; if (cb) cb(t); }
// Levelling: quiet speech is lifted to one steady level, far from the mic or close to it. The gain follows the loudest part
// heard lately, moves smoothly and clips nothing. boost: Settings → Sound → Microphone boost.
const TARGET = 0.09, MAX_GAIN = 40, FLOOR = 0.0006;
let env = 0, gain = 1, loudest = 0;
// A new press starts from the level of the last one (full: forget it), so even the first word is already lifted.
export const levelReset = (full = false) => { env *= 0.3; loudest = 0; gateHang = 0; gatePrev = null; if (full) { env = 0; gain = 1; noiseAt = 0; } };
export function levelUp(src, boost = 1, rate = 48000) {
  const N = src.length, out = new Float32Array(N); let sum = 0;
  for (let i = 0; i < N; i++) sum += src[i] * src[i];
  const raw = Math.sqrt(sum / N), rms = raw * boost; loudest = Math.max(loudest, raw); // (boost counts before the levelling: it helps a very quiet mic and can't distort a normal voice)
  env = Math.max(rms, env * Math.exp(-(N / rate) / 1.5));
  const want = env > FLOOR ? Math.min(MAX_GAIN, TARGET / env) : Math.min(gain, 8); // (env follows the boosted level)
  const dt = N / rate, g0 = gain, g1 = gain + (want - gain) * (1 - Math.exp(-dt / (want < gain ? 0.03 : 0.08))); gain = g1;
  for (let i = 0; i < N; i++) { const v = src[i] * boost * (g0 + (g1 - g0) * i / N); out[i] = v > 0.98 ? 0.98 : v < -0.98 ? -0.98 : v; }
  return out;
}
// Between words the levelling would lift room noise until the recogniser hears words in it ("in someone in", he read a test
// set in his room): anything not clearly above the room's own noise is turned right down. noiseAt follows the quietest
// sound lately, the mic idling between presses included; a piece of sound just before speech starts is kept (gateNext).
let noiseAt = 0, gateHang = 0, gatePrev = null, GATE = 3;
const rmsOf = d => { let s = 0; for (let i = 0; i < d.length; i++) s += d[i] * d[i]; return Math.sqrt(s / d.length); };
export const noiseTrack = d => { const r = rmsOf(d); noiseAt = !noiseAt ? Math.max(r, 1e-5) : Math.min(noiseAt * 1.01, Math.max(r, 1e-5)); return r; };
function gateNext(d) {
  const r = noiseTrack(d), open = r > Math.max(noiseAt * GATE, 0.0012), was = gateHang > 0;
  gateHang = open ? 4 : gateHang - 1;
  const out = gatePrev; gatePrev = Float32Array.from(d); if (!out) return null;
  if (open || was) return out;
  const q = new Float32Array(out.length); for (let i = 0; i < q.length; i++) q[i] = out[i] * 0.05; return q;
}
// Open mic (he asked, as a choice next to push to talk): listening all the time, a sentence starts when sound rises above the
// room's noise and ends after a short pause. Only the words of a sentence that means something go to the team (main.js).
let openOn = false, openCb = null, talking = false, quietN = 0, longN = 0, loudN = 0;
export function setOpenMic(on, cb) { openOn = on; openCb = on ? cb : null; if (!on && talking) { talking = false; held = false; last = ''; if (onState) onState('off'); } }
const micBoost = () => { try { return (+localStorage.getItem('r62d-micboost') || 100) / 100; } catch { return 1; } };
function feed(samples, rate) {
  const b = new AudioBuffer({ length: samples.length, sampleRate: rate, numberOfChannels: 1 }); b.copyToChannel(samples, 0); pending++; rec.acceptWaveform(b);
}
// the last answer only counts once it has worked through everything it was sent, or words land in your next sentence
function askFinal(wait = 0) { if (!onDone) return; if (pending > 0 && wait < 6000) { setTimeout(() => askFinal(wait + 30), 30); return; } pending = 0; finalAsked = true; gotFinal = false; retried = false; lastEv = performance.now(); rec.retrieveFinalResult(); settle(lastEv); }
// A pause in your speech gives an (often empty) answer of its own, so the first answer after the key is not the last: done once it has gone quiet
function settle(t0) {
  if (!onDone || !finalAsked) return;
  const now = performance.now();
  if ((gotFinal && now - lastEv > 250) || now - t0 > 3000) {
    // Now and then the recogniser answers empty and keeps the words for next time: a moment of quiet and a second ask brings them out
    if (!last.trim() && !retried && recRate) { retried = true; gotFinal = false; feed(new Float32Array(Math.round(recRate * 0.3)), recRate); rec.retrieveFinalResult(); lastEv = now; setTimeout(() => settle(now), 40); return; }
    finish();
  } else setTimeout(() => settle(t0), 40);
}
// one piece of sound from the microphone
export function micBlock(d) {
  if (held || tail) {
    const boost = micBoost();
    const hear = b => { const g = gateNext(b); if (g) feed(levelUp(g, boost, ac.sampleRate), ac.sampleRate); };
    while (ring.length) hear(ring.shift());
    hear(d);
    if (onHear) onHear(null, Math.min(1, Math.sqrt(loudest) * 4));
  } else if (openOn && openCb && !onDone) {
    const boost = micBoost(), hear = b => { const g = gateNext(b); if (g) feed(levelUp(g, boost, ac.sampleRate), ac.sampleRate); }, block = Float32Array.from(d);
    if (!talking) {
      const r = noiseTrack(block); loudN = r > Math.max(noiseAt * GATE, 0.0012) ? loudN + 1 : 0;
      ring.push(block); if (ring.length > 6) ring.shift();
      if (loudN >= 2) { talking = true; quietN = 0; longN = 0; last = ''; levelReset(); if (onState) onState('on'); while (ring.length) hear(ring.shift()); }
    } else {
      const loud = rmsOf(block) > Math.max(noiseAt * GATE, 0.0012); quietN = loud ? 0 : quietN + 1; longN++; hear(block);
      if (onHear) onHear(null, Math.min(1, Math.sqrt(loudest) * 4));
      if (quietN > 8 || longN > 94) { talking = false; loudN = 0; if (onState) onState('off'); onDone = t => openCb && openCb(t, loudest); askFinal(); setTimeout(() => { if (onDone) finish(); }, 9000); } // (about 0.7 s of quiet, or 8 s of talking)
    }
  } else { noiseTrack(d); ring.push(Float32Array.from(d)); if (ring.length > 6) ring.shift(); }
}
async function setup() {
  if (!navigator.mediaDevices) throw new Error('nomic'); // only on this computer: a browser refuses the microphone on a plain http address
  // the browser's own noise filter treats a voice far from the mic as noise, so it stays off; echo cancelling keeps the game's sound out
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: true } });
  ac = new AudioContext();
  if (preloading) await preloading;
  if (!rec || stale || recRate !== ac.sampleRate) rec = await makeRec(ac.sampleRate);
  const src = ac.createMediaStreamSource(stream), hp = ac.createBiquadFilter(), node = ac.createScriptProcessor(4096, 1, 1), mute = ac.createGain();
  hp.type = 'highpass'; hp.frequency.value = 90; mute.gain.value = 0; // (rumble and desk thumps only confuse it)
  node.onaudioprocess = e => micBlock(e.inputBuffer.getChannelData(0));
  src.connect(hp); hp.connect(node); node.connect(mute); mute.connect(ac.destination);
}
// state: 'loading' | 'on' | 'off' | 'nomic'. hear(text, level): what it has understood so far, how loud the mic is
export function pttSetState(fn, hear) { const old = [onState, onHear]; onState = fn; onHear = hear || null; return old; }
// Ready before the key is pressed, so the first thing you say in a match isn't lost while the model loads. No microphone yet.
let preloading = null;
export function pttPreload() {
  if (rec && !stale) return preloading = null;
  if (preloading) return preloading;
  return preloading = (async () => { const t = new AudioContext(), rate = t.sampleRate; try { t.close(); } catch {} rec = await makeRec(rate); preloading = null; })().catch(() => { preloading = null; });
}
// the microphone and recogniser ready now (the voice test): false if there is no microphone
export async function pttReady() { try { await (loading || (loading = setup())); if (stale) rec = await makeRec(ac.sampleRate); return true; } catch { loading = null; return false; } }
export async function pttDown() {
  if (held) return;
  held = true; last = ''; levelReset();
  try {
    if (!ac) { if (onState) onState('loading'); await (loading || (loading = setup())); }
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
  setTimeout(() => { if (onDone) finish(); }, 9000);
}
// tests: feed samples straight in, no microphone
export async function pttTest(samples, rate, opts = {}) {
  if (opts.fresh) rec = null; // (the old one stays: see pttDown)
  if (opts.vocab) pttVocab(...opts.vocab);
  if (!rec || recRate !== rate) rec = await makeRec(rate, opts.mode || 'phrases');
  levelReset(true); pending = 0; GATE = opts.gate || 3;
  return new Promise(res => {
    // done only once the recogniser has gone quiet, so nothing lands on the next clip
    last = ''; finalAsked = false; onDone = t => { const wait = () => { if (performance.now() - lastEv < 300) return setTimeout(wait, 50); const late = last; last = ''; res((t + ' ' + late).trim()); }; wait(); };
    const f = new Float32Array(samples.length + Math.round(rate * 0.7)); f.set(samples); // (a moment of quiet after it, as a person's key-up gives)
    const size = Math.round(rate * 0.085); // like the real microphone's pieces
    for (let i = 0; i + size <= f.length; i += size) { const c = f.subarray(i, i + size); const g = opts.gate === 0 ? Float32Array.from(c) : gateNext(c); if (g) feed(opts.raw ? g : levelUp(g, 1, rate), rate); }
    askFinal();
    setTimeout(() => { if (onDone) finish(); }, 15000);
  });
}
