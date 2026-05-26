import React from 'react'
import type { Theme } from '../types'

// ─── Blob shapes ────────────────────────────────────────────────────────────
const BLOB_PATHS = {
  large:  'M190,50 C250,20 330,60 360,130 C390,200 370,300 310,350 C250,400 150,400 90,340 C30,280 20,190 60,120 C100,50 130,80 190,50Z',
  medium: 'M100,25 C140,5 185,20 200,60 C215,100 200,150 165,170 C130,190 80,180 55,145 C30,110 30,65 55,40 C80,15 60,45 100,25Z',
  small:  'M60,18 C85,5 115,15 125,42 C135,70 118,105 90,115 C62,125 30,108 18,80 C6,52 15,25 40,14 C65,3 35,31 60,18Z',
}
const BLOB_VIEWBOX = { large: '0 0 400 400', medium: '0 0 230 200', small: '0 0 140 130' }

export function BlobShape({ size = 'large' as 'large'|'medium'|'small', fill, style = {}, opacity = 1 }: {
  size?: 'large'|'medium'|'small'; fill: string; style?: React.CSSProperties; opacity?: number
}) {
  return (
    <svg viewBox={BLOB_VIEWBOX[size]} style={{ opacity, display: 'block', ...style }} preserveAspectRatio="xMidYMid meet">
      <path d={BLOB_PATHS[size]} fill={fill} />
    </svg>
  )
}

// ─── Book cover patterns ─────────────────────────────────────────────────────
export const BOOK_META = [
  { title: 'Kafka on the Shore',       author: 'Murakami',   pattern: 'wave',     baseColor: '#0A0A0A' },
  { title: 'The Midnight Library',     author: 'Matt Haig',  pattern: 'circles',  baseColor: '#141414' },
  { title: 'Sapiens',                  author: 'Harari',     pattern: 'grid',     baseColor: '#111111' },
  { title: 'The Road',                 author: 'McCarthy',   pattern: 'lines',    baseColor: '#0D0D0D' },
  { title: 'Thinking Fast and Slow',   author: 'Kahneman',  pattern: 'dots',     baseColor: '#0A0A0A' },
  { title: 'Cloud Atlas',              author: 'D. Mitchell',pattern: 'diagonal', baseColor: '#101010' },
  { title: 'Piranesi',                 author: 'S. Clarke',  pattern: 'arch',     baseColor: '#080808' },
  { title: 'Remains of the Day',       author: 'Ishiguro',   pattern: 'cross',    baseColor: '#131313' },
]

function PatternLayer({ pattern, w, h }: { pattern: string; w: number; h: number }) {
  const fg = 'rgba(255,255,255,0.15)'
  switch (pattern) {
    case 'wave':
      return <>{[...Array(7)].map((_,i) => <path key={i} d={`M0,${12+i*14} Q${w*0.25},${6+i*14} ${w*0.5},${12+i*14} T${w},${12+i*14}`} fill="none" stroke={fg} strokeWidth="1"/>)}</>
    case 'circles':
      return <>{[0.25,0.45,0.65].map((r,i) => <circle key={i} cx={w/2} cy={h/2} r={r*Math.min(w,h)} fill="none" stroke={fg} strokeWidth="1"/>)}</>
    case 'grid':
      return <>{[...Array(6)].flatMap((_,i) => [
        <line key={`h${i}`} x1={0} y1={i*(h/5)} x2={w} y2={i*(h/5)} stroke={fg} strokeWidth="0.7"/>,
        <line key={`v${i}`} x1={i*(w/5)} y1={0} x2={i*(w/5)} y2={h} stroke={fg} strokeWidth="0.7"/>,
      ])}</>
    case 'lines':
      return <>{[...Array(14)].map((_,i) => <line key={i} x1={0} y1={i*(h/13)} x2={w} y2={i*(h/13)} stroke={fg} strokeWidth="0.8"/>)}</>
    case 'dots':
      return <>{[...Array(5)].flatMap((_,i) => [...Array(4)].map((__,j) =>
        <circle key={`${i}-${j}`} cx={12+j*(w/4)} cy={14+i*(h/5)} r={2.5} fill={fg}/>
      ))}</>
    case 'diagonal':
      return <>{[...Array(10)].map((_,i) => <line key={i} x1={-w+i*(w/4)} y1={0} x2={i*(w/4)} y2={h} stroke={fg} strokeWidth="0.8"/>)}</>
    case 'arch':
      return <>{[...Array(4)].map((_,i) => <path key={i} d={`M${w*0.1},${h} Q${w/2},${h*(0.8-i*0.2)} ${w*0.9},${h}`} fill="none" stroke={fg} strokeWidth="1"/>)}</>
    case 'cross':
      return <>{[...Array(4)].flatMap((_,i) => [
        <line key={`h${i}`} x1={0} y1={i*(h/3)} x2={w} y2={i*(h/3)} stroke={fg} strokeWidth="0.5"/>,
        <line key={`v${i}`} x1={i*(w/3)} y1={0} x2={i*(w/3)} y2={h} stroke={fg} strokeWidth="0.5"/>,
      ])}</>
    default: return null
  }
}

export function BookCover({ index = 0, width = 80, height = 120, coverUrl, style = {} }: {
  index?: number; width?: number; height?: number; coverUrl?: string | null; style?: React.CSSProperties
}) {
  const meta = BOOK_META[index % BOOK_META.length]
  const w = width; const h = height
  const titleSize = Math.max(7, w * 0.1)
  const authorSize = Math.max(6, w * 0.08)

  if (coverUrl) {
    return (
      <div style={{ width: w, height: h, borderRadius: 6, overflow: 'hidden', flexShrink: 0, boxShadow: '0 6px 20px rgba(0,0,0,0.35)', ...style }}>
        <img src={coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    )
  }

  return (
    <div style={{ width: w, height: h, background: meta.baseColor, borderRadius: 6, overflow: 'hidden', position: 'relative', flexShrink: 0, boxShadow: '0 6px 20px rgba(0,0,0,0.35)', ...style }}>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <PatternLayer pattern={meta.pattern} w={w} h={h} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, padding: '8px 7px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: titleSize, lineHeight: 1.2, color: '#FFF', fontWeight: 400 }}>{meta.title}</div>
        <div style={{ fontFamily: '-apple-system, sans-serif', fontSize: authorSize, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{meta.author}</div>
      </div>
    </div>
  )
}

// ─── Tab bar ─────────────────────────────────────────────────────────────────
const TAB_ICONS: Record<string, (active: boolean, c: string) => React.ReactNode> = {
  home: (a, c) => (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M2 9L11 2L20 9V20C20 20.55 19.55 21 19 21H14V15H8V21H3C2.45 21 2 20.55 2 20V9Z" fill={a ? c : 'none'} stroke={c} strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  ),
  search: (a, c) => (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="10" cy="10" r="6.5" stroke={c} strokeWidth="1.5" fillOpacity={a ? 0.12 : 0} fill={c}/>
      <line x1="15" y1="15" x2="20" y2="20" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
  library: (a, c) => (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="3" y="2" width="4" height="18" rx="1.5" fill={a ? c : 'none'} stroke={c} strokeWidth="1.5"/>
      <rect x="9" y="2" width="4" height="18" rx="1.5" fill={a ? c : 'none'} stroke={c} strokeWidth="1.5"/>
      <path d="M15 3L20 5.5V19L15 16.5V3Z" fill={a ? c : 'none'} stroke={c} strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  ),
  stats: (a, c) => (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="2" y="13" width="4" height="7" rx="1" fill={a ? c : 'none'} stroke={c} strokeWidth="1.5"/>
      <rect x="9" y="8" width="4" height="12" rx="1" fill={a ? c : 'none'} stroke={c} strokeWidth="1.5"/>
      <rect x="16" y="3" width="4" height="17" rx="1" fill={a ? c : 'none'} stroke={c} strokeWidth="1.5"/>
    </svg>
  ),
  profile: (a, c) => (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="7.5" r="3.5" fill={a ? c : 'none'} stroke={c} strokeWidth="1.5"/>
      <path d="M3 19C3 15.68 6.58 13 11 13C15.42 13 19 15.68 19 19" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
}

export function TabBar({ activeTab, onTabChange, theme }: {
  activeTab: string; onTabChange: (tab: string) => void; theme: Theme
}) {
  return (
    <div style={{ position: 'sticky', bottom: 0, zIndex: 50, display: 'flex', background: theme.bg, borderTop: `1px solid ${theme.border}`, paddingBottom: 20 }}>
      {(['home','search','library','stats','profile'] as const).map(tab => {
        const active = tab === activeTab
        const color = active ? theme.fg : theme.muted
        return (
          <button key={tab} onClick={() => onTabChange(tab)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '10px 0 2px', background: 'none', border: 'none' }}>
            {TAB_ICONS[tab](active, color)}
            <span style={{ fontSize: 9.5, letterSpacing: 0.2, color, textTransform: 'capitalize', fontWeight: active ? 600 : 400 }}>{tab}</span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Progress bar ────────────────────────────────────────────────────────────
export function ProgressBar({ progress, theme, height = 3, style = {} }: {
  progress: number; theme: Theme; height?: number; style?: React.CSSProperties
}) {
  return (
    <div style={{ height, background: theme.border, borderRadius: 999, overflow: 'hidden', ...style }}>
      <div style={{ height: '100%', width: `${Math.min(1, Math.max(0, progress)) * 100}%`, background: theme.accent, borderRadius: 999, transition: 'width 0.4s ease' }} />
    </div>
  )
}

// ─── Stars ───────────────────────────────────────────────────────────────────
export function Stars({ count = 5, filled = 0, size = 14, color, onClick }: {
  count?: number; filled?: number; size?: number; color: string; onClick?: (v: number) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {[...Array(count)].map((_,i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 14 14" onClick={onClick ? () => onClick(i+1) : undefined} style={{ cursor: onClick ? 'pointer' : 'default', flexShrink: 0 }}>
          <path d="M7 1L8.8 5.4L13.6 5.9L10.1 9L11.3 13.7L7 11.1L2.7 13.7L3.9 9L0.4 5.9L5.2 5.4L7 1Z" fill={i < filled ? color : 'none'} stroke={color} strokeWidth="0.8" strokeLinejoin="round"/>
        </svg>
      ))}
    </div>
  )
}

// ─── Section label ───────────────────────────────────────────────────────────
export function SectionLabel({ children, theme }: { children: React.ReactNode; theme: Theme }) {
  return (
    <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: theme.muted, marginBottom: 12 }}>{children}</div>
  )
}

// ─── Back button ─────────────────────────────────────────────────────────────
export function BackButton({ onPress, theme }: { onPress: () => void; theme: Theme }) {
  return (
    <button onClick={onPress} style={{ background: 'none', border: 'none', color: theme.muted, fontSize: 14, padding: '8px 0', marginBottom: 32, display: 'flex', alignItems: 'center', gap: 6 }}>
      <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
        <path d="M6 1L1 6L6 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      Back
    </button>
  )
}

// ─── Primary button ──────────────────────────────────────────────────────────
export function PrimaryButton({ label, onPress, disabled = false, style = {}, theme }: {
  label: React.ReactNode; onPress: () => void; disabled?: boolean; style?: React.CSSProperties; theme: Theme
}) {
  return (
    <button onClick={onPress} disabled={disabled} style={{
      width: '100%', padding: '15px', border: 'none', borderRadius: 12,
      background: disabled ? theme.border : theme.accent,
      color: disabled ? theme.muted : theme.accentFg,
      fontSize: 15, fontWeight: 500, letterSpacing: 0.1, cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'opacity 0.2s', ...style,
    }}>{label}</button>
  )
}

// ─── Form input ──────────────────────────────────────────────────────────────
export function FormInput({ label, type = 'text', value, onChange, placeholder, theme }: {
  label: string; type?: string; value: string; onChange: (v: string) => void; placeholder?: string; theme: Theme
}) {
  const [focused, setFocused] = React.useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: theme.muted }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ width: '100%', padding: '13px 0', background: 'none', border: 'none', borderBottom: `1.5px solid ${focused ? theme.fg : theme.border}`, color: theme.fg, fontSize: 16, transition: 'border-color 0.2s' }}/>
    </div>
  )
}

// ─── Loading spinner ─────────────────────────────────────────────────────────
export function Spinner({ color }: { color: string }) {
  return (
    <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${color}20`, borderTop: `2px solid ${color}`, animation: 'spin 0.8s linear infinite' }} />
  )
}

// ─── Error boundary wrapper ──────────────────────────────────────────────────
interface EBState { hasError: boolean }
export class ErrorBoundary extends React.Component<{ children: React.ReactNode; fallback?: React.ReactNode }, EBState> {
  state: EBState = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) return this.props.fallback ?? null
    return this.props.children
  }
}
