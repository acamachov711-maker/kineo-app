import React, { useState, useEffect, useRef } from 'react'
import {
  Users,
  User,
  Calendar,
  RefreshCw,
  Check,
  Sparkles,
  Smartphone,
  ArrowLeftRight,
  Target,
  BookOpen,
  Trash2,
  Wifi
} from 'lucide-react'
import {
  DeviceConfig,
  ExerciseVariant,
  GenderType,
  MesocyclePlan,
  UserProfile,
  WeightUnit
} from '../types'
import { INITIAL_MESOCYCLE, GOAL_OPTIONS, ASCENT_COLOR_PALETTE } from '../data/initialData'
import {
  calculateBMI,
  displayWeightValue,
  parseInputToKg,
  sanitizeDecimalInput
} from '../utils/fitnessMath'
import { IdealWeightCalculator } from './IdealWeightCalculator'
import { FitnessGuide } from './FitnessGuide'
import { BackupButton } from './StorageNotice'

export type SettingsSubTab = 'profiles' | 'ideal_weight' | 'guide'

interface SettingsHubProps {
  profiles: Record<'user_1' | 'user_2', UserProfile>
  deviceConfig: DeviceConfig
  mesocycle: MesocyclePlan
  weightUnit: WeightUnit
  activeProfileId?: 'user_1' | 'user_2'
  onSelectActiveProfile?: (profileId: 'user_1' | 'user_2') => void
  pendingOperations?: number
  initialSubTab?: SettingsSubTab
  calculatorPreselect?: {
    profileId: 'user_1' | 'user_2'
    variant: ExerciseVariant
    slotId: string
  } | null
  highlightedGlossaryId?: string | null
  hasSampleData: boolean
  onUpdateProfiles: (updated: Record<'user_1' | 'user_2', UserProfile>) => void
  onUpdateDeviceConfig: (updated: DeviceConfig) => void
  onUpdateMesocycle: (updated: MesocyclePlan) => void
  onSaveIdealWeight: (
    profileId: 'user_1' | 'user_2',
    variantId: string,
    oneRmKg: number,
    slotId?: string
  ) => void
  onClearSampleHistory: () => void
  onResetMesocycle: () => void
  onReopenOnboarding: () => void
  onDeleteCompanionData?: () => void
  profileRemovalMessage?: string
}

export const SettingsAndMesocycle: React.FC<SettingsHubProps> = ({
  profiles,
  deviceConfig,
  mesocycle,
  weightUnit,
  activeProfileId,
  onSelectActiveProfile,
  pendingOperations = 0,
  initialSubTab = 'profiles',
  calculatorPreselect,
  highlightedGlossaryId,
  hasSampleData,
  onUpdateProfiles,
  onUpdateDeviceConfig,
  onUpdateMesocycle,
  onSaveIdealWeight,
  onClearSampleHistory,
  onResetMesocycle,
  onReopenOnboarding,
  onDeleteCompanionData,
  profileRemovalMessage = ''
}) => {
  const [subTab, setSubTab] = useState<SettingsSubTab>(initialSubTab)

  const [name1, setName1] = useState(profiles.user_1.name)
  const [gender1, setGender1] = useState<GenderType>(profiles.user_1.gender)
  const [goal1, setGoal1] = useState(
    GOAL_OPTIONS.includes(profiles.user_1.goal) ? profiles.user_1.goal : GOAL_OPTIONS[0]
  )
  const [color1, setColor1] = useState(profiles.user_1.accentColor || '#FF5500')
  const [age1, setAge1] = useState(profiles.user_1.age ? String(profiles.user_1.age) : '')
  const [weight1, setWeight1] = useState(
    profiles.user_1.bodyWeightKg
      ? String(displayWeightValue(profiles.user_1.bodyWeightKg, weightUnit))
      : ''
  )
  const [height1, setHeight1] = useState(
    profiles.user_1.heightCm ? String(profiles.user_1.heightCm) : ''
  )

  const [name2, setName2] = useState(profiles.user_2.name)
  const [gender2, setGender2] = useState<GenderType>(profiles.user_2.gender)
  const [goal2, setGoal2] = useState(
    GOAL_OPTIONS.includes(profiles.user_2.goal) ? profiles.user_2.goal : GOAL_OPTIONS[1]
  )
  const [color2, setColor2] = useState(profiles.user_2.accentColor || '#8B5CF6')
  const [age2, setAge2] = useState(profiles.user_2.age ? String(profiles.user_2.age) : '')
  const [weight2, setWeight2] = useState(
    profiles.user_2.bodyWeightKg
      ? String(displayWeightValue(profiles.user_2.bodyWeightKg, weightUnit))
      : ''
  )
  const [height2, setHeight2] = useState(
    profiles.user_2.heightCm ? String(profiles.user_2.heightCm) : ''
  )

  const [savedProfilesMsg, setSavedProfilesMsg] = useState(false)
  const [confirmRemoval, setConfirmRemoval] = useState(false)
  const [removalName, setRemovalName] = useState('')
  const confirmationInput = useRef<HTMLInputElement>(null)
  const removalButton = useRef<HTMLButtonElement>(null)
  const removalStatus = useRef<HTMLParagraphElement>(null)
  const companionId = deviceConfig.primaryProfileId === 'user_1' ? 'user_2' : 'user_1'
  const companionName = profiles[companionId].name
  useEffect(() => {
    if (confirmRemoval) confirmationInput.current?.focus()
  }, [confirmRemoval])
  useEffect(() => {
    if (profileRemovalMessage) removalStatus.current?.focus()
  }, [profileRemovalMessage])

  const handleSaveProfiles = () => {
    onUpdateProfiles({
      user_1: {
        ...profiles.user_1,
        name: name1.trim() || 'Perfil 1',
        gender: gender1,
        goal: goal1,
        age: age1 ? parseInt(age1, 10) : undefined,
        bodyWeightKg: weight1
          ? parseInputToKg(parseFloat(weight1), weightUnit)
          : undefined,
        heightCm: height1 ? parseFloat(height1) : undefined,
        accentColor: color1
      },
      user_2: {
        ...profiles.user_2,
        name: name2.trim() || 'Perfil 2',
        gender: gender2,
        goal: goal2,
        age: age2 ? parseInt(age2, 10) : undefined,
        bodyWeightKg: weight2
          ? parseInputToKg(parseFloat(weight2), weightUnit)
          : undefined,
        heightCm: height2 ? parseFloat(height2) : undefined,
        accentColor: color2
      }
    })
    setSavedProfilesMsg(true)
    setTimeout(() => setSavedProfilesMsg(false), 3000)
  }

  const handleSwapDeviceOwner = () => {
    const nextPrimary: 'user_1' | 'user_2' =
      deviceConfig.primaryProfileId === 'user_1' ? 'user_2' : 'user_1'
    onUpdateDeviceConfig({
      ...deviceConfig,
      primaryProfileId: nextPrimary
    })
  }

  const bmi1 = calculateBMI(profiles.user_1.bodyWeightKg, profiles.user_1.heightCm)
  const bmi2 = calculateBMI(profiles.user_2.bodyWeightKg, profiles.user_2.heightCm)

  return (
    <div className="space-y-4 pb-24">
      {/* Segmented Sub-navigation inside Ajustes */}
      <div className="grid grid-cols-3 gap-2 bg-[#14111A] border border-[#2A2533] p-1.5 rounded-[10px]">
        <button
          type="button"
          onClick={() => setSubTab('profiles')}
          className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
            subTab === 'profiles'
              ? 'theme-bg shadow-md'
              : 'text-[#A09BA8] hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          Modo y Pareja
        </button>

        <button
          type="button"
          onClick={() => setSubTab('ideal_weight')}
          className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
            subTab === 'ideal_weight'
              ? 'theme-bg shadow-md'
              : 'text-[#A09BA8] hover:text-white'
          }`}
        >
          <Target className="w-4 h-4" />
          Peso Ideal
        </button>

        <button
          type="button"
          onClick={() => setSubTab('guide')}
          className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
            subTab === 'guide'
              ? 'theme-bg shadow-md'
              : 'text-[#A09BA8] hover:text-white'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Guía & Cardio
        </button>
      </div>

      {/* SUB-TAB 1: MODE (SOLO VS COUPLE), LIVE SYNC & PROFILES */}
      {subTab === 'profiles' && (
        <div className="space-y-4">
          <div className="rounded-[10px] bg-[#14111A] border border-[#2A2533] p-4">
            <h3 className="font-semibold text-sm mb-2">Copia de seguridad local</h3>
            <p className="text-xs text-[#A09BA8] mb-3">Incluye perfiles, historial y sesiones en curso. Contiene datos personales: guárdala en un lugar privado. La restauración desde archivo todavía no está disponible.</p>
            <BackupButton />
          </div>
          {hasSampleData && (
            <div className="rounded-[10px] bg-[#14111A] border theme-border p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-mono text-[11px] font-bold uppercase theme-text">
                  📊 Datos de Ejemplo Activos
                </h3>
              </div>
              <button
                type="button"
                onClick={onClearSampleHistory}
                className="px-3.5 py-2 rounded-md bg-[#0B090E] border border-[#2A2533] text-[#A09BA8] font-mono text-[10px] font-bold uppercase flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Borrar Datos de Ejemplo
              </button>
            </div>
          )}

          {/* MODE SELECTOR: INDIVIDUAL vs COUPLE */}
          <div className="rounded-[10px] bg-[#14111A] border border-[#2A2533] p-4 space-y-3">
            <h2 className="text-sm font-bold text-white">
              Modo de Entrenamiento
            </h2>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() =>
                  onUpdateDeviceConfig({
                    ...deviceConfig,
                    coupleModeEnabled: false
                  })
                }
                className={`p-3 rounded-xl border text-left transition-all ${
                  !deviceConfig.coupleModeEnabled
                    ? 'theme-soft-bg theme-border text-white shadow-md'
                    : 'bg-[#0B090E] border-[#2A2533] text-[#A09BA8]'
                }`}
              >
                <div className="flex items-center gap-2 font-extrabold text-xs sm:text-sm">
                  <User className="w-4 h-4 theme-text" />
                  Individual (Solo)
                </div>
                <p className="text-[11px] opacity-80 mt-0.5">
                  Muestra solo tu perfil y tus series.
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  onUpdateDeviceConfig({
                    ...deviceConfig,
                    coupleModeEnabled: true
                  })
                }
                className={`p-3 rounded-xl border text-left transition-all ${
                  deviceConfig.coupleModeEnabled
                    ? 'theme-soft-bg theme-border text-white shadow-md'
                    : 'bg-[#0B090E] border-[#2A2533] text-[#A09BA8]'
                }`}
              >
                <div className="flex items-center gap-2 font-extrabold text-xs sm:text-sm">
                  <Users className="w-4 h-4 theme-text" />
                  En pareja
                </div>
                <p className="text-[11px] opacity-80 mt-0.5">
                  Alterna entre ambos perfiles en este móvil.
                </p>
              </button>
            </div>
          </div>

          {/* LIVE SYNC ROOM CARD (Only visible when coupleModeEnabled) */}
          {deviceConfig.coupleModeEnabled && (
            <div className="rounded-[10px] bg-[#14111A] border border-[#2A2533] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Wifi className="w-5 h-5 text-[#10B981]" />
                  <div>
                    <h2 className="text-sm font-bold text-white">
                      Registro compartido en este móvil
                    </h2>
                    <p className="font-mono text-[10px] text-[#A09BA8]">
                      Podéis registrar ambos perfiles sin conexión. Los controles de sala permiten iniciar una conexión pública de pruebas.
                    </p>
                  </div>
                </div>
                <span
                  className="px-2.5 py-1 rounded-full text-[11px] font-bold border bg-[#0B090E] text-[#A09BA8] border-[#2A2533]"
                >
                  Sala opcional
                </span>
              </div>

              <p role="status" className="text-xs text-[#A09BA8]">
                {pendingOperations} cambios pendientes en los diarios locales. Consulta el estado de conexión y los recibos en el panel de sala.
              </p>
              <p className="text-xs text-[#A09BA8]">Crear o solicitar una sala abre una conexión al broker público. Utiliza datos ficticios: no hay privacidad ni contraseña validada. No se requieren cuentas personales y no se cambia la rutina automáticamente.</p>
            </div>
          )}

          {/* Device Primary Owner Switcher */}
          {deviceConfig.coupleModeEnabled && (
            <div className="rounded-[10px] bg-[#14111A] border border-[#2A2533] p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Smartphone className="w-5 h-5 theme-text shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-sm font-bold text-white">
                    Dueño de este Teléfono:{' '}
                    <span style={{ color: profiles[deviceConfig.primaryProfileId].accentColor }}>
                      {profiles[deviceConfig.primaryProfileId].name}
                    </span>
                  </h2>
                  <p className="font-mono text-[10px] text-[#A09BA8]">
                    En el celular de tu pareja, ponla a ella como principal.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSwapDeviceOwner}
                  className="px-3 py-2 rounded-md bg-[#0B090E] hover:bg-[#1C1826] font-mono text-[10px] font-bold uppercase theme-text border border-[#2A2533] flex items-center gap-1.5"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  Cambiar Titular
                </button>
                <button
                  type="button"
                  onClick={onReopenOnboarding}
                  className="px-3 py-2 rounded-md bg-[#0B090E] hover:bg-[#1C1826] font-mono text-[10px] font-bold uppercase text-[#A09BA8] border border-[#2A2533]"
                >
                  Asistente
                </button>
              </div>
            </div>
          )}

          {/* Profiles Customization */}
          <div className="rounded-[10px] bg-[#14111A] border border-[#2A2533] p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 theme-text" />
              <h2 className="font-display text-xl text-white">Datos de Perfiles</h2>
            </div>

            <div
              className={`grid gap-4 ${
                deviceConfig.coupleModeEnabled ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
              }`}
            >
              {/* Profile 1 Card */}
              <div className="p-3.5 rounded-[10px] bg-[#0B090E] border border-[#2A2533] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span
                    className="text-xs font-bold"
                    style={{ color: color1 }}
                  >
                    Perfil 1 {deviceConfig.primaryProfileId === 'user_1' ? '(Principal)' : ''}
                  </span>
                  {bmi1 && (
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#0B090E] text-[#C7C3D1] border border-[#2A2533]">
                      IMC: {bmi1}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-mono text-[9px] uppercase tracking-[0.06em] text-[#A09BA8] block mb-1">
                      Nombre
                    </label>
                    <input
                      type="text"
                      value={name1}
                      onChange={(e) => setName1(e.target.value)}
                      className="clean-input font-mono text-xs font-bold text-white"
                    />
                  </div>
                  <div>
                    <label className="font-mono text-[9px] uppercase tracking-[0.06em] text-[#A09BA8] block mb-1">
                      Género
                    </label>
                    <select
                      value={gender1}
                      onChange={(e) => setGender1(e.target.value as GenderType)}
                      className="clean-input font-mono text-xs font-bold text-white"
                    >
                      <option value="male">♂ Hombre</option>
                      <option value="female">♀ Mujer</option>
                      <option value="other">⚡ Otro</option>
                    </select>
                  </div>
                </div>

                {/* V1.6-10: Selector de 8 colores para Perfil 1 */}
                <div>
                  <label className="font-mono text-[9px] uppercase tracking-[0.06em] text-[#A09BA8] block mb-1">
                    Color Kineo Ascent
                  </label>
                  <div className="grid grid-cols-8 gap-1.5 bg-[#14111A] p-1.5 rounded-lg border border-[#2A2533]">
                    {ASCENT_COLOR_PALETTE.map((c) => {
                      const selected = color1.toUpperCase() === c.hex.toUpperCase()
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setColor1(c.hex)}
                          title={c.name}
                          className={`h-7 rounded-md border flex items-center justify-center transition-all ${
                            selected ? 'border-white scale-105' : 'border-transparent opacity-75 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: c.hex }}
                        >
                          {selected && <Check className="w-3.5 h-3.5 stroke-[3]" style={{ color: c.fgHex }} />}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label className="font-mono text-[9px] uppercase tracking-[0.06em] text-[#A09BA8] block mb-1">
                    Objetivo
                  </label>
                  <select
                    value={goal1}
                    onChange={(e) => setGoal1(e.target.value)}
                    className="clean-input font-mono text-xs font-semibold text-white"
                  >
                    {GOAL_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
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
                      value={age1}
                      onChange={(e) => setAge1(e.target.value.replace(/[^0-9]/g, ''))}
                      className="clean-input font-mono text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="font-mono text-[9px] uppercase tracking-[0.06em] text-[#A09BA8] block mb-1">
                      Peso ({weightUnit.toUpperCase()})
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder={`Ej. ${weightUnit === 'kg' ? '78' : '172'}`}
                      value={weight1}
                      onChange={(e) => setWeight1(sanitizeDecimalInput(e.target.value))}
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
                      value={height1}
                      onChange={(e) => setHeight1(e.target.value.replace(/[^0-9]/g, ''))}
                      className="clean-input font-mono text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Profile 2 Card (Only if Couple Mode is enabled) */}
              {deviceConfig.coupleModeEnabled && (
                <div className="p-3.5 rounded-[10px] bg-[#0B090E] border border-[#2A2533] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span
                      className="text-xs font-bold"
                      style={{ color: color2 }}
                    >
                      Perfil 2 {deviceConfig.primaryProfileId === 'user_2' ? '(Principal)' : ''}
                    </span>
                    {bmi2 && (
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#0B090E] text-[#C7C3D1] border border-[#2A2533]">
                        IMC: {bmi2}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-mono text-[9px] uppercase tracking-[0.06em] text-[#A09BA8] block mb-1">
                        Nombre
                      </label>
                      <input
                        type="text"
                        value={name2}
                        onChange={(e) => setName2(e.target.value)}
                        className="clean-input font-mono text-xs font-bold text-white"
                      />
                    </div>
                    <div>
                      <label className="font-mono text-[9px] uppercase tracking-[0.06em] text-[#A09BA8] block mb-1">
                        Género
                      </label>
                      <select
                        value={gender2}
                        onChange={(e) => setGender2(e.target.value as GenderType)}
                        className="clean-input font-mono text-xs font-bold text-white"
                      >
                        <option value="female">♀ Mujer</option>
                        <option value="male">♂ Hombre</option>
                        <option value="other">⚡ Otro</option>
                      </select>
                    </div>
                  </div>

                  {/* V1.6-10: Selector de 8 colores para Perfil 2 */}
                  <div>
                    <label className="font-mono text-[9px] uppercase tracking-[0.06em] text-[#A09BA8] block mb-1">
                      Color Kineo Ascent
                    </label>
                    <div className="grid grid-cols-8 gap-1.5 bg-[#14111A] p-1.5 rounded-lg border border-[#2A2533]">
                      {ASCENT_COLOR_PALETTE.map((c) => {
                        const selected = color2.toUpperCase() === c.hex.toUpperCase()
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setColor2(c.hex)}
                            title={c.name}
                            className={`h-7 rounded-md border flex items-center justify-center transition-all ${
                              selected ? 'border-white scale-105' : 'border-transparent opacity-75 hover:opacity-100'
                            }`}
                            style={{ backgroundColor: c.hex }}
                          >
                            {selected && <Check className="w-3.5 h-3.5 stroke-[3]" style={{ color: c.fgHex }} />}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="font-mono text-[9px] uppercase tracking-[0.06em] text-[#A09BA8] block mb-1">
                      Objetivo
                    </label>
                    <select
                      value={goal2}
                      onChange={(e) => setGoal2(e.target.value)}
                      className="clean-input font-mono text-xs font-semibold text-white"
                    >
                      {GOAL_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="font-mono text-[9px] uppercase tracking-[0.06em] text-[#A09BA8] block mb-1">
                        Edad
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Ej. 29"
                        value={age2}
                        onChange={(e) => setAge2(e.target.value.replace(/[^0-9]/g, ''))}
                        className="clean-input font-mono text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="font-mono text-[9px] uppercase tracking-[0.06em] text-[#A09BA8] block mb-1">
                        Peso ({weightUnit.toUpperCase()})
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder={`Ej. ${weightUnit === 'kg' ? '60' : '132'}`}
                        value={weight2}
                        onChange={(e) => setWeight2(sanitizeDecimalInput(e.target.value))}
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
                        placeholder="Ej. 165"
                        value={height2}
                        onChange={(e) => setHeight2(e.target.value.replace(/[^0-9]/g, ''))}
                        className="clean-input font-mono text-xs text-white"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSaveProfiles}
                className="solar-btn theme-bg px-4 py-2 rounded-md text-sm flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                Guardar Perfiles
              </button>
              {savedProfilesMsg && (
                <span className="font-mono text-[10px] uppercase text-[#10B981] font-semibold">
                  ✓ Guardado
                </span>
              )}
            </div>
          </div>

          {onDeleteCompanionData && (
            <section data-od-id="companion-data-removal" className="rounded-[10px] bg-[#14111A] border border-[#2A2533] p-4 space-y-3">
              <h2 className="font-display text-xl text-white">Datos del compañero en este móvil</h2>
              <p className="text-sm text-[#A09BA8] break-words">Tu perfil principal es {profiles[deviceConfig.primaryProfileId].name}. Se eliminarán únicamente los datos guardados de {companionName}: información personal, calibraciones, historial, series y cola local. Se desactivará el modo en pareja y se limpiará el código de sala guardado.</p>
              <p className="text-sm text-[#A09BA8]">Tus resultados se conservan. Este borrado no modifica otros teléfonos ni copias ya exportadas. Puedes descargar una copia antes de continuar.</p>
              <BackupButton />
              {!confirmRemoval ? (
                <button ref={removalButton} type="button" data-od-id="delete-companion-data" onClick={() => setConfirmRemoval(true)} className="min-h-[44px] px-4 py-2 rounded-md border border-[#A09BA8] text-white hover:bg-[#2A2533]">Eliminar datos de mi compañero</button>
              ) : (
                <div role="group" aria-labelledby="companion-removal-title" className="space-y-3">
                  <h3 id="companion-removal-title" className="text-white">Confirma el borrado local de {companionName}</h3>
                  <label className="block text-sm text-[#A09BA8]" htmlFor="companion-removal-name">Escribe el nombre exacto del compañero: {companionName}</label>
                  <input ref={confirmationInput} id="companion-removal-name" data-od-id="companion-removal-name" value={removalName} onChange={(event) => setRemovalName(event.target.value)} autoComplete="off" className="w-full min-h-[44px] bg-[#0B090E] border border-[#A09BA8] rounded-md px-3 text-white" />
                  <div className="flex flex-wrap gap-3">
                    <button type="button" data-od-id="confirm-companion-removal" disabled={removalName !== companionName} onClick={() => { if (removalName === companionName) onDeleteCompanionData() }} className="min-h-[44px] px-4 py-2 rounded-md border border-[#A09BA8] text-white disabled:opacity-40">Confirmar borrado</button>
                    <button type="button" onClick={() => { setConfirmRemoval(false); setRemovalName(''); setTimeout(() => removalButton.current?.focus(), 0) }} className="min-h-[44px] px-4 py-2 text-white">Cancelar</button>
                  </div>
                </div>
              )}
              <p role="status" aria-live="polite" tabIndex={-1} ref={removalStatus} className="text-sm text-[#A09BA8]">{profileRemovalMessage}</p>
            </section>
          )}

          {/* Mesocycle Control (6-8 Weeks) */}
          <div className="rounded-[10px] bg-[#14111A] border border-[#2A2533] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 theme-text" />
                <h2 className="text-sm font-bold text-white">Semana del Mesociclo</h2>
              </div>
              <span className="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded theme-soft-bg theme-text border theme-border">
                Semana {mesocycle.currentWeek}/{mesocycle.durationWeeks}
              </span>
            </div>

            <div className="grid grid-cols-6 gap-2">
              {[1, 2, 3, 4, 5, 6].map((wk) => (
                <button
                  key={wk}
                  type="button"
                  onClick={() => onUpdateMesocycle({ ...mesocycle, currentWeek: wk })}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                    mesocycle.currentWeek === wk
                      ? 'theme-bg theme-border'
                      : 'bg-[#0B090E] text-[#A09BA8] border-[#2A2533]'
                  }`}
                >
                  Sem {wk}
                </button>
              ))}
            </div>

            {mesocycle.currentWeek >= 6 && (
              <div className="p-3 rounded-[10px] bg-[#14111A] border theme-border text-xs text-[#E2DFEA] flex items-start gap-2">
                <Sparkles className="w-4 h-4 theme-text shrink-0 mt-0.5" />
                <p>¡Semana 6 alcanzada! Ideal para semana de descarga o renovar mesociclo.</p>
              </div>
            )}

            <div className="pt-2 border-t border-[#2A2533] flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase text-[#A09BA8]">
                Restaurar ejercicios base:
              </span>
              <button
                type="button"
                onClick={() => {
                  onUpdateMesocycle(INITIAL_MESOCYCLE)
                  onResetMesocycle()
                }}
                className="px-3 py-1.5 rounded-md bg-[#0B090E] hover:bg-[#1C1826] font-mono text-[10px] font-bold uppercase text-[#C7C3D1] border border-[#2A2533] flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Restaurar Plantilla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: IDEAL WEIGHT CALCULATOR */}
      {subTab === 'ideal_weight' && (
        <IdealWeightCalculator
          mesocycle={mesocycle}
          profiles={profiles}
          selectedProfileId={activeProfileId || deviceConfig.primaryProfileId}
          onSelectProfile={onSelectActiveProfile}
          coupleModeEnabled={deviceConfig.coupleModeEnabled}
          weightUnit={weightUnit}
          preselectedVariant={calculatorPreselect}
          onSaveIdealWeight={onSaveIdealWeight}
        />
      )}

      {/* SUB-TAB 3: GYM GUIDE & CARDIO */}
      {subTab === 'guide' && (
        <FitnessGuide highlightedTopicId={highlightedGlossaryId} />
      )}
    </div>
  )
}
