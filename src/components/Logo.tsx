import clsx from 'clsx'
import logoWhite from '@/asset/euorna_white.jpeg'
import logoBlack from '@/asset/euorna_black.jpeg'

interface Props {
  variant?: 'white' | 'black'
  className?: string
}

/**
 * Euorna logo. Source JPEGs have solid background (black-on-white or white-on-black),
 * so we use mix-blend-mode to drop the background:
 *   - 'white' (white text on black bg) → blend 'screen' over dark UI (black becomes transparent)
 *   - 'black' (black text on white bg) → blend 'multiply' over light UI (white becomes transparent)
 *
 * The source image is tall portrait with logo mid-canvas, so we crop vertically via
 * object-position + aspect clip on the container.
 */
export function Logo({ variant = 'white', className }: Props) {
  const src = variant === 'white' ? logoWhite : logoBlack
  return (
    <div className={clsx('relative overflow-hidden inline-block pointer-events-none', className)}>
      <img
        src={src}
        alt="euorna"
        draggable={false}
        className="w-full h-full object-cover"
        style={{
          objectPosition: '50% 63%',
          mixBlendMode: variant === 'white' ? 'screen' : 'multiply',
        }}
      />
    </div>
  )
}
