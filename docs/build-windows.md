# Building the Windows installer (.exe)

Pbooth ships as a NSIS Windows installer built with
[`electron-builder`](https://www.electron.build/). Config lives in
`package.json` under the `"build"` key.

## Prerequisites (on the Windows machine)

- Windows 10 / 11 (x64)
- [Node.js 20+](https://nodejs.org/) (LTS recommended)
- Git
- ~2 GB free disk (electron-builder caches Electron runtime + creates `release/`)

> Build from the `main` branch — that's the production target.
> `development` is sandbox/dev only.

## Steps

```powershell
# 1. Clone main branch
git clone -b main <repo-url> Pbooth
cd Pbooth

# 2. Drop in the production env file
#    (gitignored — never committed; copy values from .env.example or get from team)
copy .env.example .env.production
notepad .env.production
#    fill VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (production project)

# 3. Install deps
npm install

# 4. Build the installer
npm run build:win
```

Output lands in `release/`:

```
release\
├── Pbooth-Setup-0.1.0.exe        ← the installer (ship this)
├── win-unpacked\                  ← unpacked app (useful for debugging)
└── ...
```

Double-click `Pbooth-Setup-0.1.0.exe` to install. The installer:

- Asks the user where to install (not silent)
- Creates a Desktop shortcut + Start menu entry called "Pbooth"
- Installs per-user (no admin required)
- Leaves user data on uninstall (in case of reinstall)

## Verify before shipping

After install, launch Pbooth from the Start menu and check:

- It opens fullscreen kiosk mode (no window chrome, no menu bar)
- Boot → Home → Payment flow works against the **production** DOKU env
- Press `Ctrl+Alt+Q` to quit (the only kiosk-escape we leave enabled)

## Quick-test without packaging (faster iteration)

Skip the NSIS step and run the unpacked build directly:

```powershell
npm run pack
# launch release\win-unpacked\Pbooth.exe
```

Same binary, no installer wrapping — saves ~30 s per cycle while
iterating on a build issue.

## Updating the app icon

The icon at `build/icon.png` (512×512 PNG, derived from
`src/asset/euorna_black.jpeg`) gets compiled into the .exe. To swap:

```powershell
# Replace with a 512x512 PNG (or 256x256 .ico)
copy your-new-icon.png build\icon.png
npm run build:win
```

For best quality on Windows, convert to a multi-resolution `.ico`
(16, 32, 48, 64, 128, 256 px) and update `build.win.icon` in
`package.json` to `build/icon.ico`.

## Troubleshooting

**`electron-builder` fails downloading Electron / 7za**
Behind a corporate proxy? Set `HTTPS_PROXY` env var before
`npm run build:win`, or pre-download to
`%LOCALAPPDATA%\electron\Cache`.

**Installer runs but app shows a white screen**
Vite env vars must be set **before** the build — `dist/` inlines
them at compile time. Re-check `.env.production` and run
`npm run build:win` again.

**"Cannot find module 'electron'" on launch**
`npm install` was skipped or failed. Wipe `node_modules\` and
`package-lock.json`, then `npm install` again.

**Antivirus flags the unsigned `.exe`**
Expected — we don't code-sign. For production deploys to client
machines, get an Authenticode certificate and add
`"win.certificateFile"` + `"win.certificatePassword"` (or use
env vars) to the build config.
