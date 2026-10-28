const { test } = require('node:test')
const assert = require('node:assert/strict')
const { INITIAL_PROFILES, INITIAL_MESOCYCLE } = require('../src/data/initialData.ts')
const { createWorkoutDraft } = require('../src/utils/workoutState.ts')
const { prepareWorkspace, recordDraftChanges, applyReceivedJournal, applyDraftUpdate } = require('../src/utils/workoutJournal.ts')
const { acknowledgeOperations, mergeRemoteOperations } = require('../src/services/seriesSync.ts')
const { buildRoomContext, independentRoomContext, createHostRoom, bindHostPeer, swapDraftProfiles, swapJournalProfiles } = require('../src/services/roomSession.ts')
const { sharedRoomProfile } = require('../src/services/sharedRoomProfile.ts')
const { isWorkoutWorkspace } = require('../src/utils/dataValidation.ts')
const { requestRoomClosure, confirmRoomClosure, receiveClosure, wireClosure, sharedClosureHistory, closureRevision, refreshRoomClosureIfNeeded } = require('../src/services/roomClosure.ts')
const { mapRoomHistory, mergeRoomHistory } = require('../src/services/roomHistory.ts')
const { createMqttRoomTransport, PUBLIC_MQTT_BROKER_URL } = require('../src/services/mqttRoomTransport.ts')
const { createWorkoutRoomStore } = require('../src/services/workoutRoomStore.ts')
const { mapRoomStoreProfiles } = require('../src/services/roomSession.ts')
const { EventEmitter } = require('node:events')
const React = require('react')
const { renderToString } = require('react-dom/server')
const { PublicRoomPanel } = require('../src/components/PublicRoomPanel.tsx')
const clone = (value) => JSON.parse(JSON.stringify(value))
const session = { ...INITIAL_MESOCYCLE.sessions[0], slots: INITIAL_MESOCYCLE.sessions[0].slots.slice(0, 1) }
const profiles = clone(INITIAL_PROFILES)
profiles.user_1.name = 'Alex'; profiles.user_2.name = 'Sam'

function fixture() {
  let a = prepareWorkspace({ version: 1, activeSessionId: session.id, deviceId: 'device-a', drafts: {
    [session.id]: createWorkoutDraft(session.id, session.slots, profiles, 'user_1')
  } })
  const before = a.drafts[session.id], changed = clone(before)
  Object.assign(changed.slotsState[session.slots[0].slotId].setsByProfile.user_1[0], { completed: true, weightKg: 40, actualReps: 10 })
  Object.assign(changed.slotsState[session.slots[0].slotId].setsByProfile.user_2[0], { completed: true, weightKg: 25, actualReps: 8 })
  const edited = recordDraftChanges(before, changed, 'device-a')
  const acked = acknowledgeOperations(edited.journal, edited.journal.pending)
  a.drafts[session.id] = applyReceivedJournal(edited, acked)
  const draft = a.drafts[session.id]
  const context = independentRoomContext(buildRoomContext(session, profiles, draft))
  a = bindHostPeer(createHostRoom(a, context), 'device-b', { ownerProfileId: 'user_1', peerOwnerId: 'user_1',
    ownerProfile: sharedRoomProfile(profiles.user_1, session, draft), peerProfile: sharedRoomProfile(profiles.user_2, session, draft) })
  a.room = { ...a.room, peerReady: true, peerApplied: true }
  const b = { ...clone(a), deviceId: 'device-b', drafts: { [session.id]: swapDraftProfiles(a.drafts[session.id]) },
    room: { ...a.room, role: 'guest', peerDeviceId: 'device-a', profilesSwapped: true,
      ownerProfile: a.room.peerProfile, peerProfile: a.room.ownerProfile } }
  assert.equal(isWorkoutWorkspace(a), true); assert.equal(isWorkoutWorkspace(b), true)
  return { a, b }
}

test('cierre sin conexión queda pendiente y solo se finaliza tras la confirmación explícita', async () => {
  let { a, b } = fixture()
  a = await requestRoomClosure(a, '2026-10-27', 32)
  assert.equal(a.room.closure.phase, 'requested')
  assert.equal(a.drafts[session.id].isWorkoutStarted, false)
  assert.equal(a.drafts[session.id].clock.runningSince, null)
  assert.equal(isWorkoutWorkspace(JSON.parse(JSON.stringify(a))), true)
  b = await receiveClosure(b, wireClosure(a.room.closure))
  assert.equal(b.room.closure.phase, 'requested')
  assert.throws(() => sharedClosureHistory(a.room.closure, a.drafts[session.id], session, profiles, false), /confirmado/)
  b = await confirmRoomClosure(b)
  assert.equal(b.room.closure.phase, 'confirmed')
  a = await receiveClosure(a, wireClosure(b.room.closure))
  assert.equal(a.room.closure.phase, 'committed')
  b = await receiveClosure(b, wireClosure(a.room.closure))
  assert.equal(b.room.closure.phase, 'committed')
  const bProfiles = { user_1: { ...profiles.user_2, id: 'user_1' }, user_2: { ...profiles.user_1, id: 'user_2' } }
  const aHistory = sharedClosureHistory(a.room.closure, a.drafts[session.id], session, profiles, false)
  const bHistory = sharedClosureHistory(b.room.closure, b.drafts[session.id], session, bProfiles, true)
  assert.deepEqual(mapRoomHistory(bHistory, true).sort((x, y) => x.id.localeCompare(y.id)), aHistory.sort((x, y) => x.id.localeCompare(y.id)))
  assert.deepEqual(mergeRoomHistory(aHistory, mapRoomHistory(bHistory, true)), aHistory)
  assert.equal((await receiveClosure(b, wireClosure(a.room.closure))), b)
})

test('pide registrar una serie y rechaza una bajada completada con la serie principal pendiente', async () => {
  let { a } = fixture()
  const original = a.drafts[session.id], changed = clone(original)
  for (const person of ['user_1', 'user_2']) for (const entry of changed.slotsState[session.slots[0].slotId].setsByProfile[person]) entry.completed = false
  a.drafts[session.id] = recordDraftChanges(original, changed, 'device-a')
  await assert.rejects(requestRoomClosure(a, '2026-10-27', 10), /al menos una serie/)
  const orphan = clone(a.drafts[session.id]); orphan.slotsState[session.slots[0].slotId].setsByProfile.user_1[0].completed = true
  orphan.slotsState[session.slots[0].slotId].setsByProfile.user_1[1].drops = [{ id: 'drop', weightKg: 10, reps: 5, completed: true }]
  a.drafts[session.id] = recordDraftChanges(a.drafts[session.id], orphan, 'device-a')
  await assert.rejects(requestRoomClosure(a, '2026-10-27', 10), /bajadas/)
})

test('impide confirmar con operaciones sin entregar o con una revisión distinta', async () => {
  let { a, b } = fixture()
  a = await requestRoomClosure(a, '2026-10-27', 22)
  b = await receiveClosure(b, wireClosure(a.room.closure))
  const original = b.drafts[session.id], changed = clone(original)
  changed.slotsState[session.slots[0].slotId].setsByProfile.user_1[1].weightKg = 33
  b.drafts[session.id] = recordDraftChanges(original, changed, 'device-b')
  await assert.rejects(confirmRoomClosure(b), /sin confirmar/)
  const journal = b.drafts[session.id].journal
  b.drafts[session.id] = applyReceivedJournal(b.drafts[session.id], acknowledgeOperations(journal, journal.pending))
  await assert.rejects(confirmRoomClosure(b), /cambiaron/)
})

test('al reconectar, las series extra compatibles se unen y la solicitud se actualiza sin tocar el otro perfil', async () => {
  let { a, b } = fixture()
  a = await requestRoomClosure(a, '2026-10-27', 22)
  const before = b.drafts[session.id], edited = clone(before)
  const slotId = session.slots[0].slotId
  Object.assign(edited.slotsState[slotId].setsByProfile.user_1[1], { completed: true, weightKg: 33, actualReps: 8 })
  b.drafts[session.id] = recordDraftChanges(before, edited, 'device-b')
  b = await receiveClosure(b, wireClosure(a.room.closure))
  const bJournal = b.drafts[session.id].journal
  const incoming = swapJournalProfiles(bJournal).operations
  const aDraft = a.drafts[session.id]
  a.drafts[session.id] = applyReceivedJournal(aDraft, mergeRemoteOperations(aDraft.journal, incoming))
  b.drafts[session.id] = applyReceivedJournal(b.drafts[session.id], acknowledgeOperations(bJournal, bJournal.pending))
  assert.equal(a.drafts[session.id].slotsState[slotId].setsByProfile.user_2[1].weightKg, 33)
  assert.equal(a.drafts[session.id].slotsState[slotId].setsByProfile.user_2[1].completed, true)
  assert.equal(a.drafts[session.id].slotsState[slotId].setsByProfile.user_1[1].completed, false)
  await assert.rejects(confirmRoomClosure(b), /sincronizar/)
  const updated = await refreshRoomClosureIfNeeded(a)
  assert.equal(updated.room.closure.round, a.room.closure.round + 1)
  assert.equal(await refreshRoomClosureIfNeeded(updated), updated)
  b = await receiveClosure(b, wireClosure(updated.room.closure))
  b = await confirmRoomClosure(b)
  assert.equal((await receiveClosure(updated, wireClosure(b.room.closure))).room.closure.phase, 'committed')
})

test('el panel orienta a la revisión de ejercicios sin cerrar desde el resumen', async () => {
  let { a, b } = fixture()
  a = await requestRoomClosure(a, '2026-10-27', 32)
  b = await receiveClosure(b, wireClosure(a.room.closure))
  const render = (workspace, selectedProfiles) => renderToString(React.createElement(PublicRoomPanel, {
    connection: { room: workspace.room, enabled: true, offer: null, pendingCode: null, invitation: null,
      pairing: { phase: 'waiting', message: '' }, transport: null, error: '', closureReadiness: 'ready', reconnect() {}, leave() {}, confirmClosure() {}, requestClosure() {} },
    sessions: [session], selectedSessionId: session.id, selectSession() {}, onReviewClosure() {}, workspace, profiles: selectedProfiles
  }))
  const bProfiles = { user_1: { ...profiles.user_2, id: 'user_1' }, user_2: { ...profiles.user_1, id: 'user_2' } }
  const initiator = render(a, profiles), receiver = render(b, bProfiles)
  assert.ok(!initiator.includes('data-od-id="room-confirm-closure"'))
  assert.ok(!receiver.includes('data-od-id="room-confirm-closure"'))
  assert.ok(receiver.includes('data-od-id="room-short-code"'))
  assert.ok(receiver.includes('data-od-id="room-review-exercises"'))
  assert.match(receiver, /Revisar ejercicios y series/)
})

test('la persona que revisa corrige la serie y confirma solo tras sincronizar la nueva revisión', async () => {
  let { a, b } = fixture()
  a = await requestRoomClosure(a, '2026-10-27', 22)
  const old = wireClosure(a.room.closure)
  b = await receiveClosure(b, old)
  const slotId = session.slots[0].slotId
  const correction = clone(b.drafts[session.id])
  Object.assign(correction.slotsState[slotId].setsByProfile.user_1[0], { weightKg: 35, actualReps: 9 })
  b = applyDraftUpdate(b, correction)
  assert.equal(b.drafts[session.id].slotsState[slotId].setsByProfile.user_1[0].weightKg, 35)
  assert.ok(b.drafts[session.id].journal.pending.length)
  await assert.rejects(confirmRoomClosure(b), /sin confirmar/)
  const pendingJournal = b.drafts[session.id].journal
  const hostDraft = a.drafts[session.id]
  a.drafts[session.id] = applyReceivedJournal(hostDraft, mergeRemoteOperations(hostDraft.journal, swapJournalProfiles(pendingJournal).operations))
  b.drafts[session.id] = applyReceivedJournal(b.drafts[session.id], acknowledgeOperations(pendingJournal, pendingJournal.pending))
  await assert.rejects(confirmRoomClosure(b), /cambiaron/)
  a = await refreshRoomClosureIfNeeded(a)
  assert.equal(a.room.closure.round, old.round + 1)
  b = await receiveClosure(b, wireClosure(a.room.closure))
  b = await confirmRoomClosure(b)
  const attemptedAfterConfirmation = clone(b.drafts[session.id])
  attemptedAfterConfirmation.slotsState[slotId].setsByProfile.user_1[0].weightKg = 99
  const denied = applyDraftUpdate(b, attemptedAfterConfirmation)
  assert.equal(denied.drafts[session.id].slotsState[slotId].setsByProfile.user_1[0].weightKg, 35)
  a = await receiveClosure(a, wireClosure(b.room.closure))
  b = await receiveClosure(b, wireClosure(a.room.closure))
  const bProfiles = { user_1: { ...profiles.user_2, id: 'user_1' }, user_2: { ...profiles.user_1, id: 'user_2' } }
  const aHistory = sharedClosureHistory(a.room.closure, a.drafts[session.id], session, profiles, false)
  const bHistory = mapRoomHistory(sharedClosureHistory(b.room.closure, b.drafts[session.id], session, bProfiles, true), true)
  assert.deepEqual(bHistory.sort((x, y) => x.id.localeCompare(y.id)), aHistory.sort((x, y) => x.id.localeCompare(y.id)))
  assert.equal(aHistory.find((item) => item.profileId === 'user_2').totalVolumeKg, 315)
})

test('en revisión se bloquean cambios de estructura y se valida que aún existan series registradas', async () => {
  let { a, b } = fixture()
  a = await requestRoomClosure(a, '2026-10-27', 22)
  b = await receiveClosure(b, wireClosure(a.room.closure))
  const slotId = session.slots[0].slotId
  const changedStructure = clone(b.drafts[session.id])
  changedStructure.slotsState[slotId].techniqueByProfile.user_1 = 'failure'
  assert.match(applyDraftUpdate(b, changedStructure).journalError, /revisión/)
  const empty = clone(b.drafts[session.id])
  for (const values of Object.values(empty.slotsState[slotId].setsByProfile)) for (const set of values) set.completed = false
  b = applyDraftUpdate(b, empty)
  await assert.rejects(confirmRoomClosure(b), /al menos una serie/)
})

test('recibir el mensaje no equivale a confirmar y no acepta cierres falsos ni atrasados', async () => {
  let { a, b } = fixture()
  a = await requestRoomClosure(a, '2026-10-27', 32)
  const old = wireClosure(a.room.closure)
  b = await receiveClosure(b, old)
  await assert.rejects(receiveClosure(b, { ...old, phase: 'committed' }), /Primero/)
  await assert.rejects(receiveClosure(b, { ...old, initiator: 'intruder' }), /no pertenece/)
  a = await requestRoomClosure(a, '2026-10-27', 32)
  b = await receiveClosure(b, wireClosure(a.room.closure))
  assert.equal(b.room.closure.round, 2)
  b = await receiveClosure(b, old)
  assert.equal(b.room.closure.round, 2)
  await assert.rejects(receiveClosure(a, { ...old, phase: 'confirmed' }), /actual/)
})

test('solicitudes simultáneas convergen y el iniciador elegido no puede editar durante la revisión', async () => {
  for (const aWins of [true, false]) {
    let { a, b } = fixture()
    a = await requestRoomClosure(a, '2026-10-27', 32)
    b = await requestRoomClosure(b, '2026-10-27', 30)
    a.room.closure.id = aWins ? 'closure-a' : 'closure-z'
    b.room.closure.id = aWins ? 'closure-z' : 'closure-a'
    const ac = wireClosure(a.room.closure), bc = wireClosure(b.room.closure)
    a = await receiveClosure(a, bc); b = await receiveClosure(b, ac)
    assert.equal(a.room.closure.id, b.room.closure.id)
    assert.equal(a.room.closure.initiator, aWins ? a.deviceId : b.deviceId)
    const initiator = aWins ? a : b
    const originalWeight = initiator.drafts[session.id].slotsState[session.slots[0].slotId].setsByProfile.user_1[0].weightKg
    const changed = clone(initiator.drafts[session.id])
    changed.slotsState[session.slots[0].slotId].setsByProfile.user_1[0].weightKg = 99
    const guarded = applyDraftUpdate(initiator, changed)
    assert.equal(guarded.drafts[session.id].slotsState[session.slots[0].slotId].setsByProfile.user_1[0].weightKg, originalWeight)
    assert.match(guarded.journalError, /cierre/)
    assert.equal(await closureRevision(a.drafts[session.id].journal), await closureRevision(b.drafts[session.id].journal, true))
  }
})

test('el transporte reenvía un cierre iniciado sin red y confirma solo después de guardarlo en ambos móviles', async () => {
  const initial = fixture(), state = { a: initial.a, b: initial.b }, messages = [], clients = [], published = []
  let rejectOnB = true
  const connector = () => {
    const port = new EventEmitter()
    port.subscribe = (topic, options, callback) => { port.topic = topic; callback(null, [{ topic, qos: options.qos }]) }
    port.publish = (topic, payload, options, callback) => { published.push(JSON.parse(payload)); messages.push({ topic, payload }); callback(null) }
    port.end = () => { port.closed = true }
    clients.push(port); return port
  }
  const timers = () => {
    const tasks = new Map(); let n = 0
    return { schedule: (fn) => { tasks.set(++n, fn); return n }, cancel: (id) => tasks.delete(id),
      run: () => { const pending = [...tasks.values()]; tasks.clear(); pending.forEach((fn) => fn()) } }
  }
  const clockA = timers(), clockB = timers()
  const room = state.a.room
  const journalStore = (side, swapped) => mapRoomStoreProfiles(createWorkoutRoomStore(room.workoutId, () => state[side], (next, expected) => {
    if (state[side] !== expected) return false
    state[side] = next; return true
  }), swapped)
  const closureStore = (side) => ({
    read() {
      const value = state[side].room.closure
      if (!value) return null
      if (value.phase === 'requested' && value.initiator !== state[side].deviceId) return null
      const wire = wireClosure(value)
      return value.phase === 'committed' && value.initiator !== state[side].deviceId ? { ...wire, phase: 'confirmed' } : wire
    },
    async receive(value) {
      if (side === 'b' && rejectOnB) throw new Error('No se pudo guardar el cierre recibido.')
      const before = state[side], next = await receiveClosure(before, value)
      if (before !== state[side]) throw new Error('La sesión cambió.')
      state[side] = next
    },
    delivered(value) {
      if (value.phase === 'committed' && value.initiator === state[side].deviceId) {
        state[side] = { ...state[side], room: { ...state[side].room, closure: { ...state[side].room.closure, delivered: true } } }
      }
      return true
    }
  })
  const config = (side, peer) => ({ access: 'public', brokerUrl: PUBLIC_MQTT_BROKER_URL, roomId: room.roomId, workoutId: room.workoutId,
    deviceId: state[side].deviceId, peerDeviceId: state[peer].deviceId })
  const a = await createMqttRoomTransport(config('a', 'b'), journalStore('a', false), JSON.parse(room.context), () => {}, connector, clockA, undefined, closureStore('a'))
  const b = await createMqttRoomTransport(config('b', 'a'), journalStore('b', true), JSON.parse(room.context), () => {}, connector, clockB, undefined, closureStore('b'))
  const pump = async () => {
    for (let i = 0; i < 40; i++) {
      while (messages.length) {
        const msg = messages.shift()
        for (const client of clients) if (!client.closed && client.topic === msg.topic) client.emit('message', msg.topic, Buffer.from(msg.payload), { retain: false })
      }
      await new Promise((resolve) => setTimeout(resolve, 1))
      if (!messages.length && i > 4) break
    }
  }
  state.a = await requestRoomClosure(state.a, '2026-10-27', 32)
  a.connect(); b.connect(); clients.forEach((client) => client.emit('connect'))
  await pump()
  assert.equal(state.b.room.closure, undefined)
  assert.ok(!published.some((frame) => frame.type === 'closure_receipt'))
  assert.match(b.getState().closureIssue, /guardar/)
  rejectOnB = false; clockA.run(); await pump()
  assert.equal(state.b.room.closure.phase, 'requested')
  assert.equal(state.a.room.closure.phase, 'requested')
  state.b = await confirmRoomClosure(state.b); b.notifyClosureChanges(); await pump()
  assert.equal(state.a.room.closure.phase, 'committed')
  assert.equal(state.b.room.closure.phase, 'committed')
  assert.equal(state.a.room.closure.delivered, true)
  a.leave(); b.leave()
})
