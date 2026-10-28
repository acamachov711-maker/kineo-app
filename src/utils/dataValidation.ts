import type { DeviceConfig, MesocyclePlan, SetEntry, UserProfile, WorkoutHistoryEntry } from '../types'
import type { SlotLiveState } from '../services/syncService'
import type { WorkoutDraft, WorkoutWorkspace } from './workoutState'
import { isSeriesJournal } from '../services/seriesSync'
import { hasCoherentJournal } from './workoutJournal'
import { isRoomIdentifier } from '../services/mqttRoomProtocol'
import { isSharedRoomProfile } from '../services/sharedRoomProfile'
import { isRoomClosure } from '../services/roomClosure'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
const isText = (value: unknown): value is string => typeof value === 'string'
const isProfileId = (value: unknown) => value === 'user_1' || value === 'user_2'
const isTechnique = (value: unknown) => ['normal', 'pyramid_asc', 'pyramid_desc', 'dropset', 'failure'].includes(String(value))
const isStringMap = (value: unknown) => isRecord(value) && Object.values(value).every(isText)
const isNumberMap = (value: unknown) => isRecord(value) && Object.values(value).every(isNumber)
const isDateKey = (value: unknown) => {
  if (!isText(value) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export function isDeviceConfig(value: unknown): value is DeviceConfig {
  return isRecord(value) && typeof value.onboardingCompleted === 'boolean' &&
    isProfileId(value.primaryProfileId) && typeof value.coupleModeEnabled === 'boolean' &&
    (value.syncRoomCode === undefined || isText(value.syncRoomCode)) &&
    (value.lastCompletedWorkoutDate === undefined || isDateKey(value.lastCompletedWorkoutDate))
}

export function isProfile(value: unknown): value is UserProfile {
  return isRecord(value) && isProfileId(value.id) && isText(value.name) &&
    ['male', 'female', 'other'].includes(String(value.gender)) &&
    typeof value.isDeviceOwner === 'boolean' && isText(value.goal) && isText(value.level) &&
    isText(value.accentColor) && isText(value.badgeColor) &&
    isStringMap(value.activeVariantBySlot) && isNumberMap(value.estimated1RMByVariant) &&
    ['age', 'bodyWeightKg', 'heightCm'].every((key) => value[key] === undefined || isNumber(value[key]))
}

export function isProfiles(value: unknown): value is Record<'user_1' | 'user_2', UserProfile> {
  return isRecord(value) && isProfile(value.user_1) && value.user_1.id === 'user_1' &&
    isProfile(value.user_2) && value.user_2.id === 'user_2'
}

export function isSetEntry(value: unknown): value is SetEntry {
  return isRecord(value) && isNumber(value.setNumber) && Number.isInteger(value.setNumber) && value.setNumber > 0 &&
    (value.id === undefined || (isText(value.id) && value.id.length > 0 && value.id.length <= 512)) &&
    isText(value.targetReps) && isNumber(value.weightKg) && isNumber(value.actualReps) &&
    isNumber(value.rir) && typeof value.completed === 'boolean' &&
    (value.drops === undefined || (Array.isArray(value.drops) && value.drops.every((drop) =>
      isRecord(drop) && isText(drop.id) && isNumber(drop.weightKg) && isNumber(drop.reps) && typeof drop.completed === 'boolean')))
}

export function isSlotState(value: unknown): value is SlotLiveState {
  return isRecord(value) && (value.syncMode === 'shared' || value.syncMode === 'individual') &&
    isRecord(value.techniqueByProfile) && isRecord(value.setsByProfile) &&
    ['user_1', 'user_2'].every((profileId) =>
      isTechnique((value.techniqueByProfile as Record<string, unknown>)[profileId]) &&
      Array.isArray((value.setsByProfile as Record<string, unknown>)[profileId]) &&
      ((value.setsByProfile as Record<string, unknown>)[profileId] as unknown[]).every(isSetEntry))
}

const isVariant = (value: unknown): boolean => isRecord(value) &&
  ['id', 'name', 'equipment', 'muscleGroup', 'demoFolderId', 'cues'].every((key) => isText(value[key]))

export function isMesocycle(value: unknown): value is MesocyclePlan {
  return isRecord(value) && isText(value.id) && isText(value.name) && isText(value.goalDescription) &&
    isDateKey(value.startDate) && isNumber(value.durationWeeks) && isNumber(value.currentWeek) &&
    isNumber(value.recommendedDaysMin) && isNumber(value.recommendedDaysMax) &&
    Array.isArray(value.sessions) && value.sessions.length > 0 && value.sessions.every((session) =>
      isRecord(session) && isText(session.id) && /^[A-E]$/.test(String(session.code)) &&
      isText(session.title) && isText(session.subtitle) && isNumber(session.estimatedMinutes) &&
      Array.isArray(session.focusTags) && session.focusTags.every(isText) &&
      Array.isArray(session.slots) && session.slots.every((slot) => isRecord(slot) &&
        isText(slot.slotId) && isNumber(slot.order) && isNumber(slot.restSeconds) &&
        isTechnique(slot.defaultTechnique) && ['shared', 'individual'].includes(String(slot.syncMode)) &&
        isNumber(slot.defaultSetsCount) && slot.defaultSetsCount > 0 && isText(slot.defaultTargetReps) &&
        isText(slot.notes) && isVariant(slot.primaryExercise) &&
        Array.isArray(slot.alternatives) && slot.alternatives.length === 2 && slot.alternatives.every(isVariant) &&
        (slot.femaleFocusedPrimary === undefined || isVariant(slot.femaleFocusedPrimary)) &&
        (slot.femaleFocusedAlternatives === undefined || (Array.isArray(slot.femaleFocusedAlternatives) &&
          slot.femaleFocusedAlternatives.length === 2 && slot.femaleFocusedAlternatives.every(isVariant)))))
}

export function isHistory(value: unknown): value is WorkoutHistoryEntry[] {
  return Array.isArray(value) && value.every((entry) => isRecord(entry) && isText(entry.id) &&
    isDateKey(entry.date) && isProfileId(entry.profileId) &&
    ['sessionId', 'sessionCode', 'sessionTitle'].every((key) => isText(entry[key])) &&
    isNumber(entry.totalVolumeKg) && isNumber(entry.completedSets) && isNumber(entry.durationMinutes) &&
    (entry.isSampleData === undefined || typeof entry.isSampleData === 'boolean') &&
    (entry.durationSource === undefined || ['measured', 'legacy_estimate'].includes(String(entry.durationSource))) &&
    Array.isArray(entry.exercises) && entry.exercises.every((exercise) => isRecord(exercise) &&
      ['slotId', 'variantId', 'variantName', 'muscleGroup', 'equipment'].every((key) => isText(exercise[key])) &&
      isTechnique(exercise.technique) &&
      ['maxWeightKg', 'estimated1RmKg', 'totalVolumeKg', 'bestSetReps'].every((key) => isNumber(exercise[key])) &&
      Array.isArray(exercise.sets) && exercise.sets.every(isSetEntry)))
}

export function isWorkoutWorkspace(value: unknown): value is WorkoutWorkspace {
  return isRecord(value) && value.version === 1 && isText(value.activeSessionId) && isRecord(value.drafts) &&
    (value.deviceId === undefined || (isText(value.deviceId) && value.deviceId.length > 0)) &&
    (value.journalError === undefined || isText(value.journalError)) &&
    (value.room === undefined || (isRecord(value.room) && value.room.version === 1 &&
      ['host', 'guest'].includes(String(value.room.role)) && isRoomIdentifier(value.room.roomId) &&
      isRoomIdentifier(value.room.workoutId) && isRoomIdentifier(value.deviceId) &&
      isText(value.room.context) && value.room.context.length > 0 && value.room.context.length <= 64000 &&
      (value.room.profilesSwapped === undefined || typeof value.room.profilesSwapped === 'boolean') &&
      (value.room.role !== 'host' || !value.room.profilesSwapped) &&
      (value.room.ownerProfileId === undefined || isProfileId(value.room.ownerProfileId)) &&
      (value.room.peerOwnerId === undefined || isProfileId(value.room.peerOwnerId)) &&
      (value.room.ownerProfile === undefined || isSharedRoomProfile(value.room.ownerProfile)) &&
      (value.room.peerProfile === undefined || isSharedRoomProfile(value.room.peerProfile)) &&
      (value.room.peerReady === undefined || typeof value.room.peerReady === 'boolean') &&
      (value.room.peerApplied === undefined || typeof value.room.peerApplied === 'boolean') &&
      (value.room.closure === undefined || (isRoomClosure(value.room.closure) &&
        [value.deviceId, value.room.peerDeviceId].includes(value.room.closure.initiator) &&
        (!value.room.closure.delivered || value.room.closure.initiator === value.deviceId) && value.room.peerApplied === true)) &&
      ((value.room.ownerProfileId === undefined && value.room.peerOwnerId === undefined && value.room.ownerProfile === undefined && value.room.peerProfile === undefined && value.room.peerReady === undefined && value.room.peerApplied === undefined) ||
        (isProfileId(value.room.ownerProfileId) && isProfileId(value.room.peerOwnerId) && isSharedRoomProfile(value.room.ownerProfile) && isSharedRoomProfile(value.room.peerProfile) && typeof value.room.peerReady === 'boolean' && typeof value.room.peerApplied === 'boolean' && (!value.room.peerApplied || value.room.peerReady))) &&
      (value.room.role !== 'guest' || isRoomIdentifier(value.room.peerDeviceId)) &&
      (value.room.peerDeviceId === undefined || (isRoomIdentifier(value.room.peerDeviceId) && value.room.peerDeviceId !== value.deviceId)) &&
      Object.values(value.drafts).some((draft) => isRecord(draft) && draft.id === (value.room as Record<string, unknown>).workoutId))) &&
    (value.archivedJournals === undefined || (Array.isArray(value.archivedJournals) && value.archivedJournals.every(isSeriesJournal))) &&
    Object.entries(value.drafts).every(([sessionId, draft]) => isRecord(draft) && isText(draft.id) && draft.sessionId === sessionId &&
      (draft.journal === undefined || (isSeriesJournal(draft.journal) && draft.journal.workoutId === draft.id)) &&
      (draft.receivedJournal === undefined || (isSeriesJournal(draft.receivedJournal) && draft.receivedJournal.workoutId === draft.id && draft.journal !== undefined)) &&
      isRecord(draft.slotsState) && Object.values(draft.slotsState).every(isSlotState) &&
      isProfileId(draft.activeProfileId) && (draft.expandedSlotId === null || isText(draft.expandedSlotId)) &&
      typeof draft.isWorkoutStarted === 'boolean' && isRecord(draft.clock) && isNumber(draft.clock.elapsedMs) &&
      (draft.clock.runningSince === null || isNumber(draft.clock.runningSince)) &&
      isRecord(draft.rest) && isNumber(draft.rest.secondsLeft) && isNumber(draft.rest.totalSeconds) &&
      typeof draft.rest.isRunning === 'boolean' && isText(draft.rest.label) &&
      (draft.rest.endsAt === null || isNumber(draft.rest.endsAt)) && hasCoherentJournal(draft as unknown as WorkoutDraft))
}
