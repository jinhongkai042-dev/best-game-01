import { BEST_KEY } from './config.js';

let memoryBest = 0;
let pendingBest = 0;

function readStoredBest(storage) {
  const score = Number(storage.getItem(BEST_KEY));
  return Number.isFinite(score) && score > 0 ? score : 0;
}

export function loadBest() {
  try {
    memoryBest = Math.max(pendingBest, readStoredBest(globalThis.localStorage));
  } catch {
    // Keep the last known best when storage cannot be read.
  }
  return memoryBest;
}

export function saveBest(score) {
  const candidate = Number.isFinite(score) ? score : 0;
  try {
    const storage = globalThis.localStorage;
    memoryBest = Math.max(pendingBest, readStoredBest(storage), candidate);
    storage.setItem(BEST_KEY, String(memoryBest));
    pendingBest = 0;
  } catch {
    memoryBest = Math.max(memoryBest, candidate);
    pendingBest = memoryBest;
  }
  return memoryBest;
}

export function getBest() {
  return loadBest();
}

const STATS_KEY = 'stardust-courier.stats';
const EMPTY_STATS = { orbs: 0, deliveries: 0, bestCombo: 0, timeSurvived: 0, bossKills: 0 };
let memoryStats = EMPTY_STATS;
let pendingStats = EMPTY_STATS;

function mergeStats(...records) {
  const best = { ...EMPTY_STATS };
  for (const key of Object.keys(best)) {
    for (const record of records) {
      const value = record?.[key];
      if (Number.isFinite(value)) best[key] = Math.max(best[key], value);
    }
  }
  return best;
}

function readStoredStats(storage) {
  const raw = storage.getItem(STATS_KEY);
  try {
    return JSON.parse(raw);
  } catch {
    return EMPTY_STATS;
  }
}

export function loadStats() {
  try {
    memoryStats = mergeStats(pendingStats, readStoredStats(globalThis.localStorage));
  } catch {
  }
  return { ...memoryStats };
}

export function saveStats(stats) {
  try {
    const storage = globalThis.localStorage;
    memoryStats = mergeStats(pendingStats, readStoredStats(storage), stats);
    storage.setItem(STATS_KEY, JSON.stringify(memoryStats));
    pendingStats = EMPTY_STATS;
  } catch {
    memoryStats = mergeStats(memoryStats, stats);
    pendingStats = memoryStats;
  }
  return { ...memoryStats };
}
