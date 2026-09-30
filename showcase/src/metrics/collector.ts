// Offline, in-memory fixture collector only. No HTTP listener or browser import.
import {fixtureWeekSchema,fixtureRowSchema,sourceBuckets,metricEvents,metricSurfaces} from './schema.ts';
export function createFixtureCollector(startDay:string){
  if(!fixtureWeekSchema.safeParse({schemaVersion:1,synthetic:true,startDay,days:7,rows:[]}).success)throw Error('Synthetic week rejected');
  const rows:unknown[]=[];
  return {
    accept(input:unknown){
      const result=fixtureRowSchema.safeParse(input);
      if(!result.success||rows.length>=2000)throw Error('Synthetic metric row rejected');
      const next={schemaVersion:1,synthetic:true,startDay,days:7,rows:[...rows,result.data]};
      if(!fixtureWeekSchema.safeParse(next).success)throw Error('Synthetic metric row rejected');
      rows.push(result.data);
    },
    report(){return summarizeWeek({schemaVersion:1,synthetic:true,startDay,days:7,rows});},
    clear(){rows.length=0;},
  };
}
export function summarizeWeek(input:unknown){
  const parsed=fixtureWeekSchema.safeParse(input);if(!parsed.success)throw Error('Synthetic weekly input rejected');
  const week=parsed.data;
  const days=Array.from({length:7},(_,i)=>{
    const day=new Date(Date.parse(week.startDay+'T00:00:00Z')+i*86400000).toISOString().slice(0,10);
    const totals=Object.fromEntries(metricEvents.flatMap(event=>metricSurfaces.map(surface=>[event+':'+surface,0])));
    const arrivals=Object.fromEntries(sourceBuckets.map(source=>[source,0]));
    for(const row of week.rows.filter(row=>row.day===day)){
      totals[row.event.event+':'+row.event.surface]+=row.count;
      if(row.event.event==='page_view'&&row.event.surface==='browse')arrivals[row.source]+=row.count;
    }
    const ratio=(numerator:number,denominator:number)=>({numerator,denominator,ratio:denominator?numerator/denominator:null,meaning:'event ratio, not unique-visitor conversion or successful outcome'});
    return {day,synthetic:true,arrivals,counts:totals,ratios:{
      browseToTitle:ratio(totals['page_view:title'],totals['page_view:browse']),
      titleToWatchOptions:ratio(totals['watch_options_opened:title'],totals['page_view:title']),
      outboundWatchOptions:ratio(totals['outbound_click:title'],totals['watch_options_opened:title']),
      storeEntry:ratio(totals['store_entry:store'],totals['page_view:store']),
      installationGuide:ratio(totals['installation_guide_visit:self-host'],totals['page_view:self-host']),
    }};
  });
  return {schemaVersion:1,synthetic:true,realVisitorsCollected:0,baselineEstablished:false,conversionTargets:null,
    provenance:'original deterministic test fixture; not traffic, users, playback, installs or field performance',days};
}
