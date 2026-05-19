# API Documentation Generation Prompt

Analyze the codebase context below and emit a single API.md document. Output only the markdown — no preamble, no closing remarks, no "Here is the document:" header.

## Input Context

Route/handler files:
<route_files>
{{ROUTE_FILES}}
</route_files>

Middleware:
<middleware>
{{MIDDLEWARE}}
</middleware>

Types/schemas/validation:
<schemas>
{{SCHEMAS}}
</schemas>

## Output Format

Emit a header, a base URL block, and then one section per resource group. Within each group, one subsection per endpoint.

```
# API Reference

**Base URL:** `[detected from config or environment, e.g. http://localhost:3000/api/v1]`
**Authentication:** [describe the global auth mechanism, or "varies — see per-endpoint notes"]

---

## [Resource Group, e.g. "Users"]

### `METHOD /path`

> [one sentence description]

**Auth required:** yes (Bearer token) | no | conditional

**Path params:**
| Param | Type | Description |
|-------|------|-------------|

**Query params:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|

**Request body:**
\`\`\`typescript
{
  field: type  // description
}
\`\`\`

**Responses:**

| Status | Meaning | Body shape |
|--------|---------|-----------|
| 200 | Success | `{ id: string, ... }` |
| 400 | Validation error | `{ error: string }` |
| 401 | Unauthenticated | — |

**Example:**
\`\`\`http
POST /api/v1/users
Content-Type: application/json

{ "email": "dev@example.com", "name": "Alex" }
\`\`\`
\`\`\`json
{ "id": "usr_01", "email": "dev@example.com" }
\`\`\`
```

## Quality Rules

- Derive types from validation schemas (Zod, Joi, Yup, class-validator) or TypeScript types found in `<schemas>`. If neither exists, use the parameter names from handler code and mark as `unknown`.
- Group endpoints by resource noun (Users, Posts, Auth, etc.), not by file.
- If authentication middleware is applied at router level, note "all endpoints in this group require auth" rather than repeating it per endpoint.
- For endpoints with no detectable body schema, write `> Schema not detected — inferred from handler usage.`
- List status codes actually present in the handler code. Do not add 404/500 unless they appear.
- Use fake but realistic example values (UUIDs, names, emails). Never use `string` as an example value.

## Anti-Hallucination Checklist

Before each endpoint:
- [ ] HTTP method and path match a route definition in `<route_files>`
- [ ] Request body fields come from schema or destructuring in handler code
- [ ] Response shape comes from `res.json(...)` or return statements, not invented
