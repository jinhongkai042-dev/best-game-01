// Pure WebAudio synthesizer for Stardust Courier.
// Generates all sound effects procedurally (collect blip, hit thud, power-up,
// level-up chime, start ignition, and game-over sweep) with zero external audio files.

let ctx = null;
let noiseBuffer = null;

function getContext() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    try {
      ctx = new AudioCtx();
    } catch {
      return null;
    }
  }
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

function getNoiseBuffer(audioCtx) {
  if (noiseBuffer && noiseBuffer.sampleRate === audioCtx.sampleRate) return noiseBuffer;
  const length = Math.floor(audioCtx.sampleRate * 0.35);
  const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (length * 0.35));
  }
  noiseBuffer = buffer;
  return buffer;
}

export function unlockAudio() {
  getContext();
}

/** Bright neon blip for collecting star-orbs; pitches up with combo and shimmers on bonus orbs. */
export function playCollect(combo = 1, isBonus = false) {
  const audioCtx = getContext();
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    const baseFreq = Math.min(1320, 520 + Math.max(0, combo - 1) * 55);

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = isBonus ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * (isBonus ? 1.85 : 1.45), now + 0.11);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + (isBonus ? 0.22 : 0.13));

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + (isBonus ? 0.23 : 0.14));

    if (isBonus) {
      const shimmer = audioCtx.createOscillator();
      const sGain = audioCtx.createGain();
      shimmer.type = 'sine';
      shimmer.frequency.setValueAtTime(baseFreq * 1.5, now + 0.04);
      shimmer.frequency.exponentialRampToValueAtTime(baseFreq * 2.4, now + 0.22);
      sGain.gain.setValueAtTime(0.001, now + 0.04);
      sGain.gain.linearRampToValueAtTime(0.14, now + 0.06);
      sGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.24);
      shimmer.connect(sGain);
      sGain.connect(audioCtx.destination);
      shimmer.start(now + 0.04);
      shimmer.stop(now + 0.25);
    }
  } catch {
    // Ignore audio context state errors in restricted browsers.
  }
}

/** Heavy sub-bass thud and noise burst when colliding with a dark comet. */
export function playHit(shieldAbsorbed = false) {
  const audioCtx = getContext();
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = shieldAbsorbed ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(shieldAbsorbed ? 280 : 135, now);
    osc.frequency.exponentialRampToValueAtTime(shieldAbsorbed ? 68 : 34, now + 0.28);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.31);

    const noise = audioCtx.createBufferSource();
    noise.buffer = getNoiseBuffer(audioCtx);
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(shieldAbsorbed ? 1400 : 620, now);
    filter.frequency.exponentialRampToValueAtTime(120, now + 0.25);

    const nGain = audioCtx.createGain();
    nGain.gain.setValueAtTime(0.18, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(audioCtx.destination);
    noise.start(now);
    noise.stop(now + 0.27);
  } catch {
    // Ignore audio errors.
  }
}

/** Shimmering synth arpeggio when grabbing a shield or double-score power-up. */
export function playPowerup(kind = 'shield') {
  const audioCtx = getContext();
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    const notes = kind === 'double' ? [587.33, 739.99, 880, 1174.66] : [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.045;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.14, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.16);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + 0.17);
    });
  } catch {
    // Ignore audio errors.
  }
}

/** Uplifting harmonic chime on advancing to the next level. */
export function playLevelUp() {
  const audioCtx = getContext();
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.065;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.02, start + 0.24);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.16, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.28);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + 0.29);
    });
  } catch {
    // Ignore audio errors.
  }
}

/** Descending minor synth progression when lives reach zero. */
export function playGameOver() {
  const audioCtx = getContext();
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    const notes = [392.0, 349.23, 311.13, 220.0];
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.11;
      const duration = idx === notes.length - 1 ? 0.45 : 0.22;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.94, start + duration);

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(900, start);
      filter.frequency.exponentialRampToValueAtTime(240, start + duration);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.15, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    });
  } catch {
    // Ignore audio errors.
  }
}

/** Quick thruster ignition sound when starting or restarting a run. */
export function playStart() {
  const audioCtx = getContext();
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.18);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.2);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.21);
  } catch {
    // Ignore audio errors.
  }
}

export function createAudio() {
  return {
    unlock: unlockAudio,
    collect: playCollect,
    hit: playHit,
    powerup: playPowerup,
    levelUp: playLevelUp,
    gameOver: playGameOver,
    start: playStart,
  };
}

export default createAudio;
