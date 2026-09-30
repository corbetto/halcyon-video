import {test,expect} from '@playwright/test';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {digest} from '../../src/deployment/artifact';
import {validatePreviewMetadata,type MetadataObservation} from '../../src/readiness/metadata';
import {parseMetricEvent} from '../../src/metrics/schema';
test.describe('prerendered discovery',()=>{
test.use({javaScriptEnabled:false});
test('all built pages have unique safe metadata and a closed preview discovery boundary',async({page},info)=>{
  test.setTimeout(60000);
  async function walk(root:string):Promise<string[]>{const paths:string[]=[];for(const name of await readdir(root,{withFileTypes:true})){const path=join(root,name.name).replaceAll('\\','/');if(name.isDirectory())paths.push(...await walk(path));else paths.push(path);}return paths;}
  const files=(await walk('dist')).filter(path=>path.endsWith('.html')&&!path.endsWith('404.html')).sort();
  const htmlFiles=[];for(const file of files)htmlFiles.push({path:file.slice(5),sha256:digest(await readFile(file))});
  const rows:MetadataObservation[]=[],network:string[]=[];page.on('request',request=>network.push(request.url()));
  for(const file of files){
    const path=file==='dist/index.html'?'/':'/'+file.slice(5,-10),response=await page.goto(path);
    const row=await page.evaluate(()=>{
      const meta=(selector:string)=>document.querySelector<HTMLMetaElement>(selector)?.content||'';
      return {title:document.title,description:meta('meta[name="description"]'),robots:meta('meta[name="robots"]'),canonical:document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.getAttribute('href')||null,
        ogTitle:meta('meta[property="og:title"]'),ogDescription:meta('meta[property="og:description"]'),ogType:meta('meta[property="og:type"]'),ogUrl:meta('meta[property="og:url"]')||null,ogImage:meta('meta[property="og:image"]')||null,
        links:[...document.querySelectorAll<HTMLAnchorElement>('a[href]')].map(link=>link.getAttribute('href')!)};
    });
    rows.push({path,status:response?.status()||0,...row});
    expect(await page.locator('meta[property="og:title"]').count()).toBe(1);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  }
  for(const file of htmlFiles)expect(digest(await readFile(join('dist',file.path)))).toBe(file.sha256);
  const robots=await readFile('dist/robots.txt','utf8'),result=validatePreviewMetadata(rows,rows.map(row=>row.path),robots);
  expect(network.every(url=>new URL(url).origin==='http://127.0.0.1:4326')).toBe(true);
  await page.goto('/browse/?q=private-search&service=netflix');await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content','noindex, nofollow');
  await expect(page.locator('link[rel="canonical"],meta[property="og:url"],meta[property="og:image"]')).toHaveCount(0);
  expect(await page.title()).not.toContain('private-search');
  await mkdir('input/readiness',{recursive:true});
  await writeFile('input/readiness/metadata.json',JSON.stringify({version:1,htmlFiles,robotsHash:digest(robots),rows,result},null,2)+'\n');
  await info.attach('metadata-validation',{body:JSON.stringify(result),contentType:'application/json'});
});
});
test('existing inert signals fit the privacy contract without collection, cookies or search leakage',async({page})=>{
  const requests:{url:string;method:string;type:string}[]=[];page.on('request',request=>requests.push({url:request.url(),method:request.method(),type:request.resourceType()}));
  await page.addInitScript(()=>{(window as any).__localSignals=[];document.addEventListener('halcyon:cta',event=>(window as any).__localSignals.push((event as CustomEvent).detail));});
  await page.goto('/title/movie/1/?q=private-search&token=never-record');await page.getByText('Watch options',{exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__localSignals.length)).toBe(2);
  const events=await page.evaluate(()=>(window as any).__localSignals);for(const event of events)expect(parseMetricEvent(event)).toEqual(event);
  expect(JSON.stringify(events)).not.toMatch(/private-search|never-record|movie|tmdbId/);
  for(const [path,selector,name] of [['/store/','[data-store-entry]','store_entry'],['/self-host/','a[data-cta]','installation_guide_visit']]){
    await page.goto(path);const link=page.locator(selector).first();await link.evaluate(element=>element.addEventListener('click',event=>event.preventDefault()));
    await link.click();const clicks=await page.evaluate(()=>(window as any).__localSignals);for(const event of clicks)expect(parseMetricEvent(event)).toEqual(event);
    expect(clicks.some((event:any)=>event.event===name)).toBe(true);
  }
  expect(await page.context().cookies()).toEqual([]);
  expect(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length}))).toEqual({local:0,session:0});
  expect(requests.every(request=>request.method==='GET'&&new URL(request.url).origin==='http://127.0.0.1:4326'&&(request.type==='document'||new URL(request.url).pathname.startsWith('/_astro/')))).toBe(true);
});
