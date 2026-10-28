const { test } = require('node:test')
const assert = require('node:assert/strict')
const { roomIndicator } = require('../src/utils/roomIndicator.ts')
const pairing = { phase: 'idle', message: '' }
const transport = (connection, peerSeen = false, issue = null) => ({ access: 'public', connection, peerSeen, issue, lastPeerReceiptAt: null })

test('el indicador distingue una sala ausente, desconectada, en espera y con intercambio iniciado', () => {
  assert.deepEqual(roomIndicator(false, false, null, pairing, false), { tone: 'offline', label: 'Sin sala activa' })
  assert.equal(roomIndicator(true, false, null, pairing, false).tone, 'offline')
  assert.equal(roomIndicator(true, true, transport('connecting'), pairing, false).tone, 'waiting')
  assert.equal(roomIndicator(true, true, transport('connected'), pairing, false).tone, 'waiting')
  assert.equal(roomIndicator(true, true, transport('connected', true), pairing, false).tone, 'connected')
  assert.equal(roomIndicator(true, true, transport('error'), pairing, false).tone, 'offline')
  assert.equal(roomIndicator(true, true, transport('connected', true, 'receipt_timeout'), pairing, false).tone, 'waiting')
  assert.equal(roomIndicator(false, true, null, { phase: 'error', message: 'Falló' }, true).tone, 'offline')
})
