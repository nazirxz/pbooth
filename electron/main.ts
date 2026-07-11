import { app, BrowserWindow, ipcMain, globalShortcut, type IpcMainInvokeEvent } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const isDev = !!process.env.VITE_DEV_SERVER_URL

// Landscape target 1920x1080. Dev window = scaled to fit laptop display.
const TARGET = { width: 1920, height: 1080 }
const PRINT_LOAD_TIMEOUT_MS = 15_000
const PRINT_WINDOW_CLOSE_DELAY_MS = 5_000

interface PrinterSummary {
  name: string
  displayName?: string
  description?: string
  status: number
  isDefault: boolean
}

interface PrintResult {
  acceptedByOS: boolean
  deviceName: string
  requestedDeviceName: string
  silent: boolean
  landscape: boolean
  rotation: number
  pageSize: string
  note: string
  printer?: PrinterSummary
}

function getInvokerWindow(event: IpcMainInvokeEvent) {
  return BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getFocusedWindow()
}

function summarizePrintPayload(dataUrl: string) {
  const commaIndex = dataUrl.indexOf(',')
  const header = commaIndex >= 0 ? dataUrl.slice(0, commaIndex) : dataUrl.slice(0, 80)
  const payloadLength = commaIndex >= 0 ? dataUrl.length - commaIndex - 1 : dataUrl.length
  const approxBytes = header.includes(';base64')
    ? Math.floor((payloadLength * 3) / 4)
    : Buffer.byteLength(dataUrl)

  return {
    header,
    chars: dataUrl.length,
    approxBytes,
  }
}

function summarizePrinters(
  printers: Awaited<ReturnType<Electron.WebContents['getPrintersAsync']>>,
): PrinterSummary[] {
  return printers.map((p) => ({
    name: p.name,
    displayName: p.displayName,
    description: p.description,
    status: p.status,
    isDefault: p.isDefault,
  }))
}

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
    event,
    dataUrl: string,
    opts?: {
      deviceName?: string
      silent?: boolean
      landscape?: boolean
      rotation?: number
    }
  ) => {
    const win = getInvokerWindow(event)
    if (!win) {
      console.error('[printer:main] No renderer window found for print request')
      throw new Error('No renderer window for print')
    }

    const wanted = (opts?.deviceName ?? '').trim()
    let deviceName = wanted
    let printerNames: string[] = []
    let matchedPrinter: PrinterSummary | undefined

    console.info('[printer:main] Print request received', {
      requestedDeviceName: wanted || '(default)',
      options: opts,
      payload: summarizePrintPayload(dataUrl),
      senderUrl: event.sender.getURL(),
    })

    if (wanted) {
      try {
        const printers = await win.webContents.getPrintersAsync()
        printerNames = printers.map((p) => p.name)
        console.info('[printer:main] Installed printers', summarizePrinters(printers))

        const wantedLower = wanted.toLowerCase()
        const exactMatch = printers.find((p) =>
          [p.name, p.displayName].some((name) => name?.toLowerCase() === wantedLower),
        )
        const partialMatch = printers.find((p) =>
          [p.name, p.displayName].some((name) => name?.toLowerCase().includes(wantedLower)),
        )
        const match = exactMatch ?? partialMatch

        if (!match) {
          const message = `Printer matching "${wanted}" was not found. Installed printers: ${printerNames.join(', ') || '(none)'}`
          console.error('[printer:main]', message)
          throw new Error(message)
        }

        deviceName = match.name
        matchedPrinter = summarizePrinters([match])[0]
        console.info('[printer:main] Matched printer', {
          requestedDeviceName: wanted,
          deviceName,
          displayName: match.displayName,
          isDefault: match.isDefault,
          status: match.status,
        })
      } catch (e) {
        console.error('[printer:main] Failed while resolving printer', e)
        if (e instanceof Error && e.message.includes('was not found')) throw e
        deviceName = wanted
      }
    } else {
      try {
        const printers = await win.webContents.getPrintersAsync()
        printerNames = printers.map((p) => p.name)
        console.info('[printer:main] Installed printers', summarizePrinters(printers))
        const defaultPrinter = printers.find((p) => p.isDefault)
        console.info('[printer:main] Using default printer', defaultPrinter?.name ?? '(OS default)')
      } catch (e) {
        console.warn('[printer:main] Failed to list printers before default print', e)
      }
    }

    const silent = opts?.silent ?? true
    const landscape = opts?.landscape ?? false
    const rotation = opts?.rotation ?? 0

    return new Promise<PrintResult>((resolve, reject) => {
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
      })

      let settled = false
      const finish = (fn: () => void) => {
        if (settled) return
        settled = true
        clearTimeout(loadTimeout)
        fn()
      }

      const closePrintWindow = () => {
        if (!printWin.isDestroyed()) printWin.close()
      }

      const closePrintWindowSoon = () => {
        setTimeout(closePrintWindow, PRINT_WINDOW_CLOSE_DELAY_MS)
      }

      const loadTimeout = setTimeout(() => {
        finish(() => {
          const message = `Print page did not finish loading within ${PRINT_LOAD_TIMEOUT_MS}ms`
          console.error('[printer:main]', message)
          closePrintWindow()
          reject(new Error(message))
        })
      }, PRINT_LOAD_TIMEOUT_MS)

      printWin.webContents.once('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
        finish(() => {
          console.error('[printer:main] Print page failed to load', {
            errorCode,
            errorDescription,
            validatedURL: validatedURL.slice(0, 120),
          })
          closePrintWindow()
          reject(new Error(`Print page failed to load: ${errorDescription || errorCode}`))
        })
      })

      printWin.webContents.once('render-process-gone', (_event, details) => {
        finish(() => {
          console.error('[printer:main] Print window render process gone', details)
          closePrintWindow()
          reject(new Error(`Print window renderer crashed: ${details.reason}`))
        })
      })

      printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(printHTML)}`).catch((e) => {
        finish(() => {
          console.error('[printer:main] Failed to load print page', e)
          closePrintWindow()
          reject(e)
        })
      })

      printWin.webContents.once('did-finish-load', async () => {
        try {
          const imageInfo = await printWin.webContents.executeJavaScript(`
            new Promise((resolve, reject) => {
              const img = document.querySelector('img');
              if (!img) {
                reject(new Error('Print image element not found'));
                return;
              }
              if (img.complete && img.naturalWidth > 0) {
                resolve({ width: img.naturalWidth, height: img.naturalHeight });
                return;
              }
              img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
              img.onerror = () => reject(new Error('Print image failed to load'));
            })
          `)
          console.info('[printer:main] Print page ready', {
            deviceName: deviceName || '(default)',
            silent,
            landscape,
            rotation,
            pageSize: landscape ? '6x4' : '4x6',
            image: imageInfo,
          })
        } catch (e) {
          finish(() => {
            console.error('[printer:main] Print image was not ready', e)
            closePrintWindow()
            reject(e)
          })
          return
        }

        clearTimeout(loadTimeout)
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
            finish(() => {
              if (success) {
                const result: PrintResult = {
                  acceptedByOS: true,
                  deviceName: deviceName || '(default)',
                  requestedDeviceName: wanted || '(default)',
                  silent,
                  landscape,
                  rotation,
                  pageSize: landscape ? '6x4' : '4x6',
                  note:
                    'Electron/Windows accepted the print job. This does not prove the physical printer completed it.',
                  printer: matchedPrinter,
                }
                console.info('[printer:main] Print job accepted by OS', result)
                console.info('[printer:main] Keeping hidden print window alive briefly for driver spool', {
                  closeDelayMs: PRINT_WINDOW_CLOSE_DELAY_MS,
                })
                closePrintWindowSoon()
                resolve(result)
              } else {
                closePrintWindow()
                const message = failureReason || 'Print failed'
                console.error('[printer:main] Print job failed', {
                  reason: message,
                  deviceName: deviceName || '(default)',
                  requestedDeviceName: wanted || '(default)',
                  installedPrinters: printerNames,
                })
                reject(new Error(message))
              }
            })
          },
        )
      })
    })
  },
)

ipcMain.handle('printer:list', async (event) => {
  const win = getInvokerWindow(event)
  if (!win) return []
  try {
    const printers = await win.webContents.getPrintersAsync()
    console.info('[printer:main] Printer list requested', summarizePrinters(printers))
    return summarizePrinters(printers)
  } catch (e) {
    console.error('[printer:main] Failed to get printers:', e)
    return []
  }
})
