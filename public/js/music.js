// Menu music, composed live: dark, slow, cinematic-tactical. D minor, 84 BPM.
// Layers come in over time: pads -> sub bass + soft kit -> delayed arpeggio, with breakdowns.
import { getAudio } from './audio.js';

const BPM = 84, S16 = 60 / BPM / 4;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
// two bars per chord: Dm9, Bbmaj7, Gm9, A7sus4 (resolving)
const CHORDS = [
  { bass: 38, pad: [50, 53, 57, 64], arp: [62, 65, 69, 72, 76] },
  { bass: 34, pad: [46, 50, 53, 57], arp: [58, 62, 65, 69, 74] },
  { bass: 31, pad: [46, 50, 55, 57], arp: [55, 58, 62, 67, 69] },
  { bass: 33, pad: [45, 50, 52, 55], arp: [57, 62, 64, 67, 69] },
];
const HAT_VEL = [1, 0.35, 0.6, 0.35, 0.9, 0.35, 0.6, 0.45, 1, 0.35, 0.6, 0.35, 0.9, 0.4, 0.7, 0.5];

let bus = null, verb = null, delayIn = null, noise = null, timer = null;
let step = 0, nextT = 0, playing = false, mood = 'menu', vol = 0.5;

function setup(ac, master) {
  bus = ac.createGain(); bus.gain.value = 0; bus.connect(master);
  verb = ac.createConvolver();
  const len = ac.sampleRate * 3.2, ir = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lo = 0; for (let i = 0; i < len; i++) { lo += 0.25 * ((Math.random() * 2 - 1) - lo); d[i] = lo * Math.pow(1 - i / len, 2.4) * 1.8; } }
  verb.buffer = ir;
  const vg = ac.createGain(); vg.gain.value = 0.55; verb.connect(vg); vg.connect(bus);
  // dotted-eighth delay for the arpeggio
  delayIn = ac.createGain();
  const dl = ac.createDelay(2); dl.delayTime.value = S16 * 3;
  const fb = ac.createGain(); fb.gain.value = 0.38;
  const dlp = ac.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2200;
  delayIn.connect(dl); dl.connect(dlp); dlp.connect(fb); fb.connect(dl); dlp.connect(bus); dlp.connect(verb);
  noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
}

const out = (ac, g, wet = 0.3) => { const o = ac.createGain(); o.gain.value = g; o.connect(bus); if (wet) { const w = ac.createGain(); w.gain.value = wet; o.connect(w); w.connect(verb); } return o; };

function pad(ac, t, chord, dur, bright) {
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.7;
  f.frequency.setValueAtTime(bright ? 900 : 500, t);
  f.frequency.linearRampToValueAtTime(bright ? 1900 : 1200, t + dur * 0.55);
  f.frequency.linearRampToValueAtTime(bright ? 1100 : 600, t + dur + 1.5);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.11, t + 1.6);
  g.gain.setValueAtTime(0.11, t + dur); g.gain.linearRampToValueAtTime(0.0001, t + dur + 2.2);
  f.connect(g); g.connect(out(ac, 1, 0.65));
  chord.pad.forEach((m, i) => {
    for (const det of [-7, 6]) {
      const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det + (Math.random() - 0.5) * 4;
      const p = ac.createStereoPanner(); p.pan.value = (i / 3 - 0.5) * 0.9 * (det > 0 ? 1 : -1);
      const vg = ac.createGain(); vg.gain.value = 0.18;
      o.connect(vg); vg.connect(p); p.connect(f); o.start(t); o.stop(t + dur + 2.4);
    }
  });
  const sub = ac.createOscillator(); sub.type = 'triangle'; sub.frequency.value = mtof(chord.pad[0] - 12);
  const sg = ac.createGain(); sg.gain.value = 0.2; sub.connect(sg); sg.connect(f); sub.start(t); sub.stop(t + dur + 2.4);
}
function bass(ac, t, m) {
  const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = mtof(m);
  const o2 = ac.createOscillator(); o2.type = 'triangle'; o2.frequency.value = mtof(m);
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.32, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
  const g2 = ac.createGain(); g2.gain.value = 0.25;
  o.connect(g); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(out(ac, 1, 0.05));
  o.start(t); o2.start(t); o.stop(t + 0.6); o2.stop(t + 0.6);
}
function kick(ac, t, v = 1) {
  const o = ac.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
  const g = ac.createGain(); g.gain.setValueAtTime(0.5 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
  o.connect(g); g.connect(out(ac, 1, 0.08)); o.start(t); o.stop(t + 0.4);
}
function hit(ac, t, type, freq, dur, v, wet = 0.2) {
  const s = ac.createBufferSource(); s.buffer = noise; s.playbackRate.value = 0.9 + Math.random() * 0.2;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = 0.8;
  const g = ac.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(out(ac, 1, wet)); s.start(t, Math.random() * 0.5, dur + 0.02);
}
function pluck(ac, t, m, v) {
  const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(m);
  const o2 = ac.createOscillator(); o2.type = 'sine'; o2.frequency.value = mtof(m + 12);
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(700, t + 0.2);
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06 * v, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  const g2 = ac.createGain(); g2.gain.value = 0.3;
  o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g);
  const p = ac.createStereoPanner(); p.pan.value = (Math.random() - 0.5) * 0.6;
  g.connect(p); p.connect(bus); p.connect(delayIn);
  o.start(t); o2.start(t); o.stop(t + 0.32); o2.stop(t + 0.32);
}
function swell(ac, t, dur) { // rising filtered noise into the next section
  const s = ac.createBufferSource(); s.buffer = noise; s.loop = true;
  const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2;
  f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(5000, t + dur);
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + dur * 0.95); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.03);
  s.connect(f); f.connect(g); g.connect(out(ac, 1, 0.5)); s.start(t); s.stop(t + dur + 0.05);
}

// which layers play in a given bar (the arrangement repeats every 40 bars)
function section(bar) {
  const b = bar % 40;
  if (b < 8) return { drums: false, bass: b >= 4, arp: false, hats: b >= 6 };
  if (b < 24) return { drums: true, bass: true, arp: b >= 16, hats: true };
  if (b < 32) return { drums: false, bass: false, arp: true, hats: false };   // breakdown
  return { drums: true, bass: true, arp: true, hats: true, busy: true };
}

function schedule(ac) {
  while (nextT < ac.currentTime + 0.25) {
    const t = nextT, bar = Math.floor(step / 16), s16 = step % 16;
    const chord = CHORDS[Math.floor(bar / 2) % 4], sec = section(bar), tense = mood === 'select';
    if (s16 === 0 && bar % 2 === 0) pad(ac, t, chord, S16 * 32, tense || sec.busy);
    if (sec.bass && [0, 6, 8, 14].includes(s16)) bass(ac, t, chord.bass + (s16 === 14 && bar % 2 ? 12 : 0));
    if (sec.drums) {
      if (s16 === 0 || s16 === 10) kick(ac, t, s16 === 0 ? 1 : 0.7);
      if (s16 === 8) hit(ac, t, 'bandpass', 1700, 0.18, 0.14, 0.4);                         // soft clap
      if (sec.busy && s16 === 15 && Math.random() < 0.5) hit(ac, t, 'bandpass', 2200, 0.08, 0.06);
    }
    if (sec.hats || tense) {
      const v = HAT_VEL[s16] * (0.7 + Math.random() * 0.3) * (tense ? 1.2 : 1);
      if (s16 % (tense ? 1 : 2) === 0 || Math.random() < 0.3) hit(ac, t, 'highpass', 7500, s16 === 14 && bar % 2 ? 0.2 : 0.035, 0.05 * v, 0.1);
    }
    if (sec.arp && s16 % 2 === 0) { const a = chord.arp; pluck(ac, t, a[(step / 2 + bar) % a.length], s16 % 4 === 0 ? 1 : 0.7); }
    if (bar % 8 === 6 && s16 === 0) swell(ac, t, S16 * 32);
    step++; nextT += S16;
  }
}

export function startMusic(m = 'menu') {
  mood = m;
  const A = getAudio(); if (!A) return;
  const { ac, master } = A;
  if (!bus) setup(ac, master);
  bus.gain.cancelScheduledValues(ac.currentTime);
  bus.gain.setTargetAtTime(vol * 0.55, ac.currentTime, 1.2);
  if (playing) return;
  playing = true; step = 0; nextT = ac.currentTime + 0.1;
  timer = setInterval(() => schedule(ac), 40);
}
export function stopMusic() {
  const A = getAudio(); if (!A || !playing || !bus) return;
  const { ac } = A;
  bus.gain.cancelScheduledValues(ac.currentTime);
  bus.gain.setTargetAtTime(0, ac.currentTime, 0.7);
  clearInterval(timer); playing = false; // notes already playing fade out with the bus
}
export function setMood(m) { mood = m; }
export function setMusicVolume(v) { vol = v; const A = getAudio(); if (A && bus && playing) bus.gain.setTargetAtTime(vol * 0.55, A.ac.currentTime, 0.2); }
export const musicPlaying = () => playing;
