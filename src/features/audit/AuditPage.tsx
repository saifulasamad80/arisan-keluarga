import { useMemo, useState } from 'react'
import { ClipboardList, RefreshCw, ShieldCheck } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { formatAuditDetails, formatAuditTime, getAuditActionLabel, type AuditLogEntry } from './auditRepository'

interface AuditPageProps {
  entries: AuditLogEntry[]
  isLoading: boolean
  error: string | null
  onRetry: () => void
}

export function AuditPage({ entries, isLoading, error, onRetry }: AuditPageProps) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return entries
    return entries.filter((entry) => {
      const haystack = [
        getAuditActionLabel(entry.action),
        entry.action,
        entry.actor_name,
        formatAuditDetails(entry.details),
        entry.success ? 'berhasil' : 'gagal',
      ].join(' ').toLowerCase()
      return haystack.includes(needle)
    })
  }, [entries, query])

  return (
    <section className="space-y-5" aria-labelledby="audit-title">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Admin master</p>
        <h1 id="audit-title" className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Log audit</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
          Jejak mutasi kas, iuran, dan roster. Hanya akun master yang dapat membuka halaman ini. Waktu ditampilkan zona Asia/Jakarta.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari aksi, nama, atau keterangan..."
          aria-label="Cari log audit"
          className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
        />
        <Button className="shrink-0" variant="outline" onClick={onRetry}><RefreshCw size={15} /> Muat ulang</Button>
      </div>
      {error && (
        <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
          <p>{error}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={onRetry}><RefreshCw size={14} /> Coba lagi</Button>
        </div>
      )}
      {isLoading ? (
        <p className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
          <span className="size-4 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
          Memuat log audit...
        </p>
      ) : filtered.length ? (
        <div className="space-y-3">
          {filtered.map((entry) => (
            <article key={entry.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-slate-900">{getAuditActionLabel(entry.action)}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{entry.actor_name} · {formatAuditTime(entry.occurred_at)}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${entry.success ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  {entry.success ? 'Berhasil' : 'Gagal'}
                </span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-600">{formatAuditDetails(entry.details)}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 px-5 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
            {query ? <ClipboardList size={24} /> : <ShieldCheck size={24} />}
          </span>
          <h2 className="mt-4 font-bold text-slate-900">{query ? 'Tidak ada log yang cocok' : 'Belum ada jejak audit'}</h2>
          <p className="mt-2 max-w-sm text-sm text-slate-500">
            {query ? 'Coba kata lain.' : 'Mutasi Set Lunas, Batal Lunas, kas, dan roster akan tercatat di sini.'}
          </p>
        </div>
      )}
    </section>
  )
}
