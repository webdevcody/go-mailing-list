# Grouping Heuristics

Drawing commit boundaries on a sprawling working tree. The goal is a log that tells a true story — not the cleanest-looking one.

---

## Relatedness signals (group these together)

1. **Shared module / feature slice.** Files in the same feature directory (`src/features/billing/...`) usually move as a unit unless one is a cross-cutting refactor.
2. **Test + impl pairs.** `foo.ts` and `foo.test.ts` belong in the same commit. A reviewer running `git show <sha>` should see both.
3. **Rename + edit pairs.** `git status` shows `R foo.ts -> bar.ts` plus an edit — keep them together so `git log --follow` works.
4. **Config + consumer.** A new env var added to `.env.example` belongs with the code that reads it. A new dependency in `package.json` belongs with the file that imports it.
5. **Schema → derived types → data layer.** A migration, the regenerated types, and the repository/data-access edits are one chain. Don't split unless they were authored as independent steps.
6. **Cross-layer feature slice.** A new feature touching schema + server fn + UI is one *story*; if commits are small, group as schema-then-server-then-UI (three commits). If the slice is small, one commit is fine.

---

## Anti-signals (don't group these)

- **Same file, different concerns.** If one file mixes a bugfix and an unrelated feature, use `git add -p <file>` to stage hunks separately — but only after the user approves the split.
- **Same directory, different features.** Two unrelated features that happened to land in `src/components/` are two commits, not one.
- **"Drive-by" formatting.** A whitespace/lint sweep that touched 30 files alongside real changes belongs in its own chore commit at the end (or backed out entirely if not requested).

---

## Anti-patterns (don't ever do these)

- **Alphabetical splits** — "commits A-M" / "commits N-Z." Tells no story.
- **N-files-per-commit** — "5 files per commit." Produces non-buildable intermediates.
- **One-commit-per-file** — fragments a coherent change into noise.
- **By directory depth** — `src/` vs `tests/` vs `docs/` regardless of feature. Tests separated from impl break `git bisect`.

---

## Low-confidence fallback

If you cannot articulate a one-line rationale for a proposed group → the boundary is wrong.

**When grouping signal is weak, the rule is: merge, don't split.**

Concrete fallbacks:

- 2 candidate groups with overlapping rationale → 1 commit titled by the broader theme.
- A file you can't place in any group → ask the user before committing it. Mystery files are usually accidental (debug prints, stray edits, a different task's work).
- Whole working tree feels like "one feature with scaffolding" → 1 commit is the right answer. Don't manufacture a chain.

A commit log of 3 honest commits is better than 8 commits where 5 are guesses.

---

## Commit subject style

Match the repo's existing convention (read `git log -n 10 --oneline` first). Common conventions:

- **Conventional Commits:** `feat(scope): subject` / `fix: subject`
- **Plain imperative:** `Add billing webhook handler`
- **Prefix tags:** `[billing] Add webhook handler`

Don't switch styles mid-branch. If the repo uses Conventional Commits, all commits in this run use Conventional Commits.

Subject ≤72 chars. Imperative mood. No trailing period. Body only when the *why* is non-obvious from the diff.
