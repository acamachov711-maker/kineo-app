import React, { useState } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts'
import {
  Trophy,
  Calendar,
  Flame,
  TrendingUp,
  Award,
  Dumbbell,
  ChevronRight,
  X
} from 'lucide-react'
import {
  MesocyclePlan,
  UserProfile,
  WorkoutHistoryEntry,
  WeightUnit
} from '../types'
import {
  displayWeightValue,
  formatDualWeight,
  getExerciseWeightHistory
} from '../utils/fitnessMath'

interface ProgressDashboardProps {
  profiles: Record<'user_1' | 'user_2', UserProfile>
  mesocycle: MesocyclePlan
  history: WorkoutHistoryEntry[]
  weightUnit: WeightUnit
}

interface UniqueExerciseStat {
  variantId: string
  variantName: string
  muscleGroup: string
  equipment: string
  timesPerformedU1: number
  timesPerformedU2: number
  bestWeightKgU1: number
  bestWeightKgU2: number
  best1RmKgU1: number
  best1RmKgU2: number
  totalVolumeKgU1: number
  totalVolumeKgU2: number
}

export const ProgressDashboard: React.FC<ProgressDashboardProps> = ({
  profiles,
  mesocycle,
  history,
  weightUnit
}) => {
  const [selectedProfile, setSelectedProfile] = useState<'user_1' | 'user_2' | 'both'>('both')
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null)

  const user1History = history.filter((h) => h.profileId === 'user_1')
  const user2History = history.filter((h) => h.profileId === 'user_2')

  const totalVolumeUser1 = user1History.reduce((acc, item) => acc + item.totalVolumeKg, 0)
  const totalVolumeUser2 = user2History.reduce((acc, item) => acc + item.totalVolumeKg, 0)

  const datesSet = Array.from(new Set(history.map((h) => h.date))).sort()
  const volumeChartData = datesSet.map((dateStr) => {
    const u1 = user1History
      .filter((h) => h.date === dateStr)
      .reduce((sum, x) => sum + displayWeightValue(x.totalVolumeKg, weightUnit), 0)
    const u2 = user2History
      .filter((h) => h.date === dateStr)
      .reduce((sum, x) => sum + displayWeightValue(x.totalVolumeKg, weightUnit), 0)
    return {
      date: dateStr.slice(5),
      [profiles.user_1.name]: user1History.some((h) => h.date === dateStr) ? Math.round(u1) : null,
      [profiles.user_2.name]: user2History.some((h) => h.date === dateStr) ? Math.round(u2) : null
    }
  })

  // Build unique list of performed exercises (without repeating per workout session)
  const uniqueExercisesMap = new Map<string, UniqueExerciseStat>()

  history.forEach((entry) => {
    entry.exercises.forEach((ex) => {
      const existing = uniqueExercisesMap.get(ex.variantId) || {
        variantId: ex.variantId,
        variantName: ex.variantName,
        muscleGroup: ex.muscleGroup,
        equipment: ex.equipment,
        timesPerformedU1: 0,
        timesPerformedU2: 0,
        bestWeightKgU1: 0,
        bestWeightKgU2: 0,
        best1RmKgU1: 0,
        best1RmKgU2: 0,
        totalVolumeKgU1: 0,
        totalVolumeKgU2: 0
      }

      if (entry.profileId === 'user_1') {
        existing.timesPerformedU1 += 1
        existing.bestWeightKgU1 = Math.max(existing.bestWeightKgU1, ex.maxWeightKg)
        existing.best1RmKgU1 = Math.max(existing.best1RmKgU1, ex.estimated1RmKg)
        existing.totalVolumeKgU1 += ex.totalVolumeKg
      } else {
        existing.timesPerformedU2 += 1
        existing.bestWeightKgU2 = Math.max(existing.bestWeightKgU2, ex.maxWeightKg)
        existing.best1RmKgU2 = Math.max(existing.best1RmKgU2, ex.estimated1RmKg)
        existing.totalVolumeKgU2 += ex.totalVolumeKg
      }

      uniqueExercisesMap.set(ex.variantId, existing)
    })
  })

  // Also include exercises calibrated via 1RM test even if not in history array yet
  mesocycle.sessions.forEach((sess) => {
    sess.slots.forEach((slot) => {
      const allVars = [
        slot.primaryExercise,
        ...slot.alternatives,
        ...(slot.femaleFocusedPrimary ? [slot.femaleFocusedPrimary] : []),
        ...(slot.femaleFocusedAlternatives || [])
      ]
      allVars.forEach((v) => {
        const rm1 = profiles.user_1.estimated1RMByVariant[v.id] || 0
        const rm2 = profiles.user_2.estimated1RMByVariant[v.id] || 0
        if ((rm1 > 0 || rm2 > 0) && !uniqueExercisesMap.has(v.id)) {
          uniqueExercisesMap.set(v.id, {
            variantId: v.id,
            variantName: v.name,
            muscleGroup: v.muscleGroup,
            equipment: v.equipment,
            timesPerformedU1: rm1 > 0 ? 1 : 0,
            timesPerformedU2: rm2 > 0 ? 1 : 0,
            bestWeightKgU1: Math.round(rm1 * 0.75),
            bestWeightKgU2: Math.round(rm2 * 0.75),
            best1RmKgU1: rm1,
            best1RmKgU2: rm2,
            totalVolumeKgU1: 0,
            totalVolumeKgU2: 0
          })
        }
      })
    })
  })

  const uniqueExercisesList = Array.from(uniqueExercisesMap.values())
  const activeDetailExercise = uniqueExercisesList.find(
    (e) => e.variantId === selectedExerciseId
  )
  const detailChartData = selectedExerciseId
    ? getExerciseWeightHistory(history, selectedExerciseId, weightUnit)
    : []

  return (
    <div className="space-y-5 pb-24">
      {/* Filter Pills */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#14111A] border border-[#2A2533] p-3 rounded-[10px]">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[#A09BA8]">
          Vista de Progreso:
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSelectedProfile('both')}
            className={`px-3 py-1.5 rounded-md font-mono text-[11px] font-bold uppercase border transition-all ${
              selectedProfile === 'both'
                ? 'theme-bg theme-border'
                : 'bg-[#0B090E] border-[#2A2533] text-[#A09BA8]'
            }`}
          >
            Ambos (Comparativa)
          </button>
          <button
            onClick={() => setSelectedProfile('user_1')}
            className={`px-3 py-1.5 rounded-md font-mono text-[11px] font-bold uppercase border transition-all ${
              selectedProfile === 'user_1'
                ? 'theme-bg theme-border'
                : 'bg-[#0B090E] border-[#2A2533] text-[#A09BA8]'
            }`}
          >
            {profiles.user_1.name}
          </button>
          <button
            onClick={() => setSelectedProfile('user_2')}
            className={`px-3 py-1.5 rounded-md font-mono text-[11px] font-bold uppercase border transition-all ${
              selectedProfile === 'user_2'
                ? 'theme-bg theme-border'
                : 'bg-[#0B090E] border-[#2A2533] text-[#A09BA8]'
            }`}
          >
            {profiles.user_2.name}
          </button>
        </div>
      </div>

      {/* 1. Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(['user_1', 'user_2'] as const)
          .filter((pid) => selectedProfile === 'both' || selectedProfile === pid)
          .map((pid) => {
            const prof = profiles[pid]
            const pHist = pid === 'user_1' ? user1History : user2History
            const totalVol = pid === 'user_1' ? totalVolumeUser1 : totalVolumeUser2
            const exCount = uniqueExercisesList.filter((x) =>
              pid === 'user_1' ? x.timesPerformedU1 > 0 : x.timesPerformedU2 > 0
            ).length

            return (
              <div
                key={pid}
                className="rounded-[10px] p-4 border bg-[#14111A] border-[#2A2533]"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-display text-xl text-white flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: prof.accentColor }}
                      />
                      {prof.name}
                    </h3>
                    <p className="font-mono text-[10px] text-[#A09BA8]">{prof.goal}</p>
                  </div>
                  <Trophy className="w-6 h-6" style={{ color: prof.accentColor }} />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-md bg-[#0B090E] border border-[#2A2533]">
                    <span className="font-mono text-[10px] text-[#A09BA8] flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Sesiones
                    </span>
                    <p className="text-lg font-extrabold text-white mt-0.5">{pHist.length}</p>
                    <span className="font-mono text-[10px] theme-text">Meta: 3-5/sem</span>
                  </div>

                  <div className="p-2.5 rounded-md bg-[#0B090E] border border-[#2A2533]">
                    <span className="font-mono text-[10px] text-[#A09BA8] flex items-center gap-1">
                      <Flame className="w-3 h-3" /> Volumen Total
                    </span>
                    <p className="text-sm font-extrabold text-white mt-1">
                      {displayWeightValue(totalVol, weightUnit).toLocaleString()} {weightUnit}
                    </p>
                    <span className="font-mono text-[10px] text-[#A09BA8]">Acumulado</span>
                  </div>

                  <div className="p-2.5 rounded-md bg-[#0B090E] border border-[#2A2533]">
                    <span className="font-mono text-[10px] text-[#A09BA8] flex items-center gap-1">
                      <Award className="w-3 h-3" /> Ejercicios
                    </span>
                    <p className="text-lg font-extrabold text-white mt-0.5">{exCount}</p>
                    <span className="font-mono text-[10px] text-[#A09BA8]">Realizados</span>
                  </div>
                </div>
              </div>
            )
          })}
      </div>

      {/* 2. Volume Evolution Chart */}
      <div className="rounded-[10px] bg-[#14111A] border border-[#2A2533] p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 theme-text" />
              Evolución de Volumen Levantado ({weightUnit.toUpperCase()})
            </h3>
            <p className="font-mono text-[10px] text-[#A09BA8]">
              Suma de Peso × Repeticiones completadas en cada entrenamiento
            </p>
          </div>
        </div>

        {volumeChartData.length > 0 ? (
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={volumeChartData}>
                <defs>
                  <linearGradient id="colorU1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={profiles.user_1.accentColor} stopOpacity={0.45} />
                    <stop offset="95%" stopColor={profiles.user_1.accentColor} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorU2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={profiles.user_2.accentColor} stopOpacity={0.45} />
                    <stop offset="95%" stopColor={profiles.user_2.accentColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2533" />
                <XAxis dataKey="date" stroke="#A09BA8" fontSize={12} />
                <YAxis stroke="#A09BA8" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#14111A',
                    borderColor: '#2A2533',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}
                />
                {(selectedProfile === 'both' || selectedProfile === 'user_1') && (
                  <Area
                    connectNulls
                    type="monotone"
                    dataKey={profiles.user_1.name}
                    stroke={profiles.user_1.accentColor}
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorU1)"
                  />
                )}
                {(selectedProfile === 'both' || selectedProfile === 'user_2') && (
                  <Area
                    connectNulls
                    type="monotone"
                    dataKey={profiles.user_2.name}
                    stroke={profiles.user_2.accentColor}
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorU2)"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="font-mono text-[10px] text-[#A09BA8] py-8 text-center">
            Aún no hay entrenamientos registrados.
          </p>
        )}
      </div>

      {/* 3. Unique Performed Exercises Catalog + Individual Clickable Stats */}
      <div className="rounded-[10px] bg-[#14111A] border border-[#2A2533] p-4 sm:p-5 space-y-4">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <Dumbbell className="w-4 h-4 theme-text" />
            Ejercicios Realizados (Toca cualquiera para ver sus estadísticas individuales)
          </h3>
          <p className="font-mono text-[10px] text-[#A09BA8] mt-0.5">
            Catálogo único sin repetir de los ejercicios trabajados y su evolución de peso
          </p>
        </div>

        {/* Individual Exercise Statistics Modal / Drawer when clicked */}
        {activeDetailExercise && (
          <div className="p-4 rounded-[10px] bg-[#0B090E] border theme-border space-y-4">
            <div className="flex items-start justify-between gap-2 border-b border-[#2A2533] pb-3">
              <div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] theme-text">
                  Estadísticas Individuales del Ejercicio
                </span>
                <h4 className="text-base sm:text-lg font-extrabold text-white mt-0.5">
                  {activeDetailExercise.variantName}
                </h4>
                <p className="font-mono text-[10px] text-[#A09BA8]">
                  {activeDetailExercise.equipment} • {activeDetailExercise.muscleGroup}
                </p>
              </div>
              <button
                onClick={() => setSelectedExerciseId(null)}
                className="p-1.5 rounded-md bg-[#14111A] hover:bg-[#1C1826] text-[#A09BA8] border border-[#2A2533]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Individual Exercise KPI Cards per Profile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-md bg-[#14111A] border border-[#2A2533] space-y-1.5">
                <span
                  className="text-xs font-extrabold block"
                  style={{ color: profiles.user_1.accentColor }}
                >
                  {profiles.user_1.name}
                </span>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="font-mono text-[10px] text-[#A09BA8] block">Mejor Peso</span>
                    <strong className="text-white">
                      {formatDualWeight(activeDetailExercise.bestWeightKgU1, weightUnit)}
                    </strong>
                  </div>
                  <div>
                    <span className="font-mono text-[10px] text-[#A09BA8] block">1RM Est.</span>
                    <strong className="theme-text">
                      {displayWeightValue(activeDetailExercise.best1RmKgU1, weightUnit)}{' '}
                      {weightUnit}
                    </strong>
                  </div>
                  <div>
                    <span className="font-mono text-[10px] text-[#A09BA8] block">Sesiones</span>
                    <strong className="text-white">
                      {activeDetailExercise.timesPerformedU1} veces
                    </strong>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-md bg-[#14111A] border border-[#2A2533] space-y-1.5">
                <span
                  className="text-xs font-extrabold block"
                  style={{ color: profiles.user_2.accentColor }}
                >
                  {profiles.user_2.name}
                </span>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="font-mono text-[10px] text-[#A09BA8] block">Mejor Peso</span>
                    <strong className="text-white">
                      {formatDualWeight(activeDetailExercise.bestWeightKgU2, weightUnit)}
                    </strong>
                  </div>
                  <div>
                    <span className="font-mono text-[10px] text-[#A09BA8] block">1RM Est.</span>
                    <strong className="theme-text">
                      {displayWeightValue(activeDetailExercise.best1RmKgU2, weightUnit)}{' '}
                      {weightUnit}
                    </strong>
                  </div>
                  <div>
                    <span className="font-mono text-[10px] text-[#A09BA8] block">Sesiones</span>
                    <strong className="text-white">
                      {activeDetailExercise.timesPerformedU2} veces
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Weight Progression LineChart for this specific exercise */}
            <div>
              <p className="font-mono text-[10px] font-bold uppercase text-[#A09BA8] mb-2">
                Curva de Progreso de Peso en {activeDetailExercise.variantName} (
                {weightUnit.toUpperCase()}):
              </p>
              {detailChartData.length > 0 ? (
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={detailChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2A2533" />
                      <XAxis dataKey="date" stroke="#A09BA8" fontSize={11} />
                      <YAxis stroke="#A09BA8" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#14111A',
                          borderColor: '#2A2533',
                          borderRadius: '10px',
                          fontSize: '12px'
                        }}
                      />
                      <Line
                        connectNulls
                        type="monotone"
                        dataKey="user1Weight"
                        name={`${profiles.user_1.name} (${weightUnit})`}
                        stroke={profiles.user_1.accentColor}
                        strokeWidth={3}
                        dot={{ r: 4 }}
                      />
                      <Line
                        connectNulls
                        type="monotone"
                        dataKey="user2Weight"
                        name={`${profiles.user_2.name} (${weightUnit})`}
                        stroke={profiles.user_2.accentColor}
                        strokeWidth={3}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="font-mono text-[10px] text-[#A09BA8] py-4 text-center">
                  Completa más sesiones de este ejercicio para graficar su curva temporal.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Unique Exercises Grid */}
        {uniqueExercisesList.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {uniqueExercisesList.map((ex) => {
              const isSelected = selectedExerciseId === ex.variantId
              return (
                <button
                  key={ex.variantId}
                  onClick={() =>
                    setSelectedExerciseId(isSelected ? null : ex.variantId)
                  }
                  className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'theme-soft-bg theme-border text-white'
                      : 'bg-[#0B090E] border-[#2A2533] hover:border-[#3A3345] text-[#E2DFEA]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#14111A] border border-[#2A2533] text-[#E2DFEA] font-bold">
                        {ex.equipment}
                      </span>
                      <span className="font-mono text-[10px] text-[#A09BA8] truncate">
                        {ex.muscleGroup}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-white mt-1 truncate">
                      {ex.variantName}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px]">
                      {ex.bestWeightKgU1 > 0 && (
                        <span style={{ color: profiles.user_1.accentColor }}>
                          <strong>{profiles.user_1.name}:</strong>{' '}
                          {displayWeightValue(ex.bestWeightKgU1, weightUnit)} {weightUnit}
                        </span>
                      )}
                      {ex.bestWeightKgU2 > 0 && (
                        <span style={{ color: profiles.user_2.accentColor }}>
                          <strong>{profiles.user_2.name}:</strong>{' '}
                          {displayWeightValue(ex.bestWeightKgU2, weightUnit)} {weightUnit}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#A09BA8] shrink-0" />
                </button>
              )
            })}
          </div>
        ) : (
          <div className="p-6 rounded-md bg-[#0B090E] border border-[#2A2533] text-center text-xs text-[#A09BA8]">
            Aún no hay ejercicios realizados en el historial. Completa tu primera sesión en la
            pestaña <strong>Entrenar</strong> para ver aquí cada ejercicio y sus gráficas.
          </div>
        )}
      </div>
    </div>
  )
}