# Launcher + Sibling Template

Templates and exact patches for Phase 4. The pattern mirrors esbuild, biome, turbo, and swc — proven across millions of installs.

---

## Root package.json patches

Given root package `<pkg>` at version `<V>`, with target matrix `[(darwin,arm64), (darwin,x64), (linux,x64), (win32,x64)]`:

```json
{
  "name": "<pkg>",
  "version": "<V>",
  "bin": {
    "<bin-name>": "bin/launcher.js"
  },
  "files": ["bin/"],
  "optionalDependencies": {
    "<pkg>-darwin-arm64": "<V>",
    "<pkg>-darwin-x64":   "<V>",
    "<pkg>-linux-x64":    "<V>",
    "<pkg>-win32-x64":    "<V>"
  }
}
```

Only include sibling entries for targets that were actually built and will be published. Listing a sibling that doesn't exist on the registry hardens the install error path (`optionalDependencies` failures are silent) but the launcher will still error usefully — see below.

---

## bin/launcher.js (root package)

```js
#!/usr/bin/env node
// Resolves the platform-specific sibling and execs its app binary.
const path = require('path');
const { spawnSync } = require('child_process');

const platform = process.platform;        // 'darwin' | 'linux' | 'win32'
const arch = process.arch;                // 'arm64' | 'x64' | ...
const pkgName = require('../package.json').name;
const siblingName = `${pkgName}-${platform}-${arch}`;

let siblingDir;
try {
  // require.resolve finds the sibling's package.json regardless of hoisting.
  siblingDir = path.dirname(require.resolve(`${siblingName}/package.json`));
} catch {
  console.error(
    `[${pkgName}] No prebuilt binary for ${platform}-${arch}. ` +
    `Supported platforms are listed in the package's optionalDependencies. ` +
    `If yours is missing, please open an issue.`
  );
  process.exit(1);
}

// Per-OS path to the executable inside the sibling.
// Adjust APP_NAME and the relative paths to match your build output.
const APP_NAME = '<AppName>';
const binaryPath = (() => {
  if (platform === 'darwin') return path.join(siblingDir, `${APP_NAME}.app/Contents/MacOS/${APP_NAME}`);
  if (platform === 'win32')  return path.join(siblingDir, `${APP_NAME}.exe`);
  return path.join(siblingDir, APP_NAME);  // linux
})();

const result = spawnSync(binaryPath, process.argv.slice(2), { stdio: 'inherit' });
process.exit(result.status ?? 1);
```

Notes:
- The shebang + `bin` entry is enough on Unix. On Windows, npm auto-generates a `.cmd` shim that calls `node bin/launcher.js`. No separate Windows wrapper needed.
- Do NOT mark the file executable manually with `chmod +x` before publishing. npm sets the bin executable bit on install regardless of the source file's mode. Setting it locally is fine but not required.
- The `require.resolve` hop is what makes hoisting (`npm i -g` in nvm, pnpm, yarn) work without hardcoding `node_modules/<sibling>`.

---

## Sibling package.json template

For sibling `<pkg>-<platform>-<arch>` at version `<V>`:

```json
{
  "name": "<pkg>-<platform>-<arch>",
  "version": "<V>",
  "description": "Prebuilt binary for <pkg> on <platform>-<arch>",
  "os": ["<platform>"],
  "cpu": ["<arch>"],
  "files": ["<AppName>.app", "<AppName>", "<AppName>.exe", "**/*"],
  "license": "<same as root>"
}
```

Keep `files` permissive — easier to be inclusive of the unpacked tree than to enumerate every Electron resource (locales, ICU data, ffmpeg, swiftshader). The whole sibling is supposed to be the app's unpacked output.

`os` valid values: `darwin`, `linux`, `win32`, `freebsd`.
`cpu` valid values: `arm64`, `x64`, `ia32`, `arm`.

---

## Common assembly mistakes

- Forgot `bin` in root → `npm i -g <pkg>` succeeds, no command on PATH. Symptom: `<bin-name>: command not found` after install.
- `os` in sibling is a string instead of an array (`"os": "darwin"`) → npm ignores it, all users download all siblings.
- Sibling `package.json` is inside the `.app` bundle instead of the sibling root → npm publishes an empty package. Always place `package.json` at the sibling directory root, with the unpacked app as a sibling-of-sibling.
- Root package omits `files: ["bin/"]` and ships the whole repo (or nothing) → tarball is huge OR missing the launcher. Be explicit.
- APP_NAME hardcoded with the wrong casing — macOS is case-sensitive on the executable inside `Contents/MacOS/`. Match exactly what the build produced.
