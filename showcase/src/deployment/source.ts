import {execFileSync} from 'node:child_process';
export function captureBuildSource(cwd:string){
  try{return {sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd,encoding:'utf8',timeout:10000,stdio:['ignore','pipe','ignore']}).trim(),
    clean:execFileSync('git',['status','--porcelain','--untracked-files=all'],{cwd,encoding:'utf8',timeout:10000,stdio:['ignore','pipe','ignore']}).trim()===''};}
  catch{return {sourceCommit:null,clean:false};}
}
export function verifiedSource(cwd:string,expected:string){
  if(!/^[a-f0-9]{40}$/.test(expected))throw Error('Expected a full source commit');
  const git=(...args:string[])=>execFileSync('git',args,{cwd,encoding:'utf8',timeout:10000}).trim();
  if(git('rev-parse','HEAD')!==expected)throw Error('Source checkout differs from requested commit');
  if(git('status','--porcelain','--untracked-files=all'))throw Error('Packaging requires a clean source checkout');
  return expected;
}
