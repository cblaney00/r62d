// The authoritative match: lobby, rounds, movement, shooting, gadgets, objective.
import { CELL, PHASE, DUR, T, FL, TEAM, CELL_HP, WIN_ROUNDS, MAX_PLAYERS, TEAM_SIZE, PLAYER_R,
  stopsBullet, penBullet, blocksDrone, blocksMove, other } from '../shared/constants.js';
import { buildMap, roomAt } from '../shared/map.js';
import { stepMove, walkRay, rayCircle, los, tileAt, angDiff, castSight, facingCell } from '../shared/physics.js';
import { OPERATORS, WEAPONS, ARMOR_HP, opsForTeam } from '../shared/operators.js';
import { botThink, botPickOp, botPrep } from './bots.js';
import { store, publicProfile } from './store.js';
import { LOADOUTS, GADGET_COUNT, cleanLoadout } from '../shared/operators.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
const r1 = v => Math.round(v * 10) / 10;
const r2 = v => Math.round(v * 100) / 100;
const BOT_NAMES = ['Viper', 'Moss', 'Rook-7', 'Static', 'Juno', 'Kilo', 'Brine', 'Ozone', 'Pike', 'Wick', 'Saber', 'Flint'];
const EMPTY_INPUT = { up: 0, down: 0, left: 0, right: 0, sprint: 0, walk: 0, crouch: 0, fire: 0, ads: 0, interact: 0, ability: 0 };
const JAM_R = 90;

// R62D_FAST=1 shortens the menus, for quick testing.
if (typeof process !== 'undefined' && process.env.R62D_FAST) { DUR.select = 3; DUR.prep = 6; }

export class Game {
  constructor() {
    this.players = new Map();
    this.nextId = 1;
    this.ents = [];
    this.events = [];
    this.changed = new Set();
    this.phase = PHASE.LOBBY;
    this.timer = 0; this.round = 0; this.score = [0, 0]; this.time = 0;
    this.map = buildMap();
    this.mapVersion = 0;
    this.site = 0; this.siteRevealed = false; this.planted = null;
    this.spots = { atk: new Map(), def: new Map() };
    this.reinforce = 10;
    this.winner = null; this.reason = '';
    this.revealCheck = 0;
    this.departed = []; this.roundLog = []; this.matchStart = 0;
  }

  // ---------------- connections ----------------
  connect(sock) {
    let p = null;
    sock.on('message', raw => {
      let m; try { m = JSON.parse(raw); } catch { return; }
      if (m.t === 'join' && !p) {
        if (this.humanCount() >= MAX_PLAYERS) { sock.send(JSON.stringify({ t: 'full' })); return; }
        p = this.addPlayer(String(m.name || 'Player').slice(0, 16), false);
        p.sock = sock;
        const login = store.login(typeof m.token === 'string' ? m.token : null, p.name);
        p.token = login.token; p.pid = login.profile.id;
        p.ms = this.blankMatchStats();
        sock.send(JSON.stringify({ t: 'welcome', id: p.id, mapVersion: this.mapVersion, token: p.token, profile: publicProfile(login.profile),
          tiles: Array.from(this.map.tiles), hp: Array.from(this.map.hp) }));
        this.msg(`${p.name} joined`);
      } else if (p) this.handle(p, m);
    });
    sock.on('close', () => {
      if (!p) return;
      this.msg(`${p.name} left`);
      if (p.hasDefuser) this.dropDefuser(p);
      if (this.phase !== PHASE.LOBBY && this.phase !== PHASE.MATCH_END) this.departed.push(this.statLine(p, true));
      this.players.delete(p.id);
      if (this.humanCount() === 0) this.resetToLobby();
    });
  }

  humanCount() { let n = 0; for (const p of this.players.values()) if (!p.bot) n++; return n; }

  addPlayer(name, bot) {
    if (this.players.size >= MAX_PLAYERS) {
      const b = [...this.players.values()].find(q => q.bot); // a human bumps a bot
      if (b && !bot) this.players.delete(b.id); else if (bot) return null;
    }
    const counts = [0, 0];
    for (const q of this.players.values()) counts[q.squad]++;
    const p = this.blankPlayer(name, bot, counts[0] <= counts[1] ? 0 : 1);
    this.players.set(p.id, p);
    return p;
  }

  blankPlayer(name, bot, squad) {
    return { id: 'p' + (this.nextId++), name, bot, squad, op: null, alive: false, downed: false, hp: 0, maxHp: 100,
      x: 0, y: 0, aim: 0, input: { ...EMPTY_INPUT }, prevInput: { ...EMPTY_INPUT }, lastSeq: 0, slot: 0, guns: [],
      fireCd: 0, reloadT: 0, bloom: 0, abilityCount: 0, gadgetCount: 0, drones: 0, ctrl: 'body', droneId: null, camIdx: 0,
      busy: null, hasDefuser: false, slowUntil: 0, stunUntil: 0, battery: 0, scanning: false, bracing: false,
      meleeCd: 0, kills: 0, deaths: 0, downedBy: null, moving: 0, lastShot: 0, nitroId: null, ai: {} };
  }

  side(p) { return (p.squad === 0) === (this.round % 2 === 1) ? TEAM.ATK : TEAM.DEF; }

  resetToLobby() {
    this.phase = PHASE.LOBBY; this.timer = 0; this.round = 0; this.score = [0, 0];
    this.ents = []; this.planted = null;
    for (const p of this.players.values()) { p.alive = false; p.op = null; }
  }

  // ---------------- messages from players ----------------
  handle(p, m) {
    if (m.t === 'input') {
      p.input = { ...EMPTY_INPUT, ...m.k };
      if (typeof m.a === 'number' && isFinite(m.a)) p.aim = m.a;
      if (p.ctrl === 'cam') { const c = this.aliveCams()[p.camIdx]; if (c) c.ang = p.aim; }
      if (typeof m.ax === 'number') { p.aimX = m.ax; p.aimY = m.ay; }
      this.applyMove(p, Math.max(0, Math.min(0.05, Number(m.dt) || 0)));
      p.lastSeq = m.s | 0;
      if (Array.isArray(m.ev)) for (const e of m.ev.slice(0, 10)) this.event(p, e);
    } else if (m.t === 'lobby') {
      if (m.a === 'addBot') this.addBot(m.squad);
      else if (m.a === 'removeBot') this.removeBot(m.squad);
      else if (m.a === 'fillBots') { for (const s of [0, 1]) while (this.squadCount(s) < TEAM_SIZE && this.players.size < MAX_PLAYERS) this.addBot(s); }
      else if (m.a === 'switch') this.switchSquad(p);
      else if (m.a === 'start' && this.phase === PHASE.LOBBY) this.startMatch();
      else if (m.a === 'end' && this.phase !== PHASE.LOBBY) { this.msg(`${p.name} ended the match`); this.resetToLobby(); }
    } else if (m.t === 'pick') this.pickOp(p, m.op);
    else if (m.t === 'loadout') {
      const l = store.setLoadout(p.token, m.op, m.l);
      const prof = store.byToken(p.token);
      if (prof) p.sock.send(JSON.stringify({ t: 'profile', profile: publicProfile(prof) }));
    }
  }

  squadCount(s) { let n = 0; for (const q of this.players.values()) if (q.squad === s) n++; return n; }

  addBot(squad) {
    if (this.players.size >= MAX_PLAYERS) return;
    if (squad !== 0 && squad !== 1) squad = this.squadCount(0) <= this.squadCount(1) ? 0 : 1;
    if (this.squadCount(squad) >= TEAM_SIZE) return;
    const used = new Set([...this.players.values()].map(q => q.name));
    const name = BOT_NAMES.find(n => !used.has('[BOT] ' + n)) || 'Bot';
    const b = this.blankPlayer('[BOT] ' + name, true, squad);
    this.players.set(b.id, b);
    if (this.phase !== PHASE.LOBBY && this.phase !== PHASE.SELECT) b.alive = false;
  }
  removeBot(squad) {
    const b = [...this.players.values()].reverse().find(q => q.bot && (squad === undefined || q.squad === squad));
    if (b) { if (b.hasDefuser) this.dropDefuser(b); this.players.delete(b.id); }
  }
  switchSquad(p) {
    if (this.phase !== PHASE.LOBBY) return;
    const to = 1 - p.squad;
    if (this.squadCount(to) >= TEAM_SIZE) { const b = [...this.players.values()].find(q => q.bot && q.squad === to); if (b) b.squad = p.squad; else return; }
    p.squad = to;
  }

  pickOp(p, op) {
    if (this.phase !== PHASE.SELECT || !OPERATORS[op]) return;
    if (OPERATORS[op].team !== this.side(p)) return;
    for (const q of this.players.values()) if (q !== p && q.squad === p.squad && q.op === op) return;
    p.op = op;
  }

  // ---------------- match flow ----------------
  startMatch() {
    if (this.players.size === 0) return;
    this.score = [0, 0]; this.round = 0;
    for (const p of this.players.values()) { p.kills = 0; p.deaths = 0; p.ms = this.blankMatchStats(); }
    this.departed = []; this.roundLog = []; this.matchStart = Date.now();
    this.nextRound();
  }

  nextRound() {
    this.round++;
    this.map = buildMap(); this.mapVersion++; this.changed.clear();
    this.ents = []; this.planted = null; this.winner = null; this.reason = '';
    this.site = Math.floor(Math.random() * this.map.sites.length);
    this.siteRevealed = false;
    this.spots = { atk: new Map(), def: new Map() };
    this.reinforce = 10;
    this.spawnName = this.map.atkSpawns[Math.floor(Math.random() * this.map.atkSpawns.length)].name;
    for (const p of this.players.values()) { p.op = null; p.alive = false; p.ctrl = 'body'; p.busy = null; p.hasDefuser = false; }
    this.phase = PHASE.SELECT; this.timer = DUR.select;
    this.events.push({ e: 'newmap', v: this.mapVersion });
    this.events.push({ e: 'banner', text: `ROUND ${this.round}`, sub: 'Choose your operator' });
  }

  beginPrep() {
    const map = this.map;
    for (const p of this.players.values()) {
      const team = this.side(p);
      if (!p.op) { // random unpicked operator
        const taken = new Set([...this.players.values()].filter(q => q.squad === p.squad && q.op).map(q => q.op));
        const free = opsForTeam(team).filter(o => !taken.has(o));
        p.op = free.length ? free[Math.floor(Math.random() * free.length)] : opsForTeam(team)[0];
      }
      this.equip(p);
    }
    for (const c of map.cams) { // each camera starts facing its longest view
      let best = 0, bestD = -1;
      for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, d = castSight(map, c.x, c.y, a, 600, null); if (d > bestD) { bestD = d; best = a; } }
      this.ents.push({ id: this.eid(), type: 'cam', x: c.x, y: c.y, team: TEAM.DEF, hp: 1, offUntil: 0, ang: best });
    }
    // defenders start on site, attackers at one spawn (their bodies wait while they drone)
    const site = map.sites[this.site];
    const defCells = this.freeCellsInRooms(site.rooms);
    const spawn = map.atkSpawns.find(s => s.name === this.spawnName);
    const atkers = [];
    for (const p of this.players.values()) {
      if (this.side(p) === TEAM.DEF) {
        const k = defCells.splice(Math.floor(Math.random() * defCells.length), 1)[0];
        p.x = (k % map.W + 0.5) * CELL; p.y = (Math.floor(k / map.W) + 0.5) * CELL;
        p.aim = Math.random() * Math.PI * 2;
      } else {
        const pos = this.freeSpotNear(spawn.x, spawn.y, 46);
        p.x = pos.x; p.y = pos.y;
        p.aim = Math.atan2(map.H * CELL / 2 - p.y, map.W * CELL / 2 - p.x);
        const d = { id: this.eid(), type: 'drone', owner: p.id, team: TEAM.ATK, x: p.x + Math.cos(p.aim) * 14, y: p.y + Math.sin(p.aim) * 14, hp: 1, ang: p.aim };
        this.ents.push(d); p.droneId = d.id; p.ctrl = 'drone'; p.drones = 1;
        atkers.push(p);
      }
    }
    if (atkers.length) atkers[Math.floor(Math.random() * atkers.length)].hasDefuser = true;
    for (const p of this.players.values()) if (p.bot) botPrep(this, p);
    this.phase = PHASE.PREP; this.timer = DUR.prep;
    this.events.push({ e: 'banner', text: 'PREPARATION PHASE', sub: '' });
  }

  beginAction() {
    for (const p of this.players.values()) {
      if (this.side(p) === TEAM.ATK) { p.ctrl = 'body'; p.drones += 1; }
      else if (p.ctrl === 'cam') p.ctrl = 'body';
      p.busy = null;
    }
    this.phase = PHASE.ACTION; this.timer = DUR.action;
    this.events.push({ e: 'banner', text: 'ACTION PHASE', sub: '' });
  }

  endRound(winTeam, reason) {
    if (this.phase === PHASE.ROUND_END || this.phase === PHASE.MATCH_END) return;
    const squad = this.squadOfSide(winTeam);
    this.score[squad]++;
    this.roundLog.push({ n: this.round, winner: squad, side: winTeam, reason, attackers: this.squadOfSide(TEAM.ATK), site: this.map.sites[this.site].name });
    for (const p of this.players.values()) {
      if (!p.op || !p.ms) continue;
      const o = this.opStat(p);
      p.ms.rounds++; o.rounds++;
      if (p.squad === squad) { p.ms.roundsWon++; o.roundsWon++; }
    }
    this.winner = squad; this.reason = reason;
    this.phase = PHASE.ROUND_END; this.timer = DUR.roundEnd;
    this.events.push({ e: 'roundEnd', squad, side: winTeam, reason });
    for (const p of this.players.values()) { p.busy = null; if (p.ctrl !== 'body') p.ctrl = 'body'; }
  }

  squadOfSide(team) { return (this.round % 2 === 1) === (team === TEAM.ATK) ? 0 : 1; }

  equip(p) {
    const o = OPERATORS[p.op];
    p.alive = true; p.downed = false; p.maxHp = ARMOR_HP[o.armor]; p.hp = p.maxHp;
    const L = p.bot ? this.botLoadout(p.op) : store.loadout(p.token, p.op);
    p.loadout = L; p.gadget = L.gadget;
    p.guns = [L.primary, L.secondary].filter(Boolean).map(w => ({ w, ammo: WEAPONS[w].mag, reserve: WEAPONS[w].reserve }));
    p.slot = 0; p.fireCd = 0; p.reloadT = 0; p.bloom = 0; p.vx = 0; p.vy = 0; p.gait = 0;
    p.abilityCount = o.ability.count; p.gadgetCount = GADGET_COUNT[p.gadget] || 1;
    p.battery = o.ability.battery || 0; p.scanning = false; p.bracing = false;
    p.drones = 0; p.droneId = null; p.ctrl = 'body'; p.busy = null; p.slowUntil = 0; p.stunUntil = 0;
    p.downedBy = null; p.nitroId = null; p.ai = {};
  }

  // ---------------- simulation ----------------
  tick(dt) {
    this.time += dt;
    if (this.phase === PHASE.LOBBY) return;
    this.timer -= dt;
    if (this.phase === PHASE.SELECT) {
      for (const p of this.players.values()) if (p.bot && !p.op && Math.random() < dt * 0.8) botPickOp(this, p);
      if (this.timer <= 0) this.beginPrep();
      return;
    }
    if (this.phase === PHASE.ROUND_END) {
      if (this.timer <= 0) {
        if (Math.max(...this.score) >= WIN_ROUNDS) {
          this.phase = PHASE.MATCH_END; this.timer = DUR.matchEnd;
          this.events.push({ e: 'matchEnd', squad: this.score[0] > this.score[1] ? 0 : 1 });
          this.saveMatch(this.score[0] > this.score[1] ? 0 : 1);
        } else this.nextRound();
      }
      return;
    }
    if (this.phase === PHASE.MATCH_END) { if (this.timer <= 0) this.resetToLobby(); return; }

    // PREP / ACTION
    for (const p of this.players.values()) if (p.ms && p.alive) p.ms.playSeconds += dt;
    for (const p of this.players.values()) {
      if (p.bot) { botThink(this, p, dt); this.applyMove(p, dt); }
      this.tickPlayer(p, dt);
      p.prevInput = p.input;
    }
    this.tickEnts(dt);

    this.revealCheck -= dt;
    if (this.revealCheck <= 0) { this.revealCheck = 0.25; this.checkReveal(); }

    if (this.phase === PHASE.PREP && this.timer <= 0) this.beginAction();
    else if (this.phase === PHASE.ACTION) this.checkWin();
  }

  checkWin() {
    const up = { atk: 0, def: 0 };
    for (const p of this.players.values()) if (p.alive && !p.downed) up[this.side(p)]++;
    // anyone left downed with no standing teammates bleeds out at once
    for (const p of this.players.values()) if (p.alive && p.downed && up[this.side(p)] === 0) this.kill(p, this.players.get(p.downedBy), 'Bled out');
    const hasAtk = [...this.players.values()].some(p => this.side(p) === TEAM.ATK);
    const hasDef = [...this.players.values()].some(p => this.side(p) === TEAM.DEF);
    if (this.planted) {
      this.planted.t -= 1 / 30;
      if (this.planted.t <= 0) return this.endRound(TEAM.ATK, 'Defuser completed');
      if (hasDef && up.def === 0) return this.endRound(TEAM.ATK, 'Defenders eliminated');
      return;
    }
    if (hasAtk && up.atk === 0) return this.endRound(TEAM.DEF, 'Attackers eliminated');
    if (hasDef && up.def === 0) return this.endRound(TEAM.ATK, 'Defenders eliminated');
    if (this.timer <= 0) return this.endRound(TEAM.DEF, 'Time ran out');
  }

  mods(p) {
    if (p.ctrl === 'drone') {
      const d = this.ent(p.droneId);
      return { drone: true, frozen: !d || this.jammedAt(d.x, d.y) };
    }
    const o = OPERATORS[p.op] || { armor: 2 };
    let mul = 1;
    if (this.time < p.slowUntil) mul *= 0.45;
    if (p.bracing) mul *= 0.45;
    if (p.scanning) mul *= 0.6;
    for (const e of this.ents) if (e.type === 'wire' && e.team !== this.side(p) && Math.hypot(e.x - p.x, e.y - p.y) < 24) { mul *= 0.3; break; }
    const frozen = !p.alive || p.ctrl !== 'body' || !!(p.busy && p.busy.k !== 'revive') ||
      this.phase === PHASE.SELECT || this.phase === PHASE.ROUND_END || this.phase === PHASE.MATCH_END ||
      (this.phase === PHASE.PREP && this.side(p) === TEAM.ATK);
    return { armor: o.armor, mul, downed: p.downed, frozen };
  }

  applyMove(p, dt) {
    if (dt <= 0 || (this.phase !== PHASE.PREP && this.phase !== PHASE.ACTION) || !p.alive) return;
    const m = this.mods(p);
    if (p.ctrl === 'drone') {
      const d = this.ent(p.droneId); if (!d) return;
      stepMove(this.map, d, p.input, dt, m); d.ang = p.aim;
      return;
    }
    if (p.ctrl !== 'body') return;
    const before = { x: p.x, y: p.y };
    stepMove(this.map, p, p.input, dt, m);
    const moved = Math.hypot(p.x - before.x, p.y - before.y) / dt;
    p.moving = moved < 5 ? 0 : (p.input.crouch || p.input.walk) ? 1 : moved > 150 ? 3 : 2;
    if (p.input.sprint && p.moving) p.lastSprint = this.time;
  }

  tickPlayer(p, dt) {
    if (!p.alive) return;
    const team = this.side(p);
    const inp = p.input, prev = p.prevInput;
    p.fireCd -= dt; p.meleeCd -= dt;
    p.bloom = Math.max(0, p.bloom - dt * 0.15);

    if (p.downed) {
      p.hp -= dt; p.busy = null;
      if (p.hp <= 0) this.kill(p, this.players.get(p.downedBy), 'Bled out');
      return;
    }

    // defuser pickup
    if (team === TEAM.ATK && p.ctrl === 'body') for (const e of this.ents) {
      if (e.type === 'defuser' && Math.hypot(e.x - p.x, e.y - p.y) < 18) {
        p.hasDefuser = true; this.removeEnt(e); this.msg(`${p.name} picked up the defuser`, TEAM.ATK); break;
      }
    }

    // reloading
    const gun = p.guns[p.slot];
    if (p.reloadT > 0) {
      p.reloadT -= dt;
      if (p.reloadT <= 0 && gun) {
        const need = WEAPONS[gun.w].mag - gun.ammo, take = Math.min(need, gun.reserve);
        gun.ammo += take; gun.reserve -= take; p.reloadT = 0;
      }
    }

    // held abilities
    const op = OPERATORS[p.op];
    p.bracing = op.ability.id === 'brace' && !!inp.ability && p.ctrl === 'body';
    if (op.ability.id === 'scan') {
      if (inp.ability && p.battery > 0 && p.ctrl === 'body') {
        p.scanning = true; p.battery = Math.max(0, p.battery - dt);
        for (const q of this.players.values())
          if (q.alive && this.side(q) === TEAM.ATK && Math.hypot(q.x - p.x, q.y - p.y) < 300) this.spot(TEAM.DEF, q.id, 0.4);
      } else { p.scanning = false; p.battery = Math.min(op.ability.battery, p.battery + dt * 0.35); }
    }

    // interaction (hold E)
    if (inp.interact && p.ctrl === 'body') {
      if (!p.busy) p.busy = this.startInteract(p);
      if (p.busy) this.continueInteract(p, dt);
    } else p.busy = null;

    // shooting
    const canShoot = p.ctrl === 'body' && !p.busy && p.reloadT <= 0 && !p.scanning && !p.bracing && gun &&
      !(inp.sprint && p.moving >= 3);
    if (canShoot && inp.fire) {
      const w = WEAPONS[gun.w];
      const edge = !prev.fire;
      if (p.fireCd <= 0 && (w.auto || edge)) {
        if (gun.ammo > 0) this.fire(p, gun, w);
        else if (gun.reserve > 0) this.startReload(p);
        else if (edge) this.events.push({ e: 'snd', s: 'empty', x: r1(p.x), y: r1(p.y) });
      }
    }
  }

  startReload(p) {
    const gun = p.guns[p.slot];
    if (!gun || p.reloadT > 0 || gun.reserve <= 0 || gun.ammo >= WEAPONS[gun.w].mag) return;
    p.reloadT = WEAPONS[gun.w].reload;
    this.events.push({ e: 'snd', s: 'reload', x: r1(p.x), y: r1(p.y), id: p.id });
  }

  fire(p, gun, w) {
    gun.ammo--; p.fireCd = 60 / w.rpm; p.lastShot = this.time;
    if (p.ms) p.ms.shots += w.pellets;
    const moving = p.moving >= 2 ? 0.035 : 0;
    const spread = (p.input.ads ? w.ads : w.spread) + p.bloom + moving * (p.input.ads ? 0.4 : 1) + (p.input.crouch ? -0.006 : 0);
    p.bloom = Math.min(0.08, p.bloom + w.bloom);
    const mx = p.x + Math.cos(p.aim) * (w.len + 6), my = p.y + Math.sin(p.aim) * (w.len + 6);
    for (let i = 0; i < w.pellets; i++) {
      const a = p.aim + gauss() * Math.max(0.002, spread);
      const end = this.hitscan(p, p.x, p.y, a, w.range, w.dmg, w.name);
      if (i < 3) this.events.push({ e: 'shot', id: p.id, w: gun.w, x: r1(mx), y: r1(my), x2: r1(end.x), y2: r1(end.y), k: end.k });
    }
    if (w.pellets > 1) this.events.push({ e: 'shotgun', id: p.id });
  }

  // Bullet: stops at the first enemy, goes through soft walls (damaging them), stops on hard ones.
  hitscan(src, x0, y0, ang, range, dmg, wname) {
    const dx = Math.cos(ang), dy = Math.sin(ang), team = this.side(src);
    let best = null, bestT = range;
    for (const q of this.players.values()) {
      if (q === src || !q.alive || this.side(q) === team) continue;
      const t = rayCircle(x0, y0, dx, dy, q.x, q.y, PLAYER_R);
      if (t !== null && t < bestT) { bestT = t; best = { q }; }
    }
    for (const e of this.ents) {
      if (!e.hp || e.team === team) continue;
      const t = rayCircle(x0, y0, dx, dy, e.x, e.y, e.type === 'drone' ? 6 : 6);
      if (t !== null && t < bestT) { bestT = t; best = { e }; }
    }
    let mult = 1, stopT = bestT, kind = best ? 'flesh' : 'none', pens = 0;
    const sx = Math.floor(x0 / CELL), sy = Math.floor(y0 / CELL);
    walkRay(x0, y0, dx, dy, bestT, (cx, cy, t) => {
      if (cx === sx && cy === sy) return false;
      const k = cy * this.map.W + cx, tile = tileAt(this.map, cx, cy);
      if (stopsBullet(tile)) { stopT = t; kind = tile === T.TALL ? 'prop' : 'hard'; best = null; return true; }
      if (penBullet(tile)) {
        this.damageCell(k, dmg * 0.6);
        mult *= 0.6; pens++;
        if (pens === 1) this.events.push({ e: 'hit', k: 'wall', x: r1(x0 + dx * t), y: r1(y0 + dy * t) });
        if (pens > 3) { stopT = t; kind = 'wall'; best = null; return true; }
      }
      return false;
    });
    const ex = x0 + dx * stopT, ey = y0 + dy * stopT;
    if (best && best.q) {
      const q = best.q;
      if (OPERATORS[q.op].ability.id === 'brace' && !q.downed && q.ctrl === 'body') {
        const arc = q.bracing ? 1.45 : 0.95;
        if (Math.abs(angDiff(Math.atan2(y0 - q.y, x0 - q.x), q.aim)) < arc) {
          this.events.push({ e: 'hit', k: 'shield', x: r1(ex), y: r1(ey) });
          return { x: ex, y: ey, k: 'shield' };
        }
      }
      if (src.ms) src.ms.hits++;
      this.damage(q, dmg * mult, src, wname, ang);
    } else if (best && best.e) this.hitEnt(best.e, src);
    else if (kind === 'hard' || kind === 'prop') this.events.push({ e: 'hit', k: kind, x: r1(ex), y: r1(ey) });
    return { x: ex, y: ey, k: kind };
  }

  damageCell(k, amount) {
    const t = this.map.tiles[k];
    if (t !== T.SOFT && t !== T.BARRI && t !== T.PANEL && t !== T.DSHIELD) return;
    this.map.hp[k] -= amount;
    if (this.map.hp[k] <= 0) this.destroyCell(k); else this.changed.add(k);
  }

  destroyCell(k) {
    const m = this.map, t = m.tiles[k];
    if (t === T.BARRI || t === T.PANEL) m.tiles[k] = T.OPEN;
    else if (m.openId[k] >= 0) m.tiles[k] = T.OPEN;
    else m.tiles[k] = (m.floor[k] === FL.GRASS || m.floor[k] === FL.ASPHALT) ? T.GROUND : T.FLOOR;
    m.hp[k] = 0; this.changed.add(k);
  }

  damage(q, amount, src, wname, ang) {
    if (!q.alive || amount <= 0) return;
    amount = Math.round(amount);
    if (src && src.ms && src !== q && this.side(src) !== this.side(q)) src.ms.damage += Math.min(amount, Math.max(0, q.hp));
    if (src && src.sock) this.events.push({ e: 'hitmark', to: src.id, kill: false });
    this.events.push({ e: 'hit', k: 'blood', x: r1(q.x), y: r1(q.y), a: r2(ang || 0) });
    this.events.push({ e: 'hurt', id: q.id, from: src ? r2(Math.atan2(src.y - q.y, src.x - q.x)) : 0 });
    if (q.downed) return this.kill(q, src, wname);
    q.hp -= amount;
    if (q.hp <= 0) {
      const up = [...this.players.values()].filter(o => o.alive && !o.downed && this.side(o) === this.side(q)).length;
      if (q.hp > -35 && up > 1 && this.phase === PHASE.ACTION) {
        if (src && src.ms && src !== q) src.ms.downs++;
        q.downed = true; q.hp = DUR.bleedout; q.downedBy = src ? src.id : null; q.busy = null; q.ctrl = 'body';
        q.scanning = false; q.bracing = false; q.reloadT = 0;
        this.events.push({ e: 'down', id: q.id, by: src ? src.id : null });
        if (q.hasDefuser) this.dropDefuser(q);
      } else this.kill(q, src, wname);
    }
  }

  kill(q, src, wname) {
    if (!q.alive) return;
    q.alive = false; q.downed = false; q.hp = 0; q.deaths++; q.busy = null; q.scanning = false; q.bracing = false;
    if (q.ctrl !== 'body') q.ctrl = 'body';
    if (src && src !== q) { src.kills++; if (src.ms && this.side(src) !== this.side(q)) { src.ms.kills++; this.opStat(src).kills++; } }
    if (q.ms) { q.ms.deaths++; this.opStat(q).deaths++; }
    if (src && src.sock) this.events.push({ e: 'hitmark', to: src.id, kill: true });
    this.events.push({ e: 'kill', killer: src ? src.id : null, victim: q.id, w: wname || '' });
    if (q.hasDefuser) this.dropDefuser(q);
    const d = this.ent(q.droneId); if (d && this.phase === PHASE.PREP) this.removeEnt(d);
  }

  dropDefuser(p) {
    p.hasDefuser = false;
    this.ents.push({ id: this.eid(), type: 'defuser', x: p.x, y: p.y, team: TEAM.ATK });
    this.msg('The defuser was dropped', TEAM.ATK);
  }

  hitEnt(e, src) {
    if (e.type === 'cam') { e.hp = 0; this.events.push({ e: 'hit', k: 'spark', x: r1(e.x), y: r1(e.y) }); this.events.push({ e: 'snd', s: 'break', x: r1(e.x), y: r1(e.y) }); return; }
    this.events.push({ e: 'hit', k: 'spark', x: r1(e.x), y: r1(e.y) });
    this.events.push({ e: 'snd', s: 'break', x: r1(e.x), y: r1(e.y) });
    this.removeEnt(e);
  }

  // ---------------- interaction ----------------
  startInteract(p) {
    const team = this.side(p);
    if (this.phase === PHASE.ACTION && team === TEAM.ATK && p.hasDefuser && !this.planted) {
      const b = this.map.sites[this.site].bombs.find(b => Math.hypot(b.x - p.x, b.y - p.y) < 30);
      if (b) { this.events.push({ e: 'snd', s: 'plantStart', x: r1(p.x), y: r1(p.y) }); return { k: 'plant', t: 0, dur: DUR.plant, bomb: b.id }; }
    }
    if (team === TEAM.DEF && this.planted && Math.hypot(this.planted.x - p.x, this.planted.y - p.y) < 30)
      return { k: 'defuse', t: 0, dur: DUR.defuse };
    for (const q of this.players.values())
      if (q !== p && q.alive && q.downed && this.side(q) === team && Math.hypot(q.x - p.x, q.y - p.y) < 26)
        return { k: 'revive', t: 0, dur: DUR.revive, target: q.id };
    if (team === TEAM.DEF && (this.phase === PHASE.PREP || this.phase === PHASE.ACTION)) {
      const f = this.facingCell(p, 26);
      if (f && f.t === T.SOFT && this.reinforce > 0) return { k: 'reinforce', t: 0, dur: DUR.reinforce, cell: f.k };
      if (f && f.t === T.OPEN && this.map.openId[f.k] >= 0) return { k: 'barricade', t: 0, dur: DUR.barricade, cell: f.k };
    }
    return null;
  }

  continueInteract(p, dt) {
    const b = p.busy;
    if (b.k === 'revive') {
      const q = this.players.get(b.target);
      if (!q || !q.alive || !q.downed || Math.hypot(q.x - p.x, q.y - p.y) > 32) { p.busy = null; return; }
    }
    b.t += dt;
    if (b.t < b.dur) return;
    p.busy = null; p.input.interact = 0;
    if (b.k === 'plant') {
      const bomb = this.map.sites[this.site].bombs.find(x => x.id === b.bomb);
      this.planted = { x: bomb.x, y: bomb.y, bomb: bomb.id, t: DUR.bomb };
      p.hasDefuser = false; if (p.ms) p.ms.plants++;
      this.events.push({ e: 'banner', text: 'DEFUSER PLANTED', sub: `Bomb ${bomb.id} — ${bomb.room}` });
      this.events.push({ e: 'snd', s: 'planted', x: r1(bomb.x), y: r1(bomb.y) });
    } else if (b.k === 'defuse') {
      this.events.push({ e: 'banner', text: 'DEFUSER DISABLED', sub: '' }); if (p.ms) p.ms.defuses++;
      this.endRound(TEAM.DEF, 'Defuser disabled');
    } else if (b.k === 'revive') {
      const q = this.players.get(b.target);
      q.downed = false; q.hp = 25; if (p.ms) p.ms.revives++; this.events.push({ e: 'snd', s: 'revive', x: r1(q.x), y: r1(q.y) });
    } else if (b.k === 'reinforce') {
      if (this.map.tiles[b.cell] === T.SOFT && this.reinforce > 0) { this.reinforceWall(b.cell); this.reinforce--; }
    } else if (b.k === 'barricade') this.barricade(this.map.openId[b.cell], T.BARRI);
  }

  facingCell(p, reach) { return facingCell(this.map, p.x, p.y, p.aim, reach); }

  reinforceWall(k) {
    const m = this.map, W = m.W, x = k % W, y = Math.floor(k / W);
    const isW = (cx, cy) => { const t = tileAt(m, cx, cy); return t === T.SOFT || t === T.REINF || t === T.HARD; };
    const horiz = (isW(x - 1, y) || isW(x + 1, y)) && !(isW(x, y - 1) && isW(x, y + 1));
    const cells = [k];
    for (const s of [-1, 1]) for (let i = 1; i <= 2; i++) {
      const cx = horiz ? x + s * i : x, cy = horiz ? y : y + s * i;
      if (tileAt(m, cx, cy) !== T.SOFT) break;
      cells.push(cy * W + cx);
    }
    for (const c of cells) { m.tiles[c] = T.REINF; m.hp[c] = 0; this.changed.add(c); }
    this.events.push({ e: 'snd', s: 'reinforce', x: r1((x + 0.5) * CELL), y: r1((y + 0.5) * CELL) });
  }

  cellOccupied(k) {
    const W = this.map.W, rx = (k % W) * CELL, ry = Math.floor(k / W) * CELL;
    for (const q of this.players.values()) {
      if (!q.alive) continue;
      const nx = Math.max(rx, Math.min(q.x, rx + CELL)), ny = Math.max(ry, Math.min(q.y, ry + CELL));
      if (Math.hypot(q.x - nx, q.y - ny) < PLAYER_R) return true;
    }
    return false;
  }

  barricade(openingId, type) {
    const o = this.map.openings[openingId];
    if (!o) return false;
    if (o.cells.some(c => this.cellOccupied(c))) return false;
    if (type === T.BARRI && o.cells.some(c => this.map.tiles[c] !== T.OPEN)) return false;
    for (const c of o.cells) { this.map.tiles[c] = type; this.map.hp[c] = CELL_HP[type]; this.changed.add(c); }
    const c0 = o.cells[0], W = this.map.W;
    this.events.push({ e: 'snd', s: type === T.PANEL ? 'panel' : 'barricade', x: (c0 % W + 0.5) * CELL, y: (Math.floor(c0 / W) + 0.5) * CELL });
    return true;
  }

  // ---------------- discrete events (keys pressed) ----------------
  event(p, e) {
    if (!e || typeof e !== 'object') return;
    const active = (this.phase === PHASE.PREP || this.phase === PHASE.ACTION) && p.alive;
    if (!active) return;
    const team = this.side(p);
    switch (e.k) {
      case 'reload': if (!p.downed && p.ctrl === 'body') this.startReload(p); break;
      case 'slot': if (!p.downed && p.guns[e.n] && e.n !== p.slot) { p.slot = e.n; p.reloadT = 0; p.fireCd = 0.35; this.events.push({ e: 'snd', s: 'swap', x: r1(p.x), y: r1(p.y), id: p.id }); } break;
      case 'melee': this.melee(p); break;
      case 'ability': if (!p.downed && p.ctrl === 'body' && !p.busy) this.useAbility(p); break;
      case 'gadget': if (!p.downed && p.ctrl === 'body' && !p.busy) this.useGadget(p); break;
      case 'view': this.toggleView(p); break;
      case 'camNext': case 'camPrev': if (p.ctrl === 'cam') this.cycleCam(p, e.k === 'camNext' ? 1 : -1); break;
      case 'camSet': if (p.ctrl === 'cam') { const n = this.aliveCams().length; if (n) p.camIdx = Math.max(0, Math.min(n - 1, e.n | 0)); } break;
      case 'spot': {
        const q = this.players.get(e.id);
        if (q && q.alive && this.side(q) !== team) this.spot(team, q.id, DUR.spot);
        break;
      }
    }
  }

  toggleView(p) {
    if (p.downed) return;
    const team = this.side(p);
    if (team === TEAM.ATK) {
      if (this.phase === PHASE.PREP) return;
      if (p.ctrl === 'drone') { p.ctrl = 'body'; return; }
      if (p.ctrl !== 'body' || p.busy) return;
      if (!this.ent(p.droneId)) {
        if (p.drones <= 0) return;
        p.drones--;
        const pos = this.freeSpotNear(p.x + Math.cos(p.aim) * 12, p.y + Math.sin(p.aim) * 12, 10, true);
        const d = { id: this.eid(), type: 'drone', owner: p.id, team: TEAM.ATK, x: pos.x, y: pos.y, hp: 1, ang: p.aim };
        this.ents.push(d); p.droneId = d.id;
      }
      p.ctrl = 'drone';
    } else {
      if (p.ctrl === 'cam') { p.ctrl = 'body'; return; }
      if (p.ctrl !== 'body' || p.busy) return;
      const cams = this.ents.filter(e => e.type === 'cam' && e.hp > 0);
      if (!cams.length) return;
      p.ctrl = 'cam'; p.camIdx = 0;
    }
  }

  aliveCams() { return this.ents.filter(e => e.type === 'cam' && e.hp > 0); }

  cycleCam(p, dir) {
    const cams = this.aliveCams();
    if (!cams.length) { p.ctrl = 'body'; return; }
    p.camIdx = (p.camIdx + dir + cams.length) % cams.length;
  }

  melee(p) {
    if (p.meleeCd > 0 || p.downed || p.ctrl !== 'body') return;
    p.meleeCd = 0.75;
    this.events.push({ e: 'melee', id: p.id });
    const team = this.side(p);
    for (const q of this.players.values()) {
      if (!q.alive || this.side(q) === team) continue;
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < 28 && Math.abs(angDiff(Math.atan2(q.y - p.y, q.x - p.x), p.aim)) < 1.1 && los(this.map, p.x, p.y, q.x, q.y)) {
        this.damage(q, q.downed ? 999 : 55, p, 'Melee', p.aim); return;
      }
    }
    for (const e of this.ents) {
      if (e.team === team || !(e.hp || e.type === 'wire')) continue;
      if (Math.hypot(e.x - p.x, e.y - p.y) < 26) { this.hitEnt(e, p); return; }
    }
    const f = this.facingCell(p, 20);
    if (!f) return;
    if (f.t === T.BARRI) {
      const o = this.map.openings[this.map.openId[f.k]];
      // a melee hit knocks out the struck plank plus a neighbour
      this.destroyCell(f.k);
      const rest = o ? o.cells.filter(c => this.map.tiles[c] === T.BARRI) : [];
      if (rest.length) this.destroyCell(rest[0]);
      this.events.push({ e: 'hit', k: 'wood', x: r1((f.cx + 0.5) * CELL), y: r1((f.cy + 0.5) * CELL) });
    } else if (f.t === T.SOFT) { this.damageCell(f.k, 25); this.events.push({ e: 'hit', k: 'wall', x: r1((f.cx + 0.5) * CELL), y: r1((f.cy + 0.5) * CELL) }); }
    else if (f.t === T.PANEL) { this.damageCell(f.k, 30); this.events.push({ e: 'hit', k: 'spark', x: r1((f.cx + 0.5) * CELL), y: r1((f.cy + 0.5) * CELL) }); }
  }

  wallInFront(p, types) {
    const f = this.facingCell(p, 30);
    if (!f || !types.includes(f.t)) return null;
    // stick to the face of the wall nearest the player
    const cx = (f.cx + 0.5) * CELL, cy = (f.cy + 0.5) * CELL;
    const a = Math.atan2(p.y - cy, p.x - cx);
    const horiz = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a));
    return { ...f, x: cx + (horiz ? Math.sign(Math.cos(a)) * 9 : 0), y: cy + (horiz ? 0 : Math.sign(Math.sin(a)) * 9) };
  }

  useAbility(p) {
    const op = OPERATORS[p.op], team = this.side(p), id = op.ability.id;
    if (op.ability.count && p.abilityCount <= 0) return;
    const used = () => { p.abilityCount--; };
    if (id === 'cutter') {
      const w = this.wallInFront(p, [T.SOFT, T.REINF, T.BARRI, T.PANEL, T.DSHIELD]);
      if (!w) return;
      this.ents.push({ id: this.eid(), type: 'cutter', x: w.x, y: w.y, cell: w.k, team, owner: p.id, t: 5, hp: 1 });
      used(); this.events.push({ e: 'snd', s: 'place', x: r1(w.x), y: r1(w.y) });
    } else if (id === 'dart') {
      const d = castSight(this.map, p.x, p.y, p.aim, 380, null);
      const x = p.x + Math.cos(p.aim) * (d - 3), y = p.y + Math.sin(p.aim) * (d - 3);
      this.ents.push({ id: this.eid(), type: 'dart', x, y, team, owner: p.id, life: 10, ping: 0, hp: 1 });
      used(); this.events.push({ e: 'snd', s: 'dart', x: r1(p.x), y: r1(p.y) });
    } else if (id === 'slug') {
      this.ents.push({ id: this.eid(), type: 'slug', x: p.x + Math.cos(p.aim) * 12, y: p.y + Math.sin(p.aim) * 12,
        vx: Math.cos(p.aim) * 650, vy: Math.sin(p.aim) * 650, team, owner: p.id, travel: 0 });
      used(); this.events.push({ e: 'snd', s: 'launcher', x: r1(p.x), y: r1(p.y) });
    } else if (id === 'emp') { this.throwNade(p, 'emp'); used(); }
    else if (id === 'panel') {
      const f = this.facingCell(p, 28);
      if (!f || (f.t !== T.OPEN && f.t !== T.BARRI) || this.map.openId[f.k] < 0) return;
      if (this.barricade(this.map.openId[f.k], T.PANEL)) used();
    } else if (id === 'jammer') {
      this.ents.push({ id: this.eid(), type: 'jammer', x: p.x + Math.cos(p.aim) * 8, y: p.y + Math.sin(p.aim) * 8, team, owner: p.id, hp: 1 });
      used(); this.events.push({ e: 'snd', s: 'place', x: r1(p.x), y: r1(p.y) });
    } else if (id === 'mine') {
      this.ents.push({ id: this.eid(), type: 'mine', x: p.x + Math.cos(p.aim) * 10, y: p.y + Math.sin(p.aim) * 10, ang: p.aim, team, owner: p.id, arm: 1.5, hp: 1 });
      used(); this.events.push({ e: 'snd', s: 'place', x: r1(p.x), y: r1(p.y) });
    } else if (id === 'stim') {
      const dx = Math.cos(p.aim), dy = Math.sin(p.aim);
      let tgt = null, tb = castSight(this.map, p.x, p.y, p.aim, 420, null);
      for (const q of this.players.values()) {
        if (q === p || !q.alive || this.side(q) !== team) continue;
        const t = rayCircle(p.x, p.y, dx, dy, q.x, q.y, 13);
        if (t !== null && t < tb) { tb = t; tgt = q; }
      }
      tgt = tgt || p;
      if (tgt.downed) { tgt.downed = false; tgt.hp = 40; if (p.ms) p.ms.revives++; }
      else tgt.hp = Math.min(tgt.maxHp + 30, tgt.hp + 40);
      used();
      this.events.push({ e: 'stim', x: r1(p.x), y: r1(p.y), x2: r1(tgt.x), y2: r1(tgt.y) });
    }
  }

  useGadget(p) {
    const op = OPERATORS[p.op], team = this.side(p), g = p.gadget || op.gadget;
    if (g === 'nitro' && p.nitroId) { // second press sets it off
      const n = this.ent(p.nitroId); p.nitroId = null;
      if (n) this.detonate(n);
      return;
    }
    if (p.gadgetCount <= 0) return;
    if (['smoke', 'frag', 'stun', 'impact', 'nitro'].includes(g)) {
      const n = this.throwNade(p, g); p.gadgetCount--;
      if (g === 'nitro') p.nitroId = n.id;
    } else if (g === 'breach') {
      const w = this.wallInFront(p, [T.SOFT, T.BARRI]);
      if (!w) return;
      this.ents.push({ id: this.eid(), type: 'breach', x: w.x, y: w.y, cell: w.k, team, owner: p.id, t: 2.5, hp: 1 });
      p.gadgetCount--; this.events.push({ e: 'snd', s: 'place', x: r1(w.x), y: r1(w.y) });
    } else if (g === 'claymore') {
      this.ents.push({ id: this.eid(), type: 'claymore', x: p.x + Math.cos(p.aim) * 10, y: p.y + Math.sin(p.aim) * 10, ang: p.aim, team, owner: p.id, arm: 1.5, hp: 1 });
      p.gadgetCount--; this.events.push({ e: 'snd', s: 'place', x: r1(p.x), y: r1(p.y) });
    } else if (g === 'wire') {
      this.ents.push({ id: this.eid(), type: 'wire', x: p.x + Math.cos(p.aim) * 22, y: p.y + Math.sin(p.aim) * 22, ang: p.aim, team, owner: p.id });
      p.gadgetCount--; this.events.push({ e: 'snd', s: 'place', x: r1(p.x), y: r1(p.y) });
    } else if (g === 'dshield') {
      // two cells side by side, across your aim, just in front of you
      const fx = p.x + Math.cos(p.aim) * 20, fy = p.y + Math.sin(p.aim) * 20;
      const across = Math.abs(Math.cos(p.aim)) > Math.abs(Math.sin(p.aim)) ? [0, 1] : [1, 0];
      const cx = Math.floor(fx / CELL), cy = Math.floor(fy / CELL);
      const ks = [[cx, cy], [cx + across[0], cy + across[1]]].map(([x, y]) => y * this.map.W + x);
      if (ks.some(k => { const t = this.map.tiles[k]; return (t !== T.FLOOR && t !== T.GROUND) || this.cellOccupied(k); })) return;
      for (const k of ks) { this.map.tiles[k] = T.DSHIELD; this.map.hp[k] = CELL_HP[T.DSHIELD]; this.changed.add(k); }
      p.gadgetCount--; this.events.push({ e: 'snd', s: 'panel', x: r1(fx), y: r1(fy) });
    }
  }

  throwNade(p, kind) {
    const tx = p.aimX ?? p.x + Math.cos(p.aim) * 200, ty = p.aimY ?? p.y + Math.sin(p.aim) * 200;
    const dist = Math.max(40, Math.min(300, Math.hypot(tx - p.x, ty - p.y)));
    const v = dist * 2.5;
    const fuse = { frag: 2.5, smoke: 1.0, stun: 1.3, impact: 3, nitro: 999, emp: 1.5 }[kind];
    const n = { id: this.eid(), type: 'nade', kind, x: p.x + Math.cos(p.aim) * 10, y: p.y + Math.sin(p.aim) * 10,
      vx: Math.cos(p.aim) * v, vy: Math.sin(p.aim) * v, fuse, team: this.side(p), owner: p.id };
    this.ents.push(n);
    this.events.push({ e: 'snd', s: 'throw', x: r1(p.x), y: r1(p.y) });
    return n;
  }

  // ---------------- entities ----------------
  eid() { return 'e' + (this.nextId++); }
  ent(id) { return id ? this.ents.find(e => e.id === id) : null; }
  removeEnt(e) { const i = this.ents.indexOf(e); if (i >= 0) this.ents.splice(i, 1); }

  jammedAt(x, y) {
    for (const e of this.ents) if (e.type === 'jammer' && Math.hypot(e.x - x, e.y - y) < JAM_R) return true;
    return false;
  }

  spot(team, id, dur) {
    const until = this.time + dur;
    if ((this.spots[team].get(id) || 0) < until) this.spots[team].set(id, until);
  }

  tickEnts(dt) {
    for (const e of [...this.ents]) {
      if (!this.ents.includes(e)) continue;
      switch (e.type) {
        case 'drone': {
          const o = this.players.get(e.owner);
          if (!o || !o.alive) { if (o && o.ctrl === 'drone') o.ctrl = 'body'; }
          break;
        }
        case 'nade': this.tickNade(e, dt); break;
        case 'smoke': e.life -= dt; if (e.life <= 0) this.removeEnt(e); break;
        case 'cutter': case 'breach':
          if (!this.jammedAt(e.x, e.y)) e.t -= dt;
          if (e.t <= 0) this.detonate(e);
          break;
        case 'dart':
          e.life -= dt; e.ping -= dt;
          if (e.ping <= 0 && !this.jammedAt(e.x, e.y)) {
            e.ping = 1.5;
            let any = false;
            for (const q of this.players.values()) if (q.alive && this.side(q) !== e.team && Math.hypot(q.x - e.x, q.y - e.y) < 170) { this.spot(e.team, q.id, 1.6); any = true; }
            this.events.push({ e: 'ping', x: r1(e.x), y: r1(e.y), team: e.team, any });
          }
          if (e.life <= 0) this.removeEnt(e);
          break;
        case 'slug': {
          const step = Math.hypot(e.vx, e.vy) * dt;
          const dx = e.vx / (step / dt), dy = e.vy / (step / dt);
          let hitT = null;
          for (const q of this.players.values()) {
            if (!q.alive || this.side(q) === e.team) continue;
            const t = rayCircle(e.x, e.y, dx, dy, q.x, q.y, PLAYER_R);
            if (t !== null && t <= step && (hitT === null || t < hitT)) hitT = t;
          }
          const wallT = walkRay(e.x, e.y, dx, dy, step, (cx, cy) => blocksDrone(tileAt(this.map, cx, cy)) || tileAt(this.map, cx, cy) === T.BARRI);
          if (hitT !== null && hitT < wallT) { e.x += dx * hitT; e.y += dy * hitT; this.detonate(e); break; }
          if (wallT < step) { e.x += dx * (wallT + 5); e.y += dy * (wallT + 5); this.detonate(e); break; }
          e.x += e.vx * dt; e.y += e.vy * dt; e.travel += step;
          if (e.travel > 520) this.detonate(e);
          break;
        }
        case 'mine': case 'claymore': {
          if (e.arm > 0) { e.arm -= dt; break; }
          for (const q of this.players.values()) {
            if (!q.alive || this.side(q) === e.team) continue;
            const d = Math.hypot(q.x - e.x, q.y - e.y);
            const inCone = e.type === 'mine' ? d < 22 : d < 44 && Math.abs(angDiff(Math.atan2(q.y - e.y, q.x - e.x), e.ang)) < 0.7;
            if (inCone && los(this.map, e.x, e.y, q.x, q.y)) { this.detonate(e); break; }
          }
          break;
        }
      }
    }
    // cameras can be blinded; drones of dead owners stay put
    for (const [team, m] of Object.entries(this.spots)) for (const [id, until] of m) if (until < this.time) m.delete(id);
  }

  tickNade(e, dt) {
    const sp = Math.hypot(e.vx, e.vy);
    const nx = e.x + e.vx * dt, ny = e.y + e.vy * dt;
    const blocked = (x, y) => { const t = tileAt(this.map, Math.floor(x / CELL), Math.floor(y / CELL)); return blocksDrone(t) || t === T.BARRI; };
    let bounced = false;
    if (blocked(nx, e.y)) { e.vx = -e.vx * 0.45; bounced = true; } else e.x = nx;
    if (blocked(e.x, ny)) { e.vy = -e.vy * 0.45; bounced = true; } else e.y = ny;
    const f = Math.exp(-2.5 * dt); e.vx *= f; e.vy *= f;
    if (bounced && sp > 60) this.events.push({ e: 'snd', s: 'bounce', x: r1(e.x), y: r1(e.y) });
    if (e.kind === 'impact' && bounced) return this.detonate(e);
    if (e.kind === 'nitro') return; // waits for its owner
    e.fuse -= dt;
    if (e.fuse <= 0) this.detonate(e);
  }

  detonate(e) {
    this.removeEnt(e);
    const kind = e.type === 'nade' ? e.kind : e.type;
    const SOFTISH = [T.SOFT, T.BARRI];
    switch (kind) {
      case 'frag': this.explode(e, { r: 75, dmg: 130, cellR: 14, cells: SOFTISH, kind: 'frag' }); break;
      case 'impact': this.explode(e, { r: 34, dmg: 40, cellR: 22, cells: SOFTISH, kind: 'impact' }); break;
      case 'nitro': this.explode(e, { r: 70, dmg: 140, cellR: 20, cells: SOFTISH, kind: 'nitro' }); break;
      case 'slug': this.explode(e, { r: 36, dmg: 75, cellR: 21, cells: SOFTISH, kind: 'slug', selfMul: 0.3 }); break;
      case 'breach': this.explode(e, { r: 40, dmg: 60, cellR: 21, cells: SOFTISH, kind: 'breach', at: e.cell }); break;
      case 'claymore': this.explode(e, { r: 50, dmg: 95, cellR: 0, cells: [], kind: 'frag', cone: e.ang }); break;
      case 'mine': {
        this.explode(e, { r: 32, dmg: 55, cellR: 0, cells: [], kind: 'mine' });
        for (const q of this.players.values()) if (q.alive && this.side(q) !== e.team && Math.hypot(q.x - e.x, q.y - e.y) < 40) {
          q.slowUntil = this.time + 3; this.spot(e.team, q.id, 4);
        }
        break;
      }
      case 'cutter': this.explode(e, { r: 30, dmg: 40, cellR: 40, cells: [T.SOFT, T.REINF, T.BARRI, T.PANEL, T.DSHIELD], kind: 'cutter', at: e.cell }); break;
      case 'smoke': this.ents.push({ id: this.eid(), type: 'smoke', x: e.x, y: e.y, r: 62, life: 12, team: e.team }); this.events.push({ e: 'snd', s: 'smoke', x: r1(e.x), y: r1(e.y) }); break;
      case 'stun': {
        this.events.push({ e: 'boom', x: r1(e.x), y: r1(e.y), r: 40, kind: 'stun' });
        for (const q of this.players.values()) {
          if (!q.alive) continue;
          const d = Math.hypot(q.x - e.x, q.y - e.y);
          if (d < 170 && los(this.map, e.x, e.y, q.x, q.y)) {
            const dur = 3.5 * (1 - d / 220);
            q.stunUntil = Math.max(q.stunUntil, this.time + dur);
            this.events.push({ e: 'stun', id: q.id, dur: r2(dur) });
          }
        }
        break;
      }
      case 'emp': {
        this.events.push({ e: 'boom', x: r1(e.x), y: r1(e.y), r: 110, kind: 'emp' });
        for (const o of [...this.ents]) {
          if (o.team === e.team || Math.hypot(o.x - e.x, o.y - e.y) > 110) continue;
          if (o.type === 'cam') o.offUntil = this.time + 12;
          else if (['jammer', 'mine', 'nade', 'claymore'].includes(o.type)) this.removeEnt(o);
        }
        break;
      }
    }
  }

  explode(e, o) {
    const owner = this.players.get(e.owner);
    let cx = e.x, cy = e.y;
    if (o.at !== undefined) { cx = (o.at % this.map.W + 0.5) * CELL; cy = (Math.floor(o.at / this.map.W) + 0.5) * CELL; }
    this.events.push({ e: 'boom', x: r1(e.x), y: r1(e.y), r: o.r, kind: o.kind });
    if (o.cellR > 0) {
      const m = this.map, rr = Math.ceil(o.cellR / CELL) + 1;
      const gx = Math.floor(cx / CELL), gy = Math.floor(cy / CELL);
      for (let y = gy - rr; y <= gy + rr; y++) for (let x = gx - rr; x <= gx + rr; x++) {
        if (x < 0 || y < 0 || x >= m.W || y >= m.H) continue;
        if (Math.hypot((x + 0.5) * CELL - cx, (y + 0.5) * CELL - cy) > o.cellR) continue;
        const k = y * m.W + x;
        if (o.cells.includes(m.tiles[k])) this.destroyCell(k);
      }
    }
    for (const q of this.players.values()) {
      if (!q.alive) continue;
      const self = owner && q === owner;
      if (!self && this.side(q) === e.team) continue;
      const d = Math.hypot(q.x - e.x, q.y - e.y);
      if (d > o.r) continue;
      if (o.cone !== undefined && Math.abs(angDiff(Math.atan2(q.y - e.y, q.x - e.x), o.cone)) > 0.8) continue;
      let blocked = false;
      const sx = Math.floor(e.x / CELL), sy = Math.floor(e.y / CELL);
      walkRay(e.x, e.y, (q.x - e.x) / (d || 1), (q.y - e.y) / (d || 1), d, (gx, gy) => {
        if (gx === sx && gy === sy) return false;
        const t = tileAt(this.map, gx, gy);
        if (t === T.HARD || t === T.REINF || t === T.PANEL || t === T.TALL) { blocked = true; return true; }
        return false;
      });
      if (blocked) continue;
      const dmg = o.dmg * (1 - (d / o.r) * 0.75) * (self ? (o.selfMul ?? 1) : 1);
      this.damage(q, dmg, owner, o.kind === 'slug' ? 'Breaching Round' : o.kind.charAt(0).toUpperCase() + o.kind.slice(1), Math.atan2(q.y - e.y, q.x - e.x));
    }
    for (const g of [...this.ents]) {
      if (g === e || g.team === e.team || Math.hypot(g.x - e.x, g.y - e.y) > o.r) continue;
      if (g.type === 'cam') g.hp = 0;
      else if (['drone', 'jammer', 'mine', 'wire', 'claymore', 'dart', 'cutter', 'breach'].includes(g.type)) this.removeEnt(g);
    }
  }

  checkReveal() {
    if (this.siteRevealed || this.phase === PHASE.SELECT) return;
    const bombs = this.map.sites[this.site].bombs;
    const viewers = [];
    for (const p of this.players.values()) if (p.alive && this.side(p) === TEAM.ATK && this.phase === PHASE.ACTION) viewers.push(p);
    for (const e of this.ents) if (e.type === 'drone') viewers.push(e);
    for (const v of viewers) for (const b of bombs) {
      if (Math.hypot(b.x - v.x, b.y - v.y) < 380 && los(this.map, v.x, v.y, b.x, b.y)) {
        this.siteRevealed = true;
        this.events.push({ e: 'banner', text: 'OBJECTIVE LOCATED', sub: this.map.sites[this.site].name, team: TEAM.ATK });
        return;
      }
    }
  }

  freeCellsInRooms(names) {
    const out = [], m = this.map;
    for (const r of m.rooms) if (names.includes(r.name))
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
        const ok = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => tileAt(m, x + dx, y + dy) === T.FLOOR);
        if (ok) out.push(y * m.W + x);
      }
    return out;
  }

  freeSpotNear(x, y, spread, drone = false) {
    for (let i = 0; i < 40; i++) {
      const px = x + rnd(-spread, spread), py = y + rnd(-spread, spread);
      const ok = [[0, 0], [8, 0], [-8, 0], [0, 8], [0, -8]].every(([dx, dy]) => {
        const t = tileAt(this.map, Math.floor((px + dx) / CELL), Math.floor((py + dy) / CELL));
        return drone ? !blocksDrone(t) : !blocksMove(t);
      });
      if (ok) return { x: px, y: py };
    }
    return { x, y };
  }

  msg(text, team) { this.events.push({ e: 'msg', text, team }); }

  // ---------------- saved stats ----------------
  blankMatchStats() { return { rounds: 0, roundsWon: 0, kills: 0, deaths: 0, downs: 0, revives: 0, plants: 0, defuses: 0, shots: 0, hits: 0, damage: 0, playSeconds: 0, ops: {} }; }
  opStat(p) { if (!p.ms) p.ms = this.blankMatchStats(); return p.ms.ops[p.op] || (p.ms.ops[p.op] = { rounds: 0, roundsWon: 0, kills: 0, deaths: 0 }); }
  botLoadout(op) {
    const L = LOADOUTS[op], pick = a => a.length ? a[Math.floor(Math.random() * a.length)] : null;
    return cleanLoadout(op, { primary: pick(L.primaries), secondary: pick(L.secondaries), gadget: pick(L.gadgets) });
  }
  statLine(p, left = false) {
    const ms = p.ms || this.blankMatchStats();
    return { name: p.name, bot: !!p.bot, pid: p.pid || null, token: p.token || null, squad: p.squad, left, ...ms, playSeconds: Math.round(ms.playSeconds) };
  }
  saveMatch(winner) {
    const players = [...[...this.players.values()].map(p => this.statLine(p)), ...(this.departed || [])];
    if (!players.some(p => p.token)) return; // nobody real played
    store.recordMatch({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), date: Date.now(),
      duration: Math.round((Date.now() - (this.matchStart || Date.now())) / 1000),
      map: 'Harbor Office', mode: 'Quick Match', score: [...this.score], winner, rounds: this.roundLog || [], players,
    });
  }

  // ---------------- snapshot ----------------
  broadcast() {
    const cells = [];
    for (const k of this.changed) cells.push(k, this.map.tiles[k], Math.max(0, Math.round(this.map.hp[k])));
    this.changed.clear();
    const players = [...this.players.values()].map(p => {
      const g = p.guns[p.slot];
      const o = {
        id: p.id, n: p.name, b: p.bot ? 1 : 0, sq: p.squad, tm: this.round ? this.side(p) : (p.squad === 0 ? 'atk' : 'def'),
        op: p.op, a: p.alive ? 1 : 0, k: p.kills, d: p.deaths,
      };
      if (p.alive) Object.assign(o, {
        dn: p.downed ? 1 : 0, hp: Math.ceil(p.hp), mhp: p.maxHp, x: r1(p.x), y: r1(p.y), ag: r2(p.aim),
        sl: p.slot, w: g ? g.w : null, am: g ? g.ammo : 0, rs: g ? g.reserve : 0, rl: p.reloadT > 0 ? r2(1 - p.reloadT / WEAPONS[g.w].reload) : 0,
        ac: p.abilityCount, gc: p.gadgetCount, gd: p.gadget, dr: p.drones, ct: p.ctrl, ci: p.camIdx, did: p.droneId,
        bu: p.busy ? { k: p.busy.k, p: r2(p.busy.t / p.busy.dur) } : null, df: p.hasDefuser ? 1 : 0,
        vx: r1(p.vx || 0), vy: r1(p.vy || 0), gt: r2(p.gait || 0), mv: p.moving, ad: p.input.ads ? 1 : 0, cr: p.input.crouch ? 1 : 0, wk: p.input.walk ? 1 : 0,br: p.bracing ? 1 : 0, sc: p.scanning ? 1 : 0,
        bat: r1(p.battery), st: r2(Math.max(0, p.stunUntil - this.time)), ls: p.lastSeq, ni: p.nitroId ? 1 : 0,
        m: this.mods(p), fs: r2(this.time - p.lastShot),
      });
      return o;
    });
    const ents = this.ents.map(e => {
      const o = { id: e.id, ty: e.type, x: r1(e.x), y: r1(e.y), tm: e.team };
      if (e.owner) o.ow = e.owner;
      if (e.kind) o.kd = e.kind;
      if (e.ang !== undefined) o.ag = r2(e.ang);
      if (e.type === 'cam') { o.hp = e.hp; o.off = e.offUntil > this.time ? 1 : 0; }
      if (e.type === 'smoke') { o.r = e.r; o.l = r1(e.life); }
      if (e.type === 'cutter' || e.type === 'breach') { o.t = r1(e.t); o.j = this.jammedAt(e.x, e.y) ? 1 : 0; }
      if (e.type === 'drone') { o.j = this.jammedAt(e.x, e.y) ? 1 : 0; o.vx = r1(e.vx || 0); o.vy = r1(e.vy || 0); }
      return o;
    });
    const spots = { atk: [...this.spots.atk.keys()], def: [...this.spots.def.keys()] };
    const common = JSON.stringify({
      ph: this.phase, tm: r1(Math.max(0, this.timer)), rd: this.round, sc: this.score, mv: this.mapVersion,
      site: this.site, rev: this.siteRevealed ? 1 : 0, pl: this.planted ? { x: r1(this.planted.x), y: r1(this.planted.y), b: this.planted.bomb, t: r1(this.planted.t) } : null,
      rf: this.reinforce, win: this.winner, why: this.reason, spawn: this.spawnName,
      players, ents, cells, ev: this.events, spots, time: r2(this.time),
    });
    this.events = [];
    for (const p of this.players.values()) if (p.sock && p.sock.open) p.sock.send('{"t":"snap","you":"' + p.id + '",' + common.slice(1));
  }
}
