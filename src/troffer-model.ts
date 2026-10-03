import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { assetUrl } from './asset-url.ts';
import { disposeDetachedModel } from './model-resources.ts';
import type { FixtureContext } from './fixtures.ts';

export interface TrofferAnchor { x: number; y: number; z: number }
export type TrofferModelContext = Pick<FixtureContext,
  'scene' | 'scheduleDetailLoad' | 'prepareDetailModel' | 'requestShadowRefresh' | 'requestRender'>;
const PARTS = ['TrofferHousing', 'TrofferHardware', 'TrofferTubes'] as const;

/** Hole within the pan's lower perimeter, clear of the supporting T-bar flange. */
export function addTrofferApertures(shape: THREE.Shape, anchors: readonly { x: number; z: number }[], width = 5, depth = 2.5): void {
  const hx = width / 2 - .075, hz = depth / 2 - .075;
  for (const { x, z } of anchors) {
    const hole = new THREE.Path();
    hole.moveTo(x - hx, z - hz); hole.lineTo(x - hx, z + hz);
    hole.lineTo(x + hx, z + hz); hole.lineTo(x + hx, z - hz); hole.closePath();
    shape.holes.push(hole);
  }
}

/** Ceiling-local plane UVs preserve the existing full-room texture phase. */
export function trofferCeilingGeometry(width: number, depth: number, anchors: readonly { x: number; z: number }[]): THREE.ShapeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, -depth / 2); shape.lineTo(width / 2, -depth / 2);
  shape.lineTo(width / 2, depth / 2); shape.lineTo(-width / 2, depth / 2); shape.closePath();
  addTrofferApertures(shape, anchors);
  const geometry = new THREE.ShapeGeometry(shape), position = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
  for (let i = 0; i < position.count; i++) uv.setXY(i, position.getX(i) / width + .5, position.getY(i) / depth + .5);
  return geometry;
}

/** Shared lens is unchanged; one instance batch per housing finish, per deck. */
export function installTrofferModels(
  parent: THREE.Object3D, anchors: readonly TrofferAnchor[],
  paint: THREE.Material, lens: THREE.Material,
  ctx?: TrofferModelContext, width = 5, depth = 2.5,
): THREE.Group {
  const root = new THREE.Group(); root.name = 'Recessed troffers'; parent.add(root);
  root.userData.anchors = anchors.map(a => ({ ...a }));
  if (!anchors.length) return root;
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  let retired = false, cancelQueued: (() => void) | undefined;
  const lifetime = new AbortController();
  const batch = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, owner: THREE.Group, local = new THREE.Matrix4()) => {
    geometries.add(geometry);
    const mesh = new THREE.InstancedMesh(geometry, material, anchors.length); mesh.name = name;
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    anchors.forEach((a, i) => mesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(a.x, a.y, a.z).multiply(local)));
    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); owner.add(mesh);
    return mesh;
  };
  const fallback = batch('Troffer housing fallback', new THREE.BoxGeometry(width, .06, depth), paint, root,
    new THREE.Matrix4().makeTranslation(0, -.03, 0));
  fallback.castShadow = fallback.receiveShadow = true;
  const panels = batch('Prismatic troffer lenses', new THREE.BoxGeometry(width - .12, .04, depth - .12), lens, root,
    new THREE.Matrix4().makeTranslation(0, -.06, 0));
  // These are exactly the old lens dimensions, UVs, finish, emission and height.
  // No extra emitter is introduced by the modeled tubes behind the lens.
  const stop = () => {
    if (retired) return;
    retired = true; lifetime.abort(); cancelQueued?.();
    parent.removeEventListener('removed', stop); root.removeEventListener('removed', stop);
    panels.geometry.removeEventListener('dispose', stop);
    root.traverse(o => { if (o instanceof THREE.InstancedMesh) o.dispose(); });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
    geometries.clear(); materials.clear();
  };
  parent.addEventListener('removed', stop); root.addEventListener('removed', stop);
  panels.geometry.addEventListener('dispose', stop);
  const attached = () => {
    let top: THREE.Object3D = root;
    while (top.parent) top = top.parent;
    return top === ctx?.scene;
  };
  const load = () => new Promise<void>(complete => {
    if (retired || !ctx) { complete(); return; }
    new GLTFLoader().load(assetUrl('models/fluorescent-troffer.glb'), ({ scene: source }) => {
      const model = new THREE.Group(); model.name = 'Authored troffer housings';
      const releaseModel = () => {
        model.removeFromParent();
        model.traverse(o => {
          if (!(o instanceof THREE.Mesh)) return;
          if (o instanceof THREE.InstancedMesh) o.dispose();
          if (geometries.delete(o.geometry)) o.geometry.dispose();
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (materials.delete(m)) m.dispose();
        });
      };
      try {
        if (retired || !attached()) { complete(); return; }
        source.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(source);
        const size = bounds.getSize(new THREE.Vector3());
        if (![...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite) || size.x < 4.94 || size.z < 2.45 || size.y < .43 || bounds.isEmpty() || bounds.min.x < -2.501 || bounds.max.x > 2.501 || bounds.min.z < -1.251 || bounds.max.z > 1.251 || bounds.min.y < -.151 || bounds.max.y > .321) throw new Error('Invalid troffer envelope');
        for (const name of PARTS) {
          const part = source.getObjectByName(name);
          if (!(part instanceof THREE.Mesh) || !(part.material instanceof THREE.MeshStandardMaterial)
            || !part.geometry.getAttribute('normal') || !part.geometry.getAttribute('uv')) throw new Error('Missing troffer part ' + name);
        }
        for (const name of PARTS) {
          const part = source.getObjectByName(name) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
          const material = (name === 'TrofferHousing' ? paint : part.material).clone();
          materials.add(material);
          const geometry = part.geometry.clone().applyMatrix4(part.matrixWorld);
          geometry.scale(width / 5, 1, depth / 2.5);
          const instances = batch(name, geometry, material, model);
          instances.castShadow = instances.receiveShadow = true;
        }
        model.visible = false; root.add(model);
        void (async () => {
          try {
            await ctx.prepareDetailModel?.(model, lifetime.signal);
            if (retired || !attached() || !model.parent) { releaseModel(); return; }
            model.visible = true; fallback.visible = false; root.userData.loaded = true;
            ctx.requestShadowRefresh(); ctx.requestRender();
          } catch { releaseModel(); }
          finally { complete(); }
        })();
      } catch { releaseModel(); complete(); }
      finally { disposeDetachedModel(source); }
    }, undefined, () => complete());
  });
  if (ctx && typeof window !== 'undefined') {
    cancelQueued = ctx.scheduleDetailLoad?.(load);
    if (!ctx.scheduleDetailLoad) void load();
  }
  return root;
}
