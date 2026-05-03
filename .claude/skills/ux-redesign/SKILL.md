---
name: ux-redesign
description: Socratic UX redesign coach for a single page, route, or component. Re-examines the page's goal, target user, and primary action before touching visuals — then proposes concrete changes (information architecture, button placement, loader choice, page splits, removals) aligned with the project's existing design system. Use when the user says "this feels cluttered/confusing", "redesign this page", "this UX is off", "rethink this component", "users get lost on this screen", "what should I do with this page", or asks for help simplifying or restructuring a route. Skip for: pure visual tweaks to a single element (use a UI tweak skill), bug fixes, or new-feature greenfield design.
---

# UX Redesign

A page that "feels cluttered" almost never gets fixed by rearranging the same elements. It gets fixed by re-deciding what the page is *for* — then cutting, splitting, or re-prioritizing accordingly.

This skill enforces that order: **interrogate intent → diagnose root cause → propose redesign**. Skipping to visual suggestions is the failure mode it exists to prevent.

---

## Phase 1 — Detect (project conventions)

Before asking any UX questions, learn what the project already uses. Read enough to answer:

- **Framework & routing** — React/Next/Remix/Svelte? File-based routes? Layouts?
- **Design system** — shadcn/ui, MUI, Chakra, Tailwind-only, custom? Look at `package.json` and a representative component.
- **Loading patterns** — does the project use `<Suspense>`, skeleton components, spinners, or nothing? Grep for `Skeleton`, `Spinner`, `Loading`, `isPending`.
- **Notification/alert patterns** — toast lib (`sonner`, `react-hot-toast`), inline alerts, modals?
- **The target file(s)** — read the page/component the user named. Note its current sections, data dependencies, and primary CTA.

Output a 5-line **Convention Snapshot** in this exact shape:

```
Stack: <framework + routing>
Design system: <library or "tailwind-only" or "custom">
Loader pattern: <skeleton/spinner/suspense/none — cite a file>
Alert pattern: <toast lib / inline / modal — cite a file>
Target file(s): <paths under review>
```

Confirm with the user before moving on. Do NOT propose changes yet.

**Greenfield fallback:** If the project is brand-new, has no design system, or conventions can't be detected, ask the user to name the design system and loader pattern they intend to use, then record those as the Snapshot before proceeding.

---

## Phase 2 — Interview (goal, user, priority)

**MANDATORY — READ [`references/interview-questions.md`](references/interview-questions.md)** before asking questions. It has the layered question bank organized by category (Goal, User, Priority, Cut). Don't improvise — the bank exists because authors consistently skip the "what would we remove?" question. *Do NOT load this file during Phases 1, 3, or 4.*

Ask in waves of 2-3 questions. **Always use the AskUserQuestion tool** (multi-question, structured choices) for each wave — never present static numbered prompts the user has to type answers to. Fall back to free-form prose only when the option space is genuinely open-ended. After each wave, restate your understanding in one sentence and ask `(c)ontinue / (r)evise / (d)one`. Do not exit Phase 2 until you can answer:

1. What is the **one** thing a user must be able to do on this page?
2. Who is the user (role, frequency of visit, what they came from)? *If you're the only user (internal tool, dev console), substitute "future-you in 6 months" as the proxy.*
3. If you could only keep three elements, which three?
4. What are users currently *trying* to do that the page makes hard?

If the user resists answering #3 ("they all matter"), that resistance *is* the diagnosis — the page has no priority and that's the clutter.

---

## Phase 3 — Diagnose

Before naming a diagnosis, ask: *is this symptom downstream of a missing decision the page forces on the user, or downstream of unranked priorities?* Most "feels off" pages are the former; most "feels cluttered" pages are the latter.

Name the root cause in one of these shapes:

- **Priority conflict** — multiple elements competing for "primary"
- **Mixed concerns** — page serves two distinct user goals that should split
- **Hidden primary action** — the main CTA is buried below secondary content
- **Weak hierarchy** — everything is the same visual weight
- **Premature density** — the page shows everything upfront instead of progressively

State the diagnosis in one sentence. Get user agreement before proposing.

---

## Phase 4 — Propose

**MANDATORY — READ [`references/ux-rules.md`](references/ux-rules.md)** before writing the proposal. It has the opinionated rules (no-disabled-buttons, loader-choice heuristics, colocation, page-split criteria) you must apply. *Do NOT load this file during Phases 1, 2, or 3.*

Produce a redesign proposal with these sections:

1. **Decision** — one of: `redesign-in-place` / `split-into-pages` / `remove-feature` / `progressive-disclosure`
2. **Layout sketch** — text-based wireframe (boxes labeled with content) showing new structure
3. **Specific changes** — bulleted list, each citing the Phase 1 Convention Snapshot (e.g., "replace spinner with `<Skeleton>` — already used in `app/dashboard/page.tsx:42`")
4. **What's removed** — explicit list of elements being cut or moved off-page
5. **Open questions** — anything the user must decide before implementation

End by asking whether to implement, refine the proposal, or stop at the spec.

---

## NEVER

- **NEVER propose visual or layout changes before completing Phase 2**
  **Instead:** Finish the interview. If the user pushes for a quick answer, restate Phase 2 question #1 and wait.
  **Why:** The whole point of this skill is preventing the "rearrange the deck chairs" failure. Visual proposals before goal-clarity produce confident-looking redesigns that don't fix the underlying confusion.

- **NEVER suggest a UI pattern (skeleton, toast, command palette, modal lib) the project doesn't already use without flagging it as a new dependency**
  **Instead:** Match the existing convention from Phase 1. If a new pattern is genuinely required, call it out: "This requires adding `sonner` — confirm before I include it."
  **Why:** Skill output that silently introduces dependencies gets implemented, then reverted in PR review. Match the house style or name the cost.

- **NEVER propose disabling or hiding a button to prevent an invalid action**
  **Instead:** Keep the button enabled. On click, show the project's existing alert/toast pattern explaining *why* the action can't be performed right now and what the user needs to do.
  **Why:** Disabled buttons are a dead end — users don't know if it's broken, loading, or gated. An explanation converts a frustration into a next step.

- **NEVER skip the "what would we cut?" question in Phase 2**
  **Instead:** Ask it explicitly even if the user only complained about clutter. Force a ranked answer.
  **Why:** Clutter is a symptom of unranked priorities. Without forcing the cut, the redesign becomes a reshuffle and the page stays cluttered.

- **NEVER conclude Phase 4 without one of the four explicit decisions**
  **Instead:** Pick `redesign-in-place`, `split-into-pages`, `remove-feature`, or `progressive-disclosure` and justify it.
  **Why:** "Some of each" proposals are unactionable. The user needs a frame to argue with.

- **NEVER recommend colocation or page-split changes without checking the routing structure read in Phase 1**
  **Instead:** Reference the actual route file paths when proposing splits ("move section X to a new route at `app/settings/billing/page.tsx`").
  **Why:** Generic "split this into multiple pages" advice without filesystem grounding produces proposals the user can't act on.
