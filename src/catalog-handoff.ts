// Public, dependency-free v1 contract shared by the flat catalog and 3D store.
// Provider IDs are Halcyon's stable service IDs, not credentials or provider URLs.
export const CATALOG_PROVIDER_IDS=['netflix','prime','disney','hulu','max','appletv','paramount','peacock'] as const;
export interface CatalogHandoff {version:1;mediaType:'movie'|'tv';tmdbId:number;region:'US';providers?:string[]}
export type HandoffInput={kind:'absent'}|{kind:'invalid'}|{kind:'valid';value:CatalogHandoff};
export const HOSTED_STORE_URL='https://halcyon-video.github.io/halcyon-video/';
export function parseHandoffValue(raw:string):CatalogHandoff|null{
  if(raw.length>192)return null;
  const match=/^v1\.(movie|tv)\.([1-9]\d{0,15})\.US(?:\.([a-z,]+))?$/.exec(raw);
  if(!match)return null;
  const tmdbId=Number(match[2]);if(!Number.isSafeInteger(tmdbId))return null;
  const providers=match[3]?.split(',');
  if(providers&&(providers.length>8||new Set(providers).size!==providers.length||providers.some(id=>!CATALOG_PROVIDER_IDS.some(allowed=>allowed===id))))return null;
  return {version:1,mediaType:match[1] as 'movie'|'tv',tmdbId,region:'US',...(providers?{providers}: {})};
}
export function parseCatalogHandoff(search:string):HandoffInput{
  const params=new URLSearchParams(search);
  if(!params.has('catalog'))return {kind:'absent'};
  if(search.length>256||params.getAll('catalog').length!==1||[...params.keys()].some(key=>key!=='catalog'))return {kind:'invalid'};
  const value=parseHandoffValue(params.get('catalog')||'');return value?{kind:'valid',value}:{kind:'invalid'};
}
export function serializeHandoff(value:CatalogHandoff):string{
  const raw=`v${value.version}.${value.mediaType}.${value.tmdbId}.${value.region}${value.providers?.length?'.'+[...value.providers].sort().join(','):''}`;
  if(!parseHandoffValue(raw)||Object.keys(value).some(key=>!['version','mediaType','tmdbId','region','providers'].includes(key)))throw Error('Invalid catalog handoff');
  return raw;
}
export function catalogTitlePath(value:CatalogHandoff){return `/title/${value.mediaType}/${value.tmdbId}/`;}
export function storeEntryUrl(value:CatalogHandoff|null,source:'fixture'|'tmdb'){
  // Synthetic IDs can collide with real TMDB IDs. Never send them to real stock.
  return source==='tmdb'&&value?HOSTED_STORE_URL+'?'+new URLSearchParams({catalog:serializeHandoff(value)}):HOSTED_STORE_URL;
}
export function canonicalCatalogReturn(origin:unknown,value:CatalogHandoff|null):string|null{
  if(typeof origin!=='string'||!origin)return null;
  try{const url=new URL(origin);if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)return null;
    return new URL(value?catalogTitlePath(value):'/browse/',url).href;
  }catch{return null;}
}
export interface HandoffMovie {id:string;tmdbId?:number;isSeries?:boolean;game?:boolean}
export function resolveCatalogMovie(value:CatalogHandoff,movies:readonly HandoffMovie[]){
  if(value.mediaType==='tv')return {kind:'unsupported' as const};
  const matches=movies.filter(movie=>!movie.isSeries&&!movie.game&&movie.tmdbId===value.tmdbId);
  if(!matches.length)return {kind:'missing' as const};
  // A duplicated provider/server ID could make the legacy ID selector ambiguous.
  const match=matches.find(movie=>movies.every(other=>other.id!==movie.id||(!other.isSeries&&!other.game&&other.tmdbId===value.tmdbId)));
  return match?{kind:'match' as const,movie:match}:{kind:'missing' as const};
}
