---
name: code-check-data-integrity
user-invocable: false
metadata:
  audience: handoff
description: Internal handoff target invoked by add-feature, modify-feature, code-add-migration, and code-realign whenever a change touches migrations, schema, persistence, imports, deletes, or background jobs. Audits data-integrity risks the type system can't catch — NOT NULL columns added without backfill or default, delete paths that orphan rows/files/cache/external resources, uniqueness assumptions not enforced by DB constraints, migrations unsafe for existing production data, seed and test data no longer matching the schema. Reports findings ranked by severity; auto-fixes only mechanical issues (missing default on a clearly-nullable add, stale seed field after rename) and reports structural ones. Trigger phrases for routing: "check data integrity", "is this migration safe", "any orphaned rows", "data audit", "check delete cascade", "verify backfill", "check uniqueness". Skip for read-only changes, UI-only edits, doc/comment-only changes.
---

> **User-question protocol:** Whenever this skill needs the user to pick between options, confirm an action, or answer a multiple-choice prompt, you MUST call the `AskUserQuestion` tool to render a proper interactive picker. Do NOT print numbered options as plain text and wait for the user to type a number — that produces a degraded UX. Free-form questions (open-ended typing) may be asked in prose, but any time you would write "1) … 2) … 3) …", use `AskUserQuestion` instead.


# Code Check Data Integrity

A targeted sweep for **persisted-state correctness**. The bug class: a schema change passes locally on an empty database but breaks on existing production rows; or a delete removes the parent row and leaves children, files, cache entries, or external API resources behind.

This skill detects, ranks, reports, and auto-fixes mechanical fixes only.

---

## When to run

Run when **any** is true:
- A migration file was added or modified.
- A DB schema (drizzle/prisma/raw SQL) changed.
- A `delete`, `destroy`, `remove`, or cascade-affecting query changed.
- A bulk import, background job, or webhook handler that writes persisted state changed.
- The user says: "is this migration safe", "any orphans", "check data integrity", "verify backfill".

**Do NOT run** for: read-only changes, UI-only edits, doc/comment-only changes, test-fixture edits not tied to a schema change.

---

## Workflow

### Step 1 — Determine scope and classify the change

```bash
git diff --name-only HEAD 2>/dev/null
git diff --cached --name-only 2>/dev/null
```

Filter to: migration files (`migrations/`, `*.sql`, `*.up.sql`, `prisma/migrations/`), schema files (`schema.ts`, `schema.prisma`, `*.sql`), persistence code (`src/data-access/`, repositories, models), and background-job files.

Classify each change as **additive** (safe-by-default), **mutating** (requires plan), or **destructive** (requires backup/rollback plan). Display the classification in the report header.

### Step 2 — Run five detectors

#### Detector A — NOT NULL added without default or backfill (**HIGH** severity)

```bash
# drizzle / typeORM
rg -n --type ts '\.notNull\(\)' <changed-schema-files>
# raw SQL migrations
rg -n -F 'NOT NULL' <changed-migration-files>
rg -n -F 'ADD COLUMN' <changed-migration-files>
```

For each new NOT NULL column, look in the same migration (or sibling migration in the same commit) for a `DEFAULT` clause or an `UPDATE`/backfill statement. If neither: **HIGH** finding. Report the file:line and the safe alternative (split into add-nullable → backfill → set-NOT-NULL across separate deploys, or add a sensible default).

#### Detector B — Delete leaves orphans (**HIGH** severity)

For each delete operation in the diff:

```bash
rg -n --type ts -F '.delete(' <scope>
rg -n --type ts -F 'DELETE FROM' <scope>
rg -n --type ts 'destroy\(|remove\(' <scope>
```

For the deleted entity, find foreign-key children:

```bash
# drizzle: references(parentTable.id)
rg -n --type ts -F 'references(<parentTable>' <repo>
rg -n --type ts -F '.references(() => <parentTable>' <repo>
```

For each child relation, verify the schema declares `onDelete: "cascade"` OR the delete code explicitly removes children first OR the child table has nothing to clean up. If none: **HIGH** finding — list the orphan-prone children and recommend cascade or explicit deletion.

Also check for **external orphans**: file uploads (S3, local fs writes), Stripe customers, webhook subscriptions, cache keys (`redis.set`, `cache.set`). If the deleted entity has any of those side effects on its create path, the delete path must mirror them.

#### Detector C — Uniqueness assumed in code, not enforced in DB (**MEDIUM** severity)

```bash
# Code paths that assume single result
rg -n --type ts '\.findFirst\(' <scope>
rg -n --type ts -F 'where: {' <scope> | rg -F 'email|slug|username|handle'
```

For each lookup-by-natural-key, verify the corresponding column has a `unique()` constraint in the schema. If not: **MEDIUM** finding — recommend adding a unique index (with a check for existing duplicates first).

#### Detector D — Seed / test-fixture drift after schema change (**MEDIUM** severity)

```bash
# Find seed/fixture files
fd -e ts 'seed|fixture' <repo>
fd -e json 'seed|fixture' <repo>
```

For each fixture file: compare its object shape to the new schema. Flag missing required fields or removed fields. **Auto-fix** when the rename is mechanical (field renamed, type unchanged) — update fixture keys. **Report only** for new required fields or removed fields with no clear default.

#### Detector E — Destructive migration without rollback / data-loss warning (**HIGH** severity)

```bash
rg -n -F 'DROP COLUMN' <changed-migration-files>
rg -n -F 'DROP TABLE' <changed-migration-files>
rg -n -F 'ALTER COLUMN' <changed-migration-files>
rg -n -F 'TRUNCATE' <changed-migration-files>
```

For each destructive operation: check whether a `down`/rollback migration exists and whether it can actually restore the data (it usually can't for DROPs). Flag **HIGH** with the irreversibility note: "DROP COLUMN cannot be reversed by migration alone — requires backup."

### Step 3 — Report

```
## Data integrity scan — <N> findings

**Change classification:** <additive | mutating | destructive>
**Files in scope:** <list>

### HIGH — <count>
1. **NOT NULL added without backfill on `<table>.<col>`** — `<migration-file>:<line>`
   - Existing rows will fail this constraint.
   - Suggest: add as nullable → backfill in code → set NOT NULL in a follow-up migration.

2. **Delete on `<entity>` orphans `<child>` rows** — `<delete-callsite>:<line>`
   - `<child>` references `<entity>.id` at `<schema-file>:<line>` with no `onDelete: "cascade"`.
   - Suggest: add cascade in schema, OR delete `<child>` rows explicitly before this call.

3. **DROP COLUMN `<table>.<col>`** — `<migration-file>:<line>`
   - Irreversible without a database backup.
   - Suggest: confirm no production code reads this column AND a backup exists before deploy.

### MEDIUM — <count>
4. **Uniqueness assumed but not enforced on `<table>.<col>`** — `<query-file>:<line>`
   - `findFirst({ where: { <col> } })` will silently return one of multiple matches.
   - Suggest: add `unique()` to the schema (after deduping existing rows).

5. **Seed file drift on `<entity>`** — `<seed-file>:<line>`
   - Missing field `<newField>` (added in this commit's schema change).
   - Auto-fixed: <yes | no — needs domain decision>.

---

No data-integrity issues detected.    ← only if 0 findings
```

---

## NEVER

- **NEVER edit a migration file in place after it has been applied to any environment**
  **Instead:** Add a new migration that fixes the issue forward. If unsure whether it's been applied, ask the user.
  **Why:** Editing an applied migration causes the migration runner's checksum to mismatch, which either silently skips the corrected SQL or hard-fails the next deploy depending on the tool.

- **NEVER auto-add `onDelete: "cascade"` to a foreign key**
  **Instead:** Report the orphan risk and recommend cascade as one of two options (the other being explicit child deletion in code).
  **Why:** Cascade silently deletes data the user may want to preserve (e.g., audit logs, tombstoned records); the choice is a domain decision, not a mechanical fix.

- **NEVER auto-add a `DEFAULT` value to a NOT NULL column without seeing the column's semantic intent**
  **Instead:** Report the missing default and propose two options (a sensible literal default, OR split into nullable→backfill→NOT-NULL).
  **Why:** A defaulted column hides the fact that existing rows had no real value — months later, queries silently treat backfilled defaults as real user data.

- **NEVER scan the whole repo when a diff exists**
  **Instead:** Default to `git diff --name-only HEAD` ∪ uncommitted; project-wide only on explicit request.
  **Why:** Whole-repo scans surface long-standing schema warts the user can't address right now and bury the actionable findings from the recent change.

- **NEVER flag a destructive migration that ships with a documented backup/rollback plan in the same commit**
  **Instead:** If the commit body or a sibling file (e.g., `RUNBOOK.md`, migration comment) explicitly addresses the destructive op with a rollback or backup step, downgrade to MEDIUM with the note "Has rollback plan."
  **Why:** Users who already added a runbook get punished by a HIGH finding that ignores their work, training them to ignore the report.
