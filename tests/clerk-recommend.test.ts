import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommend, recordInspect } from '../src/clerk-recommend.ts';
import type { Movie } from '../src/jellyfin.ts';

const movie = (id: string, extra: Partial<Movie> = {}): Movie => ({
  id, title: id, year: 2000, duration: '', rating: '', overview: '', director: '',
  actors: [], genres: ['Drama'], localPath: '', ...extra,
});
function storage(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed));
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  }});
}
test('picks available stock over higher rated requests and future releases', () => {
  storage();
  const owned = movie('available', { communityRating: 5 });
  assert.equal(recommend([
    movie('gap', { collectionGap: true, communityRating: 10 }),
    movie('discovery', { discovery: true, communityRating: 10 }),
    movie('future', { comingSoon: true, communityRating: 10 }), owned,
  ])?.movie.id, owned.id);
  assert.equal(recommend([movie('gap', { collectionGap: true })]), null);
  assert.equal(recommend([movie('stream', { streaming: true })])?.movie.id, 'stream');
});
test('reasons cite actual ratings and browsing without inventing popularity or stock arrivals', () => {
  storage();
  assert.match(recommend([movie('rated', { communityRating: 8.2 })])!.reason, /8.2 out of 10/);
  const reason = recommend([movie('old', { year: 1950 })])!.reason;
  assert.doesNotMatch(reason, /came in|flying|staff favorite|won't be disappointed/i);
  recordInspect(movie('seen'));
  assert.match(recommend([movie('new')])!.reason, /browsing drama/);
});
test('malformed stored preferences cannot break a conversation', () => {
  for (const value of ['null', '[]', '"bad"', '{"Drama":"wrong"}', '{broken']) {
    storage({ 'clerk.genreAffinity.v1': value, 'clerk.recentInspect.v1': value });
    assert.doesNotThrow(() => recordInspect(movie('seen')));
    assert.ok(recommend([movie('next')]));
  }
});
