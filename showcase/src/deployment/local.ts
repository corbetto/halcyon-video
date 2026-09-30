// Local verification only. This module contains no provider API or credential path.
import {readFile,writeFile,mkdir,rename,rm,readdir,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {verifyBundle,digest,type BundleReceipt} from './artifact.ts';
const idPattern=/^[a-f0-9]{64}$/;
async function readLocalRecord(store:string){
  let pointer;try{pointer=JSON.parse(await readFile(join(store,'current.json'),'utf8'));}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}
  if(pointer.version!==1||pointer.environment!=='local-preview'||!idPattern.test(pointer.bundleId)||!idPattern.test(pointer.receiptId))throw Error('Invalid local preview pointer');
  const receipt=JSON.parse(await readFile(join(store,'receipts',pointer.receiptId+'.json'),'utf8'));
  if(digest(JSON.stringify(receipt))!==pointer.receiptId||receipt.bundleId!==pointer.bundleId||receipt.environment!=='local-preview')throw Error('Local deployment receipt mismatch');
  if(receipt.version!==1||receipt.state!=='prepared'||receipt.provider!=='simulation'||!/^[a-f0-9]{40}$/.test(receipt.sourceCommit)||!idPattern.test(receipt.snapshotHash))throw Error('Unexpected local receipt authority');
  return {pointer,receipt};
}
export async function readLocalCurrent(store:string){
  const record=await readLocalRecord(store);if(!record)return null;
  const {pointer,receipt}=record;
  const bundle=await verifyBundle(join(store,'bundles',pointer.bundleId),pointer.bundleId);
  if(receipt.sourceCommit!==bundle.sourceCommit||receipt.snapshotHash!==bundle.snapshot.hash)throw Error('Local receipt provenance mismatch');
  return {pointer,receipt,bundle,activation:'selected' as const};
}
export async function switchLocal(store:string,bundleId:string,operation:'promote'|'rollback',beforeSwitch?:()=>Promise<void>){
  if(!idPattern.test(bundleId)||!['promote','rollback'].includes(operation))throw Error('Invalid local promotion request');
  await mkdir(store,{recursive:true});const lock=join(store,'.promotion-lock');
  try{await mkdir(lock);}catch{throw Error('Local promotion lock unavailable; inspect the prior operation');}
  let temporary='';
  try{
    const previous=await readLocalRecord(store);
    // Ordinary promotion refuses a broken current artifact. Explicit rollback
    // may recover it, provided the pointer/receipt and the chosen target verify.
    if(operation==='promote'&&previous)await readLocalCurrent(store);
    if(operation==='rollback'&&!previous)throw Error('No local preview exists to roll back');
    const bundle=await verifyBundle(join(store,'bundles',bundleId),bundleId);
    if(previous?.pointer.bundleId===bundleId)return readLocalCurrent(store);
    const receipt={version:1,environment:'local-preview',provider:'simulation',state:'prepared',deploymentId:'local-'+bundleId,bundleId,
      sourceCommit:bundle.sourceCommit,snapshotHash:bundle.snapshot.hash,checkedAt:bundle.snapshot.checkedAt,operation,
      previousBundleId:previous?.pointer.bundleId??null,at:new Date().toISOString(),nonce:randomUUID()};
    const receiptId=digest(JSON.stringify(receipt));await mkdir(join(store,'receipts'),{recursive:true});
    await writeFile(join(store,'receipts',receiptId+'.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
    await beforeSwitch?.();
    // Recheck after the hook: a changed candidate must not replace the last good one.
    await verifyBundle(join(store,'bundles',bundleId),bundleId);
    temporary=join(store,'.current-'+randomUUID()+'.json');
    await writeFile(temporary,JSON.stringify({version:1,environment:'local-preview',bundleId,receiptId})+'\n',{flag:'wx'});
    await rename(temporary,join(store,'current.json'));
    return readLocalCurrent(store);
  }finally{if(temporary)await rm(temporary,{force:true});await rm(lock,{recursive:true});}
}
const types:Record<string,string>={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',json:'application/json',txt:'text/plain; charset=utf-8',svg:'image/svg+xml',png:'image/png',webp:'image/webp',jpg:'image/jpeg',ico:'image/x-icon',woff2:'font/woff2'};
export async function startLocalPreview(store:string){
  // Cache only already verified immutable bundles; bytes are checked again before serving.
  const receipts=new Map<string,BundleReceipt>();
  const server=createServer(async(req,res)=>{
    res.on('error',()=>{});
    try{
      if(!['GET','HEAD'].includes(req.method||'')){res.writeHead(405);res.end();return;}
      let path;try{path=decodeURIComponent(new URL(req.url||'/','http://127.0.0.1').pathname);}catch{res.writeHead(400);res.end();return;}
      if(path.includes('\\')||path.includes('\0')||path.split('/').some(p=>p==='..'||p.startsWith('.'))){res.writeHead(400);res.end();return;}
      const current=await readLocalCurrent(store);if(!current){res.writeHead(503);res.end('No verified preview');return;}
      receipts.set(current.bundle.id,current.bundle);
      const requested=path.slice(1)||'index.html',file=path.endsWith('/')?requested+'index.html':requested;
      const lookup=path==='/'?'index.html':file;
      let seal=current.bundle.files.find(row=>row.path===lookup),bundleId=current.bundle.id;
      // Keep old fingerprinted assets available to a page opened before a rollback.
      if(!seal&&/^\/(?:_astro\/|data\/[^/]+\/)/.test(path)){
        for(const id of await readdir(join(store,'bundles'))){if(!idPattern.test(id))continue;
          let old=receipts.get(id);if(!old){old=await verifyBundle(join(store,'bundles',id),id);receipts.set(id,old);}
          const candidate=old.files.find(row=>row.path===lookup);
          if(candidate){if(seal&&seal.sha256!==candidate.sha256)throw Error('Ambiguous immutable asset');seal=candidate;bundleId=id;}
        }
      }
      const status=seal?200:404;
      if(!seal){seal=current.bundle.files.find(row=>row.path==='404.html')!;bundleId=current.bundle.id;}
      const source=join(store,'bundles',bundleId,'site',seal.path);
      if(!(await lstat(source)).isFile())throw Error('Preview asset is not a regular file');
      const bytes=await readFile(source);if(digest(bytes)!==seal.sha256)throw Error('Preview asset changed');
      res.writeHead(status,{'Content-Type':types[seal.path.split('.').pop()||'']||'application/octet-stream','X-Robots-Tag':'noindex, nofollow',
        'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin',
        'Cache-Control':status===200&&/^\/(?:_astro\/|data\/[^/]+\/)/.test(path)?'public, max-age=31536000, immutable':'public, max-age=0, must-revalidate',ETag:'"'+seal.sha256+'"'});
      res.end(req.method==='HEAD'?undefined:bytes);
    }catch{if(res.destroyed)return;if(!res.headersSent)res.writeHead(503,{'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'});res.end('Preview integrity check failed');}
  });
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const address=server.address();if(!address||typeof address==='string')throw Error('Preview did not bind locally');
  return {server,url:'http://127.0.0.1:'+address.port};
}
