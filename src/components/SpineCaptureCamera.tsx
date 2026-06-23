import { useEffect, useRef, useState } from 'react'

interface Props {
  bookTitle: string
  onCapture: (dataUrl: string) => void
  onClose: () => void
}

const AW = 160  // analysis canvas width
const AH = 240  // analysis canvas height
const EMA_ALPHA = 0.12  // smoothing — lower = smoother / slower to react
const CONFIDENCE_THRESH = 6  // frames of consistent detection needed

interface Bounds { left: number; right: number; top: number; bottom: number }

// ─── Edge detection ───────────────────────────────────────────────────────────
function detectBounds(data: Uint8ClampedArray, w: number, h: number): Bounds | null {
  const colMag = new Float32Array(w)
  const rowMag = new Float32Array(h)

  const gray = (px: number, py: number) => {
    const i = (py * w + px) * 4
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const gx = Math.abs(
        -gray(x-1,y-1) + gray(x+1,y-1) - 2*gray(x-1,y) + 2*gray(x+1,y) - gray(x-1,y+1) + gray(x+1,y+1)
      )
      const gy = Math.abs(
        -gray(x-1,y-1) - 2*gray(x,y-1) - gray(x+1,y-1) + gray(x-1,y+1) + 2*gray(x,y+1) + gray(x+1,y+1)
      )
      colMag[x] += gx
      rowMag[y] += gy
    }
  }

  // ── Left/right edges (strongest column pair) ──────────────────────────────
  let p1x = 1
  for (let x = 2; x < w - 2; x++) if (colMag[x] > colMag[p1x]) p1x = x

  const maxCol = colMag[p1x]
  if (maxCol < 1800) return null  // insufficient contrast

  let p2x = -1
  for (let x = 2; x < w - 2; x++) {
    const sep = Math.abs(x - p1x)
    if (sep < 10 || sep > 110) continue
    if (colMag[x] < maxCol * 0.22) continue
    if (p2x === -1 || colMag[x] > colMag[p2x]) p2x = x
  }
  if (p2x === -1) return null

  const leftFrac = Math.min(p1x, p2x) / w
  const rightFrac = Math.max(p1x, p2x) / w
  const spineWidth = rightFrac - leftFrac
  if (spineWidth < 0.06 || spineWidth > 0.72) return null

  // ── Top/bottom edges (strongest row pair within spine column range) ───────
  const colL = Math.floor(Math.min(p1x, p2x))
  const colR = Math.ceil(Math.max(p1x, p2x))
  const spineRow = new Float32Array(h)
  for (let y = 1; y < h - 1; y++) {
    for (let x = Math.max(1, colL); x <= Math.min(w - 2, colR); x++) {
      spineRow[y] += Math.abs(
        -gray(x-1,y-1) - 2*gray(x,y-1) - gray(x+1,y-1) + gray(x-1,y+1) + 2*gray(x,y+1) + gray(x+1,y+1)
      )
    }
  }

  let topY = 1
  for (let y = 2; y < Math.floor(h * 0.55); y++) if (spineRow[y] > spineRow[topY]) topY = y
  let botY = h - 2
  for (let y = Math.floor(h * 0.45); y < h - 2; y++) if (spineRow[y] > spineRow[botY]) botY = y

  const maxRow = Math.max(spineRow[topY], spineRow[botY])
  const topFrac = spineRow[topY] > maxRow * 0.28 ? topY / h : 0.04
  const botFrac = spineRow[botY] > maxRow * 0.28 ? botY / h : 0.96

  return {
    left: leftFrac,
    right: rightFrac,
    top: Math.max(0.02, topFrac),
    bottom: Math.min(0.98, botFrac),
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function SpineCaptureCamera({ bookTitle, onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const analysisRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number>(0)

  // EMA-smoothed detection state (in refs to avoid triggering re-renders in the rAF loop)
  const smoothedRef = useRef<Bounds | null>(null)
  const confidenceRef = useRef(0)

  const [ready, setReady] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [detected, setDetected] = useState(false)
  const [useManual, setUseManual] = useState(false)
  const [manualL, setManualL] = useState(0.22)
  const [manualR, setManualR] = useState(0.78)

  // ─── Camera init ────────────────────────────────────────────────────────────
  useEffect(() => {
    let stream: MediaStream | null = null
    const analysis = document.createElement('canvas')
    analysis.width = AW; analysis.height = AH
    analysisRef.current = analysis

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } })
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

  // ─── Detection + overlay loop ───────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return

    const actx = analysisRef.current!.getContext('2d')!
    let lastDetect = 0

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop)

      const video = videoRef.current
      const canvas = overlayRef.current
      if (!video || !canvas) return

      // Resize overlay canvas to match its display size
      if (canvas.width !== canvas.offsetWidth || canvas.height !== canvas.offsetHeight) {
        canvas.width = canvas.offsetWidth
        canvas.height = canvas.offsetHeight
      }
      const ctx = canvas.getContext('2d')!
      const CW = canvas.width, CH = canvas.height
      ctx.clearRect(0, 0, CW, CH)

      // ── Run detection every ~80 ms ──
      const now = performance.now()
      if (!useManual && now - lastDetect > 80) {
        lastDetect = now
        actx.drawImage(video, 0, 0, AW, AH)
        const { data } = actx.getImageData(0, 0, AW, AH)
        const raw = detectBounds(data, AW, AH)

        if (raw) {
          confidenceRef.current = Math.min(confidenceRef.current + 1, 20)
          // EMA smoothing
          if (!smoothedRef.current) {
            smoothedRef.current = raw
          } else {
            smoothedRef.current = {
              left:   EMA_ALPHA * raw.left   + (1 - EMA_ALPHA) * smoothedRef.current.left,
              right:  EMA_ALPHA * raw.right  + (1 - EMA_ALPHA) * smoothedRef.current.right,
              top:    EMA_ALPHA * raw.top    + (1 - EMA_ALPHA) * smoothedRef.current.top,
              bottom: EMA_ALPHA * raw.bottom + (1 - EMA_ALPHA) * smoothedRef.current.bottom,
            }
          }
        } else {
          confidenceRef.current = Math.max(0, confidenceRef.current - 1)
        }

        setDetected(confidenceRef.current >= CONFIDENCE_THRESH)
      }

      // ── Determine crop box ──
      let box: Bounds
      if (useManual) {
        box = { left: manualL, right: manualR, top: 0.04, bottom: 0.96 }
      } else if (smoothedRef.current && confidenceRef.current >= CONFIDENCE_THRESH) {
        box = smoothedRef.current
      } else {
        // Default guide: narrow center strip
        box = { left: 0.32, right: 0.68, top: 0.04, bottom: 0.96 }
      }

      const L = box.left * CW, R = box.right * CW
      const T = box.top * CH, B = box.bottom * CH

      // ── Dim outside the crop rectangle ──
      ctx.fillStyle = 'rgba(0,0,0,0.52)'
      ctx.fillRect(0, 0, CW, T)           // top
      ctx.fillRect(0, B, CW, CH - B)      // bottom
      ctx.fillRect(0, T, L, B - T)        // left strip
      ctx.fillRect(R, T, CW - R, B - T)   // right strip

      // ── White crop rectangle ──
      ctx.strokeStyle = 'rgba(255,255,255,0.88)'
      ctx.lineWidth = 1.5
      ctx.strokeRect(L, T, R - L, B - T)

      // ── Corner accents ──
      const A = 22
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2.5
      ctx.lineCap = 'square'
      ctx.beginPath()
      ctx.moveTo(L, T + A); ctx.lineTo(L, T); ctx.lineTo(L + A, T)
      ctx.moveTo(R - A, T); ctx.lineTo(R, T); ctx.lineTo(R, T + A)
      ctx.moveTo(L, B - A); ctx.lineTo(L, B); ctx.lineTo(L + A, B)
      ctx.moveTo(R - A, B); ctx.lineTo(R, B); ctx.lineTo(R, B - A)
      ctx.stroke()

      // ── Status label ──
      ctx.font = '600 11px -apple-system,system-ui'
      ctx.textAlign = 'center'
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      const label = useManual ? 'Manual crop' : (confidenceRef.current >= CONFIDENCE_THRESH ? 'Spine detected' : 'Position spine in frame')
      ctx.fillText(label, CW / 2, Math.min(T - 8, CH - 8) < 12 ? 20 : T - 8)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [ready, useManual, manualL, manualR])

  // ─── Capture ─────────────────────────────────────────────────────────────────
  const capture = () => {
    const video = videoRef.current
    if (!video) return

    let box: Bounds
    if (useManual) {
      box = { left: manualL, right: manualR, top: 0.04, bottom: 0.96 }
    } else if (smoothedRef.current && confidenceRef.current >= CONFIDENCE_THRESH) {
      box = smoothedRef.current
    } else {
      box = { left: 0.32, right: 0.68, top: 0.04, bottom: 0.96 }
    }

    const vw = video.videoWidth || 1280
    const vh = video.videoHeight || 720
    const src = document.createElement('canvas')
    src.width = vw; src.height = vh
    src.getContext('2d')!.drawImage(video, 0, 0)

    const cropX = Math.floor(box.left * vw)
    const cropW = Math.max(20, Math.floor((box.right - box.left) * vw))
    const cropY = Math.floor(box.top * vh)
    const cropH = Math.max(20, Math.floor((box.bottom - box.top) * vh))

    const dst = document.createElement('canvas')
    dst.width = cropW; dst.height = cropH
    dst.getContext('2d')!.drawImage(src, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)

    onCapture(dst.toDataURL('image/jpeg', 0.88))
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 500, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '52px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: '-apple-system,system-ui,sans-serif', marginBottom: 3 }}>Spine Photo</div>
          <div style={{ color: '#fff', fontFamily: 'Georgia, serif', fontSize: 16, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bookTitle}</div>
        </div>
        <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.14)', border: 'none', color: '#fff', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>×</button>
      </div>

      {/* Camera area */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {cameraError ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px', gap: 12 }}>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', lineHeight: 1.7, margin: 0 }}>
              Camera access denied or unavailable.<br />Allow camera access in Settings.
            </p>
          </div>
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <canvas ref={overlayRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
          </>
        )}
      </div>

      {/* Controls */}
      <div style={{ flexShrink: 0, background: 'rgba(0,0,0,0.88)', padding: '14px 20px', paddingBottom: 'calc(14px + env(safe-area-inset-bottom,0px))' }}>
        <div style={{ marginBottom: 12 }}>
          <button
            onClick={() => { setUseManual(m => !m); confidenceRef.current = 0; smoothedRef.current = null; setDetected(false) }}
            style={{ background: 'none', border: '1px solid rgba(255,255,255,0.22)', borderRadius: 8, color: 'rgba(255,255,255,0.6)', fontSize: 11, padding: '5px 12px', cursor: 'pointer', fontFamily: '-apple-system,system-ui,sans-serif', marginBottom: useManual ? 12 : 0 }}
          >
            {useManual ? 'Switch to auto-detect' : 'Adjust manually'}
          </button>

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
            {detected && !useManual ? 'Capture Spine' : 'Capture'}
          </button>
        </div>
      </div>
    </div>
  )
}
