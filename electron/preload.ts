import { contextBridge, ipcRenderer } from 'electron'

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
  ) => ipcRenderer.invoke('printer:print', dataUrl, opts),
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
      ) => Promise<void>
      getPrinters: () => Promise<string[]>
    }
  }
}
