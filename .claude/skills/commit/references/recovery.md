# Recovery

When something goes wrong mid-sequence. Pick the section that matches the situation; don't run other commands speculatively.

---

## A pre-commit hook failed

The commit did **not** happen. The working tree and index are exactly as they were before `git commit`.

1. Read the hook's actual error output. Don't paraphrase.
2. Fix the underlying issue (lint error, type error, secret detected, etc.) by editing the offending file.
3. `git add -- <the same paths as before>` to re-stage (the fix is now part of the staging).
4. `git commit -m "..."` again with the same message.

**Do NOT** add `--no-verify`. **Do NOT** add `--amend` — there is nothing to amend; the prior commit (if any) is unrelated.

---

## I committed the wrong files into the last group

The commit landed but contains files that should have been in a later group, or vice versa.

If nothing has been pushed:

```
git reset --soft HEAD~1
```

This undoes the commit but keeps everything staged. Now `git reset` (mixed) to unstage, then re-stage the correct subset and re-commit. Repeat for the rest.

If multiple wrong commits in a row, count them: `git reset --soft HEAD~N`.

**Do not** use `--hard` — it deletes the working-tree changes.

---

## I accidentally `git add -A`'d and staged something I shouldn't

Before committing:

```
git restore --staged -- <path>     # unstage one file (keep the working-tree edits)
```

To unstage everything and start over:

```
git reset                          # unstage all; working tree untouched
```

---

## A commit's message is wrong (and it's the most recent, unpushed)

This is the one case `--amend` is appropriate — message-only fix on an unpushed commit:

```
git commit --amend -m "new message"
```

Only do this if you're certain nothing has been pushed and the user is okay with the rewrite.

---

## I'm lost — what state am I in?

```
git status                # staged / unstaged / untracked
git log --oneline -n 10   # recent commits this run
git reflog -n 20          # everything that's happened, including resets
```

`git reflog` is the safety net — every commit ref is recoverable from it for ~90 days, even after a `reset --hard`. If you've truly lost work, find the SHA in reflog and `git reset --hard <sha>` back to it. Confirm with the user first.

---

## The user wants to abort the whole multi-commit run

If commits N..HEAD were made by this run and need to go away (assuming nothing pushed):

```
git log --oneline -n <expected count>      # verify what's about to be removed
git reset --soft HEAD~<N>                  # undo commits, keep all changes staged
git reset                                  # unstage so user has a clean slate
```

Confirm the count with the user before running `reset`. Never run `reset --hard` as part of an abort — it deletes their work.
