// Visual tuning, playfield dimensions, speeds, and neon color palette for Stardust Courier.
// The logical canvas is fixed at 1280x720 and scaled cleanly to fit any viewport.

export const WIDTH = 1280;
export const HEIGHT = 720;
export const FIELD = { width: WIDTH, height: HEIGHT, groundY: HEIGHT };

/** Fixed simulation step (60 Hz). */
export const STEP = 1 / 60;

export const LIVES = 3;

export const PLAYER = {
  r: 16,
  radius: 16,
  width: 32,
  height: 32,
  speed: 440,
  invulnerable: 1.2,
};

export const ORB = {
  starRadius: 12,
  bonusRadius: 16,
  r: 12,
  speed: 155,
  speedPerLevel: 18,
  spawnInterval: 0.72,
  minInterval: 0.25,
  starPoints: 10,
  bonusPoints: 50,
  bonusChance: 0.2,
};

export const COMET = {
  r: 20,
  minRadius: 16,
  maxRadius: 26,
  speed: 235,
  speedPerLevel: 32,
  spawnInterval: 1.15,
  intervalScale: 0.88,
  minInterval: 0.28,
};

export const POWERUP = {
  r: 15,
  speed: 140,
  spawnInterval: 8.5,
  doubleDuration: 10,
};

export const COMBO = {
  duration: 2.5,
  window: 2.5,
  max: 8,
};

export const LEVEL = {
  seconds: 15,
  duration: 15,
  max: 12,
};

export const PALETTE = {
  backdrop: '#030511',
  spaceTop: '#04071a',
  spaceMid: '#090d2a',
  spaceBottom: '#100926',
  nebulaCyan: 'rgba(0, 229, 255, 0.14)',
  nebulaMagenta: 'rgba(255, 42, 133, 0.13)',
  nebulaViolet: 'rgba(123, 44, 191, 0.16)',
  grid: 'rgba(0, 229, 255, 0.07)',
  shipHull: '#e0faff',
  shipWing: '#00e5ff',
  shipAccent: '#ff2a85',
  shipCore: '#72efdd',
  trailCyan: '#00f5ff',
  trailMagenta: '#ff2a85',
  shield: '#00ffaa',
  shieldGlow: '#00e5ff',
  double: '#ffd166',
  doubleGlow: '#ff2a85',
  orbStar: '#00f5ff',
  orbStarCore: '#ffffff',
  orbBonus: '#ffd700',
  orbBonusGlow: '#ff38b8',
  cometCore: '#13091f',
  cometRim: '#ff2a6d',
  cometGlow: '#ff5e3a',
  cometTail: '#9d174d',
  heartFull: '#ff2a85',
  heartGlow: '#ff75b5',
  heartEmpty: 'rgba(255, 255, 255, 0.16)',
  hudBg: 'rgba(8, 14, 38, 0.76)',
  hudBorder: 'rgba(0, 229, 255, 0.38)',
  panelBg: 'rgba(7, 11, 30, 0.88)',
  panelBorder: '#00e5ff',
  text: '#f0f8ff',
  muted: '#94a9c9',
  cyan: '#00f5ff',
  magenta: '#ff2a85',
  gold: '#ffd166',
  danger: '#ff2a6d',
};

export const COLORS = PALETTE;

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const MONO_FONT = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

export const BEST_KEY = 'stardust-courier.best';

export const CONFIG = {
  width: WIDTH,
  height: HEIGHT,
  canvasWidth: WIDTH,
  canvasHeight: HEIGHT,
  field: FIELD,
  step: STEP,
  lives: LIVES,
  initialLives: LIVES,
  maxLives: LIVES,
  playerSpeed: PLAYER.speed,
  playerRadius: PLAYER.r,
  player: PLAYER,
  orbSpeed: ORB.speed,
  orbRadius: ORB.starRadius,
  bonusRadius: ORB.bonusRadius,
  starPoints: ORB.starPoints,
  bonusPoints: ORB.bonusPoints,
  orbs: ORB,
  cometSpeed: COMET.speed,
  cometRadius: COMET.r,
  comets: COMET,
  doubleDuration: POWERUP.doubleDuration,
  powerupDuration: POWERUP.doubleDuration,
  powerupRadius: POWERUP.r,
  powerups: POWERUP,
  comboWindow: COMBO.window,
  comboDuration: COMBO.duration,
  comboTimeout: COMBO.duration,
  maxCombo: COMBO.max,
  combo: COMBO,
  levelDuration: LEVEL.seconds,
  levelSeconds: LEVEL.seconds,
  level: LEVEL,
  colors: PALETTE,
  palette: PALETTE,
};

export const config = CONFIG;
export default CONFIG;
