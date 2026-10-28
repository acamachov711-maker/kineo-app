import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { UserProfile, WorkoutSessionTemplate } from '../types'
import { loadWorkoutWorkspace, saveWorkoutWorkspace } from '../services/storageService'
import { createWorkoutDraft, EMPTY_REST, getDurationMinutes, getRestSeconds, setClockRunning, hasRecordedSlot } from '../utils/workoutState'
import type { RestState, WorkoutDraft, WorkoutWorkspace } from '../utils/workoutState'
import { applyDraftUpdate, archiveJournal, countPendingOperations, getDraftConflicts, prepareDraft, prepareOnboardingWorkspace, prepareWorkspace, resolveDraftConflict } from '../utils/workoutJournal'
import { createWorkoutRoomStore } from '../services/workoutRoomStore'
import type { SeriesTarget, SeriesValue } from '../services/seriesSync'

export function useWorkoutSession(
  sessions: WorkoutSessionTemplate[],
  profiles: Record<'user_1' | 'user_2', UserProfile>,
  primaryProfileId: 'user_1' | 'user_2'
) {
  const newDraft = useCallback((sessionId: string) => {
    const session = sessions.find((item) => item.id === sessionId) || sessions[0]
    return prepareDraft(createWorkoutDraft(session.id, session.slots, profiles, primaryProfileId))
  }, [sessions, profiles, primaryProfileId])

  const [workspace, setWorkspaceState] = useState<WorkoutWorkspace>(() => {
    const saved = loadWorkoutWorkspace()
    const activeSessionId = sessions.some((session) => session.id === saved.activeSessionId)
      ? saved.activeSessionId : sessions[0].id
    return prepareWorkspace({ ...saved, activeSessionId, drafts: {
      ...saved.drafts,
      [activeSessionId]: saved.drafts[activeSessionId] || newDraft(activeSessionId)
    } })
  })
  const workspaceRef = useRef(workspace)
  const setWorkspace: Dispatch<SetStateAction<WorkoutWorkspace>> = useCallback((update) => {
    const previous = workspaceRef.current
    const next = typeof update === 'function' ? update(previous) : update
    workspaceRef.current = next
    setWorkspaceState(next)
  }, [])
  const commitWorkspace = useCallback((next: WorkoutWorkspace, expected: WorkoutWorkspace) => {
    if (workspaceRef.current !== expected || !saveWorkoutWorkspace(next, false)) return false
    workspaceRef.current = next
    setWorkspaceState(next)
    return true
  }, [])
  const draft = workspace.drafts[workspace.activeSessionId]
  const conflicts = getDraftConflicts(draft)
  const [now, setNow] = useState(Date.now)

  useLayoutEffect(() => {
    saveWorkoutWorkspace(workspaceRef.current)
  }, [workspace])

  useEffect(() => {
    const flush = () => { saveWorkoutWorkspace(workspaceRef.current) }
    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
  }, [workspace])

  useEffect(() => {
    const refresh = () => setNow(Date.now())
    const interval = draft.rest.isRunning ? window.setInterval(refresh, 500) : undefined
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('pageshow', refresh)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('pageshow', refresh)
    }
  }, [draft.rest.isRunning, workspace.activeSessionId])

  const updateDraft = useCallback((update: (previous: WorkoutDraft) => WorkoutDraft) => {
    setWorkspace((previous) => applyDraftUpdate(previous, update(previous.drafts[previous.activeSessionId])))
    setNow(Date.now())
  }, [])

  useEffect(() => {
    if (draft.rest.isRunning && getRestSeconds(draft.rest, now) === 0) {
      updateDraft((previous) => ({ ...previous, rest: {
        ...previous.rest, secondsLeft: 0, isRunning: false, endsAt: null
      } }))
    }
  }, [draft.rest, now, updateDraft])

  const fieldSetter = <Key extends keyof WorkoutDraft>(key: Key): Dispatch<SetStateAction<WorkoutDraft[Key]>> =>
    (update) => updateDraft((previous) => ({ ...previous, [key]: typeof update === 'function'
      ? (update as (value: WorkoutDraft[Key]) => WorkoutDraft[Key])(previous[key]) : update }))

  const setIsWorkoutStarted: Dispatch<SetStateAction<boolean>> = (update) => updateDraft((previous) => {
    const running = typeof update === 'function' ? update(previous.isWorkoutStarted) : update
    return { ...previous, isWorkoutStarted: running, clock: setClockRunning(previous.clock, running) }
  })

  const setActiveSessionId = (sessionId: string) => {
    if (!sessions.some((session) => session.id === sessionId)) return
    setWorkspace((previous) => {
      if (previous.activeSessionId === sessionId) return previous
      const current = previous.drafts[previous.activeSessionId]
      return { ...previous, activeSessionId: sessionId, drafts: {
        ...previous.drafts,
        [previous.activeSessionId]: { ...current, isWorkoutStarted: false, clock: setClockRunning(current.clock, false) },
        [sessionId]: previous.drafts[sessionId] || newDraft(sessionId)
      } }
    })
    setNow(Date.now())
  }

  const updateRest = (update: (previous: RestState) => RestState) => updateDraft((previous) => ({ ...previous, rest: update(previous.rest) }))
  const startRestTimer = (seconds: number, label: string) => updateRest(() => ({
    secondsLeft: seconds, totalSeconds: seconds, isRunning: seconds > 0,
    endsAt: Date.now() + seconds * 1000, label
  }))
  const toggleRestPause = () => updateRest((previous) => {
    const secondsLeft = getRestSeconds(previous)
    return { ...previous, secondsLeft, isRunning: !previous.isRunning && secondsLeft > 0,
      endsAt: previous.isRunning ? null : Date.now() + secondsLeft * 1000 }
  })
  const adjustRestSeconds = (delta: number) => updateRest((previous) => {
    const secondsLeft = Math.max(0, getRestSeconds(previous) + delta)
    return { ...previous, secondsLeft, totalSeconds: Math.max(0, previous.totalSeconds + delta),
      isRunning: previous.isRunning && secondsLeft > 0,
      endsAt: previous.isRunning ? Date.now() + secondsLeft * 1000 : null }
  })
  const resetRestTimer = () => updateRest((previous) => ({ ...previous, secondsLeft: previous.totalSeconds,
    isRunning: previous.totalSeconds > 0, endsAt: Date.now() + previous.totalSeconds * 1000 }))
  const skipRestTimer = () => updateRest(() => ({ ...EMPTY_REST }))

  const completeWorkout = (nextSessionId: string) => {
    setWorkspace((previous) => {
      if (previous.room && previous.drafts[previous.activeSessionId]?.id === previous.room.workoutId) return previous
      if (getDraftConflicts(previous.drafts[previous.activeSessionId]).length) return previous
      const drafts = { ...previous.drafts }
      const archivedJournals = archiveJournal(previous.archivedJournals || [], drafts[previous.activeSessionId])
      delete drafts[previous.activeSessionId]
      const next = drafts[nextSessionId] || newDraft(nextSessionId)
      drafts[nextSessionId] = { ...next, isWorkoutStarted: false, clock: setClockRunning(next.clock, false) }
      return { ...previous, journalError: undefined, activeSessionId: nextSessionId, drafts, archivedJournals }
    })
  }

  const resetWorkouts = () => setWorkspace((previous) => previous.room || Object.values(previous.drafts).some((item) => getDraftConflicts(item).length) ? previous : ({ ...previous, journalError: undefined,
    archivedJournals: Object.values(previous.drafts).reduce(archiveJournal, previous.archivedJournals || []), drafts: {
    [previous.activeSessionId]: newDraft(previous.activeSessionId)
  } }))

  const restSecondsLeft = getRestSeconds(draft.rest, now)
  const readWorkspace = useCallback(() => workspaceRef.current, [])
  return {
    workspace,
    readWorkspace,
    commitWorkspace,
    initializeOnboarding: (updatedProfiles: Record<'user_1' | 'user_2', UserProfile>, owner: 'user_1' | 'user_2') => {
      const previous = workspaceRef.current
      const session = sessions.find((item) => item.id === previous.activeSessionId)
      if (!session) return 'No se encuentra la rutina seleccionada.'
      try {
        const next = prepareOnboardingWorkspace(previous, session, updatedProfiles, owner)
        return commitWorkspace(next, previous) ? null : 'No se pudo guardar la configuración. Revisa el almacenamiento y vuelve a intentarlo.'
      } catch (error) {
        return error instanceof Error ? error.message : 'No se pudo preparar el entrenamiento.'
      }
    },
    conflicts,
    createRoomStore: (workoutId: string) => createWorkoutRoomStore(workoutId, () => workspaceRef.current, commitWorkspace),
    resolveConflict: (target: SeriesTarget, expectedHeads: string[], choices: Partial<SeriesValue>) => {
      const previous = workspaceRef.current
      const current = previous.drafts[previous.activeSessionId]
      try {
        const resolved = resolveDraftConflict(current, target, expectedHeads, choices, previous.deviceId!, current.activeProfileId)
        const next = { ...previous, journalError: undefined, drafts: { ...previous.drafts, [previous.activeSessionId]: resolved } }
        return commitWorkspace(next, previous) ? null : 'No se pudo guardar la confirmación. Las dos versiones siguen pendientes; libera espacio o descarga una copia y reintenta.'
      } catch (error) {
        return error instanceof Error ? error.message : 'No se ha confirmado la serie. Revisa de nuevo sus versiones.'
      }
    },
    replaceWorkspace: setWorkspace,
    pendingOperations: countPendingOperations(workspace),
    journalError: workspace.journalError,
    workoutId: draft.id,
    activeSessionId: workspace.activeSessionId,
    setActiveSessionId,
    slotsState: draft.slotsState,
    setSlotsState: fieldSetter('slotsState'),
    activeProfileId: draft.activeProfileId,
    setActiveProfileId: fieldSetter('activeProfileId'),
    expandedSlotId: draft.expandedSlotId,
    setExpandedSlotId: fieldSetter('expandedSlotId'),
    isWorkoutStarted: draft.isWorkoutStarted,
    setIsWorkoutStarted,
    restSecondsLeft,
    restTotalSeconds: draft.rest.totalSeconds,
    restIsRunning: draft.rest.isRunning && restSecondsLeft > 0,
    restLabel: draft.rest.label,
    startRestTimer,
    toggleRestPause,
    adjustRestSeconds,
    resetRestTimer,
    skipRestTimer,
    getWorkoutDuration: () => getDurationMinutes(draft.clock),
    completeWorkout,
    resetWorkouts,
    hasRecordedWorkouts: Object.values(workspace.drafts).some((item) => getDraftConflicts(item).length || Object.values(item.slotsState).some(hasRecordedSlot))
  }
}
