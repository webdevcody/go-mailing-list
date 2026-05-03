---
name: commit-and-push
description: Run the agentsystem-core commit skill to produce grouped commits from the working tree, then push the current branch to its remote (setting upstream with -u when missing). No-op when there is nothing to commit. Never force-pushes. Use when the user says "commit and push", "/commit-and-push", "commit then push", "push these changes", or asks to commit work and publish it to the remote in one step. Skip for: amend/fixup workflows, pushes without a fresh commit (use `git push` directly), force-push requests, when the user has already committed and only wants to push, or when the user wants the full engineering pipeline (use `/ship` for plan → implement → test → review).
---

> **User-question protocol:** Whenever this skill needs the user to pick between options, confirm an action, or answer a multiple-choice prompt, you MUST call the `AskUserQuestion` tool to render a proper interactive picker. Do NOT print numbered options as plain text and wait for the user to type a number — that produces a degraded UX. Free-form questions (open-ended typing) may be asked in prose, but any time you would write "1) … 2) … 3) …", use `AskUserQuestion` instead.


# commit-and-push

Two steps, in order: (1) delegate commit work to the `commit` skill, (2) push the current branch.

---

## Step 1 — Commit

Invoke the `commit` skill. Do NOT re-implement its grouping logic here — it owns commit composition, ordering, and message style.

Exit conditions from Step 1:
- **Commits were created** → proceed to Step 2.
- **Working tree was already clean** (nothing to commit) → no-op the whole skill. Do not push. Tell the user "nothing to commit; not pushing" and stop.
- **`commit` skill aborted or errored** → stop. Do not push a partial state.

---

## Step 2 — Push

Before pushing, confirm: the branch you're about to push is the one the user expects. `HEAD` may have moved during Step 1 if the `commit` skill checked out anything; always re-derive the branch from `git rev-parse --abbrev-ref HEAD` rather than caching it from before Step 1.

Run exactly:

```bash
git rev-parse --abbrev-ref HEAD                    # capture <branch>
git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null
```

- If the second command **succeeds** → upstream exists → `git push`.
- If it **fails** (no upstream) → `git push -u origin <branch>`.

If `origin` does not exist (push errors with "'origin' does not appear to be a git repository"), run `git remote -v`, show the user the available remotes, and stop. Do not guess a remote name.

Report the pushed branch and remote in one line when done.

---

## NEVER

- **NEVER pass `--force`, `--force-with-lease`, `+<refspec>`, or any force variant**
  **Instead:** If the push is rejected as non-fast-forward, stop, surface the rejection verbatim, and suggest the user run `git pull --rebase` then re-invoke this skill. Do not auto-pull, do not auto-rebase, do not force.
  **Why:** Force-push silently rewrites remote history; on shared branches it destroys other people's commits. Auto-pull/rebase hides the conflict from the user and can merge unrelated upstream work into commits they just made. The user explicitly forbade force for this skill.

- **NEVER push without first attempting Step 1**
  **Instead:** Always run the `commit` skill first, even if you suspect the tree is clean. Let `commit` decide.
  **Why:** The whole point of this skill is "commit + push as one action." Skipping Step 1 turns it into `git push` and bypasses the grouping discipline.

- **NEVER push when Step 1 produced zero commits**
  **Instead:** No-op and tell the user. If they wanted to push pre-existing local commits, they'll re-run with plain `git push`.
  **Why:** The user specified no-op semantics when there's nothing to commit. A push in that case would publish unrelated stale local work the user didn't ask about.

- **NEVER skip the upstream check and assume `git push` will work**
  **Instead:** Run the `@{u}` rev-parse first; branch on its exit code.
  **Why:** A first-push on a new branch fails without `-u origin <branch>`. Checking up front avoids a cryptic error and a second round-trip.

- **NEVER push to a branch other than the current `HEAD`**
  **Instead:** Always derive the branch from `git rev-parse --abbrev-ref HEAD`. Never hardcode `main` or pass an explicit refspec.
  **Why:** Hardcoded targets push the wrong branch when the user has checked out a feature branch.
