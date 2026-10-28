const { test } = require('node:test')
const assert = require('node:assert/strict')
const { INITIAL_PROFILES, INITIAL_MESOCYCLE } = require('../src/data/initialData.ts')
const { createWorkoutDraft, getProfileExerciseOptions } = require('../src/utils/workoutState.ts')
const { sharedRoomProfile, applySharedRoomProfile } = require('../src/services/sharedRoomProfile.ts')
const clone = (item) => JSON.parse(JSON.stringify(item))
const session = INITIAL_MESOCYCLE.sessions[0]
const profiles = clone(INITIAL_PROFILES)
profiles.user_1.name = 'Alex'
profiles.user_2.name = 'Sam'
const draft = createWorkoutDraft(session.id, session.slots, profiles, 'user_1')
const shared = () => sharedRoomProfile(profiles.user_2, session, draft)

test('importa solo nombre, color y ejercicios, sin tocar los demás datos del compañero', () => {
  const previous = { ...clone(profiles.user_2), age: 40, bodyWeightKg: 83, goal: 'privado', estimated1RMByVariant: { private: 123 } }
  const received = shared()
  const updated = applySharedRoomProfile(previous, received, session, true)
  assert.equal(updated.name, received.name)
  assert.equal(updated.accentColor, received.color)
  assert.deepEqual(updated.activeVariantBySlot, received.exercises)
  for (const field of ['id', 'gender', 'age', 'bodyWeightKg', 'goal', 'estimated1RMByVariant']) assert.deepEqual(updated[field], previous[field])
  assert.equal(previous.activeVariantBySlot[session.slots[0].slotId], undefined)
})

test('rechaza información añadida y ejercicios o colores ajenos a la rutina', () => {
  const add = { ...shared(), bodyWeightKg: 99 }
  assert.throws(() => applySharedRoomProfile(profiles.user_2, add, session, false), /no válido/)
  assert.throws(() => applySharedRoomProfile(profiles.user_2, { ...shared(), color: 'url(https://example.test)' }, session, false), /no válido/)
  assert.throws(() => applySharedRoomProfile(profiles.user_2, { ...shared(), exercises: { [session.slots[0].slotId]: 'unknown' } }, session, false), /ejercicios/)
})

test('un perfil existente de otra persona no se reemplaza; un hueco vacío solo se usa si no contiene datos', () => {
  const previous = { ...clone(profiles.user_2), name: 'Otra persona' }
  assert.throws(() => applySharedRoomProfile(previous, shared(), session, false), /no lo sustituimos/)
  const placeholder = { ...previous, name: 'Pareja' }
  assert.throws(() => applySharedRoomProfile(placeholder, shared(), session, true), /no lo sustituimos/)
  assert.equal(applySharedRoomProfile(placeholder, shared(), session, false).name, 'Sam')
})

test('un ejercicio recibido se puede mostrar sin importar el género de su propietario', () => {
  const slot = INITIAL_MESOCYCLE.sessions.flatMap((item) => item.slots).find((item) => item.femaleFocusedPrimary && item.femaleFocusedPrimary.id !== item.primaryExercise.id)
  assert.ok(slot)
  const local = { ...clone(profiles.user_2), gender: 'other', activeVariantBySlot: { [slot.slotId]: slot.femaleFocusedPrimary.id } }
  const options = getProfileExerciseOptions(slot, local, 'individual')
  assert.ok(options.some((exercise) => exercise.id === slot.femaleFocusedPrimary.id))
})
