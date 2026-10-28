const { test } = require('node:test')
const assert = require('node:assert/strict')
const { mkdtemp, mkdir, writeFile, readFile, rm, symlink } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { createHash } = require('node:crypto')

async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), 'kineo-pilot-test-'))
  const source = join(root, 'dist')
  const support = join(root, 'support')
  await mkdir(source)
  await mkdir(support)
  await writeFile(join(source, 'index.html'), '<title>Kineo anterior</title>')
  await writeFile(join(source, 'sw.js'), "const CACHE_NAME = 'kineo-pwa-cache-v1.5';")
  await writeFile(join(source, 'manifest.json'), '{}')
  for (const name of ['diagnostico-salas.html', 'guia-pruebas-salas-v1.7.md', 'registro-pruebas-salas.md']) {
    await writeFile(join(support, name), `Soporte ${name}`)
  }
  try { await run({ root, source, support, destination: join(root, 'stage') }) }
  finally { await rm(root, { recursive: true, force: true }) }
}

test('el piloto identifica la compilación e inventaría el contenido sin modificar dist', async () => {
  const { preparePilot } = await import('../scripts/package-room-pilot.mjs')
  await fixture(async ({ source, support, destination }) => {
    const manifest = await preparePilot(source, destination, support, '2026-10-26T00:00:00.000Z')
    assert.match(manifest.buildId, /^kineo-v1\.7-salas-[a-f0-9]{12}$/)
    assert.equal(manifest.files.length, 6)
    assert.equal(manifest.automaticBrokerConnection, false)
    assert.equal(manifest.sensitiveDataAllowed, false)
    assert.equal(manifest.access, 'public')
    assert.ok((await readFile(join(destination, 'sw.js'), 'utf8')).includes(manifest.buildId))
    assert.ok((await readFile(join(destination, 'index.html'), 'utf8')).includes('prueba de salas'))
    assert.equal(await readFile(join(source, 'index.html'), 'utf8'), '<title>Kineo anterior</title>')
    assert.equal(await readFile(join(source, 'sw.js'), 'utf8'), "const CACHE_NAME = 'kineo-pwa-cache-v1.5';")
    for (const entry of manifest.files) {
      const bytes = await readFile(join(destination, entry.path))
      assert.equal(bytes.length, entry.bytes)
      assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256)
    }
    assert.deepEqual(JSON.parse(await readFile(join(destination, 'kineo-pilot-build.json'), 'utf8')), manifest)
    await assert.rejects(preparePilot(source, destination, support), /vacío/)
  })
})

test('no empaqueta material de firma, secretos, mapas ni enlaces de dist', async () => {
  const { inventory } = await import('../scripts/package-room-pilot.mjs')
  for (const name of ['firma.keystore', '.env', 'bundle.js.map', 'clave.pem']) {
    await fixture(async ({ source }) => {
      await writeFile(join(source, name), 'NO COMPARTIR')
      await assert.rejects(inventory(source), /no permitido/)
    })
  }
  await fixture(async ({ source, root }) => {
    await writeFile(join(root, 'private.js'), 'privado')
    await symlink(join(root, 'private.js'), join(source, 'link.js'))
    await assert.rejects(inventory(source), /enlaces/)
  })
})

test('rechaza compilaciones incompletas o con service worker no reconocido', async () => {
  const { preparePilot } = await import('../scripts/package-room-pilot.mjs')
  await fixture(async ({ source, support, destination }) => {
    await rm(join(source, 'manifest.json'))
    await assert.rejects(preparePilot(source, destination, support), /Falta manifest/)
    await writeFile(join(source, 'manifest.json'), '{}')
    await writeFile(join(source, 'sw.js'), 'worker no reconocido')
    await assert.rejects(preparePilot(source, destination, support), /service worker/)
  })
})
