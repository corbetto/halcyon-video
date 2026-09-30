// Recommendations only: this module cannot contact a service or roll one back.
import {z} from 'zod';
export interface HealthInput {asOf:string;checkedAt:string;integrity:boolean;refresh:'passed'|'failed'|'unknown';site:'up'|'down'|'unknown';links:'passed'|'failed'|'unknown'}
export function assessHealth(input:HealthInput){
  const now=Date.parse(input.asOf),checked=Date.parse(input.checkedAt);
  if(!z.iso.datetime().safeParse(input.asOf).success||!z.iso.datetime().safeParse(input.checkedAt).success||!Number.isFinite(now)||!Number.isFinite(checked)||checked>now)throw Error('Invalid health observation time');
  if(!['passed','failed','unknown'].includes(input.refresh)||!['up','down','unknown'].includes(input.site)||!['passed','failed','unknown'].includes(input.links)||typeof input.integrity!=='boolean')throw Error('Invalid health observation');
  const ageHours=(now-checked)/3600000,alerts:{severity:'critical'|'warning'|'unobserved';reason:string;action:string}[]=[];
  if(!input.integrity)alerts.push({severity:'critical',reason:'Artifact integrity failed',action:'Stop promotion; owner verifies and manually restores a complete known-good deployment'});
  if(input.site==='down')alerts.push({severity:'critical',reason:'Observed public route failure',action:'Owner investigates; retain receipt and consider verified whole-deployment rollback'});
  if(input.refresh==='failed')alerts.push({severity:'warning',reason:'Refresh failed',action:'Retain last-good deployment and original checkedAt; do not replace missing offers'});
  if(input.links==='failed')alerts.push({severity:'warning',reason:'Sampled provider handoff failed',action:'Remove affirmative availability claim for affected evidence and investigate, never substitute a guessed provider URL'});
  if(ageHours>=168)alerts.push({severity:'critical',reason:'Availability check expired',action:'Suppress affirmative provider links; require an external recheck'});
  else if(ageHours>=48)alerts.push({severity:'warning',reason:'Availability check is stale',action:'Show stale status and investigate refresh without advancing checkedAt'});
  if([input.refresh,input.site,input.links].includes('unknown'))alerts.push({severity:'unobserved',reason:'Some operational checks were not performed',action:'Assign owner-operated checks after source and host authorization'});
  return {ageHours,alerts,automaticAction:false,decisionOwner:'devbjackson'};
}
