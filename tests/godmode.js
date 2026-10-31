// Free play is god mode for the player (he asked): no damage, ammo/skills/gadgets/drones refill, and the operator grid
// switches to any operator. Run: node tests/godmode.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { buildMap } from '../shared/map.js';
import { OP_LIST, OPERATORS } from '../shared/operators.js';
let fails = 0; const ok = (c, ...a) => { if (!c) { fails++; console.log('FAIL', ...a); } };
const g = new Game({ free: true }), p = g.addPlayer('Me', false); p.sock = { open: true, send() {} }; // a connected player
g.mapId = 'harbor'; g.map = buildMap('harbor'); g.handle(p, { t: 'free', a: 'start', map: 'harbor', bots: 1 });
const bot = [...g.players.values()].find(q => q.bot);
g.damage(p, 500, bot, 'Test', 0); ok(p.alive && !p.downed && p.hp === p.maxHp, 'god mode: you were hurt');
g.handle(p, { t: 'free', a: 'pick', op: 'salvo' }); ok(p.op === 'salvo', 'grid pick did not switch operator');
for (let i = 0; i < 6; i++) { g.useAbility(p); g.tick(1 / 30); }
ok(p.abilityCount === OPERATORS.salvo.ability.count, 'skill charges ran out', p.abilityCount);
const gun = p.guns[0]; gun.ammo = 0; g.tick(1 / 30); ok(gun.ammo === gun.m ? true : gun.ammo > 0, 'ammo did not refill');
for (const op of OP_LIST) { g.handle(p, { t: 'free', a: 'pick', op }); if (p.op !== op) { ok(false, 'could not pick', op); break; } }
ok(bot.alive, 'bot missing'); const hp0 = bot.hp; g.damage(bot, 10, p, 'Test', 0); ok(bot.hp < hp0 || !bot.alive, 'bots must still take damage');
console.log(fails ? `${fails} failure(s)` : 'PASS godmode'); process.exit(fails ? 1 : 0);
