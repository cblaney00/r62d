// Ranked (he asked: an MMR ladder against bots at the ranks): switching it on sets the bots' rank from the lobby's
// average MMR, starting fills both teams with bots, a win raises MMR and a loss lowers it. Run: node tests/ranked.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { store } from '../server/store.js';
import { BOT_LEVELS } from '../shared/constants.js';
import { rankOf, START_MMR, mmrChange } from '../shared/progress.js';

let fails = 0;
const fail = (...a) => { fails++; console.log('FAIL', ...a); };
const g = new Game(), login = store.login('Ranked Tester');
const p = g.addPlayer(login.profile.name, false); p.token = login.token; p.pid = login.profile.id; p.mmr = login.profile.mmr ?? START_MMR;
if (rankOf(START_MMR) !== 2) fail('a new player is not Silver');
g.handle(p, { t: 'lobby', a: 'ranked', on: true });
if (!g.ranked) fail('ranked did not switch on');
if (g.botLevel !== 2) fail('bots are', BOT_LEVELS[g.botLevel], 'not Silver');
g.handle(p, { t: 'lobby', a: 'botLevel', lv: 6 });
if (g.botLevel !== 2) fail('the bot rank could be changed by hand in ranked');
g.startMatch();
if (g.players.size !== 10) fail('ranked match has', g.players.size, 'players, not 10');
const before = store.byToken(login.token).mmr ?? START_MMR;
let xp = g.saveMatch(p.squad);
const mid = store.byToken(login.token).mmr;
if (!(mid > before)) fail('a win did not raise MMR', before, mid);
if (!xp[p.pid] || !xp[p.pid].mmr) fail('no MMR result for the end screen');
g.startMatch(); xp = g.saveMatch(1 - p.squad);
if (!(store.byToken(login.token).mmr < mid)) fail('a loss did not lower MMR');
if (!(mmrChange(1400, 1800, true) > mmrChange(1400, 1000, true))) fail('beating stronger bots is not worth more');
console.log(`MMR ${before} -> win ${mid} -> loss ${store.byToken(login.token).mmr}`);
console.log(fails ? `FAIL ranked (${fails})` : 'PASS ranked');
process.exit(fails ? 1 : 0);
