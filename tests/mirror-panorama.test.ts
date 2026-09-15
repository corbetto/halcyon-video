import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Matrix4, Vector3 } from 'three';
import { mirrorPanoramaRotation } from '../src/mirror-panorama.ts';

test('mirror orientations look into the distant shelving field without rolling the horizon', () => {
  const direction = new Vector3(.65, -0.18, -1).normalize();
  for (const normal of [new Vector3(0, 0, 1), new Vector3(0, 0, -1), new Vector3(1, 0, 0), new Vector3(-1, 0, 0), new Vector3(1, 0, 1).normalize()]) {
    const sampling = new Matrix4().makeRotationFromEuler(mirrorPanoramaRotation(normal)).invert();
    assert.ok(normal.clone().transformDirection(sampling).distanceTo(direction) < 1e-10);
    const right = new Vector3().crossVectors(new Vector3(0, 1, 0), normal).normalize().transformDirection(sampling);
    assert.ok(Math.abs(right.y) < 1e-10, 'horizontal camera movement must not tilt the room sideways');
    assert.ok(Math.abs(right.dot(direction)) < 1e-10);
  }
});
