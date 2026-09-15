import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MirrorRenderTarget } from '../src/mirror-render-target.ts';

function rig() {
  let current: THREE.WebGLRenderTarget | null = null;
  const selected: THREE.WebGLRenderTarget[] = [], copies: unknown[] = [];
  const renderer = {
    xr: { enabled: true }, shadowMap: { autoUpdate: true },
    getRenderTarget: () => current,
    setRenderTarget: (target: THREE.WebGLRenderTarget | null) => { current = target; if (target) selected.push(target); },
    initRenderTarget: () => {},
    render: (mesh: THREE.Mesh) => copies.push([(mesh.material as THREE.ShaderMaterial).uniforms.source.value, current?.texture]),
  } as unknown as THREE.WebGLRenderer;
  return { renderer, selected, copies };
}
test('serial mirrors retain their own HDR colour with one unchanged four-sample workspace', () => {
  const pool=new MirrorRenderTarget(), r=rig(), scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera();
  const targets=Array.from({length:11},()=>new THREE.WebGLRenderTarget(1024,576,{samples:4,type:THREE.HalfFloatType}));
  for(const target of targets) pool.render(r.renderer,target,renderer=>{
    renderer.setRenderTarget(target);
    assert.equal(renderer.getRenderTarget()?.samples,4);
    assert.equal(renderer.getRenderTarget()?.depthBuffer,true);
    renderer.setRenderTarget(null);
  },scene,camera);
  assert.equal(new Set(r.selected.filter(t=>t.samples===4)).size,1);
  assert.equal(r.copies.length,11);
  assert.equal(new Set(r.copies.map((c:any)=>c[1])).size,11);
  assert.ok(targets.every(t=>t.samples===0&&!t.depthBuffer&&t.texture.type===THREE.HalfFloatType));
  assert.equal(r.renderer.getRenderTarget(),null);
  let released=0;r.selected[0].addEventListener('dispose',()=>released++);
  pool.dispose();pool.dispose();assert.equal(released,1);
  targets.forEach(t=>t.dispose());
});
test('a skipped facing-away mirror never copies another mirror into itself', () => {
  const pool=new MirrorRenderTarget(),r=rig(),target=new THREE.WebGLRenderTarget(64,64,{samples:4});
  pool.render(r.renderer,target,()=>{},new THREE.Scene(),new THREE.PerspectiveCamera());
  assert.equal(r.copies.length,0);pool.dispose();target.dispose();
});
test('resize follows the mirror aspect ratio and exceptions restore renderer state', () => {
  const pool=new MirrorRenderTarget(),r=rig(),target=new THREE.WebGLRenderTarget(64,128,{samples:4});
  const previous=new THREE.WebGLRenderTarget(8,8);r.renderer.setRenderTarget(previous);
  const draw=(renderer:THREE.WebGLRenderer)=>{renderer.setRenderTarget(target);assert.equal(renderer.getRenderTarget()?.height,target.height);renderer.xr.enabled=false;renderer.shadowMap.autoUpdate=false;throw Error('draw failed');};
  assert.throws(()=>pool.render(r.renderer,target,draw,new THREE.Scene(),new THREE.PerspectiveCamera()),/draw failed/);
  assert.equal(r.renderer.getRenderTarget(),previous);
  assert.equal(r.renderer.xr.enabled,true);assert.equal(r.renderer.shadowMap.autoUpdate,true);
  assert.equal(r.copies.length,0);
  target.setSize(128,64);
  assert.throws(()=>pool.render(r.renderer,target,draw,new THREE.Scene(),new THREE.PerspectiveCamera()),/draw failed/);
  pool.dispose();target.dispose();previous.dispose();
});
test('cropped render failures restore projection, viewport and renderer state', () => {
  const pool=new MirrorRenderTarget(),r=rig(),target=new THREE.WebGLRenderTarget(512,512,{samples:4});
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(60,1,.1,100);
  camera.position.z=5;camera.updateMatrixWorld();
  const panel=new THREE.Mesh(new THREE.PlaneGeometry(2,.3));panel.updateMatrixWorld();
  const projection=camera.projectionMatrix.clone(),inverse=camera.projectionMatrixInverse.clone();
  const previous=new THREE.WebGLRenderTarget(8,8);r.renderer.setRenderTarget(previous);
  r.renderer.render=()=>{
    const scratch=r.renderer.getRenderTarget()!;
    assert.ok(scratch.scissorTest);
    assert.ok(scratch.viewport.w<512/4);
    assert.notDeepEqual(camera.projectionMatrix.elements,projection.elements);
    throw Error('cropped draw failed');
  };
  assert.throws(()=>pool.render(r.renderer,target,renderer=>{
    renderer.setRenderTarget(target);renderer.render(scene,camera);
  },scene,camera,[panel]),/cropped draw failed/);
  assert.deepEqual(camera.projectionMatrix.elements,projection.elements);
  assert.deepEqual(camera.projectionMatrixInverse.elements,inverse.elements);
  assert.equal(r.renderer.getRenderTarget(),previous);
  assert.equal(target.scissorTest,false);
  assert.ok(r.selected.filter(t=>t.samples===4).every(t=>!t.scissorTest&&t.viewport.w===512));
  pool.dispose();panel.geometry.dispose();target.dispose();previous.dispose();
});
