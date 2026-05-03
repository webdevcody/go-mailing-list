# Spec Template (plan-greenfield format)

Use this exact structure when writing `specs/ideas/NNN-slug.md`. Fill every section. Stack-agnostic — no framework or file paths unless they encode a real business constraint.

```markdown
# NNN — <Feature Name>

## Description
<2–4 sentences. What this feature is. The user-visible change.>

## User Story
As a <role>, I want to <action>, so that <outcome>.

## Why this improves the product
<3–5 bullets. Tie each to a specific gap, friction point, or missing affordance observed in the existing codebase. Reference file paths or features by name.>

## Acceptance Criteria
- [ ] <Testable, observable, single-behavior statement>
- [ ] <…>
- [ ] <…>

## Edge Cases
- <Specific scenario>: <expected behavior>
- <Specific scenario>: <expected behavior>
- <Concurrency / empty / boundary / failure case>: <expected behavior>

## Test Scenarios
1. **<Scenario name>** — Given <state>, when <action>, then <observable outcome>.
2. **<Scenario name>** — Given <state>, when <action>, then <observable outcome>.
3. **<Scenario name>** — …

## Out of Scope
- <Explicit non-goal>
- <Explicit non-goal>

## Open Questions
- <Question the implementer must resolve before building, or "None">
```

## Quality bar

- **Acceptance criteria** must be checkable by reading the running app — not "implemented correctly" or "works well".
- **Edge cases** must be specific scenarios, not categories ("network errors" → "user loses connection mid-submit before server ack").
- **Why this improves the product** must cite Phase 1 evidence — not generic value claims.
- **Out of Scope** is required even if short — it prevents scope creep at implementation time.
