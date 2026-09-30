import {ARTIFACT_VERSION,parseBrowse,browseUrl,selectTitles,sameIdentity,validatedIndex,safeReturnPath,dataAge,type BrowseState,type SearchEntry,type Identity} from '../catalog/browse';
import {posterImages} from '../catalog/presentation';

function bindPoster(image: HTMLImageElement) { image.addEventListener('error',()=>{image.hidden=true;},{once:true}); }
document.querySelectorAll<HTMLImageElement>('img[data-poster]').forEach(bindPoster);
function refreshDates() {
  document.querySelectorAll<HTMLElement>('[data-freshness]').forEach(node=>{
    const age=dataAge(node.dataset.checked||'');
    node.dataset.age=age;
    node.textContent=age==='expired'?'The check is at least seven days old or unavailable. Recheck externally; current availability is unknown.':
      age==='stale'?'The check is over 48 hours old. Availability may have changed.':'The check is recent, but availability may still have changed.';
  });
  document.querySelectorAll<HTMLElement>('[data-offer][data-link-kind="verified-provider"]').forEach(node=>{
    if(dataAge(node.dataset.checked||'')!=='expired')return;
    const link=node.querySelector('a');if(!link)return;
    const note=document.createElement('span');note.className='fixture-link';note.textContent='This provider link is no longer current. Recheck availability externally.';link.replaceWith(note);
  });
}
refreshDates();document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshDates();});
const back=document.querySelector<HTMLAnchorElement>('[data-browse-return]');
if(back){
  const ref=safeReturnPath(document.referrer,location.origin);
  if(ref){back.href=ref;back.addEventListener('click',event=>{if(!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&event.button===0&&history.length>1){event.preventDefault();history.back();}});}
}

const catalog=document.querySelector<HTMLElement>('[data-catalog]');
if(catalog){
  const form=document.querySelector<HTMLFormElement>('#catalog-search')!;
  const list=document.querySelector<HTMLUListElement>('#catalog-results')!;
  const status=document.querySelector<HTMLElement>('#catalog-status')!;
  const errorBox=document.querySelector<HTMLElement>('#catalog-error')!;
  const pagination=document.querySelector<HTMLElement>('#catalog-pagination')!;
  const empty=document.querySelector<HTMLElement>('#catalog-empty')!;
  const expected:Identity={schemaVersion:1,artifactVersion:ARTIFACT_VERSION,snapshotVersion:catalog.dataset.version!,snapshotHash:catalog.dataset.hash!,region:'US',checkedAt:catalog.dataset.checked!};
  let state=parseBrowse(new URL(location.href)),index:SearchEntry[]|null=null,inflight:Promise<SearchEntry[]>|null=null,generation=0,restoring=false;
  const requests=new Set<AbortController>();
  const field=(name:string)=>form.elements.namedItem(name) as HTMLInputElement|HTMLSelectElement;
  function syncForm(){for(const key of ['q','genre','year','service'] as const)field(key).value=state[key];
    catalog!.querySelectorAll<HTMLAnchorElement>('[data-kind]').forEach(link=>{if(link.dataset.kind===state.kind)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
  }
  function saveScroll(){if(!restoring)try{history.replaceState({...history.state,catalogScroll:scrollY},'',location.href);}catch{/* storage restrictions leave ordinary navigation usable */}}
  history.scrollRestoration='manual';
  let scrollFrame=0;
  addEventListener('scroll',()=>{if(!scrollFrame)scrollFrame=requestAnimationFrame(()=>{scrollFrame=0;saveScroll();});},{passive:true});
  addEventListener('pagehide',()=>{saveScroll();generation++;requests.forEach(controller=>controller.abort());});
  async function json(path:string):Promise<unknown>{
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
    requests.add(controller);
    try{const response=await fetch(path,{signal:controller.signal,credentials:'omit',cache:'no-cache'});
      if(!response.ok)throw Error('Search is temporarily unavailable. You can still browse the titles below.');
      if(Number(response.headers.get('content-length'))>2*1024*1024)throw Error('The search response is too large.');
      const text=await response.text();if(text.length>2*1024*1024)throw Error('The search response is too large.');
      try{return JSON.parse(text);}catch{throw Error('The search response could not be read. Try again or browse the titles below.');}
    }catch(error){if(error instanceof Error&&(error.name==='AbortError'||error instanceof TypeError))throw Error('Search could not connect. Try again or browse the titles below.');throw error;}
    finally{clearTimeout(timeout);requests.delete(controller);}
  }
  async function obtain(){
    if(index)return index;
    if(!inflight)inflight=(async()=>{
      const manifest=await json('/data/manifest.json');
      if(!sameIdentity(manifest,expected))throw Error('Catalog changed. Reload this page to use the current selection.');
      const current=manifest as Identity&{search:string;count:number};
      if(current.search!==catalog!.dataset.index||current.count!==Number(catalog!.dataset.count)||!/^\/data\/[a-z0-9-]+\/search\.json$/.test(current.search))throw Error('The catalog index does not match this page.');
      index=validatedIndex(await json(current.search),expected,current.count);return index;
    })().finally(()=>{inflight=null;});
    return inflight;
  }
  function card(title:SearchEntry,i:number){
    const li=document.createElement('li'),link=document.createElement('a');link.className='card';link.href=title.path;link.dataset.titleKey=title.key;
    const poster=document.createElement('div');poster.className='poster';poster.setAttribute('aria-hidden','true');
    const fallback=document.createElement('div');fallback.className='poster-fallback';
    const brand=document.createElement('b');brand.textContent='HALCYON';const missing=document.createElement('span');missing.textContent='Artwork unavailable';fallback.append(brand,missing);poster.append(fallback);
    const image=posterImages(title.posterPath,catalog!.dataset.source==='tmdb'?'tmdb':'fixture');
    if(image){const img=document.createElement('img');img.src=image.src;img.srcset=image.srcset;img.sizes='(max-width: 639px) calc((100vw - 48px) / 2), 180px';img.width=300;img.height=450;img.alt='';img.loading=i<2?'eager':'lazy';img.decoding='async';bindPoster(img);poster.append(img);}
    const heading=document.createElement('h2');heading.textContent=title.title;const meta=document.createElement('p');meta.className='meta';meta.textContent=`${title.mediaType==='tv'?'Series':'Movie'} · ${title.year??'Year unknown'}`;
    link.append(poster,heading,meta);li.append(link);return li;
  }
  async function apply(next:BrowseState,mode:'push'|'replace'|'none',restore?:number){
    const ticket=++generation;saveScroll();state=next;syncForm();errorBox.hidden=true;
    if(!index)status.textContent='Loading the small search index…';
    form.setAttribute('aria-busy','true');
    try{
      const entries=await obtain();if(ticket!==generation)return;
      const result=selectTitles(entries,state);state.page=result.page;restoring=true;
      if(mode==='push')history.pushState({catalogScroll:0},'',browseUrl(state));
      if(mode==='replace')history.replaceState({...history.state},'',browseUrl(state));
      list.replaceChildren(...result.titles.map(card));empty.hidden=result.count!==0;pagination.replaceChildren();
      const pageLink=(label:string,page:number)=>{const link=document.createElement('a');link.textContent=label;link.href=browseUrl({...state,page});link.addEventListener('click',event=>{if(event.ctrlKey||event.metaKey||event.shiftKey||event.button!==0)return;event.preventDefault();void apply({...state,page},'push',catalog!.offsetTop);});pagination.append(link);};
      if(result.page>1)pageLink('Previous page',result.page-1);
      const pageNumber=document.createElement('span');pageNumber.textContent=`Page ${result.page} of ${result.pages}`;pagination.append(pageNumber);
      if(result.page<result.pages)pageLink('Next page',result.page+1);
      pagination.hidden=result.count===0;
      status.textContent=`${result.count} ${result.count===1?'title':'titles'}${state.q?' for “'+state.q+'”':''} · page ${result.page} of ${result.pages}`;
      requestAnimationFrame(()=>{if(ticket!==generation)return;restoring=false;if(restore!==undefined)scrollTo({top:restore,behavior:'instant'});saveScroll();});
    }catch(error){if(ticket!==generation)return;restoring=false;
      errorBox.querySelector('p')!.textContent=navigator.onLine?(error instanceof Error?error.message:'Search is unavailable. Try again.'):"You are offline. Search needs its index; the page's original titles remain available.";
      errorBox.hidden=false;status.textContent='Showing the titles already on this page.';
    }finally{if(ticket===generation)form.removeAttribute('aria-busy');}
  }
  const fromForm=()=>({...state,q:field('q').value.trim().slice(0,120),genre:field('genre').value,year:field('year').value,service:field('service').value,page:1});
  form.addEventListener('submit',event=>{event.preventDefault();void apply(fromForm(),'push');});
  form.addEventListener('change',event=>{if(event.target instanceof HTMLSelectElement)void apply(fromForm(),'push');});
  const reset=()=>void apply({q:'',kind:state.kind,genre:'',year:'',service:'',page:1},'push');
  form.addEventListener('reset',event=>{event.preventDefault();reset();});
  document.querySelector('#catalog-clear')!.addEventListener('click',reset);
  document.querySelector('#catalog-retry')!.addEventListener('click',()=>void apply(fromForm(),'push'));
  catalog.querySelectorAll<HTMLAnchorElement>('[data-kind]').forEach(link=>link.addEventListener('click',event=>{
    if(event.ctrlKey||event.metaKey||event.shiftKey||event.button!==0)return;event.preventDefault();void apply({...fromForm(),kind:link.dataset.kind as BrowseState['kind']},'push');
  }));
  addEventListener('popstate',event=>void apply(parseBrowse(new URL(location.href)),'none',Number(event.state?.catalogScroll)||0));
  addEventListener('pageshow',event=>{if(event.persisted){state=parseBrowse(new URL(location.href));syncForm();restoring=false;form.removeAttribute('aria-busy');
    if(!index&&location.search)void apply(state,'none',Number(history.state?.catalogScroll)||0);
    else requestAnimationFrame(()=>scrollTo({top:Number(history.state?.catalogScroll)||0,behavior:'instant'}));
  }});
  syncForm();(document.querySelector('#catalog-controls') as HTMLFieldSetElement).disabled=false;
  if(location.search)void apply(state,'replace',Number(history.state?.catalogScroll)||0);
}
