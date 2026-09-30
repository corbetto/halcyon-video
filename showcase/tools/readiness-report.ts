#!/usr/bin/env node
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {verifyBundle,digest} from '../src/deployment/artifact.ts';
import {verifiedSource} from '../src/deployment/source.ts';
import {readinessReport} from '../src/readiness/report.ts';
import {summarizeWeek} from '../src/metrics/collector.ts';
import {syntheticFirstWeek} from '../fixtures/first-week.ts';
try{
  const [source,asOf,gate,...extra]=process.argv.slice(2);
  if(extra.length||(gate&&gate!=='--require-launch-ready')||!source||!asOf||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(asOf)||!Number.isFinite(Date.parse(asOf))||new Date(asOf).toISOString().replace('.000Z','')!==asOf.slice(0,-1))throw Error('Usage: readiness:report -- <full-current-commit> <UTC-as-of-with-seconds> [--require-launch-ready]');
  verifiedSource(resolve('..'),source);
  const roots='input/deployment/bundles',ids=(await readdir(roots)).filter(id=>/^[a-f0-9]{64}$/.test(id));
  const candidates=[];for(const id of ids){const receipt=await verifyBundle(join(roots,id),id);if(receipt.sourceCommit===source)candidates.push(receipt);}
  if(candidates.length!==1)throw Error('Readiness requires one verified current-source fixture bundle');
  const bundle=candidates[0],proof=JSON.parse(await readFile('input/readiness/metadata.json','utf8'));
  const html=bundle.files.filter(file=>file.path.endsWith('.html')&&file.path!=='404.html').map(({path,sha256})=>({path,sha256}));
  if(proof.version!==1||JSON.stringify(proof.htmlFiles)!==JSON.stringify(html)||proof.robotsHash!==bundle.files.find(file=>file.path==='robots.txt')?.sha256)throw Error('Metadata proof does not match the sealed artifact bytes');
  const policy=JSON.parse(await readFile('deployment/policy.json','utf8'));
  const report=readinessReport({bundle,policy,asOf,rows:proof.rows,robots:await readFile(join(roots,bundle.id,'site/robots.txt'),'utf8')});
  const weekly=summarizeWeek(syntheticFirstWeek()),directory='input/readiness/reports/'+digest(JSON.stringify({report,weekly}));
  await mkdir(directory,{recursive:true});
  for(const [name,value] of [['readiness.json',report],['synthetic-first-week.json',weekly]] as const){
    const path=join(directory,name),bytes=JSON.stringify(value,null,2)+'\n';
    try{await writeFile(path,bytes,{flag:'wx'});}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST'||await readFile(path,'utf8')!==bytes)throw error;}
  }
  verifiedSource(resolve('..'),source);
  console.log(JSON.stringify({sourceCommit:source,bundleId:bundle.id,reportDirectory:directory,launchReady:false,published:false,metadataPages:report.metadata.pages,blockers:report.blockers.length,synthetic:true,realVisitorsCollected:0}));
  if(gate)process.exitCode=75;
}catch{console.error('Readiness report refused: verify the clean source, current bundle, metadata proof and UTC input. No publication or analytics was performed.');process.exitCode=1;}
