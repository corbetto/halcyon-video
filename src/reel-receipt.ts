export interface ReelBuildSource {revision:string|null;clean:boolean;bundled:boolean}
export interface ReelCaptureFacts {width:number;height:number;startedAt:string;wallDurationMs:number;requestedFps:number;audioTracks:number}
export function reelBuildSource():ReelBuildSource{
  return typeof __HALCYON_BUILD_SOURCE__==='undefined'?{revision:null,clean:false,bundled:false}:{...__HALCYON_BUILD_SOURCE__};
}
export function createReelReceipt(input:{filename:string;bytes:number;mime:string;capture:ReelCaptureFacts;source:ReelBuildSource;stoppedEarly:boolean}){
  const {capture,source}=input;
  // Deliberately whitelist scalar facts. Never serialize the scene, settings,
  // library, server URLs, account names, tokens, title IDs or TV program names.
  return {schemaVersion:1,kind:'halcyon-reel-capture',
    file:{name:input.filename,bytes:input.bytes,container:input.mime.includes('mp4')?'mp4':input.mime.includes('webm')?'webm':'unknown'},
    source:{revision:source.revision,clean:source.clean,bundled:source.bundled,releaseStatus:'unverified'},
    capture:{width:capture.width,height:capture.height,startedAt:capture.startedAt,wallDurationMs:capture.wallDurationMs,
      requestedFps:capture.requestedFps,audioTracks:capture.audioTracks,canvasOnly:true,stoppedEarly:input.stoppedEarly},
    requestedProfile:{quality:'high',ssao:true,reflections:'smooth',mirrors:true,pixelBudget:8294400},
    review:{humanOperation:'unverified',personalLibrary:'unverified',wholeClip:'unverified',assetClearance:'unverified',
      movieFrameScope:'overhead-tv-only-review-required',actualFrameRate:'unverified',publicationApproved:false},
    limitations:['Not an attestation of human input, asset rights or video authenticity.','Requested frame rate and quality are not measured output performance.','A reviewer must hash and inspect the exact media, confirm source and clear privacy before publication.']};
}
