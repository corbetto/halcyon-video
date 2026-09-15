import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Docker whitelist includes every server module imported by Vite configuration', () => {
  const root = new URL('../', import.meta.url);
  const pending = ['vite.config.ts'];
  const seen = new Set<string>();
  const rules = readFileSync(new URL('.dockerignore', root), 'utf8').split(/\r?\n/);
  while (pending.length) {
    const file = pending.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(new URL(file, root), 'utf8');
    for (const match of source.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
      const target = new URL(match[1], new URL(file, root));
      const relative = target.href.slice(root.href.length);
      if (!relative.startsWith('tools/')) continue;
      assert.ok(rules.includes('!' + relative), `${relative} must reach the container build and runtime`);
      pending.push(relative);
    }
  }
});
