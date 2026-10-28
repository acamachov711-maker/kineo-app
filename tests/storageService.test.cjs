const { test } = require('node:test')
const assert = require('node:assert/strict')
const { INITIAL_PROFILES, INITIAL_MESOCYCLE } = require('../src/data/initialData.ts')
const { createWorkoutDraft } = require('../src/utils/workoutState.ts')

function fixture(initial = {}) {
  const stored = new Map(Object.entries(initial))
  let denyReads = false
  let denyWrites = false
  global.localStorage = {
    getItem(key) { if (denyReads) throw new Error('Sin acceso'); return stored.get(key) ?? null },
    setItem(key, value) { if (denyWrites) throw new Error('Sin espacio'); stored.set(key, value) }
  }
  delete require.cache[require.resolve('../src/services/storageService.ts')]
  return {
    storage: require('../src/services/storageService.ts'), stored,
    blockReads(value) { denyReads = value }, blockWrites(value) { denyWrites = value }
  }
}

test('borrado de compañero persiste solo datos saneados y protege el titular tras recarga', () => {
  const { removeCompanionData } = require('../src/utils/companionData.ts')
  const { storage, stored } = fixture()
  const cleaned = removeCompanionData({ config: storage.loadDeviceConfig(), profiles: storage.loadProfiles(),
    history: storage.loadHistory(), workspace: storage.loadWorkoutWorkspace() })
  assert.deepEqual(storage.persistCompanionRemoval(cleaned), { applied: true, persisted: true })
  assert.deepEqual(storage.loadProfiles(), cleaned.profiles)
  assert.deepEqual(storage.loadHistory(), cleaned.history)
  assert.deepEqual(storage.loadWorkoutWorkspace(), JSON.parse(JSON.stringify(cleaned.workspace)))
  assert.ok(!JSON.parse(stored.get('kineo_history_v1_4')).some((entry) => entry.profileId !== cleaned.config.primaryProfileId))
  assert.equal(JSON.parse(JSON.parse(storage.exportLocalData()).stored.kineo_profiles_v1_4)[cleaned.config.primaryProfileId === 'user_1' ? 'user_2' : 'user_1'].name, 'Perfil sin datos')
})

test('un borrado con cuota agotada no declara éxito y conserva la versión saneada para reintento', () => {
  const { removeCompanionData } = require('../src/utils/companionData.ts')
  const { storage, blockWrites } = fixture()
  const cleaned = removeCompanionData({ config: storage.loadDeviceConfig(), profiles: storage.loadProfiles(),
    history: storage.loadHistory(), workspace: storage.loadWorkoutWorkspace() })
  blockWrites(true)
  assert.deepEqual(storage.persistCompanionRemoval(cleaned), { applied: true, persisted: false })
  blockWrites(false)
  assert.equal(storage.retryStorageWrites(), true)
  assert.deepEqual(storage.loadHistory(), cleaned.history)
})

test('borrado bloqueado ante datos corruptos no sobrescribe el original', () => {
  const { removeCompanionData } = require('../src/utils/companionData.ts')
  const { storage, stored } = fixture({ kineo_history_v1_4: '{roto' })
  const cleaned = removeCompanionData({ config: storage.loadDeviceConfig(), profiles: storage.loadProfiles(),
    history: storage.loadHistory(), workspace: storage.loadWorkoutWorkspace() })
  assert.deepEqual(storage.persistCompanionRemoval(cleaned), { applied: false, persisted: false })
  assert.equal(stored.get('kineo_history_v1_4'), '{roto')
})

test('un fallo parcial del borrado avisa y reintenta sin recuperar datos del compañero', () => {
  const { removeCompanionData } = require('../src/utils/companionData.ts')
  const { storage, stored } = fixture()
  const cleaned = removeCompanionData({ config: storage.loadDeviceConfig(), profiles: storage.loadProfiles(),
    history: storage.loadHistory(), workspace: storage.loadWorkoutWorkspace() })
  const saveItem = global.localStorage.setItem
  global.localStorage.setItem = (key, value) => {
    if (key === 'kineo_history_v1_4') throw new Error('Sin espacio')
    saveItem(key, value)
  }
  assert.deepEqual(storage.persistCompanionRemoval(cleaned), { applied: true, persisted: false })
  assert.equal(JSON.parse(stored.get('kineo_profiles_v1_4'))[cleaned.config.primaryProfileId === 'user_1' ? 'user_2' : 'user_1'].name, 'Perfil sin datos')
  global.localStorage.setItem = saveItem
  assert.equal(storage.retryStorageWrites(), true)
  assert.deepEqual(storage.loadHistory(), cleaned.history)
})

test('una instalación nueva no modifica los datos iniciales compartidos', () => {
  const { storage } = fixture()
  const profiles = storage.loadProfiles()
  profiles.user_1.name = 'Modificado'
  assert.notEqual(INITIAL_PROFILES.user_1.name, 'Modificado')
  assert.notEqual(storage.loadProfiles().user_1.name, 'Modificado')
})

test('migra las claves anteriores sin perder perfiles ni historial', () => {
  const { storage } = fixture({
    kineo_profiles_v1_4: JSON.stringify(INITIAL_PROFILES),
    kineo_history_v1_4: '[]', kineo_active_session_id_v1_4: 'session-b'
  })
  assert.equal(storage.loadProfiles().user_1.name, INITIAL_PROFILES.user_1.name)
  assert.deepEqual(storage.loadHistory(), [])
  assert.equal(storage.loadWorkoutWorkspace().activeSessionId, 'session-b')
  assert.deepEqual(storage.getStorageIssues(), [])
})

test('recupera series de ambos perfiles, descansos y reloj tras recarga', () => {
  const { storage } = fixture()
  const session = INITIAL_MESOCYCLE.sessions[0]
  const draft = createWorkoutDraft(session.id, session.slots, INITIAL_PROFILES, 'user_2')
  const slot = draft.slotsState[session.slots[0].slotId]
  slot.setsByProfile.user_1[0].completed = true
  slot.setsByProfile.user_2[0].weightKg = 37.5
  draft.clock = { elapsedMs: 30000, runningSince: 123456 }
  draft.rest = { secondsLeft: 90, totalSeconds: 120, isRunning: true, endsAt: 999999, label: 'Pareja' }
  const workspace = { version: 1, activeSessionId: session.id, drafts: { [session.id]: draft } }
  assert.equal(storage.saveWorkoutWorkspace(workspace), true)
  assert.deepEqual(storage.loadWorkoutWorkspace(), JSON.parse(JSON.stringify(workspace)))
})

test('un fallo de escritura conserva cambios pendientes y permite reintentar', () => {
  const { storage, stored, blockWrites } = fixture()
  blockWrites(true)
  assert.equal(storage.saveHistory([]), false)
  assert.equal(storage.getStorageIssues()[0].kind, 'write')
  assert.equal(JSON.parse(storage.exportLocalData()).pending.kineo_history_v1_4, '[]')
  blockWrites(false)
  assert.equal(storage.retryStorageWrites(), true)
  assert.equal(stored.get('kineo_history_v1_4'), '[]')
  assert.deepEqual(storage.getStorageIssues(), [])
})

test('un JSON corrupto no se sobrescribe y se incluye íntegro en la copia', () => {
  const { storage, stored } = fixture({ kineo_history_v1_4: '{incompleto' })
  assert.deepEqual(storage.loadHistory(), [])
  assert.equal(storage.saveHistory([]), false)
  assert.equal(stored.get('kineo_history_v1_4'), '{incompleto')
  const backup = JSON.parse(storage.exportLocalData())
  assert.equal(backup.stored.kineo_history_v1_4, '{incompleto')
  assert.equal(backup.pending.kineo_history_v1_4, '[]')
  assert.equal(storage.retryStorageWrites(), false)
})

test('los esquemas incompatibles quedan protegidos, no solo los errores JSON', () => {
  const original = JSON.stringify({ user_1: null, user_2: { name: 'Incompleto' } })
  const { storage, stored } = fixture({ kineo_profiles_v1_4: original })
  const fallback = storage.loadProfiles()
  assert.equal(storage.saveProfiles(fallback), false)
  assert.equal(stored.get('kineo_profiles_v1_4'), original)
  assert.equal(storage.getStorageIssues()[0].kind, 'invalid')
})

test('un error de lectura no permite sustituir datos desconocidos por valores iniciales', () => {
  const { storage, stored, blockReads } = fixture({ kineo_history_v1_4: '["original"]' })
  blockReads(true)
  assert.deepEqual(storage.loadHistory(), [])
  blockReads(false)
  assert.equal(storage.saveHistory([]), false)
  assert.equal(stored.get('kineo_history_v1_4'), '["original"]')
})

test('rechaza borradores incompletos sin guardar un estado ilegible', () => {
  const { storage, stored } = fixture()
  assert.equal(storage.saveWorkoutWorkspace({ version: 1, activeSessionId: 'a', drafts: { a: {} } }), false)
  assert.equal(stored.has('kineo_workout_workspace_v1_7'), false)
})

test('la cola de operaciones se recupera y se incluye en la copia de seguridad', () => {
  const { prepareWorkspace, applyDraftUpdate } = require('../src/utils/workoutJournal.ts')
  const { storage } = fixture()
  const session = INITIAL_MESOCYCLE.sessions[0]
  const workspace = prepareWorkspace({ version: 1, activeSessionId: session.id, drafts: {
    [session.id]: createWorkoutDraft(session.id, session.slots, INITIAL_PROFILES, 'user_1')
  } })
  const changed = JSON.parse(JSON.stringify(workspace.drafts[session.id]))
  changed.slotsState[session.slots[0].slotId].setsByProfile.user_2[0].completed = true
  const updated = applyDraftUpdate(workspace, changed)
  assert.equal(storage.saveWorkoutWorkspace(updated), true)
  assert.deepEqual(storage.loadWorkoutWorkspace(), JSON.parse(JSON.stringify(updated)))
  const backup = JSON.parse(storage.exportLocalData())
  const recovered = JSON.parse(backup.stored.kineo_workout_workspace_v1_7)
  assert.equal(recovered.drafts[session.id].journal.pending.length, 1)
  assert.equal(recovered.drafts[session.id].journal.operations[0].target.profileId, 'user_2')
})
