import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shuffledStock, placeStockCart } from '../src/fixtures/stock-cart-layout.ts';
import { validateLayout } from '../src/layout-validator.ts';
const random = () => { let seed = 721; return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); };
test('cart mixes actual stock, deduplicates titles and excludes unowned suggestions', () => {
  const items = Array.from({ length: 80 }, (_, i) => ({ id: String(i), year: 1900 + i }));
  const selected = shuffledStock([...items, ...items, { id: 'suggestion', year: 2026, discovery: true }], 48, random());
  assert.equal(selected.length, 48); assert.equal(new Set(selected.map(i => i.id)).size, 48);
  assert.ok(!selected.some(i => i.id === 'suggestion')); assert.ok(selected.some(i => i.year < 1930));
});
test('cart visits different legal locations while keeping circulation clear', () => {
  const rand = random(), positions = new Set();
  const bounds = { minX: -30, maxX: 50, minZ: -45, maxZ: 15 };
  const obstacles = [{ label: 'aisle', kind: 'shelving' as const, cx: 0, cz: -20, w: 5, d: 30, yaw: .3 }];
  for (let i = 0; i < 12; i++) {
    const p = placeStockCart(obstacles, bounds, rand); assert.ok(p);
    positions.add(JSON.stringify(p.position));
    const f = { label: 'cart', kind: 'fixture' as const, cx: p.position.x + .2 * Math.cos(p.yaw), cz: p.position.z - .2 * Math.sin(p.yaw), w: 3.8, d: 1.9, yaw: p.yaw, clearance: 1.5 };
    assert.deepEqual(validateLayout([f, ...obstacles], bounds), []);
  }
  assert.ok(positions.size > 3);
});
