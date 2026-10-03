import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

test('folded candy carton: exact envelope, real closures, upright UVs and cost', async () => {
  const bytes = readFileSync(new URL('../public/models/candy-carton.glb', import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  gltf.scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(gltf.scene);
  bounds.getSize(new THREE.Vector3()).toArray().forEach((v,i) => assert.ok(Math.abs(v - [.32,.42,.18][i]) < 1e-6));
  assert.ok(bounds.getCenter(new THREE.Vector3()).length() < 1e-6);
  let triangles=0, parts=0, front=0, rear=0;
  gltf.scene.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    parts++;
    const g=o.geometry, pos=g.getAttribute('position'), normal=g.getAttribute('normal'), uv=g.getAttribute('uv');
    triangles += (g.index?.count ?? pos.count)/3;
    assert.equal(o.material.name,'CandyCartonPaper');
    assert.equal(o.material.map,null);
    for (const a of [pos,normal,uv]) assert.ok([...a.array].every(Number.isFinite));
    for (let i=0;i<pos.count;i++) {
      const p=new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld);
      const n=new THREE.Vector3().fromBufferAttribute(normal,i).transformDirection(o.matrixWorld);
      assert.ok(Math.abs(n.length()-1)<1e-5);
      assert.ok(uv.getX(i)>=-1e-6 && uv.getX(i)<=1.000001 && uv.getY(i)>=-1e-6 && uv.getY(i)<=1.000001);
      if (Math.abs(p.z-.09)<1e-6 && n.z>.99) {
        front++; assert.ok(Math.abs(uv.getX(i)-(p.x/.32+.5))<1e-5);
        assert.ok(Math.abs(uv.getY(i)-(.5-p.y/.42))<1e-5);
      }
      if (Math.abs(p.z+.09)<1e-6 && n.z<-.99) {
        rear++; assert.ok(Math.abs(uv.getX(i)-(.5-p.x/.32))<1e-5);
        assert.ok(Math.abs(uv.getY(i)-(.5-p.y/.42))<1e-5);
      }
    }
  });
  assert.equal(parts,8);
  assert.ok(front>=4 && rear>=4);
  assert.ok(triangles<=200);
  assert.ok(bytes.length<35000);
});
