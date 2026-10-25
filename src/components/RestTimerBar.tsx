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

function playBeep() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.15)
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.45)
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200])
    }
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
      playBeep()
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
      <div className="max-w-2xl mx-auto bg-[#14111A]/95 backdrop-blur-md border border-[#2A2533] rounded-[10px] shadow-2xl p-3 pointer-events-auto">
        <div className="w-full bg-[#0B090E] h-1.5 rounded-full overflow-hidden mb-2.5">
          <div
            className={`h-full transition-all duration-300 ${
              isFinished
                ? 'bg-[#10B981] animate-pulse'
                : 'theme-bg'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
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
            <div className="truncate">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xl font-extrabold tracking-tight text-white">
                  {isFinished ? '¡Listo!' : formatted}
                </span>
                <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-[#0B090E] text-[#A09BA8] border border-[#2A2533]">
                  Descanso
                </span>
              </div>
              <p className="font-mono text-[10px] text-[#A09BA8] truncate">
                {label || 'Recupera el aliento para la siguiente serie'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => onAdjustSeconds(-15)}
              className="px-2 py-1.5 rounded-md bg-[#0B090E] hover:bg-[#1C1826] font-mono text-[10px] font-bold text-[#C7C3D1] border border-[#2A2533]"
            >
              -15s
            </button>
            <button
              onClick={() => onAdjustSeconds(15)}
              className="px-2 py-1.5 rounded-md bg-[#0B090E] hover:bg-[#1C1826] font-mono text-[10px] font-bold text-[#C7C3D1] border border-[#2A2533]"
            >
              +15s
            </button>
            <button
              onClick={onTogglePause}
              className="p-2 rounded-md theme-bg border theme-border"
              title={isRunning ? 'Pausar' : 'Reanudar'}
            >
              {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              onClick={onReset}
              className="p-2 rounded-md bg-[#0B090E] hover:bg-[#1C1826] text-[#C7C3D1] border border-[#2A2533]"
              title="Reiniciar"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onSkip}
              className="solar-btn px-2.5 py-1.5 rounded-md bg-[#0B090E] text-[#A09BA8] border border-[#2A2533] text-sm flex items-center gap-1"
            >
              <FastForward className="w-3.5 h-3.5" />
              Saltar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
