# Spec File Template

Every `specs/NNN-<slug>.md` file uses this exact structure. Sections are required. "N/A" is allowed only with one sentence explaining why.

Keep specs **stack-agnostic**: behavior, contracts, constraints — never frameworks, schemas, file paths, or library names.

---

## Template

```markdown
---
id: NNN
name: <Feature Name>
slug: <feature-slug>
tier: foundation | core | retention | growth | operational | compliance
depends_on: [NNN, NNN]   # other feature IDs this requires; [] if none
---

# NNN — <Feature Name>

## Description
2–4 sentences. What this feature *is* and what it lets the user do. Plain language; no jargon. A non-technical stakeholder should understand it.

## User story
As a <persona>, I want to <action>, so that <outcome>.

(Add 1–2 secondary stories if multiple personas use it.)

## Why it matters
1–2 sentences. The product reason this feature exists. If you can't justify it, the feature shouldn't be in the backlog.

## Acceptance criteria
Bulleted, testable, observable. Each line is a behavior a tester can verify without reading code.

- Given <state>, when <action>, then <observable result>
- ...
(Minimum 4 criteria. Cover happy path + at least one boundary.)

## Edge cases
Bulleted. Each line: a situation that breaks naive implementations.

- What happens if <unexpected state>?
- What if two users <concurrent action>?
- What if <input> is empty / malformed / oversized / unicode / negative / zero / duplicate?
- What if the user lacks permission?
- What if the underlying resource was deleted mid-flow?
(Minimum 5 edge cases. "Obvious" features get more, not fewer — that's where bugs hide.)

## Test scenarios
Numbered. Each scenario: a concrete walkthrough a QA engineer could execute manually.

1. **<Scenario name>** — Setup: ... Action: ... Expected: ...
2. ...
(Minimum 3 scenarios: happy path, one failure path, one edge case.)

## Out of scope
Bulleted. Things a reader might assume are included but aren't — punted to a later spec or never. Reference the spec ID if punted (`see 042-bulk-export`).

## Dependencies
- **Prerequisites:** features that must exist first (cite IDs)
- **Unblocks:** features this enables (cite IDs)
- **External:** third-party services, APIs, or accounts required (e.g., "an email-sending provider", "a payment processor") — describe by capability, not vendor

## Open questions
Bulleted. Decisions the implementer will hit that this spec doesn't answer. Honest "I don't know" beats fake confidence.

- Should <X> be configurable per workspace or global?
- What's the retention window for <Y>?
```

---

## Quality checks (apply before writing each file)

- [ ] No framework names (React, Postgres, Stripe) — describe by capability ("a payment processor")
- [ ] No file paths or table names
- [ ] Acceptance criteria are observable (a black-box tester could verify)
- [ ] At least one edge case covers concurrency / partial failure
- [ ] At least one edge case covers permissions / unauthorized access
- [ ] `depends_on` references real feature IDs that come earlier in the build order
- [ ] User story names a real persona from Phase 1, not a generic "user"
