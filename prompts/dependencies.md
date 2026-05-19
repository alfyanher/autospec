# Dependencies Documentation Generation Prompt

Analyze the codebase context below and emit a single DEPENDENCIES.md document. Output only the markdown — no preamble, no closing remarks, no "Here is the document:" header.

## Input Context

Package manifest:
<package_manifest>
{{PACKAGE_MANIFEST}}
</package_manifest>

Lock file summary (top-level deps):
<lock_summary>
{{LOCK_SUMMARY}}
</lock_summary>

Import usage across codebase:
<import_usage>
{{IMPORT_USAGE}}
</import_usage>

## Output Format

Emit exactly these sections in this order.

```
# Dependencies

## Runtime Dependencies

| Package | Version | Purpose | Primary usage location | Replaceable with |
|---------|---------|---------|----------------------|-----------------|
[one row per production dependency]

## Development Dependencies

| Package | Version | Purpose | Necessity |
|---------|---------|---------|-----------|
[one row per devDependency; Necessity = critical | helpful | unclear]

## Potentially Unused

> Packages present in manifest but not found in import usage scan.

- `package-name` — [last usage guess or "no imports found"]

## Security Notes

> Based on knowledge cutoff. Run `npm audit` for current advisories.

- [any known-problematic packages, or "> No known issues detected."]

## Overlap & Redundancy

- [packages that serve the same purpose, or "> None detected."]
```

## Quality Rules

- "Purpose" must be a plain-English description of what the library actually does in this project, not just its npm tagline. Base it on `<import_usage>`.
- "Primary usage location" should name the actual file(s) from `<import_usage>`, not a generic folder.
- "Replaceable with" should list 1-2 real alternatives. Write `—` if the package is uniquely positioned (no meaningful alternative).
- Only list a package as "Potentially Unused" if it genuinely has zero import matches. Do not include peer dependencies or packages used in config files that may not show up as imports.
- Security Notes: only flag packages you have confident knowledge of issues with. Do not speculate. If unsure, omit.

## Anti-Hallucination Checklist

Before emitting:
- [ ] Every package in tables exists in `<package_manifest>`
- [ ] "Primary usage location" files exist in import usage data
- [ ] Security notes are limited to packages with known, widely-reported issues
