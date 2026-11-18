// Deterministic screenshot scene staging for ?shot=start|play|action|end.
// Works with createWorld/updateWorld from world.js and ensures each scene
// showcases rich, authentic gameplay strictly matching the state contract.

import { CONFIG, STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function makeBurst(cx, cy, count, colors) {
  const list = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + (i % 3) * 0.2;
    const speed = 60 + (i % 5) * 38;
    const dist = 6 + (i % 4) * 9;
    list.push({
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.45 + (i % 5) * 0.12,
      color: colors[i % colors.length],
    });
  }
  return list;
}

/** Simple 2D autopilot used when stepping a live world forward before staging. */
export function autopilot2D(state) {
  const player = state.player || {
    x: CONFIG.width / 2,
    y: 520,
    r: CONFIG.player.r,
  };
  let avoidX = 0;
  let avoidY = 0;

  if (Array.isArray(state.comets)) {
    for (let i = 0; i < state.comets.length; i += 1) {
      const c = state.comets[i];
      const dx = player.x - c.x;
      const dy = player.y - c.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < 180) {
        const weight = (180 - dist) / 180;
        avoidX += (dx / dist) * weight * 2.2;
        avoidY += (dy / dist) * weight * 2.2;
      }
    }
  }

  let seekX = 0;
  let seekY = 0;
  if (state.gate && state.gate.active) {
    const dx = state.gate.x - player.x;
    const dy = state.gate.y - player.y;
    const d = Math.hypot(dx, dy) || 1;
    seekX = dx / d;
    seekY = dy / d;
  } else if (Array.isArray(state.orbs) && state.orbs.length > 0) {
    let bestOrb = state.orbs[0];
    let bestScore = -Infinity;
    for (let i = 0; i < state.orbs.length; i += 1) {
      const o = state.orbs[i];
      const d = Math.hypot(o.x - player.x, o.y - player.y) || 1;
      const val = (o.kind === 'bonus' ? 220 : 100) - d * 0.35;
      if (val > bestScore) {
        bestScore = val;
        bestOrb = o;
      }
    }
    const dx = bestOrb.x - player.x;
    const dy = bestOrb.y - player.y;
    const d = Math.hypot(dx, dy) || 1;
    seekX = dx / d;
    seekY = dy / d;
  }

  let dx = avoidX + seekX * 0.85;
  let dy = avoidY + seekY * 0.85;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;

  return {
    left: dx < -0.2,
    right: dx > 0.2,
    up: dy < -0.2,
    down: dy > 0.2,
    dash: false,
    dx,
    dy,
    vx: dx,
    vy: dy,
    mouseActive: false,
    mouseX: null,
    mouseY: null,
    start: false,
    restart: false,
    action: false,
    confirm: false,
    keys: new Set(),
  };
}

export function stageShot(name, state, updateFn) {
  const shotName = (name || 'start').toLowerCase();

  // Optionally advance the world for a few steps if updateFn is provided
  if (typeof updateFn === 'function' && state) {
    try {
      const steps = shotName === 'start' ? 30 : 90;
      for (let i = 0; i < steps; i += 1) {
        const inp = autopilot2D(state);
        if (i === 0 && shotName !== 'start') {
          inp.start = true;
          inp.action = true;
          inp.confirm = true;
        }
        updateFn(state, inp, STEP);
      }
    } catch {
      // Fall back cleanly to the deterministic scene layout below.
    }
  }

  if (shotName === 'play') {
    const level = 2;
    const gateX = 640;
    const gateY = CONFIG.height - CONFIG.delivery.radius;
    Object.assign(state, {
      status: 'playing',
      score: 1480,
      best: 1850,
      lives: CONFIG.lives,
      level,
      zone: Math.min(3, level),
      zoneChanged: 0,
      deliverCount: CONFIG.delivery.target,
      deliverTarget: CONFIG.delivery.target,
      deliveriesCompleted: 2,
      deliveries: 2,
      totalOrbs: 28,
      gate: { x: gateX, y: gateY, r: CONFIG.delivery.radius, active: true },
      combo: 4,
      comboTimer: 2.15,
      comboMilestonesHit: {},
      isDashing: false,
      dashCooldown: 0.9,
      time: 34.6,
      shield: true,
      doubleTimer: 7.4,
      magnetTimer: 5.8,
      slowTimer: 0,
      boss: null,
      stormActive: false,
      stormWarning: false,
      stats: { orbs: 28, deliveries: 2, bestCombo: 4, timeSurvived: 34.6, bossKills: 0 },
      player: { x: 575, y: 475, r: CONFIG.player.r },
      orbs: [
        { x: 645, y: 385, r: CONFIG.orbs.bonusRadius, kind: 'bonus' },
        { x: 475, y: 365, r: CONFIG.orbs.starRadius, kind: 'star' },
        { x: 730, y: 445, r: CONFIG.orbs.starRadius, kind: 'star' },
        { x: 330, y: 240, r: CONFIG.orbs.bonusRadius, kind: 'bonus' },
        { x: 890, y: 270, r: CONFIG.orbs.starRadius, kind: 'star' },
        { x: 240, y: 525, r: CONFIG.orbs.starRadius, kind: 'star' },
        { x: 1030, y: 485, r: CONFIG.orbs.bonusRadius, kind: 'bonus' },
        { x: 495, y: 195, r: CONFIG.orbs.starRadius, kind: 'star' },
      ],
      comets: [
        { x: 405, y: 275, r: 22, vx: 115, vy: 225, kind: 'homing' },
        { x: 835, y: 225, r: 24, vx: -115, vy: 230, kind: 'splitter' },
        { x: 265, y: 410, r: 19, vx: 140, vy: 195, kind: 'normal' },
        { x: 990, y: 355, r: 12, vx: -135, vy: 260, kind: 'mini' },
      ],
      powerups: [
        { x: 375, y: 535, r: CONFIG.powerups.r, kind: 'life' },
        { x: 915, y: 540, r: CONFIG.powerups.r, kind: 'bomb' },
      ],
      particles: [
        ...makeBurst(gateX, gateY, 18, ['#00ffaa', '#00f5ff', '#ffd166', '#ffffff']),
        ...makeBurst(505, 425, 20, ['#00f5ff', '#c77dff', '#ff2a85', '#ffffff']),
      ],
    });
    return { screen: SCREEN_PLAY, best: 1850, state };
  }

  if (shotName === 'action') {
    const level = 5;
    const gateX = 430;
    const gateY = CONFIG.height - CONFIG.delivery.radius;
    const bossCfg = (CONFIG && (CONFIG.boss || CONFIG.BOSS)) || { r: 42, hp: 3 };
    const bossR = Number.isFinite(bossCfg.r) ? bossCfg.r : 42;
    const bossMaxHp = Number.isFinite(bossCfg.hp) ? Math.max(1, Math.floor(bossCfg.hp)) : 3;
    Object.assign(state, {
      status: 'playing',
      score: 3420,
      best: 3420,
      lives: 2,
      level,
      zone: Math.min(3, level),
      zoneChanged: 0,
      deliverCount: CONFIG.delivery.target,
      deliverTarget: CONFIG.delivery.target,
      deliveriesCompleted: 5,
      deliveries: 5,
      totalOrbs: 52,
      gate: { x: gateX, y: gateY, r: CONFIG.delivery.radius, active: true },
      combo: 5,
      comboTimer: 2.35,
      comboMilestonesHit: { 5: true },
      isDashing: true,
      dashCooldown: 0,
      dashDir: { x: 0.48, y: -0.877 },
      time: 68.4,
      shield: false,
      doubleTimer: 5.8,
      magnetTimer: 4.2,
      slowTimer: 3.6,
      boss: { x: 965, y: 295, r: bossR, hp: Math.max(1, bossMaxHp - 1), vx: -100, vy: 140 },
      stormActive: false,
      stormWarning: true,
      stats: { orbs: 52, deliveries: 5, bestCombo: 6, timeSurvived: 68.4, bossKills: 1 },
      player: { x: 690, y: 445, r: CONFIG.player.r },
      orbs: [
        { x: 770, y: 335, r: CONFIG.orbs.bonusRadius, kind: 'bonus' },
        { x: 845, y: 410, r: CONFIG.orbs.bonusRadius, kind: 'bonus' },
        { x: 585, y: 325, r: CONFIG.orbs.starRadius, kind: 'star' },
        { x: 460, y: 455, r: CONFIG.orbs.bonusRadius, kind: 'bonus' },
        { x: 240, y: 245, r: CONFIG.orbs.starRadius, kind: 'star' },
        { x: 1125, y: 235, r: CONFIG.orbs.starRadius, kind: 'star' },
        { x: 540, y: 585, r: CONFIG.orbs.starRadius, kind: 'star' },
        { x: 1080, y: 515, r: CONFIG.orbs.bonusRadius, kind: 'bonus' },
      ],
      comets: [
        { x: 185, y: 220, r: 34, vx: 120, vy: 190, kind: 'elite' },
        { x: 265, y: 340, r: 22, vx: 135, vy: 215, kind: 'homing' },
        { x: 400, y: 265, r: 25, vx: 125, vy: 245, kind: 'splitter' },
        { x: 290, y: 495, r: 12, vx: 185, vy: 250, kind: 'mini' },
        { x: 345, y: 535, r: 12, vx: 155, vy: 265, kind: 'mini' },
      ],
      powerups: [
        { x: 560, y: 515, r: CONFIG.powerups.r, kind: 'shield' },
        { x: 910, y: 505, r: CONFIG.powerups.r, kind: 'bomb' },
      ],
      particles: [
        ...makeBurst(gateX, gateY, 28, ['#00ffaa', '#ffd166', '#00f5ff', '#ffffff']),
        ...makeBurst(655, 480, 24, ['#00f5ff', '#ffd700', '#ffffff', '#c77dff']),
      ],
    });
    return { screen: SCREEN_PLAY, best: 3420, state };
  }

  if (shotName === 'end') {
    const level = 7;
    Object.assign(state, {
      status: 'over',
      score: 4280,
      best: 4650,
      lives: 0,
      level,
      zone: Math.min(3, level),
      zoneChanged: 0,
      deliverCount: 6,
      deliverTarget: CONFIG.delivery.target,
      deliveriesCompleted: 6,
      deliveries: 6,
      totalOrbs: 64,
      gate: { x: 640, y: CONFIG.height - CONFIG.delivery.radius, r: CONFIG.delivery.radius, active: false },
      combo: 1,
      comboTimer: 0,
      comboMilestonesHit: {},
      isDashing: false,
      dashCooldown: 0,
      time: 84.2,
      shield: false,
      doubleTimer: 0,
      magnetTimer: 0,
      slowTimer: 0,
      boss: null,
      stormActive: false,
      stormWarning: false,
      stats: { orbs: 64, deliveries: 6, bestCombo: 8, timeSurvived: 84.2, bossKills: 2 },
      player: { x: 640, y: 510, r: CONFIG.player.r },
      orbs: [
        { x: 220, y: 260, r: CONFIG.orbs.starRadius, kind: 'star' },
        { x: 1050, y: 310, r: CONFIG.orbs.bonusRadius, kind: 'bonus' },
        { x: 280, y: 540, r: CONFIG.orbs.bonusRadius, kind: 'bonus' },
        { x: 990, y: 550, r: CONFIG.orbs.starRadius, kind: 'star' },
      ],
      comets: [
        { x: 240, y: 185, r: 32, vx: 120, vy: 240, kind: 'elite' },
        { x: 1030, y: 195, r: 22, vx: -130, vy: 250, kind: 'homing' },
        { x: 195, y: 440, r: 20, vx: 145, vy: 220, kind: 'normal' },
        { x: 1085, y: 460, r: 12, vx: -140, vy: 235, kind: 'mini' },
      ],
      powerups: [
        { x: 210, y: 345, r: CONFIG.powerups.r, kind: 'life' },
      ],
      particles: makeBurst(640, 510, 32, ['#ff2a6d', '#ff7b54', '#ffd166', '#ffffff']),
    });
    return { screen: SCREEN_OVER, best: 4650, state };
  }

  // Default: ?shot=start (title screen)
  const level = 1;
  Object.assign(state, {
    status: 'title',
    score: 0,
    best: 3420,
    lives: CONFIG.lives,
    level,
    zone: Math.min(3, level),
    zoneChanged: 0,
    deliverCount: 0,
    deliverTarget: CONFIG.delivery.target,
    gate: { x: 640, y: CONFIG.height - CONFIG.delivery.radius, r: CONFIG.delivery.radius, active: false },
    combo: 1,
    comboTimer: 0,
    comboMilestonesHit: {},
    isDashing: false,
    dashCooldown: 0,
    time: 6.4,
    shield: true,
    doubleTimer: 0,
    magnetTimer: 0,
    slowTimer: 0,
    boss: null,
    stormActive: false,
    stormWarning: false,
    player: { x: 640, y: 635, r: CONFIG.player.r },
    orbs: [
      { x: 145, y: 185, r: CONFIG.orbs.bonusRadius, kind: 'bonus' },
      { x: 1135, y: 195, r: CONFIG.orbs.bonusRadius, kind: 'bonus' },
      { x: 125, y: 380, r: CONFIG.orbs.starRadius, kind: 'star' },
      { x: 1155, y: 390, r: CONFIG.orbs.starRadius, kind: 'star' },
      { x: 180, y: 565, r: CONFIG.orbs.starRadius, kind: 'star' },
      { x: 1100, y: 560, r: CONFIG.orbs.bonusRadius, kind: 'bonus' },
    ],
    comets: [
      { x: 165, y: 110, r: 22, vx: 95, vy: 210, kind: 'splitter' },
      { x: 1115, y: 120, r: 30, vx: -105, vy: 205, kind: 'elite' },
    ],
    powerups: [
      { x: 150, y: 475, r: CONFIG.powerups.r, kind: 'life' },
      { x: 1130, y: 475, r: CONFIG.powerups.r, kind: 'bomb' },
    ],
    particles: [
      ...makeBurst(145, 185, 12, ['#ffd700', '#00f5ff']),
      ...makeBurst(1135, 195, 12, ['#ff2a85', '#00f5ff']),
    ],
  });
  return { screen: SCREEN_TITLE, best: 3420, state };
}

export default stageShot;
