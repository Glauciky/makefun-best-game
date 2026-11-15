// Between-wave upgrades: roll three choices the player has not maxed out, and
// apply the one they pick. Taken counts live on the world so the cards can show
// the new level (Lv 1/3, ...).
import { UPGRADES } from './config.js';
import { rng } from './random.js';

export function rollUpgrades(taken) {
  const available = UPGRADES.filter((u) => (taken[u.id] || 0) < u.max);
  // Shuffle a copy and take three (fewer if the pool is nearly maxed).
  const shuffled = available.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, 3);
}

export function applyUpgrade(player, def, taken) {
  def.apply(player);
  taken[def.id] = (taken[def.id] || 0) + 1;
  return taken[def.id];
}

export function levelOf(taken, def) {
  return taken[def.id] || 0;
}
