// R62D sound engine. Everything is synthesised (no audio files).
// Each sound is positioned: distance fade, stereo pan, muffling through walls, and a room echo.
let ac = null, master = null, sfx = null, verb = null, verbIn = null, noiseBuf = null;
let listener = { x: 0, y: 0 }, occlude = () => 0, indoorAt = () => true;
let vol = { master: 0.6, sfx: 1 };
const loops = new Map();

// ---- THE MIX: one volume per kind of sound (measured with measureMix, see docs/sound.md) ----
export const MIX = { guns: 2.6, explosions: 2.8, steps: 7.2, foley: 2.25, body: 0.4, impacts: 11.5, gadgets: 3.6, ui: 27, loops: 1.4 };
let C = 'foley'; // category of the sound currently being built

export function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  buildGraph(new (window.AudioContext || window.webkitAudioContext)());
  setTimeout(prewarmGuns, 50); // build the gunshot recordings once, right after sound starts
}

function buildGraph(context) {
  ac = context;
  master = ac.createGain(); master.gain.value = vol.master;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -9; comp.knee.value = 6; comp.ratio.value = 4; comp.attack.value = 0.002; comp.release.value = 0.2;
  master.connect(comp); comp.connect(ac.destination);
  sfx = ac.createGain(); sfx.gain.value = vol.sfx; sfx.connect(master);
  // room echo: a generated impulse response
  verb = ac.createConvolver();
  const len = ac.sampleRate * 1.4, ir = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch); let lo = 0;
    for (let i = 0; i < len; i++) {
      const t = i / ac.sampleRate, cut = 0.5 * Math.exp(-t * 3) + 0.03;
      lo += cut * ((Math.random() * 2 - 1) - lo);
      d[i] = lo * Math.exp(-t / 0.32) * (t < 0.004 ? t / 0.004 : 1) * 1.6;
    }
    for (const [ms, g] of [[6, 0.7], [11, 0.5], [17, 0.45], [24, 0.35], [33, 0.28], [45, 0.2]]) {
      const j = Math.floor((ms + (ch ? 1.7 : 0)) / 1000 * ac.sampleRate); d[j] += g * (ch ? 0.9 : 1); d[j + 1] -= g * 0.5;
    }
  }
  verb.buffer = ir;
  verbIn = ac.createGain(); verbIn.gain.value = 0.5;
  const verbLP = ac.createBiquadFilter(); verbLP.type = 'lowpass'; verbLP.frequency.value = 4500;
  verbIn.connect(verb); verb.connect(verbLP); verbLP.connect(sfx);
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

export function setListener(x, y) { listener = { x, y }; }
export function setWorld(occFn, indoorFn) { occlude = occFn; indoorAt = indoorFn; }
export function setVolume(m, s) { if (m !== undefined) vol.master = m; if (s !== undefined) vol.sfx = s; if (master) { master.gain.value = vol.master; sfx.gain.value = vol.sfx; } }
export const now = () => (ac ? ac.currentTime : 0);

// Build the output chain for one sound at (x, y). Returns null if inaudible.
function out(x, y, gain, range = 900, wet = 0.25) {
  if (!ac || (ac.state !== 'running' && !ac.offline)) return null;
  gain *= MIX[C] ?? 1;
  let pan = 0, walls = 0, d = 0;
  if (x !== undefined) {
    d = Math.hypot(x - listener.x, y - listener.y);
    gain *= Math.max(0, 1 - d / range) ** 1.7;
    if (gain < 0.003) return null;
    pan = Math.max(-0.9, Math.min(0.9, (x - listener.x) / 260));
    walls = d > 20 ? occlude(x, y) : 0;
  }
  const g = ac.createGain(); g.gain.value = gain * Math.pow(0.55, walls);
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.value = walls === 0 ? 18000 - Math.min(12000, d * 10) : walls === 1 ? 1400 : 650;
  const p = ac.createStereoPanner(); p.pan.value = pan;
  g.connect(lp); lp.connect(p); p.connect(sfx);
  const send = ac.createGain();
  send.gain.value = wet * (indoorAt(listener.x, listener.y) ? 1 : 0.35) * (1 + Math.min(0.6, d / 800) + walls * 0.4);
  p.connect(send); send.connect(verbIn);
  return g;
}

// --- building blocks ---
function noise(dest, t, dur, type, freq, q = 1, peak = 1, attack = 0.002, sweepTo = null) {
  const src = ac.createBufferSource(); src.buffer = noiseBuf; src.playbackRate.value = 0.85 + Math.random() * 0.3;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(dest);
  src.start(t, Math.random() * 1.5, dur + 0.05);
}
function tone(dest, t, dur, f0, f1, type = 'sine', peak = 1, attack = 0.001) {
  const o = ac.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.03);
}
const click = (d, t, f = 3500, v = 0.5, dur = 0.012) => noise(d, t, dur, 'bandpass', f, 2.5, v, 0.0005);
function ring(d, t, base, v = 0.3, dur = 0.25) { // small metal object: a few inharmonic partials
  for (const r of [1, 2.76, 5.4]) tone(d, t, dur / r ** 0.3, base * r * (0.98 + Math.random() * 0.04), base * r, 'sine', v / r);
}
const rnd = (a, b) => a + Math.random() * (b - a);

// --- footsteps by surface ---
// surfaces: wood, tile, marble, carpet, concrete, grass, asphalt, metal, rubble
const SURF = {
  wood:     { f: 480,  q: 1.2, lp: 1600, body: 110, v: 0.9 },
  tile:     { f: 2600, q: 1.6, lp: 6000, body: 0,   v: 0.7 },
  marble:   { f: 3200, q: 1.8, lp: 7000, body: 0,   v: 0.75 },
  carpet:   { f: 320,  q: 0.8, lp: 700,  body: 80,  v: 0.55 },
  concrete: { f: 1300, q: 1.0, lp: 4000, body: 70,  v: 0.8 },
  grass:    { f: 4200, q: 0.5, lp: 9000, body: 0,   v: 0.5 },
  asphalt:  { f: 1700, q: 0.8, lp: 5000, body: 60,  v: 0.75 },
  metal:    { f: 900,  q: 3,   lp: 6000, body: 0,   v: 0.8 },
  rubble:   { f: 2200, q: 0.6, lp: 8000, body: 0,   v: 0.8 },
  glass:    { f: 3800, q: 0.9, lp: 12000, body: 0,  v: 0.85 },
  splinters:{ f: 1100, q: 1.0, lp: 5000, body: 120, v: 0.85 },
};

export function step(x, y, surf, pace, own) {
  C = 'steps';
  // pace: 0 walk (Shift), 1 crouch, 2 run, 3 run (heavy)
  if (pace <= 1 && !own) return; // silent movement, like CS2
  const s = SURF[surf] || SURF.concrete;
  const loud = [0.2, 0.32, 0.92, 1][pace] * s.v;
  const range = [160, 220, 580, 620][pace];
  const g = out(own ? undefined : x, own ? undefined : y, loud * (own ? 0.42 : 1), range, 0.12); if (!g) return;
  const t = ac.currentTime + rnd(0, 0.01);
  noise(g, t, 0.05, 'bandpass', s.f * rnd(0.85, 1.15), s.q, 0.9);                    // heel
  noise(g, t + rnd(0.035, 0.06), 0.07, 'bandpass', s.f * rnd(0.7, 1.0), s.q, 0.5);    // toe
  if (s.body) tone(g, t, 0.07, s.body * rnd(0.9, 1.1), s.body * 0.6, 'sine', 0.5);
  if (surf === 'grass' || surf === 'rubble') noise(g, t + 0.02, 0.14, 'highpass', surf === 'grass' ? 3500 : 2500, 0.5, 0.35, 0.02);
  if (surf === 'rubble') for (let i = 0; i < 3; i++) click(g, t + rnd(0.01, 0.07), rnd(1500, 3000), 0.3, 0.012);   // grit shifting
  if (surf === 'glass') {                                                                    // shards crunching and tinkling
    for (let i = 0; i < 6; i++) click(g, t + rnd(0, 0.06), rnd(3500, 8000), rnd(0.3, 0.7), 0.006);
    for (let i = 0; i < 3; i++) ring(g, t + rnd(0.01, 0.08), rnd(4000, 7500), 0.12, 0.09);
  }
  if (surf === 'splinters') for (let i = 0; i < 3; i++) noise(g, t + rnd(0, 0.06), 0.03, 'bandpass', rnd(1400, 2600), 3, 0.6, 0.002); // dry snaps
  if (surf === 'metal') { ring(g, t, rnd(320, 420), 0.35, 0.18); tone(g, t, 0.09, 180, 120, 'sine', 0.4); }          // hollow raised floor
  if (surf === 'marble') ring(g, t + 0.002, rnd(1800, 2400), 0.06, 0.06);
  if (surf === 'asphalt' || surf === 'concrete') noise(g, t + 0.04, 0.09, 'bandpass', 2600, 0.8, 0.18, 0.03);       // scuff
  if (surf === 'wood' && Math.random() < 0.12) tone(g, t + 0.05, 0.22, rnd(300, 500), rnd(250, 420), 'triangle', 0.06, 0.05); // creak
  if (pace >= 2 && Math.random() < 0.45) gear(g, t + 0.02, 0.28);
}
function gear(g, t, v) { // equipment rattle: buckles, mags, sling
  noise(g, t, 0.06, 'bandpass', rnd(2500, 4000), 3, v * 0.5, 0.004);
  if (Math.random() < 0.5) ring(g, t + rnd(0.01, 0.04), rnd(2200, 3200), v * 0.12, 0.08);
}

export function shuffle(x, y, surf, own) {
  C = 'steps'; // turning on the spot
  const s = SURF[surf] || SURF.concrete;
  const g = out(own ? undefined : x, own ? undefined : y, 0.14 * s.v, 180, 0.1); if (!g) return;
  const t = ac.currentTime;
  noise(g, t, 0.12, 'bandpass', s.f * 0.8, 0.7, 0.6, 0.03);
  noise(g, t + 0.02, 0.16, 'bandpass', 1800, 1.2, 0.25, 0.04); // cloth
}

// --- foley: small sounds for nearly everything a player does ---
export function foley(kind, x, y, own) {
  C = kind === 'heartbeat' || kind === 'breath' || kind === 'hurt' ? 'body' : ['hammer', 'nail', 'beep', 'tick', 'place', 'throw', 'bounce', 'camSwitch', 'spot', 'droneThrow'].includes(kind) ? 'gadgets' : 'foley';
  const fx = own ? undefined : x, fy = own ? undefined : y;
  let g; const t = ac ? ac.currentTime : 0;
  switch (kind) {
    case 'cloth': g = out(fx, fy, 0.16, 200, 0.05); if (g) noise(g, t, 0.18, 'bandpass', rnd(1400, 2400), 0.9, 0.7, 0.05); break;
    case 'adsIn': g = out(fx, fy, 0.55, 220, 0.05); if (g) { noise(g, t, 0.12, 'bandpass', 1800, 1, 0.5, 0.03); click(g, t + 0.09, 2600, 0.35); } break;
    case 'adsOut': g = out(fx, fy, 0.4, 200, 0.05); if (g) noise(g, t, 0.1, 'bandpass', 1500, 1, 0.5, 0.02); break;
    case 'crouch': g = out(fx, fy, 0.17, 260, 0.08); if (g) { noise(g, t, 0.2, 'bandpass', 1200, 0.8, 0.6, 0.04); tone(g, t + 0.12, 0.08, 120, 70, 'sine', 0.5); gear(g, t + 0.1, 0.4); } break;
    case 'stand': g = out(fx, fy, 0.15, 260, 0.08); if (g) { noise(g, t, 0.22, 'bandpass', 1600, 0.8, 0.6, 0.06); gear(g, t + 0.15, 0.35); } break;
    case 'draw': g = out(fx, fy, 0.4, 320, 0.1); if (g) { noise(g, t, 0.15, 'bandpass', 900, 1, 0.5, 0.02); noise(g, t + 0.12, 0.09, 'bandpass', 3000, 1.5, 0.5, 0.03, 5000); click(g, t + 0.28, 2800, 0.6); ring(g, t + 0.28, 2400, 0.08, 0.1); } break;
    case 'magOut': g = out(fx, fy, 0.45, 380, 0.12); if (g) { click(g, t, 3000, 0.7); noise(g, t + 0.03, 0.12, 'bandpass', 1800, 1.4, 0.45, 0.02, 1200); } break;
    case 'magIn': g = out(fx, fy, 0.55, 420, 0.12); if (g) { noise(g, t, 0.05, 'bandpass', 1400, 1.2, 0.5, 0.005); click(g, t + 0.05, 2200, 0.9, 0.02); tone(g, t + 0.05, 0.05, 180, 110, 'sine', 0.4); } break;
    case 'bolt': g = out(fx, fy, 0.5, 420, 0.12); if (g) { noise(g, t, 0.06, 'bandpass', 2600, 2, 0.6, 0.003, 1800); click(g, t + 0.11, 3200, 0.9, 0.02); ring(g, t + 0.11, 2900, 0.1, 0.12); } break;
    case 'shell': g = out(fx, fy, 0.35, 320, 0.1); if (g) { click(g, t, 1800, 0.6, 0.02); noise(g, t + 0.02, 0.06, 'bandpass', 900, 1.5, 0.3); } break;
    case 'magDrop': g = out(fx, fy, 0.3, 300, 0.1); if (g) { tone(g, t, 0.06, 220, 150, 'triangle', 0.5); click(g, t, 1500, 0.4, 0.03); click(g, t + 0.09, 1200, 0.2, 0.02); } break;
    case 'empty': g = out(fx, fy, 0.35, 260, 0.05); if (g) { click(g, t, 1700, 0.8, 0.012); tone(g, t, 0.04, 260, 200, 'sine', 0.3); } break;
    case 'melee': g = out(fx, fy, 0.6, 450, 0.15); if (g) { noise(g, t, 0.16, 'bandpass', 600, 0.6, 0.6, 0.06, 1800); noise(g, t + 0.13, 0.1, 'lowpass', 700, 0.8, 0.9); tone(g, t + 0.13, 0.09, 140, 60, 'sine', 0.8); } break;
    case 'gadget': g = out(fx, fy, 0.3, 260, 0.08); if (g) { noise(g, t, 0.1, 'bandpass', 1300, 1, 0.5, 0.02); click(g, t + 0.1, 2400, 0.5); } break;
    case 'place': g = out(fx, fy, 1.1, 380, 0.12); if (g) { noise(g, t, 0.07, 'bandpass', 900, 1.3, 0.5); click(g, t + 0.06, 2000, 0.7, 0.02); tone(g, t + 0.18, 0.06, 1800, 1800, 'square', 0.06); } break;
    case 'throw': g = out(fx, fy, 0.35, 360, 0.1); if (g) { click(g, t, 4000, 0.5); noise(g, t + 0.05, 0.22, 'bandpass', 800, 0.6, 0.6, 0.08, 2000); } break;
    case 'bounce': g = out(fx, fy, 0.3, 450, 0.15); if (g) { tone(g, t, 0.05, rnd(900, 1300), 600, 'triangle', 0.5); click(g, t, 1800, 0.4); } break;
    case 'pin': g = out(fx, fy, 0.3, 260, 0.05); if (g) { ring(g, t, 1500, 0.14, 0.15); click(g, t + 0.08, 2000, 0.3); } break;
    case 'camSwitch': g = out(undefined, undefined, 0.22); if (g) { tone(g, t, 0.07, 160, 100, 'sine', 0.5); noise(g, t + 0.01, 0.14, 'bandpass', 1400, 0.6, 0.18, 0.01); } break;
    case 'droneThrow': g = out(fx, fy, 0.35, 400, 0.1); if (g) { noise(g, t, 0.1, 'bandpass', 1000, 1, 0.5); tone(g, t + 0.1, 0.06, 160, 110, 'sine', 0.5); click(g, t + 0.1, 1500, 0.5); } break;
    case 'spot': g = out(undefined, undefined, 0.25); if (g) { tone(g, t, 0.08, 440, 440, 'triangle', 0.3, 0.004); tone(g, t + 0.08, 0.12, 587, 587, 'triangle', 0.25, 0.004); } break;
    case 'hammer': g = out(fx, fy, 0.75, 650, 0.25); if (g) { tone(g, t, 0.12, rnd(150, 190), 90, 'square', 0.25); ring(g, t, rnd(700, 900), 0.3, 0.35); noise(g, t, 0.08, 'bandpass', 1500, 1, 0.6); } break;
    case 'nail': g = out(fx, fy, 0.55, 520, 0.2); if (g) { tone(g, t, 0.07, rnd(220, 260), 160, 'triangle', 0.5); noise(g, t, 0.06, 'bandpass', 900, 1.5, 0.6); } break;
    case 'beep': g = out(fx, fy, 0.35, 700, 0.15); if (g) { tone(g, t, 0.08, 880, 880, 'triangle', 0.3, 0.003); tone(g, t, 0.08, 440, 440, 'sine', 0.2, 0.003); } break;
    case 'tick': g = out(fx, fy, 0.3, 500, 0.1); if (g) click(g, t, 1300, 0.7, 0.012); break;
    case 'revive': g = out(fx, fy, 0.3, 300, 0.1); if (g) { noise(g, t, 0.3, 'bandpass', 1400, 0.8, 0.5, 0.08); tone(g, t + 0.1, 0.3, 500, 800, 'sine', 0.15); } break;
    case 'heartbeat': g = out(undefined, undefined, 0.5); if (g) { tone(g, t, 0.12, 60, 40, 'sine', 1); tone(g, t + 0.16, 0.14, 55, 38, 'sine', 0.8); } break;
    case 'breath': g = out(undefined, undefined, 0.12); if (g) { noise(g, t, 0.55, 'bandpass', 750, 0.7, 0.6, 0.25); noise(g, t + 0.7, 0.6, 'bandpass', 600, 0.7, 0.45, 0.2); } break;
    case 'hurt': g = out(fx, fy, 0.5, 380, 0.1); if (g) { noise(g, t, 0.12, 'lowpass', 500, 0.8, 0.8); tone(g, t, 0.1, 110, 60, 'sine', 0.8); } break;
  }
}

// --- impacts by material ---
export function impact(mat, x, y) {
  C = 'impacts';
  const g = out(x, y, 0.4, 650, 0.2); if (!g) return;
  const t = ac.currentTime + rnd(0, 0.01);
  switch (mat) {
    case 'drywall': noise(g, t, 0.1, 'bandpass', 900, 0.8, 0.8); noise(g, t, 0.25, 'highpass', 3000, 0.5, 0.15, 0.02); break;
    case 'brick': noise(g, t, 0.08, 'bandpass', 1600, 1, 0.9); noise(g, t + 0.01, 0.3, 'highpass', 2500, 0.5, 0.25, 0.02); break;
    case 'concrete': noise(g, t, 0.07, 'bandpass', 2200, 1.2, 0.9); if (Math.random() < 0.3) ricochet(g, t + 0.02); break;
    case 'metal': click(g, t, 3000, 0.8, 0.02); ring(g, t, rnd(1200, 2400), 0.4, 0.5); if (Math.random() < 0.4) ricochet(g, t + 0.01); break;
    case 'wood': noise(g, t, 0.09, 'bandpass', 700, 1.4, 0.9); tone(g, t, 0.06, 260, 150, 'triangle', 0.4); break;
    case 'flesh': noise(g, t, 0.07, 'lowpass', 600, 0.8, 1); tone(g, t, 0.07, 120, 60, 'sine', 0.7); break;
    case 'glass': for (let i = 0; i < 5; i++) ring(g, t + i * rnd(0.02, 0.05), rnd(3000, 6000), 0.1, 0.12); noise(g, t, 0.2, 'highpass', 5000, 0.5, 0.3); break;
    case 'electronic': click(g, t, 3000, 0.6); noise(g, t, 0.25, 'bandpass', 5000, 1, 0.3, 0.005); tone(g, t, 0.15, 900, 150, 'square', 0.1); break;
    default: noise(g, t, 0.08, 'bandpass', 1200, 1, 0.8);
  }
}
function ricochet(g, t) { tone(g, t, rnd(0.15, 0.3), rnd(2500, 4500), rnd(900, 1500), 'sine', 0.18, 0.004); }

export function casing(x, y, surf, shotgun) {
  C = 'impacts';
  const g = out(x, y, 0.09, 300, 0.08); if (!g) return;
  const soft = surf === 'carpet' || surf === 'grass';
  const t = ac.currentTime + rnd(0.25, 0.45);
  for (let i = 0; i < (soft ? 1 : 3); i++) {
    const tt = t + i * rnd(0.06, 0.11), v = 0.5 / (i + 1);
    if (soft) noise(g, tt, 0.04, 'bandpass', 900, 1, v * 0.6);
    else if (shotgun) { tone(g, tt, 0.04, rnd(500, 700), 400, 'triangle', v * 0.6); click(g, tt, 1500, v * 0.5); }
    else ring(g, tt, rnd(2300, 3400), v * 0.22, 0.08);
  }
}

export function whiz(x, y) {
  C = 'impacts'; // a bullet passing close to you
  const g = out(x, y, 1.3, 200, 0.05); if (!g) return;
  const t = ac.currentTime;
  noise(g, t, 0.012, 'highpass', 4000, 0.7, 1, 0.0005);           // supersonic crack
  noise(g, t, 0.14, 'bandpass', rnd(2000, 3500), 3, 0.5, 0.01, 900); // whizz
}

export function debris(x, y, amount = 1) {
  C = 'impacts';
  const g = out(x, y, 0.3 * amount, 600, 0.2); if (!g) return;
  const t = ac.currentTime;
  for (let i = 0; i < 6 * amount; i++) { const tt = t + rnd(0.02, 0.7); click(g, tt, rnd(1200, 3500), rnd(0.1, 0.35), 0.015); }
  noise(g, t, 0.5, 'bandpass', 700, 0.5, 0.4, 0.01);
}

// --- guns and explosions ---
// Realistic gunshots: each weapon gets a few pre-built recordings, synthesised sample by sample:
// supersonic crack + saturated muzzle blast + body + low boom + early reflections + action click.
const GUN = {
  AR:      { crack: 0.9, blastTau: 0.010, blastLP: 5200, body: 900,  bodyTau: 0.045, boom: 68, boomTau: 0.070, drive: 2.6, mech: 0.035, v: 0.95 },
  SMG:     { crack: 0.6, blastTau: 0.007, blastLP: 6000, body: 1200, bodyTau: 0.030, boom: 85, boomTau: 0.050, drive: 2.2, mech: 0.028, v: 0.8 },
  MP:      { crack: 0.5, blastTau: 0.006, blastLP: 6500, body: 1400, bodyTau: 0.025, boom: 95, boomTau: 0.040, drive: 2.0, mech: 0.024, v: 0.7 },
  LMG:     { crack: 1.0, blastTau: 0.012, blastLP: 4800, body: 800,  bodyTau: 0.055, boom: 60, boomTau: 0.085, drive: 2.8, mech: 0.040, v: 1.0 },
  DMR:     { crack: 1.0, blastTau: 0.016, blastLP: 4500, body: 700,  bodyTau: 0.070, boom: 52, boomTau: 0.110, drive: 3.0, mech: 0.060, v: 1.15 },
  Shotgun: { crack: 0.3, blastTau: 0.022, blastLP: 3600, body: 500,  bodyTau: 0.090, boom: 48, boomTau: 0.130, drive: 3.2, mech: 0.0,   v: 1.25 },
  Pistol:  { crack: 0.5, blastTau: 0.008, blastLP: 5500, body: 1100, bodyTau: 0.035, boom: 80, boomTau: 0.060, drive: 2.3, mech: 0.030, v: 0.8 },
};
const gunBufs = {};
function buildGun(cls, seed) {
  const P = GUN[cls], sr = ac.sampleRate, N = Math.floor(sr * 0.45);
  const buf = ac.createBuffer(2, N, sr), L = buf.getChannelData(0), R = buf.getChannelData(1);
  let r = seed * 9301 + 49297; const rand = () => { r = (r * 9301 + 49297) % 233280; return r / 233280 * 2 - 1; };
  const svf = (fc, q) => { let lo = 0, bd = 0; const k = 2 * Math.sin(Math.PI * Math.min(fc, sr / 6) / sr); return x => { lo += k * bd; const hi = x - lo - q * bd; bd += k * hi; return bd; }; };
  const bodyF = svf(P.body * (0.9 + 0.2 * Math.abs(rand())), 0.9), body2 = svf(P.body * 2.3, 1.4);
  let blastLo = 0; const ba = 1 - Math.exp(-2 * Math.PI * P.blastLP / sr);
  let phase = 0; const mono = new Float32Array(N);
  const crackLen = 0.0012 + 0.0006 * Math.abs(rand());
  for (let i = 0; i < N; i++) {
    const t = i / sr, n = rand();
    let v = 0;
    if (t < crackLen) v += P.crack * (t < crackLen / 2 ? 1 : -1) * (1 - t / crackLen);       // N-wave crack
    blastLo += ba * (n - blastLo); v += blastLo * 2.2 * Math.exp(-t / P.blastTau);               // muzzle blast
    v += bodyF(n) * 1.6 * Math.exp(-t / P.bodyTau) + body2(n) * 0.5 * Math.exp(-t / (P.bodyTau * 0.5));
    const f = P.boom * (1 + 2.5 * Math.exp(-t / 0.008)); phase += 2 * Math.PI * f / sr;
    v += Math.sin(phase) * 0.9 * Math.exp(-t / P.boomTau) * (1 - Math.exp(-t / 0.0015));    // low boom
    if (P.mech && t > P.mech && t < P.mech + 0.004) v += n * 0.12 * (1 - (t - P.mech) / 0.004); // bolt cycling
    mono[i] = Math.tanh(v * P.drive) / Math.tanh(P.drive);
  }
  // early reflections (walls nearby) — slightly different per ear for width
  const refl = [[0.0071, 0.32, 0.24], [0.0118, 0.22, 0.28], [0.0193, 0.18, 0.12], [0.0287, 0.11, 0.14], [0.041, 0.07, 0.06]];
  let peak = 0;
  for (let i = 0; i < N; i++) {
    let l = mono[i], rr = mono[i];
    for (const [d, gl, gr] of refl) { const j = i - Math.floor(d * sr); if (j > 0) { l += mono[j] * gl; rr += mono[j] * gr; } }
    L[i] = l; R[i] = rr; peak = Math.max(peak, Math.abs(l), Math.abs(rr));
  }
  for (let i = 0; i < N; i++) { L[i] *= 0.9 / peak; R[i] *= 0.9 / peak; }
  return buf;
}
function gunBuf(cls) {
  if (!GUN[cls]) cls = 'AR';
  if (!gunBufs[cls]) gunBufs[cls] = [1, 2, 3, 4].map(sd => buildGun(cls, sd + cls.length * 7));
  const list = gunBufs[cls]; return list[Math.floor(Math.random() * list.length)];
}
export function gunshot(cls, x, y, own) {
  C = 'guns';
  const P = GUN[cls] || GUN.AR;
  const g = out(own ? undefined : x, own ? undefined : y, P.v * (own ? 1.2 : 1), 1100, own ? 0.3 : 0.4); if (!g) return;
  const src = ac.createBufferSource(); src.buffer = gunBuf(cls); src.playbackRate.value = 0.96 + Math.random() * 0.08;
  src.connect(g); src.start();
  if (x !== undefined && !own) { // far away: the crack fades and the boom rolls on
    const d = Math.hypot(x - listener.x, y - listener.y);
    if (d > 500) { const t = ac.currentTime; tone(g, t + d / 3400, 0.5, P.boom * 0.8, P.boom * 0.5, 'sine', 0.25, 0.02); }
  }
}
export function prewarmGuns() { if (ac) for (const c of Object.keys(GUN)) gunBuf(c); }

export function explosion(x, y, kind) {
  C = 'explosions';
  const big = kind === 'frag' || kind === 'nitro' || kind === 'cutter';
  const g = out(x, y, big ? 1.5 : 1.05, 2000, 0.6); if (!g) return;
  const t = ac.currentTime;
  if (kind === 'stun') { noise(g, t, 0.05, 'highpass', 3000, 0.7, 1); noise(g, t, 0.8, 'highpass', 6000, 0.5, 0.4, 0.002); tone(g, t, 0.3, 90, 40, 'sine', 0.6); return; }
  if (kind === 'emp') { tone(g, t, 0.6, 120, 40, 'sawtooth', 0.35); noise(g, t, 0.5, 'bandpass', 4000, 2, 0.4, 0.01); for (let i = 0; i < 8; i++) click(g, t + rnd(0, 0.5), rnd(3000, 6000), 0.3); return; }
  if (kind === 'cutter') { noise(g, t, 1.8, 'bandpass', 2600, 0.4, 0.5, 0.3); }
  noise(g, t, 0.05, 'highpass', 2000, 0.6, 1);
  noise(g, t, big ? 1.8 : 1.1, 'lowpass', 900, 0.4, 1, 0.004, 120);
  tone(g, t, 0.8, 85, 22, 'sine', 1.3);
  debris(x, y, big ? 2 : 1); C = 'explosions';
}

export function play(name, x, y) {
  C = 'gadgets'; // simple named sounds from the server
  if (!ac) return;
  switch (name) {
    case 'reload': return; // handled by the reload phases in foley
    case 'swap': return;
    case 'empty': return foley('empty', x, y);
    case 'break': return impact('electronic', x, y);
    case 'barricade': for (let i = 0; i < 3; i++) setTimeout(() => foley('nail', x, y), i * 150); return;
    case 'reinforce': { const g = out(x, y, 0.9, 700, 0.3); if (!g) return; const t = ac.currentTime; tone(g, t, 0.45, 240, 130, 'sawtooth', 0.12); noise(g, t + 0.38, 0.35, 'lowpass', 400, 0.8, 0.9); tone(g, t + 0.38, 0.3, 75, 45, 'square', 0.3); ring(g, t + 0.4, 520, 0.3, 0.8); return; }
    case 'panel': { const g = out(x, y, 0.9, 700, 0.3); if (!g) return; const t = ac.currentTime; tone(g, t, 0.3, 140, 90, 'square', 0.25); ring(g, t + 0.05, 380, 0.4, 0.9); return; }
    case 'place': return foley('place', x, y);
    case 'throw': return foley('throw', x, y);
    case 'bounce': return foley('bounce', x, y);
    case 'smoke': { const g = out(x, y, 0.7, 800, 0.2); if (g) noise(g, ac.currentTime, 2.2, 'highpass', 1800, 0.4, 0.8, 0.04, 900); return; }
    case 'dart': { const g = out(x, y, 0.5, 600, 0.15); if (!g) return; const t = ac.currentTime; noise(g, t, 0.06, 'bandpass', 2800, 1, 0.8); click(g, t + 0.15, 3000, 0.5); return; }
    case 'launcher': { const g = out(x, y, 1, 1200, 0.4); if (!g) return; const t = ac.currentTime; tone(g, t, 0.15, 170, 60, 'sine', 1); noise(g, t, 0.18, 'lowpass', 900, 0.8, 0.8); return; }
    case 'plantStart': return foley('beep', x, y);
    case 'planted': { const g = out(undefined, undefined, 0.5); if (!g) return; const t = ac.currentTime; for (let i = 0; i < 3; i++) tone(g, t + i * 0.2, 0.18, 330 + i * 110, 330 + i * 110, 'triangle', 0.3, 0.005); return; }
    case 'revive': return foley('revive', x, y);
  }
}

export function getAudio() { return ac && ac.state !== 'closed' && !ac.offline ? { ac, master } : null; }

// Menu and HUD sounds: low, soft and warm — no shrill beeps.
export function ui(kind = 'click') {
  C = 'ui';
  const g = out(undefined, undefined, 0.22, 0, 0.12); if (!g) return;
  const t = ac.currentTime;
  const thock = (f0, f1, v, dur = 0.09) => { tone(g, t, dur, f0, f1, 'sine', v); noise(g, t, 0.03, 'lowpass', 900, 0.7, v * 0.35, 0.002); };
  switch (kind) {
    case 'hover': tone(g, t, 0.05, 210, 180, 'sine', 0.083, 0.006); break;                           // barely-there thup
    case 'click': thock(170, 95, 0.24); tone(g, t + 0.005, 0.08, 420, 380, 'triangle', 0.035); break; // soft wooden thock
    case 'back': thock(130, 80, 0.2); break;
    case 'open': noise(g, t, 0.3, 'lowpass', 300, 0.8, 0.022, 0.12, 1400); tone(g, t + 0.05, 0.25, 110, 150, 'sine', 0.016, 0.08); break; // low whoosh up
    case 'close': noise(g, t, 0.25, 'lowpass', 1300, 0.8, 0.12, 0.03, 250); break;
    case 'lock': // operator locked in: deep thunk + warm low chord
      tone(g, t, 0.18, 120, 48, 'sine', 0.26); noise(g, t, 0.06, 'lowpass', 700, 0.7, 0.11);
      for (const [i, fq] of [[0, 220], [1, 277], [2, 330]]) tone(g, t + 0.04 + i * 0.04, 0.7, fq, fq, 'triangle', 0.026, 0.03);
      break;
    case 'count': tone(g, t, 0.18, 330, 330, 'sine', 0.145, 0.004); tone(g, t, 0.18, 165, 165, 'sine', 0.08, 0.004); break;
    case 'go': tone(g, t, 0.6, 110, 55, 'sine', 0.1); tone(g, t, 0.45, 220, 220, 'triangle', 0.02, 0.01); noise(g, t, 0.4, 'lowpass', 500, 0.6, 0.05, 0.005); break;
    case 'xp': tone(g, t, 0.06, 360 + Math.random() * 40, 340, 'sine', 0.12, 0.003); break;
    case 'level': for (const [i, fq] of [[0, 196], [1, 247], [2, 294], [3, 392]]) tone(g, t + i * 0.1, 0.9, fq, fq, 'triangle', 0.038, 0.02); break;
    case 'victory': for (const [i, fq] of [[0, 147], [0, 220], [1, 175], [1, 262], [2, 220], [2, 330]]) tone(g, t + i * 0.22, 1.5, fq, fq, 'sawtooth', 0.009, 0.03); tone(g, t, 1.4, 73, 73, 'sine', 0.075); break;
    case 'defeat': for (const [i, fq] of [[0, 147], [0, 175], [1, 139], [1, 165]]) tone(g, t + i * 0.35, 1.7, fq, fq * 0.98, 'sawtooth', 0.008, 0.04); tone(g, t, 1.5, 55, 50, 'sine', 0.075); break;
    case 'round': tone(g, t, 0.7, 110, 110, 'sawtooth', 0.025, 0.05); tone(g, t, 0.7, 165, 165, 'sawtooth', 0.02, 0.05); noise(g, t, 0.6, 'lowpass', 350, 0.5, 0.06, 0.1); break;
    case 'chat': tone(g, t, 0.08, 330, 300, 'sine', 0.16, 0.004); tone(g, t + 0.06, 0.1, 440, 420, 'sine', 0.1, 0.004); break;
    case 'headshot': tone(g, t, 0.09, 620, 600, 'triangle', 0.45, 0.002); tone(g, t, 0.12, 95, 60, 'sine', 0.5); noise(g, t, 0.04, 'lowpass', 1500, 0.8, 0.3); break;
    case 'hit': tone(g, t, 0.05, 900, 800, 'triangle', 0.52, 0.002); noise(g, t, 0.02, 'bandpass', 1200, 1, 0.3); break;     // dull "tok"
    case 'kill': tone(g, t, 0.07, 700, 680, 'triangle', 0.4, 0.002); tone(g, t + 0.07, 0.12, 520, 500, 'triangle', 0.4, 0.002); break;
    default: thock(160, 95, 0.18);
  }
}

// Continuous drone motor whine, keyed by drone id.
// Drone motor: a soft electric whirr plus gentle tyre rumble, only while it moves.
export function droneLoop(id, x, y, speed, own) {
  if (!ac || ac.state !== 'running') return;
  let L = loops.get(id);
  if (!L) {
    const n = ac.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
    const whirr = ac.createBiquadFilter(); whirr.type = 'bandpass'; whirr.frequency.value = 700; whirr.Q.value = 1.2;
    const rumble = ac.createBiquadFilter(); rumble.type = 'lowpass'; rumble.frequency.value = 220;
    const hum = ac.createOscillator(); hum.type = 'sine'; hum.frequency.value = 110;
    const humG = ac.createGain(); humG.gain.value = 0.25;
    const mix = ac.createGain(); mix.gain.value = 0;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1600;
    const p = ac.createStereoPanner();
    n.connect(whirr); n.connect(rumble); whirr.connect(mix); rumble.connect(mix); hum.connect(humG); humG.connect(mix);
    mix.connect(lp); lp.connect(p); p.connect(sfx);
    n.start(); hum.start();
    L = { n, hum, mix, p, whirr, lp, seen: 0 }; loops.set(id, L);
  }
  const d = own ? 0 : Math.hypot(x - listener.x, y - listener.y);
  const move = Math.min(1, speed / 160);
  const k = Math.max(0, 1 - d / 280) ** 1.6 * move * Math.pow(0.45, d > 20 ? occlude(x, y) : 0);
  const t = ac.currentTime;
  L.mix.gain.setTargetAtTime((own ? 0.012 : 0.02) * k * (MIX.loops ?? 1), t, 0.12);
  L.whirr.frequency.setTargetAtTime(500 + move * 450, t, 0.2);
  L.hum.frequency.setTargetAtTime(95 + move * 40, t, 0.2);
  L.p.pan.setTargetAtTime(own ? 0 : Math.max(-0.9, Math.min(0.9, (x - listener.x) / 260)), t, 0.05);
  L.seen = t;
}
export function pruneLoops() {
  if (!ac) return;
  for (const [id, L] of loops) if (ac.currentTime - L.seen > 0.3) { try { L.n.stop(); L.hum.stop(); } catch {} L.mix.disconnect(); loops.delete(id); }
}

// ---- measuring the mix ----
// Renders each sound offline (silently) and reports its loudness, so levels can be balanced by numbers.
export async function measureMix(tests) {
  const saved = { ac, master, sfx, verb, verbIn, noiseBuf, listener, occlude, indoorAt, C };
  const res = [];
  for (const [name, fn] of tests) {
    const off = new OfflineAudioContext(2, 48000 * 2, 48000); off.offline = true;
    buildGraph(off); listener = { x: 0, y: 0 }; occlude = () => 0; indoorAt = () => true;
    fn(module);
    const buf = await off.startRendering();
    const L = buf.getChannelData(0), R = buf.getChannelData(1), win = 2400; // 50 ms windows
    let peak = 0, loud = 0, acc = 0;
    for (let i = 0; i < L.length; i++) {
      const v = (L[i] * L[i] + R[i] * R[i]) / 2; acc += v; peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
      if (i >= win) { const o = (L[i - win] ** 2 + R[i - win] ** 2) / 2; acc -= o; }
      loud = Math.max(loud, acc / win);
    }
    res.push({ name, loudDb: Math.round(10 * Math.log10(loud + 1e-12) * 10) / 10, peakDb: Math.round(20 * Math.log10(peak + 1e-12) * 10) / 10 });
  }
  ({ ac, master, sfx, verb, verbIn, noiseBuf, listener, occlude, indoorAt, C } = saved);
  return res;
}
const module = { gunshot: (...a) => gunshot(...a), explosion: (...a) => explosion(...a), step: (...a) => step(...a), shuffle: (...a) => shuffle(...a),
  foley: (...a) => foley(...a), impact: (...a) => impact(...a), casing: (...a) => casing(...a), whiz: (...a) => whiz(...a), debris: (...a) => debris(...a),
  play: (...a) => play(...a), ui: (...a) => ui(...a) };

// Ears ringing after a flashbang: a high whine that fades with the flash.
export function tinnitus(dur) {
  if (!ac || ac.state !== 'running') return;
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.type = 'sine'; o.frequency.value = 3600 + Math.random() * 400;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05 * vol.sfx, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.5);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 1.6);
  // muffle everything else while deafened
  sfx.gain.cancelScheduledValues(t); sfx.gain.setValueAtTime(vol.sfx * 0.25, t); sfx.gain.linearRampToValueAtTime(vol.sfx, t + dur + 1);
}
