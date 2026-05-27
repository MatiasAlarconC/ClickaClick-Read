import React, { useRef, useEffect, Suspense, useState, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import * as THREE from 'three'
import type { Theme } from '../types'

// ─── Floating particle cloud ──────────────────────────────────────────────────
function Particles({ count = 60 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null)
  const { positions, speeds } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const speeds = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const r = 1.4 + Math.random() * 1.2
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)
      speeds[i] = 0.3 + Math.random() * 0.7
    }
    return { positions, speeds }
  }, [count])

  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.getElapsedTime()
    ref.current.rotation.y = t * 0.08
    ref.current.rotation.x = Math.sin(t * 0.05) * 0.2
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.035} color="#a855f7" transparent opacity={0.75} sizeAttenuation depthWrite={false} />
    </points>
  )
}

// ─── Pulse ring at base ───────────────────────────────────────────────────────
function GlowRing() {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.getElapsedTime()
    const mat = ref.current.material as THREE.MeshBasicMaterial
    mat.opacity = 0.08 + Math.abs(Math.sin(t * 0.8)) * 0.12
    ref.current.scale.x = 1 + Math.sin(t * 0.6) * 0.06
    ref.current.scale.z = 1 + Math.sin(t * 0.6) * 0.06
  })
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.1, 0]}>
      <ringGeometry args={[0.6, 1.35, 64]} />
      <meshBasicMaterial color="#a855f7" transparent opacity={0.15} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  )
}

// ─── Shadow floor ─────────────────────────────────────────────────────────────
function ShadowPlane() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.15, 0]} receiveShadow>
      <planeGeometry args={[6, 6]} />
      <shadowMaterial transparent opacity={0.25} />
    </mesh>
  )
}

// ─── Book mesh with entry spring ──────────────────────────────────────────────
function BookMesh({ coverUrl, theme }: { coverUrl: string | null; theme: Theme }) {
  const groupRef = useRef<THREE.Group>(null)
  const [texture, setTexture] = useState<THREE.Texture | null>(null)

  // Spring entry
  const scaleRef = useRef(0)
  const velRef = useRef(0)

  useEffect(() => {
    if (!coverUrl) { setTexture(null); return }
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')
    loader.load(coverUrl, (tex) => { tex.colorSpace = THREE.SRGBColorSpace; setTexture(tex) }, undefined, () => setTexture(null))
  }, [coverUrl])

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return

    // Spring toward scale 1
    const stiffness = 10, damping = 0.65
    velRef.current += (1 - scaleRef.current) * stiffness * delta
    velRef.current *= damping
    scaleRef.current = Math.min(1.02, scaleRef.current + velRef.current * delta * 60)
    groupRef.current.scale.setScalar(scaleRef.current)

    // Complex float: multi-frequency
    const t = clock.getElapsedTime()
    groupRef.current.rotation.y = t * 0.35 + Math.sin(t * 0.28) * 0.22
    groupRef.current.rotation.x = Math.sin(t * 0.41) * 0.06
    groupRef.current.rotation.z = Math.sin(t * 0.53) * 0.03
    groupRef.current.position.y = Math.sin(t * 0.7) * 0.1 + Math.sin(t * 1.3) * 0.03
  })

  const materials = useMemo(() => {
    const coverMat = texture
      ? new THREE.MeshStandardMaterial({ map: texture, roughness: 0.4, metalness: 0.05 })
      : new THREE.MeshStandardMaterial({ color: '#2a1a3e', roughness: 0.6 })
    const spineMat = new THREE.MeshStandardMaterial({ color: '#1a1020', roughness: 0.7 })
    const pageMat  = new THREE.MeshStandardMaterial({ color: '#F0EBE0', roughness: 0.8 })
    const backMat  = new THREE.MeshStandardMaterial({ color: '#1a1020', roughness: 0.7 })
    return [spineMat, spineMat, pageMat, pageMat, coverMat, backMat]
  }, [texture])

  const geo = useMemo(() => new THREE.BoxGeometry(1.3, 1.9, 0.18, 1, 1, 1), [])

  return (
    <group ref={groupRef}>
      <mesh geometry={geo} material={materials} castShadow />
    </group>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function Book3D({ coverUrl, theme }: { coverUrl: string | null; theme: Theme }) {
  return (
    <div style={{ width: '100%', height: 300, borderRadius: 20, overflow: 'hidden' }}>
      <Canvas
        camera={{ position: [0, 0.2, 3.8], fov: 38 }}
        style={{ background: 'transparent' }}
        gl={{ alpha: true, antialias: true }}
        shadows
      >
        {/* Lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[4, 6, 5]} intensity={1.4} castShadow shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[-3, 2, 3]} intensity={0.5} color="#c084fc" />
        <pointLight position={[0, 3, 1]} intensity={0.6} color="#e9d5ff" />
        <hemisphereLight args={['#c084fc', '#0a0a0a', 0.3]} />

        <Suspense fallback={null}>
          <BookMesh coverUrl={coverUrl} theme={theme} />
          <Particles />
          <GlowRing />
          <ShadowPlane />
        </Suspense>

        <OrbitControls
          enablePan={false}
          enableZoom={false}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 1.6}
          rotateSpeed={0.5}
        />
      </Canvas>
    </div>
  )
}
