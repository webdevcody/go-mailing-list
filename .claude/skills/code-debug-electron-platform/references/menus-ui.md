# Menus, Tray, Dock, Window Chrome

## App menu (macOS) vs no menu (Windows/Linux)

macOS apps have a **persistent app menu bar** at the top of the screen, not per-window. Windows/Linux apps have a per-window menu (or no menu, your choice).

```js
const isMac = process.platform === 'darwin'
const template = [
  ...(isMac ? [{ role: 'appMenu' }] : []),
  { role: 'fileMenu' },
  { role: 'editMenu' },
  { role: 'viewMenu' },
  { role: 'windowMenu' },
  { role: 'help', submenu: [...] },
]
Menu.setApplicationMenu(Menu.buildFromTemplate(template))
```

To hide the menu bar entirely on Windows/Linux: `mainWindow.setMenuBarVisibility(false)` or `autoHideMenuBar: true` in BrowserWindow options. Don't do this on macOS — `setApplicationMenu(null)` removes it but macOS still expects an app menu (the bold one with Quit).

## Tray icons

| OS | Required size | Notes |
|---|---|---|
| macOS | 22×22 (or 16×16 base, with @2x and @3x) | Use `nativeImage.setTemplateImage(true)` so it adapts to dark/light menu bar — the icon must be black with transparency only |
| Windows | 16×16 base, ICO with multiple sizes | Color icons OK |
| Linux | 22×22 (or larger), PNG | Behavior varies by desktop env (GNOME has historically been hostile to tray) |

```js
import { nativeImage, Tray } from 'electron'
const icon = nativeImage.createFromPath(trayIconPath)
if (process.platform === 'darwin') icon.setTemplateImage(true)
const tray = new Tray(icon)
```

A **template image** must be monochrome (black with alpha). Color templates render wrong — usually as solid black blobs. Bug pattern: dragging the same color icon used on Windows into macOS tray, getting a black square.

## Window controls / title bar

| OS | Default chrome | Common customization |
|---|---|---|
| macOS | Traffic lights top-left | `titleBarStyle: 'hiddenInset'` keeps lights, hides bar; position with `trafficLightPosition` |
| Windows | Min/Max/Close top-right | `titleBarStyle: 'hidden'` + `titleBarOverlay` for native-controlled overlay buttons |
| Linux | DE-dependent (GNOME has CSD, KDE has SSD) | `titleBarStyle: 'hidden'` + draw your own |

```js
new BrowserWindow({
  titleBarStyle: 'hidden',
  ...(process.platform === 'darwin' && { trafficLightPosition: { x: 12, y: 12 } }),
  titleBarOverlay: process.platform !== 'darwin' ? { color: '#1f1f1f', symbolColor: '#fff' } : false,
})
```

For draggable regions in HTML: `-webkit-app-region: drag` on the title bar element, `-webkit-app-region: no-drag` on buttons inside it. Without `no-drag`, buttons in the drag region don't receive clicks (clicks become drags).

## Dock and taskbar

```js
// macOS only — guard before calling
if (process.platform === 'darwin') {
  app.dock.setBadge('3')
  app.dock.bounce('informational')
  app.dock.setIcon(nativeImage.createFromPath(...))
  app.dock.hide()  // hides app from dock (background utility)
}
```

`app.dock` is `undefined` on Windows/Linux — accessing without guarding throws.

Windows taskbar progress: `mainWindow.setProgressBar(0.5)` — works on Windows and macOS dock; no-op on most Linux.

Windows taskbar overlay icon: `mainWindow.setOverlayIcon(image, description)` — Windows-only.

## Window behavior on close

- **macOS:** Closing the last window does NOT quit the app (per Apple HIG). Apps stay alive in the dock until ⌘Q.
- **Windows/Linux:** Closing the last window typically quits.

```js
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  // macOS: re-create window when dock icon clicked and no windows open
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
```

Both handlers are required for native-feeling cross-platform behavior. Missing `activate` is the #1 reason "the app icon does nothing when I click it" on macOS.

## Vibrancy / blur effects

- macOS: `vibrancy: 'sidebar' | 'fullscreen-ui' | 'titlebar' | ...` in BrowserWindow options. Background must have alpha < 1 (otherwise the opaque color hides the blur).
- Windows 11: `backgroundMaterial: 'mica' | 'acrylic' | 'tabbed'`. Requires `transparent: true` + Win11.
- Linux: no equivalent; degrade gracefully to a solid color.

## Common bugs

- **No app menu on macOS** — quit/about/preferences gestures don't work as expected. Fix: `{ role: 'appMenu' }` first in template.
- **Color tray icon shows as black square on macOS** — `setTemplateImage(true)` was called on a color image. Fix: use a monochrome (black + alpha) image, OR don't call `setTemplateImage` and accept that it won't follow dark/light mode.
- **App quits when last window closes on macOS** — should usually stay open. Fix: guard `window-all-closed` handler with `process.platform !== 'darwin'`.
- **Buttons in custom title bar are unclickable** — drag region eats the events. Fix: `-webkit-app-region: no-drag` on the buttons.
- **Calling `app.dock.setBadge` crashes on Windows** — no `dock` object. Fix: guard with `process.platform === 'darwin'`.
- **Tray icon disappears on Linux** — some desktop environments (GNOME without extension) don't show tray icons. Document the requirement; consider an in-window indicator as fallback.
