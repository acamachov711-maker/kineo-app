const { test } = require('node:test')
const assert = require('node:assert/strict')
const { INITIAL_PROFILES, INITIAL_MESOCYCLE, INITIAL_DEVICE_CONFIG } = require('../src/data/initialData.ts')
const { createWorkoutDraft, buildSessionState } = require('../src/utils/workoutState.ts')
const { prepareWorkspace, prepareOnboardingWorkspace, recordDraftChanges } = require('../src/utils/workoutJournal.ts')
const { canonical } = require('../src/services/seriesSync.ts')
const { buildRoomContext, roomDifference, createHostRoom, bindHostPeer, createRoomOffer, adoptRoomOffer, validateRoomOffer, createBoundRoomStore, sharedRoomProfile } = require('../src/services/roomSession.ts')
const { isWorkoutWorkspace } = require('../src/utils/dataValidation.ts')
const { removeCompanionData } = require('../src/utils/companionData.ts')
const clone = (value) => JSON.parse(JSON.stringify(value))
const session = { ...INITIAL_MESOCYCLE.sessions[0], slots: INITIAL_MESOCYCLE.sessions[0].slots.slice(0, 1) }
const profiles = clone(INITIAL_PROFILES)
profiles.user_1.name = 'Alex'
profiles.user_2.name = 'Sam'
function workspace(deviceId) {
  return prepareWorkspace({ version: 1, activeSessionId: session.id, deviceId,
    drafts: { [session.id]: createWorkoutDraft(session.id, session.slots, profiles, deviceId === 'device-a' ? 'user_1' : 'user_2') } })
}
function paired() {
  const host = workspace('device-a')
  const context = buildRoomContext(session, profiles, host.drafts[session.id])
  const bound = bindHostPeer(createHostRoom(host, context), 'device-b')
  return { host: bound, offer: createRoomOffer(bound), guest: workspace('device-b'), context }
}

test('la comparación de sala ignora pesos personales, IDs locales y propiedad del dispositivo', () => {
  const host = workspace('device-a')
  const guest = workspace('device-b')
  const otherProfiles = clone(profiles)
  otherProfiles.user_1.isDeviceOwner = false
  otherProfiles.user_1.bodyWeightKg = 123
  guest.drafts[session.id].slotsState[session.slots[0].slotId].setsByProfile.user_1[0].weightKg = 12
  const own = buildRoomContext(session, profiles, host.drafts[session.id])
  const other = buildRoomContext(session, otherProfiles, guest.drafts[session.id])
  assert.equal(own, other)
  assert.equal(roomDifference(own, other), null)
  assert.ok(!own.includes('bodyWeightKg') && !own.includes('estimated1RM'))
})

test('la descripción compartida solo contiene nombre, color y ejercicios del perfil', () => {
  const data = workspace('device-a')
  const person = clone(profiles.user_1)
  person.age = 42; person.bodyWeightKg = 77; person.heightCm = 175
  person.goal = 'objetivo privado'; person.gender = 'female'
  person.estimated1RMByVariant = { 'ex-a1-main': 123 }
  const shared = sharedRoomProfile(person, session, data.drafts[session.id])
  assert.deepEqual(Object.keys(shared).sort(), ['color', 'exercises', 'name'])
  const description = buildRoomContext(session, { ...profiles, user_1: person }, data.drafts[session.id])
  const exported = JSON.parse(description).profiles[0]
  assert.deepEqual(Object.keys(exported).sort(), ['color', 'exercises', 'id', 'name'])
  assert.ok(!('gender' in exported) && !('age' in exported) && !('bodyWeightKg' in exported) && !('heightCm' in exported) && !('goal' in exported) && !('estimated1RMByVariant' in exported))
})

test('distingue rutina, perfiles, variantes y estructura sin cambiar ninguna selección', () => {
  const guest = workspace('device-b')
  const draft = guest.drafts[session.id]
  const context = buildRoomContext(session, profiles, draft)
  const before = canonical(guest)
  assert.equal(roomDifference(context, buildRoomContext({ ...session, title: 'Otra rutina' }, profiles, draft)), 'routine')
  const otherProfiles = clone(profiles)
  otherProfiles.user_1.name = 'Otro participante'
  assert.equal(roomDifference(context, buildRoomContext(session, otherProfiles, draft)), 'profiles')
  const changed = clone(draft)
  changed.slotsState[session.slots[0].slotId].techniqueByProfile.user_1 = 'failure'
  assert.equal(roomDifference(context, buildRoomContext(session, profiles, changed)), 'routine')
  assert.equal(canonical(guest), before)
})

test('no vincula perfiles con nombres indistinguibles', () => {
  const identical = clone(profiles)
  identical.user_2.name = identical.user_1.name.toUpperCase()
  const current = workspace('device-b')
  const context = buildRoomContext(session, identical, current.drafts[session.id])
  assert.equal(roomDifference(context, context), 'profiles')
})

test('crear y vincular una sala no muta el workspace y limita el vínculo a dos dispositivos', () => {
  const data = paired()
  assert.ok(isWorkoutWorkspace(data.host))
  assert.equal(data.host.room.role, 'host')
  assert.equal(data.host.room.peerDeviceId, 'device-b')
  assert.throws(() => bindHostPeer(data.host, 'device-c'), /otro teléfono/)
  assert.throws(() => bindHostPeer(data.host, 'device-a'), /no es válido/)
  assert.throws(() => createHostRoom(data.host, data.context), /Sal de/)
  assert.equal(workspace('device-a').room, undefined)
})

test('revisar una oferta no aplica datos y adoptar conserva perfiles, otros borradores y archivos', () => {
  const { offer, guest } = paired()
  const other = INITIAL_MESOCYCLE.sessions[1]
  guest.drafts[other.id] = createWorkoutDraft(other.id, other.slots, profiles, 'user_2')
  const before = canonical(guest)
  const beforeProfiles = canonical(profiles)
  validateRoomOffer(offer)
  assert.equal(canonical(guest), before)
  const adopted = adoptRoomOffer(guest, offer, session, profiles)
  assert.ok(isWorkoutWorkspace(adopted))
  assert.equal(adopted.drafts[session.id].id, offer.draft.id)
  assert.equal(adopted.drafts[session.id].activeProfileId, 'user_2')
  assert.equal(adopted.room.peerDeviceId, 'device-a')
  assert.deepEqual(adopted.drafts[other.id], guest.drafts[other.id])
  assert.deepEqual(adopted.archivedJournals, guest.archivedJournals)
  assert.equal(canonical(profiles), beforeProfiles)
  assert.equal(canonical(guest), before)
  assert.ok(isWorkoutWorkspace(JSON.parse(JSON.stringify(adopted))))
})

test('la configuración inicial no crea operaciones falsas que bloqueen la unión', () => {
  const { offer, guest } = paired()
  const prior = guest.drafts[session.id]
  const oldFlow = recordDraftChanges(prior, { ...prior, slotsState: buildSessionState(session.slots, profiles) }, 'device-b')
  assert.ok(oldFlow.journal.operations.length > 0, 'reproduce el bloqueo de la configuración anterior')
  assert.throws(() => adoptRoomOffer({ ...guest, drafts: { [session.id]: oldFlow } }, offer, session, profiles), /No los sobrescribimos/)

  const initialized = prepareOnboardingWorkspace(guest, session, profiles, 'user_2')
  assert.equal(initialized.drafts[session.id].journal.operations.length, 0)
  assert.equal(initialized.drafts[session.id].journal.pending.length, 0)
  assert.equal(initialized.drafts[session.id].activeProfileId, 'user_2')
  assert.ok(isWorkoutWorkspace(initialized))
  assert.equal(adoptRoomOffer(initialized, offer, session, profiles).room.role, 'guest')
})

test('configurar perfiles conserva el diario previo y no reinicia sesiones registradas o vinculadas', () => {
  const { guest, host } = paired()
  const previous = guest.drafts[session.id]
  const changed = clone(previous)
  changed.slotsState[session.slots[0].slotId].setsByProfile.user_1[0].weightKg += 5
  guest.drafts[session.id] = recordDraftChanges(previous, changed, 'device-b')
  const initialized = prepareOnboardingWorkspace(guest, session, profiles, 'user_2')
  assert.deepEqual(initialized.archivedJournals[0], guest.drafts[session.id].journal)
  assert.ok(isWorkoutWorkspace(initialized))
  assert.throws(() => prepareOnboardingWorkspace(host, session, profiles, 'user_1'), /sala/)
  guest.drafts[session.id].isWorkoutStarted = true
  assert.throws(() => prepareOnboardingWorkspace(guest, session, profiles, 'user_2'), /entrenamiento en curso/)
})

test('una rutina distinta se bloquea incluso después de recibir una oferta válida', () => {
  const { offer, guest } = paired()
  const before = canonical(guest)
  assert.throws(() => adoptRoomOffer(guest, offer, { ...session, title: 'Diferente' }, profiles), /no coinciden/)
  const otherProfiles = clone(profiles)
  otherProfiles.user_2.name = 'Otra persona'
  assert.throws(() => adoptRoomOffer(guest, offer, session, otherProfiles), /no coinciden/)
  assert.equal(canonical(guest), before)
})

test('no sobrescribe cambios, registros, tiempo transcurrido ni un entrenamiento iniciado', () => {
  for (const modify of [
    (draft) => { draft.isWorkoutStarted = true },
    (draft) => { draft.clock.elapsedMs = 1 },
    (draft) => { draft.clock.runningSince = Date.now() },
    (draft) => { draft.slotsState[session.slots[0].slotId].setsByProfile.user_2[0].completed = true },
    (draft) => { draft.slotsState[session.slots[0].slotId].setsByProfile.user_2[0].weightKg += 1 }
  ]) {
    const { offer, guest } = paired()
    const changed = clone(guest.drafts[session.id])
    modify(changed)
    guest.drafts[session.id] = recordDraftChanges(guest.drafts[session.id], changed, 'device-b')
    const before = canonical(guest)
    assert.throws(() => adoptRoomOffer(guest, offer, session, profiles), /No los sobrescribimos/)
    assert.equal(canonical(guest), before)
  }
})

test('adoptar conserva las revisiones del creador pero no duplica su cola ni su reloj', () => {
  const data = paired()
  const previous = data.host.drafts[session.id]
  const changed = clone(previous)
  changed.slotsState[session.slots[0].slotId].setsByProfile.user_1[0].completed = true
  data.host.drafts[session.id] = recordDraftChanges(previous, changed, 'device-a')
  const offer = createRoomOffer(data.host)
  const adopted = adoptRoomOffer(data.guest, offer, session, profiles)
  assert.equal(adopted.drafts[session.id].journal.operations.length, 1)
  assert.equal(adopted.drafts[session.id].journal.pending.length, 0)
  assert.deepEqual(adopted.drafts[session.id].clock, { elapsedMs: 0, runningSince: null })
  assert.equal(data.host.drafts[session.id].journal.pending.length, 1)
})

test('rechaza ofertas malformadas, IDs duplicados y dispositivos ajenos', () => {
  const { offer, guest } = paired()
  assert.throws(() => validateRoomOffer({ ...offer, profiles }), /no es válida/)
  assert.throws(() => validateRoomOffer({ ...offer, draft: { ...offer.draft, history: [] } }), /no es válida/)
  assert.throws(() => validateRoomOffer({ ...offer, draft: { ...offer.draft, journal: undefined } }), /no es válida/)
  assert.throws(() => adoptRoomOffer(guest, { ...offer, hostDeviceId: 'device-b' }, session, profiles), /no vinculados/)
  guest.archivedJournals = [offer.draft.journal]
  assert.throws(() => adoptRoomOffer(guest, offer, session, profiles), /ya existe/)
})

test('valida el vínculo persistido y salir conserva registros y diarios', () => {
  const { offer, guest } = paired()
  const joined = adoptRoomOffer(guest, offer, session, profiles)
  for (const change of [{ role: 'other' }, { peerDeviceId: 'device-b' }, { workoutId: 'missing' }, { context: '' }, { peerDeviceId: undefined }]) {
    assert.equal(isWorkoutWorkspace({ ...joined, room: { ...joined.room, ...change } }), false)
  }
  const detached = { ...joined, room: undefined }
  assert.ok(isWorkoutWorkspace(detached))
  assert.deepEqual(detached.drafts, joined.drafts)
  assert.deepEqual(detached.archivedJournals, joined.archivedJournals)
})

test('el borrado local del compañero desvincula la sala sin borrar los registros propios', () => {
  const { host } = paired()
  const removed = removeCompanionData({ config: INITIAL_DEVICE_CONFIG, profiles, history: [], workspace: host })
  assert.equal(removed.workspace.room, undefined)
  assert.ok(isWorkoutWorkspace(removed.workspace))
})

test('un almacén de sala retirado no lee ni guarda tras salir, cambiar la base o sustituir al compañero', () => {
  for (const modify of [
    (workspace) => ({ ...workspace, room: undefined }),
    (workspace) => ({ ...workspace, room: { ...workspace.room, peerDeviceId: 'device-c' } }),
    (workspace) => ({ ...workspace, room: { ...workspace.room, workoutId: 'workout-other' } }),
    (workspace) => ({ ...workspace, room: { ...workspace.room, context: 'changed' } })
  ]) {
    let current = paired().host
    let writes = 0
    const binding = current.room
    const store = createBoundRoomStore(binding, () => current, () => binding.context, {
      read: () => current.drafts[session.id].journal, persist: () => { writes += 1; return true }
    })
    assert.ok(store.read())
    current = modify(current)
    assert.throws(() => store.read(), /cambió/)
    assert.equal(store.persist({}), false)
    assert.equal(writes, 0)
  }
})

test('el intercambio no guarda recepciones hasta que se ha persistido el perfil de la pareja', () => {
  let current = workspace('device-a')
  const context = buildRoomContext(session, profiles, current.drafts[session.id])
  current = createHostRoom(current, context)
  const draft = current.drafts[session.id]
  current = bindHostPeer(current, 'device-b', { ownerProfileId: 'user_1', peerOwnerId: 'user_1',
    ownerProfile: sharedRoomProfile(profiles.user_1, session, draft), peerProfile: sharedRoomProfile(profiles.user_2, session, draft) })
  let writes = 0
  const store = createBoundRoomStore(current.room, () => current, () => context, { read: () => draft.journal, persist: () => { writes++; return true } })
  assert.ok(store.read())
  assert.equal(store.persist(draft.journal), false)
  assert.equal(writes, 0)
  current = { ...current, room: { ...current.room, peerReady: true, peerApplied: true } }
  assert.equal(store.persist(draft.journal), true)
  assert.equal(writes, 1)
})

test('un cambio de configuración pausa el almacén sin aplicar recepciones a otra rutina', () => {
  const current = paired().host
  const binding = current.room
  let context = binding.context
  let writes = 0
  const store = createBoundRoomStore(binding, () => current, () => context, {
    read: () => current.drafts[session.id].journal, persist: () => { writes += 1; return true }
  })
  assert.equal(store.persist(current.drafts[session.id].journal), true)
  context = 'different-routine'
  assert.equal(store.persist({}), false)
  assert.equal(writes, 1)
})
