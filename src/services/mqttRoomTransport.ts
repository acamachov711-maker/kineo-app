import mqtt from 'mqtt'
import type { SeriesJournal, SeriesOperation } from './seriesSync'
import { acknowledgeOperations, canonical, isSeriesJournal, mergeRemoteOperations } from './seriesSync'
import { createId } from '../utils/identity'
import {
  createOperationBatches, createRoomBaseDigest, encodeRoomFrame, isRoomIdentifier, parseRoomFrame, roomInbox
} from './mqttRoomProtocol'
import type { MqttRoomAddress, RoomFrame } from './mqttRoomProtocol'
import { historyBatches, mergeRoomHistory } from './roomHistory'
import type { RoomHistoryStore } from './roomHistory'
import type { RoomClosure } from './roomClosure'

export const PUBLIC_MQTT_BROKER_URL = 'wss://broker.emqx.io:8084/mqtt'

interface AuthenticatedMqttRoomConfig extends MqttRoomAddress {
  access?: 'authenticated'
  brokerUrl: string
  username: string
  password: string
}

interface PublicMqttRoomConfig extends MqttRoomAddress {
  access: 'public'
  brokerUrl: string
  username?: never
  password?: never
}

export type MqttRoomConfig = AuthenticatedMqttRoomConfig | PublicMqttRoomConfig

interface ValidatedMqttRoomConfig extends MqttRoomAddress {
  access: 'authenticated' | 'public'
  brokerUrl: string
  username?: string
  password?: string
}

export interface RoomJournalStore {
  read: () => SeriesJournal
  persist: (journal: SeriesJournal) => boolean
}
export interface RoomClosureStore {
  read: () => Omit<RoomClosure, 'applied' | 'delivered'> | null
  receive: (closure: unknown) => Promise<void>
  delivered: (closure: Omit<RoomClosure, 'applied' | 'delivered'>) => boolean
}

export interface MqttPort {
  on(event: 'connect' | 'close' | 'offline' | 'error', listener: () => void): MqttPort
  on(event: 'message', listener: (topic: string, payload: Uint8Array, packet?: { retain?: boolean }) => void): MqttPort
  subscribe(topic: string, options: { qos: 1 }, callback: (error?: Error | null, granted?: { topic: string; qos: number }[]) => void): void
  publish(topic: string, payload: string, options: { qos: 1; retain: false }, callback: (error?: Error | null) => void): void
  end(force: boolean): void
}

export interface MqttConnectOptions {
  clientId: string
  username?: string
  password?: string
  clean: boolean
  protocolVersion: 4
  connectTimeout: number
  reconnectPeriod: number
  resubscribe: boolean
  queueQoSZero: boolean
  keepalive: number
}

export type MqttConnector = (url: string, options: MqttConnectOptions) => MqttPort
export interface RoomScheduler {
  schedule: (callback: () => void, delayMs: number) => unknown
  cancel: (handle: unknown) => void
}

export interface MqttRoomState {
  access: 'authenticated' | 'public'
  connection: 'idle' | 'connecting' | 'connected' | 'retrying' | 'error' | 'left'
  peerSeen: boolean
  lastPeerReceiptAt: number | null
  issue: 'connection_failed' | 'subscription_denied' | 'invalid_message' | 'storage_failed' |
    'receipt_timeout' | 'send_failed' | 'invalid_journal' | null
  historyStatus?: 'waiting' | 'sending' | 'synced' | 'error'
  historyIssue?: string
  historyIncomingIssue?: string
  closureIssue?: string
}

const defaultScheduler: RoomScheduler = {
  schedule: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  cancel: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>)
}
const defaultConnector: MqttConnector = (url, options) => mqtt.connect(url, options) as unknown as MqttPort

function validateConfig(config: MqttRoomConfig): ValidatedMqttRoomConfig {
  let url: URL
  try { url = new URL(config.brokerUrl) } catch { throw new Error('La dirección del broker WSS no es válida.') }
  const host = url.hostname.toLowerCase().replace(/\.$/, '')
  if (url.protocol !== 'wss:' || url.username || url.password || url.search || url.hash) {
    throw new Error('Configura una dirección WSS sin secretos, parámetros ni fragmentos.')
  }
  if (config.access !== undefined && config.access !== 'authenticated' && config.access !== 'public') {
    throw new Error('El modo de acceso MQTT no es válido.')
  }
  if (config.access === 'public') {
    if (url.toString() !== PUBLIC_MQTT_BROKER_URL || 'username' in config || 'password' in config) {
      throw new Error('El modo público solo admite el broker público acordado y no valida contraseñas.')
    }
  } else {
    if (['broker.emqx.io', 'broker.hivemq.com', 'test.mosquitto.org'].includes(host)) {
      throw new Error('Un broker público requiere el modo público explícito; no es acceso autenticado.')
    }
    if (typeof config.username !== 'string' || !config.username.trim() || config.username.length > 512 ||
      typeof config.password !== 'string' || !config.password || config.password.length > 1024) {
      throw new Error('La configuración autenticada requiere credenciales técnicas.')
    }
  }
  if (!isRoomIdentifier(config.roomId) || !isRoomIdentifier(config.workoutId) ||
    !isRoomIdentifier(config.deviceId) || !isRoomIdentifier(config.peerDeviceId)) throw new Error('La configuración de sala está incompleta.')
  roomInbox(config, config.deviceId)
  return {
    roomId: config.roomId, workoutId: config.workoutId, deviceId: config.deviceId, peerDeviceId: config.peerDeviceId,
    access: config.access === 'public' ? 'public' : 'authenticated', brokerUrl: url.toString(),
    ...(config.access === 'public' ? {} : { username: config.username, password: config.password })
  }
}

export async function createMqttRoomTransport(
  config: MqttRoomConfig, store: RoomJournalStore, context: Record<string, unknown>,
  onState: (state: MqttRoomState) => void = () => {}, connector: MqttConnector = defaultConnector,
  scheduler: RoomScheduler = defaultScheduler, historyStore?: RoomHistoryStore, closureStore?: RoomClosureStore
) {
  const checked = validateConfig(config)
  const initial = store.read()
  if (!isSeriesJournal(initial) || initial.workoutId !== config.workoutId) throw new Error('Falta el diario común de esta sala.')
  const digest = await createRoomBaseDigest(initial, context)
  const baseline = canonical(initial.baseline)
  let state: MqttRoomState = { access: checked.access, connection: 'idle', peerSeen: false, lastPeerReceiptAt: null, issue: null }
  let client: MqttPort | null = null
  let generation = 0
  let left = false
  let subscribed = false
  let connectionAttempts = 0
  let connectionTimer: unknown
  let retryTimer: unknown
  let receiptTimer: unknown
  let inFlight: { frame: Extract<RoomFrame, { type: 'operations' }>; attempts: number } | null = null
  let queue: SeriesOperation[][] = []
  let dirty = false
  let replayRequested = false
  let historyTimer: unknown
  let historyFlight: { frame: Extract<RoomFrame, { type: 'history' }>; attempts: number } | null = null
  let historyQueue: Extract<RoomFrame, { type: 'history' }>['entries'][] = []
  let historyDirty = false
  let lastHistorySnapshot = ''
  let closureTimer: unknown
  let closureFlight: { frame: Extract<RoomFrame, { type: 'closure' }>; attempts: number } | null = null
  let lastClosureSnapshot = ''
  let closureDirty = false
  const inbox = roomInbox(checked, checked.deviceId)
  const peerInbox = roomInbox(checked, checked.peerDeviceId)

  const report = (change: Partial<MqttRoomState>) => {
    state = { ...state, ...change }
    try { onState({ ...state }) } catch { }
  }
  const cancel = (handle: unknown) => { if (handle !== undefined) scheduler.cancel(handle) }
  const stopTransmission = () => {
    cancel(receiptTimer)
    receiptTimer = undefined
    inFlight = null
    queue = []
    dirty = false
    replayRequested = false
    cancel(historyTimer)
    historyTimer = undefined
    historyFlight = null
    historyQueue = []
    historyDirty = false
    lastHistorySnapshot = ''
    cancel(closureTimer); closureTimer = undefined; closureFlight = null; lastClosureSnapshot = ''; closureDirty = false
  }
  const currentJournal = () => {
    const journal = store.read()
    if (!isSeriesJournal(journal) || journal.workoutId !== checked.workoutId || canonical(journal.baseline) !== baseline) {
      throw new Error('El diario ha cambiado de base.')
    }
    return journal
  }
  const persistJournal = (journal: SeriesJournal) => {
    try { return store.persist(journal) === true } catch { return false }
  }
  const frameBase = () => ({ version: 1 as const, roomId: checked.roomId, workoutId: checked.workoutId,
    baseDigest: digest, from: checked.deviceId, to: checked.peerDeviceId })
  const publish = (frame: RoomFrame): boolean => {
    if (left || !subscribed || !client) return false
    const expectedGeneration = generation
    try {
      const payload = encodeRoomFrame(frame)
      client.publish(peerInbox, payload, { qos: 1, retain: false }, (error) => {
        if (error && !left && generation === expectedGeneration) report({ issue: 'send_failed' })
      })
      return true
    } catch {
      report({ issue: 'send_failed' })
      return false
    }
  }
  const sendHello = (requestReplay: boolean) => publish({ ...frameBase(), type: 'hello', requestReplay })

  const sendClosureFlight = () => {
    const item = closureFlight
    if (!item || left || !subscribed) return
    cancel(closureTimer); item.attempts++
    const expected = generation
    closureTimer = scheduler.schedule(() => {
      if (left || generation !== expected || closureFlight !== item) return
      if (item.attempts >= 3) {
        closureFlight = null; lastClosureSnapshot = ''
        report({ closureIssue: 'No se ha confirmado la entrega del cierre. Reconecta para reintentar.' })
      } else sendClosureFlight()
    }, item.attempts * 5000)
    if (!publish(item.frame)) report({ closureIssue: 'No se pudo enviar el cierre.' })
  }
  const enqueueClosure = (replay: boolean) => {
    if (!closureStore || left || !subscribed) return
    if (closureFlight) { closureDirty = true; if (replay) lastClosureSnapshot = ''; return }
    try {
      const closure = closureStore.read()
      if (!closure) return
      const snapshot = canonical(closure)
      if (!replay && snapshot === lastClosureSnapshot) return
      lastClosureSnapshot = snapshot
      closureFlight = { frame: { ...frameBase(), type: 'closure', messageId: createId('close'), closure }, attempts: 0 }
      report({ closureIssue: undefined }); sendClosureFlight()
    } catch { report({ closureIssue: 'No se pudo preparar el cierre para enviarlo.' }) }
  }

  const sendHistoryFlight = () => {
    const batch = historyFlight
    if (!batch || !subscribed || left) return
    cancel(historyTimer)
    batch.attempts++
    const expected = generation
    historyTimer = scheduler.schedule(() => {
      if (left || expected !== generation || historyFlight !== batch) return
      if (batch.attempts >= 3) {
        historyFlight = null; historyQueue = []; lastHistorySnapshot = ''
        report({ historyStatus: 'error', historyIssue: 'No se confirmó la recepción del historial. Reconecta para reintentar.' })
      } else sendHistoryFlight()
    }, 5000 * batch.attempts)
    if (!publish(batch.frame)) report({ historyStatus: 'error', historyIssue: 'No se pudo enviar el historial.' })
  }
  const sendNextHistory = () => {
    if (!historyStore || left || !subscribed || historyFlight) return
    const entries = historyQueue.shift()
    if (entries) {
      historyFlight = { frame: { ...frameBase(), type: 'history', batchId: createId('history'), entries }, attempts: 0 }
      sendHistoryFlight()
    } else if (historyDirty) {
      historyDirty = false
      enqueueHistory(false)
    } else report({ historyStatus: 'synced', historyIssue: undefined })
  }
  const enqueueHistory = (replay: boolean) => {
    if (!historyStore || left || !subscribed) return
    if (historyFlight || historyQueue.length) { historyDirty = true; if (replay) lastHistorySnapshot = ''; return }
    try {
      const history = historyStore.read()
      const snapshot = canonical(history)
      if (!replay && snapshot === lastHistorySnapshot) return
      historyQueue = historyBatches(history)
      lastHistorySnapshot = snapshot
      report({ historyStatus: historyQueue.length ? 'sending' : 'waiting', historyIssue: undefined })
      // An empty local history has nothing to acknowledge; it is not evidence that the peer sent theirs.
      if (historyQueue.length) sendNextHistory()
    } catch (error) {
      lastHistorySnapshot = ''
      report({ historyStatus: 'error', historyIssue: error instanceof Error ? error.message : 'No se pudo preparar el historial.' })
    }
  }

  const sendInFlight = () => {
    const batch = inFlight
    if (!batch || left || !subscribed) return
    cancel(receiptTimer)
    batch.attempts += 1
    const expectedGeneration = generation
    receiptTimer = scheduler.schedule(() => {
      if (left || generation !== expectedGeneration || inFlight !== batch) return
      if (batch.attempts >= 3) {
        stopTransmission()
        report({ issue: 'receipt_timeout' })
        return
      }
      sendInFlight()
    }, 5000 * batch.attempts)
    publish(batch.frame)
  }
  const sendNext = () => {
    if (left || !subscribed || inFlight) return
    const operations = queue.shift()
    if (operations) {
      inFlight = { frame: { ...frameBase(), type: 'operations', batchId: createId('batch'), operations }, attempts: 0 }
      sendInFlight()
    } else if (dirty) {
      const replay = replayRequested
      dirty = false
      replayRequested = false
      enqueue(replay)
    }
  }
  const enqueue = (replay: boolean) => {
    if (left || !subscribed) return
    if (inFlight || queue.length) {
      dirty = true
      replayRequested ||= replay
      return
    }
    try {
      queue = createOperationBatches(currentJournal(), replay)
      report({ issue: null })
      sendNext()
    } catch { report({ issue: 'invalid_journal' }) }
  }

  const receive = (topic: string, payload: Uint8Array, packet?: { retain?: boolean }) => {
    if (left || !subscribed || topic !== inbox) return
    try {
      if (packet?.retain) throw new Error('No se aceptan instantáneas retenidas.')
      const frame = parseRoomFrame(payload, checked, digest)
      report({ peerSeen: true })
      if (frame.type === 'hello') {
        if (frame.requestReplay) sendHello(false)
        enqueue(true)
        enqueueHistory(true)
        enqueueClosure(true)
      } else if (frame.type === 'operations') {
        const journal = currentJournal()
        if (frame.operations.some((operation) => !operation ||
          ![checked.deviceId, checked.peerDeviceId].includes(operation.deviceId))) throw new Error('Origen de operación ajeno a los dos dispositivos vinculados.')
        const merged = mergeRemoteOperations(journal, frame.operations)
        if (!persistJournal(merged)) {
          report({ issue: 'storage_failed' })
          return
        }
        report({ issue: null })
        publish({ ...frameBase(), type: 'receipt', batchId: frame.batchId, operationIds: frame.operations.map((operation) => operation.id) })
      } else if (frame.type === 'receipt') {
        if (!inFlight || frame.batchId !== inFlight.frame.batchId) return
        const expectedIds = inFlight.frame.operations.map((operation) => operation.id).sort()
        if (canonical([...frame.operationIds].sort()) !== canonical(expectedIds)) throw new Error('Confirmación ajena al lote enviado.')
        if (!persistJournal(acknowledgeOperations(currentJournal(), frame.operationIds))) {
          stopTransmission()
          report({ issue: 'storage_failed' })
          return
        }
        cancel(receiptTimer)
        receiptTimer = undefined
        inFlight = null
        report({ lastPeerReceiptAt: Date.now(), issue: null })
        sendNext()
      } else if (frame.type === 'history') {
        if (!historyStore) throw new Error('El intercambio de historial no está disponible.')
        try {
          const current = historyStore.read()
          const merged = mergeRoomHistory(current, frame.entries)
          if (canonical(current) !== canonical(merged) && !historyStore.persist(merged)) throw new Error('No se pudo guardar el historial recibido.')
          publish({ ...frameBase(), type: 'history_receipt', batchId: frame.batchId })
          report({ historyIncomingIssue: undefined })
        } catch (error) {
          report({ historyIncomingIssue: error instanceof Error ? error.message : 'No se pudo aplicar el historial.' })
        }
      } else if (frame.type === 'history_receipt') {
        if (!historyFlight || frame.batchId !== historyFlight.frame.batchId) return
        cancel(historyTimer); historyTimer = undefined; historyFlight = null
        sendNextHistory()
      } else if (frame.type === 'closure') {
        if (!closureStore) throw new Error('Este teléfono no admite el cierre compartido.')
        const expected = generation
        void closureStore.receive(frame.closure).then(() => {
          if (!left && expected === generation && subscribed) {
            publish({ ...frameBase(), type: 'closure_receipt', messageId: frame.messageId })
            report({ closureIssue: undefined }); enqueueClosure(false)
          }
        }).catch((error: unknown) => {
          if (!left && expected === generation) report({ closureIssue: error instanceof Error ? error.message : 'No se pudo aplicar el cierre.' })
        })
      } else {
        if (!closureFlight || frame.messageId !== closureFlight.frame.messageId) return
        if (closureStore && !closureStore.delivered(closureFlight.frame.closure)) {
          report({ closureIssue: 'No se pudo guardar el recibo del cierre. Se volverá a intentar.' }); return
        }
        cancel(closureTimer); closureTimer = undefined; closureFlight = null
        report({ closureIssue: undefined })
        if (closureDirty) { closureDirty = false; enqueueClosure(false) }
      }
    } catch { report({ issue: 'invalid_message' }) }
  }

  const retireClient = () => {
    generation += 1
    subscribed = false
    stopTransmission()
    cancel(connectionTimer)
    connectionTimer = undefined
    const previous = client
    client = null
    try { previous?.end(true) } catch { }
  }
  const failedConnection = () => {
    if (left) return
    retireClient()
    cancel(retryTimer)
    retryTimer = undefined
    if (connectionAttempts >= 3) {
      report({ connection: 'error', peerSeen: false, issue: 'connection_failed' })
      return
    }
    report({ connection: 'retrying', peerSeen: false, issue: 'connection_failed' })
    retryTimer = scheduler.schedule(openConnection, 2000 * 2 ** (connectionAttempts - 1))
  }
  const openConnection = () => {
    if (left) return
    retryTimer = undefined
    connectionAttempts += 1
    report({ connection: 'connecting', peerSeen: false, issue: null })
    const expectedGeneration = generation
    connectionTimer = scheduler.schedule(failedConnection, 15000)
    try {
      client = connector(checked.brokerUrl, {
        clientId: `kineo17_${createId('connection')}`,
        ...(checked.access === 'authenticated' ? { username: checked.username, password: checked.password } : {}),
        clean: true, protocolVersion: 4, connectTimeout: 10000, reconnectPeriod: 0, resubscribe: false, queueQoSZero: false, keepalive: 30
      })
      const alive = () => !left && generation === expectedGeneration
      client.on('connect', () => {
        if (!alive()) return
        try {
          client?.subscribe(inbox, { qos: 1 }, (error, granted) => {
            if (!alive()) return
            if (error || !granted?.some((grant) => grant.topic === inbox && grant.qos === 1)) {
              retireClient()
              report({ connection: 'error', issue: 'subscription_denied' })
              return
            }
            cancel(connectionTimer)
            connectionTimer = undefined
            subscribed = true
            report({ connection: 'connected', issue: null })
            sendHello(true)
          })
        } catch { failedConnection() }
      })
      client.on('message', (topic, payload, packet) => { if (alive()) receive(topic, payload, packet) })
      for (const event of ['close', 'offline', 'error'] as const) client.on(event, () => { if (alive()) failedConnection() })
    } catch { failedConnection() }
  }

  return {
    getState: () => ({ ...state }),
    connect: () => {
      if (left) throw new Error('La sala se abandonó; una nueva incorporación requiere otra vinculación explícita.')
      if (state.connection === 'connecting' || state.connection === 'connected' || state.connection === 'retrying') return
      connectionAttempts = 0
      openConnection()
    },
    notifyLocalChanges: () => enqueue(false),
    notifyHistoryChanges: () => enqueueHistory(false),
    notifyClosureChanges: () => enqueueClosure(false),
    leave: () => {
      if (left) return
      left = true
      cancel(retryTimer)
      retryTimer = undefined
      retireClient()
      delete checked.password
      delete checked.username
      report({ connection: 'left', peerSeen: false, issue: null })
    }
  }
}
