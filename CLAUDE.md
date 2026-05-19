# CLAUDE.md — AutoSpec Project Context

## Project Summary
AutoSpec is a Node.js CLI tool that auto-generates living documentation using Claude Code. It scans codebases, infers architecture/decisions/patterns, and outputs always-current markdown docs.

## Key Commands
- `node bin/autospec.js init` — Initialize on a project
- `node bin/autospec.js generate` — Regenerate docs
- `npm test` — Run tests
- `node --test src/**/*.test.js` — Run specific tests

## Code Style
- ES Modules (import/export)
- Functional style, minimal classes
- camelCase for variables/functions
- UPPER_SNAKE for constants
- Async/await everywhere (no callbacks)
- Error handling: try/catch with meaningful messages

## Architecture
- `bin/` — CLI entry point (thin wrapper)
- `src/cli.js` — Command routing and orchestration
- `src/scanner.js` — Project analysis and context extraction
- `src/generator.js` — Prompt filling and Claude Code invocation
- `src/config.js` — YAML config management
- `src/hooks.js` — Git hook installation
- `prompts/` — Markdown prompt templates with `{{PLACEHOLDERS}}`

## Conventions
- DO: Keep prompts as separate .md files for easy community contribution
- DO: Make the CLI work with zero config (sensible defaults)
- DO: Support incremental updates (only regenerate what changed)
- DON'T: Bundle heavy dependencies — keep install fast
- DON'T: Require specific project types — be language-agnostic
- DON'T: Include actual API keys or secrets in any template
