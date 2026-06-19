import React, { useRef, useEffect, Suspense, useState, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, MeshReflectorMaterial, ContactShadows, Environment } from '@react-three/drei'
import * as THREE from 'three'
import type { Theme } from '../types'

// 1×64 DataTexture: alternating cream/dark rows → crisp page lines when repeated
function makePageLineTex(): THREE.DataTexture {
  const H = 64
  const data = new Uint8Array(H * 4)
  for (let y = 0; y < H; y++) {
    const i = y * 4
    const dark = y % 6 < 1   // one dark row every 6 rows
    data[i]   = dark ? 170 : 237
    data[i+1] = dark ? 162 : 232
    data[i+2] = dark ? 145 : 220
    data[i+3] = 255
  }
  const tex = new THREE.DataTexture(data, 1, H, THREE.RGBAFormat)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.needsUpdate = true
  return tex
}

function proxyCoverUrl(url: string | null): string | null {
  if (!url) return null
  return `/api/cover?url=${encodeURIComponent(url)}`
}

const PAGE_LINES = 22
const BOOK_W = 1.32, BOOK_H = 1.9, BOOK_D = 0.24

function BookMesh({ coverUrl }: { coverUrl: string | null }) {
  const groupRef = useRef<THREE.Group>(null)
  const linesRef = useRef<THREE.InstancedMesh>(null)
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

  // Place page-line strips on right edge via instanced mesh
  useEffect(() => {
    const mesh = linesRef.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    for (let i = 0; i < PAGE_LINES; i++) {
      const y = -BOOK_H / 2 + BOOK_H * (i + 0.5) / PAGE_LINES
      m.setPosition(BOOK_W / 2 + 0.0015, y, 0)
      mesh.setMatrixAt(i, m)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [])

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return
    // Spring entry
    velRef.current += (1 - scaleRef.current) * 7 * delta
    velRef.current *= 0.72
    scaleRef.current = Math.min(1.01, scaleRef.current + velRef.current * delta * 60)
    groupRef.current.scale.setScalar(scaleRef.current)

    const t = clock.getElapsedTime()
    groupRef.current.rotation.y = t * 0.2 + Math.sin(t * 0.15) * 0.18
    groupRef.current.rotation.x = Math.sin(t * 0.28) * 0.035
    groupRef.current.rotation.z = Math.sin(t * 0.38) * 0.016
    groupRef.current.position.y = Math.sin(t * 0.45) * 0.09 + Math.sin(t * 1.05) * 0.02
  })

  // BoxGeometry faces: +x=pages edge, -x=spine, +y=top, -y=bottom, +z=front cover, -z=back
  const materials = useMemo(() => {
    const pageTex = makePageLineTex()
    pageTex.repeat.set(1, 10)   // 10 repeats → ~166 visible page lines

    const coverMat = texture
      ? new THREE.MeshStandardMaterial({ map: texture, roughness: 0.18, metalness: 0.05, envMapIntensity: 1.4 })
      : new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.5, metalness: 0.1 })

    const pageEdgeMat = new THREE.MeshStandardMaterial({
      map: pageTex, roughness: 0.9, metalness: 0.0, envMapIntensity: 0.2,
    })
    const pageTopMat = new THREE.MeshStandardMaterial({
      map: pageTex, roughness: 0.9, metalness: 0.0,
    })
    const spineMat = new THREE.MeshStandardMaterial({ color: '#0d0d0d', roughness: 0.88, metalness: 0.04 })
    const backMat  = new THREE.MeshStandardMaterial({ color: '#101010', roughness: 0.82, metalness: 0.05 })

    return [pageEdgeMat, spineMat, pageTopMat, pageTopMat, coverMat, backMat]
  }, [texture])

  const lineGeo  = useMemo(() => new THREE.BoxGeometry(0.003, BOOK_H / (PAGE_LINES * 2.5), BOOK_D - 0.02), [])
  const lineMat  = useMemo(() => new THREE.MeshBasicMaterial({ color: '#9a9080' }), [])
  const bookGeo  = useMemo(() => new THREE.BoxGeometry(BOOK_W, BOOK_H, BOOK_D, 1, 1, 1), [])

  return (
    <group ref={groupRef}>
      <mesh geometry={bookGeo} material={materials} castShadow receiveShadow />
      {/* Instanced page-separator lines on the right (pages) edge */}
      <instancedMesh ref={linesRef} args={[lineGeo, lineMat, PAGE_LINES]} castShadow />
    </group>
  )
}

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
        <Environment preset="city" background={false} />
        <ambientLight intensity={0.3} />
        <directionalLight position={[3, 7, 4]} intensity={2.6} castShadow shadow-mapSize={[2048, 2048]} color="#fff8f0" />
        <directionalLight position={[-4, 2, 3]} intensity={0.35} color="#d0e8ff" />
        <pointLight position={[0, -0.5, -2.5]} intensity={0.4} color="#ffffff" />
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
