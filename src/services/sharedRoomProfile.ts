import type { UserProfile, WorkoutSessionTemplate } from '../types'
import type { WorkoutDraft } from '../utils/workoutState'
import { ASCENT_COLOR_PALETTE } from '../data/initialData'

export interface SharedRoomProfile {
  name: string
  color: string
  exercises: Record<string, string>
}

export function isSharedRoomProfile(value: unknown): value is SharedRoomProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const profile = value as Record<string, unknown>
  if (Object.keys(profile).sort().join(',') !== 'color,exercises,name' ||
    typeof profile.name !== 'string' || !profile.name.trim() || profile.name.trim().length > 120 ||
    typeof profile.color !== 'string' || !ASCENT_COLOR_PALETTE.some((item) => item.hex.toUpperCase() === (profile.color as string).toUpperCase()) ||
    !profile.exercises || typeof profile.exercises !== 'object' || Array.isArray(profile.exercises)) return false
  const entries = Object.entries(profile.exercises as Record<string, unknown>)
  return entries.length <= 100 && entries.every(([slot, exercise]) => slot.length > 0 && slot.length <= 120 &&
    typeof exercise === 'string' && exercise.length > 0 && exercise.length <= 120)
}

export function sharedRoomProfile(profile: UserProfile, session: WorkoutSessionTemplate, draft: WorkoutDraft): SharedRoomProfile {
  const exercises = Object.fromEntries(session.slots.map((slot) => {
    const live = draft.slotsState[slot.slotId]
    if (!live) throw new Error('La rutina no coincide con el entrenamiento abierto.')
    const defaultVariant = live.syncMode === 'individual' && profile.gender === 'female' && slot.femaleFocusedPrimary
      ? slot.femaleFocusedPrimary : slot.primaryExercise
    return [slot.slotId, profile.activeVariantBySlot[slot.slotId] || defaultVariant.id]
  }))
  return { name: profile.name.trim(), color: profile.accentColor, exercises }
}

export function applySharedRoomProfile(local: UserProfile, incoming: unknown, session: WorkoutSessionTemplate, hasCompanionData: boolean): UserProfile {
  if (!isSharedRoomProfile(incoming)) throw new Error('Perfil compartido no válido.')
  const value = incoming
  const exercises = value.exercises
  if (Object.keys(exercises).length !== session.slots.length || session.slots.some((slot) => {
    const available = [slot.primaryExercise, ...slot.alternatives, ...(slot.femaleFocusedPrimary ? [slot.femaleFocusedPrimary] : []), ...(slot.femaleFocusedAlternatives || [])]
    return typeof exercises[slot.slotId] !== 'string' || !available.some((variant) => variant.id === exercises[slot.slotId])
  })) throw new Error('Los ejercicios compartidos no corresponden a esta rutina.')
  const previousName = local.name.trim()
  const placeholder = !previousName || previousName === 'Pareja' || previousName === 'Perfil 2' || previousName === 'Perfil sin datos'
  if (previousName.toLocaleLowerCase() !== value.name.trim().toLocaleLowerCase() && (!placeholder || hasCompanionData)) {
    throw new Error('Ya existe otro perfil de compañero; no lo sustituimos.')
  }
  return { ...local, name: value.name.trim(), accentColor: value.color,
    activeVariantBySlot: { ...local.activeVariantBySlot, ...exercises as Record<string, string> } }
}
