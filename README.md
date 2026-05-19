# AutoSpec

**Living documentation powered by Claude Code. One command. Always current.**

[![license](https://img.shields.io/badge/license-Proprietary-red.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](package.json)
[![claude](https://img.shields.io/badge/powered%20by-Claude%20Code-blueviolet.svg)](https://claude.ai/code)

AutoSpec analyzes your codebase and generates a complete documentation suite using Claude Code. Run it once to bootstrap — it stays current automatically on every commit.

---

## 📄 What gets generated

All documents live in `.autospec/` and are always regenerated from source — never edited by hand.

| File | What's inside |
|------|--------------|
| `ARCHITECTURE.md` | System overview, Mermaid component diagram, data flow, design patterns, extension points |
| `ONBOARDING.md` | Prerequisites, quick-start steps, env vars, common commands, pitfalls |
| `DECISIONS.md` | Inferred architectural decision records (ADR-style) with evidence citations |
| `COMPONENTS.md` | Component map with dependency graph and coupling analysis |
| `API.md` | Endpoint reference with request/response shapes *(only generated if routes are detected)* |
| `DEPENDENCIES.md` | Why each dependency exists, overlap analysis, unused package detection |
| `CLAUDE.md` | Context card for Claude Code — written to your repo root |

---

## ⚡ Requirements

> [!IMPORTANT]
> You need two things before running AutoSpec:
> 1. **Claude Code CLI** — `npm install -g @anthropic-ai/claude-code`
> 2. **Anthropic API key** — `export ANTHROPIC_API_KEY=sk-...` or run `claude login`

- Node.js 18+

---

## 🚀 Quick start

```bash
# Install
npm install -g autospec

# Run on any project
cd your-project
autospec init
```

AutoSpec will:
1. Detect your project type and create `.autospec.yaml`
2. Scan your codebase (respects `.gitignore`, skips binaries, estimates token usage)
3. Call Claude Code once per document
4. Write all docs to `.autospec/` and `CLAUDE.md` to your repo root
5. Install a `post-commit` git hook so docs stay current automatically

---

## 🛠 Commands

```bash
autospec init                              # First-time setup
autospec generate                          # Regenerate everything
autospec generate --changed                # Only update docs for files changed since last commit
autospec generate --docs architecture,onboarding  # Selective regeneration
autospec hook install                      # (Re)install git hooks
autospec hook remove                       # Remove git hooks
autospec help                              # Show all commands
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

## ⚙️ Configuration

`.autospec.yaml` is created automatically by `autospec init`. Edit it to control what gets generated:

```yaml
version: 1

project:
  name: my-app
  # Detected automatically. Affects which docs are prioritized.
  # Options: api | cli | library | webapp | monorepo | general
  type: api

generate:
  - architecture
  - onboarding
  - decisions
  - components
  # - api         # Auto-included only when routes are detected
  - dependencies
  - claude

settings:
  # concise = dense, bullet-heavy  |  detailed = prose-heavy  |  enterprise = formal
  tone: concise

  # When to auto-regenerate: commit | push | both | manual
  update_on: commit

  # How deep to traverse directories for the file tree (default: 4)
  max_depth: 4

  # Include git log in context — helps infer decisions and history
  include_git_history: true

  # Paths to exclude from scanning (supports glob patterns)
  ignore:
    - node_modules/
    - dist/
    - build/
    - coverage/
    - "*.test.*"
    - vendor/
```

> [!TIP]
> `--changed` detects changed files using `git diff HEAD~1`. It regenerates all docs (not just docs for changed files) but with a smaller context window, making it significantly faster.

---

## 🔁 GitHub Actions

### Drop-in workflow

Copy [`.github/workflows/autospec.yml`](.github/workflows/autospec.yml) into your repo and add `ANTHROPIC_API_KEY` to your repository secrets. It will:

- Auto-commit updated docs to `main` on every push
- Comment on pull requests showing what documentation would change

### Reusable action

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: autospec/autospec@v1
    with:
      anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
      mode: changed      # full | changed
      tone: concise
      commit: 'true'     # auto-commit generated docs
```

---

## 🏗 How it works

```
autospec init
    │
    ├─ scanner.js     Walks file tree, reads source + config files,
    │                 extracts imports, detects routes, estimates tokens.
    │                 Respects .gitignore. Skips binary files.
    │
    ├─ generator.js   Fills 7 prompt templates with scanned context,
    │                 calls `claude -p` once per document via stdin.
    │                 Partial failures don't abort remaining docs.
    │
    └─ .autospec/     ARCHITECTURE.md, ONBOARDING.md, DECISIONS.md ...
       CLAUDE.md      Written to repo root for Claude Code to pick up.
```

---

## 🧩 Customize the prompts

Every prompt lives in [`prompts/`](prompts/) as a plain markdown file with `{{PLACEHOLDER}}` variables. They're intentionally separate from the code so you can tune them for your team:

```
prompts/
├── architecture.md    Controls ARCHITECTURE.md output
├── onboarding.md      Controls ONBOARDING.md output
├── decisions.md       Controls DECISIONS.md output
├── components.md      Controls COMPONENTS.md output
├── api.md             Controls API.md output
├── dependencies.md    Controls DEPENDENCIES.md output
└── claude-context.md  Controls CLAUDE.md output
```

Edit any prompt and run `autospec generate` to see the result. The output format contract in each prompt tells Claude exactly what sections to emit and in what order.

---

## 🛡 Edge cases handled

> [!NOTE]
> AutoSpec is designed to degrade gracefully — a broken environment produces warnings, not crashes.

| Scenario | Behavior |
|----------|----------|
| Large repos (>80k tokens) | Warns with token estimate; prompts truncated at 100k chars |
| Binary files | Skipped via extension list + null-byte detection |
| Non-git projects | Git history marked unavailable; hooks skipped gracefully |
| Windows | Hooks skipped with explanation; paths normalized; `type` used instead of `cat` |
| Partial failures | One failed doc doesn't abort the rest; failures listed at end |
| Existing git hooks | AutoSpec appends rather than overwriting |
| Malformed `.autospec.yaml` | Clear error with location, not a stack trace |
| Claude not installed | Detected before scanning begins, with install instructions |
| Claude not authenticated | Detected before scanning begins, with login instructions |

---

## 🔧 Troubleshooting

> [!WARNING]
> **"Claude CLI not found"** — Run `npm install -g @anthropic-ai/claude-code` then `claude login`.

> [!WARNING]
> **"Claude CLI is not authenticated"** — Run `claude login` and follow the browser prompt.

> [!WARNING]
> **Generation timed out** — Your project context is too large. Add directories to the `ignore` list in `.autospec.yaml` and try again.

> [!WARNING]
> **Windows: hooks skipped** — Git hooks require `chmod` which isn't available on Windows. Use the GitHub Action instead for automatic updates.

---

## 📄 License

Copyright © 2026 Alfonso Yanez Herrera. All rights reserved. See [LICENSE](LICENSE).
