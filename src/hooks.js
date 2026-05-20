import { writeFile, readFile, chmod, mkdir, access, unlink } from 'fs/promises';
import { join } from 'path';

const IS_WINDOWS = process.platform === 'win32';

const HOOK_CONTENT = `#!/bin/sh
# AutoSpec - Auto-update documentation on commit
# Remove this file or run 'autospec hook remove' to disable

# Only run if source files changed (not just docs)
CHANGED_SRC=$(git diff --cached --name-only | grep -v '.autospec/' | grep -v 'CLAUDE.md' | head -1)

if [ -n "$CHANGED_SRC" ]; then
  echo "AutoSpec: Updating documentation..."

  if command -v autospec > /dev/null 2>&1; then
    autospec generate --changed --quiet &
    AUTOSPEC_PID=$!

    ( sleep 30; kill "$AUTOSPEC_PID" 2>/dev/null ) &
    TIMEOUT_PID=$!

    wait "$AUTOSPEC_PID" 2>/dev/null
    kill "$TIMEOUT_PID" 2>/dev/null

    git add .autospec/ CLAUDE.md 2>/dev/null || true
    echo "AutoSpec: Documentation updated"
  else
    echo "AutoSpec: CLI not found. Run 'npm i -g autospec' to enable auto-updates."
  fi
fi

exit 0
`;

const PRE_PUSH_HOOK = `#!/bin/sh
# AutoSpec - Verify documentation is current before push

if command -v autospec > /dev/null 2>&1; then
  autospec diff --quiet
  EXIT_CODE=$?
  if [ "$EXIT_CODE" -ne 0 ]; then
    echo "AutoSpec: Documentation may be outdated. Run 'autospec generate' to update."
    echo "(This is a warning only - push will proceed)"
  fi
fi

exit 0
`;

export async function setupHooks(projectRoot, config = {}) {
  if (IS_WINDOWS) {
    return { skipped: true, reason: 'Git hooks via chmod are not supported on Windows. Use the GitHub Action instead.' };
  }

  const gitDir = join(projectRoot, '.git');
  try {
    await access(gitDir);
  } catch {
    return { skipped: true, reason: 'Not a git repository — no .git directory found.' };
  }

  const hooksDir = join(gitDir, 'hooks');
  await mkdir(hooksDir, { recursive: true });

  const updateOn = config?.settings?.update_on || 'commit';

  if (updateOn === 'commit' || updateOn === 'both') {
    const hookPath = join(hooksDir, 'post-commit');
    await writeWithBackup(hookPath, HOOK_CONTENT);
    await chmod(hookPath, 0o755);
  }

  if (updateOn === 'push' || updateOn === 'both') {
    const hookPath = join(hooksDir, 'pre-push');
    await writeWithBackup(hookPath, PRE_PUSH_HOOK);
    await chmod(hookPath, 0o755);
  }

  return { skipped: false };
}

async function writeWithBackup(hookPath, content) {
  try {
    const existing = await readFile(hookPath, 'utf-8');
    if (existing.includes('# AutoSpec')) {
      // Already installed — overwrite the AutoSpec section
      const cleaned = existing.replace(/# AutoSpec[\s\S]*?exit 0\n?/g, '').trimEnd();
      await writeFile(hookPath, (cleaned ? cleaned + '\n\n' : '#!/bin/sh\n\n') + content, 'utf-8');
    } else {
      // Append to existing hook (don't clobber it)
      await writeFile(hookPath, existing.trimEnd() + '\n\n' + content, 'utf-8');
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      await writeFile(hookPath, content, 'utf-8');
    } else {
      throw new Error(`Could not write hook at ${hookPath}: ${err.message}`);
    }
  }
}

export async function removeHooks(projectRoot) {
  if (IS_WINDOWS) return;

  const hooksDir = join(projectRoot, '.git', 'hooks');

  for (const hookName of ['post-commit', 'pre-push']) {
    const hookPath = join(hooksDir, hookName);
    try {
      const content = await readFile(hookPath, 'utf-8');
      const cleaned = content.replace(/# AutoSpec[\s\S]*?exit 0\n?/g, '').trim();

      if (cleaned && cleaned !== '#!/bin/sh') {
        await writeFile(hookPath, cleaned + '\n', 'utf-8');
      } else {
          await unlink(hookPath);
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw new Error(`Could not remove hook ${hookName}: ${err.message}`);
      }
    }
  }
}
