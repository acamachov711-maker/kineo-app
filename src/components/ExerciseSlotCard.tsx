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
  generateDropSubSets,
  calculateSafe1RM,
  formatDualWeight,
  getIdealWeightZones,
  getExerciseWeightHistory,
  getLoadInstruction
} from '../utils/fitnessMath'
import { ExerciseAnimationViewer } from './ExerciseAnimationViewer'

interface ExerciseSlotCardProps {
  slot: ExerciseSlot
  isExpanded: boolean
  onToggleExpand: () => void
  profiles: Record<'user_1' | 'user_2', UserProfile>
  primaryProfileId: 'user_1' | 'user_2'
  activeProfileId: 'user_1' | 'user_2'
  coupleModeEnabled: boolean
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
      label: 'Normal',
      badge: 'bg-slate-800 text-slate-200 border-slate-600',
      glossaryId: 'rir-fallo'
    },
    pyramid_asc: {
      label: '🔺 Pirámide Asc.',
      badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      glossaryId: 'piramidal'
    },
    pyramid_desc: {
      label: '🔻 Pirámide Inv.',
      badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
      glossaryId: 'piramidal'
    },
    dropset: {
      label: '📉 Dropset',
      badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      glossaryId: 'dropset'
    },
    failure: {
      label: '🔥 Al Fallo',
      badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      glossaryId: 'rir-fallo'
    }
  }

export const ExerciseSlotCard: React.FC<ExerciseSlotCardProps> = ({
  slot,
  isExpanded,
  onToggleExpand,
  profiles,
  primaryProfileId,
  activeProfileId,
  coupleModeEnabled,
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
  const [quickRepsInput, setQuickRepsInput] = useState<Record<'user_1' | 'user_2', string>>({
    user_1: '8',
    user_2: '10'
  })
  const [quickWeightMode, setQuickWeightMode] = useState<
    Record<'user_1' | 'user_2', 'total' | 'per_side'>
  >({
    user_1: 'total',
    user_2: 'total'
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

  const pid = activeProfileId
  const profile = profiles[pid]
  const activeVariant = getActiveVariantForProfile(pid)
  const technique = techniqueByProfile[pid] || slot.defaultTechnique
  const sets = setsByProfile[pid] || []
  const completedCount = sets.filter((s) => s.completed).length
  const allSetsDone = sets.length > 0 && completedCount === sets.length

  const oneRmKg = profile.estimated1RMByVariant[activeVariant.id] || 0
  const isFirstTimeExercise = oneRmKg <= 0
  const techInfo = TECHNIQUE_LABELS[technique]
  const inlineTestOpen = inlineTestOpenByProfile[pid]

  const isBilateralPlates =
    activeVariant.equipment === 'Barra' ||
    (activeVariant.equipment === 'Máquina' &&
      (activeVariant.name.toLowerCase().includes('prensa') ||
        activeVariant.name.toLowerCase().includes('hack')))

  const rawTestWeight = parseFloat(quickWeightInput[pid]) || 0
  const effectiveTestWeight =
    isBilateralPlates && quickWeightMode[pid] === 'per_side' ? rawTestWeight * 2 : rawTestWeight

  const qWeightKg = parseInputToKg(effectiveTestWeight, weightUnit)
  const parsedQuickReps = Math.max(1, parseInt(quickRepsInput[pid], 10) || 1)
  const qEstimated1Rm = calculateSafe1RM(qWeightKg, parsedQuickReps, quickRirInput[pid])
  const qZones = getIdealWeightZones(qEstimated1Rm)

  const weightChartData = getExerciseWeightHistory(history, activeVariant.id, weightUnit)

  // Secondary partner progress badge when in couple mode
  const partnerId: 'user_1' | 'user_2' = pid === 'user_1' ? 'user_2' : 'user_1'
  const partnerSets = setsByProfile[partnerId] || []
  const partnerDoneCount = partnerSets.filter((s) => s.completed).length

  return (
    <div
      className={`rounded-2xl border transition-all ${
        allSetsDone
          ? 'bg-emerald-950/15 border-emerald-500/40'
          : isExpanded
          ? 'bg-slate-900/95 border-slate-700 shadow-xl'
          : 'bg-slate-900/75 border-slate-800/90 hover:border-slate-700'
      }`}
    >
      {/* ACCORDION HEADER (Always visible — tap to expand/collapse) */}
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full text-left p-3.5 sm:p-4 flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`w-8 h-8 rounded-xl text-xs font-black flex items-center justify-center shrink-0 border ${
              allSetsDone
                ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                : 'bg-slate-800 text-emerald-400 border-slate-700'
            }`}
          >
            {allSetsDone ? <Check className="w-4 h-4 stroke-[3]" /> : `#${slot.order}`}
          </span>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="text-sm sm:text-base font-extrabold text-white truncate">
                {activeVariant.name}
              </h3>
              {slot.supersetGroup && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  {slot.supersetGroup}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-slate-400">
              <span className="text-slate-300 font-semibold">{activeVariant.equipment}</span>
              <span>• {activeVariant.muscleGroup}</span>
              <span>• ⏱ {slot.restSeconds}s</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <span
              className={`text-xs font-extrabold px-2.5 py-1 rounded-lg border block ${
                allSetsDone
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-950 text-slate-200 border-slate-800'
              }`}
            >
              {completedCount}/{sets.length} series
            </span>
            {coupleModeEnabled && (
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {profiles[partnerId].name}: {partnerDoneCount}/{partnerSets.length}
              </span>
            )}
          </div>
          <div className="p-1.5 rounded-xl bg-slate-800/90 text-slate-300 border border-slate-700">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </button>

      {/* EXPANDED CONTENT (Only rendered for the 1 active open exercise) */}
      {isExpanded && (
        <div className="px-3.5 sm:px-4 pb-4 pt-1 border-t border-slate-800/80 space-y-3">
          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowAnimation(!showAnimation)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1 transition-all ${
                  showAnimation
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                }`}
              >
                <PlayCircle className="w-3.5 h-3.5" />
                Demo
              </button>

              <button
                type="button"
                onClick={() => setShowAlternativesModal(!showAlternativesModal)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1 transition-all ${
                  showAlternativesModal
                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                }`}
              >
                <Shuffle className="w-3.5 h-3.5" />
                Cambiar Máquina
              </button>

              <button
                type="button"
                onClick={() => setShowWeightChart(!showWeightChart)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1 transition-all ${
                  showWeightChart
                    ? 'bg-indigo-500 text-white border-indigo-400'
                    : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                }`}
              >
                <LineChartIcon className="w-3.5 h-3.5" />
                Historial
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              {coupleModeEnabled && (
                <button
                  type="button"
                  onClick={() => onToggleSyncMode(slot.slotId)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1 ${
                    syncMode === 'shared'
                      ? 'bg-slate-800 text-emerald-300 border-slate-700'
                      : 'bg-pink-500/15 text-pink-300 border-pink-500/30'
                  }`}
                >
                  {syncMode === 'shared' ? (
                    <>
                      <Users className="w-3.5 h-3.5" />
                      Compartido
                    </>
                  ) : (
                    <>
                      <User className="w-3.5 h-3.5" />
                      Individual
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => onOpenCalculatorForVariant(pid, activeVariant, slot.slotId)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-emerald-300 border border-slate-700 flex items-center gap-1"
              >
                <Target className="w-3.5 h-3.5" />
                Calibrar
              </button>
            </div>
          </div>

          {/* ALWAYS ACTIVE COACH NOTE & TECHNIQUE CUES (Concise & Direct) */}
          <div className="p-2.5 rounded-xl bg-indigo-950/25 border border-indigo-500/30 text-xs space-y-1">
            <p className="text-indigo-200 leading-snug">
              <strong className="text-indigo-300">📌 Entrenador:</strong> {slot.notes}
            </p>
            <p className="text-slate-300 leading-snug">
              <strong className="text-emerald-300">💡 Técnica:</strong> {activeVariant.cues}
            </p>
          </div>

          {/* INLINE EXERCISE WEIGHT HISTORY CHART */}
          {showWeightChart && (
            <div className="p-3 rounded-2xl bg-slate-950/95 border border-indigo-500/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-indigo-300 flex items-center gap-1.5">
                  <LineChartIcon className="w-4 h-4" />
                  Evolución en {activeVariant.name} ({weightUnit.toUpperCase()})
                </span>
                <button
                  type="button"
                  onClick={() => setShowWeightChart(false)}
                  className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-900"
                >
                  Cerrar ✕
                </button>
              </div>

              {weightChartData.length > 0 ? (
                <div className="h-40 w-full pt-1">
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
                      {coupleModeEnabled && (
                        <Line
                          type="monotone"
                          dataKey="user2Weight"
                          name={profiles.user_2.name}
                          stroke={profiles.user_2.accentColor}
                          strokeWidth={2.5}
                          dot={{ r: 4 }}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-3 text-center">
                  Sin registros previos aún. Al guardar hoy verás tu gráfica.
                </p>
              )}
            </div>
          )}

          {showAnimation && (
            <ExerciseAnimationViewer
              variant={activeVariant}
              accentColor={profile.accentColor}
              onClose={() => setShowAnimation(false)}
            />
          )}

          {showAlternativesModal && (
            <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Shuffle className="w-3.5 h-3.5" />
                  Alternativas para {activeVariant.name}:
                </span>
                <button
                  type="button"
                  onClick={() => setShowAlternativesModal(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cerrar ✕
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {getOptionsForProfile(pid).map((option, idx) => {
                  const isSelected = activeVariant.id === option.id
                  return (
                    <button
                      type="button"
                      key={option.id}
                      onClick={() => {
                        onSelectVariant(pid, slot.slotId, option.id, syncMode === 'shared')
                        setShowAlternativesModal(false)
                      }}
                      className={`text-left p-2.5 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-amber-500/20 border-amber-400 text-white'
                          : 'bg-slate-900/90 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] mb-0.5">
                        <span className="font-semibold text-amber-300">
                          {idx === 0 ? '⭐ Principal' : `Alternativa ${idx}`}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                          {option.equipment}
                        </span>
                      </div>
                      <p className="text-xs font-bold">{option.name}</p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* QUICK FIRST-TIME STRENGTH TEST (Supports 21+ reps, free backspace, and bilateral per-side toggle) */}
          {isFirstTimeExercise && (
            <div className="p-3 rounded-xl bg-gradient-to-r from-amber-950/40 via-slate-950 to-emerald-950/30 border border-amber-500/40 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-amber-200">
                      Calibrar peso de {profile.name}
                    </p>
                    <p className="text-[11px] text-slate-300">
                      Haz 1 serie de prueba y anota cuántas repeticiones lograste.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setInlineTestOpenByProfile((prev) => ({
                      ...prev,
                      [pid]: !prev[pid]
                    }))
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shrink-0"
                >
                  {inlineTestOpen ? 'Cerrar' : '⚡ Hacer Prueba'}
                </button>
              </div>

              {inlineTestOpen && (
                <div className="pt-2 border-t border-amber-500/30 space-y-2.5">
                  {isBilateralPlates && (
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                      <span className="text-[11px] text-amber-200 font-semibold">
                        ⚖️ ¿Anotarás el peso total o el de 1 solo lado?
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setQuickWeightMode((prev) => ({ ...prev, [pid]: 'total' }))
                          }
                          className={`px-2 py-1 rounded text-[11px] font-bold ${
                            quickWeightMode[pid] === 'total'
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          Peso Total
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setQuickWeightMode((prev) => ({ ...prev, [pid]: 'per_side' }))
                          }
                          className={`px-2 py-1 rounded text-[11px] font-bold ${
                            quickWeightMode[pid] === 'per_side'
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          Por Lado (×2)
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-300 block mb-1">
                        {isBilateralPlates && quickWeightMode[pid] === 'per_side'
                          ? `Peso/lado (${weightUnit.toUpperCase()})`
                          : `Peso (${weightUnit.toUpperCase()})`}
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Ej. 20"
                        value={quickWeightInput[pid]}
                        onChange={(e) => {
                          const cleaned = e.target.value.replace(/[^0-9.]/g, '')
                          setQuickWeightInput((prev) => ({
                            ...prev,
                            [pid]: cleaned
                          }))
                        }}
                        className="w-full bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-lg px-2.5 py-1.5 text-sm font-bold text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-300 block mb-1">
                        Reps logradas
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Ej. 12 o 21"
                        value={quickRepsInput[pid]}
                        onChange={(e) => {
                          const digits = e.target.value
                            .replace(/[^0-9]/g, '')
                            .replace(/^0+(?=\d)/, '')
                          setQuickRepsInput((prev) => ({
                            ...prev,
                            [pid]: digits
                          }))
                        }}
                        className="w-full bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-lg px-2.5 py-1.5 text-sm font-bold text-white outline-none"
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
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-bold text-white"
                      >
                        <option value={0}>RIR 0 (Al límite)</option>
                        <option value={1}>RIR 1 (Casi límite)</option>
                        <option value={2}>RIR 2 (Seguro Ideal)</option>
                        <option value={3}>RIR 3 (Cómodo)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/95 p-2.5 rounded-lg border border-emerald-500/30">
                    <div>
                      <span className="text-xs text-emerald-300 block">
                        Peso Ideal Sugerido:{' '}
                        <strong>{formatDualWeight(qZones.hypertrophyKg, weightUnit)}</strong>
                      </span>
                      <span className="text-[11px] text-amber-300 font-semibold block mt-0.5">
                        👉{' '}
                        {getLoadInstruction(
                          qZones.hypertrophyKg,
                          activeVariant.equipment,
                          activeVariant.name,
                          weightUnit
                        )}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (qEstimated1Rm <= 0) return
                        onSaveQuickStrengthTest(pid, activeVariant.id, qEstimated1Rm, slot.slotId)
                        setInlineTestOpenByProfile((prev) => ({ ...prev, [pid]: false }))
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-extrabold text-xs"
                    >
                      ✓ Fijar Peso Ideal
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TECHNIQUE SELECTOR */}
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex flex-wrap items-center gap-1">
              {(
                ['normal', 'pyramid_asc', 'pyramid_desc', 'dropset', 'failure'] as SetTechnique[]
              ).map((tech) => {
                const active = technique === tech
                return (
                  <button
                    type="button"
                    key={tech}
                    onClick={() => onChangeTechnique(pid, slot.slotId, tech)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                      active
                        ? TECHNIQUE_LABELS[tech].badge
                        : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {TECHNIQUE_LABELS[tech].label}
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              onClick={() => onOpenGlossaryTopic(techInfo.glossaryId)}
              className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-0.5"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              Guía
            </button>
          </div>

          {/* SETS TABLE FOR ACTIVE USER */}
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-slate-400 px-1">
              <div className="col-span-2">Serie</div>
              <div className="col-span-5">Peso ({weightUnit.toUpperCase()}) y Carga</div>
              <div className="col-span-3">Reps (Meta {slot.defaultTargetReps})</div>
              <div className="col-span-2 text-right">Listo</div>
            </div>

            {sets.map((s, idx) => {
              const shownWeight = displayWeightValue(s.weightKg, weightUnit)
              const loadHint = getLoadInstruction(
                s.weightKg,
                activeVariant.equipment,
                activeVariant.name,
                weightUnit
              )

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
                        <Flame className="w-3.5 h-3.5 text-rose-400" />
                      )}
                    </div>

                    <div className="col-span-5">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0"
                        value={shownWeight > 0 ? String(shownWeight) : ''}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9.]/g, '').replace(/^0+(?=\d)/, '')
                          const val = parseFloat(raw)
                          const weightKg = parseInputToKg(isNaN(val) ? 0 : val, weightUnit)
                          onUpdateSet(pid, slot.slotId, idx, { weightKg })
                        }}
                        className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-400 rounded-lg px-2.5 py-1 text-sm font-bold text-white outline-none"
                      />
                      <span className="text-[10px] text-amber-300/95 font-medium block mt-0.5 pl-0.5 leading-tight">
                        {s.weightKg > 0 ? loadHint : 'Ingresa peso o haz prueba ↑'}
                      </span>
                    </div>

                    <div className="col-span-3">
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder={s.targetReps}
                        value={s.actualReps > 0 ? String(s.actualReps) : ''}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '')
                          const reps = parseInt(raw, 10)
                          onUpdateSet(pid, slot.slotId, idx, {
                            actualReps: isNaN(reps) ? 0 : reps
                          })
                        }}
                        className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-400 rounded-lg px-2.5 py-1 text-sm font-bold text-white outline-none"
                      />
                      <span className="text-[10px] text-slate-400 block mt-0.5 pl-0.5">
                        Meta: {s.targetReps}
                      </span>
                    </div>

                    <div className="col-span-2 flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const nextCompleted = !s.completed
                          const finalReps =
                            s.actualReps > 0
                              ? s.actualReps
                              : parseInt(s.targetReps, 10) || 10
                          if (nextCompleted && isFirstTimeExercise && s.weightKg > 0) {
                            const auto1Rm = calculateSafe1RM(s.weightKg, finalReps, 2)
                            onSaveQuickStrengthTest(pid, activeVariant.id, auto1Rm, slot.slotId)
                          }
                          onUpdateSet(
                            pid,
                            slot.slotId,
                            idx,
                            {
                              completed: nextCompleted,
                              actualReps: s.actualReps > 0 ? s.actualReps : finalReps
                            },
                            nextCompleted ? slot.restSeconds : undefined,
                            `${profile.name} • ${activeVariant.name} (Serie ${s.setNumber})`
                          )
                        }}
                        className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center justify-center border transition-all ${
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
                    <div className="ml-3 pl-3 border-l-2 border-cyan-500/40 space-y-1.5 py-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-cyan-300">
                          📉 Escalones de Dropset (sin descanso):
                        </span>
                        {(!s.drops || s.drops.length === 0) && (
                          <button
                            type="button"
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

                      {(s.drops || []).map((drop, dIdx) => {
                        const shownDropW = displayWeightValue(drop.weightKg, weightUnit)
                        return (
                          <div
                            key={drop.id}
                            className="flex items-center justify-between gap-2 bg-cyan-950/20 border border-cyan-500/30 rounded-lg px-2.5 py-1.5 text-xs"
                          >
                            <span className="font-semibold text-cyan-300">Drop {dIdx + 1}:</span>
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={shownDropW > 0 ? String(shownDropW) : ''}
                                onChange={(e) => {
                                  const raw = e.target.value
                                    .replace(/[^0-9.]/g, '')
                                    .replace(/^0+(?=\d)/, '')
                                  const val = parseFloat(raw)
                                  const nextDrops = [...(s.drops || [])]
                                  nextDrops[dIdx] = {
                                    ...drop,
                                    weightKg: parseInputToKg(isNaN(val) ? 0 : val, weightUnit)
                                  }
                                  onUpdateSet(pid, slot.slotId, idx, { drops: nextDrops })
                                }}
                                className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-white font-bold"
                              />
                              <span className="text-slate-400">{weightUnit} ×</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={drop.reps > 0 ? String(drop.reps) : ''}
                                onChange={(e) => {
                                  const raw = e.target.value
                                    .replace(/[^0-9]/g, '')
                                    .replace(/^0+(?=\d)/, '')
                                  const reps = parseInt(raw, 10)
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
                              type="button"
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
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="pt-1 flex items-center justify-between">
            <button
              type="button"
              onClick={() => onAddSet(pid, slot.slotId)}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-slate-800/60"
            >
              <Plus className="w-3.5 h-3.5" />
              Añadir serie extra
            </button>
            <span className="text-[11px] text-slate-400">
              {completedCount}/{sets.length} series listas ({profile.name})
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
