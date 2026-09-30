// Original invented counts for arithmetic tests, never observed visitors or a forecast.
export function syntheticFirstWeek(){
  const counts=[
    [40,22,11,4,8,3,5,2],[52,20,13,8,12,4,7,1],[44,29,7,5,10,2,4,0],
    [60,32,14,9,11,3,6,2],[31,17,8,3,6,2,3,1],[74,37,18,12,13,4,8,3],[68,35,17,10,14,5,9,2],
  ];
  const rows:unknown[]=[];
  counts.forEach(([arrivals,title,watch,outbound,store,entry,selfHost,guide],index)=>{
    const day=`2026-09-${String(21+index).padStart(2,'0')}`;
    const add=(event:string,surface:string,count:number,source='unknown')=>rows.push({synthetic:true,day,source,count,event:{version:1,event,surface}});
    const direct=Math.floor(arrivals*.4),search=Math.floor(arrivals*.3),referral=Math.floor(arrivals*.2);
    for(const [source,count] of [['direct',direct],['search',search],['referral',referral],['unknown',arrivals-direct-search-referral]] as const)add('page_view','browse',count,source);
    for(const [event,surface,count] of [['page_view','title',title],['watch_options_opened','title',watch],['outbound_click','title',outbound],['page_view','store',store],['store_entry','store',entry],['page_view','self-host',selfHost],['installation_guide_visit','self-host',guide]] as const)add(event,surface,count);
  });
  return {schemaVersion:1,synthetic:true,startDay:'2026-09-21',days:7,rows};
}
