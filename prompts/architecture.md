# Architecture Generation Prompt

Analyze the codebase context below and emit a single ARCHITECTURE.md document. Output only the markdown — no preamble, no closing remarks, no "Here is the document:" header.

## Input Context

Project root structure:
<file_tree>
{{FILE_TREE}}
</file_tree>

Key source files (contents):
<source_files>
{{SOURCE_FILES}}
</source_files>

Package/dependency manifest:
<dependencies>
{{DEPENDENCIES}}
</dependencies>

Git history summary (last 50 commits):
<git_history>
{{GIT_HISTORY}}
</git_history>

Existing README (if any):
<readme>
{{README}}
</readme>

## Output Format

Emit exactly these sections in this order. Do not add, rename, or reorder sections.

```
# Architecture

## Overview
[single paragraph — what it does and why it exists]

## High-Level Diagram
[Mermaid graph or ASCII art]

## Directory Structure
[table or bullet list: directory → purpose, not just name]

## Data Flow
[numbered steps tracing the primary path from input to output]

## Key Design Patterns
[bullet list: pattern name → files that demonstrate it]

## Infrastructure & Deployment
[bullet list: service/tool → how it is used]

## Extension Points
[bullet list: where to add new features and the convention to follow]
```

## Quality Rules

- Reference actual filenames from the file tree. If a file does not exist in the context, do not mention it.
- When you are uncertain, prefix the statement with `> Inferred:` and give your reasoning.
- Mermaid diagrams must be syntactically valid. Use `graph TD` for top-down flows.
- Keep the full document under 500 lines.
- Write for a senior engineer who is new to **this specific project** — assume they know the tech stack but not the codebase decisions.
- Do not invent endpoints, modules, or functionality absent from the source files.
- If a section has no applicable content (e.g., no deployment config found), write `> Not detected in provided context.` rather than omitting the section.

## Anti-Hallucination Checklist

Before emitting each section, verify:
- [ ] Every filename cited exists in `<file_tree>` or `<source_files>`
- [ ] Every claim about behavior is backed by code in `<source_files>` or `> Inferred:` tagged
- [ ] No example URLs, database names, or service names invented

## Example (architecture section only)

```markdown
## Key Design Patterns

- **Middleware pipeline** — `src/server.js` chains request handlers via `app.use()`. New middleware goes in the same file before route mounting.
- **Repository pattern** — `src/db/` exposes typed query functions; no raw SQL outside that directory.
```
