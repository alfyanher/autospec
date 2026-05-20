import { readFile, writeFile, readdir } from 'fs/promises';
import { join } from 'path';
import YAML from 'yaml';

const CURRENT_CONFIG_VERSION = 1;

const DEFAULT_CONFIG = {
  version: CURRENT_CONFIG_VERSION,
  project: {
    name: 'auto-detected',
    type: 'auto-detected',
  },
  generate: [
    'architecture',
    'onboarding',
    'decisions',
    'components',
    'api',
    'dependencies',
    'claude',
  ],
  settings: {
    tone: 'concise',
    update_on: 'commit',
    ignore: [
      'node_modules/',
      'dist/',
      'build/',
      'coverage/',
      '*.test.*',
      '*.spec.*',
      '__tests__/',
    ],
    max_depth: 4,
    include_git_history: true,
  },
};

export { deepMerge };

export async function loadConfig(projectRoot) {
  const configPath = join(projectRoot, '.autospec.yaml');

  let parsed;
  try {
    const content = await readFile(configPath, 'utf-8');
    parsed = YAML.parse(content);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw new Error(`Failed to parse .autospec.yaml: ${err.message}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('.autospec.yaml is empty or not a valid YAML object.');
  }

  return deepMerge(DEFAULT_CONFIG, parsed);
}

export async function initConfig(projectRoot) {
  const configPath = join(projectRoot, '.autospec.yaml');

  const config = deepMerge(DEFAULT_CONFIG, {
    project: {
      name: await detectProjectName(projectRoot),
      type: await detectProjectType(projectRoot),
    },
  });

  const yamlContent = YAML.stringify(config, { indent: 2 });

  const header = `# AutoSpec Configuration
# Docs: https://github.com/alfyanher/autospec
# Regenerate: autospec generate
# ---

`;

  await writeFile(configPath, header + yamlContent, 'utf-8');

  return config;
}

async function detectProjectName(projectRoot) {
  try {
    const pkg = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf-8'));
    if (pkg.name && typeof pkg.name === 'string') return pkg.name;
  } catch {}

  try {
    const cargo = await readFile(join(projectRoot, 'Cargo.toml'), 'utf-8');
    const match = cargo.match(/^name\s*=\s*"(.+?)"/m);
    if (match) return match[1];
  } catch {}

  try {
    const pyproject = await readFile(join(projectRoot, 'pyproject.toml'), 'utf-8');
    const match = pyproject.match(/^name\s*=\s*"(.+?)"/m);
    if (match) return match[1];
  } catch {}

  return projectRoot.replace(/\\/g, '/').split('/').pop() || 'project';
}

async function detectProjectType(projectRoot) {
  let entries;
  try {
    entries = await readdir(projectRoot);
  } catch {
    return 'general';
  }

  const entrySet = new Set(entries);

  if (entrySet.has('packages') || entrySet.has('apps')) return 'monorepo';
  if (entrySet.has('pages') || entrySet.has('app') || entrySet.has('components')) return 'webapp';
  if (entrySet.has('routes') || entrySet.has('controllers') || entrySet.has('endpoints')) return 'api';
  if (entrySet.has('bin') || entrySet.has('cmd')) return 'cli';
  if (entrySet.has('lib')) return 'library';

  return 'general';
}

function deepMerge(base, override) {
  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof result[key] === 'object' &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
