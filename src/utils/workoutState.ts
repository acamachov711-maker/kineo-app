import type { ExerciseSlot, SetEntry, UserProfile, WorkoutHistoryEntry } from '../types'
import type { SlotLiveState } from '../services/syncService'
import { buildPyramidSets, generateDropSubSets, getIdealWeightZones, calculateSafe1RM } from './fitnessMath'
import type { SeriesJournal } from '../services/seriesSync'
import { createId } from './identity'
import type { SharedRoomProfile } from '../services/sharedRoomProfile'
import type { RoomClosure } from '../services/roomClosure'

export interface WorkoutClock {
  elapsedMs: number
  runningSince: number | null
}

export interface RestState {
  secondsLeft: number
  totalSeconds: number
  isRunning: boolean
  endsAt: number | null
  label: string
}

export interface WorkoutDraft {
  id: string
  sessionId: string
  slotsState: Record<string, SlotLiveState>
  activeProfileId: 'user_1' | 'user_2'
  expandedSlotId: string | null
  isWorkoutStarted: boolean
  clock: WorkoutClock
  rest: RestState
  journal?: SeriesJournal
  receivedJournal?: SeriesJournal
}

export interface WorkoutWorkspace {
  version: 1
  activeSessionId: string
  drafts: Record<string, WorkoutDraft>
  deviceId?: string
  archivedJournals?: SeriesJournal[]
  journalError?: string
  room?: WorkoutRoomBinding
}

export interface WorkoutRoomBinding {
  version: 1
  role: 'host' | 'guest'
  roomId: string
  workoutId: string
  context: string
  peerDeviceId?: string
  profilesSwapped?: boolean
  ownerProfileId?: 'user_1' | 'user_2'
  peerOwnerId?: 'user_1' | 'user_2'
  ownerProfile?: SharedRoomProfile
  peerProfile?: SharedRoomProfile
  peerReady?: boolean
  peerApplied?: boolean
  closure?: RoomClosure
}

export const EMPTY_REST: RestState = {
  secondsLeft: 0, totalSeconds: 0, isRunning: false, endsAt: null, label: ''
}

export function hasRecordedSets(sets: SetEntry[]): boolean {
  return sets.some((entry) => entry.completed || entry.drops?.some((drop) => drop.completed))
}

export function hasRecordedSlot(slot: SlotLiveState): boolean {
  return hasRecordedSets(slot.setsByProfile.user_1) || hasRecordedSets(slot.setsByProfile.user_2)
}

export function getProfileExerciseOptions(slot: ExerciseSlot, profile: UserProfile, syncMode: SlotLiveState['syncMode']) {
  const preferred = syncMode === 'individual' && profile.gender === 'female' && slot.femaleFocusedPrimary
    ? [slot.femaleFocusedPrimary, ...(slot.femaleFocusedAlternatives || slot.alternatives)] : [slot.primaryExercise, ...slot.alternatives]
  const all = [slot.primaryExercise, ...slot.alternatives, ...(slot.femaleFocusedPrimary ? [slot.femaleFocusedPrimary] : []), ...(slot.femaleFocusedAlternatives || [])]
  const selected = all.find((variant) => variant.id === profile.activeVariantBySlot[slot.slotId])
  return selected && !preferred.some((variant) => variant.id === selected.id) ? [...preferred, selected] : preferred
}

export function buildSessionState(
  slots: ExerciseSlot[],
  profiles: Record<'user_1' | 'user_2', UserProfile>
): Record<string, SlotLiveState> {
  return Object.fromEntries(slots.map((slot) => {
    const buildSets = (profile: UserProfile): SetEntry[] => {
      const variant = slot.syncMode === 'individual' && profile.gender === 'female' && slot.femaleFocusedPrimary
        ? slot.femaleFocusedPrimary : slot.primaryExercise
      const variantId = profile.activeVariantBySlot[slot.slotId] || variant.id
      const oneRm = profile.estimated1RMByVariant[variantId] || 0
      const weightKg = getIdealWeightZones(oneRm).hypertrophyKg
      const sets = Array.from({ length: slot.defaultSetsCount }, (_, index) => ({
        setNumber: index + 1,
        targetReps: slot.defaultTargetReps,
        weightKg,
        actualReps: 10,
        rir: index === slot.defaultSetsCount - 1 ? 1 : 2,
        isFailure: slot.defaultTechnique === 'failure' && index === slot.defaultSetsCount - 1,
        completed: false,
        drops: slot.defaultTechnique === 'dropset' && index === slot.defaultSetsCount - 1
          ? generateDropSubSets(weightKg) : undefined
      }))
      return slot.defaultTechnique === 'pyramid_asc' || slot.defaultTechnique === 'pyramid_desc'
        ? buildPyramidSets(slot.defaultTechnique, oneRm, sets) : sets
    }
    return [slot.slotId, {
      syncMode: slot.syncMode,
      techniqueByProfile: { user_1: slot.defaultTechnique, user_2: slot.defaultTechnique },
      setsByProfile: { user_1: buildSets(profiles.user_1), user_2: buildSets(profiles.user_2) }
    }]
  }))
}

export function createWorkoutDraft(
  sessionId: string,
  slots: ExerciseSlot[],
  profiles: Record<'user_1' | 'user_2', UserProfile>,
  primaryProfileId: 'user_1' | 'user_2'
): WorkoutDraft {
  return {
    id: createId('workout'),
    sessionId,
    slotsState: buildSessionState(slots, profiles),
    activeProfileId: primaryProfileId,
    expandedSlotId: null,
    isWorkoutStarted: false,
    clock: { elapsedMs: 0, runningSince: null },
    rest: { ...EMPTY_REST }
  }
}

export function setClockRunning(clock: WorkoutClock, running: boolean, now = Date.now()): WorkoutClock {
  if (running) return clock.runningSince === null ? { ...clock, runningSince: now } : clock
  return { elapsedMs: getElapsedMs(clock, now), runningSince: null }
}

export function getElapsedMs(clock: WorkoutClock, now = Date.now()): number {
  return clock.elapsedMs + (clock.runningSince === null ? 0 : Math.max(0, now - clock.runningSince))
}

export function getDurationMinutes(clock: WorkoutClock, now = Date.now()): number {
  return Math.round(getElapsedMs(clock, now) / 6000) / 10
}

export function getRestSeconds(rest: RestState, now = Date.now()): number {
  return rest.isRunning && rest.endsAt !== null
    ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : rest.secondsLeft
}

export function recalibratePendingSets(sets: SetEntry[], oneRmKg: number, technique: SlotLiveState['techniqueByProfile']['user_1']): SetEntry[] {
  if (technique === 'pyramid_asc' || technique === 'pyramid_desc') {
    return buildPyramidSets(technique, oneRmKg, sets)
  }
  const weightKg = getIdealWeightZones(oneRmKg).hypertrophyKg
  return sets.map((entry, index) => hasRecordedSets([entry]) ? entry : {
    ...entry,
    weightKg,
    drops: technique === 'dropset' && index === sets.length - 1
      ? generateDropSubSets(weightKg) : entry.drops
  })
}

export function getCompletedSetStats(sets: SetEntry[]) {
  const completed = sets.filter((entry) => entry.completed)
  const bestSet = completed.reduce<SetEntry | null>((best, entry) =>
    !best || entry.weightKg > best.weightKg || (entry.weightKg === best.weightKg && entry.actualReps > best.actualReps)
      ? entry : best, null)
  return {
    completed,
    maxWeightKg: bestSet?.weightKg || 0,
    bestSetReps: bestSet?.actualReps || 0,
    estimated1RmKg: bestSet ? calculateSafe1RM(bestSet.weightKg, bestSet.actualReps, bestSet.rir) : 0,
    totalVolumeKg: completed.reduce((volume, entry) => volume + entry.weightKg * entry.actualReps +
      (entry.drops || []).reduce((subtotal, drop) => subtotal + (drop.completed ? drop.weightKg * drop.reps : 0), 0), 0)
  }
}

export function getVolumeChartData(history: WorkoutHistoryEntry[], convert: (weight: number) => number) {
  const entries = history.filter((entry) => !entry.isSampleData)
  return Array.from(new Set(entries.map((entry) => entry.date))).sort().map((date) => {
    const sum = (profileId: 'user_1' | 'user_2') => {
      const matches = entries.filter((entry) => entry.date === date && entry.profileId === profileId)
      return matches.length ? Math.round(convert(matches.reduce((total, entry) => total + entry.totalVolumeKg, 0))) : null
    }
    return { date, user_1: sum('user_1'), user_2: sum('user_2') }
  })
}
