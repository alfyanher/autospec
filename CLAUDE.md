# CLAUDE.md

## Project

AutoSpec is a Node.js CLI tool that generates living documentation for any codebase by scanning source files, filling markdown prompt templates, and invoking `claude -p` to produce structured docs.

## Commands

```bash
# Install
npm install -g autospec

# Run locally
node bin/autospec.js init
node bin/autospec.js generate

# Run tests (all)
node --test src/**/*.test.js

# Run single test file
node --test src/<module>.test.js

# Lint / format
# Not configured — follow standard JS conventions

# Build
# No build step required
```

## Code Style

- **Language:** JavaScript (ES Modules — `import`/`export` only, no `require()`)
- **Naming:** `camelCase` functions/variables · `PascalCase` classes/schemas · `UPPER_SNAKE` module-level constants
- **Imports:** top-level static imports only; dynamic `import()` inside functions only to break circular deps
- **Error handling:** `try/catch` with meaningful messages — never swallow errors at module boundaries
- **Tests:** Node.js built-in `node:test` · `src/<module>.test.js` co-located with source
- **Comments:** none unless the WHY is non-obvious; no JSDoc

## Architecture

- **Entry point:** `bin/autospec.js`
- **Add a new generated document:** add entry to `DOC_CONFIGS` in `src/generator.js`, create `prompts/<name>.md`
- **Add a new CLI command:** add function to `COMMANDS` map in `src/cli.js`
- **Add a new test:** create `src/<module>.test.js` alongside the source file; run with `node --test src/<module>.test.js`

## Do

- Call `normalizePath()` on all file paths before storing — Windows backslashes break prompt templates (`src/scanner.js`)
- Return structured results `{ generated, failures }` from generator operations so callers handle partial success (`src/generator.js`)
- Place all prompt templates as `.md` files in `prompts/` — never inline prompt strings in JS code (`prompts/`)

## Don't

- Don't `process.exit()` inside `src/` modules — only `src/cli.js` / `bin/autospec.js` should exit
- Don't use `chmod` without guarding `process.platform !== 'win32'` first (`src/hooks.js`)
- Don't add heavy dependencies — install size matters for a global CLI tool (`package.json`)
- Don't assume the analyzed project is Node.js — AutoSpec must be language-agnostic (`src/scanner.js`)