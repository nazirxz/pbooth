import { retroTheme } from './retro'
import type { Theme, ThemeId } from './types'

export const themes: Record<ThemeId, Theme> = {
  retro: retroTheme,
}

export const DEFAULT_THEME: ThemeId = 'retro'

export function getTheme(id: ThemeId): Theme {
  return themes[id] ?? themes[DEFAULT_THEME]
}

export type { Theme, ThemeId, ThemeFilter } from './types'
