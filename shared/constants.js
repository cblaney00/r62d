// Shared numbers and tile rules used by both the server and the browser.

export const CELL = 16;            // world pixels per map cell
export const TICK_RATE = 30;       // server simulation steps per second
export const SNAP_RATE = 20;       // snapshots sent per second
export const PLAYER_R = 10;
export const DRONE_R = 5;
export const MAX_PLAYERS = 10;
export const TEAM_SIZE = 5;
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
};

// Floor looks
export const FL = {
  GRASS: 0, ASPHALT: 1, WOOD: 2, TILE: 3, CARPET: 4, CONCRETE: 5, MARBLE: 6, SERVER: 7,
};

// Wall materials (for drawing)
export const MAT = { DRYWALL: 0, BRICK: 1, CONCRETE: 2 };

export const CELL_HP = { [T.SOFT]: 60, [T.BARRI]: 60, [T.PANEL]: 400, [T.DSHIELD]: 300 };

const MOVE_BLOCK = new Set([T.HARD, T.SOFT, T.REINF, T.BARRI, T.LOW, T.TALL, T.PANEL, T.DSHIELD]);
const DRONE_BLOCK = new Set([T.HARD, T.SOFT, T.REINF, T.TALL, T.PANEL, T.DSHIELD, T.LOW]); // drones fit through barricade gaps but not under furniture
const SIGHT_BLOCK = new Set([T.HARD, T.SOFT, T.REINF, T.BARRI, T.TALL, T.PANEL]);
const BULLET_STOP = new Set([T.HARD, T.REINF, T.TALL, T.PANEL, T.DSHIELD]);
const BULLET_PEN = new Set([T.SOFT, T.BARRI]);

export const blocksMove = t => MOVE_BLOCK.has(t);
export const blocksDrone = t => DRONE_BLOCK.has(t);
export const blocksSight = t => SIGHT_BLOCK.has(t);
export const stopsBullet = t => BULLET_STOP.has(t);
export const penBullet = t => BULLET_PEN.has(t);
export const isWall = t => t === T.HARD || t === T.SOFT || t === T.REINF || t === T.BARRI || t === T.PANEL;

export const TEAM = { ATK: 'atk', DEF: 'def' };
export const other = team => (team === TEAM.ATK ? TEAM.DEF : TEAM.ATK);
