import type { InstancedMesh } from 'three';
import type { StoreScene } from './three-scene';

/** Hide unplaced instances with a valid affine zero-scale transform. */
export function initializeHiddenShelfInstances(mesh: InstancedMesh): void {
  const matrices = mesh.instanceMatrix.array;
  matrices.fill(0);
  // An all-zero 4x4 matrix has w=0: bounding-sphere transforms divide by
  // zero and poison the whole batch with NaN. Zero scale still needs w=1.
  for (let offset = 15; offset < matrices.length; offset += 16) matrices[offset] = 1;
}

const nextUpdates = new WeakMap<StoreScene, number>();

/** Keep artwork on resident shelf batches; the renderer culls offscreen bounds. */
export function tickShelfVisibility(scene: StoreScene, time: number): void {
  if (time < (nextUpdates.get(scene) ?? 0)) return;
  nextUpdates.set(scene, time + 100);
  let changed = false;
  for (const [key, front] of scene.unitSideFrontMeshMap) {
    // Wall and display stock is bounded separately.
    if (key.startsWith('fixture_') || key.startsWith('back_wall')) continue;
    // Distance alone cannot tell whether a cover is still readable, especially
    // in long aisles or a narrow field of view. Resident poster arrays already
    // have mipmaps: keep the real materials and let sampling choose their detail.
    front.frustumCulled = true;
    changed = !front.visible || changed;
    front.visible = true;
    const back = scene.unitSideBackMeshMap.get(key);
    if (back) {
      back.frustumCulled = true;
      changed = !back.visible || changed;
      back.visible = true;
    }
  }
  // Throttle nearby cover promotion while retaining already uploaded artwork.
  scene.updateLOD();
  if (changed) scene.requestRender();
}

export function disposeShelfVisibility(scene: StoreScene): void {
  nextUpdates.delete(scene);
}
