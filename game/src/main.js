// Main entry point and requestAnimationFrame loop for Stardust Courier.
// Wires input.js, world.js (createWorld / updateWorld), render.js, audio.js, and shots.js.

import { CONFIG, LIVES } from './config.js';
import { createWorld, updateWorld } from './world.js';
import { createInput } from './input.js';
import { createRenderer } from './render.js';
import { stageShot } from './shots.js';
import { createAudio } from './audio.js';
import { loadBest, saveBest, loadStats, saveStats } from './progression.js';

const MAX_FRAME = 0.1;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const initialSeed = Number.isInteger(seedParam)
  ? seedParam
  : globalThis.crypto.getRandomValues(new Uint32Array(1))[0];

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const renderer = createRenderer(canvas);
const audio = createAudio();

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
  state.stats = loadStats();
  state.best = loadBest();
  let lastTime = performance.now();

  function startFromTitle() {
    state.status = 'playing';
    audio.start();
    announce(`Playing Stardust Courier. ${LIVES} lives.`);
  }

  function restartFromOver() {
    runSeed = (runSeed + 0x9e3779b9) >>> 0;
    state = createWorld({ ...CONFIG, seed: runSeed });
    state.stats = loadStats();
    state.best = loadBest();
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
    const prevMagnet = state.magnetTimer || 0;
    const prevSlow = state.slowTimer || 0;
    const prevGateActive = Boolean(state.gate && state.gate.active);
    const prevDeliverCount = state.deliverCount || 0;
    const prevZone = state.zone || 1;
    const prevZoneChanged = state.zoneChanged || 0;

    const prevBoss = state.boss || null;
    const prevBossHp = state.boss ? state.boss.hp : 0;
    const prevStormWarning = state.stormWarning || false;

    updateWorld(state, snap, dt);

    if (prevStatus === 'title' && state.status === 'playing') {
      audio.start();
      announce(`Playing Stardust Courier. ${state.lives} lives.`);
    }

    if (state.status === 'playing') {
      if (prevBoss === null && state.boss) {
        audio.bossSpawn?.();
      } else if (state.boss && prevBossHp > state.boss.hp) {
        audio.bossHit?.();
      }
      if (prevBoss !== null && state.boss === null && state.score >= prevScore + 500) {
        audio.bossDown?.();
      }
      if (!prevStormWarning && state.stormWarning) audio.stormWarn?.();

      const gateNowActive = Boolean(state.gate && state.gate.active);
      const delivered =
        (prevGateActive && !gateNowActive && state.score > prevScore) ||
        (prevDeliverCount > 0 && (state.deliverCount || 0) === 0 && state.score > prevScore);

      if (delivered) {
        audio.delivery();
        announce('Gate delivery complete!');
      } else if (state.score > prevScore) {
        const delta = state.score - prevScore;
        const isBonus = delta >= 50 * Math.max(1, state.combo);
        audio.collect(state.combo, isBonus);
      }

      if (!prevShield && state.shield) {
        audio.powerup('shield');
      } else if ((state.doubleTimer || 0) > prevDouble + 0.5) {
        audio.powerup('double');
      }
      if ((state.magnetTimer || 0) > prevMagnet + 0.5) {
        audio.magnet();
      }
      if ((state.slowTimer || 0) > prevSlow + 0.5) {
        audio.slow();
      }

      const zoneChangedNow =
        (state.zone && state.zone !== prevZone) ||
        ((state.zoneChanged || 0) > prevZoneChanged + 0.5);
      if (zoneChangedNow) {
        audio.zoneChange();
        const zInfo = CONFIG.zones && CONFIG.zones[state.zone || 1];
        announce(`Entered Zone ${state.zone || 1}${zInfo ? `: ${zInfo.name}` : ''}.`);
      } else if (state.level > prevLevel) {
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
      state.best = saveBest(state.score);
      state.stats = saveStats(state.stats || {
        orbs: state.totalOrbs,
        deliveries: state.deliveriesCompleted,
        bestCombo: state.combo,
        timeSurvived: state.time,
        bossKills: 0,
      });
      audio.gameOver();
      announce(`Game over. Final score ${state.score}. Best score ${state.best}.`);
    }

    const best = state.best;
    renderer.draw(state, best);
  }

  announce('Stardust Courier. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
