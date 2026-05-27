import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AvatarCharacter, CHARACTERS, type CharacterId } from './AvatarCharacter'
import type { Theme } from '../types'

// ─── Color palettes per character class ───────────────────────────────────────
const PALETTES: Record<string, Array<[string, string]>> = {
  lion:   [['#C17F24','#7B4F00'], ['#E8A44C','#9B6A1A'], ['#A0522D','#5C2E0A'], ['#F4D03F','#A07820'], ['#D4A72C','#8B5E0A'], ['#C0392B','#7B241C']],
  mage:   [['#7C3AED','#2D1B69'], ['#2563EB','#1E3A5F'], ['#059669','#064E3B'], ['#DC2626','#7F1D1D'], ['#9333EA','#3B0764'], ['#1D4ED8','#0F2D6E']],
  fox:    [['#D97706','#7C2D12'], ['#EA580C','#431407'], ['#B45309','#78350F'], ['#CA8A04','#713F12'], ['#DC2626','#7F1D1D'], ['#E11D48','#4C0519']],
  owl:    [['#0F766E','#042F2E'], ['#0369A1','#082F49'], ['#6D28D9','#2E1065'], ['#475569','#0F172A'], ['#854D0E','#431407'], ['#15803D','#052E16']],
  knight: [['#475569','#0F172A'], ['#1E40AF','#1E3A5F'], ['#9F1239','#4C0519'], ['#166534','#052E16'], ['#854D0E','#431407'], ['#374151','#111827']],
  cosmic: [['#DB2777','#4C0519'], ['#7C3AED','#2D1B69'], ['#0891B2','#083344'], ['#059669','#064E3B'], ['#D97706','#7C2D12'], ['#1D4ED8','#0F2D6E']],
}

interface AvatarCreatorProps {
  onClose: () => void
  onSave: (character: CharacterId, primary: string, secondary: string) => void
  initialCharacter?: CharacterId
  initialPrimary?: string
  initialSecondary?: string
  theme: Theme
}

export default function AvatarCreator({ onClose, onSave, initialCharacter = 'lion', initialPrimary, initialSecondary, theme }: AvatarCreatorProps) {
  const [selected, setSelected] = useState<CharacterId>(initialCharacter)
  const def = CHARACTERS.find(c => c.id === selected)!
  const [primary, setPrimary] = useState(initialPrimary ?? def.defaultPrimary)
  const [secondary, setSecondary] = useState(initialSecondary ?? def.defaultSecondary)

  const handleSelectCharacter = (id: CharacterId) => {
    const d = CHARACTERS.find(c => c.id === id)!
    setSelected(id)
    setPrimary(d.defaultPrimary)
    setSecondary(d.defaultSecondary)
  }

  const handlePalette = (pal: [string, string]) => {
    setPrimary(pal[0]); setSecondary(pal[1])
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>

      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 260 }}
        style={{ width: '100%', background: theme.bg, borderRadius: '24px 24px 0 0', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: theme.border }}/>
        </div>

        {/* Header */}
        <div style={{ padding: '12px 22px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: theme.fg }}>Your Character</div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', background: theme.bgSecondary, border: 'none', fontSize: 18, color: theme.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        {/* Scrollable content */}
        <div style={{ overflowY: 'auto', flex: 1, paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}>

          {/* Live preview */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0 8px', gap: 6 }}>
            <motion.div key={selected} initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 20 }}>
              <AvatarCharacter character={selected} primaryColor={primary} secondaryColor={secondary} size={140}/>
            </motion.div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: theme.fg }}>{def.name}</div>
            <div style={{ fontSize: 12, color: theme.muted }}>{def.description}</div>
          </div>

          {/* Character grid */}
          <div style={{ padding: '8px 16px 12px' }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: theme.muted, marginBottom: 10 }}>Choose your character</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {CHARACTERS.map(c => (
                <button key={c.id} onClick={() => handleSelectCharacter(c.id)}
                  style={{ padding: 8, borderRadius: 14, border: `2px solid ${selected === c.id ? primary : theme.border}`, background: selected === c.id ? `${primary}18` : theme.bgSecondary, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, transition: 'all 0.2s' }}>
                  <AvatarCharacter character={c.id} primaryColor={c.defaultPrimary} secondaryColor={c.defaultSecondary} size={52}/>
                  <span style={{ fontSize: 11, color: selected === c.id ? theme.fg : theme.muted, fontWeight: selected === c.id ? 600 : 400 }}>{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Color palettes */}
          <div style={{ padding: '0 16px 12px' }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: theme.muted, marginBottom: 10 }}>Color scheme</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(PALETTES[selected] ?? []).map((pal, i) => (
                <button key={i} onClick={() => handlePalette(pal)}
                  style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${pal[0]} 50%, ${pal[1]} 50%)`, border: `3px solid ${primary === pal[0] ? theme.fg : 'transparent'}`, cursor: 'pointer', transition: 'border 0.15s' }}/>
              ))}
              {/* custom color */}
              <div style={{ position: 'relative' }}>
                <input type="color" value={primary} onChange={e => setPrimary(e.target.value)}
                  style={{ width: 40, height: 40, borderRadius: 12, border: `2px dashed ${theme.border}`, cursor: 'pointer', padding: 2, background: 'none', overflow: 'hidden' }} title="Custom color"/>
              </div>
            </div>
          </div>

          {/* Save */}
          <div style={{ padding: '4px 16px 24px' }}>
            <button onClick={() => onSave(selected, primary, secondary)}
              style={{ width: '100%', padding: 15, background: primary, color: '#FFF', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 600, cursor: 'pointer', boxShadow: `0 4px 20px ${primary}60`, transition: 'opacity 0.2s' }}>
              Save Character
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
