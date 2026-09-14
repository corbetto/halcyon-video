import * as THREE from 'three';

interface Receiver { mesh: THREE.Mesh; original: THREE.Material | THREE.Material[]; sphere: THREE.Sphere }
interface Program { material: THREE.Material | null; receivers: Set<Receiver> }
const programs = new WeakMap<THREE.Scene, Program>();
function program(scene: THREE.Scene): Program {
  let entry = programs.get(scene);
  if (!entry) { entry = { material: null, receivers: new Set() }; programs.set(scene, entry); }
  return entry;
}
/** The ambient player owns its picture; other fixtures borrow it without another decoder. */
export function attachAmbientScreen(scene: THREE.Scene, mesh: THREE.Mesh): () => void {
  const entry = program(scene);
  mesh.updateWorldMatrix(true, false);
  mesh.geometry.computeBoundingSphere();
  const receiver = { mesh, original: mesh.material, sphere: mesh.geometry.boundingSphere!.clone().applyMatrix4(mesh.matrixWorld) };
  entry.receivers.add(receiver);
  if (entry.material) mesh.material = entry.material;
  return () => { entry.receivers.delete(receiver); mesh.material = receiver.original; };
}
export function publishAmbientPicture(scene: THREE.Scene, material: THREE.Material | null): void {
  const entry = program(scene); entry.material = material;
  for (const receiver of entry.receivers) receiver.mesh.material = material ?? receiver.original;
}
export function ambientReceiverInFrustum(scene: THREE.Scene, frustum: THREE.Frustum): boolean {
  const entry = programs.get(scene);
  if (entry) for (const receiver of entry.receivers) if (frustum.intersectsSphere(receiver.sphere)) return true;
  return false;
}
