---
name: plan-greenfield
description: Generate an exhaustive, dependency-ordered feature backlog for a greenfield product idea. Produces a `specs/` directory of numbered stack-agnostic spec files (001-…, 002-…) — each with description, user story, acceptance criteria, edge cases, and test scenarios — plus a 000-build-order.md roadmap. Inverse of extract-specs. Use when the user has a product concept ("I want to build a newsletter manager", "help me plan a habit tracker", "what features should a podcast hosting app have") but no codebase yet. Trigger phrases — "greenfield", "new project", "plan a product", "feature backlog", "feature roadmap", "what features should X have", "generate specs for", "help me scope". Skip for: existing codebases (use extract-specs), single-feature additions (use add-feature), non-product planning.
---

# Greenfield Features

Turn a product concept into a dependency-ordered backlog of 30–80 spec files. The skill's job is **breadth + ordering + depth-per-spec** — three things users can't do alone in one sitting.

## Phases

```
Phase 1: Clarify    → product shape recap, user accepts
Phase 2: Brainstorm → exhaustive feature list across domains, user accepts
Phase 3: Order      → dependency-ranked sequence with tier rationale
Phase 4: Write      → spec files + build-order roadmap
```

Do not collapse phases. Each phase has a checkpoint the user must approve before the next runs.

---

## Phase 1 — Clarify

Recap before generating. Do not proceed on "unknown" for product, primary user, must-haves, or breadth.

Required slots:

- **Product** — one-sentence pitch
- **Primary user** — who, and what job they hire the product for
- **Must-haves** — 1–3 things that define "the product works"
- **Non-goals** — what's explicitly out of scope (prevents bloat)
- **Scale signal** — solo/small-team/SaaS/marketplace (drives admin, billing, multi-tenancy)
- **Monetization** — free/paid/freemium/none-yet (drives billing, plans, limits)
- **Breadth preference** — MVP-only (~15 features) / Standard (~30) / Exhaustive (~60+)

If the user gave only a product name, ask the missing slots in one batched question — don't ping-pong.

Output the recap, then ask `(a)ccept / (r)evise / (q)uit`. Do not proceed on "unknown" for product, primary user, must-haves, or breadth.

---

## Phase 2 — Brainstorm

**MANDATORY — READ [`references/feature-domains.md`](references/feature-domains.md)** before listing features. The checklist is the antidote to the #1 failure: stopping at the 5 obvious features. Do NOT load during Phases 1, 3, or 4.

Before brainstorming, ask yourself: which domains does this product's scale + monetization make non-negotiable (paid → billing & plan limits; multi-user → admin & permissions; public-facing → SEO & share pages), and which become deferrable? Then walk every domain in the checklist with that lens. Skip domains that genuinely don't apply (a local-only CLI doesn't need billing) — but skip *deliberately*, not by forgetting.

Produce a flat list:

```
- <feature-slug>: <one-line description>  [domain]
```

Target counts (after de-duplication):

- MVP: 15–20
- Standard: 30–40
- Exhaustive: 60–90

If walking every applicable domain yields fewer features than the breadth target, report the gap honestly — do not pad with low-value features to hit a number.

Show the full list. Ask `(a)ccept / (r)evise — add/remove/rename / (q)uit`. **Do not** write any files yet. Editing a list is cheap; editing 60 files is not.

---

## Phase 3 — Order

Sort the accepted list into tiers, then within tiers by dependency:

1. **Foundation** — auth, core data model, project/workspace scaffolding, primary entity CRUD
2. **Core loop** — the must-haves from Phase 1; the thing the product *is*
3. **Retention & polish** — search, filters, notifications, onboarding, empty states
4. **Growth** — sharing, referrals, public pages, SEO, integrations
5. **Operational** — admin, billing, plan limits, audit log, analytics, exports
6. **Compliance & scale** — rate limits, soft-delete/recovery, GDPR export/delete, SSO, audit, i18n

Within each tier, a feature must come after every feature it depends on (a feature depends on another if it cannot be demoed without it). Number sequentially across tiers: `001` through `NNN`.

Show the ordered list with tier headers and a one-line rationale per tier. Ask `(a)ccept / (r)evise / (q)uit`.

---

## Phase 4 — Write

Create `specs/` in the current working directory. If it exists and is non-empty, ask the user before writing (offer: overwrite, write to `specs-v2/`, abort).

For every feature, write `specs/NNN-<slug>.md` using **MANDATORY — READ [`references/spec-template.md`](references/spec-template.md)** for the exact section list and depth requirements. Do NOT load before Phase 4. Every section is required; "N/A" is allowed only with one sentence explaining why.

Also write `specs/000-build-order.md`:

- Tier headers with rationale
- Each feature listed as `NNN. <name> — <one-line> (deps: 003, 007)`
- A "Suggested milestones" section grouping features into 3–6 shippable releases

Stream progress: after every 10 specs, print `wrote 010/NN`. Do not silently grind through 60 files.

When done, print: total feature count, tier breakdown, path to `000-build-order.md`, and the suggested first 3 features to implement.

---

## NEVER

- **NEVER skip Phase 1 clarification, even if the user gave a product name.**
  **Instead:** Ask the missing slots in one batched question, recap, get acceptance.
  **Why:** A backlog for the wrong-shape product (wrong scale, wrong monetization, wrong primary user) is worse than no backlog — the user discards it but feels obligated to read it first.

- **NEVER stop at the obvious 5–10 features.**
  **Instead:** Walk every domain in `references/feature-domains.md`, deliberately skipping ones that don't apply at the user's scale.
  **Why:** The user can already list the obvious features themselves. The skill's value is the non-obvious ones (audit log, soft delete, plan limits, empty states, onboarding).
  **Example:** For a newsletter app, obvious = compose / send / list. Non-obvious = bounce handling, unsubscribe-link compliance, sender-reputation warmup, list hygiene & re-engagement, double opt-in, suppression list, deliverability monitoring.

- **NEVER include implementation details — frameworks, schemas, file paths, library names, table names.**
  **Instead:** Describe behavior, contracts, and constraints. "Users can search messages by keyword and date range" — not "Postgres full-text index on `messages.body`".
  **Why:** Specs outlive stack choices. A Postgres-shaped spec is useless if the user picks SQLite or DynamoDB.

- **NEVER order features alphabetically, by domain, or by perceived importance alone.**
  **Instead:** Use the tier system + within-tier dependency ordering from Phase 3. A feature comes after every feature it depends on.
  **Why:** Build order is the deliverable. A backlog the user can't walk top-to-bottom is just a feature list, which they could have brainstormed in 10 minutes.

- **NEVER write spec files before the user accepts the Phase 2 list AND the Phase 3 order.**
  **Instead:** Show the list first, the order second, write last.
  **Why:** Revising a 60-line list takes 30 seconds. Revising 60 files takes an hour and discourages revision, so the user lives with a wrong backlog.

- **NEVER write a spec missing any template section.**
  **Instead:** Every section from `references/spec-template.md` is required; mark "N/A" with a one-sentence reason if a section truly doesn't apply.
  **Why:** A spec without acceptance criteria or edge cases is a TODO line with extra words. The depth-per-spec is half the skill's value.

- **NEVER assume a feature is "obvious" and shorten its spec.**
  **Instead:** Even "user can log in" gets full edge cases (locked account, expired token, concurrent session, password reset mid-login).
  **Why:** Obvious features are where edge cases hide; the user's brain glossed over them, which is exactly why they invoked the skill.
