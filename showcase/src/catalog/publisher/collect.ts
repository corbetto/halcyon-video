import { z } from 'zod';
import { snapshotSchema, titleKey, type CatalogTitle, type Snapshot } from '../schema.ts';
import { services, matchingProviderIds } from '../services.ts';
import type { CatalogRequest } from './http.ts';

const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const provider = z.object({ provider_id: id, provider_name: z.string().min(1) });
const providerList = z.object({ results: z.array(provider).max(2000) });
const discovery = z.object({ page: id, total_pages: z.number().int().nonnegative(), results: z.array(z.object({ id, adult: z.boolean().optional() })).max(20) });
const detail = z.object({
  id, adult: z.boolean(), title: z.string().optional(), name: z.string().optional(),
  overview: z.string().nullable().optional(), release_date: z.string().optional(), first_air_date: z.string().optional(),
  genres: z.array(z.object({ name: z.string() })).default([]), poster_path: z.string().nullable().optional(),
  runtime: z.number().nullable().optional(), episode_run_time: z.array(z.number()).optional(),
  number_of_seasons: z.number().optional(), number_of_episodes: z.number().optional(),
  vote_average: z.number().optional(), vote_count: z.number().optional(),
});
const regionOffers = z.object({ link: z.string(), flatrate: z.array(provider).optional(), rent: z.array(provider).optional(), buy: z.array(provider).optional() });
const availability = z.object({ id, results: z.record(z.string(), z.unknown()) });
const positive = (value: number | undefined | null) => Number.isInteger(value) && value! > 0 ? value! : null;
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error('Invalid upstream catalog shape');
  return result.data;
}

/** Curated US subscription sample, never an exhaustive service inventory.
 * Any failed request rejects the whole candidate; callers retain the last good.
 * A supplied request adapter makes every upstream edge independently testable.
 */
export async function collectCatalog(request: CatalogRequest, snapshotVersion: string, now = Date.now): Promise<Snapshot> {
  const coverage: Snapshot['coverage'] = [];
  const seeds = new Map<string, { mediaType: 'movie' | 'tv'; tmdbId: number }>();
  for (const mediaType of ['movie', 'tv'] as const) {
    const response = await request(`/watch/providers/${mediaType}`, { watch_region: 'US', language: 'en-US' });
    const providers = parse(providerList, response.data).results.map(p => ({ id: p.provider_id, name: p.provider_name }));
    for (const service of services) {
      const providerIds = matchingProviderIds(service.id, providers);
      const row = { serviceId: service.id, mediaType, providerIds, limitation: providerIds.length ? null : 'No matching regional provider ID was supplied.' };
      coverage.push(row);
      if (!providerIds.length) continue;
      const seen = new Set<number>();
      for (let page = 1; page <= 6 && seen.size < 120; page++) {
        const response = await request(`/discover/${mediaType}`, {
          watch_region: 'US', with_watch_providers: providerIds.join('|'), with_watch_monetization_types: 'flatrate',
          include_adult: 'false', sort_by: 'popularity.desc', language: 'en-US', page: String(page),
        });
        const data = parse(discovery, response.data);
        if (data.page !== page) throw new Error('Unexpected upstream discovery page');
        for (const title of data.results) {
          if (title.adult === true || seen.size >= 120) continue;
          seen.add(title.id);
          const seed = { mediaType, tmdbId: title.id };
          seeds.set(titleKey(seed), seed);
        }
        if (page >= data.total_pages || !data.results.length) break;
      }
    }
  }
  const titles: CatalogTitle[] = [];
  // Four workers bound pending promises as well as HTTP concurrency.
  const pending = [...seeds.values()];
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(4, pending.length) }, async () => {
    while (index < pending.length) {
      const seed = pending[index++];
      const response = await request(`/${seed.mediaType}/${seed.tmdbId}`, { language: 'en-US' });
      const data = parse(detail, response.data);
      if (data.id !== seed.tmdbId) throw new Error('Upstream detail identity mismatch');
      if (data.adult) continue;
      const checked = await request(`/${seed.mediaType}/${seed.tmdbId}/watch/providers`);
      const found = parse(availability, checked.data);
      if (found.id !== seed.tmdbId) throw new Error('Upstream availability identity mismatch');
      // An absent region is a truthful withdrawal, not fallback to another country.
      if (!found.results.US) continue;
      const regional = parse(regionOffers, found.results.US);
      const offers: CatalogTitle['offers'] = [];
      for (const [upstreamType, type] of [['flatrate', 'subscription'], ['rent', 'rent'], ['buy', 'buy']] as const) {
        for (const p of regional[upstreamType] ?? []) {
          for (const row of coverage.filter(row => row.mediaType === seed.mediaType && row.providerIds.includes(p.provider_id))) {
            if (offers.some(o => o.providerId === p.provider_id && o.type === type && o.serviceId === row.serviceId)) continue;
            offers.push({ region: 'US', serviceId: row.serviceId, providerId: p.provider_id, type, checkedAt: checked.checkedAt, provenance: 'tmdb-justwatch', link: { kind: 'tmdb-watch-page', url: regional.link } });
          }
        }
      }
      if (!offers.some(offer => offer.type === 'subscription')) continue;
      const date = seed.mediaType === 'movie' ? data.release_date : data.first_air_date;
      const year = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? Number(date.slice(0, 4)) : null;
      titles.push({
        ...seed, title: (seed.mediaType === 'movie' ? data.title : data.name) ?? '',
        synopsis: data.overview?.trim() || 'No synopsis supplied by the catalog source.', year,
        genres: data.genres.map(genre => genre.name), adult: false, posterPath: data.poster_path ?? null,
        runtimeMinutes: positive(seed.mediaType === 'movie' ? data.runtime : data.episode_run_time?.find(value => value > 0)),
        seasonCount: seed.mediaType === 'tv' ? positive(data.number_of_seasons) : null,
        episodeCount: seed.mediaType === 'tv' ? positive(data.number_of_episodes) : null,
        rating: data.vote_average !== undefined && data.vote_count !== undefined ? { value: data.vote_average, votes: data.vote_count, source: 'tmdb' } : null,
        offers,
      });
    }
  }));
  titles.sort((a, b) => titleKey(a).localeCompare(titleKey(b)));
  for (const row of coverage) {
    if (row.providerIds.length && !titles.some(title => title.mediaType === row.mediaType && title.offers.some(offer => offer.serviceId === row.serviceId && offer.type === 'subscription'))) row.limitation = 'No subscription titles verified in this bounded regional sample.';
  }
  const generatedAt = new Date(now()).toISOString();
  const checks = titles.flatMap(title => title.offers.map(offer => offer.checkedAt));
  const checkedAt = checks.sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? generatedAt;
  return parse(snapshotSchema, { schemaVersion: 1, snapshotVersion, region: 'US', generatedAt, checkedAt, source: 'tmdb', selection: 'curated', perProviderMediaLimit: 120, coverage, titles });
}
