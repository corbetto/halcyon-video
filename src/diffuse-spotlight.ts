import { ShaderChunk, type SpotLight } from 'three';

let installed = false;
/**
 * WebGL's SpotLight has no per-source specular control. A negative decay is
 * our explicit diffuse-only marker; the shader still uses its absolute value
 * for the original inverse-square attenuation and shadowing. Other lights and
 * the material's environment reflections retain their normal response.
 */
export function makeSpotlightDiffuseOnly(light: SpotLight): void {
  installDiffuseSpotlights();
  light.decay = -Math.max(.0001, Math.abs(light.decay));
  light.userData.diffuseOnly = true;
}
export function installDiffuseSpotlights(): void {
  if (installed) return;
  const attenuation = 'getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay )';
  const call = 'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';
  const source = ShaderChunk.lights_fragment_begin;
  const start = source.indexOf('#if ( NUM_SPOT_LIGHTS > 0 )');
  const end = source.indexOf('#if ( NUM_DIR_LIGHTS > 0 )', start);
  if (!ShaderChunk.lights_pars_begin.includes(attenuation) || start < 0 || end < 0 ||
      !source.slice(start, end).includes(call)) throw new Error('Unsupported Three spotlight shader');
  ShaderChunk.lights_pars_begin = ShaderChunk.lights_pars_begin.replace(attenuation,
    'getDistanceAttenuation( lightDistance, spotLight.distance, abs( spotLight.decay ) )');
  const spot = source.slice(start, end).replace(call, `{
    vec3 priorSpecular = reflectedLight.directSpecular;
    #ifdef USE_CLEARCOAT
      vec3 priorClearcoat = clearcoatSpecularDirect;
    #endif
    #ifdef USE_SHEEN
      vec3 priorSheen = sheenSpecularDirect;
    #endif
    ${call}
    if ( spotLight.decay < 0.0 ) {
      reflectedLight.directSpecular = priorSpecular;
      #ifdef USE_CLEARCOAT
        clearcoatSpecularDirect = priorClearcoat;
      #endif
      #ifdef USE_SHEEN
        sheenSpecularDirect = priorSheen;
      #endif
    }
  }`);
  ShaderChunk.lights_fragment_begin = source.slice(0, start) + spot + source.slice(end);
  installed = true;
}
