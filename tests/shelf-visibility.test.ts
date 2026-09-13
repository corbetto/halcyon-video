import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { tickShelfVisibility, disposeShelfVisibility, initializeHiddenShelfInstances } from '../src/shelf-visibility.ts';

test('visible shelf artwork survives old distance cutoffs and camera zoom', () => {
  const material = new THREE.MeshStandardMaterial();
  const front = new THREE.InstancedMesh(new THREE.BoxGeometry(), material, 1);
  const back = new THREE.InstancedMesh(new THREE.BoxGeometry(), material, 1);
  front.setMatrixAt(0, new THREE.Matrix4());
  back.setMatrixAt(0, new THREE.Matrix4());
  front.computeBoundingSphere();
  let loads = 0;
  const camera = new THREE.PerspectiveCamera(25, 16 / 9, .1, 300);
  const scene = {
    camera,
    unitSideFrontMeshMap: new Map([['0_0_front', front]]),
    unitSideBackMeshMap: new Map([['0_0_front', back]]),
    updateLOD: () => loads++, requestRender: () => {},
  };
  let time = 0;
  for (const distance of [12, 27, 29, 40, 79, 81, 100, 40, 12]) {
    camera.position.set(0, 0, distance);
    camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    const frustum = new THREE.Frustum().setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    assert.equal(frustum.intersectsObject(front), true);
    tickShelfVisibility(scene as any, time);
    assert.equal(front.material, material, 'visible covers must retain artwork');
    assert.equal(front.visible, true);
    assert.equal(back.visible, true);
    assert.equal(front.frustumCulled, true);
    assert.equal(back.frustumCulled, true);
    time += 100;
  }
  tickShelfVisibility(scene as any, time - 90);
  assert.equal(loads, 9, 'nearby artwork requests remain limited to 10Hz');
  camera.lookAt(0, 0, 200); camera.updateMatrixWorld();
  const offscreen = new THREE.Frustum().setFromProjectionMatrix(
    new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  assert.equal(offscreen.intersectsObject(front), false, 'offscreen batches still use renderer culling');
  disposeShelfVisibility(scene as any);
  tickShelfVisibility(scene as any, 0);
  assert.equal(loads, 10, 'rebuilding resets the update timer');
  front.geometry.dispose(); back.geometry.dispose(); material.dispose();
});

test('unplaced stock does not poison the bounds of partly populated shelves', () => {
  const geometry = new THREE.BoxGeometry(.6, 1, .2);
  const material = new THREE.MeshStandardMaterial();
  const mesh = new THREE.InstancedMesh(geometry, material, 3);
  initializeHiddenShelfInstances(mesh);
  mesh.computeBoundingSphere();
  assert.deepEqual(mesh.boundingSphere!.center.toArray(), [0, 0, 0]);
  assert.equal(mesh.boundingSphere!.radius, 0);
  // A real placement alongside still-unused capacity must remain finite.
  mesh.setMatrixAt(0, new THREE.Matrix4().makeTranslation(4, 3, -40));
  mesh.computeBoundingSphere();
  const sphere = mesh.boundingSphere!;
  assert.ok([...sphere.center.toArray(), sphere.radius].every(Number.isFinite));
  assert.ok(sphere.containsPoint(new THREE.Vector3(4, 3, -40)));
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 150);
  camera.position.set(4, 3, 0); camera.lookAt(4, 3, -40); camera.updateMatrixWorld();
  const frustum = new THREE.Frustum().setFromProjectionMatrix(
    new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  assert.equal(frustum.intersectsObject(mesh), true);
  geometry.dispose(); material.dispose();
});
