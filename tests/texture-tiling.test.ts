import test from 'node:test';
import assert from 'node:assert/strict';
import { stampTiled } from '../src/texture-tiling.ts';

function fixture() {
  const offsets: number[][] = [];
  let saves = 0, restores = 0;
  const ctx = { save() { saves++; }, restore() { restores++; },
    translate(x: number, y: number) { offsets.push([x, y]); } } as CanvasRenderingContext2D;
  return { ctx, offsets, balanced: () => assert.equal(saves, restores) };
}
test('an interior fleck submits one copy, while a corner-crossing fleck keeps four', () => {
  const a = fixture(); let calls = 0;
  stampTiled(a.ctx, 512, () => calls++, 512, { x: 20, y: 30, width: 2, height: 2 });
  assert.equal(calls, 1); assert.deepEqual(a.offsets, [[0, 0]]); a.balanced();
  const b = fixture();
  stampTiled(b.ctx, 512, () => {}, 512, { x: 511.5, y: 511.5, width: 2, height: 2 });
  assert.deepEqual(b.offsets, [[-512, -512], [-512, 0], [0, -512], [0, 0]]); b.balanced();
});
test('unknown bounds retain all nine callbacks in their original order', () => {
  const f = fixture(); let calls = 0;
  stampTiled(f.ctx, 100, () => calls++, 50);
  assert.equal(calls, 9);
  assert.deepEqual(f.offsets, [-100, 0, 100].flatMap(x => [-50, 0, 50].map(y => [x, y])));
  f.balanced();
});
test('non-square, oversized and fractional stamps retain every possibly covered pixel', () => {
  let seed = 1979; const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 1000; i++) {
    const bounds = { x: random() * 600 - 300, y: random() * 300 - 150,
      width: random() * 500, height: random() * 250 };
    const f = fixture(); stampTiled(f.ctx, 256, () => {}, 128, bounds);
    for (const ox of [-256, 0, 256]) for (const oy of [-128, 0, 128]) {
      if (bounds.x + ox < 256 && bounds.y + oy < 128
          && bounds.x + bounds.width + ox > 0 && bounds.y + bounds.height + oy > 0)
        assert.ok(f.offsets.some(([x, y]) => x === ox && y === oy), 'visible copy was discarded');
    }
    f.balanced();
  }
});
test('invalid bounds use the conservative path and a failed painter restores context', () => {
  for (const bounds of [{ x: NaN, y: 0, width: 2, height: 2 }, { x: 0, y: 0, width: -2, height: 2 }]) {
    const f = fixture(); stampTiled(f.ctx, 256, () => {}, 256, bounds); assert.equal(f.offsets.length, 9);
  }
  const f = fixture(); assert.throws(() => stampTiled(f.ctx, 256, () => { throw Error('paint failed'); })); f.balanced();
});
