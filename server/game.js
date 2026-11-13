// The authoritative match: lobby, rounds, movement, shooting, gadgets, objective.
import { CELL, PHASE, DUR, BARRICADES_EACH, T, FL, TEAM, CELL_HP, HOLE_ONLY, HOLE_MAX, WIN_ROUNDS, MAX_PLAYERS, TEAM_SIZE, PLAYER_R, BOT_LEVELS, PRO_LEVEL, DEFAULT_LEVEL, MAT, stopsBullet, underAt, penBullet, blocksDrone, blocksMove, blocksSight, other, DRONE_SPRINT, PX_PER_M, SWARM } from '../shared/constants.js';
import { floorSpot, addHatch, cellBelow, cellAbove, peepOk, addPeep, hatchOpen } from '../shared/map.js';
import { localPos, buildMap, roomAt, wallMount, MAPS, MAP_LIST, openHatch, hatchNear, hatchAtPoint, stairGhost, stairLooks, floorAt, ropeAt, roofRopeAt, ropeWindowOpen, ropeWindowBoarded, ropeGround, ropeS, ropeAtWindow, ROPE_CLIMB, ROPE_DROP, wallGhost, peekSeen, floorOff, windowViews, windowFoot, WIN_RANGE, OUTCAM_TURN, hatchSight, aimUpHatch } from '../shared/map.js';
import { findVault, M_S, leanPoint, throughHole, coverOf, rayCovers } from '../shared/physics.js';
import { SLIDE, stepMove, moveCircle, walkRay, rayCircle, los, tileAt, angDiff, castSight, canSee, takeStairs, facingCell, BASE_SPEED, shapeAt, rayShape, pointSolid, circleBlocked } from '../shared/physics.js';
import { OPERATORS, WEAPONS, GADGETS, ARMOR_HP, opsForTeam, JOBS, jobOf, shieldPose, RIOT, riotArc, SELF_UP, SELF_UP_TIME, moveOf, HEAD_AIM, SIDEARMS } from '../shared/operators.js';
import { arenaThink, defSetup, botThink, botPickOp, botPrep, assignPros, proSay, talk, kindWords, botHear, botPing, roundChat, tvTalk, tvBanPick, proLoadout, siteVote } from './bots.js';
import { store, cleanName, publicProfile } from './store.js';
import { arenaStart, arenaTick, arenaKill, arenaDamage, arenaSpeed, arenaEndMatch, arenaPlayer, arenaInfo } from './arena.js';
import { zbSurge, zbDev, ZB, zbDown, zbUp, zbReviveTime, zbSlideEnd, zbStart, zbTick, zombieThink, zbSpeed, zbDamage, zbKill, zbCanGoDown, zbReloadMul, zbBlocksVault, zbUse, zbEnd, zbPlayer, zbInfo } from './zombies.js';
import { MODES, CLASSIC, DEFAULT_MODE, attackSquad, roundsToWin, inOvertime } from '../shared/modes.js';
import { matchScore, START_MMR, rankOf, mmrOfRank } from '../shared/progress.js';
import { LOADOUTS, GADGET_COUNT, cleanLoadout, FALLOFF, HEAD_R, onHead, hitR, cleanAtt, gunMods, attachFor, attCode, aimHeat, spreadCone, shotOffset, tracerPellet, recoilStep, recoilMax, adsTime, falloffOf, penOf, fireAuto, fireDmg, fireRpm, bipodOn, reloadLen } from '../shared/operators.js';
const PING_KINDS = new Set(['go', 'omw', 'watch', 'hold', 'danger', 'help', 'enemy', 'open']); // the ping wheel (public/js/pingwheel.js)
const VIEW_LAG_MAX = 0.35; // how far back (s) the server will rewind to honour what a shooter saw
const BARRI_BULLET_HP = 320; // bullet damage that breaks a whole wooden barricade (he asked)

const rnd = (a, b) => a + Math.random() * (b - a);
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
const DART_MAX = 8 * PX_PER_M, DART_SPEED = 700; // KESTREL's thrown dart
const r1 = v => Math.round(v * 10) / 10;
const r2 = v => Math.round(v * 100) / 100;
// everyday bots: their own names, never a pro's (he asked) or a gun's
const BOT_NAMES = ['Dusty', 'Pickles', 'Gerald', 'Noodle', 'Biscuit', 'Lenny', 'Toast', 'Wobbles', 'Mittens', 'Chonk', 'Sprout', 'Tumbleweed'];
const HTRAP_R = 2.5 * PX_PER_M;
// HOIST's climbs were 1.6 / 3 s until Ball Knowledge 2026-11-10 (39% of rounds won)
const DRILL_T = 3, GRAPPLE_T = 1.2, GRAPPLE_ROOF = 2.2, GRAPPLE_REACH = 2.2 * PX_PER_M, DROP_T = 2; // GIMLET's drill, HOIST's climbs, DEADFALL's fuse (s)
const SPRINT_RAISE = 0.3, SPRINT_LOUD = 520; // seconds to get the gun back up after a sprint; how far sprinting steps carry (a jog is 320)
const EMPTY_INPUT = { up: 0, down: 0, left: 0, right: 0, walk: 0, sprint: 0, sa: 0, crouch: 0, prone: 0, fire: 0, ads: 0, interact: 0, ability: 0, lean: 0, la: 0, jump: 0, rw: 0, rv: 0, inv: 0 }; // rw / rv / inv: the 3D rope view's along-the-wall, up/down and upside-down keys
const JAM_R = 90;
const VAULT_TIME = 0.6, VAULT_RECOVER = 0.35; // climbing over (no shooting, gun down), then a moment before you can aim again
const FREE_OPS = [...opsForTeam(TEAM.ATK), ...opsForTeam(TEAM.DEF)]; // free play's switching order

// R62D_FAST=1 shortens the menus, for quick testing.
if (typeof process !== 'undefined' && process.env.R62D_FAST) { DUR.select = 3; DUR.prep = 6; }

const THROW_K = 5; // drag on thrown things: they come to rest where you aimed
const EMP_R = 36; // buffed (he asked: it was no better than ordinary utility): ~1 m, and it fries defenders' electronics too
const LANCE_STEP = 0.5; // RIVET: seconds per burnt-through point (the first is a bullet-sized hole)
const HAMMER_CD = 2; // was 4, then 2.5 (he asked: Ferro stronger; 2026-11-10 attackers' skills stronger as a whole)
const WINDUP_T = 0.5, SETUP_T = 1.2;
const EF_FIELD = { blind: 'stunUntil', stun: 'stunUntil', slow: 'slowUntil', snare: 'clampUntil', daze: 'dazeUntil', deaf: 'deafUntil' };
const THROWN_G = new Set(['smoke', 'frag', 'stun', 'impact', 'nitro']), PLACED_G = new Set(['breach', 'claymore', 'wire', 'dshield']);
const THROWN_AB = new Set(['emp', 'sonar', 'stickycam', 'gas', 'flare', 'medkit', 'echobox']);
const PLACED_AB = new Set(['prox', 'concuss', 'clamp', 'sensor', 'plates', 'turret', 'spike', 'alarm', 'pace', 'radar', 'station', 'catcher', 'jammer', 'mine', 'grid', 'cover', 'cutter', 'periscope', 'scope']);
const LUNGE_M = 5; // CROW: how far the marked lunge reaches (m; was 4, Ball Knowledge 2026-11-10: 40% of rounds won)
const LUNGE_WIND = 1; // CROW: seconds from drawing the blade to the lunge being ready (was 1.5)
const PIERCE_DMG = 0.55; // NAIL: damage a piercing round keeps through the wall (was 0.4)
const SHIELD_ASIDE = 0.45; // BULWARK: seconds to swing the shield out of the way when aiming in // FERRO: seconds between hammer swings // TALON's EMP: a circle about a door wide (he asked), centred inside the wall it stuck to
const MAX_BANS = 8; // he asked: at most 8 banned operators in a match
const BAN_GAP = 2.6;
const BAN_TURN = 15; // Unranked / Ranked: seconds a team with people on it gets for each ban // seconds between Esports TV bans, long enough to read each one

const SCAN_BEAT = 0.8, SCAN_BLUR = 1.5 * PX_PER_M; // WRAITH's scanner: a new blip per heartbeat, this far off the real spot at most
// aimed in through the sniper scope (the Pike's and Saker's one-shot body kill needs it, he asked)
const REINF_HALF = 1;
const REINF_EACH = +process.env.R62D_REINF || 10; // wall reinforcements a defending team gets each round (7 was tried 2026-11-10 and made no measurable difference; he chose 10 again)
const scopedIn = p => { const g = p && p.guns && p.guns[p.slot]; return !!(g && g.att && g.att.sight === 'sniper' && (p.adsT || 0) >= 0.6); };
export class Game {
  // opts.tut: a private tutorial match for one player (see tutAction), with its timers held
  // while the coach explains each step, and nothing saved to their profile.
  constructor(opts = {}) {
    this.tut = opts.tut ? { lesson: null, hold: true, info: this.blankTutInfo() } : null;
    // opts.free: a private free-play match for one player: no clock, no rounds, switch operator any time (see freeAction)
    this.free = opts.free ? { bots: 0 } : null;
    // opts.tv: ESPORTS TV (he asked): the two pro teams play each other, match after match, while the people connected only watch
    this.tv = opts.tv ? { socks: new Set(), follow: null, maps: [] } : null;
    this.onEmpty = null;
    this.players = new Map();
    this.nextId = 1;
    this.ents = [];
    this.events = [];
    this.changed = new Set();
    this.newHoles = []; // bullet holes made since the last snapshot: cell, x, y
    // which side made each map change since the last snapshot (he asked: what your team changes shows on your map at once,
    // even out of your sight): `this.by` is the side acting right now (set round handle/tickPlayer/explode/hitscan below)
    this.by = null; this.chBy = new Map(); this.holeBy = new Map();
    const ch = this.changed, add = ch.add.bind(ch); ch.add = k => { if (this.by) this.chBy.set(k, this.by); return add(k); };
    this.phase = PHASE.LOBBY;
    this.timer = 0; this.round = 0; this.score = [0, 0]; this.time = 0;
    this.mapId = 'harbor';
    this.map = buildMap(this.mapId);
    this.randomMap = false; // RANDOM in the lobby (he asked): a surprise map rolled when the match starts
    this.mapVersion = 0;
    this.site = 0; this.siteRevealed = false; this.planted = null;
    this.mode = DEFAULT_MODE; // the lobby's game mode (shared/modes.js; tutorial, free play and TV play CLASSIC rules)
    this.spots = { atk: new Map(), def: new Map() };
    this.reinforce = REINF_EACH;
    this.botLevel = DEFAULT_LEVEL; // bot skill = a rank (BOT_LEVELS), PRO_LEVEL = the pro teams
    this.winner = null; this.reason = '';
    this.revealCheck = 0;
    this.departed = []; this.roundLog = []; this.matchStart = 0;
  }

  // ---------------- connections ----------------
  connect(sock) {
    if (this.tv) return this.tvConnect(sock);
    let p = null;
    sock.on('message', raw => {
      let m; try { m = JSON.parse(raw); } catch { return; }
      if (m.t === 'join' && !p) {
        if (this.humanCount() >= MAX_PLAYERS) { sock.send(JSON.stringify({ t: 'full' })); return; }
        const login = store.login(cleanName(m.name));
        if (!this.tut && !this.free && [...this.players.values()].some(q => !q.bot && q.pid === login.profile.id)) { sock.send(JSON.stringify({ t: 'taken', name: login.profile.name })); return; }
        p = this.addPlayer(login.profile.name, false);
        p.sock = sock;
        p.token = login.token; p.pid = login.profile.id; p.mmr = login.profile.mmr ?? START_MMR;
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

  // ESPORTS TV: a viewer is not a player. They get the map, then ask for a match (a map or random); the snapshots go to
  // them too, with the details of the player they are following ('mine'), and both teams' chat (the leaders' calls).
  tvConnect(sock) {
    let joined = false;
    sock.on('message', raw => {
      let m; try { m = JSON.parse(raw); } catch { return; }
      if (m.t === 'join' && !joined) {
        joined = true; this.tv.socks.add(sock);
        const login = store.login(cleanName(m.name));
        sock.send(JSON.stringify({ t: 'welcome', id: null, tv: 1, mapVersion: this.mapVersion, mapId: this.mapId, token: login.token, profile: publicProfile(login.profile),
          tiles: Array.from(this.map.tiles), hp: Array.from(this.map.hp), holes: this.map.holes }));
      } else if (m.t === 'tv' && joined) {
        if (m.a === 'start' && this.phase === PHASE.LOBBY) {
          // viewer requests (he asked): up to 3 operators, one per role on each side, that the bots must play
          const seen = new Set(); this.tv.req = (Array.isArray(m.req) ? m.req : []).filter(o => OPERATORS[o] && !seen.has(OPERATORS[o].team + jobOf(o)) && seen.add(OPERATORS[o].team + jobOf(o))).slice(0, 3);
          this.tvStart(m.map, m.level);
        }
        else if (m.a === 'follow') this.tv.follow = this.players.has(m.id) ? m.id : null;
      }
    });
    sock.on('close', () => { this.tv.socks.delete(sock); if (!this.tv.socks.size && this.onEmpty) this.onEmpty(); });
  }
  tvStart(want, level) { // level: PRO_LEVEL = the pro league; a rank 0-6 = AMATEUR HOUR at that rank (he asked)
    if (BOT_LEVELS[level] !== undefined) this.tv.level = level;
    const list = MAP_LIST.filter(k => k !== this.mapId);
    const id = MAPS[want] ? want : list[Math.floor(Math.random() * list.length)];
    this.tv.want = want;
    if (id !== this.mapId) { this.mapId = id; this.map = buildMap(id); }
    for (const q of [...this.players.values()]) this.players.delete(q.id);
    this.botLevel = this.tv.level ?? PRO_LEVEL;
    for (let i = 0; i < 10; i++) this.addBot(i % 2);
    this.startMatch();
  }

  humanCount() { let n = 0; for (const p of this.players.values()) if (!p.bot) n++; return n; }

  addPlayer(name, bot) {
    if ([...this.players.values()].filter(q => !q.zombie).length >= MAX_PLAYERS) {
      const b = [...this.players.values()].find(q => q.bot && !q.zombie); // a human bumps a bot
      if (b && !bot) this.players.delete(b.id); else if (bot) return null;
    }
    const counts = [0, 0];
    for (const q of this.players.values()) if (!q.zombie && counts[q.squad] !== undefined) counts[q.squad]++;
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

  get rules() { return this.tut || this.free || this.tv ? CLASSIC : MODES[this.mode] || MODES[DEFAULT_MODE]; }
  get ranked() { return !!this.rules.ranked; }
  set ranked(v) { this.mode = v ? 'ranked' : DEFAULT_MODE; }
  atkSquad(r = this.round) { return attackSquad(this.rules, r); }
  side(p) { if (this.zb) return p.zombie ? TEAM.DEF : TEAM.ATK; if (this.arena) return this.arena.ffa ? 'f' + p.squad : p.squad === 0 ? TEAM.ATK : TEAM.DEF; return p.squad === this.atkSquad() ? TEAM.ATK : TEAM.DEF; } // fun modes: everyone for themselves = a side each (survivors attack, the infected defend)

  resetToLobby() {
    if (this.arena) arenaEndMatch(this);
    if (this.zb) zbEnd(this);
    this.phase = PHASE.LOBBY; this.timer = 0; this.round = 0; this.score = [0, 0];
    this.ents = []; this.planted = null;
    for (const p of this.players.values()) { p.alive = false; p.op = null; }
  }

  // ---------------- messages from players ----------------
  handle(p, m) {
    if (m.t === 'input') {
      p.input = { ...EMPTY_INPUT, ...m.k };
      if (typeof m.a === 'number' && isFinite(m.a)) p.aim = m.a;
      if ((p.slT > 0 || p.slR > 0) && p.ctrl === 'body') p.aim = p.slA + Math.max(-SLIDE.lock, Math.min(SLIDE.lock, angDiff(p.aim, p.slA))); // power slide: you can only aim forward until you are back up
      p.input.sa = p.aim; // sprinting goes by the aim the server knows
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
    } else if (m.t === 'ban') { this.playerBan(p, m.op); }
    else if (m.t === 'zbdev' && process.env.R62D_FAST) zbDev(this, p, m);
    else if (m.t === 'tut') { if (this.tut) this.tutAction(p, m); }
    else if (m.t === 'free') { if (this.free) this.freeAction(p, m); }
    else if (m.t === 'lobby' && !this.tut && !this.free) {
      if (m.a === 'addBot') this.addBot(m.squad);
      else if (m.a === 'removeBot') this.removeBot(m.squad);
      else if (m.a === 'fillBots') { for (const s of [0, 1]) while (this.squadCount(s) < TEAM_SIZE && this.players.size < MAX_PLAYERS) this.addBot(s); }
      else if (m.a === 'switch') this.switchSquad(p);
      else if (m.a === 'mode' && this.phase === PHASE.LOBBY && MODES[m.id] && MODES[m.id].ready && m.id !== this.mode) { this.mode = m.id; if (this.ranked) this.rankedLevel(); this.msg(`${p.name} chose ${MODES[m.id].name}${this.ranked ? `: bots play at the lobby's rank (${BOT_LEVELS[this.botLevel]})` : ''}`); }
      else if (m.a === 'ranked' && this.phase === PHASE.LOBBY) { this.ranked = !!m.on; if (this.ranked) this.rankedLevel(); this.msg(this.ranked ? `${p.name} switched on RANKED: bots play at the lobby's rank (${BOT_LEVELS[this.botLevel]})` : `${p.name} switched ranked off`); }
      else if (m.a === 'botLevel' && !this.ranked && BOT_LEVELS[m.lv] && m.lv !== this.botLevel) { this.botLevel = m.lv; assignPros(this); this.msg(m.lv === PRO_LEVEL ? `${p.name} brought in the pro teams: Northwind and Ironclad Collective` : `${p.name} set the bot skill to ${BOT_LEVELS[m.lv]}`); }
      else if (m.a === 'map' && this.phase === PHASE.LOBBY && m.id === 'random') {
        if (!this.randomMap) this.msg(`${p.name} chose a random map: it stays a surprise until the match starts`);
        this.randomMap = true;
      }
      else if (m.a === 'map' && this.phase === PHASE.LOBBY && MAPS[m.id] && m.id === this.mapId) {
        if (this.randomMap) this.msg(`${p.name} chose the map ${MAPS[m.id].name}`);
        this.randomMap = false;
      }
      else if (m.a === 'map' && this.phase === PHASE.LOBBY && MAPS[m.id]) {
        this.randomMap = false;
        this.mapId = m.id; this.map = buildMap(this.mapId); this.mapVersion++; this.changed.clear(); this.newHoles = [];
        this.msg(`${p.name} chose the map ${MAPS[m.id].name}`);
      }
      else if (m.a === 'start' && this.phase === PHASE.LOBBY) this.startMatch();
      else if (m.a === 'end' && this.phase !== PHASE.LOBBY) { this.msg(`${p.name} ended the match`); this.resetToLobby(); }
    } else if (m.t === 'pick') this.pickOp(p, m.op);
    else if (m.t === 'spawn') { // attackers choose where they start (operator select or preparation)
      const sp = this.map && this.map.atkSpawns[m.n], ok = this.side(p) === TEAM.ATK && (this.phase === PHASE.SELECT || this.phase === PHASE.PREP);
      if (ok && m.n === -1) p.spawn = null; // RANDOM: the team's spawn plan places them (the default)
      else if (ok && sp && Number.isInteger(m.n)) p.spawn = sp.name;
    }
    else if (m.t === 'role') { // choosing a role limits you to its operators
      const team = this.side(p), job = JOBS[team] && JOBS[team].find(j => j.id === m.r);
      if (job && this.phase === PHASE.SELECT && !p.locked) { p.job = job.id; if (p.op && !job.ops.includes(p.op)) p.op = null; }
    }
    else if (m.t === 'lock') { if (this.phase === PHASE.SELECT && p.op) p.locked = true; }
    else if (m.t === 'site') { // like R6, the defenders choose which objective to defend while picking operators
      if (this.phase === PHASE.SELECT && this.side(p) === TEAM.DEF && Number.isInteger(m.n) && m.n >= 0 && m.n < this.map.sites.length && m.n !== this.site && this.siteOpen(m.n)) {
        this.site = m.n; this.msg(`${p.name} chose to defend ${this.map.sites[m.n].name}`, TEAM.DEF);
      }
    }
    else if (m.t === 'settings') store.setSettings(p.token, m.s);
    else if (m.t === 'chat') { this.chat(p, { text: m.text, team: m.team }); if (m.team) botHear(this, p, String(m.text || '').slice(0, 140)); } // bots take directions and questions, typed or spoken
    else if (m.t === 'loadout') {
      const l = store.setLoadout(p.token, m.op, m.l);
      if (m.gun) store.setGun(p.token, m.gun.w, m.gun.a); // a shared gun setup changed
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
    assignPros(this); // at Pro skill, bots are the pro teams' players
  }
  removeBot(squad) {
    const b = [...this.players.values()].reverse().find(q => q.bot && (squad === undefined || q.squad === squad));
    if (b) { if (b.hasDefuser) this.dropDefuser(b); this.players.delete(b.id); assignPros(this); }
  }
  switchSquad(p) {
    if (this.phase !== PHASE.LOBBY) return;
    const to = 1 - p.squad;
    if (this.squadCount(to) >= TEAM_SIZE) { const b = [...this.players.values()].find(q => q.bot && q.squad === to); if (b) b.squad = p.squad; else return; }
    p.squad = to;
  }

  pickOp(p, op) {
    if (this.phase !== PHASE.SELECT || !OPERATORS[op] || p.locked) return; // locked in: no changing
    if (this.banning()) return; // the ban phase comes first
    if (OPERATORS[op].team !== this.side(p)) return;
    if (p.job && jobOf(op) !== p.job) return; // only your role's operators
    if (this.isBanned(op)) return;
    for (const q of this.players.values()) if (q !== p && q.squad === p.squad && q.op === op) return;
    p.op = op; p.job = jobOf(op);
  }

  isBanned(op) { return !!this.bans && this.bans.some(b => b.op === op); }
  // ESPORTS TV bans (he asked: there were too many): before the first round each team bans 1 attacker and 1 defender
  // (4 in all); every round after that 1 more (the teams take turns, from the side the other team plays that round), never
  // more than MAX_BANS in a match. Banned operators stay banned for the whole match. True while the ban phase is running.
  tvBanStep() {
    if (!this.bans) this.bans = [];
    let B = this.banRun;
    if (!B || B.round !== this.round) {
      const atkSq = [0, 1].find(sq => [...this.players.values()].some(p => p.squad === sq && this.side(p) === TEAM.ATK)) ?? 0;
      const by = this.round % 2; // whose turn this round
      const order = this.round === 1 ? [[0, 'atk'], [1, 'atk'], [1, 'def'], [0, 'def']]
        : this.bans.length >= MAX_BANS ? [] : [[by, by === atkSq ? 'def' : 'atk']];
      B = this.banRun = { round: this.round, order, i: 0, t: this.time + 2.5 };
    }
    if (B.i < B.order.length) {
      if (this.time >= B.t) {
        const [sq, sd] = B.order[B.i++], op = tvBanPick(this, sq, sd);
        if (op) { this.bans.push({ op, sq, rd: this.round }); this.events.push({ e: 'ban', op, sq }); }
        B.t = this.time + BAN_GAP;
      }
      return true;
    }
    return this.time < B.t - BAN_GAP + 1.5; // the last stamp stays a moment before the picks start
  }

  // Operator bans in Unranked / Ranked (he asked, R6's rule): before round 1 each team bans one attacker and one
  // defender, taking turns (BLUE attacker, ORANGE attacker, ORANGE defender, BLUE defender). A team with a person on it
  // gets BAN_TURN seconds and any of its people can click the ban (the first click counts); time up = no ban. A bot-only
  // team bans like the Esports TV bots (tvBanPick). Banned operators stay banned for the whole match.
  banning() { const B = this.banRun; return !!(this.rules.bans && !this.tv && this.phase === PHASE.SELECT && B && B.round === this.round && B.i < B.order.length); }
  playerBanStep() {
    if (this.round !== 1) return false;
    if (!this.bans) this.bans = [];
    let B = this.banRun;
    if (!B || B.round !== this.round) B = this.banRun = { round: this.round, order: [[0, 'atk'], [1, 'atk'], [1, 'def'], [0, 'def']], i: 0, t: null };
    if (B.i >= B.order.length) return false;
    const [sq, sd] = B.order[B.i], people = [...this.players.values()].some(q => !q.bot && q.sock && q.squad === sq);
    if (B.t === null) { B.t = this.time + (people ? BAN_TURN : 2.5); B.people = people; }
    if (this.time >= B.t) {
      const op = B.people ? null : tvBanPick(this, sq, sd);
      if (op) { this.bans.push({ op, sq, rd: this.round }); this.events.push({ e: 'ban', op, sq }); this.msg(`${sq ? 'BRAVO' : 'ALPHA'} banned ${OPERATORS[op].name}`); }
      else this.msg(`${sq ? 'BRAVO' : 'ALPHA'} didn't ban ${sd === 'atk' ? 'an attacker' : 'a defender'}`);
      B.i++; B.t = null;
    }
    return B.i < B.order.length;
  }
  playerBan(p, op) {
    if (!this.banning() || !OPERATORS[op] || this.isBanned(op)) return;
    const B = this.banRun, [sq, sd] = B.order[B.i];
    if (p.squad !== sq || OPERATORS[op].team !== sd) return;
    this.bans.push({ op, sq, rd: this.round }); this.events.push({ e: 'ban', op, sq }); this.msg(`${p.name} banned ${OPERATORS[op].name}`);
    B.i++; B.t = null;
  }

  // ---------------- match flow ----------------
  // ranked: the bots' rank is the lobby people's average MMR
  rankedLevel() {
    const ms = [...this.players.values()].filter(q => !q.bot && q.token).map(q => (store.byToken(q.token) || {}).mmr ?? START_MMR);
    const lv = rankOf(ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : START_MMR);
    if (lv !== this.botLevel) { this.botLevel = lv; assignPros(this); }
  }
  startMatch() {
    if (this.players.size === 0) return;
    if (this.randomMap) { const list = MAP_LIST.filter(k => k !== this.mapId); this.mapId = list[Math.floor(Math.random() * list.length)]; this.map = buildMap(this.mapId); }
    if (this.rules.kind === 'arena') { arenaStart(this); return; }
    if (this.rules.kind === 'zombies') { zbStart(this); return; } // ZOMBIES: Lantern Point, round after round // FUN MODES: one match of respawning action
    if (this.ranked) { this.rankedLevel(); for (const s of [0, 1]) while (this.squadCount(s) < TEAM_SIZE && this.players.size < MAX_PLAYERS) this.addBot(s); } // empty slots on both teams: bots at that rank
    assignPros(this); this.proState = {}; this.proLast = {}; this.proLog = [];
    this.score = [0, 0]; this.round = 0; // round 1: squad 0 attacks (the tutorial: you attack, then defend)
    for (const p of this.players.values()) { p.kills = 0; p.deaths = 0; p.ms = this.blankMatchStats(); }
    this.departed = []; this.roundLog = []; this.matchStart = Date.now(); this.bans = []; this.banRun = null; this.sitesUsed = [];
    this.nextRound();
  }

  nextRound() {
    this.round++;
    this.map = buildMap(this.mapId); this.mapVersion++; this.changed.clear(); this.newHoles = [];
    this.baseTiles = this.map.tiles.slice(); // how the walls were built (SOLDER welds broken soft walls back)
    this.ents = []; this.planted = null; this.winner = null; this.reason = ''; this.noises = [];
    // he asked: a site played once this match can't be chosen again until every site has been played (then all reopen)
    if (!this.sitesUsed || this.sitesUsed.length >= this.map.sites.length) this.sitesUsed = [];
    const open = this.map.sites.map((_, i) => i).filter(i => this.siteOpen(i));
    this.site = this.tut ? 0 : open[Math.floor(Math.random() * open.length)];
    this.siteRevealed = false;
    this.spots = { atk: new Map(), def: new Map() };
    this.reinforce = REINF_EACH;
    this.spawnName = this.map.atkSpawns[Math.floor(Math.random() * this.map.atkSpawns.length)].name;
    this.spawnPlan = this.makeSpawnPlan(); this.insideCache = null;
    for (const p of this.players.values()) { p.op = null; p.alive = false; p.ctrl = 'body'; p.busy = null; p.hasDefuser = false; p.locked = false; p.spawn = null; p.staged = false; p.job = null; }
    this.phase = PHASE.SELECT; this.timer = DUR.select;
    this.events.push({ e: 'newmap', v: this.mapVersion });
    const swapped = this.rules.swap === 'half' && this.round > 1 && this.atkSquad(this.round) !== this.atkSquad(this.round - 1) && !inOvertime(this.rules, this.score);
    this.events.push({ e: 'banner', text: inOvertime(this.rules, this.score) ? `OVERTIME · ROUND ${this.round}` : `ROUND ${this.round}`, sub: inOvertime(this.rules, this.score) ? `First to ${roundsToWin(this.rules, this.score)} · sides swap every round` : swapped ? 'Half time: sides swapped' : 'Choose your operator' });
    if (!this.tut && !this.free) siteVote(this); // the defending bots vote on the site (a person on the team can still change it)
  }

  siteOpen(n) { return !(this.sitesUsed || []).includes(n); }

  beginPrep() {
    const map = this.map;
    if (!this.tut && !this.free && this.sitesUsed && !this.sitesUsed.includes(this.site)) this.sitesUsed.push(this.site);
    for (const p of this.players.values()) {
      const team = this.side(p);
      if (!p.op) { // random unpicked operator
        const taken = new Set([...this.players.values()].filter(q => q.squad === p.squad && q.op).map(q => q.op));
        const free = opsForTeam(team).filter(o => !taken.has(o) && !this.isBanned(o));
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
    for (const c of map.outCams || []) // outside cameras under the roof's edge (he asked): watch the yard, the ropes and the roof edge
      this.ents.push({ id: this.eid(), type: 'cam', x: c.x, y: c.y, gx: c.gx, gy: c.gy, oc: c.i, team: TEAM.DEF, hp: 1, offUntil: 0, ang: c.n, wn: c.n, ws: OUTCAM_TURN, wall: [] });
    this.by = TEAM.DEF; this.boardWindows(); this.by = null; // the defenders' boards: their map shows them
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
    if (this.rules.preBoards) this.preBarricade(this.rules.preBoards);
    for (const p of this.players.values()) if (p.bot) botPrep(this, p);
    this.phase = PHASE.PREP; this.timer = DUR.prep;
    if (this.rules.help) { this.siteRevealed = true; this.events.push({ e: 'found', team: TEAM.ATK }); } // Quick Match: the attackers are shown the site from the start
    this.events.push({ e: 'banner', text: 'PREPARATION PHASE', sub: '' });
  }

  // Quick Match (he asked): a couple of the doorways defenders usually board are boarded already, so beginners see
  // barricades without having to build them (the site's doors that don't lead to a room defenders hold, as bots pick)
  preBarricade(n) {
    const ds = defSetup(this), done = [];
    for (const id of [...ds.siteBoards, ...ds.outerBoards]) {
      if (done.length >= n) break;
      const o = this.map.openings[id]; if (!o || this.map.tiles[o.cells[0]] !== T.OPEN) continue;
      if (this.map.win && o.cells.some(c => this.map.win[c])) continue; // windows are boarded anyway
      if (this.barricade(id, T.BARRI, true)) done.push(id);
    }
    return done;
  }

  // the spawn an attacker chose, or (RANDOM, the default) where the team's spawn plan puts them
  spawnOf(p) { const S = this.map.atkSpawns; return S.find(s => s.name === p.spawn) || S.find(s => s.name === this.autoSpawn(p)) || S[0]; }

  // he asked: random spawn by default, but teams mostly play together: usually two groups and one player off on
  // their own, sometimes the whole team at one spawn, sometimes two even groups. One plan per round (the round's
  // strategy); the attackers on RANDOM are dealt into it in a shuffled order, so who goes where changes every round.
  makeSpawnPlan() {
    const S = this.map.atkSpawns.map(s => s.name), r = Math.random();
    const main = this.spawnName, others = S.filter(n => n !== main).sort(() => Math.random() - 0.5);
    const kind = S.length < 2 || this.tut ? 'stack' : r < 0.55 ? 'split' : r < 0.8 ? 'two' : r < 0.95 ? 'stack' : 'wide';
    return { kind, main, second: others[0] || main, off: others[1] || others[0] || main, wide: others[2] || others[1] || others[0] || main, salt: Math.random(), key: '', at: new Map() };
  }
  autoSpawn(p) {
    const P = this.spawnPlan || (this.spawnPlan = this.makeSpawnPlan());
    const auto = [...this.players.values()].filter(q => this.side(q) === TEAM.ATK && !q.spawn);
    const key = auto.map(q => q.id).join(',');
    if (P.key !== key) { // someone joined, left or chose their own spawn: deal again
      P.key = key; P.at.clear();
      const n = auto.length, h = q => Math.abs(Math.sin(String(q.id).length * 7.1 + [...String(q.id)].reduce((a, c) => a + c.charCodeAt(0), 0) * 12.9898 + P.salt * 78.233) * 43758.5453) % 1;
      const order = auto.slice().sort((a, b) => h(a) - h(b)), slots = [];
      if (P.kind === 'stack' || n < 2) for (let i = 0; i < n; i++) slots.push(P.main);
      else if (P.kind === 'two') for (let i = 0; i < n; i++) slots.push(i < Math.ceil(n / 2) ? P.main : P.second);
      else { // split: one off on their own (from 3 players), the rest in two groups; 'wide' (rare) has two loners
        const lone = n >= 3 ? (P.kind === 'wide' && n >= 5 ? 2 : 1) : 0, rest = n - lone;
        for (let i = 0; i < rest; i++) slots.push(i < Math.ceil(rest / 2) ? P.main : P.second);
        if (lone) slots.push(P.off);
        if (lone > 1) slots.push(P.wide);
      }
      order.forEach((q, i) => P.at.set(q.id, slots[i]));
    }
    return P.at.get(p.id) || P.main;
  }

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
    this.winner = squad; this.reason = reason; this.lastWinner = squad;
    this.phase = PHASE.ROUND_END; this.timer = DUR.roundEnd;
    this.events.push({ e: 'roundEnd', squad, side: winTeam, reason });
    roundChat(this, squad);
    for (const p of this.players.values()) { p.busy = null; if (p.ctrl !== 'body') p.ctrl = 'body'; }
  }

  squadOfSide(team) { return team === TEAM.ATK ? this.atkSquad() : 1 - this.atkSquad(); }

  equip(p) {
    const o = OPERATORS[p.op];
    p.alive = true; p.downed = false; p.maxHp = ARMOR_HP[o.armor]; p.hp = p.maxHp;
    const L = p.bot ? this.botLoadout(p.op, p) : store.loadout(p.token, p.op);
    p.loadout = L; p.gadget = L.gadget;
    p.riot = RIOT[L.primary] ? L.primary : null; p.riotBroken = false; p.riotHp = p.riot ? RIOT[p.riot].hp : 0; // a riot shield as the primary: held up in front, pistol behind it
    p.guns = [p.riot ? null : L.primary, L.secondary].filter(Boolean).map(w => {
      const att = cleanAtt(w, L.att && L.att[w], p.op); // nothing chosen: the operator's starter set
      return { w, ammo: WEAPONS[w].mag, reserve: WEAPONS[w].reserve, att, m: gunMods(w, att) };
    });
    p.slot = 0; p.fireCd = 0; p.reloadT = 0; p.bloom = 0; p.vx = 0; p.vy = 0; p.gait = 0;
    p.adsT = 0; p.rc = 0; p.shots = 0; p.rcDir = Math.random() < 0.5 ? 1 : -1; p.viewTime = null;
    p.barri = o.team === TEAM.DEF ? BARRICADES_EACH : 0;
    p.abilityCount = o.ability.count; p.gadgetCount = GADGET_COUNT[p.gadget] || 1;
    p.battery = o.ability.battery || 0; p.scanning = false; p.bracing = false;
    p.rope = null; p.pinged = null; p.sprints = DRONE_SPRINT.charges; p.sprintUntil = 0; p.sprintCd = 0;
    p.drones = 0; p.droneId = null; p.ctrl = 'body'; p.busy = null; p.slowUntil = 0; p.stunUntil = 0; p.ef = null; p.staged = false;
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
      if (this.tv) { if (this.tvBanStep()) return; tvTalk(this); if (this.allLocked()) this.beginPrep(); return; } // ESPORTS TV: bans, 15 s of team talk, then go
      if (this.rules.bans && this.playerBanStep()) return; // Unranked / Ranked: bans before round 1's picks
      // he asked: bots never pick before you. They wait until every person on their team has locked in.
      for (const p of this.players.values()) if (p.bot && !p.op && (this.tut || this.humansLocked(p.squad)) && Math.random() < dt * 2.5) botPickOp(this, p);
      for (const p of this.players.values()) if (p.bot && p.op && !p.locked) {
        p.locked = true;
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
        if (Math.max(...this.score) >= roundsToWin(this.rules, this.score)) {
          this.phase = PHASE.MATCH_END; this.timer = DUR.matchEnd;
          const win = this.score[0] > this.score[1] ? 0 : 1;
          const mvp = [...this.players.values()].map(p => ({ p, sc: (p.ms && p.ms.score) || matchScore(p.ms || {}) })).sort((a, b) => b.sc - a.sc)[0]; // the MVP is the top score
          this.events.push({ e: 'matchEnd', squad: win, mvp: mvp ? { id: mvp.p.id, name: mvp.p.name, op: mvp.p.op, ...(mvp.p.ms || {}), ops: undefined } : null });
          const xp = this.saveMatch(win) || {};
          for (const p of this.players.values()) if (p.sock && xp[p.pid]) {
            const prof = store.byToken(p.token); if (prof && prof.mmr != null) p.mmr = prof.mmr;
            p.sock.send(JSON.stringify({ t: 'xp', ...xp[p.pid], stats: p.ms, profile: publicProfile(prof) }));
          }
        } else this.nextRound();
      }
      return;
    }
    if (this.phase === PHASE.MATCH_END) { if (this.timer <= 0) { this.resetToLobby(); if (this.tv && this.tv.socks.size) this.tvStart(null); } return; } // TV: the next match, on another map

    // PREP / ACTION
    for (const p of this.players.values()) if (p.ms && p.alive) p.ms.playSeconds += dt;
    if (this.free) this.freeRespawns();
    if (this.arena) arenaTick(this, dt);
    if (this.zb) zbTick(this, dt);
    for (const p of this.players.values()) {
      this.by = this.side(p); // a bot's own work (boards, reinforcing in preparation) is its side's
      if (p.bot && !p.hold) { (p.zombie ? zombieThink : this.arena || this.zb ? arenaThink : botThink)(this, p, dt); this.applyMove(p, dt); p.viewTime = null; }
      this.tickPlayer(p, dt);
      p.prevInput = p.input;
    }
    this.by = null;
    this.tickEnts(dt);
    this.recordHistory(); this.recordCam(); if (this.tv) this.tvClips();

    this.revealCheck -= dt;
    if (this.revealCheck <= 0) { this.revealCheck = 0.25; this.checkReveal(); }

    if (this.phase === PHASE.PREP && this.timer <= 0) this.beginAction();
    else if (this.phase === PHASE.ACTION) this.checkWin();
  }

  humansLocked(squad) { for (const p of this.players.values()) if (!p.bot && p.squad === squad && !p.locked && p.sock && p.sock.open) return false; return true; }
  allLocked() { for (const p of this.players.values()) if (!p.locked && (p.bot || (p.sock && p.sock.open))) return false; return true; }

  checkWin() {
    if (this.arena || this.zb) return; // fun modes end in arenaTick / zbTick
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
      if (d && d.type === 'bird') return { drone: true, bird: true, frozen: !!d.perch }; // MAGPIE's bird: flies over furniture, still when landed
      return { drone: true, frozen: !d || this.jammedAt(d.x, d.y) || !!d.grab, sprint: this.time < (p.sprintUntil || 0) }; // a drone the parasite has hold of can't move
    }
    const o = OPERATORS[p.op] || { armor: 2 };
    let mul = 1;
    if (this.time < p.slowUntil) mul *= 0.45;
    if (p.bracing) mul *= p.riot ? RIOT[p.riot].speed : 0.82; // shield up: a little slower, never a crawl (he asked); each riot shield its own
    const canSprint = mul >= 1 || (p.bracing && !p.riot && mul >= 0.82 - 1e-9); // BULWARK can sprint with the shield up (he asked); it swings like a jog meanwhile
    if (p.prep) mul *= p.prep.mode === 'place' ? 0 : 0.6; // setting something down: still; winding up a throw: slowed
    if (p.scanning) mul *= 0.6;
    if (this.time < (p.boostUntil || 0)) mul *= 1.25; // Adrenal Shot
    if (this.arena) mul *= arenaSpeed(this, p); // the infected are quicker
    if (this.zb) mul *= zbSpeed(this, p); // zombies shamble
    if (p.shrouded) mul *= 0.8;
    if (p.bipodSet) mul *= 0.15; // PERCH's bipod is down: you can only shuffle
    if (this.ghost(p)) mul *= 0.85; // STRIDER's Ghost Step: careful, slower steps (he asked: it was too strong)
    for (const e of this.ents) if (e.type === 'wire' && e.team !== this.side(p) && Math.hypot(e.x - p.x, e.y - p.y) < 24) { mul *= 0.3; break; }
    const beingRevived = p.downed && [...this.players.values()].some(q => q.busy && q.busy.k === 'revive' && q.busy.target === p.id); // he asked: revives kept failing — the downed crawled out of reach
    const frozen = !p.alive || p.ctrl !== 'body' || !!p.vault || !!p.rope || !!p.grapple || this.time < (p.clampUntil || 0) || !!(p.busy && p.busy.k !== 'revive') || beingRevived ||
      this.phase === PHASE.SELECT || this.phase === PHASE.ROUND_END || this.phase === PHASE.MATCH_END ||
      (this.phase === PHASE.PREP && this.side(p) === TEAM.ATK);
    const gw = p.guns && p.guns[p.slot] ? moveOf(WEAPONS[p.guns[p.slot].w]) : [1, 1];
    return { armor: o.armor, mul, downed: p.downed, frozen, gw: gw[0], ga: gw[1], ns: canSprint ? undefined : 1 }; // ns: anything slowing you stops a sprint
  }

  applyMove(p, dt) {
    if (dt <= 0 || (this.phase !== PHASE.PREP && this.phase !== PHASE.ACTION) || !p.alive) return;
    const m = this.mods(p);
    if (p.ctrl !== 'body') p.spr = false;
    if (p.ctrl === 'drone') {
      const d = this.ent(p.droneId); if (!d) return;
      stepMove(this.map, d, p.input, dt, m); d.ang = p.aim;
      if (d.perch) { const off = angDiff(p.aim, d.perch.out); if (Math.abs(off) > 1.45) d.ang = d.perch.out + Math.sign(off) * 1.45; } // a landed bird looks out from its wall
      if (d.type === 'bird' && !d.perch && Math.hypot(d.vx || 0, d.vy || 0) > 30 && this.time - (d.flapT || 0) > 0.7) { d.flapT = this.time; this.noise(d.x, d.y, TEAM.DEF, 150); this.events.push({ e: 'snd', s: 'flap', x: r1(d.x), y: r1(d.y) }); }
      return;
    }
    if (p.ctrl !== 'body') return;
    const before = { x: p.x, y: p.y };
    stepMove(this.map, p, p.input, dt, m);
    const moved = Math.hypot(p.x - before.x, p.y - before.y) / dt;
    // how loud your steps are follows how fast you move (he asked): walking/crouching is silent, aiming in is faint, a jog is loud
    const loud = p.spr && moved > BASE_SPEED ? SPRINT_LOUD : p.input.crouch || p.pr ? 0 : 320 * Math.max(0, Math.min(1, (moved / PX_PER_M - 1.45) / (M_S.run - 1.45)));
    p.moving = moved < 5 ? 0 : loud === SPRINT_LOUD ? 3 : loud < 60 ? 1 : 2;
    if (p.spr) { const g = p.guns[p.slot], gw = g && WEAPONS[g.w]; p.gunUp = this.time + (gw && gw.raise !== undefined ? gw.raise : SPRINT_RAISE); } // the Ferret comes up at once
    if (p.slT > 0) { p.gunUp = 0; if (!p.sliding) { p.sliding = true; this.noise(p.x, p.y, this.side(p), 420); this.events.push({ e: 'snd', s: 'slide', x: r1(p.x), y: r1(p.y), id: p.id }); } } else p.sliding = false; // you can shoot from the hip during a slide
    if (p.landed) { p.landed = false; if (!p.shrouded) this.noise(p.x, p.y, this.side(p), 220); this.events.push({ e: 'snd', s: 'land', x: r1(p.x), y: r1(p.y), id: p.id }); } // a landing thump
    if (loud >= 30 && !this.ghost(p) && !p.shrouded && this.time - (p.noiseT || 0) > 0.3) { p.noiseT = this.time; this.noise(p.x, p.y, this.side(p), loud); } // running footsteps (none from HUSH's shroud)
  }

  tickPlayer(p, dt) {
    const RUNOUT_SPOT = 3;
    if (this.zb && p.zb) { if (p.slT > 0) p.wasSl = true; else if (p.wasSl) { p.wasSl = false; zbSlideEnd(this, p); } } // BLAST PROOF: a slide ends in a blast
    this.tickPrep(p);
    this.tickSnipers(p); this.tickGrapple(p, dt);
    // a defender outside the building (preparation or action): the attackers are warned at once, and after RUNOUT_SPOT
    // seconds outside in a row (R6's run-out rule, he chose it) the defender is spotted for them until back inside
    if (p.alive && this.side(p) === TEAM.DEF && (this.phase === PHASE.PREP || this.phase === PHASE.ACTION) && !this.tut && !this.arena && !this.zb) {
      const k = Math.floor(p.y / CELL) * this.map.W + Math.floor(p.x / CELL), out = this.map.tiles[k] === T.GROUND;
      p.outside = out; // the attackers get a warning at the top of the screen while any defender is outside (snapshot `ou`)
      p.outT = out ? (p.outT || 0) + dt : 0;
      if (out && p.outT >= RUNOUT_SPOT) this.spot(TEAM.ATK, p.id, 1);
      if (out && !(p.outWarnT > this.time)) { p.outWarnT = this.time + 6; this.events.push({ e: 'deny', id: p.id, why: p.outT >= RUNOUT_SPOT ? 'You are outside: the attackers can see where you are' : `You are outside: in ${Math.ceil(RUNOUT_SPOT - p.outT)} s the attackers will see where you are` }); }
    }
    else { p.outside = false; p.outT = 0; }
    if (!p.alive) { p.outside = false; return; }
    if (p.vault) { // carried over the obstacle along a fixed path
      const v = p.vault; v.t += dt;
      const f = Math.min(1, v.t / v.dur), e = f * f * (3 - 2 * f);
      p.x = v.x0 + (v.x1 - v.x0) * e; p.y = v.y0 + (v.y1 - v.y0) * e; p.vx = p.vy = 0;
      if (f >= 1 || p.downed) { p.vault = null; p.recoverUntil = this.time + VAULT_RECOVER; }
    }
    const team = this.side(p);
    const inp = p.input, prev = p.prevInput;
    const myBird = p.ctrl === 'drone' ? this.ent(p.droneId) : null;
    if (myBird && myBird.type === 'bird') { if (inp && inp.interact && !(prev && prev.interact)) this.birdPerch(p, myBird); } // E: land on a wall / take off
    else if (p.ctrl === 'drone') { // drone sprint (he asked): Shift, 1.6x for up to 3 s, 3 a round, 6 s between; the motor whine carries
      const on = this.time < (p.sprintUntil || 0), held = inp && (inp.walk || inp.sprint), was = prev && (prev.walk || prev.sprint);
      if (on && !held) { p.sprintUntil = this.time; p.sprintCd = this.time + DRONE_SPRINT.wait; }
      else if (!on && held && !was && (p.sprints || 0) > 0 && this.time >= (p.sprintCd || 0)) {
        p.sprints--; p.sprintUntil = this.time + DRONE_SPRINT.time; p.sprintCd = p.sprintUntil + DRONE_SPRINT.wait;
        const d = this.ent(p.droneId); if (d) this.events.push({ e: 'snd', s: 'droneSprint', x: r1(d.x), y: r1(d.y), id: p.id });
      }
      if (this.time < (p.sprintUntil || 0) && this.time - (p.sprintNoiseT || 0) > 0.4) { const d = this.ent(p.droneId); if (d) { p.sprintNoiseT = this.time; this.noise(d.x, d.y, team, 260); } }
    } else if (this.time < (p.sprintUntil || 0)) { p.sprintUntil = this.time; p.sprintCd = this.time + DRONE_SPRINT.wait; }
    this.tickRope(p, dt);
    if (this.free && this.free.god !== false && !p.bot && p.sock && p.alive) this.godMode(p); // (only a real connected player, not the test harness)
    p.fireCd -= dt; p.meleeCd -= dt; p.turretCd = Math.max(0, (p.turretCd || 0) - dt);
    { const g = p.guns[p.slot], rate = (1 / (g ? adsTime(WEAPONS[g.w]) : 0.3)) * (this.time < (p.boostUntil || 0) ? 2 : 1) / (g ? g.m.ads : 1);
      const canAds = p.input.ads && p.ctrl === 'body' && !p.downed && !(p.slT > 0) && !(p.slR > 0) && p.reloadT <= 0 && !p.bracing && !(p.switchUntil > this.time) && !p.vault && !(p.recoverUntil > this.time);
      p.adsT = Math.max(0, Math.min(1, (p.adsT || 0) + (canAds ? dt * rate : -dt * rate * 1.6)));
      const idle = this.time - p.lastShot; // the crosshair drifts back after a burst; once the gun has settled the next shot is exact
      if (idle > 0.1) p.rc = (p.rc || 0) * Math.exp(-dt * 12);
      if (g && p.shots && !aimHeat(WEAPONS[g.w], p.shots, idle, g.m)) { p.rc = 0; p.shots = 0; } }

    if (p.ctrl === 'cam' && !this.feed(p)) { // the feed you were watching broke: go to the next one
      const list = this.feeds(team);
      if (list.length && !p.downed) this.watch(p, list[0]); else p.ctrl = 'body';
    }
    if (p.downed) {
      p.hp -= dt; p.busy = null;
      if (!this.zb && SELF_UP.has(p.op) && (p.selfUp = (p.selfUp || 0) + dt) >= SELF_UP_TIME) { // SOLACE / TONIC / RALLY: slowly back on their feet
        p.downed = false; p.hp = 20; p.selfUp = 0; this.events.push({ e: 'snd', s: 'revive', x: r1(p.x), y: r1(p.y) }); return;
      }
      if (p.hp <= 0) this.kill(p, this.players.get(p.downedBy), 'Bled out');
      if (!this.zb || !p.alive) return; // (ZOMBIES: last stand, the pistol still shoots)
    }

    // defuser pickup
    if (team === TEAM.ATK && p.ctrl === 'body') for (const e of this.ents) {
      if (e.type === 'defuser' && Math.hypot(e.x - p.x, e.y - p.y) < 18) {
        p.hasDefuser = true; this.removeEnt(e); this.msg(`${p.name} picked up the defuser`, TEAM.ATK); this.msg('The attackers picked the defuser up again', TEAM.DEF); break;
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
    if (op.ability.id === 'brace') { // shield up (can't shoot) or rifle out (shield on the back); Q switches, which takes a moment
      if (p.shieldMode === undefined) p.shieldMode = 'shield';
      if (inp.ability && !prev.ability && p.ctrl === 'body' && !p.downed && !(p.switchUntil > this.time)) { p.switchUntil = this.time + 0.6; p.shieldMode = p.shieldMode === 'shield' ? 'gun' : 'shield'; this.events.push({ e: 'snd', s: 'swap', x: r1(p.x), y: r1(p.y), id: p.id }); }
      p.bracing = p.shieldMode === 'shield' && !(p.switchUntil > this.time);
    }
    if (p.riot) p.bracing = !p.riotBroken && !p.downed && p.ctrl === 'body' && !(p.switchUntil > this.time); // a riot shield is always up (until it cracks)
    if (op.ability.id === 'scan') {
      // a toggle (he asked): press to start, press again to stop; it stops by itself after 4 s or when the battery runs out
      const press = inp.ability && !p.scanIn; p.scanIn = !!inp.ability;
      if (press) { if (p.scanOn) p.scanOn = false; else if (p.battery > 0 && p.ctrl === 'body') { p.scanOn = true; p.scanRun = 0; } }
      if (p.scanOn && p.battery > 0 && p.ctrl === 'body' && (p.scanRun || 0) < 4) {
        p.scanning = true; p.battery = Math.max(0, p.battery - dt); p.scanRun = (p.scanRun || 0) + dt;
        for (const q of this.players.values())
          if (q.alive && this.side(q) === TEAM.ATK && !this.ghost(q) && Math.hypot(q.x - p.x, q.y - p.y) < 300) {
            // he asked: no more wallhacks. Only WRAITH sees it, as a fuzzy blip up to SCAN_BLUR off, moved on each heartbeat
            const b = (p.scanBlips || (p.scanBlips = new Map())); let z = b.get(q.id);
            if (!z || this.time - z.t > SCAN_BEAT) { const a = Math.random() * 6.283, r = (0.4 + Math.random() * 0.6) * SCAN_BLUR; z = { t: this.time, x: q.x + Math.cos(a) * r, y: q.y + Math.sin(a) * r }; b.set(q.id, z); }
            if (!(q.scanWarnT > this.time)) { q.scanWarnT = this.time + 2; this.events.push({ e: 'scanned', id: q.id }); } // ...and they hear it
          }
      } else { p.scanOn = false; p.scanning = false; p.scanRun = 0; p.battery = Math.min(op.ability.battery, p.battery + dt * 0.35); }
      if (p.scanBlips) for (const [id, z] of p.scanBlips) if (this.time - z.t > SCAN_BEAT + 0.1 || !p.scanning) p.scanBlips.delete(id);
    }

    if (op.ability.id === 'lance') { // Thermal Lance: burn the wall cell you face, one at a time
      p.lancing = false;
      if (inp.ability && p.battery > 0 && p.ctrl === 'body' && !p.downed) {
        let f = this.facingCell(p, 30);
        if (!f || ![T.SOFT, T.HARD, T.REINF, T.BARRI, T.PANEL, T.DSHIELD].includes(f.t)) { // or the hatch at your feet
          const hs = this.hatchSpot(p, [T.HATCH, T.HATCHR]);
          if (hs) f = { k: hs.k, t: T.SOFT, cx: hs.k % this.map.W, cy: Math.floor(hs.k / this.map.W) };
        }
        if (f && [T.SOFT, T.HARD, T.REINF, T.BARRI, T.PANEL, T.DSHIELD].includes(f.t)) {
          p.lancing = true; p.battery = Math.max(0, p.battery - dt);
          if (this.time - (p.noiseT || 0) > 0.4) { p.noiseT = this.time; this.noise(p.x, p.y, team, 260); } // the hiss of the torch
          const fx = (f.cx + 0.5) * CELL, fy = (f.cy + 0.5) * CELL, grid = this.gridNear(fx, fy, other(team));
          if (grid) { // a static grid on that wall shocks you instead
            p.lanceT = 0; p.shockT -= dt;
            if (p.shockT <= 0) { p.shockT = 0.5; this.damage(p, 8, this.players.get(grid.owner), 'Static Grid', 0); this.events.push({ e: 'arc', x: r1(grid.x), y: r1(grid.y), x2: r1(p.x), y2: r1(p.y) }); }
          } else {
            p.lanceT += dt;
            if (f.t === T.BARRI || f.t === T.DSHIELD || this.hatchSpot(p, [T.HATCH, T.HATCHR])?.k === f.k) { if (p.lanceT >= 1.3) { p.lanceT = 0; this.destroyCell(f.k); this.events.push({ e: 'hit', k: 'spark', x: r1(fx), y: r1(fy) }); } }
            else if (p.lanceT >= LANCE_STEP) { // he asked: a small hole first (enough to see and shoot through), wider the longer you carve
              p.lanceT = 0;
              const d = castSight(this.map, p.x, p.y, p.aim, 60, null, true), hx = p.x + Math.cos(p.aim) * (d + 3), hy = p.y + Math.sin(p.aim) * (d + 3);
              const L = p.lanceAt && p.lanceAt.k === f.k && Math.hypot(p.lanceAt.x - hx, p.lanceAt.y - hy) < 5 ? p.lanceAt : (p.lanceAt = { k: f.k, x: hx, y: hy, n: 0 });
              const ring = L.n === 0 ? 0 : L.n <= 6 ? 1 : 2, i = L.n === 0 ? 0 : L.n <= 6 ? L.n - 1 : L.n - 7, cnt = ring === 1 ? 6 : 12, a = i / cnt * Math.PI * 2;
              const h = this.map.holes[f.k] || (this.map.holes[f.k] = []), px = r1(L.x + Math.cos(a) * ring * 2.2), py = r1(L.y + Math.sin(a) * ring * 2.2);
              h.push(px, py); this.addHole(f.k, px, py); L.n++;
              this.events.push({ e: 'hit', k: 'spark', x: r1(px), y: r1(py) });
              if (L.n >= 19) { this.destroyCell(f.k); p.lanceAt = null; } // carved all the way round: the block falls out
            }
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
      const was = p.shrouded;
      if (inp.ability && !(prev && prev.ability) && p.ctrl === 'body' && !p.downed) p.shrouded = !p.shrouded && p.battery > 0.5 && !(p.shroudCd > this.time);
      if (p.shrouded && (p.battery <= 0 || p.downed || p.ctrl !== 'body')) p.shrouded = false;
      if (was && !p.shrouded) p.shroudCd = this.time + 15; // he asked: 15 s before it is ready again
      if (p.shrouded) p.battery = Math.max(0, p.battery - dt);
      else p.battery = Math.min(op.ability.battery, p.battery + dt * op.ability.battery / 15);
    }

    // interaction (hold E)
    if (inp.interact && p.ctrl === 'body' && !p.rope && !p.ropeHeld && !p.downed) {
      if (this.zb && zbUse(this, p, dt, inp)) p.busy = null; // ZOMBIES: buying and boarding windows
      else {
      if (!p.busy) p.busy = this.startInteract(p);
      if (p.busy) this.continueInteract(p, dt);
      }
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
    // BULWARK (he asked): holding aim-in glides the shield aside over SHIELD_ASIDE s; he can only shoot once it is fully out of the way
    const asT = p.riot ? RIOT[p.riot].aside : SHIELD_ASIDE;
    if (p.bracing) p.aside = Math.max(0, Math.min(1, (p.aside || 0) + (p.input.ads ? dt / asT : -dt / (asT * 0.75)))); else p.aside = 0;
    const canShoot = p.ctrl === "body" && !p.staged && !p.prep && !(p.bracing && p.aside < 1 && !(p.riot && RIOT[p.riot].hip)) && !p.busy && !p.vault && !(p.rope && p.rope.st !== 'hang') && !(p.recoverUntil > this.time) && p.reloadT <= 0 && !p.scanning && gun && !p.spr && !(p.gunUp > this.time) &&
      !(p.switchUntil > this.time) && !(p.staggerUntil > this.time) && !p.grapple;
    // a click made a hair before the gun is ready is kept until it is (up to 0.15 s), so fast tapping never loses a shot
    const gunComing = p.spr || p.gunUp > this.time; // a click at the end of a sprint fires as soon as the gun is up
    const click = p.click && !(this.time - (p.click.t ?? this.time) > (gunComing ? 0.5 : 0.15)) ? p.click : null; p.click = null;
    if (click && click.t === undefined) click.t = this.time;
    if (p.burst && !(canShoot && gun.w === p.burstW && gun.ammo > 0)) p.burst = 0; // a burst stops if you can't shoot
    if (p.burst) { // the rest of a burst fires by itself
      const w = WEAPONS[gun.w];
      if (p.fireCd <= 0) { this.fire(p, gun, w); if (!--p.burst) p.fireCd = Math.max(p.fireCd, w.burstGap || 0.3); }
      if (click) p.click = click; // clicking during a burst: the next burst follows
    } else if (canShoot && (inp.fire || click)) {
      const w = WEAPONS[gun.w];
      const edge = !prev.fire || !!click;
      const auto = fireAuto(w, p.adsT || 0);
      if (p.fireCd <= 0 && (auto || edge)) {
        if (gun.ammo > 0) { this.fire(p, gun, w, click); if (w.burst > 1) { p.burst = w.burst - 1; p.burstW = gun.w; if (!gun.ammo) { p.burst = 0; p.fireCd = Math.max(p.fireCd, w.burstGap || 0.3); } } }
        else if (gun.reserve > 0) this.startReload(p);
        else if (edge) this.events.push({ e: 'snd', s: 'empty', x: r1(p.x), y: r1(p.y) });
      } else if (click && !auto && p.fireCd > 0) p.click = click;
    } else if (click && gunComing) p.click = click;
  }

  // the sniper operators' running parts (he asked 2026-11-10)
  tickSnipers(p) {
    if (p.bipodSet && (!p.alive || p.downed || p.ctrl !== 'body' || !(p.input.crouch || p.pr >= 1) || Math.hypot(p.x - p.bipodSet.x, p.y - p.bipodSet.y) > 14)) p.bipodSet = null; // stood up or moved off: the bipod folds
    if (p.spotterUntil > this.time && p.alive && !p.downed && p.ctrl === 'body' && (p.adsT || 0) >= 0.6 && this.time - (p.spotT || 0) > 0.2) { // OSPREY: whoever the scope sees
      p.spotT = this.time;
      const team = this.side(p), fl = floorAt(this.map, p.x, p.y), sm = this.smokeList();
      for (const q of this.players.values()) {
        if (!q.alive || q.staged || this.side(q) === team || floorAt(this.map, q.x, q.y) !== fl) continue;
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d > 70 * PX_PER_M || Math.abs(angDiff(Math.atan2(q.y - p.y, q.x - p.x), p.aim)) > 0.35 || !los(this.map, p.x, p.y, q.x, q.y, sm)) continue;
        if (!(q.spotFrom && q.spotFrom > this.time)) this.pts(p, 10, 'Spotted an enemy');
        q.spotFrom = this.time + 4; this.spot(team, q.id, 4);
      }
    }
  }

  startReload(p) {
    const gun = p.guns[p.slot];
    if (!gun || p.reloadT > 0 || gun.reserve <= 0 || gun.ammo >= WEAPONS[gun.w].mag) return;
    const rw = WEAPONS[gun.w]; p.reloadT = p.reloadLen = reloadLen(rw, gun) * (this.zb ? zbReloadMul(this, p) : 1); if (rw.tandem) gun.tap = !gun.tap; // the Tandem: the taped magazine, then a full change
    this.events.push({ e: 'snd', s: 'reload', x: r1(p.x), y: r1(p.y), id: p.id });
  }

  // Something bots can hear: where, who made it, and how far it carries (px). Another floor halves it.
  noise(x, y, team, r) {
    (this.noises || (this.noises = [])).push({ x, y, team, r, t: this.time });
    if (this.noises.length > 80) this.noises.splice(0, this.noises.length - 80);
  }

  fire(p, gun, w, click = null) {
    this.noise(p.x, p.y, this.side(p), (gun.m && gun.m.quiet) ? 260 : 950);
    if (this.time - (p.lastShot ?? -9) > 0.25) p.spinFrom = this.time; // the Cyclone winds up from here (and down when you let go)
    const at0 = p.adsT || 0;
    gun.ammo--; p.fireCd = Math.max(p.fireCd, -1 / 30) + 60 / fireRpm(w, at0, this.time - p.spinFrom); // keep the leftover: guns fire at their real rate, not rounded up to whole ticks
    if (this.zb && p.zb && p.zb.perks.includes('rapid')) p.fireCd -= 60 / fireRpm(w, at0, this.time - p.spinFrom) * 0.25; // DOUBLE BARREL
    if (p.ms) p.ms.shots += w.pellets;
    // hip fire is a loose cone that widens while moving; aimed fire is accurate even on the move (R6 rules)
    const run = Math.min(1, Math.hypot(p.vx || 0, p.vy || 0) / BASE_SPEED + (p.air > 0 ? 1.5 : 0)), at = p.adsT || 0; // mid-jump: wild
    let m = gun.m || gunMods(gun.w);
    const low = !!(p.input.crouch || p.pr >= 1);
    if (bipodOn(w, low, Math.hypot(p.vx || 0, p.vy || 0))) m = { ...m, kick: m.kick * w.bipod, sway: m.sway * w.bipod }; // the Trestle's bipod is down
    if (p.bipodSet && w.cls === 'DMR') { m = { ...m, kick: m.kick * 0.5, sway: m.sway * 0.5 }; p.fireCd -= 60 / fireRpm(w, at0, 9) * 0.4 / 1.4; } // PERCH's bipod: 40% faster bolt, half the kick
    this.pierceNow = !!(p.pierceShot && w.pellets === 1); if (this.pierceNow) { p.pierceShot = 0; p.pierceLast = this.time; } // NAIL's round
    const D = fireDmg(w, at0) * m.dmg; // the Verdict hits harder aimed in
    // the aiming model (shared/operators.js): exact first shot, a fixed cone after that, a fixed recoil pattern
    const cone = spreadCone(w, m, { at, run, crouch: !!(p.input.crouch || p.pr >= 1), shots: aimHeat(w, p.shots || 0, this.time - p.lastShot, m) }) * (this.time < (p.dazeUntil || 0) && p.shots ? 1.7 : 1); // dazed: shaky follow-ups
    const aim = click ? click.a : p.aim, vt = p.viewTime;
    if (click && click.vt !== undefined) p.viewTime = click.vt; // judged against what they saw when they clicked
    const base = aim + (p.rc || 0);
    this.rangeMul = m.range; this.shotW = w; this.shotAim = click ? { x: click.ax, y: click.ay } : { x: p.aimX, y: p.aimY };
    const mx = p.x + Math.cos(aim) * (w.len + 6), my = p.y + Math.sin(aim) * (w.len + 6);
    for (let i = 0; i < w.pellets; i++) {
      const a = base + shotOffset(w, cone, i);
      const hole = this.holeAim(p); // aimed at a spot seen through an open hatch: the bullet goes down (or up) there
      const into = !hole && this.aimedHatch(p, a); // aimed at a closed hatch from on top: shotguns and DMRs chew it
      const eye = leanPoint(this.map, p.x, p.y, p.aim, p.lo || 0); // a lean shoots from the tipped upper body
      let end = hole ? this.shotThroughHole(p, eye, a, hole, w.range, D, w.name, w.cls) : this.hitscan(p, eye.x, eye.y, a, into ? into.ad : w.range, D, w.name, w.cls);
      if (into && end.k === 'none') this.shotThroughHatch(p, a, into, D, w.name, w.cls);
      else if (this.winCarry && end.k === 'none') end = this.shotOutWindow(p, eye, a, w.range, D, w.name, w.cls);
      this.winCarry = null;
      if (w.surge && this.zb) zbSurge(this, p, end.x, end.y); // ZOMBIES: the wonder weapon bursts where it lands
      if (tracerPellet(w, i)) this.events.push({ e: 'shot', id: p.id, w: gun.w, x: r1(mx), y: r1(my), x2: r1(end.x), y2: r1(end.y), k: end.k, q: m.quiet || undefined, nt: m.notrail || undefined });
    }
    if (w.pellets > 1) this.events.push({ e: 'shotgun', id: p.id });
    this.shotW = null; this.shotAim = null; this.pierceNow = false;
    p.viewTime = vt;
    p.lastShot = this.time;
    p.shots = (p.shots || 0) + 1; // recoil comes after the shot, so it moves the next one, never this one
    p.rc = Math.max(-recoilMax(w), Math.min(recoilMax(w), (p.rc || 0) + recoilStep(w, m, p.shots)));
  }

  // Bullet: stops at the first enemy, goes through soft walls (damaging them), stops on hard ones.
  // Where everyone was, a few times a second back — so a shot can be judged against what the shooter saw.
  // ---- killcam (he asked: rewatch your death, a BS rating on how fair it was, and a "!" when it caught a bug) ----
  // everyone's pose 15 times a second for the last 6 s
  recordCam() {
    if ((this.camTick = (this.camTick || 0) + 1) % 2) return;
    const ps = [];
    for (const p of this.players.values()) if (p.alive && !p.staged) ps.push([p.id, r1(p.x), r1(p.y), r2(p.aim), (p.downed ? 1 : 0) | (p.input && p.input.ads ? 2 : 0) | (p.input && p.input.crouch ? 4 : 0) | (p.bracing ? 8 : 0), Math.round(p.hp), p.op, p.guns && p.guns[p.slot] ? p.guns[p.slot].w : null]);
    (this.camBuf || (this.camBuf = [])).push({ t: this.time, ps });
    while (this.camBuf.length > 95) this.camBuf.shift();
  }
  // blocked to every part of the body at b (its middle and both sides): a bullet clipping past a doorframe corner is fair
  solidToBody(a, b, q) {
    const d = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / d, ny = (b.x - a.x) / d, r = hitR(q.op);
    return [0, 1, -1].every(o => this.solidBetween(a, { x: b.x + nx * r * o, y: b.y + ny * r * o }));
  }
  solidBetween(a, b) { // a bullet from a to b would have to cross concrete, furniture or a panel
    const d = Math.hypot(b.x - a.x, b.y - a.y); if (d < 2) return false;
    const dx = (b.x - a.x) / d, dy = (b.y - a.y) / d, sx = Math.floor(a.x / CELL), sy = Math.floor(a.y / CELL); let hit = false;
    walkRay(a.x, a.y, dx, dy, d, (cx, cy) => {
      if (cx === sx && cy === sy) return false;
      const t = tileAt(this.map, cx, cy); if (!stopsBullet(t)) return false;
      const sh = shapeAt(this.map, cx, cy); if (sh) { const h = rayShape(sh, a.x, a.y, dx, dy); if (h === null || h > d) return false; }
      const k = cy * this.map.W + cx; if (this.map.holes[k] && throughHole(this.map, k, a.x, a.y, dx, dy)) return false;
      hit = true; return true;
    });
    return hit;
  }
  judgeKill(q, src, wname, frames) {
    const why = [], bug = []; let score = 0;
    if (!src || src === q) return { rating: 0, why: ['Nobody else was involved'], bug: null };
    const gun = Object.values(WEAPONS).some(w => w.name === wname), fl = (x, y) => floorAt(this.map, x, y);
    if (this.side(src) === this.side(q)) { score += 3; why.push('A teammate did it'); }
    let seenAt = null; // did they ever show on your screen (your 103° view, a clear line) in the last 3 s?
    for (const f of frames) {
      if (f.t < this.time - 3) continue;
      const v = f.ps.find(e => e[0] === q.id), k = f.ps.find(e => e[0] === src.id); if (!v || !k) continue;
      if (fl(v[1], v[2]) === fl(k[1], k[2]) && Math.abs(angDiff(Math.atan2(k[2] - v[2], k[1] - v[1]), v[3])) < 0.9 && los(this.map, v[1], v[2], k[1], k[2])) { seenAt = f.t; break; }
    }
    if (seenAt === null) { score += 3; why.push('They were never on your screen'); }
    else if (this.time - seenAt < 0.35) { score += 2; why.push(`Dead ${Math.round((this.time - seenAt) * 1000)} ms after they showed up`); }
    const lh = this.lastHit && this.lastHit.q === q.id && this.time - this.lastHit.t < 0.5 ? this.lastHit : null;
    if (lh && lh.pens) { score += 2; why.push('Shot through a wall'); }
    if (Math.abs(angDiff(Math.atan2(src.y - q.y, src.x - q.x), q.aim)) > 1.9) { score += 1; why.push('Shot from behind'); }
    if (gun && src.viewTime !== null && src.viewTime !== undefined) { // lag: no clear line now, but there was where the shooter saw you
      const p0 = this.posAt(q, src.viewTime);
      if (Math.hypot(p0.x - q.x, p0.y - q.y) > 6 && !los(this.map, src.x, src.y, q.x, q.y) && los(this.map, src.x, src.y, p0.x, p0.y)) { score += 3; why.push('You were already behind cover on your screen (their lag)'); }
    }
    if (!gun) why.push(`Killed by ${wname || 'utility'}`);
    if (this.headshot) why.push('A headshot');
    if (!score) why.unshift('A fair fight');
    // things that should never happen: a bug, saved for fixing
    if (gun) {
      if (!src.alive) bug.push('the shooter was already dead');
      if (fl(src.x, src.y) === fl(q.x, q.y) && !(src.tracerUntil > this.time) && !(this.time - (src.pierceLast ?? -9) < 1) && this.solidToBody(leanPoint(this.map, src.x, src.y, src.aim, src.lo || 0), q.lo ? leanPoint(this.map, q.x, q.y, q.aim, q.lo) : q, q) && (src.viewTime === null || src.viewTime === undefined || this.solidToBody(leanPoint(this.map, src.x, src.y, src.aim, src.lo || 0), this.posAt(q, src.viewTime), q)) && !(src.lo || q.lo) /* a lean shoots from the tipped shoulder: measured from there */) bug.push('the bullet went through concrete or furniture');
      { const a = localPos(this.map, src.x, src.y), b = localPos(this.map, q.x, q.y); if (Math.hypot(a.x - b.x, a.y - b.y) > 2200) bug.push('shot from further than any gun reaches'); } // in the building (floors sit side by side on the map: a shot down the stairs or through a hole crosses them)
    }
    const st0 = tileAt(this.map, Math.floor(src.x / CELL), Math.floor(src.y / CELL));
    if (src.alive && !src.vault && !src.rope && (st0 === T.HARD || st0 === T.REINF || st0 === T.TALL || st0 === T.VOID) && pointSolid(this.map, src.x, src.y, t => t === st0)) bug.push('the shooter was standing inside a wall');
    let prev = null;
    for (const f of frames) { const k = f.ps.find(e => e[0] === src.id); if (k && prev && Math.hypot(k[1] - prev[1], k[2] - prev[2]) > 70 && fl(k[1], k[2]) === fl(prev[1], prev[2])) { bug.push('the shooter jumped across the map'); break; } prev = k; }
    return { rating: Math.min(10, score), why, bug: bug.length ? bug : null };
  }
  // ESPORTS TV instant replays (he asked: short replays of big moments the camera missed): what made a kill big, and the
  // clip sent ~1.2 s later (so it shows the moment after too). The viewer's screen decides whether its camera missed it.
  tvKill(q, src, wname) {
    const big = [], t = this.time, sq = src.squad;
    const streak = ((src.tvKills || []).filter(k => t - k < 10)); streak.push(t); src.tvKills = streak;
    if (streak.length >= 2) big.push(streak.length >= 3 ? 'TRIPLE KILL' : 'DOUBLE KILL');
    if (this.headshot && Math.hypot(src.x - q.x, src.y - q.y) > 15 * PX_PER_M) big.push('LONG HEADSHOT');
    const mates = [...this.players.values()].filter(o => o.squad === sq && o.alive && !o.downed).length;
    if (mates === 1 && this.side(src) !== this.side(q)) big.push('CLUTCH');
    if (wname && wname !== 'Melee' && !Object.values(WEAPONS).some(w => w.name === wname)) big.push(wname.toUpperCase()); // a skill or gadget kill
    if (this.side(src) === this.side(q)) big.push('TEAMKILL');
    (this.tvClipQ || (this.tvClipQ = [])).push({ due: t + 1.2, at: t, victim: q.id, killer: src.id, w: wname || '', hs: this.headshot ? 1 : 0, big, kx: r1(src.x), ky: r1(src.y), vx: r1(q.x), vy: r1(q.y) });
  }
  tvClips() {
    if (!this.tvClipQ || !this.tvClipQ.length) return;
    for (const c of this.tvClipQ.filter(c => this.time >= c.due)) {
      const frames = (this.camBuf || []).filter(f => f.t >= c.at - 5 && f.t <= c.at + 1.2), ids = new Set([c.killer, c.victim]);
      for (const f of frames) for (const e of f.ps) if (!ids.has(e[0]) && Math.min(Math.hypot(c.kx - e[1], c.ky - e[2]), Math.hypot(c.vx - e[1], c.vy - e[2])) < 260) ids.add(e[0]);
      const m = JSON.stringify({ t: 'tvclip', killer: c.killer, victim: c.victim, w: c.w, hs: c.hs, big: c.big, kx: c.kx, ky: c.ky, vx: c.vx, vy: c.vy,
        fr: frames.map(f => ({ t: r2(f.t - c.at), ps: f.ps.filter(e => ids.has(e[0])) })),
        shots: (this.shotLog || []).filter(s => s.t >= c.at - 5 && s.t <= c.at + 1.2 && ids.has(s.id)).map(s => ({ ...s, t: r2(s.t - c.at) })),
        names: Object.fromEntries([...ids].map(id => { const p = this.players.get(id); return [id, p ? [p.name.replace(/^\[\w+\] /, ''), this.side(p) === TEAM.DEF ? 1 : 0] : ['?', 0]]; })) });
      for (const sk of this.tv.socks) if (sk.open) sk.send(m);
    }
    this.tvClipQ = this.tvClipQ.filter(c => this.time < c.due);
  }
  sendKillcam(q, src, wname) {
    const now = this.time, frames = (this.camBuf || []).filter(f => f.t >= now - 5.5), ids = new Set([q.id]);
    if (src) ids.add(src.id);
    const last = frames[frames.length - 1];
    if (last) for (const e of last.ps) if (!ids.has(e[0]) && [q, src].some(o => o && Math.hypot(o.x - e[1], o.y - e[2]) < 320)) ids.add(e[0]); // others close by, for the picture
    const j = this.judgeKill(q, src, wname, frames);
    const m = { t: 'killcam', killer: src ? src.id : null, kn: src ? src.name : '', victim: q.id, w: wname || '', hs: this.headshot ? 1 : 0, rating: j.rating, why: j.why, bug: j.bug,
      kop: src ? src.op : null, km: src ? r1(Math.hypot(src.x - q.x, src.y - q.y) / PX_PER_M) : 0, wall: this.shotPens ? 1 : 0, team: src && src !== q && this.side(src) === this.side(q) ? 1 : 0, self: src === q ? 1 : 0,
      dnBy: (() => { const d = q.downedBy != null && this.players.get(q.downedBy); return d && d !== src ? d.name : null; })(),
      fr: frames.map(f => ({ t: r2(f.t - now), ps: f.ps.filter(e => ids.has(e[0])) })),
      shots: (this.shotLog || []).filter(s => s.t >= now - 5.5 && ids.has(s.id)).map(s => ({ ...s, t: r2(s.t - now) })),
      names: Object.fromEntries([...ids].map(id => { const p = this.players.get(id); return [id, p ? [p.name, this.side(p) === this.side(q) ? 1 : 0] : ['?', 0]]; })) };
    if (j.bug) m.bugId = store.saveBug({ at: new Date().toISOString(), version: process.env.R62D_VERSION || null, map: this.map.id, round: this.round, site: this.site, weapon: wname, bug: j.bug, why: j.why,
      killer: src && { id: src.id, name: src.name, op: src.op, x: src.x, y: src.y, aim: src.aim, viewTime: src.viewTime, alive: src.alive }, victim: { id: q.id, name: q.name, op: q.op, x: q.x, y: q.y, aim: q.aim }, time: now, frames: m.fr, shots: m.shots });
    q.sock.send(JSON.stringify(m));
  }

  recordHistory() {
    const snap = new Map();
    for (const q of this.players.values()) if (q.alive) snap.set(q.id, { x: q.x, y: q.y });
    for (const e of this.ents) if (e.type === 'drone' || e.type === 'bird') snap.set(e.id, { x: e.x, y: e.y }); // drones are judged where the shooter saw them too
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
      const at0 = src.viewTime !== null && src.viewTime !== undefined ? this.posAt(q, src.viewTime) : q; // favour the shooter
      const at = q.lo ? leanPoint(this.map, at0.x, at0.y, q.aim, q.lo) : at0; // a leaning target's upper body (and head) is where it leans to
      const t = rayCircle(x0, y0, dx, dy, at.x, at.y, hitR(q.op));
      if (t !== null && t < bestT) { bestT = t; best = { q, at }; }
      // up or down a staircase: someone on its steps or landing can be hit where they show on this floor's steps
      const gh = stairGhost(this.map, at.x, at.y);
      if (gh && gh.fl === fl && stairLooks(this.map, gh.s, x0, y0)) {
        const tg = rayCircle(x0, y0, dx, dy, gh.x, gh.y, hitR(q.op));
        if (tg !== null && tg < bestT) { bestT = tg; best = { q, at: gh }; }
      }
      // someone at an upper window (or on a rope) shows on the ground just outside the wall: hit there from below
      const wg = fl === this.map.groundFloor && wallGhost(this.map, at.x, at.y);
      const pv = wg && peekSeen(this.map, wg, x0, y0);
      if (pv) {
        const gp = pv === true ? wg : { ...wg, x: pv.x, y: pv.y }; // at the foot of the view the shooter sees them through
        const tw = rayCircle(x0, y0, dx, dy, gp.x, gp.y, hitR(q.op));
        if (tw !== null && tw < bestT) { bestT = tw; best = { q, at: gp }; }
      }
    }
    for (const e of this.ents) {
      if (!e.hp || e.team === team) continue;
      if (e.tu && Math.abs(angDiff(Math.atan2(y0 - e.y, x0 - e.x), e.ang || 0)) > 0.9) continue; // a turret is bulletproof except its lens, from the front (KITE)
      const small = e.type === 'drone' || e.type === 'bird';
      if (e.type === 'drone' && !(src && src.pr >= 1)) { const dk = Math.floor(e.y / CELL) * this.map.W + Math.floor(e.x / CELL); if (underAt(this.map, dk, this.map.tiles[dk])) continue; } // under a vehicle or table: covered, unless you lie down too
      const at = small && src.viewTime !== null && src.viewTime !== undefined ? this.posAt(e, src.viewTime) : e;
      const t = rayCircle(x0, y0, dx, dy, at.x, at.y, e.type === 'decoy' ? hitR(e.op) : small ? 4.5 : 6); // drones are small
      if (t !== null && t < bestT) { bestT = t; best = { e }; }
      if (e.oc !== undefined && fl === this.map.groundFloor && !this.fromAbove) { const tg = rayCircle(x0, y0, dx, dy, e.gx, e.gy, 6); if (tg !== null && tg < bestT) { bestT = tg; best = { e }; } } // an outside camera, from the ground below it
    }
    const cov = rayCovers(this.map, x0, y0, dx, dy, bestT); if (cov) { bestT = cov.t; best = null; } // a cover plate in the way
    let mult = 1, stopT = bestT, kind = best ? 'flesh' : cov ? 'cover' : 'none', pens = 0, wallT = 0, tracerWall = src && src.tracerUntil > this.time && this.shotW ? 2 : this.pierceNow ? Math.ceil(1.5 * PX_PER_M / CELL) : 0, pierced = 0; // MARK: two cells of solid wall; NAIL: a metre and a half
    const pen = penOf(this.shotW && this.shotW.cls === cls ? this.shotW : { cls });
    const sx = Math.floor(x0 / CELL), sy = Math.floor(y0 / CELL), up = fl > (this.map.groundFloor ?? 99);
    let winK = -1; this.winCarry = null;
    walkRay(x0, y0, dx, dy, bestT, (cx, cy, t) => {
      const k = cy * this.map.W + cx, tile = tileAt(this.map, cx, cy);
      if (up) { // out of an upper window: the rest of the shot carries on down on the ground floor (shotOutWindow)
        if (this.map.win[k] || (this.map.roofEdgeAt && this.map.roofEdgeAt.has(k))) winK = k; // (or over the roof's edge)
        else if (winK >= 0 && !this.winCarry && (tile === T.VOID || (tile === T.LOW && this.map.floor[k] === FL.VOID))) this.winCarry = { t, mult, k: winK };
        if (this.winCarry && (tile === T.VOID || t > this.winCarry.t + CELL * 1.5)) { stopT = t; kind = 'none'; best = null; return true; } // (out past the rope ledge along the wall: on down)
      }
      const sh = (stopsBullet(tile) || penBullet(tile)) && shapeAt(this.map, cx, cy);
      if (sh) { const h = rayShape(sh, x0, y0, dx, dy); if (h === null || h > bestT) return false; t = h; } // angled/curved wall: only its solid part
      else if (cx === sx && cy === sy) return false;
      if (stopsBullet(tile) && tracerWall > 0 && tile !== T.VOID) { tracerWall--; mult *= this.pierceNow ? (pierced++ ? 1 : PIERCE_DMG) : 0.75; pens++; wallT = t; if (pens === 1) this.events.push({ e: 'hit', k: 'wall', x: r1(x0 + dx * t), y: r1(y0 + dy * t) }); return false; }
      if (src && src.pr >= 1 && underAt(this.map, k, tile)) return false; // lying down: shoots under the car / table it sees under
      if (stopsBullet(tile) && this.map.holes[k] && throughHole(this.map, k, x0, y0, dx, dy)) return false; // through a lance hole
      if (stopsBullet(tile)) { stopT = t; kind = tile === T.TALL ? 'prop' : 'hard'; best = null; return true; }
      if (penBullet(tile)) {
        if ((tile === T.SOFT || tile === T.BARRI) && HOLE_ONLY.has(cls)) this.holeCell(k, cx, cy, x0, y0, dx, dy, t);
        else this.damageCell(k, dmg * (tile === T.BARRI ? 0.35 : 0.6)); // a shotgun needs two blasts for a barricade
        if (tile === T.BARRI && !HOLE_ONLY.has(cls)) this.barriStage(k);
        if (tile === T.BARRI) this.barriShot(k, dmg * mult); // any bullets: 320 damage in all and the whole board goes
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
      if (this.hasShield(q) && !q.downed && q.ctrl === 'body' && !(this.time < (q.shieldDownUntil || 0))) {
        const pose = this.shieldOf(q), off = Math.abs(angDiff(Math.atan2(y0 - q.y, x0 - q.x), q.aim + pose.rot)), switching = q.switchUntil > this.time;
        if (!switching && (q.bracing ? off < pose.arc : !q.riot && Math.abs(angDiff(Math.atan2(y0 - q.y, x0 - q.x), q.aim)) > Math.PI - 0.8)) {
          this.events.push({ e: 'hit', k: 'shield', x: r1(ex), y: r1(ey) });
          if (q.riot && q.riotHp > 0 && (q.riotHp -= dmg) <= 0) { q.riotBroken = true; q.bracing = false; this.events.push({ e: 'snd', s: 'break', x: r1(q.x), y: r1(q.y) }); this.msg(`${q.name}'s shield cracked apart`, this.side(q)); } // GLASS GUARD
          return { x: ex, y: ey, k: 'shield' };
        }
      }
      if (src.ms) src.ms.hits++;
      this.lastHit = { q: q.id, src: src.id, pens, t: this.time }; // for the killcam's fairness check
      // headshot: the bullet passes through the very centre of the body — instant kill, no getting downed
      const at = best.at || q, cx = at.x - x0, cy = at.y - y0, miss = Math.abs(cx * dy - cy * dx);
      const W = this.shotW && this.shotW.cls === cls ? this.shotW : null, pellet = W ? W.pellets > 1 : cls === 'Shotgun';
      const F = W ? falloffOf(W) : FALLOFF[cls] || FALLOFF.AR, rm = this.rangeMul || 1, fo = { from: F.from * rm, to: F.to * rm, min: F.min };
      const fall = stopT <= fo.from ? 1 : stopT >= fo.to ? fo.min : 1 - (1 - fo.min) * (stopT - fo.from) / (fo.to - fo.from);
      const small = OPERATORS[q.op] && OPERATORS[q.op].ability.id === 'brace' ? 0.6 : 1; // BULWARK: a smaller head to hit (he asked); the shield still covers it from the front
      const sa = this.shotAim, head = miss < HEAD_R * small && (!sa || Math.hypot(sa.x - at.x, sa.y - at.y) <= HEAD_AIM * small);
      if (src && src.tracerUntil > this.time && this.side(q) !== this.side(src)) this.spot(this.side(src), q.id, 4); // MARK's tracer rounds
      this.shotPens = pens; // the death card says "through a wall"
      if (this.zb && q.zombie) { this.headshot = !!head; this.zbNeck = !head && miss < HEAD_R * 1.7; this.damage(q, dmg * mult * fall * (head ? ZB.headMul : this.zbNeck ? 1.5 : 1), src, wname, ang); this.headshot = false; this.zbNeck = false; } // ZOMBIES: the head takes more, never a one-shot
      else if (head && !q.downed && !pellet && !pens) { this.headshot = true; this.damage(q, 9999, src, wname, ang); this.headshot = false; }
      else if (head && (pellet || pens)) this.damage(q, dmg * mult * fall * 1.8, src, wname, ang); // a shotgun pellet to the head hurts more, but each one alone can't one-tap
      else if (W && W.oneShot && !q.downed && scopedIn(src) && !this.pierceNow && (!pens && mult >= 1 || W.wallShot && pens <= W.wallShot)) // the Mammoth: through one soft wall too
        this.damage(q, 9999, src, wname, ang); // he asked: the big sniper rifles still drop anyone with one clean body shot; then (a prism made it too strong) only aimed in through the sniper scope
      else this.damage(q, dmg * mult * fall, src, wname, ang);
      this.shotPens = 0;
      if (W && W.stagger && q.alive && !q.downed) this.effect(q, 'slow', W.stagger, src); // the Hedge knocks them off balance
    } else if (best && best.e && best.e.tu) { best.e.offUntil = Math.max(best.e.offUntil || 0, this.time + 8); this.events.push({ e: 'hit', k: 'spark', x: r1(ex), y: r1(ey) }); }
    else if (best && best.e) this.hitEnt(best.e, src);
    else if (kind === 'hard' || kind === 'prop') this.events.push({ e: 'hit', k: kind, x: r1(ex), y: r1(ey) });
    else if (kind === 'cover') { this.events.push({ e: 'hit', k: 'shield', x: r1(ex), y: r1(ey) }); const ce = this.ents.find(o => o.id === cov.s.id); if (ce) this.coverDamage(ce, dmg * 0.3); return { x: ex, y: ey, k: 'shield' }; }
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
    h.push(hx, hy); this.addHole(k, hx, hy);
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
  // Breakable floors (he asked 2026-11-10: every floor and ceiling but the roof and the lowest floor): a blast on an
  // upper floor opens a hatch-sized hole on the spot (shared/map.js floorSpot / addHatch). Returns the hatch or null.
  blowFloor(x, y) {
    if (this.map.hatches.some(h => Math.hypot(h.x - x, h.y - y) < CELL * 2.2)) return null; // right on a hatch: that hatch is what breaks
    const k0 = floorSpot(this.map, x, y); if (k0 < 0) return null;
    const h = addHatch(this.map, k0); this.breakHatch(h.id);
    return h;
  }
  // HOIST: where a grapple takes you, { x, y, roof } or null. Under an open hatch (within GRAPPLE_REACH of its middle):
  // the floor beside it upstairs. Outside on the ground facing a wall of the building: the roof right above, a step in.
  grappleTarget(p) {
    const m = this.map, W = m.W, fl = floorAt(m, p.x, p.y), free = (x, y) => { const k = Math.floor(y / CELL) * W + Math.floor(x / CELL); return [T.FLOOR, T.OPEN].includes(m.tiles[k]) && !(m.hatchAt[k] >= 0) && !circleBlocked(m, x, y, PLAYER_R, t => blocksMove(t) || t === T.HOLE); };
    for (const h of m.hatches) {
      if (h.peep || !hatchOpen(m, h) || floorAt(m, h.bx, h.by) !== fl || Math.hypot(h.bx - p.x, h.by - p.y) > GRAPPLE_REACH) continue;
      const a0 = Math.atan2(h.by - p.y, h.bx - p.x) + Math.PI; // land on the side you came from
      for (let i = 0; i < 8; i++) { const a = a0 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * Math.PI / 4, x = h.x + Math.cos(a) * CELL * 1.9, y = h.y + Math.sin(a) * CELL * 1.9; if (free(x, y)) return { x, y }; }
    }
    const here = Math.floor(p.y / CELL) * W + Math.floor(p.x / CELL);
    if (m.tiles[here] !== T.GROUND || fl !== m.groundFloor) return null;
    const f = this.facingCell(p, 30); if (!f || ![T.SOFT, T.HARD, T.REINF, T.BARRI].includes(f.t)) return null;
    const G = m.floors[fl], R = m.floors[m.roofFloor]; if (!R || !R.roof) return null;
    const dx = Math.cos(p.aim), dy = Math.sin(p.aim);
    for (let d = 0; d <= 5; d++) {
      const gx = f.cx + Math.round(dx * d), gy = f.cy + Math.round(dy * d), lx = gx - G.gx + G.x0 - R.x0, ly = gy + G.y0 - R.y0;
      if (lx < 0 || ly < 0 || lx >= R.w || ly >= R.h) continue;
      const k = ly * W + R.gx + lx; if (m.floor[k] !== FL.ROOF || m.tiles[k] !== T.FLOOR) continue;
      const x = (k % W + 0.5) * CELL + dx * CELL, y = (Math.floor(k / W) + 0.5) * CELL + dy * CELL;
      if (free(x, y)) return { x, y, roof: true };
    }
    return null;
  }
  // LOCKJAW: the shut hatch at your feet (on top) or right above you (underneath)
  hatchToRig(p) {
    const shut = h => h && !h.peep && !hatchOpen(this.map, h) && !this.ents.some(e => e.type === 'htrap' && e.rig === h.id);
    const near = hatchNear(this.map, p.x, p.y, p.aim, 20); if (shut(near)) return near;
    const fl = floorAt(this.map, p.x, p.y);
    return this.map.hatches.find(h => shut(h) && floorAt(this.map, h.bx, h.by) === fl && Math.hypot(h.bx - p.x, h.by - p.y) < GRAPPLE_REACH) || null;
  }
  // HOIST's climb: frozen on the line, then up; down or dead and it is over
  tickGrapple(p, dt) {
    const g = p.grapple; if (!g) return;
    if (!p.alive || p.downed || p.ctrl !== 'body') { p.grapple = null; return; }
    if ((g.t += dt) < g.dur) return;
    p.grapple = null; p.x = g.x; p.y = g.y; p.vx = p.vy = 0;
    this.events.push({ e: 'snd', s: 'land', x: r1(p.x), y: r1(p.y), id: p.id }); this.noise(p.x, p.y, this.side(p), 300);
  }
  // a charge set on the plain floor in front of you (upper floors only): { k, x, y, floor } like wallInFront, or null
  floorCharge(p) {
    const x = p.x + Math.cos(p.aim) * 28, y = p.y + Math.sin(p.aim) * 28, k0 = floorSpot(this.map, x, y); // a step in front: the hole must not open under your own feet
    if (k0 >= 0 && [k0, k0 + 1, k0 + this.map.W, k0 + this.map.W + 1].some(k => Math.hypot((k % this.map.W + 0.5) * CELL - p.x, (Math.floor(k / this.map.W) + 0.5) * CELL - p.y) < CELL / 2 + PLAYER_R + 2)) return null;
    return k0 < 0 ? null : { k: k0, x: (k0 % this.map.W + 1) * CELL, y: (Math.floor(k0 / this.map.W) + 1) * CELL, floor: true };
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
    if (!at || !at.up || this.map.tiles[at.h.cells[0]] === T.HOLE) return null;
    return { ...at, ad, ax, ay };
  }
  // Is the shooter's crosshair on a spot they see through an open hatch (hatchSight: the patch the opening shows, at
  // their stance)? { v (the view), x, y (that spot on the other floor) } or null.
  holeAim(p) {
    const sa = this.shotAim; if (!sa || sa.x === undefined || sa.x === null) return null;
    const stance = p.pr >= 1 ? 'prone' : p.input && p.input.crouch ? 'crouch' : 'stand';
    for (const h of this.map.hatches || []) {
      const v = hatchSight(this.map, h, p.x, p.y, stance); if (!v) continue;
      const x = sa.x + v.o.x, y = sa.y + v.o.y;
      if (canSee(this.map, v, x, y, this.smokeList())) return { v, x, y };
    }
    return null;
  }
  // The shot carries on from the opening on the other floor towards that spot, keeping its spread; it ends (for the
  // tracer) where it lands as seen from here.
  shotThroughHole(p, eye, ang, hole, range, dmg, wname, cls) {
    const { v, x, y } = hole, sa = this.shotAim, aimA = Math.atan2(sa.y - eye.y, sa.x - eye.x);
    const a2 = Math.atan2(y - v.y, x - v.x) + angDiff(ang, aimA);
    this.shotAim = { x, y }; this.fromAbove = true;
    const e = this.hitscan(p, v.x, v.y, a2, Math.min(range, Math.hypot(x - v.x, y - v.y) + 200), dmg, wname, cls);
    this.fromAbove = false; this.shotAim = sa;
    return { x: e.x - v.o.x, y: e.y - v.o.y, k: e.k };
  }
  // A shot out of an upper window (hitscan left this.winCarry where it left the window) carries on down on the ground
  // floor with what the boards left of it, from where the view down starts (windowFoot), towards the same aim point
  // (keeping the shot's spread), so bullets go where the view shows. The tracer ends where it lands as seen from up
  // here (the view down is drawn moved by the same offset).
  shotOutWindow(p, eye, ang, range, dmg, wname, cls) {
    const c = this.winCarry; this.winCarry = null;
    const f = floorAt(this.map, eye.x, eye.y), o = floorOff(this.map, f, this.map.groundFloor), sa = this.shotAim;
    const eis = this.map.roofEdgeAt && this.map.roofEdgeAt.get(c.k);
    let ei; // over the roof's edge: the edge (of the one or two this cell is on) the shot goes out over, if you can look down over it
    if (eis) { const vs = windowViews(this.map, eye.x, eye.y); ei = eis.filter(i => vs.some(v => v.e === i)).sort((a, b) => Math.abs(angDiff(ang, this.map.roofEdges[a].out)) - Math.abs(angDiff(ang, this.map.roofEdges[b].out)))[0]; }
    if (eis && ei === undefined) return { x: eye.x + Math.cos(ang) * c.t, y: eye.y + Math.sin(ang) * c.t, k: 'none' }; // off the roof from too far back: you can't see down, nor shoot down
    const r = ei !== undefined ? this.map.roofEdges[ei] : this.map.ropes.find(q => q.cells.includes(c.k)), ft = r && windowFoot(this.map, r);
    let x = eye.x + Math.cos(ang) * c.t + o.x, y = eye.y + Math.sin(ang) * c.t + o.y, a2 = ang;
    if (ft) {
      const tx = (sa && sa.x !== undefined && sa.x !== null ? sa.x : eye.x + Math.cos(ang) * 200) + o.x, ty = (sa && sa.y !== undefined && sa.y !== null ? sa.y : eye.y + Math.sin(ang) * 200) + o.y;
      const aimA = Math.atan2(ty - o.y - eye.y, tx - o.x - eye.x);
      x = ft.x; y = ft.y; a2 = Math.atan2(ty - y, tx - x) + angDiff(ang, aimA);
    }
    if (sa && sa.x !== undefined && sa.x !== null) this.shotAim = { x: sa.x + o.x, y: sa.y + o.y };
    this.fromAbove = true; // (a shot coming down from up there doesn't hit the outside camera's copy on the wall)
    const e = this.hitscan(p, x - Math.cos(a2) * 2, y - Math.sin(a2) * 2, a2, Math.min(WIN_RANGE + 40, range - c.t), dmg * c.mult, wname, cls);
    this.fromAbove = false;
    this.shotAim = sa;
    return { x: e.x - o.x, y: e.y - o.y, k: e.k };
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
    if (this.free && !q.bot && q.sock) return; // free play: god mode, nothing hurts you
    if (this.phase === PHASE.PREP && src && this.side(src) === this.side(q)) return; // no friendly fire (or hurting yourself) while setting up (he asked)
    if (this.tut && src && src.bot && !q.bot) return; // tutorial bots never hurt you (he asked)
    if (this.arena) { amount = arenaDamage(this, q, amount, src, wname); if (amount <= 0) return; }
    if (this.zb) { amount = zbDamage(this, q, amount, src, wname); if (amount <= 0) return; }
    amount = Math.round(amount);
    if (src && src.ms && src !== q && this.side(src) !== this.side(q)) src.ms.damage += Math.min(amount, Math.max(0, q.hp));
    if (src && src.sock) this.events.push({ e: 'hitmark', to: src.id, kill: false });
    this.events.push({ e: 'hit', k: 'blood', x: r1(q.x), y: r1(q.y), a: r2(ang || 0) });
    this.events.push({ e: 'hurt', id: q.id, from: src ? r2(Math.atan2(src.y - q.y, src.x - q.x)) : 0 });
    if (q.downed) return this.kill(q, src, wname);
    q.hp -= amount;
    if (q.hp <= 0) {
      const up = [...this.players.values()].filter(o => o.alive && !o.downed && this.side(o) === this.side(q)).length;
      if (this.zb ? zbCanGoDown(this, q) : !this.headshot && q.hp > -35 && up > 1 && this.phase === PHASE.ACTION && !this.arena) {
        q.downT = this.time; // (fun modes: no going down, straight out)
        if (src && src.ms && src !== q) src.ms.downs++;
        if (src && src !== q && this.side(src) !== this.side(q)) this.pts(src, 50, 'ENEMY DOWNED');
        q.downed = true; q.selfUp = 0; q.hp = DUR.bleedout; q.downedBy = src ? src.id : null; q.busy = null; q.ctrl = 'body';
        if (this.zb) zbDown(this, q); // ZOMBIES: last stand with a pistol, perks gone
        q.scanning = false; q.bracing = false; q.reloadT = 0; this.ropeFall(q);
        this.events.push({ e: 'down', id: q.id, by: src ? src.id : null, df: q.hasDefuser ? 1 : undefined });
        if (q.hasDefuser) this.dropDefuser(q);
      } else this.kill(q, src, wname);
    }
  }

  kill(q, src, wname) {
    if (!q.alive) return;
    this.ropeFall(q);
    if (src && src !== q) (this.lastDeath || (this.lastDeath = {}))[this.side(q)] = { x: q.x, y: q.y, t: this.time }; // defender bots rotate when someone falls on the site
    if (src && src !== q && src.squad !== q.squad) (this.proTrade || (this.proTrade = {}))[q.squad] = { x: q.x, y: q.y, from: { x: src.x, y: src.y }, t: this.time }; // the pros trade a teammate's death
    if (src && src !== q && this.side(src) !== this.side(q) && !q.zombie && !src.zombie) { // what the pros say about it: the one who died says who and where, the one who got the kill says so
      const nm = o => OPERATORS[o.op] ? OPERATORS[o.op].name[0] + OPERATORS[o.op].name.slice(1).toLowerCase() : 'someone', rm = (x, y) => (roomAt(this.map, x, y) || 'outside').replace(/^\dF /, '');
      const left = [...this.players.values()].filter(o => o.alive && o !== q && this.side(o) === this.side(q)).length;
      talk(this, q, 'dead', { op: nm(src), place: rm(src.x, src.y) });
      talk(this, src, left === 1 ? 'gotLast' : 'got', { op: nm(q) }, 'kill' + q.id);
      kindWords(this, q, src);
    }
    q.alive = false; q.downed = false; q.hp = 0; q.deaths++; q.busy = null; q.scanning = false; q.bracing = false;
    if (q.ctrl !== 'body') q.ctrl = 'body';
    if (src && src !== q && this.side(src) !== this.side(q)) { src.kills++; if (src.ms) { src.ms.kills++; this.opStat(src).kills++; } this.pts(src, this.headshot ? 120 : 100, this.headshot ? 'HEADSHOT KILL' : 'KILL'); }
    else if (src && src !== q) { src.kills--; this.pts(src, -50, 'TEAMKILL'); } // a teamkill costs you
    if (q.ms) { q.ms.deaths++; this.opStat(q).deaths++; }
    if (src && src.sock) this.events.push({ e: 'hitmark', to: src.id, kill: true });
    this.events.push({ e: 'kill', killer: src ? src.id : null, victim: q.id, w: wname || '', hs: this.headshot ? 1 : 0, df: q.hasDefuser ? 1 : undefined });
    if (q.hasDefuser) this.dropDefuser(q);
    if (q.sock && q.sock.open && !this.tv) try { this.sendKillcam(q, src, wname); } catch (err) { console.log('killcam:', err.message); }
    if (this.tv && this.tv.socks.size && src && src !== q) this.tvKill(q, src, wname);
    const d = this.ent(q.droneId); if (d && this.phase === PHASE.PREP) this.removeEnt(d);
    if (this.arena) arenaKill(this, q, src, wname);
    if (this.zb) zbKill(this, q, src, wname);
  }

  // he asked: when the carrier goes down the defuser falls where everyone can tell; defenders are told too and see where
  // it lies (defending is denying the plant), like R6
  addHole(k, x, y) { this.newHoles.push(k, x, y); if (this.by) this.holeBy.set(k, this.by); }

  dropDefuser(p) {
    p.hasDefuser = false;
    this.ents.push({ id: this.eid(), type: 'defuser', x: p.x, y: p.y, team: TEAM.ATK });
    this.msg(`${p.name} dropped the defuser`, TEAM.ATK);
    this.msg('The attackers dropped the defuser! Keep them off it', TEAM.DEF);
    this.events.push({ e: 'defdrop', x: r1(p.x), y: r1(p.y) });
  }

  hitEnt(e, src) {
    if (e.shieldUntil > this.time) { this.events.push({ e: 'hit', k: 'shield', x: r1(e.x), y: r1(e.y) }); return; } // TETHER's scope: shielded for its first 3 s
    if (src && e.team && e.team !== this.side(src) && (e.hp || e.type === 'drone')) this.pts(src, e.type === 'drone' ? 20 : 25, e.type === 'drone' ? 'DRONE DESTROYED' : e.type === 'bird' ? 'BIRD DESTROYED' : e.type === 'cam' ? 'CAMERA DESTROYED' : 'GADGET DESTROYED');
    if (e.type === 'cam') { e.hp = 0; this.events.push({ e: 'hit', k: 'spark', x: r1(e.x), y: r1(e.y) }); this.events.push({ e: 'snd', s: 'break', x: r1(e.x), y: r1(e.y) }); return; }
    this.events.push({ e: 'hit', k: 'spark', x: r1(e.x), y: r1(e.y) });
    this.events.push({ e: 'snd', s: 'break', x: r1(e.x), y: r1(e.y) });
    this.removeEnt(e);
    if (e.type === 'drone' || e.type === 'bird') this.droneLost(e, src);
  }

  // a drone has 1 hp: one bullet, hit, blast or zap and it's gone; its pilot drops back into their body
  droneLost(e, src) {
    const o = this.players.get(e.owner);
    if (!o) return;
    if (this.tv) this.events.push({ e: 'dlost', id: o.id, by: src && src.id }); // Esports TV: the director cuts away (tvDirector)
    if (o.droneId === e.id) {
      o.droneId = null;
      if (o.ctrl === 'drone') { o.ctrl = 'body'; const list = o.staged ? this.feeds(this.side(o)) : []; if (list.length) this.watch(o, list[0]); }
    }
    this.msg(`${o.name}'s ${e.type === 'bird' ? 'bird' : 'drone'} was destroyed`, e.team);
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
        return { k: 'revive', t: 0, dur: DUR.revive * (this.zb ? zbReviveTime(this, p) : 1), target: q.id };
    if (team === TEAM.DEF && (this.phase === PHASE.PREP || this.phase === PHASE.ACTION)) {
      const f = this.facingCell(p, 28); // the same reach as the on-screen prompt
      if (f && f.t === T.SOFT && this.reinforce > 0) return { k: 'reinforce', t: 0, dur: DUR.reinforce * (p.op === 'girder' ? 0.5 : 1), cell: f.k };
      if (f && f.t === T.OPEN && this.map.openId[f.k] >= 0 && p.barri > 0 && this.canBarricade(this.map.openId[f.k])) return { k: 'barricade', t: 0, dur: DUR.barricade, cell: f.k };
      const under = hatchAtPoint(this.map, p.x, p.y), h = under && !under.up && under.h.roof ? under.h : hatchNear(this.map, p.x, p.y, p.aim, 14); // (a roof hatch from the room below: defenders can't get up there)
      if (h && this.map.tiles[h.cells[0]] === T.HATCH && this.reinforce > 0) return { k: 'reinforce', t: 0, dur: DUR.reinforce * (p.op === 'girder' ? 0.5 : 1), hatch: h.id };
    }
    return null;
  }

  continueInteract(p, dt) {
    const b = p.busy;
    if (b.k === 'revive') {
      const q = this.players.get(b.target);
      if (!q || !q.alive || !q.downed || Math.hypot(q.x - p.x, q.y - p.y) > 44) { p.busy = null; return; }
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
      q.downed = false; q.hp = 25; if (this.zb) zbUp(this, q); if (p.ms) p.ms.revives++; this.pts(p, 75, 'REVIVE'); this.events.push({ e: 'snd', s: 'revive', x: r1(q.x), y: r1(q.y) });
    } else if (b.k === 'reinforce' && b.hatch !== undefined) {
      if (this.map.tiles[this.map.hatches[b.hatch].cells[0]] === T.HATCH && this.reinforce > 0) { this.reinforceHatch(b.hatch); this.reinforce--; this.pts(p, 15, 'HATCH REINFORCED'); }
    } else if (b.k === 'reinforce') {
      if (this.map.tiles[b.cell] === T.SOFT && this.reinforce > 0) { this.reinforceWall(b.cell); this.reinforce--; this.pts(p, 15, 'WALL REINFORCED'); if (this.tut && !p.bot) this.tut.info.reinf++; }
    } else if (b.k === 'barricade') {
      if (p.barri > 0 && this.barricade(this.map.openId[b.cell], T.BARRI)) { p.barri--; this.pts(p, 5, 'BARRICADE'); if (this.tut && !p.bot) this.tut.info.barri++; }
    }
  }

  // the shield's pose right now (shieldPose in shared/operators.js); the drawing uses the same rule from the snapshot
  shieldOf(q) { return shieldPose(q.gait, q.moving >= 2, false, this.time < (q.shieldDownUntil || 0), q.aside || 0, riotArc(q.riot, q.input && q.input.crouch, !q.moving)); }
  hasShield(q) { return OPERATORS[q.op].ability.id === 'brace' || (!!q.riot && !q.riotBroken); } // BULWARK, or a riot shield that hasn't cracked

  // ---------------- rappelling (he asked: attackers need a quicker way up; see addRopes in shared/map.js) ----------------
  // p.rope = { st: 'move' | 'hang', r: the window you hang at (-1 = none), from, to (-1 = the ground), t, dur, base }
  tickRope(p, dt) {
    const inp = p.input || {}, prev = p.prevInput || {}, edge = k => inp[k] && !prev[k], R = this.map.ropes || [];
    if (!inp.interact) p.ropeHeld = false; // E that started or ended a climb doesn't also start something else
    if (!p.rope) {
      if (!edge('interact') || this.phase !== PHASE.ACTION || this.side(p) !== TEAM.ATK || p.ctrl !== 'body' || p.downed || p.busy || p.vault || !p.alive) return;
      if ([...this.players.values()].some(q => q !== p && q.alive && q.downed && this.side(q) === TEAM.ATK && Math.hypot(q.x - p.x, q.y - p.y) < 26)) return; // E next to a downed teammate revives, never climbs
      const top = roofRopeAt(this.map, p.x, p.y);
      if (top) { p.rope = { st: 'move', r: -1, from: -2, to: top.i, s: 0, t: 0, dur: ROPE_DROP, top: { x: p.x, y: p.y } }; p.ropeHeld = true; p.reloadT = 0; p.adsT = 0; p.burst = 0; this.events.push({ e: 'snd', s: 'rope', x: r1(p.x), y: r1(p.y), id: p.id }); return; }
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
      let r = R[o.r];
      { // sliding past the end of this stretch of wall carries on along the next (he asked: any outside wall)
        const mx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0), my = (inp.down ? 1 : 0) - (inp.up ? 1 : 0), c = Math.cos(inp.rot || 0), sn = Math.sin(inp.rot || 0);
        const along = isFinite(inp.rw) && inp.rw ? Math.sign(inp.rw) : (mx * c - my * sn) * r.tx + (mx * sn + my * c) * r.ty, s = ropeS(r, p.x, p.y);
        const q = along > 0 && s >= r.b - 1.5 && r.right !== undefined ? R[r.right] : along < 0 && s <= r.a + 1.5 && r.left !== undefined ? R[r.left] : null;
        if (q) { const s2 = Math.max(q.a, Math.min(q.b, r.ax * CELL + s - q.ax * CELL)); p.x = q.hang.x + q.tx * s2; p.y = q.hang.y + q.ty * s2; o.r = q.i; r = q; }
      }
      if (edge('inv')) { o.inv = !o.inv; this.events.push({ e: 'snd', s: 'rope', x: r1(p.x), y: r1(p.y), id: p.id }); } // upside down (R6: peek over the top of a window)
      if (inp.rv > 0 && !(prev.rv > 0)) { o.inv = false; this.ropeUp(p, r); return; } // the 3D view's W: up a floor (or onto the roof)
      if (inp.rv < 0 && !(prev.rv < 0) && r.down >= 0) { o.inv = false; this.ropeHop(p, r, R[r.down], ROPE_DROP); return; } // S: down a floor
      if (edge('sprint')) { this.ropeUp(p, r); return; }
      if (edge('interact') && r.down >= 0) { this.ropeHop(p, r, R[r.down], ROPE_DROP); p.ropeHeld = true; return; } // down to the window below
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
  // from one window to the next on the same wall, keeping your place along it
  ropeHop(p, r, q, dur) {
    const s = Math.max(q.a, Math.min(q.b, r.ax * CELL + ropeS(r, p.x, p.y) - q.ax * CELL));
    p.rope = { st: 'move', r: -1, from: -2, to: q.i, s, t: 0, dur, top: { x: p.x, y: p.y } }; p.adsT = 0; p.burst = 0;
    this.noise(p.x, p.y, this.side(p), 260); this.events.push({ e: 'snd', s: 'rope', x: r1(p.x), y: r1(p.y), id: p.id });
  }
  // up one stop: the next window, or over the edge onto the roof
  ropeUp(p, r) {
    if (r.up >= 0) { const q = this.map.ropes[r.up]; this.ropeHop(p, r, q, ROPE_CLIMB * (q.lvl - r.lvl)); return true; }
    if (!r.roof) return false;
    p.rope = { st: 'move', r: -1, from: -2, to: -1, t: 0, dur: ROPE_CLIMB * 0.6, base: r.roof, top: { x: p.x, y: p.y }, climb: 1 }; p.adsT = 0; p.burst = 0;
    this.noise(p.x, p.y, this.side(p), 260); this.events.push({ e: 'snd', s: 'rope', x: r1(p.x), y: r1(p.y), id: p.id });
    return true;
  }
  // shot off the rope: down on the ground below it
  ropeFall(p) {
    if (!p.rope) return;
    const r = p.rope.st === 'hang' && this.map.ropes[p.rope.r], g = r ? ropeGround(this.map, r, ropeS(r, p.x, p.y)) : p.rope.base;
    p.x = g.x; p.y = g.y; p.vx = p.vy = 0; p.rope = null;
  }

  // Vault over the low thing in front of you (toward ang: where you're moving, else where you look).
  startVault(p, ang) {
    if (p.rope) { // hanging outside a window: climb in, swinging through wooden boards (he chose); never up to the roof
      const r = p.rope.st === 'hang' && this.map.ropes[p.rope.r];
      if (!r || p.downed || !ropeAtWindow(r, p.x, p.y)) return false;
      const smash = !ropeWindowOpen(this.map, r);
      if (smash && !ropeWindowBoarded(this.map, r)) return false; // reinforced or blocked: no way in here
      if (smash) { for (const k of r.cells) if (this.map.tiles[k] === T.BARRI) this.destroyCell(k); this.noise(p.x, p.y, this.side(p), 700); }
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
    if (this.zb && zbBlocksVault(this, p, to)) return false; // ZOMBIES: people can't climb out of the windows
    const d = Math.hypot(to.x - p.x, to.y - p.y);
    p.vault = { x0: p.x, y0: p.y, x1: to.x, y1: to.y, t: 0, dur: VAULT_TIME * (0.8 + 0.2 * d / 40) };
    p.reloadT = 0; p.adsT = 0; p.scanning = false; p.bracing = false;
    this.noise(p.x, p.y, this.side(p), 320);
    this.events.push({ e: 'snd', s: 'vault', x: r1(p.x), y: r1(p.y), id: p.id });
    return true;
  }

  facingCell(p, reach) { return facingCell(this.map, p.x, p.y, p.aim, reach); }

  // he asked: a smaller patch per reinforcement (was 5 cells, 2.2 m): the cell + REINF_HALF each side = 3 cells, 1.3 m
  reinforceWall(k) {
    const m = this.map, W = m.W, x = k % W, y = Math.floor(k / W);
    const isW = (cx, cy) => { const t = tileAt(m, cx, cy); return t === T.SOFT || t === T.REINF || t === T.HARD; };
    const horiz = (isW(x - 1, y) || isW(x + 1, y)) && !(isW(x, y - 1) && isW(x, y + 1));
    const cells = [k];
    for (const s of [-1, 1]) for (let i = 1; i <= REINF_HALF; i++) {
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
    // he asked: defenders may walk outside in preparation (no wall keeping them in), so outside DOORS start open; windows stay boarded
    for (const o of m.openings) if (o.kind === 'window' && o.cells.every(c => m.tiles[c] === T.OPEN)) this.barricade(o.id, T.BARRI, true);
  }

  // he asked: bullets wear a planked door or window right down: 320 damage of bullets in all breaks the whole board
  barriShot(k, dmg) {
    if (this.zb) return; // ZOMBIES: the window boards only come off to zombies
    const id = this.map.openId[k]; if (id < 0 || id === undefined) return;
    const D = this.map.barriDmg || (this.map.barriDmg = {});
    if ((D[id] = (D[id] || 0) + dmg) >= BARRI_BULLET_HP) { delete D[id]; this.destroyCell(k); }
    else this.barriStage(k);
  }

  // Three stages (he asked): a small hole, a bigger hole, then the whole board goes. The holes are a cross of see-through
  // points round the middle of the cell that was hit, so sight, shots and drawing all use the ordinary hole rules.
  barriStage(k) {
    const m = this.map; if (m.tiles[k] !== T.BARRI) return;
    const id = m.openId[k], worn = id >= 0 && m.barriDmg ? (m.barriDmg[id] || 0) / BARRI_BULLET_HP : 0, left = Math.min(m.hp[k] / CELL_HP[T.BARRI], 1 - worn);
    const reach = left <= 0.34 ? 6 : left <= 0.67 ? 2 : 0; if (!reach) return;
    const cx = r1((k % m.W + 0.5) * CELL), cy = r1((Math.floor(k / m.W) + 0.5) * CELL), h = m.holes[k] || (m.holes[k] = []);
    for (let d = -reach; d <= reach; d += 2) for (const [x, y] of [[cx + d, cy], [cx, cy + d]]) {
      let has = false; for (let i = 0; i < h.length; i += 2) if (h[i] === x && h[i + 1] === y) has = true;
      if (!has) { h.push(x, y); this.addHole(k, x, y); }
    }
    this.changed.add(k);
  }

  // A melee hit on a barricade: three break it (the whole board across the doorway or window, like R6)
  barriHit(k) {
    if (this.zb) return;
    const o = this.map.openings[this.map.openId[k]], cells = o ? o.cells.filter(c => this.map.tiles[c] === T.BARRI) : [k];
    for (const c of cells) { this.map.hp[c] -= CELL_HP[T.BARRI] / 3 + 0.01; this.changed.add(c); }
    if (cells.some(c => this.map.hp[c] <= 0)) for (const c of cells) this.destroyCell(c);
    else this.barriStage(k);
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
    if (this.map.barriDmg) delete this.map.barriDmg[openingId]; // fresh boards
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
    if (p.staged && ['vault', 'melee', 'ability', 'gadget', 'reload'].includes(e.k)) return; // not on the map yet (he noticed shots before spawning)
    if ((this.arena || this.zb) && !(this.zb && e.k === 'gadget' && p.gadget === 'frag') && ['ability', 'gadget', 'drone', 'feeds', 'view', 'camNext', 'camPrev', 'camSet'].includes(e.k)) return; // fun modes: guns and knives only
    switch (e.k) {
      case 'vault': this.startVault(p, typeof e.a === 'number' && isFinite(e.a) ? e.a : p.aim); break;
      case 'reload': if ((!p.downed || this.zb) && p.ctrl === 'body') this.startReload(p); else this.birdAuto(p); break; // on a landed bird: AUTO on/off
      case 'slot': if (!p.downed && p.guns[e.n] && e.n !== p.slot) { p.slot = e.n; p.reloadT = 0; p.fireCd = 0.35; this.events.push({ e: 'snd', s: 'swap', x: r1(p.x), y: r1(p.y), id: p.id }); } break;
      case 'melee': this.melee(p); break;
      case 'ability': if (!p.downed && p.ctrl === 'drone' && OPERATORS[p.op].ability.id === 'swarm') { const b = this.ent(p.droneId); if (b && b.type === 'bird') this.releaseSwarm(p, b); break; } // MAGPIE: a swarm from her bird
        if (!p.downed && p.ctrl === 'body' && !p.busy && !p.rope && !(this.time < (p.empUntil || 0))) this.startUse(p, 'ability'); break;
      case 'gadget': if (!p.downed && p.ctrl === 'body' && !p.busy && !p.rope && !(this.time < (p.empUntil || 0))) this.startUse(p, 'gadget'); break;
      case 'view': this.toggleView(p); break; // controller / touch: drone or cameras, one button
      case 'feeds': this.openFeeds(p); break; // 5
      case 'drone': this.droneKey(p); break; // 6
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
        const pk = PING_KINDS.has(e.pk) ? e.pk : undefined;
        this.mark(p, x, y, w, typeof e.id === 'string' || typeof e.id === 'number' ? e.id : null, pk);
        if (pk) botPing(this, p, pk, x, y);
        { // points for pinging something worth knowing (a gadget, camera, drone, the objective...), once per thing a round
          const key = e.id != null ? 'e' + e.id : w + '@' + (roomAt(this.map, x, y) || Math.round(x / 80) + ',' + Math.round(y / 80)), worth = !pk && !/^(GO|LOOK) HERE/.test(w);
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
      if (p.ctrl === 'cam' || p.ctrl === 'drone') { p.ctrl = 'body'; return; } // (a defender 'drone' is MAGPIE's bird)
      if (p.ctrl !== 'body' || p.busy) return;
      const list = this.feeds(team);
      if (list.length) this.watch(p, list.find(f => f.id === p.feedId) || list[0]);
    }
  }

  // 5 (he asked): just look through the team's drones and cameras; your own drone you drive, others' you only watch.
  // Never puts a drone out (that is 6). Again: back to your body.
  openFeeds(p) {
    if (p.downed) return;
    const team = this.side(p), own = this.ent(p.droneId), list = this.feeds(team);
    if (team === TEAM.ATK && this.phase === PHASE.PREP) { // attackers are on their drones all preparation: flip between own and team feeds
      if (p.ctrl === 'cam' && own) this.watch(p, own); else if (p.ctrl === 'drone') this.cycleCam(p, 1);
      return;
    }
    if (p.ctrl === 'drone' || p.ctrl === 'cam') { p.ctrl = 'body'; return; }
    if (p.ctrl !== 'body' || p.busy || !list.length) return;
    this.watch(p, list.find(f => f.id === p.feedId) || (own && list.includes(own) ? own : list[0]));
  }
  // 6 (he asked): put out your own drone and drive it (or take it back if it is already out); again: back to your body
  droneKey(p) {
    if (p.downed || this.side(p) !== TEAM.ATK) return;
    const own = this.ent(p.droneId);
    if (this.phase === PHASE.PREP) { if (p.ctrl === 'cam' && own) this.watch(p, own); return; }
    if (p.ctrl === 'drone') { p.ctrl = 'body'; return; }
    if (p.ctrl === 'cam') { if (own) { this.watch(p, own); return; } p.ctrl = 'body'; }
    if (p.ctrl !== 'body' || p.busy) return;
    if (!own && p.drones > 0) this.toggleView(p); else if (own) this.watch(p, own);
  }

  // Everything a team can look through, flipped through with left/right or the mouse wheel:
  // defence every working camera (map, turret, sticky); attack every drone and wall scope.
  // in groups (he asked): indoor map cameras, outdoor cameras, drones, then utility (gadget cameras, scopes, birds); flipping goes through them in that order
  feeds(team) {
    const grp = e => e.type === 'cam' && !e.owner ? (e.oc !== undefined ? 1 : 0) : e.type === 'drone' ? 2 : 3;
    return this.ents.filter(e => e.team === team && (team === TEAM.DEF ? (e.type === 'cam' && e.hp > 0) || e.type === 'scope' || e.type === 'bird' : e.type === 'drone' || e.type === 'scope'))
      .map((e, i) => [grp(e), i, e]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]);
  }
  feed(p) { const f = this.ent(p.feedId); return f && this.feeds(this.side(p)).includes(f) ? f : null; }
  // only the one who placed a gadget camera can turn it or fire its laser; map cameras are anyone's
  operates(p, c) { return c.type === 'cam' && (!c.owner || c.owner === p.id); }
  // look through a feed: your own drone you drive, anything else you only watch (and mark from)
  watch(p, f) {
    if (f.type === 'drone' && f.id === p.droneId) { p.ctrl = 'drone'; return; }
    if (f.type === 'bird' && f.owner === p.id) { p.droneId = f.id; p.ctrl = 'drone'; return; } // MAGPIE flies her own birds
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
    if (p.lungeUntil > this.time && this.time >= (p.lungeReady || 0) && !p.bracing && !p.rope) { this.lunge(p); return; }
    if (p.bracing) { // shield bash: staggers whoever it hits; a miss leaves the shield down for a while
      const q = [...this.players.values()].find(q => q.alive && q !== p && Math.hypot(q.x - p.x, q.y - p.y) < 34 && Math.abs(angDiff(Math.atan2(q.y - p.y, q.x - p.x), p.aim)) < 1.0);
      const R = RIOT[p.riot] || { bash: 30, stagger: 1.0, miss: 1.2 }; // BULWARK (no riot shield): stagger was 0.7 (attackers' skills stronger, 2026-11-10)
      if (R.cd && this.time < (p.bashReady || 0)) { p.meleeCd = 0; return; } // THORN: the studs are still charging
      if (q) { this.damage(q, R.bash, p, 'Shield Bash', p.aim); q.staggerUntil = this.time + R.stagger; this.effect(q, 'slow', 1, p); if (R.stun) this.effect(q, 'stun', R.stun, p); if (R.cd) p.bashReady = this.time + R.cd; p.meleeCd = 0.8; }
      else { // into a barricade or a wall: the shield's edge works like a swing (the RAM smashes a whole barricade at once)
        const f = this.facingCell(p, 22);
        if (f && f.t === T.BARRI) { for (let i = 0; i < (R.breaks ? 3 : 1); i++) if (this.map.tiles[f.k] === T.BARRI) this.barriHit(f.k); this.events.push({ e: 'hit', k: 'wood', x: r1((f.cx + 0.5) * CELL), y: r1((f.cy + 0.5) * CELL) }); p.meleeCd = 0.9; }
        else if (f && f.t === T.SOFT) { this.damageCell(f.k, 25); this.events.push({ e: 'hit', k: 'wall', x: r1((f.cx + 0.5) * CELL), y: r1((f.cy + 0.5) * CELL) }); p.meleeCd = 0.9; }
        else { p.meleeCd = 1.4; p.shieldDownUntil = this.time + R.miss; }
      }
      return;
    }
    for (const q of this.players.values()) {
      if (!q.alive || q === p) continue; // friendly fire: a swing hits teammates too
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < 28 && Math.abs(angDiff(Math.atan2(q.y - p.y, q.x - p.x), p.aim)) < 1.1 && los(this.map, p.x, p.y, q.x, q.y)) {
        // hitting a shield from the front knocks it aside for a moment instead of hurting
        if (this.hasShield(q) && !q.downed && q.ctrl === 'body' && Math.abs(angDiff(Math.atan2(p.y - q.y, p.x - q.x), q.aim)) < 0.8 && !(this.time < (q.shieldDownUntil || 0))) {
          q.shieldDownUntil = this.time + 1.0; p.meleeCd = 1.3; p.fireCd = Math.max(p.fireCd, 0.9); this.events.push({ e: 'hit', k: 'shield', x: r1(q.x), y: r1(q.y) }); this.events.push({ e: 'snd', s: 'panel', x: r1(q.x), y: r1(q.y) }); return;
        }
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
    if (id === 'sticky') { // SALVO (he asked: remote detonation): with rounds stuck and waiting, the button blows them all
      const waiting = this.ents.filter(e => e.type === 'sticky' && e.owner === p.id && e.stuck);
      if (waiting.length) { waiting.forEach((e, i) => { e.t = 0.05 + i * 0.08; e.go = true; }); this.events.push({ e: 'snd', s: 'swap', x: r1(p.x), y: r1(p.y), id: p.id }); return; }
    }
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
      const w = this.wallInFront(p, [T.SOFT, T.REINF, T.BARRI, T.PANEL, T.DSHIELD]) || this.hatchSpot(p, [T.HATCH, T.HATCHR]) || (!p.bot && this.floorCharge(p));
      if (!w) return;
      this.ents.push({ id: this.eid(), type: 'cutter', x: w.x, y: w.y, cell: w.k, hatch: w.hatch, floor: w.floor, team, owner: p.id, t: 5, hp: 1 });
      used(); this.events.push({ e: 'snd', s: 'place', x: r1(w.x), y: r1(w.y) });
    } else if (id === 'dart') {
      // thrown (he asked): it flies toward the crosshair a little off (±0.1 rad, about half a metre at 5 m, and
      // ±10% in distance, up to DART_MAX) and sticks in the first wall it meets; it only works once it has landed
      const tx = p.aimX ?? p.x + ca * 200, ty = p.aimY ?? p.y + sa * 200;
      const a = p.aim + (Math.random() + Math.random() - 1) * 0.1, go = Math.max(30, Math.min(DART_MAX, Math.hypot(tx - p.x, ty - p.y))) * (0.9 + Math.random() * 0.2);
      this.ents.push({ id: this.eid(), type: 'dart', x: p.x + Math.cos(a) * 8, y: p.y + Math.sin(a) * 8, ang: a, fly: go - 8, team, owner: p.id, life: 10, ping: 0, hp: 1 });
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
      this.ents.push({ id: this.eid(), type: 'mine', x: p.x + Math.cos(p.aim) * 10, y: p.y + Math.sin(p.aim) * 10, ang: p.aim, team, owner: p.id, arm: DUR.trapArm, hp: 1 });
      used(); this.events.push({ e: 'snd', s: 'place', x: r1(p.x), y: r1(p.y) });
    } else if (id === 'barrage') { // HAZE: a thin wall of smoke across your aim (he asked: much thinner than VAPOR's cloud)
      const want = Math.hypot((p.aimX ?? p.x + ca * 150) - p.x, (p.aimY ?? p.y + sa * 150) - p.y);
      const d = Math.max(40, Math.min(300, want, castSight(this.map, p.x, p.y, p.aim, 300, null) - 12));
      const cx = p.x + ca * d, cy = p.y + sa * d, puffs = [r1(cx), r1(cy)];
      for (const side of [1, -1]) for (let o = 10; o <= 108; o += 10) { // out to each side until a wall stops it
        const x = cx - sa * o * side, y = cy + ca * o * side;
        if (pointSolid(this.map, x, y, blocksSight)) break;
        puffs.push(r1(x), r1(y));
      }
      this.ents.push({ id: this.eid(), type: 'smoke', x: cx, y: cy, r: 12, life: 12, team, kind: 'wall', puffs });
      used(); this.events.push({ e: 'snd', s: 'smoke', x: r1(cx), y: r1(cy) });
    } else if (id === 'sonar' || id === 'stickycam') { this.throwNade(p, id === 'sonar' ? 'sonar' : 'cam'); used(); }
    else if (id === 'gas') { p.gasId = this.throwNade(p, 'gas').id; used(); }
    else if (id === 'adrenal') { p.boostUntil = this.time + 6; used(); this.events.push({ e: 'stim', x: r1(p.x), y: r1(p.y), x2: r1(p.x), y2: r1(p.y) }); }
    else if (id === 'ghost') { p.ghostUntil = this.time + 6; used(); this.events.push({ e: 'snd', s: 'ghost', x: r1(p.x), y: r1(p.y) }); }
    else if (id === 'cluster') {
      const w = this.wallInFront(p, [T.SOFT, T.BARRI]); if (!w) return;
      const t = through(w);
      this.ents.push({ id: this.eid(), type: 'cluster', x: w.x, y: w.y, cell: w.k, dx: t.dx, dy: t.dy, team, owner: p.id, t: 3, hp: 1 });
      used(); this.events.push({ e: 'snd', s: 'place', x: r1(w.x), y: r1(w.y) });
    } else if (id === 'scope') {
      const w = this.wallInFront(p, [T.SOFT]); if (!w) return;
      const t = through(w);
      this.ents.push({ id: this.eid(), type: 'scope', x: t.x, y: t.y, ang: Math.atan2(t.dy, t.dx), cell: w.k, team, owner: p.id, hp: 1, shieldUntil: this.time + 3 });
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
      if (hitQ) { this.damage(hitQ, 15, p, 'Arc Gun', p.aim); this.effect(hitQ, 'stun', 0.5, p); }
      used(); this.events.push({ e: 'arc', v: 1, x: r1(p.x), y: r1(p.y), x2: r1(p.x + ca * bt), y2: r1(p.y + sa * bt) }); // v: VOLT's, the quiet one
    } else if (id === 'hammer') { // he asked: only door and window barricades go in one swing (no soft walls), and a real wait between swings
      if (p.meleeCd > 0 || this.time < (p.hammerCd || 0)) return;
      const f = this.facingCell(p, 30), hs = !f || ![T.BARRI, T.BEAM, T.DSHIELD].includes(f.t) ? this.hatchSpot(p, [T.HATCH]) : null;
      if (f && [T.BARRI, T.BEAM, T.DSHIELD].includes(f.t)) { // a barricade, steel brace or deployable shield: gone in one swing
        const across = Math.abs(ca) > Math.abs(sa) ? [0, 1] : [1, 0];
        for (const d of [0, 1, -1]) {
          const k = (f.cy + across[1] * d) * this.map.W + f.cx + across[0] * d, t = this.map.tiles[k];
          if (t === f.t) this.destroyCell(k);
        }
        this.events.push({ e: 'hit', k: f.t === T.BARRI ? 'wood' : 'spark', x: r1((f.cx + 0.5) * CELL), y: r1((f.cy + 0.5) * CELL) });
        this.events.push({ e: 'snd', s: 'break', x: r1(p.x), y: r1(p.y) });
      } else if (hs) { // an unreinforced floor hatch at your feet: smashed through in one swing
        this.destroyCell(hs.k);
        this.events.push({ e: 'hit', k: 'wood', x: r1(hs.x), y: r1(hs.y) }); this.events.push({ e: 'snd', s: 'break', x: r1(p.x), y: r1(p.y) });
      } else {
        const q = [...this.players.values()].find(q => q.alive && q !== p && Math.hypot(q.x - p.x, q.y - p.y) < 30 &&
          Math.abs(angDiff(Math.atan2(q.y - p.y, q.x - p.x), p.aim)) < 1.1);
        if (!q) return;
        this.damage(q, 75, p, 'Breaching Hammer', p.aim);
      }
      p.meleeCd = 0.9; p.hammerCd = this.time + HAMMER_CD; used(); this.events.push({ e: 'melee', id: p.id });
    } else if (id === 'prox') place('prox', 10, { arm: DUR.trapArm });
    else if (id === 'concuss') place('concuss', 10, { arm: DUR.trapArm });
    else if (id === 'clamp') place('clamp', 14, { arm: DUR.trapArm });
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
      this.ents.push({ id: this.eid(), type: 'sticky', x: p.x + ca * 12, y: p.y + sa * 12, vx: ca * 560, vy: sa * 560, team, owner: p.id, travel: 0, t: 0 });
      used(); this.events.push({ e: 'snd', s: 'launcher', x: r1(p.x), y: r1(p.y) });
    } else if (id === 'saw') { // TORQUE (he asked for a usable breacher): a spinning disc that slits soft walls and barricades
      this.ents.push({ id: this.eid(), type: 'saw', x: p.x + ca * 12, y: p.y + sa * 12, vx: ca * 700, vy: sa * 700, ang: p.aim, team, owner: p.id, travel: 0, cut: [] });
      used(); this.events.push({ e: 'snd', s: 'launcher', x: r1(p.x), y: r1(p.y) });
    } else if (id === 'dash') { if (this.dash(p)) used(); }
    else if (id === 'lunge') { // CROW (he asked): pick the one enemy you're aiming at, within LUNGE_M; they hear the blade come out and
      // get a warning, and only after 1.5 s can you lunge at them (melee), for 5 s
      if (p.lungeUntil > this.time) return;
      const t = [...this.players.values()].filter(q => q.alive && !q.downed && this.side(q) !== this.side(p) && Math.hypot(q.x - p.x, q.y - p.y) < LUNGE_M * PX_PER_M
        && Math.abs(angDiff(Math.atan2(q.y - p.y, q.x - p.x), p.aim)) < 0.3 && los(this.map, p.x, p.y, q.x, q.y)).sort((a, b) => Math.abs(angDiff(Math.atan2(a.y - p.y, a.x - p.x), p.aim)) - Math.abs(angDiff(Math.atan2(b.y - p.y, b.x - p.x), p.aim)))[0];
      if (!t) { this.events.push({ e: 'deny', id: p.id, why: 'Aim at an enemy within ' + LUNGE_M + ' m to mark them for a lunge' }); return; }
      p.lungeTarget = t.id; p.lungeReady = this.time + LUNGE_WIND; p.lungeUntil = this.time + LUNGE_WIND + 5; used();
      this.events.push({ e: 'snd', s: 'unsheathe', x: r1(p.x), y: r1(p.y), id: p.id });
      this.events.push({ e: 'lungeWarn', id: t.id, from: p.id });
    }
    else if (id === 'flare' || id === 'medkit' || id === 'echobox') { this.throwNade(p, id); used(); }
    else if (id === 'spike') place('spike', 10, { life: 15, t: 0, pingT: 0 });
    else if (id === 'drill') { // GIMLET (he asked: a peephole through any floor or ceiling): crouched = the floor, standing = the ceiling
      const x = p.x + Math.cos(p.aim) * 10, y = p.y + Math.sin(p.aim) * 10, here = Math.floor(y / CELL) * this.map.W + Math.floor(x / CELL);
      const down = !!(p.input.crouch || p.pr >= 1), k = down ? here : cellAbove(this.map, here);
      if (!peepOk(this.map, k)) { this.events.push({ e: 'deny', id: p.id, why: down ? 'Drill on bare floor with a room below it' : 'No ceiling to drill here: bare floor above is needed (the roof can\'t be drilled)' }); return; }
      this.ents.push({ id: this.eid(), type: 'drill', x, y, k, up: !down, t: DRILL_T, team, owner: p.id, hp: 1 });
      used(); this.events.push({ e: 'snd', s: 'place', x: r1(x), y: r1(y) }); this.noise(x, y, team, 260);
    }
    else if (id === 'grapple') { // HOIST (he asked): up through an open hatch above you, or onto the roof from an outside wall
      const to = this.grappleTarget(p);
      if (!to) { this.events.push({ e: 'deny', id: p.id, why: 'Stand under an open hatch, or outside facing the building\'s wall, to grapple up' }); return; }
      p.grapple = { t: 0, dur: to.roof ? GRAPPLE_ROOF : GRAPPLE_T, x: to.x, y: to.y, sx: p.x, sy: p.y }; p.adsT = 0; p.reloadT = 0; p.bipodSet = null;
      used(); this.events.push({ e: 'snd', s: 'rope', x: r1(p.x), y: r1(p.y), id: p.id }); this.noise(p.x, p.y, team, 420);
    }
    else if (id === 'htrap') { // LOCKJAW (he asked): rig a shut hatch; the first attacker to open it or come through is stunned and spotted
      const h = this.hatchToRig(p);
      if (!h) { this.events.push({ e: 'deny', id: p.id, why: 'Stand on or under a shut hatch to rig it' }); return; }
      this.ents.push({ id: this.eid(), type: 'htrap', x: h.x, y: h.y, rig: h.id, arm: DUR.trapArm, team, owner: p.id, hp: 1 });
      used(); this.events.push({ e: 'snd', s: 'place', x: r1(h.x), y: r1(h.y) });
    }
    else if (id === 'dropcharge') { // DEADFALL (he asked): blows a hatch-sized hole into the floor below
      const w = this.floorCharge(p);
      if (!w) { this.events.push({ e: 'deny', id: p.id, why: 'Needs plain floor with a room below it' }); return; }
      this.ents.push({ id: this.eid(), type: 'dropch', x: w.x, y: w.y, cell: w.k, floor: true, t: DROP_T, team, owner: p.id, hp: 1 });
      used(); this.events.push({ e: 'snd', s: 'place', x: r1(w.x), y: r1(w.y) });
    }
    else if (id === 'bipod') { // PERCH (he asked: a bipod sniper): crouched or lying and still, the bipod goes down; again lifts it
      if (p.bipodSet) { p.bipodSet = null; this.events.push({ e: 'snd', s: 'swap', x: r1(p.x), y: r1(p.y), id: p.id }); return; }
      if (!(p.input.crouch || p.pr >= 1) || Math.hypot(p.vx || 0, p.vy || 0) > 12) { this.events.push({ e: 'deny', id: p.id, why: 'Crouch or lie down and stand still to set the bipod' }); return; }
      p.bipodSet = { x: p.x, y: p.y }; this.events.push({ e: 'snd', s: 'place', x: r1(p.x), y: r1(p.y), id: p.id });
    }
    else if (id === 'ghillie') { p.ghillieUntil = this.time + 12; used(); this.events.push({ e: 'snd', s: 'swap', x: r1(p.x), y: r1(p.y), id: p.id }); } // MOSS: no scope glint
    else if (id === 'spotter') { p.spotterUntil = this.time + 8; used(); this.events.push({ e: 'snd', s: 'swap', x: r1(p.x), y: r1(p.y), id: p.id }); } // OSPREY
    else if (id === 'pierce') { // NAIL: one armour-piercing round in the chamber
      if (p.pierceShot) { this.events.push({ e: 'deny', id: p.id, why: 'A piercing round is already loaded' }); return; }
      p.pierceShot = 1; used(); this.events.push({ e: 'snd', s: 'reload', x: r1(p.x), y: r1(p.y), id: p.id });
    }
    else if (id === 'tracer') { p.tracerUntil = this.time + 8; used(); this.events.push({ e: 'snd', s: 'swap', x: r1(p.x), y: r1(p.y), id: p.id }); }
    else if (id === 'cover') { if (this.placeCover(p)) used(); else this.events.push({ e: 'deny', id: p.id, why: 'No room for the cover there' }); }
    else if (id === 'pick') { // WREN: a barricade comes apart quietly
      const f = this.facingCell(p, 28); if (!f || f.t !== T.BARRI) return;
      this.ents.push({ id: this.eid(), type: 'pick', x: (f.cx + 0.5) * CELL, y: (f.cy + 0.5) * CELL, cell: f.k, team, owner: p.id, t: 1.5, hp: 1 });
      used();
    } else if (id === 'burst') { // VAPOR (he asked): a cone in front that spreads almost at once and fills the shape of the room
      const m = this.map, W = m.W, c0x = Math.floor(p.x / CELL), c0y = Math.floor(p.y / CELL), seen = new Set([c0y * W + c0x]), q = [[c0x, c0y]], puffs = [];
      while (q.length && puffs.length < 180) {
        const [x, y] = q.shift(), wx = (x + 0.5) * CELL, wy = (y + 0.5) * CELL, dd = Math.hypot(wx - p.x, wy - p.y);
        puffs.push(r1(wx), r1(wy));
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, k = ny * W + nx; if (seen.has(k) || nx < 0 || ny < 0 || nx >= W || ny >= m.H) continue;
          seen.add(k);
          const t = m.tiles[k], cx2 = (nx + 0.5) * CELL, cy2 = (ny + 0.5) * CELL, d2 = Math.hypot(cx2 - p.x, cy2 - p.y);
          if (blocksSight(t) || t === T.VOID) continue; // walls shape it
          if (d2 > 34 && (d2 > 180 || Math.abs(angDiff(Math.atan2(cy2 - p.y, cx2 - p.x), p.aim)) > 0.7)) continue; // the cone (and a little round you)
          q.push([nx, ny]);
        }
      }
      this.ents.push({ id: this.eid(), type: 'smoke', x: p.x, y: p.y, ang: p.aim, r: 14, life: 8, team, kind: 'cone', puffs });
      used(); this.events.push({ e: 'snd', s: 'smoke', x: r1(p.x), y: r1(p.y) });
    } else if (id === 'alarm') place('alarm', 12, { arm: DUR.trapArm });
    else if (id === 'pace') place('pace', 10, { life: 999, hit: {} }); // RALLY: stays for the round (one bullet breaks it)
    else if (id === 'beam') { // GIRDER: a steel brace across an open doorway
      const f = this.facingCell(p, 28);
      if (!f || f.t !== T.OPEN || this.map.openId[f.k] < 0) return;
      if (this.barricade(this.map.openId[f.k], T.BEAM, true)) { used(); this.events.push({ e: 'snd', s: 'panel', x: r1((f.cx + 0.5) * CELL), y: r1((f.cy + 0.5) * CELL) }); }
    }
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
    else if (id === 'periscope') { // LENS (he asked: no copy of TETHER's scope): up through the ceiling or down through the floor
      // he asked: make it clear. It says why when it can't go here, and where it went (and how to watch it) when it does
      const spot = this.periscopeSpot(p);
      if (!spot) { this.events.push({ e: 'deny', id: p.id, why: 'No periscope here: there is no room right above or below this spot. Stand under or over another room (not by a wall or outside).' }); return; }
      this.ents.push({ id: this.eid(), type: 'scope', x: spot.x, y: spot.y, ang: p.aim, fl: spot.dir, team, owner: p.id, hp: 1 });
      p.periDir = spot.dir === 'up' ? 'down' : 'up'; used(); this.events.push({ e: 'snd', s: 'place', x: r1(p.x), y: r1(p.y) });
      this.events.push({ e: 'deny', id: p.id, why: `Periscope pushed ${spot.dir === 'up' ? 'UP into' : 'DOWN into'} ${roomAt(this.map, spot.x, spot.y) || 'the floor ' + spot.dir} — open the camera feeds to watch it` });
    } else if (id === 'radar') place('radar', 8, { life: 15, t: 0 });
    else if (id === 'swarm') this.releaseSwarm(p, p);
    else if (id === 'station') place('station', 14, { pool: 100 });
    else if (id === 'catcher') place('catcher', 10, { c: 2 });
  }

  // where LENS's periscope comes out: the same spot one floor up (first) or down, if there is floor there
  periscopeSpot(p) {
    const m = this.map, lp = localPos(m, p.x, p.y);
    for (const dir of p.periDir === 'down' ? ['down', 'up'] : ['up', 'down']) {
      const F = m.floors[lp.f + (dir === 'up' ? 1 : -1)]; if (!F) continue;
      const x = lp.x - (F.x0 - F.gx) * CELL, y = lp.y - F.y0 * CELL, k = Math.floor(y / CELL) * m.W + Math.floor(x / CELL);
      if (floorAt(m, x, y) !== m.floors.indexOf(F) || blocksMove(m.tiles[k])) continue;
      return { x, y, dir };
    }
    return null;
  }

  // CROW's Lunge (he asked for a rework): a silent 2 m lunge along the aim that downs whoever it reaches, from any side
  lunge(p) {
    const tq = this.players.get(p.lungeTarget), ang = tq && tq.alive ? Math.atan2(tq.y - p.y, tq.x - p.x) : p.aim; // straight at the marked enemy
    const ca = Math.cos(ang), sa = Math.sin(ang), m = this.map;
    let x = p.x, y = p.y, hit = null;
    for (let d = 3; d <= LUNGE_M * PX_PER_M; d += 3) {
      const nx = p.x + ca * d, ny = p.y + sa * d;
      hit = [...this.players.values()].find(q => q !== p && q.alive && Math.hypot(q.x - nx, q.y - ny) < hitR(q.op) + PLAYER_R);
      if (hit || circleBlocked(m, nx, ny, PLAYER_R, blocksMove)) break;
      x = nx; y = ny;
    }
    p.lungeUntil = 0; p.meleeCd = 1.0; p.lungeTarget = null;
    if (Math.hypot(x - p.x, y - p.y) > 4) p.vault = { x0: p.x, y0: p.y, x1: x, y1: y, t: 0, dur: 0.16 };
    if (!hit) return;
    if (this.hasShield(hit) && !hit.downed && hit.ctrl === 'body' && Math.abs(angDiff(Math.atan2(p.y - hit.y, p.x - hit.x), hit.aim)) < 0.8) { // into the front of a shield: knocked aside, nobody downed
      hit.shieldDownUntil = this.time + 1.0; this.events.push({ e: 'hit', k: 'shield', x: r1(hit.x), y: r1(hit.y) }); return;
    }
    this.damage(hit, hit.downed ? 999 : hit.hp + 5, p, 'Lunge', p.aim); // enough to down (the last one standing goes down for good, as always)
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
    for (const q of hit) { q.staggerUntil = this.time + 0.7; this.effect(q, 'slow', 1, p); this.damage(q, 10, p, 'Breaching Dash', p.aim); }
    if (Math.hypot(x - p.x, y - p.y) < 8) return false;
    p.vault = { x0: p.x, y0: p.y, x1: x, y1: y, t: 0, dur: 0.28 };
    this.events.push({ e: 'snd', s: 'vault', x: r1(p.x), y: r1(p.y), id: p.id });
    return true;
  }
  // a bulletproof barrier two cells wide across your aim (Deployable Shield gadget, TRENCH's Drop Cover)
  // TRENCH's Drop Cover (he asked: thinner, vaultable, at any angle, can stand right beside another): a thin bulletproof
  // plate about 2 m wide, square to where you aim, just in front of you. It stops bullets, sight and bodies; vault over it.
  placeCover(p) {
    const cx = p.x + Math.cos(p.aim) * 18, cy = p.y + Math.sin(p.aim) * 18, e = { id: this.eid(), type: 'cover', x: cx, y: cy, ang: p.aim + Math.PI / 2, hl: 17, chp: 300, team: this.side(p), owner: p.id };
    const s = coverOf(e), blk = (t) => blocksMove(t) && t !== T.LOW;
    for (const f of [0, 0.5, 1]) if (circleBlocked(this.map, s.x1 + (s.x2 - s.x1) * f, s.y1 + (s.y2 - s.y1) * f, 1.5, blk)) return false;
    this.ents.push(e); this.syncCovers();
    this.events.push({ e: 'snd', s: 'panel', x: r1(cx), y: r1(cy) });
    return true;
  }
  syncCovers() { this.map.covers = this.ents.filter(e => e.type === 'cover').map(coverOf); }
  coverDamage(e, n) { e.chp -= n; if (e.chp <= 0) { this.removeEnt(e); this.syncCovers(); this.events.push({ e: 'hit', k: 'spark', x: r1(e.x), y: r1(e.y) }); this.events.push({ e: 'snd', s: 'break', x: r1(e.x), y: r1(e.y) }); } }
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

  // he asked: placed utility takes time to set up (you stand still, SETUP_T), thrown utility has a short wind-up (WINDUP_T:
  // pulling the pin, slowed, can't shoot) to make up for how strong throwing is. Everything else happens at once.
  startUse(p, k) {
    if (p.prep) return;
    const op = OPERATORS[p.op], g = p.gadget || op.gadget, id = op.ability.id;
    let mode = null;
    if (k === 'gadget') { if (p.gadgetCount > 0 && !(g === 'nitro' && p.nitroId)) mode = THROWN_G.has(g) ? 'throw' : PLACED_G.has(g) ? 'place' : null; }
    else if (p.abilityCount > 0 && !(id === 'gas' && p.gasId)) mode = THROWN_AB.has(id) ? 'throw' : PLACED_AB.has(id) ? 'place' : null;
    if (!mode) return k === 'gadget' ? this.useGadget(p) : this.useAbility(p);
    const dur = mode === 'throw' ? WINDUP_T : SETUP_T;
    p.prep = { k, mode, until: this.time + dur, dur };
    this.events.push({ e: 'snd', s: mode === 'throw' ? 'pin' : 'setup', x: r1(p.x), y: r1(p.y), id: p.id });
  }
  tickPrep(p) {
    if (!p.prep) return;
    if (!p.alive || p.downed || p.ctrl !== 'body' || p.vault || p.rope) { p.prep = null; return; } // interrupted: nothing used up
    if (this.time < p.prep.until) return;
    const k = p.prep.k; p.prep = null;
    if (k === 'gadget') this.useGadget(p); else this.useAbility(p);
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
      const w = this.wallInFront(p, [T.SOFT, T.BARRI]) || this.hatchSpot(p, [T.HATCH]) || (!p.bot && this.floorCharge(p)); // he asked: floors break too (bots aim their charges at walls: a near miss used to land on the floor)
      if (!w) return;
      this.ents.push({ id: this.eid(), type: 'breach', x: w.x, y: w.y, cell: w.k, hatch: w.hatch, floor: w.floor, team, owner: p.id, t: 2.5, hp: 1 });
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
    // Every throw works the same way (he asked): it flies to where you aim and comes to rest there (THROW_K is the
    // drag, so the speed it leaves your hand with is just the distance × THROW_K). A frag's fuse runs from the throw
    // (cook it); an impact grenade goes off on contact; a nitro cell / gas canister waits for its owner; everything
    // else does its thing a moment after it lands. An EMP sticks to the first wall it hits (TALON's rule).
    const dist = Math.max(40, Math.min(300, Math.hypot(tx - p.x, ty - p.y)));
    const v = dist * THROW_K;
    const fuse = { frag: 2.5, smoke: 0.2, stun: 0.5, impact: 3, nitro: 999, emp: 0.3, sonar: 0.2, gas: 999, cam: 0, flare: 0.4, medkit: 0.1, echobox: 0.1 }[kind];
    const n = { id: this.eid(), type: 'nade', kind, x: p.x + Math.cos(p.aim) * 10, y: p.y + Math.sin(p.aim) * 10,
      vx: Math.cos(p.aim) * v, vy: Math.sin(p.aim) * v, fuse, fromLand: kind !== 'frag', flight: 0, team: this.side(p), owner: p.id };
    this.ents.push(n);
    this.events.push({ e: 'snd', s: 'throw', x: r1(p.x), y: r1(p.y) });
    return n;
  }

  // ---------------- entities ----------------
  eid() { return 'e' + (this.nextId++); }
  ent(id) { return id ? this.ents.find(e => e.id === id) : null; }
  // ---------------- MAGPIE (he asked): a parasite swarm takes over attacker drones, which reshape into birds ----------------
  // The swarm goes for the attacker drone in sight (within SWARM.reach) closest to where you aim (from your body) or to the
  // bird you fly. It chases it; the drone escapes by getting SWARM.lose metres further ahead than it started, by
  // staying out of the swarm's sight for SWARM.blind s, or by outlasting it. Caught: held SWARM.grab s, then it is a bird.
  releaseSwarm(p, from) {
    if (p.abilityCount <= 0) return;
    const sm = this.smokeList(), fl = floorAt(this.map, from.x, from.y), body = from === p;
    let best = null, bs = Infinity;
    for (const d of this.ents) {
      if (d.type !== 'drone' || d.team === this.side(p) || d.grab || this.ents.some(s => s.type === 'swarm' && s.target === d.id)) continue;
      const dist = Math.hypot(d.x - from.x, d.y - from.y);
      if (dist > SWARM.reach * PX_PER_M || floorAt(this.map, d.x, d.y) !== fl || !los(this.map, from.x, from.y, d.x, d.y, sm)) continue;
      const off = body ? Math.abs(angDiff(Math.atan2(d.y - from.y, d.x - from.x), p.aim)) : 0;
      if (body && off > 1.2) continue; // from your body: roughly where you look
      const sc = dist + off * 200; if (sc < bs) { bs = sc; best = d; }
    }
    if (!best) { this.events.push({ e: 'deny', id: p.id, why: `No attacker drone in sight within ${SWARM.reach} m` }); return; }
    p.abilityCount--;
    const dist = Math.hypot(best.x - from.x, best.y - from.y);
    this.ents.push({ id: this.eid(), type: 'swarm', x: from.x, y: from.y, team: this.side(p), owner: p.id, target: best.id, t: 0, seenT: 0, lx: best.x, ly: best.y,
      lose: dist + SWARM.lose * PX_PER_M, from: from === p ? 'body' : 'bird' });
    this.events.push({ e: 'snd', s: 'swarm', x: r1(from.x), y: r1(from.y) });
    this.events.push({ e: 'deny', id: best.owner, why: 'A PARASITE SWARM IS CHASING YOUR DRONE: get away fast (Shift sprints) or break its sight' });
    this.magpieSeen = { x: from.x, y: from.y, t: this.time, id: p.id }; // the attackers now know there is a MAGPIE (bots get wary)
  }
  tickSwarm(e, dt) {
    const d = this.ent(e.target), gone = why => { this.removeEnt(e); this.events.push({ e: 'hit', k: 'spark', x: r1(e.x), y: r1(e.y) }); if (why && d) this.events.push({ e: 'deny', id: d.owner, why }); };
    if (!d || d.type !== 'drone') return gone();
    if (e.grab) { // latched on: the drone can't move while the parasite reshapes it
      e.x = d.x; e.y = d.y; e.grab -= dt;
      if (e.grab <= 0) this.captureDrone(e, d);
      return;
    }
    e.t += dt;
    const dist = Math.hypot(d.x - e.x, d.y - e.y);
    if (floorAt(this.map, d.x, d.y) === floorAt(this.map, e.x, e.y) && los(this.map, e.x, e.y, d.x, d.y)) { e.seenT = 0; e.lx = d.x; e.ly = d.y; } else e.seenT += dt;
    if (e.t > SWARM.life || e.seenT > SWARM.blind || dist > e.lose) return gone('Your drone shook off the parasite swarm');
    if (dist < 7) { e.grab = SWARM.grab; d.grab = true; d.vx = d.vy = 0; this.events.push({ e: 'snd', s: 'swarmLatch', x: r1(d.x), y: r1(d.y) }); return; }
    const sp = (e.t < SWARM.fresh ? SWARM.speed : SWARM.speed + (SWARM.tired - SWARM.speed) * Math.min(1, (e.t - SWARM.fresh) / (SWARM.life - SWARM.fresh))) * PX_PER_M;
    const tx = e.lx - e.x, ty = e.ly - e.y, l = Math.hypot(tx, ty) || 1, step = Math.min(l, sp * dt);
    moveCircle(this.map, e, tx / l * step, ty / l * step, 2, true); // tiny bugs: through drone holes and barricade gaps like the drone
  }
  captureDrone(s, d) {
    this.removeEnt(s); this.removeEnt(d);
    const a = this.players.get(d.owner);
    if (a && a.droneId === d.id) { a.droneId = null; if (a.ctrl === 'drone') { a.ctrl = 'body'; const list = a.staged ? this.feeds(this.side(a)) : []; if (list.length) this.watch(a, list[0]); } }
    if (a) this.msg(`${a.name}'s drone was taken over by a parasite`, d.team);
    const m = this.players.get(s.owner);
    const b = { id: this.eid(), type: 'bird', owner: s.owner, team: s.team, x: d.x, y: d.y, hp: 1, ang: d.ang || 0, vx: 0, vy: 0, perch: null, auto: false };
    this.ents.push(b);
    this.events.push({ e: 'snd', s: 'birdForm', x: r1(b.x), y: r1(b.y) }); this.events.push({ e: 'hit', k: 'spark', x: r1(b.x), y: r1(b.y) });
    if (m) { this.pts(m, 30, 'DRONE CAPTURED'); this.events.push({ e: 'deny', id: m.id, why: 'Drone captured: it is your bird now (look through your feeds to fly it)' }); }
    if (m && m.bot) b.botFly = true; // a bot's bird flies to the nearest wall, lands and watches on AUTO (tickBird)
  }
  // E on your bird: land on the wall next to it (looking out from it, AUTO on), or take off again
  birdPerch(p, b, reach = 14) {
    if (b.perch) { b.perch = null; b.auto = false; this.events.push({ e: 'snd', s: 'flap', x: r1(b.x), y: r1(b.y) }); return; }
    let ba = null, bd = Infinity;
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, d = castSight(this.map, b.x, b.y, a, reach + 4, null); if (d < bd) { bd = d; ba = a; } }
    if (ba === null || bd > reach) { this.events.push({ e: 'deny', id: p.id, why: 'Fly right up to a wall to land on it' }); return; }
    const k = Math.max(0, bd - 4); b.x += Math.cos(ba) * k; b.y += Math.sin(ba) * k; b.vx = b.vy = 0;
    b.perch = { out: ba + Math.PI }; b.ang = ba + Math.PI; b.auto = true; // he asked: AUTO is on by default when it lands
    if (p.ctrl === 'drone' && p.droneId === b.id) p.aim = b.ang;
    this.events.push({ e: 'snd', s: 'place', x: r1(b.x), y: r1(b.y) });
  }
  birdAuto(p) {
    const b = p.ctrl === 'drone' ? this.ent(p.droneId) : null;
    if (!b || b.type !== 'bird' || !b.perch) return;
    b.auto = !b.auto; this.events.push({ e: 'snd', s: 'swap', x: r1(b.x), y: r1(b.y), id: p.id });
  }
  // a bird that sees anyone: AUTO (landed) pings the first attacker it sees for the team, then flashes and destroys itself
  tickBird(b, dt) {
    const o = this.players.get(b.owner);
    if (o && !o.alive && o.ctrl === 'drone') o.ctrl = 'body';
    if (b.botFly && !b.perch && !(o && o.ctrl === 'drone' && o.droneId === b.id)) { // (found at playtest: hovering in the open, they were shot)
      if (!b.goal) { // the nearest wall in reach, a bird-length off it
        let ba = null, bd = Infinity;
        for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, d = castSight(this.map, b.x, b.y, a, 10 * CELL, null); if (d < bd) { bd = d; ba = a; } }
        b.goal = ba === null ? { x: b.x, y: b.y } : { x: b.x + Math.cos(ba) * Math.max(0, bd - 8), y: b.y + Math.sin(ba) * Math.max(0, bd - 8) };
        b.flyT = 0;
      }
      const dx = b.goal.x - b.x, dy = b.goal.y - b.y, l = Math.hypot(dx, dy); b.flyT += dt;
      if (l > 3 && b.flyT < 4) { const s = Math.min(l, SWARM.bird * PX_PER_M * dt); b.ang = Math.atan2(dy, dx); moveCircle(this.map, b, dx / l * s, dy / l * s, 2.5, 'bird'); }
      else { b.botFly = false; if (o) this.birdPerch(o, b, 3 * CELL); }
      return;
    }
    if (!b.perch || !b.auto || this.phase !== PHASE.ACTION && this.phase !== PHASE.PREP) return;
    if ((b.lookT = (b.lookT || 0) - dt) > 0) return; b.lookT = 0.15;
    const sm = this.smokeList(), fl = floorAt(this.map, b.x, b.y);
    for (const q of this.players.values()) {
      if (!q.alive || q.staged || q.shrouded || this.side(q) === b.team || floorAt(this.map, q.x, q.y) !== fl) continue;
      const d = Math.hypot(q.x - b.x, q.y - b.y);
      if (d > 520 || Math.abs(angDiff(Math.atan2(q.y - b.y, q.x - b.x), b.ang)) > 0.95 || !los(this.map, b.x, b.y, q.x, q.y, sm)) continue;
      this.spot(b.team, q.id, DUR.spot);
      const w = 'BIRD: ENEMY ' + OPERATORS[q.op].name;
      if (o) { this.mark(o, q.x, q.y, w, q.id); this.pts(o, 20, 'ENEMY SPOTTED'); } else this.events.push({ e: 'mark', team: b.team, x: r1(q.x), y: r1(q.y), w, by: 'BIRD', id: q.id });
      this.removeEnt(b); this.droneLost(b);
      this.detonate({ type: 'flare', x: b.x, y: b.y, team: b.team }); // the flash: blinds the attackers looking at it
      return;
    }
  }

  removeEnt(e) { const i = this.ents.indexOf(e); if (i >= 0) this.ents.splice(i, 1); }

  ghost(q) { return this.time < (q.ghostUntil || 0); } // Ghost Step: traps and sensors don't notice
  gridNear(x, y, team) { return this.ents.find(g => g.type === 'grid' && g.team === team && Math.hypot(g.x - x, g.y - y) < 30) || null; }
  smokeList() { // every puff of every cloud, as circles (a smoke wall or cone is a list of small puffs)
    const out = [];
    for (const e of this.ents) if (e.type === 'smoke') { if (e.puffs) for (let i = 0; i < e.puffs.length; i += 2) out.push({ x: e.puffs[i], y: e.puffs[i + 1], r: e.r }); else out.push(e); }
    return out;
  }

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
  mark(p, x, y, w, id, pk) {
    const team = this.side(p), room = roomAt(this.map, x, y);
    this.events.push({ e: 'mark', team, x: r1(x), y: r1(y), w, by: p.name, from: p.id, id, pk });
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
    if (m.a === 'ef' && process.env.R62D_FAST) { const q = this.players.get(m.id); if (q && EF_FIELD[m.k]) this.effect(q, m.k, +m.dur || 4, p); return; } // screenshot tests only: a status effect caused by you
    if (m.a === 'tile' && process.env.R62D_FAST && Array.isArray(m.ks)) { // screenshot tests only: set map cells (open a window)
      for (const k of m.ks) if (this.map.tiles[k] !== undefined) { this.map.tiles[k] = m.v | 0; this.map.hp[k] = m.v === T.BARRI ? CELL_HP[T.BARRI] : 0; delete this.map.holes[k]; if (m.holes) { this.map.holes[k] = m.holes.slice(0, 2); this.addHole(k, m.holes[0], m.holes[1]); } this.changed.add(k); }
      return;
    }
    if (m.a === 'start') {
      for (const q of [...this.players.values()]) if (q.bot) this.players.delete(q.id);
      F.bots = Math.max(0, Math.min(TEAM_SIZE, m.bots | 0));
      if (BOT_LEVELS[m.level] !== undefined) this.botLevel = m.level;
      if (MAPS[m.map] && m.map !== this.mapId) { this.mapId = m.map; this.map = buildMap(this.mapId); }
      p.squad = 0;
      for (let i = 0; i < F.bots; i++) this.addBot(1);
      this.startMatch(); // round 1: squad 0 attacks
      p.op = opsForTeam(TEAM.ATK)[0];
      for (const q of this.players.values()) if (q.bot) botPickOp(this, q);
      this.beginPrep(); this.beginAction();
      p.hasDefuser = true;
      this.events = [{ e: 'banner', text: 'FREE PLAY', sub: MAPS[this.mapId].name }];
    } else if ((m.a === 'bot' || m.a === 'dummy') && this.phase === PHASE.ACTION && this.players.size < MAX_PLAYERS) {
      // he asked: add bots and dummies while playing. A bot plays normally (enemy or on your team); a dummy is an enemy
      // that stands still 3 m in front of you, facing you, and comes back to the same spot 3 s after it goes down.
      const dummy = m.a === 'dummy', squad = dummy || m.side !== 'team' ? 1 - p.squad : p.squad;
      const used = new Set([...this.players.values()].map(q => q.name));
      let name; if (dummy) { let i = 1; while (used.has('DUMMY ' + i)) i++; name = 'DUMMY ' + i; } else name = '[BOT] ' + (BOT_NAMES.find(n => !used.has('[BOT] ' + n)) || 'Bot');
      const b = this.blankPlayer(name, true, squad); this.players.set(b.id, b);
      if (dummy) { const at = this.freeSpotNear(p.x + Math.cos(p.aim) * 3 * PX_PER_M, p.y + Math.sin(p.aim) * 3 * PX_PER_M, 30); b.hold = true; b.dummyAt = at; }
      this.freeSpawn(b, true);
      if (dummy) this.dummyPlace(b, p);
    } else if (m.a === 'god') { F.god = !!m.on; // the free play menu's switches (he asked)
    } else if (m.a === 'botsFire') { F.noFire = !m.on;
    } else if (m.a === 'clearBots') {
      for (const q of [...this.players.values()]) if (q.bot) { if (q.hasDefuser) this.dropDefuser(q); this.players.delete(q.id); }
    } else if (m.a === 'pick' && this.phase === PHASE.ACTION && OPERATORS[m.op]) { // the operator grid
      this.freeSwitch(p, m.op);
    } else if (m.a === 'gun' && this.phase === PHASE.ACTION && WEAPONS[m.w] && p.alive) { // he asked: any gun, any time
      const side = SIDEARMS.has(m.w) ? 's' : 'p';
      p.freeGuns = { ...(p.freeGuns || {}), [side]: m.w };
      this.freeGunsOn(p); p.slot = side === 'p' ? 0 : p.guns.length - 1;
      this.events.push({ e: 'snd', s: 'swap', x: r1(p.x), y: r1(p.y), id: p.id });
    } else if (m.a === 'att' && WEAPONS[m.w] && attachFor(m.w)[m.s]?.includes(m.v)) { // he asked: attachments in the free play gun menu
      const g = p.guns.find(q => q.w === m.w), cur = (p.freeAtt && p.freeAtt[m.w]) || (g && g.att) || cleanAtt(m.w, p.loadout && p.loadout.att && p.loadout.att[m.w], p.op);
      (p.freeAtt ||= {})[m.w] = { ...cur, [m.s]: m.v };
      this.freeGunsOn(p);
      if (g) this.events.push({ e: 'snd', s: 'swap', x: r1(p.x), y: r1(p.y), id: p.id });
    } else if (m.a === 'op' && this.phase === PHASE.ACTION) {
      const i = Math.max(0, FREE_OPS.indexOf(p.op)), n = FREE_OPS.length;
      this.freeSwitch(p, FREE_OPS[(i + (m.dir < 0 ? -1 : 1) + n) % n]);
    }
  }
  // Free play is god mode for the player (he asked): you can't be hurt, and ammo, reloads, skills, gadgets, drones
  // and drone sprints never run out.
  godMode(p) {
    const o = OPERATORS[p.op]; if (!o) return;
    p.hp = Math.max(p.hp, p.maxHp); p.downed = false;
    for (const g of p.guns || []) { g.ammo = WEAPONS[g.w].mag; g.reserve = WEAPONS[g.w].reserve; }
    if (o.ability.count) p.abilityCount = o.ability.count;
    if (o.ability.battery && !p.shrouded && !p.scanning && !p.lancing && !p.welding) p.battery = o.ability.battery;
    p.gadgetCount = Math.max(p.gadgetCount || 0, GADGET_COUNT[p.gadget] || 1);
    p.drones = Math.max(p.drones || 0, 2); p.sprints = DRONE_SPRINT.charges; p.sprintCd = 0; p.pingReady = 0;
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
    p.op = op; p.freeGuns = null; // a new operator comes with their own guns
    this.freeSpawn(p, !wasAlive);
    if (wasAlive) { p.x = x; p.y = y; p.aim = aim; }
    this.events.push({ e: 'snd', s: 'swap', x: r1(p.x), y: r1(p.y), id: p.id });
  }
  // free play: the guns picked from the menu (p.freeGuns: p = main gun, s = sidearm) replace the operator's, kept on respawn
  // and p.freeAtt[w] = attachments picked there for that gun, kept for the whole free play session
  freeGunsOn(p) {
    const A = p.freeAtt || {};
    for (const g of p.guns) if (A[g.w]) { g.att = cleanAtt(g.w, A[g.w], p.op); g.m = gunMods(g.w, g.att); }
    const F = p.freeGuns; if (!F) return;
    const L = p.loadout || {}, mk = w => { const att = cleanAtt(w, A[w] || (L.att && L.att[w]), p.op); return { w, ammo: WEAPONS[w].mag, reserve: WEAPONS[w].reserve, att, m: gunMods(w, att) }; };
    if (F.p) p.riot = null; // a main gun in place of a riot shield
    const prim = F.p || (p.riot ? null : p.guns[0] && p.guns[0].w), sec = F.s || (p.guns[p.guns.length - 1] || {}).w;
    p.guns = [prim, sec].filter(Boolean).map(w => (p.guns.find(g => g.w === w) || mk(w)));
    p.slot = Math.min(p.slot || 0, p.guns.length - 1); p.reloadT = 0; p.fireCd = 0; p.adsT = 0; p.rc = 0; p.shots = 0;
  }
  // (re)equips a player; atSpawn also puts them at their side's starting spot
  freeSpawn(p, atSpawn) {
    p.respawnAt = 0;
    if (!p.op) { // a random operator of their side that no teammate is playing
      const taken = new Set([...this.players.values()].filter(q => q.squad === p.squad && q.op).map(q => q.op)), list = opsForTeam(this.side(p)).filter(o => !taken.has(o));
      p.op = list[Math.floor(Math.random() * list.length)] || opsForTeam(this.side(p))[0];
    }
    this.equip(p); this.freeGunsOn(p);
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
  freeRespawns() { // the dead come back at their side's start after 3 s (dummies at their own spot)
    for (const p of this.players.values()) {
      if (p.alive || !p.op) continue;
      if (!p.respawnAt) p.respawnAt = this.time + 3;
      else if (this.time >= p.respawnAt) { this.freeSpawn(p, true); if (p.dummyAt) this.dummyPlace(p); }
    }
  }
  dummyPlace(b, face) {
    b.x = b.dummyAt.x; b.y = b.dummyAt.y; b.vx = b.vy = 0;
    const f = face || [...this.players.values()].find(q => !q.bot);
    if (f) b.aim = Math.atan2(f.y - b.y, f.x - b.x);
  }

  // Status effects (he asked: an icon over the head, seen by the side that caused it). kind → the field the game
  // reads; q.ef[kind] = [until, side of whoever caused it], sent in the snapshot as ef: [[kind, s left, side]]
  effect(q, kind, dur, by) {
    const f = EF_FIELD[kind], until = this.time + dur;
    q[f] = Math.max(q[f] || 0, until);
    const side = by && typeof by === 'object' ? this.side(by) : by, ef = q.ef || (q.ef = {});
    ef[kind] = [Math.max(until, ef[kind] ? ef[kind][0] : 0), side];
  }
  efOut(p) {
    if (!p.ef || !p.alive) return undefined;
    const out = [];
    for (const k in p.ef) { const [u, sd] = p.ef[k]; if (u > this.time) out.push([k, r1(u - this.time), sd]); else delete p.ef[k]; }
    return out.length ? out : undefined;
  }
  spot(team, id, dur) {
    const until = this.time + dur;
    if (!this.spots[team]) return; // (fun modes: everyone for themselves has no team to tell)
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
        case 'swarm': this.tickSwarm(e, dt); break;
        case 'bird': this.tickBird(e, dt); break;
        case 'nade': this.tickNade(e, dt); break;
        case 'smoke': {
          e.life -= dt; if (e.life <= 0) { this.removeEnt(e); break; }
          const o = e.follow && this.players.get(e.follow); if (o && o.alive) { e.x = o.x; e.y = o.y; } // VAPOR's cloak goes with her
          break;
        }
        case 'sticky': {
          if (e.stuck) { // counting down where it stuck (on a person, it goes with them)
            const q = e.on && this.players.get(e.on); if (q && q.alive) { e.x = q.x; e.y = q.y; }
            const o = this.players.get(e.owner);
            if (!o || !o.alive) { e.go = true; e.t = Math.max(e.t, 0.5); } // its owner is gone: it goes off on its own
            if (e.go) { e.t -= dt; if (e.t <= 0) this.detonate(e); }
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
            for (const q of this.players.values()) if (q.alive && this.side(q) !== e.team && !this.ghost(q) && !q.shrouded && q.moving >= 2 && Math.hypot(q.x - e.x, q.y - e.y) < 10 * PX_PER_M) { this.spot(e.team, q.id, 1.5); any = true; }
            e.pingT -= 0.5; if (any && e.pingT <= 0) { e.pingT = 1.5; this.events.push({ e: 'ping', x: r1(e.x), y: r1(e.y), team: e.team, any: true }); }
          } else { // AUDIT: every attacker drone nearby is marked for the defenders, again and again
            e.t = 1.5; const o = this.players.get(e.owner), seen = e.seen || (e.seen = {});
            for (const d of this.ents) if (d.type === 'drone' && d.team !== e.team && Math.hypot(d.x - e.x, d.y - e.y) < 15 * PX_PER_M && (!seen[d.id] || this.time - seen[d.id].t > 10 && Math.hypot(d.x - seen[d.id].x, d.y - seen[d.id].y) > 3 * PX_PER_M) && (seen[d.id] = { t: this.time, x: d.x, y: d.y })) // he asked: fewer drone pings — once, then only when it has moved on
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
            this.effect(q, 'deaf', 8, e.team); this.removeEnt(e); // LATCH's siren: 8 s without hearing footsteps
            this.events.push({ e: 'snd', s: 'siren', x: r1(e.x), y: r1(e.y) }); this.noise(e.x, e.y, e.team, 900); break;
          }
          break;
        }
        case 'pace': { // RALLY's pace beacon: teammates running past get 5 s of speed (each once every 10 s)
          e.life -= dt; if (e.life <= 0) { this.removeEnt(e); break; }
          for (const q of this.players.values()) if (q.alive && !q.downed && this.side(q) === e.team && Math.hypot(q.x - e.x, q.y - e.y) < 26 && !(e.hit[q.id] > this.time)) {
            e.hit[q.id] = this.time + 10; q.boostUntil = Math.max(q.boostUntil || 0, this.time + 5); this.events.push({ e: 'stim', x: r1(e.x), y: r1(e.y), x2: r1(q.x), y2: r1(q.y) });
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
        case 'saw': this.tickSaw(e, dt); break;
        case 'cutter': case 'breach': case 'cluster':
          { const g = this.gridNear(e.x, e.y, other(e.team)); // a static grid fries breaching gadgets on its wall
            if (g) { this.events.push({ e: 'arc', x: r1(g.x), y: r1(g.y), x2: r1(e.x), y2: r1(e.y) }); this.events.push({ e: 'snd', s: 'break', x: r1(e.x), y: r1(e.y) }); this.removeEnt(e); break; } }
          if (!this.jammedAt(e.x, e.y)) e.t -= dt;
          if (e.type === 'cluster' && !e.warned && e.t <= 1) { e.warned = true; this.events.push({ e: 'snd', s: 'clusterWarn', x: r1(e.x), y: r1(e.y) }); this.noise(e.x, e.y, e.team, 500); } // ONYX: a loud warning a second before (he asked)
          if (e.t <= 0) this.detonate(e);
          break;
        case 'clusterwave': // ONYX's charge goes off three times; the last blast is a little bigger (he asked)
          if ((e.t -= dt) <= 0) {
            const last = e.n === 2, cx = (e.cell % this.map.W + 0.5) * CELL, cy = (Math.floor(e.cell / this.map.W) + 0.5) * CELL;
            for (let i = 0; i < (last ? 4 : 3); i++) {
              const d = 22 + i * 13 + Math.random() * 8, side = (Math.random() - 0.5) * 50;
              const x = cx + e.dx * d + (e.dy ? side : 0), y = cy + e.dy * d + (e.dx ? side : 0);
              this.explode({ x, y, team: e.team, owner: e.owner }, { r: last ? 36 : 28, dmg: last ? 34 : 24, cellR: 0, cells: [], kind: 'impact' });
            }
            this.removeEnt(e);
          }
          break;
        case 'dart':
          if (e.fly > 0) { // in the air at DART_SPEED; stops 3 px short of the first wall or barricade in its way
            const c = Math.cos(e.ang), s = Math.sin(e.ang), step = Math.min(e.fly, DART_SPEED * dt);
            const wt = walkRay(e.x, e.y, c, s, step + 3, (cx, cy) => { const t = tileAt(this.map, cx, cy); return blocksDrone(t) || t === T.BARRI || t === T.VOID; });
            if (wt < step + 3) { const g = Math.max(0, wt - 3); e.x += c * g; e.y += s * g; e.fly = 0; this.events.push({ e: 'snd', s: 'place', x: r1(e.x), y: r1(e.y) }); }
            else { e.x += c * step; e.y += s * step; e.fly -= step; if (e.fly <= 0) this.events.push({ e: 'snd', s: 'bounce', x: r1(e.x), y: r1(e.y) }); }
            break;
          }
          e.life -= dt; e.ping -= dt;
          if (e.ping <= 0 && !this.jammedAt(e.x, e.y)) {
            e.ping = 1.5;
            let any = false; const sm = this.smokeList(), fl = floorAt(this.map, e.x, e.y);
            // only who it can see from where it sits (he asked: nothing through walls, floors or anything solid)
            for (const q of this.players.values()) if (q.alive && this.side(q) !== e.team && !this.ghost(q) && Math.hypot(q.x - e.x, q.y - e.y) < 170 && floorAt(this.map, q.x, q.y) === fl && los(this.map, e.x, e.y, q.x, q.y, sm)) { this.spot(e.team, q.id, 1.6); any = true; }
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
        case 'drill': // GIMLET: a few seconds' drilling, then the peephole is through
          if ((e.t -= dt) <= 0) { this.removeEnt(e); if (peepOk(this.map, e.k)) { addPeep(this.map, e.k); this.events.push({ e: 'snd', s: 'break', x: r1(e.x), y: r1(e.y) }); } }
          break;
        case 'dropch': // DEADFALL: the fuse runs, then the floor goes
          if (!this.jammedAt(e.x, e.y)) e.t -= dt;
          if (e.t <= 0) { this.removeEnt(e); this.explode(e, { r: 34, dmg: 45, cellR: 0, cells: [], kind: 'breach', at: e.cell, floor: true }); }
          break;
        case 'htrap': { // LOCKJAW: once the hatch is open, the first attacker by either side of it
          if (e.arm > 0) { e.arm -= dt; break; }
          const h = this.map.hatches[e.rig]; if (!h) { this.removeEnt(e); break; } // (rig, not hatch: opening a hatch clears what sits on it)
          if (!hatchOpen(this.map, h)) break;
          const near = [...this.players.values()].filter(q => q.alive && this.side(q) !== e.team && [[h.x, h.y], [h.bx, h.by]].some(([x, y]) => Math.hypot(q.x - x, q.y - y) < HTRAP_R && floorAt(this.map, q.x, q.y) === floorAt(this.map, x, y)));
          if (!near.length) break;
          this.removeEnt(e); this.events.push({ e: 'boom', x: r1(h.bx), y: r1(h.by), r: 30, kind: 'stun' }); this.events.push({ e: 'snd', s: 'beep', x: r1(h.x), y: r1(h.y) });
          for (const q of near) { this.effect(q, 'blind', 3, e.team); this.events.push({ e: 'stun', id: q.id, dur: 3 }); this.spot(e.team, q.id, 6); }
          const o = this.players.get(e.owner); if (o) this.pts(o, 20 * near.length, 'Hatch trap');
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
              this.effect(q, 'snare', 2, e.team); this.spot(e.team, q.id, 3);
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
            if (q.alive && this.side(q) !== e.team && !this.ghost(q) && !q.shrouded && q.moving >= 2 && Math.hypot(q.x - e.x, q.y - e.y) < 190) { this.spot(e.team, q.id, 1.5); any = true; }
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
            if (inCone && los(this.map, e.x, e.y, q.x, q.y)) {
              if (e.type === 'mine') { // LYNX's paint trap (he asked: one job each): no bang, the attacker glows for the defenders for 12 s
                this.spot(e.team, q.id, 12); q.paintUntil = this.time + 12; this.removeEnt(e);
                this.events.push({ e: 'paint', id: q.id, x: r1(q.x), y: r1(q.y) }); this.events.push({ e: 'snd', s: 'clamp', x: r1(e.x), y: r1(e.y) });
              } else this.detonate(e);
              break;
            }
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
    if (e.kind === 'emp' && !e.landed && (blocked(nx, e.y) || blocked(e.x, ny))) { // an EMP sticks to the wall it hits; its zone reaches through it
      e.wx = blocked(nx, e.y) ? Math.sign(e.vx) : 0; e.wy = !e.wx && blocked(e.x, ny) ? Math.sign(e.vy) : 0;
      e.vx = e.vy = 0; e.landed = true; this.events.push({ e: 'snd', s: 'place', x: r1(e.x), y: r1(e.y) });
    }
    if (blocked(nx, e.y)) { e.vx = -e.vx * 0.45; bounced = true; } else e.x = nx;
    if (blocked(e.x, ny)) { e.vy = -e.vy * 0.45; bounced = true; } else e.y = ny;
    const hk = Math.floor(e.y / CELL) * this.map.W + Math.floor(e.x / CELL);
    if (this.map.tiles[hk] === T.HOLE && this.map.hatchAt[hk] >= 0 && takeStairs(this.map, e)) { e.vx *= 0.35; e.vy *= 0.35; this.events.push({ e: 'snd', s: 'bounce', x: r1(e.x), y: r1(e.y) }); } // (he asked) it falls through an open hatch
    const f = Math.exp(-THROW_K * dt); e.vx *= f; e.vy *= f;
    e.flight += dt; if (!e.landed && (Math.hypot(e.vx, e.vy) < 20 || e.flight > 1.4)) e.landed = true;
    if (bounced && sp > 60) this.events.push({ e: 'snd', s: 'bounce', x: r1(e.x), y: r1(e.y) });
    if (e.kind === 'impact' && bounced) return this.detonate(e);
    if (e.kind === 'nitro' || e.kind === 'gas') return; // waits for its owner
    if (e.fromLand && !e.landed) return; // still in the air: the short fuse starts when it lands
    e.fuse -= dt;
    if (e.fuse <= 0) this.detonate(e);
  }

  // TORQUE's saw disc: flies straight, slicing a thin see-through slit through every soft wall and barricade it crosses
  // (a row of hole points across the disc's width, so you can see and shoot along the cut), wrecking gadgets on the way;
  // it stops in anything solid or in the first person it hits
  tickSaw(e, dt) {
    const m = this.map, step = Math.hypot(e.vx, e.vy) * dt, dx = e.vx / (step / dt), dy = e.vy / (step / dt);
    let hitT = null, hitQ = null;
    for (const q of this.players.values()) {
      if (!q.alive || q.id === e.owner) continue;
      const t = rayCircle(e.x, e.y, dx, dy, q.x, q.y, hitR(q.op) + 2);
      if (t !== null && t <= step && (hitT === null || t < hitT)) { hitT = t; hitQ = q; }
    }
    for (const o of [...this.ents]) if (o.team !== e.team && o.hp && o !== e) { const t = rayCircle(e.x, e.y, dx, dy, o.x, o.y, 6); if (t !== null && t <= step && (hitT === null || t < hitT)) this.hitEnt(o, this.players.get(e.owner)); }
    let stopT = null;
    walkRay(e.x, e.y, dx, dy, step, (cx, cy, t) => {
      const k = cy * m.W + cx, tile = m.tiles[k];
      if (tile === T.SOFT || tile === T.BARRI) {
        if (!e.cut.includes(k)) { e.cut.push(k); if (tile === T.BARRI) this.sawHole(k, e.x + dx * (t + 3), e.y + dy * (t + 3)); else this.sawSlit(k, cx, cy, e.x, e.y, dx, dy); this.events.push({ e: 'hit', k: tile === T.BARRI ? 'wood' : 'wall', x: r1(e.x + dx * t), y: r1(e.y + dy * t) }); this.noise(e.x, e.y, e.team, 600); }
        return false;
      }
      if (blocksDrone(tile) || tile === T.VOID) { stopT = t; return true; }
      return false;
    });
    if (hitQ && (stopT === null || hitT < stopT)) {
      const src = this.players.get(e.owner);
      this.damage(hitQ, 60, src || null, 'Saw Disc', Math.atan2(dy, dx)); this.removeEnt(e);
      this.events.push({ e: 'hit', k: 'flesh', x: r1(hitQ.x), y: r1(hitQ.y) }); return;
    }
    if (stopT !== null) { this.events.push({ e: 'hit', k: 'spark', x: r1(e.x + dx * stopT), y: r1(e.y + dy * stopT) }); this.events.push({ e: 'snd', s: 'break', x: r1(e.x), y: r1(e.y) }); this.removeEnt(e); return; }
    e.x += e.vx * dt; e.y += e.vy * dt; e.travel += step; e.ang += dt * 40;
    if (e.travel > 600) this.removeEnt(e);
  }
  // TORQUE through a wooden barricade (he asked): straight through, leaving one round hole the size of the disc, nothing else broken
  sawHole(k, x, y) {
    const h = this.map.holes[k] || (this.map.holes[k] = []);
    for (let oy = -4; oy <= 4; oy += 2) for (let ox = -4; ox <= 4; ox += 2) if (ox * ox + oy * oy <= 17 && h.length < 120) { const hx = r1(x + ox), hy = r1(y + oy); h.push(hx, hy); this.addHole(k, hx, hy); }
  }
  sawSlit(k, cx, cy, x0, y0, dx, dy) { // hole points along the disc's path through the cell, three across its width
    const h = this.map.holes[k] || (this.map.holes[k] = []);
    const tin = [dx > 0 ? (cx * CELL - x0) / dx : dx < 0 ? ((cx + 1) * CELL - x0) / dx : -Infinity, dy > 0 ? (cy * CELL - y0) / dy : dy < 0 ? ((cy + 1) * CELL - y0) / dy : -Infinity];
    const tout = [dx > 0 ? ((cx + 1) * CELL - x0) / dx : dx < 0 ? (cx * CELL - x0) / dx : Infinity, dy > 0 ? ((cy + 1) * CELL - y0) / dy : dy < 0 ? (cy * CELL - y0) / dy : Infinity];
    const a = Math.max(0, ...tin), b = Math.min(...tout);
    for (let t = a + 1; t < b; t += 2) for (const o of [-2.6, 0, 2.6]) {
      const hx = r1(x0 + dx * t - dy * o), hy = r1(y0 + dy * t + dx * o);
      if (h.length < 120) { h.push(hx, hy); this.addHole(k, hx, hy); }
    }
  }

  detonate(e) {
    this.removeEnt(e);
    const kind = e.type === 'nade' ? e.kind : e.type;
    const SOFTISH = [T.SOFT, T.BARRI, T.HATCH, T.RUBBLE, T.BEAM];
    switch (kind) {
      case 'frag': this.explode(e, { r: 75, dmg: 130, cellR: 14, cells: SOFTISH, kind: 'frag' }); break;
      case 'impact': this.explode(e, { r: 34, dmg: 40, cellR: 22, cells: SOFTISH, kind: 'impact' }); break;
      case 'nitro': this.explode(e, { r: 70, dmg: 140, cellR: 20, cells: SOFTISH, kind: 'nitro', floor: true }); break; // nitro on an upper floor blows a hole in it
      case 'slug': this.explode(e, { r: 36, dmg: 75, cellR: 21, cells: SOFTISH, kind: 'slug', selfMul: 0.3 }); break;
      case 'breach': this.explode(e, { r: 40, dmg: 60, cellR: 21, cells: SOFTISH, kind: 'breach', at: e.cell, floor: e.floor }); break;
      case 'claymore': this.explode(e, { r: 50, dmg: 95, cellR: 0, cells: [], kind: 'frag', cone: e.ang }); break;
      case 'mine': {
        this.explode(e, { r: 32, dmg: 40, cellR: 0, cells: [], kind: 'mine' });
        for (const q of this.players.values()) if (q.alive && this.side(q) !== e.team && Math.hypot(q.x - e.x, q.y - e.y) < 40) {
          this.effect(q, 'slow', 3, e.team); this.spot(e.team, q.id, 4);
        }
        break;
      }
      case 'cutter': this.explode(e, { r: 30, dmg: 40, cellR: 40, cells: [T.SOFT, T.REINF, T.BARRI, T.PANEL, T.DSHIELD, T.HATCH, T.HATCHR, T.RUBBLE, T.BEAM], kind: 'cutter', at: e.cell, floor: e.floor }); break;
      case 'sonar': {
        let any = false;
        // measured in the building (he asked: it couldn't reach up the stairs): the floor above or below counts too, a bit less far
        const le = localPos(this.map, e.x, e.y);
        for (const q of this.players.values()) { if (!q.alive || this.side(q) === e.team || this.ghost(q)) continue; const lq = localPos(this.map, q.x, q.y), df = Math.abs(lq.f - le.f);
          if (df <= 1 && Math.hypot(lq.x - le.x, lq.y - le.y) + df * 60 < 230) { this.spot(e.team, q.id, 2.5); any = true; } }
        this.events.push({ e: 'ping', x: r1(e.x), y: r1(e.y), team: e.team, any, big: 1 });
        break;
      }
      case 'gas': this.ents.push({ id: this.eid(), type: 'gascloud', x: e.x, y: e.y, r: 58, life: 8, team: e.team, owner: e.owner }); this.events.push({ e: 'snd', s: 'smoke', x: r1(e.x), y: r1(e.y) }); break;
      case 'cam': this.ents.push({ id: this.eid(), type: 'cam', x: e.x, y: e.y, team: e.team, owner: e.owner, hp: 1, offUntil: 0, ang: Math.atan2(e.vy || 0, e.vx || 1) }); this.events.push({ e: 'snd', s: 'place', x: r1(e.x), y: r1(e.y) }); break;
      case 'prox': this.explode(e, { r: 48, dmg: 90, cellR: 0, cells: [], kind: 'frag' }); break;
      case 'concuss': {
        this.explode(e, { r: 30, dmg: 15, cellR: 0, cells: [], kind: 'impact' });
        for (const q of this.players.values()) if (q.alive && this.side(q) !== e.team && Math.hypot(q.x - e.x, q.y - e.y) < 50) {
          this.effect(q, 'slow', 4, e.team); this.effect(q, 'daze', 4, e.team); this.events.push({ e: 'daze', id: q.id, dur: 4 });
        }
        break;
      }
      case 'cluster': // three waves of bomblets into the room behind the wall, 0.6 s apart
        for (let n = 0; n < 3; n++) this.ents.push({ id: this.eid(), type: 'clusterwave', n, t: n * 0.6, cell: e.cell, dx: e.dx, dy: e.dy, x: e.x, y: e.y, team: e.team, owner: e.owner });
        break;
      case 'smoke': this.ents.push({ id: this.eid(), type: 'smoke', x: e.x, y: e.y, r: 62, life: 12, team: e.team }); this.events.push({ e: 'snd', s: 'smoke', x: r1(e.x), y: r1(e.y) }); break;
      case 'flare': { // BLAZE: blinds the defenders who are looking at it
        this.events.push({ e: 'boom', x: r1(e.x), y: r1(e.y), r: 30, kind: 'stun' });
        for (const q of this.players.values()) {
          if (!q.alive || this.side(q) === e.team) continue;
          const d = Math.hypot(q.x - e.x, q.y - e.y);
          if (d < 230 && Math.abs(angDiff(Math.atan2(e.y - q.y, e.x - q.x), q.aim)) < 1.1 && los(this.map, e.x, e.y, q.x, q.y)) {
            const dur = 2.2 * (1 - d / 330);
            this.effect(q, 'blind', dur, e.team);
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
      case 'stun': {
        this.events.push({ e: 'boom', x: r1(e.x), y: r1(e.y), r: 40, kind: 'stun' });
        for (const q of this.players.values()) {
          if (!q.alive) continue;
          const d = Math.hypot(q.x - e.x, q.y - e.y);
          if (d < 170 && los(this.map, e.x, e.y, q.x, q.y)) {
            const dur = 3.5 * (1 - d / 220);
            this.effect(q, 'blind', dur, e.team);
            this.events.push({ e: 'stun', id: q.id, dur: r2(dur) });
          }
        }
        break;
      }
      case 'emp': { // through walls: nothing but distance from the centre counts
        const cx = e.x + (e.wx || 0) * 10, cy = e.y + (e.wy || 0) * 10;
        this.events.push({ e: 'boom', x: r1(cx), y: r1(cy), r: EMP_R, kind: 'emp' });
        for (const o of [...this.ents]) {
          if (o.team === e.team || Math.hypot(o.x - cx, o.y - cy) > EMP_R + (o.type === 'cam' ? 6 : 0)) continue;
          if (o.type === 'cam') o.offUntil = this.time + 20;
          else if (['jammer', 'mine', 'nade', 'claymore', 'prox', 'concuss', 'clamp', 'sensor', 'grid', 'gascloud', 'alarm', 'catcher', 'radar', 'station', 'scope', 'spike', 'echobox', 'plates'].includes(o.type)) this.removeEnt(o);
        }
        // defenders caught in it: their skill and gadget are fried for 8 s, a held scan or shroud cuts out
        for (const q of this.players.values()) if (q.alive && this.side(q) !== e.team && Math.hypot(q.x - cx, q.y - cy) < EMP_R + 10) {
          q.empUntil = this.time + 8; q.scanning = false; q.scanOn = false; if (q.shrouded) q.shrouded = false;
          this.events.push({ e: 'emped', id: q.id, dur: 8 });
        }
        break;
      }
    }
  }

  // the name a blast is known by in the kill feed and the death card: the owner's ability, else the gadget (he asked: say what killed you)
  blastName(e, o) {
    const k = e.type === 'nade' ? e.kind : e.type === 'clusterwave' ? 'cluster' : e.type, own = e.owner != null && this.players.get(e.owner), O = own && OPERATORS[own.op];
    if (O && O.ability.id === k) return O.ability.name;
    if (GADGETS[k]) return GADGETS[k].name;
    const ab = Object.values(OPERATORS).find(x => x.ability.id === k);
    if (ab) return ab.ability.name;
    return o.kind.charAt(0).toUpperCase() + o.kind.slice(1);
  }

  explode(e, o) {
    if (this.zb) o = { ...o, cells: [], cellR: 0, floor: false }; // ZOMBIES: grenades never open walls or gates
    const owner = this.players.get(e.owner);
    this.noise(e.x, e.y, e.team, 1100);
    let cx = e.x, cy = e.y;
    if (o.at !== undefined) { cx = (o.at % this.map.W + 0.5) * CELL; cy = (Math.floor(o.at / this.map.W) + 0.5) * CELL; }
    this.events.push({ e: 'boom', x: r1(e.x), y: r1(e.y), r: o.r, kind: o.kind });
    for (const g of [...this.ents]) if (g !== e && g.team !== e.team && (g.hp || g.type === 'wire') && Math.hypot(g.x - e.x, g.y - e.y) < o.r * 0.8) this.hitEnt(g, owner);
    for (const g of [...this.ents]) if (g.type === 'cover' && Math.hypot(g.x - e.x, g.y - e.y) < o.r) this.coverDamage(g, (o.dmg || 60) * 2.5); // blasts wreck covers
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
    if (o.floor) this.blowFloor(o.at !== undefined && e.floor ? cx + CELL / 2 : cx, o.at !== undefined && e.floor ? cy + CELL / 2 : cy); // a charge on the floor: the hole is centred on it
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
      this.damage(q, dmg, owner, this.blastName(e, o), Math.atan2(q.y - e.y, q.x - e.x));
    }
    for (const g of [...this.ents]) {
      if (g === e || g.team === e.team || Math.hypot(g.x - e.x, g.y - e.y) > o.r) continue;
      if (g.type === 'cam') g.hp = 0;
      else if (['drone', 'bird', 'jammer', 'mine', 'wire', 'claymore', 'dart', 'cutter', 'breach'].includes(g.type)) { this.removeEnt(g); if (g.type === 'drone' || g.type === 'bird') this.droneLost(g); }
    }
  }

  checkReveal() {
    if (this.arena || this.zb) return;
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
    if (this.tv) for (const sk of this.tv.socks) if (sk.open) sk.send(msg); // TV viewers hear both teams' calls
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
  botLoadout(op, p) {
    if (p && p.pro) return proLoadout(this, p, op); // the pros: what they found strong in practice
    const L = LOADOUTS[op], pick = a => a.length ? a[Math.floor(Math.random() * a.length)] : null;
    const l = { primary: pick(L.primaries), secondary: pick(L.secondaries), gadget: pick(L.gadgets), att: {} };
    for (const w of [l.primary, l.secondary]) if (w && WEAPONS[w]) { const o = attachFor(w); l.att[w] = { barrel: pick(o.barrel), grip: pick(o.grip), sight: pick(o.sight) }; }
    return cleanLoadout(op, l);
  }
  statLine(p, left = false) {
    const ms = p.ms || this.blankMatchStats();
    return { name: p.name, bot: !!p.bot, pid: p.pid || null, token: p.token || null, squad: p.squad, left, ...ms, damage: Math.round(ms.damage), playSeconds: Math.round(ms.playSeconds) };
  }
  saveMatch(winner) {
    if (this.tut || this.free || this.tv) return null; // tutorials, free play and esports TV never count
    const players = [...[...this.players.values()].map(p => this.statLine(p)), ...(this.departed || [])];
    if (!players.some(p => p.token)) return null; // nobody real played
    const strength = [0, 1].map(s => { const v = players.filter(q => q.squad === s).map(q => q.token ? ((store.byToken(q.token) || {}).mmr ?? START_MMR) : mmrOfRank(this.botLevel)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : mmrOfRank(this.botLevel); });
    return store.recordMatch({ strength: this.ranked ? strength : null,
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), date: Date.now(),
      duration: Math.round((Date.now() - (this.matchStart || Date.now())) / 1000),
      map: this.map.name, mode: ({ quick: 'Quick Match', unranked: 'Unranked', ranked: 'Ranked' })[this.mode] || 'Quick Match', score: [...this.score], winner, rounds: this.roundLog || [], players,
    });
  }

  // ---------------- snapshot ----------------
  broadcast() {
    const cells = [];
    for (const k of this.changed) cells.push(k, this.map.tiles[k], Math.max(0, Math.round(this.map.hp[k])));
    const by = { atk: 1, def: 2 }, cb = [], hb = [];
    for (const k of this.changed) cb.push(by[this.chBy.get(k)] || 0);
    for (let i = 0; i < this.newHoles.length; i += 3) hb.push(by[this.holeBy.get(this.newHoles[i])] || 0);
    this.changed.clear(); this.chBy.clear(); this.holeBy.clear(); const holes = this.newHoles; this.newHoles = [];
    const mine = new Map(); // details only the player themself needs (ammo, gadget counts, recoil...) go to them alone
    const players = [...this.players.values()].map(p => {
      const g = p.guns[p.slot];
      const o = {
        id: p.id, n: p.name, b: p.bot ? 1 : 0, sq: p.squad, ar: this.arena ? arenaPlayer(this, p) : undefined, zb: this.zb ? zbPlayer(this, p) : undefined, tm: this.round ? this.side(p) : (p.squad === 0 ? 'atk' : 'def'),
        op: p.op, a: p.alive ? 1 : 0, bt: p.bot ? 1 : undefined, rn: p.bot || !p.token ? undefined : rankOf(p.mmr), k: p.kills, d: p.deaths, sc: p.score || 0, ms: p.rtt,
      };
      if (p.alive) Object.assign(o, {
        dn: p.downed ? 1 : 0, hp: Math.ceil(p.hp), mhp: p.maxHp, x: r1(p.x), y: r1(p.y), ag: r2(p.aim), sg: p.staged ? 1 : undefined,
        el: p.up ? 1 : p.air > 0 ? 2 : undefined, le: p.lo ? r1(p.lo) : undefined, rp: p.rope ? (p.rope.st === 'hang' ? (p.rope.inv ? 3 : 1) : 2) : undefined, sl: p.slot, w: g ? g.w : null, rl: p.reloadT > 0 ? r2(1 - p.reloadT / (p.reloadLen || WEAPONS[g.w].reload)) : 0, rq: p.reloadT > 0 && p.reloadLen && p.reloadLen !== WEAPONS[g.w].reload ? r2(p.reloadLen) : undefined,
        ct: p.ctrl, cf: this.tv && p.ctrl === 'cam' ? p.feedId : undefined, // ESPORTS TV: which camera they are looking through
        bu: p.busy ? { k: p.busy.k, p: r2(p.busy.t / p.busy.dur) } : p.grapple ? { k: 'grapple', p: r2(p.grapple.t / p.grapple.dur) } : null, df: p.hasDefuser ? 1 : 0,
        gh: p.ghillieUntil > this.time ? 1 : undefined, bp: p.bipodSet ? 1 : undefined, // MOSS's ghillie (no glint), PERCH's bipod
        gt: r2(p.gait || 0), mv: p.moving, so: p.bracing && this.time < (p.shieldDownUntil || 0) ? 2 : undefined, sa: p.bracing && p.aside ? r2(p.aside) : undefined, ad: p.input.ads ? 1 : 0, cr: p.input.crouch || p.pr || p.slR > 0 ? 1 : 0, sd: p.slT > 0 ? 1 : undefined, pn: p.pr >= 1 ? 1 : undefined, wk: p.input.walk ? 1 : 0,br: p.bracing ? 1 : 0, ri: p.riot && !p.riotBroken ? p.riot : undefined, au: p.ctrl === 'body' && !p.downed && !p.rope && aimUpHatch(this.map, p.x, p.y, p.aimX, p.aimY) ? 1 : undefined, sb: p.shieldMode === 'gun' ? 1 : 0, sw: p.switchUntil > this.time ? 1 : 0, sc: p.scanning ? 1 : 0,
        aa: g && g.att ? attCode(g.att) : '',
        si: this.ghost(p) || p.shrouded ? 1 : 0, sh: p.shrouded ? 1 : 0, ln: p.lancing ? 1 : 0, bo: this.time < (p.boostUntil || 0) ? 1 : 0,
        dz: this.time < (p.dazeUntil || 0) ? 1 : 0,
        ef: this.efOut(p),
      });
      if (p.staged) { o.x = undefined; o.y = undefined; } // nobody else learns where a waiting attacker is
      if (this.phase === PHASE.SELECT || this.phase === PHASE.PREP) { o.lk = p.locked ? 1 : 0; o.jb = p.job || undefined; if (this.side(p) === TEAM.ATK) { o.spn = this.map.atkSpawns.indexOf(this.spawnOf(p)); if (!p.spawn) o.sr = 1; } }
      if (p.alive && (p.sock || (this.tv && p.id === this.tv.follow))) mine.set(p.id, JSON.stringify({
        ga: this.free ? p.guns.map(q => q.w + ':' + attCode(q.att)) : undefined, // free play's gun menu shows what each held gun carries
        am: g ? g.ammo : 0, rs: g ? g.reserve : 0, ac: p.abilityCount, ap: p.pierceShot ? 1 : undefined, su2: p.spotterUntil > this.time ? r1(p.spotterUntil - this.time) : undefined, gw2: p.ghillieUntil > this.time ? r1(p.ghillieUntil - this.time) : undefined, gc: p.gadgetCount, bx: p.barri, pr: r1(Math.max(0, (p.pingReady || 0) - this.time)), bl: p.scanning && p.scanBlips ? [...p.scanBlips.values()].map(z => [r1(z.x), r1(z.y), r2(this.time - z.t)]) : undefined, gd: p.gadget, dr: p.drones, fi: p.ctrl === 'cam' ? p.feedId : null, did: p.droneId,
        vx: r1(p.vx || 0), vy: r1(p.vy || 0), rc: Math.round((p.rc || 0) * 10000) / 10000, sh: p.shots || 0, at: r2(p.adsT || 0),
        bat: r1(p.battery), ro: p.rope ? [p.rope.st === 'hang' ? 1 : 0, p.rope.r, p.rope.to, r2(p.rope.t / p.rope.dur), p.rope.climb ? 1 : 0, p.rope.inv ? 1 : 0, p.rope.from ?? -1] : undefined, ds: p.sprints, dsl: r2(Math.max(0, (p.sprintUntil || 0) - this.time)), dsc: r2(Math.max(0, (p.sprintCd || 0) - this.time)), st: r2(Math.max(0, p.stunUntil - this.time)), ls: p.lastSeq, ni: p.nitroId ? 1 : 0,
        ...(p.staged ? { x: r1(this.spawnOf(p).x), y: r1(this.spawnOf(p).y) } : {}),
        pp: p.prep ? [p.prep.mode === 'throw' ? 1 : 2, r2(Math.max(0, p.prep.until - this.time)), p.prep.dur] : undefined, m: this.mods(p), jp: [r2(p.air || 0), p.up ? 1 : 0, r2(p.jcd || 0), r1(p.lo || 0), r2(p.pr || 0), r2(p.slT || 0), r2(p.slR || 0), r2(p.slA || 0), r2(p.scd || 0)], vt: p.vault ? [r1(p.vault.x0), r1(p.vault.y0), r1(p.vault.x1), r1(p.vault.y1), r2(p.vault.t), r2(p.vault.dur)] : undefined, fs: r2(this.time - p.lastShot), gi: p.gasId ? 1 : 0, lu: p.lungeUntil > this.time ? r1(p.lungeUntil - this.time) : undefined, df: p.deafUntil > this.time ? 1 : undefined, su: p.downed && SELF_UP.has(p.op) ? r2(p.selfUp / SELF_UP_TIME) : undefined, scd: p.shroudCd > this.time ? r1(p.shroudCd - this.time) : undefined,
      }));
      return o;
    });
    const ents = this.ents.map(e => {
      const o = { id: e.id, ty: e.type, x: r1(e.x), y: r1(e.y), tm: e.team };
      if (e.owner) o.ow = e.owner;
      if (e.kind) o.kd = e.kind;
      if (e.ang !== undefined) o.ag = r2(e.ang);
      if (e.type === 'cam') { o.hp = e.hp; o.off = e.offUntil > this.time ? 1 : 0; if (e.tu) { o.tu = 1; if (e.coolUntil > this.time) o.hot = 1; } if (e.wn !== null && e.wn !== undefined) { o.wn = r2(e.wn); o.ws = r2(e.ws); } if (e.oc !== undefined) o.oc = e.oc; }
      if (e.type === 'decoy') { o.op = e.op; o.w = e.w; }
      if (e.type === 'cover') o.hl = e.hl;
      if (e.type === 'plates') o.c = e.c;
      if (e.type === 'gascloud') { o.r = e.r; o.l = r1(e.life); }
      if (e.type === 'cluster') o.t = r1(e.t);
      if (e.type === 'smoke') { o.r = e.r; o.l = r1(e.life); if (e.puffs) { o.pf = e.puffs; o.sk = e.kind; } }
      if (e.type === 'scope' && e.fl) o.fl = e.fl;
      if (e.type === 'scope' && e.shieldUntil > this.time) o.sh = r1(e.shieldUntil - this.time);
      if (e.type === 'sticky' && e.stuck) o.st = 1;
      if (e.type === 'drill' || e.type === 'dropch') o.t = r1(e.t);
      if (e.type === 'cutter' || e.type === 'breach') { o.t = r1(e.t); o.j = this.jammedAt(e.x, e.y) ? 1 : 0; }
      if (e.type === 'drone') { o.j = this.jammedAt(e.x, e.y) ? 1 : 0; o.vx = r1(e.vx || 0); o.vy = r1(e.vy || 0); if (e.grab) o.gr = 1; }
      if (e.type === 'bird') { o.vx = r1(e.vx || 0); o.vy = r1(e.vy || 0); if (e.perch) o.pe = 1; if (e.auto) o.au = 1; }
      if (e.type === 'swarm') { o.tg = e.target; if (e.grab) o.gr = 1; }
      return o;
    });
    const spots = { atk: [...this.spots.atk.keys()], def: [...this.spots.def.keys()] };
    const common = JSON.stringify({
      ou: [...this.players.values()].filter(p => p.outside && p.alive).map(p => p.id),
      ph: this.phase, tm: r1(Math.max(0, this.timer)), rd: this.round, sc: this.score, mv: this.mapVersion, dh: this.map.dyn && this.map.dyn.length ? this.map.dyn : undefined, pp: this.map.peeps && this.map.peeps.length ? this.map.peeps : undefined, mp: this.mapId, rm: this.randomMap ? 1 : 0,
      site: this.site, su: this.sitesUsed || [], rev: this.siteRevealed ? 1 : 0, pl: this.planted ? { x: r1(this.planted.x), y: r1(this.planted.y), b: this.planted.bomb, t: r1(this.planted.t) } : null,
      tvl: this.tv ? this.botLevel : undefined, md: this.tut || this.free || this.tv ? undefined : this.mode, ar: arenaInfo(this), zb: zbInfo(this), ot: inOvertime(this.rules, this.score) ? 1 : undefined, wr: roundsToWin(this.rules, this.score), bn: (this.tv || this.rules.bans) && this.bans ? this.bans.map(b => [b.op, b.sq, b.rd]) : undefined,
      bq: (this.tv || this.rules.bans) && this.phase === PHASE.SELECT && this.banRun && this.banRun.round === this.round && this.banRun.i < this.banRun.order.length ? [...this.banRun.order[this.banRun.i], r1(Math.max(0, (this.banRun.t ?? this.time) - this.time)), this.banRun.i, this.banRun.order.length] : undefined, rf: this.reinforce, win: this.winner, tu: this.tut ? { ...this.tut.info, ls: this.tut.lesson, hold: this.tut.hold ? 1 : 0 } : undefined, why: this.reason, spawn: this.spawnName, fp: this.free ? 1 : undefined, bl: this.botLevel, rk: this.ranked ? 1 : 0,
      players, ents, cells, holes, cb, hb, ev: this.events, spots, time: r2(this.time),
    });
    this.events = [];
    for (const p of this.players.values()) if (p.sock && p.sock.open) p.sock.send('{"t":"snap","you":"' + p.id + '",' + (mine.has(p.id) ? '"mine":' + mine.get(p.id) + ',' : '') + common.slice(1));
    if (this.tv) { const f = this.tv.follow, msg = '{"t":"snap","tv":1,"you":' + JSON.stringify(f) + ',' + (f && mine.has(f) ? '"mine":' + mine.get(f) + ',' : '') + common.slice(1); for (const sk of this.tv.socks) if (sk.open) sk.send(msg); }
  }
}
// every shot's line, for the killcam (kept 6 s)
const hitscan0 = Game.prototype.hitscan;
Game.prototype.hitscan = function (src, x0, y0, ...rest) {
  const r = hitscan0.call(this, src, x0, y0, ...rest);
  if (src) { const L = this.shotLog || (this.shotLog = []); L.push({ t: this.time, id: src.id, x0: r1(x0), y0: r1(y0), x: r1(r.x), y: r1(r.y) }); if (L.length > 400) L.splice(0, 150); }
  return r;
};
// who is acting, for `this.by` (map changes your own side makes reach your map at once): a player's input and tick,
// a blast's team, a shot's shooter
for (const [name, who] of [['handle', (g, p) => g.side(p)], ['tickPlayer', (g, p) => g.side(p)], ['explode', (g, e) => e && e.team], ['hitscan', (g, src) => src && src.squad !== undefined ? g.side(src) : null]]) {
  const f0 = Game.prototype[name];
  Game.prototype[name] = function (a, ...rest) {
    const was = this.by; this.by = who(this, a) || was;
    try { return f0.call(this, a, ...rest); } finally { this.by = was; }
  };
}
