import { app, BrowserWindow, ipcMain, globalShortcut } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const isDev = !!process.env.VITE_DEV_SERVER_URL

// Landscape target 1920x1080. Dev window = scaled to fit laptop display.
const TARGET = { width: 1920, height: 1080 }

function createWindow() {
  const win = new BrowserWindow({
    width: isDev ? 1280 : TARGET.width,
    height: isDev ? 720 : TARGET.height,
    minWidth: 960,
    minHeight: 540,
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

ipcMain.handle('printer:print', async (_event, dataUrl: string) => {
  const win = BrowserWindow.getFocusedWindow()
  if (!win) throw new Error('No focused window for print')

  return new Promise<void>((resolve, reject) => {
    const printHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          * { margin: 0; padding: 0; }
          body { display: flex; justify-content: center; align-items: center; }
          img { max-width: 100%; height: auto; }
        </style>
      </head>
      <body><img src="${dataUrl}" /></body>
      </html>
    `

    const printWin = new BrowserWindow({
      show: false,
      webPreferences: { offscreen: true },
    })

    printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(printHTML)}`)

    printWin.webContents.once('did-finish-load', () => {
      printWin.webContents.print(
        {
          silent: true,
          deviceName: 'DNP',
          printBackground: true,
          margins: { marginType: 'none' },
        },
        (success, failureReason) => {
          printWin.close()
          if (success) {
            resolve()
          } else {
            reject(new Error(failureReason || 'Print failed'))
          }
        },
      )
    })
  })
})
