const { test } = require('node:test')
const assert = require('node:assert/strict')
const math = require('../src/utils/fitnessMath.ts')

const entry = (date, overrides = {}) => ({
  id: date,
  date,
  profileId: 'user_1',
  totalVolumeKg: 100,
  completedSets: 1,
  durationMinutes: 10,
  exercises: [],
  ...overrides
})

test('la semana actual no hereda entrenamientos de semanas antiguas', () => {
  const result = math.calculateProfileStreak([entry('2026-09-07')], 'user_1', new Date(2026, 9, 26, 12))
  assert.equal(result.weeklySessionsDone, 0)
  assert.equal(result.activeWeekStreak, 0)
})

test('la racha cuenta semanas consecutivas y no semanas separadas', () => {
  const history = [entry('2026-09-07'), entry('2026-10-19'), entry('2026-10-26')]
  const result = math.calculateProfileStreak(history, 'user_1', new Date(2026, 9, 26, 12))
  assert.equal(result.activeWeekStreak, 2)
  assert.equal(result.weeklySessionsDone, 1)
})

test('la constancia excluye ejemplos, fechas futuras y duplicados diarios', () => {
  const history = [entry('2026-10-26'), entry('2026-10-26', { id: 'otra' }), entry('2026-10-27'), entry('2026-10-25', { isSampleData: true })]
  const result = math.calculateProfileStreak(history, 'user_1', new Date(2026, 9, 26, 12))
  assert.equal(result.weeklySessionsDone, 1)
  assert.equal(result.totalWorkouts, 2)
})

test('recalibrar una pirámide preserva íntegra una serie completada', () => {
  const completed = { setNumber: 1, targetReps: '10', weightKg: 50, actualReps: 9, rir: 0, completed: true }
  const pending = { ...completed, setNumber: 2, completed: false }
  const result = math.buildPyramidSets('pyramid_asc', 100, [completed, pending])
  assert.deepEqual(result[0], completed)
  assert.notEqual(result[1].weightKg, pending.weightKg)
})

test('la entrada decimal y conversión de unidades conservan su comportamiento', () => {
  assert.equal(math.sanitizeDecimalInput('12,5'), '12.5')
  assert.ok(Math.abs(math.lbToKg(math.kgToLb(25)) - 25) < 0.1)
})
