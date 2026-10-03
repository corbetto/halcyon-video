import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { installTrofferModels, trofferCeilingGeometry, addTrofferApertures } from '../src/troffer-model.ts';

const loadKit = async () => {
  const bytes = readFileSync(new URL('../public/models/fluorescent-troffer.glb', import.meta.url));
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), '');
};
const flush = () => new Promise<void>(r => setImmediate(r));

test('troffer mesh has a real open cavity, folded frame, tube pair, UVs and a bounded instancing cost', async () => {
  const { scene } = await loadKit(); scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(scene);
  assert.ok(bounds.min.x >= -2.5 && bounds.max.x <= 2.5);
  assert.ok(bounds.min.z >= -1.25 && bounds.max.z <= 1.25);
  assert.ok(bounds.min.y >= -.151 && bounds.min.y < -.135);
  assert.ok(bounds.max.y > .30 && bounds.max.y < .35, 'rear pan clears existing roof underside');
  let triangles = 0;
  for (const [part, role] of [['TrofferHousing','TrofferPaint'],['TrofferHardware','TrofferHardware'],['TrofferTubes','TrofferTubeGlass']]) {
    const mesh = scene.getObjectByName(part) as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>;
    assert.ok(mesh?.isMesh); assert.equal(mesh.material.name, role); assert.equal(mesh.material.emissiveIntensity, 1);
    assert.equal(mesh.material.emissive.getHex(), 0, 'housing/tubes add no light source');
    const p = mesh.geometry.getAttribute('position'), n = mesh.geometry.getAttribute('normal'), uv = mesh.geometry.getAttribute('uv'), index = mesh.geometry.index!;
    assert.equal(p.count,n.count);assert.equal(p.count,uv.count);
    for (const attr of [p,n,uv]) assert.ok([...attr.array].every(Number.isFinite));
    for (let i=0;i<index.count;i+=3) {
      const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2);
      const area=(uv.getX(b)-uv.getX(a))*(uv.getY(c)-uv.getY(a))-(uv.getY(b)-uv.getY(a))*(uv.getX(c)-uv.getX(a));
      assert.ok(Math.abs(area)>1e-10,part+' UV triangle is not collapsed');
    }
    triangles+=index.count/3;
  }
  assert.ok(triangles<=1600); assert.ok(readFileSync(new URL('../public/models/fluorescent-troffer.glb',import.meta.url)).length<110000);
  const ray=(x:number,z:number)=>new THREE.Raycaster(new THREE.Vector3(x,-1,z),new THREE.Vector3(0,1,0)).intersectObject(scene,true);
  assert.ok(ray(0,.8)[0].point.y>.22,'open pan cavity has depth behind the lens');
  assert.ok(ray(0,1.215)[0].point.y<-.13,'folded door sits below the preserved lens at -.08');
  for(const z of [-.4284,.4284])assert.ok(Math.abs(ray(0,z)[0].point.y-.077)<.003,'tube pair follows the lens hot bands');
  assert.equal(ray(2.49,1.24).length,0,'housing clears surrounding grid module');
});

test('ceiling openings really cut through the panel and retain its normalized tile-map phase',()=>{
  const geo=trofferCeilingGeometry(20,10,[{x:-5,z:0},{x:5,z:0}]);
  const ceiling=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));ceiling.rotation.x=Math.PI/2;ceiling.updateMatrixWorld(true);
  for(const x of [-5,5])assert.equal(new THREE.Raycaster(new THREE.Vector3(x,-2,0),new THREE.Vector3(0,1,0)).intersectObject(ceiling).length,0);
  assert.ok(new THREE.Raycaster(new THREE.Vector3(0,-2,0),new THREE.Vector3(0,1,0)).intersectObject(ceiling).length);
  const p=geo.getAttribute('position'),uv=geo.getAttribute('uv');
  for(let i=0;i<p.count;i++){assert.ok(Math.abs(uv.getX(i)-(p.getX(i)/20+.5))<1e-6);assert.ok(Math.abs(uv.getY(i)-(p.getY(i)/10+.5))<1e-6);}
  const shape=new THREE.Shape();addTrofferApertures(shape,[{x:11,z:8}]);assert.equal(shape.holes.length,1);
  const points=shape.holes[0].getPoints();assert.ok(points.every(p=>Math.abs(p.x-11)<=2.426&&Math.abs(p.y-8)<=1.176));
});

test('troffer batches preserve the exact emissive lens and caller material lifetime across success and failure',async()=>{
  const original=GLTFLoader.prototype.load,descriptor=Object.getOwnPropertyDescriptor(globalThis,'window');
  Object.defineProperty(globalThis,'window',{value:{},configurable:true});
  let success:Parameters<GLTFLoader['load']>[1]=()=>{},fail:Parameters<GLTFLoader['load']>[3];
  GLTFLoader.prototype.load=function(_url,ready,_progress,error){success=ready;fail=error;};
  try{
    const parent=new THREE.Scene(),paint=new THREE.MeshStandardMaterial(),lens=new THREE.MeshStandardMaterial({emissive:0xf3f6ff,emissiveIntensity:1.2,map:new THREE.Texture()});
    lens.emissiveMap=lens.map;lens.userData.bakeEmissiveIntensity=1.55*1.56;
    let refreshes=0,borrowedDisposed=0;lens.addEventListener('dispose',()=>borrowedDisposed++);paint.addEventListener('dispose',()=>borrowedDisposed++);lens.map!.addEventListener('dispose',()=>borrowedDisposed++);
    const ctx={scene:parent,requestRender:()=>refreshes++,requestShadowRefresh:()=>refreshes++};
    const anchors=[{x:2.5,y:13.5,z:1.25},{x:7.5,y:11.5,z:6.25}];
    const failed=installTrofferModels(parent,anchors,paint,lens,ctx);fail?.(Error('offline'));
    assert.equal(failed.getObjectByName('Troffer housing fallback')!.visible,true);failed.removeFromParent();assert.equal(borrowedDisposed,0);
    const live=installTrofferModels(parent,anchors,paint,lens,ctx);success(await loadKit());await flush();
    assert.equal(live.userData.loaded,true);assert.equal(refreshes,2);assert.equal(live.getObjectByName('Troffer housing fallback')!.visible,false);
    const panels=live.getObjectByName('Prismatic troffer lenses') as THREE.InstancedMesh;
    assert.equal(panels.material,lens);assert.equal(lens.emissiveIntensity,1.2);assert.equal(lens.userData.bakeEmissiveIntensity,1.55*1.56);assert.equal(lens.map,lens.emissiveMap);
    panels.geometry.computeBoundingBox();assert.ok(panels.geometry.boundingBox!.getSize(new THREE.Vector3()).distanceTo(new THREE.Vector3(4.88,.04,2.38))<1e-5);
    const matrix=new THREE.Matrix4();panels.getMatrixAt(1,matrix);assert.ok(new THREE.Vector3().setFromMatrixPosition(matrix).distanceTo(new THREE.Vector3(7.5,11.44,6.25))<1e-5);
    const model=live.getObjectByName('Authored troffer housings')!;assert.equal(model.children.length,3);
    for(const part of model.children){assert.ok(part instanceof THREE.InstancedMesh);assert.equal(part.count,2);}
    live.removeFromParent();assert.equal(borrowedDisposed,0);
    const malformed=installTrofferModels(parent,anchors,paint,lens,ctx),bad=await loadKit();bad.scene.remove(bad.scene.getObjectByName('TrofferTubes')!);success(bad);await flush();assert.equal(malformed.getObjectByName('Troffer housing fallback')!.visible,true);malformed.removeFromParent();
    const late=installTrofferModels(parent,anchors,paint,lens,ctx),payload=await loadKit();let disposed=0;
    (payload.scene.getObjectByName('TrofferHousing') as THREE.Mesh).geometry.addEventListener('dispose',()=>disposed++);late.removeFromParent();success(payload);await flush();assert.equal(disposed,1);assert.equal(refreshes,2);
    let queued:(()=>Promise<void>)|undefined,cancelled=0;
    const waiting=installTrofferModels(parent,anchors,paint,lens,{...ctx,scheduleDetailLoad:start=>{queued=start;return()=>{cancelled++;};}});
    assert.ok(queued);waiting.removeFromParent();assert.equal(cancelled,1);await queued!();assert.equal(refreshes,2);
    const rejected=installTrofferModels(parent,anchors,paint,lens,{...ctx,prepareDetailModel:async()=>{throw Error('shader preparation failed');}});
    success(await loadKit());await flush();assert.equal(rejected.getObjectByName('Troffer housing fallback')!.visible,true);assert.equal(rejected.getObjectByName('Authored troffer housings'),undefined);rejected.removeFromParent();
    const teardown=installTrofferModels(parent,anchors,paint,lens,ctx),incoming=await loadKit();
    (teardown.getObjectByName('Prismatic troffer lenses') as THREE.Mesh).geometry.dispose();success(incoming);await flush();assert.equal(teardown.userData.loaded,undefined);assert.equal(refreshes,2);
    let prepareDone:()=>void=()=>{};const preparing=installTrofferModels(parent,anchors,paint,lens,{...ctx,prepareDetailModel:()=>new Promise<void>(r=>{prepareDone=r;})});
    success(await loadKit());assert.equal(preparing.getObjectByName('Troffer housing fallback')!.visible,true);assert.equal(preparing.getObjectByName('Authored troffer housings')!.visible,false);
    preparing.removeFromParent();prepareDone();await flush();assert.equal(refreshes,2);assert.equal(borrowedDisposed,0);
  }finally{GLTFLoader.prototype.load=original;if(descriptor)Object.defineProperty(globalThis,'window',descriptor);else Reflect.deleteProperty(globalThis,'window');}
});
