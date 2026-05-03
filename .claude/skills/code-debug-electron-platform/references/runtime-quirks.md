# Runtime Quirks: Updater, Protocols, Single Instance, Notifications, Deep Links

## Single-instance lock

Without this, double-clicking the app on Windows opens a second copy. On macOS the OS naturally prevents a second instance.

```js
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv, _cwd) => {
    // User tried to launch a second copy — focus the existing window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
    // Windows/Linux deep links arrive in argv here — see "Deep links" below
    handleDeepLinkFromArgv(argv)
  })
}
```

## Deep links / custom protocol handler

```js
app.setAsDefaultProtocolClient('myapp')   // myapp:// URLs route to the app
```

How the URL is delivered varies by OS:

| OS | Delivery |
|---|---|
| macOS | `app.on('open-url', (e, url) => ...)` — fires whether app was already running or just launched |
| Windows | URL is the LAST argument in `process.argv` on launch, OR in the `argv` of the `second-instance` handler if the app was already running |
| Linux | Same as Windows — argv |

```js
// macOS
app.on('open-url', (event, url) => { event.preventDefault(); handleDeepLink(url) })

// Windows/Linux: parse from argv on first launch + on second-instance
function handleDeepLinkFromArgv(argv) {
  const url = argv.find(a => a.startsWith('myapp://'))
  if (url) handleDeepLink(url)
}
handleDeepLinkFromArgv(process.argv)  // initial launch
```

For Windows, `setAsDefaultProtocolClient` requires special args when launched from a packaged build:
```js
if (process.platform === 'win32') {
  app.setAsDefaultProtocolClient('myapp', process.execPath, [path.resolve(process.argv[1] || '')])
}
```

In dev (`electron .`), Windows protocol registration won't survive — only test on packaged builds.

## Auto-updater

`electron-updater` (from electron-builder) is the practical default. Per-OS realities:

| OS | Update format | Code-signing required? | Notes |
|---|---|---|---|
| macOS | Squirrel.Mac (zip) | YES — must be signed AND notarized; otherwise updates silently fail | App must be inside `/Applications` to update (not `~/Downloads`) |
| Windows | NSIS or Squirrel.Windows | Recommended; SmartScreen warns without EV cert | NSIS supports per-machine and per-user installs differently |
| Linux | AppImage / deb / rpm / snap | N/A | AppImage auto-updates if the user keeps it in a writable dir; deb/rpm/snap update via system package manager — your auto-updater should be a no-op |

```js
import { autoUpdater } from 'electron-updater'
autoUpdater.checkForUpdatesAndNotify()  // checks + downloads + prompts
```

Common gotchas:
- macOS update appears to download but never installs → app isn't notarized, OR app is running from `~/Downloads` instead of `/Applications`.
- Windows update hangs → installer needs UAC elevation; per-machine install requires admin, per-user does not. Pick `oneClick: true, perMachine: false` in electron-builder for friction-free auto-updates.
- Linux: don't ship auto-updater calls in deb/rpm builds — let the package manager handle it. Detect via `process.env.APPIMAGE` to scope updater to AppImage only.

## Notifications

```js
import { Notification } from 'electron'
new Notification({ title: 'Hi', body: 'Hello' }).show()
```

OS quirks:
- **macOS:** First notification triggers permission prompt; if user denies, `Notification.isSupported()` still returns `true` but `.show()` is silent. Provide a settings link to System Settings → Notifications. macOS also requires the app be code-signed with a valid Application ID for the notification to attribute to the app (otherwise shows "Electron").
- **Windows:** Need to `app.setAppUserModelId('com.yourcompany.yourapp')` BEFORE `app.whenReady()`, otherwise notifications attribute to "Electron" or to the wrong app on Windows 10/11. The ID must match what's in your installer.
- **Linux:** Behavior varies wildly per DE; some have no notification daemon at all. Don't rely on user-action callbacks (`click` event) — not all DEs support them.

```js
if (process.platform === 'win32') {
  app.setAppUserModelId('com.example.myapp')
}
```

## File associations

Declared in electron-builder config, NOT in code. Per-OS:
- macOS: `Info.plist` `CFBundleDocumentTypes` (electron-builder `mac.fileAssociations`).
- Windows: registry entries (electron-builder `fileAssociations` + NSIS handles install).
- Linux: `.desktop` file `MimeType=` (electron-builder handles for AppImage/deb/rpm).

When the user opens a file:
- macOS: `app.on('open-file', (e, path) => ...)` — fires before/after ready.
- Windows/Linux: file path in `process.argv` (and in `second-instance` argv if already running).

```js
app.on('will-finish-launching', () => {
  app.on('open-file', (event, filePath) => { event.preventDefault(); openFile(filePath) })
})
```

## Login / launch on startup

```js
app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true })
```

- macOS: works for unsigned apps in dev; for signed, prefer `LaunchAgent` plist (electron-builder can generate). `openAsHidden` honored.
- Windows: writes `HKCU\...\Run` registry entry; `openAsHidden` is honored only with `args: ['--hidden']` and your code reading that arg.
- Linux: writes a `.desktop` entry to `~/.config/autostart/`; `openAsHidden` ignored.

## Common bugs

- **Second `myapp` window opens on Windows when user clicks the app twice** — no single-instance lock. Fix: `requestSingleInstanceLock`.
- **Deep link works on macOS dev, never fires on Windows** — Windows delivers via argv, not `open-url`. Fix: parse `process.argv` + handle in `second-instance`.
- **Auto-update silently does nothing on macOS** — app isn't signed/notarized, or running from `~/Downloads`. Fix: notarize (see electron-notarize) and ship a "please drag to Applications" dialog on first run.
- **Notifications attribute to "Electron" on Windows** — missing `app.setAppUserModelId`. Fix: set it before `whenReady`, matching the installer's app ID.
- **`electron-updater` errors out on Linux deb install** — package-manager-managed installs can't update themselves. Fix: gate updater behind `process.env.APPIMAGE` or `!app.isPackaged ? false : isAppImage`.
- **First-launch deep link is missed** — handler registered after the URL was already parsed from argv. Fix: read `process.argv` at top of main process AND register `open-url` / `second-instance` handlers.
