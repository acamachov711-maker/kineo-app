import type { RoomJournalStore } from './mqttRoomTransport'
import type { WorkoutWorkspace } from '../utils/workoutState'
import { applyReceivedJournal, getDraftJournal } from '../utils/workoutJournal'
import { isWorkoutWorkspace } from '../utils/dataValidation'

export function createWorkoutRoomStore(
  workoutId: string, readWorkspace: () => WorkoutWorkspace,
  commitWorkspace: (next: WorkoutWorkspace, expected: WorkoutWorkspace) => boolean
): RoomJournalStore {
  const findDraft = (workspace: WorkoutWorkspace) => {
    const matches = Object.values(workspace.drafts).filter((draft) => draft.id === workoutId)
    if (matches.length !== 1 || !getDraftJournal(matches[0])) throw new Error('El entrenamiento ya no está abierto en este teléfono.')
    return matches[0]
  }
  findDraft(readWorkspace())
  return {
    read: () => JSON.parse(JSON.stringify(getDraftJournal(findDraft(readWorkspace()))!)),
    persist: (journal) => {
      try {
        const previous = readWorkspace()
        const draft = findDraft(previous)
        const next = { ...previous, journalError: undefined, drafts: {
          ...previous.drafts, [draft.sessionId]: applyReceivedJournal(draft, journal)
        } }
        if (!isWorkoutWorkspace(next) || readWorkspace() !== previous) return false
        return commitWorkspace(next, previous) === true
      } catch { return false }
    }
  }
}
