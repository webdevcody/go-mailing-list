---
name: create-issue
description: Create a GitHub issue from a short user description, auto-classify it with type + area + priority labels, ensure those labels exist in the repo (creating any that are missing with consistent colors), then create the issue via `gh issue create` and print the URL. Trigger phrases — "create an issue", "open a github issue", "file a bug", "log this as an issue", "/create-issue", "make a ticket for this", "track this in github". Skip for — PRs (use open-pr), commenting on existing issues (use `gh issue comment`), non-GitHub trackers (Linear, Jira).
---

> **User-question protocol:** Whenever this skill needs the user to pick between options, confirm an action, or answer a multiple-choice prompt, you MUST call the `AskUserQuestion` tool to render a proper interactive picker. Do NOT print numbered options as plain text and wait for the user to type a number — that produces a degraded UX. Free-form questions (open-ended typing) may be asked in prose, but any time you would write "1) … 2) … 3) …", use `AskUserQuestion` instead.


# Create Issue

Phased. The auto-label step is the value — do not skip it.

## Phase 1 — Gather

In parallel:

- `gh repo view --json nameWithOwner,defaultBranchRef -q '{repo:.nameWithOwner,base:.defaultBranchRef.name}'` — confirm repo. If this fails, stop: no GitHub remote.
- `gh label list --limit 200 --json name,color,description` — current labels.

Stop conditions:
- No GitHub remote → stop. Tell the user.
- User description is one ambiguous word ("broken", "fix") → ask for one sentence of context before continuing.

## Phase 2 — Draft + Classify

Draft a title (≤70 chars, imperative, no trailing period) and a short body:

```
## Description
<1–3 sentences>

## Acceptance criteria
- [ ] <checkable>
- [ ] <checkable>
```

Then classify the issue across **three label axes**. Pick **at least one type** and **at least one area**; priority is optional but encouraged.

**Type** (pick 1–2): `bug`, `feature`, `enhancement`, `refactor`, `docs`, `test`, `chore`, `question`

**Area** (pick 1–3): `ui`, `ux`, `frontend`, `backend`, `infra`, `performance`, `security`, `accessibility`, `dx`, `dependencies`

**Priority** (pick 0–1): `priority:critical`, `priority:high`, `priority:medium`, `priority:low`

Classification heuristics (apply to the user's words):
- "broken", "crash", "error", "regression", "doesn't work" → `bug`
- "add", "build", "ship", "support for", "we should be able to" → `feature`
- "make X better/faster/cleaner" on existing behavior → `enhancement`
- "looks", "color", "spacing", "layout", "alignment" → `ui`
- "confusing", "hard to find", "user can't", "flow" → `ux`
- "slow", "lag", "memory", "p95", "timeout" → `performance` + `priority:high` if user mentions production
- "deploy", "CI", "docker", "env var", "build pipeline" → `infra`
- "API", "server", "DB", "endpoint", "query", "migration" → `backend`
- "screen reader", "keyboard nav", "ARIA", "contrast" → `accessibility`
- "prod down", "data loss", "security incident" → `priority:critical`

If a single description spans multiple areas (e.g., "the login button looks wrong AND the auth endpoint returns 500"), suggest splitting into two issues before creating.

## Phase 3 — Ensure Labels Exist

Diff the chosen labels against the `gh label list` output. For each missing label, queue a `gh label create` call with this color map:

| Label | Color (hex, no #) |
|---|---|
| `bug` | `d73a4a` |
| `feature` | `0e8a16` |
| `enhancement` | `a2eeef` |
| `refactor` | `c5def5` |
| `docs` | `0075ca` |
| `test` | `bfd4f2` |
| `chore` | `cfd3d7` |
| `question` | `d876e3` |
| `ui` | `fbca04` |
| `ux` | `f9d0c4` |
| `frontend` | `bfdadc` |
| `backend` | `5319e7` |
| `infra` | `1d76db` |
| `performance` | `ff9f1c` |
| `security` | `b60205` |
| `accessibility` | `006b75` |
| `dx` | `7057ff` |
| `dependencies` | `0366d6` |
| `priority:critical` | `b60205` |
| `priority:high` | `d93f0b` |
| `priority:medium` | `fbca04` |
| `priority:low` | `c2e0c6` |

Create with: `gh label create "<name>" --color <hex> --description "<short>"`. Run missing-label creates in parallel.

## Phase 4 — Confirm (mandatory gate)

Show the user:

```
Repo: <owner/name>
Title: <title>
Labels: <comma-separated>
New labels to create: <list or "none">

Body:
<body>

Create issue? (y / edit / cancel)
```

- `y` → Phase 5
- `edit` → ask which slot (title/body/labels), redraft, show again
- `cancel` → stop, do NOT create the labels either

## Phase 5 — Create

After any missing labels are created, run:

```bash
gh issue create \
  --title "<title>" \
  --label "<l1>" --label "<l2>" ... \
  --body "$(cat <<'EOF'
<body>
EOF
)"
```

Always use HEREDOC for `--body`. Print the issue URL from stdout.

## NEVER

- **NEVER skip the confirmation gate.**
  **Why:** Issues notify watchers and clutter the tracker; the title/labels are your synthesis, not the user's words verbatim.

- **NEVER create labels before the user confirms.**
  **Instead:** Queue the creates, list them in the confirmation, only run them after `y`.
  **Why:** A cancelled issue leaves orphan labels polluting the repo's label set.

- **NEVER apply more than 2 type labels or more than 1 priority label.**
  **Why:** Filters break when an issue is simultaneously `bug` + `feature` + `enhancement` — pick the dominant frame.

- **NEVER assume the repo's label color scheme.**
  **Instead:** Use the color map above so labels stay consistent across repos.
  **Why:** Random colors per-repo make the label list visually noisy and hard to scan.
