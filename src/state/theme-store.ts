import { create } from 'zustand'
import { DEFAULT_THEME, getTheme, themes } from '@/themes'
import type { Theme, ThemeId } from '@/themes'

const STORAGE_KEY = 'pbooth.theme'

function loadStored(): ThemeId {
  if (typeof window === 'undefined') return DEFAULT_THEME
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    if (v && v in themes) return v as ThemeId
  } catch {
    // ignore
  }
  return DEFAULT_THEME
}

function applyThemeAttr(id: ThemeId) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', id)
}

interface ThemeState {
  themeId: ThemeId
  theme: Theme
  setTheme: (id: ThemeId) => void
}

const initialId = loadStored()
applyThemeAttr(initialId)

export const useTheme = create<ThemeState>((set) => ({
  themeId: initialId,
  theme: getTheme(initialId),
  setTheme: (id) => {
    applyThemeAttr(id)
    try {
      window.localStorage.setItem(STORAGE_KEY, id)
    } catch {
      // ignore
    }
    set({ themeId: id, theme: getTheme(id) })
  },
}))
