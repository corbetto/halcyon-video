import * as THREE from 'three';

const projected = Array.from({ length: 4 }, () => new THREE.Vector4());
const crossing = new THREE.Vector4();
const transform = new THREE.Matrix4();
const crop = new THREE.Matrix4();
const range = new THREE.Vector4();
function include(p: THREE.Vector4) {
  const x = p.x / p.w, y = p.y / p.w;
  range.x = Math.min(range.x, x); range.z = Math.max(range.z, x);
  range.y = Math.min(range.y, y); range.w = Math.max(range.w, y);
}

/** Pixel-aligned bounds in the existing reflection image, with an AA guard.
 * Clip edges at the eye before dividing by w, including mirrors crossing it.
 * No resolution change: a cropped camera plus the matching viewport preserves
 * the original projective texture coordinates and pixel density.
 */
export function mirrorViewport(
  panels: readonly THREE.Mesh[], camera: THREE.Camera, width: number, height: number,
  out: THREE.Vector4,
): THREE.Vector4 {
  range.set(Infinity, Infinity, -Infinity, -Infinity);
  for (const panel of panels) {
    if (!panel.geometry.boundingBox) panel.geometry.computeBoundingBox();
    const box = panel.geometry.boundingBox;
    if (!box) continue;
    transform.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(panel.matrixWorld);
    const z = (box.min.z + box.max.z) / 2;
    projected[0].set(box.min.x, box.min.y, z, 1).applyMatrix4(transform);
    projected[1].set(box.max.x, box.min.y, z, 1).applyMatrix4(transform);
    projected[2].set(box.max.x, box.max.y, z, 1).applyMatrix4(transform);
    projected[3].set(box.min.x, box.max.y, z, 1).applyMatrix4(transform);
    for (let i = 0; i < 4; i++) {
      const a = projected[i], b = projected[(i + 1) % 4], eye = 1e-5;
      if (a.w >= eye) include(a);
      if ((a.w >= eye) !== (b.w >= eye)) {
        crossing.copy(a).lerp(b, (eye - a.w) / (b.w - a.w)); include(crossing);
      }
    }
  }
  const x = Math.max(0, Math.min(width, Math.floor((range.x + 1) * width / 2) - 2));
  const y = Math.max(0, Math.min(height, Math.floor((range.y + 1) * height / 2) - 2));
  const right = Math.max(0, Math.min(width, Math.ceil((range.z + 1) * width / 2) + 2));
  const top = Math.max(0, Math.min(height, Math.ceil((range.w + 1) * height / 2) + 2));
  return out.set(x, y, Math.max(0, right - x), Math.max(0, top - y));
}

/** Restrict Three's native frustum culling to the pixels in this viewport. */
export function cropMirrorProjection(matrix: THREE.Matrix4, viewport: THREE.Vector4, width: number, height: number) {
  const sx = viewport.z / width, sy = viewport.w / height;
  const cx = (2 * viewport.x + viewport.z) / width - 1;
  const cy = (2 * viewport.y + viewport.w) / height - 1;
  crop.set(1 / sx, 0, 0, -cx / sx, 0, 1 / sy, 0, -cy / sy, 0, 0, 1, 0, 0, 0, 0, 1);
  matrix.premultiply(crop);
}


/** Only equally oriented panels on the same physical plane share a camera. */
export function coplanarMirrorGroups<T extends { r: THREE.Mesh }>(entries: readonly T[]): T[][] {
  const groups: T[][] = [], planes: THREE.Plane[] = [];
  for (const entry of entries) {
    const normal = new THREE.Vector3(0, 0, 1).transformDirection(entry.r.matrixWorld);
    const point = new THREE.Vector3().setFromMatrixPosition(entry.r.matrixWorld);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, point);
    const index = planes.findIndex(p => p.normal.distanceToSquared(normal) < 1e-14 && Math.abs(p.constant - plane.constant) < 1e-5);
    if (index < 0) { planes.push(plane); groups.push([entry]); }
    else groups[index].push(entry);
  }
  return groups;
}
