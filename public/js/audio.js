// R62D sound engine. Everything is synthesised (no audio files).
// Each sound is positioned: distance fade, stereo pan, muffling through walls, and a room echo.
let ac = null, master = null, sfx = null, verb = null, verbIn = null, noiseBuf = null;
let listener = { x: 0, y: 0 }, occlude = () => 0, indoorAt = () => true;
let vol = { master: 0.6, sfx: 1 };
const loops = new Map();

export function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  ac = new (window.AudioContext || window.webkitAudioContext)();
  master = ac.createGain(); master.gain.value = vol.master;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = 0.002; comp.release.value = 0.2;
  master.connect(comp); comp.connect(ac.destination);
  sfx = ac.createGain(); sfx.gain.value = vol.sfx; sfx.connect(master);
  // room echo: a generated impulse response
  verb = ac.createConvolver();
  const len = ac.sampleRate * 1.4, ir = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) { const t = i / len; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.2) * (i < 600 ? i / 600 : 1); }
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
  if (!ac || ac.state !== 'running') return null;
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
  send.gain.value = wet * (indoorAt(listener.x, listener.y) ? 1 : 0.35) * (1 + Math.min(1.5, d / 400) + walls * 0.6);
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
};

export function step(x, y, surf, pace, own) {
  // pace: 0 slow-walk, 1 crouch, 2 walk, 3 run
  const s = SURF[surf] || SURF.concrete;
  const loud = [0.12, 0.22, 0.55, 1][pace] * s.v;
  const range = [160, 220, 420, 620][pace];
  const g = out(own ? undefined : x, own ? undefined : y, loud * (own ? 0.55 : 1), range, 0.12); if (!g) return;
  const t = ac.currentTime + rnd(0, 0.01);
  noise(g, t, 0.05, 'bandpass', s.f * rnd(0.85, 1.15), s.q, 0.9);                    // heel
  noise(g, t + rnd(0.035, 0.06), 0.07, 'bandpass', s.f * rnd(0.7, 1.0), s.q, 0.5);    // toe
  if (s.body) tone(g, t, 0.07, s.body * rnd(0.9, 1.1), s.body * 0.6, 'sine', 0.5);
  if (surf === 'grass' || surf === 'rubble') noise(g, t + 0.02, 0.14, 'highpass', surf === 'grass' ? 3500 : 2500, 0.5, 0.35, 0.02);
  if (surf === 'wood' && Math.random() < 0.12) tone(g, t + 0.05, 0.22, rnd(300, 500), rnd(250, 420), 'triangle', 0.06, 0.05); // creak
  if (pace === 3) gear(g, t + 0.02, 0.35);
}
function gear(g, t, v) { // equipment rattle: buckles, mags, sling
  noise(g, t, 0.06, 'bandpass', rnd(2500, 4000), 3, v * 0.5, 0.004);
  if (Math.random() < 0.5) ring(g, t + rnd(0.01, 0.04), rnd(2200, 3200), v * 0.12, 0.08);
}

export function shuffle(x, y, surf, own) { // turning on the spot
  const s = SURF[surf] || SURF.concrete;
  const g = out(own ? undefined : x, own ? undefined : y, 0.14 * s.v, 180, 0.1); if (!g) return;
  const t = ac.currentTime;
  noise(g, t, 0.12, 'bandpass', s.f * 0.8, 0.7, 0.6, 0.03);
  noise(g, t + 0.02, 0.16, 'bandpass', 1800, 1.2, 0.25, 0.04); // cloth
}

// --- foley: small sounds for nearly everything a player does ---
export function foley(kind, x, y, own) {
  const fx = own ? undefined : x, fy = own ? undefined : y;
  let g; const t = ac ? ac.currentTime : 0;
  switch (kind) {
    case 'cloth': g = out(fx, fy, 0.16, 200, 0.05); if (g) noise(g, t, 0.18, 'bandpass', rnd(1400, 2400), 0.9, 0.7, 0.05); break;
    case 'adsIn': g = out(fx, fy, 0.2, 220, 0.05); if (g) { noise(g, t, 0.12, 'bandpass', 1800, 1, 0.5, 0.03); click(g, t + 0.09, 2600, 0.35); } break;
    case 'adsOut': g = out(fx, fy, 0.15, 200, 0.05); if (g) noise(g, t, 0.1, 'bandpass', 1500, 1, 0.5, 0.02); break;
    case 'crouch': g = out(fx, fy, 0.28, 260, 0.08); if (g) { noise(g, t, 0.2, 'bandpass', 1200, 0.8, 0.6, 0.04); tone(g, t + 0.12, 0.08, 120, 70, 'sine', 0.5); gear(g, t + 0.1, 0.4); } break;
    case 'stand': g = out(fx, fy, 0.24, 260, 0.08); if (g) { noise(g, t, 0.22, 'bandpass', 1600, 0.8, 0.6, 0.06); gear(g, t + 0.15, 0.35); } break;
    case 'draw': g = out(fx, fy, 0.4, 320, 0.1); if (g) { noise(g, t, 0.15, 'bandpass', 900, 1, 0.5, 0.02); noise(g, t + 0.12, 0.09, 'bandpass', 3000, 1.5, 0.5, 0.03, 5000); click(g, t + 0.28, 2800, 0.6); ring(g, t + 0.28, 2400, 0.08, 0.1); } break;
    case 'magOut': g = out(fx, fy, 0.45, 380, 0.12); if (g) { click(g, t, 3000, 0.7); noise(g, t + 0.03, 0.12, 'bandpass', 1800, 1.4, 0.45, 0.02, 1200); } break;
    case 'magIn': g = out(fx, fy, 0.55, 420, 0.12); if (g) { noise(g, t, 0.05, 'bandpass', 1400, 1.2, 0.5, 0.005); click(g, t + 0.05, 2200, 0.9, 0.02); tone(g, t + 0.05, 0.05, 180, 110, 'sine', 0.4); } break;
    case 'bolt': g = out(fx, fy, 0.5, 420, 0.12); if (g) { noise(g, t, 0.06, 'bandpass', 2600, 2, 0.6, 0.003, 1800); click(g, t + 0.11, 3200, 0.9, 0.02); ring(g, t + 0.11, 2900, 0.1, 0.12); } break;
    case 'shell': g = out(fx, fy, 0.35, 320, 0.1); if (g) { click(g, t, 1800, 0.6, 0.02); noise(g, t + 0.02, 0.06, 'bandpass', 900, 1.5, 0.3); } break;
    case 'magDrop': g = out(fx, fy, 0.3, 300, 0.1); if (g) { tone(g, t, 0.06, 220, 150, 'triangle', 0.5); click(g, t, 1500, 0.4, 0.03); click(g, t + 0.09, 1200, 0.2, 0.02); } break;
    case 'empty': g = out(fx, fy, 0.35, 260, 0.05); if (g) { click(g, t, 3600, 0.8, 0.008); ring(g, t, 3300, 0.06, 0.06); } break;
    case 'melee': g = out(fx, fy, 0.6, 450, 0.15); if (g) { noise(g, t, 0.16, 'bandpass', 600, 0.6, 0.6, 0.06, 1800); noise(g, t + 0.13, 0.1, 'lowpass', 700, 0.8, 0.9); tone(g, t + 0.13, 0.09, 140, 60, 'sine', 0.8); } break;
    case 'gadget': g = out(fx, fy, 0.3, 260, 0.08); if (g) { noise(g, t, 0.1, 'bandpass', 1300, 1, 0.5, 0.02); click(g, t + 0.1, 2400, 0.5); } break;
    case 'place': g = out(fx, fy, 0.45, 380, 0.12); if (g) { noise(g, t, 0.07, 'bandpass', 900, 1.3, 0.5); click(g, t + 0.06, 2000, 0.7, 0.02); tone(g, t + 0.18, 0.06, 1800, 1800, 'square', 0.06); } break;
    case 'throw': g = out(fx, fy, 0.35, 360, 0.1); if (g) { click(g, t, 4000, 0.5); noise(g, t + 0.05, 0.22, 'bandpass', 800, 0.6, 0.6, 0.08, 2000); } break;
    case 'bounce': g = out(fx, fy, 0.3, 450, 0.15); if (g) { tone(g, t, 0.05, rnd(900, 1300), 600, 'triangle', 0.5); click(g, t, 1800, 0.4); } break;
    case 'pin': g = out(fx, fy, 0.3, 260, 0.05); if (g) { ring(g, t, 3600, 0.18, 0.15); click(g, t + 0.08, 4500, 0.3); } break;
    case 'camSwitch': g = out(undefined, undefined, 0.22); if (g) { click(g, t, 2500, 0.6); noise(g, t + 0.01, 0.12, 'bandpass', 5000, 0.6, 0.25, 0.005); } break;
    case 'droneThrow': g = out(fx, fy, 0.35, 400, 0.1); if (g) { noise(g, t, 0.1, 'bandpass', 1000, 1, 0.5); tone(g, t + 0.1, 0.06, 160, 110, 'sine', 0.5); click(g, t + 0.1, 1500, 0.5); } break;
    case 'spot': g = out(undefined, undefined, 0.25); if (g) { tone(g, t, 0.06, 1760, 1760, 'square', 0.15); tone(g, t + 0.07, 0.08, 2350, 2350, 'square', 0.12); } break;
    case 'hammer': g = out(fx, fy, 0.75, 650, 0.25); if (g) { tone(g, t, 0.12, rnd(150, 190), 90, 'square', 0.25); ring(g, t, rnd(700, 900), 0.3, 0.35); noise(g, t, 0.08, 'bandpass', 1500, 1, 0.6); } break;
    case 'nail': g = out(fx, fy, 0.55, 520, 0.2); if (g) { tone(g, t, 0.07, rnd(220, 260), 160, 'triangle', 0.5); noise(g, t, 0.06, 'bandpass', 900, 1.5, 0.6); } break;
    case 'beep': g = out(fx, fy, 0.35, 700, 0.15); if (g) tone(g, t, 0.07, 1900, 1900, 'square', 0.18); break;
    case 'tick': g = out(fx, fy, 0.3, 500, 0.1); if (g) click(g, t, 2800, 0.7, 0.01); break;
    case 'revive': g = out(fx, fy, 0.3, 300, 0.1); if (g) { noise(g, t, 0.3, 'bandpass', 1400, 0.8, 0.5, 0.08); tone(g, t + 0.1, 0.3, 500, 800, 'sine', 0.15); } break;
    case 'heartbeat': g = out(undefined, undefined, 0.5); if (g) { tone(g, t, 0.12, 60, 40, 'sine', 1); tone(g, t + 0.16, 0.14, 55, 38, 'sine', 0.8); } break;
    case 'breath': g = out(undefined, undefined, 0.12); if (g) { noise(g, t, 0.55, 'bandpass', 750, 0.7, 0.6, 0.25); noise(g, t + 0.7, 0.6, 'bandpass', 600, 0.7, 0.45, 0.2); } break;
    case 'hurt': g = out(fx, fy, 0.5, 380, 0.1); if (g) { noise(g, t, 0.12, 'lowpass', 500, 0.8, 0.8); tone(g, t, 0.1, 110, 60, 'sine', 0.8); } break;
  }
}

// --- impacts by material ---
export function impact(mat, x, y) {
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
  const g = out(x, y, 0.12, 300, 0.08); if (!g) return;
  const soft = surf === 'carpet' || surf === 'grass';
  const t = ac.currentTime + rnd(0.25, 0.45);
  for (let i = 0; i < (soft ? 1 : 3); i++) {
    const tt = t + i * rnd(0.06, 0.11), v = 0.5 / (i + 1);
    if (soft) noise(g, tt, 0.04, 'bandpass', 900, 1, v * 0.6);
    else if (shotgun) { tone(g, tt, 0.04, rnd(500, 700), 400, 'triangle', v * 0.6); click(g, tt, 1500, v * 0.5); }
    else ring(g, tt, rnd(4200, 6200), v * 0.35, 0.09);
  }
}

export function whiz(x, y) { // a bullet passing close to you
  const g = out(x, y, 0.4, 200, 0.05); if (!g) return;
  const t = ac.currentTime;
  noise(g, t, 0.012, 'highpass', 4000, 0.7, 1, 0.0005);           // supersonic crack
  noise(g, t, 0.14, 'bandpass', rnd(2000, 3500), 3, 0.5, 0.01, 900); // whizz
}

export function debris(x, y, amount = 1) {
  const g = out(x, y, 0.3 * amount, 600, 0.2); if (!g) return;
  const t = ac.currentTime;
  for (let i = 0; i < 6 * amount; i++) { const tt = t + rnd(0.02, 0.7); click(g, tt, rnd(1200, 3500), rnd(0.1, 0.35), 0.015); }
  noise(g, t, 0.5, 'bandpass', 700, 0.5, 0.4, 0.01);
}

// --- guns and explosions ---
const GUN = {
  AR:      { crack: 3200, body: 1300, boom: 110, dur: 0.16, v: 0.9, mech: 3000 },
  SMG:     { crack: 3800, body: 1700, boom: 140, dur: 0.11, v: 0.75, mech: 3600 },
  MP:      { crack: 4200, body: 2000, boom: 160, dur: 0.09, v: 0.65, mech: 3900 },
  LMG:     { crack: 2900, body: 1100, boom: 95,  dur: 0.19, v: 1.0, mech: 2600 },
  DMR:     { crack: 2600, body: 1000, boom: 75,  dur: 0.28, v: 1.15, mech: 2400 },
  Shotgun: { crack: 2000, body: 700,  boom: 65,  dur: 0.33, v: 1.25, mech: 1800 },
  Pistol:  { crack: 3500, body: 1500, boom: 130, dur: 0.12, v: 0.75, mech: 3400 },
};
export function gunshot(cls, x, y, own) {
  const s = GUN[cls] || GUN.AR;
  const g = out(own ? undefined : x, own ? undefined : y, s.v, 1600, 0.45); if (!g) return;
  const t = ac.currentTime;
  noise(g, t, 0.035, 'highpass', s.crack, 0.7, 1.0, 0.0005);              // muzzle crack
  noise(g, t, s.dur, 'bandpass', s.body * rnd(0.92, 1.08), 0.7, 0.9);      // body
  noise(g, t, s.dur * 2.2, 'lowpass', 500, 0.5, 0.55, 0.003);             // low blast
  tone(g, t, 0.13, s.boom * rnd(0.95, 1.05), 38, 'sine', 0.9);            // thump
  if (own) { click(g, t + 0.025, s.mech, 0.12, 0.01); }                   // action cycling (only heard up close)
}

export function explosion(x, y, kind) {
  const big = kind === 'frag' || kind === 'nitro' || kind === 'cutter';
  const g = out(x, y, big ? 1.5 : 1.05, 2000, 0.6); if (!g) return;
  const t = ac.currentTime;
  if (kind === 'stun') { noise(g, t, 0.05, 'highpass', 3000, 0.7, 1); noise(g, t, 0.8, 'highpass', 6000, 0.5, 0.4, 0.002); tone(g, t, 0.3, 90, 40, 'sine', 0.6); return; }
  if (kind === 'emp') { tone(g, t, 0.6, 120, 40, 'sawtooth', 0.35); noise(g, t, 0.5, 'bandpass', 4000, 2, 0.4, 0.01); for (let i = 0; i < 8; i++) click(g, t + rnd(0, 0.5), rnd(3000, 6000), 0.3); return; }
  if (kind === 'cutter') { noise(g, t, 1.8, 'bandpass', 2600, 0.4, 0.5, 0.3); }
  noise(g, t, 0.05, 'highpass', 2000, 0.6, 1);
  noise(g, t, big ? 1.8 : 1.1, 'lowpass', 900, 0.4, 1, 0.004, 120);
  tone(g, t, 0.8, 85, 22, 'sine', 1.3);
  debris(x, y, big ? 2 : 1);
}

export function play(name, x, y) { // simple named sounds from the server
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
    case 'planted': { const g = out(undefined, undefined, 0.5); if (!g) return; const t = ac.currentTime; for (let i = 0; i < 3; i++) tone(g, t + i * 0.18, 0.12, 880 + i * 220, 880 + i * 220, 'square', 0.22); return; }
    case 'revive': return foley('revive', x, y);
  }
}

export function ui(kind = 'click') {
  const g = out(undefined, undefined, 0.22, 0, 0); if (!g) return;
  const t = ac.currentTime;
  if (kind === 'hover') tone(g, t, 0.03, 2200, 2200, 'triangle', 0.2);
  else if (kind === 'round') { tone(g, t, 0.6, 220, 220, 'sawtooth', 0.12); tone(g, t, 0.6, 330, 330, 'sawtooth', 0.1); noise(g, t, 0.6, 'lowpass', 400, 0.5, 0.3, 0.1); }
  else if (kind === 'hit') tone(g, t, 0.05, 2600, 2400, 'triangle', 0.55);
  else if (kind === 'kill') { tone(g, t, 0.07, 1800, 1800, 'triangle', 0.55); tone(g, t + 0.06, 0.1, 2400, 2400, 'triangle', 0.55); }
  else tone(g, t, 0.04, 1300, 1300, 'triangle', 0.45);
}

// Continuous drone motor whine, keyed by drone id.
export function droneLoop(id, x, y, speed) {
  if (!ac || ac.state !== 'running') return;
  let L = loops.get(id);
  if (!L) {
    const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 150;
    const n = ac.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
    const nf = ac.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 2400; nf.Q.value = 2;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    const g = ac.createGain(); g.gain.value = 0;
    const p = ac.createStereoPanner();
    o.connect(lp); n.connect(nf); nf.connect(lp); lp.connect(g); g.connect(p); p.connect(sfx);
    o.start(); n.start();
    L = { o, n, g, p, lp, seen: 0 }; loops.set(id, L);
  }
  const d = Math.hypot(x - listener.x, y - listener.y);
  const k = Math.max(0, 1 - d / 320) ** 1.5 * Math.min(1, speed / 120) * Math.pow(0.5, d > 20 ? occlude(x, y) : 0);
  const t = ac.currentTime;
  L.g.gain.setTargetAtTime(0.05 * k, t, 0.05);
  L.o.frequency.setTargetAtTime(120 + speed * 0.6, t, 0.08);
  L.p.pan.setTargetAtTime(Math.max(-0.9, Math.min(0.9, (x - listener.x) / 260)), t, 0.05);
  L.seen = t;
}
export function pruneLoops() {
  if (!ac) return;
  for (const [id, L] of loops) if (ac.currentTime - L.seen > 0.3) { try { L.o.stop(); L.n.stop(); } catch {} L.g.disconnect(); loops.delete(id); }
}
