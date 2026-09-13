import { getActiveTheme } from './themes';
import * as THREE from 'three';
import type { StoreScene } from './three-scene';
import { NR_BAY_WIDTH } from './nr-run-layout';
import { installDownlightModels } from './downlight-model';
import { selfLit } from './material-lighting';

/** One recessed fitting per bay; static shelf wash is evaluated by nr-bay-wash. */
export function buildNrBayLighting(scene: StoreScene): void {
  scene.nrBayLightAnchors = []; scene.nrBayLightingUpdate = null;
  if (getActiveTheme().id !== 'bb-1990') return;
  const root = new THREE.Group(); root.name = 'New Release bay downlights'; scene.scene.add(root);
  const anchors = scene.nrRuns.flatMap(run => Array.from({ length: run.cols / 8 }, (_, i) => {
    const x = -run.length / 2 + (i + .5) * NR_BAY_WIDTH, z = 2.9;
    return { x: run.x + x * Math.cos(run.yaw) + z * Math.sin(run.yaw), y: scene.ceilingY - 2.7,
      z: run.z - x * Math.sin(run.yaw) + z * Math.cos(run.yaw),
      tx: run.x + x * Math.cos(run.yaw) + 1.7 * Math.sin(run.yaw),
      tz: run.z - x * Math.sin(run.yaw) + 1.7 * Math.cos(run.yaw), chosen: 0, distance: 0 };
  }));
  scene.nrBayLightAnchors = anchors;
  const fallback = new THREE.Group(); root.add(fallback);
  const trim = new THREE.MeshStandardMaterial({ color: 0xe5e3db, roughness: .5 });
  const lamp = selfLit(new THREE.MeshStandardMaterial({ color: 0xfff3df, emissive: 0xfff3df, emissiveIntensity: 1.6 }), 'light-source');
  const ring = new THREE.RingGeometry(.27, .4, 24), lens = new THREE.CircleGeometry(.27, 24);
  for (const a of anchors) {
    for (const [geometry, material, drop] of [[ring, trim, .012], [lens, lamp, .02]] as const) {
      const mesh = new THREE.Mesh(geometry, material); mesh.rotation.x = Math.PI / 2;
      mesh.position.set(a.x, a.y - drop, a.z); fallback.add(mesh);
    }
  }
  const batches: THREE.InstancedMesh[] = [];
  root.addEventListener('removed', () => batches.forEach(mesh => mesh.dispose()));
  installDownlightModels(root, anchors, fallback, () => {
    const hardware = root.getObjectByName('recessed-downlights');
    if (hardware) {
      hardware.updateWorldMatrix(true, true);
      const groups = new Map<string, { source: THREE.Mesh; matrices: THREE.Matrix4[] }>();
      const inverse = hardware.matrixWorld.clone().invert();
      hardware.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        const key = object.geometry.uuid + materials.map(m => m.uuid).join(':');
        if (!groups.has(key)) groups.set(key, { source: object, matrices: [] });
        groups.get(key)!.matrices.push(new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld));
      });
      hardware.clear();
      for (const { source, matrices } of groups.values()) {
        const mesh = new THREE.InstancedMesh(source.geometry, source.material, matrices.length);
        mesh.name = 'Bay downlight ' + source.name;
        matrices.forEach((matrix,i) => mesh.setMatrixAt(i,matrix));
        mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); mesh.computeBoundingBox();
        mesh.castShadow = mesh.receiveShadow = true; hardware.add(mesh); batches.push(mesh);
      }
    }
    scene.requestRender();
  });
}
