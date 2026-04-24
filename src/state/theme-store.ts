import { create } from 'zustand'
import { DEFAULT_THEME, getTheme } from '@/themes'
import type { Theme, ThemeId } from '@/themes'

// Only one theme right now. The store is kept so screens can import `useTheme`
// without caring whether the app supports switching — add more themes later
// by re-introducing a registry + selector screen without touching callers.
if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-theme', DEFAULT_THEME)
}

interface ThemeState {
  themeId: ThemeId
  theme: Theme
}

export const useTheme = create<ThemeState>(() => ({
  themeId: DEFAULT_THEME,
  theme: getTheme(DEFAULT_THEME),
}))
