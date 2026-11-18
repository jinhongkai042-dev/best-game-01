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
