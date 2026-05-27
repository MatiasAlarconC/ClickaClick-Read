import React, { Suspense, useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { CharacterId } from './AvatarCharacter'

// ─── Color helpers ────────────────────────────────────────────────────────────
function lighten(hex: string, t: number): string {
  if (!hex.startsWith('#') || hex.length < 7) return hex
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${Math.round(r + (255 - r) * t)},${Math.round(g + (255 - g) * t)},${Math.round(b + (255 - b) * t)})`
}

// ─── Rotating wrapper ─────────────────────────────────────────────────────────
function AutoRotate({ children, speed = 0.35 }: { children: React.ReactNode; speed?: number }) {
  const ref = useRef<THREE.Group>(null)
  useFrame((_, d) => { if (ref.current) ref.current.rotation.y += d * speed })
  return <group ref={ref}>{children}</group>
}

// ─── LEO — The Bold Reader (Lion) ─────────────────────────────────────────────
function LeoMesh({ p, s }: { p: string; s: string }) {
  const belly = lighten(p, 0.42)
  const innerEar = lighten(s, 0.35)
  const maneRing = useMemo(() =>
    Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2
      return [Math.sin(a) * 0.52, Math.cos(a) * 0.22 + 0.11, Math.cos(a) * 0.34 - 0.04, -Math.cos(a) * 0.5, Math.sin(a) * 0.5] as const
    }), [])

  return (
    <group position={[0, -0.28, 0]}>
      {/* Torso */}
      <mesh position={[0, -0.52, 0]}>
        <cylinderGeometry args={[0.36, 0.43, 0.80, 24]} />
        <meshStandardMaterial color={p} roughness={0.55} metalness={0.05} />
      </mesh>
      {/* Belly */}
      <mesh position={[0, -0.54, 0.24]}>
        <sphereGeometry args={[0.28, 20, 20]} />
        <meshStandardMaterial color={belly} roughness={0.65} />
      </mesh>
      {/* Chest */}
      <mesh position={[0, -0.18, 0.26]}>
        <sphereGeometry args={[0.22, 18, 18]} />
        <meshStandardMaterial color={belly} roughness={0.65} />
      </mesh>
      {/* Left arm */}
      <mesh position={[-0.50, -0.38, 0.05]} rotation={[0.25, 0.1, 0.48]}>
        <capsuleGeometry args={[0.09, 0.34, 8, 14]} />
        <meshStandardMaterial color={p} roughness={0.55} />
      </mesh>
      <mesh position={[-0.70, -0.22, 0.10]}>
        <sphereGeometry args={[0.11, 16, 16]} />
        <meshStandardMaterial color={p} roughness={0.6} />
      </mesh>
      {[-0.06, 0, 0.06].map((dx, i) => (
        <mesh key={i} position={[-0.70 + dx, -0.12, 0.16]}>
          <sphereGeometry args={[0.022, 8, 8]} />
          <meshStandardMaterial color={s} roughness={0.3} />
        </mesh>
      ))}
      {/* Right arm */}
      <mesh position={[0.50, -0.38, 0.05]} rotation={[0.25, -0.1, -0.48]}>
        <capsuleGeometry args={[0.09, 0.34, 8, 14]} />
        <meshStandardMaterial color={p} roughness={0.55} />
      </mesh>
      <mesh position={[0.70, -0.22, 0.10]}>
        <sphereGeometry args={[0.11, 16, 16]} />
        <meshStandardMaterial color={p} roughness={0.6} />
      </mesh>
      {/* Book in right paw */}
      <mesh position={[0.86, -0.30, 0.16]} rotation={[0.2, -0.35, 0.10]}>
        <boxGeometry args={[0.22, 0.28, 0.06]} />
        <meshStandardMaterial color={s} roughness={0.8} />
      </mesh>
      <mesh position={[0.87, -0.30, 0.20]} rotation={[0.2, -0.35, 0.10]}>
        <boxGeometry args={[0.20, 0.26, 0.009]} />
        <meshStandardMaterial color="#F5E6C8" roughness={0.95} />
      </mesh>
      <mesh position={[0.74, -0.30, 0.16]} rotation={[0.2, -0.35, 0.10]}>
        <boxGeometry args={[0.012, 0.28, 0.06]} />
        <meshStandardMaterial color={p} roughness={0.8} />
      </mesh>
      {/* Tail */}
      <mesh position={[-0.06, -0.90, -0.32]} rotation={[0.72, -0.25, 0.10]}>
        <capsuleGeometry args={[0.075, 0.50, 8, 12]} />
        <meshStandardMaterial color={p} roughness={0.7} />
      </mesh>
      <mesh position={[0.06, -0.82, -0.62]} rotation={[-0.30, 0.22, 0.05]}>
        <capsuleGeometry args={[0.062, 0.28, 8, 12]} />
        <meshStandardMaterial color={p} roughness={0.7} />
      </mesh>
      <mesh position={[0.12, -0.70, -0.84]}>
        <sphereGeometry args={[0.11, 18, 18]} />
        <meshStandardMaterial color={s} roughness={0.85} />
      </mesh>
      <mesh position={[0.14, -0.65, -0.87]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial color={lighten(s, 0.3)} roughness={0.85} />
      </mesh>
      {/* Mane torus */}
      <mesh position={[0, 0.10, -0.06]} rotation={[0.15, 0, 0]}>
        <torusGeometry args={[0.52, 0.19, 12, 44]} />
        <meshStandardMaterial color={s} roughness={0.8} />
      </mesh>
      {/* Mane spikes */}
      {maneRing.map(([x, y, z, rx, rz], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[rx, 0, rz]}>
          <coneGeometry args={[0.048, 0.22, 8]} />
          <meshStandardMaterial color={s} roughness={0.75} />
        </mesh>
      ))}
      {/* Head */}
      <mesh position={[0, 0.13, 0]}>
        <sphereGeometry args={[0.38, 32, 32]} />
        <meshStandardMaterial color={p} roughness={0.48} metalness={0.05} />
      </mesh>
      {/* Ears */}
      <mesh position={[-0.25, 0.50, 0.06]} rotation={[0, 0, -0.28]}>
        <coneGeometry args={[0.09, 0.19, 14]} />
        <meshStandardMaterial color={p} roughness={0.6} />
      </mesh>
      <mesh position={[-0.25, 0.50, 0.09]} rotation={[0, 0, -0.28]}>
        <coneGeometry args={[0.040, 0.10, 10]} />
        <meshStandardMaterial color={innerEar} roughness={0.5} />
      </mesh>
      <mesh position={[0.25, 0.50, 0.06]} rotation={[0, 0, 0.28]}>
        <coneGeometry args={[0.09, 0.19, 14]} />
        <meshStandardMaterial color={p} roughness={0.6} />
      </mesh>
      <mesh position={[0.25, 0.50, 0.09]} rotation={[0, 0, 0.28]}>
        <coneGeometry args={[0.040, 0.10, 10]} />
        <meshStandardMaterial color={innerEar} roughness={0.5} />
      </mesh>
      {/* Eyes */}
      <mesh position={[-0.13, 0.17, 0.355]}>
        <sphereGeometry args={[0.062, 18, 18]} />
        <meshStandardMaterial color="#1a0800" roughness={0.1} metalness={0.5} />
      </mesh>
      <mesh position={[-0.105, 0.200, 0.388]}>
        <sphereGeometry args={[0.018, 8, 8]} />
        <meshStandardMaterial color="#FFF" emissive="#FFF" emissiveIntensity={0.9} />
      </mesh>
      <mesh position={[0.13, 0.17, 0.355]}>
        <sphereGeometry args={[0.062, 18, 18]} />
        <meshStandardMaterial color="#1a0800" roughness={0.1} metalness={0.5} />
      </mesh>
      <mesh position={[0.155, 0.200, 0.388]}>
        <sphereGeometry args={[0.018, 8, 8]} />
        <meshStandardMaterial color="#FFF" emissive="#FFF" emissiveIntensity={0.9} />
      </mesh>
      {/* Nose */}
      <mesh position={[0, 0.03, 0.41]} scale={[1, 0.65, 0.85]}>
        <sphereGeometry args={[0.048, 14, 14]} />
        <meshStandardMaterial color={s} roughness={0.35} />
      </mesh>
      {/* Whisker dots */}
      {([-0.20, -0.10, -0.26, 0.20, 0.10, 0.26] as number[]).map((wx, i) => (
        <mesh key={i} position={[wx, -0.002, 0.40]}>
          <sphereGeometry args={[0.013, 8, 8]} />
          <meshStandardMaterial color={s} roughness={0.4} />
        </mesh>
      ))}
    </group>
  )
}

// ─── SAGE — The Wise Scholar (Mage) ───────────────────────────────────────────
function SageMesh({ p, s }: { p: string; s: string }) {
  const orbRef = useRef<THREE.Group>(null)
  useFrame((_, d) => { if (orbRef.current) orbRef.current.rotation.y += d * 0.9 })

  return (
    <group position={[0, -0.35, 0]}>
      {/* Robe bottom */}
      <mesh position={[0, -0.55, 0]}>
        <cylinderGeometry args={[0.52, 0.60, 0.66, 28]} />
        <meshStandardMaterial color={p} roughness={0.7} />
      </mesh>
      {/* Robe hem */}
      <mesh position={[0, -0.88, 0]}>
        <torusGeometry args={[0.54, 0.04, 8, 40]} />
        <meshStandardMaterial color={s} roughness={0.65} />
      </mesh>
      {/* Robe upper */}
      <mesh position={[0, -0.10, 0]}>
        <cylinderGeometry args={[0.42, 0.52, 0.75, 24]} />
        <meshStandardMaterial color={p} roughness={0.7} />
      </mesh>
      {/* Belt */}
      <mesh position={[0, -0.23, 0]}>
        <torusGeometry args={[0.44, 0.042, 8, 36]} />
        <meshStandardMaterial color={s} roughness={0.5} metalness={0.2} />
      </mesh>
      {/* Belt buckle */}
      <mesh position={[0, -0.23, 0.45]}>
        <boxGeometry args={[0.10, 0.08, 0.03]} />
        <meshStandardMaterial color="#FFD700" roughness={0.3} metalness={0.8} />
      </mesh>
      {/* Collar */}
      <mesh position={[0, 0.14, 0]}>
        <cylinderGeometry args={[0.44, 0.44, 0.10, 24]} />
        <meshStandardMaterial color={s} roughness={0.65} />
      </mesh>
      {/* Left sleeve */}
      <mesh position={[-0.52, -0.12, 0]} rotation={[0.15, 0, 0.50]}>
        <capsuleGeometry args={[0.10, 0.36, 8, 14]} />
        <meshStandardMaterial color={p} roughness={0.7} />
      </mesh>
      <mesh position={[-0.72, 0.00, 0.04]} rotation={[0.15, 0, 0.5]}>
        <torusGeometry args={[0.10, 0.030, 8, 20]} />
        <meshStandardMaterial color={s} roughness={0.5} />
      </mesh>
      <mesh position={[-0.80, 0.06, 0.08]}>
        <sphereGeometry args={[0.08, 14, 14]} />
        <meshStandardMaterial color={p} roughness={0.6} />
      </mesh>
      {/* Right sleeve — holds staff */}
      <mesh position={[0.50, -0.06, 0]} rotation={[-0.10, 0, -0.40]}>
        <capsuleGeometry args={[0.10, 0.36, 8, 14]} />
        <meshStandardMaterial color={p} roughness={0.7} />
      </mesh>
      <mesh position={[0.72, 0.10, 0.04]}>
        <sphereGeometry args={[0.08, 14, 14]} />
        <meshStandardMaterial color={p} roughness={0.6} />
      </mesh>
      {/* Rune dots on robe */}
      {([[-0.22, -0.40], [0.18, -0.28], [-0.10, -0.62], [0.24, -0.58]] as [number, number][]).map(([rx, ry], i) => (
        <mesh key={i} position={[rx, ry, 0.53]}>
          <sphereGeometry args={[0.025, 8, 8]} />
          <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.6} />
        </mesh>
      ))}
      {/* Staff */}
      <mesh position={[0.82, -0.30, 0.04]} rotation={[0.08, 0, 0.10]}>
        <cylinderGeometry args={[0.025, 0.030, 1.60, 14]} />
        <meshStandardMaterial color={s} roughness={0.5} metalness={0.4} />
      </mesh>
      {[0.32, 0.16, 0.0].map((y, i) => (
        <mesh key={i} position={[0.82, y, 0.04]} rotation={[Math.PI / 2, 0, 0.10]}>
          <torusGeometry args={[0.040, 0.014, 8, 20]} />
          <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.3} metalness={0.7} />
        </mesh>
      ))}
      {/* Staff orb */}
      <mesh position={[0.83, 0.56, 0.04]}>
        <sphereGeometry args={[0.08, 18, 18]} />
        <meshStandardMaterial color="#FFFFFF" emissive={p} emissiveIntensity={0.75} roughness={0.1} />
      </mesh>
      <mesh position={[0.83, 0.56, 0.04]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.10, 0.020, 8, 24]} />
        <meshStandardMaterial color={p} emissive={p} emissiveIntensity={0.85} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.40, 0]}>
        <sphereGeometry args={[0.34, 28, 28]} />
        <meshStandardMaterial color={p} roughness={0.5} />
      </mesh>
      {/* Beard */}
      {([[-0.12, 0.14, 0.30], [0, 0.09, 0.33], [0.12, 0.14, 0.30]] as [number, number, number][]).map(([bx, by, bz], i) => (
        <mesh key={i} position={[bx, by + 0.40, bz]} rotation={[0.25 + (i - 1) * 0.1, 0, (i - 1) * 0.20]}>
          <capsuleGeometry args={[0.030, 0.18, 6, 10]} />
          <meshStandardMaterial color={lighten(p, 0.5)} roughness={0.8} />
        </mesh>
      ))}
      {([[-0.08, 0.02, 0.30], [0, -0.02, 0.33], [0.08, 0.02, 0.30]] as [number, number, number][]).map(([bx, by, bz], i) => (
        <mesh key={i + 3} position={[bx, by + 0.40, bz]} rotation={[0.40, 0, (i - 1) * 0.18]}>
          <capsuleGeometry args={[0.022, 0.12, 6, 8]} />
          <meshStandardMaterial color={lighten(p, 0.6)} roughness={0.8} />
        </mesh>
      ))}
      {/* Eyes */}
      <mesh position={[-0.12, 0.42, 0.30]}>
        <sphereGeometry args={[0.048, 16, 16]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.1} metalness={0.5} />
      </mesh>
      <mesh position={[-0.095, 0.444, 0.33]}>
        <sphereGeometry args={[0.014, 8, 8]} />
        <meshStandardMaterial color="#FFF" emissive="#FFF" emissiveIntensity={0.9} />
      </mesh>
      <mesh position={[0.12, 0.42, 0.30]}>
        <sphereGeometry args={[0.048, 16, 16]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.1} metalness={0.5} />
      </mesh>
      <mesh position={[0.145, 0.444, 0.33]}>
        <sphereGeometry args={[0.014, 8, 8]} />
        <meshStandardMaterial color="#FFF" emissive="#FFF" emissiveIntensity={0.9} />
      </mesh>
      {/* Hat brim */}
      <mesh position={[0, 0.72, 0]}>
        <cylinderGeometry args={[0.52, 0.52, 0.06, 32]} />
        <meshStandardMaterial color={s} roughness={0.6} metalness={0.1} />
      </mesh>
      {/* Hat band */}
      <mesh position={[0, 0.75, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.33, 0.030, 8, 32]} />
        <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.3} metalness={0.6} />
      </mesh>
      {/* Hat cone */}
      <mesh position={[0, 0.72, 0]}>
        <coneGeometry args={[0.32, 0.92, 32]} />
        <meshStandardMaterial color={s} roughness={0.6} metalness={0.1} />
      </mesh>
      {/* Hat stars */}
      {([[0.06, 1.12, 0.18], [0.18, 0.92, 0.24], [-0.20, 0.86, 0.20], [0.12, 0.80, -0.28]] as [number, number, number][]).map(([hx, hy, hz], i) => (
        <mesh key={i} position={[hx, hy, hz]}>
          <sphereGeometry args={[i === 0 ? 0.042 : 0.026, 8, 8]} />
          <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.9} />
        </mesh>
      ))}
      {/* Orbiting spell particles */}
      <group ref={orbRef} position={[0, 0.05, 0]}>
        {([0, Math.PI * 2 / 3, Math.PI * 4 / 3] as number[]).map((angle, i) => (
          <mesh key={i} position={[Math.cos(angle) * 0.68, Math.sin(angle) * 0.20 + 0.16, Math.sin(angle) * 0.52]}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshStandardMaterial color={i === 0 ? p : i === 1 ? '#FFD700' : s} emissive={i === 0 ? p : i === 1 ? '#FFD700' : s} emissiveIntensity={0.9} />
          </mesh>
        ))}
        <mesh rotation={[0.5, 0, 0]}>
          <torusGeometry args={[0.68, 0.012, 6, 56]} />
          <meshStandardMaterial color={p} emissive={p} emissiveIntensity={0.25} transparent opacity={0.45} />
        </mesh>
      </group>
    </group>
  )
}

// ─── VEX — The Cunning Explorer (Fox) ─────────────────────────────────────────
function VexMesh({ p, s }: { p: string; s: string }) {
  const belly = '#FFF8F0'
  const innerEar = '#FF8877'
  // Tail: 8 sphere positions in upward arc
  const tailSpheres = useMemo<Array<[number, number, number, number]>>(() => [
    [-0.05, -0.88, -0.30, 0.12],
    [-0.08, -0.68, -0.58, 0.115],
    [-0.02, -0.46, -0.78, 0.110],
    [0.06, -0.24, -0.90, 0.105],
    [0.14, -0.02, -0.92, 0.100],
    [0.22, 0.18, -0.82, 0.095],
    [0.26, 0.36, -0.66, 0.086],
    [0.24, 0.50, -0.50, 0.125],
  ], [])

  return (
    <group position={[0, -0.20, 0]}>
      {/* Body */}
      <mesh position={[0, -0.60, 0]}>
        <sphereGeometry args={[0.50, 32, 32]} />
        <meshStandardMaterial color={p} roughness={0.55} metalness={0.04} />
      </mesh>
      {/* Belly marking */}
      <mesh position={[0, -0.58, 0.30]}>
        <sphereGeometry args={[0.32, 22, 22]} />
        <meshStandardMaterial color={belly} roughness={0.7} />
      </mesh>
      {/* Left arm */}
      <mesh position={[-0.48, -0.40, 0.06]} rotation={[0.20, 0.1, 0.45]}>
        <capsuleGeometry args={[0.09, 0.32, 8, 14]} />
        <meshStandardMaterial color={p} roughness={0.55} />
      </mesh>
      <mesh position={[-0.68, -0.24, 0.12]}>
        <sphereGeometry args={[0.10, 14, 14]} />
        <meshStandardMaterial color={p} roughness={0.6} />
      </mesh>
      {/* Right arm */}
      <mesh position={[0.48, -0.40, 0.06]} rotation={[0.20, -0.1, -0.45]}>
        <capsuleGeometry args={[0.09, 0.32, 8, 14]} />
        <meshStandardMaterial color={p} roughness={0.55} />
      </mesh>
      <mesh position={[0.68, -0.24, 0.12]}>
        <sphereGeometry args={[0.10, 14, 14]} />
        <meshStandardMaterial color={p} roughness={0.6} />
      </mesh>
      {/* BIG FLUFFY TAIL */}
      {tailSpheres.map(([tx, ty, tz, tr], i) => (
        <mesh key={i} position={[tx, ty, tz]}>
          <sphereGeometry args={[tr, 16, 16]} />
          <meshStandardMaterial
            color={i === tailSpheres.length - 1 ? belly : i > 4 ? lighten(p, 0.15) : p}
            roughness={0.82}
          />
        </mesh>
      ))}
      {/* Tail tip fluff cluster */}
      {([[-0.04, 0.44, -0.44], [0.34, 0.46, -0.42], [0.20, 0.60, -0.46]] as [number, number, number][]).map(([tx, ty, tz], i) => (
        <mesh key={i} position={[tx, ty, tz]}>
          <sphereGeometry args={[0.068, 12, 12]} />
          <meshStandardMaterial color={belly} roughness={0.85} />
        </mesh>
      ))}
      {/* Head */}
      <mesh position={[0, 0.10, 0]}>
        <sphereGeometry args={[0.38, 32, 32]} />
        <meshStandardMaterial color={p} roughness={0.50} metalness={0.04} />
      </mesh>
      {/* Muzzle base */}
      <mesh position={[0, -0.04, 0.32]} scale={[1.0, 0.72, 1.0]}>
        <sphereGeometry args={[0.20, 22, 22]} />
        <meshStandardMaterial color={lighten(p, 0.15)} roughness={0.6} />
      </mesh>
      {/* Muzzle tip */}
      <mesh position={[0, -0.06, 0.42]}>
        <sphereGeometry args={[0.13, 16, 16]} />
        <meshStandardMaterial color={belly} roughness={0.7} />
      </mesh>
      {/* Tall pointed ears */}
      <mesh position={[-0.24, 0.52, 0.04]} rotation={[0, 0, -0.20]}>
        <coneGeometry args={[0.09, 0.44, 14]} />
        <meshStandardMaterial color={p} roughness={0.6} />
      </mesh>
      <mesh position={[-0.24, 0.54, 0.08]} rotation={[0, 0, -0.20]}>
        <coneGeometry args={[0.040, 0.22, 10]} />
        <meshStandardMaterial color={innerEar} roughness={0.5} />
      </mesh>
      <mesh position={[0.24, 0.52, 0.04]} rotation={[0, 0, 0.20]}>
        <coneGeometry args={[0.09, 0.44, 14]} />
        <meshStandardMaterial color={p} roughness={0.6} />
      </mesh>
      <mesh position={[0.24, 0.54, 0.08]} rotation={[0, 0, 0.20]}>
        <coneGeometry args={[0.040, 0.22, 10]} />
        <meshStandardMaterial color={innerEar} roughness={0.5} />
      </mesh>
      {/* Eyes */}
      <mesh position={[-0.13, 0.14, 0.34]}>
        <sphereGeometry args={[0.058, 18, 18]} />
        <meshStandardMaterial color="#1a0800" roughness={0.1} metalness={0.5} />
      </mesh>
      <mesh position={[-0.10, 0.166, 0.368]}>
        <sphereGeometry args={[0.018, 8, 8]} />
        <meshStandardMaterial color="#FFF" emissive="#FFF" emissiveIntensity={0.9} />
      </mesh>
      <mesh position={[0.13, 0.14, 0.34]}>
        <sphereGeometry args={[0.058, 18, 18]} />
        <meshStandardMaterial color="#1a0800" roughness={0.1} metalness={0.5} />
      </mesh>
      <mesh position={[0.155, 0.166, 0.368]}>
        <sphereGeometry args={[0.018, 8, 8]} />
        <meshStandardMaterial color="#FFF" emissive="#FFF" emissiveIntensity={0.9} />
      </mesh>
      {/* Nose */}
      <mesh position={[0, 0.02, 0.44]}>
        <sphereGeometry args={[0.036, 12, 12]} />
        <meshStandardMaterial color="#1a0800" roughness={0.3} />
      </mesh>
      <mesh position={[0.010, 0.032, 0.462]}>
        <sphereGeometry args={[0.009, 6, 6]} />
        <meshStandardMaterial color="#FFF" emissive="#FFF" emissiveIntensity={0.8} />
      </mesh>
      {/* Whisker lines */}
      {([-0.30, -0.20, -0.36, 0.30, 0.20, 0.36] as number[]).map((wx, i) => (
        <mesh key={i} position={[wx, 0.00, 0.40]} rotation={[0, 0, (i < 3 ? -1 : 1) * (i % 3) * 0.12]}>
          <capsuleGeometry args={[0.007, 0.22, 4, 8]} />
          <meshStandardMaterial color={belly} roughness={0.8} />
        </mesh>
      ))}
    </group>
  )
}

// ─── ORION — The Night Thinker (Owl) ──────────────────────────────────────────
function OrionMesh({ p, s }: { p: string; s: string }) {
  return (
    <group position={[0, -0.25, 0]}>
      {/* Body */}
      <mesh position={[0, -0.58, 0]} scale={[1, 1.12, 0.88]}>
        <sphereGeometry args={[0.52, 32, 32]} />
        <meshStandardMaterial color={p} roughness={0.65} metalness={0.04} />
      </mesh>
      {/* Breast plumage rows */}
      {([-0.50, -0.35, -0.20, -0.06] as number[]).map((py, row) =>
        ([-0.28, 0, 0.28] as number[]).map((px, col) => (
          <mesh key={`${row}-${col}`} position={[px, py, 0.44]} rotation={[-0.30, 0, 0]}>
            <sphereGeometry args={[0.085, 12, 12]} />
            <meshStandardMaterial color={lighten(p, 0.25)} roughness={0.75} />
          </mesh>
        ))
      )}
      {/* Left wing — 3 feather segments */}
      <mesh position={[-0.62, -0.44, -0.06]} rotation={[0.08, 0.25, 0.18]}>
        <boxGeometry args={[0.22, 0.52, 0.06]} />
        <meshStandardMaterial color={s} roughness={0.8} />
      </mesh>
      <mesh position={[-0.84, -0.34, -0.04]} rotation={[0.05, 0.22, 0.36]}>
        <boxGeometry args={[0.18, 0.36, 0.05]} />
        <meshStandardMaterial color={lighten(s, 0.10)} roughness={0.8} />
      </mesh>
      <mesh position={[-1.00, -0.24, -0.02]} rotation={[0.02, 0.18, 0.56]}>
        <boxGeometry args={[0.14, 0.22, 0.04]} />
        <meshStandardMaterial color={lighten(s, 0.20)} roughness={0.8} />
      </mesh>
      {/* Right wing — 3 feather segments */}
      <mesh position={[0.62, -0.44, -0.06]} rotation={[0.08, -0.25, -0.18]}>
        <boxGeometry args={[0.22, 0.52, 0.06]} />
        <meshStandardMaterial color={s} roughness={0.8} />
      </mesh>
      <mesh position={[0.84, -0.34, -0.04]} rotation={[0.05, -0.22, -0.36]}>
        <boxGeometry args={[0.18, 0.36, 0.05]} />
        <meshStandardMaterial color={lighten(s, 0.10)} roughness={0.8} />
      </mesh>
      <mesh position={[1.00, -0.24, -0.02]} rotation={[0.02, -0.18, -0.56]}>
        <boxGeometry args={[0.14, 0.22, 0.04]} />
        <meshStandardMaterial color={lighten(s, 0.20)} roughness={0.8} />
      </mesh>
      {/* Feet / talons */}
      {([-0.22, 0.22] as number[]).map((fx, foot) => (
        <group key={foot} position={[fx, -1.12, 0.10]}>
          {([-0.10, 0, 0.10, -0.16] as number[]).map((dx, talon) => (
            <mesh key={talon} position={[dx, -0.04, talon === 3 ? -0.14 : 0.12]} rotation={[talon === 3 ? 0.30 : -0.50, 0, dx * 2]}>
              <coneGeometry args={[0.022, 0.16, 8]} />
              <meshStandardMaterial color={s} roughness={0.5} metalness={0.1} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Head */}
      <mesh position={[0, 0.16, 0]}>
        <sphereGeometry args={[0.42, 32, 32]} />
        <meshStandardMaterial color={p} roughness={0.58} metalness={0.04} />
      </mesh>
      {/* Facial disc ring */}
      <mesh position={[0, 0.14, 0.32]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.28, 0.04, 8, 32]} />
        <meshStandardMaterial color={s} roughness={0.65} />
      </mesh>
      {/* Ear tufts */}
      <mesh position={[-0.22, 0.58, 0.04]} rotation={[0.10, 0, -0.18]}>
        <coneGeometry args={[0.07, 0.24, 12]} />
        <meshStandardMaterial color={p} roughness={0.7} />
      </mesh>
      <mesh position={[0.22, 0.58, 0.04]} rotation={[0.10, 0, 0.18]}>
        <coneGeometry args={[0.07, 0.24, 12]} />
        <meshStandardMaterial color={p} roughness={0.7} />
      </mesh>
      {/* Big eye rings */}
      <mesh position={[-0.17, 0.22, 0.37]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.155, 0.05, 10, 32]} />
        <meshStandardMaterial color={s} roughness={0.45} metalness={0.15} />
      </mesh>
      <mesh position={[0.17, 0.22, 0.37]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.155, 0.05, 10, 32]} />
        <meshStandardMaterial color={s} roughness={0.45} metalness={0.15} />
      </mesh>
      {/* Pupils */}
      <mesh position={[-0.17, 0.22, 0.44]}>
        <sphereGeometry args={[0.094, 16, 16]} />
        <meshStandardMaterial color="#FFA500" emissive="#FF6600" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[-0.10, 0.24, 0.46]}>
        <sphereGeometry args={[0.022, 8, 8]} />
        <meshStandardMaterial color="#FFF" emissive="#FFF" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0.17, 0.22, 0.44]}>
        <sphereGeometry args={[0.094, 16, 16]} />
        <meshStandardMaterial color="#FFA500" emissive="#FF6600" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0.24, 0.24, 0.46]}>
        <sphereGeometry args={[0.022, 8, 8]} />
        <meshStandardMaterial color="#FFF" emissive="#FFF" emissiveIntensity={0.8} />
      </mesh>
      {/* Beak */}
      <mesh position={[0, 0.09, 0.44]} rotation={[0.40, 0, 0]}>
        <coneGeometry args={[0.055, 0.13, 12]} />
        <meshStandardMaterial color="#FFD700" roughness={0.4} />
      </mesh>
    </group>
  )
}

// ─── VALE — The Story Guardian (Knight) ───────────────────────────────────────
function ValeMesh({ p, s }: { p: string; s: string }) {
  return (
    <group position={[0, -0.30, 0]}>
      {/* Legs */}
      <mesh position={[-0.22, -1.02, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.50, 16]} />
        <meshStandardMaterial color={p} roughness={0.30} metalness={0.70} />
      </mesh>
      <mesh position={[0.22, -1.02, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.50, 16]} />
        <meshStandardMaterial color={p} roughness={0.30} metalness={0.70} />
      </mesh>
      {/* Knee guards */}
      <mesh position={[-0.22, -0.82, 0.08]}>
        <sphereGeometry args={[0.10, 14, 14]} />
        <meshStandardMaterial color={lighten(p, 0.10)} roughness={0.25} metalness={0.75} />
      </mesh>
      <mesh position={[0.22, -0.82, 0.08]}>
        <sphereGeometry args={[0.10, 14, 14]} />
        <meshStandardMaterial color={lighten(p, 0.10)} roughness={0.25} metalness={0.75} />
      </mesh>
      {/* Greaves */}
      <mesh position={[-0.22, -1.18, 0.04]}>
        <boxGeometry args={[0.22, 0.28, 0.20]} />
        <meshStandardMaterial color={p} roughness={0.28} metalness={0.72} />
      </mesh>
      <mesh position={[0.22, -1.18, 0.04]}>
        <boxGeometry args={[0.22, 0.28, 0.20]} />
        <meshStandardMaterial color={p} roughness={0.28} metalness={0.72} />
      </mesh>
      {/* Breastplate */}
      <mesh position={[0, -0.50, 0]}>
        <boxGeometry args={[0.78, 0.80, 0.52]} />
        <meshStandardMaterial color={p} roughness={0.28} metalness={0.72} />
      </mesh>
      {/* Breast ridges */}
      {([-0.22, 0, 0.22] as number[]).map((bx, i) => (
        <mesh key={i} position={[bx, -0.50, 0.27]}>
          <cylinderGeometry args={[0.04, 0.04, 0.75, 10]} />
          <meshStandardMaterial color={lighten(p, 0.12)} roughness={0.22} metalness={0.80} />
        </mesh>
      ))}
      {/* Cross on breastplate */}
      <mesh position={[0, -0.48, 0.27]}>
        <boxGeometry args={[0.07, 0.38, 0.042]} />
        <meshStandardMaterial color={s} roughness={0.25} metalness={0.82} />
      </mesh>
      <mesh position={[0, -0.48, 0.27]}>
        <boxGeometry args={[0.30, 0.07, 0.042]} />
        <meshStandardMaterial color={s} roughness={0.25} metalness={0.82} />
      </mesh>
      {/* Backplate */}
      <mesh position={[0, -0.50, -0.28]}>
        <boxGeometry args={[0.70, 0.78, 0.14]} />
        <meshStandardMaterial color={lighten(s, 0.05)} roughness={0.30} metalness={0.70} />
      </mesh>
      {/* Left pauldron */}
      <mesh position={[-0.55, -0.14, 0]}>
        <sphereGeometry args={[0.24, 20, 20]} />
        <meshStandardMaterial color={p} roughness={0.28} metalness={0.72} />
      </mesh>
      {([-0.12, 0, 0.12] as number[]).map((dy, i) => (
        <mesh key={i} position={[-0.70, -0.14 + dy, 0.01]} rotation={[0, 0, 0.70]}>
          <boxGeometry args={[0.24, 0.06, 0.18]} />
          <meshStandardMaterial color={lighten(p, 0.10)} roughness={0.25} metalness={0.75} />
        </mesh>
      ))}
      {/* Right pauldron */}
      <mesh position={[0.55, -0.14, 0]}>
        <sphereGeometry args={[0.24, 20, 20]} />
        <meshStandardMaterial color={p} roughness={0.28} metalness={0.72} />
      </mesh>
      {([-0.12, 0, 0.12] as number[]).map((dy, i) => (
        <mesh key={i + 3} position={[0.70, -0.14 + dy, 0.01]} rotation={[0, 0, -0.70]}>
          <boxGeometry args={[0.24, 0.06, 0.18]} />
          <meshStandardMaterial color={lighten(p, 0.10)} roughness={0.25} metalness={0.75} />
        </mesh>
      ))}
      {/* Left arm */}
      <mesh position={[0.52, -0.42, 0.06]} rotation={[0.15, 0, -0.45]}>
        <cylinderGeometry args={[0.10, 0.11, 0.45, 14]} />
        <meshStandardMaterial color={p} roughness={0.28} metalness={0.72} />
      </mesh>
      <mesh position={[0.74, -0.62, 0.10]}>
        <boxGeometry args={[0.18, 0.16, 0.20]} />
        <meshStandardMaterial color={p} roughness={0.24} metalness={0.78} />
      </mesh>
      {/* Sword */}
      <mesh position={[0.76, -0.82, 0.18]} rotation={[0.40, 0, -0.10]}>
        <cylinderGeometry args={[0.020, 0.022, 0.28, 10]} />
        <meshStandardMaterial color={s} roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh position={[0.78, -0.72, 0.22]} rotation={[Math.PI / 2, 0, 0.10]}>
        <boxGeometry args={[0.20, 0.04, 0.04]} />
        <meshStandardMaterial color="#FFD700" roughness={0.3} metalness={0.8} />
      </mesh>
      <mesh position={[0.80, -0.60, 0.28]} rotation={[0.40, 0, -0.10]}>
        <boxGeometry args={[0.035, 0.55, 0.025]} />
        <meshStandardMaterial color="#C8C8C8" roughness={0.15} metalness={0.95} />
      </mesh>
      {/* Right arm */}
      <mesh position={[-0.52, -0.42, 0.06]} rotation={[0.15, 0, 0.45]}>
        <cylinderGeometry args={[0.10, 0.11, 0.45, 14]} />
        <meshStandardMaterial color={p} roughness={0.28} metalness={0.72} />
      </mesh>
      <mesh position={[-0.74, -0.62, 0.10]}>
        <boxGeometry args={[0.18, 0.16, 0.20]} />
        <meshStandardMaterial color={p} roughness={0.24} metalness={0.78} />
      </mesh>
      {/* Shield */}
      <mesh position={[-0.90, -0.46, 0.20]} rotation={[0.10, 0.20, 0.05]}>
        <boxGeometry args={[0.42, 0.55, 0.06]} />
        <meshStandardMaterial color={s} roughness={0.30} metalness={0.65} />
      </mesh>
      <mesh position={[-0.90, -0.46, 0.26]} rotation={[0.10, 0.20, 0.05]}>
        <sphereGeometry args={[0.08, 14, 14]} />
        <meshStandardMaterial color="#FFD700" roughness={0.2} metalness={0.9} />
      </mesh>
      <mesh position={[-0.90, -0.42, 0.24]} rotation={[0.10, 0.20, 0.05]}>
        <boxGeometry args={[0.04, 0.26, 0.022]} />
        <meshStandardMaterial color={p} roughness={0.28} metalness={0.72} />
      </mesh>
      <mesh position={[-0.90, -0.42, 0.24]} rotation={[0.10, 0.20, 0.05]}>
        <boxGeometry args={[0.20, 0.04, 0.022]} />
        <meshStandardMaterial color={p} roughness={0.28} metalness={0.72} />
      </mesh>
      {/* Gorget */}
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.28, 0.36, 0.16, 20]} />
        <meshStandardMaterial color={p} roughness={0.26} metalness={0.75} />
      </mesh>
      {/* Helmet */}
      <mesh position={[0, 0.18, 0]}>
        <sphereGeometry args={[0.36, 28, 28]} />
        <meshStandardMaterial color={p} roughness={0.24} metalness={0.78} />
      </mesh>
      {/* Visor */}
      <mesh position={[0, 0.18, 0.28]}>
        <boxGeometry args={[0.44, 0.10, 0.09]} />
        <meshStandardMaterial color={s} roughness={0.18} metalness={0.92} />
      </mesh>
      <mesh position={[0, 0.18, 0.33]}>
        <boxGeometry args={[0.36, 0.028, 0.022]} />
        <meshStandardMaterial color="#001020" roughness={0.5} metalness={0.3} />
      </mesh>
      {/* Helm top plate */}
      <mesh position={[0, 0.50, 0.02]}>
        <boxGeometry args={[0.40, 0.10, 0.32]} />
        <meshStandardMaterial color={p} roughness={0.24} metalness={0.78} />
      </mesh>
      {/* Crest fin */}
      <mesh position={[0, 0.60, 0.01]}>
        <boxGeometry args={[0.07, 0.14, 0.28]} />
        <meshStandardMaterial color={s} roughness={0.22} metalness={0.82} />
      </mesh>
      {/* Plume */}
      {([[0, 0.72, 0.04], [0.04, 0.69, 0.10], [-0.04, 0.69, 0.10]] as [number, number, number][]).map(([px, py, pz], i) => (
        <mesh key={i} position={[px, py, pz]}>
          <capsuleGeometry args={[0.022, 0.14, 6, 8]} />
          <meshStandardMaterial color={i === 0 ? '#CC0000' : '#AA0000'} roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}

// ─── ZARA — The Dream Weaver (Cosmic) ─────────────────────────────────────────
function ZaraMesh({ p, s }: { p: string; s: string }) {
  const ring1 = useRef<THREE.Mesh>(null)
  const ring2 = useRef<THREE.Mesh>(null)
  const ring3 = useRef<THREE.Mesh>(null)
  const ring4 = useRef<THREE.Mesh>(null)
  const ring5 = useRef<THREE.Mesh>(null)
  const starsRef = useRef<THREE.Group>(null)
  const planetsRef = useRef<THREE.Group>(null)

  useFrame((_, d) => {
    if (ring1.current) ring1.current.rotation.z += d * 0.60
    if (ring2.current) ring2.current.rotation.x += d * 0.40
    if (ring3.current) ring3.current.rotation.y += d * -0.50
    if (ring4.current) ring4.current.rotation.z += d * -0.35
    if (ring5.current) ring5.current.rotation.x += d * 0.55
    if (starsRef.current) starsRef.current.rotation.y += d * 0.25
    if (planetsRef.current) planetsRef.current.rotation.y += d * -0.18
  })

  const starPos = useMemo<Array<[number, number, number]>>(() => [
    [0.75, 0.30, 0], [-0.70, 0.10, 0.30], [0.60, -0.40, -0.30],
    [-0.50, -0.20, 0.60], [0.30, 0.70, -0.50], [-0.40, 0.60, 0.40],
    [0.80, -0.10, -0.30], [-0.65, -0.50, 0.10], [0.55, 0.50, 0.50],
    [-0.80, 0.30, -0.20], [0.40, -0.60, 0.50], [-0.30, -0.65, -0.40],
  ], [])

  const planetPos = useMemo<Array<[number, number, number, string, number]>>(() => [
    [0.92, 0, 0, '#FF6B6B', 0.06],
    [-0.88, 0.15, 0.30, '#6BC5FF', 0.05],
    [0.50, 0, -0.78, '#FFD700', 0.04],
  ], [])

  return (
    <group position={[0, -0.20, 0]}>
      {/* Body */}
      <mesh position={[0, -0.56, 0]}>
        <sphereGeometry args={[0.46, 32, 32]} />
        <meshStandardMaterial color={p} emissive={p} emissiveIntensity={0.22} roughness={0.38} metalness={0.22} />
      </mesh>
      {/* Body aura */}
      <mesh position={[0, -0.56, 0]}>
        <sphereGeometry args={[0.50, 24, 24]} />
        <meshStandardMaterial color={p} emissive={p} emissiveIntensity={0.08} roughness={1} transparent opacity={0.15} />
      </mesh>
      {/* Nebula wisps */}
      {([[0.40, -0.44, 0.25], [-0.45, -0.56, 0.18], [0.10, -0.38, -0.38], [-0.28, -0.68, -0.30]] as [number, number, number][]).map(([wx, wy, wz], i) => (
        <mesh key={i} position={[wx, wy, wz]} rotation={[i * 0.8, i * 0.5, i * 1.2]}>
          <capsuleGeometry args={[0.040, 0.28, 6, 10]} />
          <meshStandardMaterial color={s} emissive={s} emissiveIntensity={0.30} transparent opacity={0.55} roughness={0.5} />
        </mesh>
      ))}
      {/* Arms */}
      <mesh position={[-0.50, -0.44, 0.08]} rotation={[0.15, 0, 0.40]}>
        <capsuleGeometry args={[0.08, 0.30, 8, 12]} />
        <meshStandardMaterial color={p} emissive={p} emissiveIntensity={0.15} roughness={0.4} metalness={0.2} />
      </mesh>
      <mesh position={[-0.68, -0.30, 0.12]}>
        <sphereGeometry args={[0.10, 14, 14]} />
        <meshStandardMaterial color={p} emissive={p} emissiveIntensity={0.20} roughness={0.4} />
      </mesh>
      <mesh position={[0.50, -0.44, 0.08]} rotation={[0.15, 0, -0.40]}>
        <capsuleGeometry args={[0.08, 0.30, 8, 12]} />
        <meshStandardMaterial color={p} emissive={p} emissiveIntensity={0.15} roughness={0.4} metalness={0.2} />
      </mesh>
      <mesh position={[0.68, -0.30, 0.12]}>
        <sphereGeometry args={[0.10, 14, 14]} />
        <meshStandardMaterial color={p} emissive={p} emissiveIntensity={0.20} roughness={0.4} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.14, 0]}>
        <sphereGeometry args={[0.38, 32, 32]} />
        <meshStandardMaterial color={p} emissive={p} emissiveIntensity={0.16} roughness={0.38} metalness={0.22} />
      </mesh>
      {/* Eyes */}
      <mesh position={[-0.14, 0.18, 0.34]}>
        <sphereGeometry args={[0.062, 16, 16]} />
        <meshStandardMaterial color="#FFFFFF" emissive={s} emissiveIntensity={1.0} />
      </mesh>
      <mesh position={[0.14, 0.18, 0.34]}>
        <sphereGeometry args={[0.062, 16, 16]} />
        <meshStandardMaterial color="#FFFFFF" emissive={s} emissiveIntensity={1.0} />
      </mesh>
      {/* Cosmic crown — 5 spires */}
      {Array.from({ length: 5 }, (_, i) => {
        const a = (i / 5) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.sin(a) * 0.26, 0.55, Math.cos(a) * 0.26]} rotation={[-Math.cos(a) * 0.30, 0, Math.sin(a) * 0.30]}>
            <coneGeometry args={[0.030, 0.22, 8]} />
            <meshStandardMaterial color={s} emissive={s} emissiveIntensity={0.8} />
          </mesh>
        )
      })}
      {/* Flowing cosmic hair */}
      {([[-0.28, 0.52, 0.10], [-0.14, 0.60, -0.12], [0, 0.60, -0.14], [0.14, 0.60, -0.12], [0.28, 0.52, 0.10]] as [number, number, number][]).map(([hx, hy, hz], i) => (
        <mesh key={i} position={[hx, hy, hz]} rotation={[0.20 * (i - 2) * 0.30, 0, (i - 2) * 0.24]}>
          <capsuleGeometry args={[0.040, 0.22, 8, 12]} />
          <meshStandardMaterial color={s} emissive={s} emissiveIntensity={0.35} />
        </mesh>
      ))}
      {/* 5 Orbit rings */}
      <mesh ref={ring1} position={[0, -0.22, 0]} rotation={[1.2, 0, 0.3]}>
        <torusGeometry args={[0.74, 0.030, 12, 64]} />
        <meshStandardMaterial color={s} emissive={s} emissiveIntensity={0.55} roughness={0.3} metalness={0.4} />
      </mesh>
      <mesh ref={ring2} position={[0, -0.22, 0]} rotation={[0.5, 1.0, 0]}>
        <torusGeometry args={[0.80, 0.024, 12, 64]} />
        <meshStandardMaterial color={p} emissive={p} emissiveIntensity={0.45} roughness={0.3} metalness={0.4} />
      </mesh>
      <mesh ref={ring3} position={[0, -0.22, 0]} rotation={[0.2, 0.4, 0.8]}>
        <torusGeometry args={[0.70, 0.020, 12, 64]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.65} roughness={0.1} />
      </mesh>
      <mesh ref={ring4} position={[0, -0.22, 0]} rotation={[0.9, 0.6, -0.4]}>
        <torusGeometry args={[0.86, 0.016, 10, 56]} />
        <meshStandardMaterial color={s} emissive={s} emissiveIntensity={0.40} roughness={0.3} transparent opacity={0.75} />
      </mesh>
      <mesh ref={ring5} position={[0, -0.22, 0]} rotation={[-0.3, 1.2, 0.6]}>
        <torusGeometry args={[0.78, 0.014, 10, 56]} />
        <meshStandardMaterial color={p} emissive={p} emissiveIntensity={0.35} roughness={0.3} transparent opacity={0.70} />
      </mesh>
      {/* Orbiting stars */}
      <group ref={starsRef} position={[0, -0.22, 0]}>
        {starPos.map(([sx, sy, sz], i) => (
          <mesh key={i} position={[sx, sy, sz]}>
            <sphereGeometry args={[0.020 + (i % 3) * 0.010, 8, 8]} />
            <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={1.2} />
          </mesh>
        ))}
      </group>
      {/* Orbiting planets */}
      <group ref={planetsRef} position={[0, -0.22, 0]}>
        {planetPos.map(([px, py, pz, pc, pr], i) => (
          <mesh key={i} position={[px, py, pz]}>
            <sphereGeometry args={[pr, 12, 12]} />
            <meshStandardMaterial color={pc} emissive={pc} emissiveIntensity={0.5} roughness={0.4} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

// ─── Character scene ──────────────────────────────────────────────────────────
function CharacterScene({
  character, primaryColor, secondaryColor, locked
}: {
  character: CharacterId
  primaryColor: string
  secondaryColor: string
  locked?: boolean
}) {
  const p = locked ? '#555555' : primaryColor
  const s = locked ? '#333333' : secondaryColor

  const CharMesh = {
    lion:   <LeoMesh p={p} s={s} />,
    mage:   <SageMesh p={p} s={s} />,
    fox:    <VexMesh p={p} s={s} />,
    owl:    <OrionMesh p={p} s={s} />,
    knight: <ValeMesh p={p} s={s} />,
    cosmic: <ZaraMesh p={p} s={s} />,
  }[character]

  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight position={[4, 5, 4]} intensity={1.3} castShadow />
      <directionalLight position={[-3, 2, -2]} intensity={0.45} color="#a0c0ff" />
      <hemisphereLight args={['#ffffff', '#444444', 0.5]} />
      <pointLight position={[0, 3, 3]} intensity={0.6} color="#ffffff" />
      <AutoRotate>{CharMesh}</AutoRotate>
    </>
  )
}

// ─── Public component ─────────────────────────────────────────────────────────
interface Character3DProps {
  character: CharacterId
  primaryColor: string
  secondaryColor: string
  size?: number
  locked?: boolean
}

export default function Character3D({
  character, primaryColor, secondaryColor, size = 180, locked = false
}: Character3DProps) {
  return (
    <div style={{ width: size, height: size, flexShrink: 0 }}>
      <Canvas
        gl={{ alpha: true, antialias: true }}
        camera={{ position: [0, 0.1, 2.9], fov: 45 }}
        style={{ width: '100%', height: '100%' }}
      >
        <Suspense fallback={null}>
          <CharacterScene
            character={character}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            locked={locked}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}
