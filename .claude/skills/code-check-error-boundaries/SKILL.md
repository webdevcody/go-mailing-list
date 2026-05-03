---
name: code-check-error-boundaries
user-invocable: false
metadata:
  audience: handoff
description: Internal handoff target invoked by add-feature, modify-feature, and fix-bug after a feature lands to audit failure paths. Catches the failure-mode gaps that produce blank screens and silent corruption — promise rejections that leak to a blank screen (no `errorComponent`/error boundary), server errors that become a generic toast with no retry, form submits that double-submit on failure (button re-enabled before retry-safe), TanStack route loaders without `errorComponent`, background failures with no user-visible recovery or durable record. Reports findings ranked by severity; auto-fixes only mechanical issues (disable button when `isPending`, add missing `errorComponent` stub matching project convention). Trigger phrases for routing: "check error handling", "any failure paths missing", "audit error boundaries", "what happens on failure", "check error UX". Skip for pure backend changes that don't add user-facing flows, doc/comment-only changes.
---

> **User-question protocol:** Whenever this skill needs the user to pick between options, confirm an action, or answer a multiple-choice prompt, you MUST call the `AskUserQuestion` tool to render a proper interactive picker. Do NOT print numbered options as plain text and wait for the user to type a number — that produces a degraded UX. Free-form questions (open-ended typing) may be asked in prose, but any time you would write "1) … 2) … 3) …", use `AskUserQuestion` instead.


# Code Check Error Boundaries

A targeted sweep for **failure-path coverage** in user-facing flows. The bug class: the happy path works, but a network blip, server 500, or rate limit produces a blank screen, an infinite spinner, a duplicate submission, or a silent loss of user input.

---

## When to run

Run when **any** is true:
- A new TanStack/Next/React Router route was added.
- A new mutation (`useMutation`, server function call) was wired to UI.
- A new form was added or its submit handler changed.
- A background job, webhook receiver, or long-running async path was added.
- The user says: "audit error handling", "what happens on failure", "any failure paths missing".

**Do NOT run** for: pure backend changes with no UI surface, doc/comment-only changes, test-fixture-only edits.

---

## Workflow

### Step 1 — Determine scope

```bash
git diff --name-only HEAD 2>/dev/null
git diff --cached --name-only 2>/dev/null
```

Filter to: `src/routes/`, `src/components/`, `src/hooks/`, `src/queries/`, `src/fn/`, plus any background-job files. Skip `*.test.*`, `*.d.ts`.

### Step 2 — Run five detectors

#### Detector A — Route loader without errorComponent (**HIGH** severity)

For each new or changed route file:

```bash
# TanStack Start / Router
rg -n --type tsx -F 'createFileRoute(' <changed-route-files>
rg -n --type tsx -F 'loader:' <changed-route-files>
rg -n --type tsx -F 'errorComponent:' <changed-route-files>
```

If a route declares a `loader` but no `errorComponent` (and no project-level default error component is detected): **HIGH**. A failed loader silently shows nothing.

**Auto-fix:** if the project has an existing `errorComponent` convention (locate by grepping a sibling route), insert a matching stub pointing at the same component. Otherwise report only.

#### Detector B — Mutation without `onError` AND without a global error handler (**HIGH** severity)

```bash
rg -n --type tsx -F 'useMutation(' <scope>
rg -n --type ts  -F 'useMutation(' <scope>
```

For each call: check for `onError`. If absent, check whether the project's `QueryClient` config defines a default `mutations.onError` (usually `src/lib/query-client.ts` or similar). If neither: **HIGH** — the user submits, the request fails, the UI shows nothing, and the form may be in a broken state.

#### Detector C — Form button not disabled during submit (**MEDIUM** severity, **auto-fixable**)

```bash
rg -n --type tsx -F '<form ' <scope>
rg -n --type tsx -F 'onSubmit' <scope>
```

For each form using a mutation: check the submit `<button>` for `disabled={isPending}` (or equivalent). If missing: **MEDIUM**, **auto-fixable** when the mutation variable is unambiguously named (`mutation.isPending`, `isPending`, `isSubmitting`).

Also check: is the button re-enabled correctly on error? If `disabled={isPending && !isError}` or similar guard is missing, a failed submit may lock the button forever — flag as **MEDIUM** but **don't auto-fix** (semantics are subtle).

#### Detector D — Server error becomes a generic toast with no retry path (**MEDIUM** severity)

```bash
rg -n --type tsx -F 'toast.error' <scope>
rg -n --type tsx -F 'toast(' <scope>
```

For each error toast: check whether (a) the message is a hard-coded generic ("Something went wrong"), and (b) there's a retry affordance (a button, a refetch hook, anything). If both fail: **MEDIUM** — the user has no path forward.

**Don't auto-fix.** Adding a retry button without understanding the underlying mutation produces broken retries.

#### Detector E — Promise rejection unhandled in non-React async paths (**HIGH** severity)

For background jobs, webhook handlers, and `setTimeout`/`setInterval` callbacks:

```bash
rg -n --type ts -E 'await\s+\w' <scope>
rg -n --type ts -F '.then(' <scope>
```

For each top-level await or `.then`: trace whether the enclosing function has try/catch OR returns a promise that the caller awaits. If the rejection has nowhere to go (fire-and-forget): **HIGH** — silent failure with no log, no retry, no user notification.

### Step 3 — Report

```
## Error-boundary scan — <N> findings (<auto-fixed> auto-fixed)

### HIGH — <count>
1. **Route loader without `errorComponent`** — `<route-file>:<line>`
   - Loader: `<loaderFn>` at line <n>.
   - Suggest: add `errorComponent: RouteErrorFallback` (project convention from `<sibling-route-file>:<line>`).
   - Auto-fixed: <yes | no — no project convention found>.

2. **Fire-and-forget async with no error handling** — `<file>:<line>`
   - `await <fn>()` inside a callback that's not awaited by any caller.
   - Suggest: wrap in try/catch and log via the project's reporter, or surface via the job's status table.

### MEDIUM — <count>
3. **Submit button missing `disabled={isPending}`** — `<form-file>:<line>`
   - Auto-fixed.

4. **Generic error toast with no retry path** — `<file>:<line>`
   - "Something went wrong" with no refetch / retry button.
   - Suggest: include the actual error message OR add a retry affordance bound to `mutation.mutate`.

---

No error-boundary gaps detected.    ← only if 0 findings
```

---

## NEVER

- **NEVER add a try/catch that swallows the error silently**
  **Instead:** Auto-fixes that wrap a call must re-throw, log via the project's reporter, OR surface the error to the UI. A bare `catch {}` is worse than the original gap.
  **Why:** A swallowed error makes the bug invisible AND the report shows a green checkmark — strictly worse than the unhandled state.

- **NEVER auto-add an `errorComponent` if the project has no convention**
  **Instead:** Report and recommend. Auto-fix only when a sibling route in the same project demonstrates the pattern (component name + import path).
  **Why:** A guessed component path either fails to compile or imports a hallucinated component; either way trust in the report drops.

- **NEVER scan the whole repo when a diff exists**
  **Instead:** Default to `git diff --name-only HEAD` ∪ uncommitted; project-wide only on explicit request.
  **Why:** Whole-repo scans surface every legacy mutation without `onError` and bury the actionable findings from the recent change.

- **NEVER flag `useMutation` without `onError` when a `QueryClient` default exists**
  **Instead:** Read the project's QueryClient config first. Only flag if neither the mutation nor the default has an error path.
  **Why:** Default error handlers are common and correct; flagging a mutation that's already covered trains the user to ignore the report.

- **NEVER attempt to auto-fix the "button stuck disabled after error" case**
  **Instead:** Report it, name the file:line, recommend the guard pattern. Let the user pick the right semantics.
  **Why:** "Re-enable on error" can mean retry-friendly (re-enable immediately) or rate-limited (re-enable after delay) or terminal (keep disabled, show contact-support); auto-picking is a bad guess.

- **NEVER report on `*.test.*` or `*.stories.*` files**
  **Instead:** Filter scope before running detectors.
  **Why:** Test and Storybook files intentionally fire-and-forget and don't need production error UX; flagging them is pure noise.
