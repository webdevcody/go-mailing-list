---
name: upgrade-deps
description: Pre-release dependency upgrade workflow. Detects the project's package managers from lockfiles (any ecosystem — npm, pnpm, yarn, bun, pip, poetry, cargo, go mod), groups outdated packages by risk tier (security advisory / patch / minor / major), checks the target version itself for advisories before bumping, batches patch+minor into one commit, and gates each major behind per-package user approval with a risk briefing. One forward commit per tier so `git revert <sha>` cleanly rolls back; tests run between groups and a red run halts the workflow. Use when the user says "upgrade dependencies", "bump deps", "/upgrade-deps", "update packages", "patch security advisories", or asks to refresh the lockfile before a release. Natural pre-step to /release. Skip for: single-package upgrades (just edit + install) and lockfile-only refreshes with no version changes.
---

> **User-question protocol:** Whenever this skill needs the user to pick between options, confirm an action, or answer a multiple-choice prompt, you MUST call the `AskUserQuestion` tool to render a proper interactive picker. Do NOT print numbered options as plain text and wait for the user to type a number — that produces a degraded UX. Free-form questions (open-ended typing) may be asked in prose, but any time you would write "1) … 2) … 3) …", use `AskUserQuestion` instead.


# Upgrade Deps

Phased workflow. Do not skip phases. Each phase has an explicit exit condition; if it fails, stop and surface to the user — do not paper over.

The goal is **clean rollback granularity**, not maximum throughput. One forward commit per risk tier. Tests between every group. No major lands without per-package approval.

---

## Phase 1 — Detect

Exit condition: a list of `(ecosystem, manifest, lockfile, package-manager)` tuples and a known test+build command for the project.

Detect by lockfile presence at the repo root (or at the cwd if it's a workspace subdir):

| Lockfile | Ecosystem | Manager |
|---|---|---|
| `package-lock.json` | Node | npm |
| `pnpm-lock.yaml` | Node | pnpm |
| `yarn.lock` | Node | yarn |
| `bun.lockb` / `bun.lock` | Node | bun |
| `poetry.lock` | Python | poetry |
| `Pipfile.lock` | Python | pipenv |
| `uv.lock` | Python | uv |
| `Cargo.lock` | Rust | cargo |
| `go.sum` | Go | go mod |
| `Gemfile.lock` | Ruby | bundler |
| `composer.lock` | PHP | composer |

Multiple ecosystems → run the workflow once per ecosystem, sequentially. Do not interleave.

**Monorepo / workspace check** — if the repo is a monorepo (workspace lockfile at root + `packages/*`, `apps/*`, Cargo workspace `members`, Go workspace `go.work`, etc.), confirm with the user whether to upgrade root-only or scope to a specific workspace before continuing.

**Test+build discovery** (in this order):
1. `package.json` `scripts.test` / `scripts.build`
2. `Makefile` targets `test` / `build` / `check`
3. `pyproject.toml` `[tool.poetry.scripts]` or known runner (`pytest`, `pdm run test`)
4. `Cargo.toml` → `cargo test` / `cargo build`
5. `go.mod` → `go test ./...` / `go build ./...`

If no test command is discoverable, **STOP and ask the user before running any upgrade**. A skill that bumps deps without a test gate is worse than useless.

State the detected ecosystems, package managers, and test command back to the user. Confirm before continuing.

---

## Phase 2 — Audit

Exit condition: a single table per ecosystem with one row per outdated or advisory-flagged package: `name, current, wanted, latest, tier, advisory`.

For each ecosystem, run the outdated + advisory commands. **MANDATORY — READ [`references/package-managers.md`](references/package-managers.md)** for the exact commands and output-parsing notes for the detected ecosystem(s). Do NOT load that file for ecosystems that aren't present.

Tier assignment:

- **ADVISORY** — package has a known vulnerability at the current version, regardless of semver gap. Highest priority.
- **PATCH** — `current` and `latest` differ only in the patch component (`1.2.3 → 1.2.9`).
- **MINOR** — differ in minor (`1.2.3 → 1.5.0`), major equal.
- **MAJOR** — major differs (`1.2.3 → 2.0.0`). For `0.x` packages, treat any minor bump as MAJOR — `0.x` versions are pre-stable and minor bumps routinely break.

**Pre-bump advisory check on the target version** — for every proposed upgrade, query the advisory database for the *target* version too. If the target itself has an open advisory, downgrade to the lowest version that (a) satisfies the bump direction and (b) has no advisory. If no clean version exists in tier, surface that fact and let the user decide.

Show the table to the user. Counts per tier. Do not proceed until acknowledged.

---

## Phase 3 — Plan

Exit condition: user has approved the upgrade plan and the order it will execute in.

Order is fixed:

1. **ADVISORY** group — all advisory-flagged packages, upgraded to the lowest non-vulnerable version that satisfies the original semver range when possible. May contain majors; flag them but do not gate them per-package — security work is the whole point of this group.
2. **PATCH+MINOR batch** — single commit. Safe by semver contract.
3. **Each MAJOR**, one at a time, per-package approval (see Phase 5).

Tell the user: "I'll do these as N commits: 1 for advisories, 1 for patch+minor, then 1 per approved major." Get explicit go-ahead before Phase 4.

---

## Phase 4 — Apply ADVISORY and PATCH+MINOR groups

For each group, in order:

1. Run the manager's targeted upgrade commands (see references file).
2. Run the test+build command discovered in Phase 1.
3. **If tests fail** → STOP. Show the failing output. Offer: `(r)evert this group / (i)nvestigate / (q)uit`. Do not proceed to the next group on red. On revert: `git checkout -- <manifest> <lockfile>` and reinstall to restore the previous lockfile.
4. **If tests pass** → stage the manifest + lockfile only, commit:
   - Advisory: `chore(deps): patch security advisories (<N> packages)`
   - Patch+minor: `chore(deps): bump patch+minor (<N> packages)`
5. Show the commit sha and the package list in the message body.

Do not combine groups into one commit even if both are small. The whole point is independent revertability.

---

## Phase 5 — Per-major approval loop

For each MAJOR package, in order (alphabetical for determinism):

**Build the briefing:**

- `current → target` versions
- **Breaking changes** — fetch the package's CHANGELOG / release notes. For npm: `https://github.com/<repo>/releases` or `https://www.npmjs.com/package/<name>` linked changelog. For other ecosystems: equivalent registry page. If unavailable, say so explicitly — do not invent.
- **Advisory status** at the target version
- **Downstream consumers in this repo** — grep for imports of the package; report file count and a few representative paths. A package imported in 80 files is a different decision than one imported in 2.
- **Peer-dependency ripples** — does the new major require a new major of a peer (React, TypeScript, etc.)? Surface it.

Present the briefing, then ask: `(y)es upgrade / (s)kip / (q)uit remaining majors`.

On `y`:
1. Run the targeted upgrade command for that single package.
2. Run tests+build.
3. On red: STOP. Offer `(r)evert this major / (i)nvestigate / (q)uit`. Do not auto-revert silently.
4. On green: commit `chore(deps): bump <pkg> <current> → <target> (major)` with the breaking-change summary in the body.

On `s`: log the skip; move on.
On `q`: skip all remaining majors; jump to Phase 6.

One commit per approved major. Never batch majors together — the whole point is that `git revert <sha>` cleanly removes one major's risk.

---

## Phase 6 — Report

Print a one-paragraph summary: counts per group with their commit shas, list of skipped majors, and any reverted groups. Suggest `/release` if the run ended cleanly.

---

## NEVER

- **NEVER batch a major into the patch+minor commit, even if it "looks safe"**
  **Instead:** Each major is its own commit, gated by Phase 5 per-package approval.
  **Why:** The whole skill exists for clean rollback. A single mixed commit means reverting a regression also reverts unrelated patches and security fixes — the user has to cherry-pick by hand under time pressure.

- **NEVER auto-approve a major, even when the user said "upgrade everything"**
  **Instead:** Per-major briefing + `(y)es / (s)kip / (q)uit`. "Everything" means "walk me through everything," not "skip the gate."
  **Why:** Majors break by definition. Skipping the gate trades a 30-second briefing for hours of post-merge incident response, and the user has no way to know what was about to land.

- **NEVER skip the test+build run between groups**
  **Instead:** Run the discovered test command after every group, halt on red.
  **Why:** Without a green checkpoint per tier, a failure surfaces several commits later and you can't tell which tier caused it. The clean-rollback property is destroyed and the skill becomes worse than `npm update`.

- **NEVER upgrade to a target version without checking that target for advisories**
  **Instead:** Phase 2 queries advisories for both current and target; pick the lowest non-vulnerable version in-tier.
  **Why:** Advisory databases publish faster than registries can yank. Bumping `lodash 4.17.20 → 4.17.21` to "patch a CVE" while a fresh CVE exists on 4.17.21 is the exact failure mode security-conscious users are running this skill to avoid.

- **NEVER use a blanket `npm update` / `pnpm update` / `cargo update` without scoping to the planned package list**
  **Instead:** Pass explicit package names (and `--save-exact` or `--precise` where the manager supports it) so the lockfile diff matches the plan the user approved.
  **Why:** Blanket update commands respect range specifiers in unpredictable ways across managers and pull in transitive bumps the user didn't see in the audit table — the commit no longer matches the plan, and per-tier rollback no longer works.

- **NEVER skip the lockfile in the commit**
  **Instead:** Stage manifest *and* lockfile every time, in the same commit.
  **Why:** A version bump without a synced lockfile fails `npm ci` / `pnpm install --frozen-lockfile` / `cargo build --locked` in CI on the very next push. The release the user is preparing for then can't even build.

- **NEVER continue past a failing group's red tests by "fixing forward"**
  **Instead:** Stop. Offer revert / investigate / quit. Never patch on top of a broken upgrade in the same workflow.
  **Why:** Fix-forward inside a dep-upgrade workflow turns a clean revert (`git revert <sha>`) into entangled debugging, and the user loses the safety net the per-group commit was designed to provide.

- **NEVER fabricate breaking-change summaries when the changelog isn't reachable**
  **Instead:** Say "changelog unreachable for <pkg> — proceed at your own risk" in the briefing.
  **Why:** A confidently wrong "no breaking changes" summary causes the user to approve a major they shouldn't. Honest uncertainty preserves the gate's value; invented certainty defeats it.
