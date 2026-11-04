// What a person's words mean to the bots, typed in team chat or said into the microphone (he asked: bots must understand
// directions and questions easily). parseCommand turns a sentence into an intent, who it is for and which room or enemy it
// names. The rules are loose on purpose: the recogniser drops words and people don't talk in set phrases.
const CONTRACT = [[/\bwhat s\b/g, 'what is'], [/\bwhere s\b/g, 'where is'], [/\bwhos\b|\bwho s\b/g, 'who is'], [/\bwheres\b/g, 'where is'], [/\bwhats\b/g, 'what is'], [/\bi m\b|\bim\b/g, 'i am'], [/\blet s\b/g, 'lets'], [/\bthey re\b|\btheyre\b/g, 'they are'], [/\bdon t\b|\bdont\b/g, 'do not'], [/\byou re\b|\byoure\b/g, 'you are'], [/\bu\b/g, 'you'], [/\bur\b/g, 'your'], [/\bthx\b|\bty\b/g, 'thanks'], [/\bplz\b|\bpls\b/g, 'please'], [/\benemys\b/g, 'enemies']];
// Words the recogniser doesn't know: it listens for one that sounds the same, and it's read back as what was meant.
const SOUNDS = { defuser: 'diffuser', chonk: 'chunk' }, HEARD = Object.entries(SOUNDS).map(([a, b]) => [b, a]);
const NUM = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
export const micFix = t => { for (const [a, b] of HEARD) t = t.replace(new RegExp(`\\b${a}\\b`, 'g'), b); return t; };
export function normalize(text) {
  let s = ' ' + String(text || '').toLowerCase().replace(/\[unk\]/g, ' ').replace(/[^a-z0-9' ]+/g, ' ').replace(/'/g, ' ').replace(/ +/g, ' ').trim() + ' ';
  for (const [a, b] of CONTRACT) s = s.replace(a, b);
  for (const [a, b] of HEARD) s = s.replace(new RegExp(` ${a} `, 'g'), ` ${b} `);
  s = s.replace(/ ([1-9])(?= )/g, (m, d) => ' ' + NUM[d]); // "Suite 1" and "suite one" are the same room
  // the filler people start with
  return s.replace(/ +/g, ' ').replace(/^ ((uh+|um+|er+|so|okay|ok|yeah|yo|hey|like|right|please|guys|team|well|and|but) )+(?=\w)/, m => (/\b(team|guys|yo|hey)\b/.test(m) ? m : ' '));
}
// in order: the first that fits wins. Questions come first, so "where should I go" is not a command to go.
const QUESTIONS = [
  ['time', /how (long|much time)|time left|time is left|whats? the clock|how is the clock/],
  ['count', /how many|who is (left|alive)|number left|whats? the count|how much are left/],
  ['carrier', /who (has|is carrying|got|is got|is holding) (the )?(defuser?|bomb|it)|where is (the )?defuser? (now)?$/],
  ['site', /where .*\b(site|objective|bomb|defuser?)\b|(which|what) (site|objective|room is)|found (the )?(site|objective|bomb)|do we know the (site|objective)/],
  ['go', /where (should|do|can|would|shall) i\b|where to\b|what (should|do|can|would) i\b|what do you (want|need)|where do you want|give me (a )?(job|something)/],
  ['plan', /\b(the|our|your) (plan|strat|strategy|play|call)\b|what are we (doing|running|playing)|what is the (strat|call|idea)/],
  ['status', /(are|you) (you )?(ok|okay|good|alive|hurt|hit|alright)|your (health|hp)|how are you|you (good|okay|ok)\b|how much health/],
  ['whereyou', /where (are|is|were) you|^ where you $|where you at|your (position|location)|what are you doing|what you doing/],
  ['enemies', /^ where (are )?(the|that|them|they)( at)? $|^ where (the )?(enemy|enemies) |where (are|is|did|have) (they|the enemy|the enemies|enemies|enemy|them|everyone|he|she|anyone|anybody)|(any|some)(one|body)? (see|seen|got|have|has|on)|any (info|information|intel|enemies|callouts?|contact|news)|what (do|can|did) you (see|have|hear)|who (do|did) you (see|hear)|who is (there|that)|(see|seen|hear|heard) (anything|anyone|anybody|something|them)|enemy location|any cams?|anything on|what.* on (cam|cams|camera|cameras|drone)/],
];
const COMMANDS = [
  ['quiet', /\b(shut up|be quiet|quiet|stop talking|hold comms|shh+|silence|no comms|less talking|stop chatting)\b/],
  ['talk', /you can talk|talk again|comms back|speak up/],
  ['cancel', /forget (it|that|about it)|never ?mind|cancel|as you were|do your own|do what you want|stop following|carry on|play your game|your call|ignore that/],
  ['revive', /revive|pick me up|res me|get me up|help me up|i am down\b|heal me|i need (a )?(revive|health|heal)/],
  ['plant', /\bplant\b|put (it|the defuser|the bomb) down|get (it|the defuser) down/],
  ['defuse', /\b(defuse|disable|tap it|tap the|stop the (defuser|bomb)|retake)\b/],
  ['smoke', /\bsmokes?\b/], ['stun', /\b(stuns?|flash|flashes|flashbang|bang)\b/], ['frag', /\b(frag|frags|grenade|nade|nades)\b/],
  ['reinforce', /\breinforce|\bwalls? up\b|\bfortify\b/],
  ['drone', /\bdrones?\b|\bscout\b/],
  ['regroup', /regroup|group up|come back|everyone (to|on) me|stack (up|on)|get together|together now|all on me/],
  ['fallback', /fall ?back|retreat|back up\b|pull back|get out|run away|back off|get back/],
  ['flank', /\bflank|go (a)?round|other (way|side|door)|behind them|get behind|from behind|circle round/],
  ['help', /\bhelp\b|need backup|\bbackup\b|come here|get over here|over here\b|come to me|i need you|save me/],
  ['follow', /\bfollow\b|come with|stay with|stick with|\bon me\b|with me\b|cover me|watch my back|\bescort\b|come on\b/],
  ['hold', /\bwatch (the )?(stairs|doors?|windows?)\b|\bhold\b|\bstay\b|\bwait\b|\bstop\b|stand still|do not move|\bcamp\b|\bsit\b|\banchor\b|\bfreeze\b/],
  ['push', /\bgo on\b|\bget in there\b|\bpush|\brush\b|\bgo go\b|go in\b|\battack\b|\blets go\b|move in|move up|take space|go now|\bexecute\b|\bswing\b|now now|\bbreach\b|\bgo\b$/],
  ['thanks', /\bthanks\b|thank you|nice one|good job|good shot|nice shot|well (played|done)|\bnice\b|\bgg\b|great (job|shot)|good (work|one)/],
  ['hello', /^ (hi|hello|hey|yo|sup|hiya|good luck|gl hf|glhf)\b/],
  ['sorry', /\bsorry\b|my bad|my fault|\boops\b/],
  ['insult', /you (suck|are (bad|trash|useless|terrible|awful|dumb|stupid))|\bnoob\b|\btrash\b|\buseless\b|\bidiot\b/],
];
const MOVE = /\b(go|get|head|move|run|walk|rotate|check|clear|push|rush|watch|cover|hold|stay|wait|sit|guard|defend|camp|anchor|look|take|meet|to)\b/;
const STAY = /\b(watch|cover|hold|stay|wait|sit|guard|defend|camp|anchor|look)\b/;
const ENEMY = /\b(enemy|enemies|contact|someone|somebody|guy|one|two|three|they are|he is|she is|spotted|i see|i saw|heard|there is|footsteps)\b/;
const DULL = new Set(['the', 'a', 'of', 'room', 'and', 'old', 'new', 'main', 'big', 'small', 'upper', 'lower']);
export const roomWords = name => normalize(name.replace(/^\dF /, '')).trim().split(' ').filter(w => w && !DULL.has(w));
// the room named in a sentence: every telling word of the name, or the best part of it (a room can have a long name)
function findRoom(s, rooms) {
  let best = null, bs = 0;
  for (const r of rooms) {
    const w = roomWords(r); if (!w.length) continue;
    const hit = w.filter(x => x === 'it' ? s.includes(' it room ') : s.includes(' ' + x + ' ') || s.includes(' ' + x + 's ')).length; // ("plant it" is not the IT Room) if (!hit) continue;
    const sc = hit / w.length + hit * 0.1;
    if (sc > bs) { bs = sc; best = r; }
  }
  return bs >= 0.5 ? best : null;
}
const words = n => normalize(n).trim().split(' ');
const hasName = (s, n) => n && words(n).every(w => s.includes(' ' + w + ' '));
// ctx: rooms (names), ops (operator names), mates ({ id, name, op }): the bots on your team, enemyOps (names)
export function parseCommand(text, ctx = {}) {
  const s = normalize(text), r = { intent: null, who: [], all: false, room: null, op: null, updown: 0, site: false, question: false };
  if (!s.trim()) return r;
  r.all = /\b(everyone|everybody|team|guys|all of you|you all|boys|lads|squad|all)\b/.test(s);
  for (const m of ctx.mates || []) if (hasName(s, m.name) || hasName(s, m.op)) r.who.push(m.id);
  r.room = findRoom(s, ctx.rooms || []);
  r.updown = /\bup ?stairs\b|\bfloor (above|up)\b|\bup a floor\b/.test(s) ? 1 : /\bdown ?stairs\b|\bfloor (below|down)\b|\bdown a floor\b|\bbasement\b/.test(s) ? -1 : 0;
  r.site = /\b(site|objective|bomb)\b/.test(s);
  for (const n of ctx.enemyOps || []) if (hasName(s, n)) { r.op = n; break; }
  if (!r.op) for (const n of ctx.ops || []) if (hasName(s, n)) { r.op = n; break; }
  const q = /^ (where|what|whats|who|how|when|which|any|anyone|anybody|is|are|do|did|does|can|has|have|you) /.test(s) || /\?\s*$/.test(String(text || ''));
  if (q) { for (const [k, re] of QUESTIONS) if (re.test(s)) { r.intent = k; r.question = true; return r; }
    if (r.op && /^ where /.test(s)) { r.intent = 'whereop'; r.question = true; return r; } }
  // "enemy in kitchen", "Ember kitchen": a report. A teammate's name doesn't count as an enemy.
  const enemyName = (ctx.enemyOps || []).some(n => hasName(s, n));
  if ((r.room || r.updown) && !q && (enemyName || (ENEMY.test(s) && !MOVE.test(s.replace(/\bto\b/g, ''))))) { r.intent = 'report'; return r; }
  for (const k of ['smoke', 'stun', 'frag']) if (COMMANDS.find(c => c[0] === k)[1].test(s)) { r.intent = k; return r; }
  // a place plus any verb of moving: go there (and stay, if they were told to watch it)
  if ((r.room || r.updown || r.site) && (MOVE.test(s) || (ctx.mates || []).length && r.who.length) && !/\b(plant|defuse|drone|scout|reinforce)\b/.test(s)) { r.intent = STAY.test(s) ? 'watch' : 'goto'; return r; }
  for (const [k, re] of COMMANDS) if (re.test(s)) { r.intent = k; return r; }
  if (r.room && !q) { r.intent = 'goto'; return r; } // only a place: "kitchen"
  for (const [k, re] of QUESTIONS) if (re.test(s)) { r.intent = k; r.question = true; return r; } // said without a question word
  r.question = q;
  return r;
}
// the words the microphone listens for, besides the map's rooms and the people's names
export const COMMAND_WORDS = `where what whats who how when which many much long time left is are the they them enemy enemies everyone anyone anybody info information intel callouts see seen hear heard anything something someone somebody do did you your we our i me my to in on at of a it and now please should can go get going head move run walk rotate check clear push rush watch cover hold stay wait stop sit guard defend camp anchor look take meet follow come with stick back behind over here there this that regroup group up together stack fall retreat pull flank around round other way side door window wall floor upstairs downstairs stairs above below site objective bomb defuser plant defuse disable tap retake smoke stun flash frag grenade nade reinforce fortify drone scout cam cams camera plan strat play help backup revive pick heal down quiet shut stop talking comms talk again forget never mind cancel thanks thank nice good job shot well played sorry bad hello hi hey yo team guys all alive health hurt okay ok alright one two three four five contact spotted guy need want attack breach execute swing lets let's take space outside inside room hall kitchen office lobby`.split(' ');
// What the microphone expects, as whole sentences. A small recogniser does far better choosing between sentences than
// guessing loose words: whatever it hears lands on the closest one, and parseCommand reads that.
const SAY = `where they at|where are they at|where you at|go on|get in there|get over there|push the site|push site|watch the stairs|watch stairs|watch the door|watch the window|hold the stairs|hold the door|cover the stairs|check the stairs|check upstairs|check downstairs|push upstairs|push downstairs|drone upstairs|drone downstairs|drone the upstairs|drone the downstairs|drone the site|smoke the door|smoke the window|smoke the stairs|flash the door|flash the window|flash the stairs|everyone regroup|everyone go|everyone hold|everyone follow me|everyone fall back|one enemy|two enemies|one enemy upstairs|one enemy downstairs|enemy upstairs|enemy downstairs|can someone see them|can anyone see them|can you see them|does anyone see them|did anyone see them|thanks good job|good job|nice shot|thank you|thanks|where are they|where are the enemies|where is the enemy|where is everyone|any info|any information|any intel|any callouts|what do you see|what can you see|who do you see|do you see anyone|anyone see them|any enemies|how many are left|how many left|who is left|who is alive|how much time is left|how long is left|time left|where should i go|where do i go|what should i do|what do i do|where do you want me|what is the plan|whats the plan|what is the strat|what are we doing|who has the defuser|who has the bomb|who has it|where is the site|where is the objective|where is the bomb|which site|do we know the site|are you good|are you okay|you good|you okay|what is your health|how much health|where are you|what are you doing|follow me|come with me|stay with me|stick with me|on me|cover me|watch my back|come on|hold here|hold this|hold position|wait here|wait|stay here|stay there|stop|do not move|push|push up|push now|everyone push|go go|go in|go in now|go now|lets go|attack|rush|move in|move up|take space|breach|flank|flank them|go around|other side|other way|get behind them|fall back|retreat|get back|back up|pull back|get out|regroup|group up|regroup on me|come back|go upstairs|go downstairs|go to site|get to site|go to the site|watch site|hold site|defend site|help|help me|i need help|need backup|backup|come here|get over here|over here|revive me|pick me up|i am down|plant|plant it|plant the bomb|plant the defuser|put it down|defuse|defuse it|tap it|retake|smoke|throw a smoke|throw smoke|flash|throw a flash|throw flash|stun|throw a stun|grenade|throw a grenade|reinforce|reinforce the walls|reinforce the wall|drone|send your drone|send a drone|scout|be quiet|quiet|shut up|stop talking|hold comms|you can talk|talk again|forget it|forget that|never mind|cancel|stop following|thanks|thank you|nice one|nice shot|good shot|good job|well played|hello|hi|hey|hey team|sorry|my bad|you suck`.split('|');
const AT = ['one enemy in the ', 'one enemy in ', 'two enemies in the ', 'go to the ', 'go to ', 'head to the ', 'check the ', 'check ', 'clear the ', 'push ', 'push the ', 'watch the ', 'watch ', 'hold the ', 'cover the ', 'get to the ', 'rotate to the ', 'enemy in the ', 'enemy in ', 'enemy ', 'one in the ', 'one in ', 'someone in the ', 'they are in the ', 'i see one in the ', 'smoke the ', 'flash the ', 'drone the ', 'scout the ', ''];
const TO_NAME = ['follow me', 'come with me', 'cover me', 'hold here', 'wait here', 'stay here', 'push', 'help me', 'come here', 'revive me', 'plant it', 'defuse it', 'where are you', 'are you good', 'throw a smoke', 'throw a flash', 'flank', 'fall back', 'forget it'];
export function micPhrases(rooms = [], names = [], ops = []) {
  const low = s => normalize(s).trim().replace(/\bi am\b/g, 'i am');
  const R = [...new Set(rooms.map(r => low(r.replace(/^\dF /, ''))))], N = [...new Set(names.map(low))], O = [...new Set(ops.map(low))], out = new Set(SAY);
  for (const r of R) { out.add(r); for (const a of AT) out.add(a + r); } // (a room on its own means go there)
  for (const n of N) { for (const t of TO_NAME) out.add(n + ' ' + t); for (const r of R) { out.add(n + ' go to the ' + r); out.add(n + ' go to ' + r); out.add(n + ' watch the ' + r); } out.add(n + ' go to site'); }
  for (const o of O) { out.add('where is ' + o); out.add(o); for (const r of R) { out.add(o + ' in the ' + r); out.add(o + ' in ' + r); out.add(o + ' ' + r); } }
  // Blended speech swallows the small words (he speaks fast with a rural accent; "where are they" reached it as "where are the",
  // "push the site" as "push site"), so each sentence is also listened for without them.
  for (const x of [...out]) for (const y of [x.replace(/ the /g, ' '), x.replace(/\bgo to (the )?/, 'go '), x.replace(/\bare (they|you)\b/, '$1')]) if (y !== x) out.add(y);
  return [...out].filter(Boolean).map(x => x.split(' ').map(w => SOUNDS[w] || w).join(' '));
}
