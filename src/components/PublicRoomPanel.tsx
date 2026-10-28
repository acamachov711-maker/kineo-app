import { useState } from 'react'
import type { UserProfile, WeightUnit, WorkoutSessionTemplate } from '../types'
import type { WorkoutWorkspace } from '../utils/workoutState'
import { getDraftLiveStats } from '../utils/workoutJournal'
import { displayWeightValue } from '../utils/fitnessMath'
import type { usePublicRoom } from '../hooks/usePublicRoom'
import { createRoomLink, formatRoomCode } from '../services/roomLinks'
import { swapDraftProfiles } from '../services/roomSession'

interface PublicRoomPanelProps {
  connection: ReturnType<typeof usePublicRoom>
  sessions: WorkoutSessionTemplate[]
  selectedSessionId: string
  selectSession: (id: string) => void
  profiles: Record<'user_1' | 'user_2', UserProfile>
  workspace?: WorkoutWorkspace
  weightUnit?: WeightUnit
  onReviewClosure?: () => void
}

export function PublicRoomPanel({ connection, sessions, selectedSessionId, selectSession, profiles, workspace, weightUnit = 'kg', onReviewClosure }: PublicRoomPanelProps) {
  const [code, setCode] = useState('')
  const [copied, setCopied] = useState('')
  const { room, enabled, offer, pendingCode, invitation, pairing, transport, error, closureReadiness } = connection
  const button = 'min-h-11 px-4 py-2 rounded-lg border theme-border theme-soft-bg theme-text text-sm font-semibold disabled:opacity-40'
  const session = sessions.find((item) => item.id === selectedSessionId)
  const sharedRoutine = (() => { try { return room ? JSON.parse(room.context).routine : null } catch { return null } })()
  const sharedDraft = room && workspace ? Object.values(workspace.drafts).find((draft) => draft.id === room.workoutId) : undefined
  const previewDraft = (() => {
    try {
      if (!offer || !session) return null
      if (offer.participants) return offer.participants.hostOwner === offer.participants.guestOwner ? swapDraftProfiles(offer.draft) : offer.draft
      const people = JSON.parse(offer.context).profiles
      const swapped = people[0].name === profiles.user_2.name.trim() && people[1].name === profiles.user_1.name.trim()
      return swapped ? swapDraftProfiles(offer.draft) : offer.draft
    } catch { return null }
  })()
  const previewProfiles = offer?.participants ? {
    [offer.participants.guestOwner]: offer.participants.guest,
    [offer.participants.guestOwner === 'user_1' ? 'user_2' : 'user_1']: offer.participants.host
  } : null
  const status = !enabled ? 'Sin conexión de sala' : transport?.connection === 'connected'
    ? transport.peerSeen ? 'Canal conectado · intercambio iniciado' : 'Canal conectado · esperando al otro teléfono'
    : transport ? `Conexión de registros: ${transport.connection === 'error' ? 'requiere reintento' : transport.connection === 'retrying' ? 'reintentando' : 'conectando'}`
    : pairing.message || 'Preparando sala…'
  const issueText = transport?.issue && ({
    connection_failed: 'Se perdió la conexión con la sala. Comprueba internet y pulsa Reconectar.',
    subscription_denied: 'El servidor de pruebas rechazó la conexión. Pulsa Reconectar para volver a intentarlo.',
    invalid_message: 'Llegó información que no coincide con esta sala. Reconecta para volver a intentarlo.',
    storage_failed: 'No se pudieron guardar los cambios recibidos. Revisa el almacenamiento y vuelve a intentarlo.',
    receipt_timeout: 'El otro teléfono aún no confirmó la recepción. Mantén ambos conectados y pulsa Reconectar.',
    send_failed: 'No se pudieron enviar los cambios. Comprueba la conexión y pulsa Reconectar.',
    invalid_journal: 'No se pudo preparar el intercambio de series. Los datos siguen guardados en este teléfono.'
  }[transport.issue])
  return <section data-od-id="public-room-panel" className="mb-4 rounded-lg border theme-border bg-black/20 p-4 text-sm space-y-3 min-w-0">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h2 data-od-id="public-room-heading" className="font-display text-xl text-white">Sala colaborativa</h2>
        <p className="text-xs text-amber-200 mt-1">Broker público de pruebas: sin privacidad ni contraseña validada. Utiliza datos ficticios.</p></div>
      <span className="text-xs text-white/70" role="status">{status}</span>
    </div>
    {invitation && <p role="status" className="text-white/80">{room
      ? 'Hay un enlace pendiente. Sal de la sala actual para revisar la nueva invitación.'
      : 'Para revisar el enlace, completa la configuración y activa el modo en pareja en Ajustes.'}</p>}
    {!room && <label className="block text-white/80">Rutina seleccionada en este teléfono
      <select data-od-id="room-routine-select" value={selectedSessionId} onChange={(event) => selectSession(event.target.value)}
        className="mt-1 w-full min-h-11 rounded-lg bg-black border theme-border px-3 text-white">
        {sessions.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.title}</option>)}
      </select>
    </label>}
    {!room && <p className="text-xs text-white/60">Cada persona configura su perfil. Al unirse se añade el nombre, color y ejercicios de su pareja y se intercambia el historial completo. Si las rutinas difieren, elíjanlas manualmente.</p>}
    {room ? <>
      <p className="text-white/80">Rutina de la sala: {sharedRoutine?.title || 'Revisa la configuración guardada'}.</p>
      {sharedRoutine && sharedRoutine.id !== selectedSessionId && <div className="text-amber-200 space-y-2">
        <p>Estás viendo otra rutina. Solo se comparten registros de la rutina vinculada.</p>
        <button type="button" data-od-id="room-return-to-session" className={button} onClick={() => selectSession(sharedRoutine.id)}>Volver a la rutina de la sala</button>
      </div>}
      <div data-od-id="room-short-code" className="rounded-lg border theme-border px-3 py-2">
        <p className="text-xs text-white/70">Código para compartir en persona</p>
        <p className="font-mono text-xl font-bold text-white tracking-wider break-all">{formatRoomCode(room.roomId)}</p>
      </div>
      <label className="block text-white/80">Enlace de esta sala
        <input data-od-id="room-code" readOnly value={typeof window === 'undefined' ? '' : createRoomLink(window.location.href, room.roomId)} className="mt-1 w-full min-h-11 rounded-lg bg-black border theme-border px-3 text-white font-mono text-xs" />
      </label>
      <div className="flex flex-wrap gap-2">
        <button data-od-id="room-share-link" type="button" className={button} onClick={async () => {
          const url = createRoomLink(window.location.href, room.roomId)
          if (navigator.share) {
            try { await navigator.share({ title: 'Entrena conmigo en KINEO', url }); setCopied('Enlace compartido.') }
            catch (error) { if (error instanceof Error && error.name !== 'AbortError') setCopied('No se pudo compartir. Puedes seleccionar el enlace y copiarlo.') }
          } else {
            try { await navigator.clipboard.writeText(url); setCopied('Enlace copiado. Compártelo con tu pareja.') }
            catch { setCopied('Selecciona el enlace y cópialo para compartirlo.') }
          }
        }}>Compartir enlace</button>
        <button data-od-id="room-reconnect" type="button" className={button} onClick={connection.reconnect}>Reconectar</button>
        <button data-od-id="room-leave" type="button" className={button} onClick={connection.leave}>Salir de la sala</button>
      </div>
      <p className="text-xs text-white/60">Para cambiar la rutina de la sala, sal primero y elige una manualmente. Salir detiene el intercambio local y conserva tus registros; no finaliza el entrenamiento de tu pareja.</p>
      {sharedDraft && room.peerApplied && <div data-od-id="room-shared-metrics" className="border theme-border rounded-lg p-3 space-y-2">
        <h3 className="font-semibold text-white">Progreso de esta sesión</h3>
        {(['user_1', 'user_2'] as const).map((profileId) => {
          const stats = getDraftLiveStats(sharedDraft, profileId)
          return <p key={profileId} className="text-white/80 break-words">{profiles[profileId].name}: {stats.completed} series completadas · {displayWeightValue(stats.volumeKg, weightUnit).toLocaleString('es-ES')} {weightUnit} de volumen</p>
        })}
        <p className="text-xs text-white/60">Las series en revisión no se cuentan hasta resolverlas.</p>
      </div>}
      {room.closure && sharedDraft && <div data-od-id="room-closure" className="border theme-border rounded-lg p-3 space-y-3">
        <h3 className="font-semibold text-white">{room.closure.phase === 'committed' ? 'Cierre confirmado' : 'Cierre pendiente de confirmación'}</h3>
        <p className="text-white/80">{room.closure.phase === 'committed'
          ? room.closure.applied ? room.closure.initiator === workspace?.deviceId && !room.closure.delivered ? 'Resultados guardados. Esperando que el otro teléfono reciba el cierre; mantén ambos conectados.' : 'Los resultados están guardados en este teléfono. Puedes salir de la sala.' : 'Guardando los resultados en este teléfono…'
          : room.closure.initiator === workspace?.deviceId ? 'Tu pareja debe revisar sus resultados y confirmar. La solicitud se conserva si se pierde la conexión.' : room.closure.phase === 'confirmed' ? 'Has confirmado tus resultados. Esperando la confirmación final del otro teléfono.' : 'Tu pareja terminó la sesión. Revisa los resultados y confirma el cierre.'}</p>
        {room.closure.phase !== 'committed' && onReviewClosure && <button type="button" data-od-id="room-review-exercises" className={button} onClick={onReviewClosure}>Revisar ejercicios y series</button>}
        {room.closure.phase === 'requested' && <p role="status" className="text-sm text-white/70">{closureReadiness === 'offline'
          ? 'Conectad ambos teléfonos para reunir los cambios.' : closureReadiness === 'conflict'
            ? 'Hay series con datos diferentes. Revísalas en esta pantalla para continuar.' : closureReadiness === 'syncing'
              ? 'Reuniendo los cambios de ambos teléfonos…' : closureReadiness === 'waiting'
                ? 'Esperando los últimos cambios del otro teléfono…' : 'Los resultados de este teléfono están listos para revisar.'}</p>}
      </div>}
    </> : <div className="flex flex-wrap items-end gap-2">
      <button data-od-id="room-create" type="button" className={button} onClick={connection.create}>Crear sala con esta rutina</button>
      <label className="flex-1 min-w-0 text-white/80">Código de tu pareja
        <input data-od-id="room-join-code" value={code} onChange={(event) => setCode(event.target.value)} maxLength={96} autoCapitalize="characters" autoCorrect="off" spellCheck={false}
          className="mt-1 w-full min-h-11 rounded-lg bg-black border theme-border px-3 text-white font-mono text-sm" placeholder="ABCD-2345" />
      </label>
      <button data-od-id="room-request-join" type="button" className={button} onClick={() => connection.requestJoin(code)}>Comprobar y revisar</button>
      {pendingCode && <button data-od-id="room-cancel-join" type="button" className={button} onClick={connection.leave}>Cancelar incorporación</button>}
    </div>}
    {!room && pairing.message && <p role={pairing.phase === 'mismatch' || pairing.phase === 'error' ? 'alert' : 'status'} className="text-white/80 break-words">{pairing.message}</p>}
    {room && pairing.phase === 'error' && <p role="alert" className="text-amber-200 break-words">{pairing.message}</p>}
    {!room && offer && pairing.phase === 'review' && <div data-od-id="room-session-preview" className="border theme-border rounded-lg p-3 space-y-3">
      <h3 className="font-display text-lg text-white">Revisar antes de unirse: {session?.title}</h3>
      <p className="text-white/80">{offer.participants ? `${offer.participants.guest.name} y ${offer.participants.host.name}. Se añadirá el nombre, color y ejercicios de tu pareja.` : `${profiles.user_1.name} y ${profiles.user_2.name}. No se importarán perfiles.`} Se usarán las series y cargas preparadas en el otro teléfono y se intercambiará el historial completo. No se importarán otras rutinas.</p>
      <details className="text-white/70"><summary className="min-h-11 cursor-pointer flex items-center">Ver las series y cargas que se aplicarán</summary>
        <ul className="space-y-3">{session?.slots.map((slot) => <li key={slot.slotId} className="break-words">
          <strong>Estación {slot.order}</strong>
          {(['user_1', 'user_2'] as const).map((profileId) => {
            const state = previewDraft?.slotsState[slot.slotId]
            const person = previewProfiles?.[profileId]
            const options = [slot.primaryExercise, ...slot.alternatives, ...(slot.femaleFocusedPrimary ? [slot.femaleFocusedPrimary] : []), ...(slot.femaleFocusedAlternatives || [])]
            const selected = options.find((variant) => variant.id === (person?.exercises[slot.slotId] || profiles[profileId].activeVariantBySlot[slot.slotId])) || options[0]
            return <p key={profileId}>
              {person?.name || profiles[profileId].name} · {selected.name}: {state?.setsByProfile[profileId].map((entry) =>
                `${entry.weightKg.toLocaleString('es-ES')} kg × ${entry.actualReps} ${entry.completed ? '(registrada)' : '(pendiente)'}`).join(' · ')}
            </p>
          })}
        </li>)}</ul>
      </details>
      <p className="text-xs text-white/60">Solo puedes unirte desde un entrenamiento sin registros ni cambios locales. No sobrescribiremos uno en curso.</p>
      <button data-od-id="room-confirm-join" type="button" className={button} onClick={connection.accept}>Unirme a esta sesión</button>
    </div>}
    {issueText && <p role="alert" className="text-amber-200">{issueText} Los cambios locales se conservan.</p>}
    {transport?.historyStatus === 'sending' && <p role="status" className="text-white/70">Enviando el historial; mantén ambos teléfonos conectados.</p>}
    {transport?.historyStatus === 'synced' && <p role="status" className="text-white/70">El otro teléfono confirmó el historial enviado.</p>}
    {transport?.historyIssue && <p role="alert" className="text-amber-200">{transport.historyIssue} Los registros locales se conservan.</p>}
    {transport?.historyIncomingIssue && <p role="alert" className="text-amber-200">{transport.historyIncomingIssue} Los registros locales se conservan.</p>}
    {transport?.closureIssue && <p role="alert" className="text-amber-200">{transport.closureIssue} Los registros locales se conservan.</p>}
    {copied && <p role="status" className="text-white/70">{copied}</p>}
    {error && <p role="alert" className="text-amber-200 break-words">{error}</p>}
  </section>
}
