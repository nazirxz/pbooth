import { PropsWithChildren } from 'react'
import clsx from 'clsx'

interface Props {
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  disabled?: boolean
}

const VARIANTS: Record<NonNullable<Props['variant']>, string> = {
  primary:
    'bg-crt-phosphor text-black border-crt-phosphor shadow-[0_0_20px_rgba(57,255,20,0.5)]',
  secondary:
    'bg-crt-bezel text-crt-cream border-crt-cream/60',
  ghost:
    'bg-transparent text-crt-cream border-crt-cream/40',
  danger:
    'bg-crt-red text-black border-crt-red shadow-[0_0_16px_rgba(255,59,48,0.5)]',
}

const SIZES: Record<NonNullable<Props['size']>, string> = {
  sm: 'text-xl px-4 py-2 min-h-[48px]',
  md: 'text-2xl px-6 py-3 min-h-[64px]',
  lg: 'text-3xl px-8 py-5 min-h-[88px]',
  xl: 'text-5xl px-12 py-8 min-h-[120px]',
}

export function TVButton({
  children,
  onClick,
  variant = 'primary',
  size = 'lg',
  className,
  disabled,
}: PropsWithChildren<Props>) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'font-pixel tracking-widest uppercase border-4 rounded-xl touch-press',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {children}
    </button>
  )
}
