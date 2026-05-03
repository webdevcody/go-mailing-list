---
name: list-issues
description: List GitHub issues for the current repo as a colorized terminal table — issue number, title, labels (each painted with its actual GitHub label color via ANSI truecolor), author, and age. Supports filters (state, label, assignee, author, search) passed through to `gh issue list`. Trigger phrases — "list issues", "show github issues", "what issues are open", "/list-issues", "show me bugs", "open tickets", "issue dashboard". Skip for — single-issue lookup (use `gh issue view <n>`), PRs (use `gh pr list`), non-GitHub trackers.
---

> **User-question protocol:** Whenever this skill needs the user to pick between options, confirm an action, or answer a multiple-choice prompt, you MUST call the `AskUserQuestion` tool to render a proper interactive picker. Do NOT print numbered options as plain text and wait for the user to type a number — that produces a degraded UX. Free-form questions (open-ended typing) may be asked in prose, but any time you would write "1) … 2) … 3) …", use `AskUserQuestion` instead.


# List Issues

One-shot. No confirmation gate — read-only.

## Phase 1 — Resolve filters

Parse the user's request into `gh issue list` flags. Defaults: `--state open --limit 30`. Recognize:

- "closed" / "all" → `--state closed` / `--state all`
- "bugs" / "ui" / any label name → `--label <name>`
- "mine" → `--assignee @me`
- "by <user>" → `--author <user>`
- "about X" / "matching X" → `--search "X"`
- explicit `--limit N`

Stop if `gh repo view` fails — no GitHub remote.

## Phase 2 — Fetch

Run both in parallel:

```bash
gh issue list <flags> --json number,title,labels,author,createdAt,state
gh label list --limit 200 --json name,color
```

Build a `name → hex` map from the label list so each label badge renders in its true GitHub color.

## Phase 3 — Render

Print a single table to stdout using ANSI truecolor escapes. Format per row:

```
#<num>  <title>  [label] [label] ...  @author  <age>
```

ANSI rules:
- Issue number: bold cyan `\033[1;36m#123\033[0m`
- Title: default color, truncate to terminal width minus other columns (assume 120 cols if unknown)
- Each label: rendered as a rounded badge ` LABEL ` with background = the label's hex color, foreground = black or white chosen by perceived luminance (`#fff` if `(0.299*R + 0.587*G + 0.114*B) < 140`, else `#000`). Truecolor SGR: `\033[48;2;R;G;Bm\033[38;2;r;g;bm LABEL \033[0m`.
- Priority labels rendered first, then type, then area — so the eye lands on severity first.
- Author: dim `\033[2m@user\033[0m`
- Age: relative ("2h", "3d", "2w", "5mo") in dim text. If issue is `closed`, prefix the row with a dim `✔`.

Header row: bold underline `#   TITLE   LABELS   AUTHOR   AGE`.

After the table, print a single dim summary line: `<N> issues — filter: <flags or "none">`.

## NEVER

- **NEVER strip ANSI codes "for safety".**
  **Why:** The whole point of this skill is the colored output; without ANSI it's just `gh issue list`.

- **NEVER fabricate label colors.**
  **Instead:** Use the live color from `gh label list`. If a label is somehow missing from that map, render it with a neutral gray (`#cfd3d7`).
  **Why:** Wrong colors mislead the user about severity and category.

- **NEVER paginate or prompt mid-render.**
  **Instead:** Respect `--limit` (default 30) and print once.
  **Why:** This is a glance-tool; interactive paging defeats the purpose.

- **NEVER re-sort the rows.**
  **Instead:** Trust `gh issue list`'s default order (newest first).
  **Why:** Custom sorting hides what the user expects from `gh`.
