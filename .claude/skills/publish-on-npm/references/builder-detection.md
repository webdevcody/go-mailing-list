# Builder Detection

Goal: produce `BUILD_CMD`, `OUT_DIR_PATTERN`, and `BUILDER` for Phase 1.

## Detection order (first match wins)

1. **Existing scoped npm scripts** — preferred. Read `package.json#scripts` and look for, in order:
   - `dist:<platform>:<arch>` (e.g. `dist:mac:arm64`) — modern electron-builder convention
   - `dist:<platform>` — broader scope, often handles all archs for that OS
   - `dist`, `build:electron`, `package`, `make` — global builds
   - `forge:make`, `electron-forge make` — explicit forge

   If found → that's `BUILD_CMD`. Move to step 4 to determine `OUT_DIR_PATTERN`.

2. **electron-builder config** — look for any of:
   - `electron-builder.yml` / `.yaml` / `.json` / `.config.js` at repo root
   - `"build"` key in `package.json`
   - `electron-builder` in `devDependencies`

   If matched → `BUILDER = electron-builder`. Default `BUILD_CMD = npx electron-builder --<platform> --<arch>`. Default `OUT_DIR_PATTERN = dist/<platform>-<arch>-unpacked/` for win/linux, `dist/mac-<arch>/<AppName>.app/` for mac.

3. **electron-forge config** — look for:
   - `forge.config.js` / `.ts` at repo root
   - `"config.forge"` in `package.json`
   - `@electron-forge/cli` in `devDependencies`

   If matched → `BUILDER = electron-forge`. Default `BUILD_CMD = npx electron-forge package --platform=<platform> --arch=<arch>`. Default `OUT_DIR_PATTERN = out/<AppName>-<platform>-<arch>/`.

4. **Neither detected** — abort Phase 1. Tell the user: "no electron-builder or electron-forge config found; install one and re-run, or pass a custom build command."

## Determining OUT_DIR_PATTERN when scripts are custom

If you used a custom npm script in step 1, run it once with a single target and `ls -la` the workspace to find the produced unpacked directory before assuming a pattern. electron-builder respects `directories.output` in config — read it if set.

## Ambiguity rules

- Both electron-builder AND electron-forge configs present → ASK. Most projects in this state have an in-progress migration; guessing wrong wastes a publish.
- Scoped scripts exist but only for some archs the user wants → use scoped scripts where available, fall back to `npx <builder>` for the rest, and tell the user which is which.
- A custom `dist`/`build` script that runs webpack/vite but not electron-builder → ASK. The script may produce renderer assets only, not a packaged app.

## Verifying output is "unpacked app", not "installer"

This skill ships unpacked apps inside sibling npm tarballs. If the build command produces `.dmg`, `.exe`, `.AppImage`, `.deb`, or `.snap` artifacts, that's an installer flow — wrong for this skill. Look for the unpacked counterpart electron-builder usually emits alongside (`mac-arm64/`, `win-unpacked/`, `linux-unpacked/`). If only installers are produced, the project's config has `target` set to installer-only — tell the user to add `dir` (electron-builder) or use `package` not `make` (electron-forge), and stop.
