// Browser-safe catalog behavior. No schema validator, store graph or provider client.
export const PAGE_SIZE = 24;
export const ARTIFACT_VERSION = 2;
export const SERVICE_IDS = ['netflix','prime','disney','hulu','max','appletv','paramount','peacock'] as const;
export interface SearchEntry { key: string; title: string; mediaType: 'movie'|'tv'; year: number|null; genres: string[]; path: string; services: string[]; posterPath: string|null; }
export interface BrowseState { q: string; kind: 'all'|'movie'|'tv'; genre: string; year: string; service: string; page: number; }
export interface Identity { schemaVersion: number; artifactVersion?: number; snapshotVersion: string; snapshotHash: string; region: string; checkedAt: string; }
const clean = (value: string|null, max=120) => (value || '').trim().slice(0,max);
export const fold = (value: string) => value.normalize('NFKD').replace(/\p{Mark}/gu,'').toLowerCase();
export function parseBrowse(url: URL): BrowseState {
  const path = url.pathname.match(/^\/browse\/(movies\/|tv\/)?(?:(\d+)\/)?$/);
  const year=clean(url.searchParams.get('year')),service=clean(url.searchParams.get('service'));
  return {q:clean(url.searchParams.get('q')),kind:path?.[1]==='movies/'?'movie':path?.[1]==='tv/'?'tv':'all',
    genre:clean(url.searchParams.get('genre')),year:/^\d{4}$/.test(year)&&Number(year)>=1800&&Number(year)<=2200?year:'',
    service:SERVICE_IDS.includes(service as typeof SERVICE_IDS[number])?service:'',
    page:Math.max(1,Math.min(80,Number.parseInt(url.searchParams.get('page')||path?.[2]||'1',10)||1))};
}
export function browseBase(kind: BrowseState['kind']) { return kind==='movie'?'/browse/movies/':kind==='tv'?'/browse/tv/':'/browse/'; }
export function browseUrl(state: BrowseState): string {
  const query=new URLSearchParams();
  for(const key of ['q','genre','year','service'] as const)if(state[key])query.set(key,state[key]);
  if(state.page>1)query.set('page',String(state.page));
  return browseBase(state.kind)+(query.size?'?'+query.toString():'');
}
export function selectTitles(titles: SearchEntry[],state: BrowseState) {
  const words=fold(state.q).split(/\s+/).filter(Boolean);
  const matches=titles.filter(title=>(state.kind==='all'||title.mediaType===state.kind)&&
    (!state.genre||title.genres.includes(state.genre))&&(!state.year||String(title.year)===state.year)&&
    (!state.service||title.services.includes(state.service))&&words.every(word=>fold(title.title).includes(word)));
  const pages=Math.max(1,Math.ceil(matches.length/PAGE_SIZE)),page=Math.min(state.page,pages);
  return {titles:matches.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE),count:matches.length,pages,page};
}
export function sameIdentity(value: unknown,expected: Identity): boolean {
  if(!value||typeof value!=='object')return false;
  const row=value as Record<string,unknown>;
  return (['schemaVersion','artifactVersion','snapshotVersion','snapshotHash','region','checkedAt'] as const).every(key=>row[key]===expected[key]);
}
export function validatedIndex(value: unknown,expected: Identity,count: number): SearchEntry[] {
  if(expected.artifactVersion!==ARTIFACT_VERSION)throw Error('The search format is not supported.');
  if(!sameIdentity(value,expected))throw Error('Catalog changed. Reload this page to use the current selection.');
  const titles=(value as {titles?:unknown}).titles;
  if(!Array.isArray(titles)||titles.length!==count||titles.length>1920)throw Error('The search index is incomplete.');
  const seen=new Set<string>();
  for(const title of titles){
    if(!title||typeof title!=='object'||!['movie','tv'].includes(title.mediaType)||
      typeof title.key!=='string'||!/^(movie|tv):[1-9]\d*$/.test(title.key)||title.key.split(':')[0]!==title.mediaType||
      !Number.isSafeInteger(Number(title.key.split(':')[1]))||
      title.path!==`/title/${title.mediaType}/${title.key.split(':')[1]}/`||seen.has(title.key)||
      typeof title.title!=='string'||!title.title.trim()||title.title.length>4000||
      (title.year!==null&&(!Number.isInteger(title.year)||title.year<1800||title.year>2200))||
      !Array.isArray(title.genres)||title.genres.length>30||title.genres.some((g: unknown)=>typeof g!=='string'||g.length>4000)||
      !Array.isArray(title.services)||title.services.length>8||title.services.some((s: unknown)=>!SERVICE_IDS.includes(s as typeof SERVICE_IDS[number])))
      throw Error('The search index is invalid.');
    if(title.posterPath!==null&&(typeof title.posterPath!=='string'||!/^\/[A-Za-z0-9_-]+\.(jpg|png|webp)$/.test(title.posterPath)))throw Error('The poster path is invalid.');
    seen.add(title.key);
  }
  return titles;
}
export function safeReturnPath(value: string|null,origin: string): string|null {
  if(!value)return null;
  try{const url=new URL(value,origin);return url.origin===origin&&/^\/(?:browse\/(?:movies\/|tv\/)?(?:\d+\/)?)?$/.test(url.pathname)?url.pathname+url.search:null;}catch{return null;}
}
export function dataAge(checkedAt: string,now=Date.now()): 'fresh'|'stale'|'expired' {
  const age=now-Date.parse(checkedAt);
  return !Number.isFinite(age)||age<0||age>=7*86400000?'expired':age>=48*3600000?'stale':'fresh';
}
