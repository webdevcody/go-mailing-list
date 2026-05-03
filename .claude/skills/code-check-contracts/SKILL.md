---
name: code-check-contracts
user-invocable: false
metadata:
  audience: handoff
description: Internal handoff target invoked by add-feature, modify-feature, and fix-bug after changes that cross the client/server boundary. Audits API/route/schema contracts for drift the type system can't catch — frontend reads field `x` while backend now returns `y`, route param renamed but `<Link>`/loader/form callers still use the old shape, zod schema diverged from DB schema or returned DTO, OpenAPI/tRPC/server-fn/generated client callers drift from implementation. Reports findings ranked by severity; auto-fixes only mechanical mismatches (renamed field reference, stale param name) and reports structural ones. Trigger phrases for routing: "check contracts", "any contract drift", "verify shapes match", "audit API contracts", "check route params", "check schema/DTO match". Skip for comment/format-only changes, doc-only edits, non-TS files.
---

> **User-question protocol:** Whenever this skill needs the user to pick between options, confirm an action, or answer a multiple-choice prompt, you MUST call the `AskUserQuestion` tool to render a proper interactive picker. Do NOT print numbered options as plain text and wait for the user to type a number — that produces a degraded UX. Free-form questions (open-ended typing) may be asked in prose, but any time you would write "1) … 2) … 3) …", use `AskUserQuestion` instead.


# Code Check Contracts

A targeted sweep for **runtime-contract drift between producers and consumers** — the bug class where TypeScript and tests pass locally but the page breaks at runtime because the shape on one side moved without the other.

This skill detects, ranks, reports, and auto-fixes mechanical mismatches. Structural mismatches (semantics changed, field meaning changed) are reported, not rewritten.

---

## When to run

Run when **any** is true:
- A recent edit touched a server function, route handler, tRPC procedure, GraphQL resolver, OpenAPI schema, zod schema, DB schema, or a TanStack/Next route file.
- The user says: "check contracts", "verify shapes match", "any drift", "did I break callers".
- A bug just landed where one side was updated without the other.

**Do NOT run** for: comment/format-only changes, doc-only edits, non-TS files, or test-fixture-only edits.

---

## Workflow

### Step 1 — Determine scope

```bash
git diff --name-only HEAD 2>/dev/null
git diff --cached --name-only 2>/dev/null
git ls-files --others --exclude-standard 2>/dev/null
```

Filter to `*.ts`, `*.tsx`, `*.sql`, `*.prisma`, `*.graphql`, OpenAPI yamls. Skip `node_modules`, `dist`, `build`, `*.d.ts`.

### Step 2 — Identify producer surfaces in the diff

For each changed file, classify what kind of producer it contains. The four producer kinds and how to find them:

| Producer | How to detect |
|---|---|
| Server function (TanStack Start) | exports from `src/fn/` or `createServerFn(` calls |
| Route handler (Next/Express/Hono) | `export async function GET/POST` in route files, app.get/post |
| tRPC procedure | `.query(`/`.mutation(` with `.input(` and return value |
| Zod schema / DTO | `z.object(`, `z.infer`, exported `*Schema` or `*Dto` types |
| DB schema | drizzle `pgTable`/`sqliteTable`, prisma models, raw `CREATE TABLE` |
| Route definition | `createFileRoute(`/`createRoute(` with `params`/`search`/`loader` |

For each producer found, capture the **before** and **after** shape from `git diff`. The diff is the contract change.

### Step 3 — Run four detectors

#### Detector A — Field rename / removal in returned DTO (**HIGH** severity)

If a server function or route handler's return type has a renamed or removed field (per the diff), grep all callers:

```bash
# Find callers of a server fn
rg -n --type ts -F '<fnName>(' <scope>
rg -n --type tsx -F '<fnName>(' <scope>
# After locating call sites, grep each caller's destructure / property access for the OLD name
rg -n --type ts -F '.<oldField>' <calling-files>
rg -n --type tsx -F '<oldField>:' <calling-files>
```

For each caller still reading the old field: this is drift. **Auto-fix** when the rename is mechanical (same semantics, only name changed) — replace `oldField` with `newField` at each call site. **Report only** when the field was removed entirely or its semantics changed — the caller needs domain decisions.

#### Detector B — Route param / search-param shape change (**HIGH** severity)

If a route file's `params`/`search` schema changed, grep for navigation and link callers:

```bash
rg -n --type tsx -F 'to="<route-path>"' <scope>
rg -n --type tsx -F "to='<route-path>'" <scope>
rg -n --type ts  -F 'navigate({' <scope>
rg -n --type tsx -F 'useParams' <route-file-dir>
rg -n --type tsx -F 'useSearch' <route-file-dir>
```

For each link/navigate using the old param name or shape: report. **Auto-fix** only on simple renames where the value type is unchanged.

#### Detector C — Zod ⇄ DB schema ⇄ DTO divergence (**HIGH–MEDIUM** severity)

When a zod schema sits between the DB and the client, all three must agree. For each `*Schema` whose file changed, locate the matching DB table and the type that flows to the client:

```bash
# Find DB schema for a given entity
rg -n --type ts -F 'pgTable("<table>"' <repo>
rg -n --type ts -F "pgTable('<table>'" <repo>
# Find consumers of the schema
rg -n --type ts -F 'z.infer<typeof <Schema>>' <scope>
rg -n --type ts -F '<Schema>.parse(' <scope>
```

Compare field sets across the three sources. Report each field that exists in 2 of 3 but not all 3. Common drift: zod marks a field optional, DB has it NOT NULL, client expects required. **Do not auto-fix** — choose-the-source-of-truth is a domain decision.

#### Detector D — OpenAPI / tRPC / generated-client drift (**MEDIUM** severity)

If the repo has generated clients (look for `openapi.yaml`, `openapi.json`, `tRPC` AppRouter exports, files matching `*.generated.ts`, `client.gen.ts`):

```bash
# Generated client surface
fd -e ts 'gen|generated' <scope>
rg -n --type ts -F 'AppRouter' <scope>
```

Compare timestamps: if the producer source file is newer than the generated file, the client is stale. Report — do not regenerate (build-tool decision).

### Step 4 — Report

```
## Contract scan — <N> findings (<auto-fixed> auto-fixed)

### HIGH — <count>
1. **Field renamed: `<old>` → `<new>` in `<producer>`** — `<producer-file>:<line>`
   - Callers updated automatically: <file>:<line>, <file>:<line>
   - Callers needing manual review: <file>:<line> (uses `<old>` in a way the rewriter couldn't verify)

2. **Route param `<param>` removed from `<route>`** — `<route-file>:<line>`
   - Stale callers: <file>:<line>, <file>:<line>
   - Suggest: pass via search params or refactor the navigation path.

### MEDIUM — <count>
3. **Zod/DB divergence on `<entity>.<field>`** — zod: optional, DB: NOT NULL
   - zod: <schema-file>:<line>
   - DB:  <db-file>:<line>
   - Suggest: pick a source of truth and align the other two.

### LOW — <count>
4. **Generated client stale vs. producer** — `client.gen.ts` (mtime older than `src/fn/<fn>.ts`)
   - Suggest: re-run the codegen command for this repo.

---

No contract drift detected.    ← only if 0 findings
```

---

## NEVER

- **NEVER auto-fix a removal or a semantic change**
  **Instead:** Auto-fix only pure renames where the type and meaning are unchanged. Report everything else.
  **Why:** A removed field means the caller has *no* substitute — silently rewriting it picks an arbitrary fallback that hides a real product bug behind a green build.

- **NEVER regenerate OpenAPI/tRPC/client files from this skill**
  **Instead:** Report staleness with the project's regen command if discoverable; let the user run it.
  **Why:** Codegen tools have project-specific arguments and side effects (lockfile changes, format passes); guessing the command produces broken output that's hard to diff-review.

- **NEVER scan the whole repo when a diff exists**
  **Instead:** Default to `git diff --name-only HEAD` ∪ uncommitted; project-wide only on explicit request.
  **Why:** Whole-repo scans surface unrelated long-standing drift the user can't act on right now and bury the actionable findings from the recent change.

- **NEVER report a "drift" without showing both shapes**
  **Instead:** Each finding lists producer file:line AND consumer file:line, with the field names on each side.
  **Why:** A finding the user can't verify in 10 seconds gets ignored; trust in the report drops; the next run gets skipped.

- **NEVER flag a field that exists in DB but is intentionally hidden from the DTO**
  **Instead:** Treat omitted fields (e.g., `password_hash`, `internal_notes`) as a design choice unless the diff shows the omission was accidental (field added to DB without a matching addition on the way out).
  **Why:** Sensitive fields are deliberately stripped at the boundary; flagging them as drift trains the user to ignore the report.
