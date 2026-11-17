// Stardust Courier logic. All coordinates use logical canvas pixels; dt is in seconds.
// createWorld({ seed, width, height, playerSpeed, playerRadius }) returns the public state.
// updateWorld mutates and returns that state. Keyboard steering overrides a valid mouse target.
// The frontend can set status to "playing" for Enter/Space; direction keys or a click also start.
// Private bookkeeping keeps the public state and every entity's fields exactly as specified.
import { createRandom } from './random.js';
import * as defaults from './config.js';

const worlds = new WeakMap();
const STEP = 1 / 120;
const EPSILON = 1e-9;
const COMBO_SECONDS = 2.5;
const INVULNERABLE_SECONDS = 1.5;
const MAX_ORBS = 96;
const MAX_COMETS = 80;
const MAX_PARTICLES = 256;

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const positive = (value, fallback) => Number.isFinite(value) && value > 0 ? value : fallback;
const countdown = (value, dt) => value - dt > EPSILON ? value - dt : 0;

export function createWorld(config = {}) {
  config = config || {};
  const field = config.FIELD || config.field || defaults.FIELD || {};
  const ship = config.PLAYER || defaults.PLAYER || {};
  const width = positive(config.width, positive(field.width, 1280));
  const height = positive(config.height, positive(field.height, 720));
  const radius = Math.min(positive(config.playerRadius, positive(ship.r, 14)), width / 2, height / 2);
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
    player: { x: width / 2, y: height * 0.62, r: radius },
    orbs: [],
    comets: [],
    powerups: [],
    particles: [],
  };
  state.player.y = clamp(state.player.y, radius, height - radius);
  const data = {
    width, height,
    speed: positive(config.playerSpeed, positive(ship.speed, 560)),
    random: createRandom(seed),
    backgroundRandom: createRandom(seed ^ 0x7f4a7c15),
    effectsRandom: createRandom(seed ^ 0x1b873593),
    vx: 0, vy: 0,
    collected: 0,
    invulnerable: 0,
    orbTimer: 0.3,
    cometTimer: 1.8,
    powerTimer: 20,
    accumulator: 0,
    previousStatus: 'title',
  };
  worlds.set(state, data);
  for (let i = 0; i < 18; i += 1) spawnOrb(state, data, true);
  return state;
}

function spawnOrb(state, data, background = false) {
  if (state.orbs.length >= MAX_ORBS) return;
  const random = background ? data.backgroundRandom : data.random;
  const kind = random() < 0.12 ? 'bonus' : 'star';
  const r = Math.min(kind === 'bonus' ? 12 : 8, data.width / 2, data.height / 2);
  state.orbs.push({
    x: r + random() * (data.width - 2 * r),
    y: background ? r + random() * (data.height - 2 * r) : -r,
    r, kind,
  });
}

function spawnComet(state, data) {
  if (state.comets.length >= MAX_COMETS) return;
  const random = data.random;
  const r = Math.min(14 + random() * 12, data.width / 4, data.height / 4);
  const edge = Math.floor(random() * 4);
  let x = random() * data.width;
  let y = random() * data.height;
  if (edge === 0) y = -r - 6;
  else if (edge === 1) x = data.width + r + 6;
  else if (edge === 2) y = data.height + r + 6;
  else x = -r - 6;
  const dx = data.width * (0.15 + random() * 0.7) - x;
  const dy = data.height * (0.15 + random() * 0.7) - y;
  const distance = Math.hypot(dx, dy) || 1;
  const speed = (180 + 24 * (state.level - 1)) * (0.85 + random() * 0.3);
  state.comets.push({ x, y, r, vx: dx / distance * speed, vy: dy / distance * speed });
}

function spawnPowerup(state, data) {
  if (state.powerups.length >= 4) return;
  const r = Math.min(13, data.width / 2, data.height / 2);
  state.powerups.push({
    x: r + data.random() * (data.width - 2 * r),
    y: -r,
    r,
    kind: data.random() < 0.5 ? 'shield' : 'double',
  });
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
  const targetVx = distance > 0 ? dx / distance * speed : 0;
  const targetVy = distance > 0 ? dy / distance * speed : 0;
  const blend = 1 - Math.exp(-18 * dt);
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

function updatePlaying(state, data, input, dt) {
  state.time += dt;
  state.comboTimer = countdown(state.comboTimer, dt);
  if (state.comboTimer === 0) state.combo = 1;
  state.doubleTimer = countdown(state.doubleTimer, dt);
  data.invulnerable = countdown(data.invulnerable, dt);
  const difficulty = state.level - 1;
  data.orbTimer -= dt;
  while (data.orbTimer <= EPSILON) {
    spawnOrb(state, data);
    data.orbTimer += 0.62 / (1 + difficulty * 0.14) * (0.85 + data.random() * 0.3);
  }
  data.cometTimer -= dt;
  while (data.cometTimer <= EPSILON) {
    spawnComet(state, data);
    data.cometTimer += 1.8 / (1 + difficulty * 0.18) * (0.85 + data.random() * 0.3);
  }
  data.powerTimer -= dt;
  while (data.powerTimer <= EPSILON) {
    spawnPowerup(state, data);
    data.powerTimer += 18 + data.random() * 4;
  }

  const player = state.player;
  const oldPlayerX = player.x;
  const oldPlayerY = player.y;
  movePlayer(state, data, input, dt);

  // Resolve pickups before hazards, so a shield collected in this step protects immediately.
  for (let i = 0; i < state.powerups.length; i += 1) {
    const item = state.powerups[i];
    const oldX = item.x;
    const oldY = item.y;
    item.y += (70 + difficulty * 5) * dt;
    item.x = clamp(item.x + Math.sin(state.time * 1.4 + oldY * 0.01) * 14 * dt, item.r, data.width - item.r);
    if (touches(player, oldPlayerX, oldPlayerY, item, oldX, oldY)) {
      if (item.kind === 'shield') state.shield = true;
      else if (item.kind === 'double') state.doubleTimer = 10;
      burst(state, data, item.x, item.y, item.kind === 'shield' ? '#78b7ff' : '#ffd86b', 20);
      state.powerups.splice(i--, 1);
    } else if (item.y > data.height + item.r) {
      state.powerups.splice(i--, 1);
    }
  }

  for (let i = 0; i < state.orbs.length; i += 1) {
    const orb = state.orbs[i];
    const oldX = orb.x;
    const oldY = orb.y;
    orb.y += (82 + difficulty * 11) * (orb.kind === 'bonus' ? 0.9 : 1) * dt;
    orb.x = clamp(orb.x + Math.sin(state.time * 1.2 + oldY * 0.012) * 12 * dt, orb.r, data.width - orb.r);
    if (touches(player, oldPlayerX, oldPlayerY, orb, oldX, oldY)) {
      state.combo = state.comboTimer > 0 ? state.combo + 1 : 1;
      state.comboTimer = COMBO_SECONDS;
      state.score += (orb.kind === 'bonus' ? 50 : 10) * state.combo * (state.doubleTimer > 0 ? 2 : 1);
      data.collected += 1;
      state.level = 1 + Math.floor(data.collected / 25);
      burst(state, data, orb.x, orb.y, orb.kind === 'bonus' ? '#ffd86b' : '#69f8ff', 10);
      state.orbs.splice(i--, 1);
    } else if (orb.y > data.height + orb.r) {
      state.orbs.splice(i--, 1);
    }
  }

  for (let i = 0; i < state.comets.length; i += 1) {
    const comet = state.comets[i];
    const oldX = comet.x;
    const oldY = comet.y;
    comet.x += comet.vx * dt;
    comet.y += comet.vy * dt;
    if (touches(player, oldPlayerX, oldPlayerY, comet, oldX, oldY)) {
      state.comets.splice(i--, 1);
      if (data.invulnerable > 0) continue;
      const protectedHit = state.shield;
      if (protectedHit) state.shield = false;
      else state.lives = Math.max(0, state.lives - 1);
      data.invulnerable = INVULNERABLE_SECONDS;
      burst(state, data, player.x, player.y, protectedHit ? '#78b7ff' : '#ff518c', 28);
      if (state.lives === 0) {
        state.status = 'over';
        break;
      }
    } else if (comet.x < -comet.r - 12 || comet.x > data.width + comet.r + 12
      || comet.y < -comet.r - 12 || comet.y > data.height + comet.r + 12) {
      state.comets.splice(i--, 1);
    }
  }
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
  // A fixed internal step makes 30/60/120 Hz replays agree and safely consumes larger dt values.
  while (data.accumulator + EPSILON >= STEP) {
    data.accumulator = Math.max(0, data.accumulator - STEP);
    updateParticles(state, STEP);
    if (state.status === 'title') updateTitle(state, data, STEP);
    else if (state.status === 'playing') updatePlaying(state, data, input, STEP);
  }
  return state;
}