const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createRoomLink, readRoomLink, createShortRoomId, formatRoomCode, parseRoomCode } = require('../src/services/roomLinks.ts')

test('el enlace conserva el origen y abre la sala sin enviar el código al servidor', () => {
  const link = createRoomLink('https://example.test/pilot/?old=1#previous', 'room-abc_123')
  const url = new URL(link)
  assert.equal(url.origin, 'https://example.test')
  assert.equal(url.pathname, '/pilot/')
  assert.equal(url.search, '')
  assert.equal(readRoomLink(url.hash), 'room-abc_123')
})

test('un código corto se puede leer, escribir y compartir sin perder la compatibilidad con enlaces existentes', () => {
  const ids = Array.from({ length: 64 }, () => createShortRoomId())
  assert.equal(new Set(ids).size, ids.length)
  for (const id of ids) {
    const display = formatRoomCode(id)
    assert.match(display, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/)
    assert.equal(parseRoomCode(display.toLowerCase()), id)
    assert.equal(parseRoomCode(display.replace('-', ' ')), id)
    assert.equal(readRoomLink(new URL(createRoomLink('https://example.test/', id)).hash), id)
  }
  assert.equal(parseRoomCode('room-abc_123'), 'room-abc_123')
  assert.equal(parseRoomCode('12/34'), null)
  assert.equal(parseRoomCode('1234567O'), null)
})

test('rechaza enlaces ambiguos y códigos inválidos', () => {
  assert.equal(readRoomLink('#sala=room-a&sala=room-b'), null)
  assert.equal(readRoomLink('#sala=room-%2Fother'), null)
  assert.equal(readRoomLink('#sala=other'), null)
  assert.throws(() => createRoomLink('https://example.test', 'room-a/b'))
})
