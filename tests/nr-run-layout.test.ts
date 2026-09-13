import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NR_BAY_WIDTH, fitNrRun, nrColumnX, planNrRuns, nrSlotTransform } from '../src/nr-run-layout.ts';

test('every wall builds only whole bays and never exceeds its available span', () => {
  for (let span = 0; span < 120; span += .13) {
    const r = fitNrRun(span, 0, 0, 0);
    assert.equal(r.cols % 8, 0); assert.ok(r.length <= span + 1e-8);
    assert.ok(span - r.length < NR_BAY_WIDTH + 1e-8);
  }
});
test('every bay has equal stock margins at both dividers, including the two end bays', () => {
  const r = fitNrRun(70, 0, 0, 0);
  for (let c = 0; c < r.cols; c += 8) {
    const left = -r.length / 2 + c / 8 * NR_BAY_WIDTH, right = left + NR_BAY_WIDTH;
    assert.ok(Math.abs((nrColumnX(r.length, c) - left) - (right - nrColumnX(r.length, c + 7))) < 1e-8);
  }
});
test('both side walls carry stock behind glazing and the ribbon stays contiguous', () => {
  for (const stepDepth of [0, 8]) {
    const room = { width: 80, backZ: -46, backLeftX: -11, backRightX: 50.8, stepX: stepDepth ? 43 : 50.8,
      stepDepth, sideBackZ: -14, clubhouse: true, wall: true };
    const runs = planNrRuns(room); let next = 0;
    for (const r of runs) { assert.equal(r.startCol, next); next += r.cols; }
    for (const r of [runs[0], runs[4]]) {
      assert.ok(r.cols > 0); assert.ok(r.z + r.length / 2 <= room.sideBackZ);
      assert.ok(r.z - r.length / 2 >= room.backZ);
      const a = nrSlotTransform(runs, r.startCol, 1), b = nrSlotTransform(runs, r.startCol + r.cols - 1, 1);
      assert.ok(Math.abs((a.z + b.z) / 2 - r.z) < 1e-8);
    }
  }
});

test('back-left shelf ends leave matching two-foot corner gaps without a clubhouse', () => {
  for (const width of [60, 72, 80, 96]) {
    const left = 11 - width / 2;
    const room = { width, backZ: -46, backLeftX: left + 1.7, backRightX: 11 + width / 2 - .2,
      stepX: 11 + width / 2 - .2, stepDepth: 0, sideBackZ: -14, clubhouse: false, wall: true };
    const [side, back] = planNrRuns(room);
    assert.ok(Math.abs((back.x - back.length / 2) - left - 2) < 1e-8);
    assert.ok(Math.abs((side.z - side.length / 2) - room.backZ - 2) < 1e-8);
    assert.ok(side.z + side.length / 2 <= room.sideBackZ);
  }
});
