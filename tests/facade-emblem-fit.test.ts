import { test } from 'node:test';
import assert from 'node:assert/strict';
import { facadeEmblemScale } from '../src/facade-emblem-fit.ts';
const field = { baseY: 17.1, halfWidth: 6.6, height: 6 };
test('an enlarged round emblem remains full size where its outline fits the gable', () => {
  const circle = Array.from({length: 96}, (_,i) => ({x: 4.8 * Math.cos(i*Math.PI/48), y: 4.8 * Math.sin(i*Math.PI/48)}));
  assert.equal(facadeEmblemScale(circle,15.65,field,true),1);
});
test('a rectangular brand cannot overhang the sloping roof after enlargement', () => {
  const corners = [-8,8].flatMap(x=>[-4.8,4.8].map(y=>({x,y})));
  const scale=facadeEmblemScale(corners,15.65,field,true);
  assert.ok(scale>0 && scale<1);
  for(const p of corners) {
    const y=15.65+p.y*scale;
    const half=y>field.baseY ? field.halfWidth*(1-(y-field.baseY)/field.height) : field.halfWidth+1;
    assert.ok(Math.abs(p.x*scale)<half);
  }
});
