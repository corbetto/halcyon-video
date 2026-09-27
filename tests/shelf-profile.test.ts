import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { shelfLeanAngle } from '../src/shelf-profile.ts';
import { unitDepthAtHeight, nrWallDepthAtHeight, UNIT_DEPTH, AISLE_SHELF_HEIGHTS, WALL_SHELF_HEIGHTS } from '../src/store-layout.ts';

test('lower display tiers project outward and turn covers toward a standing customer', () => {
  for (const heights of [AISLE_SHELF_HEIGHTS, WALL_SHELF_HEIGHTS]) {
    for (let row=0;row<3;row++) {
      const angle=shelfLeanAngle(row);
      const normal=new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(1,0,0),angle);
      assert.ok(normal.y > 0 && normal.z > .9, 'cover faces outward and upward');
      if(row) assert.ok(normal.y < Math.sin(-shelfLeanAngle(row-1)));
    }
    const depth=heights===AISLE_SHELF_HEIGHTS ? (y:number)=>unitDepthAtHeight(y)/2 : nrWallDepthAtHeight;
    const lowerSlope=(depth(heights[0])-depth(heights[1]))/(heights[1]-heights[0]);
    const upperSlope=(depth(heights[2])-depth(heights[3]))/(heights[3]-heights[2]);
    assert.ok(lowerSlope > upperSlope*2, 'a linear taper cannot satisfy the lower flare');
  }
  assert.ok(unitDepthAtHeight(0) <= UNIT_DEPTH, 'collision footprint encloses the flare');
  assert.ok(Math.abs(unitDepthAtHeight(3)- (2.16-.90*3/5.1)) < 1e-9, 'upper shelving remains at its original depth');
});

test('exported shelf kit has real bend stations and wall end panels enclose the deeper decks', async () => {
  const load=async(name:string)=>{
    const b=await readFile(new URL('../public/models/'+name+'.glb',import.meta.url));
    return (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene;
  };
  const kit=await load('shelf-components');
  for(const name of ['Upright','EndPanel']) {
    const pos=(kit.getObjectByName(name) as THREE.Mesh).geometry.getAttribute('position');
    for(const y of AISLE_SHELF_HEIGHTS.slice(0,3)) {
      const sourceY=.20+(y-.20)*4.8/4.4;
      assert.ok(Array.from({length:pos.count},(_,i)=>pos.getY(i)).some(v=>Math.abs(v-sourceY)<.015),name+' missing bend vertices');
    }
  }
  const wall=await load('new-release-wall');wall.updateMatrixWorld(true);
  const end=(wall.getObjectByName('LeftEnd') as THREE.Mesh);
  const positions=end.geometry.getAttribute('position');
  for(const y of WALL_SHELF_HEIGHTS.slice(0,3)) {
    const front=.08+nrWallDepthAtHeight(y);
    assert.ok(Array.from({length:positions.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(end.matrixWorld))
      .some(p=>Math.abs(p.y-y)<1e-5 && p.z > front+.03),'panel must follow and enclose each lower deck');
  }
});
