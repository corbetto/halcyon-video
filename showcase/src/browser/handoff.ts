import {parseCatalogHandoff,serializeHandoff,catalogTitlePath,storeEntryUrl} from '../../../src/catalog-handoff';
type EventName='page_view'|'watch_options_opened'|'outbound_click'|'store_entry'|'installation_guide_visit';
const surface=/^\/title\//.test(location.pathname)?'title':location.pathname==='/store/'?'store':location.pathname==='/self-host/'?'self-host':location.pathname==='/about/'?'about':'browse';
// No collector, storage, identity, query, title or library payload. These signals
// are inert unless a separately reviewed on-page observer is installed.
function signal(event:EventName){document.dispatchEvent(new CustomEvent('halcyon:cta',{detail:{version:1,event,surface}}));}
signal('page_view');
document.querySelectorAll<HTMLDetailsElement>('.watch-options').forEach(details=>{let counted=false;details.addEventListener('toggle',()=>{if(details.open&&!counted){counted=true;signal('watch_options_opened');}});});
document.querySelectorAll<HTMLAnchorElement>('a[data-cta],.offers a').forEach(link=>link.addEventListener('click',event=>{
  if(event.defaultPrevented||event.button!==0)return;
  const name=link.dataset.cta;if(name==='store_entry'||name==='installation_guide_visit')signal(name);else signal('outbound_click');
}));
const panel=document.querySelector<HTMLElement>('[data-handoff-page]');
if(panel){
  const input=parseCatalogHandoff(location.search),value=input.kind==='valid'?input.value:null;
  const context=value?'?'+new URLSearchParams({catalog:serializeHandoff(value)}):'';
  const back=panel.querySelector<HTMLAnchorElement>('[data-context-return]');
  if(back&&value){back.href=catalogTitlePath(value);back.textContent='Return to this catalog title';
    try{if(new URL(document.referrer).href===new URL(back.href).href)back.addEventListener('click',event=>{if(event.button===0&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey){event.preventDefault();history.back();}});}catch{/* a shared/reopened link uses the canonical relative title route */}
  }
  const status=panel.querySelector('#handoff-context');
  if(status&&input.kind==='invalid')status.textContent='This title link could not be read. You can still enter the store overview or return to the catalog.';
  panel.querySelectorAll<HTMLAnchorElement>('[data-self-host]').forEach(link=>link.href='/self-host/'+context);
  panel.querySelectorAll<HTMLAnchorElement>('[data-store-bridge]').forEach(link=>link.href='/store/'+context);
  const entry=panel.querySelector<HTMLAnchorElement>('[data-store-entry]');if(entry)entry.href=storeEntryUrl(value,panel.dataset.source==='tmdb'?'tmdb':'fixture');
  const share=panel.querySelector<HTMLInputElement>('[data-share-link]'),copy=panel.querySelector<HTMLButtonElement>('[data-copy-link]');
  if(share){share.value=location.origin+'/store/'+context;share.addEventListener('focus',()=>share.select());}
  if(copy&&share){copy.hidden=false;copy.addEventListener('click',async()=>{
    const result=panel.querySelector('[data-copy-status]')!;
    try{await navigator.clipboard.writeText(share.value);result.textContent='Link copied. Open it on your other screen.';}
    catch{share.focus();share.select();result.textContent='Copy was unavailable. The link is selected so you can copy it yourself.';}
  });}
}
