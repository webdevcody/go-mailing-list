---
name: open-pr
description: Open a GitHub pull request with a title and Summary/Test-plan body generated from the branch's full commit range and diff against the base branch — not just the latest commit. Pushes the branch with -u when there's no upstream, picks the repo's default base branch, marks the PR as draft when commits signal WIP, and shows the proposed title/body for confirmation before publishing. Trigger phrases — "open a PR", "create a pull request", "make a PR", "/open-pr", "raise a PR", "submit a PR", "PR with description", "open a draft PR". Skip for — pushing without a PR, editing an existing PR's body (use `gh pr edit`), repos without a GitHub remote.
---

> **User-question protocol:** Whenever this skill needs the user to pick between options, confirm an action, or answer a multiple-choice prompt, you MUST call the `AskUserQuestion` tool to render a proper interactive picker. Do NOT print numbered options as plain text and wait for the user to type a number — that produces a degraded UX. Free-form questions (open-ended typing) may be asked in prose, but any time you would write "1) … 2) … 3) …", use `AskUserQuestion` instead.


# Open PR

Phased workflow. Do not skip the confirmation gate — a published PR notifies reviewers and is hard to un-publish.

## Phase 1 — Gather

Run the reflexive checks (`git status`, current branch) plus these non-obvious ones in parallel:

- `gh repo view --json defaultBranchRef -q .defaultBranchRef.name` — base branch (do NOT assume `main`)
- `git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null` — does upstream exist?
- `git log <base>..HEAD --pretty=format:'%h %s'` — every commit on the branch
- `git diff <base>...HEAD --stat` and `git diff <base>...HEAD` — cumulative diff (note the **three dots** — diff from merge-base, not two)

Stop conditions:
- Uncommitted changes → ask whether to commit, stash, or include them. Do not silently ignore.
- Branch == base branch → stop. PRs cannot target themselves.
- No commits ahead of base → stop. Nothing to PR.
- No GitHub remote (`gh repo view` fails) → stop. Tell the user.

## Phase 2 — Draft

Before drafting, ask: **what does a reviewer need in order to engage with this PR?** That answer drives the title and the Summary bullets — not the commit log.

Title:
- 1 commit on branch → use the commit subject verbatim (already curated).
- 2+ commits → synthesize from the **cumulative diff**, not the last commit. ≤70 chars. Imperative mood. No trailing period. No issue numbers unless the user added them.

Body — exactly this template:

```
## Summary
- <bullet 1: what changed and why, grounded in the diff>
- <bullet 2>
- <bullet 3 — optional>

## Test plan
- [ ] <concrete check tied to a changed file/path>
- [ ] <concrete check>
```

Summary rules:
- 1–3 bullets. Each names a concrete area (file, module, behavior). No "various improvements" / "refactoring" / "cleanup."
- Lead with WHY when the diff alone doesn't reveal it.

Test plan rules:
- Items must be checkable by a reviewer (run X, click Y, hit endpoint Z). Not "tests pass."
- If you genuinely can't form a test plan from the diff (docs-only, config-only), write one bullet: `- [ ] Visual review of <file>` and stop.

Draft flag — open as draft if any commit subject contains `WIP`, `wip`, `draft`, or `[WIP]`, OR if the user asked for a draft.

## Phase 3 — Confirm (mandatory gate)

Show the user:

```
Base: <base-branch>
Branch: <current-branch>     [will push with -u]   ← only if no upstream
Draft: yes/no
Title: <title>

Body:
<body>

Open PR? (y / edit / cancel)
```

- `y` → Phase 4
- `edit` → ask what to change, redraft, show again
- `cancel` → stop

Do not skip this gate even if the user said "open a PR" — the title and body are your synthesis, not theirs.

## Phase 4 — Push & Create

If no upstream: `git push -u origin <branch>`. If push fails (non-fast-forward, protected branch), surface the error — do **not** force-push.

Then:

```bash
gh pr create \
  --base <base> \
  --title "<title>" \
  [--draft] \
  --body "$(cat <<'EOF'
<body>
EOF
)"
```

Always use a HEREDOC for `--body` to preserve newlines and checkbox syntax. After success, print the PR URL from stdout.

## NEVER

- **NEVER derive the title from only the latest commit when the branch has multiple commits**
  **Instead:** Synthesize from `git diff <base>...HEAD`.
  **Why:** Mid-branch commits like "fix typo" or "address review" become misleading PR titles that hide the real change.

- **NEVER skip the confirmation gate**
  **Instead:** Show title + body and wait for `y / edit / cancel`.
  **Why:** PRs are visible to teammates and trigger notifications/CI. The synthesis is yours, not the user's — they need to see it before it ships.

- **NEVER assume the base branch is `main`**
  **Instead:** Read it from `gh repo view --json defaultBranchRef`.
  **Why:** Repos using `master`, `develop`, or `trunk` get PRs targeted at a non-existent or wrong branch and fail or merge into the wrong place.

- **NEVER force-push to make `gh pr create` succeed**
  **Instead:** Surface the push error to the user and let them decide.
  **Why:** A non-fast-forward error usually means upstream has commits the user hasn't seen — force-pushing destroys them.

- **NEVER write generic boilerplate in Summary ("various improvements", "refactoring", "cleanup")**
  **Instead:** Name the concrete files/modules/behaviors from the diff.
  **Why:** Reviewers skim the Summary to decide whether to engage. Boilerplate trains them to skip your PRs.

- **NEVER open a PR against a protected branch you can't target**
  **Instead:** If `gh pr create` fails with a permission/protection error, surface it; ask whether to retarget or open from a fork.
  **Why:** Protected branches reject PRs from contributors without write access, and `gh`'s error wording ("GraphQL: ...") is opaque — translating it saves the user a confused debug loop.

- **NEVER use two-dot `git diff <base>..HEAD`**
  **Instead:** Use three dots: `git diff <base>...HEAD`.
  **Why:** Two-dot includes upstream changes the branch hasn't merged yet, polluting the diff. Three-dot shows only what the branch added since merge-base.
