import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { UserProfile, WorkoutHistoryEntry, WorkoutSessionTemplate } from '../types'
import type { WorkoutWorkspace } from '../utils/workoutState'
import { adoptRoomOffer, bindHostPeer, buildRoomContext, createHostRoom, createRoomOffer, createBoundRoomStore, currentBoundRoomContext, independentRoomContext, mapRoomStoreProfiles, roomContextsEqual, sharedRoomProfile } from '../services/roomSession'
import type { RoomOffer } from '../services/roomSession'
import type { SharedRoomProfile } from '../services/sharedRoomProfile'
import { canonical } from '../services/seriesSync'
import type { createRoomPairing, PairingState } from '../services/roomPairing'
import type { createMqttRoomTransport, MqttRoomState, RoomJournalStore } from '../services/mqttRoomTransport'
import { parseRoomCode, readRoomLink } from '../services/roomLinks'
import { mapRoomHistory } from '../services/roomHistory'
import { mergeRoomHistory } from '../services/roomHistory'
import { closureDraft, readyRevision, receiveClosure, requestRoomClosure, confirmRoomClosure, refreshRoomClosureIfNeeded, sharedClosureHistory, wireClosure } from '../services/roomClosure'
import { archiveJournal, getDraftConflicts, getDraftJournal, prepareDraft } from '../utils/workoutJournal'
import { createWorkoutDraft } from '../utils/workoutState'

interface PublicRoomInputs {
  workspace: WorkoutWorkspace
  sessions: WorkoutSessionTemplate[]
  profiles: Record<'user_1' | 'user_2', UserProfile>
  readWorkspace: () => WorkoutWorkspace
  commitWorkspace: (next: WorkoutWorkspace, previous: WorkoutWorkspace) => boolean
  createRoomStore: (workoutId: string) => RoomJournalStore
  readyForInvitation: boolean
  ownerProfileId: 'user_1' | 'user_2'
  hasCompanionData: boolean
  previewPeer: (profile: SharedRoomProfile, session: WorkoutSessionTemplate) => void
  importPeer: (profile: SharedRoomProfile, session: WorkoutSessionTemplate) => boolean
  history: WorkoutHistoryEntry[]
  readHistory: () => WorkoutHistoryEntry[]
  persistHistory: (history: WorkoutHistoryEntry[]) => boolean
  markCompleted: (date: string, sessionCode: string) => boolean
}

export function usePublicRoom(inputs: PublicRoomInputs) {
  const latest = useRef(inputs)
  latest.current = inputs
  const [enabled, setEnabled] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [pendingCode, setPendingCode] = useState<string | null>(null)
  const [offer, setOffer] = useState<RoomOffer | null>(null)
  const [error, setError] = useState('')
  const [pairing, setPairing] = useState<PairingState>({ phase: 'idle', message: '' })
  const [transport, setTransport] = useState<MqttRoomState | null>(null)
  const [closureReadiness, setClosureReadiness] = useState<'offline' | 'syncing' | 'conflict' | 'ready' | 'waiting'>('offline')
  const [invitation, setInvitation] = useState(() => typeof window === 'undefined' ? null : readRoomLink(window.location.hash))
  const running = useRef<{ stop: () => void; notify: () => void; notifyHistory: () => void; notifyClosure: () => void } | null>(null)
  const room = inputs.workspace.room
  const selectionContext = (() => {
    try {
      const session = inputs.sessions.find((item) => item.id === inputs.workspace.activeSessionId)
      if (!session) return ''
      return independentRoomContext(buildRoomContext(session, inputs.profiles, inputs.workspace.drafts[session.id]))
    } catch { return '' }
  })()
  const currentRoomContext = (workspace: WorkoutWorkspace) => currentBoundRoomContext(workspace, latest.current.sessions, latest.current.profiles)
  const roomKey = room ? JSON.stringify([room.roomId, room.workoutId, room.peerDeviceId, room.context, room.profilesSwapped]) : ''
  const joiningContext = room ? '' : selectionContext
  const change = (action: (workspace: WorkoutWorkspace) => WorkoutWorkspace) => {
    const previous = latest.current.readWorkspace()
    const next = action(previous)
    if (!latest.current.commitWorkspace(next, previous)) throw new Error('No se pudo guardar la sala. Libera espacio o descarga una copia y reintenta; no hemos aplicado el cambio.')
  }

  useEffect(() => {
    const update = () => setInvitation(readRoomLink(window.location.hash))
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])

  useEffect(() => {
    if (!invitation || !inputs.readyForInvitation || !selectionContext || room) return
    setError('')
    setOffer(null)
    setPendingCode(invitation)
    setEnabled(true)
    setAttempt((value) => value + 1)
    setInvitation(null)
    if (typeof window !== 'undefined') window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
  }, [invitation, inputs.readyForInvitation, selectionContext, room])

  useLayoutEffect(() => {
    if (!room) return
    try {
      if (room.peerReady && room.peerProfile && room.ownerProfileId) {
        const draft = Object.values(inputs.workspace.drafts).find((item) => item.id === room.workoutId)
        const session = inputs.sessions.find((item) => item.id === draft?.sessionId)
        if (!session) throw new Error('No se encuentra la rutina compartida.')
        const peerId = room.ownerProfileId === 'user_1' ? 'user_2' : 'user_1'
        const current = sharedRoomProfile(inputs.profiles[peerId], session, draft!)
        if (!room.peerApplied) {
          if (canonical(current) !== canonical(room.peerProfile) && !inputs.importPeer(room.peerProfile, session)) throw new Error('No se pudo guardar el perfil de tu pareja. Los datos anteriores se conservan; revisa el almacenamiento.')
          change((previous) => ({ ...previous, room: previous.room ? { ...previous.room, peerApplied: true } : undefined }))
          return
        }
      }
      if (!enabled) return
      const context = currentRoomContext(inputs.workspace)
      if (context && roomContextsEqual(context, room.context)) return
    } catch (failure) {
      running.current?.stop(); setEnabled(false); setOffer(null)
      setError(failure instanceof Error ? failure.message : 'No se pudo aplicar el perfil compartido.')
      return
    }
    running.current?.stop()
    setEnabled(false)
    setOffer(null)
    setError('La rutina o los perfiles de la sala cambiaron. Se ha detenido el intercambio. Restablece la configuración para reconectar o sal de la sala antes de elegir otra rutina.')
  }, [inputs.workspace, inputs.sessions, inputs.profiles, enabled, roomKey])

  useEffect(() => {
    const closure = inputs.workspace.room?.closure
    if (!closure || closure.phase !== 'requested') return
    if (!enabled || transport?.connection !== 'connected' || !transport.peerSeen) { setClosureReadiness('offline'); return }
    const previous = latest.current.readWorkspace()
    let cancelled = false
    try {
      const draft = closureDraft(previous)
      if (getDraftConflicts(draft).length) { setClosureReadiness('conflict'); return }
      if (getDraftJournal(draft)?.pending.length) { setClosureReadiness('syncing'); return }
      setClosureReadiness('syncing')
      void (async () => {
        const revision = await readyRevision(previous)
        if (cancelled || latest.current.readWorkspace() !== previous) return
        if (revision === closure.revision) { setClosureReadiness('ready'); return }
        if (closure.initiator !== previous.deviceId) { setClosureReadiness('waiting'); return }
        const next = await refreshRoomClosureIfNeeded(previous)
        if (cancelled || latest.current.readWorkspace() !== previous) return
        if (next !== previous && !latest.current.commitWorkspace(next, previous)) throw new Error('No se pudo guardar la revisión actualizada. Los registros se conservan; pulsa Reconectar para reintentar.')
      })().catch((failure) => { if (!cancelled) setError(failure instanceof Error ? failure.message : 'No se pudo actualizar el cierre.') })
    } catch { setClosureReadiness('waiting') }
    return () => { cancelled = true }
  }, [inputs.workspace, enabled, transport?.connection, transport?.peerSeen])

  useEffect(() => {
    const closure = inputs.workspace.room?.closure
    if (!closure || closure.phase !== 'committed' || closure.applied) return
    let cancelled = false
    const apply = async () => {
      const previous = latest.current.readWorkspace()
      if (await readyRevision(previous) !== closure.revision) throw new Error('El entrenamiento cambió después de la confirmación. Conservamos el cierre para revisión.')
      if (cancelled || latest.current.readWorkspace() !== previous) throw new Error('El entrenamiento cambió. Reconecta para revisar el cierre.')
      const draft = closureDraft(previous)
      const session = latest.current.sessions.find((item) => item.id === draft.sessionId)
      if (!session) throw new Error('No se encuentra la rutina del cierre.')
      const entries = sharedClosureHistory(closure, draft, session, latest.current.profiles, !!previous.room?.profilesSwapped)
      const currentHistory = latest.current.readHistory()
      const merged = mergeRoomHistory(currentHistory, entries)
      if (canonical(merged) !== canonical(currentHistory) && !latest.current.persistHistory(merged)) throw new Error('No se pudo guardar el cierre en el historial. Reconecta para reintentar.')
      if (!latest.current.markCompleted(closure.date, session.code)) throw new Error('No se pudo guardar la fecha del cierre. Reconecta para reintentar.')
      if (latest.current.readWorkspace() !== previous || !latest.current.commitWorkspace({ ...previous, room: { ...previous.room!, closure: { ...closure, applied: true } } }, previous)) throw new Error('No se pudo guardar el estado del cierre. Reconecta para reintentar.')
      setError('')
    }
    void apply().catch((failure) => { if (!cancelled) setError(failure instanceof Error ? failure.message : 'No se pudo guardar el cierre.') })
    return () => { cancelled = true }
  }, [inputs.workspace, inputs.history, inputs.profiles, inputs.sessions, attempt])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let pairingClient: ReturnType<typeof createRoomPairing> | null = null
    let sync: Awaited<ReturnType<typeof createMqttRoomTransport>> | null = null
    const stop = () => { cancelled = true; pairingClient?.leave(); sync?.leave() }
    running.current = { stop, notify: () => { if (!cancelled) sync?.notifyLocalChanges() }, notifyHistory: () => { if (!cancelled) sync?.notifyHistoryChanges() }, notifyClosure: () => { if (!cancelled) sync?.notifyClosureChanges() } }
    setTransport(null)
    const initial = latest.current.readWorkspace()
    const binding = initial.room
    const start = async () => {
      const { createRoomPairing } = await import('../services/roomPairing')
      const { createMqttRoomTransport, PUBLIC_MQTT_BROKER_URL } = await import('../services/mqttRoomTransport')
      if (cancelled) return
      if (binding) {
        const context = currentRoomContext(initial)
        if (!context || !roomContextsEqual(context, binding.context)) throw new Error('La rutina o los perfiles ya no coinciden con esta sala. Revísalos antes de reconectar.')
        if (binding.role === 'host') {
          const draft = Object.values(initial.drafts).find((item) => item.id === binding.workoutId)!
          const session = latest.current.sessions.find((item) => item.id === draft.sessionId)!
          const identity = { owner: latest.current.ownerProfileId, profile: sharedRoomProfile(latest.current.profiles[latest.current.ownerProfileId], session, draft) }
          pairingClient = createRoomPairing({ role: 'host', roomId: binding.roomId, deviceId: initial.deviceId!, context: binding.context, identity,
            onState: (state) => { if (!cancelled) setPairing(state) },
            makeOffer: (peerDeviceId, peerIdentity) => {
              if (cancelled) throw new Error('Esta sala ya no está conectada.')
              if (!peerIdentity) throw new Error('Falta el perfil de la pareja.')
              latest.current.previewPeer(peerIdentity.profile, session)
              const current = latest.current.readWorkspace()
              if (current.room?.roomId !== binding.roomId || !roomContextsEqual(currentRoomContext(current), binding.context)) throw new Error('La sala cambió. Revisa la rutina antes de vincular otro teléfono.')
              if (current.room.peerDeviceId !== peerDeviceId || !current.room.peerProfile) change((previous) => bindHostPeer(previous, peerDeviceId,
                { ownerProfileId: identity.owner, ownerProfile: identity.profile, peerOwnerId: peerIdentity.owner, peerProfile: peerIdentity.profile }))
              return createRoomOffer(latest.current.readWorkspace())
            }
          })
          pairingClient.connect()
        }
        if (binding.peerDeviceId) {
          const store = latest.current.createRoomStore(binding.workoutId)
          const guardedStore = mapRoomStoreProfiles(createBoundRoomStore(binding, latest.current.readWorkspace, currentRoomContext, store), !!binding.profilesSwapped)
          const historyStore = {
            read: () => mapRoomHistory(latest.current.readHistory().filter((entry) => entry.id !== `${binding.workoutId}-user_1` && entry.id !== `${binding.workoutId}-user_2`), !!binding.profilesSwapped),
            persist: (history: WorkoutHistoryEntry[]) => {
              const current = latest.current.readWorkspace().room
              if (!current || current.roomId !== binding.roomId || !current.peerApplied) return false
              if (history.some((entry) => entry.id === `${binding.workoutId}-user_1` || entry.id === `${binding.workoutId}-user_2`)) return false
              const protectedEntries = latest.current.readHistory().filter((entry) => entry.id === `${binding.workoutId}-user_1` || entry.id === `${binding.workoutId}-user_2`)
              return latest.current.persistHistory(mergeRoomHistory(mapRoomHistory(history, !!binding.profilesSwapped), protectedEntries))
            }
          }
          const closureStore = {
            read: () => {
              const value = latest.current.readWorkspace().room?.closure
              if (!value) return null
              if (value.phase === 'requested' && value.initiator !== initial.deviceId) return null
              const wire = wireClosure(value)
              // El receptor vuelve a confirmar su revisión si se perdió el mensaje final.
              return value.phase === 'committed' && value.initiator !== initial.deviceId ? { ...wire, phase: 'confirmed' as const } : wire
            },
            receive: async (value: unknown) => {
              const previous = latest.current.readWorkspace()
              const next = await receiveClosure(previous, value)
              if (cancelled || latest.current.readWorkspace() !== previous) throw new Error('La sesión cambió. Reconecta para revisar el cierre.')
              if (next !== previous && !latest.current.commitWorkspace(next, previous)) throw new Error('No se pudo guardar el cierre recibido.')
            },
            delivered: (value: ReturnType<typeof wireClosure>) => {
              if (value.phase !== 'committed' || value.initiator !== initial.deviceId) return true
              const previous = latest.current.readWorkspace(), current = previous.room?.closure
              if (!current || current.id !== value.id || current.round !== value.round || current.phase !== 'committed') return false
              if (current.delivered) return true
              return latest.current.commitWorkspace({ ...previous, room: { ...previous.room!, closure: { ...current, delivered: true } } }, previous)
            }
          }
          sync = await createMqttRoomTransport({ access: 'public', brokerUrl: PUBLIC_MQTT_BROKER_URL,
            roomId: binding.roomId, workoutId: binding.workoutId, deviceId: initial.deviceId!, peerDeviceId: binding.peerDeviceId
          }, guardedStore, JSON.parse(binding.context), (state) => {
            if (cancelled) return
            if (binding.role === 'host' && state.peerSeen && binding.peerProfile && !latest.current.readWorkspace().room?.peerReady) {
              try {
                const current = latest.current.readWorkspace()
                const draft = Object.values(current.drafts).find((item) => item.id === binding.workoutId)
                const session = latest.current.sessions.find((item) => item.id === draft?.sessionId)
                if (!session || !latest.current.importPeer(binding.peerProfile, session)) throw new Error('No se pudo guardar el perfil de tu pareja. Los registros no se han aplicado.')
                change((previous) => ({ ...previous, room: previous.room ? { ...previous.room, peerReady: true, peerApplied: true } : undefined }))
              }
              catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo guardar la incorporación.'); stop(); return }
            }
            setTransport(state)
          }, undefined, undefined, historyStore, closureStore)
          if (cancelled) { sync.leave(); return }
          sync.connect()
          sync.notifyLocalChanges()
        }
      } else if (pendingCode && joiningContext) {
        setOffer(null)
        const session = latest.current.sessions.find((item) => item.id === initial.activeSessionId)!
        const identity = { owner: latest.current.ownerProfileId, profile: sharedRoomProfile(latest.current.profiles[latest.current.ownerProfileId], session, initial.drafts[session.id]) }
        pairingClient = createRoomPairing({ role: 'guest', roomId: pendingCode, deviceId: initial.deviceId!, context: joiningContext,
          identity,
          onState: (state) => { if (!cancelled) setPairing(state) }, onOffer: (received) => { if (!cancelled) setOffer(received) } })
        pairingClient.connect()
      }
    }
    start().catch((failure) => {
      if (!cancelled) { setError(failure instanceof Error ? failure.message : 'No se pudo abrir la sala.'); stop() }
    })
    return () => { stop(); running.current = null }
  }, [enabled, roomKey, pendingCode, joiningContext, attempt])

  useEffect(() => { if (enabled) running.current?.notify() }, [inputs.workspace, enabled])
  useEffect(() => { if (enabled) running.current?.notifyHistory() }, [inputs.history, enabled])
  useEffect(() => { if (enabled) running.current?.notifyClosure() }, [inputs.workspace.room?.closure, enabled])

  const act = (action: () => void) => {
    setError('')
    try { action() } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo cambiar la sala.') }
  }
  return {
    room, enabled, pendingCode, invitation, offer, pairing, transport, error, closureReadiness,
    create: () => act(() => {
      if (!selectionContext) throw new Error('Selecciona una rutina válida antes de crear la sala.')
      change((previous) => createHostRoom(previous, selectionContext))
      setOffer(null); setPendingCode(null); setEnabled(true); setAttempt((value) => value + 1)
    }),
    requestJoin: (code: string) => act(() => {
      const clean = parseRoomCode(code)
      if (!clean) throw new Error('Introduce los 8 caracteres que muestra el teléfono de tu pareja.')
      if (latest.current.readWorkspace().room) throw new Error('Sal de la sala actual antes de unirte a otra.')
      if (!selectionContext) throw new Error('Selecciona una rutina válida antes de unirte.')
      setOffer(null); setPendingCode(clean); setEnabled(true); setAttempt((value) => value + 1)
    }),
    accept: () => act(() => {
      if (!offer || offer.roomId !== pendingCode || pairing.phase !== 'review') throw new Error('Solicita y revisa de nuevo la sesión antes de unirte.')
      const current = latest.current.readWorkspace()
      const session = latest.current.sessions.find((item) => item.id === current.activeSessionId)
      if (!session) throw new Error('La rutina seleccionada no está disponible.')
      if (offer.participants) latest.current.previewPeer(offer.participants.host, session)
      change((previous) => adoptRoomOffer(previous, offer, session, latest.current.profiles, latest.current.ownerProfileId, latest.current.hasCompanionData))
      setOffer(null); setPendingCode(null); setEnabled(true); setAttempt((value) => value + 1)
    }),
    reconnect: () => act(() => { setOffer(null); setEnabled(true); setAttempt((value) => value + 1) }),
    requestClosure: async (date: string, durationMinutes: number) => {
      setError('')
      try {
        const previous = latest.current.readWorkspace()
        const next = await requestRoomClosure(previous, date, durationMinutes)
        if (latest.current.readWorkspace() !== previous) throw new Error('El entrenamiento cambió. Revisa las series y vuelve a solicitar el cierre.')
        if (!latest.current.commitWorkspace(next, previous)) throw new Error('No se pudo guardar la solicitud de cierre. Los registros siguen abiertos.')
        return null
      } catch (failure) { const message = failure instanceof Error ? failure.message : 'No se pudo solicitar el cierre.'; setError(message); return message }
    },
    confirmClosure: async () => {
      setError('')
      try {
        const previous = latest.current.readWorkspace()
        const next = await confirmRoomClosure(previous)
        if (latest.current.readWorkspace() !== previous) throw new Error('Las series cambiaron. Revísalas de nuevo.')
        if (!latest.current.commitWorkspace(next, previous)) throw new Error('No se pudo guardar tu confirmación. Reintenta.')
      } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo confirmar el cierre.') }
    },
    leave: () => act(() => {
      const current = latest.current.readWorkspace()
      if (current.room?.closure && (current.room.closure.phase !== 'committed' || !current.room.closure.applied ||
        (current.room.closure.initiator === current.deviceId && !current.room.closure.delivered))) throw new Error('El cierre sigue pendiente de guardado o entrega. Reconecta y completa la confirmación antes de salir; tus registros se conservan.')
      running.current?.stop(); setEnabled(false); setOffer(null); setPendingCode(null); setTransport(null)
      if (current.room) change((previous) => {
        if (!previous.room?.closure?.applied) return { ...previous, room: undefined }
        const closed = closureDraft(previous)
        const ordered = ['session-a', 'session-b', 'session-c', 'session-d']
        const nextId = ordered[(Math.max(0, ordered.indexOf(closed.sessionId)) + 1) % ordered.length]
        const desired = previous.activeSessionId === closed.sessionId ? nextId : previous.activeSessionId
        const session = latest.current.sessions.find((item) => item.id === desired) || latest.current.sessions[0]
        const drafts = { ...previous.drafts }
        delete drafts[closed.sessionId]
        if (!drafts[session.id]) drafts[session.id] = prepareDraft(createWorkoutDraft(session.id, session.slots, latest.current.profiles, latest.current.ownerProfileId))
        return { ...previous, room: undefined, activeSessionId: session.id, drafts,
          archivedJournals: archiveJournal(previous.archivedJournals || [], closed) }
      })
      setPairing({ phase: 'idle', message: 'Has salido. Los registros y las revisiones pendientes se conservan en este teléfono.' })
    })
  }
}
