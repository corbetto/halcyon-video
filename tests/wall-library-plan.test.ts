import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { JellyfinLibrary, Movie } from '../src/jellyfin.ts';
Object.defineProperty(globalThis, 'localStorage', { value: {
  getItem: (key: string) => key === 'bb_store_format' ? 'mom-and-pop' : null,
  setItem: () => {},
}, configurable: true });
const { StorePlan } = await import('../src/store-plan.ts');
const { UNIT_SIDE_CAPACITY, STORE_CENTER_X } = await import('../src/store-layout.ts');
function library(count: number, index: number): JellyfinLibrary {
  return { id: String(index), name: `Library ${index}`, movies: Array.from({ length: count }, (_, i) => ({
    id: `${index}-${i}`, title: `Movie ${i}`, year: 1990, genres: ['Comedy'],
    actors: [], rating: 'PG', director: '', duration: '', overview: '', localPath: '',
  } as Movie)) } as JellyfinLibrary;
}
for (const counts of [[40], [500], [900, 150], [2000, 400, 120]]) {
  test(`wall library preserves every stock block and clear interior aisles: ${counts}`, () => {
    const plan = new StorePlan(counts.map(library));
    plan.plan();
    const walls = plan.shelvingUnits.filter(unit => unit.singleSided);
    assert.ok(walls.length > 0);
    for (let lib = 0; lib < counts.length; lib++) {
      const order = plan.entryBlockOrder(lib);
      assert.ok(order.length * UNIT_SIDE_CAPACITY >= plan.layoutFor(lib).entries.length);
      assert.equal(new Set(order.map(block => `${block.unit}:${block.side}`)).size, order.length);
      for (const block of order) {
        const unit = plan.shelvingUnits.find(unit => unit.libraryIdx === lib && unit.unitIdxInLibrary === block.unit)!;
        assert.ok(!unit.singleSided || block.side === 'front');
      }
    }
    for (const wall of walls) {
      assert.equal(plan.blockIndexOf(wall.libraryIdx, wall.unitIdxInLibrary, 'back'), Number.MAX_SAFE_INTEGER);
      assert.equal(wall.browseSign, wall.xCenter < STORE_CENTER_X ? 1 : -1);
      assert.ok(!plan.openLineFrontEnds().some(end => end.unit === wall));
    }
    const footprints = plan.getUnitFootprints();
    const left = STORE_CENTER_X - plan.getStoreWidth() / 2;
    const right = STORE_CENTER_X + plan.getStoreWidth() / 2;
    for (const fp of footprints) {
      assert.ok(fp.cx - fp.w / 2 >= left - .01);
      assert.ok(fp.cx + fp.w / 2 <= right + .01);
    }
    for (const wall of walls) for (const inner of plan.shelvingUnits.filter(unit => !unit.singleSided)) {
      assert.ok(Math.abs(wall.xCenter - inner.xCenter) - 2.16 >= 3,
        'at least three feet clear beside wall shelving');
    }
  });
}
