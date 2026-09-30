import {z} from 'zod';
export const metricEvents=['page_view','watch_options_opened','outbound_click','store_entry','installation_guide_visit'] as const;
export const metricSurfaces=['browse','title','store','self-host','about'] as const;
export const eventSchema=z.strictObject({version:z.literal(1),event:z.enum(metricEvents),surface:z.enum(metricSurfaces)}).superRefine((row,ctx)=>{
  const expected={watch_options_opened:'title',outbound_click:'title',store_entry:'store',installation_guide_visit:'self-host'} as const;
  if(row.event!=='page_view'&&row.surface!==expected[row.event])ctx.addIssue({code:'custom',message:'Event does not belong to this surface'});
});
export type MetricEvent=z.infer<typeof eventSchema>;
export const sourceBuckets=['direct','search','referral','unknown'] as const;
const day=z.iso.date(),count=z.number().int().min(0).max(100000);
export const fixtureRowSchema=z.strictObject({synthetic:z.literal(true),day,source:z.enum(sourceBuckets),count,event:eventSchema});
export const fixtureWeekSchema=z.strictObject({schemaVersion:z.literal(1),synthetic:z.literal(true),startDay:day,days:z.literal(7),rows:z.array(fixtureRowSchema).max(2000)}).superRefine((week,ctx)=>{
  const start=Date.parse(week.startDay+'T00:00:00Z');
  for(const row of week.rows){const delta=(Date.parse(row.day+'T00:00:00Z')-start)/86400000;if(delta<0||delta>=7)ctx.addIssue({code:'custom',message:'Row outside synthetic week'});}
});
export function parseMetricEvent(input:unknown):MetricEvent{
  const result=eventSchema.safeParse(input);if(!result.success)throw Error('Metric event rejected: unsupported fields or dimensions');return result.data;
}
