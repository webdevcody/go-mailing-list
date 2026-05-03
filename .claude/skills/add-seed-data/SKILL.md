---
name: add-seed-data
description: Generate a developer seed-data script for a feature — creates representative rows through the data-access layer (not raw SQL) so the seed respects schema, foreign keys, and any business invariants encoded in DA functions. Detects an existing `scripts/seed.ts` (or the project's convention) and extends it; if none exists, creates one and wires a `seed` script in `package.json`. Defaults to idempotent inserts (upsert by natural key, or wipe-then-insert behind a flag) so re-running doesn't double-create. Trigger phrases — "seed data for X", "add fixtures", "/add-seed-data", "demo data", "create some sample posts", "fill the dev DB", "seed the database with users". Skip for — production data, test fixtures (those live in test files, not the seed), and one-off scripts the user runs manually (use a dedicated migration or admin script).
---

# Add Seed Data

A seed script's value is being able to type one command and have a working dev DB. That breaks if the seed bypasses the data-access layer (drift between seed and runtime), if it's not idempotent (duplicate rows on re-run), or if it depends on data that isn't there (foreign-key failures).

---

## Phase 1 — Confirm the Feature

Confirm the feature and the entity shape. The user said "seed posts" — clarify:
- How many rows? (default: enough to populate a list view + edge cases — typically 10–25)
- Who owns them? (a single test user? several users to exercise multi-tenant views?)
- Do they reference other entities that also need seeding? (e.g., posts → authors, projects)

If the answers depend on entities that don't exist yet, seed those first or in the same script (in dependency order).

**Exit:** entity, count, owner, dependency tree are written down.

---

## Phase 2 — Detect Seed Convention

Look for, in order:

1. `scripts/seed.ts` / `scripts/seed/index.ts` → extend it.
2. `package.json` script `seed` / `db:seed` → read what it points at.
3. `prisma/seed.ts` → Prisma convention.
4. Drizzle: no built-in convention → use `scripts/seed.ts` by default in this stack.
5. None → propose creating `scripts/seed.ts` and wiring `"seed": "tsx scripts/seed.ts"` in `package.json`.

If the project already has a seed file, read it. The new entries must match its style: which DA functions it uses, how it handles ids, how it logs progress.

**Exit:** the seed file exists or is approved to be created.

---

## Phase 3 — Locate the Data-Access Layer

In this stack, only `src/data-access/` touches the DB. The seed must call into that layer — not write `db.insert(...)` itself.

If a DA function does not exist for the entity (e.g., no `createPost(input)`), stop and surface that:

```
Cannot seed posts: no createPost in src/data-access/.
Either:
  - Add createPost to data-access first, then re-run this skill.
  - Confirm that posts should be seeded with a different DA function.
```

Do not write raw inserts as a workaround. The seed exists to exercise the same code paths the app uses.

**Exit:** the DA functions to call are identified.

---

## Phase 4 — Make It Idempotent

Pick one strategy:

- **Upsert by natural key.** If the entity has a natural key (slug, email, name), `INSERT ... ON CONFLICT (key) DO UPDATE` (or DA equivalent). Re-running updates rather than duplicates.
- **Wipe-then-insert behind a flag.** `pnpm seed --reset` deletes existing seeded rows (filtered by a marker — `createdBy = 'seed'` or a dedicated `seeded` boolean) and re-inserts.
- **Skip-if-present.** Check before inserting; do nothing if a row with the natural key already exists.

Default: **upsert by natural key** if one exists; otherwise **skip-if-present** with a stable id.

**Exit:** the idempotency strategy is chosen and consistent across the script.

---

## Phase 5 — Generate the Seed Code

Add to the seed file. Pattern:

```ts
// scripts/seed.ts
import { createUser } from '@/data-access/users'
import { createPost } from '@/data-access/posts'

async function seedPosts() {
  const author = await createUser({
    email: 'demo@example.com',
    name: 'Demo Author',
    // upsert: true if DA supports it; else skip-if-present
  })

  const fixtures = [
    { slug: 'first-post', title: 'First post', body: '...' },
    { slug: 'edge-case-empty-body', title: 'Empty body', body: '' },
    { slug: 'long-title-' + 'x'.repeat(180), title: 'x'.repeat(200), body: '...' },
  ]

  for (const fixture of fixtures) {
    await createPost({ authorId: author.id, ...fixture })
  }
}

await seedPosts()
console.log('Seeded posts')
```

Include intentional edge cases in the fixtures (empty fields, long strings, unicode, edge dates) — the seed is also an informal smoke test of the DA functions.

Order matters: parents before children. If `seedPosts` depends on `seedUsers`, await `seedUsers()` first.

**Exit:** seed code is added, follows the file's existing style, and can run.

---

## Phase 6 — Run It

Run the seed against a local dev DB:

```bash
pnpm seed
```

It must succeed. Then run it **a second time** — it must still succeed (idempotency check) and produce no duplicate rows.

If a foreign-key error appears: a parent entity isn't seeded yet — fix order.
If duplicates appear on the second run: the idempotency strategy isn't being applied — fix.

**Exit:** the seed runs cleanly twice.

---

## Phase 7 — Report

```
Seed added: scripts/seed.ts (seedPosts)
  Entities:    25 posts, 1 author
  Idempotent:  upsert by slug
  Run:         pnpm seed
  Reset:       pnpm seed --reset (if flag was added)

Verified:    ✓ first run, ✓ second run no duplicates.
```

---

## NEVER

- **NEVER write raw `db.insert(...)` in a seed script when a data-access function exists.**
  **Instead:** call `createX(...)` from `src/data-access/`. If no DA function exists, stop and surface that.
  **Why:** raw inserts bypass any validation, default-population, or side-effect logic in the DA layer. The seed produces rows the runtime code path could never produce — which means seeded data exercises tests and dev environments differently from real data, hiding bugs until production.

- **NEVER seed without an idempotency strategy.**
  **Instead:** upsert by natural key, skip-if-present, or wipe-then-insert behind an explicit flag. State which one in the script.
  **Why:** a non-idempotent seed silently doubles every run. Devs don't notice for a while; then a list view shows two of every fixture and someone wastes an hour debugging "why are there duplicates in production" before realizing it's the seed.

- **NEVER run the seed against a non-development database.**
  **Instead:** the script must check `process.env.NODE_ENV !== 'production'` (or equivalent) and refuse otherwise.
  **Why:** a single accidental `pnpm seed` against prod creates demo accounts, fake posts, and possibly destructive resets. The check is one line and prevents the worst outcome.

- **NEVER inline secrets, real-looking PII, or live API keys into the fixtures.**
  **Instead:** use clearly-fake names (`demo@example.com`), placeholder strings, and dummy keys.
  **Why:** seed files get committed. Real-looking data trains everyone (and any AI scraper) that the data is real; real keys leak immediately.

- **NEVER seed entities out of dependency order.**
  **Instead:** seed parents before children — users before posts, projects before tasks, orgs before users.
  **Why:** out-of-order inserts crash on foreign-key constraints. The script halts mid-way, leaving the DB in a partially-seeded state that's worse than empty.

- **NEVER bundle seed data into a database migration.**
  **Instead:** keep migrations and seeds separate; migrations change schema, seeds populate dev rows.
  **Why:** migrations run in production. Demo posts ending up in prod because someone bundled them into a `0042_add_posts_table.sql` is a real and recurring class of bug.
