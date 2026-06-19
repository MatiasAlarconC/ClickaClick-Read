import React, { useRef, useEffect, Suspense, useState, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, MeshReflectorMaterial, ContactShadows, Environment } from '@react-three/drei'
import * as THREE from 'three'
import type { Theme } from '../types'

// Canvas texture with horizontal page lines for the book edges
function makePageEdgeTexture(): THREE.CanvasTexture {
  const W = 64, H = 512
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#EDE8DC'
  ctx.fillRect(0, 0, W, H)
  // Subtle gradient from left (slightly shadowed spine side) to right
  const grad = ctx.createLinearGradient(0, 0, W, 0)
  grad.addColorStop(0, 'rgba(0,0,0,0.12)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)
  // Page line marks — thin dark lines every ~2px
  for (let y = 0; y < H; y += 2) {
    const alpha = y % 8 === 0 ? 0.18 : 0.06
    ctx.fillStyle = `rgba(80,60,40,${alpha})`
    ctx.fillRect(0, y, W, 1)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  return tex
}

// Spine texture with faint vertical grain
function makeSpineTexture(): THREE.CanvasTexture {
  const W = 32, H = 512
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, W, H)
  // Subtle vertical grain
  for (let x = 0; x < W; x += 3) {
    const alpha = Math.random() * 0.05
    ctx.fillStyle = `rgba(255,255,255,${alpha})`
    ctx.fillRect(x, 0, 1, H)
  }
  const tex = new THREE.CanvasTexture(canvas)
  return tex
}

function proxyCoverUrl(url: string | null): string | null {
  if (!url) return null
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

  // Book dimensions
  const W = 1.32, H = 1.9, D = 0.24

  // BoxGeometry face order: +x=pages edge, -x=spine, +y=top, -y=bottom, +z=front cover, -z=back
  const materials = useMemo(() => {
    const pageEdgeTex = makePageEdgeTexture()
    const spineTex = makeSpineTexture()

    const coverMat = texture
      ? new THREE.MeshStandardMaterial({ map: texture, roughness: 0.18, metalness: 0.05, envMapIntensity: 1.4 })
      : new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.5, metalness: 0.1 })

    const pageEdgeMat = new THREE.MeshStandardMaterial({
      map: pageEdgeTex,
      roughness: 0.88,
      metalness: 0.0,
      envMapIntensity: 0.3,
    })
    const pageTopMat = new THREE.MeshStandardMaterial({
      map: pageEdgeTex,
      roughness: 0.9,
      metalness: 0.0,
    })
    const spineMat = new THREE.MeshStandardMaterial({
      map: spineTex,
      color: '#0f0f0f',
      roughness: 0.88,
      metalness: 0.04,
    })
    const backMat = new THREE.MeshStandardMaterial({ color: '#101010', roughness: 0.82, metalness: 0.05 })

    return [pageEdgeMat, spineMat, pageTopMat, pageTopMat, coverMat, backMat]
  }, [texture])

  const geo = useMemo(() => new THREE.BoxGeometry(W, H, D, 1, 1, 1), [])

  // Cover-edge bevel strip geometry (thin strip along front edges for thickness)
  const coverEdgeGeo = useMemo(() => new THREE.BoxGeometry(0.012, H - 0.04, D + 0.002), [])
  const coverEdgeMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#080808', roughness: 0.7, metalness: 0.08 }), [])

  return (
    <group ref={groupRef}>
      <mesh geometry={geo} material={materials} castShadow receiveShadow />
      {/* Thin dark edge strip on cover-left (near spine) for visual depth */}
      <mesh geometry={coverEdgeGeo} material={coverEdgeMat} position={[-W / 2 + 0.006, 0, 0]} castShadow />
      {/* Thin edge on page side */}
      <mesh geometry={coverEdgeGeo} material={coverEdgeMat} position={[W / 2 - 0.006, 0, 0]} castShadow />
    </group>
  )
}

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
      <pointsMaterial size={0.016} color="#ffffff" transparent opacity={0.18} sizeAttenuation depthWrite={false} />
    </points>
  )
}

export default function Book3D({ coverUrl, theme: _theme }: { coverUrl: string | null; theme: Theme }) {
  return (
    <div style={{ width: '100%', height: 300, borderRadius: 20, overflow: 'hidden' }}>
      <Canvas
        camera={{ position: [0.5, 0.3, 3.8], fov: 34 }}
        style={{ background: 'transparent' }}
        gl={{ alpha: true, antialias: true }}
        shadows
      >
        {/* HDR environment for realistic cover reflections */}
        <Environment preset="city" background={false} />

        {/* Warm key from top-right + cool fill from left + rim from behind */}
        <ambientLight intensity={0.3} />
        <directionalLight position={[3, 7, 4]} intensity={2.6} castShadow shadow-mapSize={[2048, 2048]} color="#fff8f0" />
        <directionalLight position={[-4, 2, 3]} intensity={0.35} color="#d0e8ff" />
        <pointLight position={[0, -0.5, -2.5]} intensity={0.4} color="#ffffff" />
        {/* Subtle rim light to pop edges */}
        <pointLight position={[2, 3, -3]} intensity={0.6} color="#ffffff" />

        <Suspense fallback={null}>
          <BookMesh coverUrl={coverUrl} />
          <Particles />

          <ContactShadows
            position={[0, -1.14, 0]}
            opacity={0.7}
            scale={3.5}
            blur={2.5}
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
              mixStrength={0.5}
              roughness={1}
              depthScale={1.2}
              minDepthThreshold={0.4}
              maxDepthThreshold={1.4}
              color="#050505"
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
