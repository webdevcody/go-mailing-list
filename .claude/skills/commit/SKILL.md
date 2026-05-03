---
name: commit
description: Split a working tree with many changed files into multiple logically-grouped commits instead of one mega-commit. Groups files by relatedness (shared module, feature slice, layer, test+impl pairs, rename+edit pairs) and orders commits so each one builds on its own (schema → backend → frontend; deps before consumers). Use when the user says "commit these changes", "make multiple commits", "split this into commits", "clean commit history", "commit by feature", "commit in groups", "/commit", "stack these commits", "don't make one big commit", or when `git status` shows many unrelated files staged for one commit. Skip for: single-file changes, commits the user has already staged with `git add`, or when the user explicitly asks for one commit.
---

> **User-question protocol:** Whenever this skill needs the user to pick between options, confirm an action, or answer a multiple-choice prompt, you MUST call the `AskUserQuestion` tool to render a proper interactive picker. Do NOT print numbered options as plain text and wait for the user to type a number — that produces a degraded UX. Free-form questions (open-ended typing) may be asked in prose, but any time you would write "1) … 2) … 3) …", use `AskUserQuestion` instead.


# agentsystem-commit

Turn a sprawling working tree into a clean sequence of small, related commits — the way a careful human would commit layer-by-layer or feature-by-feature, not one 100-file dump.

The goal is a commit log a reviewer can read top-to-bottom and a `git bisect` can land on a buildable commit. Granularity is judgment; safety is mechanical.

---

## When NOT to run

- Working tree has fewer than ~5 changed files → just one commit is fine.
- The user already ran `git add` to stage a specific subset → respect their intent; commit what's staged.
- The user asked for "amend" or "fixup" → different workflow, not this skill.

---

## Workflow

### Phase 1 — Inventory

Run these in parallel and read all output before grouping:

```
git status --porcelain=v1
git diff --stat
git diff --cached --stat
git log -n 5 --oneline             # commit message style
git stash list                      # is anything stashed?
```

**Exit condition:** you have a complete file list with status (M/A/D/R/??), and you know the repo's commit message convention (Conventional Commits? plain imperative? prefix tags?).

If anything is already staged, decide: include it in the first group, or `git reset` to start clean? Default: `git reset` so grouping is uniform — but tell the user before doing it.

### Phase 2 — Group

**MANDATORY — READ [`references/grouping-heuristics.md`](references/grouping-heuristics.md)** before drawing group boundaries. It catalogs the relatedness signals (shared imports, feature-directory cohesion, test+impl, rename+edit, config+consumer, parallel cross-layer slices) and the anti-patterns (alphabetical splits, N-files-per-commit splits).

Produce a draft grouping as a numbered list. For each group:

```
Group N — <one-line theme>
  Files:
    path/to/file.ts
    path/to/file.test.ts
  Rationale: <why these belong together>
  Depends on: Group <M> | none
```

**Show the grouping to the user and wait for approval before staging anything.** This is the only judgment-heavy step; do not skip the checkpoint.

If the user says "looks good" → proceed. If they edit groups → redraw and re-show.

### Phase 3 — Order

Topologically sort the groups by the `Depends on` field. Tie-breakers, in order:

1. Schema/migrations first.
2. Shared types/utilities second.
3. Backend/server logic third.
4. Frontend/UI fourth.
5. Tests alongside the layer they cover (not last as a lump).
6. Pure formatting/lint/chore commits last.

Each commit, in isolation, should leave the tree buildable. If reordering would break that, merge the two groups.

### Phase 4 — Commit each group

Run each git command below as a **separate Bash tool call** — do not chain with `&&` or `;`. Claude Code's safety check interrupts chained commands mid-flow, leaving the index in a partial state (e.g. reset done, add not done).

For each group in order:

1. `git reset` to clear any prior staging from this run.
2. `git add -- <exact paths>` (never `git add -A`, never `git add .`).
3. `git status` — verify only the intended files are staged. If a file shows partially staged or unexpected, stop and consult [`references/recovery.md`](references/recovery.md) § "I accidentally `git add -A`'d and staged something I shouldn't".
4. `git diff --cached --stat` — sanity-check the size.
5. Compose the message in the repo's style (from Phase 1 `git log` sample). One-line subject; body only if the *why* is non-obvious.
6. Commit with a HEREDOC:

   ```
   git commit -m "$(cat <<'EOF'
   <subject>

   <optional body>
   EOF
   )"
   ```

7. `git status` — confirm the working tree shrank by exactly that group.

If a pre-commit hook fails: do **not** `--no-verify` and do **not** `--amend`. Fix the issue, re-stage the group, make a new commit. (See [`references/recovery.md`](references/recovery.md) if anything goes sideways. **Do NOT load `recovery.md` on the happy path** — only when a step fails or the user wants to abort.)

### Phase 5 — Verify

After the last group:

```
git status                # must be clean (or only the deliberately-skipped files remain)
git log --oneline -n <N>  # show the chain back to the user
```

Tell the user how many commits landed and what's still uncommitted (if anything).

---

## NEVER

- **NEVER run `git add -A` or `git add .`**
  **Instead:** `git add -- <explicit paths>` for each group. **Exception:** `git add -p <path>` for hunk-level staging is allowed when one file mixes concerns and the user has approved the split (see `references/grouping-heuristics.md` § "Different reasons for change").
  **Why:** Bulk-add sweeps in untracked files (`.env`, scratch files, editor backups, partially-finished work) and silently merges groups you meant to keep apart.

- **NEVER use `git commit --amend` to "fix" the previous commit**
  **Instead:** Make a new commit. If the user later wants to squash, they'll ask.
  **Why:** Amending after a hook failure can destroy work — the failed commit didn't happen, so `--amend` rewrites the *prior* commit instead. And amending a commit that's already shown to the user changes history without their consent.

- **NEVER pass `--no-verify` to skip hooks**
  **Instead:** Read the hook's error, fix the underlying issue, re-stage, re-commit.
  **Why:** Hooks encode the team's invariants (lint, types, secret scanning). Bypassing them ships broken or unsafe code under your name.

- **NEVER split arbitrarily — alphabetical, N-files-per-commit, by directory depth**
  **Instead:** Group by the relatedness signals in `references/grouping-heuristics.md`.
  **Why:** Arbitrary splits produce non-buildable intermediate commits and a log that tells no story — worse than one mega-commit because it implies intent that isn't there.

- **NEVER stage files you can't justify in the group's rationale**
  **Instead:** If a file doesn't fit any group, ask the user what it is before committing it.
  **Why:** Mystery files are usually accidental — debug prints, stray edits, files from a different task. Committing them silently buries the question.

- **NEVER commit before showing the grouping plan in Phase 2**
  **Instead:** Wait for explicit approval, then commit.
  **Why:** Grouping is the only step the user has strong opinions about. Skipping the checkpoint forces a `git reset --soft HEAD~N` recovery if they disagree.

- **NEVER `git stash` to "clean up" before committing**
  **Instead:** Leave the working tree alone; stage only what each group needs.
  **Why:** Stashes get forgotten. The working tree is the source of truth for what needs committing.

---

## Output to the user

At the end, a short summary:

```
Committed N groups:
  1. <subject>          (<file count> files)
  2. <subject>          (<file count> files)
  ...
Working tree: clean | <K> files still uncommitted (<reason>)
```

Don't paste full diffs back. The user has `git log` and `git show`.
