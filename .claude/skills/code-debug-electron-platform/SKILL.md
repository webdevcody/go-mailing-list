---
name: code-debug-electron-platform
user-invocable: false
metadata:
  audience: handoff
description: Internal handoff target invoked by add-feature, modify-feature, and debug when working in Electron apps to catch and fix OS-specific bugs (macOS, Windows, Linux) before they ship. Covers keyboard accelerators (CmdOrCtrl, Meta vs Ctrl, role:), file paths (path.join vs string concat, separators, case sensitivity, drive letters, UNC, spaces in paths), shell/spawn (.exe extensions, quoting, shebangs), app data dirs (app.getPath vs hardcoded ~/Library), menus and tray (macOS app-menu role, template icons, traffic lights), line endings (CRLF/LF), file watchers, protocol handlers, single-instance, auto-updater quirks. Activates when code touches `path.`, `fs.`, `shell.`, `child_process`, `BrowserWindow`, `Menu`, `globalShortcut`, `accelerator:`, `app.getPath`, `process.platform`, hardcoded paths like `~/Library` or `C:\` or `/tmp`, hardcoded `\n` line endings. Trigger phrases for routing: "works on my mac but not windows", "ship to windows/linux", "cross-platform", "doesn't work on [OS]", "platform-specific", "electron path", "accelerator". Skip for non-Electron apps (web/server/CLI), pure UI styling unrelated to OS chrome, and native module ABI/rebuild errors (use code-debug-runtime-boundary instead).
---

# Code Debug Electron Platform

Electron lets one codebase target macOS, Windows, and Linux — but every OS-divergent API is a place where "works on my machine" ships a regression. This skill is a triage router: detect the category, load the matching reference, apply the fix.

## How to use

1. Identify which category the change touches (one or more):
   - **Keyboard / accelerators / shortcuts** → `references/keyboard.md`
   - **File paths, app dirs, user data, temp files** → `references/paths.md`
   - **Shell commands, spawn, child_process, binaries** → `references/shell-spawn.md`
   - **Menus, tray, dock, title bar, window chrome** → `references/menus-ui.md`
   - **File I/O, line endings, watchers, atomic writes** → `references/line-endings-fs.md`
   - **Auto-updater, protocol handlers, single-instance, notifications, deep links** → `references/runtime-quirks.md`

2. **MANDATORY READ** the matching reference before suggesting or writing code in that category. Do not load references for categories the change does not touch.

3. Apply the fix from the reference. If the change crosses categories, load each one in turn — do not guess by analogy from one category to another.

4. After fixing, scan the diff for the same category leaking into other files (e.g., one fixed `path.join` while three other concatenations remain).

## Triage signals

Map a code or symptom signal → category before deciding which reference to load.

| Signal in code or report | Category |
|---|---|
| `'/'` or `'\\'` in a path string, `path` + `'/'` + `file`, hardcoded `~/Library`, `C:\`, `/tmp`, `/usr/local` | paths |
| `app.getPath` missing, reading/writing config in `__dirname` or `process.cwd()` | paths |
| `accelerator: 'Ctrl+...'`, `globalShortcut.register`, `Meta` vs `Ctrl`, menu shortcuts | keyboard |
| `child_process.spawn`/`exec`, calling a sidecar binary, `shell: true`, missing `.exe` | shell-spawn |
| `Menu.buildFromTemplate` without `role:`, missing app menu on macOS, tray icon not monochrome on macOS | menus-ui |
| `'\n'` written to user-visible files, `fs.watch` behaving inconsistently, non-atomic config writes | line-endings-fs |
| `setAsDefaultProtocolClient`, `requestSingleInstanceLock`, `autoUpdater`, `Notification`, dock badge | runtime-quirks |
| User reports "works on mac, broken on windows" (or any OS pair) without a stack trace | start with paths + shell-spawn (most common); widen if needed |

## NEVER

- **NEVER concatenate path segments with `'/'` or `'\\'`**
  **Instead:** `path.join(...)` for filesystem paths; `path.posix.join(...)` only for URL-style paths that must stay forward-slash.
  **Why:** Windows accepts `/` in many APIs but not all (especially when passed to native code, shells, or stored in config); mixing separators corrupts comparisons (`a/b` ≠ `a\b`) and breaks `path.relative`.

- **NEVER hardcode `Ctrl+...` or `Cmd+...` in an `accelerator`**
  **Instead:** Use `'CmdOrCtrl+...'` (and `'Alt'`, not `'Option'`; `'Super'` is Linux-only).
  **Why:** Hardcoding one modifier ships a shortcut that feels foreign on the other OS and can collide with system shortcuts (e.g., `Cmd+H` hides app on macOS).

- **NEVER hardcode user-data paths like `~/Library/Application Support/MyApp` or `%APPDATA%\MyApp`**
  **Instead:** `app.getPath('userData' | 'appData' | 'logs' | 'temp' | 'home' | 'downloads')`.
  **Why:** Hardcoded paths break under sandboxing, portable installs, redirected folders (Windows Group Policy), XDG overrides on Linux, and any user whose home dir contains spaces or non-ASCII chars.

- **NEVER assume the filesystem is case-insensitive (or case-sensitive)**
  **Instead:** Treat path comparisons as opaque — never `pathA === pathB` for "same file"; use `fs.realpathSync` + canonical form, or compare inodes.
  **Why:** macOS default is case-insensitive, Linux is case-sensitive, Windows is case-insensitive but case-preserving. Code that works on macOS (`Foo.txt` opens `foo.txt`) fails on Linux silently.

- **NEVER spawn a binary without handling the `.exe` extension and PATH lookup**
  **Instead:** Resolve via `process.platform === 'win32' ? 'tool.exe' : 'tool'` and use absolute paths from `app.getAppPath()` or `process.resourcesPath` for bundled binaries.
  **Why:** `spawn('tool')` works on macOS/Linux, returns ENOENT on Windows. Bundled sidecars also live under different paths in dev vs packaged builds.

- **NEVER use `shell: true` with user-supplied or dynamic arguments**
  **Instead:** Pass args as an array to `spawn` with `shell: false`; the shell on each OS quotes differently (cmd.exe vs bash vs zsh).
  **Why:** Same string is interpreted differently per OS and is a command-injection vector. The "fix" of escaping for one shell breaks the other.

- **NEVER rely on `process.cwd()` or `__dirname` for runtime files**
  **Instead:** `app.getAppPath()` for app code, `app.getPath('userData')` for writable state, `process.resourcesPath` for packaged extras.
  **Why:** `cwd` is wherever the user launched from (often `/` on macOS double-click); `__dirname` points inside an asar archive in packaged builds and is read-only.

## After-the-fix check

Before reporting done, ask: "Did I introduce any new `process.platform` branch?" If yes, would an Electron built-in (CmdOrCtrl, app.getPath, role:, shell.openPath, shell.openExternal, dialog.showOpenDialog) eliminate the branch? Prefer the abstraction over the branch — every branch is a third surface to test.

If the user cannot test on the other OSes, say so explicitly: "I applied the cross-platform fix but only verified on [current OS]. The Windows/Linux paths need a smoke test before shipping."
