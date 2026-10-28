import type { SetEntry, UserProfile, WorkoutSessionTemplate } from '../types'
import type { WorkoutDraft, WorkoutWorkspace } from './workoutState'
import type { ProfileId, ProjectedSeries, SeriesJournal, SeriesSnapshot, SeriesTarget, SeriesValue } from '../services/seriesSync'
import { appendOperation, canonical, createJournal, isSeriesJournal, projectJournal, SERIES_FIELDS, targetKey } from '../services/seriesSync'
import { createId } from './identity'
import { createWorkoutDraft, getCompletedSetStats, hasRecordedSlot } from './workoutState'

function snapshots(draft: WorkoutDraft): SeriesSnapshot[] {
  return Object.entries(draft.slotsState).flatMap(([slotId, slot]) =>
    (['user_1', 'user_2'] as const).flatMap((profileId) => slot.setsByProfile[profileId].map((entry) => ({
      target: { slotId, profileId, setId: entry.id! },
      value: {
        setNumber: entry.setNumber, targetReps: entry.targetReps, weightKg: entry.weightKg,
        actualReps: entry.actualReps, rir: entry.rir, isFailure: entry.isFailure || false,
        completed: entry.completed, compensatedDirection: entry.compensatedDirection || null,
        drops: entry.drops || [], deleted: false
      }
    }))))
}

function assignIds(draft: WorkoutDraft, initial: boolean): WorkoutDraft {
  return { ...draft, slotsState: Object.fromEntries(Object.entries(draft.slotsState).map(([slotId, slot]) => {
    const sets = (profileId: 'user_1' | 'user_2'): SetEntry[] => slot.setsByProfile[profileId].map((entry, index) => ({
      ...entry, id: entry.id || (initial ? `set-${draft.id}-${encodeURIComponent(slotId)}-${profileId}-${index + 1}` : createId('set'))
    }))
    return [slotId, { ...slot, setsByProfile: { user_1: sets('user_1'), user_2: sets('user_2') } }]
  })) }
}

export function prepareDraft(draft: WorkoutDraft): WorkoutDraft {
  if (draft.journal) return draft
  const prepared = assignIds(draft, !draft.journal)
  return prepared.journal ? prepared : { ...prepared, journal: createJournal(prepared.id, snapshots(prepared)) }
}

export function prepareWorkspace(workspace: WorkoutWorkspace): WorkoutWorkspace {
  return { ...workspace, deviceId: workspace.deviceId || createId('device'), archivedJournals: workspace.archivedJournals || [],
    drafts: Object.fromEntries(Object.entries(workspace.drafts).map(([key, draft]) => [key, prepareDraft(draft)])) }
}

export function recordDraftChanges(previous: WorkoutDraft, updated: WorkoutDraft, deviceId: string): WorkoutDraft {
  const base = prepareDraft(previous)
  if (previous.slotsState === updated.slotsState) return { ...updated, journal: base.journal, slotsState: base.slotsState }
  const next = assignIds(updated, false)
  let journal = base.journal!
  const before = new Map(snapshots(base).map((entry) => [targetKey(entry.target), entry]))
  const after = new Map(snapshots(next).map((entry) => [targetKey(entry.target), entry]))
  const blocked = new Set(getDraftConflicts(previous).map((entry) => targetKey(entry.target)))
  for (const key of blocked) {
    if (canonical(before.get(key) || null) !== canonical(after.get(key) || null)) throw new Error('Confirma primero la serie en revisión.')
  }
  for (const [key, entry] of after) {
    const existing = before.get(key)
    if (!existing) {
      journal = appendOperation(journal, entry.target, entry.value, deviceId, previous.activeProfileId, 'create')
      continue
    }
    const changes: Partial<SeriesValue> = {}
    for (const field of SERIES_FIELDS) {
      if (canonical(existing.value[field]) !== canonical(entry.value[field])) Object.assign(changes, { [field]: entry.value[field] })
    }
    if (Object.keys(changes).length) journal = appendOperation(journal, entry.target, changes, deviceId, previous.activeProfileId)
  }
  for (const [key, entry] of before) {
    if (!after.has(key)) journal = appendOperation(journal, entry.target, { deleted: true }, deviceId, previous.activeProfileId)
  }
  if (!base.receivedJournal) return { ...next, journal }
  const known = new Set(base.receivedJournal.operations.map((operation) => operation.id))
  const operations = [...base.receivedJournal.operations, ...journal.operations.filter((operation) => !known.has(operation.id))]
  const full = { ...base.receivedJournal, operations, pending: [...new Set([...base.receivedJournal.pending, ...journal.pending])] }
  return applyReceivedJournal({ ...next, journal: base.journal, receivedJournal: base.receivedJournal }, full)
}

export function archiveJournal(archived: SeriesJournal[], draft: WorkoutDraft): SeriesJournal[] {
  if (getDraftConflicts(draft).length) throw new Error('No se archiva un entrenamiento con contradicciones pendientes.')
  if (!draft.journal?.operations.length) return archived
  return [...archived.filter((journal) => journal.workoutId !== draft.id), draft.journal]
}

export function prepareOnboardingWorkspace(workspace: WorkoutWorkspace, session: WorkoutSessionTemplate,
  profiles: Record<'user_1' | 'user_2', UserProfile>, primaryProfileId: ProfileId): WorkoutWorkspace {
  if (workspace.room || Object.values(workspace.drafts).some((draft) =>
    draft.isWorkoutStarted || draft.clock.elapsedMs > 0 || draft.clock.runningSince !== null ||
    getDraftConflicts(draft).length || Object.values(draft.slotsState).some(hasRecordedSlot))) {
    throw new Error('No se puede reiniciar la configuración mientras hay una sala, un entrenamiento en curso o series registradas.')
  }
  const archivedJournals = Object.values(workspace.drafts).reduce(archiveJournal, workspace.archivedJournals || [])
  const draft = prepareDraft(createWorkoutDraft(session.id, session.slots, profiles, primaryProfileId))
  return { ...workspace, journalError: undefined, activeSessionId: session.id, drafts: { [session.id]: draft }, archivedJournals }
}

export function countPendingOperations(workspace: WorkoutWorkspace): number {
  return [...Object.values(workspace.drafts).flatMap((draft) => getDraftJournal(draft) ? [getDraftJournal(draft)!] : []), ...(workspace.archivedJournals || [])]
    .reduce((sum, journal) => sum + journal.pending.length, 0)
}

export function hasCoherentJournal(draft: WorkoutDraft): boolean {
  if (!draft.journal) return !draft.receivedJournal
  const entries = snapshots(draft)
  if (entries.some((entry) => !entry.target.setId) || new Set(entries.map((entry) => targetKey(entry.target))).size !== entries.length) return false
  const projected = projectJournal(draft.journal)
  if (projected.some((entry) => entry.conflicts.length)) return false
  if (!hasCoherentReception(draft)) return false
  const order = (left: SeriesSnapshot, right: SeriesSnapshot) => targetKey(left.target).localeCompare(targetKey(right.target))
  return canonical(entries.sort(order)) === canonical(projected.filter((entry) => !entry.value.deleted)
    .map(({ target, value }) => ({ target, value })).sort(order))
}

export function getDraftJournal(draft: WorkoutDraft): SeriesJournal | undefined {
  return draft.receivedJournal || draft.journal
}

export function getDraftConflicts(draft: WorkoutDraft): ProjectedSeries[] {
  return draft.receivedJournal ? projectJournal(draft.receivedJournal).filter((entry) => entry.conflicts.length > 0) : []
}

export function getDraftLiveStats(draft: WorkoutDraft, profileId: ProfileId, slotIds = Object.keys(draft.slotsState)) {
  const blocked = new Set(getDraftConflicts(draft).map((entry) => targetKey(entry.target)))
  let completed = 0
  let total = 0
  let volumeKg = 0
  for (const slotId of slotIds) {
    for (const entry of draft.slotsState[slotId]?.setsByProfile[profileId] || []) {
      total += 1
      if (entry.completed && !blocked.has(targetKey({ slotId, profileId, setId: entry.id! }))) {
        completed += 1
        volumeKg += getCompletedSetStats([entry]).totalVolumeKg
      }
    }
  }
  return { completed, total, volumeKg }
}

export function hasCoherentReception(draft: WorkoutDraft): boolean {
  const full = draft.receivedJournal
  if (!full) return true
  const approved = draft.journal
  if (!approved || !isSeriesJournal(full) || full.workoutId !== draft.id || canonical(full.baseline) !== canonical(approved.baseline)) return false
  if (full.operations.some((operation) => operation.kind === 'resolve' && operation.actorProfileId !== operation.target.profileId)) return false
  const byId = new Map(full.operations.map((operation) => [operation.id, operation]))
  if (approved.operations.some((operation) => canonical(byId.get(operation.id) || null) !== canonical(operation))) return false
  const blocked = new Set(getDraftConflicts(draft).map((entry) => targetKey(entry.target)))
  if (!blocked.size) return false
  const approvedIds = new Set(approved.operations.map((operation) => operation.id))
  if (full.operations.some((operation) => !blocked.has(targetKey(operation.target)) && !approvedIds.has(operation.id))) return false
  if (canonical([...approved.pending].sort()) !== canonical(full.pending.filter((identifier) => approvedIds.has(identifier)).sort())) return false
  return projectJournal(full).every((entry) => Boolean(draft.slotsState[entry.target.slotId]))
}

export function applyReceivedJournal(draft: WorkoutDraft, full: SeriesJournal): WorkoutDraft {
  const previous = getDraftJournal(draft)
  if (!previous || !isSeriesJournal(full) || full.workoutId !== draft.id || canonical(full.baseline) !== canonical(previous.baseline)) {
    throw new Error('La recepción no pertenece a este entrenamiento y su base.')
  }
  const byId = new Map(full.operations.map((operation) => [operation.id, operation]))
  if (previous.operations.some((operation) => canonical(byId.get(operation.id) || null) !== canonical(operation))) {
    throw new Error('La recepción no puede descartar ni alterar revisiones guardadas.')
  }
  if (full.operations.some((operation) => operation.kind === 'resolve' && operation.actorProfileId !== operation.target.profileId)) {
    throw new Error('La resolución corresponde al perfil propietario de la serie.')
  }
  const projected = projectJournal(full)
  if (projected.some((entry) => !draft.slotsState[entry.target.slotId])) throw new Error('El ejercicio recibido no está en la rutina común.')
  const blocked = new Set(projected.filter((entry) => entry.conflicts.length).map((entry) => targetKey(entry.target)))
  const accepted = new Set(draft.journal!.operations.map((operation) => operation.id))
  const operations = full.operations.filter((operation) => !blocked.has(targetKey(operation.target)) || accepted.has(operation.id))
  const retained = new Set(operations.map((operation) => operation.id))
  const approved = { ...full, operations, pending: full.pending.filter((identifier) => retained.has(identifier)) }
  if (!isSeriesJournal(approved) || projectJournal(approved).some((entry) => entry.conflicts.length)) throw new Error('La recepción no conserva una vista coherente.')
  const rows = projectJournal(approved).filter((entry) => !entry.value.deleted)
  const slotsState = Object.fromEntries(Object.entries(draft.slotsState).map(([slotId, slot]) => {
    const sets = (profileId: ProfileId): SetEntry[] => rows.filter((entry) => entry.target.slotId === slotId && entry.target.profileId === profileId)
      .sort((left, right) => left.value.setNumber - right.value.setNumber || left.target.setId.localeCompare(right.target.setId))
      .map(({ target, value }) => {
        const { deleted: removed, ...fields } = value
        return { ...fields, id: target.setId }
      })
    return [slotId, { ...slot, setsByProfile: { user_1: sets('user_1'), user_2: sets('user_2') } }]
  }))
  const result = JSON.parse(JSON.stringify({ ...draft, slotsState, journal: approved, receivedJournal: blocked.size ? full : undefined })) as WorkoutDraft
  if (!hasCoherentJournal(result)) throw new Error('No se ha aplicado la recepción incoherente.')
  return result
}

export function resolveDraftConflict(
  draft: WorkoutDraft, target: SeriesTarget, expectedHeads: string[], choices: Partial<SeriesValue>, deviceId: string, profileId: ProfileId
): WorkoutDraft {
  const full = getDraftJournal(draft)
  const current = getDraftConflicts(draft).find((entry) => targetKey(entry.target) === targetKey(target))
  if (!full || !current || profileId !== target.profileId || draft.activeProfileId !== profileId) throw new Error('Selecciona el perfil propietario para confirmar su serie.')
  if (canonical([...expectedHeads].sort()) !== canonical([...current.heads].sort())) throw new Error('Las versiones han cambiado. Revísalas de nuevo antes de confirmar.')
  if (Object.keys(choices).length !== current.conflicts.length || current.conflicts.some((conflict) =>
    !(conflict.field in choices) || !conflict.versions.some((version) => canonical(version.value) === canonical(choices[conflict.field])))) {
    throw new Error('Elige una de las versiones recibidas para cada campo contradictorio.')
  }
  return applyReceivedJournal(draft, appendOperation(full, target, choices, deviceId, profileId, 'resolve'))
}

export function applyDraftUpdate(workspace: WorkoutWorkspace, updated: WorkoutDraft): WorkoutWorkspace {
  const previous = workspace.drafts[workspace.activeSessionId]
  const closure = workspace.room?.closure
  if (closure && previous.id === workspace.room?.workoutId && canonical(previous.slotsState) !== canonical(updated.slotsState)) {
    const reviewerCanEdit = closure.phase === 'requested' && closure.initiator !== workspace.deviceId
    const sameStructure = Object.keys(previous.slotsState).length === Object.keys(updated.slotsState).length &&
      Object.entries(previous.slotsState).every(([id, slot]) => {
        const next = updated.slotsState[id]
        return next && slot.syncMode === next.syncMode && canonical(slot.techniqueByProfile) === canonical(next.techniqueByProfile)
      })
    if (!reviewerCanEdit || !sameStructure) return { ...workspace, journalError: 'El cierre está en revisión. Solo la persona que revisa puede corregir las series antes de confirmar.' }
  }
  try {
    const draft = recordDraftChanges(previous, updated, workspace.deviceId!)
    return { ...workspace, journalError: previous.slotsState === updated.slotsState ? workspace.journalError : undefined,
      drafts: { ...workspace.drafts, [workspace.activeSessionId]: draft } }
  } catch {
    return { ...workspace, journalError: 'No se ha aplicado el último cambio porque no se pudo registrar con seguridad. Los resultados anteriores siguen intactos. Descarga una copia desde Ajustes y revisa la serie antes de finalizar.' }
  }
}
