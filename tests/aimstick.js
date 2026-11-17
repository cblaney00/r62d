// Phone aim stick schemes played by simulated HUMAN thumbs (he asked 2026-11-17: craft the best scheme for two thumbs
// and a gyroscope, and give the simulated thumbs a handicap: no perfect dexterity). public/js/aimstick.js holds the
// schemes. Each trial: an enemy appears at 3, 8 or 15 m, 20-150 degrees from where you aim; the thumb lands on the
// stick and has to bring the crosshair onto the body (and, harder, the head) and hold it there.
// The thumb: reacts 0.2 s late, moves at most ~5 stick radii a second, misjudges each move (3 degrees, 12 % of its
// length), corrects by eye every 0.15 s, and shakes a little all the time (tremor). Optional gyro: the phone turned by
// the wrist does fine corrections (slower, noisier) once the thumb has settled.
// Prints, per scheme and distance: how often and how fast the body / the head is held (0.2 s on target), and how much
// the crosshair shakes while holding. Run: node tests/aimstick.js [trials]
import { newStick, stepStick, stickFrom, SCHEMES, TUNE } from '../public/js/aimstick.js';

export const DIAG = { n: 0, lat: 0, rad: 0 };
const TRIALS = Number(process.argv[2] || 300), DT = 1 / 60, PXM = 36, AIM_MIN = 46, REACH = 18 * PXM;
const sens = 0.7, Rpx = 62 / sens; // the stick radius the thumb really travels, in screen px
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += rnd(); return (u - 3) / Math.sqrt(0.5); };
const dist = r => AIM_MIN + r * (REACH - AIM_MIN);
const point = (a, r) => ({ x: Math.cos(a) * dist(r), y: Math.sin(a) * dist(r) });

function trial(scheme, m, gyro) {
  const tx = m * PXM, ta = (rnd() < 0.5 ? -1 : 1) * (0.35 + rnd() * 2.25), target = { x: Math.cos(ta) * tx, y: Math.sin(ta) * tx };
  const S = SCHEMES[scheme], s = newStick(scheme, 0, 0.3);
  const hist = []; let thumb = { x: 0, y: 0 }, mv = null, planned = false, nextLook = 0.2, gain = 1, trem = { x: 0, y: 0 }, gyr = 0;
  let onBody = 0, onHead = 0, tBody = null, tHead = null, shake = [], t = 0;
  const ovec = () => ({ x: Math.cos(s.ang) * stickFrom(s.reach, S.curve), y: Math.sin(s.ang) * stickFrom(s.reach, S.curve) });
  for (; t < 3; t += DT) {
    hist.push({ a: s.ang, r: s.reach });
    if (!mv && t >= nextLook) { // look (what the eye saw 0.2 s ago) and plan the next move of the thumb
      const seen = hist[Math.max(0, hist.length - 1 - Math.round(0.2 / DT))];
      const want = { a: Math.atan2(target.y, target.x), r: (Math.hypot(target.x, target.y) - AIM_MIN) / (REACH - AIM_MIN) };
      const first = !planned; planned = true; let goal;
      if (first || S.kind === 'abs') { // aim where the target is, as the stick has taught them (with misjudgement)
        const l = stickFrom(want.r, S.curve) * (1 + gauss() * 0.12), an = want.a + gauss() * 0.052;
        goal = { x: Math.cos(an) * l, y: Math.sin(an) * l };
      } else { // a correction: move the thumb by what the crosshair is off (in stick terms), scaled by the gain they've learned
        const cur = { x: Math.cos(seen.a) * stickFrom(seen.r, S.curve), y: Math.sin(seen.a) * stickFrom(seen.r, S.curve) };
        const w = { x: Math.cos(want.a) * stickFrom(want.r, S.curve), y: Math.sin(want.a) * stickFrom(want.r, S.curve) };
        const k = (1 + gauss() * 0.15) / gain, an = gauss() * 0.1, ex = (w.x - cur.x) * k, ey = (w.y - cur.y) * k;
        goal = { x: thumb.x + ex * Math.cos(an) - ey * Math.sin(an), y: thumb.y + ex * Math.sin(an) + ey * Math.cos(an) };
      }
      const gl = Math.hypot(goal.x, goal.y); if (gl > 1.15) { goal.x *= 1.15 / gl; goal.y *= 1.15 / gl; }
      const len = Math.hypot(goal.x - thumb.x, goal.y - thumb.y);
      // a bell-shaped submovement: quick flicks ~0.12-0.27 s, careful corrections slower
      mv = { p0: { ...thumb }, p1: goal, t0: t, T: first ? 0.12 + 0.15 * len : 0.15 + 0.25 * len, o0: ovec(), len };
    }
    if (mv) {
      const u = Math.min(1, (t - mv.t0) / mv.T), sj = u * u * u * (10 - 15 * u + 6 * u * u);
      thumb = { x: mv.p0.x + (mv.p1.x - mv.p0.x) * sj, y: mv.p0.y + (mv.p1.y - mv.p0.y) * sj };
      if (u >= 1) { // done: a relative stick teaches how much the aim moved for that much thumb
        if (S.kind === 'rel' && mv.len > 0.01 && planned && hist.length > 30) { const o1 = ovec(), r = Math.hypot(o1.x - mv.o0.x, o1.y - mv.o0.y) / mv.len; gain = Math.max(0.25, Math.min(1.3, gain * 0.6 + r * 0.4)); }
        mv = null; nextLook = t + 0.08;
      }
    }
    trem.x = trem.x * 0.8 + gauss() * 0.003; trem.y = trem.y * 0.8 + gauss() * 0.003; // ~0.5 px of shake at 8-12 Hz
    const tt = { x: thumb.x + trem.x, y: thumb.y + trem.y }, tl = Math.hypot(tt.x, tt.y);
    if (tl > 1) { tt.x /= tl; tt.y /= tl; }
    stepStick(s, tt, DT, 1, 1);
    if (gyro && t > 0.5) { // the wrist nudges the last bit: from what the eye saw 0.2 s ago, slowly, a little unsteady
      const seen = hist[Math.max(0, hist.length - 1 - Math.round(0.2 / DT))], ta2 = Math.atan2(target.y, target.x), e = Math.atan2(Math.sin(ta2 - seen.a), Math.cos(ta2 - seen.a));
      gyr = gyr * 0.9 + gauss() * 0.0003; s.ang += e * Math.min(1, DT * 2.5) + gyr;
    }
    const p = point(s.ang, s.reach), ex2 = p.x - target.x, ey2 = p.y - target.y;
    const lat = Math.abs(Math.sin(s.ang - Math.atan2(target.y, target.x))) * tx, rad = Math.abs(Math.hypot(p.x, p.y) - tx);
    if (t > 1) { DIAG.n++; if (lat >= 5) DIAG.lat++; if (rad >= 30) DIAG.rad++; }
    onBody = lat < 5 && rad < 30 ? onBody + DT : 0; onHead = Math.hypot(ex2, ey2) < 3 ? onHead + DT : 0;
    if (tBody === null && onBody >= 0.2) tBody = t;
    if (tHead === null && onHead >= 0.2) tHead = t;
    if (tBody !== null && t - tBody < 0.6) shake.push(lat);
  }
  const rms = shake.length ? Math.sqrt(shake.reduce((a, v) => a + v * v, 0) / shake.length) : null;
  return { tBody, tHead, rms };
}

// SWEEP=1: try combinations of the stick's numbers (TUNE) and print the best (body held, then speed, then shake)
if (process.env.SWEEP) {
  const grid = { NEAR: [0.45, 0.55], ZONE: [0.7, 0.75], OUT: [0.6, 0.85, 1.2], FAR_A: [0.25, 0.5, 1], FAR_L: [0.25, 0.5, 1] }, keys = Object.keys(grid), res = [];
  const combos = keys.reduce((acc, k) => acc.flatMap(c => grid[k].map(v => ({ ...c, [k]: v }))), [{}]);
  for (const scheme of ['steady']) for (const c of combos) {
    Object.assign(TUNE, c);
    let pb = 0, tm = 0, sh = 0; const by = {};
    for (const m of [3, 8, 15]) { seed = 7 + m; const rs = []; for (let i = 0; i < TRIALS; i++) rs.push(trial(scheme, m, false)); const ok = rs.filter(r => r.tBody !== null); pb += ok.length / TRIALS / 3; by[m] = ok.length / TRIALS; tm += (ok.length ? ok.reduce((a, r) => a + r.tBody, 0) / ok.length : 3) / 3; sh += (ok.length ? ok.reduce((a, r) => a + (r.rms || 0), 0) / ok.length : 20) / 3; }
    res.push({ scheme, c: { ...c }, pb, tm, sh, by });
  }
  res.sort((a, b) => ((b.by[3] >= 0.97 && b.by[8] >= 0.75) - (a.by[3] >= 0.97 && a.by[8] >= 0.75)) || b.by[15] - a.by[15] || b.pb - a.pb);
  for (const r of res.slice(0, 10)) console.log(JSON.stringify(r.c), 'body 3/8/15 m', [3, 8, 15].map(m => (r.by[m] * 100).toFixed(0) + '%').join(' / '), 'time', r.tm.toFixed(2), 'shake', r.sh.toFixed(1));
  process.exit(0);
}
const med = a => { const b = a.filter(v => v !== null).sort((x, y) => x - y); return b.length ? b[b.length >> 1] : null; };
const out = {};
console.log(`${TRIALS} trials each; thumb travel ${Rpx.toFixed(0)} px; body = held 0.2 s within 5 px across / 30 px along, head = within 3 px`);
console.log('scheme        dist  body%  body s  head%  head s  shake px');
for (const scheme of Object.keys(SCHEMES)) for (const gyro of [false, true]) for (const m of [3, 8, 15]) {
  seed = 7 + m; const rs = []; for (let i = 0; i < TRIALS; i++) rs.push(trial(scheme, m, gyro));
  const pb = rs.filter(r => r.tBody !== null).length / TRIALS, ph = rs.filter(r => r.tHead !== null).length / TRIALS;
  const mb = med(rs.map(r => r.tBody)), mh = med(rs.map(r => r.tHead)), sh = med(rs.map(r => r.rms));
  (out[scheme + (gyro ? '+gyro' : '')] ||= {})[m] = { pb, ph, mb, mh, sh };
  if (process.env.DIAG) console.log('   after 1 s, off across', (DIAG.lat / DIAG.n * 100).toFixed(0) + '%', 'off along', (DIAG.rad / DIAG.n * 100).toFixed(0) + '%'); DIAG.n = DIAG.lat = DIAG.rad = 0;
  console.log(`${(scheme + (gyro ? '+gyro' : '')).padEnd(13)} ${String(m).padStart(3)}m  ${(pb * 100).toFixed(0).padStart(4)}  ${mb === null ? '   -  ' : mb.toFixed(2).padStart(6)}  ${(ph * 100).toFixed(0).padStart(4)}  ${mh === null ? '   -  ' : mh.toFixed(2).padStart(6)}  ${sh === null ? '-' : sh.toFixed(2)}`);
}
// the chosen scheme (steady) must beat the old stick: holds the body at least as often at every distance, and shakes less
let fails = 0;
for (const m of [3, 8, 15]) {
  const o = out.old[m], h = out.steady[m];
  if (h.pb + 0.02 < o.pb) { fails++; console.log(`FAIL steady holds the body less often than the old stick at ${m} m`); }
  if (h.sh !== null && o.sh !== null && h.sh > o.sh * 1.05) { fails++; console.log(`FAIL steady shakes more than the old stick at ${m} m`); }
}
if (out.steady[15].pb < 0.25) { fails++; console.log('FAIL the body is held at 15 m less than 25 % of the time (he asked for 25 %)', out.steady[15].pb); }
console.log(fails ? `${fails} failure(s)` : 'PASS aimstick');
process.exit(fails ? 1 : 0);
