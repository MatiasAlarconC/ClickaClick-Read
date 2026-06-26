import { useEffect, useRef, useState } from 'react'

interface Props {
  bookTitle: string
  onCapture: (dataUrl: string) => void
  onClose: () => void
}

const AW = 160
const AH = 284
const EMA_ALPHA = 0.12
const CONFIDENCE_THRESH = 5

// Left/right edge detection only — top/bottom always full height
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

// Document scan: auto-levels per channel + S-curve contrast
function applyDocumentScan(src: HTMLCanvasElement): string {
  const MAX = 1400
  let sw = src.width, sh = src.height
  if (sh > MAX) { const s = MAX / sh; sw = Math.round(sw * s); sh = MAX }
  const c = document.createElement('canvas')
  c.width = sw; c.height = sh
  const ctx = c.getContext('2d')!
  ctx.drawImage(src, 0, 0, sw, sh)
  const img = ctx.getImageData(0, 0, sw, sh)
  const d = img.data, n = d.length, pixels = sw * sh
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
  for (let i = 0; i < n; i += 4) {
    for (let ch = 0; ch < 3; ch++) {
      let v = (d[i+ch] - lo[ch]) / (hi[ch] - lo[ch])
      v = Math.max(0, Math.min(1, v))
      v = v < 0.5 ? 2*v*v : 1 - Math.pow(-2*v+2, 2) / 2
      d[i+ch] = Math.round(v * 255)
    }
  }
  ctx.putImageData(img, 0, 0)
  return c.toDataURL('image/jpeg', 0.90)
}

export default function SpineCaptureCamera({ bookTitle, onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const analysisRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number>(0)
  const smoothedLR = useRef<{ left: number; right: number } | null>(null)
  const confidenceRef = useRef(0)

  const [ready, setReady] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [detected, setDetected] = useState(false)
  const [useManual, setUseManual] = useState(false)
  const [manualL, setManualL] = useState(0.25)
  const [manualR, setManualR] = useState(0.75)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    let stream: MediaStream | null = null
    const analysis = document.createElement('canvas')
    analysis.width = AW; analysis.height = AH
    analysisRef.current = analysis
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1080 }, height: { ideal: 1920 } } })
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

      // Compute objectFit:cover scale so guide lines match what the camera shows
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

      // Map video fractions → display pixels (accounts for objectFit:cover)
      const L = lr.left * vw * scaleX + offX
      const R = lr.right * vw * scaleX + offX
      const T = offY + 0.005 * vh * scaleX
      const B = CH - offY - 0.005 * vh * scaleX

      ctx.fillStyle = 'rgba(0,0,0,0.52)'
      ctx.fillRect(0, 0, CW, T)
      ctx.fillRect(0, B, CW, CH - B)
      ctx.fillRect(0, T, L, B - T)
      ctx.fillRect(R, T, CW - R, B - T)

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

    const lr = useManual ? { left: manualL, right: manualR }
      : (smoothedLR.current && confidenceRef.current >= CONFIDENCE_THRESH ? smoothedLR.current
      : { left: 0.32, right: 0.68 })

    // Determine visible region of video (objectFit:cover)
    const dispW = video.offsetWidth, dispH = video.offsetHeight
    const videoAR = vw / vh, displayAR = dispW / dispH
    let visVW = vw, visVH = vh, offVX = 0, offVY = 0
    if (videoAR > displayAR) {
      const scale = dispH / vh
      visVW = dispW / scale
      offVX = (vw - visVW) / 2
    } else {
      const scale = dispW / vw
      visVH = dispH / scale
      offVY = (vh - visVH) / 2
    }

    const cropX = Math.floor(offVX + lr.left * visVW)
    const cropW = Math.max(10, Math.floor((lr.right - lr.left) * visVW))
    const cropY = Math.floor(offVY + 0.005 * visVH)
    const cropH = Math.max(10, Math.floor(0.99 * visVH))

    const src = document.createElement('canvas')
    src.width = vw; src.height = vh
    src.getContext('2d')!.drawImage(video, 0, 0)

    const dst = document.createElement('canvas')
    dst.width = cropW; dst.height = cropH
    dst.getContext('2d')!.drawImage(src, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)

    setPreviewUrl(applyDocumentScan(dst))
  }

  // ── Preview screen ────────────────────────────────────────────────────────────
  if (previewUrl) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 500, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '52px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: '-apple-system,system-ui,sans-serif', marginBottom: 3 }}>Preview</div>
            <div style={{ color: '#fff', fontFamily: 'Georgia, serif', fontSize: 16, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bookTitle}</div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.14)', border: 'none', color: '#fff', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080808', padding: '0 30px' }}>
          {/* Shadow layers for depth */}
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', inset: -8, background: 'rgba(0,0,0,0.4)', borderRadius: 6, filter: 'blur(12px)' }} />
            <img
              src={previewUrl}
              alt="Spine preview"
              draggable={false}
              style={{
                position: 'relative',
                maxWidth: '52%',
                maxHeight: 'calc(100vh - 220px)',
                objectFit: 'contain',
                borderRadius: 3,
                display: 'block',
                boxShadow: '4px 4px 0 rgba(0,0,0,0.6), 8px 8px 0 rgba(0,0,0,0.3)',
              }}
            />
          </div>
        </div>

        <div style={{ flexShrink: 0, background: 'rgba(0,0,0,0.88)', padding: '14px 20px', paddingBottom: 'calc(14px + env(safe-area-inset-bottom,0px))' }}>
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: 12, fontFamily: '-apple-system,system-ui,sans-serif' }}>
            Scan effect applied · looks good?
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setPreviewUrl(null)} style={{ flex: 1, padding: '13px 0', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 12, fontSize: 15, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontFamily: '-apple-system,system-ui,sans-serif' }}>Retake</button>
            <button onClick={() => onCapture(previewUrl)} style={{ flex: 2, padding: '13px 0', background: '#fff', border: 'none', borderRadius: 12, fontSize: 15, color: '#000', fontWeight: 600, cursor: 'pointer', fontFamily: '-apple-system,system-ui,sans-serif' }}>Use Photo</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Camera screen ─────────────────────────────────────────────────────────────
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
