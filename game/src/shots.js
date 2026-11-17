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
  const player = state.player || { x: 640, y: 520, r: 16 };
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
  if (Array.isArray(state.orbs) && state.orbs.length > 0) {
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
    Object.assign(state, {
      status: 'playing',
      score: 1240,
      lives: 3,
      level: 3,
      combo: 4,
      comboTimer: 2.15,
      time: 34.6,
      shield: true,
      doubleTimer: 7.4,
      player: { x: 575, y: 465, r: 16 },
      orbs: [
        { x: 645, y: 375, r: 16, kind: 'bonus' },
        { x: 470, y: 350, r: 12, kind: 'star' },
        { x: 750, y: 455, r: 12, kind: 'star' },
        { x: 330, y: 240, r: 16, kind: 'bonus' },
        { x: 890, y: 270, r: 12, kind: 'star' },
        { x: 240, y: 525, r: 12, kind: 'star' },
        { x: 1030, y: 485, r: 16, kind: 'bonus' },
        { x: 520, y: 195, r: 12, kind: 'star' },
      ],
      comets: [
        { x: 415, y: 265, r: 22, vx: 95, vy: 245 },
        { x: 825, y: 215, r: 20, vx: -115, vy: 230 },
        { x: 265, y: 410, r: 19, vx: 140, vy: 195 },
        { x: 990, y: 355, r: 24, vx: -85, vy: 260 },
      ],
      powerups: [
        { x: 375, y: 535, r: 15, kind: 'double' },
        { x: 915, y: 540, r: 15, kind: 'shield' },
      ],
      particles: [
        ...makeBurst(505, 415, 22, ['#00f5ff', '#ffd700', '#ff2a85', '#ffffff']),
        ...makeBurst(645, 375, 10, ['#ffd700', '#ff2a85']),
      ],
    });
    return { screen: SCREEN_PLAY, best: 1850, state };
  }

  if (shotName === 'action') {
    Object.assign(state, {
      status: 'playing',
      score: 2680,
      lives: 2,
      level: 5,
      combo: 6,
      comboTimer: 2.45,
      time: 68.4,
      shield: false,
      doubleTimer: 5.8,
      player: { x: 720, y: 395, r: 16 },
      orbs: [
        { x: 785, y: 315, r: 16, kind: 'bonus' },
        { x: 840, y: 380, r: 16, kind: 'bonus' },
        { x: 620, y: 280, r: 12, kind: 'star' },
        { x: 460, y: 440, r: 16, kind: 'bonus' },
        { x: 310, y: 300, r: 12, kind: 'star' },
        { x: 980, y: 250, r: 12, kind: 'star' },
        { x: 540, y: 560, r: 12, kind: 'star' },
        { x: 1080, y: 510, r: 16, kind: 'bonus' },
      ],
      comets: [
        { x: 635, y: 355, r: 24, vx: -135, vy: 285 },
        { x: 830, y: 230, r: 22, vx: -90, vy: 310 },
        { x: 510, y: 190, r: 20, vx: 150, vy: 270 },
        { x: 960, y: 445, r: 25, vx: -180, vy: 220 },
        { x: 290, y: 480, r: 21, vx: 165, vy: 240 },
      ],
      powerups: [
        { x: 585, y: 470, r: 15, kind: 'shield' },
      ],
      particles: [
        ...makeBurst(655, 455, 26, ['#ffd700', '#ff2a85', '#00f5ff', '#ffffff']),
        ...makeBurst(785, 315, 14, ['#00f5ff', '#72efdd']),
      ],
    });
    return { screen: SCREEN_PLAY, best: 2680, state };
  }

  if (shotName === 'end') {
    Object.assign(state, {
      status: 'over',
      score: 3150,
      lives: 0,
      level: 6,
      combo: 1,
      comboTimer: 0,
      time: 84.2,
      shield: false,
      doubleTimer: 0,
      player: { x: 640, y: 510, r: 16 },
      orbs: [
        { x: 220, y: 260, r: 12, kind: 'star' },
        { x: 1050, y: 310, r: 16, kind: 'bonus' },
        { x: 280, y: 540, r: 16, kind: 'bonus' },
        { x: 990, y: 550, r: 12, kind: 'star' },
      ],
      comets: [
        { x: 250, y: 185, r: 22, vx: 120, vy: 260 },
        { x: 1030, y: 195, r: 24, vx: -130, vy: 250 },
        { x: 195, y: 440, r: 20, vx: 145, vy: 220 },
        { x: 1085, y: 460, r: 21, vx: -140, vy: 235 },
      ],
      powerups: [
        { x: 210, y: 345, r: 15, kind: 'shield' },
      ],
      particles: makeBurst(640, 510, 32, ['#ff2a6d', '#ff7b54', '#ffd166', '#ffffff']),
    });
    return { screen: SCREEN_OVER, best: 3420, state };
  }

  // Default: ?shot=start (title screen)
  Object.assign(state, {
    status: 'title',
    score: 0,
    lives: CONFIG.lives,
    level: 1,
    combo: 1,
    comboTimer: 0,
    time: 6.4,
    shield: true,
    doubleTimer: 0,
    player: { x: 640, y: 635, r: 16 },
    orbs: [
      { x: 145, y: 185, r: 16, kind: 'bonus' },
      { x: 1135, y: 195, r: 16, kind: 'bonus' },
      { x: 125, y: 380, r: 12, kind: 'star' },
      { x: 1155, y: 390, r: 12, kind: 'star' },
      { x: 180, y: 565, r: 12, kind: 'star' },
      { x: 1100, y: 560, r: 16, kind: 'bonus' },
    ],
    comets: [
      { x: 165, y: 110, r: 21, vx: 95, vy: 210 },
      { x: 1115, y: 120, r: 22, vx: -105, vy: 215 },
    ],
    powerups: [
      { x: 150, y: 475, r: 15, kind: 'shield' },
      { x: 1130, y: 475, r: 15, kind: 'double' },
    ],
    particles: [
      ...makeBurst(145, 185, 12, ['#ffd700', '#00f5ff']),
      ...makeBurst(1135, 195, 12, ['#ff2a85', '#00f5ff']),
    ],
  });
  return { screen: SCREEN_TITLE, best: 2450, state };
}

export default stageShot;
