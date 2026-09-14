/** Scale an emblem's actual outline into the masonry, keeping its mounting centre. */
export function facadeEmblemScale(points: { x: number; y: number }[], centerY: number,
  field: { baseY: number; halfWidth: number; height: number }, triangular: boolean): number {
  const fits = (scale: number) => points.every(p => {
    const y = centerY + p.y * scale;
    const half = triangular && y > field.baseY
      ? field.halfWidth * (1 - (y - field.baseY) / field.height)
      : field.halfWidth + (triangular ? 1 : 0);
    return y >= 9.25 && y <= field.baseY + field.height - .06 && Math.abs(p.x * scale) <= half - .06;
  });
  if (!points.length || fits(1)) return 1;
  let lo = 0, hi = 1;
  for (let i = 0; i < 32; i++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
  return lo;
}
