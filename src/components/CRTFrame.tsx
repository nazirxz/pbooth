import { PropsWithChildren } from 'react'
import clsx from 'clsx'

interface Props {
  className?: string
  withFlicker?: boolean
  withMovingLine?: boolean
}

/**
 * Simulated CRT viewport — bezel + curved inner screen + scanlines.
 * Place over any screen-filling content.
 */
export function CRTFrame({
  children,
  className,
  withFlicker = true,
  withMovingLine = true,
}: PropsWithChildren<Props>) {
  return (
    <div className={clsx('relative w-full h-full bg-crt-bezelDark', className)}>
      {/* Outer plastic bezel */}
      <div className="absolute inset-0 p-[3%]">
        <div
          className="relative w-full h-full rounded-[36px] bg-gradient-to-br from-crt-bezelLight via-crt-bezel to-crt-bezelDark shadow-[inset_0_0_40px_rgba(0,0,0,0.7),0_20px_60px_rgba(0,0,0,0.6)]"
          style={{
            padding: '4%',
          }}
        >
          {/* Inner CRT screen */}
          <div
            className={clsx(
              'relative w-full h-full overflow-hidden scanlines',
              withMovingLine && 'moving-scanline',
              withFlicker && 'crt-flicker',
            )}
            style={{
              borderRadius: '28px',
              background: '#050505',
              boxShadow: 'inset 0 0 80px rgba(0,0,0,0.9), inset 0 0 20px rgba(57,255,20,0.05)',
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
