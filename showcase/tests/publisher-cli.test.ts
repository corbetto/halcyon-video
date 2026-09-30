import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { snapshotSchema } from '../src/catalog/schema.ts';
import { validatePromotion } from '../src/catalog/promotion.ts';
const fixturePath = fileURLToPath(new URL('../fixtures/catalog.json', import.meta.url));
const cli = fileURLToPath(new URL('../tools/publish-fixture.ts', import.meta.url));
test('fixture CLI publishes without secrets and refuses live input without changing the prior pointer', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'halcyon-catalog-cli-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const token = 'synthetic-credential-sentinel';
  const run = (input: string) => spawnSync(process.execPath, ['--experimental-strip-types', cli, input, dir], { encoding: 'utf8', env: { TMDB_READ_ACCESS_TOKEN: token, VITE_TMDB_KEY: token } });
  const initial = run(fixturePath);
  assert.equal(initial.status, 0, initial.stderr);
  assert.ok(!initial.stdout.includes(token) && !initial.stderr.includes(token));
  const pointerBytes = await readFile(join(dir, 'current.json'), 'utf8');
  const pointer = JSON.parse(pointerBytes);
  const artifact = await readFile(join(dir, 'data', pointer.root, 'snapshot.json'), 'utf8');
  assert.ok(!artifact.includes(token));
  const input = JSON.parse(await readFile(fixturePath, 'utf8')); input.source = 'tmdb';
  const livePath = join(dir, 'blocked-live.json');
  await writeFile(livePath, JSON.stringify(input));
  const blocked = run(livePath);
  assert.equal(blocked.status, 1);
  assert.ok(blocked.stderr.includes('Live publication remains gated'));
  assert.ok(!blocked.stdout.includes(token) && !blocked.stderr.includes(token));
  assert.equal(await readFile(join(dir, 'current.json'), 'utf8'), pointerBytes);
});
test('watch links preserve source slugs but refuse extra parameters, fragments and neighboring IDs', async () => {
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
  fixture.titles[0].offers[0].link.url = 'https://www.themoviedb.org/movie/1-original-fixture/watch?locale=US';
  assert.equal(snapshotSchema.safeParse(fixture).success, true);
  for (const url of [
    'https://www.themoviedb.org/movie/11/watch?locale=US',
    'https://www.themoviedb.org/movie/1/watch?locale=US&api_key=secret',
    'https://www.themoviedb.org/movie/1/watch?locale=US&locale=GB',
    'https://www.themoviedb.org/movie/1/watch?locale=US#injected',
  ]) { fixture.titles[0].offers[0].link.url = url; assert.equal(snapshotSchema.safeParse(fixture).success, false); }
});
test('explicit malformed previous state is not mistaken for a first publication', async () => {
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
  assert.throws(() => validatePromotion(fixture, null, Date.now()));
  const wrongRegion = structuredClone(fixture); wrongRegion.region = 'GB';
  assert.throws(() => validatePromotion(wrongRegion, fixture, Date.now()));
});
