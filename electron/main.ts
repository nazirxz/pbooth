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
      // TODO: revert to `isDev` after debugging QRIS issue on other laptops
      devTools: true,
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

ipcMain.handle(
  'printer:print',
  async (
    _event,
    dataUrl: string,
    opts?: {
      deviceName?: string
      silent?: boolean
      landscape?: boolean
      rotation?: number
    }
  ) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) throw new Error('No focused window for print')

    const wanted = (opts?.deviceName ?? '').trim()
    let deviceName = wanted
    if (wanted) {
      try {
        const printers = await win.webContents.getPrintersAsync()
        const match = printers.find((p) => p.name.toLowerCase().includes(wanted.toLowerCase()))
        deviceName = match ? match.name : wanted
      } catch {
        deviceName = wanted
      }
    }
    const silent = opts?.silent ?? true
    const landscape = opts?.landscape ?? false
    const rotation = opts?.rotation ?? 0

    return new Promise<void>((resolve, reject) => {
      const isRotated = rotation === 90 || rotation === 270
      const imgStyle = isRotated
        ? `
          position: absolute;
          top: 50%;
          left: 50%;
          width: 100vh;
          height: 100vw;
          transform: translate(-50%, -50%) rotate(${rotation}deg);
          transform-origin: center center;
          object-fit: cover;
        `
        : `
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          transform: rotate(${rotation}deg);
        `

      const printHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            @page { size: ${landscape ? '6in 4in' : '4in 6in'}; margin: 0; }
            html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: white; }
            .print-container {
              position: relative;
              width: 100%;
              height: 100%;
            }
            img { ${imgStyle} }
          </style>
        </head>
        <body>
          <div class="print-container">
            <img src="${dataUrl}" />
          </div>
        </body>
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
            silent,
            deviceName,
            printBackground: true,
            margins: { marginType: 'none' },
            landscape,
            pageSize: landscape
              ? { width: 152_400, height: 101_600 } // 6x4 landscape in microns
              : { width: 101_600, height: 152_400 }, // 4x6 portrait in microns
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
  },
)

ipcMain.handle('printer:list', async () => {
  const win = BrowserWindow.getFocusedWindow()
  if (!win) return []
  try {
    const printers = await win.webContents.getPrintersAsync()
    return printers.map((p) => p.name)
  } catch (e) {
    console.error('Failed to get printers:', e)
    return []
  }
})

