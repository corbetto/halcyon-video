import * as THREE from 'three';
import { LOWER_BACKREST_HEIGHT, LOWER_BACKREST_THICKNESS, lowerBackrestProjection } from './shelf-profile';

/** Internal backing only: +X faces stock, Y starts at the deck, Z spans the bay.
 * The top joins the existing spine; the lower edge projects into the shelf. */
export function lowerBackrestGeometry(row: number, length: number): THREE.BufferGeometry {
  const h = LOWER_BACKREST_HEIGHT, t = LOWER_BACKREST_THICKNESS, p = lowerBackrestProjection(row);
  const shape = new THREE.Shape();
  shape.moveTo(p-t,0); shape.lineTo(p,0); shape.lineTo(0,h); shape.lineTo(-t,h); shape.closePath();
  return new THREE.ExtrudeGeometry(shape,{depth:length,bevelEnabled:false,steps:1}).translate(0,0,-length/2);
}
