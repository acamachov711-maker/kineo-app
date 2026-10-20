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
  formatDualWeight
} from '../utils/fitnessMath'
import { ExerciseAnimationViewer } from './ExerciseAnimationViewer'

interface IdealWeightCalculatorProps {
  mesocycle: MesocyclePlan
  profiles: Record<'user_1' | 'user_2', UserProfile>
  selectedProfileId: 'user_1' | 'user_2'
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
  weightUnit,
  preselectedVariant,
  onSaveIdealWeight
}) => {
  const [targetProfileId, setTargetProfileId] = useState<'user_1' | 'user_2'>(selectedProfileId)

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
  const [testReps, setTestReps] = useState<number>(8)
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

  const weightKg = parseInputToKg(parseFloat(testWeightInput) || 0, weightUnit)
  const estimated1RmKg = calculateSafe1RM(weightKg, testReps, testRir)
  const zones = getIdealWeightZones(estimated1RmKg)

  const currentItem = allVariants.find((x) => x.variant.id === selectedVariantId)

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
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-900 border border-emerald-500/30 p-5">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 shrink-0">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Configuración y Prueba de Peso Ideal Seguro
            </h2>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Elige un peso con el que puedas sacar entre <strong>5 y 10 repeticiones limpias</strong>{' '}
              dejando 1 o 2 en recámara (RIR 2). Kineo calculará tus pesos exactos para series
              normales y piramidales sin riesgo de lesión.
            </p>
          </div>
        </div>
      </div>

      {currentItem && (
        <ExerciseAnimationViewer
          variant={currentItem.variant}
          accentColor={profiles[targetProfileId].accentColor}
        />
      )}

      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 sm:p-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            1. ¿Para quién es la prueba?
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            {(['user_1', 'user_2'] as const).map((pid) => {
              const p = profiles[pid]
              const active = targetProfileId === pid
              return (
                <button
                  key={pid}
                  onClick={() => setTargetProfileId(pid)}
                  className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                    active
                      ? 'bg-slate-800 border-white/40 text-white shadow-md'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: p.accentColor }}
                  />
                  <div className="truncate">
                    <p className="text-xs font-bold">{p.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{p.goal}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            2. Selecciona el Ejercicio o Máquina
          </label>
          <select
            value={selectedVariantId}
            onChange={(e) => setSelectedVariantId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white outline-none focus:border-emerald-400"
          >
            {allVariants.map((item) => (
              <option key={item.variant.id} value={item.variant.id}>
                [Sesión {item.sessionCode}] {item.variant.name} ({item.variant.equipment})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Peso usado en la prueba ({weightUnit.toUpperCase()})
            </label>
            <input
              type="number"
              step="0.5"
              min="1"
              value={testWeightInput}
              onChange={(e) => setTestWeightInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-400 rounded-xl px-3.5 py-2.5 text-base font-bold text-white outline-none"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              Equivale a: {formatDualWeight(weightKg, weightUnit)}
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Repeticiones logradas ({testReps} reps)
            </label>
            <input
              type="range"
              min="3"
              max="15"
              value={testReps}
              onChange={(e) => setTestReps(parseInt(e.target.value, 10))}
              className="w-full accent-emerald-500 mt-2"
            />
            <div className="flex justify-between text-[11px] text-slate-400 mt-1">
              <span>3 reps</span>
              <span className="font-bold text-emerald-300">{testReps} reps</span>
              <span>15 reps</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Repeticiones en recámara (RIR {testRir})
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[0, 1, 2, 3].map((rirVal) => (
                <button
                  key={rirVal}
                  onClick={() => setTestRir(rirVal)}
                  className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                    testRir === rirVal
                      ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  RIR {rirVal}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
              Resultado para {profiles[targetProfileId].name}
            </span>
            <h3 className="text-lg font-bold text-white mt-0.5">
              1RM Máximo Estimado: {formatDualWeight(zones.oneRepMaxKg, weightUnit)}
            </h3>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            Zona Segura Sin Lesión
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-xs font-semibold text-amber-300">
              💪 Fuerza Controlada (5-6 reps)
            </span>
            <p className="text-xl font-extrabold text-white mt-1">
              {formatDualWeight(zones.strengthKg, weightUnit)}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-950/25 border border-emerald-500/40">
            <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              ⭐ Recomposición Ideal (8-10 reps)
            </span>
            <p className="text-xl font-extrabold text-white mt-1">
              {formatDualWeight(zones.hypertrophyKg, weightUnit)}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-xs font-semibold text-pink-300">
              🔥 Tonificación / Metabólico (12-15 reps)
            </span>
            <p className="text-xl font-extrabold text-white mt-1">
              {formatDualWeight(zones.metabolicToneKg, weightUnit)}
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300 mb-2.5">
            <TrendingUp className="w-4 h-4" />
            Escalones sugeridos para tu Pirámide Ascendente (12 ➔ 10 ➔ 8 ➔ 6 reps):
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[12, 10, 8, 6].map((repTarget, idx) => (
              <div
                key={repTarget}
                className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-center"
              >
                <span className="text-[10px] uppercase text-slate-400 block">
                  Serie {idx + 1} ({repTarget} reps)
                </span>
                <span className="text-sm font-bold text-white mt-0.5 block">
                  {formatDualWeight(zones.pyramidAscKg[idx], weightUnit)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-1 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            onClick={handleApplyToRoutine}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            Guardar y Fijar Peso Ideal para {profiles[targetProfileId].name}
          </button>

          {savedBanner && (
            <span className="text-xs font-semibold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-3 py-2 rounded-xl">
              ✓ ¡Peso ideal calibrado y aplicado a la rutina!
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
