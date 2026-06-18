import React, { useRef, useEffect, Suspense, useState, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, MeshReflectorMaterial, ContactShadows, Environment } from '@react-three/drei'
import * as THREE from 'three'
import type { Theme } from '../types'

// Subtle atmospheric dust
function Particles({ count = 18 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null)
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r = 1.8 + Math.random() * 1.0
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
    ref.current.rotation.y = clock.getElapsedTime() * 0.03
    ref.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.04) * 0.1
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.016} color="#ffffff" transparent opacity={0.22} sizeAttenuation depthWrite={false} />
    </points>
  )
}

function proxyCoverUrl(url: string | null): string | null {
  if (!url) return null
  // Proxy through server to avoid CORS issues with Google Books / Amazon CDNs
  return `/api/cover?url=${encodeURIComponent(url)}`
}

function BookMesh({ coverUrl }: { coverUrl: string | null }) {
  const groupRef = useRef<THREE.Group>(null)
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  const scaleRef = useRef(0)
  const velRef = useRef(0)

  useEffect(() => {
    if (!coverUrl) { setTexture(null); return }
    const loader = new THREE.TextureLoader()
    loader.load(
      proxyCoverUrl(coverUrl)!,
      (tex) => { tex.colorSpace = THREE.SRGBColorSpace; setTexture(tex) },
      undefined,
      () => setTexture(null),
    )
  }, [coverUrl])

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return
    // Spring entry
    velRef.current += (1 - scaleRef.current) * 7 * delta
    velRef.current *= 0.72
    scaleRef.current = Math.min(1.01, scaleRef.current + velRef.current * delta * 60)
    groupRef.current.scale.setScalar(scaleRef.current)

    // Graceful showcase rotation
    const t = clock.getElapsedTime()
    groupRef.current.rotation.y = t * 0.2 + Math.sin(t * 0.15) * 0.18
    groupRef.current.rotation.x = Math.sin(t * 0.28) * 0.035
    groupRef.current.rotation.z = Math.sin(t * 0.38) * 0.016
    groupRef.current.position.y = Math.sin(t * 0.45) * 0.09 + Math.sin(t * 1.05) * 0.02
  })

  // BoxGeometry faces: +x=pages edge, -x=spine, +y=top, -y=bottom, +z=front cover, -z=back
  const materials = useMemo(() => {
    const coverMat = texture
      ? new THREE.MeshStandardMaterial({ map: texture, roughness: 0.22, metalness: 0.06, envMapIntensity: 1.2 })
      : new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.5, metalness: 0.1 })
    const spineMat = new THREE.MeshStandardMaterial({ color: '#090909', roughness: 0.85, metalness: 0.05 })
    const pageMat  = new THREE.MeshStandardMaterial({ color: '#EDE8DC', roughness: 0.95, metalness: 0.0 })
    const backMat  = new THREE.MeshStandardMaterial({ color: '#101010', roughness: 0.80, metalness: 0.05 })
    return [pageMat, spineMat, pageMat, pageMat, coverMat, backMat]
  }, [texture])

  const geo = useMemo(() => new THREE.BoxGeometry(1.32, 1.9, 0.24, 1, 1, 1), [])

  return (
    <group ref={groupRef}>
      <mesh geometry={geo} material={materials} castShadow />
    </group>
  )
}

export default function Book3D({ coverUrl, theme: _theme }: { coverUrl: string | null; theme: Theme }) {
  return (
    <div style={{ width: '100%', height: 300, borderRadius: 20, overflow: 'hidden' }}>
      <Canvas
        camera={{ position: [0.3, 0.4, 3.6], fov: 34 }}
        style={{ background: 'transparent' }}
        gl={{ alpha: true, antialias: true }}
        shadows
      >
        {/* HDR environment for realistic cover reflections */}
        <Environment preset="city" background={false} />

        {/* Key light from top-right + subtle fill + rim from behind */}
        <ambientLight intensity={0.28} />
        <directionalLight position={[3, 7, 4]} intensity={2.4} castShadow shadow-mapSize={[2048, 2048]} />
        <directionalLight position={[-3, 1, 3]} intensity={0.25} />
        <pointLight position={[0, -1, -3]} intensity={0.5} color="#ffffff" />

        <Suspense fallback={null}>
          <BookMesh coverUrl={coverUrl} />
          <Particles />

          {/* Soft contact shadow blob */}
          <ContactShadows
            position={[0, -1.14, 0]}
            opacity={0.65}
            scale={3.5}
            blur={2.2}
            far={1.6}
            color="#000000"
          />

          {/* Glossy reflective floor */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.15, 0]}>
            <planeGeometry args={[12, 12]} />
            <MeshReflectorMaterial
              blur={[300, 100]}
              resolution={512}
              mixBlur={1}
              mixStrength={0.55}
              roughness={1}
              depthScale={1.2}
              minDepthThreshold={0.4}
              maxDepthThreshold={1.4}
              color="#060606"
              metalness={0.6}
              mirror={0}
            />
          </mesh>
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
