---
name: audit
description: Whole-codebase tech-debt sweep. Orchestrates every available code-* audit/cleanup skill (duplication, type safety, data integrity, security, contracts, error boundaries, loading states, a11y, concurrency, client-bundle, observability, perf, simplify) across the repo — not just the diff — to find and remove accumulated tech-debt. Produces one consolidated, severity-ranked findings report, then applies mechanical fixes inline and gates structural fixes per-item. Use when the user says "audit the codebase", "tech-debt sweep", "deep clean", "/audit", "find all the rot", "production-readiness pass", "full cleanup", or when ship routes here for a production-grade hardening pass. Skip for — focused diff-only reviews (use code-simplify), single-concern audits (call the specific code-check-* skill directly), and any context where the user only wants a quick fix.
---

> **User-question protocol:** Whenever this skill needs the user to pick between options, confirm an action, or answer a multiple-choice prompt, you MUST call the `AskUserQuestion` tool to render a proper interactive picker. Do NOT print numbered options as plain text and wait for the user to type a number — that produces a degraded UX. Free-form questions (open-ended typing) may be asked in prose, but any time you would write "1) … 2) … 3) …", use `AskUserQuestion` instead.


# Audit

A whole-codebase tech-debt sweep. The diff-scoped `code-simplify` and the per-concern `code-check-*` skills each cover a slice; this skill runs the full battery against the whole repo, deduplicates findings, and walks the user through fixes. It is heavier than `code-simplify` and slower than any single `code-check-*` — invoke it deliberately.

---

## Phase 1 — Scope and confirm

1. Detect repo root, primary language(s), frameworks (TanStack/Next/Electron/etc.), and rough size: `git ls-files | wc -l`.
2. If the working tree is dirty, surface it: an audit on top of in-progress changes will tangle findings with WIP. Ask via `AskUserQuestion`: "(s)tash and audit clean tree / (a)udit current state / (q)uit". Default `s`.
3. If the repo has >2000 source files, ask the user to narrow scope (a directory, a feature area, a route group) before running. A whole-monorepo audit produces noise instead of signal.
4. Announce the battery of audit skills that will run (Phase 3) so the user knows what's coming and can `skip=` any.

**Inputs accepted from caller (e.g., `ship`):**
- `scope=<path>` — narrow to a directory
- `skip=<csv>` — comma-separated list of audit skill names to skip
- `mode=fast|balanced|production` — `fast` runs only `code-simplify` + `code-check-duplication` + typecheck/lint; `balanced` adds the high-leverage audits; `production` runs everything. Default `balanced` when invoked directly; honor caller-supplied mode otherwise.

---

## Phase 2 — Baseline gates

Run first, in parallel via Bash:
- Project typecheck (e.g., `tsc --noEmit`, `pyright`, `cargo check`)
- Linter (e.g., `eslint`, `ruff`, `clippy`)
- Formatter check (no auto-fix yet)
- Test suite (smoke only — full run gated to Phase 5)

Baseline failures get fixed first. Stacking refactors on top of a red baseline buries the signal.

---

## Phase 3 — Parallel audit fan-out

Launch the applicable audit skills concurrently via the `Skill` tool, each scoped to the agreed Phase 1 scope (not just the diff). Pass `mode=audit` so each skill knows it's running repo-wide and should not auto-fix.

**Always (every mode):**
- `code-simplify` — DRY, magic numbers, naming, oversized files (override default diff-only scope to Phase 1 scope)
- `code-check-duplication` — parallel-enum drift, repeated literals
- `code-harden-types` — strip `any`, dangerous casts, missing return types, missing boundary validation

**Balanced and production:**
- `code-check-data-integrity`
- `code-check-error-boundaries`
- `code-check-loading-states`
- `code-check-contracts`
- `code-check-observability-coverage`
- `audit-perf`

**Production only (additionally):**
- `code-check-security-regression`
- `code-check-concurrency`
- `code-check-client-bundle`
- `code-check-accessibility-regression`

**Stack-conditional (auto-include when the stack matches):**
- TanStack Start present → `code-enforce-route-data`, `code-enforce-layers`
- Electron present → `code-debug-electron-platform`

Honor `skip=` from the caller. Do not run audits the user explicitly excluded.

---

## Phase 4 — Consolidate findings

Each audit returns a list. Merge into one report grouped by **severity** (critical / suggested / nit), then by **category**, then by **file**. Deduplicate findings that multiple audits flagged (e.g., a `Promise.all` miss flagged by both `audit-perf` and `code-simplify`) — keep one entry, cite both sources.

Print the consolidated report **before** applying anything. Format:

```
Audit summary — N findings across K categories
  critical: <count>  — <one-line headline>
  suggested: <count>
  nit: <count>

By category:
  type-safety (12):    <top 1–2 examples with file:line>
  duplication (8):     <top examples>
  data-integrity (3):  ...
  ...
```

---

## Phase 5 — Apply (gated)

Two paths, mirroring `code-simplify`:

- **Auto-apply (no per-item prompt):** mechanical fixes only — magic-number → named constant, swap inline logic for a confirmed existing util, single-file local rename, dead-comment delete, formatter auto-fix, lint auto-fix.
- **Per-item gate (via `skill-forge-hitl` when available, else `(a)pply / (s)kip / (q)uit` per item):** every structural fix, every cross-module rename, every behavior-adjacent change.

Before any structural fix on a code path with no covering test, invoke `code-write-tests` for that path and confirm green — same safety-net rule as `code-simplify`.

Apply in this order to keep the diff bisectable:
1. Formatter / lint auto-fixes (one commit-shaped chunk)
2. Type hardening (one chunk)
3. Mechanical simplifications
4. Structural refactors — one at a time, re-run typecheck + targeted tests after each

---

## Phase 6 — Re-verify and report

1. Re-run typecheck, linter, full test suite.
2. Print final summary: applied N, skipped M, surfaced K (couldn't auto-fix).
3. List remaining surfaced findings the user must decide on (architectural, design-input-needed, out-of-scope-but-flagged).
4. **Do not commit.** Hand off to the user: `/commit-and-push`, `/commit-push-and-make-pr`, or `/quick-push`.

---

## NEVER

- **NEVER run all audits silently in the background without announcing the battery**
  **Instead:** Phase 1 must list which audits will run at the chosen mode so the user can `skip=` any.
  **Why:** A 12-audit fan-out that surprises the user looks like runaway tooling. Visibility is the whole point of the orchestrator.

- **NEVER batch-apply structural fixes across categories**
  **Instead:** apply the formatter/lint pass, then types, then mechanical, then one structural fix at a time with verification between.
  **Why:** When a typecheck or test goes red after a batch, you've lost which change caused it; bisectability is the only cheap path to recovery.

- **NEVER expand the audit beyond the agreed Phase 1 scope without asking**
  **Instead:** if a finding points to siblings outside scope, surface them in Phase 6 and ask before touching.
  **Why:** the user agreed to a scope; silently auditing more files turns a 30-minute pass into a multi-hour rewrite they didn't ask for.

- **NEVER honor `mode=fast` on a request that explicitly says "deep dive" or "production"**
  **Instead:** surface the conflict via `AskUserQuestion` and let the user pick informed.
  **Why:** the autopilot caller may pass `fast` based on a heuristic that's wrong for an explicit audit request; the user's wording wins.

- **NEVER auto-apply a fix that one audit flagged but another would conflict with**
  **Instead:** during Phase 4 consolidation, mark conflicting findings and route them through the gate even if each individually looks mechanical.
  **Why:** "extract this helper" from `code-simplify` can collide with "inline this for bundle size" from `code-check-client-bundle`; the user decides which wins.

- **NEVER skip the baseline gates in Phase 2**
  **Instead:** fix typecheck/lint/test failures first, then audit.
  **Why:** stacking refactors on a red baseline means every subsequent failure is ambiguous — was it the audit fix or the pre-existing break?
