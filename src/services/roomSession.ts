import type { UserProfile, WorkoutSessionTemplate } from '../types'
import type { WorkoutDraft, WorkoutWorkspace, WorkoutRoomBinding } from '../utils/workoutState'
import type { RoomJournalStore } from './mqttRoomTransport'
import { EMPTY_REST, hasRecordedSlot } from '../utils/workoutState'
import { getDraftConflicts, getDraftJournal } from '../utils/workoutJournal'
import { isRecord, isWorkoutWorkspace } from '../utils/dataValidation'
import { canonical } from './seriesSync'
import { isRoomIdentifier } from './mqttRoomProtocol'
import { createShortRoomId } from './roomLinks'
import type { SeriesJournal, ProfileId } from './seriesSync'
import { sharedRoomProfile } from './sharedRoomProfile'
import { applySharedRoomProfile, isSharedRoomProfile } from './sharedRoomProfile'
import type { SharedRoomProfile } from './sharedRoomProfile'
export { sharedRoomProfile } from './sharedRoomProfile'

type Profiles = Record<'user_1' | 'user_2', UserProfile>
const otherProfile = (id: ProfileId): ProfileId => id === 'user_1' ? 'user_2' : 'user_1'

export function independentRoomContext(context: string): string {
  parseRoomContext(context)
  const value = JSON.parse(context)
  value.profiles = [{ id: 'user_1' }, { id: 'user_2' }]
  value.profileMode = 'independent'
  return canonical(value)
}

export function roomContextsEqual(local: string, remote: string): boolean {
  const comparable = (context: string) => {
    const value = JSON.parse(context)
    if (!Array.isArray(value.profiles)) throw new Error('Los perfiles de la sala no son válidos.')
    value.profiles = value.profiles.map((profile: Record<string, unknown>) => {
      const { color, ...identity } = profile
      return identity
    })
    return canonical(value)
  }
  return comparable(local) === comparable(remote)
}

export function swapJournalProfiles(journal: SeriesJournal): SeriesJournal {
  return { ...journal,
    baseline: journal.baseline.map((entry) => ({ ...entry, target: { ...entry.target, profileId: otherProfile(entry.target.profileId) } })),
    operations: journal.operations.map((entry) => ({ ...entry, actorProfileId: otherProfile(entry.actorProfileId),
      target: { ...entry.target, profileId: otherProfile(entry.target.profileId) } })) }
}

export function mapRoomStoreProfiles(store: RoomJournalStore, swapped: boolean): RoomJournalStore {
  return swapped ? { read: () => swapJournalProfiles(store.read()), persist: (journal) => store.persist(swapJournalProfiles(journal)) } : store
}

export function swapDraftProfiles(draft: WorkoutDraft): WorkoutDraft {
  return { ...draft, activeProfileId: otherProfile(draft.activeProfileId),
    slotsState: Object.fromEntries(Object.entries(draft.slotsState).map(([id, slot]) => [id, { ...slot,
      techniqueByProfile: { user_1: slot.techniqueByProfile.user_2, user_2: slot.techniqueByProfile.user_1 },
      setsByProfile: { user_1: slot.setsByProfile.user_2, user_2: slot.setsByProfile.user_1 } }])),
    journal: draft.journal && swapJournalProfiles(draft.journal),
    receivedJournal: draft.receivedJournal && swapJournalProfiles(draft.receivedJournal) }
}

export function swapRoomContext(value: string): string {
  const context = JSON.parse(value)
  if (!Array.isArray(context.profiles) || context.profiles.length !== 2 ||
    context.profiles[0]?.id !== 'user_1' || context.profiles[1]?.id !== 'user_2' || !Array.isArray(context.routine?.slots)) {
    throw new Error('Los perfiles de la sala no son válidos.')
  }
  context.profiles = [{ ...context.profiles[1], id: 'user_1' }, { ...context.profiles[0], id: 'user_2' }]
  for (const slot of context.routine.slots) {
    if (!isRecord(slot.techniques) || !isRecord(slot.repetitions) ||
      !('user_1' in slot.techniques && 'user_2' in slot.techniques && 'user_1' in slot.repetitions && 'user_2' in slot.repetitions)) {
      throw new Error('La estructura de la sala no es válida.')
    }
    slot.techniques = { user_1: slot.techniques.user_2, user_2: slot.techniques.user_1 }
    slot.repetitions = { user_1: slot.repetitions.user_2, user_2: slot.repetitions.user_1 }
  }
  return canonical(context)
}

export function contextsNeedProfileSwap(local: string, remote: string): boolean {
  if (roomContextsEqual(local, remote)) return false
  if (roomContextsEqual(swapRoomContext(local), remote)) return true
  throw new Error('Las rutinas o los perfiles no coinciden.')
}
export function createBoundRoomStore(binding: WorkoutRoomBinding, readWorkspace: () => WorkoutWorkspace,
  contextFor: (workspace: WorkoutWorkspace) => string, store: RoomJournalStore): RoomJournalStore {
  const check = () => {
    const workspace = readWorkspace()
    const context = contextFor(workspace)
    if (workspace.room?.roomId !== binding.roomId || workspace.room.workoutId !== binding.workoutId ||
      workspace.room.context !== binding.context || workspace.room.peerDeviceId !== binding.peerDeviceId ||
      workspace.room.profilesSwapped !== binding.profilesSwapped || workspace.room.ownerProfileId !== binding.ownerProfileId ||
      canonical(workspace.room.ownerProfile || null) !== canonical(binding.ownerProfile || null) ||
      canonical(workspace.room.peerProfile || null) !== canonical(binding.peerProfile || null) ||
      !context || !roomContextsEqual(context, binding.context)) {
      throw new Error('La vinculación o la rutina de sala cambió. Reconecta tras revisarla.')
    }
  }
  return {
    read: () => { check(); return store.read() },
    persist: (journal) => { try { check(); if (binding.peerProfile && !readWorkspace().room?.peerApplied) return false; return store.persist(journal) } catch { return false } }
  }
}

export interface RoomOffer {
  roomId: string
  hostDeviceId: string
  context: string
  draft: WorkoutDraft
  participants?: { hostOwner: ProfileId; guestOwner: ProfileId; host: SharedRoomProfile; guest: SharedRoomProfile }
}

export function matchingRoomRoutine(local: string, remote: string, swapped: boolean): boolean {
  const own = parseRoomContext(swapped ? swapRoomContext(local) : local)
  return canonical(own.routine) === canonical(parseRoomContext(remote).routine)
}

// Las metas por serie pueden cambiar durante el entrenamiento (p. ej. por
// compensación de carga); pertenecen al diario, no a la identidad de la sala.
export function matchingActiveRoomRoutine(local: string, remote: string, swapped: boolean): boolean {
  const withoutLiveTargets = (context: string) => {
    const value = JSON.parse(context)
    if (!Array.isArray(value.routine?.slots)) throw new Error('La estructura de la sala no es válida.')
    value.routine.slots = value.routine.slots.map(({ repetitions: _repetitions, ...slot }: Record<string, unknown>) => slot)
    return canonical(value.routine)
  }
  return withoutLiveTargets(swapped ? swapRoomContext(local) : local) === withoutLiveTargets(remote)
}

export function currentBoundRoomContext(workspace: WorkoutWorkspace, sessions: WorkoutSessionTemplate[], profiles: Profiles): string {
  const binding = workspace.room
  const draft = Object.values(workspace.drafts).find((item) => item.id === binding?.workoutId)
  const session = sessions.find((item) => item.id === draft?.sessionId)
  if (!binding || !draft || !session) return ''
  const local = buildRoomContext(session, profiles, draft)
  if (binding.ownerProfile && binding.ownerProfileId) {
    const self = sharedRoomProfile(profiles[binding.ownerProfileId], session, draft)
    if (self.name !== binding.ownerProfile.name || canonical(self.exercises) !== canonical(binding.ownerProfile.exercises) ||
      !matchingActiveRoomRoutine(local, binding.context, !!binding.profilesSwapped)) return ''
    return binding.context
  }
  const normalized = JSON.parse(binding.context).profileMode === 'independent' ? independentRoomContext(local) : local
  const adjusted = binding.profilesSwapped ? swapRoomContext(normalized) : normalized
  const strip = (context: string) => {
    const value = JSON.parse(context)
    value.routine.slots = value.routine.slots.map(({ repetitions: _repetitions, ...slot }: Record<string, unknown>) => slot)
    return canonical(value)
  }
  return roomContextsEqual(strip(adjusted), strip(binding.context)) ? binding.context : ''
}

export function buildRoomContext(session: WorkoutSessionTemplate, profiles: Profiles, draft: WorkoutDraft): string {
  const variant = (item: WorkoutSessionTemplate['slots'][number]['primaryExercise']) =>
    ({ id: item.id, name: item.name, equipment: item.equipment })
  const context = canonical({
    version: 1,
    routine: {
      id: session.id, code: session.code, title: session.title,
      slots: session.slots.map((slot) => {
        const live = draft.slotsState[slot.slotId]
        if (!live) throw new Error('La rutina no coincide con el entrenamiento abierto.')
        return {
          id: slot.slotId, order: slot.order, superset: slot.supersetGroup || null, rest: slot.restSeconds,
          variants: [slot.primaryExercise, ...slot.alternatives].map(variant),
          femaleVariants: slot.femaleFocusedPrimary ? [slot.femaleFocusedPrimary, ...(slot.femaleFocusedAlternatives || [])].map(variant) : [],
          mode: live.syncMode, techniques: live.techniqueByProfile,
          repetitions: Object.fromEntries((['user_1', 'user_2'] as const).map((profileId) =>
            [profileId, live.setsByProfile[profileId].map((entry) => entry.targetReps)]))
        }
      })
    },
    profiles: (['user_1', 'user_2'] as const).map((profileId) => ({ id: profileId, ...sharedRoomProfile(profiles[profileId], session, draft) }))
  })
  if (context.length > 64000) throw new Error('La rutina excede el tamaño permitido para compartirla.')
  return context
}

export function parseRoomContext(value: unknown): { routine: { title: string }; profiles: unknown } {
  if (typeof value !== 'string' || value.length > 64000) throw new Error('La descripción de sala no es válida.')
  const parsed = JSON.parse(value)
  if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.routine) ||
    typeof parsed.routine.title !== 'string' || !Array.isArray(parsed.profiles)) throw new Error('La descripción de sala no es válida.')
  return parsed as unknown as { routine: { title: string }; profiles: unknown }
}

export function roomDifference(local: string, remote: string): 'routine' | 'profiles' | null {
  const own = parseRoomContext(local)
  const other = parseRoomContext(remote)
  const switched = parseRoomContext(swapRoomContext(local))
  if (roomContextsEqual(local, remote) || roomContextsEqual(swapRoomContext(local), remote)) {
    const people = own.profiles as Array<{ name?: unknown }>
    if (people.length !== 2 || typeof people[0]?.name !== 'string' || typeof people[1]?.name !== 'string' ||
      people[0].name.trim().toLocaleLowerCase() === people[1].name.trim().toLocaleLowerCase()) return 'profiles'
    return null
  }
  if (canonical(own.routine) !== canonical(other.routine) && canonical(switched.routine) !== canonical(other.routine)) return 'routine'
  if (canonical(own.profiles) !== canonical(other.profiles)) return 'profiles'
  return 'routine'
}

export function createHostRoom(workspace: WorkoutWorkspace, context: string): WorkoutWorkspace {
  if (workspace.room) throw new Error('Sal de la sala actual antes de crear otra.')
  parseRoomContext(context)
  const draft = workspace.drafts[workspace.activeSessionId]
  const journal = draft && getDraftJournal(draft)
  if (!journal || getDraftConflicts(draft).length || journal.operations.some((operation) => operation.deviceId !== workspace.deviceId)) {
    throw new Error('Resuelve las revisiones pendientes o prepara un entrenamiento nuevo antes de crear la sala.')
  }
  const next: WorkoutWorkspace = { ...workspace, room: {
    version: 1, role: 'host', roomId: createShortRoomId(), workoutId: draft.id, context
  } }
  if (!isWorkoutWorkspace(next)) throw new Error('No se pudo preparar la sala con este entrenamiento.')
  return next
}

export function bindHostPeer(workspace: WorkoutWorkspace, peerDeviceId: string, people?: {
  ownerProfileId: ProfileId; peerOwnerId: ProfileId; ownerProfile: SharedRoomProfile; peerProfile: SharedRoomProfile
}): WorkoutWorkspace {
  const room = workspace.room
  if (!room || room.role !== 'host' || !isRoomIdentifier(peerDeviceId) || peerDeviceId === workspace.deviceId) throw new Error('El teléfono no es válido.')
  if (room.peerDeviceId && room.peerDeviceId !== peerDeviceId) throw new Error('La sala ya está vinculada a otro teléfono.')
  if (room.peerDeviceId && people && (room.peerOwnerId !== people.peerOwnerId || room.ownerProfileId !== people.ownerProfileId ||
    canonical(room.peerProfile || null) !== canonical(people.peerProfile) || canonical(room.ownerProfile || null) !== canonical(people.ownerProfile))) throw new Error('El perfil de la pareja cambió; crea una sala nueva.')
  return { ...workspace, room: { ...room, peerDeviceId, ...(people ? { ...people, peerReady: room.peerReady || false, peerApplied: room.peerApplied || false } : {}) } }
}

export function createRoomOffer(workspace: WorkoutWorkspace): RoomOffer {
  const room = workspace.room
  const draft = Object.values(workspace.drafts).find((item) => item.id === room?.workoutId)
  if (!room || room.role !== 'host' || !room.peerDeviceId || !draft || getDraftConflicts(draft).length || !draft.journal) {
    throw new Error('No se puede compartir la sesión actual. Revisa la sala y sus conflictos.')
  }
  const copy: WorkoutDraft = JSON.parse(JSON.stringify(draft))
  copy.journal!.pending = []
  copy.isWorkoutStarted = false
  copy.clock = { elapsedMs: 0, runningSince: null }
  copy.rest = { ...EMPTY_REST }
  copy.expandedSlotId = null
  const participants = room.ownerProfileId && room.peerOwnerId && room.ownerProfile && room.peerProfile
    ? { hostOwner: room.ownerProfileId, guestOwner: room.peerOwnerId, host: room.ownerProfile, guest: room.peerProfile } : undefined
  return { roomId: room.roomId, hostDeviceId: workspace.deviceId!, context: room.context, draft: copy, ...(participants ? { participants } : {}) }
}

export function validateRoomOffer(value: unknown): asserts value is RoomOffer {
  if (!isRecord(value) || !isRoomIdentifier(value.roomId) || !isRoomIdentifier(value.hostDeviceId) ||
    typeof value.context !== 'string' || !isRecord(value.draft) || typeof value.draft.sessionId !== 'string' ||
    !isWorkoutWorkspace({ version: 1, activeSessionId: value.draft.sessionId, drafts: { [value.draft.sessionId]: value.draft } }) ||
    !value.draft.journal || value.draft.receivedJournal ||
    Object.keys(value).some((key) => !['roomId', 'hostDeviceId', 'context', 'draft', 'participants'].includes(key)) ||
    Object.keys(value.draft).some((key) => !['id', 'sessionId', 'slotsState', 'activeProfileId', 'expandedSlotId', 'isWorkoutStarted', 'clock', 'rest', 'journal'].includes(key))) throw new Error('La sesión recibida no es válida.')
  parseRoomContext(value.context)
  if (value.participants !== undefined) {
    const participant = value.participants
    if (!isRecord(participant) || Object.keys(participant).sort().join(',') !== 'guest,guestOwner,host,hostOwner' ||
      !['user_1', 'user_2'].includes(String(participant.hostOwner)) || !['user_1', 'user_2'].includes(String(participant.guestOwner)) ||
      !isSharedRoomProfile(participant.host) || !isSharedRoomProfile(participant.guest) ||
      participant.host.name.trim().toLocaleLowerCase() === participant.guest.name.trim().toLocaleLowerCase()) throw new Error('Los participantes de la sala no son válidos.')
  }
}

export function adoptRoomOffer(workspace: WorkoutWorkspace, offer: RoomOffer, session: WorkoutSessionTemplate, profiles: Profiles,
  ownerProfileId?: ProfileId, hasCompanionData = false): WorkoutWorkspace {
  validateRoomOffer(offer)
  if (workspace.room) throw new Error('Sal de la sala actual antes de unirte a otra.')
  const current = workspace.drafts[workspace.activeSessionId]
  if (!current || workspace.activeSessionId !== session.id || offer.draft.sessionId !== session.id) {
    throw new Error('Las rutinas o los perfiles no coinciden. Seleccionen la misma rutina y revisen los perfiles, sin cambios automáticos.')
  }
  const localContext = buildRoomContext(session, profiles, current)
  const people = offer.participants
  const profilesSwapped = people ? people.hostOwner === people.guestOwner : contextsNeedProfileSwap(localContext, offer.context)
  if (people) {
    if (ownerProfileId !== people.guestOwner || canonical(sharedRoomProfile(profiles[ownerProfileId], session, current)) !== canonical(people.guest) ||
      !matchingRoomRoutine(localContext, offer.context, profilesSwapped)) throw new Error('El perfil propio o la rutina cambiaron; vuelve a revisar la sala.')
    applySharedRoomProfile(profiles[otherProfile(ownerProfileId)], people.host, session, hasCompanionData)
  } else if (roomDifference(localContext, offer.context)) throw new Error('Las rutinas o los perfiles no coinciden. Seleccionen la misma rutina y revisen los perfiles, sin cambios automáticos.')
  const localOffer = profilesSwapped ? swapDraftProfiles(offer.draft) : offer.draft
  const offerContext = buildRoomContext(session, profiles, localOffer)
  if (people ? !matchingRoomRoutine(offerContext, offer.context, profilesSwapped) :
    !roomContextsEqual(profilesSwapped ? swapRoomContext(offerContext) : offerContext, offer.context)) throw new Error('La sesión ofrecida no coincide con sus perfiles.')
  if (current.isWorkoutStarted || current.clock.elapsedMs > 0 || current.clock.runningSince !== null ||
    getDraftJournal(current)?.operations.length || getDraftConflicts(current).length || Object.values(current.slotsState).some(hasRecordedSlot)) {
    throw new Error('Este teléfono tiene un entrenamiento en curso o cambios locales. No los sobrescribimos; utiliza una sesión nueva sin registros.')
  }
  if (offer.hostDeviceId === workspace.deviceId || offer.draft.journal!.operations.some((operation) =>
    operation.deviceId !== offer.hostDeviceId && operation.deviceId !== workspace.deviceId)) throw new Error('La sesión contiene dispositivos no vinculados.')
  if (Object.values(workspace.drafts).some((draft) => draft !== current && draft.id === offer.draft.id) ||
    workspace.archivedJournals?.some((journal) => journal.workoutId === offer.draft.id)) throw new Error('Esta sesión ya existe en los datos locales. No la sobrescribimos ni duplicamos.')
  const draft: WorkoutDraft = JSON.parse(JSON.stringify(localOffer))
  draft.journal!.pending = []
  draft.activeProfileId = current.activeProfileId
  draft.isWorkoutStarted = false
  draft.clock = { elapsedMs: 0, runningSince: null }
  draft.rest = { ...EMPTY_REST }
  const next: WorkoutWorkspace = { ...workspace, journalError: undefined,
    drafts: { ...workspace.drafts, [session.id]: draft }, room: {
      version: 1, role: 'guest', roomId: offer.roomId, workoutId: draft.id, context: offer.context, peerDeviceId: offer.hostDeviceId, profilesSwapped,
      ...(people ? { ownerProfileId: people.guestOwner, peerOwnerId: people.hostOwner, ownerProfile: people.guest, peerProfile: people.host, peerReady: true, peerApplied: false } : {})
    } }
  if (!isWorkoutWorkspace(next)) throw new Error('No se pudo preparar la sesión recibida.')
  return next
}
