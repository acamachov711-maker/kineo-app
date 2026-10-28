import type { MesocyclePlan, UserProfile, WorkoutHistoryEntry, WeightUnit, DeviceConfig } from '../types'
import { INITIAL_MESOCYCLE, INITIAL_PROFILES, INITIAL_HISTORY, INITIAL_DEVICE_CONFIG, ASCENT_COLOR_PALETTE } from '../data/initialData'
import { isDeviceConfig, isProfiles, isMesocycle, isHistory, isWorkoutWorkspace } from '../utils/dataValidation'
import type { WorkoutWorkspace } from '../utils/workoutState'
import type { LocalProfileData } from '../utils/companionData'

const KEYS = {
  DEVICE_CONFIG: 'kineo_device_config_v1_4',
  PROFILES: 'kineo_profiles_v1_4',
  MESOCYCLE: 'kineo_mesocycle_v1_4',
  HISTORY: 'kineo_history_v1_4',
  UNIT: 'kineo_weight_unit_v1_4',
  ACTIVE_SESSION_ID: 'kineo_active_session_id_v1_4',
  WORKOUT_WORKSPACE: 'kineo_workout_workspace_v1_7'
}

type StorageIssue = { key: string; kind: 'read' | 'write' | 'invalid' }
const listeners = new Set<() => void>()
const issues = new Map<string, StorageIssue>()
const blockedKeys = new Set<string>()
const pendingWrites = new Map<string, string>()
const originalValues = new Map<string, string>()
let snapshot: StorageIssue[] = []

function updateIssue(key: string, kind?: StorageIssue['kind']) {
  if (issues.get(key)?.kind === kind && (kind !== undefined || !issues.has(key))) return
  if (kind) issues.set(key, { key, kind })
  else issues.delete(key)
  snapshot = Array.from(issues.values())
  queueMicrotask(() => listeners.forEach((listener) => listener()))
}

export const subscribeStorage = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export const getStorageIssues = () => snapshot

function readValue(key: string): string | null {
  try {
    const value = localStorage.getItem(key)
    if (value !== null) originalValues.set(key, value)
    return value
  } catch {
    blockedKeys.add(key)
    updateIssue(key, 'read')
    return null
  }
}

function loadValue<Value>(key: string, fallback: Value, validate: (value: unknown) => value is Value): Value {
  const raw = readValue(key)
  if (raw === null) return JSON.parse(JSON.stringify(fallback)) as Value
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!validate(parsed)) throw new Error('invalid')
    return parsed
  } catch {
    blockedKeys.add(key)
    updateIssue(key, 'invalid')
    return JSON.parse(JSON.stringify(fallback)) as Value
  }
}

function writeValue(key: string, value: string, queueOnFailure = true): boolean {
  if (queueOnFailure) pendingWrites.set(key, value)
  if (blockedKeys.has(key)) return false
  try {
    localStorage.setItem(key, value)
    originalValues.set(key, value)
    pendingWrites.delete(key)
    updateIssue(key)
    return true
  } catch {
    updateIssue(key, 'write')
    return false
  }
}

export function retryStorageWrites(): boolean {
  let success = true
  for (const [key, value] of pendingWrites) {
    if (!writeValue(key, value)) success = false
  }
  return success && issues.size === 0
}

export function exportLocalData(): string {
  const stored: Record<string, string | null> = {}
  for (const key of Object.values(KEYS)) {
    stored[key] = readValue(key) ?? originalValues.get(key) ?? null
  }
  return JSON.stringify({ format: 'kineo-backup', version: 1, exportedAt: new Date().toISOString(), stored, pending: Object.fromEntries(pendingWrites) }, null, 2)
}

export function loadDeviceConfig(): DeviceConfig {
  return loadValue(KEYS.DEVICE_CONFIG, INITIAL_DEVICE_CONFIG, isDeviceConfig)
}
export function saveDeviceConfig(config: DeviceConfig, queueOnFailure = true): boolean {
  return writeValue(KEYS.DEVICE_CONFIG, JSON.stringify(config), queueOnFailure)
}

export function loadProfiles(): Record<'user_1' | 'user_2', UserProfile> {
  const parsed = loadValue(KEYS.PROFILES, INITIAL_PROFILES, isProfiles)
  const colors = new Set(ASCENT_COLOR_PALETTE.map((color) => color.hex.toUpperCase()))
  for (const profileId of ['user_1', 'user_2'] as const) {
    const profile = parsed[profileId]
    if (!colors.has(profile.accentColor.toUpperCase())) {
      profile.accentColor = profileId === 'user_1' ? '#FF5500' : '#8B5CF6'
    }
    profile.badgeColor = 'theme-soft-bg theme-text theme-border'
  }
  return parsed
}
export function saveProfiles(profiles: Record<'user_1' | 'user_2', UserProfile>, queueOnFailure = true): boolean {
  return writeValue(KEYS.PROFILES, JSON.stringify(profiles), queueOnFailure)
}

export function loadMesocycle(): MesocyclePlan {
  const parsed = loadValue(KEYS.MESOCYCLE, INITIAL_MESOCYCLE, isMesocycle)
  return { ...parsed, sessions: parsed.sessions.map((session) => ({ ...session, slots: session.slots.map((slot) => ({
    ...slot,
    defaultTargetReps: slot.defaultTargetReps.replace(/\s*\+\s*Dropset.*$/i, '').replace(/\s*\(Última al Fallo.*\)$/i, '').trim()
  })) })) }
}
export function saveMesocycle(mesocycle: MesocyclePlan): boolean {
  return writeValue(KEYS.MESOCYCLE, JSON.stringify(mesocycle))
}
export function loadHistory(): WorkoutHistoryEntry[] {
  return loadValue(KEYS.HISTORY, INITIAL_HISTORY, isHistory)
}
export function saveHistory(history: WorkoutHistoryEntry[], queueOnFailure = true): boolean {
  return writeValue(KEYS.HISTORY, JSON.stringify(history), queueOnFailure)
}
export function loadWeightUnit(): WeightUnit {
  return readValue(KEYS.UNIT) === 'lb' ? 'lb' : 'kg'
}
export function saveWeightUnit(unit: WeightUnit): boolean {
  return writeValue(KEYS.UNIT, unit)
}
export function loadActiveSessionId(): string {
  return readValue(KEYS.ACTIVE_SESSION_ID) || 'session-a'
}
export function saveActiveSessionId(sessionId: string): boolean {
  return writeValue(KEYS.ACTIVE_SESSION_ID, sessionId)
}
export function loadWorkoutWorkspace(): WorkoutWorkspace {
  return loadValue(KEYS.WORKOUT_WORKSPACE, { version: 1, activeSessionId: loadActiveSessionId(), drafts: {} }, isWorkoutWorkspace)
}
export function saveWorkoutWorkspace(workspace: WorkoutWorkspace, queueOnFailure = true): boolean {
  if (!isWorkoutWorkspace(workspace)) {
    updateIssue(KEYS.WORKOUT_WORKSPACE, 'invalid')
    return false
  }
  return writeValue(KEYS.WORKOUT_WORKSPACE, JSON.stringify(workspace), queueOnFailure)
}

export function persistCompanionRemoval(data: LocalProfileData): { applied: boolean; persisted: boolean } {
  const keys = [KEYS.PROFILES, KEYS.HISTORY, KEYS.DEVICE_CONFIG, KEYS.WORKOUT_WORKSPACE]
  if (keys.some((key) => blockedKeys.has(key)) || !isProfiles(data.profiles) || !isHistory(data.history) ||
    !isDeviceConfig(data.config) || !isWorkoutWorkspace(data.workspace)) return { applied: false, persisted: false }
  const results = [saveProfiles(data.profiles), saveHistory(data.history),
    saveDeviceConfig(data.config), saveWorkoutWorkspace(data.workspace)]
  return { applied: true, persisted: results.every(Boolean) }
}
