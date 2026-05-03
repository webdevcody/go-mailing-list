# Line Endings, File I/O, Watchers

## Line endings

| OS | Native EOL | Tools that care |
|---|---|---|
| Windows | `\r\n` (CRLF) | Notepad (pre-Win10), some Win32 tools, Outlook attachments, `.bat`/`.ps1` |
| macOS | `\n` (LF) | Most tools accept either |
| Linux | `\n` (LF) | Most tools accept either |

```js
import { EOL } from 'node:os'   // '\r\n' on Windows, '\n' elsewhere
```

### When to use what

- **App-internal files (JSON config, SQLite, logs):** always `\n`. Don't use `EOL`. Internal files don't get opened by Notepad; consistent newlines mean consistent diffs.
- **User-facing text files the user might open in a Windows tool** (export to `.txt`, `.csv`, `.bat`, `.cmd`, `.reg`, `.ini`): use `EOL` so Notepad and friends render correctly.
- **Files written by your app and read back by your app on the same machine:** `\n`. Reading back must tolerate both: split on `/\r?\n/`, never just `'\n'` or `'\r\n'`.

### Reading back

```js
// Tolerant — works regardless of who wrote the file
const lines = text.split(/\r?\n/)
```

## fs.watch and chokidar

`fs.watch` has wildly different semantics per OS:

| OS | Mechanism | Quirks |
|---|---|---|
| macOS | FSEvents | Coarse — directory-level events, may coalesce; recursive: true works |
| Windows | ReadDirectoryChangesW | Recursive supported; some editors trigger 2-3 events per save (atomic-rename pattern) |
| Linux | inotify | Recursive NOT supported natively; you must walk and watch each subdir; inotify watch limit (`fs.inotify.max_user_watches`) often hit on large trees |

For real-world reliability, use [`chokidar`](https://www.npmjs.com/package/chokidar) — it normalizes these. Even then, atomic-write editors (vim, IntelliJ) generate rename-into-place events that look like delete+add; debounce and coalesce.

```js
import chokidar from 'chokidar'
chokidar.watch(dir, {
  ignored: /(^|[\\/])\../,    // dotfiles
  awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
  ignoreInitial: true,
})
```

## Atomic writes

Writing config to `userData/config.json` directly: a crash mid-write corrupts it. Standard pattern:

```js
import fs from 'node:fs/promises'
import path from 'node:path'

async function atomicWriteJson(filePath, data) {
  const tmp = filePath + '.tmp'
  await fs.writeFile(tmp, JSON.stringify(data, null, 2))
  await fs.rename(tmp, filePath)  // rename is atomic on the same filesystem
}
```

Caveats:
- **Windows:** `rename` over an existing file fails by default. Use `fs.rename` in modern Node (handles this), or explicitly `fs.unlink(target)` then `fs.rename` — losing atomicity. The npm package [`write-file-atomic`](https://www.npmjs.com/package/write-file-atomic) handles this correctly.
- **Cross-filesystem rename:** atomic only WITHIN a filesystem. Tmp file must be in the same dir as the destination, not in `os.tmpdir()` (which may be a different filesystem on Linux).

## File permissions

- Windows mostly ignores Unix-style mode bits. `chmod` is a no-op for most bits; ACLs are the real permission system.
- macOS/Linux: `chmod` works as expected. Files extracted from zip/tar lose execute bit on Windows; restore on extraction.
- Read-only flag: works on all three but `fs.chmod(p, 0o444)` on Windows just sets the read-only attribute, not full Unix semantics.

## Trash vs delete

```js
import { shell } from 'electron'
await shell.trashItem('/path/to/file')   // OS trash on all three; reversible by user
```

Don't `fs.unlink` user-visible files unless the user explicitly chose "delete permanently."

## Common bugs

- **Writing config with `EOL` then comparing to a string with `'\n'`** — diffs and tests fail on Windows. Fix: pick one (always `\n` for internal) and stick with it.
- **`text.split('\n')`** on a file written by a Windows user — every line ends with stray `\r`. Fix: `split(/\r?\n/)`.
- **`fs.watch(largeDir, { recursive: true })` works on macOS, throws on Linux** — recursive isn't supported on inotify. Fix: use chokidar.
- **Hot-reload misses changes on Linux** — out of inotify watches. Fix: `sudo sysctl fs.inotify.max_user_watches=524288` (document the requirement) OR use polling fallback in chokidar.
- **Config file truncated to zero bytes after a crash** — wasn't written atomically. Fix: write-file-atomic or tmp+rename.
- **`fs.rename(tmp, target)` works on mac/linux, EEXIST on Windows** — old Node versions. Fix: modern Node handles this; otherwise use write-file-atomic.
- **Editing a `.txt` file with `\n` only — looks like one giant line in Notepad on old Windows.** Fix: write `EOL` for files explicitly intended for Windows tools.
