// What bots and casters say out loud (he asked: realistic voices, many ways of saying everything, not constant chatter).
// Server and browser share this: the server picks a line and sends its parts, the browser plays the recordings in
// public/voice/<speaker>/<clip>.ogg, made from this file by tools/voice (see docs/voice.md). Change a line here = run
// that again. {slot}s are recorded separately (operators, rooms, names...) and joined on to the line.

// VCTK speakers: [speaker, 'm'/'f', pace (<1 quicker)]. Young adults, many accents.
export const SPEAKERS = {
  p237: ['m', 1.02], // Scottish, Fife
  p360: ['m', 0.98], // American, New Jersey
  p243: ['m', 1.0], // English, London
  p297: ['f', 0.97], // American, New York
  p340: ['f', 0.98], // Irish, Dublin
  p314: ['f', 1.0], // South African, Cape Town
  p245: ['m', 0.98], // Irish, Dublin
  p326: ['m', 1.0], // Australian, Sydney
  p345: ['m', 1.03], // American, Florida
  p303: ['f', 1.0], // Canadian, Toronto
  p298: ['m', 0.97], // Irish, Tipperary
  p363: ['m', 1.02], // Canadian, Toronto
  p334: ['m', 0.99], // American, Chicago
  p226: ['m', 1.0], // English, Surrey
  p304: ['m', 1.0], // Northern Irish, Belfast (caster)
  p300: ['f', 1.0], // American, Ohio (caster)
};
export const PRO_VOICE = { Halden: 'p237', Kaze: 'p360', Brick: 'p243', Moth: 'p297', Juno: 'p340', Sable: 'p314', Torvi: 'p245', Pax: 'p326', Grit: 'p345', Wisp: 'p303' };
export const BOT_VOICES = ['p298', 'p363', 'p303', 'p334', 'p226', 'p340', 'p243', 'p345', 'p314', 'p326'];
export const CASTER_VOICE = ['p304', 'p300']; // play-by-play, analyst

// How a line is delivered: speed (ls, lower is faster), how wide the pitch swings (k), how high it sits (up).
export const TONES = {
  urgent: { ls: 0.92, k: 1.9, up: 1.12 },
  mid: { ls: 1.05, k: 1.6, up: 1.04 },
  calm: { ls: 1.18, k: 1.5, up: 1.0 },
  hype: { ls: 1.0, k: 2.0, up: 1.1 },
  desk: { ls: 1.2, k: 1.7, up: 1.0 },
};

// A line starting "m:" is only for the men's voices (he said the women's "go, go, go" sounds horrible).
const T = (tone, prio, lines) => ({ tone, prio, lines });
export const FUN = { see: 'seeFun', seeMany: 'seeFun', seeLow: 'seeFun', dead: 'deadFun', got: 'gotFun', gotLast: 'gotFun', low: 'lowFun', plant: 'plantFun', hush: 'hushFun', nt: 'ntFun' };
export const LINES = {
  see: T('urgent', false, ['{op}, {place}!', '{op} in {place}!', 'Got {op}, {place}!', 'Eyes on {op}, {place}.', 'I see {op} in {place}!', 'Contact, {op}, {place}!', 'Yep, {op}, {place}.', 'That\'s {op} in {place}!', '{place}, {op} there!', 'Spotted {op}, {place}.']),
  seeMany: T('urgent', false, ['Two on me, {place}!', 'There\'s more than one in {place}!', '{op} and another, {place}!', 'Multiple, {place}, careful!', 'They\'re stacked in {place}!', 'Two of them, {place}, watch it!']),
  seeLow: T('urgent', false, ['{op}\'s low, {place}!', '{op} is one shot, {place}!', 'Weak, {op}, {place}!', 'Finish {op}, {place}, one shot!', 'Tagged {op}, {place}, nearly dead!', '{op} is hurt, {place}!']),
  scanHit: T('urgent', false, ['Heartbeat, {place}.', 'Scanner has one, {place}.', 'Got a heartbeat, {place}.', 'Someone close, {place}.', 'Pulse on one, {place}, not exact.']),
  cam: T('mid', false, ['Cam has {op} in {place}.', 'On camera, {op}, {place}.', '{op} on cam, {place}.', 'Camera\'s got {op}, {place}.', 'I can see {op} on cam, {place}.', 'Cam shows {op} going {place}.']),
  drone: T('calm', false, ['Drone\'s got {op} in {place}.', 'Okay, {op}, {place}, on my drone.', '{op} in {place}, from the drone.', 'I see {op} on the drone, {place}.', 'Yeah, drone sees {op}, {place}.', 'One in {place}, it\'s {op}.', 'So {op} is sitting in {place}.']),
  heard: T('mid', false, ['Footsteps, {place}.', 'I can hear someone in {place}.', 'Someone\'s moving, {place}.', 'Steps in {place}.', 'Heard something, {place}.', 'Somebody\'s walking in {place}.', 'I think there\'s one in {place}.', 'Sounds like {place}.']),
  heardFloor: T('mid', false, ['Hearing them on another floor.', 'They\'re above or below me.', 'Someone\'s on the floor above.', 'Footsteps upstairs or down, not sure.', 'I can hear them through the floor.', 'Something on another floor.']),
  low: T('urgent', true, ['I\'m one shot!', 'I\'m low, I\'m low!', 'One shot, I\'m one!', 'Ah, I\'m really low!', 'I\'m hit bad!', 'Nearly dead here!', 'I can\'t take another one!', 'One more and I\'m gone!']),
  plant: T('mid', true, ['Planting, cover me.', 'Okay, I\'m planting, watch me.', 'Going down for the plant.', 'I\'m on the plant, cover.', 'Planting now, stay with me.', 'Starting the plant, watch my back.', 'Defuser going down, cover me.']),
  defuse: T('urgent', true, ['Defusing, cover me!', 'I\'m on it, cover me!', 'Disabling it, watch my back!', 'Tapping it, cover!', 'I\'m on the defuser, keep them off me!', 'Stopping it now, cover me!']),
  stun: T('urgent', false, ['Stun out!', 'Flash going in!', 'Stun, look away!', 'Throwing stun!', 'Stun\'s going!', 'Popping a stun!']),
  smoke: T('mid', false, ['Smoking the door.', 'Smoke going down.', 'Smoke\'s out.', 'Putting smoke on it.', 'Smoke\'s up, use it.', 'Covering that with smoke.']),
  quiet: T('calm', false, ['{place} is quiet.', 'Nothing in {place}.', 'It\'s dead over here, {place}.', 'All quiet, {place}.', 'Nobody in {place} yet.', 'Yeah, {place}\'s clear so far.', 'No one here, {place}.']),
  dead: T('mid', true, ['Dead, {op}, {place}.', '{op} got me, {place}.', 'Ah, I\'m dead, {op} in {place}.', 'That was {op}, {place}.', 'Dead. {op}, {place}, sorry.', 'Got me from {place}, it\'s {op}.', 'Damn, {op}, {place}.', 'Sorry, {op}, {place}, still there.', 'I\'m down, {op} in {place}.']),
  got: T('urgent', true, ['Got {op}!', '{op} is dead!', 'Got em, {op}!', 'Nice, {op} down!', 'Yes! {op}\'s gone!', 'That\'s {op} done.', 'Dropped {op}!', 'One down, {op}.', 'Killed {op}.', 'Okay, {op}\'s dead.']),
  gotLast: T('urgent', true, ['Got {op}, one left!', '{op} down, last one!', 'One left, it\'s not {op}!', '{op} is dead, one more!', 'Last guy now, {op}\'s gone!', 'Just one left, got {op}!']),
  plan: T('calm', true, ['Okay, we\'re running {plan}.', 'Let\'s do {plan} this round.', '{plan}, everyone.', 'Right, {plan}, play it slow.', 'This round is {plan}.', 'Okay team, {plan}.', 'Let\'s try {plan}.', 'Same idea, {plan}, stay together.']),
  go: T('urgent', true, ['m:Go, go, go!', 'Okay, go now!', 'That\'s the go, move!', 'Let\'s go, let\'s go!', 'Now, now, everyone in!', 'Move in, now!', 'Okay, we\'re going!', 'Three, two, one, in!', 'Now, everybody, now!']),
  goDown: T('urgent', true, ['Two down, we go now, trade each other!', 'We\'re down two, all in together!', 'Lost two, go now, stay close!', 'No more waiting, two down, go!', 'All together now, we can\'t wait!']),
  goClock: T('urgent', true, ['Running out of time, go now!', 'Clock, clock, we have to go!', 'No time, everyone in!', 'Time\'s nearly gone, move!', 'We\'re out of time, go!', 'Come on, the clock, go!']),
  swap: T('urgent', true, ['They\'re stacked on our door, switch!', 'Change of plan, other way in!', 'Swap, swap, go the other way!', 'They know, we go through the other side!', 'Forget this door, everyone round!', 'Switch sides, six seconds!']),
  rotate: T('urgent', true, ['Rotate, they\'re hitting the {way}!', 'They\'re on the {way}, rotate!', 'Everyone to the {way}!', '{way}, {way}, rotate now!', 'They\'re coming through the {way}!', 'Get to the {way}, go!']),
  retake: T('urgent', true, ['Retake, everyone on me!', 'All in, it\'s planted, get it back!', 'It\'s down, we retake together!', 'Go for the defuser, all of us!', 'We have to tap this, come on!', 'Retake now, together!']),
  swarm: T('urgent', false, ['Swarm on my drone!', 'They\'ve got my drone, Magpie\'s close!', 'Drone\'s in trouble, swarm on it!', 'Swarm! I\'m losing the drone!', 'Magpie swarm, keep your drones back!']),
  hush: T('mid', true, ['Quiet please, I\'m listening.', 'Hold comms a sec.', 'Quiet for a second.', 'Everyone quiet, I can hear them.', 'Give me a second, listening.', 'Sorry, quiet, one sec.', 'Be quiet, be quiet.', 'Shut up real quick.']),
  // higher ranks: respectful
  nt: T('calm', false, ['Nice try.', 'Good try, unlucky.', 'That\'s alright, we\'ve got it.', 'No worries, good info.', 'Unlucky, we\'ll trade it.', 'All good, thanks for the info.']),
  mybad: T('calm', false, ['My bad, sorry.', 'Sorry team, that\'s on me.', 'My fault, I should have waited.', 'Sorry, I peeked too early.', 'That was me, sorry.']),
  nice: T('mid', false, ['Nice one.', 'Good shot.', 'Nice shot, well played.', 'Great trade.', 'Well done.', 'Good job, keep going.']),
  // Copper and Bronze (he asked: still kinda funny). A rank this low says these instead of the ordinary line.
  seeFun: T('urgent', false, ['There\'s a guy! A guy! {place}!', 'Uh, guys? {op}? In {place}? Is that bad?', 'Oh no, oh no, {op}, {place}!', 'Help! {op}! I don\'t know what to do!', 'He\'s looking right at me, {place}!', 'Wait, is {op} on our team?', 'Enemy! I think! {place}!', 'Hello? {op}! Right there! {place}!']),
  deadFun: T('mid', true, ['How? How did {op} do that?', 'What! I was reloading!', 'That was lag. That was definitely lag.', 'My mouse slipped, I swear.', 'Oh come on, {op}!', 'I was looking the wrong way, sorry, {place}.', 'I\'d like to speak to the manager of {op}.', 'Okay I\'m dead. What do I do now?', 'Was that {op}? I saw nothing.', 'My cat walked on my keyboard.']),
  gotFun: T('urgent', true, ['Wait, did I get {op}?', 'I got one! I got one!', 'Oh my god, I killed {op}!', 'Yes! Clip that! Somebody clip that!', 'Did you see that? Did anybody see that?', 'I meant to do that.', 'Ha! Get rekt, {op}!']),
  lowFun: T('urgent', true, ['I\'m dying, is that normal?', 'Who has the health thing?', 'Ow! Ow! Ow!', 'Tell my mum I tried.', 'Why does it hurt?']),
  plantFun: T('mid', true, ['Which button is plant?', 'I think I\'m planting? Is this planting?', 'Hold on, reading the screen.', 'Is the red thing the bomb?', 'Everybody look at me, I\'m planting!']),
  hushFun: T('urgent', true, ['Guys. Guys! Shut up!', 'Shut up real quick!', 'Shh shh shh shh!', 'Everyone stop talking, I can\'t hear my own feet!', 'Shut up, I heard a noise! Maybe!', 'Be quiet, be quiet, be quiet!']),
  idleFun: T('mid', false, ['Where is everyone?', 'Am I going the right way?', 'Is the drone supposed to be upside down?', 'I just shot my own camera, is that bad?', 'Why is everything grey?', 'Okay what\'s the plan? Anyone? Plan?', 'I\'m lost. Again.', 'Does anybody know what we\'re doing?', 'Sorry, my mum says dinner\'s ready.', 'Which one\'s crouch again?']),
  ntFun: T('calm', false, ['Bro, what was that?', 'You walked right into him!', 'Nice one, genius.', 'Great plan. Really great.', 'That was so bad, I love it.', 'I could have told you that would happen.']),
  ack: T('mid', true, ['Yep.', 'Okay.', 'Got it.', 'On it.', 'Sure.', 'Copy.', 'Yeah, okay.', 'Alright.']),
  no: T('mid', true, ['Can\'t right now.', 'Not yet, sorry.', 'Hang on, I\'m busy.', 'No, can\'t do it.', 'Give me a second.', 'Nah, not from here.']),
  ansEnemy: T('mid', true, ['Last I heard, {op} in {place}.', '{op}, {place}, last call.', 'We had {op} in {place}.', 'Yeah, {op} was in {place}.', 'I think {op}\'s in {place}.', 'Most recent is {op}, {place}.']),
  ansNone: T('mid', true, ['No idea, nobody\'s seen them.', 'We\'ve got nothing yet.', 'Nothing on them, sorry.', 'No info right now.', 'Haven\'t seen anyone yet.', 'I don\'t know, keep your eyes open.']),
  ansGo: T('mid', true, ['Go to {place}.', 'Head for {place}.', 'Try {place}.', 'Get over to {place}.', 'You should be in {place}.', 'We need someone in {place}.']),
  ansSite: T('mid', true, ['Site\'s {place}.', 'It\'s in {place}.', 'Objective is {place}.', 'The site is {place}.', 'We\'re playing {place}.', 'It\'s {place}, go there.']),
  ansSiteNo: T('mid', true, ['We haven\'t found it yet.', 'Still looking for it.', 'Nobody knows yet, keep droning.', 'No idea yet, sorry.', 'Don\'t know, we\'re looking.']),
  ansFollow: T('mid', true, ['Okay, I\'m with you.', 'Right behind you.', 'Yep, following.', 'Coming with you.', 'I\'ve got your back.', 'Lead the way.']),
  ansHold: T('mid', true, ['Okay, holding here.', 'I\'ll stay here.', 'Yep, holding.', 'Not moving.', 'Staying put.', 'Got this angle.']),
  ansPush: T('mid', true, ['Okay, pushing.', 'Going in.', 'Yep, moving up.', 'Pushing now.', 'Taking space.', 'On my way in.']),
  ansHelp: T('urgent', true, ['Coming!', 'On my way!', 'Hold on, coming to you!', 'Where are you? Coming!', 'Stay alive, I\'m close!', 'Two seconds, coming!']),
  ansDrop: T('mid', true, ['Okay, take over the plan.', 'Your call then.', 'Whatever you say.', 'Okay, your plan.', 'You lead, I\'ll follow.', 'Sure, you call it.']),
};

// the casters' lines: who speaks is part of the line; the analyst uses 'desk', play-by-play 'hype'
export const CAST = {
  ban: T('hype', false, ['{team} take {op} off the table.', 'And {op} is banned by {team}.', '{team} ban out {op}.', '{op} is gone, that\'s {team}\'s ban.', '{team} say no to {op}.', 'No {op} this map, says {team}.', '{op} comes out, courtesy of {team}.']),
  banWhy: T('desk', false, ['Smart. {op} has been huge on this map.', '{op} was a problem for them last time, so that makes sense.', 'That ban tells you how scared they are of {op}.', 'You can see why, {op} changes how they have to play.', 'I would have done the same with {op}.', 'A respectful ban, {op} is just that good here.', 'Interesting one, I expected {op} to stay open.']),
  kill: T('hype', false, ['{name} takes down {name2}.', '{name2} is gone, {name} with the pick.', '{name} wins that duel.', 'And {name} gets {name2}!', '{name} finds {name2}!', 'There\'s the kill for {name}.', '{name2} goes down to {name}.', 'Nice shot from {name}.', 'That\'s {name} again.', '{name} gets the better of {name2}.']),
  hs: T('hype', true, ['Headshot! {name} taps {name2}!', '{name} with the one tap on {name2}!', 'Clean headshot, {name}!', 'Right on the head, {name}!', 'Oh, what a shot from {name}!', 'One bullet, {name}, that\'s all it took!', '{name2} never saw it, headshot {name}!']),
  self: T('hype', false, ['{name} goes down on their own!', 'Oh, {name} does that to themselves!', 'That\'s an own goal from {name}.', '{name} gets caught by their own kit!']),
  tk: T('hype', true, ['Oh no, that\'s a teamkill from {name}!', '{name} hits a teammate! That hurts.', 'Friendly fire from {name}, oh dear!', 'Oh, {name} has shot their own guy!', 'That is not what {name} wanted to do!']),
  clutch: T('hype', true, ['{name} is on their own now. Can they clutch it?', 'It\'s all on {name}.', 'Everything on {name}\'s shoulders.', 'Just {name} left, here we go.', 'Last one standing, {name}.', '{name}, alone. Listen to this.', 'Now it\'s down to {name}.']),
  count: T('desk', false, ['That makes it {n} versus {n2}.', '{n} on {n2} now.', 'We\'re down to {n} versus {n2}.', '{n} against {n2} from here.']),
  plant: T('hype', true, ['The defuser is down!', 'It\'s planted! Now the defence have to come to them.', 'Defuser in! The clock is ticking.', 'They get it down!', 'Plant goes through!', 'And it\'s down, here comes the retake!', 'That\'s the plant!']),
  plantWhy: T('desk', false, ['Now watch the attackers spread out and play off the defuser.', 'The defenders have to retake now, and that is never easy.', 'Everything changes here, the attack can just wait.', 'Look for crossfires around that defuser.', 'The pressure has completely flipped.', 'Now it\'s the defence who have to make the move.']),
  end: T('hype', true, ['{team} take the round!', 'And that\'s the round for {team}.', 'Round to {team}!', '{team} get it done!', 'That one goes to {team}.', 'Another for {team}!', 'And {team} close it out!']),
  endWhy: T('desk', false, ['They earned that one.', 'The plan worked exactly how they drew it up.', 'Plenty for the other side to think about.', 'That came from the preparation, you could see it.', 'Great team play, everyone did their job.', 'They just wanted that one more.', 'Small mistakes cost a lot at this level.']),
  welcome: T('hype', true, ['Welcome to the pro league! {team} against {team2}, on {map}.', 'Good to have you with us. {team} and {team2}, on {map}.', 'Here we go, {team} versus {team2}, and we\'re on {map}.']),
  bans: T('desk', false, ['First the bans. Every pick matters after that.', 'Bans first, and this is where the match really starts.', 'Let\'s see what they take away from each other.', 'The draft can win or lose this before a shot is fired.']),
  round: T('hype', true, ['Round {n}. {team} {n2}, {team2} {n3}.', 'Into round {n}, {team} on {n2}, {team2} on {n3}.', 'Round {n} coming up. {team} {n2}, {team2} {n3}.']),
  mp: T('desk', false, ['Match point. One more round and it is over.', 'This could be the last round. Huge pressure.', 'One round from the win now.', 'They can finish it right here.', 'Everything to play for in this one.']),
  prep: T('desk', false, ['Preparation. Drones out for the attack, walls going up on the site.', 'Watch the drones here, the attack needs to find that defuser site.', 'The defenders are setting up. Reinforcements and traps first.', 'These thirty seconds decide a lot.', 'Listen to how much they talk in this phase, it all matters later.', 'See where those traps go, that will shape the round.']),
  act: T('hype', true, ['Here we go, the attack is on!', 'Action phase! Let\'s see the plan.', 'And they go!', 'Round is live!', 'Here it comes!', 'Time to see what they\'ve prepared.']),
};

// recorded separately and joined on
export const SLOT_KIND = { op: 'op', place: 'place', way: 'way', plan: 'plan', team: 'team', team2: 'team', name: 'name', name2: 'name', map: 'map', n: 'n', n2: 'n', n3: 'n' };
export const WAYS = ['door', 'stairs', 'window', 'wall', 'hatch', 'breach', 'other door', 'main door'];

export function clipId(tone, text) { // the file name of a recording
  const s = tone + '|' + text.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/ +/g, ' ').trim();
  let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
const hash = s => { let h = 7; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0; return Math.abs(h); };
// not everyone says everything: each voice has its own favourites, which keeps the recordings smaller and the people different
const SHARE = 0.6;
export function voiceHas(v, cat, i) {
  const L = (LINES[cat] || CAST[cat]).lines, line = L[i];
  if (line.startsWith('m:') && SPEAKERS[v][0] !== 'm') return false;
  if (CAST[cat] || L.length <= 4) return true;
  const first = hash(v + cat) % L.length;
  if ((i - first + L.length) % L.length < 3) return true; // always a few
  return hash(v + cat + i) % 100 < SHARE * 100;
}
export const lineText = line => line.replace(/^m:/, '');
// split a line into what is recorded with it and its slots: 'Got {op}, {place}!' → ['Got', {s:'op'}, {s:'place'}]
export function linePieces(line) {
  const out = []; for (const b of lineText(line).split(/(\{\w+\})/)) {
    const m = b.match(/^\{(\w+)\}$/);
    if (m) out.push({ s: m[1] });
    else if (/[a-z0-9]/i.test(b)) out.push(b.trim());
  }
  return out;
}
// the tone a slot's recording is made in
export const slotTone = v => (CASTER_VOICE.includes(v) ? 'hype' : 'mid');
// a line for voice v: its text and its recordings. recent: a list of the last variants used, kept short so nothing repeats soon
export function compose(v, cat, slots = {}, recent = null) {
  const def = LINES[cat] || CAST[cat]; if (!def) return null;
  let opts = def.lines.map((l, i) => i).filter(i => voiceHas(v, cat, i) && slotsFit(def.lines[i], slots));
  if (!opts.length) return null;
  if (recent) { const fresh = opts.filter(i => !recent.includes(cat + i)); if (fresh.length) opts = fresh; }
  const i = opts[Math.floor(Math.random() * opts.length)];
  if (recent) { recent.push(cat + i); while (recent.length > 24) recent.shift(); }
  const line = def.lines[i], parts = [];
  for (const b of lineText(line).split(/(\{\w+\})/)) { // ',' in parts = a short pause, only where the writing has one (he asked)
    const m = b.match(/^\{(\w+)\}$/);
    if (m) { parts.push(clipId(slotTone(v), String(slots[m[1]]))); continue; }
    if (/^\s*[,.!?:;]/.test(b) && parts.length) parts.push(',');
    if (/[a-z0-9]/i.test(b)) { parts.push(clipId(def.tone, b.trim())); if (/[,.!?:;]\s*$/.test(b) && b !== lineText(line).split(/(\{\w+\})/).at(-1)) parts.push(','); }
  }
  while (parts.at(-1) === ',') parts.pop();
  return { text: lineText(line).replace(/\{(\w+)\}/g, (_, k) => slots[k]), parts, prio: def.prio };
}
const slotsFit = (line, slots) => [...line.matchAll(/\{(\w+)\}/g)].every(m => slots[m[1]] !== undefined && slots[m[1]] !== null && slots[m[1]] !== '');
