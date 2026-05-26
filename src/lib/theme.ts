import type { Theme } from '../types'

export function getTheme(dark: boolean): Theme {
  return dark
    ? {
        bg: '#0A0A0A', bgSecondary: '#141414', bgElevated: '#1E1E1E',
        fg: '#FFFFFF', fgDim: 'rgba(255,255,255,0.85)', muted: '#888888',
        border: '#2A2A2A', accent: '#FFFFFF', accentFg: '#0A0A0A',
        blobFill: '#1A1A1A', cardBg: '#141414', dark: true,
      }
    : {
        bg: '#FFFFFF', bgSecondary: '#F5F5F3', bgElevated: '#FFFFFF',
        fg: '#0A0A0A', fgDim: '#1A1A1A', muted: '#888888',
        border: '#E8E8E6', accent: '#0A0A0A', accentFg: '#FFFFFF',
        blobFill: '#E8E8E6', cardBg: '#F5F5F3', dark: false,
      }
}
