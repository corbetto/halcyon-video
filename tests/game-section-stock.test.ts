import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Movie } from '../src/jellyfin.ts';
import { gameShelfBays, fillGameShelfBays } from '../src/fixtures/game-section-stock.ts';
function titles(n: number, platform = 'SNES'): Movie[] {
  return Array.from({ length: n }, (_, i) => ({ id: `${platform}:${i}`, title: `${platform} ${i}`, platform } as Movie));
}

test('enough game stock fills all five rows across multiple bays before copies', () => {
  const games = titles(65);
  const bays = gameShelfBays([{ platform: 'SNES', games }], 30);
  assert.equal(bays.length, 3);
  assert.ok(bays.every(bay => bay.entries.length === 30));
  const distinct = bays.flatMap(bay => bay.entries.filter(entry => !entry.displayCopy).map(entry => entry.movie));
  assert.deepEqual(distinct, games);
  assert.ok(distinct.every((movie, i) => movie === games[i]));
  assert.equal(bays[2].entries.filter(entry => entry.displayCopy).length, 25);
  for (const bay of bays) for (let row = 0; row < 5; row++)
    assert.equal(bay.entries.slice(row * 6, (row + 1) * 6).length, 6);
});

test('thin stock fills every row and extra unit bay with original catalog identities', () => {
  const games = titles(2);
  const filled = fillGameShelfBays(gameShelfBays([{ platform: 'SNES', games }], 30), 12);
  assert.equal(filled.length, 12);
  assert.equal(filled.flatMap(bay => bay.entries).length, 360);
  const originals = filled.flatMap(bay => bay.entries.filter(entry => !entry.displayCopy));
  assert.deepEqual(originals.map(entry => entry.movie), games);
  assert.equal(new Set(filled.flatMap(bay => bay.entries.map(entry => entry.movie.id))).size, 2);
  assert.ok(filled.every(bay => bay.entries.every(entry => games.includes(entry.movie))));
  assert.ok(filled.slice(1).every(bay => bay.entries.every(entry => entry.displayCopy)));
});

test('platform chunks interleave before repeat bays without mixing platform stock', () => {
  const snes = titles(45), psx = titles(3, 'PLAYSTATION'), ps2 = titles(30, 'PLAYSTATION 2');
  const bays = gameShelfBays([
    { platform: 'SNES', games: snes }, { platform: 'PLAYSTATION', games: psx },
    { platform: 'PLAYSTATION 2', games: ps2 },
  ], 30);
  assert.deepEqual(bays.map(bay => bay.platform), ['SNES', 'PLAYSTATION', 'PLAYSTATION 2', 'SNES']);
  const filled = fillGameShelfBays(bays, 8);
  assert.ok(filled.every(bay => bay.entries.every(entry => entry.movie.platform === bay.platform)));
  assert.deepEqual(filled.slice(0, 4), bays);
  assert.ok(filled.slice(4).every(bay => bay.entries.every(entry => entry.displayCopy)));
});

test('capacity truncation preserves leading bays and empty stock invents no titles', () => {
  const bays = gameShelfBays([{ platform: 'SNES', games: titles(100) }], 30);
  assert.deepEqual(fillGameShelfBays(bays, 2), bays.slice(0, 2));
  assert.deepEqual(fillGameShelfBays([], 8), []);
  assert.deepEqual(gameShelfBays([{ platform: 'SNES', games: [] }], 30), []);
  assert.throws(() => gameShelfBays([], 0));
});

test('duplicate provider records cannot inflate distinct titles or change object identity', () => {
  const games = titles(3);
  const bay = gameShelfBays([{ platform: 'SNES', games: [games[0], games[1], { ...games[0] }, games[2]] }], 6)[0];
  assert.deepEqual(bay.entries.filter(e => !e.displayCopy).map(e => e.movie), games);
  assert.equal(bay.entries[3].movie, games[0]);
});
