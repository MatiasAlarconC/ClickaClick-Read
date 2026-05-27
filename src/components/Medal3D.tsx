import React, { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TIER_COLORS, TIER_EMISSIVE, type AchievementTier } from '../data/achievements'

function MedalMesh({ tier, locked }: { tier: AchievementTier; locked: boolean }) {
  const groupRef = useRef<THREE.Group>(null)
  const glintRef = useRef<THREE.PointLight>(null)

  const col = locked ? '#444444' : TIER_COLORS[tier]
  const emi = locked ? '#222222' : TIER_EMISSIVE[tier]

  useFrame((state) => {
    if (groupRef.current) groupRef.current.rotation.y += 0.012
    // Glint light orbits
    if (glintRef.current) {
      const t = state.clock.elapsedTime
      glintRef.current.position.set(Math.sin(t * 1.2) * 1.5, 1.2, Math.cos(t * 1.2) * 1.5)
    }
  })

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 3]} intensity={1.5} />
      <pointLight ref={glintRef} intensity={locked ? 0 : 2.5} color={col} />
      <hemisphereLight args={['#ffffff', '#333333', 0.4]} />

      <group ref={groupRef}>
        {/* Ribbon loop */}
        <mesh position={[0, 0.90, 0]}>
          <torusGeometry args={[0.18, 0.055, 12, 32]} />
          <meshStandardMaterial color={locked ? '#333' : '#B0B0B0'} metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Ribbon strip */}
        <mesh position={[0, 0.56, 0]}>
          <boxGeometry args={[0.14, 0.40, 0.05]} />
          <meshStandardMaterial color={locked ? '#333' : (tier === 'gold' ? '#CC3300' : tier === 'silver' ? '#0033AA' : tier === 'platinum' ? '#5500AA' : '#006600')} roughness={0.6} />
        </mesh>
        {/* Medal body */}
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.72, 0.72, 0.17, 64]} />
          <meshStandardMaterial color={col} emissive={emi} emissiveIntensity={locked ? 0 : 0.25} metalness={0.85} roughness={0.15} />
        </mesh>
        {/* Inner circle */}
        <mesh position={[0, 0.092, 0]}>
          <cylinderGeometry args={[0.52, 0.52, 0.01, 64]} />
          <meshStandardMaterial color={col} emissive={emi} emissiveIntensity={locked ? 0 : 0.4} metalness={0.9} roughness={0.1} />
        </mesh>
        {/* Star points (5 spokes to fake a star) */}
        {[0, 1, 2, 3, 4].map(i => (
          <mesh key={i} position={[
            Math.sin((i / 5) * Math.PI * 2) * 0.28,
            0.10,
            Math.cos((i / 5) * Math.PI * 2) * 0.28,
          ]}>
            <boxGeometry args={[0.10, 0.025, 0.10]} />
            <meshStandardMaterial color={col} emissive={emi} emissiveIntensity={locked ? 0 : 0.5} metalness={0.9} roughness={0.1} />
          </mesh>
        ))}
        {/* Center gem */}
        <mesh position={[0, 0.11, 0]}>
          <sphereGeometry args={[0.14, 24, 24]} />
          <meshStandardMaterial color={col} emissive={emi} emissiveIntensity={locked ? 0 : 0.8} metalness={0.7} roughness={0.05} />
        </mesh>
        {/* Rim */}
        <mesh position={[0, 0, 0]}>
          <torusGeometry args={[0.72, 0.035, 12, 64]} />
          <meshStandardMaterial color={col} metalness={0.9} roughness={0.1} />
        </mesh>
      </group>
    </>
  )
}

interface Medal3DProps {
  tier: AchievementTier
  locked?: boolean
  size?: number
}

export default function Medal3D({ tier, locked = false, size = 110 }: Medal3DProps) {
  return (
    <div style={{ width: size, height: size, flexShrink: 0 }}>
      <Canvas
        gl={{ alpha: true, antialias: true }}
        camera={{ position: [0, 0.5, 2.6], fov: 40 }}
        style={{ width: '100%', height: '100%' }}
      >
        <Suspense fallback={null}>
          <MedalMesh tier={tier} locked={locked} />
        </Suspense>
      </Canvas>
    </div>
  )
}
