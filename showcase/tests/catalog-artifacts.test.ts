import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCatalogArtifacts } from '../src/catalog/artifacts.ts';
import * as loaded from '../src/catalog/load.ts';
import { snapshotSchema, type Snapshot } from '../src/catalog/schema.ts';

const fixture = (): Snapshot =>
  snapshotSchema.parse(
    JSON.parse(readFileSync(new URL('../fixtures/catalog.json', import.meta.url), 'utf8'))
  );

const validHashA = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const validHashB = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

test('envelope equality across manifest, pages and search', () => {
  const snapshot = fixture();
  const artifacts = buildCatalogArtifacts(snapshot, validHashA);

  const envelope = {
    schemaVersion: snapshot.schemaVersion,
    snapshotVersion: snapshot.snapshotVersion,
    snapshotHash: validHashA,
    region: snapshot.region,
    checkedAt: snapshot.checkedAt,
  };

  assert.equal(artifacts.manifest.schemaVersion, envelope.schemaVersion);
  assert.equal(artifacts.manifest.snapshotVersion, envelope.snapshotVersion);
  assert.equal(artifacts.manifest.snapshotHash, envelope.snapshotHash);
  assert.equal(artifacts.manifest.region, envelope.region);
  assert.equal(artifacts.manifest.checkedAt, envelope.checkedAt);

  assert.equal(artifacts.search.schemaVersion, envelope.schemaVersion);
  assert.equal(artifacts.search.snapshotVersion, envelope.snapshotVersion);
  assert.equal(artifacts.search.snapshotHash, envelope.snapshotHash);
  assert.equal(artifacts.search.region, envelope.region);
  assert.equal(artifacts.search.checkedAt, envelope.checkedAt);

  for (const page of artifacts.pages) {
    assert.equal(page.schemaVersion, envelope.schemaVersion);
    assert.equal(page.snapshotVersion, envelope.snapshotVersion);
    assert.equal(page.snapshotHash, envelope.snapshotHash);
    assert.equal(page.region, envelope.region);
    assert.equal(page.checkedAt, envelope.checkedAt);
  }
});

test('movie and TV sharing same numeric tmdbId remain distinct in search and routes', () => {
  const snapshot = fixture();
  const artifacts = buildCatalogArtifacts(snapshot, validHashA);

  const movieEntry = artifacts.search.titles.find((t) => t.key === 'movie:1');
  const tvEntry = artifacts.search.titles.find((t) => t.key === 'tv:1');

  assert.ok(movieEntry);
  assert.ok(tvEntry);
  assert.equal(movieEntry.mediaType, 'movie');
  assert.equal(tvEntry.mediaType, 'tv');
  assert.equal(movieEntry.path, '/title/movie/1/');
  assert.equal(tvEntry.path, '/title/tv/1/');
});

test('bounded pages (pageSize 24) and correct page mapping', () => {
  const base = fixture();
  const movieTemplate = base.titles[0];
  const tvTemplate = base.titles[1];

  // Build a synthetic snapshot with 50 titles (25 movies, 25 tv shows)
  const syntheticTitles: Snapshot['titles'] = [];
  for (let i = 1; i <= 25; i++) {
    const movie = structuredClone(movieTemplate);
    movie.tmdbId = i;
    movie.offers[0].link.url = `https://www.themoviedb.org/movie/${i}/watch?locale=US`;
    syntheticTitles.push(movie);

    const tv = structuredClone(tvTemplate);
    tv.tmdbId = i;
    tv.offers[0].link.url = `https://www.themoviedb.org/tv/${i}/watch?locale=US`;
    syntheticTitles.push(tv);
  }

  const snapshot: Snapshot = {
    ...base,
    titles: syntheticTitles,
  };

  const artifacts = buildCatalogArtifacts(snapshot, validHashA);

  assert.equal(artifacts.pageSize, 24);
  assert.equal(artifacts.manifest.count, 50);
  assert.equal(artifacts.pages.length, 3);
  assert.equal(artifacts.pages[0].titles.length, 24);
  assert.equal(artifacts.pages[1].titles.length, 24);
  assert.equal(artifacts.pages[2].titles.length, 2);

  assert.deepEqual(artifacts.manifest.pages, [
    `${artifacts.dataRoot}/page-1.json`,
    `${artifacts.dataRoot}/page-2.json`,
    `${artifacts.dataRoot}/page-3.json`,
  ]);
  assert.equal(artifacts.manifest.search, `${artifacts.dataRoot}/search.json`);
});

test('different hashes yield different data roots and artifact URLs', () => {
  const snapshot = fixture();

  const artifactsA = buildCatalogArtifacts(snapshot, validHashA);
  const artifactsB = buildCatalogArtifacts(snapshot, validHashB);

  assert.notEqual(artifactsA.dataRoot, artifactsB.dataRoot);
  assert.equal(artifactsA.dataRoot, `/data/${snapshot.snapshotVersion}-0123456789ab`);
  assert.equal(artifactsB.dataRoot, `/data/${snapshot.snapshotVersion}-fedcba987654`);

  assert.notEqual(artifactsA.manifest.search, artifactsB.manifest.search);
  assert.notEqual(artifactsA.manifest.pages[0], artifactsB.manifest.pages[0]);
});

test('rejects invalid snapshotHash or malformed snapshot', () => {
  const snapshot = fixture();

  // Non-64 char, uppercase, non-hex hashes must fail
  assert.throws(
    () => buildCatalogArtifacts(snapshot, '0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF'),
    /64-character lowercase SHA-256 hex hash/
  );
  assert.throws(
    () => buildCatalogArtifacts(snapshot, 'short-hash'),
    /64-character lowercase SHA-256 hex hash/
  );
  assert.throws(
    () => buildCatalogArtifacts(snapshot, 'g'.repeat(64)),
    /64-character lowercase SHA-256 hex hash/
  );

  // Invalid snapshot
  assert.throws(() => buildCatalogArtifacts({ invalid: true }, validHashA));
});

test('load.ts exports match buildCatalogArtifacts outputs', () => {
  assert.equal(loaded.pageSize, 24);
  assert.equal(typeof loaded.snapshotHash, 'string');
  assert.equal(loaded.snapshotHash.length, 64);
  assert.equal(loaded.dataRoot, `/data/${loaded.snapshot.snapshotVersion}-${loaded.snapshotHash.slice(0, 12)}`);
  assert.equal(loaded.manifest.count, loaded.snapshot.titles.length);
  assert.equal(loaded.manifest.snapshotHash, loaded.snapshotHash);
  assert.equal(loaded.search.snapshotHash, loaded.snapshotHash);
  assert.equal(loaded.pages[0].snapshotHash, loaded.snapshotHash);
});
