---
name: release
description: Cut a versioned release for a project — bump the manifest version (semver major/minor/patch, default minor), commit, create an annotated git tag, and generate release notes from commits since the last tag. Use when the user says "cut a release", "release this", "tag a release", "bump version", "publish a new version", "/release", "/release patch", "/release major", or asks to ship a new version. Supports package.json, pyproject.toml, Cargo.toml, plain VERSION files, and Claude Code plugin marketplaces (diff-driven per-plugin bumps via .claude-plugin/marketplace.json + plugins/*/.claude-plugin/plugin.json). Skip for unreleased prototypes with no prior tag history if the user only wants a changelog (use a changelog tool instead) and for workspace-style monorepos (Nx, Turborepo, Cargo workspaces) where each package publishes independently.
---

# Release

Phased workflow. Do not skip phases. Each phase has an explicit exit condition; if it fails, stop and surface to the user — do not paper over.

**Bump type from args**: `major` | `minor` | `patch`. Default `minor` if no arg passed.

---

## Phase 1 — Preflight

Exit condition: working tree is clean, on the release branch, and the last tag is identifiable (or confirmed-absent).

Run in parallel:

```
git status --porcelain
git rev-parse --abbrev-ref HEAD
git describe --tags --abbrev=0 2>/dev/null || echo "NO_PRIOR_TAG"
git remote -v
```

Then:

1. **Dirty tree** (`git status --porcelain` non-empty) → STOP. Show the user the dirty files and ask whether to stash, commit separately, or abort. Do not auto-stash.
2. **Branch check** — if not on `main` / `master` / `release/*`, ask the user to confirm before continuing. Releasing from a feature branch is almost always a mistake.
3. **No prior tag** — note it; release notes will use "all commits" as the range. Do not invent a baseline tag.
4. **Detect manifest** (first match wins, in this order):
   - `package.json` → Node
   - `pyproject.toml` → Python (look for `[project] version` or `[tool.poetry] version`)
   - `Cargo.toml` → Rust (`[package] version`)
   - `VERSION` (plain text, single semver line) → generic
   - `.claude-plugin/marketplace.json` → Claude Code plugin marketplace. **MANDATORY — READ [`references/claude-plugin-marketplace.md`](references/claude-plugin-marketplace.md)** before Phase 2; this layout has multiple version fields and a diff-driven bump rule that the default single-manifest flow gets wrong.
   - None found → STOP and ask the user where the version lives.

State the detected manifest, current version, and last tag back to the user before proceeding.

---

## Phase 2 — Compute next version

Exit condition: a single `NEXT_VERSION` string ready to write.

Parse current version as `MAJOR.MINOR.PATCH` (strip leading `v` if present in tag, never in manifest). Drop any pre-release/build suffix and warn the user that it's being dropped.

Apply standard semver: major resets minor+patch, minor resets patch.

Verify the resulting tag does not already exist:

```
git rev-parse v$NEXT_VERSION 2>/dev/null && echo "TAG_EXISTS"
```

If it exists → STOP. The user must either pick a different bump or delete the stale tag deliberately.

---

## Phase 3 — Write manifest + lockfile sync

Exit condition: manifest shows `NEXT_VERSION`; lockfile (if any) is consistent.

- **package.json**: prefer `npm version $NEXT_VERSION --no-git-tag-version` (also updates `package-lock.json`). For pnpm: `pnpm version $NEXT_VERSION --no-git-tag-version`. For yarn: `yarn version --new-version $NEXT_VERSION --no-git-tag-version`. Detect from lockfile presence (`pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`). If no JS package manager is on PATH, edit `package.json` directly via Edit and warn the user that the lockfile will be out of sync until they run their installer locally.
- **pyproject.toml**: edit the `version = "..."` line directly via Edit. Do not run `poetry version` blindly — it picks up from cwd and may surprise.
- **Cargo.toml**: edit `version = "..."` under `[package]`. Run `cargo update -p <pkgname> --precise $NEXT_VERSION` only if `Cargo.lock` exists and the user confirms.
- **VERSION**: overwrite with `NEXT_VERSION\n`.
- **Claude plugin marketplace**: follow [`references/claude-plugin-marketplace.md`](references/claude-plugin-marketplace.md). Bump only changed plugins; show the full bump table before staging.

Show the diff to the user before staging.

---

## Phase 4 — Generate release notes

Exit condition: a notes string ready to use as the tag annotation and shown to the user.

Range:
- If prior tag exists: `LAST_TAG..HEAD`
- Else: all commits (`git log --reverse`)

Group by conventional-commit prefix when commits use them; fall back to a flat list when they don't. Detect: if ≥50% of the first 20 non-merge subjects match a conventional-commit prefix (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `perf:`, `test:`, `build:`, `ci:`) → group; else flat list.

**If conventional commits detected**, emit:

```
## vNEXT_VERSION (YYYY-MM-DD)

### Features
- <subject> (<short-sha>)

### Fixes
- ...

### Other
- ...  # chore/docs/refactor/etc collapsed here
```

**If not detected**, emit a flat list:

```
## vNEXT_VERSION (YYYY-MM-DD)

- <subject> (<short-sha>)
- ...
```

Use:

```
git log $RANGE --pretty=format:'%s|%h|%an' --no-merges
```

Skip merge commits. Do not include author emails. Do not invent groupings the commits don't support.

Show the notes to the user. Ask: `(a)ccept / (e)dit / (q)uit`. On `e`, open the user's editor or accept inline edits.

---

## Phase 5 — Commit, tag, and push gate

Exit condition: local commit + annotated tag exist; remote push is **explicitly authorized** by the user.

Run sequentially (each must succeed before the next):

```
git add <manifest> <lockfile-if-any>
git commit -m "chore(release): vNEXT_VERSION"
git tag -a vNEXT_VERSION -m "<release notes>"
```

Tag prefix is `v` (e.g. `v1.4.0`). The manifest stays unprefixed.

**STOP before pushing.** Show:

```
Local release ready:
  commit: <sha> chore(release): vNEXT_VERSION
  tag:    vNEXT_VERSION

To publish:
  git push --follow-tags

Push now? (y/N)
```

Only run `git push --follow-tags` on explicit `y`. Default is no-push so the user can review or amend.

---

## NEVER

- **NEVER push the tag without explicit user confirmation in this turn**
  **Instead:** Stop after creating the local tag and ask. A prior session's "yes" doesn't carry forward.
  **Why:** Tags pushed to shared remotes are effectively immutable — collaborators, CI, and package registries may pick them up within seconds. Rolling back means a force-delete on the remote and a new tag, which breaks anyone who already pulled.

- **NEVER bump and tag with a dirty working tree**
  **Instead:** Stop in Phase 1, surface dirty files, let the user resolve.
  **Why:** The release commit silently absorbs unrelated changes; the tag then points at code that doesn't match the user's mental model of "what shipped in this version."

- **NEVER reuse or overwrite an existing tag**
  **Instead:** Stop in Phase 2 when the target tag exists; require deliberate user action.
  **Why:** Re-tagging poisons caches in registries (npm, crates.io), CI artifact stores, and downstream consumers' lockfiles. The original tag may already be deployed.

- **NEVER fabricate release notes or invent conventional-commit groupings the log doesn't support**
  **Instead:** Use the actual subject lines; fall back to a flat list when commits aren't conventional.
  **Why:** Synthetic notes mislead users about what changed and erode trust in every future release note this skill produces.

- **NEVER edit the manifest without also syncing the lockfile**
  **Instead:** Use the package manager's `version` subcommand when available (`npm version`, `pnpm version`), or run the lockfile update explicitly.
  **Why:** A version-bump commit with an out-of-sync lockfile breaks `npm ci` / `pnpm install --frozen-lockfile` in CI immediately after the tag is cut.

- **NEVER use `git tag` (lightweight) instead of `git tag -a` (annotated)**
  **Instead:** Always `git tag -a vX.Y.Z -m "<notes>"`.
  **Why:** Lightweight tags have no author, date, or message — release notes vanish, and `git describe` behaves inconsistently.

- **NEVER bump a `marketplace.json` without auditing every per-plugin `plugin.json`**
  **Instead:** Always run the diff-driven sweep from `references/claude-plugin-marketplace.md`. Bump every changed plugin alongside the marketplace.
  **Why:** Claude Code's plugin updater reads each plugin's own `version`, not the marketplace version. A marketplace-only bump ships a release that's invisible to users — this is the v0.12.0 → v0.12.1 churn that motivated this rule.

- **NEVER bump a per-plugin `plugin.json` whose code didn't change since `LAST_TAG`**
  **Instead:** Run `git diff --name-only $LAST_TAG..HEAD -- plugins/<name>/ ':!plugins/<name>/.claude-plugin/plugin.json'` per plugin; bump only those with non-empty output. The marketplace-level bump is separate and always happens.
  **Why:** Bumping unchanged plugins forces consumers to re-download them, pollutes their changelog with empty releases, and makes "what actually changed in v0.X" un-answerable from version numbers alone.

- **NEVER skip a phase because "the repo looks fine"**
  **Instead:** Run preflight every time; cheap checks catch the dirty-tree / wrong-branch / existing-tag cases that cost the most to undo.
  **Why:** The cost asymmetry is enormous — a 2-second `git status` versus a force-pushed bad tag.
