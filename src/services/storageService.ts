import {
  MesocyclePlan,
  UserProfile,
  WorkoutHistoryEntry,
  WeightUnit,
  DeviceConfig
} from '../types'
import {
  INITIAL_MESOCYCLE,
  INITIAL_PROFILES,
  INITIAL_HISTORY,
  INITIAL_DEVICE_CONFIG
} from '../data/initialData'

const KEYS = {
  DEVICE_CONFIG: 'kineo_device_config_v1_4',
  PROFILES: 'kineo_profiles_v1_4',
  MESOCYCLE: 'kineo_mesocycle_v1_4',
  HISTORY: 'kineo_history_v1_4',
  UNIT: 'kineo_weight_unit_v1_4',
  ACTIVE_SESSION_ID: 'kineo_active_session_id_v1_4'
}

export function loadDeviceConfig(): DeviceConfig {
  try {
    const raw = localStorage.getItem(KEYS.DEVICE_CONFIG)
    if (!raw) return INITIAL_DEVICE_CONFIG
    return JSON.parse(raw)
  } catch {
    return INITIAL_DEVICE_CONFIG
  }
}

export function saveDeviceConfig(config: DeviceConfig): void {
  localStorage.setItem(KEYS.DEVICE_CONFIG, JSON.stringify(config))
}

export function loadProfiles(): Record<'user_1' | 'user_2', UserProfile> {
  try {
    const raw = localStorage.getItem(KEYS.PROFILES)
    if (!raw) return INITIAL_PROFILES
    return JSON.parse(raw)
  } catch {
    return INITIAL_PROFILES
  }
}

export function saveProfiles(profiles: Record<'user_1' | 'user_2', UserProfile>): void {
  localStorage.setItem(KEYS.PROFILES, JSON.stringify(profiles))
}

export function loadMesocycle(): MesocyclePlan {
  try {
    const raw = localStorage.getItem(KEYS.MESOCYCLE)
    if (!raw) return INITIAL_MESOCYCLE
    return JSON.parse(raw)
  } catch {
    return INITIAL_MESOCYCLE
  }
}

export function saveMesocycle(mesocycle: MesocyclePlan): void {
  localStorage.setItem(KEYS.MESOCYCLE, JSON.stringify(mesocycle))
}

export function loadHistory(): WorkoutHistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEYS.HISTORY)
    if (!raw) return INITIAL_HISTORY
    return JSON.parse(raw)
  } catch {
    return INITIAL_HISTORY
  }
}

export function saveHistory(history: WorkoutHistoryEntry[]): void {
  localStorage.setItem(KEYS.HISTORY, JSON.stringify(history))
}

export function loadWeightUnit(): WeightUnit {
  try {
    const raw = localStorage.getItem(KEYS.UNIT)
    return raw === 'lb' ? 'lb' : 'kg'
  } catch {
    return 'kg'
  }
}

export function saveWeightUnit(unit: WeightUnit): void {
  localStorage.setItem(KEYS.UNIT, unit)
}

export function loadActiveSessionId(): string {
  try {
    return localStorage.getItem(KEYS.ACTIVE_SESSION_ID) || 'session-a'
  } catch {
    return 'session-a'
  }
}

export function saveActiveSessionId(sessionId: string): void {
  localStorage.setItem(KEYS.ACTIVE_SESSION_ID, sessionId)
}
