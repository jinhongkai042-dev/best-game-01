// Pure WebAudio synthesizer for Stardust Courier.
// Generates all sound effects procedurally (collect blip, hit thud, power-up,
// level-up chime, start ignition, and game-over sweep) with zero external audio files.

let ctx = null;
let noiseBuffer = null;
const lastPlayedAt = Object.create(null);

function canTrigger(tag, audioCtx, minGap = 0.08) {
  const now = audioCtx.currentTime;
  const prev = lastPlayedAt[tag];
  if (prev !== undefined && now - prev < minGap) return false;
  lastPlayedAt[tag] = now;
  return true;
}

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

/** Magnetic attraction hum + rising harmonic sweep when grabbing a magnet power-up. */
export function playMagnet() {
  const audioCtx = getContext();
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    const notes = [330, 440, 659.25, 880];
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.04;
      const osc = audioCtx.createOscillator();
      const sub = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      sub.type = 'triangle';
      osc.frequency.setValueAtTime(freq * 0.92, start);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.12, start + 0.18);
      sub.frequency.setValueAtTime(freq * 0.5, start);
      sub.frequency.exponentialRampToValueAtTime(freq * 0.56, start + 0.18);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.14, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.2);

      osc.connect(gain);
      sub.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(start);
      sub.start(start);
      osc.stop(start + 0.21);
      sub.stop(start + 0.21);
    });
  } catch {
    // Ignore audio errors.
  }
}

/** Crystalline time-dilation sweep when grabbing a chrono-slow power-up. */
export function playSlow() {
  const audioCtx = getContext();
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    const notes = [1046.5, 783.99, 659.25, 523.25];
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.055;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.88, start + 0.22);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.15, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.24);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + 0.25);
    });
  } catch {
    // Ignore audio errors.
  }
}

/** Shimmering synth arpeggio when grabbing a shield, double, magnet, slow, life, or bomb power-up. */
export function playPowerup(kind = 'shield') {
  if (kind === 'magnet') {
    playMagnet();
    return;
  }
  if (kind === 'slow') {
    playSlow();
    return;
  }
  if (kind === 'bomb') {
    playBomb();
    return;
  }
  const audioCtx = getContext();
  if (!audioCtx) return;
  if (kind === 'life' && !canTrigger('life', audioCtx, 0.08)) return;
  try {
    const now = audioCtx.currentTime;
    const notes =
      kind === 'double'
        ? [587.33, 739.99, 880, 1174.66]
        : kind === 'life'
          ? [523.25, 659.25, 783.99, 1046.5, 1318.51]
          : [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.045;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = kind === 'life' ? 'sine' : 'triangle';
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

/** Euphoric portal chord & warp chime on completing a stardust gate delivery. */
export function playDelivery() {
  const audioCtx = getContext();
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    const notes = [523.25, 659.25, 783.99, 987.77, 1318.51, 1567.98];
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.042;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.04, start + 0.28);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.16, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.32);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + 0.33);
    });

    // Warm sub-bass portal resonance
    const sub = audioCtx.createOscillator();
    const subGain = audioCtx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(130.81, now);
    sub.frequency.exponentialRampToValueAtTime(261.63, now + 0.35);
    subGain.gain.setValueAtTime(0.001, now);
    subGain.gain.linearRampToValueAtTime(0.2, now + 0.02);
    subGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.38);
    sub.connect(subGain);
    subGain.connect(audioCtx.destination);
    sub.start(now);
    sub.stop(now + 0.39);
  } catch {
    // Ignore audio errors.
  }
}

/** Deep hyper-jump swell and sector fanfare when entering a new cosmic zone. */
export function playZoneChange() {
  const audioCtx = getContext();
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    const swell = audioCtx.createOscillator();
    const swellFilter = audioCtx.createBiquadFilter();
    const swellGain = audioCtx.createGain();
    swell.type = 'sawtooth';
    swell.frequency.setValueAtTime(110, now);
    swell.frequency.exponentialRampToValueAtTime(220, now + 0.45);
    swellFilter.type = 'lowpass';
    swellFilter.frequency.setValueAtTime(320, now);
    swellFilter.frequency.exponentialRampToValueAtTime(1800, now + 0.4);
    swellGain.gain.setValueAtTime(0.001, now);
    swellGain.gain.linearRampToValueAtTime(0.14, now + 0.08);
    swellGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.48);
    swell.connect(swellFilter);
    swellFilter.connect(swellGain);
    swellGain.connect(audioCtx.destination);
    swell.start(now);
    swell.stop(now + 0.5);

    const chord = [440, 659.25, 880, 1108.73];
    chord.forEach((freq, idx) => {
      const start = now + 0.06 + idx * 0.055;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.14, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.36);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + 0.38);
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

/** Short high-speed whoosh when triggering a dash burst. */
export function playDash() {
  const audioCtx = getContext();
  if (!audioCtx || !canTrigger('dash', audioCtx, 0.08)) return;
  try {
    const now = audioCtx.currentTime;

    // Band-passed filtered air whoosh
    const noise = audioCtx.createBufferSource();
    noise.buffer = getNoiseBuffer(audioCtx);
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(1.6, now);
    filter.frequency.setValueAtTime(1600, now);
    filter.frequency.exponentialRampToValueAtTime(340, now + 0.16);

    const nGain = audioCtx.createGain();
    nGain.gain.setValueAtTime(0.001, now);
    nGain.gain.linearRampToValueAtTime(0.22, now + 0.018);
    nGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.17);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(audioCtx.destination);
    noise.start(now);
    noise.stop(now + 0.18);

    // Crisp ion-thruster sweep
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.15);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.16);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  } catch {
    // Ignore audio errors.
  }
}

/** Deep resonant low boom when an elite comet enters or exits the field. */
export function playElite() {
  const audioCtx = getContext();
  if (!audioCtx || !canTrigger('elite', audioCtx, 0.1)) return;
  try {
    const now = audioCtx.currentTime;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(112, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + 0.34);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.26, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.36);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.38);

    const sub = audioCtx.createOscillator();
    const sGain = audioCtx.createGain();
    sub.type = 'triangle';
    sub.frequency.setValueAtTime(168, now);
    sub.frequency.exponentialRampToValueAtTime(54, now + 0.28);
    sGain.gain.setValueAtTime(0.001, now);
    sGain.gain.linearRampToValueAtTime(0.11, now + 0.02);
    sGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.3);
    sub.connect(sGain);
    sGain.connect(audioCtx.destination);
    sub.start(now);
    sub.stop(now + 0.32);
  } catch {
    // Ignore audio errors.
  }
}

/** Bright crystalline chime arpeggio when hitting a combo milestone (x5, x10). */
export function playComboMilestone(combo = 5) {
  const audioCtx = getContext();
  if (!audioCtx || !canTrigger('milestone', audioCtx, 0.08)) return;
  try {
    const now = audioCtx.currentTime;
    const notes =
      combo >= 10
        ? [659.25, 880, 1108.73, 1318.51, 1760]
        : [587.33, 739.99, 880, 1174.66, 1479.98];
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.04;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.03, start + 0.22);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.15, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.24);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + 0.25);
    });
  } catch {
    // Ignore audio errors.
  }
}

/** Soft deep shockwave thump when a bomb power-up clears comets. */
export function playBomb() {
  const audioCtx = getContext();
  if (!audioCtx || !canTrigger('bomb', audioCtx, 0.08)) return;
  try {
    const now = audioCtx.currentTime;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(148, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.26);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.24, now + 0.014);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.28);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.3);

    const noise = audioCtx.createBufferSource();
    noise.buffer = getNoiseBuffer(audioCtx);
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(720, now);
    filter.frequency.exponentialRampToValueAtTime(140, now + 0.22);

    const nGain = audioCtx.createGain();
    nGain.gain.setValueAtTime(0.001, now);
    nGain.gain.linearRampToValueAtTime(0.14, now + 0.012);
    nGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.24);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(audioCtx.destination);
    noise.start(now);
    noise.stop(now + 0.25);
  } catch {
    // Ignore audio errors.
  }
}

/** Deep sub-bass boom when a boss comet enters the arena. */
export function playBossSpawn() {
  const audioCtx = getContext();
  if (!audioCtx || !canTrigger('bossSpawn', audioCtx, 0.15)) return;
  try {
    const now = audioCtx.currentTime;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(96, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.55);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.32, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.58);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.6);

    const sub = audioCtx.createOscillator();
    const sGain = audioCtx.createGain();
    sub.type = 'triangle';
    sub.frequency.setValueAtTime(144, now);
    sub.frequency.exponentialRampToValueAtTime(42, now + 0.45);
    sGain.gain.setValueAtTime(0.001, now);
    sGain.gain.linearRampToValueAtTime(0.14, now + 0.025);
    sGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.48);
    sub.connect(sGain);
    sGain.connect(audioCtx.destination);
    sub.start(now);
    sub.stop(now + 0.5);

    const noise = audioCtx.createBufferSource();
    noise.buffer = getNoiseBuffer(audioCtx);
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, now);
    filter.frequency.exponentialRampToValueAtTime(80, now + 0.35);

    const nGain = audioCtx.createGain();
    nGain.gain.setValueAtTime(0.001, now);
    nGain.gain.linearRampToValueAtTime(0.15, now + 0.02);
    nGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.36);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(audioCtx.destination);
    noise.start(now);
    noise.stop(now + 0.38);
  } catch {
    // Ignore audio errors.
  }
}

/** Short percussive thunk when the boss takes damage. */
export function playBossHit() {
  const audioCtx = getContext();
  if (!audioCtx || !canTrigger('bossHit', audioCtx, 0.06)) return;
  try {
    const now = audioCtx.currentTime;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(210, now);
    osc.frequency.exponentialRampToValueAtTime(62, now + 0.12);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.24, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.13);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.14);

    const punch = audioCtx.createOscillator();
    const filter = audioCtx.createBiquadFilter();
    const pGain = audioCtx.createGain();
    punch.type = 'square';
    punch.frequency.setValueAtTime(150, now);
    punch.frequency.exponentialRampToValueAtTime(55, now + 0.09);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(620, now);
    pGain.gain.setValueAtTime(0.001, now);
    pGain.gain.linearRampToValueAtTime(0.12, now + 0.006);
    pGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.1);

    punch.connect(filter);
    filter.connect(pGain);
    pGain.connect(audioCtx.destination);
    punch.start(now);
    punch.stop(now + 0.11);
  } catch {
    // Ignore audio errors.
  }
}

/** Rising arpeggio fanfare when the boss is defeated. */
export function playBossDown() {
  const audioCtx = getContext();
  if (!audioCtx || !canTrigger('bossDown', audioCtx, 0.15)) return;
  try {
    const now = audioCtx.currentTime;
    const notes = [392.0, 493.88, 587.33, 783.99, 987.77, 1174.66];
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.055;
      const isLast = idx === notes.length - 1;
      const dur = isLast ? 0.42 : 0.2;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.02, start + dur);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(isLast ? 0.2 : 0.16, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + dur);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    });

    const bass = audioCtx.createOscillator();
    const bGain = audioCtx.createGain();
    bass.type = 'sine';
    bass.frequency.setValueAtTime(196.0, now);
    bass.frequency.exponentialRampToValueAtTime(392.0, now + 0.42);
    bGain.gain.setValueAtTime(0.001, now);
    bGain.gain.linearRampToValueAtTime(0.18, now + 0.02);
    bGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.48);
    bass.connect(bGain);
    bGain.connect(audioCtx.destination);
    bass.start(now);
    bass.stop(now + 0.5);
  } catch {
    // Ignore audio errors.
  }
}

/** Rising two-note siren warning before a comet storm begins. */
export function playStormWarn() {
  const audioCtx = getContext();
  if (!audioCtx || !canTrigger('stormWarn', audioCtx, 0.15)) return;
  try {
    const now = audioCtx.currentTime;
    const pulses = [
      { offset: 0, from: 440, to: 660, dur: 0.18 },
      { offset: 0.23, from: 587.33, to: 880, dur: 0.22 },
    ];
    pulses.forEach((p) => {
      const start = now + p.offset;
      const osc = audioCtx.createOscillator();
      const filter = audioCtx.createBiquadFilter();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(p.from, start);
      osc.frequency.exponentialRampToValueAtTime(p.to, start + p.dur);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, start);
      filter.frequency.exponentialRampToValueAtTime(2200, start + p.dur);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.14, start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + p.dur + 0.03);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + p.dur + 0.04);
    });
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
    magnet: playMagnet,
    slow: playSlow,
    delivery: playDelivery,
    zoneChange: playZoneChange,
    levelUp: playLevelUp,
    gameOver: playGameOver,
    start: playStart,
    dash: playDash,
    elite: playElite,
    comboMilestone: playComboMilestone,
    milestone: playComboMilestone,
    bomb: playBomb,
    bossSpawn: playBossSpawn,
    bossHit: playBossHit,
    bossDown: playBossDown,
    stormWarn: playStormWarn,
  };
}

export default createAudio;
