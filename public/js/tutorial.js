// The tutorial (he asked: one quick run, the whole rundown of how to play, bots that never shoot): a private match on
// Harbor Office against two bots. Round 1 you attack (pick, drone, ping, every movement and gun control, break in,
// plant), then the sides swap and round 2 you defend (reinforce, barricade, cameras, hold and take the attackers down).
// He asked 2026-11-24 for much more handholding, Counter-Strike / Valorant style, and nothing in the middle of the
// screen: a small objective list in the top-left (the stage, what to do now, a checklist that ticks itself, one short
// tip at a time), and a gold marker on the spot to go to (main.js drawCoachMark: metres, an arrow at the screen edge
// when it is off screen). Each goal is done when you have done it (the server counts what you do: game.js tutTrack).
// The server holds the clocks while you learn (game.js tick / tutAction), ends the plant quickly and stops after round 2.
import { PHASE, T, CELL, PX_PER_M } from '/shared/constants.js';
import { roomAt, floorAt, localPos } from '/shared/map.js';
import { OPERATORS, JOBS } from '/shared/operators.js';
import { keyName, bindsFor, label } from './keys.js';
import { isTouch } from './touch.js';

const ORDER = [PHASE.SELECT, PHASE.PREP, PHASE.ACTION];
const K = id => `<kbd>${isTouch ? label(id) : keyName(bindsFor(id)[0])}</kbd>`; // on a phone: the touch button's name
const MOVE = () => isTouch ? '<b>the left stick</b>' : `${K('up')}${K('left')}${K('down')}${K('right')}`;
const CLICK = isTouch ? 'Tap' : 'Click';
const siteName = c => c.map && c.map.sites[c.s.site] ? c.map.sites[c.s.site].name : 'the objective';
const more = (c, k, n) => (c.tu[k] || 0) - (c.base[k] || 0) >= n; // done n more of something since this stage began

// ---- spots for the marker (world px) ----
const site = c => c.map && c.map.sites[c.s.site];
const center = (m, cells) => { let x = 0, y = 0; for (const k of cells) { x += (k % m.W) + 0.5; y += Math.floor(k / m.W) + 0.5; } return { x: x / cells.length * CELL, y: y / cells.length * CELL }; };
// the nearest of some spots to where you look from, the same floor first (floors sit side by side in one grid)
function nearest(c, pts) {
  const v = c.view; if (!v || !pts.length) return pts[0] || null;
  const f = floorAt(c.map, v.x, v.y), same = pts.filter(p => floorAt(c.map, p.x, p.y) === f), list = same.length ? same : pts, a = localPos(c.map, v.x, v.y);
  let best = null, bd = 1e18; for (const p of list) { const b = localPos(c.map, p.x, p.y), d = (a.x - b.x) ** 2 + (a.y - b.y) ** 2; if (d < bd) { bd = d; best = p; } }
  return best;
}
const bombs = c => { const s = site(c); return s ? s.bombs.map(b => ({ x: b.x, y: b.y, w: 'BOMB ' + (b.id || '') })) : []; };
const outsideWay = c => c.map.openings.filter(o => o.ext).map(o => ({ ...center(c.map, o.cells), w: o.kind === 'window' ? 'WINDOW' : 'DOOR' }));
const toSite = c => { // the outside door or window closest to the objective, on the ground floor
  const b = bombs(c)[0]; if (!b) return null; const B = localPos(c.map, b.x, b.y);
  const ws = outsideWay(c).filter(p => floorAt(c.map, p.x, p.y) === 0); let best = null, bd = 1e18;
  for (const p of ws) { const q = localPos(c.map, p.x, p.y), d = (q.x - B.x) ** 2 + (q.y - B.y) ** 2; if (d < bd) { bd = d; best = p; } }
  return best;
};
const droneHoles = c => { const m = c.map, out = []; for (let k = 0; k < m.dhole.length; k++) if (m.dhole[k] && (m.tiles[k] === T.SOFT || m.tiles[k] === T.HARD)) out.push({ ...center(m, [k]), w: 'DRONE HOLE' }); return out; };
const siteRooms = c => { const s = site(c); return s ? c.map.rooms.filter(r => s.rooms.includes(r.name)) : []; };
const ring = (r, f) => { for (let x = r.x - 1; x <= r.x + r.w; x++) { f(x, r.y - 1); f(x, r.y + r.h); } for (let y = r.y; y < r.y + r.h; y++) { f(r.x - 1, y); f(r.x + r.w, y); } };
const softWalls = c => { const m = c.map, out = []; for (const r of siteRooms(c)) ring(r, (x, y) => { const k = y * m.W + x; if (m.tiles[k] === T.SOFT) out.push({ ...center(m, [k]), w: 'REINFORCE' }); }); return out; };
const openDoors = c => { const m = c.map, rs = siteRooms(c), touch = k => { const x = k % m.W, y = Math.floor(k / m.W); return rs.some(r => x >= r.x - 1 && x <= r.x + r.w && y >= r.y - 1 && y <= r.y + r.h); };
  return m.openings.filter(o => o.kind === 'door' && o.cells.some(touch) && o.cells.every(k => m.tiles[k] === T.OPEN)).map(o => ({ ...center(m, o.cells), w: 'BARRICADE' })); };
const indoors = (c, p) => { if (!p) return false; const r = roomAt(c.map, p.x, p.y); return !!r && r !== 'Outside' && r !== 'Stairs'; };

// Each stage: part (0 = attacking round, 1 = defending), phase, title, tips (one short sentence each, shown one after
// another under the checklist) and goals. A goal: t (what to do, one line), done(c), at(c) (the marker's spot, if any).
// go: when the stage's goals are done, start the next phase.
const STAGES = [
  { part: 0, ph: PHASE.SELECT, t: 'Pick an attacker', go: true, tips: [
      'Two teams of five: attack against defence.',
      'A round: operator select, then 30 s of preparation, then 2:40 of action.',
      'Attackers win by planting the defuser at bomb A or B, or by taking every defender down.',
      'This run: you attack one round, then defend one. The bots here never shoot.'],
    goals: [
      { t: () => `${CLICK} a <b>role</b> on the left (Breacher, Entry, Intel…)`, done: c => !!c.me.jb || !!c.me.op },
      { t: () => `${CLICK} one of its <b>operators</b>`, done: c => !!c.me.op }] },
  { part: 0, ph: PHASE.PREP, t: 'Scout with your drone', go: true, tips: [
      'In preparation attackers wait outside and scout with a drone.',
      'Drones are quiet, and fit through the small drone holes at the foot of walls.',
      'Anything you ping, your whole team sees.'],
    goals: [
      { t: () => `Drive the drone: ${MOVE()}`, done: c => more(c, 'dm', 4) },
      { t: () => `Sprint it: tap ${isTouch ? K('crouch').replace('CROUCH', 'SPRINT') : K('sprint')} (a short burst)`, done: c => more(c, 'dsp', 1) },
      { t: () => 'Drive into the building through the <b>marked</b> door or window', done: c => indoors(c, c.view), at: c => nearest(c, outsideWay(c)) },
      { t: () => 'Squeeze through a <b>drone hole</b> (marked)', done: c => !!c.tu.hole, at: c => nearest(c, droneHoles(c)) },
      { t: c => `Find <b>${siteName(c)}</b>: get it on screen until the yellow <b>A</b> and <b>B</b> appear`, done: c => !!c.s.rev, at: c => nearest(c, bombs(c)) },
      { t: () => `Ping it: point at a bomb marker and press ${K('spot')}${isTouch ? '' : ' (or click)'}`, done: c => more(c, 'n', 1), at: c => c.s.rev ? nearest(c, bombs(c)) : null }] },
  { part: 0, ph: PHASE.ACTION, t: 'Moving', tips: [
      'Running is loud; walking and crouching are silent.',
      'The first shot goes exactly on the crosshair once you stand still.',
      `Put a gadget in the wrong spot? Hold ${K('interact')} on it to pick it back up.`],
    goals: [
      { t: () => `Run: ${MOVE()}`, done: c => more(c, 'mv', 3) },
      { t: () => isTouch ? 'Walk quietly: push the left stick <b>gently</b>' : `Walk quietly: hold ${K('walk')} while moving`, done: c => more(c, 'wk', 1) },
      { t: () => `Crouch: ${isTouch ? 'tap' : 'hold'} ${K('crouch')} (silent, steadier aim)`, done: c => more(c, 'cr', 1) },
      { t: () => isTouch ? 'Sprint: push the move stick out to its edge <b>quickly</b>' : `Sprint: hold ${K('sprint')} and move`, done: c => more(c, 'spr', 2) },
      ...(isTouch ? [] : [
        { t: () => `Lean left round a corner: hold ${K('leanL')}`, done: c => more(c, 'lL', 0.5) },
        { t: () => `Lean right: hold ${K('leanR')}`, done: c => more(c, 'lR', 0.5) }])] },
  { part: 0, ph: PHASE.ACTION, t: 'Your gun', tips: [
      'Aiming in gives tighter shots and a wider view.',
      'A headshot (crosshair on the head) is an instant kill.',
      `${K('melee')} is melee, ${K('ability')} your operator's skill, ${K('gadget')} your gadget.`],
    goals: [
      { t: () => isTouch ? `Aim in: tap ${K('ads')}` : `Aim in: hold <b>right click</b>`, done: c => more(c, 'ads', 0.6) },
      { t: () => isTouch ? `Shoot: hold <b>FIRE</b> at a wall` : 'Shoot: <b>left click</b> a few times at a wall', done: c => more(c, 'shots', 3) },
      { t: () => `Reload: ${K('reload')}`, done: c => more(c, 'rel', 1) }] },
  { part: 0, ph: PHASE.ACTION, t: 'Break in and plant', tips: [
      'Windows start boarded and some walls are soft: shoot, melee or blow them open.',
      `Upstairs? Press ${K('interact')} at a rope coil to rappel, push toward the wall to climb, ${K('vault')} swings in.`,
      'Take down any defender you see.',
      'In a real round you guard the defuser for 45 s; here it finishes at once.'],
    goals: [
      { t: () => 'Go to the <b>marked</b> way in', done: c => indoors(c, c.view) || (() => { const p = toSite(c); return p && c.view && Math.hypot(p.x - c.view.x, p.y - c.view.y) < 3 * PX_PER_M; })(), at: c => toSite(c) },
      { t: () => `Get in: break the boards (shoot, or ${K('melee')}) or vault over with ${K('vault')}`, done: c => indoors(c, c.view), at: c => toSite(c) },
      { t: c => `Go to <b>${siteName(c)}</b>`, done: c => c.inSite, at: c => nearest(c, bombs(c)) },
      { t: () => `Plant the defuser: stand by <b>A</b> or <b>B</b> and <b>hold ${K('interact')}</b>`, done: c => !!c.s.pl, at: c => nearest(c, bombs(c)) }] },
  { part: 1, ph: PHASE.SELECT, t: 'Now you defend', go: true, tips: [
      'Sides swapped.',
      'Defenders win if time runs out, if every attacker is down, or if they disable a planted defuser.',
      'In a real match the defenders also choose which bomb pair to defend on this screen.'],
    goals: [
      { t: () => `${CLICK} a defender <b>role</b>`, done: c => !!c.me.jb || !!c.me.op },
      { t: () => `${CLICK} one of its <b>operators</b>`, done: c => !!c.me.op }] },
  { part: 1, ph: PHASE.PREP, t: 'Fortify', go: true, tips: [
      'In preparation defenders must stay inside the building.',
      'Reinforced walls stop bullets and most breaching. Your team shares 10.',
      'Barricades block walking and sight but break easily: the noise warns you.',
      'An attacker\'s drone on a camera is a good find: shoot drones you see.'],
    goals: [
      { t: c => `Go to <b>${siteName(c)}</b>`, done: c => c.inSite, at: c => nearest(c, bombs(c)) },
      { t: () => `Reinforce the <b>marked</b> wall: face it and <b>hold ${K('interact')}</b>`, done: c => more(c, 'reinf', 1), at: c => nearest(c, softWalls(c)) },
      { t: () => `Barricade the <b>marked</b> doorway: face it and <b>hold ${K('interact')}</b>`, done: c => more(c, 'barri', 1), at: c => nearest(c, openDoors(c)) },
      { t: () => `Open the cameras: ${K('view')}`, done: c => more(c, 'cam', 1) },
      { t: () => `Flip to another camera: ${isTouch ? '<kbd>◀</kbd> / <kbd>▶</kbd>' : `${K('leanL')} / ${K('leanR')} or the wheel`}`, done: c => more(c, 'flip', 1) },
      { t: () => isTouch ? `Point at something and press ${K('spot')} to ping it` : '<b>Click</b> something on the camera to ping it', done: c => more(c, 'feedPings', 1) },
      { t: () => `Back to your body: ${K('view')}`, done: c => c.me.ct === 'body' }] },
  { part: 1, ph: PHASE.ACTION, t: 'Hold the site', tips: [
      'Listen: footsteps and shots come from their side of you, muffled through walls.',
      '"▲ ABOVE" / "▼ BELOW" means a sound on another floor.',
      `Ping attackers you see (${K('spot')}) so your team knows.`],
    goals: [
      { t: c => `Stand by the objective in <b>${siteName(c)}</b>`, done: c => c.inSite, at: c => nearest(c, bombs(c)) },
      { t: () => `Crouch (${K('crouch')}) looking at a way in, and wait`, done: c => more(c, 'cr', 2) },
      { t: () => 'Two attackers are coming: <b>take both down</b>', done: () => false }] },
];
// one flat list of goals, each knowing its stage
const GOALS = STAGES.flatMap((S, si) => S.goals.map((g, gi) => ({ ...g, S, si, gi })));
const keyOf = S => S.part * 3 + ORDER.indexOf(S.ph);
const TIP_T = 7000;

export function createCoach({ el, send, onExit, getMap }) {
  let lesson = null, i = 0, base = null, shown = '', lastPh = null, goSent = -1, view = null, last = null, tipAt = 0, tipStage = -1, doneAt = 0;
  const ctx = (s, me) => {
    const S = site({ map: getMap(), s });
    const room = me && me.x !== undefined ? roomAt(getMap(), me.x, me.y) : null;
    return { s, me: me || {}, map: getMap(), view, ph: s.ph, part: me && me.tm === 'def' ? 1 : 0, tu: s.tu || { pings: [], n: 0 }, base: base || {}, inSite: !!(S && room && S.rooms.includes(room)) };
  };
  // counts start again at each stage (not each goal), so something done a little early still ticks its goal off
  const enter = (n, c) => { const fresh = !base || !GOALS[i] || GOALS[n].si !== GOALS[i].si || n === 0; i = n; if (fresh) base = { ...c.tu, pings: [...(c.tu.pings || [])] }; };
  function render(html) { if (html !== shown) { el.innerHTML = html; shown = html; } }
  const place = ph => { el.classList.toggle('sel', ph === PHASE.SELECT); el.classList.remove('center', 'task'); };
  const sendGo = () => send({ t: 'tut', a: 'go' });

  return {
    get active() { return !!lesson; },
    get blocking() { return false; }, // nothing to dismiss any more (he asked 2026-11-24): the game is never covered
    setView(v) { view = v; },
    // where the marker goes now (world px, with a word to show), or null
    target() {
      if (!lesson || !last || !getMap()) return null;
      const g = GOALS[i], c = ctx(last.s, last.me);
      if (!g || !g.at || keyOf(g.S) !== c.part * 3 + ORDER.indexOf(c.ph)) return null;
      try { return g.at(c); } catch { return null; }
    },
    start(l) { lesson = l; i = 0; base = null; shown = ''; lastPh = null; goSent = -1; tipStage = -1; el.classList.remove('hidden'); document.documentElement.classList.add('tutorial'); },
    stop() { lesson = null; document.documentElement.classList.remove('tutorial'); el.classList.remove('center', 'task', 'end'); el.classList.add('hidden'); el.innerHTML = ''; shown = ''; },
    // Space (or the SKIP button): skip the goal in operator select and preparation; in the action Space is vault, except
    // on the last goal, where it ends the tutorial
    space(s) {
      if (!lesson || !s || s.ph === PHASE.ROUND_END) return false;
      const g = GOALS[i]; if (!g) return false;
      if (i === GOALS.length - 1 && s.ph === PHASE.ACTION) { send({ t: 'tut', a: 'finish' }); return true; }
      if (s.ph === PHASE.ACTION && !isTouch) return false;
      const c = ctx(s, last && last.me);
      if (g.S.go && GOALS[i + 1] && GOALS[i + 1].S !== g.S && goSent !== g.si && s.ph === g.S.ph) { goSent = g.si; sendGo(); } // skipped the stage's last goal: on to the next phase
      if (i < GOALS.length - 1) enter(i + 1, c);
      return true;
    },
    update(s, me) {
      if (!lesson || !s || !s.tu) return;
      last = { s, me };
      const c = ctx(s, me);
      if (!base) enter(0, c);
      place(s.ph);
      if (s.ph === PHASE.ROUND_END) {
        el.classList.add('end');
        if (c.part === 0) { lastPh = s.ph; render(`<div class="cHead">TUTORIAL</div><div class="cTitle">ROUND WON</div><div class="cBody">Nice. The sides swap now: next round you <b>defend</b>.</div>`); return; }
        if (lastPh !== PHASE.ROUND_END) document.exitPointerLock && document.exitPointerLock();
        lastPh = s.ph;
        render(`<div class="cHead">TUTORIAL</div><div class="cTitle">TUTORIAL COMPLETE</div>
          <div class="cBody">That's the game. <b>Information wins rounds</b>: drone and watch cameras before you commit,
          move quietly, and ping everything your team needs to know. Try <b>Free Play</b> to practise any operator, and
          <b>Map Knowledge</b> to learn the maps.</div>
          <div class="cBtns"><button data-c="retry">GO AGAIN</button><button data-c="exit" class="primary">MAIN MENU</button></div>`);
        for (const b of el.querySelectorAll('[data-c]')) b.onclick = () => {
          if (b.dataset.c === 'exit') return onExit();
          this.start(lesson); send({ t: 'tut', a: 'start', lesson });
        };
        return;
      }
      el.classList.remove('end');
      lastPh = s.ph;
      const now = c.part * 3 + ORDER.indexOf(s.ph);
      // catch up with the match: skip goals of a phase that is already over
      while (i < GOALS.length - 1 && keyOf(GOALS[i].S) < now) enter(i + 1, c);
      // tick off every goal that is already done (several at once if you did them early)
      let g = GOALS[i];
      while (keyOf(g.S) === now && i < GOALS.length - 1 && g.done(c)) {
        const nx = GOALS[i + 1]; doneAt = performance.now();
        // the stage's last goal done in a 'go' stage: start the next phase (operator select, preparation)
        if (g.S.go && nx.S !== g.S && goSent !== g.si) { goSent = g.si; sendGo(); }
        enter(i + 1, c); g = GOALS[i];
      }
      if (keyOf(g.S) !== now) { // waiting for the server to move to the next phase
        render(`<div class="cHead">TUTORIAL · ${c.part ? 'DEFENDING' : 'ATTACKING'}</div><div class="cTitle">${s.ph === PHASE.PREP ? 'GET READY' : 'NICE'}</div><div class="cNow">${s.ph === PHASE.PREP ? 'The action phase is starting: you are back in your body.' : 'On to the next part…'}</div>`);
        return;
      }
      const S = g.S, t = performance.now();
      if (tipStage !== g.si) { tipStage = g.si; tipAt = t; }
      const tip = S.tips[Math.floor((t - tipAt) / TIP_T) % S.tips.length];
      const n = GOALS.length, skip = s.ph === PHASE.ACTION ? (i === n - 1 ? (isTouch ? '<button data-skip>FINISH</button>' : '<kbd>SPACE</kbd> finish the tutorial') : '') : isTouch ? '<button data-skip>SKIP</button>' : '<kbd>SPACE</kbd> skip';
      const list = S.goals.map((q, k) => `<li class="${k < g.gi ? 'ok' : k === g.gi ? 'on' : ''}">${k < g.gi ? '✓' : k === g.gi ? '▸' : '·'} ${q.t(c)}</li>`).join('');
      render(`<div class="cHead">TUTORIAL · ${c.part ? 'DEFENDING' : 'ATTACKING'}<span>${i + 1} / ${n}</span></div>
        <div class="cDots"><i style="width:${Math.round(i / (n - 1) * 100)}%"></i></div>
        <div class="cTitle">${S.t}</div>
        <ul class="cList">${list}</ul>
        <div class="cTip">${tip}</div>
        ${skip ? `<div class="cFoot">${skip}</div>` : ''}`);
      el.classList.toggle('pop', t - doneAt < 500);
    },
  };
}
