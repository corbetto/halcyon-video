import * as THREE from 'three';
import { dampedStep, stickValue } from './reel-motion';
import type { StoreScene } from './three-scene';

interface FlightState {
  vx: number; vy: number; vz: number; yawRate: number; pitchRate: number;
  mouseX: number; mouseY: number; up: boolean; down: boolean; fast: boolean;
}
const flights = new WeakMap<StoreScene, FlightState>();
const yawStep = { velocity: 0, distance: 0 }, pitchStep = { velocity: 0, distance: 0 };
const xStep = { velocity: 0, distance: 0 }, yStep = { velocity: 0, distance: 0 }, zStep = { velocity: 0, distance: 0 };
const direction = new THREE.Vector3();
const right = new THREE.Vector3();
const aim = new THREE.Vector3();
function state(scene: StoreScene): FlightState {
  let value = flights.get(scene);
  if (!value) {
    value = { vx: 0, vy: 0, vz: 0, yawRate: 0, pitchRate: 0,
      mouseX: 0, mouseY: 0, up: false, down: false, fast: false };
    flights.set(scene, value);
  }
  return value;
}
export function resetReelFlight(scene: StoreScene): void {
  flights.delete(scene);
  for (const key of Object.keys(scene.walkKeys) as (keyof typeof scene.walkKeys)[]) scene.walkKeys[key] = false;
}
export function toggleReelFlight(scene: StoreScene): void {
  if (scene.reelFlightActive) { scene.toggleWalkAround(); resetReelFlight(scene); return; }
  if (scene.mode === 'backroom') return;
  const { x, y, z } = scene.camera.position;
  const euler = new THREE.Euler().setFromQuaternion(scene.camera.quaternion, 'YXZ');
  resetReelFlight(scene);
  scene.teleportWalk(x, z, THREE.MathUtils.radToDeg(euler.y), THREE.MathUtils.radToDeg(euler.x), y, true);
  scene.reelFlightActive = true;
  if (document.pointerLockElement) document.exitPointerLock();
  scene.requestRender();
}
export function reelFlightKey(scene: StoreScene, event: KeyboardEvent, pressed: boolean): boolean {
  if (!scene.reelFlightActive) return false;
  const flight = state(scene);
  if (event.code === 'PageUp') flight.up = pressed;
  else if (event.code === 'PageDown') flight.down = pressed;
  else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') flight.fast = pressed;
  else return false;
  event.preventDefault(); scene.requestRender(); return true;
}
export function reelFlightMouse(scene: StoreScene, event: MouseEvent): void {
  // Only intentional dragging/locked movement changes a composition.
  if (!event.buttons && document.pointerLockElement !== scene.renderer.domElement) return;
  if (Math.abs(event.movementX) + Math.abs(event.movementY) > 200) return;
  const flight = state(scene);
  flight.mouseX -= event.movementX * 0.0025;
  flight.mouseY -= event.movementY * 0.0025;
  scene.noteWalkLook();
}
export function updateReelFlight(scene: StoreScene, dt: number, pad: Gamepad | null): void {
  const flight = state(scene), keys = scene.walkKeys;
  const lx = stickValue(pad?.axes[0] || 0), ly = stickValue(pad?.axes[1] || 0);
  const rx = stickValue(pad?.axes[2] || 0), ry = stickValue(pad?.axes[3] || 0);
  const yaw = dampedStep(flight.yawRate, (Number(keys.ArrowLeft) - Number(keys.ArrowRight) - rx) * 1.25, dt, 5, yawStep);
  const pitch = dampedStep(flight.pitchRate, (Number(keys.ArrowUp) - Number(keys.ArrowDown) - ry) * 1.05, dt, 5, pitchStep);
  const mouseFraction = 1 - Math.exp(-10 * dt);
  scene.yaw += yaw.distance + flight.mouseX * mouseFraction;
  scene.pitch = THREE.MathUtils.clamp(scene.pitch + pitch.distance + flight.mouseY * mouseFraction, -1.5, 1.5);
  flight.yawRate = yaw.velocity; flight.pitchRate = pitch.velocity;
  flight.mouseX *= 1 - mouseFraction; flight.mouseY *= 1 - mouseFraction;
  scene.camera.rotation.set(scene.pitch, scene.yaw, 0, 'YXZ');
  direction.set(0, 0, -1).applyQuaternion(scene.camera.quaternion);
  right.set(1, 0, 0).applyQuaternion(scene.camera.quaternion);
  aim.copy(direction).multiplyScalar(Number(keys.w) - Number(keys.s) - ly)
    .addScaledVector(right, Number(keys.d) - Number(keys.a) + lx);
  aim.y += Number(flight.up) - Number(flight.down) + (pad?.buttons[7]?.value || 0) - (pad?.buttons[6]?.value || 0);
  if (aim.lengthSq() > 1) aim.normalize();
  aim.multiplyScalar(flight.fast || pad?.buttons[10]?.pressed ? 14 : 7);
  const x = dampedStep(flight.vx, aim.x, dt, 5, xStep), y = dampedStep(flight.vy, aim.y, dt, 5, yStep), z = dampedStep(flight.vz, aim.z, dt, 5, zStep);
  flight.vx = x.velocity; flight.vy = y.velocity; flight.vz = z.velocity;
  scene.camera.position.x += x.distance; scene.camera.position.y += y.distance; scene.camera.position.z += z.distance;
  scene.currentCameraPos.copy(scene.camera.position);
  scene.currentLookAt.copy(scene.camera.position).add(direction);
}
