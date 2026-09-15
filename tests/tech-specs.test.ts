import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Stub only font asset loading; execute the production canvas renderer.
const source = (await readFile(new URL('../src/tech-specs.ts', import.meta.url), 'utf8'))
  .replace("import { BB_OUTFIT, BB_ORBITRON } from './bundled-fonts';",
    "const BB_OUTFIT = 'Outfit', BB_ORBITRON = 'Orbitron';");
const js = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
} }).outputText;
const { drawTechSpecsTable, TECH_SPECS_TABLE_H } = await import(
  'data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

function canvasSpy() {
  const texts: string[] = [];
  const calls: string[] = [];
  const ctx = new Proxy({} as any, {
    get(target, key) {
      if (key in target) return target[key];
      return (...args: any[]) => {
        calls.push(String(key));
        if (key === 'fillText') texts.push(args[0]);
        if (key === 'measureText') return { width: String(args[0]).length * 4 };
      };
    },
  });
  return { ctx, texts, calls };
}
const movie = { duration: '1h 50m', rating: 'PG-13', year: 2026 };

test('streaming titles draw no physical specifications, including when marked 4K', () => {
  for (const is4k of [false, true]) {
    const { ctx, calls } = canvasSpy();
    assert.equal(drawTechSpecsTable(ctx, 44, 720, 552,
      { ...movie, streaming: true, is4k }, { accent: '#222' }), 0);
    assert.deepEqual(calls, [], 'no disc pills, subtitle defaults, or legal footer are painted');
  }
});

test('local-media backs keep their existing DVD table and supplied runtime and rating', () => {
  for (const streaming of [undefined, false]) {
    const { ctx, texts } = canvasSpy();
    assert.equal(drawTechSpecsTable(ctx, 44, 720, 552,
      { ...movie, streaming }, { accent: '#222' }), TECH_SPECS_TABLE_H);
    assert.ok(texts.includes('DVD'));
    assert.ok(texts.includes('110 min.'));
    assert.ok(texts.includes('PG-13'));
    assert.ok(texts.some(text => text.includes('REGION 1')));
  }
});
