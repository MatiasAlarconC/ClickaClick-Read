import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CHARACTERS, type CharacterId } from './AvatarCharacter'
import Character3D from './Character3D'
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

// ─── Rarity per character ──────────────────────────────────────────────────────
const RARITY: Record<CharacterId, { label: string; color: string }> = {
  lion:    { label: 'Common',    color: '#9CA3AF' },
  owl:     { label: 'Common',    color: '#9CA3AF' },
  knight:  { label: 'Uncommon',  color: '#34D399' },
  fox:     { label: 'Rare',      color: '#60A5FA' },
  mage:    { label: 'Rare',      color: '#60A5FA' },
  cosmic:  { label: 'Rare',      color: '#60A5FA' },
  phoenix:     { label: 'Legendary', color: '#F59E0B' },
  shadow:       { label: 'Mythic',    color: '#A855F7' },
  ninja:        { label: 'Uncommon',  color: '#34D399' },
  viking:       { label: 'Uncommon',  color: '#34D399' },
  astronaut:    { label: 'Rare',      color: '#60A5FA' },
  witch:        { label: 'Rare',      color: '#60A5FA' },
  pirate:       { label: 'Uncommon',  color: '#34D399' },
  robot:        { label: 'Rare',      color: '#60A5FA' },
  samurai:      { label: 'Uncommon',  color: '#34D399' },
  angel:        { label: 'Rare',      color: '#60A5FA' },
  dragon:       { label: 'Legendary', color: '#F59E0B' },
  jester:       { label: 'Uncommon',  color: '#34D399' },
  alchemist:    { label: 'Legendary', color: '#F59E0B' },
  necromancer:  { label: 'Mythic',    color: '#A855F7' },
}

// ─── Achievement required to unlock each character ────────────────────────────
const UNLOCK_HINT: Partial<Record<CharacterId, { name: string; hint: string }>> = {
  owl:     { name: 'Night Reader',    hint: 'Complete 15 reading sessions' },
  knight:  { name: 'Iron Will',       hint: 'Maintain a 7-day reading streak' },
  fox:     { name: 'The Detective',   hint: 'Read 10+ Mystery or Thriller books' },
  mage:    { name: 'Magic Realm',     hint: 'Read 15+ Fantasy or Sci-Fi books' },
  cosmic:  { name: 'Cosmic Explorer', hint: 'Read 5+ Science Fiction books' },
  phoenix: { name: 'The Immortal',    hint: 'Read every day for 365 consecutive days' },
  shadow:      { name: 'Lord of Pages',       hint: 'Accumulate 1,000 hours of reading' },
  ninja:        { name: 'Silent but Deadly',   hint: 'Complete 30 reading sessions' },
  viking:       { name: 'Epic Saga Reader',    hint: 'Finish 15 books' },
  astronaut:    { name: 'To Infinity',         hint: 'Read 10 Sci-Fi books' },
  witch:        { name: 'Spellbound',          hint: 'Read 10 Fantasy books' },
  pirate:       { name: 'Ahoy, Adventure!',   hint: 'Read 5 Adventure books' },
  robot:        { name: 'Data Overload',       hint: 'Complete 75 reading sessions' },
  samurai:      { name: 'The Way of the Reader', hint: 'Maintain a 21-day streak' },
  angel:        { name: 'Celestial Reader',    hint: 'Accumulate 100 hours of reading' },
  dragon:       { name: 'The Legendary',       hint: 'Read 25,000 total pages' },
  jester:       { name: 'Comic Relief',        hint: 'Read 5 Humor or Comedy books' },
  alchemist:    { name: 'The Great Work',      hint: 'Read 5+ books in 5 different genres' },
  necromancer:  { name: 'Midnight Scholar',    hint: 'Accumulate 500 hours of reading' },
}

interface AvatarCreatorProps {
  onClose: () => void
  onSave: (character: CharacterId, primary: string, secondary: string) => void
  initialCharacter?: CharacterId
  initialPrimary?: string
  initialSecondary?: string
  theme: Theme
  unlockedCharacters?: Set<CharacterId>
}

export default function AvatarCreator({ onClose, onSave, initialCharacter = 'lion', initialPrimary, initialSecondary, theme, unlockedCharacters }: AvatarCreatorProps) {
  const [selected, setSelected] = useState<CharacterId>(initialCharacter)
  const def = CHARACTERS.find(c => c.id === selected)!
  const [primary, setPrimary] = useState(initialPrimary ?? def.defaultPrimary)
  const [secondary, setSecondary] = useState(initialSecondary ?? def.defaultSecondary)

  const isUnlocked = (id: CharacterId) => !unlockedCharacters || unlockedCharacters.has(id)

  const handleSelectCharacter = (id: CharacterId) => {
    // Always allow preview — just change what's displayed. Saving is blocked if locked.
    const d = CHARACTERS.find(c => c.id === id)!
    setSelected(id)
    setPrimary(d.defaultPrimary)
    setSecondary(d.defaultSecondary)
  }

  const handlePalette = (pal: [string, string]) => {
    if (!isUnlocked(selected)) return // can't change colors on locked chars
    setPrimary(pal[0]); setSecondary(pal[1])
  }

  const selectedLocked = !isUnlocked(selected)
  const rarity = RARITY[selected]
  const unlockHint = UNLOCK_HINT[selected]

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
            <div style={{ position: 'relative' }}>
              <motion.div key={selected} initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: selectedLocked ? 0.55 : 1 }} transition={{ type: 'spring', damping: 20 }}>
                <Character3D character={selected} primaryColor={primary} secondaryColor={secondary} size={140} locked={selectedLocked}/>
              </motion.div>
              {selectedLocked && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ background: 'rgba(0,0,0,0.7)', borderRadius: 999, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" stroke="white" strokeWidth="2"/><path d="M7 11V7a5 5 0 0110 0v4" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                    <span style={{ fontSize: 12, color: 'white', fontWeight: 600 }}>Locked</span>
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: selectedLocked ? theme.muted : theme.fg }}>{def.name}</div>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: rarity.color, background: `${rarity.color}20`, padding: '3px 8px', borderRadius: 999 }}>{rarity.label}</span>
            </div>
            <div style={{ fontSize: 12, color: theme.muted }}>{def.description}</div>
            {selectedLocked && unlockHint && (
              <div style={{ marginTop: 8, background: `${rarity.color}15`, border: `1px solid ${rarity.color}40`, borderRadius: 12, padding: '10px 14px', textAlign: 'center', maxWidth: 260 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: rarity.color, marginBottom: 4 }}>
                  Unlock via achievement
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: theme.fg, marginBottom: 2 }}>{unlockHint.name}</div>
                <div style={{ fontSize: 11, color: theme.muted }}>{unlockHint.hint}</div>
              </div>
            )}
            {selectedLocked && !unlockHint && (
              <div style={{ fontSize: 11, color: theme.muted, fontStyle: 'italic', marginTop: 2 }}>Complete achievements to unlock</div>
            )}
          </div>

          {/* Character grid */}
          <div style={{ padding: '8px 16px 12px' }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: theme.muted, marginBottom: 10 }}>Choose your character</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {CHARACTERS.map(c => {
                const locked = !isUnlocked(c.id)
                const r = RARITY[c.id]
                return (
                <button key={c.id} onClick={() => handleSelectCharacter(c.id)}
                  style={{ padding: 8, borderRadius: 14, border: `2px solid ${selected === c.id ? (locked ? theme.muted : primary) : theme.border}`, background: selected === c.id ? (locked ? `${theme.muted}18` : `${primary}18`) : theme.bgSecondary, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, transition: 'all 0.2s', position: 'relative' }}>
                  <div style={{ opacity: locked ? 0.5 : 1, filter: locked ? 'grayscale(0.7)' : 'none' }}>
                    <Character3D character={c.id} primaryColor={c.defaultPrimary} secondaryColor={c.defaultSecondary} size={52} locked={locked}/>
                  </div>
                  <span style={{ fontSize: 11, color: selected === c.id ? theme.fg : theme.muted, fontWeight: selected === c.id ? 600 : 400 }}>{c.name}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: locked ? theme.muted : r.color }}>{r.label}</span>
                  {locked && (
                    <div style={{ position: 'absolute', top: 6, right: 6 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" stroke={theme.muted} strokeWidth="2.5"/><path d="M7 11V7a5 5 0 0110 0v4" stroke={theme.muted} strokeWidth="2.5" strokeLinecap="round"/></svg>
                    </div>
                  )}
                </button>
                )
              })}
            </div>
          </div>

          {/* Color palettes — disabled for locked chars */}
          {!selectedLocked && (
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
          )}

          {/* Save */}
          <div style={{ padding: '4px 16px 24px' }}>
            {selectedLocked ? (
              <div style={{ padding: '15px', background: theme.bgSecondary, borderRadius: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: theme.muted, marginBottom: unlockHint ? 6 : 0 }}>
                  Unlock <strong style={{ color: theme.fg }}>{def.name}</strong> to use this character
                </div>
                {unlockHint && (
                  <div style={{ fontSize: 11, color: rarity.color, fontWeight: 600 }}>
                    Achievement: {unlockHint.name}
                  </div>
                )}
              </div>
            ) : (
              <button onClick={() => onSave(selected, primary, secondary)}
                style={{ width: '100%', padding: 15, background: primary, color: '#FFF', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 600, cursor: 'pointer', boxShadow: `0 4px 20px ${primary}60`, transition: 'opacity 0.2s' }}>
                Save Character
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
