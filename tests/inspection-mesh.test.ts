import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createInspectionMesh, createInspectionProgramProbe, setInspectionGeometry, disposeInspectionMesh} from '../src/inspection-mesh.ts';

test('inspection uses one identity instance and borrows the exact materials and geometry', () => {
  const geometry = new THREE.BoxGeometry(1, 2, .2), materials = [new THREE.MeshPhysicalMaterial()];
  const mesh = createInspectionMesh(geometry, materials), matrix = new THREE.Matrix4();
  mesh.getMatrixAt(0, matrix);
  assert.deepEqual(matrix.elements, new THREE.Matrix4().elements);
  assert.equal(mesh.count, 1); assert.equal(mesh.instanceColor, null);
  assert.equal(mesh.geometry, geometry); assert.equal(mesh.material, materials);
  assert.equal(mesh.frustumCulled, true);
  disposeInspectionMesh(mesh); geometry.dispose(); materials.forEach(material => material.dispose());
});

test('object pose and bounds match an ordinary case, including nonuniform dimensions', () => {
  const geometry = new THREE.BoxGeometry(1, 2, .2), material = new THREE.MeshBasicMaterial();
  const mesh = createInspectionMesh(geometry, material), ordinary = new THREE.Mesh(geometry, material);
  for (const object of [mesh, ordinary]) {
    object.position.set(5, 3, -2); object.rotation.set(.1, .6, -.2); object.scale.set(.7, 1.2, 1);
    object.updateMatrixWorld(true);
  }
  mesh.computeBoundingBox();
  const actual = mesh.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
  const expected = new THREE.Box3().setFromObject(ordinary);
  assert.ok(actual.min.distanceTo(expected.min) < 1e-10);
  assert.ok(actual.max.distanceTo(expected.max) < 1e-10);
  const ray = new THREE.Raycaster(new THREE.Vector3(5, 3, 8), new THREE.Vector3(0, 0, -1));
  const instancedHit = ray.intersectObject(mesh)[0], ordinaryHit = ray.intersectObject(ordinary)[0];
  assert.ok(instancedHit && ordinaryHit);
  assert.ok(instancedHit.point.distanceTo(ordinaryHit.point) < 1e-10);
  assert.ok(instancedHit.uv!.distanceTo(ordinaryHit.uv!) < 1e-10);
  assert.equal(instancedHit.face?.materialIndex, ordinaryHit.face?.materialIndex);
  disposeInspectionMesh(mesh); geometry.dispose(); material.dispose();
});

test('a game or series geometry swap invalidates cached bounds and raycasts the new shape', () => {
  const small = new THREE.BoxGeometry(1, 1, .2), wide = new THREE.BoxGeometry(4, 2, .2);
  const material = new THREE.MeshBasicMaterial(), mesh = createInspectionMesh(small, material);
  mesh.updateMatrixWorld(true); mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  const ray = new THREE.Raycaster(new THREE.Vector3(1.5, 0, 4), new THREE.Vector3(0, 0, -1));
  assert.equal(ray.intersectObject(mesh).length, 0);
  setInspectionGeometry(mesh, wide);
  assert.equal(mesh.boundingBox, null); assert.equal(mesh.boundingSphere, null);
  const hits = ray.intersectObject(mesh);
  assert.ok(hits.length > 0); assert.equal(hits[0].instanceId, 0);
  const sphere = mesh.boundingSphere;
  setInspectionGeometry(mesh, wide);
  assert.equal(mesh.boundingSphere, sphere, 'unchanged geometry keeps its valid cached bound');
  disposeInspectionMesh(mesh); small.dispose(); wide.dispose(); material.dispose();
});

test('teardown releases instance resources without disposing shared case assets', () => {
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshPhysicalMaterial();
  const mesh = createInspectionMesh(geometry, material); let instances = 0, assets = 0;
  mesh.addEventListener('dispose', () => {instances++;});
  geometry.addEventListener('dispose', () => {assets++;}); material.addEventListener('dispose', () => {assets++;});
  disposeInspectionMesh(mesh); disposeInspectionMesh(null); disposeInspectionMesh(new THREE.Mesh(geometry, material));
  assert.equal(instances, 1); assert.equal(assets, 0);
  geometry.dispose(); material.dispose();
});

test('preparation matches hero instancing and decorated materials without a visible instance', () => {
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshPhysicalMaterial();
  material.customProgramCacheKey = () => 'room-decoration';
  const materials = [material], probe = createInspectionProgramProbe(geometry, materials);
  const hero = createInspectionMesh(geometry, materials);
  assert.equal(probe.isInstancedMesh, hero.isInstancedMesh);
  assert.equal(probe.count, 0); assert.equal(hero.count, 1);
  assert.equal(probe.instanceColor, hero.instanceColor);
  assert.equal(probe.material, materials); assert.equal(probe.geometry, geometry);
  assert.equal(material.customProgramCacheKey(), 'room-decoration');
  assert.equal(probe.parent, null, 'probe creation never mutates the live tree');
  let assets = 0;
  geometry.addEventListener('dispose', () => { assets++; });
  material.addEventListener('dispose', () => { assets++; });
  disposeInspectionMesh(probe); assert.equal(assets, 0);
  assert.equal(hero.count, 1); assert.equal(hero.material, materials);
  disposeInspectionMesh(hero); geometry.dispose(); material.dispose();
});
