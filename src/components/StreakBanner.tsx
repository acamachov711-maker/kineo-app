import React from 'react'
import { Flame, Trophy, CheckCircle2, HeartHandshake } from 'lucide-react'
import { UserProfile, WorkoutHistoryEntry } from '../types'
import { calculateProfileStreak } from '../utils/fitnessMath'

interface StreakBannerProps {
  profiles: Record<'user_1' | 'user_2', UserProfile>
  primaryProfileId: 'user_1' | 'user_2'
  history: WorkoutHistoryEntry[]
}

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export const StreakBanner: React.FC<StreakBannerProps> = ({
  profiles,
  primaryProfileId,
  history
}) => {
  const secondaryProfileId: 'user_1' | 'user_2' =
    primaryProfileId === 'user_1' ? 'user_2' : 'user_1'
  const orderedIds: ('user_1' | 'user_2')[] = [primaryProfileId, secondaryProfileId]

  const datesU1 = new Set(
    history.filter((h) => h.profileId === 'user_1').map((h) => h.date)
  )
  const sharedDatesCount = Array.from(
    new Set(history.filter((h) => h.profileId === 'user_2').map((h) => h.date))
  ).filter((d) => datesU1.has(d)).length

  return (
    <div className="rounded-2xl bg-gradient-to-r from-amber-950/35 via-slate-900 to-rose-950/35 border border-amber-500/35 p-4 sm:p-5 space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Flame className="w-5 h-5 fill-amber-400/30" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              Sistema de Rachas • Meta Flexible (3 a 5 días/semana)
            </h3>
            <p className="text-[11px] text-slate-300">
              Cumple al menos 3 días en la semana para mantener encendida tu racha.
            </p>
          </div>
        </div>

        <div className="px-3 py-1 rounded-full bg-pink-500/15 border border-pink-500/30 text-pink-200 text-xs font-bold flex items-center gap-1.5">
          <HeartHandshake className="w-4 h-4 text-pink-400" />
          Dúo: {sharedDatesCount} sesiones juntos
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {orderedIds.map((pid) => {
          const prof = profiles[pid]
          const streak = calculateProfileStreak(history, pid)
          const pct = Math.min(100, (streak.weeklySessionsDone / streak.weeklyTargetMin) * 100)

          return (
            <div
              key={pid}
              className="p-3.5 rounded-xl bg-slate-950/85 border border-slate-800 flex flex-col justify-between gap-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: prof.accentColor }}
                  />
                  <span className="text-xs font-extrabold text-white">{prof.name}</span>
                  {streak.isGoalMetThisWeek && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 font-bold">
                      <CheckCircle2 className="w-3 h-3" />
                      Meta Cumplida
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 text-amber-300 font-black text-xs">
                  <Flame className="w-4 h-4 text-amber-400 fill-amber-400" />
                  {streak.activeWeekStreak}{' '}
                  {streak.activeWeekStreak === 1 ? 'semana' : 'semanas'}
                </div>
              </div>

              <div className="flex items-center justify-between gap-1">
                {DAY_LABELS.map((dayLbl, idx) => {
                  const done = streak.weekDaysCompleted[idx]
                  return (
                    <div
                      key={dayLbl + idx}
                      className={`flex-1 py-1.5 rounded-lg border text-center text-[10px] font-bold transition-all ${
                        done
                          ? 'bg-amber-500/25 border-amber-400 text-amber-200 shadow-sm shadow-amber-500/20'
                          : 'bg-slate-900 border-slate-800 text-slate-500'
                      }`}
                    >
                      <span className="block">{dayLbl}</span>
                      <span className="block text-[9px] mt-0.5">{done ? '🔥' : '•'}</span>
                    </div>
                  )
                })}
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">
                    Esta semana:{' '}
                    <strong className="text-white">
                      {streak.weeklySessionsDone} de {streak.weeklyTargetMin}-{streak.weeklyTargetMax} días
                    </strong>
                  </span>
                  <span className="text-slate-400 flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-amber-400" />
                    Total: {streak.totalWorkouts}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
