import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useSession } from '@/state/session-store'

export function BootScreen() {
  const goTo = useSession((s) => s.goTo)

  useEffect(() => {
    const t = setTimeout(() => goTo('home'), 2200)
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
        <div className="text-center">
          <div className="font-pixel text-5xl text-crt-phosphor rgb-split animate-crt-flicker">
            PBOOTH
          </div>
          <div className="mt-6 font-crt text-2xl text-crt-cream/80 tracking-widest">
            RETRO TV SYSTEM v0.1
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4 }}
            className="mt-12 font-crt text-xl text-crt-amber animate-blink"
          >
            ▌ INITIALIZING...
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}
