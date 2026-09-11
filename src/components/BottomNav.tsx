import { BookHeart, Camera, CircleDollarSign, LayoutDashboard, UsersRound, WalletCards } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../lib/utils'

export type AppTab = 'beranda' | 'keuangan' | 'iuran' | 'doa' | 'anggota' | 'galeri'

interface BottomNavProps {
  activeTab: AppTab
  onChange: (tab: AppTab) => void
}

const navigation: Array<{ id: AppTab; label: string; icon: LucideIcon }> = [
  { id: 'beranda', label: 'Beranda', icon: LayoutDashboard },
  { id: 'keuangan', label: 'Keuangan', icon: WalletCards },
  { id: 'iuran', label: 'Iuran', icon: CircleDollarSign },
  { id: 'doa', label: 'Buku Doa', icon: BookHeart },
  { id: 'anggota', label: 'Anggota', icon: UsersRound },
  { id: 'galeri', label: 'Galeri', icon: Camera },
]

export function BottomNav({ activeTab, onChange }: BottomNavProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200/80 bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.05)] backdrop-blur md:static md:mx-auto md:mt-auto md:w-full md:max-w-3xl md:border-t md:bg-white md:shadow-none">
      <div className="mx-auto flex max-w-2xl items-center justify-between overflow-x-auto md:max-w-none md:justify-center md:gap-7">
        {navigation.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={cn(
                'flex min-w-[4.5rem] flex-col items-center gap-1 rounded-xl px-2 py-1 text-[11px] font-medium transition',
                active ? 'text-teal-700' : 'text-slate-400 hover:text-slate-700',
              )}
              aria-current={active ? 'page' : undefined}
            >
              <span className={cn('rounded-xl p-1.5', active && 'bg-teal-50')}>
                <Icon size={19} strokeWidth={active ? 2.4 : 2} />
              </span>
              {label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}