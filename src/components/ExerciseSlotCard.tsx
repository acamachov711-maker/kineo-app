import React, { useState, useEffect, useRef } from 'react'
import {
  Shuffle,
  Users,
  User,
  Flame,
  TrendingUp,
  TrendingDown,
  Plus,
  Check,
  HelpCircle,
  Target,
  ChevronDown,
  ChevronUp,
  Sparkles,
  LineChart as LineChartIcon,
  Trash2,
  CheckCircle2
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
  sanitizeDecimalInput,
  generateDropSubSets,
  calculateSafe1RM,
  calculateCompensatedReps,
  formatDualWeight,
  getIdealWeightZones,
  getExerciseWeightHistory,
  getExerciseLoadCategory,
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
  onDeleteSet: (profileId: 'user_1' | 'user_2', slotId: string, setIndex: number) => void
  onSaveQuickStrengthTest: (
    profileId: 'user_1' | 'user_2',
    variantId: string,
    oneRmKg: number,
    slotId: string,
    triggerRestSeconds?: number,
    restLabel?: string
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

interface DecimalWeightInputProps {
  weightKg: number
  weightUnit: WeightUnit
  placeholder?: string
  className?: string
  onCommitWeightKg: (newWeightKg: number, isFinalCommit?: boolean) => void
}

/**
 * V1.6-01: Input con estado local draftWeight que permite vaciar el campo ("") y escribir
 * decimales con punto o coma (ej. 2.5, 12.5, 40) sin formatear bruscamente mientras el usuario teclea.
 */
const DecimalWeightInput: React.FC<DecimalWeightInputProps> = ({
  weightKg,
  weightUnit,
  placeholder = '0',
  className = '',
  onCommitWeightKg
}) => {
  const shown = displayWeightValue(weightKg, weightUnit)
  const [draft, setDraft] = useState<string>(() => (shown > 0 ? String(shown) : ''))
  const isFocusedRef = useRef<boolean>(false)

  useEffect(() => {
    if (!isFocusedRef.current) {
      const nextShown = displayWeightValue(weightKg, weightUnit)
      setDraft(nextShown > 0 ? String(nextShown) : '')
    }
  }, [weightKg, weightUnit])

  const commitValue = (rawStr: string) => {
    const cleaned = sanitizeDecimalInput(rawStr)
    if (!cleaned || cleaned === '.') {
      onCommitWeightKg(0, true)
      setDraft('')
      return
    }
    const parsed = parseFloat(cleaned)
    if (isNaN(parsed) || parsed <= 0) {
      onCommitWeightKg(0, true)
      setDraft('')
      return
    }
    const kgVal = parseInputToKg(parsed, weightUnit)
    onCommitWeightKg(kgVal, true)
    const formatted = displayWeightValue(kgVal, weightUnit)
    setDraft(formatted > 0 ? String(formatted) : '')
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      value={draft}
      onFocus={() => {
        isFocusedRef.current = true
      }}
      onChange={(e) => {
        const cleaned = sanitizeDecimalInput(e.target.value)
        setDraft(cleaned)
        if (cleaned === '') {
          onCommitWeightKg(0, false)
          return
        }
        // Si no termina en punto, podemos actualizar el estado en vivo sin reescribir el texto draft
        if (!cleaned.endsWith('.')) {
          const parsed = parseFloat(cleaned)
          if (!isNaN(parsed) && parsed >= 0) {
            onCommitWeightKg(parseInputToKg(parsed, weightUnit), false)
          }
        }
      }}
      onBlur={() => {
        isFocusedRef.current = false
        commitValue(draft)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur()
        }
      }}
      className={className}
    />
  )
}

export const ExerciseSlotCard: React.FC<ExerciseSlotCardProps> = ({
  slot,
  isExpanded,
  onToggleExpand,
  profiles,
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
  onDeleteSet,
  onSaveQuickStrengthTest,
  onOpenCalculatorForVariant,
  onOpenGlossaryTopic
}) => {
  const [showAlternativesModal, setShowAlternativesModal] = useState(false)
  const [showCoachTip, setShowCoachTip] = useState(false)
  const [showWeightChart, setShowWeightChart] = useState(false)
  const [longPressIdx, setLongPressIdx] = useState<number | null>(null)
  const longPressTimerRef = useRef<number | null>(null)

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
  const [quickPlateMode, setQuickPlateMode] = useState<
    Record<'user_1' | 'user_2', 'total' | 'per_side'>
  >({
    user_1: 'total',
    user_2: 'total'
  })
  const [quickDumbbellMode, setQuickDumbbellMode] = useState<
    Record<'user_1' | 'user_2', 'single_hand' | 'pair_sum'>
  >({
    user_1: 'single_hand',
    user_2: 'single_hand'
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

  const loadCategory = getExerciseLoadCategory(activeVariant.equipment, activeVariant.name)
  const isBilateralPlates = loadCategory === 'bilateral_plates'
  const isDualDumbbell = loadCategory === 'dual_dumbbell'
  const isSingleImplement = loadCategory === 'single_implement'

  const rawTestWeight = parseFloat(sanitizeDecimalInput(quickWeightInput[pid])) || 0
  const effectiveTestWeight = isBilateralPlates
    ? quickPlateMode[pid] === 'per_side'
      ? rawTestWeight * 2
      : rawTestWeight
    : isDualDumbbell
    ? quickDumbbellMode[pid] === 'pair_sum'
      ? rawTestWeight / 2
      : rawTestWeight
    : rawTestWeight

  const qWeightKg = parseInputToKg(effectiveTestWeight, weightUnit)
  const parsedQuickReps = Math.max(1, parseInt(quickRepsInput[pid], 10) || 1)
  const qEstimated1Rm = calculateSafe1RM(qWeightKg, parsedQuickReps, quickRirInput[pid])
  const qZones = getIdealWeightZones(qEstimated1Rm)

  const weightChartData = getExerciseWeightHistory(history, activeVariant.id, weightUnit)

  const partnerId: 'user_1' | 'user_2' = pid === 'user_1' ? 'user_2' : 'user_1'
  const partnerSets = setsByProfile[partnerId] || []
  const partnerDoneCount = partnerSets.filter((s) => s.completed).length

  const defaultSteps: [string, string, string] = activeVariant.stepByStep || [
    `Posición inicial: Ajusta el equipo (${activeVariant.equipment}) y estabiliza tu postura antes de mover el peso.`,
    `Ejecución: Trabaja de forma enfocada tu ${activeVariant.muscleGroup} siguiendo el tempo (${activeVariant.tempo || '2s bajar • 1s subir'}).`,
    `Control: ${activeVariant.cues}`
  ]

  const startLongPress = (idx: number, canDelete: boolean) => {
    if (!canDelete) return
    setLongPressIdx(idx)
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current)
    }
    longPressTimerRef.current = window.setTimeout(() => {
      if (navigator.vibrate) {
        navigator.vibrate(60)
      }
      onDeleteSet(pid, slot.slotId, idx)
      setLongPressIdx(null)
    }, 500)
  }

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    setLongPressIdx(null)
  }

  return (
    <div
      className={`rounded-[10px] border transition-all ${
        isExpanded
          ? 'bg-[#181420] theme-border shadow-xl'
          : allSetsDone
          ? 'bg-[#14111A] border-[#10B981]/50'
          : 'bg-[#14111A] border-[#2A2533] hover:border-[#3A3345]'
      }`}
    >
      {/* 1. ACCORDION HEADER */}
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

      {/* EXPANDED CONTENT */}
      {isExpanded && (
        <div className="px-3.5 sm:px-4 pb-4 pt-2 border-t border-[#2A2533] space-y-2.5">
          {/* 2. V1.6-13: ESCENARIO CUADRADO 1:1 (295px, 1.0x, Fusión Continua Sin Bordes) */}
          <ExerciseAnimationViewer
            variant={activeVariant}
            accentColor={profile.accentColor}
          />

          {/* 3. V1.6-06: BARRA DESPLEGABLE "📌 Ver tip del entrenador y técnica ▾" CONTRAÍDA POR DEFECTO */}
          <div className="rounded-[10px] bg-[#0B090E] border border-[#2A2533] overflow-hidden">
            <button
              type="button"
              onClick={() => setShowCoachTip((prev) => !prev)}
              className="w-full px-3 py-2 text-left flex items-center justify-between gap-2 hover:bg-[#14111A] transition-colors"
            >
              <span className="font-mono text-[11px] font-bold theme-text flex items-center gap-1.5">
                <span>📌 Ver tip del entrenador y técnica</span>
              </span>
              <span className="font-mono text-[10px] text-[#A09BA8] flex items-center gap-1">
                {showCoachTip ? 'Ocultar ▴' : 'Abrir ▾'}
              </span>
            </button>

            {showCoachTip && (
              <div className="px-3 pb-3 pt-1.5 border-t border-[#2A2533] text-xs space-y-2">
                <p className="text-[#E2DFEA] leading-snug">
                  <strong className="font-mono text-[10px] uppercase tracking-[0.06em] theme-text block mb-0.5">
                    Nota del entrenador:
                  </strong>
                  {slot.notes}
                </p>
                <p className="text-[#C7C3D1] leading-snug">
                  <strong className="font-mono text-[10px] uppercase tracking-[0.06em] theme-text">
                    Clave técnica:{' '}
                  </strong>
                  {activeVariant.cues}
                </p>
                <div className="pt-1 space-y-1">
                  {defaultSteps.map((stepText, sIdx) => (
                    <div key={sIdx} className="flex items-start gap-1.5 text-[11px] text-[#C7C3D1]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] shrink-0 mt-0.5" />
                      <span>{stepText}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 4. FILA DE BOTONES DE ACCIÓN (🔀 Cambiar Máquina, 📈 Historial, 🎯 Calibrar Peso) */}
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowAlternativesModal(!showAlternativesModal)}
                className={`px-2.5 py-1.5 rounded-md font-mono text-[10px] font-bold uppercase tracking-[0.04em] border flex items-center gap-1 transition-all ${
                  showAlternativesModal
                    ? 'theme-bg theme-border'
                    : 'bg-[#0B090E] text-[#C7C3D1] border-[#2A2533]'
                }`}
              >
                <Shuffle className="w-3.5 h-3.5" />
                Cambiar Máquina
              </button>

              <button
                type="button"
                onClick={() => setShowWeightChart(!showWeightChart)}
                className={`px-2.5 py-1.5 rounded-md font-mono text-[10px] font-bold uppercase tracking-[0.04em] border flex items-center gap-1 transition-all ${
                  showWeightChart
                    ? 'theme-bg theme-border'
                    : 'bg-[#0B090E] text-[#C7C3D1] border-[#2A2533]'
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
                Calibrar Peso
              </button>
            </div>
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
                        connectNulls
                        type="monotone"
                        dataKey="user1Weight"
                        name={profiles.user_1.name}
                        stroke={profiles.user_1.accentColor}
                        strokeWidth={2.5}
                        dot={{ r: 4 }}
                      />
                      {coupleModeEnabled && (
                        <Line
                          connectNulls
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

          {showAlternativesModal && (
            <div className="p-3 rounded-[10px] bg-[#0B090E] border theme-border space-y-2">
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

          {/* QUICK FIRST-TIME STRENGTH TEST (V1.6-01, V1.6-02, V1.6-03) */}
          {isFirstTimeExercise && (
            <div className="p-3 rounded-[10px] bg-[#0B090E] border theme-border space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 theme-text shrink-0" />
                  <div>
                    <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-white">
                      Calibrar peso de {profile.name}
                    </p>
                    <p className="text-[11px] text-[#A09BA8]">
                      Haz 1 serie de prueba y al fijar peso iniciarás 2:00 min de descanso.
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
                  {/* V1.6-03 Selector explícito para Doble Mancuerna */}
                  {isDualDumbbell && (
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-[#14111A] p-2 rounded-md border border-[#2A2533]">
                      <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-[#A09BA8]">
                        🏋️ ¿Anotarás el peso de 1 mancuerna o la suma de las 2?
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setQuickDumbbellMode((prev) => ({ ...prev, [pid]: 'single_hand' }))
                          }
                          className={`px-2 py-1 rounded text-[11px] font-bold ${
                            quickDumbbellMode[pid] === 'single_hand'
                              ? 'theme-bg'
                              : 'bg-[#0B090E] text-[#C7C3D1] border border-[#2A2533]'
                          }`}
                        >
                          1 Mancuerna (c/mano)
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setQuickDumbbellMode((prev) => ({ ...prev, [pid]: 'pair_sum' }))
                          }
                          className={`px-2 py-1 rounded text-[11px] font-bold ${
                            quickDumbbellMode[pid] === 'pair_sum'
                              ? 'theme-bg'
                              : 'bg-[#0B090E] text-[#C7C3D1] border border-[#2A2533]'
                          }`}
                        >
                          Suma de las 2 (÷2)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* V1.6-03 Selector explícito para Discos a Cada Lado */}
                  {isBilateralPlates && (
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-[#14111A] p-2 rounded-md border border-[#2A2533]">
                      <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-[#A09BA8]">
                        ⚖️ ¿Anotarás el peso de 1 solo lado o el total?
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setQuickPlateMode((prev) => ({ ...prev, [pid]: 'total' }))
                          }
                          className={`px-2 py-1 rounded text-[11px] font-bold ${
                            quickPlateMode[pid] === 'total'
                              ? 'theme-bg'
                              : 'bg-[#0B090E] text-[#C7C3D1] border border-[#2A2533]'
                          }`}
                        >
                          Peso Total
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setQuickPlateMode((prev) => ({ ...prev, [pid]: 'per_side' }))
                          }
                          className={`px-2 py-1 rounded text-[11px] font-bold ${
                            quickPlateMode[pid] === 'per_side'
                              ? 'theme-bg'
                              : 'bg-[#0B090E] text-[#C7C3D1] border border-[#2A2533]'
                          }`}
                        >
                          1 Solo Lado (×2)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* V1.6-03 Aviso explícito para Pesa Única (Goblet / Copa / Kettlebell) */}
                  {isSingleImplement && (
                    <div className="bg-[#14111A] px-2.5 py-1.5 rounded-md border border-[#2A2533] font-mono text-[10px] text-[#C7C3D1]">
                      💡 <strong>Pesa única:</strong> Anota el peso total de la mancuerna o kettlebell sujetada con ambas manos.
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="font-mono text-[9px] uppercase tracking-[0.06em] text-[#A09BA8] block mb-1">
                        {isBilateralPlates && quickPlateMode[pid] === 'per_side'
                          ? `Peso/lado (${weightUnit.toUpperCase()})`
                          : isDualDumbbell
                          ? quickDumbbellMode[pid] === 'pair_sum'
                            ? `Suma 2 pesas (${weightUnit.toUpperCase()})`
                            : `1 Mancuerna (${weightUnit.toUpperCase()})`
                          : `Peso (${weightUnit.toUpperCase()})`}
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Ej. 22.5"
                        value={quickWeightInput[pid]}
                        onChange={(e) => {
                          const cleaned = sanitizeDecimalInput(e.target.value)
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
                        placeholder="Ej. 12"
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

                  {isDualDumbbell && quickDumbbellMode[pid] === 'pair_sum' && rawTestWeight > 0 && (
                    <p className="font-mono text-[10px] theme-text">
                      ⚖️ Ingresaste {rawTestWeight} {weightUnit} totales ➔{' '}
                      <strong>
                        {Math.round((rawTestWeight / 2) * 10) / 10} {weightUnit} por mano
                      </strong>
                    </p>
                  )}

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
                        // V1.6-02: Inicia automáticamente descanso de 120s (2:00 min) tras la serie de prueba
                        onSaveQuickStrengthTest(
                          pid,
                          activeVariant.id,
                          qEstimated1Rm,
                          slot.slotId,
                          120,
                          `${profile.name} • Descanso post-prueba • Prepárate para la Serie 1`
                        )
                        setInlineTestOpenByProfile((prev) => ({ ...prev, [pid]: false }))
                      }}
                      className="px-3 py-1.5 rounded-md bg-[#10B981] text-[#0B090E] font-extrabold text-xs"
                    >
                      ✓ Fijar Peso Ideal (Descanso 2:00)
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

          {/* 5. SETS TABLE FOR ACTIVE USER (V1.6-01, V1.6-03, V1.6-04, V1.6-05, V1.6-09) */}
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-1.5 font-mono text-[9px] uppercase tracking-[0.06em] text-[#A09BA8] px-1">
              <div className="col-span-2">Serie</div>
              <div className="col-span-5">
                {isDualDumbbell
                  ? `Peso c/mano (${weightUnit.toUpperCase()})`
                  : `Peso (${weightUnit.toUpperCase()}) y Carga`}
              </div>
              <div className="col-span-3">Reps (Meta {slot.defaultTargetReps})</div>
              <div className="col-span-2 text-right">Listo</div>
            </div>

            {sets.map((s, idx) => {
              const loadHint = getLoadInstruction(
                s.weightKg,
                activeVariant.equipment,
                activeVariant.name,
                weightUnit
              )

              const isPyramidStep =
                technique === 'pyramid_asc' || technique === 'pyramid_desc'
              const isLastSet = idx === sets.length - 1
              const canDeleteExtraSet = sets.length > 1 && idx >= slot.defaultSetsCount

              // V1.6-05: Etiquetar Dropset o Fallo ÚNICAMENTE en la última serie activa
              const cleanBaseTarget = s.targetReps
                .replace(/\s*\+\s*Dropset.*$/i, '')
                .replace(/\s*\(Última al Fallo.*\)$/i, '')
                .trim()

              const metaLabel =
                technique === 'dropset' && isLastSet
                  ? `🔥 Meta: ${cleanBaseTarget} + Dropset`
                  : (technique === 'failure' || s.isFailure) && isLastSet
                  ? `🔥 Meta: ${cleanBaseTarget} (Al Fallo)`
                  : `Meta: ${cleanBaseTarget} reps`

              return (
                <div key={s.setNumber} className="space-y-1.5">
                  <div
                    onTouchStart={() => startLongPress(idx, canDeleteExtraSet)}
                    onTouchEnd={cancelLongPress}
                    onTouchMove={cancelLongPress}
                    onMouseDown={() => startLongPress(idx, canDeleteExtraSet)}
                    onMouseUp={cancelLongPress}
                    onMouseLeave={cancelLongPress}
                    className={`grid grid-cols-12 gap-1.5 items-center p-2 rounded-xl border transition-all ${
                      longPressIdx === idx
                        ? 'bg-rose-500/15 border-rose-500 scale-[0.99]'
                        : s.completed
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
                      {((technique === 'failure' || s.isFailure) && isLastSet) ||
                      (technique === 'dropset' && isLastSet) ? (
                        <Flame className="w-3.5 h-3.5 theme-text" />
                      ) : null}
                    </div>

                    <div className="col-span-5">
                      <DecimalWeightInput
                        weightKg={s.weightKg}
                        weightUnit={weightUnit}
                        placeholder="0"
                        onCommitWeightKg={(newWeightKg, isFinalCommit) => {
                          // V1.6-04: Compensación automática de repeticiones si hay 1RM calibrado
                          if (oneRmKg > 0 && newWeightKg > 0) {
                            const compensatedReps = calculateCompensatedReps(
                              oneRmKg,
                              newWeightKg,
                              isLastSet ? 1 : 2
                            )
                            const baselineWeightKg =
                              Math.round(oneRmKg * (isLastSet ? 0.775 : 0.75) * 10) / 10
                            const direction: 'up' | 'down' | null =
                              newWeightKg < baselineWeightKg - 0.25
                                ? 'up'
                                : newWeightKg > baselineWeightKg + 0.25
                                ? 'down'
                                : null
                            onUpdateSet(pid, slot.slotId, idx, {
                              weightKg: newWeightKg,
                              targetReps: String(compensatedReps),
                              ...(isFinalCommit && !s.completed
                                ? { actualReps: compensatedReps }
                                : {}),
                              compensatedDirection: direction
                            })
                          } else {
                            onUpdateSet(pid, slot.slotId, idx, { weightKg: newWeightKg })
                          }
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
                        placeholder={cleanBaseTarget}
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
                      <span
                        className={`font-mono text-[9px] block mt-0.5 pl-0.5 leading-tight ${
                          (technique === 'dropset' || technique === 'failure') && isLastSet
                            ? 'theme-text font-bold'
                            : s.compensatedDirection
                            ? 'text-[#10B981] font-semibold'
                            : 'text-[#A09BA8]'
                        }`}
                      >
                        {metaLabel}
                        {s.compensatedDirection === 'up' && ' (↑ compensado)'}
                        {s.compensatedDirection === 'down' && ' (↓ ajustado)'}
                      </span>
                    </div>

                    <div className="col-span-2 flex items-center justify-end gap-1">
                      {canDeleteExtraSet && (
                        <button
                          type="button"
                          onClick={() => onDeleteSet(pid, slot.slotId, idx)}
                          title="Eliminar serie extra"
                          className="p-1.5 rounded-lg bg-[#14111A] hover:bg-rose-500/20 text-[#A09BA8] hover:text-rose-400 border border-[#2A2533]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const nextCompleted = !s.completed
                          const finalReps =
                            s.actualReps > 0
                              ? s.actualReps
                              : parseInt(cleanBaseTarget, 10) || 10
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

                  {/* Escalones de Dropset únicamente en la última serie */}
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

                      {(s.drops || []).map((drop, dIdx) => (
                        <div
                          key={drop.id}
                          className="flex items-center justify-between gap-2 bg-[#0B090E] border border-[#2A2533] rounded-md px-2.5 py-1.5 text-xs"
                        >
                          <span className="font-mono font-semibold theme-text">
                            ↳ Drop {dIdx + 1} ({dIdx === 0 ? '-20%' : '-35%'}):
                          </span>
                          <div className="flex items-center gap-1">
                            <DecimalWeightInput
                              weightKg={drop.weightKg}
                              weightUnit={weightUnit}
                              placeholder="0"
                              onCommitWeightKg={(newDropWeightKg) => {
                                const nextDrops = [...(s.drops || [])]
                                nextDrops[dIdx] = {
                                  ...drop,
                                  weightKg: newDropWeightKg
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
                                ? 'bg-[#10B981] text-[#0B090E]'
                                : 'bg-[#0B090E] text-[#A09BA8] border border-[#2A2533]'
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

          <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onAddSet(pid, slot.slotId)}
              className="font-mono text-[10px] uppercase text-[#A09BA8] hover:text-white flex items-center gap-1 py-1 px-2 rounded-md hover:bg-[#14111A] border border-transparent hover:border-[#2A2533]"
            >
              <Plus className="w-3.5 h-3.5" />
              Añadir serie extra
            </button>
            <span className="font-mono text-[10px] text-[#A09BA8]">
              {sets.length > slot.defaultSetsCount
                ? 'Tip: mantén presionada una serie extra o toca 🗑️ para borrarla'
                : `${completedCount}/${sets.length} series listas (${profile.name})`}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
