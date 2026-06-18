import React, { useRef, useEffect, Suspense, useState, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Theme } from '../types'

// Subtle floating dust motes — white, low opacity
function Particles({ count = 28 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null)
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r = 1.7 + Math.random() * 0.9
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      arr[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      arr[i * 3 + 2] = r * Math.cos(phi)
    }
    return arr
  }, [count])

  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.rotation.y = clock.getElapsedTime() * 0.04
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.018} color="#ffffff" transparent opacity={0.25} sizeAttenuation depthWrite={false} />
    </points>
  )
}

// Neutral ground halo
function GroundHalo() {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const mat = ref.current.material as THREE.MeshBasicMaterial
    mat.opacity = 0.04 + Math.abs(Math.sin(clock.getElapsedTime() * 0.5)) * 0.05
  })
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.12, 0]}>
      <ringGeometry args={[0.5, 1.2, 64]} />
      <meshBasicMaterial color="#cccccc" transparent opacity={0.06} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  )
}

function ShadowPlane() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.16, 0]} receiveShadow>
      <planeGeometry args={[8, 8]} />
      <shadowMaterial transparent opacity={0.38} />
    </mesh>
  )
}

function BookMesh({ coverUrl }: { coverUrl: string | null }) {
  const groupRef = useRef<THREE.Group>(null)
  const [texture, setTexture] = useState<THREE.Texture | null>(null)

  const scaleRef = useRef(0)
  const velRef = useRef(0)

  useEffect(() => {
    if (!coverUrl) { setTexture(null); return }
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')
    loader.load(
      coverUrl,
      (tex) => { tex.colorSpace = THREE.SRGBColorSpace; setTexture(tex) },
      undefined,
      () => setTexture(null),
    )
  }, [coverUrl])

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return

    // Smooth spring entry
    const stiffness = 7, damping = 0.72
    velRef.current += (1 - scaleRef.current) * stiffness * delta
    velRef.current *= damping
    scaleRef.current = Math.min(1.01, scaleRef.current + velRef.current * delta * 60)
    groupRef.current.scale.setScalar(scaleRef.current)

    // Slow, graceful showcase rotation
    const t = clock.getElapsedTime()
    groupRef.current.rotation.y = t * 0.2 + Math.sin(t * 0.15) * 0.18
    groupRef.current.rotation.x = Math.sin(t * 0.28) * 0.035
    groupRef.current.rotation.z = Math.sin(t * 0.38) * 0.018
    groupRef.current.position.y = Math.sin(t * 0.45) * 0.09 + Math.sin(t * 1.05) * 0.02
  })

  // BoxGeometry face order: +x (right), -x (left), +y (top), -y (bottom), +z (front), -z (back)
  const materials = useMemo(() => {
    const coverMat = texture
      ? new THREE.MeshStandardMaterial({ map: texture, roughness: 0.28, metalness: 0.04 })
      : new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.5, metalness: 0.08 })
    const spineMat = new THREE.MeshStandardMaterial({ color: '#0c0c0c', roughness: 0.82 })
    const pageMat  = new THREE.MeshStandardMaterial({ color: '#EDE8DC', roughness: 0.96 })
    const backMat  = new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.78 })
    // right=pages edge, left=spine, top/bottom=page edges, front=cover, back=back cover
    return [pageMat, spineMat, pageMat, pageMat, coverMat, backMat]
  }, [texture])

  const geo = useMemo(() => new THREE.BoxGeometry(1.32, 1.9, 0.24, 1, 1, 1), [])

  return (
    <group ref={groupRef}>
      <mesh geometry={geo} material={materials} castShadow receiveShadow />
    </group>
  )
}

export default function Book3D({ coverUrl, theme: _theme }: { coverUrl: string | null; theme: Theme }) {
  return (
    <div style={{ width: '100%', height: 300, borderRadius: 20, overflow: 'hidden' }}>
      <Canvas
        camera={{ position: [0.25, 0.35, 3.7], fov: 35 }}
        style={{ background: 'transparent' }}
        gl={{ alpha: true, antialias: true }}
        shadows
      >
        {/* Dramatic top-right key light + soft fill */}
        <ambientLight intensity={0.32} />
        <directionalLight
          position={[3.5, 7, 5]}
          intensity={2.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-near={0.5}
          shadow-camera-far={20}
        />
        <directionalLight position={[-4, 1.5, 3]} intensity={0.3} />
        <pointLight position={[0, 4, 2]} intensity={0.35} />
        <hemisphereLight args={['#d8d4cc', '#060606', 0.18]} />

        <Suspense fallback={null}>
          <BookMesh coverUrl={coverUrl} />
          <Particles />
          <GroundHalo />
          <ShadowPlane />
        </Suspense>

        <OrbitControls
          enablePan={false}
          enableZoom={false}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 1.6}
          rotateSpeed={0.45}
        />
      </Canvas>
    </div>
  )
}
