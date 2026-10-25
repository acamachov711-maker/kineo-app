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

  // Sync global CSS theme variables (:root[data-profile='partner' | 'owner']) with activeProfileId
  useEffect(() => {
    document.documentElement.setAttribute(
      'data-profile',
      activeProfileId === 'user_2' ? 'partner' : 'owner'
    )
  }, [activeProfileId])

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
              accentColor: '#FF5500',
              isDeviceOwner: prev.user_1.isDeviceOwner
            },
            user_2: {
              ...prev.user_2,
              ...remotePayload.profiles.user_2,
              accentColor: '#8B5CF6',
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
    <div className="min-h-screen bg-[#0B090E] text-white flex flex-col">
      {/* Kineo Ascent header: logo K, switch Titular / Pareja (theme), unit */}
      <header className="sticky top-0 z-30 bg-[#0B090E]/95 backdrop-blur-md border-b border-[#2A2533] px-3 sm:px-6 py-2.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 256 256" className="w-7 h-7" aria-hidden="true">
              <defs>
                <linearGradient id="ascent-energy" gradientUnits="userSpaceOnUse" x1="66" y1="190" x2="190" y2="60">
                  <stop stopColor="#FF5500" />
                  <stop offset="1" stopColor="#8B5CF6" />
                </linearGradient>
              </defs>
              <path fill="url(#ascent-energy)" d="M73 80H106L102 125 148 85 140 101 151 93 162 77H144L202 56 186 112 181 97 133 137 183 200H145L100 147 94 200H60Z" />
            </svg>
            <span className="font-display text-2xl leading-none">KINEO</span>
          </div>

          <div className="flex items-center gap-2">
            {deviceConfig.coupleModeEnabled && (
              <div className="flex items-center bg-[#14111A] border border-[#2A2533] rounded-lg p-0.5">
                <button
                  onClick={() => setActiveProfileId(primaryPid)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase font-mono transition-all ${
                    activeProfileId === primaryPid ? 'theme-bg' : 'text-[#A09BA8]'
                  }`}
                >
                  {profiles[primaryPid].name.trim() || 'Titular'}
                </button>
                <button
                  onClick={() => setActiveProfileId(secondaryPid)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase font-mono transition-all ${
                    activeProfileId === secondaryPid ? 'theme-bg' : 'text-[#A09BA8]'
                  }`}
                >
                  {profiles[secondaryPid].name.trim() || 'Pareja'}
                </button>
              </div>
            )}

            <button
              onClick={() => setWeightUnit((u) => (u === 'kg' ? 'lb' : 'kg'))}
              className="px-2 py-1.5 rounded-lg bg-[#14111A] border border-[#2A2533] text-[11px] font-bold font-mono text-white"
            >
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
                  activeProfileId={activeProfileId}
                />

                <div className="rounded-[10px] bg-[#14111A] border border-[#2A2533] p-6 text-center space-y-4">
                  <div className="w-14 h-14 rounded-[10px] bg-[#0B090E] border border-[#10B981] flex items-center justify-center text-[#10B981] mx-auto">
                    <Moon className="w-7 h-7" />
                  </div>
                  <div className="space-y-1 max-w-lg mx-auto">
                    <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#10B981]">
                      ¡Sesión {deviceConfig.lastCompletedSessionCode || ''} Completada!
                    </span>
                    <h2 className="font-display text-3xl text-white">
                      Descanso Muscular hasta Mañana
                    </h2>
                    <p className="text-xs text-[#A09BA8]">
                      Mañana toca: <strong className="text-white">{currentSession.title}</strong>.
                    </p>
                  </div>

                  <div className="pt-1 flex flex-wrap items-center justify-center gap-2.5">
                    <button
                      onClick={() => setActiveTab('progress')}
                      className="solar-btn theme-bg px-4 py-2.5 rounded-[9px] text-base flex items-center gap-2"
                    >
                      <BarChart3 className="w-4 h-4" />
                      Ver Progreso
                    </button>
                    <button
                      onClick={() => setIsWorkoutStarted(true)}
                      className="px-3.5 py-2.5 rounded-[9px] bg-[#14111A] hover:bg-[#1C1826] text-[#A09BA8] hover:text-white border border-[#2A2533] font-mono text-[11px] font-bold uppercase flex items-center gap-1.5"
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
                  activeProfileId={activeProfileId}
                />

                <div className="rounded-[10px] bg-[#14111A] border border-[#2A2533] p-4 sm:p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-mono text-[11px] font-bold uppercase tracking-wider theme-text flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        Sesión Lista para Hoy
                      </span>
                      <h2 className="font-display text-3xl text-white mt-0.5">
                        {currentSession.title}
                      </h2>
                      <p className="text-xs text-[#A09BA8]">{currentSession.subtitle}</p>
                    </div>

                    <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#E2DFEA] bg-[#0B090E] px-3 py-1.5 rounded-md border border-[#2A2533]">
                      <Clock className="w-3.5 h-3.5 theme-text" />~
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
                          className={`p-2 rounded-lg border text-center transition-all ${
                            isSelected
                              ? 'theme-bg theme-border'
                              : 'bg-[#0B090E] border-[#2A2533] text-white'
                          }`}
                        >
                          <span className="font-display text-lg block leading-none">
                            {sess.code}
                          </span>
                          <span
                            className={`font-mono text-[9px] block truncate mt-0.5 ${
                              isSelected ? 'font-semibold' : 'text-[#A09BA8]'
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
                        className="flex items-center gap-2 text-xs text-[#E2DFEA] bg-[#0B090E] px-3 py-2 rounded-md border border-[#2A2533]"
                      >
                        <span className="w-5 h-5 rounded bg-[#14111A] border border-[#2A2533] theme-text font-mono font-bold text-[11px] flex items-center justify-center shrink-0">
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
                    className="solar-btn theme-bg w-full py-3 rounded-[9px] text-[22px] flex items-center justify-center gap-2"
                  >
                    <Play className="w-5 h-5" />
                    Comenzar Sesión {currentSession.code} ↗
                  </button>
                </div>
              </div>
            ) : (
              /* STATE C: ACTIVE WORKOUT SESSION (EXCLUSIVE ACCORDION VIEW) */
              <div className="space-y-3">
                <div className="rounded-[10px] bg-[#14111A] border border-[#2A2533] p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="font-display text-2xl text-white leading-none">
                        {currentSession.title}
                      </h2>
                      <p className="font-mono text-[10px] uppercase tracking-[0.04em] text-[#A09BA8] mt-1">
                        {activeProfileId === primaryPid ? 'Titular' : 'Pareja'} ·{' '}
                        {activeProfileId === primaryPid
                          ? statsPrimary.completed
                          : statsSecondary.completed}
                        /
                        {activeProfileId === primaryPid ? statsPrimary.total : statsSecondary.total}{' '}
                        series
                      </p>
                    </div>
                    <button
                      onClick={() => setIsWorkoutStarted(false)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#0B090E] hover:bg-[#1C1826] font-mono text-[10px] font-bold uppercase text-[#A09BA8] hover:text-white border border-[#2A2533] shrink-0"
                    >
                      ← Portada
                    </button>
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

                <div className="rounded-[10px] bg-[#14111A] border border-[#2A2533] p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div>
                    <h3 className="font-mono text-[11px] font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 theme-text" />
                      ¿Terminaron la sesión {currentSession.code}?
                    </h3>
                    <p className="text-[11px] text-[#A09BA8]">
                      Guarda el progreso de hoy y suma día a la racha.
                    </p>
                  </div>
                  <button
                    onClick={handleFinishWorkoutSession}
                    className="solar-btn theme-bg w-full sm:w-auto px-5 py-2.5 rounded-[9px] text-lg flex items-center justify-center gap-2 shrink-0"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Finalizar y Guardar Sesión {currentSession.code}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                {finishBanner && (
                  <div className="p-3 rounded-md bg-amber-500/20 border border-amber-400 text-amber-200 text-xs font-bold text-center">
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
            activeProfileId={activeProfileId}
            onSelectActiveProfile={setActiveProfileId}
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
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-[#0B090E]/95 backdrop-blur-md border-t border-[#2A2533] px-3 py-2">
        <div className="max-w-md mx-auto grid grid-cols-3 gap-2">
          {(
            [
              { id: 'workout', label: '01 / Entrenar', icon: Dumbbell },
              { id: 'progress', label: '02 / Progreso', icon: BarChart3 },
              { id: 'settings', label: '03 / Ajustes', icon: Settings }
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
                    ? 'theme-text theme-soft-bg font-extrabold border theme-border'
                    : 'text-[#A09BA8] hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-mono text-[10px] uppercase tracking-[0.06em] mt-0.5">{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
export default App
