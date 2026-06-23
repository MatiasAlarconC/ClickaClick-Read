import { useEffect, useRef, useState } from 'react'

interface Props {
  bookTitle: string
  onCapture: (dataUrl: string) => void
  onClose: () => void
}

// ─── Edge detection ──────────────────────────────────────────────────────────
const ANALYSIS_W = 160
const ANALYSIS_H = 240

function detectSpineBounds(data: Uint8ClampedArray, w: number, h: number): { left: number; right: number } | null {
  const colMag = new Float32Array(w)

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const g = (px: number, py: number) => {
        const i = (py * w + px) * 4
        return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      }
      // Sobel X (detects vertical edges)
      const gx = Math.abs(
        -g(x - 1, y - 1) + g(x + 1, y - 1)
        - 2 * g(x - 1, y) + 2 * g(x + 1, y)
        - g(x - 1, y + 1) + g(x + 1, y + 1)
      )
      colMag[x] += gx
    }
  }

  // Find the strongest vertical edge (peak1)
  let peak1 = 1
  for (let x = 2; x < w - 2; x++) {
    if (colMag[x] > colMag[peak1]) peak1 = x
  }

  const maxMag = colMag[peak1]
  if (maxMag < 2000) return null // not enough contrast → no reliable detection

  // Find second peak: min 12px separation, max 100px separation, at least 25% of peak1 magnitude
  let peak2 = -1
  for (let x = 2; x < w - 2; x++) {
    const sep = Math.abs(x - peak1)
    if (sep < 12 || sep > 100) continue
    if (colMag[x] < maxMag * 0.25) continue
    if (peak2 === -1 || colMag[x] > colMag[peak2]) peak2 = x
  }

  if (peak2 === -1) return null

  const left = Math.min(peak1, peak2) / w
  const right = Math.max(peak1, peak2) / w

  // Sanity check: spine width should be 8% – 70% of frame
  const width = right - left
  if (width < 0.08 || width > 0.70) return null

  return { left, right }
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function SpineCaptureCamera({ bookTitle, onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const detectedRef = useRef<{ left: number; right: number } | null>(null)

  // Manual guide fallback (fractions of video width)
  const [manualLeft, setManualLeft] = useState(0.22)
  const [manualRight, setManualRight] = useState(0.78)
  const [useManual, setUseManual] = useState(false)

  const [cameraError, setCameraError] = useState('')
  const [ready, setReady] = useState(false)
  const [confidence, setConfidence] = useState(false) // detection found

  // ─── Camera init ──────────────────────────────────────────────────────────
  useEffect(() => {
    let stream: MediaStream | null = null
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

    return () => {
      stream?.getTracks().forEach(t => t.stop())
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // ─── Detection + overlay loop ─────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return

    const analysis = document.createElement('canvas')
    analysis.width = ANALYSIS_W
    analysis.height = ANALYSIS_H
    const actx = analysis.getContext('2d')!

    let lastDetect = 0

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop)

      const video = videoRef.current
      const canvas = overlayRef.current
      if (!video || !canvas) return

      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Run edge detection every ~80ms
      const now = performance.now()
      if (!useManual && now - lastDetect > 80) {
        lastDetect = now
        actx.drawImage(video, 0, 0, ANALYSIS_W, ANALYSIS_H)
        const { data } = actx.getImageData(0, 0, ANALYSIS_W, ANALYSIS_H)
        const bounds = detectSpineBounds(data, ANALYSIS_W, ANALYSIS_H)
        detectedRef.current = bounds
        setConfidence(bounds !== null)
      }

      // Determine crop bounds
      const bounds = (!useManual && detectedRef.current)
        ? detectedRef.current
        : { left: manualLeft, right: manualRight }

      const L = bounds.left * canvas.width
      const R = bounds.right * canvas.width
      const detected = !useManual && detectedRef.current !== null

      // Dim outside crop zone
      ctx.fillStyle = 'rgba(0,0,0,0.52)'
      ctx.fillRect(0, 0, L, canvas.height)
      ctx.fillRect(R, 0, canvas.width - R, canvas.height)

      // Border lines
      ctx.strokeStyle = detected ? 'rgba(74,222,128,0.9)' : 'rgba(255,255,255,0.8)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(L, 0); ctx.lineTo(L, canvas.height)
      ctx.moveTo(R, 0); ctx.lineTo(R, canvas.height)
      ctx.stroke()

      // Corner accents
      const A = 20
      ctx.lineWidth = 3
      const corners: [number, number, number, number][] = [
        [L, 0, 1, 1], [R, 0, -1, 1], [L, canvas.height, 1, -1], [R, canvas.height, -1, -1],
      ]
      ctx.beginPath()
      for (const [x, y, dx, dy] of corners) {
        ctx.moveTo(x, y); ctx.lineTo(x + dx * A, y)
        ctx.moveTo(x, y); ctx.lineTo(x, y + dy * A)
      }
      ctx.stroke()

      // Status label above the crop zone
      ctx.font = '12px -apple-system, system-ui'
      ctx.textAlign = 'center'
      ctx.fillStyle = detected ? 'rgba(74,222,128,0.95)' : 'rgba(255,255,255,0.6)'
      ctx.fillText(detected ? 'Spine detected' : 'Position spine in frame', canvas.width / 2, 20)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [ready, useManual, manualLeft, manualRight])

  // ─── Capture ──────────────────────────────────────────────────────────────
  const capture = () => {
    const video = videoRef.current
    if (!video) return

    const bounds = (!useManual && detectedRef.current)
      ? detectedRef.current
      : { left: manualLeft, right: manualRight }

    const vw = video.videoWidth || 1280
    const vh = video.videoHeight || 720

    // Draw full-res frame
    const src = document.createElement('canvas')
    src.width = vw; src.height = vh
    src.getContext('2d')!.drawImage(video, 0, 0)

    // Crop to spine column, full height
    const cropX = Math.floor(bounds.left * vw)
    const cropW = Math.max(20, Math.floor((bounds.right - bounds.left) * vw))
    const dst = document.createElement('canvas')
    dst.width = cropW; dst.height = vh
    dst.getContext('2d')!.drawImage(src, cropX, 0, cropW, vh, 0, 0, cropW, vh)

    onCapture(dst.toDataURL('image/jpeg', 0.88))
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 500, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '52px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>Spine Photo</div>
          <div style={{ color: '#fff', fontFamily: 'Georgia, serif', fontSize: 16, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bookTitle}</div>
        </div>
        <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.14)', border: 'none', color: '#fff', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>×</button>
      </div>

      {/* Camera */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {cameraError ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px', gap: 12 }}>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', lineHeight: 1.7, margin: 0 }}>
              Camera access denied or unavailable.<br />Allow camera access in Settings and try again.
            </p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            <canvas
              ref={overlayRef}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            />
          </>
        )}
      </div>

      {/* Controls */}
      <div style={{ flexShrink: 0, background: 'rgba(0,0,0,0.85)', padding: '16px 20px', paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}>
        {/* Manual toggle + sliders */}
        <div style={{ marginBottom: 14 }}>
          <button
            onClick={() => { setUseManual(m => !m); setConfidence(false) }}
            style={{ background: 'none', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, color: 'rgba(255,255,255,0.6)', fontSize: 11, padding: '5px 12px', cursor: 'pointer', marginBottom: useManual ? 12 : 0 }}
          >
            {useManual ? 'Switch to auto-detect' : 'Adjust manually'}
          </button>

          {useManual && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, width: 28 }}>Left</span>
                <input
                  type="range" min={0} max={0.6} step={0.01}
                  value={manualLeft}
                  onChange={e => setManualLeft(Math.min(Number(e.target.value), manualRight - 0.08))}
                  style={{ flex: 1, accentColor: '#fff' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, width: 28 }}>Right</span>
                <input
                  type="range" min={0.4} max={1} step={0.01}
                  value={manualRight}
                  onChange={e => setManualRight(Math.max(Number(e.target.value), manualLeft + 0.08))}
                  style={{ flex: 1, accentColor: '#fff' }}
                />
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '13px 0', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 12, fontSize: 15, color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>Cancel</button>
          <button
            onClick={capture}
            disabled={!ready || !!cameraError}
            style={{ flex: 2, padding: '13px 0', background: '#fff', border: 'none', borderRadius: 12, fontSize: 15, color: '#000', fontWeight: 600, cursor: (ready && !cameraError) ? 'pointer' : 'default', opacity: (ready && !cameraError) ? 1 : 0.4 }}
          >
            {confidence && !useManual ? 'Capture Spine' : 'Capture'}
          </button>
        </div>
      </div>
    </div>
  )
}
