import React, { useState, useEffect, useCallback } from 'react'
import {
  Dumbbell,
  BarChart3,
  Settings,
  Users,
  User,
  Scale,
  CheckCircle2,
  Calendar,
  Sparkles,
  ArrowRight,
  Flame,
  Play,
  Moon,
  Clock,
  Unlock
} from 'lucide-react'
import {
  CompletedExerciseRecord,
  DeviceConfig,
  ExerciseSlot,
  ExerciseVariant,
  MesocyclePlan,
  SetEntry,
  SetTechnique,
  SyncMode,
  UserProfile,
  WeightUnit,
  WorkoutHistoryEntry
} from './types'
import {
  loadDeviceConfig,
  saveDeviceConfig,
  loadProfiles,
  saveProfiles,
  loadMesocycle,
  saveMesocycle,
  loadHistory,
  saveHistory,
  loadWeightUnit,
  saveWeightUnit,
  loadActiveSessionId,
  saveActiveSessionId
} from './services/storageService'
import {
  buildPyramidSets,
  generateDropSubSets,
  getIdealWeightZones,
  formatDualWeight,
  calculateProfileStreak,
  calculateSafe1RM
} from './utils/fitnessMath'
import { OnboardingWizard } from './components/OnboardingWizard'
import { ExerciseSlotCard } from './components/ExerciseSlotCard'
import { RestTimerBar } from './components/RestTimerBar'
import { ProgressDashboard } from './components/ProgressDashboard'
import { SettingsAndMesocycle, SettingsSubTab } from './components/SettingsAndMesocycle'
import { StreakBanner } from './components/StreakBanner'

// Strictly 3 Bottom Tabs: 'workout' | 'progress' | 'settings'
type ActiveTab = 'workout' | 'progress' | 'settings'

type SessionSlotsState = Record<
  string,
  {
    syncMode: SyncMode
    techniqueByProfile: Record<'user_1' | 'user_2', SetTechnique>
    setsByProfile: Record<'user_1' | 'user_2', SetEntry[]>
  }
>

function buildInitialSetsForSlot(
  slot: ExerciseSlot,
  profile: UserProfile,
  syncMode: SyncMode,
  technique: SetTechnique
): SetEntry[] {
  const variant =
    syncMode === 'individual' && profile.gender === 'female' && slot.femaleFocusedPrimary
      ? slot.femaleFocusedPrimary
      : slot.primaryExercise
  const savedVarId = profile.activeVariantBySlot[slot.slotId] || variant.id
  const oneRmKg = profile.estimated1RMByVariant[savedVarId] || 0
  const zones = getIdealWeightZones(oneRmKg)

  const baseSets: SetEntry[] = Array.from({ length: slot.defaultSetsCount }, (_, i) => ({
    setNumber: i + 1,
    targetReps: slot.defaultTargetReps,
    weightKg: zones.hypertrophyKg,
    actualReps: 10,
    rir: i === slot.defaultSetsCount - 1 ? 1 : 2,
    isFailure: technique === 'failure' && i === slot.defaultSetsCount - 1,
    completed: false,
    drops:
      technique === 'dropset' && i === slot.defaultSetsCount - 1
        ? generateDropSubSets(zones.hypertrophyKg)
        : undefined
  }))

  if (technique === 'pyramid_asc' || technique === 'pyramid_desc') {
    return buildPyramidSets(technique, oneRmKg, baseSets)
  }

  return baseSets
}

export function App() {
  const [deviceConfig, setDeviceConfig] = useState<DeviceConfig>(() => loadDeviceConfig())
  const [activeTab, setActiveTab] = useState<ActiveTab>('workout')
  const [settingsSubTab, setSettingsSubTab] = useState<SettingsSubTab>('profiles')

  // Controls whether the user is in the Pre-Workout Lobby (Streak + Start button) or Active Session
  const [isWorkoutStarted, setIsWorkoutStarted] = useState<boolean>(false)

  const [profiles, setProfiles] = useState<Record<'user_1' | 'user_2', UserProfile>>(() =>
    loadProfiles()
  )
  const [mesocycle, setMesocycle] = useState<MesocyclePlan>(() => loadMesocycle())
  const [history, setHistory] = useState<WorkoutHistoryEntry[]>(() => loadHistory())
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(() => loadWeightUnit())
  const [activeSessionId, setActiveSessionId] = useState<string>(() => loadActiveSessionId())

  const [coupleViewMode, setCoupleViewMode] = useState<'both' | 'single'>(
    deviceConfig.coupleModeEnabled ? 'both' : 'single'
  )
  const [activeProfileId, setActiveProfileId] = useState<'user_1' | 'user_2'>(
    deviceConfig.primaryProfileId
  )

  const [restSecondsLeft, setRestSecondsLeft] = useState<number>(0)
  const [restTotalSeconds, setRestTotalSeconds] = useState<number>(0)
  const [restIsRunning, setRestIsRunning] = useState<boolean>(false)
  const [restLabel, setRestLabel] = useState<string>('')

  const [calculatorPreselect, setCalculatorPreselect] = useState<{
    profileId: 'user_1' | 'user_2'
    variant: ExerciseVariant
    slotId: string
  } | null>(null)

  const [highlightedGlossaryId, setHighlightedGlossaryId] = useState<string | null>(null)
  const [finishBanner, setFinishBanner] = useState<string | null>(null)

  const currentSession =
    mesocycle.sessions.find((s) => s.id === activeSessionId) || mesocycle.sessions[0]

  const buildSessionState = useCallback(
    (
      sessionSlots: ExerciseSlot[],
      profMap: Record<'user_1' | 'user_2', UserProfile>
    ): SessionSlotsState => {
      const next: SessionSlotsState = {}
      sessionSlots.forEach((slot) => {
        next[slot.slotId] = {
          syncMode: slot.syncMode,
          techniqueByProfile: {
            user_1: slot.defaultTechnique,
            user_2: slot.defaultTechnique
          },
          setsByProfile: {
            user_1: buildInitialSetsForSlot(
              slot,
              profMap.user_1,
              slot.syncMode,
              slot.defaultTechnique
            ),
            user_2: buildInitialSetsForSlot(
              slot,
              profMap.user_2,
              slot.syncMode,
              slot.defaultTechnique
            )
          }
        }
      })
      return next
    },
    []
  )

  const [slotsState, setSlotsState] = useState<SessionSlotsState>(() =>
    buildSessionState(currentSession.slots, profiles)
  )

  useEffect(() => {
    setSlotsState(buildSessionState(currentSession.slots, profiles))
  }, [activeSessionId, currentSession.slots, buildSessionState])

  useEffect(() => {
    saveDeviceConfig(deviceConfig)
  }, [deviceConfig])

  useEffect(() => {
    saveProfiles(profiles)
  }, [profiles])

  useEffect(() => {
    saveMesocycle(mesocycle)
  }, [mesocycle])

  useEffect(() => {
    saveHistory(history)
  }, [history])

  useEffect(() => {
    saveWeightUnit(weightUnit)
  }, [weightUnit])

  useEffect(() => {
    saveActiveSessionId(activeSessionId)
  }, [activeSessionId])

  useEffect(() => {
    if (!restIsRunning || restSecondsLeft <= 0) return
    const timer = setInterval(() => {
      setRestSecondsLeft((prev) => {
        if (prev <= 1) {
          setRestIsRunning(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [restIsRunning, restSecondsLeft])

  const startRestTimer = (seconds: number, label: string) => {
    setRestTotalSeconds(seconds)
    setRestSecondsLeft(seconds)
    setRestLabel(label)
    setRestIsRunning(true)
  }

  const handleToggleSyncMode = (slotId: string) => {
    const slot = currentSession.slots.find((s) => s.slotId === slotId)
    if (!slot) return
    setSlotsState((prev) => {
      const current = prev[slotId]
      if (!current) return prev
      const nextSync: SyncMode = current.syncMode === 'shared' ? 'individual' : 'shared'
      return {
        ...prev,
        [slotId]: {
          ...current,
          syncMode: nextSync,
          setsByProfile: {
            user_1: buildInitialSetsForSlot(
              slot,
              profiles.user_1,
              nextSync,
              current.techniqueByProfile.user_1
            ),
            user_2: buildInitialSetsForSlot(
              slot,
              profiles.user_2,
              nextSync,
              current.techniqueByProfile.user_2
            )
          }
        }
      }
    })
  }

  const handleSelectVariant = (
    profileId: 'user_1' | 'user_2',
    slotId: string,
    variantId: string,
    applyToBoth: boolean
  ) => {
    const updatedProfiles = { ...profiles }
    if (applyToBoth) {
      updatedProfiles.user_1 = {
        ...updatedProfiles.user_1,
        activeVariantBySlot: {
          ...updatedProfiles.user_1.activeVariantBySlot,
          [slotId]: variantId
        }
      }
      updatedProfiles.user_2 = {
        ...updatedProfiles.user_2,
        activeVariantBySlot: {
          ...updatedProfiles.user_2.activeVariantBySlot,
          [slotId]: variantId
        }
      }
    } else {
      updatedProfiles[profileId] = {
        ...updatedProfiles[profileId],
        activeVariantBySlot: {
          ...updatedProfiles[profileId].activeVariantBySlot,
          [slotId]: variantId
        }
      }
    }
    setProfiles(updatedProfiles)
  }

  const handleChangeTechnique = (
    profileId: 'user_1' | 'user_2',
    slotId: string,
    technique: SetTechnique
  ) => {
    const slot = currentSession.slots.find((s) => s.slotId === slotId)
    if (!slot) return
    setSlotsState((prev) => {
      const current = prev[slotId]
      if (!current) return prev
      const currentSets = current.setsByProfile[profileId]
      const savedVarId =
        profiles[profileId].activeVariantBySlot[slotId] || slot.primaryExercise.id
      const oneRmKg = profiles[profileId].estimated1RMByVariant[savedVarId] || 0

      let updatedSets = [...currentSets]
      if (technique === 'pyramid_asc' || technique === 'pyramid_desc') {
        updatedSets = buildPyramidSets(technique, oneRmKg, currentSets)
      } else if (technique === 'dropset') {
        updatedSets = currentSets.map((s, idx) =>
          idx === currentSets.length - 1
            ? {
                ...s,
                drops: s.drops?.length ? s.drops : generateDropSubSets(s.weightKg)
              }
            : s
        )
      } else if (technique === 'failure') {
        updatedSets = currentSets.map((s, idx) => ({
          ...s,
          isFailure: idx === currentSets.length - 1
        }))
      }

      return {
        ...prev,
        [slotId]: {
          ...current,
          techniqueByProfile: {
            ...current.techniqueByProfile,
            [profileId]: technique
          },
          setsByProfile: {
            ...current.setsByProfile,
            [profileId]: updatedSets
          }
        }
      }
    })
  }

  const handleUpdateSet = (
    profileId: 'user_1' | 'user_2',
    slotId: string,
    setIndex: number,
    updated: Partial<SetEntry>,
    triggerRestSeconds?: number,
    exerciseLabel?: string
  ) => {
    setSlotsState((prev) => {
      const current = prev[slotId]
      if (!current) return prev
      const nextSets = [...current.setsByProfile[profileId]]
      nextSets[setIndex] = { ...nextSets[setIndex], ...updated }
      return {
        ...prev,
        [slotId]: {
          ...current,
          setsByProfile: {
            ...current.setsByProfile,
            [profileId]: nextSets
          }
        }
      }
    })

    if (triggerRestSeconds && triggerRestSeconds > 0) {
      startRestTimer(triggerRestSeconds, exerciseLabel || 'Descanso entre series')
    }
  }

  const handleAddSet = (profileId: 'user_1' | 'user_2', slotId: string) => {
    setSlotsState((prev) => {
      const current = prev[slotId]
      if (!current) return prev
      const currentSets = current.setsByProfile[profileId]
      const last = currentSets[currentSets.length - 1]
      const newSet: SetEntry = {
        setNumber: currentSets.length + 1,
        targetReps: last?.targetReps || '10',
        weightKg: last?.weightKg || 0,
        actualReps: last?.actualReps || 10,
        rir: 1,
        isFailure: false,
        completed: false
      }
      return {
        ...prev,
        [slotId]: {
          ...current,
          setsByProfile: {
            ...current.setsByProfile,
            [profileId]: [...currentSets, newSet]
          }
        }
      }
    })
  }

  const handleSaveIdealWeight = (
    profileId: 'user_1' | 'user_2',
    variantId: string,
    oneRmKg: number,
    slotId?: string
  ) => {
    const nextProfiles = {
      ...profiles,
      [profileId]: {
        ...profiles[profileId],
        estimated1RMByVariant: {
          ...profiles[profileId].estimated1RMByVariant,
          [variantId]: oneRmKg
        }
      }
    }
    setProfiles(nextProfiles)

    if (slotId && slotsState[slotId]) {
      const zones = getIdealWeightZones(oneRmKg)
      setSlotsState((prev) => {
        const current = prev[slotId]
        if (!current) return prev
        const tech = current.techniqueByProfile[profileId]
        const currentSets = current.setsByProfile[profileId]
        const nextSets =
          tech === 'pyramid_asc' || tech === 'pyramid_desc'
            ? buildPyramidSets(tech, oneRmKg, currentSets)
            : currentSets.map((s) => ({ ...s, weightKg: zones.hypertrophyKg }))
        return {
          ...prev,
          [slotId]: {
            ...current,
            setsByProfile: {
              ...current.setsByProfile,
              [profileId]: nextSets
            }
          }
        }
      })
    }
  }

  const todayIso = new Date().toISOString().slice(0, 10)
  const isCompletedToday = deviceConfig.lastCompletedWorkoutDate === todayIso

  const handleFinishWorkoutSession = () => {
    const newEntries: WorkoutHistoryEntry[] = []

    ;(['user_1', 'user_2'] as const).forEach((pid) => {
      let totalVolKg = 0
      let completedCount = 0
      const completedExercises: CompletedExerciseRecord[] = []

      currentSession.slots.forEach((slot) => {
        const st = slotsState[slot.slotId]
        if (!st) return
        const prof = profiles[pid]
        const options =
          st.syncMode === 'individual' && prof.gender === 'female' && slot.femaleFocusedPrimary
            ? [
                slot.femaleFocusedPrimary,
                ...(slot.femaleFocusedAlternatives || slot.alternatives)
              ]
            : [slot.primaryExercise, ...slot.alternatives]
        const savedId = prof.activeVariantBySlot[slot.slotId]
        const activeVar = options.find((o) => o.id === savedId) || options[0]

        let exVolume = 0
        let exMaxWeight = 0
        let exBestReps = 0
        const doneSets: SetEntry[] = []

        st.setsByProfile[pid].forEach((s) => {
          if (s.completed) {
            completedCount += 1
            const vol = s.weightKg * s.actualReps
            totalVolKg += vol
            exVolume += vol
            if (s.weightKg >= exMaxWeight) {
              exMaxWeight = s.weightKg
              exBestReps = s.actualReps
            }
            ;(s.drops || []).forEach((d) => {
              if (d.completed) {
                totalVolKg += d.weightKg * d.reps
                exVolume += d.weightKg * d.reps
              }
            })
            doneSets.push(s)
          }
        })

        if (doneSets.length > 0) {
          completedExercises.push({
            slotId: slot.slotId,
            variantId: activeVar.id,
            variantName: activeVar.name,
            muscleGroup: activeVar.muscleGroup,
            equipment: activeVar.equipment,
            technique: st.techniqueByProfile[pid],
            maxWeightKg: exMaxWeight,
            estimated1RmKg: calculateSafe1RM(exMaxWeight, exBestReps || 8, 1),
            totalVolumeKg: Math.round(exVolume),
            bestSetReps: exBestReps,
            sets: doneSets
          })
        }
      })

      if (completedCount > 0) {
        newEntries.push({
          id: `hist-${Date.now()}-${pid}`,
          date: todayIso,
          sessionId: currentSession.id,
          sessionCode: currentSession.code,
          sessionTitle: currentSession.title,
          profileId: pid,
          totalVolumeKg: Math.round(totalVolKg),
          completedSets: completedCount,
          durationMinutes: currentSession.estimatedMinutes,
          exercises: completedExercises
        })
      }
    })

    if (newEntries.length === 0) {
      setFinishBanner('Marca al menos 1 serie completada (✓) antes de finalizar la sesión.')
      setTimeout(() => setFinishBanner(null), 3500)
      return
    }

    setHistory((prev) => [...prev, ...newEntries])

    const coreOrder = ['session-a', 'session-b', 'session-c', 'session-d']
    const currentIdx = coreOrder.indexOf(currentSession.id)
    const nextSessionId =
      currentIdx >= 0 ? coreOrder[(currentIdx + 1) % coreOrder.length] : 'session-a'

    setDeviceConfig((prev) => ({
      ...prev,
      lastCompletedWorkoutDate: todayIso,
      lastCompletedSessionCode: currentSession.code
    }))
    setActiveSessionId(nextSessionId)
    setIsWorkoutStarted(false)
  }

  if (!deviceConfig.onboardingCompleted) {
    return (
      <OnboardingWizard
        initialProfiles={profiles}
        initialUnit={weightUnit}
        onComplete={(updatedProfiles, updatedConfig, chosenUnit) => {
          setProfiles(updatedProfiles)
          setDeviceConfig(updatedConfig)
          setWeightUnit(chosenUnit)
          setActiveProfileId(updatedConfig.primaryProfileId)
          setCoupleViewMode(updatedConfig.coupleModeEnabled ? 'both' : 'single')
          setSlotsState(buildSessionState(currentSession.slots, updatedProfiles))
          setIsWorkoutStarted(false)
        }}
      />
    )
  }

  const primaryPid = deviceConfig.primaryProfileId
  const secondaryPid: 'user_1' | 'user_2' = primaryPid === 'user_1' ? 'user_2' : 'user_1'

  const getLiveStats = (pid: 'user_1' | 'user_2') => {
    let completed = 0
    let total = 0
    let volumeKg = 0
    currentSession.slots.forEach((slot) => {
      const st = slotsState[slot.slotId]
      if (!st) return
      st.setsByProfile[pid].forEach((s) => {
        total += 1
        if (s.completed) {
          completed += 1
          volumeKg += s.weightKg * s.actualReps
        }
      })
    })
    return { completed, total, volumeKg }
  }

  const statsPrimary = getLiveStats(primaryPid)
  const statsSecondary = getLiveStats(secondaryPid)
  const streakPrimary = calculateProfileStreak(history, primaryPid)
  const hasSampleData = history.some((h) => h.isSampleData)

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col">
      {/* Clean Top Bar */}
      <header className="sticky top-0 z-30 bg-[#090D16]/90 backdrop-blur-md border-b border-slate-800/80 px-3 sm:px-6 py-3">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-pink-500 p-[1.5px]">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center font-black text-base tracking-tighter text-white">
                K
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-white">
                  KINEO <span className="text-emerald-400 text-xs font-bold">v1.4</span>
                </h1>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Sem {mesocycle.currentWeek}/{mesocycle.durationWeeks}
                </span>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                  <Flame className="w-3 h-3 text-amber-400 fill-amber-400" />
                  {streakPrimary.weeklySessionsDone}/3 sem
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Titular: {profiles[primaryPid].name} • Pareja: {profiles[secondaryPid].name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5">
              <button
                onClick={() => setCoupleViewMode('both')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                  coupleViewMode === 'both'
                    ? 'bg-gradient-to-r from-emerald-500/25 to-pink-500/25 text-white border border-white/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden xs:inline">Pareja</span>
              </button>
              <button
                onClick={() => {
                  setCoupleViewMode('single')
                  setActiveProfileId(primaryPid)
                }}
                className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                  coupleViewMode === 'single' && activeProfileId === primaryPid
                    ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <User className="w-3 h-3" />
                {profiles[primaryPid].name.split(' ')[0]}
              </button>
              <button
                onClick={() => {
                  setCoupleViewMode('single')
                  setActiveProfileId(secondaryPid)
                }}
                className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                  coupleViewMode === 'single' && activeProfileId === secondaryPid
                    ? 'bg-pink-500/25 text-pink-300 border border-pink-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <User className="w-3 h-3" />
                {profiles[secondaryPid].name.split(' ')[0]}
              </button>
            </div>

            <button
              onClick={() => setWeightUnit((u) => (u === 'kg' ? 'lb' : 'kg'))}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-extrabold text-amber-300 flex items-center gap-1"
            >
              <Scale className="w-3.5 h-3.5" />
              {weightUnit.toUpperCase()} ⇄
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 pt-4">
        {/* TAB 1: ENTRENAR (Segmented into 3 Clean States) */}
        {activeTab === 'workout' && (
          <div className="space-y-5 pb-28">
            {/* STATE A: COMPLETED TODAY -> WAIT UNTIL TOMORROW */}
            {isCompletedToday && !isWorkoutStarted ? (
              <div className="space-y-5">
                <StreakBanner
                  profiles={profiles}
                  primaryProfileId={primaryPid}
                  history={history}
                />

                <div className="rounded-3xl bg-gradient-to-br from-emerald-950/50 via-slate-900 to-indigo-950/40 border border-emerald-500/40 p-6 sm:p-8 text-center space-y-4 shadow-2xl">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 mx-auto">
                    <Moon className="w-8 h-8" />
                  </div>
                  <div className="space-y-1.5 max-w-lg mx-auto">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                      ¡Entrenamiento de Hoy Completado! (Sesión{' '}
                      {deviceConfig.lastCompletedSessionCode || 'Lista'})
                    </span>
                    <h2 className="text-xl sm:text-2xl font-black text-white">
                      Descanso y Recuperación Muscular hasta Mañana
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      El músculo crece y se tonifica mientras descansa. Su racha ya sumó el día de
                      hoy; mañana se activará automáticamente su siguiente sesión (
                      <strong>{currentSession.title}</strong>).
                    </p>
                  </div>

                  <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                    <button
                      onClick={() => setActiveTab('progress')}
                      className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs sm:text-sm flex items-center gap-2"
                    >
                      <BarChart3 className="w-4 h-4" />
                      Ver Estadísticas por Ejercicio
                    </button>
                    <button
                      onClick={() => setIsWorkoutStarted(true)}
                      className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      Desbloquear sesión hoy de todos modos
                    </button>
                  </div>
                </div>
              </div>
            ) : !isWorkoutStarted ? (
              /* STATE B: CLEAN LOBBY (STREAK SYSTEM + START WORKOUT SESSION CTA) */
              <div className="space-y-5">
                <StreakBanner
                  profiles={profiles}
                  primaryProfileId={primaryPid}
                  history={history}
                />

                <div className="rounded-3xl bg-slate-900/95 border border-slate-800 p-5 sm:p-7 space-y-5 shadow-xl">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        Sesión Lista para Hoy • {mesocycle.name}
                      </span>
                      <h2 className="text-lg sm:text-2xl font-black text-white mt-1">
                        {currentSession.title}
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                        {currentSession.subtitle}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                      <Clock className="w-4 h-4 text-emerald-400" />~
                      {currentSession.estimatedMinutes} min • {currentSession.slots.length}{' '}
                      ejercicios
                    </div>
                  </div>

                  {/* Session Queue Selector */}
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                      Elegir sesión de la cola flexible (3 a 5 días):
                    </label>
                    <div className="grid grid-cols-5 gap-2">
                      {mesocycle.sessions.map((sess) => {
                        const isSelected = sess.id === currentSession.id
                        return (
                          <button
                            key={sess.id}
                            onClick={() => setActiveSessionId(sess.id)}
                            className={`p-2.5 rounded-xl border text-center transition-all ${
                              isSelected
                                ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-extrabold shadow-lg shadow-emerald-500/20'
                                : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <span className="text-xs sm:text-sm font-black block">
                              Sesión {sess.code}
                            </span>
                            <span
                              className={`text-[10px] block truncate ${
                                isSelected ? 'text-slate-900 font-semibold' : 'text-slate-400'
                              }`}
                            >
                              {sess.isOptional5thDay ? 'Día 5 Opc.' : `${sess.slots.length} ejerc.`}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Preview of exercises in this session */}
                  <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/90 space-y-2">
                    <span className="text-xs font-bold text-slate-300 block">
                      Resumen de bloques en esta sesión:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {currentSession.slots.map((slot) => (
                        <div
                          key={slot.slotId}
                          className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900/70 px-3 py-2 rounded-xl border border-slate-800/80"
                        >
                          <span className="w-5 h-5 rounded bg-slate-800 text-emerald-400 font-bold text-[11px] flex items-center justify-center shrink-0">
                            {slot.order}
                          </span>
                          <span className="truncate font-medium">
                            {slot.primaryExercise.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Big Start Workout CTA */}
                  <button
                    onClick={() => setIsWorkoutStarted(true)}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-base sm:text-lg shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2.5"
                  >
                    <Play className="w-5 h-5 fill-slate-950" />
                    Comenzar Sesión de Entrenamiento ({currentSession.code})
                  </button>
                </div>
              </div>
            ) : (
              /* STATE C: ACTIVE WORKOUT SESSION (EXERCISES VIEW) */
              <div className="space-y-4">
                <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                        Sesión Activa en Curso
                      </span>
                      <h2 className="text-base sm:text-lg font-extrabold text-white">
                        {currentSession.title}
                      </h2>
                    </div>
                    <button
                      onClick={() => setIsWorkoutStarted(false)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700"
                    >
                      ← Volver a Portada de Racha
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="px-3 py-2 rounded-xl bg-slate-950/80 border border-emerald-500/25 flex items-center justify-between text-xs">
                      <span
                        className="font-bold"
                        style={{ color: profiles[primaryPid].accentColor }}
                      >
                        ★ {profiles[primaryPid].name}:
                      </span>
                      <span className="text-slate-300">
                        <strong>
                          {statsPrimary.completed}/{statsPrimary.total}
                        </strong>{' '}
                        series • {formatDualWeight(statsPrimary.volumeKg, weightUnit)}
                      </span>
                    </div>
                    <div className="px-3 py-2 rounded-xl bg-slate-950/80 border border-pink-500/25 flex items-center justify-between text-xs">
                      <span
                        className="font-bold"
                        style={{ color: profiles[secondaryPid].accentColor }}
                      >
                        {profiles[secondaryPid].name}:
                      </span>
                      <span className="text-slate-300">
                        <strong>
                          {statsSecondary.completed}/{statsSecondary.total}
                        </strong>{' '}
                        series • {formatDualWeight(statsSecondary.volumeKg, weightUnit)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {currentSession.slots.map((slot) => {
                    const st = slotsState[slot.slotId]
                    if (!st) return null
                    return (
                      <ExerciseSlotCard
                        key={slot.slotId}
                        slot={slot}
                        profiles={profiles}
                        primaryProfileId={primaryPid}
                        activeProfileId={activeProfileId}
                        coupleViewMode={coupleViewMode}
                        weightUnit={weightUnit}
                        history={history}
                        syncMode={st.syncMode}
                        techniqueByProfile={st.techniqueByProfile}
                        setsByProfile={st.setsByProfile}
                        onToggleSyncMode={handleToggleSyncMode}
                        onSelectVariant={handleSelectVariant}
                        onChangeTechnique={handleChangeTechnique}
                        onUpdateSet={handleUpdateSet}
                        onAddSet={handleAddSet}
                        onSaveQuickStrengthTest={handleSaveIdealWeight}
                        onOpenCalculatorForVariant={(pid, variant, sId) => {
                          setCalculatorPreselect({ profileId: pid, variant, slotId: sId })
                          setSettingsSubTab('ideal_weight')
                          setActiveTab('settings')
                        }}
                        onOpenGlossaryTopic={(topicId) => {
                          setHighlightedGlossaryId(topicId)
                          setSettingsSubTab('guide')
                          setActiveTab('settings')
                        }}
                      />
                    )
                  })}
                </div>

                <div className="rounded-2xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-pink-950/60 border border-emerald-500/30 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      ¿Terminaron la sesión de hoy?
                    </h3>
                    <p className="text-xs text-slate-300">
                      Guarda sus pesos en las gráficas de cada ejercicio y activa el descanso hasta
                      mañana.
                    </p>
                  </div>
                  <button
                    onClick={handleFinishWorkoutSession}
                    className="w-full sm:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shrink-0 shadow-lg shadow-emerald-500/20"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Finalizar Sesión de Hoy ({currentSession.code})
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                {finishBanner && (
                  <div className="p-3.5 rounded-xl bg-amber-500/20 border border-amber-400 text-amber-200 text-xs font-bold text-center">
                    {finishBanner}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PROGRESO */}
        {activeTab === 'progress' && (
          <ProgressDashboard
            profiles={profiles}
            mesocycle={mesocycle}
            history={history}
            weightUnit={weightUnit}
          />
        )}

        {/* TAB 3: AJUSTES (Includes Perfiles, Peso Ideal, Guía Gym) */}
        {activeTab === 'settings' && (
          <SettingsAndMesocycle
            profiles={profiles}
            deviceConfig={deviceConfig}
            mesocycle={mesocycle}
            weightUnit={weightUnit}
            initialSubTab={settingsSubTab}
            calculatorPreselect={calculatorPreselect}
            highlightedGlossaryId={highlightedGlossaryId}
            hasSampleData={hasSampleData}
            onUpdateProfiles={setProfiles}
            onUpdateDeviceConfig={setDeviceConfig}
            onUpdateMesocycle={setMesocycle}
            onSaveIdealWeight={handleSaveIdealWeight}
            onClearSampleHistory={() =>
              setHistory((prev) => prev.filter((x) => !x.isSampleData))
            }
            onResetMesocycle={() =>
              setSlotsState(buildSessionState(currentSession.slots, profiles))
            }
            onReopenOnboarding={() =>
              setDeviceConfig({ ...deviceConfig, onboardingCompleted: false })
            }
          />
        )}
      </main>

      <RestTimerBar
        secondsLeft={restSecondsLeft}
        totalSeconds={restTotalSeconds}
        isRunning={restIsRunning}
        label={restLabel}
        onTogglePause={() => setRestIsRunning((r) => !r)}
        onAdjustSeconds={(delta) => {
          setRestSecondsLeft((prev) => Math.max(0, prev + delta))
          setRestTotalSeconds((prev) => Math.max(15, prev + delta))
        }}
        onReset={() => {
          setRestSecondsLeft(restTotalSeconds)
          setRestIsRunning(true)
        }}
        onSkip={() => {
          setRestIsRunning(false)
          setRestSecondsLeft(0)
          setRestTotalSeconds(0)
        }}
      />

      {/* Strictly 3 Bottom Navigation Tabs: Entrenar, Progreso, Ajustes */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-[#090D16]/95 backdrop-blur-md border-t border-slate-800 px-3 py-1.5">
        <div className="max-w-md mx-auto grid grid-cols-3 gap-2">
          {(
            [
              { id: 'workout', label: 'Entrenar', icon: Dumbbell },
              { id: 'progress', label: 'Progreso', icon: BarChart3 },
              { id: 'settings', label: 'Ajustes', icon: Settings }
            ] as const
          ).map((item) => {
            const Icon = item.icon
            const active = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center py-2 rounded-xl transition-all ${
                  active
                    ? 'text-emerald-400 bg-emerald-500/15 font-extrabold border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px] mt-0.5">{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
export default App
