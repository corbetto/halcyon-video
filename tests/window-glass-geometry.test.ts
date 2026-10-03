import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { windowGlassGeometry } from '../src/window-glass-geometry.ts';
test('receiving aperture removes the glass across both viewing directions and retains its surround',()=>{
  const geometry=windowGlassGeometry(9,22,2,9,{x:11.5,width:2,bottom:4.28,top:4.72});
  const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),mesh=new THREE.Mesh(geometry,material);
  mesh.updateMatrixWorld();
  for(const side of [-1,1]) {
    for(const x of [10.6,11.5,12.4]) {
      const ray=new THREE.Raycaster(new THREE.Vector3(x,4.5,side),new THREE.Vector3(0,0,-side));
      assert.equal(ray.intersectObject(mesh).length,0,'no glass seals the tape mouth');
    }
    for(const [x,y] of [[10.3,4.5],[12.7,4.5],[11.5,4.28-.2],[11.5,4.72+.2]]) {
      const ray=new THREE.Raycaster(new THREE.Vector3(x,y,side),new THREE.Vector3(0,0,-side));
      assert.ok(ray.intersectObject(mesh).length>0,'glazing remains outside the infill');
    }
  }
  geometry.dispose();material.dispose();
});

test('uninterrupted storefront glazing closes the former disconnected fast-return slot',()=>{
  const geometry=windowGlassGeometry(9,22,2,9);
  const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),mesh=new THREE.Mesh(geometry,material);
  mesh.updateMatrixWorld();
  for(const side of [-1,1]) {
    const ray=new THREE.Raycaster(new THREE.Vector3(11.5,4.5,side),new THREE.Vector3(0,0,-side));
    assert.ok(ray.intersectObject(mesh).length>0,'continuous glass occupies the former slot from both sides');
  }
  geometry.dispose();material.dispose();
});
