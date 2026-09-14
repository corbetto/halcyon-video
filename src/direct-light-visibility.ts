import { ShaderChunk } from 'three';

let installed = false;
/** Skip BRDF work for spot/point lights that cannot contribute to this fragment.
 * Three already uses this visibility flag for shadow sampling, but still calls
 * RE_Direct with a zero light color. The result is unchanged; the wide store's
 * many ceiling cones no longer evaluate a full BRDF outside their influence.
 */
export function installDirectLightVisibility(): void {
  if (installed) return;
  installed = true;
  ShaderChunk.lights_fragment_begin = ShaderChunk.lights_fragment_begin.split(
    '\n\t\tRE_Direct( directLight,').join('\n\t\tif ( directLight.visible ) RE_Direct( directLight,');
}
