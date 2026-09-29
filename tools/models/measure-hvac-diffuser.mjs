import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { readFileSync, writeFileSync } from 'node:fs';
const bytes=readFileSync('public/models/hvac-diffuser.glb');
const data=bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset+bytes.byteLength);
const gltf=await new Promise((resolve,reject)=>new GLTFLoader().parse(data,'',resolve,reject));
gltf.scene.updateMatrixWorld(true);
const parts={},bounds=new THREE.Box3();
let triangles=0,vertices=0;
gltf.scene.traverse(object=>{
  if(!(object instanceof THREE.Mesh))return;
  const geo=object.geometry, pos=geo.getAttribute('position');
  const tri=(geo.index?geo.index.count:pos.count)/3;
  const localBounds=new THREE.Box3().setFromBufferAttribute(pos).applyMatrix4(object.matrixWorld);
  bounds.union(localBounds);triangles+=tri;vertices+=pos.count;
  parts[object.name]={triangles:tri,vertices:pos.count,uvs:geo.getAttribute('uv')?.count??0,
    material:Array.isArray(object.material)?object.material.map(m=>m.name):object.material.name,
    bounds_min:localBounds.min.toArray(),bounds_max:localBounds.max.toArray()};
});
const rounded = values => values.map(value => Number(value.toFixed(4)));
for (const part of Object.values(parts)) { part.bounds_min=rounded(part.bounds_min); part.bounds_max=rounded(part.bounds_max); }
const report={triangles,vertices,parts,bounds_min:rounded(bounds.min.toArray()),bounds_max:rounded(bounds.max.toArray())};
const path='docs/hvac-diffuser-cost.json';
const cost=JSON.parse(readFileSync(path,'utf8'));
cost.exported_glb=report;
writeFileSync(path,JSON.stringify(cost,null,2)+'\n');
console.log(JSON.stringify(report));
