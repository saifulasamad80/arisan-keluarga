import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Camera,
  ChevronRight,
  CircleDollarSign,
  Copy,
  ExternalLink,
  HandCoins,
  Heart,
  Images,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UsersRound,
  WalletCards,
} from 'lucide-react'
import { BottomNav, type AppTab } from './components/BottomNav'
import { Button } from './components/ui/button'
import { ConfirmDeleteDialog } from './components/ConfirmDeleteDialog'
import { RowActions } from './components/RowActions'
import { AuthScreen } from './features/auth/AuthScreen'
import { AdminRegisterForm } from './features/auth/AdminRegisterForm'
import { ExpenseForm } from './features/finance/ExpenseForm'
import { ExecuteEventForm } from './features/finance/ExecuteEventForm'
import { CashTransactionForm } from './features/finance/CashTransactionForm'
import { useFinance } from './features/finance/useFinance'
import { summarizeCashTransactions, summarizeFundBalances, type CashTransaction } from './features/finance/financeRepository'
import { getContributionMemberType, calculateContributionTotal } from './features/finance/contributionRules'
import { GalleryForm } from './features/community/GalleryForm'
import { ContributionForm } from './features/community/ContributionForm'
import { BatalLunasForm } from './features/community/BatalLunasForm'
import { MemberForm } from './features/community/MemberForm'
import { EventForm } from './features/community/EventForm'
import { DeceasedForm } from './features/community/DeceasedForm'
import { WinnerForm } from './features/community/WinnerForm'
import { PrayerNoteForm } from './features/community/PrayerNoteForm'
import { useCommunity } from './features/community/useCommunity'
import {
  getWhatsAppNumber,
  type CommunityEvent,
  type CommunityMember,
  type GalleryPhoto,
  type PrayerNote,
  type LegacyDeceasedPerson,
  type ArisanWinner,
  type ManagerMember,
} from './features/community/communityRepository'
import { AuditPage } from './features/audit/AuditPage'
import { useAuditLog } from './features/audit/useAuditLog'
import { isMasterAdminEmail } from './data/access'
import { ORGANIZATION } from './data/organization'
import { DOA_NU_ONLINE, TAHLIL_NU_ONLINE, YASIN_LENGKAP } from './data/prayers'
import { formatRupiah } from './lib/utils'
import { supabase } from './lib/supabase'
import { useAuth } from './features/auth/useAuth'
import './App.css'

type DataEditor =
  | { type: 'member'; member?: CommunityMember & { phone?: string | null } }
  | { type: 'event'; event?: CommunityEvent }
  | { type: 'deceased'; person?: LegacyDeceasedPerson }
  | { type: 'winner'; winner?: ArisanWinner }
  | { type: 'prayer'; note?: PrayerNote }
  | { type: 'gallery'; photo?: GalleryPhoto }
  | { type: 'cash'; transaction: CashTransaction }

type DeleteTarget = {
  entity: 'member' | 'event' | 'deceased' | 'winner' | 'prayer' | 'gallery' | 'cash'
  id: string
  label: string
  requirePin?: boolean
}

function App() {
  const { session, profile, isLoading, error, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState<AppTab>('beranda')
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [showExecuteEventForm, setShowExecuteEventForm] = useState(false)
  const [showContributionForm, setShowContributionForm] = useState(false)
  const [editor, setEditor] = useState<DataEditor | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [lunasMemberId, setLunasMemberId] = useState<string | null>(null)
  const [batalMemberId, setBatalMemberId] = useState<string | null>(null)
  const [showAuth, setShowAuth] = useState(false)
  const [showAdminRegister, setShowAdminRegister] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [textScale, setTextScale] = useState(() => {
    const stored = Number(window.localStorage.getItem('ikt-text-scale'))
    return Number.isFinite(stored) && stored >= 0.9 && stored <= 1.2 ? stored : 1
  })
  const finance = useFinance(session?.user.id ?? null)
  const community = useCommunity(session?.user.id ?? null)
  const summary = useMemo(() => summarizeCashTransactions(finance.transactions), [finance.transactions])
  const fundBalances = useMemo(() => summarizeFundBalances(finance.transactions), [finance.transactions])
  const canManage = profile?.role === 'admin' || profile?.role === 'treasurer'
  const isMasterAdmin = profile?.role === 'admin' && isMasterAdminEmail(session?.user.email)
  const audit = useAuditLog(isMasterAdmin)
  const lunasMember = community.members.find((member) => member.id === lunasMemberId) ?? null
  const batalMember = community.members.find((member) => member.id === batalMemberId) ?? null

  function requireManager(): boolean {
    if (!session) {
      setShowAuth(true)
      return false
    }
    return canManage
  }

  function openEditor(next: DataEditor) {
    if (!requireManager()) return
    community.clearError()
    finance.clearError()
    setEditor(next)
  }

  function openDelete(next: DeleteTarget) {
    if (!requireManager()) return
    community.clearError()
    finance.clearError()
    setDeleteTarget(next)
  }

  function memberWithPhone(member: CommunityMember) {
    return { ...member, phone: community.reminderMembers.find((item) => item.id === member.id)?.phone ?? null }
  }

  useEffect(() => {
    if (session) setShowAuth(false)
  }, [session])

  useEffect(() => {
    if (activeTab === 'audit' && !isMasterAdmin) setActiveTab('beranda')
  }, [activeTab, isMasterAdmin])

  useEffect(() => {
    document.documentElement.style.fontSize = `${textScale * 100}%`
    window.localStorage.setItem('ikt-text-scale', String(textScale))
    return () => {
      document.documentElement.style.fontSize = ''
    }
  }, [textScale])

  if (!supabase) return <DemoModeNotice />
  if (isLoading) return <LoadingScreen label="Menyiapkan informasi IKT..." />

  function requestManagerAction(action: 'expense' | 'event' | 'lunas') {
    if (!requireManager()) return
    if (action === 'expense') setShowExpenseForm(true)
    if (action === 'event') setShowExecuteEventForm(true)
    if (action === 'lunas') setShowContributionForm(true)
  }

  function renderPage() {
    if (activeTab === 'audit') {
      return <AuditPage entries={audit.entries} isLoading={audit.isLoading} error={audit.error} onRetry={() => void audit.reload()} />
    }
    if (activeTab === 'keuangan') {
      return <FinancePage finance={finance} summary={summary} fundBalances={fundBalances} canManage={canManage} isLoggedIn={Boolean(session)} onExpense={() => requestManagerAction('expense')} onExecuteEvent={() => requestManagerAction('event')} onEditTransaction={(transaction) => openEditor({ type: 'cash', transaction })} onDeleteTransaction={(transaction) => openDelete({ entity: 'cash', id: transaction.id, label: transaction.description, requirePin: true })} />
    }
    if (activeTab === 'iuran') {
      return <ContributionsPage members={community.members} canManage={canManage} reminderMembers={community.reminderMembers} onLogin={() => setShowAuth(true)} onAddMember={() => openEditor({ type: 'member' })} onEditMember={(member) => openEditor({ type: 'member', member: memberWithPhone(member) })} onDeleteMember={(member) => openDelete({ entity: 'member', id: member.id, label: member.full_name })} onSetLunas={(memberId) => { if (!requireManager()) return; setLunasMemberId(memberId); setShowContributionForm(true) }} onBatalLunas={(memberId) => { if (!requireManager()) return; setBatalMemberId(memberId) }} />
    }
    if (activeTab === 'doa') {
      return <PrayerPage people={community.legacyDeceasedPeople} notes={community.prayerNotes} isLoading={community.isLoading} error={community.error} canManage={canManage} onRetry={() => void community.reload()} onAddNote={() => openEditor({ type: 'prayer' })} onEditNote={(note) => openEditor({ type: 'prayer', note })} onDeleteNote={(note) => openDelete({ entity: 'prayer', id: note.id, label: note.title })} />
    }
    if (activeTab === 'anggota') {
      return <MembersPage members={community.members} isLoading={community.isLoading} error={community.error} onRetry={() => void community.reload()} isLoggedIn={Boolean(session)} canManage={canManage} onLogin={() => setShowAuth(true)} onAdd={() => openEditor({ type: 'member' })} onEdit={(member) => openEditor({ type: 'member', member: memberWithPhone(member) })} onDelete={(member) => openDelete({ entity: 'member', id: member.id, label: member.full_name })} />
    }
    if (activeTab === 'almarhum') {
      return <DeceasedPage people={community.legacyDeceasedPeople} isLoading={community.isLoading} error={community.error} canManage={canManage} onRetry={() => void community.reload()} onAdd={() => openEditor({ type: 'deceased' })} onEdit={(person) => openEditor({ type: 'deceased', person })} onDelete={(person) => openDelete({ entity: 'deceased', id: person.id, label: person.full_name })} />
    }
    if (activeTab === 'galeri') {
      return <GalleryPage photos={community.galleryPhotos} isLoading={community.isLoading} error={community.error} canManage={canManage} onRetry={() => void community.reload()} onAdd={() => openEditor({ type: 'gallery' })} onEdit={(photo) => openEditor({ type: 'gallery', photo })} onDelete={(photo) => openDelete({ entity: 'gallery', id: photo.id, label: photo.title })} />
    }
    return <HomePage events={community.events} winners={community.winners} summary={summary} fundBalances={fundBalances} memberCount={community.members.length} isLoggedIn={Boolean(session)} canManage={canManage} isLoading={community.isLoading} error={community.error} onRetry={() => void community.reload()} onNavigate={setActiveTab} onAddEvent={() => openEditor({ type: 'event' })} onEditEvent={(event) => openEditor({ type: 'event', event })} onDeleteEvent={(event) => openDelete({ entity: 'event', id: event.id, label: event.host_name || event.title })} onAddWinner={() => openEditor({ type: 'winner' })} onEditWinner={(winner) => openEditor({ type: 'winner', winner })} onDeleteWinner={(winner) => openDelete({ entity: 'winner', id: winner.id, label: winner.winner_name })} />
  }

  return (
    <div className="min-h-screen bg-[#f7fbfa] pb-28 text-slate-700">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
          <button type="button" className="flex items-center gap-3 text-left" onClick={() => setActiveTab('beranda')}>
            <span className="flex size-10 items-center justify-center rounded-xl bg-teal-700 text-sm font-black text-white shadow-lg shadow-teal-900/15">IKT</span>
            <span><strong className="block text-sm text-slate-900">IKT Connect</strong><small className="block text-[11px] text-slate-500">Arisan · Keluarga · Doa</small></span>
          </button>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 sm:inline-flex">Informasi publik</span>
            <div className="hidden items-center gap-1 rounded-xl border border-slate-200 p-1 sm:flex" aria-label="Ukuran teks">
              <button type="button" className="flex size-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100" onClick={() => setTextScale((current) => Math.max(0.9, Number((current - 0.1).toFixed(1))))} aria-label="Perkecil teks"><Minus size={15} /></button>
              <span className="px-1 text-[10px] font-bold text-slate-500" aria-live="polite">A</span>
              <button type="button" className="flex size-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100" onClick={() => setTextScale((current) => Math.min(1.2, Number((current + 0.1).toFixed(1))))} aria-label="Perbesar teks"><Plus size={15} /></button>
            </div>
            {session && profile?.role === 'admin' && <Button size="sm" className="hidden md:inline-flex" onClick={() => setShowAdminRegister(true)}>Daftarkan pengurus</Button>}
            {session ? <Button size="sm" variant="outline" onClick={() => void signOut()}><LogOut size={15} /> Keluar</Button> : <Button size="sm" variant="outline" onClick={() => setShowAuth(true)}><LogIn size={15} /> Pengurus</Button>}
            <button type="button" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 md:hidden" onClick={() => setShowMobileMenu((current) => !current)} aria-label="Buka menu"><Menu size={20} /></button>
          </div>
        </div>
        {showMobileMenu && <div className="border-t border-slate-100 bg-white px-4 py-3 text-sm text-slate-500 md:hidden"><p>Anggota dapat membaca informasi tanpa membuat akun. Login hanya dibutuhkan saat pengurus mencatat data.</p>{session && profile?.role === 'admin' && <Button size="sm" className="mt-3 w-full" onClick={() => { setShowAdminRegister(true); setShowMobileMenu(false) }}>Daftarkan pengurus</Button>}</div>}
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-6 pt-6 sm:px-6">{error && <Notice message={error} tone="warning" />}{renderPage()}</main>
      <BottomNav activeTab={activeTab} showAudit={isMasterAdmin} onChange={(tab) => { setActiveTab(tab); setShowMobileMenu(false) }} />

      {showExpenseForm && <ExpenseForm onClose={() => setShowExpenseForm(false)} onSubmit={async (values) => { const saved = await finance.createExpense(values); if (saved) setShowExpenseForm(false) }} error={finance.error} />}
      {showExecuteEventForm && <ExecuteEventForm onClose={() => setShowExecuteEventForm(false)} onSubmit={async (values) => { const saved = await finance.executeEvent(values); if (saved) { setShowExecuteEventForm(false); await community.reload() } return saved }} error={finance.error} />}
      {editor?.type === 'gallery' && <GalleryForm photo={editor.photo} onClose={() => setEditor(null)} onSubmit={async (values) => { const saved = await community.saveGalleryPhoto(values); if (saved) setEditor(null); return saved }} error={community.error} />}
      {editor?.type === 'member' && <MemberForm member={editor.member} onClose={() => setEditor(null)} onSubmit={async (values) => { const saved = await community.saveMember(values); if (saved) setEditor(null); return saved }} error={community.error} />}
      {editor?.type === 'event' && <EventForm event={editor.event} onClose={() => setEditor(null)} onSubmit={async (values) => { const saved = await community.saveEvent(values); if (saved) setEditor(null); return saved }} error={community.error} />}
      {editor?.type === 'deceased' && <DeceasedForm person={editor.person} onClose={() => setEditor(null)} onSubmit={async (values) => { const saved = await community.saveDeceased(values); if (saved) setEditor(null); return saved }} error={community.error} />}
      {editor?.type === 'winner' && <WinnerForm winner={editor.winner} onClose={() => setEditor(null)} onSubmit={async (values) => { const saved = await community.saveWinner(values); if (saved) setEditor(null); return saved }} error={community.error} />}
      {editor?.type === 'prayer' && <PrayerNoteForm note={editor.note} onClose={() => setEditor(null)} onSubmit={async (values) => { const saved = await community.savePrayerNote(values); if (saved) setEditor(null); return saved }} error={community.error} />}
      {editor?.type === 'cash' && <CashTransactionForm transaction={editor.transaction} onClose={() => setEditor(null)} onSubmit={async (values) => { const saved = await finance.updateTransaction(values); if (saved) setEditor(null); return saved }} error={finance.error} />}
      {deleteTarget && (
        <ConfirmDeleteDialog
          title={`Hapus ${deleteTarget.label}?`}
          message={deleteTarget.entity === 'member'
            ? 'Anggota yang punya riwayat pelunasan akan dinonaktifkan, bukan dihapus permanen.'
            : deleteTarget.entity === 'cash'
              ? 'Transaksi pelunasan tidak bisa dihapus dari sini. Transaksi manual akan dihapus setelah PIN benar.'
              : 'Data ini akan dihapus dari aplikasi. Impor sheet lama tidak akan mengembalikannya kecuali diimpor ulang.'}
          requirePin={deleteTarget.requirePin}
          error={deleteTarget.entity === 'cash' ? finance.error : community.error}
          onClose={() => setDeleteTarget(null)}
          onConfirm={async (pin) => {
            if (deleteTarget.entity === 'member') return community.deleteMember(deleteTarget.id)
            if (deleteTarget.entity === 'event') return community.deleteEvent(deleteTarget.id)
            if (deleteTarget.entity === 'deceased') return community.deleteDeceased(deleteTarget.id)
            if (deleteTarget.entity === 'winner') return community.deleteWinner(deleteTarget.id)
            if (deleteTarget.entity === 'prayer') return community.deletePrayerNote(deleteTarget.id)
            if (deleteTarget.entity === 'gallery') {
              const photo = community.galleryPhotos.find((item) => item.id === deleteTarget.id)
              return photo ? community.deleteGalleryPhoto(photo) : false
            }
            return finance.deleteTransaction({ id: deleteTarget.id, pin: pin ?? '' })
          }}
        />
      )}
      {showContributionForm && <ContributionForm members={community.members} presetMemberId={lunasMember?.id} onClose={() => { setShowContributionForm(false); setLunasMemberId(null) }} onSubmit={async (values) => { const saved = await community.saveContribution(values); if (saved) { await finance.reload(); setShowContributionForm(false); setLunasMemberId(null) } return saved }} error={community.error} />}
      {batalMember && <BatalLunasForm member={batalMember} onClose={() => setBatalMemberId(null)} onSubmit={async (values) => { const saved = await community.reverseContribution(values); if (saved) { await finance.reload(); setBatalMemberId(null) } return saved }} error={community.error} />}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showAdminRegister && profile?.role === 'admin' && <AdminRegisterForm onClose={() => setShowAdminRegister(false)} />}
    </div>
  )
}

function AuthModal({ onClose }: { onClose: () => void }) {
  return <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/50 px-4 py-8"><div className="mx-auto max-w-md"><AuthScreen onClose={onClose} /></div></div>
}

function HomePage({ events, winners, summary, fundBalances, memberCount, isLoggedIn, canManage, isLoading, error, onRetry, onNavigate, onAddEvent, onEditEvent, onDeleteEvent, onAddWinner, onEditWinner, onDeleteWinner }: { events: CommunityEvent[]; winners: ArisanWinner[]; summary: ReturnType<typeof summarizeCashTransactions>; fundBalances: ReturnType<typeof summarizeFundBalances>; memberCount: number; isLoggedIn: boolean; canManage: boolean; isLoading: boolean; error: string | null; onRetry: () => void; onNavigate: (tab: AppTab) => void; onAddEvent: () => void; onEditEvent: (event: CommunityEvent) => void; onDeleteEvent: (event: CommunityEvent) => void; onAddWinner: () => void; onEditWinner: (winner: ArisanWinner) => void; onDeleteWinner: (winner: ArisanWinner) => void }) {
  const upcoming = events.find((item) => new Date(item.starts_at).getTime() >= Date.now()) ?? events.at(-1) ?? null
  return (
    <section className="space-y-5" aria-labelledby="home-title">
      <PageHeading eyebrow="Pusat informasi keluarga" title="Selamat datang di IKT Connect" description="Agenda, lokasi, buku doa, dan rekening transfer dapat dibaca tanpa login. Kas dan status iuran hanya tampil setelah pengurus masuk." />
      {isLoggedIn ? (
        <section className="welcome-card relative overflow-hidden rounded-3xl p-5 text-white shadow-lg shadow-teal-900/10 sm:p-7">
          <div className="welcome-orb welcome-orb-one" /><div className="welcome-orb welcome-orb-two" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-100">Total kas mengendap</p>
            <p className="mt-2 text-3xl font-black tracking-tight">{formatRupiah(summary.balance)}</p>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-teal-50">Saldo dihitung dari seluruh mutasi pos dana, bukan dari angka manual.</p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-white/15 px-3 py-1.5">{memberCount} anggota aktif</span>
              <span className="rounded-full bg-white/15 px-3 py-1.5">{summary.monthLabel}</span>
            </div>
          </div>
        </section>
      ) : (
        <section className="welcome-card relative overflow-hidden rounded-3xl p-5 text-white shadow-lg shadow-teal-900/10 sm:p-7">
          <div className="welcome-orb welcome-orb-one" /><div className="welcome-orb welcome-orb-two" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-100">Arisan &amp; Buku Doa Digital IKT</p>
            <p className="mt-2 text-2xl font-black tracking-tight">Kabar acara dan bacaan bersama</p>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-teal-50">Pengurus masuk untuk mencatat iuran, eksekusi acara, dan melihat rincian kas per pos dana.</p>
          </div>
        </section>
      )}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-teal-700">Jadwal acara terdekat</p>
            <h2 className="mt-1 font-bold text-slate-900">{upcoming?.host_name || 'Lokasi arisan'}</h2>
          </div>
          {canManage ? <Button size="sm" onClick={onAddEvent}><Plus size={15} /> Agenda</Button> : <CalendarDays className="text-teal-700" size={21} />}
        </div>
        {isLoading ? <InlineLoading label="Memuat agenda..." /> : error ? <DataError message={error} onRetry={onRetry} /> : upcoming ? (
          <div className="space-y-3">
            <EventPreview event={upcoming} />
            {canManage && <RowActions onEdit={() => onEditEvent(upcoming)} onDelete={() => onDeleteEvent(upcoming)} />}
          </div>
        ) : <p className="rounded-xl bg-slate-50 px-3 py-5 text-center text-sm text-slate-500">Belum ada agenda. Pengurus dapat menambahnya di sini.</p>}
      {canManage && events.length > 1 && (
          <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-500">Semua agenda</p>
            {events.filter((item) => item.id !== upcoming?.id).map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">{item.host_name || item.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(item.starts_at)}</p>
                </div>
                <RowActions onEdit={() => onEditEvent(item)} onDelete={() => onDeleteEvent(item)} />
              </div>
            ))}
          </div>
        )}
      </section>
      <BankTransferCard />
      {isLoggedIn && fundBalances.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="font-bold text-slate-900">Ringkasan kas per pos</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">{fundBalances.map((fund) => <div key={fund.category} className="rounded-xl bg-slate-50 px-3 py-3"><p className="text-[11px] text-slate-500">{fund.label}</p><p className="mt-1 text-sm font-black text-slate-900">{formatRupiah(fund.amount)}</p></div>)}</div>
        </section>
      )}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-teal-700">Riwayat pemenang</p>
          {canManage && <Button size="sm" onClick={onAddWinner}><Plus size={15} /> Pemenang</Button>}
        </div>
        {winners.length ? (
          <div className="space-y-2">{winners.map((winner) => (
            <div key={winner.id} className="flex flex-col gap-3 rounded-xl bg-slate-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">{winner.winner_name}</p>
                <p className="mt-0.5 text-xs text-slate-500">{winner.period_label}{winner.description ? ` · ${winner.description}` : ''}</p>
              </div>
              {canManage && <RowActions onEdit={() => onEditWinner(winner)} onDelete={() => onDeleteWinner(winner)} />}
            </div>
          ))}</div>
        ) : <p className="text-sm text-slate-500">Belum ada riwayat pemenang.</p>}
      </section>
      <div className="grid gap-3 sm:grid-cols-3"><QuickCard icon={CircleDollarSign} title="Lihat iuran" description="Status LUNAS / BELUM periode ini" onClick={() => onNavigate('iuran')} /><QuickCard icon={HandCoins} title="Buku doa" description="Yasin, tahlil, dan doa arwah" onClick={() => onNavigate('doa')} /><QuickCard icon={Images} title="Galeri foto" description="Kenangan kegiatan keluarga" onClick={() => onNavigate('galeri')} /></div>
    </section>
  )
}

function FinancePage({ finance, summary, fundBalances, canManage, isLoggedIn, onExpense, onExecuteEvent, onEditTransaction, onDeleteTransaction }: { finance: ReturnType<typeof useFinance>; summary: ReturnType<typeof summarizeCashTransactions>; fundBalances: ReturnType<typeof summarizeFundBalances>; canManage: boolean; isLoggedIn: boolean; onExpense: () => void; onExecuteEvent: () => void; onEditTransaction: (transaction: CashTransaction) => void; onDeleteTransaction: (transaction: CashTransaction) => void }) {
  return (
    <section className="space-y-5" aria-labelledby="finance-title">
      <PageHeading eyebrow="Buku kas" title="Keuangan" description="Saldo dihitung dari mutasi pos dana. Eksekusi acara dan pengeluaran lain hanya oleh pengurus + PIN." />
      {!isLoggedIn && <Notice message="Masuk sebagai pengurus untuk melihat rincian kas dan mencatat mutasi." />}
      {isLoggedIn && !canManage && <Notice message="Anda melihat informasi kas. Tombol pencatatan hanya tersedia untuk admin dan bendahara." />}
      {isLoggedIn && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard label="Total kas mengendap" value={summary.balance} icon={WalletCards} tone="teal" />
            <MetricCard label="Pemasukan bulan ini" value={summary.monthIncome} icon={ArrowUpRight} tone="blue" />
            <MetricCard label="Pengeluaran bulan ini" value={summary.monthExpense} icon={ArrowDownRight} tone="amber" />
          </div>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="font-bold text-slate-900">Pos dana</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">{fundBalances.map((fund) => <div key={fund.category} className="rounded-xl bg-slate-50 px-3 py-3"><p className="text-[11px] text-slate-500">{fund.label}</p><p className="mt-1 text-sm font-black text-slate-900">{formatRupiah(fund.amount)}</p></div>)}</div>
          </section>
          {canManage && (
            <section className="rounded-2xl border border-teal-200 bg-teal-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-teal-800">Panel pengurus / bendahara</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={onExecuteEvent}>Eksekusi acara</Button>
                <Button size="sm" variant="outline" onClick={onExpense}>Pengeluaran lainnya</Button>
              </div>
            </section>
          )}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 id="finance-title" className="font-bold text-slate-900">Rincian buku kas</h2>
                <p className="mt-1 text-xs text-slate-500">Semua pemasukan dan pengeluaran tercatat di sini.</p>
              </div>
              {canManage && <Button size="sm" onClick={onExpense}><Plus size={15} /> Catat</Button>}
            </div>
            {finance.error && <DataError message={finance.error} onRetry={() => void finance.reload()} />}
            {finance.isLoading ? <InlineLoading label="Memuat transaksi..." /> : finance.transactions.length ? <div className="divide-y divide-slate-100">{finance.transactions.slice(0, 20).map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} canManage={canManage} onEdit={() => onEditTransaction(transaction)} onDelete={() => onDeleteTransaction(transaction)} />)}</div> : <EmptyState icon={WalletCards} title="Belum ada transaksi" description="Catatan pemasukan dan pengeluaran belum tersedia." />}
          </section>
        </>
      )}
    </section>
  )
}

function ContributionsPage({ members, canManage, reminderMembers, onLogin, onAddMember, onEditMember, onDeleteMember, onSetLunas, onBatalLunas }: { members: CommunityMember[]; canManage: boolean; reminderMembers: ManagerMember[]; onLogin: () => void; onAddMember: () => void; onEditMember: (member: CommunityMember) => void; onDeleteMember: (member: CommunityMember) => void; onSetLunas: (memberId: string) => void; onBatalLunas: (memberId: string) => void }) {
  const outstanding = members.filter((member) => member.period_status === 'BELUM' || member.arrears_periods > 0)

  return (
    <section className="space-y-5" aria-labelledby="contribution-title">
      <PageHeading eyebrow="Status iuran periode ini" title="Iuran arisan" description="Roster ini adalah Status_Iuran operasional. Set Lunas memecah dana ke pos, Batal Lunas menulis koreksi senilai uang yang batal." />
      {canManage && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <Bell className="mt-0.5 shrink-0 text-amber-700" size={19} />
            <div>
              <h2 className="font-bold text-amber-900">Tunggakan pembayaran</h2>
              <p className="mt-1 text-xs leading-relaxed text-amber-800">{outstanding.length} anggota belum lunas atau masih punya tunggakan periode.</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {outstanding.length ? outstanding.map((member) => {
              const target = reminderMembers.find((item) => item.id === member.id)
              const phone = getWhatsAppNumber(target?.phone ?? null)
              return phone ? (
                <a key={member.id} className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-amber-700 px-3 text-xs font-semibold text-white hover:bg-amber-800" href={`https://wa.me/${phone}?text=${encodeURIComponent(`Halo ${member.full_name}, mengingatkan iuran arisan yang masih ${member.period_status === 'BELUM' ? 'belum lunas' : `tertunggak ${member.arrears_periods} periode`}. Terima kasih.`)}`} target="_blank" rel="noreferrer">
                  <Bell size={14} /> {member.full_name}
                </a>
              ) : (
                <span key={member.id} className="rounded-xl bg-white/70 px-3 py-2 text-xs text-amber-800">{member.full_name} · nomor belum ada</span>
              )
            }) : <span className="text-xs font-semibold text-emerald-700">Alhamdulillah, tidak ada tunggakan pembayaran.</span>}
          </div>
        </section>
      )}
      {!canManage && <Notice message="Status iuran dan tombol Set Lunas hanya untuk pengurus. Masuk untuk mengelola periode ini." />}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 id="contribution-title" className="font-bold text-slate-900">Status per anggota</h2>
            <p className="mt-1 text-xs text-slate-500">{members.length} anggota aktif</p>
          </div>
          {canManage ? <Button size="sm" onClick={onAddMember}><Plus size={15} /> Anggota</Button> : <Button size="sm" variant="outline" onClick={onLogin}><LogIn size={15} /> Akses pengurus</Button>}
        </div>
        {!members.length ? <EmptyState icon={UsersRound} title="Belum ada data iuran" description="Roster anggota akan tampil setelah pengurus masuk dan migration operasional dijalankan." /> : <div className="space-y-3">{members.map((member) => <ContributionStatusRow key={member.id} member={member} canManage={canManage} onEdit={() => onEditMember(member)} onDelete={() => onDeleteMember(member)} onSetLunas={() => onSetLunas(member.id)} onBatalLunas={() => onBatalLunas(member.id)} />)}</div>}
      </section>
    </section>
  )
}

function ContributionStatusRow({ member, canManage, onEdit, onDelete, onSetLunas, onBatalLunas }: { member: CommunityMember; canManage: boolean; onEdit: () => void; onDelete: () => void; onSetLunas: () => void; onBatalLunas: () => void }) {
  const memberType = getContributionMemberType(member.member_type)
  const unitTotal = calculateContributionTotal(memberType, 1)
  const isPaid = member.period_status === 'LUNAS'
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
      <div className="flex items-center gap-3">
        <Avatar name={member.full_name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-900">{member.full_name || 'Tanpa nama'}</p>
          <p className="mt-0.5 text-xs text-slate-500">{member.member_type} (Rp{unitTotal.toLocaleString('id-ID')}) · Tunggakan {member.arrears_periods} periode</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${isPaid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{member.period_status}</span>
      </div>
      {canManage && (
        <div className="mt-3 flex flex-wrap gap-2">
          {isPaid ? (
            <Button size="sm" variant="outline" className="flex-1" onClick={onBatalLunas}>Batal Lunas</Button>
          ) : (
            <Button size="sm" className="flex-1" onClick={onSetLunas}>Set Lunas</Button>
          )}
          <Button size="sm" variant="outline" onClick={onEdit}><Pencil size={14} /> Ubah</Button>
          <Button size="sm" variant="outline" className="text-rose-700 hover:bg-rose-50" onClick={onDelete}><Trash2 size={14} /> Hapus</Button>
        </div>
      )}
    </div>
  )
}

function PrayerPage({ people, notes, isLoading, error, canManage, onRetry, onAddNote, onEditNote, onDeleteNote }: { people: LegacyDeceasedPerson[]; notes: PrayerNote[]; isLoading: boolean; error: string | null; canManage: boolean; onRetry: () => void; onAddNote: () => void; onEditNote: (note: PrayerNote) => void; onDeleteNote: (note: PrayerNote) => void }) {
  const [reader, setReader] = useState<'almarhum' | 'yasin' | 'tahlil' | 'doa'>('almarhum')
  const [keepAwake, setKeepAwake] = useState(false)
  const [wakeLockMessage, setWakeLockMessage] = useState<string | null>(null)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const keepAwakeRef = useRef(false)
  const sections = [
    { key: 'almarhum', number: '01', label: 'Almarhum', caption: 'Al-Fatihah' },
    { key: 'yasin', number: '02', label: 'Yasin', caption: '83 ayat' },
    { key: 'tahlil', number: '03', label: 'Tahlil', caption: 'Dzikir' },
    { key: 'doa', number: '04', label: 'Doa', caption: 'Penutup' },
  ] as const

  async function releaseWakeLock() {
    await wakeLockRef.current?.release()
    wakeLockRef.current = null
  }

  async function requestWakeLock() {
    if (!('wakeLock' in navigator)) {
      setWakeLockMessage('Peramban ini belum mendukung pengunci layar.')
      return
    }
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen')
      wakeLockRef.current.addEventListener('release', () => { wakeLockRef.current = null })
      keepAwakeRef.current = true
      setKeepAwake(true)
      setWakeLockMessage('Layar akan tetap menyala selama izin tersedia.')
    } catch {
      setWakeLockMessage('Izin menjaga layar tetap menyala tidak diberikan oleh perangkat.')
    }
  }

  async function toggleWakeLock() {
    if (wakeLockRef.current) {
      await releaseWakeLock()
      keepAwakeRef.current = false
      setKeepAwake(false)
      setWakeLockMessage(null)
      return
    }
    await requestWakeLock()
  }

  useEffect(() => {
    async function reacquireOnVisible() {
      if (document.visibilityState === 'visible' && keepAwakeRef.current && !wakeLockRef.current) await requestWakeLock()
    }
    const handleVisibilityChange = () => { void reacquireOnVisible() }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      void releaseWakeLock()
    }
  }, [])

  return <section className="space-y-5" aria-labelledby="prayer-title"><PageHeading eyebrow="Bacaan bersama" title="Buku Doa" description="Ikuti urutan bacaan bersama: sebut nama almarhum dan almarhumah, baca Al-Fatihah, lalu lanjutkan dengan Yasin, tahlil, dan doa." /><div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-100 bg-teal-50 p-3"><div><p className="text-sm font-bold text-teal-900">Aksesibilitas membaca</p><p className="mt-1 text-xs text-teal-800">Gunakan pengaturan ukuran teks di bagian atas pada layar kecil, atau jaga layar tetap menyala saat membaca.</p>{wakeLockMessage && <p className="mt-1 text-xs text-teal-700" role="status">{wakeLockMessage}</p>}</div><Button type="button" variant="secondary" size="sm" onClick={() => void toggleWakeLock()}>{keepAwake ? 'Matikan pengunci layar' : 'Jaga layar tetap menyala'}</Button></div><nav className="prayer-index" aria-label="Urutan bacaan buku doa">{sections.map((section) => <button type="button" key={section.key} onClick={() => setReader(section.key)} className={`prayer-index-item ${reader === section.key ? 'prayer-index-item-active' : ''}`}><span className="prayer-index-number">{section.number}</span><span className="min-w-0 text-left"><strong className="block text-sm">{section.label}</strong><small className="mt-0.5 block text-[11px]">{section.caption}</small></span></button>)}</nav>{reader === 'almarhum' && <DeceasedPrayerReader people={people} isLoading={isLoading} error={error} onRetry={onRetry} onNext={() => setReader('yasin')} />}{reader === 'yasin' && <YasinReader onNext={() => setReader('tahlil')} />}{reader === 'tahlil' && <ReadingReader title="Dzikir Tahlil" items={TAHLIL_NU_ONLINE} onNext={() => setReader('doa')} nextLabel="Lanjut ke Doa Arwah" />}{reader === 'doa' && <ReadingReader title="Doa Arwah" items={DOA_NU_ONLINE} />}{(notes.length > 0 || canManage) && <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-bold text-slate-900">Catatan doa keluarga</h2>{canManage && <Button size="sm" onClick={onAddNote}><Plus size={15} /> Catatan</Button>}</div>{notes.length ? <div className="space-y-3">{notes.map((note) => <article key={note.id} className="rounded-xl bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><h3 className="font-bold text-slate-900">{note.title}</h3>{canManage && <RowActions onEdit={() => onEditNote(note)} onDelete={() => onDeleteNote(note)} />}</div><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{note.body}</p></article>)}</div> : <p className="text-sm text-slate-500">Belum ada catatan doa.</p>}</section>}{isLoading && reader !== 'almarhum' && <InlineLoading label="Memuat catatan doa..." />}{error && reader !== 'almarhum' && <DataError message={error} onRetry={onRetry} />}</section>
}

function DeceasedPrayerReader({ people, isLoading, error, onRetry, onNext }: { people: LegacyDeceasedPerson[]; isLoading: boolean; error: string | null; onRetry: () => void; onNext: () => void }) {
  return <section className="reading-card"><div className="reading-heading"><p className="reading-eyebrow">Urutan pertama</p><h2 className="mt-2 text-xl font-bold text-slate-900">Almarhum &amp; Almarhumah</h2><p className="mt-2 text-sm leading-relaxed text-slate-500">Imam menyebut nama satu per satu, kemudian membaca Al-Fatihah untuk setiap nama sampai daftar selesai.</p></div>{isLoading ? <InlineLoading label="Memuat daftar almarhum..." /> : error ? <DataError message={error} onRetry={onRetry} /> : people.length ? <div className="deceased-prayer-list">{people.map((person, index) => <article key={person.id} className="deceased-prayer-row"><span className="deceased-prayer-number">{index + 1}</span><div className="min-w-0 flex-1"><p className="wrap-break-word text-base leading-relaxed text-slate-900"><strong>{person.full_name}</strong>{(person.lineage_label || person.father_name) && <span className="ml-1 text-sm font-normal text-slate-500">{[person.lineage_label, person.father_name].filter(Boolean).join(' ')}</span>}</p></div><span className="deceased-prayer-label">Al-Fatihah</span></article>)}</div> : <EmptyState icon={Heart} title="Belum ada daftar almarhum" description="Daftar nama belum tersedia untuk bacaan bersama." />} {!isLoading && !error && people.length > 0 && <Button className="mt-6 w-full" onClick={onNext}>Lanjut ke Surah Yasin <ChevronRight size={17} /></Button>}</section>
}

function YasinReader({ onNext }: { onNext: () => void }) { return <section className="reading-card"><div className="reading-heading"><p className="reading-eyebrow">Bacaan utama</p><h2 className="mt-2 text-xl font-bold text-slate-900">Surah Yasin</h2><p className="mt-1 text-xs text-slate-500">{YASIN_LENGKAP.length} ayat tersedia di aplikasi</p></div><p className="prayer-arabic mt-7 text-center text-2xl text-slate-900 sm:text-3xl">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</p><div className="mt-7 space-y-3">{YASIN_LENGKAP.map((verse) => <article key={verse.no} className="verse-card"><span className="verse-number">{verse.no}</span><p className="prayer-arabic mt-3 text-right text-2xl leading-[2.15] text-slate-900 sm:text-3xl">{verse.ar}</p><p className="prayer-transliteration">{verse.lt}</p></article>)}</div><Button className="mt-6 w-full" onClick={onNext}>Lanjut ke Dzikir Tahlil <ChevronRight size={17} /></Button></section> }

function ReadingReader({ title, items, onNext, nextLabel }: { title: string; items: Array<{ judul: string; ar: string; lt: string }>; onNext?: () => void; nextLabel?: string }) { return <section className="reading-card"><div className="reading-heading"><p className="reading-eyebrow">Bacaan bersama</p><h2 className="mt-2 text-xl font-bold text-slate-900">{title}</h2><p className="mt-1 text-xs text-slate-500">Baca perlahan dengan jeda pada setiap bagian</p></div><div className="mt-7 space-y-1">{items.map((item, index) => <article key={item.judul} className="reading-section"><div className="flex items-start gap-3"><span className="reading-section-number">{index + 1}</span><h3 className="pt-0.5 font-bold leading-relaxed text-slate-900">{item.judul}</h3></div><p className="prayer-arabic mt-4 text-right text-2xl leading-[2.15] text-slate-900 sm:text-3xl">{item.ar}</p><p className="prayer-transliteration">{item.lt}</p></article>)}</div>{onNext && <Button className="mt-6 w-full" onClick={onNext}>{nextLabel} <ChevronRight size={17} /></Button>}</section> }

function GalleryPage({ photos, isLoading, error, canManage, onRetry, onAdd, onEdit, onDelete }: { photos: GalleryPhoto[]; isLoading: boolean; error: string | null; canManage: boolean; onRetry: () => void; onAdd: () => void; onEdit: (photo: GalleryPhoto) => void; onDelete: (photo: GalleryPhoto) => void }) { return <section className="space-y-5" aria-labelledby="gallery-title"><PageHeading eyebrow="Kenangan bersama" title="Galeri foto" description="Simpan dan lihat kembali momen arisan keluarga IKT." />{canManage && <Button onClick={onAdd}><Camera size={17} /> Tambah foto</Button>}{isLoading ? <InlineLoading label="Memuat galeri..." /> : error ? <DataError message={error} onRetry={onRetry} /> : photos.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{photos.map((photo) => <figure key={photo.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><img src={photo.image_url} alt={photo.title} loading="lazy" className="aspect-square w-full object-cover" /><figcaption className="p-3"><p className="truncate text-sm font-bold text-slate-900">{photo.title}</p>{photo.caption && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{photo.caption}</p>}{photo.taken_on && <p className="mt-2 text-[10px] text-slate-400">{formatDate(photo.taken_on)}</p>}{canManage && <div className="mt-3"><RowActions onEdit={() => onEdit(photo)} onDelete={() => onDelete(photo)} /></div>}</figcaption></figure>)}</div> : <EmptyState icon={Images} title="Belum ada foto" description="Foto kegiatan akan tampil di sini setelah ditambahkan pengurus." />}</section> }

function MembersPage({ members, isLoading, error, onRetry, isLoggedIn, canManage, onLogin, onAdd, onEdit, onDelete }: { members: CommunityMember[]; isLoading: boolean; error: string | null; onRetry: () => void; isLoggedIn: boolean; canManage: boolean; onLogin: () => void; onAdd: () => void; onEdit: (member: CommunityMember) => void; onDelete: (member: CommunityMember) => void }) {
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLocaleLowerCase('id-ID')
  const filteredMembers = members.filter((member) => member.full_name.toLocaleLowerCase('id-ID').includes(normalizedQuery))

  return (
    <section className="space-y-5" aria-labelledby="member-title">
      <PageHeading eyebrow="Keluarga IKT" title="Daftar anggota" description="Roster operasional dari Status_Iuran. Ini bukan daftar akun login." />
      {!isLoggedIn && <Notice message="Masuk sebagai pengurus untuk melihat seluruh nama anggota arisan." />}
      {isLoggedIn && <Notice message="Tipe Arisan membayar Rp 240.000 per periode. Non-Arisan membayar Rp 100.000. Nomor telepon hanya tampil di pengingat pengurus." />}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row">
          {isLoggedIn && <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama anggota..." aria-label="Cari nama anggota" className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" />}
          {canManage && <Button className="shrink-0" onClick={onAdd}><Plus size={15} /> Tambah</Button>}
        </div>
        {!isLoggedIn ? <div className="py-6 text-center"><Button onClick={onLogin}><LogIn size={16} /> Masuk untuk melihat anggota</Button></div> : isLoading ? <InlineLoading label="Memuat anggota..." /> : error ? <DataError message={error} onRetry={onRetry} /> : filteredMembers.length ? <div className="mt-3 divide-y divide-slate-100">{filteredMembers.map((member) => <MemberRow key={member.id} member={member} canManage={canManage} onEdit={() => onEdit(member)} onDelete={() => onDelete(member)} />)}</div> : <EmptyState icon={UsersRound} title="Anggota belum ditemukan" description={query ? 'Coba gunakan nama lain.' : 'Belum ada anggota aktif. Pengurus dapat menambah dari tombol Tambah.'} />}
      </section>
    </section>
  )
}

function MemberRow({ member, canManage, onEdit, onDelete }: { member: CommunityMember; canManage: boolean; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={member.full_name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-900">{member.full_name || 'Tanpa nama'}</p>
          <p className="mt-0.5 text-xs text-slate-500">{member.member_type} · {member.period_status} · Tunggakan {member.arrears_periods}</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${member.period_status === 'LUNAS' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{member.period_status}</span>
      </div>
      {canManage && <RowActions onEdit={onEdit} onDelete={onDelete} />}
    </div>
  )
}

function DeceasedPage({ people, isLoading, error, canManage, onRetry, onAdd, onEdit, onDelete }: { people: LegacyDeceasedPerson[]; isLoading: boolean; error: string | null; canManage: boolean; onRetry: () => void; onAdd: () => void; onEdit: (person: LegacyDeceasedPerson) => void; onDelete: (person: LegacyDeceasedPerson) => void }) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return people
    return people.filter((person) => [person.full_name, person.lineage_label, person.father_name].some((value) => value?.toLowerCase().includes(normalizedQuery)))
  }, [people, query])

  return (
    <section className="space-y-5" aria-labelledby="deceased-title">
      <PageHeading eyebrow="Kenangan keluarga" title="Daftar almarhum dan almarhumah" description="Catatan nama keluarga yang telah berpulang, untuk pengingat dan bahan doa bersama." />
      <section className="deceased-card">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 id="deceased-title" className="font-bold text-slate-900">Nama yang dikenang</h2>
            <p className="mt-1 text-xs text-slate-500">{people.length} nama tercatat</p>
          </div>
          {canManage ? <Button size="sm" onClick={onAdd}><Plus size={15} /> Nama</Button> : <Heart className="shrink-0 text-rose-600" size={21} />}
        </div>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama atau nama ayah..." aria-label="Cari daftar almarhum" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 text-sm outline-none focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-100" />
        {isLoading ? <InlineLoading label="Memuat daftar almarhum..." /> : error ? <DataError message={error} onRetry={onRetry} /> : filtered.length ? (
          <div className="deceased-list mt-4">
            {filtered.map((person) => (
              <div key={person.id} className="deceased-row">
                <span className="deceased-icon"><Heart size={16} /></span>
                <div className="min-w-0 flex-1">
                  <p className="wrap-break-word text-sm leading-relaxed text-slate-900 sm:text-base">
                    <strong>{person.full_name}</strong>
                    {(person.lineage_label || person.father_name) && <span className="ml-1 text-xs font-normal text-slate-500 sm:text-sm">{[person.lineage_label, person.father_name].filter(Boolean).join(' ')}</span>}
                  </p>
                </div>
                {canManage && <RowActions onEdit={() => onEdit(person)} onDelete={() => onDelete(person)} />}
              </div>
            ))}
          </div>
        ) : <EmptyState icon={Heart} title="Nama tidak ditemukan" description={query ? 'Coba gunakan kata pencarian lain.' : 'Belum ada daftar almarhum. Pengurus dapat menambah dari tombol Nama.'} />}
      </section>
    </section>
  )
}

function EventPreview({ event }: { event: CommunityEvent }) {
  const mapsUrl = getSafeMapUrl(event.map_url, event.location)
  return (
    <div>
      <h3 className="text-lg font-bold text-slate-900">{event.host_name || event.title}</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3"><CalendarDays className="mt-0.5 text-teal-700" size={18} /><span><small className="block text-xs text-slate-500">Tanggal</small><strong className="mt-1 block text-sm text-slate-800">{formatDateTime(event.starts_at)}</strong></span></div>
        <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3"><UsersRound className="mt-0.5 text-teal-700" size={18} /><span><small className="block text-xs text-slate-500">Petugas doa</small><strong className="mt-1 block text-sm text-slate-800">{event.prayer_officer || 'Belum ditetapkan'}</strong></span></div>
        <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 sm:col-span-2"><MapPin className="mt-0.5 text-teal-700" size={18} /><span><small className="block text-xs text-slate-500">Alamat</small><strong className="mt-1 block text-sm text-slate-800">{event.location || 'Alamat belum tersedia'}</strong></span></div>
      </div>
      {mapsUrl && <a href={mapsUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800">Buka lokasi di Google Maps <ExternalLink size={16} /></a>}
    </div>
  )
}

function BankTransferCard() {
  const [copied, setCopied] = useState(false)

  async function copyAccount() {
    try {
      await navigator.clipboard.writeText(ORGANIZATION.accountNumber)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <p className="text-xs font-bold uppercase tracking-[0.15em] text-teal-700">Gateway transfer bank</p>
      <p className="mt-2 text-sm font-bold text-slate-900">{ORGANIZATION.bankName}: {ORGANIZATION.accountNumber}</p>
      <p className="mt-1 text-xs text-slate-500">A/N {ORGANIZATION.accountHolder}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => void copyAccount()}><Copy size={14} /> {copied ? 'Tersalin' : 'Salin rekening'}</Button>
        <a className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800" href={`https://wa.me/${getWhatsAppNumber(ORGANIZATION.confirmationWhatsApp)}?text=${encodeURIComponent('Assalamualaikum, saya sudah transfer iuran arisan IKT.')}`} target="_blank" rel="noreferrer">Konfirmasi WA</a>
      </div>
    </section>
  )
}

function TransactionRow({ transaction, canManage, onEdit, onDelete }: { transaction: CashTransaction; canManage: boolean; onEdit: () => void; onDelete: () => void }) {
  const locked = Boolean(transaction.is_locked)
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${transaction.type === 'income' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{transaction.type === 'income' ? <ArrowUpRight size={17} /> : <ArrowDownRight size={17} />}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-800">{transaction.description}</p>
          <p className="mt-0.5 text-xs text-slate-500">{transaction.category} · {formatDate(transaction.occurred_on)}{locked ? ' · terkunci pelunasan' : ''}</p>
        </div>
        <strong className={`text-sm ${transaction.type === 'income' ? 'text-emerald-700' : 'text-amber-700'}`}>{transaction.type === 'income' ? '+' : '-'}{formatRupiah(Number(transaction.amount))}</strong>
      </div>
      {canManage && !locked && <RowActions onEdit={onEdit} onDelete={onDelete} />}
    </div>
  )
}

function MetricCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof WalletCards; tone: 'teal' | 'blue' | 'amber' }) { const styles = { teal: 'bg-teal-50 text-teal-700', blue: 'bg-blue-50 text-blue-700', amber: 'bg-amber-50 text-amber-700' }; return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className={`flex size-9 items-center justify-center rounded-xl ${styles[tone]}`}><Icon size={18} /></div><p className="mt-4 text-xs text-slate-500">{label}</p><p className="mt-1 text-lg font-black tracking-tight text-slate-900">{formatRupiah(value)}</p></div> }
function QuickCard({ icon: Icon, title, description, onClick }: { icon: typeof CircleDollarSign; title: string; description: string; onClick: () => void }) { return <button type="button" onClick={onClick} className="flex min-h-20 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><Icon size={19} /></span><span className="min-w-0 flex-1"><strong className="block text-sm text-slate-900">{title}</strong><small className="mt-1 block text-xs leading-relaxed text-slate-500">{description}</small></span><ChevronRight size={17} className="shrink-0 text-slate-400" /></button> }
function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) { return <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">{eyebrow}</p><h1 id={title === 'Selamat datang di IKT Connect' ? 'home-title' : undefined} className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">{description}</p></div> }
function Avatar({ name }: { name: string }) { const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?'; return <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-sm font-bold text-teal-700">{initials}</span> }
function Notice({ message, tone = 'info' }: { message: string; tone?: 'info' | 'warning' }) { return <p className={`rounded-xl px-3 py-2.5 text-xs leading-relaxed ${tone === 'warning' ? 'bg-amber-50 text-amber-800' : 'bg-teal-50 text-teal-800'}`}>{message}</p> }
function DataError({ message, onRetry }: { message: string; onRetry: () => void }) { return <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700"><p>{message}</p><Button size="sm" variant="outline" className="mt-3" onClick={onRetry}><RefreshCw size={14} /> Coba lagi</Button></div> }
function InlineLoading({ label }: { label: string }) { return <p className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500"><span className="size-4 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />{label}</p> }
function EmptyState({ icon: Icon, title, description }: { icon: typeof WalletCards; title: string; description: string }) { return <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 px-5 py-10 text-center"><span className="flex size-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700"><Icon size={24} /></span><h2 className="mt-4 font-bold text-slate-900">{title}</h2><p className="mt-2 max-w-sm text-sm text-slate-500">{description}</p></div> }
function formatDate(value: string) { return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`)) }
function formatDateTime(value: string) { return new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeStyle: 'short' }).format(new Date(value)) }
function getSafeMapUrl(mapUrl: string | null, location: string | null) { if (mapUrl) { try { const url = new URL(mapUrl); if (url.protocol === 'http:' || url.protocol === 'https:') return url.href } catch { /* Fall back to a generated search URL. */ } } return location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}` : '' }
function LoadingScreen({ label }: { label: string }) { return <main className="flex min-h-screen items-center justify-center bg-[#f7fbfa] px-4"><div className="text-center"><div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-teal-700 text-white shadow-lg shadow-teal-900/15"><ShieldCheck size={25} /></div><p className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-500"><span className="size-4 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />{label}</p></div></main> }
function DemoModeNotice() { return <main className="flex min-h-screen items-center justify-center bg-[#f7fbfa] px-4 py-8"><section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-xl shadow-slate-900/5"><div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700"><ShieldCheck size={25} /></div><h1 className="mt-4 text-xl font-bold text-slate-900">Konfigurasi Supabase belum lengkap</h1><p className="mt-2 text-sm leading-relaxed text-slate-500">Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY untuk memuat informasi keluarga IKT.</p></section></main> }

export default App