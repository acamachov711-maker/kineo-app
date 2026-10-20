import React, { useState } from 'react'
import {
  Shuffle,
  Users,
  User,
  Flame,
  TrendingUp,
  TrendingDown,
  Layers,
  Plus,
  Check,
  HelpCircle,
  Target,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Clock,
  PlayCircle,
  Sparkles,
  LineChart as LineChartIcon
} from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts'
import {
  ExerciseSlot,
  ExerciseVariant,
  SetEntry,
  SetTechnique,
  SyncMode,
  UserProfile,
  WeightUnit,
  WorkoutHistoryEntry
} from '../types'
import {
  displayWeightValue,
  parseInputToKg,
  kgToLb,
  generateDropSubSets,
  calculateSafe1RM,
  formatDualWeight,
  getIdealWeightZones,
  getExerciseWeightHistory
} from '../utils/fitnessMath'
import { ExerciseAnimationViewer } from './ExerciseAnimationViewer'

interface ExerciseSlotCardProps {
  slot: ExerciseSlot
  profiles: Record<'user_1' | 'user_2', UserProfile>
  primaryProfileId: 'user_1' | 'user_2'
  activeProfileId: 'user_1' | 'user_2'
  coupleViewMode: 'both' | 'single'
  weightUnit: WeightUnit
  history: WorkoutHistoryEntry[]
  syncMode: SyncMode
  techniqueByProfile: Record<'user_1' | 'user_2', SetTechnique>
  setsByProfile: Record<'user_1' | 'user_2', SetEntry[]>
  onToggleSyncMode: (slotId: string) => void
  onSelectVariant: (
    profileId: 'user_1' | 'user_2',
    slotId: string,
    variantId: string,
    applyToBoth: boolean
  ) => void
  onChangeTechnique: (
    profileId: 'user_1' | 'user_2',
    slotId: string,
    technique: SetTechnique
  ) => void
  onUpdateSet: (
    profileId: 'user_1' | 'user_2',
    slotId: string,
    setIndex: number,
    updated: Partial<SetEntry>,
    triggerRestSeconds?: number,
    exerciseLabel?: string
  ) => void
  onAddSet: (profileId: 'user_1' | 'user_2', slotId: string) => void
  onSaveQuickStrengthTest: (
    profileId: 'user_1' | 'user_2',
    variantId: string,
    oneRmKg: number,
    slotId: string
  ) => void
  onOpenCalculatorForVariant: (
    profileId: 'user_1' | 'user_2',
    variant: ExerciseVariant,
    slotId: string
  ) => void
  onOpenGlossaryTopic: (topicId: string) => void
}

const TECHNIQUE_LABELS: Record<SetTechnique, { label: string; badge: string; glossaryId: string }> =
  {
    normal: {
      label: 'Series Normales',
      badge: 'bg-slate-800 text-slate-300 border-slate-700',
      glossaryId: 'rir-fallo'
    },
    pyramid_asc: {
      label: '🔺 Pirámide Ascendente',
      badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      glossaryId: 'piramidal'
    },
    pyramid_desc: {
      label: '🔻 Pirámide Inversa',
      badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
      glossaryId: 'piramidal'
    },
    dropset: {
      label: '📉 Dropset Final',
      badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      glossaryId: 'dropset'
    },
    failure: {
      label: '🔥 Al Fallo Técnico',
      badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      glossaryId: 'rir-fallo'
    }
  }

export const ExerciseSlotCard: React.FC<ExerciseSlotCardProps> = ({
  slot,
  profiles,
  primaryProfileId,
  activeProfileId,
  coupleViewMode,
  weightUnit,
  history,
  syncMode,
  techniqueByProfile,
  setsByProfile,
  onToggleSyncMode,
  onSelectVariant,
  onChangeTechnique,
  onUpdateSet,
  onAddSet,
  onSaveQuickStrengthTest,
  onOpenCalculatorForVariant,
  onOpenGlossaryTopic
}) => {
  const [showAlternativesModal, setShowAlternativesModal] = useState(false)
  const [showAnimation, setShowAnimation] = useState(false)
  const [showWeightChart, setShowWeightChart] = useState(false)
  const [showTips, setShowTips] = useState(false)

  const [inlineTestOpenByProfile, setInlineTestOpenByProfile] = useState<
    Record<'user_1' | 'user_2', boolean>
  >({
    user_1: false,
    user_2: false
  })
  const [quickWeightInput, setQuickWeightInput] = useState<Record<'user_1' | 'user_2', string>>({
    user_1: '20',
    user_2: '12'
  })
  const [quickRepsInput, setQuickRepsInput] = useState<Record<'user_1' | 'user_2', number>>({
    user_1: 8,
    user_2: 10
  })
  const [quickRirInput, setQuickRirInput] = useState<Record<'user_1' | 'user_2', number>>({
    user_1: 2,
    user_2: 2
  })

  const getOptionsForProfile = (profileId: 'user_1' | 'user_2'): ExerciseVariant[] => {
    const prof = profiles[profileId]
    if (
      syncMode === 'individual' &&
      prof.gender === 'female' &&
      slot.femaleFocusedPrimary
    ) {
      return [
        slot.femaleFocusedPrimary,
        ...(slot.femaleFocusedAlternatives || slot.alternatives)
      ]
    }
    return [slot.primaryExercise, ...slot.alternatives]
  }

  const getActiveVariantForProfile = (profileId: 'user_1' | 'user_2'): ExerciseVariant => {
    const options = getOptionsForProfile(profileId)
    const savedId = profiles[profileId].activeVariantBySlot[slot.slotId]
    return options.find((o) => o.id === savedId) || options[0]
  }

  const secondaryProfileId: 'user_1' | 'user_2' =
    primaryProfileId === 'user_1' ? 'user_2' : 'user_1'

  const profilesToRender: ('user_1' | 'user_2')[] =
    coupleViewMode === 'both' ? [primaryProfileId, secondaryProfileId] : [activeProfileId]

  const primaryVariant = getActiveVariantForProfile(primaryProfileId)
  const weightChartData = getExerciseWeightHistory(history, primaryVariant.id, weightUnit)

  return (
    <div
      className={`rounded-2xl border transition-all ${
        slot.supersetGroup
          ? 'bg-slate-900/90 border-indigo-500/40 shadow-lg shadow-indigo-950/20'
          : 'bg-slate-900/80 border-slate-800'
      } p-4`}
    >
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 text-xs font-bold flex items-center justify-center text-emerald-400">
            #{slot.order}
          </span>

          {slot.supersetGroup && (
            <button
              onClick={() => onOpenGlossaryTopic('superserie')}
              className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1 hover:bg-indigo-500/30"
            >
              <Layers className="w-3.5 h-3.5" />
              Superserie {slot.supersetGroup}
              <HelpCircle className="w-3 h-3 opacity-75" />
            </button>
          )}

          <button
            onClick={() => onToggleSyncMode(slot.slotId)}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
              syncMode === 'shared'
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                : 'bg-pink-500/15 text-pink-300 border-pink-500/30 hover:bg-pink-500/25'
            }`}
          >
            {syncMode === 'shared' ? (
              <>
                <Users className="w-3.5 h-3.5" />
                Mismo Ejercicio
              </>
            ) : (
              <>
                <User className="w-3.5 h-3.5" />
                Individual
              </>
            )}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Weight History Chart Toggle */}
          <button
            onClick={() => setShowWeightChart(!showWeightChart)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all ${
              showWeightChart
                ? 'bg-indigo-500 text-white border-indigo-400'
                : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/25'
            }`}
            title="Ver gráfico de evolución de peso de este ejercicio"
          >
            <LineChartIcon className="w-3.5 h-3.5" />
            Historial Peso
          </button>

          {/* Real Demonstration Toggle */}
          <button
            onClick={() => setShowAnimation(!showAnimation)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all ${
              showAnimation
                ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
            }`}
          >
            <PlayCircle className="w-3.5 h-3.5" />
            Demostración
          </button>

          {/* Busy Machine Toggle */}
          <button
            onClick={() => setShowAlternativesModal(!showAlternativesModal)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all ${
              showAlternativesModal
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
            }`}
          >
            <Shuffle className="w-3.5 h-3.5" />
            Máquina Ocupada (2)
          </button>

          <button
            onClick={() => setShowTips(!showTips)}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            title="Ver notas técnicas"
          >
            {showTips ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {syncMode === 'shared' && (
        <div className="mb-3">
          <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            {primaryVariant.name}
          </h3>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-400">
            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
              {primaryVariant.equipment}
            </span>
            <span>• {primaryVariant.muscleGroup}</span>
            <span className="flex items-center gap-1 text-slate-400">
              • <Clock className="w-3 h-3" /> Descanso: {slot.restSeconds}s
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1.5 bg-slate-950/60 border border-slate-800/80 rounded-xl px-3 py-2">
            💡 <span className="text-slate-300 font-medium">Técnica:</span> {primaryVariant.cues}
          </p>
        </div>
      )}

      {/* INLINE EXERCISE WEIGHT HISTORY CHART */}
      {showWeightChart && (
        <div className="mb-3.5 p-3.5 rounded-2xl bg-slate-950/95 border border-indigo-500/40 space-y-2.5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-extrabold text-indigo-300 flex items-center gap-1.5">
                <LineChartIcon className="w-4 h-4" />
                Historial de Peso Máximo — {primaryVariant.name} ({weightUnit.toUpperCase()})
              </span>
              <p className="text-[11px] text-slate-400">
                Evolución de las cargas registradas en sesiones anteriores
              </p>
            </div>
            <button
              onClick={() => setShowWeightChart(false)}
              className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-900"
            >
              Cerrar ✕
            </button>
          </div>

          {weightChartData.length > 0 ? (
            <div className="h-44 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis dataKey="date" stroke="#94A3B8" fontSize={11} />
                  <YAxis stroke="#94A3B8" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#334155',
                      borderRadius: '10px',
                      fontSize: '11px'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="user1Weight"
                    name={profiles.user_1.name}
                    stroke={profiles.user_1.accentColor}
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="user2Weight"
                    name={profiles.user_2.name}
                    stroke={profiles.user_2.accentColor}
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-4 text-center">
              Aún no hay sesiones registradas para este ejercicio. ¡Al finalizar la sesión de hoy
              aparecerá tu primer punto en la gráfica!
            </p>
          )}
        </div>
      )}

      {showAnimation && (
        <ExerciseAnimationViewer
          variant={primaryVariant}
          accentColor={profiles[primaryProfileId].accentColor}
          onClose={() => setShowAnimation(false)}
        />
      )}

      {showTips && (
        <div className="mb-3 p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/30 text-xs text-indigo-200 space-y-1">
          <p className="font-semibold">📌 Nota del Entrenador para este bloque:</p>
          <p>{slot.notes}</p>
        </div>
      )}

      {showAlternativesModal && (
        <div className="mb-4 p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              <Shuffle className="w-4 h-4" />
              ¿Máquina ocupada? Elige una de las 2 alternativas equivalentes:
            </span>
            <button
              onClick={() => setShowAlternativesModal(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Cerrar ✕
            </button>
          </div>

          {syncMode === 'shared' ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {getOptionsForProfile(primaryProfileId).map((option, idx) => {
                const isSelected = primaryVariant.id === option.id
                return (
                  <button
                    key={option.id}
                    onClick={() => {
                      onSelectVariant(primaryProfileId, slot.slotId, option.id, true)
                      setShowAlternativesModal(false)
                    }}
                    className={`text-left p-2.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-400 text-white'
                        : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-semibold text-amber-300">
                        {idx === 0 ? '⭐ Opción Principal' : `Opción Alternativa ${idx}`}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                        {option.equipment}
                      </span>
                    </div>
                    <p className="text-xs font-bold">{option.name}</p>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{option.cues}</p>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {profilesToRender.map((pid) => {
                const prof = profiles[pid]
                const activeVar = getActiveVariantForProfile(pid)
                const opts = getOptionsForProfile(pid)
                return (
                  <div key={pid} className="space-y-1.5">
                    <p className="text-xs font-bold" style={{ color: prof.accentColor }}>
                      Variantes para {prof.name}:
                    </p>
                    {opts.map((option, idx) => {
                      const isSelected = activeVar.id === option.id
                      return (
                        <button
                          key={option.id}
                          onClick={() => onSelectVariant(pid, slot.slotId, option.id, false)}
                          className={`w-full text-left p-2 rounded-lg border text-xs flex items-center justify-between ${
                            isSelected
                              ? 'bg-slate-800 border-emerald-400 text-white'
                              : 'bg-slate-950/70 border-slate-800 text-slate-400'
                          }`}
                        >
                          <span>
                            <strong>{idx === 0 ? 'Principal:' : `Alt ${idx}:`}</strong>{' '}
                            {option.name}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900">
                            {option.equipment}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div
        className={`grid gap-4 ${
          profilesToRender.length === 2 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
        }`}
      >
        {profilesToRender.map((pid, renderIdx) => {
          const profile = profiles[pid]
          const activeVariant = getActiveVariantForProfile(pid)
          const technique = techniqueByProfile[pid] || slot.defaultTechnique
          const sets = setsByProfile[pid] || []
          const oneRmKg = profile.estimated1RMByVariant[activeVariant.id] || 0
          const isFirstTimeExercise = oneRmKg <= 0
          const techInfo = TECHNIQUE_LABELS[technique]
          const inlineTestOpen = inlineTestOpenByProfile[pid]

          const qWeightKg = parseInputToKg(
            parseFloat(quickWeightInput[pid]) || 0,
            weightUnit
          )
          const qEstimated1Rm = calculateSafe1RM(
            qWeightKg,
            quickRepsInput[pid],
            quickRirInput[pid]
          )
          const qZones = getIdealWeightZones(qEstimated1Rm)

          return (
            <div
              key={pid}
              className={`rounded-xl p-3 border ${
                profile.gender === 'female'
                  ? 'bg-pink-950/10 border-pink-500/25'
                  : 'bg-emerald-950/10 border-emerald-500/25'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 pb-2 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: profile.accentColor }}
                  />
                  <span className="text-xs font-bold tracking-wide text-white">
                    {profile.name}
                  </span>
                  {renderIdx === 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300 border border-slate-700">
                      Principal
                    </span>
                  )}
                  {oneRmKg > 0 && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      1RM: {displayWeightValue(oneRmKg, weightUnit)} {weightUnit}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => onOpenCalculatorForVariant(pid, activeVariant, slot.slotId)}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-emerald-300 border border-slate-700 flex items-center gap-1"
                >
                  <Target className="w-3 h-3" />
                  Calibrar Peso
                </button>
              </div>

              {syncMode === 'individual' && (
                <div className="mb-2.5 bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Dumbbell className="w-3.5 h-3.5 text-slate-400" />
                      {activeVariant.name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                      {activeVariant.equipment}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">{activeVariant.cues}</p>
                </div>
              )}

              {isFirstTimeExercise && (
                <div className="mb-3 p-3 rounded-xl bg-gradient-to-r from-amber-950/40 via-slate-950 to-emerald-950/30 border border-amber-500/40 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-amber-200">
                          Primera vez de {profile.name} en {activeVariant.name}
                        </p>
                        <p className="text-[11px] text-slate-300 mt-0.5">
                          Haz una serie de prueba con un peso cómodo (5-10 reps sin llegar al
                          fallo) para fijar tus pesos ideales automáticamente.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        setInlineTestOpenByProfile((prev) => ({
                          ...prev,
                          [pid]: !prev[pid]
                        }))
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-[11px] shrink-0"
                    >
                      {inlineTestOpen ? 'Cerrar' : '⚡ Hacer Prueba'}
                    </button>
                  </div>

                  {inlineTestOpen && (
                    <div className="pt-2 border-t border-amber-500/30 space-y-2.5">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-300 block mb-1">
                            Peso usado ({weightUnit.toUpperCase()})
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            value={quickWeightInput[pid]}
                            onChange={(e) =>
                              setQuickWeightInput((prev) => ({
                                ...prev,
                                [pid]: e.target.value
                              }))
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-300 block mb-1">
                            Reps logradas
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="20"
                            value={quickRepsInput[pid]}
                            onChange={(e) =>
                              setQuickRepsInput((prev) => ({
                                ...prev,
                                [pid]: parseInt(e.target.value, 10) || 1
                              }))
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-300 block mb-1">
                            En recámara (RIR)
                          </label>
                          <select
                            value={quickRirInput[pid]}
                            onChange={(e) =>
                              setQuickRirInput((prev) => ({
                                ...prev,
                                [pid]: parseInt(e.target.value, 10)
                              }))
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-white"
                          >
                            <option value={1}>RIR 1 (Casi límite)</option>
                            <option value={2}>RIR 2 (Seguro Ideal)</option>
                            <option value={3}>RIR 3 (Cómodo)</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/90 p-2 rounded-lg">
                        <span className="text-[11px] text-emerald-300">
                          Peso Ideal Sugerido (8-10 reps):{' '}
                          <strong>{formatDualWeight(qZones.hypertrophyKg, weightUnit)}</strong>
                        </span>
                        <button
                          onClick={() => {
                            onSaveQuickStrengthTest(
                              pid,
                              activeVariant.id,
                              qEstimated1Rm,
                              slot.slotId
                            )
                            setInlineTestOpenByProfile((prev) => ({ ...prev, [pid]: false }))
                          }}
                          className="px-3 py-1 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs"
                        >
                          ✓ Fijar Peso Ideal
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-1.5 mb-3">
                <div className="flex flex-wrap items-center gap-1">
                  {(
                    [
                      'normal',
                      'pyramid_asc',
                      'pyramid_desc',
                      'dropset',
                      'failure'
                    ] as SetTechnique[]
                  ).map((tech) => {
                    const active = technique === tech
                    return (
                      <button
                        key={tech}
                        onClick={() => onChangeTechnique(pid, slot.slotId, tech)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                          active
                            ? TECHNIQUE_LABELS[tech].badge
                            : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
                        }`}
                      >
                        {tech === 'normal' && 'Normal'}
                        {tech === 'pyramid_asc' && '🔺 Pirámide Asc.'}
                        {tech === 'pyramid_desc' && '🔻 Pirámide Inv.'}
                        {tech === 'dropset' && '📉 Dropset'}
                        {tech === 'failure' && '🔥 Al Fallo'}
                      </button>
                    )
                  })}
                </div>

                <button
                  onClick={() => onOpenGlossaryTopic(techInfo.glossaryId)}
                  className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-0.5"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  Guía
                </button>
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-slate-400 px-1">
                  <div className="col-span-2">Serie</div>
                  <div className="col-span-4">Peso ({weightUnit.toUpperCase()})</div>
                  <div className="col-span-3">Reps (Meta)</div>
                  <div className="col-span-3 text-right">Listo</div>
                </div>

                {sets.map((s, idx) => {
                  const shownWeight = displayWeightValue(s.weightKg, weightUnit)
                  const secondaryWeight =
                    weightUnit === 'kg'
                      ? `${kgToLb(s.weightKg)} lb`
                      : `${Math.round(s.weightKg * 10) / 10} kg`

                  const isPyramidStep =
                    technique === 'pyramid_asc' || technique === 'pyramid_desc'
                  const isLastSet = idx === sets.length - 1

                  return (
                    <div key={s.setNumber} className="space-y-1.5">
                      <div
                        className={`grid grid-cols-12 gap-1.5 items-center p-2 rounded-xl border transition-all ${
                          s.completed
                            ? 'bg-emerald-500/15 border-emerald-500/40'
                            : 'bg-slate-950/80 border-slate-800/90'
                        }`}
                      >
                        <div className="col-span-2 flex items-center gap-1">
                          <span className="w-6 h-6 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold flex items-center justify-center text-slate-200">
                            {s.setNumber}
                          </span>
                          {isPyramidStep &&
                            (technique === 'pyramid_asc' ? (
                              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                            ) : (
                              <TrendingDown className="w-3.5 h-3.5 text-purple-400" />
                            ))}
                          {(s.isFailure || (technique === 'failure' && isLastSet)) && (
                            <span title="Serie Al Fallo Técnico (RIR 0)">
                              <Flame className="w-3.5 h-3.5 text-rose-400" />
                            </span>
                          )}
                        </div>

                        <div className="col-span-4">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              placeholder="Prueba"
                              value={shownWeight || ''}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value)
                                const weightKg = parseInputToKg(
                                  isNaN(val) ? 0 : val,
                                  weightUnit
                                )
                                onUpdateSet(pid, slot.slotId, idx, { weightKg })
                              }}
                              className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-400 rounded-lg px-2 py-1 text-sm font-bold text-white outline-none"
                            />
                          </div>
                          <span className="text-[10px] text-slate-400 block mt-0.5 pl-0.5">
                            {s.weightKg > 0 ? `≈ ${secondaryWeight}` : 'Haz prueba ↑'}
                          </span>
                        </div>

                        <div className="col-span-3">
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={s.actualReps}
                            onChange={(e) => {
                              const reps = parseInt(e.target.value, 10)
                              onUpdateSet(pid, slot.slotId, idx, {
                                actualReps: isNaN(reps) ? 0 : reps
                              })
                            }}
                            className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-400 rounded-lg px-2 py-1 text-sm font-bold text-white outline-none"
                          />
                          <span className="text-[10px] text-slate-400 block mt-0.5 pl-0.5">
                            Meta: {s.targetReps}
                          </span>
                        </div>

                        <div className="col-span-3 flex items-center justify-end gap-1">
                          <button
                            onClick={() =>
                              onUpdateSet(pid, slot.slotId, idx, { isFailure: !s.isFailure })
                            }
                            className={`p-1.5 rounded-lg border transition-colors ${
                              s.isFailure
                                ? 'bg-rose-500/25 border-rose-500/50 text-rose-300'
                                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                            }`}
                            title="Marcar esta serie Al Fallo (🔥)"
                          >
                            <Flame className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              const nextCompleted = !s.completed
                              if (nextCompleted && isFirstTimeExercise && s.weightKg > 0) {
                                const auto1Rm = calculateSafe1RM(
                                  s.weightKg,
                                  s.actualReps || 10,
                                  2
                                )
                                onSaveQuickStrengthTest(
                                  pid,
                                  activeVariant.id,
                                  auto1Rm,
                                  slot.slotId
                                )
                              }
                              onUpdateSet(
                                pid,
                                slot.slotId,
                                idx,
                                { completed: nextCompleted },
                                nextCompleted ? slot.restSeconds : undefined,
                                `${profile.name} • ${activeVariant.name} (Serie ${s.setNumber})`
                              )
                            }}
                            className={`px-2.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1 border transition-all ${
                              s.completed
                                ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20'
                                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            <Check className="w-4 h-4 stroke-[2.5]" />
                          </button>
                        </div>
                      </div>

                      {technique === 'dropset' && isLastSet && (
                        <div className="ml-4 pl-3 border-l-2 border-cyan-500/40 space-y-1.5 py-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-cyan-300">
                              📉 Escalones de Dropset (sin descanso entre bajadas):
                            </span>
                            {(!s.drops || s.drops.length === 0) && (
                              <button
                                onClick={() =>
                                  onUpdateSet(pid, slot.slotId, idx, {
                                    drops: generateDropSubSets(s.weightKg)
                                  })
                                }
                                className="text-[11px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                              >
                                + Generar 2 Drops (-20%)
                              </button>
                            )}
                          </div>

                          {(s.drops || []).map((drop, dIdx) => (
                            <div
                              key={drop.id}
                              className="flex items-center justify-between gap-2 bg-cyan-950/20 border border-cyan-500/30 rounded-lg px-2.5 py-1.5 text-xs"
                            >
                              <span className="font-semibold text-cyan-300">
                                Drop {dIdx + 1}:
                              </span>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  step="0.5"
                                  value={displayWeightValue(drop.weightKg, weightUnit)}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value)
                                    const nextDrops = [...(s.drops || [])]
                                    nextDrops[dIdx] = {
                                      ...drop,
                                      weightKg: parseInputToKg(
                                        isNaN(val) ? 0 : val,
                                        weightUnit
                                      )
                                    }
                                    onUpdateSet(pid, slot.slotId, idx, { drops: nextDrops })
                                  }}
                                  className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-white font-bold"
                                />
                                <span className="text-slate-400">{weightUnit} ×</span>
                                <input
                                  type="number"
                                  value={drop.reps}
                                  onChange={(e) => {
                                    const reps = parseInt(e.target.value, 10)
                                    const nextDrops = [...(s.drops || [])]
                                    nextDrops[dIdx] = {
                                      ...drop,
                                      reps: isNaN(reps) ? 0 : reps
                                    }
                                    onUpdateSet(pid, slot.slotId, idx, { drops: nextDrops })
                                  }}
                                  className="w-12 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-white font-bold"
                                />
                                <span className="text-slate-400">reps</span>
                              </div>
                              <button
                                onClick={() => {
                                  const nextDrops = [...(s.drops || [])]
                                  nextDrops[dIdx] = { ...drop, completed: !drop.completed }
                                  onUpdateSet(pid, slot.slotId, idx, { drops: nextDrops })
                                }}
                                className={`p-1 rounded ${
                                  drop.completed
                                    ? 'bg-cyan-400 text-slate-950'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="mt-2.5 flex items-center justify-between">
                <button
                  onClick={() => onAddSet(pid, slot.slotId)}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-slate-800/60 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Añadir serie extra
                </button>
                <span className="text-[11px] text-slate-400">
                  {sets.filter((x) => x.completed).length}/{sets.length} series listas
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
