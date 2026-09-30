import * as THREE from 'three';

/** One identity instance keeps the inspected case on the same shader path as
 * the shelf. Materials, high-detail geometry, lighting and object pose are shared;
 * the only resource owned here is Three's small instance buffer.
 */
export function createInspectionMesh(
  geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[],
): THREE.InstancedMesh {
  return new THREE.InstancedMesh(geometry, material, 1);
}

/** InstancedMesh caches object-local bounds independently of its geometry.
 * A movie/game/series shape swap must invalidate those bounds for culling and hits.
 */
export function setInspectionGeometry(mesh: THREE.Mesh, geometry: THREE.BufferGeometry): void {
  if (mesh.geometry === geometry) return;
  mesh.geometry = geometry;
  if (mesh instanceof THREE.InstancedMesh) {
    mesh.boundingBox = null;
    mesh.boundingSphere = null;
  }
}

/** Do not dispose the borrowed case geometry or cache-owned materials. */
export function disposeInspectionMesh(mesh: THREE.Mesh | null): void {
  if (mesh instanceof THREE.InstancedMesh) mesh.dispose();
}
