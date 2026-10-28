import mqtt from 'mqtt'
import { PUBLIC_MQTT_BROKER_URL } from './mqttRoomTransport'
import type { MqttConnector, MqttPort, RoomScheduler } from './mqttRoomTransport'
import { isRoomIdentifier, MAX_MQTT_FRAME_BYTES } from './mqttRoomProtocol'
import { isRecord } from '../utils/dataValidation'
import { createId } from '../utils/identity'
import { matchingRoomRoutine, parseRoomContext, roomDifference, validateRoomOffer } from './roomSession'
import type { RoomOffer } from './roomSession'
import { isSharedRoomProfile } from './sharedRoomProfile'
import type { SharedRoomProfile } from './sharedRoomProfile'
import { canonical } from './seriesSync'

export interface PairingIdentity { owner: 'user_1' | 'user_2'; profile: SharedRoomProfile }
const isPairingIdentity = (value: unknown): value is PairingIdentity => isRecord(value) &&
  Object.keys(value).sort().join(',') === 'owner,profile' && ['user_1', 'user_2'].includes(String(value.owner)) && isSharedRoomProfile(value.profile)

export interface PairingState {
  phase: 'idle' | 'connecting' | 'waiting' | 'review' | 'mismatch' | 'error' | 'left'
  message: string
}

export interface PairingOptions {
  role: 'host' | 'guest'
  roomId: string
  deviceId: string
  context: string
  identity?: PairingIdentity
  makeOffer?: (peerDeviceId: string, identity?: PairingIdentity) => RoomOffer
  onOffer?: (offer: RoomOffer) => void
  onState: (state: PairingState) => void
}

export const pairingInbox = (roomId: string, deviceId?: string) => {
  if (!isRoomIdentifier(roomId) || (deviceId !== undefined && !isRoomIdentifier(deviceId))) throw new Error('Código de sala no válido.')
  return `kineo/v1_7/pairing/${roomId}/${deviceId ? `devices/${deviceId}` : 'host'}`
}

const clock: RoomScheduler = { schedule: (callback, delay) => globalThis.setTimeout(callback, delay), cancel: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>) }
const connectMqtt: MqttConnector = (url, options) => mqtt.connect(url, options) as unknown as MqttPort

export function createRoomPairing(options: PairingOptions, connector: MqttConnector = connectMqtt, scheduler: RoomScheduler = clock) {
  if (!isRoomIdentifier(options.deviceId) || !['host', 'guest'].includes(options.role)) throw new Error('Configuración de incorporación no válida.')
  if (options.identity && !isPairingIdentity(options.identity)) throw new Error('Perfil propio no válido.')
  parseRoomContext(options.context)
  const ownInbox = pairingInbox(options.roomId, options.role === 'guest' ? options.deviceId : undefined)
  let client: MqttPort | null = null
  let generation = 0
  let left = false
  let requestId = ''
  let attempts = 0
  let timeout: unknown
  let retry: unknown
  let state: PairingState = { phase: 'idle', message: '' }
  const cancelTimers = () => {
    if (timeout !== undefined) scheduler.cancel(timeout)
    if (retry !== undefined) scheduler.cancel(retry)
    timeout = retry = undefined
  }
  const report = (phase: PairingState['phase'], message: string) => {
    state = { phase, message }
    options.onState({ ...state })
  }
  const close = () => {
    generation += 1
    cancelTimers()
    const previous = client
    client = null
    try { previous?.end(true) } catch { }
  }
  const fail = (message: string) => { close(); report('error', message) }
  const publish = (topic: string, frame: Record<string, unknown>) => {
    const payload = JSON.stringify(frame)
    if (new TextEncoder().encode(payload).byteLength > MAX_MQTT_FRAME_BYTES) throw new Error('La sesión excede el tamaño permitido; no se ha enviado parcialmente.')
    const expected = generation
    client?.publish(topic, payload, { qos: 1, retain: false }, (error) => {
      if (expected === generation && !left && error) fail('No se pudo enviar la incorporación. Reintenta sin borrar tus registros.')
    })
  }
  const request = () => {
    if (left || !client) return
    if (++attempts > 3) { fail('La otra persona no ha respondido. Comprueba el código y que tenga la sala abierta; después reintenta.'); return }
    const expected = generation
    retry = scheduler.schedule(() => { if (!left && generation === expected) request() }, 5000)
    try {
      publish(pairingInbox(options.roomId), { version: 1, type: 'request', roomId: options.roomId,
        from: options.deviceId, requestId, context: options.context, ...(options.identity ? { identity: options.identity } : {}) })
    } catch (error) { fail(error instanceof Error ? error.message : 'No se pudo solicitar la sesión.') }
  }
  const receive = (topic: string, payload: Uint8Array, retained: boolean) => {
    if (topic !== ownInbox || retained) return
    try {
      if (payload.byteLength > MAX_MQTT_FRAME_BYTES) throw new Error('Mensaje de incorporación demasiado grande.')
      const frame = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(payload))
      if (!isRecord(frame) || frame.version !== 1 || frame.roomId !== options.roomId ||
        !isRoomIdentifier(frame.from) || frame.from === options.deviceId || !isRoomIdentifier(frame.requestId)) throw new Error('Mensaje de incorporación no válido.')
      const common = ['version', 'type', 'roomId', 'from', 'requestId']
      if (options.role === 'host') {
        if (frame.type !== 'request' || typeof frame.context !== 'string' || Object.keys(frame).some((key) => ![...common, 'context', 'identity'].includes(key)) ||
          (frame.identity !== undefined && !isPairingIdentity(frame.identity)) || Boolean(frame.identity) !== Boolean(options.identity)) throw new Error('Solicitud no válida.')
        const incoming = frame.identity as PairingIdentity | undefined
        const reason = options.identity && incoming
          ? matchingRoomRoutine(frame.context, options.context, incoming.owner === options.identity.owner) ? null : 'routine'
          : roomDifference(options.context, frame.context)
        if (options.identity && incoming && options.identity.profile.name.trim().toLocaleLowerCase() === incoming.profile.name.trim().toLocaleLowerCase()) throw new Error('Los nombres deben distinguir a las dos personas.')
        const reply = { version: 1, roomId: options.roomId, from: options.deviceId, to: frame.from, requestId: frame.requestId }
        if (reason) {
          publish(pairingInbox(options.roomId, frame.from), { ...reply, type: 'mismatch', reason, title: parseRoomContext(options.context).routine.title })
          report('waiting', reason === 'routine' ? 'Las rutinas no coinciden. Elijan manualmente la misma antes de unirse.' : 'Los perfiles no coinciden. Revisen los nombres y variantes en Ajustes.')
          return
        }
        try {
          const offer = options.makeOffer?.(frame.from, incoming)
          validateRoomOffer(offer)
          if (offer.roomId !== options.roomId || offer.hostDeviceId !== options.deviceId || offer.context !== options.context) throw new Error('La sesión cambió; crea de nuevo la sala.')
          if (options.identity && incoming && (!offer.participants || offer.participants.hostOwner !== options.identity.owner ||
            offer.participants.guestOwner !== incoming.owner || canonical(offer.participants.host) !== canonical(options.identity.profile) ||
            canonical(offer.participants.guest) !== canonical(incoming.profile))) throw new Error('Los perfiles de la sala cambiaron.')
          publish(pairingInbox(options.roomId, frame.from), { ...reply, type: 'offer', offer })
          report('waiting', 'Sesión enviada. Esperando a que la pareja revise y se una.')
        } catch (error) {
          publish(pairingInbox(options.roomId, frame.from), { ...reply, type: 'busy' })
          report('error', error instanceof Error ? error.message : 'No se pudo guardar la vinculación.')
        }
      } else {
        if (frame.to !== options.deviceId || frame.requestId !== requestId) return
        const allowed = frame.type === 'offer' ? ['offer'] : frame.type === 'mismatch' ? ['reason', 'title'] : frame.type === 'busy' ? [] : null
        if (!allowed || Object.keys(frame).some((key) => ![...common, 'to', ...allowed].includes(key))) throw new Error('Respuesta no válida.')
        if (frame.type === 'offer') {
          validateRoomOffer(frame.offer)
          if (frame.offer.roomId !== options.roomId || frame.offer.hostDeviceId !== frame.from) throw new Error('La sesión recibida no coincide con la selección actual.')
          if (options.identity) {
            const people = frame.offer.participants
            if (!people || people.guestOwner !== options.identity.owner || canonical(people.guest) !== canonical(options.identity.profile) ||
              !matchingRoomRoutine(options.context, frame.offer.context, people.hostOwner === people.guestOwner)) throw new Error('La sesión recibida no coincide con tu perfil y rutina.')
          } else if (frame.offer.participants || roomDifference(options.context, frame.offer.context)) throw new Error('La sesión recibida no coincide con la selección actual.')
          cancelTimers()
          options.onOffer?.(frame.offer)
          report('review', 'Revisa la sesión antes de unirte. No se ha aplicado ningún cambio.')
        } else if (frame.type === 'mismatch') {
          if (!['routine', 'profiles'].includes(String(frame.reason)) || typeof frame.title !== 'string' || frame.title.length > 512) throw new Error('Aviso no válido.')
          cancelTimers()
          report('mismatch', frame.reason === 'routine'
            ? `No es la misma rutina. La sala utiliza «${frame.title}». Elijan una en ambos teléfonos y vuelvan a intentarlo; no cambiamos la selección automáticamente.`
            : 'Los perfiles no coinciden. Revisen sus nombres y variantes en Ajustes antes de volver a intentarlo. No importamos perfiles.')
        } else { fail('La sala no admite esta incorporación ahora. Revisa el otro teléfono; no hemos sustituido tus datos.') }
      }
    } catch (error) {
      report('error', error instanceof Error ? error.message : 'Mensaje de incorporación no válido.')
    }
  }
  return {
    getState: () => ({ ...state }),
    connect: () => {
      if (left) throw new Error('Esta incorporación ya se canceló.')
      close()
      const expected = generation
      requestId = createId('request')
      attempts = 0
      report('connecting', 'Conectando al broker público…')
      timeout = scheduler.schedule(() => { if (!left && generation === expected) fail('No se pudo conectar a la sala. Reintenta cuando vuelva la conexión.') }, 15000)
      try {
        client = connector(PUBLIC_MQTT_BROKER_URL, { clientId: createId('pairing'), clean: true, protocolVersion: 4,
          connectTimeout: 10000, reconnectPeriod: 0, resubscribe: false, queueQoSZero: false, keepalive: 30 })
        const alive = () => !left && expected === generation
        client.on('connect', () => {
          if (!alive()) return
          client?.subscribe(ownInbox, { qos: 1 }, (error, granted) => {
            if (!alive()) return
            if (error || !granted?.some((grant) => grant.topic === ownInbox && grant.qos === 1)) { fail('El broker rechazó la suscripción de sala.'); return }
            cancelTimers()
            report('waiting', options.role === 'host' ? 'Comparte el enlace y mantén este teléfono conectado.' : 'Esperando la respuesta del creador…')
            if (options.role === 'guest') { try { request() } catch (error) { fail(error instanceof Error ? error.message : 'No se pudo solicitar la sesión.') } }
          })
        })
        client.on('message', (topic, payload, packet) => { if (alive()) receive(topic, payload, packet?.retain === true) })
        for (const event of ['close', 'offline', 'error'] as const) client.on(event, () => { if (alive()) fail('Se perdió la conexión de incorporación. Los datos locales se conservan; puedes reconectar.') })
      } catch { fail('No se pudo abrir la conexión de sala.') }
    },
    leave: () => { if (left) return; left = true; close(); report('left', 'Incorporación cancelada.') }
  }
}
