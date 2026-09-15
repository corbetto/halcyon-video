import type { Footprint } from './layout-validator';

/** Keep a shelf preview on the shelf side of the counter, with eye clearance.
 * A camera just outside the desk can still stare into the back of its monitor,
 * so check the entire sightline as well as cameras starting inside the desk.
 */
export function clearCounterVantage(
  point: { x: number; z: number }, look: { x: number; z: number }, footprints: Footprint[], padding = 0.4,
): { x: number; z: number } {
  let { x, z } = point;
  for (const f of footprints) {
    if (!f.label.includes('counter')) continue;
    const c = Math.cos(f.yaw), s = Math.sin(f.yaw);
    const lx = (look.x - f.cx) * c - (look.z - f.cz) * s;
    const lz = (look.x - f.cx) * s + (look.z - f.cz) * c;
    const dx = (x - look.x) * c - (z - look.z) * s;
    const dz = (x - look.x) * s + (z - look.z) * c;
    const hx = f.w / 2 + padding, hz = f.d / 2 + padding;
    // The selected subject itself is not a valid shelf if it is in the desk.
    if (Math.abs(lx) < hx && Math.abs(lz) < hz) continue;
    let enter = 0, exit = 1;
    for (const [start, delta, half] of [[lx, dx, hx], [lz, dz, hz]]) {
      if (Math.abs(delta) < 1e-6) {
        if (Math.abs(start) >= half) { enter = 1; exit = 0; break; }
      } else {
        const a = (-half - start) / delta, b = (half - start) / delta;
        enter = Math.max(enter, Math.min(a, b));
        exit = Math.min(exit, Math.max(a, b));
      }
    }
    if (enter > exit || enter <= 0 || enter >= 1) continue;
    const t = Math.max(0, enter - 0.01 / Math.max(0.01, Math.hypot(dx, dz)));
    x = look.x + (x - look.x) * t;
    z = look.z + (z - look.z) * t;
  }
  return { x, z };
}
