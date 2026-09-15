import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ShaderChunk, SpotLight } from 'three';
import { makeSpotlightDiffuseOnly, installDiffuseSpotlights } from '../src/diffuse-spotlight.ts';

test('diffuse spotlight preserves attenuation, shadows, and other light classes', () => {
  const before = ShaderChunk.lights_fragment_begin;
  const point = before.slice(before.indexOf('#if ( NUM_POINT_LIGHTS > 0 )'), before.indexOf('#if ( NUM_SPOT_LIGHTS > 0 )'));
  const light = new SpotLight(0xffb454, 2600, 0, Math.PI / 3, .6, 2);
  light.castShadow = true;
  makeSpotlightDiffuseOnly(light);
  assert.equal(light.decay, -2);
  assert.equal(light.intensity, 2600);
  assert.equal(light.distance, 0);
  assert.equal(light.castShadow, true);
  assert.ok(ShaderChunk.lights_pars_begin.includes('abs( spotLight.decay )'));
  assert.ok(ShaderChunk.lights_fragment_begin.includes(point));
  assert.ok(ShaderChunk.lights_fragment_begin.includes('clearcoatSpecularDirect = priorClearcoat'));
  const once = ShaderChunk.lights_fragment_begin;
  installDiffuseSpotlights();
  makeSpotlightDiffuseOnly(light);
  assert.equal(light.decay, -2);
  assert.equal(ShaderChunk.lights_fragment_begin, once);
});
