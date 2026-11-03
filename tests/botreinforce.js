// Defender bots reinforce one wall at a time through preparation, never all at the start (he asked: walls went
// solid the moment prep began). Run: node tests/botreinforce.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { MAP_LIST, buildMap } from '../shared/map.js';
import { PHASE, T } from '../shared/constants.js';

let fails = 0;
for (const id of MAP_LIST) {
  const g = new Game();
  for (let i = 0; i < 6; i++) g.addBot();
  g.mapId = id; g.map = buildMap(id); g.startMatch();
  while (g.phase !== PHASE.PREP) g.tick(1 / 30);
  const count = () => g.map.tiles.filter(t => t === T.REINF || t === T.HATCHR).length;
  const at0 = count(), r0 = g.reinforce;
  for (let i = 0; i < 15; i++) g.tick(1 / 30);
  const early = r0 - g.reinforce;
  while (g.phase === PHASE.PREP) g.tick(1 / 30);
  const used = r0 - g.reinforce;
  console.log(id, 'reinforced in the first 0.5 s:', early, ' by the end of prep:', used, ' tiles', at0, '→', count());
  if (early > 1) { fails++; console.log('FAIL', id, 'reinforced at once'); }
  if (used < 2) { fails++; console.log('FAIL', id, 'bots hardly reinforced'); }
}
console.log(fails ? `${fails} FAILED` : 'PASS');
process.exit(fails ? 1 : 0);
