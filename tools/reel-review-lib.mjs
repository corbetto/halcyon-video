import {createHash} from 'node:crypto';
export const hash=x=>createHash('sha256').update(x).digest('hex');
const keys=(value,allowed)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>allowed.includes(key));
const sha=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
export function validateReceipt(value){
  if(!keys(value,['schemaVersion','kind','file','source','capture','requestedProfile','review','limitations'])||value.schemaVersion!==1||value.kind!=='halcyon-reel-capture')throw Error('Unsupported capture receipt');
  if(!keys(value.file,['name','bytes','container'])||!/^halcyon-reel-[A-Za-z0-9_.-]+\.(mp4|webm)$/.test(value.file.name)||!Number.isSafeInteger(value.file.bytes)||value.file.bytes<=0||value.file.bytes>600*1024*1024||!['mp4','webm'].includes(value.file.container))throw Error('Invalid capture file facts');
  if(!keys(value.source,['revision','clean','bundled','releaseStatus'])||!(value.source.revision===null||sha(value.source.revision))||typeof value.source.clean!=='boolean'||typeof value.source.bundled!=='boolean'||value.source.releaseStatus!=='unverified')throw Error('Invalid source facts');
  const c=value.capture;
  if(!keys(c,['width','height','startedAt','wallDurationMs','requestedFps','audioTracks','canvasOnly','stoppedEarly'])||![c.width,c.height].every(n=>Number.isInteger(n)&&n>0&&n<=8192)||!/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(c.startedAt)||!Number.isFinite(Date.parse(c.startedAt))||!Number.isFinite(c.wallDurationMs)||c.wallDurationMs<=0||c.wallDurationMs>125000||c.requestedFps!==60||c.audioTracks!==0||c.canvasOnly!==true||typeof c.stoppedEarly!=='boolean')throw Error('Invalid capture dimensions or timeline');
  const profile={quality:'high',ssao:true,reflections:'smooth',mirrors:true,pixelBudget:8294400};
  if(JSON.stringify(value.requestedProfile)!==JSON.stringify(profile))throw Error('Unrecognized requested capture profile');
  const review={humanOperation:'unverified',personalLibrary:'unverified',wholeClip:'unverified',assetClearance:'unverified',movieFrameScope:'overhead-tv-only-review-required',actualFrameRate:'unverified',publicationApproved:false};
  if(JSON.stringify(value.review)!==JSON.stringify(review))throw Error('A capture receipt cannot grant review or publication approval');
  if(!Array.isArray(value.limitations)||value.limitations.length>4||value.limitations.some(text=>typeof text!=='string'||text.length>240))throw Error('Invalid receipt limitations');
  return value;
}
export function videoFacts(probe){
  const streams=Array.isArray(probe?.streams)?probe.streams:[],videos=streams.filter(stream=>stream.codec_type==='video');
  if(videos.length!==1)throw Error('One video stream is required');
  const video=videos[0],duration=Number(probe.format?.duration),frames=Number(video.nb_read_frames);
  if(!Number.isFinite(duration)||duration<=0||duration>125||!Number.isSafeInteger(frames)||frames<1)throw Error('Complete decoded frame count and duration are required');
  const timestamps=(probe.frames||[]).map(frame=>Number(frame.best_effort_timestamp_time));
  if(timestamps.length!==frames||timestamps.some(time=>!Number.isFinite(time)))throw Error('Frame timestamps are incomplete');
  let maxGapSeconds=0;for(let i=1;i<timestamps.length;i++){const gap=timestamps[i]-timestamps[i-1];if(gap<=0)throw Error('Frame timestamps are not strictly increasing');maxGapSeconds=Math.max(maxGapSeconds,gap);}
  return {width:video.width,height:video.height,codec:video.codec_name,pixelFormat:video.pix_fmt,sampleAspect:video.sample_aspect_ratio??'1:1',
    durationSeconds:duration,decodedFrames:frames,decodedFps:frames/duration,maxGapSeconds,audioStreams:streams.filter(stream=>stream.codec_type==='audio').length,
    otherStreams:streams.filter(stream=>!['video','audio'].includes(stream.codec_type)).length,rotation:(video.side_data_list||[]).some(data=>Number(data.rotation||0)!==0),container:String(probe.format?.format_name||'')};
}
export function assessTake(receipt,facts,{bytes,videoSha256,attestation=null,releasedRevision=null}={}){
  validateReceipt(receipt);const blockers=[];
  if(bytes!==receipt.file.bytes)blockers.push('Media bytes do not match the captured file size.');
  if(facts.width!==receipt.capture.width||facts.height!==receipt.capture.height)blockers.push('Media dimensions differ from the native canvas receipt.');
  if(facts.width<720||facts.height<1280||Math.abs(facts.width/facts.height-9/16)>.002||facts.rotation||facts.sampleAspect!=='1:1')blockers.push('A native, square-pixel portrait take of at least 720 by 1280 is required; no crop or rotation substitute.');
  if(facts.codec!=='h264'||facts.pixelFormat!=='yuv420p'||!facts.container.includes('mp4')||receipt.file.container!=='mp4')blockers.push('H.264 MP4 delivery has not been verified; no automatic transcoding is authorized.');
  if(facts.audioStreams||facts.otherStreams)blockers.push('Unexpected audio, data or attachment streams require review.');
  if(facts.decodedFps<59||facts.maxGapSeconds>1/30+.0001)blockers.push('Encoded cadence does not meet the 60 fps target tolerance; never add duplicate/interpolated frames to hide it.');
  const wall=receipt.capture.wallDurationMs/1000;
  if(Math.abs(facts.durationSeconds-wall)>Math.max(.5,wall*.1))blockers.push('Encoded and capture-wall timelines disagree.');
  if(receipt.capture.stoppedEarly)blockers.push('The take stopped on a recovery/limit boundary and needs another complete take.');
  if(!receipt.source.bundled||!receipt.source.clean||!sha(receipt.source.revision))blockers.push('A clean, committed, bundled source receipt is required.');
  const a=attestation;
  const attested=keys(a,['schemaVersion','videoSha256','reviewedBy','humanOperation','personalLibrary','wholeClip','assetClearance','maximumQuality','noFrameInterpolation','movieFrames'])&&a.schemaVersion===1&&a.videoSha256===videoSha256&&a.reviewedBy==='owner'&&
    ['humanOperation','personalLibrary','wholeClip','assetClearance','maximumQuality','noFrameInterpolation'].every(key=>a[key]===true)&&['none','overhead-tv-only'].includes(a.movieFrames);
  if(!attested)blockers.push('Owner confirmation of human operation, personal library, whole-clip/privacy/asset review, maximum quality and overhead-TV-only movie frames is missing.');
  return {mechanicalFacts:facts,blockers,reviewReady:blockers.length===0,publicationApproved:false,
    sourceLabel:sha(releasedRevision)&&receipt.source.revision===releasedRevision?'matches supplied released revision; publication still requires approval':'development or unverified preview; no released-behavior claim',
    attestation:'Supplied owner assertions are not authenticated by this tool and cannot authorize publication.'};
}
export const reviewCopy={
  hooks:[
    'Remember choosing a movie by picking up the case? Browse Halcyon Video’s shelves, read the back and head to the counter. Try the 3D store in your browser; a media server is optional. https://halcyon-video.github.io/halcyon-video/',
    'A video store for the library you already love. Halcyon can bring together Jellyfin, Plex or Emby films, RomM games and optional Steam browsing. Those integrations are choices, not a wall before the hosted store. https://halcyon-video.github.io/halcyon-video/',
    'Browse first. Choose a service at the counter. Halcyon’s streaming shelves hand off to a provider’s search or watch page; subscriptions and playback stay with that provider. https://halcyon-video.github.io/halcyon-video/'
  ],
  pitch:'Halcyon Video is an open-source, walkable video-rental store for browsing media. Visitors can try its hosted browser version without a home media server or API key. They browse shelves, inspect the front and back of a case, and use a physical-store checkout ritual before a streaming link-out. Local installations can instead connect an existing Jellyfin, Plex or Emby library, with optional RomM and Steam integrations. The store identity can be customized. This review pack is preparation for owner approval, not a publication announcement; recording provenance and any dev-only behavior must remain labelled. No claim of phone frame rate, traffic, testimonials or successful playback is made. Try it: https://halcyon-video.github.io/halcyon-video/ Source: https://github.com/halcyon-video/halcyon-video',
  features:['Hosted browser entry without media-server setup or API keys.','Case-front/back browsing and counter checkout.','Streaming link-outs; provider login/subscription may still be required.','Optional Jellyfin, Plex, Emby, RomM and Steam integrations require their appropriate local setup.','Configurable fictional store identity; private user assets must not enter public distribution.','Reel recording controls are dev-only until the owner releases the matching source.'],
  channels:[{name:'Instagram Reels / YouTube Shorts / TikTok',delivery:'manual; no connected publisher assumed'},{name:'Discord / Mastodon',delivery:'existing approved-release publisher only; availability must be checked before a new approval'},{name:'Press / creators',delivery:'manual; no contact or pitch has been sent'}],
  sequence:['Day 0: approve exact source, human take, privacy/asset review and claims; otherwise hold.','Day 1: separately approve hook 1 for one chosen manual channel.','Day 3: consider a separately approved existing-channel announcement; never reuse a rejected card.','Day 5: review responses and known defects; no invented conversion baseline.','Day 8: separately approve hook 2 with the same still-current, qualified take or a fresh one.','Day 11: owner chooses whether the factual press pitch should be sent; contacts and sending need separate approval.','Day 14: review actual evidence and decide continue, revise or stop.'],
  measurement:'Current infrastructure can confirm approved publisher delivery receipts, not site visits, case-inspection conversions, successful playback or return journeys. No analytics collector or field baseline is active. Recommendation: keep new analytics and paid advertising OFF for this review ($0 new service spend). A later analytics proposal needs explicit cost, dimensions, retention and privacy approval; repository traffic must not be presented as hosted-store traffic.'
};
const escape=text=>String(text).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function reviewHtml(report,mediaName=null){
  if(mediaName&&!/^media-[a-f0-9]{64}\.mp4$/.test(mediaName))throw Error('Unsafe review media name');
  const list=items=>'<ul>'+items.map(item=>'<li>'+escape(item)+'</li>').join('')+'</ul>';
  return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Halcyon private motion review</title><style>body{font:18px/1.5 system-ui;background:#07192f;color:#eef5ff;max-width:54rem;margin:auto;padding:1.5rem}video{display:block;max-width:100%;max-height:75vh}a{color:inherit}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><main><h1>Private motion review — not published</h1><p>'+escape(report.sourceLabel||'No qualified owner take supplied. This is finished copy preparation, not a campaign recording.')+'</p>'+list(report.blockers||[])+(mediaName?'<video controls preload="metadata" src="'+mediaName+'"></video><p><a download href="'+mediaName+'">Download the reviewed media bytes</a></p>':'<p>No playable campaign media has been created or substituted.</p>')+'<h2>Three finished hooks</h2>'+list(reviewCopy.hooks)+'<h2>Factual press pitch</h2><p>'+escape(reviewCopy.pitch)+'</p><h2>Feature sheet</h2>'+list(reviewCopy.features)+'<h2>Channels and delivery</h2>'+list(reviewCopy.channels.map(row=>row.name+': '+row.delivery))+'<h2>Two-week sequence, after approval</h2>'+list(reviewCopy.sequence)+'<h2>Honest measurement baseline</h2><p>'+escape(reviewCopy.measurement)+'</p><p>Existing approval and rejection decisions are untouched. This tool never publishes, imports a review card, changes an account or sends a pitch.</p></main></html>';
}
