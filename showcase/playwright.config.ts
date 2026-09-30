import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser',fullyParallel:false,workers:1,retries:0,timeout:30000,
  outputDir:'./test-results',reporter:[['list'],['json',{outputFile:'test-results/results.json'}]],
  use:{baseURL:'http://127.0.0.1:4326',viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,
    reducedMotion:'reduce',trace:'on',screenshot:'only-on-failure',launchOptions:{
      executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage'],
    }},
  webServer:{command:'npm run preview -- --host 127.0.0.1 --port 4326',url:'http://127.0.0.1:4326',reuseExistingServer:false,timeout:30000},
});
