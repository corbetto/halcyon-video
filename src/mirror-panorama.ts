import { Euler, Matrix4, Quaternion, Vector3 } from 'three';

// Aim every mirror's head-on reflection down the shelving field from the
// elevated entrance probe. This is an intentional scenic approximation:
// camera motion still changes the reflection, but the room stays prominent.
const roomDirection = new Vector3(.65, -0.18, -1).normalize();
const origin = new Vector3();
const up = new Vector3(0, 1, 0);
const roomFrame = new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(origin, roomDirection, up));

export function mirrorPanoramaRotation(worldNormal: Vector3): Euler {
  const mirrorFrame = new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(origin, worldNormal, up));
  // Three samples the environment through the INVERSE of envMapRotation.
  // Build room -> mirror so its inverse sends the mirror normal into the room.
  return new Euler().setFromQuaternion(mirrorFrame.multiply(roomFrame.clone().invert()));
}
