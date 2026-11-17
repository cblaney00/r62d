// The phone's aim stick (he asked 2026-11-17: gentler; then "there should be acceleration ... a zone where it starts
// accelerating so that its possible to fine aim unless its obvious to the joystick that you want to pull far", and to
// craft the best scheme for two human thumbs and a gyroscope). Pure maths, shared by main.js and tests/aimstick.js,
// which plays it with simulated human thumbs (slow reactions, tremor, imprecise moves) and compares schemes.
//
// The thumb gives a stick vector t (units of the stick radius, length 0..1). The scheme keeps an output vector o: its
// direction is where you aim, its length how far out the crosshair sits (via the reach curve).
//  'old'    o = t (the stick as it was: absolute), reach = |o|^1.35
//  'accel'  o = t, reach curve with a fine inner zone and an accelerating outer zone
//  'steady' (the chosen one: best in tests/aimstick.js) the accel reach curve plus tremor damping: a slow thumb is
//           followed smoothly (CALM per second), a fast one at once. Aimed in / steadying / a lower setting = calmer.
//  'hybrid' (tried, slower for human thumbs: too many small corrections) the accel reach curve, plus pointer-style acceleration on the thumb's speed: slow, small
//           thumb movements move o only a fraction (fine aim, tremor damped), fast or large ones move it fully and
//           pull o back onto the thumb (the stick is absolute again). A new touch starts from where you already aim, so
//           touching and nudging corrects the aim instead of snapping it to the thumb.
export const SCHEMES = {
  old: { kind: 'abs', curve: 'pow' },
  accel: { kind: 'abs', curve: 'zone' },
  steady: { kind: 'abs', curve: 'zone', calm: true }, // + tremor damping: a slow thumb is followed smoothly, a fast one at once
  hybrid: { kind: 'rel', curve: 'zone' },
};
// reach curve: inside ZONE of the stick the crosshair only goes out to NEAR of its reach (fine control); past it the
// reach climbs steeply (the acceleration zone) to full reach at the rim
export const TUNE = { ZONE: 0.8, NEAR: 0.55, IN: 1.25, OUT: 1.2, FINE: 0.3, SLOW: 0.6, FAST: 3.2, SWIPE: 0.14, PAUSE: 0.12, QUICK: 1.6, BIG: 1.15, CALM: 4, FAR_A: 0.25, FAR_L: 0.25, TRAVEL: 1.5 }; // TRAVEL: how much further the thumb travels than the stick drawn (touch.js) // (ZONE, NEAR, CALM chosen by the simulated-thumb sweep, 2026-11-17)
const T = TUNE;
export function reachFrom(l, curve) {
  l = Math.max(0, Math.min(1, l));
  if (curve === 'pow') return Math.pow(l, 1.35);
  const { ZONE, NEAR, IN, OUT } = TUNE;
  return l <= ZONE ? NEAR * Math.pow(l / ZONE, IN) : NEAR + (1 - NEAR) * Math.pow((l - ZONE) / (1 - ZONE), OUT);
}
export function stickFrom(reach, curve) { // the inverse: how far out the stick sits for a reach
  reach = Math.max(0, Math.min(1, reach));
  if (curve === 'pow') return Math.pow(reach, 1 / 1.35);
  const { ZONE, NEAR, IN, OUT } = TUNE;
  return reach <= NEAR ? ZONE * Math.pow(reach / NEAR, 1 / IN) : ZONE + (1 - ZONE) * Math.pow((reach - NEAR) / (1 - NEAR), 1 / OUT);
}
// thumb speed (stick radii per second) → how much of the thumb's movement reaches the aim: slow = FINE, fast = BIG

const smooth = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

// A new aim stick state, starting from the current aim (angle in radians, reach 0..1)
export function newStick(scheme, ang, reach) {
  const S = SCHEMES[scheme] || SCHEMES.hybrid, l = stickFrom(reach, S.curve);
  return { scheme, ox: Math.cos(ang) * l, oy: Math.sin(ang) * l, tx: null, ty: null, ang, reach, ep: 0, still: 0 };
}
// One frame: t = the thumb's stick vector, or null when no thumb is on it. sens: the player's setting (1 = normal),
// slow: extra slowing (aimed in, steadying). Returns { ang, reach } to aim with (unchanged while no thumb).
export function stepStick(s, t, dt, sens = 1, slow = 1) {
  const S = SCHEMES[s.scheme] || SCHEMES.hybrid;
  if (!t) { s.tx = s.ty = null; return s; }
  if (S.kind === 'abs' && S.calm) {
    if (s.tx === null) { s.tx = t.x; s.ty = t.y; s.moved = false; } // (o starts where you already aim: it glides from there to the thumb)
    if (!s.moved && Math.hypot(t.x, t.y) < 0.05) { s.tx = t.x; s.ty = t.y; return s; } // a thumb just resting where it landed changes nothing
    s.moved = true; // (after that the whole stick counts, right to the middle: he found aiming close to himself cut out)
    const sp = Math.hypot(t.x - s.tx, t.y - s.ty) / Math.max(dt, 1e-3), k = (T.CALM + 60 * smooth((sp - T.SLOW) / (T.FAST - T.SLOW))) * Math.max(0.3, Math.min(1.6, sens) * slow);
    // filtered as direction and distance: out in the accelerating zone a wobble moves the crosshair a lot, so both are
    // calmer there (FAR_A for the direction, FAR_L for the distance; he asked for more hits at 15 m)
    const tl = Math.hypot(t.x, t.y), ol = Math.hypot(s.ox, s.oy), oa = Math.atan2(s.oy, s.ox), ta = Math.atan2(t.y, t.x);
    const far = smooth((Math.max(tl, ol) - T.ZONE) / (1 - T.ZONE)), fa = Math.min(1, dt * k * (1 - (1 - T.FAR_A) * far)), fl = Math.min(1, dt * k * (1 - (1 - T.FAR_L) * far));
    const na = ol < 0.04 ? ta : oa + Math.atan2(Math.sin(ta - oa), Math.cos(ta - oa)) * fa, nl = ol + (tl - ol) * fl;
    s.ox = Math.cos(na) * nl; s.oy = Math.sin(na) * nl; s.tx = t.x; s.ty = t.y;
  } else if (S.kind === 'abs') { s.ox = t.x; s.oy = t.y; }
  else {
    if (s.tx === null) { s.tx = t.x; s.ty = t.y; s.first = true; s.sw = false; s.ep = 0; } // the thumb just landed: no jump, o stays where the aim is
    const dx = t.x - s.tx, dy = t.y - s.ty, sp = Math.hypot(dx, dy) / Math.max(dt, 1e-3);
    // The first quick swipe after the thumb lands (faster than QUICK, SWIPE long) means "aim over there": the aim follows
    // the thumb directly, like the plain stick, until it stops for PAUSE s. Everything after that (and a first move
    // that is slow) is relative: slow nudges move the aim a fraction (fine aim, shaking damped), quick ones a lot
    s.ep = (s.ep || 0) * Math.exp(-dt / 0.15) + Math.hypot(dx, dy);
    if (s.first && sp > T.QUICK && s.ep > T.SWIPE) s.sw = true;
    if (sp > T.SLOW) s.still = 0; else if ((s.still = (s.still || 0) + dt) > T.PAUSE) { if (s.sw || s.ep > 0.03) s.first = false; s.sw = false; }
    if (s.first && !s.sw && s.ep > 0.06 && sp <= T.QUICK) s.first = false; // a slow first move: a fine-aim touch
    const swipe = !!s.sw;
    const g = swipe ? 1 : (T.FINE + (T.BIG - T.FINE) * smooth((sp - T.SLOW) / (T.FAST - T.SLOW))) * Math.min(1.6, sens) * slow;
    s.ox += dx * g; s.oy += dy * g;
    if (swipe) { const pull = Math.min(1, dt * 18); s.ox += (t.x - s.ox) * pull; s.oy += (t.y - s.oy) * pull; }
    const ol = Math.hypot(s.ox, s.oy); if (ol > 1) { s.ox /= ol; s.oy /= ol; }
    s.tx = t.x; s.ty = t.y;
  }
  const ol = Math.hypot(s.ox, s.oy);
  if (ol > 0.012) s.ang = Math.atan2(s.oy, s.ox); // (right in the middle the direction means nothing: keep it)
  s.reach = reachFrom(ol, S.curve);
  return s;
}
