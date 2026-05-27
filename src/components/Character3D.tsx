import React, { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { CharacterId } from './AvatarCharacter'

// ─── Rotating wrapper ─────────────────────────────────────────────────────────
function AutoRotate({ children, speed = 0.35 }: { children: React.ReactNode; speed?: number }) {
  const ref = useRef<THREE.Group>(null)
  useFrame((_, delta) => { if (ref.current) ref.current.rotation.y += delta * speed })
  return <group ref={ref}>{children}</group>
}

// ─── Leo — The Bold Reader (Lion) ────────────────────────────────────────────
function LeoMesh({ p, s }: { p: string; s: string }) {
  return (
    <group position={[0, -0.15, 0]}>
      {/* Body */}
      <mesh position={[0, -0.62, 0]}>
        <sphereGeometry args={[0.52, 32, 32]} />
        <meshStandardMaterial color={p} roughness={0.55} metalness={0.08} />
      </mesh>
      {/* Mane — the key lion identifier */}
      <mesh position={[0, 0.12, -0.06]} rotation={[0.12, 0, 0]}>
        <torusGeometry args={[0.50, 0.21, 14, 48]} />
        <meshStandardMaterial color={s} roughness={0.75} metalness={0} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.12, 0]}>
        <sphereGeometry args={[0.40, 32, 32]} />
        <meshStandardMaterial color={p} roughness={0.5} metalness={0.08} />
      </mesh>
      {/* Ears */}
      <mesh position={[-0.28, 0.52, 0.08]} rotation={[0, 0, -0.32]}>
        <coneGeometry args={[0.1, 0.22, 16]} />
        <meshStandardMaterial color={p} roughness={0.6} />
      </mesh>
      <mesh position={[0.28, 0.52, 0.08]} rotation={[0, 0, 0.32]}>
        <coneGeometry args={[0.1, 0.22, 16]} />
        <meshStandardMaterial color={p} roughness={0.6} />
      </mesh>
      {/* Eyes */}
      <mesh position={[-0.14, 0.18, 0.36]}>
        <sphereGeometry args={[0.058, 16, 16]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.1} metalness={0.3} />
      </mesh>
      <mesh position={[0.14, 0.18, 0.36]}>
        <sphereGeometry args={[0.058, 16, 16]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.1} metalness={0.3} />
      </mesh>
      {/* Nose */}
      <mesh position={[0, 0.04, 0.41]}>
        <sphereGeometry args={[0.038, 12, 12]} />
        <meshStandardMaterial color={s} roughness={0.4} />
      </mesh>
    </group>
  )
}

// ─── Sage — The Wise Scholar (Mage) ──────────────────────────────────────────
function SageMesh({ p, s }: { p: string; s: string }) {
  return (
    <group position={[0, -0.35, 0]}>
      {/* Robe body */}
      <mesh position={[0, -0.55, 0]}>
        <cylinderGeometry args={[0.48, 0.38, 1.0, 32]} />
        <meshStandardMaterial color={p} roughness={0.7} metalness={0} />
      </mesh>
      {/* Collar/shoulders */}
      <mesh position={[0, -0.06, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.12, 32]} />
        <meshStandardMaterial color={s} roughness={0.7} metalness={0.1} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.28, 0]}>
        <sphereGeometry args={[0.34, 32, 32]} />
        <meshStandardMaterial color={p} roughness={0.5} metalness={0.05} />
      </mesh>
      {/* Hat brim */}
      <mesh position={[0, 0.56, 0]}>
        <cylinderGeometry args={[0.48, 0.48, 0.06, 32]} />
        <meshStandardMaterial color={s} roughness={0.6} metalness={0.1} />
      </mesh>
      {/* Hat cone — the key mage identifier */}
      <mesh position={[0, 0.56, 0]}>
        <coneGeometry args={[0.32, 0.82, 32]} />
        <meshStandardMaterial color={s} roughness={0.6} metalness={0.1} />
      </mesh>
      {/* Star on hat */}
      <mesh position={[0, 0.92, 0.16]}>
        <sphereGeometry args={[0.045, 8, 8]} />
        <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.8} />
      </mesh>
      {/* Eyes */}
      <mesh position={[-0.12, 0.3, 0.30]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.1} metalness={0.4} />
      </mesh>
      <mesh position={[0.12, 0.3, 0.30]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.1} metalness={0.4} />
      </mesh>
    </group>
  )
}

// ─── Vex — The Cunning Explorer (Fox) ────────────────────────────────────────
function VexMesh({ p, s }: { p: string; s: string }) {
  return (
    <group position={[0, -0.2, 0]}>
      {/* Body */}
      <mesh position={[0, -0.62, 0]}>
        <sphereGeometry args={[0.50, 32, 32]} />
        <meshStandardMaterial color={p} roughness={0.55} metalness={0.05} />
      </mesh>
      {/* White belly */}
      <mesh position={[0, -0.65, 0.28]}>
        <sphereGeometry args={[0.34, 24, 24]} />
        <meshStandardMaterial color={s === '#7C2D12' ? '#FFF8F0' : s} roughness={0.7} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.1, 0]}>
        <sphereGeometry args={[0.38, 32, 32]} />
        <meshStandardMaterial color={p} roughness={0.5} metalness={0.05} />
      </mesh>
      {/* Snout — elongated */}
      <mesh position={[0, -0.02, 0.36]}>
        <sphereGeometry args={[0.16, 20, 20]} />
        <meshStandardMaterial color={s === '#7C2D12' ? '#FFF0E0' : p} roughness={0.6} />
      </mesh>
      {/* Tall pointed ears — key fox identifier */}
      <mesh position={[-0.26, 0.55, 0.04]} rotation={[0, 0, -0.22]}>
        <coneGeometry args={[0.09, 0.40, 16]} />
        <meshStandardMaterial color={p} roughness={0.6} />
      </mesh>
      <mesh position={[0.26, 0.55, 0.04]} rotation={[0, 0, 0.22]}>
        <coneGeometry args={[0.09, 0.40, 16]} />
        <meshStandardMaterial color={p} roughness={0.6} />
      </mesh>
      {/* Inner ear tips */}
      <mesh position={[-0.26, 0.62, 0.06]} rotation={[0, 0, -0.22]}>
        <coneGeometry args={[0.04, 0.18, 12]} />
        <meshStandardMaterial color={s} roughness={0.5} />
      </mesh>
      <mesh position={[0.26, 0.62, 0.06]} rotation={[0, 0, 0.22]}>
        <coneGeometry args={[0.04, 0.18, 12]} />
        <meshStandardMaterial color={s} roughness={0.5} />
      </mesh>
      {/* Eyes */}
      <mesh position={[-0.14, 0.14, 0.34]}>
        <sphereGeometry args={[0.055, 16, 16]} />
        <meshStandardMaterial color="#1a0800" roughness={0.1} metalness={0.3} />
      </mesh>
      <mesh position={[0.14, 0.14, 0.34]}>
        <sphereGeometry args={[0.055, 16, 16]} />
        <meshStandardMaterial color="#1a0800" roughness={0.1} metalness={0.3} />
      </mesh>
      {/* Nose */}
      <mesh position={[0, 0.02, 0.42]}>
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshStandardMaterial color="#1a0800" roughness={0.3} />
      </mesh>
    </group>
  )
}

// ─── Orion — The Night Thinker (Owl) ─────────────────────────────────────────
function OrionMesh({ p, s }: { p: string; s: string }) {
  return (
    <group position={[0, -0.25, 0]}>
      {/* Body */}
      <mesh position={[0, -0.60, 0]} scale={[1, 1.1, 0.9]}>
        <sphereGeometry args={[0.52, 32, 32]} />
        <meshStandardMaterial color={p} roughness={0.65} metalness={0.05} />
      </mesh>
      {/* Wing left */}
      <mesh position={[-0.72, -0.45, -0.1]} rotation={[0.1, 0.3, 0.15]}>
        <boxGeometry args={[0.32, 0.60, 0.07]} />
        <meshStandardMaterial color={s} roughness={0.8} />
      </mesh>
      {/* Wing right */}
      <mesh position={[0.72, -0.45, -0.1]} rotation={[0.1, -0.3, -0.15]}>
        <boxGeometry args={[0.32, 0.60, 0.07]} />
        <meshStandardMaterial color={s} roughness={0.8} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.18, 0]}>
        <sphereGeometry args={[0.42, 32, 32]} />
        <meshStandardMaterial color={p} roughness={0.6} metalness={0.05} />
      </mesh>
      {/* Ear tufts */}
      <mesh position={[-0.22, 0.60, 0.04]} rotation={[0.1, 0, -0.18]}>
        <coneGeometry args={[0.07, 0.22, 12]} />
        <meshStandardMaterial color={p} roughness={0.7} />
      </mesh>
      <mesh position={[0.22, 0.60, 0.04]} rotation={[0.1, 0, 0.18]}>
        <coneGeometry args={[0.07, 0.22, 12]} />
        <meshStandardMaterial color={p} roughness={0.7} />
      </mesh>
      {/* Large eye rings — key owl identifier */}
      <mesh position={[-0.16, 0.22, 0.36]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.16, 0.05, 12, 32]} />
        <meshStandardMaterial color={s} roughness={0.5} metalness={0.1} />
      </mesh>
      <mesh position={[0.16, 0.22, 0.36]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.16, 0.05, 12, 32]} />
        <meshStandardMaterial color={s} roughness={0.5} metalness={0.1} />
      </mesh>
      {/* Pupils */}
      <mesh position={[-0.16, 0.22, 0.42]}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshStandardMaterial color="#FFA500" emissive="#FF6600" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0.16, 0.22, 0.42]}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshStandardMaterial color="#FFA500" emissive="#FF6600" emissiveIntensity={0.4} />
      </mesh>
      {/* Beak */}
      <mesh position={[0, 0.09, 0.43]} rotation={[0.4, 0, 0]}>
        <coneGeometry args={[0.06, 0.14, 12]} />
        <meshStandardMaterial color="#FFD700" roughness={0.4} />
      </mesh>
    </group>
  )
}

// ─── Vale — The Story Guardian (Knight) ──────────────────────────────────────
function ValeMesh({ p, s }: { p: string; s: string }) {
  return (
    <group position={[0, -0.3, 0]}>
      {/* Breastplate */}
      <mesh position={[0, -0.52, 0]}>
        <boxGeometry args={[0.78, 0.85, 0.52]} />
        <meshStandardMaterial color={p} roughness={0.3} metalness={0.7} />
      </mesh>
      {/* Cross on breastplate */}
      <mesh position={[0, -0.5, 0.27]}>
        <boxGeometry args={[0.08, 0.38, 0.04]} />
        <meshStandardMaterial color={s} roughness={0.3} metalness={0.8} />
      </mesh>
      <mesh position={[0, -0.5, 0.27]}>
        <boxGeometry args={[0.32, 0.08, 0.04]} />
        <meshStandardMaterial color={s} roughness={0.3} metalness={0.8} />
      </mesh>
      {/* Left pauldron */}
      <mesh position={[-0.56, -0.15, 0]} scale={[1, 0.7, 1]}>
        <sphereGeometry args={[0.22, 20, 20]} />
        <meshStandardMaterial color={p} roughness={0.3} metalness={0.7} />
      </mesh>
      {/* Right pauldron */}
      <mesh position={[0.56, -0.15, 0]} scale={[1, 0.7, 1]}>
        <sphereGeometry args={[0.22, 20, 20]} />
        <meshStandardMaterial color={p} roughness={0.3} metalness={0.7} />
      </mesh>
      {/* Head/neck guard */}
      <mesh position={[0, 0.16, 0]}>
        <sphereGeometry args={[0.36, 32, 32]} />
        <meshStandardMaterial color={p} roughness={0.25} metalness={0.75} />
      </mesh>
      {/* Helmet visor — key knight identifier (dark strip) */}
      <mesh position={[0, 0.16, 0.28]}>
        <boxGeometry args={[0.44, 0.11, 0.10]} />
        <meshStandardMaterial color={s} roughness={0.2} metalness={0.9} />
      </mesh>
      {/* Helmet crest/top */}
      <mesh position={[0, 0.50, 0.02]}>
        <boxGeometry args={[0.40, 0.12, 0.34]} />
        <meshStandardMaterial color={p} roughness={0.25} metalness={0.75} />
      </mesh>
      {/* Crest fin */}
      <mesh position={[0, 0.60, 0.02]}>
        <boxGeometry args={[0.08, 0.14, 0.30]} />
        <meshStandardMaterial color={s} roughness={0.2} metalness={0.8} />
      </mesh>
    </group>
  )
}

// ─── Zara — The Dream Weaver (Cosmic) ─────────────────────────────────────────
function ZaraMesh({ p, s }: { p: string; s: string }) {
  const ring1 = useRef<THREE.Mesh>(null)
  const ring2 = useRef<THREE.Mesh>(null)
  const ring3 = useRef<THREE.Mesh>(null)
  const starsRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (ring1.current) ring1.current.rotation.z += delta * 0.6
    if (ring2.current) ring2.current.rotation.x += delta * 0.4
    if (ring3.current) ring3.current.rotation.y += delta * -0.5
    if (starsRef.current) starsRef.current.rotation.y += delta * 0.3
  })

  const starPositions: [number, number, number][] = [
    [0.75, 0.3, 0], [-0.7, 0.1, 0.3], [0.6, -0.4, -0.3],
    [-0.5, -0.2, 0.6], [0.3, 0.7, -0.5], [-0.4, 0.6, 0.4],
    [0.8, -0.1, -0.3], [-0.65, -0.5, 0.1],
  ]

  return (
    <group position={[0, -0.2, 0]}>
      {/* Body */}
      <mesh position={[0, -0.58, 0]}>
        <sphereGeometry args={[0.46, 32, 32]} />
        <meshStandardMaterial color={p} emissive={p} emissiveIntensity={0.2} roughness={0.4} metalness={0.2} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.14, 0]}>
        <sphereGeometry args={[0.38, 32, 32]} />
        <meshStandardMaterial color={p} emissive={p} emissiveIntensity={0.15} roughness={0.4} metalness={0.2} />
      </mesh>
      {/* Eyes — glowing */}
      <mesh position={[-0.14, 0.18, 0.34]}>
        <sphereGeometry args={[0.062, 16, 16]} />
        <meshStandardMaterial color="#FFFFFF" emissive={s} emissiveIntensity={1.0} />
      </mesh>
      <mesh position={[0.14, 0.18, 0.34]}>
        <sphereGeometry args={[0.062, 16, 16]} />
        <meshStandardMaterial color="#FFFFFF" emissive={s} emissiveIntensity={1.0} />
      </mesh>
      {/* Flowing hair strands */}
      {[[-0.28, 0.52, 0.1], [0, 0.60, -0.1], [0.28, 0.52, 0.1]].map(([x, y, z], i) => (
        <mesh key={i} position={[x as number, y as number, z as number]} rotation={[0.2 * (i - 1), 0, (i - 1) * 0.3]}>
          <capsuleGeometry args={[0.04, 0.22, 8, 12]} />
          <meshStandardMaterial color={s} emissive={s} emissiveIntensity={0.3} />
        </mesh>
      ))}
      {/* Orbit rings — key cosmic identifier */}
      <mesh ref={ring1} position={[0, -0.22, 0]} rotation={[1.2, 0, 0.3]}>
        <torusGeometry args={[0.72, 0.030, 12, 64]} />
        <meshStandardMaterial color={s} emissive={s} emissiveIntensity={0.5} roughness={0.3} metalness={0.4} />
      </mesh>
      <mesh ref={ring2} position={[0, -0.22, 0]} rotation={[0.5, 1.0, 0]}>
        <torusGeometry args={[0.78, 0.024, 12, 64]} />
        <meshStandardMaterial color={p} emissive={p} emissiveIntensity={0.4} roughness={0.3} metalness={0.4} />
      </mesh>
      <mesh ref={ring3} position={[0, -0.22, 0]} rotation={[0.2, 0.4, 0.8]}>
        <torusGeometry args={[0.68, 0.020, 12, 64]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.6} roughness={0.1} />
      </mesh>
      {/* Orbiting stars */}
      <group ref={starsRef} position={[0, -0.22, 0]}>
        {starPositions.map(([x, y, z], i) => (
          <mesh key={i} position={[x, y, z]}>
            <sphereGeometry args={[0.025 + (i % 3) * 0.01, 8, 8]} />
            <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={1.2} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

// ─── Character scene ─────────────────────────────────────────────────────────
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
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 5, 4]} intensity={1.2} castShadow />
      <directionalLight position={[-3, 2, -2]} intensity={0.4} color="#a0c0ff" />
      <hemisphereLight args={['#ffffff', '#444444', 0.5]} />
      <pointLight position={[0, 3, 3]} intensity={0.5} color="#ffffff" />
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
