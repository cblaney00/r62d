// What bots and casters write in chat (he scrapped the recorded voices: this is all writing now, and he asked for a much wider
// variety). The server picks a line with compose. A line's first argument is its mood; casters use 'desk' for the analyst.
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
  go: T('urgent', true, ['Go, go, go!', 'Okay, go now!', 'That\'s the go, move!', 'Let\'s go, let\'s go!', 'Now, now, everyone in!', 'Move in, now!', 'Okay, we\'re going!', 'Three, two, one, in!', 'Now, everybody, now!']),
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

export const WAYS = ['door', 'stairs', 'window', 'wall', 'hatch', 'breach', 'other door', 'main door'];
// ---- the wider variety (he asked): more ways of saying everything, and everything a bot can answer with ----
const MORE = {
  see: ['{op}! {place}!', 'Contact {place}, it\'s {op}.', '{op} right there, {place}.', 'I\'ve got {op} in {place}.', 'Eyes on, {op}, {place}.', 'Heads up, {op} in {place}.', '{op} just crossed {place}.', '{place}, it\'s {op}, watch it.', 'He\'s in {place}, {op}.', '{op} peeking from {place}!', 'Careful, {op}, {place}.', 'Seen {op}, {place}, shooting.', '{op} pushing through {place}!', 'That\'s {op}, {place}, swing with me.', 'One, {place}, {op}.'],
  seeMany: ['Two plus in {place}!', 'Careful, a few of them in {place}!', '{place} is packed!', 'Not alone, {place}, at least two!', 'They\'re together in {place}, don\'t go solo.', 'Two on me, {place}, need help!', 'Big push through {place}!', 'Group in {place}, I can\'t hold this.'],
  seeLow: ['{op} is tagged, {place}!', 'Hit {op}, one more, {place}!', '{op} one shot, push {place}!', '{op} hurt bad, {place}.', 'Tagged him, {op}, {place}.', 'I hit {op} hard, {place}.', 'Free kill, {op} in {place}, nearly dead.'],
  heard: ['Movement, {place}.', 'Someone in {place}, I can hear it.', 'Running, {place}.', 'That\'s a footstep, {place}.', 'Noise in {place}.', 'Could be one in {place}, not sure.', 'They\'re close, {place}.', 'I heard reload in {place}.', 'Someone\'s creeping in {place}.'],
  low: ['Barely alive here.', 'I\'m cooked, one hit.', 'Need health, I\'m low.', 'Don\'t count on me, I\'m one shot.', 'Took a lot, I\'m weak.', 'Hurt bad, covering from back.'],
  plant: ['Getting it down, watch me.', 'Plant going, eyes out.', 'Cover, I\'m planting.', 'Going for the plant now.', 'Dropping it here, stay close.', 'Defuser coming down, hold angles.'],
  defuse: ['On the defuser, need cover!', 'Tapping, don\'t let them through!', 'Disabling now, watch the door!', 'Tap going, stay on me!', 'I\'m stopping it, cover!'],
  stun: ['Flash in, wait for it!', 'Stun, stun, go after it!', 'Throwing flash, turn away!', 'Stun on the door!'],
  smoke: ['Smoke in, cross now.', 'Smoke\'s going on the door.', 'Blocking that with smoke.', 'Use the smoke, move up.'],
  quiet: ['{place} looks clear.', 'Nothing here, {place}.', 'Clear so far, {place}.', '{place}, no one.', 'Checked {place}, empty.', '{place} is dead quiet.', 'No sign of them in {place}.'],
  dead: ['{op} in {place}, watch out, I\'m gone.', 'Lost that one, {op}, {place}.', 'Dead, {place}, {op} did it.', 'He\'s in {place}, {op}, low maybe.', 'Couldn\'t get him, {op}, {place}.', 'Traded by {op}, {place}, careful.', 'Ugh. {op}, {place}.', 'Tagged him before I went, {op}, {place}.'],
  got: ['{op} gone.', 'Got him, {op}.', 'Took {op}.', '{op} eliminated.', 'One less, {op}.', 'Scratch {op}.', 'Done, {op} is down.', 'That\'s {op}, keep going.', 'Clean, {op} is out.', 'Bye {op}.'],
  gotLast: ['{op} is out, last one somewhere!', 'One left, find him, {op} is dead!', 'Only one to go, {op} done!'],
  plan: ['Playing {plan}, stick to your jobs.', 'New call, {plan}.', 'Go with {plan} here.', 'We run {plan}, trust it.', '{plan} this time, nice and tidy.', 'Calling {plan}, any questions?', 'Round plan is {plan}.'],
  go: ['Go now, stay tight!', 'All in, all in!', 'Time, go!', 'Hit it!', 'Execute!', 'Move, move!', 'Now or never, go!', 'That\'s the call, everybody in!'],
  nt: ['Unlucky, nearly had it.', 'Good effort.', 'We go again.', 'Close one, shake it off.', 'Fine, next one.', 'Don\'t worry about it.', 'You got good info there.', 'That\'s fine, we still have numbers.'],
  mybad: ['Oops, on me.', 'I misread that.', 'Should have called it, sorry.', 'Bad peek from me.', 'Too greedy, sorry.', 'I rushed it, my bad.'],
  nice: ['Clean shot.', 'That\'s the one.', 'Huge.', 'Nice trade.', 'Love it.', 'Sharp.', 'Beautiful.', 'Keep that up.', 'Big play.', 'What a shot.'],
  ack: ['Yes.', 'Copy that.', 'Roger.', 'Sounds good.', 'Understood.', 'Will do.', 'You got it.', 'Heard.', 'On my way.', 'Okay, doing it.', 'Yep, got you.', 'Easy.', 'No problem.'],
  no: ['Can\'t do that.', 'Not possible right now.', 'I\'m pinned here.', 'Can\'t, they\'re on me.', 'Not from where I am.', 'Bad idea right now.', 'Ask me in a sec.', 'No can do.'],
  ansEnemy: ['{op}, {place}, a few seconds ago.', 'Saw {op} in {place}.', '{op} around {place}.', 'Latest is {op} in {place}.', 'Check {place}, {op} is there.', '{op} was moving through {place}.', '{place}. It\'s {op}.', 'Best guess, {op} in {place}.'],
  ansNone: ['Nothing yet.', 'No clue, sorry.', 'Haven\'t seen a soul.', 'Quiet on my side.', 'Nothing on my end.', 'They\'re hiding, no idea.', 'No contact so far.', 'Got nothing, keep looking.', 'Not a thing yet.'],
  ansGo: ['{place} needs someone.', 'Take {place}.', 'Go check {place}.', 'You could cover {place}.', 'We\'re thin in {place}.', '{place} would help.', 'Play {place} for me.', 'Nobody\'s watching {place}, go there.'],
  ansSite: ['{place}, that\'s the site.', 'Objective\'s in {place}.', 'They\'re in {place}.', 'It\'s {place}.', 'We found it, {place}.', 'Head for {place}, that\'s it.'],
  ansSiteNo: ['Not found yet.', 'Haven\'t got it.', 'Still droning for it.', 'No site yet, check rooms.', 'Give us a minute, still searching.', 'Unknown so far.'],
  ansFollow: ['With you.', 'I\'m behind you.', 'Lead on.', 'Sticking to you.', 'Go on, I\'ve got you.', 'Sure, on your shoulder.', 'Covering you, move.', 'I\'ll watch your back.', 'Yep, right on you.'],
  ansHold: ['I\'ll hold.', 'Holding this spot.', 'Fine, I\'m parked.', 'Nobody\'s getting past me.', 'Staying right here.', 'Okay, waiting.', 'Stopped.', 'Locked on this angle.'],
  ansPush: ['Pushing!', 'Going, going.', 'Moving in now.', 'On it, pushing.', 'Let\'s do it.', 'Right, taking it.', 'I\'m in.', 'Swinging now.', 'Up we go.'],
  ansHelp: ['On the way!', 'Coming to you!', 'Hang on!', 'I see you, coming!', 'Almost there!', 'Stay alive, ten seconds!', 'Got you, moving!', 'Heading over now!'],
  ansDrop: ['Back to my thing then.', 'Okay, forgetting it.', 'Back on my own.', 'Sure, no worries.', 'Cancelled.', 'Fine, I\'ll do my job.'],
};
for (const k in MORE) LINES[k].lines.push(...MORE[k]);
// answers and acknowledgements for what people tell the bots (shared/commands.js)
Object.assign(LINES, {
  ansGoto: T('mid', true, ['Going to {place}.', 'Heading to {place}.', 'On my way to {place}.', 'Okay, {place}.', '{place}, got it.', 'Moving to {place}.', 'Checking {place}.', 'Sure, {place} it is.', 'Be there in a sec, {place}.', 'Yep, going {place} now.', 'Copy, {place}.', 'Rotating to {place}.']),
  ansWatch: T('mid', true, ['I\'ll watch {place}.', 'Holding {place}.', 'Okay, I\'ve got {place}.', 'Covering {place}.', 'Eyes on {place}.', 'I\'ll sit in {place}.', 'Nobody gets through {place}.', 'Yep, {place} is mine.', 'Going to hold {place} for you.']),
  ansCount: T('mid', true, ['{n} of them left, {n2} of us.', '{n} left. We\'ve got {n2}.', 'They have {n}, we have {n2}.', '{n} versus {n2}, them first.', 'Count is {n} of them, {n2} of us.', 'Still {n} of them out there.', '{n} enemies alive, {n2} on our side.']),
  ansTime: T('mid', true, ['{n} seconds.', 'About {n} seconds left.', '{n} on the clock.', 'We have {n} seconds.', 'Clock says {n}.', 'Roughly {n} seconds to go.']),
  ansStatus: T('mid', true, ['I\'m on {n}.', '{n} health.', 'Good, {n} left.', 'Got {n} health, still fighting.', 'Fine, {n} hp.', 'Still up, {n}.', 'Sitting on {n}.']),
  ansWhere: T('mid', true, ['I\'m in {place}.', '{place}.', 'Over in {place}.', 'Currently {place}.', 'Around {place}.', 'I\'m at {place}, why?', 'Still in {place}.', 'Yeah, {place}.']),
  ansMate: T('mid', true, ['{name} is in {place}.', '{name}\'s at {place}.', 'Last I saw, {name} in {place}.', 'Try {place}, {name} is there.', '{name}? {place}.', 'Check {place} for {name}.']),
  ansPlan: T('mid', true, ['We\'re on {plan}.', 'Playing {plan}.', '{plan}, stick to it.', 'It\'s {plan} this round.', 'Plan is {plan}.', 'Just {plan}, do your job.']),
  ansNoPlan: T('mid', true, ['No real plan, play off each other.', 'Just stick with someone.', 'Take space and call what you see.', 'Find them and trade.', 'We\'re making it up. Stay close.', 'Plan? Don\'t die, mostly.', 'Play the objective, watch your corners.']),
  ansCarrier: T('mid', true, ['{name} has it.', '{name}\'s carrying it.', 'It\'s on {name}.', 'Ask {name}, they have the defuser.', 'Defuser\'s with {name}.']),
  ansCarrierMe: T('mid', true, ['I\'ve got it.', 'It\'s on me.', 'Me, I\'m carrying it.', 'I have the defuser.', 'That\'s me.']),
  ansYouHave: T('mid', true, ['You have it!', 'It\'s on you, mate.', 'Check your bag, you\'re carrying it.', 'That\'s you, you\'ve got the defuser.', 'You\'re the one with it.']),
  ansNoCarrier: T('mid', true, ['Nobody\'s got it right now.', 'It\'s on the floor somewhere.', 'No one has it.', 'Dropped, I think.', 'Lost it somewhere, check the bodies.', 'Nobody, go find it.']),
  ansThey: T('mid', true, ['They have it, we just stop them.', 'That\'s their problem, not ours.', 'We\'re defending, they carry it.', 'Attack has it.', 'One of them has it, shoot them all.', 'Not us, we\'re on defence.']),
  ansPlant: T('mid', true, ['Going to plant.', 'Okay, taking it to site.', 'On my way to plant.', 'Yep, I\'ll get it down.', 'Planting as soon as I\'m there.']),
  ansDefuse: T('urgent', true, ['Going for it!', 'I\'ll tap it, cover me!', 'On the defuser, get ready!', 'Heading to stop it!', 'Okay, retaking!']),
  ansNotPlanted: T('mid', true, ['It\'s not planted yet.', 'Nothing to stop yet.', 'They haven\'t planted.', 'Not down yet, we\'re fine.', 'No plant yet, stay ready.', 'Relax, it\'s not down.']),
  ansWrongSide: T('mid', true, ['We\'re defending this round.', 'Wrong side, mate.', 'We don\'t do that on defence.', 'That\'s for attack, we hold.', 'Other team\'s job.', 'Not this side, we\'re the other way round.']),
  ansFlank: T('mid', true, ['Going round.', 'I\'ll flank.', 'Taking the long way.', 'Okay, coming from behind them.', 'Circling, keep them busy.', 'Heading for the flank.', 'I\'ll take the other side.']),
  ansRegroup: T('mid', true, ['Coming back to you.', 'Regrouping.', 'On you, on my way.', 'Okay, grouping up.', 'Heading back.', 'Back together, coming.', 'Pulling in.']),
  ansBack: T('mid', true, ['Falling back.', 'Pulling out.', 'Backing off now.', 'Okay, retreating.', 'Getting out of here.', 'Moving back.']),
  ansUtil: T('mid', true, ['Throwing {util}.', '{util} coming.', 'Okay, {util} out.', 'Got one, {util} going in.', '{util} now, use it.', 'Sending the {util}.']),
  ansNoUtil: T('mid', true, ['I don\'t have one.', 'None left.', 'Nobody\'s got that.', 'Out of those.', 'Wish I had one.', 'Sorry, used it.']),
  ansReinforce: T('mid', true, ['Putting them up.', 'Reinforcing now.', 'Okay, walls going up.', 'On it, reinforcing.', 'Yep, working on walls.']),
  ansLate: T('mid', true, ['Too late for that now.', 'Prep is over.', 'That\'s only for prep.', 'Should have said earlier.', 'Round\'s live, can\'t now.', 'Missed that window.']),
  ansDrone: T('mid', true, ['Sending my drone.', 'Drone heading there.', 'Okay, droning {place}.', 'I\'ll check it on the drone.', 'Going in with the drone.', 'Yep, drone\'s on its way.']),
  ansNoDrone: T('mid', true, ['Drone\'s gone.', 'I don\'t have a drone left.', 'No drone, sorry.', 'Not now, no drone out.', 'Lost it already.']),
  ansPrep: T('mid', true, ['When we go, yeah.', 'Okay, once prep ends.', 'I\'ll do that when the round starts.', 'Soon as we\'re out.', 'Got it, after prep.', 'Noted, on the go.']),
  ansThanksInfo: T('mid', true, ['Thanks, watching it.', 'Good call, got it.', 'Nice info.', 'Okay, looking there.', 'Heard you, on it.', 'Good, I\'ll keep an eye out.', 'Thanks for that.', 'Copy, moving to cover it.']),
  ansThanks: T('calm', false, ['Any time.', 'No worries.', 'Thanks.', 'You too.', 'All good.', 'Cheers.', 'Team effort.', 'Yep, keep it up.', 'You\'re welcome.', 'Ha, thanks.']),
  ansHello: T('calm', false, ['Hey.', 'Hi.', 'Good luck.', 'Yo.', 'Let\'s have a good one.', 'Hello, have fun.', 'Hey, glad you\'re here.', 'Sup.']),
  ansSorry: T('calm', false, ['Don\'t worry.', 'Forget it.', 'It happens.', 'All good, next one.', 'No problem.', 'We\'ll get it back.']),
  ansInsult: T('mid', false, ['Rude.', 'Wow, okay.', 'Say that after you top frag.', 'And yet here we are.', 'Love you too.', 'Noted.', 'Fair, honestly.', 'Bold words.']),
  ansQuiet: T('calm', true, ['Okay, quiet.', 'Shutting up.', 'Sure, quiet.', 'Comms down.', 'Yep.', 'Going silent.']),
  ansTalk: T('calm', true, ['Okay, talking again.', 'Comms back on.', 'Right, back with you.', 'Good, I had things to say.', 'Finally, okay.', 'Listening and talking.']),
  huh: T('mid', true, ['Say again?', 'What was that?', 'Didn\'t catch that.', 'Sorry, what?', 'You cut out, say it again.', 'Come again?', 'Huh?', 'Repeat that?', 'Bad mic, one more time?']),
  scanHit: LINES.scanHit,
  roundWon: T('mid', false, ['Let\'s go!', 'Good round.', 'That\'s how we do it.', 'Nice one, everybody.', 'Easy. Next.', 'Keep that going.', 'Yes, team!', 'Clean round.', 'Well played, all.', 'More of that please.']),
  roundLost: T('calm', false, ['Next one.', 'We\'ll get them.', 'Shake it off.', 'Okay, reset.', 'Tough, go again.', 'They got lucky.', 'We adjust.', 'Not over yet.', 'Fine, new round.', 'Let\'s tidy that up.']),
  revived: T('mid', false, ['Thanks for the pick up.', 'Cheers, back in.', 'You saved me.', 'Back up, thanks.', 'Thank you, thought I was gone.', 'Owe you one.']),
  reload: T('mid', false, ['Reloading.', 'Reload, cover me.', 'Changing mags.', 'Empty, give me a sec.', 'Out, reloading.']),
});
// the casters' extra ways
const CAST_MORE = {
  kill: ['{name} picks off {name2}.', 'Down goes {name2}, courtesy of {name}.', 'Sharp from {name}, {name2} is out.', '{name} punishes {name2}.', '{name2} caught by {name}.', 'That\'s a big pick for {name}.', 'Excellent reaction from {name}.', '{name2} peeked into {name}.'],
  hs: ['Head clicked, {name}!', 'Pure aim from {name}!', '{name} deletes {name2}!', 'Instant, {name} on {name2}!', 'No chance for {name2}, {name} with the head!'],
  clutch: ['Alone now, {name}, this is the moment.', 'The whole round on {name}.', 'Can {name} pull this off?', 'One player left, {name}, take a breath.'],
  count: ['So {n} on {n2}.', 'Numbers now, {n} to {n2}.', 'Advantage shows, {n} versus {n2}.'],
  plant: ['Defuser planted, what a moment!', 'Down it goes!', 'They got it planted under pressure!', 'The plant is secured!'],
  plantWhy: ['Now it\'s all about angles.', 'Defence on the clock now.', 'Good luck getting through that crossfire.', 'Time flips in their favour.'],
  end: ['{team} win that one!', 'Round secured by {team}.', 'Beautifully closed by {team}.', 'That\'s a statement from {team}.', 'Point to {team}.'],
  endWhy: ['The numbers told the story there.', 'Good discipline all round.', 'Their utility won that.', 'They stayed patient.', 'One good call changed that round.', 'That opening kill set it all up.'],
  prep: ['Quiet now, this is where rounds are won.', 'Utility going down all over the site.', 'Everyone doing their homework.', 'Keep an eye on what stays open.'],
  act: ['No more waiting!', 'They\'re on the move!', 'Round begins!', 'And we are live!'],
  ban: ['{team} remove {op}.', 'Goodbye {op}, says {team}.', '{op} struck off by {team}.'],
  mp: ['Point for the match on the line.', 'One round away, nerves now.', 'Last chance for the other side.'],
};
for (const k in CAST_MORE) CAST[k].lines.push(...CAST_MORE[k]);

const hash = s => { let h = 7; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0; return Math.abs(h); };
// not everyone says everything: each person has their own favourites, which keeps people sounding different
const SHARE = 0.65;
function hasLine(who, cat, i, n) {
  if (CAST[cat] || n <= 4) return true;
  const first = hash(who + cat) % n;
  if ((i - first + n) % n < 3) return true; // always a few
  return hash(who + cat + i) % 100 < SHARE * 100;
}
const slotsFit = (line, slots) => [...line.matchAll(/\{(\w+)\}/g)].every(m => slots[m[1]] !== undefined && slots[m[1]] !== null && slots[m[1]] !== '');
// a line for this person. recent: the last variants they used, kept so nothing repeats soon
export function compose(who, cat, slots = {}, recent = null) {
  const def = LINES[cat] || CAST[cat]; if (!def) return null;
  let opts = def.lines.map((l, i) => i).filter(i => hasLine(who, cat, i, def.lines.length) && slotsFit(def.lines[i], slots));
  if (!opts.length) return null;
  if (recent) { const fresh = opts.filter(i => !recent.includes(cat + i)); if (fresh.length) opts = fresh; }
  const i = opts[Math.floor(Math.random() * opts.length)];
  if (recent) { recent.push(cat + i); while (recent.length > 40) recent.shift(); }
  return { text: def.lines[i].replace(/\{(\w+)\}/g, (_, k) => slots[k]), prio: def.prio };
}
