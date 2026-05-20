import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'path';
import {
  fillTemplate,
  truncatePrompt,
  filterDocs,
  resolveOutputPath,
} from './generator.js';

// ── truncatePrompt ────────────────────────────────────────────────────────────

test('truncatePrompt returns unchanged string when under limit', () => {
  const short = 'x'.repeat(1000);
  assert.equal(truncatePrompt(short), short);
});

test('truncatePrompt returns unchanged string exactly at limit', () => {
  const exact = 'x'.repeat(100_000);
  assert.equal(truncatePrompt(exact), exact);
});

test('truncatePrompt truncates long string and appends marker', () => {
  const long = 'x'.repeat(110_000);
  const result = truncatePrompt(long);
  assert.ok(result.length <= 100_000, 'result exceeds max length');
  assert.ok(result.includes('[Context truncated'), 'truncation marker missing');
});

// ── fillTemplate ─────────────────────────────────────────────────────────────

const emptyContext = {
  fileTree: '',
  sourceFiles: [],
  configFiles: [],
  packageManifest: '',
  readme: '',
  gitHistory: '',
  importMap: [],
  routeFiles: [],
};

test('fillTemplate replaces {{FILE_TREE}}', () => {
  const result = fillTemplate('Tree: {{FILE_TREE}}', { ...emptyContext, fileTree: 'src/' });
  assert.equal(result, 'Tree: src/');
});

test('fillTemplate replaces {{README}}', () => {
  const result = fillTemplate('Readme: {{README}}', { ...emptyContext, readme: '# My Project' });
  assert.equal(result, 'Readme: # My Project');
});

test('fillTemplate uses fallback for missing readme', () => {
  const result = fillTemplate('{{README}}', emptyContext);
  assert.equal(result, 'No README found');
});

test('fillTemplate replaces {{PACKAGE_MANIFEST}}', () => {
  const ctx = { ...emptyContext, packageManifest: '{"name":"test"}' };
  const result = fillTemplate('{{PACKAGE_MANIFEST}}', ctx);
  assert.equal(result, '{"name":"test"}');
});

test('fillTemplate {{LOCK_SUMMARY}} produces condensed dep list', () => {
  const manifest = JSON.stringify({ dependencies: { foo: '^1.0.0' }, devDependencies: { bar: '^2.0.0' } });
  const result = fillTemplate('{{LOCK_SUMMARY}}', { ...emptyContext, packageManifest: manifest });
  assert.ok(result.includes('foo: ^1.0.0'));
  assert.ok(result.includes('bar: ^2.0.0'));
});

test('fillTemplate {{LOCK_SUMMARY}} does not repeat full package.json', () => {
  const manifest = JSON.stringify({ name: 'project', version: '1.0.0', description: 'long text', dependencies: { foo: '^1.0.0' } });
  const result = fillTemplate('{{LOCK_SUMMARY}}', { ...emptyContext, packageManifest: manifest });
  assert.ok(!result.includes('"description"'), 'lock summary should not include description field');
});

test('fillTemplate replaces all placeholders in one pass', () => {
  const template = '{{FILE_TREE}} | {{README}}';
  const ctx = { ...emptyContext, fileTree: 'TREE', readme: 'README' };
  assert.equal(fillTemplate(template, ctx), 'TREE | README');
});

// ── resolveOutputPath ─────────────────────────────────────────────────────────

test('resolveOutputPath places normal docs in outputDir', () => {
  const result = resolveOutputPath('/project', '/project/.autospec', 'ARCHITECTURE.md');
  assert.equal(result, join('/project', '.autospec', 'ARCHITECTURE.md'));
});

test('resolveOutputPath places ../ docs at projectRoot', () => {
  const result = resolveOutputPath('/project', '/project/.autospec', '../CLAUDE.md');
  assert.equal(result, join('/project', 'CLAUDE.md'));
});

test('resolveOutputPath rejects nested traversal in ../ prefix', () => {
  assert.throws(
    () => resolveOutputPath('/project', '/project/.autospec', '../subdir/file.md'),
    /Invalid doc output path/,
  );
});

test('resolveOutputPath rejects double traversal', () => {
  assert.throws(
    () => resolveOutputPath('/project', '/project/.autospec', '../../etc/passwd'),
    /Invalid doc output path/,
  );
});

// ── filterDocs ────────────────────────────────────────────────────────────────

test('filterDocs excludes api doc when no route files', () => {
  const docs = filterDocs({ generate: [] }, { routeFiles: [] });
  assert.equal(docs.find((d) => d.id === 'api'), undefined);
});

test('filterDocs includes api doc when route files exist', () => {
  const docs = filterDocs({ generate: [] }, { routeFiles: [{ path: 'r.js', content: '' }] });
  assert.ok(docs.find((d) => d.id === 'api'));
});

test('filterDocs returns all non-conditional docs when generate is empty', () => {
  const docs = filterDocs({ generate: [] }, { routeFiles: [] });
  const ids = docs.map((d) => d.id);
  assert.ok(ids.includes('architecture'));
  assert.ok(ids.includes('onboarding'));
  assert.ok(ids.includes('dependencies'));
});

test('filterDocs filters to specified generate list', () => {
  const docs = filterDocs({ generate: ['architecture', 'onboarding'] }, { routeFiles: [] });
  const ids = docs.map((d) => d.id);
  assert.deepEqual(ids.sort(), ['architecture', 'onboarding'].sort());
});

test('filterDocs generate list overrides conditional — api excluded if not in list', () => {
  const docs = filterDocs(
    { generate: ['architecture'] },
    { routeFiles: [{ path: 'r.js', content: '' }] },
  );
  assert.equal(docs.find((d) => d.id === 'api'), undefined);
});
