import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { attachAmbientScreen, publishAmbientPicture, ambientReceiverInFrustum } from '../src/ambient-screen.ts';

test('a fixture borrows every program change and returns to its own material on removal', () => {
  const scene = new THREE.Scene(), original = new THREE.MeshBasicMaterial();
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.5), original); scene.add(screen);
  const remove = attachAmbientScreen(scene, screen);
  const playing = new THREE.MeshBasicMaterial(), dark = new THREE.MeshBasicMaterial();
  let disposed = 0; playing.addEventListener('dispose', () => disposed++);
  publishAmbientPicture(scene, playing); assert.equal(screen.material, playing);
  publishAmbientPicture(scene, dark); assert.equal(screen.material, dark);
  remove(); assert.equal(screen.material, original);
  publishAmbientPicture(scene, playing); assert.equal(screen.material, original);
  assert.equal(disposed, 0, 'the receiving fixture never owns the player material');
});
test('late receivers share the program, keep it visible, and stop counting after disposal', () => {
  const scene = new THREE.Scene(), picture = new THREE.MeshBasicMaterial();
  publishAmbientPicture(scene, picture);
  const original = new THREE.MeshBasicMaterial(), screen = new THREE.Mesh(new THREE.PlaneGeometry(2,1.5), original);
  screen.position.z = -4; scene.add(screen);
  const remove = attachAmbientScreen(scene, screen); assert.equal(screen.material, picture);
  const camera = new THREE.PerspectiveCamera(50,1,.1,20); camera.updateMatrixWorld();
  const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  assert.equal(ambientReceiverInFrustum(scene,frustum),true);
  publishAmbientPicture(scene,null); assert.equal(screen.material,original);
  remove(); assert.equal(ambientReceiverInFrustum(scene,frustum),false);
});
