import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const hosted='https://halcyon-video.github.io/halcyon-video/';
async function geometry(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}
test.beforeEach(async({page})=>{
  await page.addInitScript(()=>{(window as any).__cta=[];document.addEventListener('halcyon:cta',event=>(window as any).__cta.push((event as CustomEvent).detail));});
});
test('optional bridge never loads the 3D graph and fictional IDs never reach the real store',async({page},info)=>{
  const external:string[]=[],errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(new URL(request.url()).origin!=='http://127.0.0.1:4326')external.push(request.url());});
  await page.route(hosted+'**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Intercepted 3D entry</title><h1>Explicit 3D entry intercepted</h1>'}));
  await page.goto('/title/movie/1/');await page.getByRole('link',{name:'Explore the 3D store',exact:true}).click();
  await expect(page).toHaveURL(/\/store\/\?catalog=v1.movie.1.US$/);await expect(page.locator('[data-store-entry]')).toHaveAttribute('href',hosted);
  await expect(page.locator('#handoff-context')).toContainText('fictional titles');expect(external).toEqual([]);
  await expect(page.locator('.store-still img')).toHaveJSProperty('complete',true);expect(await page.locator('.store-still img').evaluate((image:HTMLImageElement)=>image.naturalWidth)).toBe(960);
  const transfer=await page.evaluate(()=>[...performance.getEntriesByType('navigation'),...performance.getEntriesByType('resource')].reduce((sum,row)=>sum+(row as PerformanceResourceTiming).transferSize,0));
  expect(transfer).toBeLessThanOrEqual(500*1024);await info.attach('bridge-transfer',{body:JSON.stringify({bytes:transfer,fixture:true}),contentType:'application/json'});
  await geometry(page);expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await page.screenshot({path:info.outputPath('store-bridge-phone.png'),fullPage:true});
  await page.locator('[data-store-entry]').click();await expect(page).toHaveURL(hosted);expect(external).toEqual([hosted]);
  await page.goBack();await expect(page).toHaveURL(/catalog=v1.movie.1.US$/);expect(errors).toEqual([]);
});
test('search history and the optional title bridge return without losing filters',async({page})=>{
  await page.goto('/browse/');await page.getByLabel('Find a title').fill('quiet');await page.getByRole('button',{name:'Search',exact:true}).click();
  await expect(page.locator('#catalog-results>li')).toHaveCount(1);const browse=page.url();
  await page.locator('.card').click();await page.getByRole('link',{name:'Explore the 3D store',exact:true}).click();
  await page.getByRole('link',{name:'Return to this catalog title'}).click();await expect(page).toHaveURL(/\/title\/tv\/2\/$/);
  await page.getByRole('link',{name:'Back to browse',exact:true}).click();await expect(page).toHaveURL(browse);await expect(page.getByLabel('Find a title')).toHaveValue('quiet');
});
test('reopened, malformed, missing and TV bridge contexts remain bounded with safe fallbacks',async({page})=>{
  for(const query of ['v1.tv.1.US','v1.movie.999999999.US']){
    await page.goto('/store/?catalog='+query);await expect(page.locator('[data-store-entry]')).toHaveAttribute('href',hosted);
    await expect(page.locator('[data-context-return]')).toHaveAttribute('href',query.includes('.tv.')?'/title/tv/1/':'/title/movie/999999999/');
  }
  await page.goto('/store/?catalog=v1.movie.1.US&return=https://other.example/&token=do-not-share');
  await expect(page.locator('#handoff-context')).toContainText('could not be read');
  await expect(page.getByLabel('Link to this catalog stop')).toHaveValue('http://127.0.0.1:4326/store/');
  await expect(page.locator('[data-context-return]')).toHaveAttribute('href','/browse/');
  await page.goto('/store/?catalog=v1.tv.1.US');const shared=await page.getByLabel('Link to this catalog stop').inputValue();
  await page.goto(shared);await page.getByRole('link',{name:'Return to this catalog title'}).click();await expect(page.locator('h1')).toHaveText('Midnight Matinee');
});
test('copy failure leaves a selectable URL and private query data never enters action signals',async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.reject(Error('denied'))},configurable:true}));
  await page.goto('/store/?catalog=v1.tv.1.US');await page.getByRole('button',{name:'Copy link'}).click();
  await expect(page.locator('[data-copy-status]')).toContainText('copy it yourself');await expect(page.getByLabel('Link to this catalog stop')).toBeFocused();
  await page.goto('/title/movie/1/?q=private-search');await page.getByText('Watch options',{exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__cta.some((event:any)=>event.event==='watch_options_opened'))).toBe(true);
  const events=await page.evaluate(()=>(window as any).__cta);
  expect(events).toContainEqual({version:1,event:'watch_options_opened',surface:'title'});
  for(const event of events)expect(Object.keys(event).sort()).toEqual(['event','surface','version']);expect(JSON.stringify(events)).not.toContain('private-search');
});
test('self-hosting has no technical or network wall and stays accessible at 200 percent text',async({page},info)=>{
  const external:string[]=[],errors:string[]=[];page.on('request',r=>{if(new URL(r.url()).origin!=='http://127.0.0.1:4326')external.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/self-host/?catalog=v1.movie.1.US');await expect(page.locator('main')).toContainText('local install starts empty');
  await expect(page.locator('main')).toContainText('without a key or a media server');await expect(page.locator('input[type=password]')).toHaveCount(0);
  await page.evaluate(()=>document.documentElement.style.fontSize='200%');await geometry(page);expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await page.screenshot({path:info.outputPath('self-host-text-200-phone.png'),fullPage:true});expect(external).toEqual([]);expect(errors).toEqual([]);
});
test('no-JavaScript visitor can keep browsing or explicitly enter the existing hosted store',async({browser})=>{
  const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}}),page=await context.newPage();
  try{await page.goto('http://127.0.0.1:4326/store/?catalog=v1.movie.1.US');await expect(page.locator('[data-store-entry]')).toHaveAttribute('href',hosted);
    await page.getByRole('link',{name:'Keep browsing the catalog'}).click();await expect(page.locator('#catalog-results>li')).toHaveCount(24);
    await page.goto('http://127.0.0.1:4326/self-host/');await expect(page.getByRole('link',{name:'Open the installation guide'})).toHaveAttribute('href','https://github.com/halcyon-video/halcyon-video#quick-start');
  }finally{await context.close();}
});
