// Star shards (score) and repair cells (hull). Shards scatter when an enemy
// dies, drift, and get pulled toward the player by the magnet radius.
import { WORLD_W, WORLD_H } from './config.js';

export function updatePickups(world, dt) {
  const p = world.player;
  for (let i = world.shards.length - 1; i >= 0; i--) {
    const s = world.shards[i];
    s.life -= dt;
    if (s.life <= 0) { world.shards.splice(i, 1); continue; }
    s.spin += dt * 4;
    const dx = p.x - s.x;
    const dy = p.y - s.y;
    const dist = Math.hypot(dx, dy) || 1;
    // Magnet pull inside the pickup radius, gentle drift otherwise.
    if (!p.dead && dist < p.magnetRadius) {
      const pull = 900 * (1 - dist / p.magnetRadius) + 200;
      s.vx += (dx / dist) * pull * dt;
      s.vy += (dy / dist) * pull * dt;
    }
    s.vx *= Math.max(0, 1 - 2.2 * dt);
    s.vy *= Math.max(0, 1 - 2.2 * dt);
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.x = Math.max(8, Math.min(WORLD_W - 8, s.x));
    s.y = Math.max(8, Math.min(WORLD_H - 8, s.y));
    // Collect.
    if (!p.dead && dist < p.radius + 10) {
      world.shards.splice(i, 1);
      world.shardsCollected += 1;
      world.addScore(p.shardValue, s.x, s.y, true);
      world.bumpCombo();
      world.sound.pickup(world.combo);
      world.particles.spawn(s.x, s.y, { vx: 0, vy: -30, life: 0.3, size: 4, color: '#ffc94d', glow: true });
    }
  }
  for (let i = world.cells.length - 1; i >= 0; i--) {
    const c = world.cells[i];
    c.life -= dt;
    if (c.life <= 0) { world.cells.splice(i, 1); continue; }
    c.spin += dt * 2;
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (!p.dead && dist < p.magnetRadius) {
      c.vx += (dx / dist) * 500 * dt;
      c.vy += (dy / dist) * 500 * dt;
    }
    c.vx *= Math.max(0, 1 - 2 * dt);
    c.vy *= Math.max(0, 1 - 2 * dt);
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    if (!p.dead && dist < p.radius + 12) {
      world.cells.splice(i, 1);
      p.hull = Math.min(p.maxHull, p.hull + 25);
      world.sound.upgradePick();
      world.particles.floatText(p.x, p.y - 26, '+25 HULL', '#7dff9e', 14);
      world.particles.burst(c.x, c.y, '#7dff9e', 12, 140);
    }
  }
}

export function drawPickups(ctx, world, time) {
  for (const s of world.shards) {
    const blink = s.life < 3 ? (Math.floor(time * 6) % 2 === 0 ? 0.35 : 1) : 1;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.spin);
    ctx.globalAlpha = blink;
    ctx.shadowColor = '#ffc94d';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffc94d';
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(5, 0); ctx.lineTo(0, 8); ctx.lineTo(-5, 0);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.moveTo(0, -3.5); ctx.lineTo(2, 0); ctx.lineTo(0, 3.5); ctx.lineTo(-2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  for (const c of world.cells) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(Math.sin(c.spin) * 0.15);
    ctx.shadowColor = '#7dff9e';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#1d7a44';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#b8ffd0';
    ctx.fillRect(-2.5, -7, 5, 14);
    ctx.fillRect(-7, -2.5, 14, 5);
    ctx.restore();
  }
}
