/**
 * Character3D — loads a real GLB model for each character.
 *
 * Place your generated GLB files in:  public/models/<id>.glb
 *   lion  → public/models/lion.glb
 *   mage  → public/models/mage.glb
 *   fox   → public/models/fox.glb
 *   owl   → public/models/owl.glb
 *   knight→ public/models/knight.glb
 *   cosmic→ public/models/cosmic.glb
 *
 * While a model is missing the slot renders a soft animated placeholder.
 */

import { Suspense, useRef, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, Environment, ContactShadows, Center } from '@react-three/drei'
import * as THREE from 'three'
import type { CharacterId } from './AvatarCharacter'

// ─── Constants ────────────────────────────────────────────────────────────────
const MODEL_PATH: Record<CharacterId, string> = {
  lion:   '/models/lion.glb',
  mage:   '/models/mage.glb',
  fox:    '/models/fox.glb',
  owl:    '/models/owl.glb',
  knight: '/models/knight.glb',
  cosmic: '/models/cosmic.glb',
}

const CHARACTER_COLOR: Record<CharacterId, string> = {
  lion:   '#C17F24',
  mage:   '#7C3AED',
  fox:    '#D97706',
  owl:    '#0F766E',
  knight: '#475569',
  cosmic: '#DB2777',
}

// ─── Auto-rotate wrapper ──────────────────────────────────────────────────────
function AutoRotate({ children, speed = 0.5 }: { children: React.ReactNode; speed?: number }) {
  const ref = useRef<THREE.Group>(null!)
  useFrame((_, dt) => { ref.current.rotation.y += dt * speed })
  return <group ref={ref}>{children}</group>
}

// ─── Fit model to a normalised ±1 bounding box ────────────────────────────────
function FitToBox({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null!)

  useEffect(() => {
    if (!ref.current) return
    const box = new THREE.Box3().setFromObject(ref.current)
    const size = new THREE.Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)
    if (maxDim > 0) {
      const scale = 1.8 / maxDim
      ref.current.scale.setScalar(scale)
      // Re-center after scaling
      const box2 = new THREE.Box3().setFromObject(ref.current)
      const center = new THREE.Vector3()
      box2.getCenter(center)
      ref.current.position.sub(center)
    }
  }, [])

  return <group ref={ref}>{children}</group>
}

// Secondary (darker) accent per character — used for details like eyes, claws, etc.
const CHARACTER_SECONDARY: Record<CharacterId, string> = {
  lion:   '#7B4F00',
  mage:   '#2D1B69',
  fox:    '#7C2D12',
  owl:    '#042F2E',
  knight: '#0F172A',
  cosmic: '#4C0519',
}

// ─── Actual GLB model ─────────────────────────────────────────────────────────
// Meshy Draft exports are gray with no texture. We replace every material with
// a stylised MeshStandardMaterial tinted with the character's primary colour so
// each character looks distinct with full 3D detail.
function CharacterModel({ id }: { id: CharacterId }) {
  const { scene } = useGLTF(MODEL_PATH[id])
  const cloned = useRef(scene.clone(true))

  useEffect(() => {
    const primary = new THREE.Color(CHARACTER_COLOR[id])
    const secondary = new THREE.Color(CHARACTER_SECONDARY[id])

    // Collect all meshes and sort by approximate Y position so we can shade
    // the upper parts (face/head) slightly lighter than the body/feet.
    const meshes: { mesh: THREE.Mesh; centerY: number }[] = []
    cloned.current.traverse(node => {
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh
        mesh.castShadow = true
        mesh.receiveShadow = true
        const box = new THREE.Box3().setFromObject(mesh)
        const center = new THREE.Vector3()
        box.getCenter(center)
        meshes.push({ mesh, centerY: center.y })
      }
    })

    if (meshes.length === 0) return

    const minY = Math.min(...meshes.map(m => m.centerY))
    const maxY = Math.max(...meshes.map(m => m.centerY))
    const rangeY = maxY - minY || 1

    meshes.forEach(({ mesh, centerY }) => {
      // t=0 at bottom, t=1 at top → lerp primary → lighter shade toward top
      const t = (centerY - minY) / rangeY
      const col = primary.clone().lerp(new THREE.Color('#ffffff'), t * 0.22)

      mesh.material = new THREE.MeshStandardMaterial({
        color: col,
        roughness: 0.55,
        metalness: id === 'knight' ? 0.55 : id === 'cosmic' ? 0.3 : 0.05,
        emissive: id === 'cosmic' ? primary : secondary,
        emissiveIntensity: id === 'cosmic' ? 0.12 : 0.04,
      })
    })
  }, [id])

  return (
    <FitToBox>
      <primitive object={cloned.current} />
    </FitToBox>
  )
}

// Pre-warm GLTF cache for all characters so switching feels instant
Object.values(MODEL_PATH).forEach(p => useGLTF.preload(p))

// ─── Fallback placeholder while model loads / file missing ───────────────────
function Placeholder({ id, locked }: { id: CharacterId; locked?: boolean }) {
  const color = locked ? '#555' : CHARACTER_COLOR[id]
  const meshRef = useRef<THREE.Mesh>(null!)
  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = clock.getElapsedTime() * 0.6
      meshRef.current.position.y = Math.sin(clock.getElapsedTime() * 1.4) * 0.06
    }
  })
  return (
    <mesh ref={meshRef} castShadow>
      <sphereGeometry args={[0.7, 32, 32]} />
      <meshStandardMaterial
        color={color}
        roughness={0.3}
        metalness={locked ? 0.1 : 0.5}
        emissive={color}
        emissiveIntensity={locked ? 0 : 0.08}
      />
    </mesh>
  )
}

// ─── Error boundary for missing GLB files ────────────────────────────────────
import { Component, type ReactNode } from 'react'

interface EBState { failed: boolean }
class ModelErrorBoundary extends Component<{ id: CharacterId; locked?: boolean; children: ReactNode }, EBState> {
  constructor(props: { id: CharacterId; locked?: boolean; children: ReactNode }) {
    super(props)
    this.state = { failed: false }
  }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) {
      return <Placeholder id={this.props.id} locked={this.props.locked} />
    }
    return this.props.children
  }
}

// ─── Scene with lighting ──────────────────────────────────────────────────────
function CharacterScene({ id, locked }: { id: CharacterId; locked?: boolean }) {
  const { gl } = useThree()

  useEffect(() => {
    gl.shadowMap.enabled = true
    gl.shadowMap.type = THREE.PCFSoftShadowMap
  }, [gl])

  return (
    <>
      {/* Soft ambient */}
      <ambientLight intensity={0.6} />

      {/* Key light — warm, from front-top-right */}
      <directionalLight
        position={[3, 5, 3]}
        intensity={1.8}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={0.1}
        shadow-camera-far={20}
        color="#fff8f0"
      />

      {/* Fill light — cool, from left */}
      <directionalLight position={[-3, 2, -1]} intensity={0.5} color="#c0d8ff" />

      {/* Rim light — bottom back */}
      <pointLight position={[0, -2, -3]} intensity={0.4} color="#ffffff" />

      {/* HDRI-style environment for reflections/IBL */}
      <Environment preset="studio" />

      <AutoRotate speed={locked ? 0 : 0.45}>
        <ModelErrorBoundary id={id} locked={locked}>
          <Suspense fallback={<Placeholder id={id} locked={locked} />}>
            {locked
              ? <Placeholder id={id} locked />
              : <CharacterModel id={id} />
            }
          </Suspense>
        </ModelErrorBoundary>
      </AutoRotate>

      {/* Soft ground shadow */}
      {!locked && (
        <ContactShadows
          position={[0, -1.2, 0]}
          opacity={0.35}
          scale={3}
          blur={2.5}
          far={2}
        />
      )}
    </>
  )
}

// ─── Public component ─────────────────────────────────────────────────────────
interface Character3DProps {
  /** Preferred prop name */
  characterId?: CharacterId
  /** Legacy prop name — same as characterId */
  character?: CharacterId
  locked?: boolean
  size?: number
  /** Ignored — GLB models carry their own colours */
  primaryColor?: string
  secondaryColor?: string
}

export default function Character3D({ characterId, character, locked, size = 160 }: Character3DProps) {
  const id: CharacterId = (characterId ?? character ?? 'lion')
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden' }}>
      <Canvas
        gl={{ antialias: true, alpha: true, outputColorSpace: THREE.SRGBColorSpace }}
        camera={{ position: [0, 0.1, 3.2], fov: 42 }}
        style={{ width: '100%', height: '100%' }}
      >
        <CharacterScene id={id} locked={locked} />
      </Canvas>
    </div>
  )
}
