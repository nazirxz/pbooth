import { contextBridge, ipcRenderer } from 'electron'

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

contextBridge.exposeInMainWorld('pbooth', {
  quit: () => ipcRenderer.invoke('app:quit'),
  version: () => ipcRenderer.invoke('app:version'),
  print: (
    dataUrl: string,
    opts?: {
      deviceName?: string
      silent?: boolean
      landscape?: boolean
      rotation?: number
    }
  ) => ipcRenderer.invoke('printer:print', dataUrl, opts) as Promise<PrintResult>,
  getPrinters: () => ipcRenderer.invoke('printer:list'),
})

declare global {
  interface Window {
    pbooth: {
      quit: () => Promise<void>
      version: () => Promise<string>
      print: (
        dataUrl: string,
        opts?: {
          deviceName?: string
          silent?: boolean
          landscape?: boolean
          rotation?: number
        }
      ) => Promise<PrintResult>
      getPrinters: () => Promise<PrinterSummary[]>
    }
  }
}
