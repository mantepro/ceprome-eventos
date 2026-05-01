'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import type { ScanResult } from '@/lib/types/scan'

type Props = {
  eventId: string
  eventName: string
}

type Phase =
  | { id: 'scanning' }
  | { id: 'loading' }
  | { id: 'result'; data: ScanResult }
  | { id: 'camera_error'; message: string }

export function Scanner({ eventId, eventName }: Props) {
  const [phase, setPhase] = useState<Phase>({ id: 'scanning' })

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const jsQRRef = useRef<typeof import('jsqr').default | null>(null)
  const activeRef = useRef(true)
  const rafRef = useRef<number | undefined>(undefined)

  const startLoop = useCallback(() => {
    function tick() {
      if (!activeRef.current || !jsQRRef.current) return

      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas) { rafRef.current = requestAnimationFrame(tick); return }

      if (video.readyState < video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) { rafRef.current = requestAnimationFrame(tick); return }

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const qr = jsQRRef.current(imageData.data, canvas.width, canvas.height, {
        inversionAttempts: 'dontInvert',
      })

      if (qr?.data) {
        activeRef.current = false
        handleToken(qr.data)
        return
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleToken(token: string) {
    setPhase({ id: 'loading' })
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, event_id: eventId }),
      })
      const data: ScanResult = await res.json()
      setPhase({ id: 'result', data })
    } catch {
      setPhase({ id: 'result', data: { result: 'not_found' } })
    }
  }

  const reset = useCallback(() => {
    activeRef.current = true
    setPhase({ id: 'scanning' })
    startLoop()
  }, [startLoop])

  useEffect(() => {
    let stream: MediaStream | undefined

    async function init() {
      const { default: jsQR } = await import('jsqr')
      jsQRRef.current = jsQR

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 } },
        })
      } catch {
        setPhase({ id: 'camera_error', message: 'No se pudo acceder a la cámara. Verifica los permisos del navegador.' })
        return
      }

      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play()
      startLoop()
    }

    init()

    return () => {
      activeRef.current = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [startLoop])

  // Auto-reset 4 s after showing a result
  useEffect(() => {
    if (phase.id === 'result') {
      const timer = setTimeout(reset, 4000)
      return () => clearTimeout(timer)
    }
  }, [phase.id, reset])

  return (
    <div className="relative h-dvh bg-black flex flex-col overflow-hidden">
      {/* Back link */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 pt-4">
        <Link
          href="/scan"
          className="text-white/80 hover:text-white text-sm bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-sm transition-colors"
        >
          ← {eventName}
        </Link>
      </div>

      {/* Camera */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
        autoPlay
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Scanning overlay */}
      {phase.id === 'scanning' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="relative w-64 h-64">
            {/* Dim surround */}
            <div className="absolute inset-0 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]" />
            {/* Corner marks */}
            <div className="absolute inset-0 rounded-lg border-2 border-white/90" />
            <Corner pos="top-0 left-0" />
            <Corner pos="top-0 right-0 rotate-90" />
            <Corner pos="bottom-0 right-0 rotate-180" />
            <Corner pos="bottom-0 left-0 -rotate-90" />
          </div>
          <p className="mt-6 text-white/80 text-sm">Apunta al código QR</p>
        </div>
      )}

      {/* Loading */}
      {phase.id === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/75">
          <div className="text-white text-base font-medium animate-pulse">Verificando…</div>
        </div>
      )}

      {/* Camera error */}
      {phase.id === 'camera_error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black p-8 text-center gap-4">
          <span className="text-5xl">📷</span>
          <p className="text-white font-semibold">{phase.message}</p>
          <Link href="/scan" className="text-sm text-white/60 underline">
            Volver
          </Link>
        </div>
      )}

      {/* Result overlay */}
      {phase.id === 'result' && (
        <ScanResultOverlay data={phase.data} onDismiss={reset} />
      )}
    </div>
  )
}

function Corner({ pos }: { pos: string }) {
  return (
    <div className={`absolute ${pos} w-6 h-6`}>
      <div className="absolute top-0 left-0 w-full h-0.5 bg-white" />
      <div className="absolute top-0 left-0 w-0.5 h-full bg-white" />
    </div>
  )
}

function ScanResultOverlay({
  data,
  onDismiss,
}: {
  data: ScanResult
  onDismiss: () => void
}) {
  const config = resultConfig[data.result]

  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center p-6 ${config.bg}`}
      onClick={onDismiss}
    >
      <div className="text-7xl mb-4">{config.icon}</div>
      <h2 className={`text-2xl font-bold text-center mb-1 ${config.titleColor}`}>
        {config.title}
      </h2>

      {data.attendee && (
        <div className="mt-5 w-full max-w-sm space-y-3">
          <div className={`rounded-2xl p-5 text-center space-y-1 ${config.cardBg}`}>
            <p className={`text-xl font-bold ${config.nameColor}`}>{data.attendee.name}</p>
            <p className={`text-sm ${config.subColor}`}>
              {data.attendee.ticketType} · {data.attendee.folio}
            </p>
          </div>

          {data.attendee.kitStation && (
            <div className="rounded-2xl bg-white/20 p-4 text-center">
              <p className="text-white/80 text-xs font-semibold uppercase tracking-widest mb-1">
                Entregar kit en
              </p>
              <p className="text-white text-3xl font-black">{data.attendee.kitStation}</p>
            </div>
          )}

          {data.result === 'valid_pending_payment' && (
            <p className="text-center text-sm font-semibold text-white bg-blue-800/50 rounded-xl px-4 py-2">
              Pago pendiente — verificar con el asistente
            </p>
          )}

          {data.result === 'already_used' && data.checked_in_at && (
            <p className={`text-center text-sm ${config.subColor}`}>
              Check-in registrado: {new Date(data.checked_in_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      )}

      <button
        onClick={(e) => { e.stopPropagation(); onDismiss() }}
        className={`mt-8 px-8 py-3 rounded-full font-semibold text-sm ${config.btnClass}`}
      >
        Siguiente
      </button>

      <p className="mt-3 text-white/40 text-xs">Toca en cualquier lugar para continuar</p>
    </div>
  )
}

type ResultConfig = {
  bg: string
  icon: string
  title: string
  titleColor: string
  cardBg: string
  nameColor: string
  subColor: string
  btnClass: string
}

const resultConfig: Record<ScanResult['result'], ResultConfig> = {
  valid: {
    bg: 'bg-green-600',
    icon: '✅',
    title: 'ACCESO VÁLIDO',
    titleColor: 'text-white',
    cardBg: 'bg-white/20',
    nameColor: 'text-white',
    subColor: 'text-green-100',
    btnClass: 'bg-white text-green-700 hover:bg-green-50',
  },
  valid_pending_payment: {
    bg: 'bg-blue-600',
    icon: '⚠️',
    title: 'ACCESO VÁLIDO ⚠️',
    titleColor: 'text-white',
    cardBg: 'bg-white/20',
    nameColor: 'text-white',
    subColor: 'text-blue-100',
    btnClass: 'bg-white text-blue-700 hover:bg-blue-50',
  },
  already_used: {
    bg: 'bg-amber-500',
    icon: '🔁',
    title: 'YA REGISTRADO',
    titleColor: 'text-white',
    cardBg: 'bg-white/20',
    nameColor: 'text-white',
    subColor: 'text-amber-100',
    btnClass: 'bg-white text-amber-700 hover:bg-amber-50',
  },
  pending_payment: {
    bg: 'bg-red-600',
    icon: '🚫',
    title: 'PAGO PENDIENTE',
    titleColor: 'text-white',
    cardBg: 'bg-white/20',
    nameColor: 'text-white',
    subColor: 'text-red-100',
    btnClass: 'bg-white text-red-700 hover:bg-red-50',
  },
  cancelled: {
    bg: 'bg-red-700',
    icon: '🚫',
    title: 'TICKET CANCELADO',
    titleColor: 'text-white',
    cardBg: 'bg-white/20',
    nameColor: 'text-white',
    subColor: 'text-red-200',
    btnClass: 'bg-white text-red-700 hover:bg-red-50',
  },
  not_found: {
    bg: 'bg-red-700',
    icon: '❓',
    title: 'NO ENCONTRADO',
    titleColor: 'text-white',
    cardBg: 'bg-white/20',
    nameColor: 'text-white',
    subColor: 'text-red-200',
    btnClass: 'bg-white text-red-700 hover:bg-red-50',
  },
}
