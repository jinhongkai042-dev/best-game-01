// Pure Canvas 2D renderer for Stardust Courier.
// Draws strictly from the interface-contract state object:
// { status: 'title'|'playing'|'over', score, lives, level, combo, comboTimer,
//   time, shield, doubleTimer, player: {x, y, r}, orbs: [{x, y, r, kind}],
//   comets: [{x, y, r, vx, vy}], powerups: [{x, y, r, kind}],
//   particles: [{x, y, vx, vy, life, color}] }

import { COMBO, FONT, HEIGHT, LIVES, MONO_FONT, PALETTE, WIDTH } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'playing';
export const SCREEN_OVER = 'over';

// Precomputed deterministic starfield and nebula layers (no runtime allocations).
const STARS = (() => {
  const list = [];
  let s = 0x9e3779b9;
  const rand = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const hues = ['#ffffff', '#bceeff', '#ffd6ff', '#ffe9a8', '#72efdd', '#ff9ebb'];
  for (let i = 0; i < 140; i += 1) {
    const layer = i < 70 ? 0 : i < 115 ? 1 : 2;
    list.push({
      x: rand() * WIDTH,
      y: rand() * HEIGHT,
      r: layer === 0 ? 0.7 + rand() * 0.8 : layer === 1 ? 1.2 + rand() * 1.2 : 1.8 + rand() * 1.4,
      speed: layer === 0 ? 14 : layer === 1 ? 38 : 92,
      phase: rand() * Math.PI * 2,
      color: hues[i % hues.length],
      layer,
    });
  }
  return list;
})();

const NEBULAE = [
  { x: 260, y: 210, r: 340, c0: 'rgba(0, 229, 255, 0.13)', c1: 'rgba(0, 119, 255, 0.04)' },
  { x: 980, y: 260, r: 390, c0: 'rgba(255, 42, 133, 0.12)', c1: 'rgba(123, 44, 191, 0.04)' },
  { x: 640, y: 540, r: 420, c0: 'rgba(114, 9, 183, 0.14)', c1: 'rgba(0, 245, 255, 0.03)' },
  { x: 180, y: 580, r: 260, c0: 'rgba(0, 255, 170, 0.08)', c1: 'rgba(0, 0, 0, 0)' },
];

// Decorative showcase entities used only on the title screen if state arrays are empty.
const TITLE_SHOWCASE_ORBS = [
  { x: 210, y: 190, r: 12, kind: 'star' },
  { x: 1060, y: 175, r: 16, kind: 'bonus' },
  { x: 175, y: 495, r: 16, kind: 'bonus' },
  { x: 1095, y: 510, r: 12, kind: 'star' },
  { x: 310, y: 340, r: 12, kind: 'star' },
  { x: 960, y: 360, r: 12, kind: 'star' },
];

const TITLE_SHOWCASE_COMETS = [
  { x: 195, y: 120, r: 20, vx: 130, vy: 190 },
  { x: 1110, y: 420, r: 22, vx: -150, vy: 175 },
];

function roundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawHeart(ctx, cx, cy, size, filled) {
  const s = size * 0.5;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.85);
  ctx.bezierCurveTo(cx - s * 1.25, cy + s * 0.1, cx - s * 1.15, cy - s * 0.85, cx - s * 0.5, cy - s * 0.85);
  ctx.bezierCurveTo(cx - s * 0.15, cy - s * 0.85, cx, cy - s * 0.45, cx, cy - s * 0.35);
  ctx.bezierCurveTo(cx, cy - s * 0.45, cx + s * 0.15, cy - s * 0.85, cx + s * 0.5, cy - s * 0.85);
  ctx.bezierCurveTo(cx + s * 1.15, cy - s * 0.85, cx + s * 1.25, cy + s * 0.1, cx, cy + s * 0.85);
  ctx.closePath();

  if (filled) {
    ctx.shadowColor = PALETTE.heartFull;
    ctx.shadowBlur = 12;
    const grad = ctx.createLinearGradient(cx, cy - s, cx, cy + s);
    grad.addColorStop(0, '#ff75b5');
    grad.addColorStop(0.5, PALETTE.heartFull);
    grad.addColorStop(1, '#b5179e');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#ffd6eb';
    ctx.stroke();

    // Specular shine
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.ellipse(cx - s * 0.42, cy - s * 0.42, s * 0.22, s * 0.12, -0.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(255, 42, 133, 0.08)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 117, 181, 0.32)';
    ctx.stroke();
  }
  ctx.restore();
}

function drawStarPolygon(ctx, cx, cy, points, outerR, innerR, rotation = 0) {
  ctx.beginPath();
  const step = Math.PI / points;
  for (let i = 0; i < points * 2; i += 1) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = rotation + i * step - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawBackground(ctx, time, level) {
  const bgGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bgGrad.addColorStop(0, PALETTE.spaceTop);
  bgGrad.addColorStop(0.55, PALETTE.spaceMid);
  bgGrad.addColorStop(1, PALETTE.spaceBottom);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Drifting cosmic nebulae
  for (let i = 0; i < NEBULAE.length; i += 1) {
    const neb = NEBULAE[i];
    const nx = neb.x + Math.sin(time * 0.18 + i * 1.7) * 28;
    const ny = neb.y + Math.cos(time * 0.14 + i * 2.1) * 20;
    const grad = ctx.createRadialGradient(nx, ny, 10, nx, ny, neb.r);
    grad.addColorStop(0, neb.c0);
    grad.addColorStop(0.6, neb.c1);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  // Subtle hyper-lane grid lines
  ctx.save();
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.045)';
  ctx.lineWidth = 1;
  const gridSpacing = 80;
  const scrollOffset = ((time * (28 + level * 4)) % gridSpacing + gridSpacing) % gridSpacing;
  for (let x = 0; x <= WIDTH; x += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = scrollOffset; y <= HEIGHT; y += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }
  ctx.restore();

  // Parallax starfield
  const speedScale = 1 + Math.max(0, (level || 1) - 1) * 0.18;
  for (let i = 0; i < STARS.length; i += 1) {
    const st = STARS[i];
    const sy = ((st.y + time * st.speed * speedScale) % HEIGHT + HEIGHT) % HEIGHT;
    const sx = ((st.x + Math.sin(time * 0.25 + st.phase) * (st.layer + 1) * 3) % WIDTH + WIDTH) % WIDTH;
    const twinkle = 0.55 + 0.45 * Math.sin(time * 3.2 + st.phase);

    ctx.globalAlpha = twinkle;
    ctx.fillStyle = st.color;

    if (st.layer === 2) {
      // Fast warp-streak stars
      const streak = Math.min(18, 4 + speedScale * 4);
      ctx.strokeStyle = st.color;
      ctx.lineWidth = st.r * 0.85;
      ctx.beginPath();
      ctx.moveTo(sx, sy - streak);
      ctx.lineTo(sx, sy);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(sx, sy, st.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawOrbs(ctx, orbs, time) {
  if (!Array.isArray(orbs)) return;
  for (let i = 0; i < orbs.length; i += 1) {
    const orb = orbs[i];
    if (!orb) continue;
    const x = orb.x;
    const y = orb.y;
    const isBonus = orb.kind === 'bonus';
    const baseR = orb.r || (isBonus ? 16 : 12);
    const pulse = 1 + 0.12 * Math.sin(time * 5.5 + i * 1.3);
    const r = baseR * pulse;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Outer neon bloom
    const haloR = r * (isBonus ? 3.0 : 2.6);
    const halo = ctx.createRadialGradient(x, y, r * 0.15, x, y, haloR);
    if (isBonus) {
      halo.addColorStop(0, 'rgba(255, 255, 220, 0.95)');
      halo.addColorStop(0.32, 'rgba(255, 215, 0, 0.65)');
      halo.addColorStop(0.68, 'rgba(255, 42, 165, 0.28)');
      halo.addColorStop(1, 'rgba(255, 42, 165, 0)');
    } else {
      halo.addColorStop(0, 'rgba(230, 255, 255, 0.95)');
      halo.addColorStop(0.35, 'rgba(0, 245, 255, 0.6)');
      halo.addColorStop(0.7, 'rgba(0, 119, 255, 0.22)');
      halo.addColorStop(1, 'rgba(0, 119, 255, 0)');
    }
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, haloR, 0, Math.PI * 2);
    ctx.fill();

    // Rotating orbital ring
    ctx.strokeStyle = isBonus ? 'rgba(255, 215, 0, 0.65)' : 'rgba(0, 245, 255, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.28, time * 2 + i, time * 2 + i + Math.PI * 1.35);
    ctx.stroke();

    // Star-orb core polygon
    const rot = time * (isBonus ? 1.8 : 1.2) + i * 0.7;
    drawStarPolygon(ctx, x, y, isBonus ? 8 : 4, r * 1.18, r * 0.48, rot);
    ctx.fillStyle = isBonus ? '#ffd700' : '#00f5ff';
    ctx.fill();

    // White-hot inner core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.42, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

function drawPowerups(ctx, powerups, time) {
  if (!Array.isArray(powerups)) return;
  for (let i = 0; i < powerups.length; i += 1) {
    const p = powerups[i];
    if (!p) continue;
    const x = p.x;
    const y = p.y;
    const r = p.r || 15;
    const isDouble = p.kind === 'double';
    const primary = isDouble ? PALETTE.double : PALETTE.shield;
    const secondary = isDouble ? PALETTE.doubleGlow : PALETTE.shieldGlow;

    ctx.save();

    // Pulsing aura
    const aura = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 2.7);
    aura.addColorStop(0, isDouble ? 'rgba(255, 209, 102, 0.55)' : 'rgba(0, 255, 170, 0.55)');
    aura.addColorStop(0.6, isDouble ? 'rgba(255, 42, 133, 0.2)' : 'rgba(0, 229, 255, 0.2)');
    aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.7, 0, Math.PI * 2);
    ctx.fill();

    // Rotating outer tech arcs
    const spin = time * 2.4 + i;
    ctx.strokeStyle = primary;
    ctx.lineWidth = 2;
    for (let a = 0; a < 2; a += 1) {
      const start = spin + a * Math.PI;
      ctx.beginPath();
      ctx.arc(x, y, r * 1.32, start, start + Math.PI * 0.62);
      ctx.stroke();
    }

    // Hexagonal capsule body
    ctx.beginPath();
    for (let s = 0; s < 6; s += 1) {
      const ang = (s * Math.PI) / 3 - Math.PI / 6;
      const px = x + Math.cos(ang) * r;
      const py = y + Math.sin(ang) * r;
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(8, 16, 36, 0.9)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = secondary;
    ctx.stroke();

    // Inner emblem
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = primary;
    if (isDouble) {
      ctx.font = `bold ${Math.round(r * 0.95)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = primary;
      ctx.fillText('2×', x, y + 1);
    } else {
      // Shield crest icon
      const sr = r * 0.55;
      ctx.beginPath();
      ctx.moveTo(x, y - sr);
      ctx.lineTo(x + sr * 0.85, y - sr * 0.45);
      ctx.lineTo(x + sr * 0.65, y + sr * 0.45);
      ctx.lineTo(x, y + sr);
      ctx.lineTo(x - sr * 0.65, y + sr * 0.45);
      ctx.lineTo(x - sr * 0.85, y - sr * 0.45);
      ctx.closePath();
      ctx.fillStyle = primary;
      ctx.fill();
    }

    // Micro label below capsule
    ctx.font = `bold 10px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = primary;
    ctx.fillText(isDouble ? '2× SCORE' : 'SHIELD', x, y + r * 1.48);

    ctx.restore();
  }
}

function drawComets(ctx, comets, time) {
  if (!Array.isArray(comets)) return;
  for (let i = 0; i < comets.length; i += 1) {
    const c = comets[i];
    if (!c) continue;
    const x = c.x;
    const y = c.y;
    const r = c.r || 20;
    const vx = Number.isFinite(c.vx) ? c.vx : 0;
    const vy = Number.isFinite(c.vy) ? c.vy : 220;
    const angle = vx === 0 && vy === 0 ? Math.PI / 2 : Math.atan2(vy, vx);
    const tailLen = r * 4.4;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Fiery dark-matter plasma wake (points along -X in rotated space)
    const tailGrad = ctx.createLinearGradient(0, 0, -tailLen, 0);
    tailGrad.addColorStop(0, 'rgba(255, 42, 109, 0.72)');
    tailGrad.addColorStop(0.35, 'rgba(181, 23, 158, 0.38)');
    tailGrad.addColorStop(1, 'rgba(19, 9, 31, 0)');
    ctx.fillStyle = tailGrad;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.78);
    ctx.quadraticCurveTo(-tailLen * 0.5, -r * 0.45 + Math.sin(time * 12 + i) * 3, -tailLen, 0);
    ctx.quadraticCurveTo(-tailLen * 0.5, r * 0.45 + Math.cos(time * 12 + i) * 3, 0, r * 0.78);
    ctx.closePath();
    ctx.fill();

    // Inner bright core jet
    const coreTail = ctx.createLinearGradient(0, 0, -tailLen * 0.65, 0);
    coreTail.addColorStop(0, 'rgba(255, 140, 66, 0.85)');
    coreTail.addColorStop(1, 'rgba(255, 42, 109, 0)');
    ctx.fillStyle = coreTail;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.36);
    ctx.lineTo(-tailLen * 0.65, 0);
    ctx.lineTo(0, r * 0.36);
    ctx.closePath();
    ctx.fill();

    // Menacing crimson danger halo
    const aura = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 1.9);
    aura.addColorStop(0, 'rgba(255, 42, 109, 0.48)');
    aura.addColorStop(1, 'rgba(255, 42, 109, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.9, 0, Math.PI * 2);
    ctx.fill();

    // Jagged obsidian comet rock body
    const spin = time * 1.6 + i * 2.1;
    ctx.rotate(spin);
    const vertices = 9;
    ctx.beginPath();
    for (let v = 0; v < vertices; v += 1) {
      const a = (v / vertices) * Math.PI * 2;
      const jag = v % 2 === 0 ? 1.06 : 0.82 + 0.08 * Math.sin(v * 3.1 + i);
      const px = Math.cos(a) * r * jag;
      const py = Math.sin(a) * r * jag;
      if (v === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = PALETTE.cometCore;
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = PALETTE.cometRim;
    ctx.stroke();

    // Internal magma fissures
    ctx.strokeStyle = 'rgba(255, 130, 80, 0.8)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-r * 0.45, -r * 0.2);
    ctx.lineTo(r * 0.1, r * 0.05);
    ctx.lineTo(r * 0.45, -r * 0.3);
    ctx.moveTo(r * 0.1, r * 0.05);
    ctx.lineTo(-r * 0.15, r * 0.5);
    ctx.stroke();

    ctx.restore();
  }
}

function drawParticles(ctx, particles) {
  if (!Array.isArray(particles) || particles.length === 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < particles.length; i += 1) {
    const pt = particles[i];
    if (!pt) continue;
    const rawLife = Number.isFinite(pt.life) ? pt.life : 0.5;
    if (rawLife <= 0) continue;
    const alpha = Math.max(0.08, Math.min(1, rawLife));
    const color = pt.color || PALETTE.cyan;
    const r = 2.2 + alpha * 3.4;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;

    if (Number.isFinite(pt.vx) && Number.isFinite(pt.vy)) {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1.2, r * 0.65);
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.x - pt.vx * 0.035, pt.y - pt.vy * 0.035);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPlayer(ctx, state, trail) {
  const player = state.player;
  if (!player || !Number.isFinite(player.x) || !Number.isFinite(player.y)) return;
  const x = player.x;
  const y = player.y;
  const r = player.r || 16;
  const time = state.time || 0;

  // Build synthetic trail if history is short (e.g. single-frame screenshot render)
  const points = trail.length >= 4
    ? trail
    : [
        { x: x - 26, y: y + 48 },
        { x: x - 18, y: y + 36 },
        { x: x - 10, y: y + 24 },
        { x: x - 4, y: y + 12 },
        { x, y },
      ];

  // Calculate slight banking tilt from recent horizontal motion
  const oldest = points[Math.max(0, points.length - 4)] || { x, y };
  const dx = x - oldest.x;
  const dy = y - oldest.y;
  const bankAngle = Math.max(-0.35, Math.min(0.35, dx * 0.015));

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // Glowing twin-ion ribbon wake
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const frac = (i + 1) / points.length;
    ctx.strokeStyle = state.doubleTimer > 0 ? 'rgba(255, 209, 102, 0.55)' : 'rgba(0, 245, 255, 0.55)';
    ctx.lineWidth = r * 0.75 * frac;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y + r * 0.55);
    ctx.lineTo(p1.x, p1.y + r * 0.55);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 42, 133, 0.42)';
    ctx.lineWidth = r * 0.4 * frac;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y + r * 0.7);
    ctx.lineTo(p1.x, p1.y + r * 0.7);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(bankAngle);

  // Engine plasma flame cones
  const flameLen = r * (1.35 + 0.35 * Math.sin(time * 28)) + Math.min(10, Math.hypot(dx, dy) * 0.3);
  const flameGrad = ctx.createLinearGradient(0, r * 0.5, 0, r * 0.6 + flameLen);
  flameGrad.addColorStop(0, '#ffffff');
  flameGrad.addColorStop(0.35, state.doubleTimer > 0 ? '#ffd166' : '#00f5ff');
  flameGrad.addColorStop(0.75, '#ff2a85');
  flameGrad.addColorStop(1, 'rgba(255, 42, 133, 0)');
  ctx.fillStyle = flameGrad;

  // Center main thruster + twin side thrusters
  ctx.beginPath();
  ctx.moveTo(-r * 0.36, r * 0.55);
  ctx.lineTo(0, r * 0.65 + flameLen);
  ctx.lineTo(r * 0.36, r * 0.55);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-r * 0.68, r * 0.48);
  ctx.lineTo(-r * 0.52, r * 0.55 + flameLen * 0.65);
  ctx.lineTo(-r * 0.38, r * 0.48);
  ctx.moveTo(r * 0.38, r * 0.48);
  ctx.lineTo(r * 0.52, r * 0.55 + flameLen * 0.65);
  ctx.lineTo(r * 0.68, r * 0.48);
  ctx.fill();

  // Ambient ship glow
  const shipGlow = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 2.2);
  shipGlow.addColorStop(0, state.doubleTimer > 0 ? 'rgba(255, 209, 102, 0.32)' : 'rgba(0, 245, 255, 0.28)');
  shipGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = shipGlow;
  ctx.beginPath();
  ctx.arc(0, 0, r * 2.2, 0, Math.PI * 2);
  ctx.fill();

  // Outer swept delta wings
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.15);
  ctx.lineTo(r * 1.22, r * 0.62);
  ctx.lineTo(r * 0.65, r * 0.42);
  ctx.lineTo(r * 0.35, r * 0.72);
  ctx.lineTo(0, r * 0.52);
  ctx.lineTo(-r * 0.35, r * 0.72);
  ctx.lineTo(-r * 0.65, r * 0.42);
  ctx.lineTo(-r * 1.22, r * 0.62);
  ctx.closePath();

  const hullGrad = ctx.createLinearGradient(0, -r * 1.2, 0, r * 0.8);
  hullGrad.addColorStop(0, '#ffffff');
  hullGrad.addColorStop(0.45, '#b8f3ff');
  hullGrad.addColorStop(1, '#00b4d8');
  ctx.fillStyle = hullGrad;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = state.doubleTimer > 0 ? PALETTE.gold : PALETTE.cyan;
  ctx.stroke();

  // Magenta racing chevrons on wings
  ctx.fillStyle = PALETTE.shipAccent;
  ctx.beginPath();
  ctx.moveTo(-r * 0.42, -r * 0.05);
  ctx.lineTo(-r * 0.98, r * 0.48);
  ctx.lineTo(-r * 0.64, r * 0.38);
  ctx.closePath();
  ctx.moveTo(r * 0.42, -r * 0.05);
  ctx.lineTo(r * 0.98, r * 0.48);
  ctx.lineTo(r * 0.64, r * 0.38);
  ctx.closePath();
  ctx.fill();

  // Cockpit canopy
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.08, r * 0.28, r * 0.52, 0, 0, Math.PI * 2);
  const canopyGrad = ctx.createLinearGradient(0, -r * 0.55, 0, r * 0.45);
  canopyGrad.addColorStop(0, '#00f5ff');
  canopyGrad.addColorStop(0.5, '#091836');
  canopyGrad.addColorStop(1, '#7209b7');
  ctx.fillStyle = canopyGrad;
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  // Double-score overdrive aura ring
  if (state.doubleTimer > 0) {
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.52, time * 3, time * 3 + Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Active shield hexagonal forcefield
  if (state.shield) {
    const shieldR = r * 1.82;
    const shieldGrad = ctx.createRadialGradient(0, 0, r * 0.9, 0, 0, shieldR);
    shieldGrad.addColorStop(0, 'rgba(0, 255, 170, 0)');
    shieldGrad.addColorStop(0.75, 'rgba(0, 229, 255, 0.14)');
    shieldGrad.addColorStop(1, 'rgba(0, 255, 170, 0.42)');
    ctx.fillStyle = shieldGrad;

    ctx.beginPath();
    for (let s = 0; s < 6; s += 1) {
      const a = time * 1.1 + (s * Math.PI) / 3;
      const sx = Math.cos(a) * shieldR;
      const sy = Math.sin(a) * shieldR;
      if (s === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = PALETTE.shield;
    ctx.stroke();
  }

  ctx.restore();
}

function drawHud(ctx, state) {
  const score = Math.max(0, Math.floor(state.score || 0));
  const lives = Math.max(0, Math.floor(state.lives ?? LIVES));
  const level = Math.max(1, Math.floor(state.level || 1));
  const combo = Math.max(1, Math.floor(state.combo || 1));
  const comboTimer = Math.max(0, state.comboTimer || 0);

  ctx.save();

  // 1. Top-Left Score & Combo Panel
  roundedRect(ctx, 22, 18, 290, 74, 12);
  ctx.fillStyle = PALETTE.hudBg;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = PALETTE.hudBorder;
  ctx.stroke();

  ctx.font = `bold 12px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('STARDUST SCORE', 38, 28);

  ctx.font = `bold 32px ${MONO_FONT}`;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(score.toLocaleString('en-US').padStart(6, '0'), 38, 45);

  // Combo Multiplier Pill inside Score Panel
  const comboColor = combo >= 4 ? PALETTE.magenta : combo >= 2 ? PALETTE.gold : PALETTE.cyan;
  roundedRect(ctx, 194, 28, 102, 34, 8);
  ctx.fillStyle = combo > 1 ? 'rgba(255, 42, 133, 0.18)' : 'rgba(0, 229, 255, 0.1)';
  ctx.fill();
  ctx.strokeStyle = comboColor;
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.font = `bold 16px ${FONT}`;
  ctx.fillStyle = comboColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`COMBO ×${combo}`, 245, 45);

  // Combo timer bar
  const barWidth = 96;
  const barFill = combo > 1 ? Math.min(1, Math.max(0, comboTimer / COMBO.duration)) : 0;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.fillRect(197, 68, barWidth, 5);
  if (barFill > 0) {
    ctx.fillStyle = comboColor;
    ctx.fillRect(197, 68, barWidth * barFill, 5);
  }

  // 2. Top-Center Sector Level & Power-up Status
  const centerX = WIDTH / 2;
  roundedRect(ctx, centerX - 96, 18, 192, 46, 12);
  ctx.fillStyle = PALETTE.hudBg;
  ctx.fill();
  ctx.strokeStyle = PALETTE.hudBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.font = `bold 11px ${FONT}`;
  ctx.fillStyle = PALETTE.cyan;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('HYPER-LANE SECTOR', centerX, 24);

  ctx.font = `bold 20px ${FONT}`;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(`LEVEL ${level}`, centerX, 39);

  // Active Power-up Pills below Level Badge
  let pillY = 72;
  if (state.shield) {
    roundedRect(ctx, centerX - 82, pillY, 164, 24, 12);
    ctx.fillStyle = 'rgba(0, 255, 170, 0.18)';
    ctx.fill();
    ctx.strokeStyle = PALETTE.shield;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.font = `bold 12px ${FONT}`;
    ctx.fillStyle = PALETTE.shield;
    ctx.textBaseline = 'middle';
    ctx.fillText('◆ SHIELD ACTIVE', centerX, pillY + 12);
    pillY += 30;
  }
  if (state.doubleTimer > 0) {
    roundedRect(ctx, centerX - 92, pillY, 184, 24, 12);
    ctx.fillStyle = 'rgba(255, 209, 102, 0.2)';
    ctx.fill();
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.font = `bold 12px ${FONT}`;
    ctx.fillStyle = PALETTE.gold;
    ctx.textBaseline = 'middle';
    ctx.fillText(`★ 2× SCORE · ${state.doubleTimer.toFixed(1)}s`, centerX, pillY + 12);
  }

  // 3. Top-Right Hull Lives (Hearts)
  const rightW = 204;
  const rightX = WIDTH - 22 - rightW;
  roundedRect(ctx, rightX, 18, rightW, 60, 12);
  ctx.fillStyle = PALETTE.hudBg;
  ctx.fill();
  ctx.strokeStyle = PALETTE.hudBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.font = `bold 12px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('LIVES', rightX + 18, 48);

  const maxLives = Math.max(LIVES, lives);
  for (let i = 0; i < maxLives; i += 1) {
    const hx = rightX + 86 + i * 38;
    const hy = 48;
    drawHeart(ctx, hx, hy, 26, i < lives);
  }

  ctx.restore();
}

function drawTitleOverlay(ctx, state, bestScore) {
  const time = state.time || 0;
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;

  ctx.save();

  // Subtle radial vignette behind title card
  const vig = ctx.createRadialGradient(cx, cy, 120, cx, cy, 680);
  vig.addColorStop(0, 'rgba(5, 8, 24, 0.35)');
  vig.addColorStop(1, 'rgba(3, 5, 17, 0.78)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Holographic Command Card
  const cardW = 760;
  const cardH = 470;
  const cardX = cx - cardW / 2;
  const cardY = cy - cardH / 2;

  ctx.shadowColor = 'rgba(0, 229, 255, 0.35)';
  ctx.shadowBlur = 28;
  roundedRect(ctx, cardX, cardY, cardW, cardH, 20);
  ctx.fillStyle = 'rgba(7, 12, 34, 0.88)';
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.lineWidth = 2;
  ctx.strokeStyle = PALETTE.cyan;
  ctx.stroke();

  // Inner decorative frame
  roundedRect(ctx, cardX + 10, cardY + 10, cardW - 20, cardH - 20, 14);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255, 42, 133, 0.35)';
  ctx.stroke();

  // Subtitle
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold 14px ${FONT}`;
  ctx.fillStyle = PALETTE.cyan;
  ctx.fillText('✦  NEON STARFIELD EXPRESS  ·  SECTOR 09  ✦', cx, cardY + 48);

  // Main Game Title with neon glow
  ctx.save();
  ctx.font = `900 64px ${FONT}`;
  ctx.shadowColor = '#00f5ff';
  ctx.shadowBlur = 22;
  const titleGrad = ctx.createLinearGradient(cx - 280, cardY + 80, cx + 280, cardY + 135);
  titleGrad.addColorStop(0, '#00f5ff');
  titleGrad.addColorStop(0.5, '#ffffff');
  titleGrad.addColorStop(1, '#ff2a85');
  ctx.fillStyle = titleGrad;
  ctx.fillText('STARDUST COURIER', cx, cardY + 106);
  ctx.restore();

  ctx.font = `18px ${FONT}`;
  ctx.fillStyle = '#c4d7f2';
  ctx.fillText(
    'Pilot your courier ship through the neon starfield. Chain star-orbs to build your combo!',
    cx,
    cardY + 158,
  );

  // Feature Legend Cards (Orbs, Power-ups, Comets)
  const boxY = cardY + 190;
  const boxH = 118;
  const boxW = 216;
  const gap = 22;
  const startX = cx - (boxW * 3 + gap * 2) / 2;

  const cards = [
    {
      title: 'STAR & NOVA ORBS',
      sub1: 'Cyan Star: +10 PTS',
      sub2: 'Gold Bonus: +50 PTS',
      color: PALETTE.cyan,
    },
    {
      title: 'POWER-UP PODS',
      sub1: 'Shield: 1 Free Hit',
      sub2: 'Double: 2× Score (10s)',
      color: PALETTE.shield,
    },
    {
      title: 'DARK COMETS',
      sub1: 'Deadly Void Hazard',
      sub2: 'Collision Costs 1 Heart',
      color: PALETTE.danger,
    },
  ];

  for (let i = 0; i < cards.length; i += 1) {
    const bx = startX + i * (boxW + gap);
    roundedRect(ctx, bx, boxY, boxW, boxH, 12);
    ctx.fillStyle = 'rgba(14, 22, 54, 0.85)';
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = cards[i].color;
    ctx.stroke();

    ctx.font = `bold 14px ${FONT}`;
    ctx.fillStyle = cards[i].color;
    ctx.fillText(cards[i].title, bx + boxW / 2, boxY + 30);

    ctx.font = `14px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(cards[i].sub1, bx + boxW / 2, boxY + 62);
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(cards[i].sub2, bx + boxW / 2, boxY + 88);
  }

  // Controls & Best Score
  ctx.font = `bold 15px ${FONT}`;
  ctx.fillStyle = PALETTE.gold;
  const bestText = bestScore > 0 ? `   ·   BEST SCORE: ${bestScore.toLocaleString('en-US')}` : '';
  ctx.fillText(`CONTROLS:  ARROW KEYS / WASD  or  MOUSE${bestText}`, cx, cardY + 345);

  // Pulsing Press to Start Button
  const pulse = 0.85 + 0.15 * Math.sin(time * 5);
  const btnW = 390;
  const btnH = 54;
  const btnX = cx - btnW / 2;
  const btnY = cardY + 382;

  ctx.save();
  ctx.globalAlpha = pulse;
  roundedRect(ctx, btnX, btnY, btnW, btnH, 27);
  const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX + btnW, btnY);
  btnGrad.addColorStop(0, '#00b4d8');
  btnGrad.addColorStop(0.5, '#00f5ff');
  btnGrad.addColorStop(1, '#7209b7');
  ctx.fillStyle = btnGrad;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.restore();

  ctx.font = `bold 20px ${FONT}`;
  ctx.fillStyle = '#040818';
  ctx.fillText('PRESS TO START  (SPACE / CLICK)', cx, btnY + btnH / 2 + 1);

  ctx.restore();
}

function drawGameOverOverlay(ctx, state, bestScore) {
  const time = state.time || 0;
  const score = Math.max(0, Math.floor(state.score || 0));
  const best = Math.max(score, Math.floor(bestScore || 0));
  const level = Math.max(1, Math.floor(state.level || 1));
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;

  ctx.save();

  // Dramatic crimson-tinted dark overlay
  const vig = ctx.createRadialGradient(cx, cy, 80, cx, cy, 700);
  vig.addColorStop(0, 'rgba(20, 6, 28, 0.68)');
  vig.addColorStop(1, 'rgba(4, 4, 14, 0.88)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const cardW = 620;
  const cardH = 410;
  const cardX = cx - cardW / 2;
  const cardY = cy - cardH / 2;

  ctx.shadowColor = 'rgba(255, 42, 109, 0.4)';
  ctx.shadowBlur = 28;
  roundedRect(ctx, cardX, cardY, cardW, cardH, 20);
  ctx.fillStyle = 'rgba(10, 12, 32, 0.92)';
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.lineWidth = 2;
  ctx.strokeStyle = PALETTE.danger;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = `bold 14px ${FONT}`;
  ctx.fillStyle = PALETTE.gold;
  ctx.fillText(`HULL INTEGRITY DEPLETED  ·  REACHED SECTOR LEVEL ${level}`, cx, cardY + 48);

  ctx.save();
  ctx.font = `900 56px ${FONT}`;
  ctx.shadowColor = PALETTE.danger;
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#ff4d88';
  ctx.fillText('GAME OVER', cx, cardY + 104);
  ctx.restore();

  // Final Score Display Box
  roundedRect(ctx, cx - 220, cardY + 150, 440, 124, 14);
  ctx.fillStyle = 'rgba(18, 24, 56, 0.88)';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(0, 245, 255, 0.45)';
  ctx.stroke();

  ctx.font = `bold 14px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('FINAL STARDUST SCORE', cx, cardY + 178);

  ctx.font = `bold 48px ${MONO_FONT}`;
  ctx.fillStyle = PALETTE.cyan;
  ctx.fillText(score.toLocaleString('en-US'), cx, cardY + 218);

  ctx.font = `bold 15px ${FONT}`;
  ctx.fillStyle = PALETTE.gold;
  ctx.fillText(`BEST RECORD: ${best.toLocaleString('en-US')} PTS`, cx, cardY + 256);

  // Restart Prompt Button
  const pulse = 0.86 + 0.14 * Math.sin(time * 5);
  const btnW = 380;
  const btnH = 52;
  const btnX = cx - btnW / 2;
  const btnY = cardY + 316;

  ctx.save();
  ctx.globalAlpha = pulse;
  roundedRect(ctx, btnX, btnY, btnW, btnH, 26);
  ctx.fillStyle = PALETTE.cyan;
  ctx.fill();
  ctx.restore();

  ctx.font = `bold 19px ${FONT}`;
  ctx.fillStyle = '#040818';
  ctx.fillText('PRESS SPACE OR CLICK TO RESTART', cx, btnY + btnH / 2 + 1);

  ctx.restore();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const trail = [];

  // Internal renderer-only tracking for hit screen shake (never mutates state).
  let prevLives = null;
  let prevShield = null;
  let prevTime = 0;
  let shakeTime = 0;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(window.innerWidth * ratio));
    const height = Math.max(1, Math.round(window.innerHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    view.scale = Math.min(width / WIDTH, height / HEIGHT);
    view.x = (width - WIDTH * view.scale) / 2;
    view.y = (height - HEIGHT * view.scale) / 2;
  }

  function draw(state, screenOrBest = 0, maybeBest = 0) {
    if (!state) return;
    resize();

    const status =
      typeof screenOrBest === 'string'
        ? screenOrBest === 'play'
          ? 'playing'
          : screenOrBest
        : state.status || 'title';
    const bestScore = typeof screenOrBest === 'number' ? screenOrBest : maybeBest || 0;
    const nowTime = Number.isFinite(state.time) ? state.time : 0;
    const dt = Math.max(0, Math.min(0.1, nowTime - prevTime));
    prevTime = nowTime;

    // Detect hit from state.lives / state.shield transition
    if (status === 'playing') {
      if (
        (prevLives !== null && state.lives < prevLives) ||
        (prevShield === true && !state.shield)
      ) {
        shakeTime = 0.35;
      }
      prevLives = state.lives;
      prevShield = Boolean(state.shield);
    } else {
      prevLives = state.lives;
      prevShield = Boolean(state.shield);
      shakeTime = 0;
    }

    if (shakeTime > 0) {
      shakeTime = Math.max(0, shakeTime - (dt || 1 / 60));
    }

    // Update ship trail history from state.player
    if (state.player && Number.isFinite(state.player.x) && Number.isFinite(state.player.y)) {
      const last = trail[trail.length - 1];
      if (!last || Math.hypot(state.player.x - last.x, state.player.y - last.y) > 1.5) {
        trail.push({ x: state.player.x, y: state.player.y });
        if (trail.length > 14) trail.shift();
      }
    }

    // Outer letterbox clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply playfield transform + camera shake offset
    const shakeMag = shakeTime > 0 ? shakeTime * 26 : 0;
    const shakeX = shakeMag * Math.sin(nowTime * 65);
    const shakeY = shakeMag * Math.cos(nowTime * 53);

    ctx.save();
    ctx.setTransform(
      view.scale,
      0,
      0,
      view.scale,
      view.x + shakeX * view.scale,
      view.y + shakeY * view.scale,
    );

    // Clip to 1280x720 logical playfield
    ctx.beginPath();
    ctx.rect(0, 0, WIDTH, HEIGHT);
    ctx.clip();

    drawBackground(ctx, nowTime, state.level || 1);

    // On title screen, if world arrays are empty, render ambient showcase entities
    const orbsToDraw =
      status === 'title' && (!state.orbs || state.orbs.length === 0)
        ? TITLE_SHOWCASE_ORBS
        : state.orbs;
    const cometsToDraw =
      status === 'title' && (!state.comets || state.comets.length === 0)
        ? TITLE_SHOWCASE_COMETS
        : state.comets;

    drawOrbs(ctx, orbsToDraw, nowTime);
    drawPowerups(ctx, state.powerups, nowTime);
    drawComets(ctx, cometsToDraw, nowTime);
    drawPlayer(ctx, state, trail);
    drawParticles(ctx, state.particles);

    // Brief crimson edge flash when hit
    if (shakeTime > 0) {
      ctx.fillStyle = `rgba(255, 42, 109, ${(shakeTime * 0.65).toFixed(3)})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    if (status === 'title') {
      drawTitleOverlay(ctx, state, bestScore);
    } else if (status === 'over') {
      drawGameOverOverlay(ctx, state, bestScore);
      drawHud(ctx, state);
    } else {
      drawHud(ctx, state);
    }

    ctx.restore();
  }

  resize();
  window.addEventListener('resize', resize);

  return {
    draw,
    render: draw,
    resize,
  };
}

let defaultRenderer = null;

export function draw(target, state, bestScore = 0) {
  const canvas = target && target.canvas ? target.canvas : target;
  if (!defaultRenderer || defaultRenderer.canvas !== canvas) {
    const inst = createRenderer(canvas);
    defaultRenderer = { canvas, inst };
  }
  defaultRenderer.inst.draw(state, bestScore);
}

export const render = draw;
export default createRenderer;
