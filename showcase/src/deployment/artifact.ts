import {createHash} from 'node:crypto';
import {readFile,readdir,lstat,mkdir,writeFile,rename,rm} from 'node:fs/promises';
import {join,resolve,relative} from 'node:path';
import {gzipSync} from 'node:zlib';
import {randomUUID} from 'node:crypto';
import {validatedIndex,type Identity} from '../catalog/browse.ts';
import {titleSchema,titleKey,snapshotSchema,type CatalogTitle} from '../catalog/schema.ts';
import {buildCatalogArtifacts} from '../catalog/artifacts.ts';

export const digest=(bytes:string|Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const encode=(value:unknown)=>JSON.stringify(value,null,2)+'\n';
export interface FileSeal {path:string;bytes:number;sha256:string}
export interface BundleReceipt {version:1;project:'halcyon-showcase';mode:'fixture-local-preview';sourceCommit:string;
  snapshot:{hash:string;version:string;checkedAt:string;artifactVersion:number;source:'fixture'};
  toolchain:{node:string;astro:string};files:FileSeal[];bytes:number;id:string}
const safePath=(path:string)=>!path.includes('\\')&&!path.split('/').some(part=>!part||part==='.'||part==='..'||part.startsWith('.'));
function allowedPath(path:string){
  return safePath(path)&&!/(^|\/)(?:user-assets|functions|node_modules|tickets|workdir|outbox|_worker\.js|AGENT-RULES|CLAUDE|GEMINI)(?:[/.]|$)/i.test(path)&&
    (['robots.txt','_headers'].includes(path)||/\.(?:html|css|js|json|png|webp|jpg|svg|ico|woff2)$/.test(path));
}
export async function fileSeals(root:string):Promise<FileSeal[]>{
  const files:FileSeal[]=[];let total=0;
  async function visit(dir:string){
    for(const name of (await readdir(dir)).sort()){
      const file=join(dir,name),path=relative(root,file).replaceAll('\\','/'),stat=await lstat(file);
      if(stat.isSymbolicLink()||!safePath(path))throw Error('Symbolic links and unsafe paths cannot enter an artifact');
      if(stat.isDirectory()){if(!allowedPath(path+'/probe.json'))throw Error('Private directory cannot enter an artifact');await visit(file);continue;}
      if(!stat.isFile()||!allowedPath(path))throw Error('Private, source-map or unsupported asset: '+path);
      if(stat.size>25*1024*1024||files.length>=20000||(total+=stat.size)>100*1024*1024)throw Error('Static artifact exceeds its file or volume budget');
      const bytes=await readFile(file);
      if(/\.(?:html|css|js|json|svg|txt)$/.test(path)&&/CLOUDFLARE_API_TOKEN|TMDB_READ_ACCESS_TOKEN|BEGIN [A-Z ]*PRIVATE KEY|sourceMappingURL/.test(bytes.toString()))throw Error('Sensitive marker or source map found in public output');
      files.push({path,bytes:bytes.length,sha256:digest(bytes)});
    }
  }
  if((await lstat(root)).isSymbolicLink())throw Error('Artifact root cannot be a symbolic link');
  await visit(root);return files;
}
export async function inspectStaticOutput(root:string,sourceCommit:string,toolchain:{node:string;astro:string}):Promise<BundleReceipt>{
  if(!/^[a-f0-9]{40}$/.test(sourceCommit))throw Error('Full source commit required');
  if(!toolchain||!/^v?\d+\.\d+\.\d+$/.test(toolchain.node)||!/^\d+\.\d+\.\d+$/.test(toolchain.astro))throw Error('Exact build tool versions required');
  const files=await fileSeals(root),paths=new Set(files.map(file=>file.path));
  for(const required of ['index.html','404.html','robots.txt','_headers','data/manifest.json','build-provenance.json'])if(!paths.has(required))throw Error('Missing required static asset: '+required);
  const build=JSON.parse(await readFile(join(root,'build-provenance.json'),'utf8'));
  if(build.version!==1||build.clean!==true||build.sourceCommit!==sourceCommit||JSON.stringify(build.toolchain)!==JSON.stringify(toolchain))throw Error('Build provenance is dirty, stale or uses different tools');
  const manifest=JSON.parse(await readFile(join(root,'data/manifest.json'),'utf8'));
  if(manifest.source!=='fixture'||manifest.schemaVersion!==1||manifest.artifactVersion!==2||manifest.region!=='US'||!/^[a-f0-9]{64}$/.test(manifest.snapshotHash))throw Error('Only the approved fixture format may be packaged');
  const indexPath=String(manifest.search).slice(1);
  if(!/^data\/[a-z0-9-]+\/search\.json$/.test(indexPath)||!paths.has(indexPath))throw Error('Search artifact is missing');
  const indexBytes=await readFile(join(root,indexPath));
  if(gzipSync(indexBytes).length>250*1024)throw Error('Search index exceeds budget');
  const index=validatedIndex(JSON.parse(indexBytes.toString()),manifest as Identity,manifest.count);
  if(!Array.isArray(manifest.pages)||!manifest.pages.length||manifest.pages.length>80)throw Error('Catalog pages are missing');
  const keys:string[]=[],titles:CatalogTitle[]=[],rawPages:unknown[]=[];
  for(const path of manifest.pages){
    if(typeof path!=='string'||!/^\/data\/[a-z0-9-]+\/page-[1-9]\d*\.json$/.test(path)||!paths.has(path.slice(1)))throw Error('Catalog page path is invalid');
    const page=JSON.parse(await readFile(join(root,path.slice(1)),'utf8'));
    rawPages.push(page);
    for(const key of ['schemaVersion','artifactVersion','snapshotVersion','snapshotHash','region','checkedAt'])if(page[key]!==manifest[key])throw Error('Mixed catalog snapshot');
    if(!Array.isArray(page.titles)||page.titles.length>24)throw Error('Catalog page is unbounded');
    const parsed=page.titles.map((title:unknown)=>titleSchema.parse(title));titles.push(...parsed);keys.push(...parsed.map(titleKey));
  }
  if(JSON.stringify(keys)!==JSON.stringify(index.map(title=>title.key)))throw Error('Page and search identities differ');
  const snapshot=snapshotSchema.parse({schemaVersion:manifest.schemaVersion,snapshotVersion:manifest.snapshotVersion,region:manifest.region,
    generatedAt:manifest.generatedAt,checkedAt:manifest.checkedAt,source:manifest.source,selection:manifest.selection,perProviderMediaLimit:120,coverage:manifest.coverage,titles});
  const rebuilt=buildCatalogArtifacts(snapshot,manifest.snapshotHash);
  if(JSON.stringify(rebuilt.manifest)!==JSON.stringify(manifest)||JSON.stringify(rebuilt.pages)!==JSON.stringify(rawPages)||JSON.stringify(rebuilt.search)!==JSON.stringify(JSON.parse(indexBytes.toString())))throw Error('Catalog artifacts do not derive from one snapshot');
  const inventory=new Set(['index.html','404.html','about/index.html','store/index.html','self-host/index.html','robots.txt','_headers','build-provenance.json','data/manifest.json',indexPath,...manifest.pages.map((path:string)=>path.slice(1)),...index.map(title=>title.path.slice(1)+'index.html')]);
  for(const kind of ['all','movie','tv']){
    const count=index.filter(title=>kind==='all'||title.mediaType===kind).length,pages=Math.max(1,Math.ceil(count/24));
    const base='browse/'+(kind==='movie'?'movies/':kind==='tv'?'tv/':'');
    for(let page=1;page<=pages;page++)inventory.add(base+(page===1?'':page+'/')+'index.html');
  }
  for(const path of inventory)if(!paths.has(path))throw Error('Static route or data file is missing: '+path);
  for(const file of files)if(!inventory.has(file.path)&&!/^_astro\/[A-Za-z0-9_.-]+\.[A-Za-z0-9_-]{8,}\.(?:js|css|woff2|png|webp|jpg|svg)$/.test(file.path))throw Error('Unexpected file outside the reviewed public inventory: '+file.path);
  for(const title of index)if(!paths.has(title.path.slice(1)+'index.html'))throw Error('Missing prerendered title page');
  for(const file of files.filter(file=>file.path.endsWith('.html'))){
    const html=await readFile(join(root,file.path),'utf8');
    if(!html.includes(`name="halcyon-snapshot" content="${manifest.snapshotHash}"`))throw Error('HTML and catalog snapshot differ');
    if(!/<meta[^>]+name="robots"[^>]+content="noindex, nofollow"/.test(html)||/<link[^>]+rel=["']canonical["']/.test(html))throw Error('Preview must be noindex with no production canonical');
  }
  const headers=await readFile(join(root,'_headers'),'utf8');
  if(!headers.includes('X-Robots-Tag: noindex, nofollow')||!headers.includes('max-age=0, must-revalidate')||!headers.includes('/_astro/*'))throw Error('Preview/cache headers are missing');
  let jsGzip=0;for(const file of files.filter(file=>file.path.endsWith('.js')))jsGzip+=gzipSync(await readFile(join(root,file.path))).length;
  if(jsGzip>100*1024)throw Error('Browser JavaScript exceeds budget');
  const receipt={version:1 as const,project:'halcyon-showcase' as const,mode:'fixture-local-preview' as const,sourceCommit,
    snapshot:{hash:manifest.snapshotHash,version:manifest.snapshotVersion,checkedAt:manifest.checkedAt,artifactVersion:2,source:'fixture' as const},toolchain,
    files,bytes:files.reduce((sum,file)=>sum+file.bytes,0)};
  return {...receipt,id:digest(JSON.stringify(receipt))};
}
export async function verifyBundle(directory:string,expectedId?:string){
  const receipt=JSON.parse(await readFile(join(directory,'receipt.json'),'utf8')) as BundleReceipt;
  const expected=await inspectStaticOutput(join(directory,'site'),receipt.sourceCommit,receipt.toolchain);
  if(JSON.stringify(receipt)!==JSON.stringify(expected))throw Error('Bundle receipt or bytes were changed');
  if(expectedId&&receipt.id!==expectedId)throw Error('Bundle identity does not match its immutable directory');
  const names=await readdir(directory);if(names.length!==2||!names.includes('site')||!names.includes('receipt.json'))throw Error('Unexpected bundle content');
  return receipt;
}
export async function createBundle(dist:string,output:string,sourceCommit:string,toolchain:{node:string;astro:string}){
  dist=resolve(dist);output=resolve(output);
  if(output===dist||output.startsWith(dist+'/'))throw Error('Bundle output cannot be inside the input');
  const receipt=await inspectStaticOutput(dist,sourceCommit,toolchain);
  await mkdir(output,{recursive:true});const final=join(output,receipt.id),staging=join(output,'.staging-'+randomUUID());
  await mkdir(join(staging,'site'),{recursive:true});
  try{
    for(const file of receipt.files){const target=join(staging,'site',file.path);await mkdir(join(target,'..'),{recursive:true});const bytes=await readFile(join(dist,file.path));if(digest(bytes)!==file.sha256)throw Error('Build changed during packaging');await writeFile(target,bytes,{flag:'wx'});}
    await writeFile(join(staging,'receipt.json'),encode(receipt),{flag:'wx'});await verifyBundle(staging);
    try{await rename(staging,final);}catch(error){if(!['EEXIST','ENOTEMPTY'].includes((error as NodeJS.ErrnoException).code||''))throw error;}
    await verifyBundle(final,receipt.id);return {directory:final,receipt};
  }finally{await rm(staging,{recursive:true,force:true});}
}
