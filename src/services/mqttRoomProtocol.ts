import type { SeriesJournal, SeriesOperation } from './seriesSync'
import { canonical, getOperationsInCausalOrder, isSeriesJournal } from './seriesSync'
import type { WorkoutHistoryEntry } from '../types'
import type { RoomClosure } from './roomClosure'

export const MAX_MQTT_FRAME_BYTES = 131072
export const MAX_MQTT_BATCH_OPERATIONS = 100

export interface MqttRoomAddress {
  roomId: string
  workoutId: string
  deviceId: string
  peerDeviceId: string
}

interface FrameBase {
  version: 1
  roomId: string
  workoutId: string
  baseDigest: string
  from: string
  to: string
}

export type RoomFrame = FrameBase & (
  { type: 'hello'; requestReplay: boolean } |
  { type: 'operations'; batchId: string; operations: SeriesOperation[] } |
  { type: 'receipt'; batchId: string; operationIds: string[] } |
  { type: 'history'; batchId: string; entries: WorkoutHistoryEntry[] } |
  { type: 'history_receipt'; batchId: string } |
  { type: 'closure'; messageId: string; closure: Omit<RoomClosure, 'applied' | 'delivered'> } |
  { type: 'closure_receipt'; messageId: string }
)

export function isRoomIdentifier(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,96}$/.test(value)
}

export function roomInbox(address: MqttRoomAddress, deviceId: string): string {
  if (![address.roomId, address.workoutId, address.deviceId, address.peerDeviceId, deviceId].every(isRoomIdentifier) ||
    address.deviceId === address.peerDeviceId) throw new Error('Identificación de sala o dispositivos no válida.')
  return `kineo/v1_7/rooms/${address.roomId}/workouts/${address.workoutId}/devices/${deviceId}/inbox`
}

export async function createRoomBaseDigest(journal: SeriesJournal, context: Record<string, unknown>): Promise<string> {
  if (!isSeriesJournal(journal)) throw new Error('No se puede vincular un diario inválido.')
  const baseline = [...journal.baseline].sort((left, right) => canonical(left.target).localeCompare(canonical(right.target)))
  const content = canonical({ workoutId: journal.workoutId, baseline, context: JSON.parse(JSON.stringify(context)) })
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(content))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function encodeRoomFrame(frame: RoomFrame): string {
  const payload = JSON.stringify(frame)
  if (new TextEncoder().encode(payload).byteLength > MAX_MQTT_FRAME_BYTES) throw new Error('El mensaje excede el límite del transporte.')
  return payload
}

export function parseRoomFrame(payload: Uint8Array, address: MqttRoomAddress, baseDigest: string): RoomFrame {
  if (payload.byteLength > MAX_MQTT_FRAME_BYTES) throw new Error('Mensaje demasiado grande.')
  const frame: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(payload))
  if (!frame || typeof frame !== 'object' || Array.isArray(frame)) throw new Error('Mensaje no válido.')
  const record = frame as Record<string, unknown>
  if (record.version !== 1 || record.roomId !== address.roomId || record.workoutId !== address.workoutId ||
    record.baseDigest !== baseDigest || record.from !== address.peerDeviceId || record.to !== address.deviceId) {
    throw new Error('El mensaje no pertenece a esta vinculación y base de entrenamiento.')
  }
  const keys = ['version', 'roomId', 'workoutId', 'baseDigest', 'from', 'to', 'type']
  if (record.type === 'hello') {
    keys.push('requestReplay')
    if (typeof record.requestReplay !== 'boolean') throw new Error('Solicitud de recuperación no válida.')
  } else if (record.type === 'operations') {
    keys.push('batchId', 'operations')
    if (!isRoomIdentifier(record.batchId) || !Array.isArray(record.operations) || !record.operations.length ||
      record.operations.length > MAX_MQTT_BATCH_OPERATIONS) throw new Error('Lote no válido.')
  } else if (record.type === 'receipt') {
    keys.push('batchId', 'operationIds')
    if (!isRoomIdentifier(record.batchId) || !Array.isArray(record.operationIds) || !record.operationIds.length ||
      record.operationIds.length > MAX_MQTT_BATCH_OPERATIONS ||
      !record.operationIds.every((identifier) => typeof identifier === 'string' && identifier.length > 0 && identifier.length <= 512) ||
      new Set(record.operationIds).size !== record.operationIds.length) throw new Error('Confirmación no válida.')
  } else if (record.type === 'history') {
    keys.push('batchId', 'entries')
    if (!isRoomIdentifier(record.batchId) || !Array.isArray(record.entries) || !record.entries.length || record.entries.length > 50) throw new Error('Lote de historial no válido.')
  } else if (record.type === 'history_receipt') {
    keys.push('batchId')
    if (!isRoomIdentifier(record.batchId)) throw new Error('Confirmación de historial no válida.')
  } else if (record.type === 'closure') {
    keys.push('messageId', 'closure')
    if (!isRoomIdentifier(record.messageId) || !record.closure || typeof record.closure !== 'object' || Array.isArray(record.closure)) throw new Error('Solicitud de cierre no válida.')
  } else if (record.type === 'closure_receipt') {
    keys.push('messageId')
    if (!isRoomIdentifier(record.messageId)) throw new Error('Recibo de cierre no válido.')
  } else throw new Error('Tipo de mensaje no admitido.')
  if (Object.keys(record).some((key) => !keys.includes(key))) throw new Error('El mensaje contiene campos no admitidos.')
  return frame as RoomFrame
}

export function createOperationBatches(journal: SeriesJournal, replay: boolean): SeriesOperation[][] {
  const ordered = getOperationsInCausalOrder(journal)
  const needed = new Set(replay ? ordered.map((operation) => operation.id) : journal.pending)
  for (const operation of [...ordered].reverse()) {
    if (needed.has(operation.id)) operation.parents.forEach((parent) => needed.add(parent))
  }
  const batches: SeriesOperation[][] = []
  let current: SeriesOperation[] = []
  for (const operation of ordered.filter((entry) => needed.has(entry.id))) {
    const candidate = [...current, operation]
    const bytes = new TextEncoder().encode(JSON.stringify(candidate)).byteLength
    if (bytes > MAX_MQTT_FRAME_BYTES - 2048 || candidate.length > MAX_MQTT_BATCH_OPERATIONS) {
      if (!current.length) throw new Error('Una operación excede el límite del transporte y sigue guardada localmente.')
      batches.push(current)
      current = []
    }
    if (new TextEncoder().encode(JSON.stringify([operation])).byteLength > MAX_MQTT_FRAME_BYTES - 2048) {
      throw new Error('Una operación excede el límite del transporte y sigue guardada localmente.')
    }
    current.push(operation)
  }
  if (current.length) batches.push(current)
  return batches
}
