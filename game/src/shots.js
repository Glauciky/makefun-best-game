// Deterministic screenshot scenes: ?shot=<scene>&seed=<n> stages a fixed moment
// of the game (title, play, upgrade, victory) from the game's own code, so the
// screenshots are real renders, not composites. The main loop renders one frame
// and sets window.__shotReady when the scene is staged.
import { WORLD_W, WORLD_H } from './config.js';
import { makeRng } from './random.js';
import { spawnEnemy } from './enemies.js';
import { rollUpgrades } from './upgrades.js';

export function parseShot() {
  const q = new URLSearchParams(window.location.search);
  const shot = q.get('shot');
  if (!shot) return null;
  return { scene: shot, seed: Number(q.get('seed') || 7) };
}

export function setupShot(world, scene, seed) {
  const rng = makeRng(seed);
  world.best = 18450;
  if (scene === 'title') {
    world.state = 'title';
    // A slow drift of wisps and shards behind the title text, kept out of the
    // central text band and the start prompt so the title stays readable.
    const clearOfTitle = (x, y) => !(x > 240 && x < 720 && y > 70 && y < 330)
      && !(x > 280 && x < 680 && y > 430 && y < 520);
    for (let i = 0; i < 7; i++) {
      let x;
      let y;
      do { x = rng.range(60, WORLD_W - 60); y = rng.range(60, WORLD_H - 60); } while (!clearOfTitle(x, y));
      const e = spawnEnemy(rng.pick(['drifter', 'drifter', 'dart', 'spitter']), x, y);
      e.vx = rng.range(-14, 14);
      e.vy = rng.range(-10, 10);
      world.enemies.push(e);
    }
    for (let i = 0; i < 9; i++) {
      let x;
      let y;
      do { x = rng.range(40, WORLD_W - 40); y = rng.range(40, WORLD_H - 40); } while (!clearOfTitle(x, y));
      world.shards.push({ x, y, vx: 0, vy: 0, value: 1, life: 999, spin: rng.range(0, 6) });
    }
  } else if (scene === 'play') {
    world.state = 'play';
    world.director.wave = 4;
    world.director.queue = [{ at: 99, type: 'drifter' }];
    world.score = 2450;
    world.combo = 12;
    world.comboTimer = 2.1;
    world.kills = 31;
    world.shardsCollected = 58;
    world.player.hull = 78;
    world.player.x = 300;
    world.player.y = 300;
    world.player.angle = 0.2;
    world.player.aegis = true;
    world.player.shieldUp = true;
    const spots = [
      ['drifter', 560, 180], ['drifter', 640, 320], ['drifter', 480, 420],
      ['dart', 700, 150], ['dart', 760, 380], ['spitter', 820, 260],
      ['brute', 620, 480], ['drifter', 420, 140],
    ];
    for (const [type, x, y] of spots) {
      const e = spawnEnemy(type, x, y);
      e.angle = rng.angle();
      if (type === 'spitter') e.hp = 2;
      if (type === 'brute') e.hp = 6;
      world.enemies.push(e);
    }
    // A volley in flight toward the pack.
    for (let i = 0; i < 7; i++) {
      const a = 0.15 + (i - 3) * 0.05;
      world.bullets.push({
        x: 330 + i * 26, y: 300 + (i - 3) * 8,
        vx: Math.cos(a) * 560, vy: Math.sin(a) * 560,
        damage: 1, radius: 4, life: 1.1,
      });
    }
    // Incoming wisp orbs.
    world.orbs.push(
      { x: 700, y: 240, vx: -140, vy: 60, radius: 6, damage: 8, life: 5 },
      { x: 740, y: 300, vx: -150, vy: 10, radius: 6, damage: 8, life: 5 },
    );
    // Shards scattered around the field.
    for (let i = 0; i < 10; i++) {
      world.shards.push({ x: rng.range(120, 880), y: rng.range(80, 480), vx: 0, vy: 0, value: 1, life: 999, spin: rng.range(0, 6) });
    }
    world.particles.burst(560, 180, '#c86bff', 12, 180);
    world.particles.burst(700, 150, '#ff5e8a', 10, 160);
    world.particles.ring(620, 480, '#ff8a5e', 70);
    world.banner = null;
  } else if (scene === 'upgrade') {
    world.state = 'upgrade';
    world.director.wave = 3;
    world.score = 1820;
    world.shardsCollected = 41;
    world.kills = 22;
    world.player.hull = 64;
    world.choices = rollUpgrades(world.taken);
    world.hoverCard = 1;
    // A quiet field behind the cards.
    for (let i = 0; i < 5; i++) {
      world.shards.push({ x: rng.range(80, 880), y: rng.range(80, 460), vx: 0, vy: 0, value: 1, life: 999, spin: rng.range(0, 6) });
    }
  } else if (scene === 'victory') {
    world.state = 'win';
    world.director.wave = 10;
    world.score = 12480;
    world.best = 12480;
    world.shardsCollected = 214;
    world.kills = 96;
    world.shotsFired = 412;
    world.shotsHit = 258;
    world.player.hull = 41;
    world.particles.burst(480, 240, '#ffc94d', 40, 260, { life: 1.2, size: 4 });
    world.particles.burst(300, 300, '#5ef2e2', 24, 200, { life: 1.0, size: 3 });
    world.particles.burst(660, 300, '#c86bff', 24, 200, { life: 1.0, size: 3 });
  }
  window.__shotReady = true;
}
