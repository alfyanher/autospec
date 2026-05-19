import { readdir, readFile } from 'fs/promises';
import { join, extname } from 'path';
import ignore from 'ignore';

const SOURCE_EXTENSIONS = new Set([
  '.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.rs',
  '.java', '.rb', '.php', '.swift', '.kt', '.cs',
  '.vue', '.svelte', '.astro',
]);

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg',
  '.pdf', '.zip', '.tar', '.gz', '.wasm', '.bin', '.exe',
  '.ttf', '.woff', '.woff2', '.eot', '.mp4', '.mp3', '.wav',
]);

const CONFIG_FILES = [
  'package.json', 'tsconfig.json', 'Cargo.toml', 'go.mod',
  'pyproject.toml', 'requirements.txt', 'Gemfile', 'pom.xml',
  'docker-compose.yml', 'Dockerfile', '.env.example',
  'Makefile', 'justfile',
];

const MAX_FILE_SIZE = 50_000;
const MAX_FILES_CONTENT = 30;
// Rough token estimate: 1 token ≈ 4 chars
const CHARS_PER_TOKEN = 4;

export async function scanProject(projectRoot, config) {
  const ig = ignore();

  try {
    const gitignore = await readFile(join(projectRoot, '.gitignore'), 'utf-8');
    ig.add(gitignore);
  } catch {
    // No .gitignore — that's fine
  }

  ig.add(['node_modules', '.git', '.autospec', 'dist', 'build', 'coverage', '*.lock']);

  if (Array.isArray(config.settings?.ignore)) {
    ig.add(config.settings.ignore);
  }

  const context = {
    fileTree: '',
    sourceFiles: [],
    configFiles: [],
    packageManifest: '',
    readme: '',
    gitHistory: '',
    importMap: [],
    routeFiles: [],
    fileCount: 0,
    dirCount: 0,
    tokenEstimate: 0,
  };

  const tree = await buildFileTree(projectRoot, ig, '', 0, config.settings?.max_depth ?? 4);
  context.fileTree = tree.text;
  context.fileCount = tree.fileCount;
  context.dirCount = tree.dirCount;

  const allFiles = await getAllFiles(projectRoot, ig);
  const sourceFiles = allFiles.filter((f) => SOURCE_EXTENSIONS.has(extname(f)));
  const prioritized = prioritizeFiles(sourceFiles);

  let totalChars = context.fileTree.length;

  for (const file of prioritized) {
    if (context.sourceFiles.length >= MAX_FILES_CONTENT) break;

    // Skip known binary extensions without reading
    if (BINARY_EXTENSIONS.has(extname(file))) continue;

    try {
      const content = await readFile(join(projectRoot, file), 'utf-8');

      // Skip binary files that slipped through (detect null bytes)
      if (hasBinaryContent(content)) continue;

      if (content.length > MAX_FILE_SIZE) continue;

      totalChars += content.length;
      context.sourceFiles.push({ path: normalizePath(file), content });

      if (isRouteFile(file, content)) {
        context.routeFiles.push({ path: normalizePath(file), content });
      }

      const imports = extractImports(content);
      if (imports.length > 0) {
        context.importMap.push({ file: normalizePath(file), imports });
      }
    } catch {
      // Permission error, symlink loop, etc. — skip silently
    }
  }

  for (const configFile of CONFIG_FILES) {
    try {
      const content = await readFile(join(projectRoot, configFile), 'utf-8');
      if (hasBinaryContent(content)) continue;
      context.configFiles.push({ path: configFile, content });
      if (configFile === 'package.json') {
        context.packageManifest = content;
        totalChars += content.length;
      }
    } catch {
      // Config file not present — skip
    }
  }

  for (const readmeName of ['README.md', 'readme.md', 'Readme.md', 'README.rst']) {
    try {
      context.readme = await readFile(join(projectRoot, readmeName), 'utf-8');
      totalChars += context.readme.length;
      break;
    } catch {}
  }

  if (config.settings?.include_git_history !== false) {
    context.gitHistory = await getGitHistory(projectRoot);
    totalChars += context.gitHistory.length;
  }

  context.tokenEstimate = Math.round(totalChars / CHARS_PER_TOKEN);

  return context;
}

async function buildFileTree(dir, ig, prefix, depth, maxDepth) {
  if (depth > maxDepth) return { text: `${prefix}...\n`, fileCount: 0, dirCount: 0 };

  let text = '';
  let fileCount = 0;
  let dirCount = 0;

  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return { text: '', fileCount: 0, dirCount: 0 };
  }

  const filtered = entries.filter((e) => {
    try { return !ig.ignores(e.name); } catch { return false; }
  });

  for (const entry of filtered.sort((a, b) => a.name.localeCompare(b.name))) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      dirCount++;
      text += `${relativePath}/\n`;
      const sub = await buildFileTree(
        join(dir, entry.name), ig, relativePath, depth + 1, maxDepth
      );
      text += sub.text;
      fileCount += sub.fileCount;
      dirCount += sub.dirCount;
    } else if (!BINARY_EXTENSIONS.has(extname(entry.name))) {
      fileCount++;
      text += `${relativePath}\n`;
    }
  }

  return { text, fileCount, dirCount };
}

async function getAllFiles(dir, ig, base = '') {
  const files = [];

  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    const relativePath = base ? `${base}/${entry.name}` : entry.name;

    try {
      if (ig.ignores(relativePath) || ig.ignores(entry.name)) continue;
    } catch {
      continue;
    }

    if (entry.isDirectory()) {
      const subFiles = await getAllFiles(join(dir, entry.name), ig, relativePath);
      files.push(...subFiles);
    } else if (!BINARY_EXTENSIONS.has(extname(entry.name))) {
      files.push(relativePath);
    }
  }

  return files;
}

function prioritizeFiles(files) {
  const priority = [
    /index\.[jt]sx?$/,
    /main\.[jt]sx?$/,
    /app\.[jt]sx?$/,
    /server\.[jt]sx?$/,
    /routes?\//,
    /controllers?\//,
    /services?\//,
    /models?\//,
    /lib\//,
    /src\//,
  ];

  return files.sort((a, b) => {
    const aScore = priority.findIndex((p) => p.test(a));
    const bScore = priority.findIndex((p) => p.test(b));
    const aPriority = aScore === -1 ? priority.length : aScore;
    const bPriority = bScore === -1 ? priority.length : bScore;
    return aPriority - bPriority;
  });
}

function isRouteFile(path, content) {
  const routePatterns = [
    /app\.(get|post|put|delete|patch)\(/,
    /router\.(get|post|put|delete|patch)\(/,
    /@(Get|Post|Put|Delete|Patch)\(/,
    /export\s+(async\s+)?function\s+(GET|POST|PUT|DELETE)/,
    /api\/.*route/i,
  ];
  return routePatterns.some((p) => p.test(content) || p.test(path));
}

function extractImports(content) {
  const imports = [];
  const patterns = [
    /import\s+(?:[\w{},\s*]+\s+from\s+)?['"](.+?)['"]/g,
    /require\s*\(\s*['"](.+?)['"]\s*\)/g,
    /from\s+([\w.]+)\s+import/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      if (match[1]) imports.push(match[1]);
    }
  }

  return imports;
}

function hasBinaryContent(str) {
  // Check the first 8KB for null bytes — reliable binary detector
  const sample = str.slice(0, 8192);
  return sample.includes('\0');
}

function normalizePath(p) {
  // Normalize Windows backslashes to forward slashes for consistent output
  return p.replace(/\\/g, '/');
}

async function getGitHistory(projectRoot) {
  const { execSync } = await import('child_process');
  try {
    return execSync('git log --oneline --no-merges -50', {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 5_000,
    });
  } catch {
    return 'Git history unavailable (not a git repo or no commits)';
  }
}
