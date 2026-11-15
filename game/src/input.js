// Keyboard and mouse input. The canvas is letterboxed into the window, so the
// main loop tells this module the current view transform (scale + offset) and
// mouse positions are converted into world coordinates here.
export const keys = new Set();
export const mouse = {
  x: 0, y: 0, // world coordinates
  clientX: 0, clientY: 0,
  down: false,
  clicked: false, // set on mousedown, consumed by the game loop
  clickX: 0, clickY: 0, // world coordinates of the last click
};

export const view = { scale: 1, offsetX: 0, offsetY: 0 };

const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space', 'Enter', 'Escape', 'KeyP', 'KeyM',
  'Digit1', 'Digit2', 'Digit3',
]);

export function attachInput(canvas) {
  window.addEventListener('keydown', (e) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); mouse.down = false; });

  canvas.addEventListener('mousemove', (e) => {
    mouse.clientX = e.clientX;
    mouse.clientY = e.clientY;
    mouse.x = (e.clientX - view.offsetX) / view.scale;
    mouse.y = (e.clientY - view.offsetY) / view.scale;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    mouse.down = true;
    mouse.clicked = true;
    mouse.clickX = (e.clientX - view.offsetX) / view.scale;
    mouse.clickY = (e.clientY - view.offsetY) / view.scale;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function axis() {
  // Movement axis from WASD / arrows, normalized.
  let x = 0;
  let y = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
  if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
  return { x, y };
}

export function firing() {
  return mouse.down || keys.has('Space');
}

export function pressed(code) {
  // One-shot key test: true only on the frame the key went down.
  if (!keys.has(code)) return false;
  keys.delete(code);
  return true;
}

export function consumeClick() {
  if (!mouse.clicked) return null;
  mouse.clicked = false;
  return { x: mouse.clickX, y: mouse.clickY };
}
