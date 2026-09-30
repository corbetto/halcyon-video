import type { CatalogTitle,Snapshot } from './schema.ts';
import {dataAge} from './browse.ts';
export function posterImages(path: string|null,source: Snapshot['source']) {
  // Fictional IDs/paths must never accidentally fetch real third-party artwork.
  if(source!=='tmdb'||!path||!/^\/[A-Za-z0-9_-]+\.(jpg|png|webp)$/.test(path))return null;
  return {src:`https://image.tmdb.org/t/p/w342${path}`,srcset:[185,342,500].map(size=>`https://image.tmdb.org/t/p/w${size}${path} ${size}w`).join(', ')};
}
export function watchRows(title: CatalogTitle,source: Snapshot['source'],now=Date.now()) {
  const seen=new Set<string>();
  return title.offers.filter(offer=>{const key=[offer.serviceId,offer.type,offer.link.url].join(':');if(seen.has(key))return false;seen.add(key);return true;}).map(offer=>({
    serviceId:offer.serviceId,type:offer.type,checkedAt:offer.checkedAt,age:dataAge(offer.checkedAt,now),
    kind:offer.link.kind,url:source==='fixture'?null:offer.link.kind==='verified-provider'&&dataAge(offer.checkedAt,now)==='expired'?null:offer.link.url,
    label:offer.link.kind==='verified-provider'?'Visit verified provider link':'Check watch options on TMDB',
  }));
}
