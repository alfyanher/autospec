# CLAUDE.md — AutoSpec

> This file is read automatically by Claude Code when you open this project.
> It tells Claude how to work effectively with this specific codebase.

## Project

AutoSpec is a Node.js CLI tool that generates living documentation for any codebase using Claude Code. It scans source files, fills markdown prompt templates with extracted context, and calls `claude -p` to produce structured docs.

**Stack:** Node.js 18+ · ES Modules · no TypeScript · no build step

---

## Commands

```bash
# Run CLI locally
node bin/autospec.js init
node bin/autospec.js generate
node bin/autospec.js help

# Run tests
node --test src/**/*.test.js

# Lint (no config yet — use standard JS conventions)
```

---

## Architecture

```
bin/autospec.js        Thin entry point — imports and calls src/cli.js
src/cli.js             Command routing (init, generate, hook, help)
src/scanner.js         File tree walker, source reader, import extractor
src/generator.js       Template filler + claude CLI invoker
src/config.js          .autospec.yaml load/init with deep merge
src/hooks.js           Git hook install/remove (Unix only)
prompts/*.md           One prompt template per generated document
scripts/demo-project/  Sample Express API used for recording demos
```

**Key data flow:**
`cli.js` → `scanner.js` (returns `context`) → `generator.js` (fills templates, calls claude) → `.autospec/*.md`

---

## Code Style

- **Modules:** ES Modules (`import`/`export`) — no `require()`
- **Async:** `async/await` everywhere — no callbacks or raw Promises
- **Naming:** `camelCase` for variables/functions · `UPPER_SNAKE` for module-level constants
- **Errors:** `try/catch` with meaningful messages — never swallow errors silently at module boundaries
- **Imports:** top-level static imports only — dynamic `import()` only inside functions when needed to avoid circular deps
- **Comments:** none unless the WHY is non-obvious

---

## Adding features

| Task | Where to start |
|------|---------------|
| Add a new generated document | Add entry to `DOC_CONFIGS` in `src/generator.js`, create `prompts/<name>.md` |
| Add a new CLI command | Add function to `COMMANDS` map in `src/cli.js` |
| Change what context is scanned | Edit `scanProject()` in `src/scanner.js` |
| Change prompt output format | Edit the relevant file in `prompts/` — no code changes needed |
| Add a new config option | Add to `DEFAULT_CONFIG` in `src/config.js` with a sensible default |

---

## Do

- Keep `src/generator.js` and `src/scanner.js` decoupled — scanner knows nothing about prompts
- Return structured results (`{ generated, failures }`) so callers can handle partial success
- Use `normalizePath()` on all file paths before storing — Windows backslashes break prompt templates
- Add new prompt templates as `.md` files in `prompts/` — never inline prompts in JS code

## Don't

- Don't add heavy dependencies — install size matters for a global CLI tool
- Don't `process.exit()` inside `src/` modules — only `cli.js` should exit
- Don't use `chmod` without checking `process.platform !== 'win32'` first
- Don't assume the project being analyzed is a Node.js project — AutoSpec must be language-agnostic

---

## Prompt template format

Each file in `prompts/` follows this structure:

```
1. Opening instruction  — "Analyze ... and emit a single <FILE>.md. Output only the markdown."
2. <Input context>      — XML-tagged sections filled with {{PLACEHOLDER}} variables
3. Output format        — Exact section list Claude must emit, in order
4. Quality rules        — Constraints on what Claude can/cannot infer
5. Anti-hallucination   — Checklist Claude verifies before emitting each section
```

Available `{{PLACEHOLDER}}` variables are defined in `fillTemplate()` in `src/generator.js`.

---

## Tests

No test suite yet. When adding tests:
- Place them as `src/<module>.test.js` alongside source files
- Use Node.js built-in `node:test` — no Jest or Vitest
- Run with: `node --test src/**/*.test.js`
