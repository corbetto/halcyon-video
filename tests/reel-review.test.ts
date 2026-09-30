import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createReelReceipt,reelBuildSource} from '../src/reel-receipt.ts';
import {reelSetting} from '../src/reel-profile.ts';
import {readBuildSource,buildSourcePlugin} from '../tools/build-source.mjs';
import {validateReceipt,videoFacts,assessTake,reviewHtml} from '../tools/reel-review-lib.mjs';
const revision='a'.repeat(40),digest='b'.repeat(64);
const receipt=()=>createReelReceipt({filename:'halcyon-reel-2026-09-30.mp4',bytes:1000,mime:'video/mp4',source:{revision,clean:true,bundled:true},stoppedEarly:false,
  capture:{width:720,height:1280,startedAt:'2026-09-30T00:00:00.000Z',wallDurationMs:1000,requestedFps:60,audioTracks:0}});
const probe=()=>({streams:[{codec_type:'video',codec_name:'h264',width:720,height:1280,pix_fmt:'yuv420p',sample_aspect_ratio:'1:1',nb_read_frames:'60'}],format:{duration:'1',format_name:'mov,mp4'},frames:Array.from({length:60},(_,i)=>({best_effort_timestamp_time:String(i/60)}))});
const attestation={schemaVersion:1,videoSha256:digest,reviewedBy:'owner',humanOperation:true,personalLibrary:true,wholeClip:true,assetClearance:true,maximumQuality:true,noFrameInterpolation:true,movieFrames:'overhead-tv-only'};
test('receipt requested profile stays aligned with the existing opt-in recording settings',()=>{
  const previous=globalThis.localStorage;Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>key==='bb_reel_mode'?'1':null}});
  try{const profile=receipt().requestedProfile;assert.equal(profile.quality,reelSetting('bb_quality'));assert.equal(profile.reflections,reelSetting('bb_reflections'));assert.equal(profile.ssao,reelSetting('bb_ssao')==='1');assert.equal(profile.mirrors,reelSetting('bb_mirrors')==='1');assert.equal(profile.pixelBudget,Math.round(Number(reelSetting('bb_px_budget'))*1000000));}
  finally{Object.defineProperty(globalThis,'localStorage',{configurable:true,value:previous});}
});
test('capture receipts export only scalar provenance and default all human/privacy/quality approvals to unverified',()=>{
  const value=receipt();assert.equal(validateReceipt(value),value);assert.equal(value.review.publicationApproved,false);assert.equal(value.review.humanOperation,'unverified');
  assert.deepEqual(reelBuildSource(),{revision:null,clean:false,bundled:false});
  assert.doesNotMatch(JSON.stringify(value),/serverUrl|account|libraryId|token|password/);
  for(const patch of [{serverUrl:'private'},{file:{...value.file,name:'../secret.mp4'}},{review:{...value.review,publicationApproved:true}},{capture:{...value.capture,audioTracks:1}},{source:{...value.source,revision:'short'}}])assert.throws(()=>validateReceipt({...value,...patch}));
});
test('decoded frame cadence is measured, not inferred from a nominal codec frame-rate flag',()=>{
  const facts=videoFacts(probe());assert.equal(facts.decodedFps,60);assert.equal(facts.audioStreams,0);
  assert.throws(()=>videoFacts({...probe(),frames:[]}),/timestamps/);
  assert.throws(()=>videoFacts({...probe(),frames:Array.from({length:60},()=>({best_effort_timestamp_time:'0'}))}),/increasing/);
});
test('no attestation means no qualified review media, even with a clean portrait 60 fps synthetic observation',()=>{
  const result=assessTake(receipt(),videoFacts(probe()),{bytes:1000,videoSha256:digest});
  assert.equal(result.reviewReady,false);assert.equal(result.publicationApproved,false);assert.match(result.blockers.join(' '),/Owner confirmation/);
});
test('hypothetical owner evidence can qualify only private review; source matching never authorizes publication',()=>{
  const result=assessTake(receipt(),videoFacts(probe()),{bytes:1000,videoSha256:digest,attestation,releasedRevision:revision});
  assert.equal(result.reviewReady,true);assert.equal(result.publicationApproved,false);assert.match(result.sourceLabel,/matches supplied/);
  assert.equal(assessTake(receipt(),videoFacts(probe()),{bytes:1000,videoSha256:digest,attestation:{...attestation,videoSha256:'c'.repeat(64)}}).reviewReady,false);
});
test('landscape, cadence gaps, audio, altered dimensions, dirty source and recovery stops stay blocked',()=>{
  for(const patch of [{width:1280,height:720},{decodedFps:30},{maxGapSeconds:.1},{audioStreams:1},{rotation:true},{codec:'vp9'},{sampleAspect:'2:1'}])assert.equal(assessTake(receipt(),{...videoFacts(probe()),...patch},{bytes:1000,videoSha256:digest,attestation}).reviewReady,false);
  for(const value of [{...receipt(),source:{...receipt().source,clean:false}},{...receipt(),source:{...receipt().source,bundled:false}},{...receipt(),capture:{...receipt().capture,stoppedEarly:true}}])assert.equal(assessTake(value,videoFacts(probe()),{bytes:1000,videoSha256:digest,attestation}).reviewReady,false);
});
test('review output escapes supplied prose, allows only hash media names and makes no publisher call',()=>{
  const html=reviewHtml({sourceLabel:'<script>private</script>',blockers:['<img src=x onerror=alert(1)>']});
  assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>|<img src=x/);assert.match(html,/No playable campaign media/);
  assert.throws(()=>reviewHtml({},'../secret.mp4'),/Unsafe/);
});
test('build evidence never inherits an ancestor Git tree, and dev-server code is not a clean bundle',async t=>{
  const root=await mkdtemp(join(tmpdir(),'reel-build-source-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const git=(...args:string[])=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
  git('init','-q');git('config','user.name','devbjackson');git('config','user.email','90806411+devbjackson@users.noreply.github.com');
  await writeFile(join(root,'source.txt'),'one');git('add','source.txt');git('commit','-qm','Fixture source');
  assert.deepEqual(readBuildSource(root),{revision:git('rev-parse','HEAD'),clean:true});
  await mkdir(join(root,'archive'));assert.deepEqual(readBuildSource(join(root,'archive')),{revision:null,clean:false});
  const plugin=buildSourcePlugin(root),serve=plugin.config({}, {command:'serve'});assert.equal(JSON.parse(serve.define.__HALCYON_BUILD_SOURCE__).clean,false);
  plugin.config({}, {command:'build'});await writeFile(join(root,'source.txt'),'changed');assert.throws(()=>plugin.closeBundle(),/Source changed/);
});
test('copy-only CLI is private, immutable, idempotent and cannot qualify footage or overwrite a decision artifact',async t=>{
  const root=fileURLToPath(new URL('..',import.meta.url)),base=join(root,'scratch','publicity-kits');await mkdir(base,{recursive:true});
  const out=await mkdtemp(join(base,'unit-reel-'));t.after(()=>rm(out,{recursive:true,force:true}));
  const run=(...args:string[])=>spawnSync(process.execPath,[join(root,'tools/reel-review.mjs'),...args],{cwd:root,encoding:'utf8',timeout:10000});
  const first=run('--out',out);assert.equal(first.status,0,first.stderr);const result=JSON.parse(first.stdout);
  assert.equal(result.reviewReady,false);assert.equal(result.publicationApproved,false);assert.equal(result.mediaIncluded,false);assert.equal(result.reviewQueueChanged,false);
  assert.equal(run('--out',out).status,0);
  const file=join(root,result.directory,'captions.txt');await writeFile(file,'Owner decision artifact');
  assert.equal(run('--out',out).status,1);assert.equal(await readFile(file,'utf8'),'Owner decision artifact');
  const refused=run('--out',join(root,'public','should-not-exist'));assert.equal(refused.status,1);assert.doesNotMatch(refused.stderr,/\/home\/|\.env|secret/);
});
