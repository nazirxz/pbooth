import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useSession } from '@/state/session-store'
import { Logo } from '@/components/Logo'

export function BootScreen() {
  const goTo = useSession((s) => s.goTo)

  useEffect(() => {
    const t = setTimeout(() => goTo('theme-select'), 2600)
    return () => clearTimeout(t)
  }, [goTo])

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black">
      <motion.div
        initial={{ scaleY: 0.01, scaleX: 1, opacity: 0 }}
        animate={{ scaleY: [0.01, 0.01, 1, 1], scaleX: [1, 0.02, 0.02, 1], opacity: [0, 1, 1, 1] }}
        transition={{ duration: 1.2, times: [0, 0.3, 0.55, 1], ease: 'easeOut' }}
        className="w-full h-full flex items-center justify-center"
      >
        <div className="text-center flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0, duration: 0.4 }}
            className="animate-crt-flicker"
          >
            <Logo variant="white" className="w-[420px] h-[120px]" />
          </motion.div>
          <div className="mt-3 font-pixel text-2xl text-crt-phosphor rgb-split">
            PHOTOBOOTH
          </div>
          <div className="mt-6 font-crt text-xl text-crt-cream/70 tracking-[0.3em]">
            RETRO TV SYSTEM v0.1
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.8 }}
            className="mt-10 font-crt text-lg text-crt-amber animate-blink tracking-widest"
          >
            ▌ INITIALIZING...
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}
