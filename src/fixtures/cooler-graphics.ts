import * as THREE from 'three';
import { BB_ARCHIVO_BLACK, ensureBundledFont } from '../bundled-fonts';

/** Owner-directed original print: ten fine diagonal stripes and a white header. */
export function coolerGraphics(own: <T extends { dispose(): void }>(o: T) => T, refresh: () => void) {
  const header = document.createElement('canvas'); header.width = 1024; header.height = 200;
  const headerMap = own(new THREE.CanvasTexture(header)); headerMap.colorSpace = THREE.SRGBColorSpace;
  let disposed = false; headerMap.addEventListener('dispose', () => { disposed = true; });
  const paint = () => {
    if (disposed) return;
    const c = header.getContext('2d')!; c.clearRect(0, 0, 1024, 200);
    c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `94px ${BB_ARCHIVO_BLACK}, sans-serif`;
    // The canvas and panel share their physical aspect; no squeezed lettering.
    c.fillText('Cola-Drink', 512, 104);
    headerMap.needsUpdate = true; refresh();
  };
  paint(); ensureBundledFont(BB_ARCHIVO_BLACK, paint);
  const stripeCanvas = document.createElement('canvas'); stripeCanvas.width = 256; stripeCanvas.height = 724;
  const c = stripeCanvas.getContext('2d')!;
  c.strokeStyle = '#ffffff'; c.lineWidth = 3;
  // Equal pitch down each side, with clear top and bottom margins.
  for (let i = 0; i < 10; i++) {
    const y = 70 + i * 57;
    c.beginPath(); c.moveTo(24, y + 36); c.lineTo(232, y - 36); c.stroke();
  }
  const stripeMap = own(new THREE.CanvasTexture(stripeCanvas)); stripeMap.colorSpace = THREE.SRGBColorSpace;
  const headerMat = own(new THREE.MeshStandardMaterial({ map: headerMap, transparent: true, alphaTest: .08, roughness: .4, depthWrite: false }));
  const stripesMat = own(new THREE.MeshStandardMaterial({ map: stripeMap, transparent: true, alphaTest: .08, roughness: .4, depthWrite: false }));
  const headerGeo = own(new THREE.PlaneGeometry(3.78, .74));
  const sideGeo = own(new THREE.PlaneGeometry(2.30, 6.50));
  return {
    decorate(group: THREE.Group, fallback = false) {
      const label = new THREE.Mesh(headerGeo, headerMat); label.name = 'Cooler Cola-Drink header';
      label.position.set(0, 6.01, fallback ? 1.266 : 1.153); group.add(label);
      for (const side of [-1, 1]) {
        const stripes = new THREE.Mesh(sideGeo, stripesMat); stripes.name = 'Cooler ten diagonal pinstripes';
        stripes.rotation.y = side * Math.PI / 2; stripes.position.set(side * (fallback ? 2.106 : 2.006), 3.25, 0);
        group.add(stripes);
      }
    },
  };
}
