import { create } from 'zustand'

const STORAGE_KEY = 'pbooth.cameraDeviceId'

function loadStored(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

interface DeviceState {
  selectedDeviceId: string | null
  setSelectedDeviceId: (id: string | null) => void
}

export const useDevice = create<DeviceState>((set) => ({
  selectedDeviceId: loadStored(),
  setSelectedDeviceId: (id) => {
    try {
      if (id) window.localStorage.setItem(STORAGE_KEY, id)
      else window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* private mode etc */
    }
    set({ selectedDeviceId: id })
  },
}))

/** Sync helper for non-React code (WebcamSource). Reads localStorage directly. */
export function getSelectedDeviceId(): string | null {
  return loadStored()
}
