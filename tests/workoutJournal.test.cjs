const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { INITIAL_MESOCYCLE, INITIAL_PROFILES } = require('../src/data/initialData.ts')
const { createWorkoutDraft } = require('../src/utils/workoutState.ts')
const bridge = require('../src/utils/workoutJournal.ts')
const sync = require('../src/services/seriesSync.ts')
const { isWorkoutWorkspace } = require('../src/utils/dataValidation.ts')
const { buildPyramidSets } = require('../src/utils/fitnessMath.ts')
const session = INITIAL_MESOCYCLE.sessions[0]
const slotId = session.slots[0].slotId
const draft = () => bridge.prepareDraft(createWorkoutDraft(session.id, session.slots, INITIAL_PROFILES, 'user_1'))
const update = (previous, mutate) => {
  const next = JSON.parse(JSON.stringify(previous))
  mutate(next.slotsState[slotId].setsByProfile)
  return bridge.recordDraftChanges(previous, next, 'movil-a')
}

test('la migración asigna identidades sin cambiar los resultados existentes', () => {
  const previous = createWorkoutDraft(session.id, session.slots, INITIAL_PROFILES, 'user_1')
  previous.slotsState[slotId].setsByProfile.user_1[0].completed = true
  const first = bridge.prepareDraft(previous)
  const second = bridge.prepareDraft(previous)
  assert.equal(first.slotsState[slotId].setsByProfile.user_1[0].id, second.slotsState[slotId].setsByProfile.user_1[0].id)
  assert.equal(first.slotsState[slotId].setsByProfile.user_1[0].completed, true)
  assert.equal(sync.isSeriesJournal(first.journal), true)
  assert.equal(first.journal.pending.length, 0)
})

test('las ediciones de la pareja quedan en la cola con autor y propietario correctos', () => {
  const previous = draft()
  const next = update(previous, (sets) => { sets.user_2[0].weightKg = 37.5; sets.user_2[0].completed = true })
  assert.equal(next.journal.operations.length, 1)
  assert.equal(next.journal.pending.length, 1)
  const operation = next.journal.operations[0]
  assert.equal(operation.actorProfileId, 'user_1')
  assert.equal(operation.target.profileId, 'user_2')
  assert.equal(operation.target.setId, previous.slotsState[slotId].setsByProfile.user_2[0].id)
})

test('renumerar no cambia identidades y eliminar usa una marca conservada', () => {
  const previous = draft()
  const removedId = previous.slotsState[slotId].setsByProfile.user_1[0].id
  const retainedId = previous.slotsState[slotId].setsByProfile.user_1[1].id
  const next = update(previous, (sets) => { sets.user_1 = sets.user_1.slice(1).map((entry, index) => ({ ...entry, setNumber: index + 1 })) })
  assert.equal(next.slotsState[slotId].setsByProfile.user_1[0].id, retainedId)
  assert.equal(sync.projectJournal(next.journal).find((entry) => entry.target.setId === removedId).value.deleted, true)
})

test('añadir una serie no utiliza su posición como identidad', () => {
  const previous = draft()
  const next = update(previous, (sets) => { sets.user_1.push({ ...sets.user_1[0], id: undefined, setNumber: sets.user_1.length + 1 }) })
  const newEntry = next.slotsState[slotId].setsByProfile.user_1.at(-1)
  assert.notEqual(newEntry.id, previous.slotsState[slotId].setsByProfile.user_1[0].id)
  assert.equal(next.journal.operations.at(-1).kind, 'create')
  assert.equal(sync.isSeriesJournal(next.journal), true)
})

test('recalibrar una pirámide mantiene los identificadores de las series pendientes', () => {
  const previous = draft().slotsState[slotId].setsByProfile.user_1
  const next = buildPyramidSets('pyramid_asc', 100, previous)
  assert.deepEqual(next.slice(0, previous.length).map((entry) => entry.id), previous.map((entry) => entry.id))
})

test('pausas y navegación no generan falsas operaciones de entrenamiento', () => {
  const previous = draft()
  const next = bridge.recordDraftChanges(previous, { ...previous, expandedSlotId: slotId }, 'movil-a')
  assert.equal(next.journal.operations.length, 0)
})

test('finalizar conserva operaciones pendientes fuera del borrador activo', () => {
  const changed = update(draft(), (sets) => { sets.user_1[0].completed = true })
  const archived = bridge.archiveJournal([], changed)
  const workspace = bridge.prepareWorkspace({ version: 1, activeSessionId: 'session-a', drafts: {}, archivedJournals: archived })
  assert.equal(bridge.countPendingOperations(workspace), 1)
  assert.equal(workspace.archivedJournals[0].operations[0].changes.completed, true)
  assert.equal(isWorkoutWorkspace(JSON.parse(JSON.stringify(workspace))), true)
  assert.equal(bridge.archiveJournal(archived, changed).length, 1)
})

test('la migración de workspace conserva la identidad de dispositivo en recargas', () => {
  const first = bridge.prepareWorkspace({ version: 1, activeSessionId: session.id, drafts: { [session.id]: draft() } })
  const second = bridge.prepareWorkspace(JSON.parse(JSON.stringify(first)))
  assert.equal(first.deviceId, second.deviceId)
  assert.equal(isWorkoutWorkspace(second), true)
})

test('la aplicación no conserva el transporte ni los controles del broker público', () => {
  for (const path of ['../src/services/syncService.ts', '../src/App.tsx', '../src/components/OnboardingWizard.tsx', '../src/components/SettingsAndMesocycle.tsx']) {
    const source = readFileSync(require.resolve(path), 'utf8')
    assert.ok(!source.includes('mqtt.connect'))
    assert.ok(!source.includes('broker.emqx.io'))
    assert.ok(!source.includes('liveSyncManager'))
    assert.ok(!source.includes('Conectar Sala'))
    assert.ok(!source.includes('Sala sincronizada:'))
  }
})

test('un diario incompatible con las filas visibles no se acepta como estado guardado', () => {
  const current = draft()
  const workspace = bridge.prepareWorkspace({ version: 1, activeSessionId: session.id, drafts: { [session.id]: current } })
  workspace.drafts[session.id].slotsState[slotId].setsByProfile.user_1[0].weightKg = 999
  assert.equal(isWorkoutWorkspace(workspace), false)
})

test('una operación local inválida no hace fallar la aplicación ni modifica resultados anteriores', () => {
  const current = draft()
  const workspace = bridge.prepareWorkspace({ version: 1, activeSessionId: session.id, drafts: { [session.id]: current } })
  const changed = JSON.parse(JSON.stringify(current))
  changed.slotsState[slotId].setsByProfile.user_1[0].actualReps = -1
  const result = bridge.applyDraftUpdate(workspace, changed)
  assert.ok(result.journalError.includes('No se ha aplicado'))
  assert.deepEqual(result.drafts, workspace.drafts)
  assert.equal(isWorkoutWorkspace(result), true)
})
