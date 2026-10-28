import type { DeviceConfig, UserProfile, WorkoutHistoryEntry } from '../types'
import type { SeriesJournal } from '../services/seriesSync'
import type { WorkoutWorkspace } from './workoutState'
import { EMPTY_REST } from './workoutState'
import { getDraftConflicts } from './workoutJournal'

export interface LocalProfileData {
  config: DeviceConfig
  profiles: Record<'user_1' | 'user_2', UserProfile>
  history: WorkoutHistoryEntry[]
  workspace: WorkoutWorkspace
}

export function removeCompanionData(data: LocalProfileData): LocalProfileData {
  const ownerId = data.config.primaryProfileId
  const companionId = ownerId === 'user_1' ? 'user_2' : 'user_1'
  const clearJournal = (journal: SeriesJournal): SeriesJournal => {
    const operations = journal.operations.filter((operation) => operation.target.profileId !== companionId)
    const retainedIds = new Set(operations.map((operation) => operation.id))
    return { ...journal, baseline: journal.baseline.filter((entry) => entry.target.profileId !== companionId),
      operations, pending: journal.pending.filter((identifier) => retainedIds.has(identifier)) }
  }
  const emptyProfile: UserProfile = {
    id: companionId, name: 'Perfil sin datos', gender: 'other', isDeviceOwner: false,
    goal: '', level: '', accentColor: companionId === 'user_1' ? '#FF5500' : '#8B5CF6',
    badgeColor: 'theme-soft-bg theme-text theme-border', activeVariantBySlot: {}, estimated1RMByVariant: {}
  }
  return {
    config: { ...data.config, coupleModeEnabled: false, syncRoomCode: undefined },
    profiles: { ...data.profiles, [companionId]: emptyProfile },
    history: data.history.filter((entry) => entry.profileId !== companionId),
    workspace: { ...data.workspace, room: undefined, journalError: undefined,
      drafts: Object.fromEntries(Object.entries(data.workspace.drafts).map(([sessionId, draft]) => [sessionId, {
        ...draft, activeProfileId: ownerId, rest: { ...EMPTY_REST },
        journal: draft.journal ? clearJournal(draft.journal) : undefined,
        receivedJournal: draft.receivedJournal && getDraftConflicts(draft).some((entry) => entry.target.profileId === ownerId)
          ? clearJournal(draft.receivedJournal) : undefined,
        slotsState: Object.fromEntries(Object.entries(draft.slotsState).map(([slotId, slot]) => [slotId, {
          ...slot, techniqueByProfile: { ...slot.techniqueByProfile, [companionId]: 'normal' },
          setsByProfile: { ...slot.setsByProfile, [companionId]: [] }
        }]))
      }])),
      archivedJournals: (data.workspace.archivedJournals || []).map(clearJournal)
    }
  }
}
