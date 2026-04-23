import { app, BrowserWindow, ipcMain, globalShortcut } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const isDev = !!process.env.VITE_DEV_SERVER_URL

// Portrait target 1080x1920. Dev window = scaled to fit laptop display.
const TARGET = { width: 1080, height: 1920 }

function createWindow() {
  const win = new BrowserWindow({
    width: isDev ? 540 : TARGET.width,
    height: isDev ? 960 : TARGET.height,
    minWidth: 360,
    minHeight: 640,
    fullscreen: !isDev,
    kiosk: !isDev,
    frame: isDev,
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: isDev,
      spellcheck: false,
      backgroundThrottling: false,
    },
  })

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL!)
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  win.webContents.on('before-input-event', (event, input) => {
    // Block common kiosk-escape shortcuts in production
    if (!isDev && (input.meta || input.control) && ['w', 'q', 'r'].includes(input.key.toLowerCase())) {
      event.preventDefault()
    }
  })
}

app.whenReady().then(() => {
  createWindow()

  if (!isDev) {
    globalShortcut.register('CommandOrControl+Alt+Q', () => app.quit())
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => globalShortcut.unregisterAll())

ipcMain.handle('app:quit', () => app.quit())
ipcMain.handle('app:version', () => app.getVersion())
