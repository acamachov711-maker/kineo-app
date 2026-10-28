require('./register.cjs')
const { spawn } = require('node:child_process')
const { mkdtemp, rm } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const assert = require('node:assert/strict')
const { INITIAL_DEVICE_CONFIG, INITIAL_PROFILES, INITIAL_MESOCYCLE } = require('../src/data/initialData.ts')

async function run() {
  const directory = await mkdtemp(join(tmpdir(), 'kineo-headless-'))
  const browser = spawn(process.env.OD_CHROMIUM_EXECUTABLE_PATH || process.env.CHROMIUM_BIN || 'chromium', [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', `--user-data-dir=${directory}`, 'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, XDG_CONFIG_HOME: join(directory, 'config'), XDG_CACHE_HOME: join(directory, 'cache') } })
  let socket
  try {
    const endpoint = await new Promise((resolve, reject) => {
      let output = ''
      const timeout = setTimeout(() => reject(new Error(`Chromium no inició: ${output.slice(-1000)}`)), 15000)
      browser.stderr.on('data', (chunk) => {
        output += chunk
        const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/)
        if (match) { clearTimeout(timeout); resolve(match[1]) }
      })
      browser.once('error', (error) => { clearTimeout(timeout); reject(error) })
      browser.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`Chromium terminó (${code}): ${output.slice(-1000)}`)) })
    })
    const address = new URL(endpoint)
    const targets = await fetch(`http://${address.host}/json/list`).then((response) => response.json())
    socket = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl)
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
    let sequence = 0
    const requests = new Map()
    const errors = []
    socket.onmessage = ({ data }) => {
      const message = JSON.parse(data)
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text)
      const request = requests.get(message.id)
      if (!request) return
      requests.delete(message.id)
      clearTimeout(request.timeout)
      if (message.error) request.reject(new Error(message.error.message))
      else request.resolve(message.result)
    }
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence
      const timeout = setTimeout(() => { requests.delete(id); reject(new Error(`Tiempo agotado: ${method}`)) }, 15000)
      requests.set(id, { resolve, reject, timeout })
      socket.send(JSON.stringify({ id, method, params }))
    })
    const evaluate = async (expression) => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
      return result.result.value
    }
    const wait = async (expression) => {
      const deadline = Date.now() + 15000
      while (Date.now() < deadline) {
        if (await evaluate(expression)) return
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      throw new Error(`No se cumplió: ${expression}`)
    }
    const clickText = async (text) => {
      const expression = `Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes(${JSON.stringify(text)}))`
      await wait(`Boolean(${expression})`)
      await evaluate(`${expression}.click()`)
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
    const workspace = `JSON.parse(localStorage.getItem('kineo_workout_workspace_v1_7'))`
    const draft = `${workspace}.drafts[${workspace}.activeSessionId]`
    const firstSlotId = INITIAL_MESOCYCLE.sessions[0].slots[0].slotId
    const recorded = `${workspace}.drafts['session-a'].slotsState[${JSON.stringify(firstSlotId)}].setsByProfile.user_1[0]`
    await send('Runtime.enable')
    await send('Page.enable')
    await send('Network.enable')
    await send('Network.setBlockedURLs', { urls: ['*broker.emqx.io*', '*fonts.googleapis.com*', '*fonts.gstatic.com*'] })
    const seed = {
      kineo_device_config_v1_4: JSON.stringify({ ...INITIAL_DEVICE_CONFIG, onboardingCompleted: true, coupleModeEnabled: true, syncRoomCode: undefined }),
      kineo_profiles_v1_4: JSON.stringify(INITIAL_PROFILES)
    }
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `if (!localStorage.getItem('kineo_device_config_v1_4')) { for (const [key,value] of Object.entries(${JSON.stringify(seed)})) localStorage.setItem(key,value) }` })
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
    await send('Page.navigate', { url: process.env.KINEO_TEST_URL || 'http://127.0.0.1:5180/' })
    await clickText('Comenzar Sesión')
    await clickText(INITIAL_MESOCYCLE.sessions[0].slots[0].primaryExercise.name)
    await wait(`Boolean(document.querySelector('button[aria-label^="Completar serie 1"]'))`)
    await evaluate(`document.querySelector('button[aria-label^="Completar serie 1"]').click()`)
    await wait(`${recorded}.completed === true`)
    const completed = await evaluate(recorded)
    console.log('✓ Registro real desde la interfaz')

    await send('Page.reload')
    await wait(`Boolean(document.querySelector('button[aria-label^="Marcar pendiente serie 1"]'))`)
    assert.deepEqual(await evaluate(recorded), completed)
    console.log('✓ Recarga con recuperación de serie y acordeón')

    await clickText('Portada')
    await wait(`!${draft}.isWorkoutStarted`)
    await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.querySelector('span')?.textContent.trim() === 'B').click()`)
    await wait(`${workspace}.activeSessionId === 'session-b'`)
    await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.querySelector('span')?.textContent.trim() === 'A').click()`)
    await wait(`${workspace}.activeSessionId === 'session-a'`)
    assert.deepEqual(await evaluate(recorded), completed)
    console.log('✓ Cambio de sesión sin borrar el borrador anterior')

    await clickText('Comenzar Sesión')
    await evaluate(`(() => { const value = ${workspace}; value.drafts['session-a'].clock = {elapsedMs:120000,runningSince:Date.now()}; localStorage.setItem('kineo_workout_workspace_v1_7',JSON.stringify(value)) })()`)
    await send('Page.reload')
    await wait(`Boolean(document.querySelector('button[aria-label^="Marcar pendiente serie 1"]'))`)
    await evaluate(`window.__originalSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function(key,value) { if(key === 'kineo_history_v1_4') throw new DOMException('Prueba de cuota','QuotaExceededError'); return window.__originalSetItem.call(this,key,value) }`)
    await clickText('Finalizar y Guardar')
    await wait(`Boolean(document.querySelector('[data-od-id="storage-error"]'))`)
    assert.equal(await evaluate(`${workspace}.activeSessionId`), 'session-a')
    assert.equal(await evaluate(`${recorded}.completed`), true)
    console.log('✓ Fallo de escritura visible sin cerrar ni borrar la sesión')

    await evaluate('Storage.prototype.setItem = window.__originalSetItem')
    await clickText('Finalizar y Guardar')
    await wait(`${workspace}.activeSessionId === 'session-b'`)
    const history = await evaluate(`JSON.parse(localStorage.getItem('kineo_history_v1_4'))`)
    assert.equal(history.length, 1)
    assert.equal(history[0].completedSets, 1)
    assert.equal(history[0].durationSource, 'measured')
    assert.ok(history[0].durationMinutes >= 2 && history[0].durationMinutes < 3)
    assert.equal(await evaluate(`${workspace}.drafts['session-a'] === undefined`), true)
    console.log('✓ Reintento sin duplicados y duración medida')

    await clickText('02 / Progreso')
    await wait(`document.body.textContent.includes('Volumen')`)
    assert.deepEqual(errors, [])
    console.log('✓ Panel de progreso sin excepciones de ejecución')
    console.log('6 comprobaciones de navegador completadas; solo datos de prueba y sin conexión al broker público.')
  } finally {
    if (socket) socket.close()
    browser.kill('SIGTERM')
    if (browser.exitCode === null) await new Promise((resolve) => { browser.once('exit', resolve); setTimeout(resolve, 3000) })
    await rm(directory, { recursive: true, force: true })
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1 })
