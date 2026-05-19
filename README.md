# AutoSpec

**Living documentation powered by Claude Code. One command. Always current.**

[![npm version](https://img.shields.io/npm/v/autospec.svg)](https://www.npmjs.com/package/autospec)
[![license](https://img.shields.io/npm/l/autospec.svg)](LICENSE)
[![node](https://img.shields.io/node/v/autospec.svg)](package.json)

AutoSpec analyzes your codebase and generates a complete documentation suite using Claude Code. Run it once to bootstrap, then let it update on every commit.

<!-- demo GIF goes here: scripts/demo.gif -->

---

## What gets generated

All documents live in `.autospec/` and are always regenerated from source — never edited by hand.

| File | What's inside |
|------|--------------|
| `ARCHITECTURE.md` | System overview, Mermaid component diagram, data flow, design patterns, extension points |
| `ONBOARDING.md` | Prerequisites, quick-start steps, env vars, common commands, pitfalls |
| `DECISIONS.md` | Inferred architectural decision records (ADR-style) with evidence citations |
| `COMPONENTS.md` | Component map, dependency graph, coupling analysis |
| `API.md` | Endpoint reference with request/response shapes *(only if routes detected)* |
| `DEPENDENCIES.md` | Why each dependency exists, what it could be replaced by, unused packages |
| `CLAUDE.md` | Context card for Claude Code — committed to repo root |

---

## Requirements

- **Node.js** 18+
- **Claude Code CLI** — install with `npm install -g @anthropic-ai/claude-code`
- **Anthropic API key** — set `ANTHROPIC_API_KEY` or run `claude login`

---

## Quick start

```bash
# Install
npm install -g autospec

# Run on any project
cd your-project
autospec init
```

That's it. AutoSpec will:
1. Detect your project type and create `.autospec.yaml`
2. Scan your codebase (respects `.gitignore`, skips binaries)
3. Call Claude Code once per document (parallel generation coming)
4. Write all docs to `.autospec/` and `CLAUDE.md` to your root
5. Install a `post-commit` hook so docs stay current

---

## Commands

```bash
autospec init                    # First-time setup
autospec generate                # Regenerate everything
autospec generate --changed      # Only update docs for changed files (fast)
autospec generate --docs architecture,onboarding  # Selective regeneration
autospec diff                    # Show which docs may be outdated
autospec hook install            # (Re)install git hooks
autospec hook remove             # Remove git hooks
```

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--path <dir>` | `.` | Project root to analyze |
| `--no-hooks` | — | Skip hook installation during `init` |
| `--quiet` | — | Suppress non-error output (for CI/hooks) |
| `--docs <list>` | all | Comma-separated doc IDs to generate |
| `--tone <style>` | `concise` | `concise` \| `detailed` \| `enterprise` |

---

## Configuration

`.autospec.yaml` is created by `autospec init` and controls everything:

```yaml
version: 1

project:
  name: my-app
  type: api        # api | cli | library | webapp | monorepo | general

generate:
  - architecture
  - onboarding
  - decisions
  - components
  # - api          # comment out to skip
  - dependencies
  - claude

settings:
  tone: concise            # concise | detailed | enterprise
  update_on: commit        # manual | commit | push | both
  include_git_history: true
  max_depth: 4
  ignore:
    - node_modules/
    - dist/
    - "*.test.*"
    - vendor/
```

---

## GitHub Actions

### Drop-in workflow

Copy `.github/workflows/autospec.yml` into your repo, add `ANTHROPIC_API_KEY` to your repository secrets, and done. It will:

- Auto-commit updated docs on every push to `main`
- Comment on pull requests showing what the documentation impact would be

### Reusable action

```yaml
- uses: autospec/autospec@v1
  with:
    anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
    mode: changed          # full | changed | diff-only
    tone: concise
    commit: 'true'
```

---

## How it works

```
autospec init
    │
    ├─ scanner.js    ← walks the file tree, reads source + configs,
    │                   extracts imports, detects routes, estimates tokens
    │
    ├─ generator.js  ← fills 7 prompt templates with scanned context,
    │                   calls `claude -p` once per document
    │
    └─ .autospec/    ← ARCHITECTURE.md, ONBOARDING.md, DECISIONS.md ...
       CLAUDE.md     ← written to repo root for Claude Code to pick up
```

Each prompt template (`prompts/*.md`) is a standalone markdown file that gets shipped with the package. They're designed to be edited — if a generated doc isn't quite right, tweak the template and re-run.

---

## Edge cases handled

- **Large repos** — warns when context exceeds ~80k tokens; prompts are truncated at 100k chars
- **Binary files** — skipped via extension list and null-byte detection
- **Non-git projects** — hooks skipped gracefully, git history marked unavailable
- **Windows** — hooks skipped (use the GitHub Action instead); paths normalized
- **Partial failures** — one failed doc doesn't abort the rest; failures reported at end
- **Existing hooks** — AutoSpec appends to existing `post-commit`/`pre-push` rather than overwriting
- **Malformed config** — clear error message with location, not a stack trace
- **Unauthenticated Claude** — detected before scanning begins, not mid-generation

---

## Prompts are yours

Every prompt lives in `prompts/` as a plain markdown file. They're intentionally separate from the code so you can:

- Tune them for your team's style
- Add project-specific context ("always mention our internal design system")
- Contribute improvements back upstream

The placeholder syntax is `{{VARIABLE_NAME}}` — see any `.md` in `prompts/` for the full list.

---

## License

MIT
