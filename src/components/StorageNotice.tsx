import { useState, useSyncExternalStore } from 'react'
import { exportLocalData, getStorageIssues, retryStorageWrites, subscribeStorage } from '../services/storageService'

export function BackupButton() {
  const [error, setError] = useState('')
  const download = () => {
    try {
      const blob = new Blob([exportLocalData()], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `kineo-copia-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setError('')
    } catch {
      setError('No se pudo descargar la copia. Conserva esta pantalla abierta y vuelve a intentarlo.')
    }
  }
  return <div>
    <button type="button" onClick={download} className="min-h-11 px-3 rounded-md border border-[#A09BA8] text-sm text-white">
      Descargar copia de seguridad
    </button>
    <p role="status" className="text-xs text-[#A09BA8] mt-1">{error || 'La copia contiene tus perfiles y registros. Guárdala en un lugar privado.'}</p>
  </div>
}

export function StorageNotice() {
  const issues = useSyncExternalStore(subscribeStorage, getStorageIssues, getStorageIssues)
  const invalid = issues.some((issue) => issue.kind === 'invalid')
  const unreadable = issues.some((issue) => issue.kind === 'read')
  if (!issues.length) return null
  return <section role="alert" className="mx-3 my-3 p-4 rounded-md border border-amber-400 bg-[#14111A] text-white space-y-3" data-od-id="storage-error">
    <p className="text-sm font-semibold">{invalid ? 'Hay datos guardados que no podemos leer con seguridad.' : unreadable ? 'No podemos acceder al almacenamiento de este móvil.' : 'No se han podido guardar todos los cambios en este móvil.'}</p>
    <p className="text-sm">{invalid
      ? 'No sobrescribiremos los datos originales. Descarga una copia para recuperarlos antes de continuar.'
      : unreadable ? 'No sustituiremos datos que no hemos podido leer. Exporta los cambios de esta visita antes de recargar cuando recuperes el acceso. La copia no puede incluir datos originales que sigan inaccesibles.'
      : 'Los cambios siguen en esta visita, pero podrías perderlos al cerrar. Reintenta el guardado o descarga una copia.'}</p>
    <div className="flex flex-wrap gap-3 items-start">
      {!invalid && !unreadable && <button type="button" onClick={retryStorageWrites} className="min-h-11 px-3 rounded-md border border-[#A09BA8] text-sm">Reintentar guardado</button>}
      <BackupButton />
    </div>
  </section>
}
