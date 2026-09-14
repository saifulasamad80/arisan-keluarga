import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline'
type ButtonSize = 'default' | 'sm' | 'icon'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function Button({
  className,
  variant = 'primary',
  size = 'default',
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-2xl font-bold touch-manipulation transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        variant === 'primary' && 'bg-teal-800 text-white shadow-md shadow-teal-900/20 hover:bg-teal-900',
        variant === 'secondary' && 'bg-amber-100 text-amber-950 hover:bg-amber-200',
        variant === 'ghost' && 'text-stone-800 hover:bg-stone-100 hover:text-stone-950',
        variant === 'outline' && 'border-2 border-stone-400 bg-white text-stone-800 hover:border-teal-700 hover:bg-teal-50',
        size === 'default' && 'min-h-12 px-5 text-base',
        size === 'sm' && 'min-h-11 px-4 text-sm',
        size === 'icon' && 'size-12',
        className,
      )}
      {...props}
    />
  )
}
