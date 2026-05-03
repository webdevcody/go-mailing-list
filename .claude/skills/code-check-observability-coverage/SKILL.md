---
name: code-check-observability-coverage
user-invocable: false
metadata:
  audience: handoff
description: Internal handoff target invoked by add-feature, modify-feature, and fix-bug after critical-path changes. Read-only audit of observability coverage — sibling to `code-add-observability` (which inserts logs); this skill REPORTS gaps without auto-instrumenting. Catches new critical paths with no structured log, errors swallowed without context (bare `catch {}` or logged without the original error), jobs/webhooks lacking a correlation id propagated through the work, missing latency/failure metrics on a hot endpoint, and PII (emails, raw user content, tokens) included in log lines. Reports findings ranked by severity; does NOT auto-fix. Trigger phrases for routing: "check observability", "any logging gaps", "coverage audit", "audit logs", "any PII in logs". Skip for UI-only changes that don't touch async/error paths, doc/comment-only edits.
---

> **User-question protocol:** Whenever this skill needs the user to pick between options, confirm an action, or answer a multiple-choice prompt, you MUST call the `AskUserQuestion` tool to render a proper interactive picker. Do NOT print numbered options as plain text and wait for the user to type a number — that produces a degraded UX. Free-form questions (open-ended typing) may be asked in prose, but any time you would write "1) … 2) … 3) …", use `AskUserQuestion` instead.


# Code Check Observability Coverage

A read-only sweep for **observability gaps** in changed code. Sibling to `code-add-observability`, which actively instruments — this skill reports without inserting. The two are split because the user often wants to *know* before deciding *where* to instrument; auto-inserting without that decision pollutes the codebase with noisy logs.

---

## When to run

Run when **any** is true:
- A new server function, route handler, webhook receiver, or background job was added.
- An error path (try/catch, `.catch`, `onError`) was added or modified.
- A critical-path endpoint (auth, payment, write) changed.
- The user says: "audit logs", "any logging gaps", "check observability", "any PII in logs".

**Do NOT run** for: UI-only changes that don't touch async/error paths, doc/comment-only edits, test-fixture-only edits.

---

## Workflow

### Step 1 — Determine scope and detect the project's logger

```bash
git diff --name-only HEAD 2>/dev/null
git diff --cached --name-only 2>/dev/null
# Detect logger
rg -n --type ts -F 'pino' <repo> | head -3
rg -n --type ts -F 'winston' <repo> | head -3
rg -n --type ts -F '@/lib/log' <repo> | head -3
rg -n --type ts -F 'logger.' <repo> | head -3
rg -n --type ts -F '@sentry/' <repo> | head -3
```

Record the detected logger and error reporter. The detection drives the recommendations (use the existing logger, not a new one).

If no logger is detected, recommendations should reference `console.*` only as a placeholder and surface "no structured logger detected" as a separate **MEDIUM** finding.

### Step 2 — Run five detectors

#### Detector A — Critical-path entry without a structured log (**MEDIUM** severity)

For each new server function / route handler / webhook / job in scope:

```bash
rg -n --type ts -F 'createServerFn(' <changed-files>
rg -n --type ts -E 'export async function (GET|POST|PUT|DELETE|PATCH)' <changed-files>
```

For each entry: check whether the function emits at least one log line that names the operation (start log OR success log OR boundary log). If none, AND the operation is critical-path (auth, payment, write, external API call): **MEDIUM**. Recommend a single `logger.info({ op, userId, ... }, "<verb> <object>")` at the operation boundary.

#### Detector B — Swallowed error in catch block (**HIGH** severity)

```bash
rg -n --type ts -B0 -A5 -E 'catch\s*\(\w*\)\s*\{' <scope>
rg -n --type ts -B0 -A3 -F '.catch(' <scope>
```

For each catch: classify.
- Empty `catch {}` → **HIGH**. The error vanishes.
- Catch that logs only a string (`console.log("failed")`) without the error object → **HIGH**. Stack and context are lost.
- Catch that re-throws OR logs `{ err }` AND the error reporter (`Sentry.captureException`, `errorReporter.report`) → pass.
- Catch that translates to a user-facing error response without logging server-side → **MEDIUM**. The user sees "something went wrong" but the server has no record.

Don't auto-fix — picking the right log level and what context to attach is a domain decision.

#### Detector C — Job / webhook without correlation id (**MEDIUM** severity)

For each job runner or webhook handler in scope:
- Check if a request id, event id, or job id is *received* (from headers, payload, or job framework).
- Check if that id is *included* in subsequent log lines (or attached to a log context / AsyncLocalStorage).

If the id is received but not threaded through: **MEDIUM**. Without correlation, debugging "what happened during this webhook" requires timestamp guesswork.

#### Detector D — PII in log line (**HIGH** severity)

```bash
rg -n --type ts -E 'logger\.\w+\(.*\b(email|password|token|secret|apiKey|ssn|creditCard|cvv|address|phone)' <scope>
rg -n --type ts -E 'console\.\w+\(.*\b(email|password|token|secret|apiKey|ssn|creditCard|cvv|address|phone)' <scope>
```

For each hit: classify the field. Tokens, passwords, secrets → **HIGH**, never log. Email, full name, address, phone → **HIGH** in regions with privacy regulation; **MEDIUM** otherwise — recommend hashing (`hashEmail(email)`) or replacing with stable user id.

Generic field names that *contain* the substring but aren't actually sensitive (`emailEnabled`, `tokenCount`) — manually triage; don't blindly flag.

#### Detector E — Hot endpoint without latency/failure metric (**LOW** severity)

For new endpoints in critical paths (auth, payment, search, list):
- Check if the project uses a metrics library (`prom-client`, `@vercel/otel`, `posthog`/`statsig` event capture).
- If yes, check whether the new endpoint emits a duration/success metric.
- If no metrics library exists at all, downgrade to **INFO** ("no metrics library detected — consider adding").

This is **LOW** because most projects accept "logs only" as the baseline and add metrics later.

### Step 3 — Report

```
## Observability scan — <N> findings (read-only — no auto-fix)

**Logger detected:** <pino | winston | custom @/lib/log | console only — none structured>
**Error reporter detected:** <sentry | none>

### HIGH — <count>
1. **Swallowed error in catch** — `<file>:<line>`
   - Empty `catch {}` (or string-only log without `err`).
   - Suggest: `logger.error({ err, op: "..." }, "failed to ...")` and re-throw or report via Sentry.

2. **PII in log line: `email`** — `<file>:<line>`
   - `logger.info({ email: user.email }, ...)`
   - Suggest: log a stable id (`userId`) or hash; never log raw token/password/secret.

### MEDIUM — <count>
3. **Critical-path entry has no log** — `<file>:<line>` (`createServerFn` for `chargeCustomer`)
   - Suggest: one boundary log: `logger.info({ op: "chargeCustomer", userId, amount }, "charging")`.

4. **Webhook handler doesn't propagate event id** — `<file>:<line>`
   - Receives `event.id` from Stripe; subsequent logs don't include it.
   - Suggest: bind `event.id` into the logger context for the request.

### LOW — <count>
5. **No latency metric on `/api/search`** — `<file>:<line>`
   - Suggest: wrap with the project's metrics middleware, or add a `duration_ms` log if metrics aren't yet adopted.

---

No observability gaps detected.    ← only if 0 findings
```

---

## NEVER

- **NEVER auto-insert log lines from this skill**
  **Instead:** Report only. The user invokes `code-add-observability` if they want auto-instrumentation.
  **Why:** A skill that "reports" must not silently mutate; the split between this skill and `code-add-observability` exists exactly so the user controls when instrumentation lands. Auto-inserting also produces noisy logs at boundaries the user wouldn't have picked.

- **NEVER recommend a logger the project doesn't already use**
  **Instead:** Detect the existing logger and use its API in recommendations. If none exists, surface that as its own finding rather than picking one.
  **Why:** Recommending `pino` to a project that uses `winston` produces a copy-paste fix that doesn't compile; the user spends more time fixing the recommendation than the original gap.

- **NEVER flag every `console.*` call as a finding**
  **Instead:** Flag `console.*` only when (a) it's in a critical-path handler AND (b) the project has a structured logger that should have been used.
  **Why:** Whole-repo `console.*` flagging produces hundreds of noise findings; the value is the structured-logger-vs-console mismatch in changed code.

- **NEVER scan the whole repo when a diff exists**
  **Instead:** Default to `git diff --name-only HEAD` ∪ uncommitted; project-wide only on explicit request.
  **Why:** Whole-repo observability gaps are pre-existing debt, not this change's responsibility.

- **NEVER classify a generic substring match as PII**
  **Instead:** Triage `emailEnabled`/`tokenCount`/`addressBookId` and similar non-sensitive uses; only flag when the value bound is actually the sensitive datum.
  **Why:** False PII positives undermine the high-severity tier — when a real PII leak surfaces, the user has already learned to ignore the section.
