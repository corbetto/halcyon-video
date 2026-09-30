import type {StoreScene} from './three-scene';
import {parseCatalogHandoff,resolveCatalogMovie,canonicalCatalogReturn,type CatalogHandoff} from './catalog-handoff';
import {BACK_WALL_UNIT_IDX} from './store-layout';
let handled=false;
/** Called once at the existing scene-ready boundary; never stocks or enables a service. */
export function initCatalogHandoff(scene:StoreScene,setupPending:boolean):boolean{
  const input=parseCatalogHandoff(location.search);if(input.kind==='absent')return false;
  if(handled)return true;handled=true;
  const value:CatalogHandoff|null=input.kind==='valid'?input.value:null;
  let message='This catalog link could not be read. You can explore the store’s starting view instead.';
  if(setupPending)message='Your local store starts empty. Choose services or connect your library at the setup terminal; this link changes no settings.';
  else{
    scene.enterOverview();
    if(value){
      const slots=[...scene.slotsByPosition.values()].filter(slot=>!slot.hidden&&slot.unitIdx<BACK_WALL_UNIT_IDX);
      const selection=resolveCatalogMovie(value,slots.map(slot=>slot.movie));
      if(selection.kind==='unsupported')message='Series links are not supported by this store handoff yet. The starting view is open; return to the catalog for this series.';
      else if(selection.kind==='missing')message='That exact movie is not on these shelves. The starting view is open; no substitute was selected.';
      else{
        const selected=scene.jumpToTitle(selection.movie.id)&&scene.getSelectedMovie();
        if(selected&&!selected.isSeries&&!selected.game&&selected.tmdbId===value.tmdbId)
          message='The matching movie is open. Watch options still use the store’s normal service choice and checkout; this link does not start playback.';
        else{scene.enterOverview();message='That exact movie could not be selected. The starting view is open; no substitute was selected.';}
      }
    }
  }
  const notice=document.createElement('section');notice.id='catalog-handoff-notice';notice.setAttribute('aria-label','Catalog handoff');
  notice.style.cssText='position:fixed;z-index:10000;bottom:1rem;left:1rem;right:1rem;max-width:38rem;max-height:35vh;overflow:auto;padding:1rem;background:#07192f;color:#eef5ff;border:1px solid #99cdff;font:16px/1.45 Arial,sans-serif;box-sizing:border-box';
  const text=document.createElement('p');text.setAttribute('role','status');text.textContent=message;text.style.margin='0 0 .6rem';notice.append(text);
  const returnUrl=canonicalCatalogReturn(import.meta.env.VITE_SHOWCASE_ORIGIN,value);
  if(returnUrl){const link=document.createElement('a');link.href=returnUrl;link.textContent='Return to the catalog';link.style.cssText='display:inline-flex;align-items:center;min-height:44px;color:inherit;margin-right:1rem';notice.append(link);}
  else{const help=document.createElement('p');help.textContent='The catalog return address is not configured for this preview. Use your browser’s Back button to return.';help.style.margin='.4rem 0';notice.append(help);}
  const close=document.createElement('button');close.type='button';close.textContent='Continue in the store';close.style.cssText='min-height:44px;padding:.5rem .75rem;font:inherit;background:#dcecff;color:#092541;border:1px solid #dcecff';
  close.addEventListener('click',()=>notice.remove());notice.append(close);document.body.append(notice);
  return true;
}
