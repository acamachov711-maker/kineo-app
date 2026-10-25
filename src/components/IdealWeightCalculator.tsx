import React, { useState, useEffect } from 'react'
import { Target, ShieldCheck, CheckCircle2, TrendingUp, Sparkles } from 'lucide-react'
import {
  ExerciseVariant,
  MesocyclePlan,
  UserProfile,
  WeightUnit
} from '../types'
import {
  calculateSafe1RM,
  getIdealWeightZones,
  displayWeightValue,
  parseInputToKg,
  formatDualWeight,
  getLoadInstruction
} from '../utils/fitnessMath'

interface IdealWeightCalculatorProps {
  mesocycle: MesocyclePlan
  profiles: Record<'user_1' | 'user_2', UserProfile>
  selectedProfileId: 'user_1' | 'user_2'
  onSelectProfile?: (profileId: 'user_1' | 'user_2') => void
  coupleModeEnabled?: boolean
  weightUnit: WeightUnit
  preselectedVariant?: {
    profileId: 'user_1' | 'user_2'
    variant: ExerciseVariant
    slotId: string
  } | null
  onSaveIdealWeight: (
    profileId: 'user_1' | 'user_2',
    variantId: string,
    oneRmKg: number,
    slotId?: string
  ) => void
}

export const IdealWeightCalculator: React.FC<IdealWeightCalculatorProps> = ({
  mesocycle,
  profiles,
  selectedProfileId,
  onSelectProfile,
  coupleModeEnabled = true,
  weightUnit,
  preselectedVariant,
  onSaveIdealWeight
}) => {
  const [targetProfileId, setTargetProfileId] = useState<'user_1' | 'user_2'>(selectedProfileId)

  useEffect(() => {
    setTargetProfileId(selectedProfileId)
  }, [selectedProfileId])

  const allVariants: { variant: ExerciseVariant; slotId: string; sessionCode: string }[] = []
  const seen = new Set<string>()
  mesocycle.sessions.forEach((sess) => {
    sess.slots.forEach((slot) => {
      const list = [
        slot.primaryExercise,
        ...slot.alternatives,
        ...(slot.femaleFocusedPrimary ? [slot.femaleFocusedPrimary] : []),
        ...(slot.femaleFocusedAlternatives || [])
      ]
      list.forEach((v) => {
        if (!seen.has(v.id)) {
          seen.add(v.id)
          allVariants.push({ variant: v, slotId: slot.slotId, sessionCode: sess.code })
        }
      })
    })
  })

  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    preselectedVariant?.variant.id || allVariants[0]?.variant.id || ''
  )
  const [testWeightInput, setTestWeightInput] = useState<string>('20')
  const [testRepsInput, setTestRepsInput] = useState<string>('8')
  const [weightMode, setWeightMode] = useState<'total' | 'per_side'>('total')
  const [testRir, setTestRir] = useState<number>(2)
  const [savedBanner, setSavedBanner] = useState<boolean>(false)

  useEffect(() => {
    if (preselectedVariant) {
      setTargetProfileId(preselectedVariant.profileId)
      setSelectedVariantId(preselectedVariant.variant.id)
      const current1Rm =
        profiles[preselectedVariant.profileId].estimated1RMByVariant[
          preselectedVariant.variant.id
        ] || 25
      const workingWeight = Math.round(current1Rm * 0.75)
      setTestWeightInput(String(displayWeightValue(workingWeight, weightUnit)))
    }
  }, [preselectedVariant, profiles, weightUnit])

  const currentItem = allVariants.find((x) => x.variant.id === selectedVariantId)
  const currentVariant = currentItem?.variant

  const isBilateralPlates =
    currentVariant &&
    (currentVariant.equipment === 'Barra' ||
      (currentVariant.equipment === 'Máquina' &&
        (currentVariant.name.toLowerCase().includes('prensa') ||
          currentVariant.name.toLowerCase().includes('hack'))))

  const rawTypedWeight = parseFloat(testWeightInput) || 0
  const effectiveTypedWeight =
    isBilateralPlates && weightMode === 'per_side' ? rawTypedWeight * 2 : rawTypedWeight

  const weightKg = parseInputToKg(effectiveTypedWeight, weightUnit)
  const parsedReps = Math.max(1, parseInt(testRepsInput, 10) || 1)
  const estimated1RmKg = calculateSafe1RM(weightKg, parsedReps, testRir)
  const zones = getIdealWeightZones(estimated1RmKg)

  const handleApplyToRoutine = () => {
    if (!selectedVariantId || estimated1RmKg <= 0) return
    onSaveIdealWeight(
      targetProfileId,
      selectedVariantId,
      estimated1RmKg,
      currentItem?.slotId
    )
    setSavedBanner(true)
    setTimeout(() => setSavedBanner(false), 3500)
  }

  return (
    <div
      className="space-y-4"
      data-profile={targetProfileId === 'user_2' ? 'partner' : 'owner'}
    >
      <div className="rounded-[10px] bg-[#14111A] border border-[#2A2533] p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-md bg-[#0B090E] border border-[#2A2533] flex items-center justify-center theme-text shrink-0">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-2xl text-white">
              Calculadora de Peso Ideal Seguro
            </h2>
            <p className="text-xs text-[#C7C3D1] mt-0.5">
              Ingresa el peso usado y las repeticiones que lograste (puedes poner 20, 21 o más).
              Kineo calculará tu peso exacto y cuánto poner de cada lado.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-[10px] bg-[#14111A] border border-[#2A2533] p-4 space-y-4">
        {coupleModeEnabled && (
          <div>
            <label className="block font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[#A09BA8] mb-2">
              1. ¿Para quién es la prueba?
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {(['user_1', 'user_2'] as const).map((pid) => {
                const p = profiles[pid]
                const active = targetProfileId === pid
                return (
                  <button
                    key={pid}
                    onClick={() => {
                      setTargetProfileId(pid)
                      onSelectProfile?.(pid)
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                      active
                        ? 'theme-soft-bg theme-border text-white shadow-md'
                        : 'bg-[#0B090E] border-[#2A2533] text-[#A09BA8] hover:text-white'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: p.accentColor }}
                    />
                    <div className="truncate">
                      <p className="text-xs font-bold">{p.name}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div>
          <label className="block font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[#A09BA8] mb-1.5">
            Ejercicio o Máquina
          </label>
          <select
            value={selectedVariantId}
            onChange={(e) => setSelectedVariantId(e.target.value)}
            className="w-full clean-input theme-focus rounded-md px-3.5 py-2.5 text-sm font-semibold text-white font-mono"
          >
            {allVariants.map((item) => (
              <option key={item.variant.id} value={item.variant.id}>
                [Sesión {item.sessionCode}] {item.variant.name} ({item.variant.equipment})
              </option>
            ))}
          </select>
        </div>

        {isBilateralPlates && (
          <div className="p-2.5 rounded-[10px] bg-[#0B090E] border theme-border flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-[#A09BA8]">
              ⚖️ Este ejercicio carga discos de ambos lados. ¿Cómo vas a anotar el peso?
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setWeightMode('total')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                  weightMode === 'total'
                    ? 'theme-bg theme-border'
                    : 'bg-[#14111A] text-[#C7C3D1] border-[#2A2533]'
                }`}
              >
                Peso Total
              </button>
              <button
                type="button"
                onClick={() => setWeightMode('per_side')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                  weightMode === 'per_side'
                    ? 'theme-bg theme-border'
                    : 'bg-[#14111A] text-[#C7C3D1] border-[#2A2533]'
                }`}
              >
                Peso de 1 Solo Lado (×2)
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-[#A09BA8] mb-1.5">
              {isBilateralPlates && weightMode === 'per_side'
                ? `Peso en CADA lado (${weightUnit.toUpperCase()})`
                : currentVariant?.equipment === 'Mancuernas'
                ? `Peso de 1 Mancuerna (${weightUnit.toUpperCase()})`
                : `Peso usado (${weightUnit.toUpperCase()})`}
            </label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="Ej. 20"
              value={testWeightInput}
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[^0-9.]/g, '')
                setTestWeightInput(cleaned)
              }}
              className="w-full clean-input rounded-xl px-3.5 py-2.5 font-display text-2xl text-white font-mono"
            />
            <span className="font-mono text-[10px] uppercase theme-text mt-1 block font-medium">
              {currentVariant
                ? getLoadInstruction(
                    weightKg,
                    currentVariant.equipment,
                    currentVariant.name,
                    weightUnit
                  )
                : formatDualWeight(weightKg, weightUnit)}
            </span>
          </div>

          <div>
            <label className="block font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-[#A09BA8] mb-1.5">
              Repeticiones logradas
            </label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Ej. 12 o 21"
              value={testRepsInput}
              onChange={(e) => {
                const digits = e.target.value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '')
                setTestRepsInput(digits)
              }}
              className="w-full clean-input rounded-xl px-3.5 py-2.5 font-display text-2xl text-white font-mono"
            />
            <span className="font-mono text-[10px] text-[#A09BA8] mt-1 block">
              Puedes escribir cualquier número (ej. 8, 15, 21+)
            </span>
          </div>

          <div>
            <label className="block font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-[#A09BA8] mb-1.5">
              En recámara (RIR {testRir})
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[0, 1, 2, 3].map((rirVal) => (
                <button
                  key={rirVal}
                  onClick={() => setTestRir(rirVal)}
                  className={`py-2.5 rounded-lg text-xs font-bold border transition-all ${
                    testRir === rirVal
                      ? 'theme-bg theme-border'
                      : 'bg-[#0B090E] border-[#2A2533] text-[#A09BA8]'
                  }`}
                >
                  RIR {rirVal}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[10px] bg-[#14111A] border border-[#2A2533] p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2A2533] pb-3">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#A09BA8] font-semibold">
              Resultado para {profiles[targetProfileId].name}
            </span>
            <h3 className="font-display text-2xl text-white mt-0.5">
              1RM Estimado: {formatDualWeight(zones.oneRepMaxKg, weightUnit)}
            </h3>
          </div>
          <span className="px-2.5 py-1 rounded font-mono text-[10px] font-bold uppercase bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/40 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            Zona Segura
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-[10px] bg-[#0B090E] border border-[#2A2533]">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.06em] theme-text">
              💪 Fuerza (5-6 reps)
            </span>
            <p className="font-mono text-xl font-extrabold text-white mt-1">
              {formatDualWeight(zones.strengthKg, weightUnit)}
            </p>
            {currentVariant && (
              <p className="font-mono text-[10px] uppercase theme-text mt-1 font-medium">
                {getLoadInstruction(
                  zones.strengthKg,
                  currentVariant.equipment,
                  currentVariant.name,
                  weightUnit
                )}
              </p>
            )}
          </div>

          <div className="p-3.5 rounded-[10px] bg-[#0B090E] border theme-border">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.06em] theme-text flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              ⭐ Peso Ideal (8-10 reps)
            </span>
            <p className="font-mono text-xl font-extrabold text-white mt-1">
              {formatDualWeight(zones.hypertrophyKg, weightUnit)}
            </p>
            {currentVariant && (
              <p className="font-mono text-[10px] uppercase theme-text mt-1 font-semibold">
                {getLoadInstruction(
                  zones.hypertrophyKg,
                  currentVariant.equipment,
                  currentVariant.name,
                  weightUnit
                )}
              </p>
            )}
          </div>

          <div className="p-3.5 rounded-[10px] bg-[#0B090E] border border-[#2A2533]">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-[#A09BA8]">
              🔥 Tonificación (12-15 reps)
            </span>
            <p className="font-mono text-xl font-extrabold text-white mt-1">
              {formatDualWeight(zones.metabolicToneKg, weightUnit)}
            </p>
            {currentVariant && (
              <p className="font-mono text-[10px] uppercase text-[#A09BA8] mt-1 font-medium">
                {getLoadInstruction(
                  zones.metabolicToneKg,
                  currentVariant.equipment,
                  currentVariant.name,
                  weightUnit
                )}
              </p>
            )}
          </div>
        </div>

        <div className="p-3.5 rounded-[10px] bg-[#0B090E] border border-[#2A2533]">
          <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.06em] theme-text mb-2.5">
            <TrendingUp className="w-4 h-4" />
            Escalones Pirámide Ascendente (12 ➔ 10 ➔ 8 ➔ 6 reps):
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[12, 10, 8, 6].map((repTarget, idx) => (
              <div
                key={repTarget}
                className="p-2.5 rounded-md bg-[#14111A] border border-[#2A2533] text-center"
              >
                <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-[#A09BA8] block">
                  Serie {idx + 1} ({repTarget} reps)
                </span>
                <span className="font-mono text-sm font-bold text-white mt-0.5 block">
                  {formatDualWeight(zones.pyramidAscKg[idx], weightUnit)}
                </span>
                {currentVariant && (
                  <span className="font-mono text-[9px] uppercase theme-text block mt-0.5">
                    {getLoadInstruction(
                      zones.pyramidAscKg[idx],
                      currentVariant.equipment,
                      currentVariant.name,
                      weightUnit
                    )}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="pt-1 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            onClick={handleApplyToRoutine}
            className="w-full sm:w-auto solar-btn theme-bg px-5 py-3 rounded-md text-base transition-all flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            Guardar y Fijar Peso Ideal para {profiles[targetProfileId].name}
          </button>

          {savedBanner && (
            <span className="font-mono text-[10px] uppercase text-[#10B981] bg-[#10B981]/15 border border-[#10B981]/40 px-3 py-2 rounded-md">
              ✓ ¡Peso ideal aplicado a la rutina!
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
