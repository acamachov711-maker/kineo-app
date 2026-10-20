import React, { useState } from 'react'
import {
  Sparkles,
  Users,
  ArrowRight,
  CheckCircle2,
  Scale,
  Smartphone
} from 'lucide-react'
import {
  DeviceConfig,
  GenderType,
  UserProfile,
  WeightUnit
} from '../types'
import { GOAL_OPTIONS } from '../data/initialData'
import { parseInputToKg } from '../utils/fitnessMath'

interface OnboardingWizardProps {
  initialProfiles: Record<'user_1' | 'user_2', UserProfile>
  initialUnit: WeightUnit
  onComplete: (
    profiles: Record<'user_1' | 'user_2', UserProfile>,
    deviceConfig: DeviceConfig,
    unit: WeightUnit
  ) => void
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  initialProfiles,
  initialUnit,
  onComplete
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [unit, setUnit] = useState<WeightUnit>(initialUnit)

  const [ownerName, setOwnerName] = useState<string>('')
  const [ownerGender, setOwnerGender] = useState<GenderType>('male')
  const [ownerGoal, setOwnerGoal] = useState<string>(GOAL_OPTIONS[0])
  const [ownerAge, setOwnerAge] = useState<string>('')
  const [ownerWeight, setOwnerWeight] = useState<string>('')
  const [ownerHeight, setOwnerHeight] = useState<string>('')

  const [coupleMode, setCoupleMode] = useState<boolean>(true)
  const [partnerName, setPartnerName] = useState<string>('')
  const [partnerGender, setPartnerGender] = useState<GenderType>('female')
  const [partnerGoal, setPartnerGoal] = useState<string>(GOAL_OPTIONS[1])
  const [partnerAge, setPartnerAge] = useState<string>('')
  const [partnerWeight, setPartnerWeight] = useState<string>('')
  const [partnerHeight, setPartnerHeight] = useState<string>('')

  const handleOwnerGenderSelect = (g: GenderType) => {
    setOwnerGender(g)
    if (g === 'female') {
      setOwnerGoal(GOAL_OPTIONS[1])
      setPartnerGender('male')
      setPartnerGoal(GOAL_OPTIONS[0])
    } else if (g === 'male') {
      setOwnerGoal(GOAL_OPTIONS[0])
      setPartnerGender('female')
      setPartnerGoal(GOAL_OPTIONS[1])
    }
  }

  const finishOnboarding = () => {
    const cleanOwnerName =
      ownerName.trim() || (ownerGender === 'female' ? 'Dani' : 'Adolfo')
    const cleanPartnerName =
      partnerName.trim() || (partnerGender === 'female' ? 'Dani' : 'Adolfo')

    const ownerColor = ownerGender === 'female' ? '#EC4899' : '#10B981'
    const ownerBadge =
      ownerGender === 'female'
        ? 'bg-pink-500/20 text-pink-300 border-pink-500/40'
        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'

    const partnerColor = ownerGender === 'female' ? '#10B981' : '#EC4899'
    const partnerBadge =
      ownerGender === 'female'
        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
        : 'bg-pink-500/20 text-pink-300 border-pink-500/40'

    const updatedProfiles: Record<'user_1' | 'user_2', UserProfile> = {
      user_1: {
        ...initialProfiles.user_1,
        id: 'user_1',
        name: cleanOwnerName,
        gender: ownerGender,
        isDeviceOwner: true,
        goal: ownerGoal,
        age: ownerAge ? parseInt(ownerAge, 10) : undefined,
        bodyWeightKg: ownerWeight
          ? parseInputToKg(parseFloat(ownerWeight), unit)
          : undefined,
        heightCm: ownerHeight ? parseFloat(ownerHeight) : undefined,
        accentColor: ownerColor,
        badgeColor: ownerBadge
      },
      user_2: {
        ...initialProfiles.user_2,
        id: 'user_2',
        name: cleanPartnerName,
        gender: partnerGender,
        isDeviceOwner: false,
        goal: partnerGoal,
        age: partnerAge ? parseInt(partnerAge, 10) : undefined,
        bodyWeightKg: partnerWeight
          ? parseInputToKg(parseFloat(partnerWeight), unit)
          : undefined,
        heightCm: partnerHeight ? parseFloat(partnerHeight) : undefined,
        accentColor: partnerColor,
        badgeColor: partnerBadge
      }
    }

    const config: DeviceConfig = {
      onboardingCompleted: true,
      primaryProfileId: 'user_1',
      coupleModeEnabled: coupleMode
    }

    onComplete(updatedProfiles, config, unit)
  }

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-xl w-full bg-slate-900/95 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-pink-500 p-[2px]">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center font-black text-xl text-white">
                K
              </div>
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                Configuración Inicial • Kineo v1.4
              </span>
              <h1 className="text-lg sm:text-xl font-black text-white">
                Personaliza tu Entrenamiento
              </h1>
            </div>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            Paso {step} de 3
          </span>
        </div>

        {/* STEP 1: DEVICE OWNER */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 flex items-start gap-3">
              <Smartphone className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-300 leading-relaxed">
                <strong>¿De quién es este celular?</strong> Quien se registre aquí será el{' '}
                <span className="text-emerald-300 font-bold">Perfil Principal (#1)</span> en esta
                pantalla. Si es el celular de tu novia, pon sus datos aquí para posicionarla
                primero.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Tu Nombre o Apodo (Titular de este teléfono)
              </label>
              <input
                type="text"
                placeholder="Ej. Adolfo o Dani"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-400 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Tu Género (Adapta prioridades musculares y perfil principal)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'male', label: '♂ Hombre', desc: 'Recomposición & Fuerza' },
                    { id: 'female', label: '♀ Mujer', desc: 'Glúteo, Pierna & Tonificación' },
                    { id: 'other', label: '⚡ Otro / Mixto', desc: 'Balance General' }
                  ] as const
                ).map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => handleOwnerGenderSelect(g.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      ownerGender === g.id
                        ? g.id === 'female'
                          ? 'bg-pink-500/20 border-pink-400 text-white'
                          : 'bg-emerald-500/20 border-emerald-400 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <p className="text-xs font-bold">{g.label}</p>
                    <p className="text-[10px] opacity-80 mt-0.5">{g.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Tu Objetivo Principal
              </label>
              <select
                value={ownerGoal}
                onChange={(e) => setOwnerGoal(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-400 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-white outline-none"
              >
                {GOAL_OPTIONS.map((goalOpt) => (
                  <option key={goalOpt} value={goalOpt}>
                    {goalOpt}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">
                  Datos Físicos (Opcional — Puedes omitirlos y llenarlos luego en Ajustes)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                  Opcional
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Edad (años)</label>
                  <input
                    type="number"
                    placeholder="Omitir"
                    value={ownerAge}
                    onChange={(e) => setOwnerAge(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    Peso ({unit.toUpperCase()})
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="Omitir"
                    value={ownerWeight}
                    onChange={(e) => setOwnerWeight(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Estatura (cm)</label>
                  <input
                    type="number"
                    placeholder="Omitir"
                    value={ownerHeight}
                    onChange={(e) => setOwnerHeight(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setStep(2)}
                className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs sm:text-sm flex items-center gap-2"
              >
                Continuar al Paso 2
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: PARTNER PROFILE */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-pink-950/20 border border-pink-500/30">
              <div className="flex items-center gap-2.5">
                <Users className="w-5 h-5 text-pink-400 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-white">
                    ¿Entrenarás con tu pareja en la app?
                  </p>
                  <p className="text-[11px] text-slate-300">
                    Podrán llevar sus series, pesos y rachas al mismo tiempo.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCoupleMode(!coupleMode)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
                  coupleMode
                    ? 'bg-pink-500 text-slate-950 border-pink-400'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {coupleMode ? 'Sí, Modo Pareja' : 'Solo 1 Perfil'}
              </button>
            </div>

            {coupleMode && (
              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Nombre o Apodo de tu Pareja (Perfil #2)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Dani o Adolfo"
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 focus:border-pink-400 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Género de tu Pareja
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'female', label: '♀ Mujer' },
                        { id: 'male', label: '♂ Hombre' },
                        { id: 'other', label: '⚡ Otro' }
                      ] as const
                    ).map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setPartnerGender(g.id)}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                          partnerGender === g.id
                            ? 'bg-pink-500/20 border-pink-400 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Objetivo Principal de tu Pareja
                  </label>
                  <select
                    value={partnerGoal}
                    onChange={(e) => setPartnerGoal(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 focus:border-pink-400 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-white outline-none"
                  >
                    {GOAL_OPTIONS.map((goalOpt) => (
                      <option key={goalOpt} value={goalOpt}>
                        {goalOpt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">
                      Datos Físicos de tu Pareja (Omitibles — Editables luego en Ajustes)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                      Opcional
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Edad</label>
                      <input
                        type="number"
                        placeholder="Omitir"
                        value={partnerAge}
                        onChange={(e) => setPartnerAge(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">
                        Peso ({unit.toUpperCase()})
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        placeholder="Omitir"
                        value={partnerWeight}
                        onChange={(e) => setPartnerWeight(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Estatura (cm)</label>
                      <input
                        type="number"
                        placeholder="Omitir"
                        value={partnerHeight}
                        onChange={(e) => setPartnerHeight(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
              >
                ← Atrás
              </button>
              <button
                onClick={() => setStep(3)}
                className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs sm:text-sm flex items-center gap-2"
              >
                Continuar al Paso 3
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: UNITS */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-amber-400" />
                ¿Qué unidad principal prefieres ver en las pesas?
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setUnit('kg')}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    unit === 'kg'
                      ? 'bg-amber-500/20 border-amber-400 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <p className="text-sm font-extrabold">Kilogramos (KG)</p>
                  <p className="text-[11px] opacity-80 mt-0.5">
                    Muestra KG principal y su equivalencia en LB abajo.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setUnit('lb')}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    unit === 'lb'
                      ? 'bg-amber-500/20 border-amber-400 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <p className="text-sm font-extrabold">Libras (LB)</p>
                  <p className="text-[11px] opacity-80 mt-0.5">
                    Muestra LB principal y su equivalencia en KG abajo.
                  </p>
                </button>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-slate-950 to-pink-950/30 border border-emerald-500/30 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                <Sparkles className="w-4 h-4" />
                Todo listo para ver su Sistema de Rachas e Iniciar Sesión:
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Al entrar verás el panel de <strong>Rachas Semanales</strong> y el botón para{' '}
                <strong>Comenzar la Sesión de Entrenamiento</strong> del día.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
              >
                ← Atrás
              </button>
              <button
                onClick={finishOnboarding}
                className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/25"
              >
                <CheckCircle2 className="w-5 h-5" />
                Ver mis Rachas y Entrenar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
