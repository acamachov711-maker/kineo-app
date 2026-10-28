const { test } = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { createJournal, appendOperation, projectJournal, canonical } = require('../src/services/seriesSync.ts')
const { createMqttRoomTransport, PUBLIC_MQTT_BROKER_URL } = require('../src/services/mqttRoomTransport.ts')
const { createRoomBaseDigest, createOperationBatches, parseRoomFrame, encodeRoomFrame, roomInbox, MAX_MQTT_FRAME_BYTES } = require('../src/services/mqttRoomProtocol.ts')
const { mapRoomHistory, mergeRoomHistory, historyBatches } = require('../src/services/roomHistory.ts')

const clone = (value) => JSON.parse(JSON.stringify(value))
const target = { slotId: 'slot-a', profileId: 'user_1', setId: 'set-a' }
const value = { setNumber: 1, targetReps: '10', weightKg: 40, actualReps: 10, rir: 2,
  isFailure: false, completed: false, compensatedDirection: null, drops: [], deleted: false }
const base = () => createJournal('workout-a', [{ target, value }])
const context = { sessionId: 'session-a', unit: 'kg', participants: ['profile-a', 'profile-b'] }
const config = (deviceId) => ({ roomId: 'room-a', workoutId: 'workout-a', deviceId,
  peerDeviceId: deviceId === 'device-a' ? 'device-b' : 'device-a', brokerUrl: 'wss://mqtt.kineo.test/mqtt',
  username: `technical-${deviceId}`, password: 'test-only-not-a-real-credential' })
const publicConfig = (deviceId) => {
  const { username, password, ...address } = config(deviceId)
  return { ...address, access: 'public', brokerUrl: PUBLIC_MQTT_BROKER_URL }
}

function timers() {
  const tasks = new Map()
  let sequence = 0
  return {
    schedule(callback, delayMs) { tasks.set(++sequence, { callback, delayMs }); return sequence },
    cancel(handle) { tasks.delete(handle) },
    runNext() {
      const first = tasks.entries().next().value
      if (!first) return false
      tasks.delete(first[0])
      first[1].callback()
      return first[1].delayMs
    },
    get size() { return tasks.size }
  }
}

class Broker {
  clients = []
  messages = []
  publications = []
  drop = () => false
  denySubscribe = false
  publishError = false
  connector = (url, options) => {
    const port = new EventEmitter()
    port.url = url
    port.options = options
    port.topic = null
    port.closed = false
    port.subscribe = (topic, subscription, callback) => {
      port.topic = topic
      callback(null, [{ topic, qos: this.denySubscribe ? 128 : subscription.qos }])
    }
    port.publish = (topic, payload, publication, callback) => {
      this.publications.push({ topic, payload, ...publication })
      if (this.publishError) { callback(new Error('Rejected')); return }
      const frame = JSON.parse(payload)
      if (!this.drop(frame)) this.messages.push({ topic, payload, packet: { retain: false } })
      callback(null)
    }
    port.end = () => { port.closed = true }
    this.clients.push(port)
    return port
  }
  flush() {
    let delivered = 0
    while (this.messages.length) {
      assert.ok(++delivered < 10000, 'El transporte no debe entrar en un bucle de mensajes')
      const message = this.messages.shift()
      for (const client of this.clients) {
        if (!client.closed && client.topic === message.topic) client.emit('message', message.topic, Buffer.from(message.payload), message.packet)
      }
    }
  }
}

function memoryStore(initial) {
  return {
    journal: clone(initial), writes: 0, fail: false, throwOnWrite: false,
    read() { return clone(this.journal) },
    persist(journal) {
      if (this.throwOnWrite) throw new Error('Storage unavailable')
      if (this.fail) return false
      this.journal = clone(journal)
      this.writes += 1
      return true
    }
  }
}

async function fixture(initialA = base(), initialB = base(), makeConfig = config) {
  const broker = new Broker()
  const clockA = timers()
  const clockB = timers()
  const storeA = memoryStore(initialA)
  const storeB = memoryStore(initialB)
  const statesA = []
  const transportA = await createMqttRoomTransport(makeConfig('device-a'), storeA, context,
    (state) => statesA.push(state), broker.connector, clockA)
  const transportB = await createMqttRoomTransport(makeConfig('device-b'), storeB, context,
    () => {}, broker.connector, clockB)
  const start = () => {
    transportA.connect()
    transportB.connect()
    for (const client of [...broker.clients]) client.emit('connect')
    broker.flush()
  }
  return { broker, clockA, clockB, storeA, storeB, statesA, transportA, transportB, start }
}

const historyEntry = (id, profileId, weight = 40) => ({ id, date: '2026-10-01', sessionId: 'session-a', sessionCode: 'A', sessionTitle: 'Sesión A', profileId,
  totalVolumeKg: weight * 10, completedSets: 1, durationMinutes: 20, exercises: [{ slotId: 'slot-a', variantId: 'exercise-a', variantName: 'Ejercicio', muscleGroup: 'Pierna', equipment: 'Barra', technique: 'normal', maxWeightKg: weight, estimated1RmKg: weight, totalVolumeKg: weight * 10, bestSetReps: 10, sets: [{ setNumber: 1, targetReps: '10', weightKg: weight, actualReps: 10, rir: 2, completed: true }] }] })

async function historyFixture(a, b) {
  const broker = new Broker(), clockA = timers(), clockB = timers()
  const savedA = { entries: clone(a), fail: false }, savedB = { entries: clone(b), fail: false }
  const historyStore = (saved, swapped) => ({
    read: () => mapRoomHistory(clone(saved.entries), swapped),
    persist: (entries) => { if (saved.fail) return false; saved.entries = mapRoomHistory(clone(entries), swapped); return true }
  })
  const first = await createMqttRoomTransport(config('device-a'), memoryStore(base()), context, () => {}, broker.connector, clockA, historyStore(savedA, false))
  const second = await createMqttRoomTransport(config('device-b'), memoryStore(base()), context, () => {}, broker.connector, clockB, historyStore(savedB, true))
  const start = () => { first.connect(); second.connect(); for (const client of [...broker.clients]) client.emit('connect'); broker.flush() }
  return { broker, clockA, clockB, savedA, savedB, first, second, start }
}

test('intercambia el historial completo y traduce el perfil sin duplicarlo al reenviar', async () => {
  const setup = await historyFixture([historyEntry('alex-1', 'user_1')], [historyEntry('sam-1', 'user_1', 30)])
  setup.start()
  assert.deepEqual(setup.savedA.entries.map((e) => [e.id, e.profileId]).sort(), [['alex-1', 'user_1'], ['sam-1', 'user_2']])
  assert.deepEqual(setup.savedB.entries.map((e) => [e.id, e.profileId]).sort(), [['alex-1', 'user_2'], ['sam-1', 'user_1']])
  setup.first.notifyHistoryChanges(); setup.second.notifyHistoryChanges(); setup.broker.flush()
  assert.equal(setup.savedA.entries.length, 2); assert.equal(setup.savedB.entries.length, 2)
})

test('no confirma el historial cuando falla el almacenamiento y lo recupera al reintentar', async () => {
  const setup = await historyFixture([historyEntry('alex-1', 'user_1')], [])
  setup.savedB.fail = true
  setup.start()
  assert.equal(setup.savedB.entries.length, 0)
  assert.match(setup.second.getState().historyIncomingIssue, /guardar/)
  assert.equal(setup.broker.publications.filter((item) => JSON.parse(item.payload).type === 'history_receipt').length, 0)
  setup.savedB.fail = false
  while (!setup.savedB.entries.length && setup.clockA.runNext() !== false) setup.broker.flush()
  assert.equal(setup.savedB.entries[0].id, 'alex-1')
})

test('registros históricos contradictorios se preservan sin confirmación', async () => {
  const setup = await historyFixture([historyEntry('same', 'user_1')], [historyEntry('same', 'user_2', 60)])
  setup.start()
  assert.equal(setup.savedA.entries[0].totalVolumeKg, 400)
  assert.equal(setup.savedB.entries[0].totalVolumeKg, 600)
  assert.match(setup.first.getState().historyIncomingIssue, /identificador/)
  assert.match(setup.second.getState().historyIncomingIssue, /identificador/)
  assert.throws(() => mergeRoomHistory(setup.savedA.entries, mapRoomHistory(setup.savedB.entries, true)))
})

test('divide historiales extensos sin truncarlos', () => {
  const entries = Array.from({ length: 130 }, (_, index) => historyEntry(`history-${index}`, 'user_1'))
  const batches = historyBatches(entries)
  assert.equal(batches.length, 3)
  assert.deepEqual(batches.flat(), entries)
})

test('envía lotes completos y cambios posteriores sin perder registros', async () => {
  const entries = Array.from({ length: 130 }, (_, index) => historyEntry(`history-${index}`, 'user_1'))
  const setup = await historyFixture(entries, [])
  setup.start()
  assert.equal(setup.savedB.entries.length, 130)
  assert.ok(setup.savedB.entries.every((entry) => entry.profileId === 'user_2'))
  setup.savedA.entries.push(historyEntry('new-record', 'user_1'))
  setup.first.notifyHistoryChanges(); setup.broker.flush()
  assert.equal(setup.savedB.entries.length, 131)
  assert.equal(setup.first.getState().historyStatus, 'synced')
})

test('rechaza registros inválidos y demasiado grandes sin envío parcial', () => {
  const invalid = { ...historyEntry('bad', 'user_1'), date: 'invalid' }
  assert.throws(() => mergeRoomHistory([], [invalid]))
  const oversized = { ...historyEntry('big', 'user_1'), sessionTitle: 'x'.repeat(MAX_MQTT_FRAME_BYTES) }
  assert.throws(() => historyBatches([oversized]), /límite/)
})

test('crear el adaptador no abre red ni usa un broker predeterminado', async () => {
  const setup = await fixture()
  assert.equal(setup.broker.clients.length, 0)
  assert.equal(setup.transportA.getState().connection, 'idle')
  assert.equal(setup.clockA.size, 0)
})

test('rechaza WSS inseguro, URLs con secretos y brokers públicos conocidos', async () => {
  for (const brokerUrl of ['ws://mqtt.kineo.test', 'mqtt://mqtt.kineo.test', 'wss://broker.emqx.io:8084/mqtt',
    'wss://broker.hivemq.com', 'wss://test.mosquitto.org', 'wss://user:password@mqtt.kineo.test',
    'wss://mqtt.kineo.test/mqtt?token=secret', 'wss://mqtt.kineo.test/#secret', 'not-a-url']) {
    await assert.rejects(createMqttRoomTransport({ ...config('device-a'), brokerUrl }, memoryStore(base()), context))
  }
})

test('rechaza configuración incompleta, comodines de tema, dispositivos repetidos y otro entrenamiento', async () => {
  for (const change of [{ username: '' }, { password: '' }, { roomId: 'room/+' }, { peerDeviceId: 'device-a' }, { workoutId: 'workout-b' }]) {
    await assert.rejects(createMqttRoomTransport({ ...config('device-a'), ...change }, memoryStore(base()), context))
  }
})

test('conecta con credenciales en CONNECT, sin retención ni secretos en el mensaje', async () => {
  const setup = await fixture()
  setup.start()
  assert.equal(setup.transportA.getState().connection, 'connected')
  assert.equal(setup.transportA.getState().access, 'authenticated')
  assert.equal(setup.transportA.getState().peerSeen, true)
  assert.equal(setup.broker.clients[0].options.password, config('device-a').password)
  assert.equal(setup.broker.clients[0].options.reconnectPeriod, 0)
  for (const publication of setup.broker.publications) {
    assert.equal(publication.qos, 1)
    assert.equal(publication.retain, false)
    assert.ok(!publication.payload.includes(config('device-a').password))
    assert.ok(!publication.payload.includes('technical-device'))
  }
  assert.ok(!JSON.stringify(setup.transportA.getState()).includes('password'))
})

test('el modo público es explícito, no conecta al crearse ni envía credenciales', async () => {
  const setup = await fixture(base(), base(), publicConfig)
  assert.equal(setup.broker.clients.length, 0)
  assert.equal(setup.transportA.getState().access, 'public')
  setup.start()
  assert.equal(setup.transportA.getState().connection, 'connected')
  assert.equal(setup.transportA.getState().peerSeen, true)
  for (const client of setup.broker.clients) {
    assert.equal(client.url, PUBLIC_MQTT_BROKER_URL)
    assert.ok(!Object.hasOwn(client.options, 'username'))
    assert.ok(!Object.hasOwn(client.options, 'password'))
    assert.equal(client.options.clean, true)
  }
  assert.ok(setup.statesA.every((state) => state.access === 'public'))
  assert.ok(setup.broker.publications.every((publication) => publication.qos === 1 && publication.retain === false))
  setup.transportA.leave()
  assert.equal(setup.transportA.getState().access, 'public')
})

test('el modo público no permite otro servidor, rutas alteradas, secretos ni contraseña simulada', async () => {
  const changes = [
    { brokerUrl: 'ws://broker.emqx.io:8083/mqtt' },
    { brokerUrl: 'wss://mqtt.kineo.test/mqtt' },
    { brokerUrl: 'wss://broker.hivemq.com:8884/mqtt' },
    { brokerUrl: 'wss://broker.emqx.io/mqtt' },
    { brokerUrl: 'wss://broker.emqx.io:8084/other' },
    { brokerUrl: 'wss://broker.emqx.io.evil.test:8084/mqtt' },
    { brokerUrl: 'wss://broker.emqx.io:8084/mqtt?password=secret' },
    { brokerUrl: 'wss://broker.emqx.io:8084/mqtt#secret' },
    { brokerUrl: 'wss://user:secret@broker.emqx.io:8084/mqtt' },
    { username: 'technical-user' }, { password: 'room-password' }, { password: undefined }
  ]
  const broker = new Broker()
  for (const change of changes) {
    await assert.rejects(createMqttRoomTransport({ ...publicConfig('device-a'), ...change },
      memoryStore(base()), context, () => {}, broker.connector))
  }
  assert.equal(broker.clients.length, 0)
})

test('rechaza modos desconocidos, credenciales no textuales y direcciones públicas inválidas', async () => {
  for (const change of [{ access: '' }, { access: 'private' }, { access: null }, { username: 123 }, { password: true }]) {
    await assert.rejects(createMqttRoomTransport({ ...config('device-a'), ...change }, memoryStore(base()), context))
  }
  for (const change of [{ roomId: 'room/+' }, { peerDeviceId: 'device-a' }, { workoutId: 'workout-b' }]) {
    await assert.rejects(createMqttRoomTransport({ ...publicConfig('device-a'), ...change }, memoryStore(base()), context))
  }
})

test('el modo público persiste operaciones antes del recibo y conserva la cola si falla el guardado', async () => {
  const setup = await fixture(appendOperation(base(), target, { completed: true }, 'device-a', 'user_1'), base(), publicConfig)
  setup.storeB.fail = true
  setup.start()
  assert.equal(setup.storeB.journal.operations.length, 0)
  assert.equal(setup.storeA.journal.pending.length, 1)
  assert.equal(setup.transportB.getState().issue, 'storage_failed')
  assert.ok(!setup.broker.publications.some((publication) => JSON.parse(publication.payload).type === 'receipt'))
  setup.storeB.fail = false
  setup.clockA.runNext()
  setup.broker.flush()
  assert.equal(setup.storeB.journal.operations.length, 1)
  assert.equal(setup.storeA.journal.pending.length, 0)
  assert.ok(setup.storeB.writes > 0)
  assert.ok(setup.broker.publications.every((publication) => !publication.payload.includes('"profiles"') && !publication.payload.includes('"history"')))
})

test('el modo público conserva contradicciones y la salida impide escrituras tardías', async () => {
  const journalA = appendOperation(base(), target, { weightKg: 42 }, 'device-a', 'user_1')
  const journalB = appendOperation(base(), target, { weightKg: 45 }, 'device-b', 'user_1')
  const setup = await fixture(journalA, journalB, publicConfig)
  setup.start()
  assert.equal(canonical(projectJournal(setup.storeA.journal)), canonical(projectJournal(setup.storeB.journal)))
  assert.equal(projectJournal(setup.storeA.journal)[0].conflicts.length, 1)
  const before = canonical(setup.storeA.journal)
  const publication = setup.broker.publications.find((entry) => JSON.parse(entry.payload).from === 'device-b')
  setup.transportA.leave()
  setup.broker.clients[0].emit('message', publication.topic, Buffer.from(publication.payload), { retain: false })
  assert.equal(canonical(setup.storeA.journal), before)
  assert.equal(setup.clockA.size, 0)
  assert.throws(() => setup.transportA.connect(), /abandonó/)
})

test('recibe una serie, la persiste y solo después vacía la cola del emisor', async () => {
  const journal = appendOperation(base(), target, { completed: true }, 'device-a', 'user_1')
  const setup = await fixture(journal)
  setup.start()
  assert.equal(setup.storeB.journal.operations.length, 1)
  assert.ok(setup.storeB.writes > 0)
  assert.equal(setup.storeA.journal.pending.length, 0)
  assert.ok(setup.transportA.getState().lastPeerReceiptAt)
  assert.ok(setup.broker.publications.every((publication) => !publication.payload.includes('"profiles"') && !publication.payload.includes('"history"')))
})

test('el PUBACK del broker no vacía la cola si falta la confirmación del otro móvil', async () => {
  const setup = await fixture(appendOperation(base(), target, { completed: true }, 'device-a', 'user_1'))
  setup.broker.drop = (frame) => frame.type === 'receipt'
  setup.start()
  assert.equal(setup.storeB.journal.operations.length, 1)
  assert.equal(setup.storeA.journal.pending.length, 1)
  assert.equal(setup.transportA.getState().lastPeerReceiptAt, null)
})

test('si el receptor no puede guardar, no confirma y el emisor conserva la cola', async () => {
  for (const failure of ['fail', 'throwOnWrite']) {
    const setup = await fixture(appendOperation(base(), target, { completed: true }, 'device-a', 'user_1'))
    setup.storeB[failure] = true
    setup.start()
    assert.equal(setup.transportB.getState().issue, 'storage_failed')
    assert.equal(setup.storeA.journal.pending.length, 1)
    assert.equal(setup.storeB.journal.operations.length, 0)
    assert.ok(!setup.broker.publications.some((publication) => JSON.parse(publication.payload).type === 'receipt'))
  }
})

test('si falla guardar la confirmación en origen, su cola tampoco se borra', async () => {
  const setup = await fixture(appendOperation(base(), target, { completed: true }, 'device-a', 'user_1'))
  setup.storeA.fail = true
  setup.start()
  assert.equal(setup.storeA.journal.pending.length, 1)
  assert.equal(setup.transportA.getState().issue, 'storage_failed')
})

test('se recupera un reintento duplicado sin duplicar series ni operaciones', async () => {
  const setup = await fixture(appendOperation(base(), target, { completed: true }, 'device-a', 'user_1'))
  setup.broker.drop = (frame) => frame.type === 'receipt'
  setup.start()
  assert.equal(setup.clockA.runNext(), 5000)
  setup.broker.drop = () => false
  setup.broker.flush()
  assert.equal(setup.storeB.journal.operations.length, 1)
  assert.equal(setup.storeA.journal.pending.length, 0)
})

test('los reintentos de recibo son acotados y dejan el cambio pendiente', async () => {
  const setup = await fixture(appendOperation(base(), target, { completed: true }, 'device-a', 'user_1'))
  setup.broker.drop = (frame) => frame.type === 'receipt'
  setup.start()
  for (const delay of [5000, 10000, 15000]) {
    assert.equal(setup.clockA.runNext(), delay)
    setup.broker.flush()
  }
  assert.equal(setup.clockA.size, 0)
  assert.equal(setup.transportA.getState().issue, 'receipt_timeout')
  assert.equal(setup.storeA.journal.pending.length, 1)
})

test('un cambio offline se envía al reconectar con el mismo diario', async () => {
  const setup = await fixture()
  setup.start()
  const oldClient = setup.broker.clients[0]
  oldClient.emit('close')
  setup.storeA.journal = appendOperation(setup.storeA.journal, target, { completed: true }, 'device-a', 'user_1')
  setup.transportA.notifyLocalChanges()
  assert.equal(setup.storeB.journal.operations.length, 0)
  assert.equal(setup.clockA.runNext(), 2000)
  setup.broker.clients.at(-1).emit('connect')
  setup.broker.flush()
  assert.equal(setup.storeB.journal.operations.length, 1)
  assert.equal(setup.storeA.journal.pending.length, 0)
})

test('recuperación completa reenvía operaciones conservadas aunque ya estuvieran confirmadas', async () => {
  const acknowledged = appendOperation(base(), target, { completed: true }, 'device-a', 'user_1')
  acknowledged.pending = []
  const setup = await fixture(acknowledged)
  setup.start()
  assert.equal(setup.storeB.journal.operations.length, 1)
})

test('cambios compatibles convergen y las contradicciones conservan ambas versiones', async () => {
  for (const changes of [{ actualReps: 12 }, { weightKg: 45 }]) {
    const left = appendOperation(base(), target, { weightKg: 42.5 }, 'device-a', 'user_1')
    const right = appendOperation(base(), target, changes, 'device-b', 'user_2')
    const setup = await fixture(left, right)
    setup.start()
    assert.equal(canonical(projectJournal(setup.storeA.journal)), canonical(projectJournal(setup.storeB.journal)))
    assert.equal(setup.storeA.journal.operations.length, 2)
    assert.equal(projectJournal(setup.storeA.journal)[0].conflicts.length, 'weightKg' in changes ? 1 : 0)
  }
})

test('los lotes grandes se envían en orden causal incluso si el diario estaba reordenado', async () => {
  let journal = base()
  for (let index = 0; index < 105; index += 1) journal = appendOperation(journal, target, { actualReps: index }, 'device-a', 'user_1')
  journal.operations.reverse()
  const batches = createOperationBatches(journal, true)
  assert.equal(batches.length, 2)
  const setup = await fixture(journal)
  setup.start()
  assert.equal(setup.storeB.journal.operations.length, 105)
  assert.equal(setup.storeA.journal.pending.length, 0)
})

test('las dependencias confirmadas también acompañan a una operación pendiente', () => {
  let journal = appendOperation(base(), target, { weightKg: 45 }, 'device-a', 'user_1')
  const parent = journal.operations[0].id
  journal.pending = []
  journal = appendOperation(journal, target, { actualReps: 12 }, 'device-a', 'user_1')
  assert.equal(createOperationBatches(journal, false)[0][0].id, parent)
})

test('un cambio local durante un envío no queda olvidado al confirmar el lote anterior', async () => {
  const setup = await fixture()
  setup.start()
  setup.storeA.journal = appendOperation(setup.storeA.journal, target, { actualReps: 12 }, 'device-a', 'user_1')
  setup.transportA.notifyLocalChanges()
  setup.storeA.journal = appendOperation(setup.storeA.journal, target, { weightKg: 45 }, 'device-a', 'user_1')
  setup.transportA.notifyLocalChanges()
  setup.broker.flush()
  assert.equal(setup.storeB.journal.operations.length, 2)
  assert.equal(setup.storeA.journal.pending.length, 0)
})

test('otra base o contexto se rechaza sin mezclar datos de dos entrenamientos', async () => {
  const other = base()
  other.baseline[0].value.weightKg = 99
  const setup = await fixture(appendOperation(base(), target, { completed: true }, 'device-a', 'user_1'), other)
  setup.start()
  assert.equal(setup.storeB.journal.operations.length, 0)
  assert.equal(setup.storeA.journal.pending.length, 1)
  assert.equal(setup.transportA.getState().issue, 'invalid_message')
  assert.notEqual(await createRoomBaseDigest(base(), context), await createRoomBaseDigest(base(), { ...context, unit: 'lb' }))
})

test('rechaza recibos ajenos o con identificadores de operaciones inventados', async () => {
  const setup = await fixture(appendOperation(base(), target, { completed: true }, 'device-a', 'user_1'))
  setup.broker.drop = (frame) => frame.type === 'receipt'
  setup.start()
  const publication = setup.broker.publications.find((entry) => JSON.parse(entry.payload).type === 'receipt')
  const receipt = JSON.parse(publication.payload)
  const client = setup.broker.clients[0]
  client.emit('message', client.topic, Buffer.from(JSON.stringify({ ...receipt, batchId: 'invented' })), {})
  assert.equal(setup.storeA.journal.pending.length, 1)
  client.emit('message', client.topic, Buffer.from(JSON.stringify({ ...receipt, operationIds: ['invented'] })), {})
  assert.equal(setup.transportA.getState().issue, 'invalid_message')
  assert.equal(setup.storeA.journal.pending.length, 1)
})

test('rechaza mensajes retenidos y eventos de un tema o dispositivo distinto', async () => {
  const setup = await fixture()
  setup.start()
  const client = setup.broker.clients[0]
  const frame = JSON.parse(setup.broker.publications.find((entry) => entry.topic === client.topic).payload)
  const writes = setup.storeA.writes
  client.emit('message', client.topic, Buffer.from(JSON.stringify(frame)), { retain: true })
  assert.equal(setup.transportA.getState().issue, 'invalid_message')
  client.emit('message', client.topic, Buffer.from(JSON.stringify({ ...frame, from: 'third-device' })), {})
  client.emit('message', 'other-topic', Buffer.from(JSON.stringify(frame)), {})
  assert.equal(setup.storeA.writes, writes)
})

test('rechaza operaciones de terceros y lotes malformados sin guardado parcial', async () => {
  const setup = await fixture()
  setup.start()
  const client = setup.broker.clients[1]
  const hello = JSON.parse(setup.broker.publications.find((entry) => entry.topic === client.topic).payload)
  const operation = appendOperation(base(), target, { completed: true }, 'third-device', 'user_1').operations[0]
  for (const operations of [[operation], [null], [{ ...operation, deviceId: 'device-a', changes: { weightKg: -1 } }]]) {
    client.emit('message', client.topic, Buffer.from(JSON.stringify({ ...hello, type: 'operations', requestReplay: undefined,
      batchId: 'batch-test', operations })), {})
    assert.equal(setup.storeB.journal.operations.length, 0)
    assert.equal(setup.transportB.getState().issue, 'invalid_message')
  }
})

test('limita tamaño, campos desconocidos y UTF-8 inválido antes de analizar operaciones', async () => {
  const digest = await createRoomBaseDigest(base(), context)
  const frame = { version: 1, roomId: 'room-a', workoutId: 'workout-a', baseDigest: digest,
    from: 'device-b', to: 'device-a', type: 'hello', requestReplay: true }
  assert.throws(() => parseRoomFrame(Buffer.alloc(MAX_MQTT_FRAME_BYTES + 1), config('device-a'), digest))
  assert.throws(() => parseRoomFrame(Buffer.from([255]), config('device-a'), digest))
  assert.throws(() => parseRoomFrame(Buffer.from(JSON.stringify({ ...frame, secret: 'unexpected' })), config('device-a'), digest))
  assert.throws(() => encodeRoomFrame({ ...frame, roomId: 'x'.repeat(MAX_MQTT_FRAME_BYTES) }))
  assert.throws(() => roomInbox({ ...config('device-a'), roomId: '#' }, 'device-a'))
})

test('una operación válida demasiado grande sigue local y no se envía como mensaje truncado', () => {
  const journal = base()
  const parents = []
  for (let index = 0; index < 256; index += 1) {
    const identifier = `operation-${index}-`.padEnd(512, 'x')
    parents.push(identifier)
    journal.operations.push({ id: identifier, workoutId: journal.workoutId, deviceId: 'device-a', actorProfileId: 'user_1',
      target, parents: [], kind: 'edit', changes: { weightKg: 40 }, createdAt: 1 })
  }
  const updated = appendOperation(journal, target, { completed: true }, 'device-a', 'user_1')
  assert.throws(() => createOperationBatches(updated, true), /excede el límite/)
  assert.equal(updated.pending.length, 1)
})

test('suscripción denegada no se anuncia como conexión lista', async () => {
  const setup = await fixture()
  setup.broker.denySubscribe = true
  setup.transportA.connect()
  setup.broker.clients[0].emit('connect')
  assert.equal(setup.transportA.getState().connection, 'error')
  assert.equal(setup.transportA.getState().issue, 'subscription_denied')
  assert.equal(setup.broker.publications.length, 0)
  assert.equal(setup.clockA.size, 0)
})

test('conexión sin respuesta termina tras tres intentos y permite reintento explícito', async () => {
  const setup = await fixture()
  setup.transportA.connect()
  for (let attempt = 0; attempt < 3; attempt += 1) {
    assert.equal(setup.clockA.runNext(), 15000)
    if (attempt < 2) assert.equal(setup.clockA.runNext(), 2000 * 2 ** attempt)
  }
  assert.equal(setup.transportA.getState().connection, 'error')
  assert.equal(setup.clockA.size, 0)
  setup.transportA.connect()
  setup.broker.clients.at(-1).emit('connect')
  assert.equal(setup.transportA.getState().connection, 'connected')
})

test('eventos duplicados de cierre solo programan una reconexión', async () => {
  const setup = await fixture()
  setup.start()
  const client = setup.broker.clients[0]
  client.emit('error')
  client.emit('offline')
  client.emit('close')
  assert.equal(setup.clockA.size, 1)
})

test('salir cancela temporizadores, rechaza incorporación implícita y no borra la cola', async () => {
  const setup = await fixture(appendOperation(base(), target, { completed: true }, 'device-a', 'user_1'))
  setup.broker.drop = (frame) => frame.type === 'receipt'
  setup.start()
  const previous = clone(setup.storeA.journal)
  const client = setup.broker.clients[0]
  const publications = setup.broker.publications.length
  const receipt = setup.broker.publications.map((entry) => JSON.parse(entry.payload)).find((frame) => frame.type === 'receipt' && frame.to === 'device-a')
  assert.ok(receipt)
  setup.transportA.leave()
  setup.transportA.leave()
  setup.transportA.notifyLocalChanges()
  client.emit('connect')
  client.emit('close')
  client.emit('message', client.topic, Buffer.from(JSON.stringify(receipt)), { retain: false })
  assert.equal(setup.transportA.getState().connection, 'left')
  assert.equal(setup.clockA.size, 0)
  assert.equal(setup.broker.publications.length, publications)
  assert.deepEqual(setup.storeA.journal, previous)
  assert.throws(() => setup.transportA.connect(), /vinculación explícita/)
})

test('el error de publicación no se confunde con una confirmación de guardado', async () => {
  const setup = await fixture()
  setup.start()
  setup.broker.publishError = true
  setup.storeA.journal = appendOperation(setup.storeA.journal, target, { completed: true }, 'device-a', 'user_1')
  setup.transportA.notifyLocalChanges()
  assert.equal(setup.transportA.getState().issue, 'send_failed')
  assert.equal(setup.storeA.journal.pending.length, 1)
})

test('un cambio de base local durante la conexión se bloquea sin publicar', async () => {
  const setup = await fixture()
  setup.start()
  const before = setup.broker.publications.length
  setup.storeA.journal.baseline[0].value.weightKg = 99
  setup.transportA.notifyLocalChanges()
  assert.equal(setup.transportA.getState().issue, 'invalid_journal')
  assert.equal(setup.broker.publications.length, before)
})

test('el transporte usa el workspace real y no confirma al emisor hasta guardar tras un fallo de cuota', async () => {
  const { createWorkoutRoomStore } = require('../src/services/workoutRoomStore.ts')
  const stored = new Map()
  let fail = false
  global.localStorage = { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => {
    if (fail) throw new Error('Quota exceeded')
    stored.set(key, value)
  } }
  delete require.cache[require.resolve('../src/services/storageService.ts')]
  const storage = require('../src/services/storageService.ts')
  const { deleted, ...fields } = value
  let workspace = { version: 1, deviceId: 'device-b', activeSessionId: 'session-a', drafts: { 'session-a': {
    id: 'workout-a', sessionId: 'session-a', journal: base(), activeProfileId: 'user_1', expandedSlotId: null,
    isWorkoutStarted: false, clock: { elapsedMs: 0, runningSince: null },
    rest: { secondsLeft: 0, totalSeconds: 0, isRunning: false, endsAt: null, label: '' },
    slotsState: { 'slot-a': { syncMode: 'shared', techniqueByProfile: { user_1: 'normal', user_2: 'normal' },
      setsByProfile: { user_1: [{ ...fields, id: 'set-a' }], user_2: [] } } }
  } } }
  assert.equal(storage.saveWorkoutWorkspace(workspace), true)
  const roomStore = createWorkoutRoomStore('workout-a', () => workspace, (next) => {
    if (!storage.saveWorkoutWorkspace(next, false)) return false
    workspace = next
    return true
  })
  const setup = await fixture(appendOperation(base(), target, { weightKg: 45, completed: true }, 'device-a', 'user_1'))
  setup.storeB.read = roomStore.read
  setup.storeB.persist = roomStore.persist
  let peerReceipts = 0
  setup.broker.drop = (frame) => {
    if (frame.type === 'receipt' && frame.from === 'device-b') {
      peerReceipts += 1
      assert.equal(JSON.parse(stored.get('kineo_workout_workspace_v1_7')).drafts['session-a'].slotsState['slot-a'].setsByProfile.user_1[0].weightKg, 45)
    }
    return false
  }
  fail = true
  setup.start()
  assert.equal(peerReceipts, 0)
  assert.equal(setup.storeA.journal.pending.length, 1)
  assert.equal(workspace.drafts['session-a'].slotsState['slot-a'].setsByProfile.user_1[0].weightKg, 40)
  fail = false
  setup.clockA.runNext()
  setup.broker.flush()
  assert.ok(peerReceipts > 0)
  assert.equal(setup.storeA.journal.pending.length, 0)
  assert.equal(storage.loadWorkoutWorkspace().drafts['session-a'].slotsState['slot-a'].setsByProfile.user_1[0].weightKg, 45)
})
