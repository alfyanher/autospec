# Architectural Decisions Generation Prompt

Analyze the codebase context below and emit a single DECISIONS.md document. Output only the markdown — no preamble, no closing remarks, no "Here is the document:" header.

## Input Context

Project structure:
<file_tree>
{{FILE_TREE}}
</file_tree>

Key source files:
<source_files>
{{SOURCE_FILES}}
</source_files>

Dependencies:
<dependencies>
{{DEPENDENCIES}}
</dependencies>

Git log with messages (last 100 commits):
<git_history>
{{GIT_HISTORY}}
</git_history>

## Output Format

Emit a header and then one record per decision. Do not add commentary between records.

```
# Architectural Decisions

> All decisions are inferred from static analysis. Status is estimated, not authoritative.

---

### ADR-001: [Title]

| Field | Value |
|-------|-------|
| Status | active \| superseded \| experimental |
| Decided | [date from git history, or "unknown"] |
| Evidence | [filename:line or dependency name] |

**Context:** [1-2 sentences: what problem prompted this choice]

**Decision:** [1 sentence: what was chosen]

**Alternatives not chosen:** [comma-separated list]

**Trade-offs:** [1-2 sentences: what this costs and what it gains]

---
```

Repeat the block for each decision. Number sequentially (ADR-001, ADR-002, …).

## Decision Categories to Scan For

Scan for evidence of each. Only emit an ADR if you find actual evidence — do not emit placeholder ADRs.

- Runtime/language choice
- Web framework (Express, Fastify, NestJS, Next.js, etc.)
- Database or storage engine
- ORM or query builder
- Authentication strategy (JWT, session, OAuth, API key)
- API style (REST, GraphQL, tRPC, gRPC)
- Frontend state management
- Testing framework and strategy
- Monorepo tooling (turborepo, nx, lerna)
- Build tooling (webpack, vite, esbuild, tsc)
- Deployment target (Docker, Lambda, Vercel, Railway, etc.)
- Error handling strategy (Result types, exceptions, error middleware)
- Notable third-party service integrations

## Quality Rules

- Aim for 5–12 ADRs. Fewer, sharper records beat a padded list.
- Every ADR must cite at least one piece of evidence (a file, import, or config key).
- Do not emit an ADR for a decision you cannot support with evidence.
- "Alternatives not chosen" should list real alternatives for that category, not invented ones.
- If git history provides a date or commit message that explains a decision, use it.

## Anti-Hallucination Checklist

Before each ADR:
- [ ] Evidence file/import exists in context
- [ ] "Alternatives not chosen" are genuinely common alternatives for this category
- [ ] No invented functionality cited as evidence
