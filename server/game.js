// The authoritative match: lobby, rounds, movement, shooting, gadgets, objective.
import { CELL, PHASE, DUR, BARRICADES_EACH, T, FL, TEAM, CELL_HP, HOLE_ONLY, HOLE_MAX, WIN_ROUNDS, MAX_PLAYERS, TEAM_SIZE, PLAYER_R, BOT_LEVELS, MAT, stopsBullet, penBullet, blocksDrone, blocksMove, other, DRONE_SPRINT, PX_PER_M } from '../shared/constants.js';
import { buildMap, roomAt, wallMount, MAPS, openHatch, hatchNear, hatchAtPoint, stairGhost, stairLooks, floorAt, ropeAt, ropeWindowOpen, ropeGround, ropeS, ropeAtWindow, ROPE_CLIMB, ROPE_DROP } from '../shared/map.js';
import { findVault } from '../shared/physics.js';
import { stepMove, moveCircle, walkRay, rayCircle, los, tileAt, angDiff, castSight, facingCell, BASE_SPEED, shapeAt, rayShape, pointSolid, circleBlocked } from '../shared/physics.js';
import { OPERATORS, WEAPONS, ARMOR_HP, opsForTeam, JOBS, jobOf, shieldPose } from '../shared/operators.js';
import { botThink, botPickOp, botPrep } from './bots.js';
import { store, cleanName, publicProfile } from './store.js';
import { matchScore } from '../shared/progress.js';
import { LOADOUTS, GADGET_COUNT, cleanLoadout, FALLOFF, HEAD_R, onHead, hitR, cleanAtt, gunMods, attachFor, attCode, aimHeat, spreadCone, shotOffset, tracerPellet, recoilStep, recoilMax, adsTime, falloffOf, penOf } from '../shared/operators.js';
const VIEW_LAG_MAX = 0.35; // how far back (s) the server will rewind to honour what a shooter saw

const rnd = (a, b) => a + Math.random() * (b - a);
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
const r1 = v => Math.round(v * 10) / 10;
const r2 = v => Math.round(v * 100) / 100;
const BOT_NAMES = ['Viper', 'Moss', 'Rook-7', 'Static', 'Juno', 'Kilo', 'Brine', 'Ozone', 'Pike', 'Wick', 'Saber', 'Flint'];
const EMPTY_INPUT = { up: 0, down: 0, left: 0, right: 0, walk: 0, crouch: 0, fire: 0, ads: 0, interact: 0, ability: 0 };
const JAM_R = 90;
const VAULT_TIME = 0.6, VAULT_RECOVER = 0.35; // climbing over (no shooting, gun down), then a moment before you can aim again
const FREE_OPS = [...opsForTeam(TEAM.ATK), ...opsForTeam(TEAM.DEF)]; // free play's switching order

// R62D_FAST=1 shortens the menus, for quick testing.
if (typeof process !== 'undefined' && process.env.R62D_FAST) { DUR.select = 3; DUR.prep = 6; }

export class Game {
  // opts.tut: a private tutorial match for one player (see tutAction), with its timers held
  // while the coach explains each step, and nothing saved to their profile.
  constructor(opts = {}) {
    this.tut = opts.tut ? { lesson: null, hold: true, info: this.blankTutInfo() } : null;
    // opts.free: a private free-play match for one player: no clock, no rounds, switch operator any time (see freeAction)
    this.free = opts.free ? { bots: 0 } : null;
    this.onEmpty = null;
    this.players = new Map();
    this.nextId = 1;
    this.ents = [];
    this.events = [];
    this.changed = new Set();
    this.newHoles = []; // bullet holes made since the last snapshot: cell, x, y
    this.phase = PHASE.LOBBY;
    this.timer = 0; this.round = 0; this.score = [0, 0]; this.time = 0;
    this.mapId = 'harbor';
    this.map = buildMap(this.mapId);
    this.mapVersion = 0;
    this.site = 0; this.siteRevealed = false; this.planted = null;
    this.spots = { atk: new Map(), def: new Map() };
    this.reinforce = 10;
    this.botLevel = 1; // bot skill: 0 Easy, 1 Normal, 2 Hard, 3 Expert (BOT_LEVELS)
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
        const login = store.login(cleanName(m.name));
        if (!this.tut && !this.free && [...this.players.values()].some(q => !q.bot && q.pid === login.profile.id)) { sock.send(JSON.stringify({ t: 'taken', name: login.profile.name })); return; }
        p = this.addPlayer(login.profile.name, false);
        p.sock = sock;
        p.token = login.token; p.pid = login.profile.id;
        p.ms = this.blankMatchStats();
        sock.send(JSON.stringify({ t: 'welcome', id: p.id, mapVersion: this.mapVersion, mapId: this.mapId, token: p.token, profile: publicProfile(login.profile),
          tiles: Array.from(this.map.tiles), hp: Array.from(this.map.hp), holes: this.map.holes }));
        this.msg(`${p.name} joined`);
      } else if (p) this.handle(p, m);
    });
    sock.on('close', () => {
      if (!p) return;
      this.msg(`${p.name} left`);
      if (p.hasDefuser) this.dropDefuser(p);
      if (this.phase !== PHASE.LOBBY && this.phase !== PHASE.MATCH_END) this.departed.push(this.statLine(p, true));
      this.players.delete(p.id);
      if (this.humanCount() === 0) { this.resetToLobby(); if (this.onEmpty) this.onEmpty(); }
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
      fireCd: 0, reloadT: 0, bloom: 0, abilityCount: 0, gadgetCount: 0, drones: 0, ctrl: 'body', droneId: null, feedId: null,
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
      if (p.ctrl === 'cam') { const c = this.feed(p); if (c && this.operates(p, c)) c.ang = c.wn === null || c.wn === undefined ? p.aim : c.wn + Math.max(-c.ws, Math.min(c.ws, angDiff(p.aim, c.wn))); } // a wall camera can't look into its wall
      if (typeof m.ax === 'number') { p.aimX = m.ax; p.aimY = m.ay; }
      if (typeof m.vt === 'number' && isFinite(m.vt)) p.viewTime = m.vt; // server time of the world this player is looking at
      { const f = !!(m.k && m.k.fire); if (f && !p.msgFire && !p.click) p.click = { a: p.aim, vt: p.viewTime, ax: p.aimX, ay: p.aimY }; p.msgFire = f; } // a click keeps the aim it was made with, even if more input arrives before the next tick
      this.applyMove(p, Math.max(0, Math.min(0.05, Number(m.dt) || 0)));
      p.lastSeq = m.s | 0;
      if (Array.isArray(m.ev)) for (const e of m.ev.slice(0, 10)) this.event(p, e);
    } else if (m.t === 'ping') {
      if (p.sock && p.sock.open) p.sock.send(JSON.stringify({ t: 'pong', c: m.c }));
      if (typeof m.rtt === 'number' && isFinite(m.rtt)) p.rtt = Math.max(0, Math.min(9999, Math.round(m.rtt)));
    } else if (m.t === 'tut') { if (this.tut) this.tutAction(p, m); }
    else if (m.t === 'free') { if (this.free) this.freeAction(p, m); }
    else if (m.t === 'lobby' && !this.tut && !this.free) {
      if (m.a === 'addBot') this.addBot(m.squad);
      else if (m.a === 'removeBot') this.removeBot(m.squad);
      else if (m.a === 'fillBots') { for (const s of [0, 1]) while (this.squadCount(s) < TEAM_SIZE && this.players.size < MAX_PLAYERS) this.addBot(s); }
      else if (m.a === 'switch') this.switchSquad(p);
      else if (m.a === 'botLevel' && BOT_LEVELS[m.lv] && m.lv !== this.botLevel) { this.botLevel = m.lv; this.msg(`${p.name} set the bot skill to ${BOT_LEVELS[m.lv]}`); }
      else if (m.a === 'map' && this.phase === PHASE.LOBBY && MAPS[m.id] && m.id !== this.mapId) {
        this.mapId = m.id; this.map = buildMap(this.mapId); this.mapVersion++; this.changed.clear(); this.newHoles = [];
        this.msg(`${p.name} chose the map ${MAPS[m.id].name}`);
      }
      else if (m.a === 'start' && this.phase === PHASE.LOBBY) this.startMatch();
      else if (m.a === 'end' && this.phase !== PHASE.LOBBY) { this.msg(`${p.name} ended the match`); this.resetToLobby(); }
    } else if (m.t === 'pick') this.pickOp(p, m.op);
    else if (m.t === 'spawn') { // attackers choose where they start (operator select or preparation)
      const sp = this.map && this.map.atkSpawns[m.n];
      if (sp && Number.isInteger(m.n) && this.side(p) === TEAM.ATK && (this.phase === PHASE.SELECT || this.phase === PHASE.PREP)) p.spawn = sp.name;
    }
    else if (m.t === 'role') { // choosing a role limits you to its operators
      const team = this.side(p), job = JOBS[team] && JOBS[team].find(j => j.id === m.r);
      if (job && this.phase === PHASE.SELECT && !p.locked) { p.job = job.id; if (p.op && !job.ops.includes(p.op)) p.op = null; }
    }
    else if (m.t === 'lock') { if (this.phase === PHASE.SELECT && p.op) p.locked = true; }
    else if (m.t === 'site') { // like R6, the defenders choose which objective to defend while picking operators
      if (this.phase === PHASE.SELECT && this.side(p) === TEAM.DEF && Number.isInteger(m.n) && m.n >= 0 && m.n < this.map.sites.length && m.n !== this.site) {
        this.site = m.n; this.msg(`${p.name} chose to defend ${this.map.sites[m.n].name}`, TEAM.DEF);
      }
    }
    else if (m.t === 'settings') store.setSettings(p.token, m.s);
    else if (m.t === 'chat') this.chat(p, m);
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
    if (this.phase !== PHASE.SELECT || !OPERATORS[op] || p.locked) return; // locked in: no changing
    if (OPERATORS[op].team !== this.side(p)) return;
    if (p.job && jobOf(op) !== p.job) return; // only your role's operators
    for (const q of this.players.values()) if (q !== p && q.squad === p.squad && q.op === op) return;
    p.op = op; p.job = jobOf(op);
  }

  // ---------------- match flow ----------------
  startMatch() {
    if (this.players.size === 0) return;
    this.score = [0, 0]; this.round = 0; // round 1: squad 0 attacks (the tutorial: you attack, then defend)
    for (const p of this.players.values()) { p.kills = 0; p.deaths = 0; p.ms = this.blankMatchStats(); }
    this.departed = []; this.roundLog = []; this.matchStart = Date.now();
    this.nextRound();
  }

  nextRound() {
    this.round++;
    this.map = buildMap(this.mapId); this.mapVersion++; this.changed.clear(); this.newHoles = [];
    this.baseTiles = this.map.tiles.slice(); // how the walls were built (SOLDER welds broken soft walls back)
    this.ents = []; this.planted = null; this.winner = null; this.reason = ''; this.noises = [];
    this.site = this.tut ? 0 : Math.floor(Math.random() * this.map.sites.length);
    this.siteRevealed = false;
    this.spots = { atk: new Map(), def: new Map() };
    this.reinforce = 10;
    this.spawnName = this.map.atkSpawns[Math.floor(Math.random() * this.map.atkSpawns.length)].name;
    for (const p of this.players.values()) { p.op = null; p.alive = false; p.ctrl = 'body'; p.busy = null; p.hasDefuser = false; p.locked = false; p.spawn = null; p.staged = false; p.job = null; }
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
        const inJob = free.filter(o => !p.job || jobOf(o) === p.job); // stay in the role they chose, if there's room
        p.op = inJob.length ? inJob[Math.floor(Math.random() * inJob.length)] : free.length ? free[Math.floor(Math.random() * free.length)] : opsForTeam(team)[0];
        p.job = jobOf(p.op);
      }
      this.equip(p);
    }
    for (const c0 of map.cams) { // each camera hangs on the nearest wall, starting with its longest view out of it
      const c = wallMount(map, c0.x, c0.y);
      let best = c.n ?? 0, bestD = -1;
      for (let i = 0; i <= 16; i++) { const a = c.n === null ? i / 16 * Math.PI * 2 : c.n - c.sp + c.sp * 2 * i / 16, d = castSight(map, c.x, c.y, a, 600, null); if (d > bestD) { bestD = d; best = a; } }
      this.ents.push({ id: this.eid(), type: 'cam', x: c.x, y: c.y, team: TEAM.DEF, hp: 1, offUntil: 0, ang: best, wn: c.n, ws: c.sp, wall: c.wall });
    }
    this.boardWindows();
    // defenders start on site, attackers at one spawn (their bodies wait while they drone)
    const site = map.sites[this.site];
    const defCells = this.freeCellsInRooms(site.rooms);
    const atkers = [];
    for (const p of this.players.values()) {
      if (this.side(p) === TEAM.DEF) {
        const k = defCells.splice(Math.floor(Math.random() * defCells.length), 1)[0];
        p.x = (k % map.W + 0.5) * CELL; p.y = (Math.floor(k / map.W) + 0.5) * CELL;
        p.aim = Math.random() * Math.PI * 2;
      } else {
        // he asked: attackers aren't on the map until the action phase. Until then the body waits off the map
        // (nothing can see, hit or hear it) and only the drone is out, leaving from the spawn they chose.
        const spawn = this.spawnOf(p), pos = this.freeSpotNear(spawn.x, spawn.y, 46);
        p.aim = Math.atan2(map.H * CELL / 2 - pos.y, map.W * CELL / 2 - pos.x);
        p.staged = true; p.x = -4000 - atkers.length * 80; p.y = -4000;
        const d = { id: this.eid(), type: 'drone', owner: p.id, team: TEAM.ATK, x: pos.x + Math.cos(p.aim) * 14, y: pos.y + Math.sin(p.aim) * 14, hp: 1, ang: p.aim };
        this.ents.push(d); p.droneId = d.id; p.ctrl = 'drone'; p.drones = this.tut && !p.bot ? 3 : 1; // spares in the tutorial, in case a defender shoots it
        atkers.push(p);
      }
    }
    if (atkers.length) atkers[Math.floor(Math.random() * atkers.length)].hasDefuser = true;
    for (const p of this.players.values()) if (p.op && OPERATORS[p.op].ability.id === 'crew' && this.side(p) === TEAM.DEF) this.reinforce += 2; // GIRDER's crew brings two more
    for (const p of this.players.values()) if (p.bot) botPrep(this, p);
    this.phase = PHASE.PREP; this.timer = DUR.prep;
    this.events.push({ e: 'banner', text: 'PREPARATION PHASE', sub: '' });
  }

  // the spawn an attacker chose (or the team's default for this round)
  spawnOf(p) { const S = this.map.atkSpawns; return S.find(s => s.name === p.spawn) || S.find(s => s.name === this.spawnName) || S[0]; }

  beginAction() {
    for (const p of this.players.values()) {
      if (this.side(p) === TEAM.ATK) {
        if (p.staged) { // out of hiding: onto the map at their spawn
          const sp = this.spawnOf(p), pos = this.freeSpotNear(sp.x, sp.y, 46);
          p.x = pos.x; p.y = pos.y; p.vx = p.vy = 0; p.staged = false;
          p.aim = Math.atan2(this.map.H * CELL / 2 - p.y, this.map.W * CELL / 2 - p.x);
        }
        p.ctrl = 'body'; p.drones += 1;
      }
      else if (p.ctrl === 'cam') p.ctrl = 'body';
      p.busy = null;
    }
    this.phase = PHASE.ACTION; this.timer = DUR.action;
    this.events.push({ e: 'banner', text: 'ACTION PHASE', sub: '' });
  }

  endRound(winTeam, reason) {
    if (this.free) { this.planted = null; this.events.push({ e: 'banner', text: reason.toUpperCase(), sub: 'Free play carries on' }); return; }
    if (this.phase === PHASE.ROUND_END || this.phase === PHASE.MATCH_END) return;
    const squad = this.squadOfSide(winTeam);
    this.score[squad]++;
    this.roundLog.push({ n: this.round, winner: squad, side: winTeam, reason, attackers: this.squadOfSide(TEAM.ATK), site: this.map.sites[this.site].name });
    for (const p of this.players.values()) {
      if (!p.op || !p.ms) continue;
      const o = this.opStat(p);
      p.ms.rounds++; o.rounds++;
      if (p.squad === squad) { p.ms.roundsWon++; o.roundsWon++; this.pts(p, 50, 'ROUND WON'); }
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
    p.guns = [L.primary, L.secondary].filter(Boolean).map(w => {
      const att = cleanAtt(w, L.att && L.att[w]);
      return { w, ammo: WEAPONS[w].mag, reserve: WEAPONS[w].reserve, att, m: gunMods(w, att) };
    });
    p.slot = 0; p.fireCd = 0; p.reloadT = 0; p.bloom = 0; p.vx = 0; p.vy = 0; p.gait = 0;
    p.adsT = 0; p.rc = 0; p.shots = 0; p.rcDir = Math.random() < 0.5 ? 1 : -1; p.viewTime = null;
    p.barri = o.team === TEAM.DEF ? BARRICADES_EACH : 0;
    p.abilityCount = o.ability.count; p.gadgetCount = GADGET_COUNT[p.gadget] || 1;
    p.battery = o.ability.battery || 0; p.scanning = false; p.bracing = false;
    p.rope = null; p.pinged = null; p.sprints = DRONE_SPRINT.charges; p.sprintUntil = 0; p.sprintCd = 0;
    p.drones = 0; p.droneId = null; p.ctrl = 'body'; p.busy = null; p.slowUntil = 0; p.stunUntil = 0; p.staged = false;
    p.downedBy = null; p.nitroId = null; p.ai = {};
    p.boostUntil = 0; p.ghostUntil = 0; p.dazeUntil = 0; p.clampUntil = 0; p.plated = false; p.gasId = null;
    p.lanceT = 0; p.lancing = false; p.shrouded = false; p.turretCd = 0; p.shockT = 0;
  }

  // ---------------- simulation ----------------
  tick(dt) {
    this.time += dt;
    if (this.phase === PHASE.LOBBY) return;
    const held = (this.tut && this.tut.hold && (this.phase === PHASE.SELECT || this.phase === PHASE.PREP)) || this.free;
    if (!held) this.timer -= dt;
    if (this.phase === PHASE.SELECT) {
      // he asked: bots never pick before you. They wait until every person on their team has locked in.
      for (const p of this.players.values()) if (p.bot && !p.op && (this.tut || this.humansLocked(p.squad)) && Math.random() < dt * 2.5) botPickOp(this, p);
      for (const p of this.players.values()) if (p.bot && p.op && !p.locked) {
        p.locked = true;
        if (this.side(p) === TEAM.ATK && Math.random() < 0.3) p.spawn = this.map.atkSpawns[Math.floor(Math.random() * this.map.atkSpawns.length)].name; // most stay with the team
      }
      // he asked: no clock. The round starts when everyone has locked in (anyone who has left counts as ready)
      if (this.tut ? this.timer <= 0 : this.allLocked()) this.beginPrep();
      return;
    }
    if (this.phase === PHASE.ROUND_END) {
      if (this.tut) { // the tutorial: after the attacking round the sides swap for one defending round, then it stops
        if (this.round >= 2) { this.timer = Math.max(0, this.timer); return; }
        if (this.timer <= 0) { this.tut.hold = true; this.nextRound(); }
        return;
      }
      if (this.timer <= 0) {
        if (Math.max(...this.score) >= WIN_ROUNDS) {
          this.phase = PHASE.MATCH_END; this.timer = DUR.matchEnd;
          const win = this.score[0] > this.score[1] ? 0 : 1;
          const mvp = [...this.players.values()].map(p => ({ p, sc: (p.ms && p.ms.score) || matchScore(p.ms || {}) })).sort((a, b) => b.sc - a.sc)[0]; // the MVP is the top score
          this.events.push({ e: 'matchEnd', squad: win, mvp: mvp ? { id: mvp.p.id, name: mvp.p.name, op: mvp.p.op, ...(mvp.p.ms || {}), ops: undefined } : null });
          const xp = this.saveMatch(win) || {};
          for (const p of this.players.values()) if (p.sock && xp[p.pid]) {
            const prof = store.byToken(p.token);
            p.sock.send(JSON.stringify({ t: 'xp', ...xp[p.pid], stats: p.ms, profile: publicProfile(prof) }));
          }
        } else this.nextRound();
      }
      return;
    }
    if (this.phase === PHASE.MATCH_END) { if (this.timer <= 0) this.resetToLobby(); return; }

    // PREP / ACTION
    for (const p of this.players.values()) if (p.ms && p.alive) p.ms.playSeconds += dt;
    if (this.free) this.freeRespawns();
    for (const p of this.players.values()) {
      if (p.bot && !p.hold) { botThink(this, p, dt); this.applyMove(p, dt); p.viewTime = null; }
      this.tickPlayer(p, dt);
      p.prevInput = p.input;
    }
    this.tickEnts(dt);
    this.recordHistory();

    this.revealCheck -= dt;
    if (this.revealCheck <= 0) { this.revealCheck = 0.25; this.checkReveal(); }

    if (this.phase === PHASE.PREP && this.timer <= 0) this.beginAction();
    else if (this.phase === PHASE.ACTION) this.checkWin();
  }

  humansLocked(squad) { for (const p of this.players.values()) if (!p.bot && p.squad === squad && !p.locked && p.sock && p.sock.open) return false; return true; }
  allLocked() { for (const p of this.players.values()) if (!p.locked && (p.bot || (p.sock && p.sock.open))) return false; return true; }

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
      if (hasDef && up.def === 0 && !this.free) return this.endRound(TEAM.ATK, 'Defenders eliminated');
      return;
    }
    if (this.free) return; // free play: nobody wins, the dead come back (freeRespawns)
    if (hasAtk && up.atk === 0) return this.endRound(TEAM.DEF, 'Attackers eliminated');
    if (hasDef && up.def === 0) return this.endRound(TEAM.ATK, 'Defenders eliminated');
    if (this.timer <= 0) return this.endRound(TEAM.DEF, 'Time ran out');
  }

  mods(p) {
    if (p.rope && p.rope.st === 'hang' && p.alive && !p.downed) { // hanging: slide along the wall (physics stepMove)
      const r = this.map.ropes[p.rope.r];
      return { rope: { x: r.hang.x, y: r.hang.y, tx: r.tx, ty: r.ty, a: r.a, b: r.b } };
    }
    if (p.ctrl === 'drone') {
      const d = this.ent(p.droneId);
      return { drone: true, frozen: !d || this.jammedAt(d.x, d.y), sprint: this.time < (p.sprintUntil || 0) };
    }
    const o = OPERATORS[p.op] || { armor: 2 };
    let mul = 1;
    if (this.time < p.slowUntil) mul *= 0.45;
    if (p.bracing) mul *= 0.82; // shield up: a little slower, never a crawl (he asked)
    if (p.scanning) mul *= 0.6;
    if (this.time < (p.boostUntil || 0)) mul *= 1.25; // Adrenal Shot
    if (p.shrouded) mul *= 0.8;
    for (const e of this.ents) if (e.type === 'wire' && e.team !== this.side(p) && Math.hypot(e.x - p.x, e.y - p.y) < 24) { mul *= 0.3; break; }
    const frozen = !p.alive || p.ctrl !== 'body' || !!p.vault || !!p.rope || this.time < (p.clampUntil || 0) || !!(p.busy && p.busy.k !== 'revive') ||
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
    p.moving = moved < 5 ? 0 : (p.input.crouch || p.input.walk) ? 1 : 2;
    if (p.moving === 2 && !this.ghost(p) && !p.shrouded && this.time - (p.noiseT || 0) > 0.3) { p.noiseT = this.time; this.noise(p.x, p.y, this.side(p), 320); } // running footsteps (none from HUSH's shroud)
  }

  tickPlayer(p, dt) {
    if (!p.alive) return;
    if (p.vault) { // carried over the obstacle along a fixed path
      const v = p.vault; v.t += dt;
      const f = Math.min(1, v.t / v.dur), e = f * f * (3 - 2 * f);
      p.x = v.x0 + (v.x1 - v.x0) * e; p.y = v.y0 + (v.y1 - v.y0) * e; p.vx = p.vy = 0;
      if (f >= 1 || p.downed) { p.vault = null; p.recoverUntil = this.time + VAULT_RECOVER; }
    }
    const team = this.side(p);
    const inp = p.input, prev = p.prevInput;
    if (p.ctrl === 'drone') { // drone sprint (he asked): Shift, 1.6x for up to 3 s, 3 a round, 6 s between; the motor whine carries
      const on = this.time < (p.sprintUntil || 0), held = inp && inp.walk, was = prev && prev.walk;
      if (on && !held) { p.sprintUntil = this.time; p.sprintCd = this.time + DRONE_SPRINT.wait; }
      else if (!on && held && !was && (p.sprints || 0) > 0 && this.time >= (p.sprintCd || 0)) {
        p.sprints--; p.sprintUntil = this.time + DRONE_SPRINT.time; p.sprintCd = p.sprintUntil + DRONE_SPRINT.wait;
        const d = this.ent(p.droneId); if (d) this.events.push({ e: 'snd', s: 'droneSprint', x: r1(d.x), y: r1(d.y), id: p.id });
      }
      if (this.time < (p.sprintUntil || 0) && this.time - (p.sprintNoiseT || 0) > 0.4) { const d = this.ent(p.droneId); if (d) { p.sprintNoiseT = this.time; this.noise(d.x, d.y, team, 260); } }
    } else if (this.time < (p.sprintUntil || 0)) { p.sprintUntil = this.time; p.sprintCd = this.time + DRONE_SPRINT.wait; }
    this.tickRope(p, dt);
    p.fireCd -= dt; p.meleeCd -= dt; p.turretCd = Math.max(0, (p.turretCd || 0) - dt);
    { const g = p.guns[p.slot], rate = (1 / (g ? adsTime(WEAPONS[g.w]) : 0.3)) * (this.time < (p.boostUntil || 0) ? 2 : 1) / (g ? g.m.ads : 1);
      const canAds = p.input.ads && p.ctrl === 'body' && !p.downed && p.reloadT <= 0 && !p.bracing && !(p.switchUntil > this.time) && !p.vault && !(p.recoverUntil > this.time);
      p.adsT = Math.max(0, Math.min(1, (p.adsT || 0) + (canAds ? dt * rate : -dt * rate * 1.6)));
      const idle = this.time - p.lastShot; // the crosshair drifts back after a burst; once the gun has settled the next shot is exact
      if (idle > 0.1) p.rc = (p.rc || 0) * Math.exp(-dt * 12);
      if (g && p.shots && !aimHeat(WEAPONS[g.w], p.shots, idle)) { p.rc = 0; p.shots = 0; } }

    if (p.ctrl === 'cam' && !this.feed(p)) { // the feed you were watching broke: go to the next one
      const list = this.feeds(team);
      if (list.length && !p.downed) this.watch(p, list[0]); else p.ctrl = 'body';
    }
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
    if (op.ability.id === 'brace') { // shield up (can't shoot) or pistol out (shield on the back); Q switches, which takes a moment
      if (p.shieldMode === undefined) p.shieldMode = 'shield';
      if (inp.ability && !prev.ability && p.ctrl === 'body' && !p.downed && !(p.switchUntil > this.time)) { p.switchUntil = this.time + 0.6; p.shieldMode = p.shieldMode === 'shield' ? 'gun' : 'shield'; this.events.push({ e: 'snd', s: 'swap', x: r1(p.x), y: r1(p.y), id: p.id }); }
      p.bracing = p.shieldMode === 'shield' && !(p.switchUntil > this.time);
    }
    if (op.ability.id === 'scan') {
      if (inp.ability && p.battery > 0 && p.ctrl === 'body') {
        p.scanning = true; p.battery = Math.max(0, p.battery - dt);
        for (const q of this.players.values())
          if (q.alive && this.side(q) === TEAM.ATK && !this.ghost(q) && Math.hypot(q.x - p.x, q.y - p.y) < 300) this.spot(TEAM.DEF, q.id, 0.4);
      } else { p.scanning = false; p.battery = Math.min(op.ability.battery, p.battery + dt * 0.35); }
    }

    if (op.ability.id === 'lance') { // Thermal Lance: burn the wall cell you face, one at a time
      p.lancing = false;
      if (inp.ability && p.battery > 0 && p.ctrl === 'body' && !p.downed) {
        let f = this.facingCell(p, 30);
        if (!f || ![T.SOFT, T.REINF, T.BARRI, T.PANEL, T.DSHIELD].includes(f.t)) { // or the hatch at your feet
          const hs = this.hatchSpot(p, [T.HATCH, T.HATCHR]);
          if (hs) f = { k: hs.k, t: T.SOFT, cx: hs.k % this.map.W, cy: Math.floor(hs.k / this.map.W) };
        }
        if (f && [T.SOFT, T.REINF, T.BARRI, T.PANEL, T.DSHIELD].includes(f.t)) {
          p.lancing = true; p.battery = Math.max(0, p.battery - dt);
          if (this.time - (p.noiseT || 0) > 0.4) { p.noiseT = this.time; this.noise(p.x, p.y, team, 260); } // the hiss of the torch
          const fx = (f.cx + 0.5) * CELL, fy = (f.cy + 0.5) * CELL, grid = this.gridNear(fx, fy, other(team));
          if (grid) { // a static grid on that wall shocks you instead
            p.lanceT = 0; p.shockT -= dt;
            if (p.shockT <= 0) { p.shockT = 0.5; this.damage(p, 8, this.players.get(grid.owner), 'Static Grid', 0); this.events.push({ e: 'arc', x: r1(grid.x), y: r1(grid.y), x2: r1(p.x), y2: r1(p.y) }); }
          } else {
            p.lanceT += dt;
            if (p.lanceT >= 1.3) { p.lanceT = 0; this.destroyCell(f.k); this.events.push({ e: 'hit', k: 'spark', x: r1(fx), y: r1(fy) }); }
          }
        }
      }
      if (!p.lancing) p.lanceT = 0;
    }
    if (op.ability.id === 'weld') { // SOLDER: hold facing a broken soft wall to weld it back, a block at a time
      p.welding = false;
      if (inp.ability && p.battery > 0 && p.ctrl === 'body' && !p.downed && this.baseTiles) {
        let k = -1;
        for (let d = 6; d <= 30 && k < 0; d += 3) {
          const c = Math.floor((p.y + Math.sin(p.aim) * d) / CELL) * this.map.W + Math.floor((p.x + Math.cos(p.aim) * d) / CELL), t = this.map.tiles[c];
          if (this.baseTiles[c] === T.SOFT && t !== T.SOFT && t !== T.REINF && !this.cellOccupied(c)) k = c;
          else if (t === T.HARD || t === T.SOFT || t === T.REINF || t === T.TALL) break;
        }
        if (k >= 0) {
          p.welding = true; p.battery = Math.max(0, p.battery - dt); p.weldT = (p.weldT || 0) + dt;
          if (this.time - (p.noiseT || 0) > 0.4) { p.noiseT = this.time; this.noise(p.x, p.y, team, 260); }
          if (p.weldT >= 1) { p.weldT = 0; const m = this.map; m.tiles[k] = T.SOFT; m.hp[k] = CELL_HP[T.SOFT]; delete m.holes[k]; this.changed.add(k); this.events.push({ e: 'hit', k: 'spark', x: r1((k % m.W + 0.5) * CELL), y: r1((Math.floor(k / m.W) + 0.5) * CELL) }); }
        }
      }
      if (!p.welding) p.weldT = 0;
    }
    if (op.ability.id === 'shroud') { // Silent Shroud: press to go dark, press again to come back (he asked: a toggle)
      if (inp.ability && !(prev && prev.ability) && p.ctrl === 'body' && !p.downed) p.shrouded = !p.shrouded && p.battery > 0.5;
      if (p.shrouded && (p.battery <= 0 || p.downed || p.ctrl !== 'body')) p.shrouded = false;
      if (p.shrouded) p.battery = Math.max(0, p.battery - dt);
      else p.battery = Math.min(op.ability.battery, p.battery + dt * 0.25);
    }

    // interaction (hold E)
    if (inp.interact && p.ctrl === 'body' && !p.rope && !p.ropeHeld) {
      if (!p.busy) p.busy = this.startInteract(p);
      if (p.busy) this.continueInteract(p, dt);
    } else p.busy = null;

    // a defender looking through a turret camera fires its laser
    if (p.ctrl === 'cam' && inp.fire && p.turretCd <= 0) {
      const c = this.feed(p);
      if (c && c.tu && this.operates(p, c)) c.heat = Math.max(0, (c.heat || 0) - (this.time - (c.heatT ?? this.time)) * 2), c.heatT = this.time;
      if (c && c.tu && this.operates(p, c) && !(c.offUntil > this.time) && !(c.coolUntil > this.time)) {
        p.turretCd = 0.45;
        if ((c.heat += 1) >= 12) { c.coolUntil = this.time + 4; c.heat = 0; } // overheated
        const a = c.ang || 0, dx = Math.cos(a), dy = Math.sin(a);
        let bt = castSight(this.map, c.x, c.y, a, 520, this.smokeList()), hit = null;
        for (const q of this.players.values()) {
          if (!q.alive || q === p) continue;
          const t = rayCircle(c.x, c.y, dx, dy, q.x, q.y, hitR(q.op));
          if (t !== null && t < bt) { bt = t; hit = q; }
        }
        if (hit) this.damage(hit, 7, p, 'Turret Camera', a);
        this.events.push({ e: 'laser', x: r1(c.x), y: r1(c.y), x2: r1(c.x + dx * bt), y2: r1(c.y + dy * bt) });
      }
    }

    // shooting
    const canShoot = p.ctrl === "body" && !p.busy && !p.vault && !(p.rope && p.rope.st !== 'hang') && !(p.recoverUntil > this.time) && p.reloadT <= 0 && !p.scanning && gun &&
      !(p.switchUntil > this.time) && !(p.staggerUntil > this.time);
    // a click made a hair before the gun is ready is kept until it is (up to 0.15 s), so fast tapping never loses a shot
    const click = p.click && !(this.time - (p.click.t ?? this.time) > 0.15) ? p.click : null; p.click = null;
    if (click && click.t === undefined) click.t = this.time;
    if (p.burst && !(canShoot && gun.w === p.burstW && gun.ammo > 0)) p.burst = 0; // a burst stops if you can't shoot
    if (p.burst) { // the rest of a burst fires by itself
      const w = WEAPONS[gun.w];
      if (p.fireCd <= 0) { this.fire(p, gun, w); if (!--p.burst) p.fireCd = Math.max(p.fireCd, w.burstGap || 0.3); }
      if (click) p.click = click; // clicking during a burst: the next burst follows
    } else if (canShoot && (inp.fire || click)) {
      const w = WEAPONS[gun.w];
      const edge = !prev.fire || !!click;
      if (p.fireCd <= 0 && (w.auto || edge)) {
        if (gun.ammo > 0) { this.fire(p, gun, w, click); if (w.burst > 1) { p.burst = w.burst - 1; p.burstW = gun.w; if (!gun.ammo) { p.burst = 0; p.fireCd = Math.max(p.fireCd, w.burstGap || 0.3); } } }
        else if (gun.reserve > 0) this.startReload(p);
        else if (edge) this.events.push({ e: 'snd', s: 'empty', x: r1(p.x), y: r1(p.y) });
      } else if (click && !w.auto && p.fireCd > 0) p.click = click;
    }
  }

  startReload(p) {
    const gun = p.guns[p.slot];
    if (!gun || p.reloadT > 0 || gun.reserve <= 0 || gun.ammo >= WEAPONS[gun.w].mag) return;
    p.reloadT = WEAPONS[gun.w].reload;
    this.events.push({ e: 'snd', s: 'reload', x: r1(p.x), y: r1(p.y), id: p.id });
  }

  // Something bots can hear: where, who made it, and how far it carries (px). Another floor halves it.
  noise(x, y, team, r) {
    (this.noises || (this.noises = [])).push({ x, y, team, r, t: this.time });
    if (this.noises.length > 80) this.noises.splice(0, this.noises.length - 80);
  }

  fire(p, gun, w, click = null) {
    if (p.bracing) p.shieldOpenUntil = this.time + 0.5; // shooting from behind the shield swings it out of the way (he asked)
    this.noise(p.x, p.y, this.side(p), (gun.m && gun.m.quiet) ? 260 : 950);
    gun.ammo--; p.fireCd = Math.max(p.fireCd, -1 / 30) + 60 / w.rpm; // keep the leftover: guns fire at their real rate, not rounded up to whole ticks
    if (p.ms) p.ms.shots += w.pellets;
    // hip fire is a loose cone that widens while moving; aimed fire is accurate even on the move (R6 rules)
    const run = Math.min(1, Math.hypot(p.vx || 0, p.vy || 0) / BASE_SPEED), at = p.adsT || 0;
    const m = gun.m || gunMods(gun.w);
    // the aiming model (shared/operators.js): exact first shot, a fixed cone after that, a fixed recoil pattern
    const cone = spreadCone(w, m, { at, run, crouch: !!p.input.crouch, shots: aimHeat(w, p.shots || 0, this.time - p.lastShot) }) * (this.time < (p.dazeUntil || 0) && p.shots ? 1.7 : 1); // dazed: shaky follow-ups
    const aim = click ? click.a : p.aim, vt = p.viewTime;
    if (click && click.vt !== undefined) p.viewTime = click.vt; // judged against what they saw when they clicked
    const base = aim + (p.rc || 0);
    this.rangeMul = m.range; this.shotW = w; this.shotAim = click ? { x: click.ax, y: click.ay } : { x: p.aimX, y: p.aimY };
    const mx = p.x + Math.cos(aim) * (w.len + 6), my = p.y + Math.sin(aim) * (w.len + 6);
    for (let i = 0; i < w.pellets; i++) {
      const a = base + shotOffset(w, cone, i);
      const into = this.aimedHatch(p, a); // aimed into a hatch: the bullet goes down (or up) there, not on across the room
      const end = this.hitscan(p, p.x, p.y, a, into ? into.ad : w.range, w.dmg * m.dmg, w.name, w.cls);
      if (into && end.k === 'none') this.shotThroughHatch(p, a, into, w.dmg * m.dmg, w.name, w.cls);
      if (tracerPellet(w, i)) this.events.push({ e: 'shot', id: p.id, w: gun.w, x: r1(mx), y: r1(my), x2: r1(end.x), y2: r1(end.y), k: end.k, q: m.quiet || undefined });
    }
    if (w.pellets > 1) this.events.push({ e: 'shotgun', id: p.id });
    this.shotW = null; this.shotAim = null;
    p.viewTime = vt;
    p.lastShot = this.time;
    p.shots = (p.shots || 0) + 1; // recoil comes after the shot, so it moves the next one, never this one
    p.rc = Math.max(-recoilMax(w), Math.min(recoilMax(w), (p.rc || 0) + recoilStep(w, m, p.shots)));
  }

  // Bullet: stops at the first enemy, goes through soft walls (damaging them), stops on hard ones.
  // Where everyone was, a few times a second back — so a shot can be judged against what the shooter saw.
  recordHistory() {
    const snap = new Map();
    for (const q of this.players.values()) if (q.alive) snap.set(q.id, { x: q.x, y: q.y });
    for (const e of this.ents) if (e.type === 'drone') snap.set(e.id, { x: e.x, y: e.y }); // drones are judged where the shooter saw them too
    (this.hist || (this.hist = [])).push({ t: this.time, snap });
    while (this.hist.length > 40) this.hist.shift();
  }
  posAt(q, t) {
    const h = this.hist; if (!h || !h.length || t === null || t === undefined) return q;
    t = Math.max(this.time - VIEW_LAG_MAX, Math.min(this.time, t));
    let a = null, b = null;
    for (let i = h.length - 1; i >= 0; i--) if (h[i].t <= t) { a = h[i]; b = h[i + 1]; break; }
    const pa = a && a.snap.get(q.id), pb = b && b.snap.get(q.id);
    if (!pa) return q;
    if (!pb) return pa;
    const f = (t - a.t) / ((b.t - a.t) || 1);
    return { x: pa.x + (pb.x - pa.x) * f, y: pa.y + (pb.y - pa.y) * f };
  }

  hitscan(src, x0, y0, ang, range, dmg, wname, cls) {
    const dx = Math.cos(ang), dy = Math.sin(ang), team = this.side(src), fl = floorAt(this.map, x0, y0);
    let best = null, bestT = range;
    for (const q of this.players.values()) {
      if (q === src || !q.alive) continue; // friendly fire: teammates get hit too
      if (this.phase === PHASE.PREP && this.side(q) === this.side(src)) continue; // ...except in preparation: shots pass teammates (he asked: shotgunning walls to set up)
      const at = src.viewTime !== null && src.viewTime !== undefined ? this.posAt(q, src.viewTime) : q; // favour the shooter
      const t = rayCircle(x0, y0, dx, dy, at.x, at.y, hitR(q.op));
      if (t !== null && t < bestT) { bestT = t; best = { q, at }; }
      // up or down a staircase: someone on its steps or landing can be hit where they show on this floor's steps
      const gh = stairGhost(this.map, at.x, at.y);
      if (gh && gh.fl === fl && stairLooks(this.map, gh.s, x0, y0)) {
        const tg = rayCircle(x0, y0, dx, dy, gh.x, gh.y, hitR(q.op));
        if (tg !== null && tg < bestT) { bestT = tg; best = { q, at: gh }; }
      }
    }
    for (const e of this.ents) {
      if (!e.hp || e.team === team || e.tu) continue; // turret cameras are bulletproof
      const at = e.type === 'drone' && src.viewTime !== null && src.viewTime !== undefined ? this.posAt(e, src.viewTime) : e;
      const t = rayCircle(x0, y0, dx, dy, at.x, at.y, e.type === 'decoy' ? hitR(e.op) : e.type === 'drone' ? 4.5 : 6); // drones are small
      if (t !== null && t < bestT) { bestT = t; best = { e }; }
    }
    let mult = 1, stopT = bestT, kind = best ? 'flesh' : 'none', pens = 0, wallT = 0;
    const pen = penOf(this.shotW && this.shotW.cls === cls ? this.shotW : { cls });
    const sx = Math.floor(x0 / CELL), sy = Math.floor(y0 / CELL);
    walkRay(x0, y0, dx, dy, bestT, (cx, cy, t) => {
      const k = cy * this.map.W + cx, tile = tileAt(this.map, cx, cy), sh = (stopsBullet(tile) || penBullet(tile)) && shapeAt(this.map, cx, cy);
      if (sh) { const h = rayShape(sh, x0, y0, dx, dy); if (h === null || h > bestT) return false; t = h; } // angled/curved wall: only its solid part
      else if (cx === sx && cy === sy) return false;
      if (stopsBullet(tile)) { stopT = t; kind = tile === T.TALL ? 'prop' : 'hard'; best = null; return true; }
      if (penBullet(tile)) {
        if ((tile === T.SOFT || tile === T.BARRI) && HOLE_ONLY.has(cls)) this.holeCell(k, cx, cy, x0, y0, dx, dy, t);
        else this.damageCell(k, dmg * (tile === T.BARRI ? 0.35 : 0.6)); // a shotgun needs two blasts for a barricade
        // he asked: a wall takes damage off the bullet (how much depends on the gun and the wall), so spraying
        // through walls in someone's general direction doesn't win fights
        mult *= pen * (this.map.mat[k] === MAT.BRICK ? 0.7 : tile === T.BARRI ? 1.1 : 1); pens++; wallT = t;
        if (pens === 1) this.events.push({ e: 'hit', k: 'wall', x: r1(x0 + dx * t), y: r1(y0 + dy * t) });
        if (pens > 3) { stopT = t; kind = 'wall'; best = null; return true; }
      }
      return false;
    });
    // a bullet that went through a wall is knocked a little off line: past the wall it can drift off the target
    if (best && best.q && pens) {
      const at = best.at || best.q, cx = at.x - x0, cy = at.y - y0, miss = Math.abs(cx * dy - cy * dx);
      const drift = (Math.random() * 2 - 1) * 0.06 * Math.max(0, bestT - wallT);
      if (Math.abs(miss + drift) > hitR(best.q.op)) { best = null; kind = 'none'; stopT = Math.min(range, bestT + 40); }
    }
    const ex = x0 + dx * stopT, ey = y0 + dy * stopT;
    if (best && best.q) {
      const q = best.q;
      if (OPERATORS[q.op].ability.id === 'brace' && !q.downed && q.ctrl === 'body' && !(this.time < (q.shieldDownUntil || 0))) {
        const pose = this.shieldOf(q), off = Math.abs(angDiff(Math.atan2(y0 - q.y, x0 - q.x), q.aim + pose.rot)), switching = q.switchUntil > this.time;
        if (!switching && (q.bracing ? off < pose.arc : Math.abs(angDiff(Math.atan2(y0 - q.y, x0 - q.x), q.aim)) > Math.PI - 0.8)) {
          this.events.push({ e: 'hit', k: 'shield', x: r1(ex), y: r1(ey) });
          return { x: ex, y: ey, k: 'shield' };
        }
      }
      if (src.ms) src.ms.hits++;
      // headshot: the bullet passes through the very centre of the body — instant kill, no getting downed
      const at = best.at || q, cx = at.x - x0, cy = at.y - y0, miss = Math.abs(cx * dy - cy * dx);
      const W = this.shotW && this.shotW.cls === cls ? this.shotW : null, pellet = W ? W.pellets > 1 : cls === 'Shotgun';
      const F = W ? falloffOf(W) : FALLOFF[cls] || FALLOFF.AR, rm = this.rangeMul || 1, fo = { from: F.from * rm, to: F.to * rm, min: F.min };
      const fall = stopT <= fo.from ? 1 : stopT >= fo.to ? fo.min : 1 - (1 - fo.min) * (stopT - fo.from) / (fo.to - fo.from);
      const sa = this.shotAim, head = miss < HEAD_R && (!sa || onHead(sa.x, sa.y, at.x, at.y));
      if (src && src.tracerUntil > this.time && this.side(q) !== this.side(src)) this.spot(this.side(src), q.id, 4); // MARK's tracer rounds
      if (head && !q.downed && !pellet && !pens) { this.headshot = true; this.damage(q, 9999, src, wname, ang); this.headshot = false; }
      else if (head && (pellet || pens)) this.damage(q, dmg * mult * fall * 1.8, src, wname, ang); // a shotgun pellet to the head hurts more, but each one alone can't one-tap
      else this.damage(q, dmg * mult * fall, src, wname, ang);
    } else if (best && best.e) this.hitEnt(best.e, src);
    else if (kind === 'hard' || kind === 'prop') this.events.push({ e: 'hit', k: kind, x: r1(ex), y: r1(ey) });
    return { x: ex, y: ey, k: kind };
  }

  // A small bullet hole through a soft wall, on the bullet's path through the middle of the cell.
  holeCell(k, cx, cy, x0, y0, dx, dy, tIn) {
    const h = this.map.holes[k] || (this.map.holes[k] = []);
    if (h.length >= HOLE_MAX * 2) return;
    const tx = dx > 0 ? ((cx + 1) * CELL - x0) / dx : dx < 0 ? (cx * CELL - x0) / dx : Infinity;
    const ty = dy > 0 ? ((cy + 1) * CELL - y0) / dy : dy < 0 ? (cy * CELL - y0) / dy : Infinity;
    const tm = (tIn + Math.min(tx, ty)) / 2, hx = r1(x0 + dx * tm), hy = r1(y0 + dy * tm);
    for (let i = 0; i < h.length; i += 2) if (Math.abs(h[i] - hx) < 0.6 && Math.abs(h[i + 1] - hy) < 0.6) return;
    h.push(hx, hy); this.newHoles.push(k, hx, hy);
  }

  // ---- hatches: one hp for the whole panel (kept on all four cells so clients see it) ----
  hatchDamage(id, amount) {
    const h = this.map.hatches[id];
    if (!h || this.map.tiles[h.cells[0]] !== T.HATCH) return;
    for (const c of h.cells) { this.map.hp[c] -= amount; this.changed.add(c); }
    if (this.map.hp[h.cells[0]] <= 0) this.breakHatch(id);
  }
  breakHatch(id) {
    const h = this.map.hatches[id];
    if (!h || this.map.tiles[h.cells[0]] === T.HOLE) return;
    for (const c of openHatch(this.map, id)) this.changed.add(c);
    for (const e of [...this.ents]) if (e.hatch === id && e.type !== 'breach' && e.type !== 'cutter') this.removeEnt(e);
    this.events.push({ e: 'hit', k: 'wood', x: r1(h.x), y: r1(h.y) }); this.events.push({ e: 'hit', k: 'wall', x: r1(h.bx), y: r1(h.by) });
    this.events.push({ e: 'snd', s: 'break', x: r1(h.x), y: r1(h.y) });
    this.noise(h.x, h.y, null, 500);
  }
  reinforceHatch(id) {
    const h = this.map.hatches[id];
    for (const c of h.cells) { this.map.tiles[c] = T.HATCHR; this.map.hp[c] = 0; this.changed.add(c); }
    this.events.push({ e: 'snd', s: 'reinforce', x: r1(h.x), y: r1(h.y) });
  }
  // a breaching charge set on the hatch you stand on: { k, x, y } like wallInFront
  hatchSpot(p, types) {
    const h = hatchNear(this.map, p.x, p.y, p.aim, 14);
    return h && types.includes(this.map.tiles[h.cells[0]]) ? { k: h.cells[0], x: h.x, y: h.y, hatch: h.id } : null;
  }
  // A shot aimed right into an open hatch (nothing in the way on your floor) carries on to the other floor and
  // hits whoever is at that spot; aimed at a shut one, a shotgun or marksman rifle chews it open.
  // Is this pellet (angle ang) aimed into a hatch within reach? Shut hatches only count from above.
  aimedHatch(p, ang) {
    if (p.aimX === undefined || p.aimX === null) return null;
    const ad = Math.hypot(p.aimX - p.x, p.aimY - p.y);
    if (ad > 260 || ad < 4) return null;
    const ax = p.x + Math.cos(ang) * ad, ay = p.y + Math.sin(ang) * ad, at = hatchAtPoint(this.map, ax, ay);
    if (!at || (!at.up && this.map.tiles[at.h.cells[0]] !== T.HOLE)) return null;
    return { ...at, ad, ax, ay };
  }
  shotThroughHatch(p, ang, at, dmg, wname, cls) {
    const { ax, ay } = at, h = at.h, t = this.map.tiles[h.cells[0]];
    if (t === T.HATCH && at.up && (cls === 'Shotgun' || cls === 'DMR')) { this.hatchDamage(h.id, dmg * 0.6); this.events.push({ e: 'hit', k: 'wood', x: r1(ax), y: r1(ay) }); return; }
    if (t !== T.HOLE) return;
    const tx = ax + (at.up ? h.bx - h.x : h.x - h.bx), ty = ay + (at.up ? h.by - h.y : h.y - h.by); // the same spot on the other floor
    const ox = at.up ? h.bx : h.x, oy = at.up ? h.by : h.y;
    for (const q of this.players.values()) {
      if (!q.alive || q === p) continue;
      if (Math.hypot(q.x - tx, q.y - ty) < hitR(q.op) + 3 && los(this.map, ox, oy, q.x, q.y)) { this.damage(q, dmg * 0.8, p, wname, ang); return; }
    }
    this.events.push({ e: 'hit', k: 'hard', x: r1(tx), y: r1(ty) });
  }

  damageCell(k, amount) {
    if (this.map.hatchAt[k] >= 0) return this.hatchDamage(this.map.hatchAt[k], amount);
    const t = this.map.tiles[k];
    if (t !== T.SOFT && t !== T.BARRI && t !== T.PANEL && t !== T.DSHIELD) return;
    this.map.hp[k] -= amount;
    if (this.map.hp[k] <= 0) this.destroyCell(k, true); else this.changed.add(k);
  }

  destroyCell(k, stub = false) { // stub: a soft wall knocked through by bullets or melee leaves a low stub to vault
    const m = this.map, t = m.tiles[k];
    if (m.hatchAt[k] >= 0) return this.breakHatch(m.hatchAt[k]);
    if (t === T.BARRI && m.openId[k] >= 0) { // a barricade is one board: when any of it breaks, all of it goes (no half-boarded doors)
      for (const c of m.openings[m.openId[k]].cells) if (m.tiles[c] === T.BARRI) { m.tiles[c] = T.OPEN; m.hp[c] = 0; delete m.holes[c]; this.changed.add(c); }
    }
    if (t === T.BARRI || t === T.PANEL) m.tiles[k] = T.OPEN;
    else if (m.openId[k] >= 0) m.tiles[k] = T.OPEN;
    else if (stub && t === T.SOFT) m.tiles[k] = T.RUBBLE;
    else m.tiles[k] = (m.floor[k] === FL.GRASS || m.floor[k] === FL.ASPHALT || m.floor[k] === FL.SAND) ? T.GROUND : T.FLOOR;
    m.hp[k] = 0; delete m.holes[k]; this.changed.add(k);
    for (const e of this.ents) if (e.type === 'cam' && e.hp > 0 && e.wall && e.wall.includes(k)) { // its wall is gone: the camera falls with it
      e.hp = 0; this.events.push({ e: 'hit', k: 'spark', x: r1(e.x), y: r1(e.y) });
    }
  }

  damage(q, amount, src, wname, ang) {
    if (!q.alive || amount <= 0) return;
    if (this.phase === PHASE.PREP && src && this.side(src) === this.side(q)) return; // no friendly fire (or hurting yourself) while setting up (he asked)
    if (this.tut && src && src.bot && !q.bot) return; // tutorial bots never hurt you (he asked)
    amount = Math.round(amount);
    if (src && src.ms && src !== q && this.side(src) !== this.side(q)) src.ms.damage += Math.min(amount, Math.max(0, q.hp));
    if (src && src.sock) this.events.push({ e: 'hitmark', to: src.id, kill: false });
    this.events.push({ e: 'hit', k: 'blood', x: r1(q.x), y: r1(q.y), a: r2(ang || 0) });
    this.events.push({ e: 'hurt', id: q.id, from: src ? r2(Math.atan2(src.y - q.y, src.x - q.x)) : 0 });
    if (q.downed) return this.kill(q, src, wname);
    q.hp -= amount;
    if (q.hp <= 0) {
      const up = [...this.players.values()].filter(o => o.alive && !o.downed && this.side(o) === this.side(q)).length;
      if (!this.headshot && q.hp > -35 && up > 1 && this.phase === PHASE.ACTION) {
        if (src && src.ms && src !== q) src.ms.downs++;
        if (src && src !== q && this.side(src) !== this.side(q)) this.pts(src, 50, 'ENEMY DOWNED');
        q.downed = true; q.hp = DUR.bleedout; q.downedBy = src ? src.id : null; q.busy = null; q.ctrl = 'body';
        q.scanning = false; q.bracing = false; q.reloadT = 0; this.ropeFall(q);
        this.events.push({ e: 'down', id: q.id, by: src ? src.id : null });
        if (q.hasDefuser) this.dropDefuser(q);
      } else this.kill(q, src, wname);
    }
  }

  kill(q, src, wname) {
    if (!q.alive) return;
    this.ropeFall(q);
    q.alive = false; q.downed = false; q.hp = 0; q.deaths++; q.busy = null; q.scanning = false; q.bracing = false;
    if (q.ctrl !== 'body') q.ctrl = 'body';
    if (src && src !== q && this.side(src) !== this.side(q)) { src.kills++; if (src.ms) { src.ms.kills++; this.opStat(src).kills++; } this.pts(src, this.headshot ? 120 : 100, this.headshot ? 'HEADSHOT KILL' : 'KILL'); }
    else if (src && src !== q) { src.kills--; this.pts(src, -50, 'TEAMKILL'); } // a teamkill costs you
    if (q.ms) { q.ms.deaths++; this.opStat(q).deaths++; }
    if (src && src.sock) this.events.push({ e: 'hitmark', to: src.id, kill: true });
    this.events.push({ e: 'kill', killer: src ? src.id : null, victim: q.id, w: wname || '', hs: this.headshot ? 1 : 0 });
    if (q.hasDefuser) this.dropDefuser(q);
    const d = this.ent(q.droneId); if (d && this.phase === PHASE.PREP) this.removeEnt(d);
  }

  dropDefuser(p) {
    p.hasDefuser = false;
    this.ents.push({ id: this.eid(), type: 'defuser', x: p.x, y: p.y, team: TEAM.ATK });
    this.msg('The defuser was dropped', TEAM.ATK);
  }

  hitEnt(e, src) {
    if (src && e.team && e.team !== this.side(src) && (e.hp || e.type === 'drone')) this.pts(src, e.type === 'drone' ? 20 : 25, e.type === 'drone' ? 'DRONE DESTROYED' : e.type === 'cam' ? 'CAMERA DESTROYED' : 'GADGET DESTROYED');
    if (e.type === 'cam') { e.hp = 0; this.events.push({ e: 'hit', k: 'spark', x: r1(e.x), y: r1(e.y) }); this.events.push({ e: 'snd', s: 'break', x: r1(e.x), y: r1(e.y) }); return; }
    this.events.push({ e: 'hit', k: 'spark', x: r1(e.x), y: r1(e.y) });
    this.events.push({ e: 'snd', s: 'break', x: r1(e.x), y: r1(e.y) });
    this.removeEnt(e);
    if (e.type === 'drone') this.droneLost(e);
  }

  // a drone has 1 hp: one bullet, hit, blast or zap and it's gone; its pilot drops back into their body
  droneLost(e) {
    const o = this.players.get(e.owner);
    if (!o) return;
    if (o.droneId === e.id) {
      o.droneId = null;
      if (o.ctrl === 'drone') { o.ctrl = 'body'; const list = o.staged ? this.feeds(this.side(o)) : []; if (list.length) this.watch(o, list[0]); }
    }
    this.msg(`${o.name}'s drone was destroyed`, e.team);
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
      const f = this.facingCell(p, 28); // the same reach as the on-screen prompt
      if (f && f.t === T.SOFT && this.reinforce > 0) return { k: 'reinforce', t: 0, dur: DUR.reinforce * (OPERATORS[p.op].ability.id === 'crew' ? 0.5 : 1), cell: f.k };
      if (f && f.t === T.OPEN && this.map.openId[f.k] >= 0 && p.barri > 0 && this.canBarricade(this.map.openId[f.k])) return { k: 'barricade', t: 0, dur: DUR.barricade, cell: f.k };
      const h = hatchNear(this.map, p.x, p.y, p.aim, 14);
      if (h && this.map.tiles[h.cells[0]] === T.HATCH && this.reinforce > 0) return { k: 'reinforce', t: 0, dur: DUR.reinforce * (OPERATORS[p.op].ability.id === 'crew' ? 0.5 : 1), hatch: h.id };
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
      this.planted = { x: bomb.x, y: bomb.y, bomb: bomb.id, t: this.tut ? 3 : DUR.bomb }; // the tutorial doesn't make you wait
      p.hasDefuser = false; if (p.ms) p.ms.plants++; this.pts(p, 150, 'DEFUSER PLANTED');
      this.events.push({ e: 'banner', text: 'DEFUSER PLANTED', sub: `Bomb ${bomb.id} — ${bomb.room}` });
      this.events.push({ e: 'snd', s: 'planted', x: r1(bomb.x), y: r1(bomb.y) });
    } else if (b.k === 'defuse') {
      this.events.push({ e: 'banner', text: 'DEFUSER DISABLED', sub: '' }); if (p.ms) p.ms.defuses++; this.pts(p, 150, 'DEFUSER DISABLED');
      this.endRound(TEAM.DEF, 'Defuser disabled');
    } else if (b.k === 'revive') {
      const q = this.players.get(b.target);
      q.downed = false; q.hp = 25; if (p.ms) p.ms.revives++; this.pts(p, 75, 'REVIVE'); this.events.push({ e: 'snd', s: 'revive', x: r1(q.x), y: r1(q.y) });
    } else if (b.k === 'reinforce' && b.hatch !== undefined) {
      if (this.map.tiles[this.map.hatches[b.hatch].cells[0]] === T.HATCH && this.reinforce > 0) { this.reinforceHatch(b.hatch); this.reinforce--; this.pts(p, 15, 'HATCH REINFORCED'); }
    } else if (b.k === 'reinforce') {
      if (this.map.tiles[b.cell] === T.SOFT && this.reinforce > 0) { this.reinforceWall(b.cell); this.reinforce--; this.pts(p, 15, 'WALL REINFORCED'); if (this.tut && !p.bot) this.tut.info.reinf++; }
    } else if (b.k === 'barricade') {
      if (p.barri > 0 && this.barricade(this.map.openId[b.cell], T.BARRI)) { p.barri--; this.pts(p, 5, 'BARRICADE'); if (this.tut && !p.bot) this.tut.info.barri++; }
    }
  }

  // the shield's pose right now (shieldPose in shared/operators.js); the drawing uses the same rule from the snapshot
  shieldOf(q) { return shieldPose(q.gait, q.moving === 2, this.time < (q.shieldOpenUntil || 0), this.time < (q.shieldDownUntil || 0)); }

  // ---------------- rappelling (he asked: attackers need a quicker way up; see addRopes in shared/map.js) ----------------
  // p.rope = { st: 'move' | 'hang', r: the window you hang at (-1 = none), from, to (-1 = the ground), t, dur, base }
  tickRope(p, dt) {
    const inp = p.input || {}, prev = p.prevInput || {}, edge = k => inp[k] && !prev[k], R = this.map.ropes || [];
    if (!inp.interact) p.ropeHeld = false; // E that started or ended a climb doesn't also start something else
    if (!p.rope) {
      if (!edge('interact') || this.phase !== PHASE.ACTION || this.side(p) !== TEAM.ATK || p.ctrl !== 'body' || p.downed || p.busy || p.vault || !p.alive) return;
      const hit = ropeAt(this.map, p.x, p.y); if (!hit) return;
      const [r, s] = hit;
      p.rope = { st: 'move', r: -1, from: -1, to: r.i, s, t: 0, dur: ROPE_CLIMB * r.lvl, base: ropeGround(this.map, r, s) }; p.ropeHeld = true;
      p.reloadT = 0; p.adsT = 0; p.burst = 0;
      this.noise(p.x, p.y, this.side(p), 260); this.events.push({ e: 'snd', s: 'rope', x: r1(p.x), y: r1(p.y), id: p.id });
      return;
    }
    if (p.ctrl !== 'body') p.ctrl = 'body';
    const o = p.rope, at = i => i === -2 ? o.top : i < 0 ? o.base : { x: R[i].hang.x + R[i].tx * (o.s || 0), y: R[i].hang.y + R[i].ty * (o.s || 0) };
    if (o.st === 'hang') {
      const r = R[o.r];
      if (edge('interact')) { // let go: slide back down to the ground below you
        p.rope = { st: 'move', r: -1, from: -2, to: -1, t: 0, dur: ROPE_DROP * r.lvl, base: ropeGround(this.map, r, ropeS(r, p.x, p.y)), top: { x: p.x, y: p.y } };
        p.ropeHeld = true; p.adsT = 0; p.burst = 0; this.events.push({ e: 'snd', s: 'rope', x: r1(p.x), y: r1(p.y), id: p.id });
      }
      return;
    }
    o.t += dt;
    const P = at(o.t < o.dur * 0.5 ? o.from : o.to); p.x = P.x; p.y = P.y; p.vx = p.vy = 0; // halfway up you show at the top
    if (o.t >= o.dur) {
      if (o.to < 0) p.rope = null;
      else { o.st = 'hang'; o.r = o.to; }
    }
  }
  // shot off the rope: down on the ground below it
  ropeFall(p) {
    if (!p.rope) return;
    const r = p.rope.st === 'hang' && this.map.ropes[p.rope.r], g = r ? ropeGround(this.map, r, ropeS(r, p.x, p.y)) : p.rope.base;
    p.x = g.x; p.y = g.y; p.vx = p.vy = 0; p.rope = null;
  }

  // Vault over the low thing in front of you (toward ang: where you're moving, else where you look).
  startVault(p, ang) {
    if (p.rope) { // hanging outside a window: climb in once it is open
      const r = p.rope.st === 'hang' && this.map.ropes[p.rope.r];
      if (!r || !ropeWindowOpen(this.map, r) || !ropeAtWindow(r, p.x, p.y) || p.downed) return false;
      p.rope = null;
      p.vault = { x0: p.x, y0: p.y, x1: r.inside.x, y1: r.inside.y, t: 0, dur: VAULT_TIME * 1.3 };
      this.noise(p.x, p.y, this.side(p), 320);
      this.events.push({ e: 'snd', s: 'vault', x: r1(p.x), y: r1(p.y), id: p.id });
      return true;
    }
    if (p.vault || p.downed || p.ctrl !== 'body' || p.busy || this.time < p.stunUntil || this.time < (p.clampUntil || 0)) return false;
    if (this.phase === PHASE.PREP && this.side(p) === TEAM.ATK) return false;
    const to = findVault(this.map, p.x, p.y, ang);
    if (!to) return false;
    const d = Math.hypot(to.x - p.x, to.y - p.y);
    p.vault = { x0: p.x, y0: p.y, x1: to.x, y1: to.y, t: 0, dur: VAULT_TIME * (0.8 + 0.2 * d / 40) };
    p.reloadT = 0; p.adsT = 0; p.scanning = false; p.bracing = false;
    this.noise(p.x, p.y, this.side(p), 320);
    this.events.push({ e: 'snd', s: 'vault', x: r1(p.x), y: r1(p.y), id: p.id });
    return true;
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
    for (const c of cells) { m.tiles[c] = T.REINF; m.hp[c] = 0; delete m.holes[c]; this.changed.add(c); }
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

  // He asked: every window starts boarded up (doorways start open). These are free, not out of anyone's 3.
  // Every window, and every door to the outside, starts boarded (he asked); free, not out of anyone's barricades.
  boardWindows() {
    const m = this.map, W = m.W;
    const outside = o => o.ext || o.cells.some(c => [1, -1, W, -W].some(d => { const k = c + d, t = m.tiles[k]; return !o.cells.includes(k) && m.flAt[k] === m.flAt[c] && (t === T.GROUND || t === T.VOID || (t === T.LOW && m.floor[k] === FL.VOID)); }));
    for (const o of m.openings) if ((o.kind === 'window' || outside(o)) && o.cells.every(c => m.tiles[c] === T.OPEN)) this.barricade(o.id, T.BARRI, true);
  }

  // A melee hit on a barricade: three break it (the whole board across the doorway or window, like R6)
  barriHit(k) {
    const o = this.map.openings[this.map.openId[k]], cells = o ? o.cells.filter(c => this.map.tiles[c] === T.BARRI) : [k];
    for (const c of cells) { this.map.hp[c] -= CELL_HP[T.BARRI] / 3 + 0.01; this.changed.add(c); }
    if (cells.some(c => this.map.hp[c] <= 0)) for (const c of cells) this.destroyCell(c);
  }

  // Can a barricade go up across this doorway/window now? (all of it open, nobody standing in it)
  canBarricade(openingId) {
    const o = this.map.openings[openingId];
    return !!o && o.cells.every(c => this.map.tiles[c] === T.OPEN) && !o.cells.some(c => this.cellOccupied(c));
  }

  barricade(openingId, type, quiet = false) {
    const o = this.map.openings[openingId];
    if (!o) return false;
    if (o.cells.some(c => this.cellOccupied(c))) return false;
    if (type === T.BARRI && !this.canBarricade(openingId)) return false;
    for (const c of o.cells) { this.map.tiles[c] = type; this.map.hp[c] = CELL_HP[type]; this.changed.add(c); if (this.map.holes[c]) delete this.map.holes[c]; }
    if (quiet) return true;
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
    if (p.vault && e.k !== 'spot' && e.k !== 'view') return; // busy climbing
    switch (e.k) {
      case 'vault': this.startVault(p, typeof e.a === 'number' && isFinite(e.a) ? e.a : p.aim); break;
      case 'reload': if (!p.downed && p.ctrl === 'body') this.startReload(p); break;
      case 'slot': if (!p.downed && p.guns[e.n] && e.n !== p.slot) { p.slot = e.n; p.reloadT = 0; p.fireCd = 0.35; this.events.push({ e: 'snd', s: 'swap', x: r1(p.x), y: r1(p.y), id: p.id }); } break;
      case 'melee': this.melee(p); break;
      case 'ability': if (!p.downed && p.ctrl === 'body' && !p.busy && !p.rope) this.useAbility(p); break;
      case 'gadget': if (!p.downed && p.ctrl === 'body' && !p.busy && !p.rope) this.useGadget(p); break;
      case 'view': this.toggleView(p); break;
      case 'camNext': case 'camPrev': if (p.ctrl === 'cam' || p.ctrl === 'drone') this.cycleCam(p, e.k === 'camNext' ? 1 : -1); break;
      case 'camSet': if (p.ctrl === 'cam' || p.ctrl === 'drone') { const f = this.feeds(team).find(f => f.id === e.id); if (f) this.watch(p, f); } break;
      case 'spot': {
        const q = this.players.get(e.id);
        if (q && q.alive && this.side(q) !== team && this.markOk(p)) {
          this.spot(team, q.id, DUR.spot);
          this.mark(p, q.x, q.y, 'ENEMY' + (q.op ? ' ' + OPERATORS[q.op].name : ''), q.id);
          if (!(p.pinged || (p.pinged = new Set())).has('p' + q.id)) { p.pinged.add('p' + q.id); this.pts(p, 20, 'ENEMY SPOTTED'); } // once per enemy a round
        }
        break;
      }
      // a ping on anything else: a camera, a trap, a wall, a door, a spot on the floor (the browser names it)
      case 'mark': {
        const x = Number(e.x), y = Number(e.y);
        if (!isFinite(x) || !isFinite(y) || x < 0 || y < 0 || x > this.map.W * CELL || y > this.map.H * CELL || !this.markOk(p)) break;
        const w = String(e.w || '').toUpperCase().replace(/[^A-Z0-9 .'-]/g, '').trim().slice(0, 28) || 'HERE';
        this.mark(p, x, y, w, typeof e.id === 'string' || typeof e.id === 'number' ? e.id : null);
        { // points for pinging something worth knowing (a gadget, camera, drone, the objective...), once per thing a round
          const key = e.id != null ? 'e' + e.id : w + '@' + (roomAt(this.map, x, y) || Math.round(x / 80) + ',' + Math.round(y / 80)), worth = !/^(GO|LOOK) HERE/.test(w);
          if (worth && !(p.pinged || (p.pinged = new Set())).has(key)) { p.pinged.add(key); this.pts(p, 10, w.split(' ').slice(0, 2).join(' ') + ' PINGED'); }
        }
        break;
      }
    }
  }

  toggleView(p) {
    if (p.downed) return;
    const team = this.side(p);
    if (team === TEAM.ATK) {
      if (this.phase === PHASE.PREP) return;
      if (p.ctrl === 'drone' || p.ctrl === 'cam') { p.ctrl = 'body'; return; }
      if (p.ctrl !== 'body' || p.busy) return;
      if (!this.ent(p.droneId) && p.drones > 0) {
        p.drones--;
        const pos = this.freeSpotNear(p.x + Math.cos(p.aim) * 12, p.y + Math.sin(p.aim) * 12, 10, true);
        const d = { id: this.eid(), type: 'drone', owner: p.id, team: TEAM.ATK, x: pos.x, y: pos.y, hp: 1, ang: p.aim };
        this.ents.push(d); p.droneId = d.id;
      }
      if (this.ent(p.droneId)) { p.ctrl = 'drone'; return; }
      const list = this.feeds(team); // no drone of your own left: watch a teammate's
      if (list.length) this.watch(p, list[0]);
    } else {
      if (p.ctrl === 'cam') { p.ctrl = 'body'; return; }
      if (p.ctrl !== 'body' || p.busy) return;
      const list = this.feeds(team);
      if (list.length) this.watch(p, list.find(f => f.id === p.feedId) || list[0]);
    }
  }

  // Everything a team can look through, flipped through with left/right or the mouse wheel:
  // defence every working camera (map, turret, sticky); attack every drone and wall scope.
  feeds(team) {
    return this.ents.filter(e => e.team === team && (team === TEAM.DEF ? (e.type === 'cam' && e.hp > 0) || e.type === 'scope' : e.type === 'drone' || e.type === 'scope'));
  }
  feed(p) { const f = this.ent(p.feedId); return f && this.feeds(this.side(p)).includes(f) ? f : null; }
  // only the one who placed a gadget camera can turn it or fire its laser; map cameras are anyone's
  operates(p, c) { return c.type === 'cam' && (!c.owner || c.owner === p.id); }
  // look through a feed: your own drone you drive, anything else you only watch (and mark from)
  watch(p, f) {
    if (f.type === 'drone' && f.id === p.droneId) { p.ctrl = 'drone'; return; }
    p.ctrl = 'cam'; p.feedId = f.id;
  }

  cycleCam(p, dir) {
    const list = this.feeds(this.side(p));
    if (!list.length) { p.ctrl = 'body'; return; }
    const i = list.indexOf(p.ctrl === 'drone' ? this.ent(p.droneId) : this.feed(p));
    this.watch(p, list[i < 0 ? 0 : (i + dir + list.length) % list.length]);
  }

  melee(p) {
    if (p.meleeCd > 0 || p.downed || p.ctrl !== 'body' || (p.rope && p.rope.st !== 'hang')) return;
    p.meleeCd = 0.75; p.fireCd = Math.max(p.fireCd, 0.45); // a swing takes a moment to recover from
    this.events.push({ e: 'melee', id: p.id });
    const team = this.side(p);
    if (p.bracing) { // shield bash: staggers whoever it hits; a miss leaves the shield down for a while
      const q = [...this.players.values()].find(q => q.alive && q !== p && Math.hypot(q.x - p.x, q.y - p.y) < 34 && Math.abs(angDiff(Math.atan2(q.y - p.y, q.x - p.x), p.aim)) < 1.0);
      if (q) { this.damage(q, 30, p, 'Shield Bash', p.aim); q.staggerUntil = this.time + 0.7; q.slowUntil = Math.max(q.slowUntil, this.time + 1); p.meleeCd = 0.8; }
      else { p.meleeCd = 1.4; p.shieldDownUntil = this.time + 1.2; }
      return;
    }
    for (const q of this.players.values()) {
      if (!q.alive || q === p) continue; // friendly fire: a swing hits teammates too
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < 28 && Math.abs(angDiff(Math.atan2(q.y - p.y, q.x - p.x), p.aim)) < 1.1 && los(this.map, p.x, p.y, q.x, q.y)) {
        // hitting a shield from the front knocks it aside for a moment instead of hurting
        if (OPERATORS[q.op].ability.id === 'brace' && !q.downed && q.ctrl === 'body' && Math.abs(angDiff(Math.atan2(p.y - q.y, p.x - q.x), q.aim)) < 0.8 && !(this.time < (q.shieldDownUntil || 0))) {
          q.shieldDownUntil = this.time + 1.0; p.meleeCd = 1.3; p.fireCd = Math.max(p.fireCd, 0.9); this.events.push({ e: 'hit', k: 'shield', x: r1(q.x), y: r1(q.y) }); this.events.push({ e: 'snd', s: 'panel', x: r1(q.x), y: r1(q.y) }); return;
        }
        const behind = Math.abs(angDiff(Math.atan2(p.y - q.y, p.x - q.x), q.aim)) > 2.0; // CROW: from behind, a silent kill
        if (OPERATORS[p.op].ability.id === 'takedown' && behind && this.side(q) !== this.side(p)) { this.damage(q, 999, p, 'Silent Takedown', p.aim); return; }
        this.damage(q, q.downed ? 999 : 55, p, 'Melee', p.aim); return;
      }
    }
    for (const e of this.ents) {
      if (e.team === team || !(e.hp || e.type === 'wire')) continue;
      if (Math.hypot(e.x - p.x, e.y - p.y) < 26) { this.hitEnt(e, p); return; }
    }
    const f = this.facingCell(p, 20);
    const hn = hatchNear(this.map, p.x, p.y, p.aim, 14);
    if (hn && this.map.tiles[hn.cells[0]] === T.HATCH && (!f || Math.hypot(hn.x - p.x, hn.y - p.y) < Math.hypot((f.cx + 0.5) * CELL - p.x, (f.cy + 0.5) * CELL - p.y))) { // a swing at the hatch at your feet
      this.hatchDamage(hn.id, 25); this.events.push({ e: 'hit', k: 'wood', x: r1(hn.x), y: r1(hn.y) }); return;
    }
    if (!f) return;
    if (f.t === T.BARRI) {
      this.barriHit(f.k);
      this.events.push({ e: 'hit', k: 'wood', x: r1((f.cx + 0.5) * CELL), y: r1((f.cy + 0.5) * CELL) });
    } else if (f.t === T.RUBBLE) { this.destroyCell(f.k); this.events.push({ e: 'hit', k: 'wall', x: r1((f.cx + 0.5) * CELL), y: r1((f.cy + 0.5) * CELL) }); }
    else if (f.t === T.SOFT) { this.damageCell(f.k, 25); this.events.push({ e: 'hit', k: 'wall', x: r1((f.cx + 0.5) * CELL), y: r1((f.cy + 0.5) * CELL) }); }
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
    if (id === 'gas' && p.gasId) { const n = this.ent(p.gasId); p.gasId = null; if (n) this.detonate(n); return; } // second press releases the gas
    if (op.ability.count && p.abilityCount <= 0) return;
    const ca = Math.cos(p.aim), sa = Math.sin(p.aim);
    const place = (type, dist, extra = {}) => { // set something down just in front of you, if there's floor there
      const pos = this.freeSpotNear(p.x + ca * dist, p.y + sa * dist, 4);
      const e = { id: this.eid(), type, x: pos.x, y: pos.y, ang: p.aim, team, owner: p.id, hp: 1, ...extra };
      this.ents.push(e); used(); this.events.push({ e: 'snd', s: 'place', x: r1(pos.x), y: r1(pos.y) });
      return e;
    };
    // the far side of the wall you face (for gadgets that push through it)
    const through = w => { const cx = (w.cx + 0.5) * CELL, cy = (w.cy + 0.5) * CELL, dx = Math.sign(Math.round(cx - w.x)), dy = Math.sign(Math.round(cy - w.y)); return { dx, dy, x: cx + dx * (CELL / 2 + 5), y: cy + dy * (CELL / 2 + 5) }; };
    const used = () => { p.abilityCount--; };
    if (id === 'cutter') {
      const w = this.wallInFront(p, [T.SOFT, T.REINF, T.BARRI, T.PANEL, T.DSHIELD]) || this.hatchSpot(p, [T.HATCH, T.HATCHR]);
      if (!w) return;
      this.ents.push({ id: this.eid(), type: 'cutter', x: w.x, y: w.y, cell: w.k, hatch: w.hatch, team, owner: p.id, t: 5, hp: 1 });
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
    } else if (id === 'barrage') { // three smokes in a line
      const far = castSight(this.map, p.x, p.y, p.aim, 220, null);
      for (const d of [55, 105, 155]) {
        const dd = Math.min(d, far - 14); if (dd < 20) continue;
        this.ents.push({ id: this.eid(), type: 'smoke', x: p.x + ca * dd, y: p.y + sa * dd, r: 50, life: 12, team });
      }
      used(); this.events.push({ e: 'snd', s: 'smoke', x: r1(p.x), y: r1(p.y) });
    } else if (id === 'sonar' || id === 'stickycam') { this.throwNade(p, id === 'sonar' ? 'sonar' : 'cam'); used(); }
    else if (id === 'gas') { p.gasId = this.throwNade(p, 'gas').id; used(); }
    else if (id === 'adrenal') { p.boostUntil = this.time + 6; used(); this.events.push({ e: 'stim', x: r1(p.x), y: r1(p.y), x2: r1(p.x), y2: r1(p.y) }); }
    else if (id === 'ghost') { p.ghostUntil = this.time + 10; used(); this.events.push({ e: 'snd', s: 'ghost', x: r1(p.x), y: r1(p.y) }); }
    else if (id === 'cluster') {
      const w = this.wallInFront(p, [T.SOFT, T.BARRI]); if (!w) return;
      const t = through(w);
      this.ents.push({ id: this.eid(), type: 'cluster', x: w.x, y: w.y, cell: w.k, dx: t.dx, dy: t.dy, team, owner: p.id, t: 3, hp: 1 });
      used(); this.events.push({ e: 'snd', s: 'place', x: r1(w.x), y: r1(w.y) });
    } else if (id === 'scope') {
      const w = this.wallInFront(p, [T.SOFT]); if (!w) return;
      const t = through(w);
      this.ents.push({ id: this.eid(), type: 'scope', x: t.x, y: t.y, ang: Math.atan2(t.dy, t.dx), cell: w.k, team, owner: p.id, hp: 1 });
      used(); this.events.push({ e: 'snd', s: 'place', x: r1(w.x), y: r1(w.y) });
    } else if (id === 'decoy') {
      const g = p.guns[0];
      this.ents.push({ id: this.eid(), type: 'decoy', x: p.x + ca * 14, y: p.y + sa * 14, ang: p.aim, op: p.op, w: g ? g.w : null, team, owner: p.id, hp: 1, life: 6 });
      used(); this.events.push({ e: 'snd', s: 'place', x: r1(p.x), y: r1(p.y) });
    } else if (id === 'arc') { // the first enemy gadget or defender along the bolt
      let bt = castSight(this.map, p.x, p.y, p.aim, 380, null), hitE = null, hitQ = null;
      for (const e of this.ents) {
        if (e.team === team || !(e.hp || e.type === 'wire')) continue;
        const t = rayCircle(p.x, p.y, ca, sa, e.x, e.y, 8);
        if (t !== null && t < bt) { bt = t; hitE = e; }
      }
      for (const q of this.players.values()) {
        if (!q.alive || q === p) continue;
        const t = rayCircle(p.x, p.y, ca, sa, q.x, q.y, hitR(q.op));
        if (t !== null && t < bt) { bt = t; hitQ = q; hitE = null; }
      }
      if (hitE) { if (hitE.tu) hitE.offUntil = this.time + 10; else this.hitEnt(hitE, p); }
      if (hitQ) { this.damage(hitQ, 15, p, 'Arc Gun', p.aim); hitQ.stunUntil = Math.max(hitQ.stunUntil, this.time + 0.5); }
      used(); this.events.push({ e: 'arc', x: r1(p.x), y: r1(p.y), x2: r1(p.x + ca * bt), y2: r1(p.y + sa * bt) });
    } else if (id === 'hammer') { // smash soft walls and barricades open, or flatten someone in reach
      if (p.meleeCd > 0) return;
      const f = this.facingCell(p, 30), hs = this.hatchSpot(p, [T.HATCH]);
      if (hs && !(f && (f.t === T.SOFT || f.t === T.BARRI) && Math.hypot((f.cx + 0.5) * CELL - p.x, (f.cy + 0.5) * CELL - p.y) < Math.hypot(hs.x - p.x, hs.y - p.y))) {
        this.breakHatch(hs.hatch);
      } else if (f && (f.t === T.SOFT || f.t === T.BARRI || f.t === T.RUBBLE)) {
        const across = Math.abs(ca) > Math.abs(sa) ? [0, 1] : [1, 0];
        for (const d of [0, 1, -1]) {
          const k = (f.cy + across[1] * d) * this.map.W + f.cx + across[0] * d, t = this.map.tiles[k];
          if (t === T.SOFT || t === T.BARRI || t === T.RUBBLE) this.destroyCell(k);
        }
        this.events.push({ e: 'hit', k: f.t === T.BARRI ? 'wood' : 'wall', x: r1((f.cx + 0.5) * CELL), y: r1((f.cy + 0.5) * CELL) });
        this.events.push({ e: 'snd', s: 'break', x: r1(p.x), y: r1(p.y) });
      } else {
        const q = [...this.players.values()].find(q => q.alive && q !== p && Math.hypot(q.x - p.x, q.y - p.y) < 30 &&
          Math.abs(angDiff(Math.atan2(q.y - p.y, q.x - p.x), p.aim)) < 1.1);
        if (!q) return;
        this.damage(q, 75, p, 'Breaching Hammer', p.aim);
      }
      p.meleeCd = 0.9; used(); this.events.push({ e: 'melee', id: p.id });
    } else if (id === 'prox') place('prox', 10, { arm: 1.5 });
    else if (id === 'concuss') place('concuss', 10, { arm: 1.5 });
    else if (id === 'clamp') place('clamp', 14, { arm: 1.5 });
    else if (id === 'sensor') place('sensor', 8, { t: 0, pingT: 0 });
    else if (id === 'plates') place('plates', 14, { c: 5 });
    else if (id === 'turret') place('cam', 14, { tu: 1, offUntil: 0 });
    else if (id === 'grid') {
      const w = this.wallInFront(p, [T.SOFT, T.REINF, T.BARRI, T.PANEL]); if (!w) return;
      this.ents.push({ id: this.eid(), type: 'grid', x: w.x, y: w.y, cell: w.k, team, owner: p.id, hp: 1 });
      used(); this.events.push({ e: 'snd', s: 'place', x: r1(w.x), y: r1(w.y) });
    } else if (id === 'stim') {
      const dx = Math.cos(p.aim), dy = Math.sin(p.aim);
      let tgt = null, tb = castSight(this.map, p.x, p.y, p.aim, 420, null);
      for (const q of this.players.values()) {
        if (q === p || !q.alive || this.side(q) !== team) continue;
        const t = rayCircle(p.x, p.y, dx, dy, q.x, q.y, 13);
        if (t !== null && t < tb) { tb = t; tgt = q; }
      }
      tgt = tgt || p;
      if (tgt.downed) { tgt.downed = false; tgt.hp = 40; if (p.ms) p.ms.revives++; this.pts(p, 75, 'REVIVE'); }
      else tgt.hp = Math.min(tgt.maxHp + 30, tgt.hp + 40);
      used();
      this.events.push({ e: 'stim', x: r1(p.x), y: r1(p.y), x2: r1(tgt.x), y2: r1(tgt.y) });
    }
    // ---- the operators added to fill every role (he asked) ----
    else if (id === 'sticky') { // SALVO: a round that sticks, then blows through
      this.ents.push({ id: this.eid(), type: 'sticky', x: p.x + ca * 12, y: p.y + sa * 12, vx: ca * 560, vy: sa * 560, team, owner: p.id, travel: 0, t: 1.5 });
      used(); this.events.push({ e: 'snd', s: 'launcher', x: r1(p.x), y: r1(p.y) });
    } else if (id === 'spreader') { // TORQUE: prises a two-block gap open after 4 s
      const w = this.wallInFront(p, [T.SOFT, T.REINF]); if (!w) return;
      const across = Math.abs(ca) > Math.abs(sa) ? [0, 1] : [1, 0];
      this.ents.push({ id: this.eid(), type: 'spreader', x: w.x, y: w.y, cell: w.k, ax: across[0], ay: across[1], team, owner: p.id, t: 4, hp: 1 });
      used(); this.events.push({ e: 'snd', s: 'place', x: r1(w.x), y: r1(w.y) });
    } else if (id === 'dash') { if (this.dash(p)) used(); }
    else if (id === 'flare' || id === 'medkit' || id === 'echobox') { this.throwNade(p, id); used(); }
    else if (id === 'spike') place('spike', 10, { life: 15, t: 0, pingT: 0 });
    else if (id === 'tracer') { p.tracerUntil = this.time + 8; used(); this.events.push({ e: 'snd', s: 'swap', x: r1(p.x), y: r1(p.y), id: p.id }); }
    else if (id === 'cover') { if (this.placeShield(p)) used(); }
    else if (id === 'pick') { // WREN: a barricade comes apart quietly
      const f = this.facingCell(p, 28); if (!f || f.t !== T.BARRI) return;
      this.ents.push({ id: this.eid(), type: 'pick', x: (f.cx + 0.5) * CELL, y: (f.cy + 0.5) * CELL, cell: f.k, team, owner: p.id, t: 1.5, hp: 1 });
      used();
    } else if (id === 'cloak') { // VAPOR: a smoke that follows you
      this.ents.push({ id: this.eid(), type: 'smoke', x: p.x, y: p.y, r: 30, life: 6, team, follow: p.id });
      used(); this.events.push({ e: 'snd', s: 'smoke', x: r1(p.x), y: r1(p.y) });
    } else if (id === 'alarm') place('alarm', 12, { arm: 1 });
    else if (id === 'tag') { // HOUND: the first attacker along the dart is revealed for 10 s
      let bt = castSight(this.map, p.x, p.y, p.aim, 420, null), hitQ = null;
      for (const q of this.players.values()) {
        if (!q.alive || q === p || this.side(q) === team) continue;
        const t = rayCircle(p.x, p.y, ca, sa, q.x, q.y, hitR(q.op));
        if (t !== null && t < bt) { bt = t; hitQ = q; }
      }
      if (hitQ) this.spot(team, hitQ.id, 10);
      used(); this.events.push({ e: 'stim', x: r1(p.x), y: r1(p.y), x2: r1(p.x + ca * bt), y2: r1(p.y + sa * bt), tag: 1 });
    } else if (id === 'rally') { p.hp = Math.min(p.maxHp, p.hp + 40); p.boostUntil = this.time + 4; used(); this.events.push({ e: 'stim', x: r1(p.x), y: r1(p.y), x2: r1(p.x), y2: r1(p.y) }); }
    else if (id === 'periscope') { // LENS: a defender's scope through a soft wall, seen in the camera feeds
      const w = this.wallInFront(p, [T.SOFT]); if (!w) return;
      const t = through(w);
      this.ents.push({ id: this.eid(), type: 'scope', x: t.x, y: t.y, ang: Math.atan2(t.dy, t.dx), cell: w.k, team, owner: p.id, hp: 1 });
      used(); this.events.push({ e: 'snd', s: 'place', x: r1(w.x), y: r1(w.y) });
    } else if (id === 'radar') place('radar', 8, { life: 15, t: 0 });
    else if (id === 'station') place('station', 14, { pool: 100 });
    else if (id === 'catcher') place('catcher', 10, { c: 2 });
  }

  // RUSH: a 3 m burst forward along your aim; barricades in the way splinter, people in the way stagger
  dash(p) {
    if (p.vault || p.downed || p.ctrl !== 'body' || p.busy || p.rope) return false;
    const ca = Math.cos(p.aim), sa = Math.sin(p.aim), m = this.map;
    let x = p.x, y = p.y; const hit = new Set();
    for (let d = 4; d <= 3 * PX_PER_M; d += 4) {
      const nx = p.x + ca * d, ny = p.y + sa * d;
      for (const off of [0, -0.5, 0.5]) { // the leading edge of your body: a barricade there splinters before you hit it
        const fx = nx + Math.cos(p.aim + off) * (PLAYER_R + 2), fy = ny + Math.sin(p.aim + off) * (PLAYER_R + 2), k = Math.floor(fy / CELL) * m.W + Math.floor(fx / CELL);
        if (m.tiles[k] === T.BARRI) { this.destroyCell(k); this.events.push({ e: 'hit', k: 'wood', x: r1(fx), y: r1(fy) }); this.noise(fx, fy, this.side(p), 500); }
      }
      if (circleBlocked(m, nx, ny, PLAYER_R, blocksMove)) break;
      for (const q of this.players.values()) if (q !== p && q.alive && Math.hypot(q.x - nx, q.y - ny) < PLAYER_R * 2) hit.add(q);
      x = nx; y = ny;
    }
    for (const q of hit) { q.staggerUntil = this.time + 0.7; q.slowUntil = Math.max(q.slowUntil, this.time + 1); this.damage(q, 10, p, 'Breaching Dash', p.aim); }
    if (Math.hypot(x - p.x, y - p.y) < 8) return false;
    p.vault = { x0: p.x, y0: p.y, x1: x, y1: y, t: 0, dur: 0.28 };
    this.events.push({ e: 'snd', s: 'vault', x: r1(p.x), y: r1(p.y), id: p.id });
    return true;
  }
  // a bulletproof barrier two cells wide across your aim (Deployable Shield gadget, TRENCH's Drop Cover)
  placeShield(p) {
    const fx = p.x + Math.cos(p.aim) * 20, fy = p.y + Math.sin(p.aim) * 20;
    const across = Math.abs(Math.cos(p.aim)) > Math.abs(Math.sin(p.aim)) ? [0, 1] : [1, 0];
    const cx = Math.floor(fx / CELL), cy = Math.floor(fy / CELL);
    const ks = [[cx, cy], [cx + across[0], cy + across[1]]].map(([x, y]) => y * this.map.W + x);
    if (ks.some(k => { const t = this.map.tiles[k]; return (t !== T.FLOOR && t !== T.GROUND) || this.cellOccupied(k); })) return false;
    for (const k of ks) { this.map.tiles[k] = T.DSHIELD; this.map.hp[k] = CELL_HP[T.DSHIELD]; this.changed.add(k); }
    this.events.push({ e: 'snd', s: 'panel', x: r1(fx), y: r1(fy) });
    return true;
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
      const w = this.wallInFront(p, [T.SOFT, T.BARRI]) || this.hatchSpot(p, [T.HATCH]);
      if (!w) return;
      this.ents.push({ id: this.eid(), type: 'breach', x: w.x, y: w.y, cell: w.k, hatch: w.hatch, team, owner: p.id, t: 2.5, hp: 1 });
      p.gadgetCount--; this.events.push({ e: 'snd', s: 'place', x: r1(w.x), y: r1(w.y) });
    } else if (g === 'claymore') {
      this.ents.push({ id: this.eid(), type: 'claymore', x: p.x + Math.cos(p.aim) * 10, y: p.y + Math.sin(p.aim) * 10, ang: p.aim, team, owner: p.id, arm: 1.5, hp: 1 });
      p.gadgetCount--; this.events.push({ e: 'snd', s: 'place', x: r1(p.x), y: r1(p.y) });
    } else if (g === 'wire') {
      this.ents.push({ id: this.eid(), type: 'wire', x: p.x + Math.cos(p.aim) * 22, y: p.y + Math.sin(p.aim) * 22, ang: p.aim, team, owner: p.id });
      p.gadgetCount--; this.events.push({ e: 'snd', s: 'place', x: r1(p.x), y: r1(p.y) });
    } else if (g === 'dshield') {
      if (this.placeShield(p)) p.gadgetCount--; // two cells side by side, across your aim, just in front of you
    }
  }

  throwNade(p, kind) {
    const tx = p.aimX ?? p.x + Math.cos(p.aim) * 200, ty = p.aimY ?? p.y + Math.sin(p.aim) * 200;
    const dist = Math.max(40, Math.min(300, Math.hypot(tx - p.x, ty - p.y)));
    const v = dist * 2.5;
    const fuse = { frag: 2.5, smoke: 1.0, stun: 1.3, impact: 3, nitro: 999, emp: 1.5, sonar: 1.1, gas: 999, cam: 0.9, flare: 1.0, medkit: 0.8, echobox: 0.7 }[kind];
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

  ghost(q) { return this.time < (q.ghostUntil || 0); } // Ghost Step: traps and sensors don't notice
  gridNear(x, y, team) { return this.ents.find(g => g.type === 'grid' && g.team === team && Math.hypot(g.x - x, g.y - y) < 30) || null; }
  smokeList() { return this.ents.filter(e => e.type === 'smoke'); }

  jammedAt(x, y) {
    for (const e of this.ents) if (e.type === 'jammer' && Math.hypot(e.x - x, e.y - y) < JAM_R) return true;
    return false;
  }

  // pings (he asked: no spamming): each ping makes you wait longer for the next — 1, 2, 4, 8, 16 s, never more
  // than 20 — and the wait shrinks back one step for every 8 s you go without pinging. Only while alive in a round.
  markOk(p) {
    if (!p.alive || (this.phase !== PHASE.PREP && this.phase !== PHASE.ACTION)) return false;
    const now = this.time;
    if (now < (p.pingReady || 0)) { this.events.push({ e: 'pingwait', to: p.id, t: r1(p.pingReady - now) }); return false; }
    const quiet = now - (p.pingLast ?? -99);
    p.pingLevel = Math.max(0, (p.pingLevel || 0) - Math.floor(Math.max(0, quiet - (p.pingWait || 0)) / 8));
    p.pingWait = Math.min(20, [0, 1, 2, 4, 8, 16][p.pingLevel] ?? 20);
    p.pingLevel++; p.pingLast = now; p.pingReady = now + p.pingWait;
    return true;
  }
  // A labelled marker for the pinger's team, plus a line in their team chat saying what and where.
  mark(p, x, y, w, id) {
    const team = this.side(p), room = roomAt(this.map, x, y);
    this.events.push({ e: 'mark', team, x: r1(x), y: r1(y), w, by: p.name, from: p.id, id });
    const msg = JSON.stringify({ t: 'chat', from: p.id, name: p.name, text: w + (room ? ' · ' + room : ''), team: true, squad: p.squad, ping: 1 });
    for (const q of this.players.values()) if (q.sock && q.sock.open && q.squad === p.squad) q.sock.send(msg);
    if (this.tut && !p.bot) { const i = this.tut.info; if (!i.pings.includes(w)) i.pings.push(w); i.n++; if (p.ctrl !== 'body') i.feedPings++; }
  }

  // ---------------- tutorial ----------------
  blankTutInfo() { return { reinf: 0, barri: 0, pings: [], n: 0, feedPings: 0 }; }
  // 'start' / 'retry' sets up a lesson: you alone against two easy bots on Harbor Office.
  // 'go' moves on when the coach is done with a held phase (operator select, preparation).
  tutAction(p, m) {
    const tu = this.tut;
    if (m.a === 'start' || m.a === 'retry') {
      const lesson = 'all'; // one run: attack a round, then defend one
      for (const q of [...this.players.values()]) if (q.bot) this.players.delete(q.id);
      p.squad = 0;
      tu.lesson = lesson; tu.hold = true; tu.info = this.blankTutInfo();
      if (this.mapId !== 'harbor') { this.mapId = 'harbor'; this.map = buildMap(this.mapId); }
      this.addBot(1); this.addBot(1);
      this.startMatch();
    } else if (m.a === 'finish') { // Space on the last step: done
      if (this.phase === PHASE.ACTION) this.endRound(TEAM.DEF, 'Tutorial finished');
    } else if (m.a === 'go') {
      if (this.phase === PHASE.SELECT) this.timer = 0;
      else if (this.phase === PHASE.PREP && tu.hold) { tu.hold = false; this.timer = Math.min(this.timer, 3.5); }
    }
  }

  // ---------------- free play ----------------
  // 'start' {map, bots}: you on the chosen map, straight into the action, against that many enemy bots.
  // 'op' {dir: 1/-1}: switch to the next/previous operator (attackers, then defenders), right where you stand.
  freeAction(p, m) {
    const F = this.free;
    // screenshot tests only (server started with R62D_FAST): put someone (you, or a bot by id) at a spot, frozen there
    if (m.a === 'tp' && process.env.R62D_FAST) {
      const q = m.id ? this.players.get(m.id) : p;
      if (q && isFinite(m.x) && isFinite(m.y)) { q.x = m.x; q.y = m.y; if (isFinite(m.aim)) q.aim = m.aim; if (q.bot) q.hold = !!m.hold; }
      return;
    }
    if (m.a === 'start') {
      for (const q of [...this.players.values()]) if (q.bot) this.players.delete(q.id);
      F.bots = Math.max(0, Math.min(TEAM_SIZE, m.bots | 0));
      if (BOT_LEVELS[m.level]) this.botLevel = m.level;
      if (MAPS[m.map] && m.map !== this.mapId) { this.mapId = m.map; this.map = buildMap(this.mapId); }
      p.squad = 0;
      for (let i = 0; i < F.bots; i++) this.addBot(1);
      this.startMatch(); // round 1: squad 0 attacks
      p.op = opsForTeam(TEAM.ATK)[0];
      for (const q of this.players.values()) if (q.bot) botPickOp(this, q);
      this.beginPrep(); this.beginAction();
      p.hasDefuser = true;
      this.events = [{ e: 'banner', text: 'FREE PLAY', sub: MAPS[this.mapId].name }];
    } else if (m.a === 'op' && this.phase === PHASE.ACTION) {
      const i = Math.max(0, FREE_OPS.indexOf(p.op)), n = FREE_OPS.length;
      this.freeSwitch(p, FREE_OPS[(i + (m.dir < 0 ? -1 : 1) + n) % n]);
    }
  }
  freeSwitch(p, op) {
    const squad = OPERATORS[op].team === TEAM.ATK ? 0 : 1;
    if (p.ctrl === 'drone' || p.ctrl === 'cam') p.ctrl = 'body';
    if (p.hasDefuser) this.dropDefuser(p);
    for (const e of [...this.ents]) if (e.owner === p.id) this.removeEnt(e); // your old drone and gadgets go with your old operator
    const x = p.x, y = p.y, aim = p.aim, wasAlive = p.alive;
    if (squad !== p.squad) { // changing sides: the bots swap to the other side and come back as fresh operators
      p.squad = squad;
      for (const q of this.players.values()) if (q.bot) {
        if (q.hasDefuser) this.dropDefuser(q);
        for (const e of [...this.ents]) if (e.owner === q.id) this.removeEnt(e);
        q.squad = 1 - squad; q.op = null; this.freeSpawn(q, true);
      }
    }
    p.op = op;
    this.freeSpawn(p, !wasAlive);
    if (wasAlive) { p.x = x; p.y = y; p.aim = aim; }
    this.events.push({ e: 'snd', s: 'swap', x: r1(p.x), y: r1(p.y), id: p.id });
  }
  // (re)equips a player; atSpawn also puts them at their side's starting spot
  freeSpawn(p, atSpawn) {
    p.respawnAt = 0;
    if (!p.op) { // a random operator of their side that no teammate is playing
      const taken = new Set([...this.players.values()].filter(q => q.squad === p.squad && q.op).map(q => q.op)), list = opsForTeam(this.side(p)).filter(o => !taken.has(o));
      p.op = list[Math.floor(Math.random() * list.length)] || opsForTeam(this.side(p))[0];
    }
    this.equip(p);
    const map = this.map, atk = this.side(p) === TEAM.ATK;
    if (atSpawn) {
      if (!atk) {
        const cells = this.freeCellsInRooms(map.sites[this.site].rooms), k = cells[Math.floor(Math.random() * cells.length)];
        p.x = (k % map.W + 0.5) * CELL; p.y = (Math.floor(k / map.W) + 0.5) * CELL; p.aim = Math.random() * Math.PI * 2;
      } else {
        const sp = map.atkSpawns.find(s => s.name === this.spawnName) || map.atkSpawns[0], pos = this.freeSpotNear(sp.x, sp.y, 46);
        p.x = pos.x; p.y = pos.y; p.aim = Math.atan2(map.H * CELL / 2 - p.y, map.W * CELL / 2 - p.x);
      }
    }
    if (atk) { p.drones = 2; if (!p.bot && !this.planted && !this.ents.some(e => e.type === 'defuser')) p.hasDefuser = true; }
  }
  freeRespawns() { // the dead come back at their side's start after 3 s
    for (const p of this.players.values()) {
      if (p.alive || !p.op) continue;
      if (!p.respawnAt) p.respawnAt = this.time + 3;
      else if (this.time >= p.respawnAt) this.freeSpawn(p, true);
    }
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
        case 'smoke': {
          e.life -= dt; if (e.life <= 0) { this.removeEnt(e); break; }
          const o = e.follow && this.players.get(e.follow); if (o && o.alive) { e.x = o.x; e.y = o.y; } // VAPOR's cloak goes with her
          break;
        }
        case 'sticky': {
          if (e.stuck) { // counting down where it stuck (on a person, it goes with them)
            const q = e.on && this.players.get(e.on); if (q && q.alive) { e.x = q.x; e.y = q.y; }
            e.t -= dt; if (e.t <= 0) this.detonate(e);
            break;
          }
          const step = Math.hypot(e.vx, e.vy) * dt, dx = e.vx / (step / dt), dy = e.vy / (step / dt);
          let hitT = null, hitQ = null;
          for (const q of this.players.values()) {
            if (!q.alive || q.id === e.owner) continue;
            const t = rayCircle(e.x, e.y, dx, dy, q.x, q.y, hitR(q.op));
            if (t !== null && t <= step && (hitT === null || t < hitT)) { hitT = t; hitQ = q; }
          }
          let wc = null;
          const wallT = walkRay(e.x, e.y, dx, dy, step, (cx, cy) => { const t = tileAt(this.map, cx, cy); if (blocksDrone(t) || t === T.BARRI) { wc = { cx, cy, t }; return true; } return false; });
          const stick = () => { e.stuck = true; e.vx = e.vy = 0; this.events.push({ e: 'snd', s: 'place', x: r1(e.x), y: r1(e.y) }); };
          if (hitQ && hitT < wallT) { e.x = hitQ.x; e.y = hitQ.y; e.on = hitQ.id; stick(); break; }
          if (wc && wallT < step) {
            e.x += dx * Math.max(0, wallT - 2); e.y += dy * Math.max(0, wallT - 2);
            if (wc.t === T.SOFT || wc.t === T.BARRI) { e.cell = wc.cy * this.map.W + wc.cx; e.bx = e.x + dx * (CELL + 22); e.by = e.y + dy * (CELL + 22); } // the room behind gets the second blast
            stick(); break;
          }
          e.x += e.vx * dt; e.y += e.vy * dt; e.travel += step;
          if (e.travel > 520) stick();
          break;
        }
        case 'spike': case 'radar': {
          e.life -= dt; e.t -= dt; if (e.life <= 0) { this.removeEnt(e); break; }
          if (e.t > 0) break;
          if (e.type === 'spike') { // ECHO: defenders running near it show up
            e.t = 0.5; let any = false;
            for (const q of this.players.values()) if (q.alive && this.side(q) !== e.team && !this.ghost(q) && !q.shrouded && q.moving === 2 && Math.hypot(q.x - e.x, q.y - e.y) < 10 * PX_PER_M) { this.spot(e.team, q.id, 1.5); any = true; }
            e.pingT -= 0.5; if (any && e.pingT <= 0) { e.pingT = 1.5; this.events.push({ e: 'ping', x: r1(e.x), y: r1(e.y), team: e.team, any: true }); }
          } else { // AUDIT: every attacker drone nearby is marked for the defenders, again and again
            e.t = 1.5; const o = this.players.get(e.owner);
            for (const d of this.ents) if (d.type === 'drone' && d.team !== e.team && Math.hypot(d.x - e.x, d.y - e.y) < 15 * PX_PER_M)
              this.events.push({ e: 'mark', team: e.team, x: r1(d.x), y: r1(d.y), w: 'DRONE', by: o ? o.name : 'Radar', from: e.owner, id: d.id });
          }
          break;
        }
        case 'pick': // WREN: the barricade comes apart without a sound
          e.t -= dt;
          if (e.t <= 0) {
            const m = this.map, o = m.openId[e.cell] >= 0 ? m.openings[m.openId[e.cell]] : null;
            if (o) for (const c of o.cells) if (m.tiles[c] === T.BARRI) { m.tiles[c] = T.OPEN; m.hp[c] = 0; delete m.holes[c]; this.changed.add(c); }
            this.removeEnt(e);
          }
          break;
        case 'alarm': {
          if (e.arm > 0) { e.arm -= dt; break; }
          for (const q of this.players.values()) {
            if (!q.alive || this.side(q) === e.team || this.ghost(q) || Math.hypot(q.x - e.x, q.y - e.y) > 15) continue;
            this.spot(e.team, q.id, 6); this.events.push({ e: 'ping', x: r1(e.x), y: r1(e.y), team: e.team, any: true }); this.removeEnt(e); break;
          }
          break;
        }
        case 'echobox': // RUSE: footsteps and the odd burst of gunfire that aren't there
          e.life -= dt; e.t -= dt;
          if (e.life <= 0) { this.removeEnt(e); break; }
          if (e.t <= 0) { e.t = 0.35 + Math.random() * 0.2; const shot = Math.random() < 0.18; this.noise(e.x, e.y, e.team, shot ? 950 : 320); this.events.push({ e: 'snd', s: shot ? 'fakeShot' : 'fakeStep', x: r1(e.x + (Math.random() - 0.5) * 20), y: r1(e.y + (Math.random() - 0.5) * 20) }); }
          break;
        case 'healzone': case 'station': { // PATCH's kit (5 s) and TONIC's station (100 health in all)
          if (e.type === 'healzone') { e.life -= dt; if (e.life <= 0) { this.removeEnt(e); break; } }
          const r = e.type === 'healzone' ? e.r : 24, rate = e.type === 'healzone' ? 10 : 6;
          for (const q of this.players.values()) {
            if (!q.alive || q.downed || this.side(q) !== e.team || q.hp >= q.maxHp || Math.hypot(q.x - e.x, q.y - e.y) > r) continue;
            const h = Math.min(rate * dt, q.maxHp - q.hp, e.type === 'station' ? e.pool : 99); q.hp += h;
            if (e.type === 'station') { e.pool -= h; if (e.pool <= 0) { this.removeEnt(e); break; } }
          }
          break;
        }
        case 'catcher': // WARD: zaps attacker grenades and launcher rounds that come near
          for (const o of [...this.ents]) {
            if (o.team === e.team || Math.hypot(o.x - e.x, o.y - e.y) > 60) continue;
            if (!((o.type === 'nade' && o.kind !== 'smoke') || o.type === 'slug' || (o.type === 'sticky' && !o.stuck))) continue;
            this.removeEnt(o); this.events.push({ e: 'arc', x: r1(e.x), y: r1(e.y), x2: r1(o.x), y2: r1(o.y) }); this.events.push({ e: 'snd', s: 'break', x: r1(o.x), y: r1(o.y) });
            if (--e.c <= 0) { this.removeEnt(e); break; }
          }
          break;
        case 'cutter': case 'breach': case 'cluster': case 'spreader':
          { const g = this.gridNear(e.x, e.y, other(e.team)); // a static grid fries breaching gadgets on its wall
            if (g) { this.events.push({ e: 'arc', x: r1(g.x), y: r1(g.y), x2: r1(e.x), y2: r1(e.y) }); this.events.push({ e: 'snd', s: 'break', x: r1(e.x), y: r1(e.y) }); this.removeEnt(e); break; } }
          if (!this.jammedAt(e.x, e.y)) e.t -= dt;
          if (e.t <= 0) this.detonate(e);
          break;
        case 'dart':
          e.life -= dt; e.ping -= dt;
          if (e.ping <= 0 && !this.jammedAt(e.x, e.y)) {
            e.ping = 1.5;
            let any = false;
            for (const q of this.players.values()) if (q.alive && this.side(q) !== e.team && !this.ghost(q) && Math.hypot(q.x - e.x, q.y - e.y) < 170) { this.spot(e.team, q.id, 1.6); any = true; }
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
            const t = rayCircle(e.x, e.y, dx, dy, q.x, q.y, hitR(q.op));
            if (t !== null && t <= step && (hitT === null || t < hitT)) hitT = t;
          }
          const wallT = walkRay(e.x, e.y, dx, dy, step, (cx, cy) => blocksDrone(tileAt(this.map, cx, cy)) || tileAt(this.map, cx, cy) === T.BARRI);
          if (hitT !== null && hitT < wallT) { e.x += dx * hitT; e.y += dy * hitT; this.detonate(e); break; }
          if (wallT < step) { e.x += dx * (wallT + 5); e.y += dy * (wallT + 5); this.detonate(e); break; }
          e.x += e.vx * dt; e.y += e.vy * dt; e.travel += step;
          if (e.travel > 520) this.detonate(e);
          break;
        }
        case 'scope': {
          const g = this.gridNear(e.x, e.y, other(e.team));
          if (this.map.tiles[e.cell] !== T.SOFT || g) { if (g) this.events.push({ e: 'arc', x: r1(g.x), y: r1(g.y), x2: r1(e.x), y2: r1(e.y) }); this.events.push({ e: 'hit', k: 'spark', x: r1(e.x), y: r1(e.y) }); this.removeEnt(e); }
          break;
        }
        case 'decoy': { // runs straight on, turning away from walls
          e.life -= dt; if (e.life <= 0) { this.removeEnt(e); break; }
          const o = { x: e.x, y: e.y }, sp = BASE_SPEED * dt; // runs like a real attacker
          moveCircle(this.map, o, Math.cos(e.ang) * sp, Math.sin(e.ang) * sp, PLAYER_R);
          if (Math.hypot(o.x - e.x, o.y - e.y) < sp * 0.4) {
            const l = castSight(this.map, e.x, e.y, e.ang - Math.PI / 2, 300, null), r = castSight(this.map, e.x, e.y, e.ang + Math.PI / 2, 300, null);
            e.ang += l > r ? -Math.PI / 2 : Math.PI / 2;
          }
          e.x = o.x; e.y = o.y;
          break;
        }
        case 'prox': case 'concuss': case 'clamp': {
          if (e.arm > 0) { e.arm -= dt; break; }
          if (e.fuse !== undefined) { e.fuse -= dt; if (e.fuse <= 0) this.detonate(e); break; }
          const reach = { prox: 42, concuss: 30, clamp: 13 }[e.type];
          for (const q of this.players.values()) {
            if (!q.alive || this.side(q) === e.team || this.ghost(q)) continue;
            if (Math.hypot(q.x - e.x, q.y - e.y) > reach || !los(this.map, e.x, e.y, q.x, q.y)) continue;
            if (e.type === 'prox') { e.fuse = 0.9; this.events.push({ e: 'snd', s: 'beep', x: r1(e.x), y: r1(e.y) }); }
            else if (e.type === 'concuss') this.detonate(e);
            else { // clamp: held fast and badly hurt
              q.clampUntil = this.time + 2; this.spot(e.team, q.id, 3);
              this.damage(q, 20, this.players.get(e.owner), 'Clamp Trap', 0);
              this.events.push({ e: 'snd', s: 'clamp', x: r1(e.x), y: r1(e.y) }); this.removeEnt(e);
            }
            break;
          }
          break;
        }
        case 'sensor': {
          e.t -= dt; e.pingT -= dt; if (e.t > 0) break; e.t = 0.5;
          let any = false;
          for (const q of this.players.values())
            if (q.alive && this.side(q) !== e.team && !this.ghost(q) && !q.shrouded && q.moving === 2 && Math.hypot(q.x - e.x, q.y - e.y) < 190) { this.spot(e.team, q.id, 1.5); any = true; }
          if (any && e.pingT <= 0) { e.pingT = 1.5; this.events.push({ e: 'ping', x: r1(e.x), y: r1(e.y), team: e.team, any: true }); }
          break;
        }
        case 'plates':
          for (const q of this.players.values()) {
            if (!q.alive || q.plated || q.downed || this.side(q) !== e.team || Math.hypot(q.x - e.x, q.y - e.y) > 18) continue;
            q.plated = true; q.maxHp += 15; q.hp += 15; e.c--;
            this.events.push({ e: 'snd', s: 'place', x: r1(q.x), y: r1(q.y) });
            if (e.c <= 0) { this.removeEnt(e); break; }
          }
          break;
        case 'gascloud':
          e.life -= dt; e.tick = (e.tick || 0) - dt;
          if (e.tick <= 0) {
            e.tick = 0.5;
            for (const q of this.players.values()) if (q.alive && Math.hypot(q.x - e.x, q.y - e.y) < e.r) // toxin hurts everyone in it
              this.damage(q, 6, this.players.get(e.owner), 'Toxin Canister', 0);
          }
          if (e.life <= 0) this.removeEnt(e);
          break;
        case 'mine': case 'claymore': {
          if (e.arm > 0) { e.arm -= dt; break; }
          for (const q of this.players.values()) {
            if (!q.alive || this.side(q) === e.team) continue;
            const d = Math.hypot(q.x - e.x, q.y - e.y);
            if (this.ghost(q)) continue;
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
    const blocked = (x, y) => pointSolid(this.map, x, y, t => blocksDrone(t) || t === T.BARRI);
    let bounced = false;
    if (blocked(nx, e.y)) { e.vx = -e.vx * 0.45; bounced = true; } else e.x = nx;
    if (blocked(e.x, ny)) { e.vy = -e.vy * 0.45; bounced = true; } else e.y = ny;
    const f = Math.exp(-2.5 * dt); e.vx *= f; e.vy *= f;
    if (bounced && sp > 60) this.events.push({ e: 'snd', s: 'bounce', x: r1(e.x), y: r1(e.y) });
    if (e.kind === 'impact' && bounced) return this.detonate(e);
    if (e.kind === 'nitro' || e.kind === 'gas') return; // waits for its owner
    e.fuse -= dt;
    if (e.fuse <= 0) this.detonate(e);
  }

  detonate(e) {
    this.removeEnt(e);
    const kind = e.type === 'nade' ? e.kind : e.type;
    const SOFTISH = [T.SOFT, T.BARRI, T.HATCH, T.RUBBLE];
    switch (kind) {
      case 'frag': this.explode(e, { r: 75, dmg: 130, cellR: 14, cells: SOFTISH, kind: 'frag' }); break;
      case 'impact': this.explode(e, { r: 34, dmg: 40, cellR: 22, cells: SOFTISH, kind: 'impact' }); break;
      case 'nitro': this.explode(e, { r: 70, dmg: 140, cellR: 20, cells: SOFTISH, kind: 'nitro' }); break;
      case 'slug': this.explode(e, { r: 36, dmg: 75, cellR: 21, cells: SOFTISH, kind: 'slug', selfMul: 0.3 }); break;
      case 'breach': this.explode(e, { r: 40, dmg: 60, cellR: 21, cells: SOFTISH, kind: 'breach', at: e.cell }); break;
      case 'claymore': this.explode(e, { r: 50, dmg: 95, cellR: 0, cells: [], kind: 'frag', cone: e.ang }); break;
      case 'mine': {
        this.explode(e, { r: 32, dmg: 40, cellR: 0, cells: [], kind: 'mine' });
        for (const q of this.players.values()) if (q.alive && this.side(q) !== e.team && Math.hypot(q.x - e.x, q.y - e.y) < 40) {
          q.slowUntil = this.time + 3; this.spot(e.team, q.id, 4);
        }
        break;
      }
      case 'cutter': this.explode(e, { r: 30, dmg: 40, cellR: 40, cells: [T.SOFT, T.REINF, T.BARRI, T.PANEL, T.DSHIELD, T.HATCH, T.HATCHR, T.RUBBLE], kind: 'cutter', at: e.cell }); break;
      case 'sonar': {
        let any = false;
        for (const q of this.players.values()) if (q.alive && this.side(q) !== e.team && !this.ghost(q) && Math.hypot(q.x - e.x, q.y - e.y) < 230) { this.spot(e.team, q.id, 2.5); any = true; }
        this.events.push({ e: 'ping', x: r1(e.x), y: r1(e.y), team: e.team, any, big: 1 });
        break;
      }
      case 'gas': this.ents.push({ id: this.eid(), type: 'gascloud', x: e.x, y: e.y, r: 58, life: 8, team: e.team, owner: e.owner }); this.events.push({ e: 'snd', s: 'smoke', x: r1(e.x), y: r1(e.y) }); break;
      case 'cam': this.ents.push({ id: this.eid(), type: 'cam', x: e.x, y: e.y, team: e.team, owner: e.owner, hp: 1, offUntil: 0, ang: Math.atan2(e.vy || 0, e.vx || 1) }); this.events.push({ e: 'snd', s: 'place', x: r1(e.x), y: r1(e.y) }); break;
      case 'prox': this.explode(e, { r: 48, dmg: 90, cellR: 0, cells: [], kind: 'frag' }); break;
      case 'concuss': {
        this.explode(e, { r: 30, dmg: 15, cellR: 0, cells: [], kind: 'impact' });
        for (const q of this.players.values()) if (q.alive && this.side(q) !== e.team && Math.hypot(q.x - e.x, q.y - e.y) < 50) {
          q.slowUntil = this.time + 4; q.dazeUntil = this.time + 4; this.events.push({ e: 'daze', id: q.id, dur: 4 });
        }
        break;
      }
      case 'cluster': { // four bomblets scatter into the room behind the wall
        const cx = (e.cell % this.map.W + 0.5) * CELL, cy = (Math.floor(e.cell / this.map.W) + 0.5) * CELL;
        for (let i = 0; i < 4; i++) {
          const d = 22 + i * 13 + Math.random() * 8, side = (Math.random() - 0.5) * 50;
          const x = cx + e.dx * d + (e.dy ? side : 0), y = cy + e.dy * d + (e.dx ? side : 0);
          this.explode({ x, y, team: e.team, owner: e.owner }, { r: 30, dmg: 35, cellR: 0, cells: [], kind: 'impact' });
        }
        break;
      }
      case 'smoke': this.ents.push({ id: this.eid(), type: 'smoke', x: e.x, y: e.y, r: 62, life: 12, team: e.team }); this.events.push({ e: 'snd', s: 'smoke', x: r1(e.x), y: r1(e.y) }); break;
      case 'flare': { // BLAZE: blinds the defenders who are looking at it
        this.events.push({ e: 'boom', x: r1(e.x), y: r1(e.y), r: 30, kind: 'stun' });
        for (const q of this.players.values()) {
          if (!q.alive || this.side(q) === e.team) continue;
          const d = Math.hypot(q.x - e.x, q.y - e.y);
          if (d < 230 && Math.abs(angDiff(Math.atan2(e.y - q.y, e.x - q.x), q.aim)) < 1.1 && los(this.map, e.x, e.y, q.x, q.y)) {
            const dur = 2.2 * (1 - d / 330);
            q.stunUntil = Math.max(q.stunUntil, this.time + dur);
            this.events.push({ e: 'stun', id: q.id, dur: r2(dur) });
          }
        }
        break;
      }
      case 'medkit': this.ents.push({ id: this.eid(), type: 'healzone', x: e.x, y: e.y, r: 40, life: 5, team: e.team, owner: e.owner }); this.events.push({ e: 'snd', s: 'place', x: r1(e.x), y: r1(e.y) }); break;
      case 'echobox': this.ents.push({ id: this.eid(), type: 'echobox', x: e.x, y: e.y, life: 8, t: 0, team: e.team, owner: e.owner, hp: 1 }); break;
      case 'sticky': { // through the wall it stuck to: a blast this side, and one in the room behind
        this.explode(e, { r: 38, dmg: 70, cellR: 21, cells: [T.SOFT, T.BARRI, T.HATCH, T.RUBBLE], kind: 'slug', selfMul: 0.3 });
        if (e.bx !== undefined) this.explode({ x: e.bx, y: e.by, team: e.team, owner: e.owner }, { r: 36, dmg: 55, cellR: 0, cells: [], kind: 'impact' });
        break;
      }
      case 'spreader': { // two blocks of the wall forced apart, reinforced or not
        const m = this.map, x = e.cell % m.W, y = Math.floor(e.cell / m.W);
        for (const d of [0, 1]) { const k = (y + e.ay * d) * m.W + x + e.ax * d; if (m.tiles[k] === T.SOFT || m.tiles[k] === T.REINF) this.destroyCell(k); }
        this.events.push({ e: 'hit', k: 'wall', x: r1(e.x), y: r1(e.y) }); this.events.push({ e: 'snd', s: 'reinforce', x: r1(e.x), y: r1(e.y) }); this.noise(e.x, e.y, e.team, 700);
        break;
      }
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
          else if (['jammer', 'mine', 'nade', 'claymore', 'prox', 'concuss', 'clamp', 'sensor', 'grid', 'gascloud'].includes(o.type)) this.removeEnt(o);
        }
        break;
      }
    }
  }

  explode(e, o) {
    const owner = this.players.get(e.owner);
    this.noise(e.x, e.y, e.team, 1100);
    let cx = e.x, cy = e.y;
    if (o.at !== undefined) { cx = (o.at % this.map.W + 0.5) * CELL; cy = (Math.floor(o.at / this.map.W) + 0.5) * CELL; }
    this.events.push({ e: 'boom', x: r1(e.x), y: r1(e.y), r: o.r, kind: o.kind });
    for (const g of [...this.ents]) if (g !== e && g.team !== e.team && (g.hp || g.type === 'wire') && Math.hypot(g.x - e.x, g.y - e.y) < o.r * 0.8) this.hitEnt(g, owner);
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
      const self = owner && q === owner; // friendly fire: every blast hurts everyone in range, owner included
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
      else if (['drone', 'jammer', 'mine', 'wire', 'claymore', 'dart', 'cutter', 'breach'].includes(g.type)) { this.removeEnt(g); if (g.type === 'drone') this.droneLost(g); }
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
        this.pts(v.type === 'drone' ? this.players.get(v.owner) : v, 50, 'OBJECTIVE FOUND');
        this.events.push({ e: 'found', team: TEAM.ATK }); // the attackers' big "objective found" alert with a floor picture (main.js siteFound)
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
      const ok = [[0, 0], [8, 0], [-8, 0], [0, 8], [0, -8]].every(([dx, dy]) => !pointSolid(this.map, px + dx, py + dy, drone ? blocksDrone : blocksMove));
      if (ok) return { x: px, y: py };
    }
    return { x, y };
  }

  msg(text, team) { this.events.push({ e: 'msg', text, team }); }

  // ---------------- chat ----------------
  // Team chat goes only to your own team; all chat goes to everyone. A little rate limit stops spam.
  chat(p, m) {
    const text = String(m.text || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 140);
    if (!text) return;
    const now = this.time; p.chatTimes = (p.chatTimes || []).filter(t => now - t < 5);
    if (p.chatTimes.length >= 5) return;
    p.chatTimes.push(now);
    const team = !!m.team;
    const msg = JSON.stringify({ t: 'chat', from: p.id, name: p.name, text, team, squad: p.squad, dead: !p.alive && this.phase === PHASE.ACTION });
    for (const q of this.players.values()) if (q.sock && q.sock.open && (!team || q.squad === p.squad)) q.sock.send(msg);
  }

  // ---------------- saved stats ----------------
  // Points (he asked, R6-style): a popup for you and a SCORE on the scoreboard; the MVP is the top score.
  pts(p, n, why) {
    if (!p || !n || this.tut || this.free) return;
    p.score = (p.score || 0) + n; if (p.ms) p.ms.score = (p.ms.score || 0) + n;
    if (p.sock) this.events.push({ e: 'pts', to: p.id, n, w: why });
  }
  blankMatchStats() { return { score: 0, rounds: 0, roundsWon: 0, kills: 0, deaths: 0, downs: 0, revives: 0, plants: 0, defuses: 0, shots: 0, hits: 0, damage: 0, playSeconds: 0, ops: {} }; }
  opStat(p) { if (!p.ms) p.ms = this.blankMatchStats(); return p.ms.ops[p.op] || (p.ms.ops[p.op] = { rounds: 0, roundsWon: 0, kills: 0, deaths: 0 }); }
  botLoadout(op) {
    const L = LOADOUTS[op], pick = a => a.length ? a[Math.floor(Math.random() * a.length)] : null;
    const l = { primary: pick(L.primaries), secondary: pick(L.secondaries), gadget: pick(L.gadgets), att: {} };
    for (const w of [l.primary, l.secondary]) if (w) { const o = attachFor(w); l.att[w] = { barrel: pick(o.barrel), grip: pick(o.grip), sight: pick(o.sight) }; }
    return cleanLoadout(op, l);
  }
  statLine(p, left = false) {
    const ms = p.ms || this.blankMatchStats();
    return { name: p.name, bot: !!p.bot, pid: p.pid || null, token: p.token || null, squad: p.squad, left, ...ms, damage: Math.round(ms.damage), playSeconds: Math.round(ms.playSeconds) };
  }
  saveMatch(winner) {
    if (this.tut || this.free) return null; // tutorials and free play never count
    const players = [...[...this.players.values()].map(p => this.statLine(p)), ...(this.departed || [])];
    if (!players.some(p => p.token)) return null; // nobody real played
    return store.recordMatch({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), date: Date.now(),
      duration: Math.round((Date.now() - (this.matchStart || Date.now())) / 1000),
      map: this.map.name, mode: 'Quick Match', score: [...this.score], winner, rounds: this.roundLog || [], players,
    });
  }

  // ---------------- snapshot ----------------
  broadcast() {
    const cells = [];
    for (const k of this.changed) cells.push(k, this.map.tiles[k], Math.max(0, Math.round(this.map.hp[k])));
    this.changed.clear(); const holes = this.newHoles; this.newHoles = [];
    const mine = new Map(); // details only the player themself needs (ammo, gadget counts, recoil...) go to them alone
    const players = [...this.players.values()].map(p => {
      const g = p.guns[p.slot];
      const o = {
        id: p.id, n: p.name, b: p.bot ? 1 : 0, sq: p.squad, tm: this.round ? this.side(p) : (p.squad === 0 ? 'atk' : 'def'),
        op: p.op, a: p.alive ? 1 : 0, k: p.kills, d: p.deaths, sc: p.score || 0, ms: p.rtt,
      };
      if (p.alive) Object.assign(o, {
        dn: p.downed ? 1 : 0, hp: Math.ceil(p.hp), mhp: p.maxHp, x: r1(p.x), y: r1(p.y), ag: r2(p.aim), sg: p.staged ? 1 : undefined,
        rp: p.rope ? (p.rope.st === 'hang' ? 1 : 2) : undefined, sl: p.slot, w: g ? g.w : null, rl: p.reloadT > 0 ? r2(1 - p.reloadT / WEAPONS[g.w].reload) : 0,
        ct: p.ctrl,
        bu: p.busy ? { k: p.busy.k, p: r2(p.busy.t / p.busy.dur) } : null, df: p.hasDefuser ? 1 : 0,
        gt: r2(p.gait || 0), mv: p.moving, so: p.bracing && (this.time < (p.shieldOpenUntil || 0) || this.time < (p.shieldDownUntil || 0)) ? (this.time < (p.shieldDownUntil || 0) ? 2 : 1) : undefined, ad: p.input.ads ? 1 : 0, cr: p.input.crouch ? 1 : 0, wk: p.input.walk ? 1 : 0,br: p.bracing ? 1 : 0, sb: p.shieldMode === 'gun' ? 1 : 0, sw: p.switchUntil > this.time ? 1 : 0, sc: p.scanning ? 1 : 0,
        aa: g && g.att ? attCode(g.att) : '',
        si: this.ghost(p) || p.shrouded ? 1 : 0, sh: p.shrouded ? 1 : 0, ln: p.lancing ? 1 : 0, bo: this.time < (p.boostUntil || 0) ? 1 : 0,
        dz: this.time < (p.dazeUntil || 0) ? 1 : 0,
      });
      if (p.staged) { o.x = undefined; o.y = undefined; } // nobody else learns where a waiting attacker is
      if (this.phase === PHASE.SELECT || this.phase === PHASE.PREP) { o.lk = p.locked ? 1 : 0; o.jb = p.job || undefined; if (this.side(p) === TEAM.ATK) o.spn = this.map.atkSpawns.indexOf(this.spawnOf(p)); }
      if (p.alive && p.sock) mine.set(p.id, JSON.stringify({
        am: g ? g.ammo : 0, rs: g ? g.reserve : 0, ac: p.abilityCount, gc: p.gadgetCount, bx: p.barri, pr: r1(Math.max(0, (p.pingReady || 0) - this.time)), gd: p.gadget, dr: p.drones, fi: p.ctrl === 'cam' ? p.feedId : null, did: p.droneId,
        vx: r1(p.vx || 0), vy: r1(p.vy || 0), rc: Math.round((p.rc || 0) * 10000) / 10000, sh: p.shots || 0, at: r2(p.adsT || 0),
        bat: r1(p.battery), ro: p.rope ? [p.rope.st === 'hang' ? 1 : 0, p.rope.r, p.rope.to, r2(p.rope.t / p.rope.dur)] : undefined, ds: p.sprints, dsl: r2(Math.max(0, (p.sprintUntil || 0) - this.time)), dsc: r2(Math.max(0, (p.sprintCd || 0) - this.time)), st: r2(Math.max(0, p.stunUntil - this.time)), ls: p.lastSeq, ni: p.nitroId ? 1 : 0,
        ...(p.staged ? { x: r1(this.spawnOf(p).x), y: r1(this.spawnOf(p).y) } : {}),
        m: this.mods(p), vt: p.vault ? [r1(p.vault.x0), r1(p.vault.y0), r1(p.vault.x1), r1(p.vault.y1), r2(p.vault.t), r2(p.vault.dur)] : undefined, fs: r2(this.time - p.lastShot), gi: p.gasId ? 1 : 0,
      }));
      return o;
    });
    const ents = this.ents.map(e => {
      const o = { id: e.id, ty: e.type, x: r1(e.x), y: r1(e.y), tm: e.team };
      if (e.owner) o.ow = e.owner;
      if (e.kind) o.kd = e.kind;
      if (e.ang !== undefined) o.ag = r2(e.ang);
      if (e.type === 'cam') { o.hp = e.hp; o.off = e.offUntil > this.time ? 1 : 0; if (e.tu) { o.tu = 1; if (e.coolUntil > this.time) o.hot = 1; } if (e.wn !== null && e.wn !== undefined) { o.wn = r2(e.wn); o.ws = r2(e.ws); } }
      if (e.type === 'decoy') { o.op = e.op; o.w = e.w; }
      if (e.type === 'plates') o.c = e.c;
      if (e.type === 'gascloud') { o.r = e.r; o.l = r1(e.life); }
      if (e.type === 'cluster') o.t = r1(e.t);
      if (e.type === 'smoke') { o.r = e.r; o.l = r1(e.life); }
      if (e.type === 'cutter' || e.type === 'breach') { o.t = r1(e.t); o.j = this.jammedAt(e.x, e.y) ? 1 : 0; }
      if (e.type === 'drone') { o.j = this.jammedAt(e.x, e.y) ? 1 : 0; o.vx = r1(e.vx || 0); o.vy = r1(e.vy || 0); }
      return o;
    });
    const spots = { atk: [...this.spots.atk.keys()], def: [...this.spots.def.keys()] };
    const common = JSON.stringify({
      ph: this.phase, tm: r1(Math.max(0, this.timer)), rd: this.round, sc: this.score, mv: this.mapVersion, mp: this.mapId,
      site: this.site, rev: this.siteRevealed ? 1 : 0, pl: this.planted ? { x: r1(this.planted.x), y: r1(this.planted.y), b: this.planted.bomb, t: r1(this.planted.t) } : null,
      rf: this.reinforce, win: this.winner, tu: this.tut ? { ...this.tut.info, ls: this.tut.lesson, hold: this.tut.hold ? 1 : 0 } : undefined, why: this.reason, spawn: this.spawnName, fp: this.free ? 1 : undefined, bl: this.botLevel,
      players, ents, cells, holes, ev: this.events, spots, time: r2(this.time),
    });
    this.events = [];
    for (const p of this.players.values()) if (p.sock && p.sock.open) p.sock.send('{"t":"snap","you":"' + p.id + '",' + (mine.has(p.id) ? '"mine":' + mine.get(p.id) + ',' : '') + common.slice(1));
  }
}
