// The tutorial: two playable lessons (attacking, defending) in a private match against two
// slow bots. A coach box walks you through each phase one step at a time; a step finishes
// when you have done what it asks (or you press Space to skip it). The server holds the
// operator-select and preparation clocks while the coach talks (game.js tutAction).
import { PHASE } from '/shared/constants.js';
import { roomAt } from '/shared/map.js';
import { OPERATORS, JOBS } from '/shared/operators.js';
import { keyName, bindsFor } from './keys.js';

const ORDER = [PHASE.SELECT, PHASE.PREP, PHASE.ACTION];
const K = id => `<kbd>${keyName(bindsFor(id)[0])}</kbd>`;
const roles = team => JOBS[team].map(j => `<li><b>${j.name}</b> — ${j.desc} ${j.ops.map(o => OPERATORS[o].name).join(', ')}</li>`).join('');
const PICK = '<b>Click a role at the top, then one of its operators.</b>';
const pingList = tu => tu.pings.length ? `<div class="cPings">${tu.pings.map(w => `<span>${w}</span>`).join('')}</div>` : '';

// Each step: when it applies (phase), what the coach says, and when it is done.
// cont: Space just continues. go: Space (or finishing) tells the server to start the next phase.
const LESSONS = {
  atk: {
    name: 'ATTACKING', next: 'def',
    steps: [
      { ph: PHASE.SELECT, cont: true, t: 'How a round works', b: () => `
        A match is first to 3 rounds and the sides swap every round. Every round has three phases:
        <ol><li><b>Operator select</b> — pick who you play. Defenders also choose which objective to defend.</li>
        <li><b>Preparation</b> (40 s) — attackers scout with drones, defenders fortify the objective.</li>
        <li><b>Action</b> (3 min) — attackers break in and plant the defuser; defenders stop them.</li></ol>
        In this lesson you <b>attack</b>. The clock is paused for you while you learn.` },
      { ph: PHASE.SELECT, t: 'Pick a role', b: () => `
        Every round you choose a <b>role</b>, then one of its operators. A good team mixes roles:
        <ul>${roles('atk')}</ul>
        ${PICK}`, done: c => !!c.me.op, go: true },
      { ph: PHASE.PREP, t: 'Information wins rounds', b: () => `
        You are driving a <b>drone</b>: small, quiet, and it costs you nothing to lose. Every defender you find now
        is one who can't surprise you later.<br><br>
        Drive it (${K('up')}${K('left')}${K('down')}${K('right')}) into the building. Drones fit through the
        little <b>drone holes</b> at the bottom of walls. <b>Find the objective</b> — the room with the yellow
        <b>A</b> and <b>B</b> markers.<br><small>If a defender shoots your drone, press ${K('view')} to throw a spare.</small>`,
        done: c => !!c.s.rev },
      { ph: PHASE.PREP, t: 'Ping it', b: () => `
        Found it! Now tell your team. <b>Point at something and press ${K('spot')}</b> (or middle-click; in a drone or
        camera a left click works too). Your team gets a marker with a name and a line in team chat
        saying what it is and which room it's in.`, done: c => c.tu.n > c.base.n },
      { ph: PHASE.PREP, t: 'Ping anything', b: c => `
        You can ping almost anything: an <b>enemy</b>, a <b>camera</b>, a <b>trap</b>, a <b>door</b> or
        <b>window</b>, a <b>reinforced wall</b>, a <b>barricade</b>, a <b>drone hole</b>, the <b>objective</b>,
        or just a spot on the floor (<b>GO HERE</b>). <b>Ping 3 different kinds of things.</b>${pingList(c.tu)}`,
        done: c => c.tu.pings.length >= 3 },
      { ph: PHASE.PREP, t: 'Spot a defender', b: () => `
        The most useful ping of all: an <b>enemy</b>. Find a defender with your drone and ping them
        (${K('spot')} with them under your aim). They glow red for your whole team for 5 seconds.`,
        done: c => c.tu.pings.some(w => w.startsWith('ENEMY')) },
      { ph: PHASE.PREP, go: true, t: 'Ready to go in', b: () => `
        When the action phase starts, your drone stays where it is and you are back at the spawn with your gun.
        Your pings stay on the map for a few seconds, so ping the objective again just before you leave it.<br><br>
        <b>Press <kbd>SPACE</kbd> to start the action phase.</b>`, done: c => c.ph === PHASE.ACTION },
      { ph: PHASE.ACTION, t: 'Move in quietly', b: () => `
        Running is loud and ruins your aim. Hold ${K('walk')} to walk silently and ${K('crouch')} to crouch
        (quiet and most accurate). Stop before you shoot.<br><br>
        <b>Head into the objective room.</b> Soft walls and barricades break: shoot them, use melee (${K('melee')})
        or your skill (${K('ability')}). Defenders can hear you breaking things — that is information for <i>them</i>.`,
        done: c => c.inSite },
      { ph: PHASE.ACTION, t: 'Plant the defuser', b: () => `
        You carry the <b>defuser</b>. Stand next to bomb <b>A</b> or <b>B</b> and <b>hold ${K('interact')}</b>
        for 7 seconds. Check the corners first — planting leaves you open.`, done: c => !!c.s.pl },
      { ph: PHASE.ACTION, t: 'Hold the plant', b: () => `
        Planted! Now the defenders have to come to <i>you</i> to disable it. Find cover that looks at the
        defuser and wait. You win when it goes off (45 s) or when every defender is down.`, done: () => false },
    ],
  },
  def: {
    name: 'DEFENDING', next: null,
    steps: [
      { ph: PHASE.SELECT, cont: true, t: 'Defending', b: () => `
        Now you <b>defend</b>. You win if time runs out before the attackers plant, if you disable their
        defuser, or if they are all down. Defenders also choose <b>which objective to defend</b> at the top of this
        screen (this lesson keeps the first one).` },
      { ph: PHASE.SELECT, t: 'Defender roles', b: () => `
        <ul>${roles('def')}</ul>
        ${PICK}`, done: c => !!c.me.op, go: true },
      { ph: PHASE.PREP, t: 'Reinforce the walls', b: c => `
        The attackers are droning you right now. First, make the room hard to break into: <b>face a soft wall of the
        objective room and hold ${K('interact')}</b>. Reinforced walls can't be shot through and stop most
        breaching. Your team shares 10. <b>Reinforce 2 walls</b> (${Math.min(2, c.tu.reinf)}/2).`,
        done: c => c.tu.reinf >= 2 },
      { ph: PHASE.PREP, t: 'Barricade a door', b: () => `
        <b>Face an open doorway or window and hold ${K('interact')}.</b> A barricade stops people walking in and
        blocks sight, but it breaks with a kick or a few shots — so it also tells you when someone is coming.`,
        done: c => c.tu.barri >= 1 },
      { ph: PHASE.PREP, t: 'Watch the cameras', b: () => `
        Press ${K('view')} to open the <b>cameras</b>. Flick through them with ${K('left')} / ${K('right')} or the
        mouse wheel. Find something worth knowing — an attacker's drone, a door, the way they'll come in — and
        <b>click on it to ping it</b> for your team. Every drone you shoot is information they don't get.`,
        done: c => c.tu.feedPings > c.base.feedPings },
      { ph: PHASE.PREP, go: true, t: 'Ready', b: () => `
        Press ${K('view')} again to leave the cameras. Good defenders keep checking cameras all round and call out
        what they see.<br><br><b>Press <kbd>SPACE</kbd> to start the action phase.</b>`, done: c => c.ph === PHASE.ACTION },
      { ph: PHASE.ACTION, t: 'Hold an angle', b: () => `
        Pick a spot that looks at a door they must come through, crouch (${K('crouch')}) and wait. Orange arcs
        around you are <b>footsteps you can hear</b> — that's where they are. Ping attackers you see (${K('spot')}).<br><br>
        If they plant, <b>stand on the defuser and hold ${K('interact')}</b> to disable it.`, done: () => false },
    ],
  },
};

export function createCoach({ el, send, onExit, getMap }) {
  let lesson = null, i = 0, base = null, shown = '', lastPh = null;
  const L = () => LESSONS[lesson];
  const ctx = (s, me) => {
    const site = getMap() && getMap().sites[s.site];
    const room = me && me.x !== undefined ? roomAt(getMap(), me.x, me.y) : null;
    return { s, me: me || {}, ph: s.ph, tu: s.tu || { pings: [], n: 0, reinf: 0, barri: 0, feedPings: 0 }, base: base || {}, inSite: !!(site && room && site.rooms.includes(room)) };
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
      const st = L().steps[i];
      if (!st || s.ph === PHASE.ROUND_END) return false;
      if (st.go && s.ph === st.ph) send({ t: 'tut', a: 'go' });
      if (!(st.go && st.ph === PHASE.PREP)) { const c = ctx(s, null); enter(Math.min(i + 1, L().steps.length - 1), c); }
      return true;
    },
    update(s, me) {
      if (!lesson || !s || !s.tu) return;
      const c = ctx(s, me), steps = L().steps;
      if (!base) enter(0, c);
      place(s.ph);
      if (s.ph === PHASE.ROUND_END) {
        if (lastPh !== PHASE.ROUND_END) document.exitPointerLock && document.exitPointerLock();
        lastPh = s.ph;
        const won = me && s.win === me.sq, nx = L().next;
        render(`<div class="cHead">TUTORIAL · ${L().name}</div>
          <div class="cTitle">${won ? 'LESSON COMPLETE' : 'ROUND LOST'}</div>
          <div class="cBody">${won ? 'Well done. Remember: <b>information wins rounds</b> — drone and watch cameras before you commit, and ping everything your team needs to know.' : 'No problem — that is how everyone learns. Try it again: use your drone or cameras first, and move slowly.'}</div>
          <div class="cBtns"><button data-c="retry">TRY AGAIN</button>${nx ? `<button data-c="next" class="primary">NEXT LESSON: ${LESSONS[nx].name}</button>` : ''}<button data-c="exit">MAIN MENU</button></div>`);
        for (const b of el.querySelectorAll('[data-c]')) b.onclick = () => {
          if (b.dataset.c === 'exit') return onExit();
          const l = b.dataset.c === 'next' ? nx : lesson; this.start(l);
          send({ t: 'tut', a: b.dataset.c === 'next' ? 'start' : 'retry', lesson: l });
        };
        return;
      }
      lastPh = s.ph;
      // catch up with the match: skip steps of a phase that is already over
      while (i < steps.length - 1 && ORDER.indexOf(steps[i].ph) < ORDER.indexOf(s.ph)) enter(i + 1, c);
      let st = steps[i];
      if (st.ph === s.ph && st.done && st.done(c)) {
        if (st.go && s.ph === PHASE.SELECT) send({ t: 'tut', a: 'go' });
        if (i < steps.length - 1) { enter(i + 1, c); st = steps[i]; }
      }
      if (st.ph !== s.ph) { render(`<div class="cHead">TUTORIAL · ${L().name}</div><div class="cBody">…</div>`); return; }
      const n = steps.length, hint = st.cont ? 'continue' : st.go && st.ph === PHASE.PREP ? 'start the action phase' : 'skip this step';
      render(`<div class="cHead">TUTORIAL · ${L().name}<span>STEP ${i + 1} / ${n}</span></div>
        <div class="cDots">${steps.map((_, k) => `<i class="${k < i ? 'd' : k === i ? 'on' : ''}"></i>`).join('')}</div>
        <div class="cTitle">${st.t}</div><div class="cBody">${st.b(c)}</div>
        <div class="cFoot"><kbd>SPACE</kbd> ${hint} · <kbd>ESC</kbd> menu</div>`);
    },
  };
}
