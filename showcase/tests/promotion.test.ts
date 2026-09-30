import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validatePromotion } from '../src/catalog/promotion.ts';
import { snapshotSchema, type Snapshot, type CatalogTitle } from '../src/catalog/schema.ts';

const baseFixture = (): Snapshot =>
  snapshotSchema.parse(
    JSON.parse(readFileSync(new URL('../fixtures/catalog.json', import.meta.url), 'utf8'))
  );

const NOW = Date.parse('2026-09-22T12:00:00Z');

function createSyntheticSnapshot(options?: {
  movieCount?: number;
  tvCount?: number;
  checkedAt?: string;
  generatedAt?: string;
  source?: 'fixture' | 'tmdb';
  region?: 'US';
  serviceId?: string;
  providerId?: number;
  offerType?: 'subscription' | 'rent' | 'buy';
}): Snapshot {
  const base = baseFixture();
  const checkedAt = options?.checkedAt ?? '2026-09-21T12:00:00Z';
  const generatedAt = options?.generatedAt ?? checkedAt;
  const source = options?.source ?? 'fixture';
  const region = options?.region ?? 'US';
  const serviceId = options?.serviceId ?? 'netflix';
  const providerId = options?.providerId ?? 8;
  const offerType = options?.offerType ?? 'subscription';

  const movieCount = options?.movieCount ?? 10;
  const tvCount = options?.tvCount ?? 10;

  const titles: CatalogTitle[] = [];

  for (let i = 1; i <= movieCount; i++) {
    titles.push({
      mediaType: 'movie',
      tmdbId: i,
      title: `Synthetic Movie ${i}`,
      synopsis: `Synthetic synopsis for movie ${i}`,
      year: 2026,
      genres: ['Drama'],
      adult: false,
      posterPath: null,
      runtimeMinutes: 100,
      seasonCount: null,
      episodeCount: null,
      rating: null,
      offers: [
        {
          region,
          serviceId,
          providerId,
          type: offerType,
          checkedAt,
          provenance: source === 'fixture' ? 'fixture' : 'tmdb-justwatch',
          link: {
            kind: 'tmdb-watch-page',
            url: `https://www.themoviedb.org/movie/${i}/watch?locale=US`,
          },
        },
      ],
    });
  }

  for (let i = 1; i <= tvCount; i++) {
    titles.push({
      mediaType: 'tv',
      tmdbId: i,
      title: `Synthetic Series ${i}`,
      synopsis: `Synthetic synopsis for series ${i}`,
      year: 2026,
      genres: ['Drama'],
      adult: false,
      posterPath: null,
      runtimeMinutes: null,
      seasonCount: 1,
      episodeCount: 10,
      rating: null,
      offers: [
        {
          region,
          serviceId,
          providerId,
          type: offerType,
          checkedAt,
          provenance: source === 'fixture' ? 'fixture' : 'tmdb-justwatch',
          link: {
            kind: 'tmdb-watch-page',
            url: `https://www.themoviedb.org/tv/${i}/watch?locale=US`,
          },
        },
      ],
    });
  }

  const coverage = base.coverage.map((row) => {
    if (row.serviceId === serviceId) {
      return {
        ...row,
        providerIds: [providerId],
        limitation: null,
      };
    }
    return {
      ...row,
      providerIds: [],
      limitation: 'Synthetic test data; no titles.',
    };
  });

  return snapshotSchema.parse({
    ...base,
    source,
    region,
    generatedAt,
    checkedAt,
    coverage,
    titles,
  });
}

test('validates candidate snapshot and accepts threshold boundary (exactly 30% drop)', () => {
  const previous = createSyntheticSnapshot({ movieCount: 10, tvCount: 10 });
  // Exactly 30% drop: 7 movies, 7 tv (14 sub titles vs 20)
  const candidate30 = createSyntheticSnapshot({ movieCount: 7, tvCount: 7 });

  const result = validatePromotion(candidate30, previous, NOW);
  assert.equal(result.snapshotVersion, candidate30.snapshotVersion);
  assert.equal(result.titles.length, 14);
});

test('rejects title count drops strictly greater than 30 percent', () => {
  const previous = createSyntheticSnapshot({ movieCount: 10, tvCount: 10 });
  // 40% drop: 6 movies, 6 tv (12 sub titles vs 20)
  const candidate40 = createSyntheticSnapshot({ movieCount: 6, tvCount: 6 });

  assert.throws(
    () => validatePromotion(candidate40, previous, NOW),
    /dropped by more than 30%/
  );
});

test('rejects source and region isolation mismatches', () => {
  const previous = createSyntheticSnapshot({ source: 'fixture', region: 'US' });
  const candidateSourceMismatch = createSyntheticSnapshot({ source: 'tmdb', region: 'US' });

  assert.throws(
    () => validatePromotion(candidateSourceMismatch, previous, NOW),
    /Source mismatch/
  );
});

test('movie and TV identity collisions are tracked independently per media group', () => {
  const previous = createSyntheticSnapshot({ movieCount: 10, tvCount: 10 });
  // Movie count remains 10, but TV count drops from 10 to 6 (40% drop in TV group)
  const candidateTvDrop = createSyntheticSnapshot({ movieCount: 10, tvCount: 6 });

  assert.throws(
    () => validatePromotion(candidateTvDrop, previous, NOW),
    /Subscription title count for netflix:tv dropped by more than 30%/
  );
});

test('transactional-only offers do not inflate subscription coverage or count', () => {
  // Candidate where netflix offers are rent only
  const candidateRentOnly = createSyntheticSnapshot({ movieCount: 10, tvCount: 10, offerType: 'rent' });

  assert.throws(
    () => validatePromotion(candidateRentOnly, undefined, NOW),
    /Candidate active subscription movie group is empty/
  );
});

test('missing coverage limitations on providers with resolved IDs are rejected', () => {
  const snapshot = createSyntheticSnapshot({ movieCount: 10, tvCount: 10 });
  // Add a resolved providerId to prime movie coverage, but provide 0 titles and no limitation
  snapshot.coverage[2].providerIds = [9]; // prime movie
  snapshot.coverage[2].limitation = null;

  assert.throws(
    () => validatePromotion(snapshot, undefined, NOW),
    /Coverage row for prime:movie has resolved provider IDs but no active subscription titles and no explicit limitation/
  );

  // Adding explicit limitation allows candidate standalone validation
  snapshot.coverage[2].limitation = 'Synthetic missing provider limitation';
  const result = validatePromotion(snapshot, undefined, NOW);
  assert.ok(result);
});

test('rejects future and regressing timestamps', () => {
  const futureGen = createSyntheticSnapshot({
    generatedAt: '2026-09-25T00:00:00Z',
    checkedAt: '2026-09-21T12:00:00Z',
  });
  assert.throws(
    () => validatePromotion(futureGen, undefined, NOW),
    /Candidate generation time is in the future/
  );

  const futureCheck = createSyntheticSnapshot({
    generatedAt: '2026-09-25T00:00:00Z',
    checkedAt: '2026-09-25T00:00:00Z',
  });
  assert.throws(
    () => validatePromotion(futureCheck, undefined, NOW),
    /Candidate (generation|check) time is in the future/
  );

  const previous = createSyntheticSnapshot({ checkedAt: '2026-09-21T12:00:00Z' });
  const regressingCheck = createSyntheticSnapshot({ checkedAt: '2026-09-20T12:00:00Z' });
  assert.throws(
    () => validatePromotion(regressingCheck, previous, NOW),
    /Candidate checkedAt regresses/
  );
});

test('withdrawal and drop rejection cannot be bypassed by adding explicit limitation', () => {
  const previous = createSyntheticSnapshot({ movieCount: 10, tvCount: 10 });
  // Candidate drops netflix movie subscription titles from 10 to 5 (50% drop), and sets limitation
  const candidateWithdrawn = createSyntheticSnapshot({ movieCount: 5, tvCount: 10 });
  candidateWithdrawn.coverage[0].limitation = 'Withdrawn stock explicit limitation';

  assert.throws(
    () => validatePromotion(candidateWithdrawn, previous, NOW),
    /dropped by more than 30%/
  );
});

test('rejects malformed candidate or previous inputs', () => {
  assert.throws(() => validatePromotion(null, undefined, NOW));
  assert.throws(() => validatePromotion({}, undefined, NOW));

  const validCand = createSyntheticSnapshot();
  assert.throws(() => validatePromotion(validCand, { invalid: true }, NOW));
});
