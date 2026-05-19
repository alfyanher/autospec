# CLAUDE.md Generation Prompt

Analyze the codebase context below and emit a single CLAUDE.md file — a context card that Claude Code reads to work effectively with this specific project. Output only the markdown — no preamble, no closing remarks, no "Here is the document:" header.

## Input Context

Project structure:
<file_tree>
{{FILE_TREE}}
</file_tree>

Existing .autospec/ files:
<autospec_docs>
{{AUTOSPEC_DOCS}}
</autospec_docs>

Package manifest:
<package_manifest>
{{PACKAGE_MANIFEST}}
</package_manifest>

Code style samples:
<code_samples>
{{CODE_SAMPLES}}
</code_samples>

## Output Format

Emit exactly this structure. Every section is required; write `> Not detected.` rather than omitting.

```
# CLAUDE.md

## Project

[one sentence: what this project does and its primary tech stack]

## Commands

\`\`\`bash
# Install
[command]

# Run locally
[command]

# Run tests (all)
[command]

# Run single test file
[command or pattern]

# Lint / format
[command]

# Build
[command]
\`\`\`

## Code Style

- **Language:** [JS/TS/Python/etc, with module system if JS]
- **Naming:** [camelCase functions, PascalCase classes, UPPER_SNAKE constants, etc.]
- **Imports:** [order preference if detectable: node built-ins → external → internal]
- **Error handling:** [throw + catch | Result type | error-first callbacks | etc.]
- **Tests:** [framework, file naming pattern, co-located or separate __tests__ dir]
- **Comments:** [describe style observed: JSDoc, inline only, none, etc.]

## Architecture

- **Entry point:** `[file]`
- **Add a new feature:** [concrete instruction: which dir, which file to copy, etc.]
- **Add a new route/endpoint:** [concrete instruction]
- **Add a new test:** [concrete instruction: naming, location, command to run it]

## Do

- [pattern actively used in the codebase — cite a file]
- [pattern actively used in the codebase — cite a file]
- [pattern actively used in the codebase — cite a file]

## Don't

- [anti-pattern visible in git history or comments — or inferred from code style]
- [anti-pattern]
- [anti-pattern]
```

## Quality Rules

- Maximum 120 lines. This is a reference card, not a manual.
- Commands must come from `scripts` in `<package_manifest>` or be standard CLI invocations for detected tools. Do not invent commands.
- "Do" and "Don't" items must cite evidence from `<code_samples>` or `<autospec_docs>`. Minimum 3 items each.
- "Add a new X" instructions should name a real directory and give a concrete action ("copy `src/routes/users.js` as a template").
- Write as instructions to a developer agent, not as documentation prose — imperative mood, terse, no explanations of why.

## Anti-Hallucination Checklist

Before emitting:
- [ ] All commands verified against `<package_manifest>` scripts or standard tooling
- [ ] Entry point file exists in `<file_tree>`
- [ ] All "Do/Don't" examples cite files that exist in context
