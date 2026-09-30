#!/usr/bin/env node
// Packages a local fixture artifact only. There is deliberately no deploy command.
import {readFile,appendFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createBundle,digest} from '../src/deployment/artifact.ts';
import {verifiedSource} from '../src/deployment/source.ts';
import {deploymentDecision,validatePolicy} from '../src/deployment/policy.ts';
const args=process.argv.slice(2),expected=args[0];
try{
  if(args.length!==1)throw Error('Usage: npm run package:preview -- <exact-source-commit>');
  const source=verifiedSource(resolve('..'),expected);
  const policy=validatePolicy(JSON.parse(await readFile('deployment/policy.json','utf8')));
  const decision=deploymentDecision(policy,'local-preview',source);if(!decision.allowed)throw Error(decision.reasons.join(' '));
  const fixture=await readFile('fixtures/browse.json'),manifest=JSON.parse(await readFile('dist/data/manifest.json','utf8'));
  if(manifest.snapshotHash!==digest(fixture))throw Error('Build does not match the committed browsing fixture');
  const pkg=JSON.parse(await readFile('package.json','utf8'));
  const astro=JSON.parse(await readFile('node_modules/astro/package.json','utf8')).version;
  if(astro!==pkg.dependencies.astro)throw Error('Installed Astro does not match the pinned build version');
  const result=await createBundle('dist','input/deployment/bundles',source,{node:process.version,astro});
  verifiedSource(resolve('..'),source);
  if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,
    `### Verified local fixture artifact\n\nNot published. Source: ${source}\n\nSnapshot: ${result.receipt.snapshot.hash}, checked ${result.receipt.snapshot.checkedAt}\n\nBundle: ${result.receipt.id}\n\n${result.receipt.files.length} files, ${result.receipt.bytes} bytes. Network publishing remains disabled.\n`);
  console.log(JSON.stringify({mode:'fixture-local-preview',published:false,bundle:result.receipt.id,sourceCommit:source,
    snapshotHash:result.receipt.snapshot.hash,checkedAt:result.receipt.snapshot.checkedAt,files:result.receipt.files.length,bytes:result.receipt.bytes,directory:result.directory}));
}catch(error){console.error(error instanceof Error?error.message:'Preview packaging failed');process.exitCode=1;}
