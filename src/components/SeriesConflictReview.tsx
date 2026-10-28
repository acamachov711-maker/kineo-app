import { useId, useState } from 'react'
import type { UserProfile, WeightUnit } from '../types'
import type { ProfileId, ProjectedSeries, SeriesTarget, SeriesValue } from '../services/seriesSync'
import { canonical, targetKey } from '../services/seriesSync'

const FIELD_LABELS: Record<keyof SeriesValue, string> = {
  setNumber: 'Número de serie', targetReps: 'Repeticiones objetivo', weightKg: 'Peso', actualReps: 'Repeticiones realizadas',
  rir: 'Repeticiones en reserva (RIR)', isFailure: 'Trabajo al fallo', completed: 'Estado de la serie',
  compensatedDirection: 'Ajuste de carga', drops: 'Bajadas de peso', deleted: 'Conservar o eliminar la serie'
}

function describeValue(field: keyof SeriesValue, value: unknown, unit: WeightUnit): string {
  const number = (amount: number) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(amount)
  const weight = (amount: number) => `${number(unit === 'lb' ? amount * 2.2046226218 : amount)} ${unit}`
  if (field === 'weightKg') return weight(value as number)
  if (field === 'completed') return value ? 'Completada' : 'Pendiente'
  if (field === 'deleted') return value ? 'Eliminar serie' : 'Conservar serie'
  if (field === 'isFailure') return value ? 'Al fallo' : 'Sin marcar al fallo'
  if (field === 'compensatedDirection') return value === 'up' ? 'Subir carga' : value === 'down' ? 'Bajar carga' : 'Sin ajuste'
  if (field === 'drops') return (value as SeriesValue['drops']).map((drop, index) =>
    `Bajada ${index + 1}: ${weight(drop.weightKg)}, ${drop.reps} repeticiones, ${drop.completed ? 'completada' : 'pendiente'}`
  ).join('; ') || 'Sin bajadas de peso'
  return typeof value === 'number' ? number(value) : String(value || 'Sin objetivo')
}

interface ReviewProps {
  conflicts: ProjectedSeries[]
  profiles: Record<ProfileId, UserProfile>
  slotNames: Record<string, string>
  activeProfileId: ProfileId
  deviceId: string
  weightUnit: WeightUnit
  onSelectProfile: (profileId: ProfileId) => void
  onResolve: (target: SeriesTarget, heads: string[], choices: Partial<SeriesValue>) => string | null
}

function ConflictCard({ entry, index, ...props }: Omit<ReviewProps, 'conflicts'> & { entry: ProjectedSeries; index: number }) {
  const radioPrefix = useId()
  const [choices, setChoices] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const owner = props.profiles[entry.target.profileId]
  const isOwnerSelected = props.activeProfileId === entry.target.profileId
  const ready = entry.conflicts.every((conflict) => conflict.versions.some((version) => version.operationId === choices[conflict.field]))
  const confirm = () => {
    if (!ready || !isOwnerSelected) return
    const selected = Object.fromEntries(entry.conflicts.map((conflict) => [conflict.field,
      conflict.versions.find((version) => version.operationId === choices[conflict.field])!.value]))
    setError(props.onResolve(entry.target, entry.heads, selected) || '')
  }
  const single = entry.conflicts.length === 1 ? entry.conflicts[0] : null
  const useVersion = (field: keyof SeriesValue, value: unknown) => {
    if (!isOwnerSelected) return
    setError(props.onResolve(entry.target, entry.heads, { [field]: value }) || '')
  }
  return <article data-od-id={`conflict-card-${index}`} className="rounded-xl border border-[#2A2533] bg-[#14111A] p-4 min-w-0">
    <h3 className="text-base font-bold break-words">{owner.name} · {props.slotNames[`${entry.target.slotId}-${entry.target.profileId}`] || 'Ejercicio'} · Serie {entry.value.setNumber}</h3>
    <p className="text-sm text-[#A09BA8] mt-1">{single ? `Hay dos o más valores para ${FIELD_LABELS[single.field].toLocaleLowerCase()}. Elige el correcto.` : 'Hay varios datos diferentes. Elige el valor correcto de cada uno.'}</p>
    {single ? <div className="grid sm:grid-cols-2 gap-2 mt-3">
      {single.versions.map((version, versionIndex) => <button type="button" key={version.operationId}
        data-od-id={`conflict-choose-value-${index}-${versionIndex}`} disabled={!isOwnerSelected}
        onClick={() => useVersion(single.field, version.value)}
        className="min-h-[48px] p-3 rounded-lg border theme-border theme-soft-bg text-left disabled:opacity-50 break-words">
        <strong className="block text-sm">Usar {describeValue(single.field, version.value, props.weightUnit)}</strong>
        <span className="block text-xs text-[#A09BA8] mt-1">{version.deviceId === props.deviceId ? 'Este teléfono' : 'Otro teléfono'} · {props.profiles[version.actorProfileId].name}</span>
      </button>)}
    </div> : entry.conflicts.map((conflict) => <fieldset key={conflict.field} className="mt-4 min-w-0" disabled={!isOwnerSelected}>
      <legend className="text-sm font-semibold">{FIELD_LABELS[conflict.field]}</legend>
      <div className="grid sm:grid-cols-2 gap-2 mt-2">
        {conflict.versions.map((version, versionIndex) => <label key={version.operationId}
          data-od-id={`conflict-choice-${index}-${conflict.field}-${versionIndex}`}
          className={`flex gap-3 items-start min-h-[44px] p-3 rounded-lg border break-words ${choices[conflict.field] === version.operationId ? 'theme-border theme-soft-bg' : 'border-[#2A2533] bg-[#0B090E]'} ${isOwnerSelected ? 'cursor-pointer' : 'opacity-60'}`}>
          <input type="radio" className="mt-1 shrink-0" name={`${radioPrefix}-${conflict.field}`} value={version.operationId}
            checked={choices[conflict.field] === version.operationId}
            onChange={() => { setChoices((previous) => ({ ...previous, [conflict.field]: version.operationId })); setError('') }} />
          <span className="min-w-0"><strong className="block text-sm font-mono">{describeValue(conflict.field, version.value, props.weightUnit)}</strong>
            <span className="block text-xs text-[#A09BA8] mt-1">Registrado por {props.profiles[version.actorProfileId].name} · {version.deviceId === props.deviceId ? 'Este teléfono' : 'Otro teléfono'}</span>
          </span>
        </label>)}
      </div>
    </fieldset>)}
    {!isOwnerSelected ? <button type="button" data-od-id={`conflict-owner-${index}`} onClick={() => props.onSelectProfile(entry.target.profileId)}
      className="min-h-[44px] mt-4 px-4 py-2 rounded-lg border border-[#2A2533] hover:bg-[#2A2533] text-sm">Cambiar al perfil de {owner.name} para revisar</button>
      : !single && <button type="button" data-od-id={`conflict-confirm-${index}`} disabled={!ready} onClick={confirm}
        className="min-h-[44px] mt-4 px-4 py-2 rounded-lg theme-bg text-white shadow-md disabled:opacity-40 disabled:shadow-none text-sm font-semibold">Confirmar datos de mi serie</button>}
    {error && <p role="alert" className="text-sm text-amber-200 mt-3">{error}</p>}
  </article>
}

export function SeriesConflictReview({ conflicts, ...props }: ReviewProps) {
  if (!conflicts.length) return null
  return <section data-od-id="series-conflict-review" aria-labelledby="series-conflict-heading" className="mb-4 space-y-3">
    <div className="rounded-xl border border-amber-400/50 bg-[#14111A] p-4">
      <h2 id="series-conflict-heading" className="text-lg font-bold">{conflicts.length === 1 ? 'Una serie necesita revisión' : `${conflicts.length} series necesitan revisión`}</h2>
      <p className="text-sm text-[#A09BA8] mt-2">Solo estas series quedan fuera del progreso y volumen mientras se revisan. Puedes continuar con las demás; el guardado definitivo en el historial espera su resolución.</p>
      <p className="text-xs text-[#A09BA8] mt-2">Confirma con el perfil propietario seleccionado. En un móvil compartido, esa selección no verifica la identidad de quien lo utiliza.</p>
    </div>
    {conflicts.map((entry, index) => <ConflictCard key={`${targetKey(entry.target)}-${canonical(entry.heads)}`} {...props} entry={entry} index={index} />)}
  </section>
}
