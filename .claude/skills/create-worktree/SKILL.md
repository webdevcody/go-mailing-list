---
name: create-worktree
description: Spin up an isolated git worktree at `.worktrees/<branch>/` with auto-allocated UI/API/DB ports, a generated `.env`, installed deps, a per-worktree Postgres container, and migrations applied — so multiple branches run side-by-side without colliding on ports or databases. On first ever run in a repo, refactors hardcoded port literals to env-driven config (with approval) before creating the first worktree. Trigger phrases — "new worktree", "create a worktree", "spin up a worktree", "parallel branch", "work on two branches at once", "/create-worktree". Skip for — non-Node projects without docker-compose, bare `git worktree add` requests where the user explicitly does not want extra setup, monorepos with multiple apps (this skill assumes one app per repo), and Windows hosts (port range and `docker compose` invocation assume macOS/Linux).
---

> **User-question protocol:** Whenever this skill needs the user to pick between options, confirm an action, or answer a multiple-choice prompt, you MUST call the `AskUserQuestion` tool to render a proper interactive picker. Do NOT print numbered options as plain text and wait for the user to type a number — that produces a degraded UX. Free-form questions (open-ended typing) may be asked in prose, but any time you would write "1) … 2) … 3) …", use `AskUserQuestion` instead.


# create-worktree

Process skill. Each phase has an exit condition; do not proceed until it's met. On any failure after Phase 2, run the rollback in **Recovery**.

## Before you start — confirm the assumptions

This skill assumes a specific shape. Before running, confirm:

- **Single-app repo** — one dev server, one API server, one Postgres. Monorepos with multiple apps need a different approach.
- **Postgres lives in `docker-compose.yml`** — not a hosted DB, not SQLite, not a Postgres on the host.
- **The dev server reads its port from env, or can be made to** — Phase 0 will refactor if not.

If any answer is "no" or "not sure," stop and surface the mismatch to the user — do not improvise around it.

## Phase 0 — Detect first-run

**Preconditions** (abort with a clear message if any fail):

- `uname -s` is `Darwin` or `Linux` — Windows (`MINGW*`/`MSYS*`/`CYGWIN*`) is not supported.
- `command -v docker` resolves — the skill needs Docker on PATH.
- `docker-compose.yml` or `compose.yml` exists at repo root — Postgres-via-compose is assumed.

Then check whether the repo is already port-parameterized. The repo passes if **all** of these are true:

- `.env.example` exists and contains entries for the dev UI port, the API port (if applicable), and the Postgres port — names like `VITE_PORT`, `PORT`, `API_PORT`, `DATABASE_URL` (with `${...}` style port) or `POSTGRES_PORT`.
- `vite.config.*` reads its port from `process.env` (not a hardcoded literal).
- `docker-compose.yml` (or `compose.yml`) uses `${POSTGRES_PORT:-5432}:5432` style mapping, not a bare `5432:5432`.
- `package.json` dev/start scripts do not pin `--port 3000` or similar literals (or they read `$PORT`).

If any check fails → **MANDATORY READ [`references/first-run-refactor.md`](references/first-run-refactor.md)**. Run that workflow, get user approval on the diff, commit on the current branch, then continue. Do NOT load that file otherwise.

Exit: all four checks pass.

## Phase 1 — Allocate ports

**MANDATORY READ [`references/port-allocation.md`](references/port-allocation.md)** — contains the hash algorithm, safe port range, free-port probing, and `.worktrees/ports.json` registry format.

Output of this phase: `{branch, ui_port, api_port, db_port, container_name, db_name}` written to the registry. Do NOT load this file in any other phase.

After the registry write, show the user the allocated ports + container name in one line and proceed unless they object. This is a soft gate — no explicit approval needed, but they can interrupt before resources are created.

Exit: registry entry written; all three ports verified free via `lsof -i:$PORT` returning empty.

## Phase 2 — Create the worktree

```bash
BRANCH="<sanitized-branch-name>"
BASE="${BASE:-main}"
mkdir -p .worktrees
git worktree add ".worktrees/$BRANCH" -b "$BRANCH" "$BASE"
```

The new branch defaults to branching from `main`. If the user wants it from current HEAD or another ref, ask first — do not silently use HEAD.

If the branch already exists, drop `-b` and the base ref. If `.worktrees/$BRANCH` already exists, abort with: "worktree already exists at .worktrees/$BRANCH — delete it first or pick a different branch name."

Add `.worktrees/` to `.gitignore` if not already present.

Exit: `git worktree list` shows the new entry.

## Phase 3 — Generate `.env`

Guard against overwriting hand-edited values:

```bash
if [ -f ".worktrees/$BRANCH/.env" ]; then
  echo "abort: .env already exists at .worktrees/$BRANCH/.env — delete it first or pass --force. It may contain secrets you added by hand."
  exit 1
fi
cp .env.example ".worktrees/$BRANCH/.env"
```

Then rewrite the copied `.env`, substituting:

- UI port var → `$ui_port`
- API port var → `$api_port`
- Postgres port var → `$db_port`
- `DATABASE_URL` → `postgresql://postgres:postgres@localhost:$db_port/$db_name`
- Any `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` defaults → keep as-is unless user customized them

Verify by grepping the file for any remaining placeholder-looking values (`changeme`, `your-...`, `<...>`). If found, surface them to the user before continuing — they may need real secrets.

Exit: `.env` exists in the worktree with concrete port values and a unique `DATABASE_URL`, and no pre-existing `.env` was overwritten.

## Phase 4 — Install dependencies

Detect manager from lockfile (`bun.lock*` → bun, `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, else npm) and run `<mgr> install` in the worktree dir. Report the manager picked.

Exit: install exits 0.

## Phase 5 — Start the per-worktree Postgres container

Use a unique compose **project name** so containers, volumes, and networks are namespaced per worktree:

```bash
cd ".worktrees/$BRANCH"
docker compose -p "$container_name" --env-file .env up -d
```

The `-p` flag is what isolates this worktree's containers from the main checkout's containers. The host port comes from `$db_port` in `.env`.

Wait for Postgres to accept connections (poll `pg_isready` or `docker compose -p $container_name exec ... pg_isready`, max 30s).

Exit: `pg_isready` returns 0, OR `docker compose ps` shows the db service `healthy`.

## Phase 6 — Run migrations

Detect the migration command in this priority order:

1. `package.json` script named `db:migrate`, `migrate`, or `db:push` → run it
2. `drizzle.config.*` exists → `npx drizzle-kit migrate` (or `push` if no migrations dir)
3. `prisma/schema.prisma` → `npx prisma migrate deploy`
4. None detected → report to user, skip

Run in the worktree dir so `.env` (and thus `DATABASE_URL`) resolves to the new container.

Exit: migration command exits 0, or skip is reported.

## Phase 7 — Report

Print a single block:

```
Worktree ready: .worktrees/<branch>/

Ports:
  UI:       http://localhost:<ui_port>
  API:      http://localhost:<api_port>
  Postgres: localhost:<db_port>  (db: <db_name>)

Container project: <container_name>

Next steps:
  cd .worktrees/<branch> && <pkg-manager> run dev
  # tear down later: docker compose -p <container_name> down -v && git worktree remove .worktrees/<branch>
```

## Recovery

If any phase after Phase 2 fails, run rollback in reverse:

1. `docker compose -p $container_name down -v` (removes container + volume)
2. `git worktree remove --force .worktrees/$BRANCH`
3. `git branch -D $BRANCH` (only if Phase 2 created it; check `git reflog`)
4. Remove the registry entry from `.worktrees/ports.json`

Then surface the failing phase's error to the user. Do not retry automatically.

## NEVER

- **NEVER share Postgres or compose resources across worktrees** (same compose project name, same `DATABASE_URL`, same DB name, or same host port)
  **Instead:** Always pass `-p $container_name` to `docker compose` derived from the branch slug, AND substitute `$db_port` + `$db_name` per allocation in `.env`. Verify with `grep DATABASE_URL .worktrees/*/.env` showing distinct ports.
  **Why:** Without `-p`, `docker compose up` adopts containers from the main checkout, swaps their port mapping, and silently breaks the main dev env. With shared `DATABASE_URL`, two worktrees run migrations against each other's schemas and corrupt both branches' state. Same root cause: collision on shared resources — both halves of the isolation must hold.

- **NEVER skip Phase 0's first-run refactor on the assumption "it probably works"**
  **Instead:** Run all four detection checks. If any fails, do the refactor — even if the user is impatient.
  **Why:** A single hardcoded `5173` in `vite.config.ts` defeats the entire skill: the second worktree's UI silently binds to the same port and one of them serves stale assets.

- **NEVER pick ports in the macOS ephemeral range (49152–65535) or under 1024**
  **Instead:** Use the 20000–32000 range defined in `references/port-allocation.md`.
  **Why:** macOS hands out ephemeral ports from 49152+ for outbound connections; a worktree bound there will randomly fail to start when the OS has already claimed its port.

- **NEVER run migrations from the main checkout against a worktree's database**
  **Instead:** `cd .worktrees/$BRANCH` first so the migration tool reads the worktree's `.env`.
  **Why:** Migration tools resolve `DATABASE_URL` from the cwd's `.env`; running from the wrong dir migrates the wrong DB and the failure mode (wrong-schema errors at runtime) is hard to diagnose.

- **NEVER delete `.worktrees/ports.json` to "reset"**
  **Instead:** Run the registry-prune step described in `references/port-allocation.md` — it removes only entries whose worktree dirs no longer exist.
  **Why:** Wholesale deletion drops live allocations; the next worktree's hash collides with a running one and Phase 1's free-port check still passes (because the port is in use by *the other worktree*, which is expected) — chaos ensues.
