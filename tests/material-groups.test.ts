import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry, BufferGeometry, MeshStandardMaterial} from 'three';
import {mergeAdjacentMaterialGroups} from '../src/material-groups.ts';

test('clasp edge faces share one draw while print, UVs and every triangle stay intact',()=>{
  const geometry=new BoxGeometry(.03,.3,.9),face=new MeshStandardMaterial(),edge=new MeshStandardMaterial();
  const indices=Array.from(geometry.index!.array),uvs=Array.from(geometry.attributes.uv.array);
  const materials=[face,edge,edge,edge,edge,edge];
  const before=indices.map((_,i)=>materials[geometry.groups.find(g=>i>=g.start&&i<g.start+g.count)!.materialIndex!]);
  mergeAdjacentMaterialGroups(geometry,materials);
  assert.deepEqual(geometry.groups,[{start:0,count:6,materialIndex:0},{start:6,count:30,materialIndex:1}]);
  assert.deepEqual(Array.from(geometry.index!.array),indices);
  assert.deepEqual(Array.from(geometry.attributes.uv.array),uvs);
  const after=indices.map((_,i)=>materials[geometry.groups.find(g=>i>=g.start&&i<g.start+g.count)!.materialIndex!]);
  assert.deepEqual(after,before);
  mergeAdjacentMaterialGroups(geometry,materials);
  assert.equal(geometry.groups.length,2);
  geometry.dispose();face.dispose();edge.dispose();
});

test('different finishes, gaps and undefined material slots stay separate',()=>{
  const g=new BufferGeometry(),a=new MeshStandardMaterial(),b=new MeshStandardMaterial();
  g.addGroup(0,3,0);g.addGroup(3,3,1);g.addGroup(9,3,1);g.addGroup(12,3,2);g.addGroup(15,3,3);
  const before=JSON.parse(JSON.stringify(g.groups));
  mergeAdjacentMaterialGroups(g,[a,b]);assert.deepEqual(g.groups,before);
  g.dispose();a.dispose();b.dispose();
});
