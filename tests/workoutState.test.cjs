const { test } = require('node:test')
const assert = require('node:assert/strict')
const state = require('../src/utils/workoutState.ts')
const math = require('../src/utils/fitnessMath.ts')
const validation = require('../src/utils/dataValidation.ts')
const { INITIAL_PROFILES, INITIAL_MESOCYCLE, INITIAL_DEVICE_CONFIG } = require('../src/data/initialData.ts')

const set = (overrides = {}) => ({ setNumber: 1, targetReps: '10', weightKg: 20, actualReps: 10, rir: 2, completed: false, ...overrides })
const historyEntry = (overrides = {}) => ({ id: 'registro', date: '2026-10-26', profileId: 'user_1', totalVolumeKg: 100, exercises: [], ...overrides })

test('los datos iniciales cumplen los esquemas de migración', () => {
  assert.equal(validation.isProfiles(INITIAL_PROFILES), true)
  assert.equal(validation.isMesocycle(INITIAL_MESOCYCLE), true)
  assert.equal(validation.isDeviceConfig(INITIAL_DEVICE_CONFIG), true)
})

test('cada borrador tiene identidad propia y conserva ambos perfiles', () => {
  const session = INITIAL_MESOCYCLE.sessions[0]
  const first = state.createWorkoutDraft(session.id, session.slots, INITIAL_PROFILES, 'user_2')
  const second = state.createWorkoutDraft(session.id, session.slots, INITIAL_PROFILES, 'user_1')
  assert.notEqual(first.id, second.id)
  assert.equal(first.activeProfileId, 'user_2')
  const slot = first.slotsState[session.slots[0].slotId]
  assert.notEqual(slot.setsByProfile.user_1, slot.setsByProfile.user_2)
  slot.setsByProfile.user_1[0].completed = true
  assert.equal(slot.setsByProfile.user_2[0].completed, false)
  assert.equal(validation.isWorkoutWorkspace({ version: 1, activeSessionId: session.id, drafts: { [session.id]: first } }), true)
})

test('el reloj mide tiempo real, incluidas interrupciones, sin contar pausas', () => {
  const running = state.setClockRunning({ elapsedMs: 0, runningSince: null }, true, 1000)
  assert.equal(state.getDurationMinutes(running, 121000), 2)
  assert.deepEqual(state.setClockRunning(running, true, 5000), running)
  const paused = state.setClockRunning(running, false, 121000)
  assert.equal(state.getDurationMinutes(paused, 999999), 2)
  const resumed = state.setClockRunning(paused, true, 500000)
  assert.equal(state.getDurationMinutes(resumed, 560000), 3)
})

test('el descanso usa una fecha límite y no acumula retrasos de intervalos', () => {
  const rest = { secondsLeft: 120, totalSeconds: 120, isRunning: true, endsAt: 121000, label: 'Descanso' }
  assert.equal(state.getRestSeconds(rest, 61000), 60)
  assert.equal(state.getRestSeconds(rest, 500000), 0)
  assert.equal(state.getRestSeconds({ ...rest, isRunning: false, secondsLeft: 35 }, 500000), 35)
})

test('recalibrar conserva series y bajadas ya registradas en todas las técnicas', () => {
  const completed = set({ completed: true, drops: [{ id: 'bajada', weightKg: 12, reps: 8, completed: true }] })
  const partial = set({ setNumber: 2, drops: [{ id: 'parcial', weightKg: 10, reps: 6, completed: true }] })
  for (const technique of ['normal', 'dropset', 'failure', 'pyramid_asc', 'pyramid_desc']) {
    const result = state.recalibratePendingSets([completed, partial, set({ setNumber: 3 })], 100, technique)
    assert.deepEqual(result[0], completed)
    assert.deepEqual(result[1], partial)
    assert.notEqual(result[2].weightKg, 20)
  }
})

test('las métricas usan RIR registrado y solo volumen realmente completado', () => {
  const result = state.getCompletedSetStats([
    set({ completed: true, weightKg: 40, actualReps: 8, rir: 0, drops: [
      { id: 'si', weightKg: 20, reps: 5, completed: true },
      { id: 'no', weightKg: 15, reps: 10, completed: false }
    ] }),
    set({ completed: true, weightKg: 40, actualReps: 6, rir: 4 }),
    set({ weightKg: 100, actualReps: 20 })
  ])
  assert.equal(result.totalVolumeKg, 660)
  assert.equal(result.completed.length, 2)
  assert.equal(result.bestSetReps, 8)
  assert.equal(result.estimated1RmKg, math.calculateSafe1RM(40, 8, 0))
})

test('las gráficas separan identificadores y conservan el año de cada fecha', () => {
  const history = [historyEntry(), historyEntry({ id: 'pareja', profileId: 'user_2', totalVolumeKg: 200 }),
    historyEntry({ id: 'anterior', date: '2025-10-26', totalVolumeKg: 50 }),
    historyEntry({ id: 'ejemplo', isSampleData: true, totalVolumeKg: 9999 })]
  const chart = state.getVolumeChartData(history, (weight) => weight)
  assert.deepEqual(chart, [
    { date: '2025-10-26', user_1: 50, user_2: null },
    { date: '2026-10-26', user_1: 100, user_2: 200 }
  ])
})

test('la fecha de registro corresponde al calendario local', () => {
  assert.equal(math.getLocalDateKey(new Date(2026, 9, 26, 23, 59)), '2026-10-26')
  assert.equal(math.getLocalDateKey(new Date(2026, 9, 27, 0, 1)), '2026-10-27')
})

test('la gráfica por ejercicio excluye ejemplos y distingue años', () => {
  const exercise = { variantId: 'sentadilla', maxWeightKg: 25, estimated1RmKg: 40 }
  const result = math.getExerciseWeightHistory([
    historyEntry({ exercises: [exercise] }),
    historyEntry({ date: '2025-10-26', exercises: [exercise] }),
    historyEntry({ isSampleData: true, exercises: [{ ...exercise, maxWeightKg: 500 }] })
  ], 'sentadilla', 'kg')
  assert.deepEqual(result.map((point) => point.date), ['2025-10-26', '2026-10-26'])
  assert.equal(result[1].user1Weight, 25)
})
