import React, { useEffect } from 'react'
import { Timer, Play, Pause, RotateCcw, FastForward, Volume2 } from 'lucide-react'

interface RestTimerBarProps {
  secondsLeft: number
  totalSeconds: number
  isRunning: boolean
  label: string
  onTogglePause: () => void
  onAdjustSeconds: (delta: number) => void
  onSkip: () => void
  onReset: () => void
}

/**
 * V1.6-07: Alarma de triple campana de gimnasio de alta presencia (1760 Hz / 2349 Hz, 1.8 s)
 * audible sobre música (Spotify/Apple Music) sin detener la reproducción + vibración intensa.
 */
function playGymBellAlarm() {
  try {
    if (navigator.vibrate) {
      navigator.vibrate([400, 120, 400, 120, 500, 150, 600])
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioCtx()

    const strikeTimes = [0, 0.52, 1.04]
    strikeTimes.forEach((offset, idx) => {
      const startTime = ctx.currentTime + offset
      const duration = idx === 2 ? 0.72 : 0.45

      const osc1 = ctx.createOscillator()
      const osc2 = ctx.createOscillator()
      const gain = ctx.createGain()

      osc1.type = 'triangle'
      osc2.type = 'sine'

      // Armónicos de campana metálica que cortan sobre la mezcla musical
      osc1.frequency.setValueAtTime(1760, startTime)
      osc2.frequency.setValueAtTime(2349.32, startTime)

      gain.gain.setValueAtTime(0.001, startTime)
      gain.gain.linearRampToValueAtTime(0.42, startTime + 0.018)
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)

      osc1.connect(gain)
      osc2.connect(gain)
      gain.connect(ctx.destination)

      osc1.start(startTime)
      osc2.start(startTime)
      osc1.stop(startTime + duration)
      osc2.stop(startTime + duration)
    })
  } catch {
    // Ignore audio context restriction
  }
}

export const RestTimerBar: React.FC<RestTimerBarProps> = ({
  secondsLeft,
  totalSeconds,
  isRunning,
  label,
  onTogglePause,
  onAdjustSeconds,
  onSkip,
  onReset
}) => {
  useEffect(() => {
    if (secondsLeft === 0 && totalSeconds > 0) {
      playGymBellAlarm()
    }
  }, [secondsLeft, totalSeconds])

  if (totalSeconds === 0 && secondsLeft === 0) return null

  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60
  const formatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`
  const progressPct =
    totalSeconds > 0 ? Math.min(100, ((totalSeconds - secondsLeft) / totalSeconds) * 100) : 100
  const isFinished = secondsLeft === 0

  return (
    <div className="fixed bottom-16 left-0 right-0 z-40 px-3 pointer-events-none">
      <div className="max-w-2xl mx-auto bg-[#14111A]/95 backdrop-blur-md border border-[#2A2533] rounded-[10px] shadow-2xl p-3 pointer-events-auto space-y-2">
        {/* Progress Bar */}
        <div className="w-full bg-[#0B090E] h-1.5 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isFinished ? 'bg-[#10B981] animate-pulse' : 'theme-bg'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* V1.6-12 Nivel 1: Reloj grande jamás truncable + Nombre del ejercicio a todo lo ancho + chip de estado */}
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                isFinished
                  ? 'bg-[#10B981]/20 text-[#10B981]'
                  : 'theme-soft-bg theme-text'
              }`}
            >
              {isFinished ? (
                <Volume2 className="w-5 h-5 animate-bounce" />
              ) : (
                <Timer className="w-5 h-5" />
              )}
            </div>

            <span className="font-mono text-2xl font-extrabold tracking-tight text-white whitespace-nowrap shrink-0">
              {isFinished ? '¡LISTO!' : formatted}
            </span>

            <p className="font-mono text-[11px] text-[#E2DFEA] truncate flex-1 min-w-0">
              {label || 'Recupera el aliento para la siguiente serie'}
            </p>
          </div>

          <span
            className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded border whitespace-nowrap shrink-0 ${
              isFinished
                ? 'bg-[#10B981]/20 text-[#10B981] border-[#10B981]/40'
                : isRunning
                ? 'bg-[#0B090E] text-[#A09BA8] border-[#2A2533]'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
            }`}
          >
            {isFinished ? 'Terminado' : isRunning ? 'Descanso' : 'En Pausa'}
          </span>
        </div>

        {/* V1.6-12 Nivel 2: Grid de 5 botones (-15s, +15s, Pausar/Reanudar, Reset, Saltar) */}
        <div className="grid grid-cols-5 gap-1.5 pt-0.5">
          <button
            type="button"
            onClick={() => onAdjustSeconds(-15)}
            className="py-1.5 rounded-md bg-[#0B090E] hover:bg-[#1C1826] font-mono text-[11px] font-bold text-[#C7C3D1] border border-[#2A2533] flex items-center justify-center whitespace-nowrap"
          >
            -15s
          </button>
          <button
            type="button"
            onClick={() => onAdjustSeconds(15)}
            className="py-1.5 rounded-md bg-[#0B090E] hover:bg-[#1C1826] font-mono text-[11px] font-bold text-[#C7C3D1] border border-[#2A2533] flex items-center justify-center whitespace-nowrap"
          >
            +15s
          </button>
          <button
            type="button"
            onClick={onTogglePause}
            className="py-1.5 rounded-md theme-bg border theme-border font-mono text-[11px] font-bold flex items-center justify-center gap-1 whitespace-nowrap"
            title={isRunning ? 'Pausar' : 'Reanudar'}
          >
            {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isRunning ? 'Pausa' : 'Seguir'}</span>
          </button>
          <button
            type="button"
            onClick={onReset}
            className="py-1.5 rounded-md bg-[#0B090E] hover:bg-[#1C1826] text-[#C7C3D1] border border-[#2A2533] font-mono text-[11px] font-bold flex items-center justify-center gap-1 whitespace-nowrap"
            title="Reiniciar"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="solar-btn py-1.5 rounded-md bg-[#0B090E] hover:bg-[#1C1826] text-[#E2DFEA] border border-[#2A2533] text-xs flex items-center justify-center gap-1 whitespace-nowrap"
          >
            <FastForward className="w-3.5 h-3.5" />
            <span>Saltar</span>
          </button>
        </div>
      </div>
    </div>
  )
}
