# Feature Boundaries

Decision aid for when you're unsure whether something is one feature, multiple features, or not a feature at all.

## The Naming Test

If a non-engineer (PM, support agent, end user, operator) would naturally **name** the capability in one phrase, it's probably one feature. If they'd describe it as "part of X" or "how X works internally," it's a sub-step of X, not its own feature.

Examples:
- "Checkout" — feature (PM names it)
- "Cart total recalculation when quantity changes" — sub-step of Cart, not a feature
- "Forgot password" — feature (support agent names it)
- "Email template rendering" — implementation, not a feature
- "Nightly invoice generation" — feature (operator names it)
- "Database connection pooling" — never a feature

## Splitting Rules

Split into multiple features when:
- Different actors use them independently (e.g. customer Checkout vs. operator Refund)
- They can be built and shipped independently and one is useful without the other
- They have meaningfully different acceptance criteria and edge cases

Do NOT split when:
- They're sequential steps in one user goal (e.g. "enter address" + "enter payment" + "confirm order" = one Checkout feature)
- One is purely a technical decomposition (e.g. "validate cart" + "submit cart" — that's just Checkout)

## Merging Rules

Merge into one feature when:
- The same capability appears under multiple route/file names but serves one user goal
- A "v2" exists alongside a "v1" of the same capability — merge into one feature, note the variant in Edge Cases or Open Questions

## Cross-Cutting Concerns

These are NOT features (they apply across features and belong in non-functional notes or as preconditions):

- Logging, metrics, tracing
- Rate limiting (unless it's a *user-facing* quota — then it's a feature: "API quotas")
- Caching
- Database migrations
- Deployment / CI

## When Stuck

Default to the **coarser** boundary. It's easier to split a too-big feature during review than to merge a hundred too-small ones. Present the coarser version to the user in Phase 2 and let them split if needed.
