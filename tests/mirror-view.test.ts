import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { mirrorViewport, cropMirrorProjection, coplanarMirrorGroups } from '../src/mirror-view.ts';

test('cropping preserves pixel locations and rejects hidden geometry', () => {
  const camera = new THREE.PerspectiveCamera(60, 2, .1, 100);
  camera.position.z = 5; camera.updateMatrixWorld();
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(2, .3)); panel.updateMatrixWorld();
  const rect = mirrorViewport([panel], camera, 1024, 512, new THREE.Vector4());
  assert.ok(rect.z * rect.w < 1024 * 512 / 20);
  const original = camera.projectionMatrix.clone();
  cropMirrorProjection(camera.projectionMatrix, rect, 1024, 512);
  for (const x of [-.9, 0, .9]) for (const y of [-.1, 0, .1]) {
    const p = new THREE.Vector3(x, y, -5), a = p.clone().applyMatrix4(original), b = p.clone().applyMatrix4(camera.projectionMatrix);
    assert.ok(Math.abs((a.x+1)*512 - (rect.x+(b.x+1)*rect.z/2)) < 1e-9);
    assert.ok(Math.abs((a.y+1)*256 - (rect.y+(b.y+1)*rect.w/2)) < 1e-9);
    assert.equal(a.z, b.z);
  }
  const frustum = new THREE.Frustum().setFromProjectionMatrix(camera.projectionMatrix);
  assert.ok(frustum.containsPoint(new THREE.Vector3(0,0,-5)));
  assert.ok(!frustum.containsPoint(new THREE.Vector3(0,2,-5)));
});
test('offscreen and eye-crossing mirrors have finite conservative bounds', () => {
  const camera = new THREE.PerspectiveCamera(60, 1, .1, 100); camera.updateMatrixWorld();
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(4, 4));
  panel.position.set(0,0,-.2); panel.rotation.y = Math.PI/3; panel.updateMatrixWorld();
  const rect = mirrorViewport([panel],camera,512,512,new THREE.Vector4());
  assert.ok(rect.toArray().every(Number.isFinite)); assert.ok(rect.z > 0 && rect.w > 0);
  panel.position.set(100,0,-5);panel.rotation.y=0;panel.updateMatrixWorld();
  mirrorViewport([panel],camera,512,512,rect); assert.equal(rect.z,0);
});

test('only coplanar equally oriented panels share a reflection', () => {
  const panel = (x: number, z: number, yaw = 0) => {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(2, 1));
    r.position.set(x, 0, z); r.rotation.y = yaw; r.updateMatrixWorld(); return {r};
  };
  const a=panel(0,0), b=panel(8,0), offset=panel(0,.01), reverse=panel(0,0,Math.PI);
  const groups=coplanarMirrorGroups([a,b,offset,reverse]);
  assert.deepEqual(groups.map(g=>g.length),[2,1,1]);
  assert.deepEqual(groups[0],[a,b]);
});
