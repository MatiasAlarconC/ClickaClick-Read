import { useEffect, useRef, useState, useCallback } from 'react'

interface Props {
  bookTitle: string
  onCapture: (dataUrl: string) => void
  onClose: () => void
}

const AW = 160
const AH = 284
const EMA_ALPHA = 0.12
const CONFIDENCE_THRESH = 5

function detectLR(data: Uint8ClampedArray, w: number, h: number): { left: number; right: number } | null {
  const colMag = new Float32Array(w)
  const gray = (px: number, py: number) => {
    const i = (py * w + px) * 4
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      colMag[x] += Math.abs(
        -gray(x-1,y-1) + gray(x+1,y-1) - 2*gray(x-1,y) + 2*gray(x+1,y) - gray(x-1,y+1) + gray(x+1,y+1)
      )
    }
  }
  let p1 = 1
  for (let x = 2; x < w - 2; x++) if (colMag[x] > colMag[p1]) p1 = x
  if (colMag[p1] < 1800) return null
  let p2 = -1
  for (let x = 2; x < w - 2; x++) {
    const sep = Math.abs(x - p1)
    if (sep < 10 || sep > 110) continue
    if (colMag[x] < colMag[p1] * 0.22) continue
    if (p2 === -1 || colMag[x] > colMag[p2]) p2 = x
  }
  if (p2 === -1) return null
  const left = Math.min(p1, p2) / w
  const right = Math.max(p1, p2) / w
  if (right - left < 0.06 || right - left > 0.72) return null
  return { left, right }
}

// Improved scan: auto-levels (1% clip) + contrast S-curve + unsharp mask
function applyDocumentScan(src: HTMLCanvasElement): string {
  const MAX = 2200
  let sw = src.width, sh = src.height
  const scl = Math.min(1, MAX / Math.max(sw, sh))
  sw = Math.round(sw * scl); sh = Math.round(sh * scl)
  const c = document.createElement('canvas')
  c.width = sw; c.height = sh
  const ctx = c.getContext('2d')!
  ctx.drawImage(src, 0, 0, sw, sh)
  const img = ctx.getImageData(0, 0, sw, sh)
  const d = img.data, n = d.length, pixels = sw * sh

  // Auto-levels per channel — 1% clip
  const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)]
  for (let i = 0; i < n; i += 4) { hist[0][d[i]]++; hist[1][d[i+1]]++; hist[2][d[i+2]]++ }
  const lo = [0,0,0], hi = [255,255,255]
  for (let ch = 0; ch < 3; ch++) {
    let cnt = 0
    for (let v = 0; v < 256; v++) { cnt += hist[ch][v]; if (cnt >= pixels * 0.01) { lo[ch] = v; break } }
    cnt = 0
    for (let v = 255; v >= 0; v--) { cnt += hist[ch][v]; if (cnt >= pixels * 0.01) { hi[ch] = v; break } }
    if (hi[ch] <= lo[ch]) { lo[ch] = 0; hi[ch] = 255 }
  }

  // Build LUT with stronger S-curve for print/spine contrast
  const lut = [new Uint8Array(256), new Uint8Array(256), new Uint8Array(256)]
  for (let ch = 0; ch < 3; ch++) {
    for (let v = 0; v < 256; v++) {
      let t = (v - lo[ch]) / (hi[ch] - lo[ch])
      t = Math.max(0, Math.min(1, t))
      t = t < 0.5 ? t + t * (1 - t) * 0.6 : t + (t - 1) * t * (-0.6)
      lut[ch][v] = Math.round(t * 255)
    }
  }
  for (let i = 0; i < n; i += 4) {
    d[i] = lut[0][d[i]]; d[i+1] = lut[1][d[i+1]]; d[i+2] = lut[2][d[i+2]]
  }
  ctx.putImageData(img, 0, 0)

  // Unsharp mask — sharpens text detail
  const after = ctx.getImageData(0, 0, sw, sh)
  const sd = after.data
  const blur = new Uint8ClampedArray(n)
  for (let y = 1; y < sh - 1; y++) {
    for (let x = 1; x < sw - 1; x++) {
      const base = (y * sw + x) * 4
      for (let ch = 0; ch < 3; ch++) {
        let s = 0
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += sd[((y+dy)*sw+(x+dx))*4+ch]
        blur[base+ch] = Math.round(s / 9)
      }
    }
  }
  const amount = 0.6
  for (let i = 0; i < n; i += 4) {
    for (let ch = 0; ch < 3; ch++) {
      sd[i+ch] = Math.max(0, Math.min(255, Math.round(sd[i+ch] + amount * (sd[i+ch] - blur[i+ch]))))
    }
  }
  ctx.putImageData(after, 0, 0)
  return c.toDataURL('image/jpeg', 0.96)
}

function cropAndScan(full: HTMLCanvasElement, lFrac: number, rFrac: number, tFrac: number, bFrac: number): string {
  const fw = full.width, fh = full.height
  const x = Math.round(lFrac * fw)
  const y = Math.round(tFrac * fh)
  const w = Math.max(10, Math.round((rFrac - lFrac) * fw))
  const h = Math.max(10, Math.round((bFrac - tFrac) * fh))
  const dst = document.createElement('canvas')
  dst.width = w; dst.height = h
  dst.getContext('2d')!.drawImage(full, x, y, w, h, 0, 0, w, h)
  return applyDocumentScan(dst)
}

// ─── Types ───────────────────────────────────────────────────────────────────
type Handle = 'tl' | 'tr' | 'bl' | 'br' | 'none'

interface CropRect { l: number; r: number; t: number; b: number }

export default function SpineCaptureCamera({ bookTitle, onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const analysisRef = useRef<HTMLCanvasElement | null>(null)
  const fullFrameRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number>(0)
  const smoothedLR = useRef<{ left: number; right: number } | null>(null)
  const confidenceRef = useRef(0)
  const cropContainerRef = useRef<HTMLDivElement>(null)
  const activeHandle = useRef<Handle>('none')
  const dragStart = useRef<{ x: number; y: number; crop: CropRect } | null>(null)

  const [ready, setReady] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [detected, setDetected] = useState(false)
  const [useManual, setUseManual] = useState(false)
  const [manualL, setManualL] = useState(0.25)
  const [manualR, setManualR] = useState(0.75)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [showCropMode, setShowCropMode] = useState(false)
  const [crop, setCrop] = useState<CropRect>({ l: 0, r: 1, t: 0, b: 1 })
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    let stream: MediaStream | null = null
    const analysis = document.createElement('canvas')
    analysis.width = AW; analysis.height = AH
    analysisRef.current = analysis
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } })
      .then(s => {
        stream = s
        if (videoRef.current) {
          videoRef.current.srcObject = s
          videoRef.current.onloadedmetadata = () => setReady(true)
        }
      })
      .catch(e => setCameraError(e.message ?? 'Camera unavailable'))
    return () => { stream?.getTracks().forEach(t => t.stop()); cancelAnimationFrame(rafRef.current) }
  }, [])

  useEffect(() => {
    if (!ready || previewUrl) return
    const actx = analysisRef.current!.getContext('2d')!
    let lastDetect = 0

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop)
      const video = videoRef.current
      const canvas = overlayRef.current
      if (!video || !canvas || !video.videoWidth) return

      if (canvas.width !== canvas.offsetWidth || canvas.height !== canvas.offsetHeight) {
        canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight
      }
      const ctx = canvas.getContext('2d')!
      const CW = canvas.width, CH = canvas.height
      ctx.clearRect(0, 0, CW, CH)

      const vw = video.videoWidth, vh = video.videoHeight
      const videoAR = vw / vh, displayAR = CW / CH
      let scaleX: number, offX: number, offY: number
      if (videoAR > displayAR) {
        scaleX = CH / vh; offX = (CW - vw * scaleX) / 2; offY = 0
      } else {
        scaleX = CW / vw; offX = 0; offY = (CH - vh * scaleX) / 2
      }

      const now = performance.now()
      if (!useManual && now - lastDetect > 80) {
        lastDetect = now
        actx.drawImage(video, 0, 0, AW, AH)
        const { data } = actx.getImageData(0, 0, AW, AH)
        const raw = detectLR(data, AW, AH)
        if (raw) {
          confidenceRef.current = Math.min(confidenceRef.current + 1, 20)
          smoothedLR.current = smoothedLR.current ? {
            left:  EMA_ALPHA * raw.left  + (1 - EMA_ALPHA) * smoothedLR.current.left,
            right: EMA_ALPHA * raw.right + (1 - EMA_ALPHA) * smoothedLR.current.right,
          } : raw
        } else {
          confidenceRef.current = Math.max(0, confidenceRef.current - 1)
        }
        setDetected(confidenceRef.current >= CONFIDENCE_THRESH)
      }

      const lr = useManual ? { left: manualL, right: manualR }
        : (smoothedLR.current && confidenceRef.current >= CONFIDENCE_THRESH ? smoothedLR.current
        : { left: 0.32, right: 0.68 })

      const L = lr.left * vw * scaleX + offX
      const R = lr.right * vw * scaleX + offX
      const T = offY + 0.005 * vh * scaleX
      const B = CH - offY - 0.005 * vh * scaleX

      ctx.fillStyle = 'rgba(0,0,0,0.52)'
      ctx.fillRect(0, 0, CW, T); ctx.fillRect(0, B, CW, CH - B)
      ctx.fillRect(0, T, L, B - T); ctx.fillRect(R, T, CW - R, B - T)
      ctx.strokeStyle = 'rgba(255,255,255,0.88)'; ctx.lineWidth = 1.5
      ctx.strokeRect(L, T, R - L, B - T)
      const A = 22
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.lineCap = 'square'
      ctx.beginPath()
      ctx.moveTo(L, T+A); ctx.lineTo(L, T); ctx.lineTo(L+A, T)
      ctx.moveTo(R-A, T); ctx.lineTo(R, T); ctx.lineTo(R, T+A)
      ctx.moveTo(L, B-A); ctx.lineTo(L, B); ctx.lineTo(L+A, B)
      ctx.moveTo(R-A, B); ctx.lineTo(R, B); ctx.lineTo(R, B-A)
      ctx.stroke()

      const label = useManual ? 'Manual crop'
        : confidenceRef.current >= CONFIDENCE_THRESH ? '✓ Spine detected'
        : 'Align spine within guides'
      ctx.font = '600 11px -apple-system,system-ui'; ctx.textAlign = 'center'
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.fillText(label, CW / 2, CH / 2)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [ready, useManual, manualL, manualR, previewUrl])

  const capture = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const vw = video.videoWidth, vh = video.videoHeight

    const full = document.createElement('canvas')
    full.width = vw; full.height = vh
    full.getContext('2d')!.drawImage(video, 0, 0)
    fullFrameRef.current = full

    const lr = useManual ? { left: manualL, right: manualR }
      : (smoothedLR.current && confidenceRef.current >= CONFIDENCE_THRESH ? smoothedLR.current
      : { left: 0.32, right: 0.68 })

    const dispW = video.offsetWidth, dispH = video.offsetHeight
    const videoAR = vw / vh, displayAR = dispW / dispH
    let visVW = vw, visVH = vh, offVX = 0, offVY = 0
    if (videoAR > displayAR) {
      const scale = dispH / vh; visVW = dispW / scale; offVX = (vw - visVW) / 2
    } else {
      const scale = dispW / vw; visVH = dispH / scale; offVY = (vh - visVH) / 2
    }

    const initCrop: CropRect = {
      l: (offVX + lr.left * visVW) / vw,
      r: (offVX + lr.right * visVW) / vw,
      t: offVY / vh,
      b: (offVY + visVH) / vh,
    }
    setCrop(initCrop)
    setShowCropMode(false)
    setPreviewUrl(cropAndScan(full, initCrop.l, initCrop.r, initCrop.t, initCrop.b))
  }

  // ── Touch/pointer drag handlers for crop rectangle ────────────────────────
  const onHandlePointerDown = useCallback((e: React.PointerEvent, handle: Handle) => {
    e.preventDefault(); e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    activeHandle.current = handle
    dragStart.current = { x: e.clientX, y: e.clientY, crop: { ...crop } }
  }, [crop])

  const onContainerPointerMove = useCallback((e: React.PointerEvent) => {
    if (activeHandle.current === 'none' || !dragStart.current || !cropContainerRef.current) return
    const rect = cropContainerRef.current.getBoundingClientRect()
    const dx = (e.clientX - dragStart.current.x) / rect.width
    const dy = (e.clientY - dragStart.current.y) / rect.height
    const MIN = 0.08
    const base = dragStart.current.crop
    let { l, r, t, b } = base

    if (activeHandle.current === 'tl') {
      l = Math.max(0, Math.min(base.l + dx, base.r - MIN))
      t = Math.max(0, Math.min(base.t + dy, base.b - MIN))
    } else if (activeHandle.current === 'tr') {
      r = Math.min(1, Math.max(base.r + dx, base.l + MIN))
      t = Math.max(0, Math.min(base.t + dy, base.b - MIN))
    } else if (activeHandle.current === 'bl') {
      l = Math.max(0, Math.min(base.l + dx, base.r - MIN))
      b = Math.min(1, Math.max(base.b + dy, base.t + MIN))
    } else if (activeHandle.current === 'br') {
      r = Math.min(1, Math.max(base.r + dx, base.l + MIN))
      b = Math.min(1, Math.max(base.b + dy, base.t + MIN))
    }
    setCrop({ l, r, t, b })
  }, [])

  const onContainerPointerUp = useCallback(() => {
    if (activeHandle.current === 'none' || !fullFrameRef.current) return
    activeHandle.current = 'none'
    dragStart.current = null
    // Re-scan with new crop (debounced via state update)
    setScanning(true)
    const full = fullFrameRef.current
    setCrop(prev => {
      setTimeout(() => {
        setPreviewUrl(cropAndScan(full, prev.l, prev.r, prev.t, prev.b))
        setScanning(false)
      }, 50)
      return prev
    })
  }, [])

  const retake = () => {
    setPreviewUrl(null)
    fullFrameRef.current = null
    setCrop({ l: 0, r: 1, t: 0, b: 1 })
    setShowCropMode(false)
  }

  // ── Preview screen ─────────────────────────────────────────────────────────
  if (previewUrl) {
    const full = fullFrameRef.current

    return (
      <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 500, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '52px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: '-apple-system,system-ui,sans-serif', marginBottom: 3 }}>Preview</div>
            <div style={{ color: '#fff', fontFamily: 'Georgia, serif', fontSize: 16, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bookTitle}</div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.14)', border: 'none', color: '#fff', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>×</button>
        </div>

        {/* Main image area — crop mode or preview mode */}
        {showCropMode && full ? (
          // ── Crop mode: show full frame with draggable handles ───────────────
          <div
            ref={cropContainerRef}
            onPointerMove={onContainerPointerMove}
            onPointerUp={onContainerPointerUp}
            style={{ flex: 1, position: 'relative', minHeight: 0, touchAction: 'none', userSelect: 'none' }}
          >
            {/* Full frame image */}
            <img
              src={(() => {
                if (!full) return ''
                const t = document.createElement('canvas')
                const maxDim = 1200
                const s = Math.min(1, maxDim / Math.max(full.width, full.height))
                t.width = Math.round(full.width * s); t.height = Math.round(full.height * s)
                t.getContext('2d')!.drawImage(full, 0, 0, t.width, t.height)
                return t.toDataURL('image/jpeg', 0.85)
              })()}
              alt="Full frame"
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', opacity: 0.7 }}
            />
            {/* Crop overlay mask */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              {/* Dark outside crop */}
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />
              {/* Bright crop rectangle (poke hole via mix-blend-mode) */}
              <div style={{
                position: 'absolute',
                left: `${crop.l * 100}%`,
                top: `${crop.t * 100}%`,
                right: `${(1 - crop.r) * 100}%`,
                bottom: `${(1 - crop.b) * 100}%`,
                border: '2px solid rgba(255,255,255,0.9)',
                borderRadius: 2,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
                background: 'transparent',
              }} />
            </div>
            {/* Corner handles */}
            {(['tl','tr','bl','br'] as Handle[]).map(h => (
              <div
                key={h}
                onPointerDown={e => onHandlePointerDown(e, h)}
                style={{
                  position: 'absolute',
                  left: (h === 'tl' || h === 'bl') ? `calc(${crop.l * 100}% - 16px)` : `calc(${crop.r * 100}% - 16px)`,
                  top: (h === 'tl' || h === 'tr') ? `calc(${crop.t * 100}% - 16px)` : `calc(${crop.b * 100}% - 16px)`,
                  width: 32, height: 32,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'grab', zIndex: 10, touchAction: 'none',
                }}
              >
                <div style={{
                  width: 16, height: 16, borderRadius: '50%',
                  background: '#fff',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
                }} />
              </div>
            ))}
            {/* Instructions */}
            <div style={{
              position: 'absolute', bottom: 12, left: 0, right: 0,
              textAlign: 'center', fontSize: 11,
              color: 'rgba(255,255,255,0.5)',
              fontFamily: '-apple-system,system-ui,sans-serif',
              pointerEvents: 'none',
            }}>
              Drag the white handles to adjust the crop
            </div>
          </div>
        ) : (
          // ── Scanned preview ────────────────────────────────────────────────
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#060606', position: 'relative', minHeight: 0 }}>
            <div style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 0' }}>
              <div style={{ position: 'absolute', width: 90, top: 0, bottom: 0, background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
              <img
                src={previewUrl}
                alt="Spine preview"
                draggable={false}
                style={{
                  height: '100%',
                  maxHeight: 'calc(100vh - 290px)',
                  maxWidth: '72vw',
                  objectFit: 'contain',
                  borderRadius: 3,
                  display: 'block',
                  position: 'relative',
                  boxShadow: '6px 0 16px rgba(0,0,0,0.7), -2px 0 8px rgba(0,0,0,0.4)',
                  opacity: scanning ? 0.5 : 1,
                  transition: 'opacity 0.15s',
                }}
              />
            </div>
          </div>
        )}

        {/* Bottom bar */}
        <div style={{ flexShrink: 0, background: 'rgba(0,0,0,0.92)', padding: '14px 20px', paddingBottom: 'calc(14px + env(safe-area-inset-bottom,0px))' }}>
          {!showCropMode && (
            <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginBottom: 12, fontFamily: '-apple-system,system-ui,sans-serif' }}>
              {scanning ? 'Re-scanning…' : 'Scan applied · looks good?'}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={retake} style={{ flex: 1, padding: '13px 0', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 12, fontSize: 15, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontFamily: '-apple-system,system-ui,sans-serif' }}>Retake</button>
            {showCropMode ? (
              <button onClick={() => {
                setShowCropMode(false)
                if (fullFrameRef.current) {
                  setScanning(true)
                  setPreviewUrl(cropAndScan(fullFrameRef.current, crop.l, crop.r, crop.t, crop.b))
                  setScanning(false)
                }
              }} style={{ flex: 2, padding: '13px 0', background: '#fff', border: 'none', borderRadius: 12, fontSize: 15, color: '#000', fontWeight: 600, cursor: 'pointer', fontFamily: '-apple-system,system-ui,sans-serif' }}>Apply Crop</button>
            ) : (
              <>
                <button onClick={() => setShowCropMode(true)} style={{ flex: 1, padding: '13px 0', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 12, fontSize: 15, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontFamily: '-apple-system,system-ui,sans-serif' }}>✂ Crop</button>
                <button onClick={() => onCapture(previewUrl)} style={{ flex: 2, padding: '13px 0', background: '#fff', border: 'none', borderRadius: 12, fontSize: 15, color: '#000', fontWeight: 600, cursor: 'pointer', fontFamily: '-apple-system,system-ui,sans-serif' }}>Use Photo</button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Camera screen ──────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 500, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '52px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: '-apple-system,system-ui,sans-serif', marginBottom: 3 }}>Spine Photo</div>
          <div style={{ color: '#fff', fontFamily: 'Georgia, serif', fontSize: 16, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bookTitle}</div>
        </div>
        <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.14)', border: 'none', color: '#fff', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>×</button>
      </div>

      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {cameraError ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 32px' }}>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', lineHeight: 1.7, margin: 0 }}>
              Camera access denied.<br />Allow camera in Settings.
            </p>
          </div>
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <canvas ref={overlayRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
          </>
        )}
      </div>

      <div style={{ flexShrink: 0, background: 'rgba(0,0,0,0.88)', padding: '14px 20px', paddingBottom: 'calc(14px + env(safe-area-inset-bottom,0px))' }}>
        <div style={{ marginBottom: 12 }}>
          <button
            onClick={() => { setUseManual(m => !m); confidenceRef.current = 0; smoothedLR.current = null; setDetected(false) }}
            style={{ background: 'none', border: '1px solid rgba(255,255,255,0.22)', borderRadius: 8, color: 'rgba(255,255,255,0.6)', fontSize: 11, padding: '5px 12px', cursor: 'pointer', fontFamily: '-apple-system,system-ui,sans-serif', marginBottom: useManual ? 12 : 0 }}
          >{useManual ? 'Switch to auto-detect' : 'Adjust manually'}</button>

          {useManual && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, width: 28, fontFamily: '-apple-system,system-ui,sans-serif' }}>Left</span>
                <input type="range" min={0} max={0.6} step={0.01} value={manualL}
                  onChange={e => setManualL(Math.min(Number(e.target.value), manualR - 0.08))}
                  style={{ flex: 1, accentColor: '#fff' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, width: 28, fontFamily: '-apple-system,system-ui,sans-serif' }}>Right</span>
                <input type="range" min={0.4} max={1} step={0.01} value={manualR}
                  onChange={e => setManualR(Math.max(Number(e.target.value), manualL + 0.08))}
                  style={{ flex: 1, accentColor: '#fff' }} />
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '13px 0', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 12, fontSize: 15, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontFamily: '-apple-system,system-ui,sans-serif' }}>Cancel</button>
          <button
            onClick={capture}
            disabled={!ready || !!cameraError}
            style={{ flex: 2, padding: '13px 0', background: '#fff', border: 'none', borderRadius: 12, fontSize: 15, color: '#000', fontWeight: 600, cursor: (ready && !cameraError) ? 'pointer' : 'default', opacity: (ready && !cameraError) ? 1 : 0.38, fontFamily: '-apple-system,system-ui,sans-serif' }}
          >
            {detected && !useManual ? '✓ Capture Spine' : 'Capture'}
          </button>
        </div>
      </div>
    </div>
  )
}
