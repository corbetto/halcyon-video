import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mobileFlickTarget } from '../src/mobile-flick.ts';

const face = [0, 1, 2].flatMap(unitIdx => [0, 1, 2].flatMap(shelfIdx =>
  [0, 1, 2, 3].map(col => ({ unitIdx, shelfIdx, col }))));
const slot = (unitIdx: number, col: number, shelfIdx = 1) =>
  face.find(s => s.unitIdx === unitIdx && s.col === col && s.shelfIdx === shelfIdx)!;

test('horizontal settling stays in later units and crosses boundaries in both directions', () => {
  assert.equal(mobileFlickTarget(face, slot(1, 1), 1, 0), slot(1, 2));
  assert.equal(mobileFlickTarget(face, slot(1, 3), 1, 0), slot(2, 0));
  assert.equal(mobileFlickTarget(face, slot(1, 0), -1, 0), slot(0, 3));
  assert.equal(mobileFlickTarget(face, slot(0, 3), 3, 0), slot(1, 2));
});

test('back-face units follow their reversed physical order', () => {
  assert.equal(mobileFlickTarget(face, slot(1, 3), 1, 0, true), slot(0, 0));
  assert.equal(mobileFlickTarget(face, slot(1, 0), -1, 0, true), slot(2, 3));
});

test('vertical settling keeps the current unit and column', () => {
  assert.equal(mobileFlickTarget(face, slot(2, 2), 0, 1), slot(2, 2, 2));
  assert.equal(mobileFlickTarget(face, slot(1, 2), 0, -1), slot(1, 2, 0));
});

test('run and fixture boundaries clamp without wrapping to another face', () => {
  assert.equal(mobileFlickTarget(face, slot(2, 3), 3, 0), slot(2, 3));
  assert.equal(mobileFlickTarget(face, slot(0, 0), -3, 0), slot(0, 0));
  const fixture = face.filter(s => s.unitIdx === 1);
  assert.equal(mobileFlickTarget(fixture, slot(1, 3), 1, 0), slot(1, 3));
  assert.equal(mobileFlickTarget(face, slot(2, 2, 2), 0, 2), slot(2, 2, 2));
});

test('sparse stock and shuffled insertion order retain the same visible reading order', () => {
  const sparse = face.filter(s => s !== slot(1, 0)).reverse();
  assert.equal(mobileFlickTarget(sparse, slot(0, 3), 1, 0), slot(1, 1));
  assert.equal(mobileFlickTarget([slot(1, 2)], slot(1, 2), 3, 0), slot(1, 2));
  assert.equal(mobileFlickTarget([], slot(1, 2), 1, 0), undefined);
});
