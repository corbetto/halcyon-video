import test from 'node:test';
import assert from 'node:assert/strict';
import { waitForStartupModel } from '../src/startup-reveal.ts';

test('startup reveal waits for delayed model installation', async () => {
  let complete!: () => void;
  const model = new Promise<void>(resolve => { complete = resolve; });
  let revealed = false;
  const ready = waitForStartupModel(model).then(() => { revealed = true; });
  await Promise.resolve();
  assert.equal(revealed, false);
  complete(); await ready;
  assert.equal(revealed, true);
});

test('missing and failed models do not prevent entry', async () => {
  await waitForStartupModel(undefined);
  await waitForStartupModel(Promise.reject(new Error('missing')));
});

test('a model that never answers has a bounded wait', async () => {
  await waitForStartupModel(new Promise(() => {}), 10);
});
