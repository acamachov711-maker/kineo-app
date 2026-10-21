import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Dumbbell,
  BarChart3,
  Settings,
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
  Unlock,
  Wifi
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
  liveSyncManager,
  SlotLiveState
} from './services/syncService'
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

type SessionSlotsState = Record<string, SlotLiveState>

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

  // Controls whether the user is in the Pre-Workout Lobby or Active Session
  const [isWorkoutStarted, setIsWorkoutStarted] = useState<boolean>(false)

  // Exclusive Accordion State: null = all exercises collapsed; string = only that slotId expanded
  const [expandedSlotId, setExpandedSlotId] = useState<string | null>(null)

  const [profiles, setProfiles] = useState<Record<'user_1' | 'user_2', UserProfile>>(() =>
    loadProfiles()
  )
  const [mesocycle, setMesocycle] = useState<MesocyclePlan>(() => loadMesocycle())
  const [history, setHistory] = useState<WorkoutHistoryEntry[]>(() => loadHistory())
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(() => loadWeightUnit())
  const [activeSessionId, setActiveSessionId] = useState<string>(() => loadActiveSessionId())

  const [activeProfileId, setActiveProfileId] = useState<'user_1' | 'user_2'>(
    deviceConfig.primaryProfileId
  )

  const [syncStatus, setSyncStatus] = useState<'disconnected' | 'connecting' | 'connected'>(
    'disconnected'
  )
  const isApplyingRemoteRef = useRef<boolean>(false)
  const lastRemoteTimestampRef = useRef<number>(0)

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

  // Keep activeProfileId synced when switching to Solo Mode
  useEffect(() => {
    if (!deviceConfig.coupleModeEnabled) {
      setActiveProfileId(deviceConfig.primaryProfileId)
    }
  }, [deviceConfig.coupleModeEnabled, deviceConfig.primaryProfileId])

  useEffect(() => {
    if (isApplyingRemoteRef.current) return
    setSlotsState(buildSessionState(currentSession.slots, profiles))
    setExpandedSlotId(null)
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

  // LIVE REAL-TIME SYNC SUBSCRIPTION (Option 1)
  useEffect(() => {
    if (!deviceConfig.coupleModeEnabled || !deviceConfig.syncRoomCode) {
      liveSyncManager.disconnect()
      return
    }

    liveSyncManager.connectRoom(
      deviceConfig.syncRoomCode,
      (remotePayload) => {
        if (remotePayload.updatedAt <= lastRemoteTimestampRef.current) return
        lastRemoteTimestampRef.current = remotePayload.updatedAt
        isApplyingRemoteRef.current = true

        if (remotePayload.activeSessionId) {
          setActiveSessionId(remotePayload.activeSessionId)
        }
        setIsWorkoutStarted(Boolean(remotePayload.isWorkoutStarted))

        if (remotePayload.slotsState && Object.keys(remotePayload.slotsState).length > 0) {
          setSlotsState(remotePayload.slotsState)
        }

        if (remotePayload.profiles) {
          setProfiles((prev) => ({
            user_1: {
              ...prev.user_1,
              ...remotePayload.profiles.user_1,
              isDeviceOwner: prev.user_1.isDeviceOwner
            },
            user_2: {
              ...prev.user_2,
              ...remotePayload.profiles.user_2,
              isDeviceOwner: prev.user_2.isDeviceOwner
            }
          }))
        }

        if (Array.isArray(remotePayload.history)) {
          setHistory((prev) => {
            const byId = new Map<string, WorkoutHistoryEntry>()
            prev.forEach((h) => byId.set(h.id, h))
            remotePayload.history.forEach((h) => byId.set(h.id, h))
            return Array.from(byId.values())
          })
        }

        if (remotePayload.lastCompletedWorkoutDate) {
          setDeviceConfig((prev) => ({
            ...prev,
            lastCompletedWorkoutDate: remotePayload.lastCompletedWorkoutDate,
            lastCompletedSessionCode: remotePayload.lastCompletedSessionCode
          }))
        }

        setTimeout(() => {
          isApplyingRemoteRef.current = false
        }, 120)
      },
      (status) => {
        setSyncStatus(status)
      }
    )

    return () => {
      liveSyncManager.disconnect()
    }
  }, [deviceConfig.coupleModeEnabled, deviceConfig.syncRoomCode])

  // Broadcast local changes to partner phone in real time
  useEffect(() => {
    if (
      isApplyingRemoteRef.current ||
      !deviceConfig.coupleModeEnabled ||
      !deviceConfig.syncRoomCode ||
      syncStatus !== 'connected'
    ) {
      return
    }

    const timer = setTimeout(() => {
      liveSyncManager.broadcastState({
        activeSessionId,
        isWorkoutStarted,
        lastCompletedWorkoutDate: deviceConfig.lastCompletedWorkoutDate,
        lastCompletedSessionCode: deviceConfig.lastCompletedSessionCode,
        slotsState,
        profiles,
        history
      })
    }, 150)

    return () => clearTimeout(timer)
  }, [
    activeSessionId,
    isWorkoutStarted,
    deviceConfig.lastCompletedWorkoutDate,
    deviceConfig.lastCompletedSessionCode,
    deviceConfig.coupleModeEnabled,
    deviceConfig.syncRoomCode,
    syncStatus,
    slotsState,
    profiles,
    history
  ])

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
    const profilesToSave: ('user_1' | 'user_2')[] = deviceConfig.coupleModeEnabled
      ? ['user_1', 'user_2']
      : [deviceConfig.primaryProfileId]

    profilesToSave.forEach((pid) => {
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
      setFinishBanner('Marca al menos 1 serie completada (✓) antes de finalizar.')
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
    setExpandedSlotId(null)
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
          setSlotsState(buildSessionState(currentSession.slots, updatedProfiles))
          setIsWorkoutStarted(false)
          setExpandedSlotId(null)
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
      {/* Clean Top Bar (Collaborative 'Pareja' button removed — only direct user switch) */}
      <header className="sticky top-0 z-30 bg-[#090D16]/90 backdrop-blur-md border-b border-slate-800/80 px-3 sm:px-6 py-2.5">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-pink-500 p-[1.5px]">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center font-black text-sm tracking-tighter text-white">
                K
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm sm:text-base font-black tracking-tight text-white">
                  KINEO <span className="text-emerald-400 text-xs font-bold">v1.5</span>
                </h1>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Sem {mesocycle.currentWeek}/{mesocycle.durationWeeks}
                </span>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                  <Flame className="w-3 h-3 text-amber-400 fill-amber-400" />
                  {streakPrimary.weeklySessionsDone}/3
                </span>
                {deviceConfig.coupleModeEnabled && deviceConfig.syncRoomCode && (
                  <button
                    onClick={() => {
                      setSettingsSubTab('profiles')
                      setActiveTab('settings')
                    }}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                      syncStatus === 'connected'
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                    title={`Sala en vivo: ${deviceConfig.syncRoomCode}`}
                  >
                    <Wifi className="w-2.5 h-2.5" />
                    <span className="hidden xs:inline">{deviceConfig.syncRoomCode}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Direct 2-user switch (Only rendered when Couple Mode is enabled) */}
            {deviceConfig.coupleModeEnabled && (
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5">
                <button
                  onClick={() => setActiveProfileId(primaryPid)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                    activeProfileId === primaryPid
                      ? 'bg-emerald-500 text-slate-950 font-extrabold shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <User className="w-3 h-3" />
                  {profiles[primaryPid].name.split(' ')[0]}
                </button>
                <button
                  onClick={() => setActiveProfileId(secondaryPid)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                    activeProfileId === secondaryPid
                      ? 'bg-pink-500 text-slate-950 font-extrabold shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <User className="w-3 h-3" />
                  {profiles[secondaryPid].name.split(' ')[0]}
                </button>
              </div>
            )}

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

      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 pt-3">
        {/* TAB 1: ENTRENAR */}
        {activeTab === 'workout' && (
          <div className="space-y-4 pb-28">
            {/* STATE A: COMPLETED TODAY -> WAIT UNTIL TOMORROW */}
            {isCompletedToday && !isWorkoutStarted ? (
              <div className="space-y-4">
                <StreakBanner
                  profiles={profiles}
                  primaryProfileId={primaryPid}
                  history={history}
                />

                <div className="rounded-3xl bg-gradient-to-br from-emerald-950/50 via-slate-900 to-indigo-950/40 border border-emerald-500/40 p-6 text-center space-y-4 shadow-2xl">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 mx-auto">
                    <Moon className="w-7 h-7" />
                  </div>
                  <div className="space-y-1 max-w-lg mx-auto">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                      ¡Sesión {deviceConfig.lastCompletedSessionCode || ''} Completada!
                    </span>
                    <h2 className="text-xl font-black text-white">
                      Descanso Muscular hasta Mañana
                    </h2>
                    <p className="text-xs text-slate-300">
                      Mañana toca: <strong>{currentSession.title}</strong>.
                    </p>
                  </div>

                  <div className="pt-1 flex flex-wrap items-center justify-center gap-2.5">
                    <button
                      onClick={() => setActiveTab('progress')}
                      className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center gap-2"
                    >
                      <BarChart3 className="w-4 h-4" />
                      Ver Progreso
                    </button>
                    <button
                      onClick={() => setIsWorkoutStarted(true)}
                      className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      Desbloquear hoy
                    </button>
                  </div>
                </div>
              </div>
            ) : !isWorkoutStarted ? (
              /* STATE B: CLEAN LOBBY */
              <div className="space-y-4">
                <StreakBanner
                  profiles={profiles}
                  primaryProfileId={primaryPid}
                  history={history}
                />

                <div className="rounded-3xl bg-slate-900/95 border border-slate-800 p-4 sm:p-6 space-y-4 shadow-xl">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        Sesión Lista para Hoy
                      </span>
                      <h2 className="text-lg sm:text-xl font-black text-white mt-0.5">
                        {currentSession.title}
                      </h2>
                      <p className="text-xs text-slate-400">{currentSession.subtitle}</p>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                      <Clock className="w-3.5 h-3.5 text-emerald-400" />~
                      {currentSession.estimatedMinutes} min • {currentSession.slots.length} ejerc.
                    </div>
                  </div>

                  {/* Session Queue Selector */}
                  <div className="grid grid-cols-5 gap-1.5">
                    {mesocycle.sessions.map((sess) => {
                      const isSelected = sess.id === currentSession.id
                      return (
                        <button
                          key={sess.id}
                          onClick={() => setActiveSessionId(sess.id)}
                          className={`p-2 rounded-xl border text-center transition-all ${
                            isSelected
                              ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-extrabold shadow-lg shadow-emerald-500/20'
                              : 'bg-slate-950/70 border-slate-800 text-slate-300'
                          }`}
                        >
                          <span className="text-xs font-black block">Sesión {sess.code}</span>
                          <span
                            className={`text-[10px] block truncate ${
                              isSelected ? 'text-slate-900 font-semibold' : 'text-slate-400'
                            }`}
                          >
                            {sess.isOptional5thDay ? 'Opc.' : `${sess.slots.length} ej.`}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Preview of exercises */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {currentSession.slots.map((slot) => (
                      <div
                        key={slot.slotId}
                        className="flex items-center gap-2 text-xs text-slate-300 bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800/80"
                      >
                        <span className="w-5 h-5 rounded bg-slate-800 text-emerald-400 font-bold text-[11px] flex items-center justify-center shrink-0">
                          {slot.order}
                        </span>
                        <span className="truncate font-medium">{slot.primaryExercise.name}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      setIsWorkoutStarted(true)
                      setExpandedSlotId(null)
                    }}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-base shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2"
                  >
                    <Play className="w-5 h-5 fill-slate-950" />
                    Comenzar Sesión {currentSession.code}
                  </button>
                </div>
              </div>
            ) : (
              /* STATE C: ACTIVE WORKOUT SESSION (EXCLUSIVE ACCORDION VIEW) */
              <div className="space-y-3">
                <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-sm sm:text-base font-extrabold text-white">
                        {currentSession.title}
                      </h2>
                      <p className="text-[11px] text-slate-400">
                        Toca un ejercicio para abrirlo (se mostrará uno a la vez).
                      </p>
                    </div>
                    <button
                      onClick={() => setIsWorkoutStarted(false)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700 shrink-0"
                    >
                      ← Portada
                    </button>
                  </div>

                  <div
                    className={`grid gap-2 ${
                      deviceConfig.coupleModeEnabled ? 'grid-cols-2' : 'grid-cols-1'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveProfileId(primaryPid)}
                      className={`px-3 py-2 rounded-xl border flex items-center justify-between text-xs transition-all ${
                        activeProfileId === primaryPid
                          ? 'bg-emerald-950/30 border-emerald-500/50 text-white'
                          : 'bg-slate-950/70 border-slate-800 text-slate-400'
                      }`}
                    >
                      <span
                        className="font-bold truncate"
                        style={{ color: profiles[primaryPid].accentColor }}
                      >
                        ★ {profiles[primaryPid].name}
                      </span>
                      <span className="font-semibold">
                        {statsPrimary.completed}/{statsPrimary.total} series
                      </span>
                    </button>

                    {deviceConfig.coupleModeEnabled && (
                      <button
                        type="button"
                        onClick={() => setActiveProfileId(secondaryPid)}
                        className={`px-3 py-2 rounded-xl border flex items-center justify-between text-xs transition-all ${
                          activeProfileId === secondaryPid
                            ? 'bg-pink-950/30 border-pink-500/50 text-white'
                            : 'bg-slate-950/70 border-slate-800 text-slate-400'
                        }`}
                      >
                        <span
                          className="font-bold truncate"
                          style={{ color: profiles[secondaryPid].accentColor }}
                        >
                          {profiles[secondaryPid].name}
                        </span>
                        <span className="font-semibold">
                          {statsSecondary.completed}/{statsSecondary.total} series
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {/* EXCLUSIVE ACCORDION EXERCISE LIST */}
                <div className="space-y-2.5">
                  {currentSession.slots.map((slot) => {
                    const st = slotsState[slot.slotId]
                    if (!st) return null
                    const isExpanded = expandedSlotId === slot.slotId
                    return (
                      <ExerciseSlotCard
                        key={slot.slotId}
                        slot={slot}
                        isExpanded={isExpanded}
                        onToggleExpand={() =>
                          setExpandedSlotId((prev) =>
                            prev === slot.slotId ? null : slot.slotId
                          )
                        }
                        profiles={profiles}
                        primaryProfileId={primaryPid}
                        activeProfileId={activeProfileId}
                        coupleModeEnabled={deviceConfig.coupleModeEnabled}
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

                <div className="rounded-2xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-pink-950/60 border border-emerald-500/30 p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      ¿Terminaron la sesión {currentSession.code}?
                    </h3>
                    <p className="text-[11px] text-slate-300">
                      Guarda el progreso de hoy y suma día a la racha.
                    </p>
                  </div>
                  <button
                    onClick={handleFinishWorkoutSession}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shrink-0 shadow-lg shadow-emerald-500/20"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Finalizar y Guardar ({currentSession.code})
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                {finishBanner && (
                  <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-400 text-amber-200 text-xs font-bold text-center">
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

        {/* TAB 3: AJUSTES */}
        {activeTab === 'settings' && (
          <SettingsAndMesocycle
            profiles={profiles}
            deviceConfig={deviceConfig}
            mesocycle={mesocycle}
            weightUnit={weightUnit}
            syncStatus={syncStatus}
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

      {/* Strictly 3 Bottom Navigation Tabs */}
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
