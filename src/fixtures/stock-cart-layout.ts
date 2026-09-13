import { validateLayout, type Footprint } from '../layout-validator.ts';
import type { FixturePlacement } from '../store-layout.ts';

export function shuffledStock<T extends { id: string; discovery?: boolean; collectionGap?: boolean; comingSoon?: boolean }>(items: T[], count: number, random = Math.random): T[] {
  const pool = [...new Map(items.filter(m => !m.discovery && !m.collectionGap && !m.comingSoon).map(m => [m.id, m])).values()];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, count);
}
export function placeStockCart(obstacles: Footprint[], bounds: { minX: number; maxX: number; minZ: number; maxZ: number }, random = Math.random): FixturePlacement | null {
  const candidates: FixturePlacement[] = [];
  for (let z = bounds.minZ + 4; z < bounds.maxZ - 3; z += 1.5) for (let x = bounds.minX + 4; x < bounds.maxX - 3; x += 1.5) {
    for (const yaw of [0, Math.PI / 2]) candidates.push({ id: 'release-cart-checkout', kind: 'release-cart', position: { x, z }, yaw, options: { noRentalCase: true } });
  }
  while (candidates.length) {
    const index = Math.floor(random() * candidates.length), [p] = candidates.splice(index, 1);
    const cart: Footprint = { label: 'candidate-stock-cart', kind: 'fixture', cx: p.position.x + .2 * Math.cos(p.yaw), cz: p.position.z - .2 * Math.sin(p.yaw), w: 3.8, d: 1.9, yaw: p.yaw, clearance: 3 };
    if (!validateLayout([cart], bounds).length && obstacles.every(o => !validateLayout([cart, o], bounds).some(v => v.a === cart.label || v.b === cart.label))) return p;
  }
  return null;
}
