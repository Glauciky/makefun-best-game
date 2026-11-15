// All drawing: the space background, the entities, the HUD, and every screen
// (title, upgrade choice, pause, game over, victory). Drawing never mutates
// game state; it only reads the world.
import { WORLD_W, WORLD_H, PALETTE, TOTAL_WAVES } from './config.js';
import { makeRng } from './random.js';
import { drawPlayer } from './player.js';
import { drawEnemy } from './enemies.js';
import { drawPickups } from './pickups.js';
import { levelOf } from './upgrades.js';

// Pre-rendered nebula + star layers, built once from a fixed seed so the
// backdrop is the same every run.
let nebulaCanvas = null;
const starLayers = [];

function buildBackdrop() {
  if (nebulaCanvas) return;
  const rng = makeRng(1337);
  nebulaCanvas = document.createElement('canvas');
  nebulaCanvas.width = WORLD_W;
  nebulaCanvas.height = WORLD_H;
  const c = nebulaCanvas.getContext('2d');
  const grad = c.createLinearGradient(0, 0, 0, WORLD_H);
  grad.addColorStop(0, PALETTE.bgDeep);
  grad.addColorStop(0.55, PALETTE.bgMid);
  grad.addColorStop(1, PALETTE.bgDeep);
  c.fillStyle = grad;
  c.fillRect(0, 0, WORLD_W, WORLD_H);
  // Soft nebula blobs.
  const blobs = [
    { x: 180, y: 120, r: 220, color: PALETTE.nebulaA },
    { x: 780, y: 90, r: 190, color: PALETTE.nebulaB },
    { x: 700, y: 440, r: 230, color: PALETTE.nebulaC },
    { x: 160, y: 430, r: 170, color: PALETTE.nebulaB },
  ];
  for (const b of blobs) {
    const g = c.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
    g.addColorStop(0, b.color + 'cc');
    g.addColorStop(1, b.color + '00');
    c.fillStyle = g;
    c.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
  }
  // Three parallax star layers: far (dim, small), mid, near (bright).
  for (let layer = 0; layer < 3; layer++) {
    const stars = [];
    const count = [90, 55, 28][layer];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: rng.range(0, WORLD_W), y: rng.range(0, WORLD_H),
        r: [0.8, 1.3, 1.9][layer],
        a: [0.45, 0.65, 0.95][layer],
        tw: rng.range(0, Math.PI * 2),
      });
    }
    starLayers.push({ stars, parallax: [0.15, 0.35, 0.6][layer] });
  }
}

export function drawBackground(ctx, time, player) {
  buildBackdrop();
  ctx.drawImage(nebulaCanvas, 0, 0);
  const px = player ? player.x - WORLD_W / 2 : 0;
  const py = player ? player.y - WORLD_H / 2 : 0;
  for (const layer of starLayers) {
    for (const s of layer.stars) {
      const x = (((s.x - px * layer.parallax) % WORLD_W) + WORLD_W) % WORLD_W;
      const y = (((s.y - py * layer.parallax) % WORLD_H) + WORLD_H) % WORLD_H;
      ctx.globalAlpha = s.a * (0.75 + 0.25 * Math.sin(time * 1.7 + s.tw));
      ctx.fillStyle = '#dfe6ff';
      ctx.fillRect(x, y, s.r, s.r);
    }
  }
  ctx.globalAlpha = 1;
}

export function drawBullets(ctx, world) {
  for (const b of world.bullets) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(Math.atan2(b.vy, b.vx));
    ctx.shadowColor = '#ffe9a8';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(-7, -2, 14, 4);
    ctx.fillStyle = '#fff8dd';
    ctx.fillRect(-3, -1, 8, 2);
    ctx.restore();
  }
}

export function drawOrbs(ctx, world, time) {
  for (const o of world.orbs) {
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.shadowColor = '#e06bff';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#e06bff';
    ctx.beginPath();
    ctx.arc(0, 0, o.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#f6d8ff';
    ctx.beginPath();
    ctx.arc(0, 0, o.radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function drawEntities(ctx, world, time) {
  drawPickups(ctx, world, time);
  drawBullets(ctx, world);
  drawOrbs(ctx, world, time);
  for (const e of world.enemies) drawEnemy(ctx, e, time);
  drawPlayer(ctx, world.player, time);
  world.particles.draw(ctx);
}

function bar(ctx, x, y, w, h, frac, color, bg = 'rgba(0,0,0,0.55)') {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
}

export function drawHUD(ctx, world) {
  const p = world.player;
  ctx.textBaseline = 'alphabetic';
  // Score, top left.
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('SCORE', 16, 24);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '800 26px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(String(world.score).padStart(6, '0'), 16, 50);
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`BEST ${world.best}`, 16, 68);
  // Combo meter under the score.
  if (world.combo > 1) {
    const mult = world.multiplier().toFixed(1);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = '800 15px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`COMBO x${mult}`, 16, 92);
    bar(ctx, 16, 98, 110, 5, world.comboTimer / p.comboWindow, PALETTE.gold);
  }
  // Wave, top center.
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.font = '800 18px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`WAVE ${world.director.wave} / ${TOTAL_WAVES}`, WORLD_W / 2, 30);
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '600 12px "Segoe UI", system-ui, sans-serif';
  const left = world.director.queue.length + world.enemies.length;
  ctx.fillText(world.director.wave === TOTAL_WAVES ? 'THE VOID WARDEN' : `${left} WISPS LEFT`, WORLD_W / 2, 50);
  // Boss health bar.
  const warden = world.enemies.find((e) => e.type === 'warden');
  if (warden) {
    bar(ctx, WORLD_W / 2 - 130, 58, 260, 8, warden.hp / warden.maxHp, '#ff4d6d');
    ctx.fillStyle = '#ff8a9e';
    ctx.font = '700 11px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('VOID WARDEN', WORLD_W / 2, 80);
  }
  // Hull, top right.
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('HULL', WORLD_W - 16, 24);
  const hullFrac = p.hull / p.maxHull;
  bar(ctx, WORLD_W - 156, 32, 140, 12, hullFrac, hullFrac > 0.3 ? PALETTE.hull : PALETTE.hullLow);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '800 13px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`${Math.ceil(p.hull)} / ${p.maxHull}`, WORLD_W - 16, 58);
  if (p.aegis) {
    ctx.fillStyle = p.shieldUp ? '#7fd4ff' : 'rgba(127,212,255,0.35)';
    ctx.font = '700 12px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(p.shieldUp ? '◈ AEGIS READY' : '◈ AEGIS SPENT', WORLD_W - 16, 78);
  }
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '600 12px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`◆ ${world.shardsCollected} shards`, WORLD_W - 16, 96);
  // Controls hint, bottom center, faint.
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(154, 165, 214, 0.55)';
  ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('WASD / ARROWS move · MOUSE aim · HOLD CLICK fire · P pause · M mute', WORLD_W / 2, WORLD_H - 12);
}

export function drawBanner(ctx, world) {
  const b = world.banner;
  if (!b) return;
  const k = b.t / b.dur;
  const alpha = k < 0.15 ? k / 0.15 : k > 0.7 ? Math.max(0, (1 - k) / 0.3) : 1;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.font = '800 44px "Segoe UI", system-ui, sans-serif';
  ctx.shadowColor = '#5ef2e2';
  ctx.shadowBlur = 24;
  ctx.fillText(b.text, WORLD_W / 2, WORLD_H / 2 - 60);
  ctx.shadowBlur = 0;
  if (b.sub) {
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '600 15px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(b.sub, WORLD_W / 2, WORLD_H / 2 - 32);
  }
  ctx.restore();
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(10, 14, 34, 0.82)';
  ctx.strokeStyle = PALETTE.cardEdge;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 12);
  ctx.fill();
  ctx.stroke();
}

export function drawTitle(ctx, world, time) {
  // Dim the drifting demo behind the title.
  ctx.fillStyle = 'rgba(7, 10, 24, 0.45)';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = '700 15px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('— A WAVE SURVIVAL ARCADE —', WORLD_W / 2, 118);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '900 64px "Segoe UI", system-ui, sans-serif';
  ctx.shadowColor = '#5ef2e2';
  ctx.shadowBlur = 30;
  ctx.fillText('STARFALL', WORLD_W / 2, 182);
  ctx.fillText('SALVAGE', WORLD_W / 2, 246);
  ctx.shadowBlur = 0;
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '600 16px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('Pilot a salvage drone. Gather the fallen stars. Outfly the void.', WORLD_W / 2, 282);
  ctx.fillText('Survive all ten waves — and the Warden waiting at the end.', WORLD_W / 2, 306);

  panel(ctx, WORLD_W / 2 - 230, 330, 460, 96);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '700 14px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('WASD / ARROWS — move      MOUSE — aim', WORLD_W / 2, 358);
  ctx.fillText('HOLD CLICK / SPACE — fire      1 / 2 / 3 — pick upgrade', WORLD_W / 2, 382);
  ctx.fillText('P — pause      M — mute', WORLD_W / 2, 406);

  const pulse = 0.65 + 0.35 * Math.sin(time * 3);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = PALETTE.player;
  ctx.font = '800 20px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('CLICK OR PRESS ENTER TO START', WORLD_W / 2, 470);
  ctx.globalAlpha = 1;
  if (world.best > 0) {
    ctx.fillStyle = PALETTE.gold;
    ctx.font = '700 14px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`BEST SCORE  ${world.best}`, WORLD_W / 2, 500);
  }
}

export function drawUpgrade(ctx, world) {
  ctx.fillStyle = 'rgba(7, 10, 24, 0.55)';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.font = '800 30px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`WAVE ${world.director.wave} CLEARED`, WORLD_W / 2, 92);
  ctx.fillStyle = PALETTE.gold;
  ctx.font = '700 16px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`+${100 * world.director.wave} WAVE BONUS   ·   CHOOSE ONE UPGRADE`, WORLD_W / 2, 122);

  const cardW = 250;
  const cardH = 210;
  const gap = 24;
  const totalW = cardW * 3 + gap * 2;
  const startX = (WORLD_W - totalW) / 2;
  const y = 168;
  world.upgradeRects = [];
  world.choices.forEach((def, i) => {
    const x = startX + i * (cardW + gap);
    const hovered = world.hoverCard === i;
    ctx.save();
    if (hovered) ctx.translate(0, -6);
    ctx.fillStyle = hovered ? '#1a2350' : PALETTE.cardBg;
    ctx.strokeStyle = hovered ? PALETTE.gold : PALETTE.cardEdge;
    ctx.lineWidth = hovered ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = PALETTE.gold;
    ctx.font = '800 13px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`[ ${i + 1} ]`, x + cardW / 2, y + 34);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '800 19px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(def.name, x + cardW / 2, y + 68, cardW - 24);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '600 14px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(def.desc, x + cardW / 2, y + 98, cardW - 24);
    // Level pips: filled for the level this pick reaches.
    const lvl = levelOf(world.taken, def) + 1;
    for (let k = 0; k < def.max; k++) {
      ctx.fillStyle = k < lvl ? PALETTE.gold : 'rgba(154,165,214,0.3)';
      ctx.beginPath();
      ctx.arc(x + cardW / 2 + (k - (def.max - 1) / 2) * 22, y + 132, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '600 12px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`Level ${lvl} of ${def.max}`, x + cardW / 2, y + 162);
    ctx.restore();
    world.upgradeRects.push({ x, y, w: cardW, h: cardH });
  });
  ctx.fillStyle = 'rgba(154, 165, 214, 0.8)';
  ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('Click a card or press 1, 2 or 3', WORLD_W / 2, y + cardH + 44);
}

export function drawPause(ctx) {
  ctx.fillStyle = 'rgba(7, 10, 24, 0.6)';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.font = '800 40px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('PAUSED', WORLD_W / 2, WORLD_H / 2 - 10);
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '600 15px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('Press P or click to resume', WORLD_W / 2, WORLD_H / 2 + 24);
}

function statRows(ctx, world, rows, startY) {
  ctx.textAlign = 'left';
  rows.forEach(([label, value], i) => {
    const y = startY + i * 30;
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '600 15px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(label, WORLD_W / 2 - 150, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.text;
    ctx.font = '800 15px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(value, WORLD_W / 2 + 150, y);
    ctx.textAlign = 'left';
  });
}

export function drawGameOver(ctx, world, time) {
  ctx.fillStyle = 'rgba(7, 10, 24, 0.62)';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5e6e';
  ctx.font = '900 46px "Segoe UI", system-ui, sans-serif';
  ctx.shadowColor = '#ff5e6e';
  ctx.shadowBlur = 24;
  ctx.fillText('DRONE LOST', WORLD_W / 2, 120);
  ctx.shadowBlur = 0;
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '600 15px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`The void keeps your shards. The field resets — try again, salvage pilot.`, WORLD_W / 2, 150);
  panel(ctx, WORLD_W / 2 - 190, 178, 380, 190);
  statRows(ctx, world, [
    ['FINAL SCORE', String(world.score)],
    ['BEST SCORE', String(world.best)],
    ['WAVE REACHED', `${world.director.wave} / ${TOTAL_WAVES}`],
    ['SHARDS GATHERED', String(world.shardsCollected)],
    ['WISPS DESTROYED', String(world.kills)],
  ], 210);
  const pulse = 0.65 + 0.35 * Math.sin(time * 3);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = PALETTE.player;
  ctx.font = '800 19px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CLICK OR PRESS ENTER TO FLY AGAIN', WORLD_W / 2, 420);
  ctx.globalAlpha = 1;
}

export function drawVictory(ctx, world, time) {
  ctx.fillStyle = 'rgba(7, 10, 24, 0.55)';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = '900 46px "Segoe UI", system-ui, sans-serif';
  ctx.shadowColor = '#ffd166';
  ctx.shadowBlur = 26;
  ctx.fillText('SECTOR CLEARED', WORLD_W / 2, 120);
  ctx.shadowBlur = 0;
  ctx.fillStyle = PALETTE.text;
  ctx.font = '600 15px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('The Warden is scrap. Every shard in the field is yours, salvage pilot.', WORLD_W / 2, 150);
  panel(ctx, WORLD_W / 2 - 190, 178, 380, 220);
  statRows(ctx, world, [
    ['FINAL SCORE', String(world.score)],
    ['BEST SCORE', String(world.best)],
    ['WAVES CLEARED', `${TOTAL_WAVES} / ${TOTAL_WAVES}`],
    ['SHARDS GATHERED', String(world.shardsCollected)],
    ['WISPS DESTROYED', String(world.kills)],
    ['ACCURACY', `${world.accuracy()}%`],
  ], 210);
  const pulse = 0.65 + 0.35 * Math.sin(time * 3);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = PALETTE.player;
  ctx.font = '800 19px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CLICK OR PRESS ENTER TO FLY AGAIN', WORLD_W / 2, 448);
  ctx.globalAlpha = 1;
}
