import React, { useEffect, useRef } from 'react'

export type TransitionType = 'station_complete' | 'overload_dropset' | 'new_record_pr' | 'session_complete_duo'

export interface TransitionEventPayload {
  id: TransitionType
  videoUrl: string
  badge: string
  title: string
  subtitle: string
  accentHex: string
}

export const TRANSITION_CATALOG: Record<TransitionType, Omit<TransitionEventPayload, 'subtitle'>> = {
  station_complete: {
    id: 'station_complete',
    videoUrl: '/animations/01-station-complete.mp4',
    badge: 'ESTACIÓN COMPLETADA',
    title: '¡ESTACIÓN DOMINADA!',
    accentHex: '#10B981'
  },
  overload_dropset: {
    id: 'overload_dropset',
    videoUrl: '/animations/02-overload-dropset.mp4',
    badge: 'ALTA INTENSIDAD • DROPSET / FALLO',
    title: '¡SOBRECARGA COMPLETADA!',
    accentHex: '#FF5500'
  },
  new_record_pr: {
    id: 'new_record_pr',
    videoUrl: '/animations/03-new-record-pr.mp4',
    badge: 'PROGRESIÓN DE CARGA • PR',
    title: '¡NUEVO RÉCORD DE FUERZA!',
    accentHex: '#F59E0B'
  },
  session_complete_duo: {
    id: 'session_complete_duo',
    videoUrl: '/animations/04-session-complete-duo.mp4',
    badge: 'META DEL DÍA ALCANZADA',
    title: '¡SESIÓN COMPLETADA!',
    accentHex: '#8B5CF6'
  }
}

interface TransitionOverlayProps {
  activeTransition: TransitionEventPayload | null
  onDismiss: () => void
}

/**
 * V1.6-08: Overlay de Transición Animada con Fusión Sin Bordes (mode-blend, mix-blend-mode: lighten),
 * velocidad 1.35x (2.9s fluidos) y Touch-to-Skip instantáneo.
 */
export const TransitionOverlay: React.FC<TransitionOverlayProps> = ({
  activeTransition,
  onDismiss
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (!activeTransition) return
    const v = videoRef.current
    if (v) {
      v.playbackRate = 1.35
      v.currentTime = 0
      v.play().catch(() => {
        // Ignore autoplay restrictions
      })
    }
    const autoCloseTimer = window.setTimeout(() => {
      onDismiss()
    }, 3100)
    return () => window.clearTimeout(autoCloseTimer)
  }, [activeTransition, onDismiss])

  if (!activeTransition) return null

  return (
    <div
      onClick={onDismiss}
      onTouchStart={onDismiss}
      className="fixed inset-0 z-50 bg-[#0B090E]/90 backdrop-blur-md flex flex-col items-center justify-center p-4 cursor-pointer select-none animate-fade-in"
    >
      <div className="relative w-full max-w-[340px] aspect-square flex items-center justify-center">
        <video
          ref={videoRef}
          key={activeTransition.videoUrl}
          src={activeTransition.videoUrl}
          autoPlay
          muted
          playsInline
          onLoadedMetadata={(e) => {
            e.currentTarget.playbackRate = 1.35
          }}
          onEnded={onDismiss}
          className="w-full h-full object-contain kineo-blend-video pointer-events-none"
        />
      </div>

      <div className="text-center space-y-1.5 -mt-2 max-w-sm px-3 pointer-events-none">
        <span
          className="inline-block font-mono text-[10px] font-bold uppercase tracking-[0.12em] px-2.5 py-0.5 rounded border"
          style={{
            color: activeTransition.accentHex,
            borderColor: `${activeTransition.accentHex}66`,
            backgroundColor: `${activeTransition.accentHex}1A`
          }}
        >
          {activeTransition.badge}
        </span>
        <h2 className="font-display text-3xl sm:text-4xl text-white tracking-wide leading-none">
          {activeTransition.title}
        </h2>
        <p className="font-mono text-xs text-[#E2DFEA]">{activeTransition.subtitle}</p>
        <p className="font-mono text-[10px] uppercase tracking-widest text-[#A09BA8] pt-2">
          Toca cualquier parte para continuar ↗
        </p>
      </div>
    </div>
  )
}
