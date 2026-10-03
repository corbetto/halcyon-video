import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { assetUrl } from '../asset-url';
import { retailPackaging } from './retail-packaging';

/** Feet, centered origin, +Z front. Rack's existing tray matrix compresses Y .65. */
export const CANDY_CARTON_RACK = [.32, .42, .18] as const;
export const CANDY_CARTON_BAG = [.24, .32, .12] as const;
const PRINT_ROLES: Record<string, string> = {
  'CHOCO BARS': 'CandyCartonRed', 'GUMMY BEARS': 'CandyCartonYellow',
  'POPCORN': 'PopcornCartonYellow', 'MOVIE MINTS': 'CandyCartonBlue',
  'SOUR RIBBONS': 'SnackPouchGreen',
};

/** Existing authorized prints; caller owns materials, each owns its generated map. */
export function candyCartonFinishes(render: () => void): Record<string, THREE.MeshStandardMaterial> {
  const roles = retailPackaging(value => value, render, Object.values(PRINT_ROLES));
  const finishes: Record<string, THREE.MeshStandardMaterial> = {};
  for (const [label, role] of Object.entries(PRINT_ROLES)) {
    const material = roles[role] as THREE.MeshStandardMaterial;
    const texture = material.map!;
    material.addEventListener('dispose', () => texture.dispose());
    finishes[label] = material;
  }
  return finishes;
}

/** Upgrade the caller-owned box in place. Existing instances and dropped items
 * retain their geometry identity, exact bounds and collision centers. Disposal
 * before load cancels installation; missing assets leave the box usable.
 * Export is texture-free; print UVs follow glTF's flipY=false convention.
 */
export async function upgradeCandyCartonGeometry(
  target: THREE.BufferGeometry, dimensions: readonly [number, number, number],
  refresh: () => void, flipY = false,
): Promise<boolean> {
  let retired = false;
  const retire = () => { retired = true; };
  target.addEventListener('dispose', retire);
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  try {
    const gltf = await new GLTFLoader().loadAsync(assetUrl('models/candy-carton.glb'));
    gltf.scene.updateMatrixWorld(true);
    const parts: THREE.BufferGeometry[] = [];
    gltf.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m));
      const part = object.geometry.clone().applyMatrix4(object.matrixWorld);
      geometries.add(part); parts.push(part);
    });
    if (retired || !parts.length) return false;
    const merged = mergeGeometries(parts);
    if (!merged) return false;
    geometries.add(merged);
    merged.scale(...dimensions.map((d, i) => d / CANDY_CARTON_RACK[i]) as [number, number, number]);
    if (flipY) {
      const uv = merged.getAttribute('uv');
      for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
    }
    merged.computeBoundingBox(); merged.computeBoundingSphere();
    // Retire old GPU buffers before copy() replaces the attributes. The caller
    // continues to own and eventually dispose this same BufferGeometry object.
    target.removeEventListener('dispose', retire);
    target.dispose();
    target.copy(merged);
    target.name = 'folded-candy-carton';
    target.userData.candyCarton = true;
    refresh();
    return true;
  } catch {
    return false;
  } finally {
    target.removeEventListener('dispose', retire);
    geometries.forEach(g => g.dispose());
    materials.forEach(m => m.dispose());
  }
}
