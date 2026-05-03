# Shell, Spawn, Child Processes

## Default rule: array args, no shell

```js
import { spawn, execFile } from 'node:child_process'

// Good — args are an array, no shell, paths-with-spaces safe
spawn('git', ['clone', repoUrl, destPath])

// Good — same idea with promise wrapper
import { promisify } from 'node:util'
const execFileP = promisify(execFile)
await execFileP('git', ['clone', repoUrl, destPath])
```

NEVER use `exec` or `spawn(..., { shell: true })` with dynamic args. The shell on each OS quotes differently:
- Windows runs `cmd.exe` by default — caret (`^`) escaping, `%VAR%` expansion, no single-quote support.
- macOS/Linux run `/bin/sh` — backslash escaping, `$VAR` expansion, single-quote-as-literal.

A string that's quoted correctly for one is mis-quoted for the other.

## Resolving binaries

### Bundled sidecar binaries

```js
import { app } from 'electron'
import path from 'node:path'

const isDev = !app.isPackaged
const binName = process.platform === 'win32' ? 'mytool.exe' : 'mytool'
const binPath = isDev
  ? path.join(__dirname, '..', 'bin', process.platform, binName)
  : path.join(process.resourcesPath, 'bin', binName)
```

In `package.json` (electron-builder), declare the per-OS binaries via `extraResources`:

```json
"build": {
  "extraResources": [
    { "from": "bin/${platform}/", "to": "bin/", "filter": ["**/*"] }
  ]
}
```

On macOS, bundled binaries must be **executable** AND **signed** (or notarization fails). On Linux/Windows, just executable.

### System binaries on PATH

`spawn('node', [...])` works on all three IF `node` is on PATH. To check first, use `which` (mac/linux) / `where` (windows) — or just `spawn` and handle `error` event with `code === 'ENOENT'`.

To find a binary cross-platform, use the [`which`](https://www.npmjs.com/package/which) npm package or shell out:
```js
const lookupCmd = process.platform === 'win32' ? 'where' : 'which'
```

## Shebang lines and script execution

- `#!/usr/bin/env node` works on macOS/Linux, ignored on Windows.
- On Windows, `.js` files don't auto-execute via shebang. Either: (a) call `node script.js` explicitly, (b) use `.cmd`/`.bat` wrapper, or (c) use npm bin shims (npm/yarn/pnpm generate `.cmd` wrappers automatically for `bin` entries).
- Files in a tarball/zip lose the executable bit on Windows. Re-`chmod +x` after extracting on macOS/Linux: `await fs.chmod(p, 0o755)`.

## Environment variables

```js
spawn(cmd, args, {
  env: { ...process.env, MY_VAR: 'x' }  // ALWAYS spread process.env on Windows
})
```

On Windows, omitting `process.env` strips `PATH`, `SystemRoot`, `TEMP` — many tools fail mysteriously without `SystemRoot`. On macOS/Linux it's also bad practice but less catastrophic.

Env var names are case-insensitive on Windows (`PATH` === `Path` === `path`), case-sensitive on macOS/Linux. Don't rely on a specific case.

`PATHEXT` on Windows determines which extensions are auto-appended when looking up a binary (`.EXE;.BAT;.CMD;...`). This is why `spawn('npm')` works on Windows even though the file is `npm.cmd`.

## Killing child processes

```js
const child = spawn(...)
child.kill('SIGTERM')   // sends SIGTERM on mac/linux; emulated on Windows (calls TerminateProcess)
child.kill('SIGKILL')   // not really SIGKILL on Windows, just TerminateProcess
```

To kill a process AND its children:
- macOS/Linux: spawn with `detached: true`, then `process.kill(-child.pid, 'SIGTERM')` (negative pid = process group)
- Windows: `spawn('taskkill', ['/pid', child.pid, '/T', '/F'])` — `/T` includes child tree, `/F` is force

The [`tree-kill`](https://www.npmjs.com/package/tree-kill) package abstracts this.

## Opening files / URLs / folders externally

Use Electron's `shell` module — never spawn `open`/`xdg-open`/`start`:

```js
import { shell } from 'electron'

shell.openExternal('https://example.com')           // browser
shell.openPath('/path/to/file')                     // default app for file
shell.showItemInFolder('/path/to/file')             // reveal in Finder/Explorer/file mgr
shell.trashItem('/path/to/file')                    // OS trash (NOT permanent delete)
shell.beep()
```

`shell.openPath` returns a string error on failure (empty string = success), not a thrown exception — check the return value.

## Common bugs

- **`exec(\`mytool \${userInput}\`)`** — command injection on every OS, AND quoting differs. Fix: `spawn('mytool', [userInput])`.
- **`spawn('mytool', ...)` works in dev, ENOENT on Windows** — missing `.exe` extension or relying on dev `node_modules/.bin` PATH that doesn't exist in packaged app. Fix: resolve absolute path via `process.resourcesPath` and add `.exe` suffix on win32.
- **`spawn('rm', ['-rf', dir])`** — no `rm` on Windows. Fix: `fs.rm(dir, { recursive: true, force: true })`.
- **`exec('echo $HOME')` / `exec('echo %USERPROFILE%')`** — shell-specific. Fix: read `os.homedir()` in Node.
- **Sidecar runs in dev but is missing in the packaged app** — wasn't added to `extraResources` (or `files` for asar inclusion). Verify in built `.app`/`.exe` contents.
