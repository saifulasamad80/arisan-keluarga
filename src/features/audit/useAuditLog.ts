import { useCallback, useEffect, useState } from 'react'
import { getAuditErrorMessage, listMasterAuditLog, type AuditLogEntry } from './auditRepository'

interface AuditLogState {
  entries: AuditLogEntry[]
  isLoading: boolean
  error: string | null
  reload: () => Promise<void>
}

export function useAuditLog(enabled: boolean): AuditLogState {
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [isLoading, setIsLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!enabled) {
      setEntries([])
      setIsLoading(false)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      setEntries(await listMasterAuditLog())
    } catch (loadError) {
      setError(getAuditErrorMessage(loadError))
      setEntries([])
    } finally {
      setIsLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void reload()
  }, [reload])

  return { entries, isLoading, error, reload }
}
