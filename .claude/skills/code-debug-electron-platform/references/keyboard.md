# Keyboard, Accelerators, Shortcuts

## Modifier mapping

| Intent | Use this token | Notes |
|---|---|---|
| Primary action key (Cmd on mac, Ctrl elsewhere) | `CmdOrCtrl` | Default for Save/Open/Copy/Paste menu items |
| Force Cmd only (mac) | `Cmd` or `Command` | Only when intentionally mac-only |
| Force Ctrl only | `Ctrl` or `Control` | Rare — usually you want CmdOrCtrl |
| Alt / Option | `Alt` | `Option` is NOT valid |
| Shift | `Shift` | |
| Win/⌘/Super | `Super` | Linux/Windows; `Meta` is also accepted but inconsistent |
| Function keys | `F1`–`F24` | |

Always prefer `CmdOrCtrl` in `accelerator:` strings. Use `Cmd` or `Ctrl` exclusively only when matching a true OS-specific gesture (e.g., `Cmd+,` for macOS Preferences).

## Menu items: prefer `role:` over `accelerator:`

When a menu item maps to a standard action, use `role:` — Electron supplies the correct accelerator, label, and behavior per OS:

```js
{ role: 'undo' }        // Cmd+Z / Ctrl+Z, correctly labeled
{ role: 'redo' }        // Cmd+Shift+Z on mac, Ctrl+Y on win/linux
{ role: 'cut' | 'copy' | 'paste' | 'pasteAndMatchStyle' | 'selectAll' }
{ role: 'minimize' | 'close' | 'quit' | 'toggleFullScreen' }
{ role: 'reload' | 'forceReload' | 'toggleDevTools' }
{ role: 'zoomIn' | 'zoomOut' | 'resetZoom' }
{ role: 'appMenu' }     // The macOS app menu (About, Services, Hide, Quit)
{ role: 'fileMenu' | 'editMenu' | 'viewMenu' | 'windowMenu' | 'help' }
```

A custom `accelerator:` overrides `role:`'s defaults — only set one when you genuinely need a non-standard binding.

## macOS app menu is required

On macOS, the first menu in `Menu.setApplicationMenu` MUST be the app menu (the bold one with the app name). If you skip it, the user gets a default menu that doesn't include your About/Quit. Build it via `{ role: 'appMenu' }` rather than constructing manually.

```js
const isMac = process.platform === 'darwin'
const template = [
  ...(isMac ? [{ role: 'appMenu' }] : []),
  { role: 'fileMenu' },
  { role: 'editMenu' },
  { role: 'viewMenu' },
  { role: 'windowMenu' },
]
```

## globalShortcut caveats

- Register in `app.whenReady()`, NOT before.
- Always `globalShortcut.unregisterAll()` in `will-quit`.
- Some combos are reserved by the OS (e.g., `Cmd+Space` on mac for Spotlight, `Ctrl+Alt+Del` on Windows). `register` returns `false` silently — check the return value.
- `MediaPlayPause`, `MediaNextTrack`, `MediaPreviousTrack` work on all three but require user-granted accessibility on macOS in some Electron versions.

## Right-click and context menus

- Linux: right-click is `contextmenu` event reliably.
- macOS: trackpad two-finger tap fires `contextmenu`; Ctrl+click also fires `contextmenu` AND a left-click — guard against double-handling.
- Windows: right-click is straightforward; pen/touch may fire long-press as `contextmenu` with different timing.

## Common bugs

- **`accelerator: 'Ctrl+S'`** ships a menu that shows "Ctrl+S" on macOS where users expect "⌘S". Fix: `'CmdOrCtrl+S'`.
- **`accelerator: 'Cmd+Q'`** doesn't quit on Windows/Linux. Fix: `'CmdOrCtrl+Q'` or `{ role: 'quit' }`.
- **Duplicating Edit menu items manually** instead of using `{ role: 'editMenu' }` — breaks native services menu integration on macOS and standard shortcuts on Linux.
- **Listening to `keydown` for `e.metaKey` only** — only matches Cmd on mac, Win key on Windows. Use `e.metaKey || e.ctrlKey` for "primary modifier" intent, or check `process.platform` once and store the right key.
