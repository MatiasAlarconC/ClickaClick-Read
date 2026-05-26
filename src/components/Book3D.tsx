import React, { useRef, useEffect, Suspense, useState } from 'react'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Theme } from '../types'

function BookMesh({ coverUrl, theme }: { coverUrl: string | null; theme: Theme }) {
  const groupRef = useRef<THREE.Group>(null)
  const timeRef = useRef(0)
  const [texture, setTexture] = useState<THREE.Texture | null>(null)

  useEffect(() => {
    if (!coverUrl) { setTexture(null); return }
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')
    loader.load(coverUrl, (tex) => setTexture(tex), undefined, () => setTexture(null))
  }, [coverUrl])

  useFrame((_, delta) => {
    if (!groupRef.current) return
    timeRef.current += delta
    groupRef.current.rotation.y += delta * 0.3
    groupRef.current.position.y = Math.sin(timeRef.current * 0.8) * 0.08
  })

  const coverColor = theme.dark ? '#FFFFFF' : '#0A0A0A'

  const coverMat = texture ? new THREE.MeshStandardMaterial({ map: texture }) : new THREE.MeshStandardMaterial({ color: '#141414' })
  const spineMat  = new THREE.MeshStandardMaterial({ color: '#0A0A0A' })
  const pageMat   = new THREE.MeshStandardMaterial({ color: '#F5F0E8' })

  // BoxGeometry: width, height, depth — [+x right, -x left, +y top, -y bottom, +z front/cover, -z back]
  const geo = new THREE.BoxGeometry(1.3, 1.9, 0.18)

  // 6 faces: right(+x), left(-x), top(+y), bottom(−y), front(+z/cover), back(−z)
  const materials = [spineMat, spineMat, pageMat, pageMat, coverMat, new THREE.MeshStandardMaterial({ color: '#1a1a1a' })]

  return (
    <group ref={groupRef}>
      <mesh geometry={geo} material={materials} castShadow />
    </group>
  )
}

export default function Book3D({ coverUrl, theme }: { coverUrl: string | null; theme: Theme }) {
  return (
    <div style={{ width: '100%', height: 280, borderRadius: 16, overflow: 'hidden' }}>
      <Canvas
        camera={{ position: [0, 0, 3.5], fov: 40 }}
        style={{ background: 'transparent' }}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 5]} intensity={1.2} castShadow />
        <directionalLight position={[-2, -1, 3]} intensity={0.4} />
        <Suspense fallback={null}>
          <BookMesh coverUrl={coverUrl} theme={theme} />
        </Suspense>
        <OrbitControls
          enablePan={false} enableZoom={false}
          minPolarAngle={Math.PI / 3} maxPolarAngle={Math.PI / 1.5}
        />
      </Canvas>
    </div>
  )
}
