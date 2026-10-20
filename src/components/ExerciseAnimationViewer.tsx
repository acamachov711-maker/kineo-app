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
  accentColor = '#10B981',
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
    <div className="mb-3 rounded-2xl bg-slate-950/95 border border-emerald-500/40 p-3.5 sm:p-4 space-y-3.5 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
            <Activity className="w-3.5 h-3.5" />
            Demostración Real del Ejercicio
          </span>
          <span className="text-xs sm:text-sm font-extrabold text-white">{variant.name}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setViewMode(viewMode === 'animated' ? 'split' : 'animated')}
            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-semibold text-slate-300 flex items-center gap-1"
          >
            <Eye className="w-3.5 h-3.5 text-emerald-400" />
            {viewMode === 'animated' ? 'Ver Inicio y Final Lado a Lado' : 'Ver en Movimiento'}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800"
            >
              Cerrar ✕
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-stretch">
        <div className="md:col-span-7 bg-slate-900/95 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between">
          {!imgError ? (
            viewMode === 'animated' ? (
              <div className="relative w-full h-56 sm:h-64 rounded-lg overflow-hidden bg-black flex items-center justify-center">
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

                <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-slate-950/85 backdrop-blur-md border border-slate-700 text-[11px] font-bold flex items-center gap-1.5">
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
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-slate-900/90 text-slate-300 border-slate-700'
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
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-slate-900/90 text-slate-300 border-slate-700'
                    }`}
                  >
                    Final
                  </button>
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="p-1.5 rounded bg-slate-900/90 hover:bg-slate-800 text-white border border-slate-700"
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
                <div className="relative rounded-lg overflow-hidden bg-black border border-slate-800">
                  <img
                    src={frame0Url}
                    alt={`${variant.name} Inicio`}
                    onError={() => setImgError(true)}
                    className="w-full h-full object-contain"
                  />
                  <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded bg-slate-950/90 text-[10px] font-bold text-slate-200 border border-slate-700">
                    1. Posición Inicial
                  </span>
                </div>
                <div className="relative rounded-lg overflow-hidden bg-black border border-emerald-500/40">
                  <img
                    src={frame1Url}
                    alt={`${variant.name} Final`}
                    onError={() => setImgError(true)}
                    className="w-full h-full object-contain"
                  />
                  <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded bg-emerald-950/90 text-[10px] font-bold text-emerald-300 border border-emerald-500/40">
                    2. Posición Final
                  </span>
                </div>
              </div>
            )
          ) : (
            <div className="h-52 rounded-lg bg-slate-950 border border-slate-800 p-4 flex flex-col items-center justify-center text-center space-y-2">
              <p className="text-xs font-bold text-amber-300">
                Modo Sin Conexión a Internet (Offline)
              </p>
              <p className="text-xs text-slate-300 max-w-sm">
                Sigue los 3 pasos técnicos a la derecha para ejecutar{' '}
                <strong>{variant.name}</strong> con postura segura.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 mt-2 border-t border-slate-800/80 text-[11px]">
            <span className="text-slate-300">
              ⏱️ <strong>Tempo:</strong> {variant.tempo || '2s bajar • 1s pausa • 1s subir'}
            </span>
            <a
              href={youtubeSearchUrl}
              target="_blank"
              rel="noreferrer"
              className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1"
            >
              Ver video HD en YouTube
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        <div className="md:col-span-5 flex flex-col justify-between space-y-2.5 text-xs">
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">
              Músculos Trabajados ({variant.equipment})
            </span>
            <p className="font-extrabold text-emerald-300 text-sm">{variant.muscleGroup}</p>
            {variant.secondaryMuscles && (
              <p className="text-[11px] text-slate-400">
                Apoyo secundario:{' '}
                <span className="text-slate-200 font-medium">{variant.secondaryMuscles}</span>
              </p>
            )}
          </div>

          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 flex-1">
            <span className="text-[10px] uppercase tracking-wider text-amber-300 font-bold block">
              Pasos de Ejecución Correcta:
            </span>
            {defaultSteps.map((stepText, idx) => (
              <div key={idx} className="flex items-start gap-2 text-[11px] text-slate-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>{stepText}</span>
              </div>
            ))}
          </div>

          <div className="p-2.5 rounded-xl bg-indigo-950/25 border border-indigo-500/30 text-[11px] text-indigo-200 flex items-start gap-1.5">
            <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <span>
              <strong>Clave técnica:</strong> {variant.cues}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
