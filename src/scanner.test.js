import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePath,
  extractImports,
  isRouteFile,
  hasBinaryContent,
  prioritizeFiles,
} from './scanner.js';

test('normalizePath converts backslashes to forward slashes', () => {
  assert.equal(normalizePath('src\\foo\\bar.js'), 'src/foo/bar.js');
});

test('normalizePath is a no-op for forward slashes', () => {
  assert.equal(normalizePath('src/foo/bar.js'), 'src/foo/bar.js');
});

test('normalizePath handles mixed separators', () => {
  assert.equal(normalizePath('src\\routes/users.js'), 'src/routes/users.js');
});

test('hasBinaryContent detects null bytes', () => {
  assert.equal(hasBinaryContent('hello\0world'), true);
});

test('hasBinaryContent returns false for plain text', () => {
  assert.equal(hasBinaryContent('const x = 1;\n'), false);
});

test('hasBinaryContent returns false for empty string', () => {
  assert.equal(hasBinaryContent(''), false);
});

test('extractImports finds ES module default import', () => {
  const code = "import foo from 'bar';";
  assert.deepEqual(extractImports(code), ['bar']);
});

test('extractImports finds ES module named import', () => {
  const code = "import { x, y } from 'baz';";
  assert.deepEqual(extractImports(code), ['baz']);
});

test('extractImports finds side-effect import', () => {
  const code = "import 'polyfill';";
  assert.deepEqual(extractImports(code), ['polyfill']);
});

test('extractImports finds CJS require', () => {
  const code = "const foo = require('bar');";
  assert.deepEqual(extractImports(code), ['bar']);
});

test('extractImports finds Python from-import', () => {
  const code = 'from os import path\n';
  assert.deepEqual(extractImports(code), ['os']);
});

test('extractImports returns empty array when no imports', () => {
  assert.deepEqual(extractImports('const x = 42;'), []);
});

test('extractImports finds multiple imports', () => {
  const code = "import a from 'aaa';\nimport b from 'bbb';";
  const result = extractImports(code);
  assert.deepEqual(result, ['aaa', 'bbb']);
});

test('isRouteFile detects Express app.get', () => {
  assert.equal(isRouteFile('src/server.js', "app.get('/ping', handler)"), true);
});

test('isRouteFile detects Express router.post', () => {
  assert.equal(isRouteFile('src/routes/users.js', "router.post('/users', create)"), true);
});

test('isRouteFile detects Next.js export GET function', () => {
  assert.equal(isRouteFile('app/api/route.js', 'export async function GET(req) {}'), true);
});

test('isRouteFile returns false for non-route files', () => {
  assert.equal(isRouteFile('src/utils.js', 'export function add(a, b) { return a + b; }'), false);
});

test('prioritizeFiles sorts index files first', () => {
  const files = ['src/utils.js', 'src/index.js', 'src/helpers.js'];
  const sorted = prioritizeFiles([...files]);
  assert.equal(sorted[0], 'src/index.js');
});

test('prioritizeFiles sorts main.js before arbitrary files', () => {
  const files = ['src/config.js', 'src/main.ts'];
  const sorted = prioritizeFiles([...files]);
  assert.equal(sorted[0], 'src/main.ts');
});

test('prioritizeFiles keeps relative order for equal-priority files', () => {
  const files = ['lib/a.js', 'lib/b.js'];
  const sorted = prioritizeFiles([...files]);
  assert.equal(sorted.length, 2);
});
