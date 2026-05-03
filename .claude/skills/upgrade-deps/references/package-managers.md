# Package Manager Command Reference

Per-ecosystem commands for audit (find advisories), outdated (find version gaps), and targeted upgrade (bump specific packages without sweeping the rest). Load only the section(s) for ecosystems detected in Phase 1.

For every manager: prefer JSON output for parsing; never parse human-formatted columns.

---

## Node — npm

**Outdated:**
```
npm outdated --json
```
Output: `{ "<pkg>": { "current": "...", "wanted": "...", "latest": "..." } }`. `wanted` is the highest version satisfying the manifest range; `latest` is the registry's latest tag. A package is in-tier `MAJOR` when `latest`'s major > `current`'s major.

**Advisories:**
```
npm audit --json
```
Output: `vulnerabilities` map keyed by package. Each has `severity`, `via`, `fixAvailable`. Honor only direct-dep advisories at this layer; transitive advisories are addressed by upgrading the direct parent.

**Targeted upgrade (single package, exact version):**
```
npm install <pkg>@<version> --save-exact
```
Use `--save-exact` to avoid widening ranges. For dev deps add `--save-dev`. Updates `package-lock.json` automatically.

**Audit fix (advisory group only):**
```
npm audit fix
```
Use only inside the ADVISORY group in Phase 4 — npm picks the minimum non-vulnerable version satisfying ranges. Avoid `npm audit fix --force` (it can pull majors silently).

---

## Node — pnpm

**Outdated:** `pnpm outdated --format json`

**Advisories:** `pnpm audit --json`

**Targeted upgrade:**
```
pnpm add <pkg>@<version>
```
For workspaces, run at the workspace root with `-w` for root deps, or `cd` into the package directory for package-local deps — do not mix.

---

## Node — yarn (classic v1)

**Outdated:** `yarn outdated --json` (emits NDJSON; parse line-by-line).

**Advisories:** `yarn audit --json` (NDJSON).

**Targeted upgrade:** `yarn add <pkg>@<version> --exact`

Yarn berry (v2+) uses `yarn npm audit` and `yarn up <pkg>@<version>` instead — detect by `.yarnrc.yml` presence.

---

## Node — bun

**Outdated:** `bun outdated` (no JSON flag yet — fall back to `bun pm ls --json` plus registry lookups, or ask the user to confirm bun's current outdated UX). If parsing is unreliable, surface that and offer to switch to npm-compatible commands against the same lockfile is NOT supported — bun's lockfile is binary.

**Advisories:** Bun has no native audit at time of writing. Run `npm audit --package-lock-only` against a temporarily generated `package-lock.json` (`bun install --yarn` → no; instead use the npm registry advisory API directly via the package list from `bun pm ls --json`). If that's not feasible, surface "bun has no native audit; advisories not checked" rather than skip silently.

**Targeted upgrade:** `bun add <pkg>@<version>`

---

## Python — poetry

**Outdated:** `poetry show --outdated --no-ansi` (no JSON; columnar — split on whitespace, skip blank lines).

**Advisories:** `poetry` has no native audit. Use `pip-audit -r <(poetry export --without-hashes -f requirements.txt)` if `pip-audit` is on PATH. Otherwise surface the gap.

**Targeted upgrade:** `poetry add <pkg>@<version>` (replaces existing entry).

---

## Python — uv

**Outdated:** `uv pip list --outdated --format json`

**Advisories:** `uv` has no native audit; run `pip-audit` against the uv-managed venv.

**Targeted upgrade:** `uv add <pkg>==<version>` (project mode) or `uv pip install <pkg>==<version>` (script/venv mode).

---

## Python — pipenv

**Outdated:** `pipenv update --outdated`

**Advisories:** `pipenv check` (built-in, uses safety DB).

**Targeted upgrade:** edit `Pipfile`, then `pipenv install <pkg>==<version>`.

---

## Rust — cargo

**Outdated:** requires `cargo-outdated` (`cargo install cargo-outdated`). Run `cargo outdated --format json --depth 1` (depth 1 = direct deps only — same scoping rule as npm audit).

**Advisories:** `cargo audit --json` (requires `cargo-audit`). Reads `Cargo.lock` against the RustSec advisory DB.

**Targeted upgrade:** edit `Cargo.toml` to set the new version, then:
```
cargo update -p <pkg> --precise <version>
```
This rewrites only that crate's row in `Cargo.lock`. Never run bare `cargo update` — it sweeps the whole graph.

---

## Go — go modules

**Outdated:**
```
go list -m -u -json all
```
Each module entry has `Update` populated when a newer version exists. `Update.Version` is the latest available.

**Advisories:**
```
govulncheck ./...
```
Reports vulnerabilities reachable from the module's call graph (not just present in the dep tree) — much higher signal than a flat audit. JSON output: `govulncheck -json ./...`.

**Targeted upgrade:**
```
go get <module>@<version>
go mod tidy
```
`go mod tidy` is required after every upgrade group to keep `go.sum` minimal and consistent. Stage both `go.mod` and `go.sum` in the commit.

---

## Ruby — bundler

**Outdated:** `bundle outdated --parseable` (one package per line, parseable format).

**Advisories:** `bundle audit check --update` (requires `bundler-audit` gem).

**Targeted upgrade:** edit `Gemfile` if version is pinned there, then `bundle update <gem> --conservative`.

---

## PHP — composer

**Outdated:** `composer outdated --format=json --direct`

**Advisories:** `composer audit --format=json` (composer 2.4+).

**Targeted upgrade:** `composer require <pkg>:<version> --update-with-dependencies` (or `--no-update` then explicit `composer update <pkg>`).

---

## Cross-ecosystem notes

- **0.x versions**: a `0.x → 0.y` bump is treated as MAJOR by this skill regardless of what the registry calls it. SemVer pre-1.0 has no stability contract.
- **Workspace/monorepo tools** (npm/pnpm/yarn/bun workspaces, Cargo workspaces, Go workspaces): run the skill from the workspace root and let the manager's targeted-upgrade command handle the lockfile. Do not iterate per-package — that defeats the single-lockfile commit grouping.
- **Lockfile-only refresh** (no version changes, just lockfile churn from a registry republish): out of scope for this skill. Skip and tell the user.
