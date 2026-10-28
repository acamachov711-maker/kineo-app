import { isRoomIdentifier } from './mqttRoomProtocol'

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function createShortRoomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return `room-${Array.from(bytes, (byte) => CODE_ALPHABET[byte & 31]).join('')}`
}

export function formatRoomCode(roomId: string): string {
  const code = roomId.startsWith('room-') ? roomId.slice(5) : ''
  return code.length === 8 && [...code].every((character) => CODE_ALPHABET.includes(character))
    ? `${code.slice(0, 4)}-${code.slice(4)}` : roomId
}

export function parseRoomCode(input: string): string | null {
  const value = input.trim()
  if (value.startsWith('room-') && isRoomIdentifier(value)) return value
  const short = value.replace(/[\s-]/g, '').toUpperCase()
  return short.length === 8 && [...short].every((character) => CODE_ALPHABET.includes(character)) ? `room-${short}` : null
}

export function createRoomLink(base: string, roomId: string): string {
  if (!isRoomIdentifier(roomId) || !roomId.startsWith('room-')) throw new Error('Código de sala no válido.')
  const url = new URL(base)
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('No se puede compartir esta dirección.')
  url.search = ''
  url.hash = new URLSearchParams({ sala: roomId }).toString()
  return url.toString()
}

export function readRoomLink(hash: string): string | null {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
  const values = params.getAll('sala')
  if (values.length !== 1 || !isRoomIdentifier(values[0]) || !values[0].startsWith('room-')) return null
  return values[0]
}
