import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Dumbbell,
  BarChart3,
  Settings,
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
  WorkoutHistoryEntry,
  WorkoutSessionTemplate
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
  saveActiveSessionId,
  persistCompanionRemoval
} from './services/storageService'
import { useWorkoutSession } from './hooks/useWorkoutSession'
import { removeCompanionData } from './utils/companionData'
import { getDraftLiveStats, getDraftJournal } from './utils/workoutJournal'
import { applySharedRoomProfile } from './services/sharedRoomProfile'
import type { SharedRoomProfile } from './services/sharedRoomProfile'
import { targetKey } from './services/seriesSync'
import { getProfileExerciseOptions, hasRecordedSets, hasRecordedSlot, recalibratePendingSets, getCompletedSetStats } from './utils/workoutState'
import { StorageNotice } from './components/StorageNotice'
import { SeriesConflictReview } from './components/SeriesConflictReview'
import { PublicRoomPanel } from './components/PublicRoomPanel'
import { roomIndicator } from './utils/roomIndicator'
import { usePublicRoom } from './hooks/usePublicRoom'
import {
  buildPyramidSets,
  generateDropSubSets,
  getIdealWeightZones,
  getLocalDateKey
} from './utils/fitnessMath'
import { ASCENT_COLOR_PALETTE } from './data/initialData'
import { OnboardingWizard } from './components/OnboardingWizard'
import { ExerciseSlotCard } from './components/ExerciseSlotCard'
import { RestTimerBar } from './components/RestTimerBar'
import { ProgressDashboard } from './components/ProgressDashboard'
import { SettingsAndMesocycle, SettingsSubTab } from './components/SettingsAndMesocycle'
import { StreakBanner } from './components/StreakBanner'
import {
  TransitionOverlay,
  TransitionEventPayload,
  TransitionType,
  TRANSITION_CATALOG
} from './components/TransitionOverlay'

// Strictly 3 Bottom Tabs: 'workout' | 'progress' | 'settings'
type ActiveTab = 'workout' | 'progress' | 'settings'

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
  const deviceConfigRef = useRef(deviceConfig)
  deviceConfigRef.current = deviceConfig
  const [activeTab, setActiveTab] = useState<ActiveTab>('workout')
  const [settingsSubTab, setSettingsSubTab] = useState<SettingsSubTab>('profiles')
  const [profileRevision, setProfileRevision] = useState(0)
  const [profileRemovalMessage, setProfileRemovalMessage] = useState('')
  const [onboardingError, setOnboardingError] = useState('')

  // Controls whether the user is in the Pre-Workout Lobby or Active Session
  const [profiles, setProfiles] = useState<Record<'user_1' | 'user_2', UserProfile>>(() =>
    loadProfiles()
  )
  const [mesocycle, setMesocycle] = useState<MesocyclePlan>(() => loadMesocycle())
  const [history, setHistory] = useState<WorkoutHistoryEntry[]>(() => loadHistory())
  const historyRef = useRef(history)
  historyRef.current = history
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(() => loadWeightUnit())
  const {
    workoutId, activeSessionId, setActiveSessionId, slotsState, setSlotsState,
    activeProfileId, setActiveProfileId, expandedSlotId, setExpandedSlotId,
    isWorkoutStarted, setIsWorkoutStarted, restSecondsLeft, restTotalSeconds,
    restIsRunning, restLabel, startRestTimer, toggleRestPause, adjustRestSeconds,
    resetRestTimer, skipRestTimer, getWorkoutDuration, completeWorkout,
    resetWorkouts, hasRecordedWorkouts, pendingOperations, journalError, workspace, replaceWorkspace, conflicts, resolveConflict,
    readWorkspace, commitWorkspace, createRoomStore, initializeOnboarding
  } = useWorkoutSession(mesocycle.sessions, profiles, deviceConfig.primaryProfileId)
  const companionId = deviceConfig.primaryProfileId === 'user_1' ? 'user_2' : 'user_1'
  const hasCompanionData = history.some((entry) => entry.profileId === companionId && !entry.isSampleData) ||
    Object.values(workspace.drafts).some((draft) => Object.values(draft.slotsState).some((slot) => hasRecordedSets(slot.setsByProfile[companionId])) ||
      getDraftJournal(draft)?.operations.some((operation) => operation.target.profileId === companionId)) ||
    (workspace.archivedJournals || []).some((journal) => journal.operations.some((operation) => operation.target.profileId === companionId))
  const peerProfiles = (peer: SharedRoomProfile, session: WorkoutSessionTemplate) => ({ ...profiles,
    [companionId]: applySharedRoomProfile(profiles[companionId], peer, session, !!hasCompanionData) })
  const publicRoom = usePublicRoom({ workspace, sessions: mesocycle.sessions, profiles, readWorkspace, commitWorkspace, createRoomStore,
    readyForInvitation: deviceConfig.onboardingCompleted && deviceConfig.coupleModeEnabled, ownerProfileId: deviceConfig.primaryProfileId,
    hasCompanionData: !!hasCompanionData, previewPeer: (peer, session) => { peerProfiles(peer, session) },
    importPeer: (peer, session) => { const next = peerProfiles(peer, session); if (!saveProfiles(next, false)) return false; setProfiles(next); return true },
    history, readHistory: () => historyRef.current,
    persistHistory: (next) => { if (!saveHistory(next, false)) return false; historyRef.current = next; setHistory(next); return true },
    markCompleted: (date, sessionCode) => {
      const next = { ...deviceConfigRef.current, lastCompletedWorkoutDate: date, lastCompletedSessionCode: sessionCode }
      if (!saveDeviceConfig(next, false)) return false
      deviceConfigRef.current = next; setDeviceConfig(next); return true
    } })

  useEffect(() => {
    if (publicRoom.invitation && deviceConfig.onboardingCompleted && !deviceConfig.coupleModeEnabled) {
      setDeviceConfig((previous) => ({ ...previous, coupleModeEnabled: true }))
    }
  }, [publicRoom.invitation, deviceConfig.onboardingCompleted, deviceConfig.coupleModeEnabled])

  useEffect(() => {
    if (!workspace.room && (publicRoom.invitation || publicRoom.pendingCode)) setActiveTab('settings')
  }, [workspace.room, publicRoom.invitation, publicRoom.pendingCode])

  const [calculatorPreselect, setCalculatorPreselect] = useState<{
    profileId: 'user_1' | 'user_2'
    variant: ExerciseVariant
    slotId: string
  } | null>(null)

  const [highlightedGlossaryId, setHighlightedGlossaryId] = useState<string | null>(null)
  const [finishBanner, setFinishBanner] = useState<string | null>(null)
  const pendingReviewEdits = useRef(new Set<string>())
  const [pendingReviewCount, setPendingReviewCount] = useState(0)
  const onReviewPendingEdit = (slotId: string, key: string, pending: boolean) => {
    const id = `${slotId}:${key}`
    if (pending) pendingReviewEdits.current.add(id)
    else pendingReviewEdits.current.delete(id)
    setPendingReviewCount(pendingReviewEdits.current.size)
  }
  useEffect(() => {
    if (workspace.room?.closure?.phase === 'committed') setFinishBanner(null)
  }, [workspace.room?.closure?.phase])
  const conflictedSetKeys = new Set(conflicts.map((entry) => targetKey(entry.target)))
  const hasSlotConflict = (slotId: string) => conflicts.some((entry) => entry.target.slotId === slotId)

  // V1.6-08: Motor de Transiciones Animadas y regla anti-repetición consecutiva
  const [activeTransition, setActiveTransition] = useState<TransitionEventPayload | null>(null)
  const lastPlayedTransitionRef = useRef<TransitionType | null>(null)

  const triggerKineoTransition = useCallback(
    (preferredType: TransitionType, subtitle: string) => {
      let chosenVideoType: TransitionType = preferredType
      // V1.6-08: Prohibido mostrar 2 videos iguales consecutivos, pero conservando siempre el título/badge real del logro
      if (lastPlayedTransitionRef.current === preferredType) {
        if (preferredType === 'station_complete') {
          chosenVideoType = 'overload_dropset'
        } else if (preferredType === 'overload_dropset') {
          chosenVideoType = 'station_complete'
        } else if (preferredType === 'new_record_pr') {
          chosenVideoType = 'overload_dropset'
        } else if (preferredType === 'session_complete_duo') {
          chosenVideoType = 'station_complete'
        }
      }
      lastPlayedTransitionRef.current = chosenVideoType
      const semanticMeta = TRANSITION_CATALOG[preferredType]
      const videoMeta = TRANSITION_CATALOG[chosenVideoType]
      setActiveTransition({
        ...semanticMeta,
        videoUrl: videoMeta.videoUrl,
        subtitle
      })
    },
    []
  )

  const currentSession =
    mesocycle.sessions.find((s) => s.id === activeSessionId) || mesocycle.sessions[0]

  // Keep activeProfileId synced when switching to Solo Mode
  useEffect(() => {
    if (!deviceConfig.coupleModeEnabled) {
      setActiveProfileId(deviceConfig.primaryProfileId)
    }
  }, [deviceConfig.coupleModeEnabled, deviceConfig.primaryProfileId])

  // V1.6-10: Sync global CSS theme variables (--theme & --theme-fg) with activeProfileId's chosen Ascent color
  useEffect(() => {
    const activeProf = profiles[activeProfileId]
    const hex = activeProf?.accentColor || (activeProfileId === 'user_2' ? '#8B5CF6' : '#FF5500')
    const foundColor = ASCENT_COLOR_PALETTE.find(
      (c) => c.hex.toUpperCase() === hex.toUpperCase()
    )
    const fgHex = foundColor ? foundColor.fgHex : '#0B090E'

    document.documentElement.setAttribute(
      'data-profile',
      activeProfileId === 'user_2' ? 'partner' : 'owner'
    )
    document.documentElement.style.setProperty('--theme', hex)
    document.documentElement.style.setProperty('--theme-fg', fgHex)
  }, [activeProfileId, profiles])

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

  const handleToggleSyncMode = (slotId: string) => {
    if (hasSlotConflict(slotId)) { setFinishBanner('Revisa las series contradictorias antes de cambiar el modo de este ejercicio.'); return }
    const slot = currentSession.slots.find((s) => s.slotId === slotId)
    if (!slot) return
    if (slotsState[slotId] && hasRecordedSlot(slotsState[slotId])) {
      setFinishBanner('No cambiamos el modo de un ejercicio con series registradas. Desmarca las series si necesitas corregirlo.')
      return
    }
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
    if (hasSlotConflict(slotId)) { setFinishBanner('Revisa las series contradictorias antes de cambiar la variante de este ejercicio.'); return }
    const current = slotsState[slotId]
    if (current && (applyToBoth ? hasRecordedSlot(current) : hasRecordedSets(current.setsByProfile[profileId]))) {
      setFinishBanner('La variante tiene series registradas. Desmárcalas antes de cambiar de ejercicio para no reasignar tus resultados.')
      return
    }
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

    const slot = currentSession.slots.find((s) => s.slotId === slotId)
    if (!slot) return

    setSlotsState((prev) => {
      const current = prev[slotId]
      if (!current) return prev
      const targetPids: ('user_1' | 'user_2')[] = applyToBoth
        ? ['user_1', 'user_2']
        : [profileId]
      const nextSetsByProfile = { ...current.setsByProfile }

      targetPids.forEach((pid) => {
        nextSetsByProfile[pid] = buildInitialSetsForSlot(
          slot,
          updatedProfiles[pid],
          current.syncMode,
          current.techniqueByProfile[pid]
        )
      })

      return {
        ...prev,
        [slotId]: {
          ...current,
          setsByProfile: nextSetsByProfile
        }
      }
    })
  }

  const handleChangeTechnique = (
    profileId: 'user_1' | 'user_2',
    slotId: string,
    technique: SetTechnique
  ) => {
    if (hasSlotConflict(slotId)) { setFinishBanner('Revisa las series contradictorias antes de cambiar la técnica de este ejercicio.'); return }
    const slot = currentSession.slots.find((s) => s.slotId === slotId)
    if (!slot) return
    if (hasRecordedSets(slotsState[slotId]?.setsByProfile[profileId] || [])) {
      setFinishBanner('La técnica de un ejercicio con series registradas se conserva. Puedes cambiarla en una sesión nueva.')
      return
    }
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
                isFailure: false,
                drops: s.drops?.length ? s.drops : generateDropSubSets(s.weightKg)
              }
            : { ...s, isFailure: false, drops: undefined }
        )
      } else if (technique === 'failure') {
        updatedSets = currentSets.map((s, idx) => ({
          ...s,
          drops: undefined,
          isFailure: idx === currentSets.length - 1
        }))
      } else {
        updatedSets = currentSets.map((s) => ({
          ...s,
          drops: undefined,
          isFailure: false
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
    const slot = currentSession.slots.find((s) => s.slotId === slotId)
    const currentSlotState = slotsState[slotId]

    // Detect if this update completes the final set of the exercise for this user (V1.6-08)
    if (!(workspace.room?.closure && workspace.room.workoutId === workoutId) && slot && currentSlotState && updated.completed === true) {
      const currentSets = currentSlotState.setsByProfile[profileId]
      const wasAlreadyAllDone =
        currentSets.length > 0 && currentSets.every((stItem) => stItem.completed)
      const nextSetsPreview = currentSets.map((stItem, idx) =>
        idx === setIndex ? { ...stItem, ...updated } : stItem
      )
      const isNowAllDone =
        nextSetsPreview.length > 0 && nextSetsPreview.every((stItem) => stItem.completed)

      if (!wasAlreadyAllDone && isNowAllDone) {
        const prof = profiles[profileId]
        const options = getProfileExerciseOptions(slot, prof, currentSlotState.syncMode)
        const activeVarId = prof.activeVariantBySlot[slotId] || options[0].id
        const activeVar = options.find((o) => o.id === activeVarId) || options[0]
        const tech = currentSlotState.techniqueByProfile[profileId]

        // Check if user achieved a New Personal Record (PR) compared to history or calibrated 1RM
        const recordedStats = getCompletedSetStats(nextSetsPreview)
        const maxWeightToday = recordedStats.maxWeightKg
        const todayEstimated1Rm = recordedStats.estimated1RmKg
        const previousHistoryWeights = history
          .filter((h) => h.profileId === profileId && !h.isSampleData && h.id !== `${workoutId}-${profileId}`)
          .flatMap((h) => h.exercises)
          .filter((ex) => ex.variantId === activeVarId)
          .map((ex) => ex.maxWeightKg)

        const previousBestWeight =
          previousHistoryWeights.length > 0 ? Math.max(...previousHistoryWeights) : 0
        const calibrated1Rm = prof.estimated1RMByVariant[activeVarId] || 0

        const isNewPR =
          (previousBestWeight > 0 && maxWeightToday > previousBestWeight + 0.2) ||
          (calibrated1Rm > 0 && todayEstimated1Rm > calibrated1Rm + 1.0)

        // Priority hierarchy: 3 (PR) > 2 (Dropset / Failure) > 1 (Standard Station Complete)
        if (isNewPR) {
          triggerKineoTransition(
            'new_record_pr',
            `${prof.name} superó su marca en ${activeVar.name}`
          )
        } else if (tech === 'dropset' || tech === 'failure') {
          triggerKineoTransition(
            'overload_dropset',
            `${prof.name} completó todas las series de ${activeVar.name}`
          )
        } else {
          triggerKineoTransition(
            'station_complete',
            `${prof.name} dominó ${activeVar.name} (${nextSetsPreview.length}/${nextSetsPreview.length} series)`
          )
        }
      }
    }

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
      const tech = current.techniqueByProfile[profileId]
      const currentSets = current.setsByProfile[profileId]
      const last = currentSets[currentSets.length - 1]

      // Al añadir una serie nueva, el Dropset o Fallo pasa a la nueva última serie (V1.6-05 / V1.6-09)
      const cleanedPrevSets = currentSets.map((s) => hasRecordedSets([s]) ? s : ({
        ...s,
        isFailure: false,
        drops: undefined
      }))

      const newSet: SetEntry = {
        setNumber: currentSets.length + 1,
        targetReps: last?.targetReps || '10',
        weightKg: last?.weightKg || 0,
        actualReps: last?.actualReps || 10,
        rir: 1,
        isFailure: tech === 'failure',
        completed: false,
        drops: tech === 'dropset' ? generateDropSubSets(last?.weightKg || 20) : undefined
      }

      return {
        ...prev,
        [slotId]: {
          ...current,
          setsByProfile: {
            ...current.setsByProfile,
            [profileId]: [...cleanedPrevSets, newSet]
          }
        }
      }
    })
  }

  /**
   * V1.6-09: Eliminar serie extra manteniendo presionada la fila (long-press) o con el botón 🗑️,
   * renumerando las series restantes (1, 2, 3...) y reubicando el Dropset / Fallo en la nueva última serie.
   */
  const handleDeleteSet = (
    profileId: 'user_1' | 'user_2',
    slotId: string,
    setIndex: number
  ) => {
    const entry = slotsState[slotId]?.setsByProfile[profileId][setIndex]
    if (entry && hasRecordedSets([entry])) {
      setFinishBanner('No se elimina una serie registrada ni sus bajadas de peso. Corrige sus valores si es necesario.')
      return
    }
    setSlotsState((prev) => {
      const current = prev[slotId]
      if (!current) return prev
      const tech = current.techniqueByProfile[profileId]
      const currentSets = current.setsByProfile[profileId]
      if (currentSets.length <= 1) return prev

      const filtered = currentSets.filter((_, idx) => idx !== setIndex)
      const renumbered = filtered.map((s, idx) => {
        if (hasRecordedSets([s])) return { ...s, setNumber: idx + 1 }
        const isLast = idx === filtered.length - 1
        return {
          ...s,
          setNumber: idx + 1,
          isFailure: tech === 'failure' ? isLast : false,
          drops:
            tech === 'dropset' && isLast
              ? s.drops && s.drops.length > 0
                ? s.drops
                : generateDropSubSets(s.weightKg)
              : undefined
        }
      })

      return {
        ...prev,
        [slotId]: {
          ...current,
          setsByProfile: {
            ...current.setsByProfile,
            [profileId]: renumbered
          }
        }
      }
    })
  }

  const handleSaveIdealWeight = (
    profileId: 'user_1' | 'user_2',
    variantId: string,
    oneRmKg: number,
    slotId?: string,
    triggerRestSeconds?: number,
    restLabel?: string
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
      setSlotsState((prev) => {
        const current = prev[slotId]
        if (!current) return prev
        const tech = current.techniqueByProfile[profileId]
        const currentSets = current.setsByProfile[profileId]
        const nextSets = recalibratePendingSets(currentSets, oneRmKg, tech)
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

    // V1.6-02: Iniciar descanso automático de 120s (2:00 min) tras completar la prueba rápida
    if (triggerRestSeconds && triggerRestSeconds > 0) {
      startRestTimer(
        triggerRestSeconds,
        restLabel || `${profiles[profileId].name} • Descanso post-prueba • Prepárate para la Serie 1`
      )
    }
  }

  const todayIso = getLocalDateKey()
  const isCompletedToday = deviceConfig.lastCompletedWorkoutDate === todayIso

  const handleFinishWorkoutSession = () => {
    if (conflicts.length) { setFinishBanner('Hay series pendientes de revisión. Confirma sus datos antes de guardarlas definitivamente en el historial.'); return }
    const recordedDate = getLocalDateKey()
    const newEntries: WorkoutHistoryEntry[] = []
    let sessionPrCount = 0
    const profilesToSave: ('user_1' | 'user_2')[] = ['user_1', 'user_2']

    if (Object.values(slotsState).some((slot) => profilesToSave.some((pid) =>
      slot.setsByProfile[pid].some((entry) => !entry.completed && entry.drops?.some((drop) => drop.completed))))) {
      setFinishBanner('Hay bajadas de peso registradas cuya serie principal sigue pendiente. Revisa y completa esa serie antes de finalizar; no descartaremos sus datos.')
      return
    }

    profilesToSave.forEach((pid) => {
      let totalVolKg = 0
      let completedCount = 0
      const completedExercises: CompletedExerciseRecord[] = []

      currentSession.slots.forEach((slot) => {
        const st = slotsState[slot.slotId]
        if (!st) return
        const prof = profiles[pid]
        const options = getProfileExerciseOptions(slot, prof, st.syncMode)
        const savedId = prof.activeVariantBySlot[slot.slotId]
        const activeVar = options.find((o) => o.id === savedId) || options[0]

        const stats = getCompletedSetStats(st.setsByProfile[pid])
        const doneSets = stats.completed
        const exVolume = stats.totalVolumeKg
        const exMaxWeight = stats.maxWeightKg
        const exBestReps = stats.bestSetReps
        completedCount += doneSets.length
        totalVolKg += exVolume

        if (doneSets.length > 0) {
          const estimated1RmToday = stats.estimated1RmKg
          const prevHistoryWeights = history
            .filter((h) => h.profileId === pid && !h.isSampleData && h.id !== `${workoutId}-${pid}`)
            .flatMap((h) => h.exercises)
            .filter((ex) => ex.variantId === activeVar.id)
            .map((ex) => ex.maxWeightKg)
          const prevBestWeight =
            prevHistoryWeights.length > 0 ? Math.max(...prevHistoryWeights) : 0
          const calibrated1Rm = prof.estimated1RMByVariant[activeVar.id] || 0

          if (
            (prevBestWeight > 0 && exMaxWeight > prevBestWeight + 0.2) ||
            (calibrated1Rm > 0 && estimated1RmToday > calibrated1Rm + 1.0)
          ) {
            sessionPrCount += 1
          }

          completedExercises.push({
            slotId: slot.slotId,
            variantId: activeVar.id,
            variantName: activeVar.name,
            muscleGroup: activeVar.muscleGroup,
            equipment: activeVar.equipment,
            technique: st.techniqueByProfile[pid],
            maxWeightKg: exMaxWeight,
            estimated1RmKg: estimated1RmToday,
            totalVolumeKg: Number(exVolume.toFixed(2)),
            bestSetReps: exBestReps,
            sets: doneSets
          })
        }
      })

      if (completedCount > 0) {
        newEntries.push({
          id: `${workoutId}-${pid}`,
          date: recordedDate,
          sessionId: currentSession.id,
          sessionCode: currentSession.code,
          sessionTitle: currentSession.title,
          profileId: pid,
          totalVolumeKg: Number(totalVolKg.toFixed(2)),
          completedSets: completedCount,
          durationMinutes: getWorkoutDuration(),
          durationSource: 'measured',
          exercises: completedExercises
        })
      }
    })

    if (newEntries.length === 0) {
      setFinishBanner('Marca al menos 1 serie completada (✓) antes de finalizar.')
      setTimeout(() => setFinishBanner(null), 3500)
      return
    }

    if (workspace.room?.workoutId === workoutId) {
      void publicRoom.requestClosure(recordedDate, getWorkoutDuration()).then((error) => {
        if (!error) setFinishBanner('Entrenamiento terminado en este teléfono. El cierre queda pendiente de la confirmación de tu pareja.')
      })
      return
    }

    const entryIds = new Set(newEntries.map((entry) => entry.id))
    const nextHistory = [...history.filter((entry) => !entryIds.has(entry.id)), ...newEntries]
    setHistory(nextHistory)
    if (!saveHistory(nextHistory)) {
      setFinishBanner('No se pudo guardar el historial en este dispositivo. Conservamos la sesión abierta: exporta una copia o libera espacio y vuelve a finalizar.')
      return
    }

    // V1.6-08: Disparar animación de Cierre de Sesión Juntos (04-session-complete-duo.mp4) con mención de PRs si aplica
    const prBadgeSuffix =
      sessionPrCount > 0
        ? ` • 🏆 ¡${sessionPrCount} ${sessionPrCount === 1 ? 'nuevo PR registrado' : 'nuevos PRs registrados'} hoy!`
        : ' • ¡Día sumado a la racha!'

    triggerKineoTransition(
      'session_complete_duo',
      `Sesión ${currentSession.code} guardada en el historial${prBadgeSuffix}`
    )

    const coreOrder = ['session-a', 'session-b', 'session-c', 'session-d']
    const currentIdx = coreOrder.indexOf(currentSession.id)
    const nextSessionId =
      currentIdx >= 0 ? coreOrder[(currentIdx + 1) % coreOrder.length] : 'session-a'

    setDeviceConfig((prev) => ({
      ...prev,
      lastCompletedWorkoutDate: recordedDate,
      lastCompletedSessionCode: currentSession.code
    }))
    completeWorkout(nextSessionId)
  }

  if (!deviceConfig.onboardingCompleted) {
    return (
      <><StorageNotice />{onboardingError && <p role="alert" className="p-3 text-amber-300">{onboardingError}</p>}<OnboardingWizard
        initialProfiles={profiles}
        initialUnit={weightUnit}
        onComplete={(updatedProfiles, updatedConfig, chosenUnit) => {
          const error = initializeOnboarding(updatedProfiles, updatedConfig.primaryProfileId)
          if (error) { setOnboardingError(error); return }
          setOnboardingError('')
          setProfiles(updatedProfiles)
          setDeviceConfig(updatedConfig)
          setWeightUnit(chosenUnit)
        }}
      /></>
    )
  }

  const primaryPid = deviceConfig.primaryProfileId
  const secondaryPid: 'user_1' | 'user_2' = primaryPid === 'user_1' ? 'user_2' : 'user_1'

  const getLiveStats = (pid: 'user_1' | 'user_2') => {
    return getDraftLiveStats(workspace.drafts[activeSessionId], pid, currentSession.slots.map((slot) => slot.slotId))
  }

  const statsPrimary = getLiveStats(primaryPid)
  const statsSecondary = getLiveStats(secondaryPid)
  const hasSampleData = history.some((h) => h.isSampleData)
  const showRoomIndicator = deviceConfig.coupleModeEnabled || !!workspace.room || !!publicRoom.pendingCode || !!publicRoom.invitation
  const roomStatus = roomIndicator(!!workspace.room, publicRoom.enabled, publicRoom.transport, publicRoom.pairing,
    !!publicRoom.pendingCode || !!publicRoom.invitation)

  return (
    <div className="min-h-screen bg-[#0B090E] text-white flex flex-col">
      {/* V1.6-08: Overlay de Transición Animada (Touch-to-Skip, 1.35x, mode-blend) */}
      <TransitionOverlay
        activeTransition={activeTransition}
        onDismiss={() => setActiveTransition(null)}
      />

      {/* Kineo Ascent header */}
      <header className="sticky top-0 z-30 bg-[#0B090E]/95 backdrop-blur-md border-b border-[#2A2533] px-3 sm:px-6 py-2.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 256 256" className="w-7 h-7" aria-hidden="true">
              <defs>
                <linearGradient
                  id="ascent-energy"
                  gradientUnits="userSpaceOnUse"
                  x1="66"
                  y1="190"
                  x2="190"
                  y2="60"
                >
                  <stop stopColor={profiles.user_1.accentColor || '#FF5500'} />
                  <stop offset="1" stopColor={profiles.user_2.accentColor || '#8B5CF6'} />
                </linearGradient>
              </defs>
              <path
                fill="url(#ascent-energy)"
                d="M73 80H106L102 125 148 85 140 101 151 93 162 77H144L202 56 186 112 181 97 133 137 183 200H145L100 147 94 200H60Z"
              />
            </svg>
            <span className="font-display text-2xl leading-none">KINEO</span>
          </div>

          <div className="flex items-center gap-2">
            {showRoomIndicator && <>
              <button type="button" data-od-id="room-connection-indicator" onClick={() => setActiveTab('settings')}
                aria-label={`${roomStatus.label}. Abrir ajustes de sala`} title={roomStatus.label}
                className="min-h-11 min-w-11 flex items-center justify-center rounded-lg border border-[#2A2533] bg-[#14111A]">
                <span aria-hidden="true" className={`w-3 h-3 rounded-full ${roomStatus.tone === 'connected' ? 'bg-[#10B981]' : roomStatus.tone === 'waiting' ? 'bg-amber-400' : 'bg-[#A09BA8]'}`} />
              </button>
              <span className="sr-only" role="status" aria-live="polite">{roomStatus.label}</span>
            </>}
            {deviceConfig.coupleModeEnabled && (
              <div className="flex items-center bg-[#14111A] border border-[#2A2533] rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setActiveProfileId(primaryPid)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase font-mono transition-all ${
                    activeProfileId === primaryPid ? 'theme-bg' : 'text-[#A09BA8]'
                  }`}
                >
                  {profiles[primaryPid].name.trim() || 'Titular'}
                </button>
                <button
                  type="button"
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
              type="button"
              onClick={() => setWeightUnit((u) => (u === 'kg' ? 'lb' : 'kg'))}
              className="px-2 py-1.5 rounded-lg bg-[#14111A] border border-[#2A2533] text-[11px] font-bold font-mono text-white"
            >
              {weightUnit.toUpperCase()} ⇄
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 pt-3">
        <StorageNotice />
        {journalError && <p role="alert" className="p-3 mb-3 rounded-md border border-amber-400 bg-[#14111A] text-sm text-amber-200">{journalError}</p>}
        {finishBanner && <div role="status" className="p-3 mb-3 rounded-md bg-amber-500/20 border border-amber-400 text-amber-200 text-xs text-center">{finishBanner}</div>}
        <SeriesConflictReview conflicts={conflicts} profiles={profiles} activeProfileId={activeProfileId}
          deviceId={workspace.deviceId!} weightUnit={weightUnit}
          slotNames={Object.fromEntries(currentSession.slots.flatMap((slot) => (['user_1', 'user_2'] as const).map((profileId) => {
            const profile = profiles[profileId]
            const options = getProfileExerciseOptions(slot, profile, slotsState[slot.slotId]?.syncMode || slot.syncMode)
            const variant = options.find((item) => item.id === profile.activeVariantBySlot[slot.slotId]) || options[0]
            return [`${slot.slotId}-${profileId}`, variant.name]
          })))}
          onSelectProfile={setActiveProfileId} onResolve={resolveConflict} />
        {/* TAB 1: ENTRENAR */}
        {activeTab === 'workout' && (
          <div className="space-y-4 pb-44">
            {/* STATE A: COMPLETED TODAY -> WAIT UNTIL TOMORROW */}
            {workspace.room?.closure && workspace.room.workoutId === workoutId ? (
              <div className="space-y-3" data-od-id="closure-exercise-review">
                <div className="rounded-[10px] bg-[#14111A] border border-[#2A2533] p-4 space-y-2">
                  <h2 className="font-display text-2xl text-white">Revisar sesión {currentSession.code}</h2>
                  <p className="text-sm text-[#E2DFEA]">Selecciona un perfil arriba y abre cada ejercicio para revisar sus series.</p>
                  {workspace.room.closure.phase === 'requested' && workspace.room.closure.initiator !== workspace.deviceId
                    ? <p className="text-xs text-[#A09BA8]">Puedes corregir pesos, repeticiones y series. Confirma cada edición y espera a que se sincronice antes de confirmar el cierre.</p>
                    : <p className="text-xs text-[#A09BA8]">{workspace.room.closure.phase === 'requested' ? 'Tu pareja puede corregir las series mientras revisa el cierre.' : 'Esta revisión ya no admite cambios.'}</p>}
                </div>
                <div className="space-y-2.5">
                  {currentSession.slots.map((slot) => {
                    const st = slotsState[slot.slotId]
                    if (!st) return null
                    const editable = workspace.room!.closure!.phase === 'requested' && workspace.room!.closure!.initiator !== workspace.deviceId
                    return <ExerciseSlotCard key={slot.slotId} slot={slot} isExpanded={expandedSlotId === slot.slotId}
                      onToggleExpand={() => setExpandedSlotId((prev) => prev === slot.slotId ? null : slot.slotId)}
                      profiles={profiles} primaryProfileId={primaryPid} activeProfileId={activeProfileId}
                      coupleModeEnabled={deviceConfig.coupleModeEnabled} weightUnit={weightUnit} history={history}
                      syncMode={st.syncMode} techniqueByProfile={st.techniqueByProfile} setsByProfile={st.setsByProfile}
                      conflictedSetKeys={conflictedSetKeys} reviewMode reviewReadOnly={!editable} onPendingEditsChange={onReviewPendingEdit}
                      onToggleSyncMode={handleToggleSyncMode} onSelectVariant={handleSelectVariant} onChangeTechnique={handleChangeTechnique}
                      onUpdateSet={handleUpdateSet} onAddSet={handleAddSet} onDeleteSet={handleDeleteSet}
                      onSaveQuickStrengthTest={handleSaveIdealWeight} onOpenCalculatorForVariant={() => {}} onOpenGlossaryTopic={() => {}} />
                  })}
                </div>
                {workspace.room.closure.phase === 'requested' && workspace.room.closure.initiator !== workspace.deviceId && <div className="rounded-[10px] bg-[#14111A] border border-[#2A2533] p-4 space-y-3">
                  <p role="status" className="text-sm text-[#E2DFEA]">{pendingReviewCount ? 'Confirma o cancela las ediciones pendientes.' : publicRoom.closureReadiness === 'ready' ? 'Revisa ambos perfiles y confirma cuando los datos sean correctos.' : publicRoom.closureReadiness === 'conflict' ? 'Resuelve las series en revisión antes de confirmar.' : 'Esperando a que ambos teléfonos sincronicen los cambios.'}</p>
                  <button data-od-id="room-confirm-closure" type="button" disabled={pendingReviewCount > 0 || publicRoom.closureReadiness !== 'ready'}
                    onClick={() => { if (!pendingReviewEdits.current.size) void publicRoom.confirmClosure() }}
                    className="solar-btn theme-bg min-h-11 px-4 py-2 rounded-lg text-base disabled:opacity-40">Confirmar mis resultados</button>
                </div>}
                <details className="rounded-[10px] bg-[#14111A] border border-[#2A2533] p-4 text-sm">
                  <summary className="cursor-pointer min-h-11">Ir a otra rutina</summary>
                  <div className="flex flex-wrap gap-2">{mesocycle.sessions.filter((session) => session.id !== activeSessionId).map((session) => <button
                    key={session.id} type="button" onClick={() => setActiveSessionId(session.id)}
                    className="min-h-11 px-3 rounded-lg border theme-border theme-text">Sesión {session.code}</button>)}</div>
                </details>
              </div>
            ) : isCompletedToday && !isWorkoutStarted ? (
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
                      type="button"
                      onClick={() => setActiveTab('progress')}
                      className="solar-btn theme-bg px-4 py-2.5 rounded-[9px] text-base flex items-center gap-2"
                    >
                      <BarChart3 className="w-4 h-4" />
                      Ver Progreso
                    </button>
                    <button
                      type="button"
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
                          type="button"
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

                  {/* V1.6-11: Quick access to Guided Cardio protocol */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-md bg-[#0B090E] border border-[#2A2533]">
                    <span className="font-mono text-[10px] text-[#C7C3D1] flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 theme-text shrink-0" />
                      <span>
                        <strong>Cardio Recomendado:</strong> 5 min suave al inicio o 15–20 min con
                        inclinación (%) al final.
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setHighlightedGlossaryId(null)
                        setSettingsSubTab('guide')
                        setActiveTab('settings')
                      }}
                      className="font-mono text-[10px] font-bold uppercase theme-text hover:underline shrink-0"
                    >
                      Ver Velocidad + % ↗
                    </button>
                  </div>

                  <button
                    type="button"
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
                      type="button"
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
                        conflictedSetKeys={conflictedSetKeys}
                        onToggleSyncMode={handleToggleSyncMode}
                        onSelectVariant={handleSelectVariant}
                        onChangeTechnique={handleChangeTechnique}
                        onUpdateSet={handleUpdateSet}
                        onAddSet={handleAddSet}
                        onDeleteSet={handleDeleteSet}
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
                    type="button"
                    onClick={handleFinishWorkoutSession}
                    disabled={conflicts.length > 0}
                    className="solar-btn theme-bg w-full sm:w-auto px-5 py-2.5 rounded-[9px] text-lg flex items-center justify-center gap-2 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Finalizar y Guardar Sesión {currentSession.code}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

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
          <>
          {(deviceConfig.coupleModeEnabled || workspace.room || publicRoom.pendingCode || publicRoom.invitation) && <PublicRoomPanel connection={publicRoom} sessions={mesocycle.sessions}
          selectedSessionId={activeSessionId} selectSession={setActiveSessionId} profiles={profiles} workspace={workspace} weightUnit={weightUnit}
          onReviewClosure={() => {
            const sessionId = Object.values(workspace.drafts).find((draft) => draft.id === workspace.room?.workoutId)?.sessionId
            if (sessionId) { setActiveSessionId(sessionId); setActiveTab('workout') }
          }} />}
          <SettingsAndMesocycle
            key={profileRevision}
            profiles={profiles}
            deviceConfig={deviceConfig}
            mesocycle={mesocycle}
            weightUnit={weightUnit}
            activeProfileId={activeProfileId}
            onSelectActiveProfile={setActiveProfileId}
            pendingOperations={pendingOperations}
            initialSubTab={settingsSubTab}
            calculatorPreselect={calculatorPreselect}
            highlightedGlossaryId={highlightedGlossaryId}
            hasSampleData={hasSampleData}
            onUpdateProfiles={setProfiles}
            profileRemovalMessage={profileRemovalMessage}
            onDeleteCompanionData={() => {
              const cleaned = removeCompanionData({ config: deviceConfig, profiles, history, workspace })
              const result = persistCompanionRemoval(cleaned)
              if (!result.applied) {
                setProfileRemovalMessage('No se ha aplicado el borrado porque hay datos locales inaccesibles o incompatibles. Revisa el aviso de almacenamiento y exporta una copia antes de continuar.')
                return
              }
              setProfiles(cleaned.profiles)
              setHistory(cleaned.history)
              setDeviceConfig(cleaned.config)
              replaceWorkspace(cleaned.workspace)
              setCalculatorPreselect(null)
              setActiveTransition(null)
              setFinishBanner(null)
              setProfileRevision((previous) => previous + 1)
              setProfileRemovalMessage(result.persisted
                ? 'Datos del compañero eliminados de este móvil. Tus registros se conservan. Las copias exportadas y otros teléfonos no se han modificado.'
                : 'El borrado no se ha completado en el almacenamiento. La vista ya no muestra los datos del compañero, pero podrían reaparecer al recargar. Reintenta el guardado desde el aviso de almacenamiento antes de cerrar.')
            }}
            onUpdateDeviceConfig={setDeviceConfig}
            onUpdateMesocycle={(updated) => {
              if (updated.sessions !== mesocycle.sessions && hasRecordedWorkouts) {
                setFinishBanner('Finaliza las sesiones con series registradas antes de restaurar la rutina.')
                return
              }
              setMesocycle(updated)
            }}
            onSaveIdealWeight={handleSaveIdealWeight}
            onClearSampleHistory={() =>
              setHistory((prev) => prev.filter((x) => !x.isSampleData))
            }
            onResetMesocycle={() => { if (!hasRecordedWorkouts) resetWorkouts() }}
            onReopenOnboarding={() => {
              if (hasRecordedWorkouts) {
                setFinishBanner('Finaliza las sesiones con series registradas antes de reiniciar la configuración.')
                return
              }
              setDeviceConfig({ ...deviceConfig, onboardingCompleted: false })
            }}
          />
          </>
        )}
      </main>

      <RestTimerBar
        secondsLeft={restSecondsLeft}
        totalSeconds={restTotalSeconds}
        isRunning={restIsRunning}
        label={restLabel}
        onTogglePause={toggleRestPause}
        onAdjustSeconds={adjustRestSeconds}
        onReset={resetRestTimer}
        onSkip={skipRestTimer}
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
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center py-2 rounded-xl transition-all ${
                  active
                    ? 'theme-text theme-soft-bg font-extrabold border theme-border'
                    : 'text-[#A09BA8] hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-mono text-[10px] uppercase tracking-[0.06em] mt-0.5">
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
export default App
