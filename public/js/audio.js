import { WEAPONS } from '/shared/operators.js';
// R62D sound engine. Everything is synthesised (no audio files).
// Each sound is positioned: distance fade, stereo pan, muffling through walls, and a room echo.
let ac = null, master = null, sfx = null, rest = null, verb = null, verbIn = null, noiseBuf = null;
let listener = { x: 0, y: 0 }, occlude = () => 0, indoorAt = () => true, localize = null;
// distance between a sound and the listener, measured in the shared building frame (floors stack)
const L = (x, y) => (localize ? localize(x, y) : { x, y });
const distTo = (x, y) => { const a = L(x, y), b = L(listener.x, listener.y); return { d: Math.hypot(a.x - b.x, a.y - b.y), dx: a.x - b.x }; };
let vol = { master: sliderGain(70), sfx: 1 };
// a volume slider (0–100) to gain: 0.5 dB a step, so the slider covers 50 dB and every step sounds the same size
export function sliderGain(v) { return v <= 0 ? 0 : Math.pow(10, (Math.min(100, v) - 100) * 0.5 / 20); }
const loops = new Map();

// ---- THE MIX: one volume per kind of sound (measured with measureMix, see docs/sound.md) ----
export const MIX = { guns: 0.95, explosions: 0.9, steps: 1.36, foley: 2.25, body: 0.4, impacts: 11.5, gadgets: 3.6, ui: 27, loops: 1.4 };
let C = 'foley'; // category of the sound currently being built

// Every recording the game uses, as a list of small jobs (the loading screen runs them before you play).
export function soundJobs() {
  if (!ac) return [];
  const jobs = [...Object.keys(GUN), ...Object.keys(GUN_OWN)].map(c => () => gunBuf(c));
  for (const s of Object.keys(SURF)) { for (const p of [2, 0, 3, 1]) jobs.push(() => stepBuf(s, p)); jobs.push(() => stepBuf(s, 0, true)); }
  return jobs;
}
export function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  buildGraph(new (window.AudioContext || window.webkitAudioContext)());
  setTimeout(prewarmGuns, 50); setTimeout(prewarmSteps, 400); // build the gunshot recordings once, right after sound starts
}

function buildGraph(context) {
  ac = context;
  // effects → gentle glue compressor → master volume → speakers. The volume comes after the compressor, so the mix
  // behaves the same at any volume, and it fades in when sound starts (opening the game never blasts anyone).
  master = ac.createGain(); master.gain.value = 0;
  if (ac.offline) master.gain.value = 1; // measureMix: a fixed level, so readings compare with docs/sound.md
  else { master.gain.setValueAtTime(0, ac.currentTime); master.gain.linearRampToValueAtTime(vol.master, ac.currentTime + 1.2); }
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -9; comp.knee.value = 6; comp.ratio.value = 4; comp.attack.value = 0.002; comp.release.value = 0.2;
  const pre = ac.createGain(); pre.gain.value = 0.6; // the level the mix was balanced at (docs/sound.md)
  pre.connect(comp); comp.connect(master); master.connect(ac.destination);
  sfx = ac.createGain(); sfx.gain.value = vol.sfx; sfx.connect(pre);
  // everything except gunshots and explosions goes through 'rest', which dips a little under a loud bang (duck)
  rest = ac.createGain(); rest.gain.value = 1; rest.connect(sfx);
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
export function setWorld(occFn, indoorFn, locFn) { occlude = occFn; indoorAt = indoorFn; localize = locFn || null; }
export function setVolume(m, s) {
  if (m !== undefined) vol.master = m; if (s !== undefined) vol.sfx = s;
  if (master) { const t = ac.currentTime; master.gain.cancelScheduledValues(t); master.gain.setTargetAtTime(vol.master, t, 0.03); sfx.gain.value = vol.sfx; }
}
// A loud sound masks the others a little, the way ears do, instead of drowning them: the rest of the mix dips by
// up to db (scaled by how loud the bang reached you) and comes back over a quarter of a second.
let duckUntil = 0, duckDepth = 0;
function duck(db, strength = 1) {
  if (!rest) return;
  const t = ac.currentTime, d = Math.min(db, db * strength);
  if (d < 0.5 || (t < duckUntil && d <= duckDepth)) return;
  const g = Math.pow(10, -d / 20);
  rest.gain.cancelScheduledValues(t); rest.gain.setValueAtTime(rest.gain.value, t);
  rest.gain.linearRampToValueAtTime(g, t + 0.012); rest.gain.setTargetAtTime(1, t + 0.08, 0.12);
  duckUntil = t + 0.08; duckDepth = d;
}
export const now = () => (ac ? ac.currentTime : 0);

// Build the output chain for one sound at (x, y). Returns null if inaudible.
function out(x, y, gain, range = 900, wet = 0.25) {
  if (!ac || (ac.state !== 'running' && !ac.offline)) return null;
  gain *= MIX[C] ?? 1;
  let pan = 0, walls = 0, d = 0;
  if (x !== undefined) {
    const dd = distTo(x, y); d = dd.d;
    gain *= Math.max(0, 1 - d / range) ** 1.7;
    if (gain < 0.003) return null;
    pan = Math.max(-0.9, Math.min(0.9, dd.dx / 260));
    walls = d > 20 ? occlude(x, y) : 0;
  }
  const g = ac.createGain(); g.gain.value = gain * Math.pow(0.55, walls);
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.value = walls === 0 ? 18000 - Math.min(12000, d * 10) : walls === 1 ? 1400 : 650;
  const p = ac.createStereoPanner(); p.pan.value = pan;
  g.connect(lp); lp.connect(p); p.connect(C === 'guns' || C === 'explosions' || !rest ? sfx : rest);
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
// Each footstep is a pre-built recording, synthesised sample by sample like the gunshots:
// the heel strikes, then the ball of the foot rolls down; each contact rings the floor's own
// resonances (hollow boards, hard tile, dull slab, raised metal panels), the sole scuffs a little,
// and loose surfaces (gravel, grass, glass, splinters) add hundreds of tiny crunch grains.
// surfaces: wood, tile, marble, carpet, concrete, grass, asphalt, metal, rubble, glass, splinters
// modes: [Hz, decay s, gain]; pulse: contact time of the sole (ms); slap: brightness of the sole hit
const SURF = {
  wood:     { modes: [[92, 0.085, 1], [186, 0.06, 0.7], [410, 0.035, 0.5], [870, 0.02, 0.32], [1650, 0.011, 0.18]], pulse: 2.2, slap: 2600, slapG: 0.45, scuff: 0.35, v: 0.9 },
  tile:     { modes: [[170, 0.018, 0.5], [2350, 0.011, 0.45], [3900, 0.007, 0.35]], pulse: 0.9, slap: 7500, slapG: 0.9, scuff: 0.5, squeak: 0.12, v: 1.02 },
  marble:   { modes: [[150, 0.02, 0.45], [2900, 0.018, 0.4], [4700, 0.012, 0.3]], pulse: 0.8, slap: 8500, slapG: 0.95, scuff: 0.45, squeak: 0.15, v: 1.17 },
  carpet:   { modes: [[105, 0.03, 0.7], [240, 0.015, 0.25]], pulse: 6, slap: 650, slapG: 0.5, scuff: 0.2, fuzz: 1, v: 0.66 },
  concrete: { modes: [[118, 0.024, 0.8], [310, 0.014, 0.4], [1250, 0.006, 0.2]], pulse: 1.8, slap: 3800, slapG: 0.7, scuff: 0.6, grit: 0.25, v: 0.84 },
  asphalt:  { modes: [[105, 0.022, 0.75], [290, 0.012, 0.35]], pulse: 2, slap: 3200, slapG: 0.6, scuff: 0.65, grit: 0.55, v: 0.93 },
  grass:    { modes: [[75, 0.028, 0.5]], pulse: 7, slap: 420, slapG: 0.35, scuff: 0, grass: 1, v: 0.69 },
  metal:    { modes: [[205, 0.13, 0.8], [520, 0.095, 0.6], [1270, 0.06, 0.4], [2880, 0.035, 0.22], [4400, 0.02, 0.12]], pulse: 1.4, slap: 4200, slapG: 0.55, scuff: 0.4, v: 0.79 },
  rubble:   { modes: [[115, 0.022, 0.7], [300, 0.012, 0.3]], pulse: 2, slap: 3000, slapG: 0.5, scuff: 0.3, gravel: 1, v: 1.32 },
  glass:    { modes: [[160, 0.018, 0.5], [2400, 0.01, 0.3]], pulse: 1, slap: 6000, slapG: 0.6, scuff: 0.3, gravel: 0.5, glass: 1, v: 1.01 },
  splinters:{ modes: [[95, 0.07, 0.9], [400, 0.03, 0.45], [880, 0.018, 0.3]], pulse: 2.2, slap: 2600, slapG: 0.45, scuff: 0.3, crack: 1, v: 0.72 },
};
// paces: 0 walk (Shift), 1 crouch, 2 run, 3 run (heavy)
const GAIT = [
  { heel: 0.55, toe: 0.45, gap: [0.1, 0.14], soft: 1.6, scuff: 0.6 },
  { heel: 0.38, toe: 0.4, gap: [0.13, 0.18], soft: 2.0, scuff: 0.9 },
  { heel: 1, toe: 0.6, gap: [0.03, 0.05], soft: 1, scuff: 1 },
  { heel: 1.15, toe: 0.55, gap: [0.025, 0.04], soft: 0.9, scuff: 1.1 },
];
function buildStep(surf, pace, seed, scuffOnly = false) {
  const S = SURF[surf], G = GAIT[pace], sr = ac.sampleRate, N = Math.floor(sr * 0.32);
  const buf = ac.createBuffer(1, N, sr), out = buf.getChannelData(0);
  let r = seed * 7919 + 104729; const rand = () => { r = (r * 16807) % 2147483647; return r / 2147483647; }; // 0..1
  const nz = () => rand() * 2 - 1;
  const ex = new Float32Array(N); // excitation: the sole hitting the floor
  const contacts = scuffOnly ? [] : [[0.004 + rand() * 0.004, G.heel], [0.004 + G.gap[0] + rand() * (G.gap[1] - G.gap[0]), G.toe * (0.8 + rand() * 0.4)]];
  for (const [t0, a] of contacts) {
    const w = Math.max(3, Math.floor(S.pulse * G.soft * (0.85 + rand() * 0.3) / 1000 * sr)), i0 = Math.floor(t0 * sr);
    for (let i = 0; i < w && i0 + i < N; i++) ex[i0 + i] += a * Math.sin(Math.PI * i / w);   // half-sine contact pulse
  }
  // floor resonances, slightly detuned every time
  const modes = S.modes.map(([f, tau, g]) => { const fr = f * (0.93 + rand() * 0.14), rr = Math.exp(-1 / (tau * sr)); return { c1: 2 * rr * Math.cos(2 * Math.PI * fr / sr), c2: -rr * rr, g: g * (1 - Math.exp(-2 * Math.PI * fr / sr)) * 6, y1: 0, y2: 0 }; });
  const slapA = 1 - Math.exp(-2 * Math.PI * S.slap / G.soft / sr);
  let slapLo = 0, slapEnv = 0, scuffLo = 0, scuffBp = 0, scuffLow = 0;
  // sole scuff: friction noise as the foot slides and rolls off
  const scT0 = scuffOnly ? 0.01 : contacts[0][0] + 0.01, scLen = scuffOnly ? 0.16 + rand() * 0.08 : 0.05 + rand() * 0.06;
  const scA = S.scuff * G.scuff * (scuffOnly ? 0.5 : 0.18) * (0.6 + rand() * 0.8);
  const scF = 2 * Math.sin(Math.PI * (900 + rand() * 1400) / sr);
  for (let i = 0; i < N; i++) {
    const t = i / sr, e = ex[i];
    let v = 0;
    for (const m of modes) { const y = m.c1 * m.y1 + m.c2 * m.y2 + e * m.g; m.y2 = m.y1; m.y1 = y; v += y; }
    // the sole slap itself: a burst of noise following the contact
    slapEnv = Math.max(slapEnv * Math.exp(-1 / (0.0035 * G.soft * sr)), Math.abs(e));
    slapLo += slapA * (nz() * slapEnv - slapLo); v += slapLo * S.slapG * 1.6;
    if (scA > 0 && t > scT0 && t < scT0 + scLen) {
      const k = (t - scT0) / scLen, env = Math.sin(Math.PI * k) ** 2;
      scuffLow += scF * scuffBp; const hi = nz() - scuffLow - 1.2 * scuffBp; scuffBp += scF * hi;
      v += scuffBp * env * scA;
    }
    out[i] = v;
  }
  // grains: tiny damped clicks — gravel crunch, grass blades, glass, wood splinters
  const grains = (count, t0, spread, fLo, fHi, tLo, tHi, amp) => {
    for (let n = 0; n < count; n++) {
      const t = t0 + spread * Math.pow(rand(), 1.6), f = fLo * Math.pow(fHi / fLo, rand()), tau = tLo + rand() * (tHi - tLo);
      const a = amp * -Math.log(1 - rand() * 0.98) * 0.35 * (rand() < 0.5 ? -1 : 1);
      const i0 = Math.floor(t * sr), len = Math.min(N - i0, Math.floor(tau * 5 * sr)), w = 2 * Math.PI * f / sr, ph = rand() * 6.28;
      for (let i = 0; i < len; i++) out[i0 + i] += a * Math.exp(-i / (tau * sr)) * Math.sin(w * i + ph);
    }
  };
  const press = (scuffOnly ? 0.5 : 1) * (pace >= 2 ? 1 : 0.6), c0 = scuffOnly ? 0.01 : contacts[0][0];
  if (S.gravel) { grains(Math.floor(140 * S.gravel * press), c0, 0.13, 700, 4500, 0.0008, 0.003, 0.5 * S.gravel); grains(Math.floor(40 * press), c0, 0.09, 250, 900, 0.002, 0.006, 0.35); }
  if (S.grit) grains(Math.floor(60 * S.grit * press), c0, 0.08, 2000, 7000, 0.0004, 0.0012, 0.18 * S.grit);
  if (S.grass) { grains(Math.floor(260 * press), c0, 0.17, 2500, 9000, 0.0003, 0.0009, 0.22); grains(Math.floor(30 * press), c0 + 0.01, 0.14, 900, 2500, 0.001, 0.003, 0.12); }
  if (S.glass) { grains(Math.floor(70 * press), c0, 0.1, 3000, 9000, 0.0006, 0.002, 0.6); grains(Math.floor(6 + 6 * rand()), c0, 0.12, 4500, 9500, 0.012, 0.04, 0.25); }
  if (S.crack) grains(Math.floor(5 + 6 * rand() * press), c0, 0.09, 1100, 3200, 0.002, 0.006, 0.9);
  if (S.fuzz) grains(Math.floor(90 * press), c0, 0.12, 3000, 7000, 0.0003, 0.0008, 0.05);
  if (S.squeak && !scuffOnly && rand() < S.squeak * (pace >= 2 ? 1.5 : 0.5)) { // rubber sole squeak on polished floors
    const t0 = contacts[1][0] + 0.01, len = 0.03 + rand() * 0.04, f0 = 1600 + rand() * 1600;
    let ph = 0; for (let i = 0; i < len * sr; i++) { const k = i / (len * sr); ph += 2 * Math.PI * f0 * (1 + 0.15 * k) / sr; out[Math.floor(t0 * sr) + i] += 0.08 * Math.sin(Math.PI * k) * (Math.sin(ph) + 0.3 * Math.sin(2 * ph)); }
  }
  // gentle fade-out, then level by loudness (loudest 50 ms), so every surface and pace starts equal before its own volume
  let peak = 0, acc = 0, loud = 0; const win = Math.floor(sr * 0.05);
  for (let i = 0; i < N; i++) {
    if (i > N - 2000) out[i] *= (N - i) / 2000;
    peak = Math.max(peak, Math.abs(out[i])); acc += out[i] * out[i]; if (i >= win) acc -= out[i - win] * out[i - win]; loud = Math.max(loud, acc);
  }
  const norm = Math.min(0.25 / Math.sqrt(loud / win || 1e-9), 0.98 / (peak || 1)); for (let i = 0; i < N; i++) out[i] *= norm;
  return buf;
}
const stepBufs = new Map(); // `${surf}:${pace}` -> [recordings]
function stepBuf(surf, pace, scuff = false) {
  const key = `${surf}:${scuff ? 's' : pace}:${ac.sampleRate}`;
  let list = stepBufs.get(key), last = list && list.last;
  if (!list) { list = [1, 2, 3, 4, 5, 6].map(sd => buildStep(surf, pace, sd * 31 + surf.length * 7 + pace * 101 + (scuff ? 5000 : 0), scuff)); stepBufs.set(key, list); }
  let i; do i = Math.floor(Math.random() * list.length); while (i === last && list.length > 1); // never the same recording twice in a row
  list.last = i; return list[i];
}
// build the common footstep recordings a few at a time, so nothing stutters when someone first walks on a surface
export function prewarmSteps() {
  if (!ac) return;
  const jobs = [];
  for (const s of Object.keys(SURF)) for (const p of [2, 0, 3, 1]) jobs.push([s, p]);
  const next = () => { const j = jobs.shift(); if (!j) return; stepBuf(j[0], j[1]); setTimeout(next, 30); };
  next();
}
function playBuf(g, buf, rate) { const src = ac.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate; src.connect(g); src.start(ac.currentTime + rnd(0, 0.004)); }

export function step(x, y, surf, pace, own) {
  C = 'steps';
  if (pace <= 1 && !own) return; // silent movement, like CS2
  const s = SURF[surf] || SURF.concrete; if (!SURF[surf]) surf = 'concrete';
  const loud = [0.16, 0.22, 0.92, 1][pace] * s.v;
  const range = [160, 220, 580, 620][pace];
  const g = out(own ? undefined : x, own ? undefined : y, loud * (own ? 0.42 : 1), range, 0.12); if (!g) return;
  playBuf(g, stepBuf(surf, pace), 0.96 + Math.random() * 0.08);
  if (pace >= 2 && Math.random() < 0.45) gear(g, ac.currentTime + 0.02, 0.28);
}
function gear(g, t, v) { // equipment: vest fabric and a soft knock of mags/buckles
  noise(g, t, 0.09, 'bandpass', rnd(1800, 3200), 0.8, v * 0.35, 0.02);
  if (Math.random() < 0.35) ring(g, t + rnd(0.01, 0.04), rnd(1800, 2600), v * 0.06, 0.05);
}

export function shuffle(x, y, surf, own) {
  C = 'steps'; // turning on the spot
  if (!SURF[surf]) surf = 'concrete';
  const g = out(own ? undefined : x, own ? undefined : y, 0.06 * SURF[surf].v, 180, 0.1); if (!g) return;
  playBuf(g, stepBuf(surf, 0, true), 0.95 + Math.random() * 0.1);
  noise(g, ac.currentTime + 0.02, 0.16, 'bandpass', 1800, 1.2, 0.12, 0.04); // cloth
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
// guns that sound different from the rest of their class: the class's recipe with these changes
const GUN_OWN = {
  rook:    { crack: 1.0, boom: 58, boomTau: 0.09, drive: 2.9, v: 1.05 },
  sabre:   { body: 1050, boom: 76, v: 0.9 },
  trident: { body: 980, mech: 0.03 },
  wasp:    { body: 1450, bodyTau: 0.022, boom: 100, v: 0.72 },
  lark:    { crack: 0.8, body: 1300, boom: 90, v: 0.78 },
  tusk:    { mech: 0.03, boomTau: 0.1, v: 1.1 },
  anvil:   { crack: 0.8, boom: 44, boomTau: 0.16, v: 1.3 },
  stub:    { blastTau: 0.03, boom: 42, v: 1.3 },
  ox:      { boom: 54, drive: 3.0, v: 1.05 },
  drummer: { body: 950, boom: 70, v: 0.9 },
  pike:    { crack: 1.1, blastTau: 0.02, boom: 45, boomTau: 0.14, drive: 3.2, mech: 0, v: 1.25 },
  heron:   { boom: 60, v: 1.05 },
  gnat:    { body: 1600, bodyTau: 0.02, boom: 105, v: 0.62 },
  bison:   { crack: 0.7, blastTau: 0.014, boom: 62, boomTau: 0.09, drive: 2.8, mech: 0, v: 1.05 },
};
// a weapon id (or a class name) to its sound recipe
const gunRecipe = key => WEAPONS[key] ? { ...(GUN[WEAPONS[key].cls] || GUN.AR), ...(GUN_OWN[key] || {}) } : GUN[key] || GUN.AR;
const gunBufs = {};
function buildGun(key, seed) {
  const P = gunRecipe(key), sr = ac.sampleRate, N = Math.floor(sr * 0.45);
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
function gunBuf(key) {
  if (!GUN[key] && !GUN_OWN[key]) key = WEAPONS[key] ? WEAPONS[key].cls : 'AR'; // sounds like its class
  if (!gunBufs[key]) gunBufs[key] = [1, 2, 3, 4].map(sd => buildGun(key, sd + key.length * 7));
  const list = gunBufs[key]; return list[Math.floor(Math.random() * list.length)];
}
export function gunshot(cls, x, y, own, quiet = false) { // cls: a weapon id (or a class name)
  C = 'guns';
  const P = gunRecipe(cls);
  // suppressed: a muffled thump that carries much less far (the action still clacks)
  const g = out(own ? undefined : x, own ? undefined : y, P.v * (own ? 1.2 : 1) * (quiet ? 0.32 : 1), quiet ? 420 : 1100, own ? 0.3 : quiet ? 0.2 : 0.4); if (!g) return;
  const src = ac.createBufferSource(); src.buffer = gunBuf(cls); src.playbackRate.value = (quiet ? 0.8 : 0.96) + Math.random() * 0.08;
  if (!quiet) { // takes the ear-piercing edge off the crack, keeps the body
    const sh = ac.createBiquadFilter(); sh.type = 'highshelf'; sh.frequency.value = 3800; sh.gain.value = -5;
    sh.connect(g); src.connect(sh); src.start();
    duck(own ? 3 : 3.5, own ? 1 : Math.min(1, g.gain.value / (P.v * MIX.guns * 0.5)));
  }
  if (quiet) { const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500; src.connect(lp); lp.connect(g); click(g, ac.currentTime + 0.012, 2600, 0.5); }
  if (quiet) { src.start(); return; }
  if (x !== undefined && !own) { // far away: the crack fades and the boom rolls on
    const d = distTo(x, y).d;
    if (d > 500) { const t = ac.currentTime; tone(g, t + d / 3400, 0.5, P.boom * 0.8, P.boom * 0.5, 'sine', 0.25, 0.02); }
  }
}
// built one gun type at a time, so a slow computer doesn't freeze while sound starts
export function prewarmGuns() { if (!ac) return; const todo = [...Object.keys(GUN), ...Object.keys(GUN_OWN)]; const next = () => { const c = todo.shift(); if (!c) return; gunBuf(c); setTimeout(next, 40); }; next(); }

export function explosion(x, y, kind) {
  C = 'explosions';
  const big = kind === 'frag' || kind === 'nitro' || kind === 'cutter';
  const g = out(x, y, big ? 1.5 : 1.05, 2000, 0.6); if (!g) return;
  const t = ac.currentTime;
  duck(big ? 7 : 5, Math.min(1, g.gain.value / (MIX.explosions * 0.6)));
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
    case 'beep': return foley('beep', x, y);
    case 'ghost': return foley('cloth', x, y);
    case 'vault': { foley('cloth', x, y); const g = out(x, y, 0.35, 380, 0.12); if (!g) return; const t = ac.currentTime; noise(g, t + 0.05, 0.14, 'lowpass', 600, 0.9, 0.6); noise(g, t + 0.45, 0.12, 'lowpass', 500, 1, 0.5); return; } // a hand on the ledge, then the landing
    case 'clamp': impact('metal', x, y); return foley('hurt', x, y);
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
  if (!ac || (ac.state !== 'running' && !ac.offline)) return;
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
  const d = own ? 0 : distTo(x, y).d;
  const move = Math.min(1, speed / 160);
  const k = Math.max(0, 1 - d / 280) ** 1.6 * move * Math.pow(0.45, d > 20 ? occlude(x, y) : 0);
  const t = ac.currentTime;
  L.mix.gain.setTargetAtTime((own ? 0.095 : 0.13) * k * (MIX.loops ?? 1), t, 0.12); // measured: own ≈ -34 dB like your own footsteps
  L.whirr.frequency.setTargetAtTime(500 + move * 450, t, 0.2);
  L.hum.frequency.setTargetAtTime(95 + move * 40, t, 0.2);
  L.p.pan.setTargetAtTime(own ? 0 : Math.max(-0.9, Math.min(0.9, distTo(x, y).dx / 260)), t, 0.05);
  L.seen = t;
}
export function pruneLoops() {
  if (!ac) return;
  for (const [id, L] of loops) if (ac.currentTime - L.seen > 0.3) { try { L.n.stop(); L.hum.stop(); } catch {} L.mix.disconnect(); loops.delete(id); }
}

// ---- measuring the mix ----
// Renders each sound offline (silently) and reports its loudness, so levels can be balanced by numbers.
export async function measureMix(tests) {
  const saved = { ac, master, sfx, rest, verb, verbIn, noiseBuf, listener, occlude, indoorAt, C };
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
  ({ ac, master, sfx, rest, verb, verbIn, noiseBuf, listener, occlude, indoorAt, C } = saved);
  return res;
}
const module = { droneLoop: (...a) => droneLoop(...a), gunshot: (...a) => gunshot(...a), explosion: (...a) => explosion(...a), step: (...a) => step(...a), shuffle: (...a) => shuffle(...a),
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
