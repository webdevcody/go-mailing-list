# Per-Feature Spec Template

Use this template verbatim for every feature file. Filename: `NN-slug.md` where `NN` is the 2-digit build-order position.

```markdown
# <Feature Name>

**Build position:** <NN of total>
**One-liner:** <single sentence describing the capability in user/operator terms>

## User Stories
- As a <role>, I want to <action> so that <outcome>.
- (one or more; cover the primary actors)

## Acceptance Criteria
- [ ] <observable behavior at the system boundary — HTTP response, UI state, emitted event, persisted record visible to a user>
- [ ] <each criterion must be independently verifiable without reading source code>
- [ ] <use business vocabulary, not technical vocabulary>

## Preconditions
- <Feature name from earlier in build order> — <why this feature depends on it>
- (list every upstream feature; if none, write "None — foundational feature")

## Edge Cases
- **<short label>:** <what happens, in business terms>
  - Example: **Duplicate submission:** the system treats a second submission within 30 seconds as a no-op and returns the original confirmation.
- (cover: invalid input, concurrency, partial failure, idempotency, authorization boundaries, empty/maximum states, time-based edges)

## Testing Scenarios
Given/When/Then format, derived from acceptance criteria (not from existing tests):

- **Scenario: <name>**
  - Given <preconditions in plain language>
  - When <user or system action>
  - Then <observable outcome>

## Non-Functional Requirements
Include ONLY if a real business requirement or contractual constraint. Omit the section if there are none.

- **Throughput:** <e.g. "must sustain 200 checkout submissions/sec during flash sales">
- **Data volume:** <e.g. "retains 7 years of audit records per regulatory requirement">
- **Latency:** <only if a stated SLA, not a current measurement>
- **Availability:** <only if contractual>

## Out of Scope
- <capabilities a reader might assume are part of this feature but aren't — point to the feature that owns them>

## Open Questions
- UNKNOWN — <specific question for a stakeholder, with enough context that they can answer it cold>
```

## Rules

- Every section heading must appear (except Non-Functional Requirements, which is omitted when empty).
- Acceptance criteria and edge cases MUST be in business vocabulary. If you can't describe it without naming a framework or table, you're describing implementation, not the feature.
- Open Questions is where every uncertainty goes. Better to have ten honest UNKNOWNs than one confident hallucination.
