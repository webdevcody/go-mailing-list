---
name: ship
description: Autopilot orchestrator for engineering work. Classifies the user's request as CREATE / EVOLVE / REMOVE / FIX, infers a depth mode (fast / balanced / production) from risk + complexity signals, announces the pipeline, then routes to the matching core skill (add-feature / modify-feature / remove-feature / fix-bug) with mode= and any include= / skip= overrides. STOPS at code-ready — never commits, pushes, or opens PRs. Use when the user describes a goal and wants the system to pick the right workflow and depth on its own. Trigger phrases — "ship", "/ship", "ship this", "just build this", "make this happen", "figure it out for me", "autopilot this", "engineer this end-to-end", "production-ready this". Skip for — when a specific workflow is already named (call /add-feature, /modify-feature, /fix-bug, /remove-feature directly), pure git operations (/commit-and-push, /commit-push-and-make-pr, /quick-push), planning-only requests, or single-line tweaks done inline without orchestration.
---

> **User-question protocol:** Whenever this skill needs the user to pick between options, confirm an action, or answer a multiple-choice prompt, you MUST call the `AskUserQuestion` tool to render a proper interactive picker. Do NOT print numbered options as plain text and wait for the user to type a number — that produces a degraded UX. Free-form questions (open-ended typing) may be asked in prose, but any time you would write "1) … 2) … 3) …", use `AskUserQuestion` instead.


# ship

The user gave you an engineering goal. Pick the right workflow, pick the right depth, announce both, run the workflow, report. Stop before git.

The tax on a vibe coder is choosing which skill to invoke and how thorough to be. This skill takes that tax off them — without hiding what was decided.

---

## Step 1 — Classify intent

Read the user's prompt and map to one of five core skills:

| Phrasing in the prompt | Intent | Routes to |
|---|---|---|
| "add", "build", "implement", "create", "scaffold", "introduce", "set up" | CREATE | `add-feature` |
| "update", "extend", "change", "also do X when Y", "make this also", "tweak", "modify" | EVOLVE | `modify-feature` |
| "remove", "delete", "deprecate", "kill", "rip out", "get rid of" | REMOVE | `remove-feature` |
| "broken", "bug", "not working", "should have happened but didn't", "didn't trigger", "silent failure" | FIX | `fix-bug` |
| "audit the codebase", "tech-debt sweep", "deep clean", "full cleanup", "production-readiness pass", "find all the rot" | AUDIT | `audit` |

**Ambiguous prompts** — when two intents are equally plausible (e.g., "rebuild auth" could be EVOLVE or REMOVE+CREATE), ask exactly one disambiguating `AskUserQuestion`. Don't guess.

**Multi-intent prompts** — if the user lists clearly separable goals ("add X and remove Y"), execute them sequentially as separate /ship routings, not one combined run. State the order before starting.

**No-match prompts** — if the user's request doesn't fit CREATE/EVOLVE/REMOVE/FIX (e.g., explain code, review a PR, document a flow, compare approaches, ask a question about the codebase), /ship is the wrong tool. Hand off: recommend `/suggest` to find a better skill, or — if the match is obvious — point at the matching skill directly (e.g., "review this PR" → `/review`).

---

## Step 2 — Infer the depth mode

Three modes — `fast`, `balanced`, `production`. Pick one before announcing.

**Risk signals (any one → `production`)**:
- Touches auth, payments, billing, secrets, or external webhooks
- Schema migration affecting persisted data
- Multi-subsystem in the same change (frontend + backend + DB)

**Tiny-scope signals (all four → `fast`)**:
- Single file
- Cosmetic / copy / styling only
- No data layer touched
- No new public API surface

**Default → `balanced`**.

**Override:** explicit `mode=fast`, `mode=balanced`, or `mode=production` in the user's prompt always wins — except when it conflicts with a high-risk signal (see NEVER below).

---

## Step 3 — Announce the plan

Output a structured plan block before executing. Format:

```
Detected: <CREATE | EVOLVE | REMOVE | FIX>
Risk:     <low | medium | high — one-line reason>
Mode:     <fast | balanced | production — one-line reason or "user-specified">
Pipeline:
  1. <phase>  → <core skill or sub-skill>
  2. <phase>  → <core skill or sub-skill>
  ...
```

Pipeline numbering must match what the routed core skill will actually run at the chosen mode (e.g., `add-feature mode=production` does Plan → Implement → Refactor → Tests → Reviews → Validate). Do not invent phases the routed skill won't execute — those become a credibility hole at Step 5.

**Confirmation gating depends on mode:**

| Mode | Gating |
|---|---|
| `production` | Use `AskUserQuestion` "Proceed with this pipeline?" before Step 4. Decline → stop. |
| `balanced` | Print the plan inline, then proceed to Step 4 in the same turn. User can abort with ESC or a new prompt before the routed skill begins. |
| `fast` | Print the plan inline as a one-line preamble, then execute immediately. No confirm prompt. |

---

## Step 4 — Execute via the routed core skill

Invoke the matching core skill with the **`Skill`** tool. Pass:

- The user's original goal as the body of the prompt
- `mode=<resolved>`
- Any `include=<csv>` and `skip=<csv>` overrides parsed from the user's prompt

Example invocation for CREATE at production mode:

```
Skill(skill="add-feature", args="add stripe webhook handler mode=production")
```

The core skill runs the actual workflow. /ship is a router, not a re-implementation.

**Respect downstream gates.** `add-feature mode=production` has its own Plan-approval gate. Let it fire. Don't bypass it from /ship.

**One core skill per /ship run.** Don't fan out to multiple core skills in parallel — that's the user's job to compose with multiple /ship invocations, or the routed core skill's job to subagent-fan-out internally.

---

## Step 5 — Report and hand off to git

After the routed skill returns, output a visible-pipeline summary:

```
✔ <phase 1>  — <one-line outcome>
✔ <phase 2>  — <one-line outcome>
✔ <phase 3>  — <one-line outcome>
...

Findings:
  - <each finding the routed skill or its sub-skill audits surfaced>

Code is production-ready. To publish:
  • /commit-and-push — branch push with grouped commits (recommended)
  • /commit-push-and-make-pr — grouped commits + branch push + GitHub PR
  • /quick-push      — fast path: one commit, push to main
```

Surface findings, not just "done." If a sub-skill audit (security, perf, a11y, duplication) returned issues that the routed skill chose not to auto-fix, name them here so the user sees them before publishing.

**Do not commit. Do not push.** The user picks the publish path.

---

## NEVER

- **NEVER commit, push, or open PRs from inside this skill**
  **Instead:** Stop at Step 5 and direct the user to `/commit-and-push`, `/commit-push-and-make-pr`, or `/quick-push`.
  **Why:** Engineering rigor and release decisions run on different cadences. Auto-publishing from an autopilot run removes the user's chance to review the diff and forces a one-size-fits-all release path on every project.

- **NEVER bypass a routed core skill's own approval gate**
  **Instead:** Let the gate fire (e.g., `add-feature`'s Plan-approval gate in production mode). The user interacts with the core skill's gate, not with /ship.
  **Why:** Routing past a gate that the core skill author put there means the user gets a fast-mode experience while believing they're in production mode. Trust collapses on the first surprise side effect.

- **NEVER replicate the core skill's pipeline inline**
  **Instead:** Always delegate via the `Skill` tool. /ship is a router; the core skill is the engine.
  **Why:** Inlined pipelines drift from canonical core-skill behavior on every update. Two implementations of the same workflow guarantees one will be wrong after the next change to either.

- **NEVER hide which mode and pipeline you picked**
  **Instead:** Announce in every mode. Even `fast` prints the one-line preamble. `production` requires an explicit confirm.
  **Why:** "It just worked" is indistinguishable from "it did the wrong thing silently." The product story is "AI engineering workflow," not "ChatGPT writes code." Visibility is the differentiator.

- **NEVER guess between two plausible intents**
  **Instead:** When the prompt is genuinely ambiguous (CREATE vs EVOLVE, EVOLVE vs REMOVE+CREATE), ask exactly one `AskUserQuestion`. One question, then commit.
  **Why:** A wrong intent cascades through the entire pipeline. The user only notices at Step 5 that the system rebuilt instead of patched, after the work is done. One disambiguation up-front is far cheaper than a wrong full-pipeline run.

- **NEVER honor a `mode=fast` override on a high-risk change without surfacing the conflict**
  **Instead:** If `mode=fast` is requested for work that hits a risk signal (auth/payments/migrations/etc.), pause and surface the conflict via `AskUserQuestion`: "Detected high-risk signals (e.g., payments). You requested fast mode — that skips the production gates. Confirm fast anyway, or upgrade to production?" Honor whichever the user picks.
  **Why:** Vibe coders bypass safety gates because they don't know what they're skipping. Surfacing the conflict gives them informed consent without removing their authority. Silent honor of a dangerous override breaks the "no surprises" contract.
