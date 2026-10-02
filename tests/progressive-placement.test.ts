import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placementBudget } from '../src/progressive-placement.ts';

test('initial placement yields at either frame budget and resumes without losing slots', () => {
  let time = 0;
  const admit = placementBudget(() => time);
  assert.equal(admit(), true);
  time = 2;
  assert.equal(admit(), false);
  let remaining = 30_000, frames = 0;
  while (remaining) {
    const next = placementBudget(() => time);
    let processed = 0;
    while (remaining && next()) { remaining--; processed++; }
    assert.ok(processed <= 96);
    assert.ok(processed > 0);
    frames++;
  }
  assert.equal(frames, Math.ceil(30_000 / 96));
});

test('initial placement deadline starts from the first admission call, not budget creation', () => {
  let time = 0;
  const admit = placementBudget(() => time, 96, 2);
  // Simulate time elapsed before the first slot is admitted
  time = 10;
  assert.equal(admit(), true); // First admission sets deadline to 10 + 2 = 12
  time = 11;
  assert.equal(admit(), true);
  time = 12;
  assert.equal(admit(), false); // Expired at deadline
});
