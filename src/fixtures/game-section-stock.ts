// Physical game shelf copies retain the catalog object and its identity.
// The caller supplies platforms in department order and each catalog best-first.
import type { Movie } from '../jellyfin.ts';

export interface GameShelfEntry { movie: Movie; displayCopy: boolean }
export interface GameShelfBay { platform: string; entries: GameShelfEntry[] }

export function gameShelfBays(platforms: { platform: string; games: Movie[] }[], capacity: number): GameShelfBay[] {
  if (!Number.isInteger(capacity) || capacity < 1) throw new Error('Invalid game bay capacity');
  const catalogs = platforms.map(({ platform, games }) => {
    const seen = new Set<string>();
    return { platform, games: games.filter(movie => !seen.has(movie.id) && !!seen.add(movie.id)) };
  });
  const rounds = Math.max(0, ...catalogs.map(({ games }) => Math.ceil(games.length / capacity)));
  const bays: GameShelfBay[] = [];
  for (let round = 0; round < rounds; round++) for (const { platform, games } of catalogs) {
    const titles = games.slice(round * capacity, (round + 1) * capacity);
    if (!titles.length) continue;
    bays.push({ platform, entries: Array.from({ length: capacity }, (_, i) => ({
      movie: titles[i % titles.length], displayCopy: i >= titles.length,
    })) });
  }
  return bays;
}

/** Fill unused physical bays only after every available distinct-title bay.
 * Repeated bays are display copies, never additional inventory/catalog items.
 */
export function fillGameShelfBays(bays: GameShelfBay[], count: number): GameShelfBay[] {
  if (!bays.length) return [];
  return Array.from({ length: count }, (_, i) => {
    const bay = bays[i % bays.length];
    return i < bays.length ? bay : { platform: bay.platform,
      entries: bay.entries.map(entry => ({ movie: entry.movie, displayCopy: true })) };
  });
}
