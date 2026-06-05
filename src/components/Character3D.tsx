/**
 * Character3D
 * • Loads real GLB files from public/models/<id>.glb
 * • Colorises gray Meshy-draft geometry with per-character PBR materials
 * • Drag / swipe to orbit (OrbitControls, no zoom, no pan)
 * • Tap / click triggers a character-specific bounce animation
 * • Locked characters show greyed-out model (not sphere)
 * • Graceful SVG-ball fallback when the GLB is missing
 */

import { Suspense, useRef, useEffect, useMemo, Component, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, useTexture, Environment, ContactShadows, OrbitControls, useAnimations } from '@react-three/drei'
import * as THREE from 'three'
// @ts-ignore — three/examples/jsm exports 'clone' as named function (not 'SkeletonUtils' object)
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { CharacterId } from './AvatarCharacter'

// ─── Model registry ───────────────────────────────────────────────────────────
const MODEL_PATH: Record<string, string> = {
  lion:    '/models/lion.glb',
  mage:    '/models/mage.glb',
  fox:     '/models/fox.glb',
  owl:     '/models/owl.glb',
  knight:  '/models/knight.glb',
  cosmic:  '/models/cosmic.glb',
  phoenix: '/models/phoenix.glb',
  shadow:  '/models/void.glb',
}

const CHARACTER_COLOR: Record<string, string> = {
  lion:    '#C17F24',
  mage:    '#7C3AED',
  fox:     '#D97706',
  owl:     '#0F766E',
  knight:  '#475569',
  cosmic:  '#DB2777',
  phoenix: '#F97316',
  shadow:  '#4C1D95',
}

const CHARACTER_SECONDARY: Record<string, string> = {
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
function FitToBox({ children, modelScale = 1, offsetX = 0, offsetY = 0 }: { children: ReactNode; modelScale?: number; offsetX?: number; offsetY?: number }) {
  const ref = useRef<THREE.Group>(null!)
  const fitted = useRef(false)
  const prev = useRef({ modelScale, offsetX, offsetY })

  useFrame(() => {
    // Reset whenever any display param changes so live preview updates immediately
    const p = prev.current
    if (p.modelScale !== modelScale || p.offsetX !== offsetX || p.offsetY !== offsetY) {
      prev.current = { modelScale, offsetX, offsetY }
      fitted.current = false
      if (ref.current) { ref.current.scale.setScalar(1); ref.current.position.set(0, 0, 0) }
    }
    if (fitted.current || !ref.current) return
    ref.current.updateMatrixWorld(true)
    // Use geometry bounding boxes (local space × matrixWorld) so skinned-mesh
    // bone deformations don't inflate the bounding box to wrong positions.
    const box = new THREE.Box3()
    let hasMesh = false
    ref.current.traverse((obj: THREE.Object3D) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh || !mesh.geometry) return
      mesh.geometry.computeBoundingBox()
      if (!mesh.geometry.boundingBox) return
      box.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld))
      hasMesh = true
    })
    if (!hasMesh || box.isEmpty()) return
    const size = new THREE.Vector3(); box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)
    if (maxDim > 0) {
      const s = (1.8 / maxDim) * modelScale
      ref.current.scale.setScalar(s)
      ref.current.updateMatrixWorld(true)
      const box2 = new THREE.Box3()
      ref.current.traverse((obj: THREE.Object3D) => {
        const mesh = obj as THREE.Mesh
        if (mesh.isMesh && mesh.geometry?.boundingBox) {
          box2.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld))
        }
      })
      const center = new THREE.Vector3(); box2.getCenter(center)
      ref.current.position.sub(center)
      // Apply user-defined offset on top of the auto-centered position
      ref.current.position.x += offsetX
      ref.current.position.y += offsetY
      fitted.current = true
    }
  })

  return <group ref={ref}>{children}</group>
}

// ─── Texture applier — only mounted when textureUrl is provided ───────────────
function TextureApplier({ textureUrl, roughnessUrl, target }: {
  textureUrl: string
  roughnessUrl: string  // same as textureUrl when no roughness map (hook rule compliance)
  target: THREE.Object3D
}) {
  const albedo   = useTexture(textureUrl)
  const roughTex = useTexture(roughnessUrl)
  const hasRoughness = roughnessUrl !== textureUrl

  useEffect(() => {
    albedo.flipY   = false
    roughTex.flipY = false
    albedo.needsUpdate   = true
    roughTex.needsUpdate = true
    target.traverse((node: THREE.Object3D) => {
      if (!(node as THREE.Mesh).isMesh) return
      const mesh = node as THREE.Mesh
      mesh.castShadow = true; mesh.receiveShadow = true
      mesh.material = new THREE.MeshStandardMaterial({
        map: albedo,
        ...(hasRoughness ? { roughnessMap: roughTex, metalnessMap: roughTex } : {}),
        roughness: hasRoughness ? 1.0 : 0.7,
        metalness: hasRoughness ? 1.0 : 0.05,
      })
    })
  }, [target, albedo, roughTex, hasRoughness])

  return null
}

// ─── GLB model — colorised ─────────────────────────────────────────────────────
function CharacterModel({ id, primaryColor, locked, glbUrl, modelScale, offsetX, offsetY, textureUrl, textureRoughnessUrl }: { id: string; primaryColor?: string; locked?: boolean; glbUrl?: string; modelScale?: number; offsetX?: number; offsetY?: number; textureUrl?: string; textureRoughnessUrl?: string }) {
  const modelPath = glbUrl ?? MODEL_PATH[id]
  if (!modelPath) throw new Error(`No GLB for character: ${id}`)
  const { scene, animations } = useGLTF(modelPath)
  const cloned = useMemo(() => {
    try { return skeletonClone(scene) } catch { return scene.clone(true) }
  }, [scene])
  const groupRef = useRef<THREE.Group>(null!)
  const { actions } = useAnimations(animations, groupRef)

  useEffect(() => {
    if (!actions || Object.keys(actions).length === 0) return
    const idle = actions['Idle'] ?? actions['idle'] ?? actions['mixamo.com'] ?? Object.values(actions)[0]
    if (idle) idle.reset().fadeIn(0.4).play()
  }, [actions])

  useEffect(() => {
    if (locked) {
      cloned.traverse((node: THREE.Object3D) => {
        if ((node as THREE.Mesh).isMesh) {
          const mesh = node as THREE.Mesh
          mesh.castShadow = false
          mesh.material = new THREE.MeshStandardMaterial({ color: '#555555', roughness: 0.9, metalness: 0.0 })
        }
      })
      return
    }
    if (textureUrl) return  // TextureApplier handles materials

    const primary   = new THREE.Color(primaryColor ?? CHARACTER_COLOR[id] ?? '#888888')
    const secondary = new THREE.Color(CHARACTER_SECONDARY[id] ?? '#444444')

    const meshes: { mesh: THREE.Mesh; centerY: number }[] = []
    cloned.traverse((node: THREE.Object3D) => {
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
                  : id in CHARACTER_COLOR ? 0.04 : 0.10,
      })
    })
  }, [id, primaryColor, locked, cloned, textureUrl])

  return (
    <FitToBox modelScale={modelScale} offsetX={offsetX} offsetY={offsetY}>
      <group ref={groupRef}>
        <primitive object={cloned} />
        {textureUrl && !locked && (
          <TextureApplier
            textureUrl={textureUrl}
            roughnessUrl={textureRoughnessUrl ?? textureUrl}
            target={cloned}
          />
        )}
      </group>
    </FitToBox>
  )
}

// Pre-warm GLTF cache
Object.values(MODEL_PATH).forEach(p => useGLTF.preload(p))

// ─── Animated placeholder sphere ─────────────────────────────────────────────
function Placeholder({ id, locked }: { id: string; locked?: boolean }) {
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
  { id: string; locked?: boolean; children: ReactNode },
  { failed: boolean }
> {
  constructor(props: { id: string; locked?: boolean; children: ReactNode }) {
    super(props); this.state = { failed: false }
  }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed
      ? <Placeholder id={this.props.id} locked={this.props.locked} />
      : this.props.children
  }
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
  id, locked, interactive, primaryColor, glbUrl, modelScale, offsetX, offsetY, textureUrl, textureRoughnessUrl,
}: {
  id: string; locked?: boolean; interactive?: boolean; primaryColor?: string; glbUrl?: string; modelScale?: number; offsetX?: number; offsetY?: number; textureUrl?: string; textureRoughnessUrl?: string
}) {
  const { gl } = useThree()

  useEffect(() => {
    gl.shadowMap.enabled = true
    gl.shadowMap.type = THREE.PCFSoftShadowMap
  }, [gl])

  const modelContent = (
    <ModelErrorBoundary id={id} locked={locked}>
      <Suspense fallback={<Placeholder id={id} locked={locked} />}>
        <CharacterModel id={id} primaryColor={primaryColor} locked={locked} glbUrl={glbUrl} modelScale={modelScale} offsetX={offsetX} offsetY={offsetY} textureUrl={textureUrl} textureRoughnessUrl={textureRoughnessUrl} />
      </Suspense>
    </ModelErrorBoundary>
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
        : <AutoRotateGroup locked={locked}>{modelContent}</AutoRotateGroup>}


      {!locked && (
        <ContactShadows position={[0, -1.2, 0]} opacity={0.3} scale={3} blur={2.5} far={2} />
      )}
    </>
  )
}

// ─── Public component ─────────────────────────────────────────────────────────
interface Character3DProps {
  characterId?: string
  /** Legacy prop — same as characterId */
  character?: string
  locked?: boolean
  size?: number
  /** Enable drag-to-rotate and tap animation (default true for large views) */
  interactive?: boolean
  primaryColor?: string
  secondaryColor?: string
  /** For dynamic characters not in the static MODEL_PATH registry */
  glbUrl?: string
  /** Multiplier on top of FitToBox normalisation (1.0 = default fill) */
  modelScale?: number
  /** Horizontal offset in 3D units after auto-centering */
  offsetX?: number
  /** Vertical offset in 3D units after auto-centering */
  offsetY?: number
  /** Albedo texture URL — when provided, replaces procedural coloring */
  textureUrl?: string
  /** Combined roughness+metalness texture URL (optional, paired with textureUrl) */
  textureRoughnessUrl?: string
}

export default function Character3D({
  characterId, character, locked, size = 160, interactive, primaryColor, glbUrl, modelScale, offsetX, offsetY, textureUrl, textureRoughnessUrl,
}: Character3DProps) {
  const id: string = characterId ?? character ?? 'lion'
  const isInteractive = interactive ?? size >= 120

  return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden',
      cursor: isInteractive && !locked ? 'grab' : 'default' }}>
      <Canvas
        gl={{ antialias: true, alpha: true, outputColorSpace: THREE.SRGBColorSpace }}
        camera={{ position: [0, 0.1, 3.2], fov: 42 }}
        style={{ width: '100%', height: '100%' }}
      >
        <CharacterScene id={id} locked={locked} interactive={isInteractive} primaryColor={primaryColor} glbUrl={glbUrl} modelScale={modelScale} offsetX={offsetX} offsetY={offsetY} textureUrl={textureUrl} textureRoughnessUrl={textureRoughnessUrl} />
      </Canvas>
    </div>
  )
}
