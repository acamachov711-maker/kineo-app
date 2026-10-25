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
      badge: 'theme-bg theme-border',
      glossaryId: 'rir-fallo'
    },
    pyramid_asc: {
      label: '🔺 Pirámide Asc.',
      badge: 'theme-bg theme-border',
      glossaryId: 'piramidal'
    },
    pyramid_desc: {
      label: '🔻 Pirámide Inv.',
      badge: 'theme-bg theme-border',
      glossaryId: 'piramidal'
    },
    dropset: {
      label: '📉 Dropset',
      badge: 'theme-bg theme-border',
      glossaryId: 'dropset'
    },
    failure: {
      label: '🔥 Al Fallo',
      badge: 'theme-bg theme-border',
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
      className={`rounded-[10px] border transition-all ${
        isExpanded
          ? 'bg-[#181420] border-[#FF5500] shadow-xl'
          : allSetsDone
          ? 'bg-[#14111A] border-[#10B981]/50'
          : 'bg-[#14111A] border-[#2A2533] hover:border-[#3A3345]'
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
            className={`w-7 h-7 rounded-md font-mono text-[11px] font-bold flex items-center justify-center shrink-0 border ${
              allSetsDone
                ? 'bg-[#10B981] text-[#0B090E] border-[#10B981]'
                : 'bg-[#0B090E] theme-text border-[#2A2533]'
            }`}
          >
            {allSetsDone ? <Check className="w-4 h-4 stroke-[3]" /> : `#${slot.order}`}
          </span>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="text-sm font-bold text-white truncate">{activeVariant.name}</h3>
              {slot.supersetGroup && (
                <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-[#0B090E] text-[#C4B5FD] border border-[#8B5CF6]/50">
                  {slot.supersetGroup}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-0.5 font-mono text-[10px] uppercase tracking-[0.04em] text-[#A09BA8]">
              <span className="text-[#E2DFEA] font-semibold">{activeVariant.equipment}</span>
              <span>• {activeVariant.muscleGroup}</span>
              <span>• {slot.restSeconds}s</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <span
              className={`font-mono text-[11px] font-bold px-2 py-1 rounded border block ${
                allSetsDone
                  ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/40'
                  : 'bg-[#0B090E] text-white border-[#2A2533]'
              }`}
            >
              {completedCount}/{sets.length} listas
            </span>
            {coupleModeEnabled && (
              <span className="font-mono text-[10px] text-[#A09BA8] block mt-0.5">
                {profiles[partnerId].name}: {partnerDoneCount}/{partnerSets.length}
              </span>
            )}
          </div>
          <div className="p-1.5 rounded-md bg-[#0B090E] text-[#A09BA8] border border-[#2A2533]">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </button>
      {/* EXPANDED CONTENT (Only rendered for the 1 active open exercise) */}
      {isExpanded && (
        <div className="px-3.5 sm:px-4 pb-4 pt-1 border-t border-[#2A2533] space-y-3">
          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowAnimation(!showAnimation)}
                className={`px-2.5 py-1.5 rounded-md font-mono text-[10px] font-bold uppercase tracking-[0.04em] border flex items-center gap-1 transition-all ${
                  showAnimation ? 'theme-bg theme-border' : 'bg-[#0B090E] text-[#C7C3D1] border-[#2A2533]'
                }`}
              >
                <PlayCircle className="w-3.5 h-3.5" />
                Demo
              </button>

              <button
                type="button"
                onClick={() => setShowAlternativesModal(!showAlternativesModal)}
                className={`px-2.5 py-1.5 rounded-md font-mono text-[10px] font-bold uppercase tracking-[0.04em] border flex items-center gap-1 transition-all ${
                  showAlternativesModal ? 'theme-bg theme-border' : 'bg-[#0B090E] text-[#C7C3D1] border-[#2A2533]'
                }`}
              >
                <Shuffle className="w-3.5 h-3.5" />
                Cambiar Máquina
              </button>

              <button
                type="button"
                onClick={() => setShowWeightChart(!showWeightChart)}
                className={`px-2.5 py-1.5 rounded-md font-mono text-[10px] font-bold uppercase tracking-[0.04em] border flex items-center gap-1 transition-all ${
                  showWeightChart ? 'theme-bg theme-border' : 'bg-[#0B090E] text-[#C7C3D1] border-[#2A2533]'
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
                  className="px-2.5 py-1.5 rounded-md font-mono text-[10px] font-bold uppercase tracking-[0.04em] border flex items-center gap-1 bg-[#0B090E] text-[#C7C3D1] border-[#2A2533]"
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
                className="px-2.5 py-1.5 rounded-md font-mono text-[10px] font-bold uppercase tracking-[0.04em] bg-[#0B090E] theme-text border border-[#2A2533] flex items-center gap-1"
              >
                <Target className="w-3.5 h-3.5" />
                Calibrar
              </button>
            </div>
          </div>

          {/* ALWAYS ACTIVE COACH NOTE & TECHNIQUE CUES (T1.5 / T5-03) */}
          <div className="p-2.5 rounded-md bg-[#0B090E] border border-[#2A2533] border-l-[3px] theme-border text-xs space-y-1">
            <p className="text-[#E2DFEA] leading-snug">
              <strong className="font-mono text-[10px] uppercase tracking-[0.06em] theme-text block mb-0.5">
                Nota del entrenador
              </strong>
              {slot.notes}
            </p>
            <p className="text-[#C7C3D1] leading-snug">
              <strong className="font-mono text-[10px] uppercase tracking-[0.06em] theme-text">Técnica: </strong>
              {activeVariant.cues}
            </p>
          </div>

          {/* INLINE EXERCISE WEIGHT HISTORY CHART */}
          {showWeightChart && (
            <div className="p-3 rounded-[10px] bg-[#0B090E] border border-[#2A2533] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider theme-text flex items-center gap-1.5">
                  <LineChartIcon className="w-4 h-4" />
                  Evolución en {activeVariant.name} ({weightUnit.toUpperCase()})
                </span>
                <button
                  type="button"
                  onClick={() => setShowWeightChart(false)}
                  className="font-mono text-[10px] text-[#A09BA8] hover:text-white px-2 py-0.5 rounded bg-[#14111A] border border-[#2A2533]"
                >
                  Cerrar ✕
                </button>
              </div>

              {weightChartData.length > 0 ? (
                <div className="h-40 w-full pt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weightChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2A2533" />
                      <XAxis dataKey="date" stroke="#A09BA8" fontSize={11} />
                      <YAxis stroke="#A09BA8" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#14111A',
                          borderColor: '#2A2533',
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
                <p className="font-mono text-[11px] text-[#A09BA8] py-3 text-center">
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
            <div className="p-3 rounded-[10px] bg-[#0B090E] border border-[#FF5500] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider theme-text flex items-center gap-1.5">
                  <Shuffle className="w-3.5 h-3.5" />
                  Alternativas para {activeVariant.name}:
                </span>
                <button
                  type="button"
                  onClick={() => setShowAlternativesModal(false)}
                  className="font-mono text-[10px] text-[#A09BA8] hover:text-white"
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
                          ? 'theme-soft-bg theme-border text-white'
                          : 'bg-[#0B090E] border-[#2A2533] text-[#C7C3D1]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] mb-0.5">
                        <span className="font-semibold theme-text">
                          {idx === 0 ? '⭐ Principal' : `Alternativa ${idx}`}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-[#14111A] border border-[#2A2533] font-mono text-[10px] text-[#C7C3D1]">
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
            <div className="p-3 rounded-[10px] bg-[#0B090E] border border-[#FF5500] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 theme-text shrink-0" />
                  <div>
                    <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-white">
                      Calibrar peso de {profile.name}
                    </p>
                    <p className="text-[11px] text-[#A09BA8]">
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
                  className="solar-btn theme-bg px-2.5 py-1.5 rounded-md text-sm shrink-0"
                >
                  {inlineTestOpen ? 'Cerrar' : '⚡ Hacer Prueba'}
                </button>
              </div>

              {inlineTestOpen && (
                <div className="pt-2 border-t border-[#2A2533] space-y-2.5">
                  {isBilateralPlates && (
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-[#14111A] p-2 rounded-md border border-[#2A2533]">
                      <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-[#A09BA8]">
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
                              ? 'theme-bg'
                              : 'bg-[#0B090E] text-[#C7C3D1] border border-[#2A2533]'
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
                              ? 'theme-bg'
                              : 'bg-[#0B090E] text-[#C7C3D1] border border-[#2A2533]'
                          }`}
                        >
                          Por Lado (×2)
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="font-mono text-[9px] uppercase tracking-[0.06em] text-[#A09BA8] block mb-1">
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
                        className="clean-input theme-focus font-mono text-sm font-bold text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="font-mono text-[9px] uppercase tracking-[0.06em] text-[#A09BA8] block mb-1">
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
                        className="clean-input theme-focus font-mono text-sm font-bold text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="font-mono text-[9px] uppercase tracking-[0.06em] text-[#A09BA8] block mb-1">
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
                        className="w-full bg-[#14111A] border border-[#2A2533] rounded-md px-2 py-1.5 text-xs font-bold text-white"
                      >
                        <option value={0}>RIR 0 (Al límite)</option>
                        <option value={1}>RIR 1 (Casi límite)</option>
                        <option value={2}>RIR 2 (Seguro Ideal)</option>
                        <option value={3}>RIR 3 (Cómodo)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 bg-[#14111A] p-2.5 rounded-md border border-[#2A2533]">
                    <div>
                      <span className="text-xs text-[#E2DFEA] block">
                        Peso Ideal Sugerido:{' '}
                        <strong>{formatDualWeight(qZones.hypertrophyKg, weightUnit)}</strong>
                      </span>
                      <span className="font-mono text-[10px] theme-text block mt-0.5">
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
                      className="px-3 py-1.5 rounded-md bg-[#10B981] text-[#0B090E] font-extrabold text-xs"
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
                        : 'bg-[#0B090E] text-[#A09BA8] border-[#2A2533] hover:text-white'
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
              className="font-mono text-[10px] uppercase text-[#A09BA8] hover:text-white flex items-center gap-0.5"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              Guía
            </button>
          </div>

          {/* SETS TABLE FOR ACTIVE USER */}
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-1.5 font-mono text-[9px] uppercase tracking-[0.06em] text-[#A09BA8] px-1">
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
                        ? 'bg-[#10B981]/[0.07] border-[#10B981]/55'
                        : 'bg-[#0B090E] border-[#2A2533]'
                    }`}
                  >
                    <div className="col-span-2 flex items-center gap-1">
                      <span className="w-6 h-6 rounded-md bg-[#14111A] border border-[#2A2533] font-mono text-xs font-bold flex items-center justify-center text-[#A09BA8]">
                        {s.setNumber}
                      </span>
                      {isPyramidStep &&
                        (technique === 'pyramid_asc' ? (
                          <TrendingUp className="w-3.5 h-3.5 theme-text" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5 theme-text" />
                        ))}
                      {(s.isFailure || (technique === 'failure' && isLastSet)) && (
                        <Flame className="w-3.5 h-3.5 theme-text" />
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
                        className="clean-input theme-focus font-mono text-sm font-bold text-white outline-none"
                      />
                      <span className="font-mono text-[10px] uppercase theme-text font-semibold block mt-0.5 pl-0.5 leading-tight">
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
                        className="clean-input theme-focus font-mono text-sm font-bold text-white outline-none"
                      />
                      <span className="font-mono text-[10px] text-[#A09BA8] block mt-0.5 pl-0.5">
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
                            ? 'bg-[#10B981] text-[#0B090E] border-[#10B981]'
                            : 'bg-[#14111A] hover:bg-[#1C1826] text-[#A09BA8] border-[#2A2533]'
                        }`}
                      >
                        <Check className="w-4 h-4 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>

                  {technique === 'dropset' && isLastSet && (
                    <div className="ml-3 pl-3 border-l-2 theme-border space-y-1.5 py-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase tracking-[0.04em] theme-text">
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
                            className="font-mono text-[10px] uppercase px-2 py-0.5 rounded theme-soft-bg theme-text border theme-border"
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
                            className="flex items-center justify-between gap-2 bg-[#0B090E] border border-[#2A2533] rounded-md px-2.5 py-1.5 text-xs"
                          >
                            <span className="font-mono font-semibold theme-text">Drop {dIdx + 1}:</span>
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
                                className="w-16 bg-[#14111A] border border-[#2A2533] rounded px-1.5 py-0.5 text-white font-mono font-bold"
                              />
                              <span className="font-mono text-[#A09BA8]">{weightUnit} ×</span>
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
                                className="w-12 bg-[#14111A] border border-[#2A2533] rounded px-1.5 py-0.5 text-white font-mono font-bold"
                              />
                              <span className="font-mono text-[#A09BA8]">reps</span>
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
                                  ? 'theme-bg'
                                  : 'bg-[#0B090E] text-[#A09BA8] border border-[#2A2533]'
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
              className="font-mono text-[10px] uppercase text-[#A09BA8] hover:text-white flex items-center gap-1 py-1 px-2 rounded-md hover:bg-[#14111A]"
            >
              <Plus className="w-3.5 h-3.5" />
              Añadir serie extra
            </button>
            <span className="font-mono text-[10px] text-[#A09BA8]">
              {completedCount}/{sets.length} series listas ({profile.name})
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
