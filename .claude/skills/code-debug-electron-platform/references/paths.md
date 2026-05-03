# File Paths and App Directories

## Always use `path` for filesystem paths

```js
import path from 'node:path'

// Filesystem paths — uses OS separator (\ on Windows, / elsewhere)
path.join(dir, 'sub', 'file.txt')
path.resolve(dir, '..', 'other')
path.normalize(userInput)
path.dirname(p); path.basename(p); path.extname(p)

// URL-style paths (always forward-slash) — for file:// URLs, asar paths in URLs, etc.
path.posix.join('a', 'b', 'c')

// Convert between path and file:// URL — use these, not string concat
import { pathToFileURL, fileURLToPath } from 'node:url'
pathToFileURL(absPath).href           // → 'file:///C:/Users/...'
fileURLToPath('file:///C:/Users/x')   // → 'C:\\Users\\x' on Windows
```

## App directories — use `app.getPath`, never hardcode

```js
app.getPath('home')         // ~/, C:\Users\X, /home/x
app.getPath('appData')      // ~/Library/Application Support, %APPDATA%, ~/.config
app.getPath('userData')     // appData + app name — DEFAULT for app config/state
app.getPath('sessionData')  // Electron session storage
app.getPath('temp')         // OS temp dir (NOT /tmp on macOS — use this)
app.getPath('logs')         // OS-appropriate log dir
app.getPath('downloads' | 'documents' | 'desktop' | 'pictures' | 'music' | 'videos')
app.getPath('exe')          // Path to Electron exe (the launcher)
app.getAppPath()            // Path to the app's source dir (or asar)
process.resourcesPath       // Path to resources/ in packaged app — for sidecar binaries, extraResources
```

Use `app.setPath('userData', customPath)` BEFORE `app.whenReady()` if you need a custom location (e.g., portable mode).

## Path comparison

NEVER compare paths with `===`. They can differ by:
- Separator (`a/b` vs `a\b` on Windows when one was normalized)
- Case (`Foo.txt` vs `foo.txt` on macOS/Windows)
- Trailing slash (`/foo` vs `/foo/`)
- Symlinks, `..`, `.` segments
- Short (8.3) vs long names on Windows
- Volume notation (`C:\` vs `\\?\C:\`)

```js
import fs from 'node:fs'
import path from 'node:path'

function samePath(a, b) {
  try {
    return fs.realpathSync(path.resolve(a)) === fs.realpathSync(path.resolve(b))
  } catch {
    return path.resolve(a) === path.resolve(b)  // file may not exist yet
  }
}
```

For case-insensitive OS, also `.toLowerCase()` before comparison — but `realpathSync` returns canonical case on Windows/macOS HFS+.

## Filesystem case sensitivity

| OS | Default | Notes |
|---|---|---|
| macOS | Case-insensitive (HFS+, APFS) but case-preserving | Some users format APFS case-sensitive — don't assume |
| Windows | Case-insensitive (NTFS) but case-preserving | Per-directory case-sensitivity flag exists (rare) |
| Linux | Case-sensitive (ext4, btrfs) | Always |

**Bug pattern:** importing `./Component` when file is `./component.tsx` works on macOS dev, fails Linux CI/prod.
**Fix:** Match exact filename case in code; consider lint rules (e.g., `eslint-plugin-import/no-unresolved` with `caseSensitive: true`).

## Special path forms (Windows)

- **Drive letters:** `C:\foo`, `D:\bar` — `path.parse(p).root` gives `'C:\\'`
- **UNC paths:** `\\server\share\file` — valid; `path.join('\\\\server\\share', 'x')` works
- **Long paths:** Windows MAX_PATH is 260 chars unless long-path support enabled. Prefix `\\?\` for explicit long-path: `\\?\C:\very\long\path` — but most Node fs APIs handle this transparently in modern Node.
- **Reserved names:** `CON`, `PRN`, `AUX`, `NUL`, `COM1`–`COM9`, `LPT1`–`LPT9` — cannot be used as filenames on Windows even with extension. Validate user-supplied filenames.
- **Forbidden chars:** `< > : " | ? *` and control chars 0–31. Forward slash also reserved as separator.
- **Trailing dots/spaces:** Windows strips them silently — `"foo. "` becomes `"foo"`.

## Spaces, unicode, and non-ASCII in paths

Always works if you use `path.join` and pass paths as arrays to `spawn`. Breaks when:
- Building shell commands by string concat: `exec(\`cp \${src} \${dst}\`)` — fails on `Program Files`, `My Documents`, paths with `'`, etc.
- Passing to a subprocess via `shell: true` without quoting.
- Using paths in URLs without `encodeURI`/`pathToFileURL`.

## Temp files

```js
import { tmpdir } from 'node:os'
import fs from 'node:fs/promises'
import path from 'node:path'

const dir = await fs.mkdtemp(path.join(tmpdir(), 'myapp-'))
```

Or `app.getPath('temp')` inside Electron — same as `os.tmpdir()` but respects Electron-specific overrides.

NEVER hardcode `/tmp` (doesn't exist on Windows; on macOS the OS gives each app a private temp dir per session).

## `process.cwd()` and `__dirname` — what they actually point at

| Context | `process.cwd()` | `__dirname` |
|---|---|---|
| `npm run` in dev | Project root | File's source dir |
| Double-click app on macOS | `/` | Inside `app.asar` (read-only) |
| Run from terminal | Whatever dir user was in | Inside `app.asar` |
| Packaged Windows | Wherever the user launched from | Inside `app.asar` |

Use `app.getAppPath()` (read-only app source) or `app.getPath('userData')` (writable) instead.

## Common bugs

- **`fs.writeFile(path.join(__dirname, 'config.json'), ...)`** — read-only inside asar; works in dev, EROFS in prod. Fix: write to `app.getPath('userData')`.
- **`'/Users/' + os.userInfo().username + '/Library/...'`** — fails on Windows/Linux entirely. Fix: `app.getPath('appData')`.
- **`exec('cp ' + src + ' ' + dst)`** — fails on paths with spaces. Fix: `fs.copyFile(src, dst)` or `spawn('cp', [src, dst])` (and use `'copy'` on Windows or just stick with `fs.copyFile`).
- **Comparing watcher event paths to a stored path with `===`** — Windows event may give `C:\foo`, stored path is `c:\foo` → miss. Fix: `realpathSync` or normalize-then-lowercase on Windows.
