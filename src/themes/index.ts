import { retroTheme } from './retro'
import { y2kTheme } from './y2k'
import type { Theme, ThemeId } from './types'

export const themes: Record<ThemeId, Theme> = {
  retro: retroTheme,
  y2k: y2kTheme,
}

export const DEFAULT_THEME: ThemeId = 'retro'

export function getTheme(id: ThemeId): Theme {
  return themes[id] ?? themes[DEFAULT_THEME]
}

export type { Theme, ThemeId, ThemeFilter } from './types'
