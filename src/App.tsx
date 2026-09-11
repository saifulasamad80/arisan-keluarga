import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Camera,
  ChevronRight,
  CircleDollarSign,
  ExternalLink,
  HandCoins,
  Images,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  Plus,
  RefreshCw,
  ShieldCheck,
  UsersRound,
  WalletCards,
} from 'lucide-react'
import { BottomNav, type AppTab } from './components/BottomNav'
import { Button } from './components/ui/button'
import { AuthScreen } from './features/auth/AuthScreen'
import { ExpenseForm } from './features/finance/ExpenseForm'
import { useFinance } from './features/finance/useFinance'
import { summarizeCashTransactions, type CashTransaction } from './features/finance/financeRepository'
import { GalleryForm } from './features/community/GalleryForm'
import { ContributionForm } from './features/community/ContributionForm'
import { useCommunity } from './features/community/useCommunity'
import {
  getWhatsAppNumber,
  type CommunityEvent,
  type CommunityMember,
  type GalleryPhoto,
  type PrayerNote,
  type PublicContribution,
} from './features/community/communityRepository'
import { DOA_NU_ONLINE, TAHLIL_NU_ONLINE, YASIN_LENGKAP } from './data/prayers'
import { formatRupiah } from './lib/utils'
import { supabase } from './lib/supabase'
import { useAuth } from './features/auth/useAuth'
import './App.css'

function App() {
  const { session, profile, isLoading, error, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState<AppTab>('beranda')
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [showGalleryForm, setShowGalleryForm] = useState(false)
  const [showContributionForm, setShowContributionForm] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const finance = useFinance(session?.user.id ?? null)
  const community = useCommunity(session?.user.id ?? null)
  const summary = useMemo(() => summarizeCashTransactions(finance.transactions), [finance.transactions])
  const canManage = profile?.role === 'admin' || profile?.role === 'treasurer'

  useEffect(() => {
    if (session) setShowAuth(false)
  }, [session])

  if (!supabase) return <DemoModeNotice />
  if (isLoading) return <LoadingScreen label="Menyiapkan informasi IKT..." />

  function requestManagerAction(action: 'expense' | 'gallery') {
    if (!session) {
      setShowAuth(true)
      return
    }
    if (!canManage) return
    if (action === 'expense') setShowExpenseForm(true)
    if (action === 'gallery') setShowGalleryForm(true)
  }

  function renderPage() {
    if (activeTab === 'keuangan') {
      return <FinancePage finance={finance} summary={summary} canManage={canManage} onAction={() => requestManagerAction('expense')} />
    }
    if (activeTab === 'iuran') {
      return <ContributionsPage contributions={community.contributions} members={community.members} canManage={canManage} reminderMembers={community.reminderMembers} onLogin={() => setShowAuth(true)} onAdd={() => { if (session) setShowContributionForm(true); else setShowAuth(true) }} />
    }
    if (activeTab === 'doa') {
      return <PrayerPage notes={community.prayerNotes} isLoading={community.isLoading} error={community.error} onRetry={() => void community.reload()} />
    }
    if (activeTab === 'anggota') {
      return <MembersPage members={community.members} isLoading={community.isLoading} error={community.error} onRetry={() => void community.reload()} />
    }
    if (activeTab === 'galeri') {
      return <GalleryPage photos={community.galleryPhotos} isLoading={community.isLoading} error={community.error} canManage={canManage} onRetry={() => void community.reload()} onAdd={() => requestManagerAction('gallery')} />
    }
    return <HomePage event={community.events[0] ?? null} summary={summary} memberCount={community.members.length} isLoading={community.isLoading} error={community.error} onRetry={() => void community.reload()} onNavigate={setActiveTab} />
  }

  return (
    <div className="min-h-screen bg-[#f7fbfa] pb-24 text-slate-700 md:pb-8">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
          <button type="button" className="flex items-center gap-3 text-left" onClick={() => setActiveTab('beranda')}>
            <span className="flex size-10 items-center justify-center rounded-xl bg-teal-700 text-sm font-black text-white shadow-lg shadow-teal-900/15">IKT</span>
            <span><strong className="block text-sm text-slate-900">IKT Connect</strong><small className="block text-[11px] text-slate-500">Arisan · Keluarga · Doa</small></span>
          </button>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 sm:inline-flex">Informasi publik</span>
            {session ? <Button size="sm" variant="outline" onClick={() => void signOut()}><LogOut size={15} /> Keluar</Button> : <Button size="sm" variant="outline" onClick={() => setShowAuth(true)}><LogIn size={15} /> Pengurus</Button>}
            <button type="button" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 md:hidden" onClick={() => setShowMobileMenu((current) => !current)} aria-label="Buka menu"><Menu size={20} /></button>
          </div>
        </div>
        {showMobileMenu && <div className="border-t border-slate-100 bg-white px-4 py-3 text-sm text-slate-500 md:hidden">Anggota dapat membaca informasi tanpa membuat akun. Login hanya dibutuhkan saat pengurus mencatat data.</div>}
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-6 pt-6 sm:px-6">{error && <Notice message={error} tone="warning" />}{renderPage()}</main>
      <BottomNav activeTab={activeTab} onChange={(tab) => { setActiveTab(tab); setShowMobileMenu(false) }} />

      {showExpenseForm && <ExpenseForm onClose={() => setShowExpenseForm(false)} onSubmit={async (values) => { const saved = await finance.createExpense(values); if (saved) setShowExpenseForm(false) }} error={finance.error} />}
      {showGalleryForm && <GalleryForm onClose={() => setShowGalleryForm(false)} onSubmit={async (values) => { const saved = await community.saveGalleryPhoto(values); if (saved) setShowGalleryForm(false); return saved }} error={community.error} />}
      {showContributionForm && <ContributionForm members={community.members} onClose={() => setShowContributionForm(false)} onSubmit={async (values) => { const saved = await community.saveContribution(values); if (saved) setShowContributionForm(false); return saved }} error={community.error} />}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  )
}

function AuthModal({ onClose }: { onClose: () => void }) {
  return <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/50 px-4 py-8"><div className="mx-auto max-w-md"><AuthScreen onClose={onClose} /></div></div>
}

function HomePage({ event, summary, memberCount, isLoading, error, onRetry, onNavigate }: { event: CommunityEvent | null; summary: ReturnType<typeof summarizeCashTransactions>; memberCount: number; isLoading: boolean; error: string | null; onRetry: () => void; onNavigate: (tab: AppTab) => void }) {
  return (
    <section className="space-y-5" aria-labelledby="home-title">
      <PageHeading eyebrow="Pusat informasi keluarga" title="Selamat datang di IKT Connect" description="Semua anggota dapat melihat kabar arisan, kas, iuran, lokasi, dan buku doa tanpa login." />
      <section className="welcome-card relative overflow-hidden rounded-3xl p-5 text-white shadow-lg shadow-teal-900/10 sm:p-7">
        <div className="welcome-orb welcome-orb-one" /><div className="welcome-orb welcome-orb-two" />
        <div className="relative"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-100">Saldo kas bersama</p><p className="mt-2 text-3xl font-black tracking-tight">{formatRupiah(summary.balance)}</p><p className="mt-2 max-w-md text-sm leading-relaxed text-teal-50">Transparansi kas untuk menjaga kepercayaan dan kebersamaan keluarga IKT.</p><div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-full bg-white/15 px-3 py-1.5">{memberCount} anggota aktif</span><span className="rounded-full bg-white/15 px-3 py-1.5">{summary.monthLabel}</span></div></div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-teal-700">Agenda berikutnya</p><h2 className="mt-1 font-bold text-slate-900">Lokasi arisan</h2></div><CalendarDays className="text-teal-700" size={21} /></div>{isLoading ? <InlineLoading label="Memuat agenda..." /> : error ? <DataError message={error} onRetry={onRetry} /> : event ? <EventPreview event={event} /> : <p className="rounded-xl bg-slate-50 px-3 py-5 text-center text-sm text-slate-500">Belum ada agenda terdekat.</p>}</section>
      <div className="grid gap-3 sm:grid-cols-3"><QuickCard icon={CircleDollarSign} title="Lihat iuran" description="Cek yang sudah dan belum bayar" onClick={() => onNavigate('iuran')} /><QuickCard icon={HandCoins} title="Buku doa" description="Yasin, tahlil, dan doa arwah" onClick={() => onNavigate('doa')} /><QuickCard icon={Images} title="Galeri foto" description="Kenangan kegiatan keluarga" onClick={() => onNavigate('galeri')} /></div>
    </section>
  )
}

function FinancePage({ finance, summary, canManage, onAction }: { finance: ReturnType<typeof useFinance>; summary: ReturnType<typeof summarizeCashTransactions>; canManage: boolean; onAction: () => void }) {
  return <section className="space-y-5" aria-labelledby="finance-title"><PageHeading eyebrow="Ringkasan terbuka" title="Keuangan" description="Anggota dapat melihat ringkasan kas. Pencatatan hanya dilakukan pengurus." />{!canManage && <Notice message="Anda sedang melihat informasi kas. Tombol pencatatan hanya tersedia untuk admin dan bendahara." />}<div className="grid gap-3 sm:grid-cols-3"><MetricCard label="Saldo kas" value={summary.balance} icon={WalletCards} tone="teal" /><MetricCard label="Pemasukan bulan ini" value={summary.monthIncome} icon={ArrowUpRight} tone="blue" /><MetricCard label="Pengeluaran bulan ini" value={summary.monthExpense} icon={ArrowDownRight} tone="amber" /></div><section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="mb-4 flex items-center justify-between"><div><h2 id="finance-title" className="font-bold text-slate-900">Transaksi terbaru</h2><p className="mt-1 text-xs text-slate-500">Semua pemasukan dan pengeluaran tercatat di sini.</p></div>{canManage && <Button size="sm" onClick={onAction}><Plus size={15} /> Catat</Button>}</div>{finance.error && <DataError message={finance.error} onRetry={() => void finance.reload()} />}{finance.isLoading ? <InlineLoading label="Memuat transaksi..." /> : finance.transactions.length ? <div className="divide-y divide-slate-100">{finance.transactions.slice(0, 12).map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} />)}</div> : <EmptyState icon={WalletCards} title="Belum ada transaksi" description="Catatan pemasukan dan pengeluaran belum tersedia." />}</section></section>
}

function ContributionsPage({ contributions, members, canManage, reminderMembers, onLogin, onAdd }: { contributions: PublicContribution[]; members: CommunityMember[]; canManage: boolean; reminderMembers: Array<CommunityMember & { phone: string | null }>; onLogin: () => void; onAdd: () => void }) {
  const grouped = useMemo(() => members.filter((member) => member.is_active).map((member) => { const rows = contributions.filter((row) => row.member_id === member.id); const pending = rows.filter((row) => row.status === 'pending').length; return { member, rows, pending } }), [contributions, members])
  const outstanding = grouped.filter((item) => item.pending > 0)
  return <section className="space-y-5" aria-labelledby="contribution-title"><PageHeading eyebrow="Keterbukaan iuran" title="Iuran arisan" description="Anggota dapat melihat status pembayaran dan jumlah periode yang masih tercatat sebagai tunggakan." /><Notice message="Tunggakan dihitung dari periode yang sudah dibuat pengurus dan berstatus Belum lunas. Pastikan setiap periode baru dicatat agar jumlah bulan akurat." />{canManage && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-start gap-3"><Bell className="mt-0.5 shrink-0 text-amber-700" size={19} /><div><h2 className="font-bold text-amber-900">Pengingat pembayaran</h2><p className="mt-1 text-xs leading-relaxed text-amber-800">Kirim pesan WhatsApp kepada anggota yang memiliki tunggakan.</p></div></div><div className="mt-3 flex flex-wrap gap-2">{outstanding.length ? outstanding.map(({ member, pending }) => { const target = reminderMembers.find((item) => item.id === member.id); const phone = getWhatsAppNumber(target?.phone ?? null); return phone ? <a key={member.id} className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-amber-700 px-3 text-xs font-semibold text-white hover:bg-amber-800" href={`https://wa.me/${phone}?text=${encodeURIComponent(`Halo ${member.full_name}, mengingatkan iuran arisan yang masih tertunggak ${pending} bulan. Terima kasih.`)}`} target="_blank" rel="noreferrer"><Bell size={14} /> {member.full_name}</a> : <span key={member.id} className="rounded-xl bg-white/70 px-3 py-2 text-xs text-amber-800">{member.full_name} · nomor belum ada</span> }) : <span className="text-xs font-semibold text-emerald-700">Tidak ada tunggakan tercatat.</span>}</div></section>}{!canManage && <Notice message="Ingin mengingatkan anggota lain? Hubungi bendahara atau admin agar nomor kontak tetap terlindungi." tone="info" />}<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="mb-4 flex items-center justify-between"><div><h2 id="contribution-title" className="font-bold text-slate-900">Status per anggota</h2><p className="mt-1 text-xs text-slate-500">{members.filter((member) => member.is_active).length} anggota aktif</p></div>{canManage ? <Button size="sm" onClick={onAdd}><Plus size={15} /> Catat</Button> : <Button size="sm" variant="outline" onClick={onLogin}><LogIn size={15} /> Akses pengurus</Button>}</div>{!grouped.length ? <EmptyState icon={UsersRound} title="Belum ada data iuran" description="Status pembayaran akan tampil setelah pengurus mencatat periode." /> : <div className="space-y-3">{grouped.map(({ member, rows, pending }) => <ContributionRow key={member.id} member={member} rows={rows} pending={pending} />)}</div>}</section></section>
}

function ContributionRow({ member, rows, pending }: { member: CommunityMember; rows: PublicContribution[]; pending: number }) { const paid = rows.filter((row) => row.status === 'paid').length; return <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"><div className="flex items-center gap-3"><Avatar name={member.full_name} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900">{member.full_name || 'Tanpa nama'}</p><p className="mt-0.5 text-xs text-slate-500">{paid} periode lunas · {rows.length} periode tercatat</p></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${pending ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{pending ? `${pending} belum lunas` : 'Lunas'}</span></div></div> }

function PrayerPage({ notes, isLoading, error, onRetry }: { notes: PrayerNote[]; isLoading: boolean; error: string | null; onRetry: () => void }) { const [reader, setReader] = useState<'almarhum' | 'yasin' | 'tahlil' | 'doa'>('almarhum'); return <section className="space-y-5" aria-labelledby="prayer-title"><PageHeading eyebrow="Bacaan bersama" title="Buku Doa" description="Semua anggota boleh memimpin. Gunakan bacaan ini saat berkumpul atau membacanya sendiri." /><div className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">{(['almarhum', 'yasin', 'tahlil', 'doa'] as const).map((item, index) => <button type="button" key={item} onClick={() => setReader(item)} className={`min-w-max rounded-xl px-3 py-2 text-xs font-bold ${reader === item ? 'bg-teal-700 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>{String(index + 1).padStart(2, '0')} · {item === 'almarhum' ? 'Niat' : item[0].toUpperCase() + item.slice(1)}</button>)}</div>{reader === 'almarhum' && <PrayerIntro onNext={() => setReader('yasin')} />}{reader === 'yasin' && <YasinReader onNext={() => setReader('tahlil')} />}{reader === 'tahlil' && <ReadingReader title="Dzikir Tahlil" items={TAHLIL_NU_ONLINE} onNext={() => setReader('doa')} nextLabel="Lanjut ke Doa Arwah" />}{reader === 'doa' && <ReadingReader title="Doa Arwah" items={DOA_NU_ONLINE} />}{notes.length > 0 && <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="font-bold text-slate-900">Catatan doa keluarga</h2><div className="mt-3 space-y-3">{notes.map((note) => <article key={note.id} className="rounded-xl bg-slate-50 p-4"><h3 className="font-bold text-slate-900">{note.title}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{note.body}</p></article>)}</div></section>}{isLoading && <InlineLoading label="Memuat catatan doa..." />}{error && <DataError message={error} onRetry={onRetry} />}</section> }

function PrayerIntro({ onNext }: { onNext: () => void }) { return <section className="rounded-3xl border border-teal-100 bg-white p-5 shadow-sm sm:p-7"><div className="flex size-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700"><HandCoins size={25} /></div><p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Niat bersama</p><h2 className="mt-2 text-xl font-bold text-slate-900">Kirim Al-Fatihah untuk arwah</h2><p className="mt-3 text-sm leading-relaxed text-slate-600">Mari hadiahkan bacaan Al-Fatihah untuk orang tua, keluarga, dan seluruh arwah kaum muslimin. Siapa pun boleh memimpin pembacaan.</p><Button className="mt-5 w-full sm:w-auto" onClick={onNext}>Lanjut ke Surah Yasin <ChevronRight size={17} /></Button></section> }

function YasinReader({ onNext }: { onNext: () => void }) { return <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><div className="text-center"><p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Bacaan utama</p><h2 className="mt-2 text-xl font-bold text-slate-900">Surah Yasin</h2><p className="mt-1 text-xs text-slate-500">{YASIN_LENGKAP.length} ayat tersedia di aplikasi</p></div><p className="prayer-arabic mt-6 text-center text-2xl text-slate-900">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</p><div className="mt-5 space-y-3">{YASIN_LENGKAP.map((verse) => <div key={verse.no} className="rounded-2xl bg-slate-50 p-4"><span className="inline-flex size-7 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-700">{verse.no}</span><p className="prayer-arabic mt-3 text-right text-2xl leading-[2.1] text-slate-900">{verse.ar}</p><p className="mt-2 text-sm italic leading-relaxed text-slate-600">{verse.lt}</p></div>)}</div><Button className="mt-5 w-full" onClick={onNext}>Lanjut ke Dzikir Tahlil <ChevronRight size={17} /></Button></section> }

function ReadingReader({ title, items, onNext, nextLabel }: { title: string; items: Array<{ judul: string; ar: string; lt: string }>; onNext?: () => void; nextLabel?: string }) { return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div className="text-center"><p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Bacaan bersama</p><h2 className="mt-2 text-xl font-bold text-slate-900">{title}</h2></div><div className="mt-6 space-y-5">{items.map((item) => <article key={item.judul} className="border-b border-slate-100 pb-5 last:border-0"><h3 className="font-bold text-slate-900">{item.judul}</h3><p className="prayer-arabic mt-3 text-right text-2xl leading-[2.1] text-slate-900">{item.ar}</p><p className="mt-2 text-sm italic leading-relaxed text-slate-600">{item.lt}</p></article>)}</div>{onNext && <Button className="mt-2 w-full" onClick={onNext}>{nextLabel} <ChevronRight size={17} /></Button>}</section> }

function GalleryPage({ photos, isLoading, error, canManage, onRetry, onAdd }: { photos: GalleryPhoto[]; isLoading: boolean; error: string | null; canManage: boolean; onRetry: () => void; onAdd: () => void }) { return <section className="space-y-5" aria-labelledby="gallery-title"><PageHeading eyebrow="Kenangan bersama" title="Galeri foto" description="Simpan dan lihat kembali momen arisan keluarga IKT." />{canManage && <Button onClick={onAdd}><Camera size={17} /> Tambah foto</Button>}{isLoading ? <InlineLoading label="Memuat galeri..." /> : error ? <DataError message={error} onRetry={onRetry} /> : photos.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{photos.map((photo) => <figure key={photo.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><img src={photo.image_url} alt={photo.title} loading="lazy" className="aspect-square w-full object-cover" /><figcaption className="p-3"><p className="truncate text-sm font-bold text-slate-900">{photo.title}</p>{photo.caption && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{photo.caption}</p>}{photo.taken_on && <p className="mt-2 text-[10px] text-slate-400">{formatDate(photo.taken_on)}</p>}</figcaption></figure>)}</div> : <EmptyState icon={Images} title="Belum ada foto" description="Foto kegiatan akan tampil di sini setelah ditambahkan pengurus." />}</section> }

function MembersPage({ members, isLoading, error, onRetry }: { members: CommunityMember[]; isLoading: boolean; error: string | null; onRetry: () => void }) { const [query, setQuery] = useState(''); const filtered = members.filter((member) => member.full_name.toLowerCase().includes(query.toLowerCase())); return <section className="space-y-5" aria-labelledby="member-title"><PageHeading eyebrow="Keluarga IKT" title="Daftar anggota" description="Kenali keluarga besar arisan kita." /><section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama anggota..." aria-label="Cari nama anggota" className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" />{isLoading ? <InlineLoading label="Memuat anggota..." /> : error ? <DataError message={error} onRetry={onRetry} /> : filtered.length ? <div className="mt-3 divide-y divide-slate-100">{filtered.map((member) => <MemberRow key={member.id} member={member} />)}</div> : <EmptyState icon={UsersRound} title="Anggota belum ditemukan" description={query ? 'Coba gunakan nama lain.' : 'Belum ada anggota aktif.'} />}</section></section> }

function MemberRow({ member }: { member: CommunityMember }) { return <div className="flex items-center gap-3 p-3"><Avatar name={member.full_name} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900">{member.full_name || 'Tanpa nama'}</p><p className="mt-0.5 text-xs text-slate-500">{member.role === 'treasurer' ? 'Bendahara' : member.role === 'admin' ? 'Admin' : 'Anggota'}</p></div><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">Aktif</span></div> }

function EventPreview({ event }: { event: CommunityEvent }) { const mapsUrl = getSafeMapUrl(event.map_url, event.location); return <div><h3 className="text-lg font-bold text-slate-900">{event.title}</h3><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3"><CalendarDays className="mt-0.5 text-teal-700" size={18} /><span><small className="block text-xs text-slate-500">Tanggal dan waktu</small><strong className="mt-1 block text-sm text-slate-800">{formatDateTime(event.starts_at)}</strong></span></div><div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3"><MapPin className="mt-0.5 text-teal-700" size={18} /><span><small className="block text-xs text-slate-500">Lokasi</small><strong className="mt-1 block text-sm text-slate-800">{event.location || 'Alamat belum tersedia'}</strong></span></div></div>{event.description && <p className="mt-3 text-sm leading-relaxed text-slate-600">{event.description}</p>}{mapsUrl && <a href={mapsUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800">Buka lokasi di Google Maps <ExternalLink size={16} /></a>}</div> }

function TransactionRow({ transaction }: { transaction: CashTransaction }) { return <div className="flex items-center gap-3 py-3"><span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${transaction.type === 'income' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{transaction.type === 'income' ? <ArrowUpRight size={17} /> : <ArrowDownRight size={17} />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{transaction.description}</p><p className="mt-0.5 text-xs text-slate-500">{transaction.category} · {formatDate(transaction.occurred_on)}</p></div><strong className={`text-sm ${transaction.type === 'income' ? 'text-emerald-700' : 'text-amber-700'}`}>{transaction.type === 'income' ? '+' : '-'}{formatRupiah(Number(transaction.amount))}</strong></div> }

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