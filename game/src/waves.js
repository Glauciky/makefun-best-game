// The wave director: starts waves, spawns their groups on schedule, and knows
// when a wave is cleared. Waves are defined in config.js (WAVES).
import { WAVES, TOTAL_WAVES } from './config.js';
import { spawnAtEdge } from './enemies.js';

export class WaveDirector {
  constructor() {
    this.wave = 0; // 1-based while a wave runs
    this.time = 0; // seconds into the current wave
    this.queue = []; // pending spawns: {at, type}
    this.active = false;
  }

  startWave(n, world) {
    this.wave = n;
    this.time = 0;
    this.active = true;
    this.queue = [];
    const def = WAVES[n - 1];
    for (const g of def.groups) {
      for (let k = 0; k < g.count; k++) {
        this.queue.push({ at: g.delay + k * g.gap, type: g.type });
      }
    }
    this.queue.sort((a, b) => a.at - b.at);
    world.banner = {
      text: n === TOTAL_WAVES ? 'THE VOID WARDEN' : `WAVE ${n}`,
      sub: n === TOTAL_WAVES ? 'Defeat the Warden to clear the sector' : n === 1 ? 'Collect shards. Dodge the wisps.' : '',
      t: 0, dur: 2.2,
    };
    if (n === TOTAL_WAVES) world.sound.bossWarn();
    else world.sound.waveHorn();
    // A fresh shield every wave.
    if (world.player.aegis) world.player.shieldUp = true;
  }

  update(dt, world) {
    if (!this.active) return;
    this.time += dt;
    while (this.queue.length > 0 && this.queue[0].at <= this.time) {
      const spawn = this.queue.shift();
      world.enemies.push(spawnAtEdge(spawn.type, world.player));
    }
  }

  isClear(world) {
    return this.active && this.queue.length === 0 && world.enemies.length === 0;
  }

  stop() { this.active = false; }
}
