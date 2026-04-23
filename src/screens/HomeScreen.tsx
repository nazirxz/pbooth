import { motion } from 'framer-motion'
import { ChannelBar } from '@/components/ChannelBar'
import { TVButton } from '@/components/TVButton'
import { useSession } from '@/state/session-store'
import { appConfig } from '@/config/app-config'

export function HomeScreen() {
  const goTo = useSession((s) => s.goTo)
  const start = () => goTo(appConfig.payment.enabled ? 'payment' : 'template')

  return (
    <div className="absolute inset-0 flex flex-col">
      <ChannelBar channel="01" label="WELCOME" />

      <div className="flex-1 grid grid-cols-2 px-16 gap-12 items-center">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="text-left"
        >
          <div className="font-pixel text-7xl text-crt-phosphor rgb-split leading-[1.15]">
            PHOTO
            <br />
            BOOTH
          </div>
          <div className="mt-8 font-crt text-3xl text-crt-cream/85 tracking-widest">
            RETRO TV EDITION
          </div>
          <div className="mt-4 font-crt text-2xl text-crt-amber/90 tracking-widest">
            {appConfig.payment.enabled
              ? `RP ${appConfig.payment.amount.toLocaleString('id-ID')} / SESSION`
              : 'FREE MODE'}
          </div>
        </motion.div>

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, type: 'spring' }}
          className="flex flex-col items-center gap-6"
        >
          <div className="font-crt text-2xl text-crt-cream/70 tracking-widest">
            TAP TO BEGIN
          </div>
          <TVButton onClick={start} size="xl" variant="primary">
            ▶ PRESS START
          </TVButton>
        </motion.div>
      </div>

      <div className="px-10 pb-5 flex justify-between font-crt text-lg text-crt-cream/50 tracking-wider">
        <span>CH 01 / WELCOME</span>
        <span>STEREO · NTSC</span>
      </div>
    </div>
  )
}
