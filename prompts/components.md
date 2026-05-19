# Component Map Generation Prompt

Analyze the codebase context below and emit a single COMPONENTS.md document. Output only the markdown — no preamble, no closing remarks, no "Here is the document:" header.

## Input Context

Project structure:
<file_tree>
{{FILE_TREE}}
</file_tree>

Source files (imports and exports):
<import_map>
{{IMPORT_MAP}}
</import_map>

Package manifest:
<package_manifest>
{{PACKAGE_MANIFEST}}
</package_manifest>

## Output Format

Emit exactly these sections in this order.

```
# Components

## Overview

| Component | Location | Responsibility | Depends On | Depended On By |
|-----------|----------|---------------|------------|----------------|
[one row per component]

## Dependency Graph

\`\`\`mermaid
graph TD
  [nodes and edges]
\`\`\`

## Component Details

### [Component Name]

- **Location:** `path/to/dir/`
- **Purpose:** [one sentence]
- **Key files:** `file1.js`, `file2.js`
- **Exports:** [what it exposes to other components]
- **Owns state:** yes/no — [what state, if yes]
- **Coupling notes:** [blank if clean; flag if tightly coupled to another component]

[repeat for each component]

## Boundary Concerns

[bullet list of coupling issues or unclear ownership boundaries found]
```

## Component Identification Rules

Group files into logical components using these signals (in priority order):
1. Top-level directories in `src/` or the project root
2. Import clusters — files where 3 or more files import each other form a component
3. Naming conventions — `*Controller`, `*Service`, `*Repository`, `*Store`, `*Router`

Target 5–15 components total. Never create a 1-file component unless that file is a clear standalone module (e.g., a single-file CLI entry point).

If the project has fewer than 5 logical groupings, emit what exists — do not pad. If the project is a monorepo, treat each top-level package as a component and note its sub-components briefly.

## Quality Rules

- Mermaid graph must be syntactically valid. Use component names as node labels without spaces (use underscores). Example: `Auth_Service --> User_Repository`.
- Every component listed in the Overview table must have a matching Detail section.
- "Exports" should describe the interface, not just list filenames.
- Flag circular dependencies with `⚠️` in the graph and in Boundary Concerns.
- If a component has no clear owner (files that don't cluster), note it as `Unclaimed` in Boundary Concerns.

## Anti-Hallucination Checklist

Before emitting:
- [ ] Every component location exists in `<file_tree>`
- [ ] Dependency edges in the graph are backed by import statements in `<import_map>`
- [ ] No invented method or class names in "Exports"
