import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sha256 = (content) => createHash('sha256').update(content).digest('hex')
const allowedExtensions = /\.(html|md|js|css|json|png|svg|ico|mp4|webm|woff2?|ttf|txt)$/i

export async function inventory(directory) {
  const entries = []
  async function visit(folder) {
    for (const name of (await readdir(folder)).sort()) {
      const absolute = join(folder, name)
      const metadata = await lstat(absolute)
      if (name.startsWith('.')) throw new Error(`Archivo no permitido en dist: ${name}`)
      if (metadata.isSymbolicLink()) throw new Error(`No se empaquetan enlaces: ${name}`)
      if (metadata.isDirectory()) await visit(absolute)
      else {
        if (!metadata.isFile() || !allowedExtensions.test(name)) throw new Error(`Archivo no permitido en dist: ${name}`)
        const content = await readFile(absolute)
        entries.push({ path: relative(directory, absolute).split('\\').join('/'), bytes: content.length, sha256: sha256(content) })
      }
    }
  }
  await visit(directory)
  return entries.sort((left, right) => left.path.localeCompare(right.path))
}

export async function preparePilot(source, destination, supportDirectory, builtAt = new Date().toISOString()) {
  const original = await inventory(source)
  for (const required of ['index.html', 'sw.js', 'manifest.json']) {
    if (!original.some((entry) => entry.path === required)) throw new Error(`Falta ${required}; ejecuta npm run build.`)
  }
  await mkdir(destination, { recursive: true })
  if ((await readdir(destination)).length) throw new Error('El directorio temporal debe estar vacío.')
  await cp(source, destination, { recursive: true })
  const support = [
    ['diagnostico-salas.html', 'diagnostico-salas.html'],
    ['guia-pruebas-salas-v1.7.md', 'LEEME-prueba-salas.md'],
    ['registro-pruebas-salas.md', 'registro-pruebas-salas.md']
  ]
  for (const [name, target] of support) {
    await cp(join(supportDirectory, name), join(destination, target))
  }
  const contentHash = sha256(JSON.stringify(await inventory(destination)))
  const buildId = `kineo-v1.7-salas-${contentHash.slice(0, 12)}`
  const indexPath = join(destination, 'index.html')
  const index = await readFile(indexPath, 'utf8')
  if (!/<title>[^<]*<\/title>/.test(index)) throw new Error('Falta el título de la aplicación compilada.')
  await writeFile(indexPath, index.replace(/<title>[^<]*<\/title>/, `<title>KINEO v1.7 · prueba de salas · ${contentHash.slice(0, 12)}</title>`))
  const workerPath = join(destination, 'sw.js')
  const worker = await readFile(workerPath, 'utf8')
  if (!/const CACHE_NAME = '[^']+';/.test(worker)) throw new Error('Revisa la versión del service worker antes de empaquetar.')
  await writeFile(workerPath, worker.replace(/const CACHE_NAME = '[^']+';/, `const CACHE_NAME = '${buildId}';`))
  const manifest = {
    format: 'kineo-room-pilot', version: 1, buildId, builtAt,
    status: 'piloto web; no versión publicada ni APK',
    sourcePackageVersion: JSON.parse(await readFile(join(appRoot, 'package.json'), 'utf8')).version,
    access: 'public', sensitiveDataAllowed: false, automaticBrokerConnection: false,
    deployment: 'raíz de un origen HTTPS exclusivo para pruebas; no abrir como archivo',
    inventoryExcludes: ['kineo-pilot-build.json'],
    files: await inventory(destination)
  }
  await writeFile(join(destination, 'kineo-pilot-build.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}

async function main() {
  const supportDirectory = resolve(appRoot, 'pruebas')
  await mkdir(supportDirectory, { recursive: true })
  const stage = await mkdtemp(join(tmpdir(), 'kineo-room-pilot-'))
  const temporaryArchive = join(tmpdir(), `${basename(stage)}.zip`)
  try {
    const manifest = await preparePilot(join(appRoot, 'dist'), stage, supportDirectory)
    execFileSync('python3', ['-m', 'zipfile', '-c', temporaryArchive, ...(await readdir(stage)).sort()], { cwd: stage, stdio: 'pipe' })
    execFileSync('python3', ['-m', 'zipfile', '-t', temporaryArchive], { stdio: 'pipe' })
    const archive = await readFile(temporaryArchive)
    const filename = 'kineo-v1.7-prueba-salas.zip'
    const hash = sha256(archive)
    await cp(temporaryArchive, join(supportDirectory, filename))
    await writeFile(join(supportDirectory, `${filename}.sha256`), `${hash}  ${filename}\n`)
    await writeFile(join(supportDirectory, 'compilacion-salas.json'), `${JSON.stringify(manifest, null, 2)}\n`)
    console.log(`Preparado: v1.7/pruebas/${filename}\nID: ${manifest.buildId}\nArchivos web inventariados: ${manifest.files.length}\nSHA-256: ${hash}\nSin despliegue ni conexión al broker.`)
  } finally {
    await rm(stage, { recursive: true, force: true })
    await rm(temporaryArchive, { force: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(`No se generó el piloto: ${error.message}`); process.exitCode = 1 })
}
