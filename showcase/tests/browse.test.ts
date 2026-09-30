import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {buildCatalogArtifacts} from '../src/catalog/artifacts.ts';
import {snapshotSchema} from '../src/catalog/schema.ts';
import {parseBrowse,browseUrl,selectTitles,validatedIndex,safeReturnPath,dataAge} from '../src/catalog/browse.ts';
import {posterImages,watchRows} from '../src/catalog/presentation.ts';
const fixture=snapshotSchema.parse(JSON.parse(readFileSync(new URL('../fixtures/browse.json',import.meta.url),'utf8')));
const artifact=buildCatalogArtifacts(fixture,'a'.repeat(64));
const state=(query='')=>parseBrowse(new URL('https://example.test/browse/'+query));
test('URL state is bounded and filters preserve media/year/genre/service',()=>{
  const current=parseBrowse(new URL('https://example.test/browse/tv/?q=Quiet&genre=Science+Fiction&year=2004&service=netflix&page=999'));
  assert.equal(current.kind,'tv');assert.equal(current.page,80);
  assert.equal(parseBrowse(new URL('https://example.test'+browseUrl(current))).q,'Quiet');
  assert.equal(state('?q='+('x'.repeat(1000))).q.length,120);
  assert.equal(state('?year=2200').year,'2200');assert.equal(state('?year=2201&service=unknown&page=-1').page,1);
  assert.equal(state('?year=2201&service=unknown').service,'');
  assert.equal(parseBrowse(new URL('https://example.test/browse/movies/2/')).page,2);
});
test('bounded selection, accent normalization, combined filters and empty matches',()=>{
  const entries=validatedIndex(artifact.search,artifact.manifest,28);
  assert.equal(selectTitles(entries,state()).titles.length,24);
  assert.equal(selectTitles(entries,state('?page=2')).titles.length,4);
  assert.equal(selectTitles(entries,state('?page=80')).page,2);
  assert.equal(selectTitles(entries,state('?q=the+quiet')).titles[0].title,'The Quiet Orbit');
  const accent=structuredClone(entries);accent[0].title='Café du cinéma';
  assert.equal(selectTitles(accent,state('?q=cafe+cinema')).count,1);
  assert.equal(selectTitles(entries,{...state(),kind:'tv',genre:'Science Fiction',year:'2004',service:'netflix'}).count,1);
  assert.equal(selectTitles(entries,state('?q=absent')).count,0);
  assert.equal(selectTitles(entries,state('?service=prime')).count,0);
});
test('index rejects stale identities, incomplete data, injection routes and duplicate IDs',()=>{
  for(const change of [
    (v:any)=>v.snapshotHash='b'.repeat(64),(v:any)=>v.artifactVersion=1,(v:any)=>v.titles.pop(),
    (v:any)=>v.titles[0].path='javascript:alert(1)',(v:any)=>v.titles[1]=v.titles[0],
    (v:any)=>v.titles[0].services=['unknown'],(v:any)=>v.titles[0].posterPath='//evil.example/image',
  ]){const value=structuredClone(artifact.search);change(value);assert.throws(()=>validatedIndex(value,artifact.manifest,28));}
  assert.equal(safeReturnPath('https://evil.example/browse/','https://example.test'),null);
  assert.equal(safeReturnPath('/browse/tv/?q=orbit','https://example.test'),'/browse/tv/?q=orbit');
  assert.equal(safeReturnPath('/title/movie/1/','https://example.test'),null);
});
test('freshness boundaries and fixture watch/artwork remain fail closed',()=>{
  const now=Date.parse(fixture.checkedAt),title=fixture.titles[0];
  assert.equal(dataAge(fixture.checkedAt,now+48*3600000),'stale');
  assert.equal(dataAge(fixture.checkedAt,now+7*86400000),'expired');
  assert.equal(dataAge(fixture.checkedAt,now-1),'expired');
  assert.equal(posterImages('/fixture.jpg','fixture'),null);
  assert.equal(posterImages('//evil.jpg','tmdb'),null);
  assert.match(posterImages('/permitted.jpg','tmdb')!.srcset,/w185\/permitted.jpg 185w/);
  assert.equal(watchRows(title,'fixture',now)[0].url,null);
  assert.equal(watchRows(title,'tmdb',now)[0].label,'Check watch options on TMDB');
  const direct=structuredClone(title);direct.offers[0].link={kind:'verified-provider',url:'https://provider.example/title',verifiedAt:fixture.checkedAt,evidence:'Synthetic shape test only'};
  assert.equal(watchRows(direct,'tmdb',now)[0].label,'Visit verified provider link');
  assert.equal(watchRows(direct,'tmdb',now+7*86400000)[0].url,null);
  assert.equal(watchRows(title,'tmdb',now+7*86400000)[0].url,title.offers[0].link.url,'expired fallback is explicitly an external recheck');
});
test('oversized high-entropy search indexes are rejected before publishing',()=>{
  const huge=structuredClone(fixture);huge.titles=Array.from({length:160},(_,i)=>{
    const title=structuredClone(fixture.titles[0]);title.tmdbId=i+1;
    title.title=Array.from({length:63},(_,j)=>createHash('sha256').update(`${i}:${j}`).digest('hex')).join('').slice(0,4000);
    title.offers[0].link.url=`https://www.themoviedb.org/movie/${i+1}/watch?locale=US`;return title;
  });
  assert.throws(()=>buildCatalogArtifacts(huge,'b'.repeat(64)),/250 KiB gzip/);
});
