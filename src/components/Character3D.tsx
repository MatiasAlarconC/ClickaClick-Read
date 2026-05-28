/**
 * Character3D
 * • Loads real GLB files from public/models/<id>.glb
 * • Colorises gray Meshy-draft geometry with per-character PBR materials
 * • Drag / swipe to orbit (OrbitControls, no zoom, no pan)
 * • Tap / click triggers a character-specific bounce animation
 * • Locked characters show greyed-out model (not sphere)
 * • Graceful SVG-ball fallback when the GLB is missing
 */

import { Suspense, useRef, useEffect, useMemo, useState, Component, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, Environment, ContactShadows, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { CharacterId } from './AvatarCharacter'

// ─── Model registry ───────────────────────────────────────────────────────────
const MODEL_PATH: Record<CharacterId, string> = {
  lion:    '/models/lion.glb',
  mage:    '/models/mage.glb',
  fox:     '/models/fox.glb',
  owl:     '/models/owl.glb',
  knight:  '/models/knight.glb',
  cosmic:  '/models/cosmic.glb',
  phoenix: '/models/phoenix.glb',
  shadow:  '/models/void.glb',  // file was saved as void.glb
}

const CHARACTER_COLOR: Record<CharacterId, string> = {
  lion:    '#C17F24',
  mage:    '#7C3AED',
  fox:     '#D97706',
  owl:     '#0F766E',
  knight:  '#475569',
  cosmic:  '#DB2777',
  phoenix: '#F97316',
  shadow:  '#4C1D95',
}

const CHARACTER_SECONDARY: Record<CharacterId, string> = {
  lion:    '#7B4F00',
  mage:    '#2D1B69',
  fox:     '#7C2D12',
  owl:     '#042F2E',
  knight:  '#0F172A',
  cosmic:  '#4C0519',
  phoenix: '#7C2D12',
  shadow:  '#0A0014',
}

// ─── Fit loaded GLB into a normalised ±1 bounding box ─────────────────────────
// Uses useFrame so it retries every frame until geometry is ready (fixes timing issues)
function FitToBox({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null!)
  const fitted = useRef(false)

  useFrame(() => {
    if (fitted.current || !ref.current) return
    const box = new THREE.Box3().setFromObject(ref.current)
    const size = new THREE.Vector3(); box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)
    if (maxDim > 0) {
      const s = 1.8 / maxDim
      ref.current.scale.setScalar(s)
      const box2 = new THREE.Box3().setFromObject(ref.current)
      const center = new THREE.Vector3(); box2.getCenter(center)
      ref.current.position.sub(center)
      fitted.current = true
    }
  })

  return <group ref={ref}>{children}</group>
}

// ─── GLB model — colorised ─────────────────────────────────────────────────────
function CharacterModel({ id, primaryColor, locked }: { id: CharacterId; primaryColor?: string; locked?: boolean }) {
  const { scene } = useGLTF(MODEL_PATH[id])
  const cloned = useMemo(() => scene.clone(true), [scene])

  useEffect(() => {
    if (locked) {
      // Show greyed-out model for locked characters (not a sphere)
      cloned.traverse(node => {
        if ((node as THREE.Mesh).isMesh) {
          const mesh = node as THREE.Mesh
          mesh.castShadow = false
          mesh.material = new THREE.MeshStandardMaterial({
            color: '#555555', roughness: 0.9, metalness: 0.0,
          })
        }
      })
      return
    }

    const primary   = new THREE.Color(primaryColor ?? CHARACTER_COLOR[id])
    const secondary = new THREE.Color(CHARACTER_SECONDARY[id])

    const meshes: { mesh: THREE.Mesh; centerY: number }[] = []
    cloned.traverse(node => {
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh
        mesh.castShadow = true; mesh.receiveShadow = true
        const box = new THREE.Box3().setFromObject(mesh)
        const c = new THREE.Vector3(); box.getCenter(c)
        meshes.push({ mesh, centerY: c.y })
      }
    })
    if (!meshes.length) return

    const minY = Math.min(...meshes.map(m => m.centerY))
    const maxY = Math.max(...meshes.map(m => m.centerY))
    const range = maxY - minY || 1

    meshes.forEach(({ mesh, centerY }) => {
      const t = (centerY - minY) / range
      const col = primary.clone().lerp(new THREE.Color('#ffffff'), t * 0.22)

      mesh.material = new THREE.MeshStandardMaterial({
        color: col,
        roughness:  id === 'shadow'  ? 0.1  : id === 'knight'  ? 0.25 : 0.55,
        metalness:  id === 'knight'  ? 0.6  : id === 'cosmic'  ? 0.3
                  : id === 'shadow'  ? 0.85 : id === 'phoenix' ? 0.15 : 0.05,
        emissive:   id === 'cosmic'  ? primary
                  : id === 'phoenix' ? new THREE.Color('#FF4500')
                  : id === 'shadow'  ? new THREE.Color('#6D28D9')
                  : secondary,
        emissiveIntensity:
                    id === 'cosmic'  ? 0.12
                  : id === 'phoenix' ? 0.28
                  : id === 'shadow'  ? 0.40
                  : 0.04,
      })
    })
  }, [id, primaryColor, locked, cloned])

  return <FitToBox><primitive object={cloned} /></FitToBox>
}

// Pre-warm GLTF cache
Object.values(MODEL_PATH).forEach(p => useGLTF.preload(p))

// ─── Animated placeholder sphere ─────────────────────────────────────────────
function Placeholder({ id, locked }: { id: CharacterId; locked?: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const color = locked ? '#555' : CHARACTER_COLOR[id]
  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.rotation.y = clock.getElapsedTime() * 0.6
    ref.current.position.y = Math.sin(clock.getElapsedTime() * 1.4) * 0.06
  })
  return (
    <mesh ref={ref} castShadow>
      <sphereGeometry args={[0.7, 32, 32]} />
      <meshStandardMaterial color={color} roughness={0.3} metalness={locked ? 0.1 : 0.5}
        emissive={color} emissiveIntensity={locked ? 0 : 0.08} />
    </mesh>
  )
}

// ─── Error boundary (missing GLB) ────────────────────────────────────────────
class ModelErrorBoundary extends Component<
  { id: CharacterId; locked?: boolean; children: ReactNode },
  { failed: boolean }
> {
  constructor(props: { id: CharacterId; locked?: boolean; children: ReactNode }) {
    super(props); this.state = { failed: false }
  }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed
      ? <Placeholder id={this.props.id} locked={this.props.locked} />
      : this.props.children
  }
}

// ─── Animated scene group (bounce on tap) ─────────────────────────────────────
// Each character has its own animation flavour
const ANIM_PROFILE: Record<CharacterId, { height: number; spins: number; squash: number }> = {
  lion:    { height: 0.45, spins: 1,   squash: 0.15 },
  mage:    { height: 0.30, spins: 2,   squash: 0.05 },
  fox:     { height: 0.55, spins: 1.5, squash: 0.20 },
  owl:     { height: 0.20, spins: 0.5, squash: 0.25 },
  knight:  { height: 0.25, spins: 0.5, squash: 0.10 },
  cosmic:  { height: 0.35, spins: 3,   squash: 0.05 },
  phoenix: { height: 0.60, spins: 2,   squash: 0.08 },
  shadow:  { height: 0.15, spins: 4,   squash: 0.02 },
}

function AnimGroup({
  id, locked, tapCount, children,
}: {
  id: CharacterId; locked?: boolean; tapCount: number; children: ReactNode
}) {
  const ref = useRef<THREE.Group>(null!)
  const anim = useRef({ active: false, t: 0 })
  const { height, spins, squash } = ANIM_PROFILE[id]

  useEffect(() => {
    if (tapCount > 0 && !locked) anim.current = { active: true, t: 0 }
  }, [tapCount, locked])

  useFrame((_, dt) => {
    if (!ref.current || !anim.current.active) return
    anim.current.t = Math.min(anim.current.t + dt * 1.6, 1)
    const t = anim.current.t
    const arc = Math.sin(t * Math.PI)
    ref.current.position.y = arc * height
    ref.current.rotation.y = t * Math.PI * 2 * spins
    const s = 1 - arc * squash
    ref.current.scale.set(s > 0 ? 1 / s : 1, s, s > 0 ? 1 / s : 1)
    if (t >= 1) {
      anim.current.active = false
      ref.current.position.y = 0
      ref.current.rotation.y = 0
      ref.current.scale.set(1, 1, 1)
    }
  })

  return <group ref={ref}>{children}</group>
}

// ─── Auto-rotate group for thumbnail mode ────────────────────────────────────
function AutoRotateGroup({ locked, children }: { locked?: boolean; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null!)
  useFrame(({ clock }, dt) => {
    if (!ref.current) return
    if (!locked) {
      ref.current.rotation.y += dt * 0.35
      // Gentle idle sway (breathing)
      ref.current.rotation.z = Math.sin(clock.elapsedTime * 0.9) * 0.025
      ref.current.position.y = Math.sin(clock.elapsedTime * 0.8) * 0.04
    }
  })
  return <group ref={ref}>{children}</group>
}

// ─── Full scene ───────────────────────────────────────────────────────────────
function CharacterScene({
  id, locked, interactive, tapCount, primaryColor,
}: {
  id: CharacterId; locked?: boolean; interactive?: boolean; tapCount: number; primaryColor?: string
}) {
  const { gl } = useThree()

  useEffect(() => {
    gl.shadowMap.enabled = true
    gl.shadowMap.type = THREE.PCFSoftShadowMap
  }, [gl])

  const modelContent = (
    <AnimGroup id={id} locked={locked} tapCount={tapCount}>
      <ModelErrorBoundary id={id} locked={locked}>
        <Suspense fallback={<Placeholder id={id} locked={locked} />}>
          <CharacterModel id={id} primaryColor={primaryColor} locked={locked} />
        </Suspense>
      </ModelErrorBoundary>
    </AnimGroup>
  )

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 5, 3]} intensity={1.8} castShadow
        shadow-mapSize={[1024, 1024]} color="#fff8f0" />
      <directionalLight position={[-3, 2, -1]} intensity={0.5} color="#c0d8ff" />
      <pointLight position={[0, -2, -3]} intensity={0.35} />
      <Environment preset="studio" />

      {interactive && (
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate={!locked}
          autoRotateSpeed={0.8}
          minPolarAngle={Math.PI * 0.28}
          maxPolarAngle={Math.PI * 0.72}
          makeDefault
        />
      )}

      {interactive
        ? <group>{modelContent}</group>
        : <AutoRotateGroup locked={locked}>{modelContent}</AutoRotateGroup>
      }

      {!locked && (
        <ContactShadows position={[0, -1.2, 0]} opacity={0.3} scale={3} blur={2.5} far={2} />
      )}
    </>
  )
}

// ─── Public component ─────────────────────────────────────────────────────────
interface Character3DProps {
  characterId?: CharacterId
  /** Legacy prop — same as characterId */
  character?: CharacterId
  locked?: boolean
  size?: number
  /** Enable drag-to-rotate and tap animation (default true for large views) */
  interactive?: boolean
  primaryColor?: string
  secondaryColor?: string
}

export default function Character3D({
  characterId, character, locked, size = 160, interactive, primaryColor,
}: Character3DProps) {
  const id: CharacterId = characterId ?? character ?? 'lion'
  const isInteractive = interactive ?? size >= 120

  // Tap detection on the outer div — avoids OrbitControls pointer event conflict
  const tapStart = useRef<number | null>(null)
  const [tapCount, setTapCount] = useState(0)

  const handlePointerDown = () => { tapStart.current = Date.now() }
  const handlePointerUp = () => {
    if (tapStart.current && Date.now() - tapStart.current < 220 && !locked) {
      setTapCount(c => c + 1)
    }
    tapStart.current = null
  }

  return (
    <div
      style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden',
        cursor: isInteractive && !locked ? 'grab' : 'default' }}
      onMouseDown={handlePointerDown}
      onMouseUp={handlePointerUp}
      onTouchStart={handlePointerDown}
      onTouchEnd={handlePointerUp}
    >
      <Canvas
        gl={{ antialias: true, alpha: true, outputColorSpace: THREE.SRGBColorSpace }}
        camera={{ position: [0, 0.1, 3.2], fov: 42 }}
        style={{ width: '100%', height: '100%' }}
      >
        <CharacterScene id={id} locked={locked} interactive={isInteractive} tapCount={tapCount} primaryColor={primaryColor} />
      </Canvas>
    </div>
  )
}
