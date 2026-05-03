# Label & Issue Matching

How to pick PR labels from the repo's existing taxonomy and how to link plausibly-related open issues — without fabricating either.

---

## Labels

### Source of truth

`gh label list --limit 200 --json name,description` — captured in Phase 1. **This is the only valid label source.** GitHub will silently auto-create a missing label with a default color when `gh pr create --label X` is passed; that pollutes the repo's taxonomy.

### Picking labels

Match the dominant change type against the existing label set, case-insensitively. Common families to try, in priority order:

| Change signal | Try labels (case-insensitive match) |
|---|---|
| New user-facing capability | `feature`, `enhancement`, `feat` |
| Bug fix referenced in commits or issues | `bug`, `fix`, `defect` |
| Refactor with no behavior change | `refactor`, `tech-debt`, `cleanup`, `chore` |
| Docs / README / comments only | `documentation`, `docs` |
| Build/CI/tooling/lint config | `chore`, `ci`, `build`, `tooling` |
| Performance work | `performance`, `perf` |
| Security fix or hardening | `security` |
| Test additions or fixes only | `tests`, `testing` |

Plus, if any of these exist in the repo, add them when applicable:

- `needs review` / `needs-review` / `review` — apply by default if the repo uses one of these (signals an inbound queue).
- `breaking-change` / `breaking` — apply if the diff removes/renames an exported symbol, removes a route, drops a DB column, or changes a wire format.
- Area labels (`area:billing`, `pkg/server`, etc.) — match against changed paths.

### Rules

- Match **case-insensitively**, but apply the **exact existing casing** when calling `gh pr create --label`.
- If a candidate label isn't in the catalog → drop it. Never auto-create.
- 1–4 labels total. More than 4 dilutes the signal.
- If `gh pr create` rejects a label mid-call, drop it and retry once.
- If the repo has no labels at all → skip labeling silently. Do not propose creating any.

---

## Linking related issues

### Source of truth

`gh issue list --state open --limit 50 --json number,title,labels,body` — captured in Phase 1.

### Matching

For each open issue, compute a plausibility signal:

1. **Path overlap.** Issue title or body mentions a path/file/module that this PR touches.
2. **Keyword overlap.** Issue title or body shares ≥2 distinguishing nouns/verbs with this PR's commit subjects or cumulative diff theme. Ignore stop-words (`the`, `is`, `a`) and ubiquitous terms (`bug`, `fix`, `error`).
3. **Label overlap.** Issue has a feature-area label that matches a path the PR touches.

Surface an issue as a candidate only when **at least two signals** fire. One signal = noise.

### Phrasing — exact wording

```
- Might address #<n> — _<issue title>_
```

That's the literal phrasing. **Never** use:

- `Closes #N` / `Fixes #N` / `Resolves #N` — these auto-close the issue on merge. Heuristic matches are wrong often enough that auto-closing the wrong issue is a real cost. Only use these keywords when the **user** explicitly says "this fixes #N".
- `Related to #N` without context — too vague; reviewers can't act on it.
- `See #N` — same problem.

### Volume

- 0 candidates → omit the "## Related" section entirely. Don't write "No related issues."
- 1–3 candidates → list them.
- 4+ candidates → your matching is too loose; tighten to the strongest 2.

### When confidence is low

If a candidate barely passes (only just two signals, both weak) → drop it. A wrong "might address" link still wastes the original issue reporter's time when they get notified.

---

## Worked example

Working tree changed:
- `src/server/webhooks/stripe.ts`
- `src/db/schema/subscriptions.ts`
- `migrations/0042_add_webhook_received_at.sql`

Commit subjects: `feat: consume Stripe webhook events`, `chore: drop polling job`.

`gh label list` → `bug`, `feature`, `documentation`, `area:billing`, `needs review`, `breaking-change`.

`gh issue list` (open) →
- #482 _Subscription state lags by ~5min_ — body mentions "polling" and "billing".
- #501 _Add dark mode_ — frontend.
- #517 _Stripe events sometimes missed_ — body mentions `webhooks/stripe.ts`.

**Picked labels:** `feature`, `area:billing`, `needs review` (3 — tight signal).

**Linked issues:**
- #482 — keyword overlap (polling, billing) + label match (`area:billing`) → strong → include.
- #517 — path overlap (`webhooks/stripe.ts`) + keyword overlap (Stripe, events) → strong → include.
- #501 — no signals → drop.

**"## Related" section:**

```
- Might address #482 — _Subscription state lags by ~5min_
- Might address #517 — _Stripe events sometimes missed_
```
