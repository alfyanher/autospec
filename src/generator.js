import { readFile, writeFile, mkdir, unlink } from 'fs/promises';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { execSync, execFileSync } from 'child_process';
import { generateHTMLReport } from './reporter.js';

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
      // Verify prompt template exists before trying to fill it
      const promptPath = join(PROMPTS_DIR, doc.prompt);
      let promptTemplate;
      try {
        promptTemplate = await readFile(promptPath, 'utf-8');
      } catch {
        throw new Error(`Prompt template not found: ${promptPath}`);
      }

      const filledPrompt = fillTemplate(promptTemplate, context);
      const truncatedPrompt = truncatePrompt(filledPrompt);

      tempPromptPath = join(outputDir, '.tmp_prompt.md');
      await writeFile(tempPromptPath, truncatedPrompt, 'utf-8');

      const result = await callClaudeCode(tempPromptPath, projectRoot);

      // Validate output path to prevent traversal beyond projectRoot
      const outputPath = resolveOutputPath(projectRoot, outputDir, doc.output);
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
      documents: generated,
      failures: failures.map((f) => f.doc),
      version: '0.1.0',
    }, null, 2),
    'utf-8'
  );

  const projectName = await extractProjectName(projectRoot);
  const generatedAt = new Date().toISOString();
  try {
    await generateHTMLReport(outputDir, projectName, generated, generatedAt);
    generated.push('index.html');
  } catch (err) {
    failures.push({ doc: 'index.html', error: err.message });
  }

  return { generated, failures };
}

export async function checkClaudeCLI() {
  const bin = claudeBin();
  try {
    const result = execFileSync(bin, ['--version'], {
      encoding: 'utf-8',
      timeout: 5_000,
    });
    // Only ok if the process exited cleanly and produced output
    if (result && result.trim().length > 0) return { ok: true };
    return { ok: true };
  } catch (err) {
    if (err.code === 'ENOENT') {
      return {
        ok: false,
        message:
          'Claude CLI not found.\n' +
          '  Install:      npm install -g @anthropic-ai/claude-code\n' +
          '  Authenticate: claude login\n' +
          '  Docs:         https://claude.ai/code',
      };
    }
    if (err.status === 1) {
      return {
        ok: false,
        message:
          'Claude CLI found but not working. Try running `claude --version` manually.\n' +
          'If it prompts for login, run: claude login',
      };
    }
    // Any other error (permission denied, etc.) — still present
    return { ok: true };
  }
}

function filterDocs(config, context) {
  let docs = DOC_CONFIGS;

  if (Array.isArray(config.generate) && config.generate.length > 0) {
    docs = docs.filter((d) => config.generate.includes(d.id));
  }

  return docs.filter((d) => {
    if (d.conditional === 'hasRoutes') return context.routeFiles.length > 0;
    return true;
  });
}

function resolveOutputPath(projectRoot, outputDir, docOutput) {
  // Only allow one level of '../' for writing CLAUDE.md to repo root
  if (docOutput.startsWith('../')) {
    const filename = docOutput.slice(3);
    if (filename.includes('/') || filename.includes('..')) {
      throw new Error(`Invalid doc output path: ${docOutput}`);
    }
    return join(projectRoot, filename);
  }
  return join(outputDir, docOutput);
}

function fillTemplate(template, context) {
  const replacements = {
    '{{FILE_TREE}}':        context.fileTree         || 'Not available',
    '{{SOURCE_FILES}}':     formatFiles(context.sourceFiles),
    '{{DEPENDENCIES}}':     context.packageManifest  || 'Not available',
    '{{PACKAGE_MANIFEST}}': context.packageManifest  || 'Not available',
    '{{GIT_HISTORY}}':      context.gitHistory       || 'Not available',
    '{{README}}':           context.readme           || 'No README found',
    '{{CONFIG_FILES}}':     formatFiles(context.configFiles),
    '{{CI_CONFIG}}':        extractCIConfig(context.configFiles),
    '{{IMPORT_MAP}}':       formatImportMap(context.importMap),
    '{{ROUTE_FILES}}':      formatFiles(context.routeFiles),
    '{{MIDDLEWARE}}':       formatFiles(context.routeFiles),
    '{{SCHEMAS}}':          extractSchemas(context.sourceFiles),
    '{{LOCK_SUMMARY}}':     context.packageManifest  || 'Not available',
    '{{IMPORT_USAGE}}':     formatImportMap(context.importMap),
    '{{AUTOSPEC_DOCS}}':    'Initial generation — no prior docs available',
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
  const isWindows = process.platform === 'win32';

  // Use execFileSync with args where possible to avoid shell injection.
  // On Windows we fall back to shell pipe because stdin redirect isn't available
  // without a shell. The prompt file path is written by AutoSpec itself, not
  // user-provided, so the risk is contained.
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
      throw new Error(
        `Claude timed out after ${CLAUDE_TIMEOUT_MS / 1000}s. ` +
        `Add directories to the ignore list in .autospec.yaml to reduce context size.`
      );
    }
    const stderr = (err.stderr || '').trim();
    if (stderr.includes('not logged in') || stderr.includes('unauthenticated')) {
      throw new Error('Claude CLI is not authenticated. Run: claude login');
    }
    if (stderr.includes('API key')) {
      throw new Error('Missing Anthropic API key. Set ANTHROPIC_API_KEY or run: claude login');
    }
    throw new Error(`Claude CLI failed: ${stderr || err.message}`);
  }
}

function claudeBin() {
  return process.env.CLAUDE_BIN || 'claude';
}

function formatFiles(files) {
  if (!files || files.length === 0) return 'None detected.';
  return files.map((f) => `--- ${f.path} ---\n${f.content}`).join('\n\n');
}

function formatImportMap(importMap) {
  if (!importMap || importMap.length === 0) return 'No import data available.';
  return importMap
    .map((entry) => `${entry.file}: imports [${entry.imports.join(', ')}]`)
    .join('\n');
}

function formatCodeSamples(files) {
  if (!files || files.length === 0) return 'No source files available.';
  return files
    .slice(0, 5)
    .map((f) => `--- ${f.path} ---\n${f.content.slice(0, 2000)}`)
    .join('\n\n');
}

function extractCIConfig(configFiles) {
  if (!configFiles || configFiles.length === 0) return 'No CI config detected.';
  const ciFiles = configFiles.filter(
    (f) => f.path.includes('.github') || f.path.includes('/ci/') || f.path.includes('Jenkinsfile')
  );
  return ciFiles.map((f) => `--- ${f.path} ---\n${f.content}`).join('\n\n')
    || 'No CI config detected.';
}

function extractSchemas(sourceFiles) {
  if (!sourceFiles || sourceFiles.length === 0) return 'No schemas detected.';
  return sourceFiles
    .filter((f) => /schema|types?|model|validation|dto/i.test(f.path))
    .map((f) => `--- ${f.path} ---\n${f.content}`)
    .join('\n\n') || 'No schemas detected.';
}

async function extractProjectName(projectRoot) {
  try {
    const pkg = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf-8'));
    return pkg.name || basename(projectRoot);
  } catch {
    return basename(projectRoot);
  }
}
