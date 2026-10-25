import React from 'react'
import { UserProfile, WorkoutHistoryEntry } from '../types'
import { calculateProfileStreak } from '../utils/fitnessMath'

interface StreakBannerProps {
  profiles: Record<'user_1' | 'user_2', UserProfile>
  primaryProfileId: 'user_1' | 'user_2'
  history: WorkoutHistoryEntry[]
  /** Perfil activo en el header (titular o pareja). La tarjeta muestra solo ese perfil. */
  activeProfileId?: 'user_1' | 'user_2'
}

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export const StreakBanner: React.FC<StreakBannerProps> = ({
  profiles,
  primaryProfileId,
  history,
  activeProfileId
}) => {
  const pid = activeProfileId ?? primaryProfileId
  const streak = calculateProfileStreak(history, pid)
  const name = (profiles[pid].name || '').trim() || (pid === 'user_1' ? 'Titular' : 'Pareja')
  const sessionsLabel = streak.weeklySessionsDone === 1 ? 'sesión completada' : 'sesiones completadas'

  return (
    <div className="rounded-[10px] border border-[#2A2533] bg-[#14111A] p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#A09BA8]">
          Constancia semanal · {name}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#A09BA8]">
          Meta 3-5 días
        </span>
      </div>

      <div className="flex items-baseline gap-2.5">
        <span className="font-display text-[56px] leading-[0.9] theme-text">
          {streak.weeklySessionsDone}
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-white leading-tight">
          {sessionsLabel}
          <br />
          esta semana
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {DAY_LABELS.map((dayLbl, idx) => {
          const done = streak.weekDaysCompleted[idx]
          return (
            <div
              key={dayLbl + idx}
              className={`text-center py-1.5 rounded-md border font-mono text-[10px] ${
                done
                  ? 'bg-[#10B981] border-[#10B981] text-[#0B090E] font-extrabold'
                  : 'bg-[#0B090E] border-[#2A2533] text-[#A09BA8]'
              }`}
            >
              {dayLbl}
            </div>
          )
        })}
      </div>
    </div>
  )
}
