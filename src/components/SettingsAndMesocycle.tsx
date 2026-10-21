import React, { useState } from 'react'
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
import { INITIAL_MESOCYCLE, GOAL_OPTIONS } from '../data/initialData'
import {
  calculateBMI,
  displayWeightValue,
  parseInputToKg
} from '../utils/fitnessMath'
import { generateCoupleRoomCode, normalizeRoomCode } from '../services/syncService'
import { IdealWeightCalculator } from './IdealWeightCalculator'
import { FitnessGuide } from './FitnessGuide'

export type SettingsSubTab = 'profiles' | 'ideal_weight' | 'guide'

interface SettingsHubProps {
  profiles: Record<'user_1' | 'user_2', UserProfile>
  deviceConfig: DeviceConfig
  mesocycle: MesocyclePlan
  weightUnit: WeightUnit
  syncStatus?: 'disconnected' | 'connecting' | 'connected'
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
}

export const SettingsAndMesocycle: React.FC<SettingsHubProps> = ({
  profiles,
  deviceConfig,
  mesocycle,
  weightUnit,
  syncStatus = 'disconnected',
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
  onReopenOnboarding
}) => {
  const [subTab, setSubTab] = useState<SettingsSubTab>(initialSubTab)

  const [roomCodeInput, setRoomCodeInput] = useState<string>(deviceConfig.syncRoomCode || '')
  const [roomSavedMsg, setRoomSavedMsg] = useState<boolean>(false)

  const [name1, setName1] = useState(profiles.user_1.name)
  const [gender1, setGender1] = useState<GenderType>(profiles.user_1.gender)
  const [goal1, setGoal1] = useState(
    GOAL_OPTIONS.includes(profiles.user_1.goal) ? profiles.user_1.goal : GOAL_OPTIONS[0]
  )
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
        accentColor: gender1 === 'female' ? '#EC4899' : '#10B981'
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
        accentColor: gender2 === 'female' ? '#EC4899' : '#10B981'
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

  const handleSaveRoomCode = (codeToSave: string) => {
    const cleaned = normalizeRoomCode(codeToSave)
    setRoomCodeInput(cleaned)
    onUpdateDeviceConfig({
      ...deviceConfig,
      coupleModeEnabled: true,
      syncRoomCode: cleaned || undefined
    })
    setRoomSavedMsg(true)
    setTimeout(() => setRoomSavedMsg(false), 3000)
  }

  const bmi1 = calculateBMI(profiles.user_1.bodyWeightKg, profiles.user_1.heightCm)
  const bmi2 = calculateBMI(profiles.user_2.bodyWeightKg, profiles.user_2.heightCm)

  return (
    <div className="space-y-4 pb-24">
      {/* Segmented Sub-navigation inside Ajustes */}
      <div className="grid grid-cols-3 gap-2 bg-slate-900/95 border border-slate-800 p-1.5 rounded-2xl">
        <button
          onClick={() => setSubTab('profiles')}
          className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
            subTab === 'profiles'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          Modo y Pareja
        </button>

        <button
          onClick={() => setSubTab('ideal_weight')}
          className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
            subTab === 'ideal_weight'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <Target className="w-4 h-4" />
          Peso Ideal
        </button>

        <button
          onClick={() => setSubTab('guide')}
          className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
            subTab === 'guide'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Guía
        </button>
      </div>

      {/* SUB-TAB 1: MODE (SOLO VS COUPLE), LIVE SYNC & PROFILES */}
      {subTab === 'profiles' && (
        <div className="space-y-4">
          {hasSampleData && (
            <div className="rounded-2xl bg-amber-950/25 border border-amber-500/40 p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-amber-300">
                  📊 Datos de Ejemplo Activos
                </h3>
              </div>
              <button
                onClick={onClearSampleHistory}
                className="px-3.5 py-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs font-bold flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Borrar Datos de Ejemplo
              </button>
            </div>
          )}

          {/* MODE SELECTOR: INDIVIDUAL vs COUPLE */}
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 space-y-3">
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
                    ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-2 font-extrabold text-xs sm:text-sm">
                  <User className="w-4 h-4 text-emerald-400" />
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
                    coupleModeEnabled: true,
                    syncRoomCode: deviceConfig.syncRoomCode || generateCoupleRoomCode()
                  })
                }
                className={`p-3 rounded-xl border text-left transition-all ${
                  deviceConfig.coupleModeEnabled
                    ? 'bg-pink-500/20 border-pink-400 text-white shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-2 font-extrabold text-xs sm:text-sm">
                  <Users className="w-4 h-4 text-pink-400" />
                  En Pareja (Sync)
                </div>
                <p className="text-[11px] opacity-80 mt-0.5">
                  Alterna entre ambos y sincroniza 2 teléfonos en vivo.
                </p>
              </button>
            </div>
          </div>

          {/* LIVE SYNC ROOM CARD (Only visible when coupleModeEnabled) */}
          {deviceConfig.coupleModeEnabled && (
            <div className="rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/40 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Wifi className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h2 className="text-sm font-bold text-white">
                      Sesión Compartida en Vivo (2 Teléfonos)
                    </h2>
                    <p className="text-[11px] text-slate-300">
                      Escriban el mismo código en ambos teléfonos para actualizar pesos y series en
                      tiempo real.
                    </p>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                    syncStatus === 'connected'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : syncStatus === 'connecting'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {syncStatus === 'connected'
                    ? '🟢 Conectado en Vivo'
                    : syncStatus === 'connecting'
                    ? '🟡 Conectando...'
                    : '⚪ Sin Sala Activa'}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                  placeholder="Ej. KINEO-4829"
                  className="flex-1 bg-slate-950 border border-indigo-500/50 rounded-xl px-3.5 py-2 text-sm font-black tracking-widest text-emerald-300 uppercase outline-none"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveRoomCode(roomCodeInput)}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs"
                  >
                    Conectar Sala
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const newCode = generateCoupleRoomCode()
                      handleSaveRoomCode(newCode)
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700"
                  >
                    Crear Nuevo Código
                  </button>
                </div>
              </div>

              {roomSavedMsg && (
                <p className="text-xs text-emerald-300 font-semibold">
                  ✓ Sala sincronizada: comparte el código <strong>{roomCodeInput}</strong> con tu
                  pareja.
                </p>
              )}
            </div>
          )}

          {/* Device Primary Owner Switcher */}
          {deviceConfig.coupleModeEnabled && (
            <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Smartphone className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-sm font-bold text-white">
                    Dueño de este Teléfono:{' '}
                    <span style={{ color: profiles[deviceConfig.primaryProfileId].accentColor }}>
                      {profiles[deviceConfig.primaryProfileId].name}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    En el celular de tu pareja, ponla a ella como principal.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSwapDeviceOwner}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-emerald-300 border border-slate-700 flex items-center gap-1.5"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  Cambiar Titular
                </button>
                <button
                  onClick={onReopenOnboarding}
                  className="px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-xs font-semibold text-slate-300 border border-slate-800"
                >
                  Asistente
                </button>
              </div>
            </div>
          )}

          {/* Profiles Customization */}
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              <h2 className="text-sm font-bold text-white">Datos de Perfiles</h2>
            </div>

            <div
              className={`grid gap-4 ${
                deviceConfig.coupleModeEnabled ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
              }`}
            >
              {/* Profile 1 Card */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span
                    className="text-xs font-bold"
                    style={{ color: profiles.user_1.accentColor }}
                  >
                    Perfil 1 {deviceConfig.primaryProfileId === 'user_1' ? '(Principal)' : ''}
                  </span>
                  {bmi1 && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-900 text-slate-300 border border-slate-800">
                      IMC: {bmi1}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Nombre</label>
                    <input
                      type="text"
                      value={name1}
                      onChange={(e) => setName1(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Género</label>
                    <select
                      value={gender1}
                      onChange={(e) => setGender1(e.target.value as GenderType)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white"
                    >
                      <option value="male">♂ Hombre</option>
                      <option value="female">♀ Mujer</option>
                      <option value="other">⚡ Otro</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Objetivo</label>
                  <select
                    value={goal1}
                    onChange={(e) => setGoal1(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white"
                  >
                    {GOAL_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Edad"
                    value={age1}
                    onChange={(e) => setAge1(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder={`Peso (${weightUnit})`}
                    value={weight1}
                    onChange={(e) => setWeight1(e.target.value.replace(/[^0-9.]/g, ''))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Altura (cm)"
                    value={height1}
                    onChange={(e) => setHeight1(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                  />
                </div>
              </div>

              {/* Profile 2 Card (Only if Couple Mode is enabled) */}
              {deviceConfig.coupleModeEnabled && (
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span
                      className="text-xs font-bold"
                      style={{ color: profiles.user_2.accentColor }}
                    >
                      Perfil 2 {deviceConfig.primaryProfileId === 'user_2' ? '(Principal)' : ''}
                    </span>
                    {bmi2 && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-900 text-slate-300 border border-slate-800">
                        IMC: {bmi2}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Nombre</label>
                      <input
                        type="text"
                        value={name2}
                        onChange={(e) => setName2(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Género</label>
                      <select
                        value={gender2}
                        onChange={(e) => setGender2(e.target.value as GenderType)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white"
                      >
                        <option value="female">♀ Mujer</option>
                        <option value="male">♂ Hombre</option>
                        <option value="other">⚡ Otro</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Objetivo</label>
                    <select
                      value={goal2}
                      onChange={(e) => setGoal2(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white"
                    >
                      {GOAL_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Edad"
                      value={age2}
                      onChange={(e) => setAge2(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder={`Peso (${weightUnit})`}
                      value={weight2}
                      onChange={(e) => setWeight2(e.target.value.replace(/[^0-9.]/g, ''))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Altura (cm)"
                      value={height2}
                      onChange={(e) => setHeight2(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveProfiles}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                Guardar Perfiles
              </button>
              {savedProfilesMsg && (
                <span className="text-xs text-emerald-300 font-semibold">
                  ✓ Guardado
                </span>
              )}
            </div>
          </div>

          {/* Mesocycle Control (6-8 Weeks) */}
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold text-white">Semana del Mesociclo</h2>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                Semana {mesocycle.currentWeek}/{mesocycle.durationWeeks}
              </span>
            </div>

            <div className="grid grid-cols-6 gap-2">
              {[1, 2, 3, 4, 5, 6].map((wk) => (
                <button
                  key={wk}
                  onClick={() => onUpdateMesocycle({ ...mesocycle, currentWeek: wk })}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                    mesocycle.currentWeek === wk
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  Sem {wk}
                </button>
              ))}
            </div>

            {mesocycle.currentWeek >= 6 && (
              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 text-xs text-amber-200 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p>¡Semana 6 alcanzada! Ideal para semana de descarga o renovar mesociclo.</p>
              </div>
            )}

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">Restaurar ejercicios base:</span>
              <button
                onClick={() => {
                  onUpdateMesocycle(INITIAL_MESOCYCLE)
                  onResetMesocycle()
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700 flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Restaurar Plantilla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: IDEAL WEIGHT CALCULATOR (Without ExerciseAnimationViewer) */}
      {subTab === 'ideal_weight' && (
        <IdealWeightCalculator
          mesocycle={mesocycle}
          profiles={profiles}
          selectedProfileId={deviceConfig.primaryProfileId}
          coupleModeEnabled={deviceConfig.coupleModeEnabled}
          weightUnit={weightUnit}
          preselectedVariant={calculatorPreselect}
          onSaveIdealWeight={onSaveIdealWeight}
        />
      )}

      {/* SUB-TAB 3: GYM GUIDE */}
      {subTab === 'guide' && (
        <FitnessGuide highlightedTopicId={highlightedGlossaryId} />
      )}
    </div>
  )
}
