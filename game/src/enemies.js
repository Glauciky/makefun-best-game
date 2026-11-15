// Void wisps: the enemies. Five kinds, each with its own movement and attack,
// plus the Void Warden boss on wave 10. Enemies are plain objects; this module
// spawns them, updates them and draws them.
import { ENEMY, ORB, WORLD_W, WORLD_H } from './config.js';
import { rng } from './random.js';

export function spawnEnemy(type, x, y) {
  const def = ENEMY[type];
  return {
    type,
    x, y,
    vx: 0, vy: 0,
    hp: def.hp, maxHp: def.hp,
    radius: def.radius,
    speed: def.speed,
    touch: def.touch,
    score: def.score,
    shards: def.shards,
    angle: rng.angle(),
    state: 'stalk', // dart only: stalk -> aim -> lunge -> rest
    stateT: 0,
    fireT: 1.5 + rng.next() * 1.5, // spitter / warden
    burstT: 2.5, // warden radial
    summonT: 5, // warden summons
    flash: 0, // hit flash timer
    wobble: rng.next() * Math.PI * 2,
  };
}

export function spawnAtEdge(type, player) {
  // Pick an edge point at least 260px from the player so nothing spawns on top.
  for (let tries = 0; tries < 12; tries++) {
    const side = Math.floor(rng.next() * 4);
    let x;
    let y;
    if (side === 0) { x = rng.range(30, WORLD_W - 30); y = 24; }
    else if (side === 1) { x = rng.range(30, WORLD_W - 30); y = WORLD_H - 24; }
    else if (side === 2) { x = 24; y = rng.range(30, WORLD_H - 30); }
    else { x = WORLD_W - 24; y = rng.range(30, WORLD_H - 30); }
    if (Math.hypot(x - player.x, y - player.y) > 260) return spawnEnemy(type, x, y);
  }
  return spawnEnemy(type, 40, 40);
}

function seek(e, tx, ty, dt, speed) {
  const dx = tx - e.x;
  const dy = ty - e.y;
  const d = Math.hypot(dx, dy) || 1;
  e.vx += (dx / d) * speed * 3 * dt;
  e.vy += (dy / d) * speed * 3 * dt;
  const s = Math.hypot(e.vx, e.vy);
  const cap = speed * 1.4;
  if (s > cap) { e.vx = (e.vx / s) * cap; e.vy = (e.vy / s) * cap; }
  e.x += e.vx * dt;
  e.y += e.vy * dt;
}

export function updateEnemies(world, dt) {
  const p = world.player;
  for (let i = world.enemies.length - 1; i >= 0; i--) {
    const e = world.enemies[i];
    e.flash = Math.max(0, e.flash - dt);
    e.wobble += dt * 2;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    e.angle = Math.atan2(dy, dx);

    if (e.type === 'drifter') {
      seek(e, p.x, p.y, dt, e.speed);
    } else if (e.type === 'dart') {
      e.stateT -= dt;
      if (e.state === 'stalk') {
        seek(e, p.x, p.y, dt, e.speed);
        if (dist < 200) { e.state = 'aim'; e.stateT = 0.55; e.vx *= 0.2; e.vy *= 0.2; }
      } else if (e.state === 'aim') {
        e.vx *= 0.9; e.vy *= 0.9;
        e.x += e.vx * dt; e.y += e.vy * dt;
        if (e.stateT <= 0) {
          e.state = 'lunge'; e.stateT = 0.32;
          e.vx = (dx / dist) * 430; e.vy = (dy / dist) * 430;
        }
      } else if (e.state === 'lunge') {
        e.x += e.vx * dt; e.y += e.vy * dt;
        if (e.stateT <= 0) { e.state = 'rest'; e.stateT = 0.7; }
      } else {
        e.vx *= 0.92; e.vy *= 0.92;
        e.x += e.vx * dt; e.y += e.vy * dt;
        if (e.stateT <= 0) e.state = 'stalk';
      }
    } else if (e.type === 'spitter') {
      // Keep a firing band around the player.
      const want = dist < 240 ? -1 : dist > 330 ? 1 : 0;
      seek(e, p.x + (dx / dist) * -want * 60, p.y + (dy / dist) * -want * 60, dt, e.speed);
      e.fireT -= dt;
      if (e.fireT <= 0 && dist < 420) {
        e.fireT = 2.3;
        world.orbs.push({
          x: e.x, y: e.y,
          vx: (dx / dist) * ORB.speed, vy: (dy / dist) * ORB.speed,
          radius: ORB.radius, damage: ORB.damage, life: 5,
        });
        world.particles.spawn(e.x, e.y, { vx: 0, vy: 0, life: 0.2, size: 8, color: '#e06bff', glow: true });
      }
    } else if (e.type === 'brute') {
      seek(e, p.x, p.y, dt, e.speed);
    } else if (e.type === 'warden') {
      seek(e, p.x, p.y, dt, e.speed);
      e.fireT -= dt;
      if (e.fireT <= 0 && dist < 460) {
        e.fireT = 1.7;
        for (const off of [-0.22, 0, 0.22]) {
          const a = Math.atan2(dy, dx) + off;
          world.orbs.push({
            x: e.x + Math.cos(a) * 40, y: e.y + Math.sin(a) * 40,
            vx: Math.cos(a) * (ORB.speed + 30), vy: Math.sin(a) * (ORB.speed + 30),
            radius: ORB.radius, damage: ORB.damage, life: 6,
          });
        }
      }
      e.burstT -= dt;
      if (e.burstT <= 0) {
        e.burstT = 3.4;
        world.sound.bossWarn();
        for (let k = 0; k < 14; k++) {
          const a = (k / 14) * Math.PI * 2 + e.wobble;
          world.orbs.push({
            x: e.x + Math.cos(a) * 44, y: e.y + Math.sin(a) * 44,
            vx: Math.cos(a) * 130, vy: Math.sin(a) * 130,
            radius: ORB.radius, damage: ORB.damage, life: 7,
          });
        }
        world.particles.ring(e.x, e.y, '#ff4d6d', 130);
      }
      e.summonT -= dt;
      if (e.summonT <= 0 && world.enemies.length < 22) {
        e.summonT = 6.5;
        for (let k = 0; k < 3; k++) {
          world.enemies.push(spawnEnemy('drifter', e.x + (rng.next() - 0.5) * 90, e.y + (rng.next() - 0.5) * 90));
        }
        world.particles.burst(e.x, e.y, '#c86bff', 16, 160);
      }
    }

    // Keep inside the arena.
    e.x = Math.max(e.radius, Math.min(WORLD_W - e.radius, e.x));
    e.y = Math.max(e.radius, Math.min(WORLD_H - e.radius, e.y));
  }
}

export function killEnemy(world, index, awardScore = true) {
  const e = world.enemies[index];
  world.enemies.splice(index, 1);
  const color = { drifter: '#c86bff', dart: '#ff5e8a', spitter: '#b78bff', brute: '#ff8a5e', warden: '#ff4d6d' }[e.type];
  world.sound.explode(e.type === 'brute' || e.type === 'warden');
  world.particles.burst(e.x, e.y, color, e.type === 'warden' ? 60 : e.type === 'brute' ? 30 : 14, e.type === 'warden' ? 340 : 220);
  world.particles.ring(e.x, e.y, color, e.type === 'warden' ? 160 : 60);
  world.particles.addShake(e.type === 'warden' ? 0.7 : e.type === 'brute' ? 0.4 : 0.15);
  // Shards scatter out.
  for (let k = 0; k < e.shards; k++) {
    const a = rng.angle();
    world.shards.push({
      x: e.x + Math.cos(a) * 10, y: e.y + Math.sin(a) * 10,
      vx: Math.cos(a) * rng.range(40, 130), vy: Math.sin(a) * rng.range(40, 130),
      value: 1, life: 12, spin: rng.range(0, Math.PI * 2),
    });
  }
  if (e.type === 'brute') {
    // A brute splits into two drifters.
    for (let k = 0; k < 2; k++) {
      world.enemies.push(spawnEnemy('drifter', e.x + (rng.next() - 0.5) * 40, e.y + (rng.next() - 0.5) * 40));
    }
  }
  if (awardScore) {
    world.kills += 1;
    world.addScore(e.score, e.x, e.y);
    world.bumpCombo();
  }
  return e;
}

export function drawEnemy(ctx, e, time) {
  ctx.save();
  ctx.translate(e.x, e.y);
  const flash = e.flash > 0;
  if (e.type === 'drifter') {
    // Spiky void mote.
    ctx.rotate(e.wobble * 0.4);
    ctx.fillStyle = flash ? '#ffffff' : '#a55eea';
    ctx.shadowColor = '#c86bff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const r = k % 2 === 0 ? e.radius + 5 : e.radius - 3;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#2a0a44';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.type === 'dart') {
    // Needle that telegraphs its lunge.
    ctx.rotate(e.angle);
    const aiming = e.state === 'aim';
    ctx.fillStyle = flash ? '#ffffff' : aiming ? '#ff2e63' : '#ff5e8a';
    ctx.shadowColor = '#ff5e8a';
    ctx.shadowBlur = aiming ? 16 : 8;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, -7);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-10, 7);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    if (aiming) {
      ctx.strokeStyle = 'rgba(255, 94, 138, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(70, 0);
      ctx.stroke();
    }
  } else if (e.type === 'spitter') {
    // Hexagon with a pulsing core.
    ctx.rotate(Math.sin(time * 1.5 + e.wobble) * 0.2);
    ctx.fillStyle = flash ? '#ffffff' : '#7b5cff';
    ctx.shadowColor = '#b78bff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      ctx.lineTo(Math.cos(a) * e.radius, Math.sin(a) * e.radius);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#e06bff';
    ctx.beginPath();
    ctx.arc(0, 0, 5 + Math.sin(time * 6) * 1.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.type === 'brute') {
    // Cracked rock with a hot heart.
    ctx.rotate(Math.sin(time * 0.8 + e.wobble) * 0.08);
    ctx.fillStyle = flash ? '#ffffff' : '#c65a3a';
    ctx.shadowColor = '#ff8a5e';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      const r = e.radius * (0.85 + 0.15 * Math.sin(k * 2.7));
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-12, -6); ctx.lineTo(-2, 2); ctx.lineTo(8, -8); ctx.lineTo(14, 4);
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.type === 'warden') {
    // The Void Warden: a broken ring with rotating shards.
    ctx.rotate(time * 0.4);
    ctx.strokeStyle = flash ? '#ffffff' : '#ff4d6d';
    ctx.lineWidth = 7;
    ctx.shadowColor = '#ff4d6d';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(0, 0, e.radius - 6, 0.4, Math.PI * 2 - 0.4);
    ctx.stroke();
    ctx.shadowBlur = 0;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      ctx.fillStyle = '#ff8a9e';
      ctx.beginPath();
      ctx.arc(Math.cos(a) * (e.radius - 6), Math.sin(a) * (e.radius - 6), 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.rotate(-time * 0.4);
    ctx.fillStyle = flash ? '#ffffff' : '#2a0a1e';
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff4d6d';
    ctx.beginPath();
    ctx.arc(0, 0, 8 + Math.sin(time * 5) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Health bar for anything tougher than one hit.
  if (e.maxHp > 1 && e.hp < e.maxHp) {
    const w = e.radius * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 10, w, 4);
    ctx.fillStyle = '#ff5e6e';
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 10, w * (e.hp / e.maxHp), 4);
  }
}
