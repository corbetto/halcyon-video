import * as THREE from 'three';
import type { FixtureContext } from '../fixtures';
import { familyStock } from './clubhouse-layout';

/** Match the room's physical texture scale, including its height-based contact shading. */
export function mapClubhouseWall(mesh: THREE.Mesh, ctx: FixtureContext): void {
  const surface = ctx.wallSurface; if (!surface) return;
  const { position, normal } = mesh.geometry.attributes;
  const uv = new Float32Array(position.count * 2);
  mesh.updateMatrix();
  const point = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position,i).applyMatrix4(mesh.matrix);
    const {x,y,z}=point;
    const nx = Math.abs(normal.getX(i)), ny = Math.abs(normal.getY(i)), nz = Math.abs(normal.getZ(i));
    uv[i * 2] = (nx > nz ? z : x) / surface.storeWidth;
    uv[i * 2 + 1] = (ny > .9 ? z : y) / surface.roomHeight;
  }
  mesh.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
/** Real catalog artwork only; failed or absent posters leave the ordinary wall visible. */
export function installClubhousePosters(root: THREE.Group, ctx: FixtureContext): () => void {
  let disposed = false;
  const owned: { dispose(): void }[] = [];
  const posters = new THREE.Group(); posters.name = 'clubhouse-family-posters'; root.add(posters);
  const seen = new Set<string>();
  const stock = familyStock(ctx.libraries.flatMap(l => l.movies)).filter(m => {
    if (!m.posterUrl || seen.has(m.posterUrl)) return false;
    seen.add(m.posterUrl); return true;
  }).slice(0, 4);
  const loader = new THREE.TextureLoader();
  stock.forEach((movie, i) => {
    loader.load(movie.posterUrl!, texture => {
      if (disposed) { texture.dispose(); return; }
      texture.colorSpace = THREE.SRGBColorSpace;
      const geometry = new THREE.PlaneGeometry(2.25, 3.32);
      const material = new THREE.MeshStandardMaterial({ map: texture, roughness: .65 });
      const mesh = new THREE.Mesh(geometry, material); mesh.name = 'family-poster: ' + movie.title;
      if (i < 2) { mesh.position.set(-6.77, 5, i * 3.5); mesh.rotation.y = Math.PI / 2; }
      else mesh.position.set((i - 2) * 3.5, 5, -6.77);
      mesh.receiveShadow = true; posters.add(mesh); owned.push(texture, geometry, material); ctx.requestRender();
    }, undefined, () => {});
  });
  return () => { disposed = true; posters.removeFromParent(); owned.forEach(value => value.dispose()); };
}
