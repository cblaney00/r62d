// What a person's words mean to the bots, typed in team chat or said into the microphone (he asked: bots must understand
// directions and questions easily). parseCommand turns a sentence into an intent, who it is for and which room or enemy it
// names. The rules are loose on purpose: the recogniser drops words and people don't talk in set phrases.
const CONTRACT = [[/\bwhat s\b/g, 'what is'], [/\bwhere s\b/g, 'where is'], [/\bwhos\b|\bwho s\b/g, 'who is'], [/\bwheres\b/g, 'where is'], [/\bwhats\b/g, 'what is'], [/\bi m\b|\bim\b/g, 'i am'], [/\blet s\b/g, 'lets'], [/\bthey re\b|\btheyre\b/g, 'they are'], [/\bdon t\b|\bdont\b/g, 'do not'], [/\byou re\b|\byoure\b/g, 'you are'], [/\bu\b/g, 'you'], [/\bur\b/g, 'your'], [/\bthx\b|\bty\b/g, 'thanks'], [/\bplz\b|\bpls\b/g, 'please'], [/\benemys\b/g, 'enemies']];
export function normalize(text) {
  let s = ' ' + String(text || '').toLowerCase().replace(/\[unk\]/g, ' ').replace(/[^a-z0-9' ]+/g, ' ').replace(/'/g, ' ').replace(/ +/g, ' ').trim() + ' ';
  for (const [a, b] of CONTRACT) s = s.replace(a, b);
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
  ['whereyou', /where (are|is|were) you|where you at|your (position|location)|what are you doing|what you doing/],
  ['enemies', /where (are|is|did|have) (they|the enemy|the enemies|enemies|enemy|them|everyone|he|she|anyone|anybody)|any(one|body)? (see|seen|got|have|has|on)|any (info|information|intel|enemies|callouts?|contact|news)|what (do|can|did) you (see|have|hear)|who (do|did) you (see|hear)|who is (there|that)|(see|seen|hear|heard) (anything|anyone|anybody|something|them)|enemy location|any cams?|anything on|what.* on (cam|cams|camera|cameras|drone)/],
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
  ['hold', /\bhold\b|\bstay\b|\bwait\b|\bstop\b|stand still|do not move|\bcamp\b|\bsit\b|\banchor\b|\bfreeze\b/],
  ['push', /\bpush|\brush\b|\bgo go\b|go in\b|\battack\b|\blets go\b|move in|move up|take space|go now|\bexecute\b|\bswing\b|now now|\bbreach\b|\bgo\b$/],
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
    const hit = w.filter(x => s.includes(' ' + x + ' ') || s.includes(' ' + x + 's ')).length; if (!hit) continue;
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
