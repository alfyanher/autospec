# Onboarding Guide Generation Prompt

Analyze the codebase context below and emit a single ONBOARDING.md document. Output only the markdown — no preamble, no closing remarks, no "Here is the document:" header.

## Input Context

Project structure:
<file_tree>
{{FILE_TREE}}
</file_tree>

Package manifest & scripts:
<package_manifest>
{{PACKAGE_MANIFEST}}
</package_manifest>

Config files (docker-compose, .env.example, Makefile, etc.):
<config_files>
{{CONFIG_FILES}}
</config_files>

README:
<readme>
{{README}}
</readme>

CI/CD configuration:
<ci_config>
{{CI_CONFIG}}
</ci_config>

## Output Format

Emit exactly these sections in this order. Do not add, rename, or reorder sections.

```
# Onboarding

## Prerequisites
[bullet list: tool → minimum version → how to verify]

## Quick Start
[numbered steps, max 10, each a single shell command or concrete action]

## Environment Variables
[table: VAR_NAME | required/optional | description | example value (fake)]

## Common Commands
[table: command | what it does]

## Project Conventions
[bullet list: convention → example from the actual code]

## Where to Start Reading
[ordered list of 3-5 files: path → one sentence on why to read it first]

## Common Pitfalls
[bullet list: trap → how to avoid it]

## Getting Help
[bullet list: channel/resource → what it covers]
```

## Quality Rules

- Every shell command must be copy-pasteable and correct based on the detected package manager (`npm`, `yarn`, `pnpm`, `make`, etc.).
- Environment variable names must come from `.env.example` or config files in context. Do not invent names. If none are found, write `> Not detected — check with the team.`
- "Where to Start Reading" entries must reference files that appear in `<file_tree>`.
- Write for someone who has never seen this repo. Define project-specific terms on first use.
- If a setup step is non-obvious (e.g., requires a paid service), flag it: `> Note: requires [X] account.`
- If you cannot determine a prerequisite version, write the name only — do not guess.

## Anti-Hallucination Checklist

Before emitting:
- [ ] Every command matches a `scripts` entry in `<package_manifest>` or is a standard CLI for a detected tool
- [ ] Every env var name comes from the config files context
- [ ] Every file path exists in `<file_tree>`

## Example (one section)

```markdown
## Common Commands

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start the dev server with hot reload on port 3000 |
| `npm test` | Run the full test suite (Jest, ~30s) |
| `npm run lint` | ESLint + Prettier check; auto-fix with `--fix` |
| `npm run db:migrate` | Apply pending database migrations |
```
