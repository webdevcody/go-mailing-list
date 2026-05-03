---
name: code-check-client-bundle
user-invocable: false
metadata:
  audience: handoff
description: Internal handoff target invoked by add-feature, modify-feature, and code-enforce-layers when client-side code changes. Audits accidental client-bundle bloat and server-only leakage — server libraries (drizzle, prisma, fs, child_process, postmark, stripe-node, server-only env) imported into a client route or component, large dependencies added to the first-load bundle (lodash, moment, draft-js, monaco, recharts), images or videos shipped unoptimized (PNG/JPG > 200KB without responsive variants), env or server config reaching the browser bundle, and rarely-used editor/chart/admin code that should be dynamically imported. Reports findings ranked by severity; auto-fixes only mechanical issues (lodash-es full-import → named import). Trigger phrases for routing: "check bundle", "audit client bundle", "any server import in client", "did this bloat the bundle". Skip for pure backend/migration changes, doc/comment-only edits.
---

> **User-question protocol:** Whenever this skill needs the user to pick between options, confirm an action, or answer a multiple-choice prompt, you MUST call the `AskUserQuestion` tool to render a proper interactive picker. Do NOT print numbered options as plain text and wait for the user to type a number — that produces a degraded UX. Free-form questions (open-ended typing) may be asked in prose, but any time you would write "1) … 2) … 3) …", use `AskUserQuestion` instead.


# Code Check Client Bundle

A targeted sweep for **client-bundle correctness and weight regressions**. Pairs with `audit-perf` (which is broader) but is concrete and post-change. The bug class: a single `import { db } from "@/db"` at the top of a route file pulls the entire DB driver into the browser bundle, or a `recharts` import on the landing page doubles first-load JS.

This skill reports; the user picks the dynamic-import boundaries.

---

## When to run

Run when **any** is true:
- A file in `src/routes/`, `src/components/`, `src/hooks/`, or any `'use client'` file changed.
- A new dependency was added to `package.json`'s `dependencies` (not `devDependencies`).
- A new image, video, or font asset was added to `public/` or imported by a client file.
- The user says: "check bundle", "any server leakage", "did this bloat the client".

**Do NOT run** for: pure backend/migration changes, doc-only edits, test-fixture-only edits.

---

## Workflow

### Step 1 — Determine scope and detect framework

```bash
git diff --name-only HEAD 2>/dev/null
git diff --cached --name-only 2>/dev/null
# Detect framework
fd -1 -e ts -e js 'tanstack.config|next.config|vite.config|remix.config' .
```

Set the **client boundary** based on framework:
- **TanStack Start**: client = `src/routes/`, `src/components/`, `src/hooks/`, `src/queries/`. Server-only = `src/fn/`, `src/data-access/`, `src/db/`, `src/lib/server/`.
- **Next.js (app router)**: client = files with `'use client'` directive. Server-only = everything else, but esp. `lib/server`, `db`, route handlers in `app/api/`.
- **Vite SPA**: everything is client; flag any node-only imports.

### Step 2 — Run five detectors

#### Detector A — Server-only module imported from client (**HIGH** severity)

```bash
# Server-only import patterns to flag in client files
rg -n --type ts --type tsx -E "^import .* from ['\"](drizzle-orm|@prisma/client|fs|fs/promises|node:fs|child_process|crypto|postmark|nodemailer|stripe$|@aws-sdk|server-only|@/db|@/data-access|@/fn/.*server)" <client-files>
```

For each hit: **HIGH**. Many bundlers will pull these into the client bundle, blowing up size and crashing at runtime when `fs` is unavailable. Recommend moving the call behind a server function and importing only the type.

`server-only` package imports are a special case — Next.js will hard-fail the build, but other frameworks may not. Always flag.

#### Detector B — `process.env.X` in client file with non-public prefix (**HIGH** severity)

```bash
rg -n --type ts --type tsx -F 'process.env.' <client-files>
```

For each hit: classify the var.
- Next.js: must be `NEXT_PUBLIC_*` for client.
- Vite: must be `VITE_*` (or accessed via `import.meta.env.VITE_*`).
- TanStack Start: depends on config; flag any non-`PUBLIC_*` env in client files.

Flag mismatches as **HIGH** — either the value is undefined at runtime (silent bug) or the bundler inlines a server secret.

#### Detector C — Heavy dependency added to client first-load (**MEDIUM** severity)

Check `git diff package.json` for newly added dependencies. Maintain a known-heavy list:

```
moment       → use date-fns or dayjs
lodash       → use lodash-es with named imports OR rewrite the few used helpers
recharts     → dynamic-import the chart
chart.js     → dynamic-import
monaco-editor → dynamic-import
draft-js     → dynamic-import
quill        → dynamic-import
@react-pdf/renderer → dynamic-import
xlsx         → dynamic-import
```

For each added heavy dep, grep for its import:

```bash
rg -n --type ts --type tsx -F "from \"<dep>\"" <client-files>
rg -n --type ts --type tsx -F "from '<dep>'" <client-files>
```

If imported statically in a `src/routes/` file (especially `__root` or landing): **MEDIUM** — recommend dynamic import (`React.lazy`, `next/dynamic`) at the use site.

#### Detector D — Lodash full-import (**MEDIUM**, **auto-fixable**)

```bash
rg -n --type ts --type tsx -F 'from "lodash"' <client-files>
rg -n --type ts --type tsx -F "from 'lodash'" <client-files>
```

For each hit using a few named functions: **auto-fix** to `lodash-es` named imports (or per-function imports if `lodash-es` is not installed).

#### Detector E — Unoptimized image/video shipped (**MEDIUM** severity)

For each image asset in the diff (`*.png`, `*.jpg`, `*.jpeg`, `*.gif`, `*.webp`, `*.avif`, `*.mp4`, `*.webm`):

```bash
# Check on-disk size of newly added or changed assets
git diff --name-only HEAD --diff-filter=AM | rg -E '\.(png|jpe?g|gif|webp|avif|mp4|webm)$' | xargs -I{} ls -la {} 2>/dev/null
```

Flag any single asset > 200KB if PNG/JPG/GIF, > 1MB if WebP/AVIF, > 5MB if video. Recommend: convert to WebP/AVIF, add responsive variants (`srcset`/`sizes`), verify lazy-loading on non-LCP images.

This detector pairs with `optimize-page-images` — defer there for a deep audit; this is the "did the new asset blow the budget" check.

### Step 3 — Report

```
## Client bundle scan — <N> findings (<auto-fixed> auto-fixed)

**Framework detected:** <tanstack-start | next-app | next-pages | vite | unknown>

### HIGH — <count>
1. **Server module imported from client: `drizzle-orm`** — `<client-file>:<line>`
   - This pulls the DB driver into the browser bundle.
   - Suggest: move the query into a server function in `src/fn/`; client imports only `type` from `@/db/schema`.

2. **Non-public env in client: `STRIPE_SECRET_KEY`** — `<client-file>:<line>`
   - Will be `undefined` at runtime AND may leak into the bundle.
   - Suggest: read on the server; expose only the publishable key as `VITE_STRIPE_PUBLISHABLE_KEY`.

### MEDIUM — <count>
3. **Heavy dep statically imported in route: `recharts`** — `<route-file>:<line>`
   - First-load weight: ~400KB (gz ~110KB).
   - Suggest: `const Chart = React.lazy(() => import('./Chart'))` at the chart-rendering boundary.

4. **`from "lodash"` (full import)** — `<file>:<line>`
   - Auto-fixed to `lodash-es` named imports.

5. **Unoptimized asset shipped: `public/hero.png` (1.4MB)** — first-load image
   - Suggest: convert to WebP (~250KB), add `srcset` variants for 1x/2x.

---

No client-bundle issues detected.    ← only if 0 findings
```

---

## NEVER

- **NEVER auto-rewrite a static import to a dynamic import**
  **Instead:** Report and recommend the boundary. Dynamic imports change loading semantics (suspense fallback required, route timing shifts) — picking the wrong boundary breaks SSR or causes layout jank.
  **Why:** A wrong dynamic-import split creates new Suspense errors that the user sees only at the boundary the rewriter guessed; trust collapses.

- **NEVER flag a server import in a `src/fn/` file or other server boundary**
  **Instead:** First classify the file's runtime location based on the framework's convention, then evaluate.
  **Why:** False positives on server-only files train the user to ignore the report; this skill's value is the client-vs-server discrimination.

- **NEVER scan the whole repo when a diff exists**
  **Instead:** Default to `git diff --name-only HEAD` ∪ uncommitted; project-wide only on explicit request.
  **Why:** Whole-repo scans surface long-standing legacy imports that aren't this PR's job.

- **NEVER auto-convert images on disk**
  **Instead:** Report the size and recommend the conversion. Image conversion is a build-tool / asset-pipeline concern (sharp, vite-imagetools, next/image).
  **Why:** Mechanical conversion can lose alpha, color profile, or animation frames; the user owns the asset pipeline decision.

- **NEVER claim "no leakage" without verifying the framework detection succeeded**
  **Instead:** If framework detection bottoms out at unknown, report that explicitly: "Framework not detected — using conservative client/server heuristics."
  **Why:** A confident "no leakage" report on a framework whose boundaries this skill misclassified hides a real bug.

- **NEVER overlap with `audit-perf` for non-bundle perf concerns**
  **Instead:** Stay focused on bundle weight, server leakage, and asset weight. N+1 queries, render hot paths, unmemoized hooks belong to `audit-perf`.
  **Why:** Two skills reporting the same finding produces double work; the value is each skill's tight focus.
