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
      <div className="max-w-2xl mx-auto bg-slate-900/95 backdrop-blur-md border border-emerald-500/40 rounded-2xl shadow-2xl p-3 pointer-events-auto">
        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-2.5">
          <div
            className={`h-full transition-all duration-300 ${
              isFinished
                ? 'bg-amber-400 animate-pulse'
                : 'bg-gradient-to-r from-emerald-500 to-pink-500'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isFinished
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'bg-emerald-500/20 text-emerald-400'
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
                <span className="font-mono text-xl font-bold tracking-tight text-white">
                  {isFinished ? '¡Listo!' : formatted}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  Descanso
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate">
                {label || 'Recupera el aliento para la siguiente serie'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => onAdjustSeconds(-15)}
              className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700"
            >
              -15s
            </button>
            <button
              onClick={() => onAdjustSeconds(15)}
              className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700"
            >
              +15s
            </button>
            <button
              onClick={onTogglePause}
              className="p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30"
              title={isRunning ? 'Pausar' : 'Reanudar'}
            >
              {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              onClick={onReset}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              title="Reiniciar"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onSkip}
              className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1"
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
