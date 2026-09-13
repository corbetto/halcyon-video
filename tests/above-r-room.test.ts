import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { JellyfinLibrary, Movie } from '../src/jellyfin.ts';
import { ABOVE_R_LIBRARY_ID, isAboveRMovie, partitionAboveRRoom } from '../src/above-r-room.ts';
Object.defineProperty(globalThis, 'localStorage', { value: {
  getItem: (key: string) => key === 'bb_store_format' ? 'mom-and-pop' : null,
  setItem: () => {},
}, configurable: true });
const { StorePlan } = await import('../src/store-plan.ts');
const { UNIT_SIDE_CAPACITY, STORE_CENTER_X } = await import('../src/store-layout.ts');
const movie = (id: string, rating: string): Movie => ({ id, title: id, rating, year: 1995,
  genres: ['Drama'], actors: [], director: '', duration: '', overview: '', localPath: '' });
const lib = (id: string, movies: Movie[]): JellyfinLibrary => ({ id, name: id, movies, genres: ['Drama'] } as JellyfinLibrary);
test('only explicit NC-17 or X real movies enter the optional room', () => {
  for (const rating of ['NC-17', 'nc17', ' X ']) assert.ok(isAboveRMovie(movie(rating, rating)));
  for (const rating of ['R', 'TV-MA', 'Unrated', 'NR', '', '18', 'PG-13']) assert.ok(!isAboveRMovie(movie(rating, rating)));
  assert.ok(!isAboveRMovie({ ...movie('game', 'X'), game: true }));
  assert.ok(!isAboveRMovie({ ...movie('request', 'NC-17'), discovery: true }));
});
test('off keeps all titles in source libraries; on partitions once and toggling off restores them', () => {
  const adult = movie('adult', 'NC-17');
  const input = [lib('A', [adult, movie('regular', 'R')]), lib('B', [adult, movie('unknown', '')])];
  assert.equal(partitionAboveRRoom(input, false), input);
  const enabled = partitionAboveRRoom(input, true);
  const room = enabled.find(l => l.id === ABOVE_R_LIBRARY_ID)!;
  assert.deepEqual(room.movies.map(m => m.id), ['adult']);
  assert.equal(enabled.slice(0, -1).flatMap(l => l.movies).filter(m => m.id === 'adult').length, 0);
  assert.equal(input[0].movies.length, 2, 'partition does not mutate provider catalogs');
  assert.equal(partitionAboveRRoom(enabled, false), input);
});
test('enabled but ineligible stock creates neither a library nor a room', () => {
  const input = [lib('A', [movie('regular', 'R'), movie('unknown', '')])];
  const result = partitionAboveRRoom(input, true);
  assert.equal(result, input);
  const plan = new StorePlan(result); plan.plan(); assert.equal(plan.aboveRRoom, null);
});
for (const count of [1, 55, 120]) test(`room grows real shelf capacity for ${count} eligible titles`, () => {
  const input = [lib('Movies', [movie('regular', 'PG'), ...Array.from({ length: count }, (_, i) => movie(`adult-${i}`, 'NC-17'))])];
  const plan = new StorePlan(partitionAboveRRoom(input, true)); plan.plan();
  const room = plan.aboveRRoom!;
  assert.ok(room);
  const units = plan.shelvingUnits.filter(u => u.libraryIdx === room.libraryIdx);
  assert.ok(units.length * UNIT_SIDE_CAPACITY >= plan.layoutFor(room.libraryIdx).entries.length);
  assert.ok(plan.entryBlockOrder(room.libraryIdx).every(block => block.side === 'front'));
  for (const u of units) {
    assert.equal(u.singleSided, true); assert.equal(u.browseSign, -1);
    assert.ok(u.xCenter > STORE_CENTER_X + plan.getStoreWidth() / 2 - room.width);
    assert.ok(plan.aisleZCenter(u) > plan.backWallZ && plan.aisleZCenter(u) < plan.backWallZ + room.depth);
  }
  assert.ok(plan.layoutFor(room.libraryIdx).entries.filter(Boolean).every(m => isAboveRMovie(m!)));
});
