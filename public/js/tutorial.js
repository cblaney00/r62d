// The tutorial (he asked: one quick run, under 4 minutes, the whole rundown of how to play, bots that never shoot):
// a private match on Harbor Office against two bots. Round 1 you attack (pick, drone, ping, move, break in, plant),
// then the sides swap and round 2 you defend (reinforce, barricade, cameras, hold and take the attackers down).
// A coach box walks you through it one step at a time; a step finishes when you have done what it asks (or you
// press Space to skip it). The server holds the operator-select and preparation clocks while the coach talks
// (game.js tutAction), ends the plant quickly and stops after round 2.
import { PHASE } from '/shared/constants.js';
import { roomAt } from '/shared/map.js';
import { OPERATORS, JOBS } from '/shared/operators.js';
import { keyName, bindsFor } from './keys.js';

const ORDER = [PHASE.SELECT, PHASE.PREP, PHASE.ACTION];
const K = id => `<kbd>${keyName(bindsFor(id)[0])}</kbd>`;
const roles = team => JOBS[team].map(j => `<li><b>${j.name}</b> — ${j.ops.map(o => OPERATORS[o].name).join(', ')}</li>`).join('');
const PICK = '<b>Click a role on the left, then one of its operators.</b>';
const siteName = c => c.map && c.map.sites[c.s.site] ? c.map.sites[c.s.site].name : 'the objective';

// Each step: part (0 = attacking round, 1 = defending round), phase, what the coach says, and when it is done.
// cont: Space just continues. go: Space (or finishing) tells the server to start the next phase.
const STEPS = [
  { part: 0, ph: PHASE.SELECT, cont: true, t: 'How R62D works', b: () => `
    Two teams of five. A match is <b>first to 3 rounds</b> and the sides swap every round. Each round has three phases:
    <ol><li><b>Operator select</b> — pick who you play.</li>
    <li><b>Preparation</b> (40 s) — attackers scout with drones, defenders fortify.</li>
    <li><b>Action</b> (3 min) — attackers break in and plant the <b>defuser</b> at bomb A or B; defenders stop them.</li></ol>
    This run takes about 4 minutes: you attack one round, then defend one. The enemy bots here never shoot.` },
  { part: 0, ph: PHASE.SELECT, t: 'Pick an attacker', b: () => `Each round you choose a <b>role</b>, then an operator from it:
    <ul>${roles('atk')}</ul>${PICK}`, done: c => !!c.me.op, go: true },
  { part: 0, ph: PHASE.PREP, t: 'Find the objective with your drone', b: c => `
    You are driving a <b>drone</b>. Drive it (${K('up')}${K('left')}${K('down')}${K('right')}, hold ${K('walk')} for a short sprint)
    into the building — it fits through the small <b>drone holes</b> at the foot of walls. The objective is
    <b>${siteName(c)}</b>: get it on your screen until the yellow <b>A</b> and <b>B</b> markers appear.`, done: c => !!c.s.rev },
  { part: 0, ph: PHASE.PREP, t: 'Ping it for your team', b: () => `
    Point at a bomb marker (or an enemy, a door, anything) and press ${K('spot')} or click. Your team sees a marker and a chat line.`,
    done: c => c.tu.n > c.base.n },
  { part: 0, ph: PHASE.PREP, go: true, t: 'Into action', b: () => `
    When the action phase starts you are back in your body at the spawn.<br><br><b>Press <kbd>SPACE</kbd> to start.</b>`,
    done: c => c.ph === PHASE.ACTION },
  { part: 0, ph: PHASE.ACTION, cont: true, t: 'Moving and shooting', b: () => `
    ${K('up')}${K('left')}${K('down')}${K('right')} runs (loud). Hold ${K('walk')} to walk and ${K('crouch')} to crouch: both silent and
    more accurate. Move the mouse to aim, <b>left click</b> to shoot, <b>right click</b> to aim in (tighter shots, wider view).
    The first shot goes exactly on the crosshair once you stand still. ${K('interact')} uses things, ${K('melee')} is melee,
    ${K('ability')} your operator's skill and ${K('gadget')} your gadget.<br><br><b>Press <kbd>SPACE</kbd> when you've tried it.</b>` },
  { part: 0, ph: PHASE.ACTION, t: 'Break in', b: c => `
    Go to <b>${siteName(c)}</b> (follow the yellow markers). Windows start boarded and some walls are soft: shoot,
    melee (${K('melee')}) or blow them open, or <b>vault</b> a low wall or open window with ${K('vault')}. Upstairs?
    Attackers can <b>rappel</b>: press ${K('interact')} at a rope coil under a window. Take down any defender you see —
    a headshot (crosshair on the head) is an instant kill.`, done: c => c.inSite },
  { part: 0, ph: PHASE.ACTION, t: 'Plant the defuser', b: () => `
    You carry the <b>defuser</b>. Stand next to bomb <b>A</b> or <b>B</b> and <b>hold ${K('interact')}</b> until it is planted.
    In a real round you then guard it for 45 s; here it finishes at once.`, done: c => !!c.s.pl },
  { part: 1, ph: PHASE.SELECT, cont: true, t: 'Now you defend', b: () => `
    Sides swapped. Defenders win if time runs out, if every attacker is down, or if they disable a planted defuser.
    In a real match the defenders also choose which bomb pair to defend on this screen.` },
  { part: 1, ph: PHASE.SELECT, t: 'Pick a defender', b: () => `<ul>${roles('def')}</ul>${PICK}`, done: c => !!c.me.op, go: true },
  { part: 1, ph: PHASE.PREP, t: 'Reinforce a wall', b: c => `
    Go to <b>${siteName(c)}</b>, face one of its <b>soft walls</b> and <b>hold ${K('interact')}</b>. Reinforced walls stop bullets
    and most breaching. Your team shares 10.`, done: c => c.tu.reinf > c.base.reinf },
  { part: 1, ph: PHASE.PREP, t: 'Barricade a doorway', b: () => `
    Face an <b>open doorway</b> and <b>hold ${K('interact')}</b> (you have 3 a round). Barricades block walking and sight,
    but break easily — the noise warns you someone is coming.`, done: c => c.tu.barri > c.base.barri },
  { part: 1, ph: PHASE.PREP, t: 'Watch the cameras', b: () => `
    Press ${K('view')} for the cameras; ${K('left')} / ${K('right')} or the wheel flip through them. <b>Click something to ping it</b>
    for your team (an attacker's drone is a good find — shoot drones you see). ${K('view')} again to leave.`,
    done: c => c.tu.feedPings > c.base.feedPings },
  { part: 1, ph: PHASE.PREP, go: true, t: 'Ready', b: () => `<b>Press <kbd>SPACE</kbd> to start the action phase.</b>`, done: c => c.ph === PHASE.ACTION },
  { part: 1, ph: PHASE.ACTION, t: 'Hold and take them down', b: () => `
    Two attackers are coming for the objective. Pick a spot looking at a way in, crouch (${K('crouch')}) and wait.
    Orange arcs round you are <b>footsteps you hear</b>; ▲ / ▼ means another floor. Ping them (${K('spot')}) and
    <b>take both down</b>.`,
    done: () => false },
];
const keyOf = st => st.part * 3 + ORDER.indexOf(st.ph);

export function createCoach({ el, send, onExit, getMap }) {
  let lesson = null, i = 0, base = null, shown = '', lastPh = null;
  const steps = STEPS;
  const ctx = (s, me) => {
    const site = getMap() && getMap().sites[s.site];
    const room = me && me.x !== undefined ? roomAt(getMap(), me.x, me.y) : null;
    return { s, me: me || {}, map: getMap(), ph: s.ph, part: me && me.tm === 'def' ? 1 : 0, tu: s.tu || { pings: [], n: 0, reinf: 0, barri: 0, feedPings: 0 }, base: base || {}, inSite: !!(site && room && site.rooms.includes(room)) };
  };
  const enter = (n, c) => { i = n; base = { ...c.tu, pings: [...c.tu.pings] }; };
  function render(html) { if (html !== shown) { el.innerHTML = html; shown = html; } }
  const place = ph => el.classList.toggle('sel', ph === PHASE.SELECT); // out of the way of the operator cards

  return {
    get active() { return !!lesson; },
    start(l) { lesson = l; i = 0; base = null; shown = ''; lastPh = null; el.classList.remove('hidden'); },
    stop() { lesson = null; el.classList.add('hidden'); el.innerHTML = ''; shown = ''; },
    // Space: continue an info step, start the next phase on a 'go' step, otherwise skip the step
    space(s) {
      if (!lesson || !s) return false;
      const st = steps[i];
      if (!st || s.ph === PHASE.ROUND_END) return false;
      if (i === steps.length - 1 && s.ph === PHASE.ACTION) { send({ t: 'tut', a: 'finish' }); return true; } // the last step: Space ends it
      if (s.ph === PHASE.ACTION && !st.cont) return false; // in the action Space is vault: steps there finish by doing them
      if (st.go && s.ph === st.ph) send({ t: 'tut', a: 'go' });
      if (!(st.go && st.ph === PHASE.PREP)) { const c = ctx(s, null); enter(Math.min(i + 1, steps.length - 1), c); }
      return true;
    },
    update(s, me) {
      if (!lesson || !s || !s.tu) return;
      const c = ctx(s, me);
      if (!base) enter(0, c);
      place(s.ph);
      if (s.ph === PHASE.ROUND_END) {
        if (c.part === 0) { lastPh = s.ph; render(`<div class="cHead">TUTORIAL</div><div class="cTitle">ROUND WON</div><div class="cBody">Nice. The sides swap now: next round you <b>defend</b>.</div>`); return; }
        if (lastPh !== PHASE.ROUND_END) document.exitPointerLock && document.exitPointerLock();
        lastPh = s.ph;
        render(`<div class="cHead">TUTORIAL</div><div class="cTitle">TUTORIAL COMPLETE</div>
          <div class="cBody">That's the game. Remember: <b>information wins rounds</b> — drone and watch cameras before you commit,
          move quietly, and ping everything your team needs to know. Try <b>Free Play</b> to practise any operator, and
          <b>Map Knowledge</b> to learn the maps.</div>
          <div class="cBtns"><button data-c="retry">GO AGAIN</button><button data-c="exit" class="primary">MAIN MENU</button></div>`);
        for (const b of el.querySelectorAll('[data-c]')) b.onclick = () => {
          if (b.dataset.c === 'exit') return onExit();
          this.start(lesson); send({ t: 'tut', a: 'start', lesson });
        };
        return;
      }
      lastPh = s.ph;
      const now = c.part * 3 + ORDER.indexOf(s.ph);
      // catch up with the match: skip steps of a phase that is already over
      while (i < steps.length - 1 && keyOf(steps[i]) < now) enter(i + 1, c);
      let st = steps[i];
      if (keyOf(st) === now && st.done && st.done(c)) {
        if (st.go && s.ph === PHASE.SELECT) send({ t: 'tut', a: 'go' });
        if (i < steps.length - 1) { enter(i + 1, c); st = steps[i]; }
      }
      if (keyOf(st) !== now) { render(`<div class="cHead">TUTORIAL</div><div class="cBody">…</div>`); return; }
      const n = steps.length, hint = st.cont ? 'continue' : st.go && st.ph === PHASE.PREP ? 'start the action phase' : i === n - 1 ? 'finish the tutorial' : s.ph === PHASE.ACTION ? '' : 'skip this step';
      render(`<div class="cHead">TUTORIAL · ${c.part ? 'DEFENDING' : 'ATTACKING'}<span>STEP ${i + 1} / ${n}</span></div>
        <div class="cDots">${steps.map((_, k) => `<i class="${k < i ? 'd' : k === i ? 'on' : ''}"></i>`).join('')}</div>
        <div class="cTitle">${st.t}</div><div class="cBody">${st.b(c)}</div>
        <div class="cFoot">${hint ? `<kbd>SPACE</kbd> ${hint} · ` : ''}<kbd>ESC</kbd> menu</div>`);
    },
  };
}
