import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CATALOG_PROVIDER_IDS,HOSTED_STORE_URL,parseHandoffValue,parseCatalogHandoff,serializeHandoff,storeEntryUrl,canonicalCatalogReturn,resolveCatalogMovie} from '../src/catalog-handoff.ts';
import {DEFAULT_STREAMING_SERVICES} from '../src/streaming-catalog.ts';
const movie={version:1 as const,mediaType:'movie' as const,tmdbId:813,region:'US' as const};
test('versioned bounded contract accepts only exact public identity and configured service IDs',()=>{
  assert.deepEqual([...CATALOG_PROVIDER_IDS],[...DEFAULT_STREAMING_SERVICES.map(service=>service.id)]);
  assert.deepEqual(parseHandoffValue(serializeHandoff({...movie,providers:['prime','netflix']})),{...movie,providers:['netflix','prime']});
  assert.deepEqual(parseCatalogHandoff('?catalog=v1.movie.813.US'),{kind:'valid',value:movie});
  assert.deepEqual(parseCatalogHandoff(''),{kind:'absent'});
  assert.equal(parseHandoffValue('v1.movie.9007199254740991.US')?.tmdbId,Number.MAX_SAFE_INTEGER);
});
test('invalid versions, region, IDs, duplicate providers and redirect/credential shapes fail closed',()=>{
  for(const raw of ['v2.movie.813.US','v1.tv.0.US','v1.movie.01.US','v1.movie.-1.US','v1.movie.1.5.US','v1.movie.9007199254740992.US','v1.movie.1.GB','v1.game.1.US','v1.movie.1.US.netflix,netflix','v1.movie.1.US.unknown','v1.movie.1.US.https://server','x'.repeat(200)])assert.equal(parseHandoffValue(raw),null,raw);
  for(const query of ['?catalog=v1.movie.813.US&catalog=v1.movie.2.US','?catalog=v1.movie.813.US&return=https://other.example','?catalog=v1.movie.813.US&title=Wrong','?catalog=v1.movie.813.US&server=http://192.168.1.2','?catalog=v1.movie.813.US&token=secret'])assert.equal(parseCatalogHandoff(query).kind,'invalid');
  assert.throws(()=>serializeHandoff({...movie,redirect:'https://other.example'} as typeof movie));
});
test('fixtures never send invented IDs to real stock and no query supplies a destination',()=>{
  assert.equal(storeEntryUrl(movie,'fixture'),HOSTED_STORE_URL);
  assert.equal(storeEntryUrl(movie,'tmdb'),HOSTED_STORE_URL+'?catalog=v1.movie.813.US');
  assert.equal(storeEntryUrl(null,'tmdb'),HOSTED_STORE_URL);
  assert.equal(canonicalCatalogReturn(undefined,movie),null);
  for(const origin of ['http://example.test','https://user:pass@example.test','https://example.test/path','https://example.test/?to=other','javascript:alert(1)'])assert.equal(canonicalCatalogReturn(origin,movie),null);
  assert.equal(canonicalCatalogReturn('https://catalog.example',movie),'https://catalog.example/title/movie/813/');
  assert.equal(canonicalCatalogReturn('https://catalog.example',null),'https://catalog.example/browse/');
});
test('exact TMDB identity cannot substitute a similar title, series, game or ambiguous ID',()=>{
  const right={id:'right',tmdbId:813},wrong={id:'wrong',tmdbId:814};
  assert.deepEqual(resolveCatalogMovie(movie,[wrong,right]),{kind:'match',movie:right});
  assert.equal(resolveCatalogMovie({...movie,mediaType:'tv'},[right]).kind,'unsupported');
  for(const list of [[wrong],[{...right,isSeries:true}],[{...right,game:true}],[right,{id:'right',tmdbId:814}]])assert.equal(resolveCatalogMovie(movie,list).kind,'missing');
});
test('scene-ready integration preserves existing share/checkout code and does not enable services',()=>{
  const glue=readFileSync(new URL('../src/shared-place-ui.ts',import.meta.url),'utf8');
  assert.match(glue,/initCatalogHandoff\(scene, setupPending\)/);assert.match(glue,/!setupPending && !catalogHandled/);
  const ui=readFileSync(new URL('../src/catalog-handoff-ui.ts',import.meta.url),'utf8');
  assert.match(ui,/if\(handled\)return true/);assert.match(ui,/scene\.getSelectedMovie\(\)/);assert.match(ui,/selected\.tmdbId===value\.tmdbId/);
  assert.doesNotMatch(ui,/localStorage\.setItem|fetch\(|window\.open|location\.(?:assign|replace)|\.play\(|enterCheckout\(/);
});
