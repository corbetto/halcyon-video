import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { assetUrl } from './asset-url';
import { disposeDetachedModel } from './model-resources';
import type { FixtureContext } from './fixtures';

export interface DiffuserPlacement { x: number; y: number; z: number; scale?: number }
type Context = Pick<FixtureContext, 'scene' | 'scheduleDetailLoad' | 'prepareDetailModel' | 'requestShadowRefresh' | 'requestRender'>;
const PARTS = ['DiffuserFrame', 'RecessPan', 'DirectionalLouvers'] as const;

/** One instance per module and material role; no per-vent Mesh or geometry. */
export function installHvacDiffusers(
  ctx: Context, parent: THREE.Object3D,
  placements: readonly DiffuserPlacement[], fallback: readonly THREE.Object3D[],
): () => void {
  if (!placements.length) return () => {};
  const lifetime = new AbortController();
  let retired = false;
  let installed: THREE.Group | null = null;
  let cancelQueued: (() => void) | undefined;
  const fallbackGeometry = fallback.find((object): object is THREE.Mesh => object instanceof THREE.Mesh)?.geometry;
  const release = (root: THREE.Group) => {
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object instanceof THREE.InstancedMesh) object.dispose();
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
    });
    root.removeFromParent();
  };
  const stop = () => {
    if (retired) return;
    retired = true;
    lifetime.abort();
    cancelQueued?.();
    parent.removeEventListener('removed', stop);
    fallbackGeometry?.removeEventListener('dispose', stop);
    if (installed) { release(installed); installed = null; }
  };
  parent.addEventListener('removed', stop);
  fallbackGeometry?.addEventListener('dispose', stop);
  const attached = () => {
    let root: THREE.Object3D = parent;
    while (root.parent) root = root.parent;
    return root === ctx.scene;
  };
  const load = () => new Promise<void>(complete => {
    if (retired) { complete(); return; }
    new GLTFLoader().load(assetUrl('models/hvac-diffuser.glb'), ({ scene: source }) => {
      const model = new THREE.Group();
      model.name = 'HVAC diffuser family';
      try {
        if (retired || !attached()) { complete(); return; }
        source.updateMatrixWorld(true);
        for (const name of PARTS) {
          const part = source.getObjectByName(name);
          if (!(part instanceof THREE.Mesh) || !(part.material instanceof THREE.MeshStandardMaterial)) throw new Error('Missing diffuser part ' + name);
          const geometry = part.geometry.clone().applyMatrix4(part.matrixWorld);
          const material = part.material.clone();
          // Painted steel needs a little room bounce on its downward faces.
          material.metalness = Math.min(material.metalness, .08);
          material.emissive.copy(material.color).multiplyScalar(name === 'RecessPan' ? .015 : .045);
          const instances = new THREE.InstancedMesh(geometry, material, placements.length);
          instances.name = name;
          instances.instanceMatrix.setUsage(THREE.StaticDrawUsage);
          placements.forEach((spot, i) => {
            const scale = spot.scale ?? 1;
            instances.setMatrixAt(i, new THREE.Matrix4().makeTranslation(spot.x, spot.y, spot.z)
              .multiply(new THREE.Matrix4().makeScale(scale, scale, scale)));
          });
          instances.instanceMatrix.needsUpdate = true;
          instances.computeBoundingSphere();
          instances.castShadow = name !== 'RecessPan';
          instances.receiveShadow = true;
          model.add(instances);
        }
        model.visible = !ctx.prepareDetailModel;
        parent.add(model);
        installed = model;
        void (async () => {
          try {
            if (ctx.prepareDetailModel) await ctx.prepareDetailModel(model, lifetime.signal);
            if (retired || !model.parent || !attached()) {
              if (installed === model) { release(model); installed = null; }
              return;
            }
            model.visible = true;
            fallback.forEach(object => { object.visible = false; });
            ctx.requestShadowRefresh();
            ctx.requestRender();
          } catch {
            // The original planes remain visible when preparation fails.
            if (installed === model) { release(model); installed = null; }
          } finally { complete(); }
        })();
      } catch {
        release(model);
        complete();
      } finally { disposeDetachedModel(source); }
    }, undefined, () => { complete(); });
  });
  cancelQueued = ctx.scheduleDetailLoad?.(load);
  if (!ctx.scheduleDetailLoad) void load();
  return stop;
}
