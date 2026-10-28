const { test } = require('node:test')
const assert = require('node:assert/strict')
const sync = require('../src/services/seriesSync.ts')

const target = { slotId: 'a1', profileId: 'user_1', setId: 'serie-1' }
const value = { setNumber: 1, targetReps: '10', weightKg: 20, actualReps: 10, rir: 2,
  isFailure: false, completed: false, compensatedDirection: null, drops: [], deleted: false }
const base = () => sync.createJournal('entrenamiento-1', [
  { target, value }, { target: { ...target, profileId: 'user_2' }, value }
])
const edit = (journal, changes, device = 'movil-a', subject = target, actor = 'user_1', kind = 'edit') =>
  sync.appendOperation(journal, subject, changes, device, actor, kind)
const merge = (local, remote) => sync.mergeRemoteOperations(local, remote.operations)
const series = (journal) => sync.projectJournal(journal).find((entry) => entry.target.profileId === 'user_1')
const conflict = () => merge(edit(base(), { weightKg: 30 }), edit(base(), { weightKg: 40 }, 'movil-b'))

test('los dos móviles convergen con cambios compatibles en la misma serie', () => {
  const first = edit(base(), { weightKg: 30 })
  const second = edit(base(), { actualReps: 12 }, 'movil-b')
  const firstMerged = merge(first, second)
  const secondMerged = merge(second, first)
  assert.deepEqual(sync.projectJournal(firstMerged), sync.projectJournal(secondMerged))
  assert.equal(series(firstMerged).value.weightKg, 30)
  assert.equal(series(firstMerged).value.actualReps, 12)
  assert.deepEqual(series(firstMerged).conflicts, [])
})

test('registrar a la pareja conserva propietario y autor distintos', () => {
  const journal = edit(base(), { completed: true }, 'movil-a', { ...target, profileId: 'user_2' }, 'user_1')
  assert.equal(journal.operations[0].actorProfileId, 'user_1')
  assert.equal(journal.operations[0].target.profileId, 'user_2')
  assert.equal(sync.projectJournal(journal).find((entry) => entry.target.profileId === 'user_2').value.completed, true)
})

test('solo la serie contradictoria se excluye de resultados resueltos', () => {
  const journal = conflict()
  assert.equal(series(journal).conflicts.length, 1)
  assert.equal(series(journal).conflicts[0].field, 'weightKg')
  assert.deepEqual(series(journal).conflicts[0].versions.map((version) => version.value).sort(), [30, 40])
  assert.equal(journal.operations.length, 2)
  assert.deepEqual(sync.getResolvedSeries(journal).map((entry) => entry.target.profileId), ['user_2'])
})

test('dos anotaciones iguales no duplican una serie ni crean conflicto', () => {
  const journal = merge(edit(base(), { weightKg: 30 }), edit(base(), { weightKg: 30 }, 'movil-b'))
  assert.equal(series(journal).value.weightKg, 30)
  assert.deepEqual(series(journal).conflicts, [])
  assert.equal(journal.operations.length, 2)
  assert.equal(sync.getResolvedSeries(journal).length, 2)
})

test('repetir y reordenar mensajes no cambia el resultado', () => {
  const first = edit(base(), { weightKg: 30 })
  const second = edit(first, { actualReps: 12 })
  const received = sync.mergeRemoteOperations(base(), [...second.operations].reverse())
  assert.deepEqual(sync.projectJournal(received), sync.projectJournal(second))
  const replay = merge(received, second)
  assert.deepEqual(sync.projectJournal(replay), sync.projectJournal(received))
  assert.equal(replay.operations.length, 2)
})

test('una revisión posterior sustituye el valor anterior sin usar horas de reloj', () => {
  const first = edit(base(), { weightKg: 30 })
  const second = edit(first, { weightKg: 40 })
  second.operations[0].createdAt = 999999
  second.operations[1].createdAt = 0
  assert.equal(series(second).value.weightKg, 40)
  assert.deepEqual(series(second).conflicts, [])
})

test('resolver conserva ambas versiones originales y referencia todas las revisiones', () => {
  const journal = conflict()
  const resolved = edit(journal, { weightKg: 35 }, 'movil-a', target, 'user_1', 'resolve')
  assert.equal(series(resolved).value.weightKg, 35)
  assert.deepEqual(series(resolved).conflicts, [])
  assert.equal(resolved.operations.length, 3)
  assert.deepEqual(resolved.operations[2].parents.sort(), journal.operations.map((operation) => operation.id).sort())
  assert.equal(sync.getResolvedSeries(resolved).length, 2)
})

test('dos resoluciones diferentes y simultáneas vuelven a requerir revisión', () => {
  const journal = conflict()
  const first = edit(journal, { weightKg: 30 }, 'movil-a', target, 'user_1', 'resolve')
  const second = edit(journal, { weightKg: 40 }, 'movil-b', target, 'user_2', 'resolve')
  assert.equal(series(merge(first, second)).conflicts.length, 1)
})

test('no se edita silenciosamente una serie con conflicto sin resolver', () => {
  assert.throws(() => edit(conflict(), { rir: 0 }), /Revisa/)
  assert.throws(() => edit(conflict(), { rir: 0 }, 'movil-a', target, 'user_1', 'resolve'), /todos los campos/)
})

test('borrar y editar simultáneamente requiere revisar la serie', () => {
  const removed = edit(base(), { deleted: true })
  const changed = edit(base(), { weightKg: 30 }, 'movil-b')
  const merged = merge(removed, changed)
  assert.ok(series(merged).conflicts.some((item) => item.field === 'deleted'))
  const restored = edit(merged, { deleted: false }, 'movil-a', target, 'user_1', 'resolve')
  assert.deepEqual(series(restored).conflicts, [])
  assert.equal(series(restored).value.weightKg, 30)
  assert.equal(sync.getResolvedSeries(restored).length, 2)
})

test('un borrado posterior a una edición no revive por un mensaje retrasado', () => {
  const changed = edit(base(), { weightKg: 30 })
  const removed = edit(changed, { deleted: true })
  const received = merge(removed, changed)
  assert.equal(series(received).value.deleted, true)
  assert.equal(sync.getResolvedSeries(received).length, 1)
})

test('las series añadidas tienen creación explícita y se pueden editar', () => {
  const added = { ...target, setId: 'extra' }
  const created = edit(base(), { ...value, setNumber: 2 }, 'movil-a', added, 'user_1', 'create')
  const changed = edit(created, { weightKg: 50 }, 'movil-a', added)
  const received = sync.mergeRemoteOperations(base(), [...changed.operations].reverse())
  assert.equal(sync.getResolvedSeries(received).find((entry) => entry.target.setId === 'extra').value.weightKg, 50)
})

test('no se acepta reutilizar un identificador con otro contenido', () => {
  const journal = edit(base(), { weightKg: 30 })
  assert.throws(() => sync.mergeRemoteOperations(journal, [{ ...journal.operations[0], changes: { weightKg: 90 } }]), /identificador/)
  assert.equal(series(journal).value.weightKg, 30)
})

test('un lote de otro entrenamiento se rechaza sin modificar el estado local', () => {
  const journal = edit(base(), { weightKg: 30 })
  assert.throws(() => sync.mergeRemoteOperations(base(), [{ ...journal.operations[0], workoutId: 'otro' }]), /entrenamiento/)
  assert.equal(base().operations.length, 0)
})

test('faltas de dependencias, ciclos y revisiones de otro propietario son rechazados', () => {
  const journal = edit(edit(base(), { weightKg: 30 }), { rir: 1 })
  assert.throws(() => sync.mergeRemoteOperations(base(), [journal.operations[1]]), /revisiones/)
  const cyclic = { ...journal.operations[0], parents: [journal.operations[0].id] }
  assert.throws(() => sync.mergeRemoteOperations(base(), [cyclic]), /revisiones/)
  const wrongOwner = { ...journal.operations[1], target: { ...target, profileId: 'user_2' } }
  assert.throws(() => sync.mergeRemoteOperations(base(), [journal.operations[0], wrongOwner]), /revisiones/)
})

test('los límites y campos desconocidos se rechazan antes de aplicar datos', () => {
  const operation = edit(base(), { weightKg: 30 }).operations[0]
  for (const changed of [
    { ...operation, changes: { weightKg: -1 } },
    { ...operation, changes: { weightKg: NaN } },
    { ...operation, changes: { actualReps: 1.5 } },
    { ...operation, changes: { arbitrary: 1 } },
    { ...operation, kind: { toString: 1 } },
    { ...operation, profiles: {} }
  ]) assert.throws(() => sync.mergeRemoteOperations(base(), [changed]), /válido/)
  assert.throws(() => sync.mergeRemoteOperations(base(), Array(1001).fill(operation)), /válido/)
})

test('recibir operaciones no confirma las pendientes y confirmar no borra el historial', () => {
  const local = edit(base(), { weightKg: 30 })
  const remote = edit(base(), { actualReps: 12 }, 'movil-b')
  const merged = merge(local, remote)
  assert.equal(sync.getPendingOperations(merged).length, 1)
  assert.equal(sync.getPendingOperations(merged)[0].id, local.operations[0].id)
  const acknowledged = sync.acknowledgeOperations(merged, [local.operations[0].id, 'desconocida'])
  assert.equal(sync.getPendingOperations(acknowledged).length, 0)
  assert.equal(acknowledged.operations.length, 2)
})

test('los datos recibidos no pueden mutar el diario por una referencia compartida', () => {
  const remote = edit(base(), { weightKg: 30 })
  const merged = merge(base(), remote)
  remote.operations[0].changes.weightKg = 999
  assert.equal(series(merged).value.weightKg, 30)
})

test('tres réplicas convergen con todas las permutaciones de entrega y mensajes repetidos', () => {
  const replicas = [edit(base(), { weightKg: 30 }), edit(base(), { actualReps: 12 }, 'movil-b'), edit(base(), { rir: 1 }, 'movil-c')]
  const orders = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]
  let expected
  for (const order of orders) {
    let current = base()
    for (const index of [...order, ...order]) current = merge(current, replicas[index])
    const projected = sync.projectJournal(current)
    if (expected) assert.deepEqual(projected, expected)
    else expected = projected
  }
})
