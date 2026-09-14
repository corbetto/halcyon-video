import * as THREE from 'three';
import { loadUserAssetSurface } from './user-assets';
import { createWallTextures } from './canvas-textures';

export const LIGHT_SLATE_GREY_HEX = 0xc9d0d5;

/** Same plaster scan as the interior, painted light grey. Facade UVs use 4 ft units. */
export function createFacadeSlateMaterial(opts: {
  repeat?: [number, number];
  anisotropy?: number;
  onChange?: () => void;
} = {}): { material: THREE.MeshStandardMaterial; dispose: () => void } {
  const repeat: [number, number] = opts.repeat ?? [4 / 9, 4 / 9];
  const fallback = createWallTextures({ wall: '#ffffff' });
  const textures = new Set<THREE.Texture>(Object.values(fallback));
  textures.forEach(t => { t.repeat.set(...repeat); t.anisotropy = opts.anisotropy ?? 8; });
  const material = new THREE.MeshStandardMaterial({
    ...fallback, color: LIGHT_SLATE_GREY_HEX, normalScale: new THREE.Vector2(.35, .35),
    roughness: .92, metalness: 0, envMapIntensity: .22,
  });
  material.name = 'FacadeLightSlate';
  let disposed = false;
  material.addEventListener('dispose', () => {
    if (disposed) return;
    disposed = true; textures.forEach(t => t.dispose()); textures.clear();
  });
  loadUserAssetSurface('surfaces/store-wall', (slot, texture) => {
    if (disposed) { texture.dispose(); return; }
    textures.add(texture); material[slot] = texture; material.needsUpdate = true;
    opts.onChange?.();
  }, { repeat, anisotropy: opts.anisotropy ?? 8 });
  return { material, dispose: () => { if (!disposed) material.dispose(); } };
}
