const { test } = require('node:test')
const assert = require('node:assert/strict')
const React = require('react')
const { renderToString } = require('react-dom/server')
const { INITIAL_DEVICE_CONFIG, INITIAL_PROFILES, INITIAL_MESOCYCLE } = require('../src/data/initialData.ts')
const { createWorkoutDraft } = require('../src/utils/workoutState.ts')

function renderApp(initial, tab = 'workout') {
  const stored = new Map(Object.entries(initial))
  global.localStorage = {
    getItem: (key) => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value)
  }
  delete require.cache[require.resolve('../src/services/storageService.ts')]
  delete require.cache[require.resolve('../src/hooks/useWorkoutSession.ts')]
  delete require.cache[require.resolve('../src/components/StorageNotice.tsx')]
  delete require.cache[require.resolve('../src/App.tsx')]
  const App = require('../src/App.tsx').default
  const originalError = console.error
  const originalUseState = React.useState
  React.useState = (value) => originalUseState(value === 'workout' ? tab : value)
  const warnings = []
  console.error = (...messages) => {
    if (!String(messages[0]).includes('useLayoutEffect does nothing on the server')) warnings.push(messages)
  }
  try {
    const markup = renderToString(React.createElement(App))
    assert.deepEqual(warnings, [])
    return markup
  } finally { console.error = originalError; React.useState = originalUseState }
}

const config = JSON.stringify({ ...INITIAL_DEVICE_CONFIG, onboardingCompleted: true, coupleModeEnabled: true, syncRoomCode: undefined })

test('la aplicación nueva renderiza la configuración inicial sin errores', () => {
  const markup = renderApp({})
  assert.ok(markup.length > 1000)
  assert.ok(!markup.includes('data-od-id="storage-error"'))
  assert.ok(markup.includes('Tu pareja configurará los suyos en su propio teléfono'))
})

test('la sala presenta el progreso de ambos perfiles sin sumar series pendientes', () => {
  const { PublicRoomPanel } = require('../src/components/PublicRoomPanel.tsx')
  const { prepareWorkspace, recordDraftChanges } = require('../src/utils/workoutJournal.ts')
  const { buildRoomContext, createHostRoom, bindHostPeer } = require('../src/services/roomSession.ts')
  const { sharedRoomProfile } = require('../src/services/sharedRoomProfile.ts')
  const profiles = JSON.parse(JSON.stringify(INITIAL_PROFILES))
  profiles.user_1.name = 'Alex'; profiles.user_2.name = 'Sam'
  const session = INITIAL_MESOCYCLE.sessions[0]
  let workspace = prepareWorkspace({ version: 1, activeSessionId: session.id, deviceId: 'device-a', drafts: {
    [session.id]: createWorkoutDraft(session.id, session.slots, profiles, 'user_1')
  } })
  const current = workspace.drafts[session.id]
  const changed = JSON.parse(JSON.stringify(current))
  Object.assign(changed.slotsState[session.slots[0].slotId].setsByProfile.user_2[0], { weightKg: 45, actualReps: 10, completed: true })
  workspace.drafts[session.id] = recordDraftChanges(current, changed, 'device-a')
  const context = buildRoomContext(session, profiles, workspace.drafts[session.id])
  workspace = createHostRoom(workspace, context)
  const draft = workspace.drafts[session.id]
  workspace = bindHostPeer(workspace, 'device-b', { ownerProfileId: 'user_1', peerOwnerId: 'user_1',
    ownerProfile: sharedRoomProfile(profiles.user_1, session, draft), peerProfile: sharedRoomProfile(profiles.user_2, session, draft) })
  workspace.room = { ...workspace.room, peerReady: true, peerApplied: true }
  const noAction = () => {}
  const connection = { room: workspace.room, enabled: true, offer: null, pendingCode: null, invitation: null,
    pairing: { phase: 'waiting', message: '' }, transport: null, error: '', reconnect: noAction, leave: noAction }
  const markup = renderToString(React.createElement(PublicRoomPanel, { connection, workspace, weightUnit: 'kg', profiles,
    sessions: INITIAL_MESOCYCLE.sessions, selectedSessionId: session.id, selectSession: noAction }))
  assert.ok(markup.includes('Progreso de esta sesión'))
  const text = markup.replace(/<!--.*?-->/g, '')
  assert.match(text, /Sam: 1 series completadas/)
  assert.match(text, /450 kg de volumen/)
})

test('la configuración anterior abre la sesión preparada sin inventar progreso', () => {
  const markup = renderApp({ kineo_device_config_v1_4: config })
  assert.ok(markup.includes('Comenzar Sesión'))
  assert.ok(!markup.includes('data-od-id="storage-error"'))
  assert.ok(!markup.includes('data-od-id="public-room-panel"'))
  assert.ok(markup.includes('data-od-id="room-connection-indicator"'))
  const settings = renderApp({ kineo_device_config_v1_4: config }, 'settings')
  assert.ok(settings.includes('data-od-id="public-room-panel"'))
  assert.ok(settings.includes('data-od-id="room-routine-select"'))
  assert.ok(settings.includes('sin privacidad ni contraseña validada'))
  const progress = renderApp({ kineo_device_config_v1_4: config }, 'progress')
  assert.ok(!progress.includes('data-od-id="public-room-panel"'))
})

test('el panel de sala muestra diferencias y revisión explícita sin iniciar conexiones al renderizar', () => {
  const { PublicRoomPanel } = require('../src/components/PublicRoomPanel.tsx')
  const { prepareWorkspace } = require('../src/utils/workoutJournal.ts')
  const { buildRoomContext, createHostRoom, bindHostPeer, createRoomOffer } = require('../src/services/roomSession.ts')
  const session = INITIAL_MESOCYCLE.sessions[0]
  const local = prepareWorkspace({ version: 1, activeSessionId: session.id, deviceId: 'device-a', drafts: {
    [session.id]: createWorkoutDraft(session.id, session.slots, INITIAL_PROFILES, 'user_1')
  } })
  const context = buildRoomContext(session, INITIAL_PROFILES, local.drafts[session.id])
  const offer = createRoomOffer(bindHostPeer(createHostRoom(local, context), 'device-b'))
  const noAction = () => { throw new Error('No se ejecutan acciones al renderizar') }
  const connection = { room: undefined, enabled: true, pendingCode: offer.roomId, offer: null, pairing: {
    phase: 'mismatch', message: 'No es la misma rutina. Elijan una en ambos teléfonos.'
  }, transport: null, error: '', create: noAction, reconnect: noAction, leave: noAction, requestJoin: noAction, accept: noAction }
  const props = { connection, sessions: INITIAL_MESOCYCLE.sessions, selectedSessionId: session.id, selectSession: noAction, profiles: INITIAL_PROFILES }
  const mismatch = renderToString(React.createElement(PublicRoomPanel, props))
  assert.ok(mismatch.includes('No es la misma rutina. Elijan una'))
  assert.ok(mismatch.includes('data-od-id="room-routine-select"'))
  assert.ok(!mismatch.includes('data-od-id="room-confirm-join"'))
  const review = renderToString(React.createElement(PublicRoomPanel, { ...props, connection: { ...connection, offer, pairing: { phase: 'review', message: 'Revisar' } } }))
  assert.ok(review.includes('data-od-id="room-confirm-join"'))
  assert.ok(review.includes('No se importarán perfiles'))
  assert.ok(!review.includes('type="password"'))
})

test('el borrador recuperado vuelve directamente al entrenamiento y al perfil guardado', () => {
  const session = INITIAL_MESOCYCLE.sessions[0]
  const draft = createWorkoutDraft(session.id, session.slots, INITIAL_PROFILES, 'user_2')
  draft.isWorkoutStarted = true
  draft.clock.runningSince = Date.now()
  draft.expandedSlotId = session.slots[0].slotId
  draft.slotsState[draft.expandedSlotId].setsByProfile.user_2[0].completed = true
  const markup = renderApp({
    kineo_device_config_v1_4: config,
    kineo_workout_workspace_v1_7: JSON.stringify({ version: 1, activeSessionId: session.id, drafts: { [session.id]: draft } })
  })
  assert.ok(markup.includes('Finalizar y Guardar Sesión'))
  assert.ok(markup.includes(`Marcar pendiente serie 1 de ${INITIAL_PROFILES.user_2.name}`))
  assert.ok(!markup.includes('data-od-id="storage-error"'))
})

test('el borrador corrupto muestra recuperación y no una pantalla en blanco', () => {
  const markup = renderApp({ kineo_device_config_v1_4: config, kineo_workout_workspace_v1_7: '{corrupto' })
  assert.ok(markup.includes('data-od-id="storage-error"'))
  assert.ok(markup.includes('No sobrescribiremos los datos originales'))
  assert.ok(markup.includes('Descargar copia de seguridad'))
})

test('Ajustes no presenta un código antiguo como conexión activa ni confirma envíos', () => {
  const { SettingsAndMesocycle } = require('../src/components/SettingsAndMesocycle.tsx')
  const noop = () => {}
  const markup = renderToString(React.createElement(SettingsAndMesocycle, {
    profiles: INITIAL_PROFILES, deviceConfig: { ...INITIAL_DEVICE_CONFIG, coupleModeEnabled: true, syncRoomCode: 'KINEO-ANTIGUO' },
    mesocycle: INITIAL_MESOCYCLE, weightUnit: 'kg', pendingOperations: 3, hasSampleData: false,
    onUpdateProfiles: noop, onUpdateDeviceConfig: noop, onUpdateMesocycle: noop, onSaveIdealWeight: noop,
    onClearSampleHistory: noop, onResetMesocycle: noop, onReopenOnboarding: noop,
    onDeleteCompanionData: noop
  })).replace(/<!--.*?-->/g, '')
  assert.ok(markup.includes('Sala opcional'))
  assert.ok(markup.includes('3 cambios pendientes en los diarios locales'))
  assert.ok(!markup.includes('Conectar Sala'))
  assert.ok(!markup.includes('Sala sincronizada'))
  assert.ok(markup.includes('Eliminar datos de mi compañero'))
  assert.ok(markup.includes('data-od-id="companion-data-removal"'))
  assert.ok(markup.includes('No se requieren cuentas personales'))
  assert.ok(markup.includes('no hay privacidad ni contraseña validada'))
})

function conflictDraft() {
  const { prepareDraft, applyReceivedJournal } = require('../src/utils/workoutJournal.ts')
  const { appendOperation, mergeRemoteOperations } = require('../src/services/seriesSync.ts')
  const session = INITIAL_MESOCYCLE.sessions[0]
  const base = prepareDraft(createWorkoutDraft(session.id, session.slots, INITIAL_PROFILES, 'user_2'))
  base.isWorkoutStarted = true
  base.expandedSlotId = session.slots[0].slotId
  const target = { slotId: base.expandedSlotId, profileId: 'user_2', setId: base.slotsState[base.expandedSlotId].setsByProfile.user_2[0].id }
  const local = appendOperation(base.journal, target, { weightKg: 40, completed: true }, 'device-a', 'user_1')
  const remote = appendOperation(base.journal, target, { weightKg: 45, completed: true }, 'device-b', 'user_2')
  return applyReceivedJournal(applyReceivedJournal(base, local), mergeRemoteOperations(local, remote.operations))
}

test('la aplicación recupera conflictos guardados y muestra revisión con la serie normal bloqueada', () => {
  const draft = conflictDraft()
  const markup = renderApp({ kineo_device_config_v1_4: config, kineo_workout_workspace_v1_7: JSON.stringify({
    version: 1, deviceId: 'device-a', activeSessionId: draft.sessionId, drafts: { [draft.sessionId]: draft }
  }) })
  assert.ok(markup.includes('data-od-id="series-conflict-review"'))
  assert.ok(markup.includes('40 kg'))
  assert.ok(markup.includes('45 kg'))
  assert.ok(markup.includes('el valor visible aún no es definitivo'))
  assert.ok(!markup.includes('data-od-id="storage-error"'))
  const finishButton = markup.match(/<button\b[^>]*>[\s\S]*?<\/button>/g).find((button) => button.includes('Finalizar y Guardar Sesión'))
  assert.match(finishButton, /^<button[^>]*disabled=""/)
})

test('la revisión no preselecciona versiones y pide cambiar al perfil propietario sin añadir consentimiento', () => {
  const { SeriesConflictReview } = require('../src/components/SeriesConflictReview.tsx')
  const { getDraftConflicts } = require('../src/utils/workoutJournal.ts')
  const draft = conflictDraft()
  const props = { conflicts: getDraftConflicts(draft), profiles: INITIAL_PROFILES, slotNames: {}, deviceId: 'device-a',
    weightUnit: 'kg', activeProfileId: 'user_1', onSelectProfile() {}, onResolve() { throw new Error('No se confirma al renderizar') } }
  const markup = renderToString(React.createElement(SeriesConflictReview, props))
  assert.ok(markup.includes('Cambiar al perfil de'))
  assert.ok(!markup.includes('Confirmar datos de mi serie'))
  assert.ok(!markup.includes('checked=""'))
  assert.ok(markup.includes('no verifica la identidad'))
  const owner = renderToString(React.createElement(SeriesConflictReview, { ...props, activeProfileId: 'user_2', weightUnit: 'lb' }))
  assert.ok(owner.includes('data-od-id="conflict-choose-value-0-0"'))
  assert.ok(!owner.includes('data-od-id="conflict-confirm-0"'))
  assert.ok(owner.includes('88,18 lb'))
  assert.ok(owner.includes('99,21 lb'))
})

test('el cierre muestra las tarjetas de ejercicio editables al revisor y de solo lectura al iniciador', async () => {
  const { prepareWorkspace, recordDraftChanges, applyReceivedJournal } = require('../src/utils/workoutJournal.ts')
  const { acknowledgeOperations } = require('../src/services/seriesSync.ts')
  const { independentRoomContext, buildRoomContext, createHostRoom, bindHostPeer, swapDraftProfiles } = require('../src/services/roomSession.ts')
  const { sharedRoomProfile } = require('../src/services/sharedRoomProfile.ts')
  const { requestRoomClosure, receiveClosure, wireClosure } = require('../src/services/roomClosure.ts')
  const profiles = JSON.parse(JSON.stringify(INITIAL_PROFILES))
  profiles.user_1.name = 'Alex'; profiles.user_2.name = 'Sam'
  const session = INITIAL_MESOCYCLE.sessions[0]
  let a = prepareWorkspace({ version: 1, activeSessionId: session.id, deviceId: 'device-a', drafts: {
    [session.id]: createWorkoutDraft(session.id, session.slots, profiles, 'user_1') } })
  const before = a.drafts[session.id], edited = JSON.parse(JSON.stringify(before))
  edited.expandedSlotId = session.slots[0].slotId
  Object.assign(edited.slotsState[edited.expandedSlotId].setsByProfile.user_2[0], { weightKg: 20, actualReps: 10, completed: true })
  const changed = recordDraftChanges(before, edited, 'device-a')
  a.drafts[session.id] = applyReceivedJournal(changed, acknowledgeOperations(changed.journal, changed.journal.pending))
  const context = independentRoomContext(buildRoomContext(session, profiles, a.drafts[session.id]))
  a = bindHostPeer(createHostRoom(a, context), 'device-b', { ownerProfileId: 'user_1', peerOwnerId: 'user_1',
    ownerProfile: sharedRoomProfile(profiles.user_1, session, a.drafts[session.id]), peerProfile: sharedRoomProfile(profiles.user_2, session, a.drafts[session.id]) })
  a.room = { ...a.room, peerReady: true, peerApplied: true }
  const swappedProfiles = { user_1: { ...profiles.user_2, id: 'user_1' }, user_2: { ...profiles.user_1, id: 'user_2' } }
  let b = { ...JSON.parse(JSON.stringify(a)), deviceId: 'device-b', drafts: { [session.id]: swapDraftProfiles(a.drafts[session.id]) },
    room: { ...a.room, role: 'guest', peerDeviceId: 'device-a', profilesSwapped: true, ownerProfile: a.room.peerProfile, peerProfile: a.room.ownerProfile } }
  a = await requestRoomClosure(a, '2026-10-27', 15)
  b = await receiveClosure(b, wireClosure(a.room.closure))
  b.drafts[session.id].activeProfileId = 'user_1'
  const render = (workspace, people) => renderApp({ kineo_device_config_v1_4: config, kineo_profiles_v1_4: JSON.stringify(people),
    kineo_workout_workspace_v1_7: JSON.stringify(workspace) })
  const reviewer = render(b, swappedProfiles)
  assert.ok(reviewer.includes('data-od-id="closure-exercise-review"'))
  assert.ok(reviewer.includes('data-od-id="room-confirm-closure"'))
  assert.match(reviewer, /aria-label="peso de la serie 1 de Sam"/)
  assert.match(reviewer, /value="20"/)
  assert.ok(!reviewer.includes('Revisar ejercicios, series y cargas'))
  assert.ok(!reviewer.includes('Cambiar Máquina'))
  const initiator = render(a, profiles)
  assert.ok(initiator.includes('data-od-id="closure-exercise-review"'))
  assert.ok(!initiator.includes('data-od-id="room-confirm-closure"'))
  assert.match(initiator, /<fieldset[^>]*disabled=""/)
})
