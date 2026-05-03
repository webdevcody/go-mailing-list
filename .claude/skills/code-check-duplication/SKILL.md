---
name: code-check-duplication
user-invocable: false
metadata:
  audience: handoff
description: Internal handoff target invoked by add-feature, modify-feature, code-realign, and other mutation skills as a post-step audit of recently-edited TypeScript/TSX files. Detects parallel-enum drift the type system can't catch — parallel-array drift, repeated literal-equality filters, scattered enum literals, per-variant if-chains, sibling JSX blocks differing only by a literal prop. Reports findings ranked by severity; does NOT auto-fix. Trigger phrases for routing: "check for duplication", "any similar issues", "look for parallel patterns", "scan for drift", "audit enum usage", "find drift", "any other places like this". Skip for single-line fixes, comment/format-only changes, test-fixture edits, non-TS files.
---

> **User-question protocol:** Whenever this skill needs the user to pick between options, confirm an action, or answer a multiple-choice prompt, you MUST call the `AskUserQuestion` tool to render a proper interactive picker. Do NOT print numbered options as plain text and wait for the user to type a number — that produces a degraded UX. Free-form questions (open-ended typing) may be asked in prose, but any time you would write "1) … 2) … 3) …", use `AskUserQuestion` instead.


# Code Check Duplication

A grep-based sweep for a specific class of TypeScript duplication: **parallel patterns where the type system gives a false sense of safety.** The bug pattern: a string-literal union is the "type," but a hand-maintained array, repeated filter calls, or scattered string literals are the *real* runtime contract — and they drift.

This skill detects, ranks, and reports. It does not refactor.

---

## When to run

Run when **any** of these is true:
- The user just had a non-trivial edit (≥2 files OR ≥30 lines changed) involving an enum-like type, status field, variant, or kind.
- The user says: "check for duplication", "any similar issues", "look for parallel patterns", "scan for drift", "any other places like this".
- A bug was just fixed where one variant/status was forgotten in one place — the same class likely lurks elsewhere.

**Do NOT run** for: single-line fixes, comment/format-only changes, edits to test fixtures only, or non-TS files.

---

## Workflow

### Step 1 — Determine scope

Get the list of files in scope. Prefer narrow scope to avoid noise:

```bash
# If a recent edit session: files touched in the last commit + uncommitted
git diff --name-only HEAD 2>/dev/null
git diff --cached --name-only 2>/dev/null
git ls-files --others --exclude-standard 2>/dev/null
# Filter to *.ts / *.tsx, skip node_modules, dist, build, *.d.ts
```

If not in a git repo or the user names specific files, use those instead. If the user says "scan the project", run on `src/**/*.{ts,tsx}` excluding `node_modules`, `dist`, `build`, `.next`, `*.d.ts`.

### Step 2 — Identify candidate enum types

For each scoped file, find string-literal union types — these are the *anchors* the other patterns drift from.

```bash
# String-literal union type aliases
rg -n --type ts 'export type \w+ = "[^"]+"(\s*\|\s*"[^"]+")+' <scope>
# const-as-array enums (the good pattern — record but don't flag)
rg -n --type ts 'as const' <scope> | rg '\[\s*"'
```

Build a list: `{ typeName, literals[], file:line }`. Across the whole scope, each type name is one anchor.

**If zero anchors are found:** skip Detector A and Detector C (both require union literals to compare against); run Detector B and Detector D against the scope and report only smell-class findings.

### Step 3 — Run four detectors

<!-- Progressive-disclosure boundary: if a 5th detector is added, extract this entire section to references/detectors.md and replace it here with a MANDATORY READ trigger. -->

**Pre-flight lens — apply per hit, not just at the end:** Before each detector flags a hit, ask: *would I bet this is drift, or two arrays that happen to share literals?* Drop hits where the answer is no.

For each anchor, and for the scope generally, run the detectors below. Record findings as you go; don't stop at the first.

#### Detector A — Parallel runtime array (drift risk, **HIGH** severity)

A hand-written `T[]` literal whose contents mirror the union. This is the bug class that bit us most recently (`VALID_STATUSES: TaskStatus[] = [...]`).

```bash
# Arrays typed as the union — most direct hit
rg -n --type ts ': \w+\[\]\s*=\s*\[' <scope>
# Variables named like the type (VALID_X, ALL_X, X_VALUES)
rg -n --type ts '(VALID|ALL|VALUES?|LIST)_[A-Z_]+\s*[:=]\s*\[' <scope>
```

For each hit: read the file, compare the array contents to the union literals. Report if they match (drift risk) or mismatch (already drifted — bug).

**Fix recommendation in the report:** convert the union to `as const` array and derive the type via `typeof X[number]`.

#### Detector B — Repeated `.filter` chains over one field (smell, **MEDIUM** severity)

Three or more filters on the same array, same field, different literal — a `groupBy` candidate.

```bash
# Find all filter calls keyed on a literal equality
rg -n --type ts '\.filter\(\s*\(?\w+\)?\s*=>\s*\w+\.\w+\s*===\s*"[^"]+"' <scope>
```

Group hits by `(file, array-source, field-name)`. Flag when the same `(file, field)` has ≥3 distinct literals. Common form:

```ts
const ready   = visibleTasks.filter(t => t.status === "ready");
const running = visibleTasks.filter(t => t.status === "running");
const done    = visibleTasks.filter(t => t.status === "done");
```

**Fix recommendation:** build a `Record<Enum, T[]>` once by iterating the const list.

#### Detector C — Scattered enum literals (smell, **LOW–MEDIUM** severity)

The same literal from a known union appearing in many files. Each call site is a place that can forget to update.

```bash
# For each literal of each anchor union, count file occurrences
rg -n --type ts -F '"<literal>"' <scope> | cut -d: -f1 | sort -u | wc -l
```

Flag a literal that appears in **≥4 files** outside of the schema/const-list file. Higher severity if a UI rendering branch (TaskCard, ProjectCard, etc.) handles only a subset of the union's literals — that's the drift bug waiting to happen.

**Fix recommendation:** consume `STATUS_META[s].label` (or equivalent) instead of inlining the literal.

#### Detector D — Per-variant if-chains and sibling JSX (smell, **MEDIUM** severity)

Long `if/else if` chains keyed on the same field, or sibling JSX blocks where adjacent components differ only by a literal prop:

```bash
# else-if chains on a literal-equality
rg -n --type ts -U 'if\s*\(\s*\w+\.\w+\s*===\s*"[^"]+"\s*\)[^{]*\{[\s\S]{0,400}?\}\s*else if\s*\(' <scope>
# Sibling JSX nodes with the same component, status= prop differing
rg -n --type tsx '<(\w+)\b[^>]*\bstatus="[^"]+"[^>]*/?>\s*<\1\b[^>]*\bstatus="[^"]+"' <scope>
```

Manually inspect: if 3+ siblings differ only by a literal prop, flag it. The fix is `TASK_STATUSES.map(s => <Comp status={s} ... />)`.

### Step 4 — Report

Output a single Markdown report. Format exactly:

```
## Duplication scan — <N> findings

### HIGH — <count>
1. **Parallel runtime array of `<TypeName>`** — `<file>:<line>`
   - Type defined at `<schema-file>:<line>` with literals: `[a, b, c]`
   - Array literal at this site: `[a, b, c]` (in sync now — drift risk on next addition)
   - Suggest: derive the type from a `const` array — `export const X = [...] as const; export type X = typeof X[number];`

### MEDIUM — <count>
2. **Repeated `.filter` chain on `<field>` (<n> branches)** — `<file>:<lineRange>`
   - Literals filtered: `[a, b, c, d]`
   - Suggest: replace with `groupBy` over the const list — `const byX = X_VALUES.reduce(...)`.

3. **Per-variant if-chain on `<field>` (<n> branches)** — `<file>:<lineRange>`
   - Suggest: data-driven — `Record<Enum, RenderFn>` keyed off the const list.

### LOW — <count>
4. **Scattered literal `"<value>"` across <n> files** — see <file1>, <file2>, …
   - Most call sites ignore <these> sibling literals: `[x, y]` — drift smell.
   - Suggest: route through a single mapping (e.g., `STATUS_META`).

---

No duplication of the targeted classes found.    ← only if 0 findings
```

Keep each finding to ≤4 lines. **Do not** include code diffs, do not propose multi-step refactors. The user decides what to fix.

---

## NEVER

- **NEVER auto-edit code in this skill**
  **Instead:** Output the report and stop. The user invokes the next action.
  **Why:** A "scan" that mutates files surprises the user mid-review and conflates detection with refactoring — two separate decisions.

- **NEVER report token-level clones (the jscpd-style "these 8 lines repeat")**
  **Instead:** Stay focused on the four enum-drift detectors above.
  **Why:** General clone detection produces hundreds of low-value hits and buries the high-signal drift findings this skill exists to surface.

- **NEVER scan an entire repo when a recent diff is available**
  **Instead:** Default to `git diff --name-only HEAD` ∪ uncommitted; only fall back to project-wide on explicit user request.
  **Why:** Whole-repo scans pull in generated code, vendored dependencies, and legacy modules that trip Detector A with intentional `T[]` literals — false positives undermine trust in subsequent runs, and the user starts ignoring the report.

- **NEVER flag a parallel array as a finding without verifying the literals**
  **Instead:** Read both the type definition and the array, list both literal sets, mark in-sync vs. already-drifted.
  **Why:** A finding that says "looks duplicated" without proof wastes the user's review time; one that lists the two sets side-by-side is actionable in seconds.

- **NEVER count `as const` arrays or `Record<Enum, …>` declarations as duplication**
  **Instead:** Treat them as *the fix* — the source of truth this skill is steering toward.
  **Why:** False positives on the correct pattern train the user to ignore this skill's output.

- **NEVER run on `*.d.ts`, `node_modules`, `dist`, `build`, generated files, or test fixtures**
  **Instead:** Filter scope before running detectors.
  **Why:** Type declarations and generated bundles contain large unions and array literals by design; scanning them produces noise with zero refactor value.

---

## Trigger question before reporting

Before producing the report, ask: **"For each finding, can the user act on it from the report alone — file, line, what the duplication is, and one sentence on the fix?"** If not, the finding is too vague — drop it or sharpen it.
