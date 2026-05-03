---
name: code-check-security-regression
user-invocable: false
metadata:
  audience: handoff
description: Internal handoff target invoked by add-feature, modify-feature, and fix-bug after backend, auth, payments, file upload, webhook, secret handling, or external API changes. Audits broad application security regressions complementary to code-audit-authz (which covers authorization). Catches secrets logged or shipped in client bundles, webhook handlers without signature verification, user-controlled URLs that create SSRF, file upload paths/extensions/sizes/content-types handled unsafely, abuse-prone endpoints lacking rate limiting, dangerous HTML rendering (`dangerouslySetInnerHTML`/`innerHTML`), and unsafe redirects (open-redirect to user-controlled URLs). Reports findings ranked by severity; auto-fixes only mechanical issues (move secret to env, add `rel="noopener noreferrer"` on external links). Trigger phrases for routing: "security check", "any security regression", "audit security", "check webhook signing", "check secrets", "check file upload safety". Skip for UI-only changes that don't render user content, doc/comment-only edits, test-fixture-only edits.
---

> **User-question protocol:** Whenever this skill needs the user to pick between options, confirm an action, or answer a multiple-choice prompt, you MUST call the `AskUserQuestion` tool to render a proper interactive picker. Do NOT print numbered options as plain text and wait for the user to type a number — that produces a degraded UX. Free-form questions (open-ended typing) may be asked in prose, but any time you would write "1) … 2) … 3) …", use `AskUserQuestion` instead.


# Code Check Security Regression

A targeted sweep for **application-security regressions** that don't fall under authorization (which is `code-audit-authz`'s job). The bug class: a single line introduces an exploitable pattern — a logged secret, an unsigned webhook, a user-controlled URL passed to `fetch`, a `dangerouslySetInnerHTML` of user content.

---

## When to run

Run when **any** is true:
- A backend handler, server function, route handler, or webhook receiver changed.
- A file upload, download, or storage path changed.
- An auth flow, session, cookie, token, or password handler changed.
- A payment, billing, or external-API integration changed.
- An environment variable, secret reference, or config-loader changed.
- A render path (JSX/template) added user-controlled HTML or a user-controlled URL.

**Do NOT run** for: UI-only changes that don't render user content, doc/comment-only edits, test-fixture-only edits.

---

## Workflow

### Step 1 — Determine scope

```bash
git diff --name-only HEAD 2>/dev/null
git diff --cached --name-only 2>/dev/null
```

Filter to source files. Skip `node_modules`, `dist`, `build`, lockfiles.

### Step 2 — Run six detectors

#### Detector A — Secret leaked to logs or client bundle (**HIGH** severity)

```bash
# Secrets in console.* or logger.*
rg -n --type ts -F 'process.env.' <scope> | rg -E 'console\.|logger\.|log\('
rg -n --type ts -E 'console\.(log|info|warn|error)\([^)]*\b(SECRET|TOKEN|KEY|PASSWORD|API_KEY|PRIVATE)' <scope>

# process.env reached from a client-marked file
# TanStack Start: import in src/components, src/routes, src/hooks
# Next.js: 'use client' files
rg -n --type tsx -F 'process.env' <scope>
rg -n --type ts  -F 'process.env' <scope> | rg -F 'use client'
```

For each hit: classify the env var as secret-like (matches `SECRET|TOKEN|KEY|PASSWORD|PRIVATE|DSN`) and confirm the file is reachable from the client bundle. **HIGH** for confirmed client leakage; **HIGH** for any logged secret value (not just the var name).

#### Detector B — Webhook handler without signature verification (**HIGH** severity)

```bash
# Find webhook handlers (Stripe, GitHub, Slack, Linear, Twilio, Shopify, etc.)
rg -n --type ts 'webhook|/webhooks?/' <scope>
```

For each handler: look in the same file or its imports for a signature-verification call. Vendor patterns: `stripe.webhooks.constructEvent`, `crypto.timingSafeEqual`, `verifyWebhookSignature`, `Webhook.verify` (Svix), `verifyShopifyWebhook`. If a handler reads `req.body` and acts on it without any verify call: **HIGH**.

#### Detector C — Server-Side Request Forgery (SSRF) (**HIGH** severity)

```bash
# fetch / axios / got with a non-literal URL
rg -n --type ts -E 'fetch\(\s*\w' <scope>
rg -n --type ts -E '(axios|got|http)\.(get|post|put|delete|patch)\(\s*\w' <scope>
```

For each hit: trace the URL argument back to its origin. If the URL is user-controlled (request body, query, params) and there's no allowlist check (URL.parse + hostname matches a fixed list) before the call: **HIGH**. The classic SSRF target is internal metadata services (`169.254.169.254`, `metadata.google.internal`).

#### Detector D — Unsafe file upload / download (**HIGH–MEDIUM** severity)

```bash
rg -n --type ts -E 'multer|formidable|busboy|uploadHandler|files?\.create|put\(.*Body' <scope>
rg -n --type ts -F 'path.join(' <scope> | rg -F 'req\.|body\.|params\.|query\.'
```

Check for: missing extension/MIME allowlist; missing size limit; user-controlled path used in `fs.writeFile` / `path.join` (path traversal); content-type derived from the client. Report each gap with the upload-callsite line.

#### Detector E — Dangerous HTML rendering (**HIGH** severity)

```bash
rg -n --type tsx -F 'dangerouslySetInnerHTML' <scope>
rg -n --type ts  -F '.innerHTML' <scope>
rg -n --type ts  -F 'document.write' <scope>
```

For each hit: trace the value's origin. If it's a literal or comes from a sanitizer (DOMPurify, sanitize-html, marked with sanitizer enabled), pass. If it's user content with no sanitizer: **HIGH** XSS finding.

#### Detector F — Open redirect / missing `rel="noopener"` (**MEDIUM** severity)

```bash
# redirects with user-controlled URL
rg -n --type ts -E 'redirect\(\s*\w' <scope>
rg -n --type ts -E 'res\.redirect\(\s*\w' <scope>
# external links missing rel
rg -n --type tsx -E 'target="_blank"' <scope>
```

For redirects: if the URL is user-controlled and unvalidated, **MEDIUM** open-redirect.
For `target="_blank"` without `rel="noopener noreferrer"`: **LOW** — **auto-fix** by adding the attribute.

#### Detector G — Abuse-prone endpoint without rate limiting (**MEDIUM** severity)

For new public endpoints (no auth, or per-IP-friendly): login, signup, password reset, send-email, send-sms, OTP, share-link, public-form-submit, free-trial-create. If no rate-limit middleware (`express-rate-limit`, `rate-limiter-flexible`, Vercel `unstable_after`/edge limits, custom token bucket) is present in the file or its router: **MEDIUM**.

### Step 3 — Report

```
## Security regression scan — <N> findings (<auto-fixed> auto-fixed)

### HIGH — <count>
1. **Secret reachable from client bundle: `STRIPE_SECRET_KEY`** — `<file>:<line>`
   - File is imported by `<client-route>:<line>`.
   - Suggest: move to a server-only module; for Next.js, drop the `NEXT_PUBLIC_` prefix; for TanStack Start, use `serverOnly()` or move to `src/fn/`.

2. **Stripe webhook missing signature verification** — `<handler-file>:<line>`
   - Reads `req.body` then writes to DB without `stripe.webhooks.constructEvent`.
   - Suggest: verify with the raw body and `STRIPE_WEBHOOK_SECRET` before processing.

3. **Possible SSRF — fetch with unvalidated URL** — `<file>:<line>`
   - URL traces to `req.body.callbackUrl`.
   - Suggest: parse the URL, allowlist the hostname, reject loopback/private/metadata IPs.

### MEDIUM — <count>
4. **No rate limiting on `/api/auth/forgot-password`** — `<file>:<line>`
   - Suggest: per-IP limit (e.g., 5/min) and per-email limit (e.g., 3/hour).

### LOW — <count>
5. **`target="_blank"` missing `rel="noopener noreferrer"`** — `<file>:<line>`
   - Auto-fixed.

---

No security regressions detected.    ← only if 0 findings
```

---

## NEVER

- **NEVER auto-fix a security finding that requires domain knowledge**
  **Instead:** Auto-fix only the mechanical, single-line additions: `rel="noopener noreferrer"`, removing a literal secret value from a `console.log` (replace with the var name). Report everything else.
  **Why:** Auto-applied "sanitization" can give a false sense of safety — a wrapped `DOMPurify` call with the wrong config still ships an XSS, and the user trusts the green checkmark.

- **NEVER claim "no SSRF" without tracing the URL argument**
  **Instead:** If the URL trace bottoms out in a literal or a clearly server-only constant, mark safe. If it bottoms out at a request-body/query/param read, mark unsafe.
  **Why:** A "no findings" report on a route that does take user URLs trains the user to skip future runs of this skill — better to flag MEDIUM with "couldn't fully trace" than miss the bug.

- **NEVER scan the whole repo when a diff exists**
  **Instead:** Default to `git diff --name-only HEAD` ∪ uncommitted; project-wide only on explicit request.
  **Why:** Whole-repo scans surface long-standing secrets-in-logs warts the user can't address right now and bury the actionable findings from the recent change.

- **NEVER overlap with `code-audit-authz`'s scope**
  **Instead:** This skill covers secrets, webhooks, SSRF, uploads, XSS, redirects, rate-limiting. Authorization (who-can-do-what, IDOR, missing identity checks) belongs to `code-audit-authz`. If a finding is purely authorization, defer with a one-line pointer.
  **Why:** Two skills reporting the same finding produces double work and contradictory recommendations.

- **NEVER report a webhook handler as unverified when verification happens in upstream middleware**
  **Instead:** Before flagging, check the route's middleware chain (e.g., `app.use("/webhooks/stripe", verifyStripeSignature, handler)`).
  **Why:** Stack-level verification is a common pattern; a false positive trains the user to ignore the report.

- **NEVER include the literal secret value in the report output**
  **Instead:** Report the variable name and file:line; never echo the actual secret characters.
  **Why:** The report itself becomes a leak vector — pasted into Slack, attached to a ticket, etc.
