import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
const root = new URL('../dist/', import.meta.url);
const read = path => readFileSync(new URL(path, root));
const manifest = JSON.parse(read('data/manifest.json'));
test('manifest, pages and search share the validated snapshot identity', () => {
  const fixture = readFileSync(new URL('../fixtures/browse.json', import.meta.url));
  assert.equal(manifest.snapshotHash, createHash('sha256').update(fixture).digest('hex'));
  let count = 0;
  for (const path of [...manifest.pages, manifest.search]) {
    const data = JSON.parse(read(path.slice(1)));
    for (const field of ['schemaVersion','artifactVersion','snapshotVersion','snapshotHash','region','checkedAt']) assert.equal(data[field], manifest[field]);
    if (data.page) { assert.ok(data.titles.length <= 24); count += data.titles.length; }
  }
  assert.equal(count, manifest.count);
  const search = JSON.parse(read(manifest.search.slice(1)));
  assert.deepEqual(search.titles.map(title => title.key), JSON.parse(fixture).titles.map(title=>`${title.mediaType}:${title.tmdbId}`));
  assert.ok(gzipSync(read(manifest.search.slice(1))).length < 250 * 1024);
});
test('static noindex routes remain within budgets and contain no 3D assets', () => {
  const walk = (url) => readdirSync(url).flatMap(name => { const child = new URL(name, url); return statSync(child).isDirectory() ? walk(new URL(name+'/',url)) : [child]; });
  const files = walk(root);
  assert.ok(files.every(file => !/\.(?:glb|gltf|wasm|mp4|hdr|ktx2)$/.test(file.pathname)));
  const js=files.filter(file=>/\.m?js$/.test(file.pathname));
  const scriptGzip=js.reduce((sum,file)=>sum+gzipSync(readFileSync(file)).length,0);
  assert.ok(scriptGzip<=100*1024,'all browser JavaScript fits the cold-route budget');
  for(const file of js)assert.doesNotMatch(readFileSync(file,'utf8'),/WebGLRenderer|GLTFLoader|WebGLRenderingContext|jellyfin_token|THREE\./);
  const search = JSON.parse(read(manifest.search.slice(1)));
  const paths = ['index.html','browse/index.html','browse/2/index.html','browse/movies/index.html','browse/tv/index.html',...search.titles.map(title=>title.path.slice(1)+'index.html'),'about/index.html','store/index.html','self-host/index.html','404.html'];
  for (const path of paths) {
    const html = read(path).toString();
    assert.match(html, /noindex/);
    assert.match(html, /fictional sample titles/);
    assert.doesNotMatch(html, /rel="(?:prefetch|preload|modulepreload)"|<iframe\b|<canvas\b|<video\b/);
  }
  assert.match(read('title/movie/1/index.html').toString(), /The Last Picture House/);
  assert.match(read('title/tv/1/index.html').toString(), /Midnight Matinee/);
  assert.equal((read('browse/index.html').toString().match(/data-title-key=/g)||[]).length,24);
  assert.equal((read('browse/2/index.html').toString().match(/data-title-key=/g)||[]).length,4);
  assert.equal((read('browse/tv/index.html').toString().match(/data-title-key="tv:/g)||[]).length,14);
  console.log(JSON.stringify({fixture:true,browserJsGzip:scriptGzip,searchIndexGzip:gzipSync(read(manifest.search.slice(1))).length,staticFiles:files.length,titlePages:search.titles.length}));
});
