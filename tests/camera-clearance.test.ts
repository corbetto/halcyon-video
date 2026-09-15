import test from 'node:test';
import assert from 'node:assert/strict';
import { clearCounterVantage } from '../src/camera-clearance.ts';
import { terminalPictureDistance } from '../src/counter-terminal.ts';
const counter = { label: 'structure:checkout-counter', kind: 'structure' as const, cx: 0, cz: 0, w: 6, d: 3, yaw: 0 };
test('preview inside the desk moves onto the selected shelf side with clearance', () => {
  const p = clearCounterVantage({ x: 0, z: 0.5 }, { x: 0, z: -8 }, [counter]);
  assert.equal(p.x, 0); assert.ok(p.z < -1.9);
});
test('counter clearance follows rotated counter footprints', () => {
  const p = clearCounterVantage({ x: 0, z: 0 }, { x: -8, z: 0 }, [{ ...counter, yaw: Math.PI / 2 }]);
  assert.ok(p.x < -1.9); assert.ok(Math.abs(p.z) < 1e-6);
});
test('safe vantages remain fixed and unrelated footprints do not move the camera', () => {
  const p = { x: 5, z: -4 };
  assert.deepEqual(clearCounterVantage(p, { x: 0, z: -8 }, [counter]), p);
  assert.deepEqual(clearCounterVantage({ x: 0, z: 0 }, { x: 0, z: -8 }, [{ ...counter, label: 'structure:vestibule' }]), { x: 0, z: 0 });
});
test('actual terminal dimensions fit portrait and rotated phone viewports', () => {
  for (const aspect of [390 / 844, 844 / 390, 360 / 740]) {
    for (const [width, height] of [[1.4, 1.05], [1.8, 1.1]]) {
      const distance = terminalPictureDistance(width, height, aspect, 60);
      const span = 2 * distance * Math.tan(Math.PI / 6);
      assert.ok(width <= span * aspect * 0.9 + 1e-9);
      assert.ok(height <= span * 0.76 + 1e-9);
    }
  }
});
test('a camera beyond the desk moves to the shelf side instead of looking through its monitor', () => {
  const p = clearCounterVantage({ x: 0, z: 5 }, { x: 0, z: -8 }, [counter]);
  assert.equal(p.x, 0); assert.ok(p.z < -1.9);
});
