import React, { useEffect, useRef, useState } from 'react'

// BarcodeDetector is not in the TS stdlib — declare it here
interface BarcodeDetectorResult {
  rawValue: string
  format: string
}

declare class BarcodeDetector {
  constructor(options?: { formats: string[] })
  detect(source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap): Promise<BarcodeDetectorResult[]>
  static getSupportedFormats(): Promise<string[]>
}

interface ISBNScannerProps {
  onDetected: (isbn: string) => void
  onClose: () => void
}

export default function ISBNScanner({ onDetected, onClose }: ISBNScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectedRef = useRef(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [supported, setSupported] = useState<boolean | null>(null) // null = checking
  const [manualISBN, setManualISBN] = useState('')
  const [cameraError, setCameraError] = useState<string | null>(null)

  useEffect(() => {
    const check = 'BarcodeDetector' in window
    setSupported(check)

    if (!check) return

    let detector: BarcodeDetector

    const startCamera = async () => {
      try {
        detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8'] })
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        intervalRef.current = setInterval(async () => {
          if (detectedRef.current) return
          if (!videoRef.current) return
          try {
            const results = await detector.detect(videoRef.current)
            for (const r of results) {
              if (/^\d{10,13}$/.test(r.rawValue)) {
                detectedRef.current = true
                cleanup()
                onDetected(r.rawValue)
                return
              }
            }
          } catch {
            // detection failed on this frame, keep trying
          }
        }, 400)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Camera unavailable'
        setCameraError(msg)
      }
    }

    const cleanup = () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    }

    startCamera()
    return cleanup
  }, [onDetected])

  const handleManualGo = () => {
    const trimmed = manualISBN.trim().replace(/[^0-9X]/gi, '')
    if (trimmed.length >= 10) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
      onDetected(trimmed)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, background: '#000',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 16, right: 16, zIndex: 210,
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', backdropFilter: 'blur(8px)',
        }}>
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M1 1L10 10M10 1L1 10" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {/* Title */}
      <div style={{
        position: 'absolute', top: 20, left: 0, right: 0, textAlign: 'center', zIndex: 210,
        fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)', letterSpacing: 0.3,
      }}>
        Scan ISBN Barcode
      </div>

      {/* Camera / Unsupported view */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {supported === null && (
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Checking camera…</div>
        )}

        {supported === false && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 32px', gap: 20 }}>
            {/* Barcode SVG illustration */}
            <svg width="120" height="80" viewBox="0 0 120 80" fill="none">
              {[4,10,16,24,28,36,42,48,56,62,68,76,82,90,96,102,108,114].map((x, i) => (
                <rect key={i} x={x} y={8} width={i % 3 === 0 ? 4 : 2} height={64} fill="rgba(255,255,255,0.7)" rx={1}/>
              ))}
              <rect x={4} y={76} width={112} height={2} fill="rgba(255,255,255,0.2)" rx={1}/>
            </svg>
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 1.6 }}>
              Camera barcode scanning is not supported in this browser.
              <br/>Enter the ISBN manually below.
            </div>
            <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 320 }}>
              <input
                value={manualISBN}
                onChange={e => setManualISBN(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleManualGo()}
                placeholder="ISBN (10 or 13 digits)"
                inputMode="numeric"
                style={{
                  flex: 1, padding: '11px 14px', background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.25)', borderRadius: 10,
                  fontSize: 15, color: '#fff', outline: 'none',
                }}
              />
              <button
                onClick={handleManualGo}
                style={{
                  padding: '11px 16px', background: '#fff', color: '#000',
                  border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}>
                Find Book
              </button>
            </div>
          </div>
        )}

        {supported === true && (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {cameraError ? (
              <div style={{ position: 'relative', zIndex: 5, color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center', padding: '0 32px' }}>
                Camera error: {cameraError}
              </div>
            ) : (
              /* Scan frame overlay */
              <div style={{ position: 'relative', zIndex: 5 }}>
                {/* Dim overlay with cutout effect using box-shadow */}
                <div style={{
                  position: 'fixed', inset: 0, zIndex: 4,
                  background: 'rgba(0,0,0,0.42)',
                  pointerEvents: 'none',
                }} />
                {/* Frame */}
                <div style={{
                  position: 'relative', zIndex: 6,
                  width: 260, height: 160,
                  border: '2px solid rgba(255,255,255,0.9)',
                  borderRadius: 12,
                  overflow: 'hidden',
                  boxShadow: '0 0 0 2000px rgba(0,0,0,0.42)',
                }}>
                  {/* Corner accents */}
                  {[
                    { top: -1, left: -1, borderTop: '3px solid #fff', borderLeft: '3px solid #fff', borderTopLeftRadius: 12 },
                    { top: -1, right: -1, borderTop: '3px solid #fff', borderRight: '3px solid #fff', borderTopRightRadius: 12 },
                    { bottom: -1, left: -1, borderBottom: '3px solid #fff', borderLeft: '3px solid #fff', borderBottomLeftRadius: 12 },
                    { bottom: -1, right: -1, borderBottom: '3px solid #fff', borderRight: '3px solid #fff', borderBottomRightRadius: 12 },
                  ].map((s, i) => (
                    <div key={i} style={{ position: 'absolute', width: 20, height: 20, ...s }} />
                  ))}
                  {/* Animated scan line */}
                  <ScanLine />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom: manual input */}
      {supported !== false && (
        <div style={{
          padding: '20px 24px',
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(12px)',
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: 10, letterSpacing: 0.5 }}>
            OR ENTER ISBN MANUALLY
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              value={manualISBN}
              onChange={e => setManualISBN(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleManualGo()}
              placeholder="ISBN-10 or ISBN-13"
              inputMode="numeric"
              style={{
                flex: 1, padding: '11px 14px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 10, fontSize: 15, color: '#fff', outline: 'none',
              }}
            />
            <button
              onClick={handleManualGo}
              style={{
                padding: '11px 18px', background: '#fff', color: '#000',
                border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>
              Go
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ScanLine() {
  const [pos, setPos] = useState(0)
  const [dir, setDir] = useState(1)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    let p = 0
    let d = 1
    const frame = () => {
      p += d * 1.2
      if (p >= 100) { p = 100; d = -1 }
      if (p <= 0) { p = 0; d = 1 }
      setPos(p)
      setDir(d)
      rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  void dir // suppress unused warning

  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, top: `${pos}%`,
      height: 2,
      background: 'linear-gradient(90deg, transparent, rgba(255,80,80,0.9), transparent)',
      boxShadow: '0 0 6px rgba(255,80,80,0.7)',
      pointerEvents: 'none',
    }} />
  )
}
