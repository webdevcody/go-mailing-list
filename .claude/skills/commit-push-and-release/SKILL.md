---
name: commit-push-and-release
compatibility: Requires git, gh, and a remote named `origin`
description: One-shot ship workflow on `main` — delegate to the `commit-and-push` skill (group commits, push branch), then delegate to the `release` skill with a default minor version bump, then push the new tag to origin. Use when the user says "commit push and release", "/commit-push-and-release", "ship and release", "commit then release", or wants to publish working-tree changes AND cut a versioned release in a single step. Aborts on a clean working tree (nothing to commit) and aborts when the current branch is not `main`. Skip for: feature-branch work (releases here only cut from `main`), commit-only or release-only flows (use `commit-and-push` or `release` directly), major/patch bumps requested without arg (default is minor — pass an explicit arg or invoke `release` directly), and amend/force-push workflows.
---

> **User-question protocol:** Whenever this skill needs the user to pick between options, confirm an action, or answer a multiple-choice prompt, you MUST call the `AskUserQuestion` tool to render a proper interactive picker. Do NOT print numbered options as plain text and wait for the user to type a number — that produces a degraded UX. Free-form questions (open-ended typing) may be asked in prose, but any time you would write "1) … 2) … 3) …", use `AskUserQuestion` instead.


# commit-push-and-release

Three phases, in order, on `main` only: (1) commit + push via `commit-and-push`, (2) cut release via `release` with a minor bump, (3) push the new tag.

---

## Phase 0 — Preflight

Run before doing anything else:

```bash
git rev-parse --abbrev-ref HEAD
git status --porcelain
```

Exit conditions:
- Branch is **not `main`** → abort. Tell the user "this skill only releases from `main`; current branch is `<branch>`" and stop. Do not switch branches.
- Working tree is **clean** (porcelain output empty) → abort. Tell the user "nothing to commit; not releasing" and stop. Do not cut a release-only — that's what `/release` is for.

Both conditions must pass to proceed.

---

## Phase 1 — Commit and push

Invoke the `commit-and-push` skill. Do NOT re-implement its commit grouping or push logic.

Exit conditions:
- **Commits created and pushed** → proceed to Phase 2.
- **`commit-and-push` aborted or errored** → stop. Do not release a partial state. Surface the error verbatim.

After this phase, the new commits MUST be on `origin/main` before Phase 2 runs. If the push appeared to succeed but `git rev-parse origin/main` does not match `HEAD`, stop and report — do not tag a commit that isn't on the remote.

---

## Phase 2 — Cut the release

Before invoking `release`, ask: is `HEAD` on `origin/main`? If not, stop — Phase 1 didn't actually publish.

Invoke the `release` skill with a **minor** version bump (its default). Do not pass `major` or `patch`. If the user wanted a different bump, they should invoke `/release` directly.

The `release` skill owns: manifest version bump, release commit, annotated tag, release notes from commits since the last tag.

Exit conditions:
- **Release committed and tagged locally** → proceed to Phase 3.
- **`release` skill aborted or errored** → stop. The Phase 1 commits are already pushed; do not retry Phase 1. Surface the error and let the user decide.

---

## Phase 3 — Push tags

```bash
git push                # release commit on main
git push --tags         # the new annotated tag (and any other unpushed tags)
```

If `git push` is rejected non-fast-forward, stop and surface the rejection verbatim — do not force, do not auto-pull. The user will resolve and re-invoke.

Report on success: the new version, the tag name, and that both branch and tags are on origin.

---

## NEVER

- **NEVER run on a branch other than `main`**
  **Instead:** Abort in Phase 0 with the current branch name. Do not auto-switch to `main`.
  **Why:** Releases in this project cut from `main` only. Auto-switching could discard uncommitted work on the feature branch or release a commit the user didn't intend.

- **NEVER cut a release when there is nothing to commit**
  **Instead:** Abort in Phase 0. If the user genuinely wants a release-only with no new commits, they should invoke `/release` directly.
  **Why:** This skill's contract is "ship working-tree changes AND release." A clean tree means the user is in the wrong skill — silently falling through to release-only would publish a version the user didn't realize they were cutting.

- **NEVER skip Phase 3 (the tag push)**
  **Instead:** Always run `git push --tags` after Phase 2 succeeds.
  **Why:** The original failure mode this skill exists to prevent: `release` creates the tag locally, then it sits unpushed and CI/release automation never sees it. The whole point of bundling is closing this gap.

- **NEVER tag before the Phase 1 commits are confirmed on origin**
  **Instead:** Verify `origin/main` matches `HEAD` after Phase 1 before invoking `release` in Phase 2.
  **Why:** If Phase 1's push silently failed (network, hook rejection masked by exit code), tagging anyway points the tag at a commit that doesn't exist on the remote — release automation breaks and the tag has to be deleted and re-cut.

- **NEVER pass `--force` to either push in Phase 3**
  **Instead:** Surface non-fast-forward rejections and stop. The user pulls/rebases and re-invokes.
  **Why:** A force-push to `main` rewrites shared history. A force tag push silently overwrites a tag others may already have fetched.

- **NEVER accept a non-default version bump arg in this skill**
  **Instead:** This skill always invokes `release` with its default (minor). For major/patch, the user invokes `/release major` or `/release patch` directly after `/commit-and-push`.
  **Why:** Adding bump-arg passthrough creates two sources of truth for version policy and invites typos like `/commit-push-and-release minir`. Keeping this skill opinionated (minor only) makes the failure mode loud — the user must consciously choose the unbundled path for non-minor bumps.
