import { PropsWithChildren } from 'react'
import clsx from 'clsx'
import { useTheme } from '@/state/theme-store'

interface Props {
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  disabled?: boolean
}

const SIZES: Record<NonNullable<Props['size']>, string> = {
  sm: 'text-xl px-4 py-2 min-h-[48px]',
  md: 'text-2xl px-6 py-3 min-h-[64px]',
  lg: 'text-3xl px-8 py-5 min-h-[88px]',
  xl: 'text-5xl px-12 py-8 min-h-[120px]',
}

const RETRO_VARIANTS: Record<NonNullable<Props['variant']>, string> = {
  primary: 'bg-crt-phosphor text-black border-crt-phosphor shadow-[0_0_20px_rgba(57,255,20,0.5)]',
  secondary: 'bg-crt-bezel text-crt-cream border-crt-cream/60',
  ghost: 'bg-transparent text-crt-cream border-crt-cream/40',
  danger: 'bg-crt-red text-black border-crt-red shadow-[0_0_16px_rgba(255,59,48,0.5)]',
}

export function TVButton({
  children,
  onClick,
  variant = 'primary',
  size = 'lg',
  className,
  disabled,
}: PropsWithChildren<Props>) {
  const themeId = useTheme((s) => s.themeId)

  if (themeId === 'y2k') {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={clsx(
          'touch-press font-extrabold tracking-[0.15em] uppercase rounded-full border-0',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          SIZES[size],
          className,
        )}
        style={y2kStyle(variant)}
      >
        {children}
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'font-pixel tracking-widest uppercase border-4 rounded-xl touch-press',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        RETRO_VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {children}
    </button>
  )
}

function y2kStyle(variant: NonNullable<Props['variant']>): React.CSSProperties {
  const base: React.CSSProperties = {
    fontFamily: '"Fredoka", "Baloo 2", sans-serif',
  }
  switch (variant) {
    case 'primary':
      return {
        ...base,
        background: 'linear-gradient(135deg, #ff4fa1 0%, #c3a4ff 100%)',
        color: '#ffffff',
        boxShadow: '0 12px 30px rgba(255, 79, 161, 0.45), inset 0 2px 0 rgba(255,255,255,0.35)',
      }
    case 'secondary':
      return {
        ...base,
        background: 'rgba(255,255,255,0.6)',
        color: '#2a0d3a',
        boxShadow: '0 4px 14px rgba(42, 13, 58, 0.15), inset 0 1px 0 rgba(255,255,255,0.6)',
      }
    case 'ghost':
      return {
        ...base,
        background: 'rgba(255,255,255,0.25)',
        color: '#2a0d3a',
        boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.55)',
      }
    case 'danger':
      return {
        ...base,
        background: 'linear-gradient(135deg, #ff2e5b 0%, #ff4fa1 100%)',
        color: '#ffffff',
        boxShadow: '0 10px 25px rgba(255, 46, 91, 0.45)',
      }
  }
}
