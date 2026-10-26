import React, { useState } from 'react'
import {
  Users,
  User,
  Scale,
  ArrowRight,
  Sparkles,
  Smartphone,
  Wifi,
  Check
} from 'lucide-react'
import {
  DeviceConfig,
  GenderType,
  UserProfile,
  WeightUnit
} from '../types'
import { parseInputToKg, sanitizeDecimalInput } from '../utils/fitnessMath'
import { GOAL_OPTIONS, ASCENT_COLOR_PALETTE } from '../data/initialData'
import { generateCoupleRoomCode, normalizeRoomCode } from '../services/syncService'

interface OnboardingWizardProps {
  initialProfiles: Record<'user_1' | 'user_2', UserProfile>
  initialUnit?: WeightUnit
  onComplete: (
    profiles: Record<'user_1' | 'user_2', UserProfile>,
    deviceConfig: DeviceConfig,
    unit: WeightUnit
  ) => void
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  initialProfiles,
  initialUnit = 'kg',
  onComplete
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1)

  const [coupleMode, setCoupleMode] = useState<boolean>(true)
  const [syncRoomCode, setSyncRoomCode] = useState<string>(() => generateCoupleRoomCode())

  const [ownerName, setOwnerName] = useState<string>(initialProfiles.user_1.name || '')
  const [ownerGender, setOwnerGender] = useState<GenderType>(initialProfiles.user_1.gender || 'male')
  const [ownerGoal, setOwnerGoal] = useState<string>(initialProfiles.user_1.goal || GOAL_OPTIONS[0])
  const [ownerColor, setOwnerColor] = useState<string>(initialProfiles.user_1.accentColor || '#FF5500')
  const [ownerAge, setOwnerAge] = useState<string>(
    initialProfiles.user_1.age ? String(initialProfiles.user_1.age) : ''
  )
  const [ownerWeight, setOwnerWeight] = useState<string>('')
  const [ownerHeight, setOwnerHeight] = useState<string>(
    initialProfiles.user_1.heightCm ? String(initialProfiles.user_1.heightCm) : ''
  )

  const [partnerName, setPartnerName] = useState<string>(initialProfiles.user_2.name || '')
  const [partnerGender, setPartnerGender] = useState<GenderType>(
    initialProfiles.user_2.gender || 'female'
  )
  const [partnerGoal, setPartnerGoal] = useState<string>(
    initialProfiles.user_2.goal || GOAL_OPTIONS[1]
  )
  const [partnerColor, setPartnerColor] = useState<string>(
    initialProfiles.user_2.accentColor || '#8B5CF6'
  )
  const [partnerAge, setPartnerAge] = useState<string>(
    initialProfiles.user_2.age ? String(initialProfiles.user_2.age) : ''
  )
  const [partnerWeight, setPartnerWeight] = useState<string>('')
  const [partnerHeight, setPartnerHeight] = useState<string>(
    initialProfiles.user_2.heightCm ? String(initialProfiles.user_2.heightCm) : ''
  )

  const [unit, setUnit] = useState<WeightUnit>(initialUnit)

  const handleFinish = () => {
    const cleanOwnerName = ownerName.trim() || 'Titular'
    const cleanPartnerName = partnerName.trim() || 'Pareja'

    const ownerWeightKg = ownerWeight ? parseInputToKg(parseFloat(ownerWeight), unit) : undefined
    const partnerWeightKg = partnerWeight
      ? parseInputToKg(parseFloat(partnerWeight), unit)
      : undefined

    const updatedProfiles: Record<'user_1' | 'user_2', UserProfile> = {
      user_1: {
        ...initialProfiles.user_1,
        id: 'user_1',
        name: cleanOwnerName,
        gender: ownerGender,
        isDeviceOwner: true,
        goal: ownerGoal,
        age: ownerAge ? parseInt(ownerAge, 10) : undefined,
        bodyWeightKg: ownerWeightKg ?? initialProfiles.user_1.bodyWeightKg,
        heightCm: ownerHeight ? parseFloat(ownerHeight) : initialProfiles.user_1.heightCm,
        accentColor: ownerColor,
        badgeColor: 'theme-soft-bg theme-text border theme-border'
      },
      user_2: {
        ...initialProfiles.user_2,
        id: 'user_2',
        name: cleanPartnerName,
        gender: partnerGender,
        isDeviceOwner: false,
        goal: partnerGoal,
        age: partnerAge ? parseInt(partnerAge, 10) : undefined,
        bodyWeightKg: partnerWeightKg ?? initialProfiles.user_2.bodyWeightKg,
        heightCm: partnerHeight ? parseFloat(partnerHeight) : initialProfiles.user_2.heightCm,
        accentColor: partnerColor,
        badgeColor: 'theme-soft-bg theme-text border theme-border'
      }
    }

    const config: DeviceConfig = {
      onboardingCompleted: true,
      primaryProfileId: 'user_1',
      coupleModeEnabled: coupleMode,
      syncRoomCode: coupleMode && syncRoomCode.trim() ? normalizeRoomCode(syncRoomCode) : undefined
    }

    onComplete(updatedProfiles, config, unit)
  }

  return (
    <div className="min-h-screen bg-[#0B090E] text-white flex items-center justify-center p-4">
      <div className="max-w-xl w-full bg-[#14111A] border border-[#2A2533] rounded-[10px] p-5 sm:p-7 space-y-5">
        <div className="flex items-center justify-between border-b border-[#2A2533] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-[10px] bg-[#0B090E] border border-[#2A2533] flex items-center justify-center">
              <div className="font-display text-2xl text-white">K</div>
            </div>
            <div>
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] theme-text">
                Configuración Inicial • Kineo v1.6
              </span>
              <h1 className="font-display text-2xl text-white">
                Personaliza tu Entrenamiento
              </h1>
            </div>
          </div>
          <span className="font-mono text-[10px] font-bold px-2.5 py-1 rounded bg-[#0B090E] text-[#C7C3D1] border border-[#2A2533]">
            Paso {step} de {coupleMode ? 3 : 2}
          </span>
        </div>

        {/* STEP 1: MODE (SOLO vs COUPLE) + DEVICE OWNER */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-[#A09BA8] mb-2">
                1. ¿Cómo vas a usar Kineo? (Puedes cambiarlo luego en Ajustes)
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setCoupleMode(false)}
                  className={`p-3 rounded-md border text-left transition-all ${
                    !coupleMode
                      ? 'theme-soft-bg theme-border text-white shadow-md'
                      : 'bg-[#0B090E] border-[#2A2533] text-[#A09BA8]'
                  }`}
                >
                  <div className="flex items-center gap-2 font-extrabold text-xs sm:text-sm">
                    <User className="w-4 h-4 theme-text" />
                    Individual (Solo)
                  </div>
                  <p className="text-[11px] text-[#A09BA8] mt-1">
                    Interfaz limpia dedicada 100% a ti.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setCoupleMode(true)}
                  className={`p-3 rounded-md border text-left transition-all ${
                    coupleMode
                      ? 'theme-soft-bg theme-border text-white shadow-md'
                      : 'bg-[#0B090E] border-[#2A2533] text-[#A09BA8]'
                  }`}
                >
                  <div className="flex items-center gap-2 font-extrabold text-xs sm:text-sm">
                    <Users className="w-4 h-4 theme-text" />
                    En Pareja (Sync)
                  </div>
                  <p className="text-[11px] text-[#A09BA8] mt-1">
                    Sincroniza 2 teléfonos en vivo o alterna perfiles.
                  </p>
                </button>
              </div>
            </div>

            <div className="p-3 rounded-[10px] bg-[#14111A] border border-[#2A2533] flex items-start gap-2.5">
              <Smartphone className="w-4 h-4 theme-text shrink-0 mt-0.5" />
              <p className="text-xs text-[#C7C3D1] leading-snug">
                <strong>Datos del dueño de este celular (#1):</strong> Si es el teléfono de tu
                pareja, pon sus datos aquí para que ella aparezca primero.
              </p>
            </div>

            <div>
              <label className="block font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-[#A09BA8] mb-1.5">
                Tu Nombre o Apodo
              </label>
              <input
                type="text"
                placeholder="Ej. Adolfo o Dani"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="clean-input font-mono text-sm font-bold text-white"
              />
            </div>

            <div>
              <label className="block font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-[#A09BA8] mb-1.5">
                Tu Género
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'male' as GenderType, label: '♂ Hombre' },
                  { id: 'female' as GenderType, label: '♀ Mujer' },
                  { id: 'other' as GenderType, label: '⚡ Otro' }
                ].map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setOwnerGender(g.id)}
                    className={`p-2.5 rounded-md border font-mono text-[11px] font-bold uppercase transition-all ${
                      ownerGender === g.id
                        ? 'theme-soft-bg theme-border text-white'
                        : 'bg-[#0B090E] border-[#2A2533] text-[#A09BA8]'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {/* V1.6-10: Catálogo de 8 Colores Kineo Ascent para el Titular */}
            <div>
              <label className="block font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-[#A09BA8] mb-1.5">
                Color de Acento de tu Perfil
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 bg-[#0B090E] p-2.5 rounded-[10px] border border-[#2A2533]">
                {ASCENT_COLOR_PALETTE.map((c) => {
                  const selected = ownerColor.toUpperCase() === c.hex.toUpperCase()
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setOwnerColor(c.hex)}
                      title={c.name}
                      className={`h-9 rounded-lg border flex items-center justify-center transition-all ${
                        selected ? 'border-white scale-105 shadow-lg' : 'border-[#2A2533] opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c.hex }}
                    >
                      {selected && (
                        <Check
                          className="w-4 h-4 stroke-[3]"
                          style={{ color: c.fgHex }}
                        />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="block font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-[#A09BA8] mb-1.5">
                Tu Objetivo Principal
              </label>
              <select
                value={ownerGoal}
                onChange={(e) => setOwnerGoal(e.target.value)}
                className="clean-input font-mono text-xs sm:text-sm font-semibold text-white"
              >
                {GOAL_OPTIONS.map((goalOpt) => (
                  <option key={goalOpt} value={goalOpt}>
                    {goalOpt}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-3 rounded-[10px] bg-[#0B090E] border border-[#2A2533] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-[#A09BA8]">
                  Datos Físicos (Opcional)
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-mono text-[9px] uppercase tracking-[0.06em] text-[#A09BA8] block mb-1">
                    Edad
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Ej. 32"
                    value={ownerAge}
                    onChange={(e) => setOwnerAge(e.target.value.replace(/[^0-9]/g, ''))}
                    className="clean-input font-mono text-xs text-white"
                  />
                </div>
                <div>
                  <label className="font-mono text-[9px] uppercase tracking-[0.06em] text-[#A09BA8] block mb-1">
                    Peso ({unit.toUpperCase()})
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Ej. 78"
                    value={ownerWeight}
                    onChange={(e) => setOwnerWeight(sanitizeDecimalInput(e.target.value))}
                    className="clean-input font-mono text-xs text-white"
                  />
                </div>
                <div>
                  <label className="font-mono text-[9px] uppercase tracking-[0.06em] text-[#A09BA8] block mb-1">
                    Altura (CM)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Ej. 178"
                    value={ownerHeight}
                    onChange={(e) => setOwnerHeight(e.target.value.replace(/[^0-9]/g, ''))}
                    className="clean-input font-mono text-xs text-white"
                  />
                </div>
              </div>
            </div>

            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={() => setStep(coupleMode ? 2 : 3)}
                className="solar-btn theme-bg px-5 py-3 rounded-md text-base flex items-center gap-2"
              >
                Continuar
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: PARTNER & LIVE SYNC CODE (Only if coupleMode === true) */}
        {step === 2 && coupleMode && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-[10px] bg-[#14111A] border border-[#2A2533] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-[#A09BA8] flex items-center gap-1.5">
                  <Wifi className="w-4 h-4 text-[#10B981]" />
                  Código de Sala en Vivo (Conecta los 2 Teléfonos)
                </span>
                <button
                  type="button"
                  onClick={() => setSyncRoomCode(generateCoupleRoomCode())}
                  className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#0B090E] text-[#C7C3D1] border border-[#2A2533]"
                >
                  Generar otro
                </button>
              </div>
              <input
                type="text"
                value={syncRoomCode}
                onChange={(e) => setSyncRoomCode(e.target.value.toUpperCase())}
                placeholder="Ej. KINEO-4829"
                className="clean-input font-mono text-base font-black tracking-widest text-white uppercase"
              />
              <p className="text-[11px] text-[#A09BA8] leading-snug">
                Pon este <strong>mismo código</strong> en ambos teléfonos para que lo que anote tu
                pareja o tú se actualice en vivo en los dos celulares.
              </p>
            </div>

            <div className="space-y-3 pt-1">
              <div>
                <label className="block font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-[#A09BA8] mb-1.5">
                  Nombre de tu Pareja
                </label>
                <input
                  type="text"
                  placeholder="Ej. Dani o Adolfo"
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  className="clean-input font-mono text-sm font-bold text-white"
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-[#A09BA8] mb-1.5">
                  Género de tu Pareja
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'female' as GenderType, label: '♀ Mujer' },
                    { id: 'male' as GenderType, label: '♂ Hombre' },
                    { id: 'other' as GenderType, label: '⚡ Otro' }
                  ].map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setPartnerGender(g.id)}
                      className={`p-2.5 rounded-md border font-mono text-[11px] font-bold uppercase transition-all ${
                        partnerGender === g.id
                          ? 'theme-soft-bg theme-border text-white'
                          : 'bg-[#0B090E] border-[#2A2533] text-[#A09BA8]'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* V1.6-10: Catálogo de 8 Colores Kineo Ascent para la Pareja */}
              <div>
                <label className="block font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-[#A09BA8] mb-1.5">
                  Color de Acento de tu Pareja
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 bg-[#0B090E] p-2.5 rounded-[10px] border border-[#2A2533]">
                  {ASCENT_COLOR_PALETTE.map((c) => {
                    const selected = partnerColor.toUpperCase() === c.hex.toUpperCase()
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setPartnerColor(c.hex)}
                        title={c.name}
                        className={`h-9 rounded-lg border flex items-center justify-center transition-all ${
                          selected ? 'border-white scale-105 shadow-lg' : 'border-[#2A2533] opacity-80 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c.hex }}
                      >
                        {selected && (
                          <Check
                            className="w-4 h-4 stroke-[3]"
                            style={{ color: c.fgHex }}
                          />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-[#A09BA8] mb-1.5">
                  Objetivo de tu Pareja
                </label>
                <select
                  value={partnerGoal}
                  onChange={(e) => setPartnerGoal(e.target.value)}
                  className="clean-input font-mono text-xs sm:text-sm font-semibold text-white"
                >
                  {GOAL_OPTIONS.map((goalOpt) => (
                    <option key={goalOpt} value={goalOpt}>
                      {goalOpt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2.5 rounded-md bg-[#0B090E] text-[#A09BA8] border border-[#2A2533] font-mono text-[10px] font-bold uppercase"
              >
                ← Atrás
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="solar-btn theme-bg px-5 py-3 rounded-md text-base flex items-center gap-2"
              >
                Continuar
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: UNITS */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="block font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-[#A09BA8] mb-2 flex items-center gap-1.5">
                <Scale className="w-4 h-4 theme-text" />
                ¿Qué unidad principal prefieres ver en las pesas?
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setUnit('kg')}
                  className={`p-3.5 rounded-md border text-left transition-all ${
                    unit === 'kg'
                      ? 'theme-soft-bg theme-border text-white'
                      : 'bg-[#0B090E] border-[#2A2533] text-[#A09BA8]'
                  }`}
                >
                  <p className="font-display text-lg">Kilogramos (KG)</p>
                  <p className="text-[11px] text-[#A09BA8] mt-0.5">
                    Muestra KG y cuánto poner de cada lado.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setUnit('lb')}
                  className={`p-3.5 rounded-md border text-left transition-all ${
                    unit === 'lb'
                      ? 'theme-soft-bg theme-border text-white'
                      : 'bg-[#0B090E] border-[#2A2533] text-[#A09BA8]'
                  }`}
                >
                  <p className="font-display text-lg">Libras (LB)</p>
                  <p className="text-[11px] text-[#A09BA8] mt-0.5">
                    Muestra LB y cuánto poner de cada lado.
                  </p>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(coupleMode ? 2 : 1)}
                className="px-4 py-2.5 rounded-md bg-[#0B090E] text-[#A09BA8] border border-[#2A2533] font-mono text-[10px] font-bold uppercase"
              >
                ← Atrás
              </button>
              <button
                type="button"
                onClick={handleFinish}
                className="solar-btn theme-bg px-6 py-3 rounded-md text-base flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Entrar a Kineo v1.6
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
