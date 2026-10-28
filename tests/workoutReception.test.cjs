const { test } = require('node:test')
const assert = require('node:assert/strict')
const { INITIAL_PROFILES, INITIAL_MESOCYCLE, INITIAL_DEVICE_CONFIG } = require('../src/data/initialData.ts')
const { createWorkoutDraft } = require('../src/utils/workoutState.ts')
const { prepareDraft, prepareWorkspace, applyReceivedJournal, getDraftJournal, getDraftConflicts, getDraftLiveStats,
  resolveDraftConflict, recordDraftChanges, hasCoherentJournal, countPendingOperations, archiveJournal } = require('../src/utils/workoutJournal.ts')
const { appendOperation, mergeRemoteOperations, acknowledgeOperations, canonical, targetKey } = require('../src/services/seriesSync.ts')
const { isWorkoutWorkspace } = require('../src/utils/dataValidation.ts')
const { createWorkoutRoomStore } = require('../src/services/workoutRoomStore.ts')
const { removeCompanionData } = require('../src/utils/companionData.ts')
const clone = (value) => JSON.parse(JSON.stringify(value))
const session = INITIAL_MESOCYCLE.sessions[0]
const slotId = session.slots[0].slotId

function fresh() {
  const draft = createWorkoutDraft(session.id, session.slots, INITIAL_PROFILES, 'user_2')
  for (const slot of Object.values(draft.slotsState)) {
    for (const sets of Object.values(slot.setsByProfile)) sets.forEach((entry) => { entry.weightKg = 0; entry.actualReps = 10 })
  }
  return prepareDraft(draft)
}
const targetFor = (draft, profileId = 'user_2', index = 0) => ({ slotId, profileId, setId: draft.slotsState[slotId].setsByProfile[profileId][index].id })
function conflictFixture() {
  const base = fresh()
  const target = targetFor(base)
  const localJournal = appendOperation(base.journal, target, { weightKg: 40, completed: true }, 'device-a', 'user_1')
  const local = applyReceivedJournal(base, localJournal)
  const other = appendOperation(base.journal, target, { weightKg: 45, completed: true }, 'device-b', 'user_2')
  const full = mergeRemoteOperations(localJournal, other.operations)
  return { base, local, full, target, draft: applyReceivedJournal(local, full) }
}
function workspaceFor(draft) {
  return prepareWorkspace({ version: 1, activeSessionId: draft.sessionId, deviceId: 'device-a', drafts: { [draft.sessionId]: draft } })
}
function storeFixture(draft) {
  let workspace = workspaceFor(draft)
  let saved = JSON.stringify(workspace)
  let fail = false
  const store = createWorkoutRoomStore(draft.id, () => workspace, (next, expected) => {
    assert.equal(expected, workspace)
    if (fail) return false
    assert.equal(isWorkoutWorkspace(next), true)
    saved = JSON.stringify(next)
    workspace = next
    return true
  })
  return { store, get workspace() { return workspace }, get saved() { return saved }, blockWrites(value) { fail = value } }
}

test('una recepción compatible actualiza filas y se recupera desde el mismo workspace', () => {
  const base = fresh()
  const target = targetFor(base)
  const remote = appendOperation(base.journal, target, { weightKg: 45, completed: true }, 'device-b', 'user_1')
  const setup = storeFixture(base)
  assert.equal(setup.store.persist(mergeRemoteOperations(base.journal, remote.operations)), true)
  const loaded = JSON.parse(setup.saved)
  assert.equal(isWorkoutWorkspace(loaded), true)
  assert.equal(loaded.drafts[session.id].slotsState[slotId].setsByProfile.user_2[0].weightKg, 45)
  assert.equal(loaded.drafts[session.id].receivedJournal, undefined)
  assert.equal(getDraftLiveStats(loaded.drafts[session.id], 'user_2').volumeKg, 450)
})

test('40 y 45 kg se conservan, sin sustituir el dato visible ni computarlo como definitivo', () => {
  const { draft, target } = conflictFixture()
  assert.equal(draft.slotsState[slotId].setsByProfile.user_2[0].weightKg, 40)
  assert.equal(getDraftConflicts(draft).length, 1)
  assert.deepEqual(getDraftConflicts(draft)[0].conflicts[0].versions.map((version) => version.value).sort(), [40, 45])
  assert.equal(getDraftLiveStats(draft, target.profileId).volumeKg, 0)
  assert.equal(getDraftLiveStats(draft, target.profileId).completed, 0)
  assert.equal(hasCoherentJournal(draft), true)
  assert.equal(isWorkoutWorkspace(clone(workspaceFor(draft))), true)
})

test('otras series compatibles se aplican aunque una serie permanezca en revisión', () => {
  const { local, full } = conflictFixture()
  const target = targetFor(local, 'user_1')
  const remote = appendOperation(full, target, { weightKg: 20, completed: true }, 'device-b', 'user_2')
  const result = applyReceivedJournal(local, remote)
  assert.equal(getDraftConflicts(result).length, 1)
  assert.equal(getDraftLiveStats(result, 'user_1').volumeKg, 200)
  assert.equal(getDraftLiveStats(result, 'user_2').volumeKg, 0)
})

test('la recepción de un conflicto se guarda y se recuperan ambas versiones tras recargar', () => {
  const { local, full } = conflictFixture()
  const setup = storeFixture(local)
  assert.equal(setup.store.persist(full), true)
  const loaded = JSON.parse(setup.saved)
  assert.equal(isWorkoutWorkspace(loaded), true)
  assert.equal(loaded.drafts[session.id].receivedJournal.operations.length, 2)
  assert.equal(getDraftConflicts(loaded.drafts[session.id]).length, 1)
  assert.deepEqual(setup.store.read(), full)
  assert.equal(countPendingOperations(loaded), full.pending.length)
})

test('fallar el guardado de recepción no cambia la vista ni el diario disponible para confirmar', () => {
  const { local, full } = conflictFixture()
  const setup = storeFixture(local)
  const before = setup.saved
  setup.blockWrites(true)
  assert.equal(setup.store.persist(full), false)
  assert.equal(setup.saved, before)
  assert.equal(setup.workspace.drafts[session.id].receivedJournal, undefined)
  setup.blockWrites(false)
  assert.equal(setup.store.persist(full), true)
})

test('el almacenamiento real rechaza cuota agotada y conserva la última copia guardada', () => {
  const { local, full } = conflictFixture()
  const values = new Map()
  let fail = false
  global.localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => {
    if (fail) throw new Error('Quota exceeded')
    values.set(key, value)
  } }
  delete require.cache[require.resolve('../src/services/storageService.ts')]
  const storage = require('../src/services/storageService.ts')
  let workspace = workspaceFor(local)
  assert.equal(storage.saveWorkoutWorkspace(workspace), true)
  const saved = values.get('kineo_workout_workspace_v1_7')
  const store = createWorkoutRoomStore(local.id, () => workspace, (next) => {
    if (!storage.saveWorkoutWorkspace(next, false)) return false
    workspace = next
    return true
  })
  fail = true
  assert.equal(store.persist(full), false)
  assert.equal(values.get('kineo_workout_workspace_v1_7'), saved)
  assert.equal(workspace.drafts[session.id].receivedJournal, undefined)
  fail = false
  storage.retryStorageWrites()
  assert.equal(values.get('kineo_workout_workspace_v1_7'), saved)
  assert.equal(store.persist(full), true)
  const loaded = storage.loadWorkoutWorkspace()
  assert.equal(getDraftConflicts(loaded.drafts[session.id]).length, 1)
  const current = workspace.drafts[session.id]
  const entry = getDraftConflicts(current)[0]
  const resolved = resolveDraftConflict(current, entry.target, entry.heads, { weightKg: 45 }, 'device-a', 'user_2')
  fail = true
  assert.equal(store.persist(resolved.journal), false)
  fail = false
  storage.retryStorageWrites()
  assert.equal(getDraftConflicts(storage.loadWorkoutWorkspace().drafts[session.id]).length, 1)
  assert.equal(store.persist(resolved.journal), true)
  assert.equal(getDraftConflicts(storage.loadWorkoutWorkspace().drafts[session.id]).length, 0)
})

test('la confirmación del receptor no se confunde con aprobar un conflicto', () => {
  const { draft } = conflictFixture()
  const full = getDraftJournal(draft)
  const result = applyReceivedJournal(draft, acknowledgeOperations(full, full.pending))
  assert.equal(getDraftJournal(result).pending.length, 0)
  assert.equal(getDraftConflicts(result).length, 1)
  assert.equal(getDraftLiveStats(result, 'user_2').completed, 0)
})

test('el perfil propietario puede elegir 45 kg, sin borrar revisiones y dejando su resolución en cola', () => {
  const { draft, target } = conflictFixture()
  const entry = getDraftConflicts(draft)[0]
  const resolved = resolveDraftConflict(draft, target, entry.heads, { weightKg: 45 }, 'device-a', 'user_2')
  assert.equal(resolved.receivedJournal, undefined)
  assert.equal(resolved.slotsState[slotId].setsByProfile.user_2[0].weightKg, 45)
  assert.equal(resolved.journal.operations.length, 3)
  assert.equal(resolved.journal.operations.at(-1).kind, 'resolve')
  assert.equal(resolved.journal.pending.includes(resolved.journal.operations.at(-1).id), true)
  assert.equal(getDraftLiveStats(resolved, 'user_2').volumeKg, 450)
  assert.equal(isWorkoutWorkspace(workspaceFor(resolved)), true)
})

test('también se puede confirmar 40 kg y no se decide por orden de llegada', () => {
  const { draft, target } = conflictFixture()
  const entry = getDraftConflicts(draft)[0]
  const resolved = resolveDraftConflict(draft, target, entry.heads, { weightKg: 40 }, 'device-a', 'user_2')
  assert.equal(getDraftLiveStats(resolved, 'user_2').volumeKg, 400)
  assert.equal(resolved.journal.operations.length, 3)
})

test('otro perfil no puede confirmar; cambiar al propietario permite hacerlo en el móvil compartido', () => {
  const { draft, target } = conflictFixture()
  const entry = getDraftConflicts(draft)[0]
  assert.throws(() => resolveDraftConflict({ ...draft, activeProfileId: 'user_1' }, target, entry.heads, { weightKg: 45 }, 'device-a', 'user_1'), /propietario/)
  assert.throws(() => resolveDraftConflict({ ...draft, activeProfileId: 'user_1' }, target, entry.heads, { weightKg: 45 }, 'device-a', 'user_2'), /propietario/)
  assert.equal(getDraftConflicts(resolveDraftConflict(draft, target, entry.heads, { weightKg: 45 }, 'device-a', 'user_2')).length, 0)
})

test('una revisión antigua no puede sobrescribir una tercera versión recién recibida', () => {
  const { base, draft, target } = conflictFixture()
  const entry = getDraftConflicts(draft)[0]
  const third = appendOperation(base.journal, target, { weightKg: 50 }, 'device-b', 'user_2')
  const newer = applyReceivedJournal(draft, mergeRemoteOperations(getDraftJournal(draft), third.operations))
  assert.throws(() => resolveDraftConflict(newer, target, entry.heads, { weightKg: 45 }, 'device-a', 'user_2'), /versiones han cambiado/)
  assert.equal(getDraftConflicts(newer)[0].conflicts[0].versions.length, 3)
})

test('no se permite confirmar sin elegir, inventar un valor o añadir campos no contradictorios', () => {
  const { draft, target } = conflictFixture()
  const entry = getDraftConflicts(draft)[0]
  for (const choices of [{}, { weightKg: 47 }, { weightKg: 45, completed: false }]) {
    assert.throws(() => resolveDraftConflict(draft, target, entry.heads, choices, 'device-a', 'user_2'), /Elige una/)
  }
})

test('una resolución recibida del propietario actualiza la serie y sus métricas', () => {
  const { draft, target } = conflictFixture()
  const full = getDraftJournal(draft)
  const resolved = appendOperation(full, target, { weightKg: 45 }, 'device-b', 'user_2', 'resolve')
  const result = applyReceivedJournal(draft, mergeRemoteOperations(full, resolved.operations))
  assert.equal(getDraftConflicts(result).length, 0)
  assert.equal(getDraftLiveStats(result, 'user_2').volumeKg, 450)
  assert.equal(result.journal.pending.includes(resolved.operations.at(-1).id), false)
})

test('una resolución remota declarada por otro perfil no se aplica', () => {
  const { draft, target } = conflictFixture()
  const invalid = appendOperation(getDraftJournal(draft), target, { weightKg: 45 }, 'device-b', 'user_1', 'resolve')
  const setup = storeFixture(draft)
  assert.equal(setup.store.persist(invalid), false)
  assert.equal(getDraftConflicts(setup.workspace.drafts[session.id]).length, 1)
})

test('se puede seguir registrando otras series sin perder la contradicción guardada', () => {
  const { draft } = conflictFixture()
  const next = clone(draft)
  next.slotsState[slotId].setsByProfile.user_1[0].weightKg = 25
  next.slotsState[slotId].setsByProfile.user_1[0].completed = true
  const result = recordDraftChanges(draft, next, 'device-a')
  assert.equal(getDraftConflicts(result).length, 1)
  assert.equal(getDraftJournal(result).operations.length, 3)
  assert.equal(getDraftLiveStats(result, 'user_1').volumeKg, 250)
  assert.equal(hasCoherentJournal(result), true)
})

test('no se puede editar o eliminar una serie en revisión desde el formulario normal', () => {
  const { draft } = conflictFixture()
  const next = clone(draft)
  next.slotsState[slotId].setsByProfile.user_2[0].weightKg = 100
  assert.throws(() => recordDraftChanges(draft, next, 'device-a'), /Confirma primero/)
  next.slotsState[slotId].setsByProfile.user_2.shift()
  assert.throws(() => recordDraftChanges(draft, next, 'device-a'), /Confirma primero/)
  assert.throws(() => archiveJournal([], draft), /contradicciones pendientes/)
})

test('la validación rechaza una recepción truncada, otra base o filas que ocultan cambios compatibles', () => {
  const { draft } = conflictFixture()
  const noRevision = clone(draft)
  noRevision.receivedJournal.operations = noRevision.receivedJournal.operations.slice(0, 1)
  assert.equal(isWorkoutWorkspace(workspaceFor(noRevision)), false)
  const wrongBase = clone(draft)
  wrongBase.receivedJournal.baseline[0].value.weightKg = 999
  assert.equal(isWorkoutWorkspace(workspaceFor(wrongBase)), false)
  const hidden = clone(draft)
  hidden.receivedJournal = appendOperation(hidden.receivedJournal, targetFor(hidden, 'user_1'), { weightKg: 30 }, 'device-b', 'user_2')
  assert.equal(isWorkoutWorkspace(workspaceFor(hidden)), false)
})

test('una recepción duplicada es idempotente y el almacén no acepta entrenamiento ajeno o revisiones descartadas', () => {
  const { draft, full, base } = conflictFixture()
  const setup = storeFixture(draft)
  assert.equal(setup.store.persist(full), true)
  const first = setup.saved
  assert.equal(setup.store.persist(full), true)
  assert.equal(setup.saved, first)
  assert.equal(setup.store.persist({ ...full, workoutId: 'otro' }), false)
  assert.equal(setup.store.persist(base.journal), false)
})

test('al cerrar o sustituir el borrador, el almacén antiguo no escribe en una sesión nueva', () => {
  const { local, full } = conflictFixture()
  let workspace = workspaceFor(local)
  let writes = 0
  const store = createWorkoutRoomStore(local.id, () => workspace, () => { writes += 1; return true })
  workspace = workspaceFor(fresh())
  assert.equal(store.persist(full), false)
  assert.throws(() => store.read(), /ya no está abierto/)
  assert.equal(writes, 0)
})

test('el borrado del compañero elimina sus conflictos pero conserva los del titular', () => {
  const { draft } = conflictFixture()
  const data = { config: { ...INITIAL_DEVICE_CONFIG, primaryProfileId: 'user_1' }, profiles: INITIAL_PROFILES,
    history: [], workspace: workspaceFor(draft) }
  const removed = removeCompanionData(data)
  assert.equal(isWorkoutWorkspace(removed.workspace), true)
  assert.equal(removed.workspace.drafts[session.id].receivedJournal, undefined)
  assert.equal(getDraftJournal(removed.workspace.drafts[session.id]).operations.some((operation) => operation.target.profileId === 'user_2'), false)
  const ownerData = removeCompanionData({ ...data, config: { ...data.config, primaryProfileId: 'user_2' } })
  assert.equal(isWorkoutWorkspace(ownerData.workspace), true)
  assert.equal(getDraftConflicts(ownerData.workspace.drafts[session.id]).length, 1)
})

test('la recepción no permite añadir ejercicios fuera de la rutina común', () => {
  const base = fresh()
  const snapshot = base.journal.baseline[0]
  const target = { ...snapshot.target, slotId: 'ejercicio-desconocido', setId: 'nueva' }
  const remote = appendOperation(base.journal, target, snapshot.value, 'device-b', 'user_2', 'create')
  assert.throws(() => applyReceivedJournal(base, remote), /rutina común/)
})

test('una contradicción de eliminación conserva la serie hasta elegir su resultado', () => {
  const { base, local, target } = conflictFixture()
  const deleted = appendOperation(base.journal, target, { deleted: true }, 'device-b', 'user_2')
  const draft = applyReceivedJournal(local, mergeRemoteOperations(local.journal, deleted.operations))
  const entry = getDraftConflicts(draft)[0]
  assert.ok(entry.conflicts.some((conflict) => conflict.field === 'deleted'))
  const resolved = resolveDraftConflict(draft, target, entry.heads, { deleted: true }, 'device-a', 'user_2')
  assert.equal(resolved.slotsState[slotId].setsByProfile.user_2.some((row) => row.id === target.setId), false)
  assert.ok(resolved.journal.operations.some((operation) => targetKey(operation.target) === targetKey(target)))
})

test('todos los campos contradictorios se confirman juntos sin modificar los compatibles', () => {
  const { base, local, target } = conflictFixture()
  const remote = appendOperation(base.journal, target, { weightKg: 45, actualReps: 8, rir: 1 }, 'device-b', 'user_2')
  const localReps = appendOperation(local.journal, target, { actualReps: 12 }, 'device-a', 'user_2')
  const draft = applyReceivedJournal(applyReceivedJournal(local, localReps), mergeRemoteOperations(localReps, remote.operations))
  const entry = getDraftConflicts(draft)[0]
  assert.throws(() => resolveDraftConflict(draft, target, entry.heads, { weightKg: 45 }, 'device-a', 'user_2'), /Elige una/)
  const result = resolveDraftConflict(draft, target, entry.heads, { weightKg: 45, actualReps: 8 }, 'device-a', 'user_2')
  assert.equal(result.slotsState[slotId].setsByProfile.user_2[0].rir, 1)
  assert.equal(getDraftLiveStats(result, 'user_2').volumeKg, 360)
  assert.equal(canonical(getDraftJournal(result).baseline), canonical(base.journal.baseline))
})

test('dos resoluciones simultáneas diferentes vuelven a revisión, sin borrar ninguna aprobación anterior', () => {
  const { draft, target } = conflictFixture()
  const entry = getDraftConflicts(draft)[0]
  const first = resolveDraftConflict(draft, target, entry.heads, { weightKg: 40 }, 'device-a', 'user_2')
  const second = resolveDraftConflict(draft, target, entry.heads, { weightKg: 45 }, 'device-b', 'user_2')
  const received = mergeRemoteOperations(first.journal, second.journal.operations)
  const result = applyReceivedJournal(first, received)
  assert.equal(getDraftConflicts(result).length, 1)
  assert.equal(getDraftJournal(result).operations.filter((operation) => operation.kind === 'resolve').length, 2)
  assert.equal(getDraftLiveStats(result, 'user_2').volumeKg, 0)
})

test('el almacén devuelve copias y no permite modificar el entrenamiento al leer el diario', () => {
  const { draft } = conflictFixture()
  const setup = storeFixture(draft)
  const read = setup.store.read()
  read.operations.length = 0
  assert.equal(setup.store.read().operations.length, 2)
})
