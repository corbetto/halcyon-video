import test from 'node:test';
import assert from 'node:assert/strict';
import { clerkShouldRender } from '../src/clerk-visibility.ts';

test('terminal suppression hides an awake clerk and restores her afterward', () => {
  assert.equal(clerkShouldRender(1, false), true);
  assert.equal(clerkShouldRender(1, true), false);
  assert.equal(clerkShouldRender(1, false), true);
});

test('ending terminal suppression preserves the clerk sleep fade', () => {
  assert.equal(clerkShouldRender(0, true), false);
  assert.equal(clerkShouldRender(0, false), false);
  assert.equal(clerkShouldRender(0.5, false), true);
});
