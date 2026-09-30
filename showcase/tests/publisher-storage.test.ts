import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, readdir, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildCatalogArtifacts } from '../src/catalog/artifacts.ts';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { publishSnapshot, readCurrent, rollbackSnapshot } from '../src/catalog/publisher/storage.ts';
const fixture = async () => JSON.parse(await readFile(new URL('../fixtures/catalog.json', import.meta.url), 'utf8'));
async function directory(t: any) {
  const path = await mkdtemp(join(tmpdir(), 'halcyon-catalog-test-'));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}
test('failed validation and injected staging failure preserve every last-good byte', async t => {
  const dir = await directory(t);
  const first = await publishSnapshot(dir, await fixture());
  const pointer = await readFile(join(dir, 'current.json'), 'utf8');
  const good = await readFile(join(dir, 'data', first.root, 'snapshot.json'), 'utf8');
  const bad = await fixture(); bad.titles[1].offers = [];
  await assert.rejects(publishSnapshot(dir, bad));
  const second = await fixture(); second.snapshotVersion = 'fixture-v2';
  await assert.rejects(publishSnapshot(dir, second, { beforePromotion: async () => { throw new Error('Injected failure'); } }), /Injected/);
  assert.equal(await readFile(join(dir, 'current.json'), 'utf8'), pointer);
  assert.equal(await readFile(join(dir, 'data', first.root, 'snapshot.json'), 'utf8'), good);
  assert.equal((await readCurrent(dir))?.snapshot.snapshotVersion, 'fixture-v1');
  assert.ok(!(await readdir(join(dir, 'data'))).some(name => name.startsWith('.staging-')));
});
test('same input is idempotent, different bytes get separate roots and rollback restores the whole prior artifact', async t => {
  const dir = await directory(t), candidate = await fixture();
  const first = await publishSnapshot(dir, candidate);
  assert.deepEqual(await publishSnapshot(dir, candidate), first);
  candidate.titles[0].synopsis = 'A revised original test synopsis.';
  const second = await publishSnapshot(dir, candidate);
  assert.notEqual(first.root, second.root);
  assert.notEqual(first.snapshotHash, second.snapshotHash);
  await rollbackSnapshot(dir, first.root, first.snapshotHash);
  assert.deepEqual((await readCurrent(dir))?.pointer, first);
  assert.equal((await readCurrent(dir))?.snapshot.checkedAt, candidate.checkedAt);
});
test('corrupted artifact, cross-source input, forged provider evidence and unsafe rollback cannot promote', async t => {
  const dir = await directory(t), candidate = await fixture();
  const first = await publishSnapshot(dir, candidate);
  const pointer = await readFile(join(dir, 'current.json'), 'utf8');
  const forged = structuredClone(candidate);
  forged.titles[0].offers[0].link = { kind: 'verified-provider', url: 'https://example.org/watch', verifiedAt: candidate.checkedAt, evidence: 'Unapproved claim' };
  await assert.rejects(publishSnapshot(dir, forged), /authorization/);
  const live = structuredClone(candidate); live.source = 'tmdb';
  for (const title of live.titles) for (const offer of title.offers) offer.provenance = 'tmdb-justwatch';
  await assert.rejects(publishSnapshot(dir, live), /source/i);
  await assert.rejects(rollbackSnapshot(dir, '../../elsewhere', first.snapshotHash), /identity/);
  await writeFile(join(dir, 'data', first.root, 'search.json'), '{}');
  await assert.rejects(readCurrent(dir), /mismatch/);
  await assert.rejects(publishSnapshot(dir, candidate), /mismatch/);
  assert.equal(await readFile(join(dir, 'current.json'), 'utf8'), pointer);
});
test('concurrent writers fail closed instead of racing current-pointer promotion', async t => {
  const dir = await directory(t), candidate = await fixture();
  let release!: () => void;
  let staged!: () => void;
  const reached = new Promise<void>(resolve => { staged = resolve; });
  const held = publishSnapshot(dir, candidate, { beforePromotion: async () => { staged(); await new Promise<void>(resolve => { release = resolve; }); } });
  await reached;
  try { await assert.rejects(publishSnapshot(dir, candidate), /lock unavailable/); }
  finally { release(); }
  await held;
  assert.equal((await readCurrent(dir))?.snapshot.snapshotVersion, 'fixture-v1');
});
test('the storage API also blocks a first live publication, not just the CLI', async t => {
  const dir = await directory(t), live = await fixture();
  live.source = 'tmdb';
  for (const title of live.titles) for (const offer of title.offers) offer.provenance = 'tmdb-justwatch';
  await assert.rejects(publishSnapshot(dir, live), /project-specific permission/);
  assert.equal(await readCurrent(dir), undefined);
});
test('prior immutable artifact format is read and rolled back without overwriting its bytes',async t=>{
  const dir=await directory(t),candidate=await fixture(),encode=(value:unknown)=>JSON.stringify(value)+'\n';
  const bytes=encode(candidate),hash=createHash('sha256').update(bytes).digest('hex');
  const legacy=buildCatalogArtifacts(candidate,hash,1),root=legacy.dataRoot.slice('/data/'.length),folder=join(dir,'data',root);
  assert.equal(legacy.manifest.artifactVersion,undefined);assert.equal(legacy.search.titles[0].services,undefined);
  await mkdir(folder,{recursive:true});
  const oldFiles=new Map<string,unknown>([['snapshot.json',candidate],['manifest.json',legacy.manifest],['search.json',legacy.search],...legacy.pages.map(page=>[`page-${page.page}.json`,page] as [string,unknown])]);
  for(const [name,value]of oldFiles)await writeFile(join(folder,name),encode(value));
  const previous={schemaVersion:1,root,snapshotHash:hash};await writeFile(join(dir,'current.json'),encode(previous));
  assert.deepEqual((await readCurrent(dir))?.pointer,previous);
  const current=await publishSnapshot(dir,candidate);assert.equal(current.root,root+'-a2');
  for(const [name,value]of oldFiles)assert.equal(await readFile(join(folder,name),'utf8'),encode(value));
  await rollbackSnapshot(dir,root,hash);assert.deepEqual((await readCurrent(dir))?.pointer,previous);
});
