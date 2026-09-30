import type {BundleReceipt} from '../deployment/artifact.ts';
import {validatePolicy,type DeploymentPolicy} from '../deployment/policy.ts';
import {assessHealth} from './health.ts';
import {plannedIndexPaths,validatePreviewMetadata,type MetadataObservation} from './metadata.ts';
export function readinessReport(input:{bundle:BundleReceipt;policy:DeploymentPolicy;asOf:string;rows:MetadataObservation[];robots:string}){
  const {bundle,asOf,rows,robots}=input,policy=validatePolicy(input.policy);
  const paths=bundle.files.filter(file=>file.path.endsWith('/index.html')||file.path==='index.html').map(file=>file.path==='index.html'?'/':'/'+file.path.slice(0,-10));
  const metadata=validatePreviewMetadata(rows,paths,robots);
  const blockers=[
    {gate:'live-source-and-image-permission',owner:'devbjackson',status:'blocked',reason:'This artifact contains fictional fixtures, not an approved live catalog.'},
    {gate:'canonical-host-and-https',owner:'devbjackson',status:'blocked',reason:'No live canonical domain, DNS, TLS or redirect evidence is supplied.'},
    {gate:'physical-phones',owner:'devbjackson',status:'blocked',reason:'Incognito cellular iPhone and Android acceptance is not provided by desktop browser automation.'},
    {gate:'release-and-provider-rollback',owner:'devbjackson',status:'blocked',reason:'No owner-approved master release, live provider deployment or real rollback receipt is supplied.'},
    {gate:'public-social-card-and-sitemap',owner:'devbjackson',status:'blocked',reason:'Absolute canonical/image URLs and a public sitemap require the approved host and permitted assets.'},
    {gate:'analytics-and-field-baseline',owner:'devbjackson',status:'not-activated',reason:'No collector, real visitors, host-analytics import or field measurements are enabled.'},
    {gate:'search-console-and-outreach',owner:'devbjackson',status:'not-performed',reason:'Owner access and a separate submission/outreach decision are required; indexing is never guaranteed.'},
  ];
  return {schemaVersion:1,mode:'fixture-readiness',asOf,launchReady:false,published:false,
    sourceCommit:bundle.sourceCommit,bundleId:bundle.id,snapshot:bundle.snapshot,
    metadata,discovery:{plannedPaths:plannedIndexPaths(paths),sitemapGenerated:false,searchSubmissionPerformed:false,indexingClaimed:false},
    deployment:{networkPublishingEnabled:policy.networkPublishingEnabled,dailyRefreshEnabled:policy.dailyRefreshEnabled,canonicalHost:policy.canonicalHost,approvedRelease:policy.approvedMasterSha},
    operational:{provenance:'fixture age only; no live uptime or provider request was made',...assessHealth({asOf,checkedAt:bundle.snapshot.checkedAt,integrity:true,refresh:'unknown',site:'unknown',links:'unknown'})},
    blockers};
}
