const { test } = require('node:test')
const assert = require('node:assert/strict')
const { INITIAL_PROFILES, INITIAL_MESOCYCLE, INITIAL_DEVICE_CONFIG, INITIAL_HISTORY } = require('../src/data/initialData.ts')
const { createWorkoutDraft } = require('../src/utils/workoutState.ts')
const { prepareWorkspace, recordDraftChanges } = require('../src/utils/workoutJournal.ts')
const { removeCompanionData } = require('../src/utils/companionData.ts')
const { isWorkoutWorkspace, isProfiles } = require('../src/utils/dataValidation.ts')

function fixture(ownerId) {
  const session = INITIAL_MESOCYCLE.sessions[0]
  const workspace = prepareWorkspace({ version: 1, activeSessionId: session.id, drafts: {
    [session.id]: createWorkoutDraft(session.id, session.slots, INITIAL_PROFILES, ownerId)
  } })
  const previous = workspace.drafts[session.id]
  const next = JSON.parse(JSON.stringify(previous))
  for (const profileId of ['user_1', 'user_2']) next.slotsState[session.slots[0].slotId].setsByProfile[profileId][0].completed = true
  workspace.drafts[session.id] = recordDraftChanges(previous, next, workspace.deviceId)
  workspace.archivedJournals = [workspace.drafts[session.id].journal]
  return { config: { ...INITIAL_DEVICE_CONFIG, primaryProfileId: ownerId, coupleModeEnabled: true, syncRoomCode: 'SALA-ANTERIOR' },
    profiles: JSON.parse(JSON.stringify(INITIAL_PROFILES)), history: JSON.parse(JSON.stringify(INITIAL_HISTORY)), workspace }
}

for (const ownerId of ['user_1', 'user_2']) {
  test(`borrar compañero conserva al titular ${ownerId}, incluidos resultados y diario`, () => {
    const data = fixture(ownerId)
    const before = JSON.stringify(data)
    const companionId = ownerId === 'user_1' ? 'user_2' : 'user_1'
    const cleaned = removeCompanionData(data)
    assert.equal(JSON.stringify(data), before)
    assert.deepEqual(cleaned.profiles[ownerId], data.profiles[ownerId])
    assert.deepEqual(cleaned.history, data.history.filter((entry) => entry.profileId === ownerId))
    assert.equal(cleaned.profiles[companionId].name, 'Perfil sin datos')
    assert.deepEqual(cleaned.profiles[companionId].estimated1RMByVariant, {})
    assert.equal(cleaned.config.coupleModeEnabled, false)
    assert.equal(cleaned.config.syncRoomCode, undefined)
    assert.equal(cleaned.config.primaryProfileId, ownerId)
    for (const [sessionId, draft] of Object.entries(cleaned.workspace.drafts)) {
      for (const [slotId, slot] of Object.entries(draft.slotsState)) {
        assert.deepEqual(slot.setsByProfile[ownerId], data.workspace.drafts[sessionId].slotsState[slotId].setsByProfile[ownerId])
        assert.deepEqual(slot.setsByProfile[companionId], [])
      }
      assert.ok(draft.journal.operations.every((operation) => operation.target.profileId === ownerId))
      assert.equal(draft.activeProfileId, ownerId)
    }
    assert.ok(cleaned.workspace.archivedJournals.every((journal) => journal.baseline.every((entry) => entry.target.profileId === ownerId)))
    assert.ok(isWorkoutWorkspace(cleaned.workspace))
    assert.ok(isProfiles(cleaned.profiles))
    assert.deepEqual(removeCompanionData(cleaned), cleaned)
  })
}

test('el borrado funciona con borradores antiguos sin diario ni archivo', () => {
  const data = fixture('user_1')
  delete data.workspace.archivedJournals
  for (const draft of Object.values(data.workspace.drafts)) delete draft.journal
  assert.ok(isWorkoutWorkspace(removeCompanionData(data).workspace))
})
