// Planar mirrors share a render workspace. Cubemap mode reuses the room's
// existing case probes: camera motion is free, moving objects are not live.
// Box projection was rejected in an earlier trial because interior furniture
// stretched onto the room shell. This option deliberately uses plain probes.
import * as THREE from 'three';
import { MirrorRenderTarget } from './mirror-render-target';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { reflectionProbes } from './case-env-probes';
import { markMirrorVisibility, pickMirror, type MirrorScheduleEntry } from './mirror-schedule';
import { perfTrace } from './perf-trace';
import { SP_MIRROR, CT_MIRROR, MIRROR_REFRESH_HZ } from './scene-shared';
import type { StoreScene } from './three-scene';

type ReflectionMode = 'auto' | 'cubemap' | 'smooth';
function reflectionMode(): ReflectionMode {
  const value = localStorage.getItem('bb_reflections');
  return value === 'cubemap' || value === 'smooth' ? value : 'auto';
}
type CubeMirror = { material: THREE.MeshStandardMaterial; probe: number };
type MirrorState = {
  targets: MirrorRenderTarget; mode: ReflectionMode; frame: number;
  camera: THREE.PerspectiveCamera; cubes: CubeMirror[];
  probes: THREE.Texture[] | null;
};
let reflectorRendering = false;
const states = new WeakMap<StoreScene, MirrorState>();

export function disposeMirrorTargets(scene: StoreScene): void {
  const state = states.get(scene);
  state?.targets.dispose();
  // Reflector.dispose also releases its current material; disposal is idempotent.
  for (const cube of state?.cubes ?? []) cube.material.dispose();
  states.delete(scene);
}
export type MirrorEntry = MirrorScheduleEntry & {
  r: any; original: (...a: any[]) => void; rendered: boolean;
};

let proxyMat: THREE.MeshStandardMaterial | null = null;
function mirrorProxyMaterial(): THREE.MeshStandardMaterial {
  return proxyMat ??= new THREE.MeshStandardMaterial({
    color: 0xd6dbe2, metalness: 1, roughness: .12, envMapIntensity: 1,
  });
}
const savedMats: Array<{ o: any; m: any }> = [];
const viewFrustum = new THREE.Frustum();
const guardFrustum = new THREE.Frustum();
const projection = new THREE.Matrix4();
const viewProjection = new THREE.Matrix4();
const bounds = new THREE.Box3();
const normal = new THREE.Vector3();
const centre = new THREE.Vector3();

function intersects(m: MirrorEntry, frustum: THREE.Frustum, camera: THREE.Vector3): boolean {
  const geo = m.r.geometry;
  if (!geo?.boundingBox) geo?.computeBoundingBox();
  if (!geo?.boundingBox) return false;
  bounds.copy(geo.boundingBox).applyMatrix4(m.r.matrixWorld);
  if (!frustum.intersectsBox(bounds)) return false;
  normal.set(0, 0, 1).transformDirection(m.r.matrixWorld);
  centre.setFromMatrixPosition(m.r.matrixWorld);
  return normal.dot(centre.sub(camera)) < 0;
}

/** Explicit cubemaps also work at lower detail; unsupported GL keeps chrome. */
export function liveMirrorsAllowed(scene: StoreScene): boolean {
  return !scene.softwareGL && !scene.webkitGL &&
    (scene.effectiveQuality === 'high' || reflectionMode() === 'cubemap');
}
export function reflectorTargetSize(renderer: THREE.WebGLRenderer): { w: number; h: number } {
  const buf = renderer.getDrawingBufferSize(new THREE.Vector2());
  const quality = localStorage.getItem('bb_quality') || 'high';
  const cap = quality === 'low' ? 256 : quality === 'medium' ? 512 : 1024;
  const w = Math.max(64, Math.min(cap, Math.round(buf.x)));
  return { w, h: Math.max(64, Math.round(w * (buf.y / Math.max(1, buf.x)))) };
}

export function renderMirrorsAhead(scene: StoreScene) {
  const state = states.get(scene);
  if (!state || state.mode === 'cubemap' || scene.mirrorsFrozen || reflectorRendering) return;
  let dirty = false;
  for (const m of scene.mirrors) if (m.dirty) { dirty = true; break; }
  if (!dirty) return;
  state.frame++;
  const stride = state.mode === 'smooth' ? 1 : Math.max(1, Math.round(scene.targetFps / MIRROR_REFRESH_HZ));
  scene.camera.updateMatrixWorld();
  viewProjection.multiplyMatrices(scene.camera.projectionMatrix, scene.camera.matrixWorldInverse);
  viewFrustum.setFromProjectionMatrix(viewProjection);
  // Capture a wider image, not merely a wider visibility test: a prewarmed
  // planar texture must contain pixels that are still beyond the main viewport.
  // Copy only the pose and camera fields the Reflector uses. Camera.copy()
  // clones userData (and a view-offset object), allocating on every frame.
  state.camera.position.copy(scene.camera.position);
  state.camera.quaternion.copy(scene.camera.quaternion);
  state.camera.matrixWorld.copy(scene.camera.matrixWorld);
  state.camera.matrixWorldInverse.copy(scene.camera.matrixWorldInverse);
  state.camera.near = scene.camera.near;
  state.camera.far = scene.camera.far;
  state.camera.layers.mask = scene.camera.layers.mask;
  projection.copy(scene.camera.projectionMatrix);
  projection.elements[0] /= 1.25;
  projection.elements[5] /= 1.25;
  state.camera.projectionMatrix.copy(projection);
  state.camera.projectionMatrixInverse.copy(projection).invert();
  viewProjection.multiplyMatrices(projection, scene.camera.matrixWorldInverse);
  guardFrustum.setFromProjectionMatrix(viewProjection);
  let visibleDirty = false;
  for (const m of scene.mirrors) {
    markMirrorVisibility(m, intersects(m, viewFrustum, scene.camera.position),
      intersects(m, guardFrustum, scene.camera.position));
    if (m.dirty && m.visible) visibleDirty = true;
  }
  // Only visible stale panels hold the loop awake; the guard band cannot
  // turn a parked store into a perpetual background renderer.
  if (visibleDirty) scene.holdRenderFrames(stride + 1);
  scene.mirrorMotionParity = (scene.mirrorMotionParity + 1) % stride;
  const admitted = scene.mirrorMotionParity === 0;
  const budget = state.mode === 'smooth' ? 2 : 1;
  reflectorRendering = true;
  const arrowWasVisible = scene.selectionArrow?.visible ?? false;
  if (scene.selectionArrow) scene.selectionArrow.visible = false;
  try {
    for (let draw = 0; draw < budget; draw++) {
      const index = pickMirror(scene.mirrors, scene.mirrorCursor, state.frame, admitted);
      if (index < 0) break;
      const m = scene.mirrors[index];
      const proxy = mirrorProxyMaterial();
      let savedCount = 0;
      for (const other of scene.mirrors) {
        if (other === m) continue;
        const saved = savedMats[savedCount] ?? (savedMats[savedCount] = { o: null, m: null });
        saved.o = other.r; saved.m = other.r.material; savedCount++;
        other.r.material = proxy;
      }
      perfTrace.count(CT_MIRROR);
      perfTrace.begin(SP_MIRROR);
      try {
        state.targets.render(scene.renderer, m.r.getRenderTarget(), m.original, scene.scene, state.camera);
        m.dirty = false; m.rendered = true; m.urgent = false; m.lastRefresh = state.frame;
        scene.mirrorCursor = (index + 1) % scene.mirrors.length;
      } finally {
        perfTrace.end(SP_MIRROR);
        for (let i = 0; i < savedCount; i++) {
          const saved = savedMats[i]; saved.o.material = saved.m;
          saved.o = null; saved.m = null;
        }
      }
    }
  } finally {
    if (scene.selectionArrow) scene.selectionArrow.visible = arrowWasVisible;
    reflectorRendering = false;
  }
}

function updateCubeProbes(state: MirrorState) {
  if (state.probes === reflectionProbes) return;
  state.probes = reflectionProbes;
  for (const cube of state.cubes) {
    const next = reflectionProbes[cube.probe] ?? null;
    if (cube.material.envMap !== next) {
      cube.material.envMap = next;
      cube.material.needsUpdate = true;
    }
  }
}

export function installMirrorThrottle(scene: StoreScene) {
  disposeMirrorTargets(scene);
  const state: MirrorState = {
    targets: new MirrorRenderTarget(), mode: reflectionMode(), frame: 0,
    camera: new THREE.PerspectiveCamera(), cubes: [], probes: null,
  };
  states.set(scene, state);
  scene.mirrors.length = 0;
  scene.mirrorCursor = 0;
  scene.scene.updateMatrixWorld(true);
  const positions = [
    [-2, scene.scaleZ(-15)], [6, scene.scaleZ(-15)], [14, scene.scaleZ(-15)],
    [22, scene.scaleZ(-15)], [11, scene.backWallZ + 10],
  ];
  scene.scene.traverse(obj => {
    if (!(obj instanceof Reflector)) return;
    const original = obj.onBeforeRender.bind(obj);
    obj.onBeforeRender = () => {};
    if (state.mode === 'cubemap') {
      centre.setFromMatrixPosition(obj.matrixWorld);
      let nearest = 0, distance = Infinity;
      positions.forEach(([x, z], i) => {
        const d = (x - centre.x) ** 2 + (z - centre.z) ** 2;
        if (d < distance) { nearest = i; distance = d; }
      });
      for (const material of Array.isArray(obj.material) ? obj.material : [obj.material]) material.dispose();
      const material = new THREE.MeshStandardMaterial({
        color: 0xd6dbe2, metalness: 1, roughness: .06, envMapIntensity: 1,
      });
      // Reflector is still a mesh; its unrendered target allocates no GPU storage.
      // Its normal disposal path owns the replacement material.
      (obj as THREE.Mesh).material = material;
      state.cubes.push({ material, probe: nearest });
    } else {
      state.targets.prepare(obj.getRenderTarget());
      scene.mirrors.push({
        r: obj, original, dirty: true, rendered: false, visible: false,
        near: false, wasVisible: false, urgent: false, lastRefresh: -Infinity,
      });
    }
  });
  // Start against this scene's live environment. Probes are assigned on its
  // first update after its own bake, never from the previous scene's targets.
  state.probes = reflectionProbes;
}

export function updateMirrorThrottle(scene: StoreScene, forceAll: boolean) {
  const state = states.get(scene);
  if (state?.mode === 'cubemap') { updateCubeProbes(state); return; }
  const moved =
    scene.camera.position.distanceToSquared(scene.lastMirrorCamPos) > 1e-6 ||
    Math.abs(1 - Math.abs(scene.camera.quaternion.dot(scene.lastMirrorCamQuat))) > 1e-7;
  if (moved || forceAll) {
    scene.lastMirrorCamPos.copy(scene.camera.position);
    scene.lastMirrorCamQuat.copy(scene.camera.quaternion);
    for (const m of scene.mirrors) m.dirty = true;
  }
}
