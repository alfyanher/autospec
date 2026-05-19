import { readFile, writeFile, mkdir, unlink } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync, execFileSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = join(__dirname, '..', 'prompts');

const DOC_CONFIGS = [
  { id: 'architecture', output: 'ARCHITECTURE.md', prompt: 'architecture.md' },
  { id: 'onboarding',   output: 'ONBOARDING.md',   prompt: 'onboarding.md' },
  { id: 'decisions',    output: 'DECISIONS.md',     prompt: 'decisions.md' },
  { id: 'components',   output: 'COMPONENTS.md',    prompt: 'components.md' },
  { id: 'api',          output: 'API.md',            prompt: 'api.md', conditional: 'hasRoutes' },
  { id: 'dependencies', output: 'DEPENDENCIES.md',  prompt: 'dependencies.md' },
  { id: 'claude',       output: '../CLAUDE.md',      prompt: 'claude-context.md' },
];

const CLAUDE_TIMEOUT_MS = 120_000;
const MAX_PROMPT_CHARS = 100_000;

export async function generateDocs(projectRoot, context, config) {
  const outputDir = join(projectRoot, '.autospec');
  await mkdir(outputDir, { recursive: true });

  const docsToGenerate = filterDocs(config, context);
  const generated = [];
  const failures = [];

  for (const doc of docsToGenerate) {
    let tempPromptPath = null;
    try {
      const promptTemplate = await readFile(join(PROMPTS_DIR, doc.prompt), 'utf-8');
      const filledPrompt = fillTemplate(promptTemplate, context);
      const truncatedPrompt = truncatePrompt(filledPrompt);

      tempPromptPath = join(outputDir, '.tmp_prompt.md');
      await writeFile(tempPromptPath, truncatedPrompt, 'utf-8');

      const result = await callClaudeCode(tempPromptPath, projectRoot);

      const outputPath = doc.output.startsWith('../')
        ? join(projectRoot, doc.output.slice(3))
        : join(outputDir, doc.output);

      await writeFile(outputPath, result, 'utf-8');
      generated.push(doc.output);
    } catch (err) {
      failures.push({ doc: doc.output, error: err.message });
    } finally {
      if (tempPromptPath) {
        try { await unlink(tempPromptPath); } catch {}
      }
    }
  }

  await writeFile(
    join(outputDir, '.meta.json'),
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      fileCount: context.fileCount,
      tokenEstimate: context.tokenEstimate,
      documents: generated,
      failures: failures.map((f) => f.doc),
      version: '0.1.0',
    }, null, 2),
    'utf-8'
  );

  return { generated, failures };
}

export async function checkClaudeCLI() {
  // Check if claude binary is on PATH
  try {
    execFileSync(claudeBin(), ['--version'], { encoding: 'utf-8', timeout: 5_000 });
    return { ok: true };
  } catch (err) {
    if (err.code === 'ENOENT') {
      return {
        ok: false,
        message:
          'Claude CLI not found. Install it with: npm install -g @anthropic-ai/claude-code\n' +
          'Then authenticate with: claude login',
      };
    }
    // Binary exists but --version failed — still treat as present
    return { ok: true };
  }
}

function filterDocs(config, context) {
  let docs = DOC_CONFIGS;

  if (Array.isArray(config.generate) && config.generate.length > 0) {
    docs = docs.filter((d) => config.generate.includes(d.id));
  }

  docs = docs.filter((d) => {
    if (d.conditional === 'hasRoutes') {
      return context.routeFiles.length > 0;
    }
    return true;
  });

  return docs;
}

function fillTemplate(template, context) {
  const replacements = {
    '{{FILE_TREE}}':        context.fileTree         || 'Not available',
    '{{SOURCE_FILES}}':     formatSourceFiles(context.sourceFiles),
    '{{DEPENDENCIES}}':     context.packageManifest  || 'Not available',
    '{{PACKAGE_MANIFEST}}': context.packageManifest  || 'Not available',
    '{{GIT_HISTORY}}':      context.gitHistory       || 'Not available',
    '{{README}}':           context.readme           || 'No README found',
    '{{CONFIG_FILES}}':     formatConfigFiles(context.configFiles),
    '{{CI_CONFIG}}':        extractCIConfig(context.configFiles),
    '{{IMPORT_MAP}}':       formatImportMap(context.importMap),
    '{{ROUTE_FILES}}':      formatSourceFiles(context.routeFiles),
    '{{MIDDLEWARE}}':       'See route files above',
    '{{SCHEMAS}}':          extractSchemas(context.sourceFiles),
    '{{LOCK_SUMMARY}}':     'See package manifest',
    '{{IMPORT_USAGE}}':     formatImportMap(context.importMap),
    '{{AUTOSPEC_DOCS}}':    'Initial generation',
    '{{CODE_SAMPLES}}':     formatCodeSamples(context.sourceFiles),
  };

  let filled = template;
  for (const [key, value] of Object.entries(replacements)) {
    filled = filled.replaceAll(key, value);
  }

  return filled;
}

function truncatePrompt(prompt) {
  if (prompt.length <= MAX_PROMPT_CHARS) return prompt;

  const marker = '\n\n[Context truncated to fit token budget. Analyze what is present.]\n';
  return prompt.slice(0, MAX_PROMPT_CHARS - marker.length) + marker;
}

async function callClaudeCode(promptFilePath, cwd) {
  const bin = claudeBin();

  // Use -p (print mode) with stdin redirect — works cross-platform via shell
  const isWindows = process.platform === 'win32';
  const cmd = isWindows
    ? `type "${promptFilePath}" | "${bin}" -p`
    : `"${bin}" -p < "${promptFilePath}"`;

  try {
    const result = execSync(cmd, {
      cwd,
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024 * 10,
      timeout: CLAUDE_TIMEOUT_MS,
      shell: true,
    });
    return result.trim();
  } catch (err) {
    if (err.killed || err.signal === 'SIGTERM') {
      throw new Error(`Claude timed out after ${CLAUDE_TIMEOUT_MS / 1000}s. Try a smaller project or add more paths to the ignore list.`);
    }
    if (err.status === 1 && err.stderr?.includes('not logged in')) {
      throw new Error('Claude CLI is not authenticated. Run: claude login');
    }
    if (err.status === 1 && err.stderr?.includes('API key')) {
      throw new Error('Missing Anthropic API key. Set ANTHROPIC_API_KEY or run: claude login');
    }
    const detail = err.stderr?.trim() || err.message;
    throw new Error(`Claude CLI failed: ${detail}`);
  }
}

function claudeBin() {
  // Allow override via environment variable for custom installations
  return process.env.CLAUDE_BIN || 'claude';
}

function formatSourceFiles(files) {
  return files.map((f) => `--- ${f.path} ---\n${f.content}`).join('\n\n');
}

function formatConfigFiles(files) {
  return files.map((f) => `--- ${f.path} ---\n${f.content}`).join('\n\n');
}

function formatImportMap(importMap) {
  return importMap
    .map((entry) => `${entry.file}: imports [${entry.imports.join(', ')}]`)
    .join('\n');
}

function formatCodeSamples(files) {
  return files
    .slice(0, 5)
    .map((f) => `--- ${f.path} ---\n${f.content.slice(0, 2000)}`)
    .join('\n\n');
}

function extractCIConfig(configFiles) {
  const ciFiles = configFiles.filter(
    (f) => f.path.includes('.github') || f.path.includes('/ci/') || f.path.includes('Jenkinsfile')
  );
  return ciFiles.map((f) => `--- ${f.path} ---\n${f.content}`).join('\n\n')
    || 'No CI config detected';
}

function extractSchemas(sourceFiles) {
  const schemaFiles = sourceFiles.filter(
    (f) => /schema|types?|model|validation|dto/i.test(f.path)
  );
  return schemaFiles.map((f) => `--- ${f.path} ---\n${f.content}`).join('\n\n')
    || 'No schemas detected';
}
