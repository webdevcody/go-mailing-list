---
name: add-feature
description: End-to-end workflow for planning and shipping a new feature in an existing codebase. Phases — clarify → explore → design → mandatory plan-approval gate → implement (subagent fan-out where useful) → verify → gated reviews (code + duplication always; security if backend logic changed; performance if DB/queries changed) → automated tests. Also enforces UI-convention parity: any new instance of a recurring UI surface (modal, dialog, drawer, form) must match sibling conventions for hotkeys, kbd hints, focus, and loading states. Accepts `mode=fast|balanced|production` to control depth (default: production); also accepts `include=<phases>` / `skip=<phases>` overrides. Use when the user asks to add, build, ship, or implement a new feature: "add a feature", "build this", "implement X", "new feature", "plan and build", "ship this". Skip for bug fixes (use fix-bug), pure refactors, enum/state renames (use code-realign), or one-line tweaks.
---

> **User-question protocol:** Whenever this skill needs the user to pick between options, confirm an action, or answer a multiple-choice prompt, you MUST call the `AskUserQuestion` tool to render a proper interactive picker. Do NOT print numbered options as plain text and wait for the user to type a number — that produces a degraded UX. Free-form questions (open-ended typing) may be asked in prose, but any time you would write "1) … 2) … 3) …", use `AskUserQuestion` instead.


# Feature Delivery

Drive a non-trivial feature from request to merged code without the four failures this skill exists to prevent: **shallow clarification, unreviewed code, bad code merged, duplication.**

The workflow is gated. Do not skip the approval checkpoint. Do not skip the review phase. Reviews themselves are gated — run only the ones the diff actually requires.

---

## Modes

This skill accepts a `mode=` argument that controls depth of execution. Default — when no `mode=` is specified — is `production`: the full 8-phase pipeline below.

| Mode | Phases that run | Phases skipped |
|---|---|---|
| `production` (default) | 1, 2, 3, 4, 5, 6, 7a, 7b, 7c (gated), 7d (gated), 8 | none — full pipeline |
| `balanced` | 1, 2, 3, 5, 6, 7a, 7b | 4 (Plan-gate), 7c (Security), 7d (Perf), 8 (Tests) |
| `fast` | 5, 6 | 1, 2, 3, 4, 7a, 7b, 7c, 7d, 8 |

**`include=` / `skip=` overrides.** Add or remove specific phases on top of the mode default — `mode=fast include=8` runs implement + verify + tests; `mode=production skip=7c` skips the security review even when the gate would have triggered. `include=` wins over the mode default; `skip=` wins over both.

**Mode safety override.** If `mode=fast` is requested for work that touches auth, payments, secrets, schema migrations, or external webhooks, pause and surface the conflict via `AskUserQuestion`: *"Detected high-risk signals. You requested fast mode — that skips clarify, plan, reviews, and tests. Confirm fast anyway, or upgrade to production?"* The `/ship` orchestrator enforces this upstream, but direct manual callers may not — don't silently honor a dangerous override.

**Phase-gated NEVER scope.** Several rules in the NEVER section below are phase-gated. When the active mode skips a phase, the corresponding NEVER is explicitly suspended for that run:

- `mode=fast` suspends: *"NEVER write feature code before Phase 4 approval"*, *"NEVER skip clarifying questions"*, *"NEVER skip the duplication scan"*, *"NEVER ship a new field to only one CRUD surface"*, *"NEVER ship a new UI instance without sibling audit"*
- `mode=balanced` suspends: *"NEVER write feature code before Phase 4 approval"*

The universal NEVERs stay in force in every mode: no fan-out for tightly coupled work, declare-done only after running the code, no irrelevant security/perf review, no `--no-verify` bypass.

---

## Phase 1 — Clarify

Most failures originate here. The user's first message is almost never enough.

Before asking anything, write down what you currently understand and what you don't:

```
## Understanding so far
**Goal:** ...
**User-visible behavior:** ...
**Touchpoints (best guess):** ...
**Open questions:** ...
**Impact on existing system:** ...
```

Then ask clarifying questions covering — at minimum — these categories. Skip a category only if the answer is genuinely unambiguous from context, and say which you're skipping and why:

1. **Scope** — what's in, what's explicitly out
2. **User experience** — exact UX, error states, empty states, loading
3. **Data** — first decide *whether* to persist before *what schema*. Default to derive-on-read for cheap/small/transient computation; default to persist when any of these triggers hit: per-request scan is expensive (filesystem walks, JSONL/log parsing, external API aggregation), the same inputs are queried repeatedly with mostly-unchanged results, results aggregate across sessions/runs, the source is slow or rate-limited, or the feature needs historical queries the source itself may not preserve (rotation, compaction, deletion). Once persist is chosen, then: new tables/columns, new fields on existing rows, retention, backfill.
4. **API surface** — new endpoints, contract changes to existing ones, auth requirements
5. **Integration points** — what existing features does this touch, change, or risk breaking
6. **CRUD/input surfaces** — enumerate every place a user creates, edits, configures, imports, or duplicates the affected artifact (create dialog AND edit dialog, settings page, bulk import, CSV upload, API client). For each surface, decide explicitly whether the new field/behavior applies — silently shipping to only one is the most common "incomplete" failure. This is the inward complement to #5 (which looks outward at unrelated features that might break).
7. **Edge cases** — concurrent writes, partial failures, large inputs, permissions
8. **Non-goals** — adjacent things the user does *not* want done now
9. **Done criteria** — how the user will recognize this is finished

**Always use the AskUserQuestion tool** (multi-question, structured choices) to ask clarifying questions — never present them as a static numbered list the user has to type answers to. Fall back to free-form prose only for a single question whose option space is genuinely open-ended.

**Exit gate:** Restate the feature in your own words including impact on existing code. Get explicit confirmation before Phase 2. Do not proceed on assumed answers.

---

## Phase 2 — Explore Existing Code

Read before writing. This is where duplication gets prevented and integration points get found.

Map at least:
- Files/modules likely touched
- Existing patterns for similar features (reuse, don't reinvent)
- Shared utilities, hooks, components that the new code should compose with
- Tests that currently cover adjacent behavior
- Data model: schemas, migrations, query patterns

**UI surface parity.** If the feature will create a new instance of a recurring UI surface (modal, dialog, drawer, sheet, popover, form, confirm prompt, command palette, toolbar button, list-row action), grep for 2–3 sibling instances in the codebase and inventory their conventions — submit/cancel hotkeys (e.g. `Cmd+Enter`, `Esc`), `<Kbd>` hint placement, autofocus target, loading/disabled states, footer chrome, error display. Record the inventory in the plan; matching them is the default, diverging requires a stated reason. The `agentsystem-frontend-ux:propagate-ui-pattern` skill is the operational tool when 3+ siblings exist.

**Subagent fan-out — use when scope is wide.** Spawn parallel `Explore` agents in a single message when:
- Feature spans 3+ distinct subsystems (e.g., DB + API + UI + jobs)
- You need to survey "is there already a utility for X?" across the repo
- Different areas have independent search criteria

See [`references/subagent-playbook.md`](references/subagent-playbook.md) for fan-out patterns and prompt templates.

**Exit gate:** You can name the existing files this feature will modify, the existing utilities it will reuse, the integration risks, AND every CRUD/input surface for the affected artifact (or confirm only one exists), AND — if a recurring UI surface is being added — you can name the sibling instances and the conventions you'll match. If you can't, keep exploring.

---

## Phase 3 — Design

Produce a plan covering:

- **Persistence decision** — one of `persist | derive-on-read | hybrid (cache + source of truth)`, with a one-line reason tied to the Phase 1 #3 triggers. If `derive-on-read`, state the cost ceiling that justifies it (e.g., "<200ms scan, <100 files, no historical retention need"); if that ceiling is plausibly breached in the lifetime of the feature, choose `persist` or `hybrid` instead.
- **Data changes** — schema, migrations, indexes, backfill (if any)
- **API/contract changes** — new endpoints, modified responses, breaking vs additive
- **Code structure** — files to create, files to modify, what each is responsible for
- **Reuse decisions** — which existing utilities/components/hooks compose in
- **UI convention parity** — for each new instance of a recurring UI surface, list the sibling conventions being matched (hotkeys, kbd hints, focus, loading, escape behavior)
- **Test plan** — what to assert at unit / integration / e2e level
- **Rollout** — feature flag? migration ordering? backwards compat?
- **Risks** — what's most likely to break, and how the plan mitigates it

Keep it lean — bullet points over prose. The plan exists to be reviewed, not to be archived.

---

## Phase 4 — Plan Approval Gate (MANDATORY)

Present the plan to the user. **Do not write feature code before approval.** Use ExitPlanMode if available, otherwise present plainly and ask `(a)pprove / (r)evise / (q)uit`.

If the user revises, update the plan and re-present. Do not interpret silence as approval. Do not interpret "looks good" on a partial summary as approval — they must see the full plan.

**Stuck-revision rule:** if the plan gets rejected 3+ times on the same dimension, the underlying request is likely ambiguous, not the plan. Stop revising, return to Phase 1, and re-clarify.

Tiny mechanical setup (creating empty files, adding a dependency the plan calls for) is fine before approval. New behavior is not.

---

## Phase 5 — Implement

Work the plan. Order: data layer → server/business logic → API → UI → wiring.

**Subagent fan-out — use when work is genuinely independent.** Spawn parallel implementation agents in one message only when:
- Two or more files have no shared edits and no ordering dependency (e.g., a new DB migration AND an unrelated UI component)
- You can give each agent self-contained context (file paths, contracts, constraints)
- Merging their outputs won't conflict

Do NOT fan out for: tightly coupled changes, anything where one piece's API shape determines another's, or refactors that touch many files of the same kind.

When in doubt, do it serially. A wasted parallel agent is cheaper than two agents producing inconsistent code.

**If implementation reveals the plan was wrong** (not just incomplete — wrong assumption, wrong shape, wrong integration point): stop, return to Phase 3, re-design, and re-approve. Do not silently improvise around a broken plan.

---

## Phase 6 — Verify

Before any review, prove the code runs:

- Standard checks pass (type-check, lint, build, existing tests) — table stakes.
- **Actually execute the new code path.** This is the non-obvious one — UI changes get opened in a browser, endpoints get hit, jobs get run. "Compiles" ≠ "works."

If any check fails, fix root cause — do not bypass with `--no-verify`, skipped tests, or `any` casts.

---

## Phase 7 — Gated Reviews

Run reviews **on the diff you just produced**. Each review is gated by what the diff actually contains. Always run code review and duplication scan; security and performance only if their gate triggers.

Subagent fan-out is encouraged here: dispatch the applicable reviews in parallel as separate agents, then consolidate findings.

### 7a. Code Review — ALWAYS
Read [`references/code-review-checklist.md`](references/code-review-checklist.md) and apply it to the diff.

### 7b. Duplication Scan — ALWAYS
For each new function/component/utility, search the repo for existing equivalents. If found, refactor to reuse. Also scan the new diff itself for parallel-array patterns, repeated literal-equality filters, and sibling blocks differing only by a literal.

### 7c. Security Review — GATED
**Run only if the diff changed backend logic** (server routes, server actions, auth, authz, query construction, file I/O on server, env/secret usage, deserialization, IPC handlers, anything executed outside the user's browser).

If gate triggers → read [`references/security-review-checklist.md`](references/security-review-checklist.md) and apply.
**Do NOT load** `security-review-checklist.md` if the diff is purely client-side rendering / styling / static config / docs — skip and say so.

### 7d. Performance Review — GATED
**Run only if the diff changed DB schema, queries, or a known hot path** (new tables/columns/indexes, new SQL, new ORM calls, new loops over user-scale data, new N+1 risks, new server-side aggregation).

If gate triggers → read [`references/performance-review-checklist.md`](references/performance-review-checklist.md) and apply.
**Do NOT load** `performance-review-checklist.md` if the diff is purely UI logic with no new data access — skip and say so.

### Resolving review conflicts
If two review subagents contradict each other (e.g., one flags a query as N+1, another says it's fine), pick one and document why. Do not average — one is right and one is wrong. Read both findings against the actual code and decide.

### Review exit gate
Every finding must be either fixed or explicitly acknowledged with the user before continuing. Do not silently defer issues.

---

## Phase 8 — Automated Tests

Add tests where they earn their keep:
- **Unit** — pure functions, non-trivial branching logic, parsers, validators
- **Integration** — API endpoints (real DB if the project does that — check existing test conventions), data-layer code, multi-module flows
- **E2E / UI** — only if the project already has an E2E harness; otherwise stop at integration

Skip tests for: trivial UI wiring, one-line wrappers, pure config. Match the project's existing test density — don't introduce a testing culture the codebase doesn't have.

Run the new tests. Then run the full suite once more.

---

## NEVER

- **NEVER write feature code before Phase 4 approval**
  **Instead:** Stop at the plan, present it, wait for explicit approval.
  **Why:** Skipping the gate is the most common path to "this isn't what I asked for" rework. The user catches scope errors in plans far cheaper than in diffs.

- **NEVER skip clarifying questions because the request "seems clear"**
  **Instead:** Walk the eight categories in Phase 1; explicitly skip ones with obvious answers and say why.
  **Why:** "Seems clear" is the single biggest source of wrong implementations. Ambiguity hides in scope, edge cases, and integration points the user assumed you'd know.

- **NEVER fan out subagents for tightly coupled work**
  **Instead:** Fan out only when pieces are independent (different files, no shared API shape, no ordering dep). Otherwise, serial.
  **Why:** Parallel agents on coupled code produce inconsistent contracts that cost more to reconcile than the time saved.

- **NEVER declare done without running the new code path**
  **Instead:** Execute it — open the page, hit the endpoint, run the script — even if types and tests pass.
  **Why:** Type checks verify code shape, not feature behavior. "Compiles" ≠ "works."

- **NEVER skip the duplication scan**
  **Instead:** For every new utility/component/helper, search the repo for an existing equivalent before keeping it.
  **Why:** Duplication is the user's stated top failure mode. Most duplication is created by agents who didn't look.

- **NEVER ship a new field or behavior to only one of an artifact's CRUD surfaces without explicit confirmation**
  **Instead:** During Phase 1, enumerate every create/edit/settings/import surface for the artifact; mark each as "applies" or "explicitly skipped". Confirm with the user.
  **Why:** Edit-only features are the most common shipped-but-incomplete failure — the user discovers it by trying to set the field at create time and finding it missing.

- **NEVER ship a new instance of a recurring UI surface (modal, dialog, drawer, form, confirm prompt, command palette) without auditing sibling instances and matching their conventions**
  **Instead:** During Phase 2, grep for 2–3 siblings of the surface; inventory their hotkeys, kbd hints, autofocus, escape behavior, loading states, footer chrome. Match them by default; a divergence requires a stated reason in the plan.
  **Why:** Inconsistent UI is the loudest "this wasn't built by us" signal. The user notices the missing `Cmd+Enter` on the new modal the first time they try to submit it — every time. Reuse of primitives (Modal, Btn) is necessary but not sufficient; behavior parity is the part that actually feels native.

- **NEVER default to derive-on-read for features whose source data is expensive to scan, grows unboundedly, or is needed for historical queries — without explicitly considering persistence**
  **Instead:** Make the persist-vs-derive call explicit in Phase 3 with a stated reason. If derive-on-read, name the cost ceiling that justifies it.
  **Why:** Scan-on-request silently degrades as data grows; the cost only becomes visible after ship, when the page that loaded fast in dev now blocks the event loop in prod.
  **How to apply:** Triggers are per-request filesystem walks, JSONL/log parsing, external API aggregation, repeated queries over mostly-unchanged inputs, and any data the source itself may not preserve (rotation, compaction, deletion).

- **NEVER run security or performance review on irrelevant diffs**
  **Instead:** Apply the gate (backend logic touched? DB/hot path touched?) and explicitly state when you're skipping and why.
  **Why:** Running every review on every diff floods findings with noise and trains the user to ignore them. Gated reviews stay credible.

- **NEVER bypass a failing check with `--no-verify`, `any`, skipped tests, or commented-out assertions**
  **Instead:** Find root cause and fix it, or surface the failure to the user as a blocker.
  **Why:** Bypasses are how "bad code gets through" — the exact failure mode this skill exists to prevent.

---

## One trigger question before each phase

> "What failure mode does skipping this phase create, and am I willing to accept it?"

If you can't answer, don't skip.

---

## Post-step: /code-simplify

After implementation lands and tests pass, run `agentsystem-core:code-simplify` against the diff to sweep for duplication, missed reuse of existing utilities, oversized components, magic numbers, and tight coupling — refactored in place without changing behavior.

## Post-step: /polish-ui (UI changes only)

If the diff touches UI files (`src/components/**`, `src/routes/**`, `src/pages/**`, `app/**` — `.tsx`/`.jsx`), run `agentsystem-frontend-ux:polish-ui` to verify kbd hints on hotkey-bound buttons, focus management, loading/disabled states, and footer/chrome consistency. Skip when the UI delta is a one-line copy or style tweak.
