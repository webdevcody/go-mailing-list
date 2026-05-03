---
name: suggest
description: Recommend the top 1–3 installed skills that fit the user's current task, when they're unsure which to use. Reads the available-skills list from the in-context system-reminder, parses each skill's WHEN-to-use and Skip-for guidance, ranks by specificity, and reports a concise verdict (or "no good match"). Use when the user types "/suggest", "/suggest <task>", "which skill should I use", "what skill fits this", "not sure which skill applies", "help me pick a skill", "any skill for this?", or asks Claude to triage a task against the skill catalog before acting.
---

> **User-question protocol:** Whenever this skill needs the user to pick between options, confirm an action, or answer a multiple-choice prompt, you MUST call the `AskUserQuestion` tool to render a proper interactive picker. Do NOT print numbered options as plain text and wait for the user to type a number — that produces a degraded UX. Free-form questions (open-ended typing) may be asked in prose, but any time you would write "1) … 2) … 3) …", use `AskUserQuestion` instead.


# suggest

Triage the user's task against the installed-skill catalog and return a short, defensible recommendation. The user invoked you because they don't know which skill to pick — your job is to decide *for* them, not list everything.

## Inputs

- **With args** (`/suggest <task>`) — use the args as the task description. If the args look like just a skill name (e.g., `/suggest fix-bug`), still treat them as task wording — do **not** invoke that skill or assume the user has chosen it.
- **Without args** — use the most recent substantive user message in the conversation as the task; if there is none, ask the user for one sentence and stop.

## Source of truth

The skill catalog is the `<system-reminder>` "available skills" / "user-invocable skills" list in the current context. Do not invent skills, do not recall skills from training data, do not scan the filesystem. If the system-reminder is absent, say so and stop — you have no catalog to triage against.

## How to rank

Walk this procedure for every triage:

1. **Parse the task** into one or two domain verbs + the artifact involved (e.g., "rename an enum across UI + DB" → verb=rename, artifact=enum/state).
2. **Collect candidates** — every skill whose WHEN/trigger phrases plausibly match those verbs or that artifact.
3. **Filter** — drop any candidate whose "Skip for…" / scope-exclusion clause applies. A matched trigger does **not** save a skill from a matched exclusion.
4. **Order by specificity** — a narrowly-scoped skill that exactly fits beats a broad skill that loosely fits.
5. **Tie-break via cross-skill boundaries** — use the explicit boundaries skills publish about each other (e.g., `modify-feature` says "skip for greenfield"; `add-feature` says "skip for one-line tweaks"). Those boundaries are the disambiguator.
6. **Cite** — for each survivor in your output, quote or paraphrase the exact trigger phrase or scope clause that earned the match.

## Output format

```
## Suggested skills

1. **/skill-name** — one-line why it fits (cite the matching trigger or scope phrase).
2. **/other-skill** — one-line why; note when it would beat #1.
3. **/third** — one-line why; weakest of the three.

**Pick #1 unless [condition that flips it to #2 or #3].**
```

If nothing fits cleanly, return:

```
## No strong match

No installed skill cleanly fits this task. Closest is **/closest** but [why it falls short]. Proceed without a skill, or rephrase the task.
```

## NEVER

- **NEVER recommend a skill not present in the current `<system-reminder>` available-skills list**
  **Instead:** Restrict ranking to the in-context catalog. If that catalog is missing, say so and stop.
  **Why:** Hallucinated skill names from training data send the user to invoke things that don't exist, eroding trust in every future suggestion.

- **NEVER pad the list to three when only one or two skills fit**
  **Instead:** Return as many as genuinely match (1, 2, or 3); if zero, return the no-match verdict.
  **Why:** Padding teaches the user to ignore the ranking; the third slot becomes noise and the real recommendation gets diluted.

- **NEVER ignore a skill's "Skip for…" / scope-exclusion clause when ranking**
  **Instead:** Treat any matching exclusion as disqualifying — drop the skill from the list, even if its triggers also matched.
  **Why:** Skip-for clauses encode the author's hard-won "don't use me here" knowledge. Ignoring them is how `add-feature` gets recommended for a one-line tweak.

- **NEVER recommend a skill without citing the specific trigger phrase or scope statement that matched**
  **Instead:** Quote or paraphrase the matching fragment in the one-liner ("matches its 'rename a status' trigger").
  **Why:** Unjustified picks look arbitrary; cited picks let the user disagree on evidence rather than vibes.

- **NEVER actually invoke the recommended skill yourself**
  **Instead:** Stop after presenting the recommendation. The user decides whether to invoke.
  **Why:** This skill is a triage layer, not an executor. Auto-invoking removes the user's choice and bypasses any confirmation the recommended skill itself would otherwise gate on.

- **NEVER recommend `/suggest` recursively**
  **Instead:** Exclude this skill from its own catalog scan.
  **Why:** Self-recommendation is a no-op loop and signals to the user that triage failed.

## One trigger question before answering

> "If only one skill could be invoked for this task, which one — and which published clause makes that the right call?"

If you can't name the clause, your match is too loose; drop it.
