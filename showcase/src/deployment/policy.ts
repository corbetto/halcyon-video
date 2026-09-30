export interface DeploymentPolicy {
  schemaVersion:1;project:'halcyon-showcase';networkPublishingEnabled:false;
  canonicalHost:string|null;cloudflareAccountId:string|null;cloudflareProjectName:string|null;
  sourcePermissionReference:string|null;approvedMasterSha:string|null;
  monthlyHostingCeilingUsd:5;previewProtection:'unconfigured'|'owner-approved';dailyRefreshEnabled:false;
}
export function validatePolicy(value:unknown):DeploymentPolicy {
  if(!value||typeof value!=='object')throw Error('Deployment policy is missing');
  const row=value as DeploymentPolicy;
  if(row.schemaVersion!==1||row.project!=='halcyon-showcase'||row.networkPublishingEnabled!==false||row.dailyRefreshEnabled!==false||row.monthlyHostingCeilingUsd!==5)
    throw Error('Network publishing and scheduled refresh are not activated by this foundation');
  for(const key of ['canonicalHost','cloudflareAccountId','cloudflareProjectName','sourcePermissionReference','approvedMasterSha'] as const)
    if(row[key]!==null&&(typeof row[key]!=='string'||!row[key].trim()))throw Error('Invalid deployment decision record');
  if(row.canonicalHost&&!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(row.canonicalHost))throw Error('Canonical host must be a recorded hostname, not a URL');
  if(row.approvedMasterSha&&!/^[a-f0-9]{40}$/.test(row.approvedMasterSha))throw Error('Approved release requires a full source SHA');
  if(!['unconfigured','owner-approved'].includes(row.previewProtection))throw Error('Preview protection must be explicit');
  return row;
}
export function deploymentDecision(policy:DeploymentPolicy,target:string,sourceSha:string){
  validatePolicy(policy);
  if(!/^[a-f0-9]{40}$/.test(sourceSha))return {allowed:false,publishes:false,reasons:['A full verified source commit is required.']};
  if(target==='local-preview')return {allowed:true,publishes:false,reasons:['Loopback fixture simulation only. No hosting API is enabled.']};
  const reasons=['Network publishing is not activated.'];
  if(!policy.sourcePermissionReference)reasons.push('Project-specific source and image permission is unresolved.');
  if(!policy.canonicalHost)reasons.push('The owner has not recorded the canonical owned host.');
  if(!policy.cloudflareAccountId||!policy.cloudflareProjectName)reasons.push('The intended Cloudflare account and project are not recorded.');
  if(target==='cloud-preview'&&policy.previewProtection!=='owner-approved')reasons.push('Preview access protection needs an owner decision; noindex is not authentication.');
  if(target==='production'||target==='data-refresh'){
    if(policy.approvedMasterSha!==sourceSha)reasons.push('Production and refresh require the exact owner-approved master SHA, not dev.');
    if(target==='data-refresh')reasons.push('Daily refresh is disabled.');
  }
  return {allowed:false,publishes:false,reasons};
}
