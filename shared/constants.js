// Shared numbers and tile rules used by both the server and the browser.

export const CELL = 16;            // world pixels per map cell
// Real-world scale: a body (20 px across) is ~0.55 m at the shoulders and a 2-cell door ~0.9 m,
// so 1 metre = 36 world px (a cell is ~0.44 m). Movement speeds are written in m/s and converted.
export const PX_PER_M = 36;
export const TICK_RATE = 30;       // server simulation steps per second
export const SNAP_RATE = 20;       // snapshots sent per second
// Body radius for bumping into walls and people. 7 px (14 across, ~0.4 m: a person turned a little
// sideways) so a body fits through every one-cell gap beside furniture and round door frames; at 10 a
// lot of rooms had corners and gaps behind bookcases nobody could get into. Bullets use HIT_R instead.
export const PLAYER_R = 7;
export const DRONE_R = 3.5;         // a foot-long, half-foot-wide drone; small enough for the drone holes at the foot of walls (map.dhole)
export const MAX_PLAYERS = 10;
export const TEAM_SIZE = 5;
export const BOT_LEVELS = ['Easy', 'Normal', 'Hard', 'Expert']; // bot skill, chosen in the lobby / free play (game.botLevel)
export const WIN_ROUNDS = 3;       // Quick Match: first to 3

export const PHASE = {
  LOBBY: 'lobby', SELECT: 'select', PREP: 'prep', ACTION: 'action',
  ROUND_END: 'roundEnd', MATCH_END: 'matchEnd',
};

export const DUR = {
  select: 15, prep: 40, action: 180, roundEnd: 7, matchEnd: 12,
  plant: 7, defuse: 7, bomb: 45, reinforce: 3, barricade: 1.2, revive: 4,
  bleedout: 20, spot: 5,
};

// Tile kinds
export const T = {
  GROUND: 0, FLOOR: 1, HARD: 2, SOFT: 3, REINF: 4, BARRI: 5, OPEN: 6,
  LOW: 7, TALL: 8, PANEL: 9, DSHIELD: 10,
  VOID: 11,  // outside a floor: open air above ground, solid earth below — nothing passes
  STAIR: 12, // staircase: walkable; the far end takes you to the other floor (map.portal)
  // Hatches: 2x2 trapdoors in an upper floor above a room on the floor below (map.hatches). Walkable floor
  // while shut; defenders reinforce them, explosives / shotguns / melee open them. HOLE = opened: you drop
  // through it (map.portal), and you can look and shoot through it to the other floor.
  HATCH: 13, HATCHR: 14, HOLE: 15,
  RUBBLE: 16, // the waist-high stub of a soft wall knocked through by melee or shotguns: you vault over it (or knife it clear)
};

// Floor looks
export const FL = {
  GRASS: 0, ASPHALT: 1, WOOD: 2, TILE: 3, CARPET: 4, CONCRETE: 5, MARBLE: 6, SERVER: 7, VOID: 8,
};

// Wall materials (for drawing)
export const MAT = { DRYWALL: 0, BRICK: 1, CONCRETE: 2 };

export const CELL_HP = { [T.HATCH]: 60, [T.SOFT]: 60, [T.BARRI]: 60, [T.PANEL]: 400, [T.DSHIELD]: 300 };

const MOVE_BLOCK = new Set([T.HARD, T.SOFT, T.REINF, T.BARRI, T.LOW, T.TALL, T.PANEL, T.DSHIELD, T.VOID, T.RUBBLE]);
const DRONE_BLOCK = new Set([T.HARD, T.SOFT, T.REINF, T.TALL, T.PANEL, T.DSHIELD, T.LOW, T.VOID, T.HOLE]); // drones fit through barricade gaps but not under furniture
const SIGHT_BLOCK = new Set([T.HARD, T.SOFT, T.REINF, T.BARRI, T.TALL, T.PANEL, T.VOID]);
const BULLET_STOP = new Set([T.HARD, T.REINF, T.TALL, T.PANEL, T.DSHIELD, T.VOID]);
const BULLET_PEN = new Set([T.SOFT, T.BARRI]);
// Pistols, SMGs, machine pistols, rifles and LMGs only punch small bullet holes in soft walls:
// the wall never breaks, but each hole is a thin line of sight. Shotguns, DMRs, melee and
// explosives still break soft walls open.
export const HOLE_ONLY = new Set(['Pistol', 'SMG', 'MP', 'AR', 'LMG']);
export const HOLE_R = 1.4;   // a sight line passes a hole if it comes this close to its centre (world px)
export const HOLE_MAX = 24;  // holes kept per wall cell

export const blocksMove = t => MOVE_BLOCK.has(t);
export const blocksDrone = t => DRONE_BLOCK.has(t);
export const blocksSight = t => SIGHT_BLOCK.has(t);
export const stopsBullet = t => BULLET_STOP.has(t);
export const penBullet = t => BULLET_PEN.has(t);
export const walkable = t => t === T.FLOOR || t === T.GROUND || t === T.STAIR || t === T.OPEN || t === T.HATCH || t === T.HATCHR || t === T.HOLE;
export const isHatch = t => t === T.HATCH || t === T.HATCHR || t === T.HOLE;
export const isWall = t => t === T.HARD || t === T.SOFT || t === T.REINF || t === T.BARRI || t === T.PANEL;

export const TEAM = { ATK: 'atk', DEF: 'def' };
export const other = team => (team === TEAM.ATK ? TEAM.DEF : TEAM.ATK);
