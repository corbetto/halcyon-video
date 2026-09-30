import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { publishSnapshot } from '../src/catalog/publisher/storage.ts';

// Deliberately fixture-only. No credential is read and no upstream transport is
// constructed. Live publication requires the unresolved project permission gate.
try {
  const [input = 'fixtures/catalog.json', destination = 'input/published-fixture', ...rest] = process.argv.slice(2);
  if (rest.length) throw new Error('Expected fixture input and output directory only');
  const value = JSON.parse(await readFile(resolve(input), 'utf8'));
  if (value.source !== 'fixture') throw new Error('Live catalog publication is blocked pending project-specific source permission');
  const pointer = await publishSnapshot(destination, value);
  console.log(JSON.stringify({ ok: true, source: 'fixture', ...pointer }));
} catch {
  // Do not echo arbitrary input, credentials, upstream bodies or file content.
  console.error('Catalog publication failed; the previous validated artifact was retained. Live publication remains gated.');
  process.exitCode = 1;
}
