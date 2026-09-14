import type { WebGLRenderTarget } from 'three';
import type { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/** These targets only receive fullscreen quads; they never test scene depth.
 * Keep HDR colour, dimensions, filtering and all effect settings unchanged.
 * Call before first render: changing attachments on a live target needs disposal.
 */
export function omitPostprocessDepth(target: WebGLRenderTarget): void {
  target.depthBuffer = false;
  target.stencilBuffer = false;
}

export function omitBloomDepth(pass: UnrealBloomPass): void {
  omitPostprocessDepth(pass.renderTargetBright);
  pass.renderTargetsHorizontal.forEach(omitPostprocessDepth);
  pass.renderTargetsVertical.forEach(omitPostprocessDepth);
}
