import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pageMetadata,plannedIndexPaths,validatePreviewMetadata,type MetadataObservation} from '../src/readiness/metadata.ts';
import {parseMetricEvent} from '../src/metrics/schema.ts';
import {createFixtureCollector,summarizeWeek} from '../src/metrics/collector.ts';
import {syntheticFirstWeek} from '../fixtures/first-week.ts';
import {assessHealth} from '../src/readiness/health.ts';
import {readinessReport} from '../src/readiness/report.ts';
import type {BundleReceipt} from '../src/deployment/artifact.ts';
const row:MetadataObservation={path:'/',status:200,title:'Halcyon home',description:'A fictional metadata description for the home page.',robots:'noindex, nofollow',canonical:null,ogTitle:'Halcyon home',ogDescription:'A fictional metadata description for the home page.',ogType:'website',ogUrl:null,ogImage:null,links:['/browse/']};
const browse={...row,path:'/browse/',title:'Browse titles',ogTitle:'Browse titles',description:'A fictional description for the browsing selection.',ogDescription:'A fictional description for the browsing selection.'};
const robots='User-agent: *\nAllow: /\n';
test('preview metadata is bounded, page-specific and cannot announce public identity',()=>{
  assert.equal(pageMetadata('  A\n movie ','A story').description,'A movie. A story');assert.equal(pageMetadata('Long','a'.repeat(1000)).description.length,240);
  assert.equal(validatePreviewMetadata([row,browse],['/','/browse/'],robots).passed,true);
  for(const patch of [{canonical:'https://unapproved.example/'},{robots:'index, follow'},{ogImage:'https://unapproved.example/image.png'},{ogTitle:'Another title'},{links:['https://attacker.example']},{links:['/absent/']},{links:['javascript:alert(1)']},{links:['/browse/?token=private']},{links:['https://github.com/halcyon-video/halcyon-video?token=private']}])assert.throws(()=>validatePreviewMetadata([{...row,...patch},browse],['/','/browse/'],robots));
  assert.throws(()=>validatePreviewMetadata([row,{...row,path:'/browse/'}],['/','/browse/'],robots),/Duplicate/);
  assert.throws(()=>validatePreviewMetadata([row],['/','/browse/'],robots),/inventory/);
  assert.throws(()=>validatePreviewMetadata([row,browse],['/','/browse/'],'User-agent: *\nDisallow: /\n'),/robots/);
});
test('discovery inventory excludes filter combinations and pagination without inventing a host',()=>{
  assert.deepEqual(plannedIndexPaths(['/browse/2/','/title/tv/2/','/','/browse/']),['/','/browse/','/title/tv/2/']);
  for(const paths of [['/','/'],['/browse/?q=secret'],['//other.example'],['/title/movie/0/'],['/../secret']])assert.throws(()=>plannedIndexPaths(paths));
});
test('event contract rejects identifiers, credentials, searches, locations and incompatible dimensions without logging them',()=>{
  const event={version:1,event:'watch_options_opened',surface:'title'};
  assert.deepEqual(parseMetricEvent(event),event);
  for(const key of ['query','titleId','ip','referrer','url','userId','sessionId','credential','library'])assert.throws(()=>parseMetricEvent({...event,[key]:'secret-marker'}),error=>!String(error).includes('secret-marker'));
  assert.throws(()=>parseMetricEvent({...event,surface:'store'}));assert.throws(()=>parseMetricEvent({...event,event:'playback_success'}));
});
test('offline collector accepts only bounded synthetic records and retains no rejected payload',()=>{
  const collector=createFixtureCollector('2026-09-21'),event={version:1,event:'page_view',surface:'browse'};
  collector.accept({synthetic:true,day:'2026-09-21',source:'direct',count:4,event});
  for(const change of [{synthetic:false},{day:'2026-09-28'},{source:'https://private.example'},{count:-1},{count:100001},{ip:'private'}])assert.throws(()=>collector.accept({synthetic:true,day:'2026-09-21',source:'direct',count:4,event,...change}));
  assert.equal(collector.report().days[0].arrivals.direct,4);collector.clear();assert.equal(collector.report().days[0].ratios.browseToTitle.ratio,null);
});
test('synthetic week is deterministic and ratios are not traffic, playback, installs or conversion targets',()=>{
  const input=syntheticFirstWeek(),first=summarizeWeek(input);assert.deepEqual(first,summarizeWeek(input));
  assert.equal(first.days.length,7);assert.equal(first.realVisitorsCollected,0);assert.equal(first.baselineEstablished,false);assert.equal(first.conversionTargets,null);
  assert.equal(first.days[0].ratios.browseToTitle.ratio,22/40);
  assert.throws(()=>summarizeWeek({...input,synthetic:false}));
});
test('health recommendations preserve freshness and separate unobserved checks from success',()=>{
  const input={asOf:'2026-09-30T12:00:00Z',checkedAt:'2026-09-29T12:00:00Z',integrity:true,refresh:'unknown' as const,site:'unknown' as const,links:'unknown' as const};
  assert.equal(assessHealth(input).alerts[0].severity,'unobserved');
  assert.ok(assessHealth({...input,checkedAt:'2026-09-28T12:00:00Z'}).alerts.some(alert=>alert.reason.includes('stale')));
  assert.ok(assessHealth({...input,checkedAt:'2026-09-23T12:00:00Z'}).alerts.some(alert=>alert.reason.includes('expired')));
  const failed=assessHealth({...input,integrity:false,refresh:'failed',site:'down',links:'failed'});
  assert.equal(failed.automaticAction,false);assert.equal(failed.decisionOwner,'devbjackson');assert.ok(failed.alerts.some(alert=>alert.action.includes('Retain last-good')));
  assert.throws(()=>assessHealth({...input,checkedAt:'2027-01-01T00:00:00Z'}));
  assert.throws(()=>assessHealth({...input,checkedAt:'2026-02-30T12:00:00Z'}));
});
test('passing local proof can never waive source, host, phone, field or release gates',async()=>{
  const policy=JSON.parse(await readFile(new URL('../deployment/policy.json',import.meta.url),'utf8'));
  const bundle:BundleReceipt={version:1,project:'halcyon-showcase',mode:'fixture-local-preview',sourceCommit:'a'.repeat(40),id:'b'.repeat(64),snapshot:{source:'fixture',checkedAt:'2026-09-29T12:00:00Z',hash:'c'.repeat(64),version:'fixture',artifactVersion:2},toolchain:{node:'v22.19.0',astro:'7.3.3'},files:['index.html','browse/index.html'].map(path=>({path,bytes:1,sha256:'d'.repeat(64)})),bytes:2};
  const report=readinessReport({bundle,policy,asOf:'2026-09-30T12:00:00Z',rows:[row,browse],robots});
  assert.equal(report.launchReady,false);assert.equal(report.published,false);assert.equal(report.blockers.length,7);assert.equal(report.discovery.sitemapGenerated,false);
  assert.deepEqual(report,readinessReport({bundle,policy,asOf:'2026-09-30T12:00:00Z',rows:[row,browse],robots}));
  assert.equal(readinessReport({bundle,policy:{...policy,canonicalHost:'example.org',sourcePermissionReference:'declared',approvedMasterSha:bundle.sourceCommit},asOf:'2026-09-30T12:00:00Z',rows:[row,browse],robots}).launchReady,false);
});
