// Shared simulation tuning and renderer visuals for Stardust Courier.
export const WIDTH = 1280;
export const HEIGHT = 720;
export const FIELD = { width: WIDTH, height: HEIGHT, groundY: HEIGHT };

/** Fixed simulation step (120 Hz). */
export const STEP = 1 / 120;
export const LIVES = 3;

export const PLAYER = {
  r: 16,
  radius: 16,
  width: 32,
  height: 32,
  speed: 440,
  invulnerable: 1.5,
};

export const DASH = { cooldown: 2.0, duration: 0.18, speed: 950, invulnerable: 0.35 };

export const ORB = {
  starRadius: 8,
  bonusRadius: 12,
  r: 8,
  speed: 82,
  speedPerLevel: 11,
  spawnInterval: 0.52,
  minInterval: 0.25,
  starPoints: 10,
  bonusPoints: 50,
  bonusChance: 0.12,
};

export const COMET = {
  r: 20,
  minRadius: 14,
  maxRadius: 26,
  speed: 180,
  speedPerLevel: 24,
  spawnInterval: 1.8,
  intervalScale: 0.88,
  minInterval: 0.35,
  splitterLifetime: 4,
  miniRadiusScale: 0.55,
  miniSpeedMultiplier: 1.18,
  homingSpeedMultiplier: 0.78,
  homingTurnRate: 0.65, // Radians per second; slow-time also slows steering.
};

export const ELITE = { r: 34, speedMultiplier: 0.55, dropOrbs: 2, spawnWeight: 0.12 };

export const POWERUP = {
  r: 13,
  speed: 70,
  speedPerLevel: 5,
  firstSpawn: 6,
  spawnInterval: 10,
  doubleDuration: 10,
  magnetDuration: 8,
  magnetRadius: 220,
  magnetPullSpeed: 380,
  slowDuration: 6,
  slowMultiplier: 0.4,
  lifeMax: 3,
  bombPoints: 10,
  weights: { shield: 0.28, double: 0.24, magnet: 0.22, slow: 0.12, life: 0.06, bomb: 0.08 },
};

export const DELIVERY = {
  target: 10,
  radius: 30,
  points: 200,
};

export const GATE = {
  r: DELIVERY.radius,
  deliverTarget: DELIVERY.target,
};

export const COMBO_SECONDS = 2.5;
export const COMBO = {
  duration: COMBO_SECONDS,
  window: COMBO_SECONDS,
  max: 8,
};

export const COMBO_MILESTONES = { 5: 50, 10: 150 };

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
  dash: '#72efdd',
  dashGlow: '#00f5ff',
  shield: '#00ffaa',
  shieldGlow: '#00e5ff',
  double: '#ffd166',
  doubleGlow: '#ff2a85',
  magnet: '#c77dff',
  magnetGlow: '#ff75b5',
  slow: '#72efdd',
  slowGlow: '#00f5ff',
  life: '#ff5d8f',
  lifeGlow: '#ffd166',
  bomb: '#ff6b35',
  bombGlow: '#ffd166',
  gate: '#00ffaa',
  gateGlow: '#00f5ff',
  gateRing: '#ffd166',
  orbStar: '#00f5ff',
  orbStarCore: '#ffffff',
  orbBonus: '#ffd700',
  orbBonusGlow: '#ff38b8',
  cometCore: '#13091f',
  cometRim: '#ff2a6d',
  cometGlow: '#ff5e3a',
  cometTail: '#9d174d',
  cometSplitterCore: '#241107',
  cometSplitterRim: '#ff9e00',
  cometHomingCore: '#1d0933',
  cometHomingRim: '#d946ef',
  cometMiniCore: '#280a1c',
  cometMiniRim: '#ff6b6b',
  elite: '#b5179e',
  eliteGlow: '#f72585',
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
  violet: '#c77dff',
  mint: '#00ffaa',
  danger: '#ff2a6d',
};

export const PARALLAX = {
  layers: [
    { speed: 0.15, size: 1, alpha: 0.5, count: 90 },
    { speed: 0.4, size: 2, alpha: 0.75, count: 55 },
    { speed: 0.9, size: 3, alpha: 1, count: 30 },
  ],
};

// Preserve the renderer's zone visuals and the simulation's spawn rules.
const makeZone = (zone) => ({
  ...zone,
  palette: {
    ...PALETTE,
    spaceTop: zone.spaceTop,
    spaceMid: zone.spaceMid,
    spaceBottom: zone.spaceBottom,
    grid: zone.grid,
    nebulaCyan: zone.nebulae[0].c0,
    nebulaMagenta: zone.nebulae[1].c0,
    nebulaViolet: zone.nebulae[2].c0,
  },
});

export const ZONES = {
  1: makeZone({
    id: 1,
    name: 'NEON FRONTIER',
    spaceTop: '#04071a',
    spaceMid: '#090d2a',
    spaceBottom: '#100926',
    grid: 'rgba(0, 229, 255, 0.048)',
    accent: '#00f5ff',
    bannerSub: 'HYPER-LANE EXPRESSWAY',
    nebulae: [
      { x: 260, y: 210, r: 340, c0: 'rgba(0, 229, 255, 0.14)', c1: 'rgba(0, 119, 255, 0.04)' },
      { x: 980, y: 260, r: 390, c0: 'rgba(255, 42, 133, 0.13)', c1: 'rgba(123, 44, 191, 0.04)' },
      { x: 640, y: 540, r: 420, c0: 'rgba(114, 9, 183, 0.15)', c1: 'rgba(0, 245, 255, 0.03)' },
      { x: 180, y: 580, r: 260, c0: 'rgba(0, 255, 170, 0.09)', c1: 'rgba(0, 0, 0, 0)' },
    ],
    cometSpeedMultiplier: 1,
    cometSpawnMultiplier: 1,
    cometWeights: { normal: 1, splitter: 0, homing: 0 },
  }),
  2: makeZone({
    id: 2,
    name: 'ASTEROID BELT',
    spaceTop: '#12051a',
    spaceMid: '#1f0b2c',
    spaceBottom: '#2b0d1d',
    grid: 'rgba(255, 158, 0, 0.055)',
    accent: '#ff9e00',
    bannerSub: 'FRACTURED DEBRIS CORRIDOR',
    nebulae: [
      { x: 280, y: 200, r: 360, c0: 'rgba(255, 140, 0, 0.15)', c1: 'rgba(255, 42, 109, 0.05)' },
      { x: 960, y: 250, r: 400, c0: 'rgba(255, 42, 109, 0.14)', c1: 'rgba(140, 20, 180, 0.05)' },
      { x: 640, y: 520, r: 430, c0: 'rgba(181, 23, 158, 0.15)', c1: 'rgba(255, 183, 3, 0.04)' },
      { x: 200, y: 570, r: 280, c0: 'rgba(255, 209, 102, 0.10)', c1: 'rgba(0, 0, 0, 0)' },
    ],
    cometSpeedMultiplier: 1.12,
    cometSpawnMultiplier: 1.2,
    cometWeights: { normal: 0.68, splitter: 0.32, homing: 0 },
  }),
  3: makeZone({
    id: 3,
    name: 'PULSAR CORE',
    spaceTop: '#031122',
    spaceMid: '#07223b',
    spaceBottom: '#19083a',
    grid: 'rgba(114, 239, 221, 0.06)',
    accent: '#72efdd',
    bannerSub: 'HIGH-GRAVITY SINGULARITY',
    nebulae: [
      { x: 250, y: 220, r: 370, c0: 'rgba(114, 239, 221, 0.16)', c1: 'rgba(0, 180, 216, 0.05)' },
      { x: 990, y: 240, r: 410, c0: 'rgba(199, 125, 255, 0.16)', c1: 'rgba(114, 9, 183, 0.05)' },
      { x: 640, y: 540, r: 440, c0: 'rgba(255, 42, 133, 0.15)', c1: 'rgba(0, 245, 255, 0.04)' },
      { x: 190, y: 560, r: 290, c0: 'rgba(0, 245, 255, 0.12)', c1: 'rgba(0, 0, 0, 0)' },
    ],
    cometSpeedMultiplier: 1.25,
    cometSpawnMultiplier: 1.45,
    cometWeights: { normal: 0.45, splitter: 0.3, homing: 0.25 },
  }),
};
ZONES[0] = ZONES[1];

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
  dash: DASH,
  orbSpeed: ORB.speed,
  orbRadius: ORB.starRadius,
  bonusRadius: ORB.bonusRadius,
  starPoints: ORB.starPoints,
  bonusPoints: ORB.bonusPoints,
  orbs: ORB,
  cometSpeed: COMET.speed,
  cometRadius: COMET.r,
  comets: COMET,
  elite: ELITE,
  doubleDuration: POWERUP.doubleDuration,
  magnetDuration: POWERUP.magnetDuration,
  slowDuration: POWERUP.slowDuration,
  powerupDuration: POWERUP.doubleDuration,
  powerupRadius: POWERUP.r,
  powerups: POWERUP,
  delivery: DELIVERY,
  gate: GATE,
  zones: ZONES,
  ZONES,
  comboWindow: COMBO.window,
  comboDuration: COMBO.duration,
  comboTimeout: COMBO.duration,
  maxCombo: COMBO.max,
  combo: COMBO,
  comboMilestones: COMBO_MILESTONES,
  levelDuration: LEVEL.seconds,
  levelSeconds: LEVEL.seconds,
  level: LEVEL,
  colors: PALETTE,
  palette: PALETTE,
  parallax: PARALLAX,
};

export const config = CONFIG;
export default CONFIG;
