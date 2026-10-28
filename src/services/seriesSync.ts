import type { DropSubSet } from '../types'
import { createId } from '../utils/identity'

export type ProfileId = 'user_1' | 'user_2'
export interface SeriesTarget { slotId: string; profileId: ProfileId; setId: string }
export interface SeriesValue {
  setNumber: number
  targetReps: string
  weightKg: number
  actualReps: number
  rir: number
  isFailure: boolean
  completed: boolean
  compensatedDirection: 'up' | 'down' | null
  drops: DropSubSet[]
  deleted: boolean
}
export interface SeriesSnapshot { target: SeriesTarget; value: SeriesValue }
export interface SeriesOperation {
  id: string
  workoutId: string
  deviceId: string
  actorProfileId: ProfileId
  target: SeriesTarget
  parents: string[]
  kind: 'create' | 'edit' | 'resolve'
  changes: Partial<SeriesValue>
  createdAt: number
}
export interface SeriesJournal {
  version: 1
  workoutId: string
  baseline: SeriesSnapshot[]
  operations: SeriesOperation[]
  pending: string[]
}
export interface ConflictVersion {
  operationId: string
  deviceId: string
  actorProfileId: ProfileId
  value: unknown
}
export interface SeriesConflict { field: keyof SeriesValue; versions: ConflictVersion[] }
export interface ProjectedSeries extends SeriesSnapshot { heads: string[]; conflicts: SeriesConflict[] }

export const SERIES_FIELDS: (keyof SeriesValue)[] = [
  'setNumber', 'targetReps', 'weightKg', 'actualReps', 'rir', 'isFailure',
  'completed', 'compensatedDirection', 'drops', 'deleted'
]
const MAX_OPERATIONS = 10000
const MAX_BATCH = 1000
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 512
const number = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
const profile = (value: unknown): value is ProfileId => value === 'user_1' || value === 'user_2'
const copy = <Value>(value: Value): Value => JSON.parse(JSON.stringify(value)) as Value

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (record(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

export function targetKey(target: SeriesTarget): string {
  return JSON.stringify([target.slotId, target.profileId, target.setId])
}

function isTarget(value: unknown): value is SeriesTarget {
  return record(value) && text(value.slotId) && profile(value.profileId) && text(value.setId) &&
    Object.keys(value).every((key) => ['slotId', 'profileId', 'setId'].includes(key))
}

function isChanges(value: unknown, complete = false): value is Partial<SeriesValue> {
  if (!record(value) || !Object.keys(value).length || Object.keys(value).some((key) => !SERIES_FIELDS.includes(key as keyof SeriesValue))) return false
  if (complete && SERIES_FIELDS.some((field) => !(field in value))) return false
  return Object.entries(value).every(([field, item]) => {
    if (['setNumber', 'actualReps'].includes(field)) return number(item) && Number.isSafeInteger(item) && (field !== 'setNumber' || item > 0)
    if (['weightKg', 'rir'].includes(field)) return number(item)
    if (field === 'targetReps') return typeof item === 'string' && item.length <= 512
    if (['isFailure', 'completed', 'deleted'].includes(field)) return typeof item === 'boolean'
    if (field === 'compensatedDirection') return item === null || item === 'up' || item === 'down'
    if (field === 'drops') return Array.isArray(item) && item.length <= 100 && new Set(item.map((drop) => record(drop) ? drop.id : null)).size === item.length &&
      item.every((drop) => record(drop) && text(drop.id) && number(drop.weightKg) && number(drop.reps) && Number.isSafeInteger(drop.reps) && typeof drop.completed === 'boolean' &&
        Object.keys(drop).every((key) => ['id', 'weightKg', 'reps', 'completed'].includes(key)))
    return false
  })
}

function isOperation(value: unknown): value is SeriesOperation {
  return record(value) && text(value.id) && text(value.workoutId) && text(value.deviceId) && profile(value.actorProfileId) &&
    isTarget(value.target) && typeof value.kind === 'string' && ['create', 'edit', 'resolve'].includes(value.kind) &&
    Array.isArray(value.parents) && value.parents.length <= 256 && value.parents.every(text) && new Set(value.parents).size === value.parents.length &&
    isChanges(value.changes, value.kind === 'create') && number(value.createdAt) &&
    Object.keys(value).every((key) => ['id', 'workoutId', 'deviceId', 'actorProfileId', 'target', 'parents', 'kind', 'changes', 'createdAt'].includes(key))
}

function orderedOperations(journal: SeriesJournal): SeriesOperation[] {
  const byId = new Map(journal.operations.map((operation) => [operation.id, operation]))
  if (byId.size !== journal.operations.length) throw new Error('Hay identificadores de operación repetidos.')
  const baseline = new Set(journal.baseline.map((entry) => targetKey(entry.target)))
  if (baseline.size !== journal.baseline.length) throw new Error('Hay series repetidas en la base compartida.')
  const creators = new Map<string, string>()
  journal.operations.forEach((operation) => {
    const key = targetKey(operation.target)
    if (operation.workoutId !== journal.workoutId) throw new Error('La operación pertenece a otro entrenamiento.')
    if (operation.kind === 'create') {
      if (baseline.has(key) || creators.has(key) || operation.parents.length) throw new Error('La creación de serie es contradictoria.')
      creators.set(key, operation.id)
    }
  })
  const remaining = new Map<string, number>()
  const children = new Map<string, string[]>()
  journal.operations.forEach((operation) => {
    const key = targetKey(operation.target)
    if (!baseline.has(key) && !creators.has(key)) throw new Error('Falta la creación de la serie.')
    if (!baseline.has(key) && operation.kind !== 'create' && !operation.parents.length) throw new Error('La edición no referencia una revisión de la serie.')
    remaining.set(operation.id, operation.parents.length)
    operation.parents.forEach((parentId) => {
      const parent = byId.get(parentId)
      if (!parent || targetKey(parent.target) !== key) throw new Error('Falta una revisión anterior o pertenece a otra serie.')
      children.set(parentId, [...(children.get(parentId) || []), operation.id])
    })
  })
  const ready = journal.operations.filter((operation) => !operation.parents.length).sort((left, right) => left.id.localeCompare(right.id))
  const ordered: SeriesOperation[] = []
  for (let index = 0; index < ready.length; index += 1) {
    const operation = ready[index]
    ordered.push(operation)
    for (const childId of children.get(operation.id) || []) {
      const count = remaining.get(childId)! - 1
      remaining.set(childId, count)
      if (count === 0) ready.push(byId.get(childId)!)
    }
  }
  if (ordered.length !== journal.operations.length) throw new Error('El historial contiene un ciclo de revisiones.')
  return ordered
}

export function isSeriesJournal(value: unknown): value is SeriesJournal {
  if (!record(value) || value.version !== 1 || !text(value.workoutId) || !Array.isArray(value.baseline) || value.baseline.length > 2000 ||
    !value.baseline.every((entry) => record(entry) && isTarget(entry.target) && isChanges(entry.value, true)) ||
    !Array.isArray(value.operations) || value.operations.length > MAX_OPERATIONS || !value.operations.every(isOperation) ||
    !Array.isArray(value.pending) || !value.pending.every(text) || new Set(value.pending).size !== value.pending.length ||
    !value.pending.every((id) => (value.operations as SeriesOperation[]).some((operation) => operation.id === id))) return false
  try { orderedOperations(value as unknown as SeriesJournal); return true } catch { return false }
}

export function createJournal(workoutId: string, baseline: SeriesSnapshot[]): SeriesJournal {
  const journal: SeriesJournal = { version: 1, workoutId, baseline: copy(baseline), operations: [], pending: [] }
  if (!isSeriesJournal(journal)) throw new Error('La base del entrenamiento no es válida.')
  return journal
}

export function projectJournal(journal: SeriesJournal): ProjectedSeries[] {
  const ordered = orderedOperations(journal)
  const byId = new Map(ordered.map((operation) => [operation.id, operation]))
  const ancestor = (olderId: string, newerId: string): boolean => {
    const pending = [...(byId.get(newerId)?.parents || [])]
    const visited = new Set<string>()
    while (pending.length) {
      const id = pending.pop()!
      if (id === olderId) return true
      if (visited.has(id)) continue
      visited.add(id)
      pending.push(...(byId.get(id)?.parents || []))
    }
    return false
  }
  const snapshots = new Map(journal.baseline.map((entry) => [targetKey(entry.target), copy(entry)]))
  ordered.filter((operation) => operation.kind === 'create').forEach((operation) => {
    snapshots.set(targetKey(operation.target), { target: operation.target, value: copy(operation.changes as SeriesValue) })
  })
  return Array.from(snapshots.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([key, snapshot]) => {
    const operations = ordered.filter((operation) => targetKey(operation.target) === key)
    const heads = operations.filter((operation) => !operations.some((other) => other.parents.includes(operation.id))).map((operation) => operation.id).sort()
    const value = { ...snapshot.value }
    const conflicts: SeriesConflict[] = []
    for (const field of SERIES_FIELDS) {
      let versions: SeriesOperation[] = []
      operations.filter((operation) => field in operation.changes).forEach((operation) => {
        versions = versions.filter((version) => !ancestor(version.id, operation.id))
        versions.push(operation)
      })
      versions.sort((left, right) => left.id.localeCompare(right.id))
      if (new Set(versions.map((version) => canonical(version.changes[field]))).size > 1) {
        conflicts.push({ field, versions: versions.map((version) => ({ operationId: version.id, deviceId: version.deviceId,
          actorProfileId: version.actorProfileId, value: copy(version.changes[field]) })) })
      } else if (versions.length) Object.assign(value, { [field]: copy(versions[0].changes[field]) })
    }
    const deletions = operations.filter((operation) => operation.changes.deleted === true && !operations.some((other) => 'deleted' in other.changes && ancestor(operation.id, other.id)))
    const concurrentEdits = operations.filter((operation) => operation.changes.deleted !== true &&
      deletions.some((deletion) => !ancestor(deletion.id, operation.id) && !ancestor(operation.id, deletion.id)))
    if (value.deleted && concurrentEdits.length && !conflicts.some((conflict) => conflict.field === 'deleted')) {
      conflicts.push({ field: 'deleted', versions: [...deletions, ...concurrentEdits].map((operation) => ({
        operationId: operation.id, deviceId: operation.deviceId, actorProfileId: operation.actorProfileId, value: operation.changes.deleted === true
      })) })
    }
    return { target: snapshot.target, value, heads, conflicts }
  })
}

export function appendOperation(
  journal: SeriesJournal, target: SeriesTarget, changes: Partial<SeriesValue>, deviceId: string, actorProfileId: ProfileId,
  kind: SeriesOperation['kind'] = 'edit'
): SeriesJournal {
  const current = projectJournal(journal).find((entry) => targetKey(entry.target) === targetKey(target))
  if (kind !== 'create' && !current) throw new Error('No existe la serie que se quiere editar.')
  if (current?.conflicts.length && kind !== 'resolve') throw new Error('Revisa las versiones contradictorias antes de editar esta serie.')
  if (kind === 'resolve' && (!current?.conflicts.length || current.conflicts.some((conflict) => !(conflict.field in changes)))) {
    throw new Error('La revisión debe resolver todos los campos contradictorios de esta serie.')
  }
  const operation: SeriesOperation = { id: createId('op'), workoutId: journal.workoutId, deviceId, actorProfileId, target: copy(target),
    parents: current?.heads || [], kind, changes: copy(changes), createdAt: Date.now() }
  const next = { ...journal, operations: [...journal.operations, operation], pending: [...journal.pending, operation.id] }
  if (!isSeriesJournal(next)) throw new Error('La operación no es válida o excede los límites del registro local.')
  return next
}

export function mergeRemoteOperations(journal: SeriesJournal, incoming: unknown): SeriesJournal {
  if (!Array.isArray(incoming) || incoming.length > MAX_BATCH || !incoming.every(isOperation)) throw new Error('El lote de operaciones no es válido.')
  if (canonical(incoming).length > 1000000) throw new Error('El lote excede el tamaño permitido.')
  const byId = new Map(journal.operations.map((operation) => [operation.id, operation]))
  for (const operation of incoming) {
    const existing = byId.get(operation.id)
    if (existing && canonical(existing) !== canonical(operation)) throw new Error('Una operación recibida reutiliza un identificador con otro contenido.')
    byId.set(operation.id, copy(operation))
  }
  const next = { ...journal, operations: Array.from(byId.values()).sort((left, right) => left.id.localeCompare(right.id)) }
  if (!isSeriesJournal(next)) throw new Error('Faltan revisiones o el lote no corresponde a este entrenamiento.')
  return next
}

export function getPendingOperations(journal: SeriesJournal): SeriesOperation[] {
  const pending = new Set(journal.pending)
  return copy(journal.operations.filter((operation) => pending.has(operation.id)))
}

export function getOperationsInCausalOrder(journal: SeriesJournal): SeriesOperation[] {
  if (!isSeriesJournal(journal)) throw new Error('El diario no es válido para su envío.')
  return copy(orderedOperations(journal))
}

export function acknowledgeOperations(journal: SeriesJournal, confirmedIds: string[]): SeriesJournal {
  const confirmed = new Set(confirmedIds)
  return { ...journal, pending: journal.pending.filter((id) => !confirmed.has(id)) }
}

export function getResolvedSeries(journal: SeriesJournal): SeriesSnapshot[] {
  return projectJournal(journal).filter((entry) => !entry.value.deleted && !entry.conflicts.length)
    .map(({ target, value }) => ({ target: copy(target), value: copy(value) }))
}
