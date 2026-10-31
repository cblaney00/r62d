// Ballistic shield (Bulwark): standing or walking it stops every shot from the front; jogging, it swings and some
// shots at its edges get through; just after firing it is swung aside and the front is open; a melee hit knocks it
// aside; shield up is never a crawl. Run: node tests/shield.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { buildMap } from '../shared/map.js';
import { PX_PER_M } from '../shared/constants.js';
let fails = 0; const fail = (...a) => { fails++; console.log('FAIL', ...a); };
const g = new Game({ free: true }), s = g.addPlayer('Shooter', false), b = g.addPlayer('Shield', false);
g.mapId = 'harbor'; g.map = buildMap('harbor'); g.handle(s, { t: 'free', a: 'start', map: 'harbor', bots: 0 });
for (const q of [s, b]) Object.assign(q, { alive: true, downed: false, ctrl: 'body', staged: false, viewTime: null });
b.op = 'bulwark'; b.shieldMode = 'shield'; b.bracing = true; b.switchUntil = 0;
const X = 360, Y = 40; // the street in front of Harbor Office
// shots from the front, spread across the body (-5..5 px either side of the middle, not the head)
const volley = () => { let hit = 0; for (let o = -5.5; o <= 5.5; o += 0.5) { if (Math.abs(o) < 3) continue; b.hp = 999; b.maxHp = 999; b.alive = true; b.downed = false; s.x = X; s.y = Y + 100; b.x = X + o; b.y = Y; g.hitscan(s, s.x, s.y, -Math.PI / 2, 2000, 20, 'Test', 'Pistol'); if (b.hp < 999) hit++; } return hit; };
b.aim = Math.PI / 2; // facing the shooter
b.moving = 0; b.gait = 0; let h = volley(); if (h) fail('standing shield let', h, 'shots through');
b.moving = 1; h = volley(); if (h) fail('walking shield let', h, 'shots through');
b.moving = 2; let jog = 0; for (let k = 0; k < 16; k++) { b.gait = k / 16 * Math.PI * 2; jog += volley(); }
if (!jog) fail('jogging shield never opens up');
b.moving = 0; b.shieldOpenUntil = g.time + 0.5; h = volley(); if (h < 5) fail('just fired: front should be open, hits', h); b.shieldOpenUntil = 0;
b.shieldDownUntil = g.time + 1; h = volley(); if (h < 5) fail('knocked aside: front should be open, hits', h); b.shieldDownUntil = 0;
// firing with the shield up opens it
b.fireCd = 0; b.reloadT = 0; b.slot = 0; const gun = b.guns && b.guns[0];
if (gun) { g.fire(b, gun, { ...g.constructor.W || {}, ...gun, rpm: 400, pellets: 1, dmg: 1, range: 10, cls: 'Pistol' }); if (!(b.shieldOpenUntil > g.time)) fail('firing did not swing the shield aside'); }
// speed with the shield up: jog at least 1.8 m/s
b.vx = b.vy = 0; b.x = X; b.y = Y; const x0 = b.x; for (let i = 0; i < 60; i++) { b.input = { right: 1 }; g.applyMove(b, 1 / 30); }
const v = (b.x - x0) / 2 / PX_PER_M; if (v < 1.7) fail('shield up jogs too slowly', v.toFixed(2), 'm/s');
console.log(`jogging: ${jog} of ${16 * 20} edge shots got through; shield-up jog ${v.toFixed(2)} m/s`);
console.log(fails ? `${fails} failure(s)` : 'PASS shield');
process.exit(fails ? 1 : 0);
