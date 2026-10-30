// The aiming model: the first shot of a burst goes exactly where you aim (every gun; standing, running, aimed or
// from the hip), follow-up shots never leave the cone, recoil only moves the next shot, the gun settles back, shotgun
// pellets fan round the aim point, accuracy only comes back after the settle time (no perfect one-tap spam), and a quick click is fired with the aim it was made with.
// Run: node tests/aim.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { store } from '../server/store.js';
import { WEAPONS, gunMods, spreadCone, settleTime } from '../shared/operators.js';
import { BASE_SPEED } from '../shared/physics.js';

let fails = 0;
const fail = (...a) => { fails++; console.log('FAIL', ...a); };
const g = new Game({ free: true });
const p = g.addPlayer('Aimer', false); p.token = store.login('Aimer').token; p.pid = 'x';
g.handle(p, { t: 'free', a: 'start', map: 'harbor', bots: 0 });
const shots = []; const hs = g.hitscan.bind(g);
g.hitscan = (src, x0, y0, a, ...r) => { if (src === p) shots.push(a); return hs(src, x0, y0, a, ...r); };
const tick = n => { for (let i = 0; i < n; i++) g.tick(1 / 30); };
const near = (a, b) => Math.abs(a - b) < 1e-9;

for (const [id, w] of Object.entries(WEAPONS)) {
  const m = gunMods(id);
  for (const st of [{ ads: 0, run: 0 }, { ads: 1, run: 0 }, { ads: 0, run: 1 }, { ads: 1, run: 1 }]) {
    const gun = { w: id, ammo: w.mag, reserve: 999, att: {}, m };
    p.guns = [gun]; p.slot = 0; p.alive = true; p.downed = false; p.reloadT = 0; p.ctrl = 'body'; p.busy = null;
    p.adsT = st.ads; p.vx = st.run * BASE_SPEED; p.vy = 0; p.input = { fire: 0 }; p.prevInput = {};
    tick(Math.ceil((settleTime(w) + 60 / w.rpm * 1.05) * 30) + 3); p.adsT = st.ads; p.vx = st.run * BASE_SPEED;
    const aim = 0.7 + Math.random(); p.aim = aim; shots.length = 0;
    g.fire(p, gun, w);
    const tag = `${w.name} ${st.ads ? 'aimed' : 'hip'} ${st.run ? 'running' : 'still'}:`;
    if (w.pellets === 1 && !near(shots[0], aim)) fail(tag, 'first shot off by', shots[0] - aim);
    if (w.pellets > 1) { const mid = shots.reduce((a, b) => a + b, 0) / shots.length; if (Math.abs(mid - aim) > 0.01) fail(tag, 'pellets not centred', mid - aim); }
    // follow-ups: inside the cone round aim + recoil
    for (let n = 0; n < 8 && w.pellets === 1; n++) {
      const cone = spreadCone(w, m, { at: st.ads, run: st.run, crouch: false, shots: p.shots }), base = aim + p.rc;
      shots.length = 0; g.fire(p, gun, w);
      if (Math.abs(shots[0] - base) > cone + 1e-9) fail(tag, 'follow-up', n, 'outside the cone');
    }
  }
}
// tapping again before the gun has settled is not exact; waiting the settle time is
{
  const w = WEAPONS.p10, gun = { w: 'p10', ammo: 15, reserve: 60, att: {}, m: gunMods('p10') };
  p.guns = [gun]; p.slot = 0; p.adsT = 1; p.vx = p.vy = 0; p.input = {}; p.prevInput = {};
  tick(30); let off = 0;
  for (let i = 0; i < 6; i++) { g.fire(p, gun, w); p.rc = 0; tick(Math.round(30 * (60 / w.rpm + 0.12))); shots.length = 0; p.aim = 1; g.fire(p, gun, w); off += Math.abs(shots[0] - 1 - 0); p.rc = 0; tick(30); }
  if (off === 0) fail('fast taps were all perfectly exact');
  tick(Math.ceil(30 * (settleTime(w) + 60 / w.rpm)) + 2); shots.length = 0; p.aim = 1; p.rc = 0; g.fire(p, gun, w);
  if (!near(shots[0], 1)) fail('a shot after waiting the settle time was not exact', shots[0] - 1);
}
// a click that arrives with one aim, then more input with another aim before the tick: the shot uses the click's aim
{
  const w = WEAPONS.p10, gun = { w: 'p10', ammo: 15, reserve: 60, att: {}, m: gunMods('p10') };
  p.guns = [gun]; p.slot = 0; p.adsT = 0; p.vx = p.vy = 0; p.input = {}; p.prevInput = {}; p.fireCd = 0;
  tick(40); shots.length = 0;
  g.handle(p, { t: 'input', s: 1, k: { fire: 1 }, a: 1.234, dt: 0.005 });
  g.handle(p, { t: 'input', s: 2, k: {}, a: 2.5, dt: 0.005 });
  tick(1);
  if (shots.length !== 1) fail('quick click fired', shots.length, 'shots'); else if (!near(shots[0], 1.234)) fail('quick click used aim', shots[0], 'not 1.234');
}
// holding the trigger fires at the gun's real rate (not rounded to whole server ticks); a pistol tapped a hair early still fires
for (const [id, w] of Object.entries(WEAPONS)) {
  if (!w.auto) continue;
  const gun = { w: id, ammo: 9999, reserve: 0, att: {}, m: gunMods(id) };
  p.guns = [gun]; p.slot = 0; p.input = {}; p.prevInput = {}; p.fireCd = 0; tick(30);
  p.input = { fire: 1 }; const a0 = gun.ammo; tick(90); p.input = {}; tick(1);
  const want = w.rpm / 20, got = a0 - gun.ammo; // 3 s of fire
  if (Math.abs(got - want) > 1.5) fail(`${w.name}: fired ${got} shots in 3 s, its rate says ${want}`);
}
{
  const w = WEAPONS.p10, gun = { w: 'p10', ammo: 15, reserve: 60, att: {}, m: gunMods('p10') };
  p.guns = [gun]; p.slot = 0; p.input = {}; p.prevInput = {}; p.fireCd = 0; tick(30);
  const a0 = gun.ammo;
  g.handle(p, { t: 'input', s: 10, k: { fire: 1 }, a: 1, dt: 0.005 }); g.handle(p, { t: 'input', s: 11, k: {}, a: 1, dt: 0.005 }); tick(2);
  g.handle(p, { t: 'input', s: 12, k: { fire: 1 }, a: 1, dt: 0.005 }); g.handle(p, { t: 'input', s: 13, k: {}, a: 1, dt: 0.005 }); tick(10);
  if (a0 - gun.ammo !== 2) fail('an early second tap was lost:', a0 - gun.ammo, 'shots');
}
// a burst gun fires its whole burst from one quick click, then waits its gap
{
  const id = Object.keys(WEAPONS).find(k => WEAPONS[k].burst > 1), w = WEAPONS[id];
  const gun = { w: id, ammo: w.mag, reserve: 60, att: {}, m: gunMods(id) };
  p.guns = [gun]; p.slot = 0; p.input = {}; p.prevInput = {}; p.fireCd = 0; p.burst = 0; tick(30);
  g.handle(p, { t: 'input', s: 20, k: { fire: 1 }, a: 1, dt: 0.005 }); g.handle(p, { t: 'input', s: 21, k: {}, a: 1, dt: 0.005 });
  tick(Math.ceil(30 * (w.burst * 60 / w.rpm)) + 2);
  if (w.mag - gun.ammo !== w.burst) fail(`${w.name}: one click fired ${w.mag - gun.ammo}, not ${w.burst}`);
  p.input = { fire: 1 }; tick(1); p.input = {}; tick(1);
  if (w.mag - gun.ammo !== w.burst) fail(`${w.name}: fired again inside the gap between bursts`);
}
// a slug (one pellet) can headshot; a pellet can't
{
  const slug = Object.keys(WEAPONS).find(k => WEAPONS[k].cls === 'Shotgun' && WEAPONS[k].pellets === 1);
  if (!slug) fail('no slug gun');
}
console.log(fails ? `${fails} failure(s)` : 'PASS aim');
process.exit(fails ? 1 : 0);
