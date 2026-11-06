// The defending bots vote on the site (he asked), from what the pros learned in practice; a site played once this match
// can't be picked again (by bots or people) until every site has been played. Run: node tests/sitevote.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { PHASE } from '../shared/constants.js';
let fails = 0; const ok = (c, ...a) => { if (!c) { fails++; console.log('FAIL', ...a); } };
for (const [map, level] of [['harbor', 7], ['villa', 2], ['dust', 4]]) {
  const g = new Game({}); g.mapId = map; g.botLevel = level;
  for (let i = 0; i < 10; i++) g.addBot(i % 2);
  const chats = []; const c0 = g.chat.bind(g); g.chat = (p, m) => { chats.push(m.text); return c0(p, m); };
  g.startMatch(); const played = [], n = g.map.sites.length;
  for (let r = 1; r <= 5 && g.phase !== PHASE.MATCH_END; r++) {
    for (let t = 0; t < 30 * 200 && g.phase === PHASE.SELECT; t++) g.tick(1 / 30);
    const recent = played.slice(played.length - (played.length % n));
    ok(!recent.includes(g.site), `${map} round ${r}: site ${g.site} played again before all were used (${played})`);
    played.push(g.site);
    ok(chats.some(t => /^Vote: |^Last site left/.test(t)), `${map} round ${r}: no vote result in chat`);
    console.log(`${map} round ${r}: ${g.map.sites[g.site].name} | ${chats.filter(t => /vote|for me|we win|^[^ ]+.*\.$/i.test(t)).slice(-6).join(' · ')}`);
    chats.length = 0;
    // a person's pick of a used site is refused
    g.nextRound();
    // a person's pick of a site already played is refused
    const def = [...g.players.values()].find(p => g.side(p) === 'def'), used = g.sitesUsed.find(i => i !== g.site);
    if (used !== undefined) { def.bot = false; g.handle(def, { t: 'site', n: used }); def.bot = true; ok(g.site !== used, `${map}: a person could pick a used site`); }
  }
}
console.log(fails ? `${fails} failure(s)` : 'PASS');
process.exit(fails ? 1 : 0);
