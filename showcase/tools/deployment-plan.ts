#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {deploymentDecision,validatePolicy} from '../src/deployment/policy.ts';
try{
  const policy=validatePolicy(JSON.parse(await readFile('deployment/policy.json','utf8')));
  const result=deploymentDecision(policy,process.argv[2]||'production',process.argv[3]||'');
  console.log(JSON.stringify(result,null,2));if(!result.allowed)process.exitCode=75;
}catch(error){console.error(error instanceof Error?error.message:'Invalid deployment policy');process.exitCode=75;}
