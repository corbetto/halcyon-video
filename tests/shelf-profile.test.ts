import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { shelfLeanAngle, LOWER_BACKREST_HEIGHT, lowerBackrestProjection } from '../src/shelf-profile.ts';
import { unitDepthAtHeight, nrWallDepthAtHeight, UNIT_DEPTH, NR_RUN_DEPTH, AISLE_SHELF_HEIGHTS, WALL_SHELF_HEIGHTS } from '../src/store-layout.ts';

async function load(name:string) {
  const b=await readFile(new URL('../public/models/'+name+'.glb',import.meta.url));
  return (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene;
}
test('outer shelving silhouette and footprint retain their original straight taper', () => {
  assert.equal(UNIT_DEPTH,2.16); assert.ok(Math.abs(NR_RUN_DEPTH-1.18)<1e-9);
  for(let y=0;y<=5.1;y+=.1) assert.ok(Math.abs(unitDepthAtHeight(y)-(2.16-.9*y/5.1))<1e-9);
  for(let y=0;y<=8;y+=.1) assert.ok(Math.abs(nrWallDepthAtHeight(y)-(1.1-.55*y/8))<1e-9);
});
test('internal backings rake the lower cases upward while staying inside the original frame', async () => {
  const kit=await load('shelf-components');
  for(const [row,name] of ['BackrestLower','BackrestSecond'].entries()) {
    const pos=(kit.getObjectByName(name) as THREE.Mesh).geometry.getAttribute('position');
    let base=-Infinity,top=-Infinity;
    for(let i=0;i<pos.count;i++) {
      if(pos.getY(i)<.001) base=Math.max(base,pos.getX(i));
      if(pos.getY(i)>LOWER_BACKREST_HEIGHT-.001) top=Math.max(top,pos.getX(i));
      assert.ok(.25+pos.getX(i)<unitDepthAtHeight(AISLE_SHELF_HEIGHTS[row]+pos.getY(i))/2);
    }
    assert.ok(Math.abs(Math.atan((base-top)/LOWER_BACKREST_HEIGHT)+shelfLeanAngle(row))<1e-6);
    assert.ok(Math.abs(base-lowerBackrestProjection(row))<1e-6);
  }
  const wall=await load('new-release-wall');wall.updateMatrixWorld(true);
  for(const row of [0,1]) {
    const mesh=wall.getObjectByName('HighBack_'+row) as THREE.Mesh;
    const pos=mesh.geometry.getAttribute('position');
    let base=-Infinity,top=-Infinity;
    for(let i=0;i<pos.count;i++) {
      const p=new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld);
      if(p.y<WALL_SHELF_HEIGHTS[row]) base=Math.max(base,p.z);
      if(p.y>WALL_SHELF_HEIGHTS[row]+.59) top=Math.max(top,p.z);
      assert.ok(p.z<.08+nrWallDepthAtHeight(p.y));
    }
    assert.ok(Math.abs(Math.atan((base-top)/.65)+shelfLeanAngle(row))<1e-6);
  }
});

test('short and tall rental cases clear the raked internal back within the fixed shelf', async () => {
  const { shelfCasePacking } = await import('../src/packaging-fit.ts');
  for(const row of [0,1]) for(const [h,d,sh,sd] of [[.4,.045,.4,.055],[.62,.055,.64,.065],[.667,.092,.73,.104]]) {
    const tilt=shelfLeanAngle(row),sin=Math.abs(Math.sin(tilt)),cos=Math.cos(tilt);
    const half=unitDepthAtHeight(AISLE_SHELF_HEIGHTS[row])/2;
    const plan=shelfCasePacking(h,d,sh,sd,tilt,half,3,LOWER_BACKREST_HEIGHT);
    assert.ok(plan.fits);
    // Measure the rear copy against the physical backing plane, independent
    // of the placement solver; the last extra copy is closest to the backing.
    const centerD=plan.offset-h/2*sin+plan.backZ-plan.count*plan.pitch;
    const centerY=.03+h/2*cos+d/2*sin+(sh-h)/2;
    const behind=(centerD-.25)*cos+(centerY-.02)*sin-sd/2-LOWER_BACKREST_HEIGHT*sin;
    assert.ok(behind>=.0059,'rental case intersects internal backing');
    assert.ok(plan.offset+d/2*(1+cos)<half,'stock extends past original shelf front');
  }
});

test('outer model surfaces match the original pre-flare geometry', async () => {
  const { createHash } = await import('node:crypto');
  // Frozen from the original model, before the incorrect exterior change.
  const expected = {
  "new-release-wall": {
    "names": [
      "Backing",
      "Deck_0",
      "Deck_1",
      "Deck_2",
      "Deck_3",
      "Deck_4",
      "Deck_5",
      "Deck_6",
      "Deck_7",
      "LeftEnd",
      "RightEnd",
      "Toe"
    ],
    "hash": "d03ad4fd9d877518419cd9f17c03c2412989a3ea2dc03c54a32266493630a05e"
  },
  "shelf-components": {
    "names": [
      "Deck",
      "EndPanel",
      "Foot",
      "Spine",
      "Standard",
      "Upright"
    ],
    "hash": "28f2ace29239def0637f3f525074743137c2e2ad2ff6f3a7a8205a5dccf8375f"
  }
};
  for(const [family,baseline] of Object.entries(expected)) {
    const scene=await load(family);scene.updateMatrixWorld(true);
    const data=baseline.names.map(name=>{
      const m=scene.getObjectByName(name) as THREE.Mesh;
      const pos=m.geometry.getAttribute('position'),points:string[]=[];
      for(let i=0;i<pos.count;i++) {
        const p=new THREE.Vector3().fromBufferAttribute(pos,i);
        if(family==='new-release-wall') p.applyMatrix4(m.matrixWorld);
        points.push(p.toArray().map(n=>Math.round(n*100000)).join(','));
      }
      return [name,[...new Set(points)].sort()];
    });
    assert.equal(createHash('sha256').update(JSON.stringify(data)).digest('hex'),baseline.hash,family);
  }
});
