import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { omitBloomDepth, omitPostprocessDepth } from '../src/postprocess-memory.ts';

test('bloom keeps HDR colour and the exact mip resolutions without unused depth allocations', () => {
  const bloom = new UnrealBloomPass(new THREE.Vector2(1280,720),.14,.4,2);
  const targets = [bloom.renderTargetBright,...bloom.renderTargetsHorizontal,...bloom.renderTargetsVertical];
  const before = targets.map(t => [t.width,t.height,t.texture.type,t.texture.format]);
  omitBloomDepth(bloom);
  assert.equal(targets.length,11);
  assert.deepEqual(targets.map(t => [t.width,t.height,t.texture.type,t.texture.format]),before);
  assert.ok(targets.every(t => !t.depthBuffer && !t.stencilBuffer));
  bloom.setSize(720,1280);
  assert.ok(targets.every(t => !t.depthBuffer));
  bloom.dispose();
});
test('a fullscreen target retains its colour attachment', () => {
  const t = new THREE.WebGLRenderTarget(128,256,{type:THREE.HalfFloatType});
  const texture=t.texture;
  omitPostprocessDepth(t);
  assert.equal(t.texture,texture); assert.equal(t.texture.type,THREE.HalfFloatType);
  assert.equal(t.depthBuffer,false);
  t.dispose();
});
