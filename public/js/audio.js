// All sounds are synthesised in the browser (no audio files needed).
let ac = null, master = null, noiseBuf = null;
let listener = { x: 0, y: 0 };

export function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  ac = new (window.AudioContext || window.webkitAudioContext)();
  master = ac.createGain(); master.gain.value = 0.5;
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
  master.connect(comp); comp.connect(ac.destination);
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 1.5, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

export function setListener(x, y) { listener = { x, y }; }
export function setVolume(v) { if (master) master.gain.value = v; }

function out(x, y, vol, range = 900) {
  if (!ac) return null;
  let gain = vol, pan = 0;
  if (x !== undefined) {
    const d = Math.hypot(x - listener.x, y - listener.y);
    gain *= Math.max(0, 1 - d / range) ** 1.6;
    pan = Math.max(-1, Math.min(1, (x - listener.x) / 300));
  }
  if (gain < 0.005) return null;
  const g = ac.createGain(); g.gain.value = gain;
  const p = ac.createStereoPanner(); p.pan.value = pan;
  g.connect(p); p.connect(master);
  return g;
}

function noise(dest, t0, dur, type, freq, q = 1, attack = 0.002, start = 1) {
  const src = ac.createBufferSource(); src.buffer = noiseBuf;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(start, t0 + attack); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(dest);
  src.start(t0, Math.random() * 0.5, dur + 0.05);
}

function tone(dest, t0, dur, f0, f1, type = 'sine', vol = 1) {
  const o = ac.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
  const g = ac.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + dur + 0.02);
}

const GUN = {
  AR: { f: 1800, dur: 0.16, thump: 120, vol: 0.9 },
  SMG: { f: 2400, dur: 0.11, thump: 160, vol: 0.75 },
  MP: { f: 2800, dur: 0.09, thump: 180, vol: 0.65 },
  LMG: { f: 1500, dur: 0.19, thump: 100, vol: 1.0 },
  DMR: { f: 1300, dur: 0.28, thump: 80, vol: 1.1 },
  Shotgun: { f: 900, dur: 0.32, thump: 70, vol: 1.2 },
  Pistol: { f: 2100, dur: 0.12, thump: 150, vol: 0.75 },
};

export function gunshot(cls, x, y) {
  const g = out(x, y, (GUN[cls] || GUN.AR).vol, 1400); if (!g) return;
  const s = GUN[cls] || GUN.AR, t = ac.currentTime;
  noise(g, t, s.dur, 'bandpass', s.f, 0.7);
  noise(g, t, s.dur * 1.8, 'lowpass', 600, 0.5, 0.002, 0.6);
  tone(g, t, 0.12, s.thump, 40, 'sine', 0.9);
}

export function explosion(x, y, big) {
  const g = out(x, y, big ? 1.4 : 1, 1800); if (!g) return;
  const t = ac.currentTime;
  noise(g, t, big ? 1.6 : 1.0, 'lowpass', 900, 0.4, 0.004);
  noise(g, t, 0.25, 'bandpass', 2500, 0.5, 0.001, 0.5);
  tone(g, t, 0.6, 90, 25, 'sine', 1.2);
}

export function play(name, x, y) {
  const t = ac ? ac.currentTime : 0;
  let g;
  switch (name) {
    case 'step': g = out(x, y, 0.22, 380); if (g) noise(g, t, 0.06, 'bandpass', 500 + Math.random() * 300, 1.2); break;
    case 'reload': g = out(x, y, 0.4, 500); if (g) { noise(g, t, 0.04, 'highpass', 3000, 1); noise(g, t + 0.25, 0.05, 'highpass', 2500, 1); noise(g, t + 0.5, 0.04, 'bandpass', 1800, 2); } break;
    case 'swap': g = out(x, y, 0.3, 400); if (g) noise(g, t, 0.05, 'bandpass', 2000, 2); break;
    case 'empty': g = out(x, y, 0.4, 300); if (g) tone(g, t, 0.03, 3000, 2500, 'square', 0.3); break;
    case 'hitmark': g = out(undefined, undefined, 0.35); if (g) tone(g, t, 0.05, 2600, 2400, 'triangle', 0.6); break;
    case 'killmark': g = out(undefined, undefined, 0.45); if (g) { tone(g, t, 0.07, 1800, 1800, 'triangle', 0.6); tone(g, t + 0.06, 0.1, 2400, 2400, 'triangle', 0.6); } break;
    case 'melee': g = out(x, y, 0.6, 500); if (g) { noise(g, t, 0.12, 'lowpass', 700, 0.8); tone(g, t, 0.08, 160, 60, 'sine', 0.7); } break;
    case 'wood': g = out(x, y, 0.8, 700); if (g) { noise(g, t, 0.25, 'bandpass', 700, 0.6); noise(g, t + 0.03, 0.15, 'bandpass', 1500, 1, 0.002, 0.5); } break;
    case 'wall': g = out(x, y, 0.35, 600); if (g) noise(g, t, 0.12, 'bandpass', 1100, 0.8); break;
    case 'ric': g = out(x, y, 0.25, 600); if (g) tone(g, t, 0.15, 2600 + Math.random() * 1500, 1200, 'sine', 0.3); break;
    case 'break': g = out(x, y, 0.5, 600); if (g) { noise(g, t, 0.1, 'highpass', 3500, 1); tone(g, t, 0.1, 900, 200, 'square', 0.15); } break;
    case 'barricade': g = out(x, y, 0.6, 600); for (let i = 0; i < 3 && g; i++) noise(g, t + i * 0.18, 0.08, 'bandpass', 900, 1.5); break;
    case 'reinforce': g = out(x, y, 0.8, 700); if (g) { tone(g, t, 0.4, 220, 140, 'sawtooth', 0.15); noise(g, t + 0.35, 0.3, 'lowpass', 400, 0.8); tone(g, t + 0.35, 0.3, 80, 50, 'square', 0.3); } break;
    case 'panel': g = out(x, y, 0.8, 700); if (g) { tone(g, t, 0.3, 140, 90, 'square', 0.25); noise(g, t, 0.3, 'bandpass', 600, 1); } break;
    case 'place': g = out(x, y, 0.45, 400); if (g) { noise(g, t, 0.06, 'bandpass', 1500, 2); tone(g, t + 0.05, 0.05, 1200, 1200, 'square', 0.1); } break;
    case 'throw': g = out(x, y, 0.3, 400); if (g) noise(g, t, 0.18, 'bandpass', 900, 0.6, 0.05); break;
    case 'bounce': g = out(x, y, 0.3, 500); if (g) tone(g, t, 0.05, 1100, 700, 'triangle', 0.4); break;
    case 'smoke': g = out(x, y, 0.6, 800); if (g) noise(g, t, 1.6, 'highpass', 1500, 0.4, 0.05); break;
    case 'dart': g = out(x, y, 0.5, 600); if (g) { noise(g, t, 0.08, 'bandpass', 2500, 1); tone(g, t, 0.1, 600, 300, 'sine', 0.3); } break;
    case 'launcher': g = out(x, y, 0.9, 1200); if (g) { tone(g, t, 0.15, 160, 60, 'sine', 1); noise(g, t, 0.2, 'lowpass', 800, 0.8); } break;
    case 'ping': g = out(x, y, 0.25, 900); if (g) tone(g, t, 0.25, 1500, 1450, 'sine', 0.5); break;
    case 'beep': g = out(x, y, 0.4, 900); if (g) tone(g, t, 0.08, 1760, 1760, 'square', 0.25); break;
    case 'plantStart': g = out(x, y, 0.6, 900); if (g) { tone(g, t, 0.1, 900, 900, 'square', 0.2); tone(g, t + 0.15, 0.1, 1200, 1200, 'square', 0.2); } break;
    case 'planted': g = out(undefined, undefined, 0.5); if (g) for (let i = 0; i < 3; i++) tone(g, t + i * 0.18, 0.12, 880 + i * 220, 880 + i * 220, 'square', 0.25); break;
    case 'revive': g = out(x, y, 0.4, 500); if (g) tone(g, t, 0.3, 500, 900, 'sine', 0.4); break;
    case 'stim': g = out(x, y, 0.5, 500); if (g) { noise(g, t, 0.06, 'highpass', 4000, 1); tone(g, t, 0.25, 700, 1300, 'sine', 0.4); } break;
    case 'ui': g = out(undefined, undefined, 0.25); if (g) tone(g, t, 0.05, 1300, 1300, 'triangle', 0.5); break;
    case 'round': g = out(undefined, undefined, 0.5); if (g) { tone(g, t, 0.5, 220, 220, 'sawtooth', 0.15); tone(g, t, 0.5, 330, 330, 'sawtooth', 0.12); } break;
    case 'drone': g = out(x, y, 0.08, 300); if (g) tone(g, t, 0.12, 180, 200, 'sawtooth', 0.4); break;
  }
}
