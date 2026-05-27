import React from 'react'
import { TIER_COLORS, TIER_EMISSIVE, type AchievementTier } from '../data/achievements'

// Star polygon: center (36,46), outer r=9, inner r=4
const STAR = '36,37 38.4,42.8 44.6,43.2 39.8,47.2 41.3,53.3 36,50 30.7,53.3 32.2,47.2 27.4,43.2 33.6,42.8'

const RIBBON_COLOR: Record<AchievementTier, string> = {
  bronze:   '#7C2D12',
  silver:   '#1E3A8A',
  gold:     '#991B1B',
  platinum: '#4C1D95',
  diamond:  '#0E4F8B',
  obsidian: '#3B0764',
}

interface MedalIconProps {
  tier: AchievementTier
  locked?: boolean
  size?: number
}

export default function MedalIcon({ tier, locked = false, size = 72 }: MedalIconProps) {
  const col   = locked ? '#4B5563' : TIER_COLORS[tier]
  const emi   = locked ? '#374151' : TIER_EMISSIVE[tier]
  const rib   = locked ? '#374151' : RIBBON_COLOR[tier]
  const uid   = `${tier}_${locked ? 'l' : 'u'}`

  // For diamond and obsidian, add a special glow ring
  const isLegendary = tier === 'diamond' || tier === 'obsidian'

  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id={`mg_${uid}`} cx="38%" cy="32%" r="68%" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor={locked ? '#6B7280' : lighten(col, 0.45)} />
          <stop offset="60%"  stopColor={col} />
          <stop offset="100%" stopColor={darken(col, 0.25)} />
        </radialGradient>
        <radialGradient id={`mc_${uid}`} cx="35%" cy="30%" r="70%" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor={locked ? '#9CA3AF' : lighten(emi, 0.5)} />
          <stop offset="100%" stopColor={emi} />
        </radialGradient>
        {isLegendary && !locked && (
          <filter id={`glow_${uid}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        )}
      </defs>

      {/* Ribbon loop */}
      <ellipse cx="36" cy="8" rx="5.5" ry="5.5" stroke={locked ? '#4B5563' : '#9CA3AF'} strokeWidth="2.5" fill="none"/>

      {/* Ribbon strip */}
      <rect x="32.5" y="8" width="7" height="18" rx="1.5" fill={rib} opacity="0.9"/>

      {/* Legendary outer glow ring */}
      {isLegendary && !locked && (
        <circle cx="36" cy="46" r="24" fill="none" stroke={emi} strokeWidth="1" opacity="0.5"
          filter={`url(#glow_${uid})`} />
      )}

      {/* Medal body */}
      <circle cx="36" cy="46" r="21" fill={`url(#mg_${uid})`} />

      {/* Medal rim */}
      <circle cx="36" cy="46" r="21" stroke={locked ? '#4B5563' : darken(col, 0.1)}
        strokeWidth="1.5" fill="none" opacity="0.7" />

      {/* Inner decorative ring */}
      <circle cx="36" cy="46" r="15.5" stroke={locked ? '#374151' : `url(#mc_${uid})`}
        strokeWidth="0.8" fill="none" opacity="0.6"/>

      {/* Star */}
      <polygon points={STAR} fill={`url(#mc_${uid})`} opacity={locked ? 0.5 : 0.9} />

      {/* Specular highlight */}
      {!locked && (
        <ellipse cx="29" cy="38" rx="5" ry="3" fill="white" opacity="0.15"
          transform="rotate(-30 29 38)" />
      )}

      {/* Diamond/Obsidian sparkles */}
      {isLegendary && !locked && [
        [55, 28], [18, 32], [58, 58],
      ].map(([x, y], i) => (
        <line key={i} x1={x - 3} y1={y} x2={x + 3} y2={y} stroke={emi} strokeWidth="1.2" opacity="0.8"/>
      ))}
      {isLegendary && !locked && [
        [55, 28], [18, 32], [58, 58],
      ].map(([x, y], i) => (
        <line key={`v${i}`} x1={x} y1={y - 3} x2={x} y2={y + 3} stroke={emi} strokeWidth="1.2" opacity="0.8"/>
      ))}
    </svg>
  )
}

// helpers
function lighten(hex: string, t: number): string {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = (n >> 16) & 255; const g = (n >> 8) & 255; const b = n & 255
  const lr = Math.round(r + (255 - r) * t)
  const lg = Math.round(g + (255 - g) * t)
  const lb = Math.round(b + (255 - b) * t)
  return `rgb(${lr},${lg},${lb})`
}
function darken(hex: string, t: number): string {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = (n >> 16) & 255; const g = (n >> 8) & 255; const b = n & 255
  return `rgb(${Math.round(r*(1-t))},${Math.round(g*(1-t))},${Math.round(b*(1-t))})`
}
