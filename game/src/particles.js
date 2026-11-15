// Particles, floating score text, shockwave rings and screen shake. One fixed
// pool keeps allocations out of the hot loop; dead particles are recycled.
const MAX_PARTICLES = 700;

export class Particles {
  constructor() {
    this.pool = [];
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.pool.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff', drag: 0, glow: false });
    }
    this.texts = [];
    this.rings = [];
    this.trauma = 0; // 0..1, screen shake strength
  }

  spawn(x, y, { vx = 0, vy = 0, life = 0.5, size = 2, color = '#ffffff', drag = 2, glow = false } = {}) {
    for (const p of this.pool) {
      if (p.alive) continue;
      p.alive = true;
      p.x = x; p.y = y; p.vx = vx; p.vy = vy;
      p.life = life; p.maxLife = life; p.size = size;
      p.color = color; p.drag = drag; p.glow = glow;
      return;
    }
  }

  burst(x, y, color, count, speed, { life = 0.6, size = 3, glow = true } = {}) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.spawn(x, y, {
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: life * (0.6 + Math.random() * 0.8),
        size: size * (0.6 + Math.random() * 0.8),
        color, drag: 2.5, glow,
      });
    }
  }

  trail(x, y, color) {
    this.spawn(x, y, {
      vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30,
      life: 0.35, size: 2.5, color, drag: 1, glow: true,
    });
  }

  floatText(x, y, text, color = '#ffffff', size = 14) {
    this.texts.push({ x, y, text, color, size, life: 0.9, maxLife: 0.9 });
  }

  ring(x, y, color, maxRadius = 70) {
    this.rings.push({ x, y, color, radius: 6, maxRadius, life: 0.4, maxLife: 0.4 });
  }

  addShake(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  shakeOffset(time) {
    // Deterministic-ish wobble from the clock; the game loop passes its time.
    const s = this.trauma * this.trauma * 14;
    return {
      x: s * (Math.sin(time * 91.7) * 0.6 + Math.sin(time * 47.3) * 0.4),
      y: s * (Math.cos(time * 83.1) * 0.6 + Math.cos(time * 53.9) * 0.4),
    };
  }

  update(dt) {
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; continue; }
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d;
      p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      t.y -= 34 * dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      const k = 1 - Math.max(0, r.life / r.maxLife);
      r.radius = 6 + (r.maxRadius - 6) * k;
      if (r.life <= 0) this.rings.splice(i, 1);
    }
  }

  draw(ctx) {
    for (const p of this.pool) {
      if (!p.alive) continue;
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.glow) {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
      }
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
    for (const r of this.rings) {
      const a = Math.max(0, r.life / r.maxLife);
      ctx.globalAlpha = a * 0.8;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const t of this.texts) {
      const a = Math.max(0, t.life / t.maxLife);
      ctx.globalAlpha = a;
      ctx.font = `700 ${t.size}px "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}
