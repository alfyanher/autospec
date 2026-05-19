# AutoSpec

### Your codebase already knows everything. AutoSpec just writes it down.

Every developer has inherited a codebase with no docs, a README from 2 years ago, and architecture knowledge locked inside one person's head. AutoSpec fixes that permanently — run one command, get a complete documentation suite generated directly from your code. Add a git hook and it stays current automatically on every commit, forever.

**Built for developers who use Claude Code and want it to actually understand their project.**

[![license](https://img.shields.io/badge/license-Proprietary-red.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](package.json)
[![powered by](https://img.shields.io/badge/powered%20by-Claude%20Code-blueviolet.svg)](https://claude.ai/code)

---

## The problem

You join a codebase. There's a README that says "run `npm install`". No architecture diagram. No explanation of why the database schema looks like that. No guide for where to add a new endpoint. You spend your first week asking questions that the code could answer itself — if only someone had written them down.

Or you're a solo developer. Your project makes perfect sense in your head. Six months later, even you can't remember why you made certain decisions.

**Documentation rots because writing it is manual work. AutoSpec makes it automatic.**

---

## What you get in 30 seconds

Run `autospec init` on any codebase and get:

| File | What's inside |
|------|--------------|
| `.autospec/ARCHITECTURE.md` | System overview, Mermaid component diagram, data flow, key design patterns |
| `.autospec/ONBOARDING.md` | Prerequisites, quick-start steps, env setup, common pitfalls |
| `.autospec/DECISIONS.md` | Inferred architectural decision records with evidence citations |
| `.autospec/COMPONENTS.md` | Component map with dependency graph and coupling analysis |
| `.autospec/API.md` | Endpoint reference with request/response shapes *(when routes detected)* |
| `.autospec/DEPENDENCIES.md` | Why each dependency exists, what could replace it, unused packages |
| `CLAUDE.md` | Context card for Claude Code — makes AI assistance dramatically more accurate |

> [!NOTE]
> **Real example output** from the included demo project:
>
> ```markdown
> ### ADR-001: Express over Fastify
> | Field | Value |
> |-------|-------|
> | Status | active |
> | Evidence | src/index.js:1 — `import express from 'express'` |
>
> **Context:** REST API with middleware pipeline. Team familiarity with Express ecosystem.
> **Alternatives not chosen:** Fastify, Koa, Hono
> **Trade-offs:** Larger bundle, slower cold start — offset by ecosystem maturity.
> ```

---

## Setup

> [!IMPORTANT]
> **Two prerequisites:**
> 1. Install Claude Code CLI: `npm install -g @anthropic-ai/claude-code`
> 2. Authenticate: `claude login` (or set `ANTHROPIC_API_KEY` env var)

```bash
npm install -g autospec
```

---

## Quick start

```bash
cd your-project
autospec init
```

That's it. In under a minute you'll have a complete `.autospec/` folder and a `CLAUDE.md` at your repo root. The `CLAUDE.md` is what makes Claude Code understand *your specific project* — not just the language or framework, but your conventions, your architecture, your do's and don'ts.

---

## Keep docs current automatically

During `init`, AutoSpec installs a `post-commit` git hook. After that, every commit automatically regenerates only the docs affected by what changed:

```bash
# Make a change to your routes
git commit -m "feat: add /api/v1/payments endpoint"
# → AutoSpec silently updates API.md and ARCHITECTURE.md in the background
# → Stages the updated docs into the same commit
```

To update manually at any time:

```bash
autospec generate          # Regenerate everything
autospec generate --changed  # Only update docs for files changed since last commit (fast)
```

> [!TIP]
> `--changed` uses `git diff HEAD~1` to detect what changed. On a large codebase it's 3-5x faster than a full regeneration.

---

## All commands

```bash
autospec init                                     # First-time setup
autospec generate                                 # Regenerate all docs
autospec generate --changed                       # Fast incremental update
autospec generate --docs architecture,onboarding  # Generate specific docs only
autospec hook install                             # Re-install git hooks
autospec hook remove                              # Remove git hooks
autospec help                                     # Show all options
```

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--path <dir>` | `.` | Project root (default: current directory) |
| `--no-hooks` | — | Skip hook installation during `init` |
| `--quiet` | — | No output except errors (for CI use) |
| `--docs <list>` | all | Comma-separated doc IDs to generate |
| `--tone <style>` | `concise` | `concise` \| `detailed` \| `enterprise` |

---

## Configuration

`autospec init` creates `.autospec.yaml`. Most projects work with defaults — only edit it if you want to customize:

```yaml
version: 1

project:
  name: my-app
  type: api       # api | cli | library | webapp | monorepo | general

generate:
  - architecture
  - onboarding
  - decisions
  - components
  - dependencies
  - claude
  # - api         # Auto-included only when routes are detected

settings:
  tone: concise           # concise | detailed | enterprise
  update_on: commit       # commit | push | both | manual
  max_depth: 4
  include_git_history: true
  ignore:
    - node_modules/
    - dist/
    - "*.test.*"
    - vendor/
```

---

## GitHub Actions

Automatically keep docs current on every push to `main` — no local tooling required for your team:

```yaml
# .github/workflows/autospec.yml
- uses: autospec/autospec@v1
  with:
    anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
    mode: changed     # full | changed
    commit: 'true'    # auto-commit generated docs
```

On pull requests, AutoSpec comments with a preview of what the docs would look like after merge.

See the full workflow in [`.github/workflows/autospec.yml`](.github/workflows/autospec.yml).

---

## Works with any language

AutoSpec doesn't parse your code — it reads it as text and lets Claude reason about it. That means it works with any language or framework:

- **Node.js / TypeScript** (Express, Fastify, NestJS, Next.js)
- **Python** (Django, FastAPI, Flask)
- **Go**, **Rust**, **Java**, **Ruby on Rails**
- **Monorepos** (Turborepo, Nx, Lerna)
- Mixed-language projects

---

## How it works under the hood

```
autospec init
    │
    ├─ scanner.js     Walks your file tree (respects .gitignore, skips binaries).
    │                 Reads source files, extracts imports, detects routes.
    │                 Estimates token usage — warns if context is large.
    │
    ├─ generator.js   Fills 7 prompt templates with extracted context.
    │                 Calls `claude -p` once per document (stdin pipe).
    │                 Partial failures don't abort remaining docs.
    │
    └─ .autospec/     Markdown files written here.
       CLAUDE.md      Written to repo root — picked up by Claude Code automatically.
```

The prompt templates in [`prompts/`](prompts/) are plain markdown files you can edit. Change the tone, add project-specific instructions, or contribute improvements back.

---

## Edge cases handled

| Scenario | Behavior |
|----------|----------|
| Large repos (>80k tokens) | Warns with estimate; context truncated at 100k chars |
| Binary files | Skipped via extension list + null-byte detection |
| Non-git projects | Git history skipped gracefully; hooks skipped with explanation |
| Windows | Hooks skipped (use GitHub Action instead); paths normalized |
| Partial doc failures | Remaining docs continue; failures listed at end |
| Existing git hooks | AutoSpec appends rather than overwrites |
| Claude not installed | Caught before scanning begins, with install command |
| Claude not authenticated | Caught before scanning begins, with login command |

---

## Troubleshooting

> [!WARNING]
> **"Claude CLI not found"**
> Run: `npm install -g @anthropic-ai/claude-code` then `claude login`

> [!WARNING]
> **Generation timed out**
> Your project is too large for a single context. Add directories to `ignore` in `.autospec.yaml`.

> [!WARNING]
> **Windows: hooks skipped**
> Git hooks require `chmod` — not available on Windows. Use the GitHub Action for automatic updates.

> [!WARNING]
> **"No .autospec.yaml found"**
> You need to run `autospec init` before `autospec generate`.

---

## Who this is for

**AutoSpec works best for:**
- Codebases 6 months or older with minimal documentation
- Teams onboarding new developers regularly
- Solo developers using Claude Code who want accurate AI assistance
- Projects that move fast and can't afford manual doc maintenance

**AutoSpec is not ideal for:**
- Brand-new greenfield projects (there's nothing to infer yet)
- Projects smaller than ~10 source files
- Codebases with existing, well-maintained documentation

---

## License

Copyright © 2026 Alfonso Yanez Herrera. All rights reserved. See [LICENSE](LICENSE).
