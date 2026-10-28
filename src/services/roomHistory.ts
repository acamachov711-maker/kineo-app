import type { WorkoutHistoryEntry } from '../types'
import { isHistory } from '../utils/dataValidation'
import { canonical } from './seriesSync'
import { MAX_MQTT_FRAME_BYTES } from './mqttRoomProtocol'

export interface RoomHistoryStore {
  read: () => WorkoutHistoryEntry[]
  persist: (history: WorkoutHistoryEntry[]) => boolean
}

export function mapRoomHistory(history: WorkoutHistoryEntry[], swapped: boolean): WorkoutHistoryEntry[] {
  return swapped ? history.map((entry) => ({ ...entry, profileId: entry.profileId === 'user_1' ? 'user_2' : 'user_1' })) : history
}

export function mergeRoomHistory(local: WorkoutHistoryEntry[], remote: WorkoutHistoryEntry[]): WorkoutHistoryEntry[] {
  if (!isHistory(local) || !isHistory(remote)) throw new Error('Historial no válido.')
  const result = [...local]
  const byId = new Map<string, WorkoutHistoryEntry>()
  for (const entry of local) {
    if (!entry.id || byId.has(entry.id)) throw new Error('El historial local contiene identificadores duplicados.')
    byId.set(entry.id, entry)
  }
  for (const entry of remote) {
    if (!entry.id) throw new Error('Registro sin identificador.')
    const previous = byId.get(entry.id)
    if (previous && canonical(previous) !== canonical(entry)) throw new Error('Dos registros del historial tienen el mismo identificador y datos diferentes.')
    if (!previous) { result.push(entry); byId.set(entry.id, entry) }
  }
  return result
}

export function historyBatches(history: WorkoutHistoryEntry[]): WorkoutHistoryEntry[][] {
  if (!isHistory(history)) throw new Error('Historial no válido.')
  // Validar duplicados también cuando el historial remoto aún está vacío.
  mergeRoomHistory(history, [])
  const result: WorkoutHistoryEntry[][] = []
  let batch: WorkoutHistoryEntry[] = []
  for (const entry of history) {
    const candidate = [...batch, entry]
    if (candidate.length > 50 || new TextEncoder().encode(JSON.stringify(candidate)).byteLength > MAX_MQTT_FRAME_BYTES - 2048) {
      if (!batch.length) throw new Error('Un registro del historial supera el límite de envío.')
      result.push(batch)
      batch = [entry]
      if (new TextEncoder().encode(JSON.stringify(batch)).byteLength > MAX_MQTT_FRAME_BYTES - 2048) throw new Error('Un registro del historial supera el límite de envío.')
    } else batch = candidate
  }
  if (batch.length) result.push(batch)
  return result
}
