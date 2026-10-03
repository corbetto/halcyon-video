/** Bounds in the untransformed tile, including stroke, shadow and filter extents.
 * Only deterministic painters can skip invisible copies: callbacks that consume
 * randomness or have side effects must use the unbounded nine-copy path.
 */
export interface TileStampBounds { x: number; y: number; width: number; height: number }

/** Repeat a feature across tile edges without submitting copies wholly outside
 * the canvas. Keep the original translation and painter order for gradients,
 * fractional coverage and blending. One pixel of padding preserves edge AA.
 */
export function stampTiled(
  ctx: CanvasRenderingContext2D,
  sizeX: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
  sizeY: number = sizeX,
  bounds?: TileStampBounds,
): void {
  const bounded = bounds && Number.isFinite(bounds.x) && Number.isFinite(bounds.y)
    && Number.isFinite(bounds.width) && Number.isFinite(bounds.height)
    && bounds.width >= 0 && bounds.height >= 0;
  for (let ox = -sizeX; ox <= sizeX; ox += sizeX) {
    for (let oy = -sizeY; oy <= sizeY; oy += sizeY) {
      if (bounded && (bounds.x + ox > sizeX + 1 || bounds.y + oy > sizeY + 1
        || bounds.x + bounds.width + ox < -1 || bounds.y + bounds.height + oy < -1)) continue;
      ctx.save();
      try { ctx.translate(ox, oy); draw(ctx); }
      finally { ctx.restore(); }
    }
  }
}
