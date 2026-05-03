---
name: extract-specs
description: Reverse-engineer a brownfield codebase into per-feature spec .md files (acceptance criteria, edge cases, preconditions, testing scenarios) ordered by a dependency graph, so a developer can rebuild the system feature-by-feature on any stack. Specs are high-level and stack-agnostic — no framework, file, or schema detail unless it encodes a real business constraint (RPS, data volume, retention, SLA). Use when the user says "extract specs from this codebase", "reverse engineer this project", "brownfield rebuild", "document features for a rewrite", "feature inventory", "dependency-ordered build order", "what would I need to rebuild this", or "export business requirements from code".
---

# Brownfield Blueprint

Turn an existing codebase into a dependency-ordered set of feature specs a developer could rebuild from on any stack.

Output goes to a single directory the user picks (default: `./blueprint/`). Specs are **high-level capability descriptions**, not implementation notes.

---

## Phase 1 — Scope

Ask the user (one message, batched):

1. **Output directory?** (default `./blueprint/`)
2. **Scope to include?** (whole repo / specific modules / exclude admin/ops?)
3. **Hidden context the code can't reveal?** (pricing rules, contractual SLAs, why a flow exists, deprecated-but-still-running features, compliance constraints)
4. **Known non-functional constraints?** (target RPS, data volume, retention windows, latency budgets) — only the ones that are *requirements*, not current measurements
5. **Stack keywords for the leak check?** Collect framework names, ORMs, primary library names, and top-level table/collection names. Used in Phase 5 to grep specs and verify no implementation detail leaked in. If the user doesn't know, derive a list from `package.json` / `requirements.txt` / `go.mod` / etc. and confirm.

Record answers. If the user can't answer #3 or #4, proceed and mark gaps as `UNKNOWN — confirm with stakeholder` in the specs.

Confirm with user: `(a)ccept / (e)dit / (q)uit`. Do not proceed until accepted.

---

## Phase 2 — Feature Inventory

**MANDATORY — READ [`references/scanning-playbook.md`](references/scanning-playbook.md)** before scanning. It lists the surfaces to inspect (routes, background jobs, scheduled tasks, auth flows, billing, notifications, admin tools, integrations, data lifecycle) and what signals indicate a feature boundary. Do NOT load `spec-template.md` or `feature-boundaries.md` during this phase.

Before scanning, ask: who would *name* this capability — a user, an operator, or a third-party integrator? If no one would name it, it is not a feature.

Scan the codebase. Produce a **candidate feature list** as a flat markdown list grouped by domain area. Each entry: `- <feature name> — <one-sentence user-facing capability>`.

**Boundary rule:** a feature is a capability a user, operator, or external system would *name* — not a function, route, or table. Collapse implementation splits (e.g. one capability across three services = one feature). If unsure, consult [`references/feature-boundaries.md`](references/feature-boundaries.md).

Present the list to the user. Ask: `(a)ccept / (e)dit / (q)uit`.

- `e` — user adds, removes, renames, splits, merges; loop
- Do **not** proceed to Phase 3 until accepted

Exit condition: approved feature list.

---

## Phase 3 — Dependency Graph

Do NOT load `spec-template.md` during this phase.

For each feature, identify its **preconditions**: which other features must exist for this one to be meaningful (e.g. "Checkout" requires "Cart" and "User Accounts"). Use code dependencies as a *hint*, not the answer — the dependency graph is about user-facing meaning.

Produce two artifacts in the output dir:

- `DEPENDENCIES.md` — adjacency list: `<feature>: <preconditions...>`
- `BUILD_ORDER.md` — a topological linearization with a one-line rationale per position. Break cycles by identifying a minimal-viable version of one feature and noting the deferred capability.

Present both to the user. `(a)ccept / (e)dit`. Do not proceed until accepted.

---

## Phase 4 — Spec Generation

**MANDATORY — READ [`references/spec-template.md`](references/spec-template.md)** before writing the first spec. Use it verbatim for every feature file. Do NOT re-load `scanning-playbook.md` — feature inventory is locked at this point.

For each feature in build order, write `<output-dir>/<NN>-<slug>.md` (NN = 2-digit build position). Generate them in order so that when writing feature N you can reference features 1..N-1 by name in the preconditions section.

For each section of the template, derive content from the code:
- **User stories / acceptance criteria** → from observable behavior at the boundary (HTTP responses, UI states, emitted events)
- **Edge cases** → from conditional branches, error handlers, retry logic, validation rules — translated into business language
- **Preconditions** → from Phase 3 graph
- **Testing scenarios** → Given/When/Then derived from acceptance criteria, not from existing tests
- **Non-functional notes** → only include if a real requirement (Phase 1 #4) or the code reveals one (rate limits, batch sizes that exist for business reasons)

When the code is ambiguous about *intent*, write `UNKNOWN — <specific question to ask stakeholder>` rather than guessing.

After all specs are written, generate `<output-dir>/README.md` with: project one-liner, feature count, link to BUILD_ORDER.md, link to DEPENDENCIES.md, list of all `UNKNOWN` markers grouped by spec.

---

## Phase 5 — Self-Check

Before reporting done, verify:

1. Every feature in the inventory has a spec file
2. Every preconditions list references only features that appear earlier in build order
3. No spec mentions a framework, library, file path, function name, table name, or column name (grep the output dir for the project's stack keywords)
4. Every `UNKNOWN` is collected in the README

Report: feature count, unknown count, output path. Done.

---

## NEVER

- **NEVER include framework, library, file, function, table, or column names in spec bodies**
  **Instead:** describe the *capability* in stack-agnostic terms ("the system persists the cart across sessions", not "the cart is stored in Redis").
  **Why:** the goal is a rebuild on *any* stack; implementation names lock the rebuild to the original stack and turn specs into stale documentation.

- **NEVER invent a business rule the code can't justify**
  **Instead:** write `UNKNOWN — <specific stakeholder question>` and collect it in README.
  **Why:** hallucinated requirements are worse than missing ones — a developer rebuilding from a confidently-wrong spec ships the wrong product.

- **NEVER write specs before the user approves the feature inventory (Phase 2) and dependency graph (Phase 3)**
  **Instead:** stop at each gate and wait for `(a)ccept`.
  **Why:** spec generation is expensive; if boundaries or order are wrong, every file has to be redone. Cheap gates protect costly work.

- **NEVER produce one feature per route/function/file**
  **Instead:** collapse to user- or operator-named capabilities; multiple endpoints serving one capability = one feature.
  **Why:** per-route specs produce hundreds of micro-files that obscure the actual product and make build ordering meaningless.

- **NEVER include numeric details (timeouts, batch sizes, queue depths, retry counts) unless they encode a business requirement**
  **Instead:** include them only when Phase 1 #4 named them, or the code's comments/structure show they exist for a stated business reason (compliance window, contractual SLA, vendor rate limit).
  **Why:** current values are usually implementation tuning, not requirements; including them locks the rebuild to incidental choices.

- **NEVER drop a feature when breaking a dependency cycle**
  **Instead:** split it into an MVP version (placed earlier in build order) and a deferred extension (placed later), and write both as separate specs that reference each other in their preconditions.
  **Why:** silently dropping a feature to break a cycle erases business requirements that the rebuild needs but won't discover until late — by then, the developer has already built around its absence.

- **NEVER skip the dependency graph or output specs without build-order numbering**
  **Instead:** Phase 3 is mandatory; filenames must be `NN-slug.md`.
  **Why:** without an order, the developer can't pick a starting point and will hit missing-precondition walls mid-rebuild.
