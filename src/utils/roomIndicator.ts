import type { MqttRoomState } from '../services/mqttRoomTransport'
import type { PairingState } from '../services/roomPairing'

export type RoomIndicator = { tone: 'connected' | 'waiting' | 'offline'; label: string }

export function roomIndicator(hasRoom: boolean, enabled: boolean, transport: MqttRoomState | null, pairing: PairingState, hasInvitation: boolean): RoomIndicator {
  if (!hasRoom && !hasInvitation) return { tone: 'offline', label: 'Sin sala activa' }
  if (!enabled) return { tone: 'offline', label: 'Sala sin conexión' }
  if (transport?.connection === 'connected') {
    if (transport.issue) return { tone: 'waiting', label: 'Canal conectado; el intercambio requiere atención' }
    return transport.peerSeen
      ? { tone: 'connected', label: 'Canal conectado; intercambio iniciado' }
      : { tone: 'waiting', label: 'Canal conectado; esperando al otro teléfono' }
  }
  if (transport?.connection === 'error' || transport?.connection === 'left' || (!transport && pairing.phase === 'error')) {
    return { tone: 'offline', label: 'Conexión de sala interrumpida' }
  }
  return { tone: 'waiting', label: 'Conectando o esperando a la pareja' }
}
