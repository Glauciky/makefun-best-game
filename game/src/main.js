// Starfall Salvage — main loop and state machine. States: title, play, upgrade,
// pause, over (game over), win (sector cleared). The world object is the single
// place every module reads and writes through.
import { WORLD_W, WORLD_H, TOTAL_WAVES, COMBO } from './config.js';
import { createPlayer, updatePlayer, hurtPlayer } from './player.js';
import { updateEnemies, killEnemy, spawnAtEdge } from './enemies.js';
import { updatePickups } from './pickups.js';
import { WaveDirector } from './waves.js';
import { rollUpgrades, applyUpgrade } from './upgrades.js';
import { SoundEngine } from './audio.js';
import { Particles } from './particles.js';
import {
  drawBackground, drawEntities, drawHUD, drawBanner,
  drawTitle, drawUpgrade, drawPause, drawGameOver, drawVictory,
} from './render.js';
import { drawEnemy } from './enemies.js';
import { drawPickups } from './pickups.js';
import { attachInput, keys, mouse, view, pressed, consumeClick } from './input.js';
import { parseShot, setupShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

function loadBest() {
  try { return Number(window.localStorage.getItem('starfall-salvage-best') || 0) || 0; }
  catch { return 0; }
}

function saveBest(best) {
  try { window.localStorage.setItem('starfall-salvage-best', String(best)); }
  catch { /* storage unavailable: best score just lives for the session */ }
}

export function createWorld() {
  const world = {
    state: 'title',
    time: 0,
    player: createPlayer(),
    enemies: [],
    bullets: [],
    orbs: [],
    shards: [],
    cells: [],
    particles: new Particles(),
    sound: new SoundEngine(),
    director: new WaveDirector(),
    score: 0,
    best: loadBest(),
    combo: 0,
    comboTimer: 0,
    kills: 0,
    shardsCollected: 0,
    shotsFired: 0,
    shotsHit: 0,
    banner: null,
    choices: [],
    taken: {},
    upgradeRects: [],
    hoverCard: -1,
    playTime: 0,
    muted: false,
  };
  // These methods use `this`, not a closed-over world: startGame() copies a
  // fresh world's fields onto this one, and the methods must then act on the
  // object they are called on, not on the fresh object they were written in.
  world.multiplier = function () {
    return Math.min(COMBO.maxMult, 1 + Math.min(this.combo, 60) * COMBO.perStep);
  };
  world.addScore = function (base, x, y, isShard = false) {
    const gained = Math.round(base * this.multiplier());
    this.score += gained;
    if (isShard) this.particles.floatText(x, y - 8, `+${gained}`, '#ffc94d', 12);
    else this.particles.floatText(x, y - 10, `+${gained}`, '#e8ecff', 12);
  };
  world.bumpCombo = function () {
    this.combo += 1;
    this.comboTimer = this.player.comboWindow;
  };
  world.accuracy = function () {
    return this.shotsFired === 0 ? 0 : Math.round((this.shotsHit / this.shotsFired) * 100);
  };
  return world;
}

const world = createWorld();
attachInput(canvas);

// Test hook for scripted playtesting: lets a test jump to a wave, force a wave
// clear, or kill the player to check every screen in seconds. The game itself
// is fully playable by keyboard and mouse without it.
window.__starfall = { world, startGame };

// --- View transform: letterbox the 960x540 world into the window. ---
function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const scale = Math.min(w / WORLD_W, h / WORLD_H);
  view.scale = scale;
  view.offsetX = (w - WORLD_W * scale) / 2;
  view.offsetY = (h - WORLD_H * scale) / 2;
  world.dpr = dpr;
}
window.addEventListener('resize', resize);
resize();

function applyTransform() {
  const dpr = world.dpr || 1;
  const shake = world.particles.shakeOffset(world.time);
  ctx.setTransform(
    dpr * view.scale, 0, 0, dpr * view.scale,
    dpr * (view.offsetX + shake.x), dpr * (view.offsetY + shake.y),
  );
}

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

// --- Flow ---

function startGame() {
  const keepBest = world.best;
  const fresh = createWorld();
  fresh.best = keepBest;
  Object.assign(world, fresh);
  world.state = 'play';
  world.sound.unlock();
  world.sound.startMusic();
  world.director.startWave(1, world);
  setStatus('Wave 1. Collect shards, dodge the wisps.');
}

function waveCleared() {
  const bonus = 100 * world.director.wave;
  world.score += bonus;
  world.director.stop();
  consumeClick(); // a held fire button must not auto-pick an upgrade card
  if (world.director.wave >= TOTAL_WAVES) {
    world.state = 'win';
    world.sound.win();
    world.sound.stopMusic();
    if (world.score > world.best) { world.best = world.score; saveBest(world.best); }
    setStatus(`Sector cleared! Final score ${world.score}.`);
    return;
  }
  world.choices = rollUpgrades(world.taken);
  world.hoverCard = -1;
  world.state = 'upgrade';
  world.sound.upgradePick();
  setStatus(`Wave ${world.director.wave} cleared. Choose one upgrade.`);
}

function gameOver() {
  world.state = 'over';
  world.director.stop();
  world.sound.lose();
  world.sound.stopMusic();
  if (world.score > world.best) { world.best = world.score; saveBest(world.best); }
  setStatus(`Drone lost on wave ${world.director.wave}. Final score ${world.score}.`);
}

function pickUpgrade(index) {
  const def = world.choices[index];
  if (!def) return;
  applyUpgrade(world.player, def, world.taken);
  world.sound.upgradePick();
  world.particles.burst(world.player.x, world.player.y, '#ffd166', 20, 180);
  world.director.startWave(world.director.wave + 1, world);
  world.state = 'play';
  setStatus(`Wave ${world.director.wave}.`);
}

// --- Collisions ---

function collideBullets(dt) {
  for (let i = world.bullets.length - 1; i >= 0; i--) {
    const b = world.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || b.x < -20 || b.x > WORLD_W + 20 || b.y < -20 || b.y > WORLD_H + 20) {
      world.bullets.splice(i, 1);
      continue;
    }
    for (let j = world.enemies.length - 1; j >= 0; j--) {
      const e = world.enemies[j];
      const dx = e.x - b.x;
      const dy = e.y - b.y;
      const rr = e.radius + b.radius;
      if (dx * dx + dy * dy < rr * rr) {
        world.bullets.splice(i, 1);
        world.shotsHit += 1;
        e.hp -= b.damage;
        e.flash = 0.12;
        world.sound.enemyHit();
        world.particles.spawn(b.x, b.y, { vx: 0, vy: 0, life: 0.18, size: 4, color: '#ffe9a8', glow: true });
        if (e.hp <= 0) killEnemy(world, j);
        break;
      }
    }
  }
}

function collidePlayer(dt) {
  const p = world.player;
  if (p.dead) return;
  // Enemy touch.
  for (let j = world.enemies.length - 1; j >= 0; j--) {
    const e = world.enemies[j];
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const rr = e.radius + p.radius - 2;
    if (dx * dx + dy * dy < rr * rr) {
      hurtPlayer(p, e.touch, world);
      // Ram damage: the wisp takes a hit too and bounces off.
      e.hp -= 1;
      e.flash = 0.12;
      const d = Math.hypot(dx, dy) || 1;
      e.x += (dx / d) * 26;
      e.y += (dy / d) * 26;
      if (e.hp <= 0) killEnemy(world, j);
      if (p.dead) { gameOver(); return; }
    }
  }
  // Enemy orbs.
  for (let i = world.orbs.length - 1; i >= 0; i--) {
    const o = world.orbs[i];
    const dx = o.x - p.x;
    const dy = o.y - p.y;
    const rr = o.radius + p.radius - 2;
    if (dx * dx + dy * dy < rr * rr) {
      world.orbs.splice(i, 1);
      hurtPlayer(p, o.damage, world);
      if (p.dead) { gameOver(); return; }
    }
  }
}

function updateOrbs(dt) {
  for (let i = world.orbs.length - 1; i >= 0; i--) {
    const o = world.orbs[i];
    o.x += o.vx * dt;
    o.y += o.vy * dt;
    o.life -= dt;
    if (o.life <= 0 || o.x < -30 || o.x > WORLD_W + 30 || o.y < -30 || o.y > WORLD_H + 30) {
      world.orbs.splice(i, 1);
    }
  }
}

// --- Update ---

function update(dt) {
  world.time += dt;
  if (world.banner) {
    world.banner.t += dt;
    if (world.banner.t >= world.banner.dur) world.banner = null;
  }
  // Mute works everywhere.
  if (pressed('KeyM')) {
    world.muted = world.sound.toggleMute();
  }

  if (world.state === 'title') {
    // Ambient drift behind the title.
    for (const e of world.enemies) {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.wobble += dt;
      if (e.x < -30) e.x = WORLD_W + 30;
      if (e.x > WORLD_W + 30) e.x = -30;
      if (e.y < -30) e.y = WORLD_H + 30;
      if (e.y > WORLD_H + 30) e.y = -30;
    }
    world.particles.update(dt);
    const click = consumeClick();
    if (click || pressed('Enter')) startGame();
    return;
  }

  if (world.state === 'upgrade') {
    // Hover the card under the mouse.
    world.hoverCard = -1;
    world.upgradeRects.forEach((r, i) => {
      if (mouse.x >= r.x && mouse.x <= r.x + r.w && mouse.y >= r.y && mouse.y <= r.y + r.h) world.hoverCard = i;
    });
    world.particles.update(dt);
    const click = consumeClick();
    if (click && world.hoverCard >= 0) { pickUpgrade(world.hoverCard); return; }
    if (pressed('Digit1')) pickUpgrade(0);
    else if (pressed('Digit2')) pickUpgrade(1);
    else if (pressed('Digit3')) pickUpgrade(2);
    return;
  }

  if (world.state === 'pause') {
    if (pressed('KeyP') || pressed('Escape') || consumeClick()) {
      world.state = 'play';
      setStatus('Resumed.');
    }
    return;
  }

  if (world.state === 'over' || world.state === 'win') {
    world.particles.update(dt);
    const click = consumeClick();
    if (click || pressed('Enter')) startGame();
    return;
  }

  // --- play ---
  world.playTime += dt;
  // Drain clicks: a click does nothing while playing, but a stale click left
  // over from firing must not leak into the upgrade screen and pick a card
  // the player never chose.
  consumeClick();
  if (pressed('KeyP') || pressed('Escape')) {
    world.state = 'pause';
    setStatus('Paused.');
    return;
  }
  // Track shots fired: count bullets spawned this frame by watching the array.
  const bulletsBefore = world.bullets.length;
  updatePlayer(world.player, dt, world);
  world.shotsFired += Math.max(0, world.bullets.length - bulletsBefore);

  updateEnemies(world, dt);
  world.director.update(dt, world);
  collideBullets(dt);
  collidePlayer(dt);
  if (world.state !== 'play') return; // gameOver() may have fired
  updateOrbs(dt);
  updatePickups(world, dt);
  world.particles.update(dt);

  // Combo decay.
  if (world.combo > 0) {
    world.comboTimer -= dt;
    if (world.comboTimer <= 0) world.combo = Math.max(0, world.combo - dt * 12);
  }

  // Rare repair cell from a brute or the warden.
  if (world.cells.length === 0 && world.director.wave >= 3 && Math.random() < dt * 0.02) {
    world.cells.push({
      x: 80 + Math.random() * (WORLD_W - 160), y: 80 + Math.random() * (WORLD_H - 160),
      vx: 0, vy: 0, life: 10, spin: 0,
    });
  }

  if (world.director.isClear(world)) waveCleared();
}

// --- Render ---

function render() {
  applyTransform();
  drawBackground(ctx, world.time, world.state === 'play' ? world.player : null);
  if (world.state === 'title') {
    for (const e of world.enemies) drawEnemy(ctx, e, world.time);
    drawPickups(ctx, world, world.time);
    world.particles.draw(ctx);
    drawTitle(ctx, world, world.time);
  } else if (world.state === 'play' || world.state === 'pause') {
    drawEntities(ctx, world, world.time);
    drawHUD(ctx, world);
    drawBanner(ctx, world);
    if (world.state === 'pause') drawPause(ctx);
  } else if (world.state === 'upgrade') {
    drawEntities(ctx, world, world.time);
    drawUpgrade(ctx, world);
  } else if (world.state === 'over') {
    drawEntities(ctx, world, world.time);
    drawGameOver(ctx, world, world.time);
  } else if (world.state === 'win') {
    drawEntities(ctx, world, world.time);
    drawVictory(ctx, world, world.time);
  }
}

// --- Boot ---

const shot = parseShot();
if (shot) {
  // Screenshot mode: stage one fixed scene, render it once, signal readiness.
  world.sound = new SoundEngine(); // stays silent: no gesture, no audio
  setupShot(world, shot.scene, shot.seed);
  // Let one frame of particles settle so bursts read on screen.
  world.particles.update(0.12);
  render();
  window.__shotReady = true;
} else {
  // Title demo: a few wisps drifting behind the title.
  for (let i = 0; i < 6; i++) {
    const e = spawnAtEdge(['drifter', 'drifter', 'dart', 'spitter'][i % 4], world.player);
    e.vx = (Math.random() - 0.5) * 24;
    e.vy = (Math.random() - 0.5) * 20;
    world.enemies.push(e);
  }
  for (let i = 0; i < 8; i++) {
    world.shards.push({
      x: 60 + Math.random() * (WORLD_W - 120), y: 60 + Math.random() * (WORLD_H - 120),
      vx: 0, vy: 0, value: 1, life: 999, spin: Math.random() * 6,
    });
  }
  setStatus('Starfall Salvage. Click or press Enter to start.');

  let last = performance.now();
  let acc = 0;
  const STEP = 1 / 60;
  let firstFrame = true;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 5) {
      update(STEP);
      acc -= STEP;
      steps += 1;
    }
    if (steps === 5) acc = 0;
    render();
    if (firstFrame) { firstFrame = false; window.__shotReady = true; }
  }
  requestAnimationFrame(frame);
}
