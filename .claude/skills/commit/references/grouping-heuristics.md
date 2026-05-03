# Grouping Heuristics

How to draw commit boundaries that match how a careful human would split the work. Use the signals below; resolve ties with the priority rules at the bottom.

---

## Strong signals (group these together)

### 1. Test + implementation pair
`foo.ts` and `foo.test.ts` (or `foo.spec.ts`, `__tests__/foo.ts`, `foo_test.go`, `test_foo.py`) — same commit, always. A test that lands one commit later than its impl breaks `git bisect`.

### 2. Rename + edit
A file shows up as `R` (rename) plus content changes. Keep the rename and the edits to the renamed file in the same commit. Splitting them confuses `git log --follow`.

### 3. Schema/migration + the code that reads it
A new migration file plus the model/query/type that uses the new column. Splitting them produces an intermediate commit where the column exists but no code reads it (or worse, code references a column that doesn't exist yet).

### 4. Generated file + its source
`schema.ts` regenerated from a `.prisma` / `.graphql` / `.proto` change. Always with the source. A regenerated artifact alone is meaningless.

### 5. Lockfile + manifest
`package.json` + `package-lock.json` / `bun.lockb` / `pnpm-lock.yaml` / `Cargo.lock` / `uv.lock`. Always together. A manifest change without its lockfile breaks installs for everyone else.

### 6. Shared module + its first consumer
A new utility/component plus the place that introduced the need for it. If multiple consumers are added at once, the utility goes in the *first* commit; the rest can follow.

### 7. Co-located feature directory
`src/features/billing/*` — files inside one feature directory that all changed for the same reason are usually one commit. Cross-directory changes that share a feature theme can also belong together (e.g. `db/billing.ts` + `api/billing.ts` + `ui/Billing.tsx`).

### 8. Import graph adjacency
File A imports from file B and both changed. Strong hint they belong together — unless B is a foundational shared module also touched by other groups.

---

## Splitting signals (these likely belong in DIFFERENT commits)

### 1. Different feature directories with no import edge
`src/features/billing/*` and `src/features/auth/*` changed but nothing imports across — almost always two commits.

### 2. Layer change without a feature theme
A pure formatting pass across 40 files, a dependency bump, a tsconfig tweak. Belongs in its own "chore" commit, separate from feature work.

### 3. Drive-by edits
A typo fix or unrelated cleanup discovered while doing the main work. Its own commit (`fix: typo in error message`), not folded in.

### 4. Different reasons for change
Two edits to the same file for unrelated reasons → consider `git add -p` to stage hunks separately. Only do this if the hunks are clearly independent and the user agreed; otherwise commit the file once with a message that names both.

---

## Cross-layer feature slice vs. layer-by-layer

Two valid groupings for the same change set:

- **Vertical slice (per feature):** `db/x.ts` + `api/x.ts` + `ui/X.tsx` in one commit, then the next feature's slice. Good when each feature is self-contained and the slices are small (~5-10 files each).
- **Horizontal layer (per layer):** all `db/*` first, then all `api/*`, then all `ui/*`. Good when changes are large per layer, or when a single migration underpins several features.

**Default:** vertical slice. Use horizontal layering only when (a) a single schema change supports multiple features, or (b) the layers were *literally* built in that order (db landed days ago, ui just finished).

Ask the user if it's ambiguous — they know the development order; you don't.

---

## Tie-breakers

When a file plausibly fits two groups:

1. Which group does it *import from*? Goes with that group.
2. Which group's tests cover it? Goes with that group.
3. If still tied, ask the user. Don't guess on a 50/50.

---

## Anti-patterns (do not do these)

- **Alphabetical / by file path** — produces commits that are syntactically grouped but semantically random.
- **N files per commit** — same problem; arbitrary boundaries that hide intent.
- **By file extension** — "all `.ts` then all `.tsx`" splits feature work that belongs together.
- **One file per commit** — micro-commits for a 30-file change are noise; reviewers can't see the shape of the change. Aim for 3-8 files per commit as a soft target, more if cohesive.
- **Mega-commit + cleanup commits** — "do everything, then split with `git reset`" works mechanically but loses the layer-by-layer story this skill exists to produce.

---

## Soft size targets

- **Sweet spot:** 3-8 files per commit, all clearly related.
- **Acceptable up to ~20 files:** if they're a single coherent rename, codegen, or feature slice.
- **Over 20 files:** strong hint to split further — find the natural seam (impl vs. tests, feature A vs. feature B, layer vs. layer).
- **Single-file commits:** fine for genuinely standalone changes (a dependency bump, a typo, a config tweak); avoid splitting a feature into one-file-per-commit.

These are guidelines. A 50-file rename across the codebase is one commit; a 5-file change spanning three unrelated features is three commits.
