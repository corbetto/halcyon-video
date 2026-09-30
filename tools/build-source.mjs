import {execFileSync} from 'node:child_process';
import {realpathSync} from 'node:fs';
export function readBuildSource(root){
  const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',timeout:5000,stdio:['ignore','pipe','ignore']}).trim();
  try{
    if(realpathSync(git('rev-parse','--show-toplevel'))!==realpathSync(root))return {revision:null,clean:false};
    const revision=git('rev-parse','HEAD');
    return {revision:/^[a-f0-9]{40}$/.test(revision)?revision:null,clean:git('status','--porcelain','--untracked-files=all')===''};
  }catch{return {revision:null,clean:false};}
}
export function buildSourcePlugin(root){
  let initial={revision:null,clean:false},bundled=false;
  return {name:'halcyon-capture-source',
    config(_config,environment){initial=readBuildSource(root);bundled=environment.command==='build';
      return {define:{__HALCYON_BUILD_SOURCE__:JSON.stringify({...initial,clean:bundled&&initial.clean,bundled})}};
    },
    closeBundle(){if(bundled&&initial.clean){const final=readBuildSource(root);if(!final.clean||final.revision!==initial.revision)throw Error('Source changed during build; recording provenance is not valid');}},
  };
}
