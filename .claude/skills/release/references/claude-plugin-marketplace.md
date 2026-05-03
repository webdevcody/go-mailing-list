# Claude Code plugin marketplace — release rules

Read this when Phase 1 detected `.claude-plugin/marketplace.json` at the repo root. The release skill's default single-manifest flow is wrong for this layout — there are multiple version fields and they must be bumped per-diff, not in lockstep.

## Detection signal

`.claude-plugin/marketplace.json` exists at the repo root. Confirms a Claude Code plugin marketplace project.

## Manifests in scope

Every release touches at least:

- **Root marketplace** — `.claude-plugin/marketplace.json`, field `metadata.version`. Always bumps. It's the umbrella; any plugin change is a marketplace release.
- **Per-plugin** — `plugins/*/.claude-plugin/plugin.json`, field `version`. Bumps **only when that plugin's code changed since `LAST_TAG`**.

Per-plugin baselines are independent and stay independent. `agentsystem-core` may sit at `0.11.0` while `agentsystem-electron` sits at `0.2.0` — that's correct, not drift. Do not normalize them.

## Diff-driven bump rule

For each `plugins/<name>/.claude-plugin/plugin.json`, run:

```bash
git diff --name-only $LAST_TAG..HEAD -- plugins/<name>/ ':!plugins/<name>/.claude-plugin/plugin.json'
```

The exclusion of the plugin's own `plugin.json` is intentional — a previous release's version bump shouldn't re-trigger this release's bump.

- **Non-empty output** → that plugin changed. Bump its `version` by the release's bump step (`major|minor|patch`) from its own current value.
- **Empty output** → that plugin is unchanged. Leave its `version` alone.

The bump step applies uniformly to every changed plugin. If `/release minor` is invoked: every changed plugin moves `+0.1.0` from its own baseline; every unchanged plugin stays put.

## No prior tag

If `git describe --tags --abbrev=0` returned `NO_PRIOR_TAG`, treat every plugin as changed (initial release). Bump them all, including the marketplace.

## Verification (before commit)

Build and print a bump table to the user:

```
Plugin                       Old → New
agentsystem-core             0.11.0 → 0.12.0
agentsystem-electron         0.2.0  → unchanged
agentsystem-frontend-ux      0.2.0  → 0.3.0
...
marketplace.json             0.12.1 → 0.13.0
```

Then run:

```bash
grep -H version .claude-plugin/marketplace.json plugins/*/.claude-plugin/plugin.json
```

Confirm every line either shows the new bumped version (for changed plugins + marketplace) or matches what the table called "unchanged." Only stage after the table and the grep agree.

## What to commit

Stage all bumped manifests in one commit:

```bash
git add .claude-plugin/marketplace.json plugins/*/.claude-plugin/plugin.json
git commit -m "chore(release): vNEXT_VERSION"
```

The tag is on the marketplace version (single tag per release), not per-plugin.
