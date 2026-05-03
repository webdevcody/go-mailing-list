# Port Allocation

Deterministic-with-fallback allocation. Same branch name → same ports across runs (idempotent). Free-port check + linear probe handles collisions.

## Safe range

- Use `20000–32000` for all three ports.
- Avoid: `<1024` (privileged), `3000/5173/5432/8080` and other common dev defaults (likely in use), `32768+` (Linux ephemeral start), `49152+` (macOS ephemeral).
- Reserve a 1000-port window per role so UI/API/DB don't accidentally swap:
  - UI:  `20000–22999`
  - API: `23000–25999`
  - DB:  `26000–28999`

## Algorithm

For a sanitized branch name `B`:

1. `h = sha1(B)` → take first 8 hex chars → integer `n`.
2. Initial candidates:
   - `ui  = 20000 + (n % 3000)`
   - `api = 23000 + ((n >> 4) % 3000)`
   - `db  = 26000 + ((n >> 8) % 3000)`
3. For each port, run `lsof -nP -iTCP:$PORT -sTCP:LISTEN | grep -q .` — if it returns a match, increment by 1 and re-check. Cap at 50 probes per port; if you exhaust it, abort with a clear error.
4. Verify the trio doesn't conflict with another **registered** worktree (read `.worktrees/ports.json`). If it does, increment again until clean.

`db_name = "app_" + B` (replace any non-`[a-z0-9_]` with `_`).
`container_name = "wt_" + B` (same sanitization). This becomes the `docker compose -p` value.

## Registry: `.worktrees/ports.json`

```json
{
  "worktrees": {
    "<branch>": {
      "ui_port": 20431,
      "api_port": 23882,
      "db_port": 26104,
      "container_name": "wt_<branch>",
      "db_name": "app_<branch>",
      "created_at": "2026-04-27T00:00:00Z"
    }
  }
}
```

Read-modify-write atomically (write to `ports.json.tmp`, then `mv`). Create the file with `{"worktrees": {}}` if missing.

## Prune step (run at the start of Phase 1)

For each entry in the registry, check if `.worktrees/<branch>/` still exists. If not, remove the entry. This is the ONLY safe way to clean stale allocations — never delete the file wholesale.

## Idempotency

If the registry already has an entry for `B` AND `.worktrees/B/` exists, return that entry without re-allocating. The user is re-running the skill on a half-finished worktree; respect prior allocation.
