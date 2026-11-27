// Keyboard and mouse: arrows (or A/D and W/S) fly the plane, Shift/Ctrl work the
// throttle, Space confirms, P pauses, M mutes, R restarts. The mouse steers too —
// hold the pointer where you want the nose to go and the plane follows it.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_RESTART = 8;

/** A live control frame: turn -1..1 (left..right), pitch -1..1 (dive..climb),
 *  throttle -1..1 (close..open), each already smoothed by the caller if wanted. */
export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0.5;
  let mouseY = 0.5;
  let mouseActive = false;
  let mouseSeenAt = 0;

  function keyDown(event) {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(event.code)) event.preventDefault();
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') actions |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    if (event.code === 'KeyM') actions |= ACTION_MUTE;
    if (event.code === 'KeyR') actions |= ACTION_RESTART;
  }
  function keyUp(event) {
    keys.delete(event.code);
  }
  function pointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = (event.clientX - rect.left) / Math.max(1, rect.width);
    mouseY = (event.clientY - rect.top) / Math.max(1, rect.height);
    mouseActive = true;
    mouseSeenAt = performance.now();
  }
  function pointerDown(event) {
    pointerMove(event);
    actions |= ACTION_CONFIRM;
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerdown', pointerDown);

  return {
    /** One-shot actions since the last call (confirm, pause, mute, restart). */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The steering the pilot is asking for right now. */
    control() {
      let turn = 0;
      let pitch = 0;
      if (keys.has('ArrowLeft') || keys.has('KeyA')) turn -= 1;
      if (keys.has('ArrowRight') || keys.has('KeyD')) turn += 1;
      if (keys.has('ArrowUp') || keys.has('KeyW')) pitch += 1;
      if (keys.has('ArrowDown') || keys.has('KeyS')) pitch -= 1;
      // The mouse steers only while it was moved in the last few seconds, and only
      // when no arrow key is held: the keys always win an argument.
      if (mouseActive && performance.now() - mouseSeenAt < 4000 && turn === 0 && pitch === 0) {
        turn = (mouseX - 0.5) * 2.4;
        pitch = (0.5 - mouseY) * 2.0;
      }
      let throttle = 0;
      if (keys.has('ShiftLeft') || keys.has('ShiftRight')) throttle += 1;
      if (keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyC')) throttle -= 1;
      return {
        turn: Math.max(-1, Math.min(1, turn)),
        pitch: Math.max(-1, Math.min(1, pitch)),
        throttle,
      };
    },
  };
}
