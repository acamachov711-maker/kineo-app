const { test } = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { INITIAL_PROFILES, INITIAL_MESOCYCLE } = require('../src/data/initialData.ts')
const { createWorkoutDraft } = require('../src/utils/workoutState.ts')
const { prepareWorkspace, recordDraftChanges, getDraftConflicts, resolveDraftConflict } = require('../src/utils/workoutJournal.ts')
const { createRoomPairing, pairingInbox } = require('../src/services/roomPairing.ts')
const { buildRoomContext, createHostRoom, bindHostPeer, createRoomOffer, adoptRoomOffer, independentRoomContext, mapRoomStoreProfiles, swapRoomContext, createBoundRoomStore, currentBoundRoomContext } = require('../src/services/roomSession.ts')
const { createMqttRoomTransport, PUBLIC_MQTT_BROKER_URL } = require('../src/services/mqttRoomTransport.ts')
const { createWorkoutRoomStore } = require('../src/services/workoutRoomStore.ts')
const { canonical } = require('../src/services/seriesSync.ts')
const { MAX_MQTT_FRAME_BYTES } = require('../src/services/mqttRoomProtocol.ts')
const { isWorkoutWorkspace } = require('../src/utils/dataValidation.ts')
const { sharedRoomProfile, applySharedRoomProfile } = require('../src/services/sharedRoomProfile.ts')
const { formatRoomCode, parseRoomCode } = require('../src/services/roomLinks.ts')
const clone = (value) => JSON.parse(JSON.stringify(value))
const session = { ...INITIAL_MESOCYCLE.sessions[0], slots: INITIAL_MESOCYCLE.sessions[0].slots.slice(0, 1) }
const profiles = clone(INITIAL_PROFILES)
profiles.user_1.name = 'Alex'
profiles.user_2.name = 'Sam'
const workspace = (deviceId) => prepareWorkspace({ version: 1, activeSessionId: session.id, deviceId,
  drafts: { [session.id]: createWorkoutDraft(session.id, session.slots, profiles, deviceId === 'device-a' ? 'user_1' : 'user_2') } })

function timers() {
  const tasks = new Map()
  let next = 0
  return { schedule: (callback) => { tasks.set(++next, callback); return next }, cancel: (handle) => tasks.delete(handle),
    runNext: () => { const item = tasks.entries().next().value; if (!item) return false; tasks.delete(item[0]); item[1](); return true },
    get size() { return tasks.size } }
}
class Broker {
  clients = []
  messages = []
  publications = []
  deny = false
  failPublish = false
  connector = (url, options) => {
    const port = new EventEmitter()
    Object.assign(port, { url, options, topic: null, closed: false })
    port.subscribe = (topic, subscription, callback) => { port.topic = topic; callback(null, [{ topic, qos: this.deny ? 128 : subscription.qos }]) }
    port.publish = (topic, payload, publication, callback) => {
      this.publications.push({ topic, payload, ...publication })
      if (!this.failPublish) this.messages.push({ topic, payload, packet: { retain: false } })
      callback(this.failPublish ? new Error('rejected') : null)
    }
    port.end = () => { port.closed = true }
    this.clients.push(port)
    return port
  }
  flush() {
    let count = 0
    while (this.messages.length) {
      assert.ok(++count < 1000)
      const message = this.messages.shift()
      for (const port of [...this.clients]) if (!port.closed && port.topic === message.topic) port.emit('message', message.topic, Buffer.from(message.payload), message.packet)
    }
  }
}
function fixture(guestContext) {
  const broker = new Broker()
  let hostWorkspace = workspace('device-a')
  const context = buildRoomContext(session, profiles, hostWorkspace.drafts[session.id])
  hostWorkspace = createHostRoom(hostWorkspace, context)
  const guestWorkspace = workspace('device-b')
  const clockHost = timers()
  const clockGuest = timers()
  const hostStates = []
  const guestStates = []
  const offers = []
  let failHostSave = false
  const host = createRoomPairing({ role: 'host', roomId: hostWorkspace.room.roomId, deviceId: 'device-a', context,
    onState: (state) => hostStates.push(state), makeOffer: (peerId) => {
      const next = bindHostPeer(hostWorkspace, peerId)
      if (failHostSave) throw new Error('No se pudo guardar el vínculo.')
      hostWorkspace = next
      return createRoomOffer(hostWorkspace)
    } }, broker.connector, clockHost)
  const guest = createRoomPairing({ role: 'guest', roomId: hostWorkspace.room.roomId, deviceId: 'device-b', context: guestContext || context,
    onState: (state) => guestStates.push(state), onOffer: (offer) => offers.push(offer) }, broker.connector, clockGuest)
  const start = () => { host.connect(); guest.connect(); broker.clients.slice(0, 2).forEach((port) => port.emit('connect')); broker.flush() }
  return { broker, host, guest, clockHost, clockGuest, hostStates, guestStates, offers, context, guestWorkspace,
    start, readHost: () => hostWorkspace, setFailHostSave: (value) => { failHostSave = value } }
}

test('crear una incorporación no conecta y el inicio explícito usa solo WSS público sin credenciales', () => {
  const setup = fixture()
  assert.equal(setup.broker.clients.length, 0)
  setup.start()
  assert.equal(setup.guest.getState().phase, 'review')
  assert.equal(setup.offers.length, 1)
  assert.equal(setup.guestWorkspace.room, undefined)
  assert.equal(setup.readHost().room.peerDeviceId, 'device-b')
  for (const client of setup.broker.clients) {
    assert.equal(client.url, PUBLIC_MQTT_BROKER_URL)
    assert.ok(!('username' in client.options) && !('password' in client.options))
  }
  const request = setup.broker.publications.map((entry) => JSON.parse(entry.payload)).find((entry) => entry.type === 'request')
  const sentProfiles = JSON.parse(request.context).profiles
  for (const person of sentProfiles) assert.deepEqual(Object.keys(person).sort(), ['color', 'exercises', 'id', 'name'])
  assert.ok(setup.broker.publications.every((message) => message.retain === false && message.qos === 1))
})

test('el código corto escrito en persona identifica la sala que recibe la solicitud', () => {
  const setup = fixture()
  const id = setup.readHost().room.roomId
  assert.equal(parseRoomCode(formatRoomCode(id).toLowerCase()), id)
  setup.start()
  assert.equal(setup.guest.getState().phase, 'review')
  assert.equal(setup.offers[0].roomId, id)
})

test('rutinas diferentes alertan a ambos teléfonos y no envían ni aplican el entrenamiento', () => {
  const guestWorkspace = workspace('device-b')
  const guestContext = buildRoomContext({ ...session, title: 'Otra rutina' }, profiles, guestWorkspace.drafts[session.id])
  const setup = fixture(guestContext)
  const before = canonical(setup.guestWorkspace)
  setup.start()
  assert.equal(setup.guest.getState().phase, 'mismatch')
  assert.match(setup.guest.getState().message, /Elijan una/)
  assert.match(setup.host.getState().message, /rutinas no coinciden/)
  assert.equal(setup.offers.length, 0)
  assert.equal(setup.readHost().room.peerDeviceId, undefined)
  assert.equal(canonical(setup.guestWorkspace), before)
  assert.ok(!setup.broker.publications.some((entry) => JSON.parse(entry.payload).type === 'offer'))
})

test('tras elegir manualmente la misma rutina, una nueva solicitud permite revisar sin adopción automática', () => {
  const guestWorkspace = workspace('device-b')
  const setup = fixture(buildRoomContext({ ...session, title: 'Otra' }, profiles, guestWorkspace.drafts[session.id]))
  setup.start()
  setup.guest.leave()
  const offers = []
  const corrected = createRoomPairing({ role: 'guest', roomId: setup.readHost().room.roomId, deviceId: 'device-b',
    context: buildRoomContext(session, profiles, guestWorkspace.drafts[session.id]), onState: () => {}, onOffer: (offer) => offers.push(offer) }, setup.broker.connector, timers())
  corrected.connect()
  setup.broker.clients.at(-1).emit('connect')
  setup.broker.flush()
  assert.equal(offers.length, 1)
  assert.equal(guestWorkspace.room, undefined)
  assert.equal(corrected.getState().phase, 'review')
})

test('perfiles distintos requieren revisión manual y nunca se importan', () => {
  const otherProfiles = clone(profiles)
  otherProfiles.user_2.name = 'Otra persona'
  const guestWorkspace = workspace('device-b')
  const setup = fixture(buildRoomContext(session, otherProfiles, guestWorkspace.drafts[session.id]))
  setup.start()
  assert.match(setup.guest.getState().message, /perfiles no coinciden/)
  assert.equal(setup.offers.length, 0)
  assert.equal(otherProfiles.user_2.name, 'Otra persona')
})

test('si no se guarda el vínculo del creador no se envía la sesión', () => {
  const setup = fixture()
  setup.setFailHostSave(true)
  setup.start()
  assert.equal(setup.readHost().room.peerDeviceId, undefined)
  assert.equal(setup.offers.length, 0)
  assert.equal(setup.guest.getState().phase, 'error')
  setup.setFailHostSave(false)
  setup.guest.connect()
  setup.broker.clients.at(-1).emit('connect')
  setup.broker.flush()
  assert.equal(setup.offers.length, 1)
})

test('una sala vinculada rechaza otro dispositivo y las solicitudes duplicadas son idempotentes', () => {
  const setup = fixture()
  setup.start()
  const request = setup.broker.publications.find((entry) => JSON.parse(entry.payload).type === 'request')
  const hostPort = setup.broker.clients[0]
  hostPort.emit('message', request.topic, Buffer.from(request.payload), { retain: false })
  setup.broker.flush()
  assert.equal(setup.readHost().room.peerDeviceId, 'device-b')
  const third = JSON.parse(request.payload)
  third.from = 'device-c'
  hostPort.emit('message', request.topic, Buffer.from(JSON.stringify(third)), { retain: false })
  setup.broker.flush()
  assert.equal(setup.readHost().room.peerDeviceId, 'device-b')
  assert.ok(setup.broker.publications.some((entry) => JSON.parse(entry.payload).type === 'busy' && JSON.parse(entry.payload).to === 'device-c'))
})

test('ignora temas ajenos, mensajes retenidos y respuestas de solicitudes anteriores', () => {
  const setup = fixture()
  setup.start()
  const port = setup.broker.clients[1]
  const offer = setup.broker.publications.find((entry) => JSON.parse(entry.payload).type === 'offer')
  const before = setup.offers.length
  port.emit('message', 'another/topic', Buffer.from(offer.payload), { retain: false })
  port.emit('message', offer.topic, Buffer.from(offer.payload), { retain: true })
  const old = JSON.parse(offer.payload)
  old.requestId = 'old-request'
  port.emit('message', offer.topic, Buffer.from(JSON.stringify(old)), { retain: false })
  assert.equal(setup.offers.length, before)
})

test('mensajes inválidos, UTF-8 incorrecto y tamaño excesivo no generan ofertas ni escrituras', () => {
  const setup = fixture()
  setup.host.connect()
  const port = setup.broker.clients[0]
  port.emit('connect')
  for (const payload of [Buffer.from('{broken'), Buffer.from([0xff]), Buffer.alloc(MAX_MQTT_FRAME_BYTES + 1)]) {
    port.emit('message', port.topic, payload, { retain: false })
    assert.equal(setup.host.getState().phase, 'error')
  }
  assert.equal(setup.readHost().room.peerDeviceId, undefined)
  assert.equal(setup.offers.length, 0)
})

test('los intentos sin respuesta son acotados y permiten reintento manual', () => {
  const setup = fixture()
  setup.guest.connect()
  setup.broker.clients[0].emit('connect')
  for (let index = 0; index < 3; index += 1) setup.clockGuest.runNext()
  assert.equal(setup.guest.getState().phase, 'error')
  assert.equal(setup.clockGuest.size, 0)
  assert.equal(setup.broker.publications.length, 3)
  setup.guest.connect()
  assert.equal(setup.guest.getState().phase, 'connecting')
})

test('conexión sin respuesta y suscripción rechazada no se anuncian como incorporación lista', () => {
  const setup = fixture()
  setup.host.connect()
  setup.clockHost.runNext()
  assert.equal(setup.host.getState().phase, 'error')
  setup.broker.deny = true
  setup.host.connect()
  setup.broker.clients.at(-1).emit('connect')
  assert.equal(setup.host.getState().phase, 'error')
  assert.equal(setup.clockHost.size, 0)
})

test('salir cancela temporizadores y descarta eventos tardíos sin borrar el entrenamiento', () => {
  const setup = fixture()
  setup.start()
  const before = canonical(setup.readHost())
  const request = setup.broker.publications.find((entry) => JSON.parse(entry.payload).type === 'request')
  setup.host.leave()
  setup.broker.clients[0].emit('message', request.topic, Buffer.from(request.payload), { retain: false })
  assert.equal(canonical(setup.readHost()), before)
  assert.equal(setup.clockHost.size, 0)
  assert.equal(setup.host.getState().phase, 'left')
  assert.throws(() => setup.host.connect(), /canceló/)
})

test('incorporación guardada y transporte real de workspace intercambian operaciones sin cambiar perfiles', async () => {
  const setup = fixture()
  setup.start()
  let guestWorkspace = adoptRoomOffer(setup.guestWorkspace, setup.offers[0], session, profiles)
  let hostWorkspace = setup.readHost()
  const hostStore = createWorkoutRoomStore(hostWorkspace.room.workoutId, () => hostWorkspace, (next, previous) => {
    if (hostWorkspace !== previous) return false; hostWorkspace = next; return true
  })
  const guestStore = createWorkoutRoomStore(guestWorkspace.room.workoutId, () => guestWorkspace, (next, previous) => {
    if (guestWorkspace !== previous) return false; guestWorkspace = next; return true
  })
  const configs = (data) => ({ access: 'public', brokerUrl: PUBLIC_MQTT_BROKER_URL, roomId: data.room.roomId,
    workoutId: data.room.workoutId, deviceId: data.deviceId, peerDeviceId: data.room.peerDeviceId })
  const host = await createMqttRoomTransport(configs(hostWorkspace), hostStore, JSON.parse(setup.context), () => {}, setup.broker.connector, timers())
  const guest = await createMqttRoomTransport(configs(guestWorkspace), guestStore, JSON.parse(setup.context), () => {}, setup.broker.connector, timers())
  setup.host.leave(); setup.guest.leave()
  const previous = guestWorkspace.drafts[session.id]
  const changed = clone(previous)
  changed.slotsState[session.slots[0].slotId].setsByProfile.user_2[0].completed = true
  guestWorkspace = { ...guestWorkspace, drafts: { ...guestWorkspace.drafts, [session.id]: recordDraftChanges(previous, changed, 'device-b') } }
  host.connect(); guest.connect()
  setup.broker.clients.slice(-2).forEach((port) => port.emit('connect'))
  setup.broker.flush()
  assert.equal(hostWorkspace.drafts[session.id].slotsState[session.slots[0].slotId].setsByProfile.user_2[0].completed, true)
  assert.equal(guestWorkspace.drafts[session.id].journal.pending.length, 0)
  assert.deepEqual(hostWorkspace.drafts[session.id].journal.operations, guestWorkspace.drafts[session.id].journal.operations)
  host.leave(); guest.leave()
})

test('perfiles en posiciones opuestas intercambian registros con el propietario correcto', async () => {
  const invertedProfiles = {
    user_1: { ...clone(profiles.user_2), id: 'user_1' },
    user_2: { ...clone(profiles.user_1), id: 'user_2' }
  }
  let guestWorkspace = prepareWorkspace({ version: 1, activeSessionId: session.id, deviceId: 'device-b', drafts: {
    [session.id]: createWorkoutDraft(session.id, session.slots, invertedProfiles, 'user_1')
  } })
  const guestContext = buildRoomContext(session, invertedProfiles, guestWorkspace.drafts[session.id])
  const setup = fixture(guestContext)
  assert.equal(swapRoomContext(guestContext), setup.context)
  setup.start()
  assert.equal(setup.guest.getState().phase, 'review')
  guestWorkspace = adoptRoomOffer(guestWorkspace, setup.offers[0], session, invertedProfiles)
  assert.equal(guestWorkspace.room.profilesSwapped, true)
  let hostWorkspace = setup.readHost()
  const store = (read, write) => createWorkoutRoomStore(hostWorkspace.room.workoutId, read, write)
  const hostStore = store(() => hostWorkspace, (next, previous) => { if (hostWorkspace !== previous) return false; hostWorkspace = next; return true })
  const guestStore = mapRoomStoreProfiles(store(() => guestWorkspace, (next, previous) => { if (guestWorkspace !== previous) return false; guestWorkspace = next; return true }), true)
  const configs = (data) => ({ access: 'public', brokerUrl: PUBLIC_MQTT_BROKER_URL, roomId: data.room.roomId,
    workoutId: data.room.workoutId, deviceId: data.deviceId, peerDeviceId: data.room.peerDeviceId })
  const host = await createMqttRoomTransport(configs(hostWorkspace), hostStore, JSON.parse(setup.context), () => {}, setup.broker.connector, timers())
  const guest = await createMqttRoomTransport(configs(guestWorkspace), guestStore, JSON.parse(setup.context), () => {}, setup.broker.connector, timers())
  setup.host.leave(); setup.guest.leave()
  const previous = guestWorkspace.drafts[session.id]
  const changed = clone(previous)
  const target = changed.slotsState[session.slots[0].slotId].setsByProfile.user_1[0]
  target.weightKg = 45; target.completed = true
  guestWorkspace = { ...guestWorkspace, drafts: { ...guestWorkspace.drafts, [session.id]: recordDraftChanges(previous, changed, 'device-b') } }
  host.connect(); guest.connect()
  setup.broker.clients.slice(-2).forEach((port) => port.emit('connect'))
  setup.broker.flush()
  const sets = hostWorkspace.drafts[session.id].slotsState[session.slots[0].slotId].setsByProfile
  assert.equal(sets.user_2[0].weightKg, 45)
  assert.equal(sets.user_2[0].completed, true)
  assert.equal(sets.user_1[0].completed, false)
  assert.equal(guestWorkspace.drafts[session.id].journal.pending.length, 0)
  assert.equal(hostWorkspace.drafts[session.id].journal.operations.at(-1).target.profileId, 'user_2')
  assert.equal(guestWorkspace.drafts[session.id].journal.operations.at(-1).target.profileId, 'user_1')
  const hostBefore = hostWorkspace.drafts[session.id]
  const guestBefore = guestWorkspace.drafts[session.id]
  const hostChanged = clone(hostBefore)
  const guestChanged = clone(guestBefore)
  hostChanged.slotsState[session.slots[0].slotId].setsByProfile.user_2[0].weightKg = 40
  guestChanged.slotsState[session.slots[0].slotId].setsByProfile.user_1[0].weightKg = 50
  hostWorkspace = { ...hostWorkspace, drafts: { ...hostWorkspace.drafts, [session.id]: recordDraftChanges(hostBefore, hostChanged, 'device-a') } }
  guestWorkspace = { ...guestWorkspace, drafts: { ...guestWorkspace.drafts, [session.id]: recordDraftChanges(guestBefore, guestChanged, 'device-b') } }
  host.notifyLocalChanges(); guest.notifyLocalChanges(); setup.broker.flush()
  const hostConflict = getDraftConflicts(hostWorkspace.drafts[session.id])[0]
  const guestConflict = getDraftConflicts(guestWorkspace.drafts[session.id])[0]
  assert.equal(hostConflict.target.profileId, 'user_2')
  assert.equal(guestConflict.target.profileId, 'user_1')
  assert.deepEqual(guestConflict.conflicts[0].versions.map((version) => version.value).sort(), [40, 50])
  const resolved = resolveDraftConflict(guestWorkspace.drafts[session.id], guestConflict.target, guestConflict.heads, { weightKg: 50 }, 'device-b', 'user_1')
  guestWorkspace = { ...guestWorkspace, drafts: { ...guestWorkspace.drafts, [session.id]: resolved } }
  guest.notifyLocalChanges(); setup.broker.flush()
  assert.equal(getDraftConflicts(hostWorkspace.drafts[session.id]).length, 0)
  assert.equal(hostWorkspace.drafts[session.id].slotsState[session.slots[0].slotId].setsByProfile.user_2[0].weightKg, 50)
  host.leave(); guest.leave()
})

test('cada persona configura solo su perfil y se importa la identidad mínima al vincular', async () => {
  const broker = new Broker()
  const hostProfiles = clone(profiles)
  const guestProfiles = clone(profiles)
  hostProfiles.user_1 = { ...hostProfiles.user_1, name: 'Alex', age: 35 }
  hostProfiles.user_2 = { ...hostProfiles.user_2, name: 'Pareja', gender: 'other' }
  guestProfiles.user_1 = { ...guestProfiles.user_2, id: 'user_1', name: 'Sam', age: 31 }
  guestProfiles.user_2 = { ...clone(guestProfiles.user_1), id: 'user_2', name: 'Pareja', gender: 'other', age: undefined }
  guestProfiles.user_1.activeVariantBySlot[session.slots[0].slotId] = session.slots[0].alternatives[1].id
  let hostWorkspace = prepareWorkspace({ version: 1, activeSessionId: session.id, deviceId: 'device-a', drafts: {
    [session.id]: createWorkoutDraft(session.id, session.slots, hostProfiles, 'user_1')
  } })
  let guestWorkspace = prepareWorkspace({ version: 1, activeSessionId: session.id, deviceId: 'device-b', drafts: {
    [session.id]: createWorkoutDraft(session.id, session.slots, guestProfiles, 'user_1')
  } })
  const hostContext = independentRoomContext(buildRoomContext(session, hostProfiles, hostWorkspace.drafts[session.id]))
  const guestContext = independentRoomContext(buildRoomContext(session, guestProfiles, guestWorkspace.drafts[session.id]))
  const hostIdentity = { owner: 'user_1', profile: sharedRoomProfile(hostProfiles.user_1, session, hostWorkspace.drafts[session.id]) }
  const guestIdentity = { owner: 'user_1', profile: sharedRoomProfile(guestProfiles.user_1, session, guestWorkspace.drafts[session.id]) }
  hostWorkspace = createHostRoom(hostWorkspace, hostContext)
  const offers = []
  const hostPair = createRoomPairing({ role: 'host', roomId: hostWorkspace.room.roomId, deviceId: 'device-a', context: hostContext, identity: hostIdentity,
    onState() {}, makeOffer: (peerId, peer) => {
      applySharedRoomProfile(hostProfiles.user_2, peer.profile, session, false)
      hostWorkspace = bindHostPeer(hostWorkspace, peerId, { ownerProfileId: 'user_1', ownerProfile: hostIdentity.profile, peerOwnerId: peer.owner, peerProfile: peer.profile })
      return createRoomOffer(hostWorkspace)
    } }, broker.connector, timers())
  const guestPair = createRoomPairing({ role: 'guest', roomId: hostWorkspace.room.roomId, deviceId: 'device-b', context: guestContext, identity: guestIdentity,
    onState() {}, onOffer: (offer) => offers.push(offer) }, broker.connector, timers())
  hostPair.connect(); guestPair.connect(); broker.clients.slice(-2).forEach((port) => port.emit('connect')); broker.flush()
  assert.equal(guestPair.getState().phase, 'review')
  assert.equal(hostProfiles.user_2.name, 'Pareja')
  assert.equal(isWorkoutWorkspace(JSON.parse(JSON.stringify(hostWorkspace))), true)
  assert.throws(() => adoptRoomOffer(guestWorkspace, offers[0], session, guestProfiles, 'user_1', true), /no lo sustituimos/)
  assert.equal(guestWorkspace.room, undefined)
  guestWorkspace = adoptRoomOffer(guestWorkspace, offers[0], session, guestProfiles, 'user_1', false)
  assert.equal(isWorkoutWorkspace(JSON.parse(JSON.stringify(guestWorkspace))), true)
  assert.equal(guestWorkspace.room.profilesSwapped, true)
  guestProfiles.user_2 = applySharedRoomProfile(guestProfiles.user_2, guestWorkspace.room.peerProfile, session, false)
  guestWorkspace = { ...guestWorkspace, room: { ...guestWorkspace.room, peerApplied: true } }
  assert.equal(guestProfiles.user_2.name, 'Alex')
  assert.equal(guestProfiles.user_2.age, undefined)
  const store = (read, write) => createWorkoutRoomStore(hostWorkspace.room.workoutId, read, write)
  const hostBaseStore = store(() => hostWorkspace, (next, previous) => { if (hostWorkspace !== previous) return false; hostWorkspace = next; return true })
  const guestBaseStore = store(() => guestWorkspace, (next, previous) => { if (guestWorkspace !== previous) return false; guestWorkspace = next; return true })
  const hostStore = createBoundRoomStore(hostWorkspace.room, () => hostWorkspace, (ws) => currentBoundRoomContext(ws, [session], hostProfiles), hostBaseStore)
  const guestStore = mapRoomStoreProfiles(createBoundRoomStore(guestWorkspace.room, () => guestWorkspace, (ws) => currentBoundRoomContext(ws, [session], guestProfiles), guestBaseStore), true)
  const configs = (data) => ({ access: 'public', brokerUrl: PUBLIC_MQTT_BROKER_URL, roomId: data.room.roomId,
    workoutId: data.room.workoutId, deviceId: data.deviceId, peerDeviceId: data.room.peerDeviceId })
  const host = await createMqttRoomTransport(configs(hostWorkspace), hostStore, JSON.parse(hostContext), (state) => {
    if (state.peerSeen && !hostWorkspace.room.peerReady) {
      hostProfiles.user_2 = applySharedRoomProfile(hostProfiles.user_2, hostWorkspace.room.peerProfile, session, false)
      hostWorkspace = { ...hostWorkspace, room: { ...hostWorkspace.room, peerReady: true, peerApplied: true } }
    }
  }, broker.connector, timers())
  const guest = await createMqttRoomTransport(configs(guestWorkspace), guestStore, JSON.parse(hostContext), () => {}, broker.connector, timers())
  hostPair.leave(); guestPair.leave(); host.connect(); guest.connect()
  broker.clients.slice(-2).forEach((port) => port.emit('connect')); broker.flush()
  assert.equal(hostProfiles.user_2.name, 'Sam')
  assert.equal(hostProfiles.user_2.age, undefined)
  assert.equal(hostProfiles.user_2.activeVariantBySlot[session.slots[0].slotId], session.slots[0].alternatives[1].id)
  // Caso de la prueba real: el ajuste del peso modifica también la meta.
  const initialHostDraft = hostWorkspace.drafts[session.id]
  const adjustedHostDraft = clone(initialHostDraft)
  Object.assign(adjustedHostDraft.slotsState[session.slots[0].slotId].setsByProfile.user_2[1],
    { weightKg: 20, targetReps: '25', actualReps: 25 })
  hostWorkspace = { ...hostWorkspace, drafts: { ...hostWorkspace.drafts, [session.id]: recordDraftChanges(initialHostDraft, adjustedHostDraft, 'device-a') } }
  assert.equal(currentBoundRoomContext(hostWorkspace, [session], hostProfiles), hostContext)
  host.notifyLocalChanges(); broker.flush()
  const preparedSam = guestWorkspace.drafts[session.id].slotsState[session.slots[0].slotId].setsByProfile.user_1[1]
  assert.equal(preparedSam.weightKg, 20)
  assert.equal(preparedSam.targetReps, '25')
  assert.equal(preparedSam.actualReps, 25)
  assert.equal(preparedSam.completed, false)
  assert.equal(currentBoundRoomContext(guestWorkspace, [session], guestProfiles), hostContext)
  const changedRoutine = clone(hostWorkspace)
  changedRoutine.drafts[session.id].slotsState[session.slots[0].slotId].techniqueByProfile.user_1 = 'failure'
  assert.equal(currentBoundRoomContext(changedRoutine, [session], hostProfiles), '')
  const changedOwner = clone(hostProfiles)
  changedOwner.user_1.name = 'Alguien más'
  assert.equal(currentBoundRoomContext(hostWorkspace, [session], changedOwner), '')
  const before = guestWorkspace.drafts[session.id]
  const after = clone(before)
  after.slotsState[session.slots[0].slotId].setsByProfile.user_1[0].weightKg = 45
  after.slotsState[session.slots[0].slotId].setsByProfile.user_1[0].completed = true
  guestWorkspace = { ...guestWorkspace, drafts: { ...guestWorkspace.drafts, [session.id]: recordDraftChanges(before, after, 'device-b') } }
  guest.notifyLocalChanges(); broker.flush()
  assert.equal(hostWorkspace.drafts[session.id].slotsState[session.slots[0].slotId].setsByProfile.user_2[0].weightKg, 45)
  assert.equal(hostWorkspace.drafts[session.id].slotsState[session.slots[0].slotId].setsByProfile.user_2[0].completed, true)
  const beforeHost = hostWorkspace.drafts[session.id]
  const afterHost = clone(beforeHost)
  afterHost.slotsState[session.slots[0].slotId].setsByProfile.user_1[0].weightKg = 60
  afterHost.slotsState[session.slots[0].slotId].setsByProfile.user_1[0].completed = true
  hostWorkspace = { ...hostWorkspace, drafts: { ...hostWorkspace.drafts, [session.id]: recordDraftChanges(beforeHost, afterHost, 'device-a') } }
  host.notifyLocalChanges(); broker.flush()
  assert.equal(guestWorkspace.drafts[session.id].slotsState[session.slots[0].slotId].setsByProfile.user_2[0].weightKg, 60)
  assert.equal(guestWorkspace.drafts[session.id].slotsState[session.slots[0].slotId].setsByProfile.user_2[0].completed, true)
  const hostBase = hostWorkspace.drafts[session.id]
  const guestBase = guestWorkspace.drafts[session.id]
  const hostEdit = clone(hostBase)
  const guestEdit = clone(guestBase)
  hostEdit.slotsState[session.slots[0].slotId].setsByProfile.user_2[0].weightKg = 40
  guestEdit.slotsState[session.slots[0].slotId].setsByProfile.user_1[0].weightKg = 50
  hostWorkspace = { ...hostWorkspace, drafts: { ...hostWorkspace.drafts, [session.id]: recordDraftChanges(hostBase, hostEdit, 'device-a') } }
  guestWorkspace = { ...guestWorkspace, drafts: { ...guestWorkspace.drafts, [session.id]: recordDraftChanges(guestBase, guestEdit, 'device-b') } }
  host.notifyLocalChanges(); guest.notifyLocalChanges(); broker.flush()
  assert.equal(getDraftConflicts(hostWorkspace.drafts[session.id])[0].target.profileId, 'user_2')
  const conflict = getDraftConflicts(guestWorkspace.drafts[session.id])[0]
  assert.equal(conflict.target.profileId, 'user_1')
  const resolved = resolveDraftConflict(guestWorkspace.drafts[session.id], conflict.target, conflict.heads, { weightKg: 50 }, 'device-b', 'user_1')
  guestWorkspace = { ...guestWorkspace, drafts: { ...guestWorkspace.drafts, [session.id]: resolved } }
  guest.notifyLocalChanges(); broker.flush()
  assert.equal(getDraftConflicts(hostWorkspace.drafts[session.id]).length, 0)
  assert.equal(hostWorkspace.drafts[session.id].slotsState[session.slots[0].slotId].setsByProfile.user_2[0].weightKg, 50)
  for (const publication of broker.publications) {
    const frame = JSON.parse(publication.payload)
    if (frame.identity) assert.deepEqual(JSON.parse(frame.context).profiles, [{ id: 'user_1' }, { id: 'user_2' }])
    if (frame.identity) assert.deepEqual(Object.keys(frame.identity.profile).sort(), ['color', 'exercises', 'name'])
    if (frame.offer?.participants) for (const person of [frame.offer.participants.host, frame.offer.participants.guest]) assert.deepEqual(Object.keys(person).sort(), ['color', 'exercises', 'name'])
  }
  host.leave(); guest.leave()
})

test('rechaza códigos con comodines y el error de envío conserva la vinculación local', () => {
  assert.throws(() => pairingInbox('bad/room'))
  const setup = fixture()
  setup.broker.failPublish = true
  setup.start()
  assert.equal(setup.guest.getState().phase, 'error')
  assert.equal(setup.guestWorkspace.room, undefined)
})
