import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSwipeDirection, SWIPE_MIN_PX } from '../src/swipe-direction.ts';

test('resolveSwipeDirection ignores movements smaller than SWIPE_MIN_PX', () => {
  assert.equal(resolveSwipeDirection(0, 0), null);
  assert.equal(resolveSwipeDirection(SWIPE_MIN_PX - 1, 0), null);
  assert.equal(resolveSwipeDirection(0, -(SWIPE_MIN_PX - 1)), null);
  assert.equal(resolveSwipeDirection(20, 20), null);
});

test('resolveSwipeDirection resolves horizontal swipes correctly', () => {
  assert.equal(resolveSwipeDirection(-50, 10), 'left');
  assert.equal(resolveSwipeDirection(50, -10), 'right');
});

test('resolveSwipeDirection resolves vertical swipes with natural direction', () => {
  // Upward swipe (finger moving up, dy < 0) pulls content up, scrolling down to lower shelf
  assert.equal(resolveSwipeDirection(5, -60), 'down');

  // Downward swipe (finger moving down, dy > 0) pulls content down, scrolling up to higher shelf
  assert.equal(resolveSwipeDirection(-5, 60), 'up');
});
