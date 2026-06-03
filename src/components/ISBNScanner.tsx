import { useEffect, useRef, useState } from 'react'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — @zxing/browser uses 'typings' not 'types'; works at runtime
import { BrowserMultiFormatReader } from '@zxing/browser'

interface Props {
  onDetected: (isbn: string) => void
  onClose: () => void
}

const SCAN_CSS = `
  @keyframes isbn-scan {
    0%, 100% { top: 8px; opacity: 0.9; }
    50% { top: calc(100% - 10px); opacity: 1; }
  }
`

export default function ISBNScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)
  const doneRef = useRef(false)
  const [started, setStarted] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [manualVal, setManualVal] = useState('')

  useEffect(() => {
    let cancelled = false
    const reader = new BrowserMultiFormatReader()

    async function start() {
      if (!videoRef.current) return
      try {
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
          videoRef.current,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (result: any) => {
            if (!result || doneRef.current || cancelled) return
            const text = result.getText()
            if (/^\d{10,13}$/.test(text)) {
              doneRef.current = true
              controls.stop()
              onDetected(text)
            }
          }
        )
        if (cancelled) { controls.stop(); return }
        controlsRef.current = controls
        setStarted(true)
      } catch (err) {
        if (!cancelled) setCameraError(err instanceof Error ? err.message : 'Camera unavailable')
      }
    }

    start()

    return () => {
      cancelled = true
      doneRef.current = true
      controlsRef.current?.stop()
    }
  }, [onDetected])

  const handleManual = () => {
    const isbn = manualVal.replace(/[-\s]/g, '')
    if (isbn.length >= 10) {
      doneRef.current = true
      controlsRef.current?.stop()
      onDetected(isbn)
    }
  }

  const canGo = manualVal.replace(/[-\s]/g, '').length >= 10

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 300, display: 'flex', flexDirection: 'column' }}>
      <style>{SCAN_CSS}</style>

      {/* Header */}
      <div style={{ padding: '52px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ color: '#fff', fontFamily: 'Georgia, serif', fontSize: 20, letterSpacing: -0.5 }}>Scan ISBN</div>
        <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', lineHeight: 1 }}>×</button>
      </div>

      {/* Camera area */}
      {cameraError ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px', gap: 20 }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5"/>
            <path d="M12 8v5" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="12" cy="16.5" r="0.8" fill="rgba(255,255,255,0.65)"/>
          </svg>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', lineHeight: 1.7, margin: 0 }}>
            Camera access denied or unavailable.<br/>Enter the ISBN from the back cover below.
          </p>
        </div>
      ) : (
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
          <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />

          {/* Frame + dim overlay */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ width: 270, height: 150, position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0, boxShadow: '0 0 0 2000px rgba(0,0,0,0.52)', borderRadius: 10 }} />
              <div style={{ position: 'absolute', inset: 0, border: '2px solid rgba(255,255,255,0.7)', borderRadius: 10 }} />
              {/* Corner accents */}
              {([
                { top: -1, left: -1, borderTop: '3px solid #fff', borderLeft: '3px solid #fff', borderRadius: '10px 0 0 0' },
                { top: -1, right: -1, borderTop: '3px solid #fff', borderRight: '3px solid #fff', borderRadius: '0 10px 0 0' },
                { bottom: -1, left: -1, borderBottom: '3px solid #fff', borderLeft: '3px solid #fff', borderRadius: '0 0 0 10px' },
                { bottom: -1, right: -1, borderBottom: '3px solid #fff', borderRight: '3px solid #fff', borderRadius: '0 0 10px 0' },
              ] as React.CSSProperties[]).map((s, i) => (
                <div key={i} style={{ position: 'absolute', width: 22, height: 22, ...s }} />
              ))}
              {/* Scan line */}
              {started && (
                <div style={{ position: 'absolute', left: 10, right: 10, height: 2, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)', borderRadius: 1, animation: 'isbn-scan 2s ease-in-out infinite', top: 8 }} />
              )}
            </div>
          </div>

          <div style={{ position: 'absolute', bottom: 20, left: 0, right: 0, textAlign: 'center', pointerEvents: 'none' }}>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
              {started ? 'Point at the barcode on the back of the book' : 'Starting camera…'}
            </div>
          </div>
        </div>
      )}

      {/* Manual ISBN input — always visible */}
      <div style={{ padding: '12px 20px', paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))', display: 'flex', gap: 10, background: 'rgba(0,0,0,0.88)', flexShrink: 0 }}>
        <input
          value={manualVal}
          onChange={e => setManualVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleManual()}
          placeholder="Or enter ISBN manually"
          inputMode="numeric"
          style={{ flex: 1, padding: '10px 13px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 9, fontSize: 14, color: '#fff', outline: 'none' }}
        />
        <button onClick={handleManual} disabled={!canGo}
          style={{ padding: '10px 18px', background: '#fff', color: '#000', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: canGo ? 'pointer' : 'default', opacity: canGo ? 1 : 0.32 }}>
          Go
        </button>
      </div>
    </div>
  )
}
