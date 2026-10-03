import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CubeTexture,MeshPhysicalMaterial,MeshStandardMaterial} from 'three';
import {setMaterialEnvironment} from '../src/material-environment.ts';

test('repeated artwork-priority scans retain material programs for the same environment',()=>{
 for(const m of [new MeshStandardMaterial(),new MeshPhysicalMaterial()]){
  const a=new CubeTexture(),b=new CubeTexture();
  setMaterialEnvironment(m,null);assert.equal(m.version,0);
  setMaterialEnvironment(m,a);const first=m.version;assert.equal(first,1);
  for(let i=0;i<100;i++)setMaterialEnvironment(m,a);
  assert.equal(m.version,first);assert.equal(m.envMap,a);
  a.needsUpdate=true;setMaterialEnvironment(m,a);
  assert.equal(m.version,first);assert.equal(a.version,1,'pixel upload remains texture-owned');
  setMaterialEnvironment(m,b);assert.equal(m.envMap,b);assert.equal(m.version,first+1);
  setMaterialEnvironment(m,null);assert.equal(m.envMap,null);assert.equal(m.version,first+2);
  setMaterialEnvironment(m,null);assert.equal(m.version,first+2);
  m.dispose();a.dispose();b.dispose();
 }
 setMaterialEnvironment(null,null);
});
