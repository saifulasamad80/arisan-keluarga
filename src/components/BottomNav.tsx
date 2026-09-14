import { BookHeart, Camera, CircleDollarSign, ClipboardList, Heart, LayoutDashboard, UsersRound, WalletCards } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../lib/utils'

export type AppTab = 'beranda' | 'keuangan' | 'iuran' | 'doa' | 'anggota' | 'almarhum' | 'galeri' | 'audit'

interface BottomNavProps {
  activeTab: AppTab
  onChange: (tab: AppTab) => void
  showAudit?: boolean
}

const navigation: Array<{ id: AppTab; label: string; icon: LucideIcon }> = [
  { id: 'beranda', label: 'Beranda', icon: LayoutDashboard },
  { id: 'keuangan', label: 'Kas', icon: WalletCards },
  { id: 'iuran', label: 'Iuran', icon: CircleDollarSign },
  { id: 'doa', label: 'Doa', icon: BookHeart },
  { id: 'anggota', label: 'Anggota', icon: UsersRound },
  { id: 'almarhum', label: 'Almarhum', icon: Heart },
  { id: 'galeri', label: 'Galeri', icon: Camera },
]

export function BottomNav({ activeTab, onChange, showAudit = false }: BottomNavProps) {
  const items = showAudit
    ? [...navigation, { id: 'audit' as const, label: 'Audit', icon: ClipboardList }]
    : navigation

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t-4 border-teal-800 bg-white px-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_28px_rgba(28,25,23,0.12)]">
      <div className="mx-auto grid max-w-3xl grid-cols-4 gap-1.5">
        {items.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={cn(
                'flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[13px] font-bold leading-tight',
                active ? 'bg-teal-800 text-white shadow-md shadow-teal-900/25' : 'bg-stone-100 text-stone-800 hover:bg-amber-100 hover:text-stone-950',
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={24} strokeWidth={active ? 2.6 : 2.2} />
              {label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
