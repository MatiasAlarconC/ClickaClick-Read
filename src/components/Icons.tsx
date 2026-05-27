import React from 'react'

// ─── Monochromatic SVG icon set ───────────────────────────────────────────────
// All icons accept size and color props. Strokeless, clean fills.

interface IconProps {
  size?: number
  color?: string
  style?: React.CSSProperties
}

export function FlameIcon({ size = 24, color = 'currentColor', style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      {/* outer flame */}
      <path d="M12 2C12 2 7 7.5 7 13a5 5 0 0 0 10 0c0-2.5-1.5-4.5-2-6 0 0-.5 2-2 2.5C13 9 14 5 12 2Z" fill={color} opacity="0.25"/>
      {/* inner bright core */}
      <path d="M12 8c0 0-2 3-2 5a2 2 0 0 0 4 0c0-1.5-.8-3-1-4 0 0-.3 1.2-1 1.6C12 10 12.5 8.5 12 8Z" fill={color}/>
    </svg>
  )
}

export function LightningIcon({ size = 24, color = 'currentColor', style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M13 2L4.5 13.5H11L10 22L20 10H13.5L13 2Z" fill={color} opacity="0.2"/>
      <path d="M13 2L6 12.5H11.5L10.5 22L19 10.5H14L13 2Z" fill={color}/>
    </svg>
  )
}

export function MoonIcon({ size = 24, color = 'currentColor', style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" fill={color} opacity="0.2"/>
      <path d="M20 12.5A8 8 0 1 1 11.5 4 6 6 0 0 0 20 12.5Z" fill={color}/>
      {/* small stars */}
      <circle cx="17" cy="5" r="0.9" fill={color}/>
      <circle cx="20" cy="8" r="0.6" fill={color}/>
      <circle cx="19" cy="3" r="0.5" fill={color}/>
    </svg>
  )
}

export function SunIcon({ size = 24, color = 'currentColor', style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      {/* rays */}
      {[0,45,90,135,180,225,270,315].map(angle => {
        const r = Math.PI * angle / 180
        const x1 = 12 + Math.cos(r) * 7.5
        const y1 = 12 + Math.sin(r) * 7.5
        const x2 = 12 + Math.cos(r) * 9.5
        const y2 = 12 + Math.sin(r) * 9.5
        return <line key={angle} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
      })}
      {/* core */}
      <circle cx="12" cy="12" r="4.5" fill={color}/>
    </svg>
  )
}

export function BookOpenIcon({ size = 24, color = 'currentColor', style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M2 6C2 6 5 5 8 5s6 1 6 1V20s-3-1-6-1-6 1-6 1V6Z" fill={color} opacity="0.2"/>
      <path d="M14 6s3-1 6-1 4 1 4 1V20s-2-1-4-1-6 1-6 1V6Z" fill={color} opacity="0.15"/>
      <path d="M2 6c0 0 3-1 6-1s6 1 6 1" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M14 6c0 0 3-1 6-1s2 1 2 1" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M12 6v14" stroke={color} strokeWidth="1.5"/>
    </svg>
  )
}

export function ClockIcon({ size = 24, color = 'currentColor', style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <circle cx="12" cy="12" r="9" fill={color} opacity="0.12"/>
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.5"/>
      <path d="M12 7v5l3 2" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function TrophyIcon({ size = 24, color = 'currentColor', style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M8 21h8M12 17v4M5 3H3v5a4 4 0 0 0 4 4h1M19 3h2v5a4 4 0 0 1-4 4h-1" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M8 3h8v8a4 4 0 0 1-8 0V3Z" fill={color} opacity="0.15"/>
      <path d="M8 3h8v8a4 4 0 0 1-8 0V3Z" stroke={color} strokeWidth="1.5"/>
    </svg>
  )
}

export function SparkleIcon({ size = 24, color = 'currentColor', style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2Z" fill={color}/>
      <path d="M19 14l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" fill={color} opacity="0.6"/>
      <path d="M5 16l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5.5-1.5Z" fill={color} opacity="0.4"/>
    </svg>
  )
}

export function ChartIcon({ size = 24, color = 'currentColor', style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <rect x="3" y="12" width="4" height="9" rx="1" fill={color} opacity="0.3"/>
      <rect x="10" y="7" width="4" height="14" rx="1" fill={color} opacity="0.6"/>
      <rect x="17" y="3" width="4" height="18" rx="1" fill={color}/>
    </svg>
  )
}
