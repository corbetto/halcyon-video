// Swipe resolution logic for mobile touch gestures.
// Pure math and thresholds — no DOM or Three.js dependencies.

// Below this, a touchend belongs to the existing tap-to-select raycast path
// (three-scene.ts requires dist<10 there); above it, a swipe. The gap
// between the two thresholds is a small dead zone rather than a contested one.
export const SWIPE_MIN_PX = 44;

/**
 * Resolve 2D touch delta into a discrete directional swipe action.
 * Upward swipe pulls content up (revealing content below -> 'down'),
 * Downward swipe pulls content down (revealing content above -> 'up').
 */
export function resolveSwipeDirection(dx: number, dy: number): 'left' | 'right' | 'up' | 'down' | null {
  const adx = Math.abs(dx), ady = Math.abs(dy);
  if (Math.max(adx, ady) < SWIPE_MIN_PX) return null;
  if (adx > ady) {
    return dx < 0 ? 'left' : 'right';
  } else {
    return dy < 0 ? 'down' : 'up';
  }
}
