import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { candyPouchRows, rackPouchMatrix, gondolaPouchMatrix } from '../src/fixtures/candy-pouch.ts';

test('only proved public rack rows and dimensions receive hanging bags', () => {
  const labels = ['CHOCO BARS','GUMMY BEARS','POPCORN','MOVIE MINTS','SOUR RIBBONS'];
  assert.deepEqual(candyPouchRows(labels,3,1.6,5),[1,2,4]);
  for(const [w,d,r] of [[2.5,1.6,5],[3,2,5],[3,1.6,6]]) assert.deepEqual(candyPouchRows(labels,w,d,r),[]);
  assert.deepEqual(candyPouchRows([],3,1.6,5),[]);
  const custom = [...labels];custom[1]='CUSTOM TREATS';
  assert.deepEqual(candyPouchRows(custom,3,1.6,5),[2,4]);
  assert.deepEqual(candyPouchRows([...labels].reverse(),3,1.6,5),[2]);
});

test('rack bag hole and wire load coincide on proved mounts, inside the footprint', () => {
  for(const row of [1,2,4]) for(let facing=0;facing<6;facing++) {
    const matrix=rackPouchMatrix(row,facing);
    const rest=new THREE.Vector3(0,7/12-.0285,0).applyMatrix4(matrix);
    const peg=new THREE.Matrix4().makeRotationY(Math.PI).setPosition((facing-2.5)*.45,.615+row*.7+.5636862691031603,0);
    const load=new THREE.Vector3(0,-.01385293577,.18).applyMatrix4(peg);
    assert.ok(rest.distanceTo(load)<1e-8);
    const bottom=new THREE.Vector3().applyMatrix4(matrix);
    assert.ok(bottom.y>.6+row*.7);
    assert.ok(Math.abs(bottom.x)+.21<1.5);
    assert.ok(Math.abs(bottom.z)+.075<.8);
    assert.ok(new THREE.Vector3(0,0,1).transformDirection(matrix).z<-.99);
    if(facing<5){const next=new THREE.Vector3().applyMatrix4(rackPouchMatrix(row,facing+1));assert.ok(next.x-bottom.x>.42);}
  }
});

test('gondola full pouch mounts reach the long peg and remain in original envelope', () => {
  for(let tier=0;tier<2;tier++) for(let facing=0;facing<7;facing++) {
    const matrix=gondolaPouchMatrix(tier,facing);
    const rest=new THREE.Vector3(0,.72-.0285,0).applyMatrix4(matrix);
    const peg=new THREE.Matrix4().makeTranslation((facing-3)*.53,3.2+tier+.77535293577,-.65);
    const load=new THREE.Vector3(0,-.01385293577,.75).applyMatrix4(peg);
    assert.ok(rest.distanceTo(load)<1e-8);
    const bottom=new THREE.Vector3().applyMatrix4(matrix);
    assert.ok(Math.abs(bottom.x)+.25<=2);
    assert.ok(bottom.y+.72<=5);
    assert.ok(Math.abs(bottom.z)+.1<=.8);
    assert.ok(new THREE.Vector3(0,0,1).transformDirection(matrix).z>.99);
  }
});
