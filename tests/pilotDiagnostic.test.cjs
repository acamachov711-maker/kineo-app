const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { runInNewContext } = require('node:vm')
const { webcrypto } = require('node:crypto')

function page({ secure = true, storageFails = false, validBuild = true } = {}) {
  const html = readFileSync(join(__dirname, '../pruebas/diagnostico-salas.html'), 'utf8')
  const source = html.match(/<script>([\s\S]*?)<\/script>/)[1]
  const requests = []
  const accesses = []
  const stored = new Map([['kineo_profiles_v1_4', 'DATOS QUE NO SE DEBEN LEER']])
  const elements = Object.fromEntries(['check', 'download', 'report', 'status'].map((name) => [name, {
    disabled: name === 'download', value: '', textContent: '',
    addEventListener(event, listener) { this[event] = listener }
  }]))
  runInNewContext(source, {
    document: { getElementById: (name) => elements[name] },
    navigator: { onLine: true, serviceWorker: { controller: null } },
    isSecureContext: secure, crypto: secure ? webcrypto : undefined,
    TextEncoder, AbortController, setTimeout, clearTimeout,
    localStorage: {
      setItem(key, value) { accesses.push(key); if (storageFails) throw new Error('Cuota'); stored.set(key, value) },
      getItem(key) { accesses.push(key); return stored.get(key) ?? null },
      removeItem(key) { accesses.push(key); stored.delete(key) }
    },
    fetch: async (address) => {
      requests.push(address)
      return { ok: true, json: async () => ({ format: 'kineo-room-pilot', buildId: validBuild ? 'kineo-v1.7-salas-123456abcdef' : 'desconocida' }) }
    }
  })
  return { elements, requests, accesses, stored,
    check: async () => { await elements.check.click(); return JSON.parse(elements.report.value) } }
}

test('el diagnóstico requiere una acción y no lee datos de KINEO ni solicita MQTT', async () => {
  const fixture = page()
  assert.equal(fixture.requests.length, 0)
  assert.equal(fixture.accesses.length, 0)
  const report = await fixture.check()
  assert.equal(report.readyForOnlinePilot, true)
  assert.equal(report.brokerConnectionTested, false)
  assert.equal(report.twoPhonesTested, false)
  assert.equal(report.serviceWorkerControlsPage, false)
  assert.deepEqual(fixture.requests, ['/kineo-pilot-build.json'])
  assert.ok(fixture.accesses.every((key) => key.startsWith('kineo_pilot_probe_')))
  assert.deepEqual([...fixture.stored], [['kineo_profiles_v1_4', 'DATOS QUE NO SE DEBEN LEER']])
  assert.equal(fixture.elements.download.disabled, false)
  assert.ok(fixture.elements.status.textContent.includes('Falta probar la sala'))
})

test('el diagnóstico no aprueba un origen inseguro ni un fallo de almacenamiento', async () => {
  for (const options of [{ secure: false }, { storageFails: true }]) {
    const fixture = page(options)
    const report = await fixture.check()
    assert.equal(report.readyForOnlinePilot, false)
    assert.ok(report.notes.length > 0)
    assert.equal(fixture.elements.check.disabled, false)
    assert.equal(fixture.elements.download.disabled, false)
    assert.equal(fixture.stored.size, 1)
  }
})

test('sin compilación identificada se informa pendiente, no una sala validada', async () => {
  const fixture = page({ validBuild: false })
  const report = await fixture.check()
  assert.equal(report.readyForOnlinePilot, false)
  assert.equal(report.buildId, null)
  assert.ok(report.notes.some((note) => note.includes('compilación')))
  assert.ok(fixture.elements.status.textContent.includes('requisitos pendientes'))
})
