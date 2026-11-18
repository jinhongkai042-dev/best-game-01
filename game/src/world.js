// Stardust Courier logic. Coordinates are logical canvas pixels; dt is in seconds.
// Keyboard steering overrides a valid mouse target. Private data stays in a WeakMap.
import { createRandom } from './random.js';
import { createStorm, updateStorm } from './storm.js';
import * as defaults from './config.js';

const worlds = new WeakMap();
const STEP = 1 / 120;
const EPSILON = 1e-9;
const COMBO_SECONDS = 2.5;
const INVULNERABLE_SECONDS = 1.5;
const MAX_ORBS = 96;
const MAX_COMETS = 80;
const MAX_PARTICLES = 256;
const { ORB, COMET, POWERUP, DELIVERY } = defaults;
const DASH = defaults.DASH;
const ELITE = defaults.ELITE;
const BOSS = defaults.BOSS;
const COMBO_MILESTONES = defaults.COMBO_MILESTONES;

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const positive = (value, fallback) => Number.isFinite(value) && value > 0 ? value : fallback;
const countdown = (value, dt) => value - dt > EPSILON ? value - dt : 0;

function chooseKind(random, weights) {
  const entries = Object.entries(weights).filter(([, weight]) => weight > 0);
  let roll = random() * entries.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [kind, weight] of entries) {
    roll -= weight;
    if (roll < 0) return kind;
  }
  return entries[entries.length - 1][0];
}

export function createWorld(config = {}) {
  config = config || {};
  const field = config.FIELD || config.field || defaults.FIELD;
  const ship = config.PLAYER || config.player || defaults.PLAYER;
  const width = positive(config.width, positive(field.width, 1280));
  const height = positive(config.height, positive(field.height, 720));
  const radius = Math.min(positive(config.playerRadius, positive(ship.r, 16)), width / 2, height / 2);
  const seed = Number.isFinite(config.seed) ? config.seed : 1;
  const state = {
    status: 'title',
    score: 0,
    lives: 3,
    level: 1,
    combo: 1,
    comboTimer: 0,
    time: 0,
    shield: false,
    doubleTimer: 0,
    zone: 1,
    zoneChanged: 0,
    deliverCount: 0,
    deliverTarget: DELIVERY.target,
    deliveriesCompleted: 0,
    totalOrbs: 0,
    boss: null,
    bossSpawnedAt: 0,
    storm: createStorm(),
    stormActive: false,
    stormWarning: false,
    stats: { orbs: 0, deliveries: 0, bestCombo: 1, timeSurvived: 0, bossKills: 0 },
    deliveries: 0,
    gate: null,
    magnetTimer: 0,
    slowTimer: 0,
    dashCooldown: 0,
    dashTimer: 0,
    isDashing: false,
    comboMilestonesHit: {},
    player: { x: width / 2, y: height * 0.62, r: radius },
    orbs: [],
    comets: [],
    powerups: [],
    particles: [],
  };
  state.player.y = clamp(state.player.y, radius, height - radius);
  const data = {
    width, height,
    speed: positive(config.playerSpeed, positive(ship.speed, 440)),
    zones: config.ZONES || config.zones || defaults.ZONES,
    random: createRandom(seed),
    backgroundRandom: createRandom(seed ^ 0x7f4a7c15),
    effectsRandom: createRandom(seed ^ 0x1b873593),
    vx: 0, vy: 0,
    collected: 0,
    invulnerable: 0,
    cometMeta: new WeakMap(),
    orbTimer: 0.3,
    cometTimer: COMET.spawnInterval,
    powerTimer: POWERUP.firstSpawn,
    accumulator: 0,
    previousStatus: 'title',
  };
  worlds.set(state, data);
  for (let i = 0; i < 18; i += 1) spawnOrb(state, data, true);
  return state;
}

function currentZone(state, data) {
  return data.zones[state.zone] || defaults.ZONES[state.zone];
}

function spawnOrb(state, data, background = false) {
  if (state.orbs.length >= MAX_ORBS) return;
  const random = background ? data.backgroundRandom : data.random;
  const kind = random() < ORB.bonusChance ? 'bonus' : 'star';
  const r = Math.min(kind === 'bonus' ? ORB.bonusRadius : ORB.starRadius, data.width / 2, data.height / 2);
  state.orbs.push({
    x: r + random() * (data.width - 2 * r),
    y: background ? r + random() * (data.height - 2 * r) : -r,
    r, kind,
  });
}

function cometLoad(kind) {
  return kind === 'splitter' || kind === 'elite' ? 2 : 1;
}

function hasCometRoom(state, cost) {
  const load = state.comets.reduce((sum, comet) => sum + cometLoad(comet.kind), state.boss ? 2 : 0);
  return load + cost <= MAX_COMETS;
}

function spawnComet(state, data) {
  const zone = currentZone(state, data);
  const random = data.random;
  let kind = chooseKind(random, zone.cometWeights);
  if ((state.zone === 2 || state.zone === 3) && random() < ELITE.spawnWeight) kind = 'elite';
  spawnCometAt(state, data, undefined, undefined, kind);
}

function spawnCometAt(state, data, x, y, kind) {
  if (!hasCometRoom(state, cometLoad(kind))) return;
  const zone = currentZone(state, data);
  const random = data.random;
  const r = kind === 'elite' ? ELITE.r : Math.min(
    COMET.minRadius + random() * (COMET.maxRadius - COMET.minRadius),
    data.width / 4, data.height / 4,
  );
  if (x === undefined) {
    const edge = Math.floor(random() * 4);
    x = random() * data.width;
    y = random() * data.height;
    if (edge === 0) y = -r - 6;
    else if (edge === 1) x = data.width + r + 6;
    else if (edge === 2) y = data.height + r + 6;
    else x = -r - 6;
  }
  const dx = data.width * (0.15 + random() * 0.7) - x;
  const dy = data.height * (0.15 + random() * 0.7) - y;
  const distance = Math.hypot(dx, dy) || 1;
  let speed = (COMET.speed + COMET.speedPerLevel * (state.level - 1))
    * zone.cometSpeedMultiplier * (0.85 + random() * 0.3);
  if (kind === 'homing') {
    // Even in late levels, a homing comet remains slower than the courier.
    speed = Math.min(speed * COMET.homingSpeedMultiplier, data.speed * 0.72);
  } else if (kind === 'elite') {
    speed = Math.min(speed * ELITE.speedMultiplier, data.speed * 0.72);
  }
  const comet = { x, y, r, vx: dx / distance * speed, vy: dy / distance * speed, kind };
  state.comets.push(comet);
  // Storm coordinates can start farther outside the field than ordinary spawns.
  const spawnMargin = Math.max(12, -x - r, x - data.width - r, -y - r, y - data.height - r);
  data.cometMeta.set(comet, { age: 0, entered: false, spawnMargin });
}

function dropBonusOrbs(state, data, comet, count) {
  const r = Math.min(ORB.bonusRadius, data.width / 2, data.height / 2);
  const x = clamp(comet.x, r, data.width - r);
  const y = clamp(comet.y, r, data.height - r);
  const minX = Math.max(r, x - comet.r);
  const maxX = Math.min(data.width - r, x + comet.r);
  const minY = Math.max(r, y - comet.r);
  const maxY = Math.min(data.height - r, y + comet.r);
  for (let i = 0; i < count && state.orbs.length < MAX_ORBS; i += 1) {
    state.orbs.push({
      x: minX + data.random() * (maxX - minX),
      y: minY + data.random() * (maxY - minY),
      r, kind: 'bonus',
    });
  }
}

function spawnPowerup(state, data) {
  if (state.powerups.length >= 4) return;
  const r = Math.min(POWERUP.r, data.width / 2, data.height / 2);
  state.powerups.push({
    x: r + data.random() * (data.width - 2 * r),
    y: -r,
    r,
    kind: chooseKind(data.random, POWERUP.weights),
  });
}

function spawnGate(state, data) {
  const r = Math.min(DELIVERY.radius, data.width / 2, data.height / 2);
  const edge = Math.floor(data.random() * 4);
  let x = r + data.random() * (data.width - 2 * r);
  let y = r + data.random() * (data.height - 2 * r);
  if (edge === 0) y = r;
  else if (edge === 1) x = data.width - r;
  else if (edge === 2) y = data.height - r;
  else x = r;
  state.gate = { x, y, r, active: true };
  burst(state, data, x, y, currentZone(state, data).palette.gate, 24);
}

function burst(state, data, x, y, color, count) {
  const random = data.effectsRandom;
  const excess = state.particles.length + count - MAX_PARTICLES;
  if (excess > 0) state.particles.splice(0, excess);
  for (let i = 0; i < count; i += 1) {
    const angle = random() * Math.PI * 2;
    const speed = 45 + random() * 175;
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.35 + random() * 0.45,
      color,
    });
  }
}

function updateParticles(state, dt) {
  const damping = Math.exp(-2.5 * dt);
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const particle = state.particles[i];
    particle.life = countdown(particle.life, dt);
    if (particle.life === 0) {
      state.particles.splice(i, 1);
      continue;
    }
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= damping;
    particle.vy *= damping;
  }
}

function movePlayer(state, data, input, dt) {
  const player = state.player;
  let dx = Number(Boolean(input.right)) - Number(Boolean(input.left));
  let dy = Number(Boolean(input.down)) - Number(Boolean(input.up));
  let speed = data.speed;
  let distance = Math.hypot(dx, dy);
  if (distance === 0 && Number.isFinite(input.mouseX) && Number.isFinite(input.mouseY)) {
    dx = clamp(input.mouseX, player.r, data.width - player.r) - player.x;
    dy = clamp(input.mouseY, player.r, data.height - player.r) - player.y;
    distance = Math.hypot(dx, dy);
    speed = Math.min(speed, distance * 8);
  }
  const dashing = state.dashTimer > 0;
  if (dashing) {
    if (distance <= EPSILON) {
      dx = data.vx;
      dy = data.vy;
      distance = Math.hypot(dx, dy);
      if (distance <= EPSILON) {
        dx = 0;
        dy = -1;
        distance = 1;
      }
    }
    speed = DASH.speed;
    state.dashTimer = countdown(state.dashTimer, dt);
    if (state.dashTimer === 0) state.isDashing = false;
  }
  const targetVx = distance > 0 ? dx / distance * speed : 0;
  const targetVy = distance > 0 ? dy / distance * speed : 0;
  const blend = dashing ? 1 : 1 - Math.exp(-18 * dt);
  data.vx += (targetVx - data.vx) * blend;
  data.vy += (targetVy - data.vy) * blend;
  player.x = clamp(player.x + data.vx * dt, player.r, data.width - player.r);
  player.y = clamp(player.y + data.vy * dt, player.r, data.height - player.r);
  if ((player.x === player.r && data.vx < 0) || (player.x === data.width - player.r && data.vx > 0)) data.vx = 0;
  if ((player.y === player.r && data.vy < 0) || (player.y === data.height - player.r && data.vy > 0)) data.vy = 0;
}

// Sweep relative motion so a fast comet or moving ship cannot skip a circular collision.
function touches(player, oldPlayerX, oldPlayerY, item, oldX, oldY) {
  const sx = oldX - oldPlayerX;
  const sy = oldY - oldPlayerY;
  const dx = item.x - player.x - sx;
  const dy = item.y - player.y - sy;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared > 0 ? clamp(-(sx * dx + sy * dy) / lengthSquared, 0, 1) : 0;
  const x = sx + t * dx;
  const y = sy + t * dy;
  return x * x + y * y <= (player.r + item.r) ** 2;
}

function updateTitle(state, data, dt) {
  state.time += dt;
  for (const orb of state.orbs) {
    orb.y += 20 * dt;
    orb.x = clamp(orb.x + Math.sin(state.time * 0.6 + orb.y * 0.01) * 9 * dt, orb.r, data.width - orb.r);
    if (orb.y > data.height + orb.r) {
      orb.y = -orb.r;
      orb.x = orb.r + data.backgroundRandom() * (data.width - 2 * orb.r);
    }
  }
}

function isCometVisible(data, comet) {
  const { x, y, r } = comet;
  return x + r >= 0 && x - r <= data.width && y + r >= 0 && y - r <= data.height;
}

function steerHoming(comet, player, dt) {
  const dx = player.x - comet.x;
  const dy = player.y - comet.y;
  const turn = clamp(
    Math.atan2(comet.vx * dy - comet.vy * dx, comet.vx * dx + comet.vy * dy),
    -COMET.homingTurnRate * dt, COMET.homingTurnRate * dt,
  );
  const cosine = Math.cos(turn);
  const sine = Math.sin(turn);
  const vx = comet.vx;
  comet.vx = vx * cosine - comet.vy * sine;
  comet.vy = vx * sine + comet.vy * cosine;
}

function splitComet(state, data, comet, fragments, exited) {
  const r = comet.r * COMET.miniRadiusScale;
  const x = clamp(comet.x, r, data.width - r);
  const y = clamp(comet.y, r, data.height - r);
  // An edge split sends fragments back inward rather than deleting them immediately.
  const angle = exited
    ? Math.atan2(data.height / 2 - y, data.width / 2 - x)
    : Math.atan2(comet.vy, comet.vx);
  const spread = 0.35 + data.random() * 0.20;
  const speed = Math.hypot(comet.vx, comet.vy) * COMET.miniSpeedMultiplier;
  for (const side of [-1, 1]) {
    const heading = angle + side * spread;
    const mini = {
      x, y, r,
      vx: Math.cos(heading) * speed,
      vy: Math.sin(heading) * speed,
      kind: 'mini',
    };
    fragments.push(mini);
    data.cometMeta.set(mini, { age: 0, entered: true });
  }
  burst(state, data, x, y, currentZone(state, data).palette.cometGlow, 14);
}

function hitPlayer(state, data) {
  if (data.invulnerable > 0) return;
  const protectedHit = state.shield;
  if (protectedHit) state.shield = false;
  else state.lives = Math.max(0, state.lives - 1);
  data.invulnerable = INVULNERABLE_SECONDS;
  burst(state, data, state.player.x, state.player.y, protectedHit ? '#78b7ff' : '#ff518c', 28);
  if (state.lives === 0) state.status = 'over';
}

function updateBoss(state, data, oldPlayerX, oldPlayerY, dt) {
  const boss = state.boss;
  if (!boss) {
    if (state.totalOrbs < state.bossSpawnedAt + BOSS.spawnEvery || !hasCometRoom(state, 2)) return;
    const x = data.random() * data.width;
    const drift = Math.min(30, data.speed * 0.28);
    const speed = (COMET.speed + COMET.speedPerLevel * (state.level - 1)) * BOSS.speedMultiplier;
    state.boss = {
      x, y: -BOSS.r - 6, r: BOSS.r, hp: BOSS.hp, hitTimer: 0,
      vx: clamp((state.player.x - x) * 0.1, -drift, drift), vy: Math.min(speed, data.speed * 0.72),
    };
    state.bossSpawnedAt = state.totalOrbs;
    return;
  }
  const oldX = boss.x;
  const oldY = boss.y;
  boss.hitTimer = countdown(boss.hitTimer, dt);
  boss.x += boss.vx * dt;
  boss.y += boss.vy * dt;
  if (boss.y - boss.r > data.height) {
    state.boss = null;
  } else if (touches(state.player, oldPlayerX, oldPlayerY, boss, oldX, oldY)) {
    if (!state.isDashing) hitPlayer(state, data);
    else if (boss.hitTimer === 0) {
      boss.hp -= 1;
      boss.hitTimer = 0.5;
      burst(state, data, boss.x, boss.y, defaults.PALETTE.gold, 28);
      boss.y -= 20;
      if (boss.hp <= 0) {
        state.score += BOSS.points;
        dropBonusOrbs(state, data, boss, BOSS.dropOrbs);
        state.stats.bossKills += 1;
        state.boss = null;
      }
    }
  }
}

function updatePlaying(state, data, input, dt) {
  state.time += dt;
  const comboWasActive = state.comboTimer > 0;
  state.comboTimer = countdown(state.comboTimer, dt);
  if (state.comboTimer === 0) {
    state.combo = 1;
    if (comboWasActive) state.comboMilestonesHit = {};
  }
  state.doubleTimer = countdown(state.doubleTimer, dt);
  state.magnetTimer = countdown(state.magnetTimer, dt);
  state.slowTimer = countdown(state.slowTimer, dt);
  state.dashCooldown = countdown(state.dashCooldown, dt);
  data.invulnerable = countdown(data.invulnerable, dt);
  if (input.dash && state.dashCooldown === 0) {
    state.isDashing = true;
    state.dashTimer = DASH.duration;
    state.dashCooldown = DASH.cooldown;
    data.invulnerable = Math.max(data.invulnerable, DASH.invulnerable);
  }

  const difficulty = state.level - 1;
  const zone = currentZone(state, data);
  data.orbTimer -= dt;
  while (data.orbTimer <= EPSILON) {
    spawnOrb(state, data);
    data.orbTimer += Math.max(ORB.minInterval, ORB.spawnInterval / (1 + difficulty * 0.14))
      * (0.85 + data.random() * 0.3);
  }
  data.cometTimer -= dt;
  while (data.cometTimer <= EPSILON) {
    spawnComet(state, data);
    data.cometTimer += Math.max(
      COMET.minInterval,
      COMET.spawnInterval / ((1 + difficulty * 0.18) * zone.cometSpawnMultiplier),
    ) * (0.85 + data.random() * 0.3);
  }
  data.powerTimer -= dt;
  while (data.powerTimer <= EPSILON) {
    spawnPowerup(state, data);
    data.powerTimer += POWERUP.spawnInterval * (0.85 + data.random() * 0.3);
  }

  const player = state.player;
  const oldPlayerX = player.x;
  const oldPlayerY = player.y;
  movePlayer(state, data, input, dt);

  // Pickups resolve before hazards, including an immediately effective slow-time pickup.
  for (let i = 0; i < state.powerups.length; i += 1) {
    const item = state.powerups[i];
    const oldX = item.x;
    const oldY = item.y;
    item.y += (POWERUP.speed + difficulty * POWERUP.speedPerLevel) * dt;
    item.x = clamp(item.x + Math.sin(state.time * 1.4 + oldY * 0.01) * 14 * dt, item.r, data.width - item.r);
    if (touches(player, oldPlayerX, oldPlayerY, item, oldX, oldY)) {
      if (item.kind === 'shield') state.shield = true;
      else if (item.kind === 'double') state.doubleTimer = POWERUP.doubleDuration;
      else if (item.kind === 'magnet') state.magnetTimer = POWERUP.magnetDuration;
      else if (item.kind === 'slow') state.slowTimer = POWERUP.slowDuration;
      else if (item.kind === 'life') state.lives = Math.min(POWERUP.lifeMax, state.lives + 1);
      else if (item.kind === 'bomb') {
        for (let j = state.comets.length - 1; j >= 0; j -= 1) {
          if (!isCometVisible(data, state.comets[j])) continue;
          state.comets.splice(j, 1);
          state.score += POWERUP.bombPoints;
        }
      }
      const palette = currentZone(state, data).palette;
      const particleCount = item.kind === 'bomb' ? 56 : 20;
      burst(state, data, item.x, item.y, palette[item.kind] || palette.cyan, particleCount);
      state.powerups.splice(i--, 1);
    } else if (item.y > data.height + item.r) {
      state.powerups.splice(i--, 1);
    }
  }

  for (let i = 0; i < state.orbs.length; i += 1) {
    const orb = state.orbs[i];
    const oldX = orb.x;
    const oldY = orb.y;
    orb.y += (ORB.speed + difficulty * ORB.speedPerLevel) * (orb.kind === 'bonus' ? 0.9 : 1) * dt;
    orb.x = clamp(orb.x + Math.sin(state.time * 1.2 + oldY * 0.012) * 12 * dt, orb.r, data.width - orb.r);
    const dx = player.x - orb.x;
    const dy = player.y - orb.y;
    const distance = Math.hypot(dx, dy);
    if (state.magnetTimer > 0 && distance > 0 && distance <= POWERUP.magnetRadius) {
      // Pull harder near the courier; cap travel to avoid overshooting at close range.
      const pull = Math.min(distance, POWERUP.magnetPullSpeed
        * (0.35 + 0.65 * (1 - distance / POWERUP.magnetRadius)) * dt);
      orb.x += dx / distance * pull;
      orb.y += dy / distance * pull;
    }
    if (touches(player, oldPlayerX, oldPlayerY, orb, oldX, oldY)) {
      state.combo = state.comboTimer > 0 ? state.combo + 1 : 1;
      state.comboTimer = COMBO_SECONDS;
      state.score += (orb.kind === 'bonus' ? ORB.bonusPoints : ORB.starPoints)
        * state.combo * (state.doubleTimer > 0 ? 2 : 1);
      const milestonePoints = COMBO_MILESTONES[state.combo];
      if (milestonePoints && !state.comboMilestonesHit[state.combo]) {
        state.score += milestonePoints;
        state.comboMilestonesHit[state.combo] = true;
        burst(state, data, orb.x, orb.y, defaults.PALETTE.gold, 24);
      }
      data.collected += 1;
      state.totalOrbs = data.collected;
      state.level = 1 + Math.floor(data.collected / 25);
      const nextZone = Math.min(3, state.level);
      if (nextZone > state.zone) {
        state.zone = nextZone;
        state.zoneChanged = 2;
        burst(state, data, player.x, player.y, currentZone(state, data).palette.cometGlow, 32);
      }
      // Cargo is 0..9 while collecting, then held at 10 while the gate is pending.
      // Further pickups still score and advance zones, but cannot overwrite a full load.
      if (!state.gate || !state.gate.active) {
        state.deliverCount = Math.min(state.deliverTarget, state.deliverCount + 1);
        if (state.deliverCount === state.deliverTarget) spawnGate(state, data);
      }
      burst(state, data, orb.x, orb.y, orb.kind === 'bonus' ? '#ffd86b' : '#69f8ff', 10);
      state.orbs.splice(i--, 1);
    } else if (orb.y > data.height + orb.r) {
      state.orbs.splice(i--, 1);
    }
  }

  const gate = state.gate;
  if (gate && gate.active && touches(player, oldPlayerX, oldPlayerY, gate, gate.x, gate.y)) {
    // Delivery uses the current combo; it neither refreshes the combo nor times out.
    state.score += DELIVERY.points * state.combo;
    state.deliverCount = 0;
    state.deliveriesCompleted += 1;
    state.deliveries = state.deliveriesCompleted;
    state.gate = null;
    burst(state, data, gate.x, gate.y, currentZone(state, data).palette.gate, 36);
  }

  const cometDt = dt * (state.slowTimer > 0 ? POWERUP.slowMultiplier : 1);
  const fragments = [];
  for (let i = 0; i < state.comets.length; i += 1) {
    const comet = state.comets[i];
    // Older screenshot fixtures can omit kind and private lifetime bookkeeping.
    if (!comet.kind) comet.kind = 'normal';
    let meta = data.cometMeta.get(comet);
    if (!meta) {
      meta = { age: 0, entered: false };
      data.cometMeta.set(comet, meta);
    }
    meta.age += dt;
    const oldX = comet.x;
    const oldY = comet.y;
    meta.entered = meta.entered || isCometVisible(data, comet);
    if (comet.kind === 'homing') steerHoming(comet, player, cometDt);
    comet.x += comet.vx * cometDt;
    comet.y += comet.vy * cometDt;
    const visible = isCometVisible(data, comet);
    meta.entered = meta.entered || visible;
    const exited = meta.entered && !visible;
    const margin = meta.spawnMargin ?? 12;
    if (touches(player, oldPlayerX, oldPlayerY, comet, oldX, oldY)) {
      state.comets.splice(i--, 1);
      hitPlayer(state, data);
      if (state.status === 'over') break;
    } else if (comet.kind === 'splitter' && (exited || meta.age + EPSILON >= COMET.splitterLifetime)) {
      state.comets.splice(i--, 1);
      splitComet(state, data, comet, fragments, exited || !visible);
    } else if (exited || comet.x < -comet.r - margin || comet.x > data.width + comet.r + margin
      || comet.y < -comet.r - margin || comet.y > data.height + comet.r + margin) {
      state.comets.splice(i--, 1);
      if (comet.kind === 'elite') dropBonusOrbs(state, data, comet, ELITE.dropOrbs);
    }
  }
  // New fragments start moving next step, so each entity gets exactly one update per step.
  state.comets.push(...fragments);
  if (state.status === 'playing') updateBoss(state, data, oldPlayerX, oldPlayerY, dt);
  const stormOut = updateStorm(state.storm, state.totalOrbs, STEP, data.random);
  state.stormActive = stormOut.active;
  state.stormWarning = stormOut.warning;
  for (const { x, y, kind } of stormOut.spawn) spawnCometAt(state, data, x, y, kind);
  state.stats.orbs = state.totalOrbs;
  state.stats.deliveries = state.deliveriesCompleted;
  state.stats.bestCombo = Math.max(state.stats.bestCombo, state.combo);
  state.stats.timeSurvived = state.time;
}

/** Mutate and return a state from createWorld. Use createWorld again for a complete restart. */
export function updateWorld(state, input = {}, dt = 0) {
  const data = worlds.get(state);
  if (!data) throw new TypeError('updateWorld requires a state returned by createWorld.');
  if (!Number.isFinite(dt) || dt <= 0) return state;
  input = input || {};
  if (state.status === 'title' && (input.up || input.down || input.left || input.right || input.mouseDown)) {
    state.status = 'playing';
  }
  if (state.status === 'playing' && data.previousStatus === 'title') {
    state.time = 0;
    data.accumulator = 0;
  }
  if (state.status === 'playing' && state.lives <= 0) {
    state.lives = 0;
    state.status = 'over';
  }
  data.previousStatus = state.status;
  data.accumulator += dt;
  // A fixed internal step keeps 30/60/120 Hz replays consistent, including large dt values.
  while (data.accumulator + EPSILON >= STEP) {
    data.accumulator = Math.max(0, data.accumulator - STEP);
    state.zoneChanged = countdown(state.zoneChanged, STEP);
    updateParticles(state, STEP);
    if (state.status === 'title') updateTitle(state, data, STEP);
    else if (state.status === 'playing') updatePlaying(state, data, input, STEP);
  }
  return state;
}
