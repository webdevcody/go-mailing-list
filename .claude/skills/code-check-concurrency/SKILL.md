---
name: code-check-concurrency
user-invocable: false
metadata:
  audience: handoff
description: Internal handoff target invoked by add-feature, modify-feature, and fix-bug after mutations, background jobs, or webhook handlers change. Audits race conditions, retry-safety, and idempotency — double-click creating duplicate records (no submit lock, no idempotency key), webhook retry processing twice (no dedupe by event id), background job that's not idempotent, read-modify-write paths that race under parallel requests (no row lock or atomic update), multi-step writes missing a transaction, stale async response overwriting newer client state (no request-id guard or `AbortController`). Reports findings ranked by severity; auto-fixes only mechanical issues (add `AbortController` to a `useEffect` fetch). Trigger phrases for routing: "check for races", "is this idempotent", "audit concurrency", "check transaction boundary", "any double-submit risk", "check webhook idempotency". Skip for read-only changes, UI-only edits, doc/comment-only changes.
---

> **User-question protocol:** Whenever this skill needs the user to pick between options, confirm an action, or answer a multiple-choice prompt, you MUST call the `AskUserQuestion` tool to render a proper interactive picker. Do NOT print numbered options as plain text and wait for the user to type a number — that produces a degraded UX. Free-form questions (open-ended typing) may be asked in prose, but any time you would write "1) … 2) … 3) …", use `AskUserQuestion` instead.


# Code Check Concurrency

A targeted sweep for **concurrency, idempotency, and race conditions** in mutations, jobs, and async UI. The bug class: locally everything works because there's only one user with one tab and zero retries — in production, double-clicks, webhook retries, parallel requests, and stale responses corrupt user-visible state.

---

## When to run

Run when **any** is true:
- A mutation, server function, or route handler that writes persisted state changed.
- A webhook receiver or background job changed.
- A multi-step write (read → compute → write) was added or edited.
- A `useEffect`/`useQuery`/async fetch in UI was added or edited.
- The user says: "is this idempotent", "any race conditions", "check concurrency".

**Do NOT run** for: read-only changes, UI-only changes that don't fetch or mutate, doc/comment-only edits.

---

## Workflow

### Step 1 — Determine scope

```bash
git diff --name-only HEAD 2>/dev/null
git diff --cached --name-only 2>/dev/null
```

Filter to source TS/TSX. Skip tests, fixtures, generated files.

### Step 2 — Run six detectors

#### Detector A — Webhook handler with no idempotency key check (**HIGH** severity)

```bash
rg -n --type ts 'webhook|/webhooks?/' <scope>
```

For each handler: look for an idempotency check before processing (a query against a `processed_events` / `webhook_events` table by the provider's event id, OR a unique constraint on event id with INSERT-OR-IGNORE semantics). If neither: **HIGH**. Stripe, GitHub, Shopify, Linear all retry on 5xx — same event arrives 2-N times.

#### Detector B — Mutation handler without idempotency on user-initiated double-submit (**MEDIUM–HIGH** severity)

For mutations that create-and-charge (`create order`, `create payment intent`, `send email`, `book appointment`):

```bash
rg -n --type ts -F 'createServerFn' <scope>
rg -n --type ts -E '(create|insert|book|charge|send)\w*\(' <scope>
```

Heuristics for risk:
- Does the API accept an `idempotencyKey` argument and forward it to the upstream service (Stripe, etc.)?
- Does the schema have a `(userId, naturalKey)` unique constraint?
- Does the UI submit-button lock (`disabled={isPending}`) — see `code-check-error-boundaries`?

If at least one safeguard is present, pass. If none: **HIGH** for charging operations, **MEDIUM** otherwise.

#### Detector C — Read-modify-write race (**HIGH** severity)

```bash
# pattern: SELECT, compute, UPDATE
rg -n --type ts -B2 -A6 -F '.update(' <scope> | rg -B6 -F '.findFirst('
rg -n --type ts -F 'SELECT' <scope>
rg -n --type ts -F '.select(' <scope>
```

Manually inspect: when the same function reads a row, computes a new value from it (counter increment, balance change, status transition), and writes back without a transaction or atomic update (`SET counter = counter + 1`), it's a lost-update race. **HIGH** finding — recommend either an atomic SQL expression or a SERIALIZABLE transaction.

#### Detector D — Multi-step write without a transaction (**HIGH** severity)

```bash
# Multiple insert/update/delete in the same handler
rg -n --type ts -B0 -A30 'createServerFn|export async function (GET|POST|PUT|DELETE|PATCH)' <scope>
```

If a handler performs ≥2 writes (across the same or different tables) and the writes form a logical unit (e.g., "deduct balance + create order"), check for a `db.transaction(` / `BEGIN` / `tx.execute`. If absent: **HIGH** — partial-failure leaves inconsistent state.

#### Detector E — Stale async response overwrites newer state (**MEDIUM** severity)

```bash
rg -n --type tsx -B1 -A10 -F 'useEffect' <scope> | rg -F 'fetch\(\|setX\('
rg -n --type tsx -F 'AbortController' <scope>
```

For each `useEffect` that fetches and writes to local state:
- If the dep array can change while a fetch is in flight (typing in a search box, switching tabs)
- AND there's no `AbortController` cleanup OR no request-id guard

Then a stale response can overwrite a newer one. **MEDIUM** finding. **Auto-fix** when the pattern matches a clear template (single fetch in effect): inject `AbortController` and pass its signal to fetch, return cleanup.

#### Detector F — Background job not idempotent (**HIGH** severity)

```bash
# Job runner / queue handler
rg -n --type ts -E '(processJob|handleJob|workerHandler|consume|process)\(' <scope>
fd -e ts 'jobs?|workers?|queue' <scope>
```

For each job: check if it (a) reads its progress from durable state before doing work (so a re-run skips already-done items), AND (b) writes outputs in a way that's safe to repeat (UPSERT, idempotent external calls). If both fail: **HIGH** — a retry corrupts state.

### Step 3 — Report

```
## Concurrency scan — <N> findings (<auto-fixed> auto-fixed)

### HIGH — <count>
1. **Webhook handler missing idempotency check** — `<handler-file>:<line>`
   - Provider: <stripe | github | …> (will retry on 5xx).
   - Suggest: insert into `processed_events(eventId)` with a unique constraint, or check-and-skip before processing.

2. **Read-modify-write on `<table>.<col>`** — `<file>:<line>`
   - SELECT at line <n>, UPDATE at line <m>, no transaction.
   - Suggest: `UPDATE <table> SET <col> = <col> + 1 WHERE id = ?` (atomic), OR wrap in `db.transaction()`.

3. **Multi-step write without transaction** — `<file>:<lineRange>`
   - 3 writes across <table1>, <table2> — partial failure leaves inconsistent state.
   - Suggest: `await db.transaction(async tx => { ... })`.

### MEDIUM — <count>
4. **Stale async response can overwrite state** — `<file>:<line>`
   - `useEffect` fetch with no `AbortController`.
   - Auto-fixed: <yes | no — pattern too complex for safe rewrite>.

5. **Create-charge mutation without idempotency safeguard** — `<file>:<line>`
   - No idempotency key, no unique constraint, button-lock not verified.
   - Suggest: forward an `idempotencyKey` to Stripe / add `(userId, idempotencyKey)` unique index.

---

No concurrency issues detected.    ← only if 0 findings
```

---

## NEVER

- **NEVER auto-wrap a multi-step write in a transaction**
  **Instead:** Report it. Transaction wrappers can change the call signature (passing `tx` instead of `db`), affect timeouts, deadlock with other long-running work, and break code that relies on intermediate visibility.
  **Why:** A mechanical transaction wrap can cause production deadlocks the user only sees under load — strictly worse than the original gap because it hides behind a green checkmark.

- **NEVER auto-add an idempotency key without knowing the upstream API's idempotency semantics**
  **Instead:** Report and name the upstream API. Stripe accepts `idempotencyKey`, but other APIs may dedupe on different headers or not at all.
  **Why:** A guessed idempotency parameter that the upstream silently ignores produces a false sense of safety; the dup still happens, but the report says it's fixed.

- **NEVER scan the whole repo when a diff exists**
  **Instead:** Default to `git diff --name-only HEAD` ∪ uncommitted; project-wide only on explicit request.
  **Why:** Concurrency bugs in legacy code aren't this PR's job; surfacing them buries the new-change findings.

- **NEVER flag a read-modify-write that uses an atomic SQL expression**
  **Instead:** Treat `UPDATE … SET col = col + 1`, `INSERT … ON CONFLICT DO UPDATE`, and similar atomic forms as the safe pattern, not the unsafe one.
  **Why:** The existing safe pattern is exactly what the recommendation would be — flagging it trains the user to ignore the report.

- **NEVER claim a webhook is idempotent because it returns 200**
  **Instead:** Idempotency requires the *side effects* to be safe to repeat, not just the response. Verify a real check exists.
  **Why:** Many handlers return 200 and still double-charge; "200 means done" is a common but wrong heuristic.
