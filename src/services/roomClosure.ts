import type { UserProfile, WorkoutHistoryEntry, WorkoutSessionTemplate } from '../types'
import type { WorkoutDraft, WorkoutWorkspace } from '../utils/workoutState'
import type { SeriesJournal } from './seriesSync'
import { canonical, isSeriesJournal } from './seriesSync'
import { isRoomIdentifier } from './mqttRoomProtocol'
import { getDraftConflicts, getDraftJournal } from '../utils/workoutJournal'
import { EMPTY_REST, getCompletedSetStats, getProfileExerciseOptions, setClockRunning } from '../utils/workoutState'
import { swapJournalProfiles } from './roomSession'
import { createId } from '../utils/identity'

export interface RoomClosure {
  id: string
  round: number
  initiator: string
  revision: string
  date: string
  durationMinutes: number
  phase: 'requested' | 'confirmed' | 'committed'
  applied?: boolean
  delivered?: boolean
}

export function isRoomClosure(value: unknown): value is RoomClosure {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const c = value as Record<string, unknown>
  const date = typeof c.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.date) ? new Date(`${c.date}T12:00:00Z`) : null
  return Object.keys(c).every((key) => ['id', 'round', 'initiator', 'revision', 'date', 'durationMinutes', 'phase', 'applied', 'delivered'].includes(key)) &&
    isRoomIdentifier(c.id) && Number.isSafeInteger(c.round) && (c.round as number) > 0 && isRoomIdentifier(c.initiator) && typeof c.revision === 'string' && /^[a-f0-9]{64}$/.test(c.revision) &&
    !!date && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === c.date &&
    typeof c.durationMinutes === 'number' && Number.isFinite(c.durationMinutes) && c.durationMinutes >= 0 && c.durationMinutes <= 100000 &&
    ['requested', 'confirmed', 'committed'].includes(String(c.phase)) && (c.applied === undefined || typeof c.applied === 'boolean') &&
    (c.delivered === undefined || typeof c.delivered === 'boolean') && (!(c.applied || c.delivered) || c.phase === 'committed')
}

export function wireClosure(closure: RoomClosure): Omit<RoomClosure, 'applied' | 'delivered'> {
  const { applied: _applied, delivered: _delivered, ...wire } = closure
  return wire
}

export async function closureRevision(journal: SeriesJournal, swapped = false): Promise<string> {
  const normalized = swapped ? swapJournalProfiles(journal) : journal
  if (!isSeriesJournal(normalized)) throw new Error('El diario del entrenamiento no es válido.')
  const baseline = [...normalized.baseline].sort((a, b) => canonical(a.target).localeCompare(canonical(b.target)))
  const operations = [...normalized.operations].sort((a, b) => a.id.localeCompare(b.id))
  const bytes = new TextEncoder().encode(canonical({ workoutId: normalized.workoutId, baseline, operations }))
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function closureDraft(workspace: WorkoutWorkspace): WorkoutDraft {
  const draft = Object.values(workspace.drafts).find((item) => item.id === workspace.room?.workoutId)
  if (!draft || !getDraftJournal(draft)) throw new Error('No se encuentra el entrenamiento compartido.')
  return draft
}

function pauseClosureDraft(workspace: WorkoutWorkspace): WorkoutWorkspace {
  const draft = closureDraft(workspace)
  return { ...workspace, drafts: { ...workspace.drafts, [draft.sessionId]: { ...draft, isWorkoutStarted: false,
    clock: setClockRunning(draft.clock, false), rest: { ...EMPTY_REST } } } }
}

export async function readyRevision(workspace: WorkoutWorkspace): Promise<string> {
  const draft = closureDraft(workspace)
  const journal = getDraftJournal(draft)!
  if (getDraftConflicts(draft).length) throw new Error('Revisa las series contradictorias antes de confirmar el cierre.')
  if (journal.pending.length) throw new Error('Aún hay series sin confirmar por el otro teléfono. Reconecta y espera a que lleguen.')
  return closureRevision(journal, !!workspace.room?.profilesSwapped)
}

function validateResults(draft: WorkoutDraft): void {
  const sets = Object.values(draft.slotsState).flatMap((slot) => [...slot.setsByProfile.user_1, ...slot.setsByProfile.user_2])
  if (!sets.some((entry) => entry.completed)) throw new Error('Marca al menos una serie completada antes de finalizar.')
  if (sets.some((entry) => !entry.completed && entry.drops?.some((drop) => drop.completed))) throw new Error('Completa la serie principal de las bajadas registradas antes de finalizar.')
}

export async function requestRoomClosure(workspace: WorkoutWorkspace, date: string, durationMinutes: number): Promise<WorkoutWorkspace> {
  const room = workspace.room
  if (!room?.peerApplied || !room.peerDeviceId) throw new Error('Espera a que tu pareja se una antes de cerrar el entrenamiento compartido.')
  const old = room.closure
  if (old && (old.initiator !== workspace.deviceId || old.phase !== 'requested')) throw new Error('El cierre ya está en revisión en el otro teléfono.')
  const draft = closureDraft(workspace)
  if (workspace.activeSessionId !== draft.sessionId) throw new Error('Vuelve al entrenamiento de la sala para solicitar su cierre.')
  if (getDraftConflicts(draft).length) throw new Error('Revisa las series contradictorias antes de solicitar el cierre.')
  validateResults(draft)
  const revision = await closureRevision(getDraftJournal(draft)!, !!room.profilesSwapped)
  const closure: RoomClosure = { id: old?.id || createId('closure'), round: (old?.round || 0) + 1, initiator: workspace.deviceId!, revision,
    date: old?.date || date, durationMinutes: old?.durationMinutes ?? durationMinutes, phase: 'requested' }
  if (!isRoomClosure(closure)) throw new Error('Los datos del cierre no son válidos.')
  return { ...pauseClosureDraft(workspace), room: { ...room, closure } }
}

export async function confirmRoomClosure(workspace: WorkoutWorkspace): Promise<WorkoutWorkspace> {
  const room = workspace.room, closure = room?.closure
  if (!room || !closure || closure.initiator === workspace.deviceId || closure.phase !== 'requested') throw new Error('No hay una solicitud de tu pareja pendiente de confirmación.')
  if (workspace.activeSessionId !== closureDraft(workspace).sessionId) throw new Error('Vuelve al entrenamiento de la sala para revisar y confirmar.')
  validateResults(closureDraft(workspace))
  if (await readyRevision(workspace) !== closure.revision) throw new Error('Las series cambiaron. Espera a que ambos teléfonos terminen de sincronizar.')
  return { ...workspace, room: { ...room, closure: { ...closure, phase: 'confirmed' } } }
}

export async function refreshRoomClosureIfNeeded(workspace: WorkoutWorkspace): Promise<WorkoutWorkspace> {
  const room = workspace.room, closure = room?.closure
  if (!room || !closure || closure.phase !== 'requested' || closure.initiator !== workspace.deviceId) return workspace
  const revision = await readyRevision(workspace)
  if (revision === closure.revision) return workspace
  const updated = { ...closure, round: closure.round + 1, revision }
  if (!isRoomClosure(updated)) throw new Error('No se pudo actualizar la solicitud de cierre.')
  return { ...workspace, room: { ...room, closure: updated } }
}

export async function receiveClosure(workspace: WorkoutWorkspace, incoming: unknown): Promise<WorkoutWorkspace> {
  const room = workspace.room
  if (!room || !room.peerDeviceId || !room.peerApplied || !isRoomClosure(incoming) || incoming.applied !== undefined || incoming.delivered !== undefined ||
    ![workspace.deviceId, room.peerDeviceId].includes(incoming.initiator)) throw new Error('La solicitud de cierre no pertenece a esta sala.')
  if ((incoming.phase === 'requested' || incoming.phase === 'committed') && incoming.initiator !== room.peerDeviceId ||
    incoming.phase === 'confirmed' && incoming.initiator !== workspace.deviceId) throw new Error('El cierre llegó desde un participante incorrecto.')
  const current = room.closure
  if (incoming.phase === 'requested') {
    if (current && current.id !== incoming.id) {
      if (current.phase !== 'requested') throw new Error('Hay otro cierre en revisión. Conservamos ambos entrenamientos.')
      // Si ambos pidieron cerrar sin conexión, se elige la solicitud con ID menor.
      if (current.id < incoming.id) return workspace
    }
    if (current?.id === incoming.id) {
      if (incoming.initiator !== current.initiator) throw new Error('El cierre cambió de propietario.')
      if (incoming.round < current.round) return workspace
      if (incoming.round === current.round) {
        if (incoming.revision !== current.revision || incoming.date !== current.date || incoming.durationMinutes !== current.durationMinutes) throw new Error('La solicitud de cierre cambió inesperadamente.')
        return workspace
      }
      if (current.phase === 'committed') throw new Error('El cierre ya fue confirmado.')
    }
    return { ...pauseClosureDraft(workspace), room: { ...room, closure: incoming } }
  }
  if (!current || current.id !== incoming.id || current.round !== incoming.round || current.initiator !== incoming.initiator ||
    current.revision !== incoming.revision || current.date !== incoming.date || current.durationMinutes !== incoming.durationMinutes) {
    throw new Error('La confirmación no corresponde a la solicitud actual. Revisa el cierre de nuevo.')
  }
  if (current.phase === 'committed') return workspace
  if (incoming.phase === 'committed' && current.phase !== 'confirmed') throw new Error('Primero revisa y confirma tus resultados.')
  validateResults(closureDraft(workspace))
  if (await readyRevision(workspace) !== current.revision) throw new Error('Las series cambiaron. Espera a que ambos teléfonos terminen de sincronizar.')
  return { ...workspace, room: { ...room, closure: { ...current, phase: 'committed' } } }
}

export function sharedClosureHistory(closure: RoomClosure, draft: WorkoutDraft, session: WorkoutSessionTemplate,
  profiles: Record<'user_1' | 'user_2', UserProfile>, swapped: boolean): WorkoutHistoryEntry[] {
  if (closure.phase !== 'committed' || getDraftConflicts(draft).length) throw new Error('El cierre no está confirmado o tiene series pendientes.')
  const records: WorkoutHistoryEntry[] = []
  for (const profileId of ['user_1', 'user_2'] as const) {
    const exercises: WorkoutHistoryEntry['exercises'] = []
    let completedSets = 0, totalVolumeKg = 0
    for (const slot of session.slots) {
      const state = draft.slotsState[slot.slotId]
      if (!state) throw new Error('Falta un ejercicio del entrenamiento compartido.')
      const profile = profiles[profileId]
      const options = getProfileExerciseOptions(slot, profile, state.syncMode)
      const variant = options.find((item) => item.id === profile.activeVariantBySlot[slot.slotId]) || options[0]
      const stats = getCompletedSetStats(state.setsByProfile[profileId])
      completedSets += stats.completed.length; totalVolumeKg += stats.totalVolumeKg
      if (stats.completed.length) exercises.push({ slotId: slot.slotId, variantId: variant.id, variantName: variant.name,
        muscleGroup: variant.muscleGroup, equipment: variant.equipment, technique: state.techniqueByProfile[profileId],
        maxWeightKg: stats.maxWeightKg, estimated1RmKg: stats.estimated1RmKg, totalVolumeKg: Number(stats.totalVolumeKg.toFixed(2)),
        bestSetReps: stats.bestSetReps, sets: stats.completed })
    }
    const canonicalId = swapped ? (profileId === 'user_1' ? 'user_2' : 'user_1') : profileId
    if (completedSets) records.push({ id: `${draft.id}-${canonicalId}`, date: closure.date, sessionId: session.id,
      sessionCode: session.code, sessionTitle: session.title, profileId, totalVolumeKg: Number(totalVolumeKg.toFixed(2)),
      completedSets, durationMinutes: closure.durationMinutes, durationSource: 'measured', exercises })
  }
  return records
}
