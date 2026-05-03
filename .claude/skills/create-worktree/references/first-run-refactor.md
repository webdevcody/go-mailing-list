# First-Run Refactor

Goal: take a repo with hardcoded port literals and parameterize them so worktrees can coexist. Run this once per repo; commit the result on the current branch BEFORE creating any worktree.

## Step 1 — Sweep for port literals

Run from repo root, exclude `node_modules`, `.git`, `.worktrees`, `dist`, `build`:

```bash
rg -n --hidden \
  -g '!node_modules' -g '!.git' -g '!.worktrees' -g '!dist' -g '!build' -g '!*.lock*' \
  '\b(3000|3001|4000|5173|5432|8080|8000|4173)\b'
```

Classify each hit:

- **Real port binding** (vite/express/postgres config, docker-compose, dev script `--port` flag) → must parameterize.
- **Coincidental number** (timeout=3000ms, line numbers, version strings) → leave alone.
- **Documentation** (README "visit localhost:3000") → update only if it's instructions the user follows verbatim.

Present the classified list to the user before editing. Get approval per group, not per file.

## Step 2 — Create / update `.env.example`

Add (don't overwrite existing values):

```
# Per-worktree ports — see .worktrees/ports.json for allocations
VITE_PORT=5173
API_PORT=4000
POSTGRES_PORT=5432
POSTGRES_DB=app
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
DATABASE_URL=postgresql://postgres:postgres@localhost:${POSTGRES_PORT}/${POSTGRES_DB}
```

Adjust var names to match what the codebase already uses; do not introduce a parallel set.

## Step 3 — Parameterize each binding site

### `vite.config.ts`

```ts
export default defineConfig({
  server: {
    port: Number(process.env.VITE_PORT) || 5173,
    strictPort: true,  // fail loudly instead of silently grabbing the next port
  },
});
```

`strictPort: true` is critical — without it, vite will silently pick a different port when the configured one is busy, and the worktree's UI ends up on a port the registry doesn't know about.

### Express / API server

```ts
const port = Number(process.env.API_PORT) || 4000;
app.listen(port, () => console.log(`api on :${port}`));
```

### `docker-compose.yml`

```yaml
services:
  db:
    image: postgres:16
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-app}
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
    volumes:
      - db_data:/var/lib/postgresql/data
volumes:
  db_data:
```

The `${VAR:-default}` syntax means the main checkout still works without a `.env`. The `:5432` on the right side is the **container** port and stays fixed.

### `package.json` scripts

Remove hardcoded `--port 3000` flags. Vite/Next/etc. will read from env once Step 3.1 is done.

### `drizzle.config.ts` (or equivalent)

Already reads `DATABASE_URL` from env in most setups. Verify it doesn't have a hardcoded fallback like `'postgresql://...localhost:5432...'` — replace any such fallback with throwing if `DATABASE_URL` is unset.

## Step 4 — Verify

After edits:

```bash
# Should now return 0 lines from real binding sites
rg -n --hidden -g '!node_modules' -g '!.worktrees' -g '!*.lock*' \
  '(port|PORT)\s*[:=]\s*[0-9]{4}'
```

Manually start the main checkout (`<pkg-manager> run dev` + `docker compose up -d`) and confirm it still works on the original ports. This proves the `${VAR:-default}` fallbacks are correct.

## Step 5 — Commit

```bash
git add -A
git commit -m "chore: parameterize ports for worktree isolation"
```

Then return to SKILL.md Phase 1.

## Stop conditions

Abort the refactor and report to the user if:

- The repo has multiple apps with overlapping port concerns (monorepo) — this skill assumes single-app.
- The repo uses a process manager (pm2, foreman, overmind) with its own port config — the user needs to decide where the source of truth lives.
- Ports are configured via a non-standard mechanism (e.g. a `config.ts` re-exported everywhere) — propose a plan first instead of editing.
