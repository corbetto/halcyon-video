import {parseCatalogHandoff} from '../../../src/catalog-handoff.ts';
export function pageMetadata(title:string,description?:string){
  const compact=(text:string)=>text.replace(/\s+/g,' ').trim();
  const heading=compact(title);if(!heading)throw Error('Page title is required');
  return {title:heading+' · Halcyon Video',description:compact(description?`${heading}. ${description}`:`${heading} Explore Halcyon’s curated movie and series catalog, with optional 3D browsing and self-hosting.`).slice(0,240),type:'website'};
}
export interface MetadataObservation {path:string;status:number;title:string;description:string;robots:string;canonical:string|null;ogTitle:string;ogDescription:string;ogType:string;ogUrl:string|null;ogImage:string|null;links:string[]}
const route=/^\/(?:about\/|store\/|self-host\/|browse\/(?:(?:movies|tv)\/)?(?:[1-9]\d*\/)?|title\/(?:movie|tv)\/[1-9]\d*\/)?$/;
export function plannedIndexPaths(paths:readonly string[]){
  if(new Set(paths).size!==paths.length||paths.some(path=>!route.test(path)))throw Error('Discovery inventory contains duplicate or unsafe routes');
  return [...paths].filter(path=>!/^\/browse\/.*\d+\/$/.test(path)).sort();
}
export function validatePreviewMetadata(rows:MetadataObservation[],expectedPaths:string[],robotsText:string){
  if(rows.length!==expectedPaths.length||new Set(rows.map(row=>row.path)).size!==rows.length||rows.some(row=>!expectedPaths.includes(row.path)))throw Error('Metadata report does not cover the exact built route inventory');
  if(!/^User-agent: \*$/m.test(robotsText)||!/^Allow: \/$/m.test(robotsText)||/^Disallow:\s*\//m.test(robotsText)||/^Sitemap:/mi.test(robotsText))throw Error('Preview robots must let supported crawlers read noindex and must not advertise a sitemap');
  const titles=new Set<string>(),descriptions=new Set<string>();
  for(const row of rows){
    if(Object.keys(row).some(key=>!['path','status','title','description','robots','canonical','ogTitle','ogDescription','ogType','ogUrl','ogImage','links'].includes(key))||!Array.isArray(row.links)||row.links.length>250)throw Error('Unexpected metadata dimensions');
    if(row.status!==200||!route.test(row.path)||row.title.length<5||row.title.length>300||row.description.length<20||row.description.length>240)throw Error('Invalid route response or page metadata');
    if(titles.has(row.title)||descriptions.has(row.description))throw Error('Duplicate page title or description');titles.add(row.title);descriptions.add(row.description);
    if(row.robots!=='noindex, nofollow'||row.canonical||row.ogUrl||row.ogImage)throw Error('Preview must not announce unapproved public canonical or image URLs');
    if(row.ogTitle!==row.title||row.ogDescription!==row.description||row.ogType!=='website')throw Error('Social text differs from this page');
    for(const raw of row.links){
      if(typeof raw!=='string'||raw.length>1024||raw.startsWith('//')||/[\\\u0000-\u001f\u007f]/.test(raw))throw Error('Ambiguous or unbounded link');
      if(raw.startsWith('#'))continue;
      const url=new URL(raw,'https://preview.invalid');
      if(url.username||url.password||!['https:'].includes(url.protocol))throw Error('Unsafe link in built page');
      if(url.origin==='https://preview.invalid'&&!expectedPaths.includes(url.pathname))throw Error('Internal link does not resolve to a built page');
      if(url.origin==='https://preview.invalid'&&url.search&&(!['/store/','/self-host/'].includes(url.pathname)||parseCatalogHandoff(url.search).kind!=='valid'))throw Error('Unreviewed query data in a static link');
      if(url.origin==='https://github.com'&&!/^\/halcyon-video\/halcyon-video(?:\/|$)/.test(url.pathname))throw Error('Unreviewed repository destination');
      if(url.origin==='https://github.com'&&url.search)throw Error('Repository links must not carry query data');
      if(url.origin==='https://halcyon-video.github.io'&&(url.pathname!=='/halcyon-video/'||url.search||url.hash))throw Error('Fixture store entry must not carry title data');
      if(url.origin!=='https://preview.invalid'&&!['https://github.com','https://halcyon-video.github.io'].includes(url.origin))throw Error('Unreviewed external destination in fixture output');
    }
  }
  return {passed:true,pages:rows.length,uniqueTitles:titles.size,uniqueDescriptions:descriptions.size,indexing:'not-requested',publicSocialCard:'blocked-pending-origin-and-permitted-title-images'};
}
