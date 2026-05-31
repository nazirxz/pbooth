import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('pbooth', {
  quit: () => ipcRenderer.invoke('app:quit'),
  version: () => ipcRenderer.invoke('app:version'),
  print: (dataUrl: string) => ipcRenderer.invoke('printer:print', dataUrl),
})

declare global {
  interface Window {
    pbooth: {
      quit: () => Promise<void>
      version: () => Promise<string>
      print: (dataUrl: string) => Promise<void>
    }
  }
}
