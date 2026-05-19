import { resolve } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig, initConfig } from './config.js';
import { scanProject } from './scanner.js';
import { generateDocs, checkClaudeCLI } from './generator.js';
import { setupHooks } from './hooks.js';

const COMMANDS = {
  init: commandInit,
  generate: commandGenerate,
  diff: commandDiff,
  hook: commandHook,
  help: commandHelp,
};

export async function run(args) {
  const command = args[0] || 'help';
  const flags = parseFlags(args.slice(1));

  if (COMMANDS[command]) {
    await COMMANDS[command](flags);
  } else {
    console.log(chalk.red(`Unknown command: ${command}`));
    await commandHelp();
  }
}

async function commandInit(flags) {
  const projectRoot = resolve(flags.path || '.');

  if (!flags.quiet) {
    console.log(chalk.bold('\n🔍 AutoSpec — Living Documentation Generator\n'));
  }

  // Fail fast: check Claude CLI before doing any work
  const spinner = ora('Checking Claude CLI...').start();
  const claudeCheck = await checkClaudeCLI();
  if (!claudeCheck.ok) {
    spinner.fail(claudeCheck.message);
    process.exit(1);
  }
  spinner.succeed('Claude CLI detected');

  spinner.start('Creating .autospec.yaml config...');
  const config = await initConfig(projectRoot);
  spinner.succeed('Config created at .autospec.yaml');

  spinner.start('Scanning project structure...');
  const context = await scanProject(projectRoot, config);
  spinner.succeed(`Scanned ${context.fileCount} files across ${context.dirCount} directories`);

  if (context.tokenEstimate > 80_000) {
    console.log(chalk.yellow(
      `  ⚠  Large context (~${Math.round(context.tokenEstimate / 1000)}k tokens). ` +
      `Generation may be slow or truncated. Consider adding paths to .autospec.yaml ignore list.`
    ));
  }

  spinner.start('Generating documentation via Claude Code...');
  const results = await generateDocs(projectRoot, context, config);
  spinner.succeed(`Generated ${results.generated.length} documents in .autospec/`);

  if (results.failures.length > 0) {
    console.log(chalk.yellow(`\n  ⚠  ${results.failures.length} document(s) failed to generate:`));
    results.failures.forEach(({ doc, error }) => {
      console.log(chalk.dim(`     ${doc}: ${error}`));
    });
  }

  if (!flags['no-hooks']) {
    spinner.start('Setting up git hooks...');
    const hookResult = await setupHooks(projectRoot, config);
    if (hookResult.skipped) {
      spinner.warn(`Git hooks skipped: ${hookResult.reason}`);
    } else {
      spinner.succeed('Git hooks configured (updates docs on commit)');
    }
  }

  if (!flags.quiet) {
    console.log(chalk.green('\n✅ AutoSpec initialized successfully!\n'));
    console.log('Generated files:');
    results.generated.forEach((file) => {
      console.log(chalk.dim(`  .autospec/${file}`));
    });
    console.log(chalk.dim('\nRun `autospec generate` to regenerate at any time.'));
    console.log(chalk.dim('Run `autospec generate --changed` to update only changed areas.\n'));
  }
}

async function commandGenerate(flags) {
  const projectRoot = resolve(flags.path || '.');

  if (!flags.quiet) {
    console.log(chalk.bold('\n🔄 AutoSpec — Regenerating documentation\n'));
  }

  const spinner = ora('Loading config...').start();
  const config = await loadConfig(projectRoot);

  if (!config) {
    spinner.fail('No .autospec.yaml found. Run `autospec init` first.');
    process.exit(1);
  }

  const claudeCheck = await checkClaudeCLI();
  if (!claudeCheck.ok) {
    spinner.fail(claudeCheck.message);
    process.exit(1);
  }

  spinner.text = 'Scanning project...';
  const context = await scanProject(projectRoot, config);

  if (flags.changed) {
    spinner.text = 'Detecting changes since last generation...';
    context.changedOnly = true;
    context.changedFiles = await getChangedFiles(projectRoot);
    if (context.changedFiles.length === 0) {
      spinner.info('No changed files detected. Nothing to regenerate.');
      return;
    }
  }

  spinner.text = 'Generating documentation...';
  const results = await generateDocs(projectRoot, context, config);

  if (results.failures.length > 0) {
    spinner.warn(`Updated ${results.generated.length} documents (${results.failures.length} failed)`);
    results.failures.forEach(({ doc, error }) => {
      console.log(chalk.dim(`  ${doc}: ${error}`));
    });
  } else {
    spinner.succeed(`Updated ${results.generated.length} documents`);
  }

  if (!flags.quiet) {
    console.log(chalk.green('\n✅ Documentation updated.\n'));
  }
}

async function commandDiff(flags) {
  const projectRoot = resolve(flags.path || '.');

  if (!flags.quiet) {
    console.log(chalk.bold('\n📊 AutoSpec — Documentation Drift Report\n'));
  }

  const config = await loadConfig(projectRoot);
  if (!config) {
    console.log(chalk.red('No .autospec.yaml found. Run `autospec init` first.'));
    process.exit(1);
  }

  const spinner = ora('Analyzing drift...').start();
  await scanProject(projectRoot, config);
  spinner.succeed('Analysis complete');

  if (!flags.quiet) {
    console.log(chalk.yellow('\nSections potentially outdated:'));
    console.log(chalk.dim('  (Full drift detection runs during generate)\n'));
  }
}

async function commandHook(flags) {
  const projectRoot = resolve(flags.path || '.');
  const action = flags._?.[0] || 'install';

  if (action === 'install') {
    const result = await setupHooks(projectRoot);
    if (result.skipped) {
      console.log(chalk.yellow(`⚠  Git hooks skipped: ${result.reason}`));
    } else {
      console.log(chalk.green('✅ Git hooks installed'));
    }
  } else if (action === 'remove') {
    const { removeHooks } = await import('./hooks.js');
    await removeHooks(projectRoot);
    console.log(chalk.green('✅ Git hooks removed'));
  } else {
    console.log(chalk.red(`Unknown hook action: ${action}. Use 'install' or 'remove'.`));
  }
}

async function commandHelp() {
  console.log(`
${chalk.bold('AutoSpec')} — Living documentation powered by Claude Code

${chalk.bold('USAGE')}
  autospec <command> [options]

${chalk.bold('COMMANDS')}
  init              Initialize AutoSpec in current project
  generate          Regenerate all documentation
  generate --changed  Only update docs for changed files
  diff              Show documentation drift report
  hook install      Install git commit hooks
  hook remove       Remove git commit hooks
  help              Show this help message

${chalk.bold('OPTIONS')}
  --path <dir>      Project root directory (default: .)
  --no-hooks        Skip git hook installation during init
  --quiet           Suppress non-error output (for CI/hooks)
  --docs <list>     Comma-separated docs to generate
                    (architecture,onboarding,decisions,components,api,dependencies,claude)
  --tone <style>    Writing style: concise | detailed | enterprise

${chalk.bold('EXAMPLES')}
  autospec init
  autospec generate --changed
  autospec generate --docs architecture,onboarding
  autospec init --tone enterprise --no-hooks
`);
}

function parseFlags(args) {
  const flags = { _: [] };
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const next = args[i + 1];
      if (!next || next.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i++;
      }
    } else {
      flags._.push(args[i]);
    }
  }
  return flags;
}

async function getChangedFiles(projectRoot) {
  const { execSync } = await import('child_process');
  try {
    const result = execSync('git diff --name-only HEAD~1', {
      cwd: projectRoot,
      encoding: 'utf-8',
    });
    return result.trim().split('\n').filter(Boolean);
  } catch {
    // Not a git repo or no previous commit — treat everything as changed
    return [];
  }
}
