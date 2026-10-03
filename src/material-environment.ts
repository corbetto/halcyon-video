import type { MeshStandardMaterial, Texture } from 'three';

/** A repeated LOD scan must not invalidate an unchanged shader. Texture uploads
 * have their own version; swapping the environment still invalidates normally. */
export function setMaterialEnvironment(material: MeshStandardMaterial | null, environment: Texture | null): void {
  if (!material || material.envMap === environment) return;
  material.envMap = environment;
  material.needsUpdate = true;
}
