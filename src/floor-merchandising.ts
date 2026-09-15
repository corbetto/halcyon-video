import { buildPromoCampaign } from './promo-campaigns.ts';
import { validateLayout, type Footprint } from './layout-validator.ts';
import type { FixturePlacement } from './store-layout.ts';
import type { Library } from './providers/media-source-provider.ts';

export const FLOOR_PROMOTION_TARGET = 10;
type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number };

/** Populate available floor pockets with stocked, walk-around promotions.
 * The existing layout validator owns separation, including rotated shelves.
 * Ten is a furnished-store target, never permission to obstruct a small shop.
 * Back/side wall browsing and the front checkout passage remain reserved.
 */
export function floorPromotionPlacements(libraries: Library[], obstacles: Footprint[], bounds: Bounds,
  existing = 0): FixturePlacement[] {
  const needed = Math.max(0, FLOOR_PROMOTION_TARGET - existing);
  if (!needed || !libraries.some(l => l.movies.length)) return [];
  const chains: string[][] = [];
  for (let n = 0; n < FLOOR_PROMOTION_TARGET; n++) {
    chains.push([`actor-spotlight:${n}`], [`studio-feature:${n}`], [`feature-title:${n}`]);
  }
  const campaigns = chains.filter(chain => buildPromoCampaign(chain, libraries, 3, 3));
  if (!campaigns.length) return [];
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const candidates: Footprint[] = [];
  // Four-sided stock uses the existing 3 x 3 ft display, with a 3 ft
  // walk-around gap. Extra setback preserves wall-stock camera approaches.
  for (let z = bounds.minZ + 8; z <= Math.min(-9, bounds.maxZ - 24); z += 1.5) {
    for (let x = bounds.minX + 6; x <= bounds.maxX - 6; x += 1.5) {
      const fp: Footprint = { label: 'floor-promotion-candidate', kind: 'fixture',
        cx: x, cz: z, w: 3, d: 3, yaw: 0, clearance: 3 };
      if (!validateLayout([fp], bounds).length && obstacles.every(o =>
        !validateLayout([fp, o], bounds).some(v => v.a === fp.label || v.b === fp.label))) candidates.push(fp);
    }
  }
  // Start near the centre of the open sales floor, then distribute subsequent
  // fixtures by their distance from already occupied display pockets.
  const placed: Footprint[] = obstacles.filter(o => o.kind === 'fixture' && o.clearance);
  const result: FixturePlacement[] = [];
  while (candidates.length && result.length < Math.min(needed, campaigns.length)) {
    const score = (p: Footprint) => placed.length
      ? Math.min(...placed.map(o => Math.hypot(p.cx - o.cx, p.cz - o.cz)))
      : -Math.hypot(p.cx - centerX, p.cz - (bounds.minZ - 9) / 2);
    candidates.sort((a, b) => score(b) - score(a) || b.cz - a.cz || a.cx - b.cx);
    const chosen = candidates.shift()!;
    const campaignsForStand = campaigns[result.length];
    const id = `floor-promotion-${campaignsForStand[0].replace(':', '-')}`;
    chosen.label = `fixture:${id}`;
    result.push({ id, kind: 'four-sided-display', position: { x: chosen.cx, z: chosen.cz }, yaw: 0,
      options: { campaigns: campaignsForStand } });
    placed.push(chosen);
    for (let i = candidates.length - 1; i >= 0; i--) {
      if (validateLayout([chosen, candidates[i]], bounds).length) candidates.splice(i, 1);
    }
  }
  return result;
}
