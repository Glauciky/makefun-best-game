// Starfall Salvage — tuning and shared constants. Every number that shapes how
// the game feels lives here, so balance changes are one edit, not a hunt.
export const WORLD_W = 960;
export const WORLD_H = 540;

export const PALETTE = {
  bgDeep: '#070a18',
  bgMid: '#0d1330',
  nebulaA: '#1b2a6b',
  nebulaB: '#3b1d5e',
  nebulaC: '#0e3a4d',
  player: '#5ef2e2',
  playerCore: '#eafffb',
  bullet: '#ffe9a8',
  shard: '#ffc94d',
  shardCore: '#fff3c4',
  drifter: '#c86bff',
  dart: '#ff5e8a',
  spitter: '#b78bff',
  brute: '#ff8a5e',
  warden: '#ff4d6d',
  orb: '#e06bff',
  hull: '#5ef2e2',
  hullLow: '#ff5e6e',
  text: '#e8ecff',
  textDim: '#9aa5d6',
  cardBg: '#141b3d',
  cardEdge: '#3d4f9e',
  gold: '#ffd166',
};

export const PLAYER = {
  radius: 14,
  accel: 1900,
  maxSpeed: 275,
  drag: 3.2,
  hull: 100,
  fireRate: 4.6, // shots per second
  bulletSpeed: 560,
  bulletDamage: 1,
  bulletRadius: 4,
  magnetRadius: 80,
  collectRadius: 24,
  invulnTime: 0.9, // seconds of mercy after a hit
};

export const COMBO = {
  window: 3.0, // seconds before the combo starts falling
  perStep: 0.05, // multiplier gained per combo point
  maxMult: 4,
};

export const SHARD_VALUE = 10;

export const ENEMY = {
  drifter: { radius: 14, hp: 1, speed: 72, touch: 10, score: 25, shards: 1 },
  dart: { radius: 12, hp: 1, speed: 62, touch: 12, score: 40, shards: 1 },
  spitter: { radius: 16, hp: 3, speed: 52, touch: 12, score: 60, shards: 2 },
  brute: { radius: 30, hp: 10, speed: 38, touch: 20, score: 150, shards: 6 },
  warden: { radius: 46, hp: 95, speed: 30, touch: 25, score: 1000, shards: 20 },
};

export const ORB = { radius: 6, speed: 175, damage: 8 };

// Waves: each entry spawns its groups in order; a group is {type, count, gap,
// delay} where gap is the seconds between spawns in the group and delay the
// seconds before the group starts. Wave 10 is the Void Warden.
export const WAVES = [
  { groups: [{ type: 'drifter', count: 8, gap: 0.9, delay: 0.5 }] },
  { groups: [{ type: 'drifter', count: 10, gap: 0.8, delay: 0.5 }, { type: 'dart', count: 3, gap: 1.4, delay: 4 }] },
  { groups: [{ type: 'drifter', count: 8, gap: 0.7, delay: 0.5 }, { type: 'dart', count: 4, gap: 1.2, delay: 3 }, { type: 'spitter', count: 2, gap: 2.0, delay: 7 }] },
  { groups: [{ type: 'drifter', count: 10, gap: 0.6, delay: 0.5 }, { type: 'dart', count: 4, gap: 1.1, delay: 3 }, { type: 'spitter', count: 3, gap: 1.8, delay: 6 }, { type: 'brute', count: 1, gap: 1, delay: 10 }] },
  { groups: [{ type: 'drifter', count: 12, gap: 0.6, delay: 0.5 }, { type: 'dart', count: 5, gap: 1.0, delay: 3 }, { type: 'spitter', count: 3, gap: 1.7, delay: 6 }, { type: 'brute', count: 2, gap: 3.0, delay: 9 }] },
  { groups: [{ type: 'drifter', count: 12, gap: 0.55, delay: 0.5 }, { type: 'dart', count: 6, gap: 1.0, delay: 3 }, { type: 'spitter', count: 4, gap: 1.6, delay: 6 }, { type: 'brute', count: 2, gap: 3.0, delay: 9 }] },
  { groups: [{ type: 'drifter', count: 14, gap: 0.5, delay: 0.5 }, { type: 'dart', count: 7, gap: 0.9, delay: 3 }, { type: 'spitter', count: 5, gap: 1.5, delay: 6 }, { type: 'brute', count: 3, gap: 2.5, delay: 9 }] },
  { groups: [{ type: 'drifter', count: 14, gap: 0.5, delay: 0.5 }, { type: 'dart', count: 8, gap: 0.9, delay: 3 }, { type: 'spitter', count: 6, gap: 1.4, delay: 6 }, { type: 'brute', count: 3, gap: 2.5, delay: 9 }] },
  { groups: [{ type: 'drifter', count: 16, gap: 0.45, delay: 0.5 }, { type: 'dart', count: 8, gap: 0.85, delay: 3 }, { type: 'spitter', count: 6, gap: 1.4, delay: 6 }, { type: 'brute', count: 4, gap: 2.2, delay: 9 }] },
  { groups: [{ type: 'warden', count: 1, gap: 1, delay: 1.0 }, { type: 'drifter', count: 6, gap: 2.0, delay: 12 }, { type: 'dart', count: 4, gap: 2.0, delay: 18 }] },
];

export const TOTAL_WAVES = WAVES.length;

// Upgrade definitions. Each has an id, a name, a one-line description, a max
// stack count, and an apply() that mutates the player's stats. The upgrade
// screen rolls three different ones the player has not maxed out.
export const UPGRADES = [
  { id: 'rapid', name: 'Rapid Coils', desc: '+20% fire rate', max: 3, apply: (s) => { s.fireRate *= 1.2; } },
  { id: 'twin', name: 'Twin Barrels', desc: '+1 projectile per shot', max: 2, apply: (s) => { s.projectiles += 1; } },
  { id: 'heavy', name: 'Heavy Rounds', desc: '+1 bullet damage', max: 3, apply: (s) => { s.bulletDamage += 1; } },
  { id: 'magnet', name: 'Magnet Array', desc: '+70% shard pickup radius', max: 3, apply: (s) => { s.magnetRadius *= 1.7; } },
  { id: 'thrusters', name: 'Ion Thrusters', desc: '+15% move speed', max: 3, apply: (s) => { s.maxSpeed *= 1.15; } },
  { id: 'plating', name: 'Hull Plating', desc: '+30 max hull, repair 30', max: 3, apply: (s) => { s.maxHull += 30; s.hull = Math.min(s.maxHull, s.hull + 30); } },
  { id: 'doubler', name: 'Shard Doubler', desc: 'Shards are worth double', max: 2, apply: (s) => { s.shardValue *= 2; } },
  { id: 'aegis', name: 'Aegis Shield', desc: 'Block one hit every wave', max: 1, apply: (s) => { s.aegis = true; } },
  { id: 'keeper', name: 'Combo Keeper', desc: 'Combo lasts +1.5s longer', max: 2, apply: (s) => { s.comboWindow += 1.5; } },
  { id: 'nanobots', name: 'Repair Nanobots', desc: 'Regenerate 1.5 hull / sec', max: 2, apply: (s) => { s.regen += 1.5; } },
];
