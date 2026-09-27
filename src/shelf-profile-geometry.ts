import * as THREE from 'three';

/** Closed panel with real vertices at each change in the shelf profile.
 * Depth is X, height Y (centred), thickness Z, matching the shelf kit. */
export function shelfProfilePanel(height: number, levels: readonly number[],
  left: (y: number) => number, right: (y: number) => number, thickness: number): THREE.BufferGeometry {
  const ys = [...new Set([0, ...levels.filter(y => y > 0 && y < height), height])].sort((a, b) => a - b);
  const shape = new THREE.Shape();
  shape.moveTo(left(0), -height / 2);
  for (const y of ys) shape.lineTo(right(y), y - height / 2);
  for (const y of [...ys].reverse()) shape.lineTo(left(y), y - height / 2);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, steps: 1 })
    .translate(0, 0, -thickness / 2);
}
