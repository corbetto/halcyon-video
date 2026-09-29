import type { Object3D } from 'three';
const savedLayers = new WeakMap<Object3D, number>();
/** Preserve every original layer; scene cursors use layer 1, not layer 0. */
export function hideReelObject(root: Object3D | null, hidden: boolean): void {
  root?.traverse(child => {
    if (hidden) {
      if (!savedLayers.has(child)) savedLayers.set(child, child.layers.mask);
      child.layers.disableAll();
    } else {
      const original = savedLayers.get(child);
      if (original !== undefined) child.layers.mask = original;
      savedLayers.delete(child);
    }
  });
}
