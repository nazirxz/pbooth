import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('pbooth', {
  quit: () => ipcRenderer.invoke('app:quit'),
  version: () => ipcRenderer.invoke('app:version'),
})

declare global {
  interface Window {
    pbooth: {
      quit: () => Promise<void>
      version: () => Promise<string>
    }
  }
}
