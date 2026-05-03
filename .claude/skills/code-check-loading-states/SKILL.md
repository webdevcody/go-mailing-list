---
name: code-check-loading-states
user-invocable: false
metadata:
  audience: handoff
description: Internal handoff target invoked by add-feature and modify-feature after async UI changes. Audits async-state UX consistency complementary to add-skeleton-loaders (which adds skeletons for new routes) and add-empty-error-states (which covers empty/error). Catches submit buttons not disabled while submitting, spinner used where sibling flows use skeletons, optimistic updates missing rollback on error, missing route pendingComponent, inconsistent empty/loading/error treatment across siblings. Reports findings ranked by severity; auto-fixes only mechanical issues (add `disabled={isPending}` to a submit button, add `aria-busy` to a clear async region). Trigger phrases for routing: "check loading states", "audit async UX", "any pending state missing", "check submit lockout", "check optimistic rollback". Skip for backend-only changes, doc/comment-only changes, test-fixture-only edits.
---

> **User-question protocol:** Whenever this skill needs the user to pick between options, confirm an action, or answer a multiple-choice prompt, you MUST call the `AskUserQuestion` tool to render a proper interactive picker. Do NOT print numbered options as plain text and wait for the user to type a number — that produces a degraded UX. Free-form questions (open-ended typing) may be asked in prose, but any time you would write "1) … 2) … 3) …", use `AskUserQuestion` instead.


# Code Check Loading States

A targeted sweep for **async-state UX consistency** in changed UI. The bug class: the page eventually loads, but in between the user sees a flicker, a stuck button, an unrolled-back optimistic update, or a spinner where every other page in the app shows a skeleton.

This skill is post-change consistency, not pattern introduction (`add-skeleton-loaders` does the latter).

---

## When to run

Run when **any** is true:
- A new mutation or query was wired to a UI surface.
- A new route, page, or major component was added.
- A form submit handler changed.
- An optimistic update was added or modified.
- The user says: "audit async UX", "check loading states", "any pending state missing".

**Do NOT run** for: backend-only changes, doc/comment-only changes, test-fixture-only edits.

---

## Workflow

### Step 1 — Determine scope

```bash
git diff --name-only HEAD 2>/dev/null
git diff --cached --name-only 2>/dev/null
```

Filter to `*.tsx` in `src/routes/`, `src/components/`, `src/hooks/`. Skip `*.test.*`, `*.stories.*`.

### Step 2 — Detect project's loading convention

Run once per scope, before detectors:

```bash
# Skeleton primitive (shadcn convention)
rg -n --type tsx -F '<Skeleton' <repo> | head -20
# Spinner primitive
rg -n --type tsx -E '<Spinner|<Loader|Loading\.\.\.' <repo> | head -20
# Route pending convention
rg -n --type tsx -F 'pendingComponent' <repo> | head -10
```

Record the dominant convention. The convention drives Detector B (consistency).

### Step 3 — Run five detectors

#### Detector A — Submit button missing `disabled={isPending}` (**MEDIUM**, **auto-fixable**)

```bash
rg -n --type tsx -B5 -A15 -F '<form ' <changed-files>
rg -n --type tsx -F 'useMutation(' <changed-files>
```

For each form using a mutation: check the submit `<button>` for `disabled={isPending}` (or alias). If missing AND the mutation variable is unambiguously named: **MEDIUM**, **auto-fix** by inserting the prop.

#### Detector B — Spinner used where sibling flows use skeletons (or vice versa) (**LOW–MEDIUM** severity)

For each loading primitive used in the changed files: compare to the project's dominant convention from Step 2.

```bash
rg -n --type tsx -E '<Spinner|<Loader' <changed-files>
rg -n --type tsx -F '<Skeleton' <changed-files>
```

If the change introduces `<Spinner>` in a section where the rest of the app uses `<Skeleton>` for similar content (list/card/data block), or vice versa: **LOW** finding — recommend matching the convention. Promote to **MEDIUM** if the inconsistency sits adjacent to a skeleton-using sibling in the same parent.

**Don't auto-fix** — primitive swaps require layout knowledge (skeleton dimensions must approximate eventual layout).

#### Detector C — Route loader without `pendingComponent` (**MEDIUM** severity)

```bash
rg -n --type tsx -F 'createFileRoute(' <changed-route-files>
rg -n --type tsx -F 'loader:' <changed-route-files>
rg -n --type tsx -F 'pendingComponent:' <changed-route-files>
```

If a route declares a `loader` but no `pendingComponent` AND the loader is not trivially fast (uses `ensureQueryData`, `await fetch`, or similar): **MEDIUM**. The user sees a frozen previous page during navigation.

#### Detector D — Optimistic update without rollback (**HIGH** severity)

```bash
rg -n --type tsx -F 'onMutate' <changed-files>
rg -n --type tsx -F 'setQueryData' <changed-files>
```

For each `onMutate` that mutates the cache or local state: check for a corresponding `onError` that restores the previous value (or returns a `context` from `onMutate` that `onError` uses). If missing: **HIGH** — a failed mutation leaves the UI showing a write that didn't happen.

#### Detector E — Long-running region missing `aria-busy` and visible progress (**LOW** severity)

For regions guarded by `isPending`/`isLoading` that wrap **substantial content** (>200px tall, e.g., a list, a chart, a table):
- If the busy region has no `aria-busy="true"` and no visible skeleton/spinner: **LOW**.
- **Auto-fix** `aria-busy` only when the boundary is clear (a `<div>` with `isPending` as the sole conditional).

### Step 4 — Report

```
## Loading-state scan — <N> findings (<auto-fixed> auto-fixed)

**Project convention:** <skeleton | spinner | mixed>

### HIGH — <count>
1. **Optimistic update with no rollback** — `<file>:<line>`
   - `onMutate` writes to cache; `onError` does not restore.
   - Suggest: in `onMutate`, snapshot previous data and return as context; in `onError(err, vars, ctx)`, restore via `setQueryData(key, ctx.previous)`.

### MEDIUM — <count>
2. **Submit button missing `disabled={isPending}`** — `<file>:<line>`
   - Auto-fixed.

3. **Route loader without `pendingComponent`** — `<route-file>:<line>`
   - Suggest: add `pendingComponent: RoutePendingFallback` matching `<sibling-route>:<line>`.

### LOW — <count>
4. **Spinner where siblings use skeletons** — `<file>:<line>`
   - Project convention: skeleton (3 of 4 sibling routes use `<Skeleton>`).
   - Suggest: replace with `<Skeleton>` matching the eventual layout.

5. **Async region missing `aria-busy`** — `<file>:<line>`
   - Auto-fixed.

---

No loading-state inconsistencies detected.    ← only if 0 findings
```

---

## NEVER

- **NEVER auto-swap `<Spinner>` for `<Skeleton>` (or vice versa)**
  **Instead:** Report the inconsistency. Skeleton dimensions need to approximate the eventual layout — guessing produces visual jank or oversized placeholders.
  **Why:** The whole point of skeletons is layout stability; an auto-swap with wrong dimensions gives the user the worst of both worlds (mismatched primitive AND layout shift).

- **NEVER auto-fix an optimistic-update rollback**
  **Instead:** Report the gap and recommend the snapshot-and-restore pattern. Auto-applying it requires reading both the cache key and the data shape, which varies per call.
  **Why:** A wrong rollback can corrupt the cache (writing the wrong shape, wrong key), which is worse than the missing rollback because the user trusts a green checkmark.

- **NEVER scan the whole repo when a diff exists**
  **Instead:** Default to `git diff --name-only HEAD` ∪ uncommitted; project-wide only on explicit request.
  **Why:** Whole-repo loading-state inconsistencies are pre-existing technical debt, not this change's responsibility.

- **NEVER overlap with `add-skeleton-loaders` or `add-empty-error-states`**
  **Instead:** Those skills introduce missing primitives for new surfaces. This skill audits *consistency and rollback* of existing/changed async surfaces. If a new route has zero loading state, defer to `add-skeleton-loaders`.
  **Why:** Two skills proposing different fixes for the same gap produces contradictory diffs and two rounds of approval.

- **NEVER flag a route loader's missing `pendingComponent` if the project consistently relies on parent-layout suspense fallbacks**
  **Instead:** Detect parent layout `pendingComponent` or a top-level `Suspense` boundary first; only flag if neither covers this route.
  **Why:** Some apps centralize pending UI at the layout level; flagging every leaf trains the user to ignore the report.
