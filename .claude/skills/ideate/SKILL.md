---
name: ideate
description: Brainstorm grounded new-feature ideas for an existing codebase via parallel Explore fan-out, present a 5-item shortlist with WHY (UX/product justification tied to observed gaps), then write the user's pick to specs/ideas/NNN-slug.md in plan-greenfield format. Trigger phrases: "/ideate", "ideate", "what should I build next", "feature ideas", "what's missing from this product", "suggest a new feature", "brainstorm features", "where should this product go", "what to build next". Skip for: greenfield with no code (plan-greenfield), implementing a chosen feature (add-feature), small tweaks to existing features (modify-feature), bug fixes (fix-bug).
---

# Ideate

Survey the codebase, propose grounded ideas with WHY, let the user pick one, write a spec.

---

## Phase 1 — Survey (parallel Explore fan-out)

Spawn **four Explore subagents in a single message** (parallel — independent reads). Each gets a focused axis. Specify thoroughness `medium` unless the repo is tiny.

| Agent | Focus | Report shape |
|-------|-------|--------------|
| **Features** | Routes, top-level UI surfaces, primary user actions. What can a user *do* today? | Bulleted feature inventory |
| **Flows** | End-to-end paths (signup → first action → repeat use). Where do flows end abruptly or require manual work? | Flows + drop-off / friction points |
| **Data model** | Persisted entities, relationships, what's tracked vs untracked. Lifecycle states, audit trails, history. | Entity list + notable absences |
| **Gaps** | Common-in-this-product-category features that are *missing*. TODOs, commented-out code, half-built scaffolds. | Missing-affordance list with evidence |

Each subagent must return **under 300 words** and cite file paths. You synthesize — do not dump raw subagent reports to the user.

**Exit condition:** you can name the product's core loop in one sentence and list 3+ concrete gaps with file evidence.

---

## Phase 2 — Shortlist (5 ideas with WHY)

**Before writing each idea, ask:** what observed gap from Phase 1 does this close, and would removing this idea make the shortlist *worse* (not just shorter)? If the answer is "the shortlist is fine without it," cut it.

Produce exactly **5 ideas**, each formatted:

```
### N. <Idea name>

**What:** <one sentence — concrete, not abstract>
**Why it improves UX/product:** <the specific user pain or product gap this closes — tie to Phase 1 evidence>
**Grounded in:** <file path or feature observed in Phase 1>
**Effort signal:** <small / medium / large — based on what surfaces it touches>
```

Rank by **leverage** (impact ÷ effort), highest first.

**Quality bar — reject any idea that:**
- Could apply to any SaaS product (not specific to this codebase)
- Already exists in the repo (Phase 1 should have caught it)
- Has a vague "Why" ("better UX", "more powerful", "users will love it")
- Cites no file/feature from Phase 1

If you can't produce 5 that pass the bar, return fewer with a note on why — do not pad.

End with: **"Pick one (1–5), or reply `more` for additional ideas, or `refine N` to iterate on idea N."**

---

## Phase 3 — Checkpoint (user picks)

**STOP. Do not write any spec file until the user picks a number.**

Handle responses:
- `1`–`5` → proceed to Phase 4 with that idea
- `more` → generate 5 more (different angles — don't repeat)
- `refine N` → ask one targeted question about idea N, then revise it
- Anything else → ask which idea or whether they want to abort

---

## Phase 4 — Write spec

1. Determine path: `specs/ideas/NNN-slug.md` where `NNN` is the next zero-padded integer based on existing `NNN-*.md` files in `specs/ideas/`. Start at `001` if the directory is empty or missing (create it). If the directory contains files that don't match `NNN-*.md`, ignore them — start at `001` (or continue from the highest matching prefix).
2. Slug: lowercase, hyphenated, derived from idea name.
3. Use the template at `references/spec-template.md` (MANDATORY READ before writing).
4. Fill every section. Acceptance criteria must be testable. Edge cases must be specific (not "handle errors gracefully").
5. After writing, output the absolute path and a one-line summary. Do not implement the feature — that's `/add-feature`'s job.

---

## NEVER

- **NEVER skip the parallel Explore fan-out and brainstorm from memory of the repo**
  **Instead:** Spawn the four subagents in one message even if you "already know" the codebase.
  **Why:** Memory of past sessions decays and misses recent changes; ungrounded ideas are the #1 failure mode of this skill.

- **NEVER write the spec file before the user picks an idea**
  **Instead:** Stop after Phase 2 and wait for a numeric pick.
  **Why:** Writing 5 specs upfront wastes work on 4 rejected ideas and biases the user toward whichever you wrote first.

- **NEVER include an idea whose "Why" is generic ("improves UX", "more flexibility")**
  **Instead:** Tie every Why to a specific observed gap, friction point, or missing affordance from Phase 1.
  **Why:** Generic justifications are indistinguishable from hallucination — the user can't evaluate or prioritize them.

- **NEVER suggest features that already exist in the codebase**
  **Instead:** Cross-check each candidate against the Features-agent inventory before listing it.
  **Why:** Suggesting existing features destroys trust in the entire shortlist.

- **NEVER dump raw subagent reports to the user**
  **Instead:** Synthesize Phase 1 into ≤5 lines total (one-sentence product-loop summary + 3–4 gap bullets) before showing the shortlist. Raw subagent text never appears in user output.
  **Why:** Raw reports flood context and bury the ideas the user actually needs to evaluate.

- **NEVER implement the chosen feature in the same session**
  **Instead:** Stop after writing the spec file and point the user at `/add-feature`.
  **Why:** Ideation and implementation need different mindsets; bundling them produces rushed specs and half-built features.
