import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {captureCubeInSlices} from '../src/cube-capture.ts';

function fixture(parallel = true, meshCount = 3) {
  const scene = new THREE.Scene(), signal = new AbortController();
  for (let i = 0; i < meshCount; i++) scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
  const target = new THREE.WebGLCubeRenderTarget(16), original = new THREE.WebGLRenderTarget(2, 2);
  const camera = new THREE.CubeCamera(.1, 100, target);
  target.texture.generateMipmaps = true;
  let current: THREE.WebGLRenderTarget | null = original, face = 2, mip = 1;
  const events: string[] = [], batches: number[] = [];
  const renderer = {
    coordinateSystem: THREE.WebGLCoordinateSystem, autoClear: false, localClippingEnabled: false,
    shadowMap: {needsUpdate: true}, xr: {enabled: true}, info: {programs: [] as any[]},
    getContext: () => ({LINK_STATUS: 1, getExtension: () => parallel ? {COMPLETION_STATUS_KHR: 2} : null,
      isContextLost: () => false, getProgramParameter: () => {events.push('query'); return true;}}),
    getRenderTarget: () => current, getActiveCubeFace: () => face, getActiveMipmapLevel: () => mip,
    setRenderTarget: (value: THREE.WebGLRenderTarget | null, nextFace = 0, nextMip = 0) => {current = value; face = nextFace; mip = nextMip;},
    render: (value: THREE.Scene) => {
      if (value.children.length) {assert.equal(current, target); events.push(`face:${face}`);}
      else events.push('empty');
    },
    compile: (group: THREE.Group) => {
      events.push('compile'); batches.push(group.children.length);
      renderer.info.programs.push({program: {}, getUniforms: () => events.push('uniforms'), getAttributes: () => events.push('attributes')});
    },
  };
  const run = (wait: () => Promise<void>) => captureCubeInSlices(renderer as unknown as THREE.WebGLRenderer, scene, camera, wait, signal.signal);
  const restored = () => {
    assert.equal(current, original); assert.equal(face, 2); assert.equal(mip, 1);
    assert.equal(renderer.xr.enabled, true); assert.equal(renderer.autoClear, false);
    assert.equal(renderer.localClippingEnabled, false); assert.equal(renderer.shadowMap.needsUpdate, true);
    assert.equal(target.texture.generateMipmaps, true);
  };
  const dispose = () => {
    scene.traverse(object => {if (object instanceof THREE.Mesh) {object.geometry.dispose(); object.material.dispose();}});
    target.dispose(); original.dispose();
  };
  return {scene, signal, target, events, batches, renderer, run, restored, dispose};
}

test('background cube preparation retains bounded parallel batches before six complete faces', async t => {
  const f = fixture(true, 65); t.after(f.dispose);
  await f.run(async () => {});
  assert.deepEqual(f.batches, [32, 32, 1]);
  assert.deepEqual(f.events.filter(event => event.startsWith('face:')), ['face:0', 'face:1', 'face:2', 'face:3', 'face:4', 'face:5']);
  assert.equal(f.target.texture.pmremVersion, 1);
  f.restored();
});

for (const parallel of [true, false]) test(`resumed interaction pauses program queries and bindings before any cube draw (parallel=${parallel})`, async t => {
  const f = fixture(parallel); t.after(f.dispose);
  let resume!: () => void, reached!: () => void, held = true;
  const hold = new Promise<void>(resolve => {resume = resolve;});
  const blocked = new Promise<void>(resolve => {reached = resolve;});
  const work = f.run(async () => {
    if (f.batches.length && held) {reached(); await hold;}
  });
  try {
    await Promise.race([blocked, work.then(() => {throw Error('Capture never consulted the resumed interaction gate');})]);
    assert.equal(f.batches.length, 1);
    assert.equal(f.events.includes('query'), false, 'driver status must wait for the same interaction gate');
    assert.equal(f.events.includes('uniforms'), false, 'first-use bindings must not run while input owns the frame');
    assert.equal(f.events.some(event => event.startsWith('face:')), false);
    f.restored();
  } finally {held = false; resume(); await work;}
  f.restored();
});

test('stock or lighting invalidation after submission stops before driver queries and subsequent faces', async t => {
  const f = fixture(); t.after(f.dispose);
  await assert.rejects(f.run(async () => {
    if (f.batches.length) throw Error('Reflection capture invalidated');
  }), /invalidated/);
  assert.equal(f.events.includes('query'), false);
  assert.equal(f.events.includes('uniforms'), false);
  assert.equal(f.events.some(event => event.startsWith('face:')), false);
  f.restored();
});

test('cancellation is checked after a caller gate even when that callback does not throw', async t => {
  const f = fixture(); t.after(f.dispose);
  await assert.rejects(f.run(async () => {f.signal.abort();}), {name: 'AbortError'});
  assert.deepEqual(f.events, []);
  f.restored();
});

test('pre-aborted capture does no graphics work', async t => {
  const f = fixture(); t.after(f.dispose); f.signal.abort();
  await assert.rejects(f.run(async () => {}), {name: 'AbortError'});
  assert.deepEqual(f.events, []);
  f.restored();
});

test('render failure and mid-face cancellation restore every visible renderer state', async t => {
  for (const failure of ['throw', 'abort'] as const) {
    const f = fixture(); t.after(f.dispose);
    const draw = f.renderer.render;
    f.renderer.render = value => {
      draw(value);
      if (f.events.at(-1) === 'face:1') {
        if (failure === 'throw') throw Error('Synthetic draw failure');
        f.signal.abort();
      }
    };
    await assert.rejects(f.run(async () => {}), failure === 'throw' ? /Synthetic draw failure/ : {name: 'AbortError'});
    assert.deepEqual(f.events.filter(event => event.startsWith('face:')), ['face:0', 'face:1']);
    f.restored();
  }
});
