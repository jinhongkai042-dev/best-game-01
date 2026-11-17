// Unified keyboard (WASD / Arrow keys / Space / Enter) and mouse/pointer input handler.
// Maps window pointer coordinates into the 1280x720 logical playfield and exposes the
// exact fields expected by world.js ({ up, down, left, right, mouseX, mouseY, mouseDown })
// as well as action helpers for main.js.

import { HEIGHT, WIDTH } from './config.js';
import { unlockAudio } from './audio.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

const LEFT_KEYS = new Set(['ArrowLeft', 'KeyA', 'a', 'A']);
const RIGHT_KEYS = new Set(['ArrowRight', 'KeyD', 'd', 'D']);
const UP_KEYS = new Set(['ArrowUp', 'KeyW', 'w', 'W']);
const DOWN_KEYS = new Set(['ArrowDown', 'KeyS', 's', 'S']);
const CONFIRM_KEYS = new Set(['Space', 'Enter', ' ', 'NumpadEnter']);
const PAUSE_KEYS = new Set(['KeyP', 'Escape', 'p', 'P']);

export function clientToLogical(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return { x: WIDTH / 2, y: HEIGHT / 2 };
  }
  const scale = Math.min(rect.width / WIDTH, rect.height / HEIGHT);
  const offsetX = (rect.width - WIDTH * scale) / 2;
  const offsetY = (rect.height - HEIGHT * scale) / 2;
  const localX = (clientX - rect.left - offsetX) / scale;
  const localY = (clientY - rect.top - offsetY) / scale;
  return {
    x: Math.max(0, Math.min(WIDTH, localX)),
    y: Math.max(0, Math.min(HEIGHT, localY)),
  };
}

export function createInput(canvas = window) {
  const heldCodes = new Set();
  let keyLeft = false;
  let keyRight = false;
  let keyUp = false;
  let keyDown = false;

  let pointerX = WIDTH / 2;
  let pointerY = HEIGHT * 0.62;
  let mouseActive = false;
  let pointerDown = false;
  let actions = 0;
  let confirmPressed = false;

  function updateKeyFlags() {
    keyLeft = false;
    keyRight = false;
    keyUp = false;
    keyDown = false;
    for (const code of heldCodes) {
      if (LEFT_KEYS.has(code)) keyLeft = true;
      if (RIGHT_KEYS.has(code)) keyRight = true;
      if (UP_KEYS.has(code)) keyUp = true;
      if (DOWN_KEYS.has(code)) keyDown = true;
    }
  }

  function onKeyDown(event) {
    unlockAudio();
    const code = event.code || event.key;
    if (
      LEFT_KEYS.has(code) ||
      RIGHT_KEYS.has(code) ||
      UP_KEYS.has(code) ||
      DOWN_KEYS.has(code)
    ) {
      heldCodes.add(code);
      updateKeyFlags();
      // Keyboard steering overrides mouse target until the mouse moves again.
      mouseActive = false;
      event.preventDefault();
      return;
    }
    if (CONFIRM_KEYS.has(code)) {
      heldCodes.add(code);
      if (!event.repeat) {
        actions |= ACTION_CONFIRM;
        confirmPressed = true;
      }
      event.preventDefault();
      return;
    }
    if (PAUSE_KEYS.has(code)) {
      if (!event.repeat) {
        actions |= ACTION_PAUSE;
      }
      event.preventDefault();
    }
  }

  function onKeyUp(event) {
    const code = event.code || event.key;
    heldCodes.delete(code);
    if (event.key) heldCodes.delete(event.key);
    updateKeyFlags();
  }

  function onPointerMove(event) {
    const targetCanvas = canvas && canvas.getBoundingClientRect ? canvas : document.getElementById('game');
    if (!targetCanvas) return;
    const pos = clientToLogical(targetCanvas, event.clientX, event.clientY);
    pointerX = pos.x;
    pointerY = pos.y;
    mouseActive = true;
  }

  function onPointerDown(event) {
    unlockAudio();
    pointerDown = true;
    onPointerMove(event);
    actions |= ACTION_CONFIRM;
    confirmPressed = true;
  }

  function onPointerUp() {
    pointerDown = false;
  }

  function onBlur() {
    heldCodes.clear();
    updateKeyFlags();
    pointerDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  const eventTarget = canvas || window;
  eventTarget.addEventListener('pointermove', onPointerMove);
  eventTarget.addEventListener('mousemove', onPointerMove);
  eventTarget.addEventListener('pointerdown', onPointerDown);
  eventTarget.addEventListener('mousedown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('mouseup', onPointerUp);

  const state = {
    left: false,
    right: false,
    up: false,
    down: false,
    dx: 0,
    dy: 0,
    mouseX: null,
    mouseY: null,
    mouseDown: false,
    mouseActive: false,
    keys: heldCodes,
    start: false,
    restart: false,
    action: false,
    confirm: false,
    /** Updates and returns the current frame's input state. */
    sample() {
      let dx = (keyRight ? 1 : 0) - (keyLeft ? 1 : 0);
      let dy = (keyDown ? 1 : 0) - (keyUp ? 1 : 0);
      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy);
        dx /= len;
        dy /= len;
      }

      state.left = keyLeft;
      state.right = keyRight;
      state.up = keyUp;
      state.down = keyDown;
      state.dx = dx;
      state.dy = dy;

      state.mouseActive = mouseActive;
      state.mouseDown = pointerDown;
      state.mouseX = mouseActive ? pointerX : null;
      state.mouseY = mouseActive ? pointerY : null;

      state.start = confirmPressed;
      state.restart = confirmPressed;
      state.action = confirmPressed;
      state.confirm = confirmPressed;

      return state;
    },
    clearConfirm() {
      confirmPressed = false;
      actions &= ~ACTION_CONFIRM;
    },
    consumeConfirm() {
      const was = confirmPressed || Boolean(actions & ACTION_CONFIRM);
      confirmPressed = false;
      actions &= ~ACTION_CONFIRM;
      return was;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      confirmPressed = false;
      return taken;
    },
  };

  return state;
}

export default createInput;
