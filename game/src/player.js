// The salvage drone: movement, firing, upgrades state, damage and drawing.
// The player object holds both its physics state and its upgradeable stats, so
// the upgrade screen can mutate one place.
import { PLAYER, WORLD_W, WORLD_H } from './config.js';
import { axis, firing, mouse } from './input.js';

export function createPlayer() {
  return {
    x: WORLD_W / 2, y: WORLD_H / 2,
    vx: 0, vy: 0,
    angle: -Math.PI / 2,
    radius: PLAYER.radius,
    hull: PLAYER.hull,
    maxHull: PLAYER.hull,
    fireRate: PLAYER.fireRate,
    bulletDamage: PLAYER.bulletDamage,
    bulletSpeed: PLAYER.bulletSpeed,
    projectiles: 1,
    magnetRadius: PLAYER.magnetRadius,
    maxSpeed: PLAYER.maxSpeed,
    shardValue: 10,
    aegis: false,
    shieldUp: false, // recharged at the start of every wave
    comboWindow: 3.0,
    regen: 0,
    fireTimer: 0,
    invuln: 0,
    thrust: 0, // 0..1, how hard the engines are working (for the flame)
    dead: false,
  };
}

export function updatePlayer(p, dt, world) {
  if (p.dead) return;
  const move = axis();
  p.vx += move.x * PLAYER.accel * dt;
  p.vy += move.y * PLAYER.accel * dt;
  const drag = Math.max(0, 1 - PLAYER.drag * dt);
  p.vx *= drag;
  p.vy *= drag;
  const speed = Math.hypot(p.vx, p.vy);
  if (speed > p.maxSpeed) {
    p.vx = (p.vx / speed) * p.maxSpeed;
    p.vy = (p.vy / speed) * p.maxSpeed;
  }
  p.x = Math.max(p.radius, Math.min(WORLD_W - p.radius, p.x + p.vx * dt));
  p.y = Math.max(p.radius, Math.min(WORLD_H - p.radius, p.y + p.vy * dt));
  p.thrust = Math.min(1, Math.hypot(move.x, move.y));
  p.angle = Math.atan2(mouse.y - p.y, mouse.x - p.x);

  if (p.invuln > 0) p.invuln -= dt;
  if (p.regen > 0 && p.hull < p.maxHull) {
    p.hull = Math.min(p.maxHull, p.hull + p.regen * dt);
  }

  // Thruster sparkle.
  if (p.thrust > 0.1 && Math.random() < 0.6) {
    const back = p.angle + Math.PI;
    world.particles.trail(
      p.x + Math.cos(back) * 14 + (Math.random() - 0.5) * 6,
      p.y + Math.sin(back) * 14 + (Math.random() - 0.5) * 6,
      '#5ef2e2',
    );
  }

  // Fire toward the mouse while held.
  p.fireTimer -= dt;
  if (firing() && p.fireTimer <= 0) {
    p.fireTimer = 1 / p.fireRate;
    const n = p.projectiles;
    for (let i = 0; i < n; i++) {
      const spread = (i - (n - 1) / 2) * 0.14;
      const a = p.angle + spread;
      world.bullets.push({
        x: p.x + Math.cos(a) * 18,
        y: p.y + Math.sin(a) * 18,
        vx: Math.cos(a) * p.bulletSpeed,
        vy: Math.sin(a) * p.bulletSpeed,
        damage: p.bulletDamage,
        radius: PLAYER.bulletRadius,
        life: 1.1,
      });
    }
    world.sound.shoot();
    // Muzzle flash.
    world.particles.spawn(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20, {
      vx: Math.cos(p.angle) * 60, vy: Math.sin(p.angle) * 60,
      life: 0.12, size: 5, color: '#ffe9a8', glow: true,
    });
  }
}

// Returns true when the hit actually hurt the player (not blocked, not invulnerable).
export function hurtPlayer(p, damage, world) {
  if (p.dead || p.invuln > 0) return false;
  if (p.aegis && p.shieldUp) {
    p.shieldUp = false;
    p.invuln = 0.6;
    world.sound.shieldBreak();
    world.particles.ring(p.x, p.y, '#7fd4ff', 60);
    world.particles.floatText(p.x, p.y - 24, 'SHIELD BLOCKED', '#7fd4ff', 13);
    return false;
  }
  p.hull -= damage;
  p.invuln = PLAYER.invulnTime;
  world.sound.hurt();
  world.particles.addShake(0.45);
  world.particles.burst(p.x, p.y, '#ff5e6e', 14, 200);
  if (p.hull <= 0) {
    p.hull = 0;
    p.dead = true;
    world.sound.explode(true);
    world.particles.burst(p.x, p.y, '#5ef2e2', 40, 320, { life: 0.9, size: 4 });
    world.particles.burst(p.x, p.y, '#ffc94d', 24, 220, { life: 0.8, size: 3 });
    world.particles.ring(p.x, p.y, '#5ef2e2', 120);
    world.particles.addShake(1);
  }
  return true;
}

export function drawPlayer(ctx, p, time) {
  if (p.dead) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  // Mercy blink while invulnerable.
  if (p.invuln > 0 && Math.floor(time * 14) % 2 === 0) ctx.globalAlpha = 0.35;

  // Shield ring.
  if (p.aegis && p.shieldUp) {
    ctx.strokeStyle = 'rgba(127, 212, 255, 0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 7 + Math.sin(time * 3) * 1.5, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Thruster flame.
  if (p.thrust > 0.1) {
    const flick = 8 + Math.random() * 6;
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.moveTo(Math.cos(p.angle + Math.PI) * 12, Math.sin(p.angle + Math.PI) * 12);
    ctx.lineTo(Math.cos(p.angle + Math.PI) * (12 + flick) + Math.cos(p.angle + Math.PI / 2) * 4, Math.sin(p.angle + Math.PI) * (12 + flick) + Math.sin(p.angle + Math.PI / 2) * 4);
    ctx.lineTo(Math.cos(p.angle + Math.PI) * (12 + flick) - Math.cos(p.angle + Math.PI / 2) * 4, Math.sin(p.angle + Math.PI) * (12 + flick) - Math.sin(p.angle + Math.PI / 2) * 4);
    ctx.closePath();
    ctx.fill();
  }

  // Drone body: a swept dart with a glowing core.
  ctx.rotate(p.angle);
  ctx.shadowColor = '#5ef2e2';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#2dd4c4';
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-10, -10);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-10, 10);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#eafffb';
  ctx.beginPath();
  ctx.arc(2, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
