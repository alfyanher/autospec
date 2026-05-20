import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deepMerge } from './config.js';

test('deepMerge produces a new object without mutating base', () => {
  const base = { a: { x: 1 } };
  deepMerge(base, { a: { y: 2 } });
  assert.deepEqual(base, { a: { x: 1 } });
});

test('deepMerge merges nested objects', () => {
  const result = deepMerge({ a: { x: 1, y: 2 }, b: 3 }, { a: { y: 99, z: 10 }, c: 4 });
  assert.deepEqual(result, { a: { x: 1, y: 99, z: 10 }, b: 3, c: 4 });
});

test('deepMerge replaces arrays outright (no concat)', () => {
  const result = deepMerge({ list: [1, 2, 3] }, { list: [4, 5] });
  assert.deepEqual(result.list, [4, 5]);
});

test('deepMerge adds keys not in base', () => {
  const result = deepMerge({ a: 1 }, { b: 2 });
  assert.equal(result.b, 2);
});

test('deepMerge override null replaces nested object', () => {
  const result = deepMerge({ a: { x: 1 } }, { a: null });
  assert.equal(result.a, null);
});

test('deepMerge handles empty override', () => {
  const base = { a: 1, b: { c: 2 } };
  const result = deepMerge(base, {});
  assert.deepEqual(result, base);
});

test('deepMerge handles empty base', () => {
  const result = deepMerge({}, { a: 1 });
  assert.deepEqual(result, { a: 1 });
});

test('deepMerge does not mutate override', () => {
  const override = { a: { y: 2 } };
  deepMerge({ a: { x: 1 } }, override);
  assert.deepEqual(override, { a: { y: 2 } });
});
