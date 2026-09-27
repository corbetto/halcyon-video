// Lower browsing tiers flare toward the customer independently of the upper taper.
// Reconstruction estimate: 25/18 degrees from vertical; 2.64/1.32 inch projection.
export const LOWER_SHELF_PROJECTION = .22;
export function lowerShelfProjection(y: number, heights: readonly number[]): number {
  if (y <= heights[0]) return LOWER_SHELF_PROJECTION;
  if (y >= heights[2]) return 0;
  const row = y <= heights[1] ? 0 : 1;
  const t = (y - heights[row]) / (heights[row + 1] - heights[row]);
  return LOWER_SHELF_PROJECTION * (2 - row - t) / 2;
}
export function shelfLeanAngle(row: number): number {
  return -(row === 0 ? 25 : row === 1 ? 18 : 10) * Math.PI / 180;
}
