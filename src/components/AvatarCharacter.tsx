import React from 'react'

// ─── Avatar character SVG illustrations ──────────────────────────────────────
// Each character is a 200×260 SVG with named color zones.
// p = primaryColor, s = secondaryColor, derived shades computed inline.

export type CharacterId = 'lion' | 'mage' | 'fox' | 'owl' | 'knight' | 'cosmic' | 'phoenix' | 'shadow' |
  'ninja' | 'viking' | 'astronaut' | 'witch' | 'pirate' | 'robot' | 'samurai' | 'angel' | 'dragon' | 'jester' | 'alchemist' | 'necromancer'

export interface CharacterDef {
  id: CharacterId
  name: string
  description: string
  defaultPrimary: string
  defaultSecondary: string
}

export const CHARACTERS: CharacterDef[] = [
  { id: 'lion',        name: 'Leo',     description: 'The Bold Reader',        defaultPrimary: '#C17F24', defaultSecondary: '#7B4F00' },
  { id: 'mage',        name: 'Sage',    description: 'The Wise Scholar',       defaultPrimary: '#7C3AED', defaultSecondary: '#2D1B69' },
  { id: 'fox',         name: 'Vex',     description: 'The Cunning Explorer',   defaultPrimary: '#D97706', defaultSecondary: '#7C2D12' },
  { id: 'owl',         name: 'Orion',   description: 'The Night Thinker',      defaultPrimary: '#0F766E', defaultSecondary: '#042F2E' },
  { id: 'knight',      name: 'Vale',    description: 'The Story Guardian',     defaultPrimary: '#475569', defaultSecondary: '#0F172A' },
  { id: 'cosmic',      name: 'Zara',    description: 'The Dream Weaver',       defaultPrimary: '#DB2777', defaultSecondary: '#4C0519' },
  { id: 'phoenix',     name: 'Ember',   description: 'The Eternal Flame',      defaultPrimary: '#F97316', defaultSecondary: '#7C2D12' },
  { id: 'shadow',      name: 'Void',    description: 'The Last Reader',        defaultPrimary: '#7C3AED', defaultSecondary: '#0A0014' },
  { id: 'ninja',       name: 'Kaze',    description: 'The Silent Scholar',     defaultPrimary: '#1E293B', defaultSecondary: '#94A3B8' },
  { id: 'viking',      name: 'Bjorn',   description: 'The Epic Saga Warrior',  defaultPrimary: '#1D4ED8', defaultSecondary: '#78350F' },
  { id: 'astronaut',   name: 'Nova',    description: 'The Sci-Fi Explorer',    defaultPrimary: '#0369A1', defaultSecondary: '#0EA5E9' },
  { id: 'witch',       name: 'Luna',    description: 'The Spellbound Reader',  defaultPrimary: '#7E22CE', defaultSecondary: '#166534' },
  { id: 'pirate',      name: 'Rogue',   description: 'The Adventure Seeker',   defaultPrimary: '#B91C1C', defaultSecondary: '#78350F' },
  { id: 'robot',       name: 'Byte',    description: 'The Data Analyst',       defaultPrimary: '#475569', defaultSecondary: '#1E3A5F' },
  { id: 'samurai',     name: 'Ken',     description: 'The Disciplined Warrior', defaultPrimary: '#DC2626', defaultSecondary: '#1C1917' },
  { id: 'angel',       name: 'Seraph',  description: 'The Celestial Reader',   defaultPrimary: '#E8D5B7', defaultSecondary: '#B8860B' },
  { id: 'dragon',      name: 'Ignis',   description: 'The Legendary Reader',   defaultPrimary: '#16A34A', defaultSecondary: '#7C2D12' },
  { id: 'jester',      name: 'Pip',     description: 'The Comic Seeker',       defaultPrimary: '#EAB308', defaultSecondary: '#DC2626' },
  { id: 'alchemist',   name: 'Auri',    description: 'The Knowledge Seeker',   defaultPrimary: '#D97706', defaultSecondary: '#0D9488' },
  { id: 'necromancer', name: 'Mortem',  description: 'The Dark Scholar',       defaultPrimary: '#6D28D9', defaultSecondary: '#064E3B' },
]

function hex(c: string, opacity = 1): string {
  if (opacity >= 1) return c
  const n = parseInt(c.replace('#', ''), 16)
  const r = (n >> 16) & 255; const g = (n >> 8) & 255; const b = n & 255
  return `rgba(${r},${g},${b},${opacity})`
}

// ─── Lion ──────────────────────────────────────────────────────────────────────
function LionSVG({ p, s }: { p: string; s: string }) {
  return (
    <svg viewBox="0 0 200 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      {/* shadow */}
      <ellipse cx="100" cy="250" rx="55" ry="8" fill={hex(s, 0.3)}/>
      {/* body */}
      <rect x="60" y="148" width="80" height="80" rx="28" fill={p}/>
      <rect x="68" y="152" width="64" height="68" rx="22" fill={hex(p, 0.7)}/>
      {/* paws */}
      <ellipse cx="72" cy="232" rx="16" ry="9" fill={p}/>
      <ellipse cx="128" cy="232" rx="16" ry="9" fill={p}/>
      <ellipse cx="72" cy="231" rx="10" ry="6" fill={hex(s, 0.4)}/>
      <ellipse cx="128" cy="231" rx="10" ry="6" fill={hex(s, 0.4)}/>
      {/* arms */}
      <path d="M60 170 Q38 180 36 200 Q40 215 56 215 Q72 215 72 200" fill={p}/>
      <path d="M140 170 Q162 180 164 200 Q160 215 144 215 Q128 215 128 200" fill={p}/>
      {/* mane outer glow */}
      <circle cx="100" cy="110" r="58" fill={hex(s, 0.25)}/>
      {/* mane */}
      <circle cx="100" cy="110" r="50" fill={hex(p, 0.5)}/>
      {/* mane strands */}
      {[-40,-25,-10,5,20,35,50].map((a, i) => {
        const angle = (a - 90) * Math.PI / 180
        const ix = 100 + Math.cos(angle) * 44; const iy = 110 + Math.sin(angle) * 44
        const ox = 100 + Math.cos(angle) * 58; const oy = 110 + Math.sin(angle) * 58
        return <line key={i} x1={ix} y1={iy} x2={ox} y2={oy} stroke={p} strokeWidth="7" strokeLinecap="round" opacity="0.5"/>
      })}
      {/* head */}
      <circle cx="100" cy="110" r="40" fill={p}/>
      {/* ears */}
      <polygon points="64,78 52,52 80,70" fill={p}/>
      <polygon points="136,78 148,52 120,70" fill={p}/>
      <polygon points="68,75 60,58 80,70" fill={hex(s, 0.5)}/>
      <polygon points="132,75 140,58 120,70" fill={hex(s, 0.5)}/>
      {/* eyes */}
      <ellipse cx="87" cy="106" rx="8" ry="7" fill="white"/>
      <ellipse cx="113" cy="106" rx="8" ry="7" fill="white"/>
      <ellipse cx="88" cy="107" rx="5" ry="5" fill={s}/>
      <ellipse cx="114" cy="107" rx="5" ry="5" fill={s}/>
      <ellipse cx="90" cy="105" rx="2" ry="2" fill="white"/>
      <ellipse cx="116" cy="105" rx="2" ry="2" fill="white"/>
      {/* nose */}
      <ellipse cx="100" cy="119" rx="7" ry="5" fill={s}/>
      {/* mouth */}
      <path d="M94 124 Q100 130 106 124" stroke={s} strokeWidth="2" fill="none" strokeLinecap="round"/>
      <path d="M100 124 L100 120" stroke={s} strokeWidth="1.5" strokeLinecap="round"/>
      {/* whiskers */}
      <line x1="76" y1="118" x2="90" y2="120" stroke={hex(s, 0.4)} strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="76" y1="122" x2="90" y2="122" stroke={hex(s, 0.4)} strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="124" y1="118" x2="110" y2="120" stroke={hex(s, 0.4)} strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="124" y1="122" x2="110" y2="122" stroke={hex(s, 0.4)} strokeWidth="1.2" strokeLinecap="round"/>
      {/* book */}
      <rect x="74" y="166" width="52" height="36" rx="4" fill={s}/>
      <rect x="78" y="168" width="22" height="32" rx="2" fill={hex(p, 0.6)}/>
      <rect x="102" y="168" width="22" height="32" rx="2" fill={hex(p, 0.4)}/>
      <line x1="100" y1="168" x2="100" y2="200" stroke={s} strokeWidth="2"/>
    </svg>
  )
}

// ─── Mage ──────────────────────────────────────────────────────────────────────
function MageSVG({ p, s }: { p: string; s: string }) {
  return (
    <svg viewBox="0 0 200 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <ellipse cx="100" cy="250" rx="55" ry="8" fill={hex(s, 0.3)}/>
      {/* robe */}
      <path d="M56 160 L44 248 L156 248 L144 160 Z" fill={p}/>
      <path d="M56 160 L44 248 L100 248 L100 160 Z" fill={hex(p, 0.7)}/>
      {/* robe trim */}
      <path d="M44 248 L56 160" stroke={hex(s, 0.5)} strokeWidth="3"/>
      <path d="M156 248 L144 160" stroke={hex(s, 0.5)} strokeWidth="3"/>
      {/* stars on robe */}
      {[[80,200],[120,210],[90,225],[115,190]].map(([x,y],i) => (
        <polygon key={i} points={`${x},${y-6} ${x+2},${y-2} ${x+6},${y-2} ${x+3},${y+1} ${x+4},${y+6} ${x},${y+3} ${x-4},${y+6} ${x-3},${y+1} ${x-6},${y-2} ${x-2},${y-2}`} fill={hex(s, 0.4)} transform={`rotate(${i*15} ${x} ${y})`}/>
      ))}
      {/* sleeves */}
      <path d="M56 160 Q30 170 26 192 Q28 208 44 208" fill={p} stroke={hex(s,0.3)} strokeWidth="1"/>
      <path d="M144 160 Q170 170 174 192 Q172 208 156 208" fill={p} stroke={hex(s,0.3)} strokeWidth="1"/>
      {/* hand holding staff */}
      <circle cx="34" cy="212" r="8" fill={hex(p, 0.8)}/>
      {/* staff */}
      <line x1="34" y1="212" x2="18" y2="100" stroke={s} strokeWidth="4" strokeLinecap="round"/>
      <circle cx="18" cy="94" r="10" fill={hex(p,0.3)}/>
      <circle cx="18" cy="94" r="7" fill={p}/>
      <polygon points="18,82 21,90 18,88 15,90" fill="white" opacity="0.8"/>
      {/* hat */}
      <polygon points="100,30 64,116 136,116" fill={s}/>
      <polygon points="100,30 68,110 132,110" fill={hex(p,0.15)}/>
      {/* hat band */}
      <rect x="60" y="112" width="80" height="12" rx="4" fill={s}/>
      {/* hat stars */}
      <polygon points="100,50 102,56 108,56 103,60 105,66 100,62 95,66 97,60 92,56 98,56" fill="white" opacity="0.6"/>
      {/* neck */}
      <rect x="88" y="116" width="24" height="16" rx="4" fill={hex(p, 0.9)}/>
      {/* head */}
      <ellipse cx="100" cy="108" rx="28" ry="32" fill={hex(p, 0.95)}/>
      {/* eyes */}
      <ellipse cx="90" cy="104" rx="6" ry="6" fill="white"/>
      <ellipse cx="110" cy="104" rx="6" ry="6" fill="white"/>
      <ellipse cx="91" cy="105" rx="4" ry="4" fill={s}/>
      <ellipse cx="111" cy="105" rx="4" ry="4" fill={s}/>
      <ellipse cx="92" cy="103" rx="1.5" ry="1.5" fill="white"/>
      <ellipse cx="112" cy="103" rx="1.5" ry="1.5" fill="white"/>
      {/* eyebrows */}
      <path d="M84 97 Q90 94 96 97" stroke={s} strokeWidth="2" fill="none" strokeLinecap="round"/>
      <path d="M104 97 Q110 94 116 97" stroke={s} strokeWidth="2" fill="none" strokeLinecap="round"/>
      {/* nose */}
      <path d="M98 110 Q100 114 102 110" stroke={hex(s,0.5)} strokeWidth="1.5" fill="none"/>
      {/* mouth */}
      <path d="M92 118 Q100 123 108 118" stroke={s} strokeWidth="2" fill="none" strokeLinecap="round"/>
      {/* beard */}
      <path d="M80 120 Q85 135 100 138 Q115 135 120 120" fill={hex(s, 0.2)} stroke={hex(s,0.3)} strokeWidth="1"/>
    </svg>
  )
}

// ─── Fox ───────────────────────────────────────────────────────────────────────
function FoxSVG({ p, s }: { p: string; s: string }) {
  return (
    <svg viewBox="0 0 200 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <ellipse cx="100" cy="250" rx="55" ry="8" fill={hex(s, 0.3)}/>
      {/* big fluffy tail */}
      <path d="M130 200 Q180 180 178 230 Q176 258 148 248 Q120 238 130 200Z" fill={p}/>
      <path d="M130 200 Q165 188 166 225 Q164 245 148 240 Q130 235 130 200Z" fill={hex(p,0.6)}/>
      <ellipse cx="158" cy="244" rx="12" ry="7" fill="white" opacity="0.9"/>
      {/* body */}
      <path d="M62 152 Q56 248 144 248 Q152 200 152 160 Q130 148 100 148 Q72 148 62 152Z" fill={p}/>
      <path d="M75 155 Q70 240 125 242 Q128 200 128 162 Q112 152 100 152 Q84 152 75 155Z" fill={hex(p,0.6)}/>
      {/* chest patch */}
      <ellipse cx="100" cy="190" rx="24" ry="36" fill="white" opacity="0.7"/>
      {/* legs/paws */}
      <ellipse cx="78" cy="240" rx="16" ry="9" fill={p}/>
      <ellipse cx="122" cy="240" rx="16" ry="9" fill={p}/>
      <ellipse cx="78" cy="239" rx="10" ry="6" fill={hex(s,0.3)}/>
      <ellipse cx="122" cy="239" rx="10" ry="6" fill={hex(s,0.3)}/>
      {/* ears - pointy! */}
      <polygon points="78,82 58,42 96,80" fill={p}/>
      <polygon points="122,82 142,42 104,80" fill={p}/>
      <polygon points="80,80 65,52 94,78" fill={hex(s,0.5)}/>
      <polygon points="120,80 135,52 106,78" fill={hex(s,0.5)}/>
      {/* head */}
      <ellipse cx="100" cy="110" rx="38" ry="36" fill={p}/>
      {/* snout */}
      <ellipse cx="100" cy="126" rx="18" ry="12" fill={hex(p,0.8)}/>
      <ellipse cx="100" cy="124" rx="14" ry="9" fill="white" opacity="0.6"/>
      {/* eyes */}
      <ellipse cx="86" cy="106" rx="8" ry="8" fill="white"/>
      <ellipse cx="114" cy="106" rx="8" ry="8" fill="white"/>
      <ellipse cx="87" cy="107" rx="5" ry="6" fill={s}/>
      <ellipse cx="115" cy="107" rx="5" ry="6" fill={s}/>
      <ellipse cx="88" cy="105" rx="2" ry="2" fill="white"/>
      <ellipse cx="116" cy="105" rx="2" ry="2" fill="white"/>
      {/* nose */}
      <ellipse cx="100" cy="120" rx="5" ry="4" fill={s}/>
      {/* mouth */}
      <path d="M94 125 Q100 131 106 125" stroke={s} strokeWidth="2" fill="none" strokeLinecap="round"/>
      <line x1="100" y1="125" x2="100" y2="120" stroke={s} strokeWidth="1.5" strokeLinecap="round"/>
      {/* whiskers */}
      <line x1="72" y1="121" x2="88" y2="123" stroke={hex(s,0.4)} strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="70" y1="125" x2="88" y2="125" stroke={hex(s,0.4)} strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="128" y1="121" x2="112" y2="123" stroke={hex(s,0.4)} strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="130" y1="125" x2="112" y2="125" stroke={hex(s,0.4)} strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}

// ─── Owl ───────────────────────────────────────────────────────────────────────
function OwlSVG({ p, s }: { p: string; s: string }) {
  return (
    <svg viewBox="0 0 200 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <ellipse cx="100" cy="252" rx="55" ry="8" fill={hex(s, 0.3)}/>
      {/* body / feathers */}
      <ellipse cx="100" cy="190" rx="52" ry="64" fill={p}/>
      <ellipse cx="100" cy="195" rx="40" ry="52" fill={hex(p,0.7)}/>
      {/* wing lines */}
      {[0,1,2,3].map(i => (
        <path key={i} d={`M${52+i*2} ${155+i*16} Q${76} ${148+i*16} ${100} ${150+i*16}`} stroke={hex(s,0.3)} strokeWidth="2" fill="none"/>
      ))}
      {[0,1,2,3].map(i => (
        <path key={i} d={`M${148-i*2} ${155+i*16} Q${124} ${148+i*16} ${100} ${150+i*16}`} stroke={hex(s,0.3)} strokeWidth="2" fill="none"/>
      ))}
      {/* chest pattern */}
      <ellipse cx="100" cy="200" rx="28" ry="44" fill="white" opacity="0.2"/>
      {/* feet */}
      <path d="M80 244 L72 256 M80 244 L80 256 M80 244 L88 256" stroke={s} strokeWidth="3" strokeLinecap="round"/>
      <path d="M120 244 L112 256 M120 244 L120 256 M120 244 L128 256" stroke={s} strokeWidth="3" strokeLinecap="round"/>
      {/* head */}
      <ellipse cx="100" cy="112" rx="44" ry="48" fill={p}/>
      {/* tufts */}
      <polygon points="80,68 72,46 88,70" fill={p}/>
      <polygon points="120,68 128,46 112,70" fill={p}/>
      <polygon points="80,68 74,52 86,68" fill={hex(s,0.4)}/>
      <polygon points="120,68 126,52 114,68" fill={hex(s,0.4)}/>
      {/* face disc */}
      <ellipse cx="100" cy="115" rx="38" ry="40" fill={hex(p,0.5)}/>
      <ellipse cx="100" cy="116" rx="30" ry="32" fill={hex(s,0.1)} stroke={hex(s,0.15)} strokeWidth="1"/>
      {/* BIG eyes - owl signature */}
      <circle cx="84" cy="112" r="16" fill="white"/>
      <circle cx="116" cy="112" r="16" fill="white"/>
      <circle cx="84" cy="112" r="13" fill={hex(p,0.3)}/>
      <circle cx="116" cy="112" r="13" fill={hex(p,0.3)}/>
      <circle cx="84" cy="112" r="9" fill={s}/>
      <circle cx="116" cy="112" r="9" fill={s}/>
      <circle cx="87" cy="108" r="3.5" fill="white"/>
      <circle cx="119" cy="108" r="3.5" fill="white"/>
      {/* glasses - scholar owl! */}
      <path d="M68 112 Q84 108 100 112 Q116 108 132 112" stroke={hex(s,0.6)} strokeWidth="2" fill="none"/>
      <circle cx="84" cy="112" r="16" stroke={hex(s,0.4)} strokeWidth="1.5" fill="none"/>
      <circle cx="116" cy="112" r="16" stroke={hex(s,0.4)} strokeWidth="1.5" fill="none"/>
      {/* beak */}
      <polygon points="100,122 94,132 106,132" fill={hex(s,0.7)}/>
      {/* book held in wings */}
      <rect x="62" y="185" width="76" height="48" rx="6" fill={s}/>
      <rect x="64" y="187" width="35" height="44" rx="4" fill={hex(p,0.6)}/>
      <rect x="101" y="187" width="35" height="44" rx="4" fill={hex(p,0.4)}/>
      <line x1="100" y1="187" x2="100" y2="231" stroke={s} strokeWidth="2"/>
      {/* lines on book pages */}
      {[0,1,2,3].map(i => <line key={i} x1="70" y1={196+i*8} x2="92" y2={196+i*8} stroke="white" strokeWidth="1" opacity="0.5"/>)}
      {[0,1,2,3].map(i => <line key={i} x1="108" y1={196+i*8} x2="130" y2={196+i*8} stroke="white" strokeWidth="1" opacity="0.5"/>)}
    </svg>
  )
}

// ─── Knight ────────────────────────────────────────────────────────────────────
function KnightSVG({ p, s }: { p: string; s: string }) {
  return (
    <svg viewBox="0 0 200 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <ellipse cx="100" cy="252" rx="55" ry="8" fill={hex(s, 0.3)}/>
      {/* cloak */}
      <path d="M56 152 L36 252 L164 252 L144 152 Z" fill={hex(p,0.4)}/>
      {/* torso armor */}
      <rect x="68" y="148" width="64" height="80" rx="10" fill={p}/>
      <rect x="72" y="152" width="56" height="72" rx="8" fill={hex(p,0.7)}/>
      {/* armor details */}
      <rect x="78" y="158" width="44" height="8" rx="3" fill={hex(s,0.4)}/>
      <rect x="82" y="170" width="36" height="6" rx="2" fill={hex(s,0.3)}/>
      <rect x="82" y="180" width="36" height="6" rx="2" fill={hex(s,0.3)}/>
      {/* crest symbol */}
      <polygon points="100,162 103,170 100,168 97,170" fill={hex(s,0.7)}/>
      {/* shoulder pads */}
      <ellipse cx="68" cy="152" rx="18" ry="12" fill={p}/>
      <ellipse cx="132" cy="152" rx="18" ry="12" fill={p}/>
      <ellipse cx="68" cy="151" rx="14" ry="9" fill={hex(p,0.6)}/>
      <ellipse cx="132" cy="151" rx="14" ry="9" fill={hex(p,0.6)}/>
      {/* arms */}
      <rect x="40" y="150" width="26" height="56" rx="10" fill={p}/>
      <rect x="134" y="150" width="26" height="56" rx="10" fill={p}/>
      {/* gauntlets */}
      <rect x="40" y="198" width="26" height="20" rx="6" fill={hex(p,0.8)}/>
      <rect x="134" y="198" width="26" height="20" rx="6" fill={hex(p,0.8)}/>
      {/* sword */}
      <rect x="152" y="80" width="6" height="120" rx="2" fill={hex(s,0.8)}/>
      <rect x="143" y="126" width="24" height="8" rx="2" fill={p}/>
      <ellipse cx="155" cy="80" rx="6" ry="8" fill={hex(p,0.9)}/>
      {/* legs */}
      <rect x="74" y="224" width="22" height="32" rx="8" fill={p}/>
      <rect x="104" y="224" width="22" height="32" rx="8" fill={p}/>
      {/* boots */}
      <rect x="72" y="248" width="26" height="10" rx="4" fill={s}/>
      <rect x="102" y="248" width="26" height="10" rx="4" fill={s}/>
      {/* neck */}
      <rect x="88" y="136" width="24" height="16" rx="4" fill={p}/>
      {/* helmet */}
      <rect x="68" y="80" width="64" height="62" rx="28" fill={p}/>
      <rect x="72" y="84" width="56" height="54" rx="24" fill={hex(p,0.7)}/>
      {/* visor */}
      <rect x="76" y="106" width="48" height="12" rx="3" fill={hex(s,0.6)}/>
      {/* visor grilles */}
      {[82,90,98,106,114].map(x => <line key={x} x1={x} y1={106} x2={x} y2={118} stroke={hex(s,0.4)} strokeWidth="2"/>)}
      {/* plume */}
      <path d="M100 80 Q92 50 88 36 Q94 42 100 48 Q106 42 112 36 Q108 50 100 80Z" fill={hex(p,0.6)} stroke={hex(s,0.3)} strokeWidth="1"/>
      {/* crest on helmet */}
      <path d="M85 84 Q100 78 115 84" stroke={hex(s,0.5)} strokeWidth="3" fill="none" strokeLinecap="round"/>
      {/* eyes through visor */}
      <ellipse cx="88" cy="110" rx="5" ry="3" fill={hex(s,0.8)}/>
      <ellipse cx="112" cy="110" rx="5" ry="3" fill={hex(s,0.8)}/>
    </svg>
  )
}

// ─── Cosmic ────────────────────────────────────────────────────────────────────
function CosmicSVG({ p, s }: { p: string; s: string }) {
  return (
    <svg viewBox="0 0 200 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      {/* outer glow */}
      <circle cx="100" cy="140" r="90" fill={hex(p, 0.04)}/>
      <circle cx="100" cy="140" r="70" fill={hex(p, 0.06)}/>
      {/* orbit rings */}
      <ellipse cx="100" cy="155" rx="70" ry="22" stroke={hex(p,0.3)} strokeWidth="1.5" fill="none"/>
      <ellipse cx="100" cy="140" rx="80" ry="28" stroke={hex(p,0.2)} strokeWidth="1" fill="none" transform="rotate(-15 100 140)"/>
      {/* stars scattered */}
      {[[40,60],[160,70],[30,180],[170,160],[50,230],[150,240],[80,40],[120,35]].map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r={1.5 - (i%2)*0.5} fill={p} opacity={0.6 - i*0.05}/>
      ))}
      {/* shadow */}
      <ellipse cx="100" cy="252" rx="55" ry="8" fill={hex(s, 0.3)}/>
      {/* flowing cosmic body */}
      <path d="M65 155 Q50 210 52 252 L148 252 Q150 210 135 155 Q118 145 100 145 Q82 145 65 155Z" fill={hex(p,0.3)}/>
      <path d="M72 158 Q60 208 62 248 L138 248 Q140 208 128 158 Q114 150 100 150 Q86 150 72 158Z" fill={hex(p,0.2)}/>
      {/* cosmic particles flowing */}
      {[[76,175],[90,195],[110,180],[124,200],[84,215],[116,220]].map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r={3-i%2} fill={p} opacity={0.5-i*0.05}/>
      ))}
      {/* arms - ethereal */}
      <path d="M65 165 Q30 155 22 180 Q18 200 36 205 Q50 208 65 195" fill={hex(p,0.3)} stroke={hex(p,0.4)} strokeWidth="1"/>
      <path d="M135 165 Q170 155 178 180 Q182 200 164 205 Q150 208 135 195" fill={hex(p,0.3)} stroke={hex(p,0.4)} strokeWidth="1"/>
      {/* hands glowing */}
      <circle cx="28" cy="196" r="10" fill={hex(p,0.3)}/>
      <circle cx="28" cy="196" r="6" fill={p} opacity="0.6"/>
      <circle cx="172" cy="196" r="10" fill={hex(p,0.3)}/>
      <circle cx="172" cy="196" r="6" fill={p} opacity="0.6"/>
      {/* neck */}
      <rect x="88" y="138" width="24" height="14" rx="4" fill={hex(p,0.5)}/>
      {/* head aura */}
      <circle cx="100" cy="108" r="50" fill={hex(p,0.08)}/>
      <circle cx="100" cy="108" r="42" fill={hex(p,0.1)}/>
      {/* head */}
      <circle cx="100" cy="108" r="36" fill={hex(p,0.5)}/>
      <circle cx="100" cy="108" r="32" fill={hex(p,0.3)} stroke={hex(p,0.6)} strokeWidth="1.5"/>
      {/* galaxy swirl in face */}
      <path d="M100 88 Q116 96 112 108 Q108 120 100 116 Q88 112 88 104 Q88 96 100 88Z" fill={hex(p,0.3)}/>
      {/* eyes - cosmic / glowing */}
      <ellipse cx="87" cy="106" rx="9" ry="9" fill="white" opacity="0.9"/>
      <ellipse cx="113" cy="106" rx="9" ry="9" fill="white" opacity="0.9"/>
      <circle cx="87" cy="106" r="6.5" fill={p}/>
      <circle cx="113" cy="106" r="6.5" fill={p}/>
      <circle cx="87" cy="106" r="4" fill={s}/>
      <circle cx="113" cy="106" r="4" fill={s}/>
      {/* pupils glow */}
      <circle cx="89" cy="104" r="2" fill="white" opacity="0.9"/>
      <circle cx="115" cy="104" r="2" fill="white" opacity="0.9"/>
      {/* small stars in eyes */}
      <circle cx="84" cy="109" r="1" fill="white" opacity="0.6"/>
      <circle cx="110" cy="109" r="1" fill="white" opacity="0.6"/>
      {/* cosmic mouth */}
      <path d="M90 122 Q100 129 110 122" stroke={hex(p,0.8)} strokeWidth="2" fill="none" strokeLinecap="round"/>
      {/* floating orb */}
      <circle cx="140" cy="80" r="14" fill={hex(p,0.15)}/>
      <circle cx="140" cy="80" r="10" fill={hex(p,0.25)}/>
      <circle cx="140" cy="80" r="6" fill={p} opacity="0.6"/>
      <circle cx="138" cy="77" r="2" fill="white" opacity="0.7"/>
      {/* stars around head */}
      {[[66,75],[134,65],[68,128],[72,96]].map(([x,y],i) => (
        <polygon key={i} points={`${x},${y-4} ${x+1.2},${y-1.2} ${x+4},${y-1.2} ${x+2},${y+1} ${x+2.5},${y+4} ${x},${y+2} ${x-2.5},${y+4} ${x-2},${y+1} ${x-4},${y-1.2} ${x-1.2},${y-1.2}`} fill={p} opacity={0.5+i*0.1}/>
      ))}
    </svg>
  )
}

// ─── Ninja ────────────────────────────────────────────────────────────────────
function NinjaSVG({ p, s }: { p: string; s: string }) {
  return (
    <svg viewBox="0 0 200 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <ellipse cx="100" cy="250" rx="55" ry="8" fill={hex(s, 0.3)}/>
      <path d="M52 158 L40 248 L160 248 L148 158 Q124 146 100 146 Q76 146 52 158Z" fill={p}/>
      <rect x="66" y="186" width="68" height="11" rx="3" fill={s}/>
      <rect x="92" y="186" width="16" height="11" rx="2" fill={hex(p, 0.5)}/>
      <path d="M52 158 Q30 168 28 190 Q30 208 50 208" fill={p}/>
      <path d="M148 158 Q170 168 172 190 Q170 208 150 208" fill={p}/>
      <ellipse cx="46" cy="211" rx="9" ry="7" fill={p}/>
      <ellipse cx="154" cy="211" rx="9" ry="7" fill={p}/>
      <g transform="translate(36 200)"><rect x="-7" y="-2" width="14" height="4" rx="1" fill={s}/><rect x="-7" y="-2" width="14" height="4" rx="1" fill={s} transform="rotate(45 0 0)"/><rect x="-7" y="-2" width="14" height="4" rx="1" fill={s} transform="rotate(90 0 0)"/><circle cx="0" cy="0" r="3" fill={p}/></g>
      <rect x="90" y="138" width="20" height="14" rx="4" fill={p}/>
      <circle cx="100" cy="108" r="42" fill={p}/>
      <path d="M62 92 Q68 72 100 68 Q132 72 138 92" fill={hex(s, 0.35)}/>
      <rect x="79" y="100" width="42" height="20" rx="5" fill={hex(s, 0.8)}/>
      <ellipse cx="90" cy="110" rx="5" ry="5" fill="white"/>
      <ellipse cx="110" cy="110" rx="5" ry="5" fill="white"/>
      <ellipse cx="91" cy="110" rx="3" ry="3" fill={hex(s, 0.9)}/>
      <ellipse cx="111" cy="110" rx="3" ry="3" fill={hex(s, 0.9)}/>
      <ellipse cx="92" cy="109" rx="1.2" ry="1.2" fill="white"/>
      <ellipse cx="112" cy="109" rx="1.2" ry="1.2" fill="white"/>
    </svg>
  )
}

// ─── Viking ───────────────────────────────────────────────────────────────────
function VikingSVG({ p, s }: { p: string; s: string }) {
  return (
    <svg viewBox="0 0 200 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <ellipse cx="100" cy="250" rx="55" ry="8" fill={hex(s, 0.3)}/>
      <path d="M55 158 L42 248 L158 248 L145 158 Q122 148 100 148 Q78 148 55 158Z" fill={p}/>
      <path d="M75 166 L125 166" stroke={hex(s, 0.4)} strokeWidth="2"/><path d="M70 178 L130 178" stroke={hex(s, 0.4)} strokeWidth="2"/>
      <path d="M100 158 L100 222" stroke={hex(s, 0.25)} strokeWidth="2"/>
      <rect x="60" y="190" width="80" height="10" rx="3" fill={s}/>
      <path d="M55 158 Q28 170 24 198 Q28 216 52 218" fill={p}/>
      <path d="M145 158 Q172 170 176 198 Q172 216 148 218" fill={p}/>
      <line x1="25" y1="150" x2="38" y2="222" stroke={s} strokeWidth="5" strokeLinecap="round"/>
      <path d="M12 154 Q25 143 34 162 Q25 180 12 170Z" fill={p}/>
      <rect x="90" y="140" width="20" height="14" rx="4" fill={p}/>
      <circle cx="100" cy="110" r="38" fill={p}/>
      <path d="M72 126 Q68 148 80 157 Q90 162 100 163 Q110 162 120 157 Q132 148 128 126 Q114 134 100 134 Q86 134 72 126Z" fill={hex(s, 0.6)}/>
      <path d="M84 120 Q100 128 116 120" stroke={hex(s, 0.9)} strokeWidth="4" strokeLinecap="round" fill="none"/>
      <path d="M65 108 Q70 66 100 60 Q130 66 135 108Z" fill={s}/>
      <rect x="63" y="104" width="74" height="8" rx="2" fill={hex(s, 0.8)}/>
      <path d="M68 104 Q50 88 44 68 Q52 70 62 86 Q67 96 70 104Z" fill={s}/>
      <path d="M132 104 Q150 88 156 68 Q148 70 138 86 Q133 96 130 104Z" fill={s}/>
      <ellipse cx="88" cy="108" rx="7" ry="6" fill="white"/>
      <ellipse cx="112" cy="108" rx="7" ry="6" fill="white"/>
      <ellipse cx="89" cy="109" rx="4" ry="4" fill={s}/>
      <ellipse cx="113" cy="109" rx="4" ry="4" fill={s}/>
      <ellipse cx="90" cy="108" rx="1.5" ry="1.5" fill="white"/>
      <ellipse cx="114" cy="108" rx="1.5" ry="1.5" fill="white"/>
      <path d="M96 116 Q100 120 104 116" stroke={hex(s, 0.5)} strokeWidth="1.5" fill="none"/>
    </svg>
  )
}

// ─── Astronaut ────────────────────────────────────────────────────────────────
function AstronautSVG({ p, s }: { p: string; s: string }) {
  return (
    <svg viewBox="0 0 200 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <ellipse cx="100" cy="250" rx="55" ry="8" fill={hex(s, 0.3)}/>
      <rect x="50" y="152" width="100" height="88" rx="30" fill={p}/>
      <rect x="58" y="160" width="84" height="72" rx="24" fill={hex(p, 0.6)}/>
      <rect x="66" y="168" width="68" height="56" rx="18" fill={hex(p, 0.3)}/>
      <circle cx="82" cy="202" r="12" fill={hex(s, 0.2)}/><circle cx="118" cy="202" r="12" fill={hex(s, 0.2)}/>
      <text x="78" y="206" fontSize="10" fill={s} fontFamily="monospace">●</text><text x="114" y="206" fontSize="10" fill={s} fontFamily="monospace">●</text>
      <path d="M50 172 Q28 172 24 190 Q28 208 50 210" fill={p} stroke={hex(p, 0.5)} strokeWidth="1"/>
      <path d="M150 172 Q172 172 176 190 Q172 208 150 210" fill={p} stroke={hex(p, 0.5)} strokeWidth="1"/>
      <ellipse cx="50" cy="218" rx="12" ry="9" fill={hex(p, 0.8)}/><ellipse cx="150" cy="218" rx="12" ry="9" fill={hex(p, 0.8)}/>
      <ellipse cx="75" cy="244" rx="16" ry="9" fill={p}/><ellipse cx="125" cy="244" rx="16" ry="9" fill={p}/>
      <circle cx="100" cy="108" r="46" fill={p}/>
      <circle cx="100" cy="108" r="40" fill={hex(s, 0.15)}/>
      <ellipse cx="100" cy="108" rx="32" ry="30" fill={hex(s, 0.3)}/>
      {[[-30,-30],[30,-30],[0,30]].map(([x,y],i) => <circle key={i} cx={100+x*0.6} cy={108+y*0.6} r="2" fill={s} opacity="0.6"/>)}
      <ellipse cx="88" cy="106" rx="7" ry="6" fill="white"/>
      <ellipse cx="112" cy="106" rx="7" ry="6" fill="white"/>
      <ellipse cx="89" cy="107" rx="4" ry="4" fill={s}/>
      <ellipse cx="113" cy="107" rx="4" ry="4" fill={s}/>
      <ellipse cx="90" cy="106" rx="1.5" ry="1.5" fill="white"/>
      <ellipse cx="114" cy="106" rx="1.5" ry="1.5" fill="white"/>
      <path d="M92 116 Q100 122 108 116" stroke={hex(s, 0.5)} strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <rect x="86" y="60" width="28" height="8" rx="4" fill={p}/><line x1="100" y1="60" x2="100" y2="48" stroke={p} strokeWidth="4" strokeLinecap="round"/>
      <circle cx="100" cy="44" r="6" fill={s}/>
    </svg>
  )
}

// ─── Witch ────────────────────────────────────────────────────────────────────
function WitchSVG({ p, s }: { p: string; s: string }) {
  return (
    <svg viewBox="0 0 200 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <ellipse cx="100" cy="250" rx="55" ry="8" fill={hex(s, 0.3)}/>
      <path d="M48 162 L34 248 L166 248 L152 162 Q126 150 100 150 Q74 150 48 162Z" fill={p}/>
      <path d="M100 162 L100 230" stroke={hex(s, 0.2)} strokeWidth="2"/>
      {[[80,185],[95,200],[115,192],[85,215]].map(([x,y],i) => <path key={i} d={`M${x},${y} L${x+4},${y-4} L${x+8},${y} L${x+4},${y+4}Z`} fill={hex(s, 0.3)} transform={`rotate(${i*30} ${x+4} ${y})`}/>)}
      <path d="M48 162 Q26 172 22 196 Q26 215 46 217" fill={p}/>
      <path d="M152 162 Q174 172 178 196 Q174 215 154 217" fill={p}/>
      <line x1="158" y1="152" x2="186" y2="230" stroke={s} strokeWidth="5" strokeLinecap="round"/>
      <ellipse cx="188" cy="233" rx="8" ry="4" fill={hex(s, 0.6)}/>
      <circle cx="34" cy="200" r="10" fill={hex(s, 0.5)}/><circle cx="36" cy="200" r="6" fill={hex(p, 0.4)}/>
      <rect x="90" y="140" width="20" height="14" rx="4" fill={p}/>
      <path d="M66 125 Q60 155 70 168 Q84 172 100 173 Q116 172 130 168 Q140 155 134 125 Q118 132 100 132 Q82 132 66 125Z" fill={hex(p, 0.8)}/>
      <path d="M66 125 Q72 118 100 120 Q128 118 134 125 Q130 122 100 123 Q70 122 66 125Z" fill={hex(p, 0.6)}/>
      <circle cx="100" cy="110" r="36" fill={p}/>
      <ellipse cx="88" cy="108" rx="7" ry="6" fill="white"/>
      <ellipse cx="112" cy="108" rx="7" ry="6" fill="white"/>
      <ellipse cx="89" cy="109" rx="4" ry="4" fill={hex(s, 0.9)}/>
      <ellipse cx="113" cy="109" rx="4" ry="4" fill={hex(s, 0.9)}/>
      <ellipse cx="90" cy="108" rx="1.5" ry="1.5" fill="white"/>
      <ellipse cx="114" cy="108" rx="1.5" ry="1.5" fill="white"/>
      <ellipse cx="100" cy="120" rx="5" ry="3" fill={hex(s, 0.3)}/>
      <path d="M94 125 Q100 130 106 125" stroke={hex(s, 0.5)} strokeWidth="1.5" fill="none"/>
      <path d="M84 68 L100 24 L116 68 Z" fill={p}/>
      <path d="M76 88 Q80 60 100 50 Q120 60 124 88 Z" fill={p}/>
      <rect x="72" y="84" width="56" height="8" rx="2" fill={hex(p, 0.8)}/>
      <circle cx="100" cy="26" r="5" fill={hex(s, 0.7)}/>
    </svg>
  )
}

// ─── Pirate ───────────────────────────────────────────────────────────────────
function PirateSVG({ p, s }: { p: string; s: string }) {
  return (
    <svg viewBox="0 0 200 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <ellipse cx="100" cy="250" rx="55" ry="8" fill={hex(s, 0.3)}/>
      <path d="M52 160 L40 248 L160 248 L148 160 Q124 148 100 148 Q76 148 52 160Z" fill={p}/>
      <path d="M52 160 Q28 170 24 195 Q28 214 50 214" fill={p}/>
      <path d="M148 160 Q172 170 176 195 Q172 214 150 214" fill={p}/>
      <rect x="64" y="188" width="72" height="11" rx="3" fill={s}/>
      <ellipse cx="50" cy="218" rx="11" ry="9" fill={hex(p, 0.8)}/><ellipse cx="150" cy="218" rx="11" ry="9" fill={hex(p, 0.8)}/>
      <rect x="90" y="140" width="20" height="14" rx="4" fill={p}/>
      <circle cx="100" cy="110" r="38" fill={p}/>
      <ellipse cx="88" cy="108" rx="8" ry="7" fill="white"/>
      <ellipse cx="112" cy="108" rx="8" ry="7" fill="white"/>
      <rect x="104" y="101" width="16" height="14" rx="3" fill={hex(s, 0.8)}/>
      <rect x="105" y="102" width="14" height="12" rx="2" fill={hex(p, 0.3)}/>
      <ellipse cx="89" cy="109" rx="5" ry="5" fill={s}/>
      <ellipse cx="90" cy="108" rx="2" ry="2" fill="white"/>
      <ellipse cx="100" cy="120" rx="5" ry="4" fill={hex(s, 0.4)}/>
      <path d="M93 126 Q100 131 107 126" stroke={hex(s, 0.6)} strokeWidth="1.5" fill="none"/>
      <path d="M76 86 Q74 68 100 62 Q126 68 124 86 Q112 80 100 80 Q88 80 76 86Z" fill={s}/>
      <path d="M72 90 Q76 82 100 80 Q124 82 128 90 Z" fill={hex(s, 0.7)}/>
      <rect x="70" y="86" width="60" height="8" rx="2" fill={hex(s, 0.6)}/>
      <line x1="155" y1="200" x2="170" y2="230" stroke={s} strokeWidth="5" strokeLinecap="round"/>
      <path d="M162 214 Q170 210 178 218 Q170 226 162 222 Z" fill={hex(p, 0.8)}/>
      <path d="M148 72 Q160 60 165 70 Q162 80 148 76 Z" fill={hex(s, 0.5)}/>
    </svg>
  )
}

// ─── Robot ────────────────────────────────────────────────────────────────────
function RobotSVG({ p, s }: { p: string; s: string }) {
  return (
    <svg viewBox="0 0 200 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <ellipse cx="100" cy="250" rx="55" ry="8" fill={hex(s, 0.3)}/>
      <rect x="54" y="158" width="92" height="82" rx="12" fill={p}/>
      <rect x="62" y="166" width="76" height="66" rx="8" fill={hex(p, 0.6)}/>
      {[[72,180],[108,180],[72,198],[108,198]].map(([x,y],i) => <rect key={i} x={x} y={y} width="20" height="12" rx="3" fill={hex(s, 0.3)}/>)}
      <circle cx="100" cy="214" r="8" fill={hex(s, 0.5)}/><circle cx="100" cy="214" r="4" fill={s}/>
      <rect x="36" y="168" width="18" height="56" rx="8" fill={p}/>
      <rect x="146" y="168" width="18" height="56" rx="8" fill={p}/>
      <rect x="32" y="220" width="26" height="12" rx="4" fill={hex(p, 0.8)}/>
      <rect x="142" y="220" width="26" height="12" rx="4" fill={hex(p, 0.8)}/>
      <ellipse cx="72" cy="244" rx="14" ry="8" fill={p}/><ellipse cx="128" cy="244" rx="14" ry="8" fill={p}/>
      <rect x="68" y="148" width="64" height="12" rx="4" fill={hex(p, 0.7)}/>
      <rect x="70" y="88" width="60" height="64" rx="10" fill={p}/>
      <rect x="78" y="96" width="44" height="48" rx="6" fill={hex(s, 0.2)}/>
      <rect x="82" y="100" width="16" height="14" rx="3" fill={hex(s, 0.5)}/><rect x="102" y="100" width="16" height="14" rx="3" fill={hex(s, 0.5)}/>
      <circle cx="90" cy="107" r="5" fill={s}/><circle cx="110" cy="107" r="5" fill={s}/>
      <circle cx="90" cy="107" r="2" fill="white"/><circle cx="110" cy="107" r="2" fill="white"/>
      <rect x="84" y="120" width="32" height="6" rx="3" fill={hex(s, 0.4)}/>
      <rect x="94" y="122" width="12" height="2" rx="1" fill={s}/>
      <line x1="100" y1="88" x2="100" y2="76" stroke={p} strokeWidth="4" strokeLinecap="round"/>
      <circle cx="100" cy="72" r="8" fill={s}/><circle cx="100" cy="72" r="4" fill={p}/>
    </svg>
  )
}

// ─── Samurai ──────────────────────────────────────────────────────────────────
function SamuraiSVG({ p, s }: { p: string; s: string }) {
  return (
    <svg viewBox="0 0 200 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <ellipse cx="100" cy="250" rx="55" ry="8" fill={hex(s, 0.3)}/>
      <path d="M50 158 L38 248 L162 248 L150 158 Q125 146 100 146 Q75 146 50 158Z" fill={s}/>
      <path d="M70 158 L62 248 L138 248 L130 158 Q115 150 100 150 Q85 150 70 158Z" fill={p}/>
      <path d="M100 158 L100 228" stroke={hex(s, 0.3)} strokeWidth="3"/>
      <rect x="65" y="185" width="70" height="10" rx="2" fill={s}/>
      <path d="M50 158 Q28 170 24 196 Q28 214 52 214" fill={s}/>
      <path d="M150 158 Q172 170 176 196 Q172 214 148 214" fill={s}/>
      <line x1="158" y1="145" x2="172" y2="238" stroke={hex(s, 0.7)} strokeWidth="4" strokeLinecap="round"/>
      <rect x="155" y="185" width="20" height="8" rx="2" fill={hex(p, 0.5)}/>
      <rect x="90" y="138" width="20" height="14" rx="3" fill={hex(p, 0.9)}/>
      <circle cx="100" cy="108" r="38" fill={p}/>
      <ellipse cx="88" cy="106" rx="7" ry="6" fill="white"/>
      <ellipse cx="112" cy="106" rx="7" ry="6" fill="white"/>
      <ellipse cx="89" cy="107" rx="4" ry="4" fill={s}/>
      <ellipse cx="113" cy="107" rx="4" ry="4" fill={s}/>
      <ellipse cx="90" cy="106" rx="1.5" ry="1.5" fill="white"/>
      <ellipse cx="114" cy="106" rx="1.5" ry="1.5" fill="white"/>
      <path d="M94 118 Q100 122 106 118" stroke={hex(s, 0.5)} strokeWidth="1.5" fill="none"/>
      <path d="M96 82 Q100 74 104 82 L108 78 Q104 68 100 66 Q96 68 92 78Z" fill={s}/>
      <ellipse cx="100" cy="84" rx="22" ry="8" fill={s}/>
      <ellipse cx="100" cy="82" rx="16" ry="6" fill={hex(p, 0.8)}/>
    </svg>
  )
}

// ─── Angel ────────────────────────────────────────────────────────────────────
function AngelSVG({ p, s }: { p: string; s: string }) {
  return (
    <svg viewBox="0 0 200 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <ellipse cx="100" cy="250" rx="55" ry="8" fill={hex(s, 0.3)}/>
      <path d="M22 148 Q14 122 28 110 Q48 100 68 118 Q54 128 52 148Z" fill={hex(p, 0.9)}/>
      <path d="M178 148 Q186 122 172 110 Q152 100 132 118 Q146 128 148 148Z" fill={hex(p, 0.9)}/>
      <path d="M22 148 Q14 122 28 108 Q48 98 72 118" fill="none" stroke={hex(s, 0.4)} strokeWidth="1.5"/>
      <path d="M178 148 Q186 122 172 108 Q152 98 128 118" fill="none" stroke={hex(s, 0.4)} strokeWidth="1.5"/>
      <path d="M58 160 L46 248 L154 248 L142 160 Q120 150 100 150 Q80 150 58 160Z" fill={p}/>
      <path d="M100 160 L100 228" stroke={hex(s, 0.15)} strokeWidth="2"/>
      {[[82,180],[95,196],[108,182],[85,210]].map(([x,y],i) => <path key={i} d={`M${x},${y-4} Q${x+5},${y+4} M${x+8},${y-4} Q${x+3},${y+4}`} stroke={hex(s, 0.3)} strokeWidth="1"/>)}
      <path d="M58 160 Q36 170 32 196 Q36 215 56 215" fill={p}/>
      <path d="M142 160 Q164 170 168 196 Q164 215 144 215" fill={p}/>
      <rect x="90" y="140" width="20" height="14" rx="4" fill={p}/>
      <circle cx="100" cy="108" r="38" fill={p}/>
      <ellipse cx="88" cy="107" rx="7" ry="6" fill="white"/>
      <ellipse cx="112" cy="107" rx="7" ry="6" fill="white"/>
      <ellipse cx="89" cy="108" rx="4" ry="4" fill={hex(s, 0.8)}/>
      <ellipse cx="113" cy="108" rx="4" ry="4" fill={hex(s, 0.8)}/>
      <ellipse cx="90" cy="107" rx="1.5" ry="1.5" fill="white"/>
      <ellipse cx="114" cy="107" rx="1.5" ry="1.5" fill="white"/>
      <path d="M93 119 Q100 124 107 119" stroke={hex(s, 0.5)} strokeWidth="1.5" fill="none"/>
      <ellipse cx="100" cy="76" rx="4" ry="4" fill={hex(s, 0.6)}/>
      <ellipse cx="100" cy="70" rx="16" ry="4" fill="none" stroke={s} strokeWidth="2.5" opacity="0.7"/>
    </svg>
  )
}

// ─── Dragon ───────────────────────────────────────────────────────────────────
function DragonSVG({ p, s }: { p: string; s: string }) {
  return (
    <svg viewBox="0 0 200 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <ellipse cx="100" cy="250" rx="55" ry="8" fill={hex(s, 0.3)}/>
      <path d="M28 152 Q22 130 38 118 Q55 110 72 130" fill={p}/>
      <path d="M172 152 Q178 130 162 118 Q145 110 128 130" fill={p}/>
      <path d="M28 152 Q22 128 40 116 Q58 108 76 130" fill="none" stroke={hex(p, 0.4)} strokeWidth="1"/>
      <path d="M172 152 Q178 128 160 116 Q142 108 124 130" fill="none" stroke={hex(p, 0.4)} strokeWidth="1"/>
      <path d="M54 158 L42 248 L158 248 L146 158 Q122 148 100 148 Q78 148 54 158Z" fill={p}/>
      {[0,1,2,3,4].map(i => <ellipse key={i} cx={72+i*14} cy={175+i*4} rx="7" ry="5" fill={hex(p, 0.5)} transform={`rotate(-10 ${72+i*14} ${175+i*4})`}/>)}
      <path d="M54 158 Q32 170 28 195 Q32 213 52 215" fill={p}/>
      <path d="M146 158 Q168 170 172 195 Q168 213 148 215" fill={p}/>
      <ellipse cx="48" cy="218" rx="11" ry="9" fill={hex(p, 0.7)}/><ellipse cx="152" cy="218" rx="11" ry="9" fill={hex(p, 0.7)}/>
      <rect x="90" y="140" width="20" height="12" rx="3" fill={p}/>
      <circle cx="100" cy="110" r="38" fill={p}/>
      {[0,1,2].map(i => <ellipse key={i} cx={86+i*14} cy={175+i*4} rx="5" ry="4" fill={hex(p, 0.35)}/>)}
      <ellipse cx="88" cy="108" rx="8" ry="7" fill={hex(s, 0.9)}/>
      <ellipse cx="112" cy="108" rx="8" ry="7" fill={hex(s, 0.9)}/>
      <ellipse cx="89" cy="109" rx="5" ry="5" fill={s}/>
      <ellipse cx="113" cy="109" rx="5" ry="5" fill={s}/>
      <ellipse cx="90" cy="108" rx="2" ry="2" fill="white"/>
      <ellipse cx="114" cy="108" rx="2" ry="2" fill="white"/>
      <path d="M94 122 Q100 128 106 122" stroke={hex(s, 0.7)} strokeWidth="2" fill="none"/>
      <path d="M96 126 L98 130 M102 130 L104 126" stroke={hex(s, 0.5)} strokeWidth="1.5" strokeLinecap="round"/>
      <polygon points="92,74 86,66 96,70" fill={s}/><polygon points="108,74 114,66 104,70" fill={s}/>
      <polygon points="78,86 68,72 82,80" fill={p}/><polygon points="122,86 132,72 118,80" fill={p}/>
    </svg>
  )
}

// ─── Jester ───────────────────────────────────────────────────────────────────
function JesterSVG({ p, s }: { p: string; s: string }) {
  return (
    <svg viewBox="0 0 200 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <ellipse cx="100" cy="250" rx="55" ry="8" fill={hex(s, 0.3)}/>
      <path d="M52 158 L40 248 L160 248 L148 158 Q124 148 100 148 Q76 148 52 158Z" fill={p}/>
      <path d="M76 158 L68 248 L132 248 L124 158 Q112 152 100 152 Q88 152 76 158Z" fill={s}/>
      <path d="M100 160 L100 230" stroke={hex(p, 0.3)} strokeWidth="2"/>
      <rect x="62" y="185" width="76" height="10" rx="3" fill={hex(s, 0.5)}/>
      <path d="M52 158 Q28 170 24 196 Q28 214 52 216" fill={p}/>
      <path d="M148 158 Q172 170 176 196 Q172 214 148 216" fill={p}/>
      <ellipse cx="48" cy="219" rx="10" ry="8" fill={hex(p, 0.8)}/><ellipse cx="152" cy="219" rx="10" ry="8" fill={hex(p, 0.8)}/>
      <rect x="90" y="138" width="20" height="14" rx="4" fill={p}/>
      <circle cx="100" cy="108" r="38" fill={p}/>
      <ellipse cx="88" cy="106" rx="7" ry="6" fill="white"/>
      <ellipse cx="112" cy="106" rx="7" ry="6" fill="white"/>
      <ellipse cx="89" cy="107" rx="4" ry="4" fill={s}/>
      <ellipse cx="113" cy="107" rx="4" ry="4" fill={s}/>
      <ellipse cx="90" cy="106" rx="1.5" ry="1.5" fill="white"/>
      <ellipse cx="114" cy="106" rx="1.5" ry="1.5" fill="white"/>
      <path d="M88 120 Q100 130 112 120" stroke={hex(s, 0.8)} strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M78 86 Q74 66 66 52 Q80 58 84 76Z" fill={p}/>
      <path d="M122 86 Q126 66 134 52 Q120 58 116 76Z" fill={s}/>
      <path d="M78 86 Q86 70 100 68 Q114 70 122 86 Q110 80 100 80 Q90 80 78 86Z" fill={hex(p, 0.7)}/>
      <rect x="74" y="82" width="52" height="8" rx="2" fill={hex(s, 0.4)}/>
      <circle cx="66" cy="50" r="6" fill={hex(s, 0.8)}/><circle cx="134" cy="50" r="6" fill={p}/>
    </svg>
  )
}

// ─── Alchemist ────────────────────────────────────────────────────────────────
function AlchemistSVG({ p, s }: { p: string; s: string }) {
  return (
    <svg viewBox="0 0 200 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <ellipse cx="100" cy="250" rx="55" ry="8" fill={hex(s, 0.3)}/>
      <path d="M54 156 L42 248 L158 248 L146 156 Q122 146 100 146 Q78 146 54 156Z" fill={p}/>
      <path d="M100 156 L100 228" stroke={hex(s, 0.2)} strokeWidth="2"/>
      <rect x="64" y="180" width="72" height="10" rx="3" fill={s}/>
      {[[72,195],[84,207],[96,196],[112,204]].map(([x,y],i) => <circle key={i} cx={x} cy={y} r="5" fill={hex(s, 0.4)}/>)}
      <path d="M54 156 Q30 168 26 194 Q30 212 52 214" fill={p}/>
      <path d="M146 156 Q170 168 174 194 Q170 212 148 214" fill={p}/>
      <ellipse cx="48" cy="218" rx="11" ry="9" fill={hex(p, 0.8)}/><ellipse cx="152" cy="218" rx="11" ry="9" fill={hex(p, 0.8)}/>
      <line x1="152" y1="208" x2="168" y2="178" stroke={p} strokeWidth="4" strokeLinecap="round"/>
      <ellipse cx="170" cy="173" rx="9" ry="12" fill={hex(s, 0.3)}/>
      <ellipse cx="170" cy="172" rx="6" ry="8" fill={s} opacity="0.6"/>
      <circle cx="170" cy="164" r="4" fill={hex(p, 0.5)}/>
      <rect x="90" y="138" width="20" height="14" rx="4" fill={p}/>
      <circle cx="100" cy="108" r="38" fill={p}/>
      <ellipse cx="84" cy="108" rx="10" ry="8" fill={hex(s, 0.2)} stroke={s} strokeWidth="2"/>
      <ellipse cx="116" cy="108" rx="10" ry="8" fill={hex(s, 0.2)} stroke={s} strokeWidth="2"/>
      <line x1="94" y1="108" x2="106" y2="108" stroke={s} strokeWidth="2"/>
      <ellipse cx="85" cy="108" rx="6" ry="5" fill="white"/>
      <ellipse cx="117" cy="108" rx="6" ry="5" fill="white"/>
      <ellipse cx="86" cy="109" rx="3.5" ry="3.5" fill={s}/>
      <ellipse cx="118" cy="109" rx="3.5" ry="3.5" fill={s}/>
      <ellipse cx="87" cy="108" rx="1.2" ry="1.2" fill="white"/>
      <ellipse cx="119" cy="108" rx="1.2" ry="1.2" fill="white"/>
      <path d="M92 120 Q100 126 108 120" stroke={hex(s, 0.6)} strokeWidth="1.5" fill="none"/>
      <ellipse cx="100" cy="86" rx="20" ry="7" fill={hex(s, 0.4)} transform="rotate(-5 100 86)"/>
      <ellipse cx="100" cy="84" rx="14" ry="5" fill={hex(p, 0.6)} transform="rotate(-5 100 84)"/>
    </svg>
  )
}

// ─── Necromancer ─────────────────────────────────────────────────────────────
function NecromancerSVG({ p, s }: { p: string; s: string }) {
  return (
    <svg viewBox="0 0 200 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <ellipse cx="100" cy="250" rx="55" ry="8" fill={hex(s, 0.3)}/>
      <path d="M48 160 L34 248 L166 248 L152 160 Q126 148 100 148 Q74 148 48 160Z" fill={p}/>
      <path d="M100 160 L100 230" stroke={hex(s, 0.2)} strokeWidth="2"/>
      {[[75,178],[90,192],[110,185],[125,198]].map(([x,y],i) => <path key={i} d={`M${x},${y} L${x+5},${y-5} L${x+10},${y} L${x+5},${y+5}Z`} fill={hex(s, 0.25)} transform={`rotate(${i*20} ${x+5} ${y})`}/>)}
      <path d="M48 160 Q24 172 20 198 Q24 217 46 218" fill={p}/>
      <path d="M152 160 Q176 172 180 198 Q176 217 154 218" fill={p}/>
      <ellipse cx="40" cy="222" rx="13" ry="10" fill={hex(p, 0.7)}/><ellipse cx="160" cy="222" rx="13" ry="10" fill={hex(p, 0.7)}/>
      <circle cx="38" cy="210" r="12" fill={hex(s, 0.6)} opacity="0.6"/>
      <circle cx="38" cy="210" r="7" fill={s} opacity="0.8"/>
      <circle cx="162" cy="210" r="12" fill={hex(s, 0.6)} opacity="0.6"/>
      <circle cx="162" cy="210" r="7" fill={s} opacity="0.8"/>
      <rect x="90" y="140" width="20" height="14" rx="4" fill={p}/>
      <circle cx="100" cy="108" r="38" fill={p}/>
      <path d="M62 94 Q66 72 100 66 Q134 72 138 94" fill={hex(s, 0.4)}/>
      <path d="M62 94 Q76 86 100 85 Q124 86 138 94" fill={hex(p, 0.9)}/>
      <ellipse cx="88" cy="108" rx="8" ry="7" fill="white"/>
      <ellipse cx="112" cy="108" rx="8" ry="7" fill="white"/>
      <ellipse cx="89" cy="109" rx="5" ry="5" fill={s}/>
      <ellipse cx="113" cy="109" rx="5" ry="5" fill={s}/>
      <circle cx="89" cy="107" r="8" fill={s} opacity="0.4"/>
      <circle cx="113" cy="107" r="8" fill={s} opacity="0.4"/>
      <ellipse cx="90" cy="108" rx="2" ry="2" fill="white"/>
      <ellipse cx="114" cy="108" rx="2" ry="2" fill="white"/>
      <path d="M94 122 Q100 126 106 122" stroke={hex(s, 0.6)} strokeWidth="1.5" fill="none"/>
      <ellipse cx="100" cy="122" rx="5" ry="3" fill={hex(s, 0.3)}/>
    </svg>
  )
}

// ─── Main export ───────────────────────────────────────────────────────────────
interface AvatarCharacterProps {
  character: CharacterId
  primaryColor: string
  secondaryColor: string
  size?: number
  style?: React.CSSProperties
}

export function AvatarCharacter({ character, primaryColor, secondaryColor, size = 160, style }: AvatarCharacterProps) {
  const props = { p: primaryColor, s: secondaryColor }
  const el: Record<CharacterId, React.ReactElement> = {
    lion: <LionSVG {...props}/>,
    mage: <MageSVG {...props}/>,
    fox: <FoxSVG {...props}/>,
    owl: <OwlSVG {...props}/>,
    knight: <KnightSVG {...props}/>,
    cosmic: <CosmicSVG {...props}/>,
    phoenix: <CosmicSVG {...props}/>,
    shadow: <KnightSVG {...props}/>,
    ninja: <NinjaSVG {...props}/>,
    viking: <VikingSVG {...props}/>,
    astronaut: <AstronautSVG {...props}/>,
    witch: <WitchSVG {...props}/>,
    pirate: <PirateSVG {...props}/>,
    robot: <RobotSVG {...props}/>,
    samurai: <SamuraiSVG {...props}/>,
    angel: <AngelSVG {...props}/>,
    dragon: <DragonSVG {...props}/>,
    jester: <JesterSVG {...props}/>,
    alchemist: <AlchemistSVG {...props}/>,
    necromancer: <NecromancerSVG {...props}/>,
  }

  return (
    <div style={{ width: size, height: Math.round(size * 1.3), ...style }}>
      {el[character]}
    </div>
  )
}
