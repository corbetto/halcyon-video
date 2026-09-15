import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Docker whitelist includes every server module imported by Vite configuration', () => {
  const root = new URL('../', import.meta.url);
  const config = readFileSync(new URL('vite.config.ts', root), 'utf8');
  const rules = readFileSync(new URL('.dockerignore', root), 'utf8').split(/\r?\n/);
  for (const match of config.matchAll(/from\s+["']\.\/(tools\/[^"']+)["']/g)) {
    assert.ok(rules.includes('!' + match[1]), `${match[1]} must reach the container build and runtime`);
  }
});
