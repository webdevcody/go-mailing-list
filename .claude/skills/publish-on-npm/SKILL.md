---
name: publish-on-npm
compatibility: Requires git, npm (logged in), Node ≥18, and an Electron app with electron-builder or electron-forge configured.
description: Publish an Electron desktop app to npm using the per-OS optionalDependencies pattern (esbuild/biome/turbo style) so end users can `npm i -g <pkg>` and run a launcher that execs the prebuilt binary for their platform. Auto-detects the project's existing build tooling (electron-builder vs electron-forge) by checking npm scripts and config files. Builds locally for every host-supported OS+arch combo, packages each as a sibling npm package (`<pkg>-darwin-arm64`, `<pkg>-win32-x64`, `<pkg>-linux-x64`, etc.), publishes siblings FIRST then root with matching version + optionalDependencies pointing at exact sibling versions. Trigger phrases — "publish electron app to npm", "publish on npm", "/publish-on-npm", "ship this electron app via npm", "make this installable with npm i -g", "release electron to npm registry". Skip for — non-Electron projects (use a regular npm publish flow), publishing to GitHub Releases / Mac App Store / auto-updater feeds (different distribution channels), Electron apps that ship as installers users double-click (use electron-builder's publish step directly), and cross-OS builds requiring CI (this skill only builds what the host machine supports natively). Aborts on: not on `main`, dirty working tree, no detected Electron builder, missing `npm whoami`, or attempting to cross-compile macOS from non-mac.
---

# publish-on-npm

Six phases, in strict order. Siblings publish before root. Root's `optionalDependencies` pin sibling versions exactly so a partial publish can't corrupt installs.

---

## Phase 0 — Preflight

All checks below must pass; abort with the failing check name on first failure.

```bash
git rev-parse --abbrev-ref HEAD          # main
git status --porcelain                   # empty
npm whoami                               # logged in
node -e "console.log(require('./package.json').main || '')"  # electron entry
```

Plus: `package.json` must declare `"main"` and either `"electron"` in `devDependencies` OR an `electron` binary on PATH. If neither, abort with "this directory does not look like an Electron app."

If the package is **scoped** (`@org/foo`), additionally run `npm access list packages` and confirm publish access — scoped packages default to private and `npm publish` will 402 mid-flow otherwise.

---

## Phase 1 — Detect the build command

**MANDATORY — READ [`references/builder-detection.md`](references/builder-detection.md)** at this phase only. Do NOT load it in other phases.

Outcome of this phase: a single shell command that, when run, produces unpacked Electron app directories under a known output path (typically `dist/`, `out/`, or `release/`) — one directory per (OS, arch) the host built for. Record:

- `BUILD_CMD` — the exact command (e.g. `npm run dist:mac:arm64`)
- `OUT_DIR_PATTERN` — glob that resolves to each unpacked app dir (e.g. `dist/mac-arm64/<AppName>.app`, `dist/win-unpacked/`, `dist/linux-unpacked/`)
- `BUILDER` — `electron-builder` | `electron-forge` | `custom` (detected from config + scripts)

If detection is ambiguous (both builders configured, or no recognizable scripts), stop and ask the user which command to use. Do not guess.

---

## Phase 2 — Determine the target matrix

The target matrix is the set of `(platform, arch)` pairs the **host machine can build natively**. Apply these rules:

| Host OS | Can build natively for |
|---|---|
| macOS (arm64) | `darwin-arm64`, `darwin-x64` (via Rosetta), `linux-x64`, `linux-arm64` |
| macOS (x64) | `darwin-x64`, `darwin-arm64`, `linux-x64`, `linux-arm64` |
| Linux | `linux-x64`, `linux-arm64` (if cross-compile toolchain present), `win32-x64` (if wine present, but warn) |
| Windows | `win32-x64`, `win32-ia32` |

Refuse: building `darwin-*` from non-mac (code signing, `.app` bundle quirks, dmg). If the user wants full coverage from a non-mac host, tell them they need CI or a Mac and stop.

Show the resolved matrix and ask the user to confirm before Phase 3 — they may want to skip an arch.

---

## Phase 3 — Build each target

For each `(platform, arch)` in the confirmed matrix, run `BUILD_CMD` scoped to that target. electron-builder uses `--mac --arm64` style flags; electron-forge uses `--platform=darwin --arch=arm64`. Use the project's existing scoped scripts when present (e.g. `dist:mac:arm64`); otherwise pass flags directly.

After each build, verify the unpacked directory exists at the expected `OUT_DIR_PATTERN` location. If a build silently produces zero output (electron-builder occasionally exits 0 with no artifacts when a code-sign step is misconfigured), abort — do not publish a tarball with a missing binary.

---

## Phase 4 — Assemble sibling packages

**MANDATORY — READ [`references/launcher-template.md`](references/launcher-template.md)** at this phase. It contains the launcher script, sibling package.json template, and the root package.json patches.

For each built target, create a sibling package directory (e.g. under `.publish/`):

```
.publish/
  <pkg>-darwin-arm64/
    package.json     # name: "<pkg>-darwin-arm64", os: ["darwin"], cpu: ["arm64"], bin contents
    <AppName>.app/   # the unpacked build output
  <pkg>-win32-x64/
    package.json
    <AppName>/
  <pkg>-linux-x64/
    package.json
    <AppName>/
```

Each sibling's `package.json` MUST declare `"os"` and `"cpu"` arrays. npm uses these to skip download on non-matching machines — without them, every user downloads every binary (gigabytes wasted) and the launcher can't tell which one to exec.

Sibling version = root version. They must match exactly. Mismatched versions are the #1 cause of "command not found after install."

---

## Phase 5 — Publish siblings, then root

Before publishing root, ask: is every sibling at exactly `<V>` already on the registry? If any sibling is missing, stop — root must not land first.

Strict order — siblings first, root last. Reason: root's `optionalDependencies` reference exact sibling versions. If root publishes first, anyone who runs `npm i -g <pkg>` between root-publish and sibling-publish gets a broken install (npm fails optional deps silently and the launcher can't find any binary).

```bash
# 1. Publish each sibling
for dir in .publish/<pkg>-*/; do
  (cd "$dir" && npm publish --access public)
done

# 2. Update root package.json: bump optionalDependencies to current version, commit
#    (the launcher template covers the exact shape)

# 3. Publish root
npm publish --access public
```

If any sibling publish fails, **stop**. Do not publish root. Already-published siblings are harmless on the registry — they'll be referenced by the next attempt at the same version, or an `npm version patch` bump if you need to retry.

If `--access public` is wrong for the project (private scoped package), drop it — but `npm whoami` in Phase 0 should have already established access.

---

## Phase 6 — Verify

Smoke test the published artifact in a clean directory:

```bash
mkdir -p /tmp/publish-on-npm-verify && cd /tmp/publish-on-npm-verify
npm init -y >/dev/null
npm i <pkg>@<version>
./node_modules/.bin/<bin-name> --version    # or whatever the app supports as a no-op flag
```

If the bin can't be located or exits non-zero with "platform not supported," the launcher template was assembled wrong — stop and surface the error verbatim. Do not unpublish; instead, bump version and re-run from Phase 3.

Report on success: published version, list of sibling tarball sizes, and the install command users should run.

---

## NEVER

- **NEVER publish the root package before all siblings are published**
  **Instead:** Publish siblings first; only publish root after every sibling tarball is on the registry at the matching version.
  **Why:** The root's `optionalDependencies` pin exact sibling versions. If root lands first, every install during the gap fails to resolve the binary and exits "platform not supported" with no recoverable state — the user sees a broken global command and has no clear next step.

- **NEVER omit `os` and `cpu` from sibling package.json files**
  **Instead:** Each sibling declares `"os": ["<platform>"]` and `"cpu": ["<arch>"]` in its own package.json.
  **Why:** Without these fields npm downloads every sibling on every machine (gigabytes per install) AND `optionalDependencies` filtering doesn't kick in, so the launcher can't reliably resolve "the one for this OS." This is the entire mechanism that makes the pattern work.

- **NEVER cross-compile macOS builds from a non-mac host**
  **Instead:** Refuse in Phase 2 and tell the user CI or a Mac is required for `darwin-*` targets.
  **Why:** macOS apps require `.app` bundle structure, Info.plist signing, codesign with a Developer ID, and notarization. Linux/Windows hosts produce unsigned bundles that Gatekeeper quarantines on launch — the binary "publishes fine" but every Mac user sees "app is damaged and can't be opened" with no fix path. Better to ship no darwin sibling than a broken one.

- **NEVER let sibling versions drift from root**
  **Instead:** Always publish all packages at the exact same version per release. Bump together; if a sibling publish fails, bump the whole set and retry — do not patch siblings independently.
  **Why:** Root's `optionalDependencies` reference exact versions. Drift means root@1.2.3 points to sibling@1.2.2, which has the old binary — users get yesterday's app silently. This is invisible from `npm view` because the registry is happy.

- **NEVER skip `npm whoami` and 2FA verification in Phase 0**
  **Instead:** Verify auth up front; abort if `npm whoami` fails or returns a user without publish access to the org/scope.
  **Why:** Discovering "not logged in" or "OTP required" mid-flow leaves siblings half-published. Half-published is the worst state: the registry now has reserved tarballs at a version, and the next attempt either has to bump the version or fight 409 conflicts.

- **NEVER publish from a feature branch or dirty tree**
  **Instead:** Abort in Phase 0 with the offending state. User cleans up and re-invokes.
  **Why:** Published npm artifacts can't be unpublished after 72 hours and reusing a version number is forbidden by the registry. A version cut from non-`main` or a dirty tree pins permanent garbage to the registry under a real version number.

- **NEVER guess the build command when detection is ambiguous**
  **Instead:** Stop in Phase 1, show the user what was detected, and ask which command to use.
  **Why:** Running the wrong build script can produce empty `out/`, run the dev server, or trigger an installer build (.dmg/.exe) that doesn't match the unpacked-directory contract this skill assumes — Phase 4 then assembles a sibling around an installer artifact and the launcher can't exec it.

- **NEVER `npm unpublish` to recover from a failed publish**
  **Instead:** `npm version patch` and re-run from Phase 3 with a fresh version.
  **Why:** Unpublishing within the 72-hour window blocks that exact version forever — anyone with it pinned in a lockfile breaks. Bumping is cheap and leaves the registry's history intact.
