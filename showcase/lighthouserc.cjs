// Local-only collection; never uploads reports or changes a deployment.
module.exports={ci:{collect:{
  staticDistDir:'./dist',url:['http://localhost/index.html'],numberOfRuns:3,
  settings:{formFactor:'mobile',onlyCategories:['performance','accessibility'],
    screenEmulation:{mobile:true,width:390,height:844,deviceScaleFactor:1,disabled:false},
    throttlingMethod:'simulate',throttling:{rttMs:150,throughputKbps:1638.4,cpuSlowdownMultiplier:4},
    chromeFlags:'--headless --no-sandbox --disable-dev-shm-usage'},
},assert:{assertions:{
  'categories:performance':['error',{minScore:0.9,aggregationMethod:'pessimistic'}],
  'largest-contentful-paint':['error',{maxNumericValue:2500,aggregationMethod:'pessimistic'}],
  'cumulative-layout-shift':['error',{maxNumericValue:0.1,aggregationMethod:'pessimistic'}],
  'total-blocking-time':['error',{maxNumericValue:200,aggregationMethod:'pessimistic'}],
}},upload:{target:'filesystem',outputDir:'./.lighthouseci/reports'}}};
