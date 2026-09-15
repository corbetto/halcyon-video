import test from 'node:test';
import assert from 'node:assert/strict';
import { parkingLayout } from '../src/parking-layout.ts';

for (const width of [44,68,86.8,104]) for (const depth of [4.7,6.5]) {
  test(`parking circulation remains clear for ${width} ft store, ${depth} ft walk`,()=>{
    const p=parkingLayout(width,depth,-45);
    assert.equal(p.farRowZ-(p.nearZ+p.stallDepth),24,'two-way front drive aisle');
    assert.ok(Math.abs(p.left-p.stallDepth-p.minX-24)<1e-8,'left side drive aisle');
    assert.ok(Math.abs(p.maxX-(p.right+p.stallDepth)-24)<1e-8,'right side drive aisle');
    assert.equal(p.maxX-p.drivewayMinX,24,'driveway reaches the right side aisle');
    const near=p.spaces.filter(s=>s.z>p.frontZ&&s.z<p.farRowZ);
    assert.ok(near.every(s=>Math.abs(s.x-p.centerX)-p.stallWidth/2>=3),'six-foot ramp approach stays clear');
    assert.ok(p.spaces.some(s=>s.x<p.left)&&p.spaces.some(s=>s.x>p.right),'parking on both building sides');
    for(const s of p.spaces) {
      const hx=Math.abs(Math.cos(s.yaw))*p.stallWidth/2+Math.abs(Math.sin(s.yaw))*p.stallDepth/2;
      const hz=Math.abs(Math.sin(s.yaw))*p.stallWidth/2+Math.abs(Math.cos(s.yaw))*p.stallDepth/2;
      assert.ok(s.x-hx>=p.minX&&s.x+hx<=p.maxX,'spaces remain on pavement');
      assert.ok(s.z-hz>=p.rearZ-1e-8&&s.z+hz<=p.farZ+1e-8,'spaces avoid grass and rear boundary');
      assert.ok(s.x+hx<=p.drivewayMinX,'no parked car in driveway');
    }
  });
}
