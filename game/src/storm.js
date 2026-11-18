import { STORM, WIDTH, HEIGHT } from './config.js';

const EPSILON = 1e-10;

export function createStorm() {
  return { nextAt: STORM.every, active: false, warning: false, timer: 0, spawnAcc: 0 };
}

function edgeSpawn(random) {
  const edge = Math.floor(random() * 4);
  const offset = random();
  if (edge < 2) {
    return { x: offset * WIDTH, y: edge === 0 ? -30 : HEIGHT + 30, kind: 'normal' };
  }
  return { x: edge === 2 ? -30 : WIDTH + 30, y: offset * HEIGHT, kind: 'normal' };
}

export function updateStorm(storm, totalOrbs, dt, random) {
  const spawn = [];
  if (!storm.active && !storm.warning && totalOrbs >= storm.nextAt) {
    storm.warning = true;
    storm.timer = STORM.warningDuration;
  }

  if (storm.warning) {
    const elapsed = Math.min(dt, storm.timer);
    storm.timer -= elapsed;
    dt -= elapsed;
    if (storm.timer <= EPSILON) {
      storm.warning = false;
      storm.active = true;
      storm.timer = STORM.duration;
    }
  }

  if (storm.active) {
    const elapsed = Math.min(dt, storm.timer);
    storm.timer -= elapsed;
    storm.spawnAcc += STORM.spawnPerSecond * elapsed;
    while (storm.spawnAcc >= 1 - EPSILON) {
      spawn.push(edgeSpawn(random));
      storm.spawnAcc = Math.max(0, storm.spawnAcc - 1);
    }
    if (storm.timer <= EPSILON) {
      storm.active = false;
      storm.timer = 0;
      storm.spawnAcc = 0;
      storm.nextAt += STORM.every;
    }
  }

  return { active: storm.active, warning: storm.warning, spawn };
}
