// One-sided timber shelving for the independent shop. Stock and navigation
// remain ordinary library slots; the wall-facing half never exists.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { AisleShelvingDeps } from './shelving';
import { AISLE_SHELF_HEIGHTS, BOX_SPACING, UNIT_DEPTH, UNIT_FRAME_HEIGHT, UNIT_SIDE_CAPACITY, type ShelvingUnit } from './store-layout';

export function buildWallLibraryUnit(
  deps: AisleShelvingDeps, unit: ShelvingUnit, parent: THREE.Group,
  labelMaterial: (label: string) => THREE.Material,
): void {
  const length = (unit.cols - 1) * BOX_SPACING + 1;
  const z = deps.plan.aisleZCenter(unit), x = unit.xCenter, sign = unit.browseSign;
  const depth = UNIT_DEPTH / 2;
  const parts: THREE.BufferGeometry[] = [];
  const box = (w: number, h: number, d: number, px: number, py: number, pz: number) =>
    parts.push(new THREE.BoxGeometry(w, h, d).translate(px, py, pz));
  box(.5, UNIT_FRAME_HEIGHT, length - .04, x, UNIT_FRAME_HEIGHT / 2, z);
  for (const y of AISLE_SHELF_HEIGHTS) box(depth, .04, length, x + sign * depth / 2, y, z);
  // Front and rear uprights close the inward half only.
  for (const end of [-1, 1]) box(depth + .25, UNIT_FRAME_HEIGHT, .04,
    x + sign * (depth / 2 - .125), UNIT_FRAME_HEIGHT / 2, z + end * (length / 2 - .02));
  const merged = mergeGeometries(parts)!;
  parts.forEach(part => part.dispose());
  const mesh = new THREE.Mesh(merged, deps.materials.shelf);
  mesh.name = 'one-sided wall library';
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh); deps.addCollider(mesh);

  const block = deps.plan.blockIndexOf(unit.libraryIdx, unit.unitIdxInLibrary, 'front');
  const layout = deps.plan.layoutFor(unit.libraryIdx);
  const label = layout.sectionLabels.get(String(block)) ?? deps.libraries[unit.libraryIdx].name;
  if (layout.entries.slice(block * UNIT_SIDE_CAPACITY, (block + 1) * UNIT_SIDE_CAPACITY).some(Boolean)) {
    const card = new THREE.Mesh(new THREE.BoxGeometry(.04, .20, 1.45), [
      labelMaterial(label), labelMaterial(label),
      deps.materials.signSide, deps.materials.signSide, deps.materials.signSide, deps.materials.signSide,
    ]);
    card.position.set(x + sign * (depth + .04), 4.795, z);
    card.name = 'eye-level wall library clasp';
    parent.add(card);
  }
}
