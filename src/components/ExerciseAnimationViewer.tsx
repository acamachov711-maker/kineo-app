import React, { useState, useEffect } from 'react'
import {
  Play,
  Pause,
  Activity,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  Eye
} from 'lucide-react'
import { ExerciseVariant } from '../types'

interface ExerciseAnimationViewerProps {
  variant: ExerciseVariant
  accentColor?: string
  onClose?: () => void
}

const FREE_EXERCISE_DB_BASE =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises'

export const ExerciseAnimationViewer: React.FC<ExerciseAnimationViewerProps> = ({
  variant,
  accentColor = '#FF5500',
  onClose
}) => {
  const [frameIndex, setFrameIndex] = useState<0 | 1>(0)
  const [isPlaying, setIsPlaying] = useState<boolean>(true)
  const [viewMode, setViewMode] = useState<'animated' | 'split'>('animated')
  const [imgError, setImgError] = useState<boolean>(false)

  useEffect(() => {
    setImgError(false)
    setFrameIndex(0)
  }, [variant.id, variant.demoFolderId])

  useEffect(() => {
    if (!isPlaying) return
    const timer = setInterval(() => {
      setFrameIndex((prev) => (prev === 0 ? 1 : 0))
    }, 1150)
    return () => clearInterval(timer)
  }, [isPlaying])

  const frame0Url = `${FREE_EXERCISE_DB_BASE}/${variant.demoFolderId}/0.jpg`
  const frame1Url = `${FREE_EXERCISE_DB_BASE}/${variant.demoFolderId}/1.jpg`

  const defaultSteps: [string, string, string] = variant.stepByStep || [
    `Posición inicial: Ajusta el equipo (${variant.equipment}) y estabiliza tu postura antes de mover el peso.`,
    `Ejecución: Trabaja de forma enfocada tu ${variant.muscleGroup} siguiendo el tempo (${variant.tempo || '2s bajar • 1s subir'}).`,
    `Control: ${variant.cues}`
  ]

  const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    `como hacer ${variant.name} tecnica correcta gym`
  )}`

  return (
    <div className="mb-3 rounded-[10px] bg-[#0B090E] border border-[#2A2533] p-3.5 sm:p-4 space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase theme-soft-bg theme-text border theme-border flex items-center gap-1">
            <Activity className="w-3.5 h-3.5" />
            Demostración Real del Ejercicio
          </span>
          <span className="text-xs sm:text-sm font-bold text-white">{variant.name}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setViewMode(viewMode === 'animated' ? 'split' : 'animated')}
            className="px-2.5 py-1 rounded-md bg-[#14111A] hover:bg-[#1C1826] border border-[#2A2533] font-mono text-[10px] uppercase text-[#C7C3D1] flex items-center gap-1"
          >
            <Eye className="w-3.5 h-3.5 theme-text" />
            {viewMode === 'animated' ? 'Ver Inicio y Final Lado a Lado' : 'Ver en Movimiento'}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="font-mono text-[10px] uppercase text-[#A09BA8] hover:text-white px-2.5 py-1 rounded-md bg-[#14111A] border border-[#2A2533]"
            >
              Cerrar ✕
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-stretch">
        <div className="md:col-span-7 bg-[#14111A] border border-[#2A2533] rounded-md p-2.5 flex flex-col justify-between">
          {!imgError ? (
            viewMode === 'animated' ? (
              <div className="relative w-full h-56 sm:h-64 rounded-md overflow-hidden bg-black flex items-center justify-center">
                <img
                  src={frame0Url}
                  alt={`${variant.name} - Posición Inicial`}
                  onError={() => setImgError(true)}
                  className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${
                    frameIndex === 0 ? 'opacity-100' : 'opacity-0'
                  }`}
                />
                <img
                  src={frame1Url}
                  alt={`${variant.name} - Posición Final`}
                  onError={() => setImgError(true)}
                  className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${
                    frameIndex === 1 ? 'opacity-100' : 'opacity-0'
                  }`}
                />

                <div className="absolute top-2.5 left-2.5 px-2 py-1 rounded bg-[#0B090E]/85 backdrop-blur-md border border-[#2A2533] font-mono text-[10px] font-bold uppercase flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full animate-ping"
                    style={{ backgroundColor: accentColor }}
                  />
                  <span className="text-white">
                    {frameIndex === 0
                      ? '1/2 • Posición Inicial (Inhala)'
                      : '2/2 • Contracción / Empuje (Exhala)'}
                  </span>
                </div>

                <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setIsPlaying(false)
                      setFrameIndex(0)
                    }}
                    className={`px-2 py-1 rounded text-[10px] font-bold border ${
                      frameIndex === 0
                        ? 'theme-bg theme-border'
                        : 'bg-[#14111A] text-[#C7C3D1] border-[#2A2533]'
                    }`}
                  >
                    Inicio
                  </button>
                  <button
                    onClick={() => {
                      setIsPlaying(false)
                      setFrameIndex(1)
                    }}
                    className={`px-2 py-1 rounded text-[10px] font-bold border ${
                      frameIndex === 1
                        ? 'theme-bg theme-border'
                        : 'bg-[#14111A] text-[#C7C3D1] border-[#2A2533]'
                    }`}
                  >
                    Final
                  </button>
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="p-1.5 rounded bg-[#14111A] hover:bg-[#1C1826] text-white border border-[#2A2533]"
                    title={isPlaying ? 'Pausar animación' : 'Reanudar animación'}
                  >
                    {isPlaying ? (
                      <Pause className="w-3.5 h-3.5" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 h-56 sm:h-64">
                <div className="relative rounded-md overflow-hidden bg-black border border-[#2A2533]">
                  <img
                    src={frame0Url}
                    alt={`${variant.name} Inicio`}
                    onError={() => setImgError(true)}
                    className="w-full h-full object-contain"
                  />
                  <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded bg-[#0B090E]/90 font-mono text-[10px] font-bold text-[#E2DFEA] border border-[#2A2533]">
                    1. Posición Inicial
                  </span>
                </div>
                <div className="relative rounded-md overflow-hidden bg-black border theme-border">
                  <img
                    src={frame1Url}
                    alt={`${variant.name} Final`}
                    onError={() => setImgError(true)}
                    className="w-full h-full object-contain"
                  />
                  <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded bg-[#0B090E]/90 font-mono text-[10px] font-bold theme-text border theme-border">
                    2. Posición Final
                  </span>
                </div>
              </div>
            )
          ) : (
            <div className="h-52 rounded-md bg-[#0B090E] border border-[#2A2533] p-4 flex flex-col items-center justify-center text-center space-y-2">
              <p className="font-mono text-[11px] font-bold uppercase theme-text">
                Modo Sin Conexión a Internet (Offline)
              </p>
              <p className="text-xs text-[#C7C3D1] max-w-sm">
                Sigue los 3 pasos técnicos a la derecha para ejecutar{' '}
                <strong>{variant.name}</strong> con postura segura.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 mt-2 border-t border-[#2A2533] text-[11px]">
            <span className="text-[#C7C3D1]">
              ⏱️ <strong>Tempo:</strong> {variant.tempo || '2s bajar • 1s pausa • 1s subir'}
            </span>
            <a
              href={youtubeSearchUrl}
              target="_blank"
              rel="noreferrer"
              className="theme-text font-bold font-mono text-[10px] uppercase flex items-center gap-1"
            >
              Ver video HD en YouTube
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        <div className="md:col-span-5 flex flex-col justify-between space-y-2.5 text-xs">
          <div className="p-3 rounded-md bg-[#14111A] border border-[#2A2533] space-y-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#A09BA8] font-bold block">
              Músculos Trabajados ({variant.equipment})
            </span>
            <p className="font-bold theme-text text-sm">{variant.muscleGroup}</p>
            {variant.secondaryMuscles && (
              <p className="text-[11px] text-[#A09BA8]">
                Apoyo secundario:{' '}
                <span className="text-[#E2DFEA] font-medium">{variant.secondaryMuscles}</span>
              </p>
            )}
          </div>

          <div className="p-3 rounded-md bg-[#14111A] border border-[#2A2533] space-y-2 flex-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.06em] theme-text font-bold block">
              Pasos de Ejecución Correcta:
            </span>
            {defaultSteps.map((stepText, idx) => (
              <div key={idx} className="flex items-start gap-2 text-[11px] text-[#E2DFEA]">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] shrink-0 mt-0.5" />
                <span>{stepText}</span>
              </div>
            ))}
          </div>

          <div className="p-2.5 rounded-md bg-[#0B090E] border border-[#2A2533] border-l-[3px] theme-border text-[11px] text-[#E2DFEA] flex items-start gap-1.5">
            <Sparkles className="w-4 h-4 theme-text shrink-0 mt-0.5" />
            <span>
              <strong>Clave técnica:</strong> {variant.cues}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
