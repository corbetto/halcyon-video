import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectCatalog } from '../src/catalog/publisher/collect.ts';
import type { CatalogRequest } from '../src/catalog/publisher/http.ts';
import { validatePromotion } from '../src/catalog/promotion.ts';
const checkedAt = '2026-09-29T10:00:00Z';
const now = () => Date.parse('2026-09-29T12:00:00Z');
const providers = [{ provider_id: 1, provider_name: 'Paramount Plus Essential' }, { provider_id: 2, provider_name: 'Paramount Plus Premium' }];
function upstream(options: { noUS?: boolean; adult?: boolean; partial?: boolean; forgedLink?: boolean; transactional?: boolean } = {}) {
  const paths: string[] = [];
  const request: CatalogRequest = async (path, query) => {
    paths.push(path);
    let data: unknown;
    if (path.startsWith('/watch/providers/')) {
      assert.equal(query?.watch_region, 'US');
      data = { results: path.endsWith('/tv') ? providers.map(p => ({ ...p, provider_id: p.provider_id + 10 })) : providers };
    } else if (path.startsWith('/discover/')) {
      assert.equal(query?.include_adult, 'false');
      assert.equal(query?.with_watch_monetization_types, 'flatrate');
      assert.equal(query?.with_watch_providers, path.endsWith('/tv') ? '11|12' : '1|2');
      data = { page: 1, total_pages: 1, results: [{ id: 1 }, { id: 2, adult: true }] };
    } else if (path.endsWith('/watch/providers')) {
      if (options.partial && path.startsWith('/tv/')) throw new Error('Synthetic unavailable source');
      const type = path.startsWith('/tv/') ? 'tv' : 'movie';
      const offers = type === 'tv' ? providers.map(p => ({ ...p, provider_id: p.provider_id + 10 })) : providers;
      const value = { link: options.forgedLink ? 'https://evil.example/watch' : `https://www.themoviedb.org/${type}/1-original-fixture/watch?locale=US`, flatrate: options.transactional ? [] : offers, rent: [offers[0]], buy: [offers[1]] };
      data = { id: 1, results: options.noUS ? { GB: value } : { US: value, GB: value } };
    } else data = { id: 1, adult: options.adult ?? false, title: 'Original Fixture Film', name: 'Original Fixture Series', overview: 'An original test story.', runtime: null, episode_run_time: [], number_of_seasons: 2, number_of_episodes: 12, genres: [], vote_average: 5, vote_count: 10 };
    return { data, checkedAt };
  };
  return { request, paths };
}
test('collector preserves movie/TV identity, all aliases, offer types and supplied slug links', async () => {
  const source = upstream();
  const snapshot = await collectCatalog(source.request, 'sample-v1', now);
  assert.deepEqual(snapshot.titles.map(t => `${t.mediaType}:${t.tmdbId}`), ['movie:1', 'tv:1']);
  assert.deepEqual(snapshot.coverage.find(c => c.serviceId === 'paramount' && c.mediaType === 'tv')?.providerIds, [11, 12]);
  assert.deepEqual(snapshot.titles[0].offers.map(o => o.type), ['subscription', 'subscription', 'rent', 'buy']);
  assert.ok(snapshot.titles.every(t => t.offers.every(o => o.region === 'US' && o.link.url.includes('-original-fixture/'))));
  assert.equal(snapshot.titles[1].runtimeMinutes, null);
  assert.equal(snapshot.titles[1].seasonCount, 2);
  assert.equal(snapshot.checkedAt, checkedAt);
  assert.ok(snapshot.coverage.filter(c => c.serviceId !== 'paramount').every(c => c.limitation));
  assert.equal(validatePromotion(snapshot, undefined, now()).titles.length, 2);
  assert.ok(!source.paths.some(path => path.includes('/2')));
});
test('region withdrawal, adult details and transactional-only results cannot fabricate stock', async () => {
  for (const options of [{ noUS: true }, { adult: true }, { transactional: true }]) await assert.rejects(collectCatalog(upstream(options).request, 'invalid-v1', now), /Invalid upstream catalog shape/);
});
test('partial upstream failure aborts the candidate rather than reducing coverage', async () => {
  await assert.rejects(collectCatalog(upstream({ partial: true }).request, 'invalid-v1', now), /unavailable source/);
});
test('foreign or guessed source links cannot escape schema validation', async () => {
  await assert.rejects(collectCatalog(upstream({ forgedLink: true }).request, 'invalid-v1', now), /Invalid upstream catalog shape/);
});
test('discovery is bounded to six pages and 120 unique seeds per provider/media', async () => {
  const base = upstream();
  let pages = 0;
  const request: CatalogRequest = async (path, query) => {
    if (path.startsWith('/discover/')) {
      pages++;
      const page = Number(query?.page);
      return { checkedAt, data: { page, total_pages: 500, results: Array.from({ length: 20 }, (_, i) => ({ id: (page - 1) * 20 + i + 1 })) } };
    }
    const match = path.match(/^\/(movie|tv)\/(\d+)/);
    if (match) {
      const result = await base.request(path.replace(`/${match[2]}`, '/1'), query);
      const data = structuredClone(result.data) as any;
      data.id = Number(match[2]);
      if (data.results?.US) data.results.US.link = `https://www.themoviedb.org/${match[1]}/${match[2]}/watch?locale=US`;
      return { checkedAt, data };
    }
    return base.request(path, query);
  };
  const snapshot = await collectCatalog(request, 'bounded-v1', now);
  assert.equal(pages, 12);
  assert.equal(snapshot.titles.length, 240);
});
