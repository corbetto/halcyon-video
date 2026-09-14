import { shuffledStock } from './stock-cart-layout';
import * as THREE from 'three';
import { FixturePlacement } from '../store-layout';
import { FixtureContext, FixtureSlot, SlottedFixture } from '../fixtures';
import { Footprint, FLOOR_DISPLAY_CLEARANCE } from '../layout-validator';
import { CASE_DEPTH } from '../video-case';
import { installDisplayModel } from './display-model';

/** Original unbranded service cart. Stock stays owned by the shared case pipeline. */
export class ReleaseCart implements SlottedFixture {
  capacity = 48;
  genre = 'Return Cart';
  shelfHeights = [.9, 2.55];
  private group: THREE.Group | null = null;
  private owned: Array<{ dispose(): void }> = [];
  private removeModel: (() => void) | null = null;
  private movies: FixtureContext['libraries'][number]['movies'] = [];
  constructor(public placement: FixturePlacement, private ctx: FixtureContext) {}
  refreshStock(): void {
    this.movies = shuffledStock(this.ctx.libraries.flatMap(l => l.movies), this.capacity);
  }
  build(): void {
    this.refreshStock();
    if (!this.movies.length) return;
    const group = this.group = new THREE.Group();
    group.name = this.placement.id;
    group.position.set(this.placement.position.x, 0, this.placement.position.z);
    group.rotation.y = this.placement.yaw;
    const fallback = new THREE.Group(); group.add(fallback);
    const steel = new THREE.MeshStandardMaterial({ color: 0x25282c, roughness: .4, metalness: .65 });
    this.owned.push(steel);
    const box = (x: number, y: number, z: number, w: number, h: number, d: number) => {
      const geo = new THREE.BoxGeometry(w,h,d); this.owned.push(geo);
      const mesh = new THREE.Mesh(geo,steel); mesh.position.set(x,y,z); mesh.castShadow=true; fallback.add(mesh);
    };
    for (const y of [.875,2.525]) {
      box(0,y,0,3.4,.05,1.9);
      for (const z of [-.875,.875]) box(0,y+.175,z,3.3,.35,.05);
      for (const x of [-1.675,1.675]) box(x,y+.175,0,.05,.35,1.8);
    }
    for (const x of [-1.5,1.5]) for (const z of [-.75,.75]) {
      box(x,1.72,z,.1,2.36,.1);
      const geo = new THREE.CylinderGeometry(.18,.18,.15,12); this.owned.push(geo);
      const wheel = new THREE.Mesh(geo,steel); wheel.rotation.x=Math.PI/2; wheel.position.set(x,.18,z); fallback.add(wheel);
    }
    this.ctx.scene.add(group);
    // Stable collision proxy remains registered when the loading fallback hides.
    const proxyGeo = new THREE.BoxGeometry(3.8,2.9,1.9); this.owned.push(proxyGeo);
    const proxyMat = new THREE.MeshBasicMaterial({ visible: false }); this.owned.push(proxyMat);
    const proxy = new THREE.Mesh(proxyGeo,proxyMat); proxy.position.set(.2,1.45,0); group.add(proxy); this.ctx.addCollider(proxy);
    this.removeModel = installDisplayModel(this.ctx,group,fallback,'models/release-cart.glb',{});
    this.ctx.requestShadowRefresh();
  }
  getSlots(): FixtureSlot[] {
    if (!this.group || !this.movies.length) return [];
    const slots: FixtureSlot[] = [];
    for (let row = 0; row < 2; row++) for (let col = 0; col < 24; col++) {
      const stack = Math.floor(col / 3), level = col % 3;
      const x = ((stack % 4) - 1.5) * .68, z = (Math.floor(stack / 4) - .5) * .79;
      const yaw = this.placement.yaw;
      slots.push({ movie: this.movies[(row * 24 + col) % this.movies.length], side: 'front', shelfIdx: row, col,
        restingX: this.placement.position.x + x * Math.cos(yaw) + z * Math.sin(yaw),
        restingZ: this.placement.position.z - x * Math.sin(yaw) + z * Math.cos(yaw),
        restingY: this.shelfHeights[row] + CASE_DEPTH / 2 + level * (CASE_DEPTH + .008),
        restingRotY: yaw + (stack % 2 ? .035 : -.035), restingRotX: -Math.PI / 2, depth: CASE_DEPTH,
        key: `fixture_${this.placement.id}_side_front_shelf_${row}_col_${col}` });
    }
    return slots;
  }
  getFootprint(): Footprint | null {
    if (!this.group) return null;
    return {label:`fixture:${this.placement.id}`,kind:'fixture',cx:this.placement.position.x+.2*Math.cos(this.placement.yaw),cz:this.placement.position.z-.2*Math.sin(this.placement.yaw),w:3.8,d:1.9,yaw:this.placement.yaw,clearance:FLOOR_DISPLAY_CLEARANCE};
  }
  update(): void {}
  dispose(): void {
    this.removeModel?.(); this.removeModel=null;
    this.group?.removeFromParent(); this.group=null;
    this.owned.forEach(o=>o.dispose()); this.owned=[];
  }
}
