// RANDOM in the lobby (he asked): the map stays a surprise until the match starts, then a different map each time.
// Run: node tests/randommap.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { MAPS } from '../shared/map.js';
import { PHASE } from '../shared/constants.js';
let fails = 0; const fail = (...a) => { fails++; console.log('FAIL', ...a); };
const g = new Game(); g.addBot(0); const p = [...g.players.values()][0], seen = new Set();
g.handle(p, { t: 'lobby', a: 'map', id: 'random' });
if (!g.randomMap || g.mapId !== 'harbor') fail('RANDOM should only set the flag in the lobby');
for (let i = 0; i < 40; i++) {
  const was = g.mapId; g.handle(p, { t: 'lobby', a: 'start' });
  if (g.phase === PHASE.LOBBY) fail('match did not start');
  if (g.mapId === was || !MAPS[g.mapId] || g.map.id !== g.mapId) fail('bad roll', was, g.mapId);
  seen.add(g.mapId); g.resetToLobby();
}
if (seen.size < 5) fail('only saw maps', [...seen]);
g.handle(p, { t: 'lobby', a: 'map', id: g.mapId }); if (g.randomMap) fail('picking the current map must switch RANDOM off');
g.handle(p, { t: 'lobby', a: 'map', id: 'random' }); g.handle(p, { t: 'lobby', a: 'map', id: g.mapId === 'dust' ? 'villa' : 'dust' }); if (g.randomMap) fail('picking a map must switch RANDOM off');
const kept = g.mapId; g.handle(p, { t: 'lobby', a: 'start' }); if (g.mapId !== kept) fail('a chosen map must stay');
console.log(fails ? `${fails} FAILED` : `PASS randommap (${seen.size} maps seen)`); process.exit(fails ? 1 : 0);
