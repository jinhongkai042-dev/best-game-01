// Main entry point and requestAnimationFrame loop for Stardust Courier.
// Wires input.js, world.js (createWorld / updateWorld), render.js, audio.js, and shots.js.

import { BEST_KEY, CONFIG, LIVES } from './config.js';
import { createWorld, updateWorld } from './world.js';
import { createInput } from './input.js';
import { createRenderer } from './render.js';
import { stageShot } from './shots.js';
import { createAudio } from './audio.js';

const MAX_FRAME = 0.1;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const initialSeed = Number.isInteger(seedParam)
  ? seedParam
  : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Ignore storage errors in private browsing mode.
  }
}

function announce(message) {
  if (statusEl) statusEl.textContent = message;
}

function runShot(name) {
  const state = createWorld({ ...CONFIG, seed: initialSeed });
  const scene = stageShot(name, state, updateWorld);
  let painted = 0;
  function paint() {
    renderer.draw(scene.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let runSeed = initialSeed;
  let state = createWorld({ ...CONFIG, seed: runSeed });
  let best = readBest();
  let lastTime = performance.now();

  function startFromTitle() {
    state.status = 'playing';
    audio.start();
    announce(`Playing Stardust Courier. ${LIVES} lives.`);
  }

  function restartFromOver() {
    runSeed = (runSeed + 0x9e3779b9) >>> 0;
    state = createWorld({ ...CONFIG, seed: runSeed });
    state.status = 'playing';
    audio.start();
    announce(`Restarted Stardust Courier. ${LIVES} lives.`);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(Math.max(0.001, (now - lastTime) / 1000), MAX_FRAME);
    lastTime = now;

    const snap = input.sample();
    const confirmed = input.consumeConfirm();

    if (state.status === 'title' && confirmed) {
      startFromTitle();
    } else if (state.status === 'over' && confirmed) {
      // Prevent the restart click from immediately triggering another action
      snap.mouseDown = false;
      restartFromOver();
    }

    const prevStatus = state.status;
    const prevScore = state.score;
    const prevLives = state.lives;
    const prevLevel = state.level;
    const prevShield = Boolean(state.shield);
    const prevDouble = state.doubleTimer || 0;

    updateWorld(state, snap, dt);

    if (prevStatus === 'title' && state.status === 'playing') {
      audio.start();
      announce(`Playing Stardust Courier. ${state.lives} lives.`);
    }

    if (state.status === 'playing') {
      if (state.score > prevScore) {
        const delta = state.score - prevScore;
        const isBonus = delta >= 50 * Math.max(1, state.combo);
        audio.collect(state.combo, isBonus);
      }
      if ((!prevShield && state.shield) || state.doubleTimer > prevDouble + 1) {
        audio.powerup(state.doubleTimer > prevDouble + 1 ? 'double' : 'shield');
      }
      if (state.level > prevLevel) {
        audio.levelUp();
        announce(`Level ${state.level}.`);
      }
      if (state.lives < prevLives) {
        audio.hit(false);
        announce(`${state.lives} ${state.lives === 1 ? 'life' : 'lives'} remaining.`);
      } else if (prevShield && !state.shield) {
        audio.hit(true);
        announce('Shield absorbed comet impact.');
      }
    }

    if (prevStatus !== 'over' && state.status === 'over') {
      if (state.score > best) {
        best = state.score;
        saveBest(best);
      }
      audio.gameOver();
      announce(`Game over. Final score ${state.score}. Best score ${best}.`);
    } else if (state.score > best) {
      best = state.score;
      saveBest(best);
    }

    renderer.draw(state, best);
  }

  announce('Stardust Courier. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
