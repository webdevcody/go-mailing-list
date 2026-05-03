---
name: quick-push
description: Fast-path push — stage everything in the working tree, create ONE auto-generated commit (bypassing the multi-commit grouping of the `commit` skill), then push the current branch's commits to remote `main` after explicit user confirmation. Trigger phrases — "/quick-push", "quick push", "push it now", "yolo", "/yolo", "yolo to main", "yolo commit", "speed commit", "one big commit and push to main", "just push it to main". Skip for — workflows that need grouped commits (use `commit` or `commit-and-push`), pushes to a branch other than `main`, force-push requests, amend/fixup, or when the user wants to review the diff before committing. For end-to-end engineering pipelines (plan → implement → test → review), use the orchestrator `/ship` instead.
---

> **User-question protocol:** Whenever this skill needs the user to pick between options, confirm an action, or answer a multiple-choice prompt, you MUST call the `AskUserQuestion` tool to render a proper interactive picker. Do NOT print numbered options as plain text and wait for the user to type a number — that produces a degraded UX. Free-form questions (open-ended typing) may be asked in prose, but any time you would write "1) … 2) … 3) …", use `AskUserQuestion` instead.


# quick-push

One commit. Push to `origin main`. Confirm before the push.

This skill deliberately bypasses the `commit` skill's grouping logic — the user asked for the speed path, not the clean-history path.

---

## Step 1 — Stage and commit everything

```bash
git status --short
git diff --stat HEAD
```

If the working tree is clean AND there are no untracked files → check if local has unpushed commits ahead of `origin/main`. If yes, skip to Step 2. If no, no-op: tell the user "nothing to ship" and stop.

Otherwise, generate a one-line commit message from the diff. Before writing it, ask: **what is the dominant change a future bisecter would search for?** That phrase belongs in the message. Imperative mood, ≤72 chars, name the dominant change — not "various updates". Then:

```bash
git add -A
git commit -m "<message>"
```

Use the project's standard `Co-Authored-By` trailer if other commits in `git log` have one; otherwise no trailer.

---

## Step 2 — Confirm, then push to main

Probe the remote first:

```bash
git remote get-url origin
```

If this fails, run `git remote -v`, show the user the available remotes, and stop — do not guess a remote name.

Then probe whether `origin/main` already exists:

```bash
git fetch origin main
git rev-parse --verify origin/main
```

- If `rev-parse` succeeds → compute ahead-count with `git rev-list --count origin/main..HEAD`.
- If `rev-parse` fails (remote `main` doesn't exist yet — first push to a new repo) → skip the ahead-count and tell the user the push will create `origin/main`.
- If `git fetch` fails (offline, auth) → stop and surface the error; do NOT proceed with a stale count.

Show the user:
- Branch name (`git rev-parse --abbrev-ref HEAD`)
- The commit just made (`git log -1 --oneline`)
- Either the ahead-count or "this push will create origin/main"
- The exact command about to run

Ask: **"Push these N commit(s) to origin/main? (y/n)"** Wait for the user. Anything other than an affirmative reply → stop.

On approval, push the current branch's commits to remote `main`:

```bash
git push origin HEAD:main
```

This pushes whatever is at `HEAD` to the remote `main` ref regardless of the local branch name (per user spec: option c). Report the result in one line.

If the push is rejected as non-fast-forward → stop, surface the rejection verbatim, suggest `git fetch origin main && git rebase origin/main`. Do not auto-rebase, do not force.

---

## NEVER

- **NEVER pass `--force`, `--force-with-lease`, or `+<refspec>`**
  **Instead:** On non-fast-forward rejection, stop and surface the error. Let the user choose how to reconcile.
  **Why:** This skill targets `main` directly — a force-push here rewrites the trunk for everyone.

- **NEVER push without the explicit y/n confirmation in Step 2**
  **Instead:** Always show the branch, commit, and command, then wait for an affirmative reply.
  **Why:** The user specified confirmation before pushing. Pushing to `main` without it publishes unreviewed work to the trunk.

- **NEVER delegate to the `commit` skill**
  **Instead:** Stage with `git add -A` and create one commit inline.
  **Why:** The whole point of this skill is to bypass `commit`'s grouping. Delegating defeats the purpose.

- **NEVER use a placeholder commit message like "wip", "update", or "changes"**
  **Instead:** Read `git diff --stat` and `git diff` (sampled) and write an imperative one-liner naming the dominant change.
  **Why:** This commit lands on `main` permanently. A useless message poisons the log and `git blame`.

- **NEVER stage files matching `.env*`, `*.pem`, `*credentials*`, `*.key`, or anything in `.gitignore` that slipped through**
  **Instead:** Run `git status --short` first; if any suspicious paths appear, stop and ask the user before `git add -A`.
  **Why:** `git add -A` is indiscriminate — secrets shipped to `main` are effectively public the moment they're pushed.

- **NEVER push to a remote other than `origin` or a branch other than `main` under this skill**
  **Instead:** If the user wants a different target, redirect them to `commit-and-push` (current branch → its upstream).
  **Why:** This skill's contract is `origin main`. Silently retargeting violates user expectation.
