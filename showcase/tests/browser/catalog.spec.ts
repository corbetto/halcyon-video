import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const pageErrors=new WeakMap<Page,string[]>();
test.beforeEach(({page})=>{const errors:string[]=[];pageErrors.set(page,errors);page.on('pageerror',error=>errors.push(error.message));});
test.afterEach(({page})=>expect(pageErrors.get(page)||[]).toEqual([]));
async function geometry(page:Page){
  const result=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,
    short:[...document.querySelectorAll<HTMLElement>('a,button,input,select,summary')].filter(el=>{
      const box=el.getBoundingClientRect();return box.width>0&&box.height>0&&getComputedStyle(el).visibility!=='hidden'&&!el.closest('[hidden]')&&(box.height<43.5||box.width<43.5);
    }).map(el=>({text:el.textContent?.trim().slice(0,60),width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height}))}));
  expect(result.overflow).toBe(false);expect(result.short).toEqual([]);
}
test('first phone view is bounded, lazy, accessible and free of 3D resources',async({page},info)=>{
  const requests:string[]=[],errors:string[]=[],failed:string[]=[];page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)failed.push(r.url()+':'+r.status());});page.on('requestfailed',r=>failed.push(r.url()));
  await page.goto('/');await expect(page.locator('#catalog-search')).toBeVisible();
  await expect(page.locator('#catalog-results>li')).toHaveCount(24);await expect(page.locator('#catalog-results>li').first()).toBeVisible();
  expect(requests.some(url=>/search\.json|manifest\.json|\.glb|\.gltf|\.hdr|\.wasm|\.mp4|\/three/.test(url))).toBe(false);
  expect(requests.every(url=>new URL(url).origin==='http://127.0.0.1:4326')).toBe(true);
  await geometry(page);expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  const sizes=await page.evaluate(()=>[...performance.getEntriesByType('navigation'),...performance.getEntriesByType('resource')].map(item=>{
    const entry=item as PerformanceResourceTiming;return {url:new URL(entry.name).pathname,transfer:entry.transferSize,encoded:entry.encodedBodySize,decoded:entry.decodedBodySize};
  }));
  expect(sizes.reduce((sum,row)=>sum+row.transfer,0)).toBeLessThanOrEqual(500*1024);
  await info.attach('initial-resource-sizes',{body:JSON.stringify({fixture:true,resources:sizes},null,2),contentType:'application/json'});
  await page.screenshot({path:info.outputPath('browse-phone.png')});expect(errors).toEqual([]);expect(failed).toEqual([]);
});
test('search, combined filters, title disclosure and Back preserve URL and place',async({page},info)=>{
  const indexes:string[]=[];page.on('request',r=>{if(r.url().endsWith('/search.json'))indexes.push(r.url());});
  await page.goto('/browse/');await page.getByLabel('Find a title').fill('quiet');await page.getByRole('button',{name:'Search',exact:true}).click();
  await expect(page.locator('#catalog-status')).toHaveText('1 title for “quiet” · page 1 of 1');
  await expect(page.locator('.card').first()).toHaveAccessibleName(/The Quiet Orbit/);
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await expect(page).toHaveURL(/\/browse\/\?q=quiet$/);expect(indexes).toHaveLength(1);
  await page.getByRole('link',{name:'Series',exact:true}).click();await expect(page).toHaveURL(/\/browse\/tv\/\?q=quiet$/);
  await page.getByText('Filter selection',{exact:true}).click();
  await page.getByRole('combobox',{name:'Genre',exact:true}).selectOption('Science Fiction');await page.getByRole('combobox',{name:'Year',exact:true}).selectOption('2004');
  await page.getByRole('combobox',{name:'Subscription service',exact:true}).selectOption('netflix');
  await expect(page.locator('#catalog-results>li')).toHaveCount(1);await expect(page).toHaveURL(/service=netflix/);
  const before=page.url();await page.locator('.card').first().click();await expect(page).toHaveURL(/\/title\/tv\/2\/$/);
  await page.getByText('Watch options',{exact:true}).click();await expect(page.getByText('External watch links are disabled',{exact:false})).toBeVisible();
  await expect(page.locator('.offers a')).toHaveCount(0);await geometry(page);
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await page.screenshot({path:info.outputPath('title-watch-phone.png')});
  await page.getByRole('link',{name:'Back to browse',exact:true}).click();await expect(page).toHaveURL(before);
  await expect(page.getByLabel('Find a title')).toHaveValue('quiet');await expect(page.locator('#catalog-results>li')).toHaveCount(1);
  await page.reload();await expect(page.locator('#catalog-results>li')).toHaveCount(1);await page.getByText('Filter selection',{exact:true}).click();await expect(page.getByRole('combobox',{name:'Year',exact:true})).toHaveValue('2004');
});
test('pagination and browser history restore actual scroll positions',async({page})=>{
  await page.goto('/browse/');await page.getByLabel('Find a title').fill('the');await page.getByRole('button',{name:'Search',exact:true}).click();
  await expect(page.locator('#catalog-status')).toContainText('for “the”');
  await page.locator('.card').nth(5).scrollIntoViewIfNeeded();const scroll=await page.evaluate(()=>scrollY);
  await page.locator('.card').nth(5).click();await expect(page).toHaveURL(/\/title\//);await page.goBack();
  await expect(page.getByLabel('Find a title')).toHaveValue('the');
  await expect.poll(()=>page.evaluate(expected=>Math.abs(scrollY-expected),scroll)).toBeLessThan(8);
  await page.goto('/browse/');await page.getByRole('link',{name:'Next page'}).click();await expect(page.locator('#catalog-results>li')).toHaveCount(4);
  await page.goBack();await expect(page.locator('#catalog-results>li')).toHaveCount(24);
});
test('empty, offline, invalid-version and retry states retain safe content',async({page},info)=>{
  await page.goto('/browse/');await page.context().setOffline(true);
  await page.getByLabel('Find a title').fill('orbit');await page.getByRole('button',{name:'Search',exact:true}).click();
  await expect(page.locator('#catalog-error')).toContainText('offline');await expect(page.locator('#catalog-results>li')).toHaveCount(24);
  await page.context().setOffline(false);await page.getByRole('button',{name:'Try search again'}).click();await expect(page.locator('#catalog-results>li')).toHaveCount(1);
  await page.getByLabel('Find a title').fill('not a listed title');await page.getByRole('button',{name:'Search',exact:true}).click();
  await expect(page.locator('#catalog-empty')).toBeVisible();await geometry(page);await page.screenshot({path:info.outputPath('empty-search-phone.png')});
  await page.getByRole('button',{name:'Clear search and filters'}).click();await expect(page.locator('#catalog-results>li')).toHaveCount(24);
  await page.route('**/data/manifest.json',async route=>{const response=await route.fetch();const data=await response.json();data.snapshotHash='b'.repeat(64);await route.fulfill({json:data});});
  await page.reload();await page.getByLabel('Find a title').fill('orbit');await page.getByRole('button',{name:'Search',exact:true}).click();
  await expect(page.locator('#catalog-error')).toContainText('Catalog changed');await expect(page.locator('#catalog-results>li')).toHaveCount(24);
});
test('without JavaScript, title reading, media navigation and pagination work',async({browser})=>{
  const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});const page=await context.newPage();
  try{await page.goto('http://127.0.0.1:4326/browse/');await expect(page.locator('#catalog-results>li')).toHaveCount(24);
    await page.getByRole('link',{name:'Series',exact:true}).click();await expect(page.locator('#catalog-results>li')).toHaveCount(14);
    await page.locator('.card').first().click();await expect(page.locator('h1')).toHaveText('Midnight Matinee');
    await page.getByText('Watch options',{exact:true}).click();await expect(page.locator('.watch-options')).toContainText('subscription or sign-in');
    await page.getByRole('link',{name:'Back to browse',exact:true}).click();await page.getByRole('link',{name:'Next page'}).click();await expect(page.locator('#catalog-results>li')).toHaveCount(4);
  }finally{await context.close();}
});
test('200 percent text and keyboard remain usable with visible focus',async({page},info)=>{
  await page.goto('/browse/');await page.evaluate(()=>document.documentElement.style.fontSize='200%');
  await page.getByText('Filter selection',{exact:true}).click();await geometry(page);
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await page.getByLabel('Find a title').focus();
  expect(await page.getByLabel('Find a title').evaluate(el=>getComputedStyle(el).outlineStyle)).not.toBe('none');
  await page.getByLabel('Find a title').fill('orbit');await page.getByLabel('Find a title').press('Enter');
  await expect(page.locator('#catalog-results>li')).toHaveCount(1);await page.screenshot({path:info.outputPath('text-200-phone.png')});
});
test('stale and expired checks are recomputed rather than promising availability',async({page})=>{
  await page.clock.setFixedTime(new Date('2026-10-08T12:00:00Z'));await page.goto('/title/movie/1/');
  await page.getByText('Watch options',{exact:true}).click();await expect(page.locator('[data-freshness]')).toHaveAttribute('data-age','expired');
  await expect(page.locator('[data-freshness]')).toContainText('current availability is unknown');
  await page.goto('/title/movie/4/');await page.getByText('Watch options',{exact:true}).click();await expect(page.locator('.watch-options')).toContainText('No recorded offers');
});
test('leaving during an index request cannot push a stale search into Back history',async({page})=>{
  let release!:()=>void;const held=new Promise<void>(resolve=>release=resolve);
  let arrived!:()=>void;const started=new Promise<void>(resolve=>arrived=resolve);
  await page.route('**/search.json',async route=>{arrived();await held;try{await route.continue();}catch{/* owner navigated away */}});
  await page.goto('/browse/');await page.getByLabel('Find a title').fill('orbit');await page.getByRole('button',{name:'Search',exact:true}).click();await started;
  await page.locator('.card').first().click();await expect(page).toHaveURL(/\/title\/movie\/1\/$/);release();
  await page.goBack();await expect(page).toHaveURL('http://127.0.0.1:4326/browse/');
  await expect(page.locator('#catalog-results>li')).toHaveCount(24);await expect(page.getByLabel('Find a title')).toHaveValue('');
});
