import type { BufferGeometry, Material } from 'three';

/** Coalesce contiguous draws using the same finish without touching vertices,
 * UVs, material slots or triangle order. Safe for focus variants when the caller
 * keeps the same material-sharing pattern across those variants. */
export function mergeAdjacentMaterialGroups(geometry: BufferGeometry, materials: readonly Material[]): void {
  const groups = geometry.groups;
  let write = 0;
  for (let read = 0; read < groups.length; read++) {
    const next = groups[read], previous = write ? groups[write - 1] : undefined;
    const material = materials[next.materialIndex ?? 0];
    if (previous && material && materials[previous.materialIndex ?? 0] === material &&
        previous.start + previous.count === next.start) {
      previous.count += next.count;
    } else {
      groups[write++] = next;
    }
  }
  groups.length = write;
}
